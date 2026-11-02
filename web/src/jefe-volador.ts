import * as THREE from 'three';
import type { World } from './world.ts';
import { crearDragon, TIEMPOS_DRAGON } from './modelos/dragon.ts';
import { halo } from './modelos/brillo.ts';
import { AvisosSuelo, type Aviso } from './avisos.ts';
import { DRAGON } from './contenido/mapa.ts';
import type { EventosGolem, JugadorGolem } from './jefe-golem.ts';

// Dragón del Velo: el jefe volador. Da vueltas sobre el jugador a 15 m y
// ataca desde el aire con avisos en el suelo: bombas de sulfato al pasar por
// encima, aliento en cono desde lo alto y un picado por una franja. En el
// aire solo le llega el Cañón solar (ver `esferas`, que usa el disparo);
// cada vez que pierde un cuarto de vida, o tras unos ataques, se posa unos
// segundos y entonces le pegan todas las herramientas (`posado`).

type Estado = 'llegada' | 'volar' | 'bombas' | 'aliento' | 'picado' | 'aterrizar' | 'posado' | 'despegar' | 'caer';

interface Bomba {
  mesh: THREE.Mesh;
  aviso: Aviso;
  x0: number; y0: number; z0: number;
  x1: number; z1: number;
  t: number;
  dur: number;
}

const MEDIO_CONO = THREE.MathUtils.degToRad(30);
const SULFATO = '#d6ff5a';

export class JefeVolador {
  readonly nombre = DRAGON.nombre;
  readonly vidaMax: number = DRAGON.vida;
  vida: number = DRAGON.vida;
  x: number;
  z: number;
  /** Altura sobre el suelo. */
  alt = 26;
  furia = false;
  derrotado = false;
  terminado = false;

  private raiz: THREE.Group;
  private mixer: THREE.AnimationMixer;
  private acciones = new Map<string, THREE.AnimationAction>();
  private actual = '';
  private giro = 0;
  private alabeo = 0;
  private cabeceo = 0;
  private estado: Estado = 'llegada';
  private t = 0;
  private descanso = 2;
  private ataquesSinPosarse = 0;
  private danoDesdePosarse = 0;
  private ultimo: Estado | null = null;
  private orbitaAng = 0;
  // Datos del ataque en curso.
  private aviso: Aviso | null = null;
  private dx = 0;
  private dz = 1;
  private ox = 0;
  private oz = 0;
  private largo = 0;
  private recorrido = 0;
  private tic = 0;
  private soltadas = 0;
  private golpeado = false;
  private bombas: Bomba[] = [];
  private avisos: AvisosSuelo;
  private sombra: THREE.Mesh;
  private luz: THREE.PointLight;
  private rotor: THREE.Object3D | null;
  private aliento: THREE.Object3D | null;
  private cuerpoNodo: THREE.Object3D;
  private cabezaNodo: THREE.Object3D;
  private latentes: THREE.MeshToonMaterial[] = [];
  private geoBomba = new THREE.IcosahedronGeometry(0.55, 1);
  private v = new THREE.Vector3();
  private scene: THREE.Scene;
  private world: World;
  private eventos: EventosGolem;
  private rand: () => number;

  constructor(scene: THREE.Scene, world: World, x: number, z: number, eventos: EventosGolem = {}, rand: () => number = Math.random) {
    this.scene = scene;
    this.world = world;
    this.eventos = eventos;
    this.rand = rand;
    this.x = x;
    this.z = z;
    this.avisos = new AvisosSuelo(scene, world);
    const modelo = crearDragon();
    this.raiz = modelo.raiz;
    scene.add(this.raiz);
    this.mixer = new THREE.AnimationMixer(this.raiz);
    for (const a of modelo.animaciones) {
      const accion = this.mixer.clipAction(a.clip);
      if (!a.bucle) {
        accion.setLoop(THREE.LoopOnce, 1);
        accion.clampWhenFinished = true;
      }
      this.acciones.set(a.clip.name, accion);
    }
    const latentes = new Set<THREE.MeshToonMaterial>();
    this.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.material.userData.latir) latentes.add(o.material);
    });
    this.latentes = [...latentes];
    this.rotor = this.raiz.getObjectByName('rotor') ?? null;
    this.aliento = this.raiz.getObjectByName('aliento') ?? null;
    this.cuerpoNodo = this.raiz.getObjectByName('cuerpo')!;
    this.cabezaNodo = this.raiz.getObjectByName('cabeza')!;
    this.luz = new THREE.PointLight('#5ee0ff', 50, 40, 1.6);
    this.luz.position.set(0, 2.5, 1);
    this.raiz.add(this.luz);
    // Sombra en el suelo: dice dónde está aunque vuele alto.
    this.sombra = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      color: '#000000', transparent: true, opacity: 0.35, depthWrite: false,
    }));
    scene.add(this.sombra);
    this.reproducir('Volar');
    this.colocar();
    this.eventos.aviso?.('¡El Dragón del Velo llega desde el cielo!');
  }

  /** Posado (o tocando suelo): ahí le llegan todas las herramientas. */
  get posado() {
    return !this.derrotado && (this.estado === 'posado' || this.estado === 'aterrizar' && this.alt < 1.5);
  }

  /** Puntos donde le acierta el Cañón: el cuerpo y la cabeza, que es su punto débil. */
  esferas(): { x: number; y: number; z: number; r: number; debil: boolean }[] {
    if (this.derrotado || this.estado === 'llegada') return [];
    const c = this.cuerpoNodo.getWorldPosition(this.v);
    const cuerpo = { x: c.x, y: c.y, z: c.z, r: 2.6, debil: false };
    const h = this.cabezaNodo.getWorldPosition(this.v);
    return [{ x: h.x, y: h.y + 0.3, z: h.z, r: 1.3, debil: true }, cuerpo];
  }

  golpear(cantidad: number) {
    if (this.derrotado || this.estado === 'llegada' || cantidad <= 0) return 0;
    const antes = this.vida;
    this.vida = Math.max(0, this.vida - cantidad);
    this.danoDesdePosarse += antes - this.vida;
    if (!this.furia && this.vida <= this.vidaMax * 0.5) {
      this.furia = true;
      this.eventos.aviso?.('¡El Dragón del Velo entra en furia!');
    }
    if (this.vida <= 0) {
      this.derrotado = true;
      this.limpiar();
      this.estado = 'caer';
      this.t = 0;
      this.reproducir('Derrota');
      this.eventos.sacudida?.();
    }
    return antes - this.vida;
  }

  update(j: JugadorGolem): number {
    const dt = j.dt;
    this.mixer.update(dt);
    this.t += dt;
    this.avisos.actualizar(dt);
    let dano = this.actualizarBombas(j);
    const dx = j.x - this.x, dz = j.z - this.z, d = Math.hypot(dx, dz) || 1;
    const furia = this.furia ? 1.2 : 1;

    switch (this.estado) {
      case 'llegada':
        this.volarHacia(j.x - dx / d * DRAGON.orbita, j.z - dz / d * DRAGON.orbita, DRAGON.altura, DRAGON.velocidad * 1.4, dt);
        if (d < DRAGON.orbita + 6 || this.t > 6) {
          this.cambiar('volar');
          this.reproducir('Rugir');
          this.orbitaAng = Math.atan2(this.z - j.z, this.x - j.x);
        }
        break;
      case 'volar': {
        // Vueltas alrededor del jugador.
        this.orbitaAng += DRAGON.velocidad * furia / DRAGON.orbita * dt;
        this.volarHacia(j.x + Math.cos(this.orbitaAng) * DRAGON.orbita, j.z + Math.sin(this.orbitaAng) * DRAGON.orbita, DRAGON.altura, DRAGON.velocidad * furia, dt);
        if (this.actual === 'Rugir' && this.t > TIEMPOS_DRAGON.rugir) this.reproducir('Volar');
        this.descanso -= dt;
        if (this.descanso > 0) break;
        const limite = this.danoDesdePosarse >= this.vidaMax * 0.25 || this.ataquesSinPosarse >= DRAGON.ataquesAntesDePosarse;
        if (limite) this.empezarAterrizaje(j);
        else this.empezarAtaque(j);
        break;
      }
      case 'bombas': {
        const vel = DRAGON.velocidad * 1.25 * furia;
        this.volarHacia(this.x + this.dx * 10, this.z + this.dz * 10, 12, vel, dt);
        this.recorrido += vel * dt;
        this.tic -= dt;
        const cuantas = this.furia ? DRAGON.bombas.furia : DRAGON.bombas.cuantas;
        // Suelta en el tramo central de la pasada, alrededor del jugador.
        if (this.tic <= 0 && this.soltadas < cuantas && this.recorrido > this.largo * 0.3) {
          this.tic = 0.24;
          this.soltadas++;
          const tx = this.x + this.dx * 4 + (this.rand() - 0.5) * 4, tz = this.z + this.dz * 4 + (this.rand() - 0.5) * 4;
          this.soltarBomba(tx, tz);
        }
        if (this.recorrido >= this.largo) this.acabar();
        break;
      }
      case 'aliento': {
        const { empieza, acaba, duracion } = TIEMPOS_DRAGON.aliento;
        if (!this.aviso) {
          // Va a su sitio de lanzamiento y se queda en el aire.
          this.volarHacia(this.ox, this.oz, 9, DRAGON.velocidad * furia, dt);
          this.mirarA(dx, dz, dt, 5);
          if (Math.hypot(this.x - this.ox, this.z - this.oz) < 2 || this.t > 2.5) {
            this.t = 0;
            this.reproducir('Aliento');
            this.giro = Math.atan2(dx, dz);
            this.dx = Math.sin(this.giro);
            this.dz = Math.cos(this.giro);
            const cx = this.x + this.dx * 3, cz = this.z + this.dz * 3;
            this.aviso = this.avisos.cono(cx, cz, this.giro, DRAGON.aliento.largo, MEDIO_CONO);
            this.ox = cx;
            this.oz = cz;
          }
          break;
        }
        this.volarHacia(this.x, this.z, 9, 0, dt);
        if (this.t < empieza) this.avisos.pintar(this.aviso, this.t / empieza);
        const soplando = this.t >= empieza && this.t < acaba;
        this.aliento?.scale.setScalar(soplando ? 1 + 0.1 * Math.sin(this.t * 40) : 0.001);
        if (soplando) {
          this.tic -= dt;
          if (this.tic <= 0) {
            this.tic = 0.3;
            const px = j.x - this.ox, pz = j.z - this.oz, dist = Math.hypot(px, pz);
            const ang = Math.abs(Math.atan2(px * this.dz - pz * this.dx, px * this.dx + pz * this.dz));
            if (dist <= DRAGON.aliento.largo && ang <= MEDIO_CONO) dano += DRAGON.aliento.dano * furia;
          }
        }
        if (this.t >= Math.min(duracion, acaba + 0.2)) this.acabar();
        break;
      }
      case 'picado': {
        if (this.t < DRAGON.picado.aviso) {
          // Ruge en lo alto mirando la franja: aquí aún se puede apartar.
          this.volarHacia(this.x, this.z, 16, 0, dt);
          this.giro = Math.atan2(this.dx, this.dz);
          if (this.aviso) this.avisos.pintar(this.aviso, this.t / DRAGON.picado.aviso);
          break;
        }
        if (this.actual !== 'Picado') this.reproducir('Picado');
        const vel = DRAGON.picado.velocidad * furia;
        const paso = vel * dt;
        this.recorrido += paso;
        this.x += this.dx * paso;
        this.z += this.dz * paso;
        // Baja hasta rozar el suelo a mitad de la franja y vuelve a subir.
        const k = Math.min(1, this.recorrido / this.largo);
        this.alt = 16 - 14.5 * Math.sin(k * Math.PI);
        this.cabeceo = Math.cos(k * Math.PI) * 0.5;
        if (!this.golpeado && this.alt < 4 && Math.hypot(j.x - this.x, j.z - this.z) < 3.4) {
          this.golpeado = true;
          dano += DRAGON.picado.dano * furia;
          this.eventos.empujar?.(this.dx * DRAGON.picado.empuje, this.dz * DRAGON.picado.empuje, 8);
          this.eventos.sacudida?.();
          this.eventos.sonido?.('boom');
        }
        if (k >= 1) {
          this.cabeceo = 0;
          this.acabar();
        }
        break;
      }
      case 'aterrizar': {
        const { aterrizar } = TIEMPOS_DRAGON;
        if (this.actual !== 'Aterrizar') {
          this.volarHacia(this.ox, this.oz, 10, DRAGON.velocidad * 1.2, dt);
          if (this.aviso) this.avisos.pintar(this.aviso, 0.3);
          if (Math.hypot(this.x - this.ox, this.z - this.oz) < 1.5 || this.t > 3) {
            this.t = 0;
            this.reproducir('Aterrizar');
          }
          break;
        }
        this.alt = Math.max(0, 10 * (1 - this.t / (aterrizar - 0.2)));
        this.mirarA(dx, dz, dt, 4);
        if (this.aviso) this.avisos.pintar(this.aviso, this.t / (aterrizar - 0.2));
        if (!this.golpeado && this.t >= aterrizar - 0.2) {
          this.golpeado = true;
          this.avisos.quitar(this.aviso);
          this.aviso = null;
          this.avisos.onda(this.x, this.z, DRAGON.aterrizaje.radio, '#e8faff');
          this.eventos.sacudida?.();
          this.eventos.sonido?.('boom');
          if (d <= DRAGON.aterrizaje.radio) {
            dano += DRAGON.aterrizaje.dano;
            this.eventos.empujar?.(dx / d * DRAGON.aterrizaje.empuje, dz / d * DRAGON.aterrizaje.empuje, 6);
          }
          this.eventos.aviso?.('¡Se ha posado! Ahora le llega todo');
        }
        if (this.t >= aterrizar) {
          this.cambiar('posado');
          this.reproducir('Posado');
        }
        break;
      }
      case 'posado':
        this.alt = 0;
        this.mirarA(dx, dz, dt, 2);
        if (d < 3.2) dano += 8 * dt;
        if (this.t >= DRAGON.posado) {
          this.cambiar('despegar');
          this.reproducir('Despegar');
          this.eventos.aviso?.('¡Vuelve a despegar!');
        }
        break;
      case 'despegar':
        this.alt = Math.min(DRAGON.altura, this.t / TIEMPOS_DRAGON.despegar * DRAGON.altura * 0.8);
        if (this.t >= TIEMPOS_DRAGON.despegar) {
          this.danoDesdePosarse = 0;
          this.ataquesSinPosarse = 0;
          this.cambiar('volar');
          this.reproducir('Volar');
          this.descanso = DRAGON.descanso;
        }
        break;
      case 'caer':
        this.alt = Math.max(0, this.alt - dt * 9);
        this.alabeo += dt * 0.6;
        if (this.t >= 3.2) this.terminado = true;
        break;
    }

    this.animarBrillo(dt);
    this.colocar();
    return dano;
  }

  dispose() {
    this.limpiar();
    this.avisos.dispose();
    this.mixer.stopAllAction();
    this.scene.remove(this.raiz, this.sombra);
    this.sombra.geometry.dispose();
    for (const m of this.latentes) m.emissiveIntensity = m.userData.latir;
  }

  // ------------------------------------------------------------ ataques

  private empezarAtaque(j: JugadorGolem) {
    const opciones = (['bombas', 'aliento', 'picado'] as const).filter((a) => a !== this.ultimo);
    const tipo = opciones[Math.floor(this.rand() * opciones.length)];
    this.ultimo = tipo;
    this.ataquesSinPosarse++;
    this.cambiar(tipo);
    this.recorrido = 0;
    this.tic = 0;
    this.soltadas = 0;
    this.golpeado = false;
    const dx = j.x - this.x, dz = j.z - this.z, d = Math.hypot(dx, dz) || 1;
    if (tipo === 'bombas') {
      this.eventos.aviso?.('¡Bombardeo de sulfato! Esquiva los círculos');
      this.dx = dx / d;
      this.dz = dz / d;
      this.largo = d + 22;
      this.reproducir('Volar');
    } else if (tipo === 'aliento') {
      this.eventos.aviso?.('¡Va a escupir desde el aire! Sal del cono');
      // Su sitio: a 11 m del jugador, por el lado en que está ahora.
      this.ox = j.x - dx / d * 11;
      this.oz = j.z - dz / d * 11;
      this.reproducir('Planear');
    } else {
      this.eventos.aviso?.('¡Picado! Apártate de la franja');
      this.dx = dx / d;
      this.dz = dz / d;
      this.largo = d * 2;
      this.ox = this.x;
      this.oz = this.z;
      this.aviso = this.avisos.franja(this.x, this.z, this.dx, this.dz, 5.5, this.largo);
      this.reproducir('Rugir');
    }
  }

  private empezarAterrizaje(j: JugadorGolem) {
    this.cambiar('aterrizar');
    this.golpeado = false;
    const dx = this.x - j.x, dz = this.z - j.z, d = Math.hypot(dx, dz) || 1;
    const p = this.world.resolve(j.x + dx / d * 9, j.z + dz / d * 9, 3, { x: 0, z: 0 });
    this.ox = p.x;
    this.oz = p.z;
    this.aviso = this.avisos.circulo(p.x, p.z, DRAGON.aterrizaje.radio);
    this.reproducir('Planear');
    this.eventos.aviso?.('¡Va a aterrizar! Sal del círculo');
  }

  private acabar() {
    this.avisos.quitar(this.aviso);
    this.aviso = null;
    this.aliento?.scale.setScalar(0.001);
    this.cambiar('volar');
    this.reproducir('Volar');
    this.orbitaAng = Math.atan2(this.z - this.oz, this.x - this.ox);
    this.descanso = DRAGON.descanso * (this.furia ? 0.7 : 1) + this.rand();
  }

  // ------------------------------------------------------------- bombas

  private soltarBomba(tx: number, tz: number) {
    const r = this.world.resolve(tx, tz, 0.5, { x: 0, z: 0 });
    const mesh = new THREE.Mesh(this.geoBomba, new THREE.MeshBasicMaterial({ color: SULFATO }));
    halo(mesh, SULFATO, 2.4, 0, 0, 0, 0.9);
    const y0 = this.world.heightAt(this.x, this.z) + this.alt - 1;
    mesh.position.set(this.x, y0, this.z);
    this.scene.add(mesh);
    this.bombas.push({ mesh, aviso: this.avisos.circulo(r.x, r.z, DRAGON.bombas.radio), x0: this.x, y0, z0: this.z, x1: r.x, z1: r.z, t: 0, dur: DRAGON.bombas.caida });
  }

  private actualizarBombas(j: JugadorGolem) {
    let dano = 0;
    for (let i = this.bombas.length - 1; i >= 0; i--) {
      const b = this.bombas[i];
      b.t += j.dt;
      const k = Math.min(1, b.t / b.dur);
      this.avisos.pintar(b.aviso, k);
      const suelo = this.world.heightAt(b.x1, b.z1);
      b.mesh.position.set(b.x0 + (b.x1 - b.x0) * k, b.y0 + (suelo - b.y0) * k * k, b.z0 + (b.z1 - b.z0) * k);
      if (k < 1) continue;
      this.quitarBomba(b);
      this.bombas.splice(i, 1);
      this.avisos.onda(b.x1, b.z1, DRAGON.bombas.radio, SULFATO);
      this.eventos.sonido?.('boom');
      const d = Math.hypot(j.x - b.x1, j.z - b.z1);
      if (d <= DRAGON.bombas.radio) {
        dano += DRAGON.bombas.dano * (this.furia ? 1.15 : 1);
        this.eventos.empujar?.((j.x - b.x1) / (d || 1) * 7, (j.z - b.z1) / (d || 1) * 7, 3);
      }
    }
    return dano;
  }

  private quitarBomba(b: Bomba) {
    this.avisos.quitar(b.aviso);
    this.scene.remove(b.mesh);
    b.mesh.traverse((o) => { if (o instanceof THREE.Sprite) o.material.dispose(); });
    (b.mesh.material as THREE.Material).dispose();
  }

  private limpiar() {
    this.avisos.quitar(this.aviso);
    this.aviso = null;
    for (const b of this.bombas) this.quitarBomba(b);
    this.bombas = [];
    this.aliento?.scale.setScalar(0.001);
  }

  // ----------------------------------------------------------- movimiento

  /** Vuela hacia (tx, tz) a `vel` m/s y sube o baja hasta `alt`; se ladea al girar. */
  private volarHacia(tx: number, tz: number, alt: number, vel: number, dt: number) {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d > 0.05 && vel > 0) {
      const paso = Math.min(d, vel * dt);
      this.x += dx / d * paso;
      this.z += dz / d * paso;
      const antes = this.giro;
      this.mirarA(dx, dz, dt, 3);
      let giro = this.giro - antes;
      giro = Math.atan2(Math.sin(giro), Math.cos(giro));
      this.alabeo += (THREE.MathUtils.clamp(-giro / Math.max(dt, 1e-3) * 0.35, -0.6, 0.6) - this.alabeo) * Math.min(1, dt * 3);
    } else {
      this.alabeo += (0 - this.alabeo) * Math.min(1, dt * 3);
    }
    this.alt += (alt - this.alt) * Math.min(1, dt * 1.5);
  }

  private mirarA(dx: number, dz: number, dt: number, rapidez: number) {
    let giro = Math.atan2(dx, dz) - this.giro;
    giro = Math.atan2(Math.sin(giro), Math.cos(giro));
    this.giro += giro * Math.min(1, dt * rapidez);
  }

  private colocar() {
    const suelo = this.world.heightAt(this.x, this.z);
    this.raiz.position.set(this.x, suelo + this.alt, this.z);
    this.raiz.rotation.set(this.cabeceo, this.giro, this.alabeo, 'YXZ');
    // La sombra crece y se aclara cuanto más alto vuela.
    const s = 4 + this.alt * 0.12;
    this.sombra.position.set(this.x, suelo + 0.08, this.z);
    this.sombra.scale.set(s, 1, s * 0.7);
    this.sombra.rotation.y = this.giro;
    (this.sombra.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 0.4 - this.alt * 0.012);
  }

  private animarBrillo(dt: number) {
    if (this.rotor) this.rotor.rotation.z += dt * (this.estado === 'posado' ? 3 : 16);
    const apagado = this.estado === 'caer' ? Math.max(0.15, 1 - this.t / 2.5) : 1;
    const latido = (0.85 + 0.3 * Math.sin(this.t * 4)) * (this.furia ? 1.4 : 1) * apagado;
    for (const m of this.latentes) m.emissiveIntensity = m.userData.latir * latido;
    this.luz.intensity = 50 * latido;
  }

  private cambiar(estado: Estado) {
    this.estado = estado;
    this.t = 0;
  }

  private reproducir(nombre: string) {
    const nueva = this.acciones.get(nombre);
    if (!nueva || this.actual === nombre && nueva.isRunning()) return;
    this.acciones.get(this.actual)?.fadeOut(0.25);
    nueva.reset().fadeIn(0.25).play();
    this.actual = nombre;
  }
}
