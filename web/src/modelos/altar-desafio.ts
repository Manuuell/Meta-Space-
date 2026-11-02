import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, punta, rot, toon, toro,
  type Modelo,
} from './kit.ts';

// Ara del Sol, el altar de desafíos: un monumento de la gente de Meta de
// antes del velo, de piedra cálida. Un obelisco con un sol de cobre que gira
// en lo alto y, alrededor, ocho lámparas que se encienden a medida que el
// jugador supera el desafío. Al activarlo, un anillo de luz marca en el suelo
// la zona del desafío (8 m de radio). Mira hacia +z; 3,9 m de alto.
//
// Las lámparas solo las toca el clip `Progreso`, que dura 1 s: el juego lo
// deja en pausa con `time = progreso` (0 → 1) mientras suena `Desafío`.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const PIEDRA = '#b9a37e', PIEDRA_OSCURA = '#8a7558', COBRE = '#c9783c';
const LAMPARAS = 8;
export const RADIO_DESAFIO = 8;
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export function crearAltarDesafio(): Modelo {
  return conDetalle(0.8, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'altar-desafio';
  const fino = <T,>(fn: () => T) => conDetalle(0.5, fn);

  // Plataforma redonda con escalón y el anillo de las lámparas.
  pieza(raiz, barril(2.3, 2.4, 0.3, 0.1), toon(PIEDRA_OSCURA), 0, 0.15, 0);
  pieza(raiz, barril(1.9, 2.0, 0.25, 0.1), toon(PIEDRA), 0, 0.42, 0);
  for (let k = 0; k < LAMPARAS; k++) {
    const a = (k / LAMPARAS) * TAU;
    const x = Math.sin(a) * 2.05, z = Math.cos(a) * 2.05;
    pieza(raiz, barril(0.14, 0.18, 0.55, 0.05), toon(PIEDRA), x, 0.55, z);
    const lampara = nodo(`lampara_${k}`, raiz, x, 0.95, z);
    lampara.scale.setScalar(0.45);
    fino(() => pieza(lampara, esfera(0.17), brillo(PALETA.plasma), 0, 0, 0, { contorno: true }));
  }

  // Obelisco con glifos de sol y el sol de cobre arriba.
  const obelisco = nodo('obelisco', raiz, 0, 0.55, 0);
  pieza(obelisco, barril(0.35, 0.6, 2.2, 0.12), toon(PIEDRA), 0, 1.1, 0);
  pieza(obelisco, toro(0.55, 0.06), toon(COBRE), 0, 0.25, 0);
  pieza(obelisco, toro(0.42, 0.05), toon(COBRE), 0, 1.65, 0);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const glifo = pieza(obelisco, caja(0.36, 0.36, 0.06, 0.03), toon(PIEDRA_OSCURA), Math.sin(a) * 0.5, 0.95, Math.cos(a) * 0.5);
    glifo.rotation.y = a;
    fino(() => pieza(obelisco, esfera(0.09, 1, 1, 0.3), brillo(PALETA.arena), Math.sin(a) * 0.55, 0.95, Math.cos(a) * 0.55, { contorno: false }));
  }
  const sol = nodo('sol', raiz, 0, 3.2, 0);
  pieza(sol, esfera(0.38, 1, 1, 0.35), toon(COBRE));
  pieza(sol, esfera(0.26, 1, 1, 0.3), brillo(PALETA.arena), 0, 0, 0.08, { contorno: false });
  pieza(sol, esfera(0.26, 1, 1, 0.3), brillo(PALETA.arena), 0, 0, -0.08, { contorno: false });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    const r = pieza(sol, punta(0.08, k % 2 ? 0.28 : 0.4).scale(1, 1, 0.4), toon(COBRE), Math.sin(a) * 0.52, Math.cos(a) * 0.52, 0);
    r.rotation.z = -a;
  }

  // Zona del desafío (anillo en el suelo) y el estallido del premio.
  const zona = nodo('zona', raiz, 0, 0.03, 0);
  pieza(zona, new THREE.RingGeometry(RADIO_DESAFIO - 0.35, RADIO_DESAFIO, 64).rotateX(-Math.PI / 2), brillo(PALETA.plasma), 0, 0, 0, { contorno: false, sombra: false });
  oculto(zona);
  const premio = nodo('premio', raiz, 0, 3.2, 0);
  fino(() => {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const r = pieza(premio, punta(0.09, 1.1), brillo(k % 2 ? PALETA.arena : PALETA.plasma), Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0, { contorno: false, sombra: false });
      r.rotation.z = -a;
    }
  });
  oculto(premio);

  const lamparas = (fn: (k: number) => [number, number][]) =>
    Array.from({ length: LAMPARAS }, (_, k) => esc(`lampara_${k}`, poses(fn(k).map(([t, v]) => [t, v, v, v] as const))));

  const animaciones = [
    animacion('Reposo', 3.0, [
      rot('sol', ciclo(3, (f) => [0, f * 360, sen(f) * 4])),
      mov(raiz, 'sol', ciclo(3, (f) => [0, sen(f) * 0.06, 0])),
    ], 'movimiento', 'Espera: el sol de cobre gira despacio sobre el obelisco.'),

    animacion('Activar', 1.6, [
      // El sol se enciende y gira, el anillo de la zona se abre en el suelo.
      rot('sol', poses([[0, 0, 0, 0], [1.6, 0, 720, 0]])),
      esc('sol', poses([[0, 1, 1, 1], [0.3, 0.85, 0.85, 0.85], [0.6, 1.35, 1.35, 1.35], [1.0, 1.15, 1.15, 1.15], [1.6, 1.15, 1.15, 1.15]])),
      esc('zona', poses([[0, 0.05, 1, 0.05], [0.6, 0.05, 1, 0.05], [1.2, 1.04, 1, 1.04], [1.6, 1, 1, 1]])),
      rot('obelisco', poses([[0, 0, 0, 0], [0.1, 0, 0, 1], [0.2, 0, 0, -1], [0.3, 0, 0, 0], [1.6, 0, 0, 0]])),
    ], 'ataque', 'Empieza el desafío: el sol se enciende y el anillo de la zona se abre en el suelo (8 m).', false),

    animacion('Desafío', 2.0, [
      rot('sol', ciclo(2, (f) => [0, f * 720, 0])),
      esc('sol', ciclo(2, (f) => { const k = 1.15 + 0.06 * sen(f, 2); return [k, k, k]; })),
      esc('zona', ciclo(2, (f) => [1 + 0.01 * sen(f, 4), 1, 1 + 0.01 * sen(f, 4)])),
    ], 'movimiento', 'Mientras dura el desafío: el sol gira deprisa y la zona late. Se reproduce a la vez que `Progreso`.'),

    animacion('Progreso', 1.0, lamparas((k) => {
      // La lámpara k se enciende al llegar a (k + 1) / 8 del desafío.
      const t = (k + 1) / LAMPARAS;
      return [[0, 0.45], [Math.max(0, t - 0.06), 0.45], [t, 1.25], [Math.min(1, t + 0.04), 1], [1, 1]];
    }), 'reaccion', 'Marcador: en pausa con time = progreso (0 → 1), las lámparas se encienden de una en una.', false),

    animacion('Superado', 2.4, [
      ...lamparas(() => [[0, 1], [0.15, 1.5], [0.3, 1], [0.45, 1.5], [0.6, 1], [2.4, 1]]),
      esc('premio', poses([[0, 0.001, 0.001, 0.001], [0.5, 0.001, 0.001, 0.001], [0.8, 1.4, 1.4, 1.4], [1.6, 2.2, 2.2, 2.2], [2.0, 0.001, 0.001, 0.001], [2.4, 0.001, 0.001, 0.001]])),
      rot('premio', poses([[0, 0, 0, 0], [2.0, 0, 0, 90]])),
      esc('sol', poses([[0, 1.15, 1.15, 1.15], [0.5, 0.9, 0.9, 0.9], [0.8, 1.6, 1.6, 1.6], [2.4, 1, 1, 1]])),
      rot('sol', poses([[0, 0, 0, 0], [2.4, 0, 1080, 0]])),
      esc('zona', poses([[0, 1, 1, 1], [0.8, 1.15, 1, 1.15], [1.2, 0.001, 0.001, 0.001], [2.4, 0.001, 0.001, 0.001]])),
    ], 'reaccion', 'Desafío superado: las lámparas destellan, el sol estalla en rayos (0,8 s: el juego da el premio) y la zona se cierra.', false),

    animacion('Fallado', 1.4, [
      ...lamparas((k) => [[0, 1], [0.1 + k * 0.08, 1], [0.2 + k * 0.08, 0.3], [1.4, 0.3]]),
      esc('sol', poses([[0, 1.15, 1.15, 1.15], [0.4, 1.2, 1.2, 1.2], [1.4, 0.9, 0.9, 0.9]])),
      rot('sol', poses([[0, 0, 0, 0], [1.4, 0, 90, 12]])),
      esc('zona', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [1.0, 0.001, 0.001, 0.001], [1.4, 0.001, 0.001, 0.001]])),
    ], 'reaccion', 'Desafío fallado: las lámparas se apagan una a una, el sol se para y la zona desaparece.', false),
  ];

  return { id: 'altar-desafio', nombre: 'Ara del Sol', rol: 'Mapa · altar de desafíos', raiz, animaciones };
}
