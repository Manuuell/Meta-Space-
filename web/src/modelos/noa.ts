import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses,
  rot, toon, toro, type Modelo,
} from './kit.ts';
import { halo } from './brillo.ts';

// Noa Herrera, auditora de HELIOS: conoce sus máquinas por dentro. Alta y
// delgada, toda en vertical: abrigo largo de auditora hasta las rodillas,
// blanco con forro magenta, cuello alto y tres faldones que ondean al andar.
// Cara al aire con su pelo rizado recogido en una coleta alta y dos rizos
// sueltos (como en su retrato), el auricular cian, una banda-visor fina en la
// frente y el monóculo de auditoría en el ojo derecho, con su brillo magenta.
// Guantes negros, la credencial de HELIOS tachada en la solapa y tres sellos
// hexagonales que orbitan a la altura de la cintura. ADA flota junto a su
// hombro izquierdo como un orbe pequeño.
//
// Camina recta y elegante. Clip `Habilidad`: alza la mano derecha y los tres
// sellos salen disparados hacia fuera. Mide 3,0 m y mira hacia +z.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);
const BLANCO = '#f4f1f8', MAGENTA = '#e151a5', MAGENTA_OSCURO = '#a8306f', PIEL = '#c98e64', PELO = '#4a2a1c';
const NEGRO = '#1f1d2b', PANTALON = '#2b2c45', VISOR = '#1d1630';
const LADOS = [['i', 1], ['d', -1]] as const;
const SELLOS = ['sello_1', 'sello_2', 'sello_3'] as const;
const RADIO_SELLOS = 0.78;
const anguloSello = (k: number) => (k / SELLOS.length) * TAU;
/** Desplazamiento de un sello cuando la órbita se abre o se cierra a `m` veces su radio. */
const fuera = (k: number, m: number) =>
  [Math.sin(anguloSello(k)) * RADIO_SELLOS * (m - 1), Math.cos(anguloSello(k)) * RADIO_SELLOS * (m - 1)] as const;
const grados = THREE.MathUtils.degToRad;

/** Campana suave que vale 0 fuera de [desde, hasta] y 1 en el centro: gestos dentro de un ciclo. */
const campana = (f: number, desde: number, hasta: number) =>
  f <= desde || f >= hasta ? 0 : Math.sin(((f - desde) / (hasta - desde)) * Math.PI) ** 2;

export function crearNoa(): Modelo {
  return conDetalle(0.5, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'noa';
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, 1.18, 0);
  pieza(cadera, barril(0.28, 0.3, 0.28, 0.1).scale(1, 1, 0.8), toon(BLANCO), 0, 0.02, 0);

  // Piernas largas y finas, botas negras de tacón bajo.
  for (const [lado, s] of LADOS) {
    const pierna = nodo(`pierna_${lado}`, cadera, 0.15 * s, -0.04, 0);
    pieza(pierna, capsula(0.12, 0.38), toon(PANTALON), 0, -0.27, 0);
    const rodilla = nodo(`rodilla_${lado}`, pierna, 0, -0.56, 0);
    rodilla.rotation.x = grados(3);
    pieza(rodilla, capsula(0.11, 0.32), toon(NEGRO), 0, -0.24, 0);
    pieza(rodilla, caja(0.24, 0.16, 0.42, 0.07), toon(NEGRO), 0, -0.51, 0.07);
    pieza(rodilla, caja(0.14, 0.08, 0.12, 0.03), toon(PALETA.oscuro), 0, -0.57, -0.08);
    pieza(rodilla, toro(0.115, 0.02), toon(MAGENTA), 0, -0.4, 0, { contorno: false });
    nodo(`enganche_bota_${lado}`, rodilla, 0, -0.51, 0.05).scale.set(0.72, 0.85, 0.85);
  }

  // Faldones del abrigo: blanco por fuera, magenta por dentro, hasta las rodillas.
  const faldon = (nombre: string, x: number, z: number, ancho: number, giroY: number) => {
    const n = nodo(nombre, cadera, x, 0.1, z);
    n.rotation.y = giroY;
    const largo = 0.92;
    pieza(n, caja(ancho, largo, 0.05, 0.025), toon(BLANCO), 0, -largo / 2, 0);
    pieza(n, caja(ancho * 0.94, largo * 0.96, 0.02, 0.01), toon(MAGENTA), 0, -largo / 2, -0.03, { contorno: false });
    pieza(n, caja(ancho, 0.05, 0.06, 0.02), toon(MAGENTA_OSCURO), 0, -largo + 0.03, 0);
    return n;
  };
  const fi = faldon('faldon_i', 0.17, 0.2, 0.34, 0.35);
  const fd = faldon('faldon_d', -0.17, 0.2, 0.34, -0.35);
  faldon('faldon_atras', 0, -0.2, 0.62, Math.PI);
  // Las solapas abiertas enseñan el forro por el borde de dentro.
  for (const [f, s] of [[fi, 1], [fd, -1]] as const) pieza(f, caja(0.05, 0.9, 0.06, 0.02), toon(MAGENTA), -0.16 * s, -0.46, 0.01, { contorno: false });

  // Tronco: abrigo entallado, cinturón, solapas magenta y la credencial tachada.
  const pecho = nodo('pecho', cadera, 0, 0.12, 0);
  pieza(pecho, barril(0.36, 0.28, 0.86, 0.14).scale(1, 1, 0.74), toon(BLANCO), 0, 0.42, 0);
  pieza(pecho, toro(0.3, 0.035).scale(1, 1, 0.78), toon(MAGENTA_OSCURO), 0, 0.06, 0);
  for (const s of [1, -1]) {
    const solapa = pieza(pecho, caja(0.12, 0.46, 0.03, 0.015), toon(MAGENTA), 0.1 * s, 0.6, 0.255);
    solapa.rotation.z = -0.32 * s;
    solapa.rotation.x = -0.12;
  }
  pieza(pecho, caja(0.11, 0.4, 0.02, 0.01), toon(VISOR), 0, 0.56, 0.24, { contorno: false });
  const credencial = nodo('credencial', pecho, 0.2, 0.62, 0.27);
  credencial.rotation.set(-0.12, 0, 0.12);
  pieza(credencial, caja(0.13, 0.16, 0.02, 0.015), toon('#f8f6ff'));
  pieza(credencial, barril(0.035, 0.035, 0.01, 0.005).rotateX(Math.PI / 2), brillo(PALETA.helios), 0, 0.02, 0.013, { contorno: false });
  pieza(credencial, caja(0.15, 0.022, 0.01, 0.005), toon(NEGRO), 0, 0.01, 0.02, { contorno: false }).rotation.z = 0.7;
  // Cuello alto: blanco por fuera, forro magenta por dentro, abierto delante.
  const abierto = 1.0;
  pieza(pecho, new THREE.CylinderGeometry(0.25, 0.21, 0.34, 18, 1, true, abierto / 2, TAU - abierto), toon(BLANCO), 0, 0.96, -0.01, { contorno: false });
  pieza(pecho, new THREE.CylinderGeometry(0.235, 0.2, 0.32, 18, 1, true, abierto / 2, TAU - abierto),
    new THREE.MeshToonMaterial({ color: MAGENTA, side: THREE.BackSide }), 0, 0.96, -0.01, { contorno: false });
  pieza(pecho, barril(0.1, 0.12, 0.2, 0.04), toon(PIEL), 0, 0.92, 0);

  // ADA, un orbe pequeño que flota junto al hombro izquierdo.
  const ada = nodo('ada', pecho, 0.58, 1.08, -0.12);
  pieza(ada, esfera(0.075), brillo(PALETA.ada), 0, 0, 0, { contorno: false });
  pieza(ada, toro(0.11, 0.012), brillo('#bff6ff'), 0, 0, 0, { contorno: false });
  halo(ada, PALETA.ada, 0.55, 0, 0, 0, 0.6);

  // Cabeza: rizos recogidos en coleta alta, rizos sueltos, auricular,
  // banda-visor en la frente y el monóculo de auditoría.
  const cabeza = nodo('cabeza', pecho, 0, 1.0, 0.02);
  pieza(cabeza, esfera(0.26, 1, 1.1, 0.95), toon(PIEL), 0, 0.3, 0);
  pieza(cabeza, new THREE.SphereGeometry(0.275, 18, 9, 0, TAU, 0, Math.PI * 0.48), toon(PELO), 0, 0.33, -0.025).rotation.x = -0.3;
  const rizos: [number, number, number, number][] = [
    [0.2, 0.45, -0.08, 0.11], [-0.2, 0.45, -0.08, 0.11], [0.12, 0.56, -0.02, 0.1], [-0.12, 0.56, -0.02, 0.1],
    [0, 0.6, -0.1, 0.11], [0.22, 0.3, -0.12, 0.1], [-0.22, 0.3, -0.12, 0.1], [0, 0.38, -0.24, 0.13],
    [0.14, 0.2, -0.2, 0.1], [-0.14, 0.2, -0.2, 0.1], [0.08, 0.6, 0.12, 0.08], [-0.1, 0.58, 0.14, 0.08],
  ];
  for (const [x, y, z, r] of rizos) pieza(cabeza, esfera(r), toon(PELO), x, y, z);
  for (const s of [1, -1]) {
    const rizo = pieza(cabeza, capsula(0.045, 0.16), toon(PELO), 0.25 * s, 0.18, 0.1);
    rizo.rotation.z = 0.15 * s;
  }
  // La coleta alta: tres bolas de rizos encadenadas que se balancean.
  const coleta = nodo('coleta', cabeza, 0, 0.56, -0.18);
  pieza(coleta, toro(0.07, 0.025), toon(MAGENTA), 0, 0, 0, { contorno: false });
  pieza(coleta, esfera(0.15, 1, 1, 1.1), toon(PELO), 0, 0.02, -0.1);
  const coleta2 = nodo('coleta_2', coleta, 0, 0.02, -0.18);
  pieza(coleta2, esfera(0.13), toon(PELO), 0, -0.12, -0.06);
  pieza(coleta2, esfera(0.11), toon(PELO), 0.04, -0.28, -0.04);
  pieza(coleta2, esfera(0.08), toon(PELO), -0.02, -0.4, -0.02);

  for (const [lado, s] of LADOS) {
    ojo(cabeza, lado, 0.056, 0.098 * s, 0.32, 0.215, '#3a2214');
    const ceja = pieza(cabeza, capsula(0.016, 0.07).rotateZ(Math.PI / 2), toon(PELO), 0.1 * s, 0.41, 0.235, { contorno: false });
    ceja.rotation.z = -0.18 * s;
    // Pecas de su retrato.
    for (const [dx, dy] of [[0.13, 0.24], [0.17, 0.26], [0.15, 0.21]]) {
      pieza(cabeza, esfera(0.009), toon('#8f5a3a'), dx * s, dy, 0.215, { contorno: false, sombra: false });
    }
  }
  pieza(cabeza, esfera(0.03, 1, 1, 1.1), toon('#b97a52'), 0, 0.26, 0.255, { contorno: false });
  const sonrisa = pieza(cabeza, new THREE.TorusGeometry(0.05, 0.012, 5, 12, Math.PI).rotateZ(Math.PI), toon('#a3424f'), 0, 0.19, 0.24, { contorno: false });
  sonrisa.rotation.x = -0.3;
  // Banda-visor: arco fino en la frente con su raya magenta.
  pieza(cabeza, new THREE.TorusGeometry(0.268, 0.024, 5, 22, Math.PI).rotateX(Math.PI / 2), toon(VISOR), 0, 0.46, 0, { contorno: false });
  pieza(cabeza, new THREE.TorusGeometry(0.276, 0.007, 4, 22, Math.PI * 0.7).rotateX(Math.PI / 2).rotateY(Math.PI * 0.15), brillo(MAGENTA), 0, 0.46, 0, { contorno: false });
  // Monóculo en el ojo derecho (−x): aro, lente que brilla y cadenita a la oreja.
  const monoculo = nodo('monoculo', cabeza, -0.098, 0.32, 0.255);
  pieza(monoculo, new THREE.TorusGeometry(0.07, 0.014, 6, 18), toon('#e6c770'), 0, 0, 0, { contorno: false });
  pieza(monoculo, barril(0.062, 0.062, 0.008, 0.003).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.35, depthWrite: false }), 0, 0, 0.005, { contorno: false, sombra: false });
  halo(monoculo, MAGENTA, 0.32, 0, 0, 0.02, 0.75);
  barra(cabeza, [-0.16, 0.3, 0.22], [-0.25, 0.26, 0.04], 0.006, toon('#e6c770'), { contorno: false });
  // Auricular cian en la oreja izquierda.
  pieza(cabeza, caja(0.05, 0.12, 0.08, 0.02), toon(NEGRO), 0.265, 0.3, 0.02);
  pieza(cabeza, caja(0.012, 0.06, 0.04, 0.01), brillo(PALETA.ada), 0.292, 0.3, 0.03, { contorno: false });

  // Brazos largos con codo, puño magenta y guantes negros.
  for (const [lado, s] of LADOS) {
    const hombro = nodo(`hombro_${lado}`, pecho, 0.38 * s, 0.78, 0);
    hombro.rotation.z = grados(5 * s);
    pieza(hombro, esfera(0.12), toon(BLANCO));
    pieza(hombro, capsula(0.1, 0.36), toon(BLANCO), 0, -0.26, 0);
    const codo = nodo(`codo_${lado}`, hombro, 0, -0.56, 0);
    codo.rotation.x = grados(-8);
    pieza(codo, capsula(0.09, 0.32), toon(BLANCO), 0, -0.22, 0);
    pieza(codo, toro(0.095, 0.03), toon(MAGENTA), 0, -0.42, 0);
    const mano = nodo(`mano_${lado}`, codo, 0, -0.52, 0);
    pieza(mano, esfera(0.095, 0.85, 1.15, 0.8), toon(NEGRO));
  }

  // Los tres sellos de auditoría: hexágonos que orbitan a la altura de la cintura.
  const sellos = nodo('sellos', cadera, 0, 0.28, 0);
  SELLOS.forEach((nombre, k) => {
    const a = anguloSello(k);
    const n = nodo(nombre, sellos, Math.sin(a) * RADIO_SELLOS, 0, Math.cos(a) * RADIO_SELLOS);
    n.rotation.y = a;
    pieza(n, new THREE.CylinderGeometry(0.15, 0.15, 0.04, 6).rotateX(Math.PI / 2), brillo(MAGENTA), 0, 0, 0, { contorno: false });
    pieza(n, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 6).rotateX(Math.PI / 2), brillo('#ffe3f3'), 0, 0, 0.004, { contorno: false });
    pieza(n, new THREE.CylinderGeometry(0.045, 0.045, 0.06, 6).rotateX(Math.PI / 2), brillo(MAGENTA_OSCURO), 0, 0, 0.008, { contorno: false });
    halo(n, MAGENTA, 0.75, 0, 0, 0, 0.55);
  });

  // La mochila cohete va entre los omóplatos, por encima del abrigo.
  nodo('enganche_mochila', pecho, 0, 0.5, -0.32).scale.setScalar(0.85);

  // ---------------------------------------------------------- animaciones

  // Los sellos giran siempre y cada uno sube y baja a su ritmo.
  const orbita = (d: number, vueltas: number, salto = 0.05, radio = 1) => [
    rot('sellos', ciclo(d, (f) => [0, f * 360 * vueltas, 0])),
    ...SELLOS.map((n, k) => {
      const [x, z] = fuera(k, radio);
      return mov(raiz, n, ciclo(d, (f) => [x, sen(f, 2, k / 3) * salto, z]));
    }),
    ...SELLOS.map((n, k) => rot(n, ciclo(d, (f) => [0, (k / 3) * 360, f * 360]))),
  ];
  const brazos = (d: number, fn: (f: number) => readonly [number, number, number]) => [
    rot('hombro_i', ciclo(d, (f) => fn(f))),
    rot('hombro_d', ciclo(d, (f) => { const [x, y, z] = fn(f + 0.5); return [x, -y, -z]; })),
  ];
  const pasos = (d: number, abre: number, rodilla: number) => [
    rot('pierna_i', ciclo(d, (f) => [sen(f) * abre, 0, 0])),
    rot('pierna_d', ciclo(d, (f) => [-sen(f) * abre, 0, 0])),
    rot('rodilla_i', ciclo(d, (f) => [3 + rodilla * Math.max(0, -cos(f)), 0, 0])),
    rot('rodilla_d', ciclo(d, (f) => [3 + rodilla * Math.max(0, cos(f)), 0, 0])),
  ];
  /** La órbita se abre o se cierra por poses clave [tiempo, veces el radio]. */
  const radioPoses = (claves: readonly (readonly [number, number])[]) => SELLOS.map((n, k) =>
    mov(raiz, n, poses(claves.map(([t, m]) => { const [x, z] = fuera(k, m); return [t, x, 0, z] as const; }))));
  // Faldones: delante se abren con la pierna; detrás, vuelan con la velocidad.
  const faldones = (d: number, vuelo: number, ondea: number) => [
    rot('faldon_i', ciclo(d, (f) => [-Math.max(0, -sen(f)) * ondea * 1.4 + vuelo * 0.3, 20, 0])),
    rot('faldon_d', ciclo(d, (f) => [-Math.max(0, sen(f)) * ondea * 1.4 + vuelo * 0.3, -20, 0])),
    rot('faldon_atras', ciclo(d, (f) => [vuelo + Math.abs(sen(f, 1)) * ondea, 180, sen(f) * 4])),
  ];

  const animaciones = [
    animacion('Reposo', 2.4, [
      // De pie y recta; a mitad de ciclo se ajusta el monóculo.
      mov(raiz, 'cadera', ciclo(2.4, (f) => [sen(f) * 0.02, sen(f, 2) * 0.01, 0])),
      rot('cadera', ciclo(2.4, (f) => [0, 0, sen(f) * 2])),
      rot('pecho', ciclo(2.4, (f) => [sen(f, 2) * 1.5, sen(f) * 3, -sen(f) * 1.5])),
      rot('cabeza', ciclo(2.4, (f) => [sen(f, 2) * 2 - campana(f, 0.3, 0.6) * 6, sen(f) * 10, sen(f) * 5])),
      rot('coleta', ciclo(2.4, (f) => [sen(f, 2) * 5, 0, sen(f) * 6])),
      rot('coleta_2', ciclo(2.4, (f) => [sen(f, 2, 0.15) * 8, 0, sen(f, 1, 0.15) * 8])),
      rot('hombro_i', ciclo(2.4, (f) => [sen(f, 2) * 2, 0, 5 + sen(f) * 1.5])),
      rot('hombro_d', ciclo(2.4, (f) => [-campana(f, 0.28, 0.62) * 118, 0, -5 - campana(f, 0.28, 0.62) * 12])),
      rot('codo_d', ciclo(2.4, (f) => [-8 - campana(f, 0.28, 0.62) * 92, 0, 0])),
      ...faldones(2.4, 0, 2),
      ...orbita(2.4, 1),
      mov(raiz, 'ada', ciclo(2.4, (f) => [0, sen(f, 2) * 0.05, 0])),
      esc('ada', ciclo(2.4, (f) => { const k = 1 + 0.2 * sen(f, 2); return [k, k, k]; })),
      esc('ojo_i', parpadeo(2.4, 1.9)),
      esc('ojo_d', parpadeo(2.4, 1.9)),
    ], 'movimiento', 'Recta y tranquila; se ajusta el monóculo mientras los sellos orbitan y ADA flota a su lado.'),

    animacion('Caminar', 1.1, [
      // Elegante: pasos en línea, tronco quieto y los faldones que barren.
      ...pasos(1.1, 22, 26),
      mov(raiz, 'cadera', ciclo(1.1, (f) => [sen(f) * 0.025, 0.03 * Math.abs(cos(f)) - 0.02, 0])),
      rot('cadera', ciclo(1.1, (f) => [0, -sen(f) * 7, -sen(f) * 2])),
      rot('pecho', ciclo(1.1, (f) => [0, sen(f) * 6, 0])),
      rot('cabeza', ciclo(1.1, (f) => [-2, -sen(f) * 4, 0])),
      rot('coleta', ciclo(1.1, (f) => [sen(f, 2) * 8, 0, sen(f) * 8])),
      rot('coleta_2', ciclo(1.1, (f) => [sen(f, 2, 0.15) * 12, 0, sen(f, 1, 0.15) * 10])),
      ...brazos(1.1, (f) => [-sen(f) * 12, 0, 5]),
      ...faldones(1.1, 4, 12),
      ...orbita(1.1, 1),
    ], 'movimiento', 'Camina recta y elegante, pasos en línea; los faldones barren y los sellos la siguen.'),

    animacion('Correr', 0.7, [
      ...pasos(0.7, 38, 52),
      mov(raiz, 'cadera', ciclo(0.7, (f) => [0, 0.07 * Math.abs(cos(f)) - 0.04, 0])),
      rot('cadera', ciclo(0.7, (f) => [0, -sen(f) * 9, 0])),
      rot('pecho', ciclo(0.7, (f) => [10, sen(f) * 9, 0])),
      rot('cabeza', ciclo(0.7, (f) => [-8, -sen(f) * 6, 0])),
      rot('coleta', ciclo(0.7, (f) => [-30 + sen(f, 2) * 10, 0, sen(f) * 8])),
      rot('coleta_2', ciclo(0.7, (f) => [-20 + sen(f, 2, 0.2) * 14, 0, 0])),
      ...brazos(0.7, (f) => [-sen(f) * 36, 0, 8]),
      rot('codo_i', ciclo(0.7, () => [-48, 0, 0])),
      rot('codo_d', ciclo(0.7, () => [-48, 0, 0])),
      ...faldones(0.7, 30, 14),
      ...orbita(0.7, 1),
    ], 'movimiento', 'Carrera de zancada larga: el abrigo se abre y vuela hacia atrás.'),

    animacion('Esprintar', 0.5, [
      ...pasos(0.5, 54, 66),
      mov(raiz, 'cadera', ciclo(0.5, (f) => [0, 0.1 * Math.abs(cos(f)) - 0.07, 0.05])),
      rot('pecho', ciclo(0.5, (f) => [20, sen(f) * 10, 0])),
      rot('cabeza', ciclo(0.5, () => [-16, 0, 0])),
      rot('coleta', ciclo(0.5, (f) => [-60 + sen(f, 2) * 8, 0, 0])),
      rot('coleta_2', ciclo(0.5, (f) => [-30 + sen(f, 2, 0.2) * 10, 0, 0])),
      ...brazos(0.5, (f) => [-sen(f) * 60 + 6, 0, 10]),
      rot('codo_i', ciclo(0.5, () => [-70, 0, 0])),
      rot('codo_d', ciclo(0.5, () => [-70, 0, 0])),
      ...faldones(0.5, 62, 10),
      ...orbita(0.5, 1, 0.02, 0.75),
      esc('ada', ciclo(0.5, (f) => { const k = 1.2 + 0.2 * sen(f, 2); return [k, k, k]; })),
    ], 'movimiento', 'Sprint: inclinada, el abrigo y la coleta en horizontal y los sellos pegados a ella.'),

    animacion('Saltar', 0.7, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.12, 0, -0.18, 0], [0.3, 0, 0.12, 0], [0.55, 0, 0.04, 0], [0.7, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.12, 1.08, 0.88, 1.08], [0.3, 0.94, 1.1, 0.94], [0.5, 1, 1, 1], [0.7, 1, 1, 1]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.12, -20, 0, 0], [0.32, -40, 0, 0], [0.7, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.12, -20, 0, 0], [0.32, 10, 0, 0], [0.7, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 3, 0, 0], [0.12, 40, 0, 0], [0.32, 70, 0, 0], [0.7, 3, 0, 0]])),
      rot('rodilla_d', poses([[0, 3, 0, 0], [0.12, 40, 0, 0], [0.32, 20, 0, 0], [0.7, 3, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 5], [0.12, 10, 0, 20], [0.3, -20, 0, 70], [0.55, 0, 0, 30], [0.7, 0, 0, 5]])),
      rot('hombro_d', poses([[0, 0, 0, -5], [0.12, 10, 0, -20], [0.3, -20, 0, -70], [0.55, 0, 0, -30], [0.7, 0, 0, -5]])),
      rot('faldon_atras', poses([[0, 0, 180, 0], [0.3, 40, 180, 0], [0.55, -10, 180, 0], [0.7, 0, 180, 0]])),
      rot('coleta', poses([[0, 0, 0, 0], [0.3, 30, 0, 0], [0.55, -20, 0, 0], [0.7, 0, 0, 0]])),
    ], 'movimiento', 'Salta como una bailarina: una pierna recogida, brazos abiertos y el abrigo que se levanta.', false),

    animacion('Surfear', 1.6, [
      mov(raiz, 'cadera', ciclo(1.6, (f) => [sen(f) * 0.03, -0.2 + sen(f, 2) * 0.02, 0])),
      rot('pierna_i', ciclo(1.6, () => [-24, 0, 6])),
      rot('pierna_d', ciclo(1.6, () => [-24, 0, -6])),
      rot('rodilla_i', ciclo(1.6, () => [40, 0, 0])),
      rot('rodilla_d', ciclo(1.6, () => [40, 0, 0])),
      rot('pecho', ciclo(1.6, (f) => [14, sen(f) * 8, sen(f) * 5])),
      rot('cabeza', ciclo(1.6, (f) => [-10, -sen(f) * 8, 0])),
      rot('hombro_i', ciclo(1.6, (f) => [-10, 0, 70 + sen(f) * 8])),
      rot('hombro_d', ciclo(1.6, (f) => [-10, 0, -70 + sen(f) * 8])),
      ...faldones(1.6, 34, 6),
      ...orbita(1.6, 1),
    ], 'movimiento', 'Agachada en la aerotabla, brazos abiertos y el abrigo al viento.'),

    animacion('Volar', 0.8, [
      mov(raiz, 'cadera', ciclo(0.8, (f) => [0, sen(f) * 0.04, 0])),
      rot('pecho', ciclo(0.8, (f) => [18, 0, sen(f) * 3])),
      rot('cabeza', ciclo(0.8, () => [-14, 0, 0])),
      rot('pierna_i', ciclo(0.8, (f) => [20 + sen(f) * 8, 0, 4])),
      rot('pierna_d', ciclo(0.8, (f) => [26 - sen(f) * 8, 0, -4])),
      rot('rodilla_i', ciclo(0.8, () => [24, 0, 0])),
      rot('rodilla_d', ciclo(0.8, () => [24, 0, 0])),
      rot('hombro_i', ciclo(0.8, (f) => [26, 0, 20 + sen(f, 2) * 4])),
      rot('hombro_d', ciclo(0.8, (f) => [26, 0, -20 - sen(f, 2) * 4])),
      ...faldones(0.8, 55, 10),
      rot('coleta', ciclo(0.8, (f) => [-50 + sen(f, 2) * 8, 0, 0])),
      ...orbita(0.8, 1),
    ], 'movimiento', 'Colgada de la mochila cohete, con el abrigo y la coleta flameando.'),

    animacion('Impulso', 0.35, [
      rot('pecho', poses([[0, 0, 0, 0], [0.06, 26, 0, 0], [0.25, 20, 0, 0], [0.35, 8, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.06, -18, 0, 0], [0.35, -6, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 5], [0.06, 50, 0, 18], [0.35, 18, 0, 8]])),
      rot('hombro_d', poses([[0, 0, 0, -5], [0.06, 50, 0, -18], [0.35, 18, 0, -8]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.06, -26, 0, 0], [0.35, -8, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.06, 32, 0, 0], [0.35, 10, 0, 0]])),
      rot('faldon_atras', poses([[0, 0, 180, 0], [0.06, 70, 180, 0], [0.35, 20, 180, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.92, 1.06, 1.1], [0.35, 1, 1, 1]])),
    ], 'movimiento', 'Se lanza hacia delante y el abrigo se queda atrás.', false),

    animacion('Golpe recibido', 0.45, [
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -18, 0, 4], [0.45, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -14, 0, -8], [0.45, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 5], [0.08, -20, 0, 50], [0.45, 0, 0, 5]])),
      rot('hombro_d', poses([[0, 0, 0, -5], [0.08, -20, 0, -50], [0.45, 0, 0, -5]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.06, 0.9, 1.06], [0.2, 0.97, 1.04, 0.97], [0.45, 1, 1, 1]])),
      ...radioPoses([[0, 1], [0.08, 0.6], [0.45, 1]]),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Retrocede del golpe y los sellos se le pegan al cuerpo un instante.', false),

    animacion('Victoria', 1.2, [
      // Un giro completo sobre sí misma con los sellos a toda velocidad.
      rot('cuerpo', ciclo(1.2, (f) => [0, f * 360, 0])),
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, Math.abs(sen(f)) * 0.12, 0])),
      rot('hombro_i', ciclo(1.2, (f) => [0, 0, 120 + sen(f, 2) * 15])),
      rot('hombro_d', ciclo(1.2, (f) => [-150 + sen(f, 2) * 10, 0, -20])),
      rot('cabeza', ciclo(1.2, (f) => [-12, 0, sen(f) * 8])),
      rot('coleta', ciclo(1.2, (f) => [-20, 0, -40 + sen(f, 2) * 10])),
      ...faldones(1.2, 40, 10),
      ...orbita(1.2, 2),
      esc('ada', ciclo(1.2, (f) => { const k = 1.2 + 0.25 * sen(f, 4); return [k, k, k]; })),
    ], 'reaccion', 'Gira sobre sí misma con un brazo en alto; el abrigo vuela y los sellos dan dos vueltas.'),

    animacion('Derrota', 1.4, [
      // Se le doblan las rodillas, cae de lado y los sellos caen al suelo.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.4, 0, -0.1, 0], [0.8, 0, -0.75, 0], [1.4, 0, -0.95, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.4, 0, 0, 0], [0.8, 0, 0, -20], [1.1, 0, 0, -80], [1.25, 0, 0, -74], [1.4, 0, 0, -78]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.8, -60, 0, 0], [1.4, -30, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.8, -40, 0, 0], [1.4, -50, 0, 0]])),
      rot('rodilla_i', poses([[0, 3, 0, 0], [0.8, 110, 0, 0], [1.4, 70, 0, 0]])),
      rot('rodilla_d', poses([[0, 3, 0, 0], [0.8, 110, 0, 0], [1.4, 90, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 5], [0.8, 0, 0, 20], [1.4, 0, 0, 60]])),
      rot('hombro_d', poses([[0, 0, 0, -5], [0.8, -30, 0, -20], [1.4, -20, 0, -40]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.8, 20, 0, 0], [1.4, 10, 0, 20]])),
      mov(raiz, 'sellos', poses([[0, 0, 0, 0], [0.5, 0, 0, 0], [1.0, 0, -0.9, 0], [1.4, 0, -1.0, 0]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.6, 1, 1, 1], [0.8, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ada', poses([[0, 1, 1, 1], [0.8, 0.7, 0.7, 0.7], [1.4, 0.4, 0.4, 0.4]])),
    ], 'reaccion', 'Se le doblan las rodillas, cae de lado y los sellos se apagan en el suelo.', false),

    animacion('Habilidad', 1.0, [
      // Alza la mano derecha y los sellos salen disparados en una onda.
      rot('hombro_d', poses([[0, 0, 0, -5], [0.2, -172, 0, -10], [0.7, -168, 0, -10], [1.0, 0, 0, -5]])),
      rot('codo_d', poses([[0, -8, 0, 0], [0.2, 0, 0, 0], [0.7, 0, 0, 0], [1.0, -8, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 5], [0.25, 20, 0, 28], [0.7, 18, 0, 26], [1.0, 0, 0, 5]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.2, -8, 0, 0], [0.45, -4, 0, 0], [1.0, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.2, -18, 0, 0], [0.7, -14, 0, 0], [1.0, 0, 0, 0]])),
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.2, 0, 0.06, 0], [0.45, 0, -0.04, 0], [1.0, 0, 0, 0]])),
      rot('sellos', poses([[0, 0, 0, 0], [0.2, 0, 120, 0], [0.55, 0, 480, 0], [1.0, 0, 720, 0]])),
      ...radioPoses([[0, 1], [0.2, 0.7], [0.5, 4.2], [0.62, 4.6], [1.0, 1]]),
      mov(raiz, 'sellos', poses([[0, 0, 0, 0], [0.2, 0, 0.5, 0], [0.5, 0, 0.1, 0], [1.0, 0, 0, 0]])),
      ...SELLOS.map((n) => esc(n, poses([[0, 1, 1, 1], [0.2, 1.3, 1.3, 1.3], [0.5, 1.8, 1.8, 1.8], [0.65, 0.6, 0.6, 0.6], [1.0, 1, 1, 1]]))),
      esc('monoculo', poses([[0, 1, 1, 1], [0.18, 1, 1, 1], [0.28, 1.6, 1.6, 1.6], [0.5, 1, 1, 1], [1.0, 1, 1, 1]])),
      ...faldones(1.0, 20, 6),
    ], 'ataque', 'Orden de apagado: alza la mano derecha y los tres sellos salen disparados en una onda magenta.', false),
  ];

  return { id: 'noa', nombre: 'Noa Herrera', rol: 'Jugadora · auditora de HELIOS, 3,0 m', raiz, animaciones };
}
