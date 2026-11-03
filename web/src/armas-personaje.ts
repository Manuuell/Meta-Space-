import * as THREE from 'three';
import { WEAPONS, type WeaponId, type WeaponLevel } from './data';
import type { Enemies } from './enemies';
import type { World } from './world';
import type { ObjetivoCombate } from './contenido-juego';
import { sfx } from './audio';
import { Efectos } from './fx-operadores';
import { PALETA, barra, barril, brillo, caja, conDetalle, esfera, nodo, pieza, punta, toon } from './modelos/kit';
import { halo } from './modelos/brillo';

// Las herramientas exclusivas de los cinco operadores, aparte de `weapons.ts`
// para que cada una tenga su efecto propio sin engordar las comunes:
//   · torreta (Mara): se despliega donde está ella y dispara trazadoras.
//   · martillo (Idris): la llave de impacto barre un arco de 100° y vuelve.
//   · sello (Noa): sellos que persiguen al blanco y lo marcan (+20 % de daño).
//   · bumeran (Taro): un disco que sale hasta su alcance y vuelve atravesando.
//   · semillas (Amara): semillas en parábola que brotan en zarzas que frenan.
// Todas dañan también a jefes y torres. El daño y los críticos los pone
// `Weapons` (por `Golpes`), así cuentan en los resultados como las demás.

/** Lo que estas armas le piden a `Weapons`: dañar, contar el daño y sacudir la cámara. */
export interface Golpes {
  enemigo(id: WeaponId, i: number, dano: number, desdeX: number, desdeZ: number, empuje?: number): void;
  extra(id: WeaponId, objetivo: ObjetivoCombate, dano: number): void;
  extras(): readonly ObjetivoCombate[];
  sacudida(): void;
}

interface Mods { area: number }

/** Altura a la que vuelan sellos y discos (m sobre el suelo). */
const VUELO = 1.35;
/** Medio ángulo del barrido de la llave (100° en total). */
const MEDIO_ARCO = THREE.MathUtils.degToRad(50);
/** Segundos entre el golpe de ida y el de vuelta de la llave. */
const VUELTA_LLAVE = 0.15;
const VELOCIDAD_SELLO = 15;
/** Segundos que dura marcado un enemigo tocado por un sello. */
const MARCA = 4;
/** Hasta dónde busca blancos el semillero (m). */
const ALCANCE_SEMILLAS = 18;
const VUELO_SEMILLA = 0.55;
const MAX_MARCAS = 96;
const MAX_ESTELA = 72;

interface Torreta {
  grupo: THREE.Object3D;
  cabeza: THREE.Object3D;
  canon: THREE.Object3D;
  aro: THREE.Mesh;
  x: number;
  z: number;
  vida: number;
  total: number;
  edad: number;
  cd: number;
  /** La de la Sobrecarga de red: no cuenta para el tope de torretas. */
  extra: boolean;
}

interface Barrido {
  grupo: THREE.Group;
  sector: THREE.MeshBasicMaterial;
  hoja: THREE.Mesh;
  hojaMat: THREE.MeshBasicMaterial;
  edad: number;
  sentido: number;
}

interface GolpePendiente {
  t: number;
  rumbo: number;
  radio: number;
  dano: number;
}

interface Sello {
  grupo: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  /** Blanco: índice y semilla del enemigo (para reconocerlo tras compactar) o un jefe. */
  i: number;
  semilla: number;
  extra: ObjetivoCombate | null;
  vida: number;
  dano: number;
}

interface Disco {
  grupo: THREE.Object3D;
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  x: number;
  z: number;
  t: number;
  ida: number;
  alcance: number;
  volviendo: boolean;
  tocados: Set<number>;
  tocadosExtra: Set<string>;
  dano: number;
  estela: { x: number; y: number; z: number }[];
}

interface Semilla {
  grupo: THREE.Object3D;
  x0: number; z0: number; y0: number;
  x1: number; z1: number;
  t: number;
  nivel: WeaponLevel;
  radio: number;
  dano: number;
}

interface Zarza {
  grupo: THREE.Object3D;
  aro: THREE.Mesh;
  x: number;
  z: number;
  radio: number;
  dano: number;
  cada: number;
  tic: number;
  vida: number;
  total: number;
  seca: boolean;
}

export class ArmasPersonaje {
  private scene: THREE.Scene;
  private enemies: Enemies;
  private world: World;
  private golpes: Golpes;
  readonly efectos: Efectos;

  private torretas: Torreta[] = [];
  private barridos: Barrido[] = [];
  private pendientes: GolpePendiente[] = [];
  private sellos: Sello[] = [];
  private discos: Disco[] = [];
  private semillas: Semilla[] = [];
  private zarzas: Zarza[] = [];

  // Plantillas que se clonan (comparten geometría y material).
  private plantillas = new Map<string, THREE.Object3D>();
  private geoSector = new THREE.RingGeometry(0.22, 1, 24, 1, -Math.PI / 2 - MEDIO_ARCO, MEDIO_ARCO * 2).rotateX(-Math.PI / 2);
  private geoHoja = new THREE.BoxGeometry(0.09, 0.05, 0.78).translate(0, 0, 0.61);
  private geoAro = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2);
  /** Sellos flotando encima de los marcados. */
  private marcas: THREE.InstancedMesh;
  /** Estela aditiva de los discos: bolitas que se encogen. */
  private estela: THREE.InstancedMesh;

  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private s = new THREE.Vector3();
  private elegidos = new Set<number>();
  private tiempo = 0;

  constructor(scene: THREE.Scene, enemies: Enemies, world: World, golpes: Golpes) {
    this.scene = scene;
    this.enemies = enemies;
    this.world = world;
    this.golpes = golpes;
    this.efectos = new Efectos(scene);
    this.marcas = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.11, 0.2, 6),
      new THREE.MeshBasicMaterial({ color: WEAPONS.sello.color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
      MAX_MARCAS,
    );
    this.marcas.count = 0;
    this.marcas.frustumCulled = false;
    scene.add(this.marcas);
    this.estela = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_ESTELA,
    );
    this.estela.count = 0;
    this.estela.frustumCulled = false;
    scene.add(this.estela);
  }

  // ------------------------------------------------------------ disparo

  /** Una descarga de la herramienta `id` (la llama `Weapons.fire`). */
  disparar(id: WeaponId, s: WeaponLevel, d: number, px: number, pz: number, mods: Mods, rumbo: number) {
    switch (id) {
      case 'torreta': this.desplegar(px, pz, s, false); break;
      case 'martillo': this.blandir(px, pz, s, d, mods, rumbo); break;
      case 'sello': this.sellar(px, pz, s, d, mods); break;
      case 'bumeran': this.lanzarDiscos(px, pz, s, d, mods, rumbo); break;
      case 'semillas': this.sembrar(px, pz, s, d, mods); break;
      default: break;
    }
  }

  // ------------------------------------------------------------ torreta

  private plantillaTorreta() {
    let t = this.plantillas.get('torreta');
    if (t) return t;
    t = conDetalle(0.5, () => {
      const g = new THREE.Group();
      const violeta = WEAPONS.torreta.color;
      pieza(g, barril(0.42, 0.46, 0.1, 0.04), toon(PALETA.oscuro), 0, 0.05, 0);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        barra(g, [0, 0.42, 0], [Math.sin(a) * 0.48, 0.06, Math.cos(a) * 0.48], 0.045, toon(PALETA.metalOscuro));
      }
      pieza(g, barril(0.12, 0.15, 0.3, 0.04), toon('#363a4c'), 0, 0.5, 0);
      const cabeza = nodo('cabeza', g, 0, 0.72, 0);
      pieza(cabeza, caja(0.5, 0.3, 0.46, 0.08), toon(violeta));
      pieza(cabeza, caja(0.54, 0.08, 0.3, 0.03), toon('#363a4c'), 0, -0.02, -0.04);
      pieza(cabeza, caja(0.12, 0.06, 0.03, 0.01), brillo(PALETA.ada), 0.12, 0.06, 0.235, { contorno: false });
      const canon = nodo('canon', cabeza, 0, 0.02, 0.2);
      pieza(canon, barril(0.07, 0.08, 0.5, 0.02).rotateX(Math.PI / 2), toon('#363a4c'), 0, 0, 0.24);
      pieza(canon, new THREE.TorusGeometry(0.08, 0.025, 6, 14), brillo(violeta), 0, 0, 0.5, { contorno: false });
      pieza(cabeza, esfera(0.07), brillo(violeta), 0, 0.2, -0.08, { contorno: false });
      halo(cabeza, violeta, 0.7, 0, 0.2, -0.08, 0.7);
      return g;
    });
    this.plantillas.set('torreta', t);
    return t;
  }

  private desplegar(x: number, z: number, s: WeaponLevel, extra: boolean) {
    const grupo = this.plantillaTorreta().clone(true);
    const y = this.world.heightAt(x, z);
    grupo.position.set(x, y, z);
    this.scene.add(grupo);
    const aro = new THREE.Mesh(this.geoAro, new THREE.MeshBasicMaterial({
      color: WEAPONS.torreta.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    aro.position.set(x, y + 0.05, z);
    aro.scale.setScalar(0.7);
    this.scene.add(aro);
    const total = s.duration ?? 8;
    this.torretas.push({
      grupo, cabeza: grupo.getObjectByName('cabeza')!, canon: grupo.getObjectByName('canon')!, aro,
      x, z, vida: total, total, edad: 0, cd: 0.35, extra,
    });
    this.efectos.anillo(x, y, z, { color: WEAPONS.torreta.color, duracion: 0.45, desde: 0.3, hasta: 2.2 });
    this.efectos.columna(x, y, z, 2.4, { color: '#c9c2ff', duracion: 0.3, desde: 0.35, hasta: 0.12, opacidad: 0.6 });
    // Tope de torretas (las extra de la sobrecarga no cuentan).
    const normales = this.torretas.filter((t) => !t.extra);
    while (normales.length > s.count) this.retirar(this.torretas.indexOf(normales.shift()!));
    sfx('zap');
  }

  /** La torreta extra que planta la Sobrecarga de red. */
  torretaExtra(x: number, z: number, s: WeaponLevel) {
    this.desplegar(x + 1.2, z + 0.6, s, true);
  }

  /** Dónde están las torretas (para los enlaces de la sobrecarga). */
  posicionesTorretas(): readonly { x: number; z: number }[] {
    return this.torretas;
  }

  private retirar(k: number) {
    const [t] = this.torretas.splice(k, 1);
    if (!t) return;
    this.efectos.chispa(t.x, this.world.heightAt(t.x, t.z) + 0.7, t.z, { color: WEAPONS.torreta.color, duracion: 0.35, desde: 0.3, hasta: 1.1 });
    this.scene.remove(t.grupo, t.aro);
    (t.aro.material as THREE.Material).dispose();
  }

  private actualizarTorretas(dt: number, s: WeaponLevel | null, mods: Mods, sobrecarga: boolean, d: number) {
    for (let k = this.torretas.length - 1; k >= 0; k--) {
      const t = this.torretas[k];
      t.vida -= dt;
      t.edad += dt;
      if (t.vida <= 0 || !s) { this.retirar(k); continue; }
      // Se despliega de golpe: cae, se estira y rebota.
      const e = Math.min(1, t.edad / 0.35);
      const y = this.world.heightAt(t.x, t.z);
      t.grupo.position.y = y + (1 - e) ** 2 * 1.2;
      t.grupo.scale.set(1, Math.max(0.05, e < 1 ? e * 1.12 : 1 + Math.sin(Math.min(1, (t.edad - 0.35) / 0.2) * Math.PI) * 0.06), 1);
      const fin = t.vida < 1.2 ? 0.5 + 0.5 * Math.sin(t.vida * 22) : 1;
      (t.aro.material as THREE.MeshBasicMaterial).opacity = 0.45 * (t.vida / t.total) * fin + 0.08;
      t.aro.rotation.y += dt * 0.8;
      t.canon.position.z += (0.2 - t.canon.position.z) * Math.min(1, dt * 14);

      const alcance = s.area * mods.area;
      let tx = 0, tz = 0, mejor = alcance, blanco = -1;
      let jefe: ObjetivoCombate | null = null;
      const i = this.enemies.nearest(t.x, t.z, alcance);
      if (i >= 0) { tx = this.enemies.x[i]; tz = this.enemies.z[i]; mejor = Math.hypot(tx - t.x, tz - t.z); blanco = i; }
      for (const o of this.golpes.extras()) {
        if (!o.activo) continue;
        const dd = Math.hypot(o.x - t.x, o.z - t.z) - o.radio;
        if (dd < mejor) { mejor = dd; jefe = o; blanco = -1; tx = o.x; tz = o.z; }
      }
      if (blanco < 0 && !jefe) { t.cabeza.rotation.y += dt * 0.9; t.cd = Math.max(0, t.cd - dt); continue; }
      // Gira hacia el blanco y dispara cuando lo tiene delante.
      const quiere = Math.atan2(tx - t.x, tz - t.z);
      let giro = quiere - t.cabeza.rotation.y;
      giro = Math.atan2(Math.sin(giro), Math.cos(giro));
      t.cabeza.rotation.y += giro * Math.min(1, dt * 16);
      t.cd -= dt;
      if (t.cd > 0 || Math.abs(giro) > 0.5 || t.edad < 0.35) continue;
      t.cd = (s.rate ?? 0.4) * (sobrecarga ? 0.5 : 1);
      t.canon.position.z = 0.1;
      const boca = this.v.set(Math.sin(quiere) * 0.75, 0, Math.cos(quiere) * 0.75).add(t.grupo.position).setY(y + 0.75);
      const llega = this.v2.set(tx, this.world.heightAt(tx, tz) + (jefe ? 1.6 : 0.9), tz);
      this.efectos.rayo(boca, llega, 0.07, { color: sobrecarga ? '#ffffff' : '#b4a9ff', duracion: 0.09 });
      this.efectos.chispa(boca.x, boca.y, boca.z, { color: WEAPONS.torreta.color, duracion: 0.1, desde: 0.15, hasta: 0.35 });
      this.efectos.chispa(llega.x, llega.y, llega.z, { color: '#c9c2ff', duracion: 0.16, desde: 0.2, hasta: 0.5 });
      if (blanco >= 0) this.golpes.enemigo('torreta', blanco, d, t.x, t.z, 0.15);
      else if (jefe) this.golpes.extra('torreta', jefe, d);
      sfx('torreta');
    }
  }

  // ------------------------------------------------------------ llave

  /** ¿Hay algo que golpear en el arco de delante? */
  private hayEnArco(px: number, pz: number, radio: number, rumbo: number) {
    const fx = Math.sin(rumbo), fz = Math.cos(rumbo), c = Math.cos(MEDIO_ARCO);
    let hay = false;
    this.enemies.forEachInRadius(px, pz, radio, (i) => {
      const dx = this.enemies.x[i] - px, dz = this.enemies.z[i] - pz, l = Math.hypot(dx, dz) || 1;
      if ((dx * fx + dz * fz) / l >= c) hay = true;
    });
    return hay;
  }

  private blandir(px: number, pz: number, s: WeaponLevel, d: number, mods: Mods, rumbo: number) {
    const radio = s.area * mods.area;
    // Golpea hacia donde camina; si ahí no hay nada, se gira hacia lo más cercano.
    let dir = rumbo;
    if (!this.hayEnArco(px, pz, radio, rumbo)) {
      const i = this.enemies.nearest(px, pz, radio * 1.25);
      const jefe = this.golpes.extras().find((o) => o.activo && Math.hypot(o.x - px, o.z - pz) <= radio + o.radio);
      if (i >= 0) dir = Math.atan2(this.enemies.x[i] - px, this.enemies.z[i] - pz);
      else if (jefe) dir = Math.atan2(jefe.x - px, jefe.z - pz);
      else return;
    }
    this.golpear(px, pz, dir, radio, d, 1);
    if (s.count >= 2) this.pendientes.push({ t: VUELTA_LLAVE, rumbo: dir, radio, dano: d });
  }

  private golpear(px: number, pz: number, rumbo: number, radio: number, d: number, sentido: number) {
    const fx = Math.sin(rumbo), fz = Math.cos(rumbo), c = Math.cos(MEDIO_ARCO);
    let tocados = 0;
    this.enemies.forEachInRadius(px, pz, radio, (i) => {
      const dx = this.enemies.x[i] - px, dz = this.enemies.z[i] - pz, l = Math.hypot(dx, dz) || 1;
      if ((dx * fx + dz * fz) / l < c) return;
      this.golpes.enemigo('martillo', i, d, px, pz, 2.2);
      if (tocados++ < 6) this.efectos.chispa(this.enemies.x[i], this.world.heightAt(this.enemies.x[i], this.enemies.z[i]) + 1, this.enemies.z[i], { color: '#ffcf74', duracion: 0.18, desde: 0.2, hasta: 0.6 });
    });
    for (const o of this.golpes.extras()) {
      if (!o.activo) continue;
      const dx = o.x - px, dz = o.z - pz, l = Math.hypot(dx, dz) || 1;
      if (l > radio + o.radio || (dx * fx + dz * fz) / l < c - 0.3) continue;
      this.golpes.extra('martillo', o, d);
      tocados += 3;
    }
    if (tocados >= 3) this.golpes.sacudida();
    sfx('llave');

    // El arco de luz naranja que barre el suelo, con su hoja brillante.
    const grupo = new THREE.Group();
    grupo.position.set(px, this.world.heightAt(px, pz) + 0.12, pz);
    grupo.rotation.y = rumbo;
    grupo.scale.setScalar(radio);
    const sector = new THREE.MeshBasicMaterial({ color: WEAPONS.martillo.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    grupo.add(new THREE.Mesh(this.geoSector, sector));
    const hojaMat = new THREE.MeshBasicMaterial({ color: '#fff1c9', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const hoja = new THREE.Mesh(this.geoHoja, hojaMat);
    hoja.rotation.y = -MEDIO_ARCO * sentido;
    grupo.add(hoja);
    this.scene.add(grupo);
    this.barridos.push({ grupo, sector, hoja, hojaMat, edad: 0, sentido });
  }

  private actualizarLlave(dt: number, px: number, pz: number) {
    for (let k = this.pendientes.length - 1; k >= 0; k--) {
      const p = this.pendientes[k];
      p.t -= dt;
      if (p.t > 0) continue;
      this.pendientes.splice(k, 1);
      this.golpear(px, pz, p.rumbo, p.radio, p.dano, -1);
    }
    for (let k = this.barridos.length - 1; k >= 0; k--) {
      const b = this.barridos[k];
      b.edad += dt;
      const barre = Math.min(1, b.edad / 0.12);
      b.hoja.rotation.y = (-MEDIO_ARCO + MEDIO_ARCO * 2 * (1 - (1 - barre) ** 2)) * b.sentido;
      b.sector.opacity = 0.5 * Math.max(0, 1 - b.edad / 0.32);
      b.hojaMat.opacity = 0.95 * Math.max(0, 1 - Math.max(0, b.edad - 0.1) / 0.15);
      b.grupo.scale.multiplyScalar(1 + dt * 0.6);
      if (b.edad < 0.32) continue;
      this.scene.remove(b.grupo);
      b.sector.dispose();
      b.hojaMat.dispose();
      this.barridos.splice(k, 1);
    }
  }

  // ------------------------------------------------------------ sello

  private plantillaSello() {
    let t = this.plantillas.get('sello');
    if (t) return t;
    t = new THREE.Group();
    const hex = (r: number, grosor: number, color: string, z: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, grosor, 6).rotateX(Math.PI / 2), brillo(color));
      m.position.z = z;
      t!.add(m);
    };
    hex(0.24, 0.05, WEAPONS.sello.color, 0);
    hex(0.15, 0.06, '#ffe3f3', 0.004);
    hex(0.07, 0.07, '#a8306f', 0.008);
    halo(t, WEAPONS.sello.color, 1.1, 0, 0, 0, 0.7);
    this.plantillas.set('sello', t);
    return t;
  }

  private sellar(px: number, pz: number, s: WeaponLevel, d: number, mods: Mods) {
    const alcance = s.area * mods.area;
    this.elegidos.clear();
    const jefes = this.golpes.extras().filter((o) => o.activo && Math.hypot(o.x - px, o.z - pz) <= alcance + o.radio);
    let lanzados = 0;
    for (let n = 0; n < s.count; n++) {
      const i = this.enemies.nearest(px, pz, alcance, this.elegidos);
      const jefe = i < 0 ? jefes[n % Math.max(1, jefes.length)] ?? null : null;
      if (i < 0 && !jefe) break;
      if (i >= 0) this.elegidos.add(i);
      // Sale en abanico y se curva hacia su blanco.
      const tx = i >= 0 ? this.enemies.x[i] : jefe!.x, tz = i >= 0 ? this.enemies.z[i] : jefe!.z;
      const a = Math.atan2(tx - px, tz - pz) + (n - (s.count - 1) / 2) * 0.7 + (s.count === 1 ? 0.5 : 0);
      const grupo = this.plantillaSello().clone(true);
      const y = this.world.heightAt(px, pz) + VUELO + 0.4;
      grupo.position.set(px, y, pz);
      this.scene.add(grupo);
      this.sellos.push({
        grupo, x: px, y, z: pz, vx: Math.sin(a) * VELOCIDAD_SELLO * 0.7, vz: Math.cos(a) * VELOCIDAD_SELLO * 0.7,
        i, semilla: i >= 0 ? this.enemies.seed[i] : -1, extra: jefe, vida: 2.2, dano: d,
      });
      lanzados++;
    }
    if (lanzados) sfx('sello');
  }

  /** Sigue al mismo enemigo aunque `Enemies` haya compactado sus arrays. */
  private seguir(i: number, semilla: number) {
    if (i >= 0 && i < this.enemies.count && this.enemies.seed[i] === semilla && this.enemies.hp[i] > 0) return i;
    for (let k = 0; k < this.enemies.count; k++) if (this.enemies.seed[k] === semilla && this.enemies.hp[k] > 0) return k;
    return -1;
  }

  private actualizarSellos(dt: number) {
    for (let k = this.sellos.length - 1; k >= 0; k--) {
      const p = this.sellos[k];
      p.vida -= dt;
      let tx: number, tz: number, radio: number;
      if (p.extra) {
        if (!p.extra.activo) p.vida = 0;
        tx = p.extra.x; tz = p.extra.z; radio = p.extra.radio + 0.4;
      } else {
        p.i = this.seguir(p.i, p.semilla);
        if (p.i < 0) {
          // Su blanco cayó: busca otro cerca o se apaga.
          p.i = this.enemies.nearest(p.x, p.z, 8);
          p.semilla = p.i >= 0 ? this.enemies.seed[p.i] : -1;
          if (p.i < 0) p.vida = Math.min(p.vida, 0.15);
        }
        tx = p.i >= 0 ? this.enemies.x[p.i] : p.x + p.vx;
        tz = p.i >= 0 ? this.enemies.z[p.i] : p.z + p.vz;
        radio = p.i >= 0 ? this.enemies.defOf(p.i).radius + 0.45 : 0;
      }
      // Gira hacia el blanco en vuelo.
      const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz) || 1;
      const giro = Math.min(1, dt * 7);
      p.vx += (dx / l * VELOCIDAD_SELLO - p.vx) * giro;
      p.vz += (dz / l * VELOCIDAD_SELLO - p.vz) * giro;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const suelo = this.world.heightAt(p.x, p.z) + VUELO;
      p.y += (suelo - p.y) * Math.min(1, dt * 4);
      p.grupo.position.set(p.x, p.y, p.z);
      p.grupo.rotation.set(0, Math.atan2(p.vx, p.vz), this.tiempo * 14);
      if (k % 2 === 0 && p.vida > 0) this.efectos.chispa(p.x, p.y, p.z, { color: WEAPONS.sello.color, duracion: 0.22, desde: 0.14, hasta: 0.04, opacidad: 0.6 });

      if (radio > 0 && l <= radio && p.vida > 0) {
        if (p.extra) this.golpes.extra('sello', p.extra, p.dano);
        else {
          this.golpes.enemigo('sello', p.i, p.dano, p.x, p.z, 0.2);
          this.enemies.marca[p.i] = MARCA;
        }
        const y = this.world.heightAt(p.x, p.z);
        this.efectos.hexagono(tx, y, tz, { color: WEAPONS.sello.color, duracion: 0.4, desde: 0.3, hasta: 1.4 });
        this.efectos.chispa(tx, p.y, tz, { color: '#ffd1ea', duracion: 0.2, desde: 0.2, hasta: 0.7 });
        p.vida = 0;
      }
      if (p.vida <= 0) {
        this.scene.remove(p.grupo);
        this.sellos.splice(k, 1);
      }
    }
  }

  /** Un sello pequeño encima de cada marcado, girando. */
  private dibujarMarcas() {
    let n = 0;
    for (let i = 0; i < this.enemies.count && n < MAX_MARCAS; i++) {
      if (this.enemies.marca[i] <= 0 || this.enemies.hp[i] <= 0) continue;
      const x = this.enemies.x[i], z = this.enemies.z[i];
      const def = this.enemies.defOf(i);
      // Parpadea en el último segundo de la marca.
      const visible = this.enemies.marca[i] > 1 || Math.sin(this.tiempo * 30) > 0;
      this.v.set(x, this.world.heightAt(x, z) + 1.9 + def.radius * 0.9 + Math.sin(this.tiempo * 4 + i) * 0.08, z);
      this.q.setFromAxisAngle(this.v2.set(0, 1, 0), this.tiempo * 3 + i);
      this.s.setScalar(visible ? 1.3 : 0.001);
      this.m.compose(this.v, this.q, this.s);
      this.marcas.setMatrixAt(n++, this.m);
    }
    this.marcas.count = n;
    this.marcas.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ disco

  private plantillaDisco() {
    let t = this.plantillas.get('disco');
    if (t) return t;
    t = conDetalle(0.6, () => {
      const g = new THREE.Group();
      const inclina = nodo('inclina', g);
      inclina.rotation.x = 0.18;
      const giro = nodo('giro', inclina);
      pieza(giro, barril(0.4, 0.4, 0.06, 0.02), toon('#c9ced8'));
      pieza(giro, new THREE.TorusGeometry(0.4, 0.04, 6, 24).rotateX(Math.PI / 2), brillo(WEAPONS.bumeran.color), 0, 0, 0, { contorno: false });
      pieza(giro, barril(0.12, 0.12, 0.09, 0.02), toon(PALETA.metalOscuro));
      pieza(giro, esfera(0.06), brillo(PALETA.ada), 0, 0.05, 0, { contorno: false });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        pieza(giro, caja(0.05, 0.02, 0.26, 0.01), toon(PALETA.metalOscuro), Math.sin(a) * 0.24, 0.04, Math.cos(a) * 0.24, { contorno: false }).rotation.y = a;
      }
      halo(g, WEAPONS.bumeran.color, 1.3, 0, 0, 0, 0.55);
      return g;
    });
    this.plantillas.set('disco', t);
    return t;
  }

  private lanzarDiscos(px: number, pz: number, s: WeaponLevel, d: number, mods: Mods, rumbo: number) {
    const alcance = s.area * mods.area;
    // Apunta a lo más cercano; si no hay nada, hacia donde va.
    let base = rumbo;
    const i = this.enemies.nearest(px, pz, alcance);
    const jefe = this.golpes.extras().find((o) => o.activo && Math.hypot(o.x - px, o.z - pz) <= alcance + o.radio);
    if (i >= 0) base = Math.atan2(this.enemies.x[i] - px, this.enemies.z[i] - pz);
    else if (jefe) base = Math.atan2(jefe.x - px, jefe.z - pz);
    else return;
    for (let n = 0; n < s.count; n++) {
      const a = base + (n - (s.count - 1) / 2) * 0.38;
      const grupo = this.plantillaDisco().clone(true);
      grupo.position.set(px, this.world.heightAt(px, pz) + VUELO, pz);
      this.scene.add(grupo);
      this.discos.push({
        grupo, ox: px, oz: pz, dx: Math.sin(a), dz: Math.cos(a), x: px, z: pz, t: 0, ida: 0.38 + alcance * 0.014,
        alcance, volviendo: false, tocados: new Set(), tocadosExtra: new Set(), dano: d, estela: [],
      });
    }
    sfx('disco');
  }

  private actualizarDiscos(dt: number, px: number, pz: number) {
    let e = 0;
    for (let k = this.discos.length - 1; k >= 0; k--) {
      const c = this.discos[k];
      c.t += dt;
      if (!c.volviendo) {
        // Ida con frenada hasta el alcance; ahí da la vuelta y se olvida de a quién tocó.
        const f = Math.min(1, c.t / c.ida);
        const r = c.alcance * (1 - (1 - f) ** 2);
        c.x = c.ox + c.dx * r;
        c.z = c.oz + c.dz * r;
        if (f >= 1) { c.volviendo = true; c.tocados.clear(); c.tocadosExtra.clear(); c.t = 0; }
      } else {
        // Vuelta acelerando hacia Taro, esté donde esté.
        const dx = px - c.x, dz = pz - c.z, l = Math.hypot(dx, dz) || 1;
        const v = Math.min(30, 10 + c.t * 40);
        c.x += dx / l * Math.min(l, v * dt);
        c.z += dz / l * Math.min(l, v * dt);
        if (l < 0.8 || c.t > 2.5) {
          this.scene.remove(c.grupo);
          this.discos.splice(k, 1);
          continue;
        }
      }
      const y = this.world.heightAt(c.x, c.z) + VUELO;
      c.grupo.position.set(c.x, y, c.z);
      c.grupo.getObjectByName('giro')!.rotation.y += dt * 26;
      this.enemies.forEachInRadius(c.x, c.z, 0.95, (i) => {
        const id = this.enemies.seed[i];
        if (c.tocados.has(id)) return;
        c.tocados.add(id);
        this.golpes.enemigo('bumeran', i, c.dano, c.x, c.z, 0.35);
        if (c.tocados.size <= 5) this.efectos.chispa(this.enemies.x[i], y, this.enemies.z[i], { color: WEAPONS.bumeran.color, duracion: 0.15, desde: 0.15, hasta: 0.5 });
      });
      for (const o of this.golpes.extras()) {
        if (!o.activo || c.tocadosExtra.has(o.id) || Math.hypot(o.x - c.x, o.z - c.z) > o.radio + 0.7) continue;
        c.tocadosExtra.add(o.id);
        this.golpes.extra('bumeran', o, c.dano);
      }
      c.estela.unshift({ x: c.x, y, z: c.z });
      if (c.estela.length > 9) c.estela.pop();
      c.estela.forEach((p, n) => {
        if (n === 0 || e >= MAX_ESTELA) return;
        const f = 1 - n / c.estela.length;
        this.v.set(p.x, p.y, p.z);
        this.s.setScalar(0.3 + f * 1.1);
        this.m.compose(this.v, this.q.identity(), this.s);
        this.estela.setMatrixAt(e, this.m);
        this.estela.setColorAt(e, this.c.set(WEAPONS.bumeran.color).multiplyScalar(f * 0.8));
        e++;
      });
    }
    this.estela.count = e;
    this.estela.instanceMatrix.needsUpdate = true;
    if (this.estela.instanceColor) this.estela.instanceColor.needsUpdate = true;
  }
  private c = new THREE.Color();

  // ------------------------------------------------------------ semillas

  private plantillaSemilla() {
    let t = this.plantillas.get('semilla');
    if (t) return t;
    t = new THREE.Group();
    t.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6).scale(1, 1.3, 1), brillo('#ffe066')));
    const hojita = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4).scale(0.5, 1, 0.2), brillo(WEAPONS.semillas.color));
    hojita.position.set(0.05, 0.14, 0);
    hojita.rotation.z = -0.6;
    t.add(hojita);
    halo(t, '#fff2a8', 0.8, 0, 0, 0, 0.7);
    this.plantillas.set('semilla', t);
    return t;
  }

  private plantillaZarza() {
    let t = this.plantillas.get('zarza');
    if (t) return t;
    t = conDetalle(0.45, () => {
      const g = new THREE.Group();
      // Tallos de bloques verdes con espinas, de un metro de radio (luego se escala).
      const tallos: [number, number, number, number][] = [
        [0, 0, 1.0, 0], [0.45, 0.2, 0.75, 0.3], [-0.4, 0.3, 0.8, -0.35], [0.25, -0.45, 0.65, 0.25],
        [-0.3, -0.4, 0.7, -0.2], [0.6, -0.15, 0.55, 0.45], [-0.62, -0.05, 0.6, -0.5],
      ];
      tallos.forEach(([x, z, alto, inclina], k) => {
        const tallo = new THREE.Group();
        tallo.position.set(x, 0, z);
        tallo.rotation.set(inclina * 0.6, k * 1.3, inclina);
        g.add(tallo);
        pieza(tallo, caja(0.12, alto, 0.12, 0.03), toon(k % 2 ? '#3f9a4a' : '#2f7d3c'), 0, alto / 2, 0, { nombre: 'verde' });
        for (const [y, lado] of [[0.35, 1], [0.6, -1]] as const) {
          if (y > alto) continue;
          const e = pieza(tallo, punta(0.04, 0.14, 4), toon('#1f5a2a'), 0.08 * lado, alto * y, 0, { contorno: false, nombre: 'verde' });
          e.rotation.z = -lado * 1.2;
        }
        if (k % 2 === 0) {
          const flor = pieza(tallo, caja(0.16, 0.08, 0.16, 0.03), toon('#ffd23a'), 0, alto + 0.03, 0, { nombre: 'flor' });
          flor.rotation.y = 0.78;
          pieza(tallo, caja(0.07, 0.06, 0.07, 0.02), toon('#fff4d6'), 0, alto + 0.08, 0, { contorno: false, nombre: 'flor' });
        }
      });
      return g;
    });
    this.plantillas.set('zarza', t);
    return t;
  }

  private sembrar(px: number, pz: number, s: WeaponLevel, d: number, mods: Mods) {
    // Semillas a enemigos al azar a tiro (cada una a uno distinto).
    const alcance = ALCANCE_SEMILLAS * mods.area;
    const cerca: number[] = [];
    this.enemies.forEachInRadius(px, pz, alcance, (i) => { cerca.push(i); });
    const jefes = this.golpes.extras().filter((o) => o.activo && Math.hypot(o.x - px, o.z - pz) <= alcance + o.radio);
    if (!cerca.length && !jefes.length) return;
    for (let n = 0; n < s.count; n++) {
      let x: number, z: number;
      if (cerca.length) {
        const [i] = cerca.splice(Math.floor(Math.random() * cerca.length), 1);
        x = this.enemies.x[i]; z = this.enemies.z[i];
      } else {
        const o = jefes[n % jefes.length];
        x = o.x + (Math.random() - 0.5) * o.radio; z = o.z + (Math.random() - 0.5) * o.radio;
      }
      const grupo = this.plantillaSemilla().clone(true);
      const y0 = this.world.heightAt(px, pz) + 1.8;
      grupo.position.set(px, y0, pz);
      this.scene.add(grupo);
      this.semillas.push({ grupo, x0: px, z0: pz, y0, x1: x, z1: z, t: 0, nivel: s, radio: s.area * mods.area, dano: d });
    }
    sfx('semilla');
  }

  private actualizarSemillas(dt: number) {
    for (let k = this.semillas.length - 1; k >= 0; k--) {
      const p = this.semillas[k];
      p.t += dt;
      const f = Math.min(1, p.t / VUELO_SEMILLA);
      const x = p.x0 + (p.x1 - p.x0) * f, z = p.z0 + (p.z1 - p.z0) * f;
      const suelo = this.world.heightAt(x, z);
      p.grupo.position.set(x, p.y0 + (suelo - p.y0) * f + Math.sin(f * Math.PI) * 3, z);
      p.grupo.rotation.z += dt * 10;
      if (f < 1) continue;
      this.scene.remove(p.grupo);
      this.semillas.splice(k, 1);
      this.brotar(p.x1, p.z1, p);
    }
  }

  private brotar(x: number, z: number, p: Semilla) {
    const y = this.world.heightAt(x, z);
    const grupo = this.plantillaZarza().clone(true);
    grupo.position.set(x, y, z);
    grupo.rotation.y = Math.random() * Math.PI * 2;
    grupo.scale.setScalar(0.01);
    this.scene.add(grupo);
    const aro = new THREE.Mesh(this.geoAro, new THREE.MeshBasicMaterial({
      color: WEAPONS.semillas.color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    aro.position.set(x, y + 0.06, z);
    aro.scale.setScalar(p.radio);
    this.scene.add(aro);
    const total = p.nivel.duration ?? 3;
    this.zarzas.push({ grupo, aro, x, z, radio: p.radio, dano: p.dano, cada: p.nivel.rate ?? 0.5, tic: 0, vida: total, total, seca: false });
    this.efectos.anillo(x, y, z, { color: '#c8ff9a', duracion: 0.35, desde: 0.3, hasta: p.radio * 1.1 });
    this.efectos.chispa(x, y + 0.3, z, { color: '#fff2a8', duracion: 0.25, desde: 0.2, hasta: 0.8, opacidad: 0.6 });
  }

  private actualizarZarzas(dt: number) {
    for (let k = this.zarzas.length - 1; k >= 0; k--) {
      const z = this.zarzas[k];
      z.vida -= dt;
      z.tic -= dt;
      const edad = z.total - z.vida;
      // Brota con un rebote, aguanta y al final se seca y se encoge.
      const crece = Math.min(1, edad / 0.3);
      const brote = crece < 1 ? crece * 1.15 : 1 + Math.sin(Math.min(1, (edad - 0.3) / 0.2) * Math.PI) * 0.08;
      const fin = Math.min(1, Math.max(0, z.vida) / 0.35);
      // Se abre con el radio, pero no crece en alto: es una zarza, no un árbol.
      const tam = brote * fin + 0.001;
      z.grupo.scale.set(z.radio * 0.62 * tam, 0.85 * tam, z.radio * 0.62 * tam);
      if (!z.seca && z.vida < z.total * 0.3) {
        z.seca = true;
        z.grupo.traverse((o) => {
          if (o instanceof THREE.Mesh && !o.userData.contorno) o.material = toon(o.name === 'flor' ? '#c9a24a' : '#8a7a3a');
        });
      }
      (z.aro.material as THREE.MeshBasicMaterial).opacity = 0.35 * fin;
      if (z.tic <= 0 && z.vida > 0) {
        z.tic = z.cada;
        this.enemies.forEachInRadius(z.x, z.z, z.radio, (i) => {
          this.golpes.enemigo('semillas', i, z.dano, z.x, z.z, 0);
          this.enemies.slow[i] = Math.max(this.enemies.slow[i], 0.6);
          this.enemies.slowFactor[i] = Math.min(this.enemies.slowFactor[i], 0.6);
        });
        for (const o of this.golpes.extras()) {
          if (o.activo && Math.hypot(o.x - z.x, o.z - z.z) <= z.radio + o.radio) this.golpes.extra('semillas', o, z.dano);
        }
      }
      if (z.vida <= 0) {
        this.scene.remove(z.grupo, z.aro);
        (z.aro.material as THREE.Material).dispose();
        this.zarzas.splice(k, 1);
      }
    }
  }

  // ------------------------------------------------------------ bucle

  update(dt: number, px: number, pz: number, mods: Mods, sobrecarga: boolean, torreta: WeaponLevel | null, danoTorreta: number) {
    this.tiempo += dt;
    this.actualizarTorretas(dt, torreta, mods, sobrecarga, danoTorreta);
    this.actualizarLlave(dt, px, pz);
    this.actualizarSellos(dt);
    this.dibujarMarcas();
    this.actualizarDiscos(dt, px, pz);
    this.actualizarSemillas(dt);
    this.actualizarZarzas(dt);
    this.efectos.update(dt);
  }

  dispose() {
    while (this.torretas.length) this.retirar(0);
    for (const b of this.barridos) { this.scene.remove(b.grupo); b.sector.dispose(); b.hojaMat.dispose(); }
    for (const p of this.sellos) this.scene.remove(p.grupo);
    for (const c of this.discos) this.scene.remove(c.grupo);
    for (const p of this.semillas) this.scene.remove(p.grupo);
    for (const z of this.zarzas) { this.scene.remove(z.grupo, z.aro); (z.aro.material as THREE.Material).dispose(); }
    this.barridos = [];
    this.pendientes = [];
    this.sellos = [];
    this.discos = [];
    this.semillas = [];
    this.zarzas = [];
    this.scene.remove(this.marcas, this.estela);
    this.efectos.dispose();
  }
}
