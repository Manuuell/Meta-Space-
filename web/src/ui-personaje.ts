import './ui-personaje.css';
import { PERSONAJES, type PersonajeId } from './personajes.ts';
import { WEAPONS } from './data.ts';

const barra = (valor: number, min: number, max: number) => `<i style="--p:${Math.round((valor - min) / (max - min) * 100)}%"></i>`;

/** Selector modal. Confirma al pulsar una tarjeta y conserva Escape como volver. */
export function abrirSelectorPersonaje(actual: PersonajeId | null, elegir: (id: PersonajeId) => void, volver: () => void, forja?: () => void) {
  const previo = document.querySelector('.sel-personaje');
  previo?.remove();
  const root = document.createElement('div');
  root.className = 'sel-personaje';
  root.innerHTML = `
    <section role="dialog" aria-modal="true" aria-labelledby="sel-personaje-titulo">
      <header><div><small>EXPEDICIÓN A META</small><h2 id="sel-personaje-titulo">Elige personaje</h2><p>Cada operador trae un arma exclusiva, una habilidad con <b>R</b> y una pasiva.</p></div>${forja ? '<button class="sel-forja" type="button">Crear mi héroe</button>' : ''}<button class="sel-cerrar" aria-label="Volver">×</button></header>
      <div class="sel-lista">${PERSONAJES.map((p) => `
        <button class="sel-tarjeta${p.id === actual ? ' activa' : ''}" data-id="${p.id}" style="--c:${p.color}">
          <img src="${p.retrato}" alt="Retrato de ${p.nombre}">
          <span class="sel-info"><small>${p.rol}</small><strong>${p.nombre}</strong><em>${WEAPONS[p.armaInicial].name}</em></span>
          <span class="sel-stats">
            <label>Vida ${barra(p.stats.maxHp, 75, 145)}</label>
            <label>Velocidad ${barra(p.stats.speed, 4.5, 6.5)}</label>
            <label>Daño ${barra(p.stats.damageMul, .9, 1.25)}</label>
            <label>Recarga ${barra(1.15 - p.stats.cooldownMul, .05, .3)}</label>
          </span>
          <span class="sel-poder"><b>${p.habilidad?.nombre ?? 'Equipo estándar'}</b><small>${p.habilidad?.texto ?? 'Sin habilidad característica.'}</small></span>
          <span class="sel-pasiva"><b>${p.pasiva?.nombre ?? 'ARES-IX'}</b><small>${p.pasiva?.texto ?? 'Configuración equilibrada.'}</small></span>
        </button>`).join('')}</div>
    </section>`;
  const cerrar = () => { window.removeEventListener('keydown', tecla); root.remove(); volver(); };
  const tecla = (e: KeyboardEvent) => { if (e.code === 'Escape') cerrar(); };
  root.querySelector('.sel-cerrar')!.addEventListener('click', cerrar);
  root.querySelector('.sel-forja')?.addEventListener('click', () => {
    window.removeEventListener('keydown', tecla);
    root.remove();
    forja?.();
  });
  root.addEventListener('mousedown', (e) => { if (e.target === root) cerrar(); });
  root.querySelectorAll<HTMLButtonElement>('.sel-tarjeta').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.id as PersonajeId;
    window.removeEventListener('keydown', tecla);
    root.remove();
    elegir(id);
  }));
  window.addEventListener('keydown', tecla);
  document.body.appendChild(root);
  (root.querySelector(`.sel-tarjeta[data-id="${actual}"]`) as HTMLElement)?.focus();
}
