import { ENEMIES, EnemyId, PASSIVES, PassiveId, RELICS, RelicDef, WEAPONS, WeaponId } from './data';

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
};

const ASTRONAUT_ICON = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="1" width="8" height="1" fill="#1b1214"/><rect x="3" y="2" width="10" height="6" fill="#ece6dc"/><rect x="4" y="3" width="8" height="4" fill="#ff9a3c"/><rect x="9" y="4" width="2" height="2" fill="#ffd9a8"/><rect x="2" y="8" width="12" height="7" fill="#ece6dc"/><rect x="6" y="9" width="4" height="1" fill="#e8632b"/><rect x="12" y="9" width="2" height="3" fill="#5ee0ff"/></svg>`;

// ------------------------------------------------------------------ HUD

export interface HudState {
  time: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  scrap: number;
  weapons: [WeaponId, number][];
  signal: number; // balizas vivas
  anchor: { x: number; y: number }; // pies del astronauta, en pantalla
  locked: boolean;
}

let hud: HTMLElement | null = null;
let minimap: CanvasRenderingContext2D | null = null;

export function showHud() {
  hud?.remove();
  hud = h(`
    <div class="hud">
      <div class="hud-portrait">
        <div class="avatar small">${ASTRONAUT_ICON}<span class="hud-level"></span></div>
        <div class="hud-name">
          <b>Especialista</b><small>ARES-IX · con ADA</small>
          <div class="hud-xp"><div class="hud-xp-fill"></div></div>
        </div>
      </div>

      <div class="hud-center">
        <div class="hud-zone"><b>Sector Delta</b><small>Zona 1 · <i>NORMAL</i></small></div>
        <div class="hud-time"></div>
        <div class="hud-chips">
          <span class="chip kills"><b class="hud-kills"></b> bajas</span>
          <span class="chip scrap"><b class="hud-scrap"></b> chatarra</span>
        </div>
      </div>

      <canvas class="hud-minimap" width="200" height="200"></canvas>
      <div class="hud-signal"></div>
      <div class="hud-hint">Haz clic para girar la cámara con el ratón · <b>Q</b>/<b>E</b> también giran</div>

      <div class="hud-hp"><div class="hud-hp-fill"></div><span class="hud-hp-text"></span></div>
      <div class="hud-weapons"></div>
    </div>`);
  root.appendChild(hud);
  minimap = (hud.querySelector('.hud-minimap') as HTMLCanvasElement).getContext('2d');
  lastWeapons = '';
}

export function hideHud() {
  hud?.remove();
  hud = null;
  minimap = null;
}

let lastWeapons = '';

export function updateHud(s: HudState) {
  if (!hud) return;
  const q = (sel: string) => hud!.querySelector(sel) as HTMLElement;
  q('.hud-xp-fill').style.width = `${(s.xp / s.xpNext) * 100}%`;
  q('.hud-level').textContent = `Nv ${s.level}`;
  q('.hud-time').textContent = formatTime(s.time);
  q('.hud-kills').textContent = compact(s.kills);
  q('.hud-scrap').textContent = compact(s.scrap);

  const bar = q('.hud-hp');
  bar.style.transform = `translate(${s.anchor.x}px, ${s.anchor.y + 10}px) translateX(-50%)`;
  q('.hud-hp-fill').style.width = `${Math.max(0, s.hp / s.maxHp) * 100}%`;
  q('.hud-hp-text').textContent = `${Math.ceil(Math.max(0, s.hp))}`;

  q('.hud-hint').classList.toggle('on', !s.locked && s.time < 30);

  const signal = q('.hud-signal');
  signal.textContent = s.signal > 0 ? `⚠ ${s.signal} baliza${s.signal > 1 ? 's' : ''} triangulando la señal de ADA` : '';
  signal.classList.toggle('on', s.signal > 0);

  const key = JSON.stringify(s.weapons);
  if (key !== lastWeapons) {
    lastWeapons = key;
    q('.hud-weapons').innerHTML = s.weapons
      .map(([id, lvl]) => `<div class="slot" style="--c:${WEAPONS[id].color}" title="${WEAPONS[id].name}">
          <small>${WEAPONS[id].name.split(' ')[0]}</small>${WEAPON_ICON[id]}<b>${lvl}</b></div>`)
      .join('') + '<div class="slot empty"></div>'.repeat(Math.max(0, 4 - s.weapons.length));
  }
}

// Iconos de las herramientas para las casillas del HUD.
const WEAPON_ICON: Record<WeaponId, string> = {
  cortador: `<svg viewBox="0 0 24 24"><path d="M4 20 L14 10" stroke="#fff3" stroke-width="5" stroke-linecap="round"/><path d="M4 20 L14 10" stroke="#ffb347" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="7" r="4" fill="#ffe2a8"/></svg>`,
  pulso: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#5ee0ff" stroke-width="2.5"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#b8f4ff" stroke-width="2"/><circle cx="12" cy="12" r="1.8" fill="#fff"/></svg>`,
  dron: `<svg viewBox="0 0 24 24"><rect x="8" y="10" width="8" height="5" rx="1" fill="#d8d2c4"/><ellipse cx="12" cy="8" rx="8" ry="2" fill="none" stroke="#c9f27a" stroke-width="2"/><circle cx="12" cy="12.5" r="1.4" fill="#c9f27a"/></svg>`,
  interferencia: `<svg viewBox="0 0 24 24"><path d="M3 12 q3-6 6 0 t6 0 t6 0" fill="none" stroke="#d07bff" stroke-width="2.5"/><path d="M3 17 q3-4 6 0 t6 0 t6 0" fill="none" stroke="#d07bff88" stroke-width="2"/></svg>`,
};

export interface MinimapState {
  px: number;
  pz: number;
  yaw: number;
  enemies: { count: number; x: Float32Array; z: Float32Array; type: Uint8Array };
  relics: { x: number; z: number }[];
  pad: { x: number; z: number };
}

/**
 * Minimapa circular que gira con la cámara: arriba es siempre hacia donde se
 * mira. Recolectores en rojo, balizas en amarillo, Segadores grandes.
 */
export function drawMinimap(s: MinimapState) {
  const ctx = minimap;
  if (!ctx) return;
  const size = 200, c = size / 2, range = 45, scale = (c - 10) / range;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30, 20, 34, 0.82)';
  ctx.fill();
  ctx.clip();

  ctx.translate(c, c);
  ctx.rotate(s.yaw);
  const toMap = (x: number, z: number) => [(x - s.px) * scale, (z - s.pz) * scale] as const;

  // Anillos de distancia.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (const r of [15, 30]) { ctx.beginPath(); ctx.arc(0, 0, r * scale, 0, Math.PI * 2); ctx.stroke(); }

  const colors = ['#ff5a4a', '#ffd23a', '#ff9a3c'];
  const radii = [2.2, 3.2, 5.5];
  for (let i = 0; i < s.enemies.count; i++) {
    const [mx, mz] = toMap(s.enemies.x[i], s.enemies.z[i]);
    if (mx * mx + mz * mz > (c - 6) ** 2) continue;
    const t = s.enemies.type[i];
    ctx.fillStyle = colors[t];
    ctx.beginPath();
    ctx.arc(mx, mz, radii[t], 0, Math.PI * 2);
    ctx.fill();
  }

  for (const r of s.relics) {
    const [mx, mz] = toMap(r.x, r.z);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(mx - 4, mz - 4, 8, 8);
  }

  // El cohete, pegado al borde si queda fuera.
  let [rx, rz] = toMap(s.pad.x, s.pad.z);
  const rd = Math.hypot(rx, rz), maxR = c - 14;
  if (rd > maxR) { rx *= maxR / rd; rz *= maxR / rd; }
  ctx.fillStyle = '#efe8de';
  ctx.beginPath();
  ctx.moveTo(rx, rz - 8); ctx.lineTo(rx + 4, rz + 5); ctx.lineTo(rx - 4, rz + 5);
  ctx.fill();
  ctx.restore();

  // El jugador en el centro, apuntando arriba.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(c, c - 8); ctx.lineTo(c + 6, c + 6); ctx.lineTo(c, c + 3); ctx.lineTo(c - 6, c + 6);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ff6a4a';
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
}

// ---------------------------------------------------------- Avisos

// Los avisos se apilan en su propia columna: varios a la vez no se pisan.
let toasts: HTMLElement | null = null;

export function toast(title: string, body: string, kind: 'relic' | 'info' = 'info', seconds = 6) {
  if (!toasts || !toasts.isConnected) {
    toasts = h(`<div class="toasts"></div>`);
    root.appendChild(toasts);
  }
  // Como mucho tres: el más viejo se va.
  while (toasts.children.length >= 3) toasts.firstElementChild!.remove();
  const el = h(`<div class="toast ${kind}"><b>${title}</b><p>${body}</p></div>`);
  toasts.appendChild(el);
  setTimeout(() => el.classList.add('out'), seconds * 1000);
  setTimeout(() => el.remove(), seconds * 1000 + 600);
}

// --------------------------------------------------- Subida de nivel

export type Choice =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number }
  | { kind: 'heal' };

export function showLevelUp(level: number, choices: Choice[], pick: (c: Choice) => void) {
  const cards = choices.map((c, i) => {
    let title = '', tag = '', blurb = '', color = '#ffd25a';
    if (c.kind === 'weapon') {
      const w = WEAPONS[c.id];
      title = w.name;
      color = w.color;
      tag = c.level === 1 ? 'NUEVA' : `Nv. ${c.level}`;
      blurb = c.level === 1 ? w.blurb : describeWeaponStep(c.id, c.level);
    } else if (c.kind === 'passive') {
      const p = PASSIVES[c.id];
      title = p.name;
      tag = `Nv. ${c.level}`;
      blurb = p.blurb;
      color = '#9fb4ff';
    } else {
      title = 'Parche de emergencia';
      tag = 'REPARAR';
      blurb = 'Restaura 40 de integridad del traje.';
      color = '#7ef0a0';
    }
    return `<button class="card" data-i="${i}" style="--c:${color}">
      <span class="card-key">${i + 1}</span>
      <span class="card-tag">${tag}</span>
      <b>${title}</b>
      <p>${blurb}</p>
    </button>`;
  });

  const el = h(`
    <div class="overlay levelup">
      <div class="levelup-box">
        <h2>¡Nivel ${level}!</h2>
        <p class="sub">ADA ha encontrado algo útil entre la chatarra. Elige una mejora.</p>
        <div class="cards">${cards.join('')}</div>
      </div>
    </div>`);

  const choose = (i: number) => {
    if (!choices[i]) return;
    window.removeEventListener('keydown', onKey);
    el.remove();
    pick(choices[i]);
  };
  const onKey = (e: KeyboardEvent) => {
    const n = Number(e.key);
    if (n >= 1 && n <= choices.length) choose(n - 1);
  };
  el.querySelectorAll<HTMLButtonElement>('.card').forEach((b) =>
    b.addEventListener('click', () => choose(Number(b.dataset.i))));
  window.addEventListener('keydown', onKey);
  root.appendChild(el);
}

function describeWeaponStep(id: WeaponId, level: number) {
  const a = WEAPONS[id].levels[level - 2];
  const b = WEAPONS[id].levels[level - 1];
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
        <div class="eyebrow">ARES-IX · Tierra, año ~2500</div>
        <h1>Meta Space</h1>
        <p class="lead">Despiertas en una ciudad muerta bajo un cielo rojo. Llevas a ADA a la espalda
        y HELIOS quiere recuperarla. Aguanta <b>10 minutos</b> hasta la ventana de lanzamiento.</p>
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
            <h1>${r.victory ? '¡Ventana de lanzamiento!' : '¡Señal perdida!'}</h1>
            <p>${r.victory ? 'Has aguantado hasta que se abrió la ventana.' : 'Los Recolectores han alcanzado a ADA.'}</p>
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
              Llevas <b>${compact(r.bank)}</b> para montar la nave.
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
