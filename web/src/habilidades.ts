import * as THREE from 'three';
import type { Enemies } from './enemies.ts';
import type { World } from './world.ts';
import type { Weapons } from './weapons.ts';
import type { ObjetivoCombate } from './contenido-juego.ts';
import type { PersonajeDef } from './personajes.ts';
import type { Sound } from './audio.ts';
import { PALETA, brillo, caja, toon } from './modelos/kit.ts';

// Habilidades características (tecla R) de los cinco operadores. Cada una es
// una clase con `usar`, `update` y `dispose`; la recarga la lleva la base.
//   · Sobrecarga de red (Mara): 6 s de herramientas un 40 % más rápidas,
//     torretas a doble cadencia y una torreta extra al instante.
//   · Muro de chatarra (Idris): semicírculo de placas que frena a la horda
//     6 s y estalla al final (60 de daño a 4 m del muro).
//   · Orden de apagado (Noa): onda de 14 m que aturde a HELIOS 2,5 s (a los
//     jefes, 1 s) y hace estallar cada marca (40 de daño en 3 m).
//   · Salto de señal (Taro): 12 m hacia donde mira la cámara; deja un eco de
//     estática que atrae a la horda 3 s y estalla (50 de daño en 5 m).
//   · Jardín de sol (Amara): 9 m durante 8 s; ella se cura 6/s y la horda va
//     un 50 % más lenta y recibe 10/s.

export interface ContextoHabilidad {
  escena: THREE.Scene;
  mundo: World;
  enemigos: Enemies;
  armas: Weapons;
  objetivoJefe: () => ObjetivoCombate[];
  /** El modelo del jugador (el eco de Taro es una copia suya). */
  modelo: THREE.Object3D;
  posicion: THREE.Vector3;
  rumbo: number;
  yawCamara: number;
  curar: (cantidad: number) => void;
  moverA: (x: number, z: number) => void;
  hacerIntocable: (segundos: number) => void;
  aturdirJefes: (x: number, z: number, radio: number, segundos: number) => void;
  alerta: (texto: string) => void;
  sacudida: () => void;
  sfx: (nombre: Sound) => void;
}

export interface Habilidad {
  id: string;
  recarga: number;
  /** 0 = recién usada, 1 = lista. */
  lista: number;
  usar(ctx: ContextoHabilidad): boolean;
  update(dt: number, ctx: ContextoHabilidad): void;
  dispose(): void;
}

const TAU = Math.PI * 2;
const frena = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/** Sube pasándose un poco y vuelve (0 → 1 con rebote). */
const rebote = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k < 1 ? 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.18 : 1;
};

abstract class Base implements Habilidad {
  readonly id: string;
  readonly recarga: number;
  lista = 1;
  protected restante = 0;
  protected escena: THREE.Scene;
  private objetos: THREE.Object3D[] = [];
  private materiales: THREE.Material[] = [];
  private geometrias: THREE.BufferGeometry[] = [];

  constructor(id: string, recarga: number, escena: THREE.Scene) {
    this.id = id;
    this.recarga = recarga;
    this.escena = escena;
  }

  usar(ctx: ContextoHabilidad) {
    if (this.restante > 0) return false;
    this.restante = this.recarga;
    this.lista = 0;
    this.activar(ctx);
    return true;
  }

  update(dt: number, ctx: ContextoHabilidad) {
    this.restante = Math.max(0, this.restante - dt);
    this.lista = 1 - this.restante / this.recarga;
    this.actualizar(dt, ctx);
  }

  dispose() {
    for (const o of this.objetos) this.escena.remove(o);
    for (const m of this.materiales) m.dispose();
    for (const g of this.geometrias) g.dispose();
    this.objetos = [];
    this.materiales = [];
    this.geometrias = [];
  }

  protected abstract activar(ctx: ContextoHabilidad): void;
  protected actualizar(_dt: number, _ctx: ContextoHabilidad) {}

  /** Añade a la escena algo que la habilidad tiene que limpiar al acabar la partida. */
  protected poner<T extends THREE.Object3D>(o: T): T {
    this.escena.add(o);
    this.objetos.push(o);
    return o;
  }

  protected quitar(o: THREE.Object3D | null) {
    if (!o) return;
    this.escena.remove(o);
    this.objetos = this.objetos.filter((x) => x !== o);
  }

  /** Material aditivo propio (se puede apagar sin tocar a los demás). */
  protected luz(color: string, opacidad: number, lados: THREE.Side = THREE.DoubleSide) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, side: lados });
    this.materiales.push(m);
    return m;
  }

  protected geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometrias.push(g);
    return g;
  }

  /** Material hecho a mano que también hay que soltar al acabar. */
  protected guardar<T extends THREE.Material>(m: T): T {
    this.materiales.push(m);
    return m;
  }
}

// ------------------------------------------------------------ Mara

/** Sobrecarga de red: aro que late a sus pies, chispas en órbita y enlaces a cada torreta. */
class Sobrecarga extends Base {
  private activa = 0;
  private aro: THREE.Mesh | null = null;
  private aroMat: THREE.MeshBasicMaterial | null = null;
  private chispas: THREE.Group | null = null;
  private enlaces: THREE.Mesh[] = [];
  private enlaceMat: THREE.MeshBasicMaterial | null = null;
  private pulso = 0;
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  private montar() {
    this.aroMat = this.luz('#7566f5', 0.7);
    this.aro = this.poner(new THREE.Mesh(this.geo(new THREE.RingGeometry(0.7, 1, 6).rotateX(-Math.PI / 2)), this.aroMat));
    this.chispas = this.poner(new THREE.Group());
    const g = this.geo(new THREE.OctahedronGeometry(0.11, 0));
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(g, brillo(k % 2 ? PALETA.ada : '#b4a9ff'));
      const a = (k / 8) * TAU;
      m.position.set(Math.sin(a) * 1.7, 0.9 + (k % 3) * 0.45, Math.cos(a) * 1.7);
      this.chispas.add(m);
    }
    this.enlaceMat = this.luz('#b4a9ff', 0.7, THREE.FrontSide);
    const rayo = this.geo(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5));
    for (let k = 0; k < 6; k++) this.enlaces.push(this.poner(new THREE.Mesh(rayo, this.enlaceMat)));
  }

  protected activar(ctx: ContextoHabilidad) {
    if (!this.aro) this.montar();
    this.activa = 6;
    this.pulso = 0;
    const { x, z } = ctx.posicion;
    const y = ctx.mundo.heightAt(x, z);
    ctx.armas.activarSobrecarga(6, x, z);
    const fx = ctx.armas.efectos;
    fx.columna(x, y, z, 7, { color: '#7566f5', duracion: 0.6, desde: 0.4, hasta: 1.6 });
    fx.anillo(x, y, z, { color: '#b4a9ff', duracion: 0.6, desde: 0.5, hasta: 7, grueso: true });
    fx.chispa(x, y + 1.5, z, { color: '#ffffff', duracion: 0.25, desde: 0.4, hasta: 1.6 });
    ctx.alerta('RED SOBRECARGADA');
    ctx.sfx('sobrecarga');
    ctx.sacudida();
  }

  protected actualizar(dt: number, ctx: ContextoHabilidad) {
    if (!this.aro || !this.chispas || !this.aroMat || !this.enlaceMat) return;
    const visible = this.activa > 0;
    this.aro.visible = this.chispas.visible = visible;
    for (const e of this.enlaces) e.visible = false;
    if (!visible) return;
    this.activa -= dt;
    const { x, z } = ctx.posicion;
    const y = ctx.mundo.heightAt(x, z);
    const t = 6 - this.activa;
    // El aro late, gira y se apaga en el último segundo.
    this.aro.position.set(x, y + 0.1, z);
    this.aro.scale.setScalar(2.3 + Math.sin(t * 9) * 0.18);
    this.aro.rotation.y += dt * 1.6;
    this.aroMat.opacity = 0.7 * Math.min(1, this.activa);
    this.chispas.position.set(x, y, z);
    this.chispas.rotation.y += dt * 3.2;
    this.chispas.children.forEach((c, k) => { c.position.y = 0.9 + (k % 3) * 0.45 + Math.sin(t * 6 + k) * 0.15; c.rotation.y += dt * 8; });
    // Enlaces de red de Mara a cada torreta, temblando.
    const torretas = ctx.armas.posicionesTorretas();
    this.enlaceMat.opacity = (0.45 + 0.3 * Math.sin(t * 40)) * Math.min(1, this.activa);
    torretas.slice(0, this.enlaces.length).forEach((p, k) => {
      const e = this.enlaces[k];
      this.v.set(x, y + 1.9, z);
      this.v2.set(p.x, ctx.mundo.heightAt(p.x, p.z) + 0.9, p.z);
      e.position.copy(this.v);
      e.lookAt(this.v2);
      const g = 0.05 + Math.random() * 0.04;
      e.scale.set(g, g, this.v.distanceTo(this.v2));
      e.visible = true;
    });
    this.pulso -= dt;
    if (this.pulso <= 0) {
      this.pulso = 0.5;
      ctx.armas.efectos.anillo(x, y, z, { color: '#7566f5', duracion: 0.5, desde: 1, hasta: 3.2, opacidad: 0.5 });
    }
  }
}

// ------------------------------------------------------------ Idris

const RADIO_MURO = 6;

interface Placa {
  grupo: THREE.Group;
  mallas: THREE.Mesh[];
  colores: THREE.Material[];
  angulo: number;
  retraso: number;
  vx: number; vy: number; vz: number;
  giro: THREE.Vector3;
}

/** Muro de chatarra: placas que suben en ola, frenan a la horda y salen disparadas. */
class MuroChatarra extends Base {
  private vida = 0;
  private vuelo = 0;
  private edad = 0;
  private cx = 0;
  private cz = 0;
  private frente = 0;
  private placas: Placa[] = [];

  protected activar(ctx: ContextoHabilidad) {
    this.limpiar();
    this.vida = 6;
    this.vuelo = 0;
    this.edad = 0;
    this.cx = ctx.posicion.x;
    this.cz = ctx.posicion.z;
    this.frente = ctx.rumbo;
    const n = 11;
    const chapas = ['#8c5a3c', '#6b7385', '#d9822a', '#4a4f62', '#a3a8b8'];
    for (let k = 0; k < n; k++) {
      const angulo = this.frente - Math.PI / 2 + (k / (n - 1)) * Math.PI;
      const grupo = this.poner(new THREE.Group());
      const ancho = 1.55 + Math.random() * 0.4, alto = 1.6 + Math.random() * 0.7;
      const mallas: THREE.Mesh[] = [];
      const color = chapas[k % chapas.length];
      const placa = new THREE.Mesh(caja(ancho, alto, 0.22, 0.05), toon(color));
      placa.position.y = alto / 2;
      placa.rotation.z = (Math.random() - 0.5) * 0.18;
      mallas.push(placa);
      // Refuerzo cruzado, remaches y una tira de peligro en algunas.
      const barra = new THREE.Mesh(caja(ancho * 0.9, 0.14, 0.08, 0.03), toon('#3b3f52'));
      barra.position.set(0, alto * (0.35 + Math.random() * 0.3), 0.13);
      barra.rotation.z = (Math.random() - 0.5) * 0.6;
      mallas.push(barra);
      for (const [rx, ry] of [[-0.4, 0.2], [0.4, 0.2], [-0.4, 0.8], [0.4, 0.8]]) {
        const r = new THREE.Mesh(caja(0.09, 0.09, 0.06, 0.02), toon(PALETA.metal));
        r.position.set(rx * ancho, ry * alto, 0.13);
        mallas.push(r);
      }
      if (k % 3 === 1) {
        const tira = new THREE.Mesh(caja(ancho * 0.8, 0.12, 0.04, 0.02), toon('#ffcf3a'));
        tira.position.set(0, alto * 0.88, 0.12);
        mallas.push(tira);
      }
      for (const m of mallas) { m.castShadow = true; grupo.add(m); }
      const x = this.cx + Math.sin(angulo) * RADIO_MURO, z = this.cz + Math.cos(angulo) * RADIO_MURO;
      grupo.position.set(x, ctx.mundo.heightAt(x, z) - 2.6, z);
      grupo.rotation.y = angulo;
      const centro = (n - 1) / 2;
      this.placas.push({
        grupo, mallas, colores: mallas.map((m) => m.material as THREE.Material), angulo,
        retraso: Math.abs(k - centro) * 0.045, vx: 0, vy: 0, vz: 0, giro: new THREE.Vector3(),
      });
    }
    ctx.alerta('MURO DE CHATARRA');
    ctx.sfx('muro');
    ctx.sacudida();
  }

  /** Distancia de (x, z) al arco del muro: radial dentro del semicírculo, a la punta fuera de él. */
  private distanciaAlMuro(x: number, z: number) {
    const dx = x - this.cx, dz = z - this.cz, d = Math.hypot(dx, dz);
    let dif = Math.atan2(dx, dz) - this.frente;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    if (Math.abs(dif) <= Math.PI / 2) return Math.abs(d - RADIO_MURO);
    const a = this.frente + Math.sign(dif) * Math.PI / 2;
    return Math.hypot(x - (this.cx + Math.sin(a) * RADIO_MURO), z - (this.cz + Math.cos(a) * RADIO_MURO));
  }

  protected actualizar(dt: number, ctx: ContextoHabilidad) {
    if (this.vida > 0) {
      this.vida -= dt;
      this.edad += dt;
      // Suben en ola desde el centro, con polvo al asomar.
      for (const p of this.placas) {
        const t = (this.edad - p.retraso) / 0.32;
        const suelo = ctx.mundo.heightAt(p.grupo.position.x, p.grupo.position.z);
        const antes = p.grupo.position.y;
        p.grupo.position.y = suelo - 2.6 + 2.6 * rebote(t);
        if (antes < suelo - 2 && p.grupo.position.y >= suelo - 2) {
          ctx.armas.efectos.anillo(p.grupo.position.x, suelo, p.grupo.position.z, { color: '#c9a77a', duracion: 0.5, desde: 0.4, hasta: 1.8, opacidad: 0.5 });
        }
        // Avisa en el último segundo: parpadea al rojo vivo.
        const aviso = this.vida < 1 && Math.sin(this.vida * 30) > 0;
        p.mallas.forEach((m, k) => { m.material = aviso && k === 0 ? brillo('#ffb347') : p.colores[k]; });
      }
      // Ni lo atraviesan ni lo saltan: se quedan del lado por el que llegaron.
      const e = ctx.enemigos;
      e.forEachInRadius(this.cx, this.cz, RADIO_MURO + 1.6, (i) => {
        const dx = e.x[i] - this.cx, dz = e.z[i] - this.cz, d = Math.hypot(dx, dz) || 1;
        if (d < RADIO_MURO - 1.4) return;
        let dif = Math.atan2(dx, dz) - this.frente;
        dif = Math.atan2(Math.sin(dif), Math.cos(dif));
        if (Math.abs(dif) > Math.PI / 2 + 0.12) return;
        const r = e.defOf(i).radius;
        const fuera = d >= RADIO_MURO;
        const limite = fuera ? RADIO_MURO + 0.35 + r : RADIO_MURO - 0.35 - r;
        if (fuera ? d < limite : d > limite) {
          e.x[i] = this.cx + dx / d * limite;
          e.z[i] = this.cz + dz / d * limite;
          e.pushX[i] *= 0.2;
          e.pushZ[i] *= 0.2;
        }
      });
      if (this.vida <= 0) this.estallar(ctx);
      return;
    }
    if (this.vuelo <= 0) return;
    // Las placas salen disparadas, giran, caen y se encogen.
    this.vuelo -= dt;
    for (const p of this.placas) {
      p.vy -= 20 * dt;
      p.grupo.position.x += p.vx * dt;
      p.grupo.position.y += p.vy * dt;
      p.grupo.position.z += p.vz * dt;
      p.grupo.rotation.x += p.giro.x * dt;
      p.grupo.rotation.z += p.giro.z * dt;
      p.grupo.scale.setScalar(Math.max(0.01, Math.min(1, this.vuelo / 0.35)));
    }
    if (this.vuelo <= 0) this.limpiar();
  }

  private estallar(ctx: ContextoHabilidad) {
    this.vuelo = 1.1;
    const fx = ctx.armas.efectos;
    const y = ctx.mundo.heightAt(this.cx, this.cz);
    for (const p of this.placas) {
      const v = 8 + Math.random() * 4;
      p.vx = Math.sin(p.angulo) * v;
      p.vz = Math.cos(p.angulo) * v;
      p.vy = 6 + Math.random() * 4;
      p.giro.set((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14);
      p.mallas.forEach((m, k) => { m.material = p.colores[k]; });
      const { x, z } = p.grupo.position;
      fx.chispa(x, p.grupo.position.y + 1, z, { color: '#ffb347', duracion: 0.35, desde: 0.5, hasta: 2.2 });
      fx.anillo(x, ctx.mundo.heightAt(x, z), z, { color: '#ff8a3d', duracion: 0.5, desde: 0.5, hasta: 4, grueso: true });
    }
    fx.anillo(this.cx, y, this.cz, { color: '#ffcf74', duracion: 0.6, desde: RADIO_MURO - 1, hasta: RADIO_MURO + 4.5, grueso: true });
    ctx.armas.danoHabilidad(this.cx, this.cz, RADIO_MURO + 4, 60, 1.6, (i) => this.distanciaAlMuro(ctx.enemigos.x[i], ctx.enemigos.z[i]) <= 4);
    ctx.sfx('boom');
    ctx.sacudida();
  }

  private limpiar() {
    for (const p of this.placas) {
      this.quitar(p.grupo);
      for (const m of p.mallas) m.geometry.dispose();
    }
    this.placas = [];
  }

  dispose() {
    this.limpiar();
    super.dispose();
  }
}

// ------------------------------------------------------------ Noa

const RADIO_APAGADO = 14;

/** Orden de apagado: onda magenta que aturde y hace estallar cada marca cuando la alcanza. */
class OrdenApagado extends Base {
  private pendientes: { semilla: number; t: number }[] = [];

  protected activar(ctx: ContextoHabilidad) {
    const { x, z } = ctx.posicion;
    const y = ctx.mundo.heightAt(x, z);
    const fx = ctx.armas.efectos;
    fx.anillo(x, y, z, { color: '#e151a5', duracion: 0.5, desde: 0.3, hasta: RADIO_APAGADO, grueso: true });
    fx.anillo(x, y, z, { color: '#ffe3f3', duracion: 0.7, desde: 0.3, hasta: RADIO_APAGADO + 0.6, opacidad: 0.6 });
    fx.disco(x, y, z, { color: '#e151a5', duracion: 0.6, desde: RADIO_APAGADO * 0.4, hasta: RADIO_APAGADO, opacidad: 0.22 });
    fx.columna(x, y, z, 9, { color: '#e151a5', duracion: 0.5, desde: 0.5, hasta: 2.2 });
    fx.hexagono(x, y, z, { color: '#ffd1ea', duracion: 0.8, desde: 1, hasta: 5 });
    const e = ctx.enemigos;
    e.forEachInRadius(x, z, RADIO_APAGADO, (i) => {
      e.aturdido[i] = 2.5;
      // Cada marca estalla cuando le llega la onda.
      if (e.marca[i] > 0) this.pendientes.push({ semilla: e.seed[i], t: Math.hypot(e.x[i] - x, e.z[i] - z) / RADIO_APAGADO * 0.45 });
    });
    ctx.aturdirJefes(x, z, RADIO_APAGADO, 1);
    ctx.alerta('ORDEN DE APAGADO');
    ctx.sfx('apagado');
    ctx.sacudida();
  }

  protected actualizar(dt: number, ctx: ContextoHabilidad) {
    if (!this.pendientes.length) return;
    const e = ctx.enemigos;
    for (let k = this.pendientes.length - 1; k >= 0; k--) {
      const p = this.pendientes[k];
      p.t -= dt;
      if (p.t > 0) continue;
      this.pendientes.splice(k, 1);
      let i = -1;
      for (let j = 0; j < e.count; j++) if (e.seed[j] === p.semilla && e.hp[j] > 0) { i = j; break; }
      if (i < 0 || e.marca[i] <= 0) continue;
      e.marca[i] = 0;
      const x = e.x[i], z = e.z[i], y = ctx.mundo.heightAt(x, z);
      ctx.armas.danoHabilidad(x, z, 3, 40, 0.8);
      const fx = ctx.armas.efectos;
      fx.hexagono(x, y, z, { color: '#e151a5', duracion: 0.45, desde: 0.4, hasta: 3.2 });
      fx.chispa(x, y + 1.1, z, { color: '#ffd1ea', duracion: 0.25, desde: 0.4, hasta: 1.5 });
      fx.columna(x, y, z, 3, { color: '#e151a5', duracion: 0.3, desde: 0.3, hasta: 0.9 });
      ctx.sfx('sello');
    }
  }
}

// ------------------------------------------------------------ Taro

const SALTO = 12;
/** Cuándo ocurre el salto dentro del clip `Habilidad` (cuando desaparece). */
const SALTO_EN = 0.38;
const VIDA_ECO = 3;

/** Salto de señal: se desvanece, reaparece 12 m más allá y deja un eco holográfico que atrae y estalla. */
class SaltoSenal extends Base {
  private saltoEn = 0;
  private ox = 0;
  private oz = 0;
  private dx = 0;
  private dz = 0;
  private eco: THREE.Object3D | null = null;
  private ecoVida = 0;
  private holo: THREE.MeshBasicMaterial | null = null;
  private anillos: THREE.Group | null = null;
  private latido = 0;

  protected activar(ctx: ContextoHabilidad) {
    this.ox = ctx.posicion.x;
    this.oz = ctx.posicion.z;
    // Avanza en pasos de 1 m: así no atraviesa una pared aunque el final esté libre.
    const fx = -Math.sin(ctx.yawCamara), fz = -Math.cos(ctx.yawCamara);
    let p = { x: this.ox, z: this.oz };
    for (let d = 1; d <= SALTO; d++) {
      const ix = this.ox + fx * d, iz = this.oz + fz * d;
      const siguiente = ctx.mundo.resolve(ix, iz, 0.4, { x: p.x, z: p.z });
      if (Math.hypot(siguiente.x - ix, siguiente.z - iz) > 0.25) break;
      p = siguiente;
    }
    this.dx = p.x;
    this.dz = p.z;
    this.saltoEn = SALTO_EN;
    ctx.hacerIntocable(SALTO_EN + 0.5);

    // El eco: una copia de Taro en holograma de estática, quieta en su última pose.
    this.quitar(this.eco);
    if (!this.holo) this.holo = this.luz('#b8ff6a', 0.5, THREE.FrontSide);
    const eco = ctx.modelo.clone(true);
    eco.traverse((o) => {
      if (o instanceof THREE.Sprite) o.visible = false;
      else if (o instanceof THREE.Mesh) {
        if (o.userData.contorno) o.visible = false;
        else o.material = this.holo!;
      }
    });
    eco.visible = false;
    this.eco = this.poner(eco);
    if (!this.anillos) {
      this.anillos = this.poner(new THREE.Group());
      const g = this.geo(new THREE.TorusGeometry(0.85, 0.035, 4, 28));
      for (let k = 0; k < 3; k++) {
        const a = new THREE.Mesh(g, this.holo);
        a.rotation.set(Math.PI / 2 + (k - 1) * 0.5, k * 0.9, 0);
        a.position.y = 0.5 + k * 0.45;
        this.anillos.add(a);
      }
    }
    this.anillos.visible = false;
    const y = ctx.mundo.heightAt(this.ox, this.oz);
    ctx.armas.efectos.anillo(this.ox, y, this.oz, { color: '#9bdc3c', duracion: 0.4, desde: 0.3, hasta: 1.6 });
    ctx.sfx('salto');
  }

  protected actualizar(dt: number, ctx: ContextoHabilidad) {
    const fx = ctx.armas.efectos;
    if (this.saltoEn > 0) {
      this.saltoEn -= dt;
      if (this.saltoEn <= 0) {
        // ¡Zas! Raya de señal del origen al destino y el eco que se enciende.
        const y0 = ctx.mundo.heightAt(this.ox, this.oz), y1 = ctx.mundo.heightAt(this.dx, this.dz);
        ctx.moverA(this.dx, this.dz);
        const a = new THREE.Vector3(this.ox, y0 + 1.1, this.oz), b = new THREE.Vector3(this.dx, y1 + 1.1, this.dz);
        fx.rayo(a, b, 0.45, { color: '#9bdc3c', duracion: 0.35 });
        fx.rayo(a, b, 0.12, { color: '#ffffff', duracion: 0.25 });
        fx.chispa(this.dx, y1 + 1, this.dz, { color: '#d9ff9e', duracion: 0.3, desde: 0.4, hasta: 1.8 });
        fx.anillo(this.dx, y1, this.dz, { color: '#9bdc3c', duracion: 0.45, desde: 0.4, hasta: 3, grueso: true });
        if (this.eco) {
          this.eco.position.set(this.ox, y0, this.oz);
          this.eco.visible = true;
        }
        this.ecoVida = VIDA_ECO;
        this.latido = 0;
        ctx.enemigos.atraer(this.ox, this.oz, VIDA_ECO);
        ctx.sacudida();
      }
      return;
    }
    if (this.ecoVida <= 0 || !this.eco || !this.holo || !this.anillos) return;
    this.ecoVida -= dt;
    // Parpadea como una señal mala y tiembla; cada poco suelta un pulso que llama a la horda.
    const t = VIDA_ECO - this.ecoVida;
    this.holo.opacity = 0.32 + 0.22 * Math.sin(t * 47) * Math.sin(t * 13) + (Math.random() < 0.06 ? 0.3 : 0);
    this.eco.position.x = this.ox + (Math.random() - 0.5) * 0.06;
    this.eco.scale.set(1 + Math.sin(t * 60) * 0.03, 1, 1);
    this.anillos.visible = true;
    this.anillos.position.set(this.ox, ctx.mundo.heightAt(this.ox, this.oz), this.oz);
    this.anillos.rotation.y += dt * 4;
    this.anillos.scale.setScalar(1 + Math.max(0, 1 - this.ecoVida) * 0.6);
    this.latido -= dt;
    if (this.latido <= 0) {
      this.latido = this.ecoVida < 1 ? 0.15 : 0.4;
      fx.anillo(this.ox, ctx.mundo.heightAt(this.ox, this.oz), this.oz, { color: '#9bdc3c', duracion: 0.5, desde: 0.6, hasta: 4, opacidad: 0.45 });
    }
    if (this.ecoVida > 0) return;
    const y = ctx.mundo.heightAt(this.ox, this.oz);
    ctx.armas.danoHabilidad(this.ox, this.oz, 5, 50, 1.2);
    fx.anillo(this.ox, y, this.oz, { color: '#9bdc3c', duracion: 0.5, desde: 0.5, hasta: 5.5, grueso: true });
    fx.chispa(this.ox, y + 1.1, this.oz, { color: '#eaffd0', duracion: 0.35, desde: 0.6, hasta: 3 });
    fx.columna(this.ox, y, this.oz, 5, { color: '#9bdc3c', duracion: 0.4, desde: 0.6, hasta: 1.8 });
    ctx.sfx('boom');
    ctx.sacudida();
    this.eco.visible = false;
    this.anillos.visible = false;
  }
}

// ------------------------------------------------------------ Amara

const RADIO_JARDIN = 9;
const VIDA_JARDIN = 8;
const FLORES = 56;
const POLEN = 32;

/** Degradado radial para el suelo del jardín: luz cálida en el centro que se funde en el borde. */
function texturaJardin() {
  const n = 64;
  const datos = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
    const k = (y * n + x) * 4;
    const borde = Math.max(0, 1 - Math.abs(d - 0.93) * 14);
    datos[k] = 255 * (0.9 - d * 0.5) + borde * 40;
    datos[k + 1] = 255 * (0.9 - d * 0.15);
    datos[k + 2] = 255 * (0.45 - d * 0.3);
    datos[k + 3] = 255 * Math.min(1, Math.max(0, (1 - d) * 0.9 + borde));
  }
  const t = new THREE.DataTexture(datos, n, n);
  t.needsUpdate = true;
  return t;
}

/** Jardín de sol: prado de luz cálida donde brotan flores, sube polen y caen rayos de sol. */
class JardinSol extends Base {
  private vida = 0;
  private x = 0;
  private z = 0;
  private tic = 0;
  private brillo = 0;
  private grupo: THREE.Group | null = null;
  private sueloMat: THREE.MeshBasicMaterial | null = null;
  private rayosMat: THREE.MeshBasicMaterial | null = null;
  private flores: THREE.InstancedMesh | null = null;
  private polen: THREE.InstancedMesh | null = null;
  private sitios: { x: number; z: number; retraso: number; giro: number; tam: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private eje = new THREE.Vector3(0, 1, 0);

  private montar() {
    const grupo = this.poner(new THREE.Group());
    this.grupo = grupo;
    const tex = texturaJardin();
    this.sueloMat = this.guardar(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const suelo = new THREE.Mesh(this.geo(new THREE.CircleGeometry(RADIO_JARDIN, 48).rotateX(-Math.PI / 2)), this.sueloMat);
    suelo.position.y = 0.07;
    grupo.add(suelo);
    // Rayos de sol: columnas de luz que giran despacio.
    this.rayosMat = this.luz('#fff1a8', 0);
    const rayo = this.geo(new THREE.CylinderGeometry(0.55, 0.95, 9, 12, 1, true).translate(0, 4.5, 0));
    for (let k = 0; k < 4; k++) {
      const r = new THREE.Mesh(rayo, this.rayosMat);
      const a = (k / 4) * TAU + 0.4;
      r.position.set(Math.sin(a) * 4.5, 0, Math.cos(a) * 4.5);
      r.rotation.set(0.12 * Math.sin(a), 0, 0.12 * Math.cos(a));
      grupo.add(r);
    }
    // Flores: tallo y corola en una sola geometría, con color por flor.
    const tallo = new THREE.BoxGeometry(0.05, 0.42, 0.05).translate(0, 0.21, 0);
    const corola = new THREE.OctahedronGeometry(0.16, 0).scale(1, 0.55, 1).translate(0, 0.46, 0);
    const hojas = new THREE.OctahedronGeometry(0.12, 0).scale(1.4, 0.2, 0.5).translate(0.1, 0.16, 0);
    const flor = this.geo(mergeSimple([tallo, corola, hojas]));
    this.flores = new THREE.InstancedMesh(flor, this.guardar(new THREE.MeshBasicMaterial({ color: '#ffffff' })), FLORES);
    this.flores.frustumCulled = false;
    const colores = ['#ffe066', '#ff8fb8', '#ffffff', '#ffb347', '#c9a8ff'];
    for (let k = 0; k < FLORES; k++) {
      // Reparto uniforme en el círculo; la semilla de cada flor es fija.
      const r = Math.sqrt((k + 0.5) / FLORES) * (RADIO_JARDIN - 0.6), a = k * 2.399963;
      this.sitios.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, retraso: (k % 9) * 0.11 + r * 0.05, giro: a, tam: 1.2 + ((k * 37) % 10) / 14 });
      this.flores.setColorAt(k, new THREE.Color(colores[k % colores.length]));
    }
    grupo.add(this.flores);
    this.polen = new THREE.InstancedMesh(this.geo(new THREE.OctahedronGeometry(0.07, 0)), this.luz('#fff2a8', 0.9, THREE.FrontSide), POLEN);
    this.polen.frustumCulled = false;
    grupo.add(this.polen);
  }

  protected activar(ctx: ContextoHabilidad) {
    if (!this.grupo) this.montar();
    this.vida = VIDA_JARDIN;
    this.tic = 0;
    this.brillo = 0;
    this.x = ctx.posicion.x;
    this.z = ctx.posicion.z;
    const y = ctx.mundo.heightAt(this.x, this.z);
    this.grupo!.position.set(this.x, y, this.z);
    this.grupo!.visible = true;
    const fx = ctx.armas.efectos;
    fx.anillo(this.x, y, this.z, { color: '#c8ff9a', duracion: 0.7, desde: 0.5, hasta: RADIO_JARDIN, grueso: true });
    fx.columna(this.x, y, this.z, 6, { color: '#fff1a8', duracion: 0.6, desde: 0.5, hasta: 2 });
    ctx.alerta('JARDÍN DE SOL');
    ctx.sfx('jardin');
  }

  protected actualizar(dt: number, ctx: ContextoHabilidad) {
    if (!this.grupo || !this.flores || !this.polen || !this.sueloMat || !this.rayosMat) return;
    if (this.vida <= 0) { this.grupo.visible = false; return; }
    this.vida -= dt;
    this.tic -= dt;
    const edad = VIDA_JARDIN - this.vida;
    const aparece = frena(edad / 0.5), apaga = Math.min(1, Math.max(0, this.vida) / 0.8);
    this.sueloMat.opacity = 0.55 * aparece * apaga;
    this.rayosMat.opacity = 0.05 * aparece * apaga * (0.8 + 0.2 * Math.sin(edad * 2));
    this.grupo.rotation.y = edad * 0.05;

    // Las flores brotan con rebote, se mecen y al final se cierran.
    this.sitios.forEach((p, k) => {
      const k1 = rebote((edad - p.retraso) / 0.45) * apaga * p.tam;
      this.v.set(p.x, ctx.mundo.heightAt(this.x + p.x, this.z + p.z) - this.grupo!.position.y, p.z);
      this.q.setFromAxisAngle(this.eje, p.giro + Math.sin(edad * 2 + k) * 0.3);
      this.s.set(k1, k1 * (0.9 + 0.1 * Math.sin(edad * 3 + k)), k1);
      this.m.compose(this.v, this.q, this.s);
      this.flores!.setMatrixAt(k, this.m);
    });
    this.flores.instanceMatrix.needsUpdate = true;
    for (let k = 0; k < POLEN; k++) {
      const a = k * 2.4 + edad * 0.3, r = ((k * 53) % 17) / 17 * RADIO_JARDIN * 0.9;
      const sube = ((edad * 0.45 + k / POLEN) % 1);
      this.v.set(Math.sin(a) * r, 0.3 + sube * 4, Math.cos(a) * r);
      this.s.setScalar(Math.sin(sube * Math.PI) * aparece * apaga + 0.001);
      this.m.compose(this.v, this.q.identity(), this.s);
      this.polen.setMatrixAt(k, this.m);
    }
    this.polen.instanceMatrix.needsUpdate = true;

    // Dentro: ella se cura y la horda va más lenta y se quema al sol.
    if (Math.hypot(ctx.posicion.x - this.x, ctx.posicion.z - this.z) <= RADIO_JARDIN) {
      ctx.curar(6 * dt);
      this.brillo -= dt;
      if (this.brillo <= 0) {
        this.brillo = 0.45;
        const { x, z } = ctx.posicion;
        ctx.armas.efectos.chispa(x + (Math.random() - 0.5), ctx.mundo.heightAt(x, z) + 1 + Math.random(), z + (Math.random() - 0.5), { color: '#8dffb0', duracion: 0.5, desde: 0.2, hasta: 0.05 });
      }
    }
    ctx.enemigos.forEachInRadius(this.x, this.z, RADIO_JARDIN, (i) => {
      ctx.enemigos.slow[i] = Math.max(ctx.enemigos.slow[i], 0.25);
      ctx.enemigos.slowFactor[i] = Math.min(ctx.enemigos.slowFactor[i], 0.5);
    });
    if (this.tic <= 0) {
      this.tic = 1;
      ctx.armas.danoHabilidad(this.x, this.z, RADIO_JARDIN, 10, 0);
    }
    if (this.vida <= 0) this.grupo.visible = false;
  }
}

/** Une geometrías sin índice (tallo, corola y hojas de las flores). */
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const planas = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = planas.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of planas) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

export function crearHabilidad(personaje: PersonajeDef, escena: THREE.Scene): Habilidad | null {
  const h = personaje.habilidad;
  if (!h) return null;
  switch (h.id) {
    case 'sobrecarga-red': return new Sobrecarga(h.id, h.recarga, escena);
    case 'muro-chatarra': return new MuroChatarra(h.id, h.recarga, escena);
    case 'orden-apagado': return new OrdenApagado(h.id, h.recarga, escena);
    case 'salto-senal': return new SaltoSenal(h.id, h.recarga, escena);
    case 'jardin-sol': return new JardinSol(h.id, h.recarga, escena);
    default: return null;
  }
}
