import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMAS, CLIMAS, IDS_BIOMA, PLANETA_INICIAL, REGLAS, RASGOS, destinos, generarPlaneta, resumenPlaneta } from '../src/planetas.ts';
import { ALTARES_JEFE, NPCS } from '../src/contenido/mapa.ts';

const SEMILLAS = Array.from({ length: 400 }, (_, k) => k * 7919 + 13);
const hex = /^#[0-9a-f]{6}$/;

test('la misma semilla da exactamente el mismo sector', () => {
  for (const s of [1, 2026, 999_999]) assert.deepEqual(generarPlaneta(s), generarPlaneta(s));
});

test('en 400 sectores salen todos los biomas, climas de cada uno y casi todas las reglas', () => {
  const planetas = SEMILLAS.map((s) => generarPlaneta(s));
  assert.deepEqual(new Set(planetas.map((p) => p.bioma.id)), new Set(IDS_BIOMA));
  assert.ok(new Set(planetas.map((p) => p.regla.id)).size === Object.keys(REGLAS).length);
  assert.ok(new Set(planetas.map((p) => p.clima.id)).size === Object.keys(CLIMAS).length);
  assert.ok(new Set(planetas.map((p) => p.fauna.rasgo.id)).size >= 6);
  assert.ok(new Set(planetas.map((p) => p.nombre)).size > 300, 'los nombres casi no se repiten');
});

test('dos sectores del mismo bioma no se parecen: cambia su mapa, su fauna y su reparto', () => {
  const a = generarPlaneta(11, { bioma: 'ceniza' }), b = generarPlaneta(12, { bioma: 'ceniza' });
  assert.notDeepEqual(a.relieve, b.relieve);
  assert.notDeepEqual(a.fauna.pesos, b.fauna.pesos);
  assert.notDeepEqual(a.reparto, b.reparto);
});

test('nada grande cae en la salida ni en la plataforma, en ningún sector', () => {
  for (const s of SEMILLAS) {
    const { lagos, macizos, barrios } = generarPlaneta(s).relieve;
    const cosas = [...lagos.map((l) => ({ ...l })), ...macizos.map((m) => ({ ...m, r: m.picos[0].r })), ...barrios.map((b) => ({ ...b, r: Math.max(b.w, b.d) }))];
    for (const c of cosas) {
      assert.ok(Math.hypot(c.x, c.z) > 0.2 + c.r * 0.9, `semilla ${s}: pisa la salida`);
      assert.ok(Math.hypot(c.x, c.z + 0.7) > 0.26 + c.r * 0.9, `semilla ${s}: pisa la plataforma`);
    }
  }
});

test('cada sector tiene con qué jugar: jefes, restos de gente, especies y algo que encontrar', () => {
  for (const s of SEMILLAS) {
    const { reparto: r, fauna } = generarPlaneta(s);
    assert.ok(r.altares.length >= 2 && r.altares.every((k) => ALTARES_JEFE[k]));
    assert.ok(r.npcs.length >= 1 && r.npcs.every((id) => NPCS.some((n) => n.id === id)));
    assert.ok(r.pilones >= 5 && r.torres >= 2 && r.cofres >= 7 && r.raciones >= 3);
    assert.ok(fauna.dominantes.length >= 2, `semilla ${s}: casi sin fauna`);
  }
});

test('los tres destinos son siempre de biomas distintos', () => {
  for (const s of SEMILLAS.slice(0, 80)) {
    const lista = destinos(s);
    assert.equal(lista.length, 3);
    assert.equal(new Set(lista.map((p) => p.bioma.id)).size, 3);
  }
});

test('los colores de cada bioma son válidos: un error aquí pinta el mundo de negro', () => {
  for (const b of Object.values(BIOMAS)) {
    const grupos = [b.cielo, b.suelo, b.montes, { a: b.luz.cielo, b: b.luz.suelo, c: b.luz.sol }];
    for (const g of grupos) for (const c of Object.values(g)) assert.match(c, hex, b.id);
    for (const c of b.fluido.colores) assert.match(c, hex, b.id);
    assert.ok(b.climas.length >= 2 && b.rasgos.length >= 2 && b.familias.length >= 2);
    assert.ok(b.relieve.barrios[1] <= b.lugares.barrios.length && b.relieve.lagos[1] <= b.lugares.lagos.length + 1);
  }
});

test('los lagos que no hacen daño tampoco lo dicen', () => {
  assert.equal(BIOMAS.oasis.fluido.dano, 0);
  assert.equal(BIOMAS.escarcha.fluido.dano, 0);
  assert.ok(BIOMAS.ceniza.fluido.dano > BIOMAS.velo.fluido.dano);
  assert.ok(BIOMAS.escarcha.fluido.vadeo < 0, 'el hielo se anda por encima');
  assert.match(resumenPlaneta(generarPlaneta(5, { bioma: 'oasis' })), /no hace daño/);
});

test('el peligro y la riqueza van de 1 a 5 y se reparten', () => {
  const planetas = SEMILLAS.map((s) => generarPlaneta(s));
  for (const p of planetas) {
    assert.ok(p.peligro >= 1 && p.peligro <= 5 && p.riqueza >= 1 && p.riqueza <= 5);
  }
  assert.ok(new Set(planetas.map((p) => p.peligro)).size >= 3);
  assert.ok(new Set(planetas.map((p) => p.riqueza)).size >= 3);
});

test('el sector inicial sigue siendo el de siempre: lo usan las pruebas y el título', () => {
  assert.equal(PLANETA_INICIAL.bioma.id, 'velo');
  assert.equal(PLANETA_INICIAL.reparto.altares.length, 4);
  assert.equal(RASGOS.ninguno.vida, 1);
});
