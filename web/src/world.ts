import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RUN } from './data';
import { rampaToon } from './modelos/kit';
import { cloudTexture, groundTexture } from './sprites';

// Meta se congela bajo el velo de HELIOS: un horizonte gris azulado y frío que
// sube hacia un cenit violeta, teñido del rojo del velo. La niebla usa el color
// del horizonte para que lo lejano se funda en él.
export const HORIZON = new THREE.Color('#b4c6dc');
const MIDSKY = new THREE.Color('#7f8fba');
const VEIL = new THREE.Color('#b0607a');
const ZENITH = new THREE.Color('#33264a');

/** Caja de colisión alineada con los ejes, en el plano XZ. */
export interface Block {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Lake {
  x: number;
  z: number;
  r: number;
}

const CELL = 8;

// El terreno se muestrea una vez en una cuadrícula de 1 m y luego se interpola:
// cientos de enemigos preguntan su altura en cada fotograma.
const HALF = RUN.arena + 70;
const RES = 1;
const SIDE = Math.round((HALF * 2) / RES) + 1;
const LAKE_LEVEL = -0.5;

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

function smoothstep(a: number, b: number, v: number) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function random(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** Material toon del mundo: la misma rampa de tres tonos que los personajes. */
function toonMat(params: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: rampaToon(), ...params });
}

/** Sol pálido y pequeño: apenas atraviesa el velo. */
function sunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 246, 240, 0.85)');
  glow.addColorStop(0.3, 'rgba(230, 220, 255, 0.3)');
  glow.addColorStop(1, 'rgba(200, 200, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#fff8f2';
  ctx.beginPath();
  ctx.arc(64, 64, 13, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

/**
 * Lo estático del mapa: terreno helado, cielo, ruinas congeladas, cristales,
 * antenas de HELIOS y la plataforma de lanzamiento. Lo que bloquea el paso se
 * guarda en una cuadrícula para que cientos de enemigos no comprueben cada
 * obstáculo en cada fotograma. Casi todo va en InstancedMesh: pocas llamadas
 * de dibujo aunque el mapa esté lleno.
 */
export class World {
  readonly blocks: Block[] = [];
  private grid = new Map<number, Block[]>();
  readonly sun: THREE.DirectionalLight;
  readonly padPosition = new THREE.Vector3(0, 0, -62);
  private heights = new Float32Array(SIDE * SIDE);
  private lakes: Lake[] = [];
  private matrix = new THREE.Matrix4();
  private sky: THREE.Group;
  private snow!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private beacons!: THREE.MeshBasicMaterial;

  constructor(readonly scene: THREE.Scene) {
    scene.background = HORIZON;
    scene.fog = new THREE.Fog(HORIZON, 55, 270);

    this.placeLakes();
    this.sampleHeights();

    scene.add(new THREE.HemisphereLight('#dbe8ff', '#2c3352', 1.6));

    // Sol bajo y frío: el velo nunca lo deja subir del todo.
    this.sun = new THREE.DirectionalLight('#fff1e6', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -45;
    cam.right = cam.top = 45;
    cam.near = 1;
    cam.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.sky = this.buildSky();
    this.buildTerrain();
    this.buildRuins();
    this.buildAntennas();
    this.buildCrystals();
    this.buildSkyline();
    this.buildLaunchPad();
    this.buildProps();
    this.buildSnowfall();
  }

  // ---------------------------------------------------------- Terreno

  /** Lagos helados: llanos de hielo en zonas abiertas, lejos del inicio y del cohete. */
  private placeLakes() {
    const rand = random(911);
    let tries = 0;
    while (this.lakes.length < 5 && tries++ < 400) {
      const r = 9 + rand() * 8;
      const x = (rand() * 2 - 1) * (RUN.arena - r - 10);
      const z = (rand() * 2 - 1) * (RUN.arena - r - 10);
      if (Math.hypot(x, z) < r + 16) continue;
      if (Math.hypot(x - this.padPosition.x, z - this.padPosition.z) < r + 24) continue;
      if (this.lakes.some((l) => Math.hypot(l.x - x, l.z - z) < l.r + r + 10)) continue;
      this.lakes.push({ x, z, r });
    }
  }

  /** 1 en el hielo de un lago, 0 fuera; la orilla es una rampa suave. */
  private lakeAt(x: number, z: number) {
    let v = 0;
    for (const l of this.lakes) v = Math.max(v, smoothstep(l.r, l.r - 4, Math.hypot(x - l.x, z - l.z)));
    return v;
  }

  /** La forma del mundo. Solo se usa para rellenar la cuadrícula. */
  private rawHeight(x: number, z: number) {
    // Ventisqueros suaves en la zona de juego...
    let h = (fbm(x * 0.025, z * 0.025) - 0.45) * 5 + (fbm(x * 0.09 + 40, z * 0.09) - 0.5) * 0.8;
    // ...y montañas heladas en el borde, que cierran el mapa sin muros invisibles.
    const edge = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(RUN.arena - 14, RUN.arena + 40, edge) ** 1.4 * (14 + fbm(x * 0.02, z * 0.02) * 18);
    // Los lagos se hunden un poco y quedan planos.
    h += (LAKE_LEVEL - h) * this.lakeAt(x, z);
    // Llano donde se empieza y donde está el cohete.
    const start = smoothstep(14, 5, Math.hypot(x, z));
    const pad = smoothstep(22, 13, Math.hypot(x - this.padPosition.x, z - this.padPosition.z));
    h += (0 - h) * Math.max(start, pad);
    return h;
  }

  private sampleHeights() {
    for (let iz = 0; iz < SIDE; iz++)
      for (let ix = 0; ix < SIDE; ix++)
        this.heights[iz * SIDE + ix] = this.rawHeight(ix * RES - HALF, iz * RES - HALF);
  }

  /** Altura del suelo en un punto, interpolada. */
  heightAt(x: number, z: number) {
    const gx = Math.max(0, Math.min(SIDE - 1.001, (x + HALF) / RES));
    const gz = Math.max(0, Math.min(SIDE - 1.001, (z + HALF) / RES));
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const i = iz * SIDE + ix;
    const h = this.heights;
    const a = h[i] + (h[i + 1] - h[i]) * fx;
    const b = h[i + SIDE] + (h[i + SIDE + 1] - h[i + SIDE]) * fx;
    return a + (b - a) * fz;
  }

  private buildTerrain() {
    const segments = Math.round((HALF * 2) / 2);
    const geometry = new THREE.PlaneGeometry(HALF * 2, HALF * 2, segments, segments).rotateX(-Math.PI / 2);
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const snow = new THREE.Color('#eef3fb');
    const drift = new THREE.Color('#c9d7ee');
    const ice = new THREE.Color('#8cc7e8');
    const rock = new THREE.Color('#4b5574');
    const c = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      const y = this.heightAt(x, z);
      position.setY(i, y);
      // Nieve con manchas de nieve vieja; lo empinado es roca desnuda y los
      // lagos, hielo azul.
      const slope = Math.hypot(this.heightAt(x + 1, z) - this.heightAt(x - 1, z),
                               this.heightAt(x, z + 1) - this.heightAt(x, z - 1)) / 2;
      c.copy(snow).lerp(drift, smoothstep(0.45, 0.7, fbm(x * 0.06 + 13, z * 0.06)) * 0.8);
      c.lerp(rock, smoothstep(0.45, 1.2, slope));
      c.lerp(ice, smoothstep(0.3, 0.9, this.lakeAt(x, z)));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const texture = groundTexture();
    texture.repeat.set(HALF / 4, HALF / 4);
    const ground = new THREE.Mesh(geometry, toonMat({ map: texture, vertexColors: true }));
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Brillo del hielo: un disco algo reflectante sobre cada lago.
    const sheen = new THREE.MeshPhongMaterial({
      color: '#a8dcf5', specular: '#ffffff', shininess: 90, transparent: true, opacity: 0.45, depthWrite: false,
    });
    for (const l of this.lakes) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(l.r - 2.5, 40).rotateX(-Math.PI / 2), sheen);
      disc.position.set(l.x, LAKE_LEVEL + 0.04, l.z);
      disc.receiveShadow = true;
      this.scene.add(disc);
    }

    // Más allá del terreno, un anillo hasta el horizonte para que no haya borde.
    // Empieza dentro de las montañas del límite, que lo tapan por dentro.
    const far = new THREE.Mesh(
      new THREE.RingGeometry(HALF - 8, 1100, 64).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#c6d4ea' }),
    );
    far.position.y = 13;
    this.scene.add(far);
  }

  // ------------------------------------------------------------- Cielo

  private buildSky() {
    const group = new THREE.Group();

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          horizon: { value: HORIZON }, mid: { value: MIDSKY }, veil: { value: VEIL }, zenith: { value: ZENITH },
        },
        vertexShader: `varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 horizon; uniform vec3 mid; uniform vec3 veil; uniform vec3 zenith; varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.25, h));
            // El velo: una franja rojiza alta, lo único cálido del cielo.
            c = mix(c, veil, smoothstep(0.22, 0.5, h) * (1.0 - smoothstep(0.5, 0.85, h)) * 0.55);
            c = mix(c, zenith, smoothstep(0.45, 0.95, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    // Primero de todo: sin escribir profundidad, lo demás se pinta encima.
    dome.renderOrder = -10;
    group.add(dome);

    // Sol pálido y bajo, en la misma dirección que la luz.
    const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTexture(), fog: false, depthWrite: false, transparent: true,
    }));
    sunDisc.position.set(-300, 110, 170);
    sunDisc.scale.setScalar(70);
    group.add(sunDisc);

    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTexture(i * 7 + 3), fog: false, depthWrite: false, transparent: true,
      }));
      const angle = (i / 14) * Math.PI * 2 + hash(i, 1) * 0.4;
      const dist = 330 + hash(i, 2) * 90;
      cloud.position.set(Math.cos(angle) * dist, 55 + hash(i, 3) * 70, Math.sin(angle) * dist);
      const w = 90 + hash(i, 4) * 80;
      cloud.scale.set(w, w * 0.375, 1);
      group.add(cloud);
    }

    this.scene.add(group);
    return group;
  }

  /** Nieve que cae alrededor del jugador: un único Points que se repite en un cubo. */
  private buildSnowfall() {
    const count = 1800;
    const box = new THREE.Vector3(90, 36, 90);
    const seeds = new Float32Array(count * 3);
    const rand = random(4242);
    for (let i = 0; i < count; i++) seeds.set([rand() * box.x, rand() * box.y, rand() * box.z], i * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        center: { value: new THREE.Vector3() },
        box: { value: box },
        scale: { value: 900 },
      },
      vertexShader: `uniform float time; uniform vec3 center; uniform vec3 box; uniform float scale;
        varying float vFade;
        void main() {
          vec3 p = position;
          // Cada copo cae a su ritmo y se mece; luego se envuelve en el cubo
          // que sigue al jugador, así nunca se acaba.
          float speed = 1.6 + fract(p.x * 0.37) * 1.4;
          p.y -= time * speed;
          p.x += sin(time * 0.7 + p.y * 0.3) * 1.2 + time * 0.8;
          p.z += cos(time * 0.5 + p.x * 0.2) * 0.8;
          vec3 origin = center - box * 0.5;
          p = mod(p - origin, box) + origin;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(scale * (0.05 + fract(p.z * 0.71) * 0.05) / -mv.z, 9.0);
          vFade = 1.0 - smoothstep(25.0, 48.0, -mv.z);
        }`,
      fragmentShader: `varying float vFade;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, (1.0 - smoothstep(0.3, 0.5, d)) * 0.85 * vFade);
        }`,
    });
    this.snow = new THREE.Points(geometry, material);
    this.snow.frustumCulled = false;
    this.snow.renderOrder = 5;
    this.scene.add(this.snow);
  }

  /** El cielo, la luz y la nieve siguen al jugador; el mapa de sombras así basta pequeño. */
  follow(target: THREE.Vector3) {
    this.sky.position.set(target.x, 0, target.z);
    this.sun.target.position.copy(target);
    this.sun.position.set(target.x - 50, target.y + 42, target.z + 28);

    const t = performance.now() / 1000;
    const u = this.snow.material.uniforms;
    u.time.value = t;
    (u.center.value as THREE.Vector3).set(target.x, target.y + 12, target.z);
    // Las luces de las antenas laten despacio: HELIOS escucha.
    this.beacons.color.setRGB(1, 0.16 + 0.12 * Math.sin(t * 2.4), 0.12).multiplyScalar(0.7 + 0.3 * Math.sin(t * 2.4));
  }

  // ----------------------------------------------------------- Ruinas

  /** Comprueba que un sitio está libre: ni el inicio, ni el cohete, ni lagos, ni bloques. */
  private free(x: number, z: number, clearance: number, lakes = true) {
    if (Math.hypot(x, z) < 12 + clearance) return false;
    if (Math.hypot(x - this.padPosition.x, z - this.padPosition.z) < 16 + clearance) return false;
    if (lakes && this.lakeAt(x, z) > 0) return false;
    return !this.blockAt(x, z, clearance);
  }

  /** Lo más bajo bajo una huella rectangular: así nada queda flotando. */
  private groundUnder(x: number, z: number, w: number, d: number) {
    return Math.min(
      this.heightAt(x - w / 2, z - d / 2), this.heightAt(x + w / 2, z - d / 2),
      this.heightAt(x - w / 2, z + d / 2), this.heightAt(x + w / 2, z + d / 2), this.heightAt(x, z));
  }

  private buildRuins() {
    const rand = random(503);

    const shapes: { x: number; z: number; w: number; d: number; h: number }[] = [];
    let attempts = 0;
    while (shapes.length < 70 && attempts++ < 2000) {
      const x = (rand() * 2 - 1) * (RUN.arena - 12);
      const z = (rand() * 2 - 1) * (RUN.arena - 12);
      if (!this.free(x, z, 0)) continue;

      const w = 1.5 + rand() * 5;
      const d = 1.5 + rand() * 5;
      const h = rand() < 0.25 ? 4 + rand() * 7 : 0.6 + rand() * 2.2;
      if (shapes.some((s) => Math.abs(s.x - x) < (s.w + w) / 2 + 3 && Math.abs(s.z - z) < (s.d + d) / 2 + 3)) continue;
      shapes.push({ x, z, w, d, h });
    }

    const box = new THREE.BoxGeometry(1, 1, 1);
    const stone = new THREE.InstancedMesh(box, toonMat(), shapes.length);
    const caps = new THREE.InstancedMesh(box, toonMat({ color: '#f4f8ff' }), shapes.length);
    stone.castShadow = stone.receiveShadow = true;
    caps.castShadow = caps.receiveShadow = true;

    // Carámbanos colgando del borde de lo alto, que es lo que más se ve.
    const icicle = new THREE.ConeGeometry(0.16, 1, 5).rotateX(Math.PI).translate(0, -0.5, 0);
    const icicleMat = toonMat({ color: '#bfe6fb', emissive: '#22506e' });
    const icicles: THREE.Matrix4[] = [];

    const color = new THREE.Color();
    const q = new THREE.Quaternion();
    shapes.forEach((s, i) => {
      // Medio enterradas: la base se hunde por debajo del punto más bajo.
      const ground = this.groundUnder(s.x, s.z, s.w, s.d);
      const depth = s.h + 1;
      const top = ground - 1 + depth;
      this.matrix.compose(new THREE.Vector3(s.x, ground - 1 + depth / 2, s.z), q, new THREE.Vector3(s.w, depth, s.d));
      stone.setMatrixAt(i, this.matrix);
      color.setHSL(0.6 + rand() * 0.05, 0.12 + rand() * 0.12, 0.34 + rand() * 0.14);
      stone.setColorAt(i, color);

      // Capa de nieve encima, algo más ancha que la piedra.
      const capH = 0.22 + rand() * 0.2;
      this.matrix.compose(new THREE.Vector3(s.x, top + capH / 2 - 0.05, s.z), q, new THREE.Vector3(s.w + 0.2, capH, s.d + 0.2));
      caps.setMatrixAt(i, this.matrix);

      if (s.h > 1.6) {
        for (const [side, length] of [[0, s.w], [1, s.w], [2, s.d], [3, s.d]] as const) {
          const n = Math.floor(length / 0.7);
          for (let k = 0; k < n; k++) {
            if (rand() < 0.45) continue;
            const along = -length / 2 + 0.35 + k * 0.7;
            const px = side < 2 ? s.x + along : s.x + (side === 2 ? -1 : 1) * (s.w / 2 + 0.06);
            const pz = side < 2 ? s.z + (side === 0 ? -1 : 1) * (s.d / 2 + 0.06) : s.z + along;
            const len = 0.4 + rand() * 1.1;
            icicles.push(new THREE.Matrix4().compose(
              new THREE.Vector3(px, top, pz), q, new THREE.Vector3(1, len, 1)));
          }
        }
      }
      this.addBlock({ minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2 });
    });
    this.scene.add(stone, caps);

    const hanging = new THREE.InstancedMesh(icicle, icicleMat, icicles.length);
    icicles.forEach((m, i) => hanging.setMatrixAt(i, m));
    this.scene.add(hanging);

    // Tope en el borde, detrás de las montañas, por si alguien las escala.
    const a = RUN.arena;
    this.addBlock({ minX: -a - 5, maxX: a + 5, minZ: -a - 5, maxZ: -a });
    this.addBlock({ minX: -a - 5, maxX: a + 5, minZ: a, maxZ: a + 5 });
    this.addBlock({ minX: -a - 5, maxX: -a, minZ: -a, maxZ: a });
    this.addBlock({ minX: a, maxX: a + 5, minZ: -a, maxZ: a });
  }

  // --------------------------------------------------- Antenas de HELIOS

  /**
   * Las antenas por las que HELIOS controla el velo: torres de chapa oscura
   * con franjas púrpura, un plato orientado al cielo y una luz roja que late.
   */
  private buildAntennas() {
    const rand = random(1337);
    const spots: { x: number; z: number; h: number; yaw: number }[] = [];
    let tries = 0;
    while (spots.length < 7 && tries++ < 600) {
      const angle = rand() * Math.PI * 2;
      const radius = 30 + rand() * (RUN.arena - 42);
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (!this.free(x, z, 3)) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 38)) continue;
      spots.push({ x, z, h: 16 + rand() * 8, yaw: rand() * Math.PI * 2 });
    }

    const n = spots.length;
    const chapa = toonMat({ color: '#474a5e' });
    const metal = toonMat({ color: '#62667c' });
    const nieve = toonMat({ color: '#f4f8ff' });
    const purpura = new THREE.MeshBasicMaterial({ color: '#b46cff' });
    this.beacons = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });

    // Pilón: un tronco de pirámide de cuatro caras, de altura 1, que se estira.
    const pylon = new THREE.CylinderGeometry(0.28, 1.25, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    const collar = new THREE.BoxGeometry(1, 1, 1);
    const dish = new THREE.SphereGeometry(2.4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4).rotateX(Math.PI);
    const light = new THREE.SphereGeometry(0.42, 12, 8);

    const bases = new THREE.InstancedMesh(collar, chapa, n);
    const baseSnow = new THREE.InstancedMesh(collar, nieve, n);
    const pylons = new THREE.InstancedMesh(pylon, metal, n);
    const collars = new THREE.InstancedMesh(collar, chapa, n * 4);
    const stripes = new THREE.InstancedMesh(collar, purpura, n * 4);
    const dishes = new THREE.InstancedMesh(dish, metal, n);
    const lights = new THREE.InstancedMesh(light, this.beacons, n * 2);
    for (const m of [bases, baseSnow, pylons, collars, dishes]) m.castShadow = m.receiveShadow = true;
    (dishes.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;

    const v = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    spots.forEach((s, i) => {
      const ground = this.groundUnder(s.x, s.z, 4, 4);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(up, s.yaw);

      bases.setMatrixAt(i, this.matrix.compose(v.set(s.x, ground + 0.3, s.z), yawQ, sc.set(4.2, 2.2, 4.2)));
      baseSnow.setMatrixAt(i, this.matrix.compose(v.set(s.x, ground + 1.45, s.z), yawQ, sc.set(4.4, 0.25, 4.4)));
      const foot = ground + 1.4;
      pylons.setMatrixAt(i, this.matrix.compose(v.set(s.x, foot, s.z), yawQ, sc.set(1.6, s.h, 1.6)));

      // Collares a lo largo del pilón, cada uno con su franja púrpura encendida.
      for (let k = 0; k < 4; k++) {
        const f = 0.18 + k * 0.2;
        const w = (1.25 + (0.28 - 1.25) * f) * 1.6 * 1.5 + 0.25;
        collars.setMatrixAt(i * 4 + k, this.matrix.compose(v.set(s.x, foot + s.h * f, s.z), yawQ, sc.set(w, 0.45, w)));
        stripes.setMatrixAt(i * 4 + k, this.matrix.compose(v.set(s.x, foot + s.h * f, s.z), yawQ, sc.set(w + 0.06, 0.12, w + 0.06)));
      }

      // El plato mira al cielo, algo ladeado: escucha al satélite del velo.
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.5);
      q.copy(yawQ).multiply(tilt);
      dishes.setMatrixAt(i, this.matrix.compose(v.set(s.x, foot + s.h * 0.82, s.z), q, sc.set(1, 1, 1)));

      lights.setMatrixAt(i * 2, this.matrix.compose(v.set(s.x, foot + s.h + 0.3, s.z), yawQ, sc.set(1, 1, 1)));
      lights.setMatrixAt(i * 2 + 1, this.matrix.compose(v.set(s.x, foot + s.h * 0.82 + 1.6, s.z), yawQ, sc.set(0.6, 0.6, 0.6)));

      this.addBlock({ minX: s.x - 2.2, maxX: s.x + 2.2, minZ: s.z - 2.2, maxZ: s.z + 2.2 });
    });
    this.scene.add(bases, baseSnow, pylons, collars, stripes, dishes, lights);
  }

  // ---------------------------------------------------------- Cristales

  /**
   * Cristales de hielo que brotan del suelo: los grandes cortan el paso y
   * los pequeños salpican el mapa. Algunos se han teñido con el púrpura de HELIOS.
   */
  private buildCrystals() {
    const rand = random(8088);
    // Una punta hexagonal: prisma y pirámide, de altura 1.
    const prism = new THREE.CylinderGeometry(0.5, 0.42, 0.75, 6).translate(0, 0.375, 0);
    const tip = new THREE.ConeGeometry(0.5, 0.25, 6).translate(0, 0.875, 0);
    const shard = mergeGeometries([prism.toNonIndexed(), tip.toNonIndexed()])!;
    shard.computeVertexNormals();

    const material = toonMat({ emissive: '#1d4b6e', emissiveIntensity: 0.9 });
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const cyan = new THREE.Color('#9fe6ff'), pale = new THREE.Color('#e3f6ff'), violet = new THREE.Color('#c58cff');

    const cluster = (x: number, z: number, size: number, tint: THREE.Color) => {
      const ground = this.heightAt(x, z);
      const pieces = 3 + Math.floor(rand() * 4);
      for (let k = 0; k < pieces; k++) {
        const big = k === 0;
        const a = rand() * Math.PI * 2;
        const off = big ? 0 : size * (0.25 + rand() * 0.35);
        const h = size * (big ? 2.4 + rand() : 0.9 + rand() * 1.2);
        const w = size * (big ? 0.7 : 0.35 + rand() * 0.25);
        const lean = big ? (rand() - 0.5) * 0.25 : 0.25 + rand() * 0.45;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(a) * lean, rand() * Math.PI, -Math.sin(a) * lean));
        matrices.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x + Math.cos(a) * off, ground - 0.2, z + Math.sin(a) * off), q, new THREE.Vector3(w, h, w)));
        colors.push(tint.clone().lerp(pale, rand() * 0.5));
      }
    };

    // Grandes: obstáculos.
    let placed = 0, tries = 0;
    while (placed < 26 && tries++ < 1500) {
      const x = (rand() * 2 - 1) * (RUN.arena - 8);
      const z = (rand() * 2 - 1) * (RUN.arena - 8);
      if (!this.free(x, z, 2.5, false)) continue;
      const size = 1.2 + rand() * 1.1;
      cluster(x, z, size, rand() < 0.2 ? violet : cyan);
      const r = size * 0.55;
      this.addBlock({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
      placed++;
    }
    // Pequeños: decorado que no estorba.
    placed = tries = 0;
    while (placed < 110 && tries++ < 3000) {
      const x = (rand() * 2 - 1) * (RUN.arena + 15);
      const z = (rand() * 2 - 1) * (RUN.arena + 15);
      if (!this.free(x, z, 1, false)) continue;
      cluster(x, z, 0.3 + rand() * 0.35, rand() < 0.12 ? violet : cyan);
      placed++;
    }

    const mesh = new THREE.InstancedMesh(shard, material, matrices.length);
    mesh.castShadow = true;
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, colors[i]);
    });
    this.scene.add(mesh);
  }

  /** Torres heladas y glaciares más allá de las montañas: siluetas contra el cielo. */
  private buildSkyline() {
    const rand = random(77);
    const count = 60;
    const towers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      // Siluetas planas sin niebla: la niebla las aclaraba por encima del cielo.
      new THREE.MeshBasicMaterial({ color: '#8496b8', fog: false }),
      count,
    );
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.05;
      // Lejos, para que la niebla las deje en siluetas contra el cielo.
      const radius = RUN.arena + 120 + rand() * 60;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const w = 9 + rand() * 12;
      const h = 22 + rand() * 40;
      this.matrix.compose(
        new THREE.Vector3(x, 12 + h / 2, z),
        new THREE.Quaternion().setFromAxisAngle(up, -angle + rand() * 0.3),
        new THREE.Vector3(w, h, 8 + rand() * 8),
      );
      towers.setMatrixAt(i, this.matrix);
    }
    this.scene.add(towers);

    // Picos de glaciar, más cerca y más claros que las torres.
    const peaks = 34;
    const glacier = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#a5b8d6', fog: false }),
      peaks,
    );
    for (let i = 0; i < peaks; i++) {
      const angle = (i / peaks) * Math.PI * 2 + rand() * 0.12;
      const radius = RUN.arena + 95 + rand() * 25;
      const r = 18 + rand() * 20;
      this.matrix.compose(
        new THREE.Vector3(Math.cos(angle) * radius, 6, Math.sin(angle) * radius),
        new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI),
        new THREE.Vector3(r, 25 + rand() * 35, r),
      );
      glacier.setMatrixAt(i, this.matrix);
    }
    this.scene.add(glacier);
  }

  // --------------------------------------------------------- Decorado

  /** Rocas heladas, montículos de nieve y árboles muertos cubiertos de escarcha. */
  private buildProps() {
    const rand = random(2024);

    const place = (count: number, clearance: number, each: (x: number, y: number, z: number, m: THREE.Matrix4) => void) => {
      const out: THREE.Matrix4[] = [];
      let tries = 0;
      while (out.length < count && tries++ < count * 40) {
        const x = (rand() * 2 - 1) * (RUN.arena + 20);
        const z = (rand() * 2 - 1) * (RUN.arena + 20);
        if (!this.free(x, z, clearance)) continue;
        const m = new THREE.Matrix4();
        each(x, this.heightAt(x, z), z, m);
        out.push(m);
      }
      return out;
    };
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, list: THREE.Matrix4[], shadows = true) => {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };
    const euler = new THREE.Euler();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();

    // Rocas: un dodecaedro aplastado, con un gorro de nieve encima.
    const rocks = place(90, 0.5, (x, y, z, m) => {
      const r = 0.4 + rand() * 0.9;
      q.setFromEuler(euler.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4));
      m.compose(v.set(x, y + r * 0.2, z), q, s.set(r * (1 + rand() * 0.5), r * (0.6 + rand() * 0.4), r));
    });
    add(new THREE.DodecahedronGeometry(1, 0), toonMat({ color: '#56607e' }), rocks);
    const rockCaps = rocks.map((m) => {
      const out = new THREE.Matrix4();
      m.decompose(v, q, s);
      return out.compose(v.clone().add(new THREE.Vector3(0, s.y * 0.55, 0)), q, s.clone().multiply(new THREE.Vector3(0.82, 0.4, 0.82)));
    });
    add(new THREE.DodecahedronGeometry(1, 0), toonMat({ color: '#f4f8ff' }), rockCaps, false);

    // Montículos de nieve: medias esferas achatadas.
    const mounds = place(70, 0.3, (x, y, z, m) => {
      const r = 0.8 + rand() * 1.8;
      m.compose(v.set(x, y - 0.1, z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * 6), s.set(r * 1.4, r * 0.45, r));
    });
    add(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), toonMat({ color: '#e8eff9' }), mounds, false);

    // Árboles muertos: tronco y ramas peladas en una sola geometría.
    const trunk = new THREE.CylinderGeometry(0.1, 0.22, 3.4, 5).translate(0, 1.7, 0);
    const branch = (len: number, y: number, yaw: number, pitch: number) =>
      new THREE.CylinderGeometry(0.04, 0.09, len, 4).translate(0, len / 2, 0)
        .rotateZ(pitch).rotateY(yaw).translate(0, y, 0);
    const tree = mergeGeometries([
      trunk, branch(1.6, 1.6, 0, 0.8), branch(1.3, 2.2, 2.2, 0.9), branch(1.1, 2.7, 4.1, 0.7), branch(0.9, 1.1, 3.3, 1.0),
    ].map((g) => g.toNonIndexed()))!;
    tree.computeVertexNormals();
    const trees = place(45, 1, (x, y, z, m) => {
      const k = 0.9 + rand() * 0.9;
      q.setFromEuler(euler.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25));
      m.compose(v.set(x, y - 0.2, z), q, s.set(k, k, k));
    });
    add(tree, toonMat({ color: '#3f3a54' }), trees);
    // Escarcha en las ramas: la misma silueta, algo más gruesa y blanca, solo arriba.
    const frost = trees.map((m) => {
      const out = new THREE.Matrix4();
      m.decompose(v, q, s);
      return out.compose(v.clone().add(new THREE.Vector3(0, 0.08 * s.y, 0)), q, s.clone().multiply(new THREE.Vector3(1.12, 1, 1.12)));
    });
    add(tree, toonMat({ color: '#dceaf8', transparent: true, opacity: 0.55 }), frost, false);
  }

  // --------------------------------------------------------- Cohete

  /** El cohete: se ve desde casi todo el mapa y es a donde va todo esto. */
  private buildLaunchPad() {
    const group = new THREE.Group();
    group.position.copy(this.padPosition);

    const concrete = toonMat({ color: '#7f8ba4' });
    const snow = toonMat({ color: '#f4f8ff' });
    const hull = toonMat({ color: '#f2f0ec' });
    const dark = toonMat({ color: '#22243a' });
    const orange = toonMat({ color: '#ff8a3d' });
    const steel = toonMat({ color: '#3d4660' });
    const red = new THREE.MeshBasicMaterial({ color: '#ff2a12' });

    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    add(new THREE.CylinderGeometry(9, 9.5, 0.8, 32), concrete, 0, 0.4, 0);
    // Nieve acumulada en el borde de la plataforma.
    add(new THREE.TorusGeometry(8.6, 0.35, 6, 40).rotateX(Math.PI / 2), snow, 0, 0.85, 0);
    add(new THREE.CylinderGeometry(2.6, 2.6, 26, 20), hull, 0, 14, 0);
    add(new THREE.CylinderGeometry(2.65, 2.65, 0.8, 20), dark, 0, 27.2, 0);
    add(new THREE.CylinderGeometry(2.2, 2.6, 10, 20), hull, 0, 32.4, 0);
    add(new THREE.ConeGeometry(2.2, 6, 20), orange, 0, 40.4, 0);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(1.1, 1.1, 18, 14), hull, side * 3.7, 9.8, 0);
      add(new THREE.ConeGeometry(1.1, 2.6, 14), orange, side * 3.7, 20.1, 0);
    }

    // Torre de servicio: celosía de vigas.
    const tower = new THREE.Group();
    tower.position.set(8, 0, 0);
    group.add(tower);
    const beam = new THREE.BoxGeometry(1, 1, 1);
    const addBeam = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(beam, steel);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      tower.add(mesh);
    };
    for (const cx of [-1.8, 1.8]) for (const cz of [-1.8, 1.8]) addBeam(cx, 22, cz, 0.4, 44, 0.4);
    for (let y = 3; y < 44; y += 3.5) {
      addBeam(0, y, -1.8, 3.6, 0.25, 0.25);
      addBeam(0, y, 1.8, 3.6, 0.25, 0.25);
      addBeam(-1.8, y, 0, 0.25, 0.25, 3.6);
      addBeam(1.8, y, 0, 0.25, 0.25, 3.6);
    }
    addBeam(-4, 18, 0, 4.4, 0.8, 1.2);
    addBeam(-4, 30, 0, 4.4, 0.8, 1.2);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), red);
    beacon.position.set(0, 44.6, 0);
    tower.add(beacon);

    this.scene.add(group);

    const p = this.padPosition;
    this.addBlock({ minX: p.x - 5, maxX: p.x + 5, minZ: p.z - 5, maxZ: p.z + 5 });
    this.addBlock({ minX: p.x + 5.5, maxX: p.x + 10.5, minZ: p.z - 2.5, maxZ: p.z + 2.5 });
  }

  // ------------------------------------------------------- Colisiones

  private addBlock(block: Block) {
    this.blocks.push(block);
    // Se registra con margen: un círculo cuyo centro cae en la celda vecina
    // también puede estar tocando la caja.
    const m = 1.5;
    for (let cx = Math.floor((block.minX - m) / CELL); cx <= Math.floor((block.maxX + m) / CELL); cx++)
      for (let cz = Math.floor((block.minZ - m) / CELL); cz <= Math.floor((block.maxZ + m) / CELL); cz++) {
        const key = cx * 1000 + cz;
        const list = this.grid.get(key);
        if (list) list.push(block);
        else this.grid.set(key, [block]);
      }
  }

  private blockAt(x: number, z: number, margin: number) {
    const list = this.grid.get(Math.floor(x / CELL) * 1000 + Math.floor(z / CELL));
    return !!list?.some((b) => x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin);
  }

  /**
   * Empuja un círculo fuera de cualquier obstáculo que pise. Devuelve la
   * posición corregida en `out` (puede ser el mismo vector).
   */
  resolve(x: number, z: number, radius: number, out: { x: number; z: number }) {
    out.x = x;
    out.z = z;
    const list = this.grid.get(Math.floor(x / CELL) * 1000 + Math.floor(z / CELL));
    if (!list) return out;
    for (const b of list) {
      const nx = Math.max(b.minX, Math.min(out.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(out.z, b.maxZ));
      const dx = out.x - nx;
      const dz = out.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        out.x = nx + (dx / d) * radius;
        out.z = nz + (dz / d) * radius;
      } else {
        // Centro dentro de la caja: sacarlo por el lado más cercano.
        const left = out.x - b.minX, right = b.maxX - out.x;
        const back = out.z - b.minZ, front = b.maxZ - out.z;
        const m = Math.min(left, right, back, front);
        if (m === left) out.x = b.minX - radius;
        else if (m === right) out.x = b.maxX + radius;
        else if (m === back) out.z = b.minZ - radius;
        else out.z = b.maxZ + radius;
      }
    }
    return out;
  }
}
