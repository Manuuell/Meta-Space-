import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ContenidoJuego } from '../src/contenido-juego.ts';
import type { World } from '../src/world.ts';

function mundoPlano(): World {
  let n = 0;
  return {
    arena: 130,
    nave: { x: -9, z: -10, giro: 0 },
    lugares: [],
    heightAt: () => 0,
    acidoEn: () => 0,
    resolve: (x: number, z: number, _r: number, out: { x: number; z: number }) => {
      out.x = x;
      out.z = z;
      return out;
    },
    lugarLibre: (_rand: () => number, distancia: readonly [number, number]) => {
      const a = (n++ / 20) * Math.PI * 2;
      const r = distancia[0] + (distancia[1] - distancia[0]) * 0.5;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    },
  } as unknown as World;
}

function contexto(tiempo: number, dt = 0.1) {
  return {
    tiempo,
    dt,
    px: 0,
    pz: 0,
    bajas: 0,
    danoRecibido: 0,
    balizas: 0,
    enemigosEn: () => 0,
    crearBaliza: () => {},
  };
}

function avanzar(contenido: ContenidoJuego, desde: number, segundos: number) {
  let t = desde;
  for (let i = 0; i < Math.ceil(segundos * 10); i++) {
    t += 0.1;
    contenido.update(contexto(t));
  }
  return t;
}

test('contenido jugable: encadena Cosecha, Heraldo y Ojo desde sus altares', () => {
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: () => {},
    curar: () => {},
  });

  let t = avanzar(contenido, 180, 7);
  let objetivo = contenido.objetivoJefe.find((o) => o.id === 'segador-jefe');
  assert.ok(objetivo, 'no apareció el Jefe de Cosecha');
  objetivo.golpear(1e9);

  t = avanzar(contenido, 300, 7);
  objetivo = contenido.objetivoJefe.find((o) => o.id === 'heraldo');
  assert.ok(objetivo, 'no apareció el Heraldo tras derrotar al primer jefe');
  objetivo.golpear(1e9);

  t = avanzar(contenido, 540, 8);
  objetivo = contenido.objetivoJefe.find((o) => o.id === 'ojo-helios');
  assert.ok(objetivo, 'no apareció el Ojo tras derrotar al Heraldo');
  assert.ok(t > 540);
});

test('contenido jugable: no coloca al chatarrero sin nombre nuevo y limpia suministros al reiniciar', () => {
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: () => {},
    curar: () => {},
  });
  assert.equal(contenido.marcas.some((m) => m.id === 'npc-chatarrero'), false);
  const cajasIniciales = contenido.marcas.filter((m) => m.tipo === 'caja').length;
  contenido.update(contexto(121));
  assert.equal(contenido.marcas.filter((m) => m.tipo === 'caja').length, cajasIniciales + 1);
  contenido.reset();
  assert.equal(contenido.marcas.filter((m) => m.tipo === 'caja').length, cajasIniciales);
});
