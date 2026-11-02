import * as THREE from 'three';
import {
  PALETA, animacion, brillo, capsula, ciclo, curva, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses, punta, rot,
  toon, type Modelo,
} from './kit.ts';

// Caparazón: escarabajo tanque de HELIOS. Una concha enorme de dos mitades
// de chapa con grietas púrpura que brillan (por la raja del lomo se ve el
// núcleo encendido), cristales que asoman de las grietas, una cabeza pequeña
// y cabezota con un ojo de pupila roja bajo una visera, cuernos de chapa y
// dientes, y seis patas cortas. Al morir, la concha se abre como un huevo y
// asoman las cúpulas de los tres Recolectores que lleva dentro (el juego los
// suelta, ver ESPEC.md). Mira hacia +z; mide 1,6 m de alto y 2 de ancho.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);

// Bisagra de cada mitad de la concha: el borde de abajo, a lo largo de z.
const BISAGRA = { x: 0.86, y: 0.42 };
// Cada mitad es una cúpula; entre las dos, por el lomo, asoma el núcleo.
const CUPULA = { x: 0.36, y: 0.72, rx: 0.6, ry: 0.66, rz: 1.08 };

/** Punto de la superficie de la cúpula y su normal, para pegarle placas, grietas y cristales. */
function sobreCupula(x: number, z: number): { y: number; normal: THREE.Vector3 } {
  const dx = (x - CUPULA.x) / CUPULA.rx, dz = z / CUPULA.rz;
  const dy = Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz));
  const normal = new THREE.Vector3(dx / CUPULA.rx, dy / CUPULA.ry, dz / CUPULA.rz).normalize();
  return { y: CUPULA.y + CUPULA.ry * dy, normal };
}

export function crearCaparazon(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'caparazon';
  const cuerpo = nodo('cuerpo', raiz);

  // Vientre oscuro y el núcleo púrpura, ancho y plano por arriba: asoma justo
  // por las rajas de la concha.
  pieza(cuerpo, esfera(0.86, 1, 0.42, 1.12), toon(PALETA.oscuroHelios), 0, 0.42, -0.02);
  const nucleo = nodo('nucleo', cuerpo, 0, 0.77, 0);
  pieza(nucleo, esfera(1, 0.8, 0.52, 1.02), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false });

  const arriba = new THREE.Vector3(0, 1, 0);
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const concha = nodo(`concha_${lado}`, cuerpo, BISAGRA.x * s, BISAGRA.y, 0);
    const local = (x: number, y: number, z: number) => [(x - BISAGRA.x) * s, y - BISAGRA.y, z] as const;
    /** Pega una pieza a la cúpula en (x, z), tumbada sobre la superficie y girada `giro`. */
    const pegar = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, z: number, giro: number, hundir: number, contorno = true) => {
      const { y, normal } = sobreCupula(x, z);
      const m = pieza(concha, geo.rotateY(giro * s), material, ...local(x, y - hundir, z), { contorno });
      m.quaternion.setFromUnitVectors(arriba, new THREE.Vector3(normal.x * s, normal.y, normal.z));
      return m;
    };
    pieza(concha, esfera(1, CUPULA.rx, CUPULA.ry, CUPULA.rz), toon(PALETA.chapaHelios), ...local(CUPULA.x, CUPULA.y, 0));
    // Faldón de blindaje a lo largo del borde y grietas en zigzag que
    // bajan del lomo hasta él.
    pieza(concha, capsula(0.11, 1.2).rotateX(Math.PI / 2), toon(PALETA.metalHelios), ...local(0.9, 0.62, 0));
    const grietas = [
      [[0.3, 0.55], [0.55, 0.68], [0.8, 0.52]],
      [[0.36, -0.02], [0.62, 0.12], [0.9, -0.04]],
      [[0.3, -0.62], [0.58, -0.5], [0.82, -0.66]],
    ] as const;
    for (const tramos of grietas) {
      for (let k = 0; k < tramos.length - 1; k++) {
        const [[x1, z1], [x2, z2]] = [tramos[k], tramos[k + 1]];
        const largo = Math.hypot(x2 - x1, z2 - z1);
        pegar(capsula(0.035, largo).rotateZ(Math.PI / 2), brillo(PALETA.purpuraBrillo), (x1 + x2) / 2, (z1 + z2) / 2,
          Math.atan2(-(z2 - z1), x2 - x1), -0.012, false);
      }
    }
    // Cristales grandes que salen del lomo, inclinados hacia atrás y afuera.
    for (const [x, z, alto] of [[0.1, s > 0 ? 0.42 : 0.05, 0.5], [0.12, s > 0 ? -0.3 : -0.62, 0.42], [0.66, -0.12 * s, 0.26]] as const) {
      const { y } = sobreCupula(x, z);
      const c = pieza(concha, punta(0.12, alto), toon(PALETA.purpura), ...local(x, y + alto * 0.2, z));
      c.rotation.set(-0.5, 0, -0.35 * s);
    }
  }

  // Cabeza: cabezota, asomando bajo el borde de la concha.
  const cabeza = nodo('cabeza', cuerpo, 0, 0.52, 1.0);
  pieza(cabeza, esfera(0.38, 1.18, 0.85, 0.92), toon(PALETA.metalHelios), 0, 0, 0.04);
  // Boca: ranura oscura con dientes.
  pieza(cabeza, capsula(0.075, 0.32).rotateZ(Math.PI / 2), toon(PALETA.oscuroHelios), 0, -0.16, 0.33);
  for (const x of [-0.14, -0.05, 0.05, 0.14]) {
    pieza(cabeza, punta(0.045, 0.1).rotateX(Math.PI), toon(PALETA.diente), x, -0.12, 0.38, { contorno: false });
  }
  // Cuernos de chapa hacia delante y arriba, y una visera en V sobre el ojo.
  for (const s of [1, -1]) {
    const cuerno = pieza(cabeza, punta(0.11, 0.55), toon(PALETA.chapaHelios), 0.27 * s, 0.3, 0.12);
    cuerno.rotation.set(0.7, 0, -0.5 * s);
    const ceja = pieza(cabeza, capsula(0.055, 0.22).rotateZ(Math.PI / 2), toon(PALETA.chapaHelios), 0.13 * s, 0.2, 0.32);
    ceja.rotation.z = 0.45 * s;
  }
  ojo(cabeza, 'c', 0.17, 0, 0.05, 0.31, PALETA.helios);

  // Seis patas cortas en dos trípodes que se alternan al andar.
  for (const [grupo, patas] of [
    ['a', [[1, 0.5], [-1, 0], [1, -0.5]]],
    ['b', [[-1, 0.5], [1, 0], [-1, -0.5]]],
  ] as const) {
    const n = nodo(`patas_${grupo}`, cuerpo);
    for (const [s, z] of patas) {
      const p = pieza(n, capsula(0.075, 0.22), toon(PALETA.metalOscuro), 0.78 * s, 0.2, z);
      p.rotation.z = 0.55 * s;
      pieza(n, esfera(0.11, 1.2, 0.6, 1.3), toon(PALETA.metalOscuro), 0.9 * s, 0.06, z + 0.03);
    }
  }

  // Carga: las cúpulas de tres Recolectores, escondidas hasta que se abre.
  const carga = nodo('carga', cuerpo, 0, 0.52, -0.05);
  for (const [x, z] of [[0, 0.32], [0.3, -0.2], [-0.3, -0.2]] as const) {
    pieza(carga, esfera(0.28, 1, 0.55, 1), toon(PALETA.chapaHelios), x, 0.1, z);
    pieza(carga, punta(0.06, 0.2), toon(PALETA.purpura), x + 0.08, 0.28, z);
    pieza(carga, punta(0.05, 0.15), toon(PALETA.purpura), x - 0.1, 0.25, z + 0.06);
    pieza(carga, esfera(0.045), brillo(PALETA.helios), x - 0.02, 0.3, z - 0.12, { contorno: false });
  }
  carga.scale.setScalar(0.001);

  // Chispas púrpura del golpe, escondidas en reposo.
  const chispas = nodo('chispas', cuerpo, 0, 1.5, 0.1);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    const c = pieza(chispas, punta(0.04, 0.24), brillo(PALETA.purpuraBrillo), Math.sin(a) * 0.18, 0.05, Math.cos(a) * 0.18, { contorno: false, sombra: false });
    c.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
  }
  chispas.scale.setScalar(0.001);

  const conchas = (d: number, fn: (f: number) => number) => [
    rot('concha_i', ciclo(d, (f) => [0, 0, -fn(f)])),
    rot('concha_d', ciclo(d, (f) => [0, 0, fn(f)])),
  ];
  const latido = (d: number, veces: number, fuerza: number) =>
    esc('nucleo', ciclo(d, (f) => { const k = 1 + fuerza * sen(f, veces); return [k, k, k]; }));

  const animaciones = [
    animacion('Reposo', 2.0, [
      mov(raiz, 'cuerpo', ciclo(2, (f) => [0, sen(f) * 0.02, 0])),
      ...conchas(2, (f) => 1.5 + sen(f) * 1.5),
      latido(2, 2, 0.03),
      rot('cabeza', ciclo(2, (f) => [sen(f, 1, 0.25) * 4, sen(f) * 22, sen(f) * -4])),
      mov(raiz, 'pupila_c', ciclo(2, (f) => [sen(f, 1, 0.1) * 0.04, 0, 0])),
      esc('ojo_c', parpadeo(2, 1.4)),
    ], 'movimiento', 'Respira levantando un poco la concha, el núcleo late y mira a los lados.'),

    animacion('Caminar', 1.2, [
      mov(raiz, 'patas_a', ciclo(1.2, (f) => [0, Math.max(0, sen(f)) * 0.1, sen(f, 1, 0.25) * 0.14])),
      mov(raiz, 'patas_b', ciclo(1.2, (f) => [0, Math.max(0, -sen(f)) * 0.1, -sen(f, 1, 0.25) * 0.14])),
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, 0.035 * (1 - Math.cos(f * TAU * 2)) / 2, 0])),
      rot('cuerpo', ciclo(1.2, (f) => [2, sen(f) * 3, sen(f) * 4])),
      ...conchas(1.2, (f) => 1 + Math.abs(sen(f)) * 2),
      latido(1.2, 2, 0.04),
      rot('cabeza', ciclo(1.2, (f) => [4 + sen(f, 2) * 4, -sen(f) * 6, 0])),
    ], 'movimiento', 'Paso pesado en trípode: la concha se balancea y la cabeza cabecea.'),

    animacion('Embestir', 1.2, [
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.38, 0, 0.04, -0.2], [0.5, 0, 0, 0.42], [0.75, 0, 0, 0.36], [1.2, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.38, -8, 0, 0], [0.5, 9, 0, 0], [0.6, 6, 0, 0], [1.2, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.38, 1.06, 0.95, 0.94], [0.48, 0.94, 1.02, 1.12], [0.58, 1.06, 0.94, 0.96], [0.8, 1, 1, 1], [1.2, 1, 1, 1]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.38, -22, 0, 0], [0.5, 28, 0, 0], [0.56, 24, 0, 6], [0.62, 26, 0, -6], [0.75, 22, 0, 0], [1.2, 0, 0, 0]])),
      mov(raiz, 'patas_a', poses([[0, 0, 0, 0], [0.38, 0, 0, 0.12], [0.5, 0, 0, -0.15], [1.2, 0, 0, 0]])),
      mov(raiz, 'patas_b', poses([[0, 0, 0, 0], [0.38, 0, 0, 0.12], [0.5, 0, 0, -0.15], [1.2, 0, 0, 0]])),
      ...conchas(1.2, (f) => curva(f * 1.2, [[0, 1], [0.38, 6], [0.5, 0], [1.2, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.38, 1.08, 1.08, 1.08], [0.5, 1.02, 1.02, 1.02], [1.2, 1, 1, 1]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.38, 1.15, 0.55, 1], [0.6, 1.1, 0.7, 1], [1.2, 1, 1, 1]])),
    ], 'ataque', 'Se echa atrás levantando la cabeza, baja los cuernos y embiste; vuelve a su sitio para la siguiente.'),

    animacion('Golpe recibido', 0.4, [
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.12, 0.85, 1.08], [0.18, 0.96, 1.05, 0.98], [0.4, 1, 1, 1]])),
      mov(raiz, 'cabeza', poses([[0, 0, 0, 0], [0.06, 0, -0.04, -0.16], [0.25, 0, 0, -0.08], [0.4, 0, 0, 0]])),
      ...conchas(0.4, (f) => curva(f * 0.4, [[0, 0], [0.06, 7], [0.16, -2], [0.4, 0]])),
      esc('chispas', poses([[0, 0.001, 0.001, 0.001], [0.05, 1.3, 1.3, 1.3], [0.2, 1.6, 0.4, 1.6], [0.28, 0.001, 0.001, 0.001], [0.4, 0.001, 0.001, 0.001]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.05, 1.08, 1.08, 1.08], [0.4, 1, 1, 1]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.05, 1.2, 0.15, 1], [0.28, 1, 1, 1], [0.4, 1, 1, 1]])),
    ], 'reaccion', 'Se aplasta, mete la cabeza y saltan chispas púrpura de las grietas.', false),

    animacion('Derrota', 1.3, [
      // Tiembla, las grietas se encienden, la concha se abre como un huevo y
      // asoman las cúpulas de los tres Recolectores.
      rot('cuerpo', poses([[0, 0, 0, 0], [0.06, 0, 0, 3], [0.12, 0, 0, -3], [0.18, 0, 0, 3], [0.24, 0, 0, 0], [1.3, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.28, 0, 0.06, 0], [0.5, 0, -0.08, 0], [1.3, 0, -0.08, 0]])),
      rot('concha_i', poses([[0, 0, 0, 0], [0.28, 0, 0, 4], [0.6, 0, 0, -108], [0.72, 0, 0, -96], [0.82, 0, 0, -104], [1.3, 0, 0, -102]])),
      rot('concha_d', poses([[0, 0, 0, 0], [0.28, 0, 0, -4], [0.6, 0, 0, 108], [0.72, 0, 0, 96], [0.82, 0, 0, 104], [1.3, 0, 0, 102]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.28, 1.12, 1.12, 1.12], [0.5, 0.7, 0.3, 0.7], [1.3, 0.62, 0.12, 0.62]])),
      esc('carga', poses([[0, 0.001, 0.001, 0.001], [0.35, 0.001, 0.001, 0.001], [0.55, 1.35, 1.05, 1.35], [0.7, 1.15, 1.3, 1.15], [0.85, 1.25, 1.2, 1.25], [1.3, 1.25, 1.2, 1.25]])),
      mov(raiz, 'carga', poses([[0, 0, 0, 0], [0.35, 0, -0.1, 0], [0.6, 0, 0.5, 0], [0.8, 0, 0.3, 0], [0.9, 0, 0.36, 0], [1.3, 0, 0.32, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.28, -15, 0, 0], [0.7, 16, 0, 18], [1.3, 14, 0, 20]])),
      mov(raiz, 'cabeza', poses([[0, 0, 0, 0], [0.7, 0, -0.2, 0.05], [1.3, 0, -0.2, 0.05]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.28, 1.3, 1.3, 1], [0.5, 1.2, 0.1, 1], [1.3, 1.2, 0.1, 1]])),
      mov(raiz, 'patas_a', poses([[0, 0, 0, 0], [0.6, 0, 0.05, 0], [1.3, 0, 0.04, 0]])),
      mov(raiz, 'patas_b', poses([[0, 0, 0, 0], [0.6, 0, 0.05, 0], [1.3, 0, 0.04, 0]])),
    ], 'reaccion', 'Tiembla, la concha se parte en dos y cae a los lados; dentro asoman los tres Recolectores.', false),
  ];

  return { id: 'caparazon', nombre: 'Caparazón', rol: 'Unidad de HELIOS · tanque', raiz, animaciones };
}
