import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  PALETA, barril, brillo, caja, capsula, conDetalle, contorno, esfera, pieza, punta, toon, toro,
} from './modelos/kit.ts';
import { crearNavePosada, ESCALA_POSADA } from './modelos/nave.ts';

// El mundo de Meta Space: el sector donde se juega cada partida.
//
// Sustituye a world.ts del juego con la misma interfaz (World, heightAt,
// resolve, follow, faceCamera, padPosition, blocks, sun) y lo que hace falta
// para lo nuevo: `update` anima el ácido, `acidoEn` dice cuánto ácido hay
// bajo los pies (para hacer daño), `lugares` y `carta()` alimentan el
// minimapa y `lugarLibre` busca sitio para colocar el contenido del mapa.
// Todo lo que se ve está hecho con las piezas y los materiales toon del kit,
// así el mapa y los personajes son del mismo dibujo.
//
// El sector (260 × 260 m con la arena por defecto de 130):
// - Llanura de lomas y dunas teñidas por el velo, con la explanada de salida
//   en el centro y la del cohete al norte.
// - Tres macizos de montañas con las cumbres heladas (Meta se congela) y una
//   muralla de picos en el borde que cierra el mapa. El corazón de cada
//   montaña no se puede cruzar.
// - Dos mares de ácido púrpura de HELIOS, con cristales en la orilla,
//   burbujas y vapor. Se puede vadear (por las rodillas), pero hace daño.
// - Tres barrios en ruinas de las ciudades de Meta (muros rotos, columnas,
//   torres caídas, cúpulas) con restos de máquinas de HELIOS.

/** El velo de sulfatos: horizonte anaranjado que oscurece hacia arriba. */
export const HORIZON = new THREE.Color('#df8a6a');
const MEDIO = new THREE.Color('#a8445a');
const CENIT = new THREE.Color('#3a1530');

/** Altura de la superficie del ácido. */
export const NIVEL_ACIDO = -1.6;
/**
 * La nave de ARES-IX, posada a la izquierda de la salida (13 m): se ve al
 * empezar, delante y a la izquierda, con la rampa mirando al jugador.
 */
export const NAVE = { x: -9, z: -10 };
/** Giro de la nave para que su costado izquierdo (la escotilla) mire a la salida. */
const GIRO_NAVE = Math.atan2(NAVE.z, -NAVE.x);

/** Cuánto se hunde quien anda por el ácido. */
const VADEO = 0.7;

/** Caja de colisión alineada con los ejes, en el plano XZ. */
export interface Block {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Algo del mapa que Bruno puede ir a olfatear. */
export interface PuntoInteres {
  x: number;
  z: number;
  tipo: 'cristal' | 'arbol' | 'roca' | 'antena';
}

/** Círculo de colisión (montañas, rocas grandes, cristales). */
interface Circulo {
  x: number;
  z: number;
  r: number;
}

export interface OpcionesMundo {
  /** Medio lado de la zona jugable, en metros (el juego usa RUN.arena). */
  arena?: number;
  semilla?: number;
}

// Macizos de montañas: posición en fracciones de la arena y sus picos
// [dx, dz, radio, altura] (dx, dz y radio también en fracciones).
const MACIZOS = [
  { nombre: 'Sierra de Escarcha', x: -0.56, z: -0.28, picos: [[0, 0, 0.2, 46], [0.15, 0.1, 0.13, 30], [-0.13, 0.12, 0.13, 28], [0.05, -0.16, 0.12, 24], [-0.16, -0.08, 0.1, 20]] },
  { nombre: 'Picos del Velo', x: 0.6, z: 0.12, picos: [[0, 0, 0.18, 40], [-0.12, 0.13, 0.13, 26], [0.09, -0.13, 0.11, 22]] },
  { nombre: 'Colmillo', x: 0.06, z: 0.66, picos: [[0, 0, 0.13, 34], [0.13, 0.05, 0.09, 20]] },
] as const;

// Mares de ácido: centro y radio en fracciones de la arena.
const LAGOS = [
  { nombre: 'Mar de HELIOS', x: -0.38, z: 0.47, r: 0.25 },
  { nombre: 'Charca del Este', x: 0.48, z: -0.44, r: 0.13 },
] as const;

// Barrios en ruinas: centro y medio tamaño en fracciones de la arena.
const BARRIOS = [
  { nombre: 'Puerto viejo', x: 0.3, z: -0.2, w: 0.16, d: 0.13 },
  { nombre: 'Barrio del Observatorio', x: -0.25, z: -0.64, w: 0.13, d: 0.1 },
  { nombre: 'Mercado de Meridia', x: 0.52, z: 0.62, w: 0.13, d: 0.12 },
] as const;

// ------------------------------------------------------------------ ruido

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number) {
  return noise(x, z) * 0.55 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.15;
}

/** Ruido de crestas: picos afilados para las montañas. */
function crestas(x: number, z: number) {
  const r = (v: number) => 1 - Math.abs(v * 2 - 1);
  return r(noise(x, z)) * 0.6 + r(noise(x * 2.3, z * 2.3)) * 0.3 + r(noise(x * 5.1, z * 5.1)) * 0.1;
}

function smoothstep(a: number, b: number, v: number) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Generador determinista (Park–Miller). */
function aleatorio(semilla: number) {
  let s = Math.max(1, Math.floor(semilla) % 2147483647);
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ---------------------------------------------------------- fusión estática

/**
 * Junta todas las piezas de un grupo (ya colocadas) en una malla por
 * material, y los contornos en otra: un barrio entero son media docena de
 * llamadas de dibujo.
 */
function fusionar(grupo: THREE.Object3D, destino: THREE.Object3D, sombras = true) {
  grupo.updateMatrixWorld(true);
  const porMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  grupo.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
    const lista = porMaterial.get(o.material as THREE.Material) ?? [];
    lista.push(geo.index ? geo.toNonIndexed() : geo);
    porMaterial.set(o.material as THREE.Material, lista);
  });
  for (const [material, geos] of porMaterial) {
    // Solo se fusiona lo que comparte atributos (normal y posición).
    for (const g of geos) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const malla = new THREE.Mesh(mergeGeometries(geos, false)!, material);
    const esContorno = material === contorno();
    malla.castShadow = sombras && !esContorno && !(material instanceof THREE.MeshBasicMaterial);
    malla.receiveShadow = !esContorno;
    malla.matrixAutoUpdate = false;
    destino.add(malla);
  }
}

// ------------------------------------------------------------------ mundo

const CELL = 8;

export class World {
  readonly blocks: Block[] = [];
  readonly sun: THREE.DirectionalLight;
  readonly padPosition: THREE.Vector3;
  /** Dónde está la nave posada y hacia dónde mira (para el minimapa). */
  readonly nave = { x: NAVE.x, z: NAVE.z, giro: GIRO_NAVE };
  readonly arena: number;
  /** Para el minimapa y para colocar contenido: dónde está cada cosa. */
  readonly lugares: { tipo: 'montaña' | 'lago' | 'barrio'; nombre: string; x: number; z: number; r: number }[] = [];
  /** Cristales, árboles, rocas y tecnología de HELIOS que atraen a Bruno. */
  readonly interes: PuntoInteres[] = [];

  private circulos: Circulo[] = [];
  private grid = new Map<number, Block[]>();
  private gridCirculos = new Map<number, Circulo[]>();
  private half: number;
  private side: number;
  private heights: Float32Array;
  private sky: THREE.Group;
  private tiempo = 0;
  private acido: THREE.ShaderMaterial | null = null;
  private burbujas: { malla: THREE.InstancedMesh; x: Float32Array; z: Float32Array; fase: Float32Array } | null = null;
  private vapores: THREE.Sprite[] = [];
  private m = new THREE.Matrix4();
  // Colores del suelo en la rejilla del terreno, para la carta del minimapa.
  private coloresSuelo: Float32Array | null = null;
  private ladoSuelo = 0;
  private cartaHecha: { imagen: HTMLCanvasElement; mitad: number } | null = null;
  private mezcladorNave: THREE.AnimationMixer | null = null;

  constructor(readonly scene: THREE.Scene, opciones: OpcionesMundo = {}) {
    this.arena = opciones.arena ?? 130;
    const a = this.arena;
    this.half = a + 80;
    this.side = Math.round(this.half * 2) + 1;
    this.heights = new Float32Array(this.side * this.side);
    this.padPosition = new THREE.Vector3(0, 0, -0.7 * a);
    for (const m of MACIZOS) this.lugares.push({ tipo: 'montaña', nombre: m.nombre, x: m.x * a, z: m.z * a, r: m.picos[0][2] * a * 1.6 });
    for (const l of LAGOS) this.lugares.push({ tipo: 'lago', nombre: l.nombre, x: l.x * a, z: l.z * a, r: l.r * a });
    for (const b of BARRIOS) this.lugares.push({ tipo: 'barrio', nombre: b.nombre, x: b.x * a, z: b.z * a, r: Math.max(b.w, b.d) * a });

    scene.background = HORIZON;
    scene.fog = new THREE.Fog(HORIZON, 70, 330);
    this.muestrear();

    // Luz cálida del sol bajo y sombras frías violetas: contraste de dibujo.
    scene.add(new THREE.HemisphereLight('#ffd0b4', '#3a2a5e', 1.5));
    this.sun = new THREE.DirectionalLight('#ffcfa0', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -50;
    cam.right = cam.top = 50;
    cam.near = 1;
    cam.far = 180;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    const semilla = opciones.semilla ?? 2026;
    this.sky = this.cielo();
    this.terreno();
    this.mares(semilla);
    // El sitio de la nave se reserva antes que ruinas y decorado, para que no
    // salgan rocas ni árboles debajo.
    this.reservarNave();
    this.montanas(semilla + 1);
    this.ruinas(semilla + 2);
    this.decorado(semilla + 3);
    this.horizonte(semilla + 4);
    this.cohete();
    this.navePosada();
    this.bordes();
  }

  // ------------------------------------------------------------- relieve

  /** Cuánto pertenece un punto a un mar de ácido (0 fuera, 1 dentro). */
  private enLago(x: number, z: number) {
    let m = 0;
    for (const l of LAGOS) {
      const cx = l.x * this.arena, cz = l.z * this.arena, r = l.r * this.arena;
      // Orilla irregular: el radio cambia con el ángulo y un poco de ruido.
      const borde = r * (0.82 + 0.28 * fbm(x * 0.05 + 7, z * 0.05 - 3));
      m = Math.max(m, smoothstep(1.0, 0.72, Math.hypot(x - cx, z - cz) / borde));
    }
    return m;
  }

  /** La forma del mundo. Solo se usa para rellenar la cuadrícula de alturas. */
  private alturaCruda(x: number, z: number) {
    const a = this.arena;
    // Llanura: lomas grandes y dunas pequeñas.
    let h = (fbm(x * 0.018, z * 0.018) - 0.45) * 7 + (fbm(x * 0.08 + 40, z * 0.08) - 0.5) * 1.1;
    h = Math.max(h, -1.0);
    // Barrios: el suelo se allana para que las ruinas asienten.
    for (const b of BARRIOS) {
      const dx = Math.abs(x - b.x * a) / (b.w * a), dz = Math.abs(z - b.z * a) / (b.d * a);
      const k = smoothstep(1.25, 0.85, Math.max(dx, dz));
      h += (0.3 - h) * k * 0.85;
    }
    // Macizos: picos afilados con crestas.
    for (const m of MACIZOS) {
      for (const [dx, dz, rr, alto] of m.picos) {
        const cx = (m.x + dx) * a, cz = (m.z + dz) * a, r = rr * a;
        const d = Math.hypot(x - cx, z - cz) / r;
        if (d >= 1) continue;
        const perfil = Math.pow(1 - d, 1.6);
        let monte = h * (1 - perfil) + alto * perfil * (0.7 + 0.45 * crestas(x * 0.06, z * 0.06) + 0.15 * crestas(x * 0.16, z * 0.16));
        // Terrazas: cortados escalonados de 3,5 m, que el sombreado toon lee
        // como acantilados de dibujo.
        const escalon = 3.5, t = monte / escalon, base = Math.floor(t);
        monte = (base + smoothstep(0.55, 0.9, t - base)) * escalon * 0.7 + monte * 0.3;
        h = Math.max(h, monte);
      }
    }
    // Mares de ácido: hoyas por debajo del nivel del ácido.
    const lago = this.enLago(x, z);
    if (lago > 0) h += (NIVEL_ACIDO - 0.4 - 3.2 * lago - h) * smoothstep(0, 0.55, lago);
    // Muralla de picos en el borde (esquinas redondeadas).
    const borde = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
    h += smoothstep(a - 10, a + 34, borde) ** 1.4 * (18 + 30 * crestas(x * 0.025, z * 0.025));
    // Llano donde se empieza y donde está el cohete.
    const salida = smoothstep(18, 8, Math.hypot(x, z));
    const plataforma = smoothstep(26, 15, Math.hypot(x - this.padPosition.x, z - this.padPosition.z));
    const nave = smoothstep(12, 7, Math.hypot(x - NAVE.x, z - NAVE.z));
    h += (0 - h) * Math.max(salida, plataforma, nave);
    return h;
  }

  private muestrear() {
    for (let iz = 0; iz < this.side; iz++)
      for (let ix = 0; ix < this.side; ix++)
        this.heights[iz * this.side + ix] = this.alturaCruda(ix - this.half, iz - this.half);
  }

  /**
   * Por dónde se anda: el suelo, salvo en los mares de ácido, donde se vadea
   * con el ácido por las rodillas (el fondo de verdad queda mucho más hondo,
   * pero la superficie es opaca y no se ve).
   */
  heightAt(x: number, z: number) {
    return Math.max(this.fondo(x, z), NIVEL_ACIDO - VADEO);
  }

  /** Altura del terreno en un punto, interpolada (en el ácido, el fondo). */
  private fondo(x: number, z: number) {
    const s = this.side;
    const gx = Math.max(0, Math.min(s - 1.001, x + this.half));
    const gz = Math.max(0, Math.min(s - 1.001, z + this.half));
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const i = iz * s + ix;
    const h = this.heights;
    const p = h[i] + (h[i + 1] - h[i]) * fx;
    const q = h[i + s] + (h[i + s + 1] - h[i + s]) * fx;
    return p + (q - p) * fz;
  }

  /** Profundidad del ácido en un punto (0 si no hay): el juego hace daño con ella. */
  acidoEn(x: number, z: number) {
    return Math.max(0, NIVEL_ACIDO - this.fondo(x, z));
  }

  /**
   * ¿Hay escarcha bajo este punto? La aerotabla y Bruno conservan así su
   * comportamiento del mapa helado, ahora solo en manchas frías y cumbres.
   */
  onIce(x: number, z: number) {
    if (this.acidoEn(x, z) > 0) return false;
    const y = this.fondo(x, z);
    const mancha = smoothstep(0.62, 0.78, fbm(x * 0.03 - 21, z * 0.03 + 5))
      * (1 - smoothstep(0.5, 2, y));
    return y >= 30 || mancha > 0.42;
  }

  private pendiente(x: number, z: number) {
    return Math.hypot(this.fondo(x + 1, z) - this.fondo(x - 1, z), this.fondo(x, z + 1) - this.fondo(x, z - 1)) / 2;
  }

  private terreno() {
    const segmentos = Math.round(this.half);
    const geo = new THREE.PlaneGeometry(this.half * 2, this.half * 2, segmentos, segmentos).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colores = new Float32Array(pos.count * 3);
    const arena = new THREE.Color('#dba57c'), duna = new THREE.Color('#f0c69c'), valle = new THREE.Color('#b67e68');
    const roca = new THREE.Color('#5c3e60'), rocaAlta = new THREE.Color('#3e2c50'), escarcha = new THREE.Color('#ece6f2');
    const helada = new THREE.Color('#cdbfd6'), grava = new THREE.Color('#7e6070');
    const manchado = new THREE.Color('#5c2e66'), losa = new THREE.Color('#9a8274'), quemado = new THREE.Color('#4a3040');
    const c = new THREE.Color();
    const a = this.arena;
    const lado = segmentos + 1, paso = (this.half * 2) / segmentos;
    const rejilla = new Float32Array(lado * lado * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.fondo(x, z);
      pos.setY(i, y);
      const p = this.pendiente(x, z);
      // Llanura: dunas claras en lo alto, valles más oscuros y manchas grandes.
      c.copy(arena).lerp(duna, smoothstep(0, 2.5, y) * 0.7 + (fbm(x * 0.3, z * 0.3) - 0.5) * 0.3);
      c.lerp(valle, smoothstep(0.55, 0.75, fbm(x * 0.045 + 13, z * 0.045)) * 0.6 + smoothstep(0, -1, y) * 0.4);
      // Manchas frías: escarcha en las hondonadas y grava oscura.
      c.lerp(helada, smoothstep(0.62, 0.78, fbm(x * 0.03 - 21, z * 0.03 + 5)) * 0.55 * (1 - smoothstep(0.5, 2, y)));
      c.lerp(grava, smoothstep(0.66, 0.8, fbm(x * 0.06 + 50, z * 0.06 - 8)) * 0.45);
      // Barrios: losas viejas bajo la arena.
      for (const b of BARRIOS) {
        const k = smoothstep(1.0, 0.7, Math.max(Math.abs(x - b.x * a) / (b.w * a), Math.abs(z - b.z * a) / (b.d * a)));
        if (k > 0) c.lerp(losa, k * 0.55 * (0.6 + 0.4 * noise(x * 0.5, z * 0.5)));
      }
      // Orillas del ácido: suelo manchado de púrpura.
      const orilla = smoothstep(0.0, 0.25, this.enLago(x, z) + 0.12) * (1 - smoothstep(0.3, 0.6, this.enLago(x, z)));
      c.lerp(manchado, Math.min(1, orilla * 1.4));
      // Montaña: roca en lo empinado, roca oscura en lo alto y escarcha en las cumbres.
      // Las montañas son de roca aunque las terrazas sean llanas.
      c.lerp(roca, Math.max(smoothstep(0.45, 1.2, p), smoothstep(3, 8, y) * 0.85));
      c.lerp(rocaAlta, smoothstep(10, 22, y) * 0.85);
      // Fuera de la arena, la meseta del borde es roca oscura: el horizonte
      // no se lee como un techo claro.
      const fuera = smoothstep(a + 4, a + 30, Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25));
      c.lerp(rocaAlta, fuera * 0.9);
      // Quemadura del aterrizaje bajo la nave, con rayas que salen del centro.
      const dNave = Math.hypot(x - NAVE.x, z - NAVE.z);
      if (dNave < 8) c.lerp(quemado, smoothstep(7.5, 2.5, dNave) * (0.35 + 0.3 * noise(Math.atan2(z - NAVE.z, x - NAVE.x) * 4, dNave * 0.3)));
      // Escarcha solo en las cumbres (y menos donde es muy empinado).
      c.lerp(escarcha, smoothstep(30, 38, y + (fbm(x * 0.2, z * 0.2) - 0.5) * 8) * (1 - smoothstep(1.6, 2.6, p) * 0.6) * (1 - fuera * 0.8));
      colores.set([c.r, c.g, c.b], i * 3);
      rejilla.set([c.r, c.g, c.b], (Math.round((z + this.half) / paso) * lado + Math.round((x + this.half) / paso)) * 3);
    }
    this.coloresSuelo = rejilla;
    this.ladoSuelo = lado;
    geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    geo.computeVertexNormals();
    const textura = texturaSuelo();
    textura.repeat.set(this.half / 6, this.half / 6);
    const suelo = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, map: textura, gradientMap: rampa(true) }));
    suelo.receiveShadow = true;
    this.scene.add(suelo);

    // Más allá del terreno, un anillo hasta el horizonte para que no haya borde.
    const lejos = new THREE.Mesh(
      new THREE.RingGeometry(this.half - 6, 1400, 64).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#7a3a46' }),
    );
    lejos.position.y = 20;
    this.scene.add(lejos);
  }

  // ------------------------------------------------------------- ácido

  private mares(semilla: number) {
    const rand = aleatorio(semilla);
    const a = this.arena;
    this.acido = new THREE.ShaderMaterial({
      transparent: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tiempo: { value: 0 } }]),
      vertexShader: `
        attribute float prof;
        varying float vProf;
        varying vec2 vXZ;
        #include <fog_pars_vertex>
        void main() {
          vProf = prof;
          vXZ = position.xz;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float tiempo;
        varying float vProf;
        varying vec2 vXZ;
        #include <fog_pars_fragment>
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
        void main() {
          // Ondas: dos capas de ruido que se mueven en sentidos distintos.
          float o = n(vXZ * 0.35 + vec2(tiempo * 0.25, tiempo * 0.1)) * 0.6 + n(vXZ * 0.9 - vec2(tiempo * 0.18, -tiempo * 0.3)) * 0.4;
          // Tres tonos, como el toon: hondo, medio y cresta que brilla.
          vec3 hondo = vec3(0.16, 0.04, 0.27), medio = vec3(0.45, 0.16, 0.76), cresta = vec3(0.78, 0.49, 1.0);
          vec3 c = mix(hondo, medio, step(0.42, o));
          c = mix(c, cresta, step(0.72, o));
          // Orilla: espuma clara donde el ácido es poco profundo.
          float espuma = 1.0 - smoothstep(0.05, 0.5 + 0.15 * sin(tiempo * 2.0 + vXZ.x * 0.4), vProf);
          c = mix(c, vec3(0.95, 0.8, 1.0), step(0.5, espuma));
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
    });
    const todas: { x: number; z: number }[] = [];
    for (const l of LAGOS) {
      const cx = l.x * a, cz = l.z * a, r = l.r * a * 1.2;
      const geo = new THREE.PlaneGeometry(r * 2, r * 2, Math.round(r), Math.round(r)).rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const prof = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
        prof[i] = NIVEL_ACIDO - this.fondo(x, z);
      }
      geo.setAttribute('prof', new THREE.BufferAttribute(prof, 1));
      const malla = new THREE.Mesh(geo, this.acido);
      malla.position.set(cx, NIVEL_ACIDO, cz);
      this.scene.add(malla);
      // Puntos de burbujas: dentro, donde el ácido cubre.
      for (let k = 0; k < 40; k++) {
        const ang = rand() * Math.PI * 2, d = Math.sqrt(rand()) * l.r * a * 0.8;
        const x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
        if (this.acidoEn(x, z) > 0.6) todas.push({ x, z });
      }
      // Vapor púrpura sobre el mar.
      for (let k = 0; k < 6; k++) {
        const v = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaVapor(), transparent: true, depthWrite: false, opacity: 0.55 }));
        const ang = rand() * Math.PI * 2, d = rand() * l.r * a * 0.7;
        v.position.set(cx + Math.cos(ang) * d, NIVEL_ACIDO + 2 + rand() * 2, cz + Math.sin(ang) * d);
        const s = 14 + rand() * 12;
        v.scale.set(s, s * 0.45, 1);
        v.userData = { base: v.position.clone(), fase: rand() * 10 };
        this.vapores.push(v);
        this.scene.add(v);
      }
    }
    // Burbujas que suben y revientan.
    const malla = new THREE.InstancedMesh(conDetalle(0.5, () => esfera(0.25)), brillo(PALETA.purpuraBrillo), todas.length);
    malla.frustumCulled = false;
    this.burbujas = {
      malla,
      x: Float32Array.from(todas.map((p) => p.x)),
      z: Float32Array.from(todas.map((p) => p.z)),
      fase: Float32Array.from(todas.map(() => rand())),
    };
    this.scene.add(malla);

    // Cristales púrpura en las orillas.
    const grupo = new THREE.Group();
    for (const l of LAGOS) {
      const cx = l.x * a, cz = l.z * a;
      for (let k = 0; k < Math.round(l.r * a * 1.4); k++) {
        const ang = rand() * Math.PI * 2;
        const borde = l.r * a * (0.85 + rand() * 0.35);
        const x = cx + Math.cos(ang) * borde, z = cz + Math.sin(ang) * borde;
        if (this.acidoEn(x, z) > 0.3 || this.pendiente(x, z) > 1.2) continue;
        this.racimo(grupo, x, z, 0.6 + rand() * 1.1, rand);
      }
    }
    fusionar(grupo, this.scene);
  }

  /** Racimo de cristales púrpura (algunos brillan) clavado en el suelo. */
  private racimo(grupo: THREE.Group, x: number, z: number, tam: number, rand: () => number, chocar = true) {
    const y = this.fondo(x, z);
    conDetalle(0.6, () => {
      const n = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const alto = tam * (0.8 + rand() * 1.4);
        const c = pieza(grupo, punta(tam * 0.22, alto, 6), k % 2 ? brillo(PALETA.purpuraBrillo) : toon(PALETA.purpura),
          x + (rand() - 0.5) * tam * 0.7, y + alto * 0.35, z + (rand() - 0.5) * tam * 0.7, { contorno: k % 2 === 0 });
        c.rotation.set((rand() - 0.5) * 0.9, rand() * Math.PI, (rand() - 0.5) * 0.9);
      }
    });
    this.interes.push({ x, z, tipo: 'cristal' });
    if (chocar) this.addCirculo({ x, z, r: tam * 0.45 });
  }

  // ------------------------------------------------------------ montañas

  private montanas(semilla: number) {
    const rand = aleatorio(semilla);
    const a = this.arena;
    const grupo = new THREE.Group();
    for (const m of MACIZOS) {
      for (const [dx, dz, rr] of m.picos) {
        // El corazón de cada pico no se puede cruzar.
        this.addCirculo({ x: (m.x + dx) * a, z: (m.z + dz) * a, r: rr * a * 0.52 });
      }
      // Rocas al pie y vetas de cristal en las laderas.
      const cx = m.x * a, cz = m.z * a, r = m.picos[0][2] * a;
      for (let k = 0; k < 26; k++) {
        const ang = rand() * Math.PI * 2, d = r * (0.6 + rand() * 0.9);
        const x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
        // Ni en el ácido ni al borde de un cortado (quedarían en el aire).
        if (this.acidoEn(x, z) > 0 || this.pendiente(x, z) > 0.6) continue;
        if (k % 3 === 0) this.racimo(grupo, x, z, 0.8 + rand() * 1.4, rand);
        else this.roca(grupo, x, z, 0.8 + rand() * 1.8, rand);
      }
    }
    fusionar(grupo, this.scene);
  }

  /** Roca toon de formas redondas, medio enterrada. */
  private roca(grupo: THREE.Group, x: number, z: number, tam: number, rand: () => number, chocar = true) {
    const y = this.fondo(x, z);
    conDetalle(0.4, () => {
      const r = pieza(grupo, esfera(tam, 1 + rand() * 0.5, 0.6 + rand() * 0.4, 1 + rand() * 0.4), toon(rand() < 0.5 ? '#6a4a4e' : '#7d5a55'), x, y + tam * 0.15, z);
      r.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.4);
      if (rand() < 0.4) {
        // Escarcha encima: el planeta se congela.
        const e = pieza(grupo, esfera(tam * 0.7, 1.2, 0.35, 1.1), toon('#e6e0ee'), x, y + tam * 0.62, z, { contorno: false });
        e.rotation.y = rand() * Math.PI;
      }
    });
    // Los ejemplares pequeños son alcanzables con el margen que usa Bruno.
    if (tam <= 1.25) this.interes.push({ x, z, tipo: 'roca' });
    if (chocar && tam > 1) this.addCirculo({ x, z, r: tam * 0.8 });
  }

  // -------------------------------------------------------------- ruinas

  private ruinas(semilla: number) {
    const rand = aleatorio(semilla);
    const a = this.arena;
    const grupo = new THREE.Group();
    const hormigon = ['#8a8288', '#76707e', '#968c8a'];
    const color = () => hormigon[Math.floor(rand() * hormigon.length)];
    for (const b of BARRIOS) {
      const cx = b.x * a, cz = b.z * a, w = b.w * a, d = b.d * a;
      const lote = 9;
      for (let lx = -w + lote / 2; lx < w; lx += lote) {
        for (let lz = -d + lote / 2; lz < d; lz += lote) {
          if (rand() < 0.3) continue;
          const x = cx + lx + (rand() - 0.5) * 2, z = cz + lz + (rand() - 0.5) * 2;
          if (this.acidoEn(x, z) > 0 || this.pendiente(x, z) > 0.6) continue;
          const tipo = rand();
          if (tipo < 0.45) this.muroRoto(grupo, x, z, color(), rand);
          else if (tipo < 0.65) this.columnas(grupo, x, z, color(), rand);
          else if (tipo < 0.78) this.torreCaida(grupo, x, z, color(), rand);
          else if (tipo < 0.88) this.cupula(grupo, x, z, rand);
          else this.chatarraHelios(grupo, x, z, rand);
        }
      }
    }
    fusionar(grupo, this.scene);
  }

  /** Esquina de un edificio: dos muros en L con el borde de arriba roto y ventanas. */
  private muroRoto(grupo: THREE.Group, x: number, z: number, color: string, rand: () => number) {
    const y = this.fondo(x, z) - 0.6;
    const largoX = 4 + rand() * 4, largoZ = 3 + rand() * 4, alto = 2.5 + rand() * 4.5, g = 0.7;
    const sx = rand() < 0.5 ? 1 : -1, sz = rand() < 0.5 ? 1 : -1;
    conDetalle(0.5, () => {
      pieza(grupo, caja(largoX, alto, g, 0.15), toon(color), x + sx * largoX / 2, y + alto / 2, z);
      pieza(grupo, caja(g, alto * 0.8, largoZ, 0.15), toon(color), x, y + alto * 0.4, z + sz * largoZ / 2);
      // Borde roto: bloques a distintas alturas.
      for (let k = 0; k < 3; k++) {
        const bx = x + sx * (largoX * (0.2 + k * 0.28));
        pieza(grupo, caja(largoX * 0.2, 0.6 + rand() * 1.2, g, 0.1), toon(color), bx, y + alto + 0.2, z);
      }
      // Ventanas oscuras.
      for (let k = 0; k < Math.floor(largoX / 2.2); k++) {
        pieza(grupo, caja(0.9, 1.1, g + 0.06, 0.08), toon('#2c2028'), x + sx * (1.4 + k * 2.2), y + alto * 0.6, z, { contorno: false });
      }
      // Cascotes al pie.
      for (let k = 0; k < 3; k++) {
        const c = pieza(grupo, caja(0.6 + rand(), 0.4 + rand() * 0.5, 0.6 + rand(), 0.1), toon(color), x + sx * rand() * largoX, y + 0.75, z + sz * (1 + rand() * 2));
        c.rotation.set(rand(), rand() * 3, rand());
      }
    });
    this.addBlock({ minX: Math.min(x, x + sx * largoX), maxX: Math.max(x, x + sx * largoX), minZ: z - g / 2, maxZ: z + g / 2 });
    this.addBlock({ minX: x - g / 2, maxX: x + g / 2, minZ: Math.min(z, z + sz * largoZ), maxZ: Math.max(z, z + sz * largoZ) });
  }

  /** Columnas de un pórtico: unas en pie, otra caída. */
  private columnas(grupo: THREE.Group, x: number, z: number, color: string, rand: () => number) {
    const y = this.fondo(x, z);
    conDetalle(0.5, () => {
      pieza(grupo, caja(7, 0.4, 3, 0.1), toon('#7a6a66'), x, y + 0.05, z);
      for (let k = 0; k < 4; k++) {
        const px = x - 2.6 + k * 1.75;
        if (k === 2) {
          const caida = pieza(grupo, barril(0.4, 0.45, 4.5, 0.12), toon(color), px + 0.3, y + 0.5, z + 2.2);
          caida.rotation.set(Math.PI / 2, 0, 0.3);
          continue;
        }
        const alto = 2.5 + rand() * 3;
        pieza(grupo, barril(0.4, 0.45, alto, 0.12), toon(color), px, y + alto / 2, z);
        pieza(grupo, caja(1.1, 0.3, 1.1, 0.08), toon(color), px, y + alto + 0.1, z);
        this.addCirculo({ x: px, z, r: 0.5 });
      }
    });
  }

  /** Torre caída de lado, con anillos y una antena rota. */
  private torreCaida(grupo: THREE.Group, x: number, z: number, color: string, rand: () => number) {
    const y = this.fondo(x, z);
    const largo = 9 + rand() * 5, r = 1.3 + rand() * 0.6, giro = rand() < 0.5 ? 0 : Math.PI / 2;
    const torre = new THREE.Group();
    torre.position.set(x, y + r * 0.7, z);
    torre.rotation.y = giro;
    grupo.add(torre);
    conDetalle(0.5, () => {
      pieza(torre, barril(r, r * 1.1, largo, 0.25).rotateZ(Math.PI / 2), toon(color));
      for (const k of [-0.35, 0, 0.35]) pieza(torre, toro(r + 0.05, 0.12).rotateZ(Math.PI / 2), toon('#5e504e'), largo * k, 0, 0);
      for (let k = 0; k < 4; k++) pieza(torre, caja(0.7, 0.9, 0.2, 0.06), toon('#2c2028'), -largo * 0.3 + k * 2, 0.3, r * 0.98, { contorno: false });
      const antena = pieza(torre, capsula(0.1, 3), toon(PALETA.metalOscuro), largo / 2 + 1.4, 0.4, 0);
      antena.rotation.z = Math.PI / 2 - 0.4;
    });
    const hx = giro ? r : largo / 2, hz = giro ? largo / 2 : r;
    this.addBlock({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
    const extremo = largo / 2 + 1.4;
    this.interes.push({
      x: x + Math.cos(giro) * extremo,
      z: z - Math.sin(giro) * extremo,
      tipo: 'antena',
    });
  }

  /** Cúpula de observatorio partida. */
  private cupula(grupo: THREE.Group, x: number, z: number, rand: () => number) {
    const y = this.fondo(x, z);
    const r = 3 + rand() * 1.5;
    conDetalle(0.6, () => {
      pieza(grupo, barril(r, r + 0.2, 1.4, 0.2), toon('#8e7f78'), x, y + 0.5, z);
      const domo = pieza(grupo, esfera(r, 1, 0.8, 1), toon('#b8b0bc'), x, y + 1.2, z);
      domo.rotation.y = rand() * Math.PI * 2;
      // Rendija del telescopio y un boquete.
      pieza(grupo, caja(0.9, r * 0.9, r * 1.6, 0.2), toon('#2c2028'), x, y + 1.2 + r * 0.45, z, { contorno: false });
      pieza(grupo, esfera(r * 0.35, 1, 0.8, 0.5), toon('#2c2028'), x + r * 0.7, y + 1.6, z + r * 0.5, { contorno: false });
      const tubo = pieza(grupo, barril(0.5, 0.7, 4, 0.1), toon(PALETA.metalOscuro), x, y + 3, z);
      tubo.rotation.set(0.6, rand() * 3, 0);
    });
    this.addCirculo({ x, z, r: r * 0.95 });
  }

  /** Restos de una máquina de HELIOS: poste caído con su aro y cristales. */
  private chatarraHelios(grupo: THREE.Group, x: number, z: number, rand: () => number) {
    const y = this.fondo(x, z);
    conDetalle(0.5, () => {
      const poste = pieza(grupo, capsula(0.55, 5), toon(PALETA.chapaHelios), x, y + 0.5, z);
      poste.rotation.set(Math.PI / 2, rand() * 3, 0.1);
      pieza(grupo, toro(0.9, 0.12), brillo(PALETA.purpuraBrillo), x + 1.5, y + 0.4, z, { contorno: false });
      pieza(grupo, esfera(0.5, 1, 1, 0.6), brillo(PALETA.helios), x - 1.8, y + 0.4, z, { contorno: false });
    });
    this.racimo(grupo, x + 2, z + 1, 1.1, rand, false);
    this.addCirculo({ x, z, r: 1.2 });
    this.interes.push({ x, z, tipo: 'antena' });
  }

  // ------------------------------------------------------------ decorado

  /** Rocas, árboles muertos con escarcha y cristales por la llanura. */
  private decorado(semilla: number) {
    const rand = aleatorio(semilla);
    const a = this.arena;
    const grupo = new THREE.Group();
    const libre = (x: number, z: number, margen: number) =>
      Math.hypot(x, z) > 14 && Math.hypot(x - this.padPosition.x, z - this.padPosition.z) > 22 &&
      this.acidoEn(x, z) === 0 && this.pendiente(x, z) < 0.9 && !this.ocupado(x, z, margen);
    let rocas = 0, arboles = 0, cristales = 0, matas = 0;
    for (let k = 0; k < 6000 && (rocas < 140 || arboles < 65 || cristales < 36 || matas < 160); k++) {
      const x = (rand() * 2 - 1) * (a + 8), z = (rand() * 2 - 1) * (a + 8);
      if (!libre(x, z, 2)) continue;
      const que = rand();
      if (que < 0.3 && rocas < 140) { this.roca(grupo, x, z, 0.5 + rand() * rand() * 2.2, rand); rocas++; }
      else if (que < 0.48 && arboles < 65) { this.arbol(grupo, x, z, rand); arboles++; }
      else if (que < 0.58 && cristales < 36) { this.racimo(grupo, x, z, 0.5 + rand() * 0.8, rand); cristales++; }
      else if (matas < 160) { this.mata(grupo, x, z, rand); matas++; }
    }
    fusionar(grupo, this.scene);
  }

  /** Mata seca y helada: tres bolas de hierba muerta, sin colisión. */
  private mata(grupo: THREE.Group, x: number, z: number, rand: () => number) {
    const y = this.fondo(x, z);
    const color = rand() < 0.5 ? '#9a6a5a' : '#8a6a78';
    // Son muchas y pequeñas: poco detalle y sin contorno.
    conDetalle(0.25, () => {
      for (let k = 0; k < 3; k++) {
        const r = 0.25 + rand() * 0.3;
        pieza(grupo, esfera(r, 1.2, 0.7, 1.2), toon(color), x + (rand() - 0.5) * 0.7, y + r * 0.4, z + (rand() - 0.5) * 0.7, { sombra: false, contorno: false });
      }
    });
  }

  /** Árbol muerto: tronco, tres ramas y escarcha. */
  private arbol(grupo: THREE.Group, x: number, z: number, rand: () => number) {
    const y = this.fondo(x, z);
    const alto = 2.5 + rand() * 2.5;
    conDetalle(0.4, () => {
      const tronco = pieza(grupo, capsula(0.22, alto), toon('#4a3230'), x, y + alto / 2, z);
      tronco.rotation.z = (rand() - 0.5) * 0.25;
      for (let k = 0; k < 3; k++) {
        const ang = rand() * Math.PI * 2, largo = 0.9 + rand() * 1.2;
        const rama = pieza(grupo, capsula(0.1, largo), toon('#4a3230'), x + Math.cos(ang) * 0.5, y + alto * (0.55 + k * 0.15), z + Math.sin(ang) * 0.5);
        rama.rotation.set(Math.sin(ang) * 0.9, 0, -Math.cos(ang) * 0.9);
      }
      pieza(grupo, esfera(0.3, 1.2, 0.5, 1.2), toon('#e6e0ee'), x, y + alto + 0.15, z, { contorno: false });
    });
    this.addCirculo({ x, z, r: 0.35 });
    this.interes.push({ x, z, tipo: 'arbol' });
  }

  // ----------------------------------------------------- cielo y horizonte

  private cielo() {
    const grupo = new THREE.Group();
    const cupula = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { horizonte: { value: HORIZON }, medio: { value: MEDIO }, cenit: { value: CENIT } },
        vertexShader: `varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 horizonte; uniform vec3 medio; uniform vec3 cenit; varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 c = mix(horizonte, medio, smoothstep(0.0, 0.3, h));
            c = mix(c, cenit, smoothstep(0.3, 0.95, h));
            // Bandas del velo: franjas más oscuras a media altura.
            c *= 1.0 - 0.08 * step(0.5, fract(h * 9.0 + sin(vDir.x * 3.0) * 0.3)) * smoothstep(0.08, 0.4, h);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    cupula.renderOrder = -10;
    grupo.add(cupula);
    const sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaSol(), fog: false, depthWrite: false, transparent: true }));
    sol.position.set(-330, 120, 190);
    sol.scale.setScalar(110);
    grupo.add(sol);
    for (let i = 0; i < 12; i++) {
      const nube = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaNube(i), fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
      const ang = (i / 12) * Math.PI * 2 + hash(i, 1) * 0.4;
      const d = 360 + hash(i, 2) * 120;
      nube.position.set(Math.cos(ang) * d, 70 + hash(i, 3) * 80, Math.sin(ang) * d);
      const w = 120 + hash(i, 4) * 90;
      nube.scale.set(w, w * 0.32, 1);
      grupo.add(nube);
    }
    this.scene.add(grupo);
    return grupo;
  }

  /** Cordilleras lejanas y las agujas de HELIOS en el horizonte. */
  private horizonte(semilla: number) {
    const rand = aleatorio(semilla);
    const grupo = new THREE.Group();
    const montes = new THREE.MeshBasicMaterial({ color: '#8a4250', fog: false });
    const montesLejos = new THREE.MeshBasicMaterial({ color: '#a8566a', fog: false });
    const nieve = new THREE.MeshBasicMaterial({ color: '#e8c8d4', fog: false });
    for (let i = 0; i < 60; i++) {
      const ang = (i / 60) * Math.PI * 2 + rand() * 0.05;
      const lejano = i % 2 === 0;
      const d = this.half + (lejano ? 260 : 150) + rand() * 60;
      const alto = (lejano ? 90 : 60) + rand() * 70, ancho = 60 + rand() * 60;
      const monte = new THREE.Mesh(new THREE.ConeGeometry(ancho, alto, 5), lejano ? montesLejos : montes);
      monte.position.set(Math.cos(ang) * d, 15 + alto / 2, Math.sin(ang) * d);
      monte.rotation.y = rand() * Math.PI;
      grupo.add(monte);
      if (alto > 110) {
        const cima = new THREE.Mesh(new THREE.ConeGeometry(ancho * 0.28, alto * 0.28, 5), nieve);
        cima.position.set(monte.position.x, 15 + alto * 0.86, monte.position.z);
        cima.rotation.y = monte.rotation.y;
        grupo.add(cima);
      }
    }
    // Agujas de HELIOS: torres finísimas con una luz roja arriba.
    const aguja = new THREE.MeshBasicMaterial({ color: '#3a2236', fog: false });
    const luz = new THREE.MeshBasicMaterial({ color: PALETA.helios, fog: false });
    for (const ang of [0.6, 2.4, 4.1]) {
      const d = this.half + 210;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 6, 190, 6), aguja);
      t.position.set(Math.cos(ang) * d, 95, Math.sin(ang) * d);
      grupo.add(t);
      const l = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), luz);
      l.position.set(t.position.x, 192, t.position.z);
      grupo.add(l);
    }
    fusionar(grupo, this.scene, false);
  }

  /** El cohete en su explanada, al norte: se ve desde casi todo el mapa. */
  private cohete() {
    const grupo = new THREE.Group();
    grupo.position.copy(this.padPosition);
    conDetalle(0.8, () => {
      pieza(grupo, barril(9, 9.5, 0.8, 0.3), toon('#8a6a5e'), 0, 0.4, 0);
      pieza(grupo, barril(2.6, 2.6, 26, 0.6), toon('#efe8de'), 0, 14, 0);
      pieza(grupo, toro(2.62, 0.35), toon('#2a1a18'), 0, 27.2, 0);
      pieza(grupo, barril(2.2, 2.6, 10, 0.5), toon('#efe8de'), 0, 32.4, 0);
      pieza(grupo, punta(2.2, 6.5, 16), toon(PALETA.naranja), 0, 40.6, 0);
      for (const s of [-1, 1]) {
        pieza(grupo, barril(1.1, 1.1, 18, 0.4), toon('#efe8de'), s * 3.7, 9.8, 0);
        pieza(grupo, punta(1.1, 2.6, 12), toon(PALETA.naranja), s * 3.7, 20.2, 0);
      }
      // Torre de servicio.
      for (const cx of [-1.8, 1.8]) for (const cz of [-1.8, 1.8]) pieza(grupo, caja(0.4, 44, 0.4, 0.1), toon('#5a2e26'), 8 + cx, 22, cz);
      for (let y = 3; y < 44; y += 3.5) {
        pieza(grupo, caja(3.6, 0.25, 0.25, 0.08), toon('#5a2e26'), 8, y, -1.8, { contorno: false });
        pieza(grupo, caja(3.6, 0.25, 0.25, 0.08), toon('#5a2e26'), 8, y, 1.8, { contorno: false });
      }
      pieza(grupo, caja(4.4, 0.8, 1.2, 0.2), toon('#5a2e26'), 4, 18, 0);
      pieza(grupo, caja(4.4, 0.8, 1.2, 0.2), toon('#5a2e26'), 4, 30, 0);
      pieza(grupo, esfera(0.5), brillo('#ff2a12'), 8, 44.6, 0, { contorno: false });
    });
    const temporal = new THREE.Group();
    temporal.add(grupo);
    fusionar(temporal, this.scene);
    const p = this.padPosition;
    this.addBlock({ minX: p.x - 5, maxX: p.x + 5, minZ: p.z - 5, maxZ: p.z + 5 });
    this.addBlock({ minX: p.x + 5.5, maxX: p.x + 10.5, minZ: p.z - 2.5, maxZ: p.z + 2.5 });
    this.interes.push({ x: p.x + 8, z: p.z, tipo: 'antena' });
  }

  // ------------------------------------------------------------ nave

  /** Un punto a `largo` m por delante del morro y `lado` m a su izquierda. */
  private enNave(largo: number, lado: number) {
    const g = GIRO_NAVE;
    return { x: NAVE.x + Math.sin(g) * largo + Math.cos(g) * lado, z: NAVE.z + Math.cos(g) * largo - Math.sin(g) * lado };
  }

  /** Choques de la nave: tres círculos a lo largo del casco y las zapatas de atrás. */
  private reservarNave() {
    const k = ESCALA_POSADA;
    for (const largo of [-3.2, 0, 3.2]) this.addCirculo({ ...this.enNave(largo, 0), r: 2.4 });
    for (const lado of [-0.86, 0.86]) this.addCirculo({ ...this.enNave(-0.78 * k, lado * k), r: 0.6 });
  }

  /**
   * La nave de ARES-IX posada: no se fusiona con lo estático porque está
   * animada (luces, antena y ojos, clip «Posada»).
   */
  private navePosada() {
    const m = crearNavePosada();
    m.raiz.position.set(NAVE.x, this.heightAt(NAVE.x, NAVE.z), NAVE.z);
    m.raiz.rotation.y = GIRO_NAVE;
    m.raiz.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.contorno) o.castShadow = o.receiveShadow = true;
    });
    this.scene.add(m.raiz);
    this.mezcladorNave = new THREE.AnimationMixer(m.raiz);
    this.mezcladorNave.clipAction(m.animaciones.find((a) => a.clip.name === 'Posada')!.clip).play();
  }

  /** Tope en el borde, detrás de la muralla de picos, por si alguien la escala. */
  private bordes() {
    const a = this.arena;
    this.addBlock({ minX: -a - 5, maxX: a + 5, minZ: -a - 5, maxZ: -a });
    this.addBlock({ minX: -a - 5, maxX: a + 5, minZ: a, maxZ: a + 5 });
    this.addBlock({ minX: -a - 5, maxX: -a, minZ: -a, maxZ: a });
    this.addBlock({ minX: a, maxX: a + 5, minZ: -a, maxZ: a });
  }

  // ------------------------------------------------------- cada fotograma

  /** El cielo y la luz siguen al jugador; el mapa de sombras así basta pequeño. */
  follow(target: THREE.Vector3) {
    this.sky.position.set(target.x, 0, target.z);
    this.sun.target.position.copy(target);
    this.sun.position.set(target.x - 55, target.y + 46, target.z + 30);
  }

  /** Ya no hay billboards: se mantiene para no tocar game.ts. */
  faceCamera(yaw: number) {
    void yaw;
  }

  /** Anima el ácido, las burbujas y el vapor. Llamar una vez por fotograma. */
  update(dt: number) {
    this.tiempo += dt;
    this.mezcladorNave?.update(dt);
    if (this.acido) this.acido.uniforms.tiempo.value = this.tiempo;
    const b = this.burbujas;
    if (b) {
      for (let i = 0; i < b.x.length; i++) {
        const f = (this.tiempo * 0.5 + b.fase[i]) % 1;
        const s = f < 0.85 ? 0.3 + f : Math.max(0.01, (1 - f) * 7);
        this.m.makeScale(s, s, s).setPosition(b.x[i], NIVEL_ACIDO + f * 0.6, b.z[i]);
        b.malla.setMatrixAt(i, this.m);
      }
      b.malla.instanceMatrix.needsUpdate = true;
    }
    for (const v of this.vapores) {
      const { base, fase } = v.userData as { base: THREE.Vector3; fase: number };
      v.position.set(base.x + Math.sin(this.tiempo * 0.1 + fase) * 4, base.y + Math.sin(this.tiempo * 0.3 + fase) * 0.6, base.z + Math.cos(this.tiempo * 0.08 + fase) * 4);
    }
  }

  // ------------------------------------------------------------ colisiones

  private addBlock(block: Block) {
    this.blocks.push(block);
    const m = 1.5;
    for (let cx = Math.floor((block.minX - m) / CELL); cx <= Math.floor((block.maxX + m) / CELL); cx++)
      for (let cz = Math.floor((block.minZ - m) / CELL); cz <= Math.floor((block.maxZ + m) / CELL); cz++) {
        const key = cx * 1000 + cz;
        const lista = this.grid.get(key);
        if (lista) lista.push(block);
        else this.grid.set(key, [block]);
      }
  }

  private addCirculo(c: Circulo) {
    this.circulos.push(c);
    const m = c.r + 1.5;
    for (let cx = Math.floor((c.x - m) / CELL); cx <= Math.floor((c.x + m) / CELL); cx++)
      for (let cz = Math.floor((c.z - m) / CELL); cz <= Math.floor((c.z + m) / CELL); cz++) {
        const key = cx * 1000 + cz;
        const lista = this.gridCirculos.get(key);
        if (lista) lista.push(c);
        else this.gridCirculos.set(key, [c]);
      }
  }

  /**
   * Carta del mapa vista desde arriba, para el minimapa: los colores del suelo
   * con sombreado de relieve, el ácido y las ruinas. Cubre de −mitad a +mitad
   * en x y z (el norte, −z, arriba). Se pinta la primera vez y se guarda.
   */
  carta() {
    if (this.cartaHecha) return this.cartaHecha;
    const lado = this.ladoSuelo, col = this.coloresSuelo!, mitad = this.half;
    const paso = (mitad * 2) / (lado - 1);
    const base = document.createElement('canvas');
    base.width = base.height = lado;
    const img = base.getContext('2d')!.createImageData(lado, lado);
    const hondo = new THREE.Color('#7a2cd8'), orilla = new THREE.Color('#d7a0ff'), borde = new THREE.Color('#2a1e36');
    const sol = new THREE.Color(1.2, 1.0, 0.8), c = new THREE.Color();
    for (let iz = 0; iz < lado; iz++) {
      for (let ix = 0; ix < lado; ix++) {
        const x = -mitad + ix * paso, z = -mitad + iz * paso, i = iz * lado + ix;
        c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
        // Relieve: luz del noroeste.
        const sombra = Math.max(0.55, Math.min(1.35, 1 + (this.fondo(x - 1.5, z - 1.5) - this.fondo(x + 1.5, z + 1.5)) * 0.12));
        // Con la luz cálida del sol, como se ve el suelo en la partida.
        c.multiplyScalar(sombra).multiply(sol).offsetHSL(0, 0.08, 0);
        // Fuera de la arena, la cordillera del borde en oscuro.
        const fuera = smoothstep(this.arena + 2, this.arena + 14, Math.pow(x ** 4 + z ** 4, 0.25));
        c.lerp(borde, fuera * 0.8);
        const d = this.acidoEn(x, z);
        if (d > 0) c.copy(hondo).lerp(orilla, 1 - smoothstep(0, 1.2, d));
        const hex = c.getHex();
        img.data.set([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255], i * 4);
      }
    }
    base.getContext('2d')!.putImageData(img, 0, 0);
    // Al doble, para que las ruinas se lean nítidas encima.
    const imagen = document.createElement('canvas');
    imagen.width = imagen.height = lado * 2;
    const ctx = imagen.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0, lado * 2, lado * 2);
    const k = 2 / paso;
    ctx.fillStyle = '#c4bcc4';
    ctx.strokeStyle = '#2a2030';
    ctx.lineWidth = 1;
    for (const b of this.blocks) {
      const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
      if (w > 30 || d > 30) continue; // los muros del borde no
      const x = (b.minX + mitad) * k, z = (b.minZ + mitad) * k;
      ctx.fillRect(x, z, Math.max(1.5, w * k), Math.max(1.5, d * k));
      ctx.strokeRect(x, z, Math.max(1.5, w * k), Math.max(1.5, d * k));
    }
    this.cartaHecha = { imagen, mitad: mitad + paso / 2 };
    return this.cartaHecha;
  }

  /** ¿Hay algo sólido a menos de `margen` de este punto? */
  ocupado(x: number, z: number, margen = 0) {
    const key = Math.floor(x / CELL) * 1000 + Math.floor(z / CELL);
    if (this.grid.get(key)?.some((b) => x > b.minX - margen && x < b.maxX + margen && z > b.minZ - margen && z < b.maxZ + margen)) return true;
    return !!this.gridCirculos.get(key)?.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margen);
  }

  /**
   * Un sitio libre para colocar contenido (altares, cajas, NPC…): en llano,
   * fuera del ácido y sin nada sólido cerca, entre dos distancias al centro.
   */
  lugarLibre(rand: () => number, distancia: readonly [number, number], margen = 4, lejosDe: { x: number; z: number; r: number }[] = []) {
    for (let k = 0; k < 600; k++) {
      const ang = rand() * Math.PI * 2, d = distancia[0] + rand() * (distancia[1] - distancia[0]);
      const x = Math.cos(ang) * d, z = Math.sin(ang) * d;
      if (Math.abs(x) > this.arena - 10 || Math.abs(z) > this.arena - 10) continue;
      if (this.acidoEn(x, z) > 0 || this.pendiente(x, z) > 0.35 || this.ocupado(x, z, margen)) continue;
      if (lejosDe.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
      return { x, z };
    }
    return null;
  }

  /**
   * Empuja un círculo fuera de cualquier ruina, roca o montaña que pise.
   * Devuelve la posición corregida en `out` (puede ser el mismo objeto).
   */
  resolve(x: number, z: number, radius: number, out: { x: number; z: number }) {
    out.x = x;
    out.z = z;
    const key = Math.floor(x / CELL) * 1000 + Math.floor(z / CELL);
    for (const c of this.gridCirculos.get(key) ?? []) {
      const dx = out.x - c.x, dz = out.z - c.z;
      const min = c.r + radius, d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1e-3;
      out.x = c.x + (dx / d) * min;
      out.z = c.z + (dz / d) * min;
    }
    for (const b of this.grid.get(key) ?? []) {
      const nx = Math.max(b.minX, Math.min(out.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(out.z, b.maxZ));
      const dx = out.x - nx, dz = out.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        out.x = nx + (dx / d) * radius;
        out.z = nz + (dz / d) * radius;
      } else {
        const izq = out.x - b.minX, der = b.maxX - out.x, atras = out.z - b.minZ, frente = b.maxZ - out.z;
        const m = Math.min(izq, der, atras, frente);
        if (m === izq) out.x = b.minX - radius;
        else if (m === der) out.x = b.maxX + radius;
        else if (m === atras) out.z = b.minZ - radius;
        else out.z = b.maxZ + radius;
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------- texturas

const rampas = new Map<boolean, THREE.DataTexture>();

/**
 * Rampa de tres tonos como la del kit: el suelo se sombrea como los
 * personajes. La del suelo es más clara (la luz del velo llega rasante y con
 * la del kit la llanura quedaba en el tono medio).
 */
function rampa(clara = false) {
  let r = rampas.get(clara);
  if (r) return r;
  r = new THREE.DataTexture(new Uint8Array(clara ? [135, 210, 255] : [110, 185, 255]), 3, 1, THREE.RedFormat);
  r.minFilter = r.magFilter = THREE.NearestFilter;
  r.generateMipmaps = false;
  r.needsUpdate = true;
  rampas.set(clara, r);
  return r;
}

/**
 * Textura del suelo (en gris, multiplica el color de cada zona): ondas de
 * arena, motas y alguna grieta, para que la llanura no se vea lisa.
 */
function texturaSuelo() {
  const t = lienzo(256, 256, (ctx) => {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, 256, 256);
    // Ondas de arena: curvas suaves un poco más oscuras.
    ctx.strokeStyle = 'rgba(120, 110, 110, 0.16)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      for (let x = -8; x <= 264; x += 8) {
        const y = k * 29 + 10 + Math.sin(x * 0.05 + k) * 6;
        if (x === -8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Motas.
    for (let k = 0; k < 260; k++) {
      ctx.fillStyle = k % 3 ? 'rgba(90, 70, 70, 0.18)' : 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(hash(k, 1) * 256, hash(k, 2) * 256, 2 + hash(k, 3) * 3, 2 + hash(k, 4) * 2);
    }
    // Grietas de hielo.
    ctx.strokeStyle = 'rgba(80, 60, 70, 0.28)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      let x = hash(k, 7) * 256, y = hash(k, 8) * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += (hash(k, j + 9) - 0.5) * 40; y += (hash(j, k + 9) - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function lienzo(ancho: number, alto: number, pintar: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  pintar(c.getContext('2d')!);
  return new THREE.CanvasTexture(c);
}

function texturaSol() {
  return lienzo(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(255, 240, 215, 0.95)');
    g.addColorStop(0.3, 'rgba(255, 200, 160, 0.35)');
    g.addColorStop(1, 'rgba(255, 170, 140, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#fff2de';
    ctx.beginPath();
    ctx.arc(64, 64, 16, 0, Math.PI * 2);
    ctx.fill();
  });
}

function texturaNube(semilla: number) {
  return lienzo(256, 96, (ctx) => {
    for (let k = 0; k < 9; k++) {
      const x = 40 + hash(semilla, k) * 176, y = 40 + hash(k, semilla) * 26, r = 22 + hash(semilla + k, 3) * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(240, 170, 160, 0.55)');
      g.addColorStop(1, 'rgba(240, 170, 160, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 96);
    }
  });
}

let vapor: THREE.CanvasTexture | null = null;
function texturaVapor() {
  if (vapor) return vapor;
  vapor = lienzo(128, 64, (ctx) => {
    const g = ctx.createRadialGradient(64, 32, 0, 64, 32, 60);
    g.addColorStop(0, 'rgba(200, 120, 255, 0.5)');
    g.addColorStop(1, 'rgba(160, 80, 220, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
  });
  return vapor;
}
