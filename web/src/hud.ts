import './hud.css';
import { iconoMejora, iconoMenu } from './iconos.ts';

// HUD de Meta Space, rehecho para el mapa nuevo. Sustituye a la parte del HUD
// de ui.ts del juego con las mismas funciones (showHud, hideHud, setMision,
// updateHud, drawMinimap) y estados compatibles: lo nuevo es opcional, así el
// juego puede ir rellenándolo poco a poco.
//
// Paneles gruesos con contorno oscuro, como el dibujo de los personajes:
// - Arriba a la izquierda, la ficha: retrato con el anillo de ADA, nivel,
//   vida grande, experiencia y las siete reliquias.
// - Arriba en el centro, la ventana de lanzamiento: cuenta atrás, barra de
//   diez minutos con los jefes marcados y el cohete al final; bajas,
//   chatarra y la misión.
// - Arriba a la derecha, el minimapa con brújula, lagos, montañas, ruinas y
//   el contenido del mapa; debajo, la zona.
// - A la derecha, la exposición: cuánto se oye la señal de ADA.
// - Abajo, las herramientas con su nivel; encima, el aviso para hablar
//   («Mantén V») y los subtítulos de quien habla.
// - Viñetas: púrpura si se pisa ácido, roja si queda poca vida.

const root = document.getElementById('ui')!;

function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function compact(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return Math.round(n).toLocaleString('es-ES');
}

// Las herramientas (los mismos nombres y colores que WEAPONS; los iconos, de iconos.ts).
export type Herramienta = 'cortador' | 'pulso' | 'dron' | 'interferencia' | 'lanza' | 'arco' | 'mortero';
const HERRAMIENTAS: Record<Herramienta, { nombre: string; color: string; icono: string }> = {
  cortador: { nombre: 'Cortador', color: '#ffb347', icono: iconoMejora('cortador') },
  pulso: { nombre: 'Pulso', color: '#5ee0ff', icono: iconoMejora('pulso') },
  dron: { nombre: 'Dron', color: '#c9f27a', icono: iconoMejora('dron') },
  interferencia: { nombre: 'Interferencia', color: '#d07bff', icono: iconoMejora('interferencia') },
  lanza: { nombre: 'Lanza solar', color: '#ffe066', icono: iconoMejora('lanza') },
  arco: { nombre: 'Arco', color: '#8ad7ff', icono: iconoMejora('arco') },
  mortero: { nombre: 'Mortero', color: '#ff7a45', icono: iconoMejora('mortero') },
};
const NIVEL_MAX = 6;

const RETRATO = `<svg viewBox="0 0 64 64"><circle cx="32" cy="27" r="20" fill="#e8eeff" stroke="#16111f" stroke-width="3"/><path d="M14 26 a18 18 0 0 1 36 0" fill="none" stroke="#ff8a3d" stroke-width="4"/><rect x="17" y="21" width="30" height="14" rx="7" fill="#1d2b4f" stroke="#16111f" stroke-width="2.5"/><rect x="24" y="24" width="4" height="8" rx="2" fill="#9ff8ff"/><rect x="36" y="24" width="4" height="8" rx="2" fill="#9ff8ff"/><rect x="18" y="45" width="28" height="16" rx="7" fill="#e8eeff" stroke="#16111f" stroke-width="3"/><circle cx="32" cy="53" r="3.5" fill="#5ee0ff"/></svg>`;

// ------------------------------------------------------------------ estado

export interface HudState {
  time: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  scrap: number;
  weapons: [Herramienta, number][];
  /** Balizas vivas triangulando la señal. */
  signal: number;
  /** Pies del astronauta, en pantalla: ahí va la barra pequeña de vida. */
  anchor: { x: number; y: number };
  locked: boolean;
  /** Duración de la partida (RUN.length), para la cuenta atrás. */
  duracion?: number;
  /** Reliquias encontradas (de 7). */
  reliquias?: number;
  /** Exposición de la señal de ADA, de 0 a 1. */
  exposicion?: number;
  /** Profundidad del ácido bajo los pies (World.acidoEn): si es > 0, avisa. */
  acido?: number;
  /** Jefes en la barra de la ventana. */
  jefes?: { minuto: number; nombre: string; vencido?: boolean }[];
  /** Jefe que está combatiendo ahora: alimenta su barra de vida. */
  jefeActivo?: { nombre: string; vida?: number; vidaMax?: number };
  /** Aviso de interacción cerca de algo («Mantén V», «F · Abrir cofre · 20»). */
  interaccion?: { tecla: string; texto: string; coste?: number; bloqueado?: boolean } | null;
  /** Carga del pilón en el que está el jugador (0..1): el anillo junto al reloj. */
  carga?: number | null;
  /** Recarga que le queda a cada herramienta (1 = recién disparada), en el orden de `weapons`. */
  recargas?: number[];
  /** Multiplicador de daño total (bendiciones, potencia de las mejoras y héroe). */
  potencia?: number;
  /** Aguante del sprint (0..1): la barrita bajo la vida, solo si no está lleno. */
  aguante?: number;
  /** Cañón solar: nivel (0 = no lo tienes), recarga (0..1) y si estás apuntando. */
  canon?: { nivel: number; recarga: number; apuntando: boolean; mira: boolean };
  /** Bendiciones que llevas: icono, color de la mejor rareza y cuántas. */
  bendiciones?: { id: string; icono: string; color: string; n: number; titulo: string }[];
  /** Nombre de la zona en la que está el jugador. */
  zona?: string;
}

export interface MinimapState {
  px: number;
  pz: number;
  yaw: number;
  enemies: { count: number; x: Float32Array; z: Float32Array; type: Uint8Array };
  relics: { x: number; z: number }[];
  pad: { x: number; z: number };
  /** La nave de ARES-IX posada junto a la salida (World.nave): se queda en el borde si está lejos. */
  nave?: { x: number; z: number; giro: number };
  /** Lo que hay en el mapa: lagos, montañas, barrios y el contenido. */
  lugares?: { tipo: 'lago' | 'montaña' | 'barrio' | 'altar' | 'ara' | 'caja' | 'torre' | 'refugio' | 'npc' | 'pilon' | 'duelo' | 'dragon'; x: number; z: number; r?: number; hecho?: boolean }[];
  /** Lo que ha marcado la vigía: pulsa en el minimapa. */
  marca?: { x: number; z: number } | null;
  /** Puntos que el jugador ha puesto en el mapa grande (M). */
  puntos?: { x: number; z: number }[];
  /** Metros que abarca el minimapa desde el centro (55 por defecto). */
  alcance?: number;
  /**
   * Carta del terreno vista desde arriba (World.carta()): cubre de −mitad a
   * +mitad en x y z. Sin ella se dibujan lagos, montañas y barrios a mano.
   */
  carta?: { imagen: CanvasImageSource; mitad: number };
}

let hud: HTMLElement | null = null;
let minimap: CanvasRenderingContext2D | null = null;
let ultimas = '';
let ultimasReliquias = -1;
let ultimasBendiciones = '';

export function showHud() {
  hud?.remove();
  hud = h(`
    <div class="hud hud2">
      <div class="h2-vineta acido"></div>
      <div class="h2-vineta herido"></div>

      <div class="h2-ficha h2-panel">
        <div class="h2-retrato">${RETRATO}<span class="h2-nivel"></span></div>
        <div class="h2-datos">
          <div class="h2-nombre"><b>Especialista</b><small>ARES-IX · con ADA</small></div>
          <div class="h2-vida"><div class="h2-vida-relleno"></div><div class="h2-vida-marcas"></div><span class="h2-vida-texto"></span></div>
          <div class="h2-xp"><div class="h2-xp-relleno"></div></div>
          <div class="h2-reliquias"></div>
        </div>
      </div>
      <div class="h2-bendiciones" aria-label="Bendiciones"></div>

      <div class="h2-ventana">
        <div class="h2-reloj-fila">
          <div class="h2-reloj h2-panel"><small>Ventana de lanzamiento</small><b class="h2-tiempo"></b></div>
          <div class="h2-carga" role="progressbar" aria-label="Carga del pilón" aria-valuemin="0" aria-valuemax="100"><b></b></div>
        </div>
        <div class="h2-barra"><div class="h2-barra-relleno"></div><div class="h2-barra-marcas"></div><span class="h2-cohete">🚀</span></div>
        <div class="h2-chips">
          <span class="h2-chip bajas"><b class="h2-bajas"></b> bajas</span>
          <span class="h2-chip chatarra"><b class="h2-chatarra"></b> chatarra</span>
          <span class="h2-chip potencia" title="Potencia: multiplica el daño de todas las herramientas"><b class="h2-potencia"></b> daño</span>
        </div>
        <div class="h2-mision"><b class="h2-mision-nombre">Operación en curso…</b><span class="h2-operador"></span></div>
        <div class="h2-jefe h2-panel">
          <b class="h2-jefe-nombre"></b>
          <div class="h2-jefe-vida"><i></i><span></span></div>
        </div>
      </div>

      <div class="h2-mapa">
        <canvas class="h2-minimapa" width="440" height="440"></canvas>
        <div class="h2-zona h2-panel"></div>
        <div class="h2-tecla-mapa"><kbd>M</kbd> Mapa</div>
      </div>

      <div class="h2-exposicion h2-panel">
        <small>Señal</small>
        <div class="h2-exp-barra"><div class="h2-exp-relleno"></div></div>
        <b class="h2-exp-texto"></b>
      </div>
      <div class="h2-balizas"></div>

      <div class="h2-abajo">
        <div class="h2-subtitulo"><span class="h2-quien"></span><p></p></div>
        <div class="h2-interaccion"><kbd></kbd><span></span><em class="h2-coste"></em></div>
        <div class="h2-pista">Haz clic para girar la cámara con el ratón · <b>Q</b>/<b>E</b> también giran</div>
        <div class="h2-canon"><span class="h2-canon-icono">${iconoMejora('b-critico')}</span><b>Cañón solar</b><small></small><i class="h2-canon-recarga"></i></div>
        <div class="h2-herramientas"></div>
      </div>

      <div class="h2-alerta" role="alert"><i>!</i><b></b></div>
      <div class="h2-mira" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="hud-hp"><div class="hud-hp-fill"></div><span class="hud-hp-text"></span></div>
      <div class="hud-aguante"><i></i></div>
    </div>`);
  root.appendChild(hud);
  minimap = (hud.querySelector('.h2-minimapa') as HTMLCanvasElement).getContext('2d');
  ultimas = '';
  ultimasReliquias = -1;
  ultimasBendiciones = '';
}

export function hideHud() {
  hud?.remove();
  hud = null;
  minimap = null;
}

/** Misión y operador del brief. */
export function setMision(mision: string, operador: string) {
  if (!hud) return;
  (hud.querySelector('.h2-mision-nombre') as HTMLElement).textContent = mision;
  (hud.querySelector('.h2-operador') as HTMLElement).textContent = operador ? `📻 ${operador}` : '';
}

let finSubtitulo = 0;

/**
 * Subtítulo de quien habla (ADA, HELIOS, el operador o un NPC). Texto plano:
 * puede venir de la IA o del jugador.
 */
export function decir(quien: 'ada' | 'helios' | 'operador' | 'npc', nombre: string, texto: string, segundos = 5) {
  if (!hud) return;
  const el = hud.querySelector('.h2-subtitulo') as HTMLElement;
  el.dataset.quien = quien;
  (el.querySelector('.h2-quien') as HTMLElement).textContent = nombre;
  (el.querySelector('p') as HTMLElement).textContent = texto;
  el.classList.add('on');
  const fin = (finSubtitulo = performance.now() + segundos * 1000);
  setTimeout(() => { if (finSubtitulo === fin) el.classList.remove('on'); }, segundos * 1000);
}

let finAlerta = 0;

/**
 * Letrero grande de peligro (un jefe va a atacar): entra de golpe en el
 * centro de la pantalla y se va solo. Texto plano.
 */
export function alerta(texto: string, segundos = 1.8) {
  if (!hud) return;
  const el = hud.querySelector('.h2-alerta') as HTMLElement;
  (el.querySelector('b') as HTMLElement).textContent = texto;
  el.classList.remove('on');
  void el.offsetWidth; // reinicia la animación de entrada
  el.classList.add('on');
  const fin = (finAlerta = performance.now() + segundos * 1000);
  setTimeout(() => { if (finAlerta === fin) el.classList.remove('on'); }, segundos * 1000);
}

let finAcierto = 0;

/** La mira se pone roja un instante al acertar (más fuerte si es punto débil). */
export function marcarAcierto(debil: boolean) {
  if (!hud) return;
  const mira = hud.querySelector('.h2-mira') as HTMLElement;
  mira.classList.remove('acierto', 'debil');
  void mira.offsetWidth;
  mira.classList.add('acierto');
  mira.classList.toggle('debil', debil);
  const fin = (finAcierto = performance.now() + 180);
  setTimeout(() => { if (finAcierto === fin) mira.classList.remove('acierto', 'debil'); }, 180);
}

const NIVELES_EXPOSICION = [[0.25, 'Baja'], [0.55, 'Media'], [0.8, 'Alta'], [1.01, 'Crítica']] as const;

export function updateHud(s: HudState) {
  if (!hud) return;
  const q = (sel: string) => hud!.querySelector(sel) as HTMLElement;
  const duracion = s.duracion ?? 600;

  // Ficha.
  q('.h2-nivel').textContent = `${s.level}`;
  const vida = Math.max(0, s.hp / s.maxHp);
  q('.h2-vida-relleno').style.width = `${vida * 100}%`;
  q('.h2-vida').classList.toggle('baja', vida < 0.3);
  q('.h2-vida-texto').textContent = `${Math.ceil(Math.max(0, s.hp))} / ${Math.round(s.maxHp)}`;
  q('.h2-vida-marcas').style.backgroundSize = `${(20 / s.maxHp) * 100}% 100%`;
  q('.h2-xp-relleno').style.width = `${Math.min(1, s.xp / s.xpNext) * 100}%`;
  const reliquias = s.reliquias ?? 0;
  if (reliquias !== ultimasReliquias) {
    ultimasReliquias = reliquias;
    q('.h2-reliquias').innerHTML = Array.from({ length: 7 }, (_, k) => `<i class="${k < reliquias ? 'si' : ''}"></i>`).join('');
  }

  // Ventana de lanzamiento: lo que falta, y la barra con los jefes.
  q('.h2-tiempo').textContent = `T−${formatTime(duracion - s.time)}`;
  q('.h2-barra-relleno').style.width = `${Math.min(1, s.time / duracion) * 100}%`;
  const marcas = JSON.stringify(s.jefes ?? []);
  const barra = q('.h2-barra-marcas');
  if (barra.dataset.k !== marcas) {
    barra.dataset.k = marcas;
    barra.innerHTML = (s.jefes ?? []).map((j) =>
      `<span class="${j.vencido ? 'vencido' : ''}" style="left:${(j.minuto * 60 / duracion) * 100}%" title="${j.nombre}"><i></i><small>${j.nombre}</small></span>`).join('');
  }
  q('.h2-bajas').textContent = compact(s.kills);
  q('.h2-chatarra').textContent = compact(s.scrap);
  q('.h2-potencia').textContent = `×${(s.potencia ?? 1).toFixed(2)}`;

  // El jefe activo tiene una barra propia; los vencidos siguen marcados en
  // la cronología de lanzamiento.
  const jefe = q('.h2-jefe');
  const activo = s.jefeActivo;
  const vidaJefe = activo?.vida ?? 0;
  const maxJefe = activo?.vidaMax ?? 0;
  jefe.classList.toggle('on', !!activo && maxJefe > 0);
  if (activo && maxJefe > 0) {
    q('.h2-jefe-nombre').textContent = activo.nombre;
    q('.h2-jefe-vida i').style.width = String(Math.max(0, vidaJefe / maxJefe) * 100) + '%';
    q('.h2-jefe-vida span').textContent = Math.ceil(vidaJefe) + ' / ' + Math.round(maxJefe);
  }

  // Zona.
  const zona = q('.h2-zona');
  zona.textContent = s.zona ?? '';
  zona.classList.toggle('on', !!s.zona);

  // Exposición y balizas.
  const e = Math.max(0, Math.min(1, s.exposicion ?? 0));
  const exp = q('.h2-exposicion');
  q('.h2-exp-relleno').style.height = `${e * 100}%`;
  const nivel = NIVELES_EXPOSICION.findIndex(([tope]) => e < tope);
  q('.h2-exp-texto').textContent = NIVELES_EXPOSICION[nivel][1];
  exp.dataset.nivel = String(nivel);
  const balizas = q('.h2-balizas');
  balizas.textContent = s.signal > 0 ? `⚠ ${s.signal} baliza${s.signal > 1 ? 's' : ''} triangulando la señal de ADA` : '';
  balizas.classList.toggle('on', s.signal > 0);

  // Viñetas.
  q('.h2-vineta.acido').classList.toggle('on', (s.acido ?? 0) > 0);
  q('.h2-vineta.herido').classList.toggle('on', vida < 0.3);

  // Aviso de interacción (con precio si lo tiene).
  const inter = q('.h2-interaccion');
  inter.classList.toggle('on', !!s.interaccion);
  if (s.interaccion) {
    (inter.querySelector('kbd') as HTMLElement).textContent = s.interaccion.tecla;
    (inter.querySelector('span') as HTMLElement).textContent = s.interaccion.texto;
    const coste = inter.querySelector('.h2-coste') as HTMLElement;
    const conCoste = s.interaccion.coste !== undefined;
    coste.style.display = conCoste ? '' : 'none';
    if (conCoste && coste.dataset.v !== String(s.interaccion.coste)) {
      coste.dataset.v = String(s.interaccion.coste);
      coste.innerHTML = `${iconoMenu('chatarra')}<b></b>`;
      (coste.querySelector('b') as HTMLElement).textContent = String(s.interaccion.coste);
    }
    inter.classList.toggle('bloqueado', !!s.interaccion.bloqueado);
  }

  // Cañón solar: la mira en el centro y su ficha encima de las herramientas.
  const canon = s.canon;
  const mira = q('.h2-mira');
  mira.classList.toggle('on', !!canon && canon.nivel > 0 && canon.mira);
  mira.classList.toggle('apuntando', !!canon?.apuntando);
  const fichaCanon = q('.h2-canon');
  fichaCanon.classList.toggle('on', !!canon && canon.nivel > 0);
  if (canon && canon.nivel > 0) {
    (fichaCanon.querySelector('small') as HTMLElement).textContent = `Nv. ${canon.nivel} · clic derecho apunta, izquierdo dispara`;
    (fichaCanon.querySelector('.h2-canon-recarga') as HTMLElement).style.setProperty('--cd', canon.recarga.toFixed(3));
  }

  // Carga del pilón: anillo con porcentaje junto al reloj.
  const carga = q('.h2-carga');
  const cargando = s.carga !== null && s.carga !== undefined;
  carga.classList.toggle('on', cargando);
  if (cargando) {
    const pct = Math.floor(Math.min(1, s.carga!) * 100);
    carga.style.setProperty('--p', String(pct));
    carga.setAttribute('aria-valuenow', String(pct));
    (carga.querySelector('b') as HTMLElement).textContent = `${pct}%`;
  }

  // Bendiciones: una ficha por tipo, con el color de la mejor rareza.
  const claveB = JSON.stringify(s.bendiciones ?? []);
  if (claveB !== ultimasBendiciones) {
    ultimasBendiciones = claveB;
    q('.h2-bendiciones').innerHTML = (s.bendiciones ?? []).map((b) =>
      `<span class="h2-bendicion" style="--c:${b.color}" title="${b.titulo}">${iconoMejora(b.icono)}${b.n > 1 ? `<small>×${b.n}</small>` : ''}</span>`).join('');
  }
  q('.h2-pista').classList.toggle('on', !s.locked && s.time < 30);

  // Barra pequeña de vida bajo los pies.
  q('.hud-hp').style.transform = `translate(${s.anchor.x}px, ${s.anchor.y + 10}px) translateX(-50%)`;
  q('.hud-hp-fill').style.width = `${vida * 100}%`;
  q('.hud-hp-text').textContent = `${Math.ceil(Math.max(0, s.hp))}`;
  const aguante = q('.hud-aguante');
  const a = s.aguante ?? 1;
  aguante.classList.toggle('on', a < 0.999);
  aguante.classList.toggle('bajo', a < 0.3);
  aguante.style.transform = `translate(${s.anchor.x}px, ${s.anchor.y + 27}px) translateX(-50%)`;
  (aguante.firstElementChild as HTMLElement).style.width = `${a * 100}%`;

  // Herramientas: casillas con el nivel en pastillas.
  const clave = JSON.stringify(s.weapons);
  if (clave !== ultimas) {
    ultimas = clave;
    q('.h2-herramientas').innerHTML = s.weapons.map(([id, nivel]) => {
      const hta = HERRAMIENTAS[id];
      const pips = Array.from({ length: NIVEL_MAX }, (_, k) => `<i class="${k < nivel ? 'si' : ''}"></i>`).join('');
      return `<div class="h2-casilla" style="--c:${hta.color}"><i class="h2-recarga"></i>${hta.icono}<small>${hta.nombre}</small><div class="h2-pips">${pips}</div></div>`;
    }).join('') + '<div class="h2-casilla vacia"></div>'.repeat(Math.max(0, 4 - s.weapons.length));
  }
  // La recarga baja como una cortina oscura sobre cada casilla.
  if (s.recargas) {
    const cortinas = hud.querySelectorAll<HTMLElement>('.h2-recarga');
    s.recargas.forEach((r, k) => cortinas[k]?.style.setProperty('--cd', r.toFixed(3)));
  }
}

// ---------------------------------------------------------------- minimapa

const COLORES = ['#ff5a4a', '#ffd23a', '#ff9a3c', '#a8e04a', '#b07bff', '#e0c8a8', '#7fe08a'];
const RADIOS = [2.4, 3.4, 5.6, 2.8, 2.6, 4.4, 3];

/**
 * Minimapa circular que gira con la cámara (arriba es hacia donde se mira),
 * con brújula, el terreno (lagos, montañas, barrios), el contenido del mapa,
 * los enemigos y el cohete.
 */
export function drawMinimap(s: MinimapState) {
  const ctx = minimap;
  if (!ctx) return;
  const size = 440, c = size / 2, alcance = s.alcance ?? 55, escala = (c - 22) / alcance;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c - 12, 0, Math.PI * 2);
  ctx.fillStyle = '#5a3a3c';
  ctx.fill();
  ctx.clip();
  ctx.translate(c, c);
  ctx.rotate(s.yaw);
  const enMapa = (x: number, z: number) => [(x - s.px) * escala, (z - s.pz) * escala] as const;

  // Terreno: la carta si la hay; si no, barrios, montañas y lagos.
  if (s.carta) {
    const [x0, z0] = enMapa(-s.carta.mitad, -s.carta.mitad);
    const lado = s.carta.mitad * 2 * escala;
    ctx.drawImage(s.carta.imagen, x0, z0, lado, lado);
  }
  for (const l of s.carta ? [] : s.lugares ?? []) {
    const [mx, mz] = enMapa(l.x, l.z);
    const r = (l.r ?? 4) * escala;
    if (l.tipo === 'lago') {
      ctx.fillStyle = '#7a2cc8';
      ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d6a8ff'; ctx.lineWidth = 3; ctx.stroke();
    } else if (l.tipo === 'montaña') {
      ctx.fillStyle = '#3e2c46';
      ctx.beginPath(); ctx.arc(mx, mz, r * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6e0ee';
      ctx.beginPath(); ctx.arc(mx, mz, r * 0.22, 0, Math.PI * 2); ctx.fill();
    } else if (l.tipo === 'barrio') {
      ctx.fillStyle = 'rgba(160, 150, 160, 0.45)';
      ctx.fillRect(mx - r, mz - r * 0.8, r * 2, r * 1.6);
    }
  }
  ctx.strokeStyle = 'rgba(20, 12, 28, 0.3)';
  ctx.lineWidth = 2;
  for (const r of [20, 40]) { ctx.beginPath(); ctx.arc(0, 0, r * escala, 0, Math.PI * 2); ctx.stroke(); }

  // Enemigos.
  for (let i = 0; i < s.enemies.count; i++) {
    const [mx, mz] = enMapa(s.enemies.x[i], s.enemies.z[i]);
    if (mx * mx + mz * mz > (c - 14) ** 2) continue;
    const t = s.enemies.type[i];
    ctx.fillStyle = COLORES[t] ?? '#ff5a4a';
    ctx.strokeStyle = '#16111f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, mz, (RADIOS[t] ?? 2.4) * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Contenido: altares, aras, cajas, torres, refugio y NPC (en el borde si quedan lejos).
  const alBorde = (mx: number, mz: number) => {
    const d = Math.hypot(mx, mz), max = c - 30;
    return d > max ? [mx * max / d, mz * max / d] as const : [mx, mz] as const;
  };
  for (const p of s.puntos ?? []) {
    const [mx, mz] = alBorde(...enMapa(p.x, p.z));
    ctx.save(); ctx.translate(mx, mz); ctx.rotate(-s.yaw);
    puntoJugador(ctx);
    ctx.restore();
  }
  for (const l of s.lugares ?? []) {
    if (l.tipo === 'lago' || l.tipo === 'montaña' || l.tipo === 'barrio') continue;
    const fijo = l.tipo === 'altar' || l.tipo === 'refugio' || l.tipo === 'dragon';
    let [mx, mz] = enMapa(l.x, l.z);
    if (fijo) [mx, mz] = alBorde(mx, mz);
    else if (mx * mx + mz * mz > (c - 20) ** 2) continue;
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(-s.yaw);
    icono(ctx, l.tipo, !!l.hecho);
    ctx.restore();
  }
  for (const r of s.relics) {
    const [mx, mz] = enMapa(r.x, r.z);
    ctx.fillStyle = '#ffe9a8'; ctx.strokeStyle = '#16111f'; ctx.lineWidth = 2;
    ctx.fillRect(mx - 6, mz - 6, 12, 12); ctx.strokeRect(mx - 6, mz - 6, 12, 12);
  }
  if (s.marca) {
    const [mx, mz] = alBorde(...enMapa(s.marca.x, s.marca.z));
    const pulso = 10 + (performance.now() / 120) % 12;
    ctx.strokeStyle = '#5ee0ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mx, mz, pulso, 0, Math.PI * 2); ctx.stroke();
  }
  // La nave, vista desde arriba (casco blanco, alas y morro naranjas), también en el borde.
  if (s.nave) {
    const [nx, nz] = alBorde(...enMapa(s.nave.x, s.nave.z));
    ctx.save(); ctx.translate(nx, nz); ctx.rotate(-s.nave.giro);
    ctx.strokeStyle = '#16111f'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(12, -4); ctx.lineTo(10, 3); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#efe8de';
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1d2b4f';
    ctx.beginPath(); ctx.ellipse(0, 9, 3.4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // El cohete, pegado al borde si queda fuera.
  {
    const [rx, rz] = alBorde(...enMapa(s.pad.x, s.pad.z));
    ctx.save(); ctx.translate(rx, rz); ctx.rotate(-s.yaw);
    ctx.fillStyle = '#efe8de'; ctx.strokeStyle = '#16111f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(7, 9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // El jugador en el centro.
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#16111f'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c, c - 15); ctx.lineTo(c + 11, c + 11); ctx.lineTo(c, c + 5); ctx.lineTo(c - 11, c + 11); ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Aro y brújula: la N gira con la cámara.
  ctx.lineWidth = 10; ctx.strokeStyle = '#16111f';
  ctx.beginPath(); ctx.arc(c, c, c - 12, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = '#ff8a3d';
  ctx.beginPath(); ctx.arc(c, c, c - 12, 0, Math.PI * 2); ctx.stroke();
  const nx = c + Math.sin(-s.yaw + Math.PI) * (c - 12), nz = c + Math.cos(-s.yaw + Math.PI) * (c - 12);
  ctx.fillStyle = '#16111f'; ctx.beginPath(); ctx.arc(nx, nz, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd25a'; ctx.font = '900 20px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', nx, nz + 1);
}

/** Banderín de un punto que ha puesto el jugador en el mapa grande. */
export function puntoJugador(ctx: CanvasRenderingContext2D, escala = 1) {
  ctx.save();
  ctx.scale(escala, escala);
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#16111f'; ctx.lineJoin = 'round';
  ctx.fillStyle = '#7fffd0';
  ctx.beginPath(); ctx.moveTo(-1.5, 12); ctx.lineTo(-1.5, -12); ctx.lineTo(11, -7); ctx.lineTo(-1.5, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function icono(ctx: CanvasRenderingContext2D, tipo: string, hecho: boolean) {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#16111f';
  if (tipo === 'altar') {
    ctx.fillStyle = hecho ? '#ffd25a' : '#ff4a3a';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(9, 0); ctx.lineTo(0, 11); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (tipo === 'ara') {
    ctx.fillStyle = hecho ? '#8a7558' : '#ffb347';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!hecho) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ctx.fillRect(Math.cos(a) * 10 - 1.5, Math.sin(a) * 10 - 1.5, 3, 3); }
  } else if (tipo === 'caja') {
    ctx.fillStyle = hecho ? '#6a6070' : '#c77dff';
    ctx.fillRect(-6, -5, 12, 10); ctx.strokeRect(-6, -5, 12, 10);
  } else if (tipo === 'torre') {
    ctx.fillStyle = hecho ? '#6a6070' : '#c0473c';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (tipo === 'refugio') {
    ctx.fillStyle = '#4fd38a';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(10, -2); ctx.lineTo(10, 9); ctx.lineTo(-10, 9); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (tipo === 'npc') {
    ctx.fillStyle = '#7fffd0';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (tipo === 'duelo') {
    // Dos espadas cruzadas sobre un rombo rojo.
    ctx.fillStyle = hecho ? '#6a6070' : '#ff6a3d';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(11, 0); ctx.lineTo(0, 11); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff4d6'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke();
  } else if (tipo === 'dragon') {
    // Silueta de alas abiertas.
    ctx.fillStyle = '#5ee0ff';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(14, -2); ctx.lineTo(4, 2); ctx.lineTo(0, 10); ctx.lineTo(-4, 2); ctx.lineTo(-14, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (tipo === 'pilon') {
    // Cristal del pilón: rombo alto, dorado si aún carga y gris si está gastado.
    ctx.fillStyle = hecho ? '#6a6478' : '#ffe066';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(7, 0); ctx.lineTo(0, 12); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!hecho) { ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -6, 3, 6); }
  }
}
