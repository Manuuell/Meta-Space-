import { PERSONAJE_POR_ID, type PersonajeDef } from '../personajes.ts';
import type { Receta } from './receta.ts';

// META SPACE — Lo que un héroe creado es para el juego. Hereda el oficio de un
// operador (arma inicial, habilidad y pasiva), así que todo lo que el juego sabe
// hacer con ellos le sirve sin más. La silueta ajusta sus números: lo que se gana en
// aguante se pierde en velocidad, y al revés.

const AJUSTE: Record<Receta['silueta'], { vida: number; velocidad: number; dano: number; recarga: number }> = {
  recio: { vida: 15, velocidad: -0.2, dano: 0.05, recarga: 0 },
  esbelto: { vida: -10, velocidad: 0.3, dano: 0, recarga: -0.03 },
  bajito: { vida: -15, velocidad: 0.45, dano: -0.03, recarga: -0.02 },
  gigante: { vida: 30, velocidad: -0.5, dano: 0.08, recarga: 0.03 },
  redondo: { vida: 20, velocidad: -0.25, dano: 0, recarga: -0.02 },
  atletico: { vida: 0, velocidad: 0.15, dano: 0.02, recarga: 0 },
};

/** El personaje que entra en la partida. `retrato` es la foto del modelo 3D. */
export function fichaHeroe(r: Receta, retrato: string): PersonajeDef {
  const base = PERSONAJE_POR_ID[r.oficio], a = AJUSTE[r.silueta], s = base.stats;
  return {
    ...base,
    nombre: r.nombre,
    rol: base.rol,
    retrato,
    color: r.colores.principal,
    modelo: 'heroe',
    stats: {
      maxHp: s.maxHp + a.vida,
      speed: Math.round((s.speed + a.velocidad) * 100) / 100,
      damageMul: Math.round((s.damageMul + a.dano) * 100) / 100,
      cooldownMul: Math.round((s.cooldownMul + a.recarga) * 100) / 100,
    },
  };
}
