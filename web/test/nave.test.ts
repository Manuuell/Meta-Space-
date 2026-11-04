import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEF_RANURA, OBJETIVO, PIEZAS, RANURAS, calcular, deSerie, disenoDeSerie, fabricada, fabricar, faltaPara, hangarVacio, indicadores,
  normalizarHangar, pieza, piezasDe, resolverVuelo, tsiolkovsky, type Diseno,
} from '../src/nave/piezas.ts';

const con = (cambios: Partial<Diseno>): Diseno => ({ ...disenoDeSerie(), ...cambios });

/** Todas las combinaciones posibles de piezas. */
function* combinaciones(): Generator<Diseno> {
  const opciones = RANURAS.map((r) => piezasDe(r));
  const indice = RANURAS.map(() => 0);
  for (;;) {
    yield Object.fromEntries(RANURAS.map((r, k) => [r, opciones[k][indice[k]].id])) as Diseno;
    let k = 0;
    for (; k < RANURAS.length; k++) {
      if (++indice[k] < opciones[k].length) break;
      indice[k] = 0;
    }
    if (k === RANURAS.length) return;
  }
}

test('nave: cada ranura tiene pieza de serie y opciones que fabricar', () => {
  for (const r of RANURAS) {
    assert.ok(DEF_RANURA[r], r);
    assert.ok(deSerie(r), `${r} sin pieza de serie`);
    assert.ok(piezasDe(r).filter((p) => p.fragmentos).length >= 2, `${r} con pocas opciones`);
  }
  assert.equal(new Set(PIEZAS.map((p) => p.id)).size, PIEZAS.length, 'ids repetidos');
});

test('física: Tsiolkovsky da lo que debe', () => {
  // ln(e) = 1: la velocidad ganada es justo la de escape.
  assert.ok(Math.abs(tsiolkovsky(300, Math.E, 1) - 300 * 9.80665) < 1e-9);
  assert.equal(tsiolkovsky(300, 1, 1), 0);
});

test('vuelo: el cohete de serie no basta, y dice por qué', () => {
  const v = resolverVuelo(calcular(disenoDeSerie()));
  assert.equal(v.exito, false);
  assert.ok(v.motivo.length > 10);
});

test('vuelo: cada fallo sale de su indicador', () => {
  // Corona con el tanque gigante, pero sin motores: no se levanta.
  assert.equal(resolverVuelo(calcular(con({ propulsor: 'tanque-gigante' }))).fallo, 'plataforma');
  const listo = con({ propulsor: 'tanque-largo', aletas: 'aleta-rejilla', escudo: 'escudo-parches', proa: 'proa-antena' });
  assert.equal(resolverVuelo(calcular(listo)).exito, true);
  assert.equal(resolverVuelo(calcular({ ...listo, aletas: 'aleta-fija' })).fallo, 'presion');
  assert.equal(resolverVuelo(calcular({ ...listo, propulsor: 'tanque-corto' })).fallo, 'combustible');
  assert.equal(resolverVuelo(calcular({ ...listo, escudo: 'escudo-nada' })).fallo, 'velo');
  assert.equal(resolverVuelo(calcular({ ...listo, proa: 'proa-chapa' })).fallo, 'firma');
});

test('equilibrio: hace falta explorar, y hay varias naves que vuelan', () => {
  let vuelan = 0, minimo = Infinity, tresEstrellas = 0;
  const empujes = new Set<string>();
  for (const d of combinaciones()) {
    const s = calcular(d), v = resolverVuelo(s);
    if (!v.exito) continue;
    vuelan++;
    if (v.estrellas === 3) tresEstrellas++;
    empujes.add(d.motores);
    minimo = Math.min(minimo, RANURAS.reduce((n, r) => n + (pieza(d[r])!.fragmentos ?? 0), 0));
  }
  // Con cuatro fragmentos bien elegidos se vuela: cabe en una buena primera partida.
  assert.equal(minimo, 4, 'fragmentos mínimos para volar');
  assert.ok(vuelan >= 40, `solo vuelan ${vuelan} diseños`);
  assert.ok(tresEstrellas >= 3, `tres estrellas: ${tresEstrellas}`);
  assert.equal(empujes.size, 3, 'cada motor debe servir para alguna nave');
});

test('equilibrio: lo más caro no es siempre lo mejor', () => {
  // Fabricarlo todo menos los motores deja un cohete que no despega.
  const pesado = con({ propulsor: 'tanque-gigante', casco: 'casco-largo', escudo: 'escudo-negro', proa: 'proa-ada', aletas: 'aleta-titanio' });
  assert.equal(resolverVuelo(calcular(pesado)).fallo, 'plataforma');
});

test('indicadores: uno por requisito, con su objetivo', () => {
  const lista = indicadores(calcular(disenoDeSerie()));
  assert.deepEqual(lista.map((i) => i.id), Object.keys(OBJETIVO));
  for (const i of lista) assert.ok(i.tope > i.minimo, i.id);
});

test('hangar: fabricar gasta fragmentos y monta la pieza', () => {
  const h = hangarVacio();
  const p = pieza('motor-nueve')!;
  assert.match(faltaPara(h, p, 999)!, /Faltan 2 toberas/);
  h.fragmentos.motores = 2;
  assert.match(faltaPara(h, p, 10)!, /chatarra/);
  assert.equal(faltaPara(h, p, 999), null);
  assert.equal(fabricar(h, p), 150);
  assert.equal(h.fragmentos.motores, 0);
  assert.equal(h.montadas.motores, 'motor-nueve');
  assert.ok(fabricada(h, p));
});

test('hangar: un guardado roto no rompe nada', () => {
  assert.deepEqual(normalizarHangar(null), hangarVacio());
  const h = normalizarHangar({ fragmentos: { motores: '3', casco: -4 }, fabricadas: ['nada', 'proa-ada', 'proa-chapa'], montadas: { proa: 'proa-ada', motores: 'motor-corona', aletas: 'proa-ada' } });
  assert.equal(h.fragmentos.motores, 3);
  assert.equal(h.fragmentos.casco, 0);
  assert.deepEqual(h.fabricadas, ['proa-ada']);
  assert.equal(h.montadas.proa, 'proa-ada');
  assert.equal(h.montadas.motores, 'motor-rescate', 'no se monta lo que no está fabricado');
  assert.equal(h.montadas.aletas, 'aleta-fija', 'cada pieza en su ranura');
});
