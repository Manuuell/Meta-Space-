import * as THREE from 'three';
import { MODULOS, type DefModulo, type ModuloId } from './objetos.ts';
import type { ContextoHabilidad } from './habilidades.ts';

// META SPACE — Módulos: habilidades activas que se encuentran por el sector. Los
// operadores tienen su habilidad (R); los módulos ocupan dos ranuras más (G y C), y
// cada partida acaba con un par distinto. Si no caben, el nuevo sustituye al más
// antiguo. El módulo que se usa se queda haciendo su trabajo en `activos`.

const TAU = Math.PI * 2;
const ROSA = '#ff8ad0', CIAN = '#5ee0ff', FUEGO = '#ff8a3d', HIELO = '#a8ecff', OCRE = '#ffd9a0';

interface Activo {
  t: number;
  hasta: number;
  /** Se llama cada fotograma con el tiempo transcurrido y el paso. */
  paso: (t: number, dt: number, c: ContextoHabilidad) => void;
  fin?: (c: ContextoHabilidad) => void;
}

export interface Ranura {
  def: DefModulo;
  restante: number;
}

/** Punto a `metros` delante del jugador, según mira la cámara. */
function delante(c: ContextoHabilidad, metros: number) {
  return {
    x: c.posicion.x - Math.sin(c.yawCamara) * metros,
    z: c.posicion.z - Math.cos(c.yawCamara) * metros,
  };
}

const altura = (c: ContextoHabilidad, x: number, z: number) => c.mundo.heightAt(x, z) + 0.12;

export class Modulos {
  ranuras: (Ranura | null)[] = [null, null];
  private activos: Activo[] = [];

  /** Monta un módulo. Devuelve en qué ranura ha quedado. */
  montar(id: ModuloId) {
    const def = MODULOS.find((m) => m.id === id)!;
    const libre = this.ranuras.findIndex((r) => !r);
    const k = libre >= 0 ? libre : this.ranuras.reduce((v, r, j) => (r!.restante > this.ranuras[v]!.restante ? j : v), 0);
    this.ranuras[k] = { def, restante: 0 };
    return k;
  }

  /** Lo que pinta el HUD: nombre, color y cuánta recarga falta. */
  get estado() {
    return this.ranuras.map((r) => (r ? { id: r.def.id, nombre: r.def.nombre, lista: 1 - r.restante / r.def.recarga } : null));
  }

  usar(k: number, c: ContextoHabilidad) {
    const r = this.ranuras[k];
    if (!r || r.restante > 0) return false;
    r.restante = r.def.recarga;
    this.lanzar(r.def.id, c);
    c.sacudida();
    return true;
  }

  update(dt: number, c: ContextoHabilidad) {
    for (const r of this.ranuras) if (r) r.restante = Math.max(0, r.restante - dt);
    for (let k = this.activos.length - 1; k >= 0; k--) {
      const a = this.activos[k];
      a.t += dt;
      a.paso(a.t, dt, c);
      if (a.t >= a.hasta) {
        a.fin?.(c);
        this.activos.splice(k, 1);
      }
    }
  }

  private durante(segundos: number, paso: Activo['paso'], fin?: Activo['fin']) {
    this.activos.push({ t: 0, hasta: segundos, paso, fin });
  }

  private lanzar(id: ModuloId, c: ContextoHabilidad) {
    const fx = c.armas.efectos, e = c.enemigos, p = c.posicion;
    switch (id) {
      case 'pozo': {
        const { x, z } = delante(c, 9), r = 11;
        fx.disco(x, altura(c, x, z), z, { color: ROSA, duracion: 3, desde: 2, hasta: r, opacidad: 0.3 });
        fx.anillo(x, altura(c, x, z), z, { color: ROSA, duracion: 3, desde: r, hasta: 1, grueso: true });
        this.durante(3, (_t, _dt, q) => {
          q.enemigos.forEachInRadius(x, z, r, (i) => q.enemigos.tirarDe(i, x, z, 2.2));
        }, (q) => q.armas.estallido(x, z, 7, 70, ROSA));
        c.sfx('carga');
        break;
      }
      case 'fase':
        c.hacerIntocable(3);
        c.temporal?.('velocidad', 3, 1.4);
        fx.hexagono(p.x, altura(c, p.x, p.z), p.z, { color: CIAN, duracion: 3, desde: 1.4, hasta: 2, opacidad: 0.6 });
        c.sfx('relic');
        break;
      case 'salto': {
        const desde = { x: p.x, z: p.z };
        const hasta = c.mundo.resolve(delante(c, 14).x, delante(c, 14).z, 0.6, { x: 0, z: 0 });
        c.armas.estallido(desde.x, desde.z, 4, 42, CIAN);
        c.moverA(hasta.x, hasta.z);
        c.armas.estallido(hasta.x, hasta.z, 4, 42, CIAN);
        c.hacerIntocable(0.5);
        c.sfx('carga');
        break;
      }
      case 'meteoros':
        for (let k = 0; k < 12; k++) {
          const cae = 0.15 + k * 0.26;
          let hecho = false;
          this.durante(cae + 0.02, (t, _dt, q) => {
            if (hecho || t < cae) return;
            hecho = true;
            const j = q.enemigos.nearest(q.posicion.x + (Math.random() - 0.5) * 16, q.posicion.z + (Math.random() - 0.5) * 16, 14);
            const a = Math.random() * TAU;
            const x = j >= 0 ? q.enemigos.x[j] : q.posicion.x + Math.cos(a) * 9;
            const z = j >= 0 ? q.enemigos.z[j] : q.posicion.z + Math.sin(a) * 9;
            q.armas.efectos.columna(x, q.mundo.heightAt(x, z), z, 40, { color: FUEGO, duracion: 0.22, desde: 0.5, hasta: 1 });
            q.armas.estallido(x, z, 3.4, 46, FUEGO);
          });
        }
        c.sfx('boom');
        break;
      case 'senuelo': {
        const { x, z } = delante(c, 7);
        e.atraer(x, z, 6);
        fx.columna(x, c.mundo.heightAt(x, z), z, 7, { color: CIAN, duracion: 6, desde: 0.8, hasta: 1, opacidad: 0.5 });
        fx.anillo(x, altura(c, x, z), z, { color: CIAN, duracion: 6, desde: 1.5, hasta: 3.5 });
        this.durante(6, () => {}, (q) => q.armas.estallido(x, z, 6, 80, CIAN));
        c.sfx('carga');
        break;
      }
      case 'cero':
        e.forEachInRadius(p.x, p.z, 13, (i) => e.congelar(i, 3));
        c.aturdirJefes(p.x, p.z, 13, 1);
        fx.anillo(p.x, altura(c, p.x, p.z), p.z, { color: HIELO, duracion: 0.5, desde: 1, hasta: 13, grueso: true });
        fx.disco(p.x, altura(c, p.x, p.z), p.z, { color: HIELO, duracion: 0.9, desde: 13, hasta: 13, opacidad: 0.3 });
        c.sfx('relic');
        break;
      case 'nano':
        this.durante(6, (_t, dt, q) => q.curar(10 * dt));
        fx.hexagono(p.x, altura(c, p.x, p.z), p.z, { color: '#7dffa0', duracion: 6, desde: 1.2, hasta: 2.4, opacidad: 0.5 });
        c.sfx('relic');
        break;
      case 'iman':
        c.atraerChatarra?.();
        fx.anillo(p.x, altura(c, p.x, p.z), p.z, { color: OCRE, duracion: 0.6, desde: 20, hasta: 1, grueso: true });
        c.sfx('carga');
        break;
      case 'crono':
        this.durante(6, (_t, _dt, q) => {
          q.enemigos.forEachInRadius(q.posicion.x, q.posicion.z, 26, (i) => {
            q.enemigos.slow[i] = 0.2;
            q.enemigos.slowFactor[i] = 0.33;
          });
        });
        fx.disco(p.x, altura(c, p.x, p.z), p.z, { color: '#b8c8ff', duracion: 6, desde: 26, hasta: 26, opacidad: 0.12 });
        c.sfx('carga');
        break;
      case 'haz': {
        const a = new THREE.Vector3(), b = new THREE.Vector3();
        let tic = 0;
        this.durante(2, (_t, dt, q) => {
          tic -= dt;
          if (tic > 0) return;
          tic = 0.18;
          const px = q.posicion.x, pz = q.posicion.z;
          const fin = delante(q, 24);
          a.set(px, q.mundo.heightAt(px, pz) + 1.1, pz);
          b.set(fin.x, q.mundo.heightAt(fin.x, fin.z) + 1.1, fin.z);
          q.armas.efectos.rayo(a, b, 0.6, { color: '#fff6c8', duracion: 0.2 });
          for (let d = 3; d <= 24; d += 4) {
            const m = delante(q, d);
            q.armas.danoHabilidad(m.x, m.z, 2.4, 11, 0.2);
          }
        });
        c.sfx('solar');
        break;
      }
      case 'torre': {
        const { x, z } = delante(c, 3);
        fx.columna(x, c.mundo.heightAt(x, z), z, 3.2, { color: '#d07bff', duracion: 10, desde: 0.5, hasta: 0.5, opacidad: 0.7 });
        fx.hexagono(x, altura(c, x, z), z, { color: '#d07bff', duracion: 10, desde: 1.4, hasta: 1.4 });
        let tic = 0;
        this.durante(10, (_t, dt, q) => {
          tic -= dt;
          if (tic > 0) return;
          tic = 0.32;
          const j = q.enemigos.nearest(x, z, 15);
          if (j >= 0) q.armas.disparoLibre(x, z, Math.atan2(q.enemigos.z[j] - z, q.enemigos.x[j] - x), 15, 15);
        });
        c.sfx('carga');
        break;
      }
      case 'onda':
        e.forEachInRadius(p.x, p.z, 12, (i) => e.tirarDe(i, p.x, p.z, -22));
        c.armas.danoHabilidad(p.x, p.z, 12, 34, 1);
        fx.anillo(p.x, altura(c, p.x, p.z), p.z, { color: OCRE, duracion: 0.4, desde: 1, hasta: 12, grueso: true });
        c.sfx('boom');
        break;
    }
  }
}
