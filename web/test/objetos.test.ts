import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, type WeaponId } from '../src/data.ts';
import { BIOMAS } from '../src/planetas.ts';
import {
  CATALOGO, MODULOS, OBJETOS, OBJETO_POR_ID, arsenalVacio, calcularArsenal, pesoObjeto, precioObjeto, probGolpe, tirarObjetos,
  type PeticionBotin,
} from '../src/objetos.ts';
import { generador } from '../src/planetas.ts';

const ARMAS = Object.keys(WEAPONS) as WeaponId[];
const peticion = (o: Partial<PeticionBotin> = {}): PeticionBotin => ({ n: 3, suerte: 0, afinidad: [], armas: ['cortador', 'pulso'], tenidos: new Set(), ...o });

test('hay muchos objetos y ninguno se repite ni se queda sin texto', () => {
  assert.ok(OBJETOS.length >= 60, `solo hay ${OBJETOS.length}`);
  assert.ok(MODULOS.length >= 12);
  assert.equal(new Set(CATALOGO.map((c) => c.id)).size, CATALOGO.length);
  assert.equal(new Set(CATALOGO.map((c) => c.nombre)).size, CATALOGO.length, 'dos objetos con el mismo nombre');
  for (const c of CATALOGO) {
    assert.ok(c.texto.length > 12, c.id);
    assert.ok(c.modulo || Object.keys(c.efectos).length > 0, `${c.id} no hace nada`);
    if (c.arma) assert.ok(WEAPONS[c.arma], c.id);
  }
});

test('cada herramienta tiene objetos propios y cada bioma encuentra sus familias', () => {
  for (const id of ARMAS) assert.ok(OBJETOS.filter((o) => o.arma === id).length >= 2, `${id} casi no tiene objetos`);
  for (const b of Object.values(BIOMAS)) {
    for (const f of b.familias) assert.ok(CATALOGO.filter((c) => c.familia === f).length >= 4, `${b.id}: poca ${f}`);
  }
});

test('los efectos de golpe de un objeto de herramienta solo cuentan para esa herramienta', () => {
  const a = calcularArsenal([OBJETO_POR_ID.get('hoja-veneno')!]);
  assert.equal(probGolpe(a, 'cortador', 'envenenar'), 0.8);
  assert.equal(probGolpe(a, 'pulso', 'envenenar'), 0);
});

test('los objetos de cualquiera se suman y nunca llegan a ser seguros', () => {
  const lista = ['nucleo-magma', 'encendedor', 'campo-igneo'].map((id) => OBJETO_POR_ID.get(id)!);
  const a = calcularArsenal(lista);
  assert.ok(Math.abs(probGolpe(a, 'cortador', 'quemar') - 0.37) < 1e-9);
  const b = calcularArsenal(OBJETOS.filter((o) => o.efectos.chispa));
  assert.ok(probGolpe(b, 'dron', 'chispa') <= 0.9);
});

test('con dos objetos de tiempos gana el más rápido, no se suman', () => {
  const a = calcularArsenal([OBJETO_POR_ID.get('escudo-esquirlas')!, { ...OBJETO_POR_ID.get('escudo-esquirlas')!, id: 'x', efectos: { escudo: 6 } }]);
  assert.equal(a.fx.escudo, 6);
});

test('un arsenal vacío se puede leer sin comprobar nada: todo vale cero', () => {
  const fx = arsenalVacio().fx;
  for (const c of CATALOGO) for (const k of Object.keys(c.efectos)) assert.equal(fx[k as keyof typeof fx], 0, k);
});

test('el botín no da lo que ya tienes ni objetos de herramientas que no llevas', () => {
  const rand = generador(7);
  const tenidos = new Set(['filo-saltarin']);
  for (let k = 0; k < 300; k++) {
    for (const o of tirarObjetos(rand, peticion({ tenidos }))) {
      assert.notEqual(o.id, 'filo-saltarin');
      if (o.arma) assert.ok(o.arma === 'cortador' || o.arma === 'pulso', o.id);
    }
  }
});

test('las tres opciones son distintas y se pueden pedir solo módulos', () => {
  const rand = generador(3);
  for (let k = 0; k < 100; k++) {
    const salen = tirarObjetos(rand, peticion());
    assert.equal(new Set(salen.map((o) => o.id)).size, 3);
    for (const o of tirarObjetos(rand, peticion({ solo: 'modulos' }))) assert.ok(o.modulo);
  }
});

test('el sector se nota: lo afín sale mucho más, y la suerte trae rarezas', () => {
  const rand = generador(11);
  const cuenta = (p: PeticionBotin, si: (o: (typeof CATALOGO)[number]) => boolean) => {
    let n = 0;
    for (let k = 0; k < 2000; k++) for (const o of tirarObjetos(rand, { ...p, n: 1 })) if (si(o)) n++;
    return n;
  };
  const fuego = (o: (typeof CATALOGO)[number]) => o.familia === 'fuego';
  assert.ok(cuenta(peticion({ afinidad: ['fuego'] }), fuego) > cuenta(peticion({ afinidad: ['hielo'] }), fuego) * 1.8);
  const raro = (o: (typeof CATALOGO)[number]) => o.rareza === 'epica' || o.rareza === 'legendaria';
  assert.ok(cuenta(peticion({ suerte: 1.5 }), raro) > cuenta(peticion(), raro) * 1.6);
  const def = OBJETO_POR_ID.get('filo-saltarin')!;
  assert.ok(pesoObjeto(def, peticion()) > pesoObjeto({ ...def, arma: undefined }, peticion()));
});

test('si ya lo tienes todo, el botín no se queda colgado', () => {
  const tenidos = new Set(CATALOGO.map((c) => c.id));
  assert.deepEqual(tirarObjetos(generador(1), peticion({ tenidos })), []);
});

test('el mercader cobra más por lo raro y por cada venta', () => {
  const comun = OBJETO_POR_ID.get('encendedor')!, epico = OBJETO_POR_ID.get('soplete')!;
  assert.ok(precioObjeto(epico, 0) > precioObjeto(comun, 0));
  assert.ok(precioObjeto(comun, 2) > precioObjeto(comun, 0));
});
