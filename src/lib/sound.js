/**
 * Фирменные звуки Flow — короткие «блипы» на WebAudio (без ассетов).
 */

let ctx = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, { t0 = 0, dur = 0.09, type = 'sine', gain = 0.12, slide = null } = {}) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  const start = c.currentTime + t0;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export const sound = {
  enabled: true,
  start() {
    if (!this.enabled) return;
    tone(660, { dur: 0.08 });
    tone(990, { t0: 0.07, dur: 0.1 });
  },
  stop() {
    if (!this.enabled) return;
    tone(740, { dur: 0.07 });
    tone(494, { t0: 0.06, dur: 0.12 });
  },
  success() {
    if (!this.enabled) return;
    tone(523, { dur: 0.07 });
    tone(659, { t0: 0.06, dur: 0.07 });
    tone(784, { t0: 0.12, dur: 0.14 });
  },
  error() {
    if (!this.enabled) return;
    tone(220, { dur: 0.18, type: 'sawtooth', gain: 0.08, slide: 140 });
  },
  tick() {
    if (!this.enabled) return;
    tone(1200, { dur: 0.03, gain: 0.05 });
  },
};
