// META SPACE — Voces neuronales en el servidor, con Supertonic 2.
//
// La API de Meta aún no tiene voz de salida, así que el audio se genera aquí: el
// jugador no descarga el modelo y la partida no pierde fotogramas. El modelo no
// va en git (`npm run voces`) y onnxruntime-node es opcional: si falta cualquiera
// de los dos, `cargarVoces` devuelve null y el juego usa la voz del navegador.
//
// El modelo se usa bajo la licencia OpenRAIL-M: ver web/public/licencias.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textoParaModelo, trocear, unirAudio, wavDe } from './src/habla.ts';

const CARPETA = path.join(path.dirname(fileURLToPath(import.meta.url)), '.voces', 'supertonic-2');
const PASOS_POR_DEFECTO = 8;
/** Quien pide de más espera: una frase nueva vale más que una vieja. */
const MAX_EN_COLA = 6;

type Tensor = { data: ArrayLike<number> };
type Sesion = { run(entrada: Record<string, unknown>): Promise<Record<string, Tensor>> };

interface Estilo {
  ttl: unknown;
  dp: unknown;
}

export interface Voces {
  frecuencia: number;
  disponibles: string[];
  /** Un WAV con el texto dicho. Null si hay demasiadas peticiones en cola. */
  decir(texto: string, voz: string, velocidad: number): Promise<Uint8Array | null>;
}

const leerJson = (ruta: string) => JSON.parse(readFileSync(ruta, 'utf8'));

function ruido(n: number): Float32Array {
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(1e-10, Math.random());
    r[i] = Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * Math.random());
  }
  return r;
}

export async function cargarVoces(carpeta = CARPETA, PASOS = PASOS_POR_DEFECTO): Promise<Voces | null> {
  if (!existsSync(path.join(carpeta, 'onnx', 'vocoder.onnx'))) return null;
  let ort;
  try {
    ort = await import('onnxruntime-node');
  } catch {
    return null;
  }

  const config = leerJson(path.join(carpeta, 'onnx', 'tts.json'));
  const indice: number[] = leerJson(path.join(carpeta, 'onnx', 'unicode_indexer.json'));
  const frecuencia: number = config.ae.sample_rate;
  const trama: number = config.ae.base_chunk_size * config.ttl.chunk_compress_factor;
  const dimension: number = config.ttl.latent_dim * config.ttl.chunk_compress_factor;

  const opciones = { intraOpNumThreads: 0, graphOptimizationLevel: 'all' };
  const cargar = (nombre: string): Promise<Sesion> => ort.InferenceSession.create(path.join(carpeta, 'onnx', `${nombre}.onnx`), opciones);
  const [duracion, codificador, estimador, vocoder] = await Promise.all(
    ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'].map(cargar),
  );

  const flotante = (datos: Float32Array, dims: number[]) => new ort.Tensor('float32', datos, dims);
  const estilos = new Map<string, Estilo>();
  const estiloDe = (voz: string): Estilo => {
    let estilo = estilos.get(voz);
    if (!estilo) {
      const e = leerJson(path.join(carpeta, 'voice_styles', `${voz}.json`));
      estilo = {
        ttl: flotante(Float32Array.from(e.style_ttl.data.flat(Infinity)), e.style_ttl.dims),
        dp: flotante(Float32Array.from(e.style_dp.data.flat(Infinity)), e.style_dp.dims),
      };
      estilos.set(voz, estilo);
    }
    return estilo;
  };

  async function generar(texto: string, estilo: Estilo, velocidad: number): Promise<Float32Array> {
    // NFKD deja cada carácter en un punto de código: la tilde va aparte.
    const puntos = Array.from(textoParaModelo(texto), (c) => Math.max(0, indice[c.codePointAt(0)!] ?? 0));
    const n = puntos.length;
    const ids = new ort.Tensor('int64', BigInt64Array.from(puntos, BigInt), [1, n]);
    const mascara = flotante(new Float32Array(n).fill(1), [1, 1, n]);

    const { duration } = await duracion.run({ text_ids: ids, style_dp: estilo.dp, text_mask: mascara });
    const segundos = duration.data[0] / velocidad;
    const { text_emb: texto_emb } = await codificador.run({ text_ids: ids, style_ttl: estilo.ttl, text_mask: mascara });

    const largo = Math.floor(segundos * frecuencia);
    const tramas = Math.max(1, Math.floor((largo + trama - 1) / trama));
    let latente = ruido(dimension * tramas);
    const mascaraLatente = flotante(new Float32Array(tramas).fill(1), [1, 1, tramas]);
    const total = flotante(Float32Array.of(PASOS), [1]);
    for (let paso = 0; paso < PASOS; paso++) {
      const { denoised_latent: limpio } = await estimador.run({
        noisy_latent: flotante(latente, [1, dimension, tramas]),
        text_emb: texto_emb,
        style_ttl: estilo.ttl,
        text_mask: mascara,
        latent_mask: mascaraLatente,
        total_step: total,
        current_step: flotante(Float32Array.of(paso), [1]),
      });
      latente = Float32Array.from(limpio.data);
    }
    const { wav_tts: onda } = await vocoder.run({ latent: flotante(latente, [1, dimension, tramas]) });
    return Float32Array.from(onda.data).subarray(0, largo);
  }

  // De una en una: el modelo ya usa todos los núcleos.
  let cola: Promise<unknown> = Promise.resolve();
  let esperando = 0;

  return {
    frecuencia,
    disponibles: ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'],
    decir(texto, voz, velocidad) {
      if (esperando >= MAX_EN_COLA) return Promise.resolve(null);
      esperando++;
      const trabajo = cola.then(async () => {
        const estilo = estiloDe(voz);
        const trozos: Float32Array[] = [];
        for (const trozo of trocear(texto)) trozos.push(await generar(trozo, estilo, velocidad));
        return wavDe(unirAudio(trozos, frecuencia), frecuencia);
      }).finally(() => { esperando--; });
      cola = trabajo.catch(() => {});
      return trabajo;
    },
  };
}
