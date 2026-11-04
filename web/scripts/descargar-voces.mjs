// Descarga el modelo de voz Supertonic 2 en .voces/supertonic-2 (266 MB).
// No va en git: se ejecuta una vez en cada máquina con `npm run voces`.
//
// La versión está fijada y cada archivo grande se comprueba con su huella: lo
// que se carga en el servidor es exactamente lo que se revisó. Lo que ya esté
// descargado y sea correcto no se vuelve a bajar.

import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const REPO = 'Supertone/supertonic-2';
const REVISION = '75e6727618a02f323c720cba9478152d4bc16ca4';
const DESTINO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.voces', 'supertonic-2');

const VOCES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'];

async function listaDeArchivos() {
  const res = await fetch(`https://huggingface.co/api/models/${REPO}/revision/${REVISION}?blobs=true`);
  if (!res.ok) throw new Error(`Hugging Face devolvió HTTP ${res.status}.`);
  const { siblings } = await res.json();
  const quiero = new Set([
    'LICENSE', 'onnx/tts.json', 'onnx/unicode_indexer.json',
    ...['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'].map((m) => `onnx/${m}.onnx`),
    ...VOCES.map((v) => `voice_styles/${v}.json`),
  ]);
  const archivos = siblings.filter((s) => quiero.has(s.rfilename));
  if (archivos.length !== quiero.size) throw new Error('La lista del modelo no coincide con la esperada.');
  return archivos.map((s) => ({ nombre: s.rfilename, tam: s.size, huella: s.lfs?.sha256 ?? null }));
}

const huellaDe = async (ruta) => createHash('sha256').update(await readFile(ruta)).digest('hex');

async function correcto(ruta, { tam, huella }) {
  if (!existsSync(ruta) || statSync(ruta).size !== tam) return false;
  return !huella || (await huellaDe(ruta)) === huella;
}

async function bajar({ nombre, tam, huella }) {
  const ruta = path.join(DESTINO, nombre);
  if (await correcto(ruta, { tam, huella })) {
    console.log(`  ya estaba  ${nombre}`);
    return;
  }
  mkdirSync(path.dirname(ruta), { recursive: true });
  const res = await fetch(`https://huggingface.co/${REPO}/resolve/${REVISION}/${nombre}`);
  if (!res.ok || !res.body) throw new Error(`${nombre}: HTTP ${res.status}.`);
  const parcial = `${ruta}.parcial`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(parcial));
  if (!(await correcto(parcial, { tam, huella }))) {
    await rm(parcial, { force: true });
    throw new Error(`${nombre}: no coincide con lo publicado.`);
  }
  await rename(parcial, ruta);
  console.log(`  descargado ${nombre} (${(tam / 1e6).toFixed(1)} MB)`);
}

const archivos = await listaDeArchivos();
const total = archivos.reduce((s, a) => s + a.tam, 0);
console.log(`Supertonic 2 (${(total / 1e6).toFixed(0)} MB) en ${DESTINO}`);
for (const archivo of archivos) await bajar(archivo);
console.log('Voces listas.');
