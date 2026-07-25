// p5.js-powered visualization modes.
// `p5` is available as a global from the CDN script loaded before this module.
// All sketches read window.P5_AUDIO and window.VIZ_SETTINGS each frame.

function noiseFieldSketch(p) {
  const COUNT = 350;
  const pts   = [];

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0);
    for (let i = 0; i < COUNT; i++) {
      pts.push({ x: p.random(p.width), y: p.random(p.height), px: 0, py: 0 });
    }
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { beatInfo } = audio;
    const s     = window.VIZ_SETTINGS ?? {};
    const bass  = beatInfo?.bass ?? 0;
    const react = s.reactivity ?? 0.7;
    const hue   = (window.VIZ_HUE ?? (p.frameCount * 0.4)) % 360;

    p.noStroke();
    p.fill(0, 0, 0, 8);
    p.rect(0, 0, p.width, p.height);

    const t     = p.frameCount * 0.003;
    const speed = (1.8 + bass * 5) * react;

    for (const pt of pts) {
      pt.px = pt.x;
      pt.py = pt.y;

      const angle = p.noise(pt.x / 700, pt.y / 700, t) * p.TWO_PI * 2.4;
      pt.x += Math.cos(angle) * speed;
      pt.y += Math.sin(angle) * speed;

      if (pt.x < 0 || pt.x > p.width)  { pt.x = p.random(p.width);  pt.px = pt.x; }
      if (pt.y < 0 || pt.y > p.height) { pt.y = p.random(p.height); pt.py = pt.y; }

      p.stroke((hue + p.noise(pt.x / 300, pt.y / 300) * 60) % 360, 75, 90, 65);
      p.strokeWeight(1.3);
      p.line(pt.px, pt.py, pt.x, pt.y);
    }
  };
}

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
    const { beatInfo } = audio;
    const s     = window.VIZ_SETTINGS ?? {};
    const bass  = beatInfo?.bass ?? 0;
    const mid   = beatInfo?.mid  ?? 0;
    const react = s.reactivity ?? 0.7;
    const hue   = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.05);

    p.background(0);

    const base   = Math.min(p.width, p.height) * 0.28;
    const radius = base + pulse * 50 * react + bass * 35 * react;
    rotY += (0.006 + mid * 0.016) * react;

    p.ambientLight(30);
    p.pointLight(
      p.color((hue + 130) % 360, 80, 100),
      350 * Math.cos(rotY * 0.7), -280, 300
    );
    p.pointLight(
      p.color(hue, 55, 85),
      -300, 220, 150
    );

    p.noStroke();
    p.fill(p.color(hue, 70, 80 + pulse * 20));
    p.rotateX(0.28 + Math.sin(p.frameCount * 0.009) * 0.12);
    p.rotateY(rotY);
    p.sphere(radius, 40, 28);
  };
}

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
    const { freqData, beatInfo } = audio;
    const s     = window.VIZ_SETTINGS ?? {};
    const react = s.reactivity ?? 0.7;
    const hue   = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    p.background(0);

    const cellW = p.width  / COLS;
    const cellH = p.height / ROWS;
    const cx    = p.width  / 2;
    const cy    = p.height / 2;

    if (beatInfo?.isKick) {
      ripples.push({ r: 0, amp: 1.0, spd: 3 + (beatInfo?.bass ?? 0) * 6 });
    }
    ripples = ripples.filter(r => r.amp > 0.02);
    for (const rp of ripples) { rp.r += rp.spd; rp.amp *= 0.935; }

    for (let col = 0; col < COLS; col++) {
      const x   = (col + 0.5) * cellW;
      const bin = Math.floor((col / COLS) * (freqData ? freqData.length * 0.45 : 64));
      const fv  = freqData ? freqData[bin] / 255 : 0;

      for (let row = 0; row < ROWS; row++) {
        const y    = (row + 0.5) * cellH;
        const dist = Math.hypot(x - cx, y - cy);

        let disp = 0;
        for (const rp of ripples) {
          if (dist < rp.r + 40) disp += Math.sin((dist - rp.r) * 0.11) * rp.amp;
        }

        const base = cellW * 0.15 + fv * cellW * 0.22 * react;
        const r    = Math.max(1.5, base + disp * cellW * 0.38 * react);
        const dHue = (hue + dist * 0.14) % 360;
        const brt  = 55 + fv * 40 + Math.abs(disp) * 35;

        p.fill(dHue, 80, Math.min(100, brt));
        p.ellipse(x, y, r * 2, r * 2);
      }
    }
  };
}

function phaseSpaceSketch(p) {
  let pulse = 0;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0);
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { timeData, beatInfo } = audio;
    const s     = window.VIZ_SETTINGS ?? {};
    const react = s.reactivity ?? 0.7;
    const hue   = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.05);

    p.noStroke();
    p.fill(0, 0, 0, 14);
    p.rect(0, 0, p.width, p.height);

    if (!timeData || timeData.length < 1024) return;

    const scale = Math.min(p.width, p.height) * 0.44;
    const cx    = p.width  / 2;
    const cy    = p.height / 2;
    const sw    = 1.4 + pulse * 2.5 * react;

    // Primary trace
    p.stroke(hue, 78, 95, 82);
    p.strokeWeight(sw);
    p.noFill();
    p.beginShape();
    for (let i = 0; i < 512; i++) {
      const x = ((timeData[i]       / 255) * 2 - 1) * scale;
      const y = ((timeData[i + 512] / 255) * 2 - 1) * scale;
      p.vertex(cx + x, cy + y);
    }
    p.endShape();

    // Second trace offset for depth
    p.stroke((hue + 120) % 360, 65, 85, 40);
    p.strokeWeight(sw * 0.6);
    p.beginShape();
    for (let i = 0; i < 512; i++) {
      const x = ((timeData[i + 256] / 255) * 2 - 1) * scale * 0.8;
      const y = ((timeData[i + 768] / 255) * 2 - 1) * scale * 0.8;
      p.vertex(cx + x, cy + y);
    }
    p.endShape();
  };
}

function kaleidoscopeSketch(p) {
  let pulse = 0;

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0);
  };

  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);

  p.draw = () => {
    const audio = window.P5_AUDIO;
    if (!audio) return;
    const { freqData, beatInfo } = audio;
    const s     = window.VIZ_SETTINGS ?? {};
    const react = s.reactivity ?? 0.7;
    const sym   = Math.max(2, s.symmetry ?? 6);
    const hue   = (window.VIZ_HUE ?? (p.frameCount * 0.3)) % 360;

    if (beatInfo?.isKick) pulse = 1;
    pulse = Math.max(0, pulse - 0.04);

    p.noStroke();
    p.fill(0, 0, 0, 16);
    p.rect(0, 0, p.width, p.height);

    if (!freqData) return;

    const maxR     = Math.min(p.width, p.height) * 0.44 + pulse * 28 * react;
    const innerR   = maxR * 0.08 + pulse * 10 * react;
    const sliceAng = p.TWO_PI / sym;
    const BARS     = 52;
    const bassE    = beatInfo?.bass ?? 0;

    for (let si = 0; si < sym; si++) {
      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.rotate(si * sliceAng);
      if (si % 2 === 1) p.scale(1, -1); // mirror alternate wedges

      for (let i = 0; i < BARS; i++) {
        const angle  = (i / BARS) * sliceAng - sliceAng / 2;
        const bin    = Math.floor((i / BARS) * freqData.length * 0.45);
        const mag    = (freqData[bin] / 255) * (maxR - innerR) * react + innerR + (maxR - innerR) * 0.08;
        const barHue = (hue + (i / BARS) * 180 + bassE * 60) % 360;

        p.stroke(barHue, 88, 95, 78);
        p.strokeWeight(1.6);
        p.line(
          Math.cos(angle) * innerR, Math.sin(angle) * innerR,
          Math.cos(angle) * mag,    Math.sin(angle) * mag
        );
      }
      p.pop();
    }
  };
}

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
