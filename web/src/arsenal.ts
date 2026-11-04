import { calcularArsenal, arsenalVacio, probGolpe, type Arsenal, type ObjetoDef } from './objetos.ts';
import type { WeaponId } from './data.ts';
import type { Enemies } from './enemies.ts';
import type { Weapons } from './weapons.ts';
import type { World } from './world.ts';

// META SPACE — Lo que hacen los objetos mientras se juega: estados al golpear,
// reacciones al eliminar y al recibir daño, rastros en el suelo y efectos periódicos.
// Lo que cambia la forma de un arma (rebotes, racimos…) lo lee `Weapons` de `fx`.
//
// Una reacción nunca provoca otra: `enReaccion` lo corta. Si no, una chispa que
// quema, que hace saltar otra chispa, acabaría con el fotograma.

export interface EventosObjetos {
  curar: (cantidad: number) => void;
  nivel: () => number;
  chatarra: () => number;
  sonido: (nombre: 'zap' | 'boom' | 'relic') => void;
  aviso: (quien: string, texto: string) => void;
}

interface Rastro {
  x: number;
  z: number;
  radio: number;
  dano: number;
  hasta: number;
  tic: number;
  hielo: boolean;
}

const MAX_RASTROS = 34;
const COLOR = { fuego: '#ff8a3d', hielo: '#a8ecff', veneno: '#7dff5a', rayo: '#fff27a' };

export class ObjetosEnJuego {
  lista: ObjetoDef[] = [];
  arsenal: Arsenal = arsenalVacio();
  private tiempo = 0;
  private enReaccion = false;
  private rastros: Rastro[] = [];
  private bajas = 0;
  private proximoRastro = 0;
  private proximoRayo = 0;
  private proximaSobrecarga = 0;
  private proximoEscudo = 0;
  private escudoListo = false;
  private proximaOnda = 0;
  private voluntadGastada = false;
  private quieto = 0;
  private moviendo = false;
  private omitir = new Set<number>();

  constructor(
    private armas: Weapons,
    private enemigos: Enemies,
    private mundo: World,
    private eventos: EventosObjetos,
  ) {}

  get fx() {
    return this.arsenal.fx;
  }

  tiene(id: string) {
    return this.lista.some((o) => o.id === id);
  }

  agregar(def: ObjetoDef) {
    this.lista.push(def);
    this.arsenal = calcularArsenal(this.lista);
    this.armas.fx = this.arsenal.fx;
    this.armas.sincronizarDrones();
    this.enemigos.multHielo = 1 + this.fx.danoCongelados;
    if (this.fx.escudo && !this.proximoEscudo) this.escudoListo = true;
  }

  /** Daño de las reacciones: crece con el nivel, y `Weapons` le suma los multiplicadores. */
  private get base() {
    return 8 + this.eventos.nivel() * 2;
  }

  /** Multiplicador de daño que cambia según lo que estés haciendo. */
  multDano() {
    const fx = this.fx;
    let m = 1;
    if (fx.quietoDano && this.quieto > 0.6) m += fx.quietoDano;
    if (fx.movilDano && this.moviendo) m += fx.movilDano;
    if (fx.chatarraDano) m += Math.min(0.4, this.eventos.chatarra() / 500) * fx.chatarraDano;
    return m;
  }

  alGolpear(arma: WeaponId, i: number, dano: number, critico: boolean) {
    if (this.enReaccion) return;
    const a = this.arsenal, e = this.enemigos, fx = this.fx;
    this.enReaccion = true;
    const x = e.x[i], z = e.z[i];
    const sale = (k: 'quemar' | 'envenenar' | 'congelar' | 'chispa' | 'marcar' | 'doble') => {
      const p = probGolpe(a, arma, k);
      return p > 0 && Math.random() < p;
    };
    if (sale('quemar')) e.prender(i, 3, Math.max(3, dano * 0.4));
    if (sale('envenenar')) e.envenenar(i, 5, Math.max(2, dano * 0.22));
    if (sale('congelar')) e.congelar(i, 1.2);
    if (sale('marcar')) e.marca[i] = Math.max(e.marca[i], 4);
    if (sale('doble')) this.armas.golpeSuelto(arma, i, dano);
    if (sale('chispa')) {
      this.omitir.clear();
      this.omitir.add(i);
      const j = e.nearest(x, z, 7, this.omitir);
      if (j >= 0) {
        this.armas.golpeSuelto(arma, j, dano * 0.6);
        this.armas.rayoEntre(x, z, e.x[j], e.z[j]);
      }
    }
    if (critico) {
      if (fx.critQuema) e.prender(i, 3, Math.max(4, dano * 0.5));
      if (fx.critEstalla && Math.random() < fx.critEstalla) this.armas.estallido(x, z, 2.4, dano * 0.3, '#ffd9a0');
      if (fx.critRecarga) this.armas.acortarRecargas(fx.critRecarga);
    }
    this.enReaccion = false;
  }

  /** Llamar cuando el enemigo i cae, antes de quitarlo. */
  alMatar(i: number) {
    if (!this.lista.length) return;
    const fx = this.fx, e = this.enemigos, x = e.x[i], z = e.z[i];
    this.enReaccion = true;
    if (fx.estallar && Math.random() < fx.estallar) this.armas.estallido(x, z, 2.8, this.base, COLOR.fuego);
    if (fx.esquirlas && Math.random() < fx.esquirlas) {
      const a0 = Math.random() * 6.28;
      for (let k = 0; k < 3; k++) this.armas.disparoLibre(x, z, a0 + (k * Math.PI * 2) / 3, this.base * 0.7);
    }
    if (fx.curarAlMatar && Math.random() < fx.curarAlMatar) this.eventos.curar(3);
    if (fx.contagio && e.veneno[i] > 0) {
      e.forEachInRadius(x, z, 3.5, (j) => e.envenenar(j, 4, e.venenoDps[i]));
      this.armas.efectos.anillo(x, this.mundo.heightAt(x, z) + 0.1, z, { color: COLOR.veneno, duracion: 0.35, desde: 0.6, hasta: 3.5 });
    }
    if (fx.gravedadAlMatar) e.forEachInRadius(x, z, 5, (j) => e.tirarDe(j, x, z, 5));
    if (fx.rayoCadaBajas && ++this.bajas >= fx.rayoCadaBajas) {
      this.bajas = 0;
      this.rayo(x, z, 4.5, this.base * 2.4);
    }
    this.enReaccion = false;
  }

  /** Rayo del cielo: columna de luz y daño en círculo. */
  private rayo(x: number, z: number, radio: number, dano: number) {
    const y = this.mundo.heightAt(x, z);
    this.armas.efectos.columna(x, y, z, 60, { color: COLOR.rayo, duracion: 0.28, desde: 0.3, hasta: 1 });
    this.armas.estallido(x, z, radio, dano, COLOR.rayo);
    this.eventos.sonido('zap');
  }

  /** Suelo que quema o que hiela. */
  rastro(x: number, z: number, radio: number, dano: number, segundos: number, hielo = false) {
    if (this.rastros.length >= MAX_RASTROS) this.rastros.shift();
    this.rastros.push({ x, z, radio, dano, hasta: this.tiempo + segundos, tic: 0, hielo });
    this.armas.efectos.disco(x, this.mundo.heightAt(x, z) + 0.12, z, {
      color: hielo ? COLOR.hielo : COLOR.fuego, duracion: segundos, desde: radio, hasta: radio * 1.06, opacidad: 0.34,
    });
  }

  update(dt: number, px: number, pz: number, moviendo: boolean, fraccionVida: number) {
    this.tiempo += dt;
    this.moviendo = moviendo;
    this.quieto = moviendo ? 0 : this.quieto + dt;
    this.enemigos.freno = this.fx.relojRoto && fraccionVida < 1 / 3 ? 0.5 : 1;
    if (!this.lista.length) return;
    const fx = this.fx, e = this.enemigos;

    if ((fx.estelaFuego || fx.estelaHielo) && moviendo && this.tiempo >= this.proximoRastro) {
      this.proximoRastro = this.tiempo + 0.42;
      if (fx.estelaFuego) this.rastro(px, pz, 1.5, this.base * 0.5, 2.6);
      if (fx.estelaHielo) this.rastro(px, pz, 1.8, 0, 3, true);
    }
    for (let k = this.rastros.length - 1; k >= 0; k--) {
      const r = this.rastros[k];
      if (this.tiempo >= r.hasta) {
        this.rastros.splice(k, 1);
        continue;
      }
      r.tic -= dt;
      if (r.tic > 0) continue;
      r.tic = 0.35;
      e.forEachInRadius(r.x, r.z, r.radio, (i) => {
        if (r.hielo) {
          e.slow[i] = 0.6;
          e.slowFactor[i] = 0.4;
        } else {
          e.prender(i, 1.6, Math.max(3, r.dano));
        }
      });
    }
    if (fx.pararrayos && this.tiempo >= this.proximoRayo) {
      this.proximoRayo = this.tiempo + fx.pararrayos;
      let mejor = -1, vida = 0;
      e.forEachInRadius(px, pz, 15, (i) => {
        if (e.hp[i] > vida) {
          vida = e.hp[i];
          mejor = i;
        }
      });
      if (mejor >= 0) this.rayo(e.x[mejor], e.z[mejor], 3, this.base * 1.8);
    }
    if (fx.sobrecarga && this.tiempo >= this.proximaSobrecarga) {
      this.proximaSobrecarga = this.tiempo + fx.sobrecarga;
      this.armas.activarSobrecarga(6, px, pz);
    }
    if (fx.escudo && !this.escudoListo && this.tiempo >= this.proximoEscudo) {
      this.escudoListo = true;
      this.armas.efectos.hexagono(px, this.mundo.heightAt(px, pz) + 0.15, pz, { color: '#7dffc8', duracion: 0.4, desde: 0.5, hasta: 1.8 });
    }
  }

  /** Te golpean: devuelve el daño que queda tras escudos y reacciones. */
  alRecibir(cantidad: number, px: number, pz: number) {
    if (!this.lista.length || cantidad <= 0) return cantidad;
    const fx = this.fx, e = this.enemigos;
    // Lo que muerde un poco cada fotograma no debería gastar un escudo entero.
    if (cantidad >= 2) {
      if (this.escudoListo) {
        this.escudoListo = false;
        this.proximoEscudo = this.tiempo + fx.escudo;
        this.armas.efectos.hexagono(px, this.mundo.heightAt(px, pz) + 1, pz, { color: '#7dffc8', duracion: 0.35, desde: 1.8, hasta: 0.4 });
        return 0;
      }
      if (fx.ondaAlRecibir && this.tiempo >= this.proximaOnda) {
        this.proximaOnda = this.tiempo + 3;
        e.forEachInRadius(px, pz, 6, (i) => e.tirarDe(i, px, pz, -9));
        this.armas.efectos.anillo(px, this.mundo.heightAt(px, pz) + 0.1, pz, { color: '#ffd9a0', duracion: 0.3, desde: 0.6, hasta: 6, grueso: true });
      }
      if (fx.espejo && this.tiempo >= this.proximaOnda - 2) {
        this.omitir.clear();
        for (let k = 0; k < 3; k++) {
          const j = e.nearest(px, pz, 11, this.omitir);
          if (j < 0) break;
          this.omitir.add(j);
          this.armas.golpeSuelto('arco', j, this.base * 1.2);
          this.armas.rayoEntre(px, pz, e.x[j], e.z[j]);
        }
        this.proximaOnda = Math.max(this.proximaOnda, this.tiempo + 2);
      }
    }
    return cantidad;
  }

  /** El pulso y la interferencia también reparan (Retroalimentación, Sifón). */
  curarPorPulso(cantidad: number) {
    if (cantidad > 0) this.eventos.curar(cantidad);
  }

  /** Última voluntad: una vez por sector. */
  salvarse() {
    if (!this.fx.ultimaVoluntad || this.voluntadGastada) return false;
    this.voluntadGastada = true;
    this.eventos.sonido('relic');
    this.eventos.aviso('Última voluntad', 'El traje se negó a apagarse. Te queda un tercio de integridad.');
    return true;
  }
}
