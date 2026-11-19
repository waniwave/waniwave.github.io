// 演出キュー（仕様書 第10章「演出キュー」）
// 計算は一瞬で終わっている。画面は手順列を時間を掛けて再生するだけで、計算には触れない。
// 速さ ×1・×2・×4。再生中は操作を受け付けず、画面をタップすると早送り（残りを一瞬で終える）。
// 激しい演出（ui/fx/shows.js）・粒子（particles.js）・音（audio/）もここから呼ぶ。早送りは見た目だけを終わらせる。

import { mayGlow } from './flash.js';
import { clearParticles } from './particles.js';

/** 標準の速さ（ms）。仕様書 第10章 */
export const MS = { card: 180, banzuke: 120, regular: 220, slam: 260, final: 400, damage: 260, enemy: 320, note: 200, banner: 700 };

export class FxQueue {
  /**
   * @param {{layer: HTMLElement, blocker: HTMLElement, speed: () => number}} o
   */
  constructor(o) {
    this.layer = o.layer;
    this.blocker = o.blocker;
    this.speed = o.speed;
    this.busy = false;
    this.skipping = false;
    this.double = false;     // 演出「文字二回」の間は、飛ぶ文字が2回ずつ出る
    this.wake = null;
    this.timers = new Set();
    this.opts = { shake: true };
    this.blocker.addEventListener('pointerdown', (e) => { e.preventDefault(); this.skip(); });
  }

  /** 早送り：残りの待ちをなくし、動いている演出を終わらせる */
  skip() {
    if (!this.busy) return;
    this.skipping = true;
    if (this.wake) this.wake();
    for (const a of document.getAnimations()) { try { a.finish(); } catch { /* 無限の演出は止めるだけ */ a.cancel(); } }
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.layer.replaceChildren();
    clearParticles();
  }

  /** 少し後に見た目だけの処理をする（早送りしたら取りやめ） */
  later(fn, ms) {
    if (this.skipping) return;
    const t = setTimeout(() => { this.timers.delete(t); try { fn(); } catch (e) { console.error(e); } }, this.dur(ms));
    this.timers.add(t);
  }

  wait(ms) {
    if (this.skipping || ms <= 0) return Promise.resolve();
    return new Promise((res) => {
      const t = setTimeout(() => { this.wake = null; res(); }, ms / this.speed());
      this.wake = () => { clearTimeout(t); this.wake = null; res(); };
    });
  }

  /**
   * 手順を順に再生する。手順は { ms, run: () => void } の並び
   * @returns {Promise<void>}
   */
  async play(tasks) {
    this.busy = true;
    this.skipping = false;
    this.blocker.classList.add('on');
    try {
      for (const t of tasks) {
        try { t.run(); } catch (e) { console.error(e); }
        await this.wait(t.ms ?? 0);
      }
    } finally {
      this.busy = false;
      this.skipping = false;
      this.double = false;
      this.blocker.classList.remove('on');
      this.layer.replaceChildren();
    }
  }

  dur(ms) { return ms / this.speed(); }

  _anim(el, frames, ms, opt = {}) {
    if (this.skipping || !el) return null;
    return el.animate(frames, { duration: this.dur(ms), easing: 'ease-out', ...opt });
  }

  /** 札などが跳ねる */
  bounce(el, ms = MS.card) {
    this._anim(el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-12px) scale(1.06)' }, { transform: 'translateY(0)' }], ms);
  }

  /** 揺れる（強さ px） */
  shake(el, px = 4, ms = MS.slam) {
    if (!this.opts.shake) return;
    this._anim(el, [0, -px, px, -px * 0.6, px * 0.6, 0].map((x) => ({ transform: `translateX(${x}px)` })), ms);
  }

  /** 叩きつける（計算窓） */
  slam(el, ms = MS.slam) {
    this._anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.08) translateY(2px)' }, { transform: 'scale(.98)' }, { transform: 'scale(1)' }], ms);
  }

  /** 光る（番付の段など。CSS の glow） */
  glow(el) {
    if (this.skipping || !el || !mayGlow()) return;
    el.classList.remove('glow');
    void el.offsetWidth;
    el.classList.add('glow');
  }

  /** 要素の中心（演出の層の座標） */
  at(el) {
    const L = this.layer.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - L.left + r.width / 2, y: r.top - L.top + r.height / 2 };
  }

  /**
   * 数字や文字が飛ぶ。from から to へ（to が無ければ上へ）
   * @param {string} text @param {HTMLElement} from @param {HTMLElement} [to] @param {string} [cls]
   */
  pop(text, from, to = null, cls = '', ms = MS.card * 2.2) {
    if (this.skipping || !from) return;
    const copies = this.double ? 2 : 1;
    for (let k = 0; k < copies; k++) {
      const a = this.at(from);
      const b = to ? this.at(to) : { x: a.x, y: a.y - 34 };
      const off = k * 14;
      const el = document.createElement('div');
      el.className = `pop ${cls}`;
      el.textContent = text;
      el.style.left = `${a.x + off}px`;
      el.style.top = `${a.y + off}px`;
      this.layer.append(el);
      const an = el.animate([
        { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: 0.2 },
        { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(1)`, opacity: 1, offset: 0.8 },
        { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.9)`, opacity: 0 },
      ], { duration: this.dur(ms), delay: this.dur(k * 70), easing: 'ease-out', fill: 'both' });
      an.onfinish = () => el.remove();
    }
  }

  /** 画面中央の大きな文字 */
  banner(text, cls = '', ms = MS.banner) {
    if (this.skipping) return;
    const copies = this.double ? 2 : 1;
    for (let k = 0; k < copies; k++) {
      const el = document.createElement('div');
      el.className = `banner ${cls}`;
      el.textContent = text;
      if (k) el.style.marginTop = '48px';
      this.layer.append(el);
      const an = el.animate([
        { opacity: 0, transform: 'translateY(-50%) scale(1.4)' },
        { opacity: 1, transform: 'translateY(-50%) scale(1)', offset: 0.2 },
        { opacity: 1, offset: 0.75 },
        { opacity: 0, transform: 'translateY(-50%) scale(.96)' },
      ], { duration: this.dur(ms), delay: this.dur(k * 90), fill: 'both' });
      an.onfinish = () => el.remove();
    }
  }
}
