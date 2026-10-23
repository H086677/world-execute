// camera.js — 分镜导演：每段落多个镜头，按拍点/乐句切换，含推拉摇移与手持抖动
import { THREE, U } from './core.js';

// 一个"镜头"= 一段时间内的相机位姿函数
// f(t, ctx) -> { pos:[x,y,z], tgt:[x,y,z], fov, roll, shake }
// 其中 t 是镜内局部时间 0..1，ctx 提供 { beat, bar, bass, energy, secPos }

const E = U.ease;

// 常用运镜生成器 ------------------------------------------------------
const MOVE = {
  // 缓慢推近
  dolly: (from, to) => (t) => [U.lerp(from[0], to[0], E.inOut(t)),
                              U.lerp(from[1], to[1], E.inOut(t)),
                              U.lerp(from[2], to[2], E.inOut(t))],
  // 环绕
  orbit: (radius, height, startDeg, endDeg) => (t) => {
    const a = THREE.MathUtils.degToRad(U.lerp(startDeg, endDeg, E.inOut(t)));
    return [Math.sin(a) * radius, height, Math.cos(a) * radius];
  },
  // 横移（轨道）
  track: (y, z, x0, x1) => (t) => [U.lerp(x0, x1, E.inOut(t)), y, z],
  // 升降
  crane: (x, z, y0, y1) => (t) => [x, U.lerp(y0, y1, E.inOut(t)), z],
  // 手持漂移
  handheld: (base, amp = 0.06) => (t, ctx) => {
    const k = (ctx?.t ?? 0) * 1.7;
    return [base[0] + Math.sin(k * 1.3) * amp,
            base[1] + Math.sin(k * 1.9 + 1.2) * amp * 0.8,
            base[2] + Math.sin(k * 1.1 + 2.4) * amp];
  },
  // 冲刺（快推）
  push: (from, to, power = 2.2) => (t) => {
    const k = Math.pow(t, power);
    return [U.lerp(from[0], to[0], k), U.lerp(from[1], to[1], k), U.lerp(from[2], to[2], k)];
  },
};

// 分镜表：section -> [{ dur, pos, tgt, fov, roll, shake, trans }]
// dur 是该镜头占该段落的比例（自动归一化）；trans 是切入方式
export const SHOTS = {
  intro: [
    { w: 3, pos: MOVE.dolly([0, 1.9, 9.5], [0, 0.9, 5.2]), tgt: () => [0, 0.2, 0], fov: 48, shake: 0.02, trans: 'fade' },
    { w: 2, pos: MOVE.orbit(3.6, 1.1, 20, 120), tgt: () => [0, 0.1, 0], fov: 44, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.crane(1.2, 4.2, 2.6, 0.4), tgt: () => [0, 0.15, 0], fov: 40, shake: 0.025, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.3, 6.0], [0, 0.15, 2.2], 2.6), tgt: () => [0, 0.1, 0], fov: 52, shake: 0.04, trans: 'cut' },
  ],
  inst1: [
    { w: 2, pos: MOVE.track(0.10, 1.6, -1.9, 1.9), tgt: () => [0, 0, -3], fov: 48, shake: 0.02, trans: 'cut' },
    { w: 2, pos: MOVE.dolly([0, 0.35, 1.9], [0, 0.05, -0.4]), tgt: () => [0, 0, -3], fov: 58, shake: 0.035, trans: 'cut' },
    { w: 2, pos: MOVE.track(-0.55, 2.2, 2.4, -2.4), tgt: () => [0, 0.15, -3], fov: 44, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.crane(1.2, 1.5, -0.9, 1.7), tgt: () => [-0.4, 0.1, -3], fov: 46, shake: 0.025, trans: 'cut' },
  ],
  v1: [
    { w: 2, pos: MOVE.orbit(3.2, 0.5, 0, 70), tgt: () => [0, 0, 0], fov: 46, shake: 0.02, trans: 'fade' },
    { w: 2, pos: MOVE.track(0.2, 3.4, -1.6, 1.6), tgt: () => [0, 0, 0], fov: 42, shake: 0.025, trans: 'cut' },
    { w: 2, pos: MOVE.dolly([2.4, 1.2, 2.4], [0.8, 0.2, 1.2]), tgt: () => [0, 0, 0], fov: 50, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.1, 4.4], [0, 0.05, 1.5], 2.4), tgt: () => [0, 0, 0], fov: 54, shake: 0.04, trans: 'cut' },
  ],
  // pre1：环阵列沿 -z 堆叠到 z≈-7.1，隧道中轴在 z≈-3.5。
  // 之前四个镜头全部 tgt=[0,0,0]（=最外侧那圈），相机又偏在 z=4.6，
  // 于是整条隧道被推到画面右侧、左边全是空的。这里改成对准隧道中轴。
  pre1: [
    { w: 2, pos: MOVE.dolly([0, 0.35, 3.6], [0, 0.10, -1.4]), tgt: () => [0, 0, -3.6], fov: 62, shake: 0.02, trans: 'fade' },
    { w: 2, pos: MOVE.track(0.20, 1.2, -0.9, 0.9), tgt: () => [0, 0, -3.6], fov: 58, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.orbit(1.5, 0.25, 20, 70), tgt: () => [0, 0, -3.4], fov: 56, shake: 0.035, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.15, 2.2], [0, 0.05, -2.6], 2.4), tgt: () => [0, 0, -3.8], fov: 64, shake: 0.04, trans: 'cut' },
  ],
  // c1：牢笼半边长 S=2.05，体对角线 3.55。
  // 坑：半径 5.4 + fov 42 时可见半高 = 5.4*tan(21°) = 2.07 ≈ S，
  // 立方体正好撑满画框，屏幕上只剩几根紫棱从眼前划过，读不出「笼子」。
  // 要让它成为一个完整的立方体，可见半高需 ≈ 2.5*S → 半径 ≈ 9。
  c1: [
    { w: 2, pos: MOVE.orbit(9.2, 2.2, 0, 55), tgt: () => [0, 0, 0], fov: 38, shake: 0.02, trans: 'cut' },
    { w: 2, pos: MOVE.dolly([0, 0.8, 10.5], [0, 0.2, 7.2]), tgt: () => [0, 0, 0], fov: 42, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.crane(-6.0, 7.2, 4.4, -0.6), tgt: () => [0, 0, 0], fov: 40, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 3.4, 12.0], [0, 0.6, 7.6], 2.0), tgt: () => [0, 0, 0], fov: 42, shake: 0.035, trans: 'cut' },
  ],
  v2: [
    { w: 2, pos: MOVE.orbit(3.4, 0.9, -20, 60), tgt: () => [0, 0.1, 0], fov: 46, shake: 0.025, trans: 'cut' },
    { w: 2, pos: MOVE.track(0.5, 3.0, -1.5, 1.5), tgt: () => [0, 0, 0], fov: 44, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.dolly([1.8, 1.4, 2.6], [0.5, 0.4, 1.4]), tgt: () => [0, 0.1, 0], fov: 50, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.2, 4.2], [0, 0.1, 1.6], 2.2), tgt: () => [0, 0.1, 0], fov: 52, shake: 0.035, trans: 'cut' },
  ],
  pre2: [
    { w: 2, pos: MOVE.orbit(3.2, 0.3, 0, 90), tgt: () => [0, 0, 0], fov: 46, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.crane(0, 3.6, -1.4, 1.6), tgt: () => [0, 0, 0], fov: 44, shake: 0.035, trans: 'cut' },
    { w: 2, pos: MOVE.track(0.1, 2.8, 1.6, -1.6), tgt: () => [0, 0, 0], fov: 48, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0, 4.6], [0, 0, 1.8], 2.6), tgt: () => [0, 0, 0], fov: 54, shake: 0.045, trans: 'cut' },
  ],
  c2: [
    { w: 2, pos: MOVE.orbit(3.8, 0.8, 10, 80), tgt: () => [0, 0, 0], fov: 46, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.dolly([0, 1.2, 4.0], [0, 0.2, 1.4]), tgt: () => [0, 0, 0], fov: 50, shake: 0.035, trans: 'cut' },
    { w: 2, pos: MOVE.crane(1.6, 3.2, 2.0, -0.8), tgt: () => [0, 0, 0], fov: 44, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.4, 5.0], [0, 0.1, 2.0], 2.4), tgt: () => [0, 0, 0], fov: 52, shake: 0.04, trans: 'cut' },
  ],
  c2x: [
    { w: 1, pos: MOVE.push([0, 0.2, 4.8], [0, 0.1, 1.8], 2.8), tgt: () => [0, 0, 0], fov: 54, shake: 0.05, trans: 'cut' },
    { w: 1, pos: MOVE.orbit(2.6, 0.4, 0, 120), tgt: () => [0, 0, 0], fov: 50, shake: 0.045, trans: 'cut' },
    { w: 1, pos: MOVE.track(0.3, 2.4, -1.2, 1.2), tgt: () => [0, 0, 0], fov: 52, shake: 0.04, trans: 'cut' },
  ],
  bridge: [
    { w: 1, pos: MOVE.push([0, 0.1, 3.6], [0, 0.05, 1.0], 3.0), tgt: () => [0, 0, -1], fov: 56, shake: 0.06, trans: 'cut' },
    { w: 1, pos: MOVE.handheld([0.3, 0.2, 2.8], 0.10), tgt: () => [0, 0, -1], fov: 58, shake: 0.07, trans: 'cut' },
    { w: 1, pos: MOVE.orbit(2.2, 0.2, 180, 260), tgt: () => [0, 0, -1], fov: 54, shake: 0.06, trans: 'cut' },
  ],
  inst2: [
    { w: 2, pos: MOVE.track(0.15, 4.8, 1.6, -1.6), tgt: () => [0, 0, -3], fov: 46, shake: 0.025, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.2, 3.2], [0, 0.05, 0.2], 2.0), tgt: () => [0, 0, -3], fov: 54, shake: 0.035, trans: 'cut' },
    { w: 2, pos: MOVE.crane(-0.6, 2.8, 1.6, -0.8), tgt: () => [0, 0.1, -2.6], fov: 48, shake: 0.03, trans: 'cut' },
    { w: 2, pos: MOVE.orbit(2.6, 0.9, 30, 150), tgt: () => [0, 0, -2.2], fov: 46, shake: 0.03, trans: 'cut' },
  ],
  // chant：井壁半径 1.30，刀片散布半径 0.62~1.17。
  // 之前相机贴到 r≈1.5 甚至井内，刀片贴脸导致整屏红雾；这里退到井口外俯视。
  chant: [
    { w: 1, pos: MOVE.dolly([0, 2.4, 4.6], [0, 0.6, 2.2]), tgt: () => [0, -0.2, 0], fov: 52, shake: 0.03, trans: 'fade' },
    { w: 1, pos: MOVE.crane(0, 3.2, -1.6, 1.8), tgt: () => [0, 0.2, 0], fov: 50, shake: 0.035, trans: 'cut' },
    { w: 1, pos: MOVE.orbit(3.4, 1.2, 10, 120), tgt: () => [0, -0.1, 0], fov: 48, shake: 0.03, trans: 'cut' },
    { w: 1, pos: MOVE.handheld([0.6, 1.0, 3.8], 0.07), tgt: () => [0, 0.1, 0], fov: 54, shake: 0.04, trans: 'cut' },
  ],
  // c3：和 chant 共用同一个刀刃竖井（井壁 r=1.30）。
  // 原来 orbit 半径只有 2.0，相机离井壁不到 1 m，竖棱在屏幕上被放大成
  // 一根根宽红条把画面切成碎片。统一退到 r≥3.6，用远景看「井」的纵深。
  c3: [
    { w: 2, pos: MOVE.crane(0, 4.6, -2.0, 2.2), tgt: () => [0, 0.2, 0], fov: 50, shake: 0.035, trans: 'cut' },
    { w: 2, pos: MOVE.orbit(4.2, 0.8, 20, 140), tgt: () => [0, 0.1, 0], fov: 48, shake: 0.035, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.4, 6.4], [0, 0.2, 3.2], 2.2), tgt: () => [0, 0.1, 0], fov: 52, shake: 0.03, trans: 'cut' },
  ],
  love: [
    { w: 2, pos: MOVE.dolly([0, 0.4, 5.2], [0, 0.15, 2.4]), tgt: () => [0, 0.1, 0], fov: 48, shake: 0.02, trans: 'cut' },
    { w: 2, pos: MOVE.orbit(3.0, 0.6, -30, 70), tgt: () => [0, 0.05, 0], fov: 46, shake: 0.025, trans: 'cut' },
    { w: 2, pos: MOVE.crane(1.0, 3.0, 1.6, -0.6), tgt: () => [0, 0.1, 0], fov: 46, shake: 0.025, trans: 'cut' },
    { w: 2, pos: MOVE.push([0, 0.3, 4.0], [0, 0.1, 1.4], 2.0), tgt: () => [0, 0.1, 0], fov: 50, shake: 0.03, trans: 'cut' },
  ],
  outro: [
    { w: 3, pos: MOVE.dolly([0, 1.4, 8.0], [0, 0.8, 12.0]), tgt: () => [0, 0.3, 0], fov: 44, shake: 0.015, trans: 'fade' },
    { w: 2, pos: MOVE.crane(0, 9.0, 1.2, 3.4), tgt: () => [0, 0.2, 0], fov: 42, shake: 0.015, trans: 'cut' },
  ],
  end: [
    { w: 1, pos: MOVE.dolly([0, 1.6, 12.0], [0, 1.2, 18.0]), tgt: () => [0, 0.3, 0], fov: 42, shake: 0.01, trans: 'fade' },
  ],
};

// 导演：根据段落与段内进度返回相机状态
export class Director {
  constructor() {
    this.lastSection = null;
    this.shotIdx = -1;
    this.shotStart = 0;
    this.cutFlash = 0;
  }

  // sec: 段落对象 {id,t,e}; secT: 段内秒; t: 全局秒; beat: 拍信息
  update(sec, secT, t, beat, audio) {
    const table = SHOTS[sec.id] || SHOTS.intro;
    const len = sec.e - sec.t;
    const total = table.reduce((a, s) => a + (s.w || 1), 0);
    // 按权重切分时间
    let acc = 0, idx = 0, local = 0;
    for (let i = 0; i < table.length; i++) {
      const d = len * (table[i].w || 1) / total;
      if (secT < acc + d || i === table.length - 1) {
        idx = i; local = U.clamp((secT - acc) / (d || 1), 0, 1); break;
      }
      acc += d;
    }
    // 切换检测
    const key = sec.id + ':' + idx;
    if (key !== this._key) {
      this._key = key;
      this.cutFlash = 1;           // 触发一次切镜闪白
      this.shotIdx = idx;
    }
    this.cutFlash = Math.max(0, this.cutFlash - 0.12);

    const sh = table[idx];
    const ctx = { t, secT, beat: beat?.phase ?? 0, bass: audio?.bass ?? 0, energy: audio?.energy ?? 0 };
    const pos = sh.pos(local, ctx) || [0, 0, 6];
    const tgt = sh.tgt(local, ctx) || [0, 0, 0];

    // 手持抖动
    const shk = (sh.shake || 0) * (0.6 + (audio?.bass ?? 0) * 0.9);
    const jx = (U.hash(t * 37.1) - 0.5) * shk * 2;
    const jy = (U.hash(t * 41.7 + 3.3) - 0.5) * shk * 2;

    // 强拍轻微震动
    const punch = Math.pow(beat?.env ?? 0, 8) * 0.05;

    return {
      pos: [pos[0] + jx, pos[1] + jy, pos[2]],
      tgt,
      fov: sh.fov || 46,
      roll: (sh.roll || 0) + (U.hash(t * 13.3) - 0.5) * shk * 0.5,
      punch,
      cutFlash: this.cutFlash,
      shotIdx: idx,
      shotCount: table.length,
      trans: sh.trans || 'cut',
    };
  }
}
