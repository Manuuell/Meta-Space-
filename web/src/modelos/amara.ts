import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, cono, esc, esfera, mov, nodo, ojo, parpadeo, pieza,
  poses, punta, rot, toon, toro, type Modelo,
} from './kit.ts';
import { halo } from './brillo.ts';

// Amara Keita, botánica planetaria: la del apoyo. Silueta redonda y baja:
// un poncho de hojas verde salvia hasta las rodillas, con tres filas de hojas
// que se mueven al andar. Lleva un casco-invernadero, una cúpula de cristal
// donde se le ve la cara (trenzas recogidas con anillas doradas, pendientes y
// el pañuelo verde de su retrato) con plantas creciendo dentro, alrededor de
// la cabeza. A la espalda, una jardinera de madera con brotes y flores; una
// regadera colgada de la cadera, guantes de jardinería enormes y botas de
// goma amarillas. ADA brilla dentro de la cúpula, entre las hojas.
//
// Se mece al andar, como un pato contento. Clip `Habilidad`: se agacha, hunde
// las manos en la tierra y le brotan hojas alrededor. Mide 2,5 m y mira
// hacia +z; su izquierda es +x.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);
const SALVIA = '#53cc8c', SALVIA_OSCURO = '#2f9a63', HOJA_CLARA = '#8fe0a6', PANUELO = '#3f7d3a';
const PIEL = '#6b3f26', TRENZAS = '#2e1a12', ORO = '#f0c24a';
const MADERA = '#a8743f', MADERA_OSCURA = '#6d4527', TIERRA = '#4a3426';
const GUANTE = '#e8a33d', GUANTE_OSCURO = '#b97a24', BOTA = '#f2c230', PANTALON = '#3a4a3c', REGADERA = '#5aa9c9';
const LADOS = [['i', 1], ['d', -1]] as const;
const FILAS = ['hojas_1', 'hojas_2', 'hojas_3', 'hojas_4'] as const;
const BROTES = ['brote_1', 'brote_2', 'brote_3'] as const;
const grados = THREE.MathUtils.degToRad;

// El poncho es un tronco de cono: radio arriba, radio abajo, alto y centro (en `pecho`).
const PONCHO = { arriba: 0.5, abajo: 0.9, alto: 1.15, y: 0.25 } as const;
const radioPoncho = (y: number) =>
  PONCHO.abajo + (PONCHO.arriba - PONCHO.abajo) * ((y - (PONCHO.y - PONCHO.alto / 2)) / PONCHO.alto);

export function crearAmara(): Modelo {
  return conDetalle(0.5, montar);
}

/**
 * Hoja en punta con su nervio, mirando hacia +z del padre y colgando hacia
 * −y: el rabito arriba y la punta abajo, para que las filas se solapen como
 * escamas.
 */
function hoja(padre: THREE.Object3D, color: string, largo: number, x: number, y: number, z: number, giro: number, inclina: number, ancho = 0.32) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.order = 'YXZ';
  g.rotation.set(inclina, giro, 0);
  padre.add(g);
  // Hay muchas: pocos lados, y el nervio es una caja sin redondear.
  pieza(g, punta(largo * ancho, largo, 6).rotateZ(Math.PI).scale(1, 1, 0.22), toon(color), 0, -largo * 0.5, 0);
  pieza(g, new THREE.BoxGeometry(0.016, largo * 0.7, 0.01), toon(SALVIA_OSCURO), 0, -largo * 0.42, largo * ancho * 0.24, { contorno: false, sombra: false });
  return g;
}

/** Flor sencilla: cinco pétalos y el centro. */
function flor(padre: THREE.Object3D, color: string, x: number, y: number, z: number, k = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  padre.add(g);
  conDetalle(0.3, () => {
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      pieza(g, esfera(0.045 * k, 1, 0.5, 1), toon(color), Math.cos(a) * 0.05 * k, 0, Math.sin(a) * 0.05 * k, { contorno: false });
    }
    pieza(g, esfera(0.035 * k), toon(ORO), 0, 0.015 * k, 0, { contorno: false });
  });
  return g;
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'amara';
  const cristal = new THREE.MeshPhongMaterial({ color: '#d8fff0', transparent: true, opacity: 0.18, shininess: 140, depthWrite: false });
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, 0.62, 0);

  // Piernas cortas con botas de goma amarillas.
  for (const [lado, s] of LADOS) {
    const pierna = nodo(`pierna_${lado}`, cadera, 0.24 * s, -0.04, 0);
    pieza(pierna, capsula(0.13, 0.1), toon(PANTALON), 0, -0.1, 0);
    const rodilla = nodo(`rodilla_${lado}`, pierna, 0, -0.24, 0);
    pieza(rodilla, barril(0.15, 0.17, 0.28, 0.06), toon(BOTA), 0, -0.12, 0);
    pieza(rodilla, esfera(0.16, 1, 0.62, 1.35), toon(BOTA), 0, -0.24, 0.07);
    pieza(rodilla, caja(0.34, 0.07, 0.5, 0.03), toon(MADERA_OSCURA), 0, -0.31, 0.05);
    pieza(rodilla, toro(0.155, 0.03), toon(GUANTE_OSCURO), 0, 0.01, 0, { contorno: false });
    nodo(`enganche_bota_${lado}`, rodilla, 0, -0.26, 0.04).scale.set(0.86, 0.85, 0.9);
  }

  // El poncho: un cono de tela salvia cubierto de cuatro filas de hojas.
  const pecho = nodo('pecho', cadera, 0, 0.08, 0);
  pieza(pecho, barril(PONCHO.arriba, PONCHO.abajo, PONCHO.alto, 0.2), toon(SALVIA), 0, PONCHO.y, 0);
  const colores = [SALVIA, SALVIA_OSCURO, HOJA_CLARA] as const;
  [[0.8, 10, 0.4], [0.5, 12, 0.44], [0.18, 14, 0.46], [-0.14, 16, 0.48]].forEach(([y, n, largo], fila) => {
    const anillo = nodo(FILAS[fila], pecho, 0, y, 0);
    const r = radioPoncho(y) + 0.02;
    for (let k = 0; k < n; k++) {
      const a = ((k + (fila % 2) * 0.5) / n) * TAU;
      hoja(anillo, colores[(k + fila) % 3], largo, Math.sin(a) * r, 0, Math.cos(a) * r, a, grados(-22), 0.36);
    }
  });
  // Pañuelo verde al cuello, como en su retrato.
  pieza(pecho, toro(0.3, 0.09), toon(PANUELO), 0, 0.86, 0);
  pieza(pecho, esfera(0.13, 1.3, 0.8, 0.6), toon(PANUELO), 0.05, 0.78, 0.3).rotation.z = 0.3;

  // Cabeza: cara del retrato, trenzas recogidas con anillas y pendientes.
  const cabeza = nodo('cabeza', pecho, 0, 0.92, 0.02);
  pieza(cabeza, esfera(0.29, 1, 1.05, 0.95), toon(PIEL), 0, 0.32, 0);
  pieza(cabeza, new THREE.SphereGeometry(0.303, 18, 9, 0, TAU, 0, Math.PI * 0.46), toon(TRENZAS), 0, 0.35, -0.02).rotation.x = -0.32;
  // Moño de trenzas: tres roscas apiladas con anillas doradas.
  const mono = nodo('mono', cabeza, 0, 0.6, -0.08);
  [[0, 0, 0, 0.14], [0.05, 0.07, 0.02, 0.11], [-0.04, 0.12, -0.02, 0.08]].forEach(([x, y, z, r], k) => {
    const rosca = pieza(mono, toro(r, 0.055), toon(TRENZAS), x, y, z);
    rosca.rotation.set(0.25 * (k - 1), k * 0.8, 0.2);
  });
  for (const [x, y, z] of [[0.13, 0.02, 0.04], [-0.1, 0.06, 0.08], [0.02, 0.14, -0.08]]) {
    pieza(mono, toro(0.035, 0.014), toon(ORO), x, y, z, { contorno: false }).rotation.x = 0.9;
  }
  for (const [lado, s] of LADOS) {
    // Rizos sueltos junto a la cara.
    const rizo = pieza(cabeza, capsula(0.035, 0.18), toon(TRENZAS), 0.25 * s, 0.2, 0.1);
    rizo.rotation.z = 0.12 * s;
    pieza(cabeza, toro(0.03, 0.01), toon(ORO), 0.29 * s, 0.22, 0.02, { contorno: false }).rotation.z = Math.PI / 2;
    ojo(cabeza, lado, 0.064, 0.11 * s, 0.34, 0.245, '#2a160c');
    const ceja = pieza(cabeza, capsula(0.017, 0.07).rotateZ(Math.PI / 2), toon(TRENZAS), 0.11 * s, 0.44, 0.26, { contorno: false });
    ceja.rotation.z = -0.2 * s;
  }
  pieza(cabeza, esfera(0.034, 1.2, 1, 1), toon('#5a3420'), 0, 0.28, 0.28, { contorno: false });
  const sonrisa = pieza(cabeza, new THREE.TorusGeometry(0.06, 0.013, 5, 12, Math.PI).rotateZ(Math.PI), toon('#8a3a3a'), 0, 0.2, 0.265, { contorno: false });
  sonrisa.rotation.x = -0.3;

  // El casco-invernadero: collar de metal, plantas dentro y la cúpula.
  pieza(cabeza, toro(0.37, 0.06), toon(PALETA.metal), 0, 0.02, 0);
  const plantas = nodo('plantas_casco', cabeza, 0, 0.04, 0);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + 0.3;
    // Delante, solo hojitas a ras del collar: la cara tiene que verse.
    const delante = Math.cos(a) > 0.3;
    const h = hoja(plantas, colores[k % 3], delante ? 0.1 : 0.24, Math.sin(a) * 0.33, delante ? 0.04 : 0.24, Math.cos(a) * 0.33, a, grados(-150), 0.4);
    h.scale.setScalar(delante ? 0.7 : 1);
  }
  barra(plantas, [-0.16, 0, -0.24], [-0.2, 0.42, -0.26], 0.018, toon(SALVIA_OSCURO), { contorno: false });
  flor(plantas, '#ff8fb8', -0.2, 0.44, -0.26, 1.1);
  const ada = nodo('ada', cabeza, 0.17, 0.58, -0.2);
  pieza(ada, esfera(0.065), brillo(PALETA.ada), 0, 0, 0, { contorno: false });
  halo(ada, PALETA.ada, 0.5, 0, 0, 0, 0.7);
  pieza(cabeza, esfera(0.5, 1, 0.96, 1), cristal, 0, 0.36, 0, { contorno: false, sombra: false });
  const reflejo = pieza(cabeza, new THREE.TorusGeometry(0.47, 0.012, 4, 16, 0.9), brillo('#ffffff'), 0, 0.38, 0.1, { contorno: false, sombra: false });
  reflejo.rotation.set(-0.4, 0.6, 0.9);

  // La jardinera a la espalda: caja de madera con tierra, brotes y flores.
  const jardinera = nodo('jardinera', pecho, 0, 0.62, -0.74);
  pieza(jardinera, caja(0.8, 0.46, 0.36, 0.05), toon(MADERA));
  for (const y of [-0.08, 0.08]) pieza(jardinera, caja(0.82, 0.03, 0.02, 0.01), toon(MADERA_OSCURA), 0, y, -0.185, { contorno: false });
  pieza(jardinera, caja(0.72, 0.06, 0.3, 0.02), toon(TIERRA), 0, 0.22, 0);
  BROTES.forEach((nombre, k) => {
    const x = (k - 1) * 0.24;
    const b = nodo(nombre, jardinera, x, 0.24, (k % 2 ? 0.05 : -0.06));
    barra(b, [0, 0, 0], [0, 0.3 + k * 0.06, 0], 0.02, toon(SALVIA_OSCURO), { contorno: false });
    for (const s of [1, -1]) hoja(b, colores[(k + 1) % 3], 0.16, 0.02 * s, 0.18 + k * 0.04, 0, s * 1.3, grados(-140));
    flor(b, k === 1 ? '#ffe066' : '#ff8fb8', 0, 0.32 + k * 0.06, 0, 1.2);
  });

  // Regadera colgada del costado derecho: se balancea al andar.
  const regadera = nodo('regadera', pecho, -0.78, 0.04, 0.1);
  pieza(regadera, toro(0.06, 0.016), toon(PALETA.metalOscuro), 0, 0.02, 0, { contorno: false });
  pieza(regadera, barril(0.12, 0.14, 0.22, 0.05), toon(REGADERA), 0, -0.18, 0);
  barra(regadera, [0, -0.2, 0.1], [0, -0.06, 0.3], 0.025, toon(REGADERA));
  pieza(regadera, cono(0.06, 0.08).rotateX(-Math.PI / 3), toon(PALETA.metal), 0, -0.04, 0.33);

  nodo('enganche_mochila', pecho, 0, 0.6, -0.96);

  // Brazos que salen del poncho, con guantes de jardinería enormes.
  for (const [lado, s] of LADOS) {
    const hombro = nodo(`hombro_${lado}`, pecho, 0.54 * s, 0.68, 0);
    hombro.rotation.z = grados(30 * s);
    pieza(hombro, capsula(0.11, 0.14), toon(SALVIA_OSCURO), 0, -0.13, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.3, 0);
    codo.rotation.x = grados(-16);
    pieza(codo, capsula(0.1, 0.08), toon(SALVIA_OSCURO), 0, -0.08, 0);
    const mano = nodo(`mano_${lado}`, codo, 0, -0.26, 0.02);
    pieza(mano, barril(0.15, 0.19, 0.12, 0.04), toon(GUANTE_OSCURO), 0, 0.11, 0);
    pieza(mano, esfera(0.2, 1, 1.05, 1.1), toon(GUANTE), 0, -0.04, 0);
    pieza(mano, esfera(0.08, 1, 1.2, 1), toon(GUANTE), 0.15 * s, 0.0, 0.08);
  }

  // Lo que brota alrededor en la habilidad: hojas grandes y flores en corro.
  const brotes = nodo('brotes', raiz, 0, 0.02, 0);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    const h = hoja(brotes, colores[k % 3], 0.6, Math.sin(a) * 1.25, 0, Math.cos(a) * 1.25, a, grados(-162));
    h.scale.setScalar(k % 2 ? 0.8 : 1);
    if (k % 3 === 0) flor(brotes, k % 2 ? '#ffe066' : '#ff8fb8', Math.sin(a + 0.25) * 1.5, 0.08, Math.cos(a + 0.25) * 1.5, 1.6);
  }
  halo(brotes, '#ffe9a0', 3.2, 0, 0.3, 0, 0.35);
  brotes.scale.setScalar(0.001);

  // ---------------------------------------------------------- animaciones

  const pasos = (d: number, abre: number, rodilla: number) => [
    rot('pierna_i', ciclo(d, (f) => [sen(f) * abre, 0, 0])),
    rot('pierna_d', ciclo(d, (f) => [-sen(f) * abre, 0, 0])),
    rot('rodilla_i', ciclo(d, (f) => [rodilla * Math.max(0, -cos(f)), 0, 0])),
    rot('rodilla_d', ciclo(d, (f) => [rodilla * Math.max(0, cos(f)), 0, 0])),
  ];
  const brazos = (d: number, fn: (f: number) => readonly [number, number, number]) => [
    rot('hombro_i', ciclo(d, (f) => fn(f))),
    rot('hombro_d', ciclo(d, (f) => { const [x, y, z] = fn(f + 0.5); return [x, -y, -z]; })),
  ];
  // Las filas de hojas ondean con retraso: de arriba abajo, como una ola.
  const ondaHojas = (d: number, k: number, veces = 2) => FILAS.map((n, fila) =>
    rot(n, ciclo(d, (f) => [sen(f, veces, fila * 0.12) * k * (1 + fila * 0.3), sen(f, 1, fila * 0.1) * k * 1.5, sen(f, veces, 0.25 + fila * 0.12) * k])));
  const jardin = (d: number, k: number, veces = 2) => [
    rot('jardinera', ciclo(d, (f) => [sen(f, veces) * k * 0.4, 0, sen(f) * k * 0.3])),
    ...BROTES.map((n, i) => rot(n, ciclo(d, (f) => [sen(f, veces, i * 0.2) * k, 0, sen(f, 1, i * 0.3) * k * 1.4]))),
    rot('plantas_casco', ciclo(d, (f) => [0, sen(f) * k * 0.8, 0])),
  ];

  const animaciones = [
    animacion('Reposo', 2.6, [
      // Se mece despacio; las hojas, los brotes y ADA respiran con ella.
      mov(raiz, 'cadera', ciclo(2.6, (f) => [sen(f) * 0.03, sen(f, 2) * 0.012, 0])),
      rot('cadera', ciclo(2.6, (f) => [0, 0, sen(f) * 3])),
      rot('pecho', ciclo(2.6, (f) => [sen(f, 2) * 1.5, sen(f) * 3, -sen(f) * 1.5])),
      rot('cabeza', ciclo(2.6, (f) => [sen(f, 2) * 3, sen(f) * 12, sen(f, 1, 0.25) * 8])),
      ...brazos(2.6, (f) => [sen(f, 2) * 4, 0, 30 + sen(f) * 3]),
      ...ondaHojas(2.6, 2),
      ...jardin(2.6, 6),
      rot('regadera', ciclo(2.6, (f) => [sen(f) * 3, 0, sen(f) * 4])),
      esc('ada', ciclo(2.6, (f) => { const k = 1 + 0.25 * sen(f, 2); return [k, k, k]; })),
      esc('ojo_i', parpadeo(2.6, 1.8)),
      esc('ojo_d', parpadeo(2.6, 1.8)),
    ], 'movimiento', 'Se mece despacio y canturrea; las hojas del poncho y los brotes de la jardinera respiran con ella.'),

    animacion('Caminar', 1.2, [
      // Andar de pato contento: balanceo de lado a lado y el poncho que ondea.
      ...pasos(1.2, 20, 30),
      mov(raiz, 'cadera', ciclo(1.2, (f) => [sen(f) * 0.07, -0.04 * (1 - Math.abs(cos(f))), 0])),
      rot('cadera', ciclo(1.2, (f) => [0, -sen(f) * 5, -sen(f) * 7])),
      esc('cuerpo', ciclo(1.2, (f) => { const k = (1 - Math.abs(cos(f))) * 0.03; return [1 + k, 1 - k, 1 + k]; })),
      rot('pecho', ciclo(1.2, (f) => [3, sen(f) * 5, sen(f) * 4])),
      rot('cabeza', ciclo(1.2, (f) => [sen(f, 2) * 3, -sen(f) * 6, -sen(f) * 6])),
      ...brazos(1.2, (f) => [-sen(f) * 18, 0, 30]),
      ...ondaHojas(1.2, 5),
      ...jardin(1.2, 10),
      rot('regadera', ciclo(1.2, (f) => [sen(f) * 22, 0, sen(f, 2) * 8])),
    ], 'movimiento', 'Anda meciéndose de lado a lado como un pato contento; las hojas ondean y la regadera se balancea.'),

    animacion('Correr', 0.7, [
      ...pasos(0.7, 36, 52),
      mov(raiz, 'cadera', ciclo(0.7, (f) => [sen(f) * 0.06, 0.08 * Math.abs(cos(f)) - 0.05, 0])),
      rot('cadera', ciclo(0.7, (f) => [0, -sen(f) * 7, -sen(f) * 6])),
      esc('cuerpo', ciclo(0.7, (f) => { const k = (1 - Math.abs(cos(f))) * 0.05; return [1 + k, 1 - k, 1 + k]; })),
      rot('pecho', ciclo(0.7, (f) => [12, sen(f) * 7, sen(f) * 4])),
      rot('cabeza', ciclo(0.7, (f) => [-8, -sen(f) * 6, 0])),
      ...brazos(0.7, (f) => [-sen(f) * 40, 0, 34]),
      rot('codo_i', ciclo(0.7, () => [-50, 0, 0])),
      rot('codo_d', ciclo(0.7, () => [-50, 0, 0])),
      ...ondaHojas(0.7, 8),
      ...jardin(0.7, 14),
      rot('regadera', ciclo(0.7, (f) => [24 + sen(f) * 20, 0, sen(f, 2) * 10])),
    ], 'movimiento', 'Corre a saltitos redondos, con los guantes bombeando y el poncho de hojas al viento.'),

    animacion('Esprintar', 0.5, [
      ...pasos(0.5, 50, 64),
      mov(raiz, 'cadera', ciclo(0.5, (f) => [0, 0.11 * Math.abs(cos(f)) - 0.08, 0.05])),
      rot('cadera', ciclo(0.5, (f) => [0, -sen(f) * 8, 0])),
      rot('pecho', ciclo(0.5, (f) => [24, sen(f) * 8, 0])),
      rot('cabeza', ciclo(0.5, () => [-18, 0, 0])),
      ...brazos(0.5, (f) => [40 + sen(f) * 10, 0, 40]),
      rot('codo_i', ciclo(0.5, () => [-10, 0, 0])),
      rot('codo_d', ciclo(0.5, () => [-10, 0, 0])),
      ...ondaHojas(0.5, 10, 4),
      ...jardin(0.5, 16, 4),
      rot('regadera', ciclo(0.5, (f) => [60 + sen(f, 2) * 10, 0, 0])),
      esc('ada', ciclo(0.5, (f) => { const k = 1.25 + 0.2 * sen(f, 2); return [k, k, k]; })),
    ], 'movimiento', 'Sprint: inclinada hacia delante, brazos atrás y abiertos y las hojas del poncho levantadas.'),

    animacion('Saltar', 0.7, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.12, 0, -0.16, 0], [0.3, 0, 0.12, 0], [0.55, 0, 0.04, 0], [0.7, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.12, 1.14, 0.84, 1.14], [0.3, 0.92, 1.12, 0.92], [0.5, 1, 1, 1], [0.7, 1, 1, 1]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.12, -20, 0, 0], [0.32, -30, 0, 10], [0.7, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.12, -20, 0, 0], [0.32, -30, 0, -10], [0.7, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 0, 0, 0], [0.12, 40, 0, 0], [0.32, 50, 0, 0], [0.7, 0, 0, 0]])),
      rot('rodilla_d', poses([[0, 0, 0, 0], [0.12, 40, 0, 0], [0.32, 50, 0, 0], [0.7, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 30], [0.12, 0, 0, 40], [0.3, 0, 0, 130], [0.55, 0, 0, 60], [0.7, 0, 0, 30]])),
      rot('hombro_d', poses([[0, 0, 0, -30], [0.12, 0, 0, -40], [0.3, 0, 0, -130], [0.55, 0, 0, -60], [0.7, 0, 0, -30]])),
      ...FILAS.map((n, fila) => rot(n, poses([[0, 0, 0, 0], [0.3, 6 + fila * 4, 0, 0], [0.55, -4 - fila * 3, 0, 0], [0.7, 0, 0, 0]]))),
    ], 'movimiento', 'Salta con los brazos en alto; al caer, las hojas del poncho se levantan como una falda.', false),

    animacion('Surfear', 1.6, [
      mov(raiz, 'cadera', ciclo(1.6, (f) => [sen(f) * 0.04, -0.1 + sen(f, 2) * 0.02, 0])),
      rot('pierna_i', ciclo(1.6, () => [-20, 0, 6])),
      rot('pierna_d', ciclo(1.6, () => [-20, 0, -6])),
      rot('rodilla_i', ciclo(1.6, () => [36, 0, 0])),
      rot('rodilla_d', ciclo(1.6, () => [36, 0, 0])),
      rot('pecho', ciclo(1.6, (f) => [10, sen(f) * 8, sen(f) * 7])),
      rot('cabeza', ciclo(1.6, (f) => [-6, -sen(f) * 8, -sen(f) * 5])),
      rot('hombro_i', ciclo(1.6, (f) => [-10, 0, 75 + sen(f) * 10])),
      rot('hombro_d', ciclo(1.6, (f) => [-10, 0, -75 + sen(f) * 10])),
      ...ondaHojas(1.6, 6),
      ...jardin(1.6, 8),
    ], 'movimiento', 'En la aerotabla con los brazos en cruz y el poncho de hojas al viento.'),

    animacion('Volar', 0.8, [
      mov(raiz, 'cadera', ciclo(0.8, (f) => [0, sen(f) * 0.04, 0])),
      rot('pecho', ciclo(0.8, (f) => [14, 0, sen(f) * 4])),
      rot('cabeza', ciclo(0.8, () => [-10, 0, 0])),
      rot('pierna_i', ciclo(0.8, (f) => [14 + sen(f) * 10, 0, 6])),
      rot('pierna_d', ciclo(0.8, (f) => [20 - sen(f) * 10, 0, -6])),
      rot('hombro_i', ciclo(0.8, (f) => [20, 0, 50 + sen(f, 2) * 10])),
      rot('hombro_d', ciclo(0.8, (f) => [20, 0, -50 - sen(f, 2) * 10])),
      ...ondaHojas(0.8, 10, 4),
      ...jardin(0.8, 12, 4),
    ], 'movimiento', 'Colgada de la mochila cohete; las piernas pataleando y las hojas del poncho temblando.'),

    animacion('Impulso', 0.35, [
      rot('pecho', poses([[0, 0, 0, 0], [0.06, 24, 0, 0], [0.25, 18, 0, 0], [0.35, 6, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.06, -16, 0, 0], [0.35, -4, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 30], [0.06, 50, 0, 40], [0.35, 16, 0, 32]])),
      rot('hombro_d', poses([[0, 0, 0, -30], [0.06, 50, 0, -40], [0.35, 16, 0, -32]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.06, -24, 0, 0], [0.35, -6, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.06, 30, 0, 0], [0.35, 8, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.9, 1.08, 1.12], [0.35, 1, 1, 1]])),
    ], 'movimiento', 'Se lanza hacia delante con las botas de impulso.', false),

    animacion('Golpe recibido', 0.45, [
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -16, 0, 6], [0.45, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -16, 0, 8], [0.45, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 30], [0.08, -20, 0, 70], [0.45, 0, 0, 30]])),
      rot('hombro_d', poses([[0, 0, 0, -30], [0.08, -20, 0, -70], [0.45, 0, 0, -30]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.1, 0.88, 1.1], [0.2, 0.96, 1.05, 0.96], [0.45, 1, 1, 1]])),
      ...FILAS.map((n, fila) => rot(n, poses([[0, 0, 0, 0], [0.08, 8 + fila * 3, 0, 0], [0.25, -4, 0, 0], [0.45, 0, 0, 0]]))),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Encoge el cuerpo redondo, cierra los ojos y las hojas del poncho se erizan.', false),

    animacion('Victoria', 1.2, [
      // Saluda con los dos guantes en alto y las flores de la jardinera se abren.
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [sen(f) * 0.06, Math.abs(sen(f, 2)) * 0.16, 0])),
      rot('cuerpo', ciclo(1.2, (f) => [0, 0, sen(f) * 8])),
      rot('hombro_i', ciclo(1.2, (f) => [0, 0, 150 + sen(f, 4) * 18])),
      rot('hombro_d', ciclo(1.2, (f) => [0, 0, -150 + sen(f, 4) * 18])),
      rot('cabeza', ciclo(1.2, (f) => [-10, 0, -sen(f) * 12])),
      ...ondaHojas(1.2, 8, 4),
      ...BROTES.map((n, i) => esc(n, ciclo(1.2, (f) => { const k = 1.2 + 0.2 * sen(f, 2, i * 0.2); return [k, k, k]; }))),
      rot('jardinera', ciclo(1.2, (f) => [0, 0, sen(f) * 6])),
      esc('ada', ciclo(1.2, (f) => { const k = 1.2 + 0.3 * sen(f, 4); return [k, k, k]; })),
      esc('ojo_i', ciclo(1.2, () => [1.15, 0.5, 1])),
      esc('ojo_d', ciclo(1.2, () => [1.15, 0.5, 1])),
    ], 'reaccion', 'Se mece con los dos guantes en alto y las flores de la jardinera se abren.'),

    animacion('Derrota', 1.4, [
      // Cae sentada hacia atrás y las plantas se mustian.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.3, 0, 0.03, 0], [0.8, 0, -0.38, -0.08], [0.95, 0, -0.32, -0.08], [1.1, 0, -0.36, -0.08], [1.4, 0, -0.36, -0.08]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.8, -80, 0, 10], [1.4, -76, 0, 10]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.8, -80, 0, -10], [1.4, -76, 0, -10]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.3, 8, 0, 0], [0.8, -16, 0, 0], [1.4, 12, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 30], [0.8, 0, 0, 50], [1.4, 0, 0, 34]])),
      rot('hombro_d', poses([[0, 0, 0, -30], [0.8, 0, 0, -50], [1.4, 0, 0, -34]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.8, -10, 0, 0], [1.4, 24, 0, 8]])),
      ...BROTES.map((n, i) => rot(n, poses([[0, 0, 0, 0], [0.6, 0, 0, 0], [1.4, 60 + i * 10, 0, (i - 1) * 30]]))),
      esc('plantas_casco', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [1.4, 1, 0.6, 1]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ada', poses([[0, 1, 1, 1], [0.8, 0.7, 0.7, 0.7], [1.4, 0.4, 0.4, 0.4]])),
    ], 'reaccion', 'Cae sentada hacia atrás, las flores de la jardinera se mustian y ADA se apaga en la cúpula.', false),

    animacion('Habilidad', 1.15, [
      // Se agacha, hunde los guantes en la tierra y le brotan hojas en corro.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.28, 0, -0.26, 0.04], [0.9, 0, -0.24, 0.04], [1.15, 0, 0, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.28, -62, 0, 12], [0.9, -58, 0, 12], [1.15, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.28, -62, 0, -12], [0.9, -58, 0, -12], [1.15, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 0, 0, 0], [0.28, 96, 0, 0], [0.9, 92, 0, 0], [1.15, 0, 0, 0]])),
      rot('rodilla_d', poses([[0, 0, 0, 0], [0.28, 96, 0, 0], [0.9, 92, 0, 0], [1.15, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.28, 20, 0, 0], [0.42, 36, 0, 0], [0.9, 32, 0, 0], [1.15, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.42, -20, 0, 0], [0.9, -16, 0, 0], [1.15, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 30], [0.28, -100, 0, 20], [0.42, -50, 0, 12], [0.9, -48, 0, 12], [1.15, 0, 0, 30]])),
      rot('hombro_d', poses([[0, 0, 0, -30], [0.28, -100, 0, -20], [0.42, -50, 0, -12], [0.9, -48, 0, -12], [1.15, 0, 0, -30]])),
      rot('codo_i', poses([[0, -16, 0, 0], [0.28, -40, 0, 0], [0.42, 0, 0, 0], [1.15, -16, 0, 0]])),
      rot('codo_d', poses([[0, -16, 0, 0], [0.28, -40, 0, 0], [0.42, 0, 0, 0], [1.15, -16, 0, 0]])),
      esc('brotes', poses([[0, 0.001, 0.001, 0.001], [0.4, 0.001, 0.001, 0.001], [0.62, 1.15, 1.25, 1.15], [0.78, 1, 1, 1], [1.0, 1, 1, 1], [1.15, 0.001, 0.001, 0.001]])),
      rot('brotes', poses([[0, 0, 0, 0], [0.4, 0, -30, 0], [1.15, 0, 20, 0]])),
      ...FILAS.map((n, fila) => rot(n, poses([[0, 0, 0, 0], [0.42, 0, 0, 0], [0.6, -10 - fila * 4, 0, 0], [0.9, -6, 0, 0], [1.15, 0, 0, 0]]))),
      esc('plantas_casco', poses([[0, 1, 1, 1], [0.42, 1, 1, 1], [0.62, 1.15, 1.4, 1.15], [1.15, 1, 1, 1]])),
      ...BROTES.map((n) => esc(n, poses([[0, 1, 1, 1], [0.42, 1, 1, 1], [0.62, 1.35, 1.35, 1.35], [1.15, 1, 1, 1]]))),
      esc('ada', poses([[0, 1, 1, 1], [0.42, 1, 1, 1], [0.6, 1.7, 1.7, 1.7], [1.15, 1, 1, 1]])),
    ], 'ataque', 'Jardín de sol: se agacha, hunde los guantes en la tierra y le brotan hojas y flores alrededor.', false),
  ];

  return { id: 'amara', nombre: 'Amara Keita', rol: 'Jugadora · botánica planetaria, 2,5 m', raiz, animaciones };
}
