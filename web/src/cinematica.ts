import * as THREE from 'three';
import { PALETA, barril, caja, conDetalle, cono, pieza, toon, toro } from './modelos/kit.ts';
import type { Modelo } from './modelos/kit.ts';
import { crearAdaNoa } from './modelos/ada.ts';
import { crearAstronauta } from './modelos/astronauta.ts';
import { crearBaliza } from './modelos/baliza.ts';
import { crearNpcVigia } from './modelos/npc-vigia.ts';
import { crearRecolector } from './modelos/recolector.ts';
import { crearRefugio } from './modelos/refugio.ts';
import { crearTorreVelo } from './modelos/torre-velo.ts';
import { crearAvispa } from './modelos/avispa.ts';
import { crearDragon } from './modelos/dragon.ts';
import { crearGolem } from './modelos/golem.ts';
import { crearHeraldo } from './modelos/heraldo.ts';
import { crearNave } from './modelos/nave.ts';
import { crearSabueso } from './modelos/sabueso.ts';
import { azar, cielo, monotona, planeta, punto, sonar, soplido, suave, tono, tramo, velo } from './intro.ts';
import { tocarBanda } from './musica.ts';
import {
  DURACION, ESTALLA, LETRAS_POR_SEGUNDO, ORDEN, PLANOS, RELIQUIAS, ROTULOS, VENTANA, VUELVE_EL_SOL, en, planoEn,
} from './cinematica-guion.ts';
import type { Plano, Rotulo } from './cinematica-guion.ts';

// META SPACE — Cinemática de la historia, entre la intro del título y el menú.
//
// Once planos en algo más de un minuto, que cuentan la historia entera (el
// guion y sus tiempos, en cinematica-guion.ts): Meta ardía y encendió HELIOS;
// el velo lo congeló y su gente vive bajo tierra; pidió ayuda y Ares, el mundo
// del jugador, mandó su flota; HELIOS vio en la ayuda una amenaza para el
// velo, soltó al Dragón y a sus enjambres, bajó con sus colosos a las ciudades
// de Ares y lo cubrió con el velo hasta romperlo; de Ares queda una nave, la
// del especialista; la llave para apagar HELIOS es ADA, el módulo 7, que Noa
// Herrera escondió en Meta; y así se juega: diez minutos por sector hasta que
// el cohete sube la orden y vuelve el sol, y siete reliquias para todo Meta.
// Como en la intro, cada fotograma sale solo del
// tiempo `t`: disparos, explosiones, esquirlas y chispas se recalculan desde
// el guion, así que saltar a cualquier segundo es exacto y las capturas se
// repiten. Todo en código con el kit de modelos, sin assets; la música
// (musica.ts) y los efectos de sonido también se sintetizan aquí mismo. Con
// música, la imagen sigue al reloj del audio para que no se desfasen. Se salta
// con Esc o el botón; al acabar, el juego abre el menú.

export interface CinematicaOptions {
  /** Solo para capturas: congela la cinemática en este segundo, sin teclas ni botón de saltar. */
  fijo?: number;
  /** Segundo desde el que empieza, para verla por planos. */
  inicio?: number;
  /** La abre un gesto de quien mira: el sonido puede arrancar desde el primer fotograma. */
  sonido?: boolean;
  /** Se llama en cada fotograma con el segundo en curso. */
  alAvanzar?: (t: number) => void;
}

// ------------------------------------------------------------- guion

export { DURACION, ESTALLA, LETRAS_POR_SEGUNDO, PLANOS, ROTULOS, planoEn } from './cinematica-guion.ts';
export type { Plano, Rotulo } from './cinematica-guion.ts';

/** Cortes de plano que pasan por negro (el estallido corta en blanco). */
const CORTES = ORDEN.slice(1).filter((p) => p !== 'especialista').map((p) => PLANOS[p][0]);

// ------------------------------------------------------------- batalla

const FLOTA = 6;
const ENJAMBRE = 14;
/** Quién cae en la batalla y cuándo: índice → segundo. */
const enGuerra = (lista: readonly (readonly [number, number])[]) => new Map(lista.map(([i, s]) => [i, en('guerra', s)] as [number, number]));
const CAE_AVISPA = enGuerra([[1, 1.1], [6, 1.8], [3, 2.6], [9, 3.4], [12, 4.7], [5, 5.5]]);
const CAE_NAVE = enGuerra([[2, 3.95], [4, 5.35]]);
const viva = (cae: Map<number, number>, i: number, t: number) => (cae.get(i) ?? Infinity) > t;

/** La flota de Ares, a la izquierda, avanza despacio hacia el enjambre. */
function naveEnGuerra(i: number, t: number, v: THREE.Vector3): THREE.Vector3 {
  const tl = t - PLANOS.guerra[0];
  return v.set(
    -18 + (i % 3) * 5 + tl * 0.5 + Math.sin(t * 0.9 + i) * 0.7,
    -4 + Math.floor(i / 3) * 4.6 + (i % 2) * 0.9 + Math.sin(t * 1.3 + i * 2) * 0.5,
    -28 - (i % 3) * 5,
  );
}

/** El enjambre de HELIOS, a la derecha, se mueve como avispas: a tirones. */
function avispaEnGuerra(j: number, t: number, v: THREE.Vector3): THREE.Vector3 {
  const tl = t - PLANOS.guerra[0];
  return v.set(
    9 + (j % 4) * 2.6 - tl * 0.6 + Math.sin(t * 1.7 + j) * 0.9,
    -5 + Math.floor(j / 4) * 2.9 + Math.sin(t * 2.1 + j * 1.3) * 0.7,
    -26 - (j % 3) * 5 + Math.cos(t * 1.1 + j) * 0.8,
  );
}

const heraldoEnGuerra = (t: number, v: THREE.Vector3) => v.set(17, 8.5 + Math.sin(t * 1.1) * 0.6, -44);

const DESTINO_FLOTA = new THREE.Vector3(75, 26, -460);
/** La flota sale de la órbita de Ares en fila, una nave tras otra, hacia Meta. */
function naveEnAres(i: number, tl: number, v: THREE.Vector3): THREE.Vector3 {
  v.set(-6 + i * 2.2, -3 + (i % 2) * 1.6, -80 - i * 2);
  return v.lerp(DESTINO_FLOTA, (Math.max(0, tl - i * 0.22) / 9) ** 1.4);
}

interface Rayo {
  plano: Plano;
  t0: number;
  dur: number;
  de: THREE.Vector3;
  a: THREE.Vector3;
  color: THREE.Color;
  grosor: number;
  largo: number;
}

interface Estallido {
  plano: Plano;
  t: number;
  pos: THREE.Vector3;
  /** Tamaño en metros: manda en chispas, destello, luz y temblor. */
  tam: number;
}

/**
 * Todo el fuego de la cinemática, decidido de antemano: cada rayo sale de
 * donde está el que dispara y llega a donde estará su blanco, y cada baja
 * tiene el disparo que la causa. Así la batalla es la misma en cada pase.
 */
function guionDeFuego(): { rayos: Rayo[]; estallidos: Estallido[] } {
  const rayos: Rayo[] = [];
  const estallidos: Estallido[] = [];
  const cian = new THREE.Color(PALETA.ada), rojo = new THREE.Color(PALETA.helios), purpura = new THREE.Color(PALETA.purpuraBrillo);
  const disparo = (t0: number, dur: number, de: THREE.Vector3, a: THREE.Vector3, color: THREE.Color, grosor: number, impacto: number, largo = grosor * 24) => {
    rayos.push({ plano: 'guerra', t0, dur, de, a, color, grosor, largo });
    if (impacto > 0) estallidos.push({ plano: 'guerra', t: t0 + dur, pos: a.clone(), tam: impacto });
  };
  const morroNave = new THREE.Vector3(1.6, 0, 0), morroAvispa = new THREE.Vector3(-1.1, 0, 0);
  const [ini, fin] = PLANOS.guerra;
  const DUR = 0.42;

  // Fuego cruzado: la flota dispara en cyan y el enjambre en rojo.
  for (let k = 0, t0 = ini + 0.15; t0 < fin - 0.5; k++, t0 += 0.16) {
    if (k % 2 === 0) {
      const i = (k * 5 + 1) % FLOTA;
      let j = (k * 7) % ENJAMBRE;
      if (!viva(CAE_NAVE, i, t0)) continue;
      for (let n = 0; n < ENJAMBRE && !viva(CAE_AVISPA, j, t0 + DUR); n++) j = (j + 1) % ENJAMBRE;
      disparo(t0, DUR, naveEnGuerra(i, t0, new THREE.Vector3()).add(morroNave), avispaEnGuerra(j, t0 + DUR, new THREE.Vector3()), cian, 0.09, 0.5);
    } else {
      const j = (k * 3) % ENJAMBRE;
      let i = (k * 5) % FLOTA;
      if (!viva(CAE_AVISPA, j, t0)) continue;
      for (let n = 0; n < FLOTA && !viva(CAE_NAVE, i, t0 + DUR); n++) i = (i + 1) % FLOTA;
      disparo(t0, DUR, avispaEnGuerra(j, t0, new THREE.Vector3()).add(morroAvispa), naveEnGuerra(i, t0 + DUR, new THREE.Vector3()), rojo, 0.075, 0.5);
    }
  }
  // Cada avispa que cae, la derriba un disparo de la flota.
  for (const [j, tc] of CAE_AVISPA) {
    let i = j % FLOTA;
    while (!viva(CAE_NAVE, i, tc - DUR)) i = (i + 1) % FLOTA;
    disparo(tc - DUR, DUR, naveEnGuerra(i, tc - DUR, new THREE.Vector3()).add(morroNave), avispaEnGuerra(j, tc, new THREE.Vector3()), cian, 0.11, 0);
    estallidos.push({ plano: 'guerra', t: tc, pos: avispaEnGuerra(j, tc, new THREE.Vector3()), tam: 2.4 });
  }
  // El Heraldo bombardea desde arriba con orbes lentos; uno acaba con la nave 4.
  const boca = new THREE.Vector3(-1.5, -1, 0);
  for (let n = 0, t0 = ini + 0.7; t0 < fin - 0.9; n++, t0 += 0.75) {
    const i = (n * 2 + 1) % FLOTA;
    if (!viva(CAE_NAVE, i, t0 + 0.8) || i === 4) continue;
    disparo(t0, 0.8, heraldoEnGuerra(t0, new THREE.Vector3()).add(boca), naveEnGuerra(i, t0 + 0.8, new THREE.Vector3()), purpura, 0.3, 0.9, 1.4);
  }
  const t4 = CAE_NAVE.get(4)!;
  disparo(t4 - 0.8, 0.8, heraldoEnGuerra(t4 - 0.8, new THREE.Vector3()).add(boca), naveEnGuerra(4, t4, new THREE.Vector3()), purpura, 0.34, 0, 1.6);
  // La nave 2 la quema el aliento del Dragón (ver `aliento`).
  for (const [i, tc] of CAE_NAVE) estallidos.push({ plano: 'guerra', t: tc, pos: naveEnGuerra(i, tc, new THREE.Vector3()), tam: 3.4 });

  // En la ciudad estallan edificios y retumban los pisotones del Titán.
  for (const [s, x, y, z, tam] of [
    [0.4, -30, 24, -110, 7], [1.1, 46, 16, -140, 8], [2.0, -72, 28, -160, 9], [3.0, 22, 34, -125, 8], [3.45, -12, 18, -95, 6],
    [1.15, 5, 0.4, -19, 2.4], [3.15, 5, 0.4, -19, 2.4],
  ] as const) estallidos.push({ plano: 'ciudad', t: en('ciudad', s), pos: new THREE.Vector3(x, y, z), tam });

  // Y Ares.
  estallidos.push({ plano: 'caida', t: ESTALLA, pos: CENTRO_CAIDA.clone(), tam: 30 });
  // En la misión: el despegue del cohete y el velo que se rompe cuando lo atraviesa.
  estallidos.push({ plano: 'mision', t: VENTANA, pos: new THREE.Vector3(COHETE.x, 2, COHETE.z), tam: 6 });
  estallidos.push({ plano: 'mision', t: VUELVE_EL_SOL, pos: new THREE.Vector3(COHETE.x, 400, COHETE.z), tam: 30 });
  return { rayos, estallidos };
}

/** Donde está el cohete de la misión, en el horizonte del sector. */
const COHETE = { x: 26, z: -110 };

/** Donde está Ares cuando se rompe. */
const CENTRO_CAIDA = new THREE.Vector3(0, -4, -175);

// ------------------------------------------------------------ estilo

const CSS = `
.msc { position: fixed; inset: 0; z-index: 61; overflow: hidden; background: #000; container-type: size;
  font-family: 'Rubik', ui-rounded, system-ui, sans-serif; user-select: none; -webkit-user-select: none;
  transition: opacity .6s ease; }
.msc--fuera { opacity: 0; pointer-events: none; }
.msc__lienzo { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.msc__banda { position: absolute; left: 0; right: 0; height: 9cqh; background: #000; pointer-events: none; will-change: transform; }
.msc__banda--arriba { top: 0; }
.msc__banda--abajo { bottom: 0; }
.msc__narra { position: absolute; left: 16px; right: 16px; bottom: calc(9cqh + 2.6cqh); margin: 0; text-align: center; color: #f3f4ff;
  font-weight: 700; font-size: clamp(14px, min(3.4cqw, 3.8cqh), 32px); line-height: 1.25; opacity: 0; pointer-events: none;
  text-shadow: 0 2px 0 #0b0a1d, 0 0 18px rgba(5, 6, 26, .9); }
.msc__helios { position: absolute; left: 16px; right: 16px; top: calc(9cqh + 3cqh); margin: 0; text-align: center;
  color: ${PALETA.helios}; font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-weight: 800;
  letter-spacing: .16em; font-size: clamp(11px, min(1.9cqw, 2.8cqh), 22px); opacity: 0; pointer-events: none;
  text-shadow: 0 0 14px rgba(255, 74, 58, .75), 0 2px 0 #1a0508; }
.msc__resto { opacity: 0; }
.msc__senal { position: absolute; left: 0; top: 0; margin: 0; display: flex; align-items: center; gap: .55em; white-space: nowrap;
  color: ${PALETA.ada}; font-weight: 800; letter-spacing: .14em; font-size: clamp(10px, 1.3cqw, 14px); opacity: 0;
  pointer-events: none; text-shadow: 0 0 10px rgba(94, 224, 255, .8), 0 2px 0 #06101c; will-change: transform, opacity; }
.msc__senal i { width: .6em; height: .6em; border-radius: 50%; background: ${PALETA.ada}; box-shadow: 0 0 10px ${PALETA.ada}; }
.msc__blanco, .msc__negro { position: absolute; inset: 0; pointer-events: none; }
.msc__blanco { background: #fff6e8; opacity: 0; }
.msc__negro { background: #000; }
.msc__saltar { position: absolute; top: max(10px, calc(4.5cqh - 17px)); right: 16px; padding: 9px 16px; border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, .28); background: rgba(255, 255, 255, .08); color: #d7daf0;
  font: 700 12px/1 'Rubik', ui-rounded, system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; cursor: pointer;
  transition: background .2s, color .2s; }
.msc__saltar:hover, .msc__saltar:focus-visible { background: rgba(255, 255, 255, .18); color: #fff; outline: none; }
.msc__saltar small { margin-left: .6em; opacity: .55; font-size: 10px; letter-spacing: .08em; }
.msc__ficha { position: absolute; left: 0; top: 0; margin: 0; display: grid; gap: .35em; padding: .45em .85em;
  border-left: 2px solid ${PALETA.ada}; background: rgba(4, 18, 28, .5); color: ${PALETA.ada};
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: clamp(10px, 1.2cqw, 14px); letter-spacing: .12em;
  white-space: nowrap; opacity: 0; pointer-events: none; text-shadow: 0 0 10px rgba(94, 224, 255, .7); will-change: transform, opacity; }
.msc__ficha b { color: #e6fdff; font-weight: 800; }
.msc__ventana { position: absolute; left: 50%; top: calc(9cqh + 2.2cqh); transform: translateX(-50%); margin: 0; display: grid;
  justify-items: center; gap: .2em; opacity: 0; pointer-events: none; color: #f3f4ff;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; text-shadow: 0 2px 0 #0b0a1d, 0 0 16px rgba(5, 6, 26, .9); }
.msc__ventana small { font-size: clamp(9px, 1.1cqw, 13px); font-weight: 700; letter-spacing: .22em; color: #c6cbe0; }
.msc__ventana b { font-size: clamp(22px, min(4.2cqw, 6cqh), 54px); font-weight: 800; letter-spacing: .04em; font-variant-numeric: tabular-nums; }
.msc__ventana--abierta small, .msc__ventana--abierta b { color: ${PALETA.ada}; }
.msc__reliquias { position: absolute; left: 16px; right: 16px; bottom: calc(9cqh + 2.6cqh + clamp(30px, 6cqh, 52px)); margin: 0; padding: 0;
  list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; opacity: 0; pointer-events: none;
  font-size: clamp(9px, 1.15cqw, 13px); }
.msc__reliquias li { padding: .35em .8em; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .22); background: rgba(7, 8, 25, .5);
  color: rgba(236, 238, 250, .45); font-weight: 700; letter-spacing: .04em; }
.msc__reliquias li.encendida { border-color: ${PALETA.ada}; background: ${PALETA.ada}; color: #04121c; box-shadow: 0 0 14px rgba(94, 224, 255, .6); }
.msc__vineta { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, .55) 100%); }
.msc__grano { position: absolute; inset: -64px; pointer-events: none; opacity: .1; mix-blend-mode: overlay;
  background-size: 128px 128px; will-change: transform; }
.msc__empezar { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 14px;
  padding: 16px; text-align: center; cursor: pointer; }
.msc__empezar[hidden] { display: none; }
.msc__empezar p { margin: 0; color: #c6cbe0; font-weight: 800; font-size: 12px; letter-spacing: .32em; }
.msc__empezar button { display: inline-flex; align-items: center; gap: .6em; padding: 14px 26px; border: 0; border-radius: 999px;
  background: ${PALETA.ada}; color: #04121c; font: 800 17px/1 'Rubik', ui-rounded, system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 0 40px rgba(94, 224, 255, .45); animation: msc-latir 1.8s ease-in-out infinite; }
.msc__empezar button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.msc__empezar svg { width: 16px; height: 16px; fill: currentColor; }
.msc__empezar small { color: #9aa0c4; font-weight: 600; font-size: 12px; letter-spacing: .08em; }
@keyframes msc-latir { 50% { box-shadow: 0 0 70px rgba(94, 224, 255, .8); } }
@media (prefers-reduced-motion: reduce) { .msc__empezar button { animation: none; } }
`;

function ponerEstilo() {
  if (document.getElementById('msc-estilo')) return;
  const s = document.createElement('style');
  s.id = 'msc-estilo';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ------------------------------------------------------------ texturas

const TAU = Math.PI * 2;
const campana = (t: number, c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));

/** Cielo de las ciudades de Ares: noche arriba y el horizonte ardiendo. */
function cieloIncendio(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const d = g.createLinearGradient(0, 0, 0, 256);
  d.addColorStop(0, '#12060f');
  d.addColorStop(0.3, '#3a0c1c');
  d.addColorStop(0.55, '#7a1d22');
  d.addColorStop(0.72, '#c8462a');
  d.addColorStop(0.82, '#ff9248');
  d.addColorStop(1, '#4a1726');
  g.fillStyle = d;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** El ojo de HELIOS: iris rojo con estrías, pupila rasgada y un brillo. */
function texturaOjo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const halo = g.createRadialGradient(128, 128, 18, 128, 128, 128);
  halo.addColorStop(0, 'rgba(255, 130, 90, 1)');
  halo.addColorStop(0.42, 'rgba(255, 64, 44, .92)');
  halo.addColorStop(0.6, 'rgba(170, 20, 34, .55)');
  halo.addColorStop(1, 'rgba(110, 0, 24, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 256, 256);
  g.lineCap = 'round';
  for (let k = 0; k < 30; k++) {
    const a = (k / 30) * TAU;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 24, 128 + Math.sin(a) * 24);
    g.lineTo(128 + Math.cos(a) * 56, 128 + Math.sin(a) * 56);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255, 176, 120, .6)';
    g.stroke();
  }
  g.beginPath();
  g.arc(128, 128, 62, 0, TAU);
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(255, 214, 150, .95)';
  g.stroke();
  g.fillStyle = '#14060c';
  g.beginPath();
  g.ellipse(128, 128, 11, 46, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, .85)';
  g.beginPath();
  g.arc(106, 102, 7, 0, TAU);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Anillo de luz para la señal de ADA en Meta. */
function texturaAnillo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  d.addColorStop(0, 'rgba(255,255,255,0)');
  d.addColorStop(0.62, 'rgba(255,255,255,0)');
  d.addColorStop(0.78, 'rgba(255,255,255,1)');
  d.addColorStop(0.9, 'rgba(255,255,255,.25)');
  d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Grano de película: ruido gris que se mueve en cada fotograma. */
function texturaGrano(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.random() * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/** Estrellas en toda la esfera: van con la cámara, así quedan en el infinito mire donde mire. */
function cieloEstrellado(n: number, tam: number, semilla: number, mapa: THREE.Texture): THREE.Points {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = azar(semilla + i * 2) * 2 - 1, a = azar(semilla + i * 2 + 1) * TAU, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: '#ffe9d8', size: tam, sizeAttenuation: false, map: mapa, transparent: true, depthWrite: false, fog: false,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

interface PaletaPlaneta {
  hondo: readonly number[];
  mar: readonly number[];
  costa: readonly number[];
  tierra: readonly number[];
  monte: readonly number[];
  hielo: readonly number[];
  /** Altura del mar en el relieve: cuanto más baja, menos mar. */
  nivel: number;
  /** Latitud desde la que hay hielo (más de 1: ninguno). */
  polo: number;
  /** Cuánto tapa el velo lo que hay debajo. */
  veloFuerza: number;
}

/** Ares: mares azules, continentes verdes y hielo en los polos. */
const PALETA_ARES: PaletaPlaneta = {
  hondo: [0.09, 0.25, 0.6], mar: [0.15, 0.42, 0.82], costa: [0.86, 0.8, 0.55], tierra: [0.25, 0.6, 0.34],
  monte: [0.52, 0.42, 0.3], hielo: [0.92, 0.96, 1.0], nivel: 0.2, polo: 0.86, veloFuerza: 0.93,
};
/** Meta hace dos siglos: desiertos ocres, poco mar y nada de hielo (el prólogo lo congela). */
const PALETA_META_ANTES: PaletaPlaneta = {
  hondo: [0.06, 0.3, 0.4], mar: [0.12, 0.46, 0.55], costa: [0.96, 0.82, 0.5], tierra: [0.86, 0.52, 0.24],
  monte: [0.58, 0.3, 0.16], hielo: [0.82, 0.88, 1.0], nivel: -0.3, polo: 1.6, veloFuerza: 0.6,
};

/**
 * Un planeta con el mismo sombreado de tres tonos que los personajes y las
 * luces de sus ciudades en el lado de noche. `cubre` lleva el velo rojo de
 * HELIOS desde `origenVelo` hasta taparlo, con el frente encendido; `polo`
 * baja el hielo hacia el ecuador; `grietas` lo abre en lava antes de romperse.
 */
function materialPlaneta(p: PaletaPlaneta): THREE.ShaderMaterial {
  const v = (c: readonly number[]) => ({ value: new THREE.Vector3(c[0], c[1], c[2]) });
  return new THREE.ShaderMaterial({
    uniforms: {
      luz: { value: new THREE.Vector3(1, 0.4, 0.5).normalize() },
      cubre: { value: 0 },
      origenVelo: { value: new THREE.Vector3(0.9, 0.3, 0.4).normalize() },
      grietas: { value: 0 },
      tiempo: { value: 0 },
      nivel: { value: p.nivel },
      polo: { value: p.polo },
      veloFuerza: { value: p.veloFuerza },
      cHondo: v(p.hondo), cMar: v(p.mar), cCosta: v(p.costa), cTierra: v(p.tierra), cMonte: v(p.monte), cHielo: v(p.hielo),
    },
    vertexShader: `
      varying vec3 vDir; varying vec3 vN;
      void main() {
        vDir = normalize(position);
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 luz; uniform float cubre; uniform vec3 origenVelo; uniform float grietas; uniform float tiempo;
      uniform float nivel; uniform float polo; uniform float veloFuerza;
      uniform vec3 cHondo; uniform vec3 cMar; uniform vec3 cCosta; uniform vec3 cTierra; uniform vec3 cMonte; uniform vec3 cHielo;
      varying vec3 vDir; varying vec3 vN;
      void main() {
        vec3 n = vDir;
        float r1 = sin(n.x * 6.0 + sin(n.z * 4.0) * 1.7) * sin(n.y * 5.0 + n.z * 3.0) + 0.5 * sin(n.z * 11.0 + n.x * 8.0)
          + 0.2 * sin(n.x * 27.0 + n.z * 19.0) * sin(n.y * 23.0 - n.x * 13.0);
        float r2 = sin(n.x * 15.0 + n.y * 9.0) * sin(n.z * 13.0 - n.y * 6.0);
        vec3 col = r1 < nivel - 0.55 ? cHondo : cMar;
        if (r1 > nivel) col = cCosta;
        if (r1 > nivel + 0.1) col = r1 > 0.78 ? cMonte : cTierra;
        if (abs(n.y) + r2 * 0.05 + r1 * 0.04 > polo) col = cHielo;
        float l = dot(normalize(vN), luz);
        float tono = l > 0.45 ? 1.0 : l > 0.0 ? 0.66 : 0.28;
        vec3 c = col * tono;
        float celda = fract(sin(dot(floor(n * 70.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        if (l < 0.0 && r1 > nivel + 0.1 && r1 < 0.78) c += vec3(1.0, 0.78, 0.4) * step(0.8, celda) * 0.85 * (1.0 - cubre);
        float d = dot(n, origenVelo) + r2 * 0.06;
        float frente = 1.05 - 2.1 * cubre;
        float tapado = smoothstep(frente - 0.05, frente + 0.05, d);
        c = mix(c, vec3(0.5, 0.07, 0.05) * (0.5 + 0.5 * tono), tapado * veloFuerza);
        c += vec3(1.0, 0.35, 0.2) * max(0.0, 1.0 - abs(d - frente) / 0.07) * step(0.001, cubre) * (1.0 - step(0.999, cubre)) * 0.9;
        float grieta = 1.0 - smoothstep(0.0, 0.16, abs(sin(r1 * 7.0 + r2 * 3.0 + tiempo * 0.5)));
        c = mix(c * (1.0 - 0.45 * grietas), vec3(1.0, 0.78, 0.36), grieta * grietas);
        c += vec3(0.7, 0.22, 0.05) * grieta * grietas * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/** El cohete del sector, que sube la orden de apagado. `nave` es lo que despega; la plataforma se queda. */
function crearCohete(): { raiz: THREE.Group; nave: THREE.Group } {
  const raiz = new THREE.Group(), nave = new THREE.Group();
  raiz.add(nave);
  const casco = toon(PALETA.traje), naranja = toon(PALETA.naranja);
  pieza(raiz, caja(7, 0.8, 7, 0.2), toon('#8a8f9c'), 0, 0.4, 0);
  pieza(nave, barril(1.0, 1.15, 8, 0.3), casco, 0, 5.2, 0);
  pieza(nave, toro(1.08, 0.12), naranja, 0, 7.2, 0);
  pieza(nave, cono(1.0, 2.6), naranja, 0, 10.5, 0);
  pieza(nave, barril(0.75, 0.95, 0.6, 0.1), toon(PALETA.oscuro), 0, 1.0, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    pieza(nave, caja(0.2, 2.2, 1.5, 0.06), naranja, Math.sin(a) * 1.25, 2.2, Math.cos(a) * 1.25).rotation.y = a;
  }
  return { raiz, nave };
}

// ------------------------------------------------------------ sonido

/** Estallido: ruido que se apaga y pasa de agudo a grave. */
function estallido(a: AudioContext, t0: number, dur: number, vol: number, desde = 1200) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const datos = buf.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / datos.length) ** 2;
  const fuente = a.createBufferSource(), filtro = a.createBiquadFilter(), g = a.createGain();
  fuente.buffer = buf;
  filtro.type = 'lowpass';
  filtro.frequency.setValueAtTime(desde, t0);
  filtro.frequency.exponentialRampToValueAtTime(60, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  fuente.connect(filtro).connect(g).connect(a.destination);
  fuente.start(t0);
}

/** Ráfaga de ruido que barre de `de` a `hasta`: el salto al llegar a Meta. */
function barrido(a: AudioContext, t0: number, dur: number, de: number, hasta: number, vol: number) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const datos = buf.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = a.createBufferSource(), filtro = a.createBiquadFilter(), g = a.createGain();
  fuente.buffer = buf;
  filtro.type = 'bandpass';
  filtro.Q.value = 1.5;
  filtro.frequency.setValueAtTime(de, t0);
  filtro.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  fuente.connect(filtro).connect(g).connect(a.destination);
  fuente.start(t0);
}

/** Sirena de alarma lejana en las ciudades de Ares. */
function sirena(a: AudioContext, t0: number) {
  const o = a.createOscillator(), lfo = a.createOscillator(), vaiven = a.createGain(), filtro = a.createBiquadFilter(), g = a.createGain();
  o.type = 'sine';
  o.frequency.value = 690;
  lfo.frequency.value = 0.7;
  vaiven.gain.value = 130;
  lfo.connect(vaiven).connect(o.frequency);
  filtro.type = 'lowpass';
  filtro.frequency.value = 1400;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.018, t0 + 0.6);
  g.gain.setValueAtTime(0.018, t0 + 3.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.8);
  o.connect(filtro).connect(g).connect(a.destination);
  o.start(t0);
  lfo.start(t0);
  o.stop(t0 + 3.9);
  lfo.stop(t0 + 3.9);
}

/** Viento helado: ruido grave que sube y baja. */
function viento(a: AudioContext, t0: number, dur: number) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const datos = buf.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = a.createBufferSource(), filtro = a.createBiquadFilter(), g = a.createGain(), lfo = a.createOscillator(), rafaga = a.createGain();
  fuente.buffer = buf;
  filtro.type = 'bandpass';
  filtro.frequency.value = 420;
  filtro.Q.value = 0.8;
  lfo.frequency.value = 0.35;
  rafaga.gain.value = 260;
  lfo.connect(rafaga).connect(filtro.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 1.2);
  g.gain.setValueAtTime(0.05, t0 + dur - 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  fuente.connect(filtro).connect(g).connect(a.destination);
  fuente.start(t0);
  lfo.start(t0);
  lfo.stop(t0 + dur);
}

/** Llamada de auxilio: S O S en morse. */
function sos(a: AudioContext, t0: number) {
  let t = t0;
  for (const largo of [0, 0, 0, 1, 1, 1, 0, 0, 0]) {
    const d = largo ? 0.21 : 0.07;
    tono(a, t, 'sine', 990, 985, d, 0.04);
    t += d + 0.07;
  }
}

const tic = (a: AudioContext, t0: number) => tono(a, t0, 'square', 1500, 1400, 0.03, 0.015);

const pulsoGrave = (a: AudioContext, t0: number) => {
  estallido(a, t0, 1.0, 0.12, 300);
  tono(a, t0, 'sine', 90, 38, 0.9, 0.08);
};
const ping = (a: AudioContext, t0: number) => {
  tono(a, t0, 'sine', 1760, 1756, 0.7, 0.035);
  tono(a, t0, 'sine', 3520, 3510, 0.3, 0.01);
};

const alarma = (a: AudioContext, t0: number) => {
  for (let k = 0; k < 3; k++) tono(a, t0 + k * 0.2, 'square', 880, 860, 0.11, 0.025);
};
const rugido = (a: AudioContext, t0: number) => {
  soplido(a, t0, 1.3, 140, 700, 0.12);
  tono(a, t0, 'sawtooth', 130, 55, 1.2, 0.05);
};

/** Cada sonido, en el segundo del guion en que suena. */
const SONIDOS: readonly (readonly [number, (a: AudioContext, t0: number) => void])[] = [
  // Prólogo: HELIOS se enciende y empieza a tender el velo.
  [en('prologo', 3.4), (a, t0) => tono(a, t0, 'sawtooth', 110, 440, 0.9, 0.04)],
  [en('prologo', 3.6), alarma],
  [en('prologo', 5.6), (a, t0) => estallido(a, t0, 1.4, 0.12, 300)],
  // Refugio: viento helado y la llamada de auxilio en morse.
  [en('refugio', 0), (a, t0) => viento(a, t0, 7)],
  [en('refugio', 4.9), sos],
  [en('ares', 1.25), (a, t0) => soplido(a, t0, 1.0, 260, 1700, 0.12)],
  [en('helios', 0.4), (a, t0) => tono(a, t0, 'sawtooth', 55, 110, 1.6, 0.05)],
  [en('helios', 0.5), alarma],
  [en('helios', 1.1), pulsoGrave],
  [en('helios', 2.7), alarma],
  [en('helios', 2.85), rugido],
  [en('guerra', 2.85), rugido],
  [en('ciudad', 0.1), sirena],
  [en('ciudad', 1.15), (a, t0) => estallido(a, t0, 0.9, 0.22, 400)],
  [en('ciudad', 3.15), (a, t0) => estallido(a, t0, 0.9, 0.22, 400)],
  [en('caida', 0.5), alarma],
  [en('caida', 2.0), (a, t0) => estallido(a, t0, 1.1, 0.1, 220)],
  [ESTALLA, (a, t0) => {
    estallido(a, t0, 3.2, 0.35, 1600);
    tono(a, t0, 'sine', 60, 30, 2.5, 0.12);
  }],
  [en('caida', 3.3), alarma],
  // La llave: el holograma se enciende y HELIOS la busca.
  [en('llave', 0), (a, t0) => {
    soplido(a, t0, 0.8, 400, 3000, 0.06);
    tono(a, t0, 'sine', 660, 990, 0.7, 0.03);
  }],
  [en('llave', 3.1), alarma],
  [PLANOS.meta[0] - 0.05, (a, t0) => barrido(a, t0, 1.2, 3200, 280, 0.12)],
  // La señal de ADA suena con cada latido de la baliza (ver el plano «meta»).
  ...[1, 2, 3, 4, 5].map((k) => [en('meta', k / 1.4), ping] as const),
  // Misión: la cuenta atrás, el despegue y el velo que se abre.
  ...[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5].map((s) => [en('mision', s), tic] as const),
  [VENTANA, (a, t0) => {
    tono(a, t0, 'sine', 880, 1320, 0.5, 0.05);
    estallido(a, t0, 1.8, 0.25, 900);
    soplido(a, t0, 1.6, 200, 2400, 0.14);
  }],
  [VUELVE_EL_SOL, (a, t0) => {
    estallido(a, t0, 2.4, 0.2, 2200);
    ping(a, t0 + 0.1);
  }],
];

/** Cuándo suelta un pulso el ojo de HELIOS: al abrirse y al rugir el Dragón. */
const PULSOS_OJO = [en('helios', 1.1), en('helios', 2.95)];

// ------------------------------------------------------------ actores

interface Actor {
  raiz: THREE.Group;
  mezclador: THREE.AnimationMixer;
  clips: Map<string, { accion: THREE.AnimationAction; dur: number }>;
  toberas: THREE.Sprite[];
}

/**
 * Un modelo del kit listo para la cinemática: `raiz` es el pivote, en el
 * centro del cuerpo (`alto` metros por encima de sus pies), y los clips se
 * ponen a mano con `posar`. `cuerpo` permite usar una copia del modelo.
 */
function actor(m: Modelo, alto: number, cuerpo: THREE.Object3D = m.raiz): Actor {
  const raiz = new THREE.Group();
  const centro = new THREE.Group();
  centro.position.y = -alto;
  centro.add(cuerpo);
  raiz.add(centro);
  const mezclador = new THREE.AnimationMixer(cuerpo);
  const clips = new Map(m.animaciones.map((a) => {
    const accion = mezclador.clipAction(a.clip);
    accion.play();
    accion.setEffectiveWeight(0);
    return [a.clip.name, { accion, dur: a.clip.duration }] as const;
  }));
  return { raiz, mezclador, clips, toberas: [] };
}

/** [clip, peso, segundo del clip, si da la vuelta]. */
type Capa = readonly [string, number, number, boolean?];

/** Pone cada clip en su peso y su segundo; los que no se nombran se apagan. */
function posar(a: Actor, ...capas: Capa[]) {
  for (const c of a.clips.values()) c.accion.setEffectiveWeight(0);
  for (const [nombre, peso, tiempo, bucle = true] of capas) {
    const c = a.clips.get(nombre);
    if (!c || peso <= 0) continue;
    c.accion.setEffectiveWeight(peso);
    c.accion.time = bucle ? ((tiempo % c.dur) + c.dur) % c.dur : Math.min(c.dur - 0.001, Math.max(0, tiempo));
  }
  a.mezclador.update(0);
}

function destello(mapa: THREE.Texture, color: THREE.ColorRepresentation, tam: number, niebla = false): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: mapa, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: niebla,
  }));
  s.scale.setScalar(tam);
  s.userData.tam = tam;
  return s;
}

/** Toberas de la nave (casco en el pivote): góndolas y central, con halo cyan y núcleo blanco. */
const TOBERAS = [[0.66, -0.24, -1.9], [-0.66, -0.24, -1.9], [0, 0.04, -1.97]] as const;

function encenderToberas(a: Actor, mapa: THREE.Texture) {
  for (const [k, [x, y, z]] of TOBERAS.entries()) {
    const halo = destello(mapa, PALETA.ada, k === 2 ? 1.2 : 0.9);
    const nucleo = destello(mapa, '#e9feff', k === 2 ? 0.5 : 0.38);
    halo.position.set(x, y, z);
    nucleo.position.set(x, y, z + 0.1);
    a.raiz.add(halo, nucleo);
    a.toberas.push(halo, nucleo);
  }
}

function empuje(a: Actor, fuerza: number, t: number) {
  a.toberas.forEach((s, k) => {
    s.scale.setScalar(s.userData.tam * fuerza * (0.82 + 0.18 * Math.sin(t * 43 + k * 1.7)));
  });
}

const ARRIBA = new THREE.Vector3(0, 1, 0), EJE_Z = new THREE.Vector3(0, 0, 1), BLANCO = new THREE.Color('#ffffff');
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

/** Orienta +z (el morro de todos los modelos) hacia `adelante`, con alabeo en radianes. */
function orientar(obj: THREE.Object3D, adelante: THREE.Vector3, alabeo = 0) {
  _z.copy(adelante).normalize();
  _x.crossVectors(ARRIBA, _z);
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m).multiply(_q.setFromAxisAngle(EJE_Z, alabeo));
}

/** Ruta suave por puntos [segundo, x, y, z]: posición y rumbo en cada momento. */
function ruta(claves: readonly (readonly [number, number, number, number])[]) {
  const curva = new THREE.CatmullRomCurve3(claves.map(([, x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const u = monotona(claves.map((c) => c[0]), claves.map((_, k) => k / (claves.length - 1)));
  return (t: number, pos: THREE.Vector3, rumbo: THREE.Vector3) => {
    const k = u(t);
    curva.getPoint(k, pos);
    curva.getTangent(k, rumbo);
  };
}

// Tiempos de cada ruta, desde el principio de su plano. La última clave cae
// después del corte: así nadie frena antes de tiempo.
const RUTA_HEROE = ruta([[0.5, -2.6, -1.6, 3], [1.4, -0.5, -0.4, -4.5], [2.4, 3.2, 1.0, -17], [5.5, 30, 10, -200], [7, 45, 15, -300]]);
const RUTA_DRAGON_OJO = ruta([[2.2, -36, -14, -232], [3.1, -12, 16, -160], [4.1, 12, 20, -70], [5.0, 36, 26, 0], [5.7, 50, 30, 60]]);
const RUTA_DRAGON_GUERRA = ruta([[1.8, 42, 10, -62], [2.8, 16, 5, -40], [4.0, -6, 3, -30], [5.3, -42, 9, -6], [6.1, -60, 12, 10]]);
/** Boca del Dragón en su pivote: de ahí sale el aliento. */
const BOCA = new THREE.Vector3(0, 0.7, 6.0);
const ALIENTO: readonly [number, number] = [en('guerra', 3.1), en('guerra', 4.1)];

// ------------------------------------------------------------ cinemática

/** Cinemática a pantalla completa. Devuelve función para desmontarla. */
export function showCinematica(root: HTMLElement, onDone: () => void, opts: CinematicaOptions = {}): () => void {
  ponerEstilo();
  const tactil = window.matchMedia?.('(pointer: coarse)').matches;
  const capa = document.createElement('div');
  capa.className = 'msc';
  capa.innerHTML = `
    <canvas class="msc__lienzo"></canvas>
    <div class="msc__vineta"></div>
    <div class="msc__grano"></div>
    <div class="msc__banda msc__banda--arriba"></div>
    <div class="msc__banda msc__banda--abajo"></div>
    <p class="msc__helios"><span></span><span class="msc__resto"></span></p>
    <p class="msc__narra"><span></span><span class="msc__resto"></span></p>
    <p class="msc__senal" aria-hidden="true"><i></i>MÓDULO 7 · SEÑAL DE ADA</p>
    <p class="msc__ficha" aria-hidden="true"><b></b><span></span></p>
    <p class="msc__ventana" aria-hidden="true"><small></small><b></b></p>
    <ol class="msc__reliquias" aria-hidden="true">${RELIQUIAS.map((n) => `<li>${n}</li>`).join('')}</ol>
    <div class="msc__blanco"></div>
    <div class="msc__negro"></div>
    <div class="msc__empezar">
      <p>META SPACE</p>
      <button type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>Ver la historia</button>
      <small>Con música y sonido · Esc para saltar</small>
    </div>
    <button class="msc__saltar" type="button">Saltar${tactil ? '' : ' <small>Esc</small>'}</button>`;
  root.appendChild(capa);

  const lienzo = capa.querySelector<HTMLCanvasElement>('.msc__lienzo')!;
  const [bandaArriba, bandaAbajo] = [...capa.querySelectorAll<HTMLElement>('.msc__banda')];
  const voces = {
    narra: capa.querySelector<HTMLElement>('.msc__narra')!,
    helios: capa.querySelector<HTMLElement>('.msc__helios')!,
  };
  const senal = capa.querySelector<HTMLElement>('.msc__senal')!;
  const blanco = capa.querySelector<HTMLElement>('.msc__blanco')!;
  const negro = capa.querySelector<HTMLElement>('.msc__negro')!;
  const boton = capa.querySelector<HTMLButtonElement>('.msc__saltar')!;
  const grano = capa.querySelector<HTMLElement>('.msc__grano')!;
  grano.style.backgroundImage = `url(${texturaGrano()})`;
  const puerta = capa.querySelector<HTMLElement>('.msc__empezar')!;
  const ficha = capa.querySelector<HTMLElement>('.msc__ficha')!;
  const [fichaTitulo, fichaLinea] = [ficha.querySelector('b')!, ficha.querySelector('span')!];
  const ventana = capa.querySelector<HTMLElement>('.msc__ventana')!;
  const [ventanaTitulo, ventanaReloj] = [ventana.querySelector('small')!, ventana.querySelector('b')!];
  const reliquias = capa.querySelector<HTMLElement>('.msc__reliquias')!;
  const piezasReliquia = [...reliquias.querySelectorAll('li')];

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  } catch {
    // Sin WebGL no hay cinemática: se sigue como si se hubiera saltado.
    capa.remove();
    queueMicrotask(onDone);
    return () => undefined;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const escena = new THREE.Scene();
  const espacio = cielo(), incendio = cieloIncendio();
  const niebla = new THREE.Fog('#4a1726', 45, 230);
  const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
  const mapaPunto = punto();

  const estrellas = new THREE.Group();
  estrellas.add(cieloEstrellado(900, 1.5, 5, mapaPunto), cieloEstrellado(120, 3.2, 733, mapaPunto));
  escena.add(estrellas);

  const hemi = new THREE.HemisphereLight('#c3c6ff', '#3d2440', 1.2);
  const clave = new THREE.DirectionalLight('#fff1dc', 2.4);
  const rebote = new THREE.DirectionalLight('#ff6a4a', 0.9);
  const fogon = new THREE.PointLight('#ffb36b', 0, 0, 0);
  escena.add(hemi, clave, rebote, fogon);

  // ---------------------------------------------------------- planetas

  const RA = 60, RM = 160;
  const ares = new THREE.Group();
  const matAres = materialPlaneta(PALETA_ARES);
  const atmosDentro = velo(RA, 1.012, false, '#8fd8ff'), atmosFuera = velo(RA, 1.06, true, '#4fb4ff');
  ares.add(new THREE.Mesh(new THREE.SphereGeometry(RA, 128, 96), matAres), atmosDentro, atmosFuera);
  const colorAtmos = [atmosDentro, atmosFuera].map((m) => (m.material as THREE.ShaderMaterial).uniforms.color.value as THREE.Color);
  const AZUL = [new THREE.Color('#8fd8ff'), new THREE.Color('#4fb4ff')], ROJO = [new THREE.Color('#ff7a4a'), new THREE.Color('#ff4a3a')];
  /** Lo que el velo ha tapado de Ares (0 a 1) y cuánto se ha agrietado. */
  const estadoAres = (cubre: number, grietas: number, t: number) => {
    matAres.uniforms.cubre.value = cubre;
    matAres.uniforms.grietas.value = grietas;
    matAres.uniforms.tiempo.value = t;
    colorAtmos.forEach((c, k) => c.lerpColors(AZUL[k], ROJO[k], Math.min(1, cubre * 1.3)));
  };
  const brasaAres = destello(mapaPunto, '#ff7a2a', 1);

  const meta = new THREE.Group();
  const superficieMeta = planeta(RM);
  superficieMeta.rotation.set(-1.0, 0, 0.25);
  meta.add(superficieMeta, velo(RM, 1.012, false), velo(RM, 1.06, true));

  // El ojo de HELIOS asoma por el horizonte del velo, como un sol rojo.
  const ojo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaOjo(), transparent: true, depthWrite: false, fog: false }));
  const brilloOjo = destello(mapaPunto, '#ff3a2a', 1);
  const anillo = texturaAnillo();
  // Raya de lente horizontal y el pulso que suelta al abrirse.
  const rayaOjo = destello(mapaPunto, '#ff5a3a', 1);
  const pulsoOjo = destello(anillo, PALETA.helios, 1);

  // La señal de ADA en Meta.
  const baliza = destello(anillo, PALETA.ada, 1);
  const balizaNucleo = destello(mapaPunto, '#d9fbff', 1);

  // ---------------------------------------------------------- actores

  const heroe = actor(crearNave(), 1.5);
  encenderToberas(heroe, mapaPunto);
  // La flota y el enjambre son copias de un modelo con menos detalle.
  const baseNave = conDetalle(0.55, crearNave);
  const flota = Array.from({ length: FLOTA }, (_, i) => actor(baseNave, 1.5, i === 0 ? baseNave.raiz : baseNave.raiz.clone()));
  for (const n of flota) encenderToberas(n, mapaPunto);
  const baseAvispa = conDetalle(0.45, crearAvispa);
  const enjambre = Array.from({ length: ENJAMBRE }, (_, j) => actor(baseAvispa, 3.4, j === 0 ? baseAvispa.raiz : baseAvispa.raiz.clone()));
  const dragon = actor(crearDragon(), 2.6);
  const heraldo = actor(crearHeraldo(), 4.3);
  const titan = actor(crearGolem('titan'), 0);
  const cancerbero = actor(crearSabueso(), 0);
  const especialista = actor(crearAstronauta(), 0);

  // ---------------------------------------------------------- ciudad

  const ciudad = new THREE.Group();
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), toon('#2a1d2c'));
  const N_EDIFICIOS = 70;
  const edificios = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), toon('#241a2e'), N_EDIFICIOS);
  /** Ventanas encendidas: [x, y, z, fase] en las fachadas que miran a la cámara. */
  const ventanas: (readonly [number, number, number, number])[] = [];
  const fuegos: THREE.Sprite[] = [];
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let k = 0; k < N_EDIFICIOS; k++) {
      const x = (azar(k * 5 + 1) * 2 - 1) * 130, z = -55 - azar(k * 5 + 2) * 150;
      const ancho = 6 + azar(k * 5 + 3) * 12, alto = 10 + azar(k * 5 + 4) ** 1.5 * 50, fondo = 6 + azar(k * 5 + 5) * 10;
      q.setFromAxisAngle(ARRIBA, (azar(k * 5 + 6) - 0.5) * 0.4);
      edificios.setMatrixAt(k, m.compose(p.set(x, 0, z), q, s.set(ancho, alto, fondo)));
      for (let w = 0; w < 3; w++) {
        if (azar(k * 9 + w) < 0.35) continue;
        ventanas.push([x + (azar(k * 9 + w + 3) - 0.5) * ancho * 0.8, alto * (0.2 + 0.7 * azar(k * 9 + w + 5)), z + fondo / 2 + 0.2, k + w]);
      }
      if (k % 3 === 0) {
        const f = destello(mapaPunto, '#ff7a2a', 7 + azar(k * 5 + 7) * 9, true);
        f.position.set(x, azar(k * 5 + 8) < 0.5 ? alto : 2, z + fondo / 2);
        fuegos.push(f);
      }
    }
  }
  ciudad.add(suelo, edificios, ...fuegos);

  // ---------------------------------------------------------- efectos

  // Esquirlas de Ares: roca que gira y trozos de lava que se van apagando.
  const N_ESQUIRLAS = 72;
  const esquirlas = Array.from({ length: N_ESQUIRLAS }, (_, k) => {
    const y = azar(k * 7 + 1) * 2 - 1, a = azar(k * 7 + 2) * TAU, r = Math.sqrt(1 - y * y);
    return {
      dir: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
      eje: new THREE.Vector3(azar(k * 7 + 3) - 0.5, azar(k * 7 + 4) - 0.5, azar(k * 7 + 5) - 0.5).normalize(),
      giro: 0.4 + azar(k * 7 + 6) * 2.2,
      vel: 0.25 + azar(k * 7 + 7) * 0.7,
      tam: 0.035 + azar(k * 7 + 8) ** 2 * 0.12,
      lava: k % 4 === 0,
    };
  });
  const geoEsquirla = new THREE.DodecahedronGeometry(1, 0);
  const matLava = new THREE.MeshBasicMaterial({ color: '#ffb36b' });
  const roca = new THREE.InstancedMesh(geoEsquirla, toon('#4a3a46'), esquirlas.filter((e) => !e.lava).length);
  const lava = new THREE.InstancedMesh(geoEsquirla, matLava, esquirlas.filter((e) => e.lava).length);
  roca.frustumCulled = lava.frustumCulled = false;
  const LAVA_VIVA = new THREE.Color('#ffd28a'), LAVA_FRIA = new THREE.Color('#7a1f1f');

  const onda = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 160, 1), new THREE.MeshBasicMaterial({
    color: '#ffb36b', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }));
  const nucleo = destello(mapaPunto, '#fff3d6', 1);

  // Rayos: un cilindro por disparo (núcleo claro y halo de su color).
  const MAX_RAYOS = 48;
  const geoRayo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
  const aditivo = (opacidad: number) => new THREE.MeshBasicMaterial({
    transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const nucleoRayos = new THREE.InstancedMesh(geoRayo, aditivo(1), MAX_RAYOS);
  const haloRayos = new THREE.InstancedMesh(geoRayo, aditivo(0.35), MAX_RAYOS);
  for (const r of [nucleoRayos, haloRayos]) {
    r.frustumCulled = false;
    for (let k = 0; k < MAX_RAYOS; k++) r.setColorAt(k, BLANCO);
  }

  // Chispas: explosiones, aliento, ascuas y ventanas. Cada punto lleva su
  // tamaño en metros, así una explosión lejana y una cercana se leen igual.
  const MAX_CHISPAS = 4000;
  const chispaPos = new Float32Array(MAX_CHISPAS * 3), chispaTinte = new Float32Array(MAX_CHISPAS * 3), chispaTam = new Float32Array(MAX_CHISPAS);
  const geoChispas = new THREE.BufferGeometry();
  geoChispas.setAttribute('position', new THREE.BufferAttribute(chispaPos, 3));
  geoChispas.setAttribute('tinte', new THREE.BufferAttribute(chispaTinte, 3));
  geoChispas.setAttribute('tam', new THREE.BufferAttribute(chispaTam, 1));
  const matChispas = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: mapaPunto }, escala: { value: 600 } },
    vertexShader: `
      attribute float tam; attribute vec3 tinte; varying vec3 vTinte; uniform float escala;
      void main() {
        vTinte = tinte;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(tam * escala / max(0.1, -mv.z), 0.0, 256.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D mapa; varying vec3 vTinte;
      void main() { float a = texture2D(mapa, gl_PointCoord).a; gl_FragColor = vec4(vTinte * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const chispas = new THREE.Points(geoChispas, matChispas);
  chispas.frustumCulled = false;
  let nChispas = 0;
  const chispa = (x: number, y: number, z: number, c: THREE.Color, tam: number) => {
    if (nChispas >= MAX_CHISPAS) return;
    chispaPos.set([x, y, z], nChispas * 3);
    chispaTinte.set([c.r, c.g, c.b], nChispas * 3);
    chispaTam[nChispas++] = tam;
  };

  const destellos = Array.from({ length: 12 }, () => destello(mapaPunto, '#ffe2a8', 1));
  // Cada destello lleva su raya de lente horizontal, como en una cámara de cine.
  const rayas = Array.from({ length: 12 }, () => destello(mapaPunto, '#ffd9a0', 1));

  // Salida del salto al llegar a Meta: rayas de estrellas que se frenan.
  const N_SALTO = 140;
  const saltoPos = new Float32Array(N_SALTO * 6), saltoColor = new Float32Array(N_SALTO * 6);
  const geoSalto = new THREE.BufferGeometry();
  geoSalto.setAttribute('position', new THREE.BufferAttribute(saltoPos, 3));
  geoSalto.setAttribute('color', new THREE.BufferAttribute(saltoColor, 3));
  const salto = new THREE.LineSegments(geoSalto, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  salto.frustumCulled = false;

  // ---------------------------------------------------------- prólogo

  // Meta hace dos siglos, ardiendo. HELIOS lo envuelve con el velo y lo congela.
  const matMetaAntes = materialPlaneta(PALETA_META_ANTES);
  const metaAntes = new THREE.Group();
  const halosAntes = [velo(RA, 1.012, false, '#ffcf7a'), velo(RA, 1.06, true, '#ffb347')];
  metaAntes.add(new THREE.Mesh(new THREE.SphereGeometry(RA, 128, 96), matMetaAntes), ...halosAntes);
  const colorHalosAntes = halosAntes.map((m) => (m.material as THREE.ShaderMaterial).uniforms.color.value as THREE.Color);
  const CALOR = [new THREE.Color('#ffcf7a'), new THREE.Color('#ffb347')];
  const solAntes = destello(mapaPunto, '#fff0c8', 1);
  const aditivoColor = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  // Los nodos de HELIOS en órbita y los haces con que tienden el velo.
  const nodos = Array.from({ length: 6 }, () => destello(mapaPunto, PALETA.helios, 1));
  const haces = Array.from({ length: 6 }, () => new THREE.Mesh(geoRayo, aditivoColor(PALETA.helios)));

  // ---------------------------------------------------------- campo helado

  // El suelo helado de Meta bajo el velo y su cielo, que se abre al volver el sol.
  const HORIZONTE_VELO = new THREE.Color(0.72, 0.36, 0.38), HORIZONTE_SOL = new THREE.Color(0.96, 0.82, 0.62);
  const matCupula = new THREE.ShaderMaterial({
    uniforms: { sol: { value: 0 }, horizonte: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float sol; uniform vec3 horizonte; varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 alto = mix(vec3(0.17, 0.04, 0.08), vec3(0.3, 0.5, 0.82), sol);
        vec3 medio = mix(vec3(0.5, 0.16, 0.2), vec3(0.62, 0.72, 0.88), sol);
        vec3 c = mix(horizonte, medio, smoothstep(0.0, 0.18, h));
        gl_FragColor = vec4(mix(c, alto, smoothstep(0.18, 0.75, h)), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), matCupula);
  cupula.renderOrder = -1;
  cupula.frustumCulled = false;
  const nieblaCampo = new THREE.Fog('#b85c60', 40, 260);
  const N_ROCAS = 60;
  const rocasCampo = new THREE.InstancedMesh(geoEsquirla, toon('#9fb0cc'), N_ROCAS);
  rocasCampo.frustumCulled = false;
  const campo = new THREE.Group();
  campo.add(cupula, new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), toon('#cbd5e8')), rocasCampo);

  // El refugio, Tali vigilando, dos Torres del Velo al fondo y la llamada de auxilio.
  const refugio = actor(crearRefugio(), 0);
  const tali = actor(crearNpcVigia(), 0);
  const baseTorre = crearTorreVelo();
  const torres = [actor(baseTorre, 0), actor(baseTorre, 0, baseTorre.raiz.clone())];
  const hazSenal = new THREE.Mesh(geoRayo, aditivoColor(PALETA.ada));
  const anillosSenal = Array.from({ length: 3 }, () => destello(anillo, PALETA.ada, 1));

  // ---------------------------------------------------------- la llave

  const noa = actor(crearAdaNoa(), 0);
  const auraLlave = destello(mapaPunto, PALETA.ada, 1);
  const aroLlave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2), aditivoColor(PALETA.ada));

  // ---------------------------------------------------------- la misión

  const baseRecolector = conDetalle(0.5, crearRecolector);
  const horda = Array.from({ length: 8 }, (_, j) => actor(baseRecolector, 0, j === 0 ? baseRecolector.raiz : baseRecolector.raiz.clone()));
  const balizaHelios = actor(crearBaliza(), 0);
  const cohete = crearCohete();
  const llamaCohete = destello(mapaPunto, '#ffd28a', 1);
  const hazSol = new THREE.Mesh(new THREE.CylinderGeometry(3, 16, 130, 32, 1, true), aditivoColor('#ffd98a'));
  const solMision = destello(mapaPunto, '#fff2c8', 1);

  const nuevos: THREE.Object3D[] = [metaAntes, solAntes, ...nodos, ...haces, campo, refugio.raiz, tali.raiz, ...torres.map((a) => a.raiz),
    hazSenal, ...anillosSenal, noa.raiz, auraLlave, aroLlave, ...horda.map((a) => a.raiz), balizaHelios.raiz, cohete.raiz, llamaCohete,
    hazSol, solMision];

  escena.add(ares, brasaAres, meta, ojo, brilloOjo, rayaOjo, pulsoOjo, baliza, balizaNucleo, ciudad, roca, lava, onda, nucleo, salto,
    ...rayas, heroe.raiz, dragon.raiz, heraldo.raiz, titan.raiz, cancerbero.raiz, especialista.raiz,
    ...flota.map((a) => a.raiz), ...enjambre.map((a) => a.raiz), nucleoRayos, haloRayos, chispas, ...destellos, ...nuevos);
  /** Lo que cada plano enciende a mano; el resto se apaga en cada fotograma. */
  const conmutables: THREE.Object3D[] = [ares, brasaAres, meta, ojo, brilloOjo, rayaOjo, pulsoOjo, baliza, balizaNucleo, ciudad, roca, lava, onda, nucleo, salto,
    heroe.raiz, dragon.raiz, heraldo.raiz, titan.raiz, cancerbero.raiz, especialista.raiz, ...flota.map((a) => a.raiz), ...enjambre.map((a) => a.raiz),
    ...nuevos];
  const ver = (...objs: THREE.Object3D[]) => {
    for (const o of objs) o.visible = true;
  };

  const { rayos: RAYOS, estallidos: ESTALLIDOS } = guionDeFuego();

  // ---------------------------------------------------------- utilidades

  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
  const qA = new THREE.Quaternion(), mA = new THREE.Matrix4(), cA = new THREE.Color();
  const fantasma = new THREE.Object3D();
  const CALIENTE = [new THREE.Color('#fff4d6'), new THREE.Color('#ffd36b'), new THREE.Color('#ff7a2a'), new THREE.Color('#9a1f1f')];
  const VELO_A = new THREE.Color('#ff4a3a'), VELO_B = new THREE.Color(PALETA.purpuraBrillo);
  const BRASA = new THREE.Color('#ff8a3d'), LUZ_VENTANA = new THREE.Color('#ffcf7a'), ESTELA = new THREE.Color(PALETA.ada);
  const LUZ_VELO = new THREE.Color('#ffb89a'), LUZ_SOL = new THREE.Color('#fff2c8'), OSCURIDAD = new THREE.Color('#04060f');
  const CIAN = new THREE.Color(PALETA.ada), ROJO_HELIOS = new THREE.Color(PALETA.helios);

  /** Blanco → amarillo → naranja → rojo oscuro según la edad (0 a 1). */
  const rampa = (f: number, out: THREE.Color) => {
    const x = Math.min(0.999, Math.max(0, f)) * 3, k = Math.floor(x);
    return out.lerpColors(CALIENTE[k], CALIENTE[k + 1], x - k);
  };
  const direccion = (s: number, out: THREE.Vector3) => {
    const y = azar(s) * 2 - 1, a = azar(s + 0.5) * TAU, r = Math.sqrt(1 - y * y);
    return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
  };

  let t = opts.fijo ?? opts.inicio ?? 0;
  let sacudida = 0;
  /** Cámara en `p` mirando a `m`, con el temblor del momento. */
  const encuadrar = (px: number, py: number, pz: number, mx: number, my: number, mz: number) => {
    const s = Math.min(1.2, sacudida);
    camara.position.set(px + Math.sin(t * 61) * s * 0.5, py + Math.sin(t * 47 + 1) * s * 0.5, pz);
    camara.lookAt(mx + Math.sin(t * 53 + 2) * s * 0.4, my + Math.sin(t * 37 + 3) * s * 0.4, mz);
    camara.updateMatrixWorld();
  };
  /** Dirección de la luz principal (también la de Ares, que no usa las luces de la escena). */
  const luz = (x: number, y: number, z: number, color: THREE.ColorRepresentation, fuerza: number) => {
    clave.position.set(x, y, z).normalize().multiplyScalar(50);
    clave.color.set(color);
    clave.intensity = fuerza;
    matAres.uniforms.luz.value.copy(clave.position).normalize();
    matMetaAntes.uniforms.luz.value.copy(clave.position).normalize();
  };
  const ambiente = (arriba: THREE.ColorRepresentation, abajo: THREE.ColorRepresentation, fuerza: number) => {
    hemi.color.set(arriba);
    hemi.groundColor.set(abajo);
    hemi.intensity = fuerza;
  };
  const contraluz = (x: number, y: number, z: number, color: THREE.ColorRepresentation, fuerza: number) => {
    rebote.position.set(x, y, z).normalize().multiplyScalar(50);
    rebote.color.set(color);
    rebote.intensity = fuerza;
  };

  // ---------------------------------------------------------- planos

  const planos: Record<Plano, (tl: number) => void> = {
    prologo: (tl) => {
      ver(metaAntes, solAntes);
      luz(-0.85, 0.3, 0.45, '#fff1dc', 2.2);
      contraluz(1, -0.2, -0.6, PALETA.helios, 0.6);
      ambiente('#c3c6ff', '#3d2440', 1.0);
      const cubre = tramo(tl, 3.9, 6.6), frio = tramo(tl, 5.4, 7.8);
      metaAntes.position.set(0, -8, -190);
      metaAntes.rotation.y = 0.4 + t * 0.04;
      const u = matMetaAntes.uniforms;
      u.cubre.value = cubre;
      u.polo.value = THREE.MathUtils.lerp(1.6, 0.62, frio);
      u.tiempo.value = t;
      colorHalosAntes.forEach((c, k) => c.lerpColors(CALOR[k], ROJO[k], cubre));
      solAntes.position.set(-300, 90, -460);
      solAntes.scale.setScalar(170);
      (solAntes.material as THREE.SpriteMaterial).opacity = 1 - 0.55 * cubre;
      encuadrar(Math.sin(t * 0.3) * 0.4, 2 - tl * 0.1, 12 - tl * 1.3, 0, -5, -190);

      // HELIOS: seis nodos en órbita que se encienden y tienden el velo con sus haces.
      if (tl < 2.8) return;
      const enciende = tramo(tl, 3.2, 3.5);
      const tiende = tramo(tl, 3.6, 3.9) * (1 - tramo(tl, 6.6, 7.4));
      nodos.forEach((n, k) => {
        ver(n);
        const a = (k / 6) * TAU + t * 0.22;
        n.position.set(Math.cos(a) * RA * 1.55, Math.sin(a) * RA * 0.42, Math.sin(a) * RA * 1.4).add(metaAntes.position);
        n.scale.setScalar(3 + 9 * enciende * (1 + 0.4 * campana(tl, 3.45 + k * 0.05, 0.12)));
        (n.material as THREE.SpriteMaterial).opacity = 0.3 + 0.7 * tramo(tl, 2.8, 3.2);
        if (tiende < 0.01) return;
        const haz = haces[k];
        ver(haz);
        vB.subVectors(metaAntes.position, n.position);
        const largo = vB.length() - RA * 1.01;
        vB.normalize();
        haz.position.copy(n.position).addScaledVector(vB, largo / 2);
        haz.quaternion.setFromUnitVectors(EJE_Z, vB);
        haz.scale.set(0.45, 0.45, largo);
        (haz.material as THREE.MeshBasicMaterial).opacity = 0.55 * tiende * (0.8 + 0.2 * Math.sin(t * 20 + k));
        // El sulfato baja por el haz.
        for (let s = 0; s < 8; s++) {
          const f = (t * 1.5 + s / 8 + k * 0.3) % 1;
          vC.copy(n.position).addScaledVector(vB, largo * f);
          chispa(vC.x, vC.y, vC.z, cA.copy(VELO_A).multiplyScalar(tiende * (1 - f * 0.4)), 1.6);
        }
      });
    },

    refugio: (tl) => {
      ver(campo, refugio.raiz, tali.raiz, ...torres.map((a) => a.raiz));
      ponerCampo(0);
      luz(-0.6, 0.5, 0.4, '#ffb89a', 1.4);
      contraluz(0.5, 0.3, -1, PALETA.helios, 0.8);
      ambiente('#f0d8e8', '#3a2a3a', 1.1);
      refugio.raiz.position.set(0, 0, -12);
      orientar(refugio.raiz, vA.set(0.15, 0, 1));
      refugio.raiz.scale.setScalar(1.2);
      posar(refugio, ['Reposo', 1, t]);
      tali.raiz.position.set(-3.6, 0, -9.6);
      orientar(tali.raiz, vA.set(0.6, 0, 1));
      tali.raiz.scale.setScalar(1);
      posar(tali, ['Trabajar', 1, t]);
      torres.forEach((a, k) => {
        a.raiz.position.set(k ? 36 : -28, 0, k ? -96 : -78);
        orientar(a.raiz, vA.set(-a.raiz.position.x * 0.01, 0, 1));
        a.raiz.scale.setScalar(1.8);
        posar(a, ['Emitir', 1, t + k * 1.3]);
      });
      pintarRocas(0);
      nieve(1);
      // La llamada: un haz y tres pulsos que suben desde la antena del refugio.
      refugio.raiz.updateMatrixWorld();
      vD.set(1.0, 4.9, -1.5).applyMatrix4(refugio.raiz.matrixWorld);
      const aviso = tramo(tl, 4.8, 5.2);
      if (aviso > 0) {
        ver(hazSenal);
        hazSenal.position.copy(vD).add(vA.set(0, 90, 0));
        hazSenal.quaternion.setFromUnitVectors(EJE_Z, ARRIBA);
        hazSenal.scale.set(0.08, 0.08, 180);
        (hazSenal.material as THREE.MeshBasicMaterial).opacity = 0.3 * aviso;
      }
      anillosSenal.forEach((s, k) => {
        const tau = tl - (4.9 + k * 0.7);
        if (tau < 0 || tau > 1.8) return;
        ver(s);
        s.position.copy(vD).add(vA.set(0, tau * 16, 0));
        s.scale.setScalar(1.5 + tau * 10);
        (s.material as THREE.SpriteMaterial).opacity = (1 - tau / 1.8) ** 1.3;
      });
      // La cámara sigue la llamada hacia el cielo.
      const sube = tramo(tl, 4.6, 7.0);
      encuadrar(-1 + tl * 0.25, 1.5 + sube * 1.5, 7 - tl * 0.5, 0, THREE.MathUtils.lerp(2.4, 45, sube), THREE.MathUtils.lerp(-12, -40, sube));
    },

    ares: (tl) => {
      ver(ares, meta);
      luz(1, 0.35, 0.45, '#fff1dc', 2.4);
      contraluz(-1, -0.4, -0.5, '#6a8cff', 0.5);
      ambiente('#c3c6ff', '#3d2440', 1.1);
      ares.position.set(-34, -34, -130);
      ares.rotation.y = 1.2 + t * 0.03;
      estadoAres(0, 0, t);
      meta.position.set(75, 26, -460);
      meta.scale.setScalar(0.075);
      meta.rotation.y = t * 0.02;
      encuadrar(tl * 0.25, 0.3 - tl * 0.05, 0, -4, -2, -60);

      flota.forEach((n, i) => {
        ver(n.raiz);
        naveEnAres(i, tl, n.raiz.position);
        orientar(n.raiz, vB.copy(DESTINO_FLOTA).sub(naveEnAres(i, 0, vA)), Math.sin(t + i) * 0.1);
        n.raiz.scale.setScalar(2.2);
        posar(n, ['Volar', 1, t + i * 0.3]);
        empuje(n, 1.3, t);
        // Estela: por donde ha pasado cada nave.
        for (let s = 1; s <= 16; s++) {
          const pasado = tl - s * 0.045;
          if (pasado - i * 0.22 <= 0) break;
          naveEnAres(i, pasado, vC);
          chispa(vC.x, vC.y, vC.z, cA.copy(ESTELA).multiplyScalar(0.9 * (1 - s / 17)), 1.6 * (1 - s / 22));
        }
      });
      // La nave del especialista pasa junto a la cámara, da un tonel y se une a ellas.
      if (tl >= 0.5) {
        ver(heroe.raiz);
        RUTA_HEROE(tl, vA, vB);
        heroe.raiz.position.copy(vA);
        orientar(heroe.raiz, vB, -0.2 + TAU * tramo(tl, 1.5, 2.3));
        heroe.raiz.scale.setScalar(1);
        const w = tramo(tl, 2.2, 2.8);
        posar(heroe, ['Turbo', 1 - w, t], ['Volar', w, t]);
        empuje(heroe, 1.6 - 0.4 * w, t);
        for (let s = 1; s <= 18; s++) {
          const pasado = tl - s * 0.03;
          if (pasado < 0.5) break;
          RUTA_HEROE(pasado, vC, vD);
          if (vC.distanceTo(camara.position) < 3) continue;
          chispa(vC.x, vC.y, vC.z, cA.copy(ESTELA).multiplyScalar(0.8 * (1 - s / 19)), 0.4 * (1 - s / 24));
        }
      }
    },

    helios: (tl) => {
      ver(meta, ojo, brilloOjo, rayaOjo);
      luz(-0.3, 0.6, 0.6, '#ffd9c8', 1.6);
      contraluz(0, -1, -1, PALETA.helios, 1.6);
      ambiente('#b9a8ff', '#3d2440', 0.8);
      meta.position.set(0, -150, -300);
      meta.scale.setScalar(1);
      meta.rotation.y = t * 0.02;

      // El ojo se abre de golpe y late.
      const apertura = tramo(tl, 0.4, 1.3);
      ojo.position.set(0, 20, -268);
      ojo.scale.set(48, 48 * Math.max(0.04, apertura), 1);
      brilloOjo.position.set(0, 20, -270);
      brilloOjo.scale.setScalar(130 * (0.3 + 0.7 * apertura) * (1 + 0.06 * Math.sin(t * 5)));
      (brilloOjo.material as THREE.SpriteMaterial).opacity = 0.55 * apertura;
      rayaOjo.position.set(0, 20, -266);
      rayaOjo.scale.set(320 * apertura, 6 + 3 * apertura, 1);
      (rayaOjo.material as THREE.SpriteMaterial).opacity = 0.55 * apertura * (0.85 + 0.15 * Math.sin(t * 7));
      for (const p of PULSOS_OJO) {
        const tau = t - p;
        if (tau < 0 || tau > 1.3) continue;
        ver(pulsoOjo);
        pulsoOjo.position.set(0, 20, -265);
        pulsoOjo.scale.setScalar(40 + 380 * tau ** 0.8);
        (pulsoOjo.material as THREE.SpriteMaterial).opacity = (1 - tau / 1.3) ** 1.5;
      }
      sacudida += campana(tl, 3.0, 0.35) * 0.35;
      encuadrar(0, 2 - tl * 0.4, 20 - tl * 3, 0, 4, -260);

      // Del ojo sale el enjambre, directo a la cámara.
      enjambre.forEach((a, j) => {
        const f = (tl - 1.4 - j * 0.12) / 2.6;
        if (f < 0 || f > 1.05) return;
        ver(a.raiz);
        vA.set((azar(j) - 0.5) * 20, 18 + (azar(j + 50) - 0.5) * 12, -262);
        vB.set(-34 + (j % 7) * 11, -6 + Math.floor(j / 7) * 13 + azar(j + 9) * 4, 26);
        a.raiz.position.lerpVectors(vA, vB, f ** 1.7);
        orientar(a.raiz, vC.subVectors(vB, vA), Math.sin(t * 3 + j) * 0.3);
        a.raiz.scale.setScalar(2.6);
        posar(a, ['Volar', 1, t * 1.6 + j]);
      });
      // Y el Dragón del Velo sube desde detrás de Meta rugiendo.
      if (tl >= 2.2) {
        ver(dragon.raiz);
        RUTA_DRAGON_OJO(tl, vA, vB);
        dragon.raiz.position.copy(vA);
        orientar(dragon.raiz, vB, -0.25);
        dragon.raiz.scale.setScalar(1.7);
        const w = tramo(tl, 2.8, 3.0) * (1 - tramo(tl, 4.2, 4.4));
        posar(dragon, ['Volar', 1 - w, t], ['Rugir', w, tl - 2.8, false]);
      }
    },

    guerra: (tl) => {
      ver(ares, meta);
      luz(0.5, 0.7, 0.5, '#fff1dc', 2.2);
      contraluz(1, 0.2, -0.6, PALETA.helios, 0.8);
      ambiente('#c3c6ff', '#3d2440', 1.0);
      ares.position.set(-170, -40, -420);
      ares.rotation.y = 2 + t * 0.03;
      estadoAres(0.12, 0, t);
      meta.position.set(260, 50, -640);
      meta.scale.setScalar(0.35);
      meta.rotation.y = t * 0.02;
      encuadrar(-2 + tl * 0.5, 2, 8, tl * 0.4, 0, -32);

      flota.forEach((n, i) => {
        if (!viva(CAE_NAVE, i, t)) return;
        ver(n.raiz);
        naveEnGuerra(i, t, n.raiz.position);
        orientar(n.raiz, vA.set(1, Math.cos(t * 1.3 + i * 2) * 0.12, -0.12), Math.sin(t * 0.9 + i) * 0.25);
        n.raiz.scale.setScalar(1.4);
        posar(n, ['Volar', 1, t + i * 0.3]);
        empuje(n, 1, t);
      });
      enjambre.forEach((a, j) => {
        if (!viva(CAE_AVISPA, j, t)) return;
        ver(a.raiz);
        avispaEnGuerra(j, t, a.raiz.position);
        orientar(a.raiz, vA.set(-1, 0, 0.1), Math.sin(t * 3 + j) * 0.3);
        a.raiz.scale.setScalar(2);
        posar(a, ['Volar', 1, t * 1.6 + j]);
      });
      ver(heraldo.raiz);
      heraldoEnGuerra(t, heraldo.raiz.position);
      orientar(heraldo.raiz, vA.set(-1, 0, 0.35));
      heraldo.raiz.scale.setScalar(1);
      // Flotar y no Bombardeo: ese clip pinta sus avisos en el suelo, y aquí no hay suelo.
      posar(heraldo, ['Flotar', 1, t]);

      // El Dragón cruza la batalla y quema una nave con su aliento.
      if (tl >= 1.8 && tl < 5.3) {
        ver(dragon.raiz);
        poseDragon(t, dragon.raiz);
        const w = tramo(tl, 2.8, 3.0) * (1 - tramo(tl, 4.3, 4.5));
        posar(dragon, ['Volar', 1 - w, t], ['Aliento', w, tl - 2.85, false]);
        aliento();
      }
    },

    ciudad: (tl) => {
      ver(ciudad, titan.raiz, cancerbero.raiz);
      estrellas.visible = false;
      escena.background = incendio;
      escena.fog = niebla;
      luz(-0.3, 0.35, -1, '#ff8a50', 2.2);
      contraluz(1, 0.5, 1, PALETA.purpura, 0.6);
      ambiente('#ff8a6a', '#2a1420', 1.4);
      fogon.position.set(2, 6, -9);
      fogon.color.set('#ff9a50');
      fogon.intensity = 4 + 0.8 * Math.sin(t * 17) * Math.sin(t * 7.3);
      sacudida += campana(tl, 1.15, 0.1) * 0.35 + campana(tl, 3.15, 0.1) * 0.35;
      encuadrar(-3 + tl * 0.4, 1.6 + tl * 0.15, 8, 2 + tl * 0.3, 5 + tl * 1.2, -30);

      // El Titán pisotea delante; el Cancerbero carga desde el fondo de la avenida.
      titan.raiz.position.set(9, 0, -24);
      orientar(titan.raiz, vA.set(-0.8, 0, 1));
      titan.raiz.scale.setScalar(1.3);
      posar(titan, ['Pisoton', 1, tl % 2]);
      vA.set(-46, 0, -84);
      vB.set(-4, 0, -22);
      cancerbero.raiz.position.lerpVectors(vA, vB, suave((tl - 0.2) / 3.6));
      orientar(cancerbero.raiz, vC.subVectors(vB, vA));
      cancerbero.raiz.scale.setScalar(1);
      posar(cancerbero, ['Embestir', 1, t]);
      // Una escuadrilla de avispas cruza el cielo.
      for (let j = 0; j < 8; j++) {
        const a = enjambre[j];
        ver(a.raiz);
        a.raiz.position.set(-95 + tl * 42 + (j % 4) * 7 - Math.floor(j / 4) * 4, 30 + Math.floor(j / 4) * 5 + Math.sin(t * 2 + j), -80 - (j % 4) * 4);
        orientar(a.raiz, vA.set(1, 0, 0), Math.sin(t * 3 + j) * 0.2);
        a.raiz.scale.setScalar(4);
        posar(a, ['Volar', 1, t * 1.6 + j]);
      }

      fuegos.forEach((f, k) => f.scale.setScalar(f.userData.tam * (0.8 + 0.2 * Math.sin(t * (9 + k) + k) * Math.sin(t * 5.3 + k * 2))));
      for (const [x, y, z, fase] of ventanas) {
        const parpadeo = Math.sin(t * 2 + fase * 3.1) > -0.6 ? 1 : 0.2;
        chispa(x, y, z, cA.copy(LUZ_VENTANA).multiplyScalar(0.55 * parpadeo), 0.9);
      }
      // Ascuas que suben de los incendios.
      for (let k = 0; k < 220; k++) {
        const sube = 3 + azar(k * 3 + 1) * 5, alto = 60;
        const y = (t * sube + azar(k * 3 + 2) * alto) % alto;
        const x = (azar(k * 3) * 2 - 1) * 90 + Math.sin(t * 0.8 + k) * 2;
        const z = -40 - azar(k * 3 + 5) * 140;
        chispa(x, y, z, cA.copy(BRASA).multiplyScalar(0.8 * (1 - y / alto)), 0.6);
      }
    },

    caida: (tl) => {
      const roto = t >= ESTALLA;
      luz(0.6, 0.4, 0.7, '#fff1dc', 2.2);
      contraluz(-0.5, 0.2, -1, PALETA.helios, 1.2);
      ambiente('#c3c6ff', '#3d2440', 0.9);
      const C = CENTRO_CAIDA;
      const grietas = tramo(tl, 2.0, 2.9);
      if (!roto) {
        ver(ares, brasaAres);
        ares.position.copy(C);
        ares.rotation.y = 2.6 + t * 0.04;
        estadoAres(tramo(tl, 0.1, 2.4), grietas, t);
        brasaAres.position.copy(C).z += 30;
        brasaAres.scale.setScalar(RA * 2.6 * grietas);
        (brasaAres.material as THREE.SpriteMaterial).opacity = 0.5 * grietas;
        sacudida += 0.14 * grietas;

        // Las avispas dan vueltas a Ares rociando el velo.
        for (let j = 0; j < 10; j++) {
          const a = enjambre[j];
          ver(a.raiz);
          const ang = (j * TAU) / 10 + t * 0.55, r = 78 + Math.sin(t + j) * 3;
          a.raiz.position.set(C.x + Math.cos(ang) * r, C.y + Math.sin(j * 1.7) * 18, C.z + Math.sin(ang) * r * 0.55);
          orientar(a.raiz, vA.set(-Math.sin(ang), 0, Math.cos(ang) * 0.55));
          a.raiz.scale.setScalar(6);
          posar(a, ['Volar', 1, t * 1.6 + j]);
          vB.subVectors(C, a.raiz.position).normalize();
          for (let s = 0; s < 6; s++) {
            const f = (t * 2.2 + s / 6 + j * 0.37) % 1;
            vC.copy(a.raiz.position).lerp(vD.copy(C).addScaledVector(vB, -RA * 1.02), f);
            chispa(vC.x, vC.y, vC.z, cA.copy(VELO_A).multiplyScalar(0.9 * (1 - f * 0.5)), 2.2);
          }
        }
      } else {
        // Estalla: esquirlas, onda y un destello que tapa la pantalla.
        const tau = t - ESTALLA;
        ver(roca, lava, onda, nucleo);
        pintarEsquirlas(C, 1, tau);
        onda.position.copy(C);
        onda.rotation.set(1.25, 0.2, 0);
        onda.scale.setScalar(RA * (1.05 + 4.2 * tau ** 0.7));
        (onda.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - tau / 1.8) ** 1.5;
        onda.visible = tau < 1.8;
        nucleo.position.copy(C);
        nucleo.scale.setScalar(RA * (3.2 * campana(t, ESTALLA + 0.05, 0.25) + 1.2 * Math.exp(-tau * 1.5)));
        sacudida += 0.9 * Math.exp(-tau * 2.2);
      }
      encuadrar(0, 0, -tl * 2.2, 0, -2, C.z);
    },

    especialista: (tl) => {
      ver(especialista.raiz, heroe.raiz, roca, lava);
      // La explosión queda detrás de la cámara: le da en la cara, naranja.
      luz(0.4, 0.3, 1, '#ffa060', 2.8);
      contraluz(-0.3, 0.4, -1, PALETA.ada, 1.4);
      ambiente('#7f8cff', '#1a0c14', 0.7);
      fogon.position.set(0.5, 1.2, 1.5);
      fogon.color.set('#ff9a50');
      fogon.intensity = 1.5 * (0.8 + 0.2 * Math.sin(t * 9)) * Math.exp(-tl * 0.4);
      encuadrar(0.35 - tl * 0.08, 0.7, 0.7 - tl * 0.25, 0, 0.55, -2.6);

      especialista.raiz.position.set(0, -1.05 + Math.sin(t * 1.3) * 0.05, -2.6);
      orientar(especialista.raiz, vA.set(0.15, 0, 1));
      especialista.raiz.scale.setScalar(1);
      posar(especialista, ['Reposo', 1, t]);
      heroe.raiz.position.set(2.8, 0.3 + Math.sin(t) * 0.1, -9);
      orientar(heroe.raiz, vA.set(-1, 0, -0.25), 0.1);
      heroe.raiz.scale.setScalar(1);
      posar(heroe, ['Flotar', 1, t]);
      empuje(heroe, 0.45, t);
      // Lo que queda de Ares sigue pasando por detrás, y flota polvo delante.
      pintarEsquirlas(vA.set(-6, 2, -45), 0.3, t - ESTALLA);
      for (let k = 0; k < 50; k++) {
        const x = (azar(k * 5 + 1) - 0.5) * 6 + Math.sin(t * 0.3 + k) * 0.2;
        const y = -1.5 + ((azar(k * 5 + 2) * 4 + t * 0.06) % 4);
        chispa(x, y, -1.2 - azar(k * 5 + 3) * 4, cA.setRGB(1, 0.78, 0.55).multiplyScalar(0.3), 0.035);
      }
    },

    llave: (tl) => {
      ver(noa.raiz, auraLlave, aroLlave);
      escena.background = OSCURIDAD;
      estrellas.visible = false;
      luz(0.3, 0.6, 0.8, '#bfe8ff', 1.0);
      contraluz(0, 0.3, -1, PALETA.ada, 1.2);
      ambiente('#6a8cff', '#0a0a1a', 0.6);
      const aparece = tramo(tl, 0.1, 0.7);
      // Mientras HELIOS la busca, la señal falla a tirones.
      const busca = tl > 3.1 && tl < 5.3;
      const tiron = busca && azar(Math.floor(t * 18)) > 0.7 ? 1 : 0;
      const tinte = tiron ? ROJO_HELIOS : CIAN;
      const talla = 1.4;
      noa.raiz.position.set(0, 0.3, -3);
      orientar(noa.raiz, vA.set(Math.sin(t * 0.3) * 0.2, 0, 1));
      noa.raiz.scale.set(talla * (1 + tiron * 0.25), talla * Math.max(0.02, aparece) * (1 - tiron * 0.08), talla);
      const wE = tramo(tl, 3.0, 3.3) * (1 - tramo(tl, 4.5, 4.8)), wH = tramo(tl, 4.5, 4.8);
      posar(noa, ['Reposo', Math.max(0, 1 - wE - wH), t], ['Escanear', wE, tl - 3.0, false], ['Hablar', wH, t]);
      auraLlave.position.set(0, 0.3, -3.4);
      auraLlave.scale.setScalar(4.5 * aparece * (1 + 0.05 * Math.sin(t * 3)));
      (auraLlave.material as THREE.SpriteMaterial).color.copy(tinte);
      (auraLlave.material as THREE.SpriteMaterial).opacity = 0.5;
      aroLlave.position.set(0, 0.3 - 0.95 * talla - 0.02, -3);
      aroLlave.scale.setScalar(1.5 * (1 + 0.06 * Math.sin(t * 4)));
      (aroLlave.material as THREE.MeshBasicMaterial).opacity = 0.7 * aparece;
      // Datos que suben en espiral alrededor de ADA.
      for (let k = 0; k < 120; k++) {
        const a = k * 2.399 + t * (0.8 + (k % 3) * 0.2), r = 0.9 + (k % 4) * 0.25;
        const y = -1.0 + ((k * 0.137 + t * 0.35) % 3.0);
        chispa(Math.cos(a) * r, 0.3 + y, -3 + Math.sin(a) * r, cA.copy(tinte).multiplyScalar(0.7 * aparece), 0.045);
      }
      const giro = -0.5 + tl * 0.12;
      encuadrar(Math.sin(giro) * 3.6, 0.9, -3 + Math.cos(giro) * 3.6, 0, 0.5, -3);
      // Ficha junto al holograma: primero ADA, luego Noa.
      const deNoa = String(tl >= 4.6);
      if (ficha.dataset.quien !== deNoa) {
        ficha.dataset.quien = deNoa;
        fichaTitulo.textContent = deNoa === 'true' ? 'NOA HERRERA' : 'ADA · MÓDULO DE AUDITORÍA 7';
        fichaLinea.textContent = deNoa === 'true' ? 'INGENIERA DE HELIOS · LA ESCONDIÓ EN META' : 'AUTORIDAD: FIRMAR EL APAGADO';
      }
      const e = enPantalla(vA.set(0.95, 1.5, 0).add(noa.raiz.position));
      const x = Math.max(16, Math.min(e.x, W - ficha.offsetWidth - 16));
      ficha.style.transform = `translate(${x.toFixed(1)}px, ${e.y.toFixed(1)}px) translateY(-50%)`;
      ficha.style.opacity = (tramo(tl, 0.8, 1.2) * (1 - tramo(tl, 6.5, 6.85)) * (tiron ? 0.4 : 1)).toFixed(3);
    },

    meta: (tl) => {
      ver(meta, heroe.raiz, baliza, balizaNucleo);
      luz(-0.5, 0.6, 0.5, '#fff1dc', 2.2);
      contraluz(0, -0.5, -1, PALETA.helios, 0.8);
      ambiente('#c3c6ff', '#3d2440', 1.1);
      meta.position.set(0, -150, THREE.MathUtils.lerp(-760, -470, suave(tl / 3.9)));
      meta.scale.setScalar(1);
      meta.rotation.y = t * 0.02;
      encuadrar(Math.sin(t * 0.5) * 0.3, 0.9, 0, 0, -0.2, -40);

      // En vertical se acerca al centro para no salirse por el borde.
      const lado = THREE.MathUtils.clamp(camara.aspect / 1.6, 0.45, 1);
      heroe.raiz.position.set(-2.4 * lado + Math.sin(t * 0.8) * 0.25, -0.6 + Math.sin(t * 1.2) * 0.12, -8);
      orientar(heroe.raiz, vA.set(0.06, -0.06, -1), Math.sin(t * 0.7) * 0.12);
      heroe.raiz.scale.setScalar(1);
      // Sale del salto a todo gas y se calma al ver Meta.
      const w = tramo(tl, 0.5, 1.2);
      posar(heroe, ['Turbo', 1 - w, t], ['Volar', w, t]);
      empuje(heroe, 1.5 - 0.65 * w, t);
      if (tl < 1.1) {
        ver(salto);
        pintarSalto(tl);
      }

      // En la cara de Meta late la señal de ADA.
      vA.set(0.35, 0.8, 0.5).normalize().multiplyScalar(RM * 1.004).add(meta.position);
      const pulso = (tl * 1.4) % 1;
      baliza.position.copy(vA);
      baliza.scale.setScalar(7 + 7 * pulso);
      (baliza.material as THREE.SpriteMaterial).opacity = 1 - pulso;
      balizaNucleo.position.copy(vA);
      balizaNucleo.scale.setScalar(4 * (0.8 + 0.2 * Math.sin(t * 6)));
      const e = enPantalla(vA);
      senal.style.transform = `translate(${e.x.toFixed(1)}px, ${e.y.toFixed(1)}px) translate(-50%, -190%)`;
    },

    mision: (tl) => {
      const sol = tramo(t, VUELVE_EL_SOL, VUELVE_EL_SOL + 1.6);
      ver(campo, especialista.raiz, ...horda.map((a) => a.raiz), balizaHelios.raiz, cohete.raiz);
      ponerCampo(sol);
      luz(-0.5, 0.55, 0.5, cA.lerpColors(LUZ_VELO, LUZ_SOL, sol), 1.4 + 1.4 * sol);
      contraluz(0.4, 0.3, -1, sol > 0.5 ? '#ffd9a0' : PALETA.helios, 0.8);
      ambiente(sol > 0.5 ? '#fff0d8' : '#f0d8e8', '#3a2a3a', 1.1 + 0.5 * sol);
      // El suelo corre hacia la cámara: el especialista huye de la horda hasta que vuelve el sol.
      const parada = VUELVE_EL_SOL - PLANOS.mision[0] + 0.2;
      pintarRocas(tl < parada ? 9 * tl : 9 * parada + 4.5 * (1 - Math.exp(-(tl - parada) * 2)));
      especialista.raiz.position.set(0, 0, -5);
      orientar(especialista.raiz, vA.set(0, 0, 1));
      especialista.raiz.scale.setScalar(1);
      const fiesta = tramo(tl, parada + 0.1, parada + 0.4);
      posar(especialista, ['Correr', 1 - fiesta, t], ['Victoria', fiesta, tl - parada]);
      horda.forEach((a, j) => {
        const cae = VUELVE_EL_SOL + 0.2 + j * 0.08;
        a.raiz.position.set((j - 3.5) * 1.7 + Math.sin(t * 2 + j) * 0.3, 0, -11 - (j % 3) * 2.4 + Math.sin(t * 3 + j) * 0.3);
        orientar(a.raiz, vA.set(-a.raiz.position.x * 0.05, 0, 1));
        a.raiz.scale.setScalar(1.3);
        if (t < cae) posar(a, ['Caminar', 1, t * 1.6 + j * 0.13]);
        else posar(a, ['Derrota', 1, t - cae, false]);
      });
      balizaHelios.raiz.position.set(3, 0.6 + Math.sin(t * 1.3) * 0.2, -9);
      orientar(balizaHelios.raiz, vA.set(-0.3, 0, 1));
      balizaHelios.raiz.scale.setScalar(1.4);
      const apaga = VUELVE_EL_SOL + 0.3;
      posar(balizaHelios, t < apaga ? ['Triangular', 1, t] : ['Derrota', 1, t - apaga, false]);

      // El cohete despega al abrirse la ventana y atraviesa el velo.
      const vuelo = Math.max(0, t - VENTANA), subida = VUELVE_EL_SOL - VENTANA;
      const alto = (s: number) => 150 * (s / subida) ** 2;
      cohete.raiz.position.set(COHETE.x, 0, COHETE.z);
      cohete.raiz.scale.setScalar(2.6);
      cohete.nave.position.y = alto(Math.min(vuelo, subida));
      cohete.nave.visible = vuelo < subida;
      if (vuelo > 0 && vuelo < subida) {
        ver(llamaCohete);
        llamaCohete.position.set(COHETE.x, alto(vuelo) * 2.6 + 1.5, COHETE.z);
        llamaCohete.scale.setScalar(16 * (0.8 + 0.2 * Math.sin(t * 40)));
      }
      for (let s = 1; s <= 30 && vuelo > 0; s++) {
        const pasado = Math.min(vuelo, subida) - s * 0.045;
        if (pasado <= 0) break;
        chispa(COHETE.x + Math.sin(s * 1.7) * 1.2, alto(pasado) * 2.6, COHETE.z, cA.copy(BRASA).multiplyScalar(1 - s / 31), 3.5 + s * 0.2);
      }
      // Vuelve el sol: un haz de luz cae sobre el sector y brillan las motas en él.
      if (sol > 0) {
        ver(hazSol, solMision);
        hazSol.position.set(0, 65, -6);
        (hazSol.material as THREE.MeshBasicMaterial).opacity = 0.2 * sol * (0.9 + 0.1 * Math.sin(t * 2));
        solMision.position.set(-60, 170, -280);
        solMision.scale.setScalar(150 * sol);
        for (let k = 0; k < 60; k++) {
          const a = k * 2.399 + t * 0.1, r = 1 + (k % 7) * 1.6;
          chispa(Math.cos(a) * r, (k * 0.37 + t * 0.4) % 12, -6 + Math.sin(a) * r, cA.setRGB(1, 0.86, 0.55).multiplyScalar(0.5 * sol), 0.06);
        }
      }
      nieve(1 - sol);
      // La cámara mira a la horda, sigue al cohete hacia el velo y baja con el sol.
      const sigue = tramo(tl, 4.8, 5.6) * (1 - tramo(tl, 6.6, 7.6));
      vB.set(0, 1.6, -10).lerp(vC.set(COHETE.x, Math.max(25, alto(Math.min(vuelo, subida)) * 2.6), COHETE.z), sigue);
      encuadrar(0.6 * Math.sin(tl * 0.5), 2 + 0.6 * tramo(tl, 6.6, 8), 2.5 + 1.5 * tramo(tl, 6.6, 9), vB.x, vB.y, vB.z);
      pintarVentana(tl);
    },
  };

  /** Rocas de hielo del campo; `corre` las acerca a la cámara (metros recorridos). */
  function pintarRocas(corre: number) {
    for (let k = 0; k < N_ROCAS; k++) {
      // A los lados: por el centro pasa la cámara (y el especialista corriendo).
      const x = (azar(k * 4 + 1) < 0.5 ? -1 : 1) * (5 + azar(k * 4 + 5) * 17);
      const z = -80 + ((azar(k * 4 + 2) * 82 + corre) % 82);
      const tam = 0.25 + azar(k * 4 + 3) ** 2 * 1.4;
      qA.setFromAxisAngle(ARRIBA, azar(k * 4 + 4) * TAU);
      rocasCampo.setMatrixAt(k, mA.compose(vB.set(x, tam * 0.3, z), qA, vC.set(tam, tam * 0.7, tam)));
    }
    rocasCampo.instanceMatrix.needsUpdate = true;
  }

  /** Nieve que cae delante de la cámara; `cuanta`, de 0 a 1. */
  function nieve(cuanta: number) {
    if (cuanta <= 0.01) return;
    for (let k = 0; k < 300; k++) {
      const caida = 0.9 + azar(k * 3 + 1) * 1.4, alto = 16;
      const y = alto - ((t * caida + azar(k * 3 + 2) * alto) % alto);
      const x = (azar(k * 3) - 0.5) * 36 + Math.sin(t * 0.7 + k) * 0.6;
      chispa(x, y, 1 - azar(k * 3 + 5) * 34, cA.setRGB(0.85, 0.9, 1).multiplyScalar(0.55 * cuanta), 0.09);
    }
  }

  /** Cielo y niebla del campo helado; `sol`, de 0 (velo) a 1 (vuelve el sol). */
  function ponerCampo(sol: number) {
    estrellas.visible = false;
    escena.fog = nieblaCampo;
    const horizonte = (matCupula.uniforms.horizonte.value as THREE.Color).lerpColors(HORIZONTE_VELO, HORIZONTE_SOL, sol);
    nieblaCampo.color.copy(horizonte);
    matCupula.uniforms.sol.value = sol;
  }

  /** La cuenta atrás de la ventana de lanzamiento y las siete reliquias que se encienden al final. */
  let reliquiasEncendidas = -1;
  function pintarVentana(tl: number) {
    const abierta = t >= VENTANA;
    const quedan = Math.max(0, 600 * (1 - (tl - 0.3) / (VENTANA - PLANOS.mision[0] - 0.3)));
    const reloj = `${String(Math.floor(quedan / 60)).padStart(2, '0')}:${String(Math.floor(quedan % 60)).padStart(2, '0')}`;
    if (ventanaReloj.textContent !== reloj) ventanaReloj.textContent = reloj;
    const titulo = abierta ? 'VENTANA ABIERTA' : 'VENTANA DE LANZAMIENTO';
    if (ventanaTitulo.textContent !== titulo) ventanaTitulo.textContent = titulo;
    ventana.classList.toggle('msc__ventana--abierta', abierta);
    ventana.style.opacity = (tramo(tl, 0.2, 0.5) * (1 - tramo(tl, 6.0, 6.4)) * (abierta && Math.floor(t * 6) % 2 ? 0.55 : 1)).toFixed(3);
    const n = RELIQUIAS.filter((_, k) => tl >= 7.7 + k * 0.22).length;
    if (n !== reliquiasEncendidas) {
      reliquiasEncendidas = n;
      piezasReliquia.forEach((li, k) => li.classList.toggle('encendida', k < n));
    }
    reliquias.style.opacity = (tramo(tl, 7.4, 7.7) * (1 - tramo(tl, 9.6, 9.95))).toFixed(3);
  }

  /** Pose del Dragón en la batalla en cualquier segundo (también para su aliento). */
  function poseDragon(tau: number, obj: THREE.Object3D) {
    RUTA_DRAGON_GUERRA(tau - PLANOS.guerra[0], obj.position, vC);
    orientar(obj, vC, -0.3);
    obj.scale.setScalar(0.8);
  }

  /** Aliento del Dragón: fuego del velo que sale de su boca hacia la nave 2. */
  function aliento() {
    const TASA = 140, VIDA = 0.55;
    for (let k = Math.ceil(Math.max(ALIENTO[0], t - VIDA) * TASA); k <= Math.floor(Math.min(ALIENTO[1], t) * TASA); k++) {
      const tau = k / TASA, edad = t - tau, f = edad / VIDA;
      poseDragon(tau, fantasma);
      fantasma.updateMatrix();
      vA.copy(BOCA).applyMatrix4(fantasma.matrix);
      naveEnGuerra(2, tau + 0.3, vB).sub(vA).normalize();
      direccion(k * 13, vC);
      vA.addScaledVector(vB, 26 * edad).addScaledVector(vC, 3.5 * edad);
      chispa(vA.x, vA.y, vA.z, cA.lerpColors(VELO_A, VELO_B, f).multiplyScalar(1 - f * 0.7), 0.9 + 1.8 * f);
    }
  }

  /** Rayas del salto: vienen hacia la cámara, se frenan y se apagan en 1,1 s. */
  function pintarSalto(tl: number) {
    const luzSalto = Math.max(0, 1 - tl / 1.1);
    const avance = 320 * (tl - (tl * tl) / 2.4);
    const largo = 4 + 46 * luzSalto;
    for (let k = 0; k < N_SALTO; k++) {
      const a = azar(k * 3 + 11) * TAU, r = 2.5 + azar(k * 3 + 12) * 22;
      let z = -20 - azar(k * 3 + 13) * 260 + avance;
      while (z > 2) z -= 280;
      const x = Math.cos(a) * r, y = 0.9 + Math.sin(a) * r;
      const c = luzSalto * (0.5 + 0.5 * azar(k * 3 + 14));
      saltoPos.set([x, y, z, x, y, z - largo], k * 6);
      saltoColor.set([c, c, c, c * 0.35, c * 0.9, c], k * 6);
    }
    geoSalto.attributes.position.needsUpdate = true;
    geoSalto.attributes.color.needsUpdate = true;
  }

  /** Las esquirlas de Ares alrededor de `centro`, `tau` segundos después de romperse. */
  function pintarEsquirlas(centro: THREE.Vector3, escala: number, tau: number) {
    let ir = 0, il = 0;
    for (const e of esquirlas) {
      const dist = (0.7 + 0.3 * e.vel) * RA + e.vel * RA * 2.6 * (1 - Math.exp(-tau / 2.6));
      vB.copy(e.dir).multiplyScalar(dist * escala).add(centro);
      qA.setFromAxisAngle(e.eje, e.giro * tau + e.vel * 9);
      vC.setScalar(e.tam * RA * escala);
      mA.compose(vB, qA, vC);
      if (e.lava) lava.setMatrixAt(il++, mA);
      else roca.setMatrixAt(ir++, mA);
    }
    roca.instanceMatrix.needsUpdate = lava.instanceMatrix.needsUpdate = true;
    matLava.color.lerpColors(LAVA_VIVA, LAVA_FRIA, Math.min(1, tau / 3));
  }

  /** Temblor por las explosiones del plano: más cuanto más grandes y cercanas. */
  function temblor(plano: Plano): number {
    let s = 0;
    for (const x of ESTALLIDOS) {
      const tau = t - x.t;
      if (x.plano !== plano || tau < 0 || tau > 1.5) continue;
      s += Math.min(0.5, x.tam * 0.035) * Math.exp(-tau * 5) / (1 + x.pos.distanceTo(camara.position) / 60);
    }
    return s;
  }

  function pintarEstallidos(plano: Plano) {
    let libres = 0;
    for (const d of destellos) d.visible = false;
    for (const r of rayas) r.visible = false;
    ESTALLIDOS.forEach((x, e) => {
      const tau = t - x.t;
      if (x.plano !== plano || tau < 0 || tau > 2.6) return;
      const n = Math.round(Math.min(140, 14 + x.tam * 9));
      for (let k = 0; k < n; k++) {
        const s = e * 211 + k * 3;
        const vida = (0.5 + 0.6 * azar(s)) * (1 + x.tam * 0.03);
        const f = tau / vida;
        if (f >= 1) continue;
        direccion(s + 1, vA);
        const d = x.tam * (1.4 + 2.6 * azar(s + 2)) * (1 - Math.exp(-2.5 * tau)) * 0.8;
        chispa(x.pos.x + vA.x * d, x.pos.y + vA.y * d, x.pos.z + vA.z * d, rampa(f, cA).multiplyScalar((1 - f) ** 1.2), x.tam * 0.3 * (1 - 0.5 * f));
      }
      if (tau < 0.45 && libres < destellos.length) {
        const k = 1 - tau / 0.45;
        const d = destellos[libres], r = rayas[libres];
        libres++;
        d.visible = r.visible = true;
        d.position.copy(x.pos);
        r.position.copy(x.pos);
        d.scale.setScalar(x.tam * 2.6 * (0.5 + 0.5 * k));
        (d.material as THREE.SpriteMaterial).opacity = k;
        r.scale.set(x.tam * 11 * (0.6 + 0.4 * k), x.tam * 0.4 * (0.5 + 0.5 * k), 1);
        (r.material as THREE.SpriteMaterial).opacity = 0.75 * k;
      }
      const fuerza = Math.min(8, x.tam * 1.5 * Math.max(0, 1 - tau / 0.6));
      if (fuerza > fogon.intensity) {
        fogon.position.copy(x.pos);
        fogon.color.set('#ffb36b');
        fogon.intensity = fuerza;
      }
    });
  }

  function pintarRayos(plano: Plano) {
    let n = 0;
    for (const r of RAYOS) {
      const s = (t - r.t0) / r.dur;
      if (r.plano !== plano || s < 0 || s >= 1 || n >= MAX_RAYOS) continue;
      vA.subVectors(r.a, r.de);
      const total = vA.length();
      vA.divideScalar(total);
      const cabeza = s * total, cola = Math.max(0, cabeza - r.largo);
      vB.copy(r.de).addScaledVector(vA, (cabeza + cola) / 2);
      qA.setFromUnitVectors(EJE_Z, vA);
      vC.set(r.grosor, r.grosor, Math.max(0.01, cabeza - cola));
      nucleoRayos.setMatrixAt(n, mA.compose(vB, qA, vC));
      nucleoRayos.setColorAt(n, cA.copy(r.color).lerp(BLANCO, 0.55));
      vC.x = vC.y = r.grosor * 3.2;
      haloRayos.setMatrixAt(n, mA.compose(vB, qA, vC));
      haloRayos.setColorAt(n, r.color);
      n++;
    }
    for (const m of [nucleoRayos, haloRayos]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------- medidas

  let W = 1, H = 1;
  const enPantalla = (v: THREE.Vector3) => {
    vD.copy(v).project(camara);
    return { x: (vD.x + 1) / 2 * W, y: (1 - vD.y) / 2 * H };
  };
  // Se mide la capa y no la ventana: así también cabe dentro de una página.
  const encajar = () => {
    W = capa.clientWidth || window.innerWidth;
    H = capa.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camara.aspect = W / H;
    // Los planos se encuadran en horizontal: en vertical se abre el campo
    // para que quepa casi lo mismo de lado a lado.
    camara.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(31)) / camara.aspect)), 50, 80);
    camara.updateProjectionMatrix();
    matChispas.uniforms.escala.value = (H * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2));
  };
  encajar();
  const observador = new ResizeObserver(encajar);
  observador.observe(capa);

  // ---------------------------------------------------------- rótulos

  const partes = (el: HTMLElement) => [...el.querySelectorAll('span')] as [HTMLElement, HTMLElement];
  const huecos = { narra: partes(voces.narra), helios: partes(voces.helios) };
  /** Escribe el rótulo de cada voz letra a letra; lo que falta ya ocupa su sitio. */
  const escribir = (voz: Rotulo['voz']) => {
    const el = voces[voz], [dicho, resto] = huecos[voz];
    const r = ROTULOS.find((x) => x.voz === voz && t >= x.de && t < x.a);
    if (!r) {
      el.style.opacity = '0';
      return;
    }
    const n = Math.min(r.texto.length, Math.floor((t - r.de) * LETRAS_POR_SEGUNDO) + 1);
    if (dicho.textContent !== r.texto.slice(0, n)) {
      dicho.textContent = r.texto.slice(0, n);
      resto.textContent = r.texto.slice(n);
    }
    let op = tramo(t, r.de, r.de + 0.12) * (1 - tramo(t, r.a - 0.3, r.a));
    if (voz === 'helios') {
      // HELIOS llega como una transmisión: salta y parpadea de vez en cuando.
      const g = Math.floor(t * 24);
      el.style.transform = `translateX(${azar(g) > 0.86 ? ((azar(g + 1) - 0.5) * 12).toFixed(1) : 0}px)`;
      if (azar(g + 2) > 0.93) op *= 0.4;
    }
    el.style.opacity = op.toFixed(3);
  };

  // ---------------------------------------------------------- fotograma

  // Con un gesto antes (el clic que despega la nave en la intro) suena desde
  // el principio. Sin él (saltar la intro con Esc no cuenta) el navegador no
  // deja sonar: espera en negro a que se pulse, así la música empieza con ella.
  let gesto = opts.sonido ?? navigator.userActivation?.hasBeenActive ?? false;
  let esperando = opts.fijo === undefined && !gesto;
  puerta.hidden = !esperando;
  let banda: ((suave: boolean) => void) | null = null;
  /** Con música, la imagen sigue al reloj del audio: [contexto, instante del audio, segundo de la cinemática]. */
  let relojBanda: { a: AudioContext; a0: number; t0: number } | null = null;
  const arrancarBanda = () => {
    if (banda || opts.fijo !== undefined) return;
    sonar((a, ahora) => {
      const cuando = ahora + 0.06;
      banda = tocarBanda(a, t, cuando);
      relojBanda = { a, a0: cuando, t0: t };
    });
  };

  const pintar = (dt: number) => {
    const antes = t;
    if (opts.fijo === undefined && !esperando) {
      t = relojBanda
        ? Math.min(DURACION, Math.max(t, relojBanda.t0 + relojBanda.a.currentTime - relojBanda.a0))
        : Math.min(DURACION, t + dt);
    }
    const plano = planoEn(t);
    opts.alAvanzar?.(t);

    for (const o of conmutables) o.visible = false;
    for (const el of [ficha, ventana, reliquias]) el.style.opacity = '0';
    estrellas.visible = true;
    escena.background = espacio;
    escena.fog = null;
    fogon.intensity = 0;
    nChispas = 0;
    sacudida = temblor(plano);
    planos[plano](t - PLANOS[plano][0]);
    pintarEstallidos(plano);
    pintarRayos(plano);
    estrellas.position.copy(camara.position);
    cupula.position.copy(camara.position);
    geoChispas.setDrawRange(0, nChispas);
    for (const nombre of ['position', 'tinte', 'tam']) geoChispas.attributes[nombre].needsUpdate = true;

    escribir('narra');
    escribir('helios');
    const cuadro = Math.floor(t * 24);
    grano.style.transform = `translate(${(-azar(cuadro + 7) * 64).toFixed(0)}px, ${(-azar(cuadro + 9) * 64).toFixed(0)}px)`;
    const entra = suave(t / 0.7);
    bandaArriba.style.transform = `translateY(${(-100 * (1 - entra)).toFixed(1)}%)`;
    bandaAbajo.style.transform = `translateY(${(100 * (1 - entra)).toFixed(1)}%)`;
    senal.style.opacity = plano === 'meta' ? (tramo(t, en('meta', 0.6), en('meta', 1.1)) * (1 - tramo(t, PLANOS.meta[1] - 0.5, PLANOS.meta[1] - 0.15))).toFixed(3) : '0';
    const corte = Math.max(...CORTES.map((c) => campana(t, c, 0.07))) * 0.92;
    negro.style.opacity = Math.max(1 - tramo(t, 0, 0.7), corte, tramo(t, DURACION - 0.6, DURACION)).toFixed(3);
    const tauBlanco = t - ESTALLA - 0.04;
    blanco.style.opacity = (tauBlanco < 0 ? campana(t, ESTALLA + 0.04, 0.07) : 0.85 * Math.exp(-tauBlanco * 4)).toFixed(3);
    renderer.render(escena, camara);

    // Sonidos al cruzar su momento (no al saltar por encima).
    if (t - antes > 0 && t - antes < 0.25) {
      const cruza = (x: number) => antes < x && t >= x;
      if (gesto) arrancarBanda();
      for (const [x, fn] of SONIDOS) if (cruza(x)) sonar(fn);
      RAYOS.forEach((r, k) => {
        if (!cruza(r.t0)) return;
        // Los orbes del Heraldo suenan graves; de los rayos, uno de cada dos.
        if (r.grosor > 0.2) sonar((a, t0) => tono(a, t0, 'sine', 320, 110, 0.3, 0.035));
        else if (k % 2 === 0) sonar((a, t0) => tono(a, t0, 'square', 1400, 260, 0.12, 0.012));
      });
      for (const x of ESTALLIDOS) {
        if (x.plano === 'mision' || x.tam < 2 || x.tam > 20 || !cruza(x.t)) continue;
        sonar((a, t0) => estallido(a, t0, 0.5 + x.tam * 0.05, Math.min(0.16, 0.05 + x.tam * 0.012)));
      }
    }
    if (t >= DURACION && opts.fijo === undefined) acabar(true);
  };

  // ---------------------------------------------------------- control

  let vivo = true, raf = 0;
  /** `natural`: ha llegado al final y la música se apaga sola; si no, corta. */
  const soltar = (natural = false) => {
    vivo = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', alTecla);
    observador.disconnect();
    capa.removeEventListener('pointerdown', alToque);
    banda?.(natural);
  };
  const destruir = () => {
    capa.remove();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  /** Fin o salto: lo que sigue se monta debajo y esta capa se funde encima. */
  const acabar = (natural = false) => {
    if (!vivo) return;
    soltar(natural);
    onDone();
    capa.classList.add('msc--fuera');
    window.setTimeout(destruir, 650);
  };
  const alToque = () => {
    // El primer gesto desbloquea el audio y, si esperaba, arranca.
    gesto = true;
    sonar(() => undefined);
    esperando = false;
    puerta.hidden = true;
  };
  const alTecla = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' && e.code !== 'Enter' && e.code !== 'Space') return;
    // Sin esto, el menú que se abre debajo recibiría la misma pulsación.
    e.preventDefault();
    if (esperando && e.code !== 'Escape') alToque();
    else acabar();
  };
  capa.addEventListener('pointerdown', alToque);
  boton.addEventListener('click', () => acabar());
  boton.hidden = opts.fijo !== undefined;
  if (opts.fijo === undefined) window.addEventListener('keydown', alTecla);

  let ultimo = performance.now();
  const fotograma = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    pintar(dt);
    raf = requestAnimationFrame(fotograma);
  };
  // El primer fotograma sale ya: con `fijo`, la captura no espera a que el navegador pinte.
  pintar(0);
  if (!esperando) arrancarBanda();
  raf = requestAnimationFrame((ahora) => {
    ultimo = ahora;
    raf = requestAnimationFrame(fotograma);
  });

  return () => {
    if (!vivo) return;
    soltar();
    destruir();
  };
}
