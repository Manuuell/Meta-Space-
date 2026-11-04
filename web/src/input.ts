// Teclado, ratón y táctil. El resto del juego solo pregunta por el vector de
// movimiento, por cuánto se ha girado la cámara y por las pulsaciones sueltas.

const held = new Set<string>();
const pressed = new Set<string>();

/**
 * Piloto automático (modo demo): mueve con un stick propio y mantiene teclas
 * como si las pulsara el jugador. El juego lo enciende con `?demo=jefes`.
 */
export const piloto = { activo: false, x: 0, y: 0, teclas: new Set<string>() };

window.addEventListener('keydown', (e) => {
  if (!held.has(e.code)) pressed.add(e.code);
  held.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

/** True una sola vez por pulsación. Se vacía al final de cada fotograma. */
export function wasPressed(...codes: string[]) {
  return codes.some((c) => pressed.has(c));
}

/** True mientras la tecla siga pulsada. */
export function isHeld(...codes: string[]) {
  return codes.some((c) => held.has(c) || piloto.activo && piloto.teclas.has(c));
}

export function endFrame() {
  pressed.clear();
  ratonNuevo.clear();
}

// ------------------------------------------------------------ Ratón
//
// Botones del ratón para el Cañón solar: el derecho apunta y el izquierdo
// dispara. El menú contextual no sale sobre el juego.

const ratonPulsado = new Set<number>();
const ratonNuevo = new Set<number>();

window.addEventListener('mousedown', (e) => {
  ratonPulsado.add(e.button);
  ratonNuevo.add(e.button);
});
window.addEventListener('mouseup', (e) => ratonPulsado.delete(e.button));
window.addEventListener('blur', () => ratonPulsado.clear());
window.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement).id === 'game' || document.pointerLockElement) e.preventDefault();
});

/** True mientras el botón siga pulsado (0 izquierdo, 2 derecho). */
export function ratonHeld(boton: number) {
  return ratonPulsado.has(boton);
}

/** True una sola vez por clic. */
export function ratonPressed(boton: number) {
  return ratonNuevo.has(boton);
}

// ------------------------------------------------------- Cursor del juego
//
// Cada captura del ratón hace que Safari saque su tira de «pulsa Esc», y mientras
// se ve la primera Esc solo sirve para cerrarla. Por eso el ratón real solo sale en
// el menú de pausa: en las tarjetas y el mapa sigue capturado y mueve este cursor,
// que entrega a lo que tenga debajo lo mismo que entregaría el de verdad.

let cursor: HTMLElement | null = null;
let cursorX = 0, cursorY = 0;
/** El botón que se resalta y dónde empezó la pulsación en curso. */
let encima: Element | null = null;
let pulsado: Element | null = null;

const FLECHA = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 2v21l5.6-5.1 3.6 8.3 4.3-1.9-3.6-8.1H21z"/></svg>';

const bajoCursor = () => document.elementFromPoint(cursorX, cursorY);

function enviarPuntero(destino: Element | null, tipo: string, botones: number) {
  destino?.dispatchEvent(new PointerEvent(tipo, {
    bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    clientX: cursorX, clientY: cursorY, button: 0, buttons: botones,
  }));
}

function moverCursor(dx: number, dy: number) {
  if (!cursor) return;
  cursorX = Math.max(0, Math.min(window.innerWidth - 1, cursorX + dx));
  cursorY = Math.max(0, Math.min(window.innerHeight - 1, cursorY + dy));
  cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
  // Con el ratón capturado no hay :hover: el resaltado lo pone esta clase.
  const boton = bajoCursor()?.closest('button') ?? null;
  if (boton !== encima) {
    encima?.classList.remove('cursor-encima');
    boton?.classList.add('cursor-encima');
    encima = boton;
  }
  enviarPuntero(pulsado ?? bajoCursor(), 'pointermove', pulsado ? 1 : 0);
}

/** Saca el cursor del juego. Sin ratón capturado no hace falta: ya está el de verdad. */
export function abrirCursor() {
  if (cursor || !isLocked()) return;
  cursor = document.createElement('div');
  cursor.className = 'cursor-juego';
  cursor.innerHTML = FLECHA;
  cursorX = window.innerWidth / 2;
  cursorY = window.innerHeight / 2;
  cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
  document.body.appendChild(cursor);
}

function cerrarCursor() {
  cursor?.remove();
  cursor = null;
  encima?.classList.remove('cursor-encima');
  encima = pulsado = null;
}

// Una pulsación que se suelta sobre otro hijo del mismo botón sigue siendo un clic
// en el botón, y una pulsación que empieza en el mapa lo sigue hasta soltar.
window.addEventListener('mousedown', (e) => {
  if (!cursor || e.button !== 0) return;
  pulsado = bajoCursor();
  enviarPuntero(pulsado, 'pointerdown', 1);
});
window.addEventListener('mouseup', (e) => {
  if (!cursor || e.button !== 0) return;
  const origen = pulsado, destino = bajoCursor();
  pulsado = null;
  enviarPuntero(origen ?? destino, 'pointerup', 0);
  if (!cursor || !destino) return;
  let comun = origen;
  while (comun && !comun.contains(destino)) comun = comun.parentElement;
  comun?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: cursorX, clientY: cursorY }));
});
window.addEventListener('wheel', (e) => {
  if (!cursor || !e.isTrusted) return;
  bajoCursor()?.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, composed: true, clientX: cursorX, clientY: cursorY, deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode,
  }));
});
// Si el ratón se suelta (Esc en Chrome), manda otra vez el de verdad.
document.addEventListener('pointerlockchange', () => {
  if (!isLocked()) cerrarCursor();
});

// ------------------------------------------------------------ Mirar

// Giro acumulado desde la última consulta, en píxeles de ratón.
const look = { x: 0, y: 0 };
let dragging = false;

/** Captura el puntero (como PokéBonk): necesita un gesto del usuario. */
export function lockPointer(canvas: HTMLCanvasElement) {
  cerrarCursor();
  if (document.pointerLockElement === canvas) return;
  try {
    const result = canvas.requestPointerLock() as unknown;
    // En algunos navegadores devuelve una promesa que falla sin gesto.
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    // Sin captura se puede seguir girando arrastrando con el ratón.
  }
}

export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function isLocked() {
  return document.pointerLockElement !== null;
}

window.addEventListener('mousemove', (e) => {
  if (cursor) moverCursor(e.movementX, e.movementY);
  else if (isLocked() || dragging) {
    look.x += e.movementX;
    look.y += e.movementY;
  }
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && (e.target as HTMLElement).id === 'game') dragging = true;
});
window.addEventListener('mouseup', () => (dragging = false));

/** Devuelve y vacía el giro acumulado. Q y E giran también con el teclado. */
export function consumeLook(dt: number) {
  let x = look.x, y = look.y;
  look.x = look.y = 0;
  if (held.has('KeyQ')) x -= 900 * dt;
  if (held.has('KeyE')) x += 900 * dt;
  return { x, y };
}

// ----------------------------------------------------------- Táctil
//
// Mitad izquierda: joystick anclado donde se apoya el dedo.
// Mitad derecha: arrastrar gira la cámara.

let stickId: number | null = null;
let stickOrigin = { x: 0, y: 0 };
const stick = { x: 0, y: 0 };
let lookId: number | null = null;
let lookLast = { x: 0, y: 0 };

window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  if ((e.target as HTMLElement).closest('button')) return;
  if (e.clientX < window.innerWidth / 2 && stickId === null) {
    stickId = e.pointerId;
    stickOrigin = { x: e.clientX, y: e.clientY };
  } else if (lookId === null) {
    lookId = e.pointerId;
    lookLast = { x: e.clientX, y: e.clientY };
  }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId === stickId) {
    const dx = e.clientX - stickOrigin.x, dy = e.clientY - stickOrigin.y;
    const len = Math.hypot(dx, dy);
    const k = len > 8 ? Math.min(len, 60) / 60 / len : 0;
    stick.x = dx * k;
    stick.y = dy * k;
  } else if (e.pointerId === lookId) {
    look.x += (e.clientX - lookLast.x) * 1.6;
    look.y += (e.clientY - lookLast.y) * 1.6;
    lookLast = { x: e.clientX, y: e.clientY };
  }
});
const release = (e: PointerEvent) => {
  if (e.pointerId === stickId) {
    stickId = null;
    stick.x = stick.y = 0;
  }
  if (e.pointerId === lookId) lookId = null;
};
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);

/**
 * Movimiento relativo a la cámara: x a la derecha, y hacia atrás (como la
 * pantalla: W es y = −1). Longitud ≤ 1.
 */
export function moveVector() {
  let x = 0, y = 0;
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
  if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
  if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
  x += stick.x;
  y += stick.y;
  if (piloto.activo) {
    x += piloto.x;
    y += piloto.y;
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}
