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

let comprobacion: Promise<{ meta: boolean; voces: boolean }> | null = null;
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

function salud() {
  comprobacion ??= fetchConLimite(`${API_BASE}/api/health`, {}, 3000)
    .then((r) => (r.ok ? r.json() : null))
    .then((s: { ok?: boolean; meta?: boolean; voces?: boolean; servicio?: string } | null) => {
      const nuestro = Boolean(s?.ok && s.servicio === 'meta-space-ai');
      return { meta: nuestro && Boolean(s?.meta), voces: nuestro && Boolean(s?.voces) };
    })
    .catch(() => ({ meta: false, voces: false }));
  return comprobacion;
}

/** ¿Hay servidor de IA con clave? Se pregunta una vez por sesión. */
export async function iaDisponible(): Promise<boolean> {
  if (API_BASE === null || Date.now() < pausadaHasta) return false;
  return (await salud()).meta;
}

/** ¿El servidor tiene el modelo de voz? No depende de la clave de Meta. */
export async function vocesDisponibles(): Promise<boolean> {
  if (API_BASE === null) return false;
  return (await salud()).voces;
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
    anotarFallo();
    return null;
  }
}

function anotarFallo() {
  if (++fallosSeguidos >= FALLOS_PARA_PAUSAR) {
    fallosSeguidos = 0;
    pausadaHasta = Date.now() + PAUSA_MS;
    comprobacion = null;
  }
}

/**
 * POST que responde líneas JSON según se generan: `alLinea` recibe cada una al
 * llegar. Devuelve false si no hay IA o se corta. El tiempo máximo cuenta en
 * silencio: una respuesta larga que sigue llegando no caduca.
 */
export async function postIaLineas<T>(
  ruta: string,
  cuerpo: unknown,
  alLinea: (dato: T) => void,
  senal?: AbortSignal,
  silencioMs = 20000,
): Promise<boolean> {
  if (!(await iaDisponible())) return false;
  const ctrl = new AbortController();
  senal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  let vigia = setTimeout(() => ctrl.abort(), silencioMs);
  try {
    const res = await fetch(`${API_BASE}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const lector = res.body.getReader();
    const decodificador = new TextDecoder();
    let resto = '';
    for (;;) {
      const { done, value } = await lector.read();
      clearTimeout(vigia);
      if (done) break;
      vigia = setTimeout(() => ctrl.abort(), silencioMs);
      resto += decodificador.decode(value, { stream: true });
      const lineas = resto.split('\n');
      resto = lineas.pop() ?? '';
      for (const linea of lineas) if (linea.trim()) alLinea(JSON.parse(linea) as T);
    }
    fallosSeguidos = 0;
    return true;
  } catch {
    if (!senal?.aborted) anotarFallo();
    return false;
  } finally {
    clearTimeout(vigia);
  }
}
