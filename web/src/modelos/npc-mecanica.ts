import {
  PALETA, barra, barril, brillo, caja, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, punta, rot, toon, toro,
  type Modelo,
} from './kit.ts';
import { crearGente, type Aspecto } from './gente.ts';

// Iris Calden, la mecánica del refugio: casco con linterna, gafas de taller
// en la frente, abrigo verde azulado y una llave inglesa enorme. Su puesto es
// un generador averiado que golpea hasta que arranca: saltan chispas y la
// bombilla parpadea. Mira hacia +z, hacia el generador.

const ASPECTO: Aspecto = {
  id: 'npc-mecanica', nombre: 'Iris, la mecánica', rol: 'Gente de Meta · repara lo que traigas',
  piel: '#c98a64', pelo: '#2b1d16', abrigo: '#2f7a78', detalle: '#e0a83a', bufanda: '#b5533c',
  pantalon: '#3b3f52', botas: '#2b2420', guantes: '#c9893f', cabeza: 'casco', gafas: true,
};

export function crearNpcMecanica(): Modelo {
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);
  return crearGente(ASPECTO, ({ manoD, pecho, puesto }) => {
    // Llave inglesa en la mano derecha, apuntando hacia delante.
    const llave = nodo('llave', manoD, 0, -0.02, 0.05);
    barra(llave, [0, 0, 0], [0, -0.05, 0.5], 0.06, toon(PALETA.metal));
    pieza(llave, caja(0.32, 0.11, 0.2, 0.04), toon(PALETA.metal), 0, -0.06, 0.6);
    pieza(llave, caja(0.12, 0.12, 0.12, 0.03), toon(PALETA.metalOscuro), 0.08, -0.06, 0.72);
    // Cinturón de herramientas.
    fino(() => {
      for (const x of [-0.25, 0.25]) pieza(pecho, caja(0.14, 0.18, 0.1, 0.03), toon('#6b4a2f'), x, 0.2, 0.42);
    });

    // El generador averiado, delante.
    const generador = nodo('generador', puesto, 0.1, 0, 1.15);
    pieza(generador, caja(1.0, 0.25, 0.7, 0.08), toon(PALETA.metalOscuro), 0, 0.12, 0);
    pieza(generador, barril(0.36, 0.36, 0.7, 0.1).rotateZ(Math.PI / 2), toon('#7d8597'), 0, 0.55, 0);
    pieza(generador, toro(0.37, 0.04).rotateZ(Math.PI / 2), toon(PALETA.oscuro), 0.2, 0.55, 0);
    pieza(generador, toro(0.37, 0.04).rotateZ(Math.PI / 2), toon(PALETA.oscuro), -0.2, 0.55, 0);
    barra(generador, [-0.3, 0.8, -0.15], [-0.32, 1.25, -0.18], 0.06, toon(PALETA.oscuro));
    pieza(generador, caja(0.3, 0.22, 0.06, 0.03), toon(PALETA.oscuro), 0.15, 0.55, 0.37);
    fino(() => pieza(generador, esfera(0.04), brillo(PALETA.ada), 0.08, 0.58, 0.41, { contorno: false }));
    // Bombilla en un poste: parpadea cuando el generador tose.
    barra(puesto, [-0.75, 0, 1.0], [-0.75, 1.5, 1.0], 0.04, toon(PALETA.oscuro));
    const bombilla = nodo('bombilla', puesto, -0.75, 1.58, 1.0);
    fino(() => pieza(bombilla, esfera(0.11), brillo(PALETA.plasma), 0, 0, 0, { contorno: false }));
    // Chispas del golpe.
    const chispas = nodo('chispas', puesto, 0.05, 0.75, 0.82);
    fino(() => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const c = pieza(chispas, punta(0.03, 0.22), brillo(PALETA.plasma), Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0, { contorno: false, sombra: false });
        c.rotation.z = -a;
      }
    });
    chispas.scale.setScalar(0.001);
  }, ({ raiz }) => ({
    duracion: 1.6,
    descripcion: 'Golpea el generador dos veces con la llave inglesa: saltan chispas, el generador tose y la bombilla parpadea.',
    pistas: [
      rot('pecho', poses([[0, 8, 0, 0], [0.3, 0, 0, 6], [0.45, 18, 0, -2], [0.6, 12, 0, 0], [0.9, 0, 0, 6], [1.05, 18, 0, -2], [1.2, 12, 0, 0], [1.6, 8, 0, 0]])),
      rot('hombro_d', poses([[0, -60, 0, -10], [0.3, -160, 0, -14], [0.45, -72, 0, -8], [0.6, -78, 0, -8], [0.9, -160, 0, -14], [1.05, -72, 0, -8], [1.2, -78, 0, -8], [1.6, -60, 0, -10]])),
      rot('codo_d', poses([[0, -40, 0, 0], [0.3, -70, 0, 0], [0.45, -5, 0, 0], [0.6, -15, 0, 0], [0.9, -70, 0, 0], [1.05, -5, 0, 0], [1.2, -15, 0, 0], [1.6, -40, 0, 0]])),
      rot('hombro_i', ciclo(1.6, () => [-55, 0, 18])),
      rot('codo_i', ciclo(1.6, () => [-30, 0, 0])),
      rot('cabeza', poses([[0, 14, 0, 0], [0.3, 6, 0, 0], [0.45, 18, 0, 0], [0.9, 6, 0, 0], [1.05, 18, 0, 0], [1.6, 14, 0, 0]])),
      mov(raiz, 'cadera', ciclo(1.6, () => [0, -0.06, 0.04])),
      esc('chispas', poses([[0, 0.001, 0.001, 0.001], [0.44, 0.001, 0.001, 0.001], [0.47, 1.2, 1.2, 1.2], [0.62, 0.001, 0.001, 0.001], [1.04, 0.001, 0.001, 0.001], [1.07, 1.3, 1.3, 1.3], [1.22, 0.001, 0.001, 0.001], [1.6, 0.001, 0.001, 0.001]])),
      esc('bombilla', ciclo(1.6, (f) => { const t = f * 1.6; const k = (t > 0.47 && t < 0.6) || (t > 1.07 && t < 1.15) || (t > 1.25 && t < 1.32) ? 0.25 : 1; return [k, k, k]; })),
      rot('generador', poses([[0, 0, 0, 0], [0.45, 0, 0, 0], [0.5, 0, 0, 3], [0.6, 0, 0, -2], [0.7, 0, 0, 0], [1.05, 0, 0, 0], [1.1, 0, 0, 3], [1.2, 0, 0, -2], [1.3, 0, 0, 0], [1.6, 0, 0, 0]])),
    ],
  }));
}
