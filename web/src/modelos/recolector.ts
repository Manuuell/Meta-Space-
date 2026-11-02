import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, capsula, ciclo, cono, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses,
  rot, toon, toro, type Modelo,
} from './kit.ts';

// Recolector: un cubo de basura blindado con patitas, un ojo enorme de pupila
// roja medio tapado por un párpado de chapa, sonrisa de dientes, cristales
// púrpura en la tapa y una trompa de aspiradora para chupar la señal de ADA.
// La tapa se abre al atacar. Mira hacia +z; mide unos 1,4 m.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);

export function crearRecolector(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'recolector';
  const cuerpo = nodo('cuerpo', raiz);

  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const pata = nodo(`pata_${lado}`, cuerpo, 0.24 * s, 0.32, 0);
    pieza(pata, capsula(0.09, 0.14), toon(PALETA.metalOscuro), 0, -0.14, 0);
    pieza(pata, caja(0.24, 0.12, 0.32, 0.05), toon(PALETA.oscuroHelios), 0, -0.28, 0.05);
    pieza(pata, caja(0.18, 0.03, 0.04, 0.012), brillo(PALETA.purpuraBrillo), 0, -0.27, 0.21, { contorno: false });
  }

  const tronco = nodo('tronco', cuerpo, 0, 0.72, 0);
  pieza(tronco, barril(0.46, 0.52, 0.78, 0.16), toon(PALETA.metalHelios));
  pieza(tronco, toro(0.52, 0.05), brillo(PALETA.purpuraBrillo), 0, -0.3, 0);
  // Sonrisa de dientes sobre la trompa.
  pieza(tronco, caja(0.4, 0.12, 0.08, 0.04), toon(PALETA.oscuroHelios), 0, -0.13, 0.47);
  for (const x of [-0.13, -0.045, 0.045, 0.13]) {
    pieza(tronco, cono(0.04, 0.09).rotateX(Math.PI), toon(PALETA.diente), x, -0.11, 0.51, { contorno: false });
  }
  pieza(tronco, toro(0.48, 0.03), toon(PALETA.metalOscuro), 0, 0.2, 0);

  // Tapa con bisagra atrás: rotar en x negativo la abre.
  const tapa = nodo('tapa', tronco, 0, 0.38, -0.42);
  pieza(tapa, esfera(0.5, 1, 0.42, 1), toon(PALETA.chapaHelios), 0, 0.04, 0.42);
  // Cristales púrpura que le crecen en la tapa.
  for (const [x, z, inclina, alto] of [[0, 0.28, -0.25, 0.3], [0.2, 0.5, 0.45, 0.22], [-0.2, 0.5, -0.45, 0.22], [-0.05, 0.62, 0.1, 0.16]] as const) {
    const c = pieza(tapa, cono(0.07, alto), toon(PALETA.purpura), x, 0.2 + alto / 2, z);
    c.rotation.set(z > 0.4 ? 0.35 : -0.2, 0, inclina);
  }
  pieza(tapa, capsula(0.02, 0.16), toon(PALETA.metalOscuro), 0.18, 0.3, 0.38);
  const luz = nodo('luz', tapa, 0.18, 0.44, 0.38);
  pieza(luz, esfera(0.055), brillo(PALETA.helios), 0, 0, 0, { contorno: false });

  const elOjo = ojo(tronco, 'c', 0.27, 0, 0.1, 0.5, PALETA.helios);
  // Párpado de chapa: tapa la parte de arriba del ojo y le da cara de malo.
  pieza(elOjo, esfera(0.29, 1, 0.55, 0.66), toon(PALETA.chapaHelios), 0, 0.17, 0.01);
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const ceja = nodo(`ceja_${lado}`, tronco, 0.12 * s, 0.38, 0.55);
    ceja.rotation.z = THREE.MathUtils.degToRad(-30 * s);
    pieza(ceja, caja(0.27, 0.085, 0.08, 0.03), toon(PALETA.oscuroHelios));
  }

  // Trompa de aspiradora: tres tramos encadenados que se curvan hacia el suelo.
  const tramo = capsula(0.075, 0.16).rotateX(Math.PI / 2);
  const t1 = nodo('trompa1', tronco, 0, -0.22, 0.44);
  pieza(t1, tramo, toon(PALETA.oscuro), 0, 0, 0.13);
  const t2 = nodo('trompa2', t1, 0, 0, 0.26);
  pieza(t2, tramo, toon(PALETA.oscuro), 0, 0, 0.13);
  pieza(t2, toro(0.085, 0.025).rotateX(Math.PI / 2), toon(PALETA.helios), 0, 0, 0);
  const t3 = nodo('trompa3', t2, 0, 0, 0.26);
  const boquilla = nodo('boquilla', t3, 0, 0, 0.08);
  pieza(boquilla, barril(0.09, 0.15, 0.16, 0.04).rotateX(Math.PI / 2), toon(PALETA.purpura), 0, 0, 0.04);
  pieza(boquilla, toro(0.13, 0.025).rotateX(Math.PI / 2), brillo(PALETA.purpuraBrillo), 0, 0, 0.12, { contorno: false });

  const reposoTrompa = { t1: 38, t2: 18, t3: 12 };
  t1.rotation.x = THREE.MathUtils.degToRad(reposoTrompa.t1);
  t2.rotation.x = THREE.MathUtils.degToRad(reposoTrompa.t2);
  t3.rotation.x = THREE.MathUtils.degToRad(reposoTrompa.t3);
  const trompa = (d: number, fn: (f: number, i: number) => readonly [number, number, number]) =>
    (['trompa1', 'trompa2', 'trompa3'] as const).map((n, i) => rot(n, ciclo(d, (f) => fn(f, i))));
  const baseTrompa = (i: number) => [reposoTrompa.t1, reposoTrompa.t2, reposoTrompa.t3][i];
  const parpadear = (d: number, en: number) => esc('ojo_c', parpadeo(d, en));

  const animaciones = [
    animacion('Reposo', 1.6, [
      esc('cuerpo', ciclo(1.6, (f) => [1 + 0.025 * sen(f, 2), 1 - 0.025 * sen(f, 2), 1 + 0.025 * sen(f, 2)])),
      mov(raiz, 'pupila_c', ciclo(1.6, (f) => [sen(f) * 0.07, Math.max(0, sen(f, 2)) * 0.02, 0])),
      ...trompa(1.6, (f, i) => [baseTrompa(i) + sen(f, 1, i * 0.12) * 6, sen(f, 1, i * 0.12) * 10, 0]),
      rot('tapa', ciclo(1.6, (f) => [-Math.max(0, sen(f, 2)) * 4, 0, 0])),
      esc('luz', ciclo(1.6, (f) => { const k = sen(f, 4) > 0 ? 1 : 0.25; return [k, k, k]; })),
      parpadear(1.6, 1.1),
    ], 'movimiento', 'Respira aplastándose, mira alrededor y olfatea con la trompa.'),

    animacion('Caminar', 0.5, [
      rot('pata_i', ciclo(0.5, (f) => [sen(f) * 30, 0, 0])),
      rot('pata_d', ciclo(0.5, (f) => [-sen(f) * 30, 0, 0])),
      mov(raiz, 'pata_i', ciclo(0.5, (f) => [0, Math.max(0, sen(f)) * 0.08, 0])),
      mov(raiz, 'pata_d', ciclo(0.5, (f) => [0, Math.max(0, -sen(f)) * 0.08, 0])),
      rot('tronco', ciclo(0.5, (f) => [8, 0, sen(f) * 10])),
      mov(raiz, 'cuerpo', ciclo(0.5, (f) => [0, 0.05 * (1 - Math.cos(f * TAU * 2)) / 2, 0])),
      rot('tapa', ciclo(0.5, (f) => [-3 - Math.max(0, sen(f, 2)) * 8, 0, 0])),
      ...trompa(0.5, (f, i) => [baseTrompa(i) - 8, sen(f, 1, -i * 0.1) * 14, 0]),
      esc('luz', ciclo(0.5, (f) => { const k = sen(f, 2) > 0 ? 1 : 0.25; return [k, k, k]; })),
    ], 'movimiento', 'Anda como un pato, bamboleando el cubo y la tapa.'),

    animacion('Aspirar', 0.8, [
      rot('tronco', poses([[0, 0, 0, 0], [0.25, -18, 0, 0], [0.4, 28, 0, 0], [0.6, 20, 0, 0], [0.8, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.25, 0, 0, -0.1], [0.4, 0, 0.05, 0.35], [0.8, 0, 0, 0]])),
      rot('tapa', poses([[0, 0, 0, 0], [0.3, -10, 0, 0], [0.42, -55, 0, 0], [0.65, -40, 0, 0], [0.8, 0, 0, 0]])),
      rot('trompa1', poses([[0, 38, 0, 0], [0.25, 0, 0, 0], [0.42, 8, 0, 0], [0.65, 8, 0, 0], [0.8, 38, 0, 0]])),
      rot('trompa2', poses([[0, 18, 0, 0], [0.25, -25, 0, 0], [0.42, 0, 0, 0], [0.8, 18, 0, 0]])),
      rot('trompa3', poses([[0, 12, 0, 0], [0.25, -15, 0, 0], [0.42, 0, 0, 0], [0.8, 12, 0, 0]])),
      esc('boquilla', poses([[0, 1, 1, 1], [0.42, 1.45, 1.45, 1], [0.5, 0.8, 0.8, 1], [0.58, 1.35, 1.35, 1], [0.8, 1, 1, 1]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.25, 1.15, 1.3, 1], [0.42, 1, 0.8, 1], [0.8, 1, 1, 1]])),
      rot('ceja_i', poses([[0, 0, 0, -30], [0.25, 0, 0, -45], [0.8, 0, 0, -30]])),
      rot('ceja_d', poses([[0, 0, 0, 30], [0.25, 0, 0, 45], [0.8, 0, 0, 30]])),
    ], 'ataque', 'Coge impulso, abre la tapa y se lanza a aspirar con la trompa.', false),

    animacion('Golpe recibido', 0.35, [
      esc('cuerpo', poses([[0, 1, 1, 1], [0.05, 1.25, 0.75, 1.25], [0.15, 0.9, 1.1, 0.9], [0.35, 1, 1, 1]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.05, 1.2, 0.2, 1], [0.22, 1, 1, 1], [0.35, 1, 1, 1]])),
      rot('tronco', poses([[0, 0, 0, 0], [0.08, -10, 0, 12], [0.18, 4, 0, -8], [0.35, 0, 0, 0]])),
    ], 'reaccion', 'Se aplasta, cierra el ojo y se tambalea.', false),

    animacion('Derrota', 0.9, [
      rot('cuerpo', ciclo(0.9, (f) => [0, 720 * (1 - (1 - f) ** 2), 0])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.5, 1.1, 0.9, 1.1], [0.75, 1.5, 0.2, 1.5], [0.9, 1.6, 0.12, 1.6]])),
      mov(raiz, 'tapa', poses([[0, 0, 0, 0], [0.3, 0, 0, 0], [0.6, 0, 1.1, 0], [0.9, 0, 0.7, 0]])),
      rot('tapa', poses([[0, 0, 0, 0], [0.3, 0, 0, 0], [0.9, -260, 0, 30]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.3, 1.3, 1.3, 1], [0.5, 1.2, 0.1, 1], [0.9, 1.2, 0.1, 1]])),
    ], 'reaccion', 'Gira como una peonza, se aplasta y la tapa sale volando.', false),
  ];

  return { id: 'recolector', nombre: 'Recolector', rol: 'Unidad de HELIOS · horda', raiz, animaciones };
}
