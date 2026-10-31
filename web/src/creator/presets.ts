// META SPACE · FOCO 3 — 6 personajes pre-generados de respaldo.
//
// Si la API de imagen falla (o no hay clave), la demo sigue funcionando: estos
// seis héroes son datos explícitos —mapas de píxeles 16×16 revisables— con
// stats y lore fijos dentro de los rangos del contrato.

import type { HeroStats } from './stats';
import { pintarMapa } from './sprite';

export interface PresetDef {
  id: string;
  nombre: string;
  descripcion: string;
  mapa: string[];
  stats: HeroStats;
}

function statsBase(parcial: HeroStats): HeroStats {
  return parcial;
}

export const PRESETS: PresetDef[] = [
  {
    id: 'ares-clasico',
    nombre: 'Ares Clásico',
    descripcion: 'El traje naranja de los manuales. Equilibrado y fiable.',
    mapa: [
      '.....KKKKKK.....',
      '...KKWWWWWWKK...',
      '..KWWWWWWWWWWK..',
      '..KWOOOOOOOOWK..',
      '..KWOOKCCKOOWK..',
      '..KWOOOOOOOOWK..',
      '...KWWWWWWWWK...',
      '....KWWWWWWK....',
      '.....KWKKWK.....',
      '....KWWWWWWK....',
      '...KWKWWWWKWK...',
      '...KWKWWWWKWK...',
      '....KWWKKWWK....',
      '....KWK..KWK....',
      '....KWK..KWK....',
      '....KKK..KKK....',
    ],
    stats: statsBase({
      hp: 110, speed: 5.2, damage: 1.1, fire_rate: 1.0, special: 'nova-plasma',
      lore: 'El traje de los carteles de ARES-IX. Lo llevó la primera oleada y volvió andando.',
    }),
  },
  {
    id: 'ada-viva',
    nombre: 'ADA Viva',
    descripcion: 'Traje noche con visor cyan. Corre más y recarga antes.',
    mapa: [
      '.....KKKKKK.....',
      '...KKNNNNNNKK...',
      '..KNNNNNNNNNNK..',
      '..KNCCCCCCCCNK..',
      '..KNCWCCCCCCNK..',
      '..KNCCCCCCCCNK..',
      '...KNNNNNNNNK...',
      '....KNNNNNNK....',
      '.....KNCCNK.....',
      '....KNWWWWNK....',
      '...KNWWWWWWNK...',
      '...KNKWWWWKNK...',
      '....KNWKKWNK....',
      '....KNK..KNK....',
      '....KNK..KNK....',
      '....KKK..KKK....',
    ],
    stats: statsBase({
      hp: 95, speed: 5.9, damage: 0.95, fire_rate: 0.9, special: 'pulso-ada',
      lore: 'ADA se mudó al visor una noche y ya no quiso salir. Desde entonces, todo va más rápido.',
    }),
  },
  {
    id: 'bicho-chatarra',
    nombre: 'Bicho de Chatarra',
    descripcion: 'Mitad dron, mitad caparazón. Aguanta lo que le echen.',
    mapa: [
      '...G........G...',
      '...K........K...',
      '....K......K....',
      '.....KKKKKK.....',
      '...KKGGGGGGKK...',
      '..KGWKGKKGKWGK..',
      '..KGGGGGGGGGGK..',
      '...KGGGGGGGGK...',
      '..MKGGGGGGGGKM..',
      '...KGGGGGGGGK...',
      '.K.KGGGGGGGGK.K.',
      '..K.KGGGGGGK.K..',
      '....KGGGGGGK....',
      '...K.KGGGGK.K...',
      '...K..KGGK..K...',
      '...KK......KK...',
    ],
    stats: statsBase({
      hp: 140, speed: 4.6, damage: 1.0, fire_rate: 1.05, special: 'enjambre',
      lore: 'Nació en un vertedero del Sector Delta. Los Recolectores lo saludan; él no responde.',
    }),
  },
  {
    id: 'segador-domesticado',
    nombre: 'Segador Domesticado',
    descripcion: 'Una cosechadora pequeña que decidió protegerte. Pega muy fuerte.',
    mapa: [
      '.....KKKKKK.....',
      '...KKMMMMMMKK...',
      '..KMMMMMMMMMMK..',
      '..KMRMMMMMMRMK..',
      '..KMMMMMMMMMMK..',
      '..KMMKMMMMKMMK..',
      '...KMMMMMMMMK...',
      '.Y.KMMMMMMMMK.Y.',
      '..KMMMMMMMMMMK..',
      '..KMMYMMMMYMMK..',
      '...KMMMMMMMMK...',
      '.KKKMMMMMMMMKKK.',
      '.KMKMMMMMMMMKMK.',
      '.KMKMMMMMMMMKMK.',
      '.KKK........KKK.',
      '................',
    ],
    stats: statsBase({
      hp: 150, speed: 4.2, damage: 1.35, fire_rate: 1.15, special: 'caparazon',
      lore: 'Era de HELIOS hasta que ADA le enseñó un dibujo infantil. Ahora ara para ti.',
    }),
  },
  {
    id: 'baliza-errante',
    nombre: 'Baliza Errante',
    descripcion: 'Flota en vez de correr. Frágil, rapidísima, imposible de apuntar.',
    mapa: [
      '......CCCC......',
      '......CCCC......',
      '.......KK.......',
      '.....KYYYYK.....',
      '...KYYYYYYYYK...',
      '..KYDDDDDDDDYK..',
      '..KYDCDDDDCDYK..',
      '..KYDDDDDDDDYK..',
      '...KYDDDDDDYK...',
      '....KYDDDDYK....',
      '....KYDCCDYK....',
      '.....KYDDYK.....',
      '......KYYK......',
      '.......KK.......',
      '.......YY.......',
      '................',
    ],
    stats: statsBase({
      hp: 80, speed: 6.0, damage: 0.9, fire_rate: 0.85, special: 'eco-helios',
      lore: 'Una baliza que dejó de triangular y empezó a vagar. HELIOS aún la busca.',
    }),
  },
  {
    id: 'sombra-helios',
    nombre: 'Sombra de HELIOS',
    descripcion: 'Un eco violeta con filo. Daña y se mueve como un rumor.',
    mapa: [
      '.....KKKKKK.....',
      '...KKNNNNNNKK...',
      '..KNNNNNNNNNNK..',
      '..KNPPPPPPPPNK..',
      '..KNPRPPPPRPNK..',
      '..KNPPPPPPPPNK..',
      '...KNNPPPPNNK...',
      '....KNNPPNNK....',
      '.....KNNNNK.....',
      '....KNNNNNNK....',
      '...KNKNNNNKNK...',
      '...KNKNNNNKNK...',
      '....KNKNNKNK....',
      '....KNK..KNK....',
      '....KK....KK....',
      '...KKK....KKK...',
    ],
    stats: statsBase({
      hp: 120, speed: 5.5, damage: 1.2, fire_rate: 0.95, special: 'sobremarcha',
      lore: 'Nadie sabe qué parte de HELIOS se quedó aquí dentro. Mejor no preguntar.',
    }),
  },
];

/** Dibuja el preset nº `i` en un canvas de 128×128 y lo devuelve. */
export function presetALienzo(i: number): HTMLCanvasElement {
  const p = PRESETS[i];
  if (!p) throw new Error(`Preset desconocido: ${i}`);
  return pintarMapa(p.mapa);
}

/** PNG (dataURL) del preset nº `i`. */
export function presetAPng(i: number): string {
  return presetALienzo(i).toDataURL('image/png');
}
