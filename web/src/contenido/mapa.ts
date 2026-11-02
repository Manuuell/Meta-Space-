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
  | { tipo: 'marcar'; que: 'altar' | 'caja' | 'torre' | 'ara' | 'refugio' }
  /** El NPC cuenta algo de la partida (la oleada que viene, la última reliquia). */
  | { tipo: 'informar'; que: 'oleada' | 'reliquia' };

// ------------------------------------------------------------ altares de jefe

export interface AltarJefe {
  id: 'altar-cosecha' | 'altar-heraldo' | 'altar-ojo';
  nombre: string;
  /** Id del modelo del jefe que sale de él. */
  jefe: 'segador-jefe' | 'heraldo' | 'ojo-helios';
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
    id: 'altar-cosecha', nombre: 'Altar de la Cosecha', jefe: 'segador-jefe', minuto: 3,
    descripcion: 'De aquí sale el Segador, Jefe de Cosecha. Lleva dentro cuatro reliquias; al vencerlo, el altar se purifica y entrega una.',
    recompensa: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 25 }, { tipo: 'mejora', opciones: 3 }],
    extraPorAdelantar: [{ tipo: 'nivel', herramienta: 'cualquiera' }],
  },
  {
    id: 'altar-heraldo', nombre: 'Altar del Velo', jefe: 'heraldo', minuto: 5,
    descripcion: 'De aquí sale el Heraldo del Velo. Al vencerlo, el velo se abre sobre el altar: el jugador se cura entero y la exposición se vacía.',
    recompensa: [{ tipo: 'reliquia' }, { tipo: 'integridad', cantidad: 999 }, { tipo: 'exposicion', cantidad: -100 }],
    extraPorAdelantar: [{ tipo: 'chatarra', cantidad: 40 }],
  },
  {
    id: 'altar-ojo', nombre: 'Altar del Ojo', jefe: 'ojo-helios', minuto: 9,
    descripcion: 'De aquí sale el Ojo de HELIOS, el jefe final. Al vencerlo, ADA firma la auditoría de este sector.',
    recompensa: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 60 }, { tipo: 'mejora', opciones: 4 }],
    extraPorAdelantar: [],
  },
];

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

// ------------------------------------------------------------ cajas de premio

export interface Caja {
  id: 'caja-suministros' | 'caja-helios' | 'caja-reliquia';
  nombre: string;
  /** Cómo se abre: acercarse, o que ADA la piratee (cuesta exposición). */
  apertura: { como: 'acercarse' | 'hackear'; segundos: number; exposicion?: number };
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
    apertura: { como: 'hackear', segundos: 3, exposicion: 15 },
    aparece: 'Seis repartidos por el mapa, junto a las torres y los altares. ADA tarda 3 s en abrirlo y eso emite señal.',
    botin: [
      { peso: 40, da: [{ tipo: 'chatarra', cantidad: 20 }] },
      { peso: 35, da: [{ tipo: 'mejora', opciones: 3 }] },
      { peso: 25, da: [{ tipo: 'nivel', herramienta: 'cualquiera' }] },
    ],
  },
  {
    id: 'caja-reliquia', nombre: 'Cofre de reliquia',
    apertura: { como: 'acercarse', segundos: 1.5 },
    aparece: 'Solo como premio de un desafío o donde la vigía lo marque. Siempre trae una reliquia.',
    botin: [{ peso: 1, da: [{ tipo: 'reliquia' }, { tipo: 'chatarra', cantidad: 10 }] }],
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
    id: 'torre-velo', nombre: 'Torre del Velo', vida: 400,
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
        id: 'generador', claves: ['generador', 'que arreglas', 'estufa'],
        efecto: [], clip: 'Hablar',
        respuestas: ['Es de antes del velo. Si arranca, el refugio pasa la noche caliente.', 'Le falta una bobina. O fe. Lo que llegue antes.'],
      },
      ...COMUNES(['Reparo trajes por diez de chatarra y afino drones por veinticinco. Lo demás, con paciencia.']),
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
        id: 'donde_ara', claves: ['ara', 'desafio', 'reto', 'sol de cobre'],
        efecto: [{ tipo: 'marcar', que: 'ara' }], clip: 'Hablar',
        respuestas: ['Hay un ara antigua cerca. Si la despiertas, te pone a prueba.', 'El ara del sol está ahí. Marcada.'],
      },
      {
        id: 'peligro', claves: ['que viene', 'peligro', 'oleada', 'enemigos', 'cuantos'],
        efecto: [{ tipo: 'informar', que: 'oleada' }], clip: 'Hablar',
        respuestas: ['Viene una oleada. Muévete de lado, no te dejes cerrar.', 'Muchos y deprisa. No te quedes quieto.'],
      },
      ...COMUNES(['Te digo dónde está cada altar, cofre, torre o ara. Y lo que viene.']),
    ],
    lineas: {
      saludo: ['Te vi llegar. Bien hecho.', 'Hola. El viento sopla del este.'],
      despedida: ['Te sigo con el catalejo.', 'Ve. Yo vigilo.'],
      noEntiendo: ['¿Qué buscas? Altar, cofre, torre o ara.', 'Dime qué buscas y te digo dónde.'],
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
  altaresJefe: { cuantos: 3, distancia: [60, 100], separacionMinima: 60 },
  aras: { cuantos: 3, distancia: [30, 80], separacionMinima: 40 },
  torres: { cuantos: 4, distancia: [45, 110], separacionMinima: 45 },
  cofresHelios: { cuantos: 6, distancia: [25, 115], separacionMinima: 20 },
} as const;
