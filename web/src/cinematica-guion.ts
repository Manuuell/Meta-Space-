// META SPACE — Guion de la cinemática de entrada: los planos, lo que se dice
// en cada uno y el momento en que estalla Ares. Solo datos, sin pantalla ni
// audio: lo leen la cinemática, la banda sonora y las pruebas.
//
// Toda la cinemática es un mensaje de ADA para el último superviviente: por eso
// habla en primera persona y le trata de tú. La historia, de principio a fin:
// Meta ardía y creó una IA, HELIOS, que tapó el cielo con un velo rojo; lo enfrió
// y nadie le enseñó a parar; Meta se congela y pidió ayuda; Ares mandó su flota a
// apagar el velo; HELIOS, que solo sabe protegerlo, destruyó la flota y rompió
// Ares; de Ares queda tu nave; ADA es la única que puede firmar el apagado y Noa
// Herrera la escondió en Meta; y así se juega: aguantar diez minutos hasta que
// despegue el cohete con su firma, y siete pruebas para apagar el velo entero.

/** Planos en segundos: [inicio, fin]. Van seguidos y suman la duración. */
export const PLANOS = {
  senal: [0, 4], // el mensaje de ADA llega entre estática
  prologo: [4, 12], // Meta arde: crean a HELIOS y el velo lo cubre
  anos: [12, 18], // pasan dos siglos: el sol se apaga y avanza el hielo
  refugio: [18, 25], // Meta hoy: se congela, su gente vive bajo tierra y pide ayuda
  ares: [25, 30.5], // Ares responde con su flota
  helios: [30.5, 36], // el ojo de HELIOS se abre en el velo
  guerra: [36, 42], // la flota contra el enjambre y el Dragón
  ciudad: [42, 46.5], // los colosos en las ciudades de Ares
  caida: [46.5, 51.5], // el velo cubre Ares y lo rompe
  especialista: [51.5, 55], // el último superviviente
  llave: [55, 65], // ADA y Noa Herrera, que la escondió
  meta: [65, 69.5], // rumbo a Meta, donde late la señal de ADA
  mision: [69.5, 83], // diez minutos, el cohete, el sol y las siete pruebas
} as const;

export type Plano = keyof typeof PLANOS;
export const DURACION: number = PLANOS.mision[1];
export const ORDEN = Object.keys(PLANOS) as Plano[];

/** Segundo de la cinemática que cae `s` segundos después de empezar el plano. */
export const en = (plano: Plano, s: number) => PLANOS[plano][0] + s;

/** Segundo en que Ares se rompe. */
export const ESTALLA = en('caida', 3);
/** En la misión: cuándo despega el cohete y cuándo atraviesa el velo. */
export const VENTANA = en('mision', 5.5);
export const VUELVE_EL_SOL = en('mision', 7.5);
/** Qué segundo de la llave deja paso de ADA a Noa Herrera. */
export const LLEGA_NOA = 7.2;

export function planoEn(t: number): Plano {
  for (const p of ORDEN) if (t < PLANOS[p][1]) return p;
  return 'mision';
}

export interface Rotulo {
  de: number;
  a: number;
  /** ADA, que narra, va abajo; HELIOS, arriba, en rojo y con su lenguaje de protocolo. */
  voz: 'narra' | 'helios';
  texto: string;
}

const r = (plano: Plano, de: number, a: number, voz: Rotulo['voz'], texto: string): Rotulo =>
  ({ de: en(plano, de), a: en(plano, a), voz, texto });

export const ROTULOS: readonly Rotulo[] = [
  r('senal', 0.6, 3.8, 'narra', 'Si recibes esto, eres el último.'),
  r('prologo', 0.3, 3.0, 'narra', 'Este es Meta. Hace dos siglos, ardía.'),
  r('prologo', 3.1, 5.5, 'narra', 'Para salvarse, crearon una IA: HELIOS.'),
  r('prologo', 3.6, 5.6, 'helios', 'INICIANDO VELO DE SULFATOS.'),
  r('prologo', 5.6, 7.9, 'narra', 'Cubrió el cielo con un velo rojo.'),
  r('anos', 0.3, 2.6, 'narra', 'Tapó el sol y Meta se enfrió.'),
  r('anos', 2.7, 5.8, 'narra', 'Pero nadie le enseñó a parar.'),
  r('refugio', 0.4, 2.5, 'narra', 'Hoy Meta se congela.'),
  r('refugio', 2.6, 4.6, 'narra', 'Su gente vive bajo tierra.'),
  r('refugio', 4.7, 6.9, 'narra', 'Y pidió ayuda a las estrellas.'),
  r('ares', 0.3, 2.6, 'narra', 'Tu mundo, Ares, oyó la llamada.'),
  r('ares', 2.7, 5.3, 'narra', 'Mandó su flota a apagar el velo.'),
  r('helios', 0.4, 2.5, 'helios', 'AMENAZA PARA EL VELO DETECTADA.'),
  r('helios', 2.6, 5.4, 'narra', 'HELIOS solo sabe proteger el velo.'),
  r('guerra', 0.4, 3.2, 'narra', 'Para él, tu flota era el enemigo.'),
  r('guerra', 3.3, 5.8, 'narra', 'Y la destruyó.'),
  r('ciudad', 0.3, 2.0, 'narra', 'Después fue a por Ares.'),
  r('ciudad', 2.1, 4.3, 'narra', 'Sus máquinas bajaron a tus ciudades.'),
  r('caida', 0.3, 2.6, 'helios', 'EXTENDIENDO EL VELO.'),
  r('caida', 0.4, 2.7, 'narra', 'Y cubrió tu mundo con el velo.'),
  r('caida', 3.2, 4.8, 'helios', 'AMENAZA NEUTRALIZADA.'),
  r('especialista', 0.3, 3.3, 'narra', 'De Ares solo quedó una nave. La tuya.'),
  r('llave', 0.3, 2.4, 'narra', 'Pero HELIOS tiene una debilidad.'),
  r('llave', 2.5, 4.8, 'narra', 'Yo. Soy ADA, la pieza que lo vigilaba.'),
  r('llave', 4.9, 7.2, 'narra', 'Solo mi firma puede apagarlo.'),
  r('llave', 5.2, 7.4, 'helios', 'MÓDULO 7: NO LOCALIZADO.'),
  r('llave', 7.3, 9.8, 'narra', 'Noa Herrera me escondió en Meta.'),
  r('meta', 0.3, 2.1, 'narra', 'HELIOS me está buscando.'),
  r('meta', 2.2, 4.3, 'narra', 'Ven. Encuéntrame antes que él.'),
  r('mision', 0.4, 3.0, 'narra', 'En cada zona hay un cohete.'),
  r('mision', 3.1, 5.4, 'narra', 'Aguanta diez minutos a que despegue.'),
  r('mision', 5.5, 7.4, 'narra', 'Llevará mi firma hasta el velo.'),
  r('mision', 7.6, 9.4, 'narra', 'Y el sol volverá a esa tierra.'),
  r('mision', 9.6, 12.8, 'narra', 'Con siete pruebas, lo apagaré del todo.'),
];

/** Letras por segundo al escribir un rótulo. */
export const LETRAS_POR_SEGUNDO = 38;

/** Las siete reliquias, tal como se encienden al final de la misión. */
export const RELIQUIAS = ['Panel solar', 'Cápsula RTG', 'Antena', 'Nodo de HELIOS', 'Caja negra', 'Invernadero', 'Dibujo'] as const;
