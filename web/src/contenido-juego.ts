import * as THREE from 'three';
import type { World } from './world.ts';
import type { Modelo } from './modelos/kit.ts';
import { crearAltarJefe } from './modelos/altar-jefe.ts';
import { crearAltarDesafio } from './modelos/altar-desafio.ts';
import { crearCaja } from './modelos/caja-premio.ts';
import { crearPilonCarga } from './modelos/pilon-carga.ts';
import { crearRefugio } from './modelos/refugio.ts';
import { crearTorreVelo } from './modelos/torre-velo.ts';
import { crearNpcMecanica } from './modelos/npc-mecanica.ts';
import { crearNpcVigia } from './modelos/npc-vigia.ts';
import { crearNpcBotanica } from './modelos/npc-botanica.ts';
import { crearSegadorJefe, TIEMPOS_JEFE_COSECHA } from './modelos/segador-jefe.ts';
import { JefeGolem } from './jefe-golem.ts';
import { JefeVolador } from './jefe-volador.ts';
import type { ObjetivoPiloto } from './demo.ts';
import { crearHeraldo, TIEMPOS_HERALDO } from './modelos/heraldo.ts';
import { crearOjoHelios, TIEMPOS_OJO } from './modelos/ojo-helios.ts';
import {
  ALTARES_JEFE,
  CAJAS,
  CLIPS_ALTAR_JEFE,
  CLIPS_ARA,
  CLIPS_CAJA,
  CLIPS_NPC,
  CLIPS_PILON,
  COLOCACION,
  DESAFIOS,
  DISTANCIAS_NPC,
  DRAGON,
  ESTRUCTURAS,
  CAMPEONES,
  DUELOS,
  GOLEMS,
  MINIJEFES,
  NPCS,
  PILON,
  RADIO_ARA,
  aQuienHabla,
  detectarIntencion,
  frase,
  tirarBotin,
  type AltarJefe,
  type JefeAltarId,
  type Desafio,
  type Efecto,
  type Intencion,
  type NpcMapa,
} from './contenido/mapa.ts';

export type TipoMarca = 'altar' | 'ara' | 'caja' | 'torre' | 'refugio' | 'npc' | 'pilon' | 'duelo' | 'dragon';

/** Lo que acierta un disparo del Cañón solar: a qué distancia y cómo dañarlo. */
export interface AciertoRayo {
  t: number;
  x: number;
  y: number;
  z: number;
  debil: boolean;
  golpear: (cantidad: number) => number;
}

export interface MarcaContenido {
  id: string;
  tipo: TipoMarca;
  x: number;
  z: number;
  hecho?: boolean;
  /** Si el jugador ya lo ha tenido cerca (el mapa grande solo enseña eso). */
  visto?: boolean;
  /** Cofres: lo que cuesta abrirlo ahora. */
  coste?: number;
}

/** Aviso de algo que se puede usar con una tecla («F · Abrir cofre · 20»). */
export interface Interaccion {
  tecla: string;
  texto: string;
  /** Precio en chatarra, si lo tiene. */
  coste?: number;
  /** No te llega la chatarra: el aviso sale en rojo. */
  bloqueado?: boolean;
}

/** Objetivo no instanciado de la horda: jefes y torres aceptan daño real. */
export interface ObjetivoCombate {
  id: string;
  x: number;
  z: number;
  radio: number;
  activo: boolean;
  golpear: (cantidad: number) => number;
}

export interface JefeHud {
  minuto: number;
  nombre: string;
  vencido: boolean;
  vida?: number;
  vidaMax?: number;
}

export interface RespuestaNpc {
  destino: NpcMapa['id'] | 'dron' | null;
  npc?: NpcMapa;
  intencion?: Intencion | null;
  respaldo?: string;
}

interface Actor {
  id: string;
  modelo: Modelo;
  mixer: THREE.AnimationMixer;
  acciones: Map<string, THREE.AnimationAction>;
  actual: string;
  x: number;
  z: number;
  alcanceVista: number;
}

interface EstadoAltar {
  def: AltarJefe;
  actor: Actor;
  estado: 'dormido' | 'invocando' | 'combate' | 'recompensa' | 'listo' | 'agotado';
  t: number;
  adelantado: boolean;
}

interface EstadoCaja {
  actor: Actor;
  def: (typeof CAJAS)[number];
  progreso: number;
  abierta: boolean;
  entregada: boolean;
  dinamica: boolean;
}

interface EstadoPilon {
  actor: Actor;
  /** De 0 a 1. */
  carga: number;
  estado: 'espera' | 'cargando' | 'cargado' | 'agotado';
  t: number;
  premiado: boolean;
  anillo: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
}

interface EstadoDuelo {
  actor: Actor;
  indice: number;
  estado: 'espera' | 'activo' | 'superado' | 'fallado';
  t: number;
  retadores: JefeGolem[];
  arena: THREE.Mesh;
}

interface EstadoTorre {
  actor: Actor;
  vida: number;
  vidaMax: number;
  destruida: boolean;
  tDestruida: number;
}

interface EstadoNpc {
  actor: Actor;
  def: NpcMapa;
  cerca: boolean;
  asustado: boolean;
  despedida: number;
}

interface ChispaAra {
  objeto: THREE.Group;
  baseY: number;
  fase: number;
}

interface EstadoAra {
  actor: Actor;
  desafio: Desafio;
  estado: 'espera' | 'activo' | 'superado' | 'fallado';
  t: number;
  fuera: number;
  bajasInicio: number;
  danoInicio: number;
  recogidas: number;
  chispas: ChispaAra[];
}

type Ataque = {
  nombre: string;
  golpe: number;
  finGolpe: number;
  duracion: number;
};

type TipoMinijefe = 'segador-jefe' | 'heraldo' | 'ojo-helios';

/** Minijefe: los jefes de antes, que ahora salen solos cada cierto tiempo. */
interface EstadoJefe {
  tipo: TipoMinijefe;
  actor: Actor;
  /** Segundos desde que cayó (se quita a los 3,5 s). */
  tMuerto: number;
  nombre: string;
  vida: number;
  vidaMax: number;
  velocidad: number;
  radio: number;
  entrada: number;
  clipMover: string;
  clipEntrada: string;
  clipFase: string;
  clipDerrota: string;
  ataques: Ataque[];
  indiceAtaque: number;
  ataque: Ataque | null;
  tAtaque: number;
  golpeAplicado: boolean;
  fase2: boolean;
  capaFasePendiente: number;
  capaFaseActiva: boolean;
  derrotado: boolean;
}

export interface ContextoContenido {
  tiempo: number;
  dt: number;
  px: number;
  pz: number;
  bajas: number;
  danoRecibido: number;
  balizas: number;
  enemigosEn: (x: number, z: number, radio: number) => number;
  crearBaliza: (x: number, z: number) => void;
  /** Velocidad del jugador: los gólems apuntan adonde va a estar. */
  vx?: number;
  vz?: number;
}

export interface EventosContenido {
  toast: (quien: string, texto: string, segundos?: number) => void;
  aplicar: (efectos: Efecto[]) => void;
  curar: (cantidad: number) => void;
  alarma?: () => void;
  recoger?: () => void;
  /** Gólems: empujan al jugador, avisan de cada ataque y sacuden la cámara. */
  empujar?: (fx: number, fz: number, salto: number) => void;
  aviso?: (texto: string) => void;
  sacudida?: () => void;
  sonido?: (nombre: 'boom' | 'solar' | 'pulse') => void;
}


/**
 * Círculo de carga de un pilón: un aro en el suelo que se llena en el sentido
 * de las agujas del reloj (de cian a oro) y un disco suave que se enciende
 * mientras el jugador está dentro.
 */
function anilloCarga(radio: number): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geo = new THREE.CircleGeometry(radio, 72).rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      progreso: { value: 0 },
      dentro: { value: 0 },
      radio: { value: radio },
      base: { value: new THREE.Color('#5ee0ff') },
      lleno: { value: new THREE.Color('#ffd25a') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float progreso, dentro, radio;
      uniform vec3 base, lleno;
      varying vec2 vP;
      void main() {
        float r = length(vP) / radio;
        float a = atan(vP.x, vP.y) / 6.2831853 + 0.5;
        float aro = smoothstep(0.86, 0.89, r) * (1.0 - smoothstep(0.98, 1.0, r));
        bool cargado = a <= progreso;
        vec3 color = cargado ? lleno : base;
        float alfa = aro * (cargado ? 0.95 : 0.4);
        // Dentro: un disco suave que respira hacia el borde.
        alfa += (1.0 - aro) * step(r, 0.88) * dentro * (0.08 + 0.1 * r);
        gl_FragColor = vec4(color, alfa);
      }`,
  });
  return new THREE.Mesh(geo, material);
}

/** Distancia a lo largo del rayo (o + d·t, d unitario) hasta la esfera, o null si no la toca. */
function rayoEsfera(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, x: number, y: number, z: number, r: number) {
  const ox = o.x - x, oy = o.y - y, oz = o.z - z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (c < 0 ? 0 : null);
}

function rng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Coloca y gobierna el contenido escaso del sector. La horda sigue en
 * Enemies; aquí viven altares, cajas, refugio, NPC, torres y jefes.
 */
/** Metros a los que el mapa (M) apunta lo que hay alrededor. */
export const VISTA_MAPA = 40;

export class ContenidoJuego {
  /** Multiplicadores que aportan las pasivas del operador actual. */
  factorCosteCofre = 1;
  factorCargaPilon = 1;
  /** Hasta dónde se apunta en el mapa lo que hay alrededor (metros). */
  radioVista = VISTA_MAPA;
  /** Jefes apagados un rato por la Orden de apagado de Noa: id → segundos. */
  private aturdidos = new Map<string, number>();
  private rand: () => number;
  private actores: Actor[] = [];
  private altares: EstadoAltar[] = [];
  private cajas: EstadoCaja[] = [];
  private torres: EstadoTorre[] = [];
  private npcs: EstadoNpc[] = [];
  private aras: EstadoAra[] = [];
  private pilones: EstadoPilon[] = [];
  private pilonesGastados = 0;
  private cofresAbiertos = 0;
  /** Ids de lo que el jugador ya ha tenido cerca. */
  private vistos = new Set<string>();
  private jefes: EstadoJefe[] = [];
  private minijefesCreados = 0;
  private siguienteMinijefe: number = MINIJEFES.primero;
  private golem: JefeGolem | null = null;
  private altarGolem: EstadoAltar | null = null;
  private jugador = { x: 0, z: 0 };
  private duelos: EstadoDuelo[] = [];
  private duelosGanados = 0;
  private dragon: JefeVolador | null = null;
  private ocupados: { x: number; z: number; r: number }[] = [];
  private refugio: Actor | null = null;
  private siguienteSuministro = 120;
  private exposicionValor = 0;
  private marcaActiva: MarcaContenido | null = null;
  private scene: THREE.Scene;
  private world: World;
  private eventos: EventosContenido;

  constructor(scene: THREE.Scene, world: World, eventos: EventosContenido, semilla = Math.floor(Math.random() * 0x100000000)) {
    this.scene = scene;
    this.world = world;
    this.eventos = eventos;
    this.rand = rng(semilla);
    this.colocarContenido();
  }

  get exposicion() {
    return this.exposicionValor;
  }

  get marca() {
    return this.marcaActiva;
  }

  get marcas(): MarcaContenido[] {
    const marcas: MarcaContenido[] = [];
    const visto = (id: string) => this.vistos.has(id);
    // Los altares de jefe y el refugio se ven siempre: la vigía los conoce.
    for (const a of this.altares) marcas.push({ id: a.def.id, tipo: 'altar', x: a.actor.x, z: a.actor.z, hecho: a.estado === 'agotado', visto: true });
    for (const a of this.aras) marcas.push({ id: a.actor.id, tipo: 'ara', x: a.actor.x, z: a.actor.z, hecho: a.estado === 'superado', visto: visto(a.actor.id) });
    for (const p of this.pilones) marcas.push({ id: p.actor.id, tipo: 'pilon', x: p.actor.x, z: p.actor.z, hecho: p.estado === 'agotado' || p.estado === 'cargado', visto: visto(p.actor.id) });
    for (const c of this.cajas) {
      marcas.push({
        id: c.actor.id, tipo: 'caja', x: c.actor.x, z: c.actor.z, hecho: c.abierta, visto: visto(c.actor.id) || c.dinamica,
        coste: c.def.apertura.como === 'pagar' ? this.costeCofre(c) : undefined,
      });
    }
    for (const t of this.torres) marcas.push({ id: t.actor.id, tipo: 'torre', x: t.actor.x, z: t.actor.z, hecho: t.destruida, visto: visto(t.actor.id) });
    if (this.refugio) marcas.push({ id: 'refugio', tipo: 'refugio', x: this.refugio.x, z: this.refugio.z, visto: true });
    for (const n of this.npcs) marcas.push({ id: n.def.id, tipo: 'npc', x: n.actor.x, z: n.actor.z, visto: visto(n.def.id) });
    for (const d of this.duelos) marcas.push({ id: d.actor.id, tipo: 'duelo', x: d.actor.x, z: d.actor.z, hecho: d.estado === 'superado', visto: visto(d.actor.id) });
    if (this.dragon && !this.dragon.derrotado) marcas.push({ id: 'dragon', tipo: 'dragon', x: this.dragon.x, z: this.dragon.z, visto: true });
    return marcas;
  }

  get jefesHud(): JefeHud[] {
    return this.altares.map((altar) => {
      const activo = this.altarGolem === altar && this.golem && !this.golem.derrotado ? this.golem : null;
      return {
        minuto: altar.def.minuto,
        nombre: GOLEMS[altar.def.jefe].nombre,
        vencido: altar.estado === 'recompensa' || altar.estado === 'listo' || altar.estado === 'agotado',
        vida: activo?.vida,
        vidaMax: activo?.def.vida,
      };
    });
  }

  /** La barra grande del HUD: el gólem si está en pie; si no, el minijefe más cercano. */
  get barraJefe(): { nombre: string; vida: number; vidaMax: number } | undefined {
    if (this.dragon && !this.dragon.derrotado) {
      return { nombre: this.dragon.nombre + (this.dragon.posado ? ' · ¡posado!' : ' · usa el Cañón'), vida: this.dragon.vida, vidaMax: this.dragon.vidaMax };
    }
    const duelo = this.duelos.find((d) => d.estado === 'activo');
    if (duelo) {
      const vivos = duelo.retadores.filter((r) => !r.derrotado);
      const resta = Math.ceil(DUELOS.segundos - duelo.t);
      return {
        nombre: `Duelo · ${resta} s · ${vivos.length} campeón${vivos.length === 1 ? '' : 'es'}`,
        vida: duelo.retadores.reduce((s, r) => s + r.vida, 0),
        vidaMax: duelo.retadores.reduce((s, r) => s + r.def.vida, 0),
      };
    }
    if (this.golem?.activo) return { nombre: this.golem.def.nombre, vida: this.golem.vida, vidaMax: this.golem.def.vida };
    let mejor: EstadoJefe | null = null, dmin = 30;
    for (const j of this.jefes) {
      if (j.derrotado || j.entrada > 0) continue;
      const d = Math.hypot(j.actor.x - this.jugador.x, j.actor.z - this.jugador.z);
      if (d < dmin) { dmin = d; mejor = j; }
    }
    return mejor ? { nombre: mejor.nombre, vida: mejor.vida, vidaMax: mejor.vidaMax } : undefined;
  }

  /** Carga del pilón en el que está el jugador (0..1), o null si no está en ninguno. */
  get cargaPilon(): number | null {
    for (const p of this.pilones) if (p.estado === 'cargando' && p.anillo.userData.dentro) return p.carga;
    return null;
  }

  get objetivoJefe(): ObjetivoCombate[] {
    const objetivos: ObjetivoCombate[] = [];
    const golem = this.golem;
    if (golem?.activo) {
      objetivos.push({ id: golem.def.id, x: golem.x, z: golem.z, radio: golem.def.radio, activo: true, golpear: (cantidad) => golem.golpear(cantidad) });
    }
    for (const duelo of this.duelos) {
      duelo.retadores.forEach((r, k) => {
        if (r.activo) objetivos.push({ id: `${duelo.actor.id}-${k}`, x: r.x, z: r.z, radio: r.def.radio, activo: true, golpear: (cantidad) => r.golpear(cantidad) });
      });
    }
    // En el aire el dragón solo recibe el Cañón; posado, le llega todo.
    const dragon = this.dragon;
    if (dragon?.posado) objetivos.push({ id: 'dragon', x: dragon.x, z: dragon.z, radio: 3.2, activo: true, golpear: (cantidad) => dragon.golpear(cantidad) });
    for (const jefe of this.jefes) {
      if (jefe.derrotado || jefe.entrada > 0) continue;
      objetivos.push({
        id: jefe.actor.id,
        x: jefe.actor.modelo.raiz.position.x,
        z: jefe.actor.modelo.raiz.position.z,
        radio: jefe.radio,
        activo: true,
        golpear: (cantidad) => this.golpearJefe(jefe, cantidad),
      });
    }
    for (const torre of this.torres) {
      if (torre.destruida) continue;
      objetivos.push({
        id: torre.actor.id,
        x: torre.actor.x,
        z: torre.actor.z,
        radio: 1.7,
        activo: true,
        golpear: (cantidad) => this.golpearTorre(torre, cantidad),
      });
    }
    return objetivos;
  }

  /** Congela `segundos` a los jefes que haya en el círculo (la Orden de apagado). */
  aturdirJefes(x: number, z: number, radio: number, segundos: number) {
    for (const o of this.objetivoJefe) {
      if (Math.hypot(o.x - x, o.z - z) <= radio + o.radio) this.aturdidos.set(o.id, Math.max(segundos, this.aturdidos.get(o.id) ?? 0));
    }
  }

  reset() {
    this.aturdidos.clear();
    for (const jefe of this.jefes) this.eliminarActor(jefe.actor);
    this.jefes = [];
    this.minijefesCreados = 0;
    this.siguienteMinijefe = MINIJEFES.primero;
    this.golem?.dispose();
    this.golem = null;
    this.altarGolem = null;
    this.dragon?.dispose();
    this.dragon = null;
    this.duelosGanados = 0;
    for (const duelo of this.duelos) {
      for (const r of duelo.retadores) r.dispose();
      duelo.retadores = [];
      duelo.estado = 'espera';
      duelo.t = 0;
      duelo.arena.visible = false;
      this.reproducir(duelo.actor, CLIPS_ALTAR_JEFE.dormido);
    }
    for (const caja of this.cajas.filter((c) => c.dinamica)) this.eliminarActor(caja.actor);
    this.cajas = this.cajas.filter((c) => !c.dinamica);
    this.exposicionValor = 0;
    this.marcaActiva = null;
    this.siguienteSuministro = 120;
    this.cofresAbiertos = 0;
    this.pilonesGastados = 0;
    this.vistos.clear();
    for (const pilon of this.pilones) {
      pilon.carga = pilon.t = 0;
      pilon.estado = 'espera';
      pilon.premiado = false;
      pilon.anillo.visible = true;
      pilon.anillo.material.uniforms.progreso.value = 0;
      this.reproducir(pilon.actor, CLIPS_PILON.espera);
    }
    for (const altar of this.altares) {
      altar.estado = 'dormido';
      altar.t = 0;
      this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.dormido);
    }
    for (const caja of this.cajas) {
      caja.progreso = 0;
      caja.abierta = false;
      caja.entregada = false;
      this.reproducir(caja.actor, CLIPS_CAJA.espera);
    }
    for (const torre of this.torres) {
      torre.vida = torre.vidaMax;
      torre.destruida = false;
      torre.tDestruida = 0;
      this.reproducir(torre.actor, 'Emitir');
    }
    for (const ara of this.aras) {
      ara.estado = 'espera';
      ara.t = ara.fuera = 0;
      this.reproducir(ara.actor, CLIPS_ARA.espera);
    }
    for (const npc of this.npcs) {
      npc.cerca = false;
      this.reproducir(npc.actor, CLIPS_NPC.trabajar);
    }
  }

  update(c: ContextoContenido): number {
    for (const actor of this.actores) {
      const altarActivo = this.altares.some((a) =>
        a.actor === actor && a.estado !== 'dormido' && a.estado !== 'agotado');
      const cerca = Math.hypot(c.px - actor.modelo.raiz.position.x, c.pz - actor.modelo.raiz.position.z) <= actor.alcanceVista;
      actor.modelo.raiz.visible = cerca || altarActivo;
      if (actor.modelo.raiz.visible) actor.mixer.update(c.dt);
      // El mapa (M) apunta lo que se ha visto; con más vista que la normal
      // (la pasiva de Taro) cuenta aunque el actor todavía no se dibuje.
      if ((cerca || this.radioVista > VISTA_MAPA) && !this.vistos.has(actor.id)
        && Math.hypot(c.px - actor.x, c.pz - actor.z) <= this.radioVista) this.vistos.add(actor.id);
    }

    this.actualizarExposicion(c);
    this.actualizarAltares(c);
    this.actualizarCajas(c);
    this.actualizarPilones(c);
    this.actualizarAras(c);
    this.actualizarNpcs(c);

    if (this.refugio && Math.hypot(c.px - this.refugio.x, c.pz - this.refugio.z) <= 5) {
      this.eventos.curar(2 * c.dt);
    }

    if (c.tiempo >= this.siguienteSuministro) {
      this.siguienteSuministro += 120;
      this.crearSuministro(c.px, c.pz);
      this.eventos.toast('OPERADOR', 'Suministros de ARES-IX en camino. Busca la baliza blanca.', 4);
    }

    this.jugador.x = c.px;
    this.jugador.z = c.pz;
    const jugador = { x: c.px, z: c.pz, vx: c.vx ?? 0, vz: c.vz ?? 0, dt: c.dt };
    // Un jefe aturdido se queda congelado: su reloj no avanza.
    for (const [id, t] of this.aturdidos) {
      if (t - c.dt <= 0) this.aturdidos.delete(id);
      else this.aturdidos.set(id, t - c.dt);
    }
    const quieto = { ...jugador, dt: 0 };
    let dano = this.actualizarJefes(c);
    if (this.golem) dano += this.golem.update(this.aturdidos.has(this.golem.def.id) ? quieto : jugador);
    dano += this.actualizarDuelos(c, jugador, quieto);
    if (this.dragon) {
      dano += this.dragon.update(this.aturdidos.has('dragon') ? quieto : jugador);
      if (this.dragon.terminado) {
        this.eventos.toast('ADA', 'El Dragón del Velo ha caído. Ese trozo de cielo vuelve a ser nuestro.', 6);
        this.eventos.aplicar(DRAGON.recompensa);
        this.dragon.dispose();
        this.dragon = null;
      }
    }
    return dano;
  }

  zonaDe(x: number, z: number) {
    const enAcido = this.world.acidoEn(x, z) > 0;
    let mejor = '';
    let dmin = Infinity;
    for (const lugar of this.world.lugares) {
      if (enAcido && lugar.tipo !== 'lago') continue;
      const d = Math.hypot(x - lugar.x, z - lugar.z) / (lugar.r * 1.4);
      if (d < 1 && d < dmin) {
        dmin = d;
        mejor = lugar.tipo === 'lago' && !enAcido ? 'Orilla del ' + lugar.nombre : lugar.nombre;
      }
    }
    if (mejor) return mejor;
    if (Math.hypot(x - this.world.nave.x, z - this.world.nave.z) < 10) return 'Nave de ARES-IX';
    return Math.hypot(x, z) > this.world.arena ? 'Tierras altas' : 'Llanura de Meta';
  }

  interaccionNpc(x: number, z: number) {
    const cerca = this.npcs
      .map((n) => ({ n, d: Math.hypot(x - n.actor.x, z - n.actor.z) }))
      .filter((v) => v.d <= DISTANCIAS_NPC.saludar)
      .sort((a, b) => a.d - b.d)[0];
    return cerca ? { tecla: 'V', texto: 'Mantén V para hablar con ' + cerca.n.def.nombre } : undefined;
  }

  // ------------------------------------------------------------ modo demo

  /** Modo demo: los altares no despiertan solos ni salen minijefes; los jefes los pone la demo. */
  prepararDemo() {
    for (const a of this.altares) a.estado = 'agotado';
    this.siguienteMinijefe = Infinity;
  }

  /** Saca un jefe de altar donde se pida, mirando hacia (hx, hz). */
  invocarJefe(id: JefeAltarId, x: number, z: number, hx: number, hz: number) {
    this.golem?.dispose();
    const p = this.world.resolve(x, z, 3, { x: 0, z: 0 });
    this.golem = new JefeGolem(this.scene, this.world, GOLEMS[id], p.x, p.z, Math.atan2(hx - p.x, hz - p.z), {
      empujar: this.eventos.empujar, aviso: this.eventos.aviso, sacudida: this.eventos.sacudida, sonido: this.eventos.sonido,
    }, this.rand);
    this.altarGolem = null;
  }

  /** Llama al Dragón del Velo ahora mismo (el modo demo no espera a los duelos). */
  llamarDragon(px: number, pz: number) {
    if (!this.dragon) this.invocarDragon({ px, pz } as ContextoContenido);
  }

  /** En qué punto está la pelea de la demo: si queda gólem o dragón en pie. */
  get estadoDemo() {
    return {
      golem: this.golem ? (this.golem.terminado ? 'caido' : 'vivo') : 'nada',
      dragon: this.dragon ? 'vivo' : 'nada',
    } as const;
  }

  /** Lo que el piloto de la demo debe rodear y adónde apuntar. */
  get objetivoPiloto(): ObjetivoPiloto | null {
    const dragon = this.dragon;
    if (dragon && !dragon.derrotado) {
      const cabeza = dragon.esferas()[0];
      const y = this.world.heightAt(dragon.x, dragon.z) + dragon.alt + 2.8;
      return { x: dragon.x, z: dragon.z, radio: 3.5, vuela: !dragon.posado, canon: true, mira: cabeza ?? { x: dragon.x, y, z: dragon.z } };
    }
    const g = this.golem;
    if (g && !g.derrotado) {
      return { x: g.x, z: g.z, radio: g.def.radio, vuela: false, canon: false, mira: { x: g.x, y: this.world.heightAt(g.x, g.z) + g.def.radio * 1.2, z: g.z } };
    }
    return null;
  }

  /** El altar de duelo libre más cercano a mano (4,5 m), si lo hay. */
  private dueloCercano(x: number, z: number) {
    return this.duelos.find((d) => d.estado === 'espera' && Math.hypot(x - d.actor.x, z - d.actor.z) < 4.5) ?? null;
  }

  interaccionDuelo(x: number, z: number): Interaccion | undefined {
    if (this.duelos.some((d) => d.estado === 'activo')) return undefined;
    return this.dueloCercano(x, z) ? { tecla: 'F', texto: 'Empezar duelo contra campeones de HELIOS' } : undefined;
  }

  /** F junto a un altar de duelo: salen sus campeones. Devuelve si empezó. */
  empezarDuelo(x: number, z: number): boolean {
    if (this.duelos.some((d) => d.estado === 'activo')) return false;
    const duelo = this.dueloCercano(x, z);
    if (!duelo) return false;
    duelo.estado = 'activo';
    duelo.t = 0;
    duelo.arena.visible = true;
    this.reproducir(duelo.actor, CLIPS_ALTAR_JEFE.invocar, true);
    const quienes = DUELOS.retadores[Math.min(duelo.indice, DUELOS.retadores.length - 1)];
    quienes.forEach((id, k) => {
      const a = (k / quienes.length) * Math.PI * 2 + this.rand();
      const p = this.world.resolve(duelo.actor.x + Math.cos(a) * 8, duelo.actor.z + Math.sin(a) * 8, 2, { x: 0, z: 0 });
      duelo.retadores.push(new JefeGolem(this.scene, this.world, CAMPEONES[id], p.x, p.z, Math.atan2(x - p.x, z - p.z), {
        empujar: this.eventos.empujar, sacudida: this.eventos.sacudida, sonido: this.eventos.sonido,
        aviso: this.eventos.aviso,
      }, this.rand));
    });
    this.eventos.aviso?.(`¡Duelo! Vence a los campeones en ${DUELOS.segundos} s`);
    return true;
  }

  /**
   * Disparo del Cañón solar: lo primero que corta el rayo entre el dragón
   * (en el aire, la cabeza es punto débil), los gólems, los campeones y los
   * minijefes. Null si no da a ninguno.
   */
  rayo(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, alcance: number): AciertoRayo | null {
    let mejor: AciertoRayo | null = null;
    const probar = (x: number, y: number, z: number, r: number, debil: boolean, golpear: (n: number) => number) => {
      const t = rayoEsfera(o, d, x, y, z, r);
      if (t !== null && t <= alcance && (!mejor || t < mejor.t)) {
        mejor = { t, x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t, debil, golpear };
      }
    };
    const dragon = this.dragon;
    if (dragon && !dragon.derrotado) {
      for (const e of dragon.esferas()) probar(e.x, e.y, e.z, e.r, e.debil, (n) => dragon.golpear(e.debil ? n * 1.6 : n));
    }
    const grandes = [...(this.golem?.activo ? [this.golem] : []), ...this.duelos.flatMap((dl) => dl.retadores.filter((r) => r.activo))];
    for (const g of grandes) {
      const suelo = this.world.heightAt(g.x, g.z);
      probar(g.x, suelo + g.def.radio * 1.2, g.z, g.def.radio * 1.2, false, (n) => g.golpear(n));
    }
    for (const j of this.jefes) {
      if (j.derrotado || j.entrada > 0) continue;
      const suelo = this.world.heightAt(j.actor.x, j.actor.z);
      probar(j.actor.x, suelo + j.radio, j.actor.z, j.radio, false, (n) => this.golpearJefe(j, n));
    }
    return mejor;
  }

  /** Lo que cuesta abrir este cofre ahora (sube con cada uno abierto). */
  costeCofre(caja: EstadoCaja) {
    const a = caja.def.apertura;
    return Math.ceil(((a.coste ?? 0) + (a.subida ?? 0) * this.cofresAbiertos) * this.factorCosteCofre);
  }

  /** El cofre de pago cerrado más cercano a mano (2,4 m), si lo hay. */
  private cofreCercano(x: number, z: number) {
    let mejor: EstadoCaja | null = null, dmin = 2.4;
    for (const caja of this.cajas) {
      if (caja.abierta || caja.def.apertura.como !== 'pagar') continue;
      const d = Math.hypot(x - caja.actor.x, z - caja.actor.z);
      if (d < dmin) { dmin = d; mejor = caja; }
    }
    return mejor;
  }

  /** Aviso del cofre a mano: precio, y en rojo si no te llega. */
  interaccionCofre(x: number, z: number, chatarra: number): Interaccion | undefined {
    const caja = this.cofreCercano(x, z);
    if (!caja) return undefined;
    const coste = this.costeCofre(caja);
    const bloqueado = chatarra < coste;
    return { tecla: 'F', texto: `Abrir ${caja.def.nombre}${bloqueado ? ' (no te llega)' : ''}`, coste, bloqueado };
  }

  /**
   * Intenta abrir el cofre a mano pagando. Devuelve lo que cuesta si se abrió,
   * -1 si no había cofre y -2 si no llega la chatarra.
   */
  abrirCofre(x: number, z: number, chatarra: number): number {
    const caja = this.cofreCercano(x, z);
    if (!caja) return -1;
    const coste = this.costeCofre(caja);
    if (chatarra < coste) return -2;
    this.cofresAbiertos++;
    caja.abierta = true;
    caja.progreso = 0;
    this.reproducir(caja.actor, CLIPS_CAJA.abrir, true);
    if (caja.def.apertura.exposicion) this.cambiarExposicion(caja.def.apertura.exposicion);
    return coste;
  }

  responderVoz(texto: string, x: number, z: number): RespuestaNpc {
    const cerca = this.npcs
      .map((n) => ({ n, d: Math.hypot(x - n.actor.x, z - n.actor.z) }))
      .filter((v) => v.d <= DISTANCIAS_NPC.hablar)
      .sort((a, b) => a.d - b.d)
      .map((v) => v.n.def.id);
    const destino = aQuienHabla(texto, cerca);
    if (!destino || destino === 'dron') return { destino };
    const npc = NPCS.find((n) => n.id === destino);
    if (!npc) return { destino: null };
    const intencion = detectarIntencion(npc, texto);
    const actor = this.npcs.find((n) => n.def.id === destino)?.actor;
    if (actor) this.reproducir(actor, intencion?.clip ?? CLIPS_NPC.hablar, true);
    return {
      destino,
      npc,
      intencion,
      respaldo: intencion ? frase(npc, intencion, texto.length) : frase(npc, 'noEntiendo', texto.length),
    };
  }

  marcar(que: 'altar' | 'caja' | 'torre' | 'ara' | 'refugio' | 'pilon', px: number, pz: number) {
    const candidatos = this.marcas.filter((m) => m.tipo === que && !m.hecho);
    candidatos.sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    this.marcaActiva = candidatos[0] ?? null;
  }

  cambiarExposicion(puntos: number) {
    this.exposicionValor = THREE.MathUtils.clamp(this.exposicionValor + puntos / 100, 0, 1);
  }

  dispose() {
    for (const actor of this.actores) this.scene.remove(actor.modelo.raiz);
    this.actores = [];
  }

  private colocarContenido() {
    const haciaCentro = (x: number, z: number) => Math.atan2(-x, -z);
    const refugio = this.world.lugarLibre(this.rand, COLOCACION.refugio.distancia, 9) ?? { x: 14, z: 12 };
    this.refugio = this.poner('refugio', crearRefugio, refugio.x, refugio.z, haciaCentro(refugio.x, refugio.z), 'Reposo');
    this.ocupados.push({ ...refugio, r: 14 });

    // El chatarrero se mantiene fuera hasta que el usuario elija un nombre que
    // no colisione con Bruno, el perro compañero.
    const defsNpc = NPCS.filter((n) => n.id !== 'npc-chatarrero');
    const creadores = [crearNpcMecanica, crearNpcVigia, crearNpcBotanica];
    defsNpc.forEach((def, k) => {
      const ang = haciaCentro(refugio.x, refugio.z) + (k - 1) * 0.75;
      const x = refugio.x + Math.sin(ang) * 7;
      const z = refugio.z + Math.cos(ang) * 7;
      const actor = this.poner(def.id, creadores[k], x, z, ang + Math.PI, CLIPS_NPC.trabajar);
      this.npcs.push({ actor, def, cerca: false, asustado: false, despedida: 0 });
    });

    const estiloAltar = { 'altar-cosecha': 'cosecha', 'altar-sabueso': 'ojo', 'altar-heraldo': 'heraldo', 'altar-ojo': 'ojo' } as const;
    for (const def of ALTARES_JEFE) {
      const p = this.buscar(COLOCACION.altaresJefe.distancia, 4, COLOCACION.altaresJefe.separacionMinima);
      const actor = this.poner(def.id, () => crearAltarJefe(estiloAltar[def.id]), p.x, p.z, haciaCentro(p.x, p.z), CLIPS_ALTAR_JEFE.dormido);
      this.altares.push({ def, actor, estado: 'dormido', t: 0, adelantado: false });
    }

    for (let k = 0; k < COLOCACION.aras.cuantos; k++) {
      const p = this.buscar(COLOCACION.aras.distancia, 4, COLOCACION.aras.separacionMinima);
      const actor = this.poner('altar-desafio-' + k, crearAltarDesafio, p.x, p.z, haciaCentro(p.x, p.z), CLIPS_ARA.espera);
      this.aras.push({ actor, desafio: DESAFIOS[k % 3], estado: 'espera', t: 0, fuera: 0, bajasInicio: 0, danoInicio: 0, recogidas: 0, chispas: [] });
    }

    for (let k = 0; k < COLOCACION.pilones.cuantos; k++) {
      const p = this.buscar(COLOCACION.pilones.distancia, 3, COLOCACION.pilones.separacionMinima);
      const actor = this.poner('pilon-' + k, crearPilonCarga, p.x, p.z, haciaCentro(p.x, p.z), CLIPS_PILON.espera);
      const anillo = anilloCarga(PILON.radio);
      anillo.position.y = 0.06;
      actor.modelo.raiz.add(anillo);
      this.pilones.push({ actor, carga: 0, estado: 'espera', t: 0, premiado: false, anillo });
    }

    for (let k = 0; k < COLOCACION.duelos.cuantos; k++) {
      const p = this.buscar(COLOCACION.duelos.distancia, 4, COLOCACION.duelos.separacionMinima);
      const actor = this.poner('altar-duelo-' + k, () => crearAltarJefe('heraldo'), p.x, p.z, haciaCentro(p.x, p.z), CLIPS_ALTAR_JEFE.dormido);
      // Anillo de la arena: solo se ve mientras dura el duelo.
      const arena = new THREE.Mesh(
        new THREE.RingGeometry(DUELOS.radio - 0.5, DUELOS.radio, 72).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#ff6a3d', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
      );
      arena.position.set(p.x, this.world.heightAt(p.x, p.z) + 0.2, p.z);
      arena.visible = false;
      this.scene.add(arena);
      this.duelos.push({ actor, indice: k, estado: 'espera', t: 0, retadores: [], arena });
    }

    const torreDef = ESTRUCTURAS.find((e) => e.id === 'torre-velo')!;
    for (let k = 0; k < COLOCACION.torres.cuantos; k++) {
      const p = this.buscar(COLOCACION.torres.distancia, 4, COLOCACION.torres.separacionMinima);
      const actor = this.poner('torre-velo-' + k, crearTorreVelo, p.x, p.z, haciaCentro(p.x, p.z), torreDef.clips.activa);
      this.torres.push({
        actor,
        vida: torreDef.vida ?? 400,
        vidaMax: torreDef.vida ?? 400,
        destruida: false,
        tDestruida: 0,
      });
    }

    const cajaHelios = CAJAS.find((c) => c.id === 'caja-helios')!;
    for (let k = 0; k < COLOCACION.cofresHelios.cuantos; k++) {
      const p = this.buscar(COLOCACION.cofresHelios.distancia, 2, COLOCACION.cofresHelios.separacionMinima);
      const actor = this.poner('caja-helios-' + k, () => crearCaja('helios'), p.x, p.z, haciaCentro(p.x, p.z), CLIPS_CAJA.espera);
      this.cajas.push({ actor, def: cajaHelios, progreso: 0, abierta: false, entregada: false, dinamica: false });
    }
    const reliquia = this.buscar([30, 50], 2, 6);
    const actorReliquia = this.poner('caja-reliquia', () => crearCaja('reliquia'), reliquia.x, reliquia.z, haciaCentro(reliquia.x, reliquia.z), CLIPS_CAJA.espera);
    this.cajas.push({
      actor: actorReliquia,
      def: CAJAS.find((c) => c.id === 'caja-reliquia')!,
      progreso: 0,
      abierta: false,
      entregada: false,
      dinamica: false,
    });
  }

  private buscar(distancia: readonly [number, number], margen: number, separacion: number) {
    const p = this.world.lugarLibre(this.rand, distancia, margen, this.ocupados) ?? {
      x: (this.rand() * 2 - 1) * distancia[0],
      z: (this.rand() * 2 - 1) * distancia[0],
    };
    this.ocupados.push({ ...p, r: separacion });
    return p;
  }

  private poner(id: string, crear: () => Modelo, x: number, z: number, giro: number, clip: string, sombras = false): Actor {
    const modelo = crear();
    modelo.raiz.position.set(x, this.world.heightAt(x, z), z);
    modelo.raiz.rotation.y = giro;
    modelo.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.contorno) o.castShadow = sombras;
    });
    this.scene.add(modelo.raiz);
    const mixer = new THREE.AnimationMixer(modelo.raiz);
    const acciones = new Map<string, THREE.AnimationAction>();
    for (const anim of modelo.animaciones) {
      const accion = mixer.clipAction(anim.clip);
      if (!anim.bucle) {
        accion.setLoop(THREE.LoopOnce, 1);
        accion.clampWhenFinished = true;
      }
      acciones.set(anim.clip.name, accion);
    }
    const alcanceVista = id.startsWith('npc-') || id === 'refugio' ? 55
      : id.startsWith('caja-') ? 45
        : id.startsWith('altar-desafio') || id.startsWith('pilon-') ? 65
          : id.startsWith('altar-') || id.startsWith('torre-velo') ? 95
            : 120;
    const actor = { id, modelo, mixer, acciones, actual: '', x, z, alcanceVista };
    this.actores.push(actor);
    this.reproducir(actor, clip);
    return actor;
  }

  private reproducir(actor: Actor, nombre: string, unaVez = false) {
    const nueva = actor.acciones.get(nombre);
    if (!nueva || actor.actual === nombre && nueva.isRunning()) return;
    const anterior = actor.acciones.get(actor.actual);
    anterior?.fadeOut(0.15);
    nueva.reset();
    if (unaVez) {
      nueva.setLoop(THREE.LoopOnce, 1);
      nueva.clampWhenFinished = true;
    }
    nueva.fadeIn(0.15).play();
    actor.actual = nombre;
  }

  private actualizarExposicion(c: ContextoContenido) {
    let factor = 1;
    for (const torre of this.torres) {
      if (torre.destruida) {
        torre.tDestruida += c.dt;
        if (torre.tDestruida >= 3 && torre.actor.actual !== 'Apagada') this.reproducir(torre.actor, 'Apagada');
      } else if (Math.hypot(c.px - torre.actor.x, c.pz - torre.actor.z) < 25) {
        factor += 0.2;
      }
    }
    const subida = (0.00035 + c.balizas * 0.00012) * factor * c.dt;
    this.exposicionValor = THREE.MathUtils.clamp(this.exposicionValor + subida, 0, 1);
  }

  private actualizarAltares(c: ContextoContenido) {
    for (const altar of this.altares) {
      altar.t += c.dt;
      if (altar.estado === 'dormido' && c.tiempo >= altar.def.minuto * 60 && (!this.golem || this.golem.derrotado)) {
        altar.estado = 'invocando';
        altar.t = 0;
        this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.invocar, true);
        this.eventos.toast('ADA', altar.def.nombre + ' se está abriendo.', 4);
      } else if (altar.estado === 'invocando' && altar.t >= CLIPS_ALTAR_JEFE.apareceJefe) {
        this.crearGolem(altar);
        altar.estado = 'combate';
        altar.t = 0;
        this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.combate);
      } else if (altar.estado === 'combate' && this.altarGolem === altar && this.golem?.derrotado) {
        altar.estado = 'recompensa';
        altar.t = 0;
        this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.vencido, true);
        this.eventos.toast('ADA', this.golem.def.nombre + ' derrotado. El altar se purifica.', 5);
      } else if (altar.estado === 'recompensa' && altar.t >= CLIPS_ALTAR_JEFE.recompensaLista) {
        altar.estado = 'listo';
        this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.esperando);
      } else if (altar.estado === 'listo' && Math.hypot(c.px - altar.actor.x, c.pz - altar.actor.z) < 3.2) {
        altar.estado = 'agotado';
        this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.agotado);
        this.eventos.aplicar(altar.def.recompensa);
        this.eventos.toast('ADA', 'Altar purificado. Recompensa recuperada.', 4);
      }
    }
  }

  private actualizarCajas(c: ContextoContenido) {
    for (const caja of this.cajas) {
      if (caja.abierta) {
        if (!caja.entregada) {
          caja.progreso += c.dt;
          if (caja.progreso >= CLIPS_CAJA.botin) {
            caja.entregada = true;
            this.eventos.aplicar(tirarBotin(caja.def, this.rand()));
            this.reproducir(caja.actor, CLIPS_CAJA.vacia);
            this.eventos.toast('ADA', caja.def.nombre + ': botín recuperado.', 3);
          }
        }
        continue;
      }
      // Los cofres de pago se abren con la tecla de usar (abrirCofre).
      if (caja.def.apertura.como === 'pagar') continue;
      const cerca = Math.hypot(c.px - caja.actor.x, c.pz - caja.actor.z) < 1.8;
      caja.progreso = cerca ? caja.progreso + c.dt : Math.max(0, caja.progreso - c.dt * 2);
      if (caja.progreso < caja.def.apertura.segundos) continue;
      caja.abierta = true;
      caja.progreso = 0;
      this.reproducir(caja.actor, CLIPS_CAJA.abrir, true);
      if (caja.def.apertura.exposicion) this.cambiarExposicion(caja.def.apertura.exposicion);
    }
  }

  private actualizarDuelos(c: ContextoContenido, jugador: { x: number; z: number; vx: number; vz: number; dt: number }, quieto = jugador) {
    let dano = 0;
    for (const duelo of this.duelos) {
      duelo.retadores.forEach((r, k) => { dano += r.update(this.aturdidos.has(`${duelo.actor.id}-${k}`) ? quieto : jugador); });
      if (duelo.estado === 'espera' || duelo.estado === 'superado' && !duelo.retadores.length) continue;
      duelo.t += c.dt;
      if (duelo.estado === 'activo') {
        (duelo.arena.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.3 * Math.sin(duelo.t * 5);
        if (duelo.retadores.every((r) => r.derrotado)) {
          duelo.estado = 'superado';
          duelo.t = 0;
          duelo.arena.visible = false;
          this.reproducir(duelo.actor, CLIPS_ALTAR_JEFE.vencido, true);
          const premio = DUELOS.premios[Math.min(this.duelosGanados, DUELOS.premios.length - 1)];
          this.duelosGanados++;
          this.eventos.toast('ADA', 'Duelo ganado. El altar entrega su premio.', 4);
          this.eventos.aplicar(premio);
          if (this.duelosGanados === DUELOS.dragonAlGanar && !this.dragon) this.invocarDragon(c);
        } else if (duelo.t >= DUELOS.segundos) {
          duelo.estado = 'fallado';
          duelo.t = 0;
          duelo.arena.visible = false;
          for (const r of duelo.retadores) r.dispose();
          duelo.retadores = [];
          this.reproducir(duelo.actor, CLIPS_ALTAR_JEFE.agotado, true);
          this.eventos.toast('ADA', 'Se acabó el tiempo. El altar se calma: puedes volver a intentarlo.', 5);
        }
      } else if (duelo.estado === 'fallado' && duelo.t >= 6) {
        duelo.estado = 'espera';
        this.reproducir(duelo.actor, CLIPS_ALTAR_JEFE.dormido);
      } else if (duelo.estado === 'superado' && duelo.retadores.every((r) => r.terminado)) {
        for (const r of duelo.retadores) r.dispose();
        duelo.retadores = [];
        this.reproducir(duelo.actor, CLIPS_ALTAR_JEFE.agotado, true);
      }
    }
    return dano;
  }

  /** El Dragón del Velo llega volando desde lejos, al otro lado del jugador. */
  private invocarDragon(c: ContextoContenido) {
    const a = this.rand() * Math.PI * 2;
    this.dragon = new JefeVolador(this.scene, this.world, c.px + Math.cos(a) * 70, c.pz + Math.sin(a) * 70, {
      empujar: this.eventos.empujar, aviso: this.eventos.aviso, sacudida: this.eventos.sacudida, sonido: this.eventos.sonido,
    }, this.rand);
    this.eventos.toast('HELIOS', 'Has roto demasiados sellos. El Dragón del Velo viene a por ti.', 6);
  }

  private actualizarPilones(c: ContextoContenido) {
    for (const pilon of this.pilones) {
      const dentro = Math.hypot(c.px - pilon.actor.x, c.pz - pilon.actor.z) <= PILON.radio;
      pilon.anillo.userData.dentro = dentro;
      if (pilon.estado === 'espera' || pilon.estado === 'cargando') {
        if (dentro) {
          const segundos = PILON.segundos + PILON.masPorUsado * this.pilonesGastados;
          pilon.carga = Math.min(1, pilon.carga + c.dt / segundos * this.factorCargaPilon);
          if (pilon.estado === 'espera') {
            pilon.estado = 'cargando';
            this.reproducir(pilon.actor, CLIPS_PILON.cargando);
          }
        } else if (pilon.carga > 0) {
          pilon.carga = Math.max(0, pilon.carga - PILON.descarga * c.dt);
        }
        if (!dentro && pilon.estado === 'cargando' && pilon.carga <= 0) {
          pilon.estado = 'espera';
          this.reproducir(pilon.actor, CLIPS_PILON.espera);
        }
        const accion = pilon.actor.acciones.get(CLIPS_PILON.progreso);
        if (accion) {
          accion.paused = true;
          accion.play();
          accion.time = pilon.carga * accion.getClip().duration;
        }
        pilon.anillo.material.uniforms.progreso.value = pilon.carga;
        pilon.anillo.material.uniforms.dentro.value = dentro ? 1 : 0;
        if (pilon.carga >= 1) {
          pilon.estado = 'cargado';
          pilon.t = 0;
          this.pilonesGastados++;
          this.reproducir(pilon.actor, CLIPS_PILON.cargado, true);
        }
        continue;
      }
      if (pilon.estado === 'cargado') {
        pilon.t += c.dt;
        if (!pilon.premiado && pilon.t >= CLIPS_PILON.premio) {
          pilon.premiado = true;
          this.eventos.aplicar(PILON.recompensa);
        }
        if (pilon.t >= 1.6) {
          pilon.estado = 'agotado';
          pilon.anillo.visible = false;
          this.reproducir(pilon.actor, CLIPS_PILON.agotado, true);
        }
      }
    }
  }

  private actualizarAras(c: ContextoContenido) {
    for (const ara of this.aras) {
      const dentro = Math.hypot(c.px - ara.actor.x, c.pz - ara.actor.z) <= RADIO_ARA;
      if (ara.estado === 'espera' && dentro) {
        ara.estado = 'activo';
        ara.t = ara.fuera = 0;
        ara.bajasInicio = c.bajas;
        ara.danoInicio = c.danoRecibido;
        this.reproducir(ara.actor, CLIPS_ARA.activar, true);
        this.eventos.toast('ADA', ara.desafio.nombre + ': ' + ara.desafio.reglas, 6);
      }
      if (ara.estado !== 'activo') continue;
      ara.fuera = dentro ? 0 : ara.fuera + c.dt;
      if (ara.fuera > 1 || ara.desafio.id === 'intacto' && c.danoRecibido > ara.danoInicio ||
        ara.desafio.id === 'proteger' && c.enemigosEn(ara.actor.x, ara.actor.z, 2) > 0) {
        ara.estado = 'fallado';
        this.reproducir(ara.actor, CLIPS_ARA.fallado, true);
        this.eventos.toast('ADA', 'Desafío fallado. El ara queda en silencio.', 4);
        continue;
      }
      if (dentro) ara.t += c.dt;
      const progreso = ara.desafio.id === 'cazar'
        ? (c.bajas - ara.bajasInicio) / (ara.desafio.objetivo ?? 1)
        : ara.t / ara.desafio.duracion;
      const accionProgreso = ara.actor.acciones.get(CLIPS_ARA.progreso);
      if (accionProgreso) {
        accionProgreso.paused = true;
        accionProgreso.play();
        accionProgreso.time = THREE.MathUtils.clamp(progreso, 0, 1) * accionProgreso.getClip().duration;
      }
      if (progreso >= 1) {
        ara.estado = 'superado';
        this.reproducir(ara.actor, CLIPS_ARA.superado, true);
        this.eventos.aplicar(ara.desafio.recompensa);
        this.eventos.toast('ADA', 'Ara del Sol superada.', 4);
      } else if (ara.actor.actual !== CLIPS_ARA.durante && ara.t >= 1.6) {
        this.reproducir(ara.actor, CLIPS_ARA.durante);
      }
    }
  }

  private actualizarNpcs(c: ContextoContenido) {
    for (const npc of this.npcs) {
      const cerca = Math.hypot(c.px - npc.actor.x, c.pz - npc.actor.z) <= DISTANCIAS_NPC.saludar;
      if (cerca && !npc.cerca) {
        npc.cerca = true;
        this.reproducir(npc.actor, CLIPS_NPC.saludar, true);
        this.eventos.toast(npc.def.nombre, frase(npc.def, 'saludo', c.tiempo), 4);
      } else if (!cerca && npc.cerca) {
        npc.cerca = false;
        this.reproducir(npc.actor, CLIPS_NPC.trabajar);
      } else if (cerca) {
        const giro = npc.actor.modelo.raiz.getObjectByName('giro');
        if (giro) giro.rotation.y = Math.atan2(c.px - npc.actor.x, c.pz - npc.actor.z) - npc.actor.modelo.raiz.rotation.y;
      }
    }
  }

  private crearSuministro(px: number, pz: number) {
    const a = this.rand() * Math.PI * 2;
    const candidato = this.world.resolve(px + Math.cos(a) * 10, pz + Math.sin(a) * 10, 1, { x: 0, z: 0 });
    const actor = this.poner('caja-suministros-' + Math.floor(this.rand() * 1e6), () => crearCaja('suministros'), candidato.x, candidato.z, -a, CLIPS_CAJA.llegar);
    this.cajas.push({
      actor,
      def: CAJAS.find((c) => c.id === 'caja-suministros')!,
      progreso: 0,
      abierta: false,
      entregada: false,
      dinamica: true,
    });
  }

  /** El gólem del altar sale delante de él, a 6 m. */
  private crearGolem(altar: EstadoAltar) {
    this.golem?.dispose();
    const ang = altar.actor.modelo.raiz.rotation.y;
    const p = this.world.resolve(altar.actor.x + Math.sin(ang) * 6, altar.actor.z + Math.cos(ang) * 6, 3, { x: 0, z: 0 });
    const def = GOLEMS[altar.def.jefe];
    this.golem = new JefeGolem(this.scene, this.world, def, p.x, p.z, ang, {
      empujar: this.eventos.empujar,
      aviso: this.eventos.aviso,
      sacudida: this.eventos.sacudida,
      sonido: this.eventos.sonido,
    }, this.rand);
    this.altarGolem = altar;
    this.eventos.toast('HELIOS', def.nombre + ' despierta en el ' + altar.def.nombre.toLowerCase() + '.', 5);
  }

  /** Un minijefe nuevo a 26 m del jugador, con más vida cuanto más avanzada la partida. */
  private crearMinijefe(c: ContextoContenido) {
    const disponibles = MINIJEFES.tipos.filter((t) => c.tiempo >= t.desde);
    const tipo = disponibles[this.minijefesCreados % disponibles.length];
    this.minijefesCreados++;
    const a = this.rand() * Math.PI * 2;
    const p = this.world.resolve(c.px + Math.cos(a) * 26, c.pz + Math.sin(a) * 26, 3, { x: 0, z: 0 });
    const ang = Math.atan2(c.px - p.x, c.pz - p.z);
    const vidaMax = Math.round(tipo.vida * (1 + 0.12 * c.tiempo / 60));
    let modelo: () => Modelo;
    let datos: Pick<EstadoJefe, 'velocidad' | 'radio' | 'entrada' | 'clipMover' | 'clipEntrada' | 'clipFase' | 'clipDerrota' | 'ataques'>;
    if (tipo.id === 'segador-jefe') {
      modelo = crearSegadorJefe;
      datos = {
        velocidad: 3.6, radio: 2.2, entrada: 2.8,
        clipMover: 'Avanzar', clipEntrada: 'Rugir', clipFase: 'Furia', clipDerrota: 'Derrota',
        ataques: Object.entries(TIEMPOS_JEFE_COSECHA).map(([nombre, t]) => ({ nombre, ...t })),
      };
    } else if (tipo.id === 'heraldo') {
      modelo = crearHeraldo;
      datos = {
        velocidad: 2.9, radio: 2.5, entrada: 3,
        clipMover: 'Flotar', clipEntrada: 'Entrada', clipFase: 'Furia', clipDerrota: 'Derrota',
        ataques: Object.entries(TIEMPOS_HERALDO).map(([nombre, t]) => ({ nombre, ...t })),
      };
    } else {
      modelo = crearOjoHelios;
      datos = {
        velocidad: 2.4, radio: 3.2, entrada: 3.6,
        clipMover: 'Caminar', clipEntrada: 'Despertar', clipFase: 'Fase 2', clipDerrota: 'Derrota',
        ataques: Object.entries(TIEMPOS_OJO).map(([nombre, t]) => ({ nombre, golpe: t.golpe, finGolpe: t.finGolpe, duracion: t.duracion })),
      };
    }
    const actor = this.poner(`${tipo.id}-${this.minijefesCreados}`, modelo, p.x, p.z, ang, datos.clipEntrada, true);
    this.jefes.push({
      tipo: tipo.id,
      actor,
      tMuerto: 0,
      nombre: tipo.nombre,
      vidaMax,
      ...datos,
      vida: vidaMax,
      indiceAtaque: 0,
      ataque: null,
      tAtaque: 0,
      golpeAplicado: false,
      fase2: false,
      capaFasePendiente: 0,
      capaFaseActiva: false,
      derrotado: false,
    });
    this.eventos.toast('HELIOS', tipo.nombre + ' se acerca.', 4);
  }

  private actualizarJefes(c: ContextoContenido) {
    // Calendario de minijefes: cada vez más seguidos, con un tope de vivos.
    if (c.tiempo >= this.siguienteMinijefe) {
      const cada = Math.max(MINIJEFES.cadaMinimo, MINIJEFES.cada - MINIJEFES.bajaPorMinuto * c.tiempo / 60);
      this.siguienteMinijefe = c.tiempo + cada;
      if (this.jefes.filter((j) => !j.derrotado).length < MINIJEFES.maximoVivos) this.crearMinijefe(c);
    }
    let dano = 0;
    for (const jefe of [...this.jefes]) {
      if (jefe.derrotado) {
        jefe.tMuerto += c.dt;
        if (jefe.tMuerto > 3.5) {
          this.eliminarActor(jefe.actor);
          this.jefes = this.jefes.filter((j) => j !== jefe);
        }
        continue;
      }
      dano += this.actualizarJefe(jefe, c);
    }
    return dano;
  }

  private actualizarJefe(jefe: EstadoJefe, c: ContextoContenido) {
    if (this.aturdidos.has(jefe.actor.id)) return 0;
    if (jefe.entrada > 0) {
      jefe.entrada -= c.dt;
      if (jefe.entrada <= 0) this.reproducir(jefe.actor, jefe.clipMover);
      return 0;
    }
    if (jefe.fase2 && !jefe.capaFaseActiva) {
      jefe.capaFasePendiente -= c.dt;
      if (jefe.capaFasePendiente <= 0) {
        const capa = jefe.actor.acciones.get('Enfurecido');
        if (capa) capa.reset().fadeIn(0.2).play();
        jefe.capaFaseActiva = true;
      }
    }
    const raiz = jefe.actor.modelo.raiz;
    const dx = c.px - raiz.position.x;
    const dz = c.pz - raiz.position.z;
    const d = Math.hypot(dx, dz) || 1;
    if (!jefe.ataque) {
      raiz.rotation.y = Math.atan2(dx, dz);
      jefe.tAtaque += c.dt;
      if (jefe.tAtaque >= 2.2 && d < 12) {
        jefe.ataque = jefe.ataques[jefe.indiceAtaque++ % jefe.ataques.length];
        jefe.tAtaque = 0;
        jefe.golpeAplicado = false;
        this.reproducir(jefe.actor, jefe.ataque.nombre, true);
      } else if (d > 4.2) {
        const paso = Math.min(d - 3.8, jefe.velocidad * c.dt);
        const nx = raiz.position.x + dx / d * paso;
        const nz = raiz.position.z + dz / d * paso;
        const r = this.world.resolve(nx, nz, jefe.radio, { x: 0, z: 0 });
        raiz.position.set(r.x, this.world.heightAt(r.x, r.z), r.z);
        jefe.actor.x = r.x;
        jefe.actor.z = r.z;
      }
      return d < jefe.radio + 0.7 ? 7 * c.dt : 0;
    }

    jefe.tAtaque += c.dt;
    let dano = 0;
    const enVentana = jefe.ataque.nombre === 'Invocar'
      ? jefe.tAtaque >= jefe.ataque.golpe
      : jefe.tAtaque >= jefe.ataque.golpe && jefe.tAtaque <= jefe.ataque.finGolpe;
    if (!jefe.golpeAplicado && enVentana) {
      if (jefe.tipo === 'ojo-helios' && jefe.ataque.nombre === 'Invocar') {
        jefe.golpeAplicado = true;
        for (const a of [-Math.PI / 3, 0, Math.PI / 3]) {
          c.crearBaliza(raiz.position.x + Math.sin(raiz.rotation.y + a) * 6, raiz.position.z + Math.cos(raiz.rotation.y + a) * 6);
        }
      } else if (this.jugadorEnAtaque(jefe, c)) {
        jefe.golpeAplicado = true;
        dano = jefe.tipo === 'ojo-helios' ? 28 : jefe.tipo === 'heraldo' ? 20 : 24;
        // Los golpes de los minijefes también empujan.
        this.eventos.empujar?.(dx / d * 9, dz / d * 9, 3);
      }
    }
    if (jefe.tAtaque >= jefe.ataque.duracion) {
      jefe.ataque = null;
      jefe.tAtaque = 0;
      this.reproducir(jefe.actor, jefe.clipMover);
    }
    return dano;
  }

  /** Formas de daño de ESPEC.md, evaluadas durante la ventana del clip. */
  private jugadorEnAtaque(jefe: EstadoJefe, c: ContextoContenido) {
    const raiz = jefe.actor.modelo.raiz;
    const dx = c.px - raiz.position.x;
    const dz = c.pz - raiz.position.z;
    const distancia = Math.hypot(dx, dz);
    const fx = Math.sin(raiz.rotation.y);
    const fz = Math.cos(raiz.rotation.y);
    const rx = Math.cos(raiz.rotation.y);
    const rz = -Math.sin(raiz.rotation.y);
    const delante = dx * fx + dz * fz;
    const lateral = dx * rx + dz * rz;
    const ataque = jefe.ataque!;

    if (jefe.tipo === 'segador-jefe') {
      if (ataque.nombre === 'Embestir') return delante >= 0 && delante <= 8 && Math.abs(lateral) <= 1.65;
      const angulo = Math.abs(Math.atan2(lateral, delante));
      return distancia >= 2.2 && distancia <= 4.6 && delante > 0 && angulo <= THREE.MathUtils.degToRad(65);
    }
    if (jefe.tipo === 'heraldo') {
      if (ataque.nombre === 'Rociar') return Math.hypot(lateral, delante - 4.8) <= 2.6;
      return [-1.8, 0, 1.8].some((x) => Math.hypot(lateral - x, delante + 0.5) <= 1.35);
    }
    if (ataque.nombre === 'Rayo') {
      if (distancia < 2.6 || distancia > 10 || delante <= 0) return false;
      const progreso = THREE.MathUtils.clamp(
        (jefe.tAtaque - ataque.golpe) / Math.max(0.001, ataque.finGolpe - ataque.golpe),
        0,
        1,
      );
      const barrido = THREE.MathUtils.degToRad(-50 + progreso * 100);
      return Math.abs(Math.atan2(lateral, delante) - barrido) <= THREE.MathUtils.degToRad(10);
    }
    if (ataque.nombre === 'Pisotón') {
      const progreso = THREE.MathUtils.clamp(
        (jefe.tAtaque - ataque.golpe) / Math.max(0.001, ataque.finGolpe - ataque.golpe),
        0,
        1,
      );
      const radio = 1.5 + progreso * 4.5;
      return Math.abs(distancia - radio) <= 1.2;
    }
    return false;
  }

  private golpearJefe(jefe: EstadoJefe, cantidad: number) {
    if (jefe.derrotado || cantidad <= 0) return 0;
    const antes = jefe.vida;
    jefe.vida = Math.max(0, jefe.vida - cantidad);
    if (!jefe.fase2 && jefe.vida <= jefe.vidaMax * 0.5) {
      jefe.fase2 = true;
      this.reproducir(jefe.actor, jefe.clipFase, true);
      jefe.capaFasePendiente = jefe.actor.acciones.get(jefe.clipFase)?.getClip().duration ?? 0;
      jefe.capaFaseActiva = false;
      jefe.ataque = null;
      jefe.tAtaque = -2.2;
    }
    if (jefe.vida <= 0) {
      jefe.derrotado = true;
      jefe.actor.acciones.get('Enfurecido')?.fadeOut(0.1);
      this.reproducir(jefe.actor, jefe.clipDerrota, true);
      // Botín: chatarra y, a veces, una bendición.
      this.eventos.aplicar(MINIJEFES.recompensa);
      if (this.rand() < MINIJEFES.bendicion) this.eventos.aplicar([{ tipo: 'bendicion', elegir: 1, suerte: 0.3 }]);
      this.eventos.toast('ADA', jefe.nombre + ' derribado.', 3);
    }
    return Math.min(cantidad, antes);
  }

  private golpearTorre(torre: EstadoTorre, cantidad: number) {
    if (torre.destruida || cantidad <= 0) return 0;
    const antes = torre.vida;
    torre.vida = Math.max(0, torre.vida - cantidad);
    this.reproducir(torre.actor, 'Golpe recibido', true);
    if (torre.vida <= 0) {
      torre.destruida = true;
      torre.tDestruida = 0;
      this.reproducir(torre.actor, 'Colapso', true);
      const def = ESTRUCTURAS.find((e) => e.id === 'torre-velo')!;
      this.eventos.aplicar(def.alDerribar ?? []);
      this.eventos.toast('ADA', 'Torre del Velo derribada. La señal cae.', 4);
    }
    return Math.min(cantidad, antes);
  }

  private eliminarActor(actor: Actor) {
    actor.mixer.stopAllAction();
    actor.mixer.uncacheRoot(actor.modelo.raiz);
    actor.modelo.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.scene.remove(actor.modelo.raiz);
    this.actores = this.actores.filter((a) => a !== actor);
  }
}
