// META SPACE — La nave que arma el jugador: piezas, física y qué pasa al lanzarla.
//
// Datos y funciones puras, sin THREE ni DOM: los usan el juego, el astillero y
// las pruebas. La física es la de verdad, reducida a lo que se ve en pantalla:
// empuje entre peso para despegar y la ecuación de Tsiolkovsky, etapa a etapa,
// para saber si llega. Nada de tiradas: si una nave falla, se puede señalar la
// pieza que lo hizo fallar.

export const RANURAS = ['motores', 'propulsor', 'aletas', 'casco', 'escudo', 'proa'] as const;
export type Ranura = (typeof RANURAS)[number];

export interface DefRanura {
  id: Ranura;
  nombre: string;
  /** El fragmento de esta ranura que se recoge en el mapa. */
  fragmento: string;
  fragmentos: string;
  queHace: string;
  color: string;
}

export const DEF_RANURA: Record<Ranura, DefRanura> = {
  motores: { id: 'motores', nombre: 'Motores', fragmento: 'Tobera', fragmentos: 'Toberas', queHace: 'Empuje y eficacia al despegar.', color: '#ff8a3d' },
  propulsor: { id: 'propulsor', nombre: 'Tanques', fragmento: 'Anillo de tanque', fragmentos: 'Anillos de tanque', queHace: 'El combustible para salir: se sueltan al vaciarse.', color: '#7fd0ff' },
  aletas: { id: 'aletas', nombre: 'Alas', fragmento: 'Trozo de ala', fragmentos: 'Trozos de ala', queHace: 'Control al cruzar la zona de máxima presión.', color: '#b9f27c' },
  casco: { id: 'casco', nombre: 'Casco', fragmento: 'Cuaderna', fragmentos: 'Cuadernas', queHace: 'Lo que llega arriba cuando sueltas los tanques.', color: '#c9d2dc' },
  escudo: { id: 'escudo', nombre: 'Escudo', fragmento: 'Loseta térmica', fragmentos: 'Losetas térmicas', queHace: 'Protege del ácido y el calor del velo.', color: '#ffb0a0' },
  proa: { id: 'proa', nombre: 'Morro', fragmento: 'Aviónica', fragmentos: 'Aviónica', queHace: 'Lo que transmite la firma de ADA.', color: '#5ee0ff' },
};

export interface Pieza {
  id: string;
  ranura: Ranura;
  nombre: string;
  texto: string;
  /** Masa en seco y propelente, en toneladas. */
  masa: number;
  propelente?: number;
  /** Empuje en kilonewtons e impulso específico en segundos. */
  empuje?: number;
  isp?: number;
  /** Puntos que aporta a cada indicador. */
  control?: number;
  blindaje?: number;
  senal?: number;
  /** Lo que cuesta fabricarla. Sin coste, viene de serie. */
  fragmentos?: number;
  chatarra?: number;
  /** Cómo se ve: cada ranura decide qué significa (ver nave-modular.ts). */
  forma: number;
}

export const PIEZAS: readonly Pieza[] = [
  { id: 'motor-rescate', ranura: 'motores', nombre: 'Tres de rescate', texto: 'Tres motores arrancados de naves caídas. Tiran, pero beben mucho.', masa: 12, empuje: 7000, isp: 306, forma: 0 },
  { id: 'motor-nueve', ranura: 'motores', nombre: 'Racimo de nueve', texto: 'Nueve motores de ciclo cerrado: más fuerza y menos sed.', masa: 20, empuje: 10500, isp: 311, fragmentos: 2, chatarra: 150, forma: 1 },
  { id: 'motor-corona', ranura: 'motores', nombre: 'Corona de veintiuno', texto: 'Dos tambores con veintiún motores de metano. Levanta lo que le pongas.', masa: 32, empuje: 17000, isp: 330, fragmentos: 3, chatarra: 380, forma: 2 },

  { id: 'tanque-corto', ranura: 'propulsor', nombre: 'Tanque recuperado', texto: 'Uno solo, soldado con lo que había. Poco combustible.', masa: 30, propelente: 300, forma: 0 },
  { id: 'tanque-largo', ranura: 'propulsor', nombre: 'Tanques gemelos', texto: 'Dos tanques cromados: más combustible, pero la nave pesa más al despegar.', masa: 38, propelente: 420, fragmentos: 1, chatarra: 80, forma: 1 },
  { id: 'tanque-gigante', ranura: 'propulsor', nombre: 'Tanques criogénicos', texto: 'Tres enormes. Sin motores a la altura, no se levanta del suelo.', masa: 46, propelente: 640, fragmentos: 3, chatarra: 300, forma: 2 },

  { id: 'aleta-fija', ranura: 'aletas', nombre: 'Alas cortas', texto: 'Dos chapas soldadas. Estabilizan poco.', masa: 2, control: 35, forma: 0 },
  { id: 'aleta-rejilla', ranura: 'aletas', nombre: 'Alas escalonadas', texto: 'Muerden el aire y guían la nave en la máxima presión.', masa: 3, control: 65, fragmentos: 1, chatarra: 60, forma: 1 },
  { id: 'aleta-titanio', ranura: 'aletas', nombre: 'Doble ala en flecha', texto: 'Más grandes y aguantan el calor sin deformarse.', masa: 3, control: 90, fragmentos: 2, chatarra: 180, forma: 2 },

  { id: 'casco-chapa', ranura: 'casco', nombre: 'Casco de chapa', texto: 'Remendado a toda prisa. Pesa y carga poco.', masa: 14, propelente: 75, isp: 340, blindaje: 10, forma: 0 },
  { id: 'casco-acero', ranura: 'casco', nombre: 'Casco de acero inoxidable', texto: 'Aguanta frío y calor, y lleva más combustible.', masa: 12, propelente: 90, isp: 360, blindaje: 20, fragmentos: 2, chatarra: 120, forma: 1 },
  { id: 'casco-largo', ranura: 'casco', nombre: 'Casco criogénico largo', texto: 'Más largo, con motores de vacío y mucho más combustible propio.', masa: 15, propelente: 140, isp: 378, blindaje: 25, fragmentos: 3, chatarra: 320, forma: 2 },

  { id: 'escudo-nada', ranura: 'escudo', nombre: 'Sin escudo', texto: 'Acero desnudo. El velo se lo come.', masa: 0, forma: 0 },
  { id: 'escudo-parches', ranura: 'escudo', nombre: 'Losetas de rescate', texto: 'Parches de losetas térmicas donde más quema.', masa: 3, blindaje: 40, fragmentos: 1, chatarra: 60, forma: 1 },
  { id: 'escudo-negro', ranura: 'escudo', nombre: 'Escudo negro completo', texto: 'Miles de losetas hexagonales por toda la panza.', masa: 5, blindaje: 75, fragmentos: 2, chatarra: 200, forma: 2 },

  { id: 'proa-chapa', ranura: 'proa', nombre: 'Morro de chapa', texto: 'Tapa la proa y poco más. Casi no transmite.', masa: 1, senal: 25, forma: 0 },
  { id: 'proa-antena', ranura: 'proa', nombre: 'Antena de red profunda', texto: 'Sube la firma de ADA a través del velo.', masa: 1.5, senal: 60, fragmentos: 1, chatarra: 80, forma: 1 },
  { id: 'proa-ada', ranura: 'proa', nombre: 'Cúpula de ADA', texto: 'ADA vuela a bordo: señal perfecta y mejor guiado.', masa: 2.5, senal: 100, control: 10, fragmentos: 2, chatarra: 220, forma: 2 },
];

const POR_ID = new Map(PIEZAS.map((p) => [p.id, p]));
export const pieza = (id: string) => POR_ID.get(id);
export const piezasDe = (r: Ranura) => PIEZAS.filter((p) => p.ranura === r);
/** La pieza de serie de una ranura: la que no cuesta nada. */
export const deSerie = (r: Ranura) => piezasDe(r).find((p) => !p.fragmentos)!;

export type Diseno = Record<Ranura, string>;

export function disenoDeSerie(): Diseno {
  return Object.fromEntries(RANURAS.map((r) => [r, deSerie(r).id])) as Diseno;
}

// ------------------------------------------------------------------- física

const G0 = 9.80665;

/** Lo que el velo exige para que la firma de ADA llegue a HELIOS. */
export const OBJETIVO = { empujePeso: 1.2, deltaV: 9400, control: 50, blindaje: 50, senal: 50 } as const;

/** Ecuación de Tsiolkovsky: velocidad que gana una etapa al quemar su propelente. */
export const tsiolkovsky = (isp: number, llena: number, vacia: number) =>
  (vacia > 0 && llena > vacia ? isp * G0 * Math.log(llena / vacia) : 0);

export interface Estadisticas {
  /** Masa al despegar, en toneladas. */
  masa: number;
  empuje: number;
  empujePeso: number;
  deltaV: number;
  deltaV1: number;
  deltaV2: number;
  control: number;
  blindaje: number;
  senal: number;
}

export function calcular(d: Diseno): Estadisticas {
  const [mot, pro, ale, cas, esc, proa] = RANURAS.map((r) => pieza(d[r]) ?? deSerie(r));
  const segunda = cas.masa + esc.masa + proa.masa + (cas.propelente ?? 0);
  const secaPrimera = mot.masa + pro.masa + ale.masa;
  const masa = segunda + secaPrimera + (pro.propelente ?? 0);
  const deltaV1 = tsiolkovsky(mot.isp ?? 0, masa, masa - (pro.propelente ?? 0));
  const deltaV2 = tsiolkovsky(cas.isp ?? 0, segunda, segunda - (cas.propelente ?? 0));
  const suma = (k: 'control' | 'blindaje' | 'senal') => [mot, pro, ale, cas, esc, proa].reduce((s, p) => s + (p[k] ?? 0), 0);
  return {
    masa,
    empuje: mot.empuje ?? 0,
    empujePeso: (mot.empuje ?? 0) / (masa * G0),
    deltaV: deltaV1 + deltaV2,
    deltaV1,
    deltaV2,
    control: Math.min(100, suma('control')),
    blindaje: Math.min(100, suma('blindaje')),
    senal: Math.min(100, suma('senal')),
  };
}

export type IdIndicador = 'empujePeso' | 'deltaV' | 'control' | 'blindaje' | 'senal';

export interface Indicador {
  id: IdIndicador;
  nombre: string;
  /** Valor ya escrito para la pantalla, con sus unidades. */
  texto: string;
  valor: number;
  minimo: number;
  /** Hasta dónde llega la barra. */
  tope: number;
  ok: boolean;
  /** Qué mira esto y qué pieza lo arregla. */
  ayuda: string;
}

const numero = (n: number) => Math.round(n).toLocaleString('es-ES');

export function indicadores(s: Estadisticas): Indicador[] {
  const fila = (id: IdIndicador, nombre: string, texto: string, tope: number, ayuda: string): Indicador => ({
    id, nombre, texto, valor: s[id], minimo: OBJETIVO[id], tope, ok: s[id] >= OBJETIVO[id], ayuda,
  });
  return [
    fila('empujePeso', 'Empuje / peso', s.empujePeso.toFixed(2), 2.4, 'Por debajo de 1 no se levanta. Más motores o menos peso.'),
    fila('deltaV', 'Velocidad total', `${numero(s.deltaV)} m/s`, 13000, 'Lo que hace falta para salir del velo. Más combustible o motores más eficaces.'),
    fila('control', 'Control', `${s.control} %`, 100, 'Para no perder el rumbo en la máxima presión. Mejores alas.'),
    fila('blindaje', 'Blindaje', `${s.blindaje} %`, 100, 'El velo quema. Mejor escudo o mejor casco.'),
    fila('senal', 'Señal', `${s.senal} %`, 100, 'Para que la firma de ADA llegue a HELIOS. Mejor morro.'),
  ];
}

// ---------------------------------------------------------------- lanzamiento

/** En qué momento del vuelo se acaba, si se acaba. */
export type Fallo = 'plataforma' | 'presion' | 'combustible' | 'velo' | 'firma';

export interface Vuelo {
  exito: boolean;
  fallo: Fallo | null;
  titulo: string;
  /** La pieza o el dato que lo decidió. */
  motivo: string;
  /** De 1 a 3 según el margen que sobra. Cero si falla. */
  estrellas: number;
}

export function resolverVuelo(s: Estadisticas): Vuelo {
  const mal = (fallo: Fallo, titulo: string, motivo: string): Vuelo => ({ exito: false, fallo, titulo, motivo, estrellas: 0 });
  if (s.empujePeso < OBJETIVO.empujePeso) {
    return mal('plataforma', 'No se levantó', `Empuje entre peso de ${s.empujePeso.toFixed(2)}: la nave pesa demasiado para sus motores.`);
  }
  if (s.control < OBJETIVO.control) {
    return mal('presion', 'Se partió en la máxima presión', `Con ${s.control} % de control, las alas no la mantuvieron recta.`);
  }
  if (s.deltaV < OBJETIVO.deltaV) {
    return mal('combustible', 'Se quedó sin combustible', `Llegó a ${numero(s.deltaV)} m/s de los ${numero(OBJETIVO.deltaV)} que hacen falta.`);
  }
  if (s.blindaje < OBJETIVO.blindaje) {
    return mal('velo', 'El velo la devoró', `Con ${s.blindaje} % de blindaje, el ácido y el calor deshicieron el casco.`);
  }
  if (s.senal < OBJETIVO.senal) {
    return mal('firma', 'La firma no llegó', `Cruzó el velo, pero con ${s.senal} % de señal HELIOS no recibió la orden.`);
  }
  const margen = Math.min(s.deltaV / OBJETIVO.deltaV - 1, s.empujePeso / OBJETIVO.empujePeso - 1);
  const notas = [s.control, s.blindaje, s.senal].filter((v) => v >= 75).length;
  const estrellas = margen >= 0.08 && notas >= 2 ? 3 : margen >= 0.03 || notas >= 2 ? 2 : 1;
  return { exito: true, fallo: null, titulo: 'Velo abierto', motivo: 'La nave cruzó el velo y la firma de ADA llegó a HELIOS.', estrellas };
}

// -------------------------------------------------------------------- hangar

/** Lo que se guarda entre partidas. */
export interface Hangar {
  fragmentos: Record<Ranura, number>;
  /** Piezas ya fabricadas, además de las de serie. */
  fabricadas: string[];
  montadas: Diseno;
}

export function hangarVacio(): Hangar {
  return { fragmentos: Object.fromEntries(RANURAS.map((r) => [r, 0])) as Record<Ranura, number>, fabricadas: [], montadas: disenoDeSerie() };
}

/** Un guardado viejo o tocado a mano nunca debe romper el astillero. */
export function normalizarHangar(crudo: unknown): Hangar {
  const base = hangarVacio();
  if (!crudo || typeof crudo !== 'object') return base;
  const c = crudo as Partial<Hangar>;
  const fabricadas = Array.isArray(c.fabricadas) ? c.fabricadas.filter((id) => pieza(id)?.fragmentos) : [];
  for (const r of RANURAS) {
    const n = Number(c.fragmentos?.[r]);
    if (Number.isFinite(n) && n > 0) base.fragmentos[r] = Math.floor(n);
    const m = c.montadas?.[r];
    const p = m ? pieza(m) : undefined;
    if (p && p.ranura === r && (!p.fragmentos || fabricadas.includes(p.id))) base.montadas[r] = p.id;
  }
  return { ...base, fabricadas };
}

export const fabricada = (h: Hangar, p: Pieza) => !p.fragmentos || h.fabricadas.includes(p.id);

/** ¿Se puede fabricar con lo que hay? Devuelve lo que falta, o null si se puede. */
export function faltaPara(h: Hangar, p: Pieza, chatarra: number): string | null {
  if ((p.fragmentos ?? 0) > h.fragmentos[p.ranura]) {
    const d = DEF_RANURA[p.ranura];
    const n = (p.fragmentos ?? 0) - h.fragmentos[p.ranura];
    return `Faltan ${n} ${n === 1 ? d.fragmento.toLowerCase() : d.fragmentos.toLowerCase()}`;
  }
  if ((p.chatarra ?? 0) > chatarra) return `Faltan ${Math.ceil((p.chatarra ?? 0) - chatarra)} de chatarra`;
  return null;
}

/** Gasta fragmentos, deja la pieza fabricada y la monta. Devuelve la chatarra gastada. */
export function fabricar(h: Hangar, p: Pieza): number {
  h.fragmentos[p.ranura] -= p.fragmentos ?? 0;
  h.fabricadas.push(p.id);
  h.montadas[p.ranura] = p.id;
  return p.chatarra ?? 0;
}
