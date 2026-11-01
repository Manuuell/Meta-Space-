import * as THREE from 'three';

// Arte generado por código, como en la versión de Unity: nada de assets de
// terceros que no se puedan redistribuir.

const PALETTE: Record<string, string> = {
  '.': 'transparent',
  K: '#1b1214', // contorno
  W: '#ece6dc', // traje
  w: '#b9b0a6', // traje en sombra
  V: '#ff9a3c', // visor
  v: '#c4561c', // visor en sombra
  A: '#5ee0ff', // núcleo de ADA en la espalda
  a: '#d8fdff', // brillo del núcleo
  O: '#e8632b', // franja de la misión
  B: '#4a3d3a', // botas y guantes
};

// 16 x 20. Dos fotogramas de paso: solo cambian las piernas.
const BODY = [
  '.....KKKKKK.....',
  '....KWWWWWWK....',
  '...KWWWWWWWWK...',
  '...KWVVVVVVwK...',
  '...KWVVVVVvwK...',
  '...KWwVVVvwwK...',
  '....KWWWWWWK....',
  '..KKKWWOOWWKKK..',
  '.KWWKWWWWWWKAAK.',
  '.KWwKWWWWWWKAAK.',
  '.KWwKWWOOWWKAAK.',
  '.KBBKWWWWWwKKK..',
  '..KK.KWWWWwK....',
  '.....KWwKWwK....',
];
// De espaldas, que es como se ve casi siempre: la mochila con ADA dentro.
const BACK = [
  '.....KKKKKK.....',
  '....KWWWWWWK....',
  '...KWWWWWWWWK...',
  '...KWWWWWWWwK...',
  '...KWWWWWWwwK...',
  '...KwWWWWwwwK...',
  '....KwwwwwwK....',
  '..KKKKKKKKKKKK..',
  '.KWWKBBBBBBKWWK.',
  '.KWwKBAaAABKWwK.',
  '.KWwKBAAAABKWwK.',
  '.KBBKBBBBBBKBBK.',
  '..KK.KWWWWwK.KK.',
  '.....KWwKWwK....',
];
const LEGS_A = [
  '.....KWwKWwK....',
  '.....KWwKWwK....',
  '.....KWwKWwK....',
  '....KBBKKBBK....',
  '....KBBK.KKK....',
  '.....KK.........',
];
const LEGS_B = [
  '.....KWwKWwK....',
  '.....KWwKWwK....',
  '.....KWwKWwK....',
  '....KBBKKBBK....',
  '....KKK.KBBK....',
  '.........KK.....',
];
// Reposo: piernas juntas, firmes.
const LEGS_IDLE = [
  '.....KWwKWwK....',
  '.....KWwKWwK....',
  '.....KWwKWwK....',
  '.....KBBKBBK....',
  '.....KBBKBBK....',
  '.....KK...KK....',
];
// Salto: rodillas encogidas.
const LEGS_JUMP = [
  '.....KWwKWwK....',
  '....KBBKKBBK....',
  '....KBBKKBBK....',
  '.....KKKKK......',
  '................',
  '................',
];

function paint(rows: string[], scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length * scale;
  canvas.height = rows.length * scale;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color || color === 'transparent') return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return canvas;
}

function pixelTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Dos fotogramas de frente y dos de espaldas (legado: lo usa el creador). */
export function astronautFrames(): { front: THREE.Texture[]; back: THREE.Texture[] } {
  const frames = (body: string[]) =>
    [body.concat(LEGS_A), body.concat(LEGS_B)].map((rows) => pixelTexture(paint(rows, 4)));
  return { front: frames(BODY), back: frames(BACK) };
}

export type AstronautClip = 'idle' | 'walk' | 'hurt' | 'salto';

/** Hoja del astronauta por clip y vista, generada por código (arte propio). */
export function astronautAnims(): Record<'back' | 'front', Record<AstronautClip, THREE.Texture[]>> {
  const fila = (body: string[], legs: string[][]) =>
    legs.map((l) => pixelTexture(paint(body.concat(l), 4))) as THREE.Texture[];
  const clips = (body: string[]): Record<AstronautClip, THREE.Texture[]> => ({
    idle: fila(body, [LEGS_IDLE]),
    walk: fila(body, [LEGS_A, LEGS_B]),
    hurt: fila(body, [LEGS_A]),
    salto: fila(body, [LEGS_JUMP]),
  });
  return { front: clips(BODY), back: clips(BACK) };
}

// ------------------------------------------------------------- Decorado
//
// Billboards en píxeles, como las flores y árboles de PokéBonk, pero del
// planeta muerto. Se dibujan con un pincel de un píxel y semilla fija.

function canvasOf(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')!] as const;
}

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

function deadTree(seed: number) {
  const [canvas, ctx] = canvasOf(40, 56);
  const rand = rng(seed);
  const branch = (x: number, y: number, angle: number, length: number, width: number) => {
    for (let i = 0; i < length; i++) {
      x += Math.cos(angle);
      y -= Math.sin(angle);
      angle += (rand() - 0.5) * 0.25;
      ctx.fillStyle = '#2a140f';
      ctx.fillRect(Math.round(x - width / 2), Math.round(y), Math.max(1, Math.round(width)), 1);
      ctx.fillStyle = '#5a2e20';
      ctx.fillRect(Math.round(x - width / 2), Math.round(y), 1, 1);
      if (width > 1.2 && rand() < 0.09) branch(x, y, angle + (rand() < 0.5 ? 0.7 : -0.7), length * 0.55, width * 0.6);
      width = Math.max(1, width * 0.985);
    }
  };
  branch(20, 55, Math.PI / 2 + (rand() - 0.5) * 0.2, 44, 4);
  return canvas;
}

function rock(seed: number) {
  const [canvas, ctx] = canvasOf(32, 22);
  const rand = rng(seed);
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 32; x++) {
      const dx = (x - 16) / 15, dy = (y - 21) / 19;
      const d = dx * dx + dy * dy + (rand() - 0.5) * 0.12;
      if (d > 1 || y > 21) continue;
      const light = 1 - (x / 32) * 0.5 - (y / 22) * 0.4;
      ctx.fillStyle = d > 0.86 ? '#2a1612' : light > 0.65 ? '#b07a5c' : light > 0.45 ? '#8a5642' : '#62382c';
      ctx.fillRect(x, y, 1, 1);
    }
  return canvas;
}

function dryBush(seed: number) {
  const [canvas, ctx] = canvasOf(28, 20);
  const rand = rng(seed);
  for (let i = 0; i < 22; i++) {
    let x = 14 + (rand() - 0.5) * 8, y = 19;
    const lean = (rand() - 0.5) * 1.4;
    const len = 6 + rand() * 12;
    const color = rand() < 0.5 ? '#8a3a20' : '#c0603a';
    for (let j = 0; j < len; j++) {
      x += lean * 0.6;
      y -= 1;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  return canvas;
}

function lampPost() {
  const [canvas, ctx] = canvasOf(20, 64);
  ctx.fillStyle = '#2a1a1a';
  ctx.fillRect(9, 8, 3, 56);
  ctx.fillStyle = '#5a4a48';
  ctx.fillRect(10, 8, 1, 56);
  // Brazo doblado y la lámpara colgando, apagada desde hace siglos.
  ctx.fillStyle = '#2a1a1a';
  ctx.fillRect(9, 6, 8, 3);
  ctx.fillRect(15, 8, 3, 6);
  ctx.fillStyle = '#7a6a50';
  ctx.fillRect(14, 13, 5, 3);
  return canvas;
}

export interface PropKind {
  texture: THREE.Texture;
  width: number;   // metros
  height: number;
}

export function propKinds(): PropKind[] {
  const make = (canvas: HTMLCanvasElement, height: number): PropKind => ({
    texture: pixelTexture(canvas),
    height,
    width: (canvas.width / canvas.height) * height,
  });
  return [
    make(deadTree(11), 6.5),
    make(deadTree(29), 5),
    make(rock(3), 1.6),
    make(rock(8), 1.1),
    make(dryBush(5), 1.1),
    make(dryBush(17), 0.9),
    make(lampPost(), 6),
  ];
}

/** Nube en píxeles: círculos solapados con una base plana. */
export function cloudTexture(seed: number): THREE.Texture {
  const [canvas, ctx] = canvasOf(96, 36);
  const rand = rng(seed);
  const puffs = Array.from({ length: 7 }, () => ({
    x: 14 + rand() * 68, y: 16 + rand() * 10, r: 8 + rand() * 10,
  }));
  for (let y = 0; y < 36; y++)
    for (let x = 0; x < 96; x++) {
      let inside = false, edge = false;
      for (const p of puffs) {
        const d = Math.hypot(x - p.x, (y - p.y) * 1.3);
        if (d < p.r) inside = true;
        if (d < p.r && d > p.r - 2.2) edge = true;
      }
      if (!inside || y > 30) continue;
      ctx.fillStyle = y > 25 ? '#d88a78' : edge && y < 20 ? '#fff0e0' : '#f4c4aa';
      ctx.fillRect(x, y, 1, 1);
    }
  return pixelTexture(canvas);
}

/** Sombra redonda y difusa para pegar bajo cualquier cosa. */
export function blobShadowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/** Grano de arena con grietas, con semilla fija para que no cambie. */
export function groundTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  let seed = 1971;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Casi blanco: el color lo pone el terreno (arena, duna, roca) y esto solo
  // añade grano. Una base oscura lo multiplicaba todo hacia el negro.
  ctx.fillStyle = '#ece4de';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2600; i++) {
    const v = 200 + rand() * 55;
    ctx.fillStyle = `rgba(${v}, ${v * 0.92}, ${v * 0.88}, ${0.25 + rand() * 0.35})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 3, 1 + rand() * 3);
  }

  ctx.strokeStyle = 'rgba(90, 50, 40, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    let x = rand() * size;
    let y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (rand() - 0.5) * 40;
      y += (rand() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
