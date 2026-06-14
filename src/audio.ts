export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgMusic: HTMLAudioElement | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.bgMusic) {
      this.bgMusic = new Audio('https://files.catbox.moe/4uw9r0.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.4;
    }
  }

  startBackgroundAudio(restart: boolean = false) {
    this.init();
    if (this.bgMusic) {
      if (restart || this.bgMusic.paused) {
        if (restart) this.bgMusic.currentTime = 0;
        this.bgMusic.play().catch(e => console.error("Autoplay prevented:", e));
      }
    }
  }

  pauseBackgroundAudio() {
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
  }

  resumeBackgroundAudio() {
    if (this.bgMusic) {
      this.bgMusic.play().catch(e => console.error("Autoplay prevented:", e));
    }
  }

  stopBackgroundAudio() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    }
  }

  playTypingSound() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playWrongSound() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playCrashSound() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    // Pause background briefly
    this.pauseBackgroundAudio();
    setTimeout(() => this.resumeBackgroundAudio(), 1000);

    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1000;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    
    noise.start();
  }

  playWinSound() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopBackgroundAudio();
    
    // Ascending major arpeggio
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const t = this.ctx.currentTime;
    
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = t + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 1.0);
    });
  }

  playGameOverSound() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopBackgroundAudio();
    
    // Descending minor tone sequence
    const freqs = [392.00, 311.13, 261.63, 196.00]; // G4, Eb4, C4, G3
    const t = this.ctx.currentTime;
    
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sawtooth';
      
      const startTime = t + i * 0.3;
      osc.frequency.setValueAtTime(freq, startTime);
      if (i === freqs.length - 1) {
        osc.frequency.exponentialRampToValueAtTime(freq/2, startTime + 1.5);
      }
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.5);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 1.5);
    });
  }
}

export const audioManager = new AudioManager();
