import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses,
  rot, toon, toro, type Animacion, type Modelo,
} from './kit.ts';

// Gente de Meta: los supervivientes que salen de los refugios a trabajar
// bajo el velo. Base común de los NPC del mapa: proporciones chibi como el
// astronauta (cabeza grande, cuerpo corto), ropa de abrigo de colores cálidos
// y cara con ojos de pupila oscura, cejas y una boca que se abre al hablar.
// Ni blanco y naranja (es del jugador) ni púrpura (es de HELIOS).
//
// Cada NPC (npc-*.ts) elige colores y sombrero, se viste con su herramienta,
// monta su puesto de trabajo y escribe su clip `Trabajar`; los demás clips
// (saludar, escuchar, hablar, dar, celebrar, asustarse) salen de aquí y son
// iguales para todos, así el juego los trata a todos igual.
//
// Jerarquía: raíz → `giro` → `cuerpo`. Ningún clip toca `giro`: el juego lo
// gira en y para que el NPC mire al jugador mientras su puesto (colgado de la
// raíz) se queda quieto. Mide unos 2,5 m (el astronauta, 2,6).

const TAU = Math.PI * 2;
const BOCA = '#5b2333';
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);

export interface Aspecto {
  id: string;
  nombre: string;
  rol: string;
  piel: string;
  pelo: string;
  abrigo: string;
  /** Cinturón, bajo del abrigo, gorro… el segundo color de la ropa. */
  detalle: string;
  bufanda: string;
  pantalon: string;
  botas: string;
  guantes: string;
  cabeza: 'gorro' | 'capucha' | 'casco' | 'melena';
  gafas?: boolean;
}

/** Los nodos que un NPC puede vestir o animar en su clip de trabajo. */
export interface Cuerpo {
  raiz: THREE.Group;
  cuerpo: THREE.Group;
  pecho: THREE.Group;
  cabeza: THREE.Group;
  manoI: THREE.Group;
  manoD: THREE.Group;
  /** Puesto de trabajo: cuelga de la raíz y no gira con el NPC. */
  puesto: THREE.Group;
}

export interface Trabajo {
  duracion: number;
  pistas: THREE.KeyframeTrack[];
  descripcion: string;
}

/** Posturas de los brazos en reposo (grados): el hombro abre un poco. */
export const BRAZOS = { hombroI: [0, 0, 10], hombroD: [0, 0, -10], codo: [-8, 0, 0] } as const;

/**
 * Monta un NPC: cuerpo, cara y ropa según el aspecto; `vestir` añade
 * herramienta, mochila y puesto; `trabajo` devuelve su clip `Trabajar`.
 */
export function crearGente(
  aspecto: Aspecto,
  vestir: (c: Cuerpo) => void,
  trabajo: (c: Cuerpo) => Trabajo,
): Modelo {
  // A detalle 0,75: se dibujan de uno en uno y de cerca no se nota, pero
  // los ojos de dibujo (tres esferas cada uno) cuestan menos de la mitad.
  return conDetalle(0.75, () => montar(aspecto, vestir, trabajo));
}

function montar(aspecto: Aspecto, vestir: (c: Cuerpo) => void, trabajo: (c: Cuerpo) => Trabajo): Modelo {
  const raiz = new THREE.Group();
  raiz.name = aspecto.id;
  const giro = nodo('giro', raiz);
  const cuerpo = nodo('cuerpo', giro);
  const cadera = nodo('cadera', cuerpo, 0, 0.7, 0);
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);

  // Piernas y botas.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const pierna = nodo(`pierna_${lado}`, cadera, 0.19 * s, -0.02, 0);
    pieza(pierna, capsula(0.14, 0.3), toon(aspecto.pantalon), 0, -0.3, 0);
    pieza(pierna, caja(0.3, 0.2, 0.42, 0.09), toon(aspecto.botas), 0, -0.58, 0.05);
  }

  // Abrigo, cinturón, botones y bufanda.
  const pecho = nodo('pecho', cadera);
  // Abrigo de perfil muy redondeado: se lee como tela, no como metal.
  pieza(pecho, barril(0.4, 0.5, 0.8, 0.18), toon(aspecto.abrigo), 0, 0.36, 0);
  pieza(pecho, toro(0.49, 0.05), toon(aspecto.detalle), 0, -0.02, 0);
  pieza(pecho, toro(0.45, 0.055), toon(aspecto.detalle), 0, 0.3, 0);
  fino(() => {
    for (const y of [0.46, 0.6]) pieza(pecho, esfera(0.04), toon(aspecto.detalle), 0, y, 0.43, { contorno: false });
  });
  pieza(pecho, toro(0.3, 0.11), toon(aspecto.bufanda), 0, 0.78, 0);
  const cola = pieza(pecho, capsula(0.075, 0.28), toon(aspecto.bufanda), 0.16, 0.6, 0.33);
  cola.rotation.set(0.25, 0, 0.15);

  // Cabeza: cara redonda con ojos de dibujo, cejas, nariz y boca.
  const cabeza = nodo('cabeza', pecho, 0, 0.82, 0);
  pieza(cabeza, esfera(0.46), toon(aspecto.piel), 0, 0.42, 0);
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    ojo(cabeza, lado, 0.12, 0.17 * s, 0.46, 0.39, PALETA.negro);
    const ceja = nodo(`ceja_${lado}`, cabeza, 0.17 * s, 0.63, 0.39);
    pieza(ceja, capsula(0.032, 0.1).rotateZ(Math.PI / 2), toon(aspecto.pelo));
  }
  fino(() => pieza(cabeza, esfera(0.065, 1, 0.9, 1), toon(aspecto.piel), 0, 0.36, 0.46));
  // Sonrisa en arco y, debajo, la boca que se abre al hablar (cerrada es una raya).
  const sonrisa = pieza(cabeza, new THREE.TorusGeometry(0.09, 0.022, 6, 14, Math.PI).rotateZ(Math.PI), toon(BOCA), 0, 0.27, 0.43, { contorno: false });
  sonrisa.rotation.x = -0.35;
  const boca = nodo('boca', cabeza, 0, 0.2, 0.41);
  boca.scale.set(1, 0.12, 1);
  pieza(boca, esfera(0.085, 1.25, 0.8, 0.5), toon(BOCA), 0, 0, 0, { contorno: false });
  vestirCabeza(cabeza, aspecto, fino);

  // Brazos con codo y mano (la mano es un nodo: de ahí cuelgan las herramientas).
  const manos: THREE.Group[] = [];
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const hombro = nodo(`hombro_${lado}`, pecho, 0.47 * s, 0.66, 0);
    hombro.rotation.z = THREE.MathUtils.degToRad(10 * s);
    pieza(hombro, capsula(0.12, 0.2), toon(aspecto.abrigo), 0, -0.17, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.36, 0);
    codo.rotation.x = THREE.MathUtils.degToRad(BRAZOS.codo[0]);
    pieza(codo, capsula(0.11, 0.18), toon(aspecto.abrigo), 0, -0.15, 0);
    pieza(codo, toro(0.11, 0.04), toon(aspecto.detalle), 0, -0.27, 0);
    const mano = nodo(`mano_${lado}`, codo, 0, -0.36, 0);
    pieza(mano, esfera(0.13, 1, 1.05, 1), toon(aspecto.guantes));
    manos.push(mano);
  }

  const puesto = nodo('puesto', raiz);
  const c: Cuerpo = { raiz, cuerpo, pecho, cabeza, manoI: manos[0], manoD: manos[1], puesto };
  vestir(c);
  const t = trabajo(c);

  const animaciones: Animacion[] = [
    reposo(raiz),
    animacion('Trabajar', t.duracion, t.pistas, 'movimiento', t.descripcion),
    ...comunes(raiz),
  ];
  return { id: aspecto.id, nombre: aspecto.nombre, rol: aspecto.rol, raiz, animaciones };
}

function vestirCabeza(cabeza: THREE.Group, a: Aspecto, fino: <T>(fn: () => T) => T) {
  if (a.cabeza === 'gorro') {
    pieza(cabeza, esfera(0.48, 1, 0.66, 1), toon(a.detalle), 0, 0.62, -0.02);
    pieza(cabeza, toro(0.45, 0.075), toon(a.detalle), 0, 0.6, 0);
    fino(() => pieza(cabeza, esfera(0.11), toon(a.bufanda), 0, 0.98, -0.04));
  } else if (a.cabeza === 'capucha') {
    pieza(cabeza, esfera(0.54, 1, 1.02, 1), toon(a.abrigo), 0, 0.45, -0.13);
    const ribete = pieza(cabeza, toro(0.43, 0.075).rotateX(Math.PI / 2), toon(PALETA.arena), 0, 0.45, 0.24);
    ribete.scale.set(1, 1.05, 1);
  } else if (a.cabeza === 'casco') {
    pieza(cabeza, esfera(0.5, 1, 0.6, 1.02), toon(a.detalle), 0, 0.62, 0);
    pieza(cabeza, esfera(0.56, 1, 0.12, 1.06), toon(a.detalle), 0, 0.58, 0.04);
    fino(() => {
      pieza(cabeza, capsula(0.07, 0.04).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0.74, 0.47);
      pieza(cabeza, esfera(0.06, 1, 1, 0.5), brillo(PALETA.plasma), 0, 0.74, 0.54, { contorno: false });
    });
  } else {
    pieza(cabeza, esfera(0.5, 1, 0.82, 1.02), toon(a.pelo), 0, 0.58, -0.08);
    pieza(cabeza, esfera(0.3, 1.5, 0.42, 0.7), toon(a.pelo), 0.04, 0.78, 0.22);
    pieza(cabeza, esfera(0.3, 0.85, 1.4, 0.7), toon(a.pelo), 0, 0.2, -0.32);
  }
  if (a.gafas) {
    fino(() => {
      for (const s of [1, -1]) {
        pieza(cabeza, toro(0.1, 0.035).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0.15 * s, 0.75, 0.37);
        pieza(cabeza, esfera(0.085, 1, 1, 0.4), brillo(PALETA.ada), 0.15 * s, 0.75, 0.39, { contorno: false });
      }
    });
  }
}

// ------------------------------------------------------------ animaciones

const brazo = (lado: 'i' | 'd', d: number, fn: (f: number) => readonly [number, number, number]) => rot(`hombro_${lado}`, ciclo(d, fn));

function reposo(raiz: THREE.Object3D): Animacion {
  return animacion('Reposo', 2.4, [
    mov(raiz, 'cadera', ciclo(2.4, (f) => [0, sen(f, 2) * 0.012, 0])),
    rot('pecho', ciclo(2.4, (f) => [sen(f, 2) * 1.5, 0, 0])),
    rot('cabeza', ciclo(2.4, (f) => [sen(f, 2) * 2, sen(f) * 16, sen(f, 2) * 2])),
    brazo('i', 2.4, (f) => [sen(f, 2) * 3, 0, 10 + sen(f, 2) * 2]),
    brazo('d', 2.4, (f) => [-sen(f, 2) * 3, 0, -10 - sen(f, 2) * 2]),
    esc('ojo_i', parpadeo(2.4, 1.7)),
    esc('ojo_d', parpadeo(2.4, 1.7)),
    mov(raiz, 'pupila_i', ciclo(2.4, (f) => [sen(f) * 0.025, 0, 0])),
    mov(raiz, 'pupila_d', ciclo(2.4, (f) => [sen(f) * 0.025, 0, 0])),
  ], 'movimiento', 'Respira, mira a los lados y parpadea.');
}

/** Los clips iguales para todos: los que usa la conversación por voz. */
function comunes(raiz: THREE.Object3D): Animacion[] {
  const cejas = (d: number, fn: (f: number) => [number, number]) => [
    rot('ceja_i', ciclo(d, (f) => [0, 0, fn(f)[1]])), rot('ceja_d', ciclo(d, (f) => [0, 0, -fn(f)[1]])),
    mov(raiz, 'ceja_i', ciclo(d, (f) => [0, fn(f)[0], 0])), mov(raiz, 'ceja_d', ciclo(d, (f) => [0, fn(f)[0], 0])),
  ];
  const boca = (d: number, fn: (f: number) => number) => esc('boca', ciclo(d, (f) => [1, fn(f), 1]));
  return [
    animacion('Saludar', 1.4, [
      rot('hombro_d', poses([[0, 0, 0, -10], [0.25, 0, 0, -150], [1.1, 0, 0, -150], [1.4, 0, 0, -10]])),
      rot('codo_d', poses([[0, -8, 0, 0], [0.25, -10, 0, 30], [0.45, -10, 0, -25], [0.65, -10, 0, 30], [0.85, -10, 0, -25], [1.05, -10, 0, 25], [1.4, -8, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.3, -6, 0, -10], [1.1, -6, 0, -10], [1.4, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.3, -3, 0, 4], [1.1, -3, 0, 4], [1.4, 0, 0, 0]])),
      esc('boca', poses([[0, 1, 0.12, 1], [0.3, 1.2, 0.9, 1], [1.1, 1.2, 0.8, 1], [1.4, 1, 0.12, 1]])),
      mov(raiz, 'ceja_i', poses([[0, 0, 0, 0], [0.3, 0, 0.05, 0], [1.1, 0, 0.05, 0], [1.4, 0, 0, 0]])),
      mov(raiz, 'ceja_d', poses([[0, 0, 0, 0], [0.3, 0, 0.05, 0], [1.1, 0, 0.05, 0], [1.4, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.15, 0, 0.06, 0], [0.3, 0, 0, 0], [1.4, 0, 0, 0]])),
    ], 'reaccion', 'Levanta la mano y saluda sonriendo, con las cejas arriba: cuando el jugador se acerca.', false),

    animacion('Escuchar', 1.6, [
      rot('cabeza', ciclo(1.6, (f) => [6 + Math.max(0, sen(f, 2)) * 8, 0, 10])),
      rot('pecho', ciclo(1.6, (f) => [5 + sen(f, 2) * 1, 0, 2])),
      brazo('d', 1.6, (f) => [-50 + sen(f, 2) * 2, 0, -8]),
      rot('codo_d', ciclo(1.6, () => [-105, 0, -20])),
      brazo('i', 1.6, () => [10, 0, 22]),
      rot('codo_i', ciclo(1.6, () => [-70, 0, 0])),
      ...cejas(1.6, () => [0.03, 8]),
      boca(1.6, () => 0.12),
      esc('ojo_i', parpadeo(1.6, 1.2)),
      esc('ojo_d', parpadeo(1.6, 1.2)),
      mov(raiz, 'pupila_i', ciclo(1.6, () => [0, 0, 0])),
      mov(raiz, 'pupila_d', ciclo(1.6, () => [0, 0, 0])),
    ], 'reaccion', 'Mientras el jugador habla: ladea la cabeza, se lleva la mano a la barbilla y asiente.'),

    animacion('Hablar', 1.2, [
      // La boca se abre y se cierra a ritmo de sílabas (no regular).
      boca(1.2, (f) => 0.12 + 0.88 * Math.max(0, Math.sin(f * TAU * 5) * 0.6 + Math.sin(f * TAU * 3 + 1) * 0.4)),
      rot('cabeza', ciclo(1.2, (f) => [sen(f, 2) * 4, sen(f) * 8, sen(f, 1, 0.25) * 4])),
      rot('pecho', ciclo(1.2, (f) => [2 + sen(f, 2) * 2, sen(f) * 5, 0])),
      brazo('i', 1.2, (f) => [-30 + sen(f, 1) * 18, 0, 20 + sen(f, 2) * 6]),
      brazo('d', 1.2, (f) => [-25 - sen(f, 1, 0.3) * 18, 0, -18 - sen(f, 2, 0.2) * 6]),
      rot('codo_i', ciclo(1.2, (f) => [-60 + sen(f, 2) * 15, 0, 0])),
      rot('codo_d', ciclo(1.2, (f) => [-55 - sen(f, 2, 0.3) * 15, 0, 0])),
      ...cejas(1.2, (f) => [Math.max(0, sen(f, 2)) * 0.035, 0]),
      esc('ojo_i', parpadeo(1.2, 0.9)),
      esc('ojo_d', parpadeo(1.2, 0.9)),
    ], 'reaccion', 'Mientras suena su respuesta: gesticula con las dos manos y mueve la boca a ritmo de sílabas.'),

    animacion('Dar', 1.4, [
      rot('hombro_i', poses([[0, 0, 0, 10], [0.35, -75, 0, 6], [0.95, -75, 0, 6], [1.4, 0, 0, 10]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.35, -75, 0, -6], [0.95, -75, 0, -6], [1.4, 0, 0, -10]])),
      rot('codo_i', poses([[0, -8, 0, 0], [0.35, -20, 0, 0], [0.95, -20, 0, 0], [1.4, -8, 0, 0]])),
      rot('codo_d', poses([[0, -8, 0, 0], [0.35, -20, 0, 0], [0.95, -20, 0, 0], [1.4, -8, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.35, 14, 0, 0], [0.95, 14, 0, 0], [1.4, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.35, -10, 0, 0], [0.95, -10, 0, 6], [1.4, 0, 0, 0]])),
      esc('boca', poses([[0, 1, 0.12, 1], [0.35, 1.25, 0.6, 1], [1.4, 1, 0.12, 1]])),
    ], 'reaccion', 'Se inclina y tiende las dos manos: entrega una recompensa (el juego pone el objeto en 0,35–0,95 s).', false),

    animacion('Celebrar', 1.0, [
      mov(raiz, 'cuerpo', ciclo(1, (f) => [0, Math.abs(sen(f)) * 0.25, 0])),
      esc('cuerpo', ciclo(1, (f) => { const k = Math.abs(sen(f)); return [1 + 0.06 * (1 - k), 1 - 0.06 * (1 - k), 1 + 0.06 * (1 - k)]; })),
      brazo('i', 1, (f) => [0, 0, 150 + sen(f, 2) * 15]),
      brazo('d', 1, (f) => [0, 0, -150 - sen(f, 2) * 15]),
      rot('codo_i', ciclo(1, (f) => [-15 + sen(f, 2) * 15, 0, 0])),
      rot('codo_d', ciclo(1, (f) => [-15 - sen(f, 2) * 15, 0, 0])),
      rot('cabeza', ciclo(1, (f) => [-10, 0, sen(f) * 10])),
      boca(1, () => 1),
      esc('ojo_i', ciclo(1, () => [1.1, 0.45, 1])),
      esc('ojo_d', ciclo(1, () => [1.1, 0.45, 1])),
    ], 'reaccion', 'Salta con los brazos arriba y los ojos entornados de alegría: cuando vuelve el sol o le ayudas.'),

    animacion('Asustarse', 0.8, [
      mov(raiz, 'cadera', ciclo(0.8, (f) => [sen(f, 4) * 0.01, -0.16, 0])),
      rot('pecho', ciclo(0.8, (f) => [22, 0, sen(f, 4) * 3])),
      rot('cabeza', ciclo(0.8, (f) => [10, sen(f, 1) * 20, 0])),
      brazo('i', 0.8, (f) => [-120 + sen(f, 4) * 4, 0, 30]),
      brazo('d', 0.8, (f) => [-120 - sen(f, 4) * 4, 0, -30]),
      rot('codo_i', ciclo(0.8, () => [-95, 0, 0])),
      rot('codo_d', ciclo(0.8, () => [-95, 0, 0])),
      ...(['i', 'd'] as const).map((l) => rot(`pierna_${l}`, ciclo(0.8, () => [-28, 0, 0]))),
      ...(['i', 'd'] as const).map((l) => esc(`ojo_${l}`, ciclo(0.8, () => [1.2, 1.25, 1]))),
      ...cejas(0.8, () => [0.05, -18]),
      boca(0.8, (f) => 0.8 + 0.1 * sen(f, 4)),
    ], 'reaccion', 'Se agacha temblando y se tapa la cabeza, con los ojos muy abiertos: cuando hay enemigos cerca.'),
  ];
}
