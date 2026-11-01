import { crearAdaDron, crearAdaMedusa, crearAdaNoa, crearAdaOrbe, crearAdaZorro } from './modelos/ada';
import type { Modelo } from './modelos/kit';
import { crearPerro, type OpcionesPerro } from './modelos/perro';

// Los compañeros que puede llevar el jugador. Todos son ADA (o la acompañan,
// en el caso de Bruno): siguen, escanean, obedecen la voz, atacan solos y
// tienen una habilidad con recarga. Equilibrar es tocar números aquí.

export type FormaAda = 'dron' | 'zorro' | 'noa' | 'medusa' | 'orbe' | 'bruno';

/** Estilo de Bruno: lo elige el jugador en el selector y se guarda. */
export const estiloBruno: OpcionesPerro = { pajarita: 'cuadros', gorra: false, gafas: false };

export function fijarEstiloBruno(e: Partial<OpcionesPerro>) {
  Object.assign(estiloBruno, e);
}

export type TipoAtaque = 'laser' | 'mordisco' | 'rayo' | 'cadena' | 'aura';
export type TipoHabilidad = 'rafaga' | 'aullido' | 'parche' | 'marea' | 'sobrecarga' | 'ladrido';

export interface PerfilCompanero {
  id: FormaAda;
  nombre: string;
  /** Una línea de quién es, para el selector. */
  quien: string;
  color: string;
  crear?: () => Modelo;
  ataque: {
    tipo: TipoAtaque;
    nombre: string;
    texto: string;
    /** Alcance en metros desde el compañero (desde el jugador en el mordisco). */
    alcance: number;
    dano: number;
    /** Segundos entre ataques. */
    cada: number;
    /** Objetivos por ataque (cadena) o radio del aura. */
    extra?: number;
  };
  habilidad: {
    tipo: TipoHabilidad;
    nombre: string;
    texto: string;
    cada: number;
    radio: number;
    valor: number;
  };
}

export const COMPANEROS: PerfilCompanero[] = [
  {
    id: 'dron', nombre: 'Dron de ADA', color: '#ff8a3d', crear: crearAdaDron,
    quien: 'El inspector de turbina reprogramado de siempre.',
    ataque: { tipo: 'laser', nombre: 'Láser de inspección', texto: 'Dispara al enemigo más cercano.', alcance: 13, dano: 9, cada: 0.9 },
    habilidad: { tipo: 'rafaga', nombre: 'Ráfaga', texto: 'Cinco láseres a la vez a los cinco más cercanos.', cada: 14, radio: 16, valor: 16 },
  },
  {
    id: 'zorro', nombre: 'Zorro de escarcha', color: '#ff8a3d', crear: crearAdaZorro,
    quien: 'Un zorrito hecho con chatarra del traje. ADA late en su pecho.',
    ataque: { tipo: 'mordisco', nombre: 'Mordisco', texto: 'Corre hasta el enemigo más cercano y le muerde.', alcance: 9, dano: 17, cada: 1.1 },
    habilidad: { tipo: 'aullido', nombre: 'Aullido helado', texto: 'Una onda de escarcha que daña y frena a todo lo que hay cerca.', cada: 14, radio: 7.5, valor: 10 },
  },
  {
    id: 'noa', nombre: 'Holograma de Noa', color: '#62d9f7', crear: crearAdaNoa,
    quien: 'La ingeniera que escondió a ADA, o lo que queda de ella.',
    ataque: { tipo: 'rayo', nombre: 'Rayo de datos', texto: 'Un haz continuo contra el enemigo más cercano.', alcance: 15, dano: 5, cada: 0.45 },
    habilidad: { tipo: 'parche', nombre: 'Parche de Noa', texto: 'Repara el traje.', cada: 18, radio: 0, valor: 18 },
  },
  {
    id: 'medusa', nombre: 'Medusa de plasma', color: '#9d7bff', crear: crearAdaMedusa,
    quien: 'Una criatura de luz que flota con ADA dentro.',
    ataque: { tipo: 'cadena', nombre: 'Descarga en cadena', texto: 'Un rayo que salta entre tres enemigos.', alcance: 10, dano: 8, cada: 1.2, extra: 3 },
    habilidad: { tipo: 'marea', nombre: 'Marea', texto: 'Atrae hacia ti toda la chatarra de alrededor.', cada: 15, radio: 30, valor: 0 },
  },
  {
    id: 'orbe', nombre: 'Orbe con anillos', color: '#5ee0ff', crear: crearAdaOrbe,
    quien: 'El núcleo de ADA sin disfraz, con sus anillos de giroscopio.',
    ataque: { tipo: 'aura', nombre: 'Anillos cortantes', texto: 'Daña sin parar a lo que pasa junto al orbe.', alcance: 3.4, dano: 5, cada: 0.35 },
    habilidad: { tipo: 'sobrecarga', nombre: 'Sobrecarga', texto: 'Una explosión alrededor de ti que empuja a la horda.', cada: 16, radio: 7, valor: 32 },
  },
  {
    id: 'bruno', nombre: 'Bruno', color: '#ffd25a', crear: () => crearPerro({ ...estiloBruno }),
    quien: 'El perro del operador. Juega, escarba, patina, se pone sus gafas de sol y no se separa de ti.',
    ataque: { tipo: 'mordisco', nombre: 'Mordisco', texto: 'Corre hasta el enemigo más cercano y le muerde.', alcance: 10, dano: 18, cada: 1.0 },
    habilidad: { tipo: 'ladrido', nombre: '¡Guau!', texto: 'Un ladrido que daña, empuja y asusta a la horda. Además busca chatarra y escarba.', cada: 11, radio: 7, valor: 10 },
  },
];

export function perfilDe(id: string): PerfilCompanero {
  return COMPANEROS.find((c) => c.id === id) ?? COMPANEROS[0];
}

export const esPerro = (id: FormaAda) => id === 'bruno';
