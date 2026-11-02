import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, nodo, pieza, poses, punta, rot,
  toon, toro, type Modelo,
} from './kit.ts';

// Refugio: la entrada de un refugio de la gente de Meta, medio enterrada.
// Una cúpula de hormigón con una escotilla redonda, sacos terreros, un panel
// solar que ya no sirve de mucho, una antena de radio con luz, una estufa de
// bidón con fuego y una bandera con el sol. Alrededor trabajan los NPC.
// Mira hacia +z (la escotilla); 5 m de ancho y 5 m hasta la antena.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const HORMIGON = '#8a8f9c', HORMIGON_OSCURO = '#666b79', SACO = '#a89a7a';
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export function crearRefugio(): Modelo {
  return conDetalle(0.8, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'refugio';
  const fino = <T,>(fn: () => T) => conDetalle(0.5, fn);

  // Cúpula medio enterrada, con un aro de hormigón y ventanucos con luz.
  // Solo la mitad de arriba: lo de abajo está enterrado.
  pieza(raiz, new THREE.SphereGeometry(2.4, 30, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.62, 1), toon(HORMIGON), 0, 0, -0.4);
  pieza(raiz, toro(2.35, 0.14), toon(HORMIGON_OSCURO), 0, 0.12, -0.4);
  for (const a of [-0.9, 0.9, 2.4, -2.4]) {
    pieza(raiz, capsula(0.12, 0.3).rotateZ(Math.PI / 2), brillo(PALETA.plasma), Math.sin(a) * 2.0, 0.85, Math.cos(a) * 2.0 - 0.4, { contorno: true });
  }
  // Pórtico de la escotilla.
  pieza(raiz, barril(1.0, 1.1, 0.5, 0.12).rotateX(Math.PI / 2), toon(HORMIGON_OSCURO), 0, 0.95, 1.65);
  const puerta = nodo('puerta', raiz, -0.82, 0.95, 1.92);
  pieza(puerta, barril(0.8, 0.8, 0.14, 0.05).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0.82, 0, 0);
  pieza(puerta, toro(0.55, 0.06).rotateX(Math.PI / 2), toon(PALETA.metal), 0.82, 0, 0.08);
  barra(puerta, [0.6, 0, 0.12], [1.04, 0, 0.12], 0.04, toon(PALETA.metal));
  // Interior: luz cálida que se ve al abrir.
  fino(() => pieza(raiz, esfera(0.75, 1, 1, 0.2), brillo(PALETA.plasma), 0, 0.95, 1.7, { contorno: false }));

  // Sacos terreros a los lados de la entrada.
  for (const s of [1, -1]) {
    for (const [x, y, z] of [[1.3, 0.18, 1.6], [1.8, 0.18, 1.1], [1.55, 0.48, 1.35]] as const) {
      const saco = pieza(raiz, capsula(0.2, 0.35).rotateZ(Math.PI / 2), toon(SACO), x * s, y, z);
      saco.rotation.y = -0.6 * s;
    }
  }

  // Panel solar sobre un poste.
  barra(raiz, [-1.6, 0.9, -1.2], [-1.6, 2.2, -1.2], 0.06, toon(PALETA.metalOscuro));
  const panel = pieza(raiz, caja(1.1, 0.06, 0.7, 0.03), toon('#2d4f8c'), -1.6, 2.3, -1.2);
  panel.rotation.x = 0.5;
  pieza(raiz, caja(1.14, 0.03, 0.04, 0.01), toon(PALETA.metal), -1.6, 2.33, -1.2);

  // Antena de radio con su luz.
  barra(raiz, [1.0, 1.2, -1.5], [1.0, 4.8, -1.5], 0.05, toon(PALETA.metalOscuro));
  for (const y of [2.5, 3.6]) barra(raiz, [0.7, y, -1.5], [1.3, y, -1.5], 0.025, toon(PALETA.metalOscuro));
  const luz = nodo('luz', raiz, 1.0, 4.9, -1.5);
  fino(() => pieza(luz, esfera(0.1), brillo(PALETA.helios), 0, 0, 0, { contorno: false }));
  // Alarma: luz giratoria sobre la escotilla (escondida salvo en Alarma).
  const alarma = nodo('alarma', raiz, 0, 1.95, 1.7);
  pieza(alarma, barril(0.12, 0.15, 0.12, 0.03), toon(PALETA.metalOscuro));
  const faro = nodo('faro', alarma, 0, 0.1, 0);
  fino(() => pieza(faro, esfera(0.12, 1, 0.8, 1), brillo(PALETA.helios), 0, 0, 0, { contorno: false }));
  fino(() => pieza(faro, punta(0.25, 1.2).rotateZ(-Math.PI / 2).scale(1, 0.3, 1), brillo(PALETA.helios), 0.7, 0, 0, { contorno: false, sombra: false }));
  oculto(faro);

  // Estufa de bidón con fuego y la bandera del sol.
  pieza(raiz, barril(0.3, 0.3, 0.7, 0.05), toon('#6b4430'), 2.3, 0.35, 0.6);
  pieza(raiz, toro(0.3, 0.035), toon(PALETA.metalOscuro), 2.3, 0.5, 0.6);
  const fuego = nodo('fuego', raiz, 2.3, 0.72, 0.6);
  fino(() => {
    pieza(fuego, punta(0.2, 0.55), brillo(PALETA.plasma), 0, 0.2, 0, { contorno: false, sombra: false });
    pieza(fuego, punta(0.12, 0.4), brillo(PALETA.arena), 0.05, 0.15, 0.06, { contorno: false, sombra: false });
  });
  barra(raiz, [-2.4, 0, 0.8], [-2.4, 3.0, 0.8], 0.04, toon('#6b4a2f'));
  const bandera = nodo('bandera', raiz, -2.4, 2.75, 0.8);
  pieza(bandera, capsula(0.03, 0.7).rotateZ(Math.PI / 2).scale(1, 10, 0.3), toon('#3f6f8f'), 0.42, -0.1, 0);
  fino(() => pieza(bandera, esfera(0.13, 1, 1, 0.3), brillo(PALETA.arena), 0.42, -0.1, 0.03, { contorno: false }));

  const animaciones = [
    animacion('Reposo', 3.0, [
      esc('luz', ciclo(3, (f) => { const k = Math.cos(f * TAU * 3) > 0.6 ? 1.5 : 0.4; return [k, k, k]; })),
      esc('fuego', ciclo(3, (f) => [1 + 0.1 * sen(f, 7), 1 + 0.2 * sen(f, 5, 0.3), 1 + 0.1 * sen(f, 7)])),
      rot('bandera', ciclo(3, (f) => [0, sen(f, 3) * 15, sen(f, 3, 0.2) * 5])),
    ], 'movimiento', 'En calma: la luz de la antena parpadea, el fuego de la estufa baila y la bandera ondea.'),

    animacion('Abrir', 1.4, [
      rot('puerta', poses([[0, 0, 0, 0], [0.2, 0, -6, 0], [0.35, 0, 0, 0], [1.0, 0, -105, 0], [1.2, 0, -98, 0], [1.4, 0, -100, 0]])),
    ], 'reaccion', 'La escotilla se destraba y se abre hacia un lado: dentro se ve luz cálida.', false),

    animacion('Alarma', 1.0, [
      esc('faro', ciclo(1, () => [1, 1, 1])),
      rot('faro', ciclo(1, (f) => [0, f * 360 * 2, 0])),
      esc('luz', ciclo(1, (f) => { const k = Math.cos(f * TAU * 4) > 0 ? 1.8 : 0.3; return [k, k, k]; })),
      rot('puerta', ciclo(1, () => [0, 0, 0])),
      esc('fuego', ciclo(1, (f) => [1 + 0.1 * sen(f, 5), 1 + 0.2 * sen(f, 4), 1 + 0.1 * sen(f, 5)])),
    ], 'reaccion', 'Hay enemigos cerca: la escotilla se cierra y gira una luz roja de alarma.'),
  ];

  return { id: 'refugio', nombre: 'Refugio', rol: 'Mapa · entrada a un refugio de la gente de Meta', raiz, animaciones };
}
