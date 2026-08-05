import confetti from 'canvas-confetti';
import { GameState } from './GameState';
import { AudioSystem } from './AudioSystem';

const COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#F333FF',
  '#33FFF3', '#FFFF33', '#FF8F33', '#8F33FF',
  '#FF3388', '#88FF33', '#3388FF', '#FF3333'
];

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState;
  audio: AudioSystem;
  
  selectedBottle: number | null = null;
  animating: boolean = false;

  constructor(canvas: HTMLCanvasElement, state: GameState, audio: AudioSystem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = state;
    this.audio = audio;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    
    // Bind event listeners for touch/mouse
    let handled = false;
    const handleTap = (e: MouseEvent | PointerEvent | TouchEvent) => {
      if (handled) return;
      handled = true;
      setTimeout(() => { handled = false; }, 100);
      this.onClick(e);
    };

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => handleTap(e));
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      handleTap(e);
    }, { passive: false });
    this.canvas.addEventListener('click', (e: MouseEvent) => handleTap(e));
    
    this.loop();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = (parent && parent.clientWidth) || window.innerWidth;
    const h = (parent && parent.clientHeight) || (window.innerHeight - 60);
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(w, 300) * dpr;
    this.canvas.height = Math.max(h, 300) * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  onClick(e: MouseEvent | PointerEvent | TouchEvent) {
    if (this.animating || !this.state || this.state.isWin()) return;
    
    // Prevent menu clicks from registering on canvas behind
    const startMenu = document.getElementById('start-menu');
    const resultMenu = document.getElementById('result-menu');
    if ((startMenu && !startMenu.classList.contains('hidden')) ||
        (resultMenu && !resultMenu.classList.contains('hidden'))) {
      return;
    }

    try {
      this.audio.init();
    } catch {
      // Audio context initialization error guard
    }

    const rect = this.canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    const touchEvent = e as TouchEvent;
    const mouseEvent = e as MouseEvent;

    if (touchEvent.touches && touchEvent.touches.length > 0) {
      clientX = touchEvent.touches[0].clientX;
      clientY = touchEvent.touches[0].clientY;
    } else if (touchEvent.changedTouches && touchEvent.changedTouches.length > 0) {
      clientX = touchEvent.changedTouches[0].clientX;
      clientY = touchEvent.changedTouches[0].clientY;
    } else if (mouseEvent.clientX !== undefined) {
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    } else {
      return;
    }

    // Coordinates relative to element CSS size
    const x = (clientX - rect.left) * (this.canvas.clientWidth / rect.width);
    const y = (clientY - rect.top) * (this.canvas.clientHeight / rect.height);

    const clickedIdx = this.getBottleAt(x, y);
    if (clickedIdx === null) return;

    if (this.selectedBottle === null) {
      if (this.state.bottles[clickedIdx].length > 0 && !this.state.isBottleComplete(clickedIdx)) {
        this.selectedBottle = clickedIdx;
        this.audio.playClick();
      }
    } else {
      if (this.selectedBottle === clickedIdx) {
        this.selectedBottle = null;
        this.audio.playClick();
      } else {
        if (this.state.canPour(this.selectedBottle, clickedIdx)) {
          this.state.pour(this.selectedBottle, clickedIdx);
          this.audio.playPour();
          
          if (this.state.isBottleComplete(clickedIdx)) {
            this.audio.playBottleComplete();
          }

          if (this.state.isWin()) {
            this.audio.playWin();
            try {
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } catch {
              // Confetti fallback
            }
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('game-clear'));
            }, 2000);
          }
        } else {
          this.audio.playError();
        }
        this.selectedBottle = null;
      }
    }
  }

  getBottleAt(x: number, y: number): number | null {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const n = this.state.bottles.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    
    const cellW = width / cols;
    const cellH = height / rows;

    const maxCapacity = Math.max(...this.state.capacities);
    const bottleW = Math.min(cellW * 0.4, 60);
    const bottleH = Math.min(cellH * 0.6, 150 + (maxCapacity - 4) * 20);

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;

      // Expand hit area for mobile touch target comfort
      const hitW = Math.max(bottleW * 1.8, cellW * 0.8);
      const hitH = Math.max(bottleH * 1.5, cellH * 0.8);

      if (x >= cx - hitW / 2 && x <= cx + hitW / 2 &&
          y >= cy - hitH / 2 && y <= cy + hitH / 2) {
        return i;
      }
    }
    return null;
  }

  draw() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    this.ctx.clearRect(0, 0, width, height);
    
    const n = this.state.bottles.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    
    const cellW = width / cols;
    const cellH = height / rows;
    
    const maxCapacity = Math.max(...this.state.capacities);
    const bottleW = Math.min(cellW * 0.4, 60);
    // Scale height based on max capacity to ensure tall bottles fit
    const bottleH = Math.min(cellH * 0.6, 150 + (maxCapacity - 4) * 20);

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const cx = col * cellW + cellW / 2;
      let cy = row * cellH + cellH / 2;
      
      if (this.selectedBottle === i) cy -= 20;
      
      this.drawBottle(cx, cy, bottleW, bottleH, this.state.bottles[i], this.state.capacities[i]);
    }
  }

  drawRoundRect(x: number, y: number, w: number, h: number, radii: number[]) {
    const ctx = this.ctx;
    const r = radii[2] || 0;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radii);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  drawBottle(x: number, y: number, w: number, h: number, colors: number[], capacity: number) {
    const ctx = this.ctx;
    const rad = w * 0.2;
    
    // Adjust height proportional to capacity for visual distinction
    const maxCap = Math.max(...this.state.capacities);
    const actualH = h * (capacity / maxCap);
    y = y + (h - actualH) / 2; // Bottom align

    // Draw colors
    const hPerColor = (actualH - rad) / capacity;
    
    ctx.save();
    // Path for clipping
    this.drawRoundRect(x - w/2, y - actualH/2, w, actualH, [0, 0, rad, rad]);
    ctx.clip();
    
    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = COLORS[colors[i] % COLORS.length];
      const yOffset = y + actualH/2 - (i + 1) * hPerColor;
      ctx.fillRect(x - w/2, yOffset, w, hPerColor);
    }
    ctx.restore();
    
    // Outline
    this.drawRoundRect(x - w/2, y - actualH/2, w, actualH, [0, 0, rad, rad]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();
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
