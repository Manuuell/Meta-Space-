import {
  PALETA, barra, barril, brillo, caja, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, rot, toon,
  toro, type Modelo,
} from './kit.ts';
import { crearGente, type Aspecto } from './gente.ts';

// Bruno Ferro, el chatarrero: gorro de lana con pompón, barba gris, abrigo
// marrón y una mochila que rebosa de tubos y engranajes. Su puesto es un carro
// de chatarra y una balanza colgada: saca una pieza, la pesa, la mira y la
// echa al cubo. Cambia chatarra por mejoras. Mira hacia +z.

const ASPECTO: Aspecto = {
  id: 'npc-chatarrero', nombre: 'Bruno, el chatarrero', rol: 'Gente de Meta · cambia chatarra por mejoras',
  piel: '#e2a982', pelo: '#9a9aa2', abrigo: '#6b4a2f', detalle: '#a4512b', bufanda: '#3f6f8f',
  pantalon: '#3b3f52', botas: '#2b2420', guantes: '#a4512b', cabeza: 'gorro',
};

export function crearNpcChatarrero(): Modelo {
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);
  return crearGente(ASPECTO, ({ cabeza, pecho, manoD, puesto }) => {
    // Barba gris que le tapa la barbilla (deja ver la sonrisa).
    pieza(cabeza, esfera(0.3, 1.25, 0.75, 0.6), toon(ASPECTO.pelo), 0, 0.08, 0.27);
    // Mochila con chatarra asomando.
    pieza(pecho, barril(0.32, 0.36, 0.7, 0.12), toon('#5a4632'), 0, 0.45, -0.52);
    barra(pecho, [0.12, 0.8, -0.55], [0.32, 1.25, -0.7], 0.05, toon(PALETA.metal));
    pieza(pecho, toro(0.12, 0.04).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), -0.15, 0.95, -0.58);
    fino(() => pieza(pecho, esfera(0.08), toon(PALETA.metalHelios), -0.05, 0.86, -0.4));
    // La pieza que tiene en la mano: un engranaje.
    const pieza_ = nodo('engranaje', manoD, 0, -0.02, 0.12);
    pieza(pieza_, toro(0.09, 0.035).rotateX(Math.PI / 2), toon(PALETA.metal));
    fino(() => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        pieza(pieza_, esfera(0.03), toon(PALETA.metal), Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0, { contorno: false });
      }
    });

    // Carro de chatarra delante, con ruedas y chatarra encima.
    const carro = nodo('carro', puesto, 0.25, 0, 1.05);
    pieza(carro, caja(1.1, 0.45, 0.7, 0.08), toon('#7a5a3a'), 0, 0.5, 0);
    for (const [x, z] of [[-0.45, 0.32], [0.45, 0.32], [-0.45, -0.32], [0.45, -0.32]] as const) {
      pieza(carro, toro(0.17, 0.05).rotateZ(Math.PI / 2), toon(PALETA.oscuro), x, 0.2, z);
    }
    for (const [x, z, r, c] of [[-0.25, 0.1, 0.16, PALETA.metalHelios], [0.15, -0.1, 0.13, PALETA.metal], [0.35, 0.15, 0.1, PALETA.chapaHelios]] as const) {
      pieza(carro, esfera(r, 1, 0.8, 1), toon(c), x, 0.75 + r * 0.5, z);
    }
    barra(carro, [-0.4, 0.75, -0.2], [0.1, 1.1, 0.1], 0.04, toon(PALETA.metal));
    fino(() => pieza(carro, esfera(0.05), brillo(PALETA.purpuraBrillo), 0.15, 0.95, -0.1, { contorno: false }));
    // Balanza colgada de un poste a su izquierda.
    barra(puesto, [0.95, 0, 0.2], [0.95, 1.9, 0.2], 0.04, toon('#6b4a2f'));
    barra(puesto, [0.95, 1.85, 0.2], [0.7, 1.85, 0.45], 0.03, toon('#6b4a2f'));
    const balanza = nodo('balanza', puesto, 0.7, 1.82, 0.45);
    barra(balanza, [0, 0, 0], [0, -0.45, 0], 0.015, toon(PALETA.metalOscuro));
    pieza(balanza, barril(0.18, 0.12, 0.06, 0.02), toon(PALETA.metal), 0, -0.5, 0);
  }, ({ raiz }) => ({
    duracion: 2.4,
    descripcion: 'Saca una pieza del carro, la cuelga en la balanza, la mira entornando los ojos y la echa de vuelta al montón.',
    pistas: [
      // 0–0,5 se agacha al carro; 0,5–1,0 la sube; 1,0–1,6 la pesa; 1,6–2,4 la tira.
      rot('pecho', poses([[0, 0, 0, 0], [0.4, 22, -10, 0], [0.9, 0, 20, 0], [1.6, -4, 25, 0], [1.9, 10, -10, 0], [2.4, 0, 0, 0]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.4, -80, 0, -6], [0.9, -120, -10, -20], [1.6, -120, -10, -20], [1.9, -70, 0, -6], [2.05, -40, 0, -6], [2.4, 0, 0, -10]])),
      rot('codo_d', poses([[0, -8, 0, 0], [0.4, -10, 0, 0], [0.9, -50, 0, 0], [1.6, -50, 0, 0], [1.9, -10, 0, 0], [2.4, -8, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.4, -40, 0, 14], [0.9, -10, 0, 30], [1.6, -10, 0, 30], [2.4, 0, 0, 10]])),
      rot('codo_i', poses([[0, -8, 0, 0], [0.9, -90, 0, 0], [1.6, -90, 0, 0], [2.4, -8, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.4, 20, 0, 0], [1.0, -12, 25, 8], [1.6, -12, 25, -6], [1.9, 10, 0, 0], [2.4, 0, 0, 0]])),
      ...(['ojo_i', 'ojo_d'] as const).map((n) => esc(n, poses([[0, 1, 1, 1], [1.1, 1, 1, 1], [1.2, 1.1, 0.45, 1], [1.5, 1.1, 0.45, 1], [1.6, 1, 1, 1], [2.4, 1, 1, 1]]))),
      rot('balanza', poses([[0, 0, 0, 0], [1.0, 0, 0, 0], [1.1, 14, 0, 0], [1.3, -8, 0, 0], [1.5, 4, 0, 0], [1.7, 0, 0, 0], [2.4, 0, 0, 0]])),
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.4, 0, -0.08, 0.06], [0.9, 0, 0, 0], [1.9, 0, -0.04, 0.03], [2.4, 0, 0, 0]])),
      esc('engranaje', ciclo(2.4, () => [1, 1, 1])),
    ],
  }));
}
