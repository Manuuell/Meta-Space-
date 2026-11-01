// META SPACE — pantalla de título: layout y flujo (FOCO 6).
//
// Pulido final de `ui-title.ts`: jerarquía, flujo sin callejones
// (JUGAR / PERFIL / CREADOR / CÓDICE / AYUDA), estados explícitos
// (sin récords, con récords, héroe personalizado activo), accesibilidad
// (teclado completo, foco visible y devuelto, ARIA honesta, región viva)
// y retorno limpio al título desde pausa/resultados (instancia única por
// raíz, destrucción idempotente).
//
// Compatibilidad: mantiene las firmas `showTitle(save, start, opts?)`,
// `showHowTo(root?)` y `showCodexPreview(save, root?)`, el prefijo `ms-`
// en todas las clases y las clases que ya estiliza `style-title.css`
// (las nuevas clases también llevan el prefijo y degradan a párrafo
// legible si la hoja aún no las conoce). `TitleOptions` solo crece con
// campos opcionales: el cableado actual de `game.ts` compila sin cambios.
//
// Todo el texto visible del juego va en español.

import { RELICS } from './data';
import { getOperator, getProfileTitle } from './profile/profile-data';

// ---------------------------------------------------------------- Tipos

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
  /** Abre el menú de perfil (PERFIL). Si falta, el botón usa `onCreator`. */
  onProfile?: () => void;
  relicTotal?: number;
  runLength?: number;
  root?: HTMLElement;
  /** Nombre del héroe del creador de personaje, si hay uno activo. */
  customHeroName?: string;
  /** Abre el selector de compañero (botón ADA o tecla A). */
  onCompanion?: () => void;
  /** Nombre del compañero elegido, para el botón. */
  companionName?: string;
  /** Especial del héroe personalizado, si aplica (texto corto). */
  customHeroSpecial?: string;
}

/** Estado derivado del guardado: lo que decide qué se muestra. */
export interface TitleViewModel {
  hasRecords: boolean;
  isFirstRun: boolean;
  operatorName: string;
  profileTitleName: string;
  relicTotal: number;
  relicCount: number;
  minutes: number;
  bestTime: string;
  bestKills: string;
  bestScore: string;
  progressPct: number;
  /** null cuando no hay héroe personalizado activo. */
  heroName: string | null;
  heroSpecial: string | null;
  /** Frase de estado para la región viva y los estados vacíos. */
  stateLabel: string;
  /** Frase del chip de héroe bajo el logotipo. */
  heroLabel: string;
}

// ------------------------------------------------------- Formato (puro)

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

// --------------------------------------------- Modelo de vista (puro)

export function titleViewModel(save: TitleSave, opts?: TitleOptions): TitleViewModel {
  const relicTotal = opts?.relicTotal ?? RELICS.length;
  const minutes = Math.round((opts?.runLength ?? 600) / 60);
  const hasRecords = save.runs > 0;
  const operator = getOperator(save.profileId);
  const operatorName = save.profileName?.trim() || operator.name;
  const profileTitleName = getProfileTitle(save.profileTitle).name;
  const relicCount = Math.min(save.relics.length, Math.max(0, relicTotal));
  const heroName = opts?.customHeroName?.trim() || null;
  const heroSpecial = opts?.customHeroSpecial?.trim() || null;
  const progressPct = relicTotal > 0 ? Math.min(100, (relicCount / relicTotal) * 100) : 0;
  const stateLabel = !hasRecords
    ? 'Sin expediciones todavía. Tu primera misión crea las marcas.'
    : `Has completado ${save.runs} ${save.runs === 1 ? 'expedición' : 'expediciones'}.` +
      (heroName ? ` Héroe personalizado activo: ${heroName}.` : '');
  const heroLabel = heroName
    ? `Héroe personalizado: ${heroName}${heroSpecial ? ` · ${heroSpecial}` : ''}`
    : 'Sin héroe personalizado. Créalo en Operador.';
  return {
    hasRecords,
    isFirstRun: !hasRecords,
    operatorName,
    profileTitleName,
    relicTotal,
    relicCount,
    minutes,
    bestTime: hasRecords ? formatTitleTime(save.bestTime) : '—',
    bestKills: hasRecords && (save.bestKills ?? 0) > 0 ? compactNumber(save.bestKills!) : '—',
    bestScore: hasRecords && (save.bestScore ?? 0) > 0 ? compactNumber(save.bestScore!) : '—',
    progressPct,
    heroName,
    heroSpecial,
    stateLabel,
    heroLabel,
  };
}

// ------------------------------------------ Teclado y foco (puro)

export type TitleAction =
  | 'play'
  | 'profile'
  | 'creator'
  | 'codex'
  | 'help'
  | 'companion'
  | 'close-dialog'
  | 'none';

/**
 * Qué hace cada tecla en el título. Pura y probada: con un diálogo abierto
 * solo Escape cierra; sin diálogo, las teclas disparan su destino y Escape
 * no hace nada (no hay callejón ni salida accidental).
 */
export function resolveTitleAction(code: string, dialogOpen: boolean): TitleAction {
  if (dialogOpen) return code === 'Escape' ? 'close-dialog' : 'none';
  switch (code) {
    case 'Enter':
    case 'Space':
      return 'play';
    case 'KeyP':
      return 'profile';
    case 'KeyC':
      return 'creator';
    case 'KeyX':
      return 'codex';
    case 'KeyA':
      return 'companion';
    case 'KeyH':
    case 'F1':
      return 'help';
    default:
      return 'none';
  }
}

/**
 * Siguiente índice con flechas dentro de una lista lineal de azulejos
 * (las flechas envuelven; Inicio/Fin saltan a los extremos).
 */
export function stepFocusIndex(
  count: number,
  current: number,
  key: 'ArrowRight' | 'ArrowDown' | 'ArrowLeft' | 'ArrowUp' | 'Home' | 'End',
): number {
  if (count <= 0) return 0;
  const at = Math.min(Math.max(current, 0), count - 1);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (at + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (at - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
  }
}

// --------------------------------------------- Plantillas HTML (puras)

/** Estilo en línea para texto solo de lector de pantalla (sin depender del CSS). */
const SR_ONLY =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';

function heroChipHtml(vm: TitleViewModel): string {
  if (vm.heroName) {
    return `<p class="ms-hero-chip is-custom"><span aria-hidden="true">✦</span> ${esc(vm.heroLabel)}</p>`;
  }
  return `<p class="ms-hero-chip"><span aria-hidden="true">◇</span> ${esc(vm.heroLabel)}</p>`;
}

function emptyRecordsHtml(vm: TitleViewModel): string {
  if (vm.hasRecords) return '';
  return `<p class="ms-empty">Aún no hay expediciones registradas. Completa tu primera misión de ${vm.minutes} minutos y aquí aparecerán tus marcas.</p>`;
}

/** Clases de la raíz del título según el estado. Pura y probada. */
export function titleRootClass(save: TitleSave, opts?: TitleOptions): string {
  const vm = titleViewModel(save, opts);
  return `ms-title${vm.isFirstRun ? ' is-first-run' : ''}${vm.heroName ? ' has-custom-hero' : ''}`;
}

/** Cuerpo completo del título. `showTitle` lo monta; los tests lo inspeccionan. */
export function renderTitleHtml(save: TitleSave, opts?: TitleOptions): string {
  const vm = titleViewModel(save, opts);
  const operator = getOperator(save.profileId);
  const frame = save.profileFrame ?? 'ada';
  const backdrop = save.profileBackdrop ?? 'moon';
  const creatorSub = vm.heroName ? `Editar a ${esc(vm.heroName)}` : 'Crea tu héroe';
  const profileHint = `Abrir perfil de ${esc(vm.operatorName)}: ${esc(vm.profileTitleName)}. ${vm.relicCount} de ${vm.relicTotal} reliquias.`;

  return `
      <div class="ms-title__art" aria-hidden="true"></div>
      <div class="ms-title__shade" aria-hidden="true"></div>
      <p class="ms-sr-status" role="status" style="${SR_ONLY}">${esc(vm.stateLabel)}</p>

      <header class="ms-topbar">
        <div class="ms-shortcuts" aria-label="Estado de la misión">
          <span class="ms-pill ms-pill--lang">ES</span>
          <span class="ms-pill ms-pill--icon" aria-hidden="true">⌁</span>
          <span class="ms-pill ms-pill--coral"><i>✦</i> Misión</span>
          <button type="button" class="ms-pill ms-pill--green ms-companion" data-action="companion"
            aria-keyshortcuts="a" title="Elegir compañero (A)"><i>⌁</i> ${esc(opts?.companionName ?? 'Compañero')}</button>
          <span class="ms-pill ms-pill--violet"><i>▣</i> Archivo</span>
        </div>
        <button type="button" class="ms-topbar__profile ms-profile-open" data-action="profile"
          aria-label="${esc(profileHint)}" aria-keyshortcuts="p">
          <span class="ms-avatar pm-frame--${esc(frame)} pm-bg--${esc(backdrop)}"><img src="${operator.image}" alt="" /></span>
          <span class="ms-operator"><small>${esc(vm.profileTitleName)}</small><b>${esc(vm.operatorName)}</b></span>
          <span class="ms-resource"><small>CHATARRA</small><b>◆ ${compactNumber(save.scrapBank)}</b></span>
          <span class="ms-resource"><small>RELIQUIAS</small><b>◈ ${vm.relicCount}/${vm.relicTotal}</b></span>
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
            <div class="ms-wordmark__sub"><i></i><b>SALVA EL PLANETA META</b><i></i></div>
            ${heroChipHtml(vm)}
          </div>

          <nav class="ms-actions" aria-label="Menú principal">
            <button type="button" class="ms-tile ms-tile--play ms-play" data-action="play"
              aria-keyshortcuts="Enter" aria-describedby="ms-play-hint">
              <span class="ms-tile__icon" aria-hidden="true">▶</span>
              <span><b>Jugar</b><em id="ms-play-hint">Sector Delta · ${vm.minutes} min</em></span>
            </button>
            <button type="button" class="ms-tile ms-tile--creator ms-creator" data-action="creator"
              aria-keyshortcuts="c">
              <span class="ms-tile__icon" aria-hidden="true">◇</span>
              <span><b>Operador</b><em>${creatorSub}</em></span>
            </button>
            <button type="button" class="ms-tile ms-tile--help ms-howto" data-action="help"
              aria-keyshortcuts="h">
              <span class="ms-tile__icon" aria-hidden="true">?</span>
              <span><b>Cómo jugar</b><em>Controles y reglas</em></span>
            </button>
            <button type="button" class="ms-tile ms-tile--codex ms-codex" data-action="codex"
              aria-keyshortcuts="x">
              <span class="ms-tile__icon" aria-hidden="true">▤</span>
              <span><b>Códice</b><em>${vm.relicCount}/${vm.relicTotal} reliquias</em></span>
            </button>
          </nav>

          <div class="ms-event-row">
            <div class="ms-event-card">
              <span class="ms-event-card__icon" aria-hidden="true">◉</span>
              <span><small>¡OPERACIÓN ACTIVA!</small><b>Apagar el velo</b><em>HELIOS rastrea a ADA</em></span>
            </div>
            <div class="ms-contract-card">
              <span aria-hidden="true">⌁</span>
              <span><small>BANCO DE CAMPO</small><b>${compactNumber(save.scrapBank)} chatarra</b><em>${save.runs} ${save.runs === 1 ? 'expedición' : 'expediciones'}</em></span>
            </div>
          </div>

          <div class="ms-dock" aria-label="Resumen del progreso">
            <div><i aria-hidden="true">◈</i><b>Reliquias</b><small>${vm.relicCount}/${vm.relicTotal}</small></div>
            <div><i aria-hidden="true">⌁</i><b>Chatarra</b><small>${compactNumber(save.scrapBank)}</small></div>
            <div><i aria-hidden="true">✦</i><b>Partidas</b><small>${save.runs}</small></div>
            <div><i aria-hidden="true">◉</i><b>Récord</b><small>${vm.bestTime}</small></div>
            <div><i aria-hidden="true">◎</i><b>Señal</b><small>Activa</small></div>
          </div>
        </div>

        <aside class="ms-mission-panel" aria-label="Registro de misión">
          <div class="ms-panel-banner stripes">
            <span aria-hidden="true">✦</span>
            <div><small>OPERACIÓN 07</small><b>Apagar el velo</b><em>Ventana en ${vm.minutes}:00</em></div>
          </div>
          <div class="ms-panel-tabs" aria-hidden="true"><b>◉ Récords</b><span>◈</span><span>⌁</span><span>◎</span></div>
          <div class="ms-panel-region"><span aria-hidden="true">◎</span><div><b>Sector Delta</b><small>Registro global de expediciones</small></div><i aria-hidden="true">⌄</i></div>

          <div class="ms-primary-record">
            <span class="ms-primary-record__badge" aria-hidden="true">A9</span>
            <div><small>OPERADOR ARES-IX</small><b>${vm.bestScore}</b><em>${vm.hasRecords ? 'mejor puntuación' : 'sin marcas todavía'}</em></div>
            <strong>${vm.bestTime}<small>tiempo</small></strong>
          </div>
          ${emptyRecordsHtml(vm)}

          <ol class="ms-ranking-list" aria-label="Marcas del Sector Delta">
            <li><i aria-hidden="true">1</i><span class="ms-rank-icon coral" aria-hidden="true">✦</span><div><b>Mejor tiempo</b><small>Supervivencia</small></div><strong>${vm.bestTime}</strong></li>
            <li><i aria-hidden="true">2</i><span class="ms-rank-icon cyan" aria-hidden="true">⌁</span><div><b>Unidades neutralizadas</b><small>HELIOS</small></div><strong>${vm.bestKills}</strong></li>
            <li><i aria-hidden="true">3</i><span class="ms-rank-icon violet" aria-hidden="true">◈</span><div><b>Reliquias</b><small>Pruebas contra el velo</small></div><strong>${vm.relicCount}/${vm.relicTotal}</strong></li>
            <li><i aria-hidden="true">4</i><span class="ms-rank-icon gold" aria-hidden="true">◆</span><div><b>Banco</b><small>Chatarra disponible</small></div><strong>${compactNumber(save.scrapBank)}</strong></li>
          </ol>

          <div class="ms-relic-progress">
            <span><b>Auditoría de HELIOS</b><small>${vm.relicCount} de ${vm.relicTotal} pruebas</small></span>
            <div role="progressbar" aria-label="Pruebas reunidas para apagar el velo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(vm.progressPct)}"><i style="width:${vm.progressPct}%"></i></div>
          </div>
          <button type="button" class="ms-panel-action ms-codex-secondary" data-action="codex">Ver códice completo</button>
        </aside>
      </section>

      <footer class="ms-footer">
        <span><i class="ms-key">↵</i> SELECCIONAR</span>
        <span><i class="ms-key">P</i> PERFIL</span>
        <span><i class="ms-key">C</i> OPERADOR</span>
        <span><i class="ms-key">X</i> CÓDICE</span>
        <span><i class="ms-key">H</i> AYUDA</span>
        <span class="ms-footer__build">META SPACE · v0.1.0</span>
      </footer>`;
}

const HOW_TO_HTML = `
  <p class="ms-dialog-kicker">PROTOCOLO DE CAMPO 07</p>
  <h2 id="ms-dialog-heading" tabindex="-1">Sobrevive hasta la ventana de lanzamiento</h2>
  <p class="ms-dialog-lead">Meta se congela bajo el velo de HELIOS y ADA es la única que puede firmar su apagado. Muévete, recupera chatarra y mantén a raya sus unidades durante <b>10 minutos</b>: al abrirse la ventana, el cohete sube la orden y el sol vuelve al sector.</p>
  <ul class="ms-howto-list">
    <li><b>WASD / flechas</b><span>Mover al astronauta</span></li>
    <li><b>Espacio</b><span>Saltar (vale anticipado y justo al borde)</span></li>
    <li><b>Mantener Espacio</b><span>En el aire, vuela con la mochila cohete (si la tienes)</span></li>
    <li><b>Shift</b><span>Acelerón con las botas de impulso (si las tienes)</span></li>
    <li><b>A (en el menú)</b><span>Elegir compañero: dron, zorro, holograma de Noa, medusa, orbe o el perro</span></li>
    <li><b>K</b><span>En partida, pasar al siguiente compañero</span></li>
    <li><b>Ratón · Q / E</b><span>Girar la cámara</span></li>
    <li><b>Herramientas</b><span>Se activan automáticamente</span></li>
    <li><b>Chatarra</b><span>Recógela para subir de nivel</span></li>
    <li><b>Balizas</b><span>Destrúyelas antes de que atraigan más unidades</span></li>
    <li><b>Reliquias</b><span>Las llevan los Segadores: reúne las 7 pruebas para apagar el velo de todo Meta</span></li>
    <li><b>Esc</b><span>Pausar la misión</span></li>
  </ul>
  <p class="ms-dialog-note">La luz cyan de tu mochila es ADA. Las señales rojas pertenecen a HELIOS.</p>`;

export function renderCodexHtml(save: TitleSave, relicTotal?: number): string {
  const total = relicTotal ?? RELICS.length;
  const items = RELICS.map((relic, index) => {
    const found = save.relics.includes(relic.id);
    return found
      ? `<li class="ms-codex-item is-found"><span>${String(index + 1).padStart(2, '0')}</span><div><b>${esc(relic.name)}</b><em>“${esc(relic.lore)}”</em><p>${esc(relic.fact)}</p></div></li>`
      : `<li class="ms-codex-item"><span>${String(index + 1).padStart(2, '0')}</span><div><b>REGISTRO CIFRADO</b><p>Reliquia aún perdida en el Sector Delta.</p></div></li>`;
  }).join('');
  return `
  <p class="ms-dialog-kicker">ARCHIVO DE CAMPO</p>
  <h2 id="ms-dialog-heading" tabindex="-1">Códice de reliquias</h2>
  <p class="ms-dialog-lead">Recuperadas: <b>${save.relics.length}/${total}</b>. Cada reliquia es una prueba para la auditoría que obliga a HELIOS a apagar el velo.</p>
  <ol class="ms-codex-list">${items}</ol>`;
}

const CREATOR_PENDING_HTML = `
  <p class="ms-dialog-kicker">IDENTIDAD DEL OPERADOR</p>
  <h2 id="ms-dialog-heading" tabindex="-1">Creador de personaje</h2>
  <p class="ms-dialog-lead">El módulo de personalización todavía no está conectado. Podrás crear tu astronauta, ajustar sus estadísticas y llevar su sprite a la misión.</p>
  <p class="ms-dialog-note">Mientras tanto, tu perfil de operador (avatar, marco y título) sí funciona: ábrelo con el botón del avatar o la tecla P.</p>`;

// ------------------------------------------------------------- Diálogos

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

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal accesible: trampa de Tab, Escape, clic en el fondo y
 * devolución del foco a quien lo abrió. Sin callejones.
 */
function openDialog(root: HTMLElement, label: string, bodyHtml: string): () => void {
  const invoker = document.activeElement as HTMLElement | null;
  const dialog = element(`
    <div class="ms-dialog-backdrop">
      <section class="ms-dialog" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <div class="ms-dialog__signal" aria-hidden="true"><i></i> CANAL ADA // ENLACE SEGURO</div>
        <div class="ms-dialog-body">${bodyHtml}</div>
        <button type="button" class="ms-dialog-close">Cerrar</button>
      </section>
    </div>`);
  const panel = dialog.querySelector('.ms-dialog') as HTMLElement;

  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    dialog.remove();
    if (invoker && invoker.isConnected) invoker.focus();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      close();
      return;
    }
    if (event.code !== 'Tab') return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (item) => item.offsetParent !== null || item === document.activeElement,
    );
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  dialog.querySelector('.ms-dialog-close')!.addEventListener('click', close);
  dialog.addEventListener('mousedown', (event) => {
    if (event.target === dialog) close();
  });
  window.addEventListener('keydown', onKey, true);
  root.appendChild(dialog);
  const heading = panel.querySelector('#ms-dialog-heading') as HTMLElement | null;
  (heading ?? (dialog.querySelector('.ms-dialog-close') as HTMLElement)).focus();
  return close;
}

export function showHowTo(root?: HTMLElement): () => void {
  return openDialog(root ?? resolveRoot(), 'Cómo jugar', HOW_TO_HTML);
}

export function showCodexPreview(save: TitleSave, root?: HTMLElement): () => void {
  return openDialog(root ?? resolveRoot(), 'Códice de reliquias', renderCodexHtml(save));
}

// -------------------------------------------------------- Título

/** Instancia abierta por raíz: garantiza una sola y retorno limpio. */
const openTitles = new WeakMap<HTMLElement, () => void>();

export function dismissTitle(root?: HTMLElement): void {
  const host = root ?? (typeof document !== 'undefined' ? document.getElementById('ui') : null);
  if (host) openTitles.get(host)?.();
}

/**
 * Muestra el título. Reentrante: si la misma raíz ya tenía un título
 * (retorno desde pausa o resultados), lo sustituye sin duplicar nodos
 * ni fugas de escuchas. Devuelve `destroy`, idempotente.
 */
export function showTitle(save: TitleSave, start: () => void, opts?: TitleOptions): () => void {
  const root = resolveRoot(opts);
  // Retorno desde pausa/resultados: nunca dos títulos a la vez.
  root.querySelectorAll(':scope > .ms-title[data-ms-title]').forEach((stale) => stale.remove());
  openTitles.get(root)?.();

  const node = document.createElement('main');
  node.className = titleRootClass(save, opts);
  node.dataset.msTitle = 'open';
  node.setAttribute('aria-labelledby', 'ms-title-heading');
  node.innerHTML = renderTitleHtml(save, opts);

  let active = true;
  const previousFocus = document.activeElement as HTMLElement | null;
  const destroy = () => {
    if (!active) return;
    active = false;
    window.removeEventListener('keydown', onKey);
    if (openTitles.get(root) === destroy) openTitles.delete(root);
    node.remove();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  };
  openTitles.set(root, destroy);

  const play = () => {
    if (root.querySelector('.ms-dialog-backdrop')) return;
    destroy();
    start();
  };
  const openProfile = () => {
    if (opts?.onProfile) opts.onProfile();
    else if (opts?.onCreator) opts.onCreator();
    else openDialog(root, 'Perfil de operador', CREATOR_PENDING_HTML);
  };
  const openCreator = () => {
    if (opts?.onCreator) opts.onCreator();
    else openDialog(root, 'Creador de personaje', CREATOR_PENDING_HTML);
  };
  const openCodex = () => {
    if (opts?.onCodex) opts.onCodex();
    else showCodexPreview(save, root);
  };
  const openHelp = () => showHowTo(root);

  const onKey = (event: KeyboardEvent) => {
    const dialogOpen = root.querySelector('.ms-dialog-backdrop') !== null
      || document.querySelector('.pm-overlay') !== null;
    // Con diálogo abierto solo manda Escape (lo gestiona el propio diálogo).
    if (dialogOpen) return;
    // En botones/enlaces nativos, Enter/Espacio ya activan: no duplicar.
    const onControl =
      event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea') !== null;
    const action = resolveTitleAction(event.code, false);
    if (action === 'none') {
      // Flechas: moverse entre azulejos cuando el foco está en uno.
      if (
        event.target instanceof HTMLElement &&
        event.target.classList.contains('ms-tile') &&
        (event.code.startsWith('Arrow') || event.code === 'Home' || event.code === 'End')
      ) {
        const tiles = Array.from(node.querySelectorAll<HTMLButtonElement>('.ms-tile'));
        const next = stepFocusIndex(tiles.length, tiles.indexOf(event.target as HTMLButtonElement), event.code as never);
        event.preventDefault();
        tiles[next]?.focus();
      }
      return;
    }
    if (onControl && (event.code === 'Enter' || event.code === 'Space')) return;
    if (event.code === 'Space' || event.code === 'F1') event.preventDefault();
    switch (action) {
      case 'play':
        play();
        break;
      case 'profile':
        openProfile();
        break;
      case 'creator':
        openCreator();
        break;
      case 'codex':
        openCodex();
        break;
      case 'help':
        openHelp();
        break;
      case 'companion':
        opts?.onCompanion?.();
        break;
      default:
        break;
    }
  };

  node.querySelector('.ms-play')!.addEventListener('click', play);
  node.querySelector('.ms-creator')!.addEventListener('click', openCreator);
  node.querySelector('.ms-profile-open')!.addEventListener('click', openProfile);
  node.querySelector('.ms-codex')!.addEventListener('click', openCodex);
  node.querySelector('.ms-codex-secondary')!.addEventListener('click', openCodex);
  node.querySelector('.ms-howto')!.addEventListener('click', openHelp);
  node.querySelector('.ms-companion')!.addEventListener('click', () => opts?.onCompanion?.());
  window.addEventListener('keydown', onKey);
  root.appendChild(node);
  (node.querySelector('.ms-play') as HTMLButtonElement).focus();
  return destroy;
}
