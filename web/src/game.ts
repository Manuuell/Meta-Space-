import * as THREE from 'three';
import { ENEMIES, ESCALADO, EnemyId, GEAR, GearId, MAX_HERRAMIENTAS, MOVE, PassiveId, RELICS, RUN, WEAPONS, WeaponId, factorNivel } from './data';
import { World } from './world';
import { Enemies } from './enemies';
import { Weapons, Modifiers } from './weapons';
import { Pickups, RelicDrop } from './pickups';
import { astronautFrames, blobShadowTexture } from './sprites';
import { consumeLook, endFrame, isHeld, isLocked, lockPointer, moveVector, piloto, ratonHeld, unlockPointer, wasPressed } from './input';
import { sfx, unlockAudio } from './audio';
import { loadSave, writeSave } from './save';
import * as ui from './ui';
import {
  claveDe, directorParams, dpsBuild, rollChoices as tirarCartas,
  type DepsTirada, type EstadoBuild, type TablaArmas,
} from './progression';

const TABLA_ARMAS: TablaArmas = Object.fromEntries(
  (Object.keys(WEAPONS) as WeaponId[]).map((id) => [id, WEAPONS[id].levels.map((s, k) => ({
    damage: s.damage * factorNivel(k + 1), cooldown: s.cooldown, count: s.count, area: s.area,
  }))]),
) as TablaArmas;
import { showTitle } from './ui-title';
import { openCharacterCreator } from './creator/character-creator';
import { applyCustomHero, toCustomHero } from './creator/player-contract';
import type { HeroTuning } from './creator/player-contract';
import { SPECIALS } from './creator/stats';
import { openProfileMenu } from './profile/profile-menu';
import { showCinematica } from './cinematica';
import { showIntro } from './intro';
import { Dron } from './dron';
import { Companero } from './companero';
import { COMPANEROS, fijarEstiloBruno, perfilDe, type FormaAda } from './companeros';
import type { OpcionesPerro } from './modelos/perro';
import { abrirSelectorCompanero } from './ui-companero';
import {
  AYUDA_COMANDOS, abrirLineaComando, callar, grabarVoz, hablar,
  parsearComando, reconocimientoLocal, transcribirServidor, webmAWav16k,
} from './voz';
import { Radio, type EventoNpc, type Hablante, type RunBrief } from './npcs';
import { Camara } from './camara';
import { crearAstronauta } from './modelos/astronauta';
import { crearMara } from './modelos/mara';
import { crearIdris } from './modelos/idris';
import { crearNoa } from './modelos/noa';
import { crearTaro } from './modelos/taro';
import { crearAmara } from './modelos/amara';
import type { Modelo } from './modelos/kit';
import { crearAerotabla, crearBotasImpulso, crearMochilaCohete } from './modelos/equipo';
import {
  CUPO, NubeEsporas, angulosDePatron, criasAlMorir, oleadaEspecial, quiereDisparar, tasaEspecial,
} from './enemies-nuevos';
import { multChatarraElite, type EliteMod } from './enemies';
import { ContenidoJuego, VISTA_MAPA, type RespuestaNpc } from './contenido-juego';
import type { Efecto } from './contenido/mapa';
import { lineaNpcMapa } from './npcs';
import { NumerosDano } from './numeros';
import {
  BENDICIONES, RAREZAS, describir, tirarBendiciones, totalesVacios,
  type Bendicion, type BendicionId, type Totales,
} from './bendiciones';
import { mostrarMejoras } from './mejoras';
import { abrirMapa } from './ui-mapa';
import { alerta, marcarAcierto } from './hud';
import { CANON, DESMONTAR } from './contenido/mapa';
import type { OpcionHallazgo } from './hallazgos';
import { pilotar } from './demo';
import { zonasActivas } from './avisos';
import { personaje, type PersonajeDef, type PersonajeId } from './personajes';
import { abrirSelectorPersonaje } from './ui-personaje';
import { crearHabilidad, type ContextoHabilidad, type Habilidad } from './habilidades';

const MODELOS_PERSONAJE: Record<PersonajeId, () => Modelo> = {
  especialista: crearAstronauta,
  'mara-ilyin': crearMara,
  'idris-okafor': crearIdris,
  'noa-herrera': crearNoa,
  'taro-sato': crearTaro,
  'amara-keita': crearAmara,
};

type State = 'title' | 'playing' | 'levelup' | 'paused' | 'results' | 'mapa';

// Cámara en tercera persona, detrás y algo por encima, como en PokéBonk.
const PITCH_MIN = 0.12;
const PITCH_MAX = 1.05;
const LOOK_SPEED = 0.0024;
const PLAYER_RADIUS = 0.4;
const PLAYER_HEIGHT = 2.6;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.3, 1200);
  private world: World;
  private enemies: Enemies;
  private contenido: ContenidoJuego;
  private pickups: Pickups;
  private weapons!: Weapons;
  private relicDrops: RelicDrop[] = [];

  private player: THREE.Sprite;
  private shadow: THREE.Mesh;
  // Astronauta 3D (src/modelos). El sprite solo se usa con el héroe del creador.
  private astronauta = crearAstronauta();
  private mezclador = new THREE.AnimationMixer(this.astronauta.raiz);
  private acciones = new Map<string, THREE.AnimationAction>();
  private clipActual = '';
  private rumbo = Math.PI;
  private golpeHasta = 0;
  private golpeListo = 0;
  private habilidadHasta = 0;
  private frames = astronautFrames();
  private hurtFlash = 0;
  // Hacia dónde mira la cámara: yaw 0 es el norte (−z), donde está el cohete.
  private yaw = 0;
  private pitch = 0.36;
  // Soltar el puntero a propósito (subida de nivel, final) no debe pausar.
  private expectUnlock = false;

  private state: State = 'title';
  private clock = new THREE.Clock();
  private save = loadSave();
  private tmp = { x: 0, z: 0 };
  private personajeActual: PersonajeDef = personaje(this.save.personaje);
  private habilidad: Habilidad | null = null;
  private habilidadIntocableHasta = 0;

  // Estado de la partida en curso.
  private time = 0;
  private hp = RUN.maxHp;
  private maxHp = RUN.maxHp;
  private hpLost = 0;
  private level = 1;
  private xp = 0;
  private scrap = 0;
  private kills = 0;
  private killsByType: Record<EnemyId, number> = { recolector: 0, baliza: 0, segador: 0, saltador: 0, avispa: 0, caparazon: 0, sembrador: 0 };
  // Enemigos nuevos (FOCO 4): esporas, goteo especial y oleadas con intención.
  private esporas!: NubeEsporas;
  private deudaEsp: Record<string, number> = { saltador: 0, avispa: 0, caparazon: 0, sembrador: 0 };
  private criasPendientes: { cuando: number; tipo: EnemyId; n: number; x: number; z: number }[] = [];
  private oleadaEspecialHecha = new Set<number>();
  private lastHpScale = 1;
  private elitesVivas = 0;
  private passives = new Map<PassiveId, number>();
  private relicsFound: string[] = [];
  /** Herramientas que Iris ya ha desmontado en este sector (le quedan piezas para dos). */
  private desmontadas = 0;
  // Héroe personalizado del creador de personaje (Meta Space).
  private customSprite: THREE.Texture | null = null;
  private heroName = '';
  private heroMaxHp = RUN.maxHp;
  private heroSpeed = RUN.speed;
  private heroDamageMul = 1;
  private heroCooldownMul = 1;
  private heroSpecial: HeroTuning['special'] | null = null;
  private heroSpecialLevel = 0;
  private novaCooldown = 0;
  private shieldReady = false;
  private shieldCooldown = 0;
  private swarmHealTimer = 0;
  private ecoCooldown = 0;
  private noDamageTime = 0;
  private acidoAcumulado = 0;
  private usosNpc = new Map<string, number>();
  private temporales = new Map<string, { hasta: number; factor: number }>();
  private spawnDebt = 0;
  private nextSegador = 120;
  private nextSwarm = 60;
  private pendingLevels = 0;
  private destroyTitle: (() => void) | null = null;
  private introVista = false;
  // NPCs con IA (Muse Spark vía creator-server, respaldo local por semilla).
  private radio = new Radio();
  // Dron compañero ADA: sigue, explora y escanea; obedece voz o texto.
  private dron!: Dron;
  private companero!: Companero;
  private micBtn: HTMLButtonElement | null = null;
  private grabando: (() => void) | null = null;
  private vozConV = false;
  private vozApagada = false;
  private explorando = false;
  private brief: RunBrief | null = null;
  private heridoAvisado = false;
  private eliteAvisada = false;
  private mitadAvisada = false;
  private balizasAvisadas = false;
  // Progresión (FOCO 2): memoria de tiradas para anti-repetición y piedad.
  private ultimaOferta: string[] = [];
  private ultimaArma: WeaponId | null = null;
  private rechazos = new Map<string, number>();
  // Físicas del astronauta: velocidad con inercia, salto y cámara suavizada.
  private velX = 0;
  private velZ = 0;
  private velY = 0;
  private grounded = true;
  private coyote = 0;
  private jumpBuffer = 0;
  private squash = 0;
  private facing = 1;
  private camara!: Camara;
  private lastPulsoDmg = 0;
  private baseFov = 60;
  private jumpBtn: HTMLButtonElement | null = null;
  private touchJump = false;
  private touchJumpHeld = false;
  private dashBtn: HTMLButtonElement | null = null;
  private touchDash = false;
  private abilityBtn: HTMLButtonElement | null = null;
  private touchAbility = false;
  // Equipo de movilidad (cartas de equipo): mochila cohete, aerotabla y botas.
  private gear = new Map<GearId, number>();
  private combustible = 0;
  private propulsando = false;
  private dashCd = 0;
  private dashTime = 0;
  private dashX = 0;
  private dashZ = 0;
  private montado = false;
  private paradoTabla = 0;
  private mochila = crearMochilaCohete();
  private botas = crearBotasImpulso();
  private tabla = crearAerotabla();
  private mezcladorEquipo = new THREE.AnimationMixer(this.astronauta.raiz);
  private mezcladorTabla = new THREE.AnimationMixer(this.tabla.raiz);
  private chorrosMochila: THREE.Object3D[] = [];
  private chorrosBotas: THREE.Object3D[] = [];
  private hudEquipo: HTMLDivElement | null = null;
  private barrasEquipo = new Map<string, HTMLElement>();
  // Números de daño, bendiciones de pilones y cofres, y marcas del mapa (M).
  private numeros: NumerosDano;
  private bendiciones: Bendicion[] = [];
  private totales: Totales = totalesVacios();
  private bendicionesPendientes: { elegir: number; suerte: number }[] = [];
  private puntosMapa: { x: number; z: number }[] = [];
  /** Mejoras elegidas al subir de nivel: cada una suma potencia de daño (ESCALADO). */
  private mejorasTomadas = 0;
  // Sprint con Shift: aguante de 0 a 1 y si ahora se corre a tope.
  private aguante = 1;
  private esprintando = false;
  // Cañón solar: nivel (0 = aún no lo tienes), recarga, si se apunta y cuánto
  // ha entrado ya la cámara de apuntar (0..1). `miraAlta` es hacia dónde
  // apunta en vertical (rad, + hacia el cielo).
  private canonNivel = 0;
  private canonCd = 0;
  private apuntando = false;
  private mezclaMira = 0;
  private miraAlta = 0.15;
  private trazos: { mesh: THREE.Mesh; t: number }[] = [];
  private geoTrazo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  private vMira = new THREE.Vector3();
  private vPos = new THREE.Vector3();
  private mMira = new THREE.Matrix4();
  private qMira = new THREE.Quaternion();
  /** Empuje de los golpes de los jefes (m/s): se suma al movimiento y se apaga solo. */
  private empujeX = 0;
  private empujeZ = 0;
  private descansoAguante = 0;

  /**
   * Modo demo (`?demo=jefes`): el piloto automático pelea contra el Cancerbero
   * y el dragón. Con `&personaje=<id>` lo hace con ese operador, sin guardarlo.
   */
  private demo: { fase: 'preparar' | 'cancerbero' | 'pausa' | 'dragon' | 'fin'; t: number } | null = null;

  constructor(private canvas: HTMLCanvasElement, opciones: { demo?: boolean; personaje?: string } = {}) {
    if (opciones.personaje) this.personajeActual = personaje(opciones.personaje);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.world = new World(this.scene);
    this.dron = new Dron(this.scene, (x, z) => this.world.heightAt(x, z));
    ui.onToast((quien) => { if (quien === 'ADA') this.dron.hablar(); });
    const mic = document.createElement('button');
    mic.textContent = '🎙';
    mic.setAttribute('aria-label', 'Hablar con el dron (o tecla T para escribir)');
    mic.style.cssText = 'position:fixed;left:18px;bottom:120px;width:64px;height:64px;border-radius:50%;'
      + 'border:2px solid rgba(94,224,255,.7);background:rgba(20,26,44,.72);color:#fff;font-size:26px;'
      + 'z-index:30;display:none;touch-action:none;';
    mic.addEventListener('pointerdown', (e) => { e.preventDefault(); this.hablarAlDron(); });
    document.body.appendChild(mic);
    this.micBtn = mic;
    this.camara = new Camara(this.camera, {
      alturaEn: (x, z) => this.world.heightAt(x, z),
      resolver: (x, z, r, out) => this.world.resolve(x, z, r, out),
    });
    this.enemies = new Enemies(this.scene, this.world);
    this.enemies.onDeath = (i) => this.onEnemyDeath(i);
    this.contenido = new ContenidoJuego(this.scene, this.world, {
      toast: (quien, texto, segundos) => ui.toast(quien, texto, 'info', segundos ?? 4),
      aplicar: (efectos) => this.aplicarEfectos(efectos),
      curar: (cantidad) => { this.hp = Math.min(this.maxHp, this.hp + cantidad); },
      empujar: (fx, fz, salto) => {
        if (this.intocable()) return;
        const factor = this.personajeActual.id === 'idris-okafor' && !this.customSprite ? .5 : 1;
        this.empujeX += fx * factor;
        this.empujeZ += fz * factor;
        if (salto > 0) {
          this.velY = Math.max(this.velY, salto);
          this.grounded = false;
        }
      },
      aviso: (texto) => alerta(texto),
      sacudida: () => this.camara.sacudidaPulso(),
      sonido: (nombre) => sfx(nombre),
      emboscada: (x, z, cuantos, radio) => this.emboscar(x, z, cuantos, radio),
      bengala: (desde, hacia, dano) => this.bengala(desde, hacia, dano),
      elegir: (titulo, frase, opciones, listo) => this.elegirHallazgo(titulo, frase, opciones, listo),
      forjar: (coste, hecho) => this.abrirFragua(coste, hecho),
    });
    this.pickups = new Pickups(this.scene, this.world);
    this.numeros = new NumerosDano(canvas);
    this.companero = new Companero(this.scene, this.enemies, this.pickups, this.world, this.dron);
    // Antes había dos perros: el «de paseo» llevaba gorra, gafas y pajarita verde.
    if (this.save.companero === 'perro-paseo' && !this.save.estiloBruno) this.save.estiloBruno = { pajarita: 'verde', gorra: true, gafas: true };
    if (this.save.companero?.startsWith('perro')) this.save.companero = 'bruno';
    if (this.save.estiloBruno) fijarEstiloBruno(this.save.estiloBruno);
    this.companero.setForma(this.formaInicial());

    this.player = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.frames.back[0] }));
    this.player.center.set(0.5, 0);
    this.player.scale.set(PLAYER_HEIGHT * 0.8, PLAYER_HEIGHT, 1);
    this.player.visible = false;
    this.scene.add(this.player);

    this.scene.add(this.astronauta.raiz);
    for (const a of this.astronauta.animaciones) {
      const accion = this.mezclador.clipAction(a.clip);
      if (!a.bucle) {
        accion.setLoop(THREE.LoopOnce, 1);
        accion.clampWhenFinished = true;
      }
      this.acciones.set(a.clip.name, accion);
    }
    this.animarAstronauta('Reposo');
    this.montarEquipo();
    if (this.personajeActual.id !== 'especialista') this.montarModeloPersonaje(this.personajeActual);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.position.y = 0.03;
    this.scene.add(this.shadow);

    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Botón de salto en táctil: el joystick no tiene salto.
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      const b = document.createElement('button');
      b.textContent = '⤒';
      b.setAttribute('aria-label', 'Saltar');
      b.style.cssText = 'position:fixed;right:18px;bottom:120px;width:64px;height:64px;border-radius:50%;'
        + 'border:2px solid rgba(94,224,255,.7);background:rgba(20,26,44,.72);color:#5ee0ff;font-size:26px;'
        + 'z-index:30;display:none;touch-action:none;';
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        unlockAudio();
        this.touchJump = true;
        this.touchJumpHeld = true;
      });
      // Mantener el botón sostiene la mochila cohete.
      const soltar = () => (this.touchJumpHeld = false);
      b.addEventListener('pointerup', soltar);
      b.addEventListener('pointercancel', soltar);
      b.addEventListener('pointerleave', soltar);
      document.body.appendChild(b);
      this.jumpBtn = b;

      // Acelerón de las botas de impulso: solo aparece al tenerlas.
      const d = document.createElement('button');
      d.textContent = '»';
      d.setAttribute('aria-label', 'Acelerón');
      d.style.cssText = 'position:fixed;right:18px;bottom:196px;width:56px;height:56px;border-radius:50%;'
        + 'border:2px solid rgba(255,210,90,.8);background:rgba(20,26,44,.72);color:#ffd25a;font-size:28px;'
        + 'z-index:30;display:none;touch-action:none;';
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.touchDash = true;
      });
      document.body.appendChild(d);
      this.dashBtn = d;

      const r = document.createElement('button');
      r.textContent = 'R';
      r.setAttribute('aria-label', 'Habilidad característica');
      r.style.cssText = 'position:fixed;left:18px;bottom:32px;width:64px;height:64px;border-radius:50%;'
        + 'border:2px solid #7566f5;background:rgba(20,26,44,.82);color:#fff;font:bold 24px Rubik,system-ui;'
        + 'z-index:31;display:none;touch-action:none;';
      r.addEventListener('pointerdown', (e) => { e.preventDefault(); this.touchAbility = true; });
      document.body.appendChild(r);
      this.abilityBtn = r;
    }

    // Cualquier gesto desbloquea el audio (los navegadores lo exigen).
    const unlock = () => unlockAudio();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);

    // Un clic en el mundo captura el ratón para girar la cámara.
    canvas.addEventListener('click', () => {
      if (this.state === 'playing') lockPointer(canvas);
    });
    // Esc suelta el puntero sin que la página reciba la tecla: eso es pausa.
    document.addEventListener('pointerlockchange', () => {
      if (isLocked()) return;
      if (this.expectUnlock) { this.expectUnlock = false; return; }
      if (this.state === 'playing') this.pause();
    });

    if (opciones.demo) this.empezarDemo();
    else this.toTitle();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /**
   * Cuelga el equipo del operador de sus enganches: la mochila cohete del
   * centro de la espalda y las botas de los tobillos, para que se muevan con
   * sus huesos (cada cuerpo pone los enganches donde le caen bien). La
   * aerotabla va suelta bajo los pies. Todo empieza oculto hasta que sale su carta.
   */
  private montarEquipo() {
    const r = this.astronauta.raiz;
    const m = this.mochila.raiz.getObjectByName('mochila_cohete')!;
    m.position.set(0, 0, 0);
    r.getObjectByName('enganche_mochila')!.add(m);
    for (const lado of ['i', 'd']) {
      const b = this.botas.raiz.getObjectByName(`bota_${lado}`)!;
      b.position.set(0, 0, 0);
      r.getObjectByName(`enganche_bota_${lado}`)!.add(b);
      this.chorrosBotas.push(b.getObjectByName(`chorro_bota_${lado}`)!);
      this.chorrosMochila.push(m.getObjectByName(`chorro_mochila_${lado}`)!);
    }
    for (const c of [...this.chorrosBotas, ...this.chorrosMochila]) c.scale.setScalar(0.001);
    // Las llamas parpadean siempre; el juego solo decide su tamaño.
    for (const a of [...this.mochila.animaciones, ...this.botas.animaciones]) this.mezcladorEquipo.clipAction(a.clip).play();
    this.mezcladorTabla.clipAction(this.tabla.animaciones[0].clip).play();
    this.scene.add(this.tabla.raiz);
    this.vestirEquipo();
  }

  /** Cambia el modelo articulado conservando los enganches del equipo. */
  private montarModeloPersonaje(def: PersonajeDef) {
    const vieja = this.astronauta.raiz;
    // `montarEquipo` mueve estas piezas desde sus modelos a los nodos del
    // personaje. Hay que recuperarlas antes de retirar el esqueleto viejo.
    const mochila = vieja.getObjectByName('mochila_cohete');
    if (mochila) this.mochila.raiz.add(mochila);
    for (const lado of ['i', 'd']) {
      const bota = vieja.getObjectByName(`bota_${lado}`);
      if (bota) this.botas.raiz.add(bota);
    }
    this.mezclador.stopAllAction();
    this.mezcladorEquipo.stopAllAction();
    this.scene.remove(vieja);
    this.astronauta = MODELOS_PERSONAJE[def.id]();
    this.mezclador = new THREE.AnimationMixer(this.astronauta.raiz);
    this.mezcladorEquipo = new THREE.AnimationMixer(this.astronauta.raiz);
    this.acciones.clear();
    this.chorrosBotas = [];
    this.chorrosMochila = [];
    this.scene.add(this.astronauta.raiz);
    for (const a of this.astronauta.animaciones) {
      const accion = this.mezclador.clipAction(a.clip);
      if (!a.bucle) { accion.setLoop(THREE.LoopOnce, 1); accion.clampWhenFinished = true; }
      this.acciones.set(a.clip.name, accion);
    }
    this.clipActual = '';
    this.animarAstronauta('Reposo', 0);
    this.montarEquipo();
  }

  private elegirPersonaje(id: PersonajeId) {
    this.personajeActual = personaje(id);
    this.save.personaje = id;
    writeSave(this.save);
    // Elegir un operador predefinido desactiva el sprite del creador, que
    // puede volver a activarse desde Operador cuando el usuario quiera.
    this.customSprite = null;
    this.heroName = '';
    this.heroSpecial = null;
    this.heroSpecialLevel = 0;
    this.montarModeloPersonaje(this.personajeActual);
    this.toTitle();
  }

  /** Muestra las piezas de equipo que se tienen y repinta su HUD. */
  private vestirEquipo() {
    const r = this.astronauta.raiz;
    r.getObjectByName('mochila_cohete')!.visible = this.gear.has('mochila');
    for (const lado of ['i', 'd']) r.getObjectByName(`bota_${lado}`)!.visible = this.gear.has('botas');
    this.tabla.raiz.visible = this.montado;
    const jugando = this.state === 'playing';
    if (this.dashBtn) this.dashBtn.style.display = jugando && this.gear.has('botas') ? 'block' : 'none';

    if (!this.hudEquipo) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:100px;bottom:98px;gap:6px;z-index:30;pointer-events:none;'
        + 'font:700 11px Rubik,system-ui,sans-serif;letter-spacing:.02em;';
      document.body.appendChild(d);
      this.hudEquipo = d;
    }
    this.hudEquipo.innerHTML = '';
    this.barrasEquipo.clear();
    this.hudEquipo.style.display = jugando ? 'flex' : 'none';
    // Primero el compañero (su habilidad), luego el equipo de movilidad.
    const comp = this.companero.perfil;
    const fichas: [string, string, string][] = [['companero', `${comp.nombre} · ${comp.habilidad.nombre}`, comp.color]];
    for (const [id, nv] of this.gear) fichas.push([id, `${GEAR[id].name} · ${nv}`, GEAR[id].color]);
    for (const [id, texto, color] of fichas) {
      const chip = document.createElement('div');
      chip.style.cssText = `padding:4px 8px 6px;border-radius:8px;background:rgba(20,26,44,.8);border:1.5px solid ${color};color:#fff;min-width:92px;`;
      chip.textContent = texto;
      const pista = document.createElement('div');
      pista.style.cssText = 'margin-top:4px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);overflow:hidden;';
      const barra = document.createElement('div');
      barra.style.cssText = `height:100%;width:100%;background:${color};`;
      pista.appendChild(barra);
      chip.appendChild(pista);
      this.hudEquipo.appendChild(chip);
      this.barrasEquipo.set(id, barra);
    }
  }

  private barraEquipo(id: string, fraccion: number) {
    const b = this.barrasEquipo.get(id);
    if (b) b.style.width = `${Math.round(Math.max(0, Math.min(1, fraccion)) * 100)}%`;
  }

  /** Compañero: `?ada=bruno` en la dirección, o el elegido en el menú (se guarda). */
  private formaInicial(): FormaAda {
    const ids = COMPANEROS.map((c) => c.id) as string[];
    const url = new URLSearchParams(location.search).get('ada');
    if (url && ids.includes(url)) return url as FormaAda;
    const guardado = this.save.companero;
    return guardado && ids.includes(guardado) ? (guardado as FormaAda) : 'dron';
  }

  /** Cambia de compañero y lo recuerda. */
  elegirCompanero(id: FormaAda) {
    this.companero.setForma(id);
    this.save.companero = id;
    writeSave(this.save);
    this.vestirEquipo();
  }

  /** Cambia el estilo de Bruno (gorra, gafas, pajarita) y lo recuerda. */
  estiloDeBruno(e: Partial<OpcionesPerro>) {
    fijarEstiloBruno(e);
    this.save.estiloBruno = { ...(this.save.estiloBruno ?? { pajarita: 'cuadros', gorra: false, gafas: false }), ...e };
    writeSave(this.save);
    if (this.dron.forma === 'bruno') this.companero.setForma('bruno');
  }

  private cambiarFormaAda() {
    const i = COMPANEROS.findIndex((c) => c.id === this.dron.forma);
    const siguiente = COMPANEROS[(i + 1) % COMPANEROS.length];
    this.elegirCompanero(siguiente.id);
    ui.toast('Compañero', `${siguiente.nombre} (K para cambiar)`, 'info', 2.5);
  }

  /** Cambia de animación con un fundido corto; las de una vez empiezan de cero. */
  private animarAstronauta(nombre: string, fundido = 0.15) {
    if (nombre === this.clipActual) return;
    const nueva = this.acciones.get(nombre);
    if (!nueva) return;
    const vieja = this.acciones.get(this.clipActual);
    nueva.reset();
    nueva.timeScale = 1;
    nueva.play();
    if (vieja) nueva.crossFadeFrom(vieja, fundido, false);
    this.clipActual = nombre;
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // En vertical (móvil) se abre el campo para ver lo mismo a los lados.
    this.baseFov = w < h ? 72 : 60;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------- Estados

  private toTitle() {
    this.destroyTitle?.();
    this.destroyTitle = null;
    // Entrada: la nave trae el nombre de META SPACE y, al despegar, la historia
    // de Meta y Ares (algo más de un minuto, se salta con Esc) antes del menú.
    if (!this.introVista && !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) {
      this.introVista = true;
      showIntro(document.body, () => showCinematica(document.body, () => this.toTitle()));
      return;
    }
    this.state = 'title';
    ui.hideHud();
    this.camara?.iniciarTransicion('titulo');
    if (this.jumpBtn) this.jumpBtn.style.display = 'none';
    if (this.hudEquipo) this.hudEquipo.style.display = 'none';
    if (this.dashBtn) this.dashBtn.style.display = 'none';
    if (this.abilityBtn) this.abilityBtn.style.display = 'none';
    if (this.micBtn) this.micBtn.style.display = 'none';
    this.resetRun();
    let started = false;
    this.destroyTitle = showTitle(this.save, () => {
      if (started) return;
      started = true;
      this.destroyTitle = null;
      this.startRun();
    }, {
      onCreator: () => void this.openProfile(),
      onCompanion: () => abrirSelectorCompanero(this.dron.forma, (id) => this.elegirCompanero(id), () => this.toTitle(), (e) => this.estiloDeBruno(e)),
      onCharacter: () => abrirSelectorPersonaje(this.personajeActual.id, (id) => this.elegirPersonaje(id), () => this.toTitle()),
      character: this.personajeActual,
      companionName: perfilDe(this.dron.forma).nombre,
      customHeroName: this.heroName || undefined,
      customHeroSpecial: this.heroSpecial ? SPECIALS[this.heroSpecial].name : undefined,
    });
  }

  private async openProfile() {
    const profile = await openProfileMenu({
      profileId: this.save.profileId,
      profileName: this.save.profileName,
      profileFrame: this.save.profileFrame,
      profileTitle: this.save.profileTitle,
      profileBackdrop: this.save.profileBackdrop,
      onCustom: () => void this.openCustomCreator(),
    });
    if (!profile) return;
    Object.assign(this.save, profile);
    writeSave(this.save);
    this.toTitle();
  }

  private async openCustomCreator() {
    const hero = await openCharacterCreator();
    if (!hero) return;
    await applyCustomHero(this, toCustomHero(hero));
    const who = this.heroName ? ` como ${this.heroName}` : '';
    ui.toast('ADA', `Héroe listo${who}. Pulsa JUGAR para despegar.`, 'info', 5);
  }

  /** Hablar con el dron: micrófono → Meta/local → comando. */
  private async hablarAlDron() {
    if (this.state !== 'playing') return;
    if (this.grabando) {
      this.grabando();
      return;
    }
    unlockAudio();
    try {
      const g = grabarVoz(6000);
      this.grabando = g.parar;
      ui.toast('ADA', 'Te escucho… habla ahora (toca de nuevo para terminar).', 'info', 3);
      const blob = await g.promesa;
      this.grabando = null;
      const wav = await webmAWav16k(blob).catch(() => null);
      if (wav) {
        const texto = await transcribirServidor(wav);
        if (texto) {
          this.ejecutarComando(texto);
          return;
        }
      }
    } catch {
      this.grabando = null;
    }
    // Sin servidor o sin clave: reconocimiento local del navegador.
    const local = reconocimientoLocal();
    if (local) {
      ui.toast('ADA', 'Te escucho… habla ahora.', 'info', 3);
      const texto = await local.reconocer();
      if (texto) {
        this.ejecutarComando(texto);
        return;
      }
    }
    // Último recurso: escribir la orden.
    this.abrirLineaVoz();
  }

  /** Línea de comando escrita (tecla T): respaldo cuando no hay micro. */
  private abrirLineaVoz() {
    if (this.state !== 'playing') return;
    abrirLineaComando((texto) => this.ejecutarComando(texto));
  }

  /** Ejecuta un comando de voz o texto sobre el dron. */
  private ejecutarComando(texto: string) {
    const t = texto.toLowerCase();
    if (/(silencio|calla|mudo)/.test(t)) {
      this.vozApagada = true;
      callar();
      ui.toast('ADA', 'Entendido: solo texto.', 'info', 3);
      return;
    }
    if (/(habla|con voz|sonido)/.test(t)) {
      this.vozApagada = false;
      this.decible('ADA', 'De vuelta en línea.');
      return;
    }
    const respuestaNpc = this.contenido.responderVoz(texto, this.player.position.x, this.player.position.z);
    if (respuestaNpc.destino && respuestaNpc.destino !== 'dron') {
      void this.responderNpc(respuestaNpc, texto);
      return;
    }
    const cmd = parsearComando(texto);
    if (cmd === 'seguir') {
      this.dron.setModo('seguir');
      this.explorando = false;
      this.decible('ADA', 'Vuelvo a tu lado.');
    } else if (cmd === 'quieto') {
      this.dron.setModo('quieto');
      this.explorando = false;
      this.decible('ADA', 'Mantengo posición.');
    } else if (cmd === 'luz') {
      const on = !this.dron.luz;
      this.dron.setLuz(on);
      this.decible('ADA', on ? 'Luz encendida: veo mejor la chatarra.' : 'Luz apagada.');
    } else if (cmd === 'explorar') {
      this.ordenarExploracion();
    } else if (cmd === 'ayuda') {
      ui.toast('ADA', AYUDA_COMANDOS, 'info', 6);
    } else {
      this.decible('ADA', `No te entendí. ${AYUDA_COMANDOS}`);
    }
  }

  /** La intención decide el efecto; Muse solo redacta la respuesta del NPC. */
  private async responderNpc(respuesta: RespuestaNpc, texto: string) {
    const npc = respuesta.npc;
    if (!npc) return;
    const intencion = respuesta.intencion ?? null;
    let respaldo = respuesta.respaldo ?? npc.lineas.noEntiendo[0];
    if (intencion) {
      const clave = npc.id + ':' + intencion.id;
      const usadas = this.usosNpc.get(clave) ?? 0;
      if (intencion.coste && this.scrap < intencion.coste) {
        respaldo = npc.lineas.sinChatarra[usadas % npc.lineas.sinChatarra.length];
      } else if (intencion.veces !== undefined && usadas >= intencion.veces) {
        respaldo = npc.lineas.yaNoQueda[usadas % npc.lineas.yaNoQueda.length];
      } else {
        if (intencion.coste) this.scrap -= intencion.coste;
        this.usosNpc.set(clave, usadas + 1);
        this.aplicarEfectos(intencion.efecto);
      }
    }
    const linea = await lineaNpcMapa(npc, intencion, texto, respaldo);
    if (this.state === 'playing') this.decible(npc.nombre, linea);
  }

  /** El dron informa por voz y texto (respeta "silencio"). */
  private decible(quien: string, texto: string) {
    ui.toast(quien, texto, 'info', 4);
    const mayus = quien.toUpperCase();
    const tipo = mayus === 'ADA' ? 'ada' : mayus === 'HELIOS' ? 'helios'
      : mayus === 'OPERADOR' || mayus === this.radio.nombreOperador(this.brief).toUpperCase() ? 'operador' : 'npc';
    ui.decir(tipo, quien, texto, 4);
    if (!this.vozApagada) hablar(texto);
  }

  /** Aplica daño al traje y resuelve los especiales que reaccionan al golpe. */
  private receiveDamage(amount: number) {
    amount *= this.factorTemporal('escudo');
    if (this.personajeActual.id === 'idris-okafor' && !this.customSprite) amount *= .85;
    if (amount <= 0) return;
    if (this.heroSpecial === 'caparazon' && this.shieldReady) {
      this.shieldReady = false;
      this.shieldCooldown = Math.max(18, 30 - (this.heroSpecialLevel - 1) * 6);
      this.camara.sacudidaDano();
      sfx('relic');
      ui.toast('ADA', 'Caparazón activo: impacto bloqueado.', 'info', 3);
      return;
    }

    this.hp -= amount;
    this.hpLost += amount;
    this.companero.alDano(this.maxHp > 0 ? this.hp / this.maxHp : 1);
    this.noDamageTime = 0;
    this.hurtFlash = 0.15;
    this.camara.sacudidaDano();
    sfx('hurt');

    if (this.heroSpecial === 'nova-plasma' && this.novaCooldown <= 0) {
      this.novaCooldown = Math.max(1.5, 3 - (this.heroSpecialLevel - 1) * 0.6);
      this.activatePlasmaNova();
    }
  }

  /** Mantiene los especiales pasivos del héroe personalizado. */
  private updateHeroSpecial(dt: number, px: number, pz: number) {
    this.novaCooldown = Math.max(0, this.novaCooldown - dt);

    if (this.heroSpecial === 'enjambre') {
      this.swarmHealTimer += dt;
      while (this.swarmHealTimer >= 5) {
        this.swarmHealTimer -= 5;
        this.hp = Math.min(this.maxHp, this.hp + Math.max(1, this.heroSpecialLevel));
      }
    }

    if (this.heroSpecial === 'caparazon' && !this.shieldReady) {
      this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
      if (this.shieldCooldown <= 0) {
        this.shieldReady = true;
        ui.toast('ADA', 'Caparazón recargado.', 'info', 2);
      }
    }

    if (this.heroSpecial === 'eco-helios') {
      this.ecoCooldown -= dt;
      if (this.ecoCooldown <= 0) {
        const radius = 12 + this.heroSpecialLevel * 2;
        const duration = 1.5 + this.heroSpecialLevel * 0.5;
        let confused = 0;
        for (let i = 0; i < this.enemies.count; i++) {
          if (this.enemies.tipoDe(i) !== 'recolector') continue;
          const dx = this.enemies.x[i] - px, dz = this.enemies.z[i] - pz;
          if (dx * dx + dz * dz > radius * radius) continue;
          this.enemies.slow[i] = Math.max(this.enemies.slow[i], duration);
          this.enemies.slowFactor[i] = 0;
          confused++;
        }
        // Si todavía no hay objetivos, vuelve a buscar pronto; con objetivos,
        // deja una ventana clara antes de emitir otro eco.
        this.ecoCooldown = confused > 0 ? 8 : 1;
      }
    }
  }

  private activatePlasmaNova() {
    const px = this.player.position.x, pz = this.player.position.z;
    const radius = 3.5 + this.heroSpecialLevel * 0.9;
    const damage = (12 + this.heroSpecialLevel * 8) * this.heroDamageMul;
    for (let i = 0; i < this.enemies.count; i++) {
      const dx = this.enemies.x[i] - px, dz = this.enemies.z[i] - pz;
      if (dx * dx + dz * dz <= radius * radius) this.enemies.hit(i, damage, px, pz, 1.1);
    }
    sfx('hit');
  }

  private activateAdaPulse() {
    const px = this.player.position.x, pz = this.player.position.z;
    const radius = 9 + this.heroSpecialLevel * 2;
    const knockback = 1.2 + this.heroSpecialLevel * 0.35;
    for (let i = 0; i < this.enemies.count; i++) {
      const dx = this.enemies.x[i] - px, dz = this.enemies.z[i] - pz;
      if (dx * dx + dz * dz <= radius * radius) this.enemies.hit(i, 0, px, pz, knockback);
    }
    this.camara.sacudidaPulso();
    sfx('relic');
  }

  /** Manda al dron a la reliquia, amenaza o zona más interesante. */
  private ordenarExploracion() {
    let objetivo: { x: number; z: number; etiqueta: string } | null = null;
    let mejor = Infinity;
    for (const r of this.relicDrops) {
      const d = Math.hypot(r.group.position.x - this.player.position.x, r.group.position.z - this.player.position.z);
      if (d < mejor) {
        mejor = d;
        objetivo = { x: r.group.position.x, z: r.group.position.z, etiqueta: 'reliquia' };
      }
    }
    if (!objetivo) {
      const i = this.enemies.nearest(this.player.position.x, this.player.position.z, 35);
      if (i >= 0) objetivo = { x: this.enemies.x[i], z: this.enemies.z[i], etiqueta: 'amenaza' };
    }
    if (!objetivo) {
      const a = this.yaw + (Math.random() - 0.5);
      objetivo = {
        x: this.player.position.x - Math.sin(a) * 20,
        z: this.player.position.z - Math.cos(a) * 20,
        etiqueta: 'zona',
      };
    }
    this.dron.escanear(objetivo.x, this.player.position.y, objetivo.z);
    this.dron.setModo('explorar', objetivo);
    this.explorando = true;
    this.decible('ADA', `Explorando: ${objetivo.etiqueta}. Te aviso lo que vea.`);
  }

  /** Al llegar el dron, informa lo que ve a su alrededor. */
  private informarEscaneo() {
    const d = this.dron.group.position;
    let reliquias = 0;
    for (const r of this.relicDrops) {
      if (Math.hypot(r.group.position.x - d.x, r.group.position.z - d.z) < 40) reliquias++;
    }
    let contactos = 0;
    let cx = 0, cz = 0;
    for (let i = 0; i < this.enemies.count; i++) {
      const dx = this.enemies.x[i] - d.x, dz = this.enemies.z[i] - d.z;
      if (dx * dx + dz * dz < 30 * 30) {
        contactos++;
        cx += dx;
        cz += dz;
      }
    }
    const rumbo = contactos > 0 ? this.rumboA(cx / contactos, cz / contactos) : '';
    const partes: string[] = [];
    if (reliquias > 0) partes.push(`${reliquias} ${reliquias === 1 ? 'reliquia' : 'reliquias'}`);
    if (contactos > 0) partes.push(`${contactos} contactos${rumbo ? ` al ${rumbo}` : ''}`);
    this.decible('ADA', partes.length ? `Escáner: ${partes.join(', ')}.` : 'Escáner: zona limpia. Ni rastro de HELIOS.');
  }

  /** Rumbo en palabras desde un vector (norte = -z, hacia el cohete). */
  private rumboA(dx: number, dz: number): string {
    const a = (Math.atan2(dx, -dz) * 180) / Math.PI;
    if (a > -22.5 && a <= 22.5) return 'norte';
    if (a > 22.5 && a <= 67.5) return 'noreste';
    if (a > 67.5 && a <= 112.5) return 'este';
    if (a > 112.5 && a <= 157.5) return 'sureste';
    if (a > 157.5 || a <= -157.5) return 'sur';
    if (a > -157.5 && a <= -112.5) return 'suroeste';
    if (a > -112.5 && a <= -67.5) return 'oeste';
    return 'noroeste';
  }

  /** Hooks del contrato del creador (`player-contract.ts`). */
  setHeroSprite(tex: THREE.Texture) {
    this.customSprite = tex;
    const mat = this.player.material as THREE.SpriteMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  setHeroTuning(t: HeroTuning) {
    this.heroMaxHp = t.maxHp;
    this.heroSpeed = t.speed;
    this.heroDamageMul = t.damageMul;
    this.heroCooldownMul = t.cooldownMul;
    this.heroSpecial = t.special;
    this.heroSpecialLevel = 1;
    this.hp = this.maxHp = t.maxHp;
  }

  setHeroName(nombre: string) {
    this.heroName = nombre;
  }

  private resetRun() {
    this.weapons?.dispose();
    this.habilidad?.dispose();
    this.weapons = new Weapons(this.scene, this.enemies, this.world, () => this.contenido.objetivoJefe, {
      dano: (x, z, cantidad, critico) => this.numeros.sumar(x, this.world.heightAt(x, z) + 1.7, z, cantidad, critico),
      sacudida: () => this.camara.sacudidaPulso(),
    });
    if (!this.customSprite) {
      const s = this.personajeActual.stats;
      this.heroMaxHp = s.maxHp;
      this.heroSpeed = s.speed;
      this.heroDamageMul = s.damageMul;
      this.heroCooldownMul = s.cooldownMul;
    }
    this.habilidad = this.customSprite ? null : crearHabilidad(this.personajeActual, this.scene);
    this.habilidadIntocableHasta = 0;
    this.habilidadHasta = 0;
    this.bendiciones = [];
    this.totales = totalesVacios();
    this.bendicionesPendientes = [];
    this.desmontadas = 0;
    this.puntosMapa = [];
    this.mejorasTomadas = 0;
    this.aguante = 1;
    this.esprintando = false;
    this.descansoAguante = 0;
    this.empujeX = this.empujeZ = 0;
    this.canonNivel = 0;
    this.canonCd = 0;
    this.apuntando = false;
    this.mezclaMira = 0;
    this.miraAlta = 0.15;
    for (const t of this.trazos) this.scene.remove(t.mesh);
    this.trazos = [];
    this.numeros.limpiar();
    this.aplicarBendiciones();
    this.enemies.clear();
    this.contenido.reset();
    this.contenido.factorCosteCofre = this.personajeActual.id === 'mara-ilyin' && !this.customSprite ? .8 : 1;
    this.contenido.factorCargaPilon = this.personajeActual.id === 'amara-keita' && !this.customSprite ? 1.3 : 1;
    this.contenido.radioVista = this.personajeActual.id === 'taro-sato' && !this.customSprite ? VISTA_MAPA * 2 : VISTA_MAPA;
    this.pickups.clear();
    this.esporas?.dispose();
    this.esporas = new NubeEsporas(this.scene, this.world);
    this.deudaEsp = { saltador: 0, avispa: 0, caparazon: 0, sembrador: 0 };
    this.criasPendientes = [];
    this.oleadaEspecialHecha.clear();
    this.elitesVivas = 0;
    for (const r of this.relicDrops) this.scene.remove(r.group);
    this.relicDrops = [];

    this.time = 0;
    this.hp = this.maxHp = this.heroMaxHp;
    this.hpLost = 0;
    this.level = 1;
    this.xp = 0;
    this.scrap = 0;
    this.kills = 0;
    this.killsByType = { recolector: 0, baliza: 0, segador: 0, saltador: 0, avispa: 0, caparazon: 0, sembrador: 0 };
    this.passives.clear();
    this.relicsFound = [];
    this.ultimaOferta = [];
    this.ultimaArma = null;
    this.rechazos = new Map();
    this.radio = new Radio();
    this.dron.setModo('seguir');
    this.dron.setLuz(false);
    this.explorando = false;
    this.brief = null;
    this.heridoAvisado = false;
    this.eliteAvisada = false;
    this.mitadAvisada = false;
    this.balizasAvisadas = false;
    this.heroSpecialLevel = this.heroSpecial ? 1 : 0;
    this.novaCooldown = 0;
    this.shieldReady = this.heroSpecial === 'caparazon';
    this.shieldCooldown = 0;
    this.swarmHealTimer = 0;
    this.ecoCooldown = 0;
    this.noDamageTime = 0;
    this.acidoAcumulado = 0;
    this.usosNpc.clear();
    this.temporales.clear();
    this.spawnDebt = 0;
    this.nextSegador = 120;
    this.nextSwarm = 60;
    this.pendingLevels = 0;
    this.player.position.set(0, this.world.heightAt(0, 0), 0);
    this.yaw = 0;
    this.pitch = 0.36;
    // Físicas y cámara: todo arranca en reposo sobre el suelo.
    this.velX = 0;
    this.velZ = 0;
    this.velY = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.squash = 0;
    this.facing = 1;
    this.rumbo = Math.PI;
    this.golpeHasta = this.golpeListo = 0;
    this.gear.clear();
    this.companero.reset();
    this.combustible = 0;
    this.propulsando = false;
    this.dashCd = this.dashTime = 0;
    this.montado = false;
    this.paradoTabla = 0;
    this.vestirEquipo();
    this.animarAstronauta('Reposo', 0);
    this.astronauta.raiz.position.copy(this.player.position);
    this.astronauta.raiz.rotation.y = this.rumbo;
    this.camara.fijar(0, this.pitch, this.player.position);
    this.lastPulsoDmg = this.weapons.damageDealt.pulso;
  }

  private startRun() {
    this.resetRun();
    this.weapons.upgrade(this.customSprite ? 'cortador' : this.personajeActual.armaInicial);
    this.state = 'playing';
    ui.showHud();
    this.vestirEquipo();
    if (this.jumpBtn) this.jumpBtn.style.display = 'block';
    if (this.abilityBtn) this.abilityBtn.style.display = this.habilidad ? 'block' : 'none';
    if (this.micBtn) this.micBtn.style.display = 'block';
    this.clock.getDelta();
    // En la demo no hay radio ni brief: que se vea la pelea.
    if (this.demo) return;
    lockPointer(this.canvas);
    ui.toast('ADA', 'HELIOS ha detectado mi señal. Aguanta 10 minutos: el cohete subirá la orden de apagado del velo.', 'info', 6);
    ui.decir('ada', 'ADA', 'HELIOS ha detectado mi señal. Aguanta diez minutos hasta la ventana de lanzamiento.', 6);
    if (this.heroSpecial) {
      const sp = SPECIALS[this.heroSpecial];
      ui.toast('ADA', `Especial listo: ${sp.name}. ${sp.blurb}`, 'info', 6);
    }
    void this.abrirBrief();
  }

  /** Pide el brief único de la partida (misión + NPCs) sin bloquear el juego. */
  private async abrirBrief() {
    const { brief } = await this.radio.brief(this.heroName, this.save.profileName);
    if (this.state !== 'playing') return;
    this.brief = brief;
    const operador = brief.npcs.find((n) => n.id === 'operador');
    ui.setMision(brief.mision, operador?.nombre ?? '');
    ui.toast('ADA', `${brief.mision}: ${brief.bioma}. ${brief.giro}`, 'info', 7);
    ui.decir('ada', 'ADA', brief.mision + ': ' + brief.bioma + '. ' + brief.giro, 7);
    const heli = brief.npcs.find((n) => n.id === 'helios');
    const op = brief.npcs.find((n) => n.id === 'operador');
    if (heli && this.state === 'playing') {
      setTimeout(() => {
        if (this.state !== 'playing') return;
        ui.toast('HELIOS', heli.linea, 'info', 5);
        ui.decir('helios', 'HELIOS', heli.linea, 5);
      }, 4500);
    }
    if (op && this.state === 'playing') {
      setTimeout(() => {
        if (this.state !== 'playing') return;
        ui.toast(op.nombre.toUpperCase(), op.linea, 'info', 5);
        ui.decir('operador', op.nombre, op.linea, 5);
      }, 9000);
    }
  }

  /** Estado de la partida en una línea: el contexto que recibe la IA. */
  private estadoPartida() {
    const restante = Math.max(0, RUN.length - this.time);
    return `quedan ${Math.floor(restante / 60)}:${String(Math.floor(restante % 60)).padStart(2, '0')} de ventana, `
      + `integridad ${Math.round((this.hp / this.maxHp) * 100)} %, nivel ${this.level}, ${this.kills} bajas, `
      + `${this.enemies.countOf('baliza')} balizas vivas, pruebas ${this.save.relics.length + this.relicsFound.length}/${RELICS.length}`;
  }

  /** Pide una línea de un NPC ante un evento (con cooldown y respaldo local). */
  private decir(hablante: Hablante, evento: EventoNpc, detalle: string) {
    void this.radio.linea(hablante, evento, `${detalle}. Estado: ${this.estadoPartida()}`).then((r) => {
      if (!r || this.state !== 'playing') return;
      const quien = hablante === 'operador' ? this.radio.nombreOperador(this.brief).toUpperCase() : r.quien;
      ui.toast(quien, r.texto, 'info', 5);
      ui.decir(hablante, quien, r.texto, 5);
    });
  }

  private get mods(): Modifiers {
    return {
      cooldown: Math.pow(0.92, this.passive('enfriamiento')) * this.heroCooldownMul / this.factorTemporal('recarga')
        * Math.max(0.4, 1 - this.totales.recarga),
      area: (1 + 0.1 * this.passive('area')) * (1 + this.totales.area),
    };
  }

  private contextoHabilidad(): ContextoHabilidad {
    return {
      escena: this.scene,
      mundo: this.world,
      enemigos: this.enemies,
      armas: this.weapons,
      objetivoJefe: () => this.contenido.objetivoJefe,
      modelo: this.astronauta.raiz,
      posicion: this.player.position,
      rumbo: this.rumbo,
      yawCamara: this.yaw,
      curar: (n) => { this.hp = Math.min(this.maxHp, this.hp + n); },
      moverA: (x, z) => {
        this.player.position.set(x, this.world.heightAt(x, z), z);
        this.velX = this.velZ = 0;
      },
      hacerIntocable: (segundos) => { this.habilidadIntocableHasta = Math.max(this.habilidadIntocableHasta, this.time + segundos); },
      aturdirJefes: (x, z, radio, segundos) => this.contenido.aturdirJefes(x, z, radio, segundos),
      alerta: (texto) => alerta(texto),
      sacudida: () => this.camara.sacudidaPulso(),
      sfx: (nombre) => sfx(nombre),
    };
  }

  private usarHabilidad() {
    if (!this.habilidad || !this.habilidad.usar(this.contextoHabilidad())) return;
    this.habilidadHasta = this.time + Math.min(1.2, this.acciones.get('Habilidad')?.getClip().duration ?? 0);
  }

  /** ¿Puede llevar esta herramienta? Las exclusivas, solo su operador. */
  private armaDisponible(id: WeaponId) {
    const dueno = WEAPONS[id].exclusiva;
    return !dueno || !this.customSprite && dueno === this.personajeActual.id;
  }

  private passive(id: PassiveId) {
    return this.passives.get(id) ?? 0;
  }

  private factorTemporal(id: string) {
    const temporal = this.temporales.get(id);
    if (!temporal || temporal.hasta <= this.time) {
      if (temporal) this.temporales.delete(id);
      return 1;
    }
    return temporal.factor;
  }

  /** Traduce los efectos puros de mapa a los sistemas reales de la partida. */
  private aplicarEfectos(efectos: Efecto[]) {
    for (const efecto of efectos) {
      if (efecto.tipo === 'chatarra') {
        this.scrap = Math.max(0, this.scrap + efecto.cantidad);
      } else if (efecto.tipo === 'integridad') {
        this.hp = Math.min(this.maxHp, this.hp + efecto.cantidad);
      } else if (efecto.tipo === 'exposicion') {
        this.contenido.cambiarExposicion(efecto.cantidad);
      } else if (efecto.tipo === 'reliquia') {
        const pendiente = RELICS.find((r) => !this.save.relics.includes(r.id) && !this.relicsFound.includes(r.id));
        if (pendiente) {
          this.relicsFound.push(pendiente.id);
          this.companero.alReliquia();
          ui.toast('Reliquia: ' + pendiente.name, pendiente.lore + ' ' + pendiente.fact, 'relic', 8);
        }
      } else if (efecto.tipo === 'mejora') {
        this.pendingLevels++;
      } else if (efecto.tipo === 'nivel') {
        // «Cualquiera» sube la herramienta que llevas con menos nivel; solo si
        // ya están todas al máximo, te da una nueva.
        const subibles = (Object.keys(WEAPONS) as WeaponId[])
          .filter((id) => this.weapons.level(id) < WEAPONS[id].levels.length);
        const nuevas = this.weapons.levels.size < MAX_HERRAMIENTAS ? subibles.filter((id) => this.weapons.level(id) === 0 && this.armaDisponible(id)) : [];
        const ids = [
          ...subibles.filter((id) => this.weapons.level(id) > 0).sort((a, b) => this.weapons.level(a) - this.weapons.level(b)),
          ...nuevas,
        ];
        const id = efecto.herramienta === 'cualquiera' ? ids[0] : efecto.herramienta;
        if (id && this.weapons.level(id) < WEAPONS[id].levels.length) {
          ui.toast('ADA', `${WEAPONS[id].name} sube a nivel ${this.weapons.level(id) + 1}.`, 'info', 3);
        }
        if (id && this.weapons.level(id) < WEAPONS[id].levels.length) this.weapons.upgrade(id);
      } else if (efecto.tipo === 'canon') {
        const primero = this.canonNivel === 0;
        this.canonNivel = Math.min(CANON.dano.length, this.canonNivel + 1);
        ui.toast('Cañón solar', primero
          ? 'Clic derecho para apuntar, clic izquierdo para disparar. Es lo único que alcanza al Dragón del Velo en el aire.'
          : `Sube a nivel ${this.canonNivel}: más daño y más cadencia.`, 'relic', primero ? 8 : 4);
        if (primero) alerta('¡Tienes el Cañón solar! Clic derecho para apuntar');
      } else if (efecto.tipo === 'bendicion') {
        this.bendicionesPendientes.push({ elegir: efecto.elegir, suerte: efecto.suerte });
      } else if (efecto.tipo === 'temporal') {
        this.temporales.set(efecto.cual, { hasta: this.time + efecto.segundos, factor: efecto.factor });
      } else if (efecto.tipo === 'marcar') {
        this.contenido.marcar(efecto.que, this.player.position.x, this.player.position.z);
      } else if (efecto.tipo === 'imanTotal') {
        this.pickups.atraer(this.player.position.x, this.player.position.z, 9999);
      } else if (efecto.tipo === 'desmontar') {
        this.abrirDesmontar();
      } else if (efecto.tipo === 'informar') {
        const texto = efecto.que === 'oleada'
          ? 'La vigía marca la dirección de la próxima oleada.'
          : 'Lis reconoce la última reliquia recuperada.';
        ui.toast('ADA', texto, 'info', 4);
      }
    }
  }

  // -------------------------------------------------------------- Bucle

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 30);

    if (this.state === 'playing') {
      if (wasPressed('Escape', 'KeyP')) {
        this.pause();
      } else {
        this.update(dt);
      }
    } else if (this.state === 'title') {
      // De fondo, la cámara gira despacio alrededor del punto de inicio.
      const t = performance.now() / 14000;
      this.camera.position.set(Math.sin(t) * 22, 7, Math.cos(t) * 22);
      this.camera.lookAt(0, 6, -40);
      this.world.follow(this.player.position);
    }

    if (this.state !== 'paused' && this.state !== 'levelup' && this.state !== 'mapa') {
      this.mezclador.update(dt);
      this.mezcladorEquipo.update(dt);
      this.mezcladorTabla.update(dt);
    }
    endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  private pause() {
    this.state = 'paused';
    this.expectUnlock = isLocked();
    unlockPointer();
    this.camara?.iniciarTransicion('pausa');
    if (this.jumpBtn) this.jumpBtn.style.display = 'none';
    if (this.micBtn) this.micBtn.style.display = 'none';
    // Al reanudar se vacían las pulsaciones: el Esc que cierra la pausa
    // no debe volver a abrirla en el fotograma siguiente.
    ui.showPause(() => {
      endFrame();
      this.state = 'playing';
      this.clock.getDelta();
      if (this.jumpBtn) this.jumpBtn.style.display = 'block';
      if (this.micBtn) this.micBtn.style.display = 'block';
      lockPointer(this.canvas);
    }, () => this.toTitle());
  }

  /**
   * Solo para pruebas: avanza la partida `seconds` en pasos fijos sin esperar
   * al navegador, que congela requestAnimationFrame en pestañas ocultas.
   * Se para en cuanto la partida sale de 'playing' (subida de nivel, final).
   */
  simulate(seconds: number) {
    for (let t = 0; t < seconds && this.state === 'playing'; t += 1 / 60) this.update(1 / 60);
    this.renderer.render(this.scene, this.camera);
    return this.state;
  }

  private update(dt: number) {
    this.time += dt;
    if (this.demo) this.avanzarDemo(dt);
    // Prueba de formas de ADA: K pasa a la siguiente (se recuerda en este navegador).
    if (wasPressed('KeyK')) this.cambiarFormaAda();
    if (wasPressed('KeyT') && !(document.activeElement instanceof HTMLInputElement)) {
      this.abrirLineaVoz();
    }
    if (wasPressed('KeyM')) {
      this.abrirMapaSector();
      return;
    }
    if (wasPressed('KeyF')) this.usarCofre();
    // El piloto de la demo mantiene la R: la habilidad ya sabe si recargó.
    if (wasPressed('KeyR') || this.touchAbility || piloto.activo && piloto.teclas.has('KeyR')) this.usarHabilidad();
    this.touchAbility = false;
    if (wasPressed('KeyV') && !this.vozConV) {
      this.vozConV = true;
      void this.hablarAlDron();
    }
    if (this.vozConV && !isHeld('KeyV')) {
      this.vozConV = false;
      this.grabando?.();
    }

    const look = consumeLook(dt);
    this.yaw -= look.x * LOOK_SPEED * (this.apuntando ? 0.7 : 1);
    // Apuntando, el ratón sube y baja la mira (hasta el cielo); si no, la cámara.
    if (this.apuntando) this.miraAlta = Math.max(-0.45, Math.min(1.3, this.miraAlta - look.y * LOOK_SPEED * 0.7));
    else this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch + look.y * LOOK_SPEED));
    this.actualizarCanon(dt);

    this.movePlayer(dt);
    // En la demo no hay horda: solo los jefes.
    if (!this.demo) this.direct(dt);
    const pj = this.player.position;
    this.companero.update(dt, {
      px: pj.x, py: pj.y, pz: pj.z,
      velocidadJugador: Math.hypot(this.velX, this.velZ),
      nivel: this.level,
      vida: this.maxHp > 0 ? this.hp / this.maxHp : 1,
      curar: (n) => { this.hp = Math.min(this.maxHp, this.hp + n); },
      sonido: (n) => sfx(n),
    });
    this.barraEquipo('companero', this.companero.habilidadLista);
    this.dron.update(dt, pj.x, pj.y, pj.z, this.yaw);
    if (this.explorando && this.dron.modo === 'seguir') {
      this.explorando = false;
      this.informarEscaneo();
    }

    const px = this.player.position.x, pz = this.player.position.z;
    this.noDamageTime += dt;
    const profundidadAcido = this.world.acidoEn(px, pz);
    if (profundidadAcido > 0) {
      // Pulsos de medio segundo: conserva los 6 DPS (12 en lo hondo) sin
      // repetir el sonido y la sacudida de daño treinta veces por segundo.
      this.acidoAcumulado += dt;
      const pulsos = Math.floor(this.acidoAcumulado / 0.5);
      if (pulsos > 0) {
        this.acidoAcumulado -= pulsos * 0.5;
        this.receiveDamage((profundidadAcido > 1 ? 12 : 6) * pulsos * 0.5);
      }
    } else {
      this.acidoAcumulado = 0;
    }
    this.updateHeroSpecial(dt, px, pz);
    this.habilidad?.update(dt, this.contextoHabilidad());
    this.actualizarCrias();
    const contact = this.enemies.update(dt, px, pz, PLAYER_RADIUS);
    this.receiveDamage(contact * this.factorContacto());
    const danoContenido = this.contenido.update({
      tiempo: this.time,
      dt,
      px,
      pz,
      bajas: this.kills,
      danoRecibido: this.hpLost,
      balizas: this.enemies.countOf('baliza'),
      vx: this.velX,
      vz: this.velZ,
      enemigosEn: (x, z, radio) => {
        let n = 0;
        this.enemies.forEachInRadius(x, z, radio, () => { n++; });
        return n;
      },
      crearBaliza: (x, z) => {
        const p = this.world.resolve(x, z, ENEMIES.baliza.radius, { x: 0, z: 0 });
        this.enemies.spawn('baliza', p.x, p.z, this.lastHpScale);
      },
      herido: this.hp < this.maxHp - 1,
      enemigoCercano: (x, z, radio) => {
        const i = this.enemies.nearest(x, z, radio);
        return i >= 0 ? { x: this.enemies.x[i], z: this.enemies.z[i] } : null;
      },
    });
    this.receiveDamage(danoContenido * (this.intocable() ? 0 : 1));
    const botanica = this.personajeActual.id === 'amara-keita' && !this.customSprite ? .5 : 0;
    this.hp = Math.min(this.maxHp, this.hp + (this.passive('reparacion') * 0.7 + this.totales.regen + botanica) * dt);
    if (!this.heridoAvisado && this.hp < this.maxHp * 0.7) {
      this.heridoAvisado = true;
      this.decir('ada', 'herido', 'el traje ha perdido un tercio de su integridad');
    }
    if (!this.mitadAvisada && this.time >= RUN.length / 2) {
      this.mitadAvisada = true;
      this.decir('operador', 'mitad', 'mitad de la ventana de lanzamiento');
    }
    if (!this.balizasAvisadas && this.enemies.countOf('baliza') >= 3) {
      this.balizasAvisadas = true;
      this.decir('helios', 'baliza', 'varias balizas triangulan la señal de ADA');
    }

    // Sembradores: abren fuego con esporas lentas y esquivables.
    for (let i = 0; i < this.enemies.count; i++) {
      // Los apagados por la Orden de apagado de Noa tampoco disparan.
      if (this.enemies.tipoDe(i) !== 'sembrador' || this.enemies.aturdido[i] > 0) continue;
      const dx = this.enemies.x[i] - px, dz = this.enemies.z[i] - pz;
      if (Math.hypot(dx, dz) < 20 && quiereDisparar(i, this.enemies, this.time, dt)) {
        this.esporas.disparar(this.enemies.x[i], this.enemies.z[i], px, pz);
        sfx('hit');
      }
    }
    const danoEsporas = this.esporas.update(dt, px, pz, PLAYER_RADIUS);
    this.receiveDamage(danoEsporas * (this.intocable() ? 0 : 1));

    this.weapons.rumbo = this.rumbo;
    this.weapons.update(dt, px, pz, this.mods);
    this.enemies.sweep();
    this.enemies.render();

    const radius = RUN.pickupRadius * (1 + 0.35 * this.passive('iman')) * (this.dron.luz ? 1.25 : 1)
      * this.factorTemporal('iman') * (1 + this.totales.iman);
    const got = this.pickups.update(dt, px, pz, radius);
    if (got > 0) {
      this.scrap += got * (1 + this.totales.chatarra);
      this.xp += got;
      sfx('pickup');
      while (this.xp >= RUN.xpFor(this.level + this.pendingLevels)) {
        this.xp -= RUN.xpFor(this.level + this.pendingLevels);
        this.pendingLevels++;
      }
    }
    this.updateRelics(dt, px, pz);

    this.world.update(dt);
    this.world.follow(this.player.position);
    this.updateCamera(dt);

    // La barra de vida va pegada bajo los pies del astronauta, en pantalla.
    const feet = this.player.position.clone().project(this.camera);
    ui.updateHud({
      time: this.time, hp: this.hp, maxHp: this.maxHp, level: this.level, xp: this.xp,
      xpNext: RUN.xpFor(this.level + this.pendingLevels), kills: this.kills, scrap: this.scrap,
      // Las forjadas van como nivel 7: el HUD les pone su marco de forja.
      weapons: [...this.weapons.levels.entries()].map(([id, n]) => [id, this.weapons.forjada(id) ? n + 1 : n] as [WeaponId, number]),
      signal: this.enemies.countOf('baliza'),
      recargas: [...this.weapons.levels.keys()].map((id) => this.weapons.recarga(id, this.mods)),
      carga: this.contenido.cargaPilon,
      bendiciones: this.resumenBendiciones(),
      potencia: this.weapons.damageMul,
      aguante: this.aguante,
      anchor: { x: (feet.x + 1) / 2 * window.innerWidth, y: (1 - feet.y) / 2 * window.innerHeight },
      locked: isLocked() || !!this.demo,
      duracion: RUN.length,
      reliquias: this.save.relics.length + this.relicsFound.length,
      exposicion: this.contenido.exposicion,
      acido: this.world.acidoEn(px, pz),
      jefes: this.contenido.jefesHud,
      jefeActivo: this.contenido.barraJefe,
      interaccion: this.contenido.interaccionCofre(px, pz, this.scrap) ?? this.contenido.interaccionDuelo(px, pz)
        ?? this.contenido.interaccionHallazgo(px, pz, this.scrap) ?? this.contenido.interaccionNpc(px, pz),
      canon: {
        nivel: this.canonNivel,
        recarga: this.canonNivel ? this.canonCd / CANON.recarga[this.canonNivel - 1] : 0,
        apuntando: this.apuntando,
        // Con el ratón capturado siempre se ve la mira; en la demo, solo al apuntar.
        mira: this.apuntando || isLocked(),
      },
      zona: this.contenido.zonaDe(px, pz),
      personaje: { nombre: this.personajeActual.nombre, rol: this.personajeActual.rol, retrato: this.personajeActual.retrato, color: this.personajeActual.color },
      habilidad: this.habilidad && this.personajeActual.habilidad
        ? { id: this.personajeActual.habilidad.id, nombre: this.personajeActual.habilidad.nombre, color: this.personajeActual.color, lista: this.habilidad.lista }
        : null,
    });
    ui.drawMinimap({
      px: this.player.position.x, pz: this.player.position.z, yaw: this.yaw,
      enemies: this.enemies, relics: this.relicDrops.map((r) => r.group.position), pad: this.world.padPosition,
      nave: this.world.nave,
      lugares: [
        ...this.world.lugares,
        ...this.contenido.marcas,
      ],
      marca: this.contenido.marca,
      puntos: this.puntosMapa,
      carta: this.world.carta(),
      alcance: this.personajeActual.id === 'taro-sato' && !this.customSprite ? 110 : undefined,
    });
    this.numeros.dibujar(dt, this.camera);

    if (this.hp <= 0) return this.endRun(false);
    if (this.time >= RUN.length) return this.endRun(true);
    // Primero las bendiciones (pilón o cofre), luego las subidas de nivel:
    // nunca dos pantallas de elegir a la vez.
    if (this.bendicionesPendientes.length) this.abrirBendicion();
    else if (this.pendingLevels > 0) this.levelUp();
  }

  // ------------------------------------------------- Hallazgos del sector

  /** Emboscada: `cuantos` enemigos en corro alrededor de (x, z), con la vida de ahora. */
  private emboscar(x: number, z: number, cuantos: number, radio: number) {
    for (let k = 0; k < cuantos; k++) {
      const a = (k / cuantos) * Math.PI * 2 + Math.random() * 0.3;
      const tipo: EnemyId = k % 4 === 3 ? 'saltador' : 'recolector';
      const p = this.world.resolve(x + Math.sin(a) * radio, z + Math.cos(a) * radio, ENEMIES[tipo].radius, { x, z });
      this.enemies.spawn(tipo, p.x, p.z, this.lastHpScale);
      this.weapons.efectos.columna(p.x, this.world.heightAt(p.x, p.z), p.z, 3, { color: '#c77dff', duracion: 0.4, desde: 0.6, hasta: 0.2 });
    }
    sfx('boom');
  }

  /** Una bengala de un superviviente: trazo naranja, destello y daño en el punto. */
  private bengala(desde: { x: number; y: number; z: number }, hacia: { x: number; z: number }, dano: number) {
    const y = this.world.heightAt(hacia.x, hacia.z) + 1;
    const fx = this.weapons.efectos;
    fx.rayo(new THREE.Vector3(desde.x, desde.y, desde.z), new THREE.Vector3(hacia.x, y, hacia.z), 0.12, { color: '#ffb347', duracion: 0.14 });
    fx.chispa(hacia.x, y, hacia.z, { color: '#ffe066', duracion: 0.25, desde: 0.3, hasta: 1.2 });
    this.weapons.danoHabilidad(hacia.x, hacia.z, 1.2, dano, 0.6);
    sfx('shot');
  }

  /** Pausa la partida y enseña tarjetas; `alElegir` recibe el índice. */
  private tarjetas(tarjetas: Parameters<typeof mostrarMejoras>[1], alElegir: (i: number) => void, titulo: string, frase: string) {
    this.state = 'levelup';
    this.expectUnlock = isLocked();
    unlockPointer();
    mostrarMejoras(this.level, tarjetas, (i) => {
      this.state = 'playing';
      this.clock.getDelta();
      lockPointer(this.canvas);
      alElegir(i);
    }, { titulo, frase });
  }

  /** Una tarjeta para no hacer nada (Iris y la fragua no obligan a elegir). */
  private tarjetaVolver(texto: string) {
    return {
      id: 'generico', tipo: 'reparar' as const, titulo: 'Mejor no', texto, color: '#8a8fa3', etiqueta: 'Sin cambios',
      rareza: { id: 'volver', nombre: 'Volver', color: '#8a8fa3' },
    };
  }

  /** El regalo del Guardián (o cualquier elección de un hallazgo). */
  private elegirHallazgo(titulo: string, frase: string, opciones: OpcionHallazgo[], listo: () => void) {
    if (this.demo) {
      this.aplicarEfectos(opciones[0].efecto);
      listo();
      return;
    }
    sfx('carga');
    this.tarjetas(opciones.map((o) => ({
      id: o.id, tipo: 'bendicion' as const, titulo: o.titulo, texto: o.texto, color: o.color, etiqueta: 'Regalo del Guardián',
      rareza: { id: 'regalo', nombre: 'Regalo', color: o.color },
    })), (i) => {
      this.aplicarEfectos(opciones[i].efecto);
      listo();
    }, titulo, frase);
  }

  /**
   * Iris desmonta una herramienta: devuelve chatarra por nivel y deja la
   * casilla libre. Dos veces por sector, y nunca la única que llevas.
   */
  private abrirDesmontar() {
    const ids = [...this.weapons.levels.keys()];
    if (this.desmontadas >= 2) {
      ui.toast('Iris', 'Me he quedado sin sitio en el banco. Hoy no desmonto nada más.', 'info', 4);
      return;
    }
    if (ids.length <= 1) {
      ui.toast('Iris', 'Si te desmonto la única que llevas, ¿con qué te defiendes? Ni hablar.', 'info', 4);
      return;
    }
    sfx('cofre');
    this.tarjetas([
      ...ids.map((id) => ({
        id, tipo: 'herramienta' as const, titulo: WEAPONS[id].name, color: WEAPONS[id].color,
        texto: `Iris la desmonta: +${DESMONTAR.chatarraPorNivel * this.weapons.level(id)} de chatarra y una casilla libre para otra.`,
        rareza: { id: 'desmontar', nombre: 'Desmontar', color: '#ff8a3d' },
      })),
      this.tarjetaVolver('Te la quedas como está. Iris vuelve a su generador.'),
    ], (i) => {
      const id = ids[i];
      if (!id) return;
      const chatarra = DESMONTAR.chatarraPorNivel * this.weapons.level(id);
      this.weapons.desmontar(id);
      this.scrap += chatarra;
      this.desmontadas++;
      this.contenido.irisDesmonta();
      sfx('cofre');
      ui.toast('Iris', `${WEAPONS[id].name} desmontada: ${chatarra} de chatarra y una casilla libre.`, 'info', 4);
    }, 'IRIS, LA MECÁNICA', '¿Qué herramienta te sobra? La desmonto y te doy lo que valgan sus piezas.');
  }

  /**
   * La Fragua del Deshielo: con dos herramientas a nivel máximo, eliges cuál
   * sale forjada y cuál se funde en ella. Devuelve si abrió la elección.
   */
  private abrirFragua(coste: number, hecho: () => void): boolean {
    const maximas = [...this.weapons.levels]
      .filter(([id, n]) => n >= WEAPONS[id].levels.length && !this.weapons.forjada(id)).map(([id]) => id);
    if (maximas.length < 2) {
      sfx('sinChatarra');
      ui.toast('ADA', 'La fragua necesita dos herramientas a nivel máximo (y que no estén ya forjadas).', 'info', 4);
      return false;
    }
    if (this.scrap < coste) {
      sfx('sinChatarra');
      ui.toast('ADA', `Hacen falta ${coste} de chatarra para avivar la fragua.`, 'info', 3);
      return false;
    }
    const tarjeta = (id: WeaponId, texto: string, paso: string) => ({
      id, tipo: 'herramienta' as const, titulo: WEAPONS[id].name, texto, color: WEAPONS[id].color,
      rareza: { id: 'forja', nombre: paso, color: '#ff8a3d' },
    });
    const forjar = (base: WeaponId, fundida: WeaponId) => {
      this.scrap -= coste;
      this.weapons.forjar(base, fundida);
      hecho();
      sfx('carga');
      alerta(`¡${WEAPONS[base].name} forjada!`);
      ui.toast('ADA', `${WEAPONS[fundida].name} se ha fundido en ${WEAPONS[base].name}: más daño, una carga más y menos recarga. Su casilla queda libre.`, 'info', 6);
    };
    sfx('cofre');
    this.tarjetas([
      ...maximas.map((id) => tarjeta(id, 'Esta se queda y sale forjada: +60 % de daño, una carga más y un 15 % menos de recarga.', 'Forjar')),
      this.tarjetaVolver('Ahora no. La fragua seguirá encendida.'),
    ], (i) => {
      const base = maximas[i];
      if (!base) return;
      const resto = maximas.filter((id) => id !== base);
      if (resto.length === 1) { forjar(base, resto[0]); return; }
      // Con más de dos a tope, se elige también cuál se funde.
      window.setTimeout(() => this.tarjetas(
        resto.map((id) => tarjeta(id, `Se funde en ${WEAPONS[base].name} y deja libre su casilla.`, 'Fundir')),
        (j) => forjar(base, resto[j]), 'FRAGUA DEL DESHIELO', '¿Cuál se funde? Desaparece y deja su casilla libre.',
      ), 250);
    }, 'FRAGUA DEL DESHIELO', 'Elige la herramienta que sale forjada; la otra se funde en ella.');
    return true;
  }

  // ------------------------------------------------- Cofres, bendiciones y mapa

  /**
   * F: abre el cofre que tengas a mano (si te llega la chatarra), empieza un
   * duelo, usa un hallazgo (jaula, Guardián, fragua) o le pide a Iris que
   * desmonte una herramienta.
   */
  private usarCofre() {
    const p = this.player.position;
    const coste = this.contenido.abrirCofre(p.x, p.z, this.scrap);
    if (coste === -1 && this.contenido.empezarDuelo(p.x, p.z)) {
      sfx('carga');
      return;
    }
    if (coste === -1 && this.contenido.usarHallazgo(p.x, p.z)) return;
    if (coste === -1 && this.contenido.irisCerca(p.x, p.z)) {
      this.abrirDesmontar();
      return;
    }
    if (coste === -2) {
      sfx('sinChatarra');
      document.querySelector('.h2-interaccion')?.animate(
        [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 240 },
      );
      ui.toast('ADA', 'No nos llega la chatarra para este cofre. Recoge más.', 'info', 3);
    } else if (coste >= 0) {
      this.scrap -= coste;
      sfx('cofre');
    }
  }

  // ------------------------------------------------------------ Modo demo

  /**
   * Empieza (o vuelve a empezar) la demo: sin título ni horda, con una build
   * de nivel medio, primero el Cancerbero y después el Dragón del Velo.
   */
  empezarDemo() {
    this.destroyTitle?.();
    this.destroyTitle = null;
    this.introVista = true;
    piloto.activo = true;
    this.demo = { fase: 'preparar', t: 0 };
    this.startRun();
    this.contenido.prepararDemo();
    this.enemies.clear();
    // Pelea en un claro: lejos de ruinas que tapen la cámara.
    const claro = this.world.lugarLibre(Math.random, [25, 80], 16) ?? { x: 0, z: 0 };
    this.player.position.set(claro.x, this.world.heightAt(claro.x, claro.z), claro.z);
    this.yaw = Math.atan2(claro.x, claro.z);
    this.camara.fijar(this.yaw, this.pitch, this.player.position);
    // La herramienta del operador va más alta que el resto: es lo que se enseña.
    const propia = this.customSprite ? 'cortador' : this.personajeActual.armaInicial;
    const build: [WeaponId, number][] = [[propia, propia === 'cortador' ? 3 : 4], ['lanza', 2], ['mortero', 2], ['arco', 2]];
    for (const [id, nivel] of build) while (this.weapons.level(id) < nivel) this.weapons.upgrade(id);
    this.canonNivel = 2;
    this.maxHp = this.hp = 400;
    this.mejorasTomadas = 4;
    this.aplicarBendiciones();
    alerta(`Modo demo: ${this.personajeActual.nombre} con el piloto automático`, 3);
  }

  /** Fases de la demo y el piloto: decide cómo moverse, esquivar y apuntar este fotograma. */
  private avanzarDemo(dt: number) {
    const d = this.demo!;
    d.t += dt;
    const p = this.player.position;
    // Que no se acabe a medias: ADA remienda el traje si baja mucho.
    if (this.hp < this.maxHp * 0.3) {
      this.hp = this.maxHp * 0.7;
      ui.toast('ADA', 'Remiendo de emergencia (solo en la demo).', 'info', 2);
    }
    const estado = this.contenido.estadoDemo;
    if (d.fase === 'preparar' && d.t > 2.5) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      this.contenido.invocarJefe('sabueso-helios', p.x + fx * 22, p.z + fz * 22, p.x, p.z);
      d.fase = 'cancerbero';
      d.t = 0;
    } else if (d.fase === 'cancerbero' && estado.golem === 'caido') {
      d.fase = 'pausa';
      d.t = 0;
      alerta('¡Cancerbero vencido! Ahora, el Dragón del Velo', 3);
    } else if (d.fase === 'pausa' && d.t > 4) {
      this.contenido.llamarDragon(p.x, p.z);
      d.fase = 'dragon';
      d.t = 0;
    } else if (d.fase === 'dragon' && d.t > 3 && estado.dragon === 'nada') {
      d.fase = 'fin';
      d.t = 0;
      alerta('¡Demo terminada! Se repite en unos segundos', 4);
    } else if (d.fase === 'fin' && d.t > 8) {
      this.empezarDemo();
      return;
    }

    const s = pilotar({
      x: p.x, y: p.y, z: p.z, t: this.time,
      objetivo: this.contenido.objetivoPiloto, zonas: zonasActivas.values(), canon: this.canonNivel > 0,
      cerca: !this.customSprite && this.personajeActual.armaInicial === 'martillo',
    });
    if (s.yaw !== null) {
      let giro = s.yaw - this.yaw;
      giro = Math.atan2(Math.sin(giro), Math.cos(giro));
      this.yaw += giro * Math.min(1, dt * (s.apuntar ? 6 : 2.5));
    }
    if (s.apuntar) this.miraAlta += (s.miraAlta - this.miraAlta) * Math.min(1, dt * 8);
    // La dirección del mundo pasa a stick, relativa a la cámara (W es y = −1).
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    piloto.x = s.mx * rx + s.mz * rz;
    piloto.y = -(s.mx * fx + s.mz * fz);
    piloto.teclas.clear();
    if (s.esprintar) piloto.teclas.add('ShiftLeft');
    if (s.apuntar) piloto.teclas.add('KeyZ');
    if (s.disparar) piloto.teclas.add('KeyX');
    if (s.habilidad) piloto.teclas.add('KeyR');
  }

  // ------------------------------------------------------- Cañón solar

  /** Apuntar, recargar, disparar y apagar los trazos de los disparos. */
  private actualizarCanon(dt: number) {
    this.apuntando = this.canonNivel > 0 && (ratonHeld(2) || isHeld('KeyZ'));
    this.mezclaMira += ((this.apuntando ? 1 : 0) - this.mezclaMira) * Math.min(1, dt * 12);
    this.canonCd = Math.max(0, this.canonCd - dt);
    if (this.canonNivel > 0 && this.canonCd <= 0 && (isLocked() && ratonHeld(0) || isHeld('KeyX'))) this.disparar();
    for (let i = this.trazos.length - 1; i >= 0; i--) {
      const t = this.trazos[i];
      t.t += dt;
      const k = t.t / 0.14;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
      t.mesh.scale.x = t.mesh.scale.y = 0.16 * (1 - k * 0.6);
      if (k >= 1) {
        this.scene.remove(t.mesh);
        (t.mesh.material as THREE.Material).dispose();
        this.trazos.splice(i, 1);
      }
    }
  }

  /**
   * Un disparo: rayo instantáneo desde la cámara por el centro de la mira.
   * Acierta a lo primero que corte: horda, jefes, campeones o el dragón (su
   * cabeza es punto débil). El trazo sale del hombro del astronauta.
   */
  private disparar() {
    const n = this.canonNivel;
    this.canonCd = CANON.recarga[n - 1];
    const o = this.camera.position;
    const d = this.camera.getWorldDirection(this.vMira);
    let alcance: number = CANON.alcance;
    const jefe = this.contenido.rayo(o, d, alcance);
    if (jefe) alcance = jefe.t;
    let enemigo = -1;
    for (let i = 0; i < this.enemies.count; i++) {
      if (this.enemies.hp[i] <= 0) continue;
      const def = this.enemies.defOf(i);
      const ex = this.enemies.x[i], ez = this.enemies.z[i];
      const ey = this.world.heightAt(ex, ez) + Math.max(0.8, def.height * 0.8);
      const t = rayoEsfera(o, d, ex, ey, ez, def.radius + 0.35);
      if (t !== null && t < alcance) { alcance = t; enemigo = i; }
    }
    const crit = Math.random() < this.weapons.critico ? this.weapons.multCritico : 1;
    const dano = CANON.dano[n - 1] * this.weapons.damageMul * crit;
    const hx = o.x + d.x * alcance, hy = o.y + d.y * alcance, hz = o.z + d.z * alcance;
    if (enemigo >= 0) {
      this.enemies.hit(enemigo, dano, o.x, o.z, 0.6);
      this.numeros.sumar(hx, hy, hz, dano, crit > 1);
      marcarAcierto(false);
    } else if (jefe) {
      const causado = jefe.golpear(dano);
      this.numeros.sumar(jefe.x, jefe.y, jefe.z, causado, crit > 1 || jefe.debil);
      marcarAcierto(jefe.debil);
    }
    // Trazo de luz desde el hombro hasta donde ha dado.
    const p = this.player.position;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const boca = this.vPos.set(p.x + rx * 0.55 + fx * 0.4, p.y + 1.7, p.z + rz * 0.55 + fz * 0.4);
    const mesh = new THREE.Mesh(this.geoTrazo, new THREE.MeshBasicMaterial({
      color: '#ffe066', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    mesh.position.copy(boca);
    mesh.lookAt(hx, hy, hz);
    mesh.scale.set(0.16, 0.16, Math.hypot(hx - boca.x, hy - boca.y, hz - boca.z));
    this.scene.add(mesh);
    this.trazos.push({ mesh, t: 0 });
    if (this.apuntando) this.miraAlta += 0.008;
    sfx('shot');
  }

  /** Cámara de apuntar: por encima del hombro derecho, mirando adonde apunta la mira. */
  private camaraDeMira() {
    if (this.mezclaMira < 0.001) return;
    const p = this.player.position;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const cp = Math.cos(this.miraAlta), sp = Math.sin(this.miraAlta);
    const pos = this.vPos.set(p.x + rx * 1.1 - fx * 3.4 * cp, p.y + 2.5 - sp * 1.4, p.z + rz * 1.1 - fz * 3.4 * cp);
    // Sin meterse dentro de ruinas ni rocas, ni bajo el suelo.
    const fuera = this.world.resolve(pos.x, pos.z, 0.6, this.tmp);
    pos.x = fuera.x;
    pos.z = fuera.z;
    pos.y = Math.max(pos.y, this.world.heightAt(pos.x, pos.z) + 0.6);
    const mira = this.vMira.set(pos.x + fx * cp, pos.y + sp, pos.z + fz * cp);
    this.mMira.lookAt(pos, mira, THREE.Object3D.DEFAULT_UP);
    this.qMira.setFromRotationMatrix(this.mMira);
    this.camera.position.lerp(pos, this.mezclaMira);
    this.camera.quaternion.slerp(this.qMira, this.mezclaMira);
  }

  /** Abre la pantalla de bendición: una al azar (cofre) o a elegir (pilón). */
  private abrirBendicion() {
    const pendiente = this.bendicionesPendientes.shift()!;
    // La suerte sube con el minuto: lo de los últimos minutos sale mejor.
    const suerte = pendiente.suerte + this.time / RUN.length * 0.6;
    const opciones = tirarBendiciones(Math.random, Math.max(1, pendiente.elegir), suerte);
    // En la demo no se para a elegir: se queda la más rara.
    if (this.demo) {
      this.sumarBendicion(opciones.reduce((a, b) => RAREZAS[b.rareza].indice > RAREZAS[a.rareza].indice ? b : a));
      return;
    }
    this.state = 'levelup';
    this.expectUnlock = isLocked();
    unlockPointer();
    sfx(pendiente.elegir > 1 ? 'carga' : 'cofre');
    const cofre = pendiente.elegir <= 1;
    mostrarMejoras(this.level, opciones.map((b) => {
      const def = BENDICIONES[b.id];
      const rareza = RAREZAS[b.rareza];
      return {
        id: def.icono, tipo: 'bendicion' as const, titulo: def.nombre, texto: describir(b), color: rareza.color,
        rareza: { id: b.rareza, nombre: rareza.nombre, color: rareza.color },
      };
    }), (i) => {
      this.sumarBendicion(opciones[i]);
      this.state = 'playing';
      this.clock.getDelta();
      lockPointer(this.canvas);
    }, {
      titulo: cofre ? '¡COFRE ABIERTO!' : '¡PILÓN CARGADO!',
      frase: cofre
        ? 'ADA ha pirateado el cofre. Esto había dentro: tócalo para quedártelo.'
        : 'El pilón ha cargado el traje. Elige una bendición para el resto del sector.',
    });
  }

  private sumarBendicion(b: Bendicion) {
    this.bendiciones.push(b);
    this.totales[b.id] += b.valor;
    if (b.id === 'vida') {
      this.maxHp += b.valor;
      this.hp = Math.min(this.maxHp, this.hp + b.valor);
    }
    this.aplicarBendiciones();
    ui.toast('ADA', `${BENDICIONES[b.id].nombre} (${RAREZAS[b.rareza].nombre.toLowerCase()}): ${describir(b)}`, 'info', 4);
  }

  /** Lo que las bendiciones cambian en las herramientas (el resto se lee al usarlo). */
  private aplicarBendiciones() {
    this.weapons.damageMul = this.heroDamageMul * (1 + this.totales.dano) * this.potencia;
    const auditora = this.personajeActual.id === 'noa-herrera' && !this.customSprite;
    this.weapons.critico = 0.05 + this.totales.critico + (auditora ? .05 : 0);
    this.weapons.multCritico = auditora ? 2.5 : 2;
  }

  /** Multiplicador de daño que dan las mejoras elegidas al subir de nivel. */
  private get potencia() {
    return 1 + ESCALADO.porMejora * this.mejorasTomadas;
  }

  /** Una ficha por tipo de bendición, con el color de la mejor rareza que tengas. */
  private resumenBendiciones() {
    const porTipo = new Map<BendicionId, Bendicion[]>();
    for (const b of this.bendiciones) porTipo.set(b.id, [...(porTipo.get(b.id) ?? []), b]);
    return [...porTipo.entries()].map(([id, lista]) => {
      const mejor = lista.reduce((a, b) => RAREZAS[b.rareza].indice > RAREZAS[a.rareza].indice ? b : a);
      const total = lista.reduce((s, b) => ({ ...s, valor: s.valor + b.valor }), { ...mejor, valor: 0 });
      return {
        id, icono: BENDICIONES[id].icono, color: RAREZAS[mejor.rareza].color, n: lista.length,
        titulo: `${BENDICIONES[id].nombre}: ${describir(total)}`,
      };
    });
  }

  /** M: el mapa del sector. La partida espera mientras está abierto. */
  private abrirMapaSector() {
    this.state = 'mapa';
    this.expectUnlock = isLocked();
    unlockPointer();
    const p = this.player.position;
    abrirMapa({
      jugador: { x: p.x, z: p.z, yaw: this.yaw },
      carta: this.world.carta(),
      arena: RUN.arena,
      lugares: this.contenido.marcas,
      nave: this.world.nave,
      cohete: this.world.padPosition,
      zona: this.contenido.zonaDe(p.x, p.z),
      puntos: this.puntosMapa,
    }, (puntos) => {
      this.puntosMapa = puntos;
      endFrame();
      this.state = 'playing';
      this.clock.getDelta();
      lockPointer(this.canvas);
    });
  }

  private movePlayer(dt: number) {
    const move = moveVector();
    const overdriveDelay = Math.max(3, 5 - (this.heroSpecialLevel - 1) * 0.75);
    const overdrive = this.heroSpecial === 'sobremarcha' && this.noDamageTime >= overdriveDelay
      ? 1.15 + (this.heroSpecialLevel - 1) * 0.05
      : 1;
    const p = this.player.position;
    const tablaNv = this.gear.get('tabla') ?? 0;
    const mochilaNv = this.gear.get('mochila') ?? 0;
    const botasNv = this.gear.get('botas') ?? 0;

    // Aerotabla: te subes sola al moverte y te bajas al quedarte quieto un
    // momento en el suelo.
    const pidiendo = Math.hypot(move.x, move.y) > 0.2;
    if (tablaNv > 0) {
      this.paradoTabla = pidiendo ? 0 : this.paradoTabla + dt;
      if (pidiendo && !this.montado && this.grounded) this.montado = true;
      else if (this.montado && this.grounded && this.paradoTabla > 0.35) this.montado = false;
    }
    let equipo = 1;
    if (this.montado) {
      equipo *= GEAR.tabla.levels[tablaNv - 1].valor;
      if (tablaNv >= 3 && this.world.onIce(p.x, p.z)) equipo *= 1.15;
    }
    if (this.propulsando && mochilaNv >= 3) equipo *= 1.25;

    const vadeo = this.world.acidoEn(p.x, p.z) > 0 ? 0.6 : 1;
    // Sprint: mantener Shift corre más mientras dure el aguante. Agotado, no
    // vuelve a correr hasta recuperar un tercio (sin parpadeos de sprint).
    const quiereCorrer = isHeld('ShiftLeft', 'ShiftRight') && pidiendo && !this.montado && !this.apuntando;
    if (quiereCorrer && this.aguante > (this.esprintando ? 0 : MOVE.aguanteMinimo)) {
      this.esprintando = true;
      this.aguante = Math.max(0, this.aguante - dt / MOVE.aguanteSegundos);
      this.descansoAguante = 0;
    } else {
      this.esprintando = false;
      this.descansoAguante += dt;
      if (this.descansoAguante > MOVE.aguantePausa) this.aguante = Math.min(1, this.aguante + dt / MOVE.aguanteRecarga);
    }
    const sprint = this.esprintando ? MOVE.sprintMul : 1;
    const explorador = this.personajeActual.id === 'taro-sato' && !this.customSprite ? 1.1 : 1;
    const maxSpeed = this.heroSpeed * MOVE.speedMul * (1 + 0.1 * this.passive('velocidad') + this.totales.velocidad) * overdrive * equipo * explorador
      * vadeo * this.factorTemporal('velocidad') * sprint * (this.apuntando ? 0.6 : 1);
    // W avanza hacia donde mira la cámara; A y D van de lado.
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const wishX = rx * move.x - fx * move.y;
    const wishZ = rz * move.x - fz * move.y;

    // Botas de impulso: acelerón en la dirección pedida (o hacia donde mira).
    this.dashCd = Math.max(0, this.dashCd - dt);
    if (botasNv > 0 && this.dashCd <= 0 && (wasPressed('ShiftLeft', 'ShiftRight') || this.touchDash)) {
      let dx = wishX, dz = wishZ;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) { dx = Math.sin(this.rumbo); dz = Math.cos(this.rumbo); } else { dx /= len; dz /= len; }
      this.dashX = dx;
      this.dashZ = dz;
      this.dashTime = MOVE.dashTime;
      this.dashCd = GEAR.botas.levels[botasNv - 1].valor;
      this.camara.sacudidaPulso();
      sfx('jump');
    }
    this.touchDash = false;

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      const v = this.dashTime > 0 ? MOVE.dashDist / MOVE.dashTime : Math.max(maxSpeed, Math.hypot(this.velX, this.velZ) * 0.5);
      this.velX = this.dashX * v;
      this.velZ = this.dashZ * v;
    } else {
      // Velocidad con inercia: converge a la deseada (rápido en suelo,
      // flotante en el aire, deslizante en la tabla).
      const rate = this.propulsando ? MOVE.jetRate
        : !this.grounded ? MOVE.airRate
        : this.montado ? MOVE.boardRate : MOVE.groundRate;
      const k = 1 - Math.exp(-dt * rate);
      this.velX += (wishX * maxSpeed - this.velX) * k;
      this.velZ += (wishZ * maxSpeed - this.velZ) * k;
    }

    // El empuje de los jefes se suma al movimiento y se apaga en medio segundo.
    const r = this.world.resolve(p.x + (this.velX + this.empujeX) * dt, p.z + (this.velZ + this.empujeZ) * dt, PLAYER_RADIUS, this.tmp);
    const freno = Math.exp(-dt * 4);
    this.empujeX *= freno;
    this.empujeZ *= freno;
    p.x = r.x;
    p.z = r.z;
    const ground = this.world.heightAt(p.x, p.z);

    // Salto con buffer y coyote: vale anticipado y justo al borde.
    if (wasPressed('Space') || this.touchJump) {
      this.jumpBuffer = MOVE.buffer;
      this.touchJump = false;
    } else {
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    }
    if (this.grounded) this.coyote = MOVE.coyote;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.velY = MOVE.jumpSpeed;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      sfx('jump');
    }
    // Mochila cohete: mantener el salto en el aire empuja hacia arriba
    // mientras quede combustible; se rellena al pisar suelo.
    this.propulsando = false;
    if (mochilaNv > 0) {
      const max = GEAR.mochila.levels[mochilaNv - 1].valor;
      const sosteniendo = isHeld('Space') || this.touchJumpHeld;
      if (!this.grounded && sosteniendo && this.combustible > 0) {
        this.propulsando = true;
        // Con la mochila encendida se deja la tabla; al aterrizar vuelve sola.
        this.montado = false;
        this.combustible -= dt;
        this.velY = Math.min(this.velY + MOVE.jetAccel * dt, MOVE.jetMaxUp);
        if (p.y - ground > MOVE.jetCeiling) this.velY = Math.min(this.velY, MOVE.gravity * dt);
      } else if (this.grounded) {
        this.combustible = Math.min(max, this.combustible + dt * (mochilaNv >= 2 ? 1.4 : 0.9));
      }
      this.barraEquipo('mochila', this.combustible / max);
    }
    if (botasNv > 0) this.barraEquipo('botas', 1 - this.dashCd / GEAR.botas.levels[botasNv - 1].valor);
    if (tablaNv > 0) this.barraEquipo('tabla', this.montado ? 1 : 0.25);

    this.velY = Math.max(-MOVE.maxFall, this.velY - MOVE.gravity * dt);
    p.y += this.velY * dt;
    if (p.y <= ground) {
      if (!this.grounded && this.velY < -8) this.squash = 0.18;
      p.y = ground;
      this.velY = 0;
      this.grounded = true;
    } else if (p.y > ground + 0.02) {
      this.grounded = false;
    }

    // Animación por catálogo: el juego elige clip (reposo/andar/daño/salto)
    // y vista (espalda/frente); el reproductor elige el frame por duración.
    const hSpeed = Math.hypot(this.velX, this.velZ);
    const material = this.player.material;
    const con3d = !this.customSprite;
    this.player.visible = !con3d;
    this.astronauta.raiz.visible = con3d;
    this.shadow.visible = !con3d;
    if (con3d) {
      // Astronauta 3D: el clip sale del estado. El golpe se ve una vez y no
      // se repite en bucle mientras algo te roza.
      if (this.hurtFlash > 0 && this.time >= this.golpeListo) {
        this.golpeHasta = this.time + 0.35;
        this.golpeListo = this.time + 1.2;
      }
      const clip = this.time < this.golpeHasta ? 'Golpe recibido'
        : this.time < this.habilidadHasta && this.acciones.has('Habilidad') ? 'Habilidad'
        : this.dashTime > 0 ? 'Impulso'
        : this.propulsando ? 'Volar'
        : this.montado ? 'Surfear'
        : !this.grounded ? 'Saltar'
        : this.esprintando && hSpeed > 8 ? 'Esprintar'
        : hSpeed > 3.6 ? 'Correr'
        : hSpeed > 0.4 ? 'Caminar' : 'Reposo';
      this.animarAstronauta(clip);
      // Andar y correr van al ritmo de la velocidad real.
      const accion = this.acciones.get(clip)!;
      if (clip === 'Caminar') accion.timeScale = Math.max(0.6, hSpeed / 2.6);
      else if (clip === 'Correr') accion.timeScale = Math.max(0.8, hSpeed / 5.5);
      else if (clip === 'Esprintar') accion.timeScale = Math.max(0.9, hSpeed / 10);
      // Apuntando, mira hacia donde apunta la cámara; si no, hacia donde va.
      if (this.apuntando || hSpeed > 0.4) {
        const hacia = this.apuntando ? Math.atan2(-Math.sin(this.yaw), -Math.cos(this.yaw)) : Math.atan2(this.velX, this.velZ);
        let giro = hacia - this.rumbo;
        giro = Math.atan2(Math.sin(giro), Math.cos(giro));
        this.rumbo += giro * Math.min(1, dt * 12);
      }
    } else if (this.customSprite && material.map !== this.customSprite) {
      // Héroe personalizado: sprite fijo del creador en vez del astronauta.
      material.map = this.customSprite;
    }
    // El sprite del creador no tiene vista frontal: solo espeja el avance.
    if (Math.abs(move.x) > 0.1) this.facing = move.x > 0 ? -1 : 1;
    // Aplastamiento al aterrizar + inclinación lateral con la velocidad.
    this.squash = Math.max(0, this.squash - dt);
    const sq = this.squash / 0.18;
    const lean = Math.max(-0.12, Math.min(0.12, -(rx * this.velX + rz * this.velZ) * 0.012));
    this.player.scale.set(
      this.facing * PLAYER_HEIGHT * 0.8 * (1 + 0.18 * sq),
      PLAYER_HEIGHT * (1 - 0.22 * sq),
      1,
    );
    material.rotation = lean;
    const cuerpo3d = this.astronauta.raiz;
    cuerpo3d.position.copy(p);
    cuerpo3d.rotation.y = this.rumbo;
    // Equipo a la vista: la tabla bajo los pies (el astronauta sube encima)
    // y las llamas crecen con el empuje.
    this.tabla.raiz.visible = this.montado && con3d;
    if (this.montado) {
      cuerpo3d.position.y += 0.4;
      this.tabla.raiz.position.copy(p);
      this.tabla.raiz.rotation.set(0, this.rumbo, 0);
      // Se inclina hacia dentro en las curvas.
      this.tabla.raiz.rotateZ(lean * 2.5);
    }
    const llamaMochila = this.propulsando ? 1 : 0.001;
    for (const c of this.chorrosMochila) c.scale.setScalar(THREE.MathUtils.lerp(c.scale.x, llamaMochila, Math.min(1, dt * 18)));
    const llamaBotas = this.dashTime > 0 ? 1.2 : 0.001;
    for (const c of this.chorrosBotas) c.scale.setScalar(THREE.MathUtils.lerp(c.scale.x, llamaBotas, Math.min(1, dt * 20)));
    cuerpo3d.scale.set(0.95 * (1 + 0.18 * sq), 0.95 * (1 - 0.22 * sq), 0.95 * (1 + 0.18 * sq));

    this.hurtFlash -= dt;
    material.color.set(this.hurtFlash > 0 ? '#ff6a5a' : '#ffffff');
    // La sombra queda en el suelo y se encoge con la altura del salto.
    const alt = Math.max(0, p.y - ground);
    const shScale = Math.max(0.4, 1 - alt * 0.12);
    this.shadow.position.set(p.x, ground + 0.06, p.z);
    this.shadow.scale.set(shScale, shScale, shScale);
  }

  private updateCamera(dt: number) {
    const p = this.player.position;
    const amenazas: { x: number; z: number; peso: number }[] = [];
    for (let i = 0; i < this.enemies.count; i++) {
      const dx = this.enemies.x[i] - p.x, dz = this.enemies.z[i] - p.z;
      if (dx * dx + dz * dz > 45 * 45) continue;
      const t = this.enemies.tipoDe(i);
      amenazas.push({ x: this.enemies.x[i], z: this.enemies.z[i], peso: t === 'segador' ? 3 : t === 'caparazon' ? 2 : 1 });
    }
    const escalaSacudida = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
    this.camara.actualizar(dt, {
      pos: p,
      velX: this.velX,
      velZ: this.velZ,
      alturaPies: p.y,
      enSuelo: this.grounded,
      yaw: this.yaw,
      pitch: this.pitch,
      amenazas,
      fovBase: this.baseFov + (this.esprintando ? 5 : 0) - 16 * this.mezclaMira,
      escalaSacudida,
    });
    this.camaraDeMira();
    // Disparo del pulso: trauma menor al del daño.
    const dmgPulso = this.weapons.damageDealt.pulso;
    if (dmgPulso > this.lastPulsoDmg) this.camara.sacudidaPulso();
    this.lastPulsoDmg = dmgPulso;
  }

  // ------------------------------------------------------- Director

  /** Decide qué aparece y cuándo. La presión crece con el tiempo y con las balizas. */
  private direct(dt: number) {
    const minutes = this.time / 60;
    const balizas = this.enemies.countOf('baliza');
    // Director elástico (FOCO 2): alivia si vas por detrás, aprieta si vas
    // por delante, siempre dentro de la banda [0,8–1,2].
    const dp = directorParams(this.time, this.level, this.dpsActual(), balizas);
    const rate = dp.ritmo * (1 + this.contenido.exposicion * 0.35);
    const hpScale = dp.escalaVida;
    this.lastHpScale = hpScale;

    this.spawnDebt += rate * dt;
    while (this.spawnDebt >= 1) {
      this.spawnDebt--;
      const type: EnemyId = this.time > 40 && balizas < 4 && Math.random() < 0.04 ? 'baliza' : 'recolector';
      this.spawnAround(type, 28 + Math.random() * 4, hpScale);
    }

    // Goteo especial con presupuesto fijo: cada tipo nuevo tiene cadencia.
    for (const id of ['saltador', 'avispa', 'caparazon', 'sembrador'] as const) {
      this.deudaEsp[id] += tasaEspecial(id, minutes) * dt;
      if (this.deudaEsp[id] >= 1) {
        this.deudaEsp[id] -= 1;
        if (this.enemies.countOf(id) < CUPO[id]) this.spawnAround(id, 28 + Math.random() * 4, hpScale);
      }
    }

    this.recycleStragglers();

    // Oleada en anillo cada minuto: cierra el paso por todos lados a la vez.
    if (this.time >= this.nextSwarm) {
      this.nextSwarm += 60;
      const n = dp.anillo;
      for (let i = 0; i < n; i++) this.spawnAround('recolector', 22, hpScale, (i / n) * Math.PI * 2);
      ui.toast('ADA', 'Muchas señales a la vez. Nos están rodeando.', 'info', 3);
    }

    // Oleadas con intención: anillos de saltadores, pinzas, escoltas.
    const minuto = Math.floor(this.time / 60);
    const especial = oleadaEspecial(minuto);
    if (especial && !this.oleadaEspecialHecha.has(minuto)) {
      this.oleadaEspecialHecha.add(minuto);
      const base = Math.random() * Math.PI * 2;
      for (const compo of especial) {
        for (const a of angulosDePatron(compo.patron, compo.n, base)) {
          this.spawnAround(compo.tipo as EnemyId, compo.patron === 'anillo' ? 22 : 24, hpScale, a);
        }
      }
      ui.toast('ADA', 'HELIOS cambia de táctica. Mira los flancos.', 'info', 4);
    }

    if (this.time >= this.nextSegador) {
      this.nextSegador += dp.cadaSegador;
      this.spawnAround('segador', 26, hpScale);
      ui.toast('ADA', 'Algo grande se acerca. Una cosechadora. Lleva algo dentro.', 'info', 4);
      this.decir('helios', 'elite', 'un segador se acerca a tu posición');
    }
  }

  /**
   * Los que se quedan muy atrás no aportan nada: solo engordan la cuenta. Se
   * recolocan en el anillo de aparición, preferiblemente por delante.
   */
  private recycleStragglers() {
    const p = this.player.position;
    const e = this.enemies;
    // Por delante de la cámara: ahí es hacia donde va el jugador.
    const heading = Math.atan2(-Math.cos(this.yaw), -Math.sin(this.yaw));
    for (let i = 0; i < e.count; i++) {
      const dx = e.x[i] - p.x, dz = e.z[i] - p.z;
      if (dx * dx + dz * dz < 45 * 45) continue;
      const angle = heading + (Math.random() - 0.5) * 1.6;
      const a = RUN.arena - 2;
      const r = this.world.resolve(
        Math.max(-a, Math.min(a, p.x + Math.cos(angle) * 28)),
        Math.max(-a, Math.min(a, p.z + Math.sin(angle) * 28)),
        e.defOf(i).radius, this.tmp);
      e.x[i] = r.x;
      e.z[i] = r.z;
    }
  }

  private spawnAround(type: EnemyId, distance: number, hpScale: number, angle = Math.random() * Math.PI * 2) {
    const p = this.player.position;
    const a = RUN.arena - 2;
    const x = Math.max(-a, Math.min(a, p.x + Math.cos(angle) * distance));
    const z = Math.max(-a, Math.min(a, p.z + Math.sin(angle) * distance));
    const r = this.world.resolve(x, z, ENEMIES[type].radius, this.tmp);
    const elite = this.tirarElite(type);
    if (this.enemies.spawn(type, r.x, r.z, hpScale, elite) && elite) this.elitesVivas++;
  }

  /** Élite aleatoria (6 %) para enemigos normales desde el min 2, tope 6 vivas. */
  private tirarElite(type: EnemyId): EliteMod | null {
    if (type === 'baliza' || type === 'segador') return null;
    if (this.time < 120 || this.elitesVivas >= 6 || Math.random() > 0.06) return null;
    const r = Math.random();
    return r < 0.5 ? 'rapido' : r < 0.75 ? 'blindado' : 'simbionte';
  }

  private onEnemyDeath(i: number) {
    const def = this.enemies.defOf(i);
    const elite = this.enemies.eliteDe(i);
    if (elite) this.elitesVivas = Math.max(0, this.elitesVivas - 1);
    const x = this.enemies.x[i], z = this.enemies.z[i];
    this.kills++;
    this.killsByType[def.id]++;
    sfx('kill');
    if (elite && !this.eliteAvisada) {
      this.eliteAvisada = true;
      this.decir('operador', 'elite', `élite derribada: ${def.name}`);
    }

    // Lo que sueltan vale más con el tiempo, al ritmo de la curva de nivel.
    // Las élites pagan extra (×3/×5/×4).
    const value = def.scrap * (1 + (this.time / 60) * 0.15) * multChatarraElite(elite);
    if (def.scrap >= 5) {
      for (let n = 0; n < 5; n++) this.pickups.drop(x, z, value / 5);
    } else {
      this.pickups.drop(x, z, value);
    }

    // La concha muestra primero las cúpulas; las crías salen a los 0,6 s.
    for (const cria of criasAlMorir(def.id)) {
      this.criasPendientes.push({ cuando: this.time + 0.6, tipo: cria.tipo as EnemyId, n: cria.n, x, z });
    }

    if (def.id === 'segador') {
      // La siguiente reliquia que falte en el Códice. El dibujo, siempre la última.
      const pending = RELICS.filter((r) =>
        !this.save.relics.includes(r.id) && !this.relicsFound.includes(r.id) &&
        !this.relicDrops.some((d) => d.relicId === r.id));
      if (pending.length) this.relicDrops.push(new RelicDrop(this.scene, pending[0].id, x, this.world.heightAt(x, z), z));
    }
  }

  private actualizarCrias() {
    for (let i = this.criasPendientes.length - 1; i >= 0; i--) {
      const pendiente = this.criasPendientes[i];
      if (this.time < pendiente.cuando) continue;
      for (let k = 0; k < pendiente.n; k++) {
        const a = Math.random() * Math.PI * 2;
        this.enemies.spawn(
          pendiente.tipo,
          pendiente.x + Math.cos(a) * 1.5,
          pendiente.z + Math.sin(a) * 1.5,
          this.lastHpScale,
        );
      }
      this.criasPendientes.splice(i, 1);
    }
  }

  private updateRelics(dt: number, px: number, pz: number) {
    for (let i = this.relicDrops.length - 1; i >= 0; i--) {
      const drop = this.relicDrops[i];
      drop.update(dt);
      if (Math.hypot(drop.group.position.x - px, drop.group.position.z - pz) > 1.2) continue;
      this.scene.remove(drop.group);
      this.relicDrops.splice(i, 1);
      this.relicsFound.push(drop.relicId);
      this.companero.alReliquia();
      const relic = RELICS.find((r) => r.id === drop.relicId)!;
      sfx('relic');
      ui.toast(`Reliquia: ${relic.name}`, `“${relic.lore}” ${relic.fact}`, 'relic', 9);
      this.decir('ada', 'reliquia', `${relic.name}: ${relic.fact}`);
    }
  }

  // ----------------------------------------------------- Nivel

  private levelUp() {
    this.pendingLevels--;
    this.level++;
    if (this.demo) return;
    this.companero.alSubirNivel();
    if (this.heroSpecial === 'pulso-ada') this.activateAdaPulse();
    this.state = 'levelup';
    this.expectUnlock = isLocked();
    unlockPointer();
    sfx('level');
    ui.showLevelUp(this.level, this.rollChoices(), (choice) => {
      this.registrarEleccion(choice);
      if (choice.kind !== 'heal') {
        this.mejorasTomadas++;
        this.aplicarBendiciones();
      }
      if (choice.kind === 'weapon') this.weapons.upgrade(choice.id);
      else if (choice.kind === 'gear') this.equipar(choice.id, choice.level);
      else if (choice.kind === 'passive') {
        this.passives.set(choice.id, choice.level);
        if (choice.id === 'blindaje') {
          this.maxHp += 20;
          this.hp = this.maxHp;
        }
      } else if (choice.kind === 'special') {
        this.heroSpecialLevel = choice.level;
        if (choice.id === 'caparazon') {
          this.shieldReady = true;
          this.shieldCooldown = 0;
        }
        ui.toast('ADA', `${SPECIALS[choice.id].name} mejorado a nivel ${choice.level}.`, 'info', 4);
      } else {
        this.hp = Math.min(this.maxHp, this.hp + 40);
      }
      this.state = 'playing';
      this.clock.getDelta();
      lockPointer(this.canvas);
    });
  }

  /** DPS que la presión actual exige: vida total en pie entre 30 s. */
  private presionEstimada(): number {
    let vida = 0;
    for (let i = 0; i < this.enemies.count; i++) vida += Math.max(0, this.enemies.hp[i]);
    return Math.max(4, vida / 30);
  }

  /** DPS real de la build actual (para el director elástico). */
  private dpsActual(): number {
    return dpsBuild(new Map(this.weapons.levels), new Map(this.passives), TABLA_ARMAS, this.enemies.count)
      * this.weapons.damageMul;
  }

  /** Memoria de tiradas: rechazos, última oferta y última arma elegida. */
  private registrarEleccion(elegida: ui.Choice) {
    const clave = elegida.kind === 'heal' ? 'heal' : `${elegida.kind}:${elegida.id}:${elegida.level}`;
    for (const k of this.ultimaOferta) {
      if (k !== clave) this.rechazos.set(k, (this.rechazos.get(k) ?? 0) + 1);
    }
    this.ultimaArma = elegida.kind === 'weapon' ? elegida.id : this.ultimaArma;
  }

  private rollChoices(): ui.Choice[] {
    const estado: EstadoBuild = {
      armas: new Map(this.weapons.levels),
      pasivas: new Map(this.passives),
      nivel: this.level,
      tiempo: this.time,
      vida: this.maxHp > 0 ? this.hp / this.maxHp : 1,
      amenaza: this.enemies.count,
      presionDps: this.presionEstimada(),
      especialHeroe: this.heroSpecial,
      nivelEspecial: this.heroSpecialLevel,
      ultimaTirada: [...this.ultimaOferta],
      ultimaArma: this.ultimaArma,
      rechazos: new Map(this.rechazos),
    };
    const exclusivas = Object.fromEntries((Object.keys(WEAPONS) as WeaponId[])
      .filter((id) => WEAPONS[id].exclusiva).map((id) => [id, WEAPONS[id].exclusiva])) as Partial<Record<WeaponId, PersonajeId>>;
    // El héroe del creador no es ningún operador: no le sale ninguna exclusiva.
    const deps: DepsTirada = {
      tabla: TABLA_ARMAS, personaje: this.customSprite ? undefined : this.personajeActual.id, exclusivas, maxHerramientas: MAX_HERRAMIENTAS,
    };
    const picks: ui.Choice[] = tirarCartas(estado, deps);
    // El equipo de movilidad entra como una carta más: seguro hasta tener la
    // primera pieza (desde el nivel 3) y luego de vez en cuando.
    const equipo = this.cartaEquipo();
    if (equipo) {
      if (!picks.length) picks.push(equipo);
      else {
        let i = picks.length - 1;
        if (picks[i].kind === 'heal' && i > 0) i--;
        picks[i] = equipo;
      }
    }
    this.ultimaOferta = picks.map((c) => (c.kind === 'heal' ? 'heal' : c.kind === 'gear' ? `gear:${c.id}:${c.level}` : claveDe(c)));
    if (!picks.length) return [{ kind: 'heal' }];
    return picks;
  }

  private cartaEquipo(): ui.Choice | null {
    if (this.level < 3) return null;
    const libres = (Object.keys(GEAR) as GearId[]).filter((id) => (this.gear.get(id) ?? 0) < GEAR[id].levels.length);
    if (!libres.length) return null;
    const garantizada = this.gear.size === 0;
    if (!garantizada && Math.random() > 0.35) return null;
    // Con poco equipo se prefieren piezas nuevas; luego, subir las que ya hay.
    const nuevas = libres.filter((id) => !this.gear.has(id));
    const lista = nuevas.length && this.gear.size < 2 ? nuevas : libres;
    const id = lista[Math.floor(Math.random() * lista.length)];
    return { kind: 'gear', id, level: (this.gear.get(id) ?? 0) + 1 };
  }

  private equipar(id: GearId, nivel: number) {
    this.gear.set(id, nivel);
    if (id === 'mochila') this.combustible = GEAR.mochila.levels[nivel - 1].valor;
    if (id === 'botas') this.dashCd = 0;
    const g = GEAR[id];
    ui.toast('ADA', nivel === 1 ? `${g.name} lista. ${g.control}.` : `${g.name} mejorada: ${g.levels[nivel - 1].mejora}`, 'info', 5);
    this.vestirEquipo();
  }

  /** Durante el acelerón de las botas a nivel 3 no te toca nada. */
  private intocable() {
    return this.time < this.habilidadIntocableHasta || this.dashTime > 0 && (this.gear.get('botas') ?? 0) >= 3;
  }

  /** Daño de contacto: volando con la mochila por encima de la horda no llega. */
  private factorContacto() {
    if (this.intocable()) return 0;
    const p = this.player.position;
    return p.y - this.world.heightAt(p.x, p.z) > 2.2 ? 0 : 1;
  }

  // --------------------------------------------------- Final

  private endRun(victory: boolean) {
    this.state = 'results';
    this.expectUnlock = isLocked();
    unlockPointer();
    ui.hideHud();
    this.camara?.iniciarTransicion('resultado');
    if (this.jumpBtn) this.jumpBtn.style.display = 'none';
    if (this.micBtn) this.micBtn.style.display = 'none';
    if (this.dashBtn) this.dashBtn.style.display = 'none';
    if (this.hudEquipo) this.hudEquipo.style.display = 'none';
    this.montado = false;
    this.tabla.raiz.visible = false;
    sfx(victory ? 'relic' : 'death');
    this.animarAstronauta(victory ? 'Victoria' : 'Derrota', 0.2);
    // Cierre de la misión con la voz que corresponda (llega tras el informe).
    if (victory) {
      void this.radio.linea('ada', 'victoria', `ventana alcanzada: el cohete sube la orden de apagado. Estado: ${this.estadoPartida()}`).then((r) => {
        if (r) ui.toast(r.quien, r.texto, 'info', 6);
      });
    } else {
      void this.radio.linea('operador', 'derrota', `señal perdida en el minuto ${Math.floor(this.time / 60) + 1}. Estado: ${this.estadoPartida()}`).then((r) => {
        if (r) ui.toast(r.quien, r.texto, 'info', 6);
      });
    }

    // Lo que quede en el suelo se recoge: la chatarra ganada no se pierde.
    this.scrap += this.pickups.update(0, this.player.position.x, this.player.position.z, 0, true);

    const score = Math.round(this.kills * 10 + this.time * 5 + this.relicsFound.length * 500 + (victory ? 5000 : 0));
    const s = this.save;
    const newRecord = score > s.bestScore;
    const newTypes = (Object.keys(this.killsByType) as EnemyId[])
      .filter((t) => this.killsByType[t] > 0 && !(s.killsByType[t] > 0));

    s.runs++;
    s.bestScore = Math.max(s.bestScore, score);
    s.bestTime = Math.max(s.bestTime, this.time);
    s.bestKills = Math.max(s.bestKills, this.kills);
    s.scrapBank += Math.round(this.scrap);
    for (const [t, n] of Object.entries(this.killsByType)) s.killsByType[t] = (s.killsByType[t] ?? 0) + n;
    s.relics.push(...this.relicsFound);
    writeSave(s);

    ui.showResults({
      victory,
      time: this.time,
      level: this.level,
      kills: this.kills,
      killsByType: { ...this.killsByType },
      newTypes,
      damage: { ...this.weapons.damageDealt },
      scrap: Math.round(this.scrap),
      score,
      relics: this.relicsFound.map((id) => RELICS.find((r) => r.id === id)!),
      newRecord,
      best: { time: s.bestTime, kills: s.bestKills, score: s.bestScore },
      bank: s.scrapBank,
      codexSize: s.relics.length,
      hpLost: this.hpLost,
      weapons: [...this.weapons.levels.entries()],
    }, () => this.startRun(), () => this.toTitle());
  }
}

/** Distancia a lo largo del rayo (o + d·t, d unitario) hasta la esfera, o null si no la toca. */
function rayoEsfera(o: THREE.Vector3, d: THREE.Vector3, x: number, y: number, z: number, r: number) {
  const ox = o.x - x, oy = o.y - y, oz = o.z - z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}
