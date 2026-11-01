import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENEMIES, EnemyId, RUN } from './data';
import { World } from './world';
import {
  NUEVA_BASE_COLOR, NUEVA_ESCALA, NUEVO_EYE_COLOR, NUEVO_EYE_OFFSET,
  esNuevo, inmuneAlEmpuje, liftDe, moverNuevo, nuevoBodyGeometry,
} from './enemies-nuevos';
import { Tropa } from './modelos/tropa';
import { crearRecolector } from './modelos/recolector';
import { crearBaliza } from './modelos/baliza';
import type { Modelo } from './modelos/kit';

const TYPES: EnemyId[] = ['recolector', 'baliza', 'segador', 'saltador', 'avispa', 'caparazon', 'sembrador'];
const CAPACITY = 700;

// Cuadrícula espacial: lista enlazada por celda, reconstruida cada fotograma.
// Sin Map ni arrays nuevos: con cientos de enemigos la basura se nota.
const CELL = 2.5;
const SPAN = Math.ceil((RUN.arena * 2 + 10) / CELL);

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

function bodyGeometry(type: EnemyId): THREE.BufferGeometry {
  switch (type) {
    case 'recolector': {
      const ring = new THREE.TorusGeometry(0.62, 0.08, 6, 16).rotateX(Math.PI / 2);
      const claw = new THREE.BoxGeometry(0.12, 0.5, 0.12);
      return mergeParts([
        new THREE.IcosahedronGeometry(0.48, 0),
        ring,
        claw.clone().translate(-0.25, -0.45, 0.15),
        claw.clone().translate(0.25, -0.45, 0.15),
      ]);
    }
    case 'baliza': {
      const mast = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5).translate(0, 0.8, 0);
      const dish = new THREE.CylinderGeometry(0.45, 0.1, 0.12, 10).translate(0, 1.2, 0);
      return mergeParts([new THREE.OctahedronGeometry(0.45, 0).scale(1, 1.4, 1), mast, dish]);
    }
    case 'segador': {
      const blade = new THREE.CylinderGeometry(0.55, 0.55, 2.6, 10).rotateZ(Math.PI / 2);
      return mergeParts([
        new THREE.BoxGeometry(1.8, 1.4, 2.0),
        new THREE.BoxGeometry(1.2, 0.8, 0.9).translate(0, 1.0, -0.3),
        blade.translate(0, -0.35, 1.25),
      ]);
    }
    default:
      return nuevoBodyGeometry(type as 'saltador' | 'avispa' | 'caparazon' | 'sembrador');
  }
}

const BASE_COLOR: Record<EnemyId, THREE.Color> = {
  // Claros a propósito: sobre el suelo rojo oscuro, el metal oscuro desaparece.
  recolector: new THREE.Color('#a8a4ac'),
  baliza: new THREE.Color('#d8cf8a'),
  segador: new THREE.Color('#c07a3a'),
  ...NUEVA_BASE_COLOR,
};
const EYE_COLOR: Record<EnemyId, string> = {
  recolector: '#ff3b1f',
  baliza: '#ffd23a',
  segador: '#ff3b1f',
  ...NUEVO_EYE_COLOR,
};
const EYE_OFFSET: Record<EnemyId, THREE.Vector3> = {
  recolector: new THREE.Vector3(0, -0.05, 0.45),
  baliza: new THREE.Vector3(0, 1.25, 0),
  segador: new THREE.Vector3(0, 0.15, 1.02),
  ...NUEVO_EYE_OFFSET,
};
const WHITE = new THREE.Color('#ffffff');

/**
 * Tipos con modelo articulado (src/modelos): se dibujan con una Tropa y sus
 * animaciones horneadas en vez del cuerpo fusionado y el ojo suelto.
 */
interface Modelado {
  crear: () => Modelo;
  mover: string;
  /** Animación cerca del jugador (ataque o triangulación) y a qué distancia. */
  cerca: string;
  distCerca: number;
  golpe: string;
  muerte: string;
  escala: number;
  /** Altura de la raíz sobre el suelo (el modelo ya trae su flotación). */
  altura: number;
}

const MODELADOS: Partial<Record<EnemyId, Modelado>> = {
  recolector: {
    crear: crearRecolector, mover: 'Caminar', cerca: 'Aspirar', distCerca: 2.4,
    golpe: 'Golpe recibido', muerte: 'Derrota', escala: 1.1, altura: 0,
  },
  baliza: {
    crear: crearBaliza, mover: 'Flotar', cerca: 'Triangular', distCerca: 14,
    golpe: 'Golpe recibido', muerte: 'Derrota', escala: 1.1, altura: 1.0,
  },
};

/** Restos animados: el enemigo muerto reproduce su caída antes de desaparecer. */
interface Resto { tipo: EnemyId; x: number; z: number; heading: number; escala: number; t: number }
const MAX_RESTOS = 160;

/** Modificadores de élite (FOCO 5): adorno sobre el tipo base. */
export type EliteMod = 'rapido' | 'blindado' | 'simbionte';
/** Multiplicador de chatarra según élite (null = normal). */
export function multChatarraElite(mod: EliteMod | null): number {
  return mod === 'rapido' ? 3 : mod === 'blindado' ? 5 : mod === 'simbionte' ? 4 : 1;
}
const ELITE_IDX: Record<EliteMod, number> = { rapido: 0, blindado: 1, simbionte: 2 };
const ELITE_HP = [1.6, 2.5, 1.8];
const ELITE_VEL = [1.45, 0.8, 1.0];
const ELITE_DANO = [1.15, 1.3, 1.0];
const ELITE_TINTE = ['#ff5a3c', '#b98cff', '#7dff6a'];
const ELITE_ESCALA = [1.12, 1.25, 1.12];
const SCALE: Record<EnemyId, number> = {
  recolector: 1.3, baliza: 1.25, segador: 1.35, ...NUEVA_ESCALA,
};

export class Enemies {
  count = 0;
  readonly type = new Uint8Array(CAPACITY);
  readonly x = new Float32Array(CAPACITY);
  readonly z = new Float32Array(CAPACITY);
  readonly hp = new Float32Array(CAPACITY);
  readonly maxHp = new Float32Array(CAPACITY);
  readonly heading = new Float32Array(CAPACITY);
  readonly flash = new Float32Array(CAPACITY);
  readonly squash = new Float32Array(CAPACITY);
  readonly slow = new Float32Array(CAPACITY);
  readonly slowFactor = new Float32Array(CAPACITY).fill(0.5);
  readonly pushX = new Float32Array(CAPACITY);
  readonly pushZ = new Float32Array(CAPACITY);
  readonly seed = new Float32Array(CAPACITY);
  /** Élite por índice: -1 ninguna, 0 rápido, 1 blindado, 2 simbionte. */
  readonly elite = new Int8Array(CAPACITY).fill(-1);

  private head = new Int32Array(SPAN * SPAN);
  private next = new Int32Array(CAPACITY);

  private bodies = new Map<EnemyId, THREE.InstancedMesh>();
  private eyes = new Map<EnemyId, THREE.InstancedMesh>();
  private tropas = new Map<EnemyId, Tropa>();
  private restos: Resto[] = [];
  private px = 0;
  private pz = 0;
  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private pos = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private scale = new THREE.Vector3(1, 1, 1);
  private color = new THREE.Color();
  private tint = new THREE.Color();
  private tmp = { x: 0, z: 0 };
  private time = 0;

  /** Se llama justo antes de quitar un enemigo muerto. */
  onDeath: (i: number) => void = () => {};

  constructor(scene: THREE.Scene, private world: World) {
    for (const type of TYPES) {
      const modelado = MODELADOS[type];
      if (modelado) {
        this.tropas.set(type, new Tropa(scene, modelado.crear, CAPACITY,
          [modelado.mover, modelado.cerca, modelado.golpe, modelado.muerte]));
        continue;
      }
      const body = new THREE.InstancedMesh(bodyGeometry(type), new THREE.MeshLambertMaterial(), CAPACITY);
      body.castShadow = true;
      body.count = 0;
      body.frustumCulled = false;
      const eye = new THREE.InstancedMesh(
        new THREE.SphereGeometry(type === 'segador' ? 0.22 : 0.13, 8, 6),
        new THREE.MeshBasicMaterial({ color: EYE_COLOR[type] }),
        CAPACITY,
      );
      eye.count = 0;
      eye.frustumCulled = false;
      scene.add(body, eye);
      this.bodies.set(type, body);
      this.eyes.set(type, eye);
    }
  }

  get typeIds() {
    return TYPES;
  }

  spawn(type: EnemyId, x: number, z: number, hpScale: number, elite: EliteMod | null = null): boolean {
    if (this.count >= CAPACITY) return false;
    const i = this.count++;
    const def = ENEMIES[type];
    const em = elite === null ? -1 : ELITE_IDX[elite];
    this.type[i] = TYPES.indexOf(type);
    this.x[i] = x;
    this.z[i] = z;
    this.hp[i] = this.maxHp[i] = def.hp * hpScale * (em < 0 ? 1 : ELITE_HP[em]);
    this.elite[i] = em;
    this.heading[i] = 0;
    this.flash[i] = 0;
    this.squash[i] = 0;
    this.slow[i] = 0;
    this.slowFactor[i] = 0.5;
    this.pushX[i] = this.pushZ[i] = 0;
    this.seed[i] = Math.random() * 100;
    return true;
  }

  defOf(i: number) {
    return ENEMIES[TYPES[this.type[i]]];
  }

  /** Tipo del enemigo i (los nuevos llegan por aquí desde fuera). */
  tipoDe(i: number): EnemyId {
    return TYPES[this.type[i]];
  }

  /** Modificador de élite del enemigo i (null = normal). */
  eliteDe(i: number): EliteMod | null {
    const e = this.elite[i];
    return e === 0 ? 'rapido' : e === 1 ? 'blindado' : e === 2 ? 'simbionte' : null;
  }

  /** Aplica daño. La muerte se procesa al final del fotograma, en `sweep`. */
  hit(i: number, amount: number, fromX: number, fromZ: number, knockback = 0.25) {
    if (this.hp[i] <= 0) return false;
    this.hp[i] -= amount;
    this.flash[i] = 0.12;
    this.squash[i] = 0.14;
    if (knockback > 0 && !inmuneAlEmpuje(TYPES[this.type[i]])) {
      const dx = this.x[i] - fromX, dz = this.z[i] - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      this.pushX[i] += (dx / d) * knockback * 8;
      this.pushZ[i] += (dz / d) * knockback * 8;
    }
    return this.hp[i] <= 0;
  }

  /**
   * Mueve a todos y devuelve el daño de contacto que recibe el jugador este
   * fotograma.
   */
  update(dt: number, px: number, pz: number, playerRadius: number): number {
    this.time += dt;
    this.px = px;
    this.pz = pz;
    for (const r of this.restos) r.t += dt;
    this.restos = this.restos.filter((r) => r.t < this.tropas.get(r.tipo)!.duracion(MODELADOS[r.tipo]!.muerte) + 0.4);
    this.rebuildGrid();

    let contact = 0;
    for (let i = 0; i < this.count; i++) {
      const type = TYPES[this.type[i]];
      const def = ENEMIES[type];
      let dx = px - this.x[i];
      let dz = pz - this.z[i];
      const dist = Math.hypot(dx, dz) || 1;

      let vx: number, vz: number;
      if (type === 'baliza') {
        // Orbita a distancia, triangulando. No se acerca.
        const want = 10;
        const radial = (dist - want) * 0.3;
        vx = (dx / dist) * radial + (-dz / dist) * 1.2;
        vz = (dz / dist) * radial + (dx / dist) * 1.2;
        const len = Math.hypot(vx, vz) || 1;
        vx = (vx / len) * def.speed;
        vz = (vz / len) * def.speed;
      } else if (esNuevo(type)) {
        ({ vx, vz } = moverNuevo(type, i, this, { dt, time: this.time, px, pz }));
      } else {
        vx = (dx / dist) * def.speed;
        vz = (dz / dist) * def.speed;
      }

      if (this.slow[i] > 0) {
        this.slow[i] -= dt;
        vx *= this.slowFactor[i];
        vz *= this.slowFactor[i];
      }
      if (this.elite[i] >= 0) {
        vx *= ELITE_VEL[this.elite[i]];
        vz *= ELITE_VEL[this.elite[i]];
      }

      // Separación: que no se apilen todos en el mismo punto.
      const [sx, sz] = this.separation(i, def.radius);
      vx += sx * 2.5;
      vz += sz * 2.5;

      vx += this.pushX[i];
      vz += this.pushZ[i];
      const decay = Math.exp(-dt * 9);
      this.pushX[i] *= decay;
      this.pushZ[i] *= decay;

      const r = this.world.resolve(this.x[i] + vx * dt, this.z[i] + vz * dt, def.radius, this.tmp);
      this.x[i] = r.x;
      this.z[i] = r.z;

      if (vx * vx + vz * vz > 0.01) {
        const target = Math.atan2(vx, vz);
        let delta = target - this.heading[i];
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.heading[i] += delta * Math.min(1, dt * 8);
      }

      if (this.flash[i] > 0) this.flash[i] -= dt;
    if (this.squash[i] > 0) this.squash[i] -= dt;

      dx = px - this.x[i];
      dz = pz - this.z[i];
      const multDano = this.elite[i] >= 0 ? ELITE_DANO[this.elite[i]] : 1;
      if (def.damage > 0 && dx * dx + dz * dz < (def.radius + playerRadius) ** 2) contact += def.damage * multDano * dt;
    }
    return contact;
  }

  private separation(i: number, radius: number): [number, number] {
    let sx = 0, sz = 0, seen = 0;
    const cx = this.cellX(this.x[i]), cz = this.cellX(this.z[i]);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        const gx = cx + ox, gz = cz + oz;
        if (gx < 0 || gz < 0 || gx >= SPAN || gz >= SPAN) continue;
        for (let j = this.head[gx * SPAN + gz]; j !== -1 && seen < 8; j = this.next[j]) {
          if (j === i) continue;
          const dx = this.x[i] - this.x[j], dz = this.z[i] - this.z[j];
          const min = radius + ENEMIES[TYPES[this.type[j]]].radius;
          const d2 = dx * dx + dz * dz;
          if (d2 >= min * min || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          sx += (dx / d) * (min - d);
          sz += (dz / d) * (min - d);
          seen++;
        }
      }
    return [sx, sz];
  }

  private cellX(v: number) {
    return Math.max(0, Math.min(SPAN - 1, Math.floor((v + RUN.arena + 5) / CELL)));
  }

  private rebuildGrid() {
    this.head.fill(-1);
    for (let i = 0; i < this.count; i++) {
      const c = this.cellX(this.x[i]) * SPAN + this.cellX(this.z[i]);
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
  }

  /** Llama a `fn` con cada enemigo vivo dentro del radio. */
  forEachInRadius(x: number, z: number, radius: number, fn: (i: number) => void) {
    const r2 = radius * radius;
    const reach = radius + 1.5;
    const x0 = this.cellX(x - reach), x1 = this.cellX(x + reach);
    const z0 = this.cellX(z - reach), z1 = this.cellX(z + reach);
    for (let gx = x0; gx <= x1; gx++)
      for (let gz = z0; gz <= z1; gz++)
        for (let j = this.head[gx * SPAN + gz]; j !== -1; j = this.next[j]) {
          if (this.hp[j] <= 0) continue;
          const dx = this.x[j] - x, dz = this.z[j] - z;
          const r = ENEMIES[TYPES[this.type[j]]].radius;
          if (dx * dx + dz * dz <= r2 + r * r + 2 * radius * r) fn(j);
        }
  }

  /** El vivo más cercano dentro de `maxRange`, o -1. */
  nearest(x: number, z: number, maxRange: number, skip?: Set<number>): number {
    let best = -1, bestD = maxRange * maxRange;
    for (let i = 0; i < this.count; i++) {
      if (this.hp[i] <= 0 || skip?.has(i)) continue;
      const dx = this.x[i] - x, dz = this.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /** Quita a los muertos compactando los arrays. */
  sweep() {
    for (let i = 0; i < this.count; ) {
      if (this.hp[i] > 0) { i++; continue; }
      this.onDeath(i);
      const tipo = TYPES[this.type[i]];
      const modelado = MODELADOS[tipo];
      if (modelado && this.restos.length < MAX_RESTOS) {
        const em = this.elite[i];
        this.restos.push({
          tipo, x: this.x[i], z: this.z[i], heading: this.heading[i],
          escala: modelado.escala * (em >= 0 ? ELITE_ESCALA[em] : 1), t: 0,
        });
      }
      const last = --this.count;
      if (i !== last) this.copy(last, i);
    }
  }

  clear() {
    this.count = 0;
    this.restos = [];
  }

  private copy(from: number, to: number) {
    this.type[to] = this.type[from];
    this.x[to] = this.x[from];
    this.z[to] = this.z[from];
    this.hp[to] = this.hp[from];
    this.maxHp[to] = this.maxHp[from];
    this.heading[to] = this.heading[from];
    this.flash[to] = this.flash[from];
    this.squash[to] = this.squash[from];
    this.slow[to] = this.slow[from];
    this.slowFactor[to] = this.slowFactor[from];
    this.pushX[to] = this.pushX[from];
    this.pushZ[to] = this.pushZ[from];
    this.seed[to] = this.seed[from];
    this.elite[to] = this.elite[from];
  }

  countOf(type: EnemyId) {
    const t = TYPES.indexOf(type);
    let n = 0;
    for (let i = 0; i < this.count; i++) if (this.type[i] === t) n++;
    return n;
  }

  /** Enemigos con modelo articulado: clip según lo que hacen y tinte de élite o golpe. */
  private renderModelados() {
    for (const t of this.tropas.values()) t.empezar();
    for (let i = 0; i < this.count; i++) {
      const type = TYPES[this.type[i]];
      const modelado = MODELADOS[type];
      if (!modelado) continue;
      const tropa = this.tropas.get(type)!;
      const em = this.elite[i];
      const escala = modelado.escala * (em >= 0 ? ELITE_ESCALA[em] : 1);
      this.quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.heading[i]);
      this.pos.set(this.x[i], this.world.heightAt(this.x[i], this.z[i]) + modelado.altura, this.z[i]);
      this.scale.setScalar(escala);
      this.matrix.compose(this.pos, this.quat, this.scale);

      let clip = modelado.mover;
      let t = this.time + this.seed[i];
      if (this.squash[i] > 0) {
        clip = modelado.golpe;
        t = (1 - this.squash[i] / 0.14) * tropa.duracion(clip);
      } else if (Math.hypot(this.x[i] - this.px, this.z[i] - this.pz) < modelado.distCerca) {
        clip = modelado.cerca;
        t = (this.time + this.seed[i]) % tropa.duracion(clip);
      }
      this.color.setRGB(1, 1, 1);
      if (em >= 0) this.color.lerp(this.tint.set(ELITE_TINTE[em]), 0.55);
      if (this.flash[i] > 0) this.color.setRGB(2.4, 2.4, 2.4);
      tropa.poner(this.matrix, clip, t, this.color);
    }
    for (const r of this.restos) {
      const modelado = MODELADOS[r.tipo]!;
      const tropa = this.tropas.get(r.tipo)!;
      const dur = tropa.duracion(modelado.muerte);
      // Lo que flota (la Baliza) cae hasta el suelo mientras dura la caída.
      const f = Math.min(1, r.t / dur);
      const altura = modelado.altura * (1 - f * f);
      this.quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r.heading);
      this.pos.set(r.x, this.world.heightAt(r.x, r.z) + altura, r.z);
      // Al final se encoge y desaparece.
      this.scale.setScalar(r.escala * Math.min(1, Math.max(0, 1 - (r.t - dur) / 0.4)));
      this.matrix.compose(this.pos, this.quat, this.scale);
      tropa.poner(this.matrix, modelado.muerte, r.t, this.color.setRGB(1, 1, 1));
    }
    for (const t of this.tropas.values()) t.terminar();
  }

  render() {
    this.renderModelados();
    const counters = new Map<EnemyId, number>(TYPES.map((t) => [t, 0]));
    for (let i = 0; i < this.count; i++) {
      const type = TYPES[this.type[i]];
      if (MODELADOS[type]) continue;
      const def = ENEMIES[type];
      const n = counters.get(type)!;
      counters.set(type, n + 1);

      const em = this.elite[i];
      const bob = Math.sin(this.time * 3 + this.seed[i]) * (type === 'segador' ? 0.05 : 0.18);
      const lift = esNuevo(type) ? liftDe(type, i, this, this.time) : 0;
      this.quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.heading[i]);
      this.pos.set(this.x[i], this.world.heightAt(this.x[i], this.z[i]) + def.height + bob + lift, this.z[i]);
      // Hurt: aplastamiento rápido (como el clip `hurt` del catálogo).
      const sq = Math.max(0, this.squash[i]) / 0.14;
      // Sembrador: se hincha un instante antes de soltar la salva (telegrafía).
      let hinchar = 0;
      if (type === 'sembrador') {
        const f = (this.time + this.seed[i]) % 4.0;
        if (f > 3.4) hinchar = (f - 3.4) / 0.6;
      }
      const base = SCALE[type] * (em >= 0 ? ELITE_ESCALA[em] : 1);
      this.scale.set(base * (1 + 0.18 * sq + 0.12 * hinchar), base * (1 - 0.22 * sq), base * (1 + 0.18 * sq + 0.12 * hinchar));
      this.matrix.compose(this.pos, this.quat, this.scale);

      const body = this.bodies.get(type)!;
      body.setMatrixAt(n, this.matrix);
      this.color.copy(BASE_COLOR[type]);
      if (em >= 0) this.color.lerp(this.tint.set(ELITE_TINTE[em]), 0.55);
      if (this.flash[i] > 0) this.color.lerp(WHITE, 0.85);
      body.setColorAt(n, this.color);

      this.pos.add(this.offset.copy(EYE_OFFSET[type]).multiplyScalar(SCALE[type]).applyQuaternion(this.quat));
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.eyes.get(type)!.setMatrixAt(n, this.matrix);
    }
    for (const type of TYPES) {
      if (MODELADOS[type]) continue;
      const n = counters.get(type)!;
      const body = this.bodies.get(type)!;
      const eye = this.eyes.get(type)!;
      body.count = eye.count = n;
      body.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      eye.instanceMatrix.needsUpdate = true;
    }
  }
}
