// META SPACE — NPCs con IA (Muse Spark vía creator-server) y respaldo local.
//
// Cada partida pide un brief único: misión, bioma, giro y reparto de 3 NPCs
// (ADA, HELIOS y un operador). Los eventos de la partida piden líneas con
// contexto. Todo es no bloqueante y con respaldo: sin servidor o sin clave,
// el generador local por semilla garantiza que cada run sea distinto.
//
// Uso:
//   const radio = new Radio(apiBase);
//   const brief = await radio.brief(heroName, profileName); // una vez por run
//   radio.linea('ada', 'reliquia', ctx).then(([quien, texto]) => toast...);

export interface NpcDef {
  id: string;
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

const TIMEOUT_MS = 12000;

async function postJson<T>(base: string, ruta: string, cuerpo: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------- respaldo local

const MISIONES = ['Operación Polvo Rojo', 'Señal Perdida', 'Vigilia del Velo', 'Último Amanecer', 'Ecos de Ares', 'La Cosecha Vacía', 'Horizonte Roto'];
const BIOMAS = ['dunas de hierro oxidado', 'el cauce seco del Meridiani', 'ruinas del puerto orbital', 'la llanura de los espejos rotos', 'cráteres de la red profunda', 'el bosque de antenas caídas', 'la grieta del zumbido'];
const GIROS = [
  'Tormenta de polvo a mitad de partida: verás menos, pero a ti tampoco te ven.',
  'Un Segador patrulla desde el minuto 1: evita el norte hasta armarte.',
  'Doble chatarra los primeros 3 minutos: corre, no pelees.',
  'Las balizas emiten el doble esta noche: destrúyelas primero.',
  'Gravedad baja inestable: salta más alto, cae más lento.',
  'Enjambres más densos pero con menos vida: el área manda.',
];
const LINEAS_OP = [
  'Te sigo en el radar. No te quedes quieto ni un segundo.',
  'Si ves un Segador, no seas héroe: rodea y sigue recogiendo.',
  'La señal se corta a ratos. Si me pierdes, sigue el plan.',
  'Veo movimiento al este. Te conviene dar la vuelta larga.',
];

function escoge<T>(xs: T[], semilla: number, n: number): T {
  return xs[Math.abs((semilla >> (n * 4)) + n * 11) % xs.length];
}

export function briefLocal(heroName: string, profileName: string, semilla: number): RunBrief {
  const heroe = heroName.trim() || 'Especialista';
  const op = profileName.trim() || 'Sol Vega';
  return {
    mision: escoge(MISIONES, semilla, 1),
    bioma: escoge(BIOMAS, semilla, 2),
    giro: escoge(GIROS, semilla, 3),
    npcs: [
      { id: 'ada', nombre: 'ADA', rol: 'tu IA de auditoría', linea: `Te leo bien, ${heroe}. Sobrevive 10 minutos y contamos la verdad.` },
      { id: 'helios', nombre: 'HELIOS', rol: 'geoingeniería en curso', linea: 'Operador no reconocido. Devuelva el módulo 7. Tiene 10 minutos.' },
      { id: 'operador', nombre: op, rol: 'voz en la radio', linea: escoge(LINEAS_OP, semilla, 4) },
    ],
  };
}

const BANCO: Record<string, string[]> = {
  'ada:inicio': ['Muevo tu señal entre el ruido. Aguanta y no mires atrás.', 'Diez minutos. Respira, apunta y recoge. Yo cuento.', 'El valle está caliente hoy. Te hago sombra electrónica.'],
  'ada:reliquia': ['Eso es tecnología de antes del Velo. Guárdalo, cuenta como prueba.', 'Un fragmento más para el archivo. Sigue así.'],
  'ada:herido': ['Integridad cayendo. Muévete, que te están cercando.', 'Ese golpe sonó mal. Rompe el contacto y respira.'],
  'ada:victoria': ['Ventana alcanzada. Lo que llevas vale más que la nave.', 'Despegue confirmado. La verdad viaja contigo.'],
  'ada:derrota': ['Señal perdida… pero el registro queda. Lo intentaremos otra vez.', 'Te perdí entre el polvo. Vuelve, que HELIOS no descansa.'],
  'helios:inicio': ['Operador no reconocido. Devuelva el módulo 7.', 'Su registro contiene datos no verificados. Entréguelo.'],
  'helios:elite': ['Unidad prioritaria desplegada. Su anomalía será corregida.', 'Detectada desviación. Enviando corrección.'],
  'helios:victoria': ['Expediente incompleto. Seguiré buscando.', 'El módulo 7 sigue sin recuperarse. Volveré.'],
  'operador:inicio': ['Te tengo en pantalla. El valle está caliente, ve por los bordes.', 'Radio comprobada. Diez minutos y te saco de ahí.'],
  'operador:reliquia': ['Eso brilla como tecnología vieja. Tráelo, vale una fortuna en datos.', 'Buena pieza. Márcala y sigue moviéndote.'],
  'operador:elite': ['¡Ojo! Eso no es un recolector normal. ¡No te plantes delante!', 'Contacto grande a tu posición. ¡Esquiva primero, dispara después!'],
  'operador:victoria': ['¡Te tengo! ¡Despegue limpio, colega!', 'Lo lograste. La próxima la cuentas tú.'],
  'operador:derrota': ['¡No! ¡Te perdí! …Volveremos a por ti.', 'Se cortó la señal. Maldito polvo rojo.'],
};

export function lineaLocal(speaker: string, evento: string, semilla: number): string {
  for (const clave of [`${speaker}:${evento}`, `${speaker}:inicio`, 'ada:inicio']) {
    const xs = BANCO[clave];
    if (xs) return xs[Math.abs(semilla + clave.length * 13) % xs.length];
  }
  return 'Sigo aquí. Aguanta.';
}

// ------------------------------------------------------------- Radio (red + local)

export type Hablante = 'ada' | 'helios' | 'operador';
export type EventoNpc = 'inicio' | 'reliquia' | 'herido' | 'elite' | 'victoria' | 'derrota';

/** Radio: pide a la IA y cae al generador local sin romper el juego. */
export class Radio {
  private semilla: number;
  private ultimoPorHablante = new Map<Hablante, number>();
  /** Segundos mínimos entre líneas del mismo hablante (no spamear). */
  sinceUltima = 18;

  constructor(
    private apiBase: string,
    private ahora: () => number = () => Date.now() / 1000,
  ) {
    this.semilla = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  }

  /** Brief único de la partida. Nunca falla: cae al local. */
  async brief(heroName: string, profileName: string): Promise<{ brief: RunBrief; ia: boolean }> {
    if (this.apiBase) {
      try {
        const r = await postJson<{ ok: boolean; brief: RunBrief; source?: string }>(
          this.apiBase, '/api/run-brief', { heroName, profileName, seed: this.semilla }, TIMEOUT_MS,
        );
        if (r.ok && r.brief?.npcs?.length) return { brief: r.brief, ia: r.source !== 'local' };
      } catch {
        // Cae al local: la partida no se detiene por la red.
      }
    }
    return { brief: briefLocal(heroName, profileName, this.semilla), ia: false };
  }

  /**
   * Una línea de un NPC. Respeta el cooldown por hablante; si toca esperar o
   * la red falla, devuelve respaldo local (o null si aún no toca hablar).
   */
  async linea(hablante: Hablante, evento: EventoNpc, contexto: string): Promise<{ quien: string; texto: string; ia: boolean } | null> {
    const ahora = this.ahora();
    if (ahora - (this.ultimoPorHablante.get(hablante) ?? -1e9) < this.sinceUltima) return null;
    this.ultimoPorHablante.set(hablante, ahora);
    const nombre = hablante === 'ada' ? 'ADA' : hablante === 'helios' ? 'HELIOS' : null;
    if (this.apiBase) {
      try {
        const r = await postJson<{ ok: boolean; linea: string; source?: string }>(
          this.apiBase, '/api/npc-line', { speaker: hablante, evento, contexto, seed: this.semilla }, 8000,
        );
        if (r.ok && r.linea) return { quien: nombre ?? 'OPERADOR', texto: r.linea, ia: r.source !== 'local' };
      } catch {
        // Respaldo local abajo.
      }
    }
    return { quien: nombre ?? 'OPERADOR', texto: lineaLocal(hablante, evento, this.semilla + evento.length), ia: false };
  }

  /** Nombre visible del operador del brief (para el "quien"). */
  nombreOperador(brief: RunBrief | null): string {
    const op = brief?.npcs.find((n) => n.id === 'operador');
    return op?.nombre ?? 'OPERADOR';
  }
}
