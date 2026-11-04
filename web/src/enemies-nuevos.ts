import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EnemyDef } from './data.ts';

// ============================================================================
// META SPACE — Enemigos nuevos A: tipos con identidad (FOCO 4)
//
// Cuatro unidades de HELIOS con IA y rol distintos. Encajan en el render
// actual (InstancedMesh por tipo: cuerpo + ojo) sin romperlo.
//
// INTEGRACIÓN (ver integracion.md para el parche exacto):
//   1. data.ts: extender la unión `EnemyId` con `NuevoEnemyId`.
//   2. data.ts: añadir `...NUEVOS` al `ENEMIES` existente.
//   3. enemies.ts: añadir los 4 ids a `TYPES` y delegar geometría, color,
//      movimiento (`moverNuevo`) y altura visual (`liftDe`) a este módulo.
//   4. game.ts: gancho de esporas (sembrador), crías al morir (caparazón)
//      y composición de oleadas (`pesoAparicion`, `oleadaEspecial`).
//   5. ui.ts: añadir `NUEVO_ENEMY_ICON` a `ENEMY_ICON` y 4 colores al minimapa.
//
// Todo el texto visible va en español.
// ============================================================================

export type NuevoEnemyId = 'saltador' | 'avispa' | 'caparazon' | 'sembrador' | 'acechador' | 'bombardero' | 'coloso' | 'espectro';

/** Compatible con `EnemyDef`, pero con el id nuevo (ver paso 1 del parche). */
export interface NuevoEnemyDef extends Omit<EnemyDef, 'id'> {
  id: NuevoEnemyId;
}

export function esNuevo(id: string): id is NuevoEnemyId {
  return id in NUEVOS;
}

// ---------------------------------------------------------------- Definiciones

/**
 * Identidad de cada uno:
 * - saltador   = precisión evasiva: acecha, telegrafía y salta (hay que
 *                moverse lateral cuando se agacha).
 * - avispa     = hostigadora aérea: orbita fuera del alcance y pica en
 *                picado (el peligro viene de arriba y de los lados).
 * - caparazon  = tanque: lento, inmune al empuje y se divide en 3
 *                Recolectores al morir (no lo mates rodeado).
 * - sembrador  = francotirador de esporas: mantiene la distancia y dispara
 *                salvas lentas y esquivables (acércate para anularlo).
 * - acechador  = depredador: te rodea a media distancia, se para un instante y
 *                embiste en línea recta (apártate cuando se quede quieto).
 * - bombardero = vuela alto y suelta salvas en abanico desde arriba.
 * - coloso     = muro andante: lento, inmune al empuje; cada pocos segundos da
 *                un pisotón que barre lo que tenga cerca.
 * - espectro   = se desvanece y reaparece a tu lado: no vale quedarse quieto.
 *
 * Cada sector trae solo algunos (ver `Fauna` en planetas.ts).
 */
export const NUEVOS: Record<NuevoEnemyId, NuevoEnemyDef> = {
  saltador: {
    id: 'saltador', name: 'Saltador', hp: 30, speed: 2.2, damage: 14, radius: 0.5,
    scrap: 2, height: 0.7,
    blurb: 'Podador de viñas orbitales: todavía cree que corres porque quieres jugar.',
  },
  avispa: {
    id: 'avispa', name: 'Avispa', hp: 19, speed: 4.2, damage: 5, radius: 0.4,
    scrap: 2, height: 3.4,
    blurb: 'Mensajera de HELIOS con un ala rota: el mensaje llega igualmente.',
  },
  caparazon: {
    id: 'caparazon', name: 'Caparazón', hp: 95, speed: 1.1, damage: 15, radius: 1.0,
    scrap: 3, height: 0.6,
    blurb: 'Arca de siembra: protege su carga incluso después de muerta.',
  },
  sembrador: {
    id: 'sembrador', name: 'Sembrador', hp: 35, speed: 2.6, damage: 6, radius: 0.55,
    scrap: 5, height: 1.4,
    blurb: 'Jardinero de HELIOS: planta donde más duele.',
  },
  acechador: {
    id: 'acechador', name: 'Acechador', hp: 26, speed: 4.4, damage: 16, radius: 0.55,
    scrap: 3, height: 0.55,
    blurb: 'Perro de presa de las minas. Sigue cazando lo que ya no existe.',
  },
  bombardero: {
    id: 'bombardero', name: 'Bombardero', hp: 34, speed: 2.8, damage: 0, radius: 0.7,
    scrap: 4, height: 5.2,
    blurb: 'Fumigador agrícola. Ahora fumiga lo que se mueve.',
  },
  coloso: {
    id: 'coloso', name: 'Coloso', hp: 300, speed: 1.35, damage: 26, radius: 1.5,
    scrap: 14, height: 1.1,
    blurb: 'Excavadora de túneles. Abre camino por encima de lo que haya.',
  },
  espectro: {
    id: 'espectro', name: 'Espectro', hp: 40, speed: 2.6, damage: 12, radius: 0.5,
    scrap: 4, height: 1.0,
    blurb: 'Eco de una señal vieja. Nadie lo programó para estar en dos sitios.',
  },
};

/** Minuto de partida a partir del cual aparece cada tipo. */
export const DESBLOQUEO: Record<NuevoEnemyId, number> = {
  saltador: 1,
  avispa: 2,
  caparazon: 3,
  sembrador: 3,
  acechador: 1.5,
  bombardero: 3,
  coloso: 4,
  espectro: 2.5,
};

/** Inmunes al empuje (`knockback`), como el Segador. */
export function inmuneAlEmpuje(id: string): boolean {
  return id === 'segador' || id === 'caparazon' || id === 'coloso';
}

/** Qué suelta cada tipo al morir (además de la chatarra). Solo el tanque. */
export function criasAlMorir(id: string): { tipo: string; n: number }[] {
  if (id === 'caparazon') return [{ tipo: 'recolector', n: 3 }];
  return [];
}

// ------------------------------------------------------- Pixel-art por código

/**
 * Estética vóxeles: cada cuerpo se construye con cajas (estilo pixel-art 3D),
 * el mismo lenguaje de `bodyGeometry` en enemies.ts (primitivas + merge).
 * Pocas cajas por tipo: con cientos de instancias, cada triángulo cuenta.
 */
function vxel(
  partes: THREE.BufferGeometry[],
  x: number, y: number, z: number, w: number, h: number, d: number,
): void {
  partes.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
}

function fusionar(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(partes.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/** Geometría del cuerpo. `enemies.ts` la llama desde `bodyGeometry` (paso 3). */
export function nuevoBodyGeometry(type: NuevoEnemyId): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  switch (type) {
    case 'saltador': {
      // Cuerpo bajo y compacto + dos patas traseras enmuelladas + ojo.
      vxel(p, 0, 0.05, 0, 0.62, 0.42, 0.8);          // torso
      vxel(p, -0.38, -0.18, -0.28, 0.2, 0.55, 0.24);  // pata izq (muelle)
      vxel(p, 0.38, -0.18, -0.28, 0.2, 0.55, 0.24);   // pata der (muelle)
      vxel(p, -0.38, -0.5, -0.28, 0.3, 0.12, 0.4);    // pie izq
      vxel(p, 0.38, -0.5, -0.28, 0.3, 0.12, 0.4);     // pie der
      vxel(p, 0, 0.3, 0.1, 0.4, 0.22, 0.3);           // joroba
      vxel(p, 0, 0.0, 0.44, 0.5, 0.3, 0.14);          // morro
      vxel(p, -0.2, 0.32, 0.3, 0.1, 0.3, 0.1);        // antena izq
      vxel(p, 0.2, 0.32, 0.3, 0.1, 0.3, 0.1);         // antena der
      break;
    }
    case 'avispa': {
      // Tórax + abdomen rayado + aguijón + dos alas planas.
      vxel(p, 0, 0.1, 0.15, 0.42, 0.36, 0.44);        // tórax
      vxel(p, 0, 0.05, -0.35, 0.3, 0.28, 0.5);        // abdomen
      vxel(p, 0, 0.05, -0.35, 0.34, 0.1, 0.12);       // raya clara
      vxel(p, 0, 0.0, -0.72, 0.12, 0.12, 0.3);        // aguijón
      vxel(p, -0.42, 0.3, 0.05, 0.5, 0.06, 0.34);     // ala izq
      vxel(p, 0.42, 0.3, 0.05, 0.5, 0.06, 0.34);      // ala der
      vxel(p, 0, -0.12, 0.3, 0.2, 0.2, 0.2);          // cabeza
      break;
    }
    case 'caparazon': {
      // Cúpula de placas escalonadas + borde + 4 patas cortas.
      vxel(p, 0, 0.3, 0, 1.5, 0.35, 1.7);             // placa base
      vxel(p, 0, 0.58, 0, 1.1, 0.3, 1.3);             // placa media
      vxel(p, 0, 0.82, 0, 0.66, 0.26, 0.86);         // placa alta
      vxel(p, 0, 0.99, 0, 0.3, 0.16, 0.4);            // cresta
      vxel(p, -0.8, -0.25, 0.55, 0.28, 0.5, 0.28);    // pata delantera izq
      vxel(p, 0.8, -0.25, 0.55, 0.28, 0.5, 0.28);     // pata delantera der
      vxel(p, -0.8, -0.25, -0.55, 0.28, 0.5, 0.28);   // pata trasera izq
      vxel(p, 0.8, -0.25, -0.55, 0.28, 0.5, 0.28);    // pata trasera der
      vxel(p, 0, -0.05, 0.88, 0.5, 0.28, 0.16);       // morro frontal
      break;
    }
    case 'sembrador': {
      // Tallo + bulbo con tres vainas + corona de esporas.
      vxel(p, 0, -0.35, 0, 0.28, 0.9, 0.28);          // tallo
      vxel(p, 0, 0.25, 0, 0.62, 0.55, 0.62);         // bulbo
      vxel(p, -0.33, 0.2, 0, 0.18, 0.4, 0.3);        // vaina izq
      vxel(p, 0.33, 0.2, 0, 0.18, 0.4, 0.3);         // vaina der
      vxel(p, 0, 0.2, 0.33, 0.3, 0.4, 0.18);         // vaina frontal
      vxel(p, 0, 0.62, 0, 0.4, 0.18, 0.4);           // corona
      vxel(p, -0.14, 0.78, 0, 0.14, 0.16, 0.14);     // espora izq
      vxel(p, 0.14, 0.78, 0, 0.14, 0.16, 0.14);      // espora der
      vxel(p, 0, 0.78, 0, 0.14, 0.16, 0.14);         // espora centro
      break;
    }
    case 'acechador': {
      vxel(p, 0, 0, 0, 0.5, 0.38, 1.05);             // lomo
      vxel(p, 0, 0.1, 0.62, 0.36, 0.3, 0.34);        // cabeza
      vxel(p, 0, 0.02, 0.86, 0.2, 0.12, 0.2);        // hocico
      vxel(p, 0, 0.3, -0.1, 0.12, 0.26, 0.7);        // cresta
      for (const s of [-1, 1]) {
        vxel(p, s * 0.32, -0.28, 0.36, 0.14, 0.42, 0.14); // pata delantera
        vxel(p, s * 0.32, -0.28, -0.36, 0.14, 0.42, 0.14); // pata trasera
        vxel(p, s * 0.42, 0.05, 0.1, 0.1, 0.12, 0.7);  // cuchilla
      }
      break;
    }
    case 'bombardero': {
      vxel(p, 0, 0, 0, 0.7, 0.42, 1.3);              // fuselaje
      vxel(p, 0, 0.26, -0.15, 0.4, 0.2, 0.6);        // lomo
      vxel(p, 0, -0.34, 0, 0.5, 0.3, 0.6);           // depósito
      for (const s of [-1, 1]) {
        vxel(p, s * 0.9, 0.05, 0, 1.1, 0.1, 0.5);    // ala
        vxel(p, s * 1.4, 0.14, 0, 0.28, 0.2, 0.28);  // rotor
      }
      vxel(p, 0, 0.1, -0.85, 0.16, 0.32, 0.5);       // cola
      break;
    }
    case 'coloso': {
      vxel(p, 0, 0.1, 0, 1.2, 1.15, 1.0);            // torso
      vxel(p, 0, 0.82, 0.08, 0.68, 0.46, 0.68);      // cabeza
      vxel(p, 0, 0.78, 0.45, 0.46, 0.16, 0.12);      // visor
      for (const s of [-1, 1]) {
        vxel(p, s * 0.86, 0.3, 0.1, 0.52, 0.5, 0.62); // hombro
        vxel(p, s * 0.92, -0.32, 0.18, 0.46, 0.9, 0.5); // brazo
        vxel(p, s * 0.42, -0.72, 0, 0.42, 0.62, 0.56); // pierna
      }
      break;
    }
    case 'espectro': {
      vxel(p, 0, 0.2, 0, 0.46, 0.74, 0.38);          // cuerpo
      vxel(p, 0, 0.72, 0, 0.36, 0.32, 0.36);         // capucha
      vxel(p, 0, -0.32, 0, 0.56, 0.3, 0.46);         // jirones
      vxel(p, 0.16, -0.6, 0.06, 0.16, 0.28, 0.16);
      vxel(p, -0.18, -0.56, -0.08, 0.14, 0.2, 0.14);
      for (const s of [-1, 1]) vxel(p, s * 0.36, 0.28, 0.08, 0.14, 0.56, 0.14); // brazos
      break;
    }
  }
  return fusionar(p);
}

/** Claros a propósito: sobre el suelo rojo oscuro, el metal oscuro desaparece. */
export const NUEVA_BASE_COLOR: Record<NuevoEnemyId, THREE.Color> = {
  saltador: new THREE.Color('#a8d94a'),
  avispa: new THREE.Color('#b07bff'),
  caparazon: new THREE.Color('#d8c8a8'),
  sembrador: new THREE.Color('#7fe08a'),
  acechador: new THREE.Color('#ff9a4a'),
  bombardero: new THREE.Color('#8fb4c8'),
  coloso: new THREE.Color('#c8a070'),
  espectro: new THREE.Color('#b8c8ff'),
};

export const NUEVO_EYE_COLOR: Record<NuevoEnemyId, string> = {
  saltador: '#ff3b1f',
  avispa: '#ff9a3c',
  caparazon: '#ff3b1f',
  sembrador: '#ffd23a',
  acechador: '#fff27a',
  bombardero: '#ff3b1f',
  coloso: '#ff3b1f',
  espectro: '#7ffff0',
};

export const NUEVO_EYE_OFFSET: Record<NuevoEnemyId, THREE.Vector3> = {
  saltador: new THREE.Vector3(0, 0.02, 0.5),
  avispa: new THREE.Vector3(0, -0.1, 0.42),
  caparazon: new THREE.Vector3(0, -0.05, 0.95),
  sembrador: new THREE.Vector3(0, 0.28, 0.34),
  acechador: new THREE.Vector3(0, 0.16, 0.8),
  bombardero: new THREE.Vector3(0, 0, 0.66),
  coloso: new THREE.Vector3(0, 0.78, 0.52),
  espectro: new THREE.Vector3(0, 0.74, 0.2),
};

export const NUEVA_ESCALA: Record<NuevoEnemyId, number> = {
  saltador: 1.15,
  avispa: 1.2,
  caparazon: 1.35,
  sembrador: 1.25,
  acechador: 1.25,
  bombardero: 1.3,
  coloso: 1.7,
  espectro: 1.35,
};

/** Puntos del minimapa (amplía la paleta de `drawMinimap` en ui.ts). */
export const NUEVO_MINIMAPA: Record<NuevoEnemyId, string> = {
  saltador: '#a8e04a',
  avispa: '#b07bff',
  caparazon: '#e0c8a8',
  sembrador: '#7fe08a',
  acechador: '#ff9a4a',
  bombardero: '#8fb4c8',
  coloso: '#c8a070',
  espectro: '#b8c8ff',
};

/** Iconos del HUD y del Códice (mismo formato que `ENEMY_ICON` en ui.ts). */
export const NUEVO_ENEMY_ICON: Record<NuevoEnemyId, string> = {
  saltador: `<svg viewBox="0 0 40 40"><polygon points="12,28 20,10 28,28" fill="#4a5a2a" stroke="#1b1214" stroke-width="1.5"/><rect x="10" y="28" width="8" height="4" fill="#4a5a2a" stroke="#1b1214"/><rect x="22" y="28" width="8" height="4" fill="#4a5a2a" stroke="#1b1214"/><circle cx="20" cy="22" r="3.2" fill="#ff3b1f"/></svg>`,
  avispa: `<svg viewBox="0 0 40 40"><ellipse cx="12" cy="14" rx="7" ry="3" fill="#8a7ab8" stroke="#1b1214"/><ellipse cx="28" cy="14" rx="7" ry="3" fill="#8a7ab8" stroke="#1b1214"/><rect x="16" y="12" width="8" height="16" rx="3" fill="#5a4a8a" stroke="#1b1214" stroke-width="1.5"/><circle cx="20" cy="18" r="2.6" fill="#ff9a3c"/></svg>`,
  caparazon: `<svg viewBox="0 0 40 40"><rect x="8" y="20" width="24" height="9" rx="2" fill="#8a765a" stroke="#1b1214" stroke-width="1.5"/><rect x="12" y="13" width="16" height="8" rx="2" fill="#a8906c" stroke="#1b1214" stroke-width="1.5"/><rect x="16" y="7" width="8" height="7" rx="1" fill="#d8c8a8" stroke="#1b1214" stroke-width="1.5"/><circle cx="20" cy="24" r="2.4" fill="#ff3b1f"/></svg>`,
  sembrador: `<svg viewBox="0 0 40 40"><line x1="20" y1="36" x2="20" y2="18" stroke="#3a6a3a" stroke-width="3"/><circle cx="20" cy="14" r="7" fill="#3a6a3a" stroke="#1b1214" stroke-width="1.5"/><circle cx="16" cy="12" r="2" fill="#7fe08a"/><circle cx="24" cy="12" r="2" fill="#7fe08a"/><circle cx="20" cy="17" r="2" fill="#7fe08a"/><circle cx="20" cy="7" r="2.4" fill="#ffd23a"/></svg>`,
  acechador: `<svg viewBox="0 0 40 40"><rect x="8" y="16" width="20" height="10" fill="#c87a3a" stroke="#1b1214" stroke-width="1.5"/><rect x="26" y="12" width="9" height="9" fill="#ff9a4a" stroke="#1b1214" stroke-width="1.5"/><rect x="10" y="26" width="4" height="7" fill="#8a4a2a"/><rect x="22" y="26" width="4" height="7" fill="#8a4a2a"/><circle cx="31" cy="16" r="1.6" fill="#fff27a"/></svg>`,
  bombardero: `<svg viewBox="0 0 40 40"><rect x="14" y="14" width="12" height="14" fill="#8fb4c8" stroke="#1b1214" stroke-width="1.5"/><rect x="3" y="17" width="34" height="3" fill="#5a7a8e" stroke="#1b1214"/><circle cx="20" cy="33" r="3" fill="#ff3b1f" stroke="#1b1214"/></svg>`,
  coloso: `<svg viewBox="0 0 40 40"><rect x="11" y="12" width="18" height="19" fill="#c8a070" stroke="#1b1214" stroke-width="1.5"/><rect x="14" y="4" width="12" height="9" fill="#a88050" stroke="#1b1214" stroke-width="1.5"/><rect x="4" y="13" width="7" height="16" fill="#a88050" stroke="#1b1214" stroke-width="1.5"/><rect x="29" y="13" width="7" height="16" fill="#a88050" stroke="#1b1214" stroke-width="1.5"/><rect x="16" y="7" width="8" height="2.5" fill="#ff3b1f"/></svg>`,
  espectro: `<svg viewBox="0 0 40 40"><path d="M10 34 V16 a10 10 0 0 1 20 0 V34 l-5 -4 -5 4 -5 -4 z" fill="#b8c8ff" stroke="#1b1214" stroke-width="1.5"/><circle cx="16" cy="17" r="2" fill="#123"/><circle cx="24" cy="17" r="2" fill="#123"/></svg>`,
};

// ------------------------------------------------------------ Comportamiento

/**
 * Vista estructural mínima del enjambre: `Enemies` la cumple tal cual
 * (mismos nombres de campos), así este módulo no importa `enemies.ts`
 * y no hay ciclos entre archivos.
 */
export interface CuerpoEnemigo {
  readonly count: number;
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly heading: Float32Array;
  readonly seed: Float32Array;
}

export interface ContextoMovimiento {
  dt: number;
  time: number;
  px: number;
  pz: number;
}

export interface SalidaMovimiento {
  vx: number;
  vz: number;
  /** Desplazamiento vertical visual (se suma a `def.height` en `render`). */
  lift: number;
}

const TAU = Math.PI * 2;

/** Fase determinista del ciclo: no necesita arrays nuevos, usa `seed`. */
function fase(time: number, seed: number, periodo: number): number {
  return (time + seed) % periodo;
}

function dirHacia(x: number, z: number, px: number, pz: number): [number, number, number] {
  const dx = px - x, dz = pz - z;
  const d = Math.hypot(dx, dz) || 1;
  return [dx / d, dz / d, d];
}

/** Saltador: acecha (1,5 s, con telegrafía al final) y salta (0,5 s). */
function moverSaltador(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const f = fase(ctx.time, e.seed[i], 2.0);
  const [nx, nz] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  if (f < 1.5) {
    const telegrafia = f > 1.15;
    const v = telegrafia ? 2.2 * 0.3 : 2.2;
    return { vx: nx * v, vz: nz * v, lift: telegrafia ? -0.25 : 0 };
  }
  const s = (f - 1.5) / 0.5;
  return { vx: nx * 9.0, vz: nz * 9.0, lift: 0.9 * Math.sin(s * Math.PI) };
}

/** Avispa: orbita a 7 m y pica hacia el jugador cada 3 s. */
function moverAvispa(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const [nx, nz, dist] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  const f = fase(ctx.time, e.seed[i], 3.0);
  if (f > 2.2) {
    const s = (f - 2.2) / 0.8;
    return { vx: nx * 8.5, vz: nz * 8.5, lift: -2.6 * Math.sin(s * Math.PI) };
  }
  const radial = (dist - 7) * 0.35;
  let vx = nx * radial + -nz * 1.6;
  let vz = nz * radial + nx * 1.6;
  const len = Math.hypot(vx, vz) || 1;
  vx = (vx / len) * 4.2;
  vz = (vz / len) * 4.2;
  return { vx, vz, lift: 0 };
}

/** Caparazón: avance lento e imparable. */
function moverCaparazon(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const [nx, nz] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  return { vx: nx * 1.1, vz: nz * 1.1, lift: 0 };
}

/** Sembrador: mantiene la banda de 12–15 m y se desplaza de lado. */
function moverSembrador(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const [nx, nz, dist] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  // Banda con margen dentro del alcance base del cortador (16 m): el
  // francotirador siempre es alcanzable; su defensa es la distancia, no
  // la inmunidad. El bot detectó que 13–16 lo dejaba intocable en el borde.
  if (dist > 15) return { vx: nx * 2.6, vz: nz * 2.6, lift: 0 };
  if (dist < 12) return { vx: -nx * 2.2, vz: -nz * 2.2, lift: 0 };
  const lado = e.seed[i] % 2 < 1 ? 1 : -1;
  return { vx: -nz * 2.0 * lado + nx * 0.4, vz: nx * 2.0 * lado + nz * 0.4, lift: 0 };
}

/** Acechador: rodea a 9 m, se queda clavado medio segundo y embiste. */
function moverAcechador(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const [nx, nz, dist] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  const f = fase(ctx.time, e.seed[i], 4.2);
  if (f < 2.9) {
    const radial = (dist - 9) * 0.5, lado = e.seed[i] % 2 < 1 ? 1 : -1;
    let vx = nx * radial - nz * 2.4 * lado, vz = nz * radial + nx * 2.4 * lado;
    const len = Math.hypot(vx, vz) || 1;
    vx = (vx / len) * 4.4;
    vz = (vz / len) * 4.4;
    return { vx, vz, lift: 0 };
  }
  if (f < 3.4) return { vx: 0, vz: 0, lift: -0.12 };
  return { vx: nx * 13, vz: nz * 13, lift: 0.1 };
}

/** Bombardero: se coloca encima a 6 m y da vueltas despacio. */
function moverBombardero(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const [nx, nz, dist] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  const radial = (dist - 6) * 0.5;
  let vx = nx * radial - nz * 1.5, vz = nz * radial + nx * 1.5;
  const len = Math.hypot(vx, vz) || 1;
  vx = (vx / len) * Math.min(2.8, len);
  vz = (vz / len) * Math.min(2.8, len);
  return { vx, vz, lift: 0 };
}

/** Coloso: avanza despacio y se para a dar el pisotón (`quierePisar`). */
function moverColoso(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const [nx, nz] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  const f = fase(ctx.time, e.seed[i], 6);
  return f > 5 ? { vx: 0, vz: 0, lift: 0 } : { vx: nx * 1.35, vz: nz * 1.35, lift: 0 };
}

/** Espectro: va hacia ti y, cada cinco segundos, reaparece a tu espalda. */
function moverEspectro(i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento): SalidaMovimiento {
  const f = fase(ctx.time, e.seed[i], 5);
  if (f < ctx.dt) {
    const a = e.seed[i] * 37 + ctx.time, d = 5.5;
    e.x[i] = ctx.px + Math.cos(a) * d;
    e.z[i] = ctx.pz + Math.sin(a) * d;
  }
  const [nx, nz] = dirHacia(e.x[i], e.z[i], ctx.px, ctx.pz);
  return { vx: nx * 2.6, vz: nz * 2.6, lift: 0 };
}

/**
 * Movimiento de un enemigo nuevo. `enemies.ts` lo llama desde `update`
 * (paso 3 del parche); lo devuelto pasa por `slow`, separación y empuje
 * como cualquier otro enemigo.
 */
export function moverNuevo(
  id: NuevoEnemyId, i: number, e: CuerpoEnemigo, ctx: ContextoMovimiento,
): SalidaMovimiento {
  switch (id) {
    case 'saltador': return moverSaltador(i, e, ctx);
    case 'avispa': return moverAvispa(i, e, ctx);
    case 'caparazon': return moverCaparazon(i, e, ctx);
    case 'sembrador': return moverSembrador(i, e, ctx);
    case 'acechador': return moverAcechador(i, e, ctx);
    case 'bombardero': return moverBombardero(i, e, ctx);
    case 'coloso': return moverColoso(i, e, ctx);
    case 'espectro': return moverEspectro(i, e, ctx);
  }
}

/**
 * Solo la altura visual, para `render` (no necesita la posición del
 * jugador: el salto y el picado son funciones del tiempo y la semilla).
 */
export function liftDe(id: NuevoEnemyId, i: number, e: CuerpoEnemigo, time: number): number {
  const s = e.seed[i];
  if (id === 'saltador') {
    const f = fase(time, s, 2.0);
    if (f < 1.5) return f > 1.15 ? -0.25 : 0;
    return 0.9 * Math.sin(((f - 1.5) / 0.5) * Math.PI);
  }
  if (id === 'avispa') {
    const f = fase(time, s, 3.0);
    if (f > 2.2) return -2.6 * Math.sin(((f - 2.2) / 0.8) * Math.PI);
  }
  if (id === 'acechador') return fase(time, s, 4.2) >= 2.9 && fase(time, s, 4.2) < 3.4 ? -0.14 : 0;
  if (id === 'bombardero') return Math.sin(time * 1.3 + s) * 0.4;
  // El coloso levanta el cuerpo antes de dejarse caer.
  if (id === 'coloso') {
    const f = fase(time, s, 6);
    if (f > 5) return f < 5.7 ? (f - 5) * 1.2 : (6 - f) * 2.8;
  }
  return 0;
}

/** ¿Debe el bombardero `i` soltar su salva este fotograma? Una cada 5 s. */
export function quiereBombardear(i: number, e: CuerpoEnemigo, time: number, dt: number): boolean {
  return fase(time, e.seed[i], 5.0) < dt;
}

/** ¿Cae ahora el pie del coloso `i`? */
export function quierePisar(i: number, e: CuerpoEnemigo, time: number, dt: number): boolean {
  const f = fase(time, e.seed[i], 6);
  return f >= 5.7 && f - dt < 5.7;
}

/** Medio segundo antes de pisar, para enseñar en el suelo a dónde llega. */
export function vaAPisar(i: number, e: CuerpoEnemigo, time: number, dt: number): boolean {
  const f = fase(time, e.seed[i], 6);
  return f >= 5.1 && f - dt < 5.1;
}

/** ¿Debe el sembrador `i` abrir fuego este fotograma? (una salva por ciclo).
 * Quien llama comprueba además la distancia (menos de 20 m). */
export function quiereDisparar(i: number, e: CuerpoEnemigo, time: number, dt: number): boolean {
  return fase(time, e.seed[i], 4.0) < dt;
}

// ------------------------------------------------------------------- Esporas

const MAX_ESPORAS = 120;
const VELOCIDAD_ESPORA = 6.5;
const DANIO_ESPORA = 6;

/**
 * Salvas del Sembrador: orbes lentos y esquivables en abanico de 3.
 * `game.ts` la crea una vez, llama a `disparar` cuando `quiereDisparar`
 * y resta lo que devuelve `update` a la vida del jugador.
 */
export class NubeEsporas {
  private scene: THREE.Scene;
  private suelo: { heightAt(x: number, z: number): number };
  private n = 0;
  private x = new Float32Array(MAX_ESPORAS);
  private z = new Float32Array(MAX_ESPORAS);
  private vx = new Float32Array(MAX_ESPORAS);
  private vz = new Float32Array(MAX_ESPORAS);
  private vida = new Float32Array(MAX_ESPORAS);
  private mesh: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private escala = new THREE.Vector3(1, 1, 1);
  private quat = new THREE.Quaternion();

  constructor(scene: THREE.Scene, suelo: { heightAt(x: number, z: number): number }) {
    this.scene = scene;
    this.suelo = suelo;
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#9df09a' }),
      MAX_ESPORAS,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Abanico de 3 esporas hacia el jugador. */
  disparar(ox: number, oz: number, px: number, pz: number): void {
    const base = Math.atan2(px - ox, pz - oz);
    for (const desvio of [-0.18, 0, 0.18]) {
      if (this.n >= MAX_ESPORAS) return;
      const k = this.n++;
      const a = base + desvio;
      this.x[k] = ox;
      this.z[k] = oz;
      this.vx[k] = Math.sin(a) * VELOCIDAD_ESPORA;
      this.vz[k] = Math.cos(a) * VELOCIDAD_ESPORA;
      this.vida[k] = Math.hypot(px - ox, pz - oz) / VELOCIDAD_ESPORA + 1.2;
    }
  }

  /** Mueve las esporas y devuelve el daño que hacen al jugador. */
  update(dt: number, px: number, pz: number, radioJugador: number): number {
    let danio = 0;
    for (let k = 0; k < this.n;) {
      this.x[k] += this.vx[k] * dt;
      this.z[k] += this.vz[k] * dt;
      this.vida[k] -= dt;
      const dx = this.x[k] - px, dz = this.z[k] - pz;
      const impacto = dx * dx + dz * dz < (radioJugador + 0.35) ** 2;
      if (impacto) danio += DANIO_ESPORA;
      if (impacto || this.vida[k] <= 0) {
        const last = --this.n;
        this.x[k] = this.x[last];
        this.z[k] = this.z[last];
        this.vx[k] = this.vx[last];
        this.vz[k] = this.vz[last];
        this.vida[k] = this.vida[last];
        continue;
      }
      k++;
    }
    for (let k = 0; k < this.n; k++) {
      this.pos.set(this.x[k], this.suelo.heightAt(this.x[k], this.z[k]) + 0.9, this.z[k]);
      this.matrix.compose(this.pos, this.quat, this.escala);
      this.mesh.setMatrixAt(k, this.matrix);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    return danio;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ------------------------------------------------------------------- Director

export type Patron = 'anillo' | 'pinza' | 'escolta' | 'enjambre';

export interface Composicion {
  tipo: string;
  n: number;
  patron: Patron;
  minuto: number;
}

/**
 * Goteo especial con presupuesto FIJO por tipo (apariciones por segundo
 * una vez desbloqueado). A propósito NO es un peso sobre el goteo base:
 * el goteo base crece cuadráticamente y un peso proporcional inundaba de
 * especiales el final (el bot moría siempre en min 7-9 con el cupo lleno).
 * Con tasa fija, cada especial es una pieza de intención con cadencia
 * legible: ~1 saltador cada 8 s, ~1 avispa cada 11 s, etc.
 * `game.ts` acumula `deuda[id] += tasaEspecial(id, minuto) * dt` y genera
 * cuando supera 1 (respetando `CUPO`, comprobado con `countOf`).
 */
export function tasaEspecial(id: NuevoEnemyId, minuto: number): number {
  if (minuto < DESBLOQUEO[id]) return 0;
  switch (id) {
    case 'saltador': return 0.12;
    case 'avispa': return 0.09;
    case 'caparazon': return 0.025;
    case 'sembrador': return 0.035;
    case 'acechador': return 0.07;
    case 'bombardero': return 0.04;
    case 'coloso': return 0.012;
    case 'espectro': return 0.05;
  }
}

/**
 * Peso en el goteo continuo (`direct`): cuánto de cada tipo sale mezclado
 * con Recolectores según el minuto. Pesos bajos a propósito: son piezas
 * de intención, no carne de goteo; el grueso sigue siendo Recolector.
 */
export function pesoAparicion(id: NuevoEnemyId, minuto: number): number {
  if (minuto < DESBLOQUEO[id]) return 0;
  switch (id) {
    case 'saltador': return 0.1;
    case 'avispa': return 0.08;
    case 'caparazon': return 0.03;
    case 'sembrador': return 0.03;
    case 'acechador': return 0.08;
    case 'bombardero': return 0.04;
    case 'coloso': return 0.01;
    case 'espectro': return 0.05;
  }
}

/**
 * Cupo máximo de cada tipo vivo a la vez. Sin cupo, el goteo acumulaba
 * francotiradores hasta volverlos opresivos; con cupo, el director los
 * raciona y cada uno importa. `game.ts` lo comprueba con `countOf`.
 */
export const CUPO: Record<NuevoEnemyId, number> = {
  saltador: 10,
  avispa: 8,
  caparazon: 2,
  sembrador: 3,
  acechador: 8,
  bombardero: 3,
  coloso: 2,
  espectro: 6,
};

/**
 * Oleadas con intención (complementa el anillo de Recolectores y los
 * Segadores actuales; el minuto 5+ alterna para no repetirse).
 */
export function oleadaEspecial(minuto: number): Composicion[] | null {
  switch (minuto) {
    case 2:
      return [{ tipo: 'saltador', n: 10, patron: 'anillo', minuto }];
    case 3:
      return [{ tipo: 'avispa', n: 8, patron: 'pinza', minuto }];
    case 4:
      return [
        { tipo: 'caparazon', n: 2, patron: 'escolta', minuto },
        { tipo: 'recolector', n: 6, patron: 'escolta', minuto },
      ];
    case 5:
      // Dos francotiradores, no tres: con el Segador del min 5 cerca,
      // tres cerraban la pinza sin salida. (Medido con el bot.)
      return [
        { tipo: 'sembrador', n: 2, patron: 'pinza', minuto },
        { tipo: 'avispa', n: 4, patron: 'escolta', minuto },
      ];
    default:
      if (minuto <= 1) return null;
      // A partir del 6: rotan las cuatro intenciones, pero cada DOS minutos.
      // Cada minuto sería un muro: el goteo tardío ya es alto por sí solo
      // y la oleada base en anillo también cae cada minuto. (Medido con el bot.)
      if (minuto % 2 === 1) return null;
      return oleadaEspecial([2, 3, 4, 5][minuto % 4]);
  }
}

/** Dónde aparece cada patrón respecto al jugador (ángulo base aleatorio). */
export function angulosDePatron(patron: Patron, n: number, base: number): number[] {
  const angulos: number[] = [];
  if (patron === 'anillo') {
    for (let k = 0; k < n; k++) angulos.push(base + (k / n) * TAU);
  } else if (patron === 'pinza') {
    for (let k = 0; k < n; k++) {
      const lado = k % 2 === 0 ? 1 : -1;
      angulos.push(base + lado * (0.5 + Math.floor(k / 2) * 0.25));
    }
  } else {
    // 'escolta' y 'enjambre': grupo compacto con algo de dispersión.
    for (let k = 0; k < n; k++) angulos.push(base + (k - (n - 1) / 2) * 0.18);
  }
  return angulos;
}
