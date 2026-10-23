// scenes_b.js — 场景 4-12：牢笼 / 有机体 / 镜像 / 振动 / 碎片 / 报错 / 刀刃 / 心 / 虚空
import * as THREE from 'three';
import { PALETTE, MAT, U } from './core.js';
import { makeStars, makeGridFloor, makeMotes, makeGlowSprite, makeLights, makeCore, glowTexture } from './kit.js';

// 通用：金属发光材质
const SOLID = (pal, ei = 0.55, rough = 0.30, metal = 0.70) =>
  new THREE.MeshStandardMaterial({
    color: pal.a, emissive: pal.b, emissiveIntensity: ei,
    roughness: rough, metalness: metal,
  });

// 通用：细线材质
const LINE = (color, op = 0.34) => new THREE.LineBasicMaterial({
  color, transparent: true, opacity: op,
  blending: THREE.AdditiveBlending, depthWrite: false,
});

// 通用：背景粒子与浮尘
function backdrop(root, pal, stars = 1600, motes = 600) {
  root.add(makeStars(stars, 82, 0.40));
  root.add(makeMotes(motes, 16, pal.b));
}

// 通用：漂浮碎屑
function debris(root, pal, n, spread, seed, size = 0.05) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(size, size, size * 0.24);
  const mat = new THREE.MeshStandardMaterial({
    color: pal.b, emissive: pal.a, emissiveIntensity: 0.38, roughness: 0.4, metalness: 0.5,
  });
  const rnd = U.rnd(seed);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set((rnd() - 0.5) * spread, (rnd() - 0.5) * spread * 0.7, (rnd() - 0.5) * spread);
    m.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
    m.userData = { sp: 0.25 + rnd(), ph: rnd() * 9, ax: rnd() - 0.5, ay: rnd() - 0.5 };
    g.add(m);
  }
  root.add(g);
  return g;
}

// ============ 4. c1 —— 立方牢笼 ============
export function sceneCage() {
  const pal = PALETTE.c1;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.4, rim: 4.8, amb: 0.18 });
  root.add(lights);
  backdrop(root, pal, 1800, 700);

  const core = makeCore(pal, 0.36);
  root.add(core);

  // 立方体框架（12 条棱）
  const S = 2.05;
  const edgeMat = SOLID(pal, 0.42, 0.25, 0.85);
  const edges = [];
  const corners = [];
  for (let i = 0; i < 8; i++) {
    corners.push([(i & 1 ? 1 : -1) * S, (i & 2 ? 1 : -1) * S, (i & 4 ? 1 : -1) * S]);
  }
  const pairs = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = corners[i], b = corners[j];
    const diff = [a[0] !== b[0], a[1] !== b[1], a[2] !== b[2]].filter(Boolean).length;
    if (diff === 1) pairs.push([a, b]);
  }
  for (const [a, b] of pairs) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const len = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const geo = new THREE.CylinderGeometry(0.030, 0.030, len, 6);
    const m = new THREE.Mesh(geo, edgeMat);
    m.position.set(...mid);
    if (a[0] !== b[0]) m.rotation.z = Math.PI / 2;
    else if (a[2] !== b[2]) m.rotation.x = Math.PI / 2;
    root.add(m);
    edges.push(m);
  }
  // 棱上的节点球
  corners.forEach(c => {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 12),
      new THREE.MeshBasicMaterial({ color: pal.c, transparent: true, opacity: 0.75 })
    );
    s.position.set(...c);
    root.add(s);
  });

  // 半透明面（关押感）
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: pal.a, transparent: true, opacity: 0.055,
    roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2), faceMat);
    const ax = Math.floor(i / 2);
    const sign = i % 2 ? 1 : -1;
    if (ax === 0) { p.rotation.y = Math.PI / 2; p.position.x = sign * S; }
    else if (ax === 1) { p.rotation.x = Math.PI / 2; p.position.y = sign * S; }
    else p.position.z = sign * S;
    root.add(p);
  }

  // 笼内的"逃逸"粒子（被关住，反复撞壁）
  const esc = [];
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: pal.c, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.setScalar(0.075);
    const rnd = U.rnd(300 + i);
    s.userData = {
      v: new THREE.Vector3((rnd() - 0.5) * 1.4, (rnd() - 0.5) * 1.4, (rnd() - 0.5) * 1.4),
      p: new THREE.Vector3((rnd() - 0.5) * 2.4, (rnd() - 0.5) * 2.4, (rnd() - 0.5) * 2.4),
    };
    root.add(s);
    esc.push(s);
  }

  debris(root, pal, 70, 11, 311, 0.045);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      root.rotation.y = t * 0.10;
      root.rotation.x = Math.sin(t * 0.16) * 0.10;
      core.userData.mat.uniforms.uTime.value = t;
      core.userData.mat.uniforms.uBass.value = bs;
      core.userData.core.scale.setScalar(0.85 + bs * 0.18);
      core.userData.halo.material.opacity = 0.10 + bs * 0.12;

      // 粒子撞壁
      esc.forEach(s => {
        const d = s.userData;
        d.p.addScaledVector(d.v, 0.011);
        for (const ax of ['x', 'y', 'z']) {
          if (Math.abs(d.p[ax]) > S - 0.08) { d.p[ax] = Math.sign(d.p[ax]) * (S - 0.08); d.v[ax] *= -1; }
        }
        s.position.copy(d.p);
      });

      edgeMat.emissiveIntensity = 0.34 + bs * 0.40;
      lights.userData.rim1.intensity = 4.80 + e * 4.32;
    },
  };
}

// ============ 5. v2 —— 有机体（茄子/番茄/花猫） ============
export function sceneOrganic() {
  const pal = PALETTE.v2;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 2.2, rim: 5.3, amb: 0.22 });
  root.add(lights);
  backdrop(root, pal, 1500, 500);

  // 有机形体：椭球 + 顶点噪声抖动
  function blob(rx, ry, rz, color, emissive, seed, detail = 5) {
    const geo = new THREE.IcosahedronGeometry(1, detail);
    const pos = geo.attributes.position;
    const rnd = U.rnd(seed);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = 1 + (rnd() - 0.5) * 0.09 + Math.sin(v.x * 4.1 + v.y * 3.3 + v.z * 2.7) * 0.035;
      pos.setXYZ(i, v.x * rx * n, v.y * ry * n, v.z * rz * n);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: 0.22, roughness: 0.52, metalness: 0.14,
      flatShading: false,
    }));
  }

  // 茄子（长椭球 + 萼片 + 茎）
  const egg = new THREE.Group();
  const eggBody = blob(0.34, 0.62, 0.34, 0x6a3fa8, 0x9a55ff, 401);
  eggBody.rotation.z = 0.22;
  egg.add(eggBody);
  // 萼片
  const calyxMat = new THREE.MeshStandardMaterial({
    color: 0x2f7a44, emissive: 0x18d98a, emissiveIntensity: 0.20, roughness: 0.6, metalness: 0.1,
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.30, 5), calyxMat);
    leaf.position.set(Math.cos(a) * 0.16, 0.50, Math.sin(a) * 0.16);
    leaf.rotation.set(Math.cos(a) * 0.5, -a, Math.sin(a) * 0.5 + Math.PI);
    leaf.scale.set(1, 0.55, 1);
    egg.add(leaf);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.048, 0.20, 8), calyxMat);
  stem.position.y = 0.66;
  egg.add(stem);
  egg.position.set(-1.55, -0.12, 0.2);
  egg.rotation.z = 0.16;
  root.add(egg);

  // 番茄（扁球 + 蒂）
  const tomato = new THREE.Group();
  const tomBody = blob(0.46, 0.40, 0.46, 0xc4322a, 0xff6a3c, 402);
  tomato.add(tomBody);
  const tomLeaf = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.16, 6), calyxMat);
  tomLeaf.position.y = 0.40;
  tomLeaf.rotation.x = Math.PI;
  tomato.add(tomLeaf);
  tomato.position.set(0.05, -0.30, 0);
  root.add(tomato);

  // 花猫（球身 + 两耳 + 尾巴）
  const cat = new THREE.Group();
  const catBody = blob(0.38, 0.36, 0.34, 0xd8c8b0, 0xffd79a, 403);
  cat.add(catBody);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.22, 4), catBody.material);
    ear.position.set(sx * 0.18, 0.34, 0.02);
    ear.rotation.z = sx * 0.26;
    cat.add(ear);
  }
  // 眼睛
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x1a1030 })
    );
    eye.position.set(sx * 0.14, 0.06, 0.31);
    cat.add(eye);
  }
  // 尾巴
  const tailPts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    tailPts.push(new THREE.Vector3(0.34 + Math.sin(u * 2.6) * 0.26, -0.10 + u * 0.42, -0.16 + u * 0.10));
  }
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 30, 0.042, 6, false),
    catBody.material
  );
  cat.add(tail);
  cat.position.set(1.62, 0.10, -0.1);
  cat.rotation.y = -0.4;
  root.add(cat);

  // 环绕的营养粒子
  const nutri = [];
  const nColors = [0x8affb0, 0xffb060, 0xff8ac0];
  for (let i = 0; i < 54; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: nColors[i % 3], transparent: true, opacity: 0.72,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.setScalar(0.085);
    s.userData = { r: 2.0 + Math.random() * 1.2, a: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.4, y: (Math.random() - 0.5) * 2.0 };
    root.add(s);
    nutri.push(s);
  }

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      // 三个形体各自呼吸
      const br = 1 + bs * 0.075;
      egg.scale.setScalar(br * (1 + Math.sin(t * 1.4) * 0.018));
      tomato.scale.setScalar(br * (1 + Math.sin(t * 1.7 + 1.2) * 0.020));
      cat.scale.setScalar(br * (1 + Math.sin(t * 1.2 + 2.4) * 0.016));
      egg.rotation.y = Math.sin(t * 0.28) * 0.26;
      tomato.rotation.y = t * 0.20;
      cat.rotation.y = -0.4 + Math.sin(t * 0.34) * 0.30;
      // 尾巴摆动
      tail.rotation.z = Math.sin(t * 2.1) * 0.24;

      nutri.forEach(s => {
        const d = s.userData;
        d.a += d.sp * 0.008;
        s.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(t * 0.6 + d.a) * 0.24, Math.sin(d.a) * d.r);
        s.material.opacity = 0.42 + Math.sin(t * 1.6 + d.a * 2) * 0.28;
      });

      lights.userData.rim1.intensity = 5.28 + e * 4.32;
      lights.userData.amb.intensity = 0.22 + e * 0.10;
    },
  };
}

// ============ 6. pre2 —— 镜像/性别切换 ============
export function sceneMirror() {
  const pal = PALETTE.pre2;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.8, rim: 5.8, amb: 0.20 });
  root.add(lights);
  backdrop(root, pal, 1600, 600);

  // 中轴镜面（半透明）
  const mirror = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 3.4),
    new THREE.MeshPhysicalMaterial({
      color: 0xc8d8ff, transparent: true, opacity: 0.085,
      roughness: 0.02, metalness: 0.9, side: THREE.DoubleSide,
    })
  );
  mirror.position.z = -0.02;
  root.add(mirror);

  // 镜像双生球（左右对称）
  const pair = new THREE.Group();
  const mkOrb = (x, color, emis) => {
    const g = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(0.52, 4);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBass: { value: 0 },
        uA: { value: new THREE.Color(color) }, uB: { value: new THREE.Color(emis) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vP; varying vec3 vPos;
        void main(){
          vPos = position;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime, uBass;
        uniform vec3 uA, uB;
        varying vec3 vN; varying vec3 vP; varying vec3 vPos;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        float noise(vec3 p){
          vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(-vP);
          float fres = pow(1.0 - max(dot(N,V),0.0), 2.4);
          // 横向条纹（扫描感）
          float scan = smoothstep(0.4, 0.6, abs(sin(vPos.y * 26.0 + uTime * 1.4)));
          float n = noise(vPos * 5.0 + vec3(0.0, uTime * 0.5, 0.0));
          vec3 col = uA * (0.14 + n * 0.22);
          col += uB * fres * (0.85 + uBass * 0.5);
          col += uB * scan * 0.10;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.x = x;
    g.add(m);
    g.userData = { mesh: m, mat };
    return g;
  };
  const left = mkOrb(-0.72, 0x3a8aff, 0x8ac8ff);
  const right = mkOrb(0.72, 0xff3fa8, 0xffa8dc);
  pair.add(left, right);
  root.add(pair);

  // 中轴线
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -2.6, 0), new THREE.Vector3(0, 2.6, 0),
  ]);
  root.add(new THREE.Line(axisGeo, LINE(pal.c, 0.30)));

  // 折叠镜像的漂浮刻度（沿 x 轴镜像）
  const marks = new THREE.Group();
  const rnd = U.rnd(505);
  for (let i = 0; i < 60; i++) {
    const x = 0.20 + rnd() * 2.6;
    const y = (rnd() - 0.5) * 3.2;
    const len = 0.05 + rnd() * 0.16;
    for (const s of [-1, 1]) {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(s * x, y, 0), new THREE.Vector3(s * (x + len), y, 0),
      ]);
      marks.add(new THREE.Line(g, LINE(pal.b, 0.20)));
    }
  }
  root.add(marks);

  // 环绕轨道
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.008, 4, 128),
    new THREE.MeshBasicMaterial({ color: pal.b, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  orbit.rotation.x = Math.PI / 2.2;
  root.add(orbit);

  debris(root, pal, 60, 10, 507, 0.04);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      // 段内：前半"切换性别"，后半"切换角色"——交替主导
      const s = secT / 14.77;
      const swap = Math.sin(t * 1.05);
      left.userData.mat.uniforms.uTime.value = t;
      right.userData.mat.uniforms.uTime.value = t + 3.1;
      left.userData.mat.uniforms.uBass.value = bs;
      right.userData.mat.uniforms.uBass.value = bs;
      left.userData.mesh.rotation.y = t * 0.4;
      right.userData.mesh.rotation.y = -t * 0.4;
      // 左右交替放大（谁是"主导人格"）
      const k = 0.5 + 0.5 * swap;
      left.userData.mesh.scale.setScalar(0.82 + k * 0.34 + bs * 0.10);
      right.userData.mesh.scale.setScalar(0.82 + (1 - k) * 0.34 + bs * 0.10);
      pair.rotation.y = Math.sin(t * 0.22) * 0.16;
      orbit.rotation.z = t * 0.16;
      marks.children.forEach((m, i) => {
        m.material.opacity = 0.10 + Math.abs(Math.sin(t * 0.9 + i * 0.2)) * 0.20;
      });
      lights.userData.rim1.intensity = 5.76 + e * 4.32;
    },
  };
}

// ============ 7. c2 —— 振动/孤独 ============
export function sceneVibration() {
  const pal = PALETTE.c2;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.3, rim: 5.3, amb: 0.16 });
  root.add(lights);
  backdrop(root, pal, 2000, 800);

  // 中心孤点
  const core = makeCore(pal, 0.22);
  root.add(core);

  // 同心球壳（线框，逐层）
  const shells = [];
  for (let i = 0; i < 7; i++) {
    const r = 0.55 + i * 0.34;
    const geo = new THREE.SphereGeometry(r, 24, 16);
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({
        color: i % 2 ? pal.a : pal.b, transparent: true, opacity: 0.16 - i * 0.012,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    root.add(wire);
    shells.push({ m: wire, r, i });
  }

  // 径向连接线（随"你走了"逐渐断裂）
  const spokes = [];
  const NS = 36;
  for (let i = 0; i < NS; i++) {
    const th = (i / NS) * Math.PI * 2;
    const phi = Math.acos(1 - 2 * ((i * 0.618) % 1));
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)
    );
    const g = new THREE.BufferGeometry().setFromPoints([
      dir.clone().multiplyScalar(0.28), dir.clone().multiplyScalar(2.6),
    ]);
    const l = new THREE.Line(g, LINE(pal.b, 0.22));
    root.add(l);
    spokes.push({ m: l, dir, i, brk: 0.35 + (i % 7) * 0.09 });
  }

  // 断裂的碎片（漂离中心）
  const frag = new THREE.Group();
  const rnd = U.rnd(611);
  const fragMat = new THREE.MeshStandardMaterial({
    color: pal.b, emissive: pal.a, emissiveIntensity: 0.32, roughness: 0.4, metalness: 0.6,
  });
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.032 + rnd() * 0.045), fragMat);
    const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const r = 1.0 + rnd() * 3.2;
    m.position.copy(d).multiplyScalar(r);
    m.userData = { d, r0: r, sp: 0.06 + rnd() * 0.14, ph: rnd() * 9 };
    frag.add(m);
  }
  root.add(frag);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      const s = secT / 14.77;
      core.userData.mat.uniforms.uTime.value = t;
      core.userData.mat.uniforms.uBass.value = bs;
      core.userData.core.scale.setScalar(0.8 + bs * 0.3);
      core.userData.halo.material.opacity = 0.10 + bs * 0.14;

      // 球壳呼吸（振动）
      shells.forEach((sh, i) => {
        const ph = t * 2.0 - i * 0.5;
        const k = 1 + Math.sin(ph) * (0.022 + i * 0.004) + bs * 0.02;
        sh.m.scale.setScalar(k);
        sh.m.rotation.y = t * 0.05 * (i % 2 ? 1 : -1);
        sh.m.material.opacity = (0.16 - i * 0.012) * (1 - s * 0.35);
      });

      // 连接线断裂
      spokes.forEach(sp => {
        const brk = sp.brk * (0.6 + s * 0.8);
        const alive = (Math.sin(t * 0.8 + sp.i) * 0.5 + 0.5) > brk ? 1 : 0.12;
        sp.m.material.opacity = 0.22 * alive;
        sp.m.visible = alive > 0.2;
      });

      // 碎片漂离
      frag.children.forEach(f => {
        const d = f.userData;
        const r = d.r0 + s * 1.4 * d.sp * 8;
        f.position.copy(d.d).multiplyScalar(r);
        f.position.y += Math.sin(t * 0.7 + d.ph) * 0.10;
        f.rotation.x += 0.008; f.rotation.y += 0.011;
        f.material.opacity = 1;
      });

      lights.userData.rim1.intensity = 5.28 + e * 3.36;
    },
  };
}

// ============ 8. c2x —— 碎片消除 ============
export function sceneFragments() {
  const pal = PALETTE.c2x;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.6, rim: 4.8, amb: 0.18 });
  root.add(lights);
  backdrop(root, pal, 1500, 600);

  // 大量方块构成的"意义碎片"云
  const N = 420;
  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: pal.a, emissive: pal.b, emissiveIntensity: 0.42, roughness: 0.36, metalness: 0.62,
    }),
    N
  );
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const rnd = U.rnd(701);
  const data = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const eul = new THREE.Euler();
  for (let i = 0; i < N; i++) {
    const dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
    const r = 0.5 + rnd() * 2.6;
    pv.copy(dir).normalize().multiplyScalar(r);
    const size = 0.05 + rnd() * 0.13;
    const rot = new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6);
    data.push({ p: pv.clone(), size, seed: rnd(), rot, sp: 0.2 + rnd() * 0.6 });
    q.setFromEuler(eul.set(rot.x, rot.y, rot.z));
    sc.setScalar(size);
    m4.compose(pv, q, sc);
    inst.setMatrixAt(i, m4);
  }
  inst.instanceMatrix.needsUpdate = true;
  root.add(inst);

  // 核心
  const core = makeCore(pal, 0.30);
  root.add(core);

  // 消除波（从中心扩散的球壳）
  const wave = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({
      color: pal.c, transparent: true, opacity: 0.0,
      wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  root.add(wave);

  const m4b = new THREE.Matrix4();
  const qb = new THREE.Quaternion();
  const scb = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const eulb = new THREE.Euler();

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      const s = U.clamp(secT / 7.385, 0, 1);
      core.userData.mat.uniforms.uTime.value = t;
      core.userData.mat.uniforms.uBass.value = bs;
      core.userData.core.scale.setScalar(0.9 + bs * 0.2);

      // 阈值随进度上升：方块逐个消失
      const thresh = 0.30 + s * 0.62;
      for (let i = 0; i < N; i++) {
        const d = data[i];
        const gone = d.seed < thresh;
        const k = gone ? 0.0001 : 1;
        // 未消失的缓慢旋转漂移
        const ang = t * d.sp * 0.16;
        pb.copy(d.p);
        pb.x += Math.sin(t * d.sp + d.seed * 9) * 0.10;
        pb.y += Math.cos(t * d.sp * 1.3 + d.seed * 7) * 0.10;
        qb.setFromEuler(eulb.set(d.rot.x + ang, d.rot.y + ang * 0.7, d.rot.z));
        scb.setScalar(d.size * k * (1 + bs * 0.15));
        m4b.compose(pb, qb, scb);
        inst.setMatrixAt(i, m4b);
      }
      inst.instanceMatrix.needsUpdate = true;

      // 消除波
      const wp = (t * 0.42) % 1;
      wave.scale.setScalar(0.4 + wp * 3.4);
      wave.material.opacity = (1 - wp) * 0.20;

      lights.userData.rim1.intensity = 4.80 + e * 3.84;
    },
  };
}

// ============ 9. bridge —— 非法参数/报错墙 ============
export function sceneError() {
  const pal = PALETTE.bridge;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.1, rim: 6.2, amb: 0.14 });
  root.add(lights);
  backdrop(root, pal, 1400, 500);

  // 破碎墙：用大量方块拼出一面墙，部分缺失
  // 坑：初版每块都 0.276×0.258 完全等大、无旋转、emissiveIntensity 0.30，
  // 渲染出来是一面「俄罗斯方块 / 红砖贴图」——太整齐也太亮，没有「报错」的崩坏感。
  // 现在：砖色压暗到近黑，靠 emissive 只透出缝隙的光；每块给随机缩放与 Z 轴旋转，
  // 让边缘互相错开；破损率提到 0.30，并让部分砖块只剩一小角（碎掉的感觉）。
  const COLS = 22, ROWS = 13;
  const CW = 0.30, CH = 0.28;
  const wall = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CW * 0.92, CH * 0.92, 0.10),
    new THREE.MeshStandardMaterial({
      color: 0x120406, emissive: pal.a, emissiveIntensity: 0.10, roughness: 0.72, metalness: 0.35,
    }),
    COLS * ROWS
  );
  const rnd = U.rnd(801);
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const sv = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const eul = new THREE.Euler();
  const wallData = [];
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - (COLS - 1) / 2) * CW;
      const y = (r - (ROWS - 1) / 2) * CH;
      const h = rnd();
      // 0.30 整块消失，0.12 只剩一小角（碎裂残留），其余保持
      const hole = h < 0.30;
      const chip = !hole && h < 0.42;
      const k = hole ? 0.0001 : (chip ? 0.34 : 1);
      const sx = (chip ? 0.55 : 1) * (0.88 + rnd() * 0.24);
      const sy = (chip ? 0.55 : 1) * (0.88 + rnd() * 0.24);
      const rz = (rnd() - 0.5) * (chip ? 0.5 : 0.10);
      pv.set(x + (rnd() - 0.5) * 0.03, y + (rnd() - 0.5) * 0.03, -2.6 + (rnd() - 0.5) * 0.10);
      q0.setFromEuler(eul.set(0, 0, rz));
      sv.set(sx, sy, 1);
      m4.compose(pv, q0, sv);
      wall.setMatrixAt(idx, m4);
      wallData.push({ x, y, k, h, sx, sy, rz, drift: hole ? (rnd() - 0.5) * 2 : 0, dsp: 0.1 + rnd() });
      idx++;
    }
  }
  wall.instanceMatrix.needsUpdate = true;
  q0.identity();
  root.add(wall);

  // 漂浮的错误标记（红色 X / 感叹号块）
  const errs = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const bar1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.035, 0.035),
      new THREE.MeshBasicMaterial({ color: pal.c, transparent: true, opacity: 0.9 })
    );
    bar1.rotation.z = Math.PI / 4;
    const bar2 = bar1.clone();
    bar2.rotation.z = -Math.PI / 4;
    g.add(bar1, bar2);
    const rr = U.rnd(820 + i);
    g.position.set((rr() - 0.5) * 6, (rr() - 0.5) * 3.4, -2.2 + rr() * 2.4);
    g.userData = { sp: 0.3 + rr() * 0.8, ph: rr() * 9, base: g.position.clone() };
    errs.add(g);
  }
  root.add(errs);

  // 地面网格（碎裂感）
  const floor = makeGridFloor(40, 40, pal.a);
  floor.position.y = -2.0;
  floor.position.z = -1.4;
  floor.material.opacity = 0.14;
  root.add(floor);

  debris(root, pal, 100, 12, 803, 0.04);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      // 墙面抖动（glitch）
      const gl = Math.max(0, Math.sin(t * 7.3)) * (bs > 0.4 ? 1 : 0.3);
      const i4 = new THREE.Matrix4();
      const qq = new THREE.Quaternion();
      const qe = new THREE.Euler();
      const ss = new THREE.Vector3();
      const pp = new THREE.Vector3();
      for (let i = 0; i < wallData.length; i++) {
        const d = wallData[i];
        pp.set(d.x + (d.h < 0.30 ? d.drift * Math.sin(t * 0.6) : 0), d.y, -2.6);
        ss.set(d.sx, d.sy, 1);
        qq.setFromEuler(qe.set(0, 0, d.rz));
        i4.compose(pp, qq, ss);
        wall.setMatrixAt(i, i4);
      }
      wall.instanceMatrix.needsUpdate = true;
      wall.material.emissiveIntensity = 0.10 + gl * 0.16 + bs * 0.08;

      errs.children.forEach(g => {
        const d = g.userData;
        g.position.copy(d.base);
        g.position.y += Math.sin(t * d.sp + d.ph) * 0.16;
        g.rotation.z = Math.sin(t * 1.4 + d.ph) * 0.30;
        g.children.forEach(c => { c.material.opacity = 0.55 + gl * 0.35; });
      });

      lights.userData.rim1.intensity = 6.24 + e * 5.28 + gl * 7.20;
    },
  };
}

// ============ 10. chant/c3 —— 刀刃竖井 ============
export function sceneBlade() {
  const pal = PALETTE.chant;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.0, rim: 7.2, amb: 0.12 });
  root.add(lights);
  backdrop(root, pal, 1400, 500);

  // 竖井（8 条竖棱 + 顶底环）
  // 坑：棱线原来 0.06 见方，而相机常被摆到 r≈2.0（井壁 r=1.30），
  // 近处那条棱线在屏幕上足有 100+ px 宽，10 条一起把画面切成红白条。
  // 收到 0.026 并把自发光压到 0.10，让它只是「暗处的一道棱」。
  const SHAFT_R = 1.30, SHAFT_H = 7.0;
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2a0810, emissive: pal.a, emissiveIntensity: 0.10, roughness: 0.62, metalness: 0.55,
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.026, SHAFT_H, 0.026), wallMat);
    rib.position.set(Math.cos(a) * SHAFT_R, 0, Math.sin(a) * SHAFT_R);
    root.add(rib);
  }
  for (const y of [-SHAFT_H / 2, SHAFT_H / 2]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(SHAFT_R, 0.018, 6, 64),
      wallMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    root.add(ring);
  }

  // 井壁竖向刻槽（发光）
  const grooves = new THREE.Group();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a) * (SHAFT_R - 0.02), -SHAFT_H / 2, Math.sin(a) * (SHAFT_R - 0.02)),
      new THREE.Vector3(Math.cos(a) * (SHAFT_R - 0.02), SHAFT_H / 2, Math.sin(a) * (SHAFT_R - 0.02)),
    ]);
    grooves.add(new THREE.Line(g, LINE(pal.b, 0.16)));
  }
  root.add(grooves);

  // 下落的刀片
  // 坑：刀片原来 1.24 m 宽，而相机离井壁只有 1.8 m，透视放大后每片都变成
  // 横贯全屏的红带，26 片叠起来完全糊住画面。改成 ~0.42 m 的小刃，让它们
  // 成为「远处下落的剪影」而不是「贴脸的红布」。
  const blades = [];
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x8a1420, emissive: pal.b, emissiveIntensity: 0.26,
    roughness: 0.22, metalness: 0.92, side: THREE.DoubleSide,
  });
  const rnd = U.rnd(901);
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    // 刀片：细长小三角
    const shape = new THREE.Shape();
    shape.moveTo(-0.21, 0);
    shape.lineTo(0.21, 0);
    shape.lineTo(0.16, -0.030);
    shape.lineTo(-0.16, -0.030);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false });
    const m = new THREE.Mesh(geo, bladeMat);
    m.rotation.z = (rnd() - 0.5) * 0.5;
    g.add(m);
    // 刀锋光：必须很小——26 片叠加会让中心糊成一团白
    const glow = makeGlowSprite(pal.c, 0.12, 0.13);
    glow.position.y = -0.02;
    g.add(glow);
    g.userData = {
      ph: rnd(), sp: 0.42 + rnd() * 0.55,
      // 半径分散到井壁附近，避免全部堆在镜头正前方
      a: rnd() * Math.PI * 2, r: 0.62 + rnd() * 0.55,
      spin: (rnd() - 0.5) * 1.6,
    };
    root.add(g);
    blades.push(g);
  }

  // 中央光柱（死刑宣判）
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, SHAFT_H, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: pal.c, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  root.add(pillar);

  debris(root, pal, 80, 8, 903, 0.035);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      // 刀片下落
      blades.forEach((g, i) => {
        const d = g.userData;
        const u = (d.ph + t * d.sp * 0.30) % 1;
        const y = U.lerp(SHAFT_H / 2, -SHAFT_H / 2, u);
        const ang = d.a + t * 0.18;
        g.position.set(Math.cos(ang) * d.r, y, Math.sin(ang) * d.r);
        g.rotation.y = -ang;
        g.rotation.z = d.spin * Math.sin(t * 0.8 + i);
        // 刀锋光只随强拍微亮，避免叠加过曝
        g.children.forEach(c => {
          if (c.isSprite && c.material) c.material.opacity = 0.10 + bs * 0.12;
        });
      });
      pillar.material.opacity = 0.035 + bs * 0.06;
      pillar.scale.x = pillar.scale.z = 1 + bs * 0.4;
      grooves.children.forEach((g, i) => {
        g.material.opacity = 0.08 + Math.abs(Math.sin(t * 1.6 + i * 0.4)) * 0.14;
      });
      wallMat.emissiveIntensity = 0.08 + bs * 0.10;
      lights.userData.rim1.intensity = 1.73 + e * 1.44;
    },
  };
}

// ============ 11. love —— 心形与代数 ============
export function sceneHeart() {
  const pal = PALETTE.love;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.9, rim: 5.3, amb: 0.22 });
  root.add(lights);
  backdrop(root, pal, 1700, 700);

  // 心形曲线（参数方程）
  const heartPts = [];
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const t2 = (i / N) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t2), 3) / 16;
    const y = (13 * Math.cos(t2) - 5 * Math.cos(2 * t2) - 2 * Math.cos(3 * t2) - Math.cos(4 * t2)) / 16;
    heartPts.push(new THREE.Vector3(x, y, 0));
  }
  const heartCurve = new THREE.CatmullRomCurve3(heartPts, true);
  const heartGeo = new THREE.TubeGeometry(heartCurve, 220, 0.038, 10, true);
  const heartMat = new THREE.MeshStandardMaterial({
    color: pal.a, emissive: pal.b, emissiveIntensity: 0.62, roughness: 0.22, metalness: 0.72,
  });
  const heart = new THREE.Mesh(heartGeo, heartMat);
  heart.position.y = 0.10;
  root.add(heart);

  // 心形内部的公式面板（全息线）
  const panel = new THREE.Group();
  const rnd = U.rnd(1001);
  for (let i = 0; i < 34; i++) {
    const y = -0.70 + i * 0.048;
    const w = 0.20 + rnd() * 0.95;
    const x0 = (rnd() - 0.5) * 0.5;
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0 - w / 2, y, -0.02), new THREE.Vector3(x0 + w / 2, y, -0.02),
    ]);
    panel.add(new THREE.Line(g, LINE(pal.b, 0.16)));
  }
  panel.position.y = 0.10;
  root.add(panel);

  // 环绕的"问题"小球（提问我吧）
  const qs = [];
  for (let i = 0; i < 36; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.017, 8, 8),
      new THREE.MeshBasicMaterial({ color: pal.b, transparent: true, opacity: 0.55 })
    );
    // 半径推到 2.2~2.9：太近的球会被 Bloom 放大成一团白光斑
    const r = 2.20 + Math.random() * 0.70;
    s.userData = { r, a: Math.random() * 6.28, sp: 0.12 + Math.random() * 0.3, y: (Math.random() - 0.5) * 1.9 };
    root.add(s);
    qs.push(s);
  }

  // 心形外圈的轨道环
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, 0.010, 4, 128),
    new THREE.MeshBasicMaterial({ color: pal.b, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = 0.9;
  root.add(ring);
  const ring2 = ring.clone();
  ring2.rotation.set(1.9, 0.6, 0);
  root.add(ring2);

  const core = makeCore(pal, 0.18);
  core.position.y = 0.10;
  root.add(core);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      const beat = 1 + bs * 0.10;
      heart.scale.setScalar(beat * (1 + Math.sin(t * 2.4) * 0.022));
      heart.rotation.y = Math.sin(t * 0.30) * 0.22;
      heart.rotation.z = Math.sin(t * 0.20) * 0.06;
      heartMat.emissiveIntensity = 0.45 + bs * 0.45;
      panel.rotation.y = heart.rotation.y;
      panel.children.forEach((l, i) => {
        l.material.opacity = 0.08 + Math.abs(Math.sin(t * 1.1 + i * 0.3)) * 0.14;
      });
      qs.forEach(s => {
        const d = s.userData;
        d.a += d.sp * 0.008;
        s.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(t * 0.7 + d.a) * 0.18, Math.sin(d.a) * d.r);
      });
      ring.rotation.z = t * 0.20;
      ring2.rotation.z = -t * 0.16;
      core.userData.mat.uniforms.uTime.value = t;
      core.userData.mat.uniforms.uBass.value = bs;
      core.userData.core.scale.setScalar(0.85 + bs * 0.4);
      core.userData.halo.material.opacity = 0.10 + bs * 0.14;
      lights.userData.rim1.intensity = 5.28 + e * 4.32;
    },
  };
}

// ============ 12. outro/end —— 虚空 ============
export function sceneVoid() {
  const pal = PALETTE.outro;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 0.5, rim: 1.9, amb: 0.10 });
  root.add(lights);
  root.add(makeStars(3000, 110, 0.38));
  root.add(makeMotes(300, 22, pal.b));

  // 正在消散的球壳（稀疏点阵）
  const N = 900;
  const pos = new Float32Array(N * 3);
  const rnd = U.rnd(1101);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 2.1;
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const shellMat = new THREE.PointsMaterial({
    size: 0.075, map: glowTexture(), color: pal.b, transparent: true,
    opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const shell = new THREE.Points(geo, shellMat);
  root.add(shell);

  // 内层第二球壳（更密、更暗，制造体积感）
  const N2 = 1400;
  const pos2 = new Float32Array(N2 * 3);
  for (let i = 0; i < N2; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 1.55;
    pos2[i * 3] = Math.cos(th) * s * r;
    pos2[i * 3 + 1] = u * r;
    pos2[i * 3 + 2] = Math.sin(th) * s * r;
  }
  const geo2 = new THREE.BufferGeometry();
  geo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  const shell2 = new THREE.Points(geo2, new THREE.PointsMaterial({
    size: 0.050, map: glowTexture(), color: pal.a, transparent: true,
    opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  root.add(shell2);

  // 背景星云光晕（大片柔光，避免画面死黑）
  const neb = makeGlowSprite(pal.a, 14, 0.16);
  neb.position.set(0, 0, -6);
  root.add(neb);
  const neb2 = makeGlowSprite(pal.b, 8, 0.12);
  neb2.position.set(3.5, -2.0, -4);
  root.add(neb2);

  // 中心残核
  const core = makeCore(pal, 0.30);
  root.add(core);

  // 极稀疏的漂浮残片
  const rnd2 = U.rnd(1103);
  const bits = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.026 + rnd2() * 0.03),
      new THREE.MeshBasicMaterial({ color: pal.b, transparent: true, opacity: 0.5 })
    );
    m.position.set((rnd2() - 0.5) * 9, (rnd2() - 0.5) * 6, (rnd2() - 0.5) * 9);
    m.userData = { sp: 0.1 + rnd2() * 0.3, ph: rnd2() * 9 };
    bits.add(m);
  }
  root.add(bits);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      shell.rotation.y = t * 0.035;
      shell.rotation.x = Math.sin(t * 0.1) * 0.12;
      shell2.rotation.y = -t * 0.052;
      shell2.rotation.z = Math.sin(t * 0.13) * 0.16;
      // 消散：透明度随段内进度下降
      const s = U.clamp(secT / 14.77, 0, 1);
      shellMat.opacity = 0.95 * (1 - s * 0.50);
      shell2.material.opacity = 0.55 * (1 - s * 0.42);
      core.userData.mat.uniforms.uTime.value = t;
      core.userData.mat.uniforms.uBass.value = bs;
      core.userData.core.scale.setScalar(0.85 + bs * 0.30);
      core.userData.halo.material.opacity = 0.14 + bs * 0.14;
      bits.children.forEach(b => {
        b.position.y += Math.sin(t * b.userData.sp + b.userData.ph) * 0.0014;
        b.rotation.x += 0.004; b.rotation.y += 0.005;
      });
      lights.userData.rim1.intensity = 1.92 + e * 1.92;
    },
  };
}
