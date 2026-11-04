import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RANURAS, deSerie, pieza as piezaDe, type Diseno, type Ranura } from '../nave/piezas.ts';

// La nave que arma el jugador, en estilo retrofuturista: fuselaje
// alargado con pintura de carreras, cabina de burbuja, motores cromados con sus
// tuberías a la vista y alas escalonadas llenas de rejillas. Diseño propio, con
// los colores de ARES (rojo coral, crema, cromo y la luz cyan de ADA).
//
// Cada ranura de nave/piezas.ts se monta aparte y cambia la silueta. El morro
// mira a +z y la nave se apoya en su tren de aterrizaje, con el suelo en y = 0.

const TAU = Math.PI * 2;

export interface NaveModular {
  raiz: THREE.Group;
  partes: Record<Ranura, THREE.Group>;
  /** El tren de aterrizaje: se recoge al despegar. */
  tren: THREE.Group;
  /** Salida de cada motor, en coordenadas de la raíz. */
  toberas: THREE.Vector3[];
  /** Chorros de la panza para elevarse, en coordenadas de la raíz. */
  chorros: THREE.Vector3[];
  /** Punta del morro: distancia desde el centro de la nave. */
  morro: number;
  largo: number;
}

const COLOR = { coral: '#e5492e', crema: '#f2e6cf', oscuro: '#20242c', naranja: '#ff8a3d', cian: '#5ee0ff', oro: '#d9a441' };

// ---------------------------------------------------------------- texturas

function lienzo(ancho: number, alto: number, pintar: (g: CanvasRenderingContext2D, a: number, h: number) => void): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  pintar(c.getContext('2d')!, ancho, alto);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Paneles, remaches y rotulación: lo que hace que una chapa parezca una máquina. */
function paneles(g: CanvasRenderingContext2D, a: number, h: number, cada: number) {
  g.strokeStyle = 'rgba(10, 12, 16, .55)';
  g.lineWidth = 2;
  for (let y = 0; y <= h; y += cada) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(a, y);
    g.stroke();
  }
  for (let k = 0; k < 40; k++) {
    const x = (k * 137) % a, y = Math.floor(((k * 71) % h) / cada) * cada;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + cada);
    g.stroke();
  }
  g.fillStyle = 'rgba(10, 12, 16, .4)';
  for (let y = 6; y < h; y += cada) for (let x = 8; x < a; x += 22) g.fillRect(x, y, 2, 2);
}

function fuselaje(forma: number) {
  return lienzo(1024, 512, (g, a, h) => {
    if (forma === 0) {
      // Rescatada: chapas que no combinan, imprimación y herrumbre.
      g.fillStyle = '#8f8678';
      g.fillRect(0, 0, a, h);
      const tonos = ['#a39787', '#7c7468', '#b4552f', '#6f7a80', '#c9b79a'];
      for (let k = 0; k < 46; k++) {
        g.fillStyle = tonos[k % tonos.length];
        g.fillRect((k * 173) % a, (k * 97) % h, 70 + (k * 41) % 150, 30 + (k * 29) % 60);
      }
      g.globalAlpha = 0.5;
      g.fillStyle = '#5a3320';
      for (let k = 0; k < 60; k++) g.fillRect((k * 211) % a, (k * 83) % h, 3, 14 + (k * 7) % 30);
      g.globalAlpha = 1;
      paneles(g, a, h, 64);
      return;
    }
    const techo = forma === 1 ? COLOR.coral : COLOR.crema, flanco = forma === 1 ? COLOR.crema : COLOR.coral;
    g.fillStyle = techo;
    g.fillRect(0, 0, a, h);
    // u = 0,25 es el lomo y u = 0,75 la panza.
    g.fillStyle = COLOR.oscuro;
    g.fillRect(a * 0.6, 0, a * 0.3, h);
    g.fillStyle = flanco;
    g.fillRect(a * 0.46, 0, a * 0.14, h);
    g.fillRect(a * 0.9, 0, a * 0.04, h);
    g.fillRect(0, 0, a * 0.04, h);
    g.fillStyle = COLOR.naranja;
    g.fillRect(a * 0.445, 0, a * 0.015, h);
    g.fillRect(a * 0.04, 0, a * 0.015, h);
    if (forma === 2) {
      g.fillStyle = COLOR.coral;
      g.fillRect(a * 0.2, 0, a * 0.02, h);
      g.fillRect(a * 0.28, 0, a * 0.02, h);
      g.fillStyle = COLOR.cian;
      g.fillRect(a * 0.238, 0, a * 0.024, h);
    } else {
      g.fillStyle = COLOR.crema;
      g.fillRect(a * 0.235, 0, a * 0.03, h);
    }
    paneles(g, a, h, 56);
    // Bandas de aviso y dorsal.
    g.fillStyle = '#16181f';
    for (let k = 0; k < 8; k++) g.fillRect(a * 0.12 + k * 14, h * 0.82, 7, 26);
    g.save();
    g.translate(a * 0.525, h * 0.5);
    g.rotate(Math.PI / 2);
    g.fillStyle = forma === 1 ? COLOR.oscuro : COLOR.crema;
    g.font = '900 54px Rubik, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('ARES-X', 0, 18);
    g.restore();
  });
}

const tejaHex = () => lienzo(512, 512, (g, a) => {
  g.fillStyle = '#15161c';
  g.fillRect(0, 0, a, a);
  g.strokeStyle = '#3d3e4a';
  g.lineWidth = 3;
  const r = 26, h = r * Math.sqrt(3);
  for (let f = -1; f < 24; f++) {
    for (let c = -1; c < 12; c++) {
      const x = c * r * 3 + (f % 2 ? r * 1.5 : 0), y = (f * h) / 2;
      g.beginPath();
      for (let k = 0; k < 6; k++) g[k ? 'lineTo' : 'moveTo'](x + Math.cos((k / 6) * TAU) * r, y + Math.sin((k / 6) * TAU) * r);
      g.closePath();
      g.stroke();
    }
  }
});

const ala = (forma: number) => lienzo(512, 512, (g, a, h) => {
  g.fillStyle = forma === 0 ? '#8d8476' : forma === 1 ? COLOR.coral : COLOR.crema;
  g.fillRect(0, 0, a, h);
  g.fillStyle = forma === 0 ? '#b4552f' : forma === 1 ? COLOR.crema : COLOR.coral;
  g.fillRect(0, h * 0.72, a, h * 0.1);
  g.fillRect(a * 0.72, 0, a * 0.08, h);
  g.fillStyle = COLOR.oscuro;
  g.fillRect(0, h * 0.86, a, h * 0.04);
  paneles(g, a, h, 72);
});

type Materiales = ReturnType<typeof crearMateriales>;
let cache: Materiales | null = null;

function crearMateriales() {
  const pintura = (map: THREE.Texture | null, respaldo: string, rugosidad = 0.36) =>
    new THREE.MeshStandardMaterial({ map, color: map ? '#ffffff' : respaldo, metalness: 0.12, roughness: rugosidad + 0.06 });
  const plano = (color: string, metal = 0.3, rugoso = 0.45) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rugoso });
  return {
    fuselaje: [pintura(fuselaje(0), '#8f8678', 0.62), pintura(fuselaje(1), COLOR.coral), pintura(fuselaje(2), COLOR.crema)],
    ala: [pintura(ala(0), '#8d8476', 0.6), pintura(ala(1), COLOR.coral), pintura(ala(2), COLOR.crema)],
    teja: pintura(tejaHex(), '#15161c', 0.72),
    cromo: plano('#e6ecf2', 1, 0.16),
    cromoOscuro: plano('#6a7180', 1, 0.3),
    cobre: plano('#c9794a', 1, 0.28),
    coral: plano(COLOR.coral, 0.3, 0.34),
    crema: plano(COLOR.crema, 0.25, 0.38),
    oscuro: plano(COLOR.oscuro, 0.55, 0.5),
    negro: plano('#0d0f14', 0.6, 0.6),
    oro: plano(COLOR.oro, 1, 0.24),
    cristal: new THREE.MeshPhysicalMaterial({ color: '#0b1a26', metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }),
    luzCian: new THREE.MeshBasicMaterial({ color: COLOR.cian }),
    luzBlanca: new THREE.MeshBasicMaterial({ color: '#dff9ff' }),
    luzRoja: new THREE.MeshBasicMaterial({ color: '#ff3a24' }),
    fuego: new THREE.MeshBasicMaterial({ color: '#ffb35e' }),
  };
}

const mat = () => (cache ??= crearMateriales());

// --------------------------------------------------------------- geometrías

interface Seccion { z: number; w: number; h: number; y?: number; n?: number }

/** Sección interpolada con Catmull-Rom, para que el perfil salga suave. */
function perfil(claves: readonly Seccion[], pasos: number): Required<Seccion>[] {
  const fuera: Required<Seccion>[] = [];
  const v = (k: number) => claves[Math.max(0, Math.min(claves.length - 1, k))];
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let k = 0; k < claves.length - 1; k++) {
    for (let p = 0; p < pasos; p++) {
      const t = p / pasos, [a, b, c, d] = [v(k - 1), v(k), v(k + 1), v(k + 2)];
      fuera.push({
        z: b.z + (c.z - b.z) * t,
        w: Math.max(0.02, cr(a.w, b.w, c.w, d.w, t)),
        h: Math.max(0.02, cr(a.h, b.h, c.h, d.h, t)),
        y: cr(a.y ?? 0, b.y ?? 0, c.y ?? 0, d.y ?? 0, t),
        n: b.n ?? 3,
      });
    }
  }
  const u = claves[claves.length - 1];
  fuera.push({ z: u.z, w: u.w, h: u.h, y: u.y ?? 0, n: u.n ?? 3 });
  return fuera;
}

/** Cuerpo hecho por secciones (superelipses): `n` alto es cuadrado, 2 es redondo. */
function loft(claves: readonly Seccion[], lados = 40, pasos = 6): THREE.BufferGeometry {
  const anillos = perfil(claves, pasos);
  const zMin = anillos[0].z, zMax = anillos[anillos.length - 1].z;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  anillos.forEach((s) => {
    for (let i = 0; i <= lados; i++) {
      const a = (i / lados) * TAU, c = Math.cos(a), o = Math.sin(a), e = 2 / s.n;
      pos.push((Math.sign(c) * Math.abs(c) ** e * s.w) / 2, s.y + (Math.sign(o) * Math.abs(o) ** e * s.h) / 2, s.z);
      uv.push(i / lados, (s.z - zMin) / (zMax - zMin));
    }
  });
  const fila = lados + 1;
  for (let k = 0; k < anillos.length - 1; k++) {
    for (let i = 0; i < lados; i++) {
      const a = k * fila + i, b = a + fila;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // Tapas.
  for (const [k, sentido] of [[0, 1], [anillos.length - 1, -1]] as const) {
    const centro = pos.length / 3;
    pos.push(0, anillos[k].y, anillos[k].z);
    uv.push(0.5, 0.5);
    for (let i = 0; i < lados; i++) {
      const a = k * fila + i;
      if (sentido > 0) idx.push(centro, a + 1, a);
      else idx.push(centro, a, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Plancha con forma: `puntos` son (x, z) vistos desde arriba. Biselada y con UV de 0 a 1. */
function plancha(puntos: readonly (readonly [number, number])[], grosor: number, bisel = 0.08): THREE.BufferGeometry {
  const s = new THREE.Shape();
  puntos.forEach(([x, z], k) => (k ? s.lineTo(x, z) : s.moveTo(x, z)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: grosor, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2 });
  g.rotateX(Math.PI / 2);
  g.translate(0, grosor / 2, 0);
  g.computeBoundingBox();
  const b = g.boundingBox!, p = g.attributes.position, uv = g.attributes.uv;
  for (let k = 0; k < p.count; k++) uv.setXY(k, (p.getX(k) - b.min.x) / (b.max.x - b.min.x), (p.getZ(k) - b.min.z) / (b.max.z - b.min.z));
  return g;
}

const caja = (a: number, h: number, f: number, r = 0.08) => {
  const s = new THREE.Shape();
  const x = a / 2 - r, y = f / 2 - r;
  s.moveTo(-x, -y - r);
  s.lineTo(x, -y - r);
  s.quadraticCurveTo(x + r, -y - r, x + r, -y);
  s.lineTo(x + r, y);
  s.quadraticCurveTo(x + r, y + r, x, y + r);
  s.lineTo(-x, y + r);
  s.quadraticCurveTo(-x - r, y + r, -x - r, y);
  s.lineTo(-x - r, -y);
  s.quadraticCurveTo(-x - r, -y - r, -x, -y - r);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 3 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  return g;
};

/** Tobera con la boca hacia atrás (−z) y la garganta en el origen. */
function tobera(radio: number, largo: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 10; k++) {
    const f = k / 10;
    pts.push(new THREE.Vector2(radio * (0.34 + 0.66 * f ** 0.65), -largo * f));
  }
  return new THREE.LatheGeometry(pts, 24).rotateX(Math.PI / 2).rotateY(0);
}

const tuboEje = (radio: number, largo: number, lados = 24) => new THREE.CylinderGeometry(radio, radio, largo, lados).rotateX(Math.PI / 2);

/** Tubería por una lista de puntos. */
function tuberia(puntos: readonly (readonly [number, number, number])[], radio: number) {
  const c = new THREE.CatmullRomCurve3(puntos.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(c, 28, radio, 10, false);
}

function poner(padre: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = o.receiveShadow = true;
  padre.add(o);
  return o;
}

/** Lo mismo a los dos lados de la nave. */
function ambos(padre: THREE.Object3D, fn: (g: THREE.Group, lado: number) => void) {
  for (const lado of [1, -1]) {
    const g = new THREE.Group();
    g.scale.x = lado;
    padre.add(g);
    fn(g, lado);
  }
}

/** Rejilla de ventilación: lamas oscuras en un marco. */
function rejilla(p: THREE.Object3D, ancho: number, largo: number, lamas: number, x: number, y: number, z: number, rz = 0) {
  const m = mat();
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.z = rz;
  p.add(g);
  poner(g, caja(ancho, 0.12, largo, 0.03), m.oscuro);
  for (let k = 0; k < lamas; k++) {
    poner(g, caja(ancho * 0.86, 0.1, 0.09, 0.01), m.cromoOscuro, 0, 0.08, ((k + 0.5) / lamas - 0.5) * largo * 0.9, 0.45);
  }
}

// ------------------------------------------------------------------ secciones

/** Dónde acaba cada casco por detrás. */
const POPA = [-8, -9, -12];

function montarCasco(p: THREE.Group, forma: number) {
  const m = mat();
  const claves: readonly Seccion[][] = [
    [{ z: -8, w: 4.4, h: 3 }, { z: -4, w: 5, h: 3.6 }, { z: 2, w: 4.6, h: 3.4 }, { z: 7, w: 3.4, h: 2.6 }],
    [{ z: -9, w: 4.2, h: 2.8 }, { z: -6, w: 5, h: 3.6 }, { z: 0, w: 5.2, h: 3.8, y: 0.1 }, { z: 4, w: 4.4, h: 3.2 }, { z: 7, w: 3.4, h: 2.6 }],
    [{ z: -12, w: 4.2, h: 2.8 }, { z: -8, w: 5.3, h: 3.9 }, { z: -2, w: 5.6, h: 4.1, y: 0.15 }, { z: 3, w: 4.6, h: 3.4 }, { z: 7, w: 3.4, h: 2.6 }],
  ];
  poner(p, loft(claves[forma]), m.fuselaje[forma]);

  // Cabina de burbuja con su marco dorado.
  const cab = new THREE.Group();
  cab.position.set(0, 1.42, 3.2);
  p.add(cab);
  poner(cab, new THREE.SphereGeometry(1, 40, 24), m.cristal).scale.set(1.28, 0.92, 3.1);
  poner(cab, new THREE.TorusGeometry(1, 0.055, 8, 56), m.oro).scale.set(1.3, 3.14, 0.34);
  (cab.children[1] as THREE.Mesh).rotation.x = Math.PI / 2;
  for (const z of [-1.1, 0.5, 1.8]) {
    const k = Math.sqrt(1 - (z / 3.1) ** 2);
    const aro = poner(cab, new THREE.TorusGeometry(1, 0.05, 8, 40, Math.PI), m.oro, 0, 0, z);
    aro.scale.set(1.3 * k, 0.94 * k, 1);
  }
  poner(cab, caja(0.9, 0.12, 1.5, 0.05), m.oscuro, 0, 0.72, -1.6);

  // Lomo: tuberías y rejillas.
  rejilla(p, 1.6, 2.6, 7, -1.3, 1.92, -3.6, 0.28);
  rejilla(p, 1.6, 2.6, 7, 1.3, 1.92, -3.6, -0.28);
  poner(p, tuberia([[0.55, 1.95, -6.5], [0.55, 2.1, -3], [0.4, 2.0, -1.2]], 0.1), m.cobre);
  poner(p, tuberia([[-0.55, 1.95, -6.5], [-0.55, 2.1, -3], [-0.4, 2.0, -1.2]], 0.1), m.cobre);
  poner(p, caja(0.5, 0.5, 3.4, 0.1), m.oscuro, 0, 1.95, -4.6);
  // Luces de posición y entradas de aire a los lados.
  ambos(p, (g) => {
    rejilla(g, 1.1, 3.2, 8, 2.46, 0.4, -1.5, -1.45);
    poner(g, caja(0.24, 0.2, 0.7, 0.06), m.luzRoja, 2.3, -0.9, 3.4);
  });
  if (forma >= 1) {
    // Quilla dorsal.
    poner(p, plancha([[0, -8.6], [0, -3.4], [2.7, -6.9], [2.8, -8.8]], 0.2), m.ala[forma], 0, 1.72, 0, 0, 0, Math.PI / 2);
  }
  if (forma === 2) {
    poner(p, tuberia([[1.6, 1.3, -10.5], [2.1, 1.5, -7], [1.9, 1.7, -3]], 0.16), m.cromo);
    poner(p, tuberia([[-1.6, 1.3, -10.5], [-2.1, 1.5, -7], [-1.9, 1.7, -3]], 0.16), m.cromo);
    for (const z of [-9.6, -7.4, -5.2]) poner(p, caja(5.3, 0.14, 0.26, 0.05), m.oscuro, 0, 2.02, z, 0, 0, 0);
  }
}

function montarProa(p: THREE.Group, forma: number, cascoForma: number) {
  const m = mat();
  const pintura = m.fuselaje[cascoForma];
  if (forma === 0) {
    poner(p, loft([{ z: 7, w: 3.4, h: 2.6 }, { z: 10, w: 2.9, h: 2.1 }, { z: 12.6, w: 1.9, h: 1.3 }, { z: 13.4, w: 0.5, h: 0.4 }]), pintura);
    poner(p, caja(2.4, 0.2, 0.3, 0.06), m.oscuro, 0, -0.5, 12.2);
    poner(p, new THREE.CylinderGeometry(0.04, 0.04, 2), m.cromo, 0.5, 1.4, 9.6);
    return 13.4;
  }
  if (forma === 1) {
    // Morro de aguja con cuchillas superpuestas y una antena larga.
    poner(p, loft([{ z: 7, w: 3.4, h: 2.6 }, { z: 11, w: 2.5, h: 1.7 }, { z: 16, w: 1.4, h: 0.85 }, { z: 21, w: 0.6, h: 0.32 }, { z: 23.5, w: 0.1, h: 0.06 }]), pintura);
    poner(p, plancha([[-1.3, 8.2], [1.3, 8.2], [0.34, 20.5], [-0.34, 20.5]], 0.14), m.crema, 0, 0.56, 0, -0.04);
    poner(p, plancha([[-1.0, 9.2], [1.0, 9.2], [0.2, 18.5], [-0.2, 18.5]], 0.12), m.coral, 0, 0.74, 0, -0.04);
    poner(p, plancha([[-1.7, 7.6], [1.7, 7.6], [0.5, 17], [-0.5, 17]], 0.14), m.oscuro, 0, -0.84, 0, 0.05);
    poner(p, new THREE.CylinderGeometry(0.03, 0.06, 4.6).rotateX(Math.PI / 2), m.cromo, 0, 0.03, 25.6);
    poner(p, new THREE.SphereGeometry(0.1, 12, 8), m.luzRoja, 0, 0.03, 27.9);
    const plato = poner(p, new THREE.SphereGeometry(1.15, 24, 8, 0, TAU, 0, 1.05), m.cromo, 0, -1.5, 10.5, 2.5);
    plato.scale.y = 0.5;
    (plato.material as THREE.Material).side = THREE.DoubleSide;
    return 28;
  }
  // Cúpula de ADA: morro de tiburón con sensor cyan y canards.
  poner(p, loft([{ z: 7, w: 3.4, h: 2.6 }, { z: 11, w: 3.1, h: 2 }, { z: 15, w: 2.3, h: 1.2, y: -0.15 }, { z: 19, w: 0.9, h: 0.45, y: -0.25 }, { z: 20.2, w: 0.08, h: 0.06, y: -0.3 }]), pintura);
  poner(p, new THREE.SphereGeometry(0.72, 32, 20), m.luzCian, 0, 0.36, 15.2).scale.set(1, 0.5, 2.4);
  poner(p, new THREE.TorusGeometry(0.76, 0.05, 8, 40), m.oro, 0, 0.36, 15.2, Math.PI / 2).scale.set(1, 2.42, 1);
  poner(p, new THREE.TorusGeometry(1.3, 0.07, 8, 48), m.luzCian, 0, -0.1, 11.8);
  ambos(p, (g) => {
    poner(g, plancha([[1.1, 11.6], [1.1, 13.6], [3.7, 11.2], [3.7, 10.5]], 0.12), m.ala[2], 0, -0.3, 0);
    poner(g, caja(0.2, 0.2, 1, 0.06), m.luzCian, 3.75, -0.28, 10.9);
  });
  return 20.2;
}

function montarAlas(p: THREE.Group, forma: number, popa: number) {
  const m = mat();
  const z = popa + 8; // la raíz del ala va a la misma distancia de la popa
  if (forma === 0) {
    ambos(p, (g) => {
      poner(g, plancha([[2.2, z - 6], [2.2, z - 1], [6.9, z - 3.5], [6.9, z - 6.4]], 0.34), m.ala[0], 0, -0.1, 0);
      poner(g, caja(0.3, 0.26, 1.4, 0.06), m.luzRoja, 6.95, 0.04, z - 5);
    });
    return;
  }
  if (forma === 1) {
    // Ala escalonada: tres cajas apiladas con rejillas y un pod en la punta.
    ambos(p, (g) => {
      poner(g, plancha([[2.2, z - 8.4], [2.2, z - 0.6], [5.4, z - 2.4], [10.2, z - 5.6], [10.2, z - 8.8]], 0.42), m.ala[1], 0, -0.3, 0);
      poner(g, plancha([[3.4, z - 8], [3.4, z - 3.4], [7.6, z - 5.4], [7.6, z - 8.2]], 0.5), m.crema, 0, 0.32, 0);
      rejilla(g, 1.7, 2.6, 7, 5.4, 0.86, z - 6.2);
      poner(g, plancha([[8.4, z - 8.6], [8.4, z - 6.4], [10, z - 7], [10, z - 8.6]], 0.9), m.coral, 0, -0.06, 0);
      // Pod de la punta.
      poner(g, tuboEje(0.42, 5.6), m.cromo, 10.5, 0, z - 6.4);
      poner(g, new THREE.ConeGeometry(0.42, 1.5, 20).rotateX(Math.PI / 2), m.coral, 10.5, 0, z - 2.9);
      poner(g, new THREE.CylinderGeometry(0.36, 0.42, 0.5, 20).rotateX(Math.PI / 2), m.oscuro, 10.5, 0, z - 9.4);
      // Aleta vertical.
      const f = poner(g, plancha([[0, z - 8.6], [0, z - 5.4], [2.6, z - 7.4], [2.6, z - 8.9]], 0.16), m.ala[1], 7.6, 0.9, 0, 0, 0, Math.PI / 2 - 0.26);
      f.castShadow = true;
    });
    return;
  }
  // Doble ala en flecha invertida, con góndolas y luces cyan.
  ambos(p, (g) => {
    poner(g, plancha([[2.2, z - 9.2], [2.2, z - 3.6], [11.4, z + 2.6], [12.8, z + 2.2], [8.4, z - 7.6]], 0.36), m.ala[2], 0, -0.5, 0);
    poner(g, plancha([[2.2, z - 8.2], [2.2, z - 5.6], [7.2, z - 7.2], [8.2, z - 8.9]], 0.3), m.ala[1], 0, 1.02, 0);
    rejilla(g, 1.4, 3, 8, 5, -0.2, z - 3.9, 0);
    poner(g, tuboEje(0.5, 6.4), m.cromo, 12.1, -0.42, z + 0.6);
    poner(g, new THREE.TorusGeometry(0.5, 0.06, 8, 28), m.luzCian, 12.1, -0.42, z + 3.9);
    poner(g, new THREE.ConeGeometry(0.5, 1.8, 20).rotateX(Math.PI / 2), m.crema, 12.1, -0.42, z + 4.7);
    poner(g, plancha([[0, z - 8.8], [0, z - 5.8], [3.4, z - 7.8], [3.4, z - 9.6]], 0.16), m.ala[2], 7, 1.06, 0, 0, 0, Math.PI / 2 - 0.34);
  });
}

function montarTanques(p: THREE.Group, forma: number, popa: number) {
  const m = mat();
  const tanque = (g: THREE.Object3D, x: number, y: number, z: number, r: number, largo: number, cuerpo: THREE.Material, punta: THREE.Material) => {
    poner(g, tuboEje(r, largo), cuerpo, x, y, z);
    for (const s of [-1, 1]) poner(g, new THREE.SphereGeometry(r, 24, 12), punta, x, y, z + (s * largo) / 2).scale.z = 0.7;
    for (const u of [-0.32, 0, 0.32]) poner(g, new THREE.TorusGeometry(r + 0.02, 0.06, 8, 32), m.oscuro, x, y, z + u * largo);
  };
  if (forma === 0) {
    tanque(p, 0, 2.5, popa + 5.4, 1, 6, m.fuselaje[0], m.coral);
    return;
  }
  if (forma === 1) {
    ambos(p, (g) => {
      tanque(g, 3.4, 0.5, popa + 5.2, 1.15, 7.4, m.cromo, m.coral);
      poner(g, tuberia([[3, 1.5, popa + 1.2], [2.6, 1.5, popa + 3], [2.2, 1.2, popa + 4.6]], 0.11), m.cobre);
    });
    return;
  }
  ambos(p, (g) => {
    tanque(g, 3.7, 0.7, popa + 6.4, 1.35, 9.6, m.crema, m.cromo);
    poner(g, tuberia([[3.3, 1.9, popa + 1.2], [2.9, 1.9, popa + 3.2], [2.4, 1.5, popa + 5]], 0.14), m.cromo);
    for (const u of [-0.16, 0.16]) poner(g, new THREE.TorusGeometry(1.38, 0.05, 8, 32), m.luzCian, 3.7, 0.7, popa + 6.4 + u * 9.6);
  });
  tanque(p, 0, 2.9, popa + 5.2, 1.05, 7, m.crema, m.cromo);
}

function montarMotores(p: THREE.Group, forma: number, popa: number): THREE.Vector3[] {
  const m = mat();
  const salidas: THREE.Vector3[] = [];
  const motor = (g: THREE.Object3D, x: number, y: number, z: number, r: number, l: number, interior: THREE.Material = m.fuego) => {
    const o = poner(g, tobera(r, l), m.cromoOscuro, x, y, z);
    (o.material as THREE.Material).side = THREE.DoubleSide;
    poner(g, new THREE.CircleGeometry(r * 0.55, 20).rotateY(Math.PI), interior, x, y, z - l * 0.35);
    salidas.push(new THREE.Vector3(x, y, z - l));
  };
  const tambor = (g: THREE.Object3D, x: number, y: number, z: number, r: number, l: number) => {
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, -l / 2)];
    for (let k = 0; k <= 16; k++) {
      const f = k / 16;
      pts.push(new THREE.Vector2(r * (0.86 + (k % 2 ? 0.06 : 0) + 0.08 * Math.sin(f * Math.PI)), -l / 2 + f * l));
    }
    pts.push(new THREE.Vector2(0, l / 2));
    poner(g, new THREE.LatheGeometry(pts, 40).rotateX(Math.PI / 2), m.cromo, x, y, z);
    poner(g, new THREE.TorusGeometry(r * 0.98, 0.09, 8, 40), m.coral, x, y, z + l / 2);
    poner(g, new THREE.TorusGeometry(r * 0.98, 0.09, 8, 40), m.oscuro, x, y, z - l / 2);
  };
  if (forma === 0) {
    poner(p, caja(4.4, 3, 1.3, 0.2), m.fuselaje[0], 0, 0, popa - 0.5);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + Math.PI / 2;
      motor(p, Math.cos(a) * 1.15, Math.sin(a) * 0.82, popa - 1.1, 0.95, 2.2);
    }
    poner(p, tuberia([[1.8, 1.4, popa + 1], [2.2, 1.2, popa - 0.4], [1.6, 0.4, popa - 1.2]], 0.1), m.cobre);
    poner(p, tuberia([[-1.8, 1.4, popa + 1], [-2.2, 1.2, popa - 0.4], [-1.6, 0.4, popa - 1.2]], 0.1), m.cobre);
    return salidas;
  }
  if (forma === 1) {
    tambor(p, 0, 0, popa - 2.2, 2.5, 4.8);
    const r = 1.55;
    motor(p, 0, 0, popa - 4.7, 0.62, 1.6);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      motor(p, Math.cos(a) * r, Math.sin(a) * r, popa - 4.7, 0.55, 1.5);
    }
    // Tuberías de combustible por fuera del tambor.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.3, c = Math.cos(a), o = Math.sin(a);
      poner(p, tuberia([[c * 1.9, o * 1.4, popa + 1.2], [c * 2.7, o * 2.6, popa - 0.6], [c * 2.72, o * 2.72, popa - 2.6], [c * 2.4, o * 2.4, popa - 4.7]], 0.12), k % 2 ? m.cobre : m.cromoOscuro);
    }
    return salidas;
  }
  ambos(p, (g) => {
    tambor(g, 2.1, 0, popa - 2.4, 2, 5.2);
    motor(g, 2.1, 0, popa - 5.1, 0.5, 1.4, m.luzCian);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU;
      motor(g, 2.1 + Math.cos(a) * 1.28, Math.sin(a) * 1.28, popa - 5.1, 0.36, 1.2, m.luzCian);
    }
    poner(g, new THREE.TorusGeometry(1.86, 0.08, 8, 40), m.luzCian, 2.1, 0, popa - 5.05);
    poner(g, tuberia([[1.2, 1.5, popa + 1.2], [2.1, 2.2, popa - 1], [2.1, 2.1, popa - 4.2]], 0.13), m.cobre);
  });
  poner(p, caja(1.4, 2.4, 5, 0.2), m.oscuro, 0, 0, popa - 2);
  // Veintiuno: diez en cada tambor y uno entre los dos. `ambos` monta el mismo
  // lado dos veces, así que la lista trae un tambor repetido.
  const tamborDerecho = salidas.slice(0, 10);
  salidas.length = 0;
  motor(p, 0, 0, popa - 4.4, 0.42, 1.1, m.luzCian);
  return [...tamborDerecho, ...tamborDerecho.map((v) => new THREE.Vector3(-v.x, v.y, v.z)), ...salidas];
}

function montarEscudo(p: THREE.Group, forma: number, popa: number) {
  if (forma === 0) return;
  const m = mat();
  if (forma === 1) {
    ambos(p, (g) => {
      for (const [z, largo, y] of [[-2.6, 3, -0.7], [1, 2.6, -0.5]] as const) {
        poner(g, caja(1.8, 0.16, largo, 0.08), m.teja, 2.5, y, z, 0, 0, -1.16);
      }
    });
    poner(p, plancha([[-1.6, -4], [1.6, -4], [1.2, 2], [-1.2, 2]], 0.16), m.teja, 0, -2.0, 0);
    return;
  }
  // Panza entera de losetas negras con faldones a los costados.
  poner(p, loft([{ z: popa + 0.5, w: 4.6, h: 0.5, y: -1.72, n: 2.4 }, { z: -2, w: 5.4, h: 0.6, y: -1.98, n: 2.4 }, { z: 3, w: 4.4, h: 0.5, y: -1.72, n: 2.4 }, { z: 9, w: 2.4, h: 0.3, y: -1.08, n: 2.4 }]), m.teja);
  ambos(p, (g) => {
    poner(g, caja(2.2, 0.18, 7.4, 0.08), m.teja, 2.62, -0.56, -2.2, 0, 0, -1.2);
    poner(g, caja(0.16, 0.34, 7.4, 0.04), m.crema, 3, 0.45, -2.2, 0, 0, -1.2);
  });
}

/** Tren de aterrizaje: tres patas con su amortiguador. */
function montarTren(p: THREE.Group, popa: number) {
  const m = mat();
  for (const [x, z, l] of [[0, 5.2, 2.1], [2.8, popa + 3, 2.5], [-2.8, popa + 3, 2.5]] as const) {
    poner(p, new THREE.CylinderGeometry(0.2, 0.26, l), m.cromo, x, -2 - l / 2 + 0.6, z);
    poner(p, new THREE.CylinderGeometry(0.3, 0.3, 0.5), m.oscuro, x, -1.9, z);
    poner(p, caja(1.1, 0.2, 1.9, 0.08), m.oscuro, x, -1.6 - l + 0.1, z);
  }
}

// ------------------------------------------------------------------ la nave

/** Altura del casco sobre el suelo con el tren desplegado. */
export const ALTO_CASCO = 3.5;

export function crearNaveModular(d: Diseno): NaveModular {
  const forma = (r: Ranura) => (piezaDe(d[r]) ?? deSerie(r)).forma;
  const raiz = new THREE.Group();
  raiz.name = 'nave';
  const cuerpo = new THREE.Group();
  cuerpo.position.y = ALTO_CASCO;
  raiz.add(cuerpo);
  const partes = Object.fromEntries(RANURAS.map((r) => {
    const g = new THREE.Group();
    g.name = `parte-${r}`;
    cuerpo.add(g);
    return [r, g];
  })) as Record<Ranura, THREE.Group>;

  const cf = forma('casco'), popa = POPA[cf];
  montarCasco(partes.casco, cf);
  const morro = montarProa(partes.proa, forma('proa'), cf);
  montarAlas(partes.aletas, forma('aletas'), popa);
  montarTanques(partes.propulsor, forma('propulsor'), popa);
  const toberas = montarMotores(partes.motores, forma('motores'), popa);
  montarEscudo(partes.escudo, forma('escudo'), popa);
  const tren = new THREE.Group();
  cuerpo.add(tren);
  montarTren(tren, popa);
  for (const v of toberas) v.y += ALTO_CASCO;
  const chorros = [[2.3, 5], [-2.3, 5], [2.5, popa + 4], [-2.5, popa + 4]].map(([x, z]) => new THREE.Vector3(x, ALTO_CASCO - 1.9, z));
  return { raiz, partes, tren, toberas, chorros, morro, largo: morro - popa + 6 };
}

/**
 * Junta la nave en una malla por material (conservando la pintura), para que en el
 * mapa cueste una veintena de llamadas de dibujo. Lo que va a un lado y al otro de
 * la nave lleva escala negativa: al hornearla hay que dar la vuelta a sus caras.
 */
export function fusionarNave(raiz: THREE.Object3D, destino: THREE.Object3D) {
  raiz.updateMatrixWorld(true);
  const porMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  raiz.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const copia = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
    const g = copia.index ? copia.toNonIndexed() : copia;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (o.matrixWorld.determinant() < 0) voltear(g);
    const material = o.material as THREE.Material;
    porMaterial.set(material, [...(porMaterial.get(material) ?? []), g]);
  });
  for (const [material, geos] of porMaterial) {
    const fusion = mergeGeometries(geos, false);
    if (!fusion) continue;
    const m = new THREE.Mesh(fusion, material);
    m.castShadow = !(material instanceof THREE.MeshBasicMaterial);
    m.matrixAutoUpdate = false;
    destino.add(m);
  }
}

/** Da la vuelta a cada triángulo de una geometría sin índices. */
export function voltear(g: THREE.BufferGeometry) {
  for (const nombre of ['position', 'normal', 'uv']) {
    const a = g.attributes[nombre] as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const d = a.array, n = a.itemSize;
    for (let t = 0; t < a.count; t += 3) {
      for (let c = 0; c < n; c++) {
        const i = (t + 1) * n + c, j = (t + 2) * n + c, x = d[i];
        d[i] = d[j];
        d[j] = x;
      }
    }
    a.needsUpdate = true;
  }
}

/**
 * Reflejos para el cromo: un cielo sencillo convertido en mapa de entorno. En el
 * astillero es verde agua; bajo el velo, rojo.
 */
export function crearEntorno(renderer: THREE.WebGLRenderer, bajoElVelo = false): THREE.Texture {
  const cielo = new THREE.Scene();
  const domo = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: bajoElVelo ? `varying vec3 vP;
      void main() {
        float h = vP.y;
        vec3 c = mix(vec3(0.2, 0.12, 0.12), vec3(0.95, 0.5, 0.42), smoothstep(-0.2, 0.2, h));
        c = mix(c, vec3(1.1, 0.8, 0.66), smoothstep(0.12, 0.4, h) * 0.7);
        c = mix(c, vec3(0.5, 0.16, 0.18), smoothstep(0.4, 1.0, h));
        c += vec3(1.8, 1.2, 0.9) * smoothstep(0.93, 0.995, dot(vP, normalize(vec3(0.5, 0.45, 0.75))));
        gl_FragColor = vec4(c, 1.0);
      }` : `varying vec3 vP;
      void main() {
        float h = vP.y;
        vec3 c = mix(vec3(0.05, 0.1, 0.12), vec3(0.2, 0.75, 0.68), smoothstep(-0.2, 0.25, h));
        c = mix(c, vec3(1.2, 1.1, 0.85), smoothstep(0.18, 0.5, h) * 0.8);
        c = mix(c, vec3(0.22, 0.42, 0.6), smoothstep(0.5, 1.0, h));
        c += vec3(2.4, 1.5, 0.9) * smoothstep(0.93, 0.995, dot(vP, normalize(vec3(0.5, 0.45, 0.75))));
        c += vec3(0.5, 1.3, 1.4) * smoothstep(0.9, 0.99, dot(vP, normalize(vec3(-0.7, 0.15, -0.7))));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  cielo.add(domo);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const t = pmrem.fromScene(cielo, 0.02).texture;
  pmrem.dispose();
  return t;
}
