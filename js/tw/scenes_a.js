// scenes_a.js — 场景 0-3：电路核心 / 代码墙 / 几何 / 振荡
import * as THREE from 'three';
import { PALETTE, MAT, U } from './core.js';
import { makeStars, makeGridFloor, makeMotes, makeGlowSprite, makeLights, makeCore, glyphAtlas, glowTexture } from './kit.js';

// ============ 0. intro —— 通电的电路核心 ============
export function sceneIntro() {
  const pal = PALETTE.intro;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.5, rim: 4.3, amb: 0.16 });
  root.add(lights);

  const stars = makeStars(2600, 85, 0.42);
  root.add(stars);
  root.add(makeMotes(900, 18, pal.b));

  // 核心
  const core = makeCore(pal, 0.52);
  root.add(core);

  // 内核线框球（两层，制造机械感）
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.88, 2),
    new THREE.MeshBasicMaterial({ color: pal.b, wireframe: true, transparent: true, opacity: 0.20 })
  );
  root.add(wire);
  const wire2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.18, 1),
    new THREE.MeshBasicMaterial({ color: pal.c, wireframe: true, transparent: true, opacity: 0.10 })
  );
  root.add(wire2);

  // 电路环（三层同心圆环，带刻度）
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = 1.55 + i * 0.58;
    const pts = [];
    const seg = 160;
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: i === 1 ? pal.c : pal.b, transparent: true, opacity: 0.38 - i * 0.08 })
    );
    line.rotation.x = (i - 1) * 0.40;
    line.rotation.z = i * 0.3;
    root.add(line);
    rings.push(line);

    // 刻度
    const tickN = 36 + i * 18;
    const tickGeo = new THREE.BufferGeometry();
    const tp = [];
    for (let k = 0; k < tickN; k++) {
      const a = (k / tickN) * Math.PI * 2;
      const long = k % 4 === 0;
      const r0 = r - (long ? 0.13 : 0.055);
      tp.push(Math.cos(a) * r0, 0, Math.sin(a) * r0);
      tp.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    const ticks = new THREE.LineSegments(tickGeo, new THREE.LineBasicMaterial({
      color: pal.b, transparent: true, opacity: 0.26,
    }));
    ticks.rotation.copy(line.rotation);
    root.add(ticks);
    rings.push(ticks);

    // 环上的节点球
    const nodeN = 6 + i * 3;
    for (let k = 0; k < nodeN; k++) {
      const a = (k / nodeN) * Math.PI * 2;
      const n = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 8),
        new THREE.MeshBasicMaterial({ color: pal.c, transparent: true, opacity: 0.8 })
      );
      n.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const holder = new THREE.Group();
      holder.rotation.copy(line.rotation);
      holder.add(n);
      root.add(holder);
      rings.push(holder);
    }
  }

  // 电路走线（随机 L 形路径，脉冲沿其移动）
  const traces = new THREE.Group();
  const rnd = U.rnd(11);
  const pulses = [];
  for (let i = 0; i < 44; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = 2.0 + rnd() * 1.4;
    const r1 = r0 + 0.5 + rnd() * 1.5;
    const y = (rnd() - 0.5) * 2.6;
    const bend = 0.3 + rnd() * 0.5;
    const pts = [
      new THREE.Vector3(Math.cos(a) * r0, y, Math.sin(a) * r0),
      new THREE.Vector3(Math.cos(a) * (r0 + bend), y, Math.sin(a) * (r0 + bend)),
      new THREE.Vector3(Math.cos(a) * (r0 + bend), y, Math.sin(a) * r1),
      new THREE.Vector3(Math.cos(a) * r1, y, Math.sin(a) * r1),
    ];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({
      color: pal.a, transparent: true, opacity: 0.22,
    }));
    traces.add(l);
    // 脉冲点
    const p = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: pal.c, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    p.scale.setScalar(0.13);
    p.userData = { a, r0, r1, y, phase: rnd(), speed: 0.30 + rnd() * 0.55, bend };
    traces.add(p);
    pulses.push(p);
  }
  root.add(traces);

  // 垂直光柱（通电感）
  const beamGeo = new THREE.CylinderGeometry(0.008, 0.008, 8, 5, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: pal.b, transparent: true, opacity: 0.11,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beams = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    const a = (i / 9) * Math.PI * 2;
    const rr = 2.2 + (i % 3) * 0.5;
    b.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    beams.add(b);
  }
  root.add(beams);

  // 地面网格（低强度，制造空间感）
  const floor = makeGridFloor(50, 50, pal.a);
  floor.position.y = -2.4;
  floor.material.opacity = 0.10;
  root.add(floor);

  // 悬浮数据碎片
  const chips = new THREE.Group();
  const chipGeo = new THREE.BoxGeometry(0.055, 0.055, 0.012);
  const chipMat = new THREE.MeshStandardMaterial({
    color: pal.b, emissive: pal.a, emissiveIntensity: 0.42, roughness: 0.4, metalness: 0.5,
  });
  const rnd2 = U.rnd(97);
  for (let i = 0; i < 110; i++) {
    const m = new THREE.Mesh(chipGeo, chipMat);
    m.position.set((rnd2() - 0.5) * 9, (rnd2() - 0.5) * 6, (rnd2() - 0.5) * 9);
    m.rotation.set(rnd2() * 6, rnd2() * 6, rnd2() * 6);
    m.userData = { sp: 0.3 + rnd2(), ph: rnd2() * 9 };
    chips.add(m);
  }
  root.add(chips);

  return {
    root, pal,
    update(t, secT, a) {
      const e = a.energy || 0, bs = a.bass || 0;
      core.userData.core.rotation.y = t * 0.5;
      core.userData.core.rotation.x = t * 0.31;
      core.userData.mat.uniforms.uTime.value = t;
      core.userData.mat.uniforms.uBass.value = bs;
      core.userData.mat.uniforms.uPower.value = 0.85 + e * 0.5;
      const s = 1 + bs * 0.10;
      core.userData.core.scale.setScalar(s);
      core.userData.halo.scale.setScalar(2.4 * (1 + bs * 0.3));
      core.userData.halo.material.opacity = 0.08 + bs * 0.10;
      wire.rotation.y = -t * 0.22;
      wire.rotation.z = t * 0.14;
      wire2.rotation.y = t * 0.16;
      wire2.rotation.x = -t * 0.10;
      rings.forEach((r, i) => {
        const sp = (i % 2 ? 1 : -1) * (0.06 + i * 0.035);
        r.rotation.y += sp * 0.014;
      });
      pulses.forEach(p => {
        const u = (p.userData.phase + t * p.userData.speed) % 1;
        const r = U.lerp(p.userData.r0, p.userData.r1, u);
        const a2 = p.userData.a;
        const bend = p.userData.bend;
        // 沿 L 形路径
        const seg1 = bend / (bend + 1.0);
        let px, pz;
        if (u < seg1) {
          const k = u / seg1;
          px = Math.cos(a2) * (p.userData.r0 + bend * k);
          pz = Math.sin(a2) * (p.userData.r0 + bend * k);
        } else {
          const k = (u - seg1) / (1 - seg1);
          const rr = p.userData.r0 + bend;
          px = Math.cos(a2) * rr;
          pz = Math.sin(a2) * U.lerp(rr, p.userData.r1, k);
        }
        p.position.set(px, p.userData.y, pz);
        p.material.opacity = 0.85 * Math.sin(u * Math.PI);
      });
      chips.children.forEach(c => {
        c.position.y += Math.sin(t * c.userData.sp + c.userData.ph) * 0.0012;
        c.rotation.x += 0.003; c.rotation.y += 0.005;
      });
      lights.userData.rim1.intensity = 4.3 + bs * 5.3;
      lights.userData.amb.intensity = 0.16 + e * 0.14;
      stars.rotation.y = t * 0.006;
      floor.material.opacity = 0.08 + bs * 0.06;
    },
  };
}

// ============ 1. inst1/inst2 —— 代码墙 ============
export function sceneCode() {
  const pal = PALETTE.inst1;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.2, rim: 4.8, amb: 0.18 });
  root.add(lights);
  root.add(makeStars(1200, 70, 0.45));

  // 用 InstancedMesh 做字符流（性能关键）
  const COLS = 26, ROWS = 30;
  const CELL_X = 0.30, CELL_Y = 0.34;
  const total = COLS * ROWS;
  const atlas = glyphAtlas();
  const W = 3.4, H = 1.9;

  // 每列一个平面片，用 shader 滚动（比逐字符便宜得多）
  const planes = [];
  const rnd = U.rnd(23);
  for (let c = 0; c < COLS; c++) {
    const x = (c / (COLS - 1) - 0.5) * W * 2;
    const w = (W * 2 / COLS) * 0.92;
    const geo = new THREE.PlaneGeometry(w, H * 2, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlas },
        uTime: { value: 0 },
        uSpeed: { value: 0.6 + rnd() * 1.6 },
        uPhase: { value: rnd() * 10 },
        uCol: { value: new THREE.Color(pal.a) },
        uHi: { value: new THREE.Color(pal.b) },
        uHead: { value: 0.0 },
        uRows: { value: ROWS },
        uCols: { value: 4.0 },
        uDensity: { value: 0.55 + rnd() * 0.35 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uAtlas;
        uniform float uTime, uSpeed, uPhase, uHead, uRows, uCols, uDensity;
        uniform vec3 uCol, uHi;
        varying vec2 vUv;

        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

        void main(){
          // 行/列网格
          vec2 g = vUv * vec2(uCols, uRows);
          float colId = floor(g.x);
          float rowId = floor(g.y);
          vec2 f = fract(g);

          // 每行随时间下移
          float shift = uTime * uSpeed + uPhase;
          float rowScrolled = mod(rowId + shift, uRows);
          float cell = floor(rowScrolled);

          // 每格随机取字形
          float h = h21(vec2(colId, cell));
          float h2 = h21(vec2(colId * 1.7 + 3.1, cell * 2.3 + 7.7));

          // 存活判定
          float alive = step(1.0 - uDensity, h2);

          // 字形图集采样（8x8）
          float gi = floor(h * 63.999);
          vec2 gc = vec2(mod(gi, 8.0), floor(gi / 8.0));
          vec2 guv = (gc + f) / 8.0;
          float glyph = texture2D(uAtlas, guv).r;

          // 头部高亮（滚动头）
          float headPos = fract(-shift / uRows);
          float dist = fract(rowScrolled / uRows - headPos + 1.0);
          float head = smoothstep(0.12, 0.0, dist) * step(0.5, alive);

          // 亮度：越靠近头越亮
          float bright = 0.18 + 0.55 * smoothstep(0.0, 0.5, dist) * (1.0 - dist * 0.6);
          vec3 col = mix(uCol, uHi, head);
          col *= glyph * alive * bright;
          col += uHi * head * glyph * 1.6;

          // 列边缘渐隐
          float edge = smoothstep(0.0, 0.10, vUv.y) * smoothstep(1.0, 0.90, vUv.y);
          float side = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
          col *= edge * side;

          if (col.r + col.g + col.b < 0.004) discard;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, -3.0);
    root.add(m);
    planes.push(m);
  }

  // 背景衬板（让字符有承托，避免纯黑）
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2.2, H * 2.2),
    new THREE.MeshBasicMaterial({ color: 0x030c0a, transparent: true, opacity: 0.9 })
  );
  back.position.set(0, 0, -3.35);
  root.add(back);

  // 地面网格
  const floor = makeGridFloor(40, 40, pal.a);
  floor.position.y = -2.2;
  floor.position.z = -2.0;
  root.add(floor);

  // 漂浮数据方块
  const cubes = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(0.10, 0.10, 0.10);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: pal.b, emissive: pal.a, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.6,
  });
  const rnd2 = U.rnd(41);
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(cubeGeo, cubeMat);
    m.position.set((rnd2() - 0.5) * 8, (rnd2() - 0.5) * 4, -2.2 + rnd2() * 3.2);
    m.userData = { sp: 0.2 + rnd2() * 0.5, ph: rnd2() * 10, amp: 0.2 + rnd2() * 0.5 };
    cubes.add(m);
  }
  root.add(cubes);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, hi = a.high || 0;
      planes.forEach((m, i) => {
        m.material.uniforms.uTime.value = t;
        m.material.uniforms.uHead.value = bs;
        m.material.uniforms.uDensity.value = 0.45 + bs * 0.3 + (i % 5) * 0.06;
        m.material.uniforms.uHi.value.setRGB(
          pal.b.r !== undefined ? pal.b.r : 0.7,
          pal.b.g !== undefined ? pal.b.g : 1.0,
          pal.b.b !== undefined ? pal.b.b : 0.8
        );
      });
      cubes.children.forEach(c => {
        c.position.y += Math.sin(t * c.userData.sp + c.userData.ph) * 0.0016;
        c.rotation.x += 0.004;
        c.rotation.y += 0.006;
      });
      lights.userData.rim1.intensity = 4.8 + hi * 6.2;
      floor.material.opacity = 0.14 + bs * 0.12;
    },
  };
}

// ============ 2. v1 —— 几何意象（点/圆/正弦/无穷） ============
export function sceneGeometry() {
  const pal = PALETTE.v1;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 2.2, rim: 6.2, amb: 0.26 });
  root.add(lights);
  root.add(makeStars(1800, 75, 0.48));
  root.add(makeMotes(420, 12, pal.b));

  const core = makeCore(pal, 0.30);
  root.add(core);

  // --- 组 0：点集 ---
  const gPoints = new THREE.Group();
  {
    const N = 520;
    const pos = new Float32Array(N * 3);
    const rnd = U.rnd(101);
    for (let i = 0; i < N; i++) {
      // 球壳上的点
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 1.5;
      pos[i * 3] = Math.cos(th) * s * r;
      pos[i * 3 + 1] = u * r;
      pos[i * 3 + 2] = Math.sin(th) * s * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.075, map: glowTexture(), color: pal.b, transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    gPoints.add(new THREE.Points(geo, mat));
    // 连接线（邻近点）
    const lpos = [];
    const arr = geo.attributes.position.array;
    for (let i = 0; i < N; i += 3) {
      for (let j = i + 1; j < Math.min(i + 4, N); j++) {
        const dx = arr[i * 3] - arr[j * 3], dy = arr[i * 3 + 1] - arr[j * 3 + 1], dz = arr[i * 3 + 2] - arr[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < 0.42) {
          lpos.push(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2], arr[j * 3], arr[j * 3 + 1], arr[j * 3 + 2]);
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
    gPoints.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: pal.a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
  }
  root.add(gPoints);

  // --- 组 1：圆 ---
  const gCircle = new THREE.Group();
  {
    const R = 1.55;
    // 主圆（粗管）
    const curve = new THREE.EllipseCurve(0, 0, R, R, 0, Math.PI * 2);
    const pts = curve.getPoints(180).map(p => new THREE.Vector3(p.x, p.y, 0));
    gCircle.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 200, 0.032, 8, true),
      MAT.solid(pal.a, pal.b, 0.62, 0.25, 0.55)
    ));
    // 内圈虚线
    const dashN = 64;
    const dg = [];
    for (let i = 0; i < dashN; i++) {
      const a0 = (i / dashN) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2 / dashN) * 0.55;
      dg.push(Math.cos(a0) * (R - 0.22), Math.sin(a0) * (R - 0.22), 0);
      dg.push(Math.cos(a1) * (R - 0.22), Math.sin(a1) * (R - 0.22), 0);
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.Float32BufferAttribute(dg, 3));
    gCircle.add(new THREE.LineSegments(dgeo, new THREE.LineBasicMaterial({
      color: pal.b, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    // 半径扫描线
    const rad = new THREE.Mesh(
      new THREE.BoxGeometry(R, 0.016, 0.016),
      new THREE.MeshBasicMaterial({ color: pal.c, transparent: true, opacity: 0.8 })
    );
    rad.position.x = R / 2;
    gCircle.add(rad);
    gCircle.userData.radius = rad;
    // 圆周刻度
    const tpos = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r0 = R + 0.06, r1 = R + (i % 4 === 0 ? 0.24 : 0.13);
      tpos.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    }
    const tgeo = new THREE.BufferGeometry();
    tgeo.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3));
    gCircle.add(new THREE.LineSegments(tgeo, new THREE.LineBasicMaterial({
      color: pal.b, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
  }
  root.add(gCircle);

  // --- 组 2：正弦 + 切线 ---
  const gSine = new THREE.Group();
  {
    const N = 220, W = 3.4, A = 1.0;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = (i / N - 0.5) * W;
      pts.push(new THREE.Vector3(x, Math.sin(x * 2.4) * A, 0));
    }
    gSine.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.030, 8, false),
      MAT.solid(pal.a, pal.b, 0.66, 0.24, 0.5)
    ));
    // 轴线
    const axg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-W / 2 - 0.3, 0, 0), new THREE.Vector3(W / 2 + 0.3, 0, 0),
    ]);
    gSine.add(new THREE.Line(axg, new THREE.LineBasicMaterial({
      color: pal.b, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    // 移动的切线 + 切点
    const tangent = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.014, 0.014),
      new THREE.MeshBasicMaterial({ color: pal.c, transparent: true, opacity: 0.9 })
    );
    gSine.add(tangent);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({ color: pal.c })
    );
    gSine.add(dot);
    const halo = makeGlowSprite(pal.c, 0.62, 0.75);
    gSine.add(halo);
    gSine.userData = { tangent, dot, halo, W, A };
  }
  root.add(gSine);

  // --- 组 3：无穷 ---
  const gInf = new THREE.Group();
  {
    const R = 0.95;
    const mkLoop = (cx) => {
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        pts.push(new THREE.Vector3(cx + Math.cos(a) * R, Math.sin(a) * R, 0));
      }
      return new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 180, 0.034, 8, true),
        MAT.solid(pal.a, pal.b, 0.66, 0.24, 0.5)
      );
    };
    gInf.add(mkLoop(-R * 0.92));
    gInf.add(mkLoop(R * 0.92));
    // 渐散箭头（表示趋近）
    const arrowMat = new THREE.LineBasicMaterial({ color: pal.b, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const x = side * (R * 1.92 + 0.24 + k * 0.30);
        const len = 0.14 - k * 0.018;
        const g = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, len, 0), new THREE.Vector3(x, -len, 0),
        ]);
        gInf.add(new THREE.Line(g, arrowMat));
      }
    }
  }
  root.add(gInf);

  const groups = [gPoints, gCircle, gSine, gInf];
  groups.forEach((g, i) => { g.visible = i === 0; });

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      // 段内进度分四阶段
      const s = secT / 14.77;
      const stage = s < 0.24 ? 0 : s < 0.46 ? 1 : s < 0.70 ? 2 : 3;
      groups.forEach((g, i) => { g.visible = i === stage; });

      core.userData.core.rotation.y = t * 0.8;
      core.userData.mat.uniforms.uTime.value = t;
      core.userData.mat.uniforms.uBass.value = bs;
      core.userData.core.scale.setScalar(0.9 + bs * 0.10);
      core.userData.halo.material.opacity = 0.18 + bs * 0.2;

      // 点云旋转
      gPoints.rotation.y = t * 0.22;
      gPoints.rotation.x = Math.sin(t * 0.3) * 0.2;

      // 圆
      gCircle.rotation.z = -t * 0.18;
      if (gCircle.userData.radius) gCircle.userData.radius.rotation.z = t * 1.5;
      gCircle.scale.setScalar(1 + bs * 0.05);

      // 正弦
      {
        const d = gSine.userData;
        const x = Math.sin(t * 0.55) * (d.W / 2 - 0.35);
        const y = Math.sin(x * 2.4) * d.A;
        const slope = Math.cos(x * 2.4) * 2.4 * d.A;
        d.dot.position.set(x, y, 0);
        d.halo.position.set(x, y, 0);
        d.tangent.position.set(x, y, 0);
        d.tangent.rotation.z = Math.atan(slope);
        d.halo.scale.setScalar(0.5 + bs * 0.5);
        gSine.rotation.y = Math.sin(t * 0.2) * 0.28;
      }

      // 无穷
      gInf.rotation.y = Math.sin(t * 0.26) * 0.34;
      gInf.scale.setScalar(1 + bs * 0.04);

      lights.userData.rim1.intensity = 6.24 + e * 5.28;
      lights.userData.amb.intensity = 0.26 + e * 0.12;
    },
  };
}

// ============ 3. pre1 —— 振荡/交流电 ============
export function sceneOscillate() {
  const pal = PALETTE.pre1;
  const root = new THREE.Group();
  const lights = makeLights(pal, { key: 1.6, rim: 5.8, amb: 0.20 });
  root.add(lights);
  root.add(makeStars(1500, 78, 0.46));
  root.add(makeMotes(600, 14, pal.b));

  // 同心环阵列（沿 z 堆叠，形成隧道感）
  const rings = [];
  // 环体曾经用 emissive: pal.b（pre1 的 pal.b = 0xa8fff4 接近纯白），
  // 叠加 Bloom 后整圈发白、结构全丢。改成自发光用主色 pal.a，底色压到深青。
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x0b3b38, emissive: pal.a, emissiveIntensity: 0.34,
    roughness: 0.34, metalness: 0.55,
  });
  for (let i = 0; i < 22; i++) {
    const r = 0.55 + i * 0.10;
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.014 + i * 0.0008, 6, 96),
      ringMat.clone()
    );
    m.position.z = -i * 0.34;
    m.userData = { baseR: r, z: -i * 0.34, i };
    root.add(m);
    rings.push(m);
  }

  // 中心脊柱（电流）
  // 原来是一根 9 m 长的细圆柱贯穿整个隧道，从近端看会被透视压成一道刺眼的
  // 白色细针（贴近相机的部分被无限拉长）。改成只在中段留一小截，且用主色。
  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.020, 1.6, 6),
    new THREE.MeshBasicMaterial({ color: pal.a, transparent: true, opacity: 0.22, depthWrite: false })
  );
  spine.rotation.x = Math.PI / 2;
  spine.position.z = -4.2;
  root.add(spine);

  // 沿脊柱的电流脉冲
  // 注意：Sprite + AdditiveBlending 会随「相机距离/数量」累加，14 个叠在一起
  // 正对镜头时直接烧成一团白。改成小尺寸 + 低透明度 + 少量。
  const pulses = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: pal.a, transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.setScalar(0.060);
    s.userData = { ph: i / 8, sp: 0.5 + (i % 3) * 0.2 };
    root.add(s);
    pulses.push(s);
  }

  // 交流/直流的切换指示：两根竖直光柱
  // 用 MeshBasicMaterial + pal.b（接近白）会直接烧成两根白棒，改为暗色 + 低透明。
  const acBars = new THREE.Group();
  for (let k = 0; k < 2; k++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 1.6, 0.035),
      new THREE.MeshBasicMaterial({ color: pal.a, transparent: true, opacity: 0.22, depthWrite: false })
    );
    b.position.set(k === 0 ? -2.4 : 2.4, 0, -2.4);
    acBars.add(b);
  }
  root.add(acBars);

  // 漂浮碎片
  // 坑：原来 z = (rnd()-0.5)*9-2 → [-6.5, 2.5]，相机在 z≈1.2 附近，
  // 于是总有几片贴着镜头，被透视放大成挡住半个屏幕的白色楔形。
  // 改成只在相机前方的环带里分布（z ∈ [-7, -0.6]），并且避让中轴。
  const chips = new THREE.Group();
  const chipGeo = new THREE.TetrahedronGeometry(0.075);
  const chipMat = new THREE.MeshStandardMaterial({
    color: 0x0d4a44, emissive: pal.a, emissiveIntensity: 0.40, roughness: 0.42, metalness: 0.5,
  });
  const rnd = U.rnd(67);
  for (let i = 0; i < 90; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = 1.5 + rnd() * 3.0;
    const m = new THREE.Mesh(chipGeo, chipMat);
    m.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.7, -0.6 - rnd() * 6.4);
    m.userData = { sp: 0.3 + rnd(), ph: rnd() * 9, amp: 0.15 + rnd() * 0.3 };
    chips.add(m);
  }
  root.add(chips);

  return {
    root, pal,
    update(t, secT, a) {
      const bs = a.bass || 0, e = a.energy || 0;
      // AC/DC 切换：段内前 60% 振荡，后 40% 稳定
      const s = secT / 14.77;
      const acAmt = s < 0.6 ? 1.0 : U.lerp(1.0, 0.15, U.smooth(0.6, 0.75, s));
      rings.forEach((m, i) => {
        const ph = t * 2.2 - i * 0.34;
        const osc = Math.sin(ph) * 0.13 * acAmt;
        m.scale.setScalar(1 + osc + bs * 0.07);
        // 关键：emissiveIntensity 必须 < 1。曾经写到 0.40 + 0.55 + 0.30 = 1.25，
        // 经 ACES + Bloom 后整圈糊成纯白，环体结构全丢。
        m.material.emissiveIntensity = 0.26 + Math.max(0, Math.sin(ph)) * 0.22 * acAmt + bs * 0.14;
        m.rotation.z = t * 0.12 * (i % 2 ? 1 : -1) * acAmt;
      });
      pulses.forEach(p => {
        const u = (p.userData.ph + t * p.userData.sp * 0.4) % 1;
        p.position.set(0, 0, -u * 7.6);
        p.material.opacity = Math.sin(u * Math.PI) * 0.34;
      });
      spine.material.opacity = 0.22 + bs * 0.18;
      acBars.children.forEach((b, i) => {
        b.material.opacity = 0.35 + Math.abs(Math.sin(t * 3.1 + i * Math.PI)) * 0.5 * acAmt;
      });
      chips.children.forEach(c => {
        c.position.y += Math.sin(t * c.userData.sp + c.userData.ph) * 0.0018;
        c.rotation.x += 0.005; c.rotation.y += 0.007;
      });
      lights.userData.rim1.intensity = 5.76 + e * 6.24;
      lights.userData.amb.intensity = 0.20 + e * 0.14;
    },
  };
}
