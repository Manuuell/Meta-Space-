import * as THREE from 'three';
import { PALETA, animacion, barril, brillo, caja, ciclo, conDetalle, esc, mov, nodo, pieza, poses, rot, toon, toro, type Modelo } from './kit.ts';
import { halo } from './brillo.ts';

// Ración de la colonia: una lata de comida de antes del velo, con su etiqueta
// a rayas y la anilla de abrir. Flota un palmo sobre el suelo, gira despacio
// y brilla un poco para que se vea entre la nieve. Al pasar por encima (si te
// falta vida) cura. Mira hacia +z.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);

export function crearRacion(): Modelo {
  return conDetalle(0.6, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'racion';
  const cuerpo = nodo('cuerpo', raiz);
  const lata = nodo('lata', cuerpo, 0, 0.55, 0);
  pieza(lata, barril(0.2, 0.2, 0.36, 0.05), toon(PALETA.metal));
  // Etiqueta: crema con una banda roja y el sol de la colonia.
  pieza(lata, barril(0.205, 0.205, 0.22, 0.01), toon('#f4e3c0'), 0, 0, 0, { contorno: false });
  pieza(lata, barril(0.208, 0.208, 0.06, 0.01), toon('#d9483b'), 0, 0.04, 0, { contorno: false });
  pieza(lata, caja(0.1, 0.1, 0.02, 0.02), toon('#ffcf3a'), 0, -0.04, 0.205, { contorno: false });
  pieza(lata, toro(0.2, 0.02), toon(PALETA.metalOscuro), 0, 0.17, 0, { contorno: false });
  pieza(lata, toro(0.06, 0.015), toon(PALETA.metalOscuro), 0.06, 0.19, 0, { contorno: false });
  // Una cruz verde encima: se lee como «cura» desde la cámara.
  pieza(lata, caja(0.16, 0.025, 0.05, 0.01), brillo('#5fe08a'), 0, 0.185, 0, { contorno: false });
  pieza(lata, caja(0.05, 0.025, 0.16, 0.01), brillo('#5fe08a'), 0, 0.185, 0, { contorno: false });
  halo(lata, '#9dffb8', 1.1, 0, 0, 0, 0.45);
  // Brillo al recogerla (solo en `Recoger`).
  const destello = nodo('destello', cuerpo, 0, 0.55, 0);
  pieza(destello, new THREE.SphereGeometry(0.45, 12, 8), brillo('#c8ffd6'), 0, 0, 0, { contorno: false, sombra: false });
  destello.scale.setScalar(0.001);

  const animaciones = [
    animacion('Reposo', 3, [
      mov(raiz, 'lata', ciclo(3, (f) => [0, sen(f, 2) * 0.08, 0])),
      rot('lata', ciclo(3, (f) => [sen(f, 2) * 6, f * 360, sen(f) * 6])),
    ], 'movimiento', 'Flota, sube y baja un palmo y gira despacio sobre sí misma.'),
    animacion('Recoger', 0.4, [
      esc('lata', poses([[0, 1, 1, 1], [0.12, 1.3, 1.3, 1.3], [0.3, 0.001, 0.001, 0.001], [0.4, 0.001, 0.001, 0.001]])),
      mov(raiz, 'lata', poses([[0, 0, 0, 0], [0.3, 0, 0.6, 0], [0.4, 0, 0.6, 0]])),
      esc('destello', poses([[0, 0.001, 0.001, 0.001], [0.1, 0.6, 0.6, 0.6], [0.4, 1.6, 1.6, 1.6]])),
    ], 'reaccion', 'Se hincha, sube y desaparece en un destello verde.', false),
  ];
  return { id: 'racion', nombre: 'Ración de la colonia', rol: 'Mapa · cura al pasar', raiz, animaciones };
}
