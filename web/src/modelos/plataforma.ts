import * as THREE from 'three';
import { PALETA, barril, brillo, caja, conDetalle, esfera, pieza, toon, toro } from './kit.ts';

// La plataforma de lanzamiento del sector: un disco ancho para que quepa la nave
// tumbada con las alas abiertas, un anillo de luces y una torre de servicio con su
// brazo de combustible. La nave se apoya encima, a `ALTO_PLATAFORMA` del suelo.

const TAU = Math.PI * 2;
export const ALTO_PLATAFORMA = 0.9;
export const RADIO_PLATAFORMA = 23;
/** Dónde está la torre, respecto al centro de la plataforma. */
export const TORRE = { x: 27, z: 0, ancho: 5 };

export function crearPlataforma(): THREE.Group {
  return conDetalle(0.8, () => {
    const g = new THREE.Group();
    const hierro = toon('#3f4250'), oscuro = toon('#24262f'), naranja = toon(PALETA.naranja);
    pieza(g, barril(RADIO_PLATAFORMA, RADIO_PLATAFORMA + 1, ALTO_PLATAFORMA, 0.25), toon('#5d5f6b'), 0, ALTO_PLATAFORMA / 2, 0);
    pieza(g, toro(RADIO_PLATAFORMA - 1.2, 0.16), brillo('#ff8a3d'), 0, ALTO_PLATAFORMA + 0.02, 0, { contorno: false, sombra: false });
    pieza(g, toro(15, 0.12), brillo(PALETA.ada), 0, ALTO_PLATAFORMA + 0.02, 0, { contorno: false, sombra: false });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      pieza(g, caja(3, 0.06, 0.7, 0.02), k % 2 ? naranja : oscuro, Math.cos(a) * 19, ALTO_PLATAFORMA + 0.03, Math.sin(a) * 19, { contorno: false, sombra: false }).rotation.y = -a;
    }
    // Torre de servicio con la manguera de combustible.
    const { x, z } = TORRE, ALTO = 30;
    for (const cx of [-1.7, 1.7]) for (const cz of [-1.7, 1.7]) pieza(g, caja(0.45, ALTO, 0.45, 0.06), hierro, x + cx, ALTO / 2, z + cz);
    for (let y = 2.5; y < ALTO; y += 3.2) {
      for (const cz of [-1.7, 1.7]) pieza(g, caja(3.5, 0.2, 0.2, 0.05), hierro, x, y, z + cz, { contorno: false });
      for (const cx of [-1.7, 1.7]) pieza(g, caja(0.2, 0.2, 3.5, 0.05), hierro, x + cx, y, z, { contorno: false });
    }
    pieza(g, caja(13, 0.9, 0.8, 0.12), naranja, x - 7.5, 12, z);
    pieza(g, caja(3.4, 2, 3.4, 0.2), oscuro, x, 12.4, z);
    pieza(g, esfera(0.5), brillo('#ff2a12'), x, ALTO + 0.6, z, { contorno: false });
    return g;
  });
}
