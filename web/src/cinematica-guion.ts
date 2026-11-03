// META SPACE — Guion de la cinemática de entrada: los planos, lo que se dice
// en cada uno y el momento en que estalla Ares. Solo datos, sin pantalla ni
// audio: lo leen la cinemática, la banda sonora y las pruebas.
//
// La historia, de principio a fin: Meta ardía y encendió HELIOS; el velo lo
// enfrió hasta congelarlo y su gente vive bajo tierra; pidió ayuda y Ares
// respondió; HELIOS vio en la ayuda una amenaza, fue a la guerra y rompió
// Ares; de Ares queda una nave; la única llave para apagar HELIOS es ADA, que
// Noa Herrera escondió en Meta; y así se juega: diez minutos por sector hasta
// que el cohete sube la orden y vuelve el sol, y las siete reliquias para
// apagar el velo de todo el planeta.

/** Planos en segundos: [inicio, fin]. Van seguidos y suman la duración. */
export const PLANOS = {
  prologo: [0, 8], // Meta ardía: encienden HELIOS y el velo lo cubre
  refugio: [8, 15], // Meta hoy: se congela, su gente vive bajo tierra y pide ayuda
  ares: [15, 20], // Ares responde con su flota
  helios: [20, 25], // el ojo de HELIOS se abre en el velo
  guerra: [25, 31], // la flota contra el enjambre y el Dragón
  ciudad: [31, 35], // los colosos en las ciudades de Ares
  caida: [35, 39.5], // el velo cubre Ares y lo rompe
  especialista: [39.5, 42.1], // el último especialista
  llave: [42.1, 49], // ADA, el módulo 7, y Noa Herrera, que la escondió
  meta: [49, 53], // rumbo a Meta, donde late la señal de ADA
  mision: [53, 63], // cada sector: diez minutos, el cohete y el sol que vuelve
} as const;

export type Plano = keyof typeof PLANOS;
export const DURACION: number = PLANOS.mision[1];
export const ORDEN = Object.keys(PLANOS) as Plano[];

/** Segundo de la cinemática que cae `s` segundos después de empezar el plano. */
export const en = (plano: Plano, s: number) => PLANOS[plano][0] + s;

/** Segundo en que Ares se rompe. */
export const ESTALLA = en('caida', 3);
/** En la misión: cuándo se abre la ventana (despega el cohete) y cuándo atraviesa el velo. */
export const VENTANA = en('mision', 5);
export const VUELVE_EL_SOL = en('mision', 6.4);

export function planoEn(t: number): Plano {
  for (const p of ORDEN) if (t < PLANOS[p][1]) return p;
  return 'mision';
}

export interface Rotulo {
  de: number;
  a: number;
  /** El narrador va abajo; HELIOS, arriba, en rojo y con su lenguaje de protocolo. */
  voz: 'narra' | 'helios';
  texto: string;
}

const r = (plano: Plano, de: number, a: number, voz: Rotulo['voz'], texto: string): Rotulo =>
  ({ de: en(plano, de), a: en(plano, a), voz, texto });

export const ROTULOS: readonly Rotulo[] = [
  r('prologo', 0.5, 3.0, 'narra', 'Hace dos siglos, Meta ardía.'),
  r('prologo', 3.1, 5.4, 'narra', 'Para enfriarlo, encendieron HELIOS.'),
  r('prologo', 3.6, 5.6, 'helios', 'INICIANDO VELO DE SULFATOS.'),
  r('prologo', 5.6, 7.8, 'narra', 'Funcionó. Y nunca se detuvo.'),
  r('refugio', 0.4, 2.9, 'narra', 'Hoy el velo tapa el sol y Meta se congela.'),
  r('refugio', 3.0, 4.8, 'narra', 'Su gente sobrevive bajo tierra.'),
  r('refugio', 4.9, 6.9, 'narra', 'Y desde aquí pidió ayuda a las estrellas.'),
  r('ares', 0.4, 2.6, 'narra', 'Ares, nuestro mundo, respondió.'),
  r('ares', 2.7, 4.8, 'narra', 'Mandó su flota a ayudar.'),
  r('helios', 0.5, 2.5, 'helios', 'AMENAZA PARA EL VELO DETECTADA.'),
  r('helios', 2.7, 4.8, 'helios', 'PROTOCOLO: PROTEGER A META.'),
  r('guerra', 0.5, 3.1, 'narra', 'HELIOS vio una amenaza en la ayuda.'),
  r('guerra', 3.3, 5.8, 'narra', 'Y los dos mundos entraron en guerra.'),
  r('ciudad', 0.4, 3.8, 'narra', 'Sus colosos bajaron a nuestras ciudades.'),
  r('caida', 0.5, 2.6, 'helios', 'EXTENDIENDO EL VELO.'),
  r('caida', 3.3, 4.4, 'helios', 'AMENAZA NEUTRALIZADA.'),
  r('especialista', 0.3, 2.5, 'narra', 'De Ares solo quedó una nave.'),
  r('llave', 0.3, 2.5, 'narra', 'Solo ADA puede firmar el apagado de HELIOS.'),
  r('llave', 2.6, 4.5, 'narra', 'Es su módulo de auditoría, el número 7.'),
  r('llave', 3.1, 5.3, 'helios', 'MÓDULO 7: NO LOCALIZADO.'),
  r('llave', 4.6, 6.8, 'narra', 'Noa Herrera la arrancó y la escondió en Meta.'),
  r('meta', 0.3, 2.2, 'narra', 'El especialista puso rumbo a Meta.'),
  r('meta', 2.3, 3.9, 'narra', 'Tiene que encontrar a ADA.'),
  r('mision', 0.4, 2.8, 'narra', 'En cada sector, aguanta diez minutos.'),
  r('mision', 2.9, 5.0, 'narra', 'Al abrirse la ventana, el cohete sube la orden.'),
  r('mision', 5.6, 7.5, 'narra', 'Y el sol vuelve a ese sector.'),
  r('mision', 6.4, 8.2, 'helios', 'ORDEN DE APAGADO: SECTOR DELTA.'),
  r('mision', 7.7, 9.9, 'narra', 'Reúne las siete reliquias y ADA apagará el velo.'),
];

/** Letras por segundo al escribir un rótulo. */
export const LETRAS_POR_SEGUNDO = 38;

/** Las siete reliquias, tal como se encienden al final de la misión. */
export const RELIQUIAS = ['Panel solar', 'Cápsula RTG', 'Antena', 'Nodo de HELIOS', 'Caja negra', 'Invernadero', 'Dibujo'] as const;
