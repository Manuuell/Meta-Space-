import * as THREE from 'three';
import {
  PALETA, animacion, barra, brillo, capsula, ciclo, curva, esc, esfera, mov, nodo, ojo, parpadeo, pieza, porFotograma,
  poses, punta, rot, toon, toro, type Modelo, type Pose,
} from './kit.ts';

// Sembrador: el jardinero de HELIOS. Una planta mecánica sobre tres raíces
// de metal con garras púrpura, un bulbo púrpura enjaulado lleno de esporas
// que brillan, un tallo con dos tubos por donde suben burbujas y una flor de
// pétalos de chapa y púrpura con un ojo de pupila roja en el centro, cejas en
// V y una corona de dientes. Mira hacia +z; mide 2 m.
//
// Disparar dura 4 s y va en fase con el juego (`quiereDisparar`: escupe al
// empezar cada ciclo de 4 s): se hincha y cierra la flor de 3,4 a 4 s (la
// telegrafía), y en 0 s la abre de golpe y escupe la espora.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const CICLO = 4;
const PATAS = [['a', 60], ['b', 180], ['c', 300]] as const;

export function crearSembrador(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'sembrador';
  const cuerpo = nodo('cuerpo', raiz);

  // Tres raíces-patas: arco hacia fuera, bajada y garra.
  for (const [n, grados] of PATAS) {
    const a = THREE.MathUtils.degToRad(grados);
    const dx = Math.sin(a), dz = Math.cos(a);
    const pata = nodo(`pata_${n}`, cuerpo);
    barra(pata, [dx * 0.08, 0.44, dz * 0.08], [dx * 0.36, 0.52, dz * 0.36], 0.06, toon(PALETA.metalOscuro));
    barra(pata, [dx * 0.36, 0.52, dz * 0.36], [dx * 0.52, 0.12, dz * 0.52], 0.05, toon(PALETA.metalOscuro));
    const garra = pieza(pata, punta(0.07, 0.2).rotateX(Math.PI), toon(PALETA.purpura), dx * 0.56, 0.08, dz * 0.56);
    garra.rotation.set(dz * 0.4, 0, -dx * 0.4);
  }

  // Tallo con el bulbo enjaulado.
  const tallo = nodo('tallo', cuerpo, 0, 0.42, 0);
  pieza(tallo, esfera(0.16, 1, 0.8, 1), toon(PALETA.oscuroHelios));
  const bulbo = nodo('bulbo', tallo, 0, 0.38, 0);
  pieza(bulbo, esfera(0.31, 1, 1.05, 1), toon(PALETA.purpura));
  for (const [x, y, z] of [[0.21, 0.12, 0.17], [-0.23, -0.05, 0.16], [0.05, 0.2, -0.23], [-0.13, 0.17, 0.22], [0.26, -0.14, -0.09], [-0.18, -0.19, -0.18]] as const) {
    pieza(bulbo, esfera(0.055), brillo(PALETA.purpuraBrillo), x, y, z, { contorno: false });
  }
  // Jaula: tres costillas de metal y un collar arriba.
  for (const giro of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    pieza(bulbo, toro(0.315, 0.032).scale(1, 1, 1.05).rotateX(Math.PI / 2).rotateY(giro + Math.PI / 6), toon(PALETA.metalOscuro));
  }
  pieza(bulbo, esfera(0.17, 1, 0.5, 1), toon(PALETA.metalOscuro), 0, 0.31, 0);
  const polvo = nodo('polvo', tallo, 0, 0.38, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    pieza(polvo, esfera(0.1), brillo(PALETA.purpuraBrillo), Math.sin(a) * 0.38, (k % 2) * 0.2 - 0.1, Math.cos(a) * 0.38, { contorno: false, sombra: false });
  }
  polvo.scale.setScalar(0.001);

  // Cuello: tallo de chapa y dos tubos con burbujas que suben.
  const cuello = nodo('cuello', tallo, 0, 0.7, 0);
  barra(cuello, [0, -0.05, 0], [0, 0.42, 0.05], 0.065, toon(PALETA.metalHelios));
  for (const s of [1, -1]) barra(cuello, [0.1 * s, -0.08, 0], [0.08 * s, 0.4, 0.04], 0.032, toon(PALETA.metalOscuro));
  const burbujas = nodo('burbujas', cuello);
  for (let k = 0; k < 4; k++) {
    const s = k % 2 ? 1 : -1;
    pieza(burbujas, esfera(0.034), brillo(PALETA.purpuraBrillo), 0.095 * s, k * 0.1, 0.02 + k * 0.006, { contorno: false, sombra: false });
  }

  // Flor: copa de chapa, ojo, cejas en V, corona de dientes y pétalos.
  const cabeza = nodo('cabeza', cuello, 0, 0.46, 0.06);
  cabeza.rotation.x = 0.15;
  pieza(cabeza, esfera(0.24, 1, 1, 0.6), toon(PALETA.chapaHelios), 0, 0, -0.03);
  pieza(cabeza, toro(0.2, 0.022).rotateX(Math.PI / 2), brillo(PALETA.purpuraBrillo), 0, 0, 0.07, { contorno: false });
  ojo(cabeza, 'c', 0.13, 0, -0.01, 0.07, PALETA.helios);
  for (const s of [1, -1]) {
    const ceja = pieza(cabeza, capsula(0.03, 0.1).rotateZ(Math.PI / 2), toon(PALETA.chapaHelios), 0.07 * s, 0.13, 0.15);
    ceja.rotation.z = 0.5 * s;
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    if (Math.sin(a) > 0.5) continue; // arriba van las cejas
    const diente = pieza(cabeza, punta(0.03, 0.08).rotateZ(a + Math.PI / 2), toon(PALETA.diente), Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.1, { contorno: false });
    diente.rotation.x = 0.3;
  }
  // Pétalos: se abren o se cierran escalando el nodo (cerrados, son un capullo).
  const petalos = nodo('petalos', cabeza, 0, 0, 0.02);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 2 + Math.PI / 6;
    const geo = punta(0.12, 0.4).scale(1, 1, 0.3).translate(0, 0.2, 0).rotateX(0.6).rotateZ(a - Math.PI / 2)
      .translate(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0);
    pieza(petalos, geo, toon(k % 2 ? PALETA.purpura : PALETA.chapaHelios));
  }
  // La espora que escupe (escondida en reposo).
  const espora = nodo('espora', cabeza, 0, 0, 0.18);
  pieza(espora, esfera(0.13), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false, sombra: false });
  espora.scale.setScalar(0.001);

  const subir = (d: number, veces: number) => mov(raiz, 'burbujas', ciclo(d, (f) => [0, ((f * veces) % 1) * 0.1, 0]));
  /** Pasos: cada raíz se levanta y avanza por turnos. */
  const pasos = (f: number, peso = 1): Pose['mov'] => Object.fromEntries(PATAS.map(([n], k) => {
    const s = sen(f, 1, -k / 3);
    return [`pata_${n}`, [0, Math.max(0, s) * 0.12 * peso, Math.cos((f - k / 3) * TAU) * 0.07 * peso] as const];
  }));

  /** El ciclo del juego en 4 s: escupe en 0, pasea, y se hincha desde 3,4 s. */
  const disparar = (t: number): Pose => {
    t %= CICLO;
    const andar = THREE.MathUtils.smoothstep(t, 0.6, 0.8) * (1 - THREE.MathUtils.smoothstep(t, 3.0, 3.2));
    const hincha = THREE.MathUtils.smoothstep(t, 3.4, 3.97);
    const fase = ((t - 0.6) / 0.65) % 1;
    const abre = curva(t, [[0, 1.3], [0.12, 1.15], [0.6, 1], [3.4, 1], [3.97, 0.42], [4, 1.3]]);
    const temblor = hincha * Math.sin(t * 80) * 3;
    return {
      mov: {
        ...pasos(fase, andar),
        tallo: [0, andar * Math.abs(sen(fase, 1.5)) * 0.03 - hincha * 0.06, 0],
        espora: [0, 0, curva(t, [[0, 0.05], [0.18, 0.75], [4, 0.75]])],
      },
      rot: {
        cuello: [curva(t, [[0, -20], [0.12, -24], [0.5, 4], [0.7, 0], [3.4, 0], [3.97, -14], [4, -20]]), andar * sen(fase) * 5, andar * sen(fase) * 6 + temblor],
        cabeza: [curva(t, [[0, -2], [0.15, 0], [0.5, 14], [0.7, 9], [3.4, 9], [3.97, 22], [4, -2]]), 0, 0],
      },
      esc: {
        bulbo: [
          curva(t, [[0, 0.8], [0.12, 0.88], [0.5, 1.04], [0.7, 1], [3.4, 1], [3.97, 1.34], [4, 0.8]]),
          curva(t, [[0, 0.78], [0.12, 0.9], [0.5, 1.05], [0.7, 1], [3.4, 1], [3.97, 1.3], [4, 0.78]]),
          curva(t, [[0, 0.8], [0.12, 0.88], [0.5, 1.04], [0.7, 1], [3.4, 1], [3.97, 1.34], [4, 0.8]]),
        ],
        petalos: [abre, abre, 1 + (1 - abre) * 0.9],
        espora: Array(3).fill(curva(t, [[0, 1.1], [0.15, 0.9], [0.24, 0.001], [4, 0.001]])) as [number, number, number],
        pupila_c: Array(3).fill(1 + hincha * 0.5) as [number, number, number],
      },
    };
  };

  const animaciones = [
    animacion('Reposo', 1.6, [
      rot('cuello', ciclo(1.6, (f) => [sen(f, 1, 0.25) * 4, sen(f) * 10, sen(f) * 5])),
      rot('cabeza', ciclo(1.6, (f) => [9 + sen(f, 2) * 3, sen(f, 1, 0.1) * 8, 0])),
      esc('bulbo', ciclo(1.6, (f) => { const k = 1 + 0.045 * sen(f, 2); return [k, k * 1.02, k]; })),
      esc('petalos', ciclo(1.6, (f) => [1 + 0.06 * sen(f, 2, 0.1), 1 + 0.06 * sen(f, 2, 0.1), 1])),
      mov(raiz, 'pupila_c', ciclo(1.6, (f) => [sen(f) * 0.03, 0, 0])),
      subir(1.6, 4),
      esc('ojo_c', parpadeo(1.6, 1.15)),
    ], 'movimiento', 'Se mece, el bulbo late, los pétalos respiran y las burbujas suben por los tubos.'),

    animacion('Caminar', 1.0, [
      ...Object.entries(pasos(0)!).map(([n]) => mov(raiz, n, ciclo(1, (f) => pasos(f)![n]))),
      mov(raiz, 'tallo', ciclo(1, (f) => [0, Math.abs(sen(f, 1.5)) * 0.04, 0])),
      rot('cuello', ciclo(1, (f) => [4, sen(f) * 8, sen(f) * 8])),
      rot('cabeza', ciclo(1, (f) => [9 - sen(f, 3) * 3, -sen(f) * 6, 0])),
      esc('bulbo', ciclo(1, (f) => { const k = 1 + 0.03 * sen(f, 3); return [k, 1 / k, k]; })),
      subir(1, 3),
    ], 'movimiento', 'Avanza a pasitos con las tres raíces por turnos; el bulbo rebota.'),

    animacion('Disparar', CICLO, [...porFotograma(raiz, CICLO, disparar), subir(CICLO, 16)], 'ataque',
      'El ciclo del juego (4 s): escupe en 0 s, pasea, y de 3,4 a 4 s se hincha temblando con la flor cerrada (la telegrafía).'),

    animacion('Golpe recibido', 0.3, [
      esc('cuerpo', poses([[0, 1, 1, 1], [0.05, 1.15, 0.85, 1.15], [0.16, 0.95, 1.05, 0.95], [0.3, 1, 1, 1]])),
      rot('cuello', poses([[0, 0, 0, 0], [0.05, -22, 0, 10], [0.16, 8, 0, -4], [0.3, 0, 0, 0]])),
      esc('petalos', poses([[0, 1, 1, 1], [0.05, 0.55, 0.55, 1.3], [0.2, 1.05, 1.05, 1], [0.3, 1, 1, 1]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.05, 1.2, 0.15, 1], [0.2, 1, 1, 1], [0.3, 1, 1, 1]])),
    ], 'reaccion', 'Se encoge, cierra la flor de golpe y echa la cabeza atrás.', false),

    animacion('Derrota', 1.2, [
      // Se marchita, el bulbo revienta en polvo púrpura y los pétalos caen.
      rot('cuello', poses([[0, 0, 0, 0], [0.2, -15, 0, 0], [0.75, 80, 0, 15], [0.9, 72, 0, 14], [1.2, 78, 0, 15]])),
      mov(raiz, 'cuello', poses([[0, 0, 0, 0], [0.46, 0, 0, 0], [0.8, 0, -0.52, 0.12], [0.9, 0, -0.46, 0.12], [1.2, 0, -0.5, 0.12]])),
      rot('cabeza', poses([[0, 9, 0, 0], [0.75, 40, 0, 0], [1.2, 30, 0, 0]])),
      mov(raiz, 'tallo', poses([[0, 0, 0, 0], [0.5, 0, 0, 0], [0.9, 0, -0.32, 0], [1.2, 0, -0.32, 0]])),
      esc('bulbo', poses([[0, 1, 1, 1], [0.3, 1.25, 1.2, 1.25], [0.42, 1.45, 1.4, 1.45], [0.46, 0.001, 0.001, 0.001], [1.2, 0.001, 0.001, 0.001]])),
      esc('polvo', poses([[0, 0.001, 0.001, 0.001], [0.42, 0.001, 0.001, 0.001], [0.5, 1, 1, 1], [0.85, 2.2, 2.2, 2.2], [1.05, 0.001, 0.001, 0.001], [1.2, 0.001, 0.001, 0.001]])),
      esc('petalos', poses([[0, 1, 1, 1], [0.2, 1.3, 1.3, 0.6], [0.6, 1.6, 1.6, 0.3], [1.2, 1.7, 1.7, 0.2]])),
      esc('ojo_c', poses([[0, 1, 1, 1], [0.2, 1.3, 1.3, 1], [0.45, 1.2, 0.1, 1], [1.2, 1.2, 0.1, 1]])),
      ...PATAS.map(([n], k) => mov(raiz, `pata_${n}`, poses([[0, 0, 0, 0], [0.5 + k * 0.05, 0, 0.04, 0], [0.9, 0, -0.06, 0], [1.2, 0, -0.06, 0]]))),
    ], 'reaccion', 'Se marchita: el bulbo se hincha y revienta en polvo púrpura y la flor cae al suelo.', false),
  ];

  return { id: 'sembrador', nombre: 'Sembrador', rol: 'Unidad de HELIOS · francotirador', raiz, animaciones };
}
