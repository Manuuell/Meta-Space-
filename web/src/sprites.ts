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
      ctx.fillStyle = y > 25 ? '#a9a3c8' : edge && y < 20 ? '#ffffff' : '#dfe4f4';
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

/** Grano de nieve con grietas de hielo, con semilla fija para que no cambie. */
export function groundTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  let seed = 1971;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Casi blanco: el color lo pone el terreno (nieve, hielo, roca) y esto solo
  // añade grano. Una base oscura lo multiplicaba todo hacia el negro.
  ctx.fillStyle = '#eef2fa';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2600; i++) {
    const v = 200 + rand() * 55;
    ctx.fillStyle = `rgba(${v * 0.9}, ${v * 0.95}, ${v}, ${0.25 + rand() * 0.35})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 3, 1 + rand() * 3);
  }

  ctx.strokeStyle = 'rgba(60, 100, 150, 0.28)';
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
