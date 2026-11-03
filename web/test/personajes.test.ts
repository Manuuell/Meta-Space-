import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PERSONAJES } from '../src/personajes.ts';
import { WEAPONS, type WeaponId } from '../src/data.ts';
import { CATALOGO } from '../src/modelos/index.ts';
import { medir } from '../src/modelos/kit.ts';
import { mulberry32, rollChoices, type EstadoBuild, type TablaArmas } from '../src/progression.ts';

test('personajes: ids, retratos, modelos y equipos coherentes', () => {
  assert.equal(new Set(PERSONAJES.map((p) => p.id)).size, PERSONAJES.length, 'hay ids repetidos');
  const modelos = new Set(CATALOGO.filter((m) => m.tipo === 'jugador').map((m) => m.id));
  for (const p of PERSONAJES) {
    assert.ok(p.retrato.startsWith('/art/profiles/') && p.retrato.endsWith('.webp'), `${p.id}: retrato inválido`);
    assert.ok(modelos.has(p.modelo), `${p.id}: no existe el modelo ${p.modelo}`);
    assert.ok(WEAPONS[p.armaInicial], `${p.id}: arma inicial inexistente`);
    assert.equal(WEAPONS[p.armaInicial].levels.length, 6, `${p.id}: el arma no tiene seis niveles`);
    if (p.id === 'especialista') {
      assert.equal(p.habilidad, null);
      continue;
    }
    assert.equal(WEAPONS[p.armaInicial].exclusiva, p.id, `${p.id}: el arma no es exclusiva suya`);
    assert.ok(p.habilidad && p.habilidad.recarga > 0, `${p.id}: habilidad sin recarga`);
    assert.ok(p.pasiva, `${p.id}: falta la pasiva`);
  }
});

// El contrato con el juego: nodos donde cuelga el equipo y clips por nombre.
const NODOS = ['cuerpo', 'pecho', 'cabeza', 'pierna_i', 'pierna_d', 'ada', 'enganche_mochila', 'enganche_bota_i', 'enganche_bota_d'];
const CLIPS = ['Reposo', 'Caminar', 'Correr', 'Esprintar', 'Saltar', 'Surfear', 'Volar', 'Impulso', 'Golpe recibido', 'Victoria', 'Derrota'];

for (const p of PERSONAJES) {
  test(`${p.id}: cumple el contrato de nodos y clips`, () => {
    const m = CATALOGO.find((c) => c.id === p.modelo)!.crear();
    for (const n of NODOS) assert.ok(m.raiz.getObjectByName(n), `falta el nodo «${n}»`);
    assert.equal(m.raiz.getObjectByName('cuerpo')!.parent, m.raiz, '«cuerpo» tiene que colgar de la raíz');
    const clips = new Map(m.animaciones.map((a) => [a.clip.name, a]));
    for (const c of CLIPS) assert.ok(clips.has(c), `falta el clip «${c}»`);
    if (p.habilidad) {
      const h = clips.get('Habilidad');
      assert.ok(h && !h.bucle && h.clip.duration <= 1.2, 'falta «Habilidad» de una vez y ≤ 1,2 s');
    }
    const { alto } = medir(m.raiz);
    if (p.id !== 'especialista') assert.ok(alto >= 2.1 && alto <= 3.2, `mide ${alto.toFixed(2)} m (de 2,2 a 3,0)`);
  });
}

test('personajes: los cinco modelos nuevos son distintos entre sí y del Especialista', () => {
  // Huella grosso modo de la silueta: alto, ancho y fondo de lo que se ve.
  const huella = (id: string) => {
    const m = CATALOGO.find((c) => c.id === id)!.crear();
    m.raiz.updateMatrixWorld(true);
    const caja = new THREE.Box3();
    m.raiz.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.contorno && o.visible) caja.expandByObject(o); });
    const t = caja.getSize(new THREE.Vector3());
    let mallas = 0;
    m.raiz.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.contorno) mallas++; });
    return { t, mallas, nodos: new Set<string>(m.raiz.getObjectsByProperty('type', 'Group').map((g) => g.name).filter(Boolean)) };
  };
  const ids = ['astronauta', ...PERSONAJES.filter((p) => p.id !== 'especialista').map((p) => p.modelo)];
  const huellas = ids.map(huella);
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const A = huellas[a], B = huellas[b];
    const comunes = [...A.nodos].filter((n) => B.nodos.has(n)).length / Math.min(A.nodos.size, B.nodos.size);
    const misma = Math.abs(A.t.x - B.t.x) < 0.1 && Math.abs(A.t.y - B.t.y) < 0.1 && Math.abs(A.t.z - B.t.z) < 0.1;
    assert.ok(!misma || comunes < 0.6, `${ids[a]} y ${ids[b]} parecen el mismo muñeco`);
    assert.notEqual(A.mallas, B.mallas, `${ids[a]} y ${ids[b]} tienen las mismas piezas`);
  }
});

test('personajes: la tirada no ofrece armas exclusivas de otros operadores', () => {
  const tabla = Object.fromEntries((Object.keys(WEAPONS) as WeaponId[]).map((id) => [id, WEAPONS[id].levels.map((s) => ({
    damage: s.damage, cooldown: s.cooldown, count: s.count, area: s.area,
  }))])) as TablaArmas;
  const exclusivas = Object.fromEntries((Object.keys(WEAPONS) as WeaponId[])
    .filter((id) => WEAPONS[id].exclusiva).map((id) => [id, WEAPONS[id].exclusiva!]));
  for (const p of PERSONAJES) {
    const rng = mulberry32(7);
    for (let k = 0; k < 60; k++) {
      const estado: EstadoBuild = {
        armas: new Map([[p.armaInicial, 1]]), pasivas: new Map(), nivel: 2 + (k % 20), tiempo: k * 10, vida: 1, amenaza: 40,
        presionDps: 50, especialHeroe: null, nivelEspecial: 0, ultimaTirada: [], ultimaArma: null, rechazos: new Map(),
      };
      for (const c of rollChoices(estado, { tabla, rng, personaje: p.id, exclusivas })) {
        if (c.kind !== 'weapon') continue;
        const dueno = WEAPONS[c.id as WeaponId].exclusiva;
        assert.ok(!dueno || dueno === p.id, `${p.id} recibió ${c.id}, que es de ${dueno}`);
      }
    }
  }
});
