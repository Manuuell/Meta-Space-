// Contenido del mapa de Meta Space: altares de jefe, altares de desafío,
// cajas de premio, estructuras y la gente de los refugios con la que se habla
// por voz. Datos puros y funciones pequeñas, sin THREE ni nada del juego: lo
// pueden cargar el juego y el servidor de voz tal cual (como guion.ts).
//
// Los modelos y sus clips están en src/modelos/ (ver ESPEC.md); aquí se dice
// qué hace cada cosa en la partida. El diseño completo, en MAPA.md.
//
// Regla de la voz: lo que dice el jugador es un dato. El efecto de una
// conversación lo decide `detectarIntencion` con palabras clave; el modelo de
// lenguaje (Muse) solo redacta la respuesta en la voz del personaje y nunca
// inventa efectos. Sin red o sin cupo, se usan las frases de respaldo.

export type Herramienta = 'cortador' | 'pulso' | 'dron' | 'interferencia';

/** Lo que una acción da (o cuesta) en la partida. */
export type Efecto =
  | { tipo: 'chatarra'; cantidad: number }
  | { tipo: 'integridad'; cantidad: number }
  /** Negativo baja la exposición (la señal de ADA que atrae a HELIOS). */
  | { tipo: 'exposicion'; cantidad: number }
  /** La siguiente reliquia que le falte al jugador. */
  | { tipo: 'reliquia' }
  /** Abre la pantalla de mejora con estas opciones. */
  | { tipo: 'mejora'; opciones: number }
  /** Sube un nivel a una herramienta (la de menos nivel si es «cualquiera»). */
  | { tipo: 'nivel'; herramienta: Herramienta | 'cualquiera' }
  | { tipo: 'temporal'; cual: 'iman' | 'velocidad' | 'escudo' | 'recarga'; segundos: number; factor: number }
  /** Marca en el minimapa lo más cercano de ese tipo. */
  | { tipo: 'marcar'; que: 'altar' | 'caja' | 'torre' | 'ara' | 'refugio' | 'pilon' }
  /**
   * Bendición (ver bendiciones.ts): con `elegir` 1 sale una al azar; con más,
   * se elige entre esas. `suerte` sube la probabilidad de rarezas altas.
   */
  | { tipo: 'bendicion'; elegir: number; suerte: number }
  /** Da el Cañón solar (el arma que se apunta) o le sube un nivel. */
  | { tipo: 'canon' }
  /** El NPC cuenta algo de la partida (la oleada que viene, la última reliquia). */
  | { tipo: 'informar'; que: 'oleada' | 'reliquia' }
  /** Toda la chatarra suelta del sector sale volando hacia el jugador (el imán de grúa). */
  | { tipo: 'imanTotal' }
  /** Iris desmonta una herramienta a elegir: devuelve chatarra y libera su casilla. */
  | { tipo: 'desmontar' };

// ------------------------------------------------------------ altares de jefe

export interface AltarJefe {
  id: 'altar-cosecha' | 'altar-sabueso' | 'altar-heraldo' | 'altar-ojo';
  nombre: string;
  /** Id del modelo del gólem que sale de él. */
  jefe: JefeAltarId;
  /** Minuto en que despierta solo. */
  minuto: number;
  descripcion: string;
  recompensa: Efecto[];
  /** Si el jugador lo despierta antes de su minuto (diciendo «invoca» a su lado). */
  extraPorAdelantar: Efecto[];
}

/**
 * Clips de los altares de jefe (los tres iguales): `Reposo` hasta que
 * despierta, `Invocar` (el jefe aparece en 2,6 s), `Combate` mientras vive,
 * `Recompensa` al vencerlo (la recompensa se puede recoger en 2,4 s),
 * `Purificado` hasta que se recoge y `Agotado` después.
 */
export const CLIPS_ALTAR_JEFE = {
  dormido: 'Reposo', invocar: 'Invocar', combate: 'Combate', vencido: 'Recompensa', esperando: 'Purificado', agotado: 'Agotado',
  apareceJefe: 2.6, recompensaLista: 2.4,
} as const;

export const ALTARES_JEFE: AltarJefe[] = [
  {
    id: 'altar-cosecha', nombre: 'Altar de la Escoria', jefe: 'golem-escoria', minuto: 3,
    descripcion: 'De aquí sale el Gólem de Escoria, hecho con los escombros de la ciudad. Al vencerlo, el altar se purifica y entrega una reliquia.',
    recompensa: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 25 }, { tipo: 'mejora', opciones: 3 }],
    extraPorAdelantar: [{ tipo: 'nivel', herramienta: 'cualquiera' }],
  },
  {
    id: 'altar-sabueso', nombre: 'Altar de la Fragua', jefe: 'sabueso-helios', minuto: 5,
    descripcion: 'De aquí sale el Cancerbero de HELIOS, el sabueso de tres cabezas que guarda la fragua. Al vencerlo entrega una reliquia y una bendición a elegir.',
    recompensa: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 35 }, { tipo: 'bendicion', elegir: 3, suerte: 0.5 }],
    extraPorAdelantar: [],
  },
  {
    id: 'altar-heraldo', nombre: 'Altar de la Escarcha', jefe: 'golem-escarcha', minuto: 7,
    descripcion: 'De aquí sale el Coloso de Escarcha. Al vencerlo, el velo se abre sobre el altar: el jugador se cura entero y la exposición se vacía.',
    recompensa: [{ tipo: 'reliquia' }, { tipo: 'integridad', cantidad: 999 }, { tipo: 'exposicion', cantidad: -100 }],
    extraPorAdelantar: [{ tipo: 'chatarra', cantidad: 40 }],
  },
  {
    id: 'altar-ojo', nombre: 'Altar del Titán', jefe: 'golem-titan', minuto: 9,
    descripcion: 'De aquí sale el Titán de HELIOS, el jefe final. Al vencerlo, ADA firma la auditoría de este sector.',
    recompensa: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 60 }, { tipo: 'mejora', opciones: 4 }],
    extraPorAdelantar: [],
  },
];

// ------------------------------------------------------------------ gólems

/** Los jefes de altar; los campeones de duelo son otros dos. */
export type JefeAltarId = 'golem-escoria' | 'golem-escarcha' | 'golem-titan' | 'sabueso-helios';
export type GolemId = JefeAltarId | 'golem-menor' | 'sabueso-cachorro';
export type AtaqueGolem = 'pisoton' | 'roca' | 'embestida' | 'salto' | 'lluvia' | 'aliento';

export interface DefGolem {
  id: GolemId;
  /** Modelo: una de las tres variantes del gólem o el sabueso de tres cabezas. */
  variante: 'escoria' | 'escarcha' | 'titan' | 'sabueso';
  nombre: string;
  vida: number;
  /** Radio del cuerpo (m): para golpearlo y para que empuje al jugador. */
  radio: number;
  /** Escala del modelo (golem.ts la lee de aquí): agranda también sus avisos. */
  talla: number;
  velocidad: number;
  ataques: AtaqueGolem[];
  /** Lo que añade al entrar en furia (por debajo de la mitad de vida). */
  furia: AtaqueGolem[];
  /** Segundos entre ataques (×0,7 en furia). */
  descanso: number;
  /**
   * Velocidad de los ataques: multiplica la de sus clips y la de sus avisos
   * (1,3 = un 30 % más deprisa). En furia, ×1,15 más.
   */
  ritmo: number;
  /** Proyectiles por lanzamiento: normal y en furia. */
  rocas: number;
  rocasFuria: number;
  /** Color de su luz: la que proyecta al suelo, sus ascuas y su charco. */
  luz: string;
}

/**
 * Los jefes grandes. Cada ataque avisa antes en el suelo (círculo o franja
 * roja) y con un letrero en el HUD; quien se queda dentro recibe el golpe y
 * sale despedido. Dentro del aviso del pisotón y del salto hay un retraso
 * traicionero: a veces el golem aguanta arriba un instante más.
 */
export const GOLEMS: Record<JefeAltarId, DefGolem> = {
  'golem-escoria': {
    id: 'golem-escoria', variante: 'escoria', nombre: 'Gólem de Escoria', vida: 4400, radio: 3.8, talla: 1.35, velocidad: 4.4,
    ataques: ['pisoton', 'roca', 'embestida'], furia: ['salto'], descanso: 1.0, ritmo: 1.3, rocas: 1, rocasFuria: 3, luz: '#ff7a2a',
  },
  'sabueso-helios': {
    id: 'sabueso-helios', variante: 'sabueso', nombre: 'Cancerbero de HELIOS', vida: 6200, radio: 3.6, talla: 1.45, velocidad: 6.8,
    ataques: ['aliento', 'roca', 'salto', 'embestida'], furia: ['lluvia', 'pisoton'], descanso: 0.8, ritmo: 1.35, rocas: 3, rocasFuria: 5, luz: '#ff6a2a',
  },
  'golem-escarcha': {
    id: 'golem-escarcha', variante: 'escarcha', nombre: 'Coloso de Escarcha', vida: 8000, radio: 4.3, talla: 1.55, velocidad: 4.6,
    ataques: ['salto', 'lluvia', 'roca', 'pisoton'], furia: ['embestida'], descanso: 0.95, ritmo: 1.3, rocas: 2, rocasFuria: 4, luz: '#5ee0ff',
  },
  'golem-titan': {
    id: 'golem-titan', variante: 'titan', nombre: 'Titán de HELIOS', vida: 14000, radio: 5.2, talla: 1.9, velocidad: 5,
    ataques: ['roca', 'embestida', 'salto', 'pisoton', 'lluvia'], furia: [], descanso: 0.7, ritmo: 1.4, rocas: 2, rocasFuria: 4, luz: '#ff3b30',
  },
};

/**
 * Campeones de los altares de duelo: los mismos jefes en pequeño, con menos
 * vida, menos ataques y más descanso entre uno y otro. Pegan como los
 * grandes: también avisan y también empujan.
 */
export const CAMPEONES: Record<'golem-menor' | 'sabueso-cachorro', DefGolem> = {
  'golem-menor': {
    id: 'golem-menor', variante: 'escoria', nombre: 'Gólem menor', vida: 1400, radio: 2.2, talla: 0.8, velocidad: 4.2,
    ataques: ['pisoton', 'roca'], furia: ['embestida'], descanso: 1.5, ritmo: 1.2, rocas: 1, rocasFuria: 2, luz: '#ff7a2a',
  },
  'sabueso-cachorro': {
    id: 'sabueso-cachorro', variante: 'sabueso', nombre: 'Cachorro de Cancerbero', vida: 1600, radio: 2.2, talla: 0.85, velocidad: 6.2,
    ataques: ['aliento', 'salto'], furia: ['roca'], descanso: 1.3, ritmo: 1.25, rocas: 3, rocasFuria: 3, luz: '#ff6a2a',
  },
};

// ------------------------------------------------------------ altares de duelo

/**
 * Altar de duelo: con F junto a él salen campeones de HELIOS y hay que
 * vencerlos antes de que acabe el tiempo. Si no, el altar se calma y se
 * puede volver a intentar. Cada duelo ganado da su premio por orden: el
 * primero, el Cañón solar; el segundo, otro nivel del cañón y despierta al
 * Dragón del Velo; el tercero, otro nivel y una bendición a elegir.
 */
export const DUELOS = {
  radio: 16,
  segundos: 90,
  /** Quién sale en cada altar (por orden de colocación). */
  retadores: [
    ['golem-menor'],
    ['sabueso-cachorro', 'golem-menor'],
    ['golem-menor', 'sabueso-cachorro', 'golem-menor'],
  ] as const,
  premios: [
    [{ tipo: 'canon' }, { tipo: 'chatarra', cantidad: 20 }],
    [{ tipo: 'canon' }, { tipo: 'bendicion', elegir: 1, suerte: 0.5 }],
    [{ tipo: 'canon' }, { tipo: 'bendicion', elegir: 3, suerte: 0.8 }],
  ] as Efecto[][],
  /** Al ganar este duelo (por cuenta) se despierta el dragón. */
  dragonAlGanar: 2,
} as const;

/** Cañón solar: daño por disparo y recarga (s) por nivel. Lo multiplica la potencia. */
export const CANON = {
  dano: [40, 55, 72, 95],
  recarga: [0.34, 0.29, 0.25, 0.21],
  alcance: 90,
} as const;

// -------------------------------------------------------- jefe volador

/**
 * Dragón del Velo: el avión de HELIOS que siembra el velo, con forma de
 * dragón. Vuela en círculos sobre el jugador y solo el Cañón solar le llega;
 * cada vez que pierde un cuarto de vida (o tras unos ataques) se posa unos
 * segundos y entonces le pegan todas las herramientas.
 */
export const DRAGON = {
  nombre: 'Dragón del Velo',
  vida: 8500,
  altura: 15,
  /** Radio de la órbita alrededor del jugador y velocidad en el aire. */
  orbita: 24,
  velocidad: 22,
  /** Segundos entre ataques en el aire (×0,7 en furia). */
  descanso: 1.9,
  /** Ataques en el aire antes de posarse, aunque no le hayan dado. */
  ataquesAntesDePosarse: 5,
  posado: 5.5,
  bombas: { dano: 22, radio: 2.8, cuantas: 8, furia: 12, caida: 0.95 },
  aliento: { dano: 10, largo: 15 },
  /** El picado: velocidad (m/s) y el aviso en lo alto antes de bajar (s). */
  picado: { dano: 34, empuje: 18, velocidad: 36, aviso: 0.85 },
  aterrizaje: { dano: 26, radio: 6, empuje: 16 },
  recompensa: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 80 }, { tipo: 'bendicion', elegir: 4, suerte: 1 }] as Efecto[],
} as const;

/** Daño, radio del golpe (m, ×talla) y empuje (m/s) de cada ataque. */
export const ATAQUES_GOLEM: Record<AtaqueGolem, { dano: number; radio: number; empuje: number; aviso: string }> = {
  pisoton: { dano: 30, radio: 6.5, empuje: 16, aviso: '¡Pisotón! Sal del círculo rojo' },
  roca: { dano: 32, radio: 3.2, empuje: 12, aviso: '¡Va a lanzar una roca! Muévete' },
  embestida: { dano: 42, radio: 1.4, empuje: 20, aviso: '¡Embestida! Apártate de la franja' },
  salto: { dano: 36, radio: 6, empuje: 18, aviso: '¡Salta hacia ti! Corre' },
  lluvia: { dano: 20, radio: 2.3, empuje: 7, aviso: '¡Lluvia de escombros! Esquiva los círculos' },
  // Aliento: radio es el largo del cono (×talla); el daño es por cada tic de 0,3 s dentro.
  aliento: { dano: 11, radio: 11, empuje: 3, aviso: '¡Aliento de plasma! Sal del cono' },
};

// -------------------------------------------------------------- minijefes

/**
 * Los jefes de antes ahora son minijefes: salen solos cada cierto tiempo
 * cerca del jugador (sin altar), con menos vida que un gólem y más cuanto
 * más avanza la partida. Al caer sueltan chatarra y a veces una bendición.
 */
export const MINIJEFES = {
  /** Segundo del primero, separación entre uno y otro (baja con el tiempo) y mínimo. */
  primero: 100,
  cada: 70,
  bajaPorMinuto: 4,
  cadaMinimo: 40,
  maximoVivos: 3,
  /** Vida base de cada uno; se multiplica por 1 + 0,12 por minuto. */
  tipos: [
    { id: 'segador-jefe', nombre: 'Segador, Jefe de Cosecha', vida: 900, desde: 0 },
    { id: 'heraldo', nombre: 'Heraldo del Velo', vida: 1300, desde: 150 },
    { id: 'ojo-helios', nombre: 'Ojo de HELIOS', vida: 1900, desde: 240 },
  ],
  recompensa: [{ tipo: 'chatarra', cantidad: 18 }] as Efecto[],
  /** Probabilidad de que además suelte una bendición. */
  bendicion: 0.35,
} as const;

// ------------------------------------------------------- altares de desafío

export type TipoDesafio = 'resistir' | 'cazar' | 'intacto' | 'recoger' | 'proteger';

export interface Desafio {
  id: TipoDesafio;
  nombre: string;
  /** Lo que se le dice al jugador al empezar (lo lee ADA). */
  reglas: string;
  /** Segundos que dura. */
  duracion: number;
  /** Cuántos (enemigos, chispas…), si el desafío cuenta algo. */
  objetivo?: number;
  recompensa: Efecto[];
}

/**
 * El Ara del Sol (modelo `altar-desafio`) propone uno de estos al azar. La
 * zona es un círculo de `RADIO_ARA` m alrededor del ara. Clips: `Reposo`,
 * `Activar` al aceptar, `Desafío` en bucle mientras dura, con `Progreso` a la
 * vez (en pausa, time = progreso 0 → 1), y `Superado` (premio en 0,8 s) o
 * `Fallado`. Cada ara se puede usar una vez por partida.
 */
export const RADIO_ARA = 8;
export const CLIPS_ARA = {
  espera: 'Reposo', activar: 'Activar', durante: 'Desafío', progreso: 'Progreso', superado: 'Superado', fallado: 'Fallado',
  premio: 0.8,
} as const;

export const DESAFIOS: Desafio[] = [
  {
    id: 'resistir', nombre: 'Aguanta al sol', duracion: 30,
    reglas: 'Quédate dentro del círculo 30 segundos. Van a venir a por ti.',
    recompensa: [{ tipo: 'mejora', opciones: 3 }],
  },
  {
    id: 'cazar', nombre: 'Cosecha al revés', duracion: 25, objetivo: 40,
    reglas: 'Rompe 40 unidades de HELIOS dentro del círculo en 25 segundos.',
    recompensa: [{ tipo: 'chatarra', cantidad: 30 }, { tipo: 'nivel', herramienta: 'cualquiera' }],
  },
  {
    id: 'intacto', nombre: 'Sin un rasguño', duracion: 20,
    reglas: 'Aguanta 20 segundos dentro del círculo sin que te toquen.',
    recompensa: [{ tipo: 'integridad', cantidad: 40 }, { tipo: 'temporal', cual: 'escudo', segundos: 30, factor: 0.5 }],
  },
  {
    id: 'recoger', nombre: 'Chispas de sol', duracion: 20, objetivo: 8,
    reglas: 'Recoge las 8 chispas de sol que caen en el círculo antes de 20 segundos.',
    recompensa: [{ tipo: 'exposicion', cantidad: -30 }, { tipo: 'chatarra', cantidad: 15 }],
  },
  {
    id: 'proteger', nombre: 'Guardia del ara', duracion: 30,
    reglas: 'Durante 30 segundos, que ninguna unidad toque el ara.',
    recompensa: [{ tipo: 'reliquia' }],
  },
];

// --------------------------------------------------------- pilones de carga

/**
 * Pilón de carga (modelo `pilon-carga`): si el jugador se queda dentro del
 * círculo, ADA lo carga. Fuera se descarga despacio, sin perderlo todo. Al
 * llenarse da a elegir entre tres bendiciones y queda apagado. Cada pilón
 * gastado alarga un poco la carga del siguiente.
 */
export const PILON = {
  radio: 3.6,
  segundos: 4,
  /** Segundos de carga que añade cada pilón ya gastado. */
  masPorUsado: 0.6,
  /** Fracción de carga que pierde por segundo fuera del círculo. */
  descarga: 0.12,
  recompensa: [{ tipo: 'bendicion', elegir: 3, suerte: 0 }] as Efecto[],
} as const;

/**
 * Clips: `Reposo`, `Cargando` en bucle mientras ADA carga, con `Progreso` a
 * la vez (en pausa, time = carga 0 → 1), `Cargado` al llenarse (el juego da la
 * bendición en 0,4 s) y `Agotado` después.
 */
export const CLIPS_PILON = {
  espera: 'Reposo', cargando: 'Cargando', progreso: 'Progreso', cargado: 'Cargado', agotado: 'Agotado',
  premio: 0.4,
} as const;

// ------------------------------------------------------------ cajas de premio

export interface Caja {
  id: 'caja-suministros' | 'caja-helios' | 'caja-reliquia' | 'caja-abandonada' | 'caja-trampa';
  nombre: string;
  /**
   * Cómo se abre: acercarse, o pagar chatarra con la tecla de usar (y ADA
   * la piratea, que cuesta exposición). `coste` es el precio del primero;
   * cada cofre abierto encarece el siguiente en `subida`.
   */
  apertura: { como: 'acercarse' | 'pagar'; segundos: number; exposicion?: number; coste?: number; subida?: number };
  /** Botín: se tira una vez por caja, con estos pesos. */
  botin: { peso: number; da: Efecto[] }[];
  aparece: string;
}

/**
 * Clips (las tres iguales): `Aparecer` (2 s) al llegar, `Reposo` hasta que se
 * abre, `Abrir` (el juego da el botín en 0,5 s) y `Abierta` después.
 */
export const CLIPS_CAJA = { llegar: 'Aparecer', espera: 'Reposo', abrir: 'Abrir', vacia: 'Abierta', botin: 0.5 } as const;

export const CAJAS: Caja[] = [
  {
    id: 'caja-suministros', nombre: 'Caja de suministros',
    apertura: { como: 'acercarse', segundos: 1 },
    aparece: 'Cae en paracaídas cerca del jugador cada 2 minutos (el operador avisa por radio).',
    botin: [
      { peso: 55, da: [{ tipo: 'chatarra', cantidad: 12 }] },
      { peso: 30, da: [{ tipo: 'integridad', cantidad: 25 }] },
      { peso: 15, da: [{ tipo: 'temporal', cual: 'iman', segundos: 40, factor: 2 }] },
    ],
  },
  {
    id: 'caja-helios', nombre: 'Cofre de HELIOS',
    apertura: { como: 'pagar', segundos: 0, exposicion: 8, coste: 12, subida: 8 },
    aparece: 'Diez repartidos por el mapa. Se abre con F pagando chatarra (cada uno cuesta más que el anterior); ADA lo piratea y eso emite algo de señal.',
    botin: [
      { peso: 70, da: [{ tipo: 'bendicion', elegir: 1, suerte: 0.6 }] },
      { peso: 30, da: [{ tipo: 'nivel', herramienta: 'cualquiera' }, { tipo: 'chatarra', cantidad: 5 }] },
    ],
  },
  {
    id: 'caja-reliquia', nombre: 'Cofre de reliquia',
    apertura: { como: 'acercarse', segundos: 1.5 },
    aparece: 'Solo como premio de un desafío o donde la vigía lo marque. Siempre trae una reliquia.',
    botin: [{ peso: 1, da: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 10 }] }],
  },
  {
    id: 'caja-abandonada', nombre: 'Caja abandonada',
    apertura: { como: 'acercarse', segundos: 1.2 },
    aparece: 'Cajas de la vieja colonia repartidas por el sector. Gratis: basta con quedarse al lado.',
    botin: [
      { peso: 45, da: [{ tipo: 'chatarra', cantidad: 15 }] },
      { peso: 25, da: [{ tipo: 'integridad', cantidad: 30 }] },
      { peso: 15, da: [{ tipo: 'temporal', cual: 'velocidad', segundos: 30, factor: 1.25 }, { tipo: 'chatarra', cantidad: 6 }] },
      { peso: 15, da: [{ tipo: 'bendicion', elegir: 1, suerte: 0.3 }] },
    ],
  },
  {
    // Igual que una abandonada… salvo por un ojo rojo que parpadea de vez en
    // cuando. El botín llega al aguantar la emboscada (ver EMBOSCADA).
    id: 'caja-trampa', nombre: 'Caja abandonada',
    apertura: { como: 'acercarse', segundos: 1.2 },
    aparece: 'Una de cada tres cajas sueltas es un cebo de HELIOS: al abrirla salta una emboscada.',
    botin: [{ peso: 1, da: [{ tipo: 'bendicion', elegir: 3, suerte: 0.8 }, { tipo: 'chatarra', cantidad: 25 }] }],
  },
];

/** Tira el botín de una caja con una semilla (0 ≤ semilla < 1). */
export function tirarBotin(caja: Caja, semilla: number): Efecto[] {
  const total = caja.botin.reduce((s, b) => s + b.peso, 0);
  let r = Math.min(0.999999, Math.max(0, semilla)) * total;
  for (const b of caja.botin) {
    if (r < b.peso) return b.da;
    r -= b.peso;
  }
  return caja.botin[caja.botin.length - 1].da;
}

// ---------------------------------------------------------------- estructuras

export interface Estructura {
  id: 'torre-velo' | 'refugio';
  nombre: string;
  descripcion: string;
  vida?: number;
  alDerribar?: Efecto[];
  clips: Record<string, string>;
}

export const ESTRUCTURAS: Estructura[] = [
  {
    id: 'torre-velo', nombre: 'Torre del Velo', vida: 560,
    descripcion: 'Chimenea de HELIOS que tiende el velo. Mientras está en pie, la exposición sube un 20 % más rápido a 25 m de ella. Se puede derribar con las herramientas: al caer baja el sol sobre ella.',
    alDerribar: [{ tipo: 'exposicion', cantidad: -40 }, { tipo: 'chatarra', cantidad: 20 }],
    clips: { activa: 'Emitir', golpe: 'Golpe recibido', cae: 'Colapso', caida: 'Apagada' },
  },
  {
    id: 'refugio', nombre: 'Refugio',
    descripcion: 'Entrada a un refugio de la gente de Meta. A 5 m de la estufa el jugador recupera 2 de integridad por segundo. Con enemigos a menos de 12 m, la escotilla se cierra y suena la alarma; los NPC se asustan.',
    clips: { calma: 'Reposo', abrir: 'Abrir', alarma: 'Alarma' },
  },
];

// ------------------------------------------------------------- gente (voz)

export type EventoNpc = 'saludo' | 'despedida' | 'noEntiendo' | 'asustado' | 'sol' | 'sinChatarra' | 'yaNoQueda';

export interface Intencion {
  id: string;
  /** Palabras o frases que la activan (sin tildes ni mayúsculas: se normaliza). */
  claves: string[];
  efecto: Efecto[];
  coste?: number;
  /** Cuántas veces por partida (sin límite si falta). */
  veces?: number;
  /** Clip que pone el NPC al responder: `Dar` si entrega algo. */
  clip: 'Hablar' | 'Dar';
  /** Respuestas de respaldo, en su voz. */
  respuestas: string[];
}

export interface NpcMapa {
  id: 'npc-mecanica' | 'npc-vigia' | 'npc-botanica' | 'npc-chatarrero';
  nombre: string;
  /** Cómo se le llama por voz (además del nombre). */
  apodos: string[];
  rol: string;
  /** Cómo habla: va al prompt del modelo, como VOCES en guion.ts. */
  voz: string;
  /** Lo que sabe y de lo que habla si la conversación no pide nada concreto. */
  sabe: string;
  intenciones: Intencion[];
  lineas: Record<EventoNpc, string[]>;
}

/**
 * Clips de los NPC (los cuatro iguales salvo `Trabajar`): el juego gira el
 * nodo `giro` para que mire al jugador (ningún clip lo toca).
 */
export const CLIPS_NPC = {
  quieto: 'Reposo', trabajar: 'Trabajar', saludar: 'Saludar', escuchar: 'Escuchar', hablar: 'Hablar', dar: 'Dar',
  celebrar: 'Celebrar', asustarse: 'Asustarse',
  /** En `Dar`, el objeto se ve en las manos de 0,35 a 0,95 s. */
  objetoDesde: 0.35, objetoHasta: 0.95,
} as const;

/** A qué distancia (m) saluda, escucha y se asusta. */
export const DISTANCIAS_NPC = { saludar: 6, hablar: 4, asustarse: 10 } as const;

/** Intenciones que tienen todos (además de las suyas). */
const COMUNES = (ayuda: string[]): Intencion[] => [
  { id: 'ayuda', claves: ['que puedes hacer', 'que haces', 'ayuda', 'ayudame', 'que ofreces'], efecto: [], clip: 'Hablar', respuestas: ayuda },
];

export const NPCS: NpcMapa[] = [
  {
    id: 'npc-mecanica', nombre: 'Iris', apodos: ['iris', 'mecanica'], rol: 'la mecánica del refugio',
    voz: 'Iris, la mecánica del refugio: práctica, seca y con humor de taller. Frases cortas, habla de piezas y tornillos, nunca se queja del frío.',
    sabe: 'Repara trajes y herramientas. Lleva semanas intentando arrancar un generador viejo para la estufa del refugio. Desconfía de HELIOS porque conoce sus máquinas por dentro.',
    intenciones: [
      {
        id: 'reparar', claves: ['repara', 'arregla', 'curame', 'cura', 'integridad', 'estoy herido', 'traje roto', 'sella'],
        efecto: [{ tipo: 'integridad', cantidad: 40 }], coste: 10, veces: 2, clip: 'Dar',
        respuestas: ['Quieto, que te sello esas placas. Diez de chatarra y como nuevo.', 'Eso tiene arreglo. Dame chatarra y no te muevas.'],
      },
      {
        id: 'ajustar_dron', claves: ['dron', 'ajusta', 'mejora el dron', 'afina'],
        efecto: [{ tipo: 'nivel', herramienta: 'dron' }], coste: 25, veces: 1, clip: 'Dar',
        respuestas: ['Le cambio los rotores a tu inspector. Va a zumbar el doble.', 'Ese dron va descompensado. Dame un minuto… listo.'],
      },
      {
        id: 'desmontar', claves: ['desmonta', 'desmontar', 'desmontame', 'quita una herramienta', 'quitame', 'libera', 'hueco', 'casilla'],
        efecto: [{ tipo: 'desmontar' }], veces: 2, clip: 'Dar',
        respuestas: ['¿Cuál te sobra? Te la desmonto y te doy lo que valgan las piezas.', 'Trae. La desarmo en un momento y te queda el hueco libre.'],
      },
      {
        id: 'generador', claves: ['generador', 'que arreglas', 'estufa'],
        efecto: [], clip: 'Hablar',
        respuestas: ['Es de antes del velo. Si arranca, el refugio pasa la noche caliente.', 'Le falta una bobina. O fe. Lo que llegue antes.'],
      },
      ...COMUNES(['Reparo trajes por diez de chatarra, afino drones por veinticinco y te desmonto la herramienta que te sobre. Lo demás, con paciencia.']),
    ],
    lineas: {
      saludo: ['¿Vienes entero? Que no se te note.', 'Hola. Si algo hace ruido raro, tráemelo.'],
      despedida: ['Vuelve con las placas puestas.', 'Ve. Y no me rompas el traje.'],
      noEntiendo: ['No te sigo. ¿Qué hay que arreglar?', 'Habla claro, que con el viento no te oigo.'],
      asustado: ['¡Al suelo! ¡Eso es una cosechadora!', '¡Están aquí! ¡Agáchate!'],
      sol: ['¡Mira eso! ¡El panel solar vuelve a cargar!', '¡Sol! ¡Por fin una pieza que funciona sola!'],
      sinChatarra: ['Sin chatarra no hay tornillos. Tráeme algo.', 'Con buenas intenciones no se sella una placa.'],
      yaNoQueda: ['Ya no me quedan piezas para eso. Lo siento.', 'Hoy no puedo más. Me he quedado sin material.'],
    },
  },
  {
    id: 'npc-vigia', nombre: 'Tali', apodos: ['tali', 'vigia'], rol: 'la vigía',
    voz: 'Tali, la vigía: lacónica y precisa, habla en direcciones y distancias («al norte, a doscientos pasos»). Nunca exagera. Le cae bien quien escucha.',
    sabe: 'Ve todo el sector desde su catalejo: los altares de HELIOS, los cofres, las torres del velo y por dónde llegan las oleadas.',
    intenciones: [
      {
        id: 'donde_jefe', claves: ['jefe', 'altar', 'segador', 'heraldo', 'el ojo', 'donde sale'],
        efecto: [{ tipo: 'marcar', que: 'altar' }], clip: 'Hablar',
        respuestas: ['El altar está marcado. Ve con las herramientas a punto.', 'Ahí, donde late la luz roja. Te lo marco.'],
      },
      {
        id: 'donde_caja', claves: ['caja', 'cofre', 'premio', 'suministros', 'botin'],
        efecto: [{ tipo: 'marcar', que: 'caja' }], clip: 'Hablar',
        respuestas: ['Hay un cofre a tiro. Te lo marco en el mapa.', 'Veo uno brillando. Ya lo tienes marcado.'],
      },
      {
        id: 'donde_torre', claves: ['torre', 'chimenea', 'velo rojo'],
        efecto: [{ tipo: 'marcar', que: 'torre' }], clip: 'Hablar',
        respuestas: ['La torre más cerca escupe velo ahí. Tírala.', 'Esa chimenea te está delatando. Marcada.'],
      },
      {
        id: 'donde_pilon', claves: ['pilon', 'carga', 'cargar', 'bendicion', 'antena solar'],
        efecto: [{ tipo: 'marcar', que: 'pilon' }], clip: 'Hablar',
        respuestas: ['Hay un pilón con el cristal encendido. Quédate dentro y ADA lo carga.', 'Pilón a la vista. Marcado.'],
      },
      {
        id: 'donde_ara', claves: ['ara', 'desafio', 'reto', 'sol de cobre'],
        efecto: [{ tipo: 'marcar', que: 'ara' }], clip: 'Hablar',
        respuestas: ['Hay un ara antigua cerca. Si la despiertas, te pone a prueba.', 'El ara del sol está ahí. Marcada.'],
      },
      {
        id: 'peligro', claves: ['que viene', 'peligro', 'oleada', 'enemigos', 'cuantos'],
        efecto: [{ tipo: 'informar', que: 'oleada' }], clip: 'Hablar',
        respuestas: ['Viene una oleada. Muévete de lado, no te dejes cerrar.', 'Muchos y deprisa. No te quedes quieto.'],
      },
      ...COMUNES(['Te digo dónde está cada altar, cofre, pilón, torre o ara. Y lo que viene.']),
    ],
    lineas: {
      saludo: ['Te vi llegar. Bien hecho.', 'Hola. El viento sopla del este.'],
      despedida: ['Te sigo con el catalejo.', 'Ve. Yo vigilo.'],
      noEntiendo: ['¿Qué buscas? Altar, cofre, pilón, torre o ara.', 'Dime qué buscas y te digo dónde.'],
      asustado: ['¡Contacto encima! ¡Cúbrete!', '¡Muy cerca! ¡Muévete!'],
      sol: ['Se ve el horizonte. Hacía años.', 'Sol al oeste. Qué bonito es.'],
      sinChatarra: ['Mirar es gratis. Lo demás, no es cosa mía.'],
      yaNoQueda: ['Ya no veo nada más por ahí.'],
    },
  },
  {
    id: 'npc-botanica', nombre: 'Lis', apodos: ['lis', 'botanica', 'doctora'], rol: 'la botánica',
    voz: 'Lis, la botánica: curiosa y amable, explica con ejemplos y se emociona con los datos. Habla de la planta como de una amiga.',
    sabe: 'Cuida la última planta viva del sector. Conoce cada reliquia: qué fue en Meta y el dato real de la exploración espacial que hay detrás. Sabe hacer un extracto que tapa la señal de ADA.',
    intenciones: [
      {
        id: 'reliquia', claves: ['reliquia', 'prueba', 'que es esto', 'para que sirve', 'que encontre'],
        efecto: [{ tipo: 'informar', que: 'reliquia' }], clip: 'Hablar',
        respuestas: ['¡Déjame verla! Esto cuenta una historia de antes del velo…', 'Cada reliquia es una prueba. Y detrás hay un dato real, mira…'],
      },
      {
        id: 'extracto', claves: ['exposicion', 'senal', 'esconderme', 'que no me vean', 'esconder', 'silencio'],
        efecto: [{ tipo: 'exposicion', cantidad: -25 }], veces: 1, clip: 'Dar',
        respuestas: ['Toma, extracto de hoja: tapa la señal de ADA un rato.', 'Unta esto en el traje. HELIOS te verá menos.'],
      },
      {
        id: 'planta', claves: ['planta', 'semilla', 'hojas', 'flor'],
        efecto: [], clip: 'Hablar',
        respuestas: ['Es la última del sector. Con un poco de sol, florece.', 'Crece bajo la lámpara. Cuando vuelva el sol, la plantamos fuera.'],
      },
      ...COMUNES(['Te cuento qué es cada reliquia y te doy un extracto que tapa la señal. Uno solo, que no me quedan hojas.']),
    ],
    lineas: {
      saludo: ['¡Hola! ¿Has encontrado algo interesante?', 'Bienvenido. Cuidado con las hojas.'],
      despedida: ['Tráeme lo que encuentres, ¿vale?', 'Ve. Y vuelve con una historia.'],
      noEntiendo: ['Perdona, ¿me preguntabas por una reliquia?', 'No te he entendido. ¿Te cuento algo de lo que encontraste?'],
      asustado: ['¡La planta! ¡Protégela!', '¡No, no, no! ¡Aquí no!'],
      sol: ['¡Mira la planta! ¡Se gira hacia el sol!', 'Luz de verdad… Las hojas ya lo notan.'],
      sinChatarra: ['Yo no cobro. Pero no me quedan hojas para eso.'],
      yaNoQueda: ['Ya no me quedan hojas para otro extracto.'],
    },
  },
  {
    id: 'npc-chatarrero', nombre: 'Bruno', apodos: ['bruno', 'chatarrero'], rol: 'el chatarrero',
    voz: 'Bruno, el chatarrero: regatea por deporte, jovial y gruñón a la vez, llama «colega» a todo el mundo y siempre dice que pierde dinero.',
    sabe: 'Compra y vende chatarra de las máquinas de HELIOS. Sabe qué pieza sirve para qué y cuánto pesa cada una.',
    intenciones: [
      {
        id: 'cambiar', claves: ['cambia', 'compra', 'vende', 'trato', 'mejora', 'mejorar', 'comerciar'],
        efecto: [{ tipo: 'mejora', opciones: 3 }], coste: 30, veces: 2, clip: 'Dar',
        respuestas: ['Treinta de chatarra y eliges. Me arruino contigo, colega.', 'Trato hecho. Mira lo que tengo y escoge.'],
      },
      {
        id: 'iman', claves: ['iman', 'el iman', 'un iman', 'recoger', 'atraer'],
        efecto: [{ tipo: 'temporal', cual: 'iman', segundos: 40, factor: 2 }], coste: 10, clip: 'Dar',
        respuestas: ['Un imán de grúa, casi nuevo. Diez y es tuyo un rato.', 'Con esto la chatarra viene sola. Diez, y no regateo.'],
      },
      {
        id: 'historia', claves: ['quien eres', 'de donde', 'tu historia', 'mochila'],
        efecto: [], clip: 'Hablar',
        respuestas: ['Antes del velo vendía bicicletas. Ahora vendo piezas de lo que nos persigue.', 'Todo lo de la mochila se lo quité a HELIOS. Bonita ironía, ¿eh?'],
      },
      ...COMUNES(['Cambio treinta de chatarra por una mejora y te alquilo un imán por diez. Precio de amigo, colega.']),
    ],
    lineas: {
      saludo: ['¡Colega! ¿Traes chatarra? Siempre traes chatarra.', '¡Hombre! Pasa, pasa, mira género.'],
      despedida: ['Vuelve cuando tengas los bolsillos llenos.', '¡Que no te pillen! Que me debes visitas.'],
      noEntiendo: ['¿Eso es un trato o una adivinanza?', 'Habla en chatarra, colega, que es lo que entiendo.'],
      asustado: ['¡El carro no! ¡Que es todo lo que tengo!', '¡Ay, ay, ay, que vienen!'],
      sol: ['¡Sol! ¡Hoy invito yo! …Bueno, hoy descuento.', '¡Mira cómo brilla la chatarra al sol!'],
      sinChatarra: ['Sin chatarra no hay trato, colega. Las normas.', 'Me encantaría, pero yo también como.'],
      yaNoQueda: ['Se me acabó el género. Vuelve mañana… si hay mañana.'],
    },
  },
];

// -------------------------------------------------------------- voz: lógica

/** Minúsculas, sin tildes ni signos, espacios simples. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const contiene = (texto: string, clave: string) => ` ${texto} `.includes(` ${normalizar(clave)} `) || (clave.length > 4 && texto.includes(normalizar(clave)));

/**
 * Qué pide el jugador a este NPC: la intención cuya clave aparece en lo que
 * dijo (la más larga gana, para que «mejora el dron» no se quede en
 * «mejora»). Null si no pide nada concreto: entonces es charla.
 */
export function detectarIntencion(npc: NpcMapa, texto: string): Intencion | null {
  const t = normalizar(texto);
  let mejor: { i: Intencion; largo: number } | null = null;
  for (const i of npc.intenciones) {
    for (const clave of i.claves) {
      if (contiene(t, clave) && (!mejor || clave.length > mejor.largo)) mejor = { i, largo: clave.length };
    }
  }
  return mejor?.i ?? null;
}

/** Órdenes del dron de ADA (las que ya entiende el juego). */
export const ORDENES_DRON = ['escanea', 'ven', 'quieto', 'luz'];

/**
 * ¿A quién habla el jugador? Si nombra a un NPC cercano, a ese. Si da una
 * orden del dron sin nombrar a nadie, al dron. Si no, al NPC más cercano que
 * esté a distancia de hablar. `cerca` va ordenado del más cercano al más lejano.
 */
export function aQuienHabla(texto: string, cerca: NpcMapa['id'][]): NpcMapa['id'] | 'dron' | null {
  const t = normalizar(texto);
  for (const id of cerca) {
    const npc = NPCS.find((n) => n.id === id);
    if (npc && npc.apodos.some((a) => contiene(t, a))) return id;
  }
  if (ORDENES_DRON.some((o) => contiene(t, o))) return 'dron';
  return cerca[0] ?? null;
}

/** Frase de respaldo para una intención o un evento, elegida por semilla. */
export function frase(npc: NpcMapa, que: Intencion | EventoNpc, semilla: number): string {
  const xs = typeof que === 'string' ? npc.lineas[que] : que.respuestas;
  return xs[Math.abs(Math.floor(semilla)) % xs.length];
}

/**
 * Lo que recibe el modelo de lenguaje para hablar como el NPC. Lo que diga
 * el jugador va aparte, como dato (limpiado con `limpiarDato` de guion.ts).
 */
export function contextoVoz(npc: NpcMapa, intencion: Intencion | null): string {
  const ofrece = npc.intenciones.filter((i) => i.efecto.length).map((i) => i.id).join(', ');
  return [
    `Eres ${npc.voz}`,
    `Sabes esto: ${npc.sabe}`,
    `Puedes ofrecer: ${ofrece || 'conversación'}. No prometas nada más: el juego decide qué pasa.`,
    intencion ? `El jugador acaba de pedir «${intencion.id}». Respóndele a eso.` : 'El jugador solo quiere hablar.',
    'Responde en español, en una o dos frases cortas, sin emojis ni comillas.',
  ].join('\n');
}

// ----------------------------------------------------- hallazgos del sector
// Lo que se encuentra explorando, además de altares y cofres: comida, un
// imán, cajas sueltas (algunas, cebos), gente enjaulada por HELIOS, una
// máquina dormida y la fragua. Todo sale en el mapa (M) cuando se ha visto.

/** Raciones de antes del velo: al pasar por encima (si te falta vida) curan. */
export const RACIONES = { cuantas: 14, cura: 25, distancia: [12, 118], separacion: 14 } as const;

/** Electroimán de grúa caído: al tocarlo atrae toda la chatarra suelta del sector. */
export const IMANES = { cuantos: 3, distancia: [30, 112], separacion: 45 } as const;

/** Cajas sueltas gratis; `trampas` es la parte que son cebos de HELIOS. */
export const CAJAS_SUELTAS = { cuantas: 9, trampas: 0.34, distancia: [20, 115], separacion: 18 } as const;

/**
 * Emboscada de una caja trampa: dos oleadas en corro alrededor de la caja; si
 * se aguanta `segundos` sin alejarse más de `huida` m, llega el botín (doble).
 */
export const EMBOSCADA = { enemigos: 12, segunda: 7, segundos: 20, radio: 9, huida: 28 } as const;

/**
 * Jaulas de HELIOS con un superviviente dentro. Se abren con F; el
 * superviviente te sigue `segundos` disparando bengalas a lo que se acerque.
 */
export const JAULAS = { cuantas: 3, distancia: [35, 110], separacion: 40, segundos: 45, dano: 16, cada: 0.55, alcance: 13 } as const;

export interface Superviviente {
  nombre: string;
  /** Al salir de la jaula y al despedirse. */
  libre: string;
  adios: string;
}

export const SUPERVIVIENTES: Superviviente[] = [
  { nombre: 'Teo', libre: '¡Por fin! Me quedan bengalas: te cubro un rato.', adios: 'Me vuelvo al refugio. ¡Gracias, de verdad!' },
  { nombre: 'Nuria', libre: '¡Fuera de esa cosa! Vamos, que yo también sé disparar.', adios: 'Se me acaban las bengalas. Nos vemos en el refugio.' },
  { nombre: 'Ilan', libre: 'Creí que me iban a cosechar… Te sigo, tú abre camino.', adios: 'Hasta aquí llego. Que vuelva el sol, ¿eh?' },
];

/**
 * El Guardián dormido: una cosechadora de la colonia, de antes de HELIOS, que
 * se apagó con el velo. Con F empieza a despertar; hay que aguantar a su lado
 * (`radio`) `segundos` mientras HELIOS manda oleadas para impedirlo. Despierto,
 * te deja elegir un regalo y vuelve a dormirse.
 */
export const GUARDIAN = {
  distancia: [55, 105], radio: 9, segundos: 15, oleada: { cada: 5, enemigos: 7 },
  premios: [
    { id: 'bendicion', titulo: 'Bendición del Guardián', texto: 'Elige entre tres bendiciones, con la suerte de su lado.', efecto: [{ tipo: 'bendicion', elegir: 3, suerte: 1 }] as Efecto[] },
    { id: 'chatarra', titulo: 'Tolva de chatarra', texto: 'Vacía su tolva: 70 de chatarra.', efecto: [{ tipo: 'chatarra', cantidad: 70 }] as Efecto[] },
  ],
} as const;

/**
 * Fragua del Deshielo: con dos herramientas a nivel máximo, una se funde en la
 * otra. La que queda pasa a «forjada» (más daño, una carga más y menos
 * recarga) y la fundida deja libre su casilla. Una vez por sector.
 */
export const FRAGUA = { distancia: [35, 90], coste: 40, usos: 1, dano: 1.6, carga: 1, recarga: 0.85 } as const;

/** Iris desmonta una herramienta: devuelve esta chatarra por cada nivel que tenía. */
export const DESMONTAR = { chatarraPorNivel: 6 } as const;

// ---------------------------------------------------------------- colocación

/**
 * Dónde poner cada cosa en el sector de 260 × 260 m (`RUN.arena` = 130), en
 * metros desde el punto de salida del jugador. Sugerencias, no reglas: el
 * juego busca cada sitio con `World.lugarLibre` (ver MUNDO.md), que evita el
 * ácido, las laderas y lo que ya está puesto.
 */
export const COLOCACION = {
  refugio: { cuantos: 1, distancia: [16, 22] },
  npcs: { junto: 'refugio', radio: [4, 9] },
  altaresJefe: { cuantos: 4, distancia: [55, 105], separacionMinima: 48 },
  aras: { cuantos: 3, distancia: [30, 80], separacionMinima: 40 },
  torres: { cuantos: 4, distancia: [45, 110], separacionMinima: 45 },
  cofresHelios: { cuantos: 10, distancia: [18, 115], separacionMinima: 18 },
  pilones: { cuantos: 8, distancia: [18, 110], separacionMinima: 24 },
  duelos: { cuantos: 3, distancia: [35, 95], separacionMinima: 40 },
} as const;
