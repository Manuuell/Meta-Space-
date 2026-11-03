import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses, rot, toon,
  type Clave, type Modelo,
} from './kit.ts';
import { halo } from './brillo.ts';

// Mara Ilyin, ingeniera de sistemas. No baja al sector a pie: baja dentro de
// su exotraje de carga, un mech pequeño de placas violeta y grafito con
// franjas de peligro. Ella va sentada en la cabina de cristal del pecho y se
// le ve la cara (media melena negra y la horquilla cian del retrato). Brazos
// de grúa enormes con codo y pinza de tres dedos, piernas cortas de pistón y,
// a la espalda, la antena parabólica plegada, dos escapes y una torreta en
// miniatura. ADA viaja en una cápsula de cristal sobre el hombro izquierdo.
//
// Se mueve como maquinaria pesada: cada pisada baja el casco y lo hace
// temblar, y las pinzas se abren y cierran solas en reposo. Clip `Habilidad`:
// levanta los brazos, clava los dos puños en el suelo y la antena se
// despliega girando. Mide 2,6 m y mira hacia +z; su izquierda es +x.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);
const VIOLETA = '#7566f5', VIOLETA_OSCURO = '#4f44bd', GRAFITO = '#363a4c', GRAFITO_CLARO = '#5a5f76';
const PELIGRO = '#ffcf3a', PIEL = '#f2c6a4', PELO = '#1c1a33', CHAQUETA = '#ecebff';
const LADOS = [['i', 1], ['d', -1]] as const;
const DEDOS = ['a', 'b', 'c'] as const;
const NOMBRES_DEDO = LADOS.flatMap(([l]) => DEDOS.map((k) => `dedo_${l}_${k}`));
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);
const grados = THREE.MathUtils.degToRad;

/** Banda de peligro: cinta amarilla con barras oscuras inclinadas. Mira hacia +z del grupo. */
function franja(padre: THREE.Object3D, ancho: number, alto: number, x: number, y: number, z: number, giroY = 0, barras = 4) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = giroY;
  padre.add(g);
  pieza(g, caja(ancho, alto, 0.05, 0.02), toon(PELIGRO));
  const paso = ancho / barras;
  for (let k = 0; k < barras; k++) {
    const b = pieza(g, caja(paso * 0.32, alto * 0.95, 0.02, 0.008), toon(GRAFITO), -ancho / 2 + paso * (k + 0.5), 0, 0.028, { contorno: false });
    b.rotation.z = 0.55;
  }
}

export function crearMara(): Modelo {
  // A detalle 0,5: son muchas piezas y, a la distancia de la cámara, no se nota.
  return conDetalle(0.5, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'mara';
  const cristal = new THREE.MeshPhongMaterial({ color: '#c9f3ff', transparent: true, opacity: 0.22, shininess: 120, depthWrite: false });
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, 1.0, 0);
  pieza(cadera, caja(0.95, 0.32, 0.66, 0.1), toon(GRAFITO), 0, 0, 0);
  pieza(cadera, barril(0.2, 0.2, 0.5, 0.06).rotateZ(Math.PI / 2), toon(PALETA.metal), 0, -0.08, 0);

  // Piernas de pistón: muslo violeta, rodilla de rótula, pistón y pie de bloque.
  for (const [lado, s] of LADOS) {
    const pierna = nodo(`pierna_${lado}`, cadera, 0.4 * s, -0.1, 0);
    pieza(pierna, barril(0.21, 0.17, 0.34, 0.08), toon(VIOLETA), 0, -0.16, 0);
    pieza(pierna, esfera(0.14), toon(GRAFITO_CLARO), 0, -0.38, 0);
    const rodilla = nodo(`rodilla_${lado}`, pierna, 0, -0.4, 0);
    rodilla.rotation.x = grados(8);
    pieza(rodilla, barril(0.09, 0.09, 0.3, 0.03), toon(PALETA.metal), 0, -0.18, 0);
    pieza(rodilla, caja(0.32, 0.26, 0.32, 0.08), toon(GRAFITO), 0, -0.07, 0.03);
    pieza(rodilla, caja(0.46, 0.2, 0.64, 0.07), toon(GRAFITO), 0, -0.4, 0.07);
    pieza(rodilla, caja(0.48, 0.07, 0.66, 0.03), toon(PALETA.oscuro), 0, -0.49, 0.07);
    franja(rodilla, 0.4, 0.08, 0, -0.37, 0.4, 0, 3);
    // Las botas de impulso abrazan el pie de bloque: algo más grandes.
    nodo(`enganche_bota_${lado}`, rodilla, 0, -0.42, 0.05).scale.set(1.16, 1, 1.22);
  }

  // Casco del exotraje, en piezas alrededor del hueco de la cabina.
  const pecho = nodo('pecho', cadera, 0, 0.15, 0);
  pieza(pecho, caja(1.5, 1.05, 0.56, 0.16), toon(VIOLETA), 0, 0.58, -0.22);
  pieza(pecho, caja(1.5, 0.38, 0.5, 0.14), toon(VIOLETA), 0, 0.24, 0.25);
  pieza(pecho, caja(1.5, 0.2, 0.5, 0.08), toon(VIOLETA_OSCURO), 0, 1.02, 0.25);
  for (const s of [1, -1]) pieza(pecho, caja(0.38, 0.54, 0.5, 0.12), toon(VIOLETA), 0.56 * s, 0.66, 0.25);
  pieza(pecho, caja(1.56, 0.16, 1.06, 0.06), toon(GRAFITO), 0, 0.04, 0);
  franja(pecho, 1.1, 0.12, 0, 0.18, 0.51, 0, 7);
  // Fondo de la cabina, asiento y luces del salpicadero.
  pieza(pecho, caja(0.76, 0.52, 0.05, 0.02), toon('#45407a'), 0, 0.66, 0.06);
  for (const x of [-0.24, 0, 0.24]) pieza(pecho, caja(0.12, 0.03, 0.03, 0.01), brillo(x ? PALETA.ada : PELIGRO), x, 0.45, 0.5, { contorno: false });

  // Mara en la cabina: chaqueta blanca y violeta, media melena y horquilla.
  pieza(pecho, barril(0.19, 0.27, 0.14, 0.06), toon(CHAQUETA), 0, 0.46, 0.27);
  pieza(pecho, new THREE.TorusGeometry(0.12, 0.035, 8, 20).rotateX(Math.PI / 2), toon(VIOLETA_OSCURO), 0, 0.53, 0.27);
  const cabeza = nodo('cabeza', pecho, 0, 0.6, 0.28);
  pieza(cabeza, esfera(0.18, 1, 1.06, 1), toon(PIEL), 0, 0.1, 0);
  const casquete = pieza(cabeza, new THREE.SphereGeometry(0.205, 20, 10, 0, TAU, 0, Math.PI * 0.56), toon(PELO), 0, 0.12, -0.02);
  casquete.rotation.x = -0.42;
  pieza(cabeza, esfera(0.2, 1.05, 0.95, 0.85), toon(PELO), 0, 0.08, -0.06);
  for (const s of [1, -1]) pieza(cabeza, capsula(0.065, 0.12), toon(PELO), 0.17 * s, 0.03, 0.04);
  const flequillo = pieza(cabeza, esfera(0.11, 1.7, 0.5, 0.55), toon(PELO), 0.04, 0.24, 0.13);
  flequillo.rotation.z = -0.35;
  const horquilla = pieza(cabeza, caja(0.09, 0.028, 0.03, 0.01), brillo(PALETA.ada), -0.13, 0.22, 0.13, { contorno: false });
  horquilla.rotation.z = 0.6;
  for (const [lado, s] of LADOS) {
    ojo(cabeza, lado, 0.048, 0.068 * s, 0.1, 0.16, '#3a2418');
    const ceja = pieza(cabeza, capsula(0.014, 0.05).rotateZ(Math.PI / 2), toon(PELO), 0.07 * s, 0.17, 0.165, { contorno: false });
    ceja.rotation.z = 0.12 * s;
  }
  pieza(cabeza, esfera(0.025), toon('#e3ad8c'), 0, 0.06, 0.18, { contorno: false });
  pieza(cabeza, new THREE.TorusGeometry(0.035, 0.009, 5, 10, Math.PI).rotateZ(Math.PI), toon('#a3484f'), 0, 0.01, 0.17, { contorno: false });
  // La burbuja de cristal, por delante de todo lo de dentro.
  pieza(pecho, esfera(0.42, 1, 0.74, 0.58), cristal, 0, 0.66, 0.44, { contorno: false, sombra: false });
  pieza(pecho, new THREE.TorusGeometry(0.4, 0.05, 8, 28).scale(1, 0.74, 1), toon(GRAFITO), 0, 0.66, 0.5);

  // Espalda: placa trasera, luces, escapes, antena plegada y torreta mini.
  pieza(pecho, caja(1.0, 0.72, 0.12, 0.05), toon(GRAFITO), 0, 0.58, -0.52);
  pieza(pecho, caja(0.7, 0.05, 0.03, 0.01), brillo(PALETA.ada), 0, 0.2, -0.59, { contorno: false });
  for (const s of [1, -1]) {
    pieza(pecho, barril(0.09, 0.11, 0.44, 0.04), toon(PALETA.metal), 0.55 * s, 1.1, -0.38);
    pieza(pecho, barril(0.07, 0.07, 0.06, 0.02), toon(PALETA.oscuro), 0.55 * s, 1.33, -0.38);
  }
  // La antena cuelga de la nuca: plegada, el mástil baja por la espalda y el
  // plato mira hacia atrás; desplegada (en la habilidad), sube y mira al cielo.
  const antena = nodo('antena', pecho, 0, 0.98, -0.62);
  antena.rotation.x = Math.PI;
  const mastil = nodo('mastil', antena);
  pieza(mastil, capsula(0.04, 0.5), toon(GRAFITO_CLARO), 0, 0.28, 0);
  const plato = nodo('plato', mastil, 0, 0.58, 0.05);
  pieza(plato, barril(0.42, 0.08, 0.12, 0.04).rotateX(Math.PI / 2), toon(VIOLETA), 0, 0, 0);
  pieza(plato, barril(0.36, 0.06, 0.04, 0.02).rotateX(Math.PI / 2), toon(CHAQUETA), 0, 0, 0.06, { contorno: false });
  barra(plato, [0, 0, 0.05], [0, 0, 0.32], 0.018, toon(GRAFITO));
  pieza(plato, esfera(0.05), brillo(VIOLETA), 0, 0, 0.34, { contorno: false });

  const torreta = nodo('torreta_mini', pecho, -0.42, 1.12, -0.2);
  pieza(torreta, barril(0.13, 0.16, 0.1, 0.03), toon(GRAFITO_CLARO), 0, 0.04, 0);
  pieza(torreta, caja(0.24, 0.14, 0.26, 0.05), toon(VIOLETA), 0, 0.15, 0);
  barra(torreta, [0, 0.15, 0.1], [0, 0.15, 0.36], 0.035, toon(GRAFITO));
  pieza(torreta, esfera(0.035), brillo(PELIGRO), 0, 0.23, 0.08, { contorno: false });

  // ADA, en su cápsula de cristal sobre el hombro izquierdo.
  pieza(pecho, barril(0.12, 0.15, 0.08, 0.03), toon(GRAFITO), 0.5, 1.15, 0.1);
  pieza(pecho, capsula(0.11, 0.12), cristal, 0.5, 1.33, 0.1, { contorno: false, sombra: false });
  const ada = nodo('ada', pecho, 0.5, 1.32, 0.1);
  pieza(ada, esfera(0.075), brillo(PALETA.ada), 0, 0, 0, { contorno: false });
  halo(ada, PALETA.ada, 0.5, 0, 0, 0, 0.55);

  // La mochila cohete va por encima de la placa trasera.
  nodo('enganche_mochila', pecho, 0, 0.52, -0.66).scale.setScalar(1.12);

  // Brazos de grúa: hombrera con franja, pistón, codo, antebrazo enorme y pinza.
  for (const [lado, s] of LADOS) {
    const hombro = nodo(`hombro_${lado}`, pecho, 0.9 * s, 0.86, 0);
    hombro.rotation.z = grados(6 * s);
    pieza(hombro, esfera(0.22), toon(GRAFITO_CLARO));
    pieza(hombro, caja(0.5, 0.3, 0.64, 0.1), toon(VIOLETA), 0.1 * s, 0.14, 0);
    franja(hombro, 0.44, 0.08, 0.1 * s, 0.14, 0.33, 0, 3);
    barra(hombro, [0, -0.1, 0], [0, -0.56, 0], 0.11, toon(GRAFITO));
    pieza(hombro, barril(0.16, 0.16, 0.2, 0.06), toon(PALETA.metal), 0, -0.34, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.62, 0);
    codo.rotation.x = grados(-12);
    pieza(codo, esfera(0.17), toon(GRAFITO_CLARO));
    pieza(codo, caja(0.44, 0.62, 0.5, 0.14), toon(VIOLETA), 0, -0.34, 0.02);
    pieza(codo, caja(0.46, 0.1, 0.52, 0.04), toon(GRAFITO), 0, -0.62, 0.02);
    pieza(codo, caja(0.05, 0.32, 0.02, 0.01), brillo(PALETA.ada), 0.12 * s, -0.32, 0.28, { contorno: false });
    const pinza = nodo(`pinza_${lado}`, codo, 0, -0.7, 0.02);
    pieza(pinza, barril(0.17, 0.2, 0.14, 0.05), toon(GRAFITO), 0, 0.02, 0);
    // Tres dedos repartidos alrededor de la muñeca; cada uno se abre hacia fuera.
    DEDOS.forEach((k, n) => {
      const base = new THREE.Group();
      base.rotation.y = grados(n * 120 + (s > 0 ? 0 : 60));
      base.position.y = -0.05;
      pinza.add(base);
      const dedo = nodo(`dedo_${lado}_${k}`, base, 0, 0, 0.12);
      dedo.rotation.x = grados(-12);
      barra(dedo, [0, 0, 0], [0, -0.2, 0.04], 0.05, toon(PALETA.metal));
      barra(dedo, [0, -0.2, 0.04], [0, -0.33, -0.03], 0.042, toon(GRAFITO_CLARO));
    });
    // Chispas del puñetazo contra el suelo: solo en la habilidad.
    const chispa = nodo(`chispa_${lado}`, pinza, 0, -0.35, 0);
    pieza(chispa, esfera(0.2, 1.4, 0.5, 1.4), brillo(PELIGRO), 0, 0, 0, { contorno: false, sombra: false });
    halo(chispa, PELIGRO, 1.6, 0, 0, 0, 0.9);
    oculto(chispa);
  }

  // ---------------------------------------------------------- animaciones

  const dedos = (d: number, fn: (f: number, nombre: string) => number) =>
    NOMBRES_DEDO.map((n) => rot(n, ciclo(d, (f) => [fn(f, n), 0, 0])));
  const dedosPose = (claves: readonly (readonly [number, number])[]) =>
    NOMBRES_DEDO.map((n) => rot(n, poses(claves.map(([t, x]) => [t, x, 0, 0] as Clave))));
  const brazos = (d: number, fn: (f: number) => readonly [number, number, number]) => [
    rot('hombro_i', ciclo(d, (f) => { const [x, y, z] = fn(f); return [x, y, z]; })),
    rot('hombro_d', ciclo(d, (f) => { const [x, y, z] = fn(f + 0.5); return [x, -y, -z]; })),
  ];
  const squash = (d: number, k: number, veces = 2) =>
    esc('cuerpo', ciclo(d, (f) => { const a = (1 - Math.abs(cos(f, veces / 2))) * k; return [1 + a, 1 - a, 1 + a]; }));

  const animaciones = [
    animacion('Reposo', 2.4, [
      // Zumbido de la hidráulica, Mara mirando alrededor y las pinzas que chascan.
      mov(raiz, 'cadera', ciclo(2.4, (f) => [0, sen(f, 2) * 0.012, 0])),
      rot('pecho', ciclo(2.4, (f) => [sen(f) * 1.5, sen(f) * 3, 0])),
      rot('cabeza', ciclo(2.4, (f) => [sen(f, 2) * 3, sen(f) * 22, sen(f) * 4])),
      rot('hombro_i', ciclo(2.4, (f) => [sen(f) * 3, 0, 6 + sen(f, 2) * 1.5])),
      rot('hombro_d', ciclo(2.4, (f) => [-sen(f) * 3, 0, -6 - sen(f, 2) * 1.5])),
      rot('codo_i', ciclo(2.4, (f) => [-12 + sen(f, 2) * 4, 0, 0])),
      rot('codo_d', ciclo(2.4, (f) => [-12 - sen(f, 2) * 4, 0, 0])),
      ...dedos(2.4, (f, n) => -12 - 22 * Math.max(0, sen(f, 2, n.startsWith('dedo_d') ? 0.25 : 0)) ** 3),
      rot('torreta_mini', ciclo(2.4, (f) => [0, sen(f) * 40, 0])),
      esc('ada', ciclo(2.4, (f) => { const k = 1 + 0.2 * sen(f, 2); return [k, k, k]; })),
      esc('ojo_i', parpadeo(2.4, 1.7)),
      esc('ojo_d', parpadeo(2.4, 1.7)),
    ], 'movimiento', 'La hidráulica zumba, Mara mira alrededor desde la cabina y las pinzas chascan.'),

    animacion('Caminar', 1.2, [
      // Paso de máquina: el casco cae en cada pisada y tiembla un instante.
      rot('pierna_i', ciclo(1.2, (f) => [sen(f) * 24, 0, 0])),
      rot('pierna_d', ciclo(1.2, (f) => [-sen(f) * 24, 0, 0])),
      rot('rodilla_i', ciclo(1.2, (f) => [8 + 34 * Math.max(0, -cos(f)), 0, 0])),
      rot('rodilla_d', ciclo(1.2, (f) => [8 + 34 * Math.max(0, cos(f)), 0, 0])),
      mov(raiz, 'cadera', ciclo(1.2, (f) => [sen(f) * 0.03, -0.05 * (1 - Math.abs(cos(f))), 0])),
      squash(1.2, 0.03),
      rot('pecho', ciclo(1.2, (f) => [3 + sen(f, 8) * 0.7, sen(f) * 5, -sen(f) * 3])),
      rot('cabeza', ciclo(1.2, (f) => [sen(f, 2) * 3, -sen(f) * 5, 0])),
      ...brazos(1.2, (f) => [-sen(f) * 10, 0, 6]),
      rot('codo_i', ciclo(1.2, () => [-16, 0, 0])),
      rot('codo_d', ciclo(1.2, () => [-16, 0, 0])),
      rot('torreta_mini', ciclo(1.2, (f) => [0, sen(f) * 10, 0])),
    ], 'movimiento', 'Pasos pesados de pistón: el casco baja y tiembla con cada pisada y los brazos de grúa se balancean.'),

    animacion('Correr', 0.75, [
      rot('pierna_i', ciclo(0.75, (f) => [sen(f) * 40, 0, 0])),
      rot('pierna_d', ciclo(0.75, (f) => [-sen(f) * 40, 0, 0])),
      rot('rodilla_i', ciclo(0.75, (f) => [10 + 48 * Math.max(0, -cos(f)), 0, 0])),
      rot('rodilla_d', ciclo(0.75, (f) => [10 + 48 * Math.max(0, cos(f)), 0, 0])),
      mov(raiz, 'cadera', ciclo(0.75, (f) => [0, 0.07 * Math.abs(cos(f)) - 0.05, 0])),
      squash(0.75, 0.045),
      rot('pecho', ciclo(0.75, (f) => [10 + sen(f, 2) * 2, sen(f) * 7, 0])),
      rot('cabeza', ciclo(0.75, (f) => [-6, -sen(f) * 6, 0])),
      ...brazos(0.75, (f) => [-sen(f) * 28, 0, 10]),
      rot('codo_i', ciclo(0.75, () => [-36, 0, 0])),
      rot('codo_d', ciclo(0.75, () => [-36, 0, 0])),
    ], 'movimiento', 'Carrera de mech: zancada corta y potente, el casco rebota y los brazos bombean.'),

    animacion('Esprintar', 0.55, [
      // Carga con los brazos atrás, como un ariete.
      rot('pierna_i', ciclo(0.55, (f) => [sen(f) * 52 - 6, 0, 0])),
      rot('pierna_d', ciclo(0.55, (f) => [-sen(f) * 52 - 6, 0, 0])),
      rot('rodilla_i', ciclo(0.55, (f) => [12 + 58 * Math.max(0, -cos(f)), 0, 0])),
      rot('rodilla_d', ciclo(0.55, (f) => [12 + 58 * Math.max(0, cos(f)), 0, 0])),
      mov(raiz, 'cadera', ciclo(0.55, (f) => [0, 0.1 * Math.abs(cos(f)) - 0.08, 0.06])),
      squash(0.55, 0.05),
      rot('pecho', ciclo(0.55, (f) => [24 + sen(f, 2) * 3, sen(f) * 8, 0])),
      rot('cabeza', ciclo(0.55, () => [-16, 0, 0])),
      ...brazos(0.55, (f) => [38 - sen(f) * 12, 0, 16]),
      rot('codo_i', ciclo(0.55, () => [-22, 0, 0])),
      rot('codo_d', ciclo(0.55, () => [-22, 0, 0])),
      ...dedos(0.55, () => 8),
      esc('ada', ciclo(0.55, (f) => { const k = 1.2 + 0.2 * sen(f, 2); return [k, k, k]; })),
    ], 'movimiento', 'Sprint: inclinada como un ariete, brazos atrás con las pinzas cerradas y ADA a todo brillo.'),

    animacion('Saltar', 0.7, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.12, 0, -0.2, 0], [0.3, 0, 0.1, 0], [0.55, 0, 0.03, 0], [0.7, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.12, 1.1, 0.88, 1.1], [0.3, 0.93, 1.1, 0.93], [0.5, 1, 1, 1], [0.7, 1, 1, 1]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.12, -26, 0, 0], [0.32, 12, 0, 0], [0.7, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.12, -26, 0, 0], [0.32, 6, 0, 0], [0.7, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 8, 0, 0], [0.12, 52, 0, 0], [0.32, 24, 0, 0], [0.7, 8, 0, 0]])),
      rot('rodilla_d', poses([[0, 8, 0, 0], [0.12, 52, 0, 0], [0.32, 30, 0, 0], [0.7, 8, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [0.12, 22, 0, 10], [0.3, -50, 0, 34], [0.55, -12, 0, 14], [0.7, 0, 0, 6]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.12, 22, 0, -10], [0.3, -50, 0, -34], [0.55, -12, 0, -14], [0.7, 0, 0, -6]])),
      ...dedosPose([[0, -12], [0.3, -32], [0.7, -12]]),
    ], 'movimiento', 'Se agacha sobre los pistones, se impulsa con los brazos y cae con todo el peso.', false),

    animacion('Surfear', 1.6, [
      mov(raiz, 'cadera', ciclo(1.6, (f) => [sen(f) * 0.03, -0.16 + sen(f, 2) * 0.02, 0])),
      rot('pierna_i', ciclo(1.6, () => [-22, 0, 4])),
      rot('pierna_d', ciclo(1.6, () => [-22, 0, -4])),
      rot('rodilla_i', ciclo(1.6, () => [42, 0, 0])),
      rot('rodilla_d', ciclo(1.6, () => [42, 0, 0])),
      rot('pecho', ciclo(1.6, (f) => [12, sen(f) * 7, sen(f) * 5])),
      rot('cabeza', ciclo(1.6, (f) => [-6, -sen(f) * 8, 0])),
      rot('hombro_i', ciclo(1.6, (f) => [-12, 0, 52 + sen(f) * 8])),
      rot('hombro_d', ciclo(1.6, (f) => [-12, 0, -52 + sen(f) * 8])),
      rot('codo_i', ciclo(1.6, () => [-26, 0, 0])),
      rot('codo_d', ciclo(1.6, () => [-26, 0, 0])),
    ], 'movimiento', 'Agachada en la aerotabla con los brazos de grúa abiertos de contrapeso.'),

    animacion('Volar', 0.8, [
      mov(raiz, 'cadera', ciclo(0.8, (f) => [0, sen(f) * 0.04, 0])),
      rot('pecho', ciclo(0.8, (f) => [16, 0, sen(f) * 3])),
      rot('pierna_i', ciclo(0.8, (f) => [18 + sen(f) * 6, 0, 5])),
      rot('pierna_d', ciclo(0.8, (f) => [24 - sen(f) * 6, 0, -5])),
      rot('rodilla_i', ciclo(0.8, () => [32, 0, 0])),
      rot('rodilla_d', ciclo(0.8, () => [32, 0, 0])),
      rot('hombro_i', ciclo(0.8, (f) => [-28, 0, 20 + sen(f, 2) * 4])),
      rot('hombro_d', ciclo(0.8, (f) => [-28, 0, -20 - sen(f, 2) * 4])),
      ...dedos(0.8, () => -26),
    ], 'movimiento', 'Colgada de la mochila cohete: piernas atrás y pinzas abiertas hacia delante.'),

    animacion('Impulso', 0.35, [
      rot('pecho', poses([[0, 0, 0, 0], [0.06, 26, 0, 0], [0.25, 20, 0, 0], [0.35, 8, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [0.06, 42, 0, 16], [0.35, 12, 0, 8]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.06, 42, 0, -16], [0.35, 12, 0, -8]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.06, -26, 0, 0], [0.35, -6, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.06, 32, 0, 0], [0.35, 8, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.92, 1.06, 1.1], [0.35, 1, 1, 1]])),
    ], 'movimiento', 'Se lanza hacia delante con las botas de impulso.', false),

    animacion('Golpe recibido', 0.45, [
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -16, 0, 4], [0.45, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -22, 0, 10], [0.45, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [0.08, -26, 0, 30], [0.45, 0, 0, 6]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.08, -26, 0, -30], [0.45, 0, 0, -6]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.08, 0.9, 1.08], [0.2, 0.97, 1.04, 0.97], [0.45, 1, 1, 1]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
      ...dedosPose([[0, -12], [0.08, -40], [0.45, -12]]),
    ], 'reaccion', 'El casco retrocede, Mara se zarandea en la cabina y las pinzas se abren de golpe.', false),

    animacion('Victoria', 1.2, [
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, Math.abs(sen(f, 2)) * 0.16, 0])),
      rot('hombro_i', ciclo(1.2, (f) => [-155 + sen(f, 2) * 10, 0, 24])),
      rot('hombro_d', ciclo(1.2, (f) => [-155 - sen(f, 2) * 10, 0, -24])),
      rot('codo_i', ciclo(1.2, (f) => [-18 + sen(f, 4) * 10, 0, 0])),
      rot('codo_d', ciclo(1.2, (f) => [-18 - sen(f, 4) * 10, 0, 0])),
      ...dedos(1.2, (f) => -30 + 34 * Math.max(0, sen(f, 4))),
      rot('pecho', ciclo(1.2, (f) => [-4, sen(f) * 10, 0])),
      rot('cabeza', ciclo(1.2, (f) => [-10, sen(f) * 14, sen(f, 2) * 8])),
      rot('pierna_i', ciclo(1.2, (f) => [-Math.abs(sen(f, 2)) * 14, 0, 0])),
      rot('pierna_d', ciclo(1.2, (f) => [-Math.abs(sen(f, 2)) * 14, 0, 0])),
      rot('torreta_mini', ciclo(1.2, (f) => [0, f * 360, 0])),
      esc('ada', ciclo(1.2, (f) => { const k = 1.2 + 0.25 * sen(f, 4); return [k, k, k]; })),
    ], 'reaccion', 'Levanta los dos brazos de grúa chascando las pinzas y la torreta da vueltas de alegría.'),

    animacion('Derrota', 1.4, [
      // Se queda sin energía: se le doblan los pistones y cae sentada.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.3, 0, 0.02, 0], [0.9, 0, -0.42, 0], [1.05, 0, -0.36, 0], [1.2, 0, -0.4, 0], [1.4, 0, -0.4, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.9, -56, 0, 6], [1.4, -52, 0, 6]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.9, -56, 0, -6], [1.4, -52, 0, -6]])),
      rot('rodilla_i', poses([[0, 8, 0, 0], [0.9, 98, 0, 0], [1.4, 94, 0, 0]])),
      rot('rodilla_d', poses([[0, 8, 0, 0], [0.9, 98, 0, 0], [1.4, 94, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.3, -6, 0, 0], [0.9, 30, 0, 0], [1.05, 24, 0, 0], [1.2, 28, 0, 0], [1.4, 28, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 6], [0.9, -22, 0, 20], [1.4, -16, 0, 16]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.9, -22, 0, -20], [1.4, -16, 0, -16]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.5, 16, 0, 10], [1.4, 26, 0, 14]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.4, 1, 1, 1], [0.6, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.4, 1, 1, 1], [0.6, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ada', poses([[0, 1, 1, 1], [0.9, 0.7, 0.7, 0.7], [1.4, 0.4, 0.4, 0.4]])),
      ...dedosPose([[0, -12], [0.9, -36], [1.4, -34]]),
    ], 'reaccion', 'El exotraje se queda sin energía: se le doblan los pistones, cae sentado y ADA se apaga.', false),

    animacion('Habilidad', 1.1, [
      // Brazos arriba, puñetazo doble al suelo y la antena que se despliega girando.
      rot('hombro_i', poses([[0, 0, 0, 6], [0.22, -150, 0, 12], [0.4, -58, 0, 10], [0.85, -52, 0, 10], [1.1, 0, 0, 6]])),
      rot('hombro_d', poses([[0, 0, 0, -6], [0.22, -150, 0, -12], [0.4, -58, 0, -10], [0.85, -52, 0, -10], [1.1, 0, 0, -6]])),
      rot('codo_i', poses([[0, -12, 0, 0], [0.22, -34, 0, 0], [0.4, 0, 0, 0], [0.85, -4, 0, 0], [1.1, -12, 0, 0]])),
      rot('codo_d', poses([[0, -12, 0, 0], [0.22, -34, 0, 0], [0.4, 0, 0, 0], [0.85, -4, 0, 0], [1.1, -12, 0, 0]])),
      ...dedosPose([[0, -12], [0.22, -30], [0.36, 14], [0.85, 14], [1.1, -12]]),
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.22, 0, 0.06, 0], [0.4, 0, -0.3, 0], [0.85, 0, -0.26, 0], [1.1, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.22, -10, 0, 0], [0.4, 30, 0, 0], [0.85, 26, 0, 0], [1.1, 0, 0, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.4, -36, 0, 6], [0.85, -32, 0, 6], [1.1, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.4, -36, 0, -6], [0.85, -32, 0, -6], [1.1, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 8, 0, 0], [0.4, 60, 0, 0], [0.85, 54, 0, 0], [1.1, 8, 0, 0]])),
      rot('rodilla_d', poses([[0, 8, 0, 0], [0.4, 60, 0, 0], [0.85, 54, 0, 0], [1.1, 8, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.4, 1, 1, 1], [0.44, 1.1, 0.9, 1.1], [0.6, 1, 1, 1], [1.1, 1, 1, 1]])),
      esc('chispa_i', poses([[0, 0.001, 0.001, 0.001], [0.39, 0.001, 0.001, 0.001], [0.42, 1.2, 1.2, 1.2], [0.62, 0.001, 0.001, 0.001], [1.1, 0.001, 0.001, 0.001]])),
      esc('chispa_d', poses([[0, 0.001, 0.001, 0.001], [0.39, 0.001, 0.001, 0.001], [0.42, 1.2, 1.2, 1.2], [0.62, 0.001, 0.001, 0.001], [1.1, 0.001, 0.001, 0.001]])),
      rot('antena', poses([[0, 180, 0, 0], [0.42, 180, 0, 0], [0.7, -28, 0, 0], [0.78, -16, 0, 0], [0.95, -22, 0, 0], [1.1, 180, 0, 0]])),
      esc('mastil', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1, 1.5, 1], [0.95, 1, 1.5, 1], [1.1, 1, 1, 1]])),
      rot('plato', poses([[0, 0, 0, 0], [0.7, 0, 0, 0], [1.0, 0, 0, 340], [1.1, 0, 0, 360]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.22, -12, 0, 0], [0.42, 14, 0, 0], [1.1, 0, 0, 0]])),
      esc('ada', poses([[0, 1, 1, 1], [0.42, 1, 1, 1], [0.6, 1.6, 1.6, 1.6], [1.1, 1, 1, 1]])),
    ], 'ataque', 'Sobrecarga de red: levanta los brazos, clava los dos puños en el suelo y despliega la antena girando.', false),
  ];

  return { id: 'mara', nombre: 'Mara Ilyin', rol: 'Jugadora · exotraje de carga, 2,6 m', raiz, animaciones };
}
