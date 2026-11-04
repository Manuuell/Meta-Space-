import { fichaDe, type Forma, type Interlocutor } from './contenido/fichas';
import {
  MAX_HISTORIAL, MAX_RECUERDOS, MAX_TEXTO_JUGADOR, sacarFrases, textoPartida, turnoLocal,
  type DatosPartida, type MensajeChat, type ModoCharla, type Turno,
} from './conversacion';
import { pedirTurno } from './npcs';
import { abrirVistaChat, type VistaChat } from './ui-chat';

// Lleva las conversaciones de una partida: lo que se ha dicho con cada uno y el
// turno en curso. Se habla de dos formas con la misma memoria: en voz alta y sin
// parar la partida (`hablar`), o en la ventana de texto (`abrir`). Lo que toca
// la partida (el estado, las acciones, el micrófono) lo pone game.ts.

export interface ResultadoAccion {
  texto: string;
  bien: boolean;
}

export interface PuenteCharlas {
  datos(quien: Interlocutor): DatosPartida;
  /** El cuerpo en el que va ADA ahora. */
  forma(): Forma;
  saludo(quien: Interlocutor): string;
  /** Lo que se está diciendo en voz alta, en el subtítulo de la partida. */
  subtitular(quien: Interlocutor, texto: string, final: boolean): void;
  avisar(quien: Interlocutor, texto: string): void;
  /** Valida y aplica la acción del turno. Null si no había ninguna. */
  aplicar(quien: Interlocutor, turno: Turno): ResultadoAccion | null;
  reaccionar(quien: Interlocutor, turno: Turno): void;
  /** Añade una frase a lo que esté diciendo el personaje. */
  decir(quien: Interlocutor, texto: string): void;
  callar(): void;
  escuchar(): Promise<string | null>;
  dejarDeEscuchar(): void;
  alCerrar(): void;
}

interface Charla {
  mensajes: MensajeChat[];
  recuerdos: string[];
}

/** Por dónde sale la respuesta: la ventana o el subtítulo. */
interface Salida {
  escribir(texto: string): void;
  terminar(texto: string): void;
  aviso(texto: string, bien: boolean): void;
}

export class Charlas {
  /** Si los personajes hablan en voz alta (el botón del altavoz). */
  voz = true;
  private puente: PuenteCharlas;
  private charlas = new Map<Interlocutor, Charla>();
  private vista: VistaChat | null = null;
  private corte: AbortController | null = null;
  private ocupada = false;
  private escuchando = false;
  private avisadoSinIa = false;
  private actual: Interlocutor | null = null;

  constructor(puente: PuenteCharlas) {
    this.puente = puente;
  }

  /** Con quién se está hablando ahora. */
  get interlocutor() {
    return this.actual;
  }

  /** Cada partida empieza de cero. */
  reset() {
    this.interrumpir();
    this.charlas.clear();
    this.avisadoSinIa = false;
  }

  /** Corta el turno en curso y lo que se esté diciendo. */
  interrumpir() {
    this.corte?.abort();
    this.corte = null;
    this.puente.callar();
  }

  private charlaDe(quien: Interlocutor): Charla {
    let charla = this.charlas.get(quien);
    if (!charla) {
      charla = { mensajes: [{ de: 'personaje', texto: this.puente.saludo(quien) }], recuerdos: [] };
      this.charlas.set(quien, charla);
    }
    return charla;
  }

  /** Una frase dicha en voz alta: la partida sigue mientras responde. */
  hablar(quien: Interlocutor, texto: string) {
    void this.turno(quien, texto, 'voz', {
      escribir: (t) => this.puente.subtitular(quien, t, false),
      terminar: (t) => this.puente.subtitular(quien, t, true),
      aviso: (t) => this.puente.avisar(quien, t),
    });
  }

  /** La ventana de texto, para quien no tenga micrófono o quiera repasar. */
  abrir(quien: Interlocutor, primero?: string) {
    this.interrumpir();
    this.actual = quien;
    const f = fichaDe(quien, this.puente.forma());
    this.vista = abrirVistaChat({
      nombre: f.nombre,
      rol: f.rol,
      color: f.color,
      sugerencias: f.sugerencias,
      historial: this.charlaDe(quien).mensajes,
      voz: this.voz,
      alEnviar: (t) => { void this.enviar(t); },
      alCerrar: () => this.cerrar(),
      alMicrofono: () => { void this.microfono(); },
      alCambiarVoz: (activa) => {
        this.voz = activa;
        if (!activa) this.puente.callar();
      },
    });
    if (primero) void this.enviar(primero);
  }

  cerrar() {
    if (!this.vista) return;
    this.interrumpir();
    this.vista.quitar();
    this.vista = null;
    this.actual = null;
    this.ocupada = false;
    this.escuchando = false;
    this.puente.dejarDeEscuchar();
    this.puente.alCerrar();
  }

  private async enviar(texto: string) {
    const t = texto.trim();
    const quien = this.actual, vista = this.vista;
    if (!t || !quien || !vista || this.ocupada) return;
    this.ocupada = true;
    vista.ocupada(true);
    vista.jugador(t);
    const hecho = await this.turno(quien, t, 'texto', { ...vista.respuesta(), aviso: (a, bien) => vista.aviso(a, bien) });
    if (!hecho) return;
    this.ocupada = false;
    vista.ocupada(false);
  }

  /** Un turno completo. Devuelve false si se interrumpió antes de acabar. */
  private async turno(quien: Interlocutor, texto: string, modo: ModoCharla, salida: Salida): Promise<boolean> {
    const t = texto.trim().slice(0, MAX_TEXTO_JUGADOR);
    const charla = this.charlaDe(quien);
    this.interrumpir();
    const corte = new AbortController();
    this.corte = corte;
    const datos = this.puente.datos(quien);
    const forma = this.puente.forma();

    // La voz arranca con la primera frase completa, sin esperar al resto.
    let dicho = 0;
    let pendiente = '';
    const conIa = await pedirTurno({
      quien,
      forma,
      texto: t,
      modo,
      historial: charla.mensajes.slice(-MAX_HISTORIAL),
      partida: textoPartida(datos, quien),
      recuerdos: charla.recuerdos,
    }, (escrito) => {
      salida.escribir(escrito);
      const { frases, resto } = sacarFrases(escrito.slice(dicho));
      dicho = escrito.length - resto.length;
      pendiente = resto;
      if (this.voz) for (const frase of frases) this.puente.decir(quien, frase);
    }, corte.signal);
    // Se interrumpió mientras esperaba: el turno no llegó a pasar.
    if (corte.signal.aborted) return false;

    const turno = conIa ?? turnoLocal(quien, t, datos, forma);
    salida.terminar(turno.linea);
    if (this.voz) this.puente.decir(quien, dicho ? pendiente : turno.linea);
    charla.mensajes.push({ de: 'jugador', texto: t }, { de: 'personaje', texto: turno.linea });
    if (turno.recuerdo) charla.recuerdos = [...charla.recuerdos, turno.recuerdo].slice(-MAX_RECUERDOS);

    const resultado = this.puente.aplicar(quien, turno);
    if (resultado) salida.aviso(resultado.texto, resultado.bien);
    if (!conIa && !this.avisadoSinIa) {
      this.avisadoSinIa = true;
      salida.aviso('Sin conexión con la IA: responde el guion local.', false);
    }
    this.puente.reaccionar(quien, turno);
    return true;
  }

  private async microfono() {
    if (this.escuchando) {
      this.puente.dejarDeEscuchar();
      return;
    }
    if (!this.vista || this.ocupada) return;
    this.escuchando = true;
    this.vista.escuchando(true);
    const texto = await this.puente.escuchar();
    this.escuchando = false;
    this.vista?.escuchando(false);
    if (texto) void this.enviar(texto);
  }
}
