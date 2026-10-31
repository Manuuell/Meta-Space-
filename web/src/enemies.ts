import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENEMIES, EnemyId, RUN } from './data';
import { World } from './world';

const TYPES: EnemyId[] = ['recolector', 'baliza', 'segador'];
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
  }
}

const BASE_COLOR: Record<EnemyId, THREE.Color> = {
  // Claros a propósito: sobre el suelo rojo oscuro, el metal oscuro desaparece.
  recolector: new THREE.Color('#a8a4ac'),
  baliza: new THREE.Color('#d8cf8a'),
  segador: new THREE.Color('#c07a3a'),
};
const EYE_COLOR: Record<EnemyId, string> = {
  recolector: '#ff3b1f',
  baliza: '#ffd23a',
  segador: '#ff3b1f',
};
const EYE_OFFSET: Record<EnemyId, THREE.Vector3> = {
  recolector: new THREE.Vector3(0, -0.05, 0.45),
  baliza: new THREE.Vector3(0, 1.25, 0),
  segador: new THREE.Vector3(0, 0.15, 1.02),
};
const WHITE = new THREE.Color('#ffffff');
const SCALE: Record<EnemyId, number> = { recolector: 1.3, baliza: 1.25, segador: 1.35 };

export class Enemies {
  count = 0;
  readonly type = new Uint8Array(CAPACITY);
  readonly x = new Float32Array(CAPACITY);
  readonly z = new Float32Array(CAPACITY);
  readonly hp = new Float32Array(CAPACITY);
  readonly maxHp = new Float32Array(CAPACITY);
  readonly heading = new Float32Array(CAPACITY);
  readonly flash = new Float32Array(CAPACITY);
  readonly slow = new Float32Array(CAPACITY);
  readonly pushX = new Float32Array(CAPACITY);
  readonly pushZ = new Float32Array(CAPACITY);
  readonly seed = new Float32Array(CAPACITY);

  private head = new Int32Array(SPAN * SPAN);
  private next = new Int32Array(CAPACITY);

  private bodies = new Map<EnemyId, THREE.InstancedMesh>();
  private eyes = new Map<EnemyId, THREE.InstancedMesh>();
  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private pos = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private scale = new THREE.Vector3(1, 1, 1);
  private color = new THREE.Color();
  private tmp = { x: 0, z: 0 };
  private time = 0;

  /** Se llama justo antes de quitar un enemigo muerto. */
  onDeath: (i: number) => void = () => {};

  constructor(scene: THREE.Scene, private world: World) {
    for (const type of TYPES) {
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

  spawn(type: EnemyId, x: number, z: number, hpScale: number) {
    if (this.count >= CAPACITY) return;
    const i = this.count++;
    const def = ENEMIES[type];
    this.type[i] = TYPES.indexOf(type);
    this.x[i] = x;
    this.z[i] = z;
    this.hp[i] = this.maxHp[i] = def.hp * hpScale;
    this.heading[i] = 0;
    this.flash[i] = 0;
    this.slow[i] = 0;
    this.pushX[i] = this.pushZ[i] = 0;
    this.seed[i] = Math.random() * 100;
  }

  defOf(i: number) {
    return ENEMIES[TYPES[this.type[i]]];
  }

  /** Aplica daño. La muerte se procesa al final del fotograma, en `sweep`. */
  hit(i: number, amount: number, fromX: number, fromZ: number, knockback = 0.25) {
    if (this.hp[i] <= 0) return false;
    this.hp[i] -= amount;
    this.flash[i] = 0.12;
    if (knockback > 0 && TYPES[this.type[i]] !== 'segador') {
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
      } else {
        vx = (dx / dist) * def.speed;
        vz = (dz / dist) * def.speed;
      }

      if (this.slow[i] > 0) {
        this.slow[i] -= dt;
        vx *= 0.5;
        vz *= 0.5;
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

      dx = px - this.x[i];
      dz = pz - this.z[i];
      if (def.damage > 0 && dx * dx + dz * dz < (def.radius + playerRadius) ** 2) contact += def.damage * dt;
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
      const last = --this.count;
      if (i !== last) this.copy(last, i);
    }
  }

  clear() {
    this.count = 0;
  }

  private copy(from: number, to: number) {
    this.type[to] = this.type[from];
    this.x[to] = this.x[from];
    this.z[to] = this.z[from];
    this.hp[to] = this.hp[from];
    this.maxHp[to] = this.maxHp[from];
    this.heading[to] = this.heading[from];
    this.flash[to] = this.flash[from];
    this.slow[to] = this.slow[from];
    this.pushX[to] = this.pushX[from];
    this.pushZ[to] = this.pushZ[from];
    this.seed[to] = this.seed[from];
  }

  countOf(type: EnemyId) {
    const t = TYPES.indexOf(type);
    let n = 0;
    for (let i = 0; i < this.count; i++) if (this.type[i] === t) n++;
    return n;
  }

  render() {
    const counters = new Map<EnemyId, number>(TYPES.map((t) => [t, 0]));
    for (let i = 0; i < this.count; i++) {
      const type = TYPES[this.type[i]];
      const def = ENEMIES[type];
      const n = counters.get(type)!;
      counters.set(type, n + 1);

      const bob = Math.sin(this.time * 3 + this.seed[i]) * (type === 'segador' ? 0.05 : 0.18);
      this.quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.heading[i]);
      this.pos.set(this.x[i], this.world.heightAt(this.x[i], this.z[i]) + def.height + bob, this.z[i]);
      this.scale.setScalar(SCALE[type]);
      this.matrix.compose(this.pos, this.quat, this.scale);

      const body = this.bodies.get(type)!;
      body.setMatrixAt(n, this.matrix);
      this.color.copy(BASE_COLOR[type]);
      if (this.flash[i] > 0) this.color.lerp(WHITE, 0.85);
      body.setColorAt(n, this.color);

      this.pos.add(this.offset.copy(EYE_OFFSET[type]).multiplyScalar(SCALE[type]).applyQuaternion(this.quat));
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.eyes.get(type)!.setMatrixAt(n, this.matrix);
    }
    for (const type of TYPES) {
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
