import * as THREE from 'three';
import { PALETA, animacion, barra, barril, brillo, caja, ciclo, conDetalle, esc, mov, nodo, pieza, poses, rot, toon, toro, type Modelo } from './kit.ts';
import { halo } from './brillo.ts';

// Imán de grúa: el electroimán de una grúa del puerto de la colonia, caído y
// medio enterrado, con su cable enroscado y la caja de mando. Todavía chisporrotea:
// entre los polos saltan arcos cian. Al tocarlo se enciende de golpe y toda la
// chatarra suelta del sector sale volando hacia el jugador. Mira hacia +z.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const ROJO = '#d9483b', ROJO_OSCURO = '#9c2f28';

export function crearImanGrua(): Modelo {
  return conDetalle(0.6, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'iman-grua';
  const cuerpo = nodo('cuerpo', raiz);
  // Tierra removida alrededor.
  pieza(cuerpo, barril(1.3, 1.6, 0.16, 0.08), toon('#8a6a4a'), 0, 0.02, 0);

  // La herradura, inclinada hacia la cámara: arco rojo y polos de acero.
  const iman = nodo('iman', cuerpo, 0, 0.2, 0);
  iman.rotation.x = -0.5;
  pieza(iman, new THREE.TorusGeometry(0.62, 0.24, 10, 22, Math.PI), toon(ROJO), 0, 1.0, 0);
  for (const s of [1, -1]) {
    pieza(iman, barril(0.24, 0.24, 0.7, 0.06), toon(ROJO), 0.62 * s, 0.62, 0);
    pieza(iman, barril(0.25, 0.25, 0.26, 0.05), toon(PALETA.metal), 0.62 * s, 0.17, 0);
    pieza(iman, toro(0.25, 0.03), toon(ROJO_OSCURO), 0.62 * s, 0.32, 0, { contorno: false });
  }
  pieza(iman, caja(0.16, 0.16, 0.5, 0.04), toon(PALETA.metalOscuro), 0, 1.64, 0);
  // El cable de la grúa, que se enrosca en el suelo.
  barra(iman, [0, 1.7, 0], [0.25, 2.0, -0.5], 0.06, toon(PALETA.oscuro));
  barra(cuerpo, [0.3, 1.6, -0.9], [1.1, 0.12, -1.0], 0.06, toon(PALETA.oscuro));
  pieza(cuerpo, toro(0.42, 0.06), toon(PALETA.oscuro), 1.2, 0.12, -0.4);
  // Caja de mando con dos luces.
  const mando = nodo('mando', cuerpo, -1.15, 0, 0.55);
  pieza(mando, caja(0.4, 0.5, 0.3, 0.05), toon('#ffcf3a'), 0, 0.3, 0);
  pieza(mando, caja(0.06, 0.06, 0.02, 0.01), brillo(PALETA.ada), -0.08, 0.42, 0.16, { contorno: false });
  pieza(mando, caja(0.06, 0.06, 0.02, 0.01), brillo('#ff4a3a'), 0.08, 0.42, 0.16, { contorno: false });

  // Arcos eléctricos entre los polos (dos zigzag) y el resplandor.
  const arcos = nodo('arcos', iman, 0, 0.08, 0);
  for (const [k, desfase] of [[0, 0], [1, 0.12]] as const) {
    const zig = [-0.6, -0.35, -0.1, 0.15, 0.4, 0.6];
    for (let n = 0; n < zig.length - 1; n++) {
      const y0 = (n % 2 ? 0.12 : -0.08) + desfase, y1 = (n % 2 ? -0.08 : 0.12) + desfase;
      barra(arcos, [zig[n], y0 + k * 0.05, 0.02 * k], [zig[n + 1], y1 + k * 0.05, 0.02 * k], 0.02, brillo('#bff6ff'), { contorno: false, sombra: false });
    }
  }
  halo(arcos, PALETA.ada, 1.8, 0, 0, 0, 0.55);
  // La onda al activarlo (solo en `Activar`).
  const onda = nodo('onda', cuerpo, 0, 0.9, 0);
  pieza(onda, new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: PALETA.ada, transparent: true, opacity: 0.25, depthWrite: false }), 0, 0, 0, { contorno: false, sombra: false });
  onda.scale.setScalar(0.001);

  const animaciones = [
    animacion('Reposo', 2.0, [
      // Chisporrotea: los arcos aparecen a trompicones y el imán tiembla.
      esc('arcos', ciclo(2, (f) => { const k = sen(f, 6) * sen(f, 3, 0.2) > 0.2 ? 1 : 0.001; return [k, k, k]; })),
      rot('iman', ciclo(2, (f) => [-28.6 + sen(f, 8) * 0.6, 0, sen(f, 5) * 0.8])),
      esc('mando', ciclo(2, (f) => { const k = 1 + Math.max(0, sen(f, 2)) * 0.04; return [k, k, k]; })),
    ], 'movimiento', 'Chisporrotea: saltan arcos cian entre los polos y la herradura tiembla.'),
    animacion('Activar', 1.4, [
      mov(raiz, 'iman', poses([[0, 0, 0, 0], [0.25, 0, 0.5, 0], [0.5, 0, 0.35, 0], [1.4, 0, 0, 0]])),
      rot('iman', poses([[0, -28.6, 0, 0], [0.25, -10, 0, 0], [0.5, -14, 0, 0], [1.4, -28.6, 0, 0]])),
      esc('arcos', poses([[0, 1, 1, 1], [0.2, 2, 2.4, 2], [0.9, 1.6, 2, 1.6], [1.4, 1, 1, 1]])),
      esc('onda', poses([[0, 0.001, 0.001, 0.001], [0.25, 1, 1, 1], [0.9, 7, 7, 7], [1.0, 0.001, 0.001, 0.001], [1.4, 0.001, 0.001, 0.001]])),
    ], 'reaccion', 'Se levanta de un tirón, los arcos estallan y suelta una onda que llama a toda la chatarra.', false),
    animacion('Apagado', 2.0, [
      esc('arcos', ciclo(2, () => [0.001, 0.001, 0.001])),
      rot('iman', ciclo(2, () => [-32, 0, 3])),
    ], 'movimiento', 'Gastado: ya no chisporrotea.'),
  ];
  return { id: 'iman-grua', nombre: 'Imán de grúa', rol: 'Mapa · atrae toda la chatarra', raiz, animaciones };
}
