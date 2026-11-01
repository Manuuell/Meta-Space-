// Efectos sintetizados con Web Audio: osciladores y envolventes, ningún archivo.
// El navegador no deja sonar nada hasta el primer gesto del usuario, así que el
// contexto se crea perezosamente.

type Sound = 'shot' | 'hit' | 'pulse' | 'pickup' | 'level' | 'hurt' | 'relic' | 'death' | 'kill' | 'jump';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const last = new Map<Sound, number>();

// Cuánto tiempo mínimo entre dos sonidos iguales: una horda de 300 muertes en
// un segundo no puede sonar 300 veces.
const THROTTLE: Record<Sound, number> = {
  shot: 0.06, hit: 0.05, pulse: 0.1, pickup: 0.035, level: 0, hurt: 0.25, relic: 0, death: 0, kill: 0.04, jump: 0.15,
};

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

function tone(type: OscillatorType, from: number, to: number, duration: number, volume: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function sfx(sound: Sound) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - (last.get(sound) ?? -1) < THROTTLE[sound]) return;
  last.set(sound, now);

  switch (sound) {
    case 'shot': tone('sawtooth', 880, 440, 0.07, 0.08); break;
    case 'hit': tone('square', 220, 110, 0.05, 0.05); break;
    case 'kill': tone('triangle', 300, 90, 0.09, 0.08); break;
    case 'pulse': tone('sine', 140, 40, 0.35, 0.3); tone('sawtooth', 600, 1200, 0.12, 0.05); break;
    case 'pickup': tone('sine', 1200 + Math.random() * 300, 1800, 0.05, 0.06); break;
    case 'hurt': tone('square', 160, 60, 0.18, 0.15); break;
    case 'level':
      [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.16, 0.12, i * 0.07));
      break;
    case 'relic':
      [392, 523, 659, 784, 1046].forEach((f, i) => tone('sine', f, f * 1.01, 0.4, 0.1, i * 0.09));
      break;
    case 'death': tone('sawtooth', 300, 30, 1.2, 0.25); break;
    case 'jump': tone('square', 280, 620, 0.12, 0.08); break;
  }
}
