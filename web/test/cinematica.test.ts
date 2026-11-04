import test from 'node:test';
import assert from 'node:assert/strict';
import { DURACION, ESTALLA, LETRAS_POR_SEGUNDO, PLANOS, ROTULOS, planoEn } from '../src/cinematica.ts';
import { INTRO, en } from '../src/cinematica-guion.ts';
import { DURACION_INTRO, ESPERA_INTRO, NOTAS_LETRAS, PARTITURA, PARTITURA_INTRO } from '../src/musica.ts';

test('cinemática: los planos van seguidos y duran menos de minuto y medio', () => {
  const lista = Object.values(PLANOS);
  assert.equal(lista[0][0], 0);
  for (let k = 1; k < lista.length; k++) assert.equal(lista[k][0], lista[k - 1][1], `hueco o solape antes del plano ${k}`);
  assert.equal(lista.at(-1)![1], DURACION);
  assert.ok(DURACION >= 70 && DURACION <= 90, `dura ${DURACION} s`);
  for (const [nombre, [de, a]] of Object.entries(PLANOS)) {
    assert.equal(planoEn((de + a) / 2), nombre);
    assert.ok(a - de >= 2.5, `${nombre} pasa demasiado rápido para leerse`);
  }
});

test('cinemática: cada rótulo da tiempo a leerlo y no pisa a otro de su voz', () => {
  for (const voz of ['narra', 'helios'] as const) {
    const suyos = ROTULOS.filter((r) => r.voz === voz).sort((x, y) => x.de - y.de);
    assert.ok(suyos.length > 0, voz);
    suyos.forEach((r, k) => {
      assert.ok(r.de < r.a && r.a <= DURACION, r.texto);
      // Se escribe letra a letra y después se queda al menos medio segundo entero.
      assert.ok(r.a - r.de >= r.texto.length / LETRAS_POR_SEGUNDO + 0.5, `«${r.texto}» se va antes de poder leerlo`);
      assert.ok(r.texto.length <= 48, `«${r.texto}» es demasiado largo para leerlo a tiempo`);
      // A más de esto ya no da tiempo a leer y a mirar la imagen a la vez.
      if (voz === 'narra') assert.ok(r.texto.length / (r.a - r.de) <= 17, `«${r.texto}» va demasiado rápido`);
      if (k > 0) assert.ok(r.de >= suyos[k - 1].a, `«${r.texto}» pisa a «${suyos[k - 1].texto}»`);
    });
  }
  // HELIOS habla en su lenguaje de protocolo.
  for (const r of ROTULOS.filter((x) => x.voz === 'helios')) assert.equal(r.texto, r.texto.toUpperCase());
});

test('banda: la partitura cabe en la cinemática y sus golpes caen con la imagen', () => {
  for (const n of PARTITURA) {
    const donde = `${n.voz} en ${n.t} s`;
    assert.ok(n.t >= 0 && n.t < DURACION, donde);
    assert.ok(n.dur > 0 && n.vol > 0 && n.vol <= 1, donde);
    // Lo último puede quedar sonando sobre la intro del título, pero poco.
    assert.ok(n.t + n.dur <= DURACION + 3, `${donde} suena demasiado después del final`);
    for (const m of n.notas) assert.ok(m >= 21 && m <= 108, `${donde}: la nota ${m} se sale del piano`);
  }
  const suena = (voz: string, t: number) => PARTITURA.some((n) => n.voz === voz && Math.abs(n.t - t) < 0.01);
  assert.ok(suena('impacto', ESTALLA), 'el impacto cae cuando estalla Ares');
  assert.ok(suena('tambor', en('ciudad', 1.15)) && suena('tambor', en('ciudad', 3.15)), 'los tambores caen con los pisotones del Titán');
  for (const [nombre, [de]] of Object.entries(PLANOS)) {
    assert.ok(PARTITURA.some((n) => Math.abs(n.t - de) < 0.3), `nada suena al empezar el plano «${nombre}»`);
  }
});

test('intro: cada letra del título tiene su nota y son las del tema de Meta', () => {
  assert.equal(NOTAS_LETRAS.length, 'METASPACE'.length);
  assert.deepEqual(NOTAS_LETRAS.slice(0, 3), [74, 76, 78]); // re, mi, fa sostenido: el tema en mayor
});

test('intro: el título entra con el golpe más fuerte de la partitura', () => {
  const golpe = (voz: string) => PARTITURA_INTRO.find((n) => n.voz === voz && Math.abs(n.t - INTRO.sector) < 0.01);
  for (const voz of ['impacto', 'metal', 'platillo', 'trompa']) assert.ok(golpe(voz), `falta ${voz} en el título`);
  const impactos = PARTITURA_INTRO.filter((n) => n.voz === 'impacto');
  assert.equal(Math.max(...impactos.map((n) => n.vol)), golpe('impacto')!.vol);
  // El primer clic salta aquí: tiene que caer después del golpe y antes de que acabe de sonar.
  assert.ok(INTRO.completo > INTRO.sector && INTRO.completo < ESPERA_INTRO);
});

test('intro: suena desde el primer instante y nunca se queda en silencio esperando', () => {
  const sonando = (t: number) => PARTITURA_INTRO.some((n) => n.t <= t && n.t + n.dur > t);
  for (let t = 0.1; t < DURACION_INTRO - 1; t += 0.25) assert.ok(sonando(t), `silencio en el segundo ${t}`);
  for (const n of PARTITURA_INTRO) {
    assert.ok(n.t >= 0 && n.dur > 0 && n.vol > 0, `${n.voz} en ${n.t}`);
    assert.ok(n.t + n.dur <= DURACION_INTRO + 3, `${n.voz} se pasa del final`);
  }
});

test('intro: la música de espera es más suave que la fanfarria', () => {
  const volumen = (de: number, a: number) => Math.max(...PARTITURA_INTRO.filter((n) => n.t >= de && n.t < a).map((n) => n.vol));
  assert.ok(volumen(ESPERA_INTRO, ESPERA_INTRO + 16) * 3 < volumen(INTRO.sector, ESPERA_INTRO));
});
