import * as THREE from 'three';
import { WEAPONS, WeaponId } from './data';
import { Enemies } from './enemies';
import { World } from './world';
import { sfx } from './audio';

const MAX_SHOTS = 200;
const SHOT_SPEED = 24;

export interface Modifiers {
  cooldown: number; // multiplicador, menos es más rápido
  area: number;     // multiplicador de radio y alcance
}

/**
 * Las cuatro herramientas. Cada una lleva su nivel, su recarga y la cuenta del
 * daño que ha hecho, que es lo que luego enseña la pantalla de resultados.
 */
export class Weapons {
  readonly levels = new Map<WeaponId, number>();
  readonly damageDealt: Record<WeaponId, number> = { cortador: 0, pulso: 0, dron: 0, interferencia: 0 };
  private timers = new Map<WeaponId, number>();

  // Cortador: proyectiles en arrays planos y un solo InstancedMesh.
  private shotCount = 0;
  private shotX = new Float32Array(MAX_SHOTS);
  private shotZ = new Float32Array(MAX_SHOTS);
  private shotVX = new Float32Array(MAX_SHOTS);
  private shotVZ = new Float32Array(MAX_SHOTS);
  private shotLife = new Float32Array(MAX_SHOTS);
  private shotDamage = new Float32Array(MAX_SHOTS);
  private shotMesh: THREE.InstancedMesh;

  private pulses: { mesh: THREE.Mesh; age: number; radius: number }[] = [];
  private pulseGeometry = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);

  private drones: THREE.Group[] = [];
  private droneAngle = 0;

  private aura: THREE.Mesh;

  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private vec = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private targets = new Set<number>();

  constructor(private scene: THREE.Scene, private enemies: Enemies, private world: World) {
    this.shotMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.9),
      new THREE.MeshBasicMaterial({ color: WEAPONS.cortador.color }),
      MAX_SHOTS,
    );
    this.shotMesh.count = 0;
    this.shotMesh.frustumCulled = false;
    scene.add(this.shotMesh);

    this.aura = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: WEAPONS.interferencia.color, transparent: true, opacity: 0.18, depthWrite: false,
      }),
    );
    this.aura.visible = false;
    scene.add(this.aura);
  }

  level(id: WeaponId) {
    return this.levels.get(id) ?? 0;
  }

  /** Sube de nivel (o añade) un arma. */
  upgrade(id: WeaponId) {
    const next = Math.min(this.level(id) + 1, WEAPONS[id].levels.length);
    this.levels.set(id, next);
    if (!this.timers.has(id)) this.timers.set(id, 0.3);
    if (id === 'dron') this.syncDrones();
  }

  private stats(id: WeaponId) {
    return WEAPONS[id].levels[this.level(id) - 1];
  }

  private deal(id: WeaponId, i: number, amount: number, fromX: number, fromZ: number, knockback = 0.25) {
    const before = Math.max(this.enemies.hp[i], 0);
    this.enemies.hit(i, amount, fromX, fromZ, knockback);
    this.damageDealt[id] += Math.min(amount, before);
  }

  update(dt: number, px: number, pz: number, mods: Modifiers) {
    for (const [id] of this.levels) {
      const s = this.stats(id);
      let t = (this.timers.get(id) ?? 0) - dt;
      if (t <= 0) {
        this.fire(id, px, pz, mods);
        t += s.cooldown * mods.cooldown;
        if (t < 0) t = 0;
      }
      this.timers.set(id, t);
    }
    this.updateShots(dt);
    this.updatePulses(dt);
    this.updateDrones(dt, px, pz, mods);
    this.updateAura(px, pz, mods);
  }

  private fire(id: WeaponId, px: number, pz: number, mods: Modifiers) {
    const s = this.stats(id);
    switch (id) {
      case 'cortador': {
        this.targets.clear();
        let fired = 0;
        for (let n = 0; n < s.count; n++) {
          const target = this.enemies.nearest(px, pz, s.area * mods.area, this.targets);
          if (target < 0) break;
          this.targets.add(target);
          this.spawnShot(px, pz, this.enemies.x[target], this.enemies.z[target], s.damage, s.area * mods.area);
          fired++;
        }
        if (fired) sfx('shot');
        break;
      }
      case 'pulso': {
        const radius = s.area * mods.area;
        this.enemies.forEachInRadius(px, pz, radius, (i) => this.deal('pulso', i, s.damage, px, pz, 0.9));
        const mesh = new THREE.Mesh(
          this.pulseGeometry,
          new THREE.MeshBasicMaterial({
            color: WEAPONS.pulso.color, transparent: true, opacity: 0.9, depthWrite: false,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          }),
        );
        mesh.position.set(px, this.world.heightAt(px, pz) + 0.25, pz);
        this.scene.add(mesh);
        this.pulses.push({ mesh, age: 0, radius });
        sfx('pulse');
        break;
      }
      case 'dron': {
        // Cada golpe de dron es un tic: daña a lo que tenga pegado.
        for (const drone of this.drones) {
          const dx = drone.position.x, dz = drone.position.z;
          this.enemies.forEachInRadius(dx, dz, 0.9, (i) => this.deal('dron', i, s.damage, dx, dz, 0.35));
        }
        break;
      }
      case 'interferencia': {
        const radius = s.area * mods.area;
        this.enemies.forEachInRadius(px, pz, radius, (i) => {
          this.deal('interferencia', i, s.damage, px, pz, 0);
          this.enemies.slow[i] = 0.6;
        });
        break;
      }
    }
  }

  private spawnShot(px: number, pz: number, tx: number, tz: number, damage: number, range: number) {
    if (this.shotCount >= MAX_SHOTS) return;
    const i = this.shotCount++;
    const dx = tx - px, dz = tz - pz;
    const d = Math.hypot(dx, dz) || 1;
    this.shotX[i] = px;
    this.shotZ[i] = pz;
    this.shotVX[i] = (dx / d) * SHOT_SPEED;
    this.shotVZ[i] = (dz / d) * SHOT_SPEED;
    this.shotLife[i] = range / SHOT_SPEED + 0.15;
    this.shotDamage[i] = damage;
  }

  private updateShots(dt: number) {
    for (let i = 0; i < this.shotCount; ) {
      this.shotX[i] += this.shotVX[i] * dt;
      this.shotZ[i] += this.shotVZ[i] * dt;
      this.shotLife[i] -= dt;

      let hit = -1;
      this.enemies.forEachInRadius(this.shotX[i], this.shotZ[i], 0.25, (j) => {
        if (hit < 0) hit = j;
      });
      if (hit >= 0) {
        this.deal('cortador', hit, this.shotDamage[i], this.shotX[i] - this.shotVX[i] * 0.05, this.shotZ[i] - this.shotVZ[i] * 0.05);
        sfx('hit');
      }

      if (hit >= 0 || this.shotLife[i] <= 0) {
        const last = --this.shotCount;
        this.shotX[i] = this.shotX[last];
        this.shotZ[i] = this.shotZ[last];
        this.shotVX[i] = this.shotVX[last];
        this.shotVZ[i] = this.shotVZ[last];
        this.shotLife[i] = this.shotLife[last];
        this.shotDamage[i] = this.shotDamage[last];
        continue;
      }
      i++;
    }

    for (let i = 0; i < this.shotCount; i++) {
      this.quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(this.shotVX[i], this.shotVZ[i]));
      this.vec.set(this.shotX[i], this.world.heightAt(this.shotX[i], this.shotZ[i]) + 0.9, this.shotZ[i]);
      this.matrix.compose(this.vec, this.quat, this.one);
      this.shotMesh.setMatrixAt(i, this.matrix);
    }
    this.shotMesh.count = this.shotCount;
    this.shotMesh.instanceMatrix.needsUpdate = true;
  }

  private updatePulses(dt: number) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age += dt;
      const t = p.age / 0.35;
      const r = p.radius * Math.min(1, 0.2 + t);
      p.mesh.scale.set(r, 1, r);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.pulses.splice(i, 1);
      }
    }
  }

  private syncDrones() {
    const want = this.stats('dron').count;
    while (this.drones.length < want) {
      const drone = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.2, 0.45),
        new THREE.MeshLambertMaterial({ color: '#d8d2c4', emissive: WEAPONS.dron.color, emissiveIntensity: 0.35 }),
      );
      const rotor = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.04, 4, 12).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: WEAPONS.dron.color }),
      );
      rotor.position.y = 0.16;
      body.castShadow = true;
      drone.add(body, rotor);
      this.scene.add(drone);
      this.drones.push(drone);
    }
  }

  private updateDrones(dt: number, px: number, pz: number, mods: Modifiers) {
    if (!this.drones.length) return;
    const s = this.stats('dron');
    this.droneAngle += dt * 2.8;
    const radius = s.area * mods.area;
    this.drones.forEach((drone, n) => {
      const a = this.droneAngle + (n / this.drones.length) * Math.PI * 2;
      const dx = px + Math.cos(a) * radius, dz = pz + Math.sin(a) * radius;
      drone.position.set(dx, this.world.heightAt(dx, dz) + 1.1 + Math.sin(a * 2) * 0.15, dz);
      drone.rotation.y = -a;
    });
  }

  private updateAura(px: number, pz: number, mods: Modifiers) {
    if (!this.level('interferencia')) return;
    const r = this.stats('interferencia').area * mods.area;
    this.aura.visible = true;
    this.aura.position.set(px, this.world.heightAt(px, pz) + 0.2, pz);
    const wobble = 1 + Math.sin(performance.now() / 120) * 0.03;
    this.aura.scale.set(r * wobble, 1, r * wobble);
  }

  dispose() {
    for (const d of this.drones) this.scene.remove(d);
    for (const p of this.pulses) this.scene.remove(p.mesh);
    this.scene.remove(this.shotMesh, this.aura);
  }
}
