import type { WeaponId } from './data.ts';

// Datos puros: el selector y las pruebas pueden leerlos en Node sin cargar THREE.
export type PersonajeId = 'especialista' | 'mara-ilyin' | 'idris-okafor' | 'noa-herrera' | 'taro-sato' | 'amara-keita';

export interface PersonajeDef {
  id: PersonajeId;
  nombre: string;
  rol: string;
  retrato: string;
  color: string;
  modelo: string;
  stats: { maxHp: number; speed: number; damageMul: number; cooldownMul: number };
  armaInicial: WeaponId;
  habilidad: { id: string; nombre: string; texto: string; recarga: number } | null;
  pasiva: { id: string; nombre: string; texto: string } | null;
}

export const PERSONAJES: readonly PersonajeDef[] = [
  {
    id: 'especialista', nombre: 'Especialista de ARES-IX', rol: 'Especialista',
    retrato: '/art/profiles/sol-vega.webp', color: '#ff8a3d', modelo: 'astronauta',
    stats: { maxHp: 100, speed: 5.4, damageMul: 1, cooldownMul: 1 }, armaInicial: 'cortador',
    habilidad: null, pasiva: null,
  },
  {
    id: 'mara-ilyin', nombre: 'Mara Ilyin', rol: 'Ingeniera de sistemas',
    retrato: '/art/profiles/mara-ilyin.webp', color: '#7566f5', modelo: 'mara',
    stats: { maxHp: 95, speed: 5.2, damageMul: 1, cooldownMul: 0.92 }, armaInicial: 'torreta',
    habilidad: { id: 'sobrecarga-red', nombre: 'Sobrecarga de red', texto: 'Durante 6 s acelera las herramientas, duplica las torretas y despliega una extra.', recarga: 25 },
    pasiva: { id: 'presupuesto-ajustado', nombre: 'Presupuesto ajustado', texto: 'Los cofres de HELIOS cuestan un 20 % menos.' },
  },
  {
    id: 'idris-okafor', nombre: 'Idris Okafor', rol: 'Mecánico de campo',
    retrato: '/art/profiles/idris-okafor.webp', color: '#ffad35', modelo: 'idris',
    stats: { maxHp: 140, speed: 4.8, damageMul: 1.05, cooldownMul: 1.05 }, armaInicial: 'martillo',
    habilidad: { id: 'muro-chatarra', nombre: 'Muro de chatarra', texto: 'Levanta un semicírculo que detiene la horda y estalla al terminar.', recarga: 22 },
    pasiva: { id: 'blindado', nombre: 'Blindado', texto: 'Recibe un 15 % menos de daño y la mitad de empuje.' },
  },
  {
    id: 'noa-herrera', nombre: 'Noa Herrera', rol: 'Auditora de HELIOS',
    retrato: '/art/profiles/noa-herrera.webp', color: '#e151a5', modelo: 'noa',
    stats: { maxHp: 80, speed: 5.4, damageMul: 1.2, cooldownMul: 0.95 }, armaInicial: 'sello',
    habilidad: { id: 'orden-apagado', nombre: 'Orden de apagado', texto: 'Aturde a HELIOS y hace estallar todas las marcas de auditoría.', recarga: 28 },
    pasiva: { id: 'auditora', nombre: 'Auditora', texto: '+5 % de crítico; sus críticos hacen ×2,5.' },
  },
  {
    id: 'taro-sato', nombre: 'Taro Sato', rol: 'Explorador de señales',
    retrato: '/art/profiles/taro-sato.webp', color: '#9bdc3c', modelo: 'taro',
    stats: { maxHp: 85, speed: 6.2, damageMul: 0.95, cooldownMul: 0.95 }, armaInicial: 'bumeran',
    habilidad: { id: 'salto-senal', nombre: 'Salto de señal', texto: 'Salta 12 m y deja un eco que atrae a la horda antes de estallar.', recarga: 14 },
    pasiva: { id: 'explorador', nombre: 'Explorador', texto: 'Descubre el mapa al doble de distancia y corre un 10 % más.' },
  },
  {
    id: 'amara-keita', nombre: 'Amara Keita', rol: 'Botánica planetaria',
    retrato: '/art/profiles/amara-keita.webp', color: '#53cc8c', modelo: 'amara',
    stats: { maxHp: 115, speed: 5, damageMul: 0.95, cooldownMul: 1 }, armaInicial: 'semillas',
    habilidad: { id: 'jardin-sol', nombre: 'Jardín de sol', texto: 'Un jardín que cura y frena y daña a la horda durante 8 s.', recarga: 26 },
    pasiva: { id: 'botanica', nombre: 'Botánica', texto: 'Carga pilones un 30 % más rápido y repara 0,5 de vida por segundo.' },
  },
] as const;

export const PERSONAJE_POR_ID = Object.fromEntries(PERSONAJES.map((p) => [p.id, p])) as Record<PersonajeId, PersonajeDef>;

export function personaje(id: string | undefined): PersonajeDef {
  return PERSONAJE_POR_ID[id as PersonajeId] ?? PERSONAJE_POR_ID.especialista;
}
