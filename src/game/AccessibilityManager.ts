export type OverlayMode = 'none' | 'number' | 'symbol' | 'texture';

// Okabe-Ito Colorblind Universal Design Palette (8 base high-contrast colors + extended set)
export const OKABE_ITO_PALETTE = [
  '#E69F00', // Orange
  '#56B4E9', // Sky Blue
  '#009E73', // Bluish Green
  '#F0E442', // Yellow
  '#0072B2', // Blue
  '#D55E00', // Vermillion
  '#CC79A7', // Reddish Purple
  '#999999', // Grey
  '#882255', // Wine
  '#44AA99', // Teal
  '#117733', // Green
  '#AA4499'  // Purple
];

export const STANDARD_PALETTE = [
  '#FF5733', '#33FF57', '#3357FF', '#F333FF',
  '#33FFF3', '#FFFF33', '#FF8F33', '#8F33FF',
  '#FF3388', '#88FF33', '#3388FF', '#FF3333'
];

export const SYMBOLS = ['★', '■', '▲', '●', '✦', '◆', '♥', '♠', '♣', '▼', '✦', '✖'];

export class AccessibilityManager {
  overlayMode: OverlayMode = 'none';
  useColorblindPalette: boolean = false;
  highlightSameColor: boolean = true;

  constructor() {
    this.parseURLParams();
  }

  parseURLParams() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'number' || mode === 'symbol' || mode === 'texture') {
      this.overlayMode = mode;
    } else if (mode === 'none') {
      this.overlayMode = 'none';
    }

    const cb = params.get('colorblind');
    if (cb === 'true' || cb === '1') {
      this.useColorblindPalette = true;
    }

    const hl = params.get('highlight');
    if (hl === 'false' || hl === '0') {
      this.highlightSameColor = false;
    }
  }

  getColor(index: number): string {
    const palette = this.useColorblindPalette ? OKABE_ITO_PALETTE : STANDARD_PALETTE;
    return palette[index % palette.length];
  }

  getSymbol(index: number): string {
    return SYMBOLS[index % SYMBOLS.length];
  }

  getNumber(index: number): string {
    return (index + 1).toString();
  }

  // Calculate high contrast text color (black or white) based on background hex
  getContrastTextColor(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#FFFFFF';
  }

  drawTexture(ctx: CanvasRenderingContext2D, colorIndex: number, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;

    const patternType = colorIndex % 6;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (patternType === 0) {
      // Diagonal lines ///
      const step = 8;
      for (let px = -h; px < w + h; px += step) {
        ctx.moveTo(x + px, y + h);
        ctx.lineTo(x + px + h, y);
      }
      ctx.stroke();
    } else if (patternType === 1) {
      // Dots
      const radius = Math.min(w, h) * 0.08;
      const gap = Math.min(w, h) * 0.35;
      for (let px = x + gap / 2; px < x + w; px += gap) {
        for (let py = y + gap / 2; py < y + h; py += gap) {
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (patternType === 2) {
      // Crosshatch ###
      const step = 10;
      for (let px = -h; px < w + h; px += step) {
        ctx.moveTo(x + px, y + h);
        ctx.lineTo(x + px + h, y);
        ctx.moveTo(x + px, y);
        ctx.lineTo(x + px + h, y + h);
      }
      ctx.stroke();
    } else if (patternType === 3) {
      // Horizontal lines ===
      const step = 6;
      for (let py = y + step; py < y + h; py += step) {
        ctx.moveTo(x, py);
        ctx.lineTo(x + w, py);
      }
      ctx.stroke();
    } else if (patternType === 4) {
      // Waves / Zigzag
      const step = 8;
      for (let py = y + step; py < y + h; py += step) {
        ctx.moveTo(x, py);
        for (let px = x; px < x + w; px += step) {
          ctx.lineTo(px + step / 2, py - 3);
          ctx.lineTo(px + step, py);
        }
      }
      ctx.stroke();
    } else if (patternType === 5) {
      // Vertical stripes |||
      const step = 6;
      for (let px = x + step; px < x + w; px += step) {
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + h);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
