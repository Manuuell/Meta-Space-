import * as THREE from 'three';
import type { Sound } from './audio';
import { esPerro, perfilDe, type FormaAda, type PerfilCompanero } from './companeros';
import type { Dron } from './dron';
import { expresar, type ExpresionPerro } from './modelos/perro';
import type { Enemies } from './enemies';
import type { Pickups } from './pickups';
import type { PuntoInteres, World } from './world';

// El compañero en combate y, si es el perro, su vida entre combate y combate.
// Mueve al Dron con órdenes de un fotograma (ir, parar, mirar, animación):
// el Dron sigue siendo quien vuela, camina y elige la animación de base.

export interface ContextoCompanero {
  px: number;
  py: number;
  pz: number;
  /** m/s del jugador en horizontal. */
  velocidadJugador: number;
  nivel: number;
  /** Vida del jugador entre 0 y 1. */
  vida: number;
  curar: (n: number) => void;
  sonido: (s: Sound) => void;
}

// ================================================================ Efectos

/** Rayos, ondas y copos: pocos objetos reutilizados, nada se crea en combate. */
export class Efectos {
  private rayos: { linea: THREE.Line; mat: THREE.LineBasicMaterial; t: number; dur: number }[] = [];
  private ondas: { malla: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; dur: number; radio: number }[] = [];
  private copos: THREE.InstancedMesh;
  private coposVivos: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    for (let i = 0; i < 18; i++) {
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
      const linea = new THREE.Line(geo, mat);
      linea.frustumCulled = false;
      linea.visible = false;
      scene.add(linea);
      this.rayos.push({ linea, mat, t: 0, dur: 1 });
    }
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const malla = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), mat);
      malla.visible = false;
      scene.add(malla);
      this.ondas.push({ malla, mat, t: 0, dur: 1, radio: 1 });
    }
    this.copos = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.13, 0),
      new THREE.MeshBasicMaterial({ color: '#f4f8ff' }),
      120,
    );
    this.copos.count = 0;
    this.copos.frustumCulled = false;
    scene.add(this.copos);
  }

  rayo(a: THREE.Vector3, b: THREE.Vector3, color: string, dur = 0.12) {
    const r = this.rayos.find((x) => x.t <= 0) ?? this.rayos[0];
    const pos = r.linea.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
    r.mat.color.set(color);
    r.t = r.dur = dur;
    r.linea.visible = true;
  }

  onda(x: number, y: number, z: number, radio: number, color: string, dur = 0.5) {
    const o = this.ondas.find((w) => w.t <= 0) ?? this.ondas[0];
    o.malla.position.set(x, y, z);
    o.mat.color.set(color);
    o.t = o.dur = dur;
    o.radio = radio;
    o.malla.visible = true;
  }

  /** Copos de nieve que saltan (escarbar, revolcarse, mordiscos). */
  nieve(x: number, y: number, z: number, n: number, fuerza = 2.5) {
    for (let k = 0; k < n && this.coposVivos.length < 120; k++) {
      const a = Math.random() * Math.PI * 2;
      const f = fuerza * (0.4 + Math.random() * 0.6);
      this.coposVivos.push({ x, y, z, vx: Math.cos(a) * f * 0.6, vy: f * 1.3, vz: Math.sin(a) * f * 0.6, t: 0.5 + Math.random() * 0.3 });
    }
  }

  update(dt: number) {
    for (const r of this.rayos) {
      if (r.t <= 0) continue;
      r.t -= dt;
      r.mat.opacity = Math.max(0, r.t / r.dur);
      if (r.t <= 0) r.linea.visible = false;
    }
    for (const o of this.ondas) {
      if (o.t <= 0) continue;
      o.t -= dt;
      const k = 1 - Math.max(0, o.t) / o.dur;
      const r = 0.4 + k * o.radio;
      o.malla.scale.set(r, 1, r);
      o.mat.opacity = 0.7 * (1 - k);
      if (o.t <= 0) o.malla.visible = false;
    }
    let n = 0;
    for (let i = this.coposVivos.length - 1; i >= 0; i--) {
      const c = this.coposVivos[i];
      c.t -= dt;
      if (c.t <= 0) { this.coposVivos.splice(i, 1); continue; }
      c.vy -= 14 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      const e = Math.min(1, c.t * 3);
      this.m.compose(this.v.set(c.x, c.y, c.z), this.q, this.s.set(e, e, e));
      this.copos.setMatrixAt(n++, this.m);
    }
    this.copos.count = n;
    this.copos.instanceMatrix.needsUpdate = true;
  }

  limpiar() {
    for (const r of this.rayos) { r.t = 0; r.linea.visible = false; }
    for (const o of this.ondas) { o.t = 0; o.malla.visible = false; }
    this.coposVivos.length = 0;
    this.copos.count = 0;
  }

  dispose() {
    for (const r of this.rayos) this.scene.remove(r.linea);
    for (const o of this.ondas) this.scene.remove(o.malla);
    this.scene.remove(this.copos);
  }
}

// ============================================================== Compañero

export class Companero {
  perfil: PerfilCompanero;
  readonly efectos: Efectos;
  private cdAtaque = 0.8;
  private cdHabilidad = 6;
  private presa: { x: number; z: number; t: number } | null = null;
  private vida: VidaPerro | null = null;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private golpeados = new Set<number>();
  // Cara de Bruno: la que toca por lo que hace, salvo que un suceso mande otra un rato.
  private caraActual: ExpresionPerro | '' = '';
  private caraForzada: ExpresionPerro | null = null;
  private caraT = 0;
  private sonrisaT = 0;
  private cdSonrisa = 3;

  constructor(
    scene: THREE.Scene,
    private enemies: Enemies,
    private pickups: Pickups,
    private world: World,
    private dron: Dron,
  ) {
    this.efectos = new Efectos(scene);
    this.perfil = perfilDe(dron.forma);
  }

  setForma(id: FormaAda) {
    this.dron.setForma(id);
    this.perfil = perfilDe(id);
    this.vida = esPerro(id) ? new VidaPerro(this.dron, this.pickups, this.world, this.efectos) : null;
    this.reset();
  }

  reset() {
    this.cdAtaque = 0.8;
    this.cdHabilidad = this.perfil.habilidad.cada * 0.5;
    this.presa = null;
    this.efectos.limpiar();
    this.vida?.reset();
    this.dron.cancelarAccion();
    this.caraActual = '';
    this.caraForzada = null;
  }

  /** Una cara durante un rato (suceso: subir de nivel, que te hieran…). */
  private sentir(e: ExpresionPerro, segundos: number) {
    this.caraForzada = e;
    this.caraT = segundos;
  }

  /**
   * La cara de Bruno sigue a lo que hace: feliz al jugar, patinar o celebrar;
   * enfadado al morder o ladrar; sorprendido al resbalar u olfatear el aire;
   * dormido al dormir; triste si te ve muy herido. Quieto a tu lado, sonríe
   * de vez en cuando.
   */
  private cara(dt: number, ctx: ContextoCompanero) {
    const raiz = this.dron.modeloRaiz;
    if (!raiz || !esPerro(this.perfil.id)) return;
    this.caraT -= dt;
    if (this.caraT <= 0) this.caraForzada = null;
    const clip = this.dron.clipActual;
    let e: ExpresionPerro = 'normal';
    if (clip === 'Dormir' || clip === 'Bostezar' || clip === 'Aullar') e = 'dormido';
    else if (this.presa || clip === 'Atacar' || clip === 'Habilidad' || clip === 'Ladrar') e = 'enfado';
    else if (this.caraForzada) e = this.caraForzada;
    else if (['Celebrar', 'Revolcarse', 'Patinar', 'Truco', 'Pedir', 'PerseguirCola', 'Rascarse'].includes(clip)) e = 'feliz';
    else if (clip === 'Resbalar' || clip === 'Escanear' || clip === 'Hablar') e = 'sorpresa';
    else if (ctx.vida < 0.3) e = 'triste';
    else {
      // Sonrisas sueltas cuando está tranquilo a tu lado.
      this.sonrisaT -= dt;
      this.cdSonrisa -= dt;
      if (this.cdSonrisa <= 0) {
        this.sonrisaT = 1 + Math.random() * 1.5;
        this.cdSonrisa = 3 + Math.random() * 4;
      }
      if (this.sonrisaT > 0 && (clip === 'Reposo' || clip === 'Sentado' || clip === 'Caminar')) e = 'feliz';
    }
    if (e !== this.caraActual) {
      expresar(raiz, e);
      this.caraActual = e;
    }
  }

  /** Te han herido: se enfada con quien fue o, si vas muy mal, se preocupa. */
  alDano(vida: number) {
    if (this.caraForzada === 'triste' || this.caraForzada === 'enfado') return;
    this.sentir(vida < 0.35 ? 'triste' : 'enfado', vida < 0.35 ? 2.5 : 1);
  }

  /** Fracción de recarga de la habilidad (1 = lista), para el HUD. */
  get habilidadLista() {
    return 1 - Math.max(0, this.cdHabilidad) / this.perfil.habilidad.cada;
  }

  update(dt: number, ctx: ContextoCompanero) {
    this.efectos.update(dt);
    const k = 1 + 0.06 * (ctx.nivel - 1);
    this.cdAtaque -= dt;
    this.cdHabilidad -= dt;
    this.atacar(dt, ctx, k);
    this.habilidad(ctx, k);
    this.vida?.update(dt, ctx, this.presa !== null);
    this.cara(dt, ctx);
  }

  // ------------------------------------------------------------ Ataque

  /** Punto de disparo y de impacto (a media altura del enemigo). */
  private origen() {
    const p = this.dron.posicion;
    return this.a.set(p.x, p.y + (this.dron.camina ? 0.5 : 0), p.z);
  }

  private impacto(i: number) {
    const x = this.enemies.x[i], z = this.enemies.z[i];
    return this.b.set(x, this.world.heightAt(x, z) + 1, z);
  }

  private atacar(dt: number, ctx: ContextoCompanero, k: number) {
    const at = this.perfil.ataque;
    const d = this.dron.posicion;
    const libre = this.dron.modo !== 'explorar';

    if (at.tipo === 'mordisco') {
      if (this.dron.modo !== 'seguir') { this.presa = null; return; }
      if (!this.presa && this.cdAtaque <= 0) {
        // Busca presa cerca del jugador: no se va a cazar al otro lado del mapa.
        const i = this.enemies.nearest(ctx.px, ctx.pz, at.alcance);
        if (i >= 0) {
          this.presa = { x: this.enemies.x[i], z: this.enemies.z[i], t: 1.6 };
          this.vida?.interrumpir();
        }
      }
      if (!this.presa) return;
      const i = this.enemies.nearest(this.presa.x, this.presa.z, 2.5);
      this.presa.t -= dt;
      const lejos = Math.hypot(d.x - ctx.px, d.z - ctx.pz) > 18;
      if (i < 0 || this.presa.t <= 0 || lejos) {
        this.presa = null;
        this.cdAtaque = 0.3;
        return;
      }
      this.presa.x = this.enemies.x[i];
      this.presa.z = this.enemies.z[i];
      this.dron.ir(this.presa.x, this.presa.z);
      const r = this.enemies.defOf(i).radius;
      if (Math.hypot(d.x - this.presa.x, d.z - this.presa.z) < r + 0.9) {
        this.enemies.hit(i, at.dano * k, d.x, d.z, 0.5);
        this.dron.accion('Atacar');
        this.dron.mirar(this.presa.x, this.presa.z);
        this.efectos.nieve(this.presa.x, this.world.heightAt(this.presa.x, this.presa.z) + 0.6, this.presa.z, 6, 2);
        ctx.sonido('hit');
        this.presa = null;
        this.cdAtaque = at.cada;
      }
      return;
    }

    if (at.tipo === 'aura') {
      // El orbe se acerca a la amenaza más próxima al jugador y corta con los anillos.
      const cerca = this.enemies.nearest(ctx.px, ctx.pz, 6);
      if (cerca >= 0 && this.dron.modo === 'seguir') this.dron.ir(this.enemies.x[cerca], this.enemies.z[cerca]);
      if (this.cdAtaque > 0) return;
      this.cdAtaque = at.cada;
      let alguno = false;
      this.enemies.forEachInRadius(d.x, d.z, at.alcance, (j) => {
        this.enemies.hit(j, at.dano * k, d.x, d.z, 0.15);
        alguno = true;
      });
      if (alguno) {
        this.dron.accion('Atacar');
        this.efectos.onda(d.x, this.world.heightAt(d.x, d.z) + 0.1, d.z, at.alcance, this.perfil.color, 0.3);
        ctx.sonido('hit');
      }
      return;
    }

    if (this.cdAtaque > 0 || !libre) return;
    const primero = this.enemies.nearest(d.x, d.z, at.alcance);
    if (primero < 0) return;
    this.cdAtaque = at.cada;
    this.dron.mirar(this.enemies.x[primero], this.enemies.z[primero]);

    if (at.tipo === 'cadena') {
      this.golpeados.clear();
      let i = primero;
      const desde = this.origen().clone();
      for (let n = 0; n < (at.extra ?? 3) && i >= 0; n++) {
        this.golpeados.add(i);
        const hasta = this.impacto(i).clone();
        this.efectos.rayo(desde, hasta, n === 0 ? '#e6d4ff' : this.perfil.color, 0.18);
        this.enemies.hit(i, at.dano * k, desde.x, desde.z, 0.15);
        desde.copy(hasta);
        i = this.enemies.nearest(hasta.x, hasta.z, 5, this.golpeados);
      }
      this.dron.accion('Atacar');
      ctx.sonido('zap');
      return;
    }

    // Láser y rayo de datos: un objetivo.
    this.enemies.hit(primero, at.dano * k, d.x, d.z, at.tipo === 'laser' ? 0.2 : 0.05);
    this.efectos.rayo(this.origen(), this.impacto(primero), at.tipo === 'rayo' ? '#bff6ff' : '#ffb347', at.tipo === 'rayo' ? at.cada : 0.1);
    if (at.tipo === 'laser' || Math.random() < 0.3) this.dron.accion('Atacar');
    ctx.sonido(at.tipo === 'laser' ? 'shot' : 'zap');
  }

  // --------------------------------------------------------- Habilidad

  private contarCerca(x: number, z: number, r: number) {
    let n = 0;
    this.enemies.forEachInRadius(x, z, r, () => n++);
    return n;
  }

  private habilidad(ctx: ContextoCompanero, k: number) {
    if (this.cdHabilidad > 0) return;
    const h = this.perfil.habilidad;
    const d = this.dron.posicion;
    const reintenta = () => { this.cdHabilidad = 1; };
    const suelo = (x: number, z: number) => this.world.heightAt(x, z) + 0.15;

    switch (h.tipo) {
      case 'rafaga': {
        this.golpeados.clear();
        let n = 0;
        for (; n < 5; n++) {
          const i = this.enemies.nearest(d.x, d.z, h.radio, this.golpeados);
          if (i < 0) break;
          this.golpeados.add(i);
          this.efectos.rayo(this.origen(), this.impacto(i), '#ffd25a', 0.25);
          this.enemies.hit(i, h.valor * k, d.x, d.z, 0.4);
        }
        if (!n) return reintenta();
        ctx.sonido('pulse');
        break;
      }
      case 'aullido':
      case 'ladrido': {
        if (this.contarCerca(d.x, d.z, h.radio) < 2) return reintenta();
        const ladrido = h.tipo === 'ladrido';
        this.enemies.forEachInRadius(d.x, d.z, h.radio, (i) => {
          this.enemies.hit(i, h.valor * k, d.x, d.z, ladrido ? 1.4 : 0.2);
          this.enemies.slow[i] = ladrido ? 1.5 : 3;
          this.enemies.slowFactor[i] = ladrido ? 0.5 : 0.4;
        });
        this.efectos.onda(d.x, suelo(d.x, d.z), d.z, h.radio, ladrido ? '#ffffff' : '#9ff0ff', 0.6);
        if (!ladrido) this.efectos.onda(d.x, suelo(d.x, d.z), d.z, h.radio * 0.6, '#d8fbff', 0.45);
        this.efectos.nieve(d.x, suelo(d.x, d.z) + 0.3, d.z, 14, 3);
        ctx.sonido(ladrido ? 'guau' : 'aullido');
        this.vida?.interrumpir();
        break;
      }
      case 'parche':
        if (ctx.vida > 0.85) return reintenta();
        ctx.curar(h.valor);
        this.efectos.onda(ctx.px, suelo(ctx.px, ctx.pz), ctx.pz, 2.5, '#7ef0a0', 0.6);
        this.efectos.rayo(this.origen(), this.b.set(ctx.px, ctx.py + 1.4, ctx.pz), '#7ef0a0', 0.5);
        ctx.sonido('cura');
        break;
      case 'marea':
        if (this.pickups.atraer(ctx.px, ctx.pz, h.radio) === 0) return reintenta();
        this.efectos.onda(ctx.px, suelo(ctx.px, ctx.pz), ctx.pz, 8, this.perfil.color, 0.8);
        ctx.sonido('pulse');
        break;
      case 'sobrecarga':
        if (this.contarCerca(ctx.px, ctx.pz, h.radio) < 3) return reintenta();
        this.enemies.forEachInRadius(ctx.px, ctx.pz, h.radio, (i) => this.enemies.hit(i, h.valor * k, ctx.px, ctx.pz, 1.2));
        this.efectos.onda(ctx.px, suelo(ctx.px, ctx.pz), ctx.pz, h.radio, '#5ee0ff', 0.55);
        this.efectos.onda(ctx.px, suelo(ctx.px, ctx.pz), ctx.pz, h.radio * 0.7, '#ff8a3d', 0.4);
        ctx.sonido('pulse');
        break;
    }
    this.dron.accion('Habilidad');
    this.cdHabilidad = h.cada;
  }

  // ----------------------------------------------------------- Eventos

  alSubirNivel() {
    this.sentir('feliz', 2.5);
    if (this.presa) return;
    if (this.vida) this.vida.celebrar();
    else this.dron.accion('Hablar', 1.2);
  }

  alReliquia() {
    this.sentir('sorpresa', 1.2);
    this.vida?.aullar();
  }

  dispose() {
    this.efectos.dispose();
  }
}

// ============================================================ Vida del perro

type Paso =
  | { tipo: 'ir'; x: number; z: number }
  | { tipo: 'anim'; clip: string; seg?: number; mirar?: { x: number; z: number }; alEmpezar?: () => void; alAcabar?: () => void; nieve?: boolean; hastaQueTeMuevas?: boolean };

/**
 * El perro no se limita a seguirte: entre ataque y ataque olfatea lo que hay
 * alrededor, escarba la nieve (y a veces saca chatarra), trae piezas que se
 * te han quedado atrás, se revuelca, se rasca, se persigue la cola, patina en
 * los lagos helados, ladra a las antenas de HELIOS y, si te quedas quieto
 * mucho rato, se echa a dormir.
 */
class VidaPerro {
  private plan: Paso[] = [];
  private paso = 0;
  private tPaso = 0;
  private empezado = false;
  private espera = 2.5;
  private quieto = 0;
  private cdResbalar = 0;
  private cdNieve = 0;
  // Patineta voladora: la saca para alcanzarte y de vez en cuando hace un truco.
  private patinT = 0;
  private patinYa = 0;
  private cdPatin = 6;
  private cdTruco = 2;

  constructor(private dron: Dron, private pickups: Pickups, private world: World, private efectos: Efectos) {}

  reset() {
    this.plan = [];
    this.espera = 2.5;
    this.quieto = 0;
    this.patinT = 0;
    this.cdPatin = 6;
  }

  private guardarPatineta() {
    this.patinT = 0;
    this.cdPatin = 7 + Math.random() * 6;
    if (this.dron.accionActual === 'Patinar' || this.dron.accionActual === 'Truco') this.dron.cancelarAccion();
  }

  interrumpir() {
    if (!this.plan.length) return;
    this.plan = [];
    this.dron.cancelarAccion();
    this.espera = 2 + Math.random() * 2;
  }

  celebrar() {
    this.interrumpir();
    this.dron.accion('Celebrar');
    const p = this.dron.posicion;
    this.efectos.nieve(p.x, p.y + 0.2, p.z, 10, 2.5);
  }

  aullar() {
    this.lanzar([{ tipo: 'anim', clip: 'Aullar' }]);
  }

  private lanzar(plan: Paso[]) {
    this.dron.cancelarAccion();
    this.plan = plan;
    this.paso = 0;
    this.tPaso = 0;
    this.empezado = false;
  }

  update(dt: number, ctx: ContextoCompanero, cazando: boolean) {
    const p = this.dron.posicion;
    this.quieto = ctx.velocidadJugador < 0.4 ? this.quieto + dt : 0;
    this.cdResbalar -= dt;
    if (cazando || this.dron.modo !== 'seguir') {
      if (this.plan.length) this.interrumpir();
      if (this.patinT > 0) this.guardarPatineta();
      return;
    }
    const lejos = Math.hypot(p.x - ctx.px, p.z - ctx.pz);

    // Patineta: si se queda atrás o vas muy deprisa, la saca y te alcanza.
    this.cdPatin -= dt;
    if (this.patinT <= 0 && this.cdPatin <= 0 && (lejos > 7 || ctx.velocidadJugador > 6.5 || this.dron.rapidez > 6) && Math.random() < dt * 1.5) {
      if (this.plan.length) this.interrumpir();
      this.patinT = 4 + Math.random() * 4;
      this.patinYa = 0;
      this.cdTruco = 1.2 + Math.random() * 2;
      this.dron.accion('Patinar', 0.3);
      this.efectos.nieve(p.x, p.y + 0.2, p.z, 8, 2);
      ctx.sonido('zap');
    }
    if (this.patinT > 0) {
      this.patinT -= dt;
      this.patinYa += dt;
      const alcanzado = this.patinYa > 2 && lejos < 2.5 && this.dron.rapidez < 1;
      if (this.patinT <= 0 || alcanzado) {
        this.guardarPatineta();
        this.efectos.nieve(p.x, p.y + 0.2, p.z, 6, 1.8);
      } else {
        this.cdTruco -= dt;
        if (this.cdTruco <= 0 && this.dron.accionActual === 'Patinar') {
          this.dron.accion('Truco');
          this.cdTruco = 2.5 + Math.random() * 3;
          ctx.sonido('jump');
        } else {
          this.dron.mantener('Patinar');
        }
        return;
      }
    }

    // Si te alejas, deja lo que esté haciendo y te sigue.
    if (this.plan.length && lejos > 11) this.interrumpir();

    // En los lagos helados patina un momento.
    if (!this.plan.length && this.cdResbalar <= 0 && this.dron.rapidez > 2.5 && this.world.onIce(p.x, p.z)) {
      this.dron.accion('Resbalar', 0.9);
      this.cdResbalar = 4;
    }

    if (!this.plan.length) {
      if (this.quieto > 14) {
        this.lanzar([{ tipo: 'anim', clip: 'Bostezar' }, { tipo: 'anim', clip: 'Dormir', hastaQueTeMuevas: true }]);
      } else {
        this.espera -= dt;
        if (this.espera <= 0 && lejos < 7 && ctx.velocidadJugador < 2 && !this.dron.ocupado) this.lanzar(this.elegir(ctx));
      }
      if (!this.plan.length) return;
    }
    this.ejecutar(dt, ctx);
  }

  private ejecutar(dt: number, ctx: ContextoCompanero) {
    const paso = this.plan[this.paso];
    const p = this.dron.posicion;
    this.tPaso += dt;
    let hecho = false;

    if (paso.tipo === 'ir') {
      this.dron.ir(paso.x, paso.z);
      hecho = Math.hypot(p.x - paso.x, p.z - paso.z) < 0.9 || this.tPaso > 4;
    } else {
      if (!this.empezado) {
        this.empezado = true;
        paso.alEmpezar?.();
        if (!this.dron.accion(paso.clip, paso.seg ?? 0)) hecho = true;
      }
      this.dron.parar();
      if (paso.mirar) this.dron.mirar(paso.mirar.x, paso.mirar.z);
      if (paso.nieve) {
        this.cdNieve -= dt;
        if (this.cdNieve <= 0) {
          this.cdNieve = 0.12;
          const a = this.dron.posicion;
          this.efectos.nieve(a.x, this.world.heightAt(a.x, a.z) + 0.2, a.z, 3, 2.2);
        }
      }
      if (paso.hastaQueTeMuevas) {
        // Dormido sigue dormido hasta que te mueves.
        if (!this.dron.ocupado) this.dron.accion(paso.clip, 999);
        hecho = ctx.velocidadJugador > 0.8;
        if (hecho) this.dron.cancelarAccion();
      } else if (this.empezado && !this.dron.ocupado) {
        hecho = true;
      }
    }

    if (hecho) {
      if (paso.tipo === 'anim') paso.alAcabar?.();
      this.paso++;
      this.tPaso = 0;
      this.empezado = false;
      if (this.paso >= this.plan.length) {
        this.plan = [];
        this.espera = 3 + Math.random() * 4;
      }
    }
  }

  /** Qué hacer ahora: un plan de pasos, elegido con pesos según lo que hay cerca. */
  private elegir(ctx: ContextoCompanero): Paso[] {
    const p = this.dron.posicion;
    const opciones: { peso: number; plan: () => Paso[] }[] = [];

    // Traer chatarra que se te ha quedado atrás.
    const pieza = this.pickups.cercana(ctx.px, ctx.pz, 14);
    if (pieza) opciones.push({ peso: 4, plan: () => [
      { tipo: 'ir', x: pieza.x, z: pieza.z },
      { tipo: 'anim', clip: 'Olfatear', seg: 0.5 },
      { tipo: 'anim', clip: 'Celebrar', alEmpezar: () => this.pickups.atraer(pieza.x, pieza.z, 2.5) },
    ] });

    // Algo interesante del mapa cerca de ti.
    const punto = this.puntoCerca(ctx.px, ctx.pz, 10);
    if (punto) opciones.push({ peso: 3, plan: () => this.planPunto(punto, ctx) });

    // Escarbar aquí mismo: a veces sale chatarra de debajo de la nieve.
    opciones.push({ peso: 2, plan: () => {
      const premio = Math.random() < 0.4;
      return [
        { tipo: 'anim', clip: 'Olfatear', seg: 1 },
        { tipo: 'anim', clip: 'Escarbar', seg: 2, nieve: true, alAcabar: () => {
          if (premio) this.pickups.drop(p.x, p.z, 2);
        } },
        ...(premio ? [{ tipo: 'anim', clip: 'Celebrar' } as Paso] : [{ tipo: 'anim', clip: 'Sacudirse' } as Paso]),
      ];
    } });

    // Juego libre.
    const solos: [number, Paso[]][] = [
      [1, [{ tipo: 'anim', clip: 'Sacudirse', alEmpezar: () => this.efectos.nieve(p.x, p.y + 0.5, p.z, 12, 2) }]],
      [1, [{ tipo: 'anim', clip: 'Revolcarse', nieve: true }, { tipo: 'anim', clip: 'Sacudirse' }]],
      [1, [{ tipo: 'anim', clip: 'PerseguirCola', seg: 2.7 }]],
      [1, [{ tipo: 'anim', clip: 'Rascarse', seg: 1.6 }]],
      [1.2, [{ tipo: 'anim', clip: 'Sentado', seg: 3, mirar: { x: ctx.px, z: ctx.pz } }]],
      [0.8, [{ tipo: 'anim', clip: 'Olfatear', seg: 2.4 }]],
      [0.5, [{ tipo: 'anim', clip: 'Bostezar' }]],
      [0.3, [{ tipo: 'anim', clip: 'Aullar' }]],
    ];
    if (Math.hypot(p.x - ctx.px, p.z - ctx.pz) < 4) {
      solos.push([1, [{ tipo: 'anim', clip: 'Pedir', seg: 2, mirar: { x: ctx.px, z: ctx.pz } }]]);
    }
    for (const [peso, plan] of solos) opciones.push({ peso, plan: () => plan });

    let total = 0;
    for (const o of opciones) total += o.peso;
    let r = Math.random() * total;
    for (const o of opciones) {
      r -= o.peso;
      if (r <= 0) return o.plan();
    }
    return opciones[0].plan();
  }

  private puntoCerca(x: number, z: number, radio: number): PuntoInteres | null {
    let mejor: PuntoInteres | null = null, d2 = radio * radio;
    for (const q of this.world.interes) {
      const d = (q.x - x) ** 2 + (q.z - z) ** 2;
      if (d < d2 && Math.random() < 0.7) { d2 = d; mejor = q; }
    }
    return mejor;
  }

  private planPunto(q: PuntoInteres, ctx: ContextoCompanero): Paso[] {
    const p = this.dron.posicion;
    // Se queda a un paso del objeto, del lado por el que llega.
    const dx = p.x - q.x, dz = p.z - q.z;
    const d = Math.hypot(dx, dz) || 1;
    const margen = q.tipo === 'antena' ? 3.2 : q.tipo === 'cristal' ? 1.8 : 1.1;
    const ir: Paso = { tipo: 'ir', x: q.x + (dx / d) * margen, z: q.z + (dz / d) * margen };
    const mirar = { x: q.x, z: q.z };
    const olfatear: Paso = { tipo: 'anim', clip: 'Olfatear', seg: 1.6, mirar };
    switch (q.tipo) {
      case 'antena':
        // Las antenas de HELIOS no le gustan nada.
        return [ir, olfatear, { tipo: 'anim', clip: 'Ladrar', seg: 1.5, mirar, alEmpezar: () => ctx.sonido('guau') }, { tipo: 'anim', clip: 'Sacudirse' }];
      case 'cristal':
        return [ir, olfatear, { tipo: 'anim', clip: 'Ladrar', seg: 0.5, mirar, alEmpezar: () => {
          ctx.sonido('guau');
          this.efectos.onda(q.x, this.world.heightAt(q.x, q.z) + 0.2, q.z, 2.2, '#9ff0ff', 0.5);
        } }, { tipo: 'anim', clip: 'Hablar', seg: 1.4, mirar }];
      case 'arbol':
        return [ir, olfatear, { tipo: 'anim', clip: 'Escarbar', seg: 1.4, nieve: true, mirar }];
      default:
        return [ir, olfatear, { tipo: 'anim', clip: 'Sentado', seg: 1.5 }];
    }
  }
}
