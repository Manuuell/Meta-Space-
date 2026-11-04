import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CATALOGO, CATEGORIAS, colorValido, esquemaReceta, normalizarReceta, recetaLocal, type Receta } from '../src/heroe3d/receta.ts';
import { fichaHeroe } from '../src/heroe3d/ficha.ts';
import { crearHeroe } from '../src/heroe3d/montar.ts';
import { PERSONAJES, PERSONAJE_POR_ID } from '../src/personajes.ts';

const base = (): Receta => normalizarReceta({
  nombre: 'Prueba', frase: 'Hola.', colores: {},
  oficio: 'especialista', silueta: 'atletico', cabeza: 'cara', pelo: 'corto', tocado: 'nada', rostro: 'nada', vello: 'nada', torso: 'traje', piernas: 'pantalon', brazos: 'mangas',
  hombros: 'nada', espalda: 'nada', mano: 'nada', emblema: 'nada', andar: 'firme',
})!;

test('receta: el esquema de la IA ofrece todo el catálogo y nada más', () => {
  const e = esquemaReceta();
  for (const c of CATEGORIAS) assert.deepEqual(e.properties[c], { type: 'string', enum: Object.keys(CATALOGO[c]) });
  assert.ok(e.required.includes('colores') && e.additionalProperties === false);
});

test('receta: rechaza lo que no está en el catálogo', () => {
  assert.equal(normalizarReceta(null), null);
  assert.equal(normalizarReceta({ ...base(), torso: 'dragon' }), null);
  assert.equal(normalizarReceta({ ...base(), silueta: '__proto__' }), null);
});

test('receta: limpia el texto y los colores que llegan de fuera', () => {
  const r = normalizarReceta({ ...base(), nombre: '<b>Un nombre larguísimo que no cabe en el hud</b>', colores: { principal: 'rojo', luz: '#000000' } })!;
  assert.ok(r.nombre.length <= 22 && !r.nombre.includes('<'));
  assert.match(r.colores.principal, /^#[0-9a-f]{6}$/i);
  assert.notEqual(colorValido('#000000', '#ffffff'), '#000000');
});

test('receta: lo que no pega se corrige solo', () => {
  const r = normalizarReceta({ ...base(), cabeza: 'casco', pelo: 'melena', vello: 'barba', tocado: 'sombrero' })!;
  assert.deepEqual([r.pelo, r.vello, r.tocado], ['nada', 'nada', 'nada']);
});

test('receta: un sombrero sobre un afro gana y recorta el pelo', () => {
  const r = normalizarReceta({ ...base(), pelo: 'afro', tocado: 'corona' })!;
  assert.deepEqual([r.tocado, r.pelo], ['corona', 'corto']);
  assert.equal(normalizarReceta({ ...base(), pelo: 'afro', tocado: 'cuernos' })!.pelo, 'afro');
});

test('receta local: entiende lo básico sin IA y siempre da algo válido', () => {
  const r = recetaLocal('un robot gigante rojo');
  assert.deepEqual([r.cabeza, r.torso, r.silueta], ['robot', 'chasis', 'gigante']);
  assert.equal(r.colores.principal.toLowerCase(), '#d8393a');
  for (const t of ['', '???', 'xx', 'héroe sin más']) assert.ok(normalizarReceta(recetaLocal(t)), t);
  assert.deepEqual(recetaLocal('una maga azul'), recetaLocal('una maga azul'));
  const cambio = recetaLocal('ahora con capa', r);
  assert.equal(cambio.espalda, 'capa');
  assert.equal(cambio.cabeza, 'robot');
});

const NODOS = ['cuerpo', 'cadera', 'pecho', 'tronco', 'cabeza', 'ada', 'pierna_i', 'pierna_d', 'rodilla_i', 'rodilla_d', 'hombro_i', 'hombro_d', 'codo_i', 'codo_d', 'puno_i', 'puno_d', 'ojo_i', 'ojo_d', 'enganche_mochila', 'enganche_bota_i', 'enganche_bota_d'];
const CLIPS = ['Reposo', 'Caminar', 'Correr', 'Esprintar', 'Saltar', 'Surfear', 'Volar', 'Impulso', 'Golpe recibido', 'Victoria', 'Derrota', 'Habilidad'];

const comprobar = (r: Receta, nombre: string) => {
  const m = crearHeroe(r);
  for (const n of NODOS) assert.ok(m.raiz.getObjectByName(n), `${nombre}: falta ${n}`);
  assert.deepEqual(m.animaciones.map((a) => a.clip.name), CLIPS, nombre);
  for (const a of m.animaciones) {
    for (const p of a.clip.tracks) {
      assert.ok(m.raiz.getObjectByName(p.name.split('.')[0]), `${nombre}: ${a.clip.name} mueve ${p.name}, que no existe`);
      assert.ok(p.values.every(Number.isFinite), `${nombre}: ${a.clip.name} tiene valores rotos en ${p.name}`);
    }
  }
  let triangulos = 0;
  m.raiz.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.contorno) return;
    assert.ok(o.geometry.attributes.position.array.every(Number.isFinite), `${nombre}: geometría rota`);
    const g = o.geometry as THREE.BufferGeometry;
    triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return triangulos;
};

test('héroe: cualquier pieza del catálogo monta, con todos los nodos y clips del juego', () => {
  for (const c of CATEGORIAS) {
    for (const id of Object.keys(CATALOGO[c])) {
      for (const silueta of Object.keys(CATALOGO.silueta)) {
        const r = normalizarReceta({ ...base(), silueta, [c]: id })!;
        comprobar(r, `${silueta}/${c}=${id}`);
      }
    }
  }
});

test('héroe: mil combinaciones al azar no rompen nada ni se pasan de presupuesto', () => {
  let semilla = 7, maximo = 0;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1000; i++) {
    const r = { ...base() } as unknown as Record<string, unknown>;
    for (const c of CATEGORIAS) { const ids = Object.keys(CATALOGO[c]); r[c] = ids[Math.floor(azar() * ids.length)]; }
    maximo = Math.max(maximo, comprobar(normalizarReceta(r)!, `azar ${i}`));
  }
  // Un operador hecho a mano ronda los 24.000: en el peor caso, uno creado se parece.
  assert.ok(maximo < 30000, `${maximo} triángulos`);
});

test('héroe: las siluetas se distinguen por su altura y su anchura', () => {
  const medidas = Object.keys(CATALOGO.silueta).map((silueta) => {
    const c = new THREE.Box3().setFromObject(crearHeroe(normalizarReceta({ ...base(), silueta })!).raiz).getSize(new THREE.Vector3());
    return `${c.y.toFixed(1)}x${c.x.toFixed(1)}`;
  });
  assert.equal(new Set(medidas).size, medidas.length, medidas.join(' '));
});

test('ficha: cada oficio es un operador real y hereda su kit completo', () => {
  assert.deepEqual(Object.keys(CATALOGO.oficio).sort(), PERSONAJES.map((p) => p.id).sort());
  for (const p of PERSONAJES) {
    const f = fichaHeroe({ ...base(), oficio: p.id, nombre: 'Zoe' }, 'retrato.webp');
    assert.equal(f.id, p.id, 'el juego decide habilidad y arma por el id del operador');
    assert.deepEqual([f.armaInicial, f.habilidad, f.pasiva], [p.armaInicial, p.habilidad, p.pasiva]);
    assert.deepEqual([f.nombre, f.retrato], ['Zoe', 'retrato.webp']);
  }
});

test('ficha: la silueta se paga: quien aguanta más corre menos', () => {
  const ficha = (silueta: Receta['silueta']) => fichaHeroe({ ...base(), silueta }, '').stats;
  assert.ok(ficha('gigante').maxHp > ficha('bajito').maxHp);
  assert.ok(ficha('gigante').speed < ficha('bajito').speed);
  for (const s of Object.keys(CATALOGO.silueta) as Receta['silueta'][]) {
    const f = ficha(s), b = PERSONAJE_POR_ID.especialista.stats;
    assert.ok(f.maxHp >= b.maxHp - 15 && f.maxHp <= b.maxHp + 30 && f.speed >= 4.5 && f.speed <= 6.2, s);
  }
});

test('receta local: elige un oficio con sentido', () => {
  assert.equal(recetaLocal('un caballero con armadura').oficio, 'idris-okafor');
  assert.equal(recetaLocal('una botánica que cura').oficio, 'amara-keita');
});
