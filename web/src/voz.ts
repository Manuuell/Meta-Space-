// META SPACE — Voz del dron ADA.
//
// Tres caminos para hablar con ADA, de mejor a peor:
//   1. Micrófono → WAV 16 kHz mono → /api/transcribe (Muse Voice Transcribe).
//   2. Reconocimiento local del navegador (Chrome, sin clave).
//   3. Línea de comando escrita (tecla T).
// Y una voz para que ADA responda: speechSynthesis del navegador.
//
// Todo falla hacia lo siguiente sin romper el juego.

export type ComandoDron = 'seguir' | 'quieto' | 'explorar' | 'luz' | 'ayuda' | 'desconocido';

/** Clasifica una frase (hablada o escrita) en un comando del dron. */
export function parsearComando(texto: string): ComandoDron {
  const t = texto.toLowerCase();
  if (/(escanea|explora|reconoce|busca|rastrea)/.test(t)) return 'explorar';
  if (/(quieto|quieta|espera|alto|quédate|quedate|detente|para)/.test(t)) return 'quieto';
  if (/(ven|sígueme|sigueme|regresa|vuelve|aquí|aqui|conmigo)/.test(t)) return 'seguir';
  if (/(luz|linterna|ilumina|alumbra|oscuridad)/.test(t)) return 'luz';
  if (/(ayuda|comandos|qué puedes|que puedes|opciones)/.test(t)) return 'ayuda';
  return 'desconocido';
}

export const AYUDA_COMANDOS = 'Di: "escanea", "ven", "quieto" o "luz".';

/** Codifica binario grande sin desbordar la pila de argumentos del navegador. */
export function bytesABase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
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
    const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      flujo.getTracks().forEach((p) => p.stop());
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
export async function transcribirServidor(apiBase: string, wavDataUrl: string): Promise<string | null> {
  if (!apiBase) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(`${apiBase}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioDataUrl: wavDataUrl }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const cuerpo = (await res.json()) as { ok: boolean; texto?: string };
    return cuerpo.ok && cuerpo.texto ? cuerpo.texto : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

interface ReconocimientoLocal {
  reconocer: () => Promise<string | null>;
}

/** Reconocimiento local del navegador (Chrome, español). null si no existe. */
export function reconocimientoLocal(): ReconocimientoLocal | null {
  const w = window as unknown as { webkitSpeechRecognition?: new () => WebkitRec };
  if (!w.webkitSpeechRecognition) return null;
  return {
    reconocer: () => new Promise((res) => {
      try {
        const r = new w.webkitSpeechRecognition!();
        r.lang = 'es-ES';
        r.interimResults = false;
        r.maxAlternatives = 1;
        const fin = (texto: string | null) => { try { r.stop(); } catch { /* ya parado */ } res(texto); };
        const t = setTimeout(() => fin(null), 8000);
        r.onresult = (e: WebkitRecEvent) => { clearTimeout(t); fin(e.results[0][0].transcript ?? null); };
        r.onerror = () => { clearTimeout(t); fin(null); };
        r.onend = () => { clearTimeout(t); res(null); };
        r.start();
      } catch {
        res(null);
      }
    }),
  };
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

/** ADA habla: usa la voz en español del navegador, si la hay. */
export function hablar(texto: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(texto.slice(0, 160));
    u.lang = 'es-ES';
    u.rate = 1.05;
    const voz = synth.getVoices().find((v) => v.lang.startsWith('es'));
    if (voz) u.voice = voz;
    synth.speak(u);
  } catch {
    // Sin voz no pasa nada: el texto ya está en pantalla.
  }
}

export function callar() {
  try { window.speechSynthesis?.cancel(); } catch { /* sin voz */ }
}

/** Línea de comando escrita (respaldo cuando no hay micrófono). Tecla T. */
export function abrirLineaComando(alEnviar: (texto: string) => void): () => void {
  const caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:60;'
    + 'display:flex;gap:8px;background:rgba(20,26,44,.95);border:2px solid #5ee0ff;border-radius:12px;padding:8px 10px;';
  const entrada = document.createElement('input');
  entrada.placeholder = 'Ordena al dron: escanea, ven, quieto, luz…';
  entrada.setAttribute('aria-label', 'Comando de voz escrito para el dron');
  entrada.style.cssText = 'width:min(320px,70vw);background:transparent;border:none;outline:none;color:#fff;font:inherit;font-size:14px;';
  const boton = document.createElement('button');
  boton.textContent = '↵';
  boton.setAttribute('aria-label', 'Enviar comando');
  boton.style.cssText = 'background:#5ee0ff;border:none;border-radius:8px;width:36px;font-size:16px;cursor:pointer;';
  caja.append(entrada, boton);
  document.body.appendChild(caja);
  entrada.focus();
  let cerrada = false;
  const cerrar = () => { if (!cerrada) { cerrada = true; caja.remove(); } };
  const enviar = () => { const t = entrada.value.trim(); cerrar(); if (t) alEnviar(t); };
  boton.addEventListener('click', enviar);
  entrada.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') enviar();
    if (e.key === 'Escape') cerrar();
  });
  return cerrar;
}
