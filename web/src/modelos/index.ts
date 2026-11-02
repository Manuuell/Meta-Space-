import { crearAltarDesafio } from './altar-desafio.ts';
import { crearAltarJefe } from './altar-jefe.ts';
import { crearAstronauta } from './astronauta.ts';
import { crearAvispa } from './avispa.ts';
import { crearAdaDron, crearAdaMedusa, crearAdaNoa, crearAdaOrbe, crearAdaZorro } from './ada.ts';
import { crearBaliza } from './baliza.ts';
import { crearCaja } from './caja-premio.ts';
import { crearCaparazon } from './caparazon.ts';
import { crearAerotabla, crearAstronautaEquipado, crearBotasImpulso, crearMochilaCohete } from './equipo.ts';
import { crearHeraldo } from './heraldo.ts';
import { crearNave, crearNavePosada } from './nave.ts';
import { crearNpcBotanica } from './npc-botanica.ts';
import { crearNpcChatarrero } from './npc-chatarrero.ts';
import { crearNpcMecanica } from './npc-mecanica.ts';
import { crearNpcVigia } from './npc-vigia.ts';
import { crearOjoHelios } from './ojo-helios.ts';
import { crearBrunoPajarita, crearBrunoPaseo } from './perro.ts';
import { crearRecolector } from './recolector.ts';
import { crearRefugio } from './refugio.ts';
import { crearSaltador } from './saltador.ts';
import { crearSegador } from './segador.ts';
import { crearSegadorJefe } from './segador-jefe.ts';
import { crearSembrador } from './sembrador.ts';
import { crearTorreVelo } from './torre-velo.ts';
import type { Modelo } from './kit.ts';

export type { Animacion, Modelo } from './kit.ts';

/** Categoría visual y presupuesto que usan el visor y las pruebas de modelos. */
export type Tipo =
  | 'jugador'
  | 'horda'
  | 'jefe'
  | 'companero'
  | 'equipo'
  | 'npc'
  | 'mapa'
  | 'objeto'
  | 'escena';

/** Todo lo modelado, conservando compañeros y equipo de main-ygerl4. */
export const CATALOGO: { id: string; nombre: string; tipo: Tipo; crear: () => Modelo }[] = [
  { id: 'astronauta', nombre: 'Especialista de ARES-IX', tipo: 'jugador', crear: crearAstronauta },
  { id: 'recolector', nombre: 'Recolector', tipo: 'horda', crear: crearRecolector },
  { id: 'baliza', nombre: 'Baliza', tipo: 'horda', crear: crearBaliza },
  { id: 'segador', nombre: 'Segador', tipo: 'horda', crear: crearSegador },
  { id: 'saltador', nombre: 'Saltador', tipo: 'horda', crear: crearSaltador },
  { id: 'avispa', nombre: 'Avispa', tipo: 'horda', crear: crearAvispa },
  { id: 'caparazon', nombre: 'Caparazón', tipo: 'horda', crear: crearCaparazon },
  { id: 'sembrador', nombre: 'Sembrador', tipo: 'horda', crear: crearSembrador },
  { id: 'segador-jefe', nombre: 'Segador, Jefe de Cosecha', tipo: 'jefe', crear: crearSegadorJefe },
  { id: 'heraldo', nombre: 'Heraldo del Velo', tipo: 'jefe', crear: crearHeraldo },
  { id: 'ojo-helios', nombre: 'Ojo de HELIOS', tipo: 'jefe', crear: crearOjoHelios },
  { id: 'mochila-cohete', nombre: 'Mochila cohete', tipo: 'equipo', crear: crearMochilaCohete },
  { id: 'botas-impulso', nombre: 'Botas de impulso', tipo: 'equipo', crear: crearBotasImpulso },
  { id: 'aerotabla', nombre: 'Aerotabla', tipo: 'equipo', crear: crearAerotabla },
  { id: 'astronauta-equipado', nombre: 'Especialista equipado', tipo: 'equipo', crear: crearAstronautaEquipado },
  { id: 'bruno', nombre: 'Bruno · con pajarita', tipo: 'companero', crear: crearBrunoPajarita },
  { id: 'bruno-paseo', nombre: 'Bruno · gorra y gafas', tipo: 'companero', crear: crearBrunoPaseo },
  { id: 'ada-dron', nombre: 'ADA · Dron', tipo: 'companero', crear: crearAdaDron },
  { id: 'ada-zorro', nombre: 'ADA · Zorro de escarcha', tipo: 'companero', crear: crearAdaZorro },
  { id: 'ada-noa', nombre: 'ADA · Holograma de Noa', tipo: 'companero', crear: crearAdaNoa },
  { id: 'ada-medusa', nombre: 'ADA · Medusa de plasma', tipo: 'companero', crear: crearAdaMedusa },
  { id: 'ada-orbe', nombre: 'ADA · Orbe con anillos', tipo: 'companero', crear: crearAdaOrbe },
  { id: 'npc-mecanica', nombre: 'Iris, la mecánica', tipo: 'npc', crear: crearNpcMecanica },
  { id: 'npc-vigia', nombre: 'Tali, la vigía', tipo: 'npc', crear: crearNpcVigia },
  { id: 'npc-botanica', nombre: 'Lis, la botánica', tipo: 'npc', crear: crearNpcBotanica },
  { id: 'npc-chatarrero', nombre: 'Bruno, el chatarrero', tipo: 'npc', crear: crearNpcChatarrero },
  { id: 'altar-cosecha', nombre: 'Altar de la Cosecha', tipo: 'mapa', crear: () => crearAltarJefe('cosecha') },
  { id: 'altar-heraldo', nombre: 'Altar del Velo', tipo: 'mapa', crear: () => crearAltarJefe('heraldo') },
  { id: 'altar-ojo', nombre: 'Altar del Ojo', tipo: 'mapa', crear: () => crearAltarJefe('ojo') },
  { id: 'altar-desafio', nombre: 'Ara del Sol', tipo: 'mapa', crear: crearAltarDesafio },
  { id: 'caja-suministros', nombre: 'Caja de suministros', tipo: 'objeto', crear: () => crearCaja('suministros') },
  { id: 'caja-helios', nombre: 'Cofre de HELIOS', tipo: 'objeto', crear: () => crearCaja('helios') },
  { id: 'caja-reliquia', nombre: 'Cofre de reliquia', tipo: 'objeto', crear: () => crearCaja('reliquia') },
  { id: 'torre-velo', nombre: 'Torre del Velo', tipo: 'mapa', crear: crearTorreVelo },
  { id: 'refugio', nombre: 'Refugio', tipo: 'mapa', crear: crearRefugio },
  { id: 'nave', nombre: 'Nave de ARES-IX', tipo: 'escena', crear: crearNave },
  { id: 'nave-posada', nombre: 'Nave de ARES-IX (posada)', tipo: 'mapa', crear: crearNavePosada },
];
