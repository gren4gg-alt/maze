class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.ambience = null;
    this.chase = null;
    this.muted = false;
    this.gameplayActive = false;

    this.playerStepTimer = 0;
    this.enemyStepTimer = 0;
    this.lastChasing = false;
    this.ambientEventTimer = 7 + Math.random() * 8;
  }

  async unlock() {
    if (!this.ctx) this.createAudioGraph();

    if (this.ctx.state === "suspended") {
      try { await this.ctx.resume(); } catch (_) {}
    }

    return this.ctx.state === "running";
  }

  createAudioGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.84;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.95;
    this.sfx.connect(this.master);

    this.ambience = this.ctx.createGain();
    this.ambience.gain.value = 0.34;
    this.ambience.connect(this.master);

    this.chase = this.ctx.createGain();
    this.chase.gain.value = 0;
    this.chase.connect(this.master);

    this.startAmbience();
    this.startChaseDrone();
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.master || !this.ctx) return;

    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.84, now, 0.025);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setGameplayActive(active) {
    this.gameplayActive = active;
    if (!active) {
      this.playerStepTimer = 0;
      this.enemyStepTimer = 0;
      this.setChasing(false);
    }
  }

  startAmbience() {
    if (!this.ctx || !this.ambience) return;

    // Low horror room-tone. Frequencies are kept high enough to remain
    // audible on laptop and phone speakers.
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();

    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.value = 74;
    o2.frequency.value = 118;

    g1.gain.value = 0.22;
    g2.gain.value = 0.055;

    o1.connect(g1).connect(this.ambience);
    o2.connect(g2).connect(this.ambience);

    // Quiet looping filtered noise gives the maze a windy/industrial room tone.
    const seconds = 2.5;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    let previous = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      data[i] = previous * 2.4;
    }

    const noise = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const noiseGain = this.ctx.createGain();

    noise.buffer = noiseBuffer;
    noise.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.7;
    noiseGain.gain.value = 0.11;

    noise.connect(filter).connect(noiseGain).connect(this.ambience);

    o1.start();
    o2.start();
    noise.start();
  }

  startChaseDrone() {
    if (!this.ctx || !this.chase) return;

    const bass = this.ctx.createOscillator();
    const pulse = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    const pulseGain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    bass.type = "sawtooth";
    bass.frequency.value = 54;
    bassGain.gain.value = 0.14;

    pulse.type = "square";
    pulse.frequency.value = 108;
    pulseGain.gain.value = 0.035;

    lfo.type = "sine";
    lfo.frequency.value = 3.2;
    lfoGain.gain.value = 0.018;

    lfo.connect(lfoGain);
    lfoGain.connect(pulseGain.gain);

    bass.connect(bassGain).connect(this.chase);
    pulse.connect(pulseGain).connect(this.chase);

    bass.start();
    pulse.start();
    lfo.start();
  }

  setChasing(chasing, intensity = 1) {
    if (!this.ctx || !this.chase) return;

    if (chasing === this.lastChasing && chasing) {
      const now = this.ctx.currentTime;
      const target = 0.30 + Math.min(0.14, Math.max(0, intensity - 1) * 0.05);
      this.chase.gain.setTargetAtTime(target, now, 0.1);
      return;
    }

    this.lastChasing = chasing;
    const now = this.ctx.currentTime;
    this.chase.gain.cancelScheduledValues(now);
    this.chase.gain.setTargetAtTime(chasing ? 0.30 : 0, now, chasing ? 0.07 : 0.18);

    if (chasing) this.alertSting();
  }

  makeNoiseBuffer(duration = 0.08) {
    if (!this.ctx) return null;

    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const envelope = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    return buffer;
  }

  noiseBurst({
    volume = 0.1,
    duration = 0.08,
    filterFrequency = 500,
    pan = 0
  } = {}) {
    if (!this.ctx || !this.sfx || this.muted) return;

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    source.buffer = this.makeNoiseBuffer(duration);
    filter.type = "lowpass";
    filter.frequency.value = filterFrequency;
    filter.Q.value = 0.6;

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);

    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.sfx);
    } else {
      gain.connect(this.sfx);
    }

    source.start(now);
    source.stop(now + duration + 0.03);
  }

  tone({
    frequency = 440,
    endFrequency = null,
    duration = 0.15,
    volume = 0.1,
    type = "sine",
    pan = 0,
    delay = 0
  } = {}) {
    if (!this.ctx || !this.sfx || this.muted) return;

    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    oscillator.type = type;
    const start = this.ctx.currentTime + delay;

    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        start + duration
      );
    }

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    oscillator.connect(gain);

    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.sfx);
    } else {
      gain.connect(this.sfx);
    }

    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  playerFootstep() {
    this.noiseBurst({
      volume: 0.052,
      duration: 0.065,
      filterFrequency: 430
    });
    this.tone({
      frequency: 92,
      endFrequency: 68,
      duration: 0.065,
      volume: 0.025,
      type: "sine"
    });
  }

  enemyFootstep(distance, pan, chasing) {
    const distanceGain = Math.max(0, 1 - distance / 11);
    if (distanceGain <= 0.02) return;

    const volume = (chasing ? 0.11 : 0.075) * distanceGain;
    this.noiseBurst({
      volume,
      duration: 0.09,
      filterFrequency: chasing ? 360 : 290,
      pan
    });
    this.tone({
      frequency: chasing ? 68 : 58,
      endFrequency: 45,
      duration: 0.09,
      volume: volume * 0.55,
      type: "triangle",
      pan
    });
  }

  alertSting() {
    this.tone({
      frequency: 185,
      endFrequency: 74,
      duration: 0.28,
      volume: 0.14,
      type: "sawtooth"
    });
    this.noiseBurst({
      volume: 0.08,
      duration: 0.13,
      filterFrequency: 980
    });
  }

  caught() {
    this.setChasing(false);
    this.tone({
      frequency: 180,
      endFrequency: 42,
      duration: 0.68,
      volume: 0.18,
      type: "sawtooth"
    });
    this.noiseBurst({
      volume: 0.15,
      duration: 0.28,
      filterFrequency: 1200
    });
  }



  hideIn() {
    this.noiseBurst({
      volume: 0.045,
      duration: 0.16,
      filterFrequency: 420
    });
    this.tone({
      frequency: 115,
      endFrequency: 82,
      duration: 0.18,
      volume: 0.025,
      type: "triangle"
    });
  }

  hideOut() {
    this.noiseBurst({
      volume: 0.035,
      duration: 0.11,
      filterFrequency: 520
    });
  }

  keyPickup() {
    this.tone({
      frequency: 520,
      endFrequency: 760,
      duration: 0.16,
      volume: 0.08,
      type: "sine"
    });

    this.tone({
      frequency: 880,
      endFrequency: 1040,
      duration: 0.13,
      volume: 0.05,
      type: "triangle",
      delay: 0.07
    });
  }

  exitUnlocked() {
    [260, 390, 520].forEach((frequency, i) => {
      this.tone({
        frequency,
        endFrequency: frequency * 1.08,
        duration: 0.22,
        volume: 0.06,
        type: "sine",
        delay: i * 0.08
      });
    });
  }

  escaped() {
    this.setChasing(false);
    [330, 440, 660].forEach((frequency, i) => {
      this.tone({
        frequency,
        endFrequency: frequency * 1.06,
        duration: 0.28,
        volume: 0.09,
        type: "sine",
        delay: i * 0.11
      });
    });
  }


  ambientEvent() {
    if (!this.ctx || this.muted) return;

    // Random distant metallic/structural sound.
    const pan = Math.random() * 2 - 1;
    const base = 130 + Math.random() * 90;

    this.tone({
      frequency: base,
      endFrequency: base * (0.45 + Math.random() * 0.20),
      duration: 0.8 + Math.random() * 0.8,
      volume: 0.018 + Math.random() * 0.02,
      type: Math.random() > 0.5 ? "triangle" : "sine",
      pan
    });

    if (Math.random() > 0.45) {
      this.noiseBurst({
        volume: 0.018,
        duration: 0.20 + Math.random() * 0.18,
        filterFrequency: 900 + Math.random() * 700,
        pan
      });
    }
  }

  update(dt, player, enemies) {
    if (!this.ctx || !this.gameplayActive) return;

    this.ambientEventTimer -= dt;
    if (this.ambientEventTimer <= 0) {
      this.ambientEvent();
      this.ambientEventTimer = 8 + Math.random() * 13;
    }

    this.playerStepTimer -= dt;
    if (player.moving && this.playerStepTimer <= 0) {
      this.playerFootstep();
      this.playerStepTimer = 0.29;
    }

    const chasingEnemies = enemies.filter(enemy => enemy.state === "CHASE");
    this.setChasing(chasingEnemies.length > 0, chasingEnemies.length);

    let nearest = null;
    let nearestDistance = Infinity;

    for (const enemy of enemies) {
      if (!enemy.moving) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }

    this.enemyStepTimer -= dt;
    if (nearest && nearestDistance < 11 && this.enemyStepTimer <= 0) {
      const pan = Math.max(-1, Math.min(1, (nearest.x - player.x) / 6));
      const chasing = nearest.state === "CHASE";
      this.enemyFootstep(nearestDistance, pan, chasing);
      this.enemyStepTimer = chasing ? 0.25 : 0.43;
    }
  }
}
