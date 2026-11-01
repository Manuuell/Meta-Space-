// META SPACE — Servidor de IA (Muse Spark + Muse Image vía Meta Model API).
//
// Sin dependencias: solo `node:http` + `node:zlib`.
// Arranque:  `node creator-server.ts [puerto]`  (por defecto 8787).
// Clave:     export MODEL_API_KEY="..."  (también vale META_API_KEY).
// Modelos:   META_CHAT_MODEL (defecto muse-spark-1.3),
//            META_IMAGE_MODEL (defecto muse-image-1.0).
// Base:      META_API_BASE (defecto https://api.meta.ai/v1).
//
// Endpoints:
//   GET  /api/health            → { ok, meta, modelos }
//   POST /api/generate-image    → { ok, pngDataUrl?, semilla, source, aviso? }
//   POST /api/analyze-drawing   → { ok, opinion, rasgos?, stats?, source }
//   POST /api/stats             → { ok, stats, source }
//   POST /api/run-brief         → { ok, brief, source }  (misión + NPCs únicos por partida)
//   POST /api/npc-line          → { ok, linea, source }  (una línea de un NPC ante un evento)
//
// Sin clave (o si la API falla), todo responde en modo local determinista:
// la misma semilla da el mismo borrador, y cada partida usa semilla distinta.

import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import { analyzePixels, hashPrompt, statsFromDrawing, statsFromPrompt } from './src/creator/stats.ts';
import type { DrawingFeatures, HeroStats } from './src/creator/stats.ts';

const PUERTO = Number(process.argv[2] || 8787);
const META_API_BASE = process.env.META_API_BASE || 'https://api.meta.ai/v1';
const META_API_KEY = process.env.MODEL_API_KEY || process.env.META_API_KEY || '';
const META_CHAT_MODEL = process.env.META_CHAT_MODEL || 'muse-spark-1.3';
const META_IMAGE_MODEL = process.env.META_IMAGE_MODEL || 'muse-image-1.0';

const LIMITE_JSON = 12 * 1024 * 1024; // los PNG viajan en base64

function cors(res: import('node:http').ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res: import('node:http').ServerResponse, codigo: number, cuerpo: unknown): void {
  cors(res);
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

function leerJson(req: import('node:http').IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (t: Buffer) => {
      total += t.length;
      if (total > LIMITE_JSON) {
        reject(new Error('Cuerpo demasiado grande (límite 12 MB).'));
        req.destroy();
        return;
      }
      partes.push(t);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf-8') || '{}') as Record<string, string>);
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

// ------------------------------------------- PNG: decodificador mínimo

/** Decodifica un PNG (dataURL o base64) truecolor 8-bit (tipos 2 y 6) a RGBA. */
export function decodificarPng(entrada: string): { ancho: number; alto: number; datos: Uint8Array } {
  const b64 = entrada.includes(',') ? (entrada.split(',')[1] as string) : entrada;
  const buf = Buffer.from(b64, 'base64');
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(firma)) throw new Error('No es un PNG válido.');
  let pos = 8;
  let ancho = 0;
  let alto = 0;
  let tipoColor = 0;
  let profundidad = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const tipo = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const datos = buf.subarray(pos + 8, pos + 8 + len);
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0);
      alto = datos.readUInt32BE(4);
      profundidad = datos[8];
      tipoColor = datos[9];
      if (profundidad !== 8 || (tipoColor !== 2 && tipoColor !== 6)) {
        throw new Error(`PNG no soportado (profundidad ${profundidad}, tipo ${tipoColor}).`);
      }
      if (datos[12] !== 0) throw new Error('PNG entrelazado no soportado.');
    } else if (tipo === 'IDAT') {
      idat.push(datos);
    } else if (tipo === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (!ancho || !alto || !idat.length) throw new Error('PNG incompleto.');
  const crudo = inflateSync(Buffer.concat(idat));
  const bpp = tipoColor === 6 ? 4 : 3;
  const datos = new Uint8Array(ancho * alto * 4);
  return desfiltar(crudo, ancho, alto, bpp, datos);
}

/** Aplica los filtros PNG (None/Sub/Up/Average/Paeth) y vuelca a RGBA. */
function desfiltar(
  crudo: Buffer,
  ancho: number,
  alto: number,
  bpp: number,
  datos: Uint8Array,
): { ancho: number; alto: number; datos: Uint8Array } {
  const fila = ancho * bpp;
  const recon = Buffer.alloc(fila * alto);
  let p = 0;
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[p++];
    for (let x = 0; x < fila; x++) {
      const v = crudo[p++];
      const izq = x >= bpp ? recon[y * fila + x - bpp] : 0;
      const arr = y > 0 ? recon[(y - 1) * fila + x] : 0;
      const diag = x >= bpp && y > 0 ? recon[(y - 1) * fila + x - bpp] : 0;
      let r = v;
      if (filtro === 1) r = v + izq;
      else if (filtro === 2) r = v + arr;
      else if (filtro === 3) r = v + ((izq + arr) >> 1);
      else if (filtro === 4) r = v + paeth(izq, arr, diag);
      recon[y * fila + x] = r & 255;
    }
  }
  for (let i = 0; i < ancho * alto; i++) {
    datos[i * 4] = recon[i * bpp];
    datos[i * 4 + 1] = recon[i * bpp + 1];
    datos[i * 4 + 2] = recon[i * bpp + 2];
    datos[i * 4 + 3] = bpp === 4 ? recon[i * bpp + 3] : 255;
  }
  return { ancho, alto, datos };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ------------------------------------------- opinión local de ADA

function opinionLocal(rasgos: DrawingFeatures): string {
  const partes: string[] = [];
  if (rasgos.pixels === 0) return 'Lienzo vacío: aquí no hay héroe, solo potencial.';
  const { meanR, meanG, meanB } = rasgos;
  if (meanR >= meanG && meanR >= meanB) partes.push(`mucho rojo: pegará fuerte`);
  else if (meanB >= meanR && meanB >= meanG) partes.push(`mucho azul: correrá que se las pela`);
  else partes.push(`mucho verde: nacido para aguantar`);
  if (rasgos.coverage > 0.25) partes.push('bien macizo');
  else if (rasgos.coverage < 0.08) partes.push('ligerito');
  if (rasgos.colors >= 6) partes.push('lleno de colores: recargará rápido');
  return `Veo ${partes.join(', ')}. Buen trazo, especialista.`;
}

// ------------------------------------------- llamadas a Meta (con clave)

async function metaGenerateImage(prompt: string): Promise<string> {
  // Muse Image vía /v1/images/generations (OpenAI-compatible). Se pide b64
  // para no depender de almacenamiento externo; el cliente lo recentra.
  const res = await fetch(`${META_API_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_API_KEY}` },
    body: JSON.stringify({
      model: META_IMAGE_MODEL,
      prompt:
        `Pixel-art sprite de videojuego, 128x128, fondo transparente, ` +
        `astronauta o criatura visto de frente, bordes oscuros, ` +
        `paleta: cyan #5ee0ff, naranja plasma #ffb347. Sujeto: ${prompt}`,
      n: 1,
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) throw new Error(`Muse Image devolvió HTTP ${res.status}.`);
  const cuerpo = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = cuerpo.data?.[0]?.b64_json;
  if (!b64) throw new Error('Muse Image no devolvió imagen.');
  return `data:image/png;base64,${b64}`;
}

/** Chat con Muse Spark (OpenAI-compatible). Devuelve el texto del asistente. */
async function metaChat(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch(`${META_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_API_KEY}` },
    body: JSON.stringify({
      model: META_CHAT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.9,
      reasoning_effort: 'minimal',
    }),
  });
  if (!res.ok) throw new Error(`Muse Spark devolvió HTTP ${res.status}.`);
  const cuerpo = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const texto = cuerpo.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('Muse Spark no respondió texto.');
  return texto;
}

/** Brief único por partida: misión + reparto de NPCs, en JSON estricto. */
async function metaRunBrief(heroName: string, profileName: string, seed: number): Promise<RunBrief> {
  const texto = await metaChat(
    'Eres el guionista de META SPACE, un survivors-like espacial. Respondes SOLO con un objeto JSON válido, sin markdown ni explicaciones. Todo el texto en español.',
    `Genera el brief de una partida. Héroe: "${heroName || 'Astronauta sin nombre'}". Operador de radio: "${profileName || 'Sol Vega'}". Semilla: ${seed}.\n` +
      `Esquema exacto: {"mision":"<nombre de operación, 2-4 palabras>","bioma":"<zona del Sector Delta, 3-6 palabras>","giro":"<condición especial de esta partida, 1 frase>","npcs":[{"id":"ada|helios|operador","nombre":"<nombre>","rol":"<rol, 2-5 palabras>","linea":"<frase inicial, máx 140 caracteres>"}]}\n` +
      `Reglas: 3 NPCs (ADA la IA luminosa que ayuda, HELIOS la IA fría que reclama, y el operador humano). Tonos distintos. Nada de texto fuera del JSON.`,
    500,
  );
  const ini = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (ini < 0 || fin <= ini) throw new Error('Brief sin JSON.');
  const brief = JSON.parse(texto.slice(ini, fin + 1)) as RunBrief;
  if (!brief.mision || !Array.isArray(brief.npcs) || brief.npcs.length < 2) {
    throw new Error('Brief incompleto.');
  }
  return brief;
}

/** Una línea de un NPC ante un evento de la partida. */
async function metaNpcLine(speaker: string, evento: string, contexto: string): Promise<string> {
  const texto = await metaChat(
    'Eres un NPC de META SPACE (survivors-like espacial). Respondes con UNA sola frase en español, máx 140 caracteres, sin comillas ni explicaciones. ADA es luminosa y anima; HELIOS es frío y protocolario; el operador humano es directo y con jerga de misión.',
    `Hablante: ${speaker}. Evento: ${evento}. Contexto: ${contexto.slice(0, 300)}. Escribe su frase ahora.`,
    200,
  );
  return texto.split('\n')[0].slice(0, 160).trim();
}

/** Visión de Muse Spark: una frase en español, con la voz de ADA. */
async function metaVisionOpinion(pngDataUrl: string): Promise<string> {
  const res = await fetch(`${META_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_API_KEY}` },
    body: JSON.stringify({
      model: META_CHAT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe este sprite en una frase, en español, como ADA, una IA luminosa que anima a su astronauta.' },
            { type: 'image_url', image_url: { url: pngDataUrl } },
          ],
        },
      ],
      max_tokens: 200,
      reasoning_effort: 'minimal',
    }),
  });
  if (!res.ok) throw new Error(`Visión devolvió HTTP ${res.status}.`);
  const cuerpo = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const texto = cuerpo.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('Visión sin respuesta.');
  return texto;
}

// ------------------------------------------- brief y NPCs locales (sin clave)

interface NpcDef {
  id: string;
  nombre: string;
  rol: string;
  linea: string;
}

interface RunBrief {
  mision: string;
  bioma: string;
  giro: string;
  npcs: NpcDef[];
}

/** Generador local determinista: misma semilla, mismo brief (variedad sin red). */
function briefLocal(heroName: string, profileName: string, seed: number): RunBrief {
  const misiones = ['Operación Polvo Rojo', 'Señal Perdida', 'Vigilia del Velo', 'Último Amanecer', 'Ecos de Ares', 'La Cosecha Vacía'];
  const biomas = ['dunas de hierro oxidado', 'el cauce seco del Meridiani', 'ruinas del puerto orbital', 'la llanura de los espejos rotos', 'cráteres de la red profunda', 'el bosque de antenas caídas'];
  const giros = [
    'Tormenta de polvo a mitad de partida: el cortador pierde alcance pero nadie te ve.',
    'Un Segador patrulla desde el minuto 1: evita el norte hasta armarte.',
    'Doble chatarra durante los primeros 3 minutos: corre, no pelees.',
    'Las balizas emiten el doble de señal esta noche: destrúyelas primero.',
    'Gravedad baja inestable: saltarás más alto pero caerás más lento.',
  ];
  const elige = <T>(xs: T[], n: number): T => xs[Math.abs((seed >> (n * 5)) + n * 7) % xs.length];
  const heroe = heroName.trim() || 'Especialista';
  const op = profileName.trim() || 'Sol Vega';
  return {
    mision: elige(misiones, 1),
    bioma: elige(biomas, 2),
    giro: elige(giros, 3),
    npcs: [
      { id: 'ada', nombre: 'ADA', rol: 'tu IA de auditoría', linea: `Te leo bien, ${heroe}. Sobrevive 10 minutos y contamos la verdad.` },
      { id: 'helios', nombre: 'HELIOS', rol: 'geoingeniería en curso', linea: 'Operador no reconocido. Devuelva el módulo 7. Tiene 10 minutos.' },
      { id: 'operador', nombre: op, rol: 'voz en la radio', linea: elige([
        'Te sigo en el radar. No te quedes quieto ni un segundo.',
        'Si ves un Segador, no seas héroe: rodea y sigue recogiendo.',
        'La señal se corta a ratos. Si me pierdes, sigue el plan.',
      ], 4) },
    ],
  };
}

/** Línea local por hablante y evento (respaldo sin red). */
function lineaLocal(speaker: string, evento: string, seed: number): string {
  const banco: Record<string, string[]> = {
    'ada:inicio': ['Muevo tu señal entre el ruido. Aguanta y no mires atrás.', 'Diez minutos. Respira, apunta y recoge. Yo cuento.'],
    'ada:reliquia': ['Eso es tecnología de antes del Velo. Guárdalo, cuenta como prueba.', 'Un fragmento más para el archivo. Sigue así.'],
    'ada:herido': ['Integridad cayendo. Muévete, que te están cercando.', 'Ese golpe sonó mal. Rompe el contacto y respira.'],
    'ada:victoria': ['Ventana alcanzada. Lo que llevas vale más que la nave.', 'Despegue confirmado. La verdad viaja contigo.'],
    'ada:derrota': ['Señal perdida… pero el registro queda. Lo intentaremos otra vez.', 'Te perdí entre el polvo. Vuelve, que HELIOS no descansa.'],
    'helios:inicio': ['Operador no reconocido. Devuelva el módulo 7.', 'Su registro contiene datos no verificados. Entréguelo.'],
    'helios:elite': ['Unidad prioritaria desplegada. Su anomalía será corregida.', 'Detectada desviación. Enviando corrección.'],
    'helios:victoria': ['Expediente incompleto. Seguiré buscando.', 'El módulo 7 sigue sin recuperarse. Volveré.'],
    'operador:inicio': ['Te tengo en pantalla. El valle está caliente, ve por los bordes.', 'Radio comprobada. Diez minutos y te saco de ahí.'],
    'operador:reliquia': ['Eso brilla como tecnología vieja. Tráelo, vale una fortuna en datos.', 'Buena pieza. Márcala y sigue moviéndote.'],
    'operador:elite': ['¡Ojo! Eso no es un recolector normal. ¡No te plantes delante!', 'Contacto grande a tu posición. ¡Esquiva primero, dispara después!'],
    'operador:victoria': ['¡Te tengo! ¡Despegue limpio, colega!', 'Lo lograste. La próxima la cuentas tú.'],
    'operador:derrota': ['¡No! ¡Te perdí! …Volveremos a por ti.', 'Se cortó la señal. Maldito polvo rojo.'],
  };
  const claves = [`${speaker}:${evento}`, `${speaker}:inicio`, 'ada:inicio'];
  for (let k = 0; k < claves.length; k++) {
    const xs = banco[claves[k]];
    if (xs) return xs[Math.abs(seed + k * 13) % xs.length];
  }
  return 'Sigo aquí. Aguanta.';
}

/** Transcribe un WAV (mono, PCM 16-bit) con Muse Voice Transcribe. */
async function metaTranscribe(wav: Buffer): Promise<string> {
  const limite = '----metaspace' + Date.now().toString(36);
  const request = JSON.stringify({
    mode: 'PUSH_TO_TALK',
    model: 'muse-voice-transcribe-1.0',
    audioEncoding: 'WAV',
    languageBias: ['Spanish'],
    keywords: ['ADA', 'HELIOS', 'Recolector', 'Segador', 'Saltador', 'Avispa', 'Caparazón', 'Sembrador', 'chatarra', 'escanea', 'relíquia'],
  });
  const partes = [
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="request"; Content-Type: application/json\r\n\r\n${request}\r\n`),
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="audio"; filename="comando.wav"; Content-Type: audio/wav\r\n\r\n`),
    wav,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch('https://api.meta.ai/v1/asr/transcribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${META_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${limite}`,
      },
      body: Buffer.concat(partes),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Voz devolvió HTTP ${res.status}.`);
    const cuerpo = (await res.json()) as { transcript?: string };
    const texto = (cuerpo.transcript || '').trim();
    if (!texto) throw new Error('Transcripción vacía.');
    return texto;
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------- servidor

export const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, {
      ok: true,
      meta: META_API_KEY !== '',
      modelos: { chat: META_CHAT_MODEL, imagen: META_IMAGE_MODEL, voz: 'muse-voice-transcribe-1.0' },
      servicio: 'meta-space-ai',
    });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 404, { ok: false, error: 'Ruta desconocida.' });
    return;
  }

  let cuerpo: Record<string, string>;
  try {
    cuerpo = await leerJson(req);
  } catch (err) {
    json(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Cuerpo inválido.' });
    return;
  }

  // ---- POST /api/transcribe { audioDataUrl } (data:audio/wav;base64)
  // Reenvía como multipart a Muse Voice Transcribe y devuelve el texto.
  if (url.pathname === '/api/transcribe') {
    const audio = String(cuerpo.audioDataUrl || '');
    const m = audio.match(/^data:audio\/(wav|x-wav|wave);base64,(.+)$/);
    if (!m) {
      json(res, 400, { ok: false, error: 'Falta "audioDataUrl" (dataURL WAV).' });
      return;
    }
    if (!META_API_KEY) {
      json(res, 200, { ok: false, source: 'sin-clave', error: 'Sin META_API_KEY: el cliente usa reconocimiento local.' });
      return;
    }
    try {
      const wav = Buffer.from(m[2], 'base64');
      if (wav.length > 8 * 1024 * 1024) throw new Error('Audio demasiado largo (máx ~8 MB).');
      const texto = await metaTranscribe(wav);
      json(res, 200, { ok: true, texto, source: 'meta-voice' });
    } catch (err) {
      json(res, 502, { ok: false, error: err instanceof Error ? err.message : 'Falló la transcripción.' });
    }
    return;
  }

  // ---- POST /api/generate-image { prompt }
  if (url.pathname === '/api/generate-image') {
    const prompt = String(cuerpo.prompt || '').slice(0, 280).trim();
    if (!prompt) {
      json(res, 400, { ok: false, error: 'Falta el campo "prompt".' });
      return;
    }
    const semilla = hashPrompt(prompt);
    if (META_API_KEY) {
      try {
        const pngDataUrl = await metaGenerateImage(prompt);
        json(res, 200, { ok: true, pngDataUrl, semilla, source: 'meta-image' });
      } catch (err) {
        json(res, 502, {
          ok: false,
          error: err instanceof Error ? err.message : 'Falló la generación.',
          fallback: { semilla },
          aviso: 'La IA falló: usa el borrador local o la galería.',
        });
      }
      return;
    }
    json(res, 200, {
      ok: true,
      pngDataUrl: null,
      semilla,
      source: 'local-procedural',
      aviso: 'Sin META_API_KEY: el cliente dibuja el borrador local determinista.',
    });
    return;
  }

  // ---- POST /api/analyze-drawing { pngDataUrl }
  if (url.pathname === '/api/analyze-drawing') {
    const png = String(cuerpo.pngDataUrl || '');
    if (!png.startsWith('data:image/png')) {
      json(res, 400, { ok: false, error: 'Falta "pngDataUrl" (dataURL PNG).' });
      return;
    }
    if (META_API_KEY) {
      try {
        const opinion = await metaVisionOpinion(png);
        json(res, 200, { ok: true, opinion, source: 'meta-vision' });
        return;
      } catch {
        // Cae al análisis local: la demo nunca se queda sin respuesta.
      }
    }
    try {
      const { datos } = decodificarPng(png);
      const rasgos = analyzePixels(datos);
      const stats: HeroStats = statsFromDrawing(rasgos);
      json(res, 200, { ok: true, opinion: opinionLocal(rasgos), rasgos, stats, source: 'local' });
    } catch (err) {
      json(res, 400, { ok: false, error: err instanceof Error ? err.message : 'PNG ilegible.' });
    }
    return;
  }

  // ---- POST /api/stats { kind: 'drawing', features } | { kind: 'prompt', prompt }
  if (url.pathname === '/api/stats') {
    try {
      if (cuerpo.kind === 'prompt') {
        const stats = statsFromPrompt(String(cuerpo.prompt || ''));
        json(res, 200, { ok: true, stats, source: 'local' });
        return;
      }
      const f = cuerpo.features as unknown as DrawingFeatures;
      if (!f || typeof f.coverage !== 'number') throw new Error('Falta "features" de dibujo o "prompt".');
      const stats = statsFromDrawing(f);
      json(res, 200, { ok: true, stats, source: 'local' });
    } catch (err) {
      json(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Petición inválida.' });
    }
    return;
  }

  // ---- POST /api/run-brief { heroName?, profileName?, seed? }
  if (url.pathname === '/api/run-brief') {
    const heroName = String(cuerpo.heroName || '').slice(0, 60);
    const profileName = String(cuerpo.profileName || '').slice(0, 60);
    const seed = Number.isFinite(Number(cuerpo.seed)) ? Number(cuerpo.seed) : Date.now() % 100000;
    if (META_API_KEY) {
      try {
        const brief = await metaRunBrief(heroName, profileName, seed);
        json(res, 200, { ok: true, brief, source: 'meta-spark' });
      } catch (err) {
        json(res, 200, {
          ok: true,
          brief: briefLocal(heroName, profileName, seed),
          source: 'local',
          aviso: err instanceof Error ? err.message : 'Spark falló; brief local.',
        });
      }
      return;
    }
    json(res, 200, { ok: true, brief: briefLocal(heroName, profileName, seed), source: 'local' });
    return;
  }

  // ---- POST /api/npc-line { speaker, evento, contexto?, seed? }
  if (url.pathname === '/api/npc-line') {
    const speaker = String(cuerpo.speaker || 'ada').slice(0, 20).toLowerCase();
    const evento = String(cuerpo.evento || 'inicio').slice(0, 20).toLowerCase();
    const contexto = String(cuerpo.contexto || '').slice(0, 300);
    const seed = Number.isFinite(Number(cuerpo.seed)) ? Number(cuerpo.seed) : Date.now() % 100000;
    if (META_API_KEY) {
      try {
        const linea = await metaNpcLine(speaker, evento, contexto);
        json(res, 200, { ok: true, linea, source: 'meta-spark' });
      } catch {
        json(res, 200, { ok: true, linea: lineaLocal(speaker, evento, seed), source: 'local' });
      }
      return;
    }
    json(res, 200, { ok: true, linea: lineaLocal(speaker, evento, seed), source: 'local' });
    return;
  }

  json(res, 404, { ok: false, error: 'Ruta desconocida.' });
});

if (process.argv[1]?.endsWith('creator-server.ts') || process.argv[1]?.endsWith('server.ts')) {
  server.listen(PUERTO, () => {
    console.log(`[meta-space] IA en http://localhost:${PUERTO} (meta: ${META_API_KEY ? 'sí' : 'no'})`);
  });
}
