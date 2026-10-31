import * as THREE from 'three';
import type { World } from './world';

const CAPACITY = 1200;

/**
 * La chatarra que sueltan los Recolectores: es a la vez experiencia durante la
 * partida y la moneda del banco de trabajo entre partidas.
 */
export class Pickups {
  private count = 0;
  private x = new Float32Array(CAPACITY);
  private z = new Float32Array(CAPACITY);
  private value = new Float32Array(CAPACITY);
  private pulled = new Uint8Array(CAPACITY);
  private speed = new Float32Array(CAPACITY);
  private ground = new Float32Array(CAPACITY);
  private mesh: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private euler = new THREE.Euler();
  private pos = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private color = new THREE.Color();
  private time = 0;

  constructor(scene: THREE.Scene, private world: World) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshLambertMaterial({ emissive: '#ffffff', emissiveIntensity: 0.35 }),
      CAPACITY,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  drop(x: number, z: number, value: number) {
    if (this.count >= CAPACITY) {
      // Lleno: se suma a una pieza que ya existe en vez de perderla.
      this.value[Math.floor(Math.random() * this.count)] += value;
      return;
    }
    const i = this.count++;
    this.x[i] = x + (Math.random() - 0.5) * 0.6;
    this.z[i] = z + (Math.random() - 0.5) * 0.6;
    this.value[i] = value;
    this.pulled[i] = 0;
    this.speed[i] = 0;
    this.ground[i] = this.world.heightAt(this.x[i], this.z[i]);
  }

  /** Atrae y recoge. Devuelve el valor recogido en este fotograma. */
  update(dt: number, px: number, pz: number, radius: number, collectAll = false): number {
    this.time += dt;
    let collected = 0;
    for (let i = 0; i < this.count; ) {
      const dx = px - this.x[i], dz = pz - this.z[i];
      const d = Math.hypot(dx, dz);
      if (collectAll || d < radius) this.pulled[i] = 1;
      if (this.pulled[i]) {
        this.speed[i] = Math.min(this.speed[i] + dt * 40, 30);
        const step = Math.min(this.speed[i] * dt, d);
        this.x[i] += (dx / (d || 1)) * step;
        this.z[i] += (dz / (d || 1)) * step;
        this.ground[i] = this.world.heightAt(this.x[i], this.z[i]);
      }
      if (d < 0.6) {
        collected += this.value[i];
        const last = --this.count;
        this.x[i] = this.x[last];
        this.z[i] = this.z[last];
        this.value[i] = this.value[last];
        this.pulled[i] = this.pulled[last];
        this.speed[i] = this.speed[last];
        this.ground[i] = this.ground[last];
        continue;
      }
      i++;
    }
    this.render();
    return collected;
  }

  private render() {
    for (let i = 0; i < this.count; i++) {
      const big = this.value[i] >= 5;
      this.euler.set(0, this.time * 2 + i, 0);
      this.quat.setFromEuler(this.euler);
      this.pos.set(this.x[i], this.ground[i] + 0.35 + Math.sin(this.time * 4 + i) * 0.08, this.z[i]);
      const s = big ? 1.7 : 1;
      this.scale.set(s, s * 1.3, s);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, this.color.set(big ? '#ffcf4a' : '#7fe7ff'));
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.mesh.count = 0;
  }
}

/** Una reliquia en el suelo: brilla y lanza un haz para que se vea de lejos. */
export class RelicDrop {
  readonly group = new THREE.Group();
  private time = 0;

  constructor(scene: THREE.Scene, readonly relicId: string, x: number, y: number, z: number) {
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshLambertMaterial({ color: '#ffe9a8', emissive: '#ffb020', emissiveIntensity: 0.8 }),
    );
    core.position.y = 0.9;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.6, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffcf4a', transparent: true, opacity: 0.25, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    beam.position.y = 7;
    this.group.add(core, beam);
    this.group.position.set(x, y, z);
    scene.add(this.group);
  }

  update(dt: number) {
    this.time += dt;
    const core = this.group.children[0];
    core.rotation.set(this.time * 0.8, this.time * 1.3, 0);
    core.position.y = 0.9 + Math.sin(this.time * 2.5) * 0.15;
  }
}
