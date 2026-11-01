import { crearAstronauta } from './astronauta';
import { crearAdaDron, crearAdaMedusa, crearAdaNoa, crearAdaOrbe, crearAdaZorro } from './ada';
import { crearBaliza } from './baliza';
import { crearBrunoPajarita, crearBrunoPaseo } from './perro';
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
  { id: 'bruno', nombre: 'Bruno · con pajarita', crear: crearBrunoPajarita },
  { id: 'bruno-paseo', nombre: 'Bruno · gorra y gafas', crear: crearBrunoPaseo },
  { id: 'ada-dron', nombre: 'ADA · Dron', crear: crearAdaDron },
  { id: 'ada-zorro', nombre: 'ADA · Zorro de escarcha', crear: crearAdaZorro },
  { id: 'ada-noa', nombre: 'ADA · Holograma de Noa', crear: crearAdaNoa },
  { id: 'ada-medusa', nombre: 'ADA · Medusa de plasma', crear: crearAdaMedusa },
  { id: 'ada-orbe', nombre: 'ADA · Orbe con anillos', crear: crearAdaOrbe },
  { id: 'astronauta-equipado', nombre: 'Especialista equipado', crear: crearAstronautaEquipado },
];
