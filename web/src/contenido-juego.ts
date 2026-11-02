import * as THREE from 'three';
import type { World } from './world.ts';
import type { Modelo } from './modelos/kit.ts';
import { crearAltarJefe } from './modelos/altar-jefe.ts';
import { crearAltarDesafio } from './modelos/altar-desafio.ts';
import { crearCaja } from './modelos/caja-premio.ts';
import { crearRefugio } from './modelos/refugio.ts';
import { crearTorreVelo } from './modelos/torre-velo.ts';
import { crearNpcMecanica } from './modelos/npc-mecanica.ts';
import { crearNpcVigia } from './modelos/npc-vigia.ts';
import { crearNpcBotanica } from './modelos/npc-botanica.ts';
import { crearSegadorJefe, TIEMPOS_JEFE_COSECHA } from './modelos/segador-jefe.ts';
import { crearHeraldo, TIEMPOS_HERALDO } from './modelos/heraldo.ts';
import { crearOjoHelios, TIEMPOS_OJO } from './modelos/ojo-helios.ts';
import {
  ALTARES_JEFE,
  CAJAS,
  CLIPS_ALTAR_JEFE,
  CLIPS_ARA,
  CLIPS_CAJA,
  CLIPS_NPC,
  COLOCACION,
  DESAFIOS,
  DISTANCIAS_NPC,
  ESTRUCTURAS,
  NPCS,
  RADIO_ARA,
  aQuienHabla,
  detectarIntencion,
  frase,
  tirarBotin,
  type AltarJefe,
  type Desafio,
  type Efecto,
  type Intencion,
  type NpcMapa,
} from './contenido/mapa.ts';

export type TipoMarca = 'altar' | 'ara' | 'caja' | 'torre' | 'refugio' | 'npc';

export interface MarcaContenido {
  id: string;
  tipo: TipoMarca;
  x: number;
  z: number;
  hecho?: boolean;
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

interface EstadoJefe {
  altar: EstadoAltar;
  actor: Actor;
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
}

export interface EventosContenido {
  toast: (quien: string, texto: string, segundos?: number) => void;
  aplicar: (efectos: Efecto[]) => void;
  curar: (cantidad: number) => void;
  alarma?: () => void;
  recoger?: () => void;
}

const nombresJefe: Record<AltarJefe['jefe'], string> = {
  'segador-jefe': 'Segador, Jefe de Cosecha',
  heraldo: 'Heraldo del Velo',
  'ojo-helios': 'Ojo de HELIOS',
};

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
export class ContenidoJuego {
  private rand: () => number;
  private actores: Actor[] = [];
  private altares: EstadoAltar[] = [];
  private cajas: EstadoCaja[] = [];
  private torres: EstadoTorre[] = [];
  private npcs: EstadoNpc[] = [];
  private aras: EstadoAra[] = [];
  private jefe: EstadoJefe | null = null;
  private ocupados: { x: number; z: number; r: number }[] = [];
  private refugio: Actor | null = null;
  private siguienteSuministro = 120;
  private exposicionValor = 0;
  private marcaActiva: MarcaContenido | null = null;
  private refugioAlarma = false;
  private refugioCalmaEn = 0;
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
    for (const a of this.altares) marcas.push({ id: a.def.id, tipo: 'altar', x: a.actor.x, z: a.actor.z, hecho: a.estado === 'agotado' });
    for (const a of this.aras) marcas.push({ id: a.actor.id, tipo: 'ara', x: a.actor.x, z: a.actor.z, hecho: a.estado === 'superado' });
    for (const c of this.cajas) marcas.push({ id: c.actor.id, tipo: 'caja', x: c.actor.x, z: c.actor.z, hecho: c.abierta });
    for (const t of this.torres) marcas.push({ id: t.actor.id, tipo: 'torre', x: t.actor.x, z: t.actor.z, hecho: t.destruida });
    if (this.refugio) marcas.push({ id: 'refugio', tipo: 'refugio', x: this.refugio.x, z: this.refugio.z });
    for (const n of this.npcs) marcas.push({ id: n.def.id, tipo: 'npc', x: n.actor.x, z: n.actor.z });
    return marcas;
  }

  get jefesHud(): JefeHud[] {
    return this.altares.map((altar) => {
      const activo = this.jefe?.altar === altar && !this.jefe.derrotado ? this.jefe : null;
      return {
        minuto: altar.def.minuto,
        nombre: nombresJefe[altar.def.jefe],
        vencido: altar.estado === 'recompensa' || altar.estado === 'listo' || altar.estado === 'agotado',
        vida: activo?.vida,
        vidaMax: activo?.vidaMax,
      };
    });
  }

  get objetivoJefe(): ObjetivoCombate[] {
    const objetivos: ObjetivoCombate[] = [];
    const jefe = this.jefe;
    if (jefe && !jefe.derrotado && jefe.entrada <= 0) {
      objetivos.push({
        id: jefe.actor.id,
        x: jefe.actor.modelo.raiz.position.x,
        z: jefe.actor.modelo.raiz.position.z,
        radio: jefe.radio,
        activo: true,
        golpear: (cantidad) => this.golpearJefe(cantidad),
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

  reset() {
    if (this.jefe) {
      this.eliminarActor(this.jefe.actor);
      this.jefe = null;
    }
    for (const caja of this.cajas.filter((c) => c.dinamica)) this.eliminarActor(caja.actor);
    this.cajas = this.cajas.filter((c) => !c.dinamica);
    this.exposicionValor = 0;
    this.marcaActiva = null;
    this.siguienteSuministro = 120;
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
    }

    this.actualizarExposicion(c);
    this.actualizarAltares(c);
    this.actualizarCajas(c);
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

    return this.actualizarJefe(c);
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

  marcar(que: 'altar' | 'caja' | 'torre' | 'ara' | 'refugio', px: number, pz: number) {
    const tipo = que === 'altar' ? 'altar' : que === 'caja' ? 'caja' : que === 'torre' ? 'torre' : que === 'ara' ? 'ara' : 'refugio';
    const candidatos = this.marcas.filter((m) => m.tipo === tipo && !m.hecho);
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
      this.npcs.push({ actor, def, cerca: false });
    });

    const altaresId = ['altar-cosecha', 'altar-heraldo', 'altar-ojo'] as const;
    altaresId.forEach((id, k) => {
      const p = this.buscar(COLOCACION.altaresJefe.distancia, 4, COLOCACION.altaresJefe.separacionMinima);
      const actor = this.poner(id, () => crearAltarJefe(k === 0 ? 'cosecha' : k === 1 ? 'heraldo' : 'ojo'), p.x, p.z, haciaCentro(p.x, p.z), CLIPS_ALTAR_JEFE.dormido);
      this.altares.push({ def: ALTARES_JEFE[k], actor, estado: 'dormido', t: 0 });
    });

    for (let k = 0; k < COLOCACION.aras.cuantos; k++) {
      const p = this.buscar(COLOCACION.aras.distancia, 4, COLOCACION.aras.separacionMinima);
      const actor = this.poner('altar-desafio-' + k, crearAltarDesafio, p.x, p.z, haciaCentro(p.x, p.z), CLIPS_ARA.espera);
      this.aras.push({ actor, desafio: DESAFIOS[k % 3], estado: 'espera', t: 0, fuera: 0, bajasInicio: 0, danoInicio: 0 });
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
        : id.startsWith('altar-desafio') ? 65
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
      if (altar.estado === 'dormido' && c.tiempo >= altar.def.minuto * 60 && (!this.jefe || this.jefe.derrotado)) {
        altar.estado = 'invocando';
        altar.t = 0;
        this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.invocar, true);
        this.eventos.toast('ADA', altar.def.nombre + ' se está abriendo.', 4);
      } else if (altar.estado === 'invocando' && altar.t >= CLIPS_ALTAR_JEFE.apareceJefe) {
        this.crearJefe(altar);
        altar.estado = 'combate';
        altar.t = 0;
        this.reproducir(altar.actor, CLIPS_ALTAR_JEFE.combate);
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
            this.eventos.toast('ADA', caja.def.nombre + ' abierta.', 3);
          }
        }
        continue;
      }
      const cerca = Math.hypot(c.px - caja.actor.x, c.pz - caja.actor.z) < 1.8;
      caja.progreso = cerca ? caja.progreso + c.dt : Math.max(0, caja.progreso - c.dt * 2);
      if (caja.progreso < caja.def.apertura.segundos) continue;
      caja.abierta = true;
      caja.progreso = 0;
      this.reproducir(caja.actor, CLIPS_CAJA.abrir, true);
      if (caja.def.apertura.exposicion) this.cambiarExposicion(caja.def.apertura.exposicion);
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

  private crearJefe(altar: EstadoAltar) {
    if (this.jefe?.derrotado) {
      this.scene.remove(this.jefe.actor.modelo.raiz);
      this.actores = this.actores.filter((actor) => actor !== this.jefe?.actor);
      this.jefe = null;
    }
    let modelo: () => Modelo;
    let datos: Omit<EstadoJefe,
      'altar' | 'actor' | 'vida' | 'ataque' | 'tAtaque' | 'golpeAplicado' |
      'fase2' | 'capaFasePendiente' | 'capaFaseActiva' | 'derrotado' | 'indiceAtaque'
    >;
    if (altar.def.jefe === 'segador-jefe') {
      modelo = crearSegadorJefe;
      datos = {
        nombre: nombresJefe[altar.def.jefe], vidaMax: 1400, velocidad: 1.9, radio: 2.2, entrada: 2.8,
        clipMover: 'Avanzar', clipEntrada: 'Rugir', clipFase: 'Furia', clipDerrota: 'Derrota',
        ataques: Object.entries(TIEMPOS_JEFE_COSECHA).map(([nombre, t]) => ({ nombre, ...t })),
      };
    } else if (altar.def.jefe === 'heraldo') {
      modelo = crearHeraldo;
      datos = {
        nombre: nombresJefe[altar.def.jefe], vidaMax: 2100, velocidad: 1.35, radio: 2.5, entrada: 3,
        clipMover: 'Flotar', clipEntrada: 'Entrada', clipFase: 'Furia', clipDerrota: 'Derrota',
        ataques: Object.entries(TIEMPOS_HERALDO).map(([nombre, t]) => ({ nombre, ...t })),
      };
    } else {
      modelo = crearOjoHelios;
      datos = {
        nombre: nombresJefe[altar.def.jefe], vidaMax: 3200, velocidad: 1.15, radio: 3.2, entrada: 3.6,
        clipMover: 'Caminar', clipEntrada: 'Despertar', clipFase: 'Fase 2', clipDerrota: 'Derrota',
        ataques: Object.entries(TIEMPOS_OJO).map(([nombre, t]) => ({ nombre, golpe: t.golpe, finGolpe: t.finGolpe, duracion: t.duracion })),
      };
    }
    const ang = altar.actor.modelo.raiz.rotation.y;
    const x = altar.actor.x + Math.sin(ang) * 5;
    const z = altar.actor.z + Math.cos(ang) * 5;
    const actor = this.poner(altar.def.jefe, modelo, x, z, ang, datos.clipEntrada, true);
    this.jefe = {
      altar,
      actor,
      ...datos,
      vida: datos.vidaMax,
      indiceAtaque: 0,
      ataque: null,
      tAtaque: 0,
      golpeAplicado: false,
      fase2: false,
      capaFasePendiente: 0,
      capaFaseActiva: false,
      derrotado: false,
    };
    this.eventos.toast('HELIOS', datos.nombre + ' desplegado.', 5);
  }

  private actualizarJefe(c: ContextoContenido) {
    const jefe = this.jefe;
    if (!jefe || jefe.derrotado) return 0;
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
      if (jefe.actor.id === 'ojo-helios' && jefe.ataque.nombre === 'Invocar') {
        jefe.golpeAplicado = true;
        for (const a of [-Math.PI / 3, 0, Math.PI / 3]) {
          c.crearBaliza(raiz.position.x + Math.sin(raiz.rotation.y + a) * 6, raiz.position.z + Math.cos(raiz.rotation.y + a) * 6);
        }
      } else if (this.jugadorEnAtaque(jefe, c)) {
        jefe.golpeAplicado = true;
        dano = jefe.actor.id === 'ojo-helios' ? 28 : jefe.actor.id === 'heraldo' ? 20 : 24;
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

    if (jefe.actor.id === 'segador-jefe') {
      if (ataque.nombre === 'Embestir') return delante >= 0 && delante <= 8 && Math.abs(lateral) <= 1.65;
      const angulo = Math.abs(Math.atan2(lateral, delante));
      return distancia >= 2.2 && distancia <= 4.6 && delante > 0 && angulo <= THREE.MathUtils.degToRad(65);
    }
    if (jefe.actor.id === 'heraldo') {
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

  private golpearJefe(cantidad: number) {
    const jefe = this.jefe;
    if (!jefe || jefe.derrotado || cantidad <= 0) return 0;
    const antes = jefe.vida;
    jefe.vida = Math.max(0, jefe.vida - cantidad);
    if (!jefe.fase2 && jefe.vida <= jefe.vidaMax * 0.5) {
      jefe.fase2 = true;
      this.reproducir(jefe.actor, jefe.clipFase, true);
      jefe.capaFasePendiente = jefe.actor.acciones.get(jefe.clipFase)?.getClip().duration ?? 0;
      jefe.capaFaseActiva = false;
      jefe.ataque = null;
      jefe.tAtaque = -2.2;
      this.eventos.toast('ADA', jefe.nombre + ' entra en fase dos.', 4);
    }
    if (jefe.vida <= 0) {
      jefe.derrotado = true;
      jefe.actor.acciones.get('Enfurecido')?.fadeOut(0.1);
      this.reproducir(jefe.actor, jefe.clipDerrota, true);
      jefe.altar.estado = 'recompensa';
      jefe.altar.t = 0;
      this.reproducir(jefe.altar.actor, CLIPS_ALTAR_JEFE.vencido, true);
      this.eventos.toast('ADA', jefe.nombre + ' derrotado.', 5);
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
