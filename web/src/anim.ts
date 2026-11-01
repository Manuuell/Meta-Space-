// META SPACE — Sistema de animaciones por catálogo.
//
// Misma idea que el catálogo de sprites de PokéBonk (hoja + clips con fila,
// tamaño de frame, nº de frames y duración por frame), pero con arte 100%
// propio generado por código: nada de assets de terceros.
//
// Un clip: qué fila mirar, de qué tamaño es cada frame, cuántos hay y cuánto
// dura cada uno (ms). `rows` = vistas (0 = espalda, 1 = frente).

export interface AnimClip {
  /** Fila base dentro de la hoja (en píxeles). */
  y: number;
  /** Ancho/alto de cada frame (píxeles). */
  fw: number;
  fh: number;
  /** Frames del clip. */
  n: number;
  /** Vistas (filas por clip). */
  rows: number;
  /** Duración de cada frame (ms). */
  d: number[];
  /** Si false, se queda en el último frame hasta cambiar de clip. */
  loop: boolean;
}

export interface AnimSheet {
  w: number;
  h: number;
  anims: Record<string, AnimClip>;
}

/** Catálogo del astronauta (14×20 por frame, escala ×4 = 56×80). */
export const ASTRONAUT_SHEET: AnimSheet = {
  w: 14,
  h: 20 * 2 * 4,
  anims: {
    idle: { y: 0, fw: 14, fh: 20, n: 1, rows: 2, d: [400], loop: true },
    walk: { y: 40, fw: 14, fh: 20, n: 2, rows: 2, d: [130, 130], loop: true },
    hurt: { y: 80, fw: 14, fh: 20, n: 1, rows: 2, d: [180], loop: false },
    salto: { y: 120, fw: 14, fh: 20, n: 1, rows: 2, d: [200], loop: false },
  },
};

export type AnimClipId = keyof typeof ASTRONAUT_SHEET.anims;

/**
 * Reproductor de clips: avanza por duraciones (como `d[]` del catálogo) y
 * dice qué frame y vista toca. El juego decide el clip (reposo, andar,
 * daño, salto) y el reproductor el frame.
 */
export class AnimPlayer {
  clip: AnimClipId = 'idle';
  row = 0; // 0 = espalda, 1 = frente
  private t = 0;
  private frame = 0;
  private bloqueado = false;

  /** Cambia de clip (los no-loop como `hurt`/`salto` bloquean hasta acabar). */
  play(clip: AnimClipId, row: number) {
    this.row = row;
    if (clip === this.clip && this.bloqueado) return;
    if (clip !== this.clip) {
      this.clip = clip;
      this.frame = 0;
      this.t = 0;
      this.bloqueado = !ASTRONAUT_SHEET.anims[clip].loop;
    }
  }

  /** Avanza y devuelve [frame, terminado]. */
  update(dt: number): [number, boolean] {
    const c = ASTRONAUT_SHEET.anims[this.clip];
    this.t += dt * 1000;
    let d = c.d[Math.min(this.frame, c.d.length - 1)];
    while (this.t >= d) {
      this.t -= d;
      if (this.frame + 1 < c.n) {
        this.frame++;
      } else if (c.loop) {
        this.frame = 0;
      } else {
        this.bloqueado = false;
        return [this.frame, true];
      }
      d = c.d[Math.min(this.frame, c.d.length - 1)];
    }
    return [this.frame, false];
  }
}
