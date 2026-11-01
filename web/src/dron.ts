// META SPACE — Dron compañero ADA (EVA).
//
// Diseño basado en concepto generado con Muse Image: casco naranja de
// astronauta con gran visor cyan, 3 brazos rotores con discos de sustentación,
// antena con baliza y halo inferior. Todo geometría procedural (sin assets).

import * as THREE from 'three';
import { ALTURA_ADA } from './modelos/ada';
import type { Modelo } from './modelos/kit';
import { esPerro, perfilDe, type FormaAda } from './companeros';

export type { FormaAda } from './companeros';

export type ModoDron = 'seguir' | 'quieto' | 'explorar';


export interface BlancoDron {
  x: number;
  z: number;
  etiqueta: string;
}

const ALTURA_VUELO = 2.2;
const AMORTIGUACION = 5.2;

export class Dron {
  readonly group = new THREE.Group();
  modo: ModoDron = 'seguir';
  luz = false;
  objetivo: BlancoDron | null = null;

  private vel = new THREE.Vector3();
  private ancla = new THREE.Vector3();
  private giro = 0;
  private pulsoT = 0;
  private anillo: THREE.Mesh;
  private anilloMat: THREE.MeshBasicMaterial;
  private visorMat: THREE.MeshBasicMaterial;
  private balizaMat: THREE.MeshBasicMaterial;
  private haloMat: THREE.MeshBasicMaterial;
  private helices: THREE.Mesh[] = [];
  private quieto = new THREE.Vector3();
  // Forma de ADA: el dron de siempre o uno de los modelos animados.
  forma: FormaAda = 'dron';
  private cuerpoDron = new THREE.Group();
  private modelo: Modelo | null = null;
  private mezclador: THREE.AnimationMixer | null = null;
  private acciones = new Map<string, THREE.AnimationAction>();
  private clip = '';
  private hablarT = 0;
  private altura = ALTURA_VUELO;
  private rumbo = 0;
  // Órdenes de quien lo controla (ataques, la vida del perro). Valen un
  // fotograma: hay que repetirlas mientras se quieran.
  private destino: { x: number; z: number } | null = null;
  private quedarse = false;
  private mirarA: { x: number; z: number } | null = null;
  // Animación pedida desde fuera: una de una vez hasta que acabe, o una en
  // bucle durante `forzadoT` segundos.
  private forzado = '';
  private forzadoT = 0;

  constructor(private scene: THREE.Scene, private alturaEn: (x: number, z: number) => number) {
    // Casco: esfera achatada naranja con banda inferior oscura.
    const cuerpoMat = new THREE.MeshLambertMaterial({ color: '#e8632b', emissive: '#3a1508', emissiveIntensity: 0.5 });
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), cuerpoMat);
    casco.scale.set(1, 0.92, 1);
    casco.castShadow = true;
    const banda = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.34, 0.12, 14),
      new THREE.MeshLambertMaterial({ color: '#2a1a12' }),
    );
    banda.position.y = -0.32;
    // Visor: cúpula cyan al frente, el "ojo" de ADA.
    this.visorMat = new THREE.MeshBasicMaterial({ color: '#aef4ff' });
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), this.visorMat);
    visor.position.set(0, 0.03, 0.33);
    visor.scale.set(1, 1.1, 0.55);
    const marco = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.045, 8, 18),
      new THREE.MeshLambertMaterial({ color: '#1b1214' }),
    );
    marco.position.set(0, 0.03, 0.33);
    // Antena con baliza parpadeante.
    const mastil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6),
      new THREE.MeshLambertMaterial({ color: '#22303c' }),
    );
    mastil.position.set(-0.12, 0.52, -0.05);
    this.balizaMat = new THREE.MeshBasicMaterial({ color: '#5ee0ff', transparent: true });
    const baliza = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.balizaMat);
    baliza.position.set(-0.12, 0.72, -0.05);
    // 3 brazos con motor y hélice (discos translúcidos que giran).
    const brazoMat = new THREE.MeshLambertMaterial({ color: '#22303c' });
    const motorGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
      const dx = Math.cos(a), dz = Math.sin(a);
      const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), brazoMat);
      brazo.position.set(dx * 0.42, 0.28, dz * 0.42);
      brazo.rotation.z = -dx * 0.5;
      brazo.rotation.x = dz * 0.5;
      const motor = new THREE.Mesh(motorGeo, brazoMat);
      motor.position.set(dx * 0.72, 0.42, dz * 0.72);
      const helice = new THREE.Mesh(
        new THREE.CircleGeometry(0.26, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: '#5ee0ff', transparent: true, opacity: 0.35,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      helice.position.set(dx * 0.72, 0.48, dz * 0.72);
      this.helices.push(helice);
      this.cuerpoDron.add(brazo, motor, helice);
    }
    // Halo inferior: resplandor cyan bajo el casco.
    this.haloMat = new THREE.MeshBasicMaterial({
      color: '#5ee0ff', transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20).rotateX(-Math.PI / 2), this.haloMat);
    halo.position.y = -0.42;
    this.cuerpoDron.add(casco, banda, visor, marco, mastil, baliza, halo);
    this.group.add(this.cuerpoDron);
    this.group.position.set(0, 3, 2);
    scene.add(this.group);

    // Pulso del escáner: anillo que se expande sobre el suelo.
    this.anilloMat = new THREE.MeshBasicMaterial({ color: '#5ee0ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.anillo = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), this.anilloMat);
    this.anillo.visible = false;
    scene.add(this.anillo);
  }

  /** Cambia la forma de ADA. El comportamiento (seguir, escanear, luz) es el mismo. */
  setForma(forma: FormaAda) {
    if (this.modelo) {
      this.group.remove(this.modelo.raiz);
      this.mezclador?.stopAllAction();
    }
    this.forma = forma;
    this.modelo = null;
    this.mezclador = null;
    this.acciones.clear();
    this.clip = '';
    this.forzado = '';
    this.forzadoT = 0;
    const def = perfilDe(forma);
    this.cuerpoDron.visible = !def.crear;
    this.altura = ALTURA_VUELO;
    if (!def.crear) return;
    this.modelo = def.crear();
    this.altura = ALTURA_ADA[this.modelo.id] ?? ALTURA_VUELO;
    // Junto al astronauta de 2,6 m se quedaban cortas: un poco más grandes
    // (el perro, que es el más pequeño, algo más).
    this.modelo.raiz.scale.setScalar(esPerro(forma) ? 1.5 : 1.25);
    this.group.add(this.modelo.raiz);
    this.mezclador = new THREE.AnimationMixer(this.modelo.raiz);
    for (const a of this.modelo.animaciones) {
      const accion = this.mezclador.clipAction(a.clip);
      if (!a.bucle) {
        accion.setLoop(THREE.LoopOnce, 1);
        accion.clampWhenFinished = true;
      }
      this.acciones.set(a.clip.name, accion);
    }
    this.animar('Reposo', 0);
  }

  /** Va hacia (x, z) este fotograma, en vez de seguir al jugador. */
  ir(x: number, z: number) {
    this.destino = { x, z };
  }

  /** Se queda donde está este fotograma (olfateando, escarbando…). */
  parar() {
    this.quedarse = true;
  }

  /** Mira hacia (x, z) este fotograma aunque esté quieto. */
  mirar(x: number, z: number) {
    this.mirarA = { x, z };
  }

  get posicion() {
    return this.group.position;
  }

  /** Velocidad horizontal actual (m/s). */
  get rapidez() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get camina() {
    return this.altura === 0;
  }

  /** ¿Tiene esta forma la animación? (el dron original no tiene ninguna). */
  tiene(nombre: string) {
    return this.acciones.has(nombre);
  }

  /**
   * Reproduce una animación concreta: las de una vez hasta que acaban; las de
   * bucle durante `segundos`. Devuelve false si esta forma no la tiene.
   */
  accion(nombre: string, segundos = 0) {
    if (!this.acciones.has(nombre)) return false;
    this.forzado = nombre;
    this.forzadoT = segundos;
    this.animar(nombre, 0.15, true);
    return true;
  }

  /** ¿Sigue con la animación pedida? */
  get ocupado() {
    if (!this.forzado) return false;
    const a = this.acciones.get(this.forzado)!;
    return this.forzadoT > 0 || (a.loop === THREE.LoopOnce && a.isRunning());
  }

  /** Mantiene una animación en bucle mientras se siga llamando (sin reiniciarla). */
  mantener(nombre: string, segundos = 0.25) {
    if (this.forzado === nombre && this.forzadoT > 0) {
      this.forzadoT = Math.max(this.forzadoT, segundos);
      return true;
    }
    if (this.ocupado) return false;
    return this.accion(nombre, segundos);
  }

  /** La animación pedida desde fuera que se está viendo ('' si ninguna). */
  get accionActual() {
    return this.ocupado ? this.forzado : '';
  }

  cancelarAccion() {
    this.forzado = '';
    this.forzadoT = 0;
  }

  /** ADA está hablando: la forma lo acompaña con su animación. */
  hablar(segundos = 2.5) {
    this.hablarT = Math.max(this.hablarT, segundos);
  }

  private animar(nombre: string, fundido = 0.2, deNuevo = false) {
    if (nombre === this.clip && !deNuevo) return;
    const nueva = this.acciones.get(nombre);
    if (!nueva) return;
    const vieja = this.acciones.get(this.clip);
    nueva.reset().play();
    if (vieja && vieja !== nueva) nueva.crossFadeFrom(vieja, fundido, false);
    this.clip = nombre;
  }

  /** Fija el modo; en quieto memoriza dónde quedarse. */
  setModo(modo: ModoDron, objetivo: BlancoDron | null = null) {
    this.modo = modo;
    this.objetivo = objetivo;
    if (modo === 'quieto') this.quieto.copy(this.group.position);
    this.vel.multiplyScalar(0.3);
  }

  setLuz(on: boolean) {
    this.luz = on;
    this.haloMat.opacity = on ? 0.55 : 0.28;
    this.visorMat.color.set(on ? '#ffffff' : '#aef4ff');
  }

  /** Pulso del escáner sobre (x, z). */
  escanear(x: number, _y: number, z: number) {
    this.anillo.position.set(x, this.alturaEn(x, z) + 0.15, z);
    this.anillo.visible = true;
    this.pulsoT = 1.2;
    if (this.modelo) this.accion('Escanear');
  }

  get pulsando(): boolean {
    return this.pulsoT > 0;
  }

  update(dt: number, px: number, _py: number, pz: number, yaw: number) {
    // Ancla según el modo.
    if (this.modo === 'quieto') {
      this.ancla.copy(this.quieto);
      this.ancla.y = Math.max(this.ancla.y, this.alturaEn(this.ancla.x, this.ancla.z) + this.altura);
    } else if (this.modo === 'explorar' && this.objetivo) {
      const dx = this.objetivo.x - this.group.position.x, dz = this.objetivo.z - this.group.position.z;
      if (dx * dx + dz * dz < 2.25) {
        // Llegó: avisa quedándose quieto un momento y vuelve a seguir.
        this.setModo('seguir');
      } else {
        this.ancla.set(this.objetivo.x, this.alturaEn(this.objetivo.x, this.objetivo.z) + this.altura + (this.altura > 0 ? 0.6 : 0), this.objetivo.z);
      }
    } else {
      // Seguir: a la izquierda y un poco detrás, rotado con la cámara.
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const ax = px - fx * 1.2 - rx * 1.6;
      const az = pz - fz * 1.2 - rz * 1.6;
      this.ancla.set(ax, this.alturaEn(ax, az) + this.altura, az);
    }
    // Órdenes del fotograma: ir a un sitio o quedarse quieto.
    if (this.destino) {
      this.ancla.set(this.destino.x, this.alturaEn(this.destino.x, this.destino.z) + this.altura, this.destino.z);
    } else if (this.quedarse) {
      this.ancla.copy(this.group.position);
      this.vel.multiplyScalar(Math.exp(-dt * 10));
    }
    // Muelle amortiguado hacia el ancla (sin rebotes bruscos).
    const rigidez = 42;
    this.vel.x += (this.ancla.x - this.group.position.x) * rigidez * dt;
    this.vel.y += (this.ancla.y - this.group.position.y) * rigidez * dt;
    this.vel.z += (this.ancla.z - this.group.position.z) * rigidez * dt;
    this.vel.multiplyScalar(Math.exp(-dt * AMORTIGUACION));
    // Tope de velocidad: el dron corre, no teletransporta.
    // (va algo más rápido que antes: el astronauta corre y va en tabla).
    const sp = this.vel.length();
    if (sp > 20) this.vel.multiplyScalar(20 / sp);
    this.group.position.addScaledVector(this.vel, dt);
    // Nunca bajo el suelo.
    const suelo = this.alturaEn(this.group.position.x, this.group.position.z);
    const minY = suelo + (this.altura > 0 ? 1.2 : 0);
    if (this.group.position.y < minY) {
      this.group.position.y = minY;
      if (this.vel.y < 0) this.vel.y = 0;
    }

    // Vida: hélices girando, baliza parpadeando, cabeceo con el movimiento.
    this.giro += dt * (this.luz ? 26 : 16);
    for (const h of this.helices) h.rotation.y = this.giro;
    this.balizaMat.opacity = 0.45 + 0.55 * Math.abs(Math.sin(this.giro * 0.6));
    if (this.modelo) {
      this.actualizarModelo(dt, px, pz, suelo);
      this.destino = null;
      this.quedarse = false;
      this.mirarA = null;
    } else {
      this.destino = null;
      this.quedarse = false;
      this.mirarA = null;
      this.group.rotation.z = Math.max(-0.3, Math.min(0.3, -this.vel.x * 0.03));
      this.group.rotation.x = Math.max(-0.3, Math.min(0.3, this.vel.z * 0.03));
      this.group.position.y += Math.sin(this.giro * 0.4) * 0.15 * dt;
    }

    // Pulso del escáner: se expande y se desvanece.
    if (this.pulsoT > 0) {
      this.pulsoT = Math.max(0, this.pulsoT - dt);
      const t = 1 - this.pulsoT / 1.2;
      const r = 1 + t * 17;
      this.anillo.scale.set(r, 1, r);
      this.anilloMat.opacity = 0.55 * (1 - t);
      if (this.pulsoT <= 0) this.anillo.visible = false;
    }
  }

  /**
   * Las formas animadas miran hacia donde van (o al jugador si están quietas)
   * y eligen animación: moverse, escanear, hablar o reposo. El zorro va pegado
   * al suelo; las demás flotan.
   */
  private actualizarModelo(dt: number, px: number, pz: number, suelo: number) {
    const g = this.group;
    g.rotation.x = g.rotation.z = 0;
    const vh = Math.hypot(this.vel.x, this.vel.z);
    let objetivo = this.rumbo;
    if (this.mirarA) objetivo = Math.atan2(this.mirarA.x - g.position.x, this.mirarA.z - g.position.z);
    else if (vh > 0.8) objetivo = Math.atan2(this.vel.x, this.vel.z);
    else if (!this.quedarse) objetivo = Math.atan2(px - g.position.x, pz - g.position.z);
    let d = objetivo - this.rumbo;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.rumbo += d * Math.min(1, dt * 8);
    g.rotation.y = this.rumbo;
    if (this.altura === 0) {
      g.position.y = suelo;
      this.vel.y = 0;
    }

    this.hablarT = Math.max(0, this.hablarT - dt);
    if (this.forzadoT > 0) this.forzadoT = Math.max(0, this.forzadoT - dt);
    if (!this.ocupado) {
      this.forzado = '';
      // Los que caminan trotan despacio y galopan deprisa (si saben).
      if (vh > 4.5 || (vh > 1.2 && !this.acciones.has('Caminar'))) this.animar('Moverse');
      else if (vh > 1.2) this.animar('Caminar');
      else if (this.hablarT > 0) this.animar('Hablar');
      else this.animar('Reposo');
    }
    const mover = this.acciones.get('Moverse');
    if (mover) mover.timeScale = this.altura === 0 ? Math.max(0.7, vh / 7) : 1;
    const caminar = this.acciones.get('Caminar');
    if (caminar) caminar.timeScale = Math.max(0.6, vh / 2.5);
    this.mezclador!.update(dt);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    this.anillo.geometry.dispose();
    this.anilloMat.dispose();
  }
}
