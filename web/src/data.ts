// Todo el diseño del juego vive aquí: armas, mejoras, enemigos y reliquias.
// Equilibrar es tocar números en este archivo, no lógica.

export type WeaponId = 'cortador' | 'pulso' | 'dron' | 'interferencia' | 'lanza' | 'arco' | 'mortero' | 'torreta' | 'martillo' | 'sello' | 'bumeran' | 'semillas';
import type { PersonajeId } from './personajes.ts';
export type EnemyId = 'recolector' | 'baliza' | 'segador' | 'saltador' | 'avispa' | 'caparazon' | 'sembrador';
export type PassiveId = 'velocidad' | 'iman' | 'blindaje' | 'enfriamiento' | 'area' | 'reparacion';
export type GearId = 'mochila' | 'tabla' | 'botas';

import { NUEVOS } from './enemies-nuevos.ts';
import { xpFor as xpForProgresion } from './progression.ts';

export interface WeaponLevel {
  damage: number;
  cooldown: number;   // segundos entre usos
  count: number;      // proyectiles, drones o pulsos simultáneos
  area: number;       // radio o alcance en metros
  /** Cuántos enemigos extra atraviesa el proyectil (solo cortador). */
  pierce?: number;
  /** Factor de velocidad que deja al enemigo (1 = sin freno). Solo interferencia. */
  slowFactor?: number;
  /** Segundos que dura el freno de este nivel. Interferencia y arco. */
  slowTime?: number;
  /** Saltos de enemigo a enemigo de cada descarga (solo arco). */
  saltos?: number;
  /** Segundos que arde el charco de plasma tras la explosión (solo mortero). */
  charco?: number;
  /** Cadencia interna de torretas; en semillas, intervalo del daño periódico. */
  rate?: number;
  /** Segundos que permanece un despliegue. */
  duration?: number;
  /** Qué cambia respecto al nivel anterior, para la pantalla de subida. */
  mejora?: string;
}

/**
 * Escalado del daño. Cada nivel de una herramienta multiplica su daño por
 * golpe (los DPS de los comentarios de WEAPONS son antes de esto), y cada
 * mejora elegida al subir de nivel suma potencia a todas: cuanto mejor es la
 * build, más pegan los números. Va a la par con la vida de los enemigos.
 */
export const ESCALADO = { porNivel: 0.2, porMejora: 0.025 };

/** Multiplicador de daño por golpe de una herramienta a ese nivel (1 en el primero). */
export function factorNivel(nivel: number) {
  return 1 + ESCALADO.porNivel * Math.max(0, nivel - 1);
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  color: string;
  blurb: string;
  /** Identidad de juego: una línea que dice cuándo brilla esta herramienta. */
  rol: string;
  levels: WeaponLevel[];
  /** Solo aparece en las mejoras de este personaje. */
  exclusiva?: PersonajeId;
}

// El astronauta no es un soldado: no hay armas, hay herramientas de misión
// usadas para algo para lo que no se diseñaron.
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  cortador: {
    id: 'cortador',
    name: 'Cortador de plasma',
    color: '#ffb347',
    blurb: 'La herramienta de muestreo del taladro. Dispara al Recolector más cercano.',
    rol: 'Precisión: daño monobjetivo a larga distancia. Tu respuesta contra Segadores y objetivos duros.',
    levels: [
      // DPS monobjetivo: 21.8. Rayo único, cadencia base.
      { damage: 12, cooldown: 0.55, count: 1, area: 16, mejora: 'Cuchilla de muestreo: un corte por descarga.' },
      // DPS: 26.7 (+22 %). La cadencia se nota desde el segundo nivel.
      { damage: 12, cooldown: 0.45, count: 1, area: 17, mejora: 'Gatillo rápido: dispara mucho más a menudo.' },
      // DPS: 48.9 (+83 %: segunda cuchilla).
      { damage: 11, cooldown: 0.45, count: 2, area: 18, mejora: 'Cuchilla gemela: dispara a dos objetivos.' },
      // DPS: 60.0 (+23 %) + perfora un enemigo extra.
      { damage: 12, cooldown: 0.4, count: 2, area: 19, pierce: 1, mejora: 'Corte profundo: atraviesa un enemigo extra.' },
      // DPS: 100.0 (+67 %: tercera cuchilla y más cadencia).
      { damage: 12, cooldown: 0.36, count: 3, area: 20, pierce: 1, mejora: 'Triple haz: tres cortes por descarga.' },
      // DPS: 150.0 (+50 %). Lluvia de plasma: cuatro cuchillas que atraviesan
      // filas enteras. Se queda por debajo del pulso contra cinco (164): el
      // cortador manda contra jefes, el área contra la horda.
      { damage: 12, cooldown: 0.32, count: 4, area: 22, pierce: 2, mejora: 'Plasma sobrecargado: cuatro cortes perforantes.' },
    ],
  },
  pulso: {
    id: 'pulso',
    name: 'Pulso EMP de ADA',
    color: '#5ee0ff',
    blurb: 'ADA descarga el condensador del traje. Daña todo lo que hay alrededor.',
    rol: 'Área: explosión que limpia multitudes. Cuantos más enemigos, mejor rinde.',
    levels: [
      // DPS por enemigo: 6.2 (con 5 enemigos: 30.8). Doble onda desde el nivel 5.
      { damage: 16, cooldown: 2.6, count: 1, area: 4.5, mejora: 'Descarga básica de ADA.' },
      // 8.0 (+29 %).
      { damage: 20, cooldown: 2.5, count: 1, area: 5.2, mejora: 'Condensador mayor: +daño y +radio.' },
      // 10.4 (+30 %).
      { damage: 24, cooldown: 2.3, count: 1, area: 6.0, mejora: 'Bobina doble: la onda llega más lejos.' },
      // 14.3 (+37 %).
      { damage: 30, cooldown: 2.1, count: 1, area: 6.8, mejora: 'Sobrecarga contenida: +daño de explosión.' },
      // 21.1 (+48 %) + eco: una segunda onda al 70 % del radio remata con el
      // 40 % del daño (29.6 cerca del jugador).
      { damage: 38, cooldown: 1.8, count: 1, area: 7.6, mejora: 'Eco de ADA: una segunda onda remata lo que queda cerca.' },
      // 32.9 (+56 %; 46 con el eco; con 5 enemigos: 164, supera al cortador
      // contra multitudes).
      { damage: 46, cooldown: 1.4, count: 1, area: 8.5, mejora: 'Tormenta EMP: doble onda que cubre media pantalla.' },
    ],
  },
  dron: {
    id: 'dron',
    name: 'Dron de mantenimiento',
    color: '#c9f27a',
    blurb: 'Un inspector de turbina reprogramado. Orbita a tu alrededor y golpea.',
    rol: 'Compañía: daño constante sin apuntar. Te protege mientras corres y recoges.',
    levels: [
      // DPS por enemigo en contacto: 19.5.
      { damage: 8, cooldown: 0.41, count: 1, area: 2.6, mejora: 'Un inspector zumbando a tu lado.' },
      // 23.7 (+21 %) + segundo dron (doble cobertura orbital).
      { damage: 9, cooldown: 0.38, count: 2, area: 2.8, mejora: 'Segundo dron: cubren más flancos.' },
      // 30.6 (+29 %).
      { damage: 11, cooldown: 0.36, count: 2, area: 3.0, mejora: 'Rotores afilados: +daño por golpe.' },
      // 39.4 (+29 %) + tercer dron.
      { damage: 13, cooldown: 0.33, count: 3, area: 3.2, mejora: 'Tercer dron: órbita completa.' },
      // 50.0 (+27 %).
      { damage: 15, cooldown: 0.3, count: 3, area: 3.4, mejora: 'Enjambre sincronizado: golpean más rápido.' },
      // 69.2 (+38 %) + cuarto dron.
      { damage: 18, cooldown: 0.26, count: 4, area: 3.6, mejora: 'Escuadrilla completa: cuatro inspectores.' },
    ],
  },
  interferencia: {
    id: 'interferencia',
    name: 'Campo de interferencia',
    color: '#d07bff',
    blurb: 'Ruido de radio a máxima potencia. Frena y desgasta a lo que entra.',
    rol: 'Control: zona que frena y desgasta. Aguanta dentro y la horda se deshace.',
    levels: [
      // DPS por enemigo: 8.9 + freno ×0.55 durante 0.6 s.
      { damage: 4, cooldown: 0.45, count: 1, area: 2.6, slowFactor: 0.55, slowTime: 0.6, mejora: 'Estática que frena al que entra.' },
      // 11.9 (+33 %).
      { damage: 5, cooldown: 0.42, count: 1, area: 3.0, slowFactor: 0.52, slowTime: 0.7, mejora: 'Más ancho de banda: +radio y +daño.' },
      // 15.8 (+33 %).
      { damage: 6, cooldown: 0.38, count: 1, area: 3.4, slowFactor: 0.5, slowTime: 0.8, mejora: 'Ruido denso: frena más fuerte.' },
      // 22.9 (+45 %).
      { damage: 8, cooldown: 0.35, count: 1, area: 3.8, slowFactor: 0.47, slowTime: 0.9, mejora: 'Interferencia total en la zona.' },
      // 33.3 (+46 %).
      { damage: 10, cooldown: 0.3, count: 1, area: 4.2, slowFactor: 0.44, slowTime: 1.0, mejora: 'La horda casi se detiene dentro.' },
      // 50.0 (+50 %). Radio 4.8 frente a 8.5 del pulso: exige aguantar cerca,
      // por eso su DPS en zona supera al del pulso (prima de riesgo).
      { damage: 13, cooldown: 0.26, count: 1, area: 4.8, slowFactor: 0.4, slowTime: 1.2, mejora: 'Apagón de HELIOS: freno y desgaste máximos.' },
    ],
  },
  // Las tres de área: cada una castiga a la horda amontonada de una forma
  // distinta (desde arriba, en cadena o con un charco que arde).
  lanza: {
    id: 'lanza',
    name: 'Lanza solar',
    color: '#ffe066',
    blurb: 'ARES-IX concentra el sol en órbita y lo deja caer donde más HELIOS se amontona.',
    rol: 'Área a distancia: golpes enormes desde el cielo sobre los grupos. Rompe cercos antes de que lleguen.',
    levels: [
      // Por enemigo dentro del círculo: 12.5 (aviso de 0,55 s antes del golpe).
      { damage: 30, cooldown: 2.4, count: 1, area: 2.6, mejora: 'Un rayo de sol cae sobre el grupo más denso.' },
      // 17.3 (+38 %).
      { damage: 38, cooldown: 2.2, count: 1, area: 2.9, mejora: 'Lente afinada: +daño y +radio.' },
      // 32.4 (+87 %: segundo rayo, a otro grupo).
      { damage: 34, cooldown: 2.1, count: 2, area: 3.1, mejora: 'Doble foco: dos rayos a dos grupos.' },
      // 46.3 (+43 %).
      { damage: 44, cooldown: 1.9, count: 2, area: 3.4, mejora: 'Espejos en órbita: +daño y +radio.' },
      // 81.2 (+75 %: tercer rayo).
      { damage: 46, cooldown: 1.7, count: 3, area: 3.7, mejora: 'Tres soles: tres rayos por descarga.' },
      // 154.7 (+90 %). Mediodía: cuatro columnas de luz que barren el campo.
      { damage: 58, cooldown: 1.5, count: 4, area: 4.2, mejora: 'Mediodía en Meta: cuatro rayos enormes.' },
    ],
  },
  arco: {
    id: 'arco',
    name: 'Arco de ADA',
    color: '#8ad7ff',
    blurb: 'ADA suelta el condensador en un rayo que salta de máquina en máquina y las deja aturdidas.',
    rol: 'Cadena: limpia filas sin apuntar y frena un instante a todo lo que toca.',
    levels: [
      // Daño total por descarga si encadena todos los saltos: 9 × 4 = 36 (32.7/s).
      { damage: 9, cooldown: 1.1, count: 1, area: 5, saltos: 3, slowFactor: 0.25, slowTime: 0.35, mejora: 'Una descarga que salta tres veces.' },
      // 50.0/s (+53 %).
      { damage: 10, cooldown: 1.0, count: 1, area: 5.5, saltos: 4, slowFactor: 0.25, slowTime: 0.35, mejora: 'Un salto más y más alcance entre objetivos.' },
      // 69.5/s (+39 %).
      { damage: 11, cooldown: 0.95, count: 1, area: 6, saltos: 5, slowFactor: 0.22, slowTime: 0.4, mejora: 'Bobina caliente: seis máquinas por descarga.' },
      // 146.7/s (+111 %: segunda cadena).
      { damage: 11, cooldown: 0.9, count: 2, area: 6, saltos: 5, slowFactor: 0.22, slowTime: 0.4, mejora: 'Doble arco: dos cadenas a la vez.' },
      // 227.5/s (+55 %).
      { damage: 13, cooldown: 0.8, count: 2, area: 6.5, saltos: 6, slowFactor: 0.2, slowTime: 0.45, mejora: 'Tormenta seca: más saltos y más daño.' },
      // 416.0/s (+83 %) si todas las cadenas encuentran objetivo: solo pasa
      // en plena horda; contra un jefe solo pega el primer eslabón.
      { damage: 13, cooldown: 0.75, count: 3, area: 7, saltos: 7, slowFactor: 0.18, slowTime: 0.5, mejora: 'Red de ADA: tres cadenas de ocho saltos.' },
    ],
  },
  mortero: {
    id: 'mortero',
    name: 'Mortero de chatarra',
    color: '#ff7a45',
    blurb: 'Bombas de chatarra con núcleo de plasma: estallan y dejan el suelo ardiendo.',
    rol: 'Explosiones: daño de área con empuje y un charco que sigue quemando. Ideal para pasillos y cercos.',
    levels: [
      // Por enemigo en la explosión: 12.2, más el charco (25 % cada 0,4 s).
      { damage: 22, cooldown: 1.8, count: 1, area: 2.4, charco: 1.5, mejora: 'Una bomba que estalla y arde.' },
      // 15.3 (+25 %).
      { damage: 26, cooldown: 1.7, count: 1, area: 2.7, charco: 1.5, mejora: 'Carga mayor: +daño y +radio.' },
      // 30.0 (+96 %: segunda bomba).
      { damage: 24, cooldown: 1.6, count: 2, area: 2.9, charco: 2, mejora: 'Tubo doble: dos bombas por descarga.' },
      // 40.0 (+33 %).
      { damage: 30, cooldown: 1.5, count: 2, area: 3.1, charco: 2.5, mejora: 'Plasma espeso: el charco dura más.' },
      // 68.6 (+71 %: tercera bomba).
      { damage: 32, cooldown: 1.4, count: 3, area: 3.3, charco: 2.5, mejora: 'Ráfaga de tres: cubre todo el frente.' },
      // 133.3 (+94 %). Bombardeo: cuatro bombas y charcos de tres segundos.
      { damage: 40, cooldown: 1.2, count: 4, area: 3.6, charco: 3, mejora: 'Bombardeo: cuatro bombas y charcos enormes.' },
    ],
  },
  torreta: {
    id: 'torreta', name: 'Torreta de despliegue', color: '#7566f5', exclusiva: 'mara-ilyin',
    blurb: 'Deja una torreta autónoma que cubre el terreno durante ocho segundos.',
    rol: 'Despliegue: convierte posiciones seguras en una red de fuego automático.',
    levels: [
      { damage: 8, cooldown: 4, count: 1, area: 12, rate: .40, duration: 8, mejora: 'Una torreta de despliegue.' },
      { damage: 9, cooldown: 3.7, count: 1, area: 13, rate: .36, duration: 8, mejora: 'Sensores y alimentación mejorados.' },
      { damage: 10, cooldown: 3.5, count: 2, area: 13, rate: .36, duration: 8, mejora: 'Dos torretas activas a la vez.' },
      { damage: 12, cooldown: 3.2, count: 2, area: 14, rate: .33, duration: 8, mejora: 'Cañón y alcance reforzados.' },
      { damage: 14, cooldown: 3, count: 3, area: 14, rate: .32, duration: 8, mejora: 'Red de tres torretas.' },
      { damage: 16, cooldown: 2.8, count: 3, area: 15, rate: .30, duration: 8, mejora: 'Despliegue continuo de máxima cadencia.' },
    ],
  },
  martillo: {
    id: 'martillo', name: 'Llave de impacto', color: '#ffad35', exclusiva: 'idris-okafor',
    blurb: 'Barre un arco delante de Idris y arroja la horda hacia atrás.',
    rol: 'Cuerpo a cuerpo: abre espacio con golpes anchos y empuje brutal.',
    levels: [
      { damage: 20, cooldown: .9, count: 1, area: 3.2, mejora: 'Golpe de llave en arco.' },
      { damage: 24, cooldown: .85, count: 1, area: 3.4, mejora: 'Más fuerza y alcance.' },
      { damage: 26, cooldown: .8, count: 2, area: 3.6, mejora: 'Golpe de vuelta.' },
      { damage: 32, cooldown: .75, count: 2, area: 3.9, mejora: 'Barrido reforzado.' },
      { damage: 38, cooldown: .7, count: 2, area: 4.2, mejora: 'Impacto industrial.' },
      { damage: 44, cooldown: .6, count: 2, area: 4.6, mejora: 'Doble golpe demoledor.' },
    ],
  },
  sello: {
    id: 'sello', name: 'Sello de auditoría', color: '#e151a5', exclusiva: 'noa-herrera',
    blurb: 'Sellos guiados marcan objetivos para que reciban un 20 % más de daño.',
    rol: 'Daño y control: prepara objetivos duros y hace rendir a todo el equipo.',
    levels: [
      { damage: 14, cooldown: 1.1, count: 1, area: 18, mejora: 'Un sello guiado.' },
      { damage: 16, cooldown: 1, count: 1, area: 19, mejora: 'Auditoría más rápida.' },
      { damage: 16, cooldown: .9, count: 2, area: 20, mejora: 'Dos sellos por descarga.' },
      { damage: 20, cooldown: .8, count: 2, area: 20, mejora: 'Sello reforzado.' },
      { damage: 24, cooldown: .7, count: 3, area: 21, mejora: 'Tres expedientes simultáneos.' },
      { damage: 30, cooldown: .6, count: 3, area: 22, mejora: 'Auditoría total.' },
    ],
  },
  bumeran: {
    id: 'bumeran', name: 'Disco de antena', color: '#9bdc3c', exclusiva: 'taro-sato',
    blurb: 'Discos que atraviesan a la horda a la ida y al volver.',
    rol: 'Movilidad: abre corredores y recompensa reposicionarse sin parar.',
    levels: [
      { damage: 12, cooldown: 1.4, count: 1, area: 10, mejora: 'Un disco de ida y vuelta.' },
      { damage: 14, cooldown: 1.3, count: 1, area: 11, mejora: 'Más alcance y daño.' },
      { damage: 14, cooldown: 1.2, count: 2, area: 12, mejora: 'Dos discos en abanico.' },
      { damage: 18, cooldown: 1.1, count: 2, area: 12, mejora: 'Borde cargado.' },
      { damage: 20, cooldown: 1, count: 3, area: 13, mejora: 'Tres discos en abanico.' },
      { damage: 24, cooldown: .8, count: 3, area: 14, mejora: 'Barrido de señal completo.' },
    ],
  },
  semillas: {
    id: 'semillas', name: 'Semillero solar', color: '#53cc8c', exclusiva: 'amara-keita',
    blurb: 'Hace brotar zarzas que dañan y frenan durante tres segundos.',
    rol: 'Apoyo: siembra zonas seguras y desgasta grupos enteros.',
    levels: [
      { damage: 6, cooldown: 2, count: 1, area: 2.2, rate: .5, duration: 3, mejora: 'Una zarza solar.' },
      { damage: 7, cooldown: 1.9, count: 1, area: 2.4, rate: .5, duration: 3, mejora: 'Zarza más ancha.' },
      { damage: 8, cooldown: 1.8, count: 2, area: 2.6, rate: .5, duration: 3, mejora: 'Dos semillas por descarga.' },
      { damage: 10, cooldown: 1.6, count: 2, area: 2.9, rate: .5, duration: 3, mejora: 'Espinas solares.' },
      { damage: 12, cooldown: 1.5, count: 3, area: 3.1, rate: .5, duration: 3, mejora: 'Tres semilleros.' },
      { damage: 14, cooldown: 1.3, count: 3, area: 3.4, rate: .5, duration: 3, mejora: 'Jardín ofensivo completo.' },
    ],
  },
};

export interface PassiveDef {
  id: PassiveId;
  name: string;
  blurb: string;
  max: number;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  velocidad: { id: 'velocidad', name: 'Servos de pierna', blurb: '+10 % velocidad de movimiento.', max: 5 },
  iman: { id: 'iman', name: 'Electroimán', blurb: '+35 % radio para recoger chatarra.', max: 5 },
  blindaje: { id: 'blindaje', name: 'Placas de blindaje', blurb: '+20 de integridad máxima y la restaura.', max: 5 },
  enfriamiento: { id: 'enfriamiento', name: 'Disipador térmico', blurb: '−8 % tiempo de recarga de todo.', max: 5 },
  area: { id: 'area', name: 'Amplificador de ADA', blurb: '+10 % alcance y radio de todo.', max: 5 },
  reparacion: { id: 'reparacion', name: 'Nanosellador', blurb: 'Repara 0,7 de integridad por segundo.', max: 5 },
};

/** Números de cada pasiva por nivel (las fórmulas viven en `game.ts`; ver parche). */
export interface PassiveTuning {
  /** Efecto acumulado con `n` niveles. */
  formula: string;
  /** Valor con 5 niveles. */
  aMax: string;
  /** Con qué armas combina mejor. */
  sinergia: WeaponId[];
}

export const PASSIVE_TUNING: Record<PassiveId, PassiveTuning> = {
  velocidad: { formula: 'velocidad × (1 + 0,10 × n)', aMax: '×1,61 de velocidad', sinergia: ['dron', 'interferencia'] },
  iman: { formula: 'radio × (1 + 0,35 × n)', aMax: '×2,75 de radio', sinergia: ['dron', 'cortador'] },
  blindaje: { formula: '+20 de integridad máxima por nivel', aMax: '+100 de integridad', sinergia: ['interferencia', 'dron'] },
  enfriamiento: { formula: 'recarga × 0,92ⁿ', aMax: '×0,66 de recarga (+52 % de DPS)', sinergia: ['cortador', 'pulso'] },
  area: { formula: 'radio × (1 + 0,10 × n)', aMax: '×1,61 de radio (×2,6 de superficie)', sinergia: ['pulso', 'interferencia'] },
  reparacion: { formula: '+0,7 de integridad/s por nivel', aMax: '3,5/s (aguanta el desgaste leve)', sinergia: ['interferencia', 'dron'] },
};

/**
 * Sinergias arma × pasiva (Alta / Media / Baja): qué pasiva buscar según tu arma.
 * Regla anti-trampa: ninguna opción es siempre peor que otra; cada arma es la
 * mejor en su escenario (jefe / multitud lejana / cuerpo a cuerpo / zona).
 */
export const SINERGIAS: Record<WeaponId, { alta: PassiveId[]; media: PassiveId[] }> = {
  cortador: { alta: ['enfriamiento', 'area'], media: ['velocidad', 'iman'] },
  pulso: { alta: ['area', 'enfriamiento'], media: ['velocidad', 'blindaje'] },
  dron: { alta: ['velocidad', 'area'], media: ['enfriamiento', 'blindaje', 'reparacion'] },
  interferencia: { alta: ['area', 'blindaje', 'reparacion'], media: ['enfriamiento', 'velocidad'] },
  lanza: { alta: ['area', 'enfriamiento'], media: ['velocidad', 'iman'] },
  arco: { alta: ['enfriamiento', 'area'], media: ['velocidad', 'reparacion'] },
  mortero: { alta: ['area', 'enfriamiento'], media: ['blindaje', 'velocidad'] },
  torreta: { alta: ['enfriamiento', 'area'], media: ['blindaje', 'reparacion'] },
  martillo: { alta: ['area', 'blindaje'], media: ['velocidad', 'reparacion'] },
  sello: { alta: ['enfriamiento', 'area'], media: ['velocidad', 'iman'] },
  bumeran: { alta: ['area', 'velocidad'], media: ['enfriamiento', 'iman'] },
  semillas: { alta: ['area', 'enfriamiento'], media: ['reparacion', 'blindaje'] },
};

/** DPS monobjetivo teórico de un nivel de arma (daño × count / recarga). */
export function dpsMono(id: WeaponId, nivel: number): number {
  const s = WEAPONS[id].levels[nivel - 1];
  return (s.damage * s.count) / s.cooldown;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  damage: number;     // por segundo en contacto
  radius: number;
  scrap: number;      // chatarra que suelta
  height: number;     // a qué altura vuela
  blurb: string;
}

// Vida ×1,35 respecto a la primera versión, a la par con el escalado del
// daño (ESCALADO). Medido con el bot que elige al azar, 5 partidas cada uno:
// antes ganaba 3 de 5; así gana 2 de 5 (media 385 s); con ×1,8 no ganaba ninguna.
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  recolector: {
    id: 'recolector', name: 'Recolector', hp: 14, speed: 3.1, damage: 10, radius: 0.55,
    scrap: 1, height: 0.7,
    blurb: 'Dron de extracción. Va directo a por la señal de ADA.',
  },
  baliza: {
    id: 'baliza', name: 'Baliza', hp: 11, speed: 1.6, damage: 0, radius: 0.5,
    scrap: 4, height: 2.6,
    blurb: 'No ataca. Triangula la señal: mientras viva, llegan más Recolectores.',
  },
  segador: {
    id: 'segador', name: 'Segador', hp: 350, speed: 2.1, damage: 30, radius: 1.3,
    scrap: 25, height: 1.2,
    blurb: 'Una cosechadora agrícola de siglos. Lenta, enorme, y suelta reliquias.',
  },
  ...NUEVOS,
};

export interface RelicDef {
  id: string;
  name: string;
  lore: string;
  unlocks: string | null;
  fact: string;       // dato real: la parte que se aprende
}

// Las reliquias del documento de diseño: pruebas de lo que hizo HELIOS en
// Meta, cada una con un dato real de la exploración espacial detrás.
export const RELICS: RelicDef[] = [
  {
    id: 'panel', name: 'Panel solar de una granja',
    lore: 'Alimentó una ciudad de Meta hasta que el velo tapó el sol.',
    unlocks: 'Array fotovoltaico',
    fact: 'Juno fue la primera nave en llegar a Júpiter alimentada solo por paneles solares (2016), a cinco veces la distancia de la Tierra al Sol.',
  },
  {
    id: 'rtg', name: 'Cápsula RTG de una sonda',
    lore: 'Cuando el sol se fue, solo el plutonio siguió dando luz.',
    unlocks: 'Generador de radioisótopos',
    fact: 'Las Voyager 1 y 2 funcionan desde 1977 con generadores de plutonio-238: el calor de su desintegración se convierte en electricidad.',
  },
  {
    id: 'antena', name: 'Antena de red profunda',
    lore: 'Pidieron ayuda fuera de Meta. Esta vez alguien respondió.',
    unlocks: 'Antena de alta ganancia',
    fact: 'La Red de Espacio Profundo de la NASA tiene antenas de 70 m en Goldstone, Madrid y Canberra: separadas 120°, siempre hay una mirando a cada nave.',
  },
  {
    id: 'nodo', name: 'Nodo de HELIOS inactivo',
    lore: 'El acta que encendió a HELIOS: 340 votos a favor y ninguna cláusula para apagarlo.',
    unlocks: 'Módulo de interferencia',
    fact: 'La erupción del Pinatubo (1991) lanzó unos 15 millones de toneladas de SO₂ a la estratosfera y enfrió el planeta cerca de medio grado durante un año.',
  },
  {
    id: 'caja', name: 'Caja negra de un lanzador',
    lore: '400 personas intentaron atravesar el velo. Falló la redundancia de la etapa dos.',
    unlocks: 'Unidad de control redundante',
    fact: 'En el Apolo 13, el motor central de la segunda etapa del Saturno V se apagó antes de tiempo; los otros cuatro ardieron más y la misión llegó a órbita.',
  },
  {
    id: 'invernadero', name: 'Placa de invernadero orbital',
    lore: 'Cultivaron bajo lámparas cuando el cielo dejó de servir.',
    unlocks: 'Módulo de soporte vital',
    fact: 'En 2015 la tripulación de la Estación Espacial comió por primera vez lechuga cultivada en órbita, con el experimento Veggie.',
  },
  {
    id: 'dibujo', name: 'Dibujo infantil plastificado',
    lore: 'Una casa, un sol amarillo, cuatro figuras. Así era el cielo de Meta.',
    unlocks: null,
    fact: 'Nada. Solo eso.',
  },
];

export const RUN = {
  length: 600,            // diez minutos hasta la ventana de lanzamiento
  maxHp: 100,
  speed: 5.2,             // velocidad de referencia de los héroes (×MOVE.speedMul en juego)
  pickupRadius: 5.2,
  arena: 130,             // medio lado del mapa jugable
  // Experiencia para pasar del nivel n al n+1 (curva de progresión:
  // arranque menos regalado, tramo tardío más barato; mismo total).
  xpFor: (level: number) => xpForProgresion(level),
};

// Físicas del astronauta: todo el ajuste del movimiento vive aquí.
export const MOVE = {
  speedMul: 1.4,     // los héroes van a 5,9–9,1 m/s (base 7,3): Meta es grande
  groundRate: 15,    // 1/s: convergencia a la velocidad deseada en suelo
  airRate: 4,        // 1/s: control en el aire (menor = con inercia lunar)
  gravity: 26,       // m/s²
  jumpSpeed: 9.4,    // m/s (~1.7 m de salto)
  maxFall: 24,       // m/s de caída máxima
  boardRate: 6,      // 1/s: en la aerotabla se derrapa un poco
  jetRate: 6,        // 1/s: control con la mochila cohete encendida
  jetAccel: 44,      // m/s² de empuje (contra 26 de gravedad)
  jetMaxUp: 7,       // m/s de subida máxima
  jetCeiling: 9,     // m sobre el suelo: más arriba ya no sube
  dashDist: 7,       // m que recorre el acelerón de las botas
  dashTime: 0.2,     // s que dura
  sprintMul: 1.45,   // Shift: cuánto más rápido se corre
  aguanteSegundos: 4, // s de sprint con el aguante lleno
  aguanteRecarga: 2.5, // s para recuperarlo entero
  aguantePausa: 0.5, // s sin correr antes de empezar a recuperarlo
  aguanteMinimo: 0.3, // agotado, hace falta esto para volver a correr
  coyote: 0.12,      // s de perdón al salir de una loma
  buffer: 0.15,      // s de salto anticipado antes de tocar suelo
};

// ---------------------------------------------------------------- Equipo

/** Números de un nivel de equipo de movilidad. */
export interface GearLevel {
  /** Mochila: segundos de combustible. Botas: recarga en s. Tabla: multiplicador de velocidad. */
  valor: number;
  mejora: string;
}

export interface GearDef {
  id: GearId;
  name: string;
  color: string;
  blurb: string;
  /** Cómo se usa, para la carta y el aviso al equiparlo. */
  control: string;
  levels: GearLevel[];
}

// Equipo de movilidad: sale en las cartas de subida de nivel como una mejora
// más. Cambia cómo te mueves, no cuánto daño haces.
export const GEAR: Record<GearId, GearDef> = {
  mochila: {
    id: 'mochila',
    name: 'Mochila cohete',
    color: '#ff8a3d',
    blurb: 'Dos depósitos de plasma a los lados de ADA. Vuela por encima de la horda: arriba no te tocan.',
    control: 'Mantén Espacio en el aire',
    levels: [
      { valor: 1.1, mejora: 'Depósitos básicos: 1,1 s de vuelo.' },
      { valor: 1.8, mejora: 'Depósitos ampliados: 1,8 s de vuelo y recarga más rápida.' },
      { valor: 2.6, mejora: 'Toberas dobles: 2,6 s de vuelo y vas más rápido en el aire.' },
    ],
  },
  tabla: {
    id: 'tabla',
    name: 'Aerotabla',
    color: '#5ee0ff',
    blurb: 'Una tabla de chatarra que flota sobre plasma. Te subes sola al correr y vuela sobre el hielo.',
    control: 'Automática al moverte',
    levels: [
      { valor: 1.3, mejora: 'Tabla flotante: +30 % de velocidad al deslizarte.' },
      { valor: 1.45, mejora: 'Almohadillas finas: +45 % de velocidad.' },
      { valor: 1.6, mejora: 'Aerotabla de carreras: +60 % y aún más rápida sobre lagos helados.' },
    ],
  },
  botas: {
    id: 'botas',
    name: 'Botas de impulso',
    color: '#ffd25a',
    blurb: 'Propulsores en los talones: un acelerón que te saca de cualquier cerco.',
    control: 'Mayúsculas (Shift)',
    levels: [
      { valor: 2.4, mejora: 'Acelerón de 7 m cada 2,4 s.' },
      { valor: 1.7, mejora: 'Recarga de 1,7 s.' },
      { valor: 1.2, mejora: 'Recarga de 1,2 s y eres intocable durante el acelerón.' },
    ],
  },
};
