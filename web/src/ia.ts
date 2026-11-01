// Conexión del juego con el servidor de IA (creator-server.ts).
//
// En producción el mismo servidor sirve el juego y la API, así que la base es
// el propio origen (''). VITE_AI_BASE apunta a otro dominio o, con 'off',
// desactiva la IA. En desarrollo Vite reenvía /api al puerto 8787.
//
// La IA nunca bloquea la partida: se comprueba una vez con /api/health y, si
// no responde o no tiene clave, todo cae al respaldo local sin esperar
// timeouts. Tras varios fallos seguidos se pausa un minuto.

const configurada = import.meta.env?.VITE_AI_BASE as string | undefined;

/** Base de la API: '' es el mismo origen; null, IA desactivada. */
export const API_BASE: string | null = configurada === 'off' ? null : (configurada ?? '').replace(/\/+$/, '');

const FALLOS_PARA_PAUSAR = 3;
const PAUSA_MS = 60_000;

let comprobacion: Promise<boolean> | null = null;
let fallosSeguidos = 0;
let pausadaHasta = 0;

async function fetchConLimite(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** ¿Hay servidor de IA con clave? Se pregunta una vez por sesión. */
export function iaDisponible(): Promise<boolean> {
  if (API_BASE === null || Date.now() < pausadaHasta) return Promise.resolve(false);
  comprobacion ??= fetchConLimite(`${API_BASE}/api/health`, {}, 3000)
    .then((r) => (r.ok ? r.json() : null))
    .then((s: { ok?: boolean; meta?: boolean; servicio?: string } | null) =>
      Boolean(s?.ok && s.meta && s.servicio === 'meta-space-ai'))
    .catch(() => false);
  return comprobacion;
}

/** POST a la IA. Devuelve null si no hay IA, se agota el tiempo o falla. */
export async function postIa<T>(ruta: string, cuerpo: unknown, timeoutMs = 12000): Promise<T | null> {
  if (!(await iaDisponible())) return null;
  try {
    const res = await fetchConLimite(`${API_BASE}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }, timeoutMs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const datos = (await res.json()) as T;
    fallosSeguidos = 0;
    return datos;
  } catch {
    if (++fallosSeguidos >= FALLOS_PARA_PAUSAR) {
      fallosSeguidos = 0;
      pausadaHasta = Date.now() + PAUSA_MS;
      comprobacion = null;
    }
    return null;
  }
}
