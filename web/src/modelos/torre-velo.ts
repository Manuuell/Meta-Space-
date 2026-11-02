import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, punta, rot,
  toon, toro, type Modelo,
} from './kit.ts';

// Torre del Velo: una de las chimeneas de HELIOS que tiende el velo. Tres
// patas, una columna de chapa con un ojo rojo bajo una visera en V, dos aros
// que giran con cristales púrpura y, arriba, una boca que escupe nubes rojas
// de sulfato. Se puede derribar: al caer deja de echar velo y baja un poco de
// sol sobre ella. Mira hacia +z; 6,3 m hasta la boca (10 m con el humo).

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const VELO = '#c0473c';
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export function crearTorreVelo(): Modelo {
  return conDetalle(0.8, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'torre-velo';
  const fino = <T,>(fn: () => T) => conDetalle(0.5, fn);

  // Base y patas: quedan en pie aunque la torre caiga.
  pieza(raiz, barril(1.3, 1.5, 0.4, 0.1), toon(PALETA.oscuroHelios), 0, 0.2, 0);
  pieza(raiz, toro(1.35, 0.06), brillo(PALETA.purpuraBrillo), 0, 0.36, 0, { contorno: false });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 3;
    barra(raiz, [Math.sin(a) * 2.0, 0.05, Math.cos(a) * 2.0], [Math.sin(a) * 0.7, 2.2, Math.cos(a) * 0.7], 0.16, toon(PALETA.metalOscuro));
    const c = pieza(raiz, punta(0.2, 0.9, 6), toon(PALETA.purpura), Math.sin(a) * 1.7, 0.6, Math.cos(a) * 1.7);
    c.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
  }

  // La columna (lo que cae) con su ojo, los aros y la boca.
  const columna = nodo('columna', raiz, 0, 0.4, 0);
  pieza(columna, barril(0.55, 0.8, 5.4, 0.15), toon(PALETA.chapaHelios), 0, 2.7, 0);
  for (const y of [1.2, 3.0, 4.6]) pieza(columna, toro(0.7 - y * 0.03, 0.06), toon(PALETA.metalOscuro), 0, y, 0);
  pieza(columna, esfera(0.34, 1, 1, 0.5), toon(PALETA.blanco), 0, 3.7, 0.6);
  const ojo = nodo('ojo', columna, 0, 3.7, 0.72);
  pieza(ojo, esfera(0.18, 1, 1, 0.5), brillo(PALETA.helios), 0, 0, 0, { contorno: false });
  for (const s of [1, -1]) {
    const v = pieza(columna, capsula(0.07, 0.35).rotateZ(Math.PI / 2), toon(PALETA.oscuroHelios), 0.2 * s, 4.05, 0.62);
    v.rotation.z = 0.4 * s;
  }
  const aros = nodo('aros', columna, 0, 2.3, 0);
  for (const [y, r] of [[0, 1.05], [1.0, 0.95]] as const) {
    pieza(aros, toro(r, 0.07), toon(PALETA.metalHelios), 0, y, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + y;
      const c = pieza(aros, punta(0.1, 0.4), brillo(PALETA.purpuraBrillo), Math.sin(a) * r, y + 0.15, Math.cos(a) * r, { contorno: false });
      c.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    }
  }
  pieza(columna, barril(0.75, 0.5, 0.6, 0.1), toon(PALETA.oscuroHelios), 0, 5.6, 0);
  pieza(columna, toro(0.72, 0.06), brillo(PALETA.helios), 0, 5.9, 0, { contorno: false });
  const humo = nodo('humo', columna, 0, 6.0, 0);
  fino(() => {
    for (const [y, r, x] of [[0.2, 0.45, 0], [0.9, 0.65, 0.3], [1.7, 0.85, -0.2], [2.6, 1.05, 0.5]] as const) {
      pieza(humo, esfera(r), toon(VELO), x, y, -y * 0.3, { sombra: false });
    }
  });

  // Chispas al recibir daño y la luz de sol que baja cuando cae.
  const chispas = nodo('chispas', columna, 0, 2.8, 0.75);
  fino(() => {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      const c = pieza(chispas, punta(0.05, 0.4), brillo(PALETA.purpuraBrillo), Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0, { contorno: false, sombra: false });
      c.rotation.z = -a;
    }
  });
  oculto(chispas);
  const sol = nodo('sol', raiz, 0, 14, 0);
  for (const [x1, z1, r] of [[-1.2, 1.0, 0.18], [0.3, 1.6, 0.12], [1.4, 0.4, 0.15], [-0.3, -0.8, 0.12]] as const) {
    barra(sol, [-2, 0, -1.5], [x1, -14 + r, z1], r, brillo(PALETA.arena), { contorno: false, sombra: false });
  }
  oculto(sol);

  const humear = (d: number, veces: number) => [
    esc('humo', ciclo(d, (f) => { const k = 0.6 + ((f * veces) % 1) * 0.6; return [k, k, k]; })),
    mov(raiz, 'humo', ciclo(d, (f) => [0, ((f * veces) % 1) * 0.8, 0])),
  ];

  const animaciones = [
    animacion('Emitir', 3.0, [
      rot('aros', ciclo(3, (f) => [0, f * 360, 0])),
      ...humear(3, 2),
      mov(raiz, 'ojo', ciclo(3, (f) => [sen(f) * 0.08, 0, 0])),
      esc('ojo', ciclo(3, (f) => { const k = f > 0.7 && f < 0.73 ? 0.1 : 1; return [1, k, 1]; })),
    ], 'movimiento', 'Tiende el velo: los aros giran, el ojo vigila y la boca escupe nubes rojas de sulfato.'),

    animacion('Golpe recibido', 0.45, [
      rot('columna', poses([[0, 0, 0, 0], [0.06, -2, 0, 2], [0.2, 1, 0, -1], [0.45, 0, 0, 0]])),
      esc('chispas', poses([[0, 0.001, 0.001, 0.001], [0.05, 1.3, 1.3, 1.3], [0.25, 0.001, 0.001, 0.001], [0.45, 0.001, 0.001, 0.001]])),
      esc('ojo', poses([[0, 1, 1, 1], [0.05, 1.2, 0.15, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Se tambalea y saltan chispas púrpura; el ojo se cierra del golpe.', false),

    animacion('Colapso', 3.0, [
      // Tiembla, el ojo se apaga, se dobla y cae hacia atrás; la boca deja de
      // echar velo y baja el sol (2,2 s).
      rot('columna', poses([[0, 0, 0, 0], [0.1, 0, 0, 2], [0.2, 0, 0, -2], [0.3, 0, 0, 2], [0.4, 0, 0, -2], [0.8, -6, 0, 3], [1.6, -84, 0, 10], [1.75, -78, 0, 9], [1.9, -84, 0, 10], [3.0, -83, 0, 10]])),
      mov(raiz, 'columna', poses([[0, 0, 0, 0], [0.8, 0, 0, 0], [1.6, 0, 0.4, -0.5], [3.0, 0, 0.4, -0.5]])),
      esc('ojo', poses([[0, 1, 1, 1], [0.3, 1.4, 1.4, 1], [0.5, 1, 0.05, 1], [3.0, 1, 0.05, 1]])),
      esc('chispas', poses([[0, 0.001, 0.001, 0.001], [0.1, 1.4, 1.4, 1.4], [0.4, 0.6, 0.6, 0.6], [0.6, 1.4, 1.4, 1.4], [1.0, 0.001, 0.001, 0.001], [3.0, 0.001, 0.001, 0.001]])),
      esc('humo', poses([[0, 1, 1, 1], [0.6, 1.4, 1.4, 1.4], [1.4, 0.001, 0.001, 0.001], [3.0, 0.001, 0.001, 0.001]])),
      rot('aros', poses([[0, 0, 0, 0], [1.5, 0, 200, 25], [3.0, 0, 210, 25]])),
      esc('sol', poses([[0, 0.001, 0.001, 0.001], [2.2, 0.001, 0.001, 0.001], [2.22, 1, 0.02, 1], [3.0, 1, 1, 1]])),
    ], 'reaccion', 'Derribada: tiembla, el ojo se apaga, cae hacia atrás, deja de echar velo y baja el sol sobre ella (2,2 s).', false),

    animacion('Apagada', 2.0, [
      rot('columna', ciclo(2, () => [-83, 0, 10])),
      mov(raiz, 'columna', ciclo(2, () => [0, 0.4, -0.5])),
      esc('ojo', ciclo(2, () => [1, 0.05, 1])),
      esc('humo', ciclo(2, () => [0.001, 0.001, 0.001])),
      esc('sol', ciclo(2, (f) => [1 + 0.03 * sen(f), 1, 1 + 0.03 * sen(f)])),
    ], 'movimiento', 'En el suelo, apagada, con la luz del sol encima.'),
  ];

  return { id: 'torre-velo', nombre: 'Torre del Velo', rol: 'Mapa · estructura de HELIOS (se puede derribar)', raiz, animaciones };
}
