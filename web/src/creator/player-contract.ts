// META SPACE · FOCO 3 — Contrato de integración con `Game`.
//
// Cómo el sprite y el JSON del creador entran en la partida como `player`.
// La clase `Game` del proyecto real no se modifica aquí: este módulo define
// el tipo que el creador produce y un adaptador que cualquier `Game`
// compatible acepta sin cambiar su firma pública.

import * as THREE from 'three';
import type { CreatorResult } from './character-creator';
import type { HeroStats } from './stats';

/** Lo que el creador entrega a la partida (estable: no cambiar sin versión). */
export interface CustomHeroConfig {
  version: 1;
  nombre: string;
  /** PNG 128×128 con fondo recortado (dataURL). */
  spritePng: string;
  stats: HeroStats;
  source: 'dibujo' | 'imagen' | 'predefinido';
}

/** Ajuste de partida derivado de los stats (base = constantes de RUN). */
export interface HeroTuning {
  maxHp: number;
  speed: number;
  damageMul: number;
  cooldownMul: number;
  special: HeroStats['special'];
}

export const BASE_RUN = { maxHp: 100, speed: 5.2 } as const;

/** Convierte stats del creador en números de partida. */
export function heroToTuning(stats: HeroStats): HeroTuning {
  return {
    maxHp: stats.hp,
    speed: stats.speed,
    damageMul: stats.damage,
    cooldownMul: stats.fire_rate,
    special: stats.special,
  };
}

/**
 * Superficie mínima que `Game` debe exponer (o aceptar vía `applyCustomHero`).
 * Si el `Game` real aún no la tiene, ver el parche de 5 líneas en CONTRATO.md.
 */
export interface MinimalGame {
  setHeroSprite?(tex: THREE.Texture): void;
  setHeroTuning?(t: HeroTuning): void;
  setHeroName?(nombre: string): void;
}

export function toCustomHero(r: CreatorResult): CustomHeroConfig {
  return { version: 1, nombre: r.nombre, spritePng: r.pngDataUrl, stats: r.stats, source: r.source };
}

/**
 * Carga el PNG en una `THREE.CanvasTexture` con píxeles nítidos y la inyecta
 * en el juego junto con el ajuste. No toca la firma `new Game(canvas)`.
 */
export async function applyCustomHero(game: MinimalGame, heroe: CustomHeroConfig): Promise<void> {
  const tex = await cargarSprite(heroe.spritePng);
  game.setHeroSprite?.(tex);
  game.setHeroTuning?.(heroToTuning(heroe.stats));
  game.setHeroName?.(heroe.nombre);
}

/** Carga la dataURL como textura de sprite (NearestFilter = pixel-art). */
export function cargarSprite(pngDataUrl: string): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const lienzo = document.createElement('canvas');
      lienzo.width = 128;
      lienzo.height = 128;
      const ctx = lienzo.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(lienzo);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    };
    img.onerror = () => reject(new Error('No se pudo cargar el sprite del héroe.'));
    img.src = pngDataUrl;
  });
}
