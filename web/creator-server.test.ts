import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Antes de importar el servidor: sin clave (nunca se llama a la API de pago)
// y con un juego compilado de prueba en una carpeta temporal.
delete process.env.MODEL_API_KEY;
delete process.env.META_API_KEY;
process.env.TRUST_PROXY = '1';
const dist = mkdtempSync(path.join(tmpdir(), 'meta-space-dist-'));
mkdirSync(path.join(dist, 'assets'));
mkdirSync(path.join(dist, 'art'));
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Meta Space</title>');
writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
process.env.STATIC_DIR = dist;

const { server } = await import('./creator-server.ts');

await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const direccion = server.address();
assert.ok(direccion && typeof direccion !== 'string');
const base = `http://127.0.0.1:${direccion.port}`;
test.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (ruta: string, cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: JSON.stringify(cuerpo),
  });

test('POST /api/transcribe se enruta y valida el cuerpo', async () => {
  const response = await post('/api/transcribe', {});
  const body = await response.json() as { ok?: boolean; error?: string };
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.match(body.error ?? '', /audioDataUrl/);
});

test('/api/health se identifica y dice que no hay clave', async () => {
  const body = await (await fetch(`${base}/api/health`)).json() as { ok: boolean; meta: boolean; servicio: string };
  assert.equal(body.ok, true);
  assert.equal(body.meta, false);
  assert.equal(body.servicio, 'meta-space-ai');
});

test('el brief local tiene a ADA, HELIOS y el operador, y no deja pasar HTML', async () => {
  const response = await post('/api/run-brief', { heroName: '<img src=x onerror=alert(1)>Zeta', profileName: 'Sol "Vega"', seed: 42 });
  const body = await response.json() as { ok: boolean; source: string; brief: { npcs: { id: string; linea: string; nombre: string }[] } };
  assert.equal(body.source, 'local');
  assert.deepEqual(body.brief.npcs.map((n) => n.id), ['ada', 'helios', 'operador']);
  for (const npc of body.brief.npcs) {
    assert.doesNotMatch(npc.linea, /[<>]/);
    assert.doesNotMatch(npc.nombre, /["<>]/);
  }
});

test('/api/npc-line corrige hablante y evento desconocidos', async () => {
  const body = await (await post('/api/npc-line', { speaker: 'hacker', evento: '../../x', contexto: 'a'.repeat(5000) })).json() as { ok: boolean; linea: string };
  assert.equal(body.ok, true);
  assert.ok(body.linea.length > 0 && body.linea.length <= 160);
});

test('solo el propio dominio y los orígenes de desarrollo pueden llamar a la API', async () => {
  const ajeno = await post('/api/npc-line', {}, {
    Origin: 'https://malicioso.example',
    'X-Forwarded-Host': 'malicioso.example',
  });
  assert.equal(ajeno.status, 403);
  assert.equal(ajeno.headers.get('access-control-allow-origin'), null);

  const dev = await post('/api/npc-line', {}, { Origin: 'http://localhost:5173' });
  assert.equal(dev.status, 200);
  assert.equal(dev.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const propio = await post('/api/npc-line', {}, { Origin: base });
  assert.equal(propio.status, 200);
});

test('un cliente no evade el límite falsificando X-Forwarded-For', async () => {
  const codigos: number[] = [];
  for (let i = 0; i < 7; i++) {
    const xff = `203.0.113.${i + 1}, 198.51.100.7`;
    codigos.push((await post('/api/generate-image', { prompt: 'astronauta' }, { 'X-Forwarded-For': xff })).status);
  }
  assert.deepEqual(codigos.slice(0, 5), [200, 200, 200, 200, 200]);
  assert.equal(codigos.at(-1), 429);
});

test('la generación de imágenes tiene límite por IP', async () => {
  const codigos: number[] = [];
  for (let i = 0; i < 7; i++) codigos.push((await post('/api/generate-image', { prompt: 'astronauta' })).status);
  assert.deepEqual(codigos.slice(0, 5), [200, 200, 200, 200, 200]);
  assert.equal(codigos.at(-1), 429);
});

test('sirve el juego compilado con CSP y caché por hash', async () => {
  const html = await fetch(`${base}/`);
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type') ?? '', /text\/html/);
  assert.match(html.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  assert.equal(html.headers.get('cache-control'), 'no-cache');

  const js = await fetch(`${base}/assets/index-abc123.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('cache-control') ?? '', /immutable/);
});

test('no deja salir de dist/ ni se cae con rutas raras', async () => {
  assert.equal((await fetch(`${base}/..%2f..%2f..%2fetc%2fpasswd`)).status, 404);
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
  assert.equal((await fetch(`${base}/art`)).status, 404);
  assert.equal((await fetch(`${base}/no-existe.js`)).status, 404);
  assert.equal((await fetch(`${base}/`, { method: 'DELETE' })).status, 405);
});

test('POST /api/npc-turno rechaza a quien no conversa y sin texto', async () => {
  assert.equal((await post('/api/npc-turno', { quien: 'npc-chatarrero', texto: 'hola' })).status, 400);
  assert.equal((await post('/api/npc-turno', { quien: 'ada' })).status, 400);
});

test('POST /api/npc-turno sin clave deja el turno al guion local', async () => {
  const response = await post('/api/npc-turno', { quien: 'ada', texto: 'hola', historial: [], partida: 'Integridad 80 %' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /ndjson/);
  const lineas = (await response.text()).trim().split('\n').map((l) => JSON.parse(l) as { t: string; turno: unknown; source: string });
  assert.deepEqual(lineas, [{ t: 'fin', turno: null, source: 'local' }]);
});

test('POST /api/voz valida la petición y sin modelo responde 503', async () => {
  assert.equal((await post('/api/voz', { quien: 'npc-chatarrero', texto: 'hola' })).status, 400);
  assert.equal((await post('/api/voz', { quien: 'ada' })).status, 400);
  assert.equal((await post('/api/voz', { quien: 'ada', texto: 'hola' })).status, 503);
  const salud = await (await fetch(`${base}/api/health`)).json() as { voces?: boolean };
  assert.equal(salud.voces, false);
});
