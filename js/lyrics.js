/* lyrics.js — 双语歌词层
 *
 * 数据来自 timing.js 的 lines[]：每行含 en / zh / t / e / caps / w[]（逐词时间戳）。
 * 卡拉OK 填充按「字符权重」计算：已唱完的词全算，正在唱的词按时间比例算。
 */
(function (global) {
  'use strict';

  function charsOf(w) {
    return w[0].length;
  }

  /** 行内已唱进度 0..1（按字符数加权） */
  function lineProgress(L, t) {
    if (!L || !L.w || !L.w.length) return L && t >= L.e ? 1 : 0;
    let total = 0;
    for (let i = 0; i < L.w.length; i++) total += charsOf(L.w[i]);
    if (total <= 0) return 0;
    let acc = 0;
    for (let i = 0; i < L.w.length; i++) {
      const w = L.w[i];
      const n = charsOf(w);
      const s = w[1], e = w[2];
      if (t >= e) { acc += n; continue; }
      if (t > s) { acc += n * (t - s) / Math.max(1e-6, e - s); }
      break;
    }
    return Math.max(0, Math.min(1, acc / total));
  }

  class Lyrics {
    constructor(TL, el) {
      this.TL = TL;
      this.el = el;
      this.idx = -2;
      this.visible = true;      // 英文
      this.zhVisible = true;    // 中文
      this.lastPct = -1;
      this.beatCool = 0;
      this.beatOn = false;
    }

    setZhVisible(v) {
      this.zhVisible = v;
      this.el.zh.style.display = v ? '' : 'none';
    }

    _fit(text) {
      // 长句自动缩字号
      const n = text.length;
      let k = 1;
      if (n > 46) k = 0.56;
      else if (n > 36) k = 0.66;
      else if (n > 28) k = 0.76;
      else if (n > 22) k = 0.86;
      this.el.main.style.setProperty('--fit', k.toFixed(3));
    }

    _render(idx, t) {
      const L = this.TL.lines;
      const cur = idx >= 0 ? L[idx] : null;

      if (!cur) {
        // instrumental break: nothing is being sung, so only tease what's next
        this.el.base.textContent = '';
        this.el.fill.textContent = '';
        this.el.zh.textContent = '';
        this.el.zh.style.display = 'none';
        this.el.prev.textContent = '';
        this.el.main.classList.remove('caps');
        this._fit('');
        // No upcoming-line tease either: during a 15 s instrumental break it
        // just sat there overlapping the control bar.
        this.el.next.textContent = '';
        return;
      }

      const prev = idx >= 1 ? L[idx - 1] : null;
      const next = idx + 1 < L.length ? L[idx + 1] : null;

      this.el.base.textContent = cur.en;
      this.el.fill.textContent = cur.en;
      this.el.main.classList.toggle('caps', !!cur.caps);
      this._fit(cur.en);

      // 中文
      if (cur.zh) {
        this.el.zh.textContent = cur.zh;
        this.el.zh.style.display = this.zhVisible ? '' : 'none';
      } else {
        this.el.zh.textContent = '';
        this.el.zh.style.display = 'none';
      }

      // 上下句预览
      this.el.prev.textContent = prev ? prev.en : '';
      if (next) {
        const cn = next.zh ? ' <span class="cn">' + next.zh + '</span>' : '';
        this.el.next.innerHTML = next.en + cn;
      } else {
        this.el.next.textContent = '';
      }

      this.lastPct = -1;
    }

    /** 每帧调用 */
    update(t, beat) {
      const idx = this.TL.lineAt(t);

      if (idx !== this.idx) {
        this.idx = idx;
        this._render(idx, t);
      }

      const cur = idx >= 0 ? this.TL.lines[idx] : null;
      if (cur) {
        const p = lineProgress(cur, t);
        // 量化到 0.25% 减少样式抖动
        const q = Math.round(p * 400) / 400;
        if (q !== this.lastPct) {
          this.lastPct = q;
          const pct = (q * 100).toFixed(2);
          const ins = 'inset(0 ' + (100 - q * 100).toFixed(2) + '% 0 0)';
          this.el.fill.style.clipPath = ins;
          this.el.fill.style.webkitClipPath = ins;
          // 中文在过半时点亮
          this.el.zh.classList.toggle('lit', q > 0.55);
        }
      } else if (this.lastPct !== -1) {
        this.lastPct = -1;
        this.el.fill.style.clipPath = 'inset(0 100% 0 0)';
        this.el.fill.style.webkitClipPath = 'inset(0 100% 0 0)';
        this.el.zh.classList.remove('lit');
      }

      // 节拍指示灯
      if (beat && beat.env > 0.72) {
        if (!this.beatOn) {
          this.beatOn = true;
          this.el.tag.classList.add('beat');
          const s = 1 + beat.env * 0.02;
          this.el.main.style.transform = 'scale(' + s.toFixed(4) + ')';
        }
      } else if (this.beatOn) {
        this.beatOn = false;
        this.el.tag.classList.remove('beat');
        this.el.main.style.transform = 'scale(1)';
      }
    }
  }

  global.WXLyrics = { Lyrics, lineProgress };
})(window);
