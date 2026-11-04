import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ContenidoJuego } from '../src/contenido-juego.ts';
import { DRAGON } from '../src/contenido/mapa.ts';
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

function contexto(tiempo: number, dt = 0.1, px = 0, pz = 0) {
  return {
    tiempo,
    dt,
    px,
    pz,
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
    // El jugador se queda junto al siguiente altar: solo despiertan si te acercas.
    const altar = contenido.marcas.find((m) => m.tipo === 'altar' && !m.hecho);
    contenido.update(contexto(t, 0.1, altar?.x ?? 0, altar?.z ?? 0));
  }
  return t;
}

test('contenido jugable: encadena los cuatro jefes desde sus altares', () => {
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: () => {},
    curar: () => {},
  });

  avanzar(contenido, 180, 7);
  let objetivo = contenido.objetivoJefe.find((o) => o.id === 'golem-escoria');
  assert.ok(objetivo, 'no apareció el Gólem de Escoria');
  objetivo.golpear(1e9);

  avanzar(contenido, 300, 8);
  objetivo = contenido.objetivoJefe.find((o) => o.id === 'sabueso-helios');
  assert.ok(objetivo, 'no apareció el Cancerbero tras derrotar al primero');
  objetivo.golpear(1e9);

  avanzar(contenido, 420, 8);
  objetivo = contenido.objetivoJefe.find((o) => o.id === 'golem-escarcha');
  assert.ok(objetivo, 'no apareció el Coloso de Escarcha tras derrotar al Cancerbero');
  objetivo.golpear(1e9);

  const t = avanzar(contenido, 540, 8);
  objetivo = contenido.objetivoJefe.find((o) => o.id === 'golem-titan');
  assert.ok(objetivo, 'no apareció el Titán tras derrotar al Coloso');
  assert.ok(t > 540);
});

test('contenido jugable: el gólem avisa antes de golpear, y el golpe empuja', () => {
  const avisos: number[] = [];
  const empujes: number[] = [];
  let t = 180;
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: () => {},
    curar: () => {},
    aviso: () => { avisos.push(t); },
    empujar: (fx, fz) => { if (Math.hypot(fx, fz) > 3) empujes.push(t); },
  });
  // Acércate al altar para que salga y quédate quieto pegado a él.
  const altar = contenido.marcas.find((m) => m.tipo === 'altar')!;
  for (let i = 0; i < 20; i++) contenido.update({ ...contexto(t, 0.05), px: altar.x, pz: altar.z });
  let primerGolpe = -1;
  for (let i = 0; i < 400 && primerGolpe < 0; i++) {
    t += 0.05;
    const g = contenido.objetivoJefe.find((o) => o.id === 'golem-escoria');
    const px = g ? g.x + 4 : 0, pz = g ? g.z : 0;
    const dano = contenido.update({ ...contexto(t, 0.05), px, pz });
    if (g && dano > 5) primerGolpe = t;
  }
  assert.ok(primerGolpe > 0, 'el gólem no golpeó a un jugador quieto a su lado');
  const avisoPrevio = avisos.filter((a) => a < primerGolpe).pop();
  assert.ok(avisoPrevio !== undefined && primerGolpe - avisoPrevio >= 0.8, `aviso con poco margen: ${avisoPrevio} → ${primerGolpe}`);
  assert.ok(empujes.some((e) => Math.abs(e - primerGolpe) < 0.2), 'el golpe no empujó al jugador');
});

test('contenido jugable: los jefes de antes salen solos como minijefes y sueltan botín', () => {
  const efectos: unknown[] = [];
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: (e) => { efectos.push(...e); },
    curar: () => {},
  });
  avanzar(contenido, 169, 5);
  const mini = contenido.objetivoJefe.find((o) => o.id.startsWith('segador-jefe'));
  assert.ok(mini, 'no salió el primer minijefe');
  mini.golpear(1e9);
  assert.ok(efectos.some((e) => (e as { tipo: string }).tipo === 'chatarra'), 'el minijefe no soltó chatarra');
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

test('contenido jugable: el pilón se carga estando dentro, se descarga fuera y da a elegir una bendición', () => {
  const efectos: unknown[] = [];
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: (e) => { efectos.push(...e); },
    curar: () => {},
  });
  const pilon = contenido.marcas.find((m) => m.tipo === 'pilon')!;
  assert.ok(pilon, 'no hay pilones en el mapa');
  const en = (t: number, x: number, z: number) => contenido.update({ ...contexto(t), px: x, pz: z });

  // Dos segundos dentro: a medio cargar.
  for (let i = 0; i < 20; i++) en(1 + i * 0.1, pilon.x, pilon.z);
  const media = contenido.cargaPilon!;
  assert.ok(media > 0.4 && media < 0.6, `carga a medias: ${media}`);
  // Fuera se descarga despacio, sin perderlo todo.
  for (let i = 0; i < 10; i++) en(3 + i * 0.1, pilon.x + 30, pilon.z);
  assert.equal(contenido.cargaPilon, null);
  for (let i = 0; i < 40; i++) en(4 + i * 0.1, pilon.x, pilon.z);
  assert.deepEqual(efectos, [{ tipo: 'bendicion', elegir: 3, suerte: 0 }]);
  assert.ok(contenido.marcas.find((m) => m.id === pilon.id)?.hecho, 'el pilón no queda gastado');
});

test('contenido jugable: los cofres de HELIOS se pagan con F y cada uno cuesta más', () => {
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: () => {},
    curar: () => {},
  });
  const cofres = contenido.marcas.filter((m) => m.tipo === 'caja' && m.coste !== undefined);
  assert.ok(cofres.length >= 2);
  const [a, b] = cofres;
  // Acercarse no basta: sin pagar no se abre.
  for (let i = 0; i < 40; i++) contenido.update({ ...contexto(1 + i * 0.1), px: a.x, pz: a.z });
  assert.equal(contenido.marcas.find((m) => m.id === a.id)?.hecho, false);
  assert.equal(contenido.interaccionCofre(a.x, a.z, 0)?.bloqueado, true);
  assert.equal(contenido.abrirCofre(a.x, a.z, a.coste! - 1), -2);
  assert.equal(contenido.abrirCofre(a.x, a.z, 999), a.coste);
  assert.equal(contenido.marcas.find((m) => m.id === a.id)?.hecho, true);
  const siguiente = contenido.marcas.find((m) => m.id === b.id)!.coste!;
  assert.ok(siguiente > a.coste!, `el segundo cofre no sube de precio (${siguiente})`);
  assert.equal(contenido.abrirCofre(500, 500, 999), -1);
});

test('contenido jugable: el aliento del Cancerbero quema dentro del cono y no fuera', () => {
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), { toast: () => {}, aplicar: () => {}, curar: () => {} });
  avanzar(contenido, 300, 7);
  const golem = (contenido as unknown as { golem: { def: { id: string }; x: number; z: number; giro: number; empezar: (t: string, j: unknown) => void; estado: string; descanso: number } }).golem;
  assert.equal(golem.def.id, 'sabueso-helios');
  const quemado = (lado: number) => {
    // Jugador a 6 m: delante (lado 0) o a 90° (lado 1).
    const a = golem.giro + lado * Math.PI / 2;
    const px = golem.x + Math.sin(a) * 6, pz = golem.z + Math.cos(a) * 6;
    golem.estado = 'perseguir';
    golem.descanso = 99;
    golem.empezar('aliento', { x: golem.x + Math.sin(golem.giro) * 6, z: golem.z + Math.cos(golem.giro) * 6, vx: 0, vz: 0, dt: 0 });
    let dano = 0;
    for (let i = 0; i < 26; i++) dano += contenido.update({ ...contexto(306 + i * 0.1), px, pz });
    return dano;
  };
  assert.ok(quemado(0) > 20, 'el aliento no quema delante');
  assert.ok(quemado(1) < 5, 'el aliento quema fuera del cono');
});

test('contenido jugable: los duelos dan el Cañón; el dragón llega sin ellos, una vez por partida, y solo baja posado', () => {
  const efectos: { tipo: string }[] = [];
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: (e) => { efectos.push(...(e as { tipo: string }[])); },
    curar: () => {},
  });
  const duelos = contenido.marcas.filter((m) => m.tipo === 'duelo');
  assert.equal(duelos.length, 3);
  let t = 30;
  const ganar = (duelo: { x: number; z: number }) => {
    assert.ok(contenido.empezarDuelo(duelo.x, duelo.z), 'no empezó el duelo');
    for (let i = 0; i < 40; i++) contenido.update({ ...contexto((t += 0.1)), px: duelo.x, pz: duelo.z });
    for (const o of contenido.objetivoJefe.filter((x) => x.id.startsWith('altar-duelo'))) o.golpear(1e9);
    contenido.update({ ...contexto((t += 0.1)), px: duelo.x, pz: duelo.z });
  };
  ganar(duelos[0]);
  assert.ok(efectos.some((e) => e.tipo === 'canon'), 'el primer duelo no dio el Cañón');
  ganar(duelos[1]);
  assert.equal(contenido.marcas.some((m) => m.tipo === 'dragon'), false, 'los duelos ya no despiertan al dragón');

  const marcaHud = () => contenido.jefesHud.find((j) => j.nombre === DRAGON.nombre);
  assert.equal(marcaHud()?.minuto, DRAGON.minuto, 'la barra no anuncia al dragón');
  assert.equal(contenido.llamarDragon(0, 0), true);
  assert.equal(contenido.llamarDragon(0, 0), false, 'llegó dos veces');
  assert.ok(contenido.marcas.some((m) => m.tipo === 'dragon'), 'el dragón no llegó');

  // En el aire: las herramientas no le llegan, el rayo sí.
  for (let i = 0; i < 80; i++) contenido.update({ ...contexto((t += 0.1)), px: 0, pz: 0 });
  assert.equal(contenido.objetivoJefe.some((o) => o.id === 'dragon'), false, 'el dragón en el aire recibe las herramientas');
  const dragon = (contenido as unknown as { dragon: { x: number; z: number; vida: number; esferas: () => { x: number; y: number; z: number }[] } }).dragon;
  const e = dragon.esferas()[1];
  const o = { x: e.x, y: e.y - 20, z: e.z };
  const acierto = contenido.rayo(o, { x: 0, y: 1, z: 0 }, 90);
  assert.ok(acierto, 'el rayo no acierta al dragón');
  const antes = dragon.vida;
  acierto.golpear(100);
  assert.ok(dragon.vida < antes);

  // Tras perder un cuarto de vida acaba posándose, y entonces le llega todo.
  acierto.golpear(dragon.vida * 0.3);
  let posado = false;
  for (let i = 0; i < 400 && !posado; i++) {
    contenido.update({ ...contexto((t += 0.1)), px: 0, pz: 0 });
    posado = contenido.objetivoJefe.some((x) => x.id === 'dragon');
  }
  assert.ok(posado, 'el dragón no se posó');

  // Vencido no vuelve en esta partida; la siguiente trae el suyo.
  contenido.objetivoJefe.find((x) => x.id === 'dragon')!.golpear(1e9);
  assert.equal(marcaHud()?.vencido, true);
  for (let i = 0; i < 200; i++) contenido.update({ ...contexto((t += 0.1)), px: 0, pz: 0 });
  assert.equal(contenido.marcas.some((m) => m.tipo === 'dragon'), false, 'el dragón vencido sigue en el mapa');
  assert.equal(contenido.llamarDragon(0, 0), false, 'el dragón vencido volvió');
  contenido.reset();
  assert.equal(marcaHud()?.vencido, false);
  assert.equal(contenido.llamarDragon(0, 0), true, 'la partida nueva no trajo dragón');
});

test('restos de cohete: se recuperan quedándose al lado y cambian de sitio en cada sector', () => {
  const recogidos: string[] = [];
  const oleadas: number[] = [];
  const contenido = new ContenidoJuego(new THREE.Scene(), mundoPlano(), {
    toast: () => {},
    aplicar: () => {},
    curar: () => {},
    fragmento: (r) => recogidos.push(r),
    emboscada: (_x, _z, n) => oleadas.push(n),
  });
  assert.equal(contenido.restos.total, 12, 'dos por cada ranura de la nave');
  const r = contenido.restoCercano(0, 0)!;
  // Si te vas antes de tiempo, no cuenta.
  for (let i = 0; i < 20; i++) contenido.update({ ...contexto(i * 0.1), px: r.x, pz: r.z });
  for (let i = 0; i < 40; i++) contenido.update({ ...contexto(2 + i * 0.1), px: 500, pz: 500 });
  assert.equal(recogidos.length, 0);
  for (let i = 0; i < 32; i++) contenido.update({ ...contexto(6 + i * 0.1), px: r.x, pz: r.z });
  assert.deepEqual(recogidos, [r.ranura]);
  assert.equal(contenido.restos.recogidos, 1);
  assert.equal(oleadas.length, 1, 'HELIOS responde una vez por resto, aunque te vayas y vuelvas');
  assert.ok(contenido.marcas.some((m) => m.tipo === 'fragmento' && m.hecho), 'sale hecho en el mapa');
  contenido.reset();
  assert.equal(contenido.restos.recogidos, 0, 'el sector siguiente vuelve a tenerlos todos');
});
