import test from 'node:test';
import assert from 'node:assert/strict';
import { escalaJefe, escalarGolem } from '../src/progression.ts';
import { CAMPEONES, GOLEMS } from '../src/contenido/mapa.ts';

test('jefes: empiezan como siempre y crecen con el tiempo y con el nivel', () => {
  const base = escalaJefe(0, 1);
  assert.deepEqual(base, { vida: 1, dano: 1, tempo: 1 });
  for (const clave of ['vida', 'dano', 'tempo'] as const) {
    assert.ok(escalaJefe(300, 15)[clave] > escalaJefe(180, 15)[clave], `${clave} no sube con el tiempo`);
    assert.ok(escalaJefe(300, 15)[clave] > escalaJefe(300, 8)[clave], `${clave} no sube con el nivel`);
  }
});

test('jefes: a partir del nivel 20 la vida crece mucho más deprisa', () => {
  const porNivel = (de: number, a: number) => (escalaJefe(300, a).vida - escalaJefe(300, de).vida) / (a - de);
  assert.ok(porNivel(25, 35) > porNivel(8, 18) * 3);
});

test('jefes: el daño medido no vuelve a derretirlos', () => {
  // Daño real a nivel 25 con tarjetas al azar y sin objetos: 780 por segundo.
  const segundos = (id: keyof typeof GOLEMS, min: number, nivel: number, dps: number) =>
    escalarGolem(GOLEMS[id], escalaJefe(min * 60, nivel)).vida / dps;
  assert.ok(segundos('golem-escarcha', 7, 28, 780) >= 30, 'el Coloso caía en 10 s');
  assert.ok(segundos('golem-titan', 9, 35, 900) >= 60, 'el Titán caía en 18 s');
});

test('jefes: el golpe y el ritmo tienen techo, para poder encajarlo y esquivarlo', () => {
  const tope = escalaJefe(600, 80);
  assert.equal(tope.dano, 2);
  assert.equal(tope.tempo, 1.8);
  const titan = GOLEMS['golem-titan'], fuerte = escalarGolem(titan, tope);
  assert.equal(fuerte.fuerza, 2);
  assert.ok(fuerte.descanso < titan.descanso);
  assert.ok(fuerte.ritmo <= titan.ritmo * 1.2 + 1e-9, 'el aviso tiene que seguir dando tiempo');
});

test('jefes: escalar no toca la ficha original', () => {
  const vida = CAMPEONES['golem-menor'].vida;
  escalarGolem(CAMPEONES['golem-menor'], escalaJefe(420, 28));
  assert.equal(CAMPEONES['golem-menor'].vida, vida);
  assert.equal(CAMPEONES['golem-menor'].fuerza, undefined);
});
