import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, cono, esc, esfera, mov, nodo, ojo, parpadeo, pieza, poses, punta,
  rot, toon, toro, type Animacion, type Modelo,
} from '../modelos/kit.ts';
import { halo } from '../modelos/brillo.ts';
import type { Receta } from './receta.ts';

// META SPACE — Construye un héroe 3D a partir de su receta (receta.ts).
//
// Usa el mismo kit, el mismo contorno y los mismos nombres de nodos y de clips que
// los operadores hechos a mano, así que le sirven la mochila, las botas y lo que el
// juego espere de un personaje. Lo que hace que no parezcan todos el mismo muñeco es
// la silueta: cada una tiene sus proporciones y las piezas se adaptan a ellas.
//
// Mira hacia +z; su izquierda es +x.

const TAU = Math.PI * 2;
const LADOS = [['i', 1], ['d', -1]] as const;
const grados = THREE.MathUtils.degToRad;
const sen = (f: number, veces = 1, desfase = 0) => Math.sin((f + desfase) * TAU * veces);
const cos = (f: number, veces = 1) => Math.cos(f * TAU * veces);

interface Prop {
  pierna: number; caderaX: number; muslo: number; tibia: number; pie: number;
  tronco: number; pechoR: number; cinturaR: number; fondo: number; hombroX: number;
  brazo: number; brazoR: number; mano: number; cabeza: number; abre: number;
}

export const PROPORCIONES: Record<Receta['silueta'], Prop> = {
  recio: { pierna: 0.88, caderaX: 0.3, muslo: 0.21, tibia: 0.18, pie: 0.42, tronco: 1, pechoR: 0.68, cinturaR: 0.46, fondo: 0.78, hombroX: 0.82, brazo: 1.18, brazoR: 0.21, mano: 0.25, cabeza: 0.35, abre: 14 },
  esbelto: { pierna: 1.3, caderaX: 0.19, muslo: 0.145, tibia: 0.115, pie: 0.29, tronco: 0.98, pechoR: 0.42, cinturaR: 0.31, fondo: 0.72, hombroX: 0.5, brazo: 1.18, brazoR: 0.105, mano: 0.125, cabeza: 0.33, abre: 7 },
  bajito: { pierna: 0.5, caderaX: 0.2, muslo: 0.15, tibia: 0.13, pie: 0.3, tronco: 0.6, pechoR: 0.4, cinturaR: 0.36, fondo: 0.82, hombroX: 0.47, brazo: 0.64, brazoR: 0.11, mano: 0.14, cabeza: 0.52, abre: 14 },
  gigante: { pierna: 1.02, caderaX: 0.39, muslo: 0.28, tibia: 0.25, pie: 0.54, tronco: 1.24, pechoR: 0.84, cinturaR: 0.63, fondo: 0.8, hombroX: 1, brazo: 1.42, brazoR: 0.27, mano: 0.3, cabeza: 0.37, abre: 12 },
  redondo: { pierna: 0.62, caderaX: 0.3, muslo: 0.2, tibia: 0.17, pie: 0.38, tronco: 0.96, pechoR: 0.56, cinturaR: 0.74, fondo: 0.95, hombroX: 0.62, brazo: 0.86, brazoR: 0.15, mano: 0.17, cabeza: 0.38, abre: 22 },
  atletico: { pierna: 1.02, caderaX: 0.24, muslo: 0.17, tibia: 0.14, pie: 0.33, tronco: 0.9, pechoR: 0.52, cinturaR: 0.38, fondo: 0.74, hombroX: 0.6, brazo: 1.02, brazoR: 0.13, mano: 0.15, cabeza: 0.36, abre: 9 },
};

function tinte(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * k));
  return `#${c.getHexString()}`;
}

function materiales(r: Receta) {
  const c = r.colores;
  return {
    p: toon(c.principal), pS: toon(tinte(c.principal, 0.72)), pC: toon(tinte(c.principal, 1.2)),
    s: toon(c.secundario), sS: toon(tinte(c.secundario, 0.7)),
    a: toon(c.acento), piel: toon(c.piel), pielC: toon(tinte(c.piel, 1.22)), pelo: toon(c.pelo),
    luz: brillo(c.luz), bota: toon(tinte(c.secundario, 0.55)), metal: toon(PALETA.metal), metalO: toon(PALETA.metalOscuro),
    oscuro: toon(PALETA.oscuro), negro: toon('#17151f'), madera: toon('#86512c'), hoja: toon('#53cc8c'), hojaO: toon('#2f9a63'), hueso: toon('#f1ecdc'),
  };
}

interface Taller {
  r: Receta; P: Prop; M: ReturnType<typeof materiales>; raiz: THREE.Group;
  cuerpo: THREE.Group; cadera: THREE.Group; pecho: THREE.Group; tronco: THREE.Group; cabeza: THREE.Group;
  /** Mitad del largo de la pierna. */
  L: number;
  /** Altura del centro de la cabeza y radio en que empieza el pelo. */
  cy: number; pelo: number;
  /** Hasta dónde sale la espalda, para colgar cosas. */
  dorso: number;
  /** Superficie del pecho en z, a una fracción de su altura. */
  sup: (k: number) => number;
}

// ------------------------------------------------------------- piernas

function bota(t: Taller, rodilla: THREE.Object3D, material: THREE.Material) {
  const { P, L, M } = t;
  pieza(rodilla, caja(P.pie, 0.26, P.pie * 1.5, 0.09), material, 0, -L + 0.14, 0.08);
  pieza(rodilla, esfera(P.pie * 0.46, 1, 0.66, 0.9), material, 0, -L + 0.13, P.pie * 0.7);
  pieza(rodilla, caja(P.pie * 1.04, 0.07, P.pie * 1.54, 0.03), M.oscuro, 0, -L + 0.035, 0.08);
}

function piernas(t: Taller) {
  const { r, P, M, cadera, L } = t;
  const tipo = r.piernas;
  pieza(cadera, barril(P.cinturaR * 0.96, P.cinturaR, 0.36, 0.12).scale(1, 1, P.fondo), tipo === 'falda' ? M.s : tipo === 'mecanicas' ? M.metalO : M.s, 0, -0.06, 0);
  for (const [lado, s] of LADOS) {
    const pierna = nodo(`pierna_${lado}`, cadera, P.caderaX * s, -0.04, 0);
    const rodilla = nodo(`rodilla_${lado}`, pierna, 0, -L, 0);
    rodilla.rotation.x = grados(3);
    if (tipo === 'mecanicas') {
      pieza(pierna, esfera(P.muslo * 0.95), M.metalO);
      barra(pierna, [0, 0, 0], [0, -L, 0], P.tibia * 0.55, M.metal);
      barra(pierna, [P.muslo * 0.5, -0.1, 0.05], [P.tibia * 0.5, -L + 0.08, 0.05], 0.03, M.p);
      pieza(rodilla, esfera(P.tibia * 0.95), M.a);
      barra(rodilla, [0, 0, 0], [0, -L + 0.18, 0], P.tibia * 0.5, M.metal);
      barra(rodilla, [0, -0.06, -0.09], [0, -L + 0.24, -0.09], 0.03, M.p);
      pieza(rodilla, caja(P.pie * 1.1, 0.2, P.pie * 1.7, 0.06), M.oscuro, 0, -L + 0.1, 0.1);
      pieza(rodilla, caja(P.pie * 0.9, 0.09, P.pie * 0.7, 0.03), M.p, 0, -L + 0.22, 0.32);
      nodo(`enganche_bota_${lado}`, rodilla, 0, -L + 0.1, 0.05);
      continue;
    }
    const pierna1 = tipo === 'falda' ? M.piel : M.s;
    pieza(pierna, capsula(P.muslo, L * 0.62), pierna1, 0, -L * 0.48, 0);
    pieza(rodilla, capsula(P.tibia, L * 0.5), pierna1, 0, -L * 0.42, 0);
    if (tipo === 'armadura') {
      pieza(pierna, caja(P.muslo * 2.1, L * 0.5, P.muslo * 2.1, 0.07), M.p, 0, -L * 0.42, 0.02);
      pieza(rodilla, esfera(P.tibia * 1.22, 1, 0.95, 0.8), M.metal, 0, 0, P.tibia * 0.65);
      pieza(rodilla, caja(P.tibia * 2.3, L * 0.62, P.tibia * 2.1, 0.07), M.p, 0, -L * 0.48, 0.03);
      pieza(rodilla, caja(0.06, L * 0.56, 0.03, 0.01), M.a, 0, -L * 0.48, P.tibia + 0.05, { contorno: false });
      bota(t, rodilla, M.metalO);
    } else if (tipo === 'botas') {
      pieza(rodilla, barril(P.tibia * 1.32, P.tibia * 1.05, L * 0.86, 0.05), M.bota, 0, -L * 0.54, 0);
      pieza(rodilla, toro(P.tibia * 1.32, 0.055), M.a, 0, -L * 0.12, 0);
      pieza(rodilla, caja(P.tibia * 2.5, 0.05, P.tibia * 2.5, 0.02), M.oscuro, 0, -L * 0.6, 0);
      bota(t, rodilla, M.bota);
    } else {
      pieza(rodilla, toro(P.tibia * 1.06, 0.045), M.sS, 0, -L * 0.72, 0);
      bota(t, rodilla, tipo === 'falda' ? M.a : M.bota);
    }
    nodo(`enganche_bota_${lado}`, rodilla, 0, -L + 0.14, 0.04);
  }
  if (tipo === 'falda') {
    const f = nodo('faldon', cadera, 0, 0.08, 0);
    const h = P.pierna * 0.62;
    pieza(f, barril(P.cinturaR * 1.04, P.cinturaR * 1.5, h, 0.05).scale(1, 1, 0.88), M.p, 0, -h / 2, 0);
    pieza(f, toro(P.cinturaR * 1.46, 0.05).scale(1, 1, 0.88), M.a, 0, -h + 0.03, 0);
  }
  pieza(cadera, toro(P.cinturaR * 0.98, 0.065).scale(1, 1, P.fondo), M.oscuro, 0, 0.1, 0);
  pieza(cadera, caja(0.18, 0.15, 0.06, 0.03), M.a, 0, 0.1, P.cinturaR * P.fondo);
}

// ---------------------------------------------------------------- torso

function torso(t: Taller) {
  const { r, P, M, pecho, tronco, cadera } = t;
  const T = P.tronco, R = P.pechoR, C = P.cinturaR, F = P.fondo;
  const base = (m: THREE.Material) => pieza(tronco, barril(R, C, T, 0.2).scale(1, 1, F), m, 0, T / 2, 0);
  const cuello = r.cabeza === 'robot' || r.torso === 'chasis' ? M.metalO : M.piel;
  pieza(pecho, barril(0.17, 0.21, 0.24, 0.05), cuello, 0, T + 0.02, 0.02);
  switch (r.torso) {
    case 'traje':
      base(M.p);
      pieza(pecho, caja(R * 0.78, T * 0.3, 0.07, 0.03), M.oscuro, 0, T * 0.62, t.sup(0.62) - 0.01);
      for (const k of [-1, 0, 1]) pieza(pecho, caja(0.06, 0.06, 0.03, 0.01), k ? M.a : M.luz, k * R * 0.22, T * 0.5, t.sup(0.5) + 0.03, { contorno: false });
      pieza(pecho, toro(0.32, 0.075), M.s, 0, T - 0.02, 0);
      for (const [, s] of LADOS) pieza(pecho, caja(0.07, T * 0.7, 0.05, 0.02), M.a, (R * 0.72) * s, T * 0.5, t.sup(0.5) * 0.72, { contorno: false }).rotation.y = -0.7 * s;
      break;
    case 'armadura':
      base(M.pS);
      pieza(pecho, barril(R * 1.05, C * 1.04, T * 0.64, 0.16).scale(1, 1, F * 1.06), M.p, 0, T * 0.68, 0);
      pieza(pecho, caja(0.09, T * 0.52, 0.06, 0.02), M.a, 0, T * 0.66, t.sup(0.66) + 0.04);
      for (const k of [0.1, 0.22]) pieza(pecho, toro(C * (1 + k * 0.5), 0.05).scale(1, 1, F), M.metal, 0, T * k, 0);
      for (const [, s] of LADOS) pieza(pecho, esfera(0.04), M.metal, R * 0.5 * s, T * 0.86, t.sup(0.86) - 0.02, { contorno: false });
      break;
    case 'chaleco':
      base(M.s);
      pieza(pecho, barril(R * 1.05, C * 1.07, T * 0.84, 0.14).scale(1, 1, F), M.p, 0, T * 0.5, 0);
      pieza(pecho, caja(0.17, T * 0.78, 0.05, 0.02), M.s, 0, T * 0.5, t.sup(0.5) + 0.03);
      for (const [, s] of LADOS) {
        for (const y of [0.3, 0.52]) {
          pieza(pecho, caja(R * 0.42, T * 0.15, 0.07, 0.03), M.pS, R * 0.42 * s, T * y, t.sup(y) - 0.02);
          pieza(pecho, caja(R * 0.44, T * 0.05, 0.05, 0.02), M.a, R * 0.42 * s, T * (y + 0.06), t.sup(y) + 0.01, { contorno: false });
        }
      }
      break;
    case 'tunica': {
      base(M.p);
      const f = nodo('faldon', cadera, 0, 0.1, 0);
      const h = P.pierna * 0.82;
      const vuelo = C + Math.min(0.4, C * 0.62);
      pieza(f, barril(C * 1.04, vuelo, h, 0.06).scale(1, 1, 0.9), M.p, 0, -h / 2, 0);
      pieza(f, toro(vuelo * 0.97, 0.06).scale(1, 1, 0.9), M.a, 0, -h + 0.04, 0);
      pieza(f, caja(0.22, h * 0.96, 0.04, 0.01), M.s, 0, -h / 2, ((C * 1.04 + vuelo) / 2) * 0.9 + 0.01, { contorno: false }).rotation.x = -Math.atan((vuelo - C * 1.04) * 0.9 / h);
      pieza(pecho, caja(0.22, T * 0.84, 0.05, 0.02), M.s, 0, T * 0.5, t.sup(0.5) + 0.02, { contorno: false });
      pieza(pecho, toro(0.34, 0.08), M.a, 0, T - 0.02, 0);
      pieza(cadera, toro(C * 1.08, 0.085).scale(1, 1, F), M.s, 0, 0.1, 0);
      break;
    }
    case 'abrigo': {
      base(M.p);
      pieza(pecho, caja(0.26, T * 0.86, 0.05, 0.02), M.s, 0, T * 0.52, t.sup(0.52) + 0.01);
      for (const [, s] of LADOS) {
        const solapa = pieza(pecho, caja(R * 0.34, T * 0.42, 0.05, 0.02), M.pS, R * 0.3 * s, T * 0.76, t.sup(0.76) + 0.03);
        solapa.rotation.z = -0.32 * s;
        pieza(pecho, esfera(0.03), M.a, 0.17 * s, T * 0.34, t.sup(0.34) + 0.05, { contorno: false });
      }
      const f = nodo('faldon', cadera, 0, 0.1, 0);
      const h = P.pierna * 0.74;
      const vuelo = C + Math.min(0.32, C * 0.46);
      pieza(f, barril(C * 1.05, vuelo, h, 0.06).scale(1, 1, F * 1.12), M.p, 0, -h / 2, 0);
      pieza(f, toro(vuelo * 0.98, 0.05).scale(1, 1, F * 1.12), M.pS, 0, -h + 0.04, 0, { contorno: false });
      const abertura = pieza(f, caja(0.09, h * 0.96, 0.05, 0.02), M.sS, 0, -h / 2, ((C * 1.05 + vuelo) / 2) * F * 1.12 + 0.02, { contorno: false });
      abertura.rotation.x = -Math.atan((vuelo - C * 1.05) * F * 1.12 / h);
      for (const [, s] of LADOS) {
        const bolsillo = pieza(f, caja(C * 0.5, 0.06, 0.05, 0.02), M.pS, C * 0.62 * s, -h * 0.34, C * 1.04 * F, { contorno: false });
        bolsillo.rotation.set(-0.2, 0.42 * s, 0);
      }
      pieza(cadera, toro(C * 1.07, 0.08).scale(1, 1, F), M.oscuro, 0, 0.1, 0);
      break;
    }
    case 'poncho': {
      base(M.s);
      const po = nodo('poncho', pecho, 0, T + 0.02, 0);
      const h = T * 0.78, ala = P.hombroX + P.brazoR * 1.5 + 0.08;
      pieza(po, barril(0.3, ala, h, 0.08).scale(1, 1, 0.84), M.p, 0, -h / 2, 0);
      pieza(po, toro(ala * 0.97, 0.05).scale(1, 1, 0.84), M.a, 0, -h + 0.05, 0);
      pieza(po, toro(ala * 0.72, 0.045).scale(1, 1, 0.84), M.pS, 0, -h * 0.62, 0, { contorno: false });
      pieza(po, toro(0.3, 0.08), M.s, 0, 0, 0);
      break;
    }
    case 'mono':
      base(M.p);
      pieza(pecho, caja(R * 1.1, T * 0.44, 0.06, 0.03), M.pS, 0, T * 0.62, t.sup(0.62) + 0.01);
      pieza(pecho, caja(R * 0.56, T * 0.14, 0.05, 0.02), M.p, 0, T * 0.6, t.sup(0.62) + 0.05);
      for (const [, s] of LADOS) {
        barra(pecho, [R * 0.42 * s, T * 0.82, t.sup(0.82)], [R * 0.34 * s, T * 1.02, 0.02], 0.04, M.s);
        pieza(pecho, esfera(0.045), M.a, R * 0.42 * s, T * 0.82, t.sup(0.82) + 0.03, { contorno: false });
      }
      pieza(pecho, toro(0.3, 0.06), M.s, 0, T - 0.02, 0);
      break;
    case 'chasis':
      pieza(tronco, caja(R * 2, T * 0.98, R * 2 * F, 0.15), M.p, 0, T * 0.52, 0);
      pieza(pecho, caja(R * 1.32, T * 0.48, 0.07, 0.04), M.oscuro, 0, T * 0.62, t.sup(0.62) - 0.01);
      for (const k of [0, 1, 2]) pieza(pecho, caja(R * 1.05, 0.045, 0.03, 0.01), M.luz, 0, T * (0.48 + k * 0.1), t.sup(0.6) + 0.04, { contorno: false, sombra: false });
      for (const [, s] of LADOS) {
        for (const k of [0, 1, 2]) pieza(pecho, caja(0.05, T * 0.3, 0.05, 0.01), M.oscuro, (R * 1.02 + 0.01) * s, T * 0.4, (k - 1) * 0.14, { contorno: false });
        pieza(pecho, esfera(0.05), M.metal, R * 0.85 * s, T * 0.93, t.sup(0.9) - 0.02, { contorno: false });
      }
      pieza(cadera, caja(C * 1.8, 0.2, C * 1.6, 0.05), M.a, 0, 0.08, 0);
      break;
  }

  const ada = nodo('ada', pecho, 0, T * 0.74, t.sup(0.74) + 0.05);
  pieza(ada, esfera(0.075), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
  pieza(pecho, toro(0.1, 0.022).rotateX(Math.PI / 2), M.metal, 0, T * 0.74, t.sup(0.74) + 0.05, { contorno: false });
  halo(ada, PALETA.ada, 0.5, 0, 0, 0.02, 0.55);

  // Emblema: una silueta plana en el pecho.
  const forma = EMBLEMAS[r.emblema];
  if (forma) {
    const sh = new THREE.Shape();
    forma.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
    const g = new THREE.ShapeGeometry(sh);
    const x = r.torso === 'poncho' ? 0 : R * 0.6, y = T * 0.86, k = 0.1;
    const padre = r.torso === 'poncho' ? t.raiz.getObjectByName('poncho')! : pecho;
    const ala = (P.hombroX + P.brazoR * 1.5 + 0.08) * 0.84, h = T * 0.78;
    const e = pieza(padre, g.scale(k, k, 1), M.luz, x, r.torso === 'poncho' ? -h * 0.5 : y, r.torso === 'poncho' ? (0.25 + ala) / 2 + 0.05 : t.sup(0.86) * 0.86 + 0.07, { contorno: false, sombra: false });
    if (r.torso === 'poncho') e.rotation.x = -Math.atan((ala - 0.25) / h);
  }
}

const estrella = Array.from({ length: 10 }, (_, i) => {
  const a = Math.PI / 2 + (i * TAU) / 10, r = i % 2 ? 0.45 : 1;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
});
const engranaje = Array.from({ length: 24 }, (_, i) => {
  const a = (i * TAU) / 24, r = i % 4 < 2 ? 1 : 0.72;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
});
const circulo = (n: number, ax: number, ay: number) => Array.from({ length: n }, (_, i) => [Math.cos((i * TAU) / n) * ax, Math.sin((i * TAU) / n) * ay] as const);

const EMBLEMAS: Record<Receta['emblema'], readonly (readonly [number, number])[] | null> = {
  nada: null,
  estrella,
  rayo: [[0.15, 1], [-0.6, -0.1], [-0.05, -0.1], [-0.2, -1], [0.65, 0.2], [0.1, 0.2], [0.45, 1]],
  llama: [[0, 1], [0.55, 0.2], [0.75, -0.3], [0.45, -0.85], [0, -1], [-0.45, -0.85], [-0.75, -0.3], [-0.5, 0.1], [-0.25, -0.1], [-0.2, 0.45]],
  hoja: [[0, 1], [0.55, 0.45], [0.7, -0.1], [0.4, -0.65], [0.08, -0.8], [0.08, -1], [-0.08, -1], [-0.08, -0.8], [-0.4, -0.65], [-0.7, -0.1], [-0.55, 0.45]],
  engranaje,
  ojo: circulo(20, 1, 0.55),
  corazon: [[0, -1], [0.85, -0.05], [0.95, 0.4], [0.7, 0.8], [0.3, 0.8], [0, 0.45], [-0.3, 0.8], [-0.7, 0.8], [-0.95, 0.4], [-0.85, -0.05]],
};

// ---------------------------------------------------------------- brazos

function brazos(t: Taller) {
  const { r, P, M, pecho } = t;
  const B = P.brazo, T = P.tronco;
  for (const [lado, s] of LADOS) {
    const hombro = nodo(`hombro_${lado}`, pecho, P.hombroX * s, T - 0.14, 0);
    hombro.rotation.z = grados(P.abre * s);
    const codo = nodo(`codo_${lado}`, hombro, 0, -B * 0.5, 0);
    codo.rotation.x = grados(-14);
    const puno = nodo(`puno_${lado}`, codo, 0, -B * 0.5, 0.02);
    const sinMano = r.mano === 'garfio' && lado === 'd';
    switch (r.brazos) {
      case 'mecanicos':
        pieza(hombro, esfera(P.brazoR * 1.5), M.metalO);
        barra(hombro, [0, 0, 0], [0, -B * 0.5, 0], P.brazoR * 0.5, M.metal);
        barra(hombro, [P.brazoR * 0.5, -0.12, 0.05], [P.brazoR * 0.4, -B * 0.42, 0.05], 0.025, M.p);
        pieza(codo, esfera(P.brazoR * 1.05), M.a);
        barra(codo, [0, 0, 0], [0, -B * 0.46, 0], P.brazoR * 0.5, M.metal);
        if (!sinMano) {
          pieza(puno, caja(P.mano * 1.5, P.mano * 0.8, P.mano * 1.4, 0.05), M.metalO);
          for (const k of [-1, 0, 1]) pieza(puno, punta(0.05, P.mano * 0.9, 5).rotateX(Math.PI), M.metal, k * P.mano * 0.46, -P.mano * 0.72, 0);
        }
        break;
      case 'guanteletes':
        pieza(hombro, esfera(P.brazoR * 1.35), M.p);
        pieza(hombro, capsula(P.brazoR, B * 0.3), M.s, 0, -B * 0.26, 0);
        pieza(codo, esfera(P.brazoR * 1.08), M.metal);
        pieza(codo, barril(P.mano * 1.18, P.brazoR * 1.1, B * 0.36, 0.06), M.p, 0, -B * 0.25, 0);
        pieza(codo, toro(P.mano * 1.14, 0.05), M.a, 0, -B * 0.42, 0);
        if (!sinMano) {
          pieza(puno, caja(P.mano * 2.05, P.mano * 2, P.mano * 2.05, P.mano * 0.6), M.metal, 0, -P.mano * 0.1, 0);
          pieza(puno, caja(P.mano * 2.2, P.mano * 0.46, P.mano * 0.5, 0.05), M.metalO, 0, 0.02, P.mano * 0.98);
          pieza(puno, caja(P.mano * 0.5, P.mano * 0.9, P.mano * 0.5, 0.05), M.a, P.mano * 1.06, -P.mano * 0.2, P.mano * 0.3);
        }
        break;
      case 'remangados':
        pieza(hombro, esfera(P.brazoR * 1.35), M.p);
        pieza(hombro, capsula(P.brazoR, B * 0.3), M.p, 0, -B * 0.24, 0);
        pieza(hombro, toro(P.brazoR * 1.06, 0.06), M.pS, 0, -B * 0.45, 0);
        pieza(codo, capsula(P.brazoR * 0.92, B * 0.3), M.piel, 0, -B * 0.22, 0);
        pieza(codo, toro(P.brazoR * 0.96, 0.04), M.oscuro, 0, -B * 0.4, 0);
        if (!sinMano) pieza(puno, esfera(P.mano, 1, 1.05, 1.05), M.s);
        break;
      default:
        pieza(hombro, esfera(P.brazoR * 1.35), M.p);
        pieza(hombro, capsula(P.brazoR, B * 0.3), M.p, 0, -B * 0.24, 0);
        pieza(codo, capsula(P.brazoR * 0.92, B * 0.3), M.p, 0, -B * 0.22, 0);
        pieza(codo, toro(P.brazoR * 1.02, 0.045), M.a, 0, -B * 0.4, 0);
        if (!sinMano) pieza(puno, esfera(P.mano, 1, 1.05, 1.05), M.piel);
    }
    if (r.hombros === 'hombreras' || r.hombros === 'pinchos') {
      const k = Math.min(0.44, P.brazoR * 1.7 + 0.07);
      pieza(hombro, esfera(k, 1.05, 0.66, 1.1), M.p, 0.03 * s, 0.1, 0);
      pieza(hombro, toro(k * 0.92, 0.04).scale(1, 1, 1.05), M.a, 0.03 * s, 0.02, 0);
      if (r.hombros === 'pinchos') {
        for (const z of [-0.6, 0, 0.6]) {
          const p = pieza(hombro, punta(0.075, k * 1.05), M.hueso, (0.08 + k * 0.5) * s, 0.1 + k * 0.62 - Math.abs(z) * 0.12, z * k * 0.8);
          p.rotation.z = -0.5 * s;
        }
      }
    }
  }
  if (r.hombros === 'bufanda') {
    pieza(pecho, toro(0.32, 0.12).scale(1, 0.8, 1), M.a, 0, T + 0.07, 0.03);
    const cola = nodo('bufanda', pecho, 0.22, T + 0.02, -0.2);
    pieza(cola, caja(0.28, P.tronco * 0.72, 0.05, 0.02), M.a, 0, -P.tronco * 0.36, -0.02);
    pieza(cola, caja(0.29, 0.06, 0.06, 0.01), M.s, 0, -P.tronco * 0.6, -0.02, { contorno: false });
  }
  if (r.hombros === 'cuello') pieza(pecho, barril(0.5, 0.36, 0.36, 0.06).scale(1, 1, 0.9), M.pS, 0, T + 0.12, -0.08);
}

// ----------------------------------------------------- lo que va a la espalda

function espalda(t: Taller) {
  const { r, P, M, pecho } = t;
  const T = P.tronco, R = P.pechoR, z = -t.dorso;
  nodo('enganche_mochila', pecho, 0, T * 0.56, z);
  switch (r.espalda) {
    case 'mochila':
      pieza(pecho, caja(R * 1.2, T * 0.62, 0.36, 0.09), M.s, 0, T * 0.56, z - 0.14);
      pieza(pecho, capsula(0.11, R * 1).rotateZ(Math.PI / 2), M.a, 0, T * 0.92, z - 0.14);
      pieza(pecho, caja(R * 0.7, T * 0.22, 0.09, 0.03), M.sS, 0, T * 0.42, z - 0.34);
      for (const [, s] of LADOS) barra(pecho, [R * 0.4 * s, T * 0.9, z + 0.08], [R * 0.44 * s, T * 0.25, t.sup(0.3) + 0.01], 0.035, M.oscuro);
      break;
    case 'capa': {
      // Tres tramos que se ensanchan sin escalones: cada uno empieza donde acaba el anterior.
      const largo = (T + P.pierna * 0.62) / 3;
      const ancho = R * 0.92 + 0.08, q = 0.2;
      const tramo = (padre: THREE.Object3D, n: number) => pieza(padre,
        barril(ancho * (1 + n * 0.12), ancho * (1 + (n + 1) * 0.12), largo + 0.04, 0.012).scale(1, 1, q), M.s, 0, -largo / 2, 0);
      const a = nodo('capa', pecho, 0, T * 0.98, z - 0.03);
      tramo(a, 0);
      const b = nodo('capa2', a, 0, -largo, 0);
      tramo(b, 1);
      const c = nodo('capa3', b, 0, -largo, 0);
      tramo(c, 2);
      pieza(c, toro(ancho * 1.34, 0.035).scale(1, 1, q), M.a, 0, -largo + 0.02, 0, { contorno: false });
      for (const [, s] of LADOS) pieza(pecho, esfera(0.075), M.luz, R * 0.6 * s, T * 0.98, t.sup(0.98) * 0.5, { contorno: false, sombra: false });
      pieza(pecho, toro(R * 0.72, 0.05).scale(1, 1, 0.8), M.a, 0, T * 0.98, -0.02);
      break;
    }
    case 'alas':
      pieza(pecho, caja(0.4, T * 0.46, 0.18, 0.06), M.metalO, 0, T * 0.62, z - 0.05);
      for (const [lado, s] of LADOS) {
        const ala = nodo(`ala_${lado}`, pecho, 0.14 * s, T * 0.74, z - 0.1);
        ala.rotation.set(0, -0.2 * s, 0);
        barra(ala, [0, 0, 0], [0.7 * s, 0.62, -0.06], 0.06, M.metal);
        barra(ala, [0.7 * s, 0.62, -0.06], [1.5 * s, 0.86, -0.12], 0.05, M.metal);
        pieza(ala, esfera(0.09), M.a, 0.7 * s, 0.62, -0.06);
        for (const k of [0, 1, 2, 3]) {
          const largo = 1.24 - k * 0.16, x = (1.5 - k * 0.27) * s, y = 0.85 - k * 0.075;
          const pluma = nodo(`pluma_${lado}${k}`, ala, x, y, -0.1);
          pluma.rotation.z = (0.34 - k * 0.16) * s;
          pieza(pluma, caja(0.3, largo, 0.05, 0.04), k % 2 ? M.p : M.pC, 0, -largo / 2, 0);
          pieza(pluma, caja(0.035, largo * 0.8, 0.02, 0.005), M.luz, 0, -largo * 0.5, 0.03, { contorno: false, sombra: false });
        }
      }
      break;
    case 'tanques':
      for (const [, s] of LADOS) {
        pieza(pecho, barril(0.17, 0.17, T * 0.82, 0.08), M.a, 0.21 * s, T * 0.56, z - 0.14);
        pieza(pecho, barril(0.08, 0.1, 0.1, 0.02), M.metal, 0.21 * s, T * 1.02, z - 0.14);
        pieza(pecho, toro(0.175, 0.025), M.oscuro, 0.21 * s, T * 0.74, z - 0.14, { contorno: false });
        pieza(pecho, toro(0.175, 0.025), M.oscuro, 0.21 * s, T * 0.38, z - 0.14, { contorno: false });
        barra(pecho, [0.21 * s, T * 1.04, z - 0.14], [R * 0.5 * s, T * 0.9, t.sup(0.9) * 0.2], 0.03, M.metalO);
      }
      break;
    case 'propulsor':
      pieza(pecho, caja(R * 0.9, T * 0.52, 0.28, 0.08), M.metalO, 0, T * 0.62, z - 0.08);
      for (const [lado, s] of LADOS) {
        pieza(pecho, barril(0.16, 0.2, 0.34, 0.05), M.s, 0.24 * s, T * 0.3, z - 0.14);
        pieza(pecho, toro(0.19, 0.03), M.a, 0.24 * s, T * 0.42, z - 0.14, { contorno: false });
        const llama = nodo(`llama_${lado}`, pecho, 0.24 * s, T * 0.11, z - 0.14);
        pieza(llama, punta(0.13, 0.44, 7).rotateX(Math.PI), M.luz, 0, -0.1, 0, { contorno: false, sombra: false });
        halo(llama, t.r.colores.luz, 0.9, 0, -0.08, 0, 0.7);
      }
      break;
    case 'espadas':
      for (const [, s] of LADOS) {
        const g = nodo(`espada_${s > 0 ? 'i' : 'd'}`, pecho, 0, T * 0.58, z - 0.06);
        g.rotation.z = 0.56 * s;
        pieza(g, caja(0.14, 1.34, 0.035, 0.012), M.metal, 0, 0.06, 0);
        pieza(g, punta(0.1, 0.24, 4).scale(0.9, 1, 0.3), M.metal, 0, 0.85, 0);
        pieza(g, caja(0.34, 0.07, 0.08, 0.03), M.a, 0, -0.64, 0);
        pieza(g, capsula(0.05, 0.3), M.s, 0, -0.84, 0);
      }
      pieza(pecho, caja(0.26, 0.26, 0.09, 0.04), M.oscuro, 0, T * 0.58, z - 0.04);
      break;
    case 'jardinera': {
      pieza(pecho, caja(R * 1.5, T * 0.44, 0.42, 0.05), M.madera, 0, T * 0.52, z - 0.18);
      pieza(pecho, caja(R * 1.54, 0.08, 0.46, 0.02), M.oscuro, 0, T * 0.76, z - 0.18);
      const hojas = [[-0.3, 0.9, 0.2], [-0.08, 1.04, 0.26], [0.18, 0.96, 0.22], [0.34, 0.86, 0.17]] as const;
      hojas.forEach(([x, y, q], i) => {
        pieza(pecho, esfera(q, 1, 1.1, 0.9), i % 2 ? M.hojaO : M.hoja, x * R * 1.6, T * y, z - 0.18);
        pieza(pecho, esfera(0.065), M.a, x * R * 1.6 + 0.06, T * y + q * 0.8, z - 0.1, { contorno: false });
      });
      break;
    }
    case 'antena':
      pieza(pecho, caja(R * 0.9, T * 0.5, 0.24, 0.07), M.s, 0, T * 0.54, z - 0.07);
      for (const k of [0, 1, 2]) pieza(pecho, caja(0.05, 0.05, 0.03, 0.01), M.luz, (k - 1) * 0.12, T * 0.7, z - 0.2, { contorno: false, sombra: false });
      barra(pecho, [0.14, T * 0.7, z - 0.08], [0.3, T + 1.3, z - 0.1], 0.03, M.metal);
      pieza(pecho, esfera(0.07), M.luz, 0.3, T + 1.34, z - 0.1, { contorno: false, sombra: false });
      for (const k of [0.45, 0.62, 0.8]) pieza(pecho, toro(0.1 - (k - 0.45) * 0.1, 0.012), M.metal, 0.14 + 0.16 * k, T * 0.7 + (T * 0.3 + 1.3) * k, z - 0.09, { contorno: false });
      break;
  }
}

// ---------------------------------------------------------------- cabeza

function cabeza(t: Taller) {
  const { r, P, M, cabeza: K, cy } = t;
  const R = P.cabeza;
  const ojoLuz = (lado: string, s: number, ax: number, ay: number, z: number) => {
    const g = nodo(`ojo_${lado}`, K, R * 0.36 * s, cy + R * 0.06, z);
    pieza(g, esfera(R * ax, 1, ay, 0.4), M.luz, 0, 0, 0, { contorno: false, sombra: false });
    halo(g, r.colores.luz, R * 0.8, 0, 0, 0.01, 0.4);
  };
  const cara = (radio: number, y: number) => {
    for (const [lado, s] of LADOS) ojo(K, lado, radio * 0.22, radio * 0.38 * s, y + radio * 0.12, radio * 0.83, '#2a1a12');
    const boca = pieza(K, new THREE.TorusGeometry(radio * 0.17, 0.014, 6, 12, Math.PI).rotateZ(Math.PI), toon(tinte(r.colores.piel, 0.42)), 0, y - radio * 0.3, radio * 0.94, { contorno: false, sombra: false });
    boca.rotation.x = -0.3;
  };
  switch (r.cabeza) {
    case 'casco':
      pieza(K, esfera(R * 1.14, 1, 1.02, 1), M.p, 0, cy, 0);
      pieza(K, esfera(R, 1.02, 0.78, 0.66), M.negro, 0, cy + R * 0.02, R * 0.56);
      pieza(K, esfera(R * 0.22, 1.4, 0.5, 0.2), toon('#6d7ba0'), R * 0.36, cy + R * 0.46, R * 1.07, { contorno: false, sombra: false });
      for (const [lado, s] of LADOS) {
        ojoLuz(lado, s, 0.15, 1.2, R * 1.17);
        pieza(K, barril(R * 0.26, R * 0.26, 0.12, 0.04).rotateZ(Math.PI / 2), M.a, R * 1.12 * s, cy, 0);
      }
      pieza(K, toro(R * 0.72, 0.07), M.s, 0, 0.03, 0);
      break;
    case 'cupula': {
      const r2 = R * 0.72, y = cy - R * 0.08;
      pieza(K, esfera(r2, 1, 1.05, 0.97), M.piel, 0, y, 0);
      cara(r2, y);
      const vidrio = new THREE.MeshBasicMaterial({ color: '#c8f4ff', transparent: true, opacity: 0.2, depthWrite: false });
      pieza(K, esfera(R * 1.18), vidrio, 0, cy, 0, { contorno: false, sombra: false });
      pieza(K, esfera(R * 0.3, 1.4, 0.6, 0.2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), R * 0.46, cy + R * 0.62, R * 0.86, { contorno: false, sombra: false });
      pieza(K, toro(R * 0.98, 0.09), M.p, 0, cy - R * 0.76, 0);
      pieza(K, toro(R * 0.76, 0.05), M.a, 0, cy - R * 0.92, 0);
      break;
    }
    case 'robot':
      pieza(K, caja(R * 1.95, R * 1.7, R * 1.75, 0.14), M.p, 0, cy, 0);
      pieza(K, caja(R * 1.56, R * 0.92, 0.06, 0.04), M.negro, 0, cy + R * 0.1, R * 0.88);
      for (const [lado, s] of LADOS) {
        const g = nodo(`ojo_${lado}`, K, R * 0.4 * s, cy + R * 0.14, R * 0.93);
        pieza(g, caja(R * 0.36, R * 0.3, 0.02, 0.01), M.luz, 0, 0, 0, { contorno: false, sombra: false });
        halo(g, r.colores.luz, R * 0.7, 0, 0, 0.01, 0.4);
        pieza(K, barril(R * 0.22, R * 0.22, 0.14, 0.04).rotateZ(Math.PI / 2), M.metal, R * 1.02 * s, cy, 0);
      }
      pieza(K, caja(R * 0.74, R * 0.08, 0.02, 0.01), M.luz, 0, cy - R * 0.2, R * 0.93, { contorno: false, sombra: false });
      for (const k of [-1, 0, 1]) pieza(K, caja(R * 0.2, R * 0.07, R * 0.3, 0.02), M.a, k * R * 0.5, cy - R * 0.64, R * 0.72);
      break;
    case 'mascara':
      pieza(K, esfera(R * 1.03, 1, 1.05, 1), M.oscuro, 0, cy, 0);
      pieza(K, new THREE.SphereGeometry(R * 1.09, 20, 14, Math.PI / 2 - 1.15, 2.3, 0.15, Math.PI - 0.5).scale(1, 1.05, 1), M.p, 0, cy, 0);
      pieza(K, caja(0.07, R * 1.35, 0.05, 0.02), M.a, 0, cy + R * 0.1, R * 1.05).rotation.x = -0.12;
      for (const [lado, s] of LADOS) {
        const g = nodo(`ojo_${lado}`, K, R * 0.4 * s, cy + R * 0.14, R * 1.04);
        const raja = pieza(g, caja(R * 0.42, R * 0.1, 0.02, 0.008), M.luz, 0, 0, 0, { contorno: false, sombra: false });
        raja.rotation.set(0, 0.36 * s, -0.22 * s);
        halo(g, r.colores.luz, R * 0.6, 0, 0, 0.01, 0.4);
      }
      break;
    case 'capucha': {
      pieza(K, esfera(R * 0.98), M.negro, 0, cy, 0.02);
      pieza(K, new THREE.SphereGeometry(R * 1.26, 22, 14, Math.PI / 2 + 0.72, TAU - 1.44, 0, Math.PI).scale(1, 1.08, 1.08), M.p, 0, cy + 0.02, -0.06);
      pieza(K, toro(R * 0.9, 0.06).rotateX(Math.PI / 2 - 0.2), M.pS, 0, cy, R * 0.62);
      const pico = pieza(K, cono(R * 0.62, R * 1.3), M.p, 0, cy + R * 0.42, -R * 1.2);
      pico.rotation.x = -1.2;
      for (const [lado, s] of LADOS) ojoLuz(lado, s, 0.15, 0.7, R * 0.92);
      break;
    }
    case 'bestia': {
      pieza(K, esfera(R, 1.05, 1, 0.98), M.piel, 0, cy, 0);
      pieza(K, esfera(R * 0.52, 1.14, 0.78, 1), M.pielC, 0, cy - R * 0.24, R * 0.78);
      pieza(K, esfera(R * 0.15, 1.2, 0.85, 0.8), M.negro, 0, cy - R * 0.08, R * 1.26, { contorno: false });
      const boca = pieza(K, new THREE.TorusGeometry(R * 0.16, 0.017, 6, 12, Math.PI).rotateZ(Math.PI), M.negro, 0, cy - R * 0.34, R * 1.24, { contorno: false, sombra: false });
      boca.rotation.x = -0.2;
      if (r.tocado !== 'orejas') {
        for (const [, s] of LADOS) {
          const o = pieza(K, punta(R * 0.3, R * 0.62, 5).scale(1, 1, 0.45), M.piel, R * 0.74 * s, cy + R * 0.86, -R * 0.06);
          o.rotation.z = -0.42 * s;
        }
      }
      for (const [lado, s] of LADOS) {
        ojo(K, lado, R * 0.2, R * 0.42 * s, cy + R * 0.2, R * 0.82, '#2a1a12');
        for (const k of [0, 1]) barra(K, [R * 0.44 * s, cy - R * (0.2 + k * 0.1), R * 1.05], [R * 0.98 * s, cy - R * (0.1 + k * 0.22), R * 0.95], 0.008, M.negro, { contorno: false, sombra: false });
      }
      break;
    }
    default:
      pieza(K, esfera(R, 1, 1.06, 0.97), M.piel, 0, cy, 0);
      cara(R, cy);
      pieza(K, esfera(R * 0.15, 1.1, 0.9, 1), M.piel, 0, cy - R * 0.08, R * 0.95);
      for (const [, s] of LADOS) {
        pieza(K, esfera(R * 0.19, 0.6, 1, 1), M.piel, R * 0.98 * s, cy + R * 0.02, 0);
        const ceja = pieza(K, capsula(0.026, R * 0.3).rotateZ(Math.PI / 2), M.pelo, R * 0.38 * s, cy + R * 0.42, R * 0.86, { contorno: false, sombra: false });
        ceja.rotation.z = -0.14 * s;
      }
  }
}

function pelo(t: Taller) {
  const { r, M, cabeza: K, cy, P } = t;
  const h = t.pelo, y = r.cabeza === 'cupula' ? cy - P.cabeza * 0.08 : cy;
  const gorro = (k = 1.05, abre = 0.5) => {
    const g = pieza(K, new THREE.SphereGeometry(h * k, 20, 10, 0, TAU, 0, Math.PI * abre), M.pelo, 0, y + h * 0.04, -h * 0.05);
    g.rotation.x = -0.32;
    return g;
  };
  switch (r.pelo) {
    case 'rapado': gorro(1.015, 0.42); break;
    case 'corto':
      gorro();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU, p = pieza(K, punta(h * 0.22, h * 0.5, 5), M.pelo, Math.cos(a) * h * 0.56, y + h * 0.84, Math.sin(a) * h * 0.56 - h * 0.12);
        p.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      }
      break;
    case 'mono':
      gorro();
      pieza(K, esfera(h * 0.42), M.pelo, 0, y + h * 1.14, -h * 0.34);
      pieza(K, toro(h * 0.22, 0.035), M.a, 0, y + h * 0.9, -h * 0.28, { contorno: false });
      break;
    case 'coleta': {
      gorro();
      const c = nodo('coleta', K, 0, y + h * 0.3, -h * 0.98);
      c.rotation.x = 0.28;
      pieza(c, toro(h * 0.16, 0.035), M.a, 0, 0, 0, { contorno: false });
      pieza(c, capsula(h * 0.2, h * 1.1), M.pelo, 0, -h * 0.72, 0);
      break;
    }
    case 'trenzas':
      gorro();
      for (const [, s] of LADOS) {
        for (let i = 0; i < 5; i++) pieza(K, esfera(h * (0.24 - i * 0.012)), M.pelo, h * (0.98 + i * 0.03) * s, y - h * (0.1 + i * 0.36), -h * 0.12);
        pieza(K, toro(h * 0.12, 0.03), M.a, h * 1.1 * s, y - h * 1.64, -h * 0.12, { contorno: false });
      }
      break;
    case 'cresta':
      gorro(1.01, 0.3);
      for (let i = 0; i < 7; i++) {
        const a = -0.5 + i * 0.5, p = pieza(K, punta(h * 0.2, h * 0.8, 5), M.pelo, 0, y + Math.cos(a) * h * 1.2, Math.sin(-a) * h * 1.2 + h * 0.15);
        p.rotation.x = -a;
      }
      break;
    case 'melena':
      gorro();
      pieza(K, esfera(h * 1.04, 1.02, 1.3, 0.72), M.pelo, 0, y - h * 0.34, -h * 0.46);
      for (const [, s] of LADOS) pieza(K, capsula(h * 0.22, h * 0.95), M.pelo, h * 0.92 * s, y - h * 0.42, h * 0.08);
      break;
    case 'afro':
      pieza(K, esfera(h * 1.32, 1, 0.96, 1), M.pelo, 0, y + h * 0.5, -h * 0.58);
      gorro(1.03, 0.36);
      break;
  }
}

function tocado(t: Taller) {
  const { r, P, M, cabeza: K, cy } = t;
  const R = P.cabeza * (r.cabeza === 'casco' ? 1.14 : 1), arriba = cy + R * 0.92;
  switch (r.tocado) {
    case 'gorra': {
      const g = pieza(K, new THREE.SphereGeometry(R * 1.05, 20, 10, 0, TAU, 0, Math.PI * 0.46), M.p, 0, cy + R * 0.1, -R * 0.03);
      g.rotation.x = -0.1;
      const v = pieza(K, caja(R * 1.32, 0.05, R * 0.82, 0.02), M.a, 0, cy + R * 0.48, R * 1.12);
      v.rotation.x = 0.18;
      pieza(K, esfera(0.05), M.a, 0, cy + R * 1.14, 0, { contorno: false });
      break;
    }
    case 'boina': {
      const b = pieza(K, esfera(R * 1.14, 1.05, 0.34, 1.05), M.s, R * 0.14, arriba - R * 0.08, -R * 0.06);
      b.rotation.z = -0.24;
      pieza(K, esfera(0.08), M.a, -R * 0.3, cy + R * 0.76, R * 0.82);
      break;
    }
    case 'sombrero':
      pieza(K, barril(R * 1.7, R * 1.7, 0.08, 0.03), M.s, 0, arriba - R * 0.26, 0);
      pieza(K, barril(R * 0.8, R * 0.98, R * 0.78, 0.1), M.s, 0, arriba + R * 0.14, 0);
      pieza(K, toro(R * 0.96, 0.05), M.a, 0, arriba - R * 0.14, 0, { contorno: false });
      break;
    case 'tricornio':
      pieza(K, barril(R * 0.96, R * 1.04, R * 0.54, 0.08), M.negro, 0, arriba, 0);
      for (const [a, ancho] of [[0, 2.2], [2.2, 1.8], [-2.2, 1.8]] as const) {
        const ala = pieza(K, caja(R * ancho, R * 0.64, 0.05, 0.02), M.negro, Math.sin(a) * R * 0.96, arriba + R * 0.02, Math.cos(a) * R * 0.96);
        ala.rotation.y = a;
        ala.rotation.x = -0.42 * (a === 0 ? 1 : 0.5);
        pieza(ala, caja(R * ancho * 1.02, 0.03, 0.06, 0.01), M.a, 0, R * 0.3, 0, { contorno: false });
      }
      pieza(K, esfera(R * 0.13), M.hueso, 0, arriba + R * 0.02, R * 1.05, { contorno: false });
      break;
    case 'mago': {
      pieza(K, barril(R * 1.5, R * 1.5, 0.07, 0.03), M.p, 0, arriba - R * 0.2, 0);
      const c = pieza(K, cono(R * 0.92, R * 2.2), M.p, 0, arriba + R * 0.9, -R * 0.1);
      c.rotation.x = -0.16;
      pieza(K, toro(R * 0.86, 0.06), M.a, 0, arriba - R * 0.04, 0, { contorno: false });
      pieza(K, esfera(R * 0.13), M.luz, 0, arriba + R * 1.96, -R * 0.42, { contorno: false, sombra: false });
      break;
    }
    case 'corona':
      pieza(K, barril(R * 0.76, R * 0.7, R * 0.26, 0.03), M.a, 0, arriba - R * 0.02, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        pieza(K, punta(R * 0.16, R * 0.46, 5), M.a, Math.sin(a) * R * 0.68, arriba + R * 0.3, Math.cos(a) * R * 0.68);
        pieza(K, esfera(R * 0.07), M.luz, Math.sin(a) * R * 0.76, arriba, Math.cos(a) * R * 0.76, { contorno: false, sombra: false });
      }
      break;
    case 'cuernos':
      for (const [, s] of LADOS) {
        barra(K, [R * 0.74 * s, cy + R * 0.62, 0], [R * 1.22 * s, cy + R * 0.96, 0.02], R * 0.17, M.hueso);
        const p = pieza(K, punta(R * 0.17, R * 0.72), M.hueso, R * 1.34 * s, cy + R * 1.32, 0.02);
        p.rotation.z = -0.28 * s;
      }
      break;
    case 'orejas':
      for (const [, s] of LADOS) {
        const o = pieza(K, punta(R * 0.36, R * 0.84, 5).scale(1, 1, 0.45), M.piel, R * 0.68 * s, cy + R * 0.98, -R * 0.06);
        o.rotation.z = -0.32 * s;
        const i = pieza(K, punta(R * 0.2, R * 0.54, 5).scale(1, 1, 0.3), M.pielC, R * 0.68 * s, cy + R * 0.93, R * 0.05, { contorno: false, sombra: false });
        i.rotation.z = -0.32 * s;
      }
      break;
    case 'antenas':
      for (const [, s] of LADOS) {
        barra(K, [R * 0.36 * s, arriba, 0], [R * 0.74 * s, arriba + R * 0.92, -R * 0.1], 0.022, M.metal, { contorno: false });
        pieza(K, esfera(R * 0.14), M.luz, R * 0.74 * s, arriba + R * 0.98, -R * 0.1, { contorno: false, sombra: false });
      }
      break;
    case 'gafas':
      pieza(K, toro(R * 1.02, 0.05).rotateX(-0.3), M.oscuro, 0, cy + R * 0.54, 0);
      for (const [, s] of LADOS) {
        pieza(K, barril(R * 0.3, R * 0.34, 0.14, 0.03).rotateX(Math.PI / 2 - 0.5), M.metalO, R * 0.42 * s, cy + R * 0.72, R * 0.76);
        pieza(K, esfera(R * 0.25, 1, 1, 0.3).rotateX(-0.5), M.luz, R * 0.42 * s, cy + R * 0.76, R * 0.84, { contorno: false, sombra: false });
      }
      break;
    case 'cascos':
      pieza(K, new THREE.TorusGeometry(R * 1.1, 0.05, 8, 24, Math.PI), M.oscuro, 0, cy + R * 0.04, 0);
      for (const [, s] of LADOS) {
        pieza(K, barril(R * 0.38, R * 0.38, 0.17, 0.06).rotateZ(Math.PI / 2), M.a, R * 1.06 * s, cy, 0);
        pieza(K, esfera(R * 0.14, 0.4, 1, 1), M.luz, R * 1.17 * s, cy, 0, { contorno: false, sombra: false });
      }
      break;
  }
}

function rostro(t: Taller) {
  const { r, P, M, cabeza: K, cy } = t;
  const R = r.cabeza === 'cupula' ? P.cabeza * 0.72 : P.cabeza, y = r.cabeza === 'cupula' ? cy - P.cabeza * 0.08 : cy;
  switch (r.vello) {
    case 'barba': {
      const b = pieza(K, new THREE.SphereGeometry(R * 1.04, 20, 10, -0.2, Math.PI + 0.4, Math.PI * 0.5, Math.PI * 0.5), M.pelo, 0, y - R * 0.04, 0);
      b.scale.set(1, 1.2, 1);
      pieza(K, capsula(0.04, R * 0.46).rotateZ(Math.PI / 2), M.pelo, 0, y - R * 0.18, R * 0.98);
      break;
    }
    case 'perilla':
      pieza(K, esfera(R * 0.26, 0.9, 1.3, 0.8), M.pelo, 0, y - R * 0.84, R * 0.66);
      break;
    case 'bigote':
      for (const [, s] of LADOS) {
        const b = pieza(K, capsula(0.04, R * 0.3).rotateZ(Math.PI / 2), M.pelo, R * 0.22 * s, y - R * 0.17, R * 0.99);
        b.rotation.z = -0.22 * s;
      }
      break;
  }
  switch (r.rostro) {
    case 'gafas':
      for (const [, s] of LADOS) pieza(K, new THREE.TorusGeometry(R * 0.24, 0.02, 6, 18), M.oscuro, R * 0.38 * s, y + R * 0.12, R * 0.98, { contorno: false });
      pieza(K, caja(R * 0.3, 0.02, 0.02, 0.005), M.oscuro, 0, y + R * 0.15, R * 1.02, { contorno: false });
      break;
    case 'parche':
      pieza(K, toro(R * 1.01, 0.018).rotateZ(0.26), M.negro, 0, y + R * 0.1, 0, { contorno: false });
      pieza(K, esfera(R * 0.27, 1, 1, 0.34), M.negro, -R * 0.38, y + R * 0.13, R * 0.9, { contorno: false });
      break;
    case 'panuelo':
      pieza(K, new THREE.SphereGeometry(R * 1.05, 20, 10, -0.15, Math.PI + 0.3, Math.PI * 0.55, Math.PI * 0.45), M.a, 0, y - R * 0.02, 0);
      break;
  }
}

// ------------------------------------------------------- lo que lleva en la mano

function mano(t: Taller) {
  const { r, P, M, raiz } = t;
  const puno = raiz.getObjectByName('puno_d')!, codoI = raiz.getObjectByName('codo_i')!;
  const objeto = nodo('objeto', puno);
  objeto.rotation.x = grados(66);
  const k = Math.max(0.8, Math.min(1.25, P.brazo / 1.05));
  switch (r.mano) {
    case 'llave':
      pieza(objeto, capsula(0.07 * k, 0.95 * k), M.metal, 0, 0.3 * k, 0);
      pieza(objeto, caja(0.34 * k, 0.18 * k, 0.09, 0.03), M.metal, 0, 0.85 * k, 0);
      pieza(objeto, caja(0.11 * k, 0.26 * k, 0.09, 0.02), M.metal, 0.14 * k, 1.02 * k, 0);
      pieza(objeto, caja(0.11 * k, 0.26 * k, 0.09, 0.02), M.metal, -0.14 * k, 1.02 * k, 0);
      pieza(objeto, capsula(0.09 * k, 0.26 * k), M.a, 0, 0, 0);
      break;
    case 'martillo':
      pieza(objeto, capsula(0.055 * k, 1.2 * k), M.madera, 0, 0.42 * k, 0);
      pieza(objeto, caja(0.62 * k, 0.38 * k, 0.38 * k, 0.06), M.metalO, 0, 1.08 * k, 0);
      pieza(objeto, caja(0.66 * k, 0.09 * k, 0.4 * k, 0.02), M.a, 0, 1.08 * k, 0);
      break;
    case 'baculo':
      objeto.rotation.set(grados(14), 0, grados(P.abre + 9));
      pieza(objeto, capsula(0.045, 2.1 * k), M.madera, 0, 0.42 * k, 0);
      pieza(objeto, toro(0.16, 0.04), M.a, 0, 1.44 * k, 0);
      pieza(objeto, punta(0.15, 0.42, 6), M.luz, 0, 1.62 * k, 0, { contorno: false, sombra: false });
      halo(objeto, r.colores.luz, 1, 0, 1.62 * k, 0, 0.6);
      break;
    case 'espada':
      pieza(objeto, caja(0.18 * k, 1.2 * k, 0.05, 0.015), M.metal, 0, 0.82 * k, 0);
      pieza(objeto, punta(0.13 * k, 0.3 * k, 4).scale(1, 1, 0.3), M.metal, 0, 1.56 * k, 0);
      pieza(objeto, caja(0.44 * k, 0.08, 0.1, 0.03), M.a, 0, 0.2 * k, 0);
      pieza(objeto, caja(0.03, 1 * k, 0.02, 0.005), M.luz, 0, 0.86 * k, 0.03, { contorno: false, sombra: false });
      break;
    case 'blaster':
      objeto.rotation.x = grados(84);
      pieza(objeto, caja(0.12, 0.2, 0.16, 0.03), M.oscuro, 0, 0.1, 0);
      pieza(objeto, caja(0.15, 0.48, 0.2, 0.05), M.metalO, 0, 0.32, 0.08);
      pieza(objeto, toro(0.07, 0.02).rotateX(0), M.luz, 0, 0.6, 0.1, { contorno: false, sombra: false });
      pieza(objeto, caja(0.05, 0.3, 0.03, 0.01), M.luz, 0, 0.34, 0.2, { contorno: false, sombra: false });
      break;
    case 'farol':
      objeto.rotation.x = 0;
      barra(objeto, [0, -0.04, 0], [0, -0.26, 0], 0.016, M.metal, { contorno: false });
      pieza(objeto, barril(0.12, 0.15, 0.06, 0.02), M.metalO, 0, -0.28, 0);
      pieza(objeto, esfera(0.14, 1, 1.15, 1), M.luz, 0, -0.44, 0, { contorno: false, sombra: false });
      pieza(objeto, barril(0.15, 0.12, 0.06, 0.02), M.metalO, 0, -0.62, 0);
      halo(objeto, r.colores.luz, 1.3, 0, -0.44, 0, 0.7);
      break;
    case 'garfio':
      objeto.rotation.x = 0;
      pieza(objeto, barril(0.11, 0.09, 0.16, 0.03), M.metalO, 0, 0.02, 0);
      pieza(objeto, new THREE.TorusGeometry(0.13, 0.03, 8, 16, Math.PI * 1.3).rotateZ(-Math.PI * 1.05), M.metal, 0.02, -0.2, 0);
      pieza(objeto, punta(0.04, 0.12, 5), M.metal, 0.14, -0.17, 0, { contorno: false });
      break;
    case 'escudo': {
      const e = nodo('escudo', codoI, 0.17, -P.brazo * 0.26, 0.04);
      e.rotation.z = Math.PI / 2 - 0.1;
      const q = Math.max(0.52, P.brazo * 0.5);
      pieza(e, barril(q, q, 0.09, 0.04), M.p);
      pieza(e, toro(q * 0.98, 0.045), M.a, 0, 0.03, 0);
      pieza(e, esfera(q * 0.3, 1, 0.5, 1), M.metal, 0, -0.06, 0);
      break;
    }
  }
}

// ------------------------------------------------------------- animaciones

const ANDARES: Record<Receta['andar'], { paso: number; abre: number; rod: number; bote: number; brazo: number; pecho: number; giro: number; lado: number }> = {
  firme: { paso: 0.95, abre: 26, rod: 30, bote: 0.05, brazo: 28, pecho: 4, giro: 8, lado: 2 },
  agil: { paso: 0.78, abre: 32, rod: 40, bote: 0.06, brazo: 36, pecho: 9, giro: 10, lado: 1 },
  pesado: { paso: 1.25, abre: 22, rod: 24, bote: 0.07, brazo: 22, pecho: 6, giro: 6, lado: 6 },
  saltarin: { paso: 0.68, abre: 24, rod: 44, bote: 0.16, brazo: 30, pecho: 2, giro: 6, lado: 3 },
  elegante: { paso: 1.08, abre: 20, rod: 24, bote: 0.025, brazo: 12, pecho: -2, giro: 5, lado: 1 },
  robotico: { paso: 1, abre: 22, rod: 16, bote: 0.015, brazo: 20, pecho: 0, giro: 0, lado: 0 },
};

function animar(t: Taller): Animacion[] {
  const { raiz, P, r } = t;
  const G = ANDARES[r.andar], A = P.abre, k = Math.min(1.15, P.pierna / 0.95);
  const hay = (n: string) => !!raiz.getObjectByName(n);
  /** Prendas y piezas que cuelgan: se quedan atrás según la velocidad. */
  const ropa = (d: number, amp: number) => [
    ...(['faldon', 'poncho'] as const).filter(hay).map((n) => rot(n, ciclo(d, (f) => [(n === 'poncho' ? -1 : 1) * Math.abs(sen(f)) * amp * 0.4 * (n === 'faldon' ? -1 : 1), 0, sen(f) * 3]))),
    ...(['capa', 'capa2', 'capa3', 'bufanda', 'coleta'] as const).filter(hay).map((n, i) => rot(n, ciclo(d, (f) => [(n === 'capa2' || n === 'capa3' ? 5 : amp) * (n === 'capa' || n === 'bufanda' || n === 'coleta' ? 1 : 1) + sen(f, 2, i * 0.1) * (2 + amp * 0.16), 0, sen(f, 1, i * 0.1) * 3]))),
    ...(['ala_i', 'ala_d'] as const).filter(hay).map((n) => rot(n, ciclo(d, (f) => [0, (n === 'ala_i' ? -1 : 1) * (20 + sen(f, 2) * Math.min(20, amp * 0.4)), 0]))),
  ];
  const brazo = (d: number, fn: (f: number) => readonly [number, number, number]) => [
    rot('hombro_i', ciclo(d, fn)),
    rot('hombro_d', ciclo(d, (f) => { const [x, y, z] = fn(f + 0.5); return [x, -y, -z]; })),
  ];
  const codos = (d: number, fn: (f: number) => number) => [
    rot('codo_i', ciclo(d, (f) => [fn(f), 0, 0])),
    rot('codo_d', ciclo(d, (f) => [fn(f + 0.5), 0, 0])),
  ];
  const pasos = (d: number, abre: number, rodilla: number, base = 3) => [
    rot('pierna_i', ciclo(d, (f) => [sen(f) * abre, 0, 0])),
    rot('pierna_d', ciclo(d, (f) => [-sen(f) * abre, 0, 0])),
    rot('rodilla_i', ciclo(d, (f) => [base + rodilla * Math.max(0, -cos(f)), 0, 0])),
    rot('rodilla_d', ciclo(d, (f) => [base + rodilla * Math.max(0, cos(f)), 0, 0])),
  ];
  const squash = (d: number, q: number) => esc('cuerpo', ciclo(d, (f) => { const a = (1 - Math.abs(cos(f))) * q; return [1 + a, 1 - a, 1 + a]; }));
  const ojos = (claves: Parameters<typeof esc>[1]) => [esc('ojo_i', claves), esc('ojo_d', claves)];
  const latido = (d: number, q: number, veces = 2) => esc('ada', ciclo(d, (f) => { const v = 1 + q * sen(f, veces); return [v, v, v]; }));

  const paso = G.paso;
  const carrera = paso * 0.68, sprint = paso * 0.5;
  return [
    animacion('Reposo', 2.6, [
      esc('tronco', ciclo(2.6, (f) => { const q = 0.02 * sen(f); return [1 + q, 1 + q * 0.5, 1 + q]; })),
      mov(raiz, 'cadera', ciclo(2.6, (f) => [sen(f) * 0.015, sen(f, 2) * 0.012, 0])),
      rot('pecho', ciclo(2.6, (f) => [sen(f) * 2, 0, -sen(f) * 1.5])),
      rot('cabeza', ciclo(2.6, (f) => [sen(f, 2) * 2, sen(f) * 14, sen(f) * 2])),
      rot('hombro_i', ciclo(2.6, (f) => [sen(f) * 3, 0, A + sen(f, 2) * 2])),
      rot('hombro_d', ciclo(2.6, (f) => [-sen(f) * 3, 0, -A - sen(f, 2) * 2])),
      rot('codo_i', ciclo(2.6, (f) => [-14 + sen(f, 2) * 4, 0, 0])),
      rot('codo_d', ciclo(2.6, (f) => [-14 - sen(f, 2) * 4, 0, 0])),
      latido(2.6, 0.2),
      ...ropa(2.6, 4),
      ...ojos(parpadeo(2.6, 1.9)),
    ], 'movimiento', 'Respira, mira alrededor y se balancea.'),

    animacion('Caminar', paso, [
      ...pasos(paso, G.abre, G.rod),
      mov(raiz, 'cadera', ciclo(paso, (f) => [sen(f) * 0.03 * G.lado * 0.4, G.bote * k * (Math.abs(cos(f)) - 0.5), 0])),
      rot('cadera', ciclo(paso, (f) => [0, -sen(f) * G.giro * 0.7, -sen(f) * G.lado])),
      squash(paso, 0.02),
      rot('pecho', ciclo(paso, (f) => [G.pecho, sen(f) * G.giro, sen(f) * G.lado * 0.6])),
      rot('cabeza', ciclo(paso, (f) => [-G.pecho * 0.5, -sen(f) * G.giro * 0.7, 0])),
      ...brazo(paso, (f) => [-sen(f) * G.brazo, 0, A]),
      ...codos(paso, (f) => -18 - Math.max(0, sen(f)) * 18),
      ...ropa(paso, 12),
    ], 'movimiento', `Camina: ${r.andar}.`),

    animacion('Correr', carrera, [
      ...pasos(carrera, G.abre * 1.6, G.rod * 1.6, 6),
      mov(raiz, 'cadera', ciclo(carrera, (f) => [0, (G.bote + 0.04) * k * (Math.abs(cos(f)) - 0.5), 0])),
      rot('cadera', ciclo(carrera, (f) => [0, -sen(f) * G.giro, 0])),
      squash(carrera, 0.035),
      rot('pecho', ciclo(carrera, (f) => [G.pecho + 10, sen(f) * G.giro * 1.3, 0])),
      rot('cabeza', ciclo(carrera, () => [-G.pecho - 8, 0, 0])),
      ...brazo(carrera, (f) => [-sen(f) * G.brazo * 1.7, 0, A + 3]),
      ...codos(carrera, () => -62),
      ...ropa(carrera, 32),
    ], 'movimiento', 'Corre con los brazos doblados y la ropa ondeando.'),

    animacion('Esprintar', sprint, [
      ...pasos(sprint, G.abre * 2.1, G.rod * 2, 8),
      mov(raiz, 'cadera', ciclo(sprint, (f) => [0, 0.1 * k * Math.abs(cos(f)) - 0.08 * k, 0.05])),
      rot('cadera', ciclo(sprint, (f) => [0, -sen(f) * G.giro * 1.2, 0])),
      squash(sprint, 0.045),
      rot('pecho', ciclo(sprint, (f) => [G.pecho + 22, sen(f) * 12, 0])),
      rot('cabeza', ciclo(sprint, () => [-22, 0, 0])),
      ...brazo(sprint, (f) => [-sen(f) * 70 + 8, 0, A + 6]),
      ...codos(sprint, () => -78),
      latido(sprint, 0.2),
      ...ropa(sprint, 52),
    ], 'movimiento', 'Esprinta inclinado hacia delante.'),

    animacion('Saltar', 0.75, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.14, 0, -0.2 * k, 0], [0.32, 0, 0.12 * k, 0], [0.58, 0, 0.04, 0], [0.75, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.14, 1.1, 0.88, 1.1], [0.32, 0.93, 1.1, 0.93], [0.55, 1, 1, 1], [0.75, 1, 1, 1]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.14, -30, 0, 0], [0.34, 14, 0, 0], [0.75, 0, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.14, -30, 0, 0], [0.34, 4, 0, 0], [0.75, 0, 0, 0]])),
      rot('rodilla_i', poses([[0, 3, 0, 0], [0.14, 58, 0, 0], [0.34, 30, 0, 0], [0.75, 3, 0, 0]])),
      rot('rodilla_d', poses([[0, 3, 0, 0], [0.14, 58, 0, 0], [0.34, 40, 0, 0], [0.75, 3, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, A], [0.14, 30, 0, A + 4], [0.32, -150, 0, A + 16], [0.58, -40, 0, A + 16], [0.75, 0, 0, A]])),
      rot('hombro_d', poses([[0, 0, 0, -A], [0.14, 30, 0, -A - 4], [0.32, -150, 0, -A - 16], [0.58, -40, 0, -A - 16], [0.75, 0, 0, -A]])),
    ], 'movimiento', 'Se agacha y salta con los brazos arriba.', false),

    animacion('Surfear', 1.6, [
      mov(raiz, 'cadera', ciclo(1.6, (f) => [sen(f) * 0.03, -0.14 * k + sen(f, 2) * 0.02, 0])),
      rot('pierna_i', ciclo(1.6, () => [-24, 0, 6])),
      rot('pierna_d', ciclo(1.6, () => [-24, 0, -6])),
      rot('rodilla_i', ciclo(1.6, () => [44, 0, 0])),
      rot('rodilla_d', ciclo(1.6, () => [44, 0, 0])),
      rot('pecho', ciclo(1.6, (f) => [16, sen(f) * 8, sen(f) * 6])),
      rot('cabeza', ciclo(1.6, (f) => [-12, -sen(f) * 8, -sen(f) * 4])),
      rot('hombro_i', ciclo(1.6, (f) => [-10, 0, 66 + sen(f) * 10])),
      rot('hombro_d', ciclo(1.6, (f) => [-10, 0, -66 + sen(f) * 10])),
      ...ropa(1.6, 24),
    ], 'movimiento', 'Agachado en la aerotabla, con los brazos abiertos.'),

    animacion('Volar', 0.8, [
      mov(raiz, 'cadera', ciclo(0.8, (f) => [0, sen(f) * 0.04, 0])),
      rot('pecho', ciclo(0.8, (f) => [20, 0, sen(f) * 3])),
      rot('cabeza', ciclo(0.8, () => [-18, 0, 0])),
      rot('pierna_i', ciclo(0.8, (f) => [22 + sen(f) * 8, 0, 6])),
      rot('pierna_d', ciclo(0.8, (f) => [28 - sen(f) * 8, 0, -6])),
      rot('rodilla_i', ciclo(0.8, () => [30, 0, 0])),
      rot('rodilla_d', ciclo(0.8, () => [30, 0, 0])),
      rot('hombro_i', ciclo(0.8, (f) => [30, 0, A + 14 + sen(f, 2) * 4])),
      rot('hombro_d', ciclo(0.8, (f) => [30, 0, -A - 14 - sen(f, 2) * 4])),
      ...ropa(0.8, 60),
    ], 'movimiento', 'Colgado de la mochila cohete.'),

    animacion('Impulso', 0.35, [
      rot('pecho', poses([[0, 0, 0, 0], [0.06, 30, 0, 0], [0.25, 24, 0, 0], [0.35, 10, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.06, -20, 0, 0], [0.35, -6, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, A], [0.06, 50, 0, A + 10], [0.35, 18, 0, A + 2]])),
      rot('hombro_d', poses([[0, 0, 0, -A], [0.06, 50, 0, -A - 10], [0.35, 18, 0, -A - 2]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.06, -28, 0, 0], [0.35, -8, 0, 0]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.06, 34, 0, 0], [0.35, 10, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 0.9, 1.08, 1.12], [0.35, 1, 1, 1]])),
    ], 'movimiento', 'Se lanza hacia delante.', false),

    animacion('Golpe recibido', 0.45, [
      rot('pecho', poses([[0, 0, 0, 0], [0.08, -14, 0, 4], [0.45, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, -16, 8, 6], [0.45, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, A], [0.08, -18, 0, A + 26], [0.45, 0, 0, A]])),
      rot('hombro_d', poses([[0, 0, 0, -A], [0.08, -18, 0, -A - 26], [0.45, 0, 0, -A]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.06, 0.93, 1.06], [0.2, 0.98, 1.03, 0.98], [0.45, 1, 1, 1]])),
      ...ojos(poses([[0, 1, 1, 1], [0.06, 1.3, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Encaja el golpe y vuelve a plantarse.', false),

    animacion('Victoria', 1.2, [
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, Math.abs(sen(f, 2)) * 0.14, 0])),
      rot('hombro_i', ciclo(1.2, (f) => [-165, 0, 16 + sen(f, 2) * 8])),
      rot('hombro_d', ciclo(1.2, (f) => [-165, 0, -16 - sen(f, 2) * 8])),
      rot('codo_i', ciclo(1.2, () => [-12, 0, 0])),
      rot('codo_d', ciclo(1.2, () => [-12, 0, 0])),
      rot('pecho', ciclo(1.2, (f) => [-6, sen(f) * 8, 0])),
      rot('cabeza', ciclo(1.2, (f) => [-12 + sen(f, 4) * 5, sen(f) * 8, 0])),
      latido(1.2, 0.25, 4),
      ...ropa(1.2, 14),
      ...ojos(ciclo(1.2, () => [1.15, 0.6, 1])),
    ], 'reaccion', 'Levanta los brazos y rebota: el sol vuelve.'),

    animacion('Derrota', 1.4, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.3, 0, 0.03, 0], [0.8, 0, -P.pierna * 0.66, -0.12], [0.95, 0, -P.pierna * 0.6, -0.12], [1.4, 0, -P.pierna * 0.64, -0.12]])),
      rot('pierna_i', poses([[0, 0, 0, 0], [0.8, -80, 0, 10], [1.4, -76, 0, 10]])),
      rot('pierna_d', poses([[0, 0, 0, 0], [0.8, -80, 0, -10], [1.4, -76, 0, -10]])),
      rot('rodilla_i', poses([[0, 3, 0, 0], [0.8, 40, 0, 0], [1.4, 36, 0, 0]])),
      rot('rodilla_d', poses([[0, 3, 0, 0], [0.8, 40, 0, 0], [1.4, 36, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.3, 8, 0, 0], [0.8, -14, 0, 0], [1.4, 10, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, A], [0.8, 10, 0, A + 16], [1.4, 0, 0, A + 8]])),
      rot('hombro_d', poses([[0, 0, 0, -A], [0.8, 10, 0, -A - 16], [1.4, 0, 0, -A - 8]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.8, -10, 0, 0], [1.4, 30, 0, 6]])),
      esc('ada', poses([[0, 1, 1, 1], [0.8, 0.7, 0.7, 0.7], [1.4, 0.4, 0.4, 0.4]])),
    ], 'reaccion', 'Cae sentado y ADA se apaga.', false),

    animacion('Habilidad', 1.1, [
      mov(raiz, 'cadera', poses([[0, 0, 0, 0], [0.3, 0, -0.16 * k, 0], [0.5, 0, 0.1 * k, 0], [1.1, 0, 0, 0]])),
      rot('pecho', poses([[0, 0, 0, 0], [0.3, 16, 0, 0], [0.5, -12, 0, 0], [0.9, -8, 0, 0], [1.1, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.5, -16, 0, 0], [1.1, 0, 0, 0]])),
      rot('hombro_i', poses([[0, 0, 0, A], [0.3, 24, 0, A + 8], [0.5, -160, 0, A + 22], [0.9, -150, 0, A + 22], [1.1, 0, 0, A]])),
      rot('hombro_d', poses([[0, 0, 0, -A], [0.3, 24, 0, -A - 8], [0.5, -160, 0, -A - 22], [0.9, -150, 0, -A - 22], [1.1, 0, 0, -A]])),
      esc('ada', poses([[0, 1, 1, 1], [0.5, 2.1, 2.1, 2.1], [0.9, 1.7, 1.7, 1.7], [1.1, 1, 1, 1]])),
      ...ropa(1.1, 20),
    ], 'ataque', 'Levanta los brazos y ADA se enciende.', false),
  ];
}

// ------------------------------------------------------------- montaje

/** Construye el modelo completo de una receta ya validada. */
export function crearHeroe(r: Receta): Modelo {
  return conDetalle(0.55, () => {
    const P = PROPORCIONES[r.silueta];
    const raiz = new THREE.Group();
    raiz.name = 'heroe';
    const cuerpo = nodo('cuerpo', raiz);
    const cadera = nodo('cadera', cuerpo, 0, P.pierna, 0);
    const pecho = nodo('pecho', cadera, 0, 0.06, 0);
    const tronco = nodo('tronco', pecho);
    const cab = nodo('cabeza', pecho, 0, P.tronco + 0.06, 0.03);
    const R = r.torso === 'chasis' ? P.pechoR * 1.0 : 0;
    const t: Taller = {
      r, P, M: materiales(r), raiz, cuerpo, cadera, pecho, tronco, cabeza: cab,
      L: (P.pierna - 0.04) / 2,
      cy: P.cabeza * 1.04 + (r.cabeza === 'robot' ? 0.06 : 0),
      pelo: r.cabeza === 'cupula' ? P.cabeza * 0.72 : P.cabeza,
      dorso: r.torso === 'chasis' ? R * P.fondo + 0.02 : (P.cinturaR + (P.pechoR - P.cinturaR) * 0.6) * P.fondo,
      sup: (k) => r.torso === 'chasis' ? R * P.fondo : (P.cinturaR + (P.pechoR - P.cinturaR) * k) * P.fondo,
    };
    piernas(t);
    torso(t);
    brazos(t);
    espalda(t);
    cabeza(t);
    pelo(t);
    tocado(t);
    rostro(t);
    mano(t);
    return { id: 'heroe', nombre: r.nombre, rol: 'Héroe diseñado por ADA', raiz, animaciones: animar(t) };
  });
}
