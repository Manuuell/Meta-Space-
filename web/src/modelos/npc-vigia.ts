import {
  PALETA, barra, barril, brillo, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, rot, toon, toro,
  type Modelo,
} from './kit.ts';
import { crearGente, type Aspecto } from './gente.ts';

// Tali Noor, la vigía: capucha con ribete de piel, abrigo verde oliva,
// bufanda mostaza y unos prismáticos. Su puesto es un catalejo sobre un
// trípode y un banderín con un sol: barre el horizonte con los prismáticos y
// señala dónde se mueve algo. Sabe dónde está cada altar, cada caja y cada
// jefe. Mira hacia +z.

const ASPECTO: Aspecto = {
  id: 'npc-vigia', nombre: 'Tali, la vigía', rol: 'Gente de Meta · sabe dónde está todo',
  piel: '#f0c6a0', pelo: '#7a3b1e', abrigo: '#5f6b3a', detalle: '#3e4426', bufanda: '#d9a441',
  pantalon: '#4a3b2e', botas: '#2b2420', guantes: '#3e4426', cabeza: 'capucha',
};

export function crearNpcVigia(): Modelo {
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);
  return crearGente(ASPECTO, ({ manoD, puesto }) => {
    // Prismáticos en la mano derecha.
    const prismaticos = nodo('prismaticos', manoD, -0.02, 0.02, 0.12);
    for (const x of [-0.07, 0.07]) {
      pieza(prismaticos, capsula(0.055, 0.12).rotateX(Math.PI / 2), toon(PALETA.oscuro), x, 0, 0);
      fino(() => pieza(prismaticos, esfera(0.045, 1, 1, 0.3), brillo(PALETA.ada), x, 0, 0.12, { contorno: false }));
    }

    // Catalejo sobre trípode, a su derecha y un poco por delante.
    const tripode = nodo('tripode', puesto, -0.85, 0, 0.6);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      barra(tripode, [Math.sin(a) * 0.35, 0.02, Math.cos(a) * 0.35], [0, 1.25, 0], 0.035, toon('#6b4a2f'));
    }
    const catalejo = nodo('catalejo', tripode, 0, 1.3, 0);
    pieza(catalejo, barril(0.1, 0.14, 0.75, 0.04).rotateX(Math.PI / 2), toon(PALETA.metal), 0, 0.05, 0.1);
    pieza(catalejo, toro(0.14, 0.03).rotateX(Math.PI / 2), toon(PALETA.arena), 0, 0.05, 0.46);
    // Banderín con un sol, a su izquierda.
    barra(puesto, [0.9, 0, -0.2], [0.9, 2.3, -0.2], 0.035, toon('#6b4a2f'));
    const bandera = nodo('bandera', puesto, 0.9, 2.1, -0.2);
    pieza(bandera, capsula(0.03, 0.5).rotateZ(Math.PI / 2).scale(1, 9, 0.3), toon('#3f6f8f'), 0.3, -0.1, 0);
    fino(() => pieza(bandera, esfera(0.1, 1, 1, 0.3), brillo(PALETA.arena), 0.3, -0.1, 0.03, { contorno: false }));
    // Su señal: una luz que guiña cuando ve algo.
    const aviso = nodo('aviso', puesto, 0.9, 2.38, -0.2);
    fino(() => pieza(aviso, esfera(0.07), brillo(PALETA.plasma), 0, 0, 0, { contorno: false }));
  }, ({ raiz }) => ({
    duracion: 3.2,
    descripcion: 'Mira el horizonte con los prismáticos barriendo de lado a lado, los baja, señala hacia su izquierda y vuelve a mirar.',
    pistas: [
      // 0–1,6 s: prismáticos a los ojos y barrido; 1,8–2,6 s: baja y señala.
      rot('hombro_d', poses([[0, -150, 0, 30], [1.6, -150, 0, 30], [1.85, -40, 0, -12], [2.0, -95, -20, -60], [2.6, -95, -20, -60], [2.9, -150, 0, 30], [3.2, -150, 0, 30]])),
      rot('codo_d', poses([[0, -40, 0, 0], [1.6, -40, 0, 0], [1.85, -20, 0, 0], [2.0, -5, 0, 0], [2.6, -5, 0, 0], [2.9, -40, 0, 0], [3.2, -40, 0, 0]])),
      rot('hombro_i', poses([[0, -150, 0, -30], [1.6, -150, 0, -30], [1.85, -20, 0, 12], [2.6, -20, 0, 12], [2.9, -150, 0, -30], [3.2, -150, 0, -30]])),
      rot('codo_i', poses([[0, -40, 0, 0], [1.6, -40, 0, 0], [1.85, -20, 0, 0], [2.6, -20, 0, 0], [2.9, -40, 0, 0], [3.2, -40, 0, 0]])),
      rot('pecho', poses([[0, -4, -18, 0], [0.8, -4, 18, 0], [1.6, -4, -18, 0], [2.0, 0, 25, 0], [2.6, 0, 25, 0], [3.2, -4, -18, 0]])),
      rot('cabeza', poses([[0, -6, -10, 0], [0.8, -6, 10, 0], [1.6, -6, -10, 0], [2.0, 0, 30, 6], [2.6, 0, 30, 6], [3.2, -6, -10, 0]])),
      esc('boca', poses([[0, 1, 0.12, 1], [2.0, 1, 0.12, 1], [2.1, 1.1, 0.7, 1], [2.5, 1.1, 0.5, 1], [2.6, 1, 0.12, 1], [3.2, 1, 0.12, 1]])),
      rot('catalejo', ciclo(3.2, (f) => [4 + Math.sin(f * Math.PI * 2 * 2) * 3, Math.sin(f * Math.PI * 2) * 25, 0])),
      rot('bandera', ciclo(3.2, (f) => [0, Math.sin(f * Math.PI * 2 * 4) * 12, Math.sin(f * Math.PI * 2 * 4 + 1) * 4])),
      esc('aviso', ciclo(3.2, (f) => { const t = f * 3.2; const k = t > 1.9 && t < 2.6 && Math.floor(t * 8) % 2 === 0 ? 1.6 : 0.6; return [k, k, k]; })),
      mov(raiz, 'cadera', ciclo(3.2, (f) => [0, Math.sin(f * Math.PI * 2 * 2) * 0.01, 0])),
    ],
  }));
}
