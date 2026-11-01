import { crearAstronauta } from './astronauta';
import { crearBaliza } from './baliza';
import { crearRecolector } from './recolector';
import type { Modelo } from './kit';

export type { Animacion, Modelo } from './kit';

/** Todos los personajes modelados, en el orden del visor. */
export const CATALOGO: { id: string; nombre: string; crear: () => Modelo }[] = [
  { id: 'astronauta', nombre: 'Especialista de ARES-IX', crear: crearAstronauta },
  { id: 'recolector', nombre: 'Recolector', crear: crearRecolector },
  { id: 'baliza', nombre: 'Baliza', crear: crearBaliza },
];
