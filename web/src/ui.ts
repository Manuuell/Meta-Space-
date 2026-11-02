import { ENEMIES, EnemyId, GEAR, GearId, PASSIVES, PassiveId, RELICS, RelicDef, WEAPONS, WeaponId } from './data';
import { NUEVO_ENEMY_ICON } from './enemies-nuevos';
import { mostrarMejoras, type Tarjeta } from './mejoras.ts';
import { SPECIALS, type SpecialId } from './creator/stats';
import { describirEspecial, ESPECIALES_HEROE } from './progression';

// Interfaz en HTML sobre el canvas. Nada de framework: unas pocas pantallas
// que se reconstruyen enteras cuando cambian.

const root = document.getElementById('ui')!;

function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function formatTime(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function compact(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return Math.round(n).toLocaleString('es-ES');
}

// Iconos sencillos en SVG para cada unidad de HELIOS.
const ENEMY_ICON: Record<EnemyId, string> = {
  recolector: `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="19" rx="15" ry="4" fill="none" stroke="#8a8284" stroke-width="2.5"/><polygon points="20,8 29,19 20,30 11,19" fill="#4a4446" stroke="#1b1214" stroke-width="1.5"/><circle cx="20" cy="20" r="3.2" fill="#ff3b1f"/><path d="M15 27 l-2 7 M25 27 l2 7" stroke="#4a4446" stroke-width="2.5"/></svg>`,
  baliza: `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="7" rx="9" ry="2.5" fill="#6b6a5a"/><line x1="20" y1="8" x2="20" y2="15" stroke="#6b6a5a" stroke-width="2"/><polygon points="20,13 28,24 20,36 12,24" fill="#6b6a5a" stroke="#1b1214" stroke-width="1.5"/><circle cx="20" cy="7" r="2.6" fill="#ffd23a"/></svg>`,
  segador: `<svg viewBox="0 0 40 40"><rect x="8" y="12" width="22" height="17" rx="2" fill="#7a4a2a" stroke="#1b1214" stroke-width="1.5"/><rect x="12" y="6" width="13" height="8" fill="#7a4a2a" stroke="#1b1214" stroke-width="1.5"/><rect x="4" y="29" width="32" height="6" rx="3" fill="#5a3a22" stroke="#1b1214" stroke-width="1.5"/><circle cx="30" cy="20" r="2.8" fill="#ff3b1f"/></svg>`,
  ...NUEVO_ENEMY_ICON,
};

const ASTRONAUT_ICON = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="1" width="8" height="1" fill="#1b1214"/><rect x="3" y="2" width="10" height="6" fill="#ece6dc"/><rect x="4" y="3" width="8" height="4" fill="#ff9a3c"/><rect x="9" y="4" width="2" height="2" fill="#ffd9a8"/><rect x="2" y="8" width="12" height="7" fill="#ece6dc"/><rect x="6" y="9" width="4" height="1" fill="#e8632b"/><rect x="12" y="9" width="2" height="3" fill="#5ee0ff"/></svg>`;

// ------------------------------------------------------------------ HUD

// ui.ts sigue siendo la fachada pública del juego; el HUD nuevo vive aislado
// para que sus estilos y su estado opcional no afecten a las demás pantallas.
export {
  decir,
  drawMinimap,
  hideHud,
  setMision,
  showHud,
  updateHud,
} from './hud.ts';
export type { HudState, MinimapState } from './hud.ts';

// ---------------------------------------------------------- Avisos

// Los avisos se apilan en su propia columna: varios a la vez no se pisan.
let toasts: HTMLElement | null = null;

let alAvisar: ((title: string) => void) | null = null;

/** Quien quiera saber que alguien habla (la forma de ADA anima su voz). */
export function onToast(fn: (title: string) => void) {
  alAvisar = fn;
}

export function toast(title: string, body: string, kind: 'relic' | 'info' = 'info', seconds = 6) {
  alAvisar?.(title);
  if (!toasts || !toasts.isConnected) {
    toasts = h(`<div class="toasts"></div>`);
    root.appendChild(toasts);
  }
  // Como mucho tres: el más viejo se va.
  while (toasts.children.length >= 3) toasts.firstElementChild!.remove();
  // Texto plano: los avisos pueden traer líneas de la IA o nombres del jugador.
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  const b = document.createElement('b');
  b.textContent = title;
  const p = document.createElement('p');
  p.textContent = body;
  el.append(b, p);
  toasts.appendChild(el);
  setTimeout(() => el.classList.add('out'), seconds * 1000);
  setTimeout(() => el.remove(), seconds * 1000 + 600);
}

// --------------------------------------------------- Subida de nivel

export type Choice =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number }
  | { kind: 'special'; id: SpecialId; level: number }
  | { kind: 'gear'; id: GearId; level: number }
  | { kind: 'heal' };

export function showLevelUp(level: number, choices: Choice[], pick: (c: Choice) => void) {
  mostrarMejoras(level, choices.map(tarjetaDe), (i) => {
    const elegida = choices[i];
    if (elegida) pick(elegida);
  }, { root });
}

function tarjetaDe(c: Choice): Tarjeta {
  if (c.kind === 'weapon') {
    const w = WEAPONS[c.id];
    return {
      id: c.id, tipo: 'herramienta', titulo: w.name,
      texto: c.level === 1 ? w.blurb : describeWeaponStep(c.id, c.level),
      color: w.color, nivel: c.level, nivelMax: w.levels.length,
    };
  }
  if (c.kind === 'passive') {
    const p = PASSIVES[c.id];
    return {
      id: c.id, tipo: 'pasiva', titulo: p.name, texto: p.blurb,
      color: '#9fb4ff', nivel: c.level, nivelMax: p.max,
    };
  }
  if (c.kind === 'gear') {
    const g = GEAR[c.id];
    return {
      id: c.id, tipo: 'equipo', titulo: g.name,
      texto: c.level === 1 ? g.blurb : (g.levels[c.level - 1]?.mejora ?? g.blurb),
      color: g.color, nivel: c.level, nivelMax: g.levels.length, control: g.control,
    };
  }
  if (c.kind === 'special') {
    const special = SPECIALS[c.id];
    return {
      id: c.id, tipo: 'especial', titulo: special.name,
      texto: describirEspecial(c.id, c.level), color: '#56e5ee',
      nivel: c.level, nivelMax: ESPECIALES_HEROE[c.id].max,
    };
  }
  return {
    id: 'parche', tipo: 'reparar', titulo: 'Parche de emergencia',
    texto: 'Restaura 40 de integridad del traje.', color: '#7ef0a0',
  };
}

function describeWeaponStep(id: WeaponId, level: number) {
  const a = WEAPONS[id].levels[level - 2];
  const b = WEAPONS[id].levels[level - 1];
  if (b.mejora) return b.mejora;
  const parts: string[] = [];
  if (b.damage !== a.damage) parts.push(`daño ${a.damage} → ${b.damage}`);
  if (b.count !== a.count) parts.push(`${id === 'dron' ? 'drones' : 'disparos'} ${a.count} → ${b.count}`);
  if (b.area !== a.area) parts.push(`alcance ${a.area} → ${b.area} m`);
  if (b.cooldown !== a.cooldown) parts.push(`recarga ${a.cooldown} → ${b.cooldown} s`);
  return parts.join(' · ');
}

// ------------------------------------------------------------ Título

export function showTitle(save: { runs: number; bestTime: number; relics: string[]; scrapBank: number }, start: () => void) {
  const el = h(`
    <div class="overlay title">
      <div class="title-box">
        <div class="eyebrow">ARES-IX · Planeta Meta</div>
        <h1>Meta Space</h1>
        <p class="lead">Meta se congela bajo el velo rojo de HELIOS. Llevas a ADA, la única que puede firmar
        su apagado, y HELIOS quiere recuperarla. Aguanta <b>10 minutos</b> hasta la ventana de lanzamiento.</p>
        <div class="title-stats">
          <div><b>${save.runs}</b><small>partidas</small></div>
          <div><b>${formatTime(save.bestTime)}</b><small>mejor tiempo</small></div>
          <div><b>${save.relics.length}/${RELICS.length}</b><small>reliquias</small></div>
          <div><b>${compact(save.scrapBank)}</b><small>chatarra en el banco</small></div>
        </div>
        <button class="btn go">Despegar</button>
        <p class="keys"><b>WASD</b> para moverte · <b>ratón</b> para girar la cámara · las herramientas se usan solas · <b>Esc</b> pausa</p>
      </div>
    </div>`);
  const go = () => {
    window.removeEventListener('keydown', onKey);
    el.remove();
    start();
  };
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space') go(); };
  el.querySelector('.go')!.addEventListener('click', go);
  window.addEventListener('keydown', onKey);
  root.appendChild(el);
}

export function showPause(resume: () => void, quit: () => void) {
  const el = h(`
    <div class="overlay pause">
      <div class="levelup-box">
        <h2>Pausa</h2>
        <div class="row"><button class="btn menu">Abandonar</button><button class="btn go">Seguir</button></div>
      </div>
    </div>`);
  const close = (fn: () => void) => { window.removeEventListener('keydown', onKey); el.remove(); fn(); };
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Enter') close(resume); };
  el.querySelector('.go')!.addEventListener('click', () => close(resume));
  el.querySelector('.menu')!.addEventListener('click', () => close(quit));
  // Esperar un tic: la misma pulsación de Esc que abrió la pausa no debe cerrarla.
  setTimeout(() => window.addEventListener('keydown', onKey), 0);
  root.appendChild(el);
}

// --------------------------------------------------------- Resultados

export interface Results {
  victory: boolean;
  time: number;
  level: number;
  kills: number;
  killsByType: Record<EnemyId, number>;
  newTypes: EnemyId[];
  damage: Record<WeaponId, number>;
  scrap: number;
  score: number;
  relics: RelicDef[];         // encontradas en esta partida
  newRecord: boolean;
  best: { time: number; kills: number; score: number };
  bank: number;
  codexSize: number;
  hpLost: number;
  weapons: [WeaponId, number][];
}

export function showResults(r: Results, again: () => void, menu: () => void) {
  const totalDamage = Object.values(r.damage).reduce((a, b) => a + b, 0) || 1;
  const damageRows = (Object.entries(r.damage) as [WeaponId, number][])
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, d]) => {
      const pct = Math.round((d / totalDamage) * 100);
      const lvl = r.weapons.find(([w]) => w === id)?.[1] ?? 0;
      return `<div class="dmg-row">
        <span class="dot" style="background:${WEAPONS[id].color}"></span>
        <div class="dmg-main">
          <div class="dmg-head"><b>${WEAPONS[id].name}</b><small>Nv. ${lvl}</small></div>
          <div class="bar"><i style="width:${pct}%;background:${WEAPONS[id].color}"></i></div>
          <small>${compact(d)} de daño · ${pct} %</small>
        </div>
      </div>`;
    }).join('');

  const killTiles = (Object.keys(ENEMIES) as EnemyId[]).map((id) => {
    const n = r.killsByType[id] ?? 0;
    const isNew = r.newTypes.includes(id);
    return `<div class="kill-tile ${n ? '' : 'dim'}">
      ${isNew ? '<span class="badge">NUEVO</span>' : ''}
      ${ENEMY_ICON[id]}
      <b>×${compact(n)}</b>
      <small>${ENEMIES[id].name}</small>
    </div>`;
  }).join('');

  const relicCards = r.relics.length
    ? r.relics.map((rel) => `<div class="relic">
        <span class="badge">NUEVO</span>
        <b>${rel.name}</b>
        <em>“${rel.lore}”</em>
        <p>${rel.fact}</p>
        ${rel.unlocks ? `<small>Desbloquea en el banco: <b>${rel.unlocks}</b></small>` : '<small>No desbloquea nada.</small>'}
      </div>`).join('')
    : `<p class="muted">Ninguna esta vez. Los Segadores las llevan dentro: aparecen a partir del minuto 2.</p>`;

  const el = h(`
    <div class="overlay results">
      <div class="results-box">
        <header class="banner ${r.victory ? 'win' : 'lose'}">
          <div class="avatar">${ASTRONAUT_ICON}<span>Nv. ${r.level}</span></div>
          <div class="banner-text">
            <small>SECTOR DELTA · ZONA 1 · NORMAL</small>
            <h1>${r.victory ? '¡Velo abierto!' : '¡Señal perdida!'}</h1>
            <p>${r.victory
              ? 'El cohete ha subido la orden de apagado: el sol vuelve al Sector Delta.'
              : 'Los Recolectores han alcanzado a ADA. El velo sigue cerrado.'}</p>
            ${r.codexSize >= RELICS.length
              ? '<p><b>Auditoría completa:</b> HELIOS recibe la orden de apagado y Meta vuelve a ver el sol.</p>'
              : `<p>Auditoría de HELIOS: <b>${r.codexSize}/${RELICS.length}</b> pruebas para apagar el velo de todo Meta.</p>`}
          </div>
          <div class="tiles">
            <div><b>${formatTime(r.time)}</b><small>TIEMPO</small></div>
            <div><b>${compact(r.kills)}</b><small>BAJAS</small></div>
            <div><b>${compact(totalDamage)}</b><small>DAÑO</small></div>
            <div><b>${compact(r.score)}</b><small>PUNTOS</small></div>
          </div>
        </header>

        <div class="cols">
          <section class="panel orange">
            <h3>Registro <small>Sector Delta</small></h3>
            <div class="record ${r.newRecord ? 'new' : ''}">
              <small>${r.newRecord ? '¡NUEVO RÉCORD EN ESTE SECTOR!' : 'MEJOR MARCA'}</small>
              <b>${compact(r.newRecord ? r.score : r.best.score)}</b>
              <span>${r.newRecord ? 'puntos' : `tú: ${compact(r.score)} puntos`}</span>
            </div>
            <div class="kv"><span>Mejor tiempo</span><b>${formatTime(r.best.time)}</b></div>
            <div class="kv"><span>Más bajas</span><b>${compact(r.best.kills)}</b></div>
            <div class="note">
              <b>+${compact(r.scrap)} de chatarra</b> al banco de trabajo.
              Llevas <b>${compact(r.bank)}</b> para la misión de rescate.
            </div>
          </section>

          <section class="panel green">
            <h3>Tu partida</h3>
            <div class="mini">
              <div><b>${r.level}</b><small>NIVEL</small></div>
              <div><b>${compact(r.scrap)}</b><small>CHATARRA</small></div>
              <div><b>${r.relics.length}</b><small>RELIQUIAS</small></div>
              <div><b>${Math.round(r.hpLost)}</b><small>DAÑO RECIBIDO</small></div>
            </div>
            <h4>Daño por herramienta</h4>
            ${damageRows || '<p class="muted">Ni un arañazo.</p>'}
          </section>

          <section class="panel blue">
            <h3>Códice <small>${r.codexSize}/${RELICS.length} reliquias</small></h3>
            <h4>Bajas por unidad de HELIOS</h4>
            <div class="kill-tiles">${killTiles}</div>
            <h4>Reliquias recuperadas</h4>
            ${relicCards}
          </section>
        </div>

        <footer>
          <span class="keys"><b>Intro</b> otra vez · <b>Esc</b> menú</span>
          <div class="row"><button class="btn menu">Menú</button><button class="btn go">Otra vez</button></div>
        </footer>
      </div>
    </div>`);

  const close = (fn: () => void) => { window.removeEventListener('keydown', onKey); el.remove(); fn(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Enter') close(again);
    else if (e.code === 'Escape') close(menu);
  };
  el.querySelector('.go')!.addEventListener('click', () => close(again));
  el.querySelector('.menu')!.addEventListener('click', () => close(menu));
  setTimeout(() => window.addEventListener('keydown', onKey), 300);
  root.appendChild(el);
}
