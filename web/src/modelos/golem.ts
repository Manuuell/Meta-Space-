import * as THREE from 'three';
import {
  PALETA, animacion, barril, barra, brillo, caja, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, punta, rot, toon,
  type Modelo,
} from './kit.ts';
import { GOLEMS } from '../contenido/mapa.ts';
import { halo, materialBrillante, placas, roca } from './brillo.ts';

// Gólems de HELIOS: los jefes grandes de los altares. HELIOS los levanta con
// los escombros de la ciudad muerta, soldados con cables púrpura, y les pone
// un núcleo de plasma en el pecho. Brazos larguísimos de nudillos en el
// suelo, cabeza pequeña con una sola rendija de ojo y cristales en la
// espalda. Tres variantes con el mismo esqueleto:
//
// - escoria: roca parda y cristal púrpura (≈ 7,5 m).
// - escarcha: hielo azulado con carámbanos en los hombros (≈ 8,7 m).
// - titan: placas de metal oscuro con grietas de lava y corona (≈ 10,6 m).
//
// La escala de cada uno sale de GOLEMS (contenido/mapa.ts), la misma que usa
// el juego para el tamaño de sus avisos.
//
// Mira hacia +z. Los ataques duran lo que dicen TIEMPOS_GOLEM: el juego pinta
// el aviso en el suelo mientras el clip prepara el golpe.

export type VarianteGolem = 'escoria' | 'escarcha' | 'titan';

/** Momentos clave de cada clip de ataque (s), para sincronizar avisos y daño. */
export const TIEMPOS_GOLEM = {
  Pisoton: { golpe: 1.15, duracion: 2.0 },
  Lanzar: { suelta: 1.2, duracion: 2.2 },
  Preparar: { duracion: 0.9 },
  Salto: { despega: 0.55, aterriza: 1.5, duracion: 2.3 },
  Furia: { duracion: 1.8 },
  Despertar: { duracion: 3.0 },
} as const;

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

const VARIANTES: Record<VarianteGolem, {
  roca: string; chapa: string; cristal: string; luz: string; ojo: string; semilla: number;
}> = {
  // Escoria: roca parda con magma en las grietas y chapa púrpura de HELIOS.
  escoria: { roca: '#8a6f5e', chapa: '#4a3f5c', cristal: PALETA.purpuraBrillo, luz: '#ff7a2a', ojo: '#ffd25a', semilla: 3 },
  // Escarcha: hielo azulado, la luz es fría y los cristales son carámbanos.
  escarcha: { roca: '#bcd6ea', chapa: '#4e6a8c', cristal: '#c8fbff', luz: '#5ee0ff', ojo: '#e8faff', semilla: 11 },
  // Titán: metal negro con lava roja y corona de oro.
  titan: { roca: '#4a4c63', chapa: '#26283a', cristal: PALETA.helios, luz: '#ff3b30', ojo: '#ffd25a', semilla: 23 },
};

/** `talla` agranda o encoge el modelo (los campeones de duelo son gólems pequeños). */
export function crearGolem(variante: VarianteGolem, talla?: number): Modelo {
  return conDetalle(0.65, () => montar(variante, talla));
}

function montar(variante: VarianteGolem, escala?: number): Modelo {
  const v = VARIANTES[variante];
  const def = GOLEMS[`golem-${variante}`];
  // Roca con grietas que brillan y chapa con circuitos encendidos.
  const piedra = materialBrillante(v.roca, v.luz, roca(v.semilla), 1.5);
  const chapa = materialBrillante(v.chapa, v.luz, placas(v.semilla), 1.3);
  const oscura = toon(v.chapa), cable = toon(PALETA.purpura), luz = brillo(v.luz);
  const raiz = new THREE.Group();
  raiz.name = `golem-${variante}`;
  const talla = nodo('talla', raiz);
  talla.scale.setScalar(escala ?? def.talla);
  const cuerpo = nodo('cuerpo', talla);
  const cadera = nodo('cadera', cuerpo, 0, 2.1, 0);
  pieza(cadera, caja(2.0, 0.75, 1.35, 0.3), chapa, 0, 0, 0);
  pieza(cadera, caja(2.1, 0.12, 1.42, 0.05), luz, 0, -0.3, 0, { contorno: false, sombra: false });

  // Piernas: columna de roca, rodillera de chapa y pie de losa con garras.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const pierna = nodo(`pierna_${lado}`, cadera, 0.66 * s, -0.1, 0);
    pieza(pierna, caja(0.95, 1.25, 0.95, 0.28), piedra, 0, -0.62, 0);
    pieza(pierna, caja(0.75, 0.55, 0.3, 0.12), chapa, 0, -1.15, 0.45);
    pieza(pierna, caja(0.82, 0.75, 0.82, 0.22), piedra, 0, -1.5, 0.02);
    pieza(pierna, caja(1.15, 0.4, 1.45, 0.15), chapa, 0, -1.84, 0.2);
    for (const gx of [-0.32, 0, 0.32]) pieza(pierna, punta(0.12, 0.3, 4).rotateX(Math.PI / 2), oscura, gx, -1.9, 0.98);
  }

  // Torso encorvado: bloque de roca, peto de chapa y una jaula de costillas
  // alrededor del núcleo.
  const pecho = nodo('pecho', cadera, 0, 0.2, 0);
  pecho.rotation.x = 0.12;
  pieza(pecho, caja(2.9, 2.1, 1.8, 0.5), piedra, 0, 1.2, -0.05);
  pieza(pecho, caja(2.3, 1.0, 0.4, 0.18), chapa, 0, 0.55, 0.82);
  pieza(pecho, caja(1.4, 0.5, 0.35, 0.12), chapa, 0, 2.05, 0.75);
  for (const [x, y, z, r] of [[1.05, 2.0, -0.4, 0.5], [-1.1, 1.75, -0.45, 0.45], [0.2, 2.3, -0.65, 0.42]] as const) {
    pieza(pecho, esfera(r, 1, 0.8, 1), piedra, x, y, z);
  }
  pieza(pecho, barril(0.55, 0.55, 0.22, 0.05).rotateX(Math.PI / 2), oscura, 0, 1.3, 0.88);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) barra(pecho, [x, 0.95, 1.0], [x * 1.15, 1.65, 1.02], 0.06, oscura);
  const nucleo = nodo('nucleo', pecho, 0, 1.3, 0.98);
  pieza(nucleo, esfera(0.36, 1, 1, 0.6), luz, 0, 0, 0, { contorno: false, sombra: false });
  pieza(nucleo, esfera(0.18, 1, 1, 0.6), brillo('#fff4d6'), 0, 0, 0.1, { contorno: false, sombra: false });
  halo(nucleo, v.luz, 2.6, 0, 0, 0.3, 0.9);
  // Runas encendidas en el peto, como las vetas del dibujo de la referencia.
  for (const [x, y, l, ang] of [[-0.85, 0.55, 0.5, 0], [0.85, 0.55, 0.5, 0], [-0.5, 1.95, 0.35, 0.6], [0.5, 1.95, 0.35, -0.6], [0, 0.32, 0.9, 0]] as const) {
    const runa = pieza(pecho, caja(l, 0.07, 0.05, 0.02), luz, x, y, 1.0, { contorno: false, sombra: false });
    runa.rotation.z = ang;
  }
  barra(pecho, [-1.3, 0.6, 0.9], [1.3, 1.95, 0.9], 0.07, cable, { contorno: false });
  // Cristales de la espalda, cada uno con su resplandor.
  for (const [x, y, ang, h] of [[0, 2.2, 0, 1.6], [0.75, 1.9, -0.4, 1.2], [-0.8, 1.85, 0.45, 1.25], [0.35, 1.3, -0.2, 0.9], [-0.4, 1.35, 0.25, 0.9]] as const) {
    const c = pieza(pecho, punta(0.28, h, 5), brillo(v.cristal), x, y, -0.85);
    c.rotation.set(-0.6, 0, ang);
    halo(pecho, v.cristal, h * 0.9, x, y + 0.2, -1.1, 0.45);
  }

  // Cabeza pequeña y hundida, con frente de chapa, dos ojos y una mandíbula.
  const cabeza = nodo('cabeza', pecho, 0, 2.25, 0.45);
  pieza(cabeza, caja(1.0, 0.7, 0.9, 0.25), piedra, 0, 0.32, 0);
  pieza(cabeza, caja(1.12, 0.26, 1.0, 0.08), chapa, 0, 0.62, 0.02);
  const ojo = nodo('ojo', cabeza, 0, 0.36, 0.46);
  for (const x of [-0.22, 0.22]) {
    pieza(ojo, caja(0.24, 0.1, 0.05, 0.02), brillo(v.ojo), x, 0, 0, { contorno: false, sombra: false });
    halo(ojo, v.ojo, 0.6, x, 0, 0.08, 0.9);
  }
  const mandibula = nodo('mandibula', cabeza, 0, 0.05, 0.1);
  pieza(mandibula, caja(0.85, 0.3, 0.75, 0.12), chapa, 0, -0.08, 0.05);
  for (const x of [-0.25, 0, 0.25]) pieza(mandibula, punta(0.06, 0.18, 4), toon('#f1ecdc'), x, 0.1, 0.4);
  pieza(cabeza, caja(0.6, 0.14, 0.05, 0.03), luz, 0, 0.14, 0.44, { contorno: false, sombra: false });
  if (variante === 'titan') {
    for (let k = 0; k < 5; k++) {
      const a = ((k - 2) / 2) * 0.9;
      const pico = pieza(cabeza, punta(0.13, 0.7, 4), toon('#ffd25a'), Math.sin(a) * 0.45, 1.0, Math.cos(a) * 0.15 - 0.1);
      pico.rotation.z = -a * 0.5;
    }
    halo(cabeza, '#ffd25a', 1.6, 0, 1.1, 0, 0.35);
  }

  // Brazos: hombrera de chapa, brazo de roca, brazal y un puño enorme.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const hombro = nodo(`hombro_${lado}`, pecho, 1.7 * s, 1.85, 0);
    pieza(hombro, esfera(0.75, 1, 0.9, 1), piedra);
    const hombrera = pieza(hombro, caja(1.3, 0.45, 1.3, 0.2), chapa, 0.15 * s, 0.45, 0);
    hombrera.rotation.z = -0.3 * s;
    pieza(hombro, caja(1.34, 0.08, 1.34, 0.03), luz, 0.15 * s, 0.24, 0, { contorno: false, sombra: false }).rotation.z = -0.3 * s;
    if (variante !== 'titan') {
      for (let k = 0; k < 3; k++) {
        const c = pieza(hombro, punta(0.14, variante === 'escarcha' ? 0.95 : 0.7, 5), brillo(v.cristal), 0.3 * s, 0.85, (k - 1) * 0.38);
        c.rotation.z = -0.45 * s;
      }
    }
    pieza(hombro, caja(0.72, 1.4, 0.72, 0.22), piedra, 0.1 * s, -0.95, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0.1 * s, -1.65, 0);
    pieza(codo, caja(0.95, 0.75, 0.95, 0.22), chapa, 0, -0.3, 0);
    pieza(codo, caja(0.98, 0.07, 0.98, 0.03), luz, 0, -0.62, 0, { contorno: false, sombra: false });
    pieza(codo, caja(0.85, 0.7, 0.85, 0.22), piedra, 0, -0.95, 0);
    pieza(codo, esfera(0.68, 1.1, 0.9, 1.1), piedra, 0, -1.4, 0.05);
    for (const nx of [-0.3, 0, 0.3]) pieza(codo, caja(0.24, 0.22, 0.24, 0.08), oscura, nx, -1.35, 0.68);
  }
  // La roca que arranca del suelo para lanzarla, en la mano derecha.
  const rocaMano = nodo('roca_mano', talla.getObjectByName('codo_d')!, 0, -1.5, 0.6);
  pieza(rocaMano, esfera(0.95, 1, 0.85, 1), piedra);
  pieza(rocaMano, esfera(0.45, 1, 0.8, 1), piedra, 0.4, 0.35, 0.3);
  halo(rocaMano, v.luz, 1.8, 0, 0, 0, 0.5);
  oculto(rocaMano);

  // Escombros que orbitan alrededor de los hombros (el juego gira `orbita`).
  const orbita = nodo('orbita', pecho, 0, 1.6, -0.1);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    const trozo = pieza(orbita, caja(0.42, 0.34, 0.38, 0.1), piedra, Math.cos(a) * 2.6, Math.sin(a * 2) * 0.4, Math.sin(a) * 1.6);
    trozo.rotation.set(a, a * 0.7, 0);
  }

  const brazos = (fn: (f: number) => number, d: number, abre = 6) => [
    rot('hombro_i', ciclo(d, (f) => [fn(f), 0, abre])),
    rot('hombro_d', ciclo(d, (f) => [-fn(f), 0, -abre])),
  ];
  const pulso = (d: number, veces: number, amp = 0.15) => esc('nucleo', ciclo(d, (f) => { const k = 1 + amp * sen(f, veces); return [k, k, k]; }));

  const animaciones = [
    animacion('Despertar', TIEMPOS_GOLEM.Despertar.duracion, [
      // Se levanta del suelo y ruge con los brazos abiertos.
      mov(talla, 'cuerpo', poses([[0, 0, -1.3, 0], [0.9, 0, -1.0, 0], [1.6, 0, 0, 0], [3.0, 0, 0, 0]])),
      rot('pecho', poses([[0, 45, 0, 0], [1.5, 10, 0, 0], [1.8, -12, 0, 0], [2.6, -12, 0, 0], [3.0, 0, 0, 0]])),
      rot('cabeza', poses([[0, 20, 0, 0], [1.6, 0, 0, 0], [1.8, -28, 0, 0], [2.6, -28, 0, 0], [3.0, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 30, 0, 0], [1.6, 0, 0, 6], [1.9, -40, 0, 70], [2.6, -40, 0, 70], [3.0, 0, 0, 6]])),
      rot('hombro_d', poses([[0, 30, 0, 0], [1.6, 0, 0, -6], [1.9, -40, 0, -70], [2.6, -40, 0, -70], [3.0, 0, 0, -6]])),
      esc('nucleo', poses([[0, 0.3, 0.3, 0.3], [1.6, 1, 1, 1], [1.9, 1.6, 1.6, 1.6], [2.6, 1.4, 1.4, 1.4], [3.0, 1, 1, 1]])),
      rot('mandibula', poses([[0, 0, 0, 0], [1.7, 0, 0, 0], [1.9, 32, 0, 0], [2.6, 30, 0, 0], [3.0, 0, 0, 0]])),
    ], 'reaccion', 'Despierta: se levanta de los escombros y ruge con los brazos abiertos; el núcleo se enciende.', false),

    animacion('Caminar', 1.6, [
      rot('pierna_i', ciclo(1.6, (f) => [sen(f) * 22, 0, 0])),
      rot('pierna_d', ciclo(1.6, (f) => [-sen(f) * 22, 0, 0])),
      ...brazos((f) => -sen(f) * 16, 1.6),
      mov(talla, 'cuerpo', ciclo(1.6, (f) => [0, -0.12 * Math.abs(sen(f)), 0])),
      rot('pecho', ciclo(1.6, (f) => [8, sen(f) * 7, sen(f) * 4])),
      rot('cabeza', ciclo(1.6, (f) => [-4, -sen(f) * 5, 0])),
      pulso(1.6, 2, 0.08),
    ], 'movimiento', 'Paso pesado: cada pisada hunde el cuerpo, los brazos cuelgan y se balancean.'),

    animacion('Pisoton', TIEMPOS_GOLEM.Pisoton.duracion, [
      // Levanta los dos puños sobre la cabeza, aguanta y golpea el suelo.
      rot('hombro_i', poses([[0, 0, 0, 6], [0.8, -165, 0, 20], [1.05, -170, 0, 18], [1.15, -45, 0, 10], [1.5, -40, 0, 10], [2.0, 0, 0, 6]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.8, -165, 0, -20], [1.05, -170, 0, -18], [1.15, -45, 0, -10], [1.5, -40, 0, -10], [2.0, 0, 0, -6]])),
      rot('codo_i', poses([[0, 0, 0, 0], [0.8, -30, 0, 0], [1.15, 0, 0, 0], [2.0, 0, 0, 0]])),
      rot('codo_d', poses([[0, 0, 0, 0], [0.8, -30, 0, 0], [1.15, 0, 0, 0], [2.0, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.8, -18, 0, 0], [1.05, -20, 0, 0], [1.15, 38, 0, 0], [1.5, 34, 0, 0], [2.0, 0, 0, 0]])),
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.8, 0, 0.25, 0], [1.05, 0, 0.3, 0], [1.15, 0, -0.55, 0], [1.5, 0, -0.5, 0], [2.0, 0, 0, 0]])),
      esc('nucleo', poses([[0, 1, 1, 1], [1.05, 1.5, 1.5, 1.5], [1.15, 0.8, 0.8, 0.8], [2.0, 1, 1, 1]])),
    ], 'ataque', 'Pisotón: alza los puños, aguanta un instante y aplasta el suelo (golpe a 1,15 s).', false),

    animacion('Lanzar', TIEMPOS_GOLEM.Lanzar.duracion, [
      // Arranca una roca del suelo, la sube por detrás de la cabeza y la tira.
      rot('pecho', poses([[0, 0, 0, 0], [0.45, 32, -15, 0], [0.9, -14, 20, 0], [1.1, -16, 24, 0], [1.25, 24, -20, 0], [1.6, 14, -10, 0], [2.2, 0, 0, 0]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.45, 30, 0, -10], [0.9, -165, 0, -20], [1.1, -175, 0, -20], [1.25, -30, 0, -10], [1.6, 20, 0, -6], [2.2, 0, 0, -6]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [0.45, 20, 0, 20], [1.1, -40, 0, 40], [1.25, 30, 0, 20], [2.2, 0, 0, 6]])),
      esc('roca_mano', poses([[0, 0.001, 0.001, 0.001], [0.35, 0.001, 0.001, 0.001], [0.5, 1, 1, 1], [1.2, 1, 1, 1], [1.22, 0.001, 0.001, 0.001], [2.2, 0.001, 0.001, 0.001]])),
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.45, 0, -0.45, 0], [0.9, 0, 0, 0], [1.25, 0, -0.2, 0.2], [2.2, 0, 0, 0]])),
    ], 'ataque', 'Lanza: arranca una roca (0,5 s), la sube por detrás y la suelta a 1,2 s.', false),

    animacion('Preparar', TIEMPOS_GOLEM.Preparar.duracion, [
      // Baja el hombro y escarba con el pie antes de embestir.
      rot('pecho', poses([[0, 0, 0, 0], [0.4, 32, 0, 0], [0.9, 34, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.4, -24, 0, 0], [0.9, -24, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.25, 30, 0, 0], [0.45, -14, 0, 0], [0.65, 30, 0, 0], [0.9, -10, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [0.4, 40, 0, 10], [0.9, 40, 0, 10]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.4, 40, 0, -10], [0.9, 40, 0, -10]])),
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.4, 0, -0.35, 0], [0.9, 0, -0.35, 0]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.9, 1.5, 1.5, 1.5]])),
    ], 'ataque', 'Prepara la embestida: baja el hombro, escarba con el pie y el núcleo se carga.', false),

    animacion('Embestir', 0.5, [
      rot('pierna_i', ciclo(0.5, (f) => [sen(f) * 42, 0, 0])),
      rot('pierna_d', ciclo(0.5, (f) => [-sen(f) * 42, 0, 0])),
      rot('pecho', ciclo(0.5, (f) => [36 + sen(f, 2) * 3, sen(f) * 6, 0])),
      rot('cabeza', ciclo(0.5, () => [-26, 0, 0])),
      rot('hombro_i', ciclo(0.5, (f) => [40 + sen(f) * 14, 0, 14])),
      rot('hombro_d', ciclo(0.5, (f) => [40 - sen(f) * 14, 0, -14])),
      mov(talla, 'cuerpo', ciclo(0.5, (f) => [0, -0.35 + 0.18 * Math.abs(sen(f)), 0])),
      pulso(0.5, 2, 0.2),
    ], 'ataque', 'Embestida: corre agachado con el hombro por delante. Bucle mientras dura la carga.'),

    animacion('Salto', TIEMPOS_GOLEM.Salto.duracion, [
      // Se agacha, salta muy alto y cae aplastando (aterriza a 1,5 s).
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.5, 0, -0.8, 0], [0.55, 0, -0.6, 0], [1.0, 0, 5.5, 0], [1.5, 0, 0, 0], [1.6, 0, -0.9, 0], [1.9, 0, -0.7, 0], [2.3, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.5, 30, 0, 0], [1.0, -15, 0, 0], [1.45, 10, 0, 0], [1.6, 40, 0, 0], [2.3, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [0.5, 50, 0, 20], [1.0, -150, 0, 30], [1.45, -150, 0, 30], [1.55, -45, 0, 30], [2.3, 0, 0, 6]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.5, 50, 0, -20], [1.0, -150, 0, -30], [1.45, -150, 0, -30], [1.55, -45, 0, -30], [2.3, 0, 0, -6]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.5, -30, 0, 0], [1.0, 20, 0, 0], [1.45, -10, 0, 0], [1.6, -35, 0, 0], [2.3, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.5, -30, 0, 0], [1.0, 30, 0, 0], [1.45, -10, 0, 0], [1.6, -35, 0, 0], [2.3, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.5, 1.1, 0.88, 1.1], [0.7, 0.92, 1.1, 0.92], [1.45, 1, 1, 1], [1.6, 1.15, 0.82, 1.15], [2.3, 1, 1, 1]])),
    ], 'ataque', 'Salto: se agacha, sube 5 m y cae aplastando a 1,5 s.', false),

    animacion('Furia', TIEMPOS_GOLEM.Furia.duracion, [
      // Se golpea el pecho y ruge: empieza la segunda fase.
      rot('hombro_i', poses([[0, 0, 0, 6], [0.3, -70, 40, 10], [0.5, -40, 60, 10], [0.7, -70, 40, 10], [0.9, -40, 60, 10], [1.2, -50, 0, 70], [1.8, 0, 0, 6]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.4, -40, -60, -10], [0.6, -70, -40, -10], [0.8, -40, -60, -10], [1.0, -70, -40, -10], [1.2, -50, 0, -70], [1.8, 0, 0, -6]])),
      rot('cabeza', poses([[0, 0, 0, 0], [1.1, 0, 0, 0], [1.3, -30, 0, 0], [1.8, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [1.1, 0, 0, 0], [1.3, -14, 0, 0], [1.8, 0, 0, 0]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.5, 1.3, 1.3, 1.3], [1.3, 1.9, 1.9, 1.9], [1.8, 1.3, 1.3, 1.3]])),
      rot('mandibula', poses([[0, 0, 0, 0], [1.1, 0, 0, 0], [1.3, 35, 0, 0], [1.6, 32, 0, 0], [1.8, 0, 0, 0]])),
    ], 'reaccion', 'Furia: se golpea el pecho y ruge; el núcleo arde más fuerte.', false),

    animacion('Golpe recibido', 0.35, [
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -9, 0, 4], [0.35, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -12, 0, 0], [0.35, 0, 0, 0]])),
    ], 'reaccion', 'Se tambalea un poco.', false),

    animacion('Derrota', 3.0, [
      // Cae de rodillas, se apaga el núcleo y se desploma hacia delante.
      mov(talla, 'cuerpo', poses([[0, 0, 0, 0], [0.8, 0, -1.2, 0], [1.6, 0, -1.2, 0], [2.4, 0, -1.6, 0.6], [3.0, 0, -1.6, 0.6]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.8, -70, 0, 0], [3.0, -70, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.8, -70, 0, 0], [3.0, -70, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.8, 15, 0, 0], [1.6, 20, 0, 0], [2.4, 70, 0, 0], [3.0, 70, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [1.6, 10, 0, 20], [2.4, -60, 0, 30], [3.0, -60, 0, 30]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [1.6, 10, 0, -20], [2.4, -60, 0, -30], [3.0, -60, 0, -30]])),
      esc('nucleo', poses([[0, 1, 1, 1], [1.6, 0.6, 0.6, 0.6], [2.4, 0.05, 0.05, 0.05], [3.0, 0.05, 0.05, 0.05]])),
      esc('ojo', poses([[0, 1, 1, 1], [2.0, 1, 1, 1], [2.4, 1, 0.05, 1], [3.0, 1, 0.05, 1]])),
    ], 'reaccion', 'Derrota: cae de rodillas, el núcleo se apaga y se desploma hacia delante.', false),
  ];

  return { id: def.id, nombre: def.nombre, rol: 'Jefe de altar', raiz, animaciones };
}
