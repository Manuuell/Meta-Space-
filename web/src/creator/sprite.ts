// META SPACE · FOCO 3 — Utilidades de sprite (DOM: canvas).
//
// - `pintarMapa`: dibuja un mapa de píxeles (preset) en un canvas de 128×128.
// - `generarSpriteProcedural`: respaldo local del modo IMAGEN cuando no hay
//   API de imagen: astronauta/bicho simétrico y determinista por semilla.
// - `quitarFondo`: recorta el fondo (flood-fill desde los bordes).
// - `lienzoAPng`: exporta el canvas a dataURL PNG.

import { hashPrompt, rngFromSeed } from './stats';

export const SPRITE_SIZE = 128;

/** Paleta compartida de los sprites del creador. */
export const PALETA_SPRITE: Record<string, string> = {
  K: '#1b1214', // borde oscuro
  W: '#ece6dc', // traje blanco
  O: '#ff9a3c', // naranja plasma
  C: '#5ee0ff', // cyan de ADA
  R: '#ff5a4a', // rojo HELIOS
  G: '#c9f27a', // verde dron
  P: '#d07bff', // morado interferencia
  Y: '#ffd23a', // amarillo baliza
  D: '#4a4446', // gris chatarra
  B: '#5b8cff', // azul profundo
  N: '#272b40', // azul noche
  M: '#7a4a2a', // marrón segador
};

export function crearLienzo(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  return c;
}

/**
 * Pinta un mapa de caracteres (p. ej. 16×16) escalado a 128×128 con píxeles
 * nítidos. `.` o ` ` = transparente. Devuelve el canvas.
 */
export function pintarMapa(mapa: string[], paleta: Record<string, string> = PALETA_SPRITE): HTMLCanvasElement {
  const lienzo = crearLienzo();
  const ctx = lienzo.getContext('2d')!;
  const filas = mapa.length;
  const columnas = Math.max(...mapa.map((f) => f.length));
  const px = SPRITE_SIZE / columnas;
  const py = SPRITE_SIZE / filas;
  for (let y = 0; y < filas; y++) {
    const fila = mapa[y];
    for (let x = 0; x < fila.length; x++) {
      const ch = fila[x];
      if (ch === '.' || ch === ' ') continue;
      const color = paleta[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x * px), Math.floor(y * py), Math.ceil(px), Math.ceil(py));
    }
  }
  return lienzo;
}

/** Opciones del generador procedural (derivan del prompt). */
export interface OpcionesProcedural {
  semilla: number;
  principal: string; // color del traje / caparazón
  secundario: string; // color de detalles
  visor: string; // color del visor / ojo
  bicho: boolean; // true = antenas y patas; false = astronauta
  corpulento: number; // 0–1: ancho del torso
}

/** Deriva las opciones visuales a partir del texto del jugador. */
export function opcionesDesdePrompt(prompt: string): OpcionesProcedural {
  const semilla = hashPrompt(prompt || 'astronauta');
  const rand = rngFromSeed(semilla);
  const low = prompt.toLowerCase();
  let principal = '#ece6dc';
  if (/rojo|fuego|plasma|furia|magma|guerra|red|fire|dragon|dragón/.test(low)) principal = '#ff5a4a';
  else if (/azul|hielo|rayo|nitro|blue|storm/.test(low)) principal = '#5b8cff';
  else if (/verde|selva|bicho|insecto|green/.test(low)) principal = '#c9f27a';
  else if (/sombra|fantasma|noche|morad|shadow|ghost/.test(low)) principal = '#d07bff';
  else if (/amarillo|dorad|baliza|yellow/.test(low)) principal = '#ffd23a';
  else if (/tanque|acero|muro|roca|golem|titan|gris/.test(low)) principal = '#8a8284';
  const secundarios = ['#ff9a3c', '#5ee0ff', '#c9f27a', '#d07bff', '#ffd23a', '#ff5a4a'];
  const secundario = secundarios[Math.floor(rand() * secundarios.length)];
  const visores = ['#5ee0ff', '#ffd9a8', '#ff5a4a', '#c9f27a'];
  const visor = visorOPorDefecto(low, visores, rand);
  const bicho = /bicho|insecto|araña|arana|bestia|monstruo|alien|bug|swarm|enjambre/.test(low) || rand() < 0.3;
  return { semilla, principal, secundario, visor, bicho, corpulento: 0.4 + rand() * 0.6 };
}

function visorOPorDefecto(low: string, visores: string[], rand: () => number): string {
  if (/ada|cyan|luz|turquesa/.test(low)) return visores[0];
  if (/fuego|rojo|rabia/.test(low)) return visores[2];
  return visores[Math.floor(rand() * visores.length)];
}

/**
 * Dibuja un astronauta/bicho simétrico en pixel-art sobre una cuadrícula de
 * 32×32 escalada a 128×128. Determinista para la misma semilla.
 */
export function generarSpriteProcedural(op: OpcionesProcedural): HTMLCanvasElement {
  const N = 32;
  const rejilla: (string | null)[][] = Array.from({ length: N }, () => Array<string | null>(N).fill(null));
  const rand = rngFromSeed(op.semilla ^ 0x9e3779b9);
  const K = '#1b1214';
  const medio = N / 2;
  const ancho = Math.round(5 + op.corpulento * 4); // medio torso 5–9

  const poner = (x: number, y: number, c: string) => {
    const xi = Math.round(x);
    if (xi < 0 || xi >= N || y < 0 || y >= N) return;
    rejilla[y][xi] = c;
    const espejo = N - 1 - xi; // simetría vertical
    rejilla[y][espejo] = c;
  };
  const lineaH = (x0: number, x1: number, y: number, c: string) => {
    for (let x = x0; x <= x1; x++) poner(x, y, c);
  };

  if (op.bicho) {
    // Antenas.
    const alt = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < alt; i++) {
      poner(medio - 3, 2 + i, K);
      poner(medio - 4 - Math.floor(i / 2), 1 + i, op.secundario);
    }
    // Ojos grandes.
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        poner(medio - 4 + dx, 6 + dy, dx === 1 && dy >= 1 && dy <= 2 ? op.visor : K);
      }
    }
    // Caparazón.
    for (let y = 11; y < 24; y++) {
      const ensanche = Math.round(Math.sin(((y - 11) / 13) * Math.PI) * 2);
      lineaH(medio - ancho - ensanche, medio + ancho + ensanche, y, op.principal);
      poner(medio - ancho - ensanche - 1, y, K);
      if (y % 3 === 0) lineaH(medio - 1, medio + 1, y, op.secundario);
    }
    // Patas.
    for (let p = 0; p < 3; p++) {
      const y = 14 + p * 3;
      for (let i = 0; i < 4; i++) poner(medio - ancho - 2 - i, y + Math.floor(i / 2), K);
    }
  } else {
    // Casco.
    for (let y = 3; y <= 11; y++) {
      const borde = y <= 4 || y >= 10 ? 2 : 1;
      lineaH(medio - 6 + borde, medio + 6 - borde, y, y >= 5 && y <= 8 ? op.visor : op.principal);
      poner(medio - 7 + borde, y, K);
    }
    lineaH(medio - 6, medio + 6, 3, K);
    // Mochila de ADA (brilla en cyan a la espalda).
    for (let y = 13; y <= 19; y++) {
      poner(medio + ancho + 1, y, K);
      poner(medio + ancho + 2, y, y % 2 ? '#5ee0ff' : '#b8f4ff');
    }
    // Torso del traje.
    for (let y = 12; y <= 22; y++) {
      lineaH(medio - ancho, medio + ancho, y, op.principal);
      poner(medio - ancho - 1, y, K);
      if (y === 15) lineaH(medio - 2, medio + 2, y, op.secundario);
      if (y === 19) lineaH(medio - 3, medio + 3, y, K);
    }
    // Piernas y botas.
    for (let y = 23; y <= 29; y++) {
      const sep = y > 26 ? 2 : 1;
      lineaH(medio - ancho + 1, medio - sep, y, op.principal);
      if (y >= 28) {
        lineaH(medio - ancho, medio - 1, y, K);
      }
    }
  }
  // Borde inferior común (sombra de apoyo).
  lineaH(medio - 3, medio + 3, N - 1, K);

  const lienzo = crearLienzo();
  const ctx = lienzo.getContext('2d')!;
  const px = SPRITE_SIZE / N;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const c = rejilla[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(Math.floor(x * px), Math.floor(y * px), Math.ceil(px), Math.ceil(px));
    }
  }
  return lienzo;
}

/**
 * Recorta el fondo: flood-fill desde las cuatro esquinas con tolerancia y lo
 * vuelve transparente. Sirve cuando el jugador dibuja sobre un fondo liso.
 * Devuelve el nº de píxeles recortados.
 */
export function quitarFondo(lienzo: HTMLCanvasElement, tolerancia = 24): number {
  const ctx = lienzo.getContext('2d')!;
  const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  const d = img.data;
  const W = lienzo.width;
  const H = lienzo.height;
  const semilla: Array<[number, number]> = [
    [0, 0],
    [W - 1, 0],
    [0, H - 1],
    [W - 1, H - 1],
  ];
  // Color de referencia: mediana de las esquinas opacas.
  let r0 = 0;
  let g0 = 0;
  let b0 = 0;
  let m = 0;
  for (const [x, y] of semilla) {
    const i = (y * W + x) * 4;
    if (d[i + 3] < 16) continue;
    r0 += d[i];
    g0 += d[i + 1];
    b0 += d[i + 2];
    m++;
  }
  if (m === 0) return 0; // ya es transparente: nada que recortar
  r0 /= m;
  g0 /= m;
  b0 /= m;

  const visto = new Uint8Array(W * H);
  const cerca = (i: number): boolean => {
    const dr = d[i] - r0;
    const dg = d[i + 1] - g0;
    const db = d[i + 2] - b0;
    return dr * dr + dg * dg + db * db <= tolerancia * tolerancia * 3;
  };
  const pila: Array<[number, number]> = semilla.slice();
  let recortados = 0;
  while (pila.length) {
    const [x, y] = pila.pop()!;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (visto[p]) continue;
    visto[p] = 1;
    const i = p * 4;
    if (d[i + 3] < 16 || !cerca(i)) continue;
    d[i + 3] = 0;
    recortados++;
    pila.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(img, 0, 0);
  return recortados;
}

/** Exporta el lienzo a PNG (dataURL). Lanza si el lienzo está vacío. */
export function lienzoAPng(lienzo: HTMLCanvasElement): string {
  const ctx = lienzo.getContext('2d')!;
  const d = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
  let opacos = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] >= 16) opacos++;
  if (opacos === 0) throw new Error('El lienzo está vacío: dibuja algo antes de continuar.');
  return lienzo.toDataURL('image/png');
}

/** Carga una dataURL PNG en un canvas de 128×128 (para analizar dibujos). */
export function pngALienzo(png: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const lienzo = crearLienzo();
      const ctx = lienzo.getContext('2d')!;
      ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      ctx.imageSmoothingEnabled = false;
      const lado = Math.min(img.width, img.height);
      const sx = (img.width - lado) / 2;
      const sy = (img.height - lado) / 2;
      ctx.drawImage(img, sx, sy, lado, lado, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
      resolve(lienzo);
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = png;
  });
}
