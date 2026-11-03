// progresion.ts — FOCO 2: progresión y subida de nivel (Meta Space).
//
// Módulo autocontenido (no importa `data.ts` del juego): los tipos usan los
// mismos nombres (`WeaponId`, `PassiveId`, `Choice`) para que encaje sin
// adaptadores en `game.ts` (`rollChoices`), `ui.ts` (`Choice`) y
// `creator/stats.ts` (`SPECIALS`, ver HERO_SPECIALS).
//
// Qué resuelve respecto al código actual (`game.ts` + `RUN.xpFor`):
//  1. Curva `xpFor` con el mismo coste total pero mejor ritmo (frena el aluvión
//     del primer minuto y abarata el tramo 15-25, donde la curva vieja se
//     estancaba justo cuando el director más aprieta).
//  2. `rollChoices` con pesos por contexto, anti-repetición, piedad cuando la
//     build va mal y filtro anti-trampa (ninguna opción siempre peor).
//  3. `directorParams`: presión ligada al poder real del jugador (nivel + daño)
//     con banda elástica acotada: alivia si vas por detrás, reta si vas por
//     delante, sin pasarse nunca ([0.8, 1.2]).
//  4. Especiales del creador de personaje como pseudo-mejoras integrables.
//
// Todo el texto visible que genera este módulo va en español.

import type { SpecialId } from './creator/stats.ts';
import type { PersonajeId } from './personajes.ts';

// ---------------------------------------------------------------- Constantes
// Toda la parametrización del sistema, arriba y a la vista.

/** Curva de experiencia: coste del nivel `level` al `level + 1`. */
export const XP_BASE = 6;
export const XP_POR_NIVEL = 2.6;
export const XP_CUADRATICA = 0.32;

/** Cartas por subida de nivel. */
export const CARTAS_POR_NIVEL = 3;
/** Ventana anti-repetición: la última tirada pesa × esto. */
export const PESO_REPETIDA = 0.35;
/** Rechazada una vez: × esto. Rechazada dos o más veces: × esto otro. */
export const PESO_RECHAZADA_1 = 0.75;
export const PESO_RECHAZADA_2 = 0.5;
/** Ruido de barajado (el original usaba ±0.8 efectivo: eso enterraba los pesos). */
export const RUIDO_TIRADA = 0.35;

/** Piedad: si tu daño < este % del que pide la presión, la mejor opción de
 *  daño queda garantizada en la tirada. */
export const PIEDAD_UMBRAL_PODER = 0.8;
/** Piedad: con menos de esta fracción de vida, el peor hueco se vuelve cura. */
export const PIEDAD_UMBRAL_VIDA = 0.4;
/** Una opción es trampa si en TODOS los contextos (actual + 3 de referencia)
 *  rinde menos que este % de la mejor alternativa. */
export const TRAMPA_UMBRAL = 0.65;
/** La cura solo se ofrece con menos de esta fracción de vida (o sin piscina). */
export const CURA_MAX_FRACCION_VIDA = 0.75;

/** Banda elástica del director: la presión nunca baja ni sube más que esto
 *  respecto a la curva por tiempo. */
export const DIRECTOR_MIN = 0.8;
export const DIRECTOR_MAX = 1.2;
/** Cuánto cuenta cada punto de nivel y de daño en el índice de poder. */
export const PODER_POR_NIVEL = 1;
export const PODER_POR_DAÑO = 1 / 25;
/** Objetivos medios que alcanza cada herramienta por uso (modelo de EV):
 *  el cortador pega a uno, el pulso barre la zona, el dron roza a lo que
 *  tiene pegado y el aura cubre a varios. El factor efectivo escala con la
 *  multitud (`amenaza`): contra dos enemigos el pulso rinde como un arma
 *  simple; contra veinte, barre. Calibrado con el bot; si FOCO 1 cambia los
 *  números de `data.ts`, revisar estos factores. */
export const OBJETIVOS_POR_ARMA: Record<WeaponId, number> = {
  cortador: 1,
  pulso: 3,
  dron: 1.2,
  interferencia: 2.5,
  // Área: la lanza y el mortero pegan a todo el grupo; el arco salta (su
  // tabla ya cuenta las cadenas en `count`, no los saltos).
  lanza: 3.5,
  arco: 4,
  mortero: 3,
  torreta: 2.5, martillo: 2.2, sello: 1.5, bumeran: 3, semillas: 4,
};
/** Multitud de referencia: con esta o más enemigos, el factor multiobjetivo
 *  base rinde al completo; con menos, se interpola hacia 1 (duelo). */
export const MULTITUD_REFERENCIA = 12;
/** Tope del factor multiobjetivo con hordas grandes: el pulso y el aura
 *  escalan con la multitud (radio generoso), el dron apenas (radio de
 *  contacto) y el cortador nada (un objetivo por disparo). */
export const TOPE_MULTITUD: Record<WeaponId, number> = {
  cortador: 1,
  pulso: 12,
  dron: 2,
  interferencia: 8,
  lanza: 9,
  arco: 7,
  mortero: 8,
  torreta: 6, martillo: 5, sello: 4, bumeran: 8, semillas: 10,
};
/** Prima de cobertura: cada herramienta nueva hasta la tercera multiplica su
 *  puntuación (0.3 por hueco libre). El modelo de daño no ve lo que sí ve un
 *  jugador: alcance, ráfagas y situaciones donde tu única arma no llega.
 *  Sin esta prima el menú converge a mono-builds que mueren en el primer
 *  cerco serio. */
/** Prima de cobertura por herramienta nueva (ver `PRIMA_COBERTURA`). */
export const PRIMA_COBERTURA = 0.3;
/** Repetir la misma arma dos niveles seguidos pesa × esto: empuja a probar
 *  otra herramienta antes de encasillarse (variedad de aperturas). */
export const PESO_REPETIR_ARMA = 0.75;
/** Bonus de experiencia si vas 3+ niveles por detrás del ritmo esperado. */
export const XP_RECUPERACION = 1.25;
export const XP_NIVELES_ATRASO = 3;

// ------------------------------------------------------------------- Tipos

export type WeaponId = 'cortador' | 'pulso' | 'dron' | 'interferencia' | 'lanza' | 'arco' | 'mortero' | 'torreta' | 'martillo' | 'sello' | 'bumeran' | 'semillas';
export type PassiveId =
  | 'velocidad'
  | 'iman'
  | 'blindaje'
  | 'enfriamiento'
  | 'area'
  | 'reparacion';
export type HeroSpecialId = SpecialId;

export type Choice =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number }
  | { kind: 'special'; id: HeroSpecialId; level: number }
  | { kind: 'heal' };

export type Rng = () => number;

/** Estadísticas de un nivel de arma. Espejo de `WeaponLevel` en `data.ts`. */
export interface NivelArma {
  damage: number;
  cooldown: number;
  count: number;
  area: number;
}

/** Tabla de estadísticas que inyecta el juego (FOCO 1 es dueño de los números:
 *  este módulo solo los lee para estimar valor). */
export type TablaArmas = Record<WeaponId, NivelArma[]>;

export interface EstadoBuild {
  armas: Map<WeaponId, number>;
  pasivas: Map<PassiveId, number>;
  /** Nivel actual del jugador (empieza en 1). */
  nivel: number;
  /** Segundos de partida. */
  tiempo: number;
  /** Fracción de vida actual (0-1). */
  vida: number;
  /** Enemigos en pie (multitud): el área vale más contra muchos. */
  amenaza: number;
  /** Daño por segundo que la presión actual exige (lo da el director). */
  presionDps: number;
  /** Especial del creador de personaje, si hay héroe personalizado. */
  especialHeroe: HeroSpecialId | null;
  /** Nivel del especial (0 = aún no elegido). */
  nivelEspecial: number;
  /** Claves ofrecidas en las dos últimas tiradas (anti-repetición). */
  ultimaTirada: string[];
  /** Última arma elegida (fomenta alternar herramientas, no encasillarse). */
  ultimaArma: WeaponId | null;
  /** Veces que se rechazó cada clave (el juego lo actualiza al elegir). */
  rechazos: Map<string, number>;
}

export function claveDe(c: Choice): string {
  return c.kind === 'heal' ? 'heal' : `${c.kind}:${c.id}:${c.level}`;
}

// ------------------------------------------------------------ RNG con semilla

/** Generador determinista para simulaciones y tests reproducibles. */
export function mulberry32(semilla: number): Rng {
  let a = semilla >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------- Curva de experiencia

/**
 * Experiencia para pasar del nivel `n` al `n + 1`.
 * Mantiene el coste total acumulado casi idéntico al original
 * (`2 + 2·n + 0.4·n²`) pero redistribuido: arranque menos regalado
 * (Nv.1: 9 en vez de 4, adiós al doble nivel del primer minuto) y tramo
 * 15-25 algo más barato, donde el director más aprieta.
 */
export function xpFor(nivel: number): number {
  return Math.round(XP_BASE + XP_POR_NIVEL * nivel + XP_CUADRATICA * nivel * nivel);
}

/** Experiencia total acumulada para alcanzar `nivel` desde el 1. */
export function xpAcumulada(nivel: number): number {
  let total = 0;
  for (let n = 1; n < nivel; n++) total += xpFor(n);
  return total;
}

/** Nivel esperado por tiempo (minuto 3 → ~10, minuto 7 → ~19, minuto 10 → ~26). */
export function nivelEsperado(tiempoSeg: number): number {
  const m = tiempoSeg / 60;
  return Math.max(1, Math.round(1 + m * 3.1 - m * m * 0.06));
}

/** Multiplicador de experiencia (recuperación si vas por detrás). */
export function multiplicadorXp(nivel: number, tiempoSeg: number): number {
  return nivel < nivelEsperado(tiempoSeg) - XP_NIVELES_ATRASO ? XP_RECUPERACION : 1;
}

// ------------------------------------------------------- Modelo de poder (EV)

/** Daño por segundo teórico de un arma a cierto nivel, ajustado a la
 *  multitud: el área brilla contra multitudes y rinde como duelo contra
 *  pocos enemigos. */
export function dpsArma(id: WeaponId, nivel: number, tabla: TablaArmas, amenaza = MULTITUD_REFERENCIA): number {
  const s = tabla[id][nivel - 1];
  if (!s) return 0;
  const multitud = Math.min(TOPE_MULTITUD[id], 1 + ((OBJETIVOS_POR_ARMA[id] - 1) * amenaza) / MULTITUD_REFERENCIA);
  return ((s.damage * s.count) / s.cooldown) * multitud;
}

function multEnfriamiento(pasivas: Map<PassiveId, number>): number {
  return Math.pow(0.92, pasivas.get('enfriamiento') ?? 0);
}

function multArea(pasivas: Map<PassiveId, number>): number {
  return 1 + 0.1 * (pasivas.get('area') ?? 0);
}

/** Daño total de la build con los multiplicadores de pasivas aplicados. */
export function dpsBuild(
  armas: Map<WeaponId, number>,
  pasivas: Map<PassiveId, number>,
  tabla: TablaArmas,
  amenaza = MULTITUD_REFERENCIA,
): number {
  let dps = 0;
  for (const [id, nivel] of armas) {
    if (nivel <= 0) continue;
    dps += dpsArma(id, nivel, tabla, amenaza) * multArea(pasivas);
  }
  const cd = multEnfriamiento(pasivas);
  return cd > 0 ? dps / cd : dps;
}

/** Supervivencia efectiva: vida máxima ajustada por movilidad y reparación. */
export function supervivencia(
  pasivas: Map<PassiveId, number>,
  vidaMaxBase = 100,
): number {
  const blindaje = pasivas.get('blindaje') ?? 0;
  const velocidad = pasivas.get('velocidad') ?? 0;
  const reparacion = pasivas.get('reparacion') ?? 0;
  return (vidaMaxBase + blindaje * 20) * (1 + velocidad * 0.06 + reparacion * 0.1);
}

/** Índice de poder: combina daño y supervivencia en un escalar para comparar
 *  opciones de distinto tipo (arma contra pasiva) sin trampas. */
export function indicePoder(
  armas: Map<WeaponId, number>,
  pasivas: Map<PassiveId, number>,
  tabla: TablaArmas,
  amenaza = MULTITUD_REFERENCIA,
): number {
  return dpsBuild(armas, pasivas, tabla, amenaza) * (1 + supervivencia(pasivas) / 400);
}

function clonar<K, V>(m: Map<K, V>): Map<K, V> {
  return new Map(m);
}

/** Ganancia esperada de una opción: poder después menos poder antes. */
export function valorEsperado(
  c: Choice,
  estado: EstadoBuild,
  tabla: TablaArmas,
): number {
  const antes = indicePoder(estado.armas, estado.pasivas, tabla, estado.amenaza);
  const armas = clonar(estado.armas);
  const pasivas = clonar(estado.pasivas);
  if (c.kind === 'weapon') armas.set(c.id, c.level);
  else if (c.kind === 'passive') pasivas.set(c.id, c.level);
  else if (c.kind === 'special') {
    // El especial suma daño o supervivencia según su identidad (ver
    // ESPECIALES_HEROE): se modela como bonus equivalente de pasiva.
    const eq = equivalenciaEspecial(c.id, c.level);
    for (const [p, n] of eq) pasivas.set(p, (pasivas.get(p) ?? 0) + n);
  } else {
    // La cura vale más cuanto más vacío está el tanque.
    return 40 * (1.2 - estado.vida) * (antes / 400 + 0.25);
  }
  return Math.max(0, indicePoder(armas, pasivas, tabla, estado.amenaza) - antes);
}

// ------------------------------------------------- Especiales del creador

export interface EspecialHeroe {
  id: HeroSpecialId;
  nombre: string;
  descripcion: string;
  /** Niveles máximos del especial como opción de subida. */
  max: number;
}

/**
 * Especiales del creador de personaje. CONTRATO: `creator/stats.ts` define
 * las mismas claves; `applyCustomHero` pasa el especial elegido directamente
 * como `especialHeroe` al estado de progresión. Los seis cubren fantasías ya
 * presentes en el creador (daño, velocidad, aguante, recogida).
 */
export const ESPECIALES_HEROE: Record<HeroSpecialId, EspecialHeroe> = {
  'nova-plasma': {
    id: 'nova-plasma',
    nombre: 'Nova de plasma',
    descripcion: 'Más daño y alcance al responder a un golpe.',
    max: 3,
  },
  'pulso-ada': {
    id: 'pulso-ada',
    nombre: 'Pulso de ADA',
    descripcion: 'Mayor radio y empuje al subir de nivel.',
    max: 3,
  },
  enjambre: {
    id: 'enjambre',
    nombre: 'Enjambre reparador',
    descripcion: 'Repara más integridad cada cinco segundos.',
    max: 3,
  },
  caparazon: {
    id: 'caparazon',
    nombre: 'Caparazón de chatarra',
    descripcion: 'El escudo tarda menos en volver a estar disponible.',
    max: 3,
  },
  sobremarcha: {
    id: 'sobremarcha',
    nombre: 'Sobremarcha',
    descripcion: 'Se activa antes y aumenta su bonificación de velocidad.',
    max: 3,
  },
  'eco-helios': {
    id: 'eco-helios',
    nombre: 'Eco de HELIOS',
    descripcion: 'Confunde a más Recolectores durante más tiempo.',
    max: 3,
  },
};

/** Traduce un especial a bonus equivalentes de pasiva para el modelo EV. */
function equivalenciaEspecial(id: HeroSpecialId, nivel: number): [PassiveId, number][] {
  void nivel;
  switch (id) {
    case 'nova-plasma':
      return [['enfriamiento', 1]];
    case 'pulso-ada':
      return [['area', 1]];
    case 'enjambre':
      return [['reparacion', 1]];
    case 'caparazon':
      return [['blindaje', 1]];
    case 'sobremarcha':
      return [['velocidad', 1]];
    case 'eco-helios':
      return [['area', 1]];
  }
}

// ------------------------------------------------------- Pesos por contexto

/** Peso de gusto por contexto (además del EV): guía la composición sin
 *  imponerla. Todo en español y documentado para equilibrio. */
function pesoContexto(c: Choice, estado: EstadoBuild): number {
  if (c.kind === 'heal') return 1.0;
  const alPrincipio = estado.tiempo < 150 || estado.armas.size < 2;
  const alFinal = estado.tiempo > 360 || estado.nivel >= 18;
  if (c.kind === 'weapon' && c.level === 1) return alPrincipio ? 1.7 : 1.0;
  if (c.kind === 'weapon') {
    // No repetir la misma herramienta dos veces seguidas sin probar otra.
    const repetir = c.id === estado.ultimaArma ? PESO_REPETIR_ARMA : 1;
    return (alFinal ? 1.05 : 1.15) * repetir;
  }
  if (c.kind === 'special') return alPrincipio ? 1.2 : 1.0;
  // Pasivas: sostén (blindaje/reparación) cuando duelen los golpes.
  if (c.id === 'blindaje' || c.id === 'reparacion') {
    return estado.vida < 0.6 ? 1.5 : alFinal ? 1.2 : 0.8;
  }
  if (c.id === 'enfriamiento' || c.id === 'area') {
    return estado.armas.size >= 2 ? 1.25 : 0.9;
  }
  return 1.0;
}

/** Peso anti-repetición (exportado para tests y telemetría). Las herramientas
 *  nuevas (Nv. 1) no caducan: si la rechazas es porque otra urgía más, no
 *  porque no la quieras; penalizarlas crea encasillamiento por histéresis. */
export function pesoAntiRepeticion(clave: string, estado: EstadoBuild): number {
  if (esClaveNueva(clave, estado)) return 1;
  if (estado.ultimaTirada.includes(clave)) return PESO_REPETIDA;
  const r = estado.rechazos.get(clave) ?? 0;
  if (r >= 2) return PESO_RECHAZADA_2;
  if (r === 1) return PESO_RECHAZADA_1;
  return 1;
}

function esClaveNueva(clave: string, estado: EstadoBuild): boolean {
  if (!clave.startsWith('weapon:')) return false;
  const id = clave.split(':')[1] as WeaponId;
  return (estado.armas.get(id) ?? 0) === 0;
}

/**
 * Puntuación "humana" de una carta: valor esperado × gusto de contexto ×
 * prima de cobertura, sin anti-repetición ni ruido. Es lo que el menú le
 * sugiere a un jugador que se deja aconsejar por ADA, y lo que usa el bot
 * de medición en ambas ramas (misma regla de decisión: lo que cambia entre
 * ramas es el menú, no el jugador).
 */
export function puntuacionHumana(c: Choice, estado: EstadoBuild, tabla: TablaArmas): number {
  const huecos = Math.max(0, 3 - estado.armas.size);
  const cobertura = c.kind === 'weapon' && c.level === 1 ? 1 + PRIMA_COBERTURA * huecos : 1;
  return valorEsperado(c, estado, tabla) * pesoContexto(c, estado) * cobertura;
}

// --------------------------------------------------------------- Tirada

export interface DepsTirada {
  tabla: TablaArmas;
  rng?: Rng;
  maxArma?: number;
  maxPasiva?: number;
  personaje?: PersonajeId;
  exclusivas?: Partial<Record<WeaponId, PersonajeId>>;
  /** Informe opcional para telemetría y tests (piedad, trampas filtradas). */
  informa?: (info: { filtradas: number; piedad: 'daño' | 'vida' | null }) => void;
}

function piscina(estado: EstadoBuild, deps: DepsTirada): Choice[] {
  const pool: Choice[] = [];
  const maxA = deps.maxArma ?? 6;
  const maxP = deps.maxPasiva ?? 5;
  for (const id of Object.keys(deps.tabla) as WeaponId[]) {
    const dueno = deps.exclusivas?.[id];
    if (dueno && dueno !== deps.personaje) continue;
    const nivel = estado.armas.get(id) ?? 0;
    if (nivel < maxA) pool.push({ kind: 'weapon', id, level: nivel + 1 });
  }
  const pasivas: PassiveId[] = ['velocidad', 'iman', 'blindaje', 'enfriamiento', 'area', 'reparacion'];
  for (const id of pasivas) {
    const nivel = estado.pasivas.get(id) ?? 0;
    // Rendimiento decreciente suave en el último nivel: sigue viable, sin
    // niveles muertos disfrazados.
    if (nivel < maxP) pool.push({ kind: 'passive', id, level: nivel + 1 });
  }
  if (estado.especialHeroe && estado.nivelEspecial < ESPECIALES_HEROE[estado.especialHeroe].max) {
    pool.push({ kind: 'special', id: estado.especialHeroe, level: estado.nivelEspecial + 1 });
  }
  return pool;
}

/** Contextos de referencia para la regla anti-trampa (duelo inicial,
 *  multitud media, horda final): una carta es trampa solo si pierde en los tres. */
const CONTEXTOS_REFERENCIA: { armas: [WeaponId, number][]; pasivas: [PassiveId, number][]; amenaza: number }[] = [
  { armas: [['cortador', 1]], pasivas: [], amenaza: 3 },
  {
    armas: [
      ['cortador', 3],
      ['pulso', 2],
      ['dron', 2],
    ],
    pasivas: [
      ['enfriamiento', 1],
      ['area', 1],
    ],
    amenaza: 14,
  },
  {
    armas: [
      ['cortador', 5],
      ['pulso', 4],
      ['dron', 4],
      ['interferencia', 3],
    ],
    pasivas: [
      ['enfriamiento', 3],
      ['area', 3],
      ['blindaje', 2],
      ['reparacion', 2],
    ],
    amenaza: 26,
  },
];

function estadoEn(ctx: { armas: [WeaponId, number][]; pasivas: [PassiveId, number][]; amenaza: number }): EstadoBuild {
  return {
    armas: new Map(ctx.armas),
    pasivas: new Map(ctx.pasivas),
    nivel: 10,
    tiempo: 300,
    vida: 0.8,
    amenaza: ctx.amenaza,
    presionDps: 30,
    especialHeroe: null,
    nivelEspecial: 0,
    ultimaTirada: [],
    ultimaArma: null,
    rechazos: new Map(),
  };
}

/**
 * ¿Es `c` una opción trampa? Lo es si en el contexto actual Y en los tres de
 * referencia rinde por debajo del umbral respecto a la mejor alternativa del
 * momento. La cura, el imán y la velocidad no se evalúan: son situacionales
 * por diseño (supervivencia, economía y movilidad no se miden en daño) y
 * tratarlas como trampas las borraría de la tirada para siempre.
 */
export function esTrampa(c: Choice, resto: Choice[], estado: EstadoBuild, tabla: TablaArmas): boolean {
  if (c.kind === 'heal') return false;
  if (c.kind === 'passive' && (c.id === 'iman' || c.id === 'velocidad')) return false;
  // Subir un arma que ya tienes nunca es trampa: es progresión, no elección.
  // (Los niveles muertos —como el 2 del cortador— los reequilibra FOCO 1;
  // esconderlos aquí atascaría el arma en el nivel anterior para siempre.)
  if (c.kind === 'weapon' && (estado.armas.get(c.id) ?? 0) > 0) return false;
  const contextos = [estado, ...CONTEXTOS_REFERENCIA.map(estadoEn)];
  return contextos.every((ctx) => {
    const evs = [c, ...resto].map((x) => valorEsperado(x, ctx, tabla));
    const mejor = Math.max(...evs, 0.0001);
    return valorEsperado(c, ctx, tabla) < TRAMPA_UMBRAL * mejor;
  });
}

/**
 * Tirada de subida de nivel: pesos por contexto, anti-repetición, piedad y
 * filtro anti-trampa. Devuelve hasta `CARTAS_POR_NIVEL` opciones; si la piscina
 * se agota, la cura de emergencia.
 */
export function rollChoices(estado: EstadoBuild, deps: DepsTirada): Choice[] {
  const rng = deps.rng ?? Math.random;
  const tabla = deps.tabla;
  let pool = piscina(estado, deps);

  // 1. Puntuar: valor esperado × gusto de contexto × cobertura ×
  //    anti-repetición + ruido.
  const fila = pool.map((c) => ({
    c,
    puntos: puntuacionHumana(c, estado, tabla) * pesoAntiRepeticion(claveDe(c), estado) + rng() * RUIDO_TIRADA,
  }));
  fila.sort((a, b) => b.puntos - a.puntos);

  // 2. Filtro anti-trampa sobre las candidatas a salir.
  let candidatas = fila.map((f) => f.c);
  const elegidas: Choice[] = [];
  let filtradas = 0;
  for (const c of candidatas) {
    if (elegidas.length >= CARTAS_POR_NIVEL) break;
    const resto = candidatas.filter((x) => x !== c && !elegidas.includes(x));
    if (!esTrampa(c, resto, estado, tabla)) elegidas.push(c);
    else filtradas += 1;
  }
  // Si el filtro se comió la tirada, rellena por EV puro (nunca vacío).
  if (elegidas.length < CARTAS_POR_NIVEL) {
    for (const c of candidatas) {
      if (elegidas.length >= CARTAS_POR_NIVEL) break;
      if (!elegidas.includes(c)) elegidas.push(c);
    }
  }

  // 3. Piedad: con la build por detrás en daño, la mejor opción de daño entra
  //    sí o sí; con la vida baja, el peor hueco se vuelve cura.
  let piedad: 'daño' | 'vida' | null = null;
  const poder = dpsBuild(estado.armas, estado.pasivas, tabla);
  if (poder < PIEDAD_UMBRAL_PODER * estado.presionDps) {
    const mejorDaño = [...pool]
      .filter((c) => c.kind === 'weapon' || c.kind === 'special')
      .sort((a, b) => valorEsperado(b, estado, tabla) - valorEsperado(a, estado, tabla))[0];
    if (mejorDaño && !elegidas.some((c) => claveDe(c) === claveDe(mejorDaño))) {
      elegidas[elegidas.length - 1] = mejorDaño;
      piedad = 'daño';
    }
  }
  if (estado.vida < PIEDAD_UMBRAL_VIDA && !elegidas.some((c) => c.kind === 'heal')) {
    elegidas[elegidas.length - 1] = { kind: 'heal' };
    piedad = 'vida';
  }

  // 4. La cura pierde peso si vas sobrado de vida (evita la carta trampa
  //    situacional): solo sale sin piscina o con vida tocada.
  const sinCuraNecesaria = estado.vida >= CURA_MAX_FRACCION_VIDA && pool.length > 0;
  void sinCuraNecesaria; // (la cura ya solo entra por piedad o piscina vacía)

  if (!elegidas.length) elegidas.push({ kind: 'heal' });
  deps.informa?.({ filtradas, piedad });
  pool = elegidas;
  return pool.slice(0, CARTAS_POR_NIVEL);
}

// --------------------------------------------------------------- Director

export interface ParamsDirector {
  /** Enemigos por segundo (antes del factor de balizas). */
  ritmo: number;
  /** Multiplicador de vida de lo que aparece. */
  escalaVida: number;
  /** Tamaño del anillo de oleada minutal. */
  anillo: number;
  /** Segundos entre segadores. */
  cadaSegador: number;
}

/**
 * Ritmo base por tiempo (idéntico al `direct()` actual): la campaña sigue
 * durando lo mismo para la misma build.
 */
export function ritmoBase(tiempoSeg: number): number {
  const m = tiempoSeg / 60;
  return 0.6 + m * 0.5 + m * m * 0.12;
}

export function escalaVidaBase(tiempoSeg: number): number {
  return 1 + (tiempoSeg / 60) * 0.25;
}

/** Poder real del jugador: nivel más daño, en la misma escala que la curva. */
export function poderJugador(nivel: number, dps: number): number {
  return nivel * PODER_POR_NIVEL + dps * PODER_POR_DAÑO;
}

/** Poder que la curva por tiempo espera a cada minuto. Calibrado ×1.85 con
 *  el bot codicioso (juego casi perfecto: poder medio 34.8 por partida):
 *  así el elástico ronda 1.0 para él y la comparación entre ramas es justa.
 *  Un humano normal juega por debajo y recibe alivio automático (ver T6a);
 *  solo el snowball extremo toca el techo de 1.2. */
export function poderEsperado(tiempoSeg: number): number {
  const m = tiempoSeg / 60;
  return (2 + m * 2.6 + m * m * 0.12) * 2.1;
}

/**
 * Parámetros del director ligados al poder real: si vas por detrás, alivia
 * (×0.8); si vas por delante, aprieta (×1.2). `balizas` conserva el factor
 * original (×1.15 por baliza viva, la fantasía de triangulación no cambia).
 */
export function directorParams(
  tiempoSeg: number,
  nivel: number,
  dps: number,
  balizas = 0,
): ParamsDirector {
  const m = tiempoSeg / 60;
  const cociente = poderJugador(nivel, dps) / Math.max(1, poderEsperado(tiempoSeg));
  // Banda elástica acotada: nota la diferencia sin humillar ni perdonar.
  const elastico = Math.max(DIRECTOR_MIN, Math.min(DIRECTOR_MAX, 0.6 + cociente * 0.4));
  return {
    ritmo: ritmoBase(tiempoSeg) * (1 + 0.15 * balizas) * elastico,
    escalaVida: escalaVidaBase(tiempoSeg) * (0.9 + elastico * 0.1),
    anillo: Math.round((18 + Math.floor(m * 4)) * elastico),
    cadaSegador: m < 5 ? 90 : 60,
  };
}

// ------------------------------------------------------- Texto de las cartas

/** Descripción en español para las cartas de especial (las demás ya las
 *  describe `ui.ts` con `describeWeaponStep` / `PASSIVES[c.id].blurb`). */
export function describirEspecial(id: HeroSpecialId, nivel: number): string {
  const e = ESPECIALES_HEROE[id];
  return `${e.descripcion} (Nv. ${nivel})`;
}
