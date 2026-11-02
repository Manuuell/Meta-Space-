import {
  PALETA, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, rot, toon,
  toro, type Modelo,
} from './kit.ts';
import { crearGente, type Aspecto } from './gente.ts';

// Lis Amaro, la botánica: melena oscura, abrigo granate con ribete crema y
// un vial que brilla. Su puesto es la última planta viva del sector, bajo una
// campana de cristal con una lámpara de calor, y su maletín de muestras: se
// arrodilla, toma una muestra, la mira a contraluz y la guarda. Conoce las
// reliquias y lo que se sabía antes del velo. Mira hacia +z.

const ASPECTO: Aspecto = {
  id: 'npc-botanica', nombre: 'Lis, la botánica', rol: 'Gente de Meta · conoce las reliquias',
  piel: '#8c5a3c', pelo: '#1a1210', abrigo: '#7a2e3a', detalle: '#d9c08a', bufanda: '#4f8a57',
  pantalon: '#3a3550', botas: '#3a2a22', guantes: '#4f8a57', cabeza: 'melena',
};

const HOJA = '#5fae5a';

export function crearNpcBotanica(): Modelo {
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);
  return crearGente(ASPECTO, ({ manoD, puesto }) => {
    // Vial de muestras en la mano derecha.
    const vial = nodo('vial', manoD, 0, 0.1, 0.06);
    pieza(vial, capsula(0.045, 0.14), brillo(PALETA.ada), 0, 0.06, 0, { contorno: true });
    pieza(vial, barril(0.05, 0.05, 0.05, 0.015), toon(PALETA.metalOscuro), 0, 0.17, 0);

    // La planta bajo su campana, delante: maceta, tallo, hojas y lámpara.
    const planta = nodo('planta', puesto, 0, 0, 1.05);
    pieza(planta, barril(0.26, 0.2, 0.3, 0.06), toon('#8a5a3c'), 0, 0.15, 0);
    pieza(planta, toro(0.26, 0.04), toon('#6b4430'), 0, 0.3, 0);
    barra(planta, [0, 0.3, 0], [0.02, 0.62, 0], 0.025, toon('#3f7a3c'));
    const hojas = nodo('hojas', planta, 0.02, 0.6, 0);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const h = pieza(hojas, esfera(0.09, 0.5, 0.18, 1.2), toon(HOJA), Math.sin(a) * 0.08, 0.02 * k, Math.cos(a) * 0.08);
      h.rotation.set(0.5, a, 0);
    }
    fino(() => pieza(hojas, esfera(0.05), brillo(PALETA.arena), 0, 0.16, 0, { contorno: false }));
    // Campana de cristal (solo el armazón, para que se vea la planta) y lámpara.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      barra(planta, [Math.sin(a) * 0.32, 0.3, Math.cos(a) * 0.32], [Math.sin(a) * 0.12, 0.98, Math.cos(a) * 0.12], 0.02, toon(PALETA.metal));
    }
    pieza(planta, toro(0.33, 0.03), toon(PALETA.metal), 0, 0.31, 0);
    const lampara = nodo('lampara', planta, 0, 1.02, 0);
    pieza(lampara, barril(0.08, 0.16, 0.1, 0.03), toon(PALETA.metalOscuro));
    fino(() => pieza(lampara, esfera(0.08, 1, 0.5, 1), brillo(PALETA.plasma), 0, -0.05, 0, { contorno: false }));

    // Maletín de muestras abierto a su izquierda, con viales.
    const maletin = nodo('maletin', puesto, 0.75, 0, 0.55);
    maletin.rotation.y = -0.5;
    pieza(maletin, caja(0.6, 0.2, 0.4, 0.05), toon('#6b4a2f'), 0, 0.1, 0);
    const tapa = pieza(maletin, caja(0.6, 0.05, 0.4, 0.02), toon('#6b4a2f'), 0, 0.3, -0.25);
    tapa.rotation.x = -1.2;
    fino(() => {
      for (const [x, c] of [[-0.18, PALETA.ada], [-0.06, HOJA], [0.06, PALETA.plasma], [0.18, PALETA.ada]] as const) {
        pieza(maletin, capsula(0.035, 0.08), brillo(c), x, 0.24, 0.02, { contorno: false });
      }
    });
  }, ({ raiz }) => ({
    duracion: 3.0,
    descripcion: 'Se arrodilla junto a la planta, toma una muestra con el vial, se levanta, la mira a contraluz y la guarda.',
    pistas: [
      // 0–0,5 baja; 0,5–1,3 toma la muestra; 1,3–1,7 sube; 1,7–2,5 la mira; 2,5–3 vuelve.
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.5, 0, -0.32, 0.12], [1.3, 0, -0.32, 0.12], [1.7, 0, 0, 0], [3.0, 0, 0, 0]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.5, -70, 0, 0], [1.3, -70, 0, 0], [1.7, 0, 0, 0], [3.0, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.5, 20, 0, 0], [1.3, 20, 0, 0], [1.7, 0, 0, 0], [3.0, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.5, 25, 0, 0], [1.3, 25, 0, 0], [1.7, -4, 0, 0], [2.5, -4, 0, 0], [3.0, 0, 0, 0]])),
      rot('hombro_d', poses([[0, 0, 0, -10], [0.5, -60, 0, -6], [0.8, -45, 0, -2], [1.0, -55, 0, -2], [1.3, -60, 0, -6], [1.8, -140, 0, -20], [2.5, -140, 0, -20], [3.0, 0, 0, -10]])),
      rot('codo_d', poses([[0, -8, 0, 0], [0.5, -20, 0, 0], [1.3, -20, 0, 0], [1.8, -60, 0, 0], [2.5, -60, 0, 0], [3.0, -8, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, 10], [0.5, -40, 0, 14], [1.3, -40, 0, 14], [1.7, 0, 0, 12], [3.0, 0, 0, 10]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.5, 20, 0, 0], [1.3, 20, 0, 0], [1.8, -25, 0, 10], [2.5, -25, 0, -6], [3.0, 0, 0, 0]])),
      rot('hojas', ciclo(3, (f) => [Math.sin(f * Math.PI * 2 * 2) * 4, Math.sin(f * Math.PI * 2) * 15, 0])),
      esc('lampara', ciclo(3, (f) => { const k = 1 + 0.06 * Math.sin(f * Math.PI * 2 * 3); return [k, k, k]; })),
      esc('vial', poses([[0, 1, 1, 1], [1.0, 1, 1, 1], [1.1, 1.3, 1.3, 1.3], [1.3, 1, 1, 1], [2.0, 1.15, 1.15, 1.15], [2.5, 1, 1, 1], [3.0, 1, 1, 1]])),
      mov(raiz, 'ceja_i', poses([[0, 0, 0, 0], [1.8, 0, 0.04, 0], [2.5, 0, 0.04, 0], [3.0, 0, 0, 0]])),
      mov(raiz, 'ceja_d', poses([[0, 0, 0, 0], [1.8, 0, 0.04, 0], [2.5, 0, 0.04, 0], [3.0, 0, 0, 0]])),
    ],
  }));
}
