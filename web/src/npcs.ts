// META SPACE — NPCs con IA (Muse Spark vía creator-server) y respaldo local.
//
// Cada partida pide un brief único: misión, bioma, giro y reparto de 3 NPCs
// (ADA, HELIOS y un operador). Los eventos de la partida piden líneas con el
// estado de la partida como contexto. Todo es no bloqueante y con respaldo:
// sin servidor o sin clave, el guion local (guion.ts) responde al instante.
//
// Uso:
//   const radio = new Radio();
//   const { brief } = await radio.brief(heroName, profileName); // una vez por run
//   radio.linea('ada', 'reliquia', ctx).then((r) => r && toast(r.quien, r.texto));

import { postIa } from './ia';
import { briefLocal, lineaLocal, normalizarBrief, type EventoNpc, type Hablante, type RunBrief } from './guion';

export type { EventoNpc, Hablante, NpcDef, RunBrief } from './guion';

/** Líneas recientes que se mandan al modelo para que no se repita. */
const RECIENTES = 4;

/** Radio: pide a la IA y cae al guion local sin romper el juego. */
export class Radio {
  private semilla: number;
  private ultimoPorHablante = new Map<Hablante, number>();
  private recientes: string[] = [];
  /** Segundos mínimos entre líneas del mismo hablante (no spamear). */
  sinceUltima = 18;

  constructor(private ahora: () => number = () => Date.now() / 1000) {
    this.semilla = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  }

  /** Brief único de la partida. Nunca falla: cae al local. */
  async brief(heroName: string, profileName: string): Promise<{ brief: RunBrief; ia: boolean }> {
    const local = briefLocal(heroName, profileName, this.semilla);
    const r = await postIa<{ ok: boolean; brief?: unknown; source?: string }>(
      '/api/run-brief', { heroName, profileName, seed: this.semilla },
    );
    if (r?.ok && r.brief) return { brief: normalizarBrief(r.brief, local), ia: r.source !== 'local' };
    return { brief: local, ia: false };
  }

  /**
   * Una línea de un NPC. Respeta el cooldown por hablante (null si aún no le
   * toca hablar); si la IA no responde, devuelve el guion local.
   */
  async linea(hablante: Hablante, evento: EventoNpc, contexto: string): Promise<{ quien: string; texto: string; ia: boolean } | null> {
    const ahora = this.ahora();
    if (ahora - (this.ultimoPorHablante.get(hablante) ?? -1e9) < this.sinceUltima) return null;
    this.ultimoPorHablante.set(hablante, ahora);
    const quien = hablante === 'ada' ? 'ADA' : hablante === 'helios' ? 'HELIOS' : 'OPERADOR';
    const r = await postIa<{ ok: boolean; linea?: string; source?: string }>(
      '/api/npc-line',
      { speaker: hablante, evento, contexto, recientes: this.recientes, seed: this.semilla },
      8000,
    );
    const ia = Boolean(r?.ok && r.linea && r.source !== 'local');
    const texto = r?.ok && r.linea ? r.linea : lineaLocal(hablante, evento, this.semilla + evento.length);
    this.recientes = [...this.recientes, texto].slice(-RECIENTES);
    return { quien, texto, ia };
  }

  /** Nombre visible del operador del brief (para el "quien"). */
  nombreOperador(brief: RunBrief | null): string {
    const op = brief?.npcs.find((n) => n.id === 'operador');
    return op?.nombre ?? 'OPERADOR';
  }
}
