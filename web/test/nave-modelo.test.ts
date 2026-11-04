import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RANURAS, PIEZAS, disenoDeSerie, piezasDe, type Diseno } from '../src/nave/piezas.ts';
import { crearNaveModular, fusionarNave, voltear } from '../src/modelos/nave-modular.ts';
import { ALTO_PLATAFORMA, RADIO_PLATAFORMA, crearPlataforma } from '../src/modelos/plataforma.ts';

const conPieza = (ranura: keyof Diseno, id: string): Diseno => ({ ...disenoDeSerie(), [ranura]: id });
const TOPE: Diseno = { motores: 'motor-corona', propulsor: 'tanque-gigante', aletas: 'aleta-titanio', casco: 'casco-largo', escudo: 'escudo-negro', proa: 'proa-ada' };

const triangulos = (raiz: THREE.Object3D) => {
  let n = 0;
  raiz.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
};

test('cada pieza monta una nave con todas sus partes y sin vértices rotos', () => {
  for (const ranura of RANURAS) {
    for (const p of piezasDe(ranura)) {
      const nave = crearNaveModular(conPieza(ranura, p.id));
      for (const r of RANURAS) assert.ok(nave.partes[r].children.length > 0 || r === 'escudo', `${p.id}: falta ${r}`);
      nave.raiz.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const a = (o.geometry as THREE.BufferGeometry).attributes.position.array;
        for (const v of a) assert.ok(Number.isFinite(v), `${p.id}: vértice no finito`);
      });
    }
  }
});

test('el morro va a +z y los motores salen por detrás, con uno por cada tobera', () => {
  assert.equal(crearNaveModular(conPieza('motores', 'motor-rescate')).toberas.length, 3);
  assert.equal(crearNaveModular(conPieza('motores', 'motor-nueve')).toberas.length, 9);
  assert.equal(crearNaveModular(conPieza('motores', 'motor-corona')).toberas.length, 21);
  const nave = crearNaveModular(TOPE);
  assert.ok(nave.morro > 0);
  for (const v of nave.toberas) assert.ok(v.z < -6, 'los motores tienen que ir en la popa');
  for (const v of nave.chorros) assert.ok(v.y < 3.5, 'los chorros tienen que ir en la panza');
});

test('un casco más grande da una nave más larga', () => {
  const corta = crearNaveModular(conPieza('casco', 'casco-chapa')).largo;
  assert.ok(crearNaveModular(conPieza('casco', 'casco-largo')).largo > corta);
});

test('la nave más cargada se mantiene dentro de un presupuesto de triángulos', () => {
  assert.ok(triangulos(crearNaveModular(TOPE).raiz) < 150_000);
});

test('al hornear la nave, lo reflejado conserva las caras hacia fuera', () => {
  const raiz = crearNaveModular(TOPE).raiz, horneada = new THREE.Group();
  fusionarNave(raiz, horneada);
  assert.ok(horneada.children.length > 0 && horneada.children.length < 30, 'una malla por material');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), cara = new THREE.Vector3();
  let bien = 0, total = 0;
  for (const hijo of horneada.children) {
    const g = (hijo as THREE.Mesh).geometry as THREE.BufferGeometry;
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      cara.copy(b).sub(a).cross(c.sub(a));
      if (cara.lengthSq() < 1e-8) continue;
      n.fromBufferAttribute(nor, i).add(new THREE.Vector3().fromBufferAttribute(nor, i + 1)).add(new THREE.Vector3().fromBufferAttribute(nor, i + 2));
      total++;
      if (cara.dot(n) > 0) bien++;
    }
  }
  assert.ok(total > 1000);
  assert.ok(bien / total > 0.97, `solo ${((bien / total) * 100).toFixed(1)} % de las caras miran hacia fuera`);
});

test('voltear da la vuelta a un triángulo', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 2, 2, 2, 3, 3, 3]), 3));
  voltear(g);
  assert.deepEqual([...g.attributes.position.array].slice(3, 6), [0, 1, 0]);
  assert.deepEqual([...g.attributes.normal.array].slice(3, 6), [3, 3, 3]);
});

test('la plataforma es lo bastante ancha para la nave con las alas abiertas', () => {
  const caja = new THREE.Box3().setFromObject(crearNaveModular(TOPE).raiz);
  assert.ok(Math.max(-caja.min.x, caja.max.x) < RADIO_PLATAFORMA);
  assert.ok(Math.max(-caja.min.z, caja.max.z) < RADIO_PLATAFORMA + 8, 'el morro puede asomar, no la mitad de la nave');
  const pad = new THREE.Box3().setFromObject(crearPlataforma());
  assert.ok(pad.max.y > ALTO_PLATAFORMA, 'la torre sobresale');
});

test('hay tantas piezas como se prometen', () => {
  assert.equal(Object.keys(PIEZAS).length, 18);
});
