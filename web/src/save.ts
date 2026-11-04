import { DEFAULT_PROFILE } from './profile/profile-data';
import type { PersonajeId } from './personajes.ts';

// Progreso entre partidas, en localStorage. Puede no estar disponible (modo
// privado, almacenamiento bloqueado): el juego tiene que funcionar igual.

export interface Save {
  bestTime: number;
  bestKills: number;
  bestScore: number;
  runs: number;
  scrapBank: number;      // chatarra acumulada para el banco de trabajo
  relics: string[];       // reliquias del Códice
  killsByType: Record<string, number>;
  profileId: string;
  profileName: string;
  profileFrame: string;
  profileTitle: string;
  profileBackdrop: string;
  /** Compañero elegido (id de `companeros.ts`). */
  companero?: string;
  /** Estilo de Bruno: gorra, gafas y pajarita. */
  estiloBruno?: { pajarita: 'cuadros' | 'verde' | null; gorra: boolean; gafas: boolean };
  /** Operador jugable elegido en el título. */
  personaje?: PersonajeId;
  /** La nave: fragmentos, piezas fabricadas y montadas (ver nave/piezas.ts). */
  hangar?: unknown;
}

const KEY = 'meta-space.save.v1';

const EMPTY: Save = {
  bestTime: 0, bestKills: 0, bestScore: 0, runs: 0, scrapBank: 0, relics: [], killsByType: {},
  ...DEFAULT_PROFILE,
  personaje: 'especialista',
};

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // Sin almacenamiento: se juega con un guardado vacío.
  }
  return structuredClone(EMPTY);
}

export function writeSave(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Igual que al cargar: si no se puede guardar, no es motivo para romper.
  }
}
