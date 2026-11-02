import * as THREE from 'three';
import { PALETA, toon } from './modelos/kit.ts';
import { crearNave } from './modelos/nave.ts';

// META SPACE — Cinemática de entrada.
//
// La nave de ARES-IX entra en plano por detrás de la cámara, da un tonel, se
// aleja hacia el planeta Meta y cruza el cielo soltando las letras del título:
// cada una sale de la nave al pasar por encima de su hueco, salta a su sitio
// con muelle y luego flota en ola. La nave frena con los retros y se queda
// flotando bajo el nombre. Al pulsar, despega atravesando el título y deja
// paso al menú. Todo en código (Three.js y el kit de modelos), sin assets.
//
// Se salta con clic / Intro / Espacio (el primero lleva al título completo, el
// segundo despega) y con Escape. El juego la omite con `prefers-reduced-motion`.
// Cada fotograma sale solo del tiempo `t` (la estela también), así que saltar
// a cualquier momento es exacto y las capturas se repiten.

export interface IntroOptions {
  /** Segundos antes de poder saltarla con clic (siempre se puede con Esc). */
  minVer?: number;
  /** Solo para capturas: congela la cinemática en este segundo. */
  fijo?: number;
  /** Solo para capturas, con `fijo`: segundos de despegue desde `fijo`. */
  fijoSalida?: number;
}

// ------------------------------------------------------------- guion

/** Momentos clave en segundos. */
const T = {
  frena: 4.7, // retros encendidos
  llega: 5.45, // la nave se queda flotando
  sector: 5.15, // «SECTOR DELTA»
  lema: 5.75,
  pista: 6.5,
  completo: 6.4, // adonde salta el primer clic
  despegue: 0.95, // lo que dura la salida antes de dar paso al menú
};

/**
 * Ruta de la nave en metros, con la cámara en el origen mirando a -z:
 * [segundo, x, y, z]. Detrás de la cámara, en plano grande de espaldas, lejos a
 * la izquierda, cruce por detrás del título y vuelta hasta quedar flotando.
 */
const RUTA: readonly (readonly [number, number, number, number])[] = [
  [0.35, -3.4, -2.6, 3.2],
  [1.2, -1.5, -0.8, -5],
  [2.2, -6.5, 2.2, -17],
  [3.0, -1.5, 3.4, -20],
  [3.8, 4.5, 3.1, -19],
  [4.6, 6.5, 0.8, -14],
  [T.llega, 0.9, -0.75, -8],
];

/** Toberas en el espacio de la nave (casco en el origen): góndolas y central. */
const TOBERAS = [new THREE.Vector3(0.66, -0.24, -1.65), new THREE.Vector3(-0.66, -0.24, -1.65), new THREE.Vector3(0, 0.04, -1.72)];
const SALIDA = new THREE.Vector3(0.3, 0.75, -1).normalize();
const TITULO = 'META SPACE';
const SECTOR = 'SECTOR DELTA';
/** Pentatónica ascendente: cada letra que cae suena un poco más alta. */
const NOTAS = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];

const TAU = Math.PI * 2;
const suave = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const tramo = (t: number, a: number, b: number) => suave((t - a) / (b - a));
const azar = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Interpolación cúbica monótona (Fritsch–Carlson): lleva el tiempo al
 * parámetro de la curva sin retroceder y con velocidad continua. Termina
 * con pendiente cero, así la nave llega frenando.
 */
function monotona(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d = xs.slice(1).map((x, k) => (ys[k + 1] - ys[k]) / (x - xs[k]));
  const m = xs.map((_, k) => (k === 0 ? d[0] : k === n - 1 ? 0 : d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2));
  for (let k = 0; k < n - 1; k++) {
    const a = m[k] / d[k], b = m[k + 1] / d[k], h = a * a + b * b;
    if (h > 9) {
      const s = 3 / Math.sqrt(h);
      m[k] = s * a * d[k];
      m[k + 1] = s * b * d[k];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k], s = (x - xs[k]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[k] + (s3 - 2 * s2 + s) * h * m[k] + (-2 * s3 + 3 * s2) * ys[k + 1] + (s3 - s2) * h * m[k + 1];
  };
}

// ------------------------------------------------------------ estilo

const CSS = `
.msi { position: fixed; inset: 0; z-index: 60; overflow: hidden; background: #07081a; cursor: pointer;
  font-family: 'Rubik', ui-rounded, system-ui, sans-serif; user-select: none; -webkit-user-select: none;
  transition: opacity .5s ease; }
.msi--fuera { opacity: 0; pointer-events: none; }
.msi__lienzo { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.msi__marca { position: absolute; left: 0; right: 0; top: 12vh; display: flex; flex-direction: column; align-items: center;
  pointer-events: none; }
.msi__titulo { position: relative; margin: 0; display: flex; align-items: baseline; line-height: 1; font-weight: 900;
  font-size: clamp(44px, min(13vw, 19vh), 150px); letter-spacing: -.01em; }
.msi__letra { display: inline-block; color: #fff; opacity: 0; will-change: transform, opacity;
  -webkit-text-stroke: .075em ${PALETA.contorno}; paint-order: stroke fill; text-shadow: .05em .07em 0 #25245f; }
.msi__letra--space { color: #56e5ee; }
.msi__hueco { display: inline-block; width: .3em; }
.msi__sector { margin: .7em 0 0; display: flex; color: ${PALETA.plasma}; font-weight: 800;
  font-size: clamp(12px, min(1.7vw, 2.6vh), 21px); text-shadow: 0 2px 0 #25245f; }
.msi__sector span { display: inline-block; width: 1.25em; text-align: center; opacity: 0; }
.msi__lema { margin: .9em 16px 0; color: #c6cbe0; font-weight: 500; text-align: center; opacity: 0;
  font-size: clamp(13px, min(1.6vw, 2.4vh), 19px); text-shadow: 0 2px 0 #0b0a1d; }
.msi__pista { position: absolute; left: 0; right: 0; bottom: 6vh; margin: 0; text-align: center; color: #c6cbe0; opacity: 0;
  font-weight: 700; font-size: clamp(11px, 1.3vw, 14px); letter-spacing: .22em; text-transform: uppercase; pointer-events: none;
  text-shadow: 0 2px 0 #0b0a1d, 0 0 12px #0b0a1d; }
.msi__negro { position: absolute; inset: 0; background: #07081a; pointer-events: none; }
`;

function ponerEstilo() {
  if (document.getElementById('msi-estilo')) return;
  const s = document.createElement('style');
  s.id = 'msi-estilo';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ------------------------------------------------------------ escena

/** Cielo: degradado vertical de casi negro a violeta, con el velo rojizo abajo. */
function cielo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const d = g.createLinearGradient(0, 0, 0, 256);
  d.addColorStop(0, '#05061a');
  d.addColorStop(0.45, '#151338');
  d.addColorStop(0.75, '#2c1942');
  d.addColorStop(1, '#4d1f3c');
  g.fillStyle = d;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Punto suave para estrellas y estela. */
function punto(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)');
  d.addColorStop(0.35, 'rgba(255,255,255,.85)');
  d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function estrellas(n: number, tam: number, semilla: number, mapa: THREE.Texture): THREE.Points {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = azar(semilla + i * 3) * TAU;
    const y = azar(semilla + i * 3 + 1) * 1.3 - 0.3;
    const r = Math.sqrt(1 - Math.min(1, y * y));
    pos.set([Math.sin(a) * r * 400, y * 400, -Math.abs(Math.cos(a)) * r * 400 - 40], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: '#ffe9d8', size: tam, sizeAttenuation: false, map: mapa, transparent: true, depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

/**
 * Meta: óxido rojo con mesetas oscuras, mares helados y un casquete de hielo
 * que baja hacia el ecuador (el planeta se congela). El color sale por píxel
 * de la dirección de cada punto, con cortes duros como en un dibujo, y la luz
 * es la misma rampa toon de los personajes.
 */
function planeta(radio: number): THREE.Mesh {
  const mat = toon(PALETA.blanco).clone();
  // La luz de la escena está pensada para la nave: el planeta, algo más apagado.
  mat.color.set('#c4c4c4');
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDir = normalize(position);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDir;
        vec3 colorMeta(vec3 n) {
          float r1 = sin(n.x * 7.0 + sin(n.z * 5.0) * 1.5) * sin(n.y * 6.0 + n.z * 4.0) + 0.5 * sin(n.z * 13.0 + n.x * 9.0)
            + 0.18 * sin(n.x * 31.0 + n.z * 23.0) * sin(n.y * 29.0 - n.x * 17.0);
          float r2 = sin(n.x * 17.0 + n.y * 11.0) * sin(n.z * 15.0 - n.y * 7.0);
          float hielo = n.y + r1 * 0.12 + r2 * 0.05;
          if (hielo > 0.72) return vec3(0.79, 0.86, 1.0);
          if (hielo > 0.64) return vec3(0.69, 0.42, 0.40);
          if (r1 < -0.55) return vec3(0.28, 0.38, 0.66);
          if (r1 > 0.55 || r2 > 0.7) return vec3(0.21, 0.03, 0.02);
          return vec3(0.45, 0.06, 0.03);
        }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * colorMeta(vDir), opacity );');
  };
  return new THREE.Mesh(new THREE.SphereGeometry(radio, 128, 96), mat);
}

/**
 * El velo de HELIOS: brillo rojo en el borde del planeta. Dentro, una capa que
 * se enciende hacia el contorno; fuera, un halo (caras traseras de una esfera
 * algo mayor) que va del borde del planeta, con toda la fuerza, a cero.
 */
function velo(radioPlaneta: number, escala: number, fuera: boolean): THREE.Mesh {
  // En el borde del planeta, las caras traseras del halo miran a la cámara con este coseno.
  const borde = Math.sqrt(1 - 1 / (escala * escala));
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(fuera ? '#ff4a3a' : '#ff7a4a') }, borde: { value: borde } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: fuera
      ? `uniform vec3 color; uniform float borde; varying vec3 vN; varying vec3 vV;
         void main() { float a = pow(clamp(-dot(vN, vV) / borde, 0.0, 1.0), 2.2) * 0.75; gl_FragColor = vec4(color * a, a); }`
      : `uniform vec3 color; varying vec3 vN; varying vec3 vV;
         void main() { float a = pow(1.0 - max(dot(vN, vV), 0.0), 2.4) * 0.85; gl_FragColor = vec4(color * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: fuera ? THREE.BackSide : THREE.FrontSide,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radioPlaneta * escala, 96, 64), mat);
}

// ------------------------------------------------------------ sonido

let audio: AudioContext | null = null;

/** Sonidos sintetizados; sin permiso de audio todavía, no suena y ya está. */
function sonar(fn: (a: AudioContext, t0: number) => void) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    if (audio.state !== 'running') return;
    fn(audio, audio.currentTime);
  } catch {
    // Sin audio no pasa nada: la cinemática sigue.
  }
}

function tono(a: AudioContext, t0: number, tipo: OscillatorType, de: number, a2: number, dur: number, vol: number) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(de, t0);
  o.frequency.exponentialRampToValueAtTime(a2, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Soplido de ruido filtrado: la nave pasando junto a la cámara o despegando. */
function soplido(a: AudioContext, t0: number, dur: number, de: number, pico: number, vol: number) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const datos = buf.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = a.createBufferSource(), filtro = a.createBiquadFilter(), g = a.createGain();
  fuente.buffer = buf;
  filtro.type = 'bandpass';
  filtro.Q.value = 1.2;
  filtro.frequency.setValueAtTime(de, t0);
  filtro.frequency.exponentialRampToValueAtTime(pico, t0 + dur * 0.45);
  filtro.frequency.exponentialRampToValueAtTime(de * 0.7, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  fuente.connect(filtro).connect(g).connect(a.destination);
  fuente.start(t0);
}

// ------------------------------------------------------------ cinemática

interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  /** Fuerza de los motores: 0 apagados, 1 crucero, 2 a tope. */
  empuje: number;
}

interface Letra {
  el: HTMLElement;
  i: number;
  suelta: number;
  desde: { x: number; y: number };
  hueco: { x: number; y: number };
  giro: number;
  sentido: number;
}

const nuevaPose = (): Pose => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), empuje: 0 });

/** Cinemática a pantalla completa. Devuelve función para desmontarla. */
export function showIntro(root: HTMLElement, onDone: () => void, opts: IntroOptions = {}): () => void {
  const minVer = opts.minVer ?? 1.2;
  ponerEstilo();

  const capa = document.createElement('div');
  capa.className = 'msi';
  const letrasHtml = [...TITULO].map((ch, i) =>
    ch === ' ' ? '<span class="msi__hueco"></span>'
      : `<span class="msi__letra${i > 4 ? ' msi__letra--space' : ''}" aria-hidden="true">${ch}</span>`).join('');
  capa.innerHTML = `
    <canvas class="msi__lienzo"></canvas>
    <div class="msi__marca">
      <p class="msi__titulo" aria-label="${TITULO}">${letrasHtml}</p>
      <p class="msi__sector" aria-label="${SECTOR}">${[...SECTOR].map((ch) => `<span aria-hidden="true">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</p>
      <p class="msi__lema">Meta se congela bajo el velo de HELIOS. Apágalo.</p>
    </div>
    <p class="msi__pista">${window.matchMedia?.('(pointer: coarse)').matches ? 'toca para despegar' : 'clic o Intro para despegar'}</p>
    <div class="msi__negro"></div>`;
  root.appendChild(capa);

  const lienzo = capa.querySelector<HTMLCanvasElement>('.msi__lienzo')!;
  const titulo = capa.querySelector<HTMLElement>('.msi__titulo')!;
  const sector = [...capa.querySelectorAll<HTMLElement>('.msi__sector span')];
  const lema = capa.querySelector<HTMLElement>('.msi__lema')!;
  const pista = capa.querySelector<HTMLElement>('.msi__pista')!;
  const negro = capa.querySelector<HTMLElement>('.msi__negro')!;
  const letras: Letra[] = [...capa.querySelectorAll<HTMLElement>('.msi__letra')].map((el, i) => ({
    el, i, suelta: 99, desde: { x: 0, y: 0 }, hueco: { x: 0, y: 0 },
    giro: (i % 2 ? 1 : -1) * (150 + 40 * (i % 3)), sentido: i % 2 ? -1 : 1,
  }));

  // Escena: cielo, estrellas y Meta con el velo rojo de HELIOS.
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  } catch {
    // Sin WebGL no hay cinemática: directos al menú.
    capa.remove();
    queueMicrotask(onDone);
    return () => undefined;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const escena = new THREE.Scene();
  escena.background = cielo();
  const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const mapaPunto = punto();
  const finas = estrellas(520, 1.6, 11, mapaPunto);
  const gordas = estrellas(70, 3.4, 977, mapaPunto);
  escena.add(finas, gordas);

  const RADIO = 160;
  const meta = new THREE.Group();
  meta.position.set(0, -190, -118);
  const superficie = planeta(RADIO);
  // El polo se inclina hacia atrás: de frente, óxido; el hielo asoma por el horizonte.
  superficie.rotation.set(-1.0, 0, 0.25);
  meta.add(superficie, velo(RADIO, 1.012, false), velo(RADIO, 1.06, true));
  escena.add(meta);

  escena.add(new THREE.HemisphereLight('#c3c6ff', '#3d2440', 1.35));
  const clave = new THREE.DirectionalLight('#fff1dc', 2.5);
  clave.position.set(-4, 6, 6);
  const rebote = new THREE.DirectionalLight('#ff6a4a', 0.9);
  rebote.position.set(3, -5, -4);
  escena.add(clave, rebote);

  // La nave cuelga de un pivote en el centro del casco: así gira sobre sí misma.
  const nave = crearNave();
  const pivote = new THREE.Group();
  nave.raiz.position.y = -1.5;
  pivote.add(nave.raiz);
  escena.add(pivote);
  const mezclador = new THREE.AnimationMixer(nave.raiz);
  // Solo los clips que usa la cinemática (los de posarse son para el mapa).
  const USADOS = ['Turbo', 'Volar', 'Frenar', 'Flotar'];
  const clips = new Map(nave.animaciones.filter((a) => USADOS.includes(a.clip.name)).map((a) => {
    const accion = mezclador.clipAction(a.clip);
    accion.play();
    return [a.clip.name, { accion, dur: a.clip.duration }] as const;
  }));

  // Estela: partículas que se recalculan desde el tiempo en cada fotograma.
  const TASA = 150, VIDA = 0.85, MAX = Math.ceil(TASA * VIDA + 2) * TOBERAS.length;
  const estelaPos = new Float32Array(MAX * 3), estelaCol = new Float32Array(MAX * 3);
  const estelaGeo = new THREE.BufferGeometry();
  estelaGeo.setAttribute('position', new THREE.BufferAttribute(estelaPos, 3));
  estelaGeo.setAttribute('color', new THREE.BufferAttribute(estelaCol, 3));
  const estela = new THREE.Points(estelaGeo, new THREE.PointsMaterial({
    size: 0.28, map: mapaPunto, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  estela.frustumCulled = false;
  escena.add(estela);
  const COLORES = { nucleo: new THREE.Color('#e9feff'), ada: new THREE.Color(PALETA.ada), fuego: new THREE.Color(PALETA.naranja) };
  const chispa = new THREE.Color();

  // ---------------------------------------------------------- ruta

  let curva = new THREE.CatmullRomCurve3();
  const uDeT = monotona(RUTA.map((c) => c[0]), RUTA.map((_, k) => k / (RUTA.length - 1)));
  /** En vertical la ruta se estrecha para no salirse tanto de la pantalla. */
  const trazar = (aspecto: number) => {
    const kx = Math.min(1, Math.max(0.45, aspecto / 1.7));
    curva = new THREE.CatmullRomCurve3(RUTA.map(([, x, y, z]) => new THREE.Vector3(x * kx, y, z)), false, 'centripetal');
  };

  const ARRIBA = new THREE.Vector3(0, 1, 0), EJE_Z = new THREE.Vector3(0, 0, 1), OJO = new THREE.Vector3(0, 0.15, 0);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), mat = new THREE.Matrix4();
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), eu = new THREE.Euler();

  /** Orienta el morro (+z) hacia `adelante`, con el alabeo dado (radianes). */
  const orientar = (adelante: THREE.Vector3, alabeo: number, q: THREE.Quaternion) => {
    const izq = va.crossVectors(ARRIBA, adelante).normalize();
    const arriba = vb.crossVectors(adelante, izq);
    mat.makeBasis(izq, arriba, adelante);
    q.setFromRotationMatrix(mat).multiply(qa.setFromAxisAngle(EJE_Z, alabeo));
  };
  const rumbo = (t: number) => {
    curva.getTangent(uDeT(t), vc);
    return Math.atan2(vc.x, vc.z);
  };

  /** Pose de la nave en vuelo (sin despegue): ruta, alabeo en los giros, tonel y espera. */
  const poseVuelo = (t: number, p: Pose) => {
    let giro = rumbo(t + 0.06) - rumbo(t - 0.06);
    giro = Math.atan2(Math.sin(giro), Math.cos(giro)) / 0.12;
    const u = uDeT(t);
    curva.getPoint(u, p.pos);
    curva.getTangent(u, vc);
    const alabeo = Math.min(1.05, Math.max(-1.05, -0.42 * giro)) + TAU * tramo(t, 1.05, 1.95);
    orientar(vc, alabeo, p.quat);
    // Llega de cara a la cámara, en 3/4, y se queda meciéndose.
    const w = tramo(t, T.frena - 0.4, T.llega + 0.15);
    if (w > 0) {
      const hacia = vc.copy(OJO).sub(p.pos);
      eu.set(-0.1 + Math.sin(t * 1.1) * 0.03, Math.atan2(hacia.x, hacia.z) + 0.6, Math.sin(t * 0.8) * 0.07, 'YXZ');
      p.quat.slerp(qb.setFromEuler(eu), w);
      const deriva = tramo(t, T.llega - 0.3, T.llega + 1);
      p.pos.x += Math.sin(t * 0.7) * 0.18 * deriva;
      p.pos.y += Math.sin(t * 1.15) * 0.12 * deriva;
    }
    p.empuje = t < 0.3 ? 0 : 1 + 0.7 * (1 - tramo(t, 1.7, 2.3)) - 0.65 * tramo(t, T.frena - 0.1, T.frena + 0.3);
  };

  let tSalida: number | null = opts.fijo !== undefined && opts.fijoSalida !== undefined ? opts.fijo : null;
  const base = nuevaPose();
  const pose = (t: number, p: Pose) => {
    if (tSalida === null || t <= tSalida) return poseVuelo(t, p);
    // Despegue: se encoge un instante, apunta arriba y sale disparada.
    const tau = t - tSalida;
    poseVuelo(tSalida, base);
    orientar(SALIDA, tau * 2, qb);
    p.quat.copy(base.quat).slerp(qb, tramo(tau, 0, 0.3));
    const avance = 40 * Math.max(0, tau - 0.15) ** 2 - 0.35 * Math.sin(Math.PI * Math.min(1, tau / 0.3));
    p.pos.copy(base.pos).addScaledVector(SALIDA, avance);
    p.empuje = 2.2;
  };

  const mira = new THREE.Vector3();
  const ponerCamara = (t: number, nave: THREE.Vector3) => {
    const salida = tSalida === null ? 0 : 0.04 * Math.exp(-(((t - tSalida - 0.25) / 0.2) ** 2));
    const sacudida = 0.05 * Math.exp(-(((t - 1.0) / 0.25) ** 2)) + salida;
    camara.position.set(
      Math.sin(t * 0.31) * 0.25 + Math.sin(t * 57) * sacudida,
      0.15 + Math.sin(t * 0.23) * 0.1 + Math.sin(t * 43) * sacudida,
      2.2 * (1 - suave(t / 3.4)),
    );
    camara.lookAt(mira.set(0, -0.3, -20).lerp(nave, 0.07));
    camara.updateMatrixWorld();
  };

  // ---------------------------------------------------------- medidas

  let W = 1, H = 1, em = 100, medir = true;
  const enPantalla = (v: THREE.Vector3) => {
    va.copy(v).project(camara);
    return { x: (va.x + 1) / 2 * W, y: (1 - va.y) / 2 * H };
  };

  /** Huecos de las letras y en qué momento pasa la nave por encima de cada uno. */
  const medirLetras = () => {
    medir = false;
    em = parseFloat(getComputedStyle(titulo).fontSize) || 100;
    const caja = titulo.getBoundingClientRect();
    for (const l of letras) {
      l.hueco = { x: caja.left + l.el.offsetLeft + l.el.offsetWidth / 2, y: caja.top + l.el.offsetTop + l.el.offsetHeight / 2 };
      l.suelta = 99;
    }
    const p = nuevaPose();
    let k = 0;
    for (let s = 2.2; s <= 5 && k < letras.length; s += 1 / 60) {
      poseVuelo(s, p);
      ponerCamara(s, p.pos);
      const e = enPantalla(p.pos);
      while (k < letras.length && e.x >= letras[k].hueco.x) {
        letras[k].suelta = s;
        letras[k].desde = e;
        k++;
      }
    }
    // Si la nave no llega a alguna (pantallas muy estrechas), cae desde abajo.
    for (; k < letras.length; k++) {
      letras[k].suelta = 4.2 + k * 0.05;
      letras[k].desde = { x: letras[k].hueco.x, y: letras[k].hueco.y + em * 2 };
    }
  };

  const encajar = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    camara.aspect = W / H;
    camara.fov = W < H ? 64 : 50;
    camara.updateProjectionMatrix();
    trazar(W / H);
    medir = true;
  };
  encajar();
  window.addEventListener('resize', encajar);
  void document.fonts?.ready.then(() => { medir = true; });

  // ---------------------------------------------------------- fotograma

  const pn = nuevaPose(), pe = nuevaPose(), vt = new THREE.Vector3(), vd = new THREE.Vector3();

  /** Pesos de cada clip de la nave según el momento: turbo, crucero, frenada y espera. */
  const animarNave = (t: number) => {
    const ts = tSalida === null ? 0 : tramo(t - tSalida, 0, 0.2);
    const pesos: Record<string, [number, number]> = {
      Turbo: [(1 - tramo(t, 1.7, 2.3)) * (1 - ts) + ts, t],
      Volar: [tramo(t, 1.7, 2.3) * (1 - tramo(t, T.frena - 0.1, T.frena + 0.15)) * (1 - ts), t],
      Frenar: [tramo(t, T.frena - 0.1, T.frena + 0.15) * (1 - tramo(t, T.frena + 0.85, T.frena + 1.2)) * (1 - ts), t - T.frena],
      Flotar: [tramo(t, T.frena + 0.85, T.frena + 1.2) * (1 - ts), t],
    };
    for (const [nombre, [peso, tiempo]] of Object.entries(pesos)) {
      const c = clips.get(nombre);
      if (!c) continue;
      c.accion.setEffectiveWeight(peso);
      // Los bucles dan la vuelta; la frenada se queda en su último fotograma.
      c.accion.time = nombre === 'Frenar' ? Math.min(c.dur - 0.001, Math.max(0, tiempo)) : tiempo % c.dur;
    }
    mezclador.update(0);
  };

  const pintarEstela = (t: number) => {
    let n = 0;
    for (let k = Math.ceil((t - VIDA) * TASA); k <= Math.floor(t * TASA); k++) {
      const tau = k / TASA;
      pose(tau, pe);
      if (pe.empuje <= 0) continue;
      const vida = VIDA * (0.45 + 0.55 * Math.min(1, pe.empuje));
      const f = (t - tau) / vida;
      if (f >= 1) continue;
      vd.set(0, 0, -1).applyQuaternion(pe.quat);
      for (let j = 0; j < TOBERAS.length; j++) {
        const semilla = k * 3 + j;
        if (azar(semilla) > 0.35 + 0.4 * pe.empuje) continue;
        vt.copy(TOBERAS[j]).applyQuaternion(pe.quat).add(pe.pos)
          .addScaledVector(vd, (0.4 + 1.6 * pe.empuje) * (t - tau))
          .add(va.set(azar(semilla + 0.1) - 0.5, azar(semilla + 0.2) - 0.5, azar(semilla + 0.3) - 0.5).multiplyScalar(1.0 * (t - tau)));
        if (vt.distanceTo(camara.position) < 5) continue;
        // Nace casi blanca, pasa a cyan y se apaga en naranja.
        const c = f < 0.18 ? chispa.lerpColors(COLORES.nucleo, COLORES.ada, f / 0.18)
          : chispa.lerpColors(COLORES.ada, COLORES.fuego, Math.min(1, (f - 0.18) / 0.5));
        c.multiplyScalar(0.7 * (1 - f) ** 1.6);
        estelaPos.set([vt.x, vt.y, vt.z], n * 3);
        estelaCol.set([c.r, c.g, c.b], n * 3);
        if (++n >= MAX) break;
      }
      if (n >= MAX) break;
    }
    estelaGeo.setDrawRange(0, n);
    estelaGeo.attributes.position.needsUpdate = true;
    estelaGeo.attributes.color.needsUpdate = true;
  };

  const pintarLetras = (t: number) => {
    const ts = tSalida === null ? -1 : t - tSalida;
    for (const l of letras) {
      const tau = t - l.suelta;
      if (tau < 0) {
        l.el.style.opacity = '0';
        continue;
      }
      // Muelle con rebote: sale de la nave, se pasa un poco de su hueco y vuelve.
      const m = 1 - Math.exp(-5 * tau) * Math.cos(11 * tau);
      const ms = 1 - Math.exp(-6 * tau) * Math.cos(14 * tau);
      const tumbo = 1 - suave(tau / 0.65);
      let dx = (l.desde.x - l.hueco.x) * (1 - m);
      let dy = (l.desde.y - l.hueco.y) * (1 - m) - Math.sin(Math.PI * Math.min(1, tau / 0.5)) * em * 0.35;
      let rz = l.giro * tumbo;
      const ry = 360 * tumbo * l.sentido;
      const aplasta = 0.2 * Math.exp(-6 * tau) * Math.sin(14 * tau);
      let sx = (0.15 + 0.85 * ms) * (1 - aplasta * 0.6), sy = (0.15 + 0.85 * ms) * (1 + aplasta);
      // Ya en su sitio, flotan en ola, y de vez en cuando las recorre un brillo.
      const ola = tramo(tau, 0.5, 1.1);
      dy += Math.sin(t * 2.4 - l.i * 0.55) * em * 0.05 * ola;
      rz += Math.sin(t * 2.4 - l.i * 0.55 - 0.9) * 3 * ola;
      let luz = Math.exp(-6 * tau);
      if (t > 6.2) luz += 0.7 * Math.exp(-(((((t - 6.2) % 3.6) - l.i * 0.06) / 0.08) ** 2));
      let op = Math.min(1, tau / 0.06);
      // Despegue: la nave las arrastra hacia arriba al pasar.
      if (ts >= 0) {
        const e = Math.max(0, ts - Math.abs(l.i - 4.5) * 0.025);
        dy -= 1100 * e * e;
        dx += (l.hueco.x - W / 2) * 1.2 * e;
        rz += l.sentido * 240 * e;
        sx *= 1 + e;
        sy *= 1 + e;
        op *= 1 - suave(e / 0.4);
      }
      l.el.style.opacity = op.toFixed(3);
      l.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) perspective(${(em * 8).toFixed(0)}px) ` +
        `rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      l.el.style.filter = luz > 0.02 ? `drop-shadow(0 0 ${(0.35 * luz).toFixed(3)}em rgba(94, 224, 255, ${Math.min(1, luz).toFixed(2)}))` : '';
    }

    const apaga = ts < 0 ? 1 : 1 - tramo(ts, 0, 0.3);
    sector.forEach((s, j) => {
      const tau = t - T.sector - j * 0.045;
      // Se enciende como una radio: parpadea y cae en su sitio.
      const op = tau < 0 ? 0 : tau < 0.18 ? (Math.sin(tau * 120) > 0 ? 1 : 0.25) : 1;
      const y = tau < 0 ? 0 : Math.exp(-7 * tau) * Math.cos(12 * tau) * 0.8;
      s.style.opacity = (op * apaga).toFixed(3);
      s.style.transform = `translateY(${y.toFixed(3)}em)`;
    });
    const kl = tramo(t, T.lema, T.lema + 0.5);
    lema.style.opacity = (kl * apaga).toFixed(3);
    lema.style.transform = `translateY(${((1 - kl) * 10).toFixed(1)}px)`;
    pista.style.opacity = t < T.pista ? '0' : (tramo(t, T.pista, T.pista + 0.4) * (0.55 + 0.45 * Math.sin(t * 3.2)) * apaga).toFixed(3);
  };

  let t = opts.fijo !== undefined ? opts.fijo + (opts.fijoSalida ?? 0) : 0;
  let destello = 0;
  const pintar = (dt: number) => {
    const antes = t;
    if (opts.fijo === undefined) t += dt;
    if (medir) medirLetras();

    pose(t, pn);
    pivote.position.copy(pn.pos);
    pivote.quaternion.copy(pn.quat);
    animarNave(t);
    ponerCamara(t, pn.pos);
    meta.rotation.y = t * 0.02;
    finas.rotation.y = gordas.rotation.y = t * 0.004;
    (gordas.material as THREE.PointsMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 2.3);
    pintarEstela(t);
    pintarLetras(t);
    destello *= Math.exp(-dt * 7);
    negro.style.opacity = Math.max(1 - tramo(t, 0, 0.9), destello).toFixed(3);
    renderer.render(escena, camara);

    // Sonidos al cruzar cada momento (no al saltar por encima).
    if (t - antes > 0 && t - antes < 0.2) {
      const cruza = (x: number) => antes < x && t >= x;
      if (cruza(0.8)) sonar((a, t0) => soplido(a, t0, 0.9, 300, 1800, 0.12));
      letras.forEach((l, i) => { if (cruza(l.suelta)) sonar((a, t0) => tono(a, t0, 'triangle', NOTAS[i], NOTAS[i] * 0.98, 0.16, 0.05)); });
      if (cruza(T.frena)) sonar((a, t0) => soplido(a, t0, 0.45, 900, 2400, 0.05));
      if (cruza(T.sector)) sonar((a, t0) => tono(a, t0, 'sine', 220, 880, 0.6, 0.06));
    }
    if (tSalida !== null && t - tSalida >= T.despegue && opts.fijo === undefined) acabar();
  };

  // ---------------------------------------------------------- control

  let vivo = true, raf = 0;
  const soltar = () => {
    vivo = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', alTecla);
    window.removeEventListener('resize', encajar);
    capa.removeEventListener('pointerdown', alClic);
  };
  const destruir = () => {
    capa.remove();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  /** Fin tras el despegue: el menú se monta debajo y esta capa se funde encima. */
  const acabar = () => {
    if (!vivo) return;
    soltar();
    onDone();
    capa.classList.add('msi--fuera');
    window.setTimeout(destruir, 550);
  };
  const terminar = () => {
    if (!vivo) return;
    soltar();
    destruir();
    onDone();
  };
  const despegar = () => {
    if (tSalida !== null) return;
    tSalida = t;
    sonar((a, t0) => {
      soplido(a, t0, 1.1, 200, 2600, 0.14);
      tono(a, t0, 'sawtooth', 90, 420, 0.9, 0.025);
    });
  };
  const alClic = () => {
    if (t < minVer || tSalida !== null) return;
    sonar(() => undefined); // el primer gesto desbloquea el audio
    if (t < T.completo) {
      t = T.completo;
      destello = 0.85;
    } else despegar();
  };
  const alTecla = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' && e.code !== 'Enter' && e.code !== 'Space') return;
    // Sin esto, el título que se abre ahora recibe el foco en «Jugar» y la
    // misma pulsación lo activa: la partida empezaba sin pasar por el menú.
    e.preventDefault();
    if (e.code === 'Escape') terminar();
    else alClic();
  };
  capa.addEventListener('pointerdown', alClic);
  window.addEventListener('keydown', alTecla);

  let ultimo = performance.now();
  const fotograma = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    pintar(dt);
    raf = requestAnimationFrame(fotograma);
  };
  raf = requestAnimationFrame((ahora) => {
    ultimo = ahora;
    pintar(0);
    raf = requestAnimationFrame(fotograma);
  });

  return () => {
    if (!vivo) return;
    soltar();
    destruir();
  };
}
