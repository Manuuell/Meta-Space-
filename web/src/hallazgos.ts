import type * as THREE from 'three';
import type { Modelo } from './modelos/kit.ts';
import { crearRacion } from './modelos/racion.ts';
import { crearImanGrua } from './modelos/iman-grua.ts';
import { crearJaula } from './modelos/jaula.ts';
import { crearSuperviviente } from './modelos/superviviente.ts';
import { crearGuardian } from './modelos/guardian.ts';
import { crearFragua } from './modelos/fragua.ts';
import { crearFragmento } from './modelos/fragmento.ts';
import { DEF_RANURA, RANURAS, type Ranura } from './nave/piezas.ts';
import { EMBOSCADA, FRAGUA, GUARDIAN, IMANES, JAULAS, RACIONES, RESTOS, SUPERVIVIENTES, type Efecto, type Superviviente } from './contenido/mapa.ts';
import type { World } from './world.ts';

// Hallazgos del sector: lo que se encuentra explorando además de altares y
// cofres. Raciones que curan, imanes de grúa que llaman a toda la chatarra,
// las emboscadas de las cajas trampa, jaulas con supervivientes que luego te
// cubren con bengalas, el Guardián dormido y la Fragua del Deshielo.
//
// Vive aparte de ContenidoJuego, que le presta cómo poner actores, buscar
// sitio y reproducir clips (`Taller`), y le pide marcas para el mapa, avisos
// de la tecla F y la barra grande del HUD. Los números, en contenido/mapa.ts.

/** Lo justo de un actor de ContenidoJuego que usan los hallazgos. */
export interface ActorHallazgo {
  id: string;
  modelo: Modelo;
  mixer: THREE.AnimationMixer;
  x: number;
  z: number;
}

/** Lo que ContenidoJuego presta: poner y quitar actores, buscar sitio y sus clips. */
export interface Taller {
  poner(id: string, crear: () => Modelo, x: number, z: number, giro: number, clip: string): ActorHallazgo;
  buscar(distancia: readonly [number, number], margen: number, separacion: number): { x: number; z: number };
  reproducir(actor: ActorHallazgo, clip: string, unaVez?: boolean): void;
  visto(id: string): boolean;
  rand(): number;
}

export interface OpcionHallazgo {
  id: string;
  titulo: string;
  texto: string;
  color: string;
  efecto: Efecto[];
}

/** Lo que los hallazgos le piden al juego. */
export interface EventosHallazgos {
  /** Se ha recuperado un resto de la flota. */
  fragmento?: (ranura: Ranura) => void;
  toast: (quien: string, texto: string, segundos?: number) => void;
  aplicar: (efectos: Efecto[]) => void;
  curar: (cantidad: number) => void;
  aviso?: (texto: string) => void;
  sacudida?: () => void;
  /** Saca `cuantos` enemigos en corro alrededor de (x, z). */
  emboscada?: (x: number, z: number, cuantos: number, radio: number) => void;
  /** Una bengala de un superviviente: de dónde sale, a qué punto va y cuánto daña. */
  bengala?: (desde: { x: number; y: number; z: number }, hacia: { x: number; z: number }, dano: number) => void;
  /** Elegir entre tarjetas (el regalo del Guardián); `listo` se llama al elegir. */
  elegir?: (titulo: string, frase: string, opciones: OpcionHallazgo[], listo: () => void) => void;
  /**
   * La Fragua: el juego comprueba las herramientas y abre la elección.
   * Devuelve si la abrió; `hecho` se llama solo si al final se forjó.
   */
  forjar?: (coste: number, hecho: () => void) => boolean;
}

export interface ContextoHallazgos {
  dt: number;
  px: number;
  pz: number;
  /** Si al jugador le falta vida (las raciones solo se recogen entonces). */
  herido: boolean;
  /** El enemigo vivo más cercano a (x, z) dentro de `radio`, si lo hay. */
  enemigoCercano: (x: number, z: number, radio: number) => { x: number; z: number } | null;
}

export type TipoHallazgo = 'racion' | 'iman' | 'jaula' | 'guardian' | 'fragua' | 'fragmento';

/** Un resto de la flota de Ares: se recupera quedándose a su lado. */
interface Resto {
  actor: ActorHallazgo;
  ranura: Ranura;
  estado: 'intacto' | 'recuperando' | 'hecho';
  progreso: number;
}

export interface MarcaHallazgo {
  id: string;
  tipo: TipoHallazgo;
  x: number;
  z: number;
  hecho: boolean;
  visto: boolean;
}

interface Racion { actor: ActorHallazgo; tomada: boolean }
interface Iman { actor: ActorHallazgo; usado: boolean; t: number }
interface Jaula {
  actor: ActorHallazgo;
  preso: ActorHallazgo;
  def: Superviviente;
  estado: 'cerrada' | 'libre' | 'adios' | 'ido';
  t: number;
  cd: number;
  disparando: number;
}
interface Guardian {
  actor: ActorHallazgo;
  estado: 'dormido' | 'despertando' | 'despierto' | 'eligiendo' | 'agradece' | 'agotado';
  progreso: number;
  t: number;
  oleada: number;
}
interface Fragua { actor: ActorHallazgo; usos: number }
interface Emboscada { x: number; z: number; t: number; segunda: boolean; botin: Efecto[] }

const haciaCentro = (x: number, z: number) => Math.atan2(-x, -z);
/** Velocidad a la que un superviviente sigue al jugador (m/s). */
const PASO_ALIADO = 6.5;

export class Hallazgos {
  private taller: Taller;
  private world: World;
  private eventos: EventosHallazgos;
  private raciones: Racion[] = [];
  private imanes: Iman[] = [];
  private jaulas: Jaula[] = [];
  private guardian: Guardian | null = null;
  private fragua: Fragua | null = null;
  private emboscadas: Emboscada[] = [];
  private restos: Resto[] = [];

  constructor(taller: Taller, world: World, eventos: EventosHallazgos) {
    this.taller = taller;
    this.world = world;
    this.eventos = eventos;
  }

  /** Olvida lo de otro sector (los actores los quita quien los puso). */
  vaciar() {
    this.raciones = [];
    this.imanes = [];
    this.jaulas = [];
    this.guardian = null;
    this.fragua = null;
    this.emboscadas = [];
    this.restos = [];
  }

  /** Reparte los hallazgos por el sector. */
  colocar(raciones: number = RACIONES.cuantas) {
    const t = this.taller;
    for (let k = 0; k < raciones; k++) {
      const p = t.buscar(RACIONES.distancia, 1, RACIONES.separacion);
      this.raciones.push({ actor: t.poner('racion-' + k, crearRacion, p.x, p.z, t.rand() * 6.28, 'Reposo'), tomada: false });
    }
    for (let k = 0; k < IMANES.cuantos; k++) {
      const p = t.buscar(IMANES.distancia, 2, IMANES.separacion);
      this.imanes.push({ actor: t.poner('iman-' + k, crearImanGrua, p.x, p.z, haciaCentro(p.x, p.z), 'Reposo'), usado: false, t: 0 });
    }
    for (let k = 0; k < JAULAS.cuantas; k++) {
      const p = t.buscar(JAULAS.distancia, 3, JAULAS.separacion);
      const giro = haciaCentro(p.x, p.z);
      const actor = t.poner('jaula-' + k, crearJaula, p.x, p.z, giro, 'Reposo');
      const preso = t.poner('superviviente-' + k, () => crearSuperviviente(k), p.x, p.z, giro, 'Trabajar');
      this.jaulas.push({ actor, preso, def: SUPERVIVIENTES[k % SUPERVIVIENTES.length], estado: 'cerrada', t: 0, cd: 0, disparando: 0 });
    }
    const g = t.buscar(GUARDIAN.distancia, 5, 30);
    this.guardian = { actor: t.poner('guardian', crearGuardian, g.x, g.z, haciaCentro(g.x, g.z), 'Dormido'), estado: 'dormido', progreso: 0, t: 0, oleada: 0 };
    const f = t.buscar(FRAGUA.distancia, 4, 24);
    this.fragua = { actor: t.poner('fragua', crearFragua, f.x, f.z, haciaCentro(f.x, f.z), 'Reposo'), usos: FRAGUA.usos };
    RANURAS.forEach((ranura) => {
      for (let k = 0; k < RESTOS.porRanura; k++) {
        const p = this.sitioSeco();
        const actor = t.poner(`resto-${ranura}-${k}`, () => crearFragmento(ranura), p.x, p.z, t.rand() * 6.28, 'Reposo');
        this.restos.push({ actor, ranura, estado: 'intacto', progreso: 0 });
      }
    });
  }

  /** Vuelve a dejarlo todo como al empezar el sector. */
  reset() {
    const t = this.taller;
    for (const r of this.raciones) { r.tomada = false; t.reproducir(r.actor, 'Reposo'); }
    for (const i of this.imanes) { i.usado = false; i.t = 0; t.reproducir(i.actor, 'Reposo'); }
    for (const j of this.jaulas) {
      j.estado = 'cerrada';
      j.t = j.cd = j.disparando = 0;
      this.mover(j.preso, j.actor.x, j.actor.z);
      j.preso.modelo.raiz.rotation.y = j.actor.modelo.raiz.rotation.y;
      t.reproducir(j.actor, 'Reposo');
      t.reproducir(j.preso, 'Trabajar');
    }
    if (this.guardian) {
      Object.assign(this.guardian, { estado: 'dormido', progreso: 0, t: 0, oleada: 0 });
      t.reproducir(this.guardian.actor, 'Dormido');
    }
    if (this.fragua) { this.fragua.usos = FRAGUA.usos; t.reproducir(this.fragua.actor, 'Reposo'); }
    this.emboscadas = [];
    // Cada partida los restos caen en otro sitio: hay que volver a explorar.
    for (const r of this.restos) {
      const p = this.sitioSeco();
      this.mover(r.actor, p.x, p.z);
      r.estado = 'intacto';
      r.progreso = 0;
      t.reproducir(r.actor, 'Reposo');
    }
  }

  private mover(actor: ActorHallazgo, x: number, z: number) {
    actor.x = x;
    actor.z = z;
    actor.modelo.raiz.position.set(x, this.world.heightAt(x, z), z);
  }

  /** La caja trampa: dos oleadas alrededor y el botín si se aguanta. */
  emboscar(x: number, z: number, botin: Efecto[]) {
    this.emboscadas.push({ x, z, t: 0, segunda: false, botin });
    this.eventos.emboscada?.(x, z, EMBOSCADA.enemigos, EMBOSCADA.radio);
    this.eventos.aviso?.(`¡Era un cebo de HELIOS! Aguanta ${EMBOSCADA.segundos} s`);
    this.eventos.toast('ADA', 'La caja era una trampa: viene una emboscada. Si aguantamos, el botín es doble.', 4);
    this.eventos.sacudida?.();
  }

  update(c: ContextoHallazgos) {
    const t = this.taller;
    const cerca = (a: ActorHallazgo, r: number) => Math.hypot(c.px - a.x, c.pz - a.z) < r;

    for (const r of this.raciones) {
      if (r.tomada || !c.herido || !cerca(r.actor, 1.6)) continue;
      r.tomada = true;
      this.eventos.curar(RACIONES.cura);
      t.reproducir(r.actor, 'Recoger', true);
      this.eventos.toast('ADA', `Ración de la colonia: +${RACIONES.cura} de integridad.`, 2);
    }

    for (const i of this.imanes) {
      if (i.usado) {
        i.t += c.dt;
        if (i.t > 1.4 && i.t - c.dt <= 1.4) t.reproducir(i.actor, 'Apagado');
        continue;
      }
      if (!cerca(i.actor, 2.4)) continue;
      i.usado = true;
      i.t = 0;
      t.reproducir(i.actor, 'Activar', true);
      this.eventos.aplicar([{ tipo: 'imanTotal' }]);
      this.eventos.sacudida?.();
      this.eventos.toast('ADA', 'He encendido el imán de la grúa: toda la chatarra del sector viene hacia nosotros.', 4);
    }

    for (let k = this.emboscadas.length - 1; k >= 0; k--) {
      const e = this.emboscadas[k];
      e.t += c.dt;
      if (!e.segunda && e.t >= EMBOSCADA.segunda) {
        e.segunda = true;
        this.eventos.emboscada?.(e.x, e.z, EMBOSCADA.enemigos, EMBOSCADA.radio + 2);
      }
      if (Math.hypot(c.px - e.x, c.pz - e.z) > EMBOSCADA.huida) {
        this.emboscadas.splice(k, 1);
        this.eventos.toast('ADA', 'Nos hemos alejado de la emboscada: el botín se ha quedado allí, perdido.', 4);
      } else if (e.t >= EMBOSCADA.segundos) {
        this.emboscadas.splice(k, 1);
        this.eventos.aplicar(e.botin);
        this.eventos.aviso?.('¡Emboscada superada! Botín doble');
      }
    }

    for (const j of this.jaulas) this.actualizarAliado(j, c);
    this.actualizarGuardian(c);
    for (const r of this.restos) this.actualizarResto(r, c);
  }

  /** Un sitio para un resto, fuera del ácido: hay que poder quedarse a su lado. */
  private sitioSeco() {
    const mojado = (x: number, z: number) => (this.world.acidoEn?.(x, z) ?? 0) > 0;
    let p = this.taller.buscar(RESTOS.distancia, 3, RESTOS.separacion);
    const r = RESTOS.radio + 2;
    for (let k = 0; k < 16 && [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].some(([dx, dz]) => mojado(p.x + dx, p.z + dz)); k++) {
      p = this.taller.buscar(RESTOS.distancia, 3, RESTOS.separacion);
    }
    return p;
  }

  /** Quedarse al lado lo recupera; si te vas, se pierde lo avanzado poco a poco. */
  private actualizarResto(r: Resto, c: ContextoHallazgos) {
    if (r.estado === 'hecho') return;
    const dentro = Math.hypot(c.px - r.actor.x, c.pz - r.actor.z) < RESTOS.radio;
    if (dentro && r.estado === 'intacto') {
      r.estado = 'recuperando';
      // La respuesta de HELIOS crece con cada resto que le quitas.
      this.eventos.emboscada?.(r.actor.x, r.actor.z, RESTOS.oleada + this.cuentaRestos.recogidos, 15);
      this.eventos.toast('ADA', `${DEF_RANURA[r.ranura].fragmento} localizada. Quédate cerca: HELIOS ya viene.`, 3);
    }
    if (dentro) r.progreso += c.dt;
    else if (r.progreso > 0) r.progreso = Math.max(0, r.progreso - c.dt * 0.5);
    if (r.progreso < RESTOS.segundos) return;
    r.estado = 'hecho';
    this.taller.reproducir(r.actor, 'Recoger', true);
    this.eventos.fragmento?.(r.ranura);
  }

  /** Cuántos restos hay en este sector y cuántos se han recuperado. */
  get cuentaRestos() {
    return { total: this.restos.length, recogidos: this.restos.filter((r) => r.estado === 'hecho').length };
  }

  /** El resto pendiente más cercano: es lo que señala la brújula del HUD. */
  restoCercano(x: number, z: number): { x: number; z: number; ranura: Ranura } | null {
    let mejor: Resto | null = null, d = Infinity;
    for (const r of this.restos) {
      if (r.estado === 'hecho') continue;
      const e = Math.hypot(x - r.actor.x, z - r.actor.z);
      if (e < d) { d = e; mejor = r; }
    }
    return mejor ? { x: mejor.actor.x, z: mejor.actor.z, ranura: mejor.ranura } : null;
  }

  /** Superviviente libre: sigue al jugador, dispara bengalas y al final se despide. */
  private actualizarAliado(j: Jaula, c: ContextoHallazgos) {
    if (j.estado === 'cerrada' || j.estado === 'ido') return;
    const t = this.taller;
    j.t += c.dt;
    const a = j.preso;
    if (j.estado === 'adios') {
      if (j.t > 1.6) {
        j.estado = 'ido';
        // Se vuelve al refugio: fuera de la vista hasta el siguiente sector.
        a.modelo.raiz.position.y = -60;
      }
      return;
    }
    const dx = c.px - a.x, dz = c.pz - a.z, d = Math.hypot(dx, dz) || 1;
    const anda = d > 3.2;
    if (anda) this.mover(a, a.x + dx / d * Math.min(d - 3, PASO_ALIADO * c.dt), a.z + dz / d * Math.min(d - 3, PASO_ALIADO * c.dt));
    // Si se queda muy atrás (lo deja la aerotabla), se acerca de un salto.
    if (d > 30) this.mover(a, c.px - dx / d * 4, c.pz - dz / d * 4);
    let mira = Math.atan2(dx, dz);
    j.cd -= c.dt;
    j.disparando -= c.dt;
    if (j.cd <= 0) {
      const e = c.enemigoCercano(a.x, a.z, JAULAS.alcance);
      if (e) {
        j.cd = JAULAS.cada;
        j.disparando = 0.45;
        mira = Math.atan2(e.x - a.x, e.z - a.z);
        a.modelo.raiz.rotation.y = mira;
        this.eventos.bengala?.({ x: a.x, y: this.world.heightAt(a.x, a.z) + 1.6, z: a.z }, e, JAULAS.dano);
        t.reproducir(a, 'Disparar', true);
      }
    }
    if (j.disparando <= 0) {
      a.modelo.raiz.rotation.y = mira;
      t.reproducir(a, anda ? 'Caminar' : 'Reposo');
    }
    if (j.t >= JAULAS.segundos) {
      j.estado = 'adios';
      j.t = 0;
      t.reproducir(a, 'Saludar', true);
      this.eventos.toast(j.def.nombre, j.def.adios, 4);
    }
  }

  private actualizarGuardian(c: ContextoHallazgos) {
    const g = this.guardian;
    if (!g) return;
    const t = this.taller;
    g.t += c.dt;
    if (g.estado === 'despertando') {
      const dentro = Math.hypot(c.px - g.actor.x, c.pz - g.actor.z) <= GUARDIAN.radio;
      g.progreso = dentro ? g.progreso + c.dt : Math.max(0, g.progreso - c.dt * 0.5);
      g.oleada -= c.dt;
      if (g.oleada <= 0) {
        g.oleada = GUARDIAN.oleada.cada;
        this.eventos.emboscada?.(g.actor.x, g.actor.z, GUARDIAN.oleada.enemigos, GUARDIAN.radio + 4);
      }
      if (g.progreso >= GUARDIAN.segundos) {
        g.estado = 'despierto';
        g.t = 0;
        t.reproducir(g.actor, 'Despertar', true);
        this.eventos.sacudida?.();
        this.eventos.aviso?.('¡El Guardián ha despertado!');
      }
    } else if (g.estado === 'despierto' && g.t > 2.1) {
      g.estado = 'eligiendo';
      t.reproducir(g.actor, 'Despierto');
      const opciones = GUARDIAN.premios.map((p) => ({ id: p.id === 'bendicion' ? 'generico' : 'chatarra', titulo: p.titulo, texto: p.texto, color: p.id === 'bendicion' ? '#ffd25a' : '#b8bccb', efecto: [...p.efecto] }));
      const fin = () => { g.estado = 'agradece'; g.t = 0; t.reproducir(g.actor, 'Agradecer', true); };
      if (this.eventos.elegir) this.eventos.elegir('¡EL GUARDIÁN DESPIERTA!', 'La vieja cosechadora te reconoce. Elige su regalo.', opciones, fin);
      else { this.eventos.aplicar(opciones[0].efecto); fin(); }
    } else if (g.estado === 'agradece' && g.t > 1.7) {
      g.estado = 'agotado';
      t.reproducir(g.actor, 'Dormirse', true);
      this.eventos.toast('ADA', 'El Guardián vuelve a dormirse. Le hemos dado una buena razón para soñar.', 4);
    }
  }

  // ------------------------------------------------------------ tecla F

  private jaulaCercana(x: number, z: number) {
    return this.jaulas.find((j) => j.estado === 'cerrada' && Math.hypot(x - j.actor.x, z - j.actor.z) < 2.8) ?? null;
  }

  private guardianCerca(x: number, z: number) {
    const g = this.guardian;
    return g && g.estado === 'dormido' && Math.hypot(x - g.actor.x, z - g.actor.z) < 6.5 ? g : null;
  }

  private fraguaCerca(x: number, z: number) {
    const f = this.fragua;
    return f && Math.hypot(x - f.actor.x, z - f.actor.z) < 3.8 ? f : null;
  }

  /** El aviso de la tecla F si hay algo a mano. */
  interaccion(x: number, z: number, chatarra: number): { tecla: string; texto: string; coste?: number; bloqueado?: boolean } | undefined {
    const j = this.jaulaCercana(x, z);
    if (j) return { tecla: 'F', texto: `Abrir la jaula de ${j.def.nombre}` };
    if (this.guardianCerca(x, z)) return { tecla: 'F', texto: `Despertar al Guardián (aguanta ${GUARDIAN.segundos} s a su lado)` };
    const f = this.fraguaCerca(x, z);
    if (f) {
      if (f.usos <= 0) return { tecla: 'F', texto: 'La fragua ya está fría', bloqueado: true };
      const bloqueado = chatarra < FRAGUA.coste;
      return { tecla: 'F', texto: `Fundir dos herramientas a nivel máximo${bloqueado ? ' (no te llega)' : ''}`, coste: FRAGUA.coste, bloqueado };
    }
    return undefined;
  }

  /** F: abre una jaula, despierta al Guardián o enciende la fragua. Devuelve si hizo algo. */
  usar(x: number, z: number): boolean {
    const t = this.taller;
    const j = this.jaulaCercana(x, z);
    if (j) {
      j.estado = 'libre';
      j.t = 0;
      j.cd = 1.2;
      // Celebra un segundo antes de echar a andar.
      j.disparando = 1;
      t.reproducir(j.actor, 'Abrir', true);
      t.reproducir(j.preso, 'Celebrar');
      this.eventos.toast(j.def.nombre, j.def.libre, 4);
      return true;
    }
    const g = this.guardianCerca(x, z);
    if (g) {
      g.estado = 'despertando';
      g.progreso = 0;
      g.oleada = 1.5;
      this.eventos.aviso?.(`¡HELIOS no quiere que despierte! Aguanta ${GUARDIAN.segundos} s a su lado`);
      return true;
    }
    const f = this.fraguaCerca(x, z);
    if (f && f.usos > 0) {
      this.eventos.forjar?.(FRAGUA.coste, () => {
        f.usos--;
        t.reproducir(f.actor, 'Forjar', true);
        this.eventos.sacudida?.();
      });
    }
    return !!f;
  }

  // ------------------------------------------------------------ HUD y mapa

  /** La barra grande del HUD mientras dura una emboscada o se despierta el Guardián. */
  get barra(): { nombre: string; vida: number; vidaMax: number } | undefined {
    const e = this.emboscadas[0];
    if (e) {
      const resta = Math.max(0, EMBOSCADA.segundos - e.t);
      return { nombre: `Emboscada · aguanta ${Math.ceil(resta)} s`, vida: resta, vidaMax: EMBOSCADA.segundos };
    }
    const r = this.restos.find((x) => x.estado === 'recuperando' && x.progreso > 0);
    if (r) return { nombre: `Recuperando: ${DEF_RANURA[r.ranura].fragmento} · quédate cerca`, vida: r.progreso, vidaMax: RESTOS.segundos };
    const g = this.guardian;
    if (g?.estado === 'despertando') return { nombre: 'Despertando al Guardián · quédate a su lado', vida: g.progreso, vidaMax: GUARDIAN.segundos };
    return undefined;
  }

  get marcas(): MarcaHallazgo[] {
    const v = (id: string) => this.taller.visto(id);
    const m: MarcaHallazgo[] = [];
    for (const r of this.raciones) m.push({ id: r.actor.id, tipo: 'racion', x: r.actor.x, z: r.actor.z, hecho: r.tomada, visto: v(r.actor.id) });
    for (const i of this.imanes) m.push({ id: i.actor.id, tipo: 'iman', x: i.actor.x, z: i.actor.z, hecho: i.usado, visto: v(i.actor.id) });
    for (const j of this.jaulas) m.push({ id: j.actor.id, tipo: 'jaula', x: j.actor.x, z: j.actor.z, hecho: j.estado !== 'cerrada', visto: v(j.actor.id) });
    const g = this.guardian;
    if (g) m.push({ id: g.actor.id, tipo: 'guardian', x: g.actor.x, z: g.actor.z, hecho: g.estado === 'agotado', visto: v(g.actor.id) });
    const f = this.fragua;
    if (f) m.push({ id: f.actor.id, tipo: 'fragua', x: f.actor.x, z: f.actor.z, hecho: f.usos <= 0, visto: v(f.actor.id) });
    for (const r of this.restos) m.push({ id: r.actor.id, tipo: 'fragmento', x: r.actor.x, z: r.actor.z, hecho: r.estado === 'hecho', visto: v(r.actor.id) });
    return m;
  }
}
