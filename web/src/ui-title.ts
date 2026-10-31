// META SPACE — Pantalla de título (FOCO 1: layout y UX).
//
// Módulo autocontenido y listo para integrar en el proyecto real:
//   1. Copia este archivo junto a `ui.ts` / `data.ts`.
//   2. Mantiene la firma original `showTitle(save, start)`: el tercer
//      parámetro `opts` es opcional; el juego existente sigue compilando.
//   3. Conecta el creador de personaje (FOCO 3) y el códice con
//      `opts.onCreator` / `opts.onCodex`.
//   4. Las clases CSS usan el prefijo `ms-` para no chocar con `style.css`.
//      La hoja de estilo definitiva la entrega el FOCO 2 (`style-title.css`);
//      `title.css` de esta demo es un respaldo funcional con el mismo contrato.
//
// Todo el texto visible está en español.

import { RELICS } from './data';

// ---------------------------------------------------------------- Tipos

/** Partida guardada. Compatible con el `save` actual del juego:
 *  `bestKills` y `bestScore` son opcionales para no romper guardados
 *  antiguos; si faltan, el panel muestra "—". */
export interface TitleSave {
  runs: number;
  bestTime: number; // segundos; 0 si aún no hay marca
  bestKills?: number;
  bestScore?: number;
  relics: string[]; // ids de reliquias desbloqueadas
  scrapBank: number;
}

/** Callbacks de integración. Si no se proporcionan, el título sigue
 *  funcionando con diálogos internos de respaldo (ver `showCodexPreview`
 *  y el aviso de creador pendiente). */
export interface TitleOptions {
  /** Abre el creador de personaje (FOCO 3). */
  onCreator?: () => void;
  /** Abre el códice de reliquias. Sin callback se usa el avance interno. */
  onCodex?: () => void;
  /** Total de reliquias. Por defecto, `RELICS.length`. */
  relicTotal?: number;
  /** Duración objetivo de la partida en segundos (texto). Por defecto 600. */
  runLength?: number;
  /** Contenedor donde montar. Por defecto `#ui`. */
  root?: HTMLElement;
}

// ------------------------------------------------------------ Utilidades
// (Duplicadas a propósito para que el módulo no dependa de `ui.ts`;
//  al integrar puedes importarlas de allí y borrar estas.)

export function formatTitleTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return n === 0 ? '0' : '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return Math.round(n).toLocaleString('es-ES');
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function resolveRoot(opts?: TitleOptions): HTMLElement {
  if (opts?.root) return opts.root;
  const found = document.getElementById('ui');
  if (!found) throw new Error('showTitle: no existe el contenedor #ui');
  return found;
}

// ------------------------------------------------------- Diálogo genérico

/** Caja modal interna (cómo jugar / códice de respaldo / aviso del creador).
 *  Devuelve una función para cerrarla. Cierra con botón, clic fuera y Esc. */
function openDialog(root: HTMLElement, label: string, bodyHtml: string): () => void {
  const prevFocus = document.activeElement as HTMLElement | null;
  const dlg = el(`
    <div class="ms-dialog-backdrop">
      <div class="ms-dialog" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <div class="ms-dialog-body">${bodyHtml}</div>
        <button type="button" class="btn ms-dialog-close">Cerrar</button>
      </div>
    </div>`);
  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    dlg.remove();
    prevFocus?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  dlg.querySelector('.ms-dialog-close')!.addEventListener('click', close);
  dlg.addEventListener('mousedown', (e) => {
    if (e.target === dlg) close();
  });
  window.addEventListener('keydown', onKey, true);
  root.appendChild(dlg);
  (dlg.querySelector('.ms-dialog-close') as HTMLButtonElement).focus();
  return close;
}

// ------------------------------------------------------------ Cómo jugar

const HOW_TO_HTML = `
  <h2 class="ms-dialog-title">¿Cómo jugar?</h2>
  <p class="ms-dialog-lead">Aguanta <b>10 minutos</b> hasta que se abra la ventana de lanzamiento.
  Las máquinas de HELIOS no paran de llegar: muévete, recoge chatarra y deja que ADA dispare por ti.</p>
  <ul class="ms-howto-list">
    <li><b>WASD / flechas</b> — mover al astronauta.</li>
    <li><b>Ratón</b> — girar la cámara (<b>Q</b> / <b>E</b> también giran).</li>
    <li><b>Herramientas automáticas</b> — el cortador, el pulso, el dron y la interferencia se usan solos.</li>
    <li><b>Chatarra</b> — acércate para recogerla y subir de nivel con 3 mejoras a elegir.</li>
    <li><b>Balizas</b> — mientras vivan, atraen más Recolectores. Destrúyelas primero.</li>
    <li><b>Segadores</b> — aparecen desde el minuto 2 y llevan reliquias dentro.</li>
    <li><b>Esc</b> — pausa la partida.</li>
  </ul>
  <p class="ms-dialog-note">Llevas a <b>ADA</b> a la espalda: esa luz cyan es tu amiga.
  Todo lo que brilla en rojo es de <b>HELIOS</b> y viene a por ella.</p>`;

export function showHowTo(root?: HTMLElement): () => void {
  return openDialog(root ?? resolveRoot(), 'Cómo jugar', HOW_TO_HTML);
}

// ------------------------------------------------- Códice (respaldo interno)

/** Avance del códice por si el juego aún no conecta su propia pantalla:
 *  lista cada reliquia como conseguida o "???" según `save.relics`. */
export function showCodexPreview(save: TitleSave, root?: HTMLElement): () => void {
  const host = root ?? resolveRoot();
  const items = RELICS.map((rel) => {
    const got = save.relics.includes(rel.id);
    return got
      ? `<li class="ms-codex-item got"><b>${esc(rel.name)}</b><em>“${esc(rel.lore)}”</em><p>${esc(rel.fact)}</p></li>`
      : `<li class="ms-codex-item locked"><b>???</b><p>Reliquia aún perdida en el Sector Delta.</p></li>`;
  }).join('');
  return openDialog(
    host,
    'Códice de reliquias',
    `<h2 class="ms-dialog-title">Códice de reliquias</h2>
     <p class="ms-dialog-lead">Llevas <b>${save.relics.length}/${RELICS.length}</b>.
     Cada reliquia esconde un dato real de la exploración espacial.</p>
     <ul class="ms-codex-list">${items}</ul>`,
  );
}

const CREATOR_PENDING_HTML = `
  <h2 class="ms-dialog-title">Creador de personaje</h2>
  <p class="ms-dialog-lead">Aquí se abrirá el creador del <b>FOCO 3</b>:
  dibuja tu astronauta o descríbelo con texto y entra en la partida con su sprite y sus stats.</p>
  <p class="ms-dialog-note">Integración: pasa <b>onCreator</b> en el tercer parámetro de
  <b>showTitle(save, start, { onCreator })</b> y este aviso desaparece.</p>`;

// ---------------------------------------------------------------- Título

/**
 * Pantalla inicial de META SPACE.
 *
 * Respeta la firma original `showTitle(save, start)` y suma un tercer
 * parámetro opcional con los callbacks del creador y del códice:
 *
 * ```ts
 * showTitle(save, () => game.start(), {
 *   onCreator: () => creator.open((sprite, stats) => game.start(sprite, stats)),
 *   onCodex: () => ui.showCodex(save),
 * });
 * ```
 *
 * Devuelve una función `destroy()` para desmontar la pantalla sin arrancar.
 */
export function showTitle(save: TitleSave, start: () => void, opts?: TitleOptions): () => void {
  const root = resolveRoot(opts);
  const relicTotal = opts?.relicTotal ?? RELICS.length;
  const minutes = Math.round((opts?.runLength ?? 600) / 60);

  const hasRecords = save.runs > 0;
  const bestTime = hasRecords ? formatTitleTime(save.bestTime) : '—';
  const bestKills = hasRecords && (save.bestKills ?? 0) > 0 ? compactNumber(save.bestKills!) : '—';
  const bestScore = hasRecords && (save.bestScore ?? 0) > 0 ? compactNumber(save.bestScore!) : '—';

  const node = el(`
    <div class="overlay ms-title" role="dialog" aria-modal="true" aria-labelledby="ms-title-heading">
      <div class="ms-title-decor" aria-hidden="true"><i class="ms-sun"></i></div>
      <div class="ms-title-box">
        <p class="eyebrow">ARES-IX · Tierra, año ~2500</p>
        <h1 id="ms-title-heading">META SPACE</h1>
        <p class="ms-subtitle">Un astronauta. Una IA llamada <b>ADA</b>. Las máquinas de <b>HELIOS</b>.</p>
        <p class="lead">Despiertas en una ciudad muerta bajo un cielo rojo.
        Llevas a ADA a la espalda y HELIOS quiere recuperarla.
        Aguanta <b>${minutes} minutos</b> hasta la ventana de lanzamiento.</p>

        <nav class="ms-actions" aria-label="Menú principal">
          <button type="button" class="btn ms-play">▶&nbsp; Jugar</button>
          <button type="button" class="btn ms-creator">Creador de personaje</button>
          <button type="button" class="btn ms-codex">Códice / Reliquias</button>
          <button type="button" class="btn ms-howto">¿Cómo jugar?</button>
        </nav>

        <section class="ms-records" aria-label="Panel de récords">
          <h2>Récords del Sector Delta</h2>
          <div class="ms-records-grid">
            <div class="ms-record hero"><b>${bestTime}</b><small>mejor tiempo</small></div>
            <div class="ms-record hero"><b>${bestKills}</b><small>bajas</small></div>
            <div class="ms-record hero"><b>${bestScore}</b><small>puntuación</small></div>
          </div>
          <div class="ms-records-grid sub">
            <div class="ms-record"><b>${save.runs}</b><small>partidas</small></div>
            <div class="ms-record"><b>${save.relics.length}/${relicTotal}</b><small>reliquias</small></div>
            <div class="ms-record"><b>${compactNumber(save.scrapBank)}</b><small>chatarra en el banco</small></div>
          </div>
          ${
            hasRecords
              ? ''
              : '<p class="ms-no-records">Aún no hay marcas: despega y sobrevive para estrenar el panel.</p>'
          }
        </section>

        <p class="keys"><b>Intro</b> jugar · <b>C</b> creador · <b>X</b> códice · <b>H</b> ayuda ·
        <b>WASD</b> moverse · <b>ratón</b> girar cámara · herramientas automáticas · <b>Esc</b> pausa</p>
      </div>
    </div>`);

  let cleanup: (() => void) | null = null;
  const destroy = () => {
    if (!cleanup) return;
    cleanup();
    cleanup = null;
  };

  const go = () => {
    destroy();
    start();
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

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      // No robar el Intro a los diálogos internos ya abiertos.
      if (root.querySelector('.ms-dialog-backdrop')) return;
      e.preventDefault();
      go();
    } else if (e.code === 'KeyC') openCreator();
    else if (e.code === 'KeyX') openCodex();
    else if (e.code === 'KeyH' || e.code === 'F1') {
      e.preventDefault();
      openHelp();
    }
  };

  node.querySelector('.ms-play')!.addEventListener('click', go);
  node.querySelector('.ms-creator')!.addEventListener('click', openCreator);
  node.querySelector('.ms-codex')!.addEventListener('click', openCodex);
  node.querySelector('.ms-howto')!.addEventListener('click', openHelp);
  window.addEventListener('keydown', onKey);

  const prevFocus = document.activeElement as HTMLElement | null;
  cleanup = () => {
    window.removeEventListener('keydown', onKey);
    node.remove();
    prevFocus?.focus?.();
  };

  root.appendChild(node);
  (node.querySelector('.ms-play') as HTMLButtonElement).focus();
  return destroy;
}
