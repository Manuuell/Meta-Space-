// META SPACE — Voz de las conversaciones.
//
// Se habla manteniendo una tecla, sin parar la partida. Dos caminos para oír,
// de mejor a peor:
//   1. Micrófono → WAV 16 kHz mono → /api/transcribe (Muse Voice Transcribe).
//   2. Reconocimiento local del navegador (Chrome, sin clave).
// Si ninguno funciona, queda la ventana de texto (tecla T). Para responder en voz
// alta se usa speechSynthesis: la API de Meta aún no tiene voz de salida.
//
// Todo falla hacia lo siguiente sin romper el juego.

// Con extensión: los tests cargan este módulo directamente en Node.
import { postIa } from './ia.ts';

/** Codifica binario grande sin desbordar la pila de argumentos del navegador. */
export function bytesABase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

let microfono: Promise<MediaStream> | null = null;

// El micrófono se queda abierto durante la partida: abrirlo a cada pulsación
// tarda lo bastante para comerse la primera palabra de la frase.
function abrirMicro() {
  microfono ??= navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
    microfono = null;
    throw err;
  });
  return microfono;
}

/** Cierra el micrófono: al acabar la partida no se deja abierto. */
export async function soltarMicro() {
  const abierto = microfono;
  microfono = null;
  const flujo = await abierto?.catch(() => null);
  flujo?.getTracks().forEach((p) => p.stop());
}

/** Graba del micrófono hasta maxMs (o hasta que stop() se llame). */
export function grabarVoz(maxMs = 6000): { promesa: Promise<Blob>; parar: () => void } {
  let grabadora: MediaRecorder | null = null;
  let paradaPedida = false;
  const parar = () => {
    paradaPedida = true;
    if (grabadora && grabadora.state !== 'inactive') grabadora.stop();
  };
  const promesa = (async (): Promise<Blob> => {
    const flujo = await abrirMicro();
    try {
      const opciones = MediaRecorder.isTypeSupported?.('audio/webm')
        ? { mimeType: 'audio/webm' }
        : undefined;
      const actual = new MediaRecorder(flujo, opciones);
      grabadora = actual;
      const partes: Blob[] = [];
      actual.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      const listo = new Promise<void>((res) => { actual.onstop = () => res(); });
      actual.start();
      if (paradaPedida) parar();
      const t = setTimeout(() => parar(), maxMs);
      await listo;
      clearTimeout(t);
      return new Blob(partes, { type: actual.mimeType || 'audio/webm' });
    } finally {
      grabadora = null;
    }
  })();
  return { promesa, parar };
}

/** Convierte el webm del micrófono a WAV mono 16 kHz 16-bit (lo que pide la API). */
export async function webmAWav16k(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const dur = Math.min(audio.duration, 12);
    const off = new OfflineAudioContext(1, Math.ceil(16000 * dur), 16000);
    const fuente = off.createBufferSource();
    fuente.buffer = audio;
    fuente.connect(off.destination);
    fuente.start(0, 0, dur);
    const render = await off.startRendering();
    const datos = render.getChannelData(0);
    const wav = new DataView(new ArrayBuffer(44 + datos.length * 2));
    const escribe = (o: number, s: string) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
    escribe(0, 'RIFF'); wav.setUint32(4, 36 + datos.length * 2, true); escribe(8, 'WAVE');
    escribe(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true);
    wav.setUint16(22, 1, true); wav.setUint32(24, 16000, true); wav.setUint32(28, 32000, true);
    wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); escribe(36, 'data');
    wav.setUint32(40, datos.length * 2, true);
    for (let i = 0; i < datos.length; i++) {
      const v = Math.max(-1, Math.min(1, datos[i]));
      wav.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    const bytes = new Uint8Array(wav.buffer);
    const b64 = bytesABase64(bytes);
    return `data:audio/wav;base64,${b64}`;
  } finally {
    void ctx.close();
  }
}

/** Envía el WAV al servidor (Muse Voice Transcribe). null si no hay clave/red. */
export async function transcribirServidor(wavDataUrl: string): Promise<string | null> {
  const cuerpo = await postIa<{ ok: boolean; texto?: string }>('/api/transcribe', { audioDataUrl: wavDataUrl }, 25000);
  return cuerpo?.ok && cuerpo.texto ? cuerpo.texto : null;
}

/**
 * Reconocimiento del navegador (Chrome, español), mientras se mantiene la tecla.
 * Null si no existe. Se usa cuando no hay servidor de voz.
 */
export function reconocimientoLocal(): { promesa: Promise<string | null>; parar: () => void } | null {
  const w = window as unknown as { webkitSpeechRecognition?: new () => WebkitRec };
  if (!w.webkitSpeechRecognition) return null;
  let parar = () => {};
  const promesa = new Promise<string | null>((res) => {
    try {
      const r = new w.webkitSpeechRecognition!();
      r.lang = 'es-ES';
      r.interimResults = false;
      r.maxAlternatives = 1;
      let oido: string | null = null;
      parar = () => { try { r.stop(); } catch { /* ya parado */ } };
      r.onresult = (e: WebkitRecEvent) => { oido = e.results[0][0].transcript ?? null; };
      r.onerror = () => res(null);
      r.onend = () => res(oido);
      r.start();
    } catch {
      res(null);
    }
  });
  return { promesa, parar };
}

// Tipos mínimos para el reconocimiento web (solo lo que usamos).
interface WebkitRec {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: WebkitRecEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface WebkitRecEvent {
  results: { [i: number]: { [j: number]: { transcript?: string } } };
}

export interface PerfilVoz {
  /** Voz de Supertonic en el servidor (voces-servidor.ts) y su ritmo. */
  modelo: string;
  rapidez: number;
  /** Respaldo en el navegador: qué voz de la lista le toca, tono y velocidad. */
  indice: number;
  tono: number;
  velocidad: number;
}

// Las voces de novedad de macOS se oyen en la lista de español, pero son las que
// suenan a robot. Bajar o subir mucho el tono tampoco ayuda: por eso los perfiles
// se mueven poco y lo que cambia a cada personaje es la voz.
const VOCES_ROBOTICAS = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|zarvox|trinoids|whisper)\b/i;

/** Cuánto gusta una voz. Negativo: no se usa. */
export function puntuarVoz(voz: { name: string; lang: string }): number {
  const idioma = voz.lang.replace('_', '-').toLowerCase();
  if (!idioma.startsWith('es') || VOCES_ROBOTICAS.test(voz.name)) return -1;
  let puntos = 1;
  if (/natural|neural|online|premium|mejorada|enhanced|siri/i.test(voz.name)) puntos += 4;
  if (/google/i.test(voz.name)) puntos += 3;
  if (/^es-(mx|us|419|co|ar|cl|pe)/.test(idioma)) puntos += 1;
  return puntos;
}

/** Las voces en español que suenan bien, de mejor a peor. */
export function mejoresVoces<T extends { name: string; lang: string }>(voces: readonly T[]): T[] {
  return voces
    .map((voz) => ({ voz, puntos: puntuarVoz(voz) }))
    .filter((v) => v.puntos >= 0)
    .sort((a, b) => b.puntos - a.puntos)
    .map((v) => v.voz);
}

/** Añade una frase a lo que se esté diciendo, sin cortarlo. */
export function decirVoz(texto: string, perfil: Pick<PerfilVoz, 'indice' | 'tono' | 'velocidad'>) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !texto.trim()) return;
    const u = new SpeechSynthesisUtterance(texto.slice(0, 900));
    u.lang = 'es-ES';
    u.rate = perfil.velocidad;
    u.pitch = perfil.tono;
    const voces = mejoresVoces(synth.getVoices());
    const voz = voces[perfil.indice % Math.max(1, voces.length)];
    if (voz) {
      u.voice = voz;
      u.lang = voz.lang;
    }
    synth.speak(u);
  } catch {
    // Sin voz no pasa nada: el texto ya está en pantalla.
  }
}

export function callar() {
  try { window.speechSynthesis?.cancel(); } catch { /* sin voz */ }
}
