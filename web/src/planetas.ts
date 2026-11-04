// META SPACE — Cada partida, un sector distinto de Meta.
//
// El velo de HELIOS no cayó igual en todas partes: donde cerró antes hay hielo,
// donde reventó la corteza hay lava, donde nadie volvió crecen esporas. Con una
// semilla se saca un sector entero: bioma, relieve, clima, una regla que cambia
// cómo se juega, la fauna que manda ahí, qué jefes y qué gente hay y qué tipo de
// objetos se encuentran. La misma semilla da siempre el mismo sector.
//
// Datos y funciones puras, sin THREE ni DOM: los usan el mundo, el director, el
// contenido y el escáner orbital, y las pruebas los leen en Node.

import type { EnemyId } from './data.ts';

export type BiomaId = 'velo' | 'escarcha' | 'ceniza' | 'esporas' | 'salinas' | 'cristal' | 'chatarra' | 'oasis';
export type EstiloRelieve = 'lomas' | 'dunas' | 'mesetas' | 'crateres';
export type TipoArbol = 'muerto' | 'seta' | 'palma' | 'pilar' | 'antena';
/** Las familias de objetos que un sector tiende a dar (ver objetos.ts). */
export type Familia = 'fuego' | 'hielo' | 'veneno' | 'rayo' | 'cristal' | 'metal' | 'vida' | 'gravedad';
export type RasgoFauna = 'ninguno' | 'volatil' | 'gelido' | 'toxico' | 'blindado' | 'enjambre' | 'veloz' | 'regenerativo';
export type ParticulaClima = 'nieve' | 'ceniza' | 'lluvia' | 'esporas' | 'polvo' | 'chispas' | null;

export interface Fluido {
  nombre: string;
  /** Hondo, medio, cresta de ola y espuma de la orilla. */
  colores: readonly [string, string, string, string];
  /** Daño respecto al ácido (0 no hace daño). */
  dano: number;
  /** Qué parte de la velocidad se conserva al cruzarlo. */
  avance: number;
  /** Cuánto se hunde quien lo cruza (negativo: se anda por encima). */
  vadeo: number;
  burbujas: boolean;
  vapor: boolean;
}

export interface Bioma {
  id: BiomaId;
  nombre: string;
  /** Una línea para el escáner. */
  descripcion: string;
  /** Cómo llega a ser así: lo que cuenta ADA al aterrizar. */
  aterrizaje: string;
  /** Más alto, más veces sale. */
  peso: number;
  cielo: { horizonte: string; medio: string; cenit: string; nube: string; sol: string };
  niebla: readonly [number, number];
  luz: { cielo: string; suelo: string; ambiente: number; sol: string; fuerza: number };
  suelo: {
    arena: string; duna: string; valle: string; helada: string; grava: string; manchado: string;
    losa: string; roca: string; rocaAlta: string; cumbre: string; quemado: string; lejos: string;
  };
  montes: { cerca: string; lejos: string; nieve: string; aguja: string };
  fluido: Fluido;
  props: {
    arbol: TipoArbol;
    colorArbol: readonly [string, string];
    rocas: readonly [string, string];
    /** Color de la capa que cubre las rocas, si la hay. */
    capa: string | null;
    cristal: readonly [string, string];
    mata: readonly [string, string];
    hormigon: readonly string[];
    densidad: { rocas: number; arboles: number; cristales: number; matas: number };
  };
  /** Cuánto del color de la orilla tiñe todo el suelo. */
  tinteSuelo: number;
  /** Qué parte del llano es hielo. 0,62 es poco; 0,4 casi todo. */
  hielo: number;
  relieve: {
    estilos: readonly EstiloRelieve[];
    lomas: readonly [number, number];
    macizos: readonly [number, number];
    lagos: readonly [number, number];
    barrios: readonly [number, number];
    picos: number;
  };
  climas: readonly ClimaId[];
  /** Pesos de la fauna propia del bioma (lo que no sale, casi no aparece). */
  fauna: Partial<Record<EnemyId, number>>;
  rasgos: readonly RasgoFauna[];
  familias: readonly Familia[];
  lugares: { montes: readonly string[]; lagos: readonly string[]; barrios: readonly string[] };
}

const BIOMAS_LISTA: readonly Bioma[] = [
  {
    id: 'velo', nombre: 'Yermo del velo', peso: 3,
    descripcion: 'Dunas rojizas y mares de ácido bajo el velo.',
    aterrizaje: 'Es el Meta que recuerdo: dunas, ácido y un sol que no llega a calentar.',
    cielo: { horizonte: '#df8a6a', medio: '#a8445a', cenit: '#3a1530', nube: '#ffd8c8', sol: '#fff0d8' },
    niebla: [70, 330],
    luz: { cielo: '#ffd0b4', suelo: '#3a2a5e', ambiente: 1.5, sol: '#ffcfa0', fuerza: 2.6 },
    suelo: {
      arena: '#dba57c', duna: '#f0c69c', valle: '#b67e68', helada: '#cdbfd6', grava: '#7e6070', manchado: '#5c2e66',
      losa: '#9a8274', roca: '#5c3e60', rocaAlta: '#3e2c50', cumbre: '#ece6f2', quemado: '#4a3040', lejos: '#7a3a46',
    },
    montes: { cerca: '#8a4250', lejos: '#a8566a', nieve: '#e8c8d4', aguja: '#3a2236' },
    fluido: { nombre: 'ácido', colores: ['#290a45', '#7329c2', '#c77dff', '#f2ccff'], dano: 1, avance: 0.6, vadeo: 0.7, burbujas: true, vapor: true },
    props: {
      arbol: 'muerto', colorArbol: ['#4a3230', '#e6e0ee'], rocas: ['#6a4a4e', '#7a5a58'], capa: '#e6e0ee',
      cristal: ['#7329c2', '#c77dff'], mata: ['#9a6a5a', '#8a6a78'], hormigon: ['#8a8288', '#76707e', '#968c8a'],
      densidad: { rocas: 140, arboles: 65, cristales: 36, matas: 160 },
    },
    tinteSuelo: 0.66,
    hielo: 0.62,
    relieve: { estilos: ['lomas', 'dunas'], lomas: [6, 8], macizos: [2, 3], lagos: [1, 2], barrios: [2, 3], picos: 1 },
    climas: ['calma', 'polvo', 'neblina', 'lluviaAcida'],
    fauna: { saltador: 1, avispa: 1, caparazon: 1, sembrador: 1 },
    rasgos: ['ninguno', 'ninguno', 'veloz'],
    familias: ['veneno', 'rayo', 'metal'],
    lugares: {
      montes: ['Sierra de Escarcha', 'Picos del Velo', 'Colmillo', 'Las Tres Hermanas'],
      lagos: ['Mar de HELIOS', 'Charca del Este', 'Cuenco Púrpura'],
      barrios: ['Puerto viejo', 'Barrio del Observatorio', 'Mercado de Meridia', 'Alta Meridia'],
    },
  },
  {
    id: 'escarcha', nombre: 'Glaciar de Meta', peso: 2,
    descripcion: 'Hielo hasta el horizonte. Los lagos se cruzan andando.',
    aterrizaje: 'Aquí el velo cerró primero. Todo esto era mar. Cuidado al frenar: el suelo resbala.',
    cielo: { horizonte: '#cfe6f2', medio: '#7fb2d8', cenit: '#27406e', nube: '#ffffff', sol: '#ffffff' },
    niebla: [60, 300],
    luz: { cielo: '#dff2ff', suelo: '#3a5a8a', ambiente: 1.6, sol: '#fff4e0', fuerza: 2.4 },
    suelo: {
      arena: '#dfe9f2', duna: '#f7fbff', valle: '#a9c4dc', helada: '#ffffff', grava: '#8aa0b8', manchado: '#7fd4e6',
      losa: '#9fb0c0', roca: '#4f6a8e', rocaAlta: '#34466e', cumbre: '#ffffff', quemado: '#3c4660', lejos: '#7f9fc0',
    },
    montes: { cerca: '#6d8fb5', lejos: '#95b4d2', nieve: '#f4fbff', aguja: '#22304e' },
    fluido: { nombre: 'lago helado', colores: ['#3f86b8', '#78c0e6', '#c4ecff', '#ffffff'], dano: 0, avance: 1, vadeo: -0.05, burbujas: false, vapor: false },
    props: {
      arbol: 'pilar', colorArbol: ['#a8d8f0', '#f0fbff'], rocas: ['#5f7c9e', '#7f9cbc'], capa: '#ffffff',
      cristal: ['#5fb4e0', '#c0f0ff'], mata: ['#c0d8e8', '#a0c0d8'], hormigon: ['#a0b0c0', '#8aa0b4', '#b4c0cc'],
      densidad: { rocas: 110, arboles: 80, cristales: 60, matas: 60 },
    },
    tinteSuelo: 0,
    hielo: 0.42,
    relieve: { estilos: ['lomas', 'mesetas'], lomas: [5, 9], macizos: [3, 4], lagos: [2, 3], barrios: [1, 2], picos: 1.2 },
    climas: ['ventisca', 'calma', 'neblina'],
    fauna: { saltador: 1.4, caparazon: 1.4, sembrador: 0.3 },
    rasgos: ['gelido', 'gelido', 'blindado'],
    familias: ['hielo', 'cristal', 'gravedad'],
    lugares: {
      montes: ['Colmillos Blancos', 'Morrena Alta', 'Cuerno de Hielo', 'La Pared'],
      lagos: ['Mar Dormido', 'Espejo de Noa', 'Lago Quieto'],
      barrios: ['Base Polar', 'Estación Boreal', 'Refugio Ártico'],
    },
  },
  {
    id: 'ceniza', nombre: 'Tierra de ceniza', peso: 2,
    descripcion: 'Roca negra, cráteres y ríos de lava. La lava duele el doble.',
    aterrizaje: 'Las bombas de sulfato abrieron la corteza. Si pisas lo naranja, sal corriendo.',
    cielo: { horizonte: '#8a4630', medio: '#3a1a1e', cenit: '#120a12', nube: '#5a3a38', sol: '#ffb070' },
    niebla: [50, 240],
    luz: { cielo: '#ffb080', suelo: '#2a1430', ambiente: 1.25, sol: '#ff9a60', fuerza: 2.3 },
    suelo: {
      arena: '#4a4248', duna: '#5e5458', valle: '#332c34', helada: '#6e5a58', grava: '#2a2428', manchado: '#ff6a2a',
      losa: '#5a4e4c', roca: '#2a2228', rocaAlta: '#1a141c', cumbre: '#6a5a58', quemado: '#1a1014', lejos: '#2a1618',
    },
    montes: { cerca: '#2e1c20', lejos: '#4a2a2c', nieve: '#ff7a3a', aguja: '#120a10' },
    fluido: { nombre: 'lava', colores: ['#8a1a00', '#ff4a10', '#ffc83a', '#fff0a0'], dano: 2, avance: 0.5, vadeo: 0.5, burbujas: true, vapor: true },
    props: {
      arbol: 'muerto', colorArbol: ['#1e1618', '#ff7a3a'], rocas: ['#2e282e', '#3e343a'], capa: null,
      cristal: ['#a02a10', '#ff8a30'], mata: ['#3a2a2a', '#5a2a1e'], hormigon: ['#4a4246', '#5a5054', '#3e383c'],
      densidad: { rocas: 190, arboles: 40, cristales: 50, matas: 40 },
    },
    tinteSuelo: 0,
    hielo: 0.95,
    relieve: { estilos: ['crateres', 'mesetas'], lomas: [6, 10], macizos: [2, 4], lagos: [2, 3], barrios: [1, 2], picos: 1.1 },
    climas: ['tormentaCeniza', 'calma', 'tormentaElectrica'],
    fauna: { avispa: 1.5, sembrador: 1.2, saltador: 0.6 },
    rasgos: ['volatil', 'volatil', 'veloz'],
    familias: ['fuego', 'metal', 'gravedad'],
    lugares: {
      montes: ['Caldera Negra', 'Cono del Yunque', 'Los Hornos', 'Pico Ardiente'],
      lagos: ['Río de Fuego', 'Forja Abierta', 'Lengua de Lava'],
      barrios: ['Fundición Sur', 'Mina Vieja', 'Barrio del Horno'],
    },
  },
  {
    id: 'esporas', nombre: 'Selva de esporas', peso: 2,
    descripcion: 'Setas gigantes y ciénagas tóxicas. Ves poco y te ven antes.',
    aterrizaje: 'Sin sol, los hongos ganaron. Las esporas brillan, y a HELIOS le encanta anidar aquí.',
    cielo: { horizonte: '#7fd6b8', medio: '#2f7f86', cenit: '#12304a', nube: '#c8ffe8', sol: '#f0ffd0' },
    niebla: [38, 190],
    luz: { cielo: '#d8ffe8', suelo: '#2a3a6e', ambiente: 1.55, sol: '#f0ffd0', fuerza: 2.0 },
    suelo: {
      arena: '#4f8a6a', duna: '#6fb080', valle: '#2f6a66', helada: '#9fe6c0', grava: '#3a5a58', manchado: '#b45aff',
      losa: '#7a8a78', roca: '#2f4a5a', rocaAlta: '#1f3040', cumbre: '#bff0d8', quemado: '#1f3a38', lejos: '#2f6a6a',
    },
    montes: { cerca: '#2f6a72', lejos: '#4f9a96', nieve: '#c8ffe8', aguja: '#123038' },
    fluido: { nombre: 'ciénaga tóxica', colores: ['#123a20', '#2f9a40', '#9aff5a', '#e0ffa0'], dano: 0.6, avance: 0.55, vadeo: 0.7, burbujas: true, vapor: true },
    props: {
      arbol: 'seta', colorArbol: ['#d8e8c8', '#b45aff'], rocas: ['#3a5a68', '#4a6a70'], capa: '#6fe0a0',
      cristal: ['#2f9a70', '#9affc0'], mata: ['#3f9a6a', '#7a5ab0'], hormigon: ['#6a8078', '#5a7068', '#7a8a80'],
      densidad: { rocas: 80, arboles: 150, cristales: 30, matas: 240 },
    },
    tinteSuelo: 0,
    hielo: 0.95,
    relieve: { estilos: ['lomas'], lomas: [8, 12], macizos: [2, 3], lagos: [2, 4], barrios: [1, 2], picos: 0.85 },
    climas: ['esporas', 'neblina', 'lluviaAcida'],
    fauna: { sembrador: 1.8, caparazon: 1.1, avispa: 0.6 },
    rasgos: ['toxico', 'toxico', 'regenerativo'],
    familias: ['veneno', 'vida', 'hielo'],
    lugares: {
      montes: ['Lomo del Hongo', 'Cúpula Verde', 'Monte Moho', 'Las Gargantas'],
      lagos: ['Ciénaga Madre', 'Charca Viva', 'Fango Dulce'],
      barrios: ['Invernadero 9', 'Colonia Verde', 'Vivero Alto'],
    },
  },
  {
    id: 'salinas', nombre: 'Salinas rosas', peso: 2,
    descripcion: 'Llanura blanca sin sombra. Enemigos rápidos y nada donde esconderse.',
    aterrizaje: 'Un mar seco. Aquí no hay dónde esconderse, así que no pares de moverte.',
    cielo: { horizonte: '#ffd9e4', medio: '#f2a0c0', cenit: '#6a5ab0', nube: '#ffffff', sol: '#fff8e8' },
    niebla: [90, 400],
    luz: { cielo: '#fff0f4', suelo: '#8a6ab0', ambiente: 1.7, sol: '#fff0d8', fuerza: 2.5 },
    suelo: {
      arena: '#f7ecec', duna: '#ffffff', valle: '#f0c8d8', helada: '#ffe8f0', grava: '#d8b0c0', manchado: '#ff8ab0',
      losa: '#d8c0c0', roca: '#b88aa8', rocaAlta: '#8a6a98', cumbre: '#ffffff', quemado: '#a88a98', lejos: '#e8a8c0',
    },
    montes: { cerca: '#d890b0', lejos: '#f0b8cc', nieve: '#ffffff', aguja: '#6a4a80' },
    fluido: { nombre: 'salmuera', colores: ['#2f6a9a', '#4fb0d0', '#a0f0f0', '#ffffff'], dano: 0.4, avance: 0.75, vadeo: 0.4, burbujas: false, vapor: false },
    props: {
      arbol: 'pilar', colorArbol: ['#f2d8e0', '#ffffff'], rocas: ['#c8a0b8', '#e0c0cc'], capa: '#ffffff',
      cristal: ['#ff8ab0', '#ffe0ec'], mata: ['#e8b8c8', '#d8a8d0'], hormigon: ['#d8c8c8', '#c8b4b8', '#e0d0d0'],
      densidad: { rocas: 50, arboles: 28, cristales: 70, matas: 50 },
    },
    tinteSuelo: 0,
    hielo: 0.95,
    relieve: { estilos: ['dunas', 'lomas'], lomas: [2, 4], macizos: [1, 2], lagos: [1, 3], barrios: [0, 1], picos: 0.75 },
    climas: ['calma', 'polvo', 'tormentaElectrica'],
    fauna: { saltador: 1.8, avispa: 1.2 },
    rasgos: ['veloz', 'veloz', 'enjambre'],
    familias: ['rayo', 'cristal', 'gravedad'],
    lugares: {
      montes: ['Muela de Sal', 'Isla Blanca', 'Cresta Rosa'],
      lagos: ['Salmuera Grande', 'Ojo de Mar', 'Último Mar'],
      barrios: ['Puerto seco', 'Salinera Vieja', 'Muelle sin Agua'],
    },
  },
  {
    id: 'cristal', nombre: 'Bosque de cristal', peso: 2,
    descripcion: 'Noche violeta y agujas de cuarzo. Enemigos duros, botín que vale más.',
    aterrizaje: 'El sulfato cristalizó sobre lo que había. No toques nada que brille… o sí: esto vale mucho.',
    cielo: { horizonte: '#8a70e0', medio: '#3a2a90', cenit: '#0e0a30', nube: '#b0a0ff', sol: '#e0e8ff' },
    niebla: [55, 260],
    luz: { cielo: '#d0c8ff', suelo: '#2a1a6e', ambiente: 1.45, sol: '#c0d0ff', fuerza: 2.0 },
    suelo: {
      arena: '#3f3a70', duna: '#57509a', valle: '#2a2658', helada: '#9a90e0', grava: '#241f4a', manchado: '#ff5ae0',
      losa: '#6a6490', roca: '#2a2458', rocaAlta: '#181438', cumbre: '#c8c0ff', quemado: '#141030', lejos: '#2a2060',
    },
    montes: { cerca: '#2f2878', lejos: '#4a3ea0', nieve: '#d0c8ff', aguja: '#0e0a28' },
    fluido: { nombre: 'plasma', colores: ['#400a60', '#c020c0', '#ff80f0', '#ffe0ff'], dano: 1, avance: 0.6, vadeo: 0.6, burbujas: true, vapor: true },
    props: {
      arbol: 'pilar', colorArbol: ['#7a5ae0', '#e0d0ff'], rocas: ['#3a3270', '#4a4288'], capa: null,
      cristal: ['#8a4af0', '#ff90f0'], mata: ['#5a4aa0', '#7a4ac0'], hormigon: ['#6a6490', '#5a5480', '#7a74a0'],
      densidad: { rocas: 90, arboles: 90, cristales: 190, matas: 70 },
    },
    tinteSuelo: 0,
    hielo: 0.95,
    relieve: { estilos: ['mesetas', 'lomas'], lomas: [5, 9], macizos: [2, 4], lagos: [1, 2], barrios: [1, 2], picos: 1 },
    climas: ['aurora', 'calma', 'neblina'],
    fauna: { caparazon: 1.8, saltador: 0.8, avispa: 0.6 },
    rasgos: ['blindado', 'blindado', 'regenerativo'],
    familias: ['cristal', 'rayo', 'gravedad'],
    lugares: {
      montes: ['Catedral de Cuarzo', 'Las Agujas', 'Geoda Mayor', 'Prisma'],
      lagos: ['Lago de Plasma', 'Vena Violeta', 'Pozo de Luz'],
      barrios: ['Instituto del Velo', 'Laboratorio 3', 'Observatorio Roto'],
    },
  },
  {
    id: 'chatarra', nombre: 'Cementerio de la flota', peso: 2,
    descripcion: 'Ciudades oxidadas y brea. Muchas ruinas, mucha chatarra, mucha horda.',
    aterrizaje: 'Aquí cayó media flota de Ares. Hay chatarra para años, y HELIOS lo sabe.',
    cielo: { horizonte: '#e0b070', medio: '#a06a3a', cenit: '#3a2a24', nube: '#ffe0b0', sol: '#fff0c8' },
    niebla: [60, 280],
    luz: { cielo: '#ffe0b0', suelo: '#3a2a24', ambiente: 1.5, sol: '#ffd090', fuerza: 2.6 },
    suelo: {
      arena: '#a8703e', duna: '#c48a50', valle: '#7a4a2a', helada: '#8a7a6a', grava: '#5a3a28', manchado: '#3a2a1e',
      losa: '#7a6a5a', roca: '#5a3a2a', rocaAlta: '#3a261c', cumbre: '#9a8a7a', quemado: '#2a1c14', lejos: '#6a4a30',
    },
    montes: { cerca: '#7a4e30', lejos: '#a07040', nieve: '#c8b090', aguja: '#2a1c14' },
    fluido: { nombre: 'brea', colores: ['#0e0c10', '#2a2430', '#6a5a70', '#a8a0b0'], dano: 0.8, avance: 0.45, vadeo: 0.6, burbujas: true, vapor: false },
    props: {
      arbol: 'antena', colorArbol: ['#6a4a34', '#ff8a3d'], rocas: ['#6a4a34', '#7a5a40'], capa: null,
      cristal: ['#8a4a20', '#ffb060'], mata: ['#7a5a3a', '#5a4a3a'], hormigon: ['#7a6a5a', '#8a7a68', '#6a5a4c'],
      densidad: { rocas: 120, arboles: 70, cristales: 24, matas: 90 },
    },
    tinteSuelo: 0,
    hielo: 0.95,
    relieve: { estilos: ['mesetas', 'lomas'], lomas: [4, 7], macizos: [1, 3], lagos: [1, 2], barrios: [3, 5], picos: 0.85 },
    climas: ['polvo', 'calma', 'tormentaElectrica'],
    fauna: { avispa: 1, saltador: 1, caparazon: 0.6, sembrador: 0.6 },
    rasgos: ['enjambre', 'enjambre', 'volatil'],
    familias: ['metal', 'fuego', 'rayo'],
    lugares: {
      montes: ['Monte Casco', 'Pila de Ares', 'Cuadernas'],
      lagos: ['Mancha de Brea', 'Pozo de Aceite', 'Sentina'],
      barrios: ['Astillero Caído', 'Calle de los Motores', 'Dique Seco', 'Barrio de la Quilla', 'Patio de Grúas'],
    },
  },
  {
    id: 'oasis', nombre: 'Oasis del claro', peso: 1,
    descripcion: 'Raro: el velo tiene un agujero y aún hay verde y agua limpia.',
    aterrizaje: 'No me lo creo. Hay agua limpia, y palmeras. Así era Meta. HELIOS vendrá a por esto.',
    cielo: { horizonte: '#bfe8f0', medio: '#5fa8e0', cenit: '#1f4a8e', nube: '#ffffff', sol: '#ffffff' },
    niebla: [80, 380],
    luz: { cielo: '#fff8e0', suelo: '#3a6a58', ambiente: 1.7, sol: '#fff4d8', fuerza: 2.8 },
    suelo: {
      arena: '#7fb060', duna: '#9fcc70', valle: '#4f9058', helada: '#cfe8a0', grava: '#6a7a58', manchado: '#d8c890',
      losa: '#a0a088', roca: '#6a6a70', rocaAlta: '#4a4a58', cumbre: '#f4f8ff', quemado: '#3a4a30', lejos: '#5a8a70',
    },
    montes: { cerca: '#5a8a90', lejos: '#8ab4c0', nieve: '#ffffff', aguja: '#2a4a58' },
    fluido: { nombre: 'agua', colores: ['#1a5a8a', '#2f90c0', '#8fe0f0', '#ffffff'], dano: 0, avance: 0.75, vadeo: 0.6, burbujas: false, vapor: false },
    props: {
      arbol: 'palma', colorArbol: ['#8a6a48', '#3fae5a'], rocas: ['#7a7a80', '#8a8a90'], capa: '#6fbf60',
      cristal: ['#3fae8a', '#a0ffe0'], mata: ['#4faa50', '#7fc860'], hormigon: ['#a8a898', '#989888', '#b8b8a8'],
      densidad: { rocas: 80, arboles: 120, cristales: 16, matas: 300 },
    },
    tinteSuelo: 0,
    hielo: 0.95,
    relieve: { estilos: ['lomas'], lomas: [5, 8], macizos: [2, 3], lagos: [2, 4], barrios: [1, 2], picos: 0.9 },
    climas: ['calma', 'neblina'],
    fauna: { saltador: 0.8, avispa: 0.8, caparazon: 0.5, sembrador: 0.5 },
    rasgos: ['regenerativo', 'ninguno'],
    familias: ['vida', 'hielo', 'metal'],
    lugares: {
      montes: ['Los Abuelos', 'Cerro Verde', 'Alto del Agua'],
      lagos: ['Laguna Clara', 'Agua Dulce', 'Lago de Noa'],
      barrios: ['Pueblo Viejo', 'Las Terrazas', 'La Escuela'],
    },
  },
];

export const BIOMAS = Object.fromEntries(BIOMAS_LISTA.map((b) => [b.id, b])) as Record<BiomaId, Bioma>;
export const IDS_BIOMA = BIOMAS_LISTA.map((b) => b.id);

// ------------------------------------------------------------------ clima

export type ClimaId = 'calma' | 'ventisca' | 'tormentaCeniza' | 'lluviaAcida' | 'neblina' | 'polvo' | 'esporas' | 'aurora' | 'tormentaElectrica';

export interface Clima {
  id: ClimaId;
  nombre: string;
  texto: string;
  /** Multiplica la distancia de la niebla. */
  vista: number;
  /** Multiplica el sol. */
  luz: number;
  particula: ParticulaClima;
  /** Color de las partículas (null: el de la nube del bioma). */
  color: string | null;
  /** Efectos en el juego. */
  velocidadJugador: number;
  velocidadEnemigos: number;
  /** Daño por segundo si no estás a cubierto (se cura con el refugio). */
  corrosion: number;
  /** Caen rayos alrededor (a jugador y enemigos) cada tantos segundos. */
  rayos: number;
}

const clima = (c: Partial<Clima> & Pick<Clima, 'id' | 'nombre' | 'texto'>): Clima => ({
  vista: 1, luz: 1, particula: null, color: null, velocidadJugador: 1, velocidadEnemigos: 1, corrosion: 0, rayos: 0, ...c,
});

export const CLIMAS: Record<ClimaId, Clima> = {
  calma: clima({ id: 'calma', nombre: 'Calma', texto: 'Cielo despejado para lo que es Meta.' }),
  ventisca: clima({ id: 'ventisca', nombre: 'Ventisca', texto: 'Ves menos y todo va más lento, tú y ellos.', vista: 0.55, particula: 'nieve', color: '#ffffff', velocidadJugador: 0.92, velocidadEnemigos: 0.88 }),
  tormentaCeniza: clima({ id: 'tormentaCeniza', nombre: 'Tormenta de ceniza', texto: 'La ceniza tapa la luz y deja el aire irrespirable.', vista: 0.6, luz: 0.7, particula: 'ceniza', color: '#ffb080', corrosion: 0.35 }),
  lluviaAcida: clima({ id: 'lluviaAcida', nombre: 'Lluvia ácida', texto: 'Corroe el traje poco a poco. Te cura menos quien no lleve sellador.', vista: 0.8, luz: 0.85, particula: 'lluvia', color: '#c4ffb0', corrosion: 0.5 }),
  neblina: clima({ id: 'neblina', nombre: 'Neblina', texto: 'Apenas ves a veinte metros: los haces de luz son tu guía.', vista: 0.45 }),
  polvo: clima({ id: 'polvo', nombre: 'Polvo en suspensión', texto: 'Una neblina fina que no deja ver el horizonte.', vista: 0.75, particula: 'polvo' }),
  esporas: clima({ id: 'esporas', nombre: 'Lluvia de esporas', texto: 'Flotan por todas partes y brillan. Enemigos más lentos, tú también.', vista: 0.7, particula: 'esporas', color: '#b0ffd0', velocidadJugador: 0.96, velocidadEnemigos: 0.92 }),
  aurora: clima({ id: 'aurora', nombre: 'Aurora', texto: 'El velo se ioniza y brilla. Las herramientas lo notan.', luz: 0.9, particula: 'chispas', color: '#ff90f0' }),
  tormentaElectrica: clima({ id: 'tormentaElectrica', nombre: 'Tormenta eléctrica', texto: 'Caen rayos: mira el suelo y aprovéchalos contra la horda.', vista: 0.85, luz: 0.8, particula: 'polvo', rayos: 9 }),
};

// ------------------------------------------------------------------ reglas

export type ReglaId = 'estable' | 'gravedad' | 'veta' | 'marea' | 'colosos' | 'resonancia' | 'escasez' | 'tesoros' | 'caza' | 'fragil' | 'hambre' | 'eco';

/** Todo se multiplica: 1 no cambia nada. */
export interface ModsRegla {
  ritmoEnemigos: number;
  vidaEnemigos: number;
  danoEnemigos: number;
  velocidadEnemigos: number;
  xp: number;
  chatarra: number;
  gravedad: number;
  salto: number;
  vidaJugador: number;
  danoJugador: number;
  recarga: number;
  /** Multiplica cofres y cajas repartidos. */
  cofres: number;
  /** Multiplica raciones. */
  raciones: number;
  /** Suma a la suerte de rareza de objetos y bendiciones. */
  suerte: number;
  /** Multiplica el tiempo hasta el primer minijefe y entre ellos. */
  minijefes: number;
  /** Los enemigos sueltan objetos más a menudo. */
  objetos: number;
}

export interface Regla {
  id: ReglaId;
  nombre: string;
  texto: string;
  peso: number;
  mods: ModsRegla;
}

const SIN_MODS: ModsRegla = {
  ritmoEnemigos: 1, vidaEnemigos: 1, danoEnemigos: 1, velocidadEnemigos: 1, xp: 1, chatarra: 1, gravedad: 1, salto: 1,
  vidaJugador: 1, danoJugador: 1, recarga: 1, cofres: 1, raciones: 1, suerte: 0, minijefes: 1, objetos: 1,
};
const regla = (id: ReglaId, nombre: string, texto: string, peso: number, mods: Partial<ModsRegla> = {}): Regla => ({
  id, nombre, texto, peso, mods: { ...SIN_MODS, ...mods },
});

export const REGLAS: Record<ReglaId, Regla> = {
  estable: regla('estable', 'Sector estable', 'Nada raro por aquí. Eso dicen los sensores.', 3),
  gravedad: regla('gravedad', 'Gravedad baja', 'Saltas mucho más alto y caes despacio.', 2, { gravedad: 0.5, salto: 1.35 }),
  veta: regla('veta', 'Veta rica', 'La chatarra rinde un 60 % más, y HELIOS manda más gente a por ella.', 2, { chatarra: 1.6, ritmoEnemigos: 1.2 }),
  marea: regla('marea', 'Marea de HELIOS', 'Llegan muchos más, pero se rompen enseguida.', 2, { ritmoEnemigos: 1.55, vidaEnemigos: 0.62, xp: 1.15 }),
  colosos: regla('colosos', 'Tierra de colosos', 'Vienen pocos y enormes. Cada baja paga el doble.', 2, { ritmoEnemigos: 0.6, vidaEnemigos: 2.1, danoEnemigos: 1.2, xp: 1.6, chatarra: 1.9 }),
  resonancia: regla('resonancia', 'Resonancia', 'Tus herramientas recargan más rápido. Ellos también van acelerados.', 2, { recarga: 0.82, velocidadEnemigos: 1.2 }),
  escasez: regla('escasez', 'Escasez', 'Casi no hay raciones, pero lo que se encuentra es mejor.', 2, { raciones: 0.3, suerte: 0.5, objetos: 1.4 }),
  tesoros: regla('tesoros', 'Sector saqueado a medias', 'El doble de cofres y cajas. Más de una es un cebo.', 2, { cofres: 1.9 }),
  caza: regla('caza', 'Coto de caza', 'Los minijefes llegan antes y más seguido, y dejan objetos.', 2, { minijefes: 0.6, objetos: 1.8 }),
  fragil: regla('fragil', 'Aire fino', 'Tu traje aguanta un 30 % menos y pegas un 35 % más.', 2, { vidaJugador: 0.7, danoJugador: 1.35 }),
  hambre: regla('hambre', 'Hambre de HELIOS', 'Sube la presión de enemigos minuto a minuto, y la experiencia también.', 1, { ritmoEnemigos: 1.3, xp: 1.4 }),
  eco: regla('eco', 'Ecos del velo', 'Los enemigos sueltan objetos de vez en cuando.', 2, { objetos: 3 }),
};

// ------------------------------------------------------------------ fauna

export interface DefRasgo {
  id: RasgoFauna;
  nombre: string;
  texto: string;
  /** Tinte sobre el color del enemigo. */
  tinte: string | null;
  fuerzaTinte: number;
  vida: number;
  velocidad: number;
  /** Tamaño respecto al normal. */
  escala: number;
  /** Multiplica cuántos aparecen. */
  ritmo: number;
}

export const RASGOS: Record<RasgoFauna, DefRasgo> = {
  ninguno: { id: 'ninguno', nombre: 'Patrulla corriente', texto: 'Máquinas de HELIOS sin nada especial.', tinte: null, fuerzaTinte: 0, vida: 1, velocidad: 1, escala: 1, ritmo: 1 },
  volatil: { id: 'volatil', nombre: 'Volátiles', texto: 'Revientan al caer: no los remates de cerca.', tinte: '#ff6a2a', fuerzaTinte: 0.45, vida: 0.9, velocidad: 1, escala: 1, ritmo: 1 },
  gelido: { id: 'gelido', nombre: 'Gélidos', texto: 'Su contacto te congela las piernas.', tinte: '#8fd8ff', fuerzaTinte: 0.5, vida: 1.1, velocidad: 0.9, escala: 1, ritmo: 1 },
  toxico: { id: 'toxico', nombre: 'Tóxicos', texto: 'Dejan un charco que quema al pisarlo.', tinte: '#7dff6a', fuerzaTinte: 0.45, vida: 1, velocidad: 1, escala: 1, ritmo: 1 },
  blindado: { id: 'blindado', nombre: 'Acorazados', texto: 'Aguantan mucho más, pero son lentos.', tinte: '#c0b8ff', fuerzaTinte: 0.4, vida: 1.6, velocidad: 0.85, escala: 1.12, ritmo: 0.8 },
  enjambre: { id: 'enjambre', nombre: 'Enjambre', texto: 'Pequeños y muchísimos.', tinte: '#ffcf6a', fuerzaTinte: 0.35, vida: 0.55, velocidad: 1.1, escala: 0.8, ritmo: 1.6 },
  veloz: { id: 'veloz', nombre: 'Corredores', texto: 'Más rápidos que tú si te paras.', tinte: '#ff8fa0', fuerzaTinte: 0.35, vida: 0.85, velocidad: 1.3, escala: 0.95, ritmo: 1 },
  regenerativo: { id: 'regenerativo', nombre: 'Simbiontes', texto: 'Se regeneran si no los rematas.', tinte: '#7dff9a', fuerzaTinte: 0.35, vida: 1.05, velocidad: 1, escala: 1, ritmo: 1 },
};

export interface Fauna {
  rasgo: DefRasgo;
  /** Peso de cada tipo especial (0: no sale en este sector). */
  pesos: Record<'saltador' | 'avispa' | 'caparazon' | 'sembrador' | 'acechador' | 'bombardero' | 'coloso' | 'espectro', number>;
  /** Qué parte del relleno de la horda es de cada tipo además del recolector. */
  relleno: { tipo: EnemyId; parte: number }[];
  /** Los tipos que manda el sector, para el escáner. */
  dominantes: EnemyId[];
}

const NUEVA_FAUNA = ['acechador', 'bombardero', 'coloso', 'espectro'] as const;
const ESPECIALES = ['saltador', 'avispa', 'caparazon', 'sembrador', ...NUEVA_FAUNA] as const;

// ------------------------------------------------------------------ relieve

export interface PicoDef { dx: number; dz: number; r: number; alto: number }
export interface MacizoDef { nombre: string; x: number; z: number; picos: PicoDef[] }
export interface LagoDef { nombre: string; x: number; z: number; r: number }
export interface BarrioDef { nombre: string; x: number; z: number; w: number; d: number }
export interface CraterDef { x: number; z: number; r: number; hondo: number }

export interface Relieve {
  estilo: EstiloRelieve;
  /** Altura de las lomas. */
  lomas: number;
  /** Desplazamiento del ruido: con él cambia todo el terreno. */
  ox: number;
  oz: number;
  macizos: MacizoDef[];
  lagos: LagoDef[];
  barrios: BarrioDef[];
  crateres: CraterDef[];
  /** Lunas en el cielo. */
  lunas: { x: number; y: number; tam: number; color: string }[];
}

/** Sitios reservados, en fracciones de la arena: la salida y la plataforma. */
const RESERVADOS = [{ x: 0, z: 0, r: 0.24 }, { x: 0, z: -0.7, r: 0.3 }];

function sitio(rand: () => number, radio: number, otros: readonly { x: number; z: number; r: number }[], maximo = 0.74) {
  for (let k = 0; k < 60; k++) {
    const x = (rand() * 2 - 1) * maximo, z = (rand() * 2 - 1) * maximo;
    if ([...RESERVADOS, ...otros].every((o) => Math.hypot(x - o.x, z - o.z) > o.r + radio * 1.05)) return { x, z };
  }
  return null;
}

function elegir<T>(rand: () => number, lista: readonly T[]): T {
  return lista[Math.floor(rand() * lista.length) % lista.length];
}

function entre(rand: () => number, [a, b]: readonly [number, number]) {
  return a + Math.floor(rand() * (b - a + 1));
}

function barajar<T>(rand: () => number, lista: readonly T[]): T[] {
  const c = [...lista];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

export function generarRelieve(rand: () => number, b: Bioma): Relieve {
  const r = b.relieve;
  const usados: { x: number; z: number; r: number }[] = [];
  const nombresM = barajar(rand, b.lugares.montes), nombresL = barajar(rand, b.lugares.lagos), nombresB = barajar(rand, b.lugares.barrios);

  const lagos: LagoDef[] = [];
  for (let k = 0, n = entre(rand, r.lagos); k < n; k++) {
    const radio = 0.1 + rand() * 0.14;
    const p = sitio(rand, radio, usados);
    if (!p) continue;
    usados.push({ ...p, r: radio });
    lagos.push({ nombre: nombresL[k % nombresL.length], ...p, r: radio });
  }
  const macizos: MacizoDef[] = [];
  for (let k = 0, n = entre(rand, r.macizos); k < n; k++) {
    const radio = 0.13 + rand() * 0.08;
    const p = sitio(rand, radio * 1.3, usados);
    if (!p) continue;
    usados.push({ ...p, r: radio * 1.3 });
    const alto = (32 + rand() * 16) * r.picos;
    const picos: PicoDef[] = [{ dx: 0, dz: 0, r: radio, alto }];
    for (let s = 0, m = 1 + Math.floor(rand() * 2); s < m; s++) {
      const a = rand() * Math.PI * 2, d = radio * (0.7 + rand() * 0.25);
      picos.push({ dx: Math.cos(a) * d, dz: Math.sin(a) * d, r: radio * (0.55 + rand() * 0.25), alto: alto * (0.5 + rand() * 0.2) });
    }
    macizos.push({ nombre: nombresM[k % nombresM.length], ...p, picos });
  }
  const barrios: BarrioDef[] = [];
  for (let k = 0, n = entre(rand, r.barrios); k < n; k++) {
    const w = 0.1 + rand() * 0.08, d = 0.09 + rand() * 0.06;
    const p = sitio(rand, Math.max(w, d), usados);
    if (!p) continue;
    usados.push({ ...p, r: Math.max(w, d) });
    barrios.push({ nombre: nombresB[k % nombresB.length], ...p, w, d });
  }
  const estilo = elegir(rand, r.estilos);
  const crateres: CraterDef[] = [];
  if (estilo === 'crateres') {
    for (let k = 0; k < 9; k++) {
      const radio = 0.04 + rand() * 0.07;
      const p = sitio(rand, radio, usados, 0.85);
      if (!p) continue;
      usados.push({ ...p, r: radio });
      crateres.push({ ...p, r: radio, hondo: 2.2 + rand() * 2.6 });
    }
  }
  const lunas = Array.from({ length: Math.floor(rand() * 3) }, () => ({
    x: rand() * Math.PI * 2, y: 0.28 + rand() * 0.4, tam: 40 + rand() * 90, color: elegir(rand, [b.cielo.nube, b.montes.lejos, b.suelo.duna]),
  }));
  return {
    estilo, lomas: r.lomas[0] + rand() * (r.lomas[1] - r.lomas[0]),
    ox: Math.floor(rand() * 4000), oz: Math.floor(rand() * 4000),
    macizos, lagos, barrios, crateres, lunas,
  };
}

// ---------------------------------------------------------------- sectores

/** Qué se reparte por el mapa. Cada sector tiene su propia mezcla. */
export interface Reparto {
  /** Índices de ALTARES_JEFE presentes. */
  altares: number[];
  aras: number;
  torres: number;
  cofres: number;
  pilones: number;
  duelos: number;
  cajasSueltas: number;
  raciones: number;
  /** NPC del refugio (ids de NPCS). */
  npcs: string[];
  /** A qué distancia está el refugio. */
  refugio: readonly [number, number];
  /** Hay un mercader de paso en este sector. */
  mercader: { nombre: string; distancia: readonly [number, number] } | null;
}

export interface Planeta {
  semilla: number;
  nombre: string;
  bioma: Bioma;
  clima: Clima;
  regla: Regla;
  relieve: Relieve;
  fauna: Fauna;
  reparto: Reparto;
  /** Familias de objetos que salen más. */
  afinidad: Familia[];
  /** De 1 a 5, para el escáner. */
  peligro: number;
  riqueza: number;
}

const SILABAS = ['Ka', 'Ve', 'Or', 'Ily', 'Ne', 'Ta', 'Sol', 'Mir', 'Da', 'Zen', 'Ul', 'Ara', 'Ni', 'Rho', 'Lu', 'Ke', 'Tho', 'Ise', 'Vor', 'Ema'];
const FINALES = ['ra', 'nis', 'dor', 'lia', 'sa', 'ven', 'tis', 'mar', 'kos', 'ria', 'non', 'thys', 'nel', 'ga', 'tar'];
const DESIGNACION = ['Norte', 'Sur', 'Este', 'Oeste', 'Alto', 'Bajo', 'Mayor', 'Menor'];
const VIAJEROS = ['Oren', 'Sabela', 'Nilo', 'Yara', 'Kael', 'Dunia', 'Teo', 'Runa', 'Ismael', 'Vera'];

export function nombreSector(rand: () => number) {
  const raiz = elegir(rand, SILABAS) + elegir(rand, FINALES);
  return rand() < 0.45 ? `${raiz} ${elegir(rand, DESIGNACION)}` : `${raiz}-${1 + Math.floor(rand() * 9)}`;
}

/** Generador determinista (Mulberry32). */
export function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tirarPeso<T extends { peso: number }>(rand: () => number, lista: readonly T[]): T {
  const total = lista.reduce((s, b) => s + b.peso, 0);
  let r = rand() * total;
  for (const b of lista) {
    if (r < b.peso) return b;
    r -= b.peso;
  }
  return lista[lista.length - 1];
}

function generarFauna(rand: () => number, b: Bioma): Fauna {
  const rasgo = RASGOS[elegir(rand, b.rasgos)];
  const pesos = Object.fromEntries(ESPECIALES.map((id) => [id, 0])) as Fauna['pesos'];
  for (const [id, peso] of Object.entries(b.fauna)) {
    if (id in pesos) pesos[id as keyof Fauna['pesos']] = (peso ?? 0) * (0.6 + rand() * 0.8);
  }
  // Dos especies que no son de aquí, y dos de las duras: nunca se repite la mezcla.
  const invitados = barajar(rand, NUEVA_FAUNA).slice(0, 2);
  for (const id of invitados) pesos[id] = 0.6 + rand() * 0.8;
  const forastero = barajar(rand, ESPECIALES).find((id) => pesos[id] === 0);
  if (forastero && rand() < 0.5) pesos[forastero] = 0.4;
  const ordenados = ESPECIALES.filter((id) => pesos[id] > 0).sort((x, y) => pesos[y] - pesos[x]);
  // Parte de la horda de relleno es del tipo que manda: cambia cómo se mueve todo.
  const relleno = ordenados.slice(0, 2).filter((id) => id !== 'coloso').map((tipo, k) => ({ tipo: tipo as EnemyId, parte: k === 0 ? 0.14 : 0.07 }));
  return { rasgo, pesos, relleno, dominantes: ordenados.slice(0, 3) as EnemyId[] };
}

function generarReparto(rand: () => number, b: Bioma, regla: Regla): Reparto {
  const m = regla.mods;
  const altares = barajar(rand, [0, 1, 2, 3]).slice(0, 2 + Math.floor(rand() * 3)).sort();
  const npcs = barajar(rand, ['npc-mecanica', 'npc-vigia', 'npc-botanica']).slice(0, 1 + Math.floor(rand() * 3));
  const lejos = rand() < 0.5;
  return {
    altares,
    aras: 2 + Math.floor(rand() * 3),
    torres: 2 + Math.floor(rand() * 4),
    cofres: Math.round((7 + rand() * 6) * m.cofres),
    pilones: 5 + Math.floor(rand() * 6),
    duelos: 1 + Math.floor(rand() * 3),
    cajasSueltas: Math.round((6 + rand() * 6) * m.cofres),
    raciones: Math.round((10 + rand() * 7) * m.raciones),
    npcs,
    refugio: lejos ? [40, 75] : [16, 26],
    mercader: rand() < (b.id === 'chatarra' ? 0.9 : 0.6) ? { nombre: elegir(rand, VIAJEROS), distancia: [34, 100] } : null,
  };
}

function medir(b: Bioma, c: Clima, r: Regla, fauna: Fauna, reparto: Reparto) {
  const m = r.mods;
  const presion = m.ritmoEnemigos * m.vidaEnemigos ** 0.5 * m.danoEnemigos * fauna.rasgo.ritmo * fauna.rasgo.vida ** 0.5 * (1 + b.fluido.dano * 0.08) * (1 + c.corrosion * 0.3) * (2 - c.vista * 0.8);
  const riqueza = m.chatarra * (1 + m.suerte * 0.5) * (0.6 + m.objetos * 0.3) * (0.5 + (reparto.cofres + reparto.cajasSueltas) / 30) * (reparto.mercader ? 1.1 : 1);
  const nivel = (v: number, bajo: number, alto: number) => Math.max(1, Math.min(5, 1 + Math.round(((v - bajo) / (alto - bajo)) * 4)));
  return { peligro: nivel(presion, 1.0, 2.2), riqueza: nivel(riqueza, 0.8, 2) };
}

export interface Forzar {
  bioma?: BiomaId;
  clima?: ClimaId;
  regla?: ReglaId;
}

/** La misma semilla da siempre el mismo sector. */
export function generarPlaneta(semilla: number, forzar: Forzar = {}): Planeta {
  const rand = generador(semilla);
  const bioma = forzar.bioma ? BIOMAS[forzar.bioma] : tirarPeso(rand, BIOMAS_LISTA);
  const clima = CLIMAS[forzar.clima ?? elegir(rand, bioma.climas)];
  const regla = forzar.regla ? REGLAS[forzar.regla] : tirarPeso(rand, Object.values(REGLAS));
  const relieve = generarRelieve(rand, bioma);
  const fauna = generarFauna(rand, bioma);
  const reparto = generarReparto(rand, bioma, regla);
  const afinidad = barajar(rand, bioma.familias).slice(0, 2);
  return {
    semilla, nombre: nombreSector(rand), bioma, clima, regla, relieve, fauna, reparto, afinidad, ...medir(bioma, clima, regla, fauna, reparto),
  };
}

/** El sector de Meta tal como se ve en la cinemática: el del título y las pruebas. */
export const PLANETA_INICIAL: Planeta = {
  ...generarPlaneta(2026, { bioma: 'velo', clima: 'calma', regla: 'estable' }),
  reparto: {
    altares: [0, 1, 2, 3], aras: 3, torres: 4, cofres: 10, pilones: 8, duelos: 3, cajasSueltas: 9, raciones: 14,
    npcs: ['npc-mecanica', 'npc-vigia', 'npc-botanica'], refugio: [16, 22], mercader: null,
  },
};

/** Tres destinos para elegir: siempre de biomas distintos. */
export function destinos(semilla: number, cuantos = 3): Planeta[] {
  const rand = generador(semilla ^ 0x51ed270b);
  const lista: Planeta[] = [];
  const vistos = new Set<BiomaId>();
  for (let k = 0; k < 64 && lista.length < cuantos; k++) {
    const p = generarPlaneta(Math.floor(rand() * 0x7fffffff));
    if (vistos.has(p.bioma.id)) continue;
    vistos.add(p.bioma.id);
    lista.push(p);
  }
  return lista;
}

/** Una línea para ADA y para la IA: qué sector es y qué tiene de especial. */
export function resumenPlaneta(p: Planeta) {
  return `${p.nombre}, ${p.bioma.nombre.toLowerCase()}. Clima: ${p.clima.nombre.toLowerCase()}. ${p.regla.nombre}: ${p.regla.texto} Fauna: ${p.fauna.rasgo.nombre.toLowerCase()}. El líquido de los lagos es ${p.bioma.fluido.nombre}${p.bioma.fluido.dano === 0 ? ', y no hace daño' : ''}.`;
}
