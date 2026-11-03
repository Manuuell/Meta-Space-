// META SPACE — Banda sonora de la cinemática.
//
// Compuesta para ella y tocada con sintetizadores de Web Audio: no hay
// muestras ni grabaciones, así que no tiene derechos de nadie más. Va a 120
// pulsos por minuto (medio segundo el pulso) y cada parte cae con su plano
// (los tiempos salen de cinematica-guion.ts):
//
// - Prólogo: calor seco en quintas; un acorde de luz al encender HELIOS y
//   campanas frías cuando el velo no se detiene.
// - Refugio: re menor y una caja de música; la llamada sube en la mayor.
// - Ares: re mayor tranquilo, colchón y arpegio.
// - HELIOS: un grave disonante (re contra mi bemol), tambores y su motivo en
//   metales: re, mi bemol, la.
// - La guerra: re menor a todo ritmo (re menor, si bemol, do, la).
// - Las ciudades: medio tiempo pesado; los tambores caen con los pisotones.
// - La caída: sin ritmo, una subida hasta el estallido y luego un pitido.
// - El especialista: una campana sola.
// - La llave: el tema de Noa en campanas, con el motivo de HELIOS que la busca.
// - Rumbo a Meta: fa, do, si bemol y la, que abre la misión.
// - La misión: re menor a todo ritmo hasta la ventana; al atravesar el cohete
//   el velo, re mayor y el arpegio de Ares hasta el final.
//
// La partitura es solo datos (las pruebas la leen en Node); `tocarBanda` la
// programa entera en el reloj del audio desde cualquier segundo.

import { ESTALLA, PLANOS, VENTANA, VUELVE_EL_SOL, en } from './cinematica-guion.ts';
import type { Plano } from './cinematica-guion.ts';

export type Voz =
  | 'pad' | 'arpa' | 'bajo' | 'metal' | 'campana' | 'zumbido'
  | 'bombo' | 'caja' | 'charles' | 'platillo' | 'tambor' | 'subida' | 'impacto' | 'pitido';

export interface Nota {
  /** Segundo de la cinemática en que empieza. */
  t: number;
  voz: Voz;
  dur: number;
  /** Alturas MIDI (60 = do central). Las percusiones van sin notas, salvo el tambor. */
  notas: readonly number[];
  vol: number;
}

/** Acordes por nombre, en MIDI. */
const RE = [38, 50, 54, 57, 64], SOL_RE = [38, 55, 59, 62], LA_SUS = [45, 57, 62, 64];
const REm = [50, 53, 57, 62], SIb = [46, 50, 53, 58], DO = [48, 52, 55, 60], LA = [45, 49, 52, 57];

function componer(): Nota[] {
  const p: Nota[] = [];
  const toca = (t: number, voz: Voz, dur: number, notas: readonly number[], vol: number) => p.push({ t, voz, dur, notas, vol });
  const arpegio = (desde: number, hasta: number, figuras: (t: number) => readonly number[], vol: (k: number) => number) => {
    for (let k = 0, t = desde; t < hasta - 0.01; k++, t += 0.25) toca(t, 'arpa', 0.45, [figuras(t)[k % 4]], vol(k));
  };
  /** Un segundo de un plano, para escribir cada parte desde su principio. */
  const de = (plano: Plano) => (s: number) => en(plano, s);

  // 0. Prólogo: calor seco; luz al encender HELIOS y el frío que llega después.
  const P = de('prologo');
  toca(P(0.2), 'zumbido', 3.4, [38, 45], 0.1);
  toca(P(0.2), 'pad', 3.3, [50, 57, 62, 69], 0.09);
  for (let k = 0, s = 0.6; s < 3.3; k++, s += 0.5) toca(P(s), 'arpa', 0.6, [[81, 76, 74, 76][k % 4]], 0.03);
  toca(P(3.4), 'metal', 1.2, [62, 66, 69], 0.08);
  toca(P(3.4), 'platillo', 2.0, [], 0.06);
  toca(P(3.5), 'pad', 2.2, [50, 54, 57, 62], 0.12);
  toca(P(5.6), 'pad', 2.4, [50, 53, 57, 62], 0.11);
  toca(P(5.6), 'tambor', 1.2, [33], 0.45);
  for (const [s, nota] of [[5.8, 74], [6.4, 72], [7.0, 69]] as const) toca(P(s), 'campana', 1.4, [nota], 0.06);

  // 1. Refugio: frío y una caja de música; la llamada sube.
  const R = de('refugio');
  toca(R(0), 'pad', 3.6, [38, 50, 53, 57], 0.1);
  toca(R(3.4), 'pad', 1.7, [34, 50, 53, 58], 0.1);
  for (let k = 0, s = 0.4; s < 4.8; k++, s += 0.5) toca(R(s), 'arpa', 0.7, [[74, 69, 65, 69, 72, 69, 65, 62][k % 8]], 0.04);
  toca(R(4.9), 'pad', 2.1, [45, 57, 61, 64], 0.11);
  toca(R(5.8), 'subida', 1.2, [], 0.08);

  // 2. Ares: re mayor, en calma.
  const A = de('ares');
  toca(A(0.1), 'pad', 2.1, RE, 0.14);
  toca(A(2.2), 'pad', 1.7, SOL_RE, 0.14);
  toca(A(3.8), 'pad', 1.2, LA_SUS, 0.14);
  arpegio(A(0.5), A(4.95), (t) => (t < A(2.2) ? [74, 69, 66, 69] : t < A(3.8) ? [74, 71, 67, 71] : [76, 69, 62, 69]), (k) => 0.055 + 0.03 * Math.min(1, k / 8));

  // 3. HELIOS abre el ojo: grave disonante, tambores y su motivo.
  const H = de('helios');
  toca(H(0), 'zumbido', 5.0, [26, 27, 38], 0.16);
  for (const [s, v] of [[0, 0.5], [2.0, 0.4], [3.0, 0.55], [4.0, 0.45], [4.5, 0.5], [4.75, 0.55]] as const) toca(H(s), 'tambor', 1.1, [38], v);
  toca(H(1.5), 'metal', 0.45, [62], 0.08);
  toca(H(2.0), 'metal', 0.45, [63], 0.08);
  toca(H(2.5), 'metal', 0.95, [57], 0.09);
  for (let s = 1.0; s < 4.95; s += 0.25) toca(H(s), 'bajo', 0.2, [38], 0.05 + 0.08 * ((s - 1) / 4));

  // 4. La guerra: re menor, si bemol, do y la, a todo ritmo.
  const G = de('guerra');
  const guerra = (s: number): readonly [number, readonly number[]] => (s < 2 ? [38, REm] : s < 4 ? [34, SIb] : s < 5 ? [36, DO] : [33, LA]);
  for (let k = 0, s = 0; s < 5.95; k++, s += 0.25) {
    const [raiz] = guerra(s);
    toca(G(s), 'bajo', 0.22, [k % 4 === 2 ? raiz + 12 : raiz], 0.13);
    toca(G(s), 'charles', 0.05, [], k % 2 ? 0.03 : 0.05);
    if (k % 2 === 0) toca(G(s), 'bombo', 0.35, [], 0.5);
    if (k % 4 === 2) toca(G(s), 'caja', 0.2, [], 0.28);
  }
  toca(G(0), 'pad', 2.0, REm, 0.07);
  toca(G(2), 'pad', 2.0, SIb, 0.07);
  toca(G(4), 'pad', 1.0, DO, 0.07);
  toca(G(5), 'pad', 1.0, LA, 0.08);
  for (const s of [0, 2, 4]) toca(G(s), 'platillo', 1.6, [], 0.07);
  for (const s of [0, 1, 2, 3, 4, 5, 5.5]) toca(G(s), 'metal', 0.35, guerra(s)[1].slice(1).map((n) => n + 12), 0.07);

  // 5. Las ciudades: medio tiempo; los tambores, con los pisotones del Titán.
  const C = de('ciudad');
  toca(C(0), 'pad', 4.0, [38, 50, 53, 57], 0.08);
  toca(C(0), 'platillo', 2.0, [], 0.08);
  for (const s of [0, 1, 2, 3]) toca(C(s), 'bombo', 0.4, [], 0.55);
  for (const s of [0.5, 1.5, 2.5]) toca(C(s), 'caja', 0.25, [], 0.3);
  for (const s of [1.15, 3.15]) toca(C(s), 'tambor', 1.3, [33], 0.6);
  for (const [s, quinta] of [[0, [50, 57]], [1, [46, 53]], [2, [43, 50]], [3, [45, 52]]] as const) {
    toca(C(s), 'metal', 0.9, quinta, 0.08);
    toca(C(s), 'bajo', 0.9, [quinta[0] - 12], 0.12);
  }
  // Redoble que se acelera hasta el corte.
  for (let k = 0, s = 3.4; s < 3.98; k++, s += Math.max(0.05, 0.12 - k * 0.012)) toca(C(s), 'caja', 0.12, [], 0.1 + k * 0.02);

  // 6. Cae Ares: sin ritmo; sube hasta el estallido y luego, el pitido.
  const K = de('caida');
  toca(K(0), 'zumbido', 3.0, [38, 39, 45], 0.12);
  toca(K(0.5), 'subida', 2.5, [], 0.2);
  for (const s of [0.5, 1.3, 1.95, 2.45, 2.75, 2.92]) toca(K(s), 'bombo', 0.3, [], 0.35 + (s - 0.5) * 0.08);
  toca(ESTALLA, 'impacto', 2.5, [], 0.6);
  toca(ESTALLA, 'platillo', 3.0, [], 0.12);
  toca(ESTALLA + 0.1, 'pitido', 1.4, [], 0.015);

  // 7. El último especialista: una campana sola.
  const E = de('especialista');
  toca(E(0), 'pad', 2.7, [50, 53, 57], 0.07);
  for (const [s, nota] of [[0.1, 69], [0.6, 65], [1.1, 64], [1.6, 62], [2.1, 57]] as const) toca(E(s), 'campana', 1.5, [nota], 0.08);

  // 8. La llave: el tema de Noa, con el motivo de HELIOS cuando la busca.
  const L = de('llave');
  toca(L(0), 'pad', 2.4, [50, 53, 57, 64], 0.11);
  toca(L(2.3), 'pad', 2.4, [46, 53, 57, 62], 0.11);
  toca(L(4.6), 'pad', 2.4, [43, 55, 58, 62], 0.11);
  for (const [s, nota] of [[0.4, 74], [0.9, 77], [1.4, 76], [2.4, 69], [3.4, 74], [3.9, 72], [4.4, 70], [5.4, 69], [6.1, 67]] as const) {
    toca(L(s), 'campana', 1.4, [nota], 0.055);
  }
  toca(L(3.1), 'metal', 0.4, [62], 0.05);
  toca(L(3.5), 'metal', 0.7, [63], 0.05);
  toca(L(3.1), 'tambor', 1.0, [38], 0.3);
  toca(L(6.0), 'subida', 0.9, [], 0.08);

  // 9. Rumbo a Meta: fa, do, si bemol y la, que abre la misión.
  const M = de('meta');
  toca(M(0), 'pad', 1.1, [41, 53, 57, 60], 0.13);
  toca(M(1), 'pad', 1.1, [36, 52, 55, 60], 0.13);
  toca(M(2), 'pad', 1.1, [34, 50, 53, 58], 0.14);
  toca(M(3), 'pad', 1.1, [33, 49, 52, 57], 0.14);
  arpegio(M(0.25), M(3.95), (t) => (t < M(1) ? [77, 72, 69, 72] : t < M(2) ? [76, 72, 67, 72] : t < M(3) ? [74, 70, 65, 70] : [76, 73, 69, 73]), (k) => 0.045 + 0.003 * k);

  // 10. La misión: re menor a todo ritmo hasta la ventana; con el sol, re mayor.
  const X = de('mision');
  const mision = (s: number): readonly [number, readonly number[]] => (s < 2 ? [38, REm] : s < 4 ? [34, SIb] : [36, DO]);
  for (let k = 0, s = 0; s < VENTANA - PLANOS.mision[0] - 0.05; k++, s += 0.25) {
    const [raiz] = mision(s);
    toca(X(s), 'bajo', 0.22, [k % 4 === 2 ? raiz + 12 : raiz], 0.12);
    toca(X(s), 'charles', 0.05, [], k % 2 ? 0.03 : 0.05);
    if (k % 2 === 0) toca(X(s), 'bombo', 0.35, [], 0.45);
    if (k % 4 === 2) toca(X(s), 'caja', 0.2, [], 0.25);
  }
  toca(X(0), 'pad', 2.0, REm, 0.08);
  toca(X(2), 'pad', 2.0, SIb, 0.08);
  toca(X(4), 'pad', 1.0, DO, 0.08);
  for (const s of [0, 1, 2, 3, 4, 4.5]) toca(X(s), 'metal', 0.35, mision(s)[1].slice(1).map((n) => n + 12), 0.065);
  toca(VENTANA, 'tambor', 1.4, [33], 0.6);
  toca(VENTANA, 'subida', VUELVE_EL_SOL - VENTANA, [], 0.2);
  toca(VUELVE_EL_SOL, 'impacto', 2.0, [], 0.4);
  toca(VUELVE_EL_SOL, 'platillo', 2.6, [], 0.1);
  toca(VUELVE_EL_SOL, 'metal', 1.6, [62, 66, 69, 74], 0.1);
  toca(VUELVE_EL_SOL, 'pad', PLANOS.mision[1] - VUELVE_EL_SOL + 0.6, [38, 50, 54, 57, 62, 66], 0.17);
  toca(VUELVE_EL_SOL, 'campana', 2.2, [74], 0.06);
  toca(VUELVE_EL_SOL, 'campana', 2.2, [78], 0.05);
  arpegio(VUELVE_EL_SOL + 0.25, PLANOS.mision[1] - 0.1, () => [78, 74, 69, 74], (k) => 0.05 + 0.002 * k);
  return p;
}

export const PARTITURA: readonly Nota[] = componer();

// ------------------------------------------------------------- instrumentos

interface Mesa {
  a: AudioContext;
  /** Va directo al compresor. */
  seco: AudioNode;
  /** Sala: una reverberación hecha de ruido que se apaga. */
  eco: AudioNode;
  ruido: AudioBuffer;
}

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function oscilador(m: Mesa, tipo: OscillatorType, f: number, t: number, fin: number, destino: AudioNode, desafino = 0) {
  const o = m.a.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = desafino;
  o.connect(destino);
  o.start(t);
  o.stop(fin + 0.05);
  return o;
}

function ruido(m: Mesa, t: number, dur: number, destino: AudioNode) {
  const s = m.a.createBufferSource();
  s.buffer = m.ruido;
  s.loop = true;
  s.connect(destino);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

function filtro(m: Mesa, tipo: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = m.a.createBiquadFilter();
  b.type = tipo;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

/** Volumen con ataque y caída: exponencial (golpes) o sostenido y suelta lineal (colchones). */
function envolvente(m: Mesa, t: number, ataque: number, dur: number, vol: number, sostenido = false): GainNode {
  const g = m.a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + ataque);
  if (sostenido) {
    g.gain.setValueAtTime(vol, Math.max(t + ataque, t + dur - Math.min(0.8, dur * 0.4)));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  return g;
}

function enviar(m: Mesa, nodo: AudioNode, eco: number) {
  nodo.connect(m.seco);
  if (eco <= 0) return;
  const e = m.a.createGain();
  e.gain.value = eco;
  nodo.connect(e).connect(m.eco);
}

const VOCES: Record<Voz, (m: Mesa, t: number, n: Nota) => void> = {
  // Colchón: dos sierras desafinadas por nota y un filtro que se abre.
  pad: (m, t, n) => {
    const g = envolvente(m, t, Math.min(0.6, n.dur * 0.3), n.dur, n.vol / n.notas.length, true);
    const f = filtro(m, 'lowpass', 600, 0.6);
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(1600, t + n.dur * 0.6);
    f.connect(g);
    for (const nota of n.notas) for (const d of [-7, 7]) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, f, d);
    enviar(m, g, 0.6);
  },
  // Arpa: pulsación corta de triángulo con su octava.
  arpa: (m, t, n) => {
    const g = envolvente(m, t, 0.005, n.dur, n.vol);
    const f = filtro(m, 'lowpass', 3200);
    f.connect(g);
    const octava = m.a.createGain();
    octava.gain.value = 0.3;
    octava.connect(f);
    oscilador(m, 'triangle', hz(n.notas[0]), t, t + n.dur, f);
    oscilador(m, 'sine', hz(n.notas[0]) * 2, t, t + n.dur, octava);
    enviar(m, g, 0.7);
  },
  // Bajo: sierra con el filtro que se cierra y una sinusoide una octava por debajo.
  bajo: (m, t, n) => {
    const g = envolvente(m, t, 0.01, n.dur, n.vol);
    const f = filtro(m, 'lowpass', 1200, 4);
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(260, t + n.dur * 0.7);
    f.connect(g);
    oscilador(m, 'sawtooth', hz(n.notas[0]), t, t + n.dur, f);
    oscilador(m, 'sine', hz(n.notas[0]) / 2, t, t + n.dur, g);
    enviar(m, g, 0.05);
  },
  // Metales: sierras con un filtro que se abre de golpe, como un ataque de trompas.
  metal: (m, t, n) => {
    const g = envolvente(m, t, 0.03, n.dur, n.vol / n.notas.length, true);
    const f = filtro(m, 'lowpass', 400, 2);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(900, t + n.dur);
    f.connect(g);
    for (const nota of n.notas) for (const d of [-9, 9]) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, f, d);
    enviar(m, g, 0.45);
  },
  // Campana: parciales que no son armónicos y se apagan a distinto ritmo.
  campana: (m, t, n) => {
    for (const [razon, peso, largo] of [[1, 1, 1], [2.76, 0.4, 0.5], [5.4, 0.15, 0.3]] as const) {
      const g = envolvente(m, t, 0.003, n.dur * largo, n.vol * peso);
      oscilador(m, 'sine', hz(n.notas[0]) * razon, t, t + n.dur, g);
      enviar(m, g, 0.8);
    }
  },
  // Zumbido: sierras graves muy filtradas que entran despacio.
  zumbido: (m, t, n) => {
    const g = envolvente(m, t, 1.0, n.dur, n.vol / n.notas.length, true);
    const f = filtro(m, 'lowpass', 280, 3);
    f.connect(g);
    for (const nota of n.notas) for (const d of [-5, 5]) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, f, d);
    enviar(m, g, 0.3);
  },
  bombo: (m, t, n) => {
    const g = envolvente(m, t, 0.002, 0.4, n.vol);
    const o = oscilador(m, 'sine', 150, t, t + 0.4, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const clic = envolvente(m, t, 0.001, 0.02, n.vol * 0.3);
    const f = filtro(m, 'highpass', 3000);
    f.connect(clic);
    ruido(m, t, 0.03, f);
    enviar(m, g, 0.08);
    enviar(m, clic, 0);
  },
  caja: (m, t, n) => {
    const g = envolvente(m, t, 0.001, 0.2, n.vol);
    const f = filtro(m, 'bandpass', 1900, 0.9);
    f.connect(g);
    ruido(m, t, 0.2, f);
    const cuerpo = envolvente(m, t, 0.001, 0.12, n.vol * 0.6);
    oscilador(m, 'triangle', 185, t, t + 0.12, cuerpo);
    enviar(m, g, 0.3);
    enviar(m, cuerpo, 0.2);
  },
  charles: (m, t, n) => {
    const g = envolvente(m, t, 0.001, 0.05, n.vol);
    const f = filtro(m, 'highpass', 7500);
    f.connect(g);
    ruido(m, t, 0.06, f);
    enviar(m, g, 0.1);
  },
  platillo: (m, t, n) => {
    const g = envolvente(m, t, 0.005, n.dur, n.vol);
    const f = filtro(m, 'highpass', 4500);
    f.connect(g);
    ruido(m, t, n.dur, f);
    enviar(m, g, 0.5);
  },
  // Tambor grande: tono que cae una octava, con un golpe de ruido grave.
  tambor: (m, t, n) => {
    const base = hz(n.notas[0] ?? 38);
    const g = envolvente(m, t, 0.005, n.dur, n.vol);
    const o = oscilador(m, 'sine', base * 2, t, t + n.dur, g);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.25);
    const golpe = envolvente(m, t, 0.001, 0.15, n.vol * 0.5);
    const f = filtro(m, 'lowpass', 700);
    f.connect(golpe);
    ruido(m, t, 0.15, f);
    enviar(m, g, 0.6);
    enviar(m, golpe, 0.4);
  },
  // Subida: ruido y una sierra que trepan hasta el estallido.
  subida: (m, t, n) => {
    const g = m.a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(n.vol, t + n.dur);
    g.gain.linearRampToValueAtTime(0.0001, t + n.dur + 0.04);
    const f = filtro(m, 'bandpass', 300, 4);
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(6000, t + n.dur);
    f.connect(g);
    ruido(m, t, n.dur, f);
    const sierra = m.a.createGain();
    sierra.gain.value = 0.4;
    const fs = filtro(m, 'lowpass', 2000);
    sierra.connect(fs).connect(g);
    const o = oscilador(m, 'sawtooth', 110, t, t + n.dur, sierra);
    o.frequency.exponentialRampToValueAtTime(880, t + n.dur);
    enviar(m, g, 0.4);
  },
  // Impacto: una sinusoide que se hunde hasta casi no oírse.
  impacto: (m, t, n) => {
    const g = envolvente(m, t, 0.005, n.dur, n.vol);
    const o = oscilador(m, 'sine', 95, t, t + n.dur, g);
    o.frequency.exponentialRampToValueAtTime(26, t + n.dur);
    enviar(m, g, 0.3);
  },
  // Pitido de oídos tras el estallido.
  pitido: (m, t, n) => {
    const g = envolvente(m, t, 0.05, n.dur, n.vol);
    oscilador(m, 'sine', 2600, t, t + n.dur, g);
    enviar(m, g, 0.2);
  },
};

function sala(a: AudioContext): AudioBuffer {
  const largo = Math.floor(a.sampleRate * 2.6);
  const b = a.createBuffer(2, largo, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 3.2;
  }
  return b;
}

function blanco(a: AudioContext): AudioBuffer {
  const b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/**
 * Programa la banda desde el segundo `desde` de la cinemática, que sonará en
 * el instante `cuando` del reloj del audio. Lo que ya empezó antes de `desde`
 * entra a mitad (los colchones) o se salta (los golpes). Devuelve con qué
 * pararla: `suave` la deja apagarse, como al final; si no, corta en seco.
 */
export function tocarBanda(a: AudioContext, desde: number, cuando: number): (suave: boolean) => void {
  const compresor = a.createDynamicsCompressor();
  compresor.threshold.value = -16;
  compresor.ratio.value = 4;
  compresor.attack.value = 0.005;
  compresor.release.value = 0.25;
  const maestro = a.createGain();
  maestro.gain.value = 0.85;
  compresor.connect(maestro).connect(a.destination);
  const eco = a.createConvolver();
  eco.buffer = sala(a);
  eco.connect(compresor);
  const mesa: Mesa = { a, seco: compresor, eco, ruido: blanco(a) };

  for (const n of PARTITURA) {
    const fin = n.t + n.dur;
    if (fin <= desde) continue;
    const golpe = n.voz !== 'pad' && n.voz !== 'zumbido';
    if (n.t < desde - 0.02 && golpe) continue;
    const empieza = Math.max(n.t, desde);
    VOCES[n.voz](mesa, cuando + (empieza - desde), empieza > n.t ? { ...n, dur: fin - empieza } : n);
  }

  return (suave) => {
    const ahora = a.currentTime;
    maestro.gain.cancelScheduledValues(ahora);
    maestro.gain.setValueAtTime(maestro.gain.value, ahora);
    maestro.gain.setTargetAtTime(0, ahora, suave ? 0.8 : 0.12);
    setTimeout(() => maestro.disconnect(), suave ? 5000 : 1500);
  };
}
