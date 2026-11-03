import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, punta, rot, toon,
  toro, type Modelo,
} from './kit.ts';
import { halo } from './brillo.ts';

// El Guardián dormido: una cosechadora de la colonia, de antes de HELIOS, que
// se apagó cuando cayó el velo y se quedó dormida en la nieve. Casco redondo
// verde azulado con óxido y musgo, nieve en la espalda, una chimenea con una
// florecita que ha brotado encima, cuatro patas cortas y dos brazos de rastrillo.
// Un solo ojo grande, apagado mientras duerme y dorado cuando despierta.
//
// En reposo (`Dormido`) está hecha un ovillo y respira despacio, soltando
// vaho. `Despertar` (2 s) se despereza y enciende el ojo; `Despierto` mira
// alrededor; `Agradecer` hace una reverencia; `Dormirse` vuelve al ovillo.
// Despierta mide 3,6 m. Mira hacia +z.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const CASCO = '#5f8f7a', CASCO_OSCURO = '#3f6656', OXIDO = '#a8673a', MUSGO = '#6fae4a', NIEVE = '#eef4ff', ORO = '#ffd25a';
const LADOS = [['i', 1], ['d', -1]] as const;

export function crearGuardian(): Modelo {
  return conDetalle(0.55, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'guardian';
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, 1.0, 0);

  // Patas cortas de oruga.
  for (const [lado, s] of LADOS) {
    for (const [fila, z] of [['delante', 0.7], ['detras', -0.7]] as const) {
      const pata = nodo(`pata_${fila}_${lado}`, cadera, 1.0 * s, -0.2, z);
      pieza(pata, barril(0.28, 0.32, 0.6, 0.08), toon(CASCO_OSCURO), 0, -0.3, 0);
      pieza(pata, caja(0.6, 0.3, 0.8, 0.12), toon(PALETA.oscuro), 0, -0.68, 0.06);
    }
  }

  // El casco: un tonel enorme tumbado, con placas, óxido, musgo y nieve.
  const tronco = nodo('tronco', cadera, 0, 0.6, 0);
  pieza(tronco, barril(1.25, 1.25, 2.4, 0.5).rotateX(Math.PI / 2), toon(CASCO), 0, 0, 0);
  pieza(tronco, toro(1.26, 0.08).rotateX(Math.PI / 2), toon(CASCO_OSCURO), 0, 0, 0.6);
  pieza(tronco, toro(1.26, 0.08).rotateX(Math.PI / 2), toon(CASCO_OSCURO), 0, 0, -0.6);
  for (const [x, y, z, r] of [[0.7, 0.6, 0.9, 0.3], [-0.8, 0.3, -0.5, 0.35], [0.2, -0.7, 1.0, 0.25]]) {
    pieza(tronco, esfera(r, 1, 0.35, 1), toon(OXIDO), x, y, z, { contorno: false });
  }
  for (const [x, y, z, r] of [[-0.5, 1.0, 0.3, 0.45], [0.5, 1.0, -0.6, 0.4], [0, 1.1, -0.1, 0.5]]) {
    pieza(tronco, esfera(r, 1.2, 0.3, 1), toon(MUSGO), x, y, z);
  }
  pieza(tronco, caja(1.6, 0.12, 1.9, 0.06), toon(NIEVE), 0, 1.22, -0.1);
  // Tolva de grano a la espalda y la chimenea con su flor.
  pieza(tronco, caja(1.2, 0.8, 0.6, 0.12), toon(CASCO_OSCURO), 0, 0.5, -1.35);
  const chimenea = nodo('chimenea', tronco, 0.55, 1.2, -0.7);
  pieza(chimenea, barril(0.14, 0.18, 0.9, 0.04), toon(PALETA.metalOscuro), 0, 0.45, 0);
  barra(chimenea, [0, 0.9, 0], [0.04, 1.12, 0.02], 0.02, toon('#2f9a63'), { contorno: false });
  pieza(chimenea, esfera(0.07, 1, 0.5, 1), toon('#ff8fb8'), 0.04, 1.16, 0.02, { contorno: false });
  // Vaho al respirar dormido (lo encoge y lo agranda `Dormido`).
  const vaho = nodo('vaho', chimenea, 0, 1.0, 0);
  pieza(vaho, esfera(0.25), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }), 0, 0, 0, { contorno: false, sombra: false });

  // Cabeza: visor redondo con un solo ojo, y una antena doblada.
  const cabeza = nodo('cabeza', tronco, 0, 0.3, 1.25);
  pieza(cabeza, barril(0.75, 0.8, 0.5, 0.18).rotateX(Math.PI / 2), toon(CASCO_OSCURO), 0, 0, 0.1);
  pieza(cabeza, barril(0.55, 0.55, 0.12, 0.04).rotateX(Math.PI / 2), toon(PALETA.oscuro), 0, 0.05, 0.36);
  const ojoApagado = nodo('ojo_apagado', cabeza, 0, 0.05, 0.42);
  pieza(ojoApagado, esfera(0.34, 1, 1, 0.4), toon('#3b4a5a'), 0, 0, 0, { contorno: false });
  const ojo = nodo('ojo', cabeza, 0, 0.05, 0.44);
  pieza(ojo, esfera(0.34, 1, 1, 0.4), brillo(ORO), 0, 0, 0, { contorno: false });
  pieza(ojo, esfera(0.12, 1, 1, 0.4), brillo('#fff6d6'), 0.08, 0.08, 0.06, { contorno: false });
  halo(ojo, ORO, 2.2, 0, 0, 0.1, 0.7);
  ojo.scale.setScalar(0.001);
  const antena = nodo('antena', cabeza, -0.45, 0.6, 0);
  barra(antena, [0, 0, 0], [-0.1, 0.6, -0.1], 0.04, toon(PALETA.metal));
  pieza(antena, esfera(0.08), brillo(PALETA.ada), -0.1, 0.64, -0.1, { contorno: false });

  // Brazos de rastrillo, con hombro y codo.
  for (const [lado, s] of LADOS) {
    const hombro = nodo(`hombro_${lado}`, tronco, 1.25 * s, 0.2, 0.7);
    pieza(hombro, esfera(0.34), toon(CASCO_OSCURO));
    pieza(hombro, capsula(0.2, 0.6), toon(CASCO), 0, -0.45, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.9, 0);
    pieza(codo, esfera(0.24), toon(CASCO_OSCURO));
    pieza(codo, capsula(0.18, 0.5), toon(CASCO), 0, -0.38, 0.05);
    const rastrillo = nodo(`rastrillo_${lado}`, codo, 0, -0.8, 0.1);
    pieza(rastrillo, caja(0.8, 0.14, 0.24, 0.05), toon(OXIDO), 0, 0, 0);
    for (let k = 0; k < 5; k++) pieza(rastrillo, punta(0.05, 0.32), toon(PALETA.metal), -0.32 + k * 0.16, -0.2, 0).rotation.x = Math.PI;
  }

  // ---------------------------------------------------------- animaciones

  // Ovillo: hundido sobre las patas, cabeza baja y brazos recogidos.
  const OVILLO = {
    cadera: [0, -0.55, 0] as const, tronco: [12, 0, 0] as const, cabeza: [28, 0, 6] as const,
    hombroI: [-40, 0, 20] as const, hombroD: [-40, 0, -20] as const, codo: [-80, 0, 0] as const,
  };
  const ovillo = (d: number, respira: number) => [
    mov(raiz, 'cadera', ciclo(d, (f) => [0, OVILLO.cadera[1] + sen(f) * respira * 0.03, 0])),
    rot('tronco', ciclo(d, (f) => [OVILLO.tronco[0] + sen(f) * respira, 0, 0])),
    esc('tronco', ciclo(d, (f) => { const k = 1 + sen(f) * respira * 0.012; return [k, k, k]; })),
    rot('cabeza', ciclo(d, (f) => [OVILLO.cabeza[0] - sen(f) * respira, 0, OVILLO.cabeza[2]])),
    rot('hombro_i', ciclo(d, () => OVILLO.hombroI)),
    rot('hombro_d', ciclo(d, () => OVILLO.hombroD)),
    rot('codo_i', ciclo(d, () => OVILLO.codo)),
    rot('codo_d', ciclo(d, () => OVILLO.codo)),
    rot('antena', ciclo(d, (f) => [40 + sen(f) * 4, 0, 20])),
  ];

  const animaciones = [
    animacion('Dormido', 3.2, [
      ...ovillo(3.2, 2.5),
      esc('ojo', ciclo(3.2, () => [0.001, 0.001, 0.001])),
      // Suelta vaho al espirar.
      esc('vaho', ciclo(3.2, (f) => { const k = Math.max(0.001, -sen(f)) * 1.4; return [k, k, k]; })),
      mov(raiz, 'vaho', ciclo(3.2, (f) => [0, Math.max(0, -sen(f)) * 0.4, 0])),
    ], 'movimiento', 'Dormido en un ovillo: respira despacio, la tolva sube y baja y suelta vaho por la chimenea.'),

    animacion('Despertar', 2.0, [
      mov(raiz, 'cadera', poses([[0, 0, -0.55, 0], [0.5, 0, -0.6, 0], [1.2, 0, 0.12, 0], [1.5, 0, -0.04, 0], [2.0, 0, 0, 0]])),
      rot('tronco', poses([[0, 12, 0, 0], [0.5, 16, 0, 0], [1.2, -10, 0, 0], [2.0, 0, 0, 0]])),
      rot('cabeza', poses([[0, 28, 0, 6], [0.6, 30, 0, 6], [1.1, -14, 0, 0], [1.4, -10, 14, 0], [1.7, -10, -14, 0], [2.0, 0, 0, 0]])),
      rot('hombro_i', poses([[0, -40, 0, 20], [0.6, -40, 0, 20], [1.2, -10, 0, 70], [1.6, 0, 0, 40], [2.0, 0, 0, 10]])),
      rot('hombro_d', poses([[0, -40, 0, -20], [0.6, -40, 0, -20], [1.2, -10, 0, -70], [1.6, 0, 0, -40], [2.0, 0, 0, -10]])),
      rot('codo_i', poses([[0, -80, 0, 0], [0.6, -80, 0, 0], [1.2, -10, 0, 0], [2.0, -20, 0, 0]])),
      rot('codo_d', poses([[0, -80, 0, 0], [0.6, -80, 0, 0], [1.2, -10, 0, 0], [2.0, -20, 0, 0]])),
      esc('ojo', poses([[0, 0.001, 0.001, 0.001], [0.7, 0.001, 0.001, 0.001], [0.8, 1, 0.1, 1], [0.95, 1, 1, 1], [1.05, 1, 0.1, 1], [1.2, 1.15, 1.15, 1.15], [2.0, 1, 1, 1]])),
      rot('antena', poses([[0, 40, 0, 20], [1.2, -20, 0, -10], [1.5, 10, 0, 6], [2.0, 0, 0, 0]])),
      esc('vaho', poses([[0, 0.001, 0.001, 0.001], [1.2, 1.8, 1.8, 1.8], [2.0, 0.001, 0.001, 0.001]])),
      mov(raiz, 'vaho', poses([[0, 0, 0, 0], [1.2, 0, 0.3, 0], [2.0, 0, 1.0, 0]])),
    ], 'reaccion', 'Se despereza: se levanta sobre las patas, estira los rastrillos, el ojo parpadea y se enciende.', false),

    animacion('Despierto', 2.4, [
      mov(raiz, 'cadera', ciclo(2.4, (f) => [0, sen(f, 2) * 0.03, 0])),
      rot('tronco', ciclo(2.4, (f) => [sen(f, 2) * 1.5, sen(f) * 4, 0])),
      rot('cabeza', ciclo(2.4, (f) => [-4 + sen(f, 2) * 3, sen(f) * 24, sen(f) * 4])),
      rot('hombro_i', ciclo(2.4, (f) => [sen(f) * 6, 0, 10])),
      rot('hombro_d', ciclo(2.4, (f) => [-sen(f) * 6, 0, -10])),
      rot('codo_i', ciclo(2.4, () => [-20, 0, 0])),
      rot('codo_d', ciclo(2.4, () => [-20, 0, 0])),
      esc('ojo', ciclo(2.4, (f) => { const k = 1 + 0.08 * sen(f, 2); return [k, k, k]; })),
      esc('vaho', ciclo(2.4, () => [0.001, 0.001, 0.001])),
    ], 'movimiento', 'Despierto: mira alrededor con su ojo dorado y se balancea sobre las patas.'),

    animacion('Agradecer', 1.6, [
      rot('tronco', poses([[0, 0, 0, 0], [0.5, 22, 0, 0], [1.1, 22, 0, 0], [1.6, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.5, 26, 0, 0], [1.1, 26, 0, 0], [1.6, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.5, -70, 0, 30], [1.1, -70, 0, 30], [1.6, 0, 0, 10]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.5, -70, 0, -30], [1.1, -70, 0, -30], [1.6, 0, 0, -10]])),
      esc('ojo', poses([[0, 1, 1, 1], [0.6, 1, 0.35, 1], [1.1, 1, 0.35, 1], [1.6, 1, 1, 1]])),
    ], 'reaccion', 'Reverencia lenta con los rastrillos por delante; el ojo se entorna, contento.', false),

    animacion('Dormirse', 1.6, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [1.6, 0, -0.55, 0]])),
      rot('tronco', poses([[0, 0, 0, 0], [1.6, 12, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [1.6, 28, 0, 6]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [1.6, -40, 0, 20]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [1.6, -40, 0, -20]])),
      rot('codo_i', poses([[0, -20, 0, 0], [1.6, -80, 0, 0]])),
      rot('codo_d', poses([[0, -20, 0, 0], [1.6, -80, 0, 0]])),
      esc('ojo', poses([[0, 1, 1, 1], [0.9, 1, 0.1, 1], [1.1, 0.001, 0.001, 0.001], [1.6, 0.001, 0.001, 0.001]])),
      rot('antena', poses([[0, 0, 0, 0], [1.6, 40, 0, 20]])),
    ], 'reaccion', 'Vuelve a hacerse un ovillo y el ojo se apaga poco a poco.', false),
  ];
  return { id: 'guardian', nombre: 'Guardián dormido', rol: 'Mapa · se despierta con F', raiz, animaciones };
}
