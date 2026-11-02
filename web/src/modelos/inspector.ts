import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, rot, toon, toro,
  type Modelo,
} from './kit.ts';

// Dron de mantenimiento: un inspector de turbina de ARES-IX reprogramado
// por ADA para orbitar al astronauta y golpear a lo que se acerque. Cuerpo
// redondo blanco con la banda verde de mantenimiento, un visor con un solo
// ojo cian, la hélice arriba en su mástil y dos toberas a los lados. Mira
// hacia +z; mide 0,9 m. El origen está en su centro (vuela).

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);
const VERDE = '#c9f27a', VERDE_OSCURO = '#86b83e';

export function crearInspector(): Modelo {
  return conDetalle(0.7, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'inspector';
  const cuerpo = nodo('cuerpo', raiz);

  // Casco redondo con la banda verde y la panza más oscura.
  pieza(cuerpo, esfera(0.34), toon(PALETA.traje));
  pieza(cuerpo, esfera(0.3, 1, 0.55, 1), toon(PALETA.trajeSombra), 0, -0.14, 0, { contorno: false });
  pieza(cuerpo, toro(0.335, 0.045), toon(VERDE), 0, 0.04, 0);

  // Visor y ojo: el ojo se escala para parpadear y entrecerrarse al golpear.
  pieza(cuerpo, esfera(0.17, 1, 1, 0.55), toon('#1d2b4f'), 0, 0.03, 0.28);
  const ojo = nodo('ojo', cuerpo, 0, 0.03, 0.37);
  pieza(ojo, esfera(0.085, 1, 1, 0.5), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
  pieza(ojo, esfera(0.025), brillo(PALETA.blanco), 0.03, 0.03, 0.03, { contorno: false, sombra: false });

  // Mástil y hélice de dos palas.
  pieza(cuerpo, barril(0.035, 0.05, 0.2, 0.02), toon(PALETA.metalOscuro), 0, 0.41, 0);
  const helice = nodo('helice', cuerpo, 0, 0.52, 0);
  pieza(helice, caja(0.7, 0.03, 0.1, 0.03), toon(VERDE));
  pieza(helice, esfera(0.05), toon(PALETA.metalOscuro));

  // Toberas laterales con su llama de plasma.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const tobera = nodo(`tobera_${lado}`, cuerpo, 0.38 * s, -0.02, -0.02);
    pieza(tobera, barril(0.08, 0.1, 0.22, 0.03).rotateX(Math.PI / 2), toon(PALETA.metalOscuro));
    pieza(tobera, toro(0.085, 0.02).rotateX(Math.PI / 2), toon(VERDE_OSCURO), 0, 0, 0.1);
    const llama = nodo(`llama_${lado}`, tobera, 0, 0, -0.14);
    pieza(llama, esfera(0.06, 1, 1, 1.8), brillo(VERDE), 0, 0, -0.05, { contorno: false, sombra: false });
  }

  const animaciones = [
    animacion('Volar', 0.6, [
      rot('helice', ciclo(0.6, (f) => [0, f * 1440, 0])),
      mov(raiz, 'cuerpo', ciclo(0.6, (f) => [0, sen(f) * 0.04, 0])),
      rot('cuerpo', ciclo(0.6, (f) => [8 + sen(f) * 3, 0, sen(f) * 4])),
      esc('llama_i', ciclo(0.6, (f) => { const k = 1 + 0.25 * sen(f, 3); return [k, k, k]; })),
      esc('llama_d', ciclo(0.6, (f) => { const k = 1 - 0.25 * sen(f, 3); return [k, k, k]; })),
      esc('ojo', ciclo(0.6, (f) => { const k = 1 + 0.08 * sen(f, 2); return [k, k, k]; })),
    ], 'movimiento', 'Orbita: la hélice gira, el cuerpo se mece inclinado y las toberas laten.'),

    animacion('Golpe', 0.3, [
      // Embiste: se echa atrás, sale hacia delante aplastado y vuelve.
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.06, 0, 0.02, -0.12], [0.14, 0, -0.02, 0.28], [0.3, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 8, 0, 0], [0.06, -10, 0, 0], [0.14, 32, 0, 0], [0.3, 8, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.92, 1.08, 0.92], [0.14, 1.12, 0.88, 1.18], [0.3, 1, 1, 1]])),
      esc('ojo', poses([[0, 1, 1, 1], [0.08, 1.3, 0.35, 1], [0.24, 1.3, 0.35, 1], [0.3, 1, 1, 1]])),
      rot('helice', poses([[0, 0, 0, 0], [0.3, 0, 900, 0]])),
    ], 'ataque', 'Golpe: se echa atrás, embiste con el ojo entrecerrado y vuelve a su sitio.', false),
  ];

  return { id: 'inspector', nombre: 'Dron de mantenimiento', rol: 'Herramienta · 0,9 m, orbita al jugador', raiz, animaciones };
}
