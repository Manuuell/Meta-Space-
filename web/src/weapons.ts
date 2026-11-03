import * as THREE from 'three';
import { WEAPONS, WeaponId, factorNivel, type WeaponLevel } from './data';
import { FRAGUA } from './contenido/mapa';
import { Enemies } from './enemies';
import { World } from './world';
import { sfx } from './audio';
import type { ObjetivoCombate } from './contenido-juego';
import { crearInspector } from './modelos/inspector';
import { ArmasPersonaje } from './armas-personaje';

const MAX_SHOTS = 200;
const SHOT_SPEED = 24;
/** Segundos entre el aviso en el suelo y la caída de la lanza solar. */
const AVISO_LANZA = 0.55;
/** Hasta dónde busca grupos la lanza, y el mortero sus blancos (m). */
const ALCANCE_LANZA = 18;
const ALCANCE_MORTERO = 15;
/** Segundos de vuelo de una bomba del mortero. */
const VUELO_MORTERO = 0.7;
/** El charco del mortero quema cada tanto con esta parte del daño. */
const TIC_CHARCO = 0.4;
const DANO_CHARCO = 0.25;
/** Hasta dónde busca el arco su primer eslabón (m). */
const ALCANCE_ARCO = 12;

export interface Modifiers {
  cooldown: number; // multiplicador, menos es más rápido
  area: number;     // multiplicador de radio y alcance
}

/** Lo que las herramientas le cuentan al juego: números de daño y sacudidas. */
export interface EventosArmas {
  dano?: (x: number, z: number, cantidad: number, critico: boolean) => void;
  sacudida?: () => void;
}

interface Pulso {
  mesh: THREE.Mesh;
  destello: THREE.Mesh;
  age: number;
  radius: number;
  delay: number;
  /** Eco del pulso: daño que suelta al empezar (0 si ya lo hizo). */
  x: number;
  z: number;
  dano: number;
}

interface Lanza {
  x: number;
  z: number;
  radio: number;
  dano: number;
  t: number;
  aviso: THREE.Mesh;
  relleno: THREE.Mesh;
  rayo: THREE.Mesh | null;
}

interface Bomba {
  x0: number; z0: number; x1: number; z1: number;
  t: number;
  dano: number;
  radio: number;
  charco: number;
  mesh: THREE.Mesh;
}

interface Charco {
  x: number;
  z: number;
  radio: number;
  dano: number;
  hasta: number;
  tic: number;
  edad: number;
  mesh: THREE.Mesh;
}

interface Explosion {
  bola: THREE.Mesh;
  onda: THREE.Mesh;
  edad: number;
  radio: number;
}

/** Un dron de mantenimiento: su modelo, su mezclador y sus dos clips. */
interface Inspector {
  raiz: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  volar: THREE.AnimationAction;
  golpe: THREE.AnimationAction;
}

interface Rayo {
  grupo: THREE.Group;
  mats: THREE.MeshBasicMaterial[];
  edad: number;
}

/**
 * Las herramientas. Cada una lleva su nivel, su recarga y la cuenta del daño
 * que ha hecho, que es lo que luego enseña la pantalla de resultados.
 */
export class Weapons {
  readonly levels = new Map<WeaponId, number>();
  readonly damageDealt: Record<WeaponId, number> = {
    cortador: 0, pulso: 0, dron: 0, interferencia: 0, lanza: 0, arco: 0, mortero: 0,
    torreta: 0, martillo: 0, sello: 0, bumeran: 0, semillas: 0,
  };
  /** Multiplicador de daño del héroe personalizado y de las bendiciones. */
  damageMul = 1;
  /** Probabilidad de crítico (0..1) y cuánto multiplica. */
  critico = 0.05;
  multCritico = 2;
  private timers = new Map<WeaponId, number>();
  /** Jefes y torres de este fotograma: se piden una vez, no por proyectil. */
  private extras: ObjetivoCombate[] = [];
  /** Rumbo del personaje: lo usan la llave y el disco. */
  rumbo = Math.PI;
  /** Forjadas en la Fragua del Deshielo: su nivel máximo con la mejora de la forja. */
  private forjadas = new Map<WeaponId, WeaponLevel>();
  /** Segundos que le quedan a la Sobrecarga de red de Mara. */
  private sobrecarga = 0;
  /** Las cinco herramientas exclusivas de los operadores. */
  private personaje: ArmasPersonaje;

  // Cortador: proyectiles en arrays planos y dos InstancedMesh (halo + núcleo).
  private shotCount = 0;
  private shotX = new Float32Array(MAX_SHOTS);
  private shotZ = new Float32Array(MAX_SHOTS);
  private shotVX = new Float32Array(MAX_SHOTS);
  private shotVZ = new Float32Array(MAX_SHOTS);
  private shotLife = new Float32Array(MAX_SHOTS);
  private shotDamage = new Float32Array(MAX_SHOTS);
  private shotPierce = new Int8Array(MAX_SHOTS);
  private shotLastHit = new Int32Array(MAX_SHOTS);
  /** Último jefe o torre que atravesó: son grandes y el disparo pasa varios fotogramas dentro. */
  private shotLastExtra: (string | null)[] = new Array(MAX_SHOTS).fill(null);
  private shotSize = new Float32Array(MAX_SHOTS);
  private shotGlow: THREE.InstancedMesh;
  private shotCore: THREE.InstancedMesh;

  private pulses: Pulso[] = [];
  private pulseGeometry = new THREE.RingGeometry(0.78, 1, 48).rotateX(-Math.PI / 2);
  private discoGeometry = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);

  /** Destellos de impacto: esferas aditivas que se expanden y se apagan. */
  private impacts: { mesh: THREE.Mesh; age: number }[] = [];
  private impactGeometry = new THREE.SphereGeometry(0.22, 8, 6);

  private lanzas: Lanza[] = [];
  private rayoGeometry = new THREE.CylinderGeometry(0.55, 0.75, 34, 18, 1, true).translate(0, 17, 0);
  private bombas: Bomba[] = [];
  private bombaGeometry = new THREE.IcosahedronGeometry(0.32, 0);
  private charcos: Charco[] = [];
  private explosiones: Explosion[] = [];
  private bolaGeometry = new THREE.SphereGeometry(1, 16, 12);
  private rayos: Rayo[] = [];
  private segmentoGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);

  private drones: Inspector[] = [];
  private droneAngle = 0;

  private aura: THREE.Mesh;

  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private vec = new THREE.Vector3();
  private scale = new THREE.Vector3(1, 1, 1);
  private targets = new Set<number>();

  constructor(
    private scene: THREE.Scene,
    private enemies: Enemies,
    private world: World,
    private objetivosExtra: () => ObjetivoCombate[] = () => [],
    private eventos: EventosArmas = {},
  ) {
    this.shotGlow = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.2, 0.2, 1.1),
      new THREE.MeshBasicMaterial({
        color: WEAPONS.cortador.color, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      MAX_SHOTS,
    );
    this.shotGlow.count = 0;
    this.shotGlow.frustumCulled = false;
    scene.add(this.shotGlow);
    this.shotCore = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, 0.08, 1.25),
      new THREE.MeshBasicMaterial({ color: '#fff3d6' }),
      MAX_SHOTS,
    );
    this.shotCore.count = 0;
    this.shotCore.frustumCulled = false;
    scene.add(this.shotCore);

    this.aura = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: WEAPONS.interferencia.color, transparent: true, opacity: 0.18, depthWrite: false,
      }),
    );
    this.aura.visible = false;
    scene.add(this.aura);

    this.personaje = new ArmasPersonaje(scene, enemies, world, {
      enemigo: (id, i, dano, x, z, empuje) => this.deal(id, i, dano, x, z, empuje),
      extra: (id, objetivo, dano) => this.dealExtra(id, objetivo, dano),
      extras: () => this.extras,
      sacudida: () => this.eventos.sacudida?.(),
    });
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

  /** Fracción de recarga que le queda a cada herramienta (1 = recién disparada). */
  recarga(id: WeaponId, mods: Modifiers) {
    const s = this.stats(id);
    if (!s) return 0;
    return Math.max(0, Math.min(1, (this.timers.get(id) ?? 0) / (s.cooldown * mods.cooldown)));
  }

  private stats(id: WeaponId) {
    return this.forjadas.get(id) ?? WEAPONS[id].levels[this.level(id) - 1];
  }

  forjada(id: WeaponId) {
    return this.forjadas.has(id);
  }

  /** La Fragua del Deshielo: `fundida` desaparece y `base` sale forjada. */
  forjar(base: WeaponId, fundida: WeaponId) {
    this.desmontar(fundida);
    const s = WEAPONS[base].levels[this.level(base) - 1];
    this.forjadas.set(base, { ...s, damage: s.damage * FRAGUA.dano, count: s.count + FRAGUA.carga, cooldown: s.cooldown * FRAGUA.recarga });
    if (base === 'dron') this.syncDrones();
  }

  /** Quita una herramienta del todo (Iris la desmonta o se funde en la fragua). */
  desmontar(id: WeaponId) {
    this.levels.delete(id);
    this.timers.delete(id);
    this.forjadas.delete(id);
    if (id === 'dron') {
      for (const d of this.drones) this.scene.remove(d.raiz);
      this.drones = [];
    }
    if (id === 'interferencia') this.aura.visible = false;
  }

  private tirarCritico(): number {
    return Math.random() < this.critico ? this.multCritico : 1;
  }

  private deal(id: WeaponId, i: number, amount: number, fromX: number, fromZ: number, knockback = 0.25) {
    const before = Math.max(this.enemies.hp[i], 0);
    if (before <= 0) return;
    const crit = this.tirarCritico();
    const scaled = amount * this.damageMul * crit;
    this.enemies.hit(i, scaled, fromX, fromZ, knockback * (crit > 1 ? 1.6 : 1));
    this.damageDealt[id] += Math.min(scaled, before);
    this.eventos.dano?.(this.enemies.x[i], this.enemies.z[i], scaled, crit > 1);
    if (crit > 1) sfx('critico');
  }

  private dealExtra(id: WeaponId, objetivo: ObjetivoCombate, amount: number) {
    const crit = this.tirarCritico();
    const causado = objetivo.golpear(amount * this.damageMul * crit);
    this.damageDealt[id] += causado;
    if (causado > 0) this.eventos.dano?.(objetivo.x, objetivo.z, causado, crit > 1);
  }

  /** Daña a todo lo que hay en un círculo (horda, jefes y torres). */
  private area(id: WeaponId, x: number, z: number, radio: number, dano: number, empuje: number) {
    this.enemies.forEachInRadius(x, z, radio, (i) => this.deal(id, i, dano, x, z, empuje));
    for (const extra of this.extras) {
      if (extra.activo && Math.hypot(extra.x - x, extra.z - z) <= radio + extra.radio) this.dealExtra(id, extra, dano);
    }
  }

  update(dt: number, px: number, pz: number, mods: Modifiers) {
    this.extras = this.objetivosExtra();
    this.sobrecarga = Math.max(0, this.sobrecarga - dt);
    for (const [id] of this.levels) {
      const s = this.stats(id);
      let t = (this.timers.get(id) ?? 0) - dt * (this.sobrecarga > 0 ? 1.4 : 1);
      if (t <= 0) {
        this.fire(id, px, pz, mods);
        t += s.cooldown * mods.cooldown;
        if (t < 0) t = 0;
      }
      this.timers.set(id, t);
    }
    this.updateShots(dt);
    this.updatePulses(dt);
    this.updateImpacts(dt);
    this.updateLanzas(dt);
    this.updateBombas(dt);
    this.updateCharcos(dt);
    this.updateExplosiones(dt);
    this.updateRayos(dt);
    this.updateDrones(dt, px, pz, mods);
    this.updateAura(px, pz, mods);
    const torreta = this.level('torreta') ? this.stats('torreta') : null;
    const danoTorreta = torreta ? torreta.damage * factorNivel(this.level('torreta')) : 0;
    this.personaje.update(dt, px, pz, mods, this.sobrecarga > 0, torreta, danoTorreta);
  }

  private fire(id: WeaponId, px: number, pz: number, mods: Modifiers) {
    const s = this.stats(id);
    // Daño por golpe: el de la tabla, más un 20 % por cada nivel de la herramienta.
    const d = s.damage * factorNivel(this.level(id));
    switch (id) {
      case 'cortador': {
        this.targets.clear();
        let fired = 0;
        for (let n = 0; n < s.count; n++) {
          const target = this.enemies.nearest(px, pz, s.area * mods.area, this.targets);
          let tx = target >= 0 ? this.enemies.x[target] : 0;
          let tz = target >= 0 ? this.enemies.z[target] : 0;
          let mejor = target >= 0 ? Math.hypot(tx - px, tz - pz) : s.area * mods.area + 1;
          for (const extra of this.extras) {
            if (!extra.activo) continue;
            const d = Math.hypot(extra.x - px, extra.z - pz);
            if (d <= s.area * mods.area && d < mejor) {
              mejor = d;
              tx = extra.x;
              tz = extra.z;
            }
          }
          if (mejor > s.area * mods.area) break;
          if (target >= 0 && tx === this.enemies.x[target] && tz === this.enemies.z[target]) this.targets.add(target);
          // El grosor del rayo crece con el nivel: se ve la subida.
          const size = 0.85 + this.level('cortador') * 0.18;
          this.spawnShot(px, pz, tx, tz, d, s.area * mods.area, s.pierce ?? 0, size);
          fired++;
        }
        if (fired) sfx('shot');
        break;
      }
      case 'pulso': {
        const radius = s.area * mods.area;
        this.area('pulso', px, pz, radius, d, 0.9);
        this.spawnPulse(px, pz, radius, 0, 0, WEAPONS.pulso.color);
        // Desde el nivel 5, un eco remata con el 40 % lo que queda cerca.
        if (this.level('pulso') >= 5) this.spawnPulse(px, pz, radius * 0.7, 0.15, d * 0.4, '#b8f4ff');
        sfx('pulse');
        break;
      }
      case 'dron': {
        // Cada golpe de dron es un tic: daña a lo que tenga pegado.
        for (const drone of this.drones) {
          const dx = drone.raiz.position.x, dz = drone.raiz.position.z;
          let golpes = 0;
          this.enemies.forEachInRadius(dx, dz, 0.9, (i) => { this.deal('dron', i, d, dx, dz, 0.35); golpes++; });
          for (const extra of this.extras) {
            if (extra.activo && Math.hypot(extra.x - dx, extra.z - dz) <= 0.9 + extra.radio) {
              this.dealExtra('dron', extra, d);
              golpes++;
            }
          }
          // Si ha tocado algo, embiste.
          if (golpes) {
            drone.volar.fadeOut(0.05);
            drone.golpe.reset().fadeIn(0.05).play();
          }
        }
        break;
      }
      case 'interferencia': {
        const radius = s.area * mods.area;
        this.enemies.forEachInRadius(px, pz, radius, (i) => {
          this.deal('interferencia', i, d, px, pz, 0);
          this.enemies.slow[i] = s.slowTime ?? 0.6;
          this.enemies.slowFactor[i] = s.slowFactor ?? 0.5;
        });
        for (const extra of this.extras) {
          if (extra.activo && Math.hypot(extra.x - px, extra.z - pz) <= radius + extra.radio) {
            this.dealExtra('interferencia', extra, d);
          }
        }
        break;
      }
      case 'lanza': {
        const radio = s.area * mods.area;
        const blancos = this.gruposDensos(px, pz, ALCANCE_LANZA * mods.area, radio, s.count);
        for (const b of blancos) this.spawnLanza(b.x, b.z, radio, d);
        break;
      }
      case 'arco': {
        let lanzados = 0;
        const inicios = new Set<number>();
        for (let n = 0; n < s.count; n++) {
          const inicio = this.enemies.nearest(px, pz, ALCANCE_ARCO * mods.area, inicios);
          if (inicio < 0) {
            // Sin horda a tiro, el arco busca al jefe o a la torre más cercana.
            const extra = this.extras.find((e) => e.activo && Math.hypot(e.x - px, e.z - pz) <= ALCANCE_ARCO * mods.area + e.radio);
            if (extra && n === 0) {
              this.dealExtra('arco', extra, d * 2);
              this.spawnRayo([[px, pz], [extra.x, extra.z]]);
              lanzados++;
            }
            break;
          }
          inicios.add(inicio);
          this.cadena(inicio, px, pz, d, s.saltos ?? 3, s.area * mods.area, s.slowFactor ?? 0.25, s.slowTime ?? 0.35);
          lanzados++;
        }
        if (lanzados) sfx('zap');
        break;
      }
      case 'mortero': {
        const blancos = this.blancosMortero(px, pz, ALCANCE_MORTERO * mods.area, s.count);
        for (const b of blancos) this.spawnBomba(px, pz, b.x, b.z, d, s.area * mods.area, s.charco ?? 1.5);
        if (blancos.length) sfx('shot');
        break;
      }
      case 'torreta':
      case 'martillo':
      case 'sello':
      case 'bumeran':
      case 'semillas':
        this.personaje.disparar(id, s, d, px, pz, mods, this.rumbo);
        break;
    }
  }

  // ------------------------------------------------------------- Cortador

  private spawnShot(px: number, pz: number, tx: number, tz: number, damage: number, range: number, pierce: number, size: number) {
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
    this.shotPierce[i] = pierce;
    this.shotLastHit[i] = -1;
    this.shotLastExtra[i] = null;
    this.shotSize[i] = size;
  }

  /** Quita el proyectil i intercambiándolo con el último. */
  private killShot(i: number) {
    const last = --this.shotCount;
    this.shotX[i] = this.shotX[last];
    this.shotZ[i] = this.shotZ[last];
    this.shotVX[i] = this.shotVX[last];
    this.shotVZ[i] = this.shotVZ[last];
    this.shotLife[i] = this.shotLife[last];
    this.shotDamage[i] = this.shotDamage[last];
    this.shotPierce[i] = this.shotPierce[last];
    this.shotLastHit[i] = this.shotLastHit[last];
    this.shotLastExtra[i] = this.shotLastExtra[last];
    this.shotSize[i] = this.shotSize[last];
  }

  /** Destello donde impacta el rayo: se ve cada golpe. */
  // ------------------------------------------------------------- Operadores

  /** La habilidad de Mara: acelera los relojes y planta una torreta extra. */
  activarSobrecarga(segundos: number, x: number, z: number) {
    this.sobrecarga = Math.max(this.sobrecarga, segundos);
    if (this.level('torreta')) this.personaje.torretaExtra(x, z, this.stats('torreta'));
  }

  /** Dónde están las torretas de Mara (los enlaces de la Sobrecarga de red). */
  posicionesTorretas() {
    return this.personaje.posicionesTorretas();
  }

  /** Efectos compartidos con las habilidades (anillos, rayos, chispas…). */
  get efectos() {
    return this.personaje.efectos;
  }

  /** Daño de habilidad: no es de ninguna herramienta, pero cuenta el multiplicador y los críticos. */
  danoHabilidad(x: number, z: number, radio: number, dano: number, empuje = .5, filtro?: (i: number) => boolean) {
    this.enemies.forEachInRadius(x, z, radio, (i) => {
      if (filtro && !filtro(i)) return;
      const antes = Math.max(0, this.enemies.hp[i]);
      const crit = this.tirarCritico();
      const total = dano * this.damageMul * crit;
      this.enemies.hit(i, total, x, z, empuje);
      this.eventos.dano?.(this.enemies.x[i], this.enemies.z[i], Math.min(antes, total), crit > 1);
    });
    for (const extra of this.objetivosExtra()) {
      if (extra.activo && Math.hypot(extra.x - x, extra.z - z) <= radio + extra.radio) {
        const causado = extra.golpear(dano * this.damageMul);
        if (causado > 0) this.eventos.dano?.(extra.x, extra.z, causado, false);
      }
    }
  }

  private spawnImpact(x: number, z: number, size: number, color = '#ffd9a0') {
    if (this.impacts.length > 40) return;
    const mesh = new THREE.Mesh(
      this.impactGeometry,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    mesh.position.set(x, this.world.heightAt(x, z) + 0.9, z);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);
    this.impacts.push({ mesh, age: 0 });
  }

  private updateShots(dt: number) {
    for (let i = 0; i < this.shotCount;) {
      this.shotX[i] += this.shotVX[i] * dt;
      this.shotZ[i] += this.shotVZ[i] * dt;
      this.shotLife[i] -= dt;

      let hit = -1;
      let hitExtra: ObjetivoCombate | null = null;
      this.enemies.forEachInRadius(this.shotX[i], this.shotZ[i], 0.3, (j) => {
        if (hit < 0 && j !== this.shotLastHit[i]) hit = j;
      });
      if (hit >= 0) {
        this.deal('cortador', hit, this.shotDamage[i], this.shotX[i] - this.shotVX[i] * 0.05, this.shotZ[i] - this.shotVZ[i] * 0.05);
        this.spawnImpact(this.shotX[i], this.shotZ[i], this.shotSize[i]);
        sfx('hit');
      } else {
        for (const extra of this.extras) {
          if (!extra.activo || extra.id === this.shotLastExtra[i]) continue;
          if (Math.hypot(extra.x - this.shotX[i], extra.z - this.shotZ[i]) <= extra.radio + 0.3) {
            hitExtra = extra;
            this.dealExtra('cortador', extra, this.shotDamage[i]);
            this.spawnImpact(this.shotX[i], this.shotZ[i], this.shotSize[i]);
            sfx('hit');
            break;
          }
        }
      }

      if (hit >= 0 || hitExtra) {
        // Perfora: sigue volando y no vuelve a golpear a lo mismo.
        if (this.shotPierce[i] > 0) {
          this.shotPierce[i]--;
          if (hit >= 0) this.shotLastHit[i] = hit;
          if (hitExtra) this.shotLastExtra[i] = hitExtra.id;
          i++;
          continue;
        }
        this.killShot(i);
        continue;
      }
      if (this.shotLife[i] <= 0) {
        this.killShot(i);
        continue;
      }
      i++;
    }

    for (let i = 0; i < this.shotCount; i++) {
      this.quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(this.shotVX[i], this.shotVZ[i]));
      this.vec.set(this.shotX[i], this.world.heightAt(this.shotX[i], this.shotZ[i]) + 0.9, this.shotZ[i]);
      const s = this.shotSize[i];
      this.scale.set(s, s, s);
      this.matrix.compose(this.vec, this.quat, this.scale);
      this.shotGlow.setMatrixAt(i, this.matrix);
      this.shotCore.setMatrixAt(i, this.matrix);
    }
    this.shotGlow.count = this.shotCount;
    this.shotCore.count = this.shotCount;
    this.shotGlow.instanceMatrix.needsUpdate = true;
    this.shotCore.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- Pulso

  /** Onda del pulso: aro que se abre y un destello en el suelo, cada uno con su material. */
  private spawnPulse(x: number, z: number, radius: number, delay: number, dano: number, color: string) {
    const material = () => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const y = this.world.heightAt(x, z);
    const mesh = new THREE.Mesh(this.pulseGeometry, material());
    mesh.position.set(x, y + 0.25, z);
    const destello = new THREE.Mesh(this.discoGeometry, material());
    destello.position.set(x, y + 0.18, z);
    mesh.visible = destello.visible = delay <= 0;
    this.scene.add(mesh, destello);
    this.pulses.push({ mesh, destello, age: 0, radius, delay, x, z, dano });
  }

  private updatePulses(dt: number) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay > 0) continue;
        if (p.dano > 0) this.area('pulso', p.x, p.z, p.radius, p.dano, 0.6);
        p.dano = 0;
      }
      p.mesh.visible = p.destello.visible = true;
      p.age += dt;
      const t = p.age / 0.35;
      const r = p.radius * Math.min(1, 0.2 + t);
      p.mesh.scale.set(r, 1, r);
      p.destello.scale.set(r, 1, r);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      (p.destello.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.35 * (1 - t * 1.6));
      if (t >= 1) {
        this.scene.remove(p.mesh, p.destello);
        (p.mesh.material as THREE.Material).dispose();
        (p.destello.material as THREE.Material).dispose();
        this.pulses.splice(i, 1);
      }
    }
  }

  private updateImpacts(dt: number) {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const p = this.impacts[i];
      p.age += dt;
      const t = p.age / 0.18;
      p.mesh.scale.multiplyScalar(1 + dt * 9);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.impacts.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------- Lanza solar

  /**
   * Centros de los grupos más densos a tiro: prueba hasta 48 enemigos como
   * centro y se queda con los que más vecinos tienen, sin repetir zona. Si no
   * hay horda, apunta al jefe o a la torre más cercana.
   */
  private gruposDensos(px: number, pz: number, alcance: number, radio: number, cuantos: number) {
    const candidatos: { x: number; z: number; n: number }[] = [];
    const paso = Math.max(1, Math.floor(this.enemies.count / 48));
    for (let i = 0; i < this.enemies.count; i += paso) {
      if (this.enemies.hp[i] <= 0) continue;
      const x = this.enemies.x[i], z = this.enemies.z[i];
      if (Math.hypot(x - px, z - pz) > alcance) continue;
      let n = 0;
      this.enemies.forEachInRadius(x, z, radio, () => { n++; });
      candidatos.push({ x, z, n });
    }
    candidatos.sort((a, b) => b.n - a.n);
    const elegidos: { x: number; z: number }[] = [];
    for (const c of candidatos) {
      if (elegidos.length >= cuantos) break;
      if (elegidos.some((e) => Math.hypot(e.x - c.x, e.z - c.z) < radio * 1.5)) continue;
      elegidos.push(c);
    }
    if (elegidos.length < cuantos) {
      for (const extra of this.extras) {
        if (elegidos.length >= cuantos) break;
        if (extra.activo && Math.hypot(extra.x - px, extra.z - pz) <= alcance + extra.radio) elegidos.push({ x: extra.x, z: extra.z });
      }
    }
    return elegidos;
  }

  private spawnLanza(x: number, z: number, radio: number, dano: number) {
    const y = this.world.heightAt(x, z) + 0.12;
    const aviso = new THREE.Mesh(this.pulseGeometry, new THREE.MeshBasicMaterial({
      color: WEAPONS.lanza.color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
    }));
    aviso.position.set(x, y, z);
    aviso.scale.set(radio, 1, radio);
    const relleno = new THREE.Mesh(this.discoGeometry, new THREE.MeshBasicMaterial({
      color: '#fff1a8', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    relleno.position.set(x, y - 0.02, z);
    relleno.scale.setScalar(0.01);
    this.scene.add(aviso, relleno);
    this.lanzas.push({ x, z, radio, dano, t: 0, aviso, relleno, rayo: null });
  }

  private updateLanzas(dt: number) {
    for (let i = this.lanzas.length - 1; i >= 0; i--) {
      const l = this.lanzas[i];
      l.t += dt;
      if (!l.rayo) {
        // El aviso se llena hasta que cae el rayo.
        const k = Math.min(1, l.t / AVISO_LANZA);
        l.relleno.scale.set(l.radio * k, 1, l.radio * k);
        (l.aviso.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.abs(Math.sin(l.t * 18));
        if (l.t < AVISO_LANZA) continue;
        this.area('lanza', l.x, l.z, l.radio, l.dano, 0.7);
        const rayo = new THREE.Mesh(this.rayoGeometry, new THREE.MeshBasicMaterial({
          color: '#fff6c8', transparent: true, opacity: 0.95, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        }));
        rayo.position.set(l.x, this.world.heightAt(l.x, l.z), l.z);
        rayo.scale.set(l.radio, 1, l.radio);
        this.scene.add(rayo);
        l.rayo = rayo;
        l.t = 0;
        this.spawnExplosion(l.x, l.z, l.radio, '#ffe066');
        this.eventos.sacudida?.();
        sfx('solar');
        continue;
      }
      // El rayo se estrecha y se apaga en 0,35 s.
      const t = l.t / 0.35;
      const ancho = l.radio * Math.max(0.05, 1 - t * 0.8);
      l.rayo.scale.set(ancho, 1, ancho);
      (l.rayo.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - t));
      (l.aviso.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - t));
      (l.relleno.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 * (1 - t));
      if (t >= 1) {
        this.scene.remove(l.aviso, l.relleno, l.rayo);
        for (const m of [l.aviso, l.relleno, l.rayo]) (m.material as THREE.Material).dispose();
        this.lanzas.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------- Mortero

  /** Blancos del mortero: enemigos al azar entre los que hay a tiro, o el jefe. */
  private blancosMortero(px: number, pz: number, alcance: number, cuantos: number) {
    const aTiro: number[] = [];
    this.enemies.forEachInRadius(px, pz, alcance, (i) => { aTiro.push(i); });
    const blancos: { x: number; z: number }[] = [];
    for (let n = 0; n < cuantos && aTiro.length; n++) {
      const k = Math.floor(Math.random() * aTiro.length);
      const i = aTiro[k];
      aTiro.splice(k, 1);
      blancos.push({ x: this.enemies.x[i], z: this.enemies.z[i] });
    }
    if (!blancos.length) {
      const extra = this.extras.find((e) => e.activo && Math.hypot(e.x - px, e.z - pz) <= alcance + e.radio);
      if (extra) blancos.push({ x: extra.x, z: extra.z });
    }
    return blancos;
  }

  private spawnBomba(px: number, pz: number, x: number, z: number, dano: number, radio: number, charco: number) {
    const mesh = new THREE.Mesh(this.bombaGeometry, new THREE.MeshBasicMaterial({ color: '#3a2a22' }));
    const nucleo = new THREE.Mesh(this.impactGeometry, new THREE.MeshBasicMaterial({
      color: WEAPONS.mortero.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    nucleo.scale.setScalar(1.6);
    mesh.add(nucleo);
    mesh.position.set(px, this.world.heightAt(px, pz) + 1.4, pz);
    this.scene.add(mesh);
    this.bombas.push({ x0: px, z0: pz, x1: x, z1: z, t: 0, dano, radio, charco, mesh });
  }

  private updateBombas(dt: number) {
    for (let i = this.bombas.length - 1; i >= 0; i--) {
      const b = this.bombas[i];
      b.t += dt;
      const k = Math.min(1, b.t / VUELO_MORTERO);
      const x = b.x0 + (b.x1 - b.x0) * k, z = b.z0 + (b.z1 - b.z0) * k;
      // Parábola: sale del hombro, sube 5 m y cae sobre el blanco.
      const suelo = this.world.heightAt(x, z);
      b.mesh.position.set(x, suelo + 1.4 * (1 - k) + 5 * 4 * k * (1 - k), z);
      b.mesh.rotation.x += dt * 9;
      b.mesh.rotation.z += dt * 7;
      if (k < 1) continue;
      this.scene.remove(b.mesh);
      b.mesh.traverse((o) => { if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose(); });
      this.bombas.splice(i, 1);
      this.area('mortero', b.x1, b.z1, b.radio, b.dano, 0.9);
      this.spawnExplosion(b.x1, b.z1, b.radio, WEAPONS.mortero.color);
      this.spawnCharco(b.x1, b.z1, b.radio * 0.85, b.dano * DANO_CHARCO, b.charco);
      this.eventos.sacudida?.();
      sfx('boom');
    }
  }

  private spawnCharco(x: number, z: number, radio: number, dano: number, segundos: number) {
    if (this.charcos.length > 24) {
      const viejo = this.charcos.shift()!;
      this.scene.remove(viejo.mesh);
      (viejo.mesh.material as THREE.Material).dispose();
    }
    const mesh = new THREE.Mesh(this.discoGeometry, new THREE.MeshBasicMaterial({
      color: '#ff8a3d', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    mesh.position.set(x, this.world.heightAt(x, z) + 0.1, z);
    mesh.scale.set(radio, 1, radio);
    this.scene.add(mesh);
    this.charcos.push({ x, z, radio, dano, hasta: segundos, tic: TIC_CHARCO, edad: 0, mesh });
  }

  private updateCharcos(dt: number) {
    for (let i = this.charcos.length - 1; i >= 0; i--) {
      const c = this.charcos[i];
      c.edad += dt;
      c.tic -= dt;
      if (c.tic <= 0) {
        c.tic += TIC_CHARCO;
        this.area('mortero', c.x, c.z, c.radio, c.dano, 0);
      }
      const fin = Math.max(0, 1 - Math.max(0, c.edad - c.hasta + 0.4) / 0.4);
      (c.mesh.material as THREE.MeshBasicMaterial).opacity = (0.32 + 0.12 * Math.sin(c.edad * 12)) * fin;
      if (c.edad >= c.hasta) {
        this.scene.remove(c.mesh);
        (c.mesh.material as THREE.Material).dispose();
        this.charcos.splice(i, 1);
      }
    }
  }

  /** Bola de fuego que se hincha y un aro que barre el suelo. */
  private spawnExplosion(x: number, z: number, radio: number, color: string) {
    if (this.explosiones.length > 20) return;
    const y = this.world.heightAt(x, z);
    const bola = new THREE.Mesh(this.bolaGeometry, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    bola.position.set(x, y + 0.4, z);
    bola.scale.setScalar(0.2);
    const onda = new THREE.Mesh(this.pulseGeometry, new THREE.MeshBasicMaterial({
      color: '#fff3d6', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    onda.position.set(x, y + 0.15, z);
    this.scene.add(bola, onda);
    this.explosiones.push({ bola, onda, edad: 0, radio });
  }

  private updateExplosiones(dt: number) {
    for (let i = this.explosiones.length - 1; i >= 0; i--) {
      const e = this.explosiones[i];
      e.edad += dt;
      const t = e.edad / 0.32;
      const r = e.radio * (0.3 + 0.8 * Math.min(1, t));
      e.bola.scale.set(r * 0.8, r * 0.6, r * 0.8);
      e.onda.scale.set(r * 1.15, 1, r * 1.15);
      (e.bola.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - t));
      (e.onda.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) {
        this.scene.remove(e.bola, e.onda);
        (e.bola.material as THREE.Material).dispose();
        (e.onda.material as THREE.Material).dispose();
        this.explosiones.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------- Arco de ADA

  /** Una cadena: golpea al primero y salta al más cercano que no haya tocado. */
  private cadena(inicio: number, px: number, pz: number, dano: number, saltos: number, alcance: number, freno: number, tiempo: number) {
    const tocados = new Set<number>();
    const puntos: [number, number][] = [[px, pz]];
    let actual = inicio;
    for (let k = 0; k <= saltos && actual >= 0; k++) {
      const x = this.enemies.x[actual], z = this.enemies.z[actual];
      tocados.add(actual);
      puntos.push([x, z]);
      this.deal('arco', actual, dano, x, z, 0);
      this.enemies.slow[actual] = tiempo;
      this.enemies.slowFactor[actual] = freno;
      actual = this.enemies.nearest(x, z, alcance, tocados);
    }
    this.spawnRayo(puntos);
  }

  /** Rayo en zigzag entre los puntos: tramos finos con halo, que se apagan en 0,2 s. */
  private spawnRayo(puntos: [number, number][]) {
    if (this.rayos.length > 12) return;
    const grupo = new THREE.Group();
    const nucleo = new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 1, depthWrite: false });
    const halo = new THREE.MeshBasicMaterial({
      color: WEAPONS.arco.color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let k = 1; k < puntos.length; k++) {
      const [x0, z0] = puntos[k - 1], [x1, z1] = puntos[k];
      const y0 = this.world.heightAt(x0, z0) + (k === 1 ? 1.5 : 1), y1 = this.world.heightAt(x1, z1) + 1;
      // Tres quiebros por tramo.
      let prev = a.set(x0, y0, z0).clone();
      for (let q = 1; q <= 3; q++) {
        const f = q / 3;
        const sig = q === 3
          ? b.set(x1, y1, z1).clone()
          : b.set(x0 + (x1 - x0) * f + (Math.random() - 0.5) * 0.7, y0 + (y1 - y0) * f + (Math.random() - 0.5) * 0.6, z0 + (z1 - z0) * f + (Math.random() - 0.5) * 0.7).clone();
        const largo = prev.distanceTo(sig);
        for (const [mat, grosor] of [[nucleo, 0.07], [halo, 0.24]] as const) {
          const tramo = new THREE.Mesh(this.segmentoGeometry, mat);
          tramo.position.copy(prev);
          tramo.lookAt(sig);
          tramo.scale.set(grosor, grosor, largo);
          grupo.add(tramo);
        }
        prev = sig;
      }
      this.spawnImpact(x1, z1, 1.1, '#cfefff');
    }
    this.scene.add(grupo);
    this.rayos.push({ grupo, mats: [nucleo, halo], edad: 0 });
  }

  private updateRayos(dt: number) {
    for (let i = this.rayos.length - 1; i >= 0; i--) {
      const r = this.rayos[i];
      r.edad += dt;
      const t = r.edad / 0.2;
      r.mats[0].opacity = Math.max(0, 1 - t);
      r.mats[1].opacity = Math.max(0, 0.7 * (1 - t));
      if (t >= 1) {
        this.scene.remove(r.grupo);
        for (const m of r.mats) m.dispose();
        this.rayos.splice(i, 1);
      }
    }
  }

  // ----------------------------------------------------------- Dron y aura

  private syncDrones() {
    const want = this.stats('dron').count;
    while (this.drones.length < want) {
      const modelo = crearInspector();
      const mixer = new THREE.AnimationMixer(modelo.raiz);
      const clip = (nombre: string) => modelo.animaciones.find((a) => a.clip.name === nombre)!.clip;
      const volar = mixer.clipAction(clip('Volar'));
      const golpe = mixer.clipAction(clip('Golpe'));
      golpe.setLoop(THREE.LoopOnce, 1);
      // Cada dron empieza su vuelo en otra fase: no se mueven a la vez.
      volar.time = Math.random() * clip('Volar').duration;
      volar.play();
      // Al acabar la embestida vuelve a volar.
      mixer.addEventListener('finished', (e) => {
        if (e.action === golpe) volar.reset().fadeIn(0.08).play();
      });
      this.scene.add(modelo.raiz);
      this.drones.push({ raiz: modelo.raiz, mixer, volar, golpe });
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
      drone.raiz.position.set(dx, this.world.heightAt(dx, dz) + 1.15 + Math.sin(a * 2) * 0.15, dz);
      // Mira hacia donde va (la tangente de la órbita).
      drone.raiz.rotation.y = -a;
      drone.mixer.update(dt);
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
    for (const d of this.drones) {
      d.mixer.stopAllAction();
      this.scene.remove(d.raiz);
    }
    for (const p of this.pulses) this.scene.remove(p.mesh, p.destello);
    for (const p of this.impacts) this.scene.remove(p.mesh);
    for (const l of this.lanzas) this.scene.remove(l.aviso, l.relleno, ...(l.rayo ? [l.rayo] : []));
    for (const b of this.bombas) this.scene.remove(b.mesh);
    for (const c of this.charcos) this.scene.remove(c.mesh);
    for (const e of this.explosiones) this.scene.remove(e.bola, e.onda);
    for (const r of this.rayos) this.scene.remove(r.grupo);
    this.personaje.dispose();
    this.scene.remove(this.shotGlow, this.shotCore, this.aura);
  }
}
