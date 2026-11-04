import test from 'node:test';
import assert from 'node:assert/strict';

// input.ts se engancha a window y document al importarse: se montan antes unos
// dobles con lo justo. Node trae Event y EventTarget, pero no el DOM.
class EventoRaton extends Event {
  movementX: number;
  movementY: number;
  button: number;
  constructor(tipo: string, o: { movementX?: number; movementY?: number; button?: number; bubbles?: boolean } = {}) {
    super(tipo, o);
    this.movementX = o.movementX ?? 0;
    this.movementY = o.movementY ?? 0;
    this.button = o.button ?? 0;
  }
}

class Nodo extends EventTarget {
  id = '';
  className = '';
  innerHTML = '';
  style: Record<string, string> = {};
  parentElement: Nodo | null = null;
  clases = new Set<string>();
  classList = { add: (c: string) => this.clases.add(c), remove: (c: string) => this.clases.delete(c) };
  recibido: string[] = [];
  constructor() {
    super();
    for (const tipo of ['pointerdown', 'pointerup', 'click']) this.addEventListener(tipo, () => this.recibido.push(tipo));
  }
  closest() { return this; }
  contains(otro: Nodo) { return otro === this; }
  remove() {}
}

const lienzo = new Nodo(), boton = new Nodo();
const doc = Object.assign(new EventTarget(), {
  pointerLockElement: null as Nodo | null,
  elementFromPoint: () => boton,
  createElement: () => new Nodo(),
  body: { appendChild() {} },
});
const g = globalThis as unknown as Record<string, unknown>;
g.window = Object.assign(new EventTarget(), { innerWidth: 1000, innerHeight: 800 });
g.document = doc;
g.MouseEvent = EventoRaton;
g.PointerEvent = EventoRaton;

const { abrirCursor, consumeLook, lockPointer } = await import('../src/input.ts');
const ventana = g.window as EventTarget;
const canvas = lienzo as unknown as HTMLCanvasElement;
const mover = (dx: number) => ventana.dispatchEvent(new EventoRaton('mousemove', { movementX: dx }));

test('cursor: sin ratón capturado no sale y mover sigue siendo cosa del de verdad', () => {
  doc.pointerLockElement = null;
  abrirCursor();
  mover(40);
  assert.equal(consumeLook(0).x, 0);
});

test('cursor: mientras eliges, mover el ratón no gira la cámara', () => {
  doc.pointerLockElement = lienzo;
  abrirCursor();
  mover(120);
  assert.equal(consumeLook(0).x, 0, 'al cerrar las tarjetas la cámara daría un salto');
  assert.ok(boton.clases.has('cursor-encima'), 'con el ratón capturado no hay :hover');
});

test('cursor: el clic llega a lo que hay debajo', () => {
  boton.recibido.length = 0;
  ventana.dispatchEvent(new EventoRaton('mousedown'));
  ventana.dispatchEvent(new EventoRaton('mouseup'));
  assert.deepEqual(boton.recibido, ['pointerdown', 'pointerup', 'click']);
});

test('cursor: al volver a jugar desaparece y el ratón gira la cámara otra vez', () => {
  lockPointer(canvas);
  assert.ok(!boton.clases.has('cursor-encima'));
  mover(30);
  assert.equal(consumeLook(0).x, 30);
});

test('cursor: si el navegador suelta el ratón, manda otra vez el de verdad', () => {
  abrirCursor();
  doc.pointerLockElement = null;
  doc.dispatchEvent(new Event('pointerlockchange'));
  doc.pointerLockElement = lienzo;
  mover(25);
  assert.equal(consumeLook(0).x, 25);
});
