import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, punta, rot, toon, toro,
  type Modelo,
} from './kit.ts';

// Altar de jefe: el monolito de HELIOS del que sale cada jefe. Plataforma
// de dos escalones con un aro púrpura, cuatro pilares rematados en cristales
// y luces rojas, y un pedestal con un ojo rojo en V sobre el que flota el
// emblema de su jefe. Al invocar dispara un haz rojo al cielo (se ve desde
// todo el mapa); al vencer al jefe, los cristales púrpura se rompen, brotan
// cristales de sol y sube la recompensa. Mira hacia +z; 4,4 m de ancho y 3 m
// hasta el emblema.

export type JefeAltar = 'cosecha' | 'heraldo' | 'ojo';

const NOMBRES: Record<JefeAltar, string> = {
  cosecha: 'Altar de la Cosecha',
  heraldo: 'Altar del Velo',
  ojo: 'Altar del Ojo',
};

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export function crearAltarJefe(jefe: JefeAltar): Modelo {
  return conDetalle(0.8, () => montar(jefe));
}

function montar(jefe: JefeAltar): Modelo {
  const raiz = new THREE.Group();
  raiz.name = `altar-${jefe}`;
  const fino = <T,>(fn: () => T) => conDetalle(0.5, fn);
  const altar = nodo('altar', raiz);

  // Plataforma de dos escalones con el aro que brilla entre ellos.
  pieza(altar, barril(2.1, 2.2, 0.3, 0.08), toon(PALETA.chapaHelios), 0, 0.15, 0);
  pieza(altar, barril(1.6, 1.75, 0.3, 0.08), toon(PALETA.metalHelios), 0, 0.45, 0);
  pieza(altar, toro(1.72, 0.055), brillo(PALETA.purpuraBrillo), 0, 0.31, 0, { contorno: false });

  // Pedestal con su ojo rojo bajo una visera en V.
  pieza(altar, barril(0.55, 0.75, 1.0, 0.12), toon(PALETA.oscuroHelios), 0, 1.1, 0);
  pieza(altar, toro(0.6, 0.05), brillo(PALETA.purpuraBrillo), 0, 1.45, 0, { contorno: false });
  pieza(altar, esfera(0.15, 1.6, 0.45, 0.4), brillo(PALETA.helios), 0, 1.1, 0.62, { contorno: false });
  for (const s of [1, -1]) {
    const v = pieza(altar, capsula(0.045, 0.3).rotateZ(Math.PI / 2), toon(PALETA.chapaHelios), 0.15 * s, 1.24, 0.66);
    v.rotation.z = 0.35 * s;
  }

  // Cuatro pilares con cristales púrpura y luces rojas; los cristales de sol
  // (escondidos) brotan al purificarse.
  const cristales = nodo('cristales', altar);
  const cristalesSol = nodo('cristales_sol', altar);
  const luces = nodo('luces', altar);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + TAU / 8;
    const x = Math.sin(a) * 1.55, z = Math.cos(a) * 1.55;
    pieza(altar, barril(0.2, 0.26, 1.7, 0.06), toon(PALETA.oscuroHelios), x, 1.15, z);
    for (const [dx, dz, alto, inclina] of [[0, 0, 0.75, 0], [0.12, 0.05, 0.45, 0.4], [-0.1, -0.06, 0.5, -0.4]] as const) {
      const c = pieza(cristales, punta(0.13, alto, 6), toon(PALETA.purpura), x + dx, 2.0 + alto * 0.4, z + dz);
      c.rotation.set(inclina * 0.5, a, inclina);
      const sol = pieza(cristalesSol, punta(0.13, alto, 6), brillo(PALETA.arena), x + dx, 2.0 + alto * 0.4, z + dz, { contorno: false });
      sol.rotation.copy(c.rotation);
    }
    fino(() => pieza(luces, esfera(0.08), brillo(PALETA.helios), Math.sin(a) * 1.78, 1.6, Math.cos(a) * 1.78, { contorno: false }));
  }
  oculto(cristalesSol);

  // El emblema del jefe, flotando y girando sobre el pedestal.
  const emblema = nodo('emblema', altar, 0, 2.35, 0);
  pieza(emblema, toro(0.62, 0.06).rotateX(Math.PI / 2), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false });
  pieza(emblema, esfera(0.56, 1, 1, 0.12), toon(PALETA.oscuroHelios), 0, 0, 0);
  if (jefe === 'cosecha') {
    // Rueda de cuchillas, como el rodillo visto de frente.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const c = pieza(emblema, punta(0.1, 0.32).scale(1, 1, 0.4), brillo(PALETA.helios), Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.07, { contorno: false });
      c.rotation.z = -a;
    }
    fino(() => pieza(emblema, esfera(0.12, 1, 1, 0.4), brillo(PALETA.helios), 0, 0, 0.08, { contorno: false }));
  } else if (jefe === 'heraldo') {
    // Dirigible con tres gotas de gas.
    pieza(emblema, esfera(0.3, 1.4, 0.75, 0.3), brillo(PALETA.helios), 0, 0.1, 0.07, { contorno: false });
    fino(() => {
      for (const x of [-0.18, 0, 0.18]) pieza(emblema, esfera(0.06, 1, 1.4, 0.4), brillo(PALETA.helios), x, -0.25, 0.07, { contorno: false });
    });
  } else {
    // Ojo de pupila rasgada.
    pieza(emblema, esfera(0.3, 1.5, 0.8, 0.3), toon(PALETA.blanco), 0, 0, 0.06);
    fino(() => {
      pieza(emblema, esfera(0.17, 1, 1, 0.3), brillo(PALETA.helios), 0, 0, 0.12, { contorno: false });
      pieza(emblema, esfera(0.07, 0.45, 1.2, 0.3), brillo(PALETA.negro), 0, 0, 0.16, { contorno: false });
    });
  }

  // Haz al cielo, anillos de invocación y la recompensa (un sol).
  const haz = nodo('haz', raiz, 0, 2.35, 0);
  pieza(haz, barril(0.32, 0.45, 22, 0.1), brillo(PALETA.helios), 0, 11, 0, { contorno: false, sombra: false });
  oculto(haz);
  const anillos = nodo('anillos', raiz, 0, 0.5, 0);
  for (const [y, r] of [[0, 1.9], [0.5, 1.5], [1.0, 1.1]] as const) {
    fino(() => pieza(anillos, toro(r, 0.06), brillo(PALETA.helios), 0, y, 0, { contorno: false, sombra: false }));
  }
  oculto(anillos);
  const recompensa = nodo('recompensa', raiz, 0, 1.75, 0);
  pieza(recompensa, esfera(0.32), brillo(PALETA.arena), 0, 0, 0, { contorno: true });
  fino(() => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const r = pieza(recompensa, punta(0.07, 0.3), brillo(PALETA.plasma), Math.sin(a) * 0.48, Math.cos(a) * 0.48, 0, { contorno: false });
      r.rotation.z = -a;
    }
  });
  oculto(recompensa);

  // ------------------------------------------------------------ animaciones

  const girar = (d: number, vueltas: number) => rot('emblema', ciclo(d, (f) => [sen(f, 1) * 6, f * 360 * vueltas, 0]));
  const latir = (n: string, d: number, veces: number, base = 1, fuerza = 0.06) =>
    esc(n, ciclo(d, (f) => { const k = base + fuerza * sen(f, veces); return [k, k, k]; }));

  const animaciones = [
    animacion('Reposo', 3.0, [
      girar(3, 1),
      mov(raiz, 'emblema', ciclo(3, (f) => [0, sen(f) * 0.08, 0])),
      latir('cristales', 3, 2),
      esc('luces', ciclo(3, (f) => { const k = sen(f, 3) > 0.7 ? 1.4 : 0.7; return [k, k, k]; })),
    ], 'movimiento', 'Dormido: el emblema gira despacio, los cristales laten y las luces rojas parpadean.'),

    animacion('Invocar', 3.0, [
      // Despierta (tiembla), suben los anillos, sale el haz en 1,2 s y el
      // jefe aparece en 2,6 s.
      rot('altar', poses([[0, 0, 0, 0], [0.1, 0, 0, 1], [0.2, 0, 0, -1], [0.3, 0, 0, 1], [0.4, 0, 0, -1], [0.5, 0, 0, 0], [3, 0, 0, 0]])),
      rot('emblema', poses([[0, 0, 0, 0], [1.2, 0, 400, 0], [2.6, 0, 1500, 0], [3, 0, 1600, 0]])),
      esc('emblema', poses([[0, 1, 1, 1], [1.1, 1.3, 1.3, 1.3], [1.2, 1.5, 1.5, 1.5], [2.6, 1.2, 1.2, 1.2], [3, 1, 1, 1]])),
      esc('anillos', poses([[0, 0.001, 0.001, 0.001], [0.3, 0.6, 1, 0.6], [1.2, 1, 1, 1], [2.6, 1.3, 1, 1.3], [3, 1, 1, 1]])),
      mov(raiz, 'anillos', poses([[0, 0, 0, 0], [0.3, 0, 0, 0], [2.6, 0, 1.6, 0], [3, 0, 0.4, 0]])),
      esc('haz', poses([[0, 0.001, 0.001, 0.001], [1.15, 0.001, 0.001, 0.001], [1.3, 1.5, 1, 1.5], [1.6, 1, 1, 1], [3, 1, 1, 1]])),
      esc('luces', poses([[0, 1, 1, 1], [0.5, 1.6, 1.6, 1.6], [3, 1.4, 1.4, 1.4]])),
      latir('cristales', 3, 6, 1.05, 0.08),
    ], 'ataque', 'Despierta: tiembla, suben anillos rojos, dispara un haz al cielo (1,2 s) y el jefe aparece (2,6 s).', false),

    animacion('Combate', 2.0, [
      girar(2, 3),
      esc('haz', ciclo(2, (f) => [1 + 0.1 * sen(f, 4), 1, 1 + 0.1 * sen(f, 4)])),
      esc('anillos', ciclo(2, (f) => { const k = 1 + 0.05 * sen(f, 2); return [k, k, k]; })),
      mov(raiz, 'anillos', ciclo(2, (f) => [0, 0.4 + sen(f) * 0.2, 0])),
      latir('cristales', 2, 4, 1.05, 0.08),
      esc('luces', ciclo(2, (f) => { const k = sen(f, 4) > 0 ? 1.6 : 0.8; return [k, k, k]; })),
    ], 'movimiento', 'Mientras el jefe vive: el haz rojo late, los anillos flotan y el emblema gira deprisa.'),

    animacion('Recompensa', 3.0, [
      // Se apaga el haz, los cristales púrpura se rompen, brotan los de sol
      // y sube la recompensa (lista para recoger en 2,4 s).
      esc('haz', poses([[0, 1, 1, 1], [0.4, 0.001, 1, 0.001], [3, 0.001, 0.001, 0.001]])),
      esc('anillos', poses([[0, 1, 1, 1], [0.4, 1.6, 0.2, 1.6], [0.6, 0.001, 0.001, 0.001], [3, 0.001, 0.001, 0.001]])),
      esc('emblema', poses([[0, 1, 1, 1], [0.6, 1.3, 1.3, 1.3], [0.9, 0.001, 0.001, 0.001], [3, 0.001, 0.001, 0.001]])),
      esc('cristales', poses([[0, 1, 1, 1], [0.6, 1.15, 1.15, 1.15], [1.0, 0.001, 0.001, 0.001], [3, 0.001, 0.001, 0.001]])),
      esc('cristales_sol', poses([[0, 0.001, 0.001, 0.001], [1.0, 0.001, 0.001, 0.001], [1.5, 1.2, 1.2, 1.2], [1.8, 1, 1, 1], [3, 1, 1, 1]])),
      esc('luces', poses([[0, 1, 1, 1], [0.8, 0.001, 0.001, 0.001], [3, 0.001, 0.001, 0.001]])),
      esc('recompensa', poses([[0, 0.001, 0.001, 0.001], [1.2, 0.001, 0.001, 0.001], [1.5, 0.6, 0.6, 0.6], [2.2, 1.3, 1.3, 1.3], [2.4, 1, 1, 1], [3, 1, 1, 1]])),
      mov(raiz, 'recompensa', poses([[0, 0, 0, 0], [1.2, 0, 0, 0], [2.4, 0, 1.0, 0], [3, 0, 0.9, 0]])),
      rot('recompensa', poses([[0, 0, 0, 0], [3, 0, 540, 0]])),
    ], 'reaccion', 'Jefe vencido: el haz se apaga, los cristales púrpura se rompen, brotan cristales de sol y sube la recompensa (lista en 2,4 s).', false),

    animacion('Purificado', 2.4, [
      esc('cristales', ciclo(2.4, () => [0.001, 0.001, 0.001])),
      latir('cristales_sol', 2.4, 2, 1, 0.05),
      esc('luces', ciclo(2.4, () => [0.001, 0.001, 0.001])),
      esc('emblema', ciclo(2.4, () => [0.001, 0.001, 0.001])),
      latir('recompensa', 2.4, 2, 1, 0.08),
      mov(raiz, 'recompensa', ciclo(2.4, (f) => [0, 0.9 + sen(f) * 0.1, 0])),
      rot('recompensa', ciclo(2.4, (f) => [0, f * 360, 0])),
    ], 'movimiento', 'Purificado con la recompensa flotando, esperando a que el jugador la recoja.'),

    animacion('Agotado', 2.4, [
      esc('cristales', ciclo(2.4, () => [0.001, 0.001, 0.001])),
      latir('cristales_sol', 2.4, 1, 0.95, 0.03),
      esc('luces', ciclo(2.4, () => [0.001, 0.001, 0.001])),
      esc('emblema', ciclo(2.4, () => [0.001, 0.001, 0.001])),
      esc('recompensa', ciclo(2.4, () => [0.001, 0.001, 0.001])),
    ], 'movimiento', 'Recompensa recogida: el altar queda purificado y en calma.'),
  ];

  return { id: `altar-${jefe}`, nombre: NOMBRES[jefe], rol: 'Mapa · altar de jefe', raiz, animaciones };
}
