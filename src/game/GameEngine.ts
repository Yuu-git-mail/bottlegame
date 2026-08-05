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
    
    // Bind both pointerdown and touchstart for mobile responsiveness
    const handleInput = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      this.onClick(e);
    };

    this.canvas.addEventListener('pointerdown', handleInput as EventListener);
    this.canvas.addEventListener('touchstart', handleInput as EventListener, { passive: false });
    
    this.loop();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = (parent && parent.clientWidth) || window.innerWidth;
    const h = (parent && parent.clientHeight) || (window.innerHeight - 60);
    this.canvas.width = Math.max(w, 300);
    this.canvas.height = Math.max(h, 300);
  }

  onClick(e: MouseEvent | TouchEvent) {
    if (this.animating || !this.state || this.state.isWin()) return;
    try {
      this.audio.init();
    } catch {
      // Audio context initialization error guard
    }

    const rect = this.canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return;
    }

    // Canvas scaling ratio for high DPI and CSS scaling
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

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
    const { width, height } = this.canvas;
    const n = this.state.bottles.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    
    const cellW = width / cols;
    const cellH = height / rows;
    
    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    
    const idx = row * cols + col;
    return idx < n ? idx : null;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const { width, height } = this.canvas;
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
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }
}
