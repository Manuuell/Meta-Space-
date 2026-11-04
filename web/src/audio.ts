// Efectos sintetizados con Web Audio: osciladores y envolventes, ningún archivo.
// El navegador no deja sonar nada hasta el primer gesto del usuario, así que el
// contexto se crea perezosamente.

export type Sound = 'shot' | 'hit' | 'pulse' | 'pickup' | 'level' | 'hurt' | 'relic' | 'death' | 'kill' | 'jump' | 'guau' | 'zap' | 'aullido' | 'cura'
  | 'boom' | 'solar' | 'cofre' | 'carga' | 'critico' | 'sinChatarra'
  // Operadores: armas exclusivas y habilidades (R).
  | 'torreta' | 'llave' | 'sello' | 'disco' | 'semilla' | 'sobrecarga' | 'muro' | 'apagado' | 'salto' | 'jardin';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const last = new Map<Sound, number>();

// Cuánto tiempo mínimo entre dos sonidos iguales: una horda de 300 muertes en
// un segundo no puede sonar 300 veces.
const THROTTLE: Record<Sound, number> = {
  shot: 0.06, hit: 0.05, pulse: 0.1, pickup: 0.035, level: 0, hurt: 0.25, relic: 0, death: 0, kill: 0.04, jump: 0.15,
  guau: 0.25, zap: 0.08, aullido: 0, cura: 0,
  boom: 0.09, solar: 0.12, cofre: 0, carga: 0, critico: 0.07, sinChatarra: 0.3,
  torreta: 0.07, llave: 0.12, sello: 0.1, disco: 0.12, semilla: 0.12, sobrecarga: 0, muro: 0, apagado: 0, salto: 0, jardin: 0,
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

/** El contexto de audio, si ya hubo un gesto que lo permita. */
export function audioDelJuego() {
  return ctx;
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
    // ¡Guau!: dos golpes de voz que caen de tono.
    case 'guau':
      tone('square', 640, 300, 0.09, 0.09);
      tone('triangle', 520, 240, 0.12, 0.1, 0.03);
      break;
    case 'zap': tone('sawtooth', 1600, 500, 0.06, 0.05); break;
    case 'aullido': tone('triangle', 420, 760, 0.9, 0.09); tone('sine', 840, 1500, 0.9, 0.04); break;
    case 'cura': [660, 880, 1320].forEach((f, i) => tone('sine', f, f, 0.18, 0.08, i * 0.06)); break;
    // Explosión del mortero: golpe grave y un chasquido de chatarra.
    case 'boom': tone('sine', 110, 30, 0.4, 0.28); tone('square', 420, 80, 0.12, 0.06); break;
    // Lanza solar: un barrido agudo que cae como un rayo.
    case 'solar': tone('sawtooth', 2200, 300, 0.22, 0.06); tone('sine', 180, 50, 0.45, 0.22, 0.05); break;
    case 'cofre':
      tone('square', 300, 600, 0.12, 0.07);
      [660, 880, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.2, 0.09, 0.15 + i * 0.07));
      break;
    // Pilón cargado: un acorde que sube.
    case 'carga': [440, 554, 659, 880, 1109].forEach((f, i) => tone('sine', f, f * 1.02, 0.35, 0.09, i * 0.06)); break;
    case 'critico': tone('square', 1400, 900, 0.05, 0.05); break;
    case 'sinChatarra': tone('square', 200, 150, 0.12, 0.08); tone('square', 150, 110, 0.14, 0.08, 0.12); break;
    case 'torreta': tone('square', 1100, 700, 0.04, 0.035); break;
    case 'llave': tone('sawtooth', 160, 60, 0.14, 0.12); tone('square', 900, 300, 0.05, 0.05); break;
    case 'sello': tone('triangle', 520, 1040, 0.08, 0.06); tone('sine', 1560, 1560, 0.06, 0.03, 0.05); break;
    case 'disco': tone('sine', 300, 900, 0.18, 0.05); break;
    case 'semilla': tone('sine', 700, 1300, 0.06, 0.05); break;
    case 'sobrecarga': [220, 330, 440, 660, 880].forEach((f, i) => tone('sawtooth', f, f * 1.5, 0.22, 0.05, i * 0.05)); break;
    case 'muro': tone('square', 90, 50, 0.5, 0.22); tone('sawtooth', 300, 120, 0.3, 0.08, 0.05); break;
    case 'apagado': tone('sine', 1400, 90, 0.6, 0.18); tone('square', 2400, 600, 0.12, 0.04); break;
    case 'salto': tone('sawtooth', 200, 2400, 0.25, 0.06); tone('square', 2400, 300, 0.2, 0.04, 0.3); break;
    case 'jardin': [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.4, 0.07, i * 0.08)); break;
  }
}
