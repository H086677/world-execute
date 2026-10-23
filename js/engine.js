/* engine.js — WebGL2 双通道渲染器 + 音频时钟
 * 通道一：场景（raymarching）→ HDR 纹理
 * 通道二：后期（色散 / 辉光 / 故障切片 / 暗角 / 颗粒）→ 屏幕
 */
(function (global) {
  'use strict';

  /* ================= 着色器工具 ================= */
  const VS_FULL = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  function compile(gl, type, src, tag) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || '';
      // 打印带行号的错误，方便定位
      const lines = src.split('\n');
      let ctx = '';
      const m = /ERROR:\s*\d+:(\d+)/.exec(log);
      if (m) {
        const ln = parseInt(m[1], 10);
        for (let i = Math.max(0, ln - 4); i < Math.min(lines.length, ln + 3); i++) {
          ctx += (i + 1) + ' | ' + lines[i] + '\n';
        }
      }
      gl.deleteShader(sh);
      throw new Error('[' + tag + '] 着色器编译失败\n' + log + '\n' + ctx);
    }
    return sh;
  }

  function link(gl, vsSrc, fsSrc, tag) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, tag + ':vs');
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, tag + ':fs');
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('[' + tag + '] 程序链接失败\n' + log);
    }
    return p;
  }

  /* ================= 渲染器 ================= */
  class Renderer {
    constructor(canvas, sceneFS, postFS) {
      this.canvas = canvas;
      this.dpr = Math.min(global.devicePixelRatio || 1, 1.75);
      this.scale = 1;              // 自适应质量
      this.fbo = null;
      this.w = 1; this.h = 1;

      const opts = {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        desynchronized: true,
      };
      const gl = canvas.getContext('webgl2', opts);
      if (!gl) throw new Error('NO_WEBGL2');
      this.gl = gl;

      this.progScene = link(gl, VS_FULL, sceneFS, 'scene');
      this.progPost = link(gl, VS_FULL, postFS, 'post');

      // 全屏四边形
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 3, -1, -1, 3,
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.vao = vao;

      // uniform 位置缓存
      this.uScene = this._uniforms(this.progScene);
      this.uPost = this._uniforms(this.progPost);

      // HDR 支持
      this.half = !!gl.getExtension('EXT_color_buffer_float');
      this.texFmt = this.half ? gl.RGBA16F : gl.RGBA8;
      this.texType = this.half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

      this.resize();
      this._lost = false;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this._lost = true;
      }, false);
      canvas.addEventListener('webglcontextrestored', () => {
        this._lost = false;
      }, false);
    }

    _uniforms(prog) {
      const gl = this.gl;
      const map = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i);
        if (!info) continue;
        const name = info.name.replace(/\[0\]$/, '');
        map[name] = gl.getUniformLocation(prog, info.name);
      }
      return map;
    }

    resize() {
      const gl = this.gl;
      const cssW = Math.max(1, this.canvas.clientWidth || global.innerWidth);
      const cssH = Math.max(1, this.canvas.clientHeight || global.innerHeight);
      const w = Math.max(2, Math.round(cssW * this.dpr * this.scale));
      const h = Math.max(2, Math.round(cssH * this.dpr * this.scale));
      if (w === this.w && h === this.h && this.fbo) return;
      this.w = w; this.h = h;
      this.canvas.width = w;
      this.canvas.height = h;

      if (this.fbo) {
        gl.deleteTexture(this.fbo.tex);
        gl.deleteFramebuffer(this.fbo.fb);
      }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, this.texFmt, w, h, 0, gl.RGBA, this.texType, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) {
        // 回退到 8bit
        gl.deleteTexture(tex);
        gl.deleteFramebuffer(fb);
        this.half = false;
        this.texFmt = gl.RGBA8;
        this.texType = gl.UNSIGNED_BYTE;
        const t2 = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t2);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.texFmt, w, h, 0, gl.RGBA, this.texType, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb2 = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t2, 0);
        this.fbo = { tex: t2, fb: fb2 };
      } else {
        this.fbo = { tex, fb };
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setScale(s) {
      const ns = Math.max(0.45, Math.min(1, s));
      if (Math.abs(ns - this.scale) < 0.01) return;
      this.scale = ns;
      this.resize();
    }

    render(U) {
      const gl = this.gl;
      if (this._lost) return;
      this.resize();

      // ---------- 通道一：场景 → FBO ----------
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.fb);
      gl.viewport(0, 0, this.w, this.h);
      gl.useProgram(this.progScene);
      gl.bindVertexArray(this.vao);
      const S = this.uScene;
      gl.uniform2f(S.uRes, this.w, this.h);
      gl.uniform1f(S.uTime, U.time);
      gl.uniform1f(S.uSec, U.sec);
      gl.uniform1f(S.uSecT, U.secT);
      gl.uniform1f(S.uEnergy, U.energy);
      gl.uniform1f(S.uSub, U.sub);
      gl.uniform1f(S.uBass, U.bass);
      gl.uniform1f(S.uMid, U.mid);
      gl.uniform1f(S.uHigh, U.high);
      gl.uniform1f(S.uBeat, U.beat);
      gl.uniform1f(S.uBar, U.bar);
      gl.uniform1f(S.uBeatPhase, U.beatPhase);
      gl.uniform1f(S.uGlitch, U.glitch);
      gl.uniform1f(S.uLow, U.low);
      gl.uniform1f(S.uFlash, U.flash);
      gl.uniform3f(S.uColA, U.colA[0], U.colA[1], U.colA[2]);
      gl.uniform3f(S.uColB, U.colB[0], U.colB[1], U.colB[2]);
      gl.uniform1fv(S.uW, U.w);
      gl.uniform1f(S.uShake, U.shake);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ---------- 通道二：后期 → 屏幕 ----------
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
      gl.useProgram(this.progPost);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fbo.tex);
      const P = this.uPost;
      gl.uniform1i(P.uTex, 0);
      gl.uniform2f(P.uRes, this.w, this.h);
      gl.uniform1f(P.uTime, U.time);
      gl.uniform1f(P.uGlitch, U.glitch);
      gl.uniform1f(P.uFlash, U.flash);
      gl.uniform1f(P.uBloom, U.bloom);
      gl.uniform1f(P.uCA, U.ca);
      gl.uniform1f(P.uLow, U.low);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }
  }

  /* ================= 音频 + 时钟 ================= */
  class Sound {
    constructor(src) {
      this.el = new Audio();
      this.el.src = src;
      this.el.preload = 'auto';
      this.el.crossOrigin = 'anonymous';
      this.el.loop = false;
      this.ctx = null;
      this.analyser = null;
      this.bins = null;
      this.gain = null;
      this.muted = false;
      this.volume = 0.92;
      this.ready = false;
      this.t0 = 0;           // 时钟基准
      this.playing = false;
      this.dur = 0;
      this._onReady = null;
      this._bass = 0; this._mid = 0; this._high = 0; this._sub = 0; this._energy = 0;
      this.el.addEventListener('loadedmetadata', () => {
        this.dur = this.el.duration || 0;
        if (this._onReady) this._onReady(this.dur);
      });
      this.el.addEventListener('ended', () => { this.playing = false; });
    }

    onReady(fn) { this._onReady = fn; if (this.dur) fn(this.dur); }

    /** 必须在用户手势里调用 */
    init() {
      if (this.ctx) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const srcNode = this.ctx.createMediaElementSource(this.el);
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : this.volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.72;
      this.analyser.minDecibels = -92;
      this.analyser.maxDecibels = -12;
      srcNode.connect(this.gain);
      this.gain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
      this.ready = true;
    }

    /** 当前歌曲时间（秒），用 AudioContext 时钟平滑插值 */
    now() {
      if (!this.playing) return this.el.currentTime || 0;
      const t = this.ctx.currentTime - this.t0;
      const e = this.el.currentTime || 0;
      // 漂移过大就重新对齐
      if (Math.abs(t - e) > 0.12) {
        this.t0 = this.ctx.currentTime - e;
        return e;
      }
      return Math.max(0, t);
    }

    play() {
      if (!this.ctx) this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.t0 = this.ctx.currentTime - (this.el.currentTime || 0);
      const p = this.el.play();
      this.playing = true;
      if (p && p.catch) p.catch(() => { this.playing = false; });
      return p;
    }

    pause() {
      this.el.pause();
      this.playing = false;
    }

    seek(t) {
      const d = this.dur || this.el.duration || 0;
      const v = Math.max(0, Math.min(t, d > 0 ? d - 0.05 : t));
      this.el.currentTime = v;
      this.t0 = (this.ctx ? this.ctx.currentTime : 0) - v;
    }

    setMuted(m) {
      this.muted = m;
      if (this.gain) this.gain.gain.value = m ? 0 : this.volume;
    }

    /** 每帧更新频段能量（0..1 归一化） */
    update() {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(this.bins);
      const b = this.bins;
      const n = b.length;
      const nyq = 22050;               // 44.1k / 2
      const binHz = nyq / n;
      const band = (lo, hi) => {
        let i0 = Math.max(0, Math.floor(lo / binHz));
        let i1 = Math.min(n - 1, Math.ceil(hi / binHz));
        let s = 0, c = 0;
        for (let i = i0; i <= i1; i++) { s += b[i]; c++; }
        return c ? (s / c) / 255 : 0;
      };
      const sub = band(20, 60);
      const bass = band(60, 250);
      const mid = band(250, 2000);
      const high = band(2000, 11000);
      const k = 0.34;                  // 平滑
      this._sub += (sub - this._sub) * k;
      this._bass += (bass - this._bass) * k;
      this._mid += (mid - this._mid) * k;
      this._high += (high - this._high) * k;
      this._energy = (this._sub * 0.35 + this._bass * 0.4 + this._mid * 0.2 + this._high * 0.05);
    }

    get sub() { return this._sub; }
    get bass() { return this._bass; }
    get mid() { return this._mid; }
    get high() { return this._high; }
    get energy() { return this._energy; }
  }

  /* ================= 时间轴 ================= */
  class Timeline {
    constructor(data) {
      this.d = data;
      this.beats = data.beats;
      this.sections = data.sections;
      this.lines = data.lines;
      this.downbeats = data.downbeats;
      this.bpm = data.bpm;
      this.dur = data.duration;
      // 每个 beat 的序号（二分查找用）
      this._sb = [];
      for (let i = 0; i < this.sections.length; i++) {
        const s = this.sections[i];
        this._sb.push({ s, i });
      }
    }

    sectionAt(t) {
      const S = this.sections;
      let lo = 0, hi = S.length - 1, r = 0;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (S[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1;
      }
      return { idx: r, sec: S[r] };
    }

    /** 连续段落索引 + 段内进度，用于平滑过渡 */
    secPos(t) {
      const { idx, sec } = this.sectionAt(t);
      const len = Math.max(0.001, sec.e - sec.t);
      return { idx, sec, p: Math.min(1, Math.max(0, (t - sec.t) / len)), len };
    }

    /** 节拍：返回最近拍序号、拍内相位、衰减包络 */
    beat(t) {
      const B = this.beats;
      if (!B.length) return { i: 0, phase: 0, env: 0, bar: 0 };
      let lo = 0, hi = B.length - 1, i = 0;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (B[m] <= t) { i = m; lo = m + 1; } else hi = m - 1;
      }
      const per = this.bpm ? 60 / this.bpm : 0.4615;
      const phase = Math.min(1, Math.max(0, (t - B[i]) / per));
      const env = Math.pow(1 - phase, 2.6);
      const bar = Math.floor(i / 4);
      return { i, phase, env, bar, since: t - B[i] };
    }

    /** 当前歌词行索引（-1 = 还没到，或已唱完进入间奏） */
    lineAt(t) {
      const L = this.lines;
      let lo = 0, hi = L.length - 1, i = -1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (L[m].t <= t) { i = m; lo = m + 1; } else hi = m - 1;
      }
      // A line must not linger past its own end: the instrumental sections are
      // up to 15 s long, and without this the previous line stayed on screen
      // the whole way through (e.g. "ILLEGAL ARGUMENTS" hanging over inst2).
      if (i >= 0 && t > L[i].e + 0.55) return -1;
      return i;
    }
  }

  /* ================= 导出 ================= */
  global.WXEngine = { Renderer, Sound, Timeline, VS_FULL };
})(window);
