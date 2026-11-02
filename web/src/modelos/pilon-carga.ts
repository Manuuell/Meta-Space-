import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, ciclo, conDetalle, esc, mov, nodo, pieza, poses, punta, rot, toon, toro,
  type Modelo,
} from './kit.ts';

// Pilón de carga: una antena solar de la gente de Meta, de antes del velo.
// Una losa hexagonal con seis postes de lámpara y una columna de metal con
// bandas naranjas; arriba flota un cristal de cuarzo dentro de un aro. Si
// el jugador se queda dentro del círculo, ADA lo carga: las lámparas se
// encienden de una en una y, al llenarse, el cristal estalla en rayos y
// entrega una bendición. Después queda apagado. Mira hacia +z; 3,8 m de alto.
//
// Las lámparas solo las toca `Progreso` (1 s): el juego lo deja en pausa con
// `time = progreso` (0 → 1) mientras suena `Cargando`, como el Ara del Sol.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const PIEDRA = '#9c8f86', PIEDRA_OSCURA = '#6e625c', CUARZO = '#ffe9a0', CUARZO_APAGADO = '#6a6478';
const LAMPARAS = 6;
/** Radio del círculo de carga en el suelo (lo dibuja el juego). */
export const RADIO_PILON = 3.6;
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export function crearPilonCarga(): Modelo {
  return conDetalle(0.8, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'pilon-carga';
  const fino = <T,>(fn: () => T) => conDetalle(0.5, fn);

  // Losa hexagonal con escalón y los seis postes de lámpara.
  pieza(raiz, barril(1.75, 1.85, 0.3, 0.08).rotateY(Math.PI / 6), toon(PIEDRA_OSCURA), 0, 0.15, 0);
  pieza(raiz, barril(1.35, 1.45, 0.22, 0.08), toon(PIEDRA), 0, 0.4, 0);
  for (let k = 0; k < LAMPARAS; k++) {
    const a = (k / LAMPARAS) * TAU;
    const x = Math.sin(a) * 1.5, z = Math.cos(a) * 1.5;
    pieza(raiz, caja(0.22, 0.6, 0.22, 0.05), toon(PIEDRA), x, 0.6, z);
    const lampara = nodo(`lampara_${k}`, raiz, x, 1.0, z);
    lampara.scale.setScalar(0.45);
    fino(() => pieza(lampara, punta(0.16, 0.34, 4), brillo(PALETA.ada), 0, 0, 0, { contorno: true }));
  }

  // Columna de metal con bandas, y el cabezal donde flota el cristal.
  const columna = nodo('columna', raiz, 0, 0.5, 0);
  pieza(columna, barril(0.3, 0.46, 2.0, 0.1), toon(PALETA.metal), 0, 1.0, 0);
  pieza(columna, toro(0.44, 0.07), toon(PALETA.naranja), 0, 0.3, 0);
  pieza(columna, toro(0.36, 0.06), toon(PALETA.naranja), 0, 1.25, 0);
  pieza(columna, barril(0.5, 0.36, 0.22, 0.06), toon(PALETA.metalOscuro), 0, 2.08, 0);
  for (const a of [0, TAU / 3, (2 * TAU) / 3]) {
    const brazo = pieza(columna, caja(0.12, 0.5, 0.12, 0.04), toon(PALETA.metalOscuro), Math.sin(a) * 0.42, 2.35, Math.cos(a) * 0.42);
    brazo.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
  }

  // Cristal: bipirámide de cuarzo; su versión apagada espera escondida.
  const cristal = nodo('cristal', raiz, 0, 3.2, 0);
  pieza(cristal, punta(0.34, 0.62, 4), brillo(CUARZO), 0, 0.31, 0);
  pieza(cristal, punta(0.34, 0.62, 4).rotateX(Math.PI), brillo(CUARZO), 0, -0.31, 0);
  fino(() => pieza(cristal, punta(0.14, 0.3, 4), brillo(PALETA.blanco), 0.08, 0.2, 0.12, { contorno: false, sombra: false }));
  const apagado = nodo('cristal_apagado', raiz, 0, 2.95, 0);
  pieza(apagado, punta(0.26, 0.46, 4), toon(CUARZO_APAGADO), 0, 0.23, 0);
  pieza(apagado, punta(0.26, 0.46, 4).rotateX(Math.PI), toon(CUARZO_APAGADO), 0, -0.23, 0);
  oculto(apagado);

  const aro = nodo('aro', raiz, 0, 3.2, 0);
  pieza(aro, toro(0.7, 0.05), toon(PALETA.naranja));
  fino(() => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU;
      pieza(aro, punta(0.07, 0.16, 4), brillo(PALETA.arena), Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7, { contorno: false, sombra: false });
    }
  });

  // Rayos del estallido al cargarse.
  const rayos = nodo('rayos', raiz, 0, 3.2, 0);
  fino(() => {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const r = pieza(rayos, punta(0.1, 1.3), brillo(k % 2 ? CUARZO : PALETA.ada), Math.sin(a) * 1.1, Math.cos(a) * 1.1, 0, { contorno: false, sombra: false });
      r.rotation.z = -a;
    }
  });
  oculto(rayos);

  const lamparas = (fn: (k: number) => [number, number][]) =>
    Array.from({ length: LAMPARAS }, (_, k) => esc(`lampara_${k}`, poses(fn(k).map(([t, v]) => [t, v, v, v] as const))));

  const animaciones = [
    animacion('Reposo', 3.0, [
      rot('cristal', ciclo(3, (f) => [0, f * 360, 0])),
      mov(raiz, 'cristal', ciclo(3, (f) => [0, sen(f) * 0.08, 0])),
      rot('aro', ciclo(3, (f) => [12 + sen(f) * 4, -f * 360, 0])),
    ], 'movimiento', 'Espera: el cristal flota y gira despacio dentro del aro.'),

    animacion('Cargando', 1.0, [
      rot('cristal', ciclo(1, (f) => [0, f * 720, 0])),
      esc('cristal', ciclo(1, (f) => { const k = 1.15 + 0.12 * sen(f, 2); return [k, k, k]; })),
      mov(raiz, 'cristal', ciclo(1, (f) => [0, 0.25 + sen(f, 2) * 0.05, 0])),
      rot('aro', ciclo(1, (f) => [25, -f * 720, 0])),
    ], 'movimiento', 'ADA lo está cargando: el cristal sube, late y gira deprisa. Suena a la vez que `Progreso`.'),

    animacion('Progreso', 1.0, lamparas((k) => {
      // La lámpara k se enciende al llegar a (k + 1) / 6 de la carga.
      const t = (k + 1) / LAMPARAS;
      return [[0, 0.45], [Math.max(0, t - 0.06), 0.45], [t, 1.3], [Math.min(1, t + 0.04), 1], [1, 1]];
    }), 'reaccion', 'Marcador: en pausa con time = progreso (0 → 1), las lámparas se encienden de una en una.', false),

    animacion('Cargado', 1.6, [
      ...lamparas(() => [[0, 1], [0.15, 1.5], [0.3, 1], [0.45, 1.5], [0.6, 1], [1.6, 1]]),
      esc('rayos', poses([[0, 0.001, 0.001, 0.001], [0.25, 1.2, 1.2, 1.2], [0.8, 2, 2, 2], [1.1, 0.001, 0.001, 0.001], [1.6, 0.001, 0.001, 0.001]])),
      rot('rayos', poses([[0, 0, 0, 0], [1.1, 0, 0, 90]])),
      esc('cristal', poses([[0, 1.15, 1.15, 1.15], [0.2, 0.8, 0.8, 0.8], [0.4, 1.7, 1.7, 1.7], [1.6, 1.2, 1.2, 1.2]])),
      rot('cristal', poses([[0, 0, 0, 0], [1.6, 0, 1080, 0]])),
    ], 'reaccion', 'Carga completa: las lámparas destellan y el cristal estalla en rayos (0,4 s: el juego da la bendición).', false),

    animacion('Agotado', 1.0, [
      ...lamparas(() => [[0, 1], [0.5, 0.35], [1, 0.35]]),
      esc('cristal', poses([[0, 1.2, 1.2, 1.2], [0.3, 1.3, 1.3, 1.3], [0.6, 0.001, 0.001, 0.001], [1, 0.001, 0.001, 0.001]])),
      esc('cristal_apagado', poses([[0, 0.001, 0.001, 0.001], [0.5, 0.001, 0.001, 0.001], [0.8, 1.1, 1.1, 1.1], [1, 1, 1, 1]])),
      rot('aro', poses([[0, 25, 0, 0], [1, 70, 0, 8]])),
      mov(raiz, 'aro', poses([[0, 0, 0, 0], [1, 0, -0.6, 0]])),
    ], 'reaccion', 'Gastado: el cristal se apaga, queda uno gris y el aro cae ladeado.', false),
  ];

  return { id: 'pilon-carga', nombre: 'Pilón de carga', rol: 'Mapa · bendición por carga', raiz, animaciones };
}
