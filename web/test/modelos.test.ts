import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CATALOGO } from '../src/modelos/index.ts';
import { conDetalle, medir } from '../src/modelos/kit.ts';
import { Tropa } from '../src/modelos/tropa.ts';

// Lo que el juego necesita de cada modelo, comprobado sin navegador ni GPU.

/** Triángulos máximos en el juego (horda a detalle 0,45; el resto a detalle 1). */
const PRESUPUESTO = {
  horda: 6500,
  jefe: 30000,
  jugador: 30000,
  companero: 30000,
  equipo: 30000,
  npc: 20000,
  mapa: 20000,
  objeto: 6000,
  escena: 30000,
};

/**
 * Derrotas que ya están en el juego y no acaban del todo en el suelo. La
 * Baliza termina con la antena parabólica 0,44 m por debajo (el juego la encoge
 * enseguida).
 */
const SUELO_CONOCIDO: Record<string, number> = { baliza: -0.5 };

// El catálogo del juego también conserva equipo y compañeros de main-ygerl4.
// Esos modelos no pertenecen al contrato de este repositorio (Bruno además
// genera texturas con Canvas), así que esta suite valida los modelos importados.
const CATALOGO_PROBADO = CATALOGO.filter((entrada) => entrada.tipo !== 'companero' && entrada.tipo !== 'equipo');

for (const entrada of CATALOGO_PROBADO) {
  test(`${entrada.id}: nodos con nombre único y animaciones que apuntan a ellos`, () => {
    const m = entrada.crear();
    const nombres = new Map<string, number>();
    m.raiz.traverse((o) => { if (o.name) nombres.set(o.name, (nombres.get(o.name) ?? 0) + 1); });
    for (const [nombre, veces] of nombres) assert.equal(veces, 1, `el nodo «${nombre}» está repetido`);

    assert.ok(m.animaciones.length > 0, 'sin animaciones');
    const clips = new Set<string>();
    for (const a of m.animaciones) {
      assert.ok(!clips.has(a.clip.name), `clip repetido: ${a.clip.name}`);
      clips.add(a.clip.name);
      assert.ok(a.clip.duration > 0 && a.clip.duration <= 4, `${a.clip.name}: duración ${a.clip.duration}`);
      for (const pista of a.clip.tracks) {
        const nodo = pista.name.split('.')[0];
        assert.ok(nombres.has(nodo), `${a.clip.name}: la pista ${pista.name} apunta a un nodo que no existe`);
        assert.ok([...pista.values].every(Number.isFinite), `${a.clip.name}: ${pista.name} tiene valores no numéricos`);
      }
    }
  });

  test(`${entrada.id}: cabe en el presupuesto de triángulos`, () => {
    const tipo = entrada.tipo;
    const m = tipo === 'horda' ? conDetalle(0.45, entrada.crear) : entrada.crear();
    const { triangulos } = medir(m.raiz);
    assert.ok(triangulos <= PRESUPUESTO[tipo], `${triangulos} triángulos (máximo ${PRESUPUESTO[tipo]} para ${tipo})`);
  });

  test(`${entrada.id}: los clips en bucle cierran sin salto`, () => {
    const m = entrada.crear();
    for (const a of m.animaciones.filter((x) => x.bucle)) {
      for (const pista of a.clip.tracks) {
        const n = pista.getValueSize();
        const primero = [...pista.values.slice(0, n)];
        const ultimo = [...pista.values.slice(-n)];
        // Un cuaternión y su opuesto son el mismo giro.
        const iguales = (signo: number) => primero.every((v, i) => Math.abs(v - signo * ultimo[i]) < 1e-3);
        assert.ok(iguales(1) || (n === 4 && iguales(-1)), `${a.clip.name}: ${pista.name} no acaba como empieza`);
      }
    }
  });

  if (entrada.tipo === 'horda') {
    test(`${entrada.id}: golpe corto y derrota que acaba en el suelo`, () => {
      const m = entrada.crear();
      const golpe = m.animaciones.find((a) => a.clip.name === 'Golpe recibido');
      const derrota = m.animaciones.find((a) => a.clip.name === 'Derrota');
      assert.ok(golpe && !golpe.bucle && golpe.clip.duration <= 0.4, 'falta «Golpe recibido» de una vez y ≤ 0,4 s');
      assert.ok(derrota && !derrota.bucle && derrota.clip.duration <= 1.4, 'falta «Derrota» de una vez y ≤ 1,4 s');
      const mezclador = new THREE.AnimationMixer(m.raiz);
      const accion = mezclador.clipAction(derrota.clip);
      accion.setLoop(THREE.LoopOnce, 1);
      accion.clampWhenFinished = true;
      accion.play();
      mezclador.setTime(derrota.clip.duration);
      m.raiz.updateMatrixWorld(true);
      // Lo más bajo de lo que se ve (sin piezas escondidas a escala casi 0).
      let suelo = Infinity;
      const escala = new THREE.Vector3();
      m.raiz.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.userData.contorno) return;
        escala.setFromMatrixScale(o.matrixWorld);
        if (Math.min(escala.x, escala.y, escala.z) < 0.01) return;
        suelo = Math.min(suelo, new THREE.Box3().setFromObject(o, true).min.y);
      });
      assert.ok(suelo > (SUELO_CONOCIDO[entrada.id] ?? -0.15) && suelo < 0.2, `la derrota acaba con lo más bajo a ${suelo.toFixed(2)} m (debe tocar el suelo)`);
    });
  }

  test(`${entrada.id}: se hornea para la horda sin valores raros`, () => {
    const m = entrada.crear();
    const escena = new THREE.Scene();
    const tropa = new Tropa(escena, entrada.crear, 4, m.animaciones.map((a) => a.clip.name));
    const mundo = new THREE.Matrix4();
    tropa.empezar();
    for (const a of m.animaciones) tropa.poner(mundo, a.clip.name, a.clip.duration / 2);
    tropa.terminar();
    escena.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) {
        assert.ok([...o.instanceMatrix.array].every(Number.isFinite), 'matriz horneada con NaN');
      }
    });
  });
}
