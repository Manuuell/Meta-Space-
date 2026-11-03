import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, rot, toon,
  type Modelo,
} from './kit.ts';
import { halo } from './brillo.ts';

// Fragua del Deshielo: la forja de la colonia, que ardía día y noche para que
// no se helara el agua. Horno de piedra con la boca al rojo, chimenea que
// escupe pavesas, un fuelle de cuero, un yunque con su martillo y una pila de
// templar llena de hielo que se va derritiendo. Aquí una herramienta se funde
// en otra. Clip `Forjar`: el martillo cae tres veces y el fuego ruge.
// 3 m de ancho; mira hacia +z.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const PIEDRA = '#7a6f66', PIEDRA_OSCURA = '#564d47', FUEGO = '#ff8a3d', BRASA = '#ffd25a';

export function crearFragua(): Modelo {
  return conDetalle(0.5, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'fragua';
  const cuerpo = nodo('cuerpo', raiz);

  // Horno de piedras irregulares con la boca encendida.
  const horno = nodo('horno', cuerpo, -0.6, 0, -0.3);
  pieza(horno, caja(1.7, 1.5, 1.4, 0.2), toon(PIEDRA), 0, 0.75, 0);
  for (const [x, y, z, a, b, c] of [[-0.6, 0.3, 0.71, 0.5, 0.3, 0.06], [0.5, 0.9, 0.71, 0.45, 0.32, 0.06], [-0.3, 1.3, 0.71, 0.6, 0.25, 0.06], [0.7, 0.35, 0.71, 0.35, 0.3, 0.06]]) {
    pieza(horno, caja(a, b, c, 0.04), toon(PIEDRA_OSCURA), x, y, z, { contorno: false });
  }
  pieza(horno, caja(0.8, 0.6, 0.1, 0.06), toon('#2a2018'), 0, 0.62, 0.68);
  const fuego = nodo('fuego', horno, 0, 0.55, 0.7);
  pieza(fuego, esfera(0.32, 1.1, 0.8, 0.3), brillo(FUEGO), 0, 0, 0, { contorno: false });
  pieza(fuego, esfera(0.18, 1.1, 0.8, 0.3), brillo(BRASA), 0, -0.05, 0.03, { contorno: false });
  halo(fuego, FUEGO, 2.4, 0, 0.1, 0.2, 0.8);
  // Chimenea con pavesas que suben.
  pieza(horno, barril(0.32, 0.4, 1.4, 0.06), toon(PIEDRA_OSCURA), 0.3, 2.1, -0.2);
  const pavesas = nodo('pavesas', horno, 0.3, 2.9, -0.2);
  for (let k = 0; k < 5; k++) pieza(pavesas, caja(0.07, 0.07, 0.07, 0.01), brillo(k % 2 ? BRASA : FUEGO), Math.sin(k * 2.4) * 0.18, k * 0.18, Math.cos(k * 2.4) * 0.18, { contorno: false, sombra: false });
  // Fuelle de cuero a un lado.
  const fuelle = nodo('fuelle', horno, -1.05, 0.45, 0.2);
  pieza(fuelle, caja(0.5, 0.12, 0.7, 0.05), toon('#6b4a2f'), 0, 0, 0);
  pieza(fuelle, caja(0.46, 0.2, 0.6, 0.08), toon('#8a5a32'), 0, 0.12, -0.02);
  barra(fuelle, [0, 0.05, 0.35], [0, 0.05, 0.8], 0.05, toon(PALETA.metalOscuro));

  // Yunque, martillo y la pila de templar con hielo.
  const yunque = nodo('yunque', cuerpo, 0.9, 0, 0.6);
  pieza(yunque, barril(0.25, 0.32, 0.45, 0.06), toon('#4a3b2e'), 0, 0.22, 0);
  pieza(yunque, caja(0.8, 0.22, 0.34, 0.06), toon(PALETA.metalOscuro), 0, 0.56, 0);
  pieza(yunque, caja(0.3, 0.14, 0.24, 0.05), toon(PALETA.metalOscuro), 0.5, 0.6, 0);
  // La pieza al rojo encima del yunque y el martillo que la golpea.
  pieza(yunque, caja(0.36, 0.06, 0.1, 0.02), brillo(BRASA), -0.05, 0.7, 0, { contorno: false });
  const martillo = nodo('martillo', yunque, -0.55, 0.75, 0);
  martillo.rotation.z = -0.9;
  barra(martillo, [0, 0, 0], [0.5, 0, 0], 0.04, toon('#8a5a32'));
  pieza(martillo, caja(0.16, 0.26, 0.16, 0.04), toon(PALETA.metal), 0.52, 0, 0);
  const chispas = nodo('chispas', yunque, -0.05, 0.75, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    pieza(chispas, caja(0.05, 0.05, 0.05, 0.01), brillo(k % 2 ? BRASA : '#fff2c8'), Math.cos(a) * 0.3, 0.1 + (k % 3) * 0.08, Math.sin(a) * 0.3, { contorno: false, sombra: false });
  }
  chispas.scale.setScalar(0.001);
  const pila = nodo('pila', cuerpo, 1.0, 0, -0.55);
  pieza(pila, caja(0.9, 0.45, 0.6, 0.06), toon(PIEDRA_OSCURA), 0, 0.22, 0);
  const hielo = nodo('hielo', pila, 0, 0.46, 0);
  for (const [x, z, t] of [[-0.2, 0.05, 0.22], [0.15, -0.08, 0.26], [0.22, 0.12, 0.16]]) pieza(hielo, caja(t, t, t, 0.03), toon('#bfeaff'), x, 0, z);
  pieza(pila, caja(0.82, 0.04, 0.52, 0.01), brillo('#7fd6ff'), 0, 0.44, 0, { contorno: false });

  const animaciones = [
    animacion('Reposo', 2.0, [
      // El fuego respira, las pavesas suben y el fuelle sopla.
      esc('fuego', ciclo(2, (f) => { const k = 1 + 0.1 * sen(f, 3) + 0.06 * sen(f, 7); return [k, k * 1.1, k]; })),
      mov(raiz, 'pavesas', ciclo(2, (f) => [sen(f) * 0.05, (f % 1) * 0.6 - 0.3, 0])),
      rot('pavesas', ciclo(2, (f) => [0, f * 360, 0])),
      esc('fuelle', ciclo(2, (f) => { const k = 1 - Math.max(0, sen(f, 1)) * 0.35; return [1, k, 1]; })),
      mov(raiz, 'hielo', ciclo(2, (f) => [0, sen(f) * 0.01, 0])),
    ], 'movimiento', 'El fuego respira, las pavesas suben por la chimenea y el fuelle sopla solo.'),
    animacion('Forjar', 1.5, [
      rot('martillo', poses([[0, 0, 0, -51], [0.15, 0, 0, -100], [0.3, 0, 0, 0], [0.45, 0, 0, -100], [0.6, 0, 0, 0], [0.75, 0, 0, -100], [0.9, 0, 0, 0], [1.5, 0, 0, -51]])),
      esc('chispas', poses([[0, 0.001, 0.001, 0.001], [0.29, 0.001, 0.001, 0.001], [0.33, 1.6, 1.6, 1.6], [0.45, 0.001, 0.001, 0.001],
        [0.59, 0.001, 0.001, 0.001], [0.63, 1.8, 1.8, 1.8], [0.75, 0.001, 0.001, 0.001], [0.89, 0.001, 0.001, 0.001], [0.93, 2.4, 2.4, 2.4], [1.1, 0.001, 0.001, 0.001], [1.5, 0.001, 0.001, 0.001]])),
      esc('fuego', poses([[0, 1, 1, 1], [0.3, 1.5, 1.7, 1.5], [0.9, 1.8, 2, 1.8], [1.5, 1, 1, 1]])),
      esc('hielo', poses([[0, 1, 1, 1], [1.1, 1, 1, 1], [1.3, 1.1, 0.7, 1.1], [1.5, 1, 1, 1]])),
    ], 'reaccion', 'El martillo cae tres veces sobre el yunque entre chispas y el fuego ruge.', false),
  ];
  return { id: 'fragua', nombre: 'Fragua del Deshielo', rol: 'Mapa · funde dos herramientas', raiz, animaciones };
}
