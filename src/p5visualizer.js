// p5.js-powered visualization modes.
// `p5` is available as a global from the CDN script loaded before this module.
// All sketches read window.P5_AUDIO and window.VIZ_SETTINGS each frame.

function calcRMS(timeData) {
  if (!timeData) return 0;
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / timeData.length);
}

// ── Trail length → translucent fade wash ─────────────────────────────────────────
// The "Trail Length" slider writes VIZ_SETTINGS.fadeAlpha (0.005 "Long" .. 0.15 "None").
// We mirror visualizer.js's native fade: erase fraction = min(fadeAlpha*3, 1).
// NOTE: we MUST use a numeric HSB colour here, not a hex string. In HSB colorMode,
// `fill('#080808', alpha)` ignores the alpha and paints opaque — which is what made
// the noise/phase/kaleidoscope modes render nothing.
function trailFade(p, s, minFrac = 0) {
  const fa   = s?.fadeAlpha ?? 0.03;
  const frac = Math.max(Math.min(fa * 3, 1), minFrac);
  p.push();
  p.noStroke();
  p.fill(0, 0, 4, frac * 100);          // near-black wash, alpha 0..100
  p.rect(0, 0, p.width, p.height);
  p.pop();
}

// ── Noise Field ────────────────────────────────────────────────────────────────

function noiseFieldSketch(p) {
  const COUNT = 350;
  const pts   = [];
  let pulse   = 0;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0, 0, 4);
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

    // Trail length controls how long the flow streaks persist (floor keeps it from
    // whiting out — hundreds of additive lines accumulate fast).
    trailFade(p, s, 0.035);

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

// ── 3D Sphere — "Ball of Lightning" ──────────────────────────────────────────────
// A cage of great-circle rings at many orientations, each vertex jittered by the
// waveform so the whole sphere reads as a crackling 3D wave. Additive blending makes
// overlapping arcs glow white-hot where they cross. Always alive: a little jitter
// persists even in silence.

function sphereSketch(p) {
  let rotX  = 0.3;
  let rotY  = 0;
  let pulse = 0;
  const rings   = [];
  const RINGS   = 14;
  const SEG     = 84;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    for (let i = 0; i < RINGS; i++) {
      rings.push({
        ax:   p.random(p.PI),
        ay:   p.random(p.PI),
        az:   p.random(p.TWO_PI),
        spin: p.random(-0.6, 0.6),
        seed: p.random(1000),
        off:  Math.floor(p.random(2048)),  // waveform sampling offset per ring
      });
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
    const hue    = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;
    const len    = timeData ? timeData.length : 0;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.06);

    // Solid 3D object — clears each frame (trails don't apply in WEBGL depth).
    p.background(0, 0, 3);

    const base   = Math.min(p.width, p.height) * 0.22;
    const radius = base * (1 + pulse * 0.30 * react + energy * 0.35 * react);

    rotY += (0.003 + energy * 0.05) * react + 0.0015;
    rotX += 0.0012;
    p.rotateX(rotX + Math.sin(p.frameCount * 0.006) * 0.15);
    p.rotateY(rotY);

    // Additive glow — crossing arcs build bright electric cores.
    p.blendMode(p.ADD);
    p.noFill();

    // How hard the arcs crackle. A small constant keeps the ball alive in silence.
    const crackle = 0.12 + energy * 0.85 * react;

    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri];
      const rHue = (hue + ri * (360 / rings.length) * 0.5) % 360;

      p.push();
      p.rotateX(ring.ax);
      p.rotateY(ring.ay);
      p.rotateZ(ring.az + p.frameCount * 0.01 * ring.spin);

      // Two passes: fat faint halo, then thin bright core.
      for (let pass = 0; pass < 2; pass++) {
        const glow = pass === 0;
        p.strokeWeight(glow ? 3.5 + pulse * 3 : 1.1);
        p.stroke(rHue, glow ? 75 : 45, glow ? 65 : 100, glow ? 20 : 80);
        p.beginShape();
        for (let i = 0; i <= SEG; i++) {
          const a   = (i / SEG) * p.TWO_PI;
          const wav = len ? (timeData[(i * 11 + ring.off) % len] - 128) / 128 : 0;
          const jit = wav * radius * crackle * 0.5
                    + Math.sin(a * 5 + p.frameCount * 0.12 + ring.seed) * radius * 0.035;
          const rr  = radius + jit;
          p.vertex(Math.cos(a) * rr, Math.sin(a) * rr, 0);
        }
        p.endShape(p.CLOSE);
      }
      p.pop();
    }

    // Soft inner core so the ball has a glowing heart, not a hollow cage.
    p.push();
    p.noStroke();
    p.fill(hue, 40, 95, 6 + pulse * 22 + energy * 14);
    p.sphere(radius * 0.34, 18, 12);
    p.pop();

    p.blendMode(p.BLEND);
  };
}

// ── Grid Ripple ──────────────────────────────────────────────────────────────────
// A rippling mesh of dots. Each cell has a SMOOTHED height (temporal lerp) so nothing
// snaps frame-to-frame — that's what fixes the old "screen seizure". Beats spawn
// expanding rings, a slow travelling wave keeps it breathing, and per-column FFT
// energy adds detail. Faint mesh lines connect neighbours into an audio-reactive net.

function gridRippleSketch(p) {
  const COLS = 44;
  const ROWS = 28;
  let ripples = [];
  let field   = [];          // smoothed height per cell
  let bins    = null;        // smoothed per-column FFT energy

  const alloc = () => {
    field = [];
    for (let c = 0; c < COLS; c++) field.push(new Float32Array(ROWS));
    bins = new Float32Array(COLS);
  };

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0, 0, 4);
    alloc();
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

    // Trail length smears the moving wave into motion trails when set to "Long".
    trailFade(p, s, 0.10);

    const cellW = p.width  / (COLS - 1);
    const cellH = p.height / (ROWS - 1);
    const cx    = p.width  / 2;
    const cy    = p.height / 2;

    // Spawn a ring on each kick; advance + decay existing rings.
    if (beatInfo?.isKick) ripples.push({ r: 0, amp: 1, spd: 5 + energy * 11 });
    ripples = ripples.filter(rp => rp.amp > 0.02);
    for (const rp of ripples) { rp.r += rp.spd * cellW * 0.25; rp.amp *= 0.945; }

    // Smooth per-column FFT energy so bars don't flicker.
    const fLen = freqData ? freqData.length : 0;
    for (let c = 0; c < COLS; c++) {
      const bin = Math.floor((c / COLS) * (fLen ? fLen * 0.45 : 64));
      const fv  = fLen ? freqData[bin] / 255 : 0;
      bins[c]  += (fv - bins[c]) * 0.25;
    }

    const t = p.frameCount * 0.03;

    // Update the smoothed height field.
    for (let c = 0; c < COLS; c++) {
      const x = c * cellW;
      for (let r = 0; r < ROWS; r++) {
        const y    = r * cellH;
        const dist = Math.hypot(x - cx, y - cy);

        let ripH = 0;
        for (const rp of ripples) {
          const d = dist - rp.r;
          if (Math.abs(d) < 150) {
            ripH += Math.cos(d * 0.045) * rp.amp * (1 - Math.abs(d) / 150);
          }
        }

        const wave   = Math.sin(dist * 0.018 - t * 2) * (0.25 + energy * 1.1 * react);
        const target = ripH * 1.3 + wave + bins[c] * 1.4;
        field[c][r] += (target - field[c][r]) * 0.2;   // temporal smoothing
      }
    }

    const disp = cellH * (0.35 + energy * 0.55 * react);
    const yOf  = (c, r) => r * cellH - field[c][r] * disp;
    const xOf  = (c) => c * cellW;

    // Faint connecting mesh (single hue per polyline — cheap, gives structure).
    p.noFill();
    p.strokeWeight(1);
    p.stroke(hue, 55, 40, 22);
    for (let r = 0; r < ROWS; r++) {
      p.beginShape();
      for (let c = 0; c < COLS; c++) p.vertex(xOf(c), yOf(c, r));
      p.endShape();
    }
    for (let c = 0; c < COLS; c++) {
      p.beginShape();
      for (let r = 0; r < ROWS; r++) p.vertex(xOf(c), yOf(c, r));
      p.endShape();
    }

    // Bright nodes — size + colour driven by the smoothed height (no snapping).
    p.noStroke();
    for (let c = 0; c < COLS; c++) {
      const x = c * cellW;
      for (let r = 0; r < ROWS; r++) {
        const h    = field[c][r];
        const dist = Math.hypot(x - cx, r * cellH - cy);
        const mag  = Math.abs(h) + bins[c] * 0.8 + energy * 0.4;
        const size = Math.max(1.5, Math.min(cellW * 0.8, 2 + mag * cellW * 0.55 * react));
        const bri  = 45 + Math.min(55, mag * 55);
        const dHue = (hue + dist * 0.11) % 360;
        p.fill(dHue, 82, bri, 90);
        p.ellipse(x, yOf(c, r), size, size);
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
    p.background(0, 0, 4);
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

    // Phase space looks best with long trails — let the slider drive it fully.
    trailFade(p, s, 0);

    if (!timeData || timeData.length < 1024) return;
    const len = timeData.length;

    // Scale expands dramatically with loudness — the whole Lissajous shape breathes.
    const scale = Math.min(p.width, p.height) * 0.44 * (0.85 + energy * 0.8);
    const cx    = p.width  / 2;
    const cy    = p.height / 2;
    const sw    = 1.5 + energy * 5 * react + pulse * 3;
    const alpha = 82 + energy * 18;

    // Primary trace — full opacity, dynamic thickness.
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

    // Second trace — only visible when music is loud. Indices stay within [0,len).
    const alpha2 = energy * 60;
    if (alpha2 > 5) {
      p.stroke((hue + 120) % 360, 65, 85, alpha2);
      p.strokeWeight(sw * 0.6);
      p.beginShape();
      for (let i = 0; i < 512; i++) {
        const x = ((timeData[(i + 256) % len] / 255) * 2 - 1) * scale * 0.8;
        const y = ((timeData[(i + 640) % len] / 255) * 2 - 1) * scale * 0.8;
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
    p.background(0, 0, 4);
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

    // Continuous rotation driven by music loudness.
    rotOffset += (0.003 + energy * 0.025) * react;

    // Trail length controls how long the mirrored petals smear (floor avoids whiteout).
    trailFade(p, s, 0.04);

    if (!freqData) return;

    const tLen   = timeData ? timeData.length : 1;
    // maxR grows with energy, giving the kaleidoscope a breathing quality.
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

        // Mix FFT bars with raw waveform displacement.
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
