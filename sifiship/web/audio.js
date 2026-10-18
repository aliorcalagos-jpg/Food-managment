// Synthesized sound effects (no sound files) and haptics. `settings` is the saved game settings object,
// read on every call so the Sound and Vibration switches apply at once.
let audio = null;
let master = null;
let settings = { sound: true, vibrate: true };

export function bindSettings(s) {
  settings = s;
}

export function initAudio() {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain();
      master.gain.value = 0.35;
      master.connect(audio.destination);
    } catch {
      audio = null;
    }
  }
  if (audio && audio.state === "suspended") audio.resume();
}

export function tone(freq, dur, type = "square", vol = 0.3, slideTo = null, delay = 0) {
  if (!audio || !settings.sound) return;
  const t0 = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, vol = 0.3, freq = 900) {
  if (!audio || !settings.sound) return;
  if (!noiseBuf) {
    noiseBuf = audio.createBuffer(1, audio.sampleRate * 0.6, audio.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = noiseBuf;
  const f = audio.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(80, t0 + dur);
  const g = audio.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

let lastBoom = 0;
export const sfx = {
  pew: () => tone(1100 + Math.random() * 200, 0.07, "square", 0.07, 300),
  boom: () => {
    const now = performance.now();
    if (now - lastBoom < 60) return;
    lastBoom = now;
    noise(0.2, 0.22, 1400);
  },
  press: () => tone(260, 0.05, "sine", 0.2, 180),
  launch: () => {
    tone(160, 0.36, "sawtooth", 0.11, 980);
    noise(0.34, 0.09, 3200);
  },
  dock: () => {
    tone(520, 0.08, "triangle", 0.18, 780);
    noise(0.08, 0.06, 2000);
  },
  thunk: () => {
    tone(140, 0.1, "sine", 0.4, 70);
    noise(0.06, 0.15, 500);
  },
  warp: () => tone(300, 0.35, "sine", 0.14, 2400),
  error: () => {
    tone(220, 0.12, "square", 0.12);
    tone(160, 0.16, "square", 0.12, null, 0.12);
  },
  alarm: () => {
    tone(880, 0.14, "square", 0.06);
    tone(620, 0.14, "square", 0.06, null, 0.16);
  },
  combo: (m) => tone(500 + m * 120, 0.18, "triangle", 0.2, 900 + m * 200),
  hit: () => noise(0.25, 0.3, 600),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, "triangle", 0.22, null, i * 0.09)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.13, null, i * 0.16)),
  star: (i) => tone(880 + i * 220, 0.18, "triangle", 0.22, 1320 + i * 220),
  tick: () => tone(1500, 0.025, "square", 0.04),
  levelUp: () => {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, "triangle", 0.2, null, i * 0.08));
    tone(1568, 0.6, "sine", 0.15, 2093, 0.45);
  },
  unlock: () => tone(660, 0.12, "triangle", 0.2, 1320),
  gold: () => [988, 1319, 1760].forEach((f, i) => tone(f, 0.18, "triangle", 0.2, null, i * 0.06)),
  storm: () => {
    noise(0.7, 0.18, 2600);
    tone(90, 0.7, "sawtooth", 0.1, 380);
    tone(1200, 0.5, "sine", 0.07, 300, 0.1);
  },
  click: () => tone(700, 0.05, "triangle", 0.15),
};

export function buzz(kind) {
  if (!settings.vibrate) return;
  try {
    if (window.AndroidBridge) window.AndroidBridge.haptic(kind);
    else if (navigator.vibrate) navigator.vibrate(kind === "tick" ? 12 : 40);
  } catch {
    /* no haptics */
  }
}
