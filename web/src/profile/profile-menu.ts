import {
  BACKDROPS,
  DEFAULT_PROFILE,
  FRAMES,
  OPERATORS,
  TITLES,
  getOperator,
  getProfileTitle,
} from './profile-data';

export interface ProfileSelection {
  profileId: string;
  profileName: string;
  profileFrame: string;
  profileTitle: string;
  profileBackdrop: string;
}

export interface ProfileMenuOptions extends Partial<ProfileSelection> {
  onCustom?: () => void;
}

type Tab = 'operators' | 'frames' | 'titles' | 'backdrops';

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function element(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}

export function openProfileMenu(options: ProfileMenuOptions = {}): Promise<ProfileSelection | null> {
  return new Promise((resolve) => {
    let tab: Tab = 'operators';
    let selection: ProfileSelection = {
      profileId: options.profileId ?? DEFAULT_PROFILE.profileId,
      profileName: options.profileName ?? getOperator(options.profileId).name,
      profileFrame: options.profileFrame ?? DEFAULT_PROFILE.profileFrame,
      profileTitle: options.profileTitle ?? DEFAULT_PROFILE.profileTitle,
      profileBackdrop: options.profileBackdrop ?? DEFAULT_PROFILE.profileBackdrop,
    };

    const overlay = element(`
      <div class="pm-overlay">
        <section class="pm-panel" role="dialog" aria-modal="true" aria-labelledby="pm-title">
          <button type="button" class="pm-close" aria-label="Cerrar">×</button>
          <header class="pm-header">
            <div class="pm-preview pm-frame--${selection.profileFrame} pm-bg--${selection.profileBackdrop}">
              <img alt="Operador seleccionado" />
            </div>
            <div class="pm-heading">
              <small>IDENTIDAD DEL OPERADOR</small>
              <h2 id="pm-title">Perfil de misión</h2>
              <p>Elige la imagen que aparecerá en tu ficha, menú y registro de expediciones.</p>
              <div class="pm-current"><i></i><span><b></b><em></em></span></div>
            </div>
          </header>

          <nav class="pm-tabs" aria-label="Personalización de perfil">
            <button type="button" data-tab="operators" class="on">Operadores</button>
            <button type="button" data-tab="frames">Marcos</button>
            <button type="button" data-tab="titles">Títulos</button>
            <button type="button" data-tab="backdrops">Fondos</button>
          </nav>

          <div class="pm-grid" role="listbox" aria-label="Opciones de perfil"></div>

          <footer class="pm-footer">
            <label>Nombre visible<input class="pm-name" maxlength="20" /></label>
            <button type="button" class="pm-custom">✦ Crear sprite de partida</button>
            <div class="pm-actions">
              <button type="button" class="pm-cancel">Cancelar</button>
              <button type="button" class="pm-save">Guardar</button>
            </div>
          </footer>
        </section>
      </div>`);

    document.body.appendChild(overlay);
    const q = <T extends Element = HTMLElement>(selector: string): T => overlay.querySelector(selector) as T;
    const grid = q('.pm-grid');
    const nameInput = q<HTMLInputElement>('.pm-name');
    nameInput.value = selection.profileName;

    const updatePreview = () => {
      const operator = getOperator(selection.profileId);
      const preview = q('.pm-preview');
      preview.className = `pm-preview pm-frame--${selection.profileFrame} pm-bg--${selection.profileBackdrop}`;
      q<HTMLImageElement>('.pm-preview img').src = operator.image;
      q<HTMLImageElement>('.pm-preview img').style.setProperty('--accent', operator.accent);
      q('.pm-current b').textContent = nameInput.value.trim() || operator.name;
      q('.pm-current em').textContent = `${operator.role} · ${getProfileTitle(selection.profileTitle).name}`;
      q<HTMLElement>('.pm-current i').style.background = operator.accent;
    };

    const choose = (kind: Tab, id: string) => {
      if (kind === 'operators') {
        selection.profileId = id;
        const operator = getOperator(id);
        selection.profileName = operator.name;
        nameInput.value = operator.name;
      } else if (kind === 'frames') selection.profileFrame = id;
      else if (kind === 'titles') selection.profileTitle = id;
      else selection.profileBackdrop = id;
      render();
      updatePreview();
    };

    const render = () => {
      grid.innerHTML = '';
      if (tab === 'operators') {
        for (const operator of OPERATORS) {
          const button = element(`
            <button type="button" class="pm-card pm-operator-card ${selection.profileId === operator.id ? 'on' : ''}" role="option" aria-selected="${selection.profileId === operator.id}">
              <span class="pm-card-image" style="--accent:${operator.accent}"><img src="${operator.image}" alt="" /></span>
              <b>${esc(operator.name)}</b><small>${esc(operator.role)}</small>
            </button>`);
          button.addEventListener('click', () => choose(tab, operator.id));
          grid.appendChild(button);
        }
        for (const label of ['Comandante orbital', 'Operador HELIOS']) {
          grid.insertAdjacentHTML('beforeend', `<div class="pm-card pm-card--locked"><span>⌁</span><b>${label}</b><small>Bloqueado</small></div>`);
        }
        return;
      }

      const list = tab === 'frames' ? FRAMES : tab === 'titles' ? TITLES : BACKDROPS;
      const selected = tab === 'frames' ? selection.profileFrame : tab === 'titles' ? selection.profileTitle : selection.profileBackdrop;
      for (const item of list) {
        const visual = tab === 'frames'
          ? `<span class="pm-option-demo pm-frame--${item.id}"><i></i></span>`
          : tab === 'backdrops'
            ? `<span class="pm-option-demo pm-bg--${item.id}"><i></i></span>`
            : `<span class="pm-title-demo">${esc(item.name)}</span>`;
        const button = element(`<button type="button" class="pm-card pm-option-card ${selected === item.id ? 'on' : ''}" role="option" aria-selected="${selected === item.id}">${visual}<b>${esc(item.name)}</b><small>${esc(item.blurb)}</small></button>`);
        button.addEventListener('click', () => choose(tab, item.id));
        grid.appendChild(button);
      }
    };

    const close = (result: ProfileSelection | null) => {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(null);
    };

    overlay.querySelectorAll<HTMLButtonElement>('.pm-tabs button').forEach((button) => {
      button.addEventListener('click', () => {
        tab = button.dataset.tab as Tab;
        overlay.querySelectorAll('.pm-tabs button').forEach((item) => item.classList.toggle('on', item === button));
        render();
      });
    });
    nameInput.addEventListener('input', updatePreview);
    q('.pm-close').addEventListener('click', () => close(null));
    q('.pm-cancel').addEventListener('click', () => close(null));
    q('.pm-save').addEventListener('click', () => {
      selection.profileName = nameInput.value.trim() || getOperator(selection.profileId).name;
      close(selection);
    });
    q('.pm-custom').addEventListener('click', () => {
      close(null);
      options.onCustom?.();
    });
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) close(null);
    });
    window.addEventListener('keydown', onKey);

    render();
    updatePreview();
    q<HTMLButtonElement>('.pm-save').focus();
  });
}
