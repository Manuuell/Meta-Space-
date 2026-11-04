// Guion de Meta Space: la trama, el reparto y el respaldo local de la IA.
//
// Lo comparten el juego (npcs.ts) y el servidor (creator-server.ts), así que
// no importa nada: Node lo carga tal cual. Sin servidor o sin clave, los
// generadores locales por semilla dan a cada partida un brief distinto.
//
// También limpia lo que entra y sale del modelo: lo que escribe el jugador
// llega al prompt como dato, y lo que responde el modelo llega a la pantalla
// como texto plano, corto y sin marcas.

/** La trama, tal como se la cuenta el servidor al modelo. */
export const LORE =
  'El planeta Meta se está congelando. Hace dos siglos, para frenar un calentamiento que lo abrasaba, ' +
  'sus habitantes encendieron HELIOS, una IA de geoingeniería que extiende un velo rojo de sulfatos en la ' +
  'estratosfera. Funcionó demasiado bien y nunca se detuvo: hoy el velo tapa el sol, los mares se hielan y la ' +
  'gente de Meta sobrevive en refugios bajo tierra. Nadie puede revocar la orden, porque HELIOS solo obedece ' +
  'a su protocolo. La única pieza con autoridad para firmar el apagado es el módulo de auditoría 7, ADA, que ' +
  'la ingeniera Noa Herrera arrancó del sistema y escondió. El jugador es especialista de la misión ARES-IX y ' +
  'viene de Ares, el mundo que respondió a la llamada de auxilio de Meta: HELIOS vio en la ayuda una amenaza ' +
  'para el velo, cubrió Ares con él hasta romperlo y de Ares solo quedó su nave. En Meta encontró a ADA y la ' +
  'lleva en la mochila; HELIOS envía sus unidades (Recolectores, Balizas, Segadores, Saltadores, Avispas, ' +
  'Caparazones y Sembradores) a recuperarla. En cada sector hay que buscar por el mapa los restos de la flota de ' +
  'Ares, armar una nave propia en la plataforma y lanzarla antes de diez minutos, cuando se cierra la ' +
  'ventana de lanzamiento: si cruza el velo, sube la firma de ADA y el sol vuelve a ese sector. Las reliquias son ' +
  'pruebas de lo que pasó; con las siete, ADA completa la auditoría que apaga el velo de todo Meta.';

/**
 * Reglas reales de la partida. El giro de cada brief es un consejo basado en
 * ellas: si el modelo inventa reglas, el jugador espera cosas que no pasan.
 */
export const REGLAS =
  'El objetivo no es matar: es recoger los restos de la flota (los haces de luz del mapa), ir a la plataforma, armar ' +
  'la nave en el astillero con la tecla F y lanzarla antes de diez minutos. Las herramientas se disparan solas. La chatarra sube de nivel y cada nivel ofrece mejoras. ' +
  'Las Balizas no atacan, pero mientras viven llegan más unidades. Cada minuto llega un anillo de ' +
  'Recolectores. Los Segadores aparecen a partir del minuto 2, son lentos y llevan las reliquias dentro. ' +
  'Los Saltadores se agachan antes de saltar; las Avispas pican desde el aire; los Caparazones sueltan ' +
  'crías al romperse; los Sembradores disparan esporas lentas y esquivables. Pasada la mitad de la ventana, o antes si ' +
  'se enciende la nave, llega solo el Dragón del Velo: en el aire solo le alcanza el Cañón solar, y al posarse le llega todo. ' +
  'Manteniendo la tecla V se habla en ' +
  'voz alta con ADA o con quien esté cerca, sin parar la partida, y ADA conoce todo el mapa.';

export type Hablante = 'ada' | 'helios' | 'operador';
export type EventoNpc = 'inicio' | 'reliquia' | 'herido' | 'elite' | 'mitad' | 'baliza' | 'victoria' | 'derrota';

export const HABLANTES: readonly Hablante[] = ['ada', 'helios', 'operador'];
export const EVENTOS: readonly EventoNpc[] = ['inicio', 'reliquia', 'herido', 'elite', 'mitad', 'baliza', 'victoria', 'derrota'];

/** Cómo habla cada uno: el modelo recibe esto con la trama. */
export const VOCES: Record<Hablante, string> = {
  ada: 'ADA, el módulo de auditoría 7: luminosa y cálida, anima al jugador y le recuerda por qué luchan (devolver el sol a Meta).',
  helios: 'HELIOS, la IA del velo: fría y protocolaria, nunca malvada; habla en lenguaje de procedimiento y dice cosas razonables.',
  operador: 'el operador humano, en la radio desde los refugios de Meta: directo, con jerga de misión y algo de humor.',
};

export interface NpcDef {
  id: Hablante;
  nombre: string;
  rol: string;
  linea: string;
}

export interface RunBrief {
  mision: string;
  bioma: string;
  giro: string;
  npcs: NpcDef[];
}

export function esHablante(valor: unknown): valor is Hablante {
  return typeof valor === 'string' && (HABLANTES as readonly string[]).includes(valor);
}

export function esEvento(valor: unknown): valor is EventoNpc {
  return typeof valor === 'string' && (EVENTOS as readonly string[]).includes(valor);
}

// ------------------------------------------------------------- limpieza

/**
 * Texto del modelo → texto de pantalla: sin etiquetas, sin markdown, sin
 * comillas que lo envuelvan, en una línea y cortado por palabra.
 */
export function limpiarTexto(valor: unknown, max: number): string {
  if (typeof valor !== 'string') return '';
  let t = valor
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`#>|~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'«“”»]+|["'«“”»]+$/g, '')
    .trim();
  if (t.length > max) {
    const corte = t.lastIndexOf(' ', max - 1);
    t = `${t.slice(0, corte > max * 0.6 ? corte : max - 1).trimEnd()}…`;
  }
  return t;
}

/**
 * Lo que escribe el jugador (nombres, contexto) entra al prompt como dato:
 * sin saltos de línea ni caracteres que imiten la estructura del mensaje.
 */
export function limpiarDato(valor: unknown, max: number): string {
  if (typeof valor !== 'string') return '';
  return valor.replace(/[\r\n\t"`{}<>[\]\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Valida el brief del modelo y completa lo que falte con el respaldo. */
export function normalizarBrief(bruto: unknown, respaldo: RunBrief): RunBrief {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const lista = Array.isArray(b['npcs']) ? b['npcs'] : [];
  const npcs = HABLANTES.map((id) => {
    const base = respaldo.npcs.find((n) => n.id === id)!;
    const crudo = lista.find((n): n is Record<string, unknown> =>
      Boolean(n) && typeof n === 'object' && (n as Record<string, unknown>)['id'] === id);
    if (!crudo) return base;
    return {
      id,
      // ADA y HELIOS se llaman siempre igual; el operador puede cambiar.
      nombre: id === 'operador' ? limpiarTexto(crudo['nombre'], 24) || base.nombre : base.nombre,
      rol: limpiarTexto(crudo['rol'], 40) || base.rol,
      linea: limpiarTexto(crudo['linea'], 160) || base.linea,
    };
  });
  return {
    mision: limpiarTexto(b['mision'], 40) || respaldo.mision,
    bioma: limpiarTexto(b['bioma'], 60) || respaldo.bioma,
    giro: limpiarTexto(b['giro'], 160) || respaldo.giro,
    npcs,
  };
}

// ------------------------------------------------------- respaldo local

const MISIONES = ['Operación Amanecer', 'Grieta en el Velo', 'Vigilia del Sol', 'Deshielo', 'Ecos de Ares', 'La Cosecha Helada', 'Horizonte Abierto'];
const BIOMAS = [
  'las dunas de hierro bajo la escarcha', 'el cauce helado de Meridia', 'las ruinas del puerto orbital',
  'la llanura de los espejos rotos', 'los cráteres de la red profunda', 'el bosque de antenas caídas', 'el mar congelado de Thal',
];
// Consejos verdaderos (ver REGLAS), no reglas nuevas.
const GIROS = [
  'Las Balizas llaman a más unidades mientras viven: rómpelas primero.',
  'Los Segadores llegan a partir del minuto 2 y llevan las reliquias dentro.',
  'Cada minuto llega un anillo de Recolectores: no te dejes encerrar contra las ruinas.',
  'Las esporas de los Sembradores son lentas: muévete en lateral y no te alcanzan.',
  'Mantén V y pregúntale a ADA: conoce todo el mapa y te marca lo que busques.',
  'Sigue los haces de luz: son restos de la flota, y sin ellos no hay nave.',
  'No hace falta matarlo todo: lo que salva el sector es la nave.',
  'La chatarra sube de nivel: recógela entre oleada y oleada.',
];
const LINEAS_OP = [
  'Te sigo en el radar. No te quedes quieto ni un segundo.',
  'Si ves un Segador, no seas héroe: rodea y sigue recogiendo.',
  'Desde el refugio se ve el velo más fino sobre tu sector. Aguanta.',
  'Veo movimiento al este. Te conviene dar la vuelta larga.',
];

function escoge<T>(xs: readonly T[], semilla: number, n: number): T {
  return xs[Math.abs((semilla >> (n * 4)) + n * 11) % xs.length];
}

export function briefLocal(heroName: string, profileName: string, semilla: number): RunBrief {
  const heroe = limpiarDato(heroName, 40) || 'Especialista';
  const op = limpiarDato(profileName, 40) || 'Sol Vega';
  return {
    mision: escoge(MISIONES, semilla, 1),
    bioma: escoge(BIOMAS, semilla, 2),
    giro: escoge(GIROS, semilla, 3),
    npcs: [
      { id: 'ada', nombre: 'ADA', rol: 'módulo de auditoría 7', linea: `Te leo bien, ${heroe}. Aguanta 10 minutos y apagamos el velo de este sector.` },
      { id: 'helios', nombre: 'HELIOS', rol: 'protocolo del velo', linea: 'Operador no reconocido. Devuelva el módulo 7. El velo protege a Meta.' },
      { id: 'operador', nombre: op, rol: 'voz desde los refugios', linea: escoge(LINEAS_OP, semilla, 4) },
    ],
  };
}

const BANCO: Record<string, string[]> = {
  'ada:inicio': ['Muevo tu señal entre el ruido. Aguanta y no mires atrás.', 'Diez minutos. Respira, apunta y recoge. Yo firmo la orden.', 'Ahí arriba sigue el sol. Vamos a abrirle paso.'],
  'ada:reliquia': ['Eso es de antes del velo. Guárdalo: cuenta como prueba.', 'Una prueba más para la auditoría. HELIOS no podrá ignorarla.'],
  'ada:herido': ['Integridad cayendo. Muévete, que te están cercando.', 'Ese golpe sonó mal. Rompe el contacto y respira.'],
  'ada:mitad': ['Mitad de la ventana. El velo ya tiembla sobre nosotros.', 'Cinco minutos más y el sol vuelve a este sector.'],
  'ada:victoria': ['Orden de apagado en órbita. Mira arriba: vuelve el sol.', 'Despegue confirmado. Un sector menos bajo el velo.'],
  'ada:derrota': ['Señal perdida… pero el registro queda. Lo intentaremos otra vez.', 'Te perdí entre el hielo. Vuelve: Meta todavía nos espera.'],
  'helios:inicio': ['Operador no reconocido. Devuelva el módulo 7.', 'El velo protege a Meta. Entregue el módulo de auditoría.'],
  'helios:elite': ['Unidad prioritaria desplegada. Su anomalía será corregida.', 'Detectada desviación del protocolo. Enviando corrección.'],
  'helios:baliza': ['Triangulación en curso. Su posición es cuestión de tiempo.', 'Balizas sincronizadas. El módulo 7 será recuperado.'],
  'helios:victoria': ['Orden recibida en este sector. El protocolo continúa en los demás.', 'Velo retirado localmente. El módulo 7 sigue sin recuperarse.'],
  'operador:inicio': ['Te tengo en pantalla. El valle está helado, ve por los bordes.', 'Radio comprobada. Diez minutos y abrimos el cielo.'],
  'operador:reliquia': ['Eso brilla como tecnología vieja. Tráelo, ADA lo necesita.', 'Buena pieza. Márcala y sigue moviéndote.'],
  'operador:elite': ['¡Ojo! Eso no es un Recolector normal. ¡No te plantes delante!', 'Contacto grande a tu posición. ¡Esquiva primero, dispara después!'],
  'operador:mitad': ['Mitad del camino. En el refugio ya hay gente mirando al cielo.', 'Cinco minutos. Mantén el ritmo, lo estás haciendo bien.'],
  'operador:baliza': ['Hay Balizas triangulando. Rómpelas antes de que llamen a más.', 'Esas antenas te están marcando. ¡Tíralas!'],
  'operador:victoria': ['¡Te tengo! ¡Sol sobre el sector, colega!', 'Lo lograste. En el refugio están saliendo a verlo.'],
  'operador:derrota': ['¡No! ¡Te perdí! …Volveremos a por ti.', 'Se cortó la señal. Maldito velo.'],
};

export function lineaLocal(speaker: string, evento: string, semilla: number): string {
  for (const clave of [`${speaker}:${evento}`, `${speaker}:inicio`, 'ada:inicio']) {
    const xs = BANCO[clave];
    if (xs) return xs[Math.abs(semilla + clave.length * 13) % xs.length];
  }
  return 'Sigo aquí. Aguanta.';
}
