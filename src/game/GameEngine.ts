import confetti from 'canvas-confetti';
import { GameState } from './GameState';
import { AudioSystem } from './AudioSystem';

const COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#F333FF',
  '#33FFF3', '#FFFF33', '#FF8F33', '#8F33FF'
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
    this.canvas.addEventListener('pointerdown', this.onClick.bind(this));
    
    this.loop();
  }

  resize() {
    this.canvas.width = this.canvas.parentElement!.clientWidth;
    this.canvas.height = this.canvas.parentElement!.clientHeight;
  }

  onClick(e: PointerEvent) {
    if (this.animating || this.state.isWin()) return;
    this.audio.init();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
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
    
    const bottleW = Math.min(cellW * 0.4, 60);
    const bottleH = Math.min(cellH * 0.6, 180);

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const cx = col * cellW + cellW / 2;
      let cy = row * cellH + cellH / 2;
      
      if (this.selectedBottle === i) cy -= 20;
      
      this.drawBottle(cx, cy, bottleW, bottleH, this.state.bottles[i]);
    }
  }

  drawBottle(x: number, y: number, w: number, h: number, colors: number[]) {
    const ctx = this.ctx;
    const rad = w * 0.2;
    
    // Draw colors
    const cap = this.state.capacity;
    const hPerColor = (h - rad) / cap;
    
    ctx.save();
    // Path for clipping
    ctx.beginPath();
    ctx.roundRect(x - w/2, y - h/2, w, h, [0, 0, rad, rad]);
    ctx.clip();
    
    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = COLORS[colors[i] % COLORS.length];
      const yOffset = y + h/2 - (i + 1) * hPerColor;
      ctx.fillRect(x - w/2, yOffset, w, hPerColor);
    }
    ctx.restore();
    
    // Outline
    ctx.beginPath();
    ctx.roundRect(x - w/2, y - h/2, w, h, [0, 0, rad, rad]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  loop() {
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }
}
