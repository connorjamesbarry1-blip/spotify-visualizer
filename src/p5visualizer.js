// p5.js-powered visualization modes.
// `p5` is available as a global from the CDN script loaded before this module.
// All sketches read window.P5_AUDIO and window.VIZ_SETTINGS each frame.

const BLACK = '#080808';

function calcRMS(timeData) {
  if (!timeData) return 0;
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / timeData.length);
}

// ── Noise Field ────────────────────────────────────────────────────────────────

function noiseFieldSketch(p) {
  const COUNT = 350;
  const pts   = [];
  let pulse   = 0;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(BLACK);
    for (let i = 0; i < COUNT; i++) {
      pts.push({ x: p.random(p.width), y: p.random(p.height), px: 0, py: 0 });
    }
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { timeData, beatInfo } = audio;
    const s      = window.VIZ_SETTINGS ?? {};
    const bass   = beatInfo?.bass ?? 0;
    const react  = s.reactivity ?? 0.7;
    const rms    = calcRMS(timeData);
    const energy = 0.4 * bass + 0.6 * rms;
    const hue    = (window.VIZ_HUE ?? (p.frameCount * 0.4)) % 360;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.06);

    // Fade to #080808
    p.noStroke();
    p.fill(BLACK, 28);
    p.rect(0, 0, p.width, p.height);

    const t     = p.frameCount * 0.003;
    const speed = (0.5 + energy * 28 + pulse * 12) * react;
    const sw    = 1 + energy * 3 + pulse * 2;

    // Flow field particles
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      pt.px = pt.x;
      pt.py = pt.y;

      const angle = p.noise(pt.x / 700, pt.y / 700, t) * p.TWO_PI * 2.4;
      pt.x += Math.cos(angle) * speed;
      pt.y += Math.sin(angle) * speed;

      // Waveform nudge — raw sample pushes particle perpendicular to flow
      if (timeData && i % 4 === 0) {
        const wav = (timeData[i % timeData.length] - 128) / 128;
        pt.x += wav * energy * 15 * react;
        pt.y += wav * energy * 15 * react;
      }

      if (pt.x < 0 || pt.x > p.width)  { pt.x = p.random(p.width);  pt.px = pt.x; }
      if (pt.y < 0 || pt.y > p.height) { pt.y = p.random(p.height); pt.py = pt.y; }

      p.stroke((hue + p.noise(pt.x / 300, pt.y / 300) * 60) % 360, 75, 90, 65);
      p.strokeWeight(sw);
      p.line(pt.px, pt.py, pt.x, pt.y);
    }

    // Waveform ribbon — sound wave drawn as explicit horizontal backbone
    if (timeData) {
      const cy   = p.height / 2;
      const step = p.width / 256;
      const amp  = 80 + energy * 220 * react;
      p.strokeWeight(1.5 + energy * 2.5);
      for (let i = 0; i < 255; i++) {
        const idx1  = Math.floor(i       * timeData.length / 256);
        const idx2  = Math.floor((i + 1) * timeData.length / 256);
        const wav1  = ((timeData[idx1] - 128) / 128) * amp;
        const wav2  = ((timeData[idx2] - 128) / 128) * amp;
        const alpha = 30 + energy * 50;
        p.stroke(hue, 55, 95, alpha);
        p.line(i * step, cy + wav1, (i + 1) * step, cy + wav2);
      }
    }
  };
}

// ── 3D Sphere ──────────────────────────────────────────────────────────────────

function sphereSketch(p) {
  let rotY  = 0;
  let pulse = 0;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
    p.colorMode(p.HSB, 360, 100, 100);
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { timeData, beatInfo } = audio;
    const s      = window.VIZ_SETTINGS ?? {};
    const bass   = beatInfo?.bass ?? 0;
    const react  = s.reactivity ?? 0.7;
    const rms    = calcRMS(timeData);
    const energy = 0.4 * bass + 0.6 * rms;
    const hue    = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.07);

    p.background(BLACK);

    const base   = Math.min(p.width, p.height) * 0.28;
    const radius = base + pulse * 80 * react + energy * 60 * react;
    rotY += (0.004 + energy * 0.06) * react;

    // Lighting
    p.ambientLight(30);
    p.pointLight(
      p.color((hue + 130) % 360, 80, 100),
      350 * Math.cos(rotY * 0.7), -280, 300
    );
    p.pointLight(
      p.color(hue, 55, 85),
      -300, 220, 150
    );

    // Main sphere
    p.noStroke();
    p.fill(p.color(hue, 70, 80 + pulse * 20));
    p.rotateX(0.28 + Math.sin(p.frameCount * 0.009) * 0.12);
    p.rotateY(rotY);
    p.sphere(radius, 40, 28);

    // Waveform rings — 3 tilted rings deformed by timeData
    if (timeData) {
      const len      = timeData.length;
      const ringR    = base * 0.95;
      const tilts    = [0, Math.PI / 3, -Math.PI / 3];
      const ringHue  = (hue + 160) % 360;

      p.noFill();
      p.strokeWeight(2 + energy * 3);

      for (let t = 0; t < tilts.length; t++) {
        p.push();
        p.rotateX(tilts[t]);
        p.rotateY(rotY * 0.4 * (t + 1));
        p.stroke(p.color(ringHue, 80, 90 + pulse * 10));
        p.beginShape();
        for (let i = 0; i <= 128; i++) {
          const angle = (i / 128) * p.TWO_PI;
          const sample = timeData[(i * 8) % len];
          const disp = ((sample - 128) / 128) * energy * 90 * react;
          const r    = ringR + disp + pulse * 30 * react;
          p.vertex(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        }
        p.endShape(p.CLOSE);
        p.pop();
      }
    }
  };
}

// ── Grid Ripple ────────────────────────────────────────────────────────────────

function gridRippleSketch(p) {
  const COLS  = 32;
  const ROWS  = 20;
  let ripples = [];

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noStroke();
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { freqData, timeData, beatInfo } = audio;
    const s      = window.VIZ_SETTINGS ?? {};
    const bass   = beatInfo?.bass ?? 0;
    const react  = s.reactivity ?? 0.7;
    const rms    = calcRMS(timeData);
    const energy = 0.4 * bass + 0.6 * rms;
    const hue    = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    p.background(BLACK);

    const cellW = p.width  / COLS;
    const cellH = p.height / ROWS;
    const cx    = p.width  / 2;
    const cy    = p.height / 2;
    const tLen  = timeData ? timeData.length : 1;

    if (beatInfo?.isKick) {
      ripples.push({ r: 0, amp: 1.5, spd: 4 + energy * 12 });
    }
    ripples = ripples.filter(r => r.amp > 0.02);
    for (const rp of ripples) { rp.r += rp.spd; rp.amp *= 0.93; }

    for (let col = 0; col < COLS; col++) {
      const x   = (col + 0.5) * cellW;
      const bin = Math.floor((col / COLS) * (freqData ? freqData.length * 0.45 : 64));
      const fv  = freqData ? freqData[bin] / 255 : 0;

      // Waveform displacement: each column samples a timeData point
      const wav = timeData ? (timeData[(col * 8) % tLen] - 128) / 128 : 0;

      for (let row = 0; row < ROWS; row++) {
        const baseY = (row + 0.5) * cellH;
        // Waveform pushes each dot vertically — the grid undulates like a wave field
        const y    = baseY + wav * energy * cellH * 1.4 * react;
        const dist = Math.hypot(x - cx, baseY - cy);

        let disp = 0;
        for (const rp of ripples) {
          if (dist < rp.r + 40) disp += Math.sin((dist - rp.r) * 0.11) * rp.amp;
        }

        // Dot size: reacts to both per-column frequency AND overall energy
        const base = cellW * 0.12 + fv * cellW * 0.40 * react * (1 + energy * 2);
        const r    = Math.max(1.5, base + disp * cellW * 0.45 * react);
        const dHue = (hue + dist * 0.14) % 360;
        const brt  = 50 + fv * 50 + energy * 30 + Math.abs(disp) * 30;

        p.fill(dHue, 80, Math.min(100, brt));
        p.ellipse(x, y, r * 2, r * 2);
      }
    }
  };
}

// ── Phase Space ────────────────────────────────────────────────────────────────

function phaseSpaceSketch(p) {
  let pulse = 0;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(BLACK);
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { timeData, beatInfo } = audio;
    const s      = window.VIZ_SETTINGS ?? {};
    const bass   = beatInfo?.bass ?? 0;
    const react  = s.reactivity ?? 0.7;
    const rms    = calcRMS(timeData);
    const energy = 0.4 * bass + 0.6 * rms;
    const hue    = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.05);

    // Fade to #080808
    p.noStroke();
    p.fill(BLACK, 32);
    p.rect(0, 0, p.width, p.height);

    if (!timeData || timeData.length < 1024) return;

    // Scale expands dramatically with loudness — the whole Lissajous shape breathes
    const scale = Math.min(p.width, p.height) * 0.44 * (0.85 + energy * 0.8);
    const cx    = p.width  / 2;
    const cy    = p.height / 2;
    const sw    = 1.5 + energy * 5 * react + pulse * 3;
    const alpha = 82 + energy * 18;

    // Primary trace — full opacity, dynamic thickness
    p.stroke(hue, 78, 95, alpha);
    p.strokeWeight(sw);
    p.noFill();
    p.beginShape();
    for (let i = 0; i < 512; i++) {
      const x = ((timeData[i]       / 255) * 2 - 1) * scale;
      const y = ((timeData[i + 512] / 255) * 2 - 1) * scale;
      p.vertex(cx + x, cy + y);
    }
    p.endShape();

    // Second trace — only visible when music is loud
    const alpha2 = energy * 60;
    if (alpha2 > 5) {
      p.stroke((hue + 120) % 360, 65, 85, alpha2);
      p.strokeWeight(sw * 0.6);
      p.beginShape();
      for (let i = 0; i < 512; i++) {
        const x = ((timeData[i + 256] / 255) * 2 - 1) * scale * 0.8;
        const y = ((timeData[i + 768] / 255) * 2 - 1) * scale * 0.8;
        p.vertex(cx + x, cy + y);
      }
      p.endShape();
    }
  };
}

// ── Kaleidoscope ───────────────────────────────────────────────────────────────

function kaleidoscopeSketch(p) {
  let pulse     = 0;
  let rotOffset = 0;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(BLACK);
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { freqData, timeData, beatInfo } = audio;
    const s      = window.VIZ_SETTINGS ?? {};
    const bass   = beatInfo?.bass ?? 0;
    const react  = s.reactivity ?? 0.7;
    const sym    = Math.max(2, s.symmetry ?? 6);
    const rms    = calcRMS(timeData);
    const energy = 0.4 * bass + 0.6 * rms;
    const hue    = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.04);

    // Continuous rotation driven by music loudness
    rotOffset += (0.003 + energy * 0.025) * react;

    // Fade to #080808
    p.noStroke();
    p.fill(BLACK, 32);
    p.rect(0, 0, p.width, p.height);

    if (!freqData) return;

    const tLen   = timeData ? timeData.length : 1;
    // maxR grows with energy, giving the kaleidoscope a breathing quality
    const maxR   = Math.min(p.width, p.height) * 0.44 + pulse * 28 * react + energy * 40 * react;
    const innerR = maxR * 0.08 + pulse * 10 * react;
    const sliceA = p.TWO_PI / sym;
    const BARS   = 52;
    const sw     = 1.6 + energy * 3.5;

    for (let si = 0; si < sym; si++) {
      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.rotate(rotOffset + si * sliceA);
      if (si % 2 === 1) p.scale(1, -1);

      for (let i = 0; i < BARS; i++) {
        const angle  = (i / BARS) * sliceA - sliceA / 2;
        const bin    = Math.floor((i / BARS) * freqData.length * 0.45);

        // Mix FFT bars with raw waveform displacement
        const fftVal = freqData[bin] / 255;
        const wavVal = timeData ? Math.abs((timeData[(bin * 4) % tLen] - 128) / 128) : 0;
        const mag    = (fftVal * 0.6 + wavVal * energy * 0.8) * (maxR - innerR) * react
                       + innerR + (maxR - innerR) * 0.08;

        const barHue = (hue + (i / BARS) * 180 + bass * 60) % 360;

        p.stroke(barHue, 88, 95, 78);
        p.strokeWeight(sw);
        p.line(
          Math.cos(angle) * innerR, Math.sin(angle) * innerR,
          Math.cos(angle) * mag,    Math.sin(angle) * mag
        );
      }
      p.pop();
    }
  };
}

// ── Registry ───────────────────────────────────────────────────────────────────

const SKETCHES = {
  'p5-noise':  noiseFieldSketch,
  'p5-sphere': sphereSketch,
  'p5-grid':   gridRippleSketch,
  'p5-phase':  phaseSpaceSketch,
  'p5-kaleid': kaleidoscopeSketch,
};

export class P5Visualizer {
  constructor(container) {
    this.container = container;
    this.instance  = null;
  }

  start(modeName) {
    this.stop();
    const sketch = SKETCHES[modeName];
    if (sketch && typeof p5 !== 'undefined') {
      this.instance = new p5(sketch, this.container); // eslint-disable-line new-cap
    }
  }

  stop() {
    if (this.instance) {
      this.instance.remove();
      this.instance = null;
    }
  }
}
