import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOGO } from '../src/modelos/index.ts';
import {
  ALTARES_JEFE, CAJAS, CLIPS_ALTAR_JEFE, CLIPS_ARA, CLIPS_CAJA, CLIPS_NPC, DESAFIOS, ESTRUCTURAS, NPCS, aQuienHabla,
  contextoVoz, detectarIntencion, frase, normalizar, tirarBotin, type EventoNpc,
} from '../src/contenido/mapa.ts';

// El contenido del mapa cita modelos y clips por nombre: si alguien renombra
// un clip, que salte aquí y no en mitad de una partida.

const clipsDe = (id: string) => {
  const entrada = CATALOGO.find((c) => c.id === id);
  assert.ok(entrada, `no hay modelo «${id}» en el catálogo`);
  return new Set(entrada.crear().animaciones.map((a) => a.clip.name));
};
const nombres = (o: Record<string, unknown>) => Object.values(o).filter((v): v is string => typeof v === 'string');

test('contenido: es solo datos (no importa three ni el juego)', () => {
  const fuente = readFileSync(new URL('../src/contenido/mapa.ts', import.meta.url), 'utf8');
  assert.ok(!/^import\s/m.test(fuente), 'src/contenido/mapa.ts no debe importar nada');
});

test('contenido: altares de jefe, sus jefes y sus clips existen', () => {
  for (const a of ALTARES_JEFE) {
    const clips = clipsDe(a.id);
    for (const c of nombres(CLIPS_ALTAR_JEFE)) assert.ok(clips.has(c), `${a.id}: falta el clip ${c}`);
    clipsDe(a.jefe);
    assert.ok(a.recompensa.length > 0, `${a.id} sin recompensa`);
  }
});

test('contenido: el ara, las cajas y las estructuras tienen los clips que se citan', () => {
  const ara = clipsDe('altar-desafio');
  for (const c of nombres(CLIPS_ARA)) assert.ok(ara.has(c), `altar-desafio: falta el clip ${c}`);
  assert.ok(DESAFIOS.length >= 4 && DESAFIOS.every((d) => d.duracion > 0 && d.recompensa.length > 0));
  for (const caja of CAJAS) {
    const clips = clipsDe(caja.id);
    for (const c of nombres(CLIPS_CAJA)) assert.ok(clips.has(c), `${caja.id}: falta el clip ${c}`);
    assert.ok(caja.botin.every((b) => b.peso > 0 && b.da.length > 0), `${caja.id}: botín vacío`);
  }
  for (const e of ESTRUCTURAS) {
    const clips = clipsDe(e.id);
    for (const c of Object.values(e.clips)) assert.ok(clips.has(c), `${e.id}: falta el clip ${c}`);
  }
});

test('contenido: cada NPC tiene su modelo, sus clips, frases para todo y nodo de giro libre', () => {
  const eventos: EventoNpc[] = ['saludo', 'despedida', 'noEntiendo', 'asustado', 'sol', 'sinChatarra', 'yaNoQueda'];
  for (const npc of NPCS) {
    const entrada = CATALOGO.find((c) => c.id === npc.id)!;
    const modelo = entrada.crear();
    const clips = new Set(modelo.animaciones.map((a) => a.clip.name));
    for (const c of nombres(CLIPS_NPC)) assert.ok(clips.has(c), `${npc.id}: falta el clip ${c}`);
    for (const i of npc.intenciones) assert.ok(clips.has(i.clip), `${npc.id}/${i.id}: clip ${i.clip}`);
    // El juego gira `giro` para que mire al jugador: ningún clip puede tocarlo.
    assert.ok(modelo.raiz.getObjectByName('giro'), `${npc.id}: falta el nodo giro`);
    for (const a of modelo.animaciones) {
      assert.ok(a.clip.tracks.every((p) => !p.name.startsWith('giro.')), `${npc.id}/${a.clip.name} toca el nodo giro`);
    }
    for (const ev of eventos) assert.ok(npc.lineas[ev]?.length, `${npc.id}: sin frases para ${ev}`);
    for (const i of npc.intenciones) assert.ok(i.claves.length && i.respuestas.length, `${npc.id}/${i.id} incompleta`);
    assert.ok(contextoVoz(npc, null).includes(npc.voz));
  }
});

test('voz: normaliza tildes, mayúsculas y signos', () => {
  assert.equal(normalizar('¿Dónde está el JEFE?'), 'donde esta el jefe');
  assert.equal(normalizar('Imán, ¡por favor!'), 'iman por favor');
});

test('voz: detecta lo que pide el jugador a cada NPC', () => {
  const npc = (id: string) => NPCS.find((n) => n.id === id)!;
  const casos: [string, string, string | null][] = [
    ['npc-mecanica', '¿Me reparas el traje? Estoy herido', 'reparar'],
    ['npc-mecanica', 'Iris, mejora el dron', 'ajustar_dron'],
    ['npc-mecanica', 'Qué frío hace hoy', null],
    ['npc-vigia', '¿Dónde está el jefe?', 'donde_jefe'],
    ['npc-vigia', 'Tali, ¿hay algún cofre por aquí?', 'donde_caja'],
    ['npc-vigia', '¿Qué viene ahora?', 'peligro'],
    ['npc-botanica', '¿Qué es esto que encontré?', 'reliquia'],
    ['npc-botanica', 'Necesito que no me vean', 'extracto'],
    ['npc-chatarrero', 'Bruno, ¿hacemos un trato?', 'cambiar'],
    ['npc-chatarrero', 'Véndeme el imán', 'iman'],
    ['npc-chatarrero', '¿Qué puedes hacer por mí?', 'ayuda'],
  ];
  for (const [id, texto, esperado] of casos) {
    assert.equal(detectarIntencion(npc(id), texto)?.id ?? null, esperado, `${id}: «${texto}»`);
  }
});

test('voz: decide si habla con un NPC o con el dron', () => {
  assert.equal(aQuienHabla('escanea la zona', ['npc-vigia']), 'dron');
  assert.equal(aQuienHabla('Tali, escanea el horizonte', ['npc-mecanica', 'npc-vigia']), 'npc-vigia');
  assert.equal(aQuienHabla('¿cuánto por una mejora?', ['npc-chatarrero', 'npc-vigia']), 'npc-chatarrero');
  assert.equal(aQuienHabla('hola', []), null);
});

test('voz: frases de respaldo y botín deterministas por semilla', () => {
  const bruno = NPCS.find((n) => n.id === 'npc-chatarrero')!;
  assert.equal(frase(bruno, 'saludo', 3), frase(bruno, 'saludo', 3));
  const caja = CAJAS.find((c) => c.id === 'caja-suministros')!;
  assert.deepEqual(tirarBotin(caja, 0), caja.botin[0].da);
  assert.deepEqual(tirarBotin(caja, 0.999), caja.botin[caja.botin.length - 1].da);
});
