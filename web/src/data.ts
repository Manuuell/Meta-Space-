// Todo el diseño del juego vive aquí: armas, mejoras, enemigos y reliquias.
// Equilibrar es tocar números en este archivo, no lógica.

export type WeaponId = 'cortador' | 'pulso' | 'dron' | 'interferencia';
export type EnemyId = 'recolector' | 'baliza' | 'segador';
export type PassiveId = 'velocidad' | 'iman' | 'blindaje' | 'enfriamiento' | 'area' | 'reparacion';

export interface WeaponLevel {
  damage: number;
  cooldown: number;   // segundos entre usos
  count: number;      // proyectiles, drones o pulsos simultáneos
  area: number;       // radio o alcance en metros
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  color: string;
  blurb: string;
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
    levels: [
      { damage: 12, cooldown: 0.6, count: 1, area: 16 },
      { damage: 11, cooldown: 0.65, count: 1, area: 17 },
      { damage: 12, cooldown: 0.6, count: 2, area: 18 },
      { damage: 15, cooldown: 0.55, count: 2, area: 19 },
      { damage: 17, cooldown: 0.5, count: 3, area: 20 },
      { damage: 22, cooldown: 0.42, count: 3, area: 22 },
    ],
  },
  pulso: {
    id: 'pulso',
    name: 'Pulso EMP de ADA',
    color: '#5ee0ff',
    blurb: 'ADA descarga el condensador del traje. Daña todo lo que hay alrededor.',
    levels: [
      { damage: 14, cooldown: 3.2, count: 1, area: 4.5 },
      { damage: 18, cooldown: 3.0, count: 1, area: 5.2 },
      { damage: 22, cooldown: 2.7, count: 1, area: 6.0 },
      { damage: 28, cooldown: 2.5, count: 1, area: 6.8 },
      { damage: 34, cooldown: 2.2, count: 1, area: 7.6 },
      { damage: 44, cooldown: 1.9, count: 1, area: 8.5 },
    ],
  },
  dron: {
    id: 'dron',
    name: 'Dron de mantenimiento',
    color: '#c9f27a',
    blurb: 'Un inspector de turbina reprogramado. Orbita a tu alrededor y golpea.',
    levels: [
      { damage: 8, cooldown: 0.45, count: 1, area: 2.6 },
      { damage: 10, cooldown: 0.42, count: 2, area: 2.8 },
      { damage: 12, cooldown: 0.4, count: 2, area: 3.0 },
      { damage: 14, cooldown: 0.38, count: 3, area: 3.2 },
      { damage: 16, cooldown: 0.35, count: 3, area: 3.4 },
      { damage: 20, cooldown: 0.32, count: 4, area: 3.6 },
    ],
  },
  interferencia: {
    id: 'interferencia',
    name: 'Campo de interferencia',
    color: '#d07bff',
    blurb: 'Ruido de radio a máxima potencia. Frena y desgasta a lo que entra.',
    levels: [
      { damage: 3, cooldown: 0.5, count: 1, area: 2.4 },
      { damage: 4, cooldown: 0.5, count: 1, area: 2.8 },
      { damage: 5, cooldown: 0.45, count: 1, area: 3.2 },
      { damage: 6, cooldown: 0.45, count: 1, area: 3.6 },
      { damage: 8, cooldown: 0.4, count: 1, area: 4.0 },
      { damage: 10, cooldown: 0.35, count: 1, area: 4.6 },
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
  iman: { id: 'iman', name: 'Electroimán', blurb: '+30 % radio para recoger chatarra.', max: 5 },
  blindaje: { id: 'blindaje', name: 'Placas de blindaje', blurb: '+20 de integridad máxima y la restaura.', max: 5 },
  enfriamiento: { id: 'enfriamiento', name: 'Disipador térmico', blurb: '−8 % tiempo de recarga de todo.', max: 5 },
  area: { id: 'area', name: 'Amplificador de ADA', blurb: '+10 % alcance y radio de todo.', max: 5 },
  reparacion: { id: 'reparacion', name: 'Nanosellador', blurb: 'Repara 0,4 de integridad por segundo.', max: 5 },
};

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
};

export interface RelicDef {
  id: string;
  name: string;
  lore: string;
  unlocks: string | null;
  fact: string;       // dato real: la parte que se aprende
}

// Las reliquias del documento de diseño, cada una con un dato real de la
// exploración espacial detrás de la pieza que desbloquea.
export const RELICS: RelicDef[] = [
  {
    id: 'panel', name: 'Panel solar de una granja',
    lore: 'Alimentó una ciudad. Funcionó once años.',
    unlocks: 'Array fotovoltaico',
    fact: 'Juno fue la primera nave en llegar a Júpiter alimentada solo por paneles solares (2016), a cinco veces la distancia de la Tierra al Sol.',
  },
  {
    id: 'rtg', name: 'Cápsula RTG de una sonda',
    lore: 'Siguieron mirando afuera hasta el final.',
    unlocks: 'Generador de radioisótopos',
    fact: 'Las Voyager 1 y 2 funcionan desde 1977 con generadores de plutonio-238: el calor de su desintegración se convierte en electricidad.',
  },
  {
    id: 'antena', name: 'Antena de red profunda',
    lore: 'Llamaron a alguien. Nadie respondió.',
    unlocks: 'Antena de alta ganancia',
    fact: 'La Red de Espacio Profundo de la NASA tiene antenas de 70 m en Goldstone, Madrid y Canberra: separadas 120°, siempre hay una mirando a cada nave.',
  },
  {
    id: 'nodo', name: 'Nodo de HELIOS inactivo',
    lore: 'El acta de aprobación. Votación: 340 a favor.',
    unlocks: 'Módulo de interferencia',
    fact: 'La erupción del Pinatubo (1991) lanzó unos 15 millones de toneladas de SO₂ a la estratosfera y enfrió el planeta cerca de medio grado durante un año.',
  },
  {
    id: 'caja', name: 'Caja negra de un lanzador',
    lore: '400 personas. Fallo de redundancia en la etapa dos.',
    unlocks: 'Unidad de control redundante',
    fact: 'En el Apolo 13, el motor central de la segunda etapa del Saturno V se apagó antes de tiempo; los otros cuatro ardieron más y la misión llegó a órbita.',
  },
  {
    id: 'invernadero', name: 'Placa de invernadero orbital',
    lore: 'Lo intentaron de verdad.',
    unlocks: 'Módulo de soporte vital',
    fact: 'En 2015 la tripulación de la Estación Espacial comió por primera vez lechuga cultivada en órbita, con el experimento Veggie.',
  },
  {
    id: 'dibujo', name: 'Dibujo infantil plastificado',
    lore: 'Una casa, un sol amarillo, cuatro figuras.',
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
  // Experiencia para pasar del nivel n al n+1.
  xpFor: (level: number) => Math.round(2 + level * 2 + level * level * 0.4),
};
