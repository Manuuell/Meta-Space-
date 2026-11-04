import './ui-chat.css';
import type { MensajeChat } from './conversacion';

// La ventana de conversación. Solo pinta: lo que se dice lo decide charlas.ts.
// Todo el texto va con textContent, porque viene del jugador o del modelo.

export interface OpcionesChat {
  nombre: string;
  rol: string;
  color: string;
  sugerencias: string[];
  historial: readonly MensajeChat[];
  voz: boolean;
  alEnviar(texto: string): void;
  alCerrar(): void;
  alMicrofono(): void;
  alCambiarVoz(activa: boolean): void;
}

export interface Burbuja {
  /** Lo que lleva escrito hasta ahora. */
  escribir(texto: string): void;
  terminar(texto: string): void;
}

export interface VistaChat {
  jugador(texto: string): void;
  /** La respuesta que viene, con los puntos de espera hasta el primer trozo. */
  respuesta(): Burbuja;
  aviso(texto: string, bien: boolean): void;
  ocupada(si: boolean): void;
  escuchando(si: boolean): void;
  quitar(): void;
}

const crear = <K extends keyof HTMLElementTagNameMap>(tag: K, clase: string, texto?: string) => {
  const el = document.createElement(tag);
  el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
};

export function abrirVistaChat(o: OpcionesChat): VistaChat {
  const fondo = crear('div', 'ch');
  fondo.setAttribute('role', 'dialog');
  fondo.setAttribute('aria-label', `Conversación con ${o.nombre}`);
  const panel = crear('section', 'ch-panel');
  panel.style.setProperty('--c', o.color);

  const cabecera = crear('header', 'ch-cabecera');
  const avatar = crear('span', 'ch-avatar', o.nombre[0]);
  avatar.setAttribute('aria-hidden', 'true');
  const quien = crear('div', 'ch-quien');
  quien.append(crear('b', '', o.nombre), crear('small', '', o.rol));
  const voz = crear('button', 'ch-boton');
  voz.type = 'button';
  const pintarVoz = (activa: boolean) => {
    voz.textContent = activa ? '🔊' : '🔇';
    voz.setAttribute('aria-label', activa ? 'Silenciar las voces' : 'Activar las voces');
    voz.setAttribute('aria-pressed', String(activa));
  };
  let vozActiva = o.voz;
  pintarVoz(vozActiva);
  voz.addEventListener('click', () => {
    vozActiva = !vozActiva;
    pintarVoz(vozActiva);
    o.alCambiarVoz(vozActiva);
  });
  const cerrar = crear('button', 'ch-boton ch-cerrar');
  cerrar.type = 'button';
  cerrar.append(crear('kbd', '', 'Esc'), crear('span', '', 'Volver'));
  cerrar.setAttribute('aria-label', 'Cerrar la conversación y volver a la partida');
  cerrar.addEventListener('click', () => o.alCerrar());
  cabecera.append(avatar, quien, voz, cerrar);

  const mensajes = crear('div', 'ch-mensajes');
  mensajes.setAttribute('role', 'log');
  mensajes.setAttribute('aria-live', 'polite');
  const alFinal = () => { mensajes.scrollTop = mensajes.scrollHeight; };
  const mensaje = (de: MensajeChat['de'], texto: string) => {
    const el = crear('p', `ch-mensaje ch-${de}`, texto);
    mensajes.appendChild(el);
    alFinal();
    return el;
  };
  for (const m of o.historial) mensaje(m.de, m.texto);

  const sugerencias = crear('div', 'ch-sugerencias');
  const yaHablaron = o.historial.some((m) => m.de === 'jugador');
  if (!yaHablaron) {
    for (const s of o.sugerencias) {
      const chip = crear('button', 'ch-sugerencia', s);
      chip.type = 'button';
      chip.addEventListener('click', () => o.alEnviar(s));
      sugerencias.appendChild(chip);
    }
  }

  const formulario = crear('form', 'ch-entrada');
  const micro = crear('button', 'ch-boton ch-micro', '🎙');
  micro.type = 'button';
  micro.setAttribute('aria-label', 'Hablar por el micrófono');
  micro.addEventListener('click', () => o.alMicrofono());
  const entrada = crear('input', 'ch-texto');
  entrada.type = 'text';
  entrada.maxLength = 400;
  entrada.autocomplete = 'off';
  const pista = `Escribe a ${o.nombre}…`;
  entrada.placeholder = pista;
  entrada.setAttribute('aria-label', `Mensaje para ${o.nombre}`);
  const enviar = crear('button', 'ch-enviar', 'Enviar');
  enviar.type = 'submit';
  formulario.append(micro, entrada, enviar);
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = entrada.value.trim();
    if (!t || enviar.disabled) return;
    entrada.value = '';
    o.alEnviar(t);
  });

  panel.append(cabecera, crear('p', 'ch-pausa', 'La partida espera mientras hablas'), mensajes, sugerencias, formulario);
  fondo.appendChild(panel);
  document.body.appendChild(fondo);

  // Las teclas son del chat, no del juego (el juego anula el espacio y las flechas).
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    o.alCerrar();
  };
  document.addEventListener('keydown', alTeclear, true);

  // En el móvil, enfocar saca el teclado y tapa la conversación.
  const tactil = window.matchMedia?.('(pointer: coarse)').matches;
  const enfocar = () => { if (!tactil) entrada.focus(); };
  enfocar();

  return {
    jugador(texto) {
      sugerencias.replaceChildren();
      mensaje('jugador', texto);
    },
    respuesta() {
      const el = crear('p', 'ch-mensaje ch-personaje ch-esperando');
      el.setAttribute('aria-label', `${o.nombre} está pensando`);
      el.append(crear('i', ''), crear('i', ''), crear('i', ''));
      mensajes.appendChild(el);
      alFinal();
      const poner = (texto: string) => {
        el.classList.remove('ch-esperando');
        el.removeAttribute('aria-label');
        el.textContent = texto;
        alFinal();
      };
      return { escribir: poner, terminar: poner };
    },
    aviso(texto, bien) {
      mensajes.appendChild(crear('p', `ch-aviso ${bien ? 'ch-bien' : 'ch-mal'}`, texto));
      alFinal();
    },
    ocupada(si) {
      enviar.disabled = si;
      for (const b of sugerencias.querySelectorAll('button')) b.disabled = si;
      if (!si) enfocar();
    },
    escuchando(si) {
      micro.classList.toggle('on', si);
      entrada.placeholder = si ? 'Te escucho… toca 🎙 para terminar' : pista;
    },
    quitar() {
      document.removeEventListener('keydown', alTeclear, true);
      fondo.remove();
    },
  };
}
