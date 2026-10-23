// main.js — Three.js 版主控：场景切换 + 分镜导演 + 音频驱动 + UI
import { Stage, PALETTE, U, THREE } from './core.js';
import { Director } from './camera.js';
import * as A from './scenes_a.js';
import * as B from './scenes_b.js';

const $ = (id) => document.getElementById(id);

/* ================= 段落 → 场景工厂 ================= */
const FACTORY = {
  intro: A.sceneIntro,
  inst1: A.sceneCode,
  v1: A.sceneGeometry,
  pre1: A.sceneOscillate,
  c1: B.sceneCage,
  v2: B.sceneOrganic,
  pre2: B.sceneMirror,
  c2: B.sceneVibration,
  c2x: B.sceneFragments,
  bridge: B.sceneError,
  inst2: A.sceneCode,
  chant: B.sceneBlade,
  c3: B.sceneBlade,
  love: B.sceneHeart,
  outro: B.sceneVoid,
  end: B.sceneVoid,
};

// 相同工厂的段落复用同一份场景实例（避免重复构建几何），
// 但需要在切换时重置各自的内部进度。
const SHARED = { inst1: 'code', inst2: 'code', chant: 'blade', c3: 'blade', outro: 'void', end: 'void' };

/* ================= 错误显示 ================= */
function fail(msg) {
  const e = $('err');
  if (!e) { console.error(msg); return; }
  e.textContent = String(msg);
  e.classList.add('on');
  console.error(msg);
}

let toastTimer = 0;
function toast(msg, ms) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms || 1800);
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(2);
}

function fmtShort(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s - m * 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

/* ================= 启动 ================= */
function boot() {
  const DATA = window.WX;
  if (!DATA) { fail('时间轴数据未加载（data/timing.js 缺失）'); return; }

  const E = window.WXEngine;
  if (!E) { fail('engine.js 未加载'); return; }
  if (!window.WXLyrics) { fail('lyrics.js 未加载'); return; }

  const TL = new E.Timeline(DATA);

  /* ---------- 渲染器 ---------- */
  const canvas = $('gl');
  let stage = null;
  try {
    stage = new Stage(canvas, { preserve: false });
  } catch (err) {
    fail('WebGL2 初始化失败：\n' + (err && err.message ? err.message : err) +
      '\n\n请使用较新版本的 Chrome / Edge / Firefox / Safari，并确认已启用硬件加速。');
    return;
  }

  /* ---------- 音频 ---------- */
  const sound = new E.Sound('assets/audio/song.mp3');
  let duration = DATA.duration;

  /* ---------- 歌词 ---------- */
  const lyrics = new window.WXLyrics.Lyrics(TL, {
    tag: $('lyrTag'),
    prev: $('lyrPrev'),
    main: $('lyrMain'),
    base: $('lyrBase'),
    fill: $('lyrFill'),
    zh: $('lyrZh'),
    next: $('lyrNext'),
  });

  /* ---------- 频谱条 ---------- */
  const specEl = $('hudSpec');
  const SPEC_N = 40;
  const specBars = [];
  if (specEl) {
    for (let i = 0; i < SPEC_N; i++) {
      const b = document.createElement('i');
      b.style.height = '2px';
      specEl.appendChild(b);
      specBars.push(b);
    }
  }

  /* ---------- 进度条段落刻度 ---------- */
  const marksEl = $('trackMarks');
  if (marksEl) {
    const secs = DATA.sections;
    for (let i = 1; i < secs.length; i++) {
      const m = document.createElement('i');
      const p = (secs[i].t / DATA.duration) * 100;
      m.style.left = p.toFixed(3) + '%';
      if (secs[i].id === 'c1' || secs[i].id === 'c2' || secs[i].id === 'chant' || secs[i].id === 'c3') {
        m.className = 'major';
      }
      marksEl.appendChild(m);
    }
  }

  /* ================= 场景管理 ================= */
  const director = new Director();
  const built = Object.create(null);   // key -> scene instance
  let active = null;                   // 当前场景实例
  let activeId = null;                 // 当前段落 id

  function buildScene(secId) {
    const key = SHARED[secId] || secId;
    if (built[key]) return built[key];
    const mk = FACTORY[secId] || A.sceneIntro;
    let sc;
    try {
      sc = mk();
    } catch (err) {
      console.error('场景构建失败：' + secId, err);
      sc = A.sceneIntro();
    }
    sc.root.visible = false;
    stage.scene.add(sc.root);
    built[key] = sc;
    return sc;
  }

  function switchTo(secId) {
    if (secId === activeId) return;
    const next = buildScene(secId);
    if (active && active !== next) {
      active.root.visible = false;
    }
    next.root.visible = true;
    // 同一实例被不同段落复用时，重置其内部时间基准
    next.__id = secId;
    active = next;
    activeId = secId;
    const pal = PALETTE[secId] || PALETTE.intro;
    stage.setPalette(pal);
    // 段落色温：把主色揉进色调
    const ca = new THREE.Color(pal.a);
    stage.grade.uniforms.uTint.value.set(
      0.72 + ca.r * 0.55,
      0.72 + ca.g * 0.55,
      0.72 + ca.b * 0.55
    );
  }

  // 预构建首个场景，避免开场空白
  switchTo('intro');

  /* ================= 状态 ================= */
  let lowfx = false;
  let started = false;
  let forcedT = null;
  let shotFrames = 0;
  let lastNow = 0;
  let fpsAcc = 0, fpsN = 0, fpsShow = 0, fpsT = 0;
  let qAcc = 0, qN = 0;
  let curScale = 1;
  let audioState = { sub: 0, bass: 0, mid: 0, high: 0, energy: 0 };

  /* ================= 播放控制 ================= */
  function setPlayIcon(playing) {
    const p = $('icoPlay');
    if (!p) return;
    p.setAttribute('d', playing
      ? 'M6 5h4v14H6zM14 5h4v14h-4z'
      : 'M8 5v14l11-7z');
    const btn = $('btnPlay');
    if (btn) btn.setAttribute('aria-label', playing ? '暂停' : '播放');
  }

  function doPlay() { sound.play(); setPlayIcon(true); }
  function doPause() { sound.pause(); setPlayIcon(false); }
  function togglePlay() { if (sound.playing) doPause(); else doPlay(); }

  function seekTo(t) {
    sound.seek(t);
    lyrics.idx = -2;
    lastNow = t;
    // 立即切到目标段落，避免拖拽后仍显示旧场景
    const pos = TL.secPos(t);
    switchTo(pos.sec.id);
  }

  /* ================= 事件 ================= */
  $('btnPlay').addEventListener('click', togglePlay);

  const track = $('track');
  let dragging = false;
  function trackSeek(ev) {
    const r = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    seekTo(x * (sound.dur || duration));
  }
  track.addEventListener('pointerdown', (ev) => {
    dragging = true;
    track.setPointerCapture(ev.pointerId);
    trackSeek(ev);
  });
  track.addEventListener('pointermove', (ev) => { if (dragging) trackSeek(ev); });
  track.addEventListener('pointerup', (ev) => {
    dragging = false;
    try { track.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  });
  track.addEventListener('pointercancel', () => { dragging = false; });

  $('btnMute').addEventListener('click', () => {
    const m = !sound.muted;
    sound.setMuted(m);
    $('btnMute').classList.toggle('off', m);
    toast(m ? '已静音' : '取消静音', 1200);
  });

  $('btnSub').addEventListener('click', () => {
    lyrics.setZhVisible(!lyrics.zhVisible);
    $('btnSub').classList.toggle('off', !lyrics.zhVisible);
    toast(lyrics.zhVisible ? '中文字幕：开' : '中文字幕：关', 1200);
  });

  function toggleFull() {
    const d = document;
    if (!d.fullscreenElement) {
      const el = d.documentElement;
      const p = el.requestFullscreen ? el.requestFullscreen() : null;
      if (p && p.catch) p.catch(() => toast('全屏被浏览器拒绝', 1400));
    } else {
      d.exitFullscreen();
    }
  }
  $('btnFull').addEventListener('click', toggleFull);

  window.addEventListener('keydown', (ev) => {
    if (!started) return;
    const k = ev.key;
    if (k === ' ' || k === 'Spacebar') { ev.preventDefault(); togglePlay(); }
    else if (k === 'ArrowLeft') { ev.preventDefault(); seekTo(Math.max(0, sound.now() - 5)); }
    else if (k === 'ArrowRight') { ev.preventDefault(); seekTo(Math.min(duration, sound.now() + 5)); }
    else if (k === 'm' || k === 'M') { $('btnMute').click(); }
    else if (k === 'c' || k === 'C') { $('btnSub').click(); }
    else if (k === 'f' || k === 'F') { toggleFull(); }
    else if (k === 'r' || k === 'R') { seekTo(0); }
    else if (k === 'l' || k === 'L') { lyrics.setZhVisible(!lyrics.zhVisible); }
  });

  let idleTimer = 0;
  const ctrl = $('ctrl');
  function poke() {
    ctrl.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (sound.playing) ctrl.classList.add('idle');
    }, 2600);
  }
  window.addEventListener('pointermove', poke);
  window.addEventListener('pointerdown', poke);

  /* ================= 主循环 ================= */
  function frame() {
    // 截图模式下 forcedT 固定，画面本身是静态的，所以不能停掉循环：
    // 一旦停止 rAF，没有 preserveDrawingBuffer 的 WebGL 画布会被合成器丢弃，
    // 无头浏览器随后截图只会拿到黑屏。这里保持每帧重绘同一时刻。
    requestAnimationFrame(frame);
    if (!started) return;

    const now = (forcedT !== null) ? forcedT : sound.now();
    lastNow = now;
    sound.update();
    audioState = {
      sub: sound.sub, bass: sound.bass, mid: sound.mid,
      high: sound.high, energy: sound.energy,
    };

    renderAt(now);
    updateHUD(now);
  }

  function renderAt(now) {
    const pos = TL.secPos(now);
    const sec = pos.sec;
    switchTo(sec.id);

    const secT = now - sec.t;
    const bt = TL.beat(now);

    // 低动效：整体放慢 + 减弱抖动
    const audio = lowfx
      ? { sub: audioState.sub * 0.5, bass: audioState.bass * 0.5, mid: audioState.mid * 0.5, high: audioState.high * 0.5, energy: audioState.energy * 0.5 }
      : audioState;

    if (active && active.update) {
      active.update(now, Math.max(0, secT), audio);
    }

    const cam = director.update(sec, Math.max(0, secT), now, bt, audio);

    const c = stage.camera;
    c.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    c.lookAt(cam.tgt[0], cam.tgt[1], cam.tgt[2]);
    // 强拍 punch：轻微前推
    if (cam.punch) {
      const d = c.position.clone().sub(new THREE.Vector3(cam.tgt[0], cam.tgt[1], cam.tgt[2]));
      d.setLength(d.length() - cam.punch);
      c.position.copy(new THREE.Vector3(cam.tgt[0], cam.tgt[1], cam.tgt[2])).add(d);
    }
    if (c.fov !== cam.fov) { c.fov = cam.fov; c.updateProjectionMatrix(); }
    c.rotation.z += cam.roll || 0;

    const fx = {
      ca: lowfx ? 0.0008 : 0.0016 + audio.high * 0.0026,
      grain: lowfx ? 0.030 : 0.045,
      scan: lowfx ? 0.05 : 0.10,
      vig: 0.55,
      flash: lowfx ? 0 : Math.min(0.42, (cam.cutFlash || 0) * 0.20 + Math.pow(bt.env, 10) * 0.16),
      bloom: lowfx ? 0.42 : 0.62 + audio.mid * 0.30,
    };
    stage.render(now, fx);

    // 调试：把关键状态写进 HUD，方便无头浏览器 dump-dom 抓取
    if (window.__DBG) {
      const gl = stage.renderer.getContext();
      const px = new Uint8Array(4);
      gl.readPixels(
        Math.floor(gl.drawingBufferWidth / 2),
        Math.floor(gl.drawingBufferHeight / 2),
        1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px
      );
      $('hudTech').textContent = [
        'sec=' + sec.id,
        'secT=' + secT.toFixed(2),
        'pos=' + cam.pos.map(v => v.toFixed(2)).join(','),
        'tgt=' + cam.tgt.map(v => v.toFixed(2)).join(','),
        'fov=' + cam.fov,
        'shot=' + cam.shotIdx + '/' + cam.shotCount,
        'buf=' + gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight,
        'tri=' + stage.renderer.info.render.triangles,
        'calls=' + stage.renderer.info.render.calls,
        'px=' + Array.from(px).join(','),
      ].join(' | ');
    }
  }

  function updateHUD(now) {
    const pos = TL.secPos(now);
    const bt = TL.beat(now);
    $('hudSection').textContent = pos.sec.label || pos.sec.id;
    $('hudBar').textContent = 'bar ' + (bt.bar + 1) + ' · beat ' + (Math.floor(bt.phase * 4) + 1);
    $('hudTime').textContent = fmtTime(now);
    $('lyrTagTxt').textContent = pos.sec.id === 'chant' ? 'CHANT' : (curCaps(now) ? 'CAPS' : 'SINE');

    lyrics.update(now, bt);

    const d = sound.dur || duration;
    const pct = Math.max(0, Math.min(1, now / d));
    $('trackFill').style.width = (pct * 100).toFixed(3) + '%';
    $('trackKnob').style.left = (pct * 100).toFixed(3) + '%';
    $('timeTxt').textContent = fmtShort(now) + ' / ' + fmtShort(d);

    if (sound.el && sound.el.buffered && sound.el.buffered.length) {
      const b = sound.el.buffered;
      const end = b.end(b.length - 1);
      $('trackBuf').style.width = Math.max(0, Math.min(1, end / d)) * 100 + '%';
    }

    if (specBars.length && sound.bins) {
      const bins = sound.bins;
      const n = bins.length;
      for (let i = 0; i < SPEC_N; i++) {
        const f0 = Math.pow(i / SPEC_N, 2.1);
        const f1 = Math.pow((i + 1) / SPEC_N, 2.1);
        const i0 = Math.floor(f0 * n * 0.55);
        const i1 = Math.max(i0 + 1, Math.floor(f1 * n * 0.55));
        let s = 0, c = 0;
        for (let j = i0; j < i1; j++) { s += bins[j]; c++; }
        const v = c ? s / c / 255 : 0;
        specBars[i].style.height = Math.max(2, v * 100).toFixed(1) + '%';
      }
    }

    fpsN += 1;
    fpsT += 1 / 60;
    if (fpsT >= 0.5) {
      fpsShow = fpsN / fpsT;
      fpsT = 0; fpsN = 0;
      $('hudFps').textContent = fpsShow.toFixed(0) + ' fps';
    }
    if (fpsShow > 0 && fpsShow < 42) {
      qN++;
      if (qN > 30 && curScale > 0.55) {
        curScale = Math.max(0.55, curScale - 0.1);
        stage.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75) * curScale);
        qN = 0; qAcc = 0;
      }
    } else {
      qN = 0; qAcc++;
      if (qAcc > 180 && curScale < 1) {
        curScale = Math.min(1, curScale + 0.06);
        stage.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75) * curScale);
        qAcc = 0;
      }
    }
  }

  function curCaps(t) {
    const i = TL.lineAt(t);
    return i >= 0 && TL.lines[i].caps;
  }

  /* ================= 启动流程 ================= */
  function start(low) {
    lowfx = low;
    document.body.classList.toggle('lowfx', lowfx);
    $('gate').classList.add('hide');
    $('hud').classList.add('on');
    $('lyr').classList.add('on');
    $('ctrl').classList.add('on');
    $('title').classList.add('on');
    started = true;

    if (forcedT === null) {
      setTimeout(() => $('title').classList.remove('on'), 6200);
    } else {
      $('title').classList.remove('on');
    }

    doPlay();
    poke();
    frame();
  }

  $('gateGo').addEventListener('click', () => {
    const low = !!($('gateLow') && $('gateLow').checked);
    try { sound.init(); } catch (e) { /* ignore */ }
    sound.onReady((d) => {
      if (d && isFinite(d) && d > 0) duration = d;
    });
    start(low);
  });

  const __isAuto = (typeof window.__AUTO_T === 'number') || /[?&]auto=/.test(location.search);
  if (!__isAuto) setTimeout(() => $('title').classList.add('on'), 300);

  /* ---------- 截图/调试模式 ---------- */
  (function autoMode() {
    let t0 = null;
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('auto')) t0 = parseFloat(q.get('t') || '0') || 0;
    } catch (e) { /* ignore */ }
    if (t0 === null && typeof window.__AUTO_T === 'number') t0 = window.__AUTO_T;
    if (t0 === null) return;
    // 调试：?dbg=1 时把渲染状态写进 HUD，便于无头浏览器 dump-dom 抓取
    if (/[?&]dbg=/.test(location.search)) window.__DBG = true;

    try { sound.init(); } catch (e) { /* ignore */ }
    forcedT = t0;
    // 截图模式下 CSS 过渡不会随 virtual-time 推进，警告卡/标题卡会糊在画面上。
    // 直接 display:none 比依赖 transition 可靠；同时挂 shotmode 让 HUD/歌词/控制条走终态。
    document.body.classList.add('shotmode');
    const g = $('gate'); if (g) g.style.display = 'none';
    start(false);
    const ti = $('title'); if (ti) ti.style.display = 'none';
    shotFrames = 8;
    lastNow = t0;
    lyrics.idx = -2;
    try { sound.seek(t0); } catch (e) { /* ignore */ }
    try { sound.pause(); } catch (e) { /* ignore */ }
    // 静态占位（无音频时也要有能量，避免所有场景全黑）
    audioState = { sub: 0.35, bass: 0.5, mid: 0.42, high: 0.35, energy: 0.45 };
  })();

  /* ---------- 首帧（未播放时也有画面） ---------- */
  (function idle() {
    if (started) return;
    audioState = { sub: 0.22, bass: 0.34, mid: 0.30, high: 0.24, energy: 0.30 };
    renderAt(0);
    setTimeout(idle, 120);
  })();

  sound.onReady((d) => {
    if (d && isFinite(d) && d > 0) {
      duration = d;
      $('timeTxt').textContent = '0:00 / ' + fmtShort(d);
    }
  });

  // 便于外部调试
  window.__WX = { stage, director, TL, switchTo, renderAt };
}

/* ================= 入口 ================= */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { boot(); } catch (e) { fail(e && e.stack ? e.stack : e); }
  });
} else {
  try { boot(); } catch (e) { fail(e && e.stack ? e.stack : e); }
}
