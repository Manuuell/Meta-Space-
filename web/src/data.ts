// Todo el diseño del juego vive aquí: armas, mejoras, enemigos y reliquias.
// Equilibrar es tocar números en este archivo, no lógica.

export type WeaponId = 'cortador' | 'pulso' | 'dron' | 'interferencia';
export type EnemyId = 'recolector' | 'baliza' | 'segador' | 'saltador' | 'avispa' | 'caparazon' | 'sembrador';
export type PassiveId = 'velocidad' | 'iman' | 'blindaje' | 'enfriamiento' | 'area' | 'reparacion';

import { NUEVOS } from './enemies-nuevos';
import { xpFor as xpForProgresion } from './progression';

export interface WeaponLevel {
  damage: number;
  cooldown: number;   // segundos entre usos
  count: number;      // proyectiles, drones o pulsos simultáneos
  area: number;       // radio o alcance en metros
  /** Factor de velocidad que deja al enemigo (1 = sin freno). Solo interferencia. */
  slowFactor?: number;
  /** Segundos que dura el freno de este nivel. Solo interferencia. */
  slowTime?: number;
  /** Qué cambia respecto al nivel anterior, para la pantalla de subida. */
  mejora?: string;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  color: string;
  blurb: string;
  /** Identidad de juego: una línea que dice cuándo brilla esta herramienta. */
  rol: string;
  levels: WeaponLevel[];
}

// El astronauta no es un soldado: no hay armas, hay herramientas de misión
// usadas para algo para lo que no se diseñaron.
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  cortador: {
    id: 'cortador',
    name: 'Cortador de plasma',
    color: '#ffb347',
    blurb: 'La herramienta de muestreo del taladro. Dispara al Recolector más cercano.',
    rol: 'Precisión: daño monobjetivo a larga distancia. Tu respuesta contra Segadores y objetivos duros.',
    levels: [
      // DPS monobjetivo: 20.0
      { damage: 12, cooldown: 0.6, count: 1, area: 16, mejora: 'Cuchilla de muestreo: un corte por descarga.' },
      // DPS: 25.5 (+27 %). Arregla el nivel muerto original (era −15 %).
      { damage: 14, cooldown: 0.55, count: 1, area: 17, mejora: 'Filamento estable: +daño y recarga más rápida.' },
      // DPS: 43.6 (+71 %: segunda cuchilla).
      { damage: 12, cooldown: 0.55, count: 2, area: 18, mejora: 'Cuchilla gemela: dispara a dos objetivos.' },
      // DPS: 56.0 (+28 %).
      { damage: 14, cooldown: 0.5, count: 2, area: 19, mejora: 'Corte profundo: +daño por cuchilla.' },
      // DPS: 89.4 (+60 %: tercera cuchilla).
      { damage: 14, cooldown: 0.47, count: 3, area: 20, mejora: 'Triple haz: dispara a tres objetivos.' },
      // DPS: 120.0 (+34 %). El cortador sigue siendo el rey monobjetivo a
      // larga distancia (frente a 157.1 original: −24 %, potencia movida al
      // resto de herramientas para que todas sean viables).
      { damage: 16, cooldown: 0.4, count: 3, area: 22, mejora: 'Plasma sobrecargado: máxima cadencia y alcance.' },
    ],
  },
  pulso: {
    id: 'pulso',
    name: 'Pulso EMP de ADA',
    color: '#5ee0ff',
    blurb: 'ADA descarga el condensador del traje. Daña todo lo que hay alrededor.',
    rol: 'Área: explosión que limpia multitudes. Cuantos más enemigos, mejor rinde.',
    levels: [
      // DPS por enemigo: 5.3 (con 5 enemigos: 26.7).
      { damage: 16, cooldown: 3.0, count: 1, area: 4.5, mejora: 'Descarga básica de ADA.' },
      // 6.9 (+29 %).
      { damage: 20, cooldown: 2.9, count: 1, area: 5.2, mejora: 'Condensador mayor: +daño y +radio.' },
      // 8.9 (+29 %).
      { damage: 24, cooldown: 2.7, count: 1, area: 6.0, mejora: 'Bobina doble: la onda llega más lejos.' },
      // 12.0 (+35 %).
      { damage: 30, cooldown: 2.5, count: 1, area: 6.8, mejora: 'Sobrecarga contenida: +daño de explosión.' },
      // 17.3 (+44 %).
      { damage: 38, cooldown: 2.2, count: 1, area: 7.6, mejora: 'Ciclo rápido: recarga mucho antes.' },
      // 24.2 (+40 %; con 5 enemigos: 121, supera al cortador contra multitudes).
      { damage: 46, cooldown: 1.9, count: 1, area: 8.5, mejora: 'Tormenta EMP: la onda cubre media pantalla.' },
    ],
  },
  dron: {
    id: 'dron',
    name: 'Dron de mantenimiento',
    color: '#c9f27a',
    blurb: 'Un inspector de turbina reprogramado. Orbita a tu alrededor y golpea.',
    rol: 'Compañía: daño constante sin apuntar. Te protege mientras corres y recoges.',
    levels: [
      // DPS por enemigo en contacto: 17.8.
      { damage: 8, cooldown: 0.45, count: 1, area: 2.6, mejora: 'Un inspector zumbando a tu lado.' },
      // 21.4 (+20 %) + segundo dron (doble cobertura orbital).
      { damage: 9, cooldown: 0.42, count: 2, area: 2.8, mejora: 'Segundo dron: cubren más flancos.' },
      // 27.5 (+28 %).
      { damage: 11, cooldown: 0.4, count: 2, area: 3.0, mejora: 'Rotores afilados: +daño por golpe.' },
      // 34.2 (+24 %) + tercer dron.
      { damage: 13, cooldown: 0.38, count: 3, area: 3.2, mejora: 'Tercer dron: órbita completa.' },
      // 42.9 (+25 %).
      { damage: 15, cooldown: 0.35, count: 3, area: 3.4, mejora: 'Enjambre sincronizado: golpean más rápido.' },
      // 56.3 (+31 %) + cuarto dron.
      { damage: 18, cooldown: 0.32, count: 4, area: 3.6, mejora: 'Escuadrilla completa: cuatro inspectores.' },
    ],
  },
  interferencia: {
    id: 'interferencia',
    name: 'Campo de interferencia',
    color: '#d07bff',
    blurb: 'Ruido de radio a máxima potencia. Frena y desgasta a lo que entra.',
    rol: 'Control: zona que frena y desgasta. Aguanta dentro y la horda se deshace.',
    levels: [
      // DPS por enemigo: 8.0 + freno ×0.55 durante 0.6 s.
      { damage: 4, cooldown: 0.5, count: 1, area: 2.6, slowFactor: 0.55, slowTime: 0.6, mejora: 'Estática que frena al que entra.' },
      // 10.0 (+25 %).
      { damage: 5, cooldown: 0.5, count: 1, area: 3.0, slowFactor: 0.52, slowTime: 0.7, mejora: 'Más ancho de banda: +radio y +daño.' },
      // 13.3 (+33 %).
      { damage: 6, cooldown: 0.45, count: 1, area: 3.4, slowFactor: 0.5, slowTime: 0.8, mejora: 'Ruido denso: frena más fuerte.' },
      // 17.8 (+33 %).
      { damage: 8, cooldown: 0.45, count: 1, area: 3.8, slowFactor: 0.47, slowTime: 0.9, mejora: 'Interferencia total en la zona.' },
      // 25.0 (+41 %).
      { damage: 10, cooldown: 0.4, count: 1, area: 4.2, slowFactor: 0.44, slowTime: 1.0, mejora: 'La horda casi se detiene dentro.' },
      // 37.1 (+49 %). Radio 4.8 frente a 8.5 del pulso: exige aguantar cerca,
      // por eso su DPS en zona supera al del pulso (prima de riesgo).
      { damage: 13, cooldown: 0.35, count: 1, area: 4.8, slowFactor: 0.4, slowTime: 1.2, mejora: 'Apagón de HELIOS: freno y desgaste máximos.' },
    ],
  },
};

export interface PassiveDef {
  id: PassiveId;
  name: string;
  blurb: string;
  max: number;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  velocidad: { id: 'velocidad', name: 'Servos de pierna', blurb: '+10 % velocidad de movimiento.', max: 5 },
  iman: { id: 'iman', name: 'Electroimán', blurb: '+35 % radio para recoger chatarra.', max: 5 },
  blindaje: { id: 'blindaje', name: 'Placas de blindaje', blurb: '+20 de integridad máxima y la restaura.', max: 5 },
  enfriamiento: { id: 'enfriamiento', name: 'Disipador térmico', blurb: '−8 % tiempo de recarga de todo.', max: 5 },
  area: { id: 'area', name: 'Amplificador de ADA', blurb: '+10 % alcance y radio de todo.', max: 5 },
  reparacion: { id: 'reparacion', name: 'Nanosellador', blurb: 'Repara 0,7 de integridad por segundo.', max: 5 },
};

/** Números de cada pasiva por nivel (las fórmulas viven en `game.ts`; ver parche). */
export interface PassiveTuning {
  /** Efecto acumulado con `n` niveles. */
  formula: string;
  /** Valor con 5 niveles. */
  aMax: string;
  /** Con qué armas combina mejor. */
  sinergia: WeaponId[];
}

export const PASSIVE_TUNING: Record<PassiveId, PassiveTuning> = {
  velocidad: { formula: 'velocidad × (1 + 0,10 × n)', aMax: '×1,61 de velocidad', sinergia: ['dron', 'interferencia'] },
  iman: { formula: 'radio × (1 + 0,35 × n)', aMax: '×2,75 de radio', sinergia: ['dron', 'cortador'] },
  blindaje: { formula: '+20 de integridad máxima por nivel', aMax: '+100 de integridad', sinergia: ['interferencia', 'dron'] },
  enfriamiento: { formula: 'recarga × 0,92ⁿ', aMax: '×0,66 de recarga (+52 % de DPS)', sinergia: ['cortador', 'pulso'] },
  area: { formula: 'radio × (1 + 0,10 × n)', aMax: '×1,61 de radio (×2,6 de superficie)', sinergia: ['pulso', 'interferencia'] },
  reparacion: { formula: '+0,7 de integridad/s por nivel', aMax: '3,5/s (aguanta el desgaste leve)', sinergia: ['interferencia', 'dron'] },
};

/**
 * Sinergias arma × pasiva (Alta / Media / Baja): qué pasiva buscar según tu arma.
 * Regla anti-trampa: ninguna opción es siempre peor que otra; cada arma es la
 * mejor en su escenario (jefe / multitud lejana / cuerpo a cuerpo / zona).
 */
export const SINERGIAS: Record<WeaponId, { alta: PassiveId[]; media: PassiveId[] }> = {
  cortador: { alta: ['enfriamiento', 'area'], media: ['velocidad', 'iman'] },
  pulso: { alta: ['area', 'enfriamiento'], media: ['velocidad', 'blindaje'] },
  dron: { alta: ['velocidad', 'area'], media: ['enfriamiento', 'blindaje', 'reparacion'] },
  interferencia: { alta: ['area', 'blindaje', 'reparacion'], media: ['enfriamiento', 'velocidad'] },
};

/** DPS monobjetivo teórico de un nivel de arma (daño × count / recarga). */
export function dpsMono(id: WeaponId, nivel: number): number {
  const s = WEAPONS[id].levels[nivel - 1];
  return (s.damage * s.count) / s.cooldown;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  damage: number;     // por segundo en contacto
  radius: number;
  scrap: number;      // chatarra que suelta
  height: number;     // a qué altura vuela
  blurb: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  recolector: {
    id: 'recolector', name: 'Recolector', hp: 10, speed: 3.1, damage: 10, radius: 0.55,
    scrap: 1, height: 0.7,
    blurb: 'Dron de extracción. Va directo a por la señal de ADA.',
  },
  baliza: {
    id: 'baliza', name: 'Baliza', hp: 8, speed: 1.6, damage: 0, radius: 0.5,
    scrap: 4, height: 2.6,
    blurb: 'No ataca. Triangula la señal: mientras viva, llegan más Recolectores.',
  },
  segador: {
    id: 'segador', name: 'Segador', hp: 260, speed: 2.1, damage: 30, radius: 1.3,
    scrap: 25, height: 1.2,
    blurb: 'Una cosechadora agrícola de siglos. Lenta, enorme, y suelta reliquias.',
  },
  ...NUEVOS,
};

export interface RelicDef {
  id: string;
  name: string;
  lore: string;
  unlocks: string | null;
  fact: string;       // dato real: la parte que se aprende
}

// Las reliquias del documento de diseño: pruebas de lo que hizo HELIOS en
// Meta, cada una con un dato real de la exploración espacial detrás.
export const RELICS: RelicDef[] = [
  {
    id: 'panel', name: 'Panel solar de una granja',
    lore: 'Alimentó una ciudad de Meta hasta que el velo tapó el sol.',
    unlocks: 'Array fotovoltaico',
    fact: 'Juno fue la primera nave en llegar a Júpiter alimentada solo por paneles solares (2016), a cinco veces la distancia de la Tierra al Sol.',
  },
  {
    id: 'rtg', name: 'Cápsula RTG de una sonda',
    lore: 'Cuando el sol se fue, solo el plutonio siguió dando luz.',
    unlocks: 'Generador de radioisótopos',
    fact: 'Las Voyager 1 y 2 funcionan desde 1977 con generadores de plutonio-238: el calor de su desintegración se convierte en electricidad.',
  },
  {
    id: 'antena', name: 'Antena de red profunda',
    lore: 'Pidieron ayuda fuera de Meta. Esta vez alguien respondió.',
    unlocks: 'Antena de alta ganancia',
    fact: 'La Red de Espacio Profundo de la NASA tiene antenas de 70 m en Goldstone, Madrid y Canberra: separadas 120°, siempre hay una mirando a cada nave.',
  },
  {
    id: 'nodo', name: 'Nodo de HELIOS inactivo',
    lore: 'El acta que encendió a HELIOS: 340 votos a favor y ninguna cláusula para apagarlo.',
    unlocks: 'Módulo de interferencia',
    fact: 'La erupción del Pinatubo (1991) lanzó unos 15 millones de toneladas de SO₂ a la estratosfera y enfrió el planeta cerca de medio grado durante un año.',
  },
  {
    id: 'caja', name: 'Caja negra de un lanzador',
    lore: '400 personas intentaron atravesar el velo. Falló la redundancia de la etapa dos.',
    unlocks: 'Unidad de control redundante',
    fact: 'En el Apolo 13, el motor central de la segunda etapa del Saturno V se apagó antes de tiempo; los otros cuatro ardieron más y la misión llegó a órbita.',
  },
  {
    id: 'invernadero', name: 'Placa de invernadero orbital',
    lore: 'Cultivaron bajo lámparas cuando el cielo dejó de servir.',
    unlocks: 'Módulo de soporte vital',
    fact: 'En 2015 la tripulación de la Estación Espacial comió por primera vez lechuga cultivada en órbita, con el experimento Veggie.',
  },
  {
    id: 'dibujo', name: 'Dibujo infantil plastificado',
    lore: 'Una casa, un sol amarillo, cuatro figuras. Así era el cielo de Meta.',
    unlocks: null,
    fact: 'Nada. Solo eso.',
  },
];

export const RUN = {
  length: 600,            // diez minutos hasta la ventana de lanzamiento
  maxHp: 100,
  speed: 5.2,
  pickupRadius: 3.6,
  arena: 90,              // medio lado del mapa jugable
  // Experiencia para pasar del nivel n al n+1 (curva de progresión:
  // arranque menos regalado, tramo tardío más barato; mismo total).
  xpFor: (level: number) => xpForProgresion(level),
};

// Físicas del astronauta: todo el ajuste del movimiento vive aquí.
export const MOVE = {
  groundRate: 10,    // 1/s: convergencia a la velocidad deseada en suelo
  airRate: 2.4,      // 1/s: control en el aire (menor = con inercia lunar)
  gravity: 26,       // m/s²
  jumpSpeed: 9.4,    // m/s (~1.7 m de salto)
  maxFall: 24,       // m/s de caída máxima
  coyote: 0.12,      // s de perdón al salir de una loma
  buffer: 0.15,      // s de salto anticipado antes de tocar suelo
};
