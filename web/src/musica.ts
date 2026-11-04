// META SPACE — Banda sonora de la intro y de la cinemática.
//
// Compuesta para ella y tocada con sintetizadores de Web Audio: no hay
// muestras ni grabaciones, así que no tiene derechos de nadie más. Va a 120
// pulsos por minuto (medio segundo el pulso) y cada parte cae con su plano
// (los tiempos salen de cinematica-guion.ts).
//
// Tres temas cuentan la historia:
// - El tema de Meta, una melodía de ocho compases. Suena frágil en la caja de
//   música del refugio, heroico en mayor cuando Ares responde, roto en una
//   campana tras la caída y entero, con orquesta y coro, cuando vuelve el sol.
// - El motivo de HELIOS: re, mi bemol y la. En la batalla se come al de Meta.
// - El tema de ADA, en campanas: abre la cinemática y crece cuando se presenta.
//
// La intro del título tiene su propia partitura: las letras tocan el principio
// del tema de Meta, el acorde del título lo resuelve y, mientras la nave espera,
// la caja de música lo repite ya en mayor.
//
// La partitura es solo datos (las pruebas la leen en Node); `tocarBanda` y
// `tocarIntro` la programan poco a poco en el reloj del audio desde cualquier segundo.

import { ESTALLA, INTRO, PLANOS, VENTANA, VUELVE_EL_SOL, en } from './cinematica-guion.ts';
import type { Plano } from './cinematica-guion.ts';

export type Voz =
  | 'pad' | 'cuerdas' | 'cortas' | 'coro' | 'trompa' | 'metal' | 'arpa' | 'cajita' | 'campana' | 'bajo' | 'zumbido'
  | 'bombo' | 'caja' | 'charles' | 'platillo' | 'platilloInverso' | 'tambor' | 'timbal' | 'gong' | 'subida' | 'impacto' | 'pitido'
  | 'estatica' | 'tic';

export interface Nota {
  /** Segundo de la cinemática en que empieza. */
  t: number;
  voz: Voz;
  dur: number;
  /** Alturas MIDI (60 = do central). Las percusiones van sin notas, salvo el tambor y el timbal. */
  notas: readonly number[];
  vol: number;
  /** Posición en estéreo: de -1 (izquierda) a 1 (derecha). */
  pan: number;
}

const PULSO = 0.5;

/** Acordes por nombre, en MIDI. */
const RE = [38, 50, 54, 57, 62], SOL_M = [43, 55, 59, 62], LA_M = [45, 52, 57, 61], SI_m = [47, 54, 59, 62];
const REm = [38, 50, 53, 57], SIb = [34, 50, 53, 58], DO = [36, 48, 52, 55], LA = [33, 45, 49, 52];
const SOLm = [43, 50, 55, 58], LAm = [45, 52, 57, 60], FA = [41, 53, 57, 60];

type Melodia = readonly (readonly [number, number])[];

/** Tema de Meta, ocho compases: [nota, pulsos]. La tercera, la sexta y la séptima cambian con el modo. */
function temaDeMeta(mayor: boolean): { a: Melodia; b: Melodia } {
  const fa = mayor ? 66 : 65, si = mayor ? 71 : 70, sensible = mayor ? 73 : 72;
  return {
    a: [[62, 1.5], [64, 0.5], [fa, 2], [69, 1], [67, 1], [64, 2], [fa, 1.5], [67, 0.5], [69, 1], [si, 1], [69, 4]],
    b: [[74, 1.5], [sensible, 0.5], [69, 2], [si, 1], [69, 1], [fa, 2], [67, 1], [fa, 1], [64, 1], [57, 1], [62, 4]],
  };
}

/** Los primeros `pulsos` de una melodía, con la última nota recortada para caber. */
function hasta(m: Melodia, pulsos: number): Melodia {
  const fuera: (readonly [number, number])[] = [];
  let total = 0;
  for (const [nota, p] of m) {
    if (total >= pulsos) break;
    fuera.push([nota, Math.min(p, pulsos - total)]);
    total += p;
  }
  return fuera;
}

/** Lo necesario para escribir una partitura; las notas se van guardando en `p`. */
function compositor() {
  const p: Nota[] = [];
  const toca = (t: number, voz: Voz, dur: number, notas: readonly number[], vol: number, pan = 0) => p.push({ t, voz, dur, notas, vol, pan });
  /** Una melodía desde un segundo. El 0 es silencio; `liga` alarga cada nota para que se toquen. */
  const frase = (t0: number, voz: Voz, m: Melodia, vol: number, transporte = 0, pan = 0, liga = 1.1) => {
    let t = t0;
    for (const [nota, pulsos] of m) {
      if (nota) toca(t, voz, pulsos * PULSO * liga, [nota + transporte], vol, pan);
      t += pulsos * PULSO;
    }
  };
  const arpegio = (desde: number, hasta_: number, figuras: (t: number) => readonly number[], vol: (k: number) => number) => {
    for (let k = 0, t = desde; t < hasta_ - 0.01; k++, t += 0.25) toca(t, 'arpa', 0.5, [figuras(t)[k % 4]], vol(k), k % 2 ? 0.35 : -0.35);
  };
  /** Cuerdas cortas en semicorcheas: la figura va sobre la nota `raiz`. */
  const ostinato = (t0: number, raiz: number, pulsos: number, vol: number) => {
    const figura = [0, 0, 3, 0, 5, 0, 3, 7];
    for (let k = 0; k < pulsos * 4; k++) toca(t0 + k * 0.125, 'cortas', 0.13, [raiz + figura[k % 8]], vol * (k % 4 === 0 ? 1.25 : 0.85), k % 2 ? 0.4 : -0.4);
  };
  return { p, toca, frase, arpegio, ostinato };
}

function componer(): Nota[] {
  const { p, toca, frase, arpegio, ostinato } = compositor();
  /** Un segundo de un plano, para escribir cada parte desde su principio. */
  const de = (plano: Plano) => (s: number) => en(plano, s);
  const menor = temaDeMeta(false), mayor = temaDeMeta(true);

  // 0. La señal: radio rota y el tema de ADA, una nota por latido.
  const S = de('senal');
  toca(S(0), 'estatica', 4, [], 0.05);
  toca(S(0.1), 'zumbido', 3.9, [38, 45], 0.06);
  toca(S(0.2), 'pad', 3.8, [50, 57, 65], 0.035);
  for (const [s, nota] of [[0.32, 74], [1.57, 77], [2.82, 76]] as const) toca(S(s), 'campana', 2.4, [nota], 0.09, s > 2 ? 0.2 : -0.2);
  toca(S(2.5), 'platilloInverso', 1.5, [], 0.1);

  // 1. Meta arde: quintas graves y cuerdas tensas; un acorde de luz al encender
  // HELIOS y el mismo acorde en menor cuando el velo no se detiene.
  const P = de('prologo');
  toca(P(0), 'zumbido', 3.6, [38, 45], 0.12);
  toca(P(0), 'cuerdas', 3.5, [50, 57, 62, 69], 0.1);
  toca(P(0.4), 'coro', 3.0, [50, 57], 0.06);
  for (const [s, nota, v] of [[0, 38, 0.3], [1, 38, 0.22], [2, 45, 0.28], [2.5, 38, 0.22], [3, 45, 0.34]] as const) toca(P(s), 'timbal', 0.9, [nota], v);
  for (let k = 0, s = 0.5; s < 3.3; k++, s += 0.5) toca(P(s), 'arpa', 0.7, [[81, 76, 74, 76][k % 4]], 0.03, k % 2 ? 0.5 : -0.5);
  toca(P(3.4), 'impacto', 1.4, [], 0.28);
  toca(P(3.4), 'metal', 1.5, [62, 66, 69, 74], 0.11);
  toca(P(3.4), 'coro', 2.3, [62, 69, 74, 78], 0.12);
  toca(P(3.4), 'cuerdas', 2.3, [50, 62, 66, 69], 0.13);
  toca(P(3.4), 'platillo', 2.2, [], 0.07);
  toca(P(5.6), 'cuerdas', 2.5, [50, 53, 57, 62], 0.13);
  toca(P(5.6), 'coro', 2.4, [62, 65, 69], 0.08);
  toca(P(5.6), 'tambor', 1.2, [33], 0.45);
  frase(P(5.6), 'trompa', [[62, 1], [63, 1], [57, 2.5]], 0.09);
  for (const [s, nota] of [[6.8, 74], [7.2, 72], [7.6, 69]] as const) toca(P(s), 'campana', 1.4, [nota], 0.05, 0.3);

  // 2. Pasan dos siglos: un reloj que se va frenando y la armonía que baja.
  const N = de('anos');
  for (let k = 0, s = 0.1; s < 5.6; k++, s += 0.2 + k * 0.022) toca(N(s), 'tic', 0.05, [], 0.09, k % 2 ? 0.3 : -0.3);
  for (const [s, acorde] of [[0, REm], [1.5, SIb], [3, SOLm], [4.5, LA]] as const) {
    toca(N(s), 'cuerdas', 1.7, acorde, 0.12);
  }
  frase(N(0), 'trompa', [[69, 3], [67, 3], [65, 3], [64, 3]], 0.07);
  toca(N(4.5), 'tambor', 1.2, [33], 0.3);

  // 3. Refugio: el tema de Meta, frágil, en una caja de música.
  const R = de('refugio');
  for (const [s, dur, acorde] of [[0, 2, REm], [2, 2, LAm], [4, 2, SIb], [6, 1.1, LA]] as const) {
    toca(R(s), 'pad', dur + 0.1, acorde, 0.085);
  }
  frase(R(0.1), 'cajita', hasta(menor.a, 13.5), 0.09, 12, 0, 1.6);
  toca(R(5.8), 'subida', 1.2, [], 0.07);
  toca(R(6), 'cuerdas', 1.05, [57, 61, 64, 69], 0.08);

  // 4. Ares: el mismo tema, en mayor y a pleno pulmón.
  const A = de('ares');
  for (const [s, dur, acorde] of [[0, 2, RE], [2, 2, LA_M], [4, 1.5, SOL_M]] as const) {
    toca(A(s), 'cuerdas', dur + 0.1, acorde, 0.16);
    toca(A(s), 'timbal', 0.9, [s === 2 ? 45 : 38], 0.3);
    toca(A(s), 'bajo', dur, [acorde[0]], 0.09);
  }
  const heroico = hasta(mayor.a, 11);
  frase(A(0), 'trompa', heroico, 0.13, 0, -0.2);
  frase(A(0), 'cuerdas', heroico, 0.08, 12, 0.2);
  arpegio(A(0.5), A(5.4), (t) => (t < A(2) ? [74, 69, 66, 69] : t < A(4) ? [73, 69, 64, 69] : [74, 71, 67, 71]), (k) => 0.04 + 0.03 * Math.min(1, k / 8));
  toca(A(4.4), 'platilloInverso', 1.1, [], 0.12);

  // 5. HELIOS: corte a un grave disonante; su motivo en metales, dos veces.
  const H = de('helios');
  toca(H(0), 'zumbido', 5.5, [26, 27, 38], 0.13);
  toca(H(0.4), 'impacto', 2.2, [], 0.45);
  toca(H(1.1), 'tambor', 1.5, [33], 0.5);
  toca(H(1.1), 'coro', 4.3, [50, 51, 57], 0.09);
  frase(H(1.1), 'metal', [[50, 1], [51, 1], [45, 3]], 0.11);
  toca(H(2.95), 'tambor', 1.5, [33], 0.5);
  frase(H(2.95), 'metal', [[62, 1], [63, 1], [57, 2]], 0.11);
  frase(H(2.95), 'trompa', [[50, 1], [51, 1], [45, 2]], 0.09);
  for (let s = 3.5; s < 5.45; s += 0.25) toca(H(s), 'timbal', 0.3, [38], 0.14 + 0.2 * ((s - 3.5) / 2));
  toca(H(4.6), 'platilloInverso', 0.9, [], 0.14);

  // 6. La batalla: el tema de Meta en trompas contra el motivo de HELIOS, que
  // acaba tapándolo cuando caen las naves.
  const G = de('guerra');
  const guerra = (s: number): readonly [number, readonly number[]] => (s < 2 ? [38, REm] : s < 4 ? [34, SIb] : s < 5 ? [36, DO] : [33, LA]);
  for (let k = 0, s = 0; s < 5.95; k++, s += 0.25) {
    const [raiz] = guerra(s);
    toca(G(s), 'bajo', 0.22, [k % 4 === 2 ? raiz + 12 : raiz], 0.13);
    toca(G(s), 'charles', 0.05, [], k % 2 ? 0.03 : 0.05, 0.3);
    if (k % 2 === 0) toca(G(s), 'bombo', 0.35, [], 0.5);
    if (k % 4 === 2) toca(G(s), 'caja', 0.2, [], 0.3);
  }
  for (const [s, dur, raiz] of [[0, 2, 50], [2, 2, 46], [4, 1, 48], [5, 1, 45]] as const) {
    ostinato(G(s), raiz + 12, dur * 2, 0.085);
    toca(G(s), 'timbal', 0.8, [s === 2 ? 46 : s === 4 ? 48 : s === 5 ? 45 : 50], 0.32);
    toca(G(s), 'coro', dur, guerra(s)[1].slice(1), 0.06);
    toca(G(s), 'cuerdas', dur, guerra(s)[1], 0.1);
  }
  for (const s of [0, 2, 4]) toca(G(s), 'platillo', 1.6, [], 0.07);
  frase(G(0), 'trompa', hasta(menor.a, 8), 0.17, 12, -0.15);
  frase(G(0), 'trompa', hasta(menor.a, 8), 0.12, 0, 0.15);
  frase(G(4), 'metal', [[74, 1], [75, 1], [69, 2]], 0.13);
  frase(G(4), 'metal', [[50, 1], [51, 1], [45, 2]], 0.14);
  frase(G(4), 'trompa', [[62, 1], [63, 1], [57, 2]], 0.1);

  // 7. Las ciudades: medio tiempo; los tambores caen con los pisotones del Titán.
  const C = de('ciudad');
  toca(C(0), 'cuerdas', 4.4, [38, 50, 53, 57], 0.09);
  toca(C(0), 'coro', 4.4, [50, 57, 62], 0.07);
  toca(C(0), 'platillo', 2.0, [], 0.08);
  for (const s of [0, 1, 2, 3, 4]) toca(C(s), 'bombo', 0.4, [], 0.55);
  for (const s of [0.5, 1.5, 2.5, 3.5]) toca(C(s), 'caja', 0.25, [], 0.3);
  for (const s of [1.15, 3.15]) {
    toca(C(s), 'tambor', 1.3, [33], 0.65);
    toca(C(s), 'gong', 1.4, [33], 0.14);
  }
  for (const [s, quinta] of [[0, [50, 57]], [1, [46, 53]], [2, [43, 50]], [3, [45, 52]]] as const) {
    toca(C(s), 'metal', 0.9, quinta, 0.1);
    toca(C(s), 'bajo', 0.9, [quinta[0] - 12], 0.13);
  }
  frase(C(0), 'trompa', [[38, 2], [39, 2], [33, 4]], 0.1);
  // Redoble que se acelera hasta el corte.
  for (let k = 0, s = 3.6; s < 4.45; k++, s += Math.max(0.05, 0.13 - k * 0.012)) toca(C(s), 'caja', 0.12, [], 0.1 + k * 0.016, k % 2 ? 0.25 : -0.25);

  // 8. Cae Ares: todo sube, medio segundo de silencio y el golpe.
  const K = de('caida');
  toca(K(0), 'zumbido', 2.5, [38, 39, 45], 0.13);
  toca(K(0.3), 'subida', 2.15, [], 0.22);
  toca(K(0.3), 'platilloInverso', 2.15, [], 0.15);
  toca(K(0.3), 'coro', 2.2, [62, 63, 69], 0.1);
  toca(K(0.3), 'cuerdas', 2.2, [50, 51, 57, 62], 0.12);
  for (const s of [0.5, 1.3, 1.85, 2.15, 2.3, 2.4]) toca(K(s), 'bombo', 0.28, [], 0.35 + (s - 0.5) * 0.1);
  toca(ESTALLA, 'impacto', 3.6, [], 0.8);
  toca(ESTALLA, 'gong', 3.6, [38], 0.42);
  toca(ESTALLA, 'tambor', 1.7, [33], 0.75);
  toca(ESTALLA, 'platillo', 3.0, [], 0.14);
  toca(ESTALLA + 0.1, 'pitido', 3.3, [], 0.016);
  toca(ESTALLA + 0.5, 'coro', 1.6, [62, 65, 69], 0.05);

  // 9. Lo que queda: el tema de Meta, roto, en una campana sola.
  const E = de('especialista');
  toca(E(0), 'pad', 3.5, [50, 53, 57], 0.055);
  frase(E(0.2), 'campana', [[62, 1.5], [64, 0.5], [65, 2], [0, 1], [69, 1], [67, 1.5]], 0.09, 12, 0, 2.2);

  // 10. ADA: su tema en campanas; crece al presentarse y HELIOS la acecha.
  const L = de('llave');
  for (const [s, dur, acorde] of [[0, 2.5, REm], [2.5, 2.4, SIb], [4.9, 2.4, SOLm], [7.3, 1.7, FA], [9, 1, LA]] as const) {
    if (s < 2.5) toca(L(s), 'pad', dur + 0.1, acorde, 0.09);
    else toca(L(s), 'cuerdas', dur + 0.1, acorde, 0.08 + s * 0.008);
    if (s >= 4.9) toca(L(s), 'coro', dur + 0.1, acorde.slice(1), 0.07);
  }
  for (const [s, nota] of [[0.4, 74], [0.9, 77], [1.4, 76], [2.5, 69], [3.4, 74], [3.9, 72], [4.4, 70], [4.9, 69], [5.9, 67], [7.3, 72], [7.8, 77], [8.3, 76], [8.8, 72]] as const) {
    toca(L(s), 'campana', 1.6, [nota], 0.07, nota % 2 ? 0.3 : -0.3);
  }
  toca(L(2.5), 'gong', 2.2, [50], 0.1);
  for (let k = 0; k < 8; k++) toca(L(2.5 + k * 0.07), 'arpa', 0.9, [[62, 65, 69, 74, 77, 81, 86, 89][k]], 0.05, k % 2 ? 0.4 : -0.4);
  frase(L(5.2), 'metal', [[50, 0.8], [51, 0.8], [45, 2]], 0.08);
  toca(L(5.2), 'tambor', 1.0, [38], 0.32);
  frase(L(7.3), 'trompa', [[65, 1], [69, 1], [72, 2]], 0.08);
  toca(L(9.1), 'subida', 0.9, [], 0.09);

  // 11. Rumbo a Meta: fa, do, si bemol y la, cada vez con más pulso.
  const M = de('meta');
  for (const [s, dur, acorde, ajuste] of [[0, 1.1, FA, 0], [1.1, 1.1, [36, 52, 55, 60], 0], [2.2, 1.1, SIb, 0], [3.3, 1.2, LA, 0.02]] as const) {
    toca(M(s), 'cuerdas', dur + 0.1, acorde, 0.15 + ajuste);
    toca(M(s), 'timbal', 0.8, [acorde[0] + 12], 0.2 + s * 0.05);
  }
  arpegio(M(0.25), M(4.4), (t) => (t < M(1.1) ? [77, 72, 69, 72] : t < M(2.2) ? [76, 72, 67, 72] : t < M(3.3) ? [74, 70, 65, 70] : [76, 73, 69, 73]), (k) => 0.045 + 0.003 * k);
  for (let s = 2.2; s < 4.45; s += 0.125) toca(M(s), 'cortas', 0.12, [s < 3.3 ? 58 : 57], 0.03 + (s - 2.2) * 0.012);
  toca(M(3.4), 'platilloInverso', 1.1, [], 0.12);

  // 12. La misión: el tema de Meta en menor, a todo ritmo, hasta la ventana.
  const X = de('mision');
  const hastaVentana = VENTANA - PLANOS.mision[0];
  const mision = (s: number): readonly [number, readonly number[]] => (s < 2 ? [38, REm] : s < 4 ? [34, SIb] : [36, DO]);
  for (let k = 0, s = 0; s < hastaVentana - 0.05; k++, s += 0.25) {
    const [raiz] = mision(s);
    toca(X(s), 'bajo', 0.22, [k % 4 === 2 ? raiz + 12 : raiz], 0.12);
    toca(X(s), 'charles', 0.05, [], k % 2 ? 0.03 : 0.05, 0.3);
    if (k % 2 === 0) toca(X(s), 'bombo', 0.35, [], 0.45);
    if (k % 4 === 2) toca(X(s), 'caja', 0.2, [], 0.26);
  }
  for (const [s, pulsos, raiz] of [[0, 4, 50], [2, 4, 46], [4, 3, 48]] as const) {
    ostinato(X(s), raiz + 12, pulsos, 0.075);
    toca(X(s), 'cuerdas', pulsos * PULSO, mision(s)[1], 0.075);
    toca(X(s), 'timbal', 0.8, [raiz], 0.28);
  }
  frase(X(0), 'trompa', hasta(menor.a, 11), 0.13, 12, -0.15);
  frase(X(0), 'cuerdas', hasta(menor.a, 11), 0.06, 12, 0.2);

  // El despegue: redoble y escala que suben hasta romper el velo.
  toca(VENTANA, 'tambor', 1.4, [33], 0.6);
  toca(VENTANA, 'subida', VUELVE_EL_SOL - VENTANA - 0.05, [], 0.2);
  toca(VENTANA, 'platilloInverso', VUELVE_EL_SOL - VENTANA - 0.02, [], 0.14);
  toca(VENTANA, 'cuerdas', 1.95, LA_M, 0.14);
  toca(VENTANA, 'coro', 1.95, [57, 61, 64, 69], 0.08);
  for (let k = 0; k < 32; k++) toca(VENTANA + k * 0.0625, 'timbal', 0.12, [45], 0.1 + k * 0.007, k % 2 ? 0.2 : -0.2);
  const escala = [62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86, 88];
  escala.forEach((nota, k) => toca(VENTANA + k * 0.125, 'cortas', 0.16, [nota], 0.05 + k * 0.002, k % 2 ? 0.3 : -0.3));

  // Vuelve el sol: el tema entero en mayor, con toda la orquesta y el coro.
  const SOL = VUELVE_EL_SOL, FIN = PLANOS.mision[1];
  toca(SOL, 'impacto', 2.4, [], 0.42);
  toca(SOL, 'gong', 3.0, [38], 0.2);
  toca(SOL, 'tambor', 1.4, [38], 0.5);
  toca(SOL, 'platillo', 2.8, [], 0.11);
  const final: Melodia = [[74, 1.5], [73, 0.5], [69, 2], [71, 1], [69, 1], [66, 2], [67, 1], [69, 1], [62, 4]];
  frase(SOL, 'trompa', final, 0.22, 0, -0.15);
  frase(SOL, 'trompa', final, 0.16, 12, 0.15);
  frase(SOL, 'cuerdas', final, 0.13, 12, 0.15);
  frase(SOL, 'metal', final, 0.09, -12);
  for (const [s, dur, acorde] of [[0, 2, RE], [2, 1, SI_m], [3, 1, RE], [4, 0.5, SOL_M], [4.5, 0.5, LA_M]] as const) {
    toca(SOL + s, 'cuerdas', dur + 0.1, acorde, 0.2);
    toca(SOL + s, 'coro', dur + 0.1, acorde.slice(1), 0.15);
    toca(SOL + s, 'bajo', dur, [acorde[0]], 0.14);
    toca(SOL + s, 'timbal', 0.7, [acorde[0] + 12 > 50 ? acorde[0] : acorde[0] + 12], 0.34);
  }
  for (let s = 0; s < 5; s += 1) toca(SOL + s, 'bombo', 0.35, [], 0.42);
  for (const s of [0, 2, 4]) toca(SOL + s, 'platillo', 1.8, [], 0.08);
  arpegio(SOL + 0.25, FIN - 0.1, (t) => (t < SOL + 2 ? [78, 74, 69, 74] : t < SOL + 3 ? [78, 74, 71, 74] : t < SOL + 4 ? [78, 74, 69, 74] : t < SOL + 5 ? [79, 74, 71, 76] : [78, 74, 69, 74]), (k) => 0.05 + 0.0015 * k);
  // Cada prueba que se enciende suena una nota más alta.
  [74, 76, 78, 81, 83, 86, 90].forEach((nota, k) => toca(en('mision', 9.9 + k * 0.32), 'campana', 1.8, [nota], 0.06, -0.45 + k * 0.15));
  // El último acorde se queda sonando sobre el fundido.
  toca(FIN - 1, 'cuerdas', 3.6, [38, 50, 57, 62, 66, 74], 0.22);
  toca(FIN - 1, 'coro', 3.6, [62, 66, 69, 74], 0.15);
  toca(FIN - 1, 'metal', 2.2, [50, 57, 62, 66], 0.13);
  toca(FIN - 1, 'gong', 3.2, [38], 0.16);
  toca(FIN - 1, 'platillo', 2.6, [], 0.08);
  return p;
}

export const PARTITURA: readonly Nota[] = componer();

// ------------------------------------------------------------- intro

/** Cada letra del título toca, al salir de la nave, una nota del tema de Meta. */
export const NOTAS_LETRAS: readonly number[] = temaDeMeta(true).a.slice(0, 9).map(([nota]) => nota + 12);

/** Segundo en que la música pasa a acompañar la espera bajo el título. */
export const ESPERA_INTRO = INTRO.sector + 2;
/** Una vuelta son los dieciséis compases del tema; veinte vueltas superan cualquier espera. */
const VUELTA_INTRO = 16, VUELTAS_INTRO = 20;
export const DURACION_INTRO = ESPERA_INTRO + VUELTA_INTRO * VUELTAS_INTRO;

function componerIntro(): Nota[] {
  const { p, toca, frase, ostinato } = compositor();
  const { a, b } = temaDeMeta(true);
  const { pasada, sector } = INTRO;

  // En el vacío: un pedal grave y un acorde abierto, sin tercera, que aún no dice nada.
  toca(0, 'zumbido', sector, [38, 45], 0.1);
  toca(0.1, 'pad', sector - 0.1, [50, 57, 62], 0.08);
  toca(0, 'platilloInverso', pasada, [], 0.08);

  // La nave pasa rozando la cámara.
  toca(pasada, 'timbal', 0.9, [38], 0.36);
  toca(pasada, 'impacto', 1.2, [], 0.16);

  // Mientras suelta las letras, las cuerdas empujan hacia el acorde del título.
  toca(sector - 3.5, 'cuerdas', 3.5, [50, 57, 62], 0.08);
  ostinato(sector - 3.5, 50, 7, 0.07);
  for (const s of [3, 2, 1, 0.5]) toca(sector - s, 'timbal', 0.6, [38], 0.2 + (3 - s) * 0.05);
  toca(sector - 1.3, 'subida', 1.3, [], 0.1);
  toca(sector - 1.3, 'platilloInverso', 1.3, [], 0.13);

  // El título entero: re mayor con todo, y las trompas empiezan el tema.
  toca(sector, 'impacto', 1.6, [], 0.32);
  toca(sector, 'timbal', 1.2, [38], 0.42);
  toca(sector, 'platillo', 2.6, [], 0.1);
  toca(sector, 'metal', 2.2, [62, 66, 69, 74], 0.15);
  toca(sector, 'cuerdas', 3, [50, 62, 66, 69], 0.17);
  toca(sector, 'coro', 3, [62, 69, 74, 78], 0.14);
  frase(sector, 'trompa', hasta(a, 4), 0.18);

  // La espera: el tema entero en la caja de música, sobre un colchón suave.
  const acordes = [RE, SOL_M, RE, LA_M, RE, SI_m, SOL_M, RE];
  for (let v = 0; v < VUELTAS_INTRO; v++) {
    const t0 = ESPERA_INTRO + v * VUELTA_INTRO;
    acordes.forEach((acorde, k) => toca(t0 + k * 2, 'pad', 2.3, acorde, 0.07));
    frase(t0, 'cajita', a, 0.06, 12, -0.15, 1.6);
    frase(t0 + VUELTA_INTRO / 2, 'cajita', b, 0.06, 12, 0.15, 1.6);
  }
  return p;
}

export const PARTITURA_INTRO: readonly Nota[] = componerIntro();

// ------------------------------------------------------------- instrumentos

interface Mesa {
  a: BaseAudioContext;
  /** Percusión: va directa al compresor. */
  seco: AudioNode;
  /** Cuerdas, coro y colchones: bajan un momento con cada golpe para dejarle sitio. */
  colchon: GainNode;
  /** Sala corta y nave larga, para lo que tiene que sonar enorme. */
  eco: AudioNode;
  nave: AudioNode;
  /** Eco que rebota entre izquierda y derecha. */
  rebote: AudioNode;
  ruido: AudioBuffer;
  /** Lo que crea la nota en curso, para soltarlo cuando acabe. */
  nodos: AudioNode[];
}

/** Apunta un nodo a la nota en curso. */
function anotar<T extends AudioNode>(m: Mesa, n: T): T {
  m.nodos.push(n);
  return n;
}

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function oscilador(m: Mesa, tipo: OscillatorType, f: number, t: number, fin: number, destino: AudioNode, desafino = 0) {
  const o = anotar(m, m.a.createOscillator());
  o.type = tipo;
  // Una vez por bloque y no por muestra: es lo que más cuesta de todo el sintetizador.
  o.frequency.automationRate = o.detune.automationRate = 'k-rate';
  o.frequency.setValueAtTime(f, t);
  o.detune.value = desafino;
  o.connect(destino);
  o.start(t);
  o.stop(fin + 0.05);
  return o;
}

function ruido(m: Mesa, t: number, dur: number, destino: AudioNode) {
  const s = anotar(m, m.a.createBufferSource());
  s.buffer = m.ruido;
  s.loop = true;
  s.connect(destino);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

function filtro(m: Mesa, tipo: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = anotar(m, m.a.createBiquadFilter());
  b.type = tipo;
  b.frequency.automationRate = b.Q.automationRate = 'k-rate';
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function ganancia(m: Mesa, v: number): GainNode {
  const g = anotar(m, m.a.createGain());
  g.gain.value = v;
  return g;
}

/** Volumen con ataque y caída: exponencial (golpes) o sostenido y suelta lineal (colchones). */
function envolvente(m: Mesa, t: number, ataque: number, dur: number, vol: number, sostenido = false): GainNode {
  const g = anotar(m, m.a.createGain());
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

interface Envio {
  eco?: number;
  nave?: number;
  rebote?: number;
  pan?: number;
  /** Por la mezcla que baja con los golpes (cuerdas, coro, colchones). */
  colchon?: boolean;
}

function enviar(m: Mesa, nodo: AudioNode, e: Envio) {
  let salida = nodo;
  if (e.pan) {
    const p = anotar(m, m.a.createStereoPanner());
    p.pan.value = e.pan;
    salida = nodo.connect(p);
  }
  salida.connect(e.colchon ? m.colchon : m.seco);
  if (e.eco) salida.connect(ganancia(m, e.eco)).connect(m.eco);
  if (e.nave) salida.connect(ganancia(m, e.nave)).connect(m.nave);
  if (e.rebote) salida.connect(ganancia(m, e.rebote)).connect(m.rebote);
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
    enviar(m, g, { eco: 0.6, colchon: true, pan: n.pan });
  },
  // Cuerdas: dos sierras por nota, abiertas en estéreo y con arco lento.
  cuerdas: (m, t, n) => {
    const g = envolvente(m, t, Math.min(0.28, n.dur * 0.25), n.dur, n.vol / n.notas.length, true);
    const f = filtro(m, 'lowpass', 1100, 0.5);
    f.frequency.setValueAtTime(1100, t);
    f.frequency.linearRampToValueAtTime(3200, t + Math.min(1, n.dur * 0.5));
    const grave = filtro(m, 'highpass', 90);
    f.connect(grave).connect(g);
    const izquierda = anotar(m, m.a.createStereoPanner()), derecha = anotar(m, m.a.createStereoPanner());
    izquierda.pan.value = -0.6;
    derecha.pan.value = 0.6;
    izquierda.connect(f);
    derecha.connect(f);
    for (const nota of n.notas) {
      for (const [d, lado] of [[-8, izquierda], [8, derecha]] as const) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, lado, d);
    }
    enviar(m, g, { eco: 0.45, nave: 0.3, colchon: true, pan: n.pan });
  },
  // Cuerdas cortas: el ataque seco de los pasajes rápidos.
  cortas: (m, t, n) => {
    const g = envolvente(m, t, 0.006, n.dur, n.vol);
    const f = filtro(m, 'lowpass', 2400, 0.8);
    f.connect(g);
    oscilador(m, 'sawtooth', hz(n.notas[0]), t, t + n.dur, f);
    enviar(m, g, { eco: 0.25, pan: n.pan });
  },
  // Coro: sierras por tres formantes de la vocal «a», en la nave larga.
  coro: (m, t, n) => {
    const g = envolvente(m, t, Math.min(0.5, n.dur * 0.35), n.dur, (n.vol * 6) / n.notas.length, true);
    const entrada = ganancia(m, 1);
    for (const [f, q, peso] of [[730, 7, 1], [1120, 8, 0.6], [2650, 9, 0.28]] as const) {
      entrada.connect(filtro(m, 'bandpass', f, q)).connect(ganancia(m, peso)).connect(g);
    }
    for (const nota of n.notas) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, entrada);
    enviar(m, g, { nave: 0.8, eco: 0.3, colchon: true, pan: n.pan });
  },
  // Trompa: redonda, con un ataque suave y un filtro que respira.
  trompa: (m, t, n) => {
    const g = envolvente(m, t, 0.07, n.dur, n.vol / n.notas.length, true);
    const f = filtro(m, 'lowpass', 500, 1.2);
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.12);
    f.frequency.exponentialRampToValueAtTime(950, t + Math.max(0.2, n.dur));
    f.connect(g);
    for (const nota of n.notas) for (const d of [-5, 5]) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, f, d);
    enviar(m, g, { eco: 0.5, nave: 0.25, pan: n.pan });
  },
  // Metales: sierras con un filtro que se abre de golpe y un refuerzo grave.
  metal: (m, t, n) => {
    const g = envolvente(m, t, 0.03, n.dur, n.vol / n.notas.length, true);
    const f = filtro(m, 'lowpass', 400, 2);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(900, t + Math.max(0.12, n.dur));
    f.connect(g);
    for (const nota of n.notas) for (const d of [-9, 9]) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, f, d);
    oscilador(m, 'square', hz(n.notas[0]) / 2, t, t + n.dur, ganancia(m, 0.3).connect(f));
    enviar(m, g, { eco: 0.45, nave: 0.2, pan: n.pan });
  },
  // Arpa: pulsación corta de triángulo con su octava.
  arpa: (m, t, n) => {
    const g = envolvente(m, t, 0.005, n.dur, n.vol);
    const f = filtro(m, 'lowpass', 3200);
    f.connect(g);
    const octava = ganancia(m, 0.3);
    octava.connect(f);
    oscilador(m, 'triangle', hz(n.notas[0]), t, t + n.dur, f);
    oscilador(m, 'sine', hz(n.notas[0]) * 2, t, t + n.dur, octava);
    enviar(m, g, { eco: 0.6, rebote: 0.25, pan: n.pan });
  },
  // Caja de música: un diente de metal, agudo y que se apaga pronto.
  cajita: (m, t, n) => {
    const base = hz(n.notas[0]);
    for (const [razon, peso, largo] of [[1, 1, 1], [3, 0.3, 0.45], [6.2, 0.14, 0.2]] as const) {
      const g = envolvente(m, t, 0.002, Math.max(0.3, n.dur) * largo, n.vol * peso);
      oscilador(m, 'sine', base * razon, t, t + Math.max(0.3, n.dur), g);
      enviar(m, g, { eco: 0.5, rebote: 0.3, pan: n.pan });
    }
  },
  // Campana: parciales que no son armónicos y se apagan a distinto ritmo.
  campana: (m, t, n) => {
    for (const [razon, peso, largo] of [[1, 1, 1], [2.76, 0.4, 0.5], [5.4, 0.15, 0.3]] as const) {
      const g = envolvente(m, t, 0.003, n.dur * largo, n.vol * peso);
      oscilador(m, 'sine', hz(n.notas[0]) * razon, t, t + n.dur, g);
      enviar(m, g, { nave: 0.7, rebote: 0.2, pan: n.pan });
    }
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
    enviar(m, g, { eco: 0.05 });
  },
  // Zumbido: sierras graves muy filtradas que entran despacio.
  zumbido: (m, t, n) => {
    const g = envolvente(m, t, Math.min(1, n.dur * 0.3), n.dur, n.vol / n.notas.length, true);
    const f = filtro(m, 'lowpass', 280, 3);
    f.connect(g);
    for (const nota of n.notas) for (const d of [-5, 5]) oscilador(m, 'sawtooth', hz(nota), t, t + n.dur, f, d);
    enviar(m, g, { eco: 0.3, colchon: true });
  },
  bombo: (m, t, n) => {
    const g = envolvente(m, t, 0.002, 0.4, n.vol);
    const o = oscilador(m, 'sine', 150, t, t + 0.4, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const clic = envolvente(m, t, 0.001, 0.02, n.vol * 0.3);
    const f = filtro(m, 'highpass', 3000);
    f.connect(clic);
    ruido(m, t, 0.03, f);
    enviar(m, g, { eco: 0.08 });
    enviar(m, clic, {});
  },
  caja: (m, t, n) => {
    const g = envolvente(m, t, 0.001, 0.2, n.vol);
    const f = filtro(m, 'bandpass', 1900, 0.9);
    f.connect(g);
    ruido(m, t, 0.2, f);
    const cuerpo = envolvente(m, t, 0.001, 0.12, n.vol * 0.6);
    oscilador(m, 'triangle', 185, t, t + 0.12, cuerpo);
    enviar(m, g, { eco: 0.3, pan: n.pan });
    enviar(m, cuerpo, { eco: 0.2 });
  },
  charles: (m, t, n) => {
    const g = envolvente(m, t, 0.001, 0.05, n.vol);
    const f = filtro(m, 'highpass', 7500);
    f.connect(g);
    ruido(m, t, 0.06, f);
    enviar(m, g, { eco: 0.1, pan: n.pan });
  },
  platillo: (m, t, n) => {
    const g = envolvente(m, t, 0.005, n.dur, n.vol);
    const f = filtro(m, 'highpass', 4500);
    f.connect(g);
    ruido(m, t, n.dur, f);
    enviar(m, g, { eco: 0.5 });
  },
  // Platillo al revés: sube hasta cortarse justo antes del golpe.
  platilloInverso: (m, t, n) => {
    const g = anotar(m, m.a.createGain());
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(n.vol, t + n.dur);
    g.gain.linearRampToValueAtTime(0.0001, t + n.dur + 0.03);
    const f = filtro(m, 'highpass', 3200);
    f.connect(g);
    ruido(m, t, n.dur + 0.04, f);
    enviar(m, g, { eco: 0.3 });
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
    enviar(m, g, { eco: 0.6 });
    enviar(m, golpe, { eco: 0.4 });
  },
  // Timbal: afinado, con el parche que se destensa al sonar.
  timbal: (m, t, n) => {
    const base = hz(n.notas[0] ?? 38);
    const g = envolvente(m, t, 0.004, n.dur, n.vol);
    const o = oscilador(m, 'sine', base * 1.5, t, t + n.dur, g);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.07);
    const armonico = envolvente(m, t, 0.004, n.dur * 0.5, n.vol * 0.35);
    oscilador(m, 'sine', base * 2.01, t, t + n.dur, armonico);
    const parche = envolvente(m, t, 0.001, 0.06, n.vol * 0.4);
    const f = filtro(m, 'lowpass', 1400);
    f.connect(parche);
    ruido(m, t, 0.06, f);
    enviar(m, g, { eco: 0.4, nave: 0.15, pan: n.pan });
    enviar(m, armonico, { eco: 0.3, pan: n.pan });
    enviar(m, parche, { eco: 0.2, pan: n.pan });
  },
  // Gong: parciales inarmónicos graves que se quedan flotando en la nave.
  gong: (m, t, n) => {
    const base = hz(n.notas[0] ?? 38);
    for (const [razon, peso, largo] of [[1, 1, 1], [1.48, 0.6, 0.8], [2.13, 0.45, 0.65], [2.79, 0.3, 0.5], [3.9, 0.2, 0.35], [5.3, 0.12, 0.25]] as const) {
      const g = envolvente(m, t, 0.008, n.dur * largo, n.vol * peso);
      oscilador(m, 'sine', base * razon, t, t + n.dur, g);
      enviar(m, g, { nave: 0.8 });
    }
  },
  // Subida: ruido y una sierra que trepan hasta el estallido.
  subida: (m, t, n) => {
    const g = anotar(m, m.a.createGain());
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(n.vol, t + n.dur);
    g.gain.linearRampToValueAtTime(0.0001, t + n.dur + 0.04);
    const f = filtro(m, 'bandpass', 300, 4);
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(6000, t + n.dur);
    f.connect(g);
    ruido(m, t, n.dur, f);
    const sierra = ganancia(m, 0.4);
    const fs = filtro(m, 'lowpass', 2000);
    sierra.connect(fs).connect(g);
    const o = oscilador(m, 'sawtooth', 110, t, t + n.dur, sierra);
    o.frequency.exponentialRampToValueAtTime(880, t + n.dur);
    enviar(m, g, { eco: 0.4 });
  },
  // Impacto: grave que se hunde, con un cuerpo de ruido que tiembla debajo.
  impacto: (m, t, n) => {
    const g = envolvente(m, t, 0.005, n.dur, n.vol);
    const o = oscilador(m, 'sine', 110, t, t + n.dur, g);
    o.frequency.exponentialRampToValueAtTime(24, t + n.dur);
    const cuerpo = envolvente(m, t, 0.002, n.dur * 0.6, n.vol * 0.45);
    const f = filtro(m, 'lowpass', 900);
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(70, t + n.dur * 0.6);
    f.connect(cuerpo);
    ruido(m, t, n.dur * 0.6, f);
    enviar(m, g, { eco: 0.3, nave: 0.2 });
    enviar(m, cuerpo, { nave: 0.4 });
  },
  // Pitido de oídos tras el estallido.
  pitido: (m, t, n) => {
    const g = envolvente(m, t, 0.05, n.dur, n.vol);
    oscilador(m, 'sine', 2600, t, t + n.dur, g);
    enviar(m, g, { eco: 0.2 });
  },
  // Estática de radio: ruido de banda ancha que va y viene a golpes.
  estatica: (m, t, n) => {
    const g = anotar(m, m.a.createGain());
    g.gain.setValueAtTime(0.0001, t);
    for (let s = 0; s < n.dur; s += 0.05) g.gain.setValueAtTime(n.vol * (0.15 + Math.random() ** 2 * 0.85), t + s);
    g.gain.linearRampToValueAtTime(0.0001, t + n.dur);
    const f = filtro(m, 'bandpass', 1900, 0.6);
    f.connect(g);
    ruido(m, t, n.dur, f);
    enviar(m, g, {});
  },
  // Tic de reloj.
  tic: (m, t, n) => {
    const g = envolvente(m, t, 0.001, n.dur, n.vol);
    oscilador(m, 'square', 1700, t, t + n.dur, filtro(m, 'bandpass', 2400, 3).connect(g));
    enviar(m, g, { eco: 0.3, pan: n.pan });
  },
};

/** Reverberación hecha de ruido que se apaga; `oscura` le quita agudos a la cola. */
function sala(a: BaseAudioContext, segundos: number, caida: number, oscura: number): AudioBuffer {
  const largo = Math.floor(a.sampleRate * segundos);
  const b = a.createBuffer(2, largo, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let previo = 0;
    for (let i = 0; i < largo; i++) {
      const f = i / largo;
      previo += ((Math.random() * 2 - 1) - previo) * (1 - oscura * f);
      d[i] = previo * (1 - f) ** caida;
    }
  }
  return b;
}

function blanco(a: BaseAudioContext): AudioBuffer {
  const b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/**
 * Dos copias que se retrasan y adelantan: engordan cuerdas y coro sin más
 * osciladores. El vaivén lento hace de coro y el rápido, de vibrato común.
 */
function ensanchar(a: BaseAudioContext, entrada: AudioNode, salida: AudioNode, enMarcha: number, fin: number) {
  const mezcla = a.createChannelMerger(2);
  for (const [canal, base, ritmo, hondo] of [[0, 0.021, 0.31, 0.0035], [1, 0.029, 0.23, 0.0045]] as const) {
    const retraso = a.createDelay(0.1), lfo = a.createOscillator(), vaiven = a.createGain();
    retraso.delayTime.value = base;
    lfo.frequency.value = ritmo;
    vaiven.gain.value = hondo;
    lfo.connect(vaiven).connect(retraso.delayTime);
    lfo.start(enMarcha);
    lfo.stop(fin);
    const temblor = a.createOscillator(), poco = a.createGain();
    temblor.frequency.value = 5.1 + canal * 0.4;
    poco.gain.value = 0.00028;
    temblor.connect(poco).connect(retraso.delayTime);
    temblor.start(enMarcha);
    temblor.stop(fin);
    entrada.connect(retraso).connect(mezcla, 0, canal);
  }
  const nivel = a.createGain();
  nivel.gain.value = 0.7;
  mezcla.connect(nivel).connect(salida);
}

/** Eco en dos tiempos: rebota entre la izquierda y la derecha y se apaga. */
function rebote(a: BaseAudioContext, salida: AudioNode): AudioNode {
  const izquierda = a.createDelay(1), derecha = a.createDelay(1), vuelta = a.createGain(), mezcla = a.createChannelMerger(2);
  izquierda.delayTime.value = derecha.delayTime.value = 0.375;
  vuelta.gain.value = 0.36;
  izquierda.connect(derecha).connect(vuelta).connect(izquierda);
  izquierda.connect(mezcla, 0, 0);
  derecha.connect(mezcla, 0, 1);
  mezcla.connect(salida);
  return izquierda;
}

const SOSTENIDAS = new Set<Voz>(['pad', 'zumbido', 'cuerdas', 'coro']);
/** Cuánto bajan cuerdas y coro con cada golpe. */
const HUECO: Partial<Record<Voz, number>> = { bombo: 0.32, tambor: 0.5, impacto: 0.7 };

/** Baja la mezcla de colchones un instante para que el golpe se note. */
function hacerHueco(g: GainNode, t: number, cuanto: number) {
  g.gain.setValueAtTime(1, t);
  g.gain.linearRampToValueAtTime(1 - cuanto, t + 0.012);
  g.gain.linearRampToValueAtTime(1, t + 0.26);
}

export interface Banda {
  /** `suave` la deja apagarse, como al final; si no, corta en seco. */
  parar: (suave: boolean) => void;
  /** Una nota ahora mismo, para lo que depende de lo que pasa en pantalla. */
  nota: (voz: Voz, dur: number, notas: readonly number[], vol: number, pan?: number) => void;
}

/**
 * Programa una partitura de `largo` segundos desde su segundo `desde`, que sonará
 * en el instante `cuando` del reloj del audio. Lo que ya empezó antes de `desde`
 * entra a mitad (los colchones) o se salta (los golpes).
 *
 * En directo las notas se crean poco antes de sonar: crearlas todas de golpe
 * trabaría el primer fotograma. Sin conexión (para medirla) van todas juntas.
 */
function tocar(a: BaseAudioContext, partitura: readonly Nota[], desde: number, cuando: number, largo: number): Banda {
  const limitador = a.createDynamicsCompressor();
  limitador.threshold.value = -5;
  limitador.knee.value = 3;
  limitador.ratio.value = 20;
  limitador.attack.value = 0.002;
  limitador.release.value = 0.12;
  const compresor = a.createDynamicsCompressor();
  compresor.threshold.value = -18;
  compresor.ratio.value = 3;
  compresor.attack.value = 0.006;
  compresor.release.value = 0.25;
  const maestro = a.createGain();
  maestro.gain.value = 0.85;
  compresor.connect(limitador).connect(maestro).connect(a.destination);
  const eco = a.createConvolver();
  eco.buffer = sala(a, 1.8, 3.2, 0.35);
  eco.connect(compresor);
  const nave = a.createConvolver();
  nave.buffer = sala(a, 3.8, 2.6, 0.8);
  nave.connect(compresor);
  const colchon = a.createGain();
  colchon.connect(compresor);
  ensanchar(a, colchon, compresor, cuando, cuando + largo);
  const mesa: Mesa = { a, seco: compresor, colchon, eco, nave, rebote: rebote(a, compresor), ruido: blanco(a), nodos: [] };

  const notas = [...partitura].sort((x, y) => x.t - y.t);
  let i = 0, ultimoHueco = -1;
  // Las notas que acabaron se desconectan: si no, se quedan en el grafo y cada
  // vez cuesta más calcular el audio, aunque ya no suenen.
  let pendientes: { fin: number; nodos: AudioNode[] }[] = [];
  const limpiar = () => {
    const ahora = a.currentTime;
    pendientes = pendientes.filter((p) => {
      if (p.fin > ahora) return true;
      for (const nodo of p.nodos) nodo.disconnect();
      return false;
    });
  };
  const programar = (hastaSegundo: number) => {
    for (; i < notas.length && notas[i].t <= hastaSegundo; i++) {
      const n = notas[i], fin = n.t + n.dur;
      if (fin <= desde) continue;
      if (n.t < desde - 0.02 && !SOSTENIDAS.has(n.voz)) continue;
      const empieza = Math.max(n.t, desde);
      const instante = cuando + (empieza - desde);
      mesa.nodos = [];
      VOCES[n.voz](mesa, instante, empieza > n.t ? { ...n, dur: fin - empieza } : n);
      pendientes.push({ fin: instante + (fin - empieza) + 0.5, nodos: mesa.nodos });
      const hueco = HUECO[n.voz];
      if (hueco && instante > ultimoHueco + 0.28) {
        hacerHueco(colchon, instante, hueco);
        ultimoHueco = instante;
      }
    }
  };
  let reloj = 0;
  if ('startRendering' in a) {
    const sinConexion = a as OfflineAudioContext;
    const segundos = sinConexion.length / a.sampleRate;
    programar(desde + segundos);
    for (let s = 3; s < segundos; s += 3) {
      void sinConexion.suspend(s).then(() => {
        limpiar();
        return sinConexion.resume();
      });
    }
  } else {
    programar(desde + 2.5);
    reloj = window.setInterval(() => {
      programar(desde + (a.currentTime - cuando) + 2.5);
      limpiar();
    }, 400);
  }

  return {
    parar: (suave) => {
      window.clearInterval(reloj);
      const ahora = a.currentTime;
      maestro.gain.cancelScheduledValues(ahora);
      maestro.gain.setValueAtTime(maestro.gain.value, ahora);
      maestro.gain.setTargetAtTime(0, ahora, suave ? 0.8 : 0.12);
      setTimeout(() => maestro.disconnect(), suave ? 5000 : 1500);
    },
    nota: (voz, dur, alturas, vol, pan = 0) => {
      const instante = a.currentTime + 0.01;
      mesa.nodos = [];
      VOCES[voz](mesa, instante, { t: 0, voz, dur, notas: alturas, vol, pan });
      pendientes.push({ fin: instante + dur + 0.5, nodos: mesa.nodos });
    },
  };
}

/** La banda de la cinemática. Devuelve con qué pararla. */
export function tocarBanda(a: BaseAudioContext, desde: number, cuando: number): (suave: boolean) => void {
  return tocar(a, PARTITURA, desde, cuando, 120).parar;
}

/** La banda de la intro del título. */
export function tocarIntro(a: BaseAudioContext, desde: number, cuando: number): Banda {
  return tocar(a, PARTITURA_INTRO, desde, cuando, DURACION_INTRO);
}
