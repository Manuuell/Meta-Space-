import * as THREE from 'three';
import {
  PALETA, animacion, brillo, caja, capsula, ciclo, esc, esfera, mov, nodo, parpadeo, pieza, poses, rot, toon, toro,
  type Modelo,
} from './kit.ts';

// El especialista de ARES-IX: proporciones chibi (casco enorme), ojos que
// brillan en el visor y ADA latiendo en la mochila. Mira hacia +z; su
// izquierda es +x. Mide 2,6 m, como el sprite al que sustituye.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);

export function crearAstronauta(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'astronauta';
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, 0.85, 0);

  // Tronco: torso, cinturón, panel del pecho y mochila con ADA.
  const pecho = nodo('pecho', cadera);
  pieza(pecho, caja(0.92, 0.72, 0.68, 0.2), toon(PALETA.traje), 0, 0.36, 0);
  pieza(pecho, caja(0.98, 0.14, 0.74, 0.07), toon(PALETA.naranja), 0, 0.04, 0);
  pieza(pecho, caja(0.42, 0.24, 0.06, 0.03), toon(PALETA.metalOscuro), 0, 0.42, 0.34);
  pieza(pecho, esfera(0.045), brillo(PALETA.plasma), -0.1, 0.42, 0.38, { contorno: false });
  pieza(pecho, esfera(0.045), brillo(PALETA.ada), 0.1, 0.42, 0.38, { contorno: false });
  pieza(pecho, caja(0.72, 0.72, 0.34, 0.12), toon(PALETA.metal), 0, 0.42, -0.48);
  pieza(pecho, new THREE.TorusGeometry(0.19, 0.035, 8, 24), toon(PALETA.oscuro), 0, 0.44, -0.66);
  const ada = nodo('ada', pecho, 0, 0.44, -0.66);
  pieza(ada, esfera(0.15), brillo(PALETA.ada), 0, 0, 0, { contorno: false });

  // Cabeza: casco grande, visor oscuro con dos ojos de luz y antena.
  const cabeza = nodo('cabeza', pecho, 0, 0.74, 0);
  pieza(cabeza, esfera(0.6), toon(PALETA.traje), 0, 0.5, 0);
  // Desde detrás (la vista de juego) el casco tiene que leerse como casco:
  // franja naranja de la nuca a la frente y cuello oscuro.
  pieza(cabeza, new THREE.TorusGeometry(0.6, 0.055, 8, 32, Math.PI * 0.62).rotateY(Math.PI / 2), toon(PALETA.naranja), 0, 0.5, 0);
  pieza(cabeza, toro(0.34, 0.07), toon(PALETA.metalOscuro), 0, 0.02, 0);
  // Visor: elipsoide que asoma del casco en una franja ancha, como unas gafas.
  pieza(cabeza, esfera(0.46, 1, 0.78, 0.57), toon('#1d2b4f'), 0, 0.5, 0.36);
  const reflejo = pieza(cabeza, caja(0.16, 0.045, 0.02, 0.02), brillo(PALETA.blanco), 0.24, 0.62, 0.57, { contorno: false });
  reflejo.rotation.z = 0.4;
  for (const [lado, x] of [['i', 0.15], ['d', -0.15]] as const) {
    const o = nodo(`ojo_${lado}`, cabeza, x, 0.48, 0.6);
    pieza(o, capsula(0.055, 0.1), brillo('#9ff8ff'), 0, 0, 0, { contorno: false });
    pieza(cabeza, esfera(0.15, 0.55, 1, 1), toon(PALETA.naranja), x * 4, 0.5, 0);
  }
  // La antena cuelga de su base: se queda atrás al arrancar y rebota al parar.
  const antena = nodo('antena', cabeza, 0.26, 0.96, -0.05);
  const varilla = pieza(antena, capsula(0.025, 0.26), toon(PALETA.metalOscuro), 0.04, 0.12, 0);
  varilla.rotation.z = -0.3;
  pieza(antena, esfera(0.07), brillo(PALETA.plasma), 0.09, 0.28, 0);

  // Brazos y piernas: articulación en el hombro y en la cadera.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const hombro = nodo(`hombro_${lado}`, pecho, 0.56 * s, 0.6, 0);
    hombro.rotation.z = THREE.MathUtils.degToRad(8 * s);
    pieza(hombro, capsula(0.16, 0.34), toon(PALETA.traje), 0, -0.3, 0);
    pieza(hombro, esfera(0.19), toon(PALETA.naranja), 0, -0.6, 0);

    const pierna = nodo(`pierna_${lado}`, cadera, 0.24 * s, -0.02, 0);
    pieza(pierna, capsula(0.18, 0.32), toon(PALETA.traje), 0, -0.36, 0);
    pieza(pierna, caja(0.36, 0.24, 0.5, 0.1), toon(PALETA.oscuro), 0, -0.72, 0.05);
  }

  const brazos = (fn: (f: number) => number, abre = 8, d = 1) => [
    rot('hombro_i', ciclo(d, (f) => [fn(f), 0, abre])),
    rot('hombro_d', ciclo(d, (f) => [-fn(f), 0, -abre])),
  ];

  const animaciones = [
    animacion('Reposo', 2.4, [
      // Respira y pasa el peso de una pierna a otra.
      mov(raiz, 'cadera', ciclo(2.4, (f) => [sen(f) * 0.025, sen(f, 2) * 0.015, 0])),
      rot('cadera', ciclo(2.4, (f) => [0, 0, sen(f) * 2])),
      rot('antena', ciclo(2.4, (f) => [sen(f, 2) * 4, 0, sen(f) * 5])),
      rot('pecho', ciclo(2.4, (f) => [sen(f, 2) * 1.5, 0, 0])),
      rot('cabeza', ciclo(2.4, (f) => [sen(f) * 3, sen(f) * 14, sen(f, 2) * 2])),
      rot('hombro_i', ciclo(2.4, (f) => [sen(f, 2) * 3, 0, 8 + sen(f, 2) * 2])),
      rot('hombro_d', ciclo(2.4, (f) => [-sen(f, 2) * 3, 0, -8 - sen(f, 2) * 2])),
      esc('ada', ciclo(2.4, (f) => { const k = 1 + 0.18 * sen(f, 2); return [k, k, k]; })),
      esc('ojo_i', parpadeo(2.4, 1.6)),
      esc('ojo_d', parpadeo(2.4, 1.6)),
    ], 'movimiento', 'Respira, mira a los lados, parpadea y ADA late en la mochila.'),

    animacion('Caminar', 1.0, [
      rot('pierna_i', ciclo(1, (f) => [sen(f) * 28, 0, 0])),
      rot('pierna_d', ciclo(1, (f) => [-sen(f) * 28, 0, 0])),
      ...brazos((f) => -sen(f) * 24),
      // La cadera baja al apoyar (dos veces por ciclo) y se balancea hacia la pierna de apoyo.
      mov(raiz, 'cadera', ciclo(1, (f) => [sen(f) * 0.03, 0.045 * (1 - Math.cos(f * TAU * 2)) / 2, 0])),
      rot('cadera', ciclo(1, (f) => [0, -sen(f) * 5, -sen(f) * 3])),
      rot('pecho', ciclo(1, (f) => [4, sen(f) * 9, sen(f) * 3])),
      rot('cabeza', ciclo(1, (f) => [-sen(f, 2) * 2, -sen(f) * 6, 0])),
      esc('cuerpo', ciclo(1, (f) => { const k = Math.max(0, Math.cos(f * TAU * 2)) * 0.03; return [1 + k, 1 - k, 1 + k]; })),
      rot('antena', ciclo(1, (f) => [-6 + sen(f, 2) * 8, 0, sen(f) * 6])),
    ], 'movimiento', 'Paso tranquilo: balanceo de cadera y brazos, rebote suave y la antena que acompaña.'),

    animacion('Correr', 0.6, [
      rot('pierna_i', ciclo(0.6, (f) => [sen(f) * 46, 0, 0])),
      rot('pierna_d', ciclo(0.6, (f) => [-sen(f) * 46, 0, 0])),
      ...brazos((f) => -sen(f) * 56, 14, 0.6),
      mov(raiz, 'cadera', ciclo(0.6, (f) => [0, 0.1 * (1 - Math.cos(f * TAU * 2)) / 2, 0])),
      rot('cadera', ciclo(0.6, (f) => [0, -sen(f) * 8, 0])),
      rot('pecho', ciclo(0.6, (f) => [14 + sen(f, 2) * 3, sen(f) * 14, 0])),
      rot('cabeza', ciclo(0.6, (f) => [-8 - sen(f, 2) * 3, -sen(f) * 8, 0])),
      // Aplasta un poco al pisar y se estira en el vuelo.
      esc('cuerpo', ciclo(0.6, (f) => { const k = Math.cos(f * TAU * 2) * 0.04; return [1 + k, 1 - k, 1 + k]; })),
      rot('antena', ciclo(0.6, (f) => [-22 + sen(f, 2) * 12, 0, sen(f) * 8])),
    ], 'movimiento', 'Carrera inclinada: cadera y hombros a contratiempo, rebote fuerte y la antena hacia atrás.'),

    animacion('Esprintar', 0.45, [
      // Sprint con Shift: muy inclinado, zancada larga y brazos que bombean.
      rot('pierna_i', ciclo(0.45, (f) => [sen(f) * 60 - 6, 0, 0])),
      rot('pierna_d', ciclo(0.45, (f) => [-sen(f) * 60 - 6, 0, 0])),
      ...brazos((f) => -sen(f) * 78 + 12, 18, 0.45),
      mov(raiz, 'cadera', ciclo(0.45, (f) => [0, -0.04 + 0.14 * (1 - Math.cos(f * TAU * 2)) / 2, 0.06])),
      rot('cadera', ciclo(0.45, (f) => [0, -sen(f) * 10, 0])),
      rot('pecho', ciclo(0.45, (f) => [28 + sen(f, 2) * 4, sen(f) * 16, 0])),
      rot('cabeza', ciclo(0.45, (f) => [-20, -sen(f) * 9, 0])),
      esc('cuerpo', ciclo(0.45, (f) => { const k = Math.cos(f * TAU * 2) * 0.05; return [1 + k, 1 - k, 1 + k]; })),
      rot('antena', ciclo(0.45, (f) => [-48 + sen(f, 2) * 10, 0, sen(f) * 6])),
      esc('ada', ciclo(0.45, (f) => { const k = 1.15 + 0.2 * sen(f, 2); return [k, k, k]; })),
    ], 'movimiento', 'Sprint: inclinado a tope, zancada larga, brazos que bombean, antena aplastada y ADA a todo brillo.'),

    animacion('Saltar', 0.7, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.12, 0, -0.18, 0], [0.3, 0, 0.12, 0], [0.55, 0, 0.04, 0], [0.7, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.12, 1.12, 0.84, 1.12], [0.3, 0.9, 1.15, 0.9], [0.5, 1, 1, 1], [0.7, 1, 1, 1]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.12, 10, 0, 0], [0.32, -38, 0, 0], [0.7, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.12, 10, 0, 0], [0.32, -30, 0, 0], [0.7, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 8], [0.12, 0, 0, 25], [0.3, 0, 0, 155], [0.55, 0, 0, 60], [0.7, 0, 0, 8]])),
      rot('hombro_d', poses([[0, 0, 0, -8], [0.12, 0, 0, -25], [0.3, 0, 0, -155], [0.55, 0, 0, -60], [0.7, 0, 0, -8]])),
    ], 'movimiento', 'Se agacha, se estira con los brazos arriba y aterriza.', false),

    animacion('Surfear', 1.6, [
      // Agachado sobre la aerotabla, brazos abiertos para equilibrar.
      mov(raiz, 'cadera', ciclo(1.6, (f) => [sen(f) * 0.03, -0.14 + sen(f, 2) * 0.02, 0])),
      rot('pierna_i', ciclo(1.6, () => [-18, 0, 4])),
      rot('pierna_d', ciclo(1.6, () => [-18, 0, -4])),
      rot('pecho', ciclo(1.6, (f) => [16, sen(f) * 8, sen(f) * 6])),
      rot('cabeza', ciclo(1.6, (f) => [-10, -sen(f) * 6, -sen(f) * 4])),
      rot('hombro_i', ciclo(1.6, (f) => [-10, 0, 62 + sen(f) * 10])),
      rot('hombro_d', ciclo(1.6, (f) => [-10, 0, -62 + sen(f) * 10])),
    ], 'movimiento', 'De pie en la aerotabla: agachado, brazos abiertos, se mece con las curvas.'),

    animacion('Volar', 0.8, [
      // Colgando de la mochila cohete: piernas atrás, brazos pegados.
      mov(raiz, 'cadera', ciclo(0.8, (f) => [0, sen(f) * 0.04, 0])),
      rot('pecho', ciclo(0.8, (f) => [20, 0, sen(f) * 3])),
      rot('cabeza', ciclo(0.8, () => [-16, 0, 0])),
      rot('pierna_i', ciclo(0.8, (f) => [22 + sen(f) * 8, 0, 6])),
      rot('pierna_d', ciclo(0.8, (f) => [28 - sen(f) * 8, 0, -6])),
      rot('hombro_i', ciclo(0.8, (f) => [30, 0, 22 + sen(f, 2) * 4])),
      rot('hombro_d', ciclo(0.8, (f) => [30, 0, -22 - sen(f, 2) * 4])),
    ], 'movimiento', 'Suspendido por la mochila cohete, inclinado hacia donde va.'),

    animacion('Impulso', 0.35, [
      // Acelerón de las botas: se lanza hacia delante y vuelve.
      rot('pecho', poses([[0, 0, 0, 0], [0.06, 32, 0, 0], [0.25, 26, 0, 0], [0.35, 10, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.06, -22, 0, 0], [0.35, -6, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 8], [0.06, 55, 0, 20], [0.35, 20, 0, 10]])),
      rot('hombro_d', poses([[0, 0, 0, -8], [0.06, 55, 0, -20], [0.35, 20, 0, -10]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.06, -30, 0, 0], [0.35, -8, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.06, 36, 0, 0], [0.35, 10, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.9, 1.08, 1.12], [0.35, 1, 1, 1]])),
    ], 'movimiento', 'Se lanza hacia delante con las botas de impulso.', false),

    animacion('Golpe recibido', 0.45, [
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -22, 0, 0], [0.45, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -15, 0, 6], [0.45, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 8], [0.08, -20, 0, 60], [0.45, 0, 0, 8]])),
      rot('hombro_d', poses([[0, 0, 0, -8], [0.08, -20, 0, -60], [0.45, 0, 0, -8]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.1, 0.88, 1.1], [0.2, 0.96, 1.05, 0.96], [0.45, 1, 1, 1]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.06, 1.4, 0.25, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.06, 1.4, 0.25, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Retrocede del impacto, aplasta el cuerpo y cierra los ojos.', false),

    animacion('Victoria', 1.2, [
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, Math.abs(sen(f, 2)) * 0.28, 0])),
      rot('hombro_i', ciclo(1.2, (f) => [0, 0, 150 + sen(f, 4) * 20])),
      rot('hombro_d', ciclo(1.2, (f) => [0, 0, -150 + sen(f, 4) * 20])),
      rot('pecho', ciclo(1.2, (f) => [0, sen(f) * 12, 0])),
      rot('cabeza', ciclo(1.2, (f) => [-6, 0, sen(f) * 10])),
      rot('pierna_i', ciclo(1.2, (f) => [-Math.abs(sen(f, 2)) * 20, 0, 0])),
      rot('pierna_d', ciclo(1.2, (f) => [-Math.abs(sen(f, 2)) * 20, 0, 0])),
      esc('ojo_i', ciclo(1.2, () => [1.15, 0.5, 1])),
      esc('ojo_d', ciclo(1.2, () => [1.15, 0.5, 1])),
      esc('ada', ciclo(1.2, (f) => { const k = 1.15 + 0.25 * sen(f, 4); return [k, k, k]; })),
    ], 'reaccion', 'Salta de alegría saludando con los dos brazos: el sol vuelve.'),

    animacion('Derrota', 1.4, [
      rot('cuerpo', poses([[0, 0, 0, 0], [0.25, 8, 0, 4], [0.9, -92, 0, 0], [1.05, -84, 0, 0], [1.2, -90, 0, 0], [1.4, -90, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.25, 0, 0, 0], [0.9, 0, 0.66, 0], [1.4, 0, 0.66, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 8], [0.25, 30, 0, 40], [0.9, 0, 0, 75], [1.4, 0, 0, 70]])),
      rot('hombro_d', poses([[0, 0, 0, -8], [0.25, 30, 0, -40], [0.9, 0, 0, -75], [1.4, 0, 0, -70]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.9, 18, 0, 0], [1.4, 15, 0, 0]])),
      esc('ojo_i', poses([[0, 1, 1, 1], [0.3, 1, 1, 1], [0.5, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ojo_d', poses([[0, 1, 1, 1], [0.3, 1, 1, 1], [0.5, 1.3, 0.15, 1], [1.4, 1.3, 0.15, 1]])),
      esc('ada', poses([[0, 1, 1, 1], [0.9, 0.7, 0.7, 0.7], [1.4, 0.45, 0.45, 0.45]])),
    ], 'reaccion', 'Se tambalea y cae de espaldas sobre la mochila; ADA se apaga.', false),
  ];

  return { id: 'astronauta', nombre: 'Especialista de ARES-IX', rol: 'Jugador · 2,6 m', raiz, animaciones };
}
