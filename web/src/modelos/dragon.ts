import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, ciclo, conDetalle, esc, mov, nodo, pieza, poses, punta, rot, toon,
  type Modelo,
} from './kit.ts';
import { halo, materialBrillante, placas } from './brillo.ts';

// Dragón del Velo: el avión con el que HELIOS siembra el velo, construido
// con forma de dragón. Nada de murciélago negro: casco claro de chapa con
// circuitos cian, alas de paneles solares (rejilla encendida) en dos tramos,
// cabeza en cuña con un visor que brilla y antenas por cuernos, dos tanques
// de sulfato bajo la panza y, en la punta de la cola, un rotor de tres palas.
// Mira hacia +z. Posado mide unos 5 m; de punta a punta de ala, 19 m.
//
// El juego mueve la raíz (altura, inclinación) y gira el `rotor`; el chorro
// del aliento (`aliento`) también lo enciende el juego. Ningún clip los toca.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const CASCO = '#d8dde8', PANEL = '#1d2b4f', LUZ = PALETA.ada, SULFATO = '#d6ff5a';
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

/** Altura del cuerpo sobre los pies: posado, la raíz está en el suelo. */
export const ALTURA_DRAGON = 2.8;
export const TIEMPOS_DRAGON = { aliento: { empieza: 0.8, acaba: 2.0, duracion: 2.4 }, aterrizar: 1.4, despegar: 1.2, rugir: 1.6 } as const;

export function crearDragon(): Modelo {
  return conDetalle(0.6, montar);
}

function montar(): Modelo {
  const casco = materialBrillante(CASCO, LUZ, placas(41), 1.1);
  const panel = materialBrillante(PANEL, LUZ, placas(53), 1.8, 2);
  const oscuro = toon(PALETA.oscuro), metal = toon(PALETA.metalOscuro), purpura = toon(PALETA.purpura);
  const luz = brillo(LUZ), sulfato = brillo(SULFATO);
  const raiz = new THREE.Group();
  raiz.name = 'dragon-velo';
  const talla = nodo('talla', raiz);
  const cuerpo = nodo('cuerpo', talla, 0, ALTURA_DRAGON, 0);

  // Fuselaje: casco claro, panza oscura, aletas dorsales y tanques de sulfato.
  pieza(cuerpo, caja(2.2, 1.8, 4.3, 0.4), casco, 0, 0, 0);
  pieza(cuerpo, caja(1.7, 0.5, 3.6, 0.2), oscuro, 0, -0.85, 0);
  pieza(cuerpo, caja(2.26, 0.1, 4.36, 0.04), luz, 0, -0.35, 0, { contorno: false, sombra: false });
  for (let k = 0; k < 4; k++) {
    const aleta = pieza(cuerpo, punta(0.22, 0.8 - k * 0.1, 3), purpura, 0, 1.15, 1.3 - k * 0.9);
    aleta.rotation.x = -0.5;
  }
  for (const s of [-1, 1]) {
    const tanque = pieza(cuerpo, barril(0.32, 0.32, 1.6, 0.12).rotateX(Math.PI / 2), toon('#e8d27a'), 0.55 * s, -1.2, 0.1);
    tanque.name = '';
    pieza(cuerpo, caja(0.5, 0.08, 0.5, 0.02), sulfato, 0.55 * s, -1.2, 0.95, { contorno: false, sombra: false });
    halo(cuerpo, SULFATO, 1.2, 0.55 * s, -1.25, 0.9, 0.6);
  }

  // Cuello en tres tramos hasta la cabeza en cuña.
  const c1 = nodo('cuello_1', cuerpo, 0, 0.45, 2.0);
  pieza(c1, caja(1.15, 1.0, 1.3, 0.25), casco, 0, 0.1, 0.5);
  const c2 = nodo('cuello_2', c1, 0, 0.2, 1.1);
  pieza(c2, caja(1.0, 0.9, 1.2, 0.22), casco, 0, 0.1, 0.5);
  pieza(c2, punta(0.16, 0.5, 3), purpura, 0, 0.65, 0.4).rotation.x = -0.5;
  const c3 = nodo('cuello_3', c2, 0, 0.2, 1.0);
  pieza(c3, caja(0.9, 0.82, 1.1, 0.2), casco, 0, 0.1, 0.45);
  const cabeza = nodo('cabeza', c3, 0, 0.15, 1.0);
  pieza(cabeza, caja(1.35, 0.95, 1.6, 0.25), casco, 0, 0.1, 0.4);
  pieza(cabeza, caja(0.85, 0.55, 1.1, 0.18), casco, 0, -0.05, 1.5);
  // Visor encendido de lado a lado: los «ojos» del dragón.
  pieza(cabeza, caja(1.4, 0.24, 0.7, 0.08), luz, 0, 0.3, 0.75, { contorno: false, sombra: false });
  halo(cabeza, LUZ, 2.2, 0, 0.32, 1.0, 0.85);
  for (const s of [-1, 1]) {
    barra(cabeza, [0.45 * s, 0.5, 0.1], [0.75 * s, 1.0, -1.1], 0.06, metal);
    pieza(cabeza, caja(0.14, 0.14, 0.14, 0.03), brillo(PALETA.helios), 0.75 * s, 1.0, -1.1, { contorno: false, sombra: false });
  }
  const mandibula = nodo('mandibula', cabeza, 0, -0.35, 0.45);
  pieza(mandibula, caja(0.8, 0.26, 1.5, 0.12), casco, 0, -0.05, 0.75);
  pieza(mandibula, caja(0.6, 0.06, 1.2, 0.02), sulfato, 0, 0.1, 0.75, { contorno: false, sombra: false });
  for (const s of [-1, 1]) pieza(mandibula, punta(0.06, 0.2, 4), toon(PALETA.diente), 0.28 * s, 0.18, 1.35);
  const aliento = nodo('aliento', cabeza, 0, -0.2, 2.0);
  pieza(aliento, new THREE.ConeGeometry(1.4, 6, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 3),
    new THREE.MeshBasicMaterial({ color: SULFATO, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    0, 0, 0, { contorno: false, sombra: false });
  halo(aliento, SULFATO, 4, 0, 0, 1.5, 0.7);
  oculto(aliento);

  // Alas de paneles solares en dos tramos, con hueso de metal y garra en la punta.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const ala = nodo(`ala_${lado}`, cuerpo, 1.05 * s, 0.55, 0.6);
    barra(ala, [0, 0, 0], [3.7 * s, 0.25, -0.4], 0.17, metal);
    pieza(ala, caja(3.4, 0.09, 2.6, 0.03), panel, 1.9 * s, 0.1, -1.35);
    pieza(ala, caja(3.4, 0.05, 0.06, 0.01), luz, 1.9 * s, 0.17, -0.1, { contorno: false, sombra: false });
    const punta_ = nodo(`ala_punta_${lado}`, ala, 3.7 * s, 0.25, -0.4);
    barra(punta_, [0, 0, 0], [3.6 * s, -0.1, -0.9], 0.13, metal);
    const exterior = pieza(punta_, caja(3.3, 0.08, 2.2, 0.03), panel, 1.7 * s, -0.05, -1.5);
    exterior.rotation.y = 0.12 * s;
    pieza(punta_, punta(0.12, 0.5, 4), metal, 3.7 * s, -0.1, -0.85).rotation.z = -1.4 * s;
    halo(punta_, LUZ, 1.1, 3.6 * s, -0.1, -0.9, 0.6);
  }

  // Patas traseras con espolones.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const pata = nodo(`pata_${lado}`, cuerpo, 0.75 * s, -0.75, -0.9);
    pieza(pata, caja(0.6, 1.1, 0.7, 0.18), casco, 0, -0.45, 0.1);
    pieza(pata, caja(0.45, 0.9, 0.5, 0.12), oscuro, 0, -1.3, 0.25);
    pieza(pata, caja(0.7, 0.22, 0.9, 0.08), metal, 0, -1.85, 0.4);
    for (const gx of [-0.2, 0.2]) pieza(pata, punta(0.07, 0.25, 4).rotateX(Math.PI / 2), toon(PALETA.diente), gx, -1.88, 0.95);
  }

  // Cola en cuatro tramos y el rotor de la punta.
  let padre: THREE.Object3D = cuerpo;
  let z = -2.1;
  for (let k = 1; k <= 4; k++) {
    const tramo = nodo(`cola_${k}`, padre, 0, k === 1 ? 0.2 : 0, z);
    const ancho = 0.9 - k * 0.15;
    pieza(tramo, caja(ancho, ancho * 0.85, 1.2, 0.15), casco, 0, 0, -0.55);
    if (k % 2) pieza(tramo, punta(0.12, 0.35, 3), purpura, 0, ancho * 0.5, -0.5).rotation.x = -0.6;
    padre = tramo;
    z = -1.1;
  }
  const rotor = nodo('rotor', padre, 0, 0, -1.25);
  pieza(rotor, barril(0.18, 0.18, 0.3, 0.05).rotateX(Math.PI / 2), metal);
  for (let k = 0; k < 3; k++) {
    const pala = pieza(rotor, caja(0.18, 1.3, 0.06, 0.03), casco, 0, 0.65, 0);
    pala.position.set(Math.sin((k / 3) * TAU) * 0.65, Math.cos((k / 3) * TAU) * 0.65, 0);
    pala.rotation.z = -(k / 3) * TAU;
  }
  halo(rotor, LUZ, 1.3, 0, 0, -0.1, 0.6);

  const aleteo = (d: number, amp: number, base = 5, veces = 1) => [
    rot('ala_i', ciclo(d, (f) => [0, 0, base + sen(f, veces) * amp])),
    rot('ala_d', ciclo(d, (f) => [0, 0, -base - sen(f, veces) * amp])),
    rot('ala_punta_i', ciclo(d, (f) => [0, 0, sen(f, veces, -0.12) * amp * 0.7])),
    rot('ala_punta_d', ciclo(d, (f) => [0, 0, -sen(f, veces, -0.12) * amp * 0.7])),
  ];
  const ondular = (d: number, amp: number) => [
    ...[1, 2, 3].map((k) => rot(`cuello_${k}`, ciclo(d, (f) => [sen(f, 1, k * 0.12) * amp * 0.5, sen(f, 1, k * 0.2) * amp * 0.4, 0]))),
    ...[1, 2, 3, 4].map((k) => rot(`cola_${k}`, ciclo(d, (f) => [sen(f, 1, k * 0.15) * amp * 0.3, sen(f, 1, k * 0.18) * amp, 0]))),
  ];
  const plegadas = (d: number) => [
    rot('ala_i', ciclo(d, (f) => [0, 30, -25 + sen(f) * 2])),
    rot('ala_d', ciclo(d, (f) => [0, -30, 25 - sen(f) * 2])),
    rot('ala_punta_i', ciclo(d, () => [0, 60, -40])),
    rot('ala_punta_d', ciclo(d, () => [0, -60, 40])),
  ];

  const animaciones = [
    animacion('Volar', 1.2, [
      ...aleteo(1.2, 32),
      mov(talla, 'cuerpo', ciclo(1.2, (f) => [0, -sen(f) * 0.35, 0])),
      ...ondular(1.2, 8),
      rot('pata_i', ciclo(1.2, (f) => [55 + sen(f) * 4, 0, 0])),
      rot('pata_d', ciclo(1.2, (f) => [55 + sen(f) * 4, 0, 0])),
    ], 'movimiento', 'Vuela: aletea con los dos tramos de ala a destiempo, el cuello y la cola ondulan, las patas recogidas.'),

    animacion('Planear', 2.0, [
      ...aleteo(2.0, 5, 8),
      rot('cuerpo', ciclo(2.0, (f) => [0, 0, sen(f) * 6])),
      ...ondular(2.0, 6),
      rot('pata_i', ciclo(2.0, () => [60, 0, 0])),
      rot('pata_d', ciclo(2.0, () => [60, 0, 0])),
    ], 'movimiento', 'Planea con las alas abiertas, ladeándose despacio.'),

    animacion('Picado', 0.6, [
      // Alas pegadas hacia atrás: el juego inclina la raíz hacia el suelo.
      rot('ala_i', ciclo(0.6, (f) => [0, 55, 8 + sen(f, 2) * 3])),
      rot('ala_d', ciclo(0.6, (f) => [0, -55, -8 - sen(f, 2) * 3])),
      rot('ala_punta_i', ciclo(0.6, () => [0, 25, 0])),
      rot('ala_punta_d', ciclo(0.6, () => [0, -25, 0])),
      ...ondular(0.6, 4),
      rot('mandibula', ciclo(0.6, () => [30, 0, 0])),
    ], 'ataque', 'Picado: alas plegadas hacia atrás y la boca abierta. Bucle mientras baja.'),

    animacion('Rugir', TIEMPOS_DRAGON.rugir, [
      rot('cuello_1', poses([[0, 0, 0, 0], [0.4, -25, 0, 0], [1.2, -25, 0, 0], [1.6, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.4, -30, 0, 0], [1.2, -30, 0, 0], [1.6, 0, 0, 0]])),
      rot('mandibula', poses([[0, 0, 0, 0], [0.4, 42, 0, 0], [1.2, 40, 0, 0], [1.6, 0, 0, 0]])),
      ...aleteo(1.6, 40, 10, 2),
    ], 'reaccion', 'Ruge con la cabeza en alto y las alas batiendo fuerte.', false),

    animacion('Aliento', TIEMPOS_DRAGON.aliento.duracion, [
      // Se queda en el aire, baja la cabeza y escupe sulfato en cono.
      rot('cuello_1', poses([[0, 0, 0, 0], [0.6, 25, 0, 0], [2.0, 25, 0, 0], [2.4, 0, 0, 0]])),
      rot('cuello_2', poses([[0, 0, 0, 0], [0.6, 15, 0, 0], [2.0, 15, 0, 0], [2.4, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.6, 20, 0, 0], [1.3, 20, 10, 0], [1.8, 20, -10, 0], [2.0, 20, 0, 0], [2.4, 0, 0, 0]])),
      rot('mandibula', poses([[0, 0, 0, 0], [0.7, 42, 0, 0], [2.0, 42, 0, 0], [2.4, 0, 0, 0]])),
      ...aleteo(2.4, 22, 5, 3),
    ], 'ataque', 'Aliento: baja la cabeza y escupe sulfato en cono de 0,8 a 2 s, aleteando en el sitio.', false),

    animacion('Aterrizar', TIEMPOS_DRAGON.aterrizar, [
      rot('cuerpo', poses([[0, 0, 0, 0], [0.6, -18, 0, 0], [1.2, -8, 0, 0], [1.4, 0, 0, 0]])),
      rot('ala_i', poses([[0, 0, 0, 30], [0.4, 0, 0, -20], [0.8, 0, 0, 35], [1.2, 0, 0, -10], [1.4, 0, 30, -25]])),
      rot('ala_d', poses([[0, 0, 0, -30], [0.4, 0, 0, 20], [0.8, 0, 0, -35], [1.2, 0, 0, 10], [1.4, 0, -30, 25]])),
      rot('pata_i', poses([[0, 55, 0, 0], [0.8, -20, 0, 0], [1.4, 0, 0, 0]])),
      rot('pata_d', poses([[0, 55, 0, 0], [0.8, -20, 0, 0], [1.4, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [1.2, 1, 1, 1], [1.3, 1.08, 0.9, 1.08], [1.4, 1, 1, 1]])),
    ], 'movimiento', 'Aterriza: frena con las alas, saca las patas y cae con un golpe (1,2 s).', false),

    animacion('Posado', 2.0, [
      ...plegadas(2.0),
      mov(talla, 'cuerpo', ciclo(2.0, (f) => [0, sen(f) * 0.06, 0])),
      ...ondular(2.0, 5),
      rot('mandibula', ciclo(2.0, (f) => [6 + sen(f) * 4, 0, 0])),
      esc('aliento', ciclo(2.0, () => [0.001, 0.001, 0.001])),
    ], 'movimiento', 'Posado: alas plegadas, respira con la boca entreabierta. Ahora le llega todo.'),

    animacion('Despegar', TIEMPOS_DRAGON.despegar, [
      ...aleteo(1.2, 45, 0, 2),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.5, -15, 0, 0], [1.2, 0, 0, 0]])),
      rot('pata_i', poses([[0, 0, 0, 0], [0.4, 30, 0, 0], [1.2, 55, 0, 0]])),
      rot('pata_d', poses([[0, 0, 0, 0], [0.4, 30, 0, 0], [1.2, 55, 0, 0]])),
    ], 'movimiento', 'Despega con dos aletazos fuertes y recoge las patas.', false),

    animacion('Golpe recibido', 0.35, [
      rot('cuerpo', poses([[0, 0, 0, 0], [0.08, -6, 0, 6], [0.35, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -14, 0, 0], [0.35, 0, 0, 0]])),
    ], 'reaccion', 'Se sacude un instante.', false),

    animacion('Derrota', 3.0, [
      // Cae: las alas se desarman y el cuello se desploma.
      rot('ala_i', poses([[0, 0, 0, 20], [0.8, 0, 20, -40], [2.0, 0, 35, -70], [3.0, 0, 35, -70]])),
      rot('ala_d', poses([[0, 0, 0, -20], [0.8, 0, -20, 40], [2.0, 0, -35, 70], [3.0, 0, -35, 70]])),
      rot('cuello_1', poses([[0, 0, 0, 0], [1.0, -30, 0, 0], [2.2, 35, 0, 0], [3.0, 35, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [1.0, -20, 0, 0], [2.2, 30, 0, 20], [3.0, 30, 0, 20]])),
      rot('mandibula', poses([[0, 0, 0, 0], [1.0, 40, 0, 0], [3.0, 15, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [2.0, 10, 0, 25], [3.0, 10, 0, 25]])),
    ], 'reaccion', 'Derrota: las alas se desarman, ruge una última vez y el cuello cae.', false),
  ];

  return { id: 'dragon-velo', nombre: 'Dragón del Velo', rol: 'Jefe volador', raiz, animaciones };
}
