export class AudioSystem {
  private ctx: AudioContext | null = null;

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore audio init errors on restricted mobile browsers
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    try {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio playback errors
    }
  }

  playClick() { this.playTone(600, 'sine', 0.1); }
  playError() { this.playTone(150, 'sawtooth', 0.3); }
  playPour() { this.playTone(300, 'sine', 0.5, 0.05); }
  playBottleComplete() { this.playTone(800, 'sine', 0.4); }
  playWin() {
    this.playTone(523.25, 'sine', 0.2);
    setTimeout(() => this.playTone(659.25, 'sine', 0.2), 100);
    setTimeout(() => this.playTone(783.99, 'sine', 0.4), 200);
  }
}
