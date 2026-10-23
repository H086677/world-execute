// core.js — Three.js 场景基础设施：渲染器、后期链、材质库、工具函数
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ---------- 全局色板（每个段落一套，主/辅/强调） ----------
// a = 主色（大面积结构），b = 辅助色（轮廓/高光），c = 强调色（脉冲/刻度）。
// 注意：c 曾经统一写成 0xffffff，于是所有用 pal.c 画的东西（脊柱、脉冲光晕、
// 刻度、扫描线）都变成纯白并烧穿 Bloom。这里按段落给出真正的强调色，
// 亮度整体低于 b，避免又变成白色。
export const PALETTE = {
  intro: { a: 0x2a6cff, b: 0x7fd8ff, c: 0x9fe4ff, fog: 0x03060f },
  inst1: { a: 0x18d98a, b: 0x9dffce, c: 0x6effb4, fog: 0x02080a },
  v1:    { a: 0x5c7dff, b: 0xb9a8ff, c: 0x8fa8ff, fog: 0x05060f },
  pre1:  { a: 0x18e0d0, b: 0xa8fff4, c: 0x5cf0e4, fog: 0x020a0c },
  c1:    { a: 0x9a55ff, b: 0xff7fd8, c: 0xc08cff, fog: 0x08040f },
  v2:    { a: 0xff9a3c, b: 0xffd79a, c: 0xffb266, fog: 0x0c0603 },
  pre2:  { a: 0xff3fa8, b: 0xffa8dc, c: 0xff7ec2, fog: 0x0c030a },
  c2:    { a: 0x3f6bff, b: 0x9ab8ff, c: 0x7f9dff, fog: 0x03060f },
  c2x:   { a: 0xff6a3c, b: 0xffb89a, c: 0xff8f66, fog: 0x0c0503 },
  bridge:{ a: 0xff2a38, b: 0xff8a92, c: 0xff6070, fog: 0x0c0204 },
  inst2: { a: 0x3cff8a, b: 0xaaffcc, c: 0x7cffb0, fog: 0x020a05 },
  chant: { a: 0xff1a2e, b: 0xff7a8a, c: 0xff4a5c, fog: 0x0c0103 },
  c3:    { a: 0xff3f6a, b: 0xff9ab0, c: 0xff6f92, fog: 0x0c0205 },
  love:  { a: 0xff5c96, b: 0xffb8d0, c: 0xff8cb4, fog: 0x0c0308 },
  outro: { a: 0x3f6bd8, b: 0x8aa8ff, c: 0x6a8ce8, fog: 0x02040c },
  end:   { a: 0x1a2450, b: 0x3a4a80, c: 0x2a3a68, fog: 0x010206 },
};

// ---------- 渲染器 ----------
export class Stage {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: opts.antialias !== false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!opts.preserve,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.70;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03060f);
    this.scene.fog = new THREE.FogExp2(0x03060f, 0.028);

    this.camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.05, 400);
    this.camera.position.set(0, 0, 7);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      opts.bloomStrength ?? 0.38,
      opts.bloomRadius ?? 0.55,
      opts.bloomThreshold ?? 0.62
    );
    this.composer.addPass(this.bloom);

    // 自定义胶片/色差/扫描线
    this.grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uCa: { value: 0.0016 },
        uGrain: { value: 0.045 },
        uScan: { value: 0.10 },
        uVig: { value: 0.55 },
        uFlash: { value: 0 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform float uTime, uCa, uGrain, uScan, uVig, uFlash;
        uniform vec3 uTint;
        varying vec2 vUv;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          vec2 d = uv - 0.5;
          float r2 = dot(d,d);
          // 径向色差
          float k = uCa * (0.4 + r2 * 2.2);
          vec3 col;
          col.r = texture2D(tDiffuse, uv + d * k).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - d * k).b;
          // 色调
          col *= uTint;
          // 暗角
          float vig = smoothstep(0.92, 0.18, length(d) * 1.32);
          col *= mix(1.0, vig, uVig);
          // 扫描线
          float scan = sin(uv.y * 1400.0) * 0.5 + 0.5;
          col *= 1.0 - uScan * scan * 0.35;
          // 颗粒
          float g = h21(uv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7);
          col += (g - 0.5) * uGrain;
          // 闪白
          col = mix(col, vec3(1.0), uFlash);
          gl_FragColor = vec4(max(col, 0.0), 1.0);
        }
      `,
    });
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    addEventListener('resize', () => this.resize(), { passive: true });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  setPalette(pal) {
    this.scene.background.setHex(pal.fog);
    this.scene.fog.color.setHex(pal.fog);
  }

  render(t, fx = {}) {
    const u = this.grade.uniforms;
    u.uTime.value = t;
    if (fx.ca !== undefined) u.uCa.value = fx.ca;
    if (fx.grain !== undefined) u.uGrain.value = fx.grain;
    if (fx.scan !== undefined) u.uScan.value = fx.scan;
    if (fx.vig !== undefined) u.uVig.value = fx.vig;
    if (fx.flash !== undefined) u.uFlash.value = fx.flash;
    if (fx.bloom !== undefined) this.bloom.strength = fx.bloom;
    this.composer.render();
  }
}

// ---------- 材质工厂 ----------
export const MAT = {
  // 发光实体：金属 + 自发光（emissive 控制在 1 以内，否则 ACES 后爆白）
  solid(color, emissive, ei = 0.55, rough = 0.32, metal = 0.72) {
    return new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: ei, roughness: rough, metalness: metal,
    });
  },
  // 线框发光
  glowLine(color, opacity = 0.75) {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  },
  // 点阵
  points(color, size = 0.035, opacity = 0.9) {
    return new THREE.PointsMaterial({
      color, size, transparent: true, opacity, sizeAttenuation: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
  },
  // 玻璃
  glass(color, opacity = 0.16) {
    return new THREE.MeshPhysicalMaterial({
      color, transparent: true, opacity, roughness: 0.06, metalness: 0.0,
      transmission: 0.92, thickness: 0.6, ior: 1.45, side: THREE.DoubleSide,
    });
  },
  // 全息面片（自定义着色器）
  holo(color, intensity = 1.0) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vP;
        void main(){
          vUv = uv;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uColor; uniform float uI, uTime;
        varying vec2 vUv; varying vec3 vN; varying vec3 vP;
        void main(){
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 2.2);
          float lines = smoothstep(0.42, 0.58, abs(fract(vUv.y * 42.0 - uTime * 0.6) - 0.5));
          float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x)
                     * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
          float a = (fres * 0.9 + lines * 0.16 + 0.05) * edge * uI;
          gl_FragColor = vec4(uColor * (0.6 + fres * 1.8), a);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  },
};

// ---------- 工具 ----------
export const U = {
  // 线性插值
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  smooth: (a, b, t) => { const x = U.clamp((t - a) / (b - a || 1e-9), 0, 1); return x * x * (3 - 2 * x); },
  // 缓动
  ease: {
    inOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    expo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  },
  // 确定性伪随机（保证每次运行一致）
  rnd(seed) {
    let s = seed * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  },
  hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); },
  // 生成沿曲线的管道
  tube(points, radius, radialSeg = 8, tubularSeg = 120) {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, tubularSeg, radius, radialSeg, false);
  },
  // 抖动顶点（有机感）
  jitter(geo, amp, seed = 1) {
    const pos = geo.attributes.position;
    const r = U.rnd(seed);
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i,
        pos.getX(i) + (r() - 0.5) * amp,
        pos.getY(i) + (r() - 0.5) * amp,
        pos.getZ(i) + (r() - 0.5) * amp);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  },
};

export { THREE };
