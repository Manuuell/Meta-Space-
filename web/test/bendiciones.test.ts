import test from 'node:test';
import assert from 'node:assert/strict';
import { BENDICIONES, RAREZAS, tirarBendiciones, tirarRareza } from '../src/bendiciones.ts';

test('bendiciones: la rareza sale por semilla y la suerte empuja hacia lo raro', () => {
  assert.equal(tirarRareza(0), 'comun');
  assert.equal(tirarRareza(0.999), 'legendaria');
  const raras = (suerte: number) => Array.from({ length: 200 }, (_, i) => tirarRareza(i / 200, suerte)).filter((r) => r !== 'comun').length;
  assert.ok(raras(1) > raras(0), 'la suerte no cambia nada');
});

test('bendiciones: se tiran distintas y con el valor de su rareza', () => {
  let s = 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 50; k++) {
    const tres = tirarBendiciones(rand, 3);
    assert.equal(new Set(tres.map((b) => b.id)).size, 3);
    for (const b of tres) assert.equal(b.valor, BENDICIONES[b.id].valores[RAREZAS[b.rareza].indice]);
  }
  // Cada bendición sube con la rareza.
  for (const def of Object.values(BENDICIONES)) {
    assert.ok(def.valores.every((v, i) => i === 0 || v > def.valores[i - 1]), `${def.id} no crece con la rareza`);
  }
});
