import * as THREE from 'three';

// Números de daño: cada golpe se ve saltar del enemigo, como en los
// survivors. Un lienzo 2D encima del juego y debajo del HUD; el juego le pasa
// la cámara cada fotograma y aquí se proyectan y se dibujan. Los críticos
// salen más grandes, en oro y con «!».
//
// Una horda entera dentro del aura daría cientos de números por segundo: los
// golpes pequeños que caen casi en el mismo sitio a la vez se suman en uno, y
// por encima de MAX solo entran los críticos.

const MAX = 90;
const VIDA = 0.75;
/** Golpes a menos de esto (m) y más jóvenes que JUNTAR (s) se suman. */
const CERCA = 0.7;
const JUNTAR = 0.12;

interface Numero {
  x: number;
  y: number;
  z: number;
  valor: number;
  critico: boolean;
  edad: number;
  deriva: number;
}

export class NumerosDano {
  private lienzo: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private vivos: Numero[] = [];
  private v = new THREE.Vector3();
  private ancho = 0;
  private alto = 0;

  constructor(juego: HTMLCanvasElement) {
    this.lienzo = document.createElement('canvas');
    this.lienzo.className = 'numeros-dano';
    this.lienzo.setAttribute('aria-hidden', 'true');
    this.lienzo.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    juego.after(this.lienzo);
    this.ctx = this.lienzo.getContext('2d')!;
  }

  sumar(x: number, y: number, z: number, valor: number, critico: boolean) {
    if (valor < 0.5) return;
    if (!critico) {
      for (const n of this.vivos) {
        if (!n.critico && n.edad < JUNTAR && Math.abs(n.x - x) < CERCA && Math.abs(n.z - z) < CERCA) {
          n.valor += valor;
          return;
        }
      }
      if (this.vivos.length >= MAX) return;
    } else if (this.vivos.length >= MAX) {
      this.vivos.shift();
    }
    this.vivos.push({ x, y, z, valor, critico, edad: 0, deriva: (Math.random() - 0.5) * 30 });
  }

  limpiar() {
    this.vivos.length = 0;
    this.ctx.clearRect(0, 0, this.lienzo.width, this.lienzo.height);
  }

  dibujar(dt: number, camara: THREE.Camera) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (w !== this.ancho || h !== this.alto) {
      this.ancho = w;
      this.alto = h;
      this.lienzo.width = Math.round(w * dpr);
      this.lienzo.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    let quedan = 0;
    for (const n of this.vivos) {
      n.edad += dt;
      if (n.edad >= VIDA) continue;
      this.vivos[quedan++] = n;
      this.v.set(n.x, n.y, n.z).project(camara);
      if (this.v.z > 1) continue;
      const t = n.edad / VIDA;
      // Salta hacia arriba con un rebote y se desvanece al final.
      const sx = (this.v.x + 1) / 2 * w + n.deriva * t;
      const sy = (1 - this.v.y) / 2 * h - 46 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2);
      const escala = n.critico ? 1 + 0.5 * Math.max(0, 1 - t * 5) : 1 + 0.25 * Math.max(0, 1 - t * 6);
      const tam = (n.critico ? 28 : 19) * escala * (n.valor >= 100 ? 1.15 : 1);
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.font = `900 ${tam.toFixed(0)}px Rubik, system-ui, sans-serif`;
      const texto = Math.round(n.valor) + (n.critico ? '!' : '');
      ctx.lineWidth = n.critico ? 6 : 4.5;
      ctx.strokeStyle = '#16111f';
      ctx.strokeText(texto, sx, sy);
      ctx.fillStyle = n.critico ? '#ffd25a' : n.valor >= 40 ? '#ffb38a' : '#ffffff';
      ctx.fillText(texto, sx, sy);
    }
    this.vivos.length = quedan;
    ctx.globalAlpha = 1;
  }
}
