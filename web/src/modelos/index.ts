import { crearAstronauta } from './astronauta';
import { crearBaliza } from './baliza';
import { crearAerotabla, crearAstronautaEquipado, crearBotasImpulso, crearMochilaCohete } from './equipo';
import { crearRecolector } from './recolector';
import type { Modelo } from './kit';

export type { Animacion, Modelo } from './kit';

/** Todos los personajes modelados, en el orden del visor. */
export const CATALOGO: { id: string; nombre: string; crear: () => Modelo }[] = [
  { id: 'astronauta', nombre: 'Especialista de ARES-IX', crear: crearAstronauta },
  { id: 'recolector', nombre: 'Recolector', crear: crearRecolector },
  { id: 'baliza', nombre: 'Baliza', crear: crearBaliza },
  { id: 'mochila-cohete', nombre: 'Mochila cohete', crear: crearMochilaCohete },
  { id: 'botas-impulso', nombre: 'Botas de impulso', crear: crearBotasImpulso },
  { id: 'aerotabla', nombre: 'Aerotabla', crear: crearAerotabla },
  { id: 'astronauta-equipado', nombre: 'Especialista equipado', crear: crearAstronautaEquipado },
];
