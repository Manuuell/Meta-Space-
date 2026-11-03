import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses,
  rot, toon, toro, type Modelo,
} from './kit.ts';
import { halo } from './brillo.ts';

// Idris Okafor, mecánico de campo: el tanque. Un hombretón con silueta de
// triángulo invertido (hombros y brazos enormes, piernas cortas y fuertes),
// sin casco: cara al aire con barba cerrada y la máscara de soldar subida
// sobre la frente, como en su retrato. Mono naranja con las mangas
// remangadas, delantal de cuero, cinturón de herramientas lleno, botas de
// trabajo con puntera de acero y la llave de impacto gigante al hombro
// derecho. ADA le cuelga del cuello en un colgante de chatarra.
//
// Anda pesado, balanceando mucho los brazos y el delantal. Clip `Habilidad`:
// se baja la máscara, levanta los dos puños por encima de la cabeza y golpea
// el suelo. Mide 2,8 m y mira hacia +z; su izquierda es +x.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);
const NARANJA = '#ffad35', NARANJA_OSCURO = '#d9822a', MARINO = '#24324f';
const CUERO = '#86512c', CUERO_OSCURO = '#5a3420', PIEL = '#7a4a2e', PELO = '#1d1411';
const MASCARA = '#566684', BOTA = '#3b2a22';
const LADOS = [['i', 1], ['d', -1]] as const;
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);
const grados = THREE.MathUtils.degToRad;

export function crearIdris(): Modelo {
  return conDetalle(0.55, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'idris';
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, 0.95, 0);
  pieza(cadera, barril(0.48, 0.42, 0.36, 0.12).scale(1, 1, 0.82), toon(NARANJA), 0, -0.06, 0);

  // Cinturón de herramientas: bolsas, martillo y cinta métrica.
  pieza(cadera, toro(0.5, 0.07).scale(1, 1, 0.84), toon(CUERO_OSCURO), 0, 0.08, 0);
  pieza(cadera, caja(0.14, 0.12, 0.05, 0.02), toon(PALETA.metal), 0, 0.08, 0.43);
  for (const s of [1, -1]) {
    const bolsa = pieza(cadera, caja(0.2, 0.24, 0.16, 0.05), toon(CUERO), 0.48 * s, -0.04, 0.12);
    bolsa.rotation.y = 0.5 * s;
    pieza(cadera, capsula(0.025, 0.12), toon(s > 0 ? '#ff5b3a' : PALETA.metal), 0.5 * s, 0.12, 0.16, { contorno: false });
  }
  barra(cadera, [-0.5, 0.06, -0.12], [-0.56, -0.34, -0.06], 0.035, toon(CUERO_OSCURO));
  pieza(cadera, caja(0.24, 0.1, 0.1, 0.03), toon(PALETA.metalOscuro), -0.56, -0.38, -0.06);
  pieza(cadera, barril(0.09, 0.09, 0.07, 0.02).rotateZ(Math.PI / 2), toon('#ffd24a'), 0.42, -0.02, -0.3);

  // Faldón del delantal: cuelga de la cadera y se mueve con las piernas.
  const delantal = nodo('delantal', cadera, 0, 0.04, 0.4);
  pieza(delantal, caja(0.74, 0.64, 0.06, 0.03), toon(CUERO), 0, -0.3, 0.02);
  pieza(delantal, caja(0.66, 0.03, 0.02, 0.01), toon(CUERO_OSCURO), 0, -0.55, 0.06, { contorno: false });

  // Piernas cortas y gruesas, botas de trabajo con puntera de acero.
  for (const [lado, s] of LADOS) {
    const pierna = nodo(`pierna_${lado}`, cadera, 0.3 * s, -0.05, 0);
    pieza(pierna, capsula(0.21, 0.24), toon(NARANJA), 0, -0.2, 0);
    const rodilla = nodo(`rodilla_${lado}`, pierna, 0, -0.45, 0);
    rodilla.rotation.x = grados(4);
    pieza(rodilla, capsula(0.18, 0.16), toon(NARANJA), 0, -0.13, 0);
    pieza(rodilla, toro(0.19, 0.05), toon(NARANJA_OSCURO), 0, -0.22, 0);
    pieza(rodilla, caja(0.42, 0.28, 0.58, 0.1), toon(BOTA), 0, -0.32, 0.06);
    pieza(rodilla, esfera(0.2, 1.05, 0.62, 0.85), toon(PALETA.metal), 0, -0.34, 0.24);
    pieza(rodilla, caja(0.44, 0.07, 0.6, 0.03), toon(PALETA.oscuro), 0, -0.44, 0.06);
    nodo(`enganche_bota_${lado}`, rodilla, 0, -0.33, 0.04).scale.setScalar(1.06);
  }

  // Tronco en triángulo invertido: el mono, la camiseta marino y el delantal.
  const pecho = nodo('pecho', cadera, 0, 0.08, 0);
  const tronco = nodo('tronco', pecho);
  pieza(tronco, barril(0.68, 0.46, 1.0, 0.24).scale(1, 1, 0.78), toon(NARANJA), 0, 0.55, 0);
  pieza(pecho, caja(0.3, 0.2, 0.06, 0.05), toon(MARINO), 0, 0.98, 0.42);
  pieza(pecho, caja(0.7, 0.62, 0.06, 0.03), toon(CUERO), 0, 0.5, 0.44).rotation.x = -0.1;
  pieza(pecho, caja(0.32, 0.18, 0.03, 0.02), toon(CUERO_OSCURO), 0.13, 0.36, 0.49);
  pieza(pecho, capsula(0.03, 0.12), toon(NARANJA_OSCURO), 0.2, 0.5, 0.5, { contorno: false });
  for (const s of [1, -1]) {
    barra(pecho, [0.3 * s, 0.78, 0.45], [0.4 * s, 1.06, 0.06], 0.035, toon(CUERO));
  }
  pieza(pecho, barril(0.2, 0.25, 0.22, 0.08), toon(PIEL), 0, 1.06, 0.02);

  // ADA, en el colgante de chatarra: cadena, marco hexagonal y el orbe.
  const cadena = pieza(pecho, toro(0.25, 0.018), toon(PALETA.metal), 0, 0.98, 0.1, { contorno: false });
  cadena.rotation.x = 0.55;
  pieza(pecho, new THREE.CylinderGeometry(0.12, 0.12, 0.05, 6).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0.82, 0.5);
  const ada = nodo('ada', pecho, 0, 0.82, 0.53);
  pieza(ada, esfera(0.075), brillo(PALETA.ada), 0, 0, 0, { contorno: false });
  halo(ada, PALETA.ada, 0.5, 0, 0, 0.02, 0.6);

  // Cabeza: barba cerrada, bigote, cejas gruesas y la máscara de soldar subida.
  const cabeza = nodo('cabeza', pecho, 0, 1.1, 0.05);
  pieza(cabeza, esfera(0.35, 1, 1.06, 0.96), toon(PIEL), 0, 0.36, 0);
  const pelo = pieza(cabeza, new THREE.SphereGeometry(0.368, 20, 10, 0, TAU, 0, Math.PI * 0.42), toon(PELO), 0, 0.38, -0.02);
  pelo.rotation.x = -0.28;
  const barba = pieza(cabeza, new THREE.SphereGeometry(0.375, 20, 10, -0.2, Math.PI + 0.4, Math.PI * 0.48, Math.PI * 0.52), toon(PELO), 0, 0.32, 0.03);
  barba.scale.set(1, 1.18, 1);
  pieza(cabeza, capsula(0.045, 0.16).rotateZ(Math.PI / 2), toon(PELO), 0, 0.27, 0.35);
  const boca = pieza(cabeza, new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI).rotateZ(Math.PI), toon('#c27a64'), 0, 0.2, 0.37, { contorno: false });
  boca.rotation.x = -0.3;
  pieza(cabeza, esfera(0.075, 1.3, 0.95, 1), toon(PIEL), 0, 0.33, 0.35);
  for (const [lado, s] of LADOS) {
    ojo(cabeza, lado, 0.068, 0.13 * s, 0.45, 0.3, '#2a1a12');
    const ceja = pieza(cabeza, capsula(0.03, 0.11).rotateZ(Math.PI / 2), toon(PELO), 0.13 * s, 0.55, 0.31, { contorno: false });
    ceja.rotation.z = -0.15 * s;
    pieza(cabeza, esfera(0.07, 0.6, 1, 1), toon(PIEL), 0.35 * s, 0.37, 0);
  }
  // La máscara gira en las sienes: subida descansa encima de la cabeza.
  // Es un casquete curvo: subida, abraza la frente y la coronilla.
  const mascara = nodo('mascara', cabeza, 0, 0.36, 0);
  mascara.rotation.x = grados(-58);
  pieza(mascara, new THREE.SphereGeometry(0.43, 18, 8, Math.PI / 2 - 0.85, 1.7, Math.PI * 0.3, Math.PI * 0.42), toon(MASCARA), 0, 0, 0);
  pieza(mascara, caja(0.4, 0.11, 0.05, 0.03), toon('#121a2c'), 0, 0.05, 0.42);
  pieza(mascara, caja(0.12, 0.025, 0.01, 0.01), brillo('#9fb8e8'), 0.1, 0.08, 0.45, { contorno: false });
  for (const s of [1, -1]) {
    pieza(mascara, barril(0.07, 0.07, 0.05, 0.02).rotateZ(Math.PI / 2), toon(PALETA.metalOscuro), 0.38 * s, 0, 0);
    barra(mascara, [0.37 * s, 0, 0.04], [0.3 * s, 0.05, 0.28], 0.025, toon(PALETA.metalOscuro));
  }

  // La llave de impacto, tumbada sobre el hombro derecho y sujeta con una correa.
  const llave = nodo('llave', pecho, -0.6, 1.34, -0.05);
  llave.rotation.set(-0.22, 0.12, 0.1);
  pieza(llave, capsula(0.075, 0.28).rotateX(Math.PI / 2), toon(PALETA.oscuro), 0, -0.02, -0.62);
  pieza(llave, caja(0.22, 0.3, 0.34, 0.07), toon(NARANJA), 0, -0.06, -0.32);
  pieza(llave, barril(0.18, 0.18, 0.46, 0.06).rotateX(Math.PI / 2), toon(PALETA.metal), 0, 0, 0.06);
  pieza(llave, toro(0.185, 0.035).rotateX(Math.PI / 2), toon(NARANJA_OSCURO), 0, 0, 0.18);
  pieza(llave, barril(0.1, 0.1, 0.16, 0.03).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0, 0.36);
  pieza(llave, barril(0.17, 0.17, 0.22, 0.05).rotateX(Math.PI / 2), toon(PALETA.oscuro), 0, 0, 0.54);
  pieza(llave, new THREE.TorusGeometry(0.13, 0.03, 6, 18), brillo('#ffb347'), 0, 0, 0.66, { contorno: false });
  barra(pecho, [-0.6, 1.2, -0.28], [-0.05, 0.72, -0.52], 0.04, toon(CUERO_OSCURO));
  barra(pecho, [-0.05, 0.72, -0.52], [0.46, 0.2, -0.44], 0.04, toon(CUERO_OSCURO));

  nodo('enganche_mochila', pecho, 0, 0.55, -0.46).scale.setScalar(1.2);

  // Brazos enormes: hombro redondo, manga remangada, antebrazo al aire y guante.
  for (const [lado, s] of LADOS) {
    const hombro = nodo(`hombro_${lado}`, pecho, 0.8 * s, 0.9, 0);
    hombro.rotation.z = grados(14 * s);
    pieza(hombro, esfera(0.3), toon(NARANJA));
    pieza(hombro, capsula(0.22, 0.3), toon(NARANJA), 0, -0.32, 0);
    pieza(hombro, toro(0.235, 0.075), toon(NARANJA_OSCURO), 0, -0.56, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.62, 0);
    codo.rotation.x = grados(-14);
    pieza(codo, capsula(0.2, 0.26), toon(PIEL), 0, -0.2, 0);
    pieza(codo, toro(0.19, 0.05), toon(CUERO_OSCURO), 0, -0.42, 0);
    const puno = nodo(`puno_${lado}`, codo, 0, -0.56, 0.02);
    pieza(puno, esfera(0.25, 1, 1.05, 1.05), toon(CUERO));
    pieza(puno, caja(0.3, 0.1, 0.12, 0.04), toon(CUERO_OSCURO), 0, 0.05, 0.18);
    // Chispas del puñetazo contra el suelo: solo en la habilidad.
    const chispa = nodo(`chispa_${lado}`, puno, 0, -0.2, 0.1);
    pieza(chispa, esfera(0.22, 1.5, 0.45, 1.5), brillo('#ffcf74'), 0, 0, 0, { contorno: false, sombra: false });
    halo(chispa, '#ff9a3a', 1.8, 0, 0, 0, 0.9);
    oculto(chispa);
  }

  // ---------------------------------------------------------- animaciones

  const brazos = (d: number, fn: (f: number) => readonly [number, number, number]) => [
    rot('hombro_i', ciclo(d, (f) => fn(f))),
    rot('hombro_d', ciclo(d, (f) => { const [x, y, z] = fn(f + 0.5); return [x, -y, -z]; })),
  ];
  const codos = (d: number, fn: (f: number) => number) => [
    rot('codo_i', ciclo(d, (f) => [fn(f), 0, 0])),
    rot('codo_d', ciclo(d, (f) => [fn(f + 0.5), 0, 0])),
  ];
  const squash = (d: number, k: number) =>
    esc('cuerpo', ciclo(d, (f) => { const a = (1 - Math.abs(cos(f))) * k; return [1 + a, 1 - a, 1 + a]; }));
  const pasos = (d: number, abre: number, rodilla: number, base = 4) => [
    rot('pierna_i', ciclo(d, (f) => [sen(f) * abre, 0, 0])),
    rot('pierna_d', ciclo(d, (f) => [-sen(f) * abre, 0, 0])),
    rot('rodilla_i', ciclo(d, (f) => [base + rodilla * Math.max(0, -cos(f)), 0, 0])),
    rot('rodilla_d', ciclo(d, (f) => [base + rodilla * Math.max(0, cos(f)), 0, 0])),
    rot('delantal', ciclo(d, (f) => [-Math.abs(sen(f)) * abre * 0.7, 0, sen(f) * 4])),
  ];

  const animaciones = [
    animacion('Reposo', 2.6, [
      // Respira hondo con todo el pecho, sacude los hombros y mira alrededor.
      esc('tronco', ciclo(2.6, (f) => { const k = 0.025 * sen(f); return [1 + k, 1 + k * 0.4, 1 + k]; })),
      mov(raiz, 'cadera', ciclo(2.6, (f) => [sen(f) * 0.02, sen(f, 2) * 0.012, 0])),
      rot('cadera', ciclo(2.6, (f) => [0, 0, sen(f) * 2])),
      rot('pecho', ciclo(2.6, (f) => [-2 + sen(f) * 2, 0, -sen(f) * 2])),
      rot('cabeza', ciclo(2.6, (f) => [sen(f, 2) * 3, sen(f) * 16, sen(f) * 3])),
      rot('hombro_i', ciclo(2.6, (f) => [sen(f) * 3, 0, 14 + sen(f, 2) * 3])),
      rot('hombro_d', ciclo(2.6, (f) => [-sen(f) * 3, 0, -14 - sen(f, 2) * 3])),
      rot('codo_i', ciclo(2.6, (f) => [-14 + sen(f, 2) * 4, 0, 0])),
      rot('codo_d', ciclo(2.6, (f) => [-14 - sen(f, 2) * 4, 0, 0])),
      esc('ada', ciclo(2.6, (f) => { const k = 1 + 0.2 * sen(f, 2); return [k, k, k]; })),
      esc('ojo_i', parpadeo(2.6, 1.9)),
      esc('ojo_d', parpadeo(2.6, 1.9)),
    ], 'movimiento', 'Respira hondo con todo el pecho, se balancea sobre las piernas y mira alrededor.'),

    animacion('Caminar', 1.15, [
      // Paso pesado y seguro: brazos que se balancean mucho y el tronco que gira.
      ...pasos(1.15, 26, 30),
      mov(raiz, 'cadera', ciclo(1.15, (f) => [sen(f) * 0.05, -0.05 * (1 - Math.abs(cos(f))), 0])),
      rot('cadera', ciclo(1.15, (f) => [0, -sen(f) * 6, -sen(f) * 4])),
      squash(1.15, 0.025),
      rot('pecho', ciclo(1.15, (f) => [4, sen(f) * 10, sen(f) * 3])),
      rot('cabeza', ciclo(1.15, (f) => [-sen(f, 2) * 2, -sen(f) * 8, -sen(f) * 2])),
      ...brazos(1.15, (f) => [-sen(f) * 30, 0, 14]),
      ...codos(1.15, (f) => -18 - Math.max(0, sen(f)) * 20),
    ], 'movimiento', 'Anda pesado y balanceando mucho los brazos; el delantal y el tronco acompañan cada paso.'),

    animacion('Correr', 0.7, [
      ...pasos(0.7, 42, 50, 6),
      mov(raiz, 'cadera', ciclo(0.7, (f) => [0, 0.08 * Math.abs(cos(f)) - 0.05, 0])),
      rot('cadera', ciclo(0.7, (f) => [0, -sen(f) * 8, 0])),
      squash(0.7, 0.04),
      rot('pecho', ciclo(0.7, (f) => [14 + sen(f, 2) * 2, sen(f) * 12, 0])),
      rot('cabeza', ciclo(0.7, (f) => [-10, -sen(f) * 8, 0])),
      ...brazos(0.7, (f) => [-sen(f) * 50, 0, 16]),
      ...codos(0.7, () => -55),
    ], 'movimiento', 'Carrera de oso: zancadas cortas y fuertes, brazos doblados que bombean.'),

    animacion('Esprintar', 0.5, [
      // Embestida: la cabeza por delante, como un toro.
      ...pasos(0.5, 56, 62, 8),
      mov(raiz, 'cadera', ciclo(0.5, (f) => [0, 0.12 * Math.abs(cos(f)) - 0.1, 0.06])),
      rot('cadera', ciclo(0.5, (f) => [0, -sen(f) * 10, 0])),
      squash(0.5, 0.05),
      rot('pecho', ciclo(0.5, (f) => [28 + sen(f, 2) * 3, sen(f) * 14, 0])),
      rot('cabeza', ciclo(0.5, () => [-24, 0, 0])),
      ...brazos(0.5, (f) => [-sen(f) * 72 + 10, 0, 20]),
      ...codos(0.5, () => -75),
      esc('ada', ciclo(0.5, (f) => { const k = 1.2 + 0.2 * sen(f, 2); return [k, k, k]; })),
    ], 'movimiento', 'Embestida: inclinado como un toro, zancada larga y los puños por delante.'),

    animacion('Saltar', 0.75, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.14, 0, -0.22, 0], [0.32, 0, 0.12, 0], [0.58, 0, 0.04, 0], [0.75, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.14, 1.12, 0.86, 1.12], [0.32, 0.92, 1.12, 0.92], [0.55, 1, 1, 1], [0.75, 1, 1, 1]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.14, -30, 0, 0], [0.34, 14, 0, 0], [0.75, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.14, -30, 0, 0], [0.34, 4, 0, 0], [0.75, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 4, 0, 0], [0.14, 58, 0, 0], [0.34, 30, 0, 0], [0.75, 4, 0, 0]])),
      rot('rodilla_d', poses([[0, 4, 0, 0], [0.14, 58, 0, 0], [0.34, 40, 0, 0], [0.75, 4, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 14], [0.14, 30, 0, 18], [0.32, -150, 0, 30], [0.58, -40, 0, 30], [0.75, 0, 0, 14]])),
      rot('hombro_d', poses([[0, 0, 0, -14], [0.14, 30, 0, -18], [0.32, -150, 0, -30], [0.58, -40, 0, -30], [0.75, 0, 0, -14]])),
      rot('delantal', poses([[0, 0, 0, 0], [0.32, 18, 0, 0], [0.55, -10, 0, 0], [0.75, 0, 0, 0]])),
    ], 'movimiento', 'Se agacha con todo el peso, salta con los brazos arriba y el delantal ondea.', false),

    animacion('Surfear', 1.6, [
      mov(raiz, 'cadera', ciclo(1.6, (f) => [sen(f) * 0.03, -0.16 + sen(f, 2) * 0.02, 0])),
      rot('pierna_i', ciclo(1.6, () => [-24, 0, 6])),
      rot('pierna_d', ciclo(1.6, () => [-24, 0, -6])),
      rot('rodilla_i', ciclo(1.6, () => [44, 0, 0])),
      rot('rodilla_d', ciclo(1.6, () => [44, 0, 0])),
      rot('pecho', ciclo(1.6, (f) => [16, sen(f) * 8, sen(f) * 6])),
      rot('cabeza', ciclo(1.6, (f) => [-12, -sen(f) * 8, -sen(f) * 4])),
      rot('hombro_i', ciclo(1.6, (f) => [-10, 0, 66 + sen(f) * 10])),
      rot('hombro_d', ciclo(1.6, (f) => [-10, 0, -66 + sen(f) * 10])),
      rot('delantal', ciclo(1.6, (f) => [-20 + sen(f, 2) * 6, 0, 0])),
    ], 'movimiento', 'Agachado en la aerotabla, brazos abiertos como un equilibrista grandullón.'),

    animacion('Volar', 0.8, [
      mov(raiz, 'cadera', ciclo(0.8, (f) => [0, sen(f) * 0.04, 0])),
      rot('pecho', ciclo(0.8, (f) => [20, 0, sen(f) * 3])),
      rot('cabeza', ciclo(0.8, () => [-18, 0, 0])),
      rot('pierna_i', ciclo(0.8, (f) => [22 + sen(f) * 8, 0, 6])),
      rot('pierna_d', ciclo(0.8, (f) => [28 - sen(f) * 8, 0, -6])),
      rot('rodilla_i', ciclo(0.8, () => [30, 0, 0])),
      rot('rodilla_d', ciclo(0.8, () => [30, 0, 0])),
      rot('hombro_i', ciclo(0.8, (f) => [30, 0, 26 + sen(f, 2) * 4])),
      rot('hombro_d', ciclo(0.8, (f) => [30, 0, -26 - sen(f, 2) * 4])),
      rot('delantal', ciclo(0.8, (f) => [30 + sen(f, 2) * 8, 0, 0])),
    ], 'movimiento', 'Colgado de la mochila cohete, con el delantal flameando hacia atrás.'),

    animacion('Impulso', 0.35, [
      rot('pecho', poses([[0, 0, 0, 0], [0.06, 30, 0, 0], [0.25, 24, 0, 0], [0.35, 10, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.06, -20, 0, 0], [0.35, -6, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 14], [0.06, 50, 0, 24], [0.35, 18, 0, 16]])),
      rot('hombro_d', poses([[0, 0, 0, -14], [0.06, 50, 0, -24], [0.35, 18, 0, -16]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.06, -28, 0, 0], [0.35, -8, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.06, 34, 0, 0], [0.35, 10, 0, 0]])),
      rot('delantal', poses([[0, 0, 0, 0], [0.06, 26, 0, 0], [0.35, 6, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.9, 1.08, 1.12], [0.35, 1, 1, 1]])),
    ], 'movimiento', 'Se lanza hacia delante con las botas de impulso.', false),

    animacion('Golpe recibido', 0.45, [
      // Encaja el golpe: retrocede poco, aprieta los dientes y vuelve.
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -14, 0, 4], [0.45, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -16, 8, 6], [0.45, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 14], [0.08, -18, 0, 40], [0.45, 0, 0, 14]])),
      rot('hombro_d', poses([[0, 0, 0, -14], [0.08, -18, 0, -40], [0.45, 0, 0, -14]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.06, 0.93, 1.06], [0.2, 0.98, 1.03, 0.98], [0.45, 1, 1, 1]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Encaja el golpe: retrocede un poco, cierra los ojos y vuelve a plantarse.', false),

    animacion('Victoria', 1.2, [
      // Doble bíceps: saca músculo dos veces por ciclo y se ríe.
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, Math.abs(sen(f, 2)) * 0.12, 0])),
      rot('hombro_i', ciclo(1.2, (f) => [0, 0, 92 + sen(f, 2) * 6])),
      rot('hombro_d', ciclo(1.2, (f) => [0, 0, -92 - sen(f, 2) * 6])),
      rot('codo_i', ciclo(1.2, (f) => [0, 0, 100 + Math.abs(sen(f, 2)) * 22])),
      rot('codo_d', ciclo(1.2, (f) => [0, 0, -100 - Math.abs(sen(f, 2)) * 22])),
      rot('pecho', ciclo(1.2, (f) => [-6, sen(f) * 10, 0])),
      esc('tronco', ciclo(1.2, (f) => { const k = 1.03 + 0.03 * Math.abs(sen(f, 2)); return [k, 1, k]; })),
      rot('cabeza', ciclo(1.2, (f) => [-12 + sen(f, 4) * 5, sen(f) * 10, 0])),
      rot('pierna_i', ciclo(1.2, () => [0, 0, 6])),
      rot('pierna_d', ciclo(1.2, () => [0, 0, -6])),
      esc('ada', ciclo(1.2, (f) => { const k = 1.2 + 0.25 * sen(f, 4); return [k, k, k]; })),
      esc('ojo_i', ciclo(1.2, () => [1.15, 0.5, 1])),
      esc('ojo_d', ciclo(1.2, () => [1.15, 0.5, 1])),
    ], 'reaccion', 'Saca músculo con los dos brazos, se ríe y rebota: el sol vuelve.'),

    animacion('Derrota', 1.4, [
      // Cae sentado de golpe y se queda con la cabeza gacha.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.3, 0, 0.03, 0], [0.8, 0, -0.62, -0.12], [0.95, 0, -0.55, -0.12], [1.1, 0, -0.6, -0.12], [1.4, 0, -0.6, -0.12]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.8, -80, 0, 10], [1.4, -76, 0, 10]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.8, -80, 0, -10], [1.4, -76, 0, -10]])),
      rot('rodilla_i', poses([[0, 4, 0, 0], [0.8, 40, 0, 0], [1.4, 36, 0, 0]])),
      rot('rodilla_d', poses([[0, 4, 0, 0], [0.8, 40, 0, 0], [1.4, 36, 0, 0]])),
      rot('delantal', poses([[0, 0, 0, 0], [0.8, -70, 0, 0], [1.4, -66, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.3, 8, 0, 0], [0.8, -14, 0, 0], [0.95, -8, 0, 0], [1.4, 10, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 14], [0.8, 10, 0, 30], [1.4, 0, 0, 22]])),
      rot('hombro_d', poses([[0, 0, 0, -14], [0.8, 10, 0, -30], [1.4, 0, 0, -22]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.8, -10, 0, 0], [1.4, 30, 0, 6]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ada', poses([[0, 1, 1, 1], [0.8, 0.7, 0.7, 0.7], [1.4, 0.4, 0.4, 0.4]])),
    ], 'reaccion', 'Cae sentado de golpe, se le hunden los hombros y ADA se apaga en el colgante.', false),

    animacion('Habilidad', 1.15, [
      // Máscara abajo, los dos puños arriba y ¡bum! contra el suelo.
      rot('mascara', poses([[0, -58, 0, 0], [0.14, 0, 0, 0], [0.95, 0, 0, 0], [1.15, -58, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 14], [0.3, -168, 0, 18], [0.44, -52, 0, 12], [0.85, -46, 0, 12], [1.15, 0, 0, 14]])),
      rot('hombro_d', poses([[0, 0, 0, -14], [0.3, -168, 0, -18], [0.44, -52, 0, -12], [0.85, -46, 0, -12], [1.15, 0, 0, -14]])),
      rot('codo_i', poses([[0, -14, 0, 0], [0.3, -30, 0, 0], [0.44, 0, 0, 0], [0.85, -6, 0, 0], [1.15, -14, 0, 0]])),
      rot('codo_d', poses([[0, -14, 0, 0], [0.3, -30, 0, 0], [0.44, 0, 0, 0], [0.85, -6, 0, 0], [1.15, -14, 0, 0]])),
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.3, 0, 0.1, 0], [0.44, 0, -0.34, 0.06], [0.85, 0, -0.3, 0.06], [1.15, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.3, -14, 0, 0], [0.44, 38, 0, 0], [0.85, 32, 0, 0], [1.15, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.3, -18, 0, 0], [0.44, 4, 0, 0], [1.15, 0, 0, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.3, 0, 0, 4], [0.44, -40, 0, 12], [0.85, -36, 0, 12], [1.15, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.3, 0, 0, -4], [0.44, -40, 0, -12], [0.85, -36, 0, -12], [1.15, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 4, 0, 0], [0.44, 62, 0, 0], [0.85, 56, 0, 0], [1.15, 4, 0, 0]])),
      rot('rodilla_d', poses([[0, 4, 0, 0], [0.44, 62, 0, 0], [0.85, 56, 0, 0], [1.15, 4, 0, 0]])),
      rot('delantal', poses([[0, 0, 0, 0], [0.3, 10, 0, 0], [0.44, -30, 0, 0], [0.85, -26, 0, 0], [1.15, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.44, 1, 1, 1], [0.48, 1.12, 0.88, 1.12], [0.64, 1, 1, 1], [1.15, 1, 1, 1]])),
      esc('chispa_i', poses([[0, 0.001, 0.001, 0.001], [0.43, 0.001, 0.001, 0.001], [0.46, 1.3, 1.3, 1.3], [0.66, 0.001, 0.001, 0.001], [1.15, 0.001, 0.001, 0.001]])),
      esc('chispa_d', poses([[0, 0.001, 0.001, 0.001], [0.43, 0.001, 0.001, 0.001], [0.46, 1.3, 1.3, 1.3], [0.66, 0.001, 0.001, 0.001], [1.15, 0.001, 0.001, 0.001]])),
      esc('ada', poses([[0, 1, 1, 1], [0.44, 1, 1, 1], [0.56, 1.6, 1.6, 1.6], [1.15, 1, 1, 1]])),
    ], 'ataque', 'Muro de chatarra: se baja la máscara de soldar, alza los dos puños y golpea el suelo.', false),
  ];

  return { id: 'idris', nombre: 'Idris Okafor', rol: 'Jugador · mecánico de campo, 2,8 m', raiz, animaciones };
}
