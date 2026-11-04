// META SPACE — Objetos: lo que encuentras en cada sector y cambia cómo funcionan tus
// herramientas. Las bendiciones suben números; esto cambia lo que pasa: un corte que
// rebota, un pulso que nace sobre la horda, bajas que estallan, drones que disparan.
//
// Datos puros, sin THREE: `calcularArsenal` suma lo que llevas en una tabla que leen
// las armas (weapons.ts) y los efectos en juego (arsenal.ts). Para añadir un objeto
// basta con una línea aquí, si su efecto ya existe.
//
// Los objetos llevan una familia. Cada sector tiene dos familias afines (ver
// planetas.ts) y salen más: en un sector de ceniza encuentras fuego y metal, y la
// partida acaba siendo distinta a la de un glaciar.

import type { WeaponId } from './data.ts';
import type { Familia } from './planetas.ts';
import { RAREZAS, type Rareza } from './bendiciones.ts';

/** Lo que pasa al golpear. Probabilidad de 0 a 1 por golpe. */
export interface Golpe {
  quemar: number;
  envenenar: number;
  congelar: number;
  chispa: number;
  marcar: number;
  doble: number;
}

const CLAVES_GOLPE = ['quemar', 'envenenar', 'congelar', 'chispa', 'marcar', 'doble'] as const;

/** Todo lo que un objeto puede cambiar. Los valores se suman entre objetos. */
export interface Efectos extends Golpe {
  // Al eliminar un enemigo.
  estallar: number;
  esquirlas: number;
  curarAlMatar: number;
  contagio: number;
  gravedadAlMatar: number;
  /** Cae un rayo cada tantas bajas (0: nunca). */
  rayoCadaBajas: number;
  // Al acertar un crítico.
  critQuema: number;
  critEstalla: number;
  /** Segundos que se quitan a todas las recargas. */
  critRecarga: number;
  // Daño.
  dano: number;
  critico: number;
  multCritico: number;
  /** Daño extra a lo congelado. */
  danoCongelados: number;
  /** Daño extra estando quieto / en movimiento. */
  quietoDano: number;
  movilDano: number;
  /** Más daño cuanta más chatarra lleves. */
  chatarraDano: number;
  /** La herramienta dispara una segunda vez. */
  eco: number;
  // Rastro al andar.
  estelaFuego: number;
  estelaHielo: number;
  // Defensa.
  /** Segundos entre escudos (0: sin escudo). */
  escudo: number;
  ultimaVoluntad: number;
  espejo: number;
  ondaAlRecibir: number;
  /** Con poca vida el tiempo va más lento para ellos. */
  relojRoto: number;
  vida: number;
  regen: number;
  velocidad: number;
  iman: number;
  // Periódicos.
  /** Segundos entre rayos automáticos. */
  pararrayos: number;
  /** Segundos entre sobrecargas. */
  sobrecarga: number;
  // Cortador.
  rebotes: number;
  division: number;
  guiado: number;
  retorno: number;
  estelaCorte: number;
  // Pulso.
  implosion: number;
  pulsoEco: number;
  pulsoRemoto: number;
  pulsoCura: number;
  // Dron.
  dronDispara: number;
  dronEstalla: number;
  dronExtra: number;
  // Interferencia.
  auraTira: number;
  auraCura: number;
  // Lanza.
  lanzaCharco: number;
  lanzaAturde: number;
  lanzaTriple: number;
  // Arco.
  arcoSaltos: number;
  arcoTormenta: number;
  // Mortero.
  morteroRacimo: number;
  morteroHielo: number;
  morteroVacio: number;
}

export type ModuloId = 'pozo' | 'fase' | 'salto' | 'meteoros' | 'senuelo' | 'cero' | 'nano' | 'iman' | 'crono' | 'haz' | 'torre' | 'onda';

export interface ObjetoDef {
  id: string;
  nombre: string;
  texto: string;
  familia: Familia;
  rareza: Rareza;
  /** Solo sale si llevas esa herramienta, y sus efectos de golpe son solo suyos. */
  arma?: WeaponId;
  efectos: Partial<Efectos>;
  /** Si es un módulo activo, cuál (ver modulos.ts). */
  modulo?: ModuloId;
}

const o = (id: string, nombre: string, familia: Familia, rareza: Rareza, texto: string, efectos: Partial<Efectos>, arma?: WeaponId): ObjetoDef =>
  ({ id, nombre, texto, familia, rareza, efectos, arma });

export const OBJETOS: readonly ObjetoDef[] = [
  // ----------------------------------------------------------- herramientas
  o('filo-saltarin', 'Filo saltarín', 'metal', 'rara', 'Los cortes rebotan a dos enemigos más.', { rebotes: 2 }, 'cortador'),
  o('prisma-corte', 'Prisma de corte', 'cristal', 'rara', 'Cada corte se parte en dos esquirlas al impactar.', { division: 1 }, 'cortador'),
  o('ojo-ada', 'Ojo de ADA', 'rayo', 'comun', 'Los cortes se curvan solos hacia el enemigo más cercano.', { guiado: 1 }, 'cortador'),
  o('hilo-retorno', 'Hilo de retorno', 'metal', 'rara', 'Los cortes vuelven a ti y golpean otra vez al regresar.', { retorno: 1 }, 'cortador'),
  o('soplete', 'Soplete de muestreo', 'fuego', 'epica', 'Los cortes dejan un rastro de fuego por donde pasan.', { estelaCorte: 1 }, 'cortador'),
  o('hoja-veneno', 'Hoja untada', 'veneno', 'comun', 'Los cortes envenenan casi siempre.', { envenenar: 0.8 }, 'cortador'),

  o('bobina-vacio', 'Bobina de vacío', 'gravedad', 'rara', 'El pulso arrastra a la horda hacia el centro antes de golpear.', { implosion: 1 }, 'pulso'),
  o('doble-condensador', 'Doble condensador', 'rayo', 'rara', 'Un segundo pulso sale justo después del primero.', { pulsoEco: 1 }, 'pulso'),
  o('antena-ada', 'Antena remota', 'rayo', 'epica', 'El pulso nace sobre el grupo más denso a tu alcance, no sobre ti.', { pulsoRemoto: 1 }, 'pulso'),
  o('refrigerante', 'Refrigerante de traje', 'hielo', 'rara', 'El pulso congela a uno de cada cuatro enemigos.', { congelar: 0.25 }, 'pulso'),
  o('retroalimentacion', 'Retroalimentación', 'vida', 'rara', 'Cada enemigo alcanzado por el pulso repara el traje.', { pulsoCura: 1 }, 'pulso'),

  o('dron-artillero', 'Dron artillero', 'metal', 'rara', 'Los drones también disparan a distancia.', { dronDispara: 1 }, 'dron'),
  o('carga-impacto', 'Carga de impacto', 'fuego', 'rara', 'Los drones estallan al embestir (y siguen enteros).', { dronEstalla: 1 }, 'dron'),
  o('enjambre', 'Enjambre', 'metal', 'epica', 'Dos drones más en la órbita.', { dronExtra: 2 }, 'dron'),
  o('dron-estatico', 'Rotor estático', 'rayo', 'comun', 'Los drones sueltan chispas al golpear.', { chispa: 0.5 }, 'dron'),

  o('campo-igneo', 'Campo ígneo', 'fuego', 'rara', 'La interferencia prende fuego a lo que entra.', { quemar: 0.5 }, 'interferencia'),
  o('campo-arrastre', 'Campo de arrastre', 'gravedad', 'rara', 'La interferencia atrae a los enemigos hacia ti.', { auraTira: 1 }, 'interferencia'),
  o('sifon', 'Sifón de señal', 'vida', 'epica', 'Cada enemigo dentro de la interferencia te cura.', { auraCura: 1 }, 'interferencia'),
  o('escarcha-campo', 'Escarcha estática', 'hielo', 'comun', 'La interferencia congela a veces.', { congelar: 0.12 }, 'interferencia'),

  o('punta-incendiaria', 'Punta incendiaria', 'fuego', 'comun', 'La lanza deja el suelo ardiendo.', { lanzaCharco: 1 }, 'lanza'),
  o('martillo-solar', 'Martillo solar', 'rayo', 'rara', 'La lanza aturde a lo que alcanza.', { lanzaAturde: 1 }, 'lanza'),
  o('haz-partido', 'Haz partido', 'cristal', 'epica', 'Cada lanza cae en tres puntos.', { lanzaTriple: 1 }, 'lanza'),

  o('bobina-larga', 'Bobina larga', 'rayo', 'comun', 'El arco salta a tres enemigos más.', { arcoSaltos: 3 }, 'arco'),
  o('arco-plasma', 'Arco de plasma', 'fuego', 'rara', 'El arco quema cada eslabón.', { quemar: 0.7 }, 'arco'),
  o('tormenta-mano', 'Tormenta de mano', 'rayo', 'epica', 'Un tercio de las veces, el arco se dispara dos veces seguidas.', { arcoTormenta: 0.33 }, 'arco'),

  o('racimo', 'Bomba de racimo', 'fuego', 'rara', 'Cada bomba suelta tres más pequeñas.', { morteroRacimo: 1 }, 'mortero'),
  o('bomba-nitrogeno', 'Bomba de nitrógeno', 'hielo', 'rara', 'Las bombas congelan en lugar de dejar fuego.', { morteroHielo: 1 }, 'mortero'),
  o('bomba-vacio', 'Bomba de vacío', 'gravedad', 'epica', 'Las bombas atraen a la horda justo al caer.', { morteroVacio: 1 }, 'mortero'),

  o('balas-trazadoras', 'Balas trazadoras', 'rayo', 'comun', 'Las torretas sueltan chispas.', { chispa: 0.35 }, 'torreta'),
  o('municion-incendiaria', 'Munición incendiaria', 'fuego', 'rara', 'Las torretas prenden fuego.', { quemar: 0.45 }, 'torreta'),
  o('cabeza-criogenica', 'Cabeza criogénica', 'hielo', 'rara', 'La llave congela lo que golpea.', { congelar: 0.4 }, 'martillo'),
  o('llave-doble', 'Llave de doble filo', 'metal', 'rara', 'La llave golpea dos veces a menudo.', { doble: 0.5 }, 'martillo'),
  o('sello-toxico', 'Sello tóxico', 'veneno', 'comun', 'Los sellos envenenan.', { envenenar: 0.8 }, 'sello'),
  o('sello-tormenta', 'Sello de tormenta', 'rayo', 'rara', 'Los sellos sueltan chispas.', { chispa: 0.5 }, 'sello'),
  o('filo-hielo', 'Filo de hielo', 'hielo', 'rara', 'El disco congela a veces.', { congelar: 0.25 }, 'bumeran'),
  o('filo-fuego', 'Filo candente', 'fuego', 'comun', 'El disco quema.', { quemar: 0.6 }, 'bumeran'),
  o('semilla-venenosa', 'Semilla venenosa', 'veneno', 'comun', 'Las plantas envenenan.', { envenenar: 0.7 }, 'semillas'),
  o('semilla-espinosa', 'Semilla espinosa', 'cristal', 'rara', 'Las plantas golpean dos veces a menudo.', { doble: 0.45 }, 'semillas'),

  // ------------------------------------------------------------ cualquiera
  o('encendedor', 'Encendedor de plasma', 'fuego', 'comun', 'Uno de cada ocho golpes quema.', { quemar: 0.12 }),
  o('nucleo-magma', 'Núcleo de magma', 'fuego', 'rara', 'Uno de cada cuatro golpes quema.', { quemar: 0.25 }),
  o('ascua', 'Ascua viva', 'fuego', 'comun', 'Los críticos prenden fuego.', { critQuema: 1 }),
  o('botas-fuego', 'Suelas de lava', 'fuego', 'rara', 'Dejas un rastro de fuego al andar.', { estelaFuego: 1 }),
  o('detonador', 'Detonador', 'fuego', 'rara', 'Una de cada siete bajas estalla.', { estallar: 0.15 }),
  o('mechero-roto', 'Bidón agujereado', 'fuego', 'epica', 'Una de cada tres bajas estalla.', { estallar: 0.33 }),

  o('frasco-sulfato', 'Frasco de sulfato', 'veneno', 'comun', 'Uno de cada siete golpes envenena.', { envenenar: 0.15 }),
  o('toxina-velo', 'Toxina del velo', 'veneno', 'rara', 'Uno de cada tres golpes envenena.', { envenenar: 0.33 }),
  o('cepa-esporas', 'Cepa de esporas', 'veneno', 'rara', 'El veneno salta a los cercanos cuando su víctima cae.', { contagio: 1 }),

  o('escarcha-viva', 'Escarcha viva', 'hielo', 'comun', 'Uno de cada doce golpes congela.', { congelar: 0.08 }),
  o('corazon-glaciar', 'Corazón de glaciar', 'hielo', 'rara', 'Uno de cada seis golpes congela.', { congelar: 0.16 }),
  o('cero-absoluto', 'Cero absoluto', 'hielo', 'epica', 'Lo congelado recibe un 60 % más de daño.', { danoCongelados: 0.6 }),
  o('huellas-hielo', 'Huellas de escarcha', 'hielo', 'rara', 'Dejas hielo al andar: frena a quien te persigue.', { estelaHielo: 1 }),

  o('condensador-suelto', 'Condensador suelto', 'rayo', 'comun', 'Una chispa salta a otro enemigo de vez en cuando.', { chispa: 0.14 }),
  o('bobina-tesla', 'Bobina desnuda', 'rayo', 'rara', 'Una de cada tres veces, salta una chispa.', { chispa: 0.33 }),
  o('pararrayos', 'Pararrayos', 'rayo', 'rara', 'Cada 4 s cae un rayo sobre el enemigo más duro.', { pararrayos: 4 }),
  o('ojo-tormenta', 'Ojo de tormenta', 'rayo', 'epica', 'Cada 12 bajas cae un rayo enorme.', { rayoCadaBajas: 12 }),
  o('cristal-sobrecarga', 'Cristal de sobrecarga', 'rayo', 'epica', 'Cada 25 s, todo recarga un 40 % más rápido durante 6 s.', { sobrecarga: 25 }),

  o('mira-auditoria', 'Mira de auditoría', 'cristal', 'comun', 'Uno de cada cinco golpes marca: lo marcado recibe un 20 % más.', { marcar: 0.2 }),
  o('lente-ruptura', 'Lente de ruptura', 'cristal', 'rara', 'Los críticos revientan en una pequeña explosión.', { critEstalla: 1 }),
  o('gatillo-pelo', 'Gatillo de pelo', 'cristal', 'rara', 'Cada crítico acorta un poco todas las recargas.', { critRecarga: 0.12 }),
  o('canon-cristal', 'Cañón de cristal', 'cristal', 'epica', '+15 % de crítico y los críticos pegan el doble de fuerte.', { critico: 0.15, multCritico: 1 }),
  o('espejo-cuarzo', 'Espejo de cuarzo', 'cristal', 'rara', 'Cuando te golpean, tres rayos salen hacia lo más cercano.', { espejo: 1 }),

  o('doble-filo', 'Doble filo', 'metal', 'comun', 'Uno de cada diez golpes se repite.', { doble: 0.1 }),
  o('eco-helios', 'Eco de HELIOS', 'metal', 'epica', 'Una de cada cinco veces, la herramienta dispara otra vez.', { eco: 0.2 }),
  o('metralla', 'Metralla', 'metal', 'rara', 'Una de cada cuatro bajas lanza tres esquirlas.', { esquirlas: 0.25 }),
  o('moneda-ares', 'Moneda de ARES', 'metal', 'rara', 'Cuanta más chatarra lleves encima, más pegas (hasta +40 %).', { chatarraDano: 1 }),
  o('placa-ablativa', 'Placa ablativa', 'metal', 'comun', '+25 de integridad máxima.', { vida: 25 }),
  o('blindaje-reactivo', 'Blindaje reactivo', 'metal', 'rara', 'Al recibir un golpe, una onda aparta lo que tengas encima.', { ondaAlRecibir: 1 }),

  o('sanguijuela', 'Sanguijuela', 'vida', 'comun', 'Una de cada ocho bajas repara el traje.', { curarAlMatar: 0.12 }),
  o('semilla-vida', 'Semilla de vida', 'vida', 'comun', 'Repara 0,8 de integridad por segundo.', { regen: 0.8 }),
  o('escudo-esquirlas', 'Escudo de esquirlas', 'vida', 'rara', 'Cada 12 s, un escudo se traga el siguiente golpe.', { escudo: 12 }),
  o('ultima-voluntad', 'Última voluntad', 'vida', 'legendaria', 'Una vez por sector, sobrevives a un golpe mortal con un tercio de vida.', { ultimaVoluntad: 1 }),
  o('corazon-joven', 'Corazón joven', 'vida', 'rara', '+50 de integridad máxima.', { vida: 50 }),

  o('gravedad-bolsillo', 'Gravedad de bolsillo', 'gravedad', 'rara', 'Las bajas atraen a los enemigos cercanos.', { gravedadAlMatar: 1 }),
  o('reloj-roto', 'Reloj roto', 'gravedad', 'epica', 'Con menos de un tercio de vida, los enemigos van a la mitad.', { relojRoto: 1 }),
  o('ancla', 'Ancla de francotirador', 'gravedad', 'rara', 'Estando quieto, pegas un 45 % más.', { quietoDano: 0.45 }),
  o('servos-carrera', 'Servos de carrera', 'gravedad', 'rara', 'Mientras te mueves, pegas un 20 % más y vas un 10 % más rápido.', { movilDano: 0.2, velocidad: 0.1 }),
  o('botas-imantadas', 'Bobina de carga', 'gravedad', 'comun', '+50 % de radio para recoger chatarra.', { iman: 0.5 }),

  // ----------------------------------------------------------- legendarios
  o('nucleo-inestable', 'Núcleo inestable', 'fuego', 'legendaria', '+60 % de daño, pero el traje pierde 20 de integridad máxima.', { dano: 0.6, vida: -20 }),
  o('tratado-helios', 'Tratado de HELIOS', 'cristal', 'legendaria', 'Todo golpe marca y la mitad de los críticos revientan.', { marcar: 1, critEstalla: 0.5 }),
  o('corazon-tormenta', 'Corazón de tormenta', 'rayo', 'legendaria', 'La mitad de los golpes sueltan una chispa.', { chispa: 0.5 }),
];

export interface DefModulo {
  id: ModuloId;
  nombre: string;
  texto: string;
  familia: Familia;
  rareza: Rareza;
  /** Segundos de recarga. */
  recarga: number;
}

export const MODULOS: readonly DefModulo[] = [
  { id: 'pozo', nombre: 'Pozo gravitatorio', familia: 'gravedad', rareza: 'rara', recarga: 22, texto: 'Abre un pozo delante de ti: arrastra a la horda 3 s y revienta.' },
  { id: 'fase', nombre: 'Burbuja de fase', familia: 'gravedad', rareza: 'rara', recarga: 26, texto: '3 s intocable y un 40 % más rápido.' },
  { id: 'salto', nombre: 'Salto orbital', familia: 'rayo', rareza: 'comun', recarga: 14, texto: 'Saltas 14 m hacia delante y estalla donde estabas y donde caes.' },
  { id: 'meteoros', nombre: 'Lluvia de chatarra', familia: 'fuego', rareza: 'epica', recarga: 32, texto: 'Doce restos de la flota caen sobre lo que haya cerca.' },
  { id: 'senuelo', nombre: 'Señuelo de señal', familia: 'cristal', rareza: 'comun', recarga: 24, texto: 'Toda la horda persigue un eco tuyo 6 s, y luego revienta.' },
  { id: 'cero', nombre: 'Golpe de frío', familia: 'hielo', rareza: 'rara', recarga: 24, texto: 'Congela 3 s a todo lo que haya en 13 m.' },
  { id: 'nano', nombre: 'Nanoenjambre', familia: 'vida', rareza: 'rara', recarga: 30, texto: 'Repara 10 de integridad por segundo durante 6 s.' },
  { id: 'iman', nombre: 'Grúa de bolsillo', familia: 'metal', rareza: 'comun', recarga: 40, texto: 'Toda la chatarra del suelo viene hacia ti.' },
  { id: 'crono', nombre: 'Freno de tiempo', familia: 'gravedad', rareza: 'epica', recarga: 34, texto: 'Todo lo que te rodea va a un tercio de velocidad durante 6 s.' },
  { id: 'haz', nombre: 'Haz orbital', familia: 'rayo', rareza: 'epica', recarga: 28, texto: 'Un rayo barre 24 m hacia delante durante 2 s.' },
  { id: 'torre', nombre: 'Torre de plasma', familia: 'metal', rareza: 'rara', recarga: 26, texto: 'Planta una torre que dispara sola durante 10 s.' },
  { id: 'onda', nombre: 'Onda de choque', familia: 'fuego', rareza: 'comun', recarga: 16, texto: 'Aparta de golpe todo lo que tengas en 12 m y le hace daño.' },
];

export const OBJETOS_MODULO: readonly ObjetoDef[] = MODULOS.map((m) => ({
  id: `modulo-${m.id}`, nombre: m.nombre, texto: m.texto, familia: m.familia, rareza: m.rareza, efectos: {}, modulo: m.id,
}));

export const CATALOGO: readonly ObjetoDef[] = [...OBJETOS, ...OBJETOS_MODULO];
export const OBJETO_POR_ID = new Map(CATALOGO.map((c) => [c.id, c]));

// ----------------------------------------------------------------- arsenal

export type Totales = Efectos;

/** Todas las claves a cero, para leerlas en cada disparo sin preguntar si existen. */
const vacios = (): Efectos => Object.fromEntries(
  [...new Set([...CLAVES_GOLPE, ...CATALOGO.flatMap((c) => Object.keys(c.efectos))])].map((k) => [k, 0]),
) as unknown as Efectos;

export interface Arsenal {
  /** Sumas de lo que no depende de la herramienta. */
  fx: Efectos;
  /** Lo que se suma al golpear con cada herramienta. */
  golpe: Partial<Record<WeaponId, Golpe>>;
}

export function arsenalVacio(): Arsenal {
  return { fx: vacios(), golpe: {} };
}

/** El efecto del mismo tipo con tiempos (pararrayos, escudo…): el más rápido. */
const MENOR_MEJOR = new Set<keyof Efectos>(['escudo', 'pararrayos', 'sobrecarga', 'rayoCadaBajas']);

export function calcularArsenal(lista: readonly ObjetoDef[]): Arsenal {
  const a = arsenalVacio();
  const fx = a.fx as unknown as Record<string, number>;
  for (const def of lista) {
    for (const [k, v] of Object.entries(def.efectos) as [keyof Efectos, number][]) {
      if (def.arma && (CLAVES_GOLPE as readonly string[]).includes(k)) {
        const g = (a.golpe[def.arma] ??= { quemar: 0, envenenar: 0, congelar: 0, chispa: 0, marcar: 0, doble: 0 });
        g[k as keyof Golpe] += v;
      } else if (MENOR_MEJOR.has(k)) {
        fx[k] = fx[k] ? Math.min(fx[k], v) : v;
      } else {
        fx[k] = (fx[k] ?? 0) + v;
      }
    }
  }
  return a;
}

/** Probabilidad final de un efecto al golpear con `arma`: nunca es segura del todo. */
export function probGolpe(a: Arsenal, arma: WeaponId, clave: keyof Golpe) {
  return Math.min(0.9, a.fx[clave] + (a.golpe[arma]?.[clave] ?? 0));
}

// ------------------------------------------------------------------ botín

export interface PeticionBotin {
  n: number;
  /** Sube la probabilidad de rarezas altas. */
  suerte: number;
  /** Familias del sector: salen más. */
  afinidad: readonly Familia[];
  armas: readonly WeaponId[];
  tenidos: ReadonlySet<string>;
  /** Solo módulos o solo objetos pasivos. */
  solo?: 'modulos' | 'objetos';
}

export function pesoObjeto(def: ObjetoDef, p: PeticionBotin) {
  const rareza = RAREZAS[def.rareza];
  // Con suerte, lo común pierde peso y lo raro lo gana.
  const base = rareza.peso * (1 + p.suerte * rareza.indice * 1.2) / (1 + p.suerte * (rareza.indice === 0 ? 1 : 0));
  const afin = p.afinidad.includes(def.familia) ? 3 : 1;
  // Lo que cambia tu herramienta es lo más interesante que puede salir.
  const propio = def.arma ? 2.2 : 1;
  return base * afin * propio;
}

/** `n` objetos distintos que aún no tienes y que te sirven. */
export function tirarObjetos(rand: () => number, p: PeticionBotin): ObjetoDef[] {
  const cuales = CATALOGO.filter((c) => {
    if (p.tenidos.has(c.id)) return false;
    if (c.arma && !p.armas.includes(c.arma)) return false;
    if (p.solo === 'modulos') return !!c.modulo;
    if (p.solo === 'objetos') return !c.modulo;
    return true;
  });
  const salen: ObjetoDef[] = [];
  const quedan = [...cuales];
  while (salen.length < p.n && quedan.length) {
    const pesos = quedan.map((c) => pesoObjeto(c, p));
    let r = rand() * pesos.reduce((s, x) => s + x, 0);
    let k = 0;
    while (k < quedan.length - 1 && r >= pesos[k]) r -= pesos[k++];
    salen.push(quedan.splice(k, 1)[0]);
  }
  return salen;
}

/** Lo que cobra el mercader. */
export function precioObjeto(def: ObjetoDef, ventas: number) {
  const base = { comun: 45, rara: 80, epica: 140, legendaria: 240 }[def.rareza];
  return Math.round(base * (1 + ventas * 0.25));
}
