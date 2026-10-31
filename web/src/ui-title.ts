// META SPACE — menú principal.
// La ilustración vive en /public/art; todo el texto y la interacción permanecen
// como HTML accesible para evitar texto rasterizado y facilitar localización.

import { RELICS } from './data';
import { getOperator, getProfileTitle } from './profile/profile-data';

export interface TitleSave {
  runs: number;
  bestTime: number;
  bestKills?: number;
  bestScore?: number;
  relics: string[];
  scrapBank: number;
  profileId?: string;
  profileName?: string;
  profileFrame?: string;
  profileTitle?: string;
  profileBackdrop?: string;
}

export interface TitleOptions {
  onCreator?: () => void;
  onCodex?: () => void;
  relicTotal?: number;
  runLength?: number;
  root?: HTMLElement;
}

export function formatTitleTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function compactNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  return Math.round(value).toLocaleString('es-ES');
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function element(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}

function resolveRoot(opts?: TitleOptions): HTMLElement {
  if (opts?.root) return opts.root;
  const root = document.getElementById('ui');
  if (!root) throw new Error('showTitle: no existe el contenedor #ui');
  return root;
}

function openDialog(root: HTMLElement, label: string, bodyHtml: string): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;
  const dialog = element(`
    <div class="ms-dialog-backdrop">
      <section class="ms-dialog" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <div class="ms-dialog__signal" aria-hidden="true"><i></i> CANAL ADA // ENLACE SEGURO</div>
        <div class="ms-dialog-body">${bodyHtml}</div>
        <button type="button" class="ms-dialog-close">Cerrar</button>
      </section>
    </div>`);

  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    dialog.remove();
    previousFocus?.focus?.();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  dialog.querySelector('.ms-dialog-close')!.addEventListener('click', close);
  dialog.addEventListener('mousedown', (event) => {
    if (event.target === dialog) close();
  });
  window.addEventListener('keydown', onKey, true);
  root.appendChild(dialog);
  (dialog.querySelector('.ms-dialog-close') as HTMLButtonElement).focus();
  return close;
}

const HOW_TO_HTML = `
  <p class="ms-dialog-kicker">PROTOCOLO DE CAMPO 07</p>
  <h2>Sobrevive hasta la ventana de lanzamiento</h2>
  <p class="ms-dialog-lead">HELIOS rastrea la señal de ADA. Muévete, recupera chatarra y mantén a raya sus unidades durante <b>10 minutos</b>.</p>
  <ul class="ms-howto-list">
    <li><b>WASD / flechas</b><span>Mover al astronauta</span></li>
    <li><b>Ratón · Q / E</b><span>Girar la cámara</span></li>
    <li><b>Herramientas</b><span>Se activan automáticamente</span></li>
    <li><b>Chatarra</b><span>Recógela para subir de nivel</span></li>
    <li><b>Balizas</b><span>Destrúyelas antes de que atraigan más unidades</span></li>
    <li><b>Esc</b><span>Pausar la misión</span></li>
  </ul>
  <p class="ms-dialog-note">La luz cyan de tu mochila es ADA. Las señales rojas pertenecen a HELIOS.</p>`;

export function showHowTo(root?: HTMLElement): () => void {
  return openDialog(root ?? resolveRoot(), 'Cómo jugar', HOW_TO_HTML);
}

export function showCodexPreview(save: TitleSave, root?: HTMLElement): () => void {
  const host = root ?? resolveRoot();
  const items = RELICS.map((relic, index) => {
    const found = save.relics.includes(relic.id);
    return found
      ? `<li class="ms-codex-item is-found"><span>${String(index + 1).padStart(2, '0')}</span><div><b>${esc(relic.name)}</b><em>“${esc(relic.lore)}”</em><p>${esc(relic.fact)}</p></div></li>`
      : `<li class="ms-codex-item"><span>${String(index + 1).padStart(2, '0')}</span><div><b>REGISTRO CIFRADO</b><p>Reliquia aún perdida en el Sector Delta.</p></div></li>`;
  }).join('');

  return openDialog(
    host,
    'Códice de reliquias',
    `<p class="ms-dialog-kicker">ARCHIVO DE CAMPO</p>
     <h2>Códice de reliquias</h2>
     <p class="ms-dialog-lead">Recuperadas: <b>${save.relics.length}/${RELICS.length}</b>. Cada pieza conserva un fragmento de la última señal.</p>
     <ol class="ms-codex-list">${items}</ol>`,
  );
}

const CREATOR_PENDING_HTML = `
  <p class="ms-dialog-kicker">IDENTIDAD DEL OPERADOR</p>
  <h2>Creador de personaje</h2>
  <p class="ms-dialog-lead">El módulo de personalización todavía no está conectado. Podrás crear tu astronauta, ajustar sus estadísticas y llevar su sprite a la misión.</p>`;

export function showTitle(save: TitleSave, start: () => void, opts?: TitleOptions): () => void {
  const root = resolveRoot(opts);
  const relicTotal = opts?.relicTotal ?? RELICS.length;
  const minutes = Math.round((opts?.runLength ?? 600) / 60);
  const hasRecords = save.runs > 0;
  const bestTime = hasRecords ? formatTitleTime(save.bestTime) : '—';
  const bestKills = hasRecords && (save.bestKills ?? 0) > 0 ? compactNumber(save.bestKills!) : '—';
  const bestScore = hasRecords && (save.bestScore ?? 0) > 0 ? compactNumber(save.bestScore!) : '—';
  const operator = getOperator(save.profileId);
  const operatorName = save.profileName?.trim() || operator.name;
  const profileTitle = getProfileTitle(save.profileTitle);

  const node = element(`
    <main class="ms-title" role="dialog" aria-modal="true" aria-labelledby="ms-title-heading">
      <div class="ms-title__art" aria-hidden="true"></div>
      <div class="ms-title__shade" aria-hidden="true"></div>

      <header class="ms-topbar">
        <div class="ms-shortcuts" aria-label="Estado de la misión">
          <span class="ms-pill ms-pill--lang">ES</span>
          <span class="ms-pill ms-pill--icon" aria-hidden="true">⌗</span>
          <span class="ms-pill ms-pill--coral"><i>✦</i> Misión</span>
          <span class="ms-pill ms-pill--green"><i>⌁</i> ADA</span>
          <span class="ms-pill ms-pill--violet"><i>▣</i> Archivo</span>
        </div>
        <button type="button" class="ms-topbar__profile ms-profile-open" aria-label="Abrir perfil de ${esc(operatorName)}">
          <span class="ms-avatar pm-frame--${save.profileFrame ?? 'ada'} pm-bg--${save.profileBackdrop ?? 'moon'}"><img src="${operator.image}" alt="" /></span>
          <span class="ms-operator"><small>${esc(profileTitle.name)}</small><b>${esc(operatorName)}</b></span>
          <span class="ms-resource"><small>CHATARRA</small><b>◆ ${compactNumber(save.scrapBank)}</b></span>
          <span class="ms-resource"><small>RELIQUIAS</small><b>◈ ${save.relics.length}/${relicTotal}</b></span>
          <span class="ms-topbar__status"><i></i> ADA</span>
        </button>
      </header>

      <section class="ms-title__layout">
        <div class="ms-title__main">
          <div class="ms-wordmark">
            <p>META SPACE · SECTOR DELTA</p>
            <div class="ms-wordmark__line">
              <h1 id="ms-title-heading"><span>META</span>SPACE</h1>
              <strong>BETA</strong>
            </div>
            <div class="ms-wordmark__sub"><i></i><b>ÚLTIMA SEÑAL</b><i></i></div>
          </div>

          <nav class="ms-actions" aria-label="Menú principal">
            <button type="button" class="ms-tile ms-tile--play ms-play">
              <span class="ms-tile__icon" aria-hidden="true">▶</span>
              <span><b>Jugar</b><em>Sector Delta · ${minutes} min</em></span>
            </button>
            <button type="button" class="ms-tile ms-tile--creator ms-creator">
              <span class="ms-tile__icon" aria-hidden="true">◇</span>
              <span><b>Operador</b><em>Crea tu héroe</em></span>
            </button>
            <button type="button" class="ms-tile ms-tile--help ms-howto">
              <span class="ms-tile__icon" aria-hidden="true">?</span>
              <span><b>Cómo jugar</b><em>Controles y reglas</em></span>
            </button>
            <button type="button" class="ms-tile ms-tile--codex ms-codex">
              <span class="ms-tile__icon" aria-hidden="true">▤</span>
              <span><b>Códice</b><em>${save.relics.length}/${relicTotal} reliquias</em></span>
            </button>
          </nav>

          <div class="ms-event-row">
            <div class="ms-event-card">
              <span class="ms-event-card__icon" aria-hidden="true">◉</span>
              <span><small>¡OPERACIÓN ACTIVA!</small><b>La última señal</b><em>HELIOS rastrea a ADA</em></span>
            </div>
            <div class="ms-contract-card">
              <span aria-hidden="true">⌁</span>
              <span><small>BANCO DE CAMPO</small><b>${compactNumber(save.scrapBank)} chatarra</b><em>${save.runs} expediciones</em></span>
            </div>
          </div>

          <div class="ms-dock" aria-label="Resumen del progreso">
            <div><i>◈</i><b>Reliquias</b><small>${save.relics.length}/${relicTotal}</small></div>
            <div><i>⌁</i><b>Chatarra</b><small>${compactNumber(save.scrapBank)}</small></div>
            <div><i>✦</i><b>Partidas</b><small>${save.runs}</small></div>
            <div><i>◉</i><b>Récord</b><small>${bestTime}</small></div>
            <div><i>◎</i><b>Señal</b><small>Activa</small></div>
          </div>
        </div>

        <aside class="ms-mission-panel" aria-label="Registro de misión">
          <div class="ms-panel-banner stripes">
            <span aria-hidden="true">✦</span>
            <div><small>OPERACIÓN 07</small><b>Última señal</b><em>Ventana en ${minutes}:00</em></div>
          </div>
          <div class="ms-panel-tabs" aria-hidden="true"><b>◉ Récords</b><span>◈</span><span>⌁</span><span>◎</span></div>
          <div class="ms-panel-region"><span>◎</span><div><b>Sector Delta</b><small>Registro global de expediciones</small></div><i>⌄</i></div>

          <div class="ms-primary-record">
            <span class="ms-primary-record__badge" aria-hidden="true">A9</span>
            <div><small>OPERADOR ARES-IX</small><b>${bestScore}</b><em>mejor puntuación</em></div>
            <strong>${bestTime}<small>tiempo</small></strong>
          </div>

          <ol class="ms-ranking-list">
            <li><i>1</i><span class="ms-rank-icon coral">✦</span><div><b>Mejor tiempo</b><small>Supervivencia</small></div><strong>${bestTime}</strong></li>
            <li><i>2</i><span class="ms-rank-icon cyan">⌁</span><div><b>Unidades neutralizadas</b><small>HELIOS</small></div><strong>${bestKills}</strong></li>
            <li><i>3</i><span class="ms-rank-icon violet">◈</span><div><b>Reliquias</b><small>Archivo recuperado</small></div><strong>${save.relics.length}/${relicTotal}</strong></li>
            <li><i>4</i><span class="ms-rank-icon gold">◆</span><div><b>Banco</b><small>Chatarra disponible</small></div><strong>${compactNumber(save.scrapBank)}</strong></li>
          </ol>

          <div class="ms-relic-progress">
            <span><b>Progreso de temporada</b><small>${save.relics.length} de ${relicTotal}</small></span>
            <div><i style="width:${Math.min(100, (save.relics.length / Math.max(1, relicTotal)) * 100)}%"></i></div>
          </div>
          <button type="button" class="ms-panel-action ms-codex-secondary">Ver códice completo</button>
        </aside>
      </section>

      <footer class="ms-footer">
        <span><i class="ms-key">↵</i> SELECCIONAR</span>
        <span><i class="ms-key">C</i> OPERADOR</span>
        <span><i class="ms-key">X</i> CÓDICE</span>
        <span><i class="ms-key">H</i> AYUDA</span>
        <span class="ms-footer__build">META SPACE · v0.1.0</span>
      </footer>
    </main>`);

  let active = true;
  const previousFocus = document.activeElement as HTMLElement | null;
  const destroy = () => {
    if (!active) return;
    active = false;
    window.removeEventListener('keydown', onKey);
    node.remove();
    previousFocus?.focus?.();
  };
  const play = () => {
    if (root.querySelector('.ms-dialog-backdrop')) return;
    destroy();
    start();
  };
  const creator = () => {
    if (opts?.onCreator) opts.onCreator();
    else openDialog(root, 'Creador de personaje', CREATOR_PENDING_HTML);
  };
  const codex = () => {
    if (opts?.onCodex) opts.onCodex();
    else showCodexPreview(save, root);
  };
  const help = () => showHowTo(root);
  const onKey = (event: KeyboardEvent) => {
    if (root.querySelector('.ms-dialog-backdrop')) return;
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      play();
    } else if (event.code === 'KeyC') creator();
    else if (event.code === 'KeyX') codex();
    else if (event.code === 'KeyH' || event.code === 'F1') {
      event.preventDefault();
      help();
    }
  };

  node.querySelector('.ms-play')!.addEventListener('click', play);
  node.querySelector('.ms-creator')!.addEventListener('click', creator);
  node.querySelector('.ms-profile-open')!.addEventListener('click', creator);
  node.querySelector('.ms-codex')!.addEventListener('click', codex);
  node.querySelector('.ms-codex-secondary')!.addEventListener('click', codex);
  node.querySelector('.ms-howto')!.addEventListener('click', help);
  window.addEventListener('keydown', onKey);
  root.appendChild(node);
  (node.querySelector('.ms-play') as HTMLButtonElement).focus();
  return destroy;
}
