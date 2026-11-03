import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses,
  punta, rot, toon, toro, type Modelo,
} from './kit.ts';
import { halo } from './brillo.ts';

// Taro Sato, explorador de señales: el más rápido. Bajito, cabezón y siempre
// algo inclinado hacia delante, como a punto de salir corriendo. Pelo negro
// de punta y unas gafas grandes de cristal naranja subidas en la frente (como
// en su retrato), sudadera lima con la capucha bajada, una bufanda morada que
// le tapa la boca con dos colas largas que ondean, pantalón oscuro y
// zapatillas gordas. A la espalda, una antena parabólica casera remendada con
// cinta, más grande que él, con una varilla doblada que se queda atrás al
// correr. ADA va metida en el centro del disco.
//
// Se mueve a saltitos, rebotando. Clip `Habilidad`: se agacha, se envuelve
// en estática, se estira en una raya y desaparece; luego reaparece de golpe.
// Mide 2,2 m y mira hacia +z; su izquierda es +x.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);
const LIMA = '#9bdc3c', LIMA_OSCURO = '#6fa82a', BLANCO = '#eef2f5', MORADO = '#5b46c9', MORADO_OSCURO = '#3d2f96';
const MARINO = '#252a44', PIEL = '#f0c39c', PELO = '#161629', CRISTAL = '#ffa53a', DISCO = '#c9ced8';
const LADOS = [['i', 1], ['d', -1]] as const;
const COLAS = ['bufanda_a', 'bufanda_a2', 'bufanda_b', 'bufanda_b2'] as const;
const grados = THREE.MathUtils.degToRad;
const ARRIBA = new THREE.Vector3(0, 1, 0);

export function crearTaro(): Modelo {
  return conDetalle(0.55, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'taro';
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, 0.74, 0);
  pieza(cadera, barril(0.26, 0.24, 0.2, 0.08), toon(MARINO), 0, -0.02, 0);

  // Piernas cortas y zapatillas gordas de suela lima.
  for (const [lado, s] of LADOS) {
    const pierna = nodo(`pierna_${lado}`, cadera, 0.17 * s, -0.04, 0);
    pieza(pierna, capsula(0.12, 0.16), toon(MARINO), 0, -0.15, 0);
    const rodilla = nodo(`rodilla_${lado}`, pierna, 0, -0.32, 0);
    rodilla.rotation.x = grados(6);
    pieza(rodilla, capsula(0.105, 0.12), toon(MARINO), 0, -0.1, 0);
    pieza(rodilla, caja(0.3, 0.2, 0.46, 0.09), toon(BLANCO), 0, -0.27, 0.06);
    pieza(rodilla, caja(0.32, 0.08, 0.5, 0.03), toon(LIMA), 0, -0.36, 0.06);
    pieza(rodilla, caja(0.18, 0.04, 0.16, 0.015), toon(MORADO), 0, -0.17, 0.18, { contorno: false });
    nodo(`enganche_bota_${lado}`, rodilla, 0, -0.29, 0.04).scale.set(0.78, 0.85, 0.85);
  }

  // Sudadera lima con bolsillo, cordones y la capucha bajada.
  const pecho = nodo('pecho', cadera, 0, 0.06, 0);
  pecho.rotation.x = grados(8);
  pieza(pecho, barril(0.34, 0.4, 0.56, 0.16).scale(1, 1, 0.86), toon(LIMA), 0, 0.28, 0);
  pieza(pecho, toro(0.39, 0.05), toon(LIMA_OSCURO), 0, 0.02, 0);
  pieza(pecho, caja(0.42, 0.16, 0.06, 0.04), toon(LIMA_OSCURO), 0, 0.14, 0.32);
  for (const s of [1, -1]) {
    pieza(pecho, capsula(0.018, 0.12), toon(BLANCO), 0.07 * s, 0.4, 0.31, { contorno: false });
    pieza(pecho, caja(0.03, 0.5, 0.02, 0.01), toon(BLANCO), 0.335 * s, 0.28, 0, { contorno: false }).rotation.z = 0.12 * s;
  }
  pieza(pecho, toro(0.23, 0.1), toon(LIMA), 0, 0.56, -0.06);
  pieza(pecho, esfera(0.2, 1.25, 0.7, 0.8), toon(LIMA_OSCURO), 0, 0.56, -0.25);

  // Bufanda morada que le tapa la boca, con dos colas que ondean detrás.
  pieza(pecho, toro(0.22, 0.12), toon(MORADO), 0, 0.68, 0.03);
  pieza(pecho, esfera(0.21, 1.45, 0.55, 0.85), toon(MORADO), 0, 0.8, 0.17);
  for (const [cola, x] of [['a', 0.1], ['b', -0.08]] as const) {
    const c = nodo(`bufanda_${cola}`, pecho, x, 0.7, -0.26);
    c.rotation.x = grados(22);
    pieza(c, caja(0.15, 0.34, 0.05, 0.02), toon(MORADO), 0, -0.16, 0);
    const c2 = nodo(`bufanda_${cola}2`, c, 0, -0.32, 0);
    c2.rotation.x = grados(10);
    pieza(c2, caja(0.14, 0.3, 0.05, 0.02), toon(MORADO), 0, -0.14, 0);
    pieza(c2, caja(0.15, 0.05, 0.06, 0.02), toon(MORADO_OSCURO), 0, -0.28, 0);
  }

  // Cabeza grande: pelo de punta, gafas naranjas en la frente, ojos vivos.
  const cabeza = nodo('cabeza', pecho, 0, 0.6, 0.04);
  cabeza.rotation.x = grados(-6);
  pieza(cabeza, esfera(0.36, 1, 0.98, 0.95), toon(PIEL), 0, 0.36, 0);
  pieza(cabeza, new THREE.SphereGeometry(0.378, 18, 9, 0, TAU, 0, Math.PI * 0.5), toon(PELO), 0, 0.38, -0.03).rotation.x = -0.3;
  const puntas: [number, number, number, number][] = [
    [0, 1, -0.1, 0.32], [0.45, 0.9, -0.2, 0.28], [-0.45, 0.9, -0.2, 0.28], [0.2, 0.7, -0.7, 0.3], [-0.2, 0.7, -0.7, 0.3],
    [0, 0.3, -1, 0.28], [0.6, 0.4, -0.6, 0.24], [-0.6, 0.4, -0.6, 0.24], [0.85, 0.5, 0.05, 0.22], [-0.85, 0.5, 0.05, 0.22],
    [0.3, 0.6, 0.75, 0.22], [-0.15, 0.55, 0.85, 0.24], [0.05, 0.85, 0.5, 0.26], [0.7, 0.75, 0.3, 0.22], [-0.7, 0.75, 0.3, 0.22],
  ];
  for (const [x, y, z, largo] of puntas) {
    const dir = new THREE.Vector3(x, y, z).normalize();
    const p = pieza(cabeza, punta(0.13, largo * 1.45, 5), toon(PELO), dir.x * 0.36, 0.38 + dir.y * 0.36, dir.z * 0.36 - 0.02);
    p.quaternion.setFromUnitVectors(ARRIBA, dir);
  }
  // Gafas de cristal subidas: correa lima y dos lentes naranjas.
  const gafas = nodo('gafas', cabeza, 0, 0.56, 0);
  gafas.rotation.x = grados(-14);
  pieza(gafas, toro(0.37, 0.03), toon(LIMA), 0, 0, -0.02, { contorno: false });
  for (const s of [1, -1]) {
    const lente = nodo(`lente_${s > 0 ? 'i' : 'd'}`, gafas, 0.13 * s, 0.04, 0.32);
    lente.rotation.x = grados(-30);
    pieza(lente, barril(0.115, 0.12, 0.08, 0.03).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0, 0);
    pieza(lente, barril(0.09, 0.09, 0.02, 0.01).rotateX(Math.PI / 2), toon(CRISTAL), 0, 0, 0.04, { contorno: false });
    pieza(lente, caja(0.05, 0.018, 0.01, 0.005), brillo('#fff3d6'), 0.03, 0.03, 0.052, { contorno: false }).rotation.z = 0.5;
  }
  pieza(gafas, caja(0.08, 0.03, 0.04, 0.01), toon(PALETA.metalOscuro), 0, 0.04, 0.33);
  for (const [lado, s] of LADOS) {
    ojo(cabeza, lado, 0.08, 0.14 * s, 0.36, 0.3, '#4a2a16');
    const ceja = pieza(cabeza, capsula(0.022, 0.08).rotateZ(Math.PI / 2), toon(PELO), 0.14 * s, 0.49, 0.32, { contorno: false });
    ceja.rotation.z = -0.25 * s;
    pieza(cabeza, esfera(0.07, 0.6, 1, 1), toon(PIEL), 0.35 * s, 0.34, 0);
  }
  pieza(cabeza, esfera(0.035, 1, 0.9, 1), toon('#e0a982'), 0, 0.27, 0.355, { contorno: false });

  // Brazos con codo, puños blancos y mitones morados.
  for (const [lado, s] of LADOS) {
    const hombro = nodo(`hombro_${lado}`, pecho, 0.39 * s, 0.46, 0);
    hombro.rotation.z = grados(10 * s);
    pieza(hombro, esfera(0.12), toon(LIMA));
    pieza(hombro, capsula(0.1, 0.18), toon(LIMA), 0, -0.15, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.32, 0);
    codo.rotation.x = grados(-14);
    pieza(codo, capsula(0.09, 0.13), toon(LIMA), 0, -0.1, 0);
    pieza(codo, toro(0.095, 0.03), toon(BLANCO), 0, -0.21, 0);
    const mano = nodo(`mano_${lado}`, codo, 0, -0.3, 0.01);
    pieza(mano, esfera(0.1, 1, 1.1, 1), toon(PIEL));
    pieza(mano, esfera(0.106, 1, 0.65, 1.02), toon(MORADO), 0, -0.01, 0, { contorno: false });
  }

  // La antena casera: plato remendado con cinta, ADA en el centro y la varilla doblada.
  const antena = nodo('antena', pecho, 0, 0.42, -0.36);
  antena.rotation.x = grados(-12);
  pieza(antena, caja(0.22, 0.3, 0.12, 0.04), toon(PALETA.metalOscuro), 0, -0.04, 0.06);
  barra(antena, [0, 0, 0], [0, 0.16, -0.14], 0.04, toon(PALETA.metal));
  const disco = nodo('disco', antena, 0, 0.18, -0.16);
  pieza(disco, barril(0.7, 0.14, 0.18, 0.05).rotateX(-Math.PI / 2), toon(PALETA.metal), 0, 0, 0);
  pieza(disco, barril(0.62, 0.62, 0.02, 0.01).rotateX(-Math.PI / 2), toon(DISCO), 0, 0, -0.095, { contorno: false });
  for (const r of [0.24, 0.44]) pieza(disco, new THREE.TorusGeometry(r, 0.012, 4, 30), toon('#a6adbb'), 0, 0, -0.108, { contorno: false });
  pieza(disco, new THREE.TorusGeometry(0.7, 0.045, 6, 32), toon(PALETA.metalOscuro), 0, 0, -0.09);
  // Cinta americana en cruz y un cable lima de los de toda la vida.
  pieza(disco, caja(0.5, 0.09, 0.012, 0.005), toon('#dfe3e8'), 0.18, 0.28, -0.11, { contorno: false }).rotation.z = 0.6;
  pieza(disco, caja(0.5, 0.09, 0.012, 0.005), toon('#dfe3e8'), 0.18, 0.28, -0.112, { contorno: false }).rotation.z = -0.6;
  barra(disco, [-0.66, -0.1, -0.1], [-0.4, -0.5, -0.12], 0.018, toon(LIMA), { contorno: false });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 2;
    barra(disco, [Math.cos(a) * 0.66, Math.sin(a) * 0.66, -0.1], [0, 0, -0.42], 0.014, toon(PALETA.metalOscuro));
  }
  const ada = nodo('ada', disco, 0, 0, -0.44);
  pieza(ada, esfera(0.08), brillo(PALETA.ada), 0, 0, 0, { contorno: false });
  pieza(ada, barril(0.07, 0.09, 0.06, 0.02).rotateX(-Math.PI / 2), toon(PALETA.metalOscuro), 0, 0, 0.06);
  halo(ada, PALETA.ada, 0.7, 0, 0, 0, 0.7);
  // La varilla sale del borde de arriba y se dobla hacia atrás.
  const varilla = nodo('varilla', disco, 0.22, 0.64, -0.06);
  barra(varilla, [0, 0, 0], [0, 0.42, -0.04], 0.022, toon(PALETA.metal));
  const doblez = nodo('varilla_punta', varilla, 0, 0.42, -0.04);
  doblez.rotation.x = grados(-38);
  barra(doblez, [0, 0, 0], [0, 0.34, 0], 0.018, toon(PALETA.metal));
  pieza(doblez, esfera(0.05), brillo(LIMA), 0, 0.36, 0, { contorno: false });

  nodo('enganche_mochila', pecho, 0, 0.26, -0.34).scale.setScalar(0.78);

  // Estática del salto de señal: anillos y píxeles que lo envuelven (solo en la habilidad).
  const estatica = nodo('estatica', raiz, 0, 1.05, 0);
  [[0.62, 0.2, 0], [0.55, -0.35, 0.8], [0.68, 0.5, -0.6]].forEach(([r, inclina, gira]) => {
    const anillo = pieza(estatica, new THREE.TorusGeometry(r, 0.03, 4, 24), brillo(LIMA), 0, 0, 0, { contorno: false, sombra: false });
    anillo.rotation.set(Math.PI / 2 + inclina, gira, 0);
  });
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4, y = ((k * 37) % 13) / 13 - 0.5;
    pieza(estatica, caja(0.08, 0.08, 0.08, 0.01), brillo(k % 3 ? '#eaffd0' : LIMA), Math.cos(a) * 0.55, y * 1.6, Math.sin(a) * 0.55, { contorno: false, sombra: false });
  }
  halo(estatica, LIMA, 2.4, 0, 0, 0, 0.6);
  estatica.scale.setScalar(0.001);

  // ---------------------------------------------------------- animaciones

  const pasos = (d: number, abre: number, rodilla: number) => [
    rot('pierna_i', ciclo(d, (f) => [sen(f) * abre, 0, 0])),
    rot('pierna_d', ciclo(d, (f) => [-sen(f) * abre, 0, 0])),
    rot('rodilla_i', ciclo(d, (f) => [6 + rodilla * Math.max(0, -cos(f)), 0, 0])),
    rot('rodilla_d', ciclo(d, (f) => [6 + rodilla * Math.max(0, cos(f)), 0, 0])),
  ];
  const brazos = (d: number, fn: (f: number) => readonly [number, number, number]) => [
    rot('hombro_i', ciclo(d, (f) => fn(f))),
    rot('hombro_d', ciclo(d, (f) => { const [x, y, z] = fn(f + 0.5); return [x, -y, -z]; })),
  ];
  // Colas de la bufanda: `vuelo` las levanta hacia atrás y `ondea` las sacude.
  const colas = (d: number, vuelo: number, ondea: number, veces = 2) => COLAS.map((n, k) =>
    rot(n, ciclo(d, (f) => [(n.endsWith('2') ? 10 + vuelo * 0.3 : 22 + vuelo) + sen(f, veces, k * 0.18) * ondea, 0, sen(f, 1, k * 0.25) * ondea * 0.4])));
  const varilla_ = (d: number, atras: number, rebote: number, veces = 2) => [
    rot('varilla', ciclo(d, (f) => [-atras + sen(f, veces) * rebote, 0, sen(f) * rebote * 0.5])),
    rot('varilla_punta', ciclo(d, (f) => [-38 - atras * 0.5 + sen(f, veces, 0.15) * rebote * 1.4, 0, 0])),
  ];
  const rebote = (d: number, alto: number, veces = 2) =>
    mov(raiz, 'cadera', ciclo(d, (f) => [0, Math.abs(sen(f, veces / 2)) * alto, 0]));

  const animaciones = [
    animacion('Reposo', 2.0, [
      // No para quieto: rebota sobre las puntas y mira a todas partes.
      rebote(2.0, 0.035, 4),
      esc('cuerpo', ciclo(2.0, (f) => { const k = (1 - Math.abs(cos(f, 2))) * 0.025; return [1 + k, 1 - k, 1 + k]; })),
      rot('pecho', ciclo(2.0, (f) => [8 + sen(f, 2) * 2, sen(f) * 6, 0])),
      rot('cabeza', ciclo(2.0, (f) => [-6 + sen(f, 2) * 4, sen(f) * 26, sen(f, 1, 0.25) * 8])),
      ...brazos(2.0, (f) => [sen(f, 2) * 8, 0, 10 + sen(f) * 4]),
      rot('codo_i', ciclo(2.0, (f) => [-20 + sen(f, 2) * 10, 0, 0])),
      rot('codo_d', ciclo(2.0, (f) => [-20 - sen(f, 2) * 10, 0, 0])),
      ...pasos(2.0, 0, 0),
      ...colas(2.0, 0, 6),
      ...varilla_(2.0, 0, 6, 4),
      esc('ada', ciclo(2.0, (f) => { const k = 1 + 0.2 * sen(f, 2); return [k, k, k]; })),
      esc('ojo_i', parpadeo(2.0, 1.3)),
      esc('ojo_d', parpadeo(2.0, 1.3)),
    ], 'movimiento', 'No para quieto: rebota sobre las puntas, mira a todas partes y la varilla de la antena tiembla.'),

    animacion('Caminar', 0.9, [
      // A saltitos: dos botes por ciclo y la antena que se bambolea.
      ...pasos(0.9, 26, 36),
      rebote(0.9, 0.08),
      esc('cuerpo', ciclo(0.9, (f) => { const k = (1 - Math.abs(cos(f))) * 0.04; return [1 + k, 1 - k, 1 + k]; })),
      rot('cadera', ciclo(0.9, (f) => [0, -sen(f) * 8, 0])),
      rot('pecho', ciclo(0.9, (f) => [10 + sen(f, 2) * 2, sen(f) * 10, 0])),
      rot('cabeza', ciclo(0.9, (f) => [-8 + sen(f, 2) * 3, -sen(f) * 8, sen(f) * 4])),
      ...brazos(0.9, (f) => [-sen(f) * 26, 0, 10]),
      rot('codo_i', ciclo(0.9, () => [-30, 0, 0])),
      rot('codo_d', ciclo(0.9, () => [-30, 0, 0])),
      ...colas(0.9, 10, 10),
      ...varilla_(0.9, 6, 10),
    ], 'movimiento', 'Anda a saltitos, rebotando; la bufanda y la varilla de la antena acompañan cada bote.'),

    animacion('Correr', 0.55, [
      ...pasos(0.55, 46, 64),
      rebote(0.55, 0.12),
      esc('cuerpo', ciclo(0.55, (f) => { const k = (1 - Math.abs(cos(f))) * 0.05; return [1 + k, 1 - k, 1 + k]; })),
      rot('cadera', ciclo(0.55, (f) => [0, -sen(f) * 10, 0])),
      rot('pecho', ciclo(0.55, (f) => [20 + sen(f, 2) * 3, sen(f) * 12, 0])),
      rot('cabeza', ciclo(0.55, (f) => [-16, -sen(f) * 8, 0])),
      ...brazos(0.55, (f) => [-sen(f) * 54, 0, 12]),
      rot('codo_i', ciclo(0.55, () => [-64, 0, 0])),
      rot('codo_d', ciclo(0.55, () => [-64, 0, 0])),
      ...colas(0.55, 50, 14, 3),
      ...varilla_(0.55, 30, 8),
    ], 'movimiento', 'Carrera rebotona: la bufanda vuela detrás y la varilla de la antena se queda atrás.'),

    animacion('Esprintar', 0.4, [
      // Carrera de señal: brazos atrás, muy inclinado, colas en horizontal.
      ...pasos(0.4, 58, 76),
      rebote(0.4, 0.1),
      rot('pecho', ciclo(0.4, (f) => [34 + sen(f, 2) * 3, sen(f) * 8, 0])),
      rot('cabeza', ciclo(0.4, () => [-28, 0, 0])),
      ...brazos(0.4, (f) => [72 + sen(f) * 6, 0, 14]),
      rot('codo_i', ciclo(0.4, () => [-8, 0, 0])),
      rot('codo_d', ciclo(0.4, () => [-8, 0, 0])),
      ...colas(0.4, 80, 10, 4),
      ...varilla_(0.4, 60, 6),
      esc('ada', ciclo(0.4, (f) => { const k = 1.25 + 0.2 * sen(f, 2); return [k, k, k]; })),
    ], 'movimiento', 'Sprint: casi tumbado hacia delante, brazos atrás, bufanda y varilla en horizontal.'),

    animacion('Saltar', 0.65, [
      // Salto recogido: rodillas al pecho y la antena que rebota.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.1, 0, -0.14, 0], [0.28, 0, 0.18, 0], [0.5, 0, 0.06, 0], [0.65, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.1, 1.14, 0.84, 1.14], [0.28, 0.9, 1.16, 0.9], [0.48, 1, 1, 1], [0.65, 1, 1, 1]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.12, 0, 0, 0], [0.34, -16, 0, 0], [0.65, 0, 0, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.1, -20, 0, 0], [0.3, -70, 0, 0], [0.65, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.1, -20, 0, 0], [0.3, -64, 0, 0], [0.65, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 6, 0, 0], [0.1, 40, 0, 0], [0.3, 110, 0, 0], [0.65, 6, 0, 0]])),
      rot('rodilla_d', poses([[0, 6, 0, 0], [0.1, 40, 0, 0], [0.3, 104, 0, 0], [0.65, 6, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.1, 30, 0, 20], [0.3, -40, 0, 60], [0.5, 0, 0, 30], [0.65, 0, 0, 10]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.1, 30, 0, -20], [0.3, -40, 0, -60], [0.5, 0, 0, -30], [0.65, 0, 0, -10]])),
      rot('varilla', poses([[0, 0, 0, 0], [0.12, 20, 0, 0], [0.32, -30, 0, 0], [0.5, 10, 0, 0], [0.65, 0, 0, 0]])),
    ], 'movimiento', 'Salto recogido con las rodillas al pecho; la varilla de la antena rebota.', false),

    animacion('Surfear', 1.6, [
      // De lado en la aerotabla, como en un monopatín.
      mov(raiz, 'cadera', ciclo(1.6, (f) => [sen(f) * 0.03, -0.12 + sen(f, 2) * 0.02, 0])),
      rot('cadera', ciclo(1.6, () => [0, 30, 0])),
      rot('pierna_i', ciclo(1.6, () => [-22, 0, 10])),
      rot('pierna_d', ciclo(1.6, () => [-14, 0, -10])),
      rot('rodilla_i', ciclo(1.6, () => [40, 0, 0])),
      rot('rodilla_d', ciclo(1.6, () => [30, 0, 0])),
      rot('pecho', ciclo(1.6, (f) => [12, -24 + sen(f) * 6, sen(f) * 5])),
      rot('cabeza', ciclo(1.6, (f) => [-8, -8 - sen(f) * 6, 0])),
      rot('hombro_i', ciclo(1.6, (f) => [-50, 0, 40 + sen(f) * 8])),
      rot('hombro_d', ciclo(1.6, (f) => [30, 0, -40 + sen(f) * 8])),
      ...colas(1.6, 40, 8),
      ...varilla_(1.6, 24, 6),
    ], 'movimiento', 'De lado en la aerotabla como en un monopatín, un brazo delante y otro detrás.'),

    animacion('Volar', 0.8, [
      // Pose de superhéroe: un puño por delante.
      mov(raiz, 'cadera', ciclo(0.8, (f) => [0, sen(f) * 0.04, 0])),
      rot('pecho', ciclo(0.8, (f) => [24, 0, sen(f) * 3])),
      rot('cabeza', ciclo(0.8, () => [-22, 0, 0])),
      rot('pierna_i', ciclo(0.8, (f) => [20 + sen(f) * 6, 0, 4])),
      rot('pierna_d', ciclo(0.8, (f) => [34 - sen(f) * 6, 0, -4])),
      rot('rodilla_i', ciclo(0.8, () => [40, 0, 0])),
      rot('rodilla_d', ciclo(0.8, () => [20, 0, 0])),
      rot('hombro_i', ciclo(0.8, (f) => [-150 + sen(f, 2) * 4, 0, 10])),
      rot('hombro_d', ciclo(0.8, (f) => [30, 0, -20 - sen(f, 2) * 4])),
      rot('codo_i', ciclo(0.8, () => [0, 0, 0])),
      ...colas(0.8, 70, 12, 4),
      ...varilla_(0.8, 40, 6),
    ], 'movimiento', 'Colgado de la mochila cohete en pose de superhéroe, un puño por delante.'),

    animacion('Impulso', 0.35, [
      rot('pecho', poses([[0, 8, 0, 0], [0.06, 36, 0, 0], [0.25, 30, 0, 0], [0.35, 14, 0, 0]])),
      rot('cabeza', poses([[0, -6, 0, 0], [0.06, -26, 0, 0], [0.35, -10, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.06, 70, 0, 18], [0.35, 24, 0, 12]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.06, 70, 0, -18], [0.35, 24, 0, -12]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.06, -34, 0, 0], [0.35, -8, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.06, 40, 0, 0], [0.35, 10, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.88, 1.08, 1.16], [0.35, 1, 1, 1]])),
      rot('bufanda_a', poses([[0, 22, 0, 0], [0.06, 90, 0, 0], [0.35, 50, 0, 0]])),
      rot('bufanda_b', poses([[0, 22, 0, 0], [0.06, 86, 0, 0], [0.35, 46, 0, 0]])),
    ], 'movimiento', 'Sale disparado hacia delante y la bufanda se queda atrás.', false),

    animacion('Golpe recibido', 0.45, [
      rot('pecho', poses([[0, 8, 0, 0], [0.08, -18, 0, 6], [0.45, 8, 0, 0]])),
      rot('cabeza', poses([[0, -6, 0, 0], [0.08, -24, 0, 10], [0.45, -6, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.08, -30, 0, 60], [0.45, 0, 0, 10]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.08, -30, 0, -60], [0.45, 0, 0, -10]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.12, 0.86, 1.12], [0.2, 0.95, 1.06, 0.95], [0.45, 1, 1, 1]])),
      rot('varilla', poses([[0, 0, 0, 0], [0.08, 30, 0, 10], [0.25, -20, 0, -6], [0.45, 0, 0, 0]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.06, 1.4, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.06, 1.4, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Da un respingo, cierra los ojos y la antena se sacude.', false),

    animacion('Victoria', 1.0, [
      // Saltitos con el puño arriba mientras el plato de la antena da una vuelta.
      mov(raiz, 'cuerpo', ciclo(1.0, (f) => [0, Math.abs(sen(f, 2)) * 0.3, 0])),
      esc('cuerpo', ciclo(1.0, (f) => { const k = (1 - Math.abs(sen(f, 2))) ** 4 * 0.1; return [1 + k, 1 - k, 1 + k]; })),
      rot('hombro_i', ciclo(1.0, (f) => [-165 + sen(f, 2) * 12, 0, 14])),
      rot('hombro_d', ciclo(1.0, (f) => [-40 + sen(f, 2) * 20, 0, -30])),
      rot('codo_d', ciclo(1.0, (f) => [-90 - sen(f, 2) * 20, 0, 0])),
      rot('pecho', ciclo(1.0, (f) => [0, sen(f) * 14, 0])),
      rot('cabeza', ciclo(1.0, (f) => [-14, sen(f) * 12, sen(f, 2) * 8])),
      rot('pierna_i', ciclo(1.0, (f) => [-Math.abs(sen(f, 2)) * 30, 0, 0])),
      rot('pierna_d', ciclo(1.0, (f) => [-Math.abs(sen(f, 2)) * 22, 0, 0])),
      rot('rodilla_i', ciclo(1.0, (f) => [6 + Math.abs(sen(f, 2)) * 60, 0, 0])),
      rot('rodilla_d', ciclo(1.0, (f) => [6 + Math.abs(sen(f, 2)) * 46, 0, 0])),
      rot('disco', ciclo(1.0, (f) => [0, 0, f * 360])),
      ...colas(1.0, 20, 16, 4),
      esc('ada', ciclo(1.0, (f) => { const k = 1.2 + 0.3 * sen(f, 4); return [k, k, k]; })),
      esc('ojo_i', ciclo(1.0, () => [1.15, 0.5, 1])),
      esc('ojo_d', ciclo(1.0, () => [1.15, 0.5, 1])),
    ], 'reaccion', 'Da saltitos con el puño en alto y el plato de la antena da vueltas de alegría.'),

    animacion('Derrota', 1.4, [
      // Cae de culo, rueda hacia atrás sobre la antena y se queda mirando al cielo.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.3, 0, 0.04, 0], [0.7, 0, -0.5, -0.1], [1.4, 0, -0.52, -0.1]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.7, 0, 0, 0], [1.0, -38, 0, 0], [1.15, -30, 0, 0], [1.4, -34, 0, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.7, -80, 0, 8], [1.4, -90, 0, 8]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.7, -70, 0, -8], [1.4, -84, 0, -8]])),
      rot('rodilla_i', poses([[0, 6, 0, 0], [0.7, 40, 0, 0], [1.4, 20, 0, 0]])),
      rot('rodilla_d', poses([[0, 6, 0, 0], [0.7, 50, 0, 0], [1.4, 30, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.7, 30, 0, 40], [1.4, 10, 0, 70]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.7, 30, 0, -40], [1.4, 10, 0, -70]])),
      rot('cabeza', poses([[0, -6, 0, 0], [0.7, 10, 0, 0], [1.4, -10, 0, 10]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ada', poses([[0, 1, 1, 1], [0.8, 0.7, 0.7, 0.7], [1.4, 0.4, 0.4, 0.4]])),
    ], 'reaccion', 'Cae de culo, rueda hacia atrás sobre la antena y ADA se apaga.', false),

    animacion('Habilidad', 0.8, [
      // Se agacha, la estática lo envuelve, se estira en una raya y desaparece;
      // reaparece de golpe (el juego lo mueve al punto de llegada a los 0,4 s).
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.14, 0, -0.2, 0], [0.3, 0, -0.16, 0], [0.56, 0, 0.06, 0], [0.8, 0, 0, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.14, -34, 0, 6], [0.36, -30, 0, 6], [0.56, 0, 0, 0], [0.8, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.14, -34, 0, -6], [0.36, -30, 0, -6], [0.56, 0, 0, 0], [0.8, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 6, 0, 0], [0.14, 62, 0, 0], [0.36, 56, 0, 0], [0.56, 10, 0, 0], [0.8, 6, 0, 0]])),
      rot('rodilla_d', poses([[0, 6, 0, 0], [0.14, 62, 0, 0], [0.36, 56, 0, 0], [0.56, 10, 0, 0], [0.8, 6, 0, 0]])),
      rot('pecho', poses([[0, 8, 0, 0], [0.14, 30, 0, 0], [0.36, 26, 0, 0], [0.56, -6, 0, 0], [0.8, 8, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.14, -50, 0, -10], [0.36, -50, 0, -12], [0.56, 0, 0, 60], [0.8, 0, 0, 10]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.14, -50, 0, 10], [0.36, -50, 0, 12], [0.56, 0, 0, -60], [0.8, 0, 0, -10]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.2, 1, 1, 1], [0.32, 0.45, 1.25, 0.45], [0.38, 0.05, 1.6, 0.05], [0.41, 0.001, 0.001, 0.001],
        [0.44, 0.05, 1.6, 0.05], [0.56, 1.3, 0.76, 1.3], [0.68, 0.94, 1.06, 0.94], [0.8, 1, 1, 1]])),
      esc('estatica', poses([[0, 0.001, 0.001, 0.001], [0.06, 0.001, 0.001, 0.001], [0.2, 1, 1, 1], [0.38, 1.25, 1.4, 1.25], [0.5, 0.8, 1, 0.8], [0.8, 0.001, 0.001, 0.001]])),
      rot('estatica', poses([[0, 0, 0, 0], [0.8, 0, 720, 0]])),
      esc('ada', poses([[0, 1, 1, 1], [0.3, 1.8, 1.8, 1.8], [0.56, 1, 1, 1], [0.8, 1, 1, 1]])),
    ], 'ataque', 'Salto de señal: se agacha, se envuelve en estática, se estira en una raya, desaparece y reaparece de golpe.', false),
  ];

  return { id: 'taro', nombre: 'Taro Sato', rol: 'Jugador · explorador de señales, 2,2 m', raiz, animaciones };
}
