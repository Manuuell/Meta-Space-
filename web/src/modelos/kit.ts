import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Kit de modelado de Meta Space: personajes hechos de piezas, como en Roblox,
// con sombreado toon de tres tonos, contorno oscuro y ojos de dibujo animado.
//
// Cada modelo es una jerarquía de nodos con nombre (cadera, brazo_i, tapa…)
// y sus animaciones son AnimationClip normales sobre esos nombres: se
// reproducen con AnimationMixer y se exportan tal cual a GLB.

export const PALETA = {
  contorno: '#16111f',
  traje: '#e8eeff',
  trajeSombra: '#c9cdda',
  naranja: '#ff8a3d',
  plasma: '#ffb347',
  ada: '#5ee0ff',
  helios: '#ff4a3a',
  metal: '#b8bccb',
  metalOscuro: '#5b6075',
  oscuro: '#2a2f45',
  arena: '#e8d27a',
  cristal: '#c56bff',
  // HELIOS: metal oscuro con detalles púrpura que brillan y un ojo rojo.
  purpura: '#8a2cf0',
  purpuraBrillo: '#c77dff',
  metalHelios: '#62667c',
  chapaHelios: '#474a5e',
  oscuroHelios: '#2a2638',
  diente: '#f1ecdc',
  blanco: '#ffffff',
  negro: '#0d0b14',
} as const;

// ------------------------------------------------------------ materiales

let rampa: THREE.DataTexture | null = null;

/** Rampa de tres tonos: luz, medio y sombra, sin degradado. */
function rampaToon(): THREE.DataTexture {
  if (rampa) return rampa;
  rampa = new THREE.DataTexture(new Uint8Array([90, 175, 255]), 3, 1, THREE.RedFormat);
  rampa.minFilter = THREE.NearestFilter;
  rampa.magFilter = THREE.NearestFilter;
  rampa.generateMipmaps = false;
  rampa.needsUpdate = true;
  return rampa;
}

const toons = new Map<string, THREE.MeshToonMaterial>();
const brillos = new Map<string, THREE.MeshBasicMaterial>();

/** Material toon compartido por color. */
export function toon(color: string): THREE.MeshToonMaterial {
  let m = toons.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: rampaToon() });
    toons.set(color, m);
  }
  return m;
}

/** Material sin luz: ojos, luces y el núcleo de ADA brillan siempre igual. */
export function brillo(color: string): THREE.MeshBasicMaterial {
  let m = brillos.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    brillos.set(color, m);
  }
  return m;
}

let materialContorno: THREE.MeshBasicMaterial | null = null;

/**
 * Contorno por casco invertido: la misma geometría, empujada a lo largo de
 * sus normales y pintada solo por detrás. Grosor fijo en unidades del modelo,
 * así todas las piezas tienen la misma línea, como en un dibujo.
 */
export function contorno(): THREE.MeshBasicMaterial {
  if (materialContorno) return materialContorno;
  materialContorno = new THREE.MeshBasicMaterial({ color: PALETA.contorno, side: THREE.BackSide });
  materialContorno.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed += normal * 0.032;',
    );
  };
  return materialContorno;
}

// -------------------------------------------------------------- geometrías

let detalle = 1;

/**
 * Construye con otro nivel de detalle (1 = visor). Las hordas usan menos: con
 * cientos de copias, cada segmento de una esfera cuenta.
 */
export function conDetalle<T>(nivel: number, fn: () => T): T {
  const previo = detalle;
  detalle = nivel;
  try {
    return fn();
  } finally {
    detalle = previo;
  }
}

const seg = (n: number, minimo: number) => Math.max(minimo, Math.round(n * detalle));

/** Caja redondeada: la pieza básica (normales suaves, buen contorno). */
export function caja(ancho: number, alto: number, fondo: number, radio = 0.08): THREE.BufferGeometry {
  const r = Math.min(radio, ancho / 2, alto / 2, fondo / 2) * 0.999;
  return new RoundedBoxGeometry(ancho, alto, fondo, seg(3, 2), r);
}

export function esfera(radio: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  return new THREE.SphereGeometry(radio, seg(24, 8), seg(16, 6)).scale(sx, sy, sz);
}

/** Cápsula vertical centrada en el origen; `largo` es la parte recta. */
export function capsula(radio: number, largo: number): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(radio, largo, seg(6, 2), seg(14, 6));
}

/**
 * Barril de perfil redondeado (cuerpo de robot, tapas, cubos). Se construye
 * girando el perfil, así no tiene aristas duras que rompan el contorno.
 */
export function barril(radioArriba: number, radioAbajo: number, alto: number, redondeo = 0.1): THREE.BufferGeometry {
  const r = Math.min(redondeo, alto / 2, radioArriba, radioAbajo);
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -alto / 2)];
  const pasos = seg(6, 2);
  const esquina = (cx: number, cy: number, desde: number, hasta: number) => {
    for (let i = 0; i <= pasos; i++) {
      const a = desde + ((hasta - desde) * i) / pasos;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  esquina(radioAbajo - r, -alto / 2 + r, -Math.PI / 2, 0);
  esquina(radioArriba - r, alto / 2 - r, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(0, alto / 2));
  const g = new THREE.LatheGeometry(pts, seg(28, 10));
  g.computeVertexNormals();
  return g;
}

export function toro(radio: number, tubo: number): THREE.BufferGeometry {
  return new THREE.TorusGeometry(radio, tubo, seg(10, 4), seg(32, 12)).rotateX(Math.PI / 2);
}

export function cono(radio: number, alto: number): THREE.BufferGeometry {
  return barril(0.02, radio, alto, Math.min(0.06, radio / 2));
}

// ------------------------------------------------------------------ piezas

/** Nodo vacío con nombre: una articulación que las animaciones mueven. */
export function nodo(nombre: string, padre: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = nombre;
  g.position.set(x, y, z);
  padre.add(g);
  return g;
}

/** Malla con contorno opcional, colgada de `padre` en (x, y, z). */
export function pieza(
  padre: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0, y = 0, z = 0,
  opciones: { nombre?: string; contorno?: boolean; sombra?: boolean } = {},
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  if (opciones.nombre) m.name = opciones.nombre;
  m.position.set(x, y, z);
  m.castShadow = opciones.sombra ?? true;
  padre.add(m);
  if (opciones.contorno ?? true) {
    const c = new THREE.Mesh(geo, contorno());
    c.userData.contorno = true;
    m.add(c);
  }
  return m;
}

/**
 * Ojo de dibujo animado: esclera blanca, pupila que se puede mover (nodo
 * `pupila_<lado>`) y un brillo. El nodo `ojo_<lado>` se escala para parpadear.
 */
export function ojo(padre: THREE.Object3D, lado: string, radio: number, x: number, y: number, z: number, colorPupila: string = PALETA.negro): THREE.Group {
  const g = nodo(`ojo_${lado}`, padre, x, y, z);
  pieza(g, esfera(radio, 1, 1, 0.6), toon(PALETA.blanco));
  const p = nodo(`pupila_${lado}`, g, 0, 0, radio * 0.42);
  pieza(p, esfera(radio * 0.52, 1, 1, 0.5), brillo(colorPupila), 0, 0, 0, { contorno: false, sombra: false });
  pieza(p, esfera(radio * 0.16), brillo(PALETA.blanco), radio * 0.2, radio * 0.22, radio * 0.2, { contorno: false, sombra: false });
  return g;
}

// ------------------------------------------------------------- animación

/** Clave: tiempo en segundos y tres valores (grados, metros o escala). */
export type Clave = readonly [t: number, x: number, y: number, z: number];

export interface Animacion {
  clip: THREE.AnimationClip;
  bucle: boolean;
  grupo: 'movimiento' | 'ataque' | 'reaccion';
  descripcion: string;
}

export interface Modelo {
  id: string;
  nombre: string;
  rol: string;
  raiz: THREE.Group;
  animaciones: Animacion[];
}

const e = new THREE.Euler();
const q = new THREE.Quaternion();

/** Pista de rotación en grados (orden XYZ). */
export function rot(nodo: string, claves: readonly Clave[]): THREE.QuaternionKeyframeTrack {
  const valores: number[] = [];
  for (const [, x, y, z] of claves) {
    q.setFromEuler(e.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z)));
    valores.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${nodo}.quaternion`, claves.map((c) => c[0]), valores);
}

/** Pista de posición como desplazamiento sobre la posición de reposo del nodo. */
export function mov(modelo: THREE.Object3D, nodo: string, claves: readonly Clave[]): THREE.VectorKeyframeTrack {
  const base = modelo.getObjectByName(nodo)?.position ?? new THREE.Vector3();
  const valores = claves.flatMap(([, x, y, z]) => [base.x + x, base.y + y, base.z + z]);
  return new THREE.VectorKeyframeTrack(`${nodo}.position`, claves.map((c) => c[0]), valores);
}

/** Pista de escala (valores absolutos). */
export function esc(nodo: string, claves: readonly Clave[]): THREE.VectorKeyframeTrack {
  return new THREE.VectorKeyframeTrack(`${nodo}.scale`, claves.map((c) => c[0]), claves.flatMap(([, x, y, z]) => [x, y, z]));
}

/**
 * Ciclo muestreado a 30 fps: `fn` recibe la fase (0 → 1) y devuelve los tres
 * valores. Con senos en múltiplos de 2π, el ciclo cierra sin salto.
 */
export function ciclo(duracion: number, fn: (fase: number) => readonly [number, number, number], fps = 30): Clave[] {
  const n = Math.max(2, Math.round(duracion * fps));
  return Array.from({ length: n + 1 }, (_, i) => {
    const [x, y, z] = fn(i / n);
    return [(i / n) * duracion, x, y, z] as const;
  });
}

const suave = (t: number) => t * t * (3 - 2 * t);

/**
 * Poses clave unidas con aceleración y frenada (smoothstep), muestreadas a
 * 30 fps: el movimiento arranca y llega con peso, no a velocidad constante.
 */
export function poses(claves: readonly Clave[], fps = 30): Clave[] {
  const fin = claves[claves.length - 1][0];
  const n = Math.max(2, Math.round(fin * fps));
  const salida: Clave[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * fin;
    let k = 0;
    while (k < claves.length - 2 && claves[k + 1][0] < t) k++;
    const a = claves[k], b = claves[Math.min(k + 1, claves.length - 1)];
    const f = b[0] > a[0] ? suave(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])))) : 1;
    salida.push([t, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]);
  }
  return salida;
}

/** Parpadeo dentro de un ciclo: abierto, cerrado en `en` y abierto otra vez. */
export function parpadeo(duracion: number, en: number): Clave[] {
  return [[0, 1, 1, 1], [en - 0.06, 1, 1, 1], [en, 1, 0.1, 1], [en + 0.07, 1, 1, 1], [duracion, 1, 1, 1]];
}

export function animacion(
  nombre: string, duracion: number, pistas: THREE.KeyframeTrack[],
  grupo: Animacion['grupo'], descripcion: string, bucle = true,
): Animacion {
  return { clip: new THREE.AnimationClip(nombre, duracion, pistas), bucle, grupo, descripcion };
}

/** Mallas y triángulos del modelo (sin contar los contornos). */
export function medir(raiz: THREE.Object3D): { mallas: number; triangulos: number; alto: number } {
  let mallas = 0, triangulos = 0;
  raiz.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.contorno) return;
    mallas++;
    const g = o.geometry as THREE.BufferGeometry;
    triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  const caja3 = new THREE.Box3().setFromObject(raiz);
  return { mallas, triangulos: Math.round(triangulos), alto: caja3.max.y - caja3.min.y };
}
