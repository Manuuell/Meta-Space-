import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotar, salida } from '../src/demo.ts';
import type { Zona } from '../src/avisos.ts';

test('demo: el piloto sale de cada aviso por el lado más corto', () => {
  const circulo: Zona = { tipo: 'circulo', x: 0, z: 0, r: 6 };
  const s = salida(circulo, 2, 0)!;
  assert.ok(s.x > 0.9, 'del círculo no sale hacia fuera');
  assert.equal(salida(circulo, 20, 0), null);

  const franja: Zona = { tipo: 'franja', x: 0, z: 0, dx: 0, dz: 1, ancho: 5, largo: 30 };
  const f = salida(franja, 1, 10)!;
  assert.ok(Math.abs(f.x) > 0.9 && Math.abs(f.z) < 0.1, 'de la franja no sale de lado');
  assert.equal(salida(franja, 10, 10), null);

  const cono: Zona = { tipo: 'cono', x: 0, z: 0, giro: 0, largo: 12, medio: 0.5 };
  assert.ok(salida(cono, 0.5, 6), 'no ve que está en el cono');
  assert.equal(salida(cono, 0, -6), null, 'detrás del cono no hay peligro');
});

test('demo: rodea al gólem sin apuntar y al dragón le dispara el Cañón', () => {
  const base = { x: 0, y: 0, z: 0, t: 0, zonas: [], canon: true };
  const golem = pilotar({ ...base, objetivo: { x: 12, z: 0, radio: 3, vuela: false, canon: false, mira: { x: 12, y: 3, z: 0 } } });
  assert.equal(golem.apuntar, false);
  assert.ok(Math.hypot(golem.mx, golem.mz) > 0.5, 'no se mueve');
  const dragon = pilotar({ ...base, objetivo: { x: 10, z: 10, radio: 3, vuela: true, canon: true, mira: { x: 10, y: 15, z: 10 } } });
  assert.ok(dragon.apuntar && dragon.disparar, 'no dispara al dragón');
  assert.ok(dragon.miraAlta > 0.5, 'no apunta hacia arriba');
  const huye = pilotar({ ...base, zonas: [{ tipo: 'circulo', x: 1, z: 0, r: 5 }], objetivo: null });
  assert.ok(huye.esquivando && huye.esprintar && huye.mx < 0, 'no huye del círculo');
});
