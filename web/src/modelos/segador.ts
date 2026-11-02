import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, ciclo, esc, esfera, mov, nodo, pieza, poses, punta, rot, toon, toro,
  type Modelo,
} from './kit.ts';

// Segador: una cosechadora de HELIOS, enorme y lenta. Chasis de chapa sobre
// cuatro ruedas con tapacubos púrpura, una boca ancha con dientes y un
// rodillo de cuchillas púrpura que brillan, una cabina con dos faros de
// pupila roja bajo una visera en V, cristales en el lomo, un depósito de
// cristal púrpura con las reliquias y un tubo de escape que echa humo.
// Mira hacia +z; mide 2,3 m hasta el escape (3 m con el humo) y 2,3 de ancho.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const RUEDA = 0.42;

export function crearSegador(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'segador';
  const cuerpo = nodo('cuerpo', raiz, 0, 0.62, 0);

  // Chasis, cabina y morro.
  pieza(cuerpo, caja(1.7, 0.86, 2.1, 0.22), toon(PALETA.metalHelios), 0, 0.3, -0.1);
  pieza(cuerpo, caja(1.84, 0.2, 2.2, 0.08), toon(PALETA.chapaHelios), 0, -0.08, -0.1);
  pieza(cuerpo, caja(1.24, 0.66, 0.95, 0.2), toon(PALETA.chapaHelios), 0, 0.98, 0.3);
  // Franja púrpura que brilla alrededor del chasis.
  pieza(cuerpo, caja(1.74, 0.07, 2.14, 0.035), brillo(PALETA.purpuraBrillo), 0, 0.5, -0.1, { contorno: false });
  // Boca: ranura oscura bajo la cabina, con dientes arriba.
  pieza(cuerpo, caja(1.5, 0.5, 0.3, 0.12), toon(PALETA.oscuroHelios), 0, 0.16, 0.86);
  for (let k = 0; k < 6; k++) {
    pieza(cuerpo, punta(0.07, 0.17).rotateX(Math.PI), toon(PALETA.diente), -0.6 + k * 0.24, 0.32, 1.02, { contorno: false });
  }
  // Cristales en el lomo, inclinados hacia atrás.
  for (const [x, z, alto, inclina] of [[0.55, -0.5, 0.55, -0.5], [-0.6, -0.65, 0.45, -0.6], [0.2, -0.95, 0.38, -0.8]] as const) {
    const c = pieza(cuerpo, punta(0.13, alto), toon(PALETA.purpura), x, 0.72 + alto * 0.35, z);
    c.rotation.set(inclina, 0, -x * 0.5);
  }
  // Depósito de cristal con las reliquias, con aros de metal.
  pieza(cuerpo, esfera(0.38, 1, 0.9, 1), brillo(PALETA.cristal), -0.1, 1.0, -0.62, { contorno: true });
  pieza(cuerpo, toro(0.37, 0.05), toon(PALETA.oscuroHelios), -0.1, 0.9, -0.62);
  pieza(cuerpo, toro(0.25, 0.045), toon(PALETA.oscuroHelios), -0.1, 1.24, -0.62);
  // Tubo de escape.
  barra(cuerpo, [0.62, 0.7, -0.7], [0.62, 1.5, -0.72], 0.08, toon(PALETA.oscuroHelios));
  pieza(cuerpo, barril(0.13, 0.11, 0.12, 0.04), toon(PALETA.oscuroHelios), 0.62, 1.58, -0.72);

  // Cara: dos faros con pupila roja bajo una visera de chapa en V.
  const faros = nodo('faros', cuerpo, 0, 1.0, 0.78);
  for (const s of [1, -1]) {
    pieza(cuerpo, esfera(0.2, 1.1, 1, 0.5), toon(PALETA.blanco), 0.3 * s, 1.0, 0.76);
    pieza(faros, esfera(0.11, 1, 1, 0.5), brillo(PALETA.helios), 0.3 * s, -0.02, 0.07, { contorno: false, sombra: false });
    pieza(faros, esfera(0.035), brillo(PALETA.blanco), 0.3 * s + 0.04, 0.03, 0.12, { contorno: false, sombra: false });
    const visera = pieza(cuerpo, caja(0.5, 0.12, 0.2, 0.05), toon(PALETA.oscuroHelios), 0.28 * s, 1.2, 0.82);
    visera.rotation.z = 0.32 * s;
  }

  // Rodillo de cuchillas: gira sobre el eje x dentro de la boca.
  const rodillo = nodo('rodillo', cuerpo, 0, 0.12, 1.1);
  pieza(rodillo, barril(0.2, 0.2, 1.7, 0.06).rotateZ(Math.PI / 2), toon(PALETA.oscuroHelios));
  for (let k = 0; k < 4; k++) {
    for (const x of [-0.55, 0, 0.55]) {
      const a = (k / 4) * TAU + (x === 0 ? TAU / 8 : 0);
      const cuchilla = pieza(rodillo, punta(0.1, 0.32).scale(1, 1, 0.35), brillo(PALETA.purpuraBrillo), x, Math.cos(a) * 0.3, Math.sin(a) * 0.3, { contorno: false });
      cuchilla.rotation.x = a;
    }
  }

  // Ruedas: dos ejes con tapacubos púrpura y pinchos (cuelgan del chasis,
  // así vuelcan con él).
  for (const [n, z] of [['ruedas_d', 0.55], ['ruedas_t', -0.75]] as const) {
    const eje = nodo(n, cuerpo, 0, RUEDA - 0.62, z);
    for (const s of [1, -1]) {
      pieza(eje, esfera(RUEDA, 0.62, 1, 1), toon(PALETA.oscuro), 0.88 * s, 0, 0);
      pieza(eje, esfera(0.15, 0.5, 1, 1), brillo(PALETA.purpuraBrillo), 1.08 * s, 0, 0, { contorno: false });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU;
        const pincho = pieza(eje, punta(0.06, 0.18), toon(PALETA.purpura), 1.08 * s, Math.cos(a) * 0.25, Math.sin(a) * 0.25);
        pincho.rotation.x = a;
      }
    }
  }

  // Humo del escape (bolas que suben y crecen).
  const humo = nodo('humo', cuerpo, 0.62, 1.7, -0.74);
  for (const [y, r] of [[0, 0.13], [0.22, 0.17], [0.48, 0.21]] as const) {
    pieza(humo, esfera(r), toon(PALETA.metalOscuro), (y * 0.3), y, -y * 0.4, { sombra: false });
  }

  const ruedas = (d: number, vueltas: number) => [
    rot('ruedas_d', ciclo(d, (f) => [f * 360 * vueltas, 0, 0])),
    rot('ruedas_t', ciclo(d, (f) => [f * 360 * vueltas, 0, 0])),
  ];
  const cuchillas = (d: number, vueltas: number) => rot('rodillo', ciclo(d, (f) => [f * 360 * vueltas, 0, 0]));
  const humear = (d: number, veces: number) => [
    esc('humo', ciclo(d, (f) => { const k = 0.4 + ((f * veces) % 1) * 0.9; return [k, k, k]; })),
    mov(raiz, 'humo', ciclo(d, (f) => [0, ((f * veces) % 1) * 0.35, ((f * veces) % 1) * -0.15])),
  ];

  const animaciones = [
    animacion('Reposo', 2.0, [
      mov(raiz, 'cuerpo', ciclo(2, (f) => [0, Math.abs(sen(f, 8)) * 0.015, 0])),
      rot('cuerpo', ciclo(2, (f) => [sen(f, 2) * 0.8, 0, sen(f, 8) * 0.5])),
      cuchillas(2, 1),
      ...humear(2, 2),
      mov(raiz, 'faros', ciclo(2, (f) => [sen(f) * 0.05, 0, 0])),
      esc('faros', ciclo(2, (f) => { const k = f > 0.6 && f < 0.64 ? 0.15 : 1; return [1, k, 1]; })),
    ], 'movimiento', 'Al ralentí: el motor vibra, el rodillo gira despacio, echa humo y mira con los faros.'),

    animacion('Avanzar', 1.2, [
      ...ruedas(1.2, -1),
      cuchillas(1.2, 2),
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, Math.abs(sen(f, 3)) * 0.03, 0])),
      rot('cuerpo', ciclo(1.2, (f) => [sen(f, 3) * 1.5, 0, sen(f, 2) * 2])),
      ...humear(1.2, 3),
      mov(raiz, 'faros', ciclo(1.2, (f) => [0, sen(f, 3) * 0.01, 0])),
    ], 'movimiento', 'Traquetea hacia delante: ruedas y rodillo girando, sacudidas y humo.'),

    animacion('Embestir', 1.4, [
      // Se echa atrás levantando el morro, ruge con los faros encendidos y carga.
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.5, 0, 0.12, -0.3], [0.62, 0, 0.1, -0.32], [0.8, 0, 0, 0.6], [1.0, 0, 0, 0.55], [1.4, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.5, -12, 0, 0], [0.56, -12, 0, 2], [0.62, -12, 0, -2], [0.8, 8, 0, 0], [1.0, 3, 0, 0], [1.4, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.5, 1.04, 0.96, 0.95], [0.8, 0.96, 1.02, 1.08], [0.9, 1.04, 0.96, 1], [1.4, 1, 1, 1]])),
      rot('ruedas_d', poses([[0, 0, 0, 0], [0.5, 120, 0, 0], [0.8, -260, 0, 0], [1.4, -360, 0, 0]])),
      rot('ruedas_t', poses([[0, 0, 0, 0], [0.5, 120, 0, 0], [0.8, -260, 0, 0], [1.4, -360, 0, 0]])),
      rot('rodillo', ciclo(1.4, (f) => [f * 360 * 4, 0, 0])),
      esc('faros', poses([[0, 1, 1, 1], [0.45, 1.5, 1.5, 1.2], [0.85, 1.5, 1.5, 1.2], [1.4, 1, 1, 1]])),
      esc('humo', poses([[0, 0.4, 0.4, 0.4], [0.45, 0.6, 0.6, 0.6], [0.62, 1.5, 1.5, 1.5], [0.9, 0.4, 0.4, 0.4], [1.4, 0.4, 0.4, 0.4]])),
      mov(raiz, 'humo', poses([[0, 0, 0, 0], [0.62, 0, 0.3, -0.2], [0.9, 0, 0, 0], [1.4, 0, 0, 0]])),
    ], 'ataque', 'Se echa atrás con el morro arriba y los faros encendidos, ruge echando humo y embiste.'),

    animacion('Golpe recibido', 0.4, [
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.06, 0.9, 1.04], [0.18, 0.98, 1.03, 0.99], [0.4, 1, 1, 1]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.06, -5, 0, 4], [0.18, 2, 0, -2], [0.4, 0, 0, 0]])),
      esc('faros', poses([[0, 1, 1, 1], [0.06, 1.2, 0.2, 1], [0.25, 1, 1, 1], [0.4, 1, 1, 1]])),
    ], 'reaccion', 'Se sacude, se aplasta sobre las ruedas y guiña los faros.', false),

    animacion('Derrota', 1.4, [
      // Tiembla echando humo, los faros se apagan y vuelca de lado.
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.4, 0, 0.05, 0], [0.9, -0.3, 0.6, 0], [1.05, -0.32, 0.52, 0], [1.2, -0.33, 0.58, 0], [1.4, -0.33, 0.56, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.08, 0, 0, 3], [0.16, 0, 0, -3], [0.24, 0, 0, 3], [0.4, 0, 0, -6], [0.9, 0, 0, -88], [1.05, 0, 0, -80], [1.2, 0, 0, -86], [1.4, 0, 0, -85]])),
      rot('ruedas_d', poses([[0, 0, 0, 0], [0.4, -200, 0, 0], [1.4, -260, 0, 0]])),
      rot('ruedas_t', poses([[0, 0, 0, 0], [0.4, -200, 0, 0], [1.4, -260, 0, 0]])),
      esc('faros', poses([[0, 1, 1, 1], [0.3, 1.5, 1.5, 1], [0.45, 0.001, 0.001, 1], [1.4, 0.001, 0.001, 1]])),
      esc('humo', poses([[0, 0.4, 0.4, 0.4], [0.3, 1.6, 1.6, 1.6], [0.6, 2, 2, 2], [0.9, 0.001, 0.001, 0.001], [1.4, 0.001, 0.001, 0.001]])),
      rot('rodillo', poses([[0, 0, 0, 0], [0.5, 500, 0, 0], [1.0, 600, 0, 0], [1.4, 610, 0, 0]])),
    ], 'reaccion', 'Tiembla echando humo, los faros se apagan y vuelca de lado.', false),
  ];

  return { id: 'segador', nombre: 'Segador', rol: 'Unidad de HELIOS · cosechadora', raiz, animaciones };
}
