import { audioDelJuego } from './audio';
import { fichaDe, type Forma, type Interlocutor } from './contenido/fichas';
import { API_BASE, vocesDisponibles } from './ia';
import { callar as callarNavegador, decirVoz } from './voz';

// Quien habla en voz alta. Cada frase se pide al servidor en cuanto se conoce y
// suena en orden: así la siguiente ya está lista cuando acaba la anterior. Sin
// voces en el servidor, habla la voz del navegador.

let vigente = 0;
let corte = new AbortController();
let cola: Promise<void> = Promise.resolve();
let sonando: AudioBufferSourceNode | null = null;
let pendientes = 0;

async function pedirAudio(quien: Interlocutor, forma: Forma | undefined, texto: string, senal: AbortSignal): Promise<AudioBuffer | null> {
  const ctx = audioDelJuego();
  if (!ctx || !(await vocesDisponibles())) return null;
  try {
    const res = await fetch(`${API_BASE}/api/voz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quien, forma, texto }),
      signal: senal,
    });
    return res.ok ? await ctx.decodeAudioData(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Devuelve false si el navegador no deja sonar nada: un audio parado no acaba nunca. */
async function sonar(buffer: AudioBuffer): Promise<boolean> {
  const ctx = audioDelJuego();
  if (!ctx) return false;
  if (ctx.state !== 'running') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
  if (ctx.state !== 'running') return false;
  return new Promise<boolean>((listo) => {
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(ctx.destination);
    fuente.onended = () => {
      if (sonando === fuente) sonando = null;
      listo(true);
    };
    sonando = fuente;
    fuente.start();
  });
}

/** Añade una frase a lo que esté diciendo, sin cortarlo. */
export function decir(quien: Interlocutor, texto: string, forma?: Forma) {
  if (!texto.trim()) return;
  const turno = vigente;
  const audio = pedirAudio(quien, forma, texto, corte.signal);
  pendientes++;
  cola = cola.then(async () => {
    const buffer = await audio;
    if (turno !== vigente) return;
    if (!buffer || !(await sonar(buffer))) decirVoz(texto, fichaDe(quien, forma).voz);
  }).finally(() => { pendientes--; });
}

/** Corta lo que suena y lo que estaba por sonar. */
export function callar() {
  vigente++;
  corte.abort();
  corte = new AbortController();
  sonando?.stop();
  sonando = null;
  callarNavegador();
}

/** ¿Hay alguien hablando o a punto de hacerlo? */
export function hablando() {
  return pendientes > 0;
}
