import * as THREE from 'three';
import type { World } from './world.ts';
import { crearGolem, TIEMPOS_GOLEM } from './modelos/golem.ts';
import { crearSabueso, TIEMPOS_ALIENTO } from './modelos/sabueso.ts';
import { halo, texturaHalo } from './modelos/brillo.ts';
import { AvisosSuelo, type Aviso } from './avisos.ts';
import { ATAQUES_GOLEM, type AtaqueGolem, type DefGolem } from './contenido/mapa.ts';

// Jefe gólem: camina hacia el jugador y elige ataques que se ven venir. Cada
// ataque pinta su aviso en el suelo (pegado al relieve) y pide un letrero al
// HUD; quien se queda dentro recibe el golpe y sale despedido. Los ataques
// se sincronizan con los clips de golem.ts (TIEMPOS_GOLEM): el aviso se
// llena hasta el instante del golpe.
//
// Como en los jefes de los juegos de almas, el pisotón y el salto a veces se
// quedan arriba un instante más (`retraso`): quien esquiva antes de tiempo,
// cobra.

export interface EventosGolem {
  /** Empuja al jugador (m/s) y, si `salto` > 0, lo levanta del suelo. */
  empujar?: (fx: number, fz: number, salto: number) => void;
  /** Letrero de aviso en el HUD. */
  aviso?: (texto: string) => void;
  sacudida?: () => void;
  sonido?: (nombre: 'boom' | 'solar' | 'pulse') => void;
}

export interface JugadorGolem {
  x: number;
  z: number;
  /** Velocidad del jugador: el gólem apunta adonde va a estar. */
  vx: number;
  vz: number;
  dt: number;
}

interface Ataque {
  tipo: AtaqueGolem | 'furia';
  /** Tiempo del clip (no avanza mientras el gólem aguanta arriba). */
  tc: number;
  retraso: number;
  retenido: number;
  hecho: boolean;
  aviso: Aviso | null;
  cx: number;
  cz: number;
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  largo: number;
  recorrido: number;
  corriendo: boolean;
}

interface Proyectil {
  tipo: 'roca' | 'caida';
  mesh: THREE.Mesh;
  aviso: Aviso;
  x0: number; y0: number; z0: number;
  x1: number; z1: number;
  t: number;
  dur: number;
  radio: number;
  dano: number;
  empuje: number;
}

const VELOCIDAD_EMBESTIDA = 27;
const COLORES_ROCA: Record<DefGolem['variante'], string> = { escoria: '#6e5c50', escarcha: '#cfe6f5', titan: '#3a3d52', sabueso: '#ff8a2a' };
/** Mitad del ángulo del cono del aliento. */
const MEDIO_CONO = THREE.MathUtils.degToRad(28);
const ASCUAS = 70;

export class JefeGolem {
  readonly def: DefGolem;
  vida: number;
  x: number;
  z: number;
  furia = false;
  derrotado = false;
  /** El clip de derrota ha acabado: el altar puede dar la recompensa. */
  terminado = false;

  private raiz: THREE.Group;
  private mixer: THREE.AnimationMixer;
  private acciones = new Map<string, THREE.AnimationAction>();
  private actual = '';
  private giro: number;
  private estado: 'entrada' | 'perseguir' | 'ataque' | 'derrota' = 'entrada';
  private t = 0;
  private descanso = 1;
  private ataque: Ataque | null = null;
  private ultimo: AtaqueGolem | null = null;
  private furiaPendiente = false;
  private proyectiles: Proyectil[] = [];
  private avisos: AvisosSuelo;
  private matRoca: THREE.MeshLambertMaterial;
  // Lo que hace que el jefe alumbre: su luz, las ascuas, el charco bajo los
  // pies, las piezas que laten, las llamas y los chorros del aliento.
  private luz: THREE.PointLight;
  private ascuas: THREE.Points;
  private velAscuas = new Float32Array(ASCUAS);
  private charco: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private latentes: THREE.MeshToonMaterial[] = [];
  private llamas: THREE.Object3D[] = [];
  private alientos: THREE.Object3D[] = [];
  private orbita: THREE.Object3D | null = null;
  private reloj = 0;

  private scene: THREE.Scene;
  private world: World;
  private eventos: EventosGolem;
  private rand: () => number;

  constructor(
    scene: THREE.Scene,
    world: World,
    def: DefGolem,
    x: number,
    z: number,
    giro: number,
    eventos: EventosGolem = {},
    rand: () => number = Math.random,
  ) {
    this.scene = scene;
    this.world = world;
    this.eventos = eventos;
    this.rand = rand;
    this.avisos = new AvisosSuelo(scene, world);
    this.def = def;
    this.vida = def.vida;
    this.x = x;
    this.z = z;
    this.giro = giro;
    const modelo = def.variante === 'sabueso' ? crearSabueso(def.talla) : crearGolem(def.variante, def.talla);
    this.raiz = modelo.raiz;
    this.raiz.position.set(x, world.heightAt(x, z), z);
    this.raiz.rotation.y = giro;
    scene.add(this.raiz);
    this.mixer = new THREE.AnimationMixer(this.raiz);
    for (const a of modelo.animaciones) {
      const accion = this.mixer.clipAction(a.clip);
      if (!a.bucle) {
        accion.setLoop(THREE.LoopOnce, 1);
        accion.clampWhenFinished = true;
      }
      this.acciones.set(a.clip.name, accion);
    }
    this.matRoca = new THREE.MeshLambertMaterial({ color: COLORES_ROCA[def.variante] });
    const latentes = new Set<THREE.MeshToonMaterial>();
    this.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.material.userData.latir) latentes.add(o.material);
      if (o.userData.llama) this.llamas.push(o);
      if (o.name.startsWith('aliento_')) this.alientos.push(o);
    });
    this.latentes = [...latentes];
    this.orbita = this.raiz.getObjectByName('orbita') ?? null;

    // Luz propia: tiñe el suelo y lo que hay cerca del color del jefe.
    this.luz = new THREE.PointLight(def.luz, 60 * def.talla, 26 * def.talla, 1.6);
    this.luz.position.set(0, 3.2 * def.talla, 0.8);
    this.raiz.add(this.luz);

    // Ascuas que suben a su alrededor.
    const pos = new Float32Array(ASCUAS * 3);
    for (let i = 0; i < ASCUAS; i++) this.recolocarAscua(pos, i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.ascuas = new THREE.Points(geo, new THREE.PointsMaterial({
      color: def.luz, size: 0.45, map: texturaHalo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.ascuas.frustumCulled = false;
    scene.add(this.ascuas);

    // Charco ardiente bajo los pies: ondas que salen del centro.
    const r = def.radio * 1.7;
    this.charco = new THREE.Mesh(new THREE.RingGeometry(0.01, r, 36, 4).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -1,
      uniforms: { t: { value: 0 }, radio: { value: r }, luz: { value: new THREE.Color(def.luz) }, fuerza: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float t, radio, fuerza;
        uniform vec3 luz;
        varying vec2 vP;
        void main() {
          float r = length(vP) / radio;
          float onda = 0.5 + 0.5 * sin(r * 16.0 - t * 3.0);
          float borde = 1.0 - smoothstep(0.6, 1.0, r);
          vec3 color = mix(luz, vec3(1.0, 0.85, 0.45), onda * 0.45 * (1.0 - r));
          gl_FragColor = vec4(color, borde * (0.28 + 0.3 * onda) * fuerza);
        }`,
    }));
    this.charco.renderOrder = 1;
    scene.add(this.charco);
    this.reproducir('Despertar');
    this.eventos.aviso?.(`${def.nombre} despierta`);
    this.eventos.sacudida?.();
  }

  get activo() {
    return this.estado !== 'entrada' && !this.derrotado;
  }

  /** Daño al gólem; devuelve lo que se le ha quitado de verdad. */
  golpear(cantidad: number) {
    if (!this.activo || cantidad <= 0) return 0;
    const antes = this.vida;
    this.vida = Math.max(0, this.vida - cantidad);
    if (!this.furia && this.vida <= this.def.vida * 0.5) {
      this.furia = true;
      this.furiaPendiente = true;
    }
    if (this.vida <= 0) this.morir();
    return antes - this.vida;
  }

  /** Avanza al gólem un fotograma y devuelve el daño que recibe el jugador. */
  update(j: JugadorGolem): number {
    const dt = j.dt;
    this.mixer.update(dt);
    this.t += dt;
    this.animarBrillo(dt);
    let dano = this.actualizarProyectiles(j);
    this.avisos.actualizar(dt);
    if (this.estado === 'derrota') {
      if (!this.terminado && this.t >= 3) this.terminado = true;
      return dano;
    }
    if (this.estado === 'entrada') {
      if (this.t >= TIEMPOS_GOLEM.Despertar.duracion) this.cambiar('perseguir');
      return dano;
    }

    const dx = j.x - this.x, dz = j.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    // Pegado a su cuerpo: empuja hacia fuera y roza.
    if (d < this.def.radio + 0.5) {
      const hundido = this.def.radio + 0.5 - d;
      this.eventos.empujar?.(dx / d * hundido * 40 * dt, dz / d * hundido * 40 * dt, 0);
      dano += 9 * dt;
    }

    if (this.estado === 'perseguir') {
      this.mirarA(dx, dz, dt, 5);
      if (this.furiaPendiente) {
        this.furiaPendiente = false;
        this.empezar('furia', j);
        return dano;
      }
      const lento = this.furia ? 1.25 : 1;
      if (d > this.def.radio + 2.5) {
        const paso = Math.min(d - this.def.radio - 2.5, this.def.velocidad * lento * dt);
        this.mover(dx / d * paso, dz / d * paso);
        this.reproducir('Caminar');
        this.acciones.get('Caminar')!.timeScale = 1.1 * lento;
      } else {
        this.reproducir('Caminar');
        this.acciones.get('Caminar')!.timeScale = 0.4;
      }
      this.descanso -= dt;
      if (this.descanso <= 0) this.empezar(this.elegir(d), j);
      return dano;
    }

    return dano + this.actualizarAtaque(j, dx, dz, d);
  }

  objetivo() {
    return { x: this.x, z: this.z, radio: this.def.radio };
  }

  dispose() {
    this.limpiarAvisos();
    this.avisos.dispose();
    this.mixer.stopAllAction();
    this.scene.remove(this.raiz, this.ascuas, this.charco);
    this.ascuas.geometry.dispose();
    this.charco.geometry.dispose();
    // Los materiales que laten se comparten entre jefes de la misma variante.
    for (const m of this.latentes) m.emissiveIntensity = m.userData.latir;
  }

  // -------------------------------------------------------------- brillo

  /** Lo que se mueve solo: latido de la emisión, llamas, escombros, ascuas, luz y charco. */
  private animarBrillo(dt: number) {
    this.reloj += dt;
    const t = this.reloj;
    const apagado = this.estado === 'derrota' ? Math.max(0.15, 1 - this.t / 2.5) : 1;
    const furia = this.furia ? 1.45 : 1;
    const latido = (0.8 + 0.3 * Math.sin(t * 3.2)) * furia * apagado;
    for (const m of this.latentes) m.emissiveIntensity = m.userData.latir * latido;
    this.llamas.forEach((n, i) => {
      const k = (1 + 0.14 * Math.sin(t * 19 + i * 1.7) + 0.06 * Math.sin(t * 41 + i)) * (this.furia ? 1.35 : 1) * apagado;
      n.scale.set(k, k * (1 + 0.1 * Math.sin(t * 13 + i)), k);
    });
    if (this.orbita) this.orbita.rotation.y += dt * (this.furia ? 1.6 : 0.7) * apagado;
    this.luz.intensity = 60 * this.def.talla * (0.85 + 0.25 * Math.sin(t * 7) + 0.1 * Math.sin(t * 23)) * furia * apagado;

    const pos = this.ascuas.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < ASCUAS; i++) {
      arr[i * 3 + 1] += this.velAscuas[i] * dt * (this.furia ? 1.6 : 1);
      arr[i * 3] += Math.sin(t * 2 + i) * dt * 0.4;
      if (arr[i * 3 + 1] > this.world.heightAt(this.x, this.z) + 9 * this.def.talla) this.recolocarAscua(arr, i, false);
    }
    pos.needsUpdate = true;
    (this.ascuas.material as THREE.PointsMaterial).opacity = apagado;

    // El charco sigue al jefe pegado al relieve.
    const g = this.charco.geometry.attributes.position as THREE.BufferAttribute;
    this.charco.position.set(this.x, 0, this.z);
    for (let i = 0; i < g.count; i++) g.setY(i, this.world.heightAt(this.x + g.getX(i), this.z + g.getZ(i)) + 0.1);
    g.needsUpdate = true;
    this.charco.material.uniforms.t.value = t;
    this.charco.material.uniforms.fuerza.value = furia * apagado;
  }

  /** Pone una ascua en la base del jefe (o a cualquier altura al empezar). */
  private recolocarAscua(arr: Float32Array, i: number, alAzar: boolean) {
    const a = this.rand() * Math.PI * 2, r = this.def.radio * (0.4 + this.rand() * 1.4);
    const suelo = this.world.heightAt(this.x, this.z);
    arr[i * 3] = this.x + Math.cos(a) * r;
    arr[i * 3 + 1] = suelo + (alAzar ? this.rand() * 9 * this.def.talla : 0.3);
    arr[i * 3 + 2] = this.z + Math.sin(a) * r;
    this.velAscuas[i] = 1.2 + this.rand() * 2.2;
  }

  // ------------------------------------------------------------- ataques

  private elegir(d: number): AtaqueGolem {
    const lista = [...this.def.ataques, ...(this.furia ? this.def.furia : [])];
    const talla = this.def.talla;
    const vale = (a: AtaqueGolem) =>
      a === 'pisoton' ? d < 10 * this.def.talla
        : a === 'embestida' ? d > 7
          : a === 'salto' ? d > 6 && d < 26
            : a === 'roca' ? d > 5
            : a === 'aliento' ? d < ATAQUES_GOLEM.aliento.radio * talla * 0.85
              : true;
    let posibles = lista.filter((a) => vale(a) && a !== this.ultimo);
    if (!posibles.length) posibles = lista.filter(vale);
    if (!posibles.length) posibles = ['pisoton'];
    const a = posibles[Math.floor(this.rand() * posibles.length)];
    this.ultimo = a;
    return a;
  }

  private empezar(tipo: AtaqueGolem | 'furia', j: JugadorGolem) {
    const fx = Math.sin(this.giro), fz = Math.cos(this.giro);
    const a: Ataque = {
      tipo, tc: 0, retraso: 0, retenido: 0, hecho: false, aviso: null,
      cx: 0, cz: 0, ox: this.x, oz: this.z, dx: fx, dz: fz, largo: 0, recorrido: 0, corriendo: false,
    };
    this.ataque = a;
    this.estado = 'ataque';
    this.t = 0;
    const talla = this.def.talla;
    if (tipo === 'furia') {
      this.reproducir('Furia');
      this.eventos.aviso?.(`¡${this.def.nombre} entra en furia!`);
      return;
    }
    this.eventos.aviso?.(tipo === 'lluvia' && this.def.variante === 'escarcha' ? '¡Lluvia de carámbanos! Esquiva los círculos'
      : tipo === 'lluvia' && this.def.variante === 'sabueso' ? '¡Lluvia de brasas! Esquiva los círculos'
        : tipo === 'roca' && this.def.variante === 'sabueso' ? '¡Escupe plasma! Muévete'
          : ATAQUES_GOLEM[tipo].aviso);
    if (tipo === 'pisoton') {
      this.reproducir('Pisoton');
      a.cx = this.x + fx * 2 * talla;
      a.cz = this.z + fz * 2 * talla;
      a.aviso = this.avisos.circulo(a.cx, a.cz, ATAQUES_GOLEM.pisoton.radio * talla);
      a.retraso = this.rand() < 0.45 ? 0.25 + this.rand() * 0.35 : 0;
    } else if (tipo === 'roca') {
      this.reproducir('Lanzar');
    } else if (tipo === 'embestida') {
      this.reproducir('Preparar');
      const dx = j.x - this.x, dz = j.z - this.z;
      const d = Math.hypot(dx, dz) || 1;
      a.dx = dx / d;
      a.dz = dz / d;
      a.largo = Math.min(28, d + 8);
      a.retraso = this.rand() < 0.35 ? 0.3 : 0;
      a.aviso = this.avisos.franja(this.x, this.z, a.dx, a.dz, this.def.radio * 1.7, a.largo);
      this.giro = Math.atan2(a.dx, a.dz);
      this.raiz.rotation.y = this.giro;
    } else if (tipo === 'salto') {
      this.reproducir('Salto');
      // Cae donde vas a estar, pero sin pasarse: como mucho a 22 m.
      let tx = j.x + j.vx * 0.5, tz = j.z + j.vz * 0.5;
      const ddx = tx - this.x, ddz = tz - this.z, dd = Math.hypot(ddx, ddz);
      if (dd > 22) { tx = this.x + ddx / dd * 22; tz = this.z + ddz / dd * 22; }
      const r = this.world.resolve(tx, tz, this.def.radio, { x: 0, z: 0 });
      a.cx = r.x;
      a.cz = r.z;
      a.aviso = this.avisos.circulo(a.cx, a.cz, ATAQUES_GOLEM.salto.radio * Math.sqrt(talla));
      a.retraso = this.rand() < 0.4 ? 0.3 : 0;
    } else if (tipo === 'aliento') {
      this.reproducir('Aliento');
      const dx = j.x - this.x, dz = j.z - this.z;
      this.giro = Math.atan2(dx, dz);
      this.raiz.rotation.y = this.giro;
      a.dx = Math.sin(this.giro);
      a.dz = Math.cos(this.giro);
      a.cx = this.x + a.dx * this.def.radio * 0.8;
      a.cz = this.z + a.dz * this.def.radio * 0.8;
      a.largo = ATAQUES_GOLEM.aliento.radio * talla;
      a.aviso = this.avisos.cono(a.cx, a.cz, this.giro, a.largo, MEDIO_CONO);
    } else if (tipo === 'lluvia') {
      this.reproducir('Furia');
      const n = this.furia ? 9 : 6;
      for (let k = 0; k < n; k++) {
        const ang = this.rand() * Math.PI * 2, dist = k === 0 ? 0 : 2.5 + this.rand() * 6;
        const tx = j.x + (k === 0 ? j.vx * 0.9 : 0) + Math.cos(ang) * dist;
        const tz = j.z + (k === 0 ? j.vz * 0.9 : 0) + Math.sin(ang) * dist;
        this.lanzarProyectil('caida', tx, tz, tx, tz, 1.1 + k * 0.13);
      }
    }
  }

  private actualizarAtaque(j: JugadorGolem, dx: number, dz: number, d: number): number {
    const a = this.ataque!;
    const dt = j.dt;
    const ritmo = this.ritmo;
    const talla = this.def.talla;
    const accion = this.acciones.get(this.actual);
    // El gólem «aguanta» arriba: el clip se para y el aviso sigue latiendo.
    const enRetencion = (desde: number) => a.tc >= desde && a.retenido < a.retraso;
    const avanzar = (desde: number) => {
      if (enRetencion(desde)) {
        a.retenido += dt;
        if (accion) accion.paused = true;
      } else {
        if (accion) accion.paused = false;
        a.tc += dt * ritmo;
      }
    };
    let dano = 0;

    if (a.tipo === 'furia') {
      a.tc += dt * ritmo;
      if (!a.hecho && a.tc >= 1.2) {
        // El rugido empuja a quien esté cerca, sin dañar.
        a.hecho = true;
        this.avisos.onda(this.x, this.z, 9 * talla, '#ffd9a0');
        if (d < 9 * talla) this.eventos.empujar?.(dx / d * 12, dz / d * 12, 4);
        this.eventos.sacudida?.();
      }
      if (a.tc >= TIEMPOS_GOLEM.Furia.duracion) this.acabar();
      return 0;
    }

    if (a.tipo === 'pisoton') {
      avanzar(0.85);
      const golpe = TIEMPOS_GOLEM.Pisoton.golpe;
      if (a.aviso) this.avisos.pintar(a.aviso, a.tc / golpe, a.retenido > 0 && a.retenido < a.retraso);
      if (!a.hecho && a.tc >= golpe) {
        a.hecho = true;
        this.avisos.quitar(a.aviso);
        a.aviso = null;
        dano += this.impacto(a.cx, a.cz, ATAQUES_GOLEM.pisoton.radio * talla, 'pisoton', j);
      }
      if (a.tc >= TIEMPOS_GOLEM.Pisoton.duracion) this.acabar();
    } else if (a.tipo === 'roca') {
      a.tc += dt * ritmo;
      if (a.tc < TIEMPOS_GOLEM.Lanzar.suelta) this.mirarA(dx, dz, dt, 4);
      if (!a.hecho && a.tc >= TIEMPOS_GOLEM.Lanzar.suelta) {
        a.hecho = true;
        const n = this.furia ? this.def.rocasFuria : this.def.rocas;
        const fx = Math.sin(this.giro), fz = Math.cos(this.giro);
        const mx = this.x + fx * 1.6 * talla, mz = this.z + fz * 1.6 * talla;
        for (let k = 0; k < n; k++) {
          const ang = this.rand() * Math.PI * 2, abre = k === 0 ? 0 : 3 + this.rand() * 3;
          const tx = j.x + j.vx * 0.6 + Math.cos(ang) * abre, tz = j.z + j.vz * 0.6 + Math.sin(ang) * abre;
          const dur = 0.7 + Math.hypot(tx - mx, tz - mz) / 40;
          this.lanzarProyectil('roca', mx, mz, tx, tz, dur);
        }
        this.eventos.sonido?.('pulse');
      }
      if (a.tc >= TIEMPOS_GOLEM.Lanzar.duracion) this.acabar();
    } else if (a.tipo === 'embestida') {
      if (!a.corriendo) {
        avanzar(TIEMPOS_GOLEM.Preparar.duracion * 0.8);
        if (a.aviso) this.avisos.pintar(a.aviso, a.tc / TIEMPOS_GOLEM.Preparar.duracion, false);
        if (a.tc >= TIEMPOS_GOLEM.Preparar.duracion) {
          a.corriendo = true;
          this.reproducir('Embestir');
        }
      } else {
        const paso = VELOCIDAD_EMBESTIDA * (this.furia ? 1.15 : 1) * dt;
        const antes = { x: this.x, z: this.z };
        this.mover(a.dx * paso, a.dz * paso);
        const movido = Math.hypot(this.x - antes.x, this.z - antes.z);
        a.recorrido += movido;
        if (!a.hecho && d < this.def.radio + 1) {
          a.hecho = true;
          dano += ATAQUES_GOLEM.embestida.dano * (this.furia ? 1.15 : 1);
          // Sale despedido hacia delante y hacia el lado en el que estaba.
          const lado = Math.sign((j.x - this.x) * a.dz - (j.z - this.z) * a.dx) || 1;
          const e = ATAQUES_GOLEM.embestida.empuje;
          this.eventos.empujar?.(a.dx * e * 0.7 + a.dz * lado * e * 0.7, a.dz * e * 0.7 - a.dx * lado * e * 0.7, 7);
          this.eventos.sacudida?.();
          this.eventos.sonido?.('boom');
        }
        // Se para al acabar la franja o al chocar con algo.
        if (a.recorrido >= a.largo || movido < paso * 0.4) {
          this.avisos.quitar(a.aviso);
          a.aviso = null;
          if (movido < paso * 0.4) {
            this.avisos.onda(this.x, this.z, this.def.radio * 2, '#ffd9a0');
            this.eventos.sacudida?.();
          }
          this.acabar(1.8);
        }
      }
    } else if (a.tipo === 'salto') {
      avanzar(0.5);
      const { despega, aterriza } = TIEMPOS_GOLEM.Salto;
      if (a.aviso) this.avisos.pintar(a.aviso, a.tc / aterriza, false);
      if (a.tc > despega && !a.hecho) {
        const k = Math.min(1, (a.tc - despega) / (aterriza - despega));
        const s = k * k * (3 - 2 * k);
        this.x = a.ox + (a.cx - a.ox) * s;
        this.z = a.oz + (a.cz - a.oz) * s;
        this.raiz.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
      }
      if (!a.hecho && a.tc >= aterriza) {
        a.hecho = true;
        this.avisos.quitar(a.aviso);
        a.aviso = null;
        dano += this.impacto(a.cx, a.cz, ATAQUES_GOLEM.salto.radio * Math.sqrt(talla), 'salto', j);
      }
      if (a.tc >= TIEMPOS_GOLEM.Salto.duracion) this.acabar();
    } else if (a.tipo === 'lluvia') {
      a.tc += dt * ritmo;
      if (a.tc >= TIEMPOS_GOLEM.Furia.duracion) this.acabar();
    } else if (a.tipo === 'aliento') {
      a.tc += dt * ritmo;
      const { empieza, acaba, duracion } = TIEMPOS_ALIENTO;
      if (a.aviso) this.avisos.pintar(a.aviso, a.tc / empieza, false);
      const soplando = a.tc >= empieza && a.tc < acaba;
      // Los chorros salen de las bocas y tiemblan mientras sopla.
      const k = soplando ? Math.min(1, (a.tc - empieza) / 0.15) * (1 + 0.12 * Math.sin(a.tc * 40)) : 0.001;
      for (const n of this.alientos) n.scale.setScalar(k);
      if (soplando) {
        a.recorrido += dt;
        if (a.recorrido >= 0.3) {
          a.recorrido -= 0.3;
          const px = j.x - a.cx, pz = j.z - a.cz, dist = Math.hypot(px, pz);
          const angulo = Math.abs(Math.atan2(px * a.dz - pz * a.dx, px * a.dx + pz * a.dz));
          if (dist <= a.largo && angulo <= MEDIO_CONO) {
            dano += ATAQUES_GOLEM.aliento.dano * (this.furia ? 1.15 : 1);
            const e = ATAQUES_GOLEM.aliento.empuje;
            this.eventos.empujar?.(a.dx * e, a.dz * e, 0);
          }
        }
      }
      if (a.tc >= acaba && a.aviso) {
        this.avisos.quitar(a.aviso);
        a.aviso = null;
      }
      if (a.tc >= duracion) {
        for (const n of this.alientos) n.scale.setScalar(0.001);
        this.acabar();
      }
    }
    return dano;
  }

  /** Golpe en área: onda, sacudida y, si el jugador está dentro, daño y empuje. */
  private impacto(cx: number, cz: number, radio: number, tipo: AtaqueGolem, j: JugadorGolem) {
    this.avisos.onda(cx, cz, radio, '#ffd9a0');
    this.eventos.sacudida?.();
    this.eventos.sonido?.('boom');
    const dx = j.x - cx, dz = j.z - cz, d = Math.hypot(dx, dz);
    if (d > radio) return 0;
    const e = ATAQUES_GOLEM[tipo].empuje;
    const nx = d > 0.01 ? dx / d : Math.sin(this.giro), nz = d > 0.01 ? dz / d : Math.cos(this.giro);
    this.eventos.empujar?.(nx * e, nz * e, 6);
    return ATAQUES_GOLEM[tipo].dano * (this.furia ? 1.15 : 1);
  }

  /** Lo deprisa que ataca ahora: su ritmo, y un 15 % más en furia. */
  private get ritmo() {
    return this.def.ritmo * (this.furia ? 1.15 : 1);
  }

  private acabar(descanso = this.def.descanso) {
    const a = this.ataque;
    if (a) {
      this.avisos.quitar(a.aviso);
      const accion = this.acciones.get(this.actual);
      if (accion) accion.paused = false;
    }
    this.ataque = null;
    this.cambiar('perseguir');
    this.descanso = descanso * (this.furia ? 0.7 : 1) + this.rand() * 0.35;
    // Combo: a veces encadena otro ataque casi sin respirar (más en furia).
    if (this.rand() < (this.furia ? 0.5 : 0.3)) this.descanso = 0.12;
  }

  private morir() {
    this.derrotado = true;
    this.estado = 'derrota';
    this.t = 0;
    this.limpiarAvisos();
    this.ataque = null;
    this.reproducir('Derrota');
    this.eventos.sacudida?.();
  }

  private cambiar(estado: 'perseguir') {
    this.estado = estado;
    this.t = 0;
  }

  private mirarA(dx: number, dz: number, dt: number, rapidez: number) {
    let giro = Math.atan2(dx, dz) - this.giro;
    giro = Math.atan2(Math.sin(giro), Math.cos(giro));
    this.giro += giro * Math.min(1, dt * rapidez);
    this.raiz.rotation.y = this.giro;
  }

  private mover(px: number, pz: number) {
    const r = this.world.resolve(this.x + px, this.z + pz, this.def.radio, { x: 0, z: 0 });
    this.x = r.x;
    this.z = r.z;
    this.raiz.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
  }

  private reproducir(nombre: string) {
    const nueva = this.acciones.get(nombre);
    if (!nueva || this.actual === nombre && nueva.isRunning()) return;
    const anterior = this.acciones.get(this.actual);
    anterior?.fadeOut(0.18);
    nueva.reset();
    nueva.paused = false;
    nueva.timeScale = nombre === 'Despertar' ? 1 : this.ritmo;
    nueva.fadeIn(0.18).play();
    this.actual = nombre;
  }

  // -------------------------------------------------------- proyectiles

  private lanzarProyectil(tipo: Proyectil['tipo'], x0: number, z0: number, x1: number, z1: number, dur: number) {
    const def = ATAQUES_GOLEM[tipo === 'roca' ? 'roca' : 'lluvia'];
    const talla = this.def.talla;
    const r = this.world.resolve(x1, z1, 0.5, { x: 0, z: 0 });
    const radio = tipo === 'roca' ? def.radio * (0.8 + 0.2 * talla) : def.radio;
    const fuego = this.def.variante === 'sabueso';
    const geo = fuego
      ? new THREE.IcosahedronGeometry(tipo === 'roca' ? 0.75 : 0.6, 1)
      : tipo === 'roca'
        ? new THREE.IcosahedronGeometry(0.9 * talla, 0)
        : new THREE.ConeGeometry(0.55, 2.8, 6).rotateX(Math.PI);
    const mesh = new THREE.Mesh(geo, fuego
      ? new THREE.MeshBasicMaterial({ color: '#ffd25a' })
      : this.def.variante === 'escarcha' && tipo === 'caida'
        ? new THREE.MeshBasicMaterial({ color: '#e8faff' })
        : this.matRoca);
    // Las bolas de plasma del sabueso brillan; las rocas llevan las grietas encendidas.
    halo(mesh, this.def.luz, fuego ? 3.2 : 2.4 * talla, 0, 0, 0, fuego ? 0.95 : 0.5);
    mesh.castShadow = true;
    mesh.visible = tipo === 'roca';
    const y0 = this.world.heightAt(x0, z0) + (tipo === 'roca' ? (fuego ? 4.2 : 6.2) * talla : 16);
    mesh.position.set(x0, y0, z0);
    this.scene.add(mesh);
    this.proyectiles.push({
      tipo, mesh, aviso: this.avisos.circulo(r.x, r.z, radio), x0, y0, z0, x1: r.x, z1: r.z, t: 0, dur, radio,
      dano: def.dano * (this.furia ? 1.15 : 1), empuje: def.empuje,
    });
  }

  private actualizarProyectiles(j: JugadorGolem): number {
    let dano = 0;
    for (let i = this.proyectiles.length - 1; i >= 0; i--) {
      const p = this.proyectiles[i];
      p.t += j.dt;
      const k = Math.min(1, p.t / p.dur);
      this.avisos.pintar(p.aviso, k, false);
      const suelo = this.world.heightAt(p.x1, p.z1);
      if (p.tipo === 'roca') {
        // Parábola alta: sale de la mano, sube y cae sobre el aviso.
        const x = p.x0 + (p.x1 - p.x0) * k, z = p.z0 + (p.z1 - p.z0) * k;
        const y = p.y0 + (suelo - p.y0) * k + 9 * 4 * k * (1 - k);
        p.mesh.position.set(x, y, z);
        p.mesh.rotation.x += j.dt * 5;
        p.mesh.rotation.z += j.dt * 3;
      } else {
        // La caída solo se ve el último medio segundo, recta desde arriba.
        const caer = Math.max(0, (p.t - (p.dur - 0.5)) / 0.5);
        p.mesh.visible = caer > 0;
        p.mesh.position.set(p.x1, suelo + 1.4 + 16 * (1 - caer), p.z1);
      }
      if (k < 1) continue;
      this.avisos.quitar(p.aviso);
      this.quitar(p.mesh, p.mesh.material !== this.matRoca);
      this.proyectiles.splice(i, 1);
      this.avisos.onda(p.x1, p.z1, p.radio, p.tipo === 'roca' ? '#ffd9a0' : '#e8faff');
      this.eventos.sonido?.('boom');
      if (p.tipo === 'roca') this.eventos.sacudida?.();
      const dx = j.x - p.x1, dz = j.z - p.z1, d = Math.hypot(dx, dz);
      if (d <= p.radio) {
        dano += p.dano;
        this.eventos.empujar?.(d > 0.01 ? dx / d * p.empuje : 0, d > 0.01 ? dz / d * p.empuje : 0, p.tipo === 'roca' ? 5 : 2);
      }
    }
    return dano;
  }

  // -------------------------------------------------------------- avisos

  private limpiarAvisos() {
    if (this.ataque) this.avisos.quitar(this.ataque.aviso);
    for (const p of this.proyectiles) {
      this.avisos.quitar(p.aviso);
      this.quitar(p.mesh, p.mesh.material !== this.matRoca);
    }
    this.proyectiles = [];
  }

  private quitar(mesh: THREE.Mesh, material = true) {
    this.scene.remove(mesh);
    mesh.traverse((o) => { if (o instanceof THREE.Sprite) o.material.dispose(); });
    mesh.geometry.dispose();
    if (material) (mesh.material as THREE.Material).dispose();
  }
}
