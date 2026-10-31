import * as THREE from 'three';
import { RUN } from './data';
import { cloudTexture, groundTexture, propKinds } from './sprites';

// El velo de sulfatos: un horizonte anaranjado y polvoriento que oscurece hacia
// arriba. La niebla usa el color del horizonte para que lo lejano se funda en él.
export const HORIZON = new THREE.Color('#e3906a');
const ZENITH = new THREE.Color('#5a1e2c');
const MIDSKY = new THREE.Color('#b9503c');

/** Caja de colisión alineada con los ejes, en el plano XZ. */
export interface Block {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const CELL = 8;

// El terreno se muestrea una vez en una cuadrícula de 1 m y luego se interpola:
// cientos de enemigos preguntan su altura en cada fotograma.
const HALF = RUN.arena + 70;
const RES = 1;
const SIDE = Math.round((HALF * 2) / RES) + 1;

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

/** Disco del sol con halo, apagado por el velo. */
function sunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 240, 215, 0.9)');
  glow.addColorStop(0.3, 'rgba(255, 210, 170, 0.35)');
  glow.addColorStop(1, 'rgba(255, 180, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#fff4e2';
  ctx.beginPath();
  ctx.arc(64, 64, 17, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

/**
 * Lo estático del mapa: terreno, cielo, ruinas, decorado y la plataforma de
 * lanzamiento. Las ruinas bloquean el paso; se guardan en una cuadrícula para
 * que cientos de enemigos no comprueben cada una en cada fotograma.
 */
export class World {
  readonly blocks: Block[] = [];
  private grid = new Map<number, Block[]>();
  readonly sun: THREE.DirectionalLight;
  readonly padPosition = new THREE.Vector3(0, 0, -62);
  private heights = new Float32Array(SIDE * SIDE);
  private props: { mesh: THREE.InstancedMesh; x: number[]; y: number[]; z: number[] }[] = [];
  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private pos = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private sky: THREE.Group;

  constructor(readonly scene: THREE.Scene) {
    scene.background = HORIZON;
    scene.fog = new THREE.Fog(HORIZON, 60, 280);

    this.sampleHeights();

    scene.add(new THREE.HemisphereLight('#ffc0a0', '#3a1810', 1.5));

    // Sol rasante: nunca sube del todo bajo el velo de sulfatos.
    this.sun = new THREE.DirectionalLight('#ffc49a', 2.4);
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
    this.buildSkyline();
    this.buildLaunchPad();
    this.buildProps();
  }

  // ---------------------------------------------------------- Terreno

  /** La forma del mundo. Solo se usa para rellenar la cuadrícula. */
  private rawHeight(x: number, z: number) {
    // Lomas suaves en la zona de juego...
    let h = (fbm(x * 0.025, z * 0.025) - 0.45) * 5 + (fbm(x * 0.09 + 40, z * 0.09) - 0.5) * 0.8;
    // ...y colinas altas en el borde, que cierran el mapa sin muros invisibles.
    const edge = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(RUN.arena - 14, RUN.arena + 40, edge) ** 1.4 * (12 + fbm(x * 0.02, z * 0.02) * 16);
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
    const sand = new THREE.Color('#d08a64');
    const dune = new THREE.Color('#e8a878');
    const rock = new THREE.Color('#7a3a2c');
    const c = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      const y = this.heightAt(x, z);
      position.setY(i, y);
      // Pendiente: lo empinado es roca oscura; lo alto y llano, arena clara.
      const slope = Math.hypot(this.heightAt(x + 1, z) - this.heightAt(x - 1, z),
                               this.heightAt(x, z + 1) - this.heightAt(x, z - 1)) / 2;
      c.copy(sand).lerp(dune, smoothstep(0, 3, y) * 0.6).lerp(rock, smoothstep(0.35, 1.1, slope));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const texture = groundTexture();
    texture.repeat.set(HALF / 4, HALF / 4);
    const ground = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture, vertexColors: true }));
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Más allá del terreno, un anillo hasta el horizonte para que no haya borde.
    // Empieza dentro de las colinas del límite, que lo tapan por dentro.
    const far = new THREE.Mesh(
      new THREE.RingGeometry(HALF - 8, 1100, 64).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#b86848' }),
    );
    far.position.y = 11;
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
          horizon: { value: HORIZON }, mid: { value: MIDSKY }, zenith: { value: ZENITH },
        },
        vertexShader: `varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 horizon; uniform vec3 mid; uniform vec3 zenith; varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.28, h));
            c = mix(c, zenith, smoothstep(0.28, 0.9, h));
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
    sunDisc.scale.setScalar(90);
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

  /** El cielo y la luz siguen al jugador; el mapa de sombras así basta pequeño. */
  follow(target: THREE.Vector3) {
    this.sky.position.set(target.x, 0, target.z);
    this.sun.target.position.copy(target);
    this.sun.position.set(target.x - 50, target.y + 42, target.z + 28);
  }

  // ----------------------------------------------------------- Ruinas

  private buildRuins() {
    let seed = 503;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const shapes: { x: number; z: number; w: number; d: number; h: number }[] = [];
    let attempts = 0;
    while (shapes.length < 70 && attempts++ < 2000) {
      const x = (rand() * 2 - 1) * (RUN.arena - 12);
      const z = (rand() * 2 - 1) * (RUN.arena - 12);
      // El centro queda libre para empezar, y la explanada del cohete también.
      if (Math.hypot(x, z) < 12) continue;
      if (Math.hypot(x - this.padPosition.x, z - this.padPosition.z) < 18) continue;

      const w = 1.5 + rand() * 5;
      const d = 1.5 + rand() * 5;
      const h = rand() < 0.25 ? 4 + rand() * 7 : 0.6 + rand() * 2.2;
      if (shapes.some((s) => Math.abs(s.x - x) < (s.w + w) / 2 + 3 && Math.abs(s.z - z) < (s.d + d) / 2 + 3)) continue;
      shapes.push({ x, z, w, d, h });
    }

    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial(),
      shapes.length,
    );
    mesh.castShadow = mesh.receiveShadow = true;

    const color = new THREE.Color();
    shapes.forEach((s, i) => {
      // Medio enterradas: la base se hunde por debajo del punto más bajo.
      const ground = Math.min(
        this.heightAt(s.x - s.w / 2, s.z - s.d / 2), this.heightAt(s.x + s.w / 2, s.z - s.d / 2),
        this.heightAt(s.x - s.w / 2, s.z + s.d / 2), this.heightAt(s.x + s.w / 2, s.z + s.d / 2));
      const depth = s.h + 1;
      this.matrix.compose(
        new THREE.Vector3(s.x, ground - 1 + depth / 2, s.z),
        new THREE.Quaternion(),
        new THREE.Vector3(s.w, depth, s.d),
      );
      mesh.setMatrixAt(i, this.matrix);
      color.setHSL(0.03 + rand() * 0.03, 0.22 + rand() * 0.18, 0.3 + rand() * 0.14);
      mesh.setColorAt(i, color);
      this.addBlock({ minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2 });
    });
    this.scene.add(mesh);

    // Tope en el borde, detrás de las colinas, por si alguien las escala.
    const a = RUN.arena;
    this.addBlock({ minX: -a - 5, maxX: a + 5, minZ: -a - 5, maxZ: -a });
    this.addBlock({ minX: -a - 5, maxX: a + 5, minZ: a, maxZ: a + 5 });
    this.addBlock({ minX: -a - 5, maxX: -a, minZ: -a, maxZ: a });
    this.addBlock({ minX: a, maxX: a + 5, minZ: -a, maxZ: a });
  }

  /** Torres muertas sobre las colinas del borde: el horizonte de una ciudad. */
  private buildSkyline() {
    let seed = 77;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const count = 70;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      // Siluetas planas sin niebla: la niebla las aclaraba por encima del cielo.
      new THREE.MeshBasicMaterial({ color: '#8a3e34', fog: false }),
      count,
    );
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.05;
      // Lejos, para que la niebla las deje en siluetas contra el cielo.
      const radius = RUN.arena + 110 + rand() * 60;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const w = 10 + rand() * 14;
      const h = 25 + rand() * 45;
      this.matrix.compose(
        new THREE.Vector3(x, 10 + h / 2, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + rand() * 0.3),
        new THREE.Vector3(w, h, 8 + rand() * 8),
      );
      mesh.setMatrixAt(i, this.matrix);
    }
    this.scene.add(mesh);
  }

  // --------------------------------------------------------- Decorado

  private buildProps() {
    const kinds = propKinds();
    let seed = 2024;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const counts = [40, 30, 70, 60, 90, 70, 18];

    kinds.forEach((kind, k) => {
      const geometry = new THREE.PlaneGeometry(kind.width, kind.height).translate(0, kind.height / 2 - 0.1, 0);
      const material = new THREE.MeshLambertMaterial({
        map: kind.texture, alphaTest: 0.5, side: THREE.DoubleSide,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, counts[k]);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const entry = { mesh, x: [] as number[], y: [] as number[], z: [] as number[] };
      let placed = 0, tries = 0;
      while (placed < counts[k] && tries++ < 4000) {
        const x = (rand() * 2 - 1) * (RUN.arena + 20);
        const z = (rand() * 2 - 1) * (RUN.arena + 20);
        if (Math.hypot(x, z) < 9) continue;
        if (Math.hypot(x - this.padPosition.x, z - this.padPosition.z) < 16) continue;
        if (this.blockAt(x, z, 1)) continue;
        entry.x.push(x);
        entry.y.push(this.heightAt(x, z));
        entry.z.push(z);
        placed++;
      }
      mesh.count = placed;
      this.props.push(entry);
      this.scene.add(mesh);
    });
  }

  /** Los billboards giran para mirar siempre a la cámara (solo en vertical). */
  faceCamera(yaw: number) {
    this.quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    for (const p of this.props) {
      for (let i = 0; i < p.x.length; i++) {
        this.pos.set(p.x[i], p.y[i], p.z[i]);
        this.matrix.compose(this.pos, this.quat, this.one);
        p.mesh.setMatrixAt(i, this.matrix);
      }
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // --------------------------------------------------------- Cohete

  /** El cohete: se ve desde casi todo el mapa y es a donde va todo esto. */
  private buildLaunchPad() {
    const group = new THREE.Group();
    group.position.copy(this.padPosition);

    const concrete = new THREE.MeshLambertMaterial({ color: '#8a6a5e' });
    const hull = new THREE.MeshLambertMaterial({ color: '#efe8de' });
    const dark = new THREE.MeshLambertMaterial({ color: '#2a1a18' });
    const orange = new THREE.MeshLambertMaterial({ color: '#f07a2a' });
    const steel = new THREE.MeshLambertMaterial({ color: '#5a2e26' });
    const red = new THREE.MeshBasicMaterial({ color: '#ff2a12' });

    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    add(new THREE.CylinderGeometry(9, 9.5, 0.8, 32), concrete, 0, 0.4, 0);
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
   * Empuja un círculo fuera de cualquier ruina que pise. Devuelve la posición
   * corregida en `out` (puede ser el mismo vector).
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
