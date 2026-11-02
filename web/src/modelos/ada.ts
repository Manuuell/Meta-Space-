import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, capsula, ciclo, cono, esc, esfera, mov, nodo, parpadeo, pieza, poses, rot,
  toon, toro, type Modelo,
} from './kit.ts';

// Cuatro formas posibles para ADA, la compañera. Todas llevan el núcleo cyan
// del módulo de auditoría y comparten los nombres de animación que usa el
// juego: Reposo, Moverse, Escanear y Hablar. Miran hacia +z.
//
// · Zorro de escarcha: camina por el suelo (origen en las patas).
// · Holograma de Noa, Medusa de plasma y Orbe con anillos: flotan (origen en
//   su centro; el juego las sube a su altura de vuelo).

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);

/** Altura a la que flota cada forma sobre el suelo (0 = camina). */
export const ALTURA_ADA: Record<string, number> = {
  'ada-zorro': 0,
  'ada-noa': 1.5,
  'ada-medusa': 2.3,
  'ada-orbe': 2.0,
  'ada-dron': 2.1,
  bruno: 0,
};

/** Núcleo de ADA: la misma luz cyan que lleva el astronauta en la mochila. */
function nucleo(padre: THREE.Object3D, radio: number, x = 0, y = 0, z = 0) {
  const n = nodo('nucleo', padre, x, y, z);
  pieza(n, esfera(radio), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
  pieza(n, esfera(radio * 0.45), brillo('#e6fdff'), 0, 0, radio * 0.5, { contorno: false, sombra: false });
  return n;
}

const latido = (d: number, veces: number, amp: number) =>
  ciclo(d, (f) => { const k = 1 + amp * sen(f, veces); return [k, k, k]; });

// ================================================================== Zorro

/**
 * Zorro de escarcha: un zorrito robot hecho con chatarra del traje (blanco y
 * naranja como el astronauta), con el núcleo de ADA en el pecho, orejas que
 * son antenas y una cola que hace de linterna.
 */
export function crearAdaZorro(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'ada-zorro';
  const cuerpo = nodo('cuerpo', raiz, 0, 0.5, 0);

  // Tronco: blanco con una placa naranja en el lomo y el núcleo en el pecho.
  pieza(cuerpo, caja(0.42, 0.34, 0.72, 0.15), toon(PALETA.traje));
  pieza(cuerpo, caja(0.34, 0.08, 0.5, 0.04), toon(PALETA.naranja), 0, 0.18, -0.02);
  pieza(cuerpo, toro(0.11, 0.03).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0.0, 0.36);
  nucleo(cuerpo, 0.085, 0, 0, 0.37);

  // Cabeza: naranja con hocico blanco, ojos de luz y orejas-antena.
  const cuello = nodo('cuello', cuerpo, 0, 0.14, 0.3);
  const cabeza = nodo('cabeza', cuello, 0, 0.14, 0.1);
  pieza(cabeza, caja(0.4, 0.32, 0.36, 0.13), toon(PALETA.naranja));
  pieza(cabeza, caja(0.36, 0.14, 0.24, 0.06), toon(PALETA.traje), 0, -0.1, 0.12);
  pieza(cabeza, caja(0.15, 0.11, 0.26, 0.05), toon(PALETA.traje), 0, -0.08, 0.29);
  pieza(cabeza, esfera(0.032, 1.3, 1, 1), toon(PALETA.oscuro), 0, -0.04, 0.42);
  pieza(cabeza, caja(0.3, 0.1, 0.03, 0.03), toon('#1d2b4f'), 0, 0.05, 0.18);
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const o = nodo(`ojo_${lado}`, cabeza, 0.075 * s, 0.05, 0.2);
    pieza(o, capsula(0.024, 0.04), brillo('#9ff8ff'), 0, 0, 0, { contorno: false });
    const oreja = nodo(`oreja_${lado}`, cabeza, 0.12 * s, 0.14, -0.04);
    oreja.rotation.z = -0.25 * s;
    pieza(oreja, cono(0.1, 0.28), toon(PALETA.naranja), 0, 0.14, 0);
    pieza(oreja, cono(0.055, 0.17).translate(0, 0, 0.035), toon(PALETA.oscuro), 0, 0.11, 0, { contorno: false });
    pieza(oreja, esfera(0.03), brillo(PALETA.ada), 0, 0.29, 0, { contorno: false });
  }

  // Patas: cuatro, de metal con almohadilla oscura.
  for (const [nombre, x, z] of [['pata_di', 0.14, 0.24], ['pata_dd', -0.14, 0.24], ['pata_ti', 0.14, -0.24], ['pata_td', -0.14, -0.24]] as const) {
    const pata = nodo(nombre, cuerpo, x, -0.1, z);
    pieza(pata, capsula(0.065, 0.2), toon(PALETA.metal), 0, -0.16, 0);
    pieza(pata, esfera(0.08, 1, 0.7, 1.2), toon(PALETA.oscuro), 0, -0.31, 0.02);
  }

  // Cola: grande y peluda, con la punta blanca que se enciende.
  const cola = nodo('cola', cuerpo, 0, 0.06, -0.36);
  cola.rotation.x = -0.6;
  pieza(cola, esfera(0.15, 1, 1, 2.2), toon(PALETA.naranja), 0, 0, -0.26);
  const punta = nodo('cola_punta', cola, 0, 0, -0.56);
  pieza(punta, esfera(0.13, 1, 1, 1.4), toon(PALETA.traje), 0, 0, -0.04);
  const luz = nodo('luz_cola', punta, 0, 0, -0.1);
  pieza(luz, esfera(0.06), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });

  const D = 2.4, C = 0.42;
  const animaciones = [
    animacion('Reposo', D, [
      mov(raiz, 'cuerpo', ciclo(D, (f) => [0, sen(f, 2) * 0.012, 0])),
      rot('cabeza', ciclo(D, (f) => [sen(f) * 4, sen(f) * 22, sen(f, 2) * 4])),
      rot('cola', ciclo(D, (f) => [-34 + sen(f, 2) * 4, sen(f, 2) * 24, 0])),
      rot('cola_punta', ciclo(D, (f) => [0, sen(f, 2) * 14, 0])),
      rot('oreja_i', ciclo(D, (f) => [0, 0, -14 + (f > 0.7 && f < 0.75 ? -18 : 0)])),
      rot('oreja_d', ciclo(D, () => [0, 0, 14])),
      esc('ojo_i', parpadeo(D, 1.4)),
      esc('ojo_d', parpadeo(D, 1.4)),
      esc('luz_cola', latido(D, 2, 0.2)),
      esc('nucleo', latido(D, 2, 0.15)),
    ], 'movimiento', 'Sentado alerta: mira alrededor, mueve la cola y las orejas.'),

    animacion('Moverse', C, [
      // Galope: patas de delante y de detrás en contrafase.
      rot('pata_di', ciclo(C, (f) => [sen(f) * 50, 0, 0])),
      rot('pata_dd', ciclo(C, (f) => [sen(f + 0.1) * 50, 0, 0])),
      rot('pata_ti', ciclo(C, (f) => [-sen(f) * 50, 0, 0])),
      rot('pata_td', ciclo(C, (f) => [-sen(f + 0.1) * 50, 0, 0])),
      mov(raiz, 'cuerpo', ciclo(C, (f) => [0, Math.abs(sen(f)) * 0.09, 0])),
      rot('cuerpo', ciclo(C, (f) => [cos(f) * 6, 0, 0])),
      rot('cabeza', ciclo(C, (f) => [-cos(f) * 5, 0, 0])),
      rot('cola', ciclo(C, (f) => [-70 + sen(f) * 8, sen(f) * 10, 0])),
      rot('oreja_i', ciclo(C, () => [-30, 0, -10])),
      rot('oreja_d', ciclo(C, () => [-30, 0, 10])),
    ], 'movimiento', 'Galopa con las orejas hacia atrás y la cola estirada.'),

    animacion('Escanear', 1.4, [
      rot('oreja_i', poses([[0, 0, 0, -14], [0.2, 0, 0, 4], [1.2, 0, 0, 4], [1.4, 0, 0, -14]])),
      rot('oreja_d', poses([[0, 0, 0, 14], [0.2, 0, 0, -4], [1.2, 0, 0, -4], [1.4, 0, 0, 14]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.25, -12, 35, 0], [0.7, -12, -35, 0], [1.1, -8, 0, 0], [1.4, 0, 0, 0]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.2, 1.6, 1.6, 1.6], [1.1, 1.4, 1.4, 1.4], [1.4, 1, 1, 1]])),
      esc('luz_cola', poses([[0, 1, 1, 1], [0.2, 1.8, 1.8, 1.8], [1.4, 1, 1, 1]])),
      rot('cola', poses([[0, -34, 0, 0], [0.2, -80, 0, 0], [1.2, -80, 0, 0], [1.4, -34, 0, 0]])),
    ], 'ataque', 'Levanta las orejas-antena, barre con la cabeza y el núcleo se enciende.', false),

    animacion('Hablar', 1.0, [
      rot('cabeza', ciclo(1, (f) => [sen(f, 2) * 6, 0, sen(f) * 12])),
      rot('oreja_i', ciclo(1, (f) => [0, 0, -14 + sen(f, 2) * 8])),
      rot('oreja_d', ciclo(1, (f) => [0, 0, 14 - sen(f, 2) * 8])),
      esc('nucleo', latido(1, 4, 0.25)),
      rot('cola', ciclo(1, (f) => [-40, sen(f, 2) * 30, 0])),
    ], 'reaccion', 'Ladea la cabeza mientras habla; el núcleo late con la voz.'),

    animacion('Atacar', 0.45, [
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.1, 0, -0.04, -0.06], [0.2, 0, 0.05, 0.2], [0.45, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.1, -15, 0, 0], [0.2, 20, 0, 0], [0.45, 0, 0, 0]])),
      rot('pata_di', poses([[0, 0, 0, 0], [0.2, -60, 0, 0], [0.45, 0, 0, 0]])),
      rot('pata_dd', poses([[0, 0, 0, 0], [0.2, -60, 0, 0], [0.45, 0, 0, 0]])),
      rot('pata_ti', poses([[0, 0, 0, 0], [0.2, 45, 0, 0], [0.45, 0, 0, 0]])),
      rot('pata_td', poses([[0, 0, 0, 0], [0.2, 45, 0, 0], [0.45, 0, 0, 0]])),
      rot('oreja_i', poses([[0, 0, 0, -14], [0.2, -40, 0, -10], [0.45, 0, 0, -14]])),
      rot('oreja_d', poses([[0, 0, 0, 14], [0.2, -40, 0, 10], [0.45, 0, 0, 14]])),
    ], 'ataque', 'Se lanza hacia delante y muerde.', false),

    animacion('Habilidad', 1.4, [
      // Aullido helado: hocico al cielo y el núcleo a tope.
      rot('cuerpo', poses([[0, 0, 0, 0], [0.25, -18, 0, 0], [1.1, -18, 0, 0], [1.4, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.25, -45, 0, 0], [1.1, -50, 0, 0], [1.4, 0, 0, 0]])),
      rot('oreja_i', poses([[0, 0, 0, -14], [0.25, -45, 0, -14], [1.1, -45, 0, -14], [1.4, 0, 0, -14]])),
      rot('oreja_d', poses([[0, 0, 0, 14], [0.25, -45, 0, 14], [1.1, -45, 0, 14], [1.4, 0, 0, 14]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.25, 2, 2, 2], [1.1, 1.8, 1.8, 1.8], [1.4, 1, 1, 1]])),
      esc('luz_cola', poses([[0, 1, 1, 1], [0.25, 2.4, 2.4, 2.4], [1.1, 2, 2, 2], [1.4, 1, 1, 1]])),
    ], 'ataque', 'Aúlla al cielo: una onda de escarcha frena a la horda.', false),
  ];

  return { id: 'ada-zorro', nombre: 'ADA · Zorro de escarcha', rol: 'Compañera · camina a tu lado', raiz, animaciones };
}

// ============================================================ Holograma

/**
 * Holograma de Noa Herrera: una proyección cyan de la ingeniera que flota
 * sobre un pequeño emisor. De cintura para abajo se deshace en luz.
 */
export function crearAdaNoa(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'ada-noa';

  // Tres tonos de la misma luz, translúcidos pero sin mezcla aditiva: así
  // el pelo y la bata se leen como formas y no se pierden en el cielo.
  const holo = new THREE.MeshBasicMaterial({ color: '#62d9f7', transparent: true, opacity: 0.78 });
  const holoClaro = new THREE.MeshBasicMaterial({ color: '#d4faff', transparent: true, opacity: 0.9 });
  const holoOscuro = new THREE.MeshBasicMaterial({ color: '#2a7fb8', transparent: true, opacity: 0.8 });
  const h = (padre: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) =>
    pieza(padre, geo, mat, x, y, z, { contorno: false, sombra: false });

  // Emisor: un disco de metal flotando, con anillo de luz y el haz hacia arriba.
  const emisor = nodo('emisor', raiz, 0, -0.95, 0);
  pieza(emisor, barril(0.2, 0.16, 0.1, 0.04), toon(PALETA.metalOscuro));
  pieza(emisor, toro(0.17, 0.025), brillo(PALETA.ada), 0, 0.05, 0, { contorno: false });
  nucleo(emisor, 0.06, 0, 0.07, 0);
  h(emisor, new THREE.CylinderGeometry(0.32, 0.12, 0.5, 20, 1, true), new THREE.MeshBasicMaterial({
    color: PALETA.ada, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }), 0, 0.3, 0);

  const figura = nodo('figura', raiz, 0, 0, 0);
  // Falda de luz: la figura se deshace hacia el emisor.
  h(figura, cono(0.3, 0.6).rotateX(Math.PI), holoOscuro, 0, -0.42, 0);
  // Torso con bata de laboratorio (solapas claras) y cinturón de herramientas.
  const torso = nodo('torso', figura, 0, -0.1, 0);
  h(torso, caja(0.38, 0.42, 0.24, 0.1), holo, 0, 0.2, 0);
  h(torso, caja(0.08, 0.32, 0.02, 0.01), holoClaro, 0.08, 0.24, 0.12);
  h(torso, caja(0.08, 0.32, 0.02, 0.01), holoClaro, -0.08, 0.24, 0.12);
  h(torso, caja(0.4, 0.05, 0.26, 0.02), holoClaro, 0, 0.02, 0);
  // Cabeza: pelo corto con flequillo y unas gafas de trabajo en la frente.
  const cabeza = nodo('cabeza', torso, 0, 0.5, 0);
  h(cabeza, esfera(0.17), holo, 0, 0.12, 0);
  // Melena corta por la barbilla, con flequillo, y gafas de taller en la frente.
  h(cabeza, esfera(0.2, 1.08, 0.95, 1.05), holoOscuro, 0, 0.17, -0.035);
  h(cabeza, caja(0.08, 0.24, 0.2, 0.04), holoOscuro, 0.16, 0.06, -0.01);
  h(cabeza, caja(0.08, 0.24, 0.2, 0.04), holoOscuro, -0.16, 0.06, -0.01);
  h(cabeza, caja(0.3, 0.08, 0.1, 0.04), holoOscuro, 0, 0.24, 0.12);
  h(cabeza, caja(0.28, 0.05, 0.05, 0.02), holoClaro, 0, 0.31, 0.12);
  h(cabeza, caja(0.06, 0.012, 0.01, 0.005), holoOscuro, 0, 0.05, 0.168);
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const o = nodo(`ojo_${lado}`, cabeza, 0.06 * s, 0.12, 0.155);
    h(o, esfera(0.025), holoClaro);
    const hombro = nodo(`hombro_${lado}`, torso, 0.24 * s, 0.36, 0);
    hombro.rotation.z = 0.15 * s;
    h(hombro, capsula(0.06, 0.2), holo, 0, -0.16, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.3, 0);
    h(codo, capsula(0.05, 0.16), holo, 0, -0.12, 0);
    h(codo, esfera(0.055), holoClaro, 0, -0.25, 0);
  }
  // Una tableta de datos en la mano izquierda: ADA era su herramienta.
  const tableta = nodo('tableta', figura.getObjectByName('codo_i')!, 0, -0.26, 0.08);
  tableta.rotation.x = -0.9;
  h(tableta, caja(0.16, 0.2, 0.015, 0.01), holoClaro);

  // Líneas de barrido: tres anillos que suben por la figura.
  for (let k = 0; k < 3; k++) {
    const linea = nodo(`barrido_${k}`, figura);
    h(linea, toro(0.3, 0.006), holoClaro);
  }

  const D = 3.0;
  const barrido = (k: number, d: number) => ciclo(d, (f) => [0, ((f + k / 3) % 1) * 1.3 - 0.55, 0]);
  const animaciones = [
    animacion('Reposo', D, [
      mov(raiz, 'figura', ciclo(D, (f) => [0, sen(f) * 0.04, 0])),
      // Fallo de señal: un tirón lateral breve.
      esc('figura', ciclo(D, (f) => [f > 0.62 && f < 0.66 ? 1.25 : 1, f > 0.62 && f < 0.66 ? 0.92 : 1, 1])),
      rot('cabeza', ciclo(D, (f) => [sen(f) * 4, sen(f) * 18, sen(f, 2) * 3])),
      rot('hombro_i', ciclo(D, (f) => [-30 + sen(f, 2) * 3, 0, 12])),
      rot('codo_i', ciclo(D, () => [-60, 0, 0])),
      rot('hombro_d', ciclo(D, (f) => [sen(f, 2) * 3, 0, -10])),
      mov(raiz, 'barrido_0', barrido(0, D)),
      mov(raiz, 'barrido_1', barrido(1, D)),
      mov(raiz, 'barrido_2', barrido(2, D)),
      esc('ojo_i', parpadeo(D, 2.1)),
      esc('ojo_d', parpadeo(D, 2.1)),
    ], 'movimiento', 'Flota consultando su tableta; de vez en cuando la señal falla.'),

    animacion('Moverse', 1.0, [
      rot('figura', ciclo(1, () => [16, 0, 0])),
      rot('hombro_i', ciclo(1, (f) => [-20, 0, 18 + sen(f) * 4])),
      rot('codo_i', ciclo(1, () => [-50, 0, 0])),
      rot('hombro_d', ciclo(1, (f) => [25, 0, -18 - sen(f) * 4])),
      rot('cabeza', ciclo(1, () => [-12, 0, 0])),
      mov(raiz, 'barrido_0', barrido(0, 1)),
      mov(raiz, 'barrido_1', barrido(1, 1)),
      mov(raiz, 'barrido_2', barrido(2, 1)),
    ], 'movimiento', 'Se inclina hacia donde va, con los brazos atrás.'),

    animacion('Escanear', 1.6, [
      rot('hombro_d', poses([[0, 0, 0, -10], [0.25, -100, 0, -20], [1.3, -100, 0, -20], [1.6, 0, 0, -10]])),
      rot('codo_d', poses([[0, 0, 0, 0], [0.25, -10, 0, 0], [1.6, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.3, 0, 30, 0], [0.8, 0, -30, 0], [1.3, 0, 0, 0], [1.6, 0, 0, 0]])),
      rot('torso', poses([[0, 0, 0, 0], [0.3, 0, 25, 0], [0.8, 0, -25, 0], [1.3, 0, 0, 0], [1.6, 0, 0, 0]])),
      mov(raiz, 'barrido_0', barrido(0, 0.4).map(([t, x, y, z]) => [t * 4, x, y, z] as const)),
      esc('figura', poses([[0, 1, 1, 1], [0.2, 1.05, 1.05, 1.05], [1.4, 1.05, 1.05, 1.05], [1.6, 1, 1, 1]])),
    ], 'ataque', 'Alza la mano y barre la zona girando el torso.', false),

    animacion('Hablar', 1.2, [
      rot('cabeza', ciclo(1.2, (f) => [sen(f, 2) * 5, sen(f) * 8, sen(f) * 6])),
      rot('hombro_d', ciclo(1.2, (f) => [-40 + sen(f, 2) * 15, 0, -20])),
      rot('codo_d', ciclo(1.2, (f) => [-50 + sen(f, 2) * 20, 0, 0])),
      rot('hombro_i', ciclo(1.2, () => [-30, 0, 12])),
      rot('codo_i', ciclo(1.2, () => [-60, 0, 0])),
    ], 'reaccion', 'Gesticula con la mano libre mientras habla.'),

    animacion('Atacar', 0.5, [
      rot('hombro_d', poses([[0, 0, 0, -10], [0.12, -88, 0, -8], [0.38, -88, 0, -8], [0.5, 0, 0, -10]])),
      rot('codo_d', poses([[0, 0, 0, 0], [0.12, 0, 0, 0], [0.5, 0, 0, 0]])),
      rot('torso', poses([[0, 0, 0, 0], [0.12, 0, -18, 0], [0.38, 0, -18, 0], [0.5, 0, 0, 0]])),
    ], 'ataque', 'Señala al objetivo y le lanza un rayo de datos.', false),

    animacion('Habilidad', 1.2, [
      rot('hombro_i', poses([[0, -30, 0, 12], [0.3, 0, 0, 150], [0.9, 0, 0, 150], [1.2, -30, 0, 12]])),
      rot('codo_i', poses([[0, -60, 0, 0], [0.3, 0, 0, 0], [0.9, 0, 0, 0], [1.2, -60, 0, 0]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.3, 0, 0, -150], [0.9, 0, 0, -150], [1.2, 0, 0, -10]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.3, -20, 0, 0], [0.9, -20, 0, 0], [1.2, 0, 0, 0]])),
      esc('figura', poses([[0, 1, 1, 1], [0.3, 1.12, 1.12, 1.12], [0.9, 1.12, 1.12, 1.12], [1.2, 1, 1, 1]])),
    ], 'ataque', 'Alza los brazos y reconstruye el traje: parche de Noa.', false),
  ];

  return { id: 'ada-noa', nombre: 'ADA · Holograma de Noa', rol: 'Compañera · proyección flotante', raiz, animaciones };
}

// ============================================================== Medusa

/**
 * Medusa de plasma: una campana translúcida con el núcleo de ADA dentro, dos
 * ojitos y seis tentáculos de luz que ondulan al seguirte.
 */
export function crearAdaMedusa(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'ada-medusa';
  const cuerpo = nodo('cuerpo', raiz);

  const campana = nodo('campana', cuerpo, 0, 0.1, 0);
  const piel = toon('#8fe3ff');
  const velo = new THREE.MeshToonMaterial({ color: '#b98cff', transparent: true, opacity: 0.55, depthWrite: false });
  pieza(campana, new THREE.SphereGeometry(0.46, 28, 14, 0, TAU, 0, Math.PI / 2).scale(1, 0.85, 1), piel);
  // Borde ondulado: un toro algo aplastado con lunares de luz.
  pieza(campana, toro(0.44, 0.06).scale(1, 0.7, 1), toon('#5fc6f0'), 0, 0.01, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    pieza(campana, esfera(0.035), brillo('#e6fdff'), Math.sin(a) * 0.44, 0.01, Math.cos(a) * 0.44, { contorno: false });
  }
  // Manchas violeta en la campana: la marca del velo que la tiñe.
  for (const [x, y, z] of [[0.2, 0.3, -0.18], [-0.24, 0.24, -0.12], [0.02, 0.36, -0.22]] as const) {
    pieza(campana, esfera(0.07, 1, 0.5, 1), toon('#9d7bff'), x, y, z, { contorno: false });
  }
  // Ojos grandes de dibujo animado y una boquita.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const o = nodo(`ojo_${lado}`, campana, 0.14 * s, 0.2, 0.36);
    pieza(o, esfera(0.075, 0.85, 1.1, 0.5), toon(PALETA.oscuroHelios));
    pieza(o, esfera(0.026), brillo(PALETA.blanco), 0.02, 0.035, 0.035, { contorno: false });
  }
  pieza(campana, toro(0.035, 0.012).rotateX(Math.PI / 2).scale(1, 0.6, 1), toon(PALETA.oscuroHelios), 0, 0.1, 0.42, { contorno: false });

  // Velo interior y el núcleo de ADA flotando dentro.
  pieza(cuerpo, esfera(0.34, 1, 0.5, 1), velo, 0, 0.06, 0, { contorno: false, sombra: false });
  nucleo(cuerpo, 0.11, 0, 0.0, 0);

  // Tentáculos: seis cadenas de tres segmentos, con la punta brillante.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    const t0 = nodo(`tentaculo_${k}`, cuerpo, Math.sin(a) * 0.28, -0.02, Math.cos(a) * 0.28);
    let padre: THREE.Object3D = t0;
    for (let j = 0; j < 3; j++) {
      const r = 0.042 - j * 0.01;
      // Segmentos que se solapan: el tentáculo se ve continuo al doblarse.
      pieza(padre, capsula(r, 0.2), toon(j === 0 ? '#5fc6f0' : '#8fe3ff'), 0, -0.12, 0);
      padre = nodo(`tentaculo_${k}_${j + 1}`, padre, 0, -0.22, 0);
    }
    pieza(padre, esfera(0.04), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
  }

  // Cada tentáculo se abre hacia fuera desde su sitio en el borde y luego se
  // curva hacia dentro, ondulando con un desfase: nada de patas rectas.
  const ondas = (d: number, amp: number, inclina = 0, abre = 22) => Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * TAU + 0.3;
    const fuera = (g: number): [number, number] => [-Math.cos(a) * g, Math.sin(a) * g];
    return [
      rot(`tentaculo_${k}`, ciclo(d, (f) => {
        const [x, z] = fuera(abre + sen(f + k / 6) * amp);
        return [x + inclina, 0, z];
      })),
      rot(`tentaculo_${k}_1`, ciclo(d, (f) => { const [x, z] = fuera(-12 + sen(f + k / 6 + 0.15) * amp * 1.3); return [x, 0, z]; })),
      rot(`tentaculo_${k}_2`, ciclo(d, (f) => { const [x, z] = fuera(-14 + sen(f + k / 6 + 0.3) * amp * 1.5); return [x, 0, z]; })),
    ];
  }).flat();

  const D = 2.0;
  const animaciones = [
    animacion('Reposo', D, [
      esc('campana', ciclo(D, (f) => { const k = sen(f); return [1 + 0.08 * k, 1 - 0.1 * k, 1 + 0.08 * k]; })),
      mov(raiz, 'cuerpo', ciclo(D, (f) => [0, -cos(f) * 0.08, 0])),
      ...ondas(D, 14),
      esc('nucleo', latido(D, 2, 0.15)),
      esc('ojo_i', parpadeo(D, 1.3)),
      esc('ojo_d', parpadeo(D, 1.3)),
    ], 'movimiento', 'Late despacio: se encoge, sube un poco y los tentáculos ondulan.'),

    animacion('Moverse', 0.8, [
      esc('campana', ciclo(0.8, (f) => { const k = sen(f); return [1 + 0.14 * k, 1 - 0.16 * k, 1 + 0.14 * k]; })),
      rot('cuerpo', ciclo(0.8, () => [28, 0, 0])),
      ...ondas(0.8, 10, 35),
    ], 'movimiento', 'Se inclina y bombea fuerte; los tentáculos quedan atrás.'),

    animacion('Escanear', 1.2, [
      esc('campana', poses([[0, 1, 1, 1], [0.15, 1.3, 0.7, 1.3], [0.4, 0.9, 1.15, 0.9], [0.7, 1.05, 0.95, 1.05], [1.2, 1, 1, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.15, 2.2, 2.2, 2.2], [0.8, 1.4, 1.4, 1.4], [1.2, 1, 1, 1]])),
      ...Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * TAU + 0.3, cx = -Math.cos(a), sz = Math.sin(a);
        return rot(`tentaculo_${k}`, poses([[0, cx * 22, 0, sz * 22], [0.15, cx * 75, 0, sz * 75], [0.9, cx * 30, 0, sz * 30], [1.2, cx * 22, 0, sz * 22]]));
      }),
    ], 'ataque', 'Abre la campana de golpe, el núcleo destella y los tentáculos se despliegan.', false),

    animacion('Hablar', 0.9, [
      esc('nucleo', latido(0.9, 3, 0.3)),
      esc('campana', ciclo(0.9, (f) => { const k = sen(f, 3) * 0.04; return [1 + k, 1 - k, 1 + k]; })),
      rot('campana', ciclo(0.9, (f) => [0, 0, sen(f) * 8])),
      ...ondas(0.9, 8),
    ], 'reaccion', 'El núcleo late al ritmo de la voz y la campana se mece.'),

    animacion('Atacar', 0.6, [
      ...Array.from({ length: 6 }, (_, k) => rot(`tentaculo_${k}`, poses([[0, 0, 0, 0], [0.15, -70, 0, 0], [0.35, -40, 0, 0], [0.6, 0, 0, 0]]))),
      esc('nucleo', poses([[0, 1, 1, 1], [0.15, 1.6, 1.6, 1.6], [0.6, 1, 1, 1]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.15, 18, 0, 0], [0.6, 0, 0, 0]])),
    ], 'ataque', 'Latiga con los tentáculos y suelta una descarga en cadena.', false),

    animacion('Habilidad', 1.2, [
      esc('campana', poses([[0, 1, 1, 1], [0.2, 1.4, 0.65, 1.4], [0.5, 0.85, 1.2, 0.85], [0.8, 1.08, 0.94, 1.08], [1.2, 1, 1, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.2, 2.4, 2.4, 2.4], [0.9, 1.6, 1.6, 1.6], [1.2, 1, 1, 1]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.2, 0, -0.15, 0], [0.5, 0, 0.2, 0], [1.2, 0, 0, 0]])),
    ], 'ataque', 'Un latido enorme: la marea atrae toda la chatarra.', false),
  ];

  return { id: 'ada-medusa', nombre: 'ADA · Medusa de plasma', rol: 'Compañera · flota a tu lado', raiz, animaciones };
}

// ================================================================ Orbe

/**
 * Orbe con anillos: el núcleo de ADA al desnudo dentro de una carcasa con un
 * solo ojo, rodeado de tres anillos de giroscopio que giran según lo que hace.
 */
export function crearAdaOrbe(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'ada-orbe';
  const cuerpo = nodo('cuerpo', raiz);

  // Carcasa: dos casquetes blancos que dejan ver el núcleo por la franja.
  const carcasa = nodo('carcasa', cuerpo);
  pieza(carcasa, new THREE.SphereGeometry(0.3, 28, 12, 0, TAU, 0, Math.PI * 0.42), toon(PALETA.traje));
  pieza(carcasa, new THREE.SphereGeometry(0.3, 28, 12, 0, TAU, Math.PI * 0.58, Math.PI * 0.42), toon(PALETA.traje));
  pieza(carcasa, toro(0.29, 0.03), toon(PALETA.naranja), 0, 0.075, 0);
  pieza(carcasa, toro(0.29, 0.03), toon(PALETA.naranja), 0, -0.075, 0);
  nucleo(cuerpo, 0.24);
  // El ojo: una ranura oscura con la pupila de luz, delante.
  const ojo = nodo('ojo', carcasa, 0, 0.13, 0.26);
  ojo.rotation.x = -0.45;
  pieza(ojo, caja(0.2, 0.09, 0.05, 0.04), toon('#1d2b4f'));
  pieza(ojo, capsula(0.026, 0.05).rotateZ(Math.PI / 2), brillo('#e6fdff'), 0, 0, 0.03, { contorno: false, nombre: 'pupila' });
  // Antena corta con baliza, como el astronauta.
  pieza(carcasa, capsula(0.015, 0.12), toon(PALETA.metalOscuro), 0.1, 0.33, -0.05);
  pieza(carcasa, esfera(0.035), brillo(PALETA.plasma), 0.1, 0.42, -0.05, { contorno: false });

  // Tres anillos de giroscopio, cada uno en su eje, con cuentas de luz.
  const anillos: [string, number, string][] = [['anillo_1', 0.46, PALETA.metal], ['anillo_2', 0.56, PALETA.naranja], ['anillo_3', 0.66, PALETA.metalOscuro]];
  anillos.forEach(([nombre, r, color], k) => {
    const a = nodo(nombre, cuerpo);
    pieza(a, toro(r, 0.022), toon(color));
    for (let j = 0; j < 3; j++) {
      const ang = (j / 3) * TAU + k;
      pieza(a, esfera(0.032), brillo(k === 1 ? PALETA.ada : '#e6fdff'), Math.sin(ang) * r, 0, Math.cos(ang) * r, { contorno: false });
    }
  });

  const giro = (d: number, ejes: [number, number, number][], vueltas: number[]) => anillos.map(([nombre], k) =>
    rot(nombre, ciclo(d, (f) => {
      const [x, y, z] = ejes[k];
      return [x, y + f * 360 * vueltas[k], z];
    })),
  );

  const D = 4.0;
  const animaciones = [
    animacion('Reposo', D, [
      ...giro(D, [[70, 0, 0], [20, 0, 60], [-40, 0, -30]], [1, -1, 1]),
      mov(raiz, 'cuerpo', ciclo(D, (f) => [0, sen(f, 2) * 0.05, 0])),
      rot('carcasa', ciclo(D, (f) => [sen(f) * 6, sen(f) * 25, 0])),
      esc('nucleo', latido(D, 2, 0.08)),
      esc('ojo', parpadeo(D, 2.6)),
    ], 'movimiento', 'Flota mirando alrededor; los anillos giran despacio, cada uno en su eje.'),

    animacion('Moverse', 1.0, [
      // Los anillos se alinean detrás, como una estela.
      ...giro(1, [[90, 0, 0], [90, 0, 0], [90, 0, 0]], [1, 1, 1]),
      rot('carcasa', ciclo(1, () => [14, 0, 0])),
    ], 'movimiento', 'Los anillos se alinean y giran juntos mientras avanza.'),

    animacion('Escanear', 1.4, [
      ...giro(1.4, [[0, 0, 0], [60, 0, 0], [-60, 0, 0]], [3, -3, 3]),
      esc('anillo_1', poses([[0, 1, 1, 1], [0.2, 1.5, 1.5, 1.5], [1.1, 1.5, 1.5, 1.5], [1.4, 1, 1, 1]])),
      esc('anillo_2', poses([[0, 1, 1, 1], [0.25, 1.6, 1.6, 1.6], [1.1, 1.6, 1.6, 1.6], [1.4, 1, 1, 1]])),
      esc('anillo_3', poses([[0, 1, 1, 1], [0.3, 1.7, 1.7, 1.7], [1.1, 1.7, 1.7, 1.7], [1.4, 1, 1, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.2, 1.3, 1.3, 1.3], [1.2, 1.3, 1.3, 1.3], [1.4, 1, 1, 1]])),
    ], 'ataque', 'Los anillos se abren y giran a toda velocidad: barrido completo.', false),

    animacion('Hablar', 0.8, [
      ...giro(0.8, [[70, 0, 0], [20, 0, 60], [-40, 0, -30]], [1, -1, 1]),
      esc('nucleo', latido(0.8, 3, 0.2)),
      esc('pupila', ciclo(0.8, (f) => [1, 1 + Math.abs(sen(f, 3)) * 0.8, 1])),
      rot('carcasa', ciclo(0.8, (f) => [sen(f, 2) * 6, 0, sen(f) * 5])),
    ], 'reaccion', 'La pupila se abre y cierra con la voz; el núcleo late.'),

    animacion('Atacar', 0.5, [
      ...giro(0.5, [[70, 0, 0], [20, 0, 60], [-40, 0, -30]], [1, -1, 1]),
      esc('anillo_1', poses([[0, 1, 1, 1], [0.1, 1.25, 1.25, 1.25], [0.5, 1, 1, 1]])),
      esc('anillo_2', poses([[0, 1, 1, 1], [0.15, 1.25, 1.25, 1.25], [0.5, 1, 1, 1]])),
      esc('anillo_3', poses([[0, 1, 1, 1], [0.2, 1.25, 1.25, 1.25], [0.5, 1, 1, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.1, 1.3, 1.3, 1.3], [0.5, 1, 1, 1]])),
    ], 'ataque', 'Los anillos destellan al cortar lo que tienen cerca.', false),

    animacion('Habilidad', 1.2, [
      ...giro(1.2, [[0, 0, 0], [60, 0, 0], [-60, 0, 0]], [4, -4, 4]),
      esc('anillo_1', poses([[0, 1, 1, 1], [0.3, 2.2, 2.2, 2.2], [0.9, 2.2, 2.2, 2.2], [1.2, 1, 1, 1]])),
      esc('anillo_2', poses([[0, 1, 1, 1], [0.3, 2.4, 2.4, 2.4], [0.9, 2.4, 2.4, 2.4], [1.2, 1, 1, 1]])),
      esc('anillo_3', poses([[0, 1, 1, 1], [0.3, 2.6, 2.6, 2.6], [0.9, 2.6, 2.6, 2.6], [1.2, 1, 1, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.3, 1.8, 1.8, 1.8], [0.9, 1.8, 1.8, 1.8], [1.2, 1, 1, 1]])),
    ], 'ataque', 'Sobrecarga: los anillos se abren y el núcleo estalla.', false),
  ];

  return { id: 'ada-orbe', nombre: 'ADA · Orbe con anillos', rol: 'Compañera · núcleo flotante', raiz, animaciones };
}

// ================================================================= Dron

/**
 * Dron de ADA: el inspector de turbina reprogramado, rehecho con el mismo
 * lenguaje que el traje del astronauta: casco blanco con franja naranja, visor
 * azul noche con dos ojos de luz, tres brazos con rotores protegidos por aros
 * de plasma y el núcleo de ADA latiendo debajo.
 */
export function crearAdaDron(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'ada-dron';
  const cuerpo = nodo('cuerpo', raiz);

  // Casco: blanco, con la franja naranja de la nuca a la frente como el traje.
  const casco = nodo('casco', cuerpo);
  pieza(casco, esfera(0.34, 1, 0.9, 1), toon(PALETA.traje));
  pieza(casco, new THREE.TorusGeometry(0.34, 0.035, 8, 32, Math.PI * 0.75).rotateY(Math.PI / 2).rotateX(-Math.PI * 0.1), toon(PALETA.naranja), 0, 0, 0);
  pieza(casco, toro(0.3, 0.05), toon(PALETA.metalOscuro), 0, -0.16, 0);
  // Orejeras naranjas, como el casco del astronauta.
  for (const s of [1, -1]) pieza(casco, esfera(0.1, 0.5, 1, 1), toon(PALETA.naranja), 0.33 * s, 0, 0);

  // Visor: franja azul noche con dos ojos de luz y un reflejo.
  pieza(casco, esfera(0.27, 1.05, 0.7, 0.6), toon('#1d2b4f'), 0, 0.01, 0.2);
  const reflejo = pieza(casco, caja(0.1, 0.03, 0.02, 0.012), brillo(PALETA.blanco), 0.14, 0.1, 0.33, { contorno: false });
  reflejo.rotation.z = 0.4;
  for (const [lado, x] of [['i', 0.08], ['d', -0.08]] as const) {
    const o = nodo(`ojo_${lado}`, casco, x, 0.01, 0.355);
    pieza(o, capsula(0.035, 0.06), brillo('#9ff8ff'), 0, 0, 0, { contorno: false });
  }

  // Antena con baliza de plasma.
  const antena = nodo('antena', casco, -0.12, 0.27, -0.05);
  antena.rotation.z = 0.3;
  pieza(antena, capsula(0.018, 0.18), toon(PALETA.metalOscuro), 0, 0.1, 0);
  const baliza = nodo('baliza', antena, 0, 0.23, 0);
  pieza(baliza, esfera(0.045), brillo(PALETA.plasma), 0, 0, 0, { contorno: false });

  // Tres brazos con rotor: góndola de metal, aspas y un aro de plasma.
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI;
    const brazo = nodo(`brazo_${k}`, cuerpo, 0, 0.02, 0);
    brazo.rotation.y = a;
    const viga = pieza(brazo, capsula(0.035, 0.32), toon(PALETA.metalOscuro), 0, 0.06, 0.4);
    viga.rotation.x = Math.PI / 2 - 0.35;
    const gondola = nodo(`gondola_${k}`, brazo, 0, 0.13, 0.6);
    pieza(gondola, barril(0.07, 0.08, 0.1, 0.03), toon(PALETA.metal));
    pieza(gondola, toro(0.2, 0.022), brillo(PALETA.ada), 0, 0.03, 0, { contorno: false });
    const rotor = nodo(`rotor_${k}`, gondola, 0, 0.07, 0);
    pieza(rotor, esfera(0.035), toon(PALETA.naranja));
    pieza(rotor, caja(0.34, 0.015, 0.06, 0.008), toon(PALETA.traje), 0, 0.01, 0);
    pieza(rotor, caja(0.06, 0.015, 0.34, 0.008), toon(PALETA.traje), 0, 0.01, 0);
  }

  // Debajo: el núcleo de ADA en su anillo, la luz que lo hace inconfundible.
  pieza(cuerpo, toro(0.13, 0.03), toon(PALETA.metalOscuro), 0, -0.3, 0);
  nucleo(cuerpo, 0.09, 0, -0.3, 0);
  const halo = nodo('halo', cuerpo, 0, -0.36, 0);
  pieza(halo, new THREE.CircleGeometry(0.22, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({
    color: PALETA.ada, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
  }), 0, 0, 0, { contorno: false, sombra: false });

  const rotores = (d: number, vueltas: number) => [0, 1, 2].map((k) =>
    rot(`rotor_${k}`, ciclo(d, (f) => [0, f * 360 * vueltas * (k % 2 ? -1 : 1), 0])));
  const D = 2.0;
  const animaciones = [
    animacion('Reposo', D, [
      ...rotores(D, 8),
      mov(raiz, 'cuerpo', ciclo(D, (f) => [0, sen(f) * 0.06, 0])),
      rot('casco', ciclo(D, (f) => [sen(f) * 4, sen(f) * 22, sen(f, 2) * 3])),
      rot('cuerpo', ciclo(D, (f) => [0, 0, sen(f) * 4])),
      rot('antena', ciclo(D, (f) => [sen(f, 2) * 6, 0, 17 + sen(f) * 5])),
      esc('baliza', ciclo(D, (f) => { const k = sen(f, 2) > 0 ? 1.25 : 0.7; return [k, k, k]; })),
      esc('nucleo', latido(D, 2, 0.15)),
      esc('ojo_i', parpadeo(D, 1.4)),
      esc('ojo_d', parpadeo(D, 1.4)),
    ], 'movimiento', 'Flota mirando alrededor, con los rotores girando y ADA latiendo debajo.'),

    animacion('Moverse', 0.8, [
      ...rotores(0.8, 6),
      rot('cuerpo', ciclo(0.8, (f) => [16, 0, sen(f) * 3])),
      rot('casco', ciclo(0.8, () => [-10, 0, 0])),
      rot('antena', ciclo(0.8, (f) => [-25 + sen(f, 2) * 5, 0, 17])),
      esc('halo', ciclo(0.8, () => [1.25, 1, 1.25])),
    ], 'movimiento', 'Se inclina hacia donde va, con los rotores a tope y la antena echada atrás.'),

    animacion('Escanear', 1.4, [
      ...rotores(1.4, 10),
      rot('casco', poses([[0, 0, 0, 0], [0.2, -12, 0, 0], [1.1, -12, 360, 0], [1.4, 0, 360, 0]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.2, 1.4, 0.5, 1], [1.2, 1.4, 0.5, 1], [1.4, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.2, 1.4, 0.5, 1], [1.2, 1.4, 0.5, 1], [1.4, 1, 1, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.2, 1.8, 1.8, 1.8], [1.2, 1.5, 1.5, 1.5], [1.4, 1, 1, 1]])),
      esc('halo', poses([[0, 1, 1, 1], [0.2, 2.2, 1, 2.2], [1.2, 1.8, 1, 1.8], [1.4, 1, 1, 1]])),
    ], 'ataque', 'Gira el casco barriendo la zona con los ojos entornados y el núcleo encendido.', false),

    animacion('Hablar', 0.8, [
      ...rotores(0.8, 4),
      rot('casco', ciclo(0.8, (f) => [sen(f, 2) * 6, sen(f) * 8, sen(f) * 6])),
      esc('ojo_i', ciclo(0.8, (f) => [1, 1 - Math.abs(sen(f, 3)) * 0.4, 1])),
      esc('ojo_d', ciclo(0.8, (f) => [1, 1 - Math.abs(sen(f, 3)) * 0.4, 1])),
      esc('nucleo', latido(0.8, 3, 0.25)),
      rot('antena', ciclo(0.8, (f) => [sen(f, 4) * 10, 0, 17])),
    ], 'reaccion', 'Asiente mientras habla; los ojos y el núcleo laten con la voz.'),

    animacion('Atacar', 0.4, [
      ...rotores(0.4, 2),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.06, 0, 0.02, -0.12], [0.4, 0, 0, 0]])),
      rot('casco', poses([[0, 0, 0, 0], [0.06, -14, 0, 0], [0.4, 0, 0, 0]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.06, 1.5, 1.3, 1], [0.4, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.06, 1.5, 1.3, 1], [0.4, 1, 1, 1]])),
    ], 'ataque', 'Retrocede con el disparo del láser y los ojos destellan.', false),

    animacion('Habilidad', 1.0, [
      ...rotores(1.0, 12),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.7, 0, 720, 0], [1.0, 0, 720, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.3, 0, 0.25, 0], [1.0, 0, 0, 0]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.3, 2.2, 2.2, 2.2], [1.0, 1, 1, 1]])),
      esc('halo', poses([[0, 1, 1, 1], [0.3, 2.6, 1, 2.6], [1.0, 1, 1, 1]])),
    ], 'ataque', 'Sube girando sobre sí mismo y dispara la ráfaga con el núcleo a tope.', false),
  ];

  return { id: 'ada-dron', nombre: 'ADA · Dron', rol: 'Compañera · vuela a tu lado', raiz, animaciones };
}
