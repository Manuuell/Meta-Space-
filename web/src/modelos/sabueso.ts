import * as THREE from 'three';
import {
  PALETA, animacion, brillo, caja, ciclo, conDetalle, esc, mov, nodo, pieza, poses, punta, rot, toon, toro,
  type Modelo,
} from './kit.ts';
import { GOLEMS } from '../contenido/mapa.ts';
import { halo, materialBrillante, placas } from './brillo.ts';

// Cancerbero de HELIOS: el sabueso guardián de la central de HELIOS, un perro
// de chapa negra de tres cabezas. Cada cabeza lleva una cresta de plasma en
// bloques (amarillo, naranja y rojo) y el pecho, el ojo de HELIOS. Las juntas
// del blindaje dejan ver los circuitos al rojo. La del centro manda; las de
// los lados miran un poco hacia fuera. Mira hacia +z.
//
// Usa los mismos clips que los gólems (el juego los trata igual) y uno más,
// `Aliento`: baja las tres cabezas y escupe plasma en cono de 0,8 a 2 s. Las
// llamas de las crestas y los chorros del aliento los mueve el juego (nodos
// `llama_*` y `aliento_*`): ningún clip los toca.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const CHAPA = '#2e2c3a', CHAPA_CLARA = '#4a4760', LUZ = '#ff6a2a', OJO = '#ffd25a';
const LLAMA = ['#ffe066', '#ff8a2a', '#ff3b5b'] as const;
const CABEZAS = ['c', 'i', 'd'] as const;
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export const TIEMPOS_ALIENTO = { empieza: 0.8, acaba: 2.0, duracion: 2.4 } as const;

/** `talla` agranda o encoge el modelo (el cachorro de los duelos es pequeño). */
export function crearSabueso(talla?: number): Modelo {
  return conDetalle(0.6, () => montar(talla));
}

/** Cresta de plasma en bloques, de mayor a menor, con su resplandor. */
function llama(padre: THREE.Object3D, nombre: string, x: number, y: number, z: number, k = 1) {
  const n = nodo(nombre, padre, x, y, z);
  n.userData.llama = true;
  pieza(n, caja(0.55 * k, 0.32 * k, 0.5 * k, 0.04), brillo(LLAMA[0]), 0, 0.16 * k, 0, { contorno: false, sombra: false });
  pieza(n, caja(0.42 * k, 0.32 * k, 0.38 * k, 0.04), brillo(LLAMA[1]), 0.04 * k, 0.45 * k, -0.03 * k, { contorno: false, sombra: false });
  pieza(n, caja(0.26 * k, 0.3 * k, 0.24 * k, 0.04), brillo(LLAMA[2]), -0.03 * k, 0.74 * k, 0.02 * k, { contorno: false, sombra: false });
  pieza(n, caja(0.14 * k, 0.18 * k, 0.14 * k, 0.03), brillo(LLAMA[0]), 0.08 * k, 0.95 * k, 0, { contorno: false, sombra: false });
  halo(n, LLAMA[1], 1.5 * k, 0, 0.45 * k, 0, 0.8);
  return n;
}

function montar(escala?: number): Modelo {
  const def = GOLEMS['sabueso-helios'];
  const chapa = materialBrillante(CHAPA, LUZ, placas(31), 1.6);
  const clara = materialBrillante(CHAPA_CLARA, LUZ, placas(37), 1.2);
  const metal = toon(PALETA.metal), oscuro = toon(PALETA.oscuroHelios), luz = brillo(LUZ);
  const raiz = new THREE.Group();
  raiz.name = 'sabueso-helios';
  const talla = nodo('talla', raiz);
  talla.scale.setScalar(escala ?? def.talla);
  const cuerpo = nodo('cuerpo', talla);

  // Torso largo con silla de placas, vetas encendidas y el ojo de HELIOS.
  const pecho = nodo('pecho', cuerpo, 0, 2.05, 0);
  pieza(pecho, caja(1.7, 1.35, 2.9, 0.18), chapa, 0, 0, 0);
  pieza(pecho, caja(1.85, 0.4, 2.2, 0.12), clara, 0, 0.72, -0.1);
  pieza(pecho, caja(1.3, 0.25, 1.6, 0.08), oscuro, 0, -0.72, 0);
  for (const s of [-1, 1]) {
    for (const [z, l] of [[0.7, 0.9], [-0.3, 1.1], [-1.1, 0.6]] as const) {
      pieza(pecho, caja(0.05, 0.08, l, 0.02), luz, 0.86 * s, 0.15, z, { contorno: false, sombra: false });
    }
    pieza(pecho, caja(0.05, 0.7, 0.08, 0.02), luz, 0.86 * s, -0.05, 1.05, { contorno: false, sombra: false });
  }
  for (let k = 0; k < 4; k++) pieza(pecho, punta(0.12, 0.38, 4), metal, 0, 0.98, 0.7 - k * 0.55);
  const nucleo = nodo('nucleo', pecho, 0, 0.05, 1.47);
  pieza(nucleo, toro(0.28, 0.06), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  pieza(nucleo, caja(0.16, 0.16, 0.06, 0.03), brillo(OJO), 0, 0, 0.02, { contorno: false, sombra: false });
  pieza(nucleo, caja(0.06, 0.55, 0.04, 0.02), luz, 0, -0.5, -0.02, { contorno: false, sombra: false });
  halo(nucleo, PALETA.helios, 1.4, 0, 0, 0.2, 0.8);

  // Collar de pinchos entre el torso y las tres cabezas.
  const collar = nodo('collar', pecho, 0, 0.45, 1.35);
  pieza(collar, caja(2.3, 0.45, 0.7, 0.12), clara);
  for (let k = 0; k < 7; k++) {
    const x = (k - 3) * 0.34;
    const pincho = pieza(collar, punta(0.08, 0.32, 4), metal, x, 0.32, 0.12);
    pincho.rotation.x = -0.4;
  }

  // Tres cabezas de lobo de chapa: hocico, mandíbula con colmillos, orejas,
  // ojos con resplandor, la cresta de plasma y el chorro del aliento.
  const pos: Record<(typeof CABEZAS)[number], [number, number, number, number, number]> = {
    c: [0, 1.0, 1.85, 0, 1.1],
    i: [0.95, 0.72, 1.5, 0.45, 0.9],
    d: [-0.95, 0.72, 1.5, -0.45, 0.9],
  };
  for (const id of CABEZAS) {
    const [x, y, z, giro, k] = pos[id];
    const cuello = nodo(`cuello_${id}`, pecho, x, y - 0.35, z - 0.45);
    cuello.rotation.y = giro;
    pieza(cuello, caja(0.62 * k, 0.7 * k, 0.75 * k, 0.12), chapa, 0, 0.15, 0.2);
    const cabeza = nodo(`cabeza_${id}`, cuello, 0, 0.45 * k, 0.55 * k);
    pieza(cabeza, caja(0.85 * k, 0.75 * k, 0.85 * k, 0.12), chapa, 0, 0, 0);
    pieza(cabeza, caja(0.9 * k, 0.16 * k, 0.9 * k, 0.05), clara, 0, 0.36 * k, 0);
    pieza(cabeza, caja(0.52 * k, 0.36 * k, 0.55 * k, 0.1), chapa, 0, -0.1 * k, 0.62 * k);
    pieza(cabeza, caja(0.2 * k, 0.12 * k, 0.08 * k, 0.03), oscuro, 0, 0.02 * k, 0.9 * k);
    for (const s of [-1, 1]) {
      const oreja = pieza(cabeza, punta(0.16 * k, 0.5 * k, 4), chapa, 0.3 * k * s, 0.55 * k, -0.15 * k);
      oreja.rotation.z = -0.25 * s;
      pieza(cabeza, caja(0.2 * k, 0.09 * k, 0.05 * k, 0.02), brillo(OJO), 0.22 * k * s, 0.1 * k, 0.43 * k, { contorno: false, sombra: false });
      halo(cabeza, OJO, 0.5 * k, 0.22 * k * s, 0.1 * k, 0.5 * k, 0.9);
    }
    // El de en medio lleva el ojo de HELIOS en la frente.
    if (id === 'c') {
      pieza(cabeza, caja(0.16, 0.16, 0.05, 0.03), brillo(PALETA.helios), 0, 0.3, 0.44, { contorno: false, sombra: false });
      halo(cabeza, PALETA.helios, 0.7, 0, 0.3, 0.5, 0.9);
    }
    const mandibula = nodo(`mandibula_${id}`, cabeza, 0, -0.3 * k, 0.3 * k);
    pieza(mandibula, caja(0.48 * k, 0.16 * k, 0.6 * k, 0.05), chapa, 0, 0, 0.3 * k);
    pieza(mandibula, caja(0.4 * k, 0.06 * k, 0.5 * k, 0.02), luz, 0, 0.09 * k, 0.3 * k, { contorno: false, sombra: false });
    for (const s of [-1, 1]) {
      pieza(mandibula, punta(0.05 * k, 0.2 * k, 4), toon(PALETA.diente), 0.17 * k * s, 0.15 * k, 0.52 * k);
      pieza(cabeza, punta(0.05 * k, 0.2 * k, 4).rotateX(Math.PI), toon(PALETA.diente), 0.17 * k * s, -0.33 * k, 0.8 * k);
    }
    llama(cabeza, `llama_${id}`, 0, 0.45 * k, -0.05 * k, k);
    const aliento = nodo(`aliento_${id}`, cabeza, 0, -0.18 * k, 0.95 * k);
    pieza(aliento, new THREE.ConeGeometry(0.9, 4.2, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 2.1),
      new THREE.MeshBasicMaterial({ color: LLAMA[1], transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      0, 0, 0, { contorno: false, sombra: false });
    halo(aliento, LLAMA[0], 2.4, 0, 0, 1.2, 0.8);
    oculto(aliento);
  }

  // Patas de bloques con una veta encendida y garras.
  for (const [id, x, z] of [['di', 0.62, 0.95], ['dd', -0.62, 0.95], ['ti', 0.62, -1.0], ['td', -0.62, -1.0]] as const) {
    const pata = nodo(`pata_${id}`, cuerpo, x, 1.6, z);
    pieza(pata, caja(0.6, 1.0, 0.66, 0.1), chapa, 0, -0.45, 0);
    pieza(pata, caja(0.5, 0.75, 0.52, 0.08), clara, 0, -1.1, 0.02);
    pieza(pata, caja(0.05, 0.85, 0.05, 0.02), luz, 0, -0.75, 0.34, { contorno: false, sombra: false });
    pieza(pata, caja(0.7, 0.28, 0.85, 0.08), chapa, 0, -1.47, 0.12);
    for (const gx of [-0.22, 0, 0.22]) pieza(pata, punta(0.07, 0.22, 4).rotateX(Math.PI / 2), metal, gx, -1.52, 0.6);
  }

  // Cola de tres segmentos con su llamita.
  const cola = nodo('cola', pecho, 0, 0.35, -1.45);
  cola.rotation.x = -0.6;
  pieza(cola, caja(0.3, 0.3, 0.6, 0.08), chapa, 0, 0, -0.3);
  pieza(cola, caja(0.24, 0.24, 0.55, 0.06), clara, 0, 0.12, -0.8);
  llama(cola, 'llama_cola', 0, 0.2, -1.15, 0.5);

  const patas = (d: number, amp: number) => [
    rot('pata_di', ciclo(d, (f) => [sen(f) * amp, 0, 0])),
    rot('pata_td', ciclo(d, (f) => [sen(f) * amp, 0, 0])),
    rot('pata_dd', ciclo(d, (f) => [-sen(f) * amp, 0, 0])),
    rot('pata_ti', ciclo(d, (f) => [-sen(f) * amp, 0, 0])),
  ];
  const cabezas = (d: number, fn: (f: number, k: number) => readonly [number, number, number]) =>
    CABEZAS.map((id, k) => rot(`cabeza_${id}`, ciclo(d, (f) => fn(f, k))));
  const bocas = (claves: [number, number][]) =>
    CABEZAS.map((id) => rot(`mandibula_${id}`, poses(claves.map(([t, a]) => [t, a, 0, 0] as const))));

  const animaciones = [
    animacion('Despertar', 3.0, [
      // Sale tumbado, se levanta y aúlla con las tres cabezas al cielo.
      mov(talla, 'cuerpo', poses([[0, 0, -1.2, 0], [1.2, 0, -0.9, 0], [1.7, 0, 0, 0], [3.0, 0, 0, 0]])),
      ...CABEZAS.map((id) => rot(`cabeza_${id}`, poses([[0, 30, 0, 0], [1.6, 0, 0, 0], [1.9, -45, 0, 0], [2.7, -45, 0, 0], [3.0, 0, 0, 0]]))),
      ...bocas([[0, 0], [1.8, 0], [2.0, 40], [2.7, 38], [3.0, 0]]),
      esc('nucleo', poses([[0, 0.3, 0.3, 0.3], [1.7, 1, 1, 1], [2.0, 1.5, 1.5, 1.5], [3.0, 1, 1, 1]])),
    ], 'reaccion', 'Despierta: se levanta y aúlla con las tres cabezas al cielo.', false),

    animacion('Caminar', 1.0, [
      ...patas(1, 26),
      mov(talla, 'cuerpo', ciclo(1, (f) => [0, Math.abs(sen(f)) * 0.12, 0])),
      rot('pecho', ciclo(1, (f) => [sen(f, 2) * 2, sen(f) * 4, sen(f) * 3])),
      ...cabezas(1, (f, k) => [sen(f, 2, k * 0.2) * 6, sen(f, 1, k * 0.33) * 8, 0]),
      rot('cola', ciclo(1, (f) => [-34 + sen(f, 2) * 6, sen(f) * 25, 0])),
    ], 'movimiento', 'Trote pesado: patas en diagonal, cada cabeza mira a su aire y la cola se mece.'),

    animacion('Pisoton', 2.0, [
      // Se encabrita sobre las patas de atrás y cae con las de delante.
      rot('cuerpo', poses([[0, 0, 0, 0], [0.85, -32, 0, 0], [1.05, -34, 0, 0], [1.15, 8, 0, 0], [1.5, 6, 0, 0], [2.0, 0, 0, 0]])),
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.85, 0, 0.9, -0.5], [1.05, 0, 1.0, -0.5], [1.15, 0, -0.3, 0.3], [1.5, 0, -0.25, 0.3], [2.0, 0, 0, 0]])),
      rot('pata_di', poses([[0, 0, 0, 0], [0.85, -60, 0, 0], [1.05, -65, 0, 0], [1.15, -20, 0, 0], [2.0, 0, 0, 0]])),
      rot('pata_dd', poses([[0, 0, 0, 0], [0.85, -50, 0, 0], [1.05, -55, 0, 0], [1.15, -20, 0, 0], [2.0, 0, 0, 0]])),
      rot('pata_ti', poses([[0, 0, 0, 0], [0.85, 30, 0, 0], [1.15, 0, 0, 0], [2.0, 0, 0, 0]])),
      rot('pata_td', poses([[0, 0, 0, 0], [0.85, 30, 0, 0], [1.15, 0, 0, 0], [2.0, 0, 0, 0]])),
      ...bocas([[0, 0], [0.85, 25], [1.15, 40], [1.5, 0], [2.0, 0]]),
    ], 'ataque', 'Zarpazo: se encabrita y cae con las patas delanteras (golpe a 1,15 s).', false),

    animacion('Lanzar', 2.2, [
      // Echa atrás las tres cabezas y escupe una bola de plasma cada una.
      ...CABEZAS.map((id, k) => rot(`cabeza_${id}`, poses([[0, 0, 0, 0], [0.9, -30, 0, 0], [1.1, -34, 0, 0], [1.2 + k * 0.05, 18, 0, 0], [1.6, 8, 0, 0], [2.2, 0, 0, 0]]))),
      ...bocas([[0, 0], [1.0, 10], [1.2, 42], [1.5, 30], [2.2, 0]]),
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [1.0, 0, -0.2, -0.2], [1.25, 0, 0, 0.25], [2.2, 0, 0, 0]])),
    ], 'ataque', 'Escupe: echa atrás las tres cabezas y suelta tres bolas de plasma a 1,2 s.', false),

    animacion('Preparar', 0.9, [
      // Se agacha, gruñe y escarba antes de embestir.
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.4, 0, -0.5, 0], [0.9, 0, -0.5, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.4, 10, 0, 0], [0.9, 10, 0, 0]])),
      rot('pata_dd', poses([[0, 0, 0, 0], [0.25, -30, 0, 0], [0.45, 15, 0, 0], [0.65, -30, 0, 0], [0.9, 10, 0, 0]])),
      ...CABEZAS.map((id) => rot(`cabeza_${id}`, poses([[0, 0, 0, 0], [0.4, 20, 0, 0], [0.9, 22, 0, 0]]))),
      ...bocas([[0, 0], [0.4, 18], [0.9, 18]]),
      esc('nucleo', poses([[0, 1, 1, 1], [0.9, 1.6, 1.6, 1.6]])),
    ], 'ataque', 'Prepara la embestida: se agacha, gruñe y escarba.', false),

    animacion('Embestir', 0.5, [
      // Galope: delanteras juntas, traseras juntas, el lomo ondula.
      rot('pata_di', ciclo(0.5, (f) => [sen(f) * 55, 0, 0])),
      rot('pata_dd', ciclo(0.5, (f) => [sen(f, 1, 0.08) * 55, 0, 0])),
      rot('pata_ti', ciclo(0.5, (f) => [-sen(f) * 55, 0, 0])),
      rot('pata_td', ciclo(0.5, (f) => [-sen(f, 1, 0.08) * 55, 0, 0])),
      rot('pecho', ciclo(0.5, (f) => [Math.cos(f * TAU) * 8, 0, 0])),
      mov(talla, 'cuerpo', ciclo(0.5, (f) => [0, Math.abs(sen(f)) * 0.35 - 0.1, 0])),
      ...cabezas(0.5, () => [14, 0, 0]),
      rot('cola', ciclo(0.5, (f) => [-10 + sen(f) * 8, 0, 0])),
    ], 'ataque', 'Embestida a galope con las tres cabezas por delante. Bucle mientras dura la carga.'),

    animacion('Salto', 2.3, [
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.5, 0, -0.6, 0], [0.55, 0, -0.5, 0], [1.0, 0, 5.0, 0], [1.5, 0, 0, 0], [1.6, 0, -0.6, 0], [2.3, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.5, 8, 0, 0], [0.8, -20, 0, 0], [1.2, 15, 0, 0], [1.5, 0, 0, 0], [2.3, 0, 0, 0]])),
      rot('pata_di', poses([[0, 0, 0, 0], [0.5, 30, 0, 0], [1.0, -60, 0, 0], [1.45, -20, 0, 0], [1.6, 20, 0, 0], [2.3, 0, 0, 0]])),
      rot('pata_dd', poses([[0, 0, 0, 0], [0.5, 30, 0, 0], [1.0, -60, 0, 0], [1.45, -20, 0, 0], [1.6, 20, 0, 0], [2.3, 0, 0, 0]])),
      rot('pata_ti', poses([[0, 0, 0, 0], [0.5, -30, 0, 0], [1.0, 50, 0, 0], [1.6, -10, 0, 0], [2.3, 0, 0, 0]])),
      rot('pata_td', poses([[0, 0, 0, 0], [0.5, -30, 0, 0], [1.0, 50, 0, 0], [1.6, -10, 0, 0], [2.3, 0, 0, 0]])),
      ...bocas([[0, 0], [1.2, 30], [1.6, 40], [2.0, 0], [2.3, 0]]),
    ], 'ataque', 'Salto: se agacha, vuela con las patas estiradas y cae mordiendo a 1,5 s.', false),

    animacion('Furia', 1.8, [
      // Aúlla con las tres cabezas: empieza la segunda fase.
      ...CABEZAS.map((id, k) => rot(`cabeza_${id}`, poses([[0, 0, 0, 0], [0.4 + k * 0.1, -50, (k - 1) * 15, 0], [1.4, -50, (k - 1) * 15, 0], [1.8, 0, 0, 0]]))),
      ...bocas([[0, 0], [0.5, 45], [1.4, 42], [1.8, 0]]),
      rot('pecho', poses([[0, 0, 0, 0], [0.5, -8, 0, 0], [1.4, -8, 0, 0], [1.8, 0, 0, 0]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.6, 1.8, 1.8, 1.8], [1.4, 1.6, 1.6, 1.6], [1.8, 1.2, 1.2, 1.2]])),
    ], 'reaccion', 'Furia: aúlla con las tres cabezas y el ojo de HELIOS arde.', false),

    animacion('Aliento', TIEMPOS_ALIENTO.duracion, [
      // Baja las cabezas, abre las bocas y barre con el plasma.
      ...CABEZAS.map((id, k) => rot(`cabeza_${id}`, poses([[0, 0, 0, 0], [0.7, 22, 0, 0], [1.2, 22, (k - 1) * 12 + 10, 0], [1.8, 22, (k - 1) * 12 - 10, 0], [2.0, 22, 0, 0], [2.4, 0, 0, 0]]))),
      ...bocas([[0, 0], [0.7, 42], [2.0, 42], [2.4, 0]]),
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.7, 0, -0.3, 0], [2.0, 0, -0.3, 0], [2.4, 0, 0, 0]])),
    ], 'ataque', 'Aliento: baja las tres cabezas y escupe plasma en cono de 0,8 a 2 s.', false),

    animacion('Golpe recibido', 0.35, [
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -6, 0, 3], [0.35, 0, 0, 0]])),
      ...bocas([[0, 0], [0.08, 20], [0.35, 0]]),
    ], 'reaccion', 'Se encoge un instante.', false),

    animacion('Derrota', 3.0, [
      // Se le doblan las patas, se tumba y las cabezas caen.
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [1.0, 0, -0.9, 0], [2.0, 0, -1.3, 0], [3.0, 0, -1.3, 0]])),
      rot('pata_di', poses([[0, 0, 0, 0], [1.0, -60, 0, 0], [3.0, -80, 0, 0]])),
      rot('pata_dd', poses([[0, 0, 0, 0], [1.0, -60, 0, 0], [3.0, -80, 0, 0]])),
      rot('pata_ti', poses([[0, 0, 0, 0], [1.0, 60, 0, 0], [3.0, 80, 0, 0]])),
      rot('pata_td', poses([[0, 0, 0, 0], [1.0, 60, 0, 0], [3.0, 80, 0, 0]])),
      ...CABEZAS.map((id, k) => rot(`cabeza_${id}`, poses([[0, 0, 0, 0], [1.2, -20, 0, 0], [2.2 + k * 0.15, 40, (k - 1) * 20, (k - 1) * 25], [3.0, 40, (k - 1) * 20, (k - 1) * 25]]))),
      esc('nucleo', poses([[0, 1, 1, 1], [2.0, 0.4, 0.4, 0.4], [3.0, 0.05, 0.05, 0.05]])),
    ], 'reaccion', 'Derrota: se le doblan las patas, se tumba y las tres cabezas caen.', false),
  ];

  return { id: 'sabueso-helios', nombre: def.nombre, rol: 'Jefe de altar', raiz, animaciones };
}
