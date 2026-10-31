// META SPACE · FOCO 3 — Servidor del creador de personaje.
//
// Sin dependencias: solo `node:http` + `node:zlib`.
// Arranque:  `node server.ts [puerto]`  (por defecto 8787).
//
// Endpoints:
//   GET  /api/health            → { ok, meta, modelos }
//   POST /api/generate-image    → { ok, pngDataUrl?, semilla, source, aviso? }
//   POST /api/analyze-drawing   → { ok, opinion, rasgos?, source }
//   POST /api/stats             → { ok, stats, regla }
//
// Integración con Meta Model API (documentada, no obligatoria para la demo):
//   META_API_KEY     clave para la Meta Model API (sin ella, todo es local).
//   META_API_BASE    base de la API (por defecto, el endpoint público).
//   META_IMAGE_MODEL modelo de imagen, p. ej. "muse-image-1".
//   META_VISION_MODEL modelo de visión, p. ej. "muse-spark-vision-1".
//
//   - /generate-image con clave → Muse Image: POST { model, prompt, size,
//     response_format: "b64_json" } + system prompt de pixel-art 128×128 con
//     fondo transparente; la respuesta b64 se recentra y reescala a 128×128
//     en el cliente. Sin clave → { ok:true, source:"local-procedural",
//     semilla } y el cliente dibuja el sprite determinista.
//   - /analyze-drawing con clave → visión de Muse Spark: se envía el PNG +
//     "describe este sprite en una frase, en español, como ADA". Sin clave →
//     análisis local de píxeles (decodificador PNG propio, sin dependencias).
//   - /stats es siempre local y determinista (misma regla que el cliente).

import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import { analyzePixels, hashPrompt, statsFromDrawing, statsFromPrompt } from './src/stats.ts';
import type { DrawingFeatures, HeroStats } from './src/stats.ts';

const PUERTO = Number(process.argv[2] || 8787);
const META_API_BASE = process.env.META_API_BASE || 'https://api.meta.example/v1';
const META_API_KEY = process.env.META_API_KEY || '';
const META_IMAGE_MODEL = process.env.META_IMAGE_MODEL || 'muse-image-1';
const META_VISION_MODEL = process.env.META_VISION_MODEL || 'muse-spark-vision-1';

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
  // Muse Image: el prompt del sistema pide pixel-art 128×128 con fondo
  // transparente; se pide b64 para no depender de almacenamiento externo.
  const res = await fetch(`${META_API_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_API_KEY}` },
    body: JSON.stringify({
      model: META_IMAGE_MODEL,
      prompt:
        `Pixel-art sprite de videojuego, 128x128, fondo transparente, ` +
        `astronauta o criatura visto de frente, bordes oscuros, ` +
        `paleta: cyan #5ee0ff, naranja plasma #ffb347. Sujeto: ${prompt}`,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) throw new Error(`Meta Image devolvió HTTP ${res.status}.`);
  const cuerpo = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = cuerpo.data?.[0]?.b64_json;
  if (!b64) throw new Error('Meta Image no devolvió imagen.');
  return `data:image/png;base64,${b64}`;
}

async function metaVisionOpinion(pngDataUrl: string): Promise<string> {
  // Visión de Muse Spark: una frase en español, con la voz de ADA.
  const res = await fetch(`${META_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_API_KEY}` },
    body: JSON.stringify({
      model: META_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe este sprite en una frase, en español, como ADA, una IA luminosa que anima a su astronauta.' },
            { type: 'image_url', image_url: { url: pngDataUrl } },
          ],
        },
      ],
      max_tokens: 120,
    }),
  });
  if (!res.ok) throw new Error(`Visión devolvió HTTP ${res.status}.`);
  const cuerpo = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const texto = cuerpo.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('Visión sin respuesta.');
  return texto;
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
      modelos: { imagen: META_IMAGE_MODEL, vision: META_VISION_MODEL },
      servicio: 'meta-space-character-creator',
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

  json(res, 404, { ok: false, error: 'Ruta desconocida.' });
});

if (process.argv[1]?.endsWith('server.ts')) {
  server.listen(PUERTO, () => {
    console.log(`[foco3] creador en http://localhost:${PUERTO} (meta: ${META_API_KEY ? 'sí' : 'no'})`);
  });
}
