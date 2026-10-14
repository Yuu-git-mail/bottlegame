import confetti from 'canvas-confetti';
import { GameState } from './GameState';
import { AudioSystem } from './AudioSystem';
import { AccessibilityManager } from './AccessibilityManager';

// 瓶 1 本の基準寸法 (scale 1 のとき)。層の高さ 24、瓶の幅 64、底の丸み分 14
const UNIT_W = 64;
const LAYER_H = 24;
const BOTTLE_EXTRA = 14;
const LIFT = 16;
const GAP_X_RATIO = 1.45; // 瓶 1 本あたりの横の占有 (幅 × これ)

interface BottleBox {
  cx: number;     // 中心 x
  bottom: number; // 底の y
  w: number;
  h: number;
  cellX: number;  // 当たり判定セル
  cellY: number;
  cellW: number;
  cellH: number;
}

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState;
  audio: AudioSystem;
  accessibility: AccessibilityManager;

  selectedBottle: number | null = null;
  animating: boolean = false;

  private cssW = 0;
  private cssH = 0;
  private scale = 1;
  private boxes: BottleBox[] = [];
  private layoutN = -1;
  private layoutCap = -1;
  private hint: [number, number] | null = null;
  private hintUntil = 0;
  private flashUntil = 0;
  private flashIndex = -1;
  onInvalidTap: ((reason: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, state: GameState, audio: AudioSystem, accessibility?: AccessibilityManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = state;
    this.audio = audio;
    this.accessibility = accessibility || new AccessibilityManager();

    this.resize();
    const RO = (window as any).ResizeObserver;
    if (RO && canvas.parentElement) {
      try {
        new RO(() => this.resize()).observe(canvas.parentElement);
      } catch {
        // ResizeObserver が無い環境は Viewport 経由の resize() 呼び出しに任せる
      }
    }

    let handled = false;
    const handleTap = (e: MouseEvent | PointerEvent | TouchEvent) => {
      if (handled) return;
      handled = true;
      setTimeout(() => { handled = false; }, 120);
      this.onClick(e);
    };
    if ((window as any).PointerEvent) {
      this.canvas.addEventListener('pointerdown', (e: PointerEvent) => handleTap(e));
    } else {
      this.canvas.addEventListener('touchstart', (e: TouchEvent) => { e.preventDefault(); handleTap(e); }, { passive: false });
      this.canvas.addEventListener('mousedown', (e: MouseEvent) => handleTap(e));
    }
    this.loop();
  }

  setState(state: GameState) {
    this.state = state;
    this.selectedBottle = null;
    this.hint = null;
    this.layoutN = -1;
    this.computeLayout();
  }

  // 親要素の大きさに canvas の CSS サイズを明示的に合わせる (height:100% に頼らない)
  resize() {
    const parent = this.canvas.parentElement;
    let w = window.innerWidth;
    let h = Math.max(200, window.innerHeight - 60);
    if (parent) {
      const r = parent.getBoundingClientRect();
      if (r.width > 50) w = r.width;
      if (r.height > 50) h = r.height;
    }
    w = Math.floor(w);
    h = Math.floor(h);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = w;
    this.cssH = h;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layoutN = -1;
    this.computeLayout();
  }

  // 瓶の本数と最大容量から、全部が画面に入る最大の倍率と配置を決める
  computeLayout() {
    if (!this.state) return;
    const n = this.state.bottles.length;
    const maxCap = Math.max(4, ...this.state.capacities);
    if (n === this.layoutN && maxCap === this.layoutCap && this.boxes.length === n) return;
    this.layoutN = n;
    this.layoutCap = maxCap;

    const W = this.cssW - 12;
    const H = this.cssH - 12;
    const padTop = 22; // 面の説明ラベル分
    const bottleH1 = LAYER_H * maxCap + BOTTLE_EXTRA;

    let best = { cols: 1, rows: n, s: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cellW = W / cols;
      const cellH = (H - padTop) / rows;
      const sW = cellW / (UNIT_W * GAP_X_RATIO);
      const sH = cellH / (bottleH1 + LIFT + 18);
      const s = Math.min(sW, sH);
      if (s > best.s + 1e-6) best = { cols, rows, s };
    }
    const s = Math.min(best.s, 1.7);
    this.scale = s;
    const cols = best.cols;
    const rows = best.rows;
    const cellW = W / cols;
    const cellH = (H - padTop) / rows;
    const bw = UNIT_W * s;
    const bhMax = bottleH1 * s;

    this.boxes = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const inRow = Math.min(cols, n - row * cols);
      const offset = (cols - inRow) * cellW / 2; // 最後の行は中央寄せ
      const cellX = 6 + offset + col * cellW;
      const cellY = 6 + padTop + row * cellH;
      const cx = cellX + cellW / 2;
      const bottom = cellY + cellH / 2 + bhMax / 2 + (LIFT * s) / 2 - 4;
      const cap = this.state.capacities[i];
      const h = (LAYER_H * cap + BOTTLE_EXTRA) * s;
      this.boxes.push({ cx, bottom, w: bw, h, cellX, cellY, cellW, cellH });
    }
  }

  onClick(e: MouseEvent | PointerEvent | TouchEvent) {
    if (this.animating || !this.state || this.state.isWin()) return;
    const overlays = document.querySelectorAll('.menu-overlay');
    for (let i = 0; i < overlays.length; i++) {
      if (!overlays[i].classList.contains('hidden')) return;
    }
    try { this.audio.init(); } catch { /* ignore */ }

    const rect = this.canvas.getBoundingClientRect();
    let clientX = 0, clientY = 0;
    const te = e as TouchEvent;
    const me = e as MouseEvent;
    if (te.touches && te.touches.length > 0) {
      clientX = te.touches[0].clientX; clientY = te.touches[0].clientY;
    } else if (te.changedTouches && te.changedTouches.length > 0) {
      clientX = te.changedTouches[0].clientX; clientY = te.changedTouches[0].clientY;
    } else if (me.clientX !== undefined) {
      clientX = me.clientX; clientY = me.clientY;
    } else {
      return;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const idx = this.getBottleAt(x, y);
    if (idx === null) {
      if (this.selectedBottle !== null) { this.selectedBottle = null; this.audio.playClick(); }
      return;
    }
    this.tapBottle(idx);
  }

  tapBottle(idx: number) {
    const st = this.state;
    if (st.isLocked(idx)) {
      this.audio.playError();
      this.flash(idx);
      if (this.onInvalidTap) this.onInvalidTap('locked');
      this.selectedBottle = null;
      return;
    }
    if (this.selectedBottle === null) {
      if (st.bottles[idx].length > 0 && !st.isBottleComplete(idx)) {
        this.selectedBottle = idx;
        this.audio.playClick();
      } else if (st.isBottleComplete(idx)) {
        this.flash(idx);
      }
      return;
    }
    if (this.selectedBottle === idx) {
      this.selectedBottle = null;
      this.audio.playClick();
      return;
    }
    const from = this.selectedBottle;
    if (st.canPour(from, idx)) {
      st.pour(from, idx);
      this.hint = null;
      this.audio.playPour();
      window.dispatchEvent(new CustomEvent('state-changed'));
      if (st.isBottleComplete(idx)) this.audio.playBottleComplete();
      if (st.isWin()) {
        this.audio.playWin();
        try { confetti({ particleCount: 160, spread: 75, origin: { y: 0.6 } }); } catch { /* ignore */ }
        setTimeout(() => window.dispatchEvent(new CustomEvent('game-clear')), 1600);
      }
      this.selectedBottle = null;
    } else {
      this.audio.playError();
      this.flash(idx);
      // 空いていない・色が違う → 選択を移す (連続で選び直せるように)
      if (st.bottles[idx].length > 0 && !st.isBottleComplete(idx)) this.selectedBottle = idx;
      else this.selectedBottle = null;
    }
  }

  flash(idx: number) {
    this.flashIndex = idx;
    this.flashUntil = performance.now() + 350;
  }

  showHint(move: [number, number]) {
    this.hint = move;
    this.hintUntil = performance.now() + 4000;
  }

  getBottleAt(x: number, y: number): number | null {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (x >= b.cellX && x < b.cellX + b.cellW && y >= b.cellY && y < b.cellY + b.cellH) return i;
    }
    return null;
  }

  draw() {
    const ctx = this.ctx;
    const st = this.state;
    if (!st) return;
    this.computeLayout();
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    const now = performance.now();
    const s = this.scale;

    let selectedColor: number | null = null;
    if (this.selectedBottle !== null && this.accessibility.highlightSameColor) {
      const b = st.bottles[this.selectedBottle];
      if (b.length > 0) selectedColor = b[b.length - 1];
    }
    const hint = this.hint && now < this.hintUntil ? this.hint : null;
    if (hint === null) this.hint = null;

    for (let i = 0; i < st.bottles.length; i++) {
      const box = this.boxes[i];
      if (!box) continue;
      let bottom = box.bottom;
      if (this.selectedBottle === i) bottom -= LIFT * s;
      const flashing = this.flashIndex === i && now < this.flashUntil;
      const hintRole = hint ? (hint[0] === i ? 'from' : (hint[1] === i ? 'to' : null)) : null;
      this.drawBottle(i, box.cx, bottom, box.w, box.h, selectedColor, flashing, hintRole, now);
    }
  }

  drawRoundRect(x: number, y: number, w: number, h: number, radii: number[]) {
    const ctx = this.ctx;
    const r = radii[2] || 0;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, radii);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y);
      ctx.closePath();
    }
  }

  drawBottle(index: number, cx: number, bottom: number, w: number, h: number,
             selectedColor: number | null, flashing: boolean, hintRole: 'from' | 'to' | null, now: number) {
    const ctx = this.ctx;
    const st = this.state;
    const colors = st.bottles[index];
    const capacity = st.capacities[index];
    const s = this.scale;
    const rad = w * 0.22;
    const x = cx - w / 2;
    const top = bottom - h;
    const layerH = LAYER_H * s;
    const locked = st.isLocked(index);
    const complete = st.isBottleComplete(index);

    // ガラスの背景
    ctx.save();
    this.drawRoundRect(x, top, w, h, [0, 0, rad, rad]);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.clip();

    for (let i = 0; i < colors.length; i++) {
      const colorIdx = colors[i];
      const yOff = bottom - (i + 1) * layerH;
      if (st.isHiddenLayer(index, i)) {
        ctx.fillStyle = '#4b4b60';
        ctx.fillRect(x, yOff, w, layerH + 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = `bold ${Math.max(11, Math.floor(layerH * 0.6))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, yOff + layerH / 2 + 1);
        continue;
      }
      const hex = this.accessibility.getColor(colorIdx);
      ctx.fillStyle = hex;
      ctx.fillRect(x, yOff, w, layerH + 0.5);
      // 層の境目を薄く
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x, yOff, w, 1);

      if (this.accessibility.overlayMode === 'texture') {
        this.accessibility.drawTexture(ctx, colorIdx, x, yOff, w, layerH);
      }
      if (this.accessibility.overlayMode === 'number' || this.accessibility.overlayMode === 'symbol') {
        const text = this.accessibility.overlayMode === 'number'
          ? this.accessibility.getNumber(colorIdx)
          : this.accessibility.getSymbol(colorIdx);
        const textColor = this.accessibility.getContrastTextColor(hex);
        ctx.save();
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.max(11, Math.floor(layerH * 0.58))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = textColor === '#FFFFFF' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = 3;
        ctx.fillText(text, cx, yOff + layerH / 2 + 1);
        ctx.restore();
      }
      if (selectedColor !== null && colorIdx === selectedColor) {
        ctx.save();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#FFFF00';
        ctx.shadowBlur = 8;
        ctx.strokeRect(x + 2, yOff + 2, w - 4, layerH - 4);
        ctx.restore();
      }
    }
    // 空き容量の目盛り
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let k = colors.length; k < capacity; k++) {
      const yy = bottom - (k + 1) * layerH;
      ctx.beginPath(); ctx.moveTo(x + 4, yy); ctx.lineTo(x + w - 4, yy); ctx.stroke();
    }
    // ハイライト (ガラスの光)
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + w * 0.12, top, w * 0.12, h);
    if (locked) {
      ctx.fillStyle = 'rgba(20,20,35,0.55)';
      ctx.fillRect(x, top, w, h);
    }
    ctx.restore();

    // 輪郭
    this.drawRoundRect(x, top, w, h, [0, 0, rad, rad]);
    let stroke = 'rgba(255,255,255,0.45)';
    let lw = Math.max(2, 3 * s);
    if (this.selectedBottle === index) { stroke = '#ffffff'; lw += 1; }
    if (complete) stroke = 'rgba(120,255,160,0.9)';
    if (flashing) stroke = '#ff6b6b';
    if (hintRole) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 150);
      stroke = hintRole === 'from' ? `rgba(255,220,80,${0.6 + 0.4 * pulse})` : `rgba(120,220,255,${0.6 + 0.4 * pulse})`;
      lw += 2;
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
    // 口の縁
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x - 3 * s, top - 4 * s, w + 6 * s, 4 * s);

    // 完成マーク
    if (complete) {
      ctx.fillStyle = 'rgba(120,255,160,0.95)';
      ctx.font = `bold ${Math.max(12, Math.floor(16 * s))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('✓', cx, top - 6 * s);
    }
    // 鍵
    if (locked) {
      const lock = st.locks[index]!;
      const size = Math.max(16, Math.floor(26 * s));
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', cx, top + h * 0.42);
      // 必要な色
      const sw = Math.max(10, 14 * s);
      ctx.fillStyle = this.accessibility.getColor(lock.color);
      ctx.fillRect(cx - sw / 2, top + h * 0.42 + size * 0.7, sw, sw);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - sw / 2, top + h * 0.42 + size * 0.7, sw, sw);
    }
    // ヒントの矢印
    if (hintRole) {
      ctx.fillStyle = hintRole === 'from' ? '#ffdc50' : '#78dcff';
      ctx.font = `bold ${Math.max(14, Math.floor(20 * s))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(hintRole === 'from' ? '▲' : '▼', cx, top - (complete ? 24 : 8) * s);
    }
  }

  loop() {
    try {
      this.draw();
    } catch (err) {
      console.error('Render error:', err);
    }
    requestAnimationFrame(this.loop.bind(this));
  }
}
