import './mejoras.css';
import { iconoMejora } from './iconos.ts';

// Subida de nivel: «¡NIVEL 8!» rebota letra a letra, como el título de la
// intro, y se reparten desde abajo tres o cuatro tarjetas. Cada una lleva su
// icono en un medallón del color de la mejora, una cinta con lo que es (nueva,
// de nivel a nivel, equipo, especial…), el texto y las pastillas de nivel, con
// la nueva latiendo. Se elige con clic, con 1–4 o con las flechas e Intro.
//
// Es solo la presentación: el juego decide las opciones y los textos (ver
// MUNDO.md, «Subida de nivel») y recibe el índice de la elegida.

export type TipoMejora = 'herramienta' | 'pasiva' | 'equipo' | 'especial' | 'reparar';

export interface Tarjeta {
  /** Id de la mejora en el juego (WeaponId, PassiveId, GearId, SpecialId o «parche»): elige el icono. */
  id: string;
  tipo: TipoMejora;
  titulo: string;
  /** Qué hace, en texto plano. */
  texto: string;
  color: string;
  /** Nivel al que sube (1 = nueva). */
  nivel?: number;
  /** Niveles que tiene: pinta las pastillas. Sin él, no hay pastillas. */
  nivelMax?: number;
  /** Equipo: cómo se usa («Mantén Espacio en el aire»). */
  control?: string;
}

export interface OpcionesMejoras {
  /** Dónde se monta (por defecto, #ui o el body). */
  root?: HTMLElement;
  /** La frase de debajo del título. */
  frase?: string;
}

const NOMBRE_TIPO: Record<TipoMejora, string> = {
  herramienta: 'Herramienta', pasiva: 'Mejora del traje', equipo: 'Equipo', especial: 'Especial', reparar: 'Reparación',
};

/** Lo que dice la cinta de arriba. */
function cinta(t: Tarjeta): { texto: string; nueva: boolean } {
  if (t.tipo === 'reparar') return { texto: 'REPARAR', nueva: false };
  if (!t.nivel || t.nivel <= 1) {
    return { texto: t.tipo === 'equipo' ? 'EQUIPO NUEVO' : t.tipo === 'especial' ? 'ESPECIAL NUEVO' : 'NUEVA', nueva: true };
  }
  return { texto: `NV. ${t.nivel - 1} → ${t.nivel}`, nueva: false };
}

/** Elemento con clase y, si se da, texto (siempre como texto plano). */
function el<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/** Lo que tardan en repartirse: hasta entonces no se puede elegir (ni sin querer). */
const ARMADO = 0.45;

/**
 * Muestra la subida de nivel y llama a `elegir` con el índice de la tarjeta
 * elegida cuando acaba su animación. Devuelve una función que la quita sin
 * elegir nada.
 */
export function mostrarMejoras(nivel: number, tarjetas: Tarjeta[], elegir: (i: number) => void, opciones: OpcionesMejoras = {}): () => void {
  const raiz = opciones.root ?? document.getElementById('ui') ?? document.body;
  const capa = el('div', 'msm armando');
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', `Nivel ${nivel}: elige una mejora`);
  capa.appendChild(el('div', 'msm-rayos'));

  // Título letra a letra: el número, en oro.
  const titulo = el('h2', 'msm-titulo');
  titulo.setAttribute('aria-hidden', 'true');
  [...`¡NIVEL ${nivel}!`].forEach((ch, i) => {
    const letra = el('span', ch === ' ' ? 'hueco' : /\d/.test(ch) ? 'num' : '', ch === ' ' ? '' : ch);
    letra.style.setProperty('--i', String(i));
    titulo.appendChild(letra);
  });
  capa.appendChild(titulo);
  capa.appendChild(el('p', 'msm-frase', opciones.frase ?? 'ADA ha encontrado algo útil entre la chatarra. Elige una mejora.'));

  const fila = el('div', 'msm-tarjetas');
  const botones = tarjetas.map((t, i) => {
    const b = el('button', 'msm-tarjeta');
    b.type = 'button';
    b.style.setProperty('--c', t.color);
    b.style.setProperty('--i', String(i));
    const c = cinta(t);
    b.appendChild(el('span', `msm-cinta${c.nueva ? ' nueva' : ''}`, c.texto));
    const medallon = el('span', 'msm-medallon');
    medallon.innerHTML = iconoMejora(t.id); // SVG propio, no viene de fuera
    b.appendChild(medallon);
    b.appendChild(el('span', 'msm-tipo', NOMBRE_TIPO[t.tipo]));
    b.appendChild(el('h3', '', t.titulo));
    // «2 → 3» no se parte en dos líneas.
    b.appendChild(el('p', '', t.texto.replace(/ → /g, '\u00a0→\u00a0')));
    if (t.control) b.appendChild(el('span', 'msm-control', t.control));
    if (t.nivelMax && t.tipo !== 'reparar') {
      const pips = el('span', 'msm-pips');
      const n = t.nivel ?? 1;
      for (let k = 1; k <= t.nivelMax; k++) pips.appendChild(el('i', k < n ? 'si' : k === n ? 'nueva' : ''));
      b.appendChild(pips);
    }
    b.appendChild(el('span', 'msm-tecla', String(i + 1)));
    b.setAttribute('aria-label', `${i + 1}. ${t.titulo}. ${c.texto}. ${t.texto}${t.control ? `. ${t.control}` : ''}`);
    b.addEventListener('click', () => escoger(i));
    fila.appendChild(b);
    return b;
  });
  capa.appendChild(fila);
  raiz.appendChild(capa);

  let armada = false, hecho = false;
  const reloj = window.setTimeout(() => {
    armada = true;
    capa.classList.remove('armando');
  }, (ARMADO + tarjetas.length * 0.09) * 1000);

  const quitarEscucha = () => {
    window.clearTimeout(reloj);
    window.removeEventListener('keydown', alTecla, true);
  };
  function escoger(i: number) {
    if (!armada || hecho || !tarjetas[i]) return;
    hecho = true;
    quitarEscucha();
    botones[i].classList.add('elegida');
    capa.classList.add('eligiendo');
    window.setTimeout(() => {
      capa.remove();
      elegir(i);
    }, 420);
  }
  function alTecla(e: KeyboardEvent) {
    const n = Number(e.key);
    if (n >= 1 && n <= tarjetas.length) {
      e.preventDefault();
      escoger(n - 1);
      return;
    }
    // Flechas: mueven el foco entre tarjetas (Intro o Espacio eligen la enfocada).
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!paso || !armada) return;
    e.preventDefault();
    const ahora = botones.indexOf(document.activeElement as HTMLButtonElement);
    botones[(ahora < 0 ? (paso > 0 ? 0 : botones.length - 1) : (ahora + paso + botones.length) % botones.length)].focus();
  }
  window.addEventListener('keydown', alTecla, true);

  return () => {
    if (hecho) return;
    hecho = true;
    quitarEscucha();
    capa.remove();
  };
}
