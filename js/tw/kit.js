// kit.js — 共享视觉资产：程序化纹理、星空、网格地面、浮尘、字形图集
import * as THREE from 'three';
import { U } from './core.js';

// ---------- 程序化纹理 ----------
const _cache = new Map();

// 圆形辉光贴图（用于粒子/光晕）
export function glowTexture(inner = '#ffffff', outer = 'rgba(255,255,255,0)') {
  const key = 'glow' + inner + outer;
  if (_cache.has(key)) return _cache.get(key);
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  _cache.set(key, tex);
  return tex;
}

// 六边形/星形光点
export function starTexture() {
  if (_cache.has('star')) return _cache.get('star');
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.5, 'rgba(180,220,255,0.18)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  // 十字星芒
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(S / 2, 4); g.lineTo(S / 2, S - 4);
  g.moveTo(4, S / 2); g.lineTo(S - 4, S / 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  _cache.set('star', tex);
  return tex;
}

// 字形图集：8x8 = 64 个字符（十六进制/片假名/符号）
export function glyphAtlas() {
  if (_cache.has('glyph')) return _cache.get('glyph');
  const N = 8, CELL = 64, S = N * CELL;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const chars = '0123456789ABCDEFabcdef:.=+*/<>[]{}()#@$%&?!;';
  const kata = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
  g.font = 'bold 44px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const rnd = U.rnd(7);
  for (let i = 0; i < N * N; i++) {
    const cx = (i % N) * CELL + CELL / 2;
    const cy = Math.floor(i / N) * CELL + CELL / 2;
    const pick = rnd() < 0.72
      ? chars[Math.floor(rnd() * chars.length)]
      : kata[Math.floor(rnd() * kata.length)];
    g.fillStyle = '#fff';
    g.fillText(pick, cx, cy);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  _cache.set('glyph', tex);
  return tex;
}

// 软边圆点（用于尘埃）
export function dustTexture() {
  if (_cache.has('dust')) return _cache.get('dust');
  const S = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  _cache.set('dust', tex);
  return tex;
}

// ---------- 星空（球壳分布） ----------
export function makeStars(count = 2400, radius = 90, size = 0.55) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const rnd = U.rnd(31);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // 均匀球面
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const r = radius * (0.55 + rnd() * 0.45);
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
    // 冷色偏多
    const k = rnd();
    if (k < 0.62) c.setHSL(0.58, 0.35, 0.72 + rnd() * 0.22);
    else if (k < 0.86) c.setHSL(0.50, 0.18, 0.80 + rnd() * 0.15);
    else c.setHSL(0.10, 0.55, 0.78 + rnd() * 0.18);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size, map: starTexture(), vertexColors: true, transparent: true,
    opacity: 0.85, sizeAttenuation: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

// ---------- 网格地面（渐隐） ----------
export function makeGridFloor(size = 60, div = 60, color = 0x2a4a8a) {
  const g = new THREE.GridHelper(size, div, color, color);
  g.material.transparent = true;
  g.material.opacity = 0.22;
  g.material.depthWrite = false;
  g.material.blending = THREE.AdditiveBlending;
  g.position.y = -1.9;
  return g;
}

// ---------- 浮尘（近景粒子，制造景深） ----------
export function makeMotes(count = 700, spread = 14, color = 0x9fd8ff) {
  const pos = new Float32Array(count * 3);
  const rnd = U.rnd(53);
  // 关键：不能均匀撒在立方体里——相机常位于原点附近，
  // 贴近相机的粒子会被 sizeAttenuation 放大成巨大的白色光斑。
  // 因此撒在「外壳」上：半径 rMin..rMax 的球壳内，且始终远离原点。
  const rMin = spread * 0.28;
  const rMax = spread * 0.62;
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = rMin + rnd() * (rMax - rMin);
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r * 0.72;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.030, map: dustTexture(), color, transparent: true, opacity: 0.34,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

// ---------- 光晕精灵 ----------
export function makeGlowSprite(color, scale = 4, opacity = 0.5) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

// ---------- 光照组（每个场景通用） ----------
// 注意强度单位：Three r155+ 默认物理正确光照，PointLight 强度是坎德拉。
// 早期把 rim 默认写成 26 / 20，在 1–2 m 距离上等于几十 lux，任何浅色材质都会被
// 推到纯白（pre1 的环阵列、c1 的棱线都吃过这个亏）。这里统一收到个位数。
export function makeLights(pal, opts = {}) {
  const g = new THREE.Group();
  const key = new THREE.DirectionalLight(0xffffff, opts.key ?? 1.5);
  key.position.set(4, 6, 5);
  key.castShadow = !!opts.shadow;
  if (opts.shadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
  }
  g.add(key);

  const rim1 = new THREE.PointLight(pal.b, opts.rim ?? 5.5, 22, 2);
  rim1.position.set(-4.2, -1.6, 3.2);
  g.add(rim1);

  const rim2 = new THREE.PointLight(pal.a, opts.rim2 ?? 4.2, 20, 2);
  rim2.position.set(3.6, 2.4, -2.8);
  g.add(rim2);

  const amb = new THREE.AmbientLight(pal.a, opts.amb ?? 0.22);
  g.add(amb);

  g.userData = { key, rim1, rim2, amb };
  return g;
}

// ---------- 能量核心（自定义着色器：菲涅尔 + 噪声脉络 + 边缘光） ----------
export function makeCore(pal, r = 0.55) {
  const g = new THREE.Group();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uA: { value: new THREE.Color(pal.a) },
      uB: { value: new THREE.Color(pal.b) },
      uC: { value: new THREE.Color(pal.c) },
      uPower: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP; varying vec3 vPos;
      void main(){
        vPos = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime, uBass, uPower;
      uniform vec3 uA, uB, uC;
      varying vec3 vN; varying vec3 vP; varying vec3 vPos;

      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float noise(vec3 p){
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p){
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; }
        return s;
      }

      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(-vP);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);

        // 表面能量脉络
        vec3 q = vPos * 3.4 + vec3(0.0, uTime * 0.22, uTime * 0.14);
        float n = fbm(q);
        float veins = smoothstep(0.46, 0.72, n);
        float n2 = fbm(q * 2.6 - vec3(uTime * 0.3));
        veins += smoothstep(0.52, 0.80, n2) * 0.6;

        // 极向环带
        float band = smoothstep(0.86, 1.0, abs(sin(vPos.y * 9.0 + uTime * 0.8)));

        vec3 col = uA * 0.14;
        col += uB * veins * (0.30 + uBass * 0.45);
        col += uC * band * 0.06;
        col += mix(uB, uC, 0.35) * fres * (0.62 + uBass * 0.45);
        col *= uPower;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 5), mat);
  g.add(core);
  const halo = makeGlowSprite(pal.a, r * 4.6, 0.10);
  g.add(halo);
  g.userData = { core, halo, mat };
  return g;
}
