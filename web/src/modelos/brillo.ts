import * as THREE from 'three';
import { rampaToon } from './kit.ts';

// Texturas y brillos de los jefes grandes. Todo se genera en código, píxel a
// píxel en DataTexture (sin canvas: así lo cargan también las pruebas en
// Node), con filtro «nearest» para que se vea en bloques, como el resto del
// arte en píxeles del juego.
//
// - placas(): chapa de HELIOS con juntas, remaches y pistas de circuito que
//   se iluminan (mapa de emisión aparte).
// - roca(): piedra con vetas y grietas de lava o plasma que se iluminan.
// - materialBrillante(): toon con esa textura y su emisión; el juego hace
//   latir `emissiveIntensity` (userData.latir) con la furia del jefe.
// - halo(): sprite aditivo con un degradado redondo: el resplandor de ojos,
//   núcleos y llamas, sin postproceso.

export interface Textura {
  mapa: THREE.DataTexture;
  emision: THREE.DataTexture;
}

function rng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function textura(n: number, datos: Uint8Array): THREE.DataTexture {
  const t = new THREE.DataTexture(datos, n, n, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Dos lienzos de n × n: el de color (gris que multiplica al material) y el de emisión. */
function lienzos(n: number) {
  const mapa = new Uint8Array(n * n * 4), emision = new Uint8Array(n * n * 4);
  const pon = (d: Uint8Array, x: number, y: number, v: number) => {
    const i = ((y & (n - 1)) * n + (x & (n - 1))) * 4;
    d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v));
    d[i + 3] = 255;
  };
  for (let i = 0; i < n * n; i++) { mapa[i * 4 + 3] = 255; emision[i * 4 + 3] = 255; }
  return { mapa, emision, pon };
}

const cacheTexturas = new Map<string, Textura>();

/**
 * Chapa: losas de 16 px con junta oscura, remaches en las esquinas, rayas de
 * desgaste y pistas de circuito encendidas que corren por algunas juntas.
 */
export function placas(semilla = 7): Textura {
  const clave = `placas:${semilla}`;
  if (cacheTexturas.has(clave)) return cacheTexturas.get(clave)!;
  const n = 32, r = rng(semilla);
  const { mapa, emision, pon } = lienzos(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 214 + Math.floor(r() * 26);
      if (x % 16 === 0 || y % 16 === 0) v = 120;
      else if (x % 16 === 1 || y % 16 === 1) v = 245;
      if ((x % 16 === 3 || x % 16 === 13) && (y % 16 === 3 || y % 16 === 13)) v = 150;
      pon(mapa, x, y, v);
    }
  }
  // Pistas de circuito: tramos rectos con codos y un nodo al final.
  for (let k = 0; k < 5; k++) {
    let x = Math.floor(r() * n), y = Math.floor(r() * n);
    const horizontal = r() < 0.5;
    for (let p = 0; p < 9 + r() * 8; p++) {
      pon(emision, x, y, 255);
      pon(mapa, x, y, 255);
      if (p === 5) { if (horizontal) y++; else x++; } else if (horizontal) x++; else y++;
    }
    pon(emision, x, y, 255); pon(emision, x + 1, y, 255); pon(emision, x, y + 1, 255); pon(emision, x + 1, y + 1, 255);
  }
  const t = { mapa: textura(n, mapa), emision: textura(n, emision) };
  cacheTexturas.set(clave, t);
  return t;
}

/**
 * Roca: manchas de dos tonos y grietas que serpentean; las grietas son las
 * que brillan (lava, plasma o escarcha según el color de emisión).
 */
export function roca(semilla = 3): Textura {
  const clave = `roca:${semilla}`;
  if (cacheTexturas.has(clave)) return cacheTexturas.get(clave)!;
  const n = 32, r = rng(semilla);
  const { mapa, emision, pon } = lienzos(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const mancha = Math.sin(x * 0.55 + r() * 0.6) * Math.cos(y * 0.45) > 0.35 ? -26 : 0;
      pon(mapa, x, y, 210 + mancha + Math.floor(r() * 30));
    }
  }
  for (let k = 0; k < 4; k++) {
    let x = Math.floor(r() * n), y = Math.floor(r() * n);
    for (let p = 0; p < 14; p++) {
      pon(emision, x, y, 255);
      pon(mapa, x, y, 90);
      x += r() < 0.5 ? 1 : 0;
      y += r() < 0.7 ? 1 : -1;
    }
  }
  const t = { mapa: textura(n, mapa), emision: textura(n, emision) };
  cacheTexturas.set(clave, t);
  return t;
}

const cacheMateriales = new Map<string, THREE.MeshToonMaterial>();

/**
 * Toon con textura en bloques y emisión: las juntas o grietas encendidas del
 * color `luz`. `repetir` agranda o encoge los bloques sobre piezas grandes.
 */
export function materialBrillante(color: string, luz: string, tex: Textura, intensidad = 1.4, repetir = 1): THREE.MeshToonMaterial {
  const clave = `${color}:${luz}:${tex.mapa.uuid}:${intensidad}:${repetir}`;
  const hecho = cacheMateriales.get(clave);
  if (hecho) return hecho;
  const mapa = repetir === 1 ? tex.mapa : tex.mapa.clone();
  const emision = repetir === 1 ? tex.emision : tex.emision.clone();
  if (repetir !== 1) {
    for (const t of [mapa, emision]) { t.repeat.set(repetir, repetir); t.needsUpdate = true; }
  }
  const m = new THREE.MeshToonMaterial({
    color, map: mapa, emissive: new THREE.Color(luz), emissiveMap: emision, emissiveIntensity: intensidad, gradientMap: rampaToon(),
  });
  m.userData.latir = intensidad;
  cacheMateriales.set(clave, m);
  return m;
}

let degradado: THREE.DataTexture | null = null;

/** Disco blanco con borde suave: el mismo para todos los halos. */
export function texturaHalo(): THREE.DataTexture {
  if (degradado) return degradado;
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - r) ** 2;
      const i = (y * n + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
    }
  }
  degradado = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  degradado.magFilter = THREE.LinearFilter;
  degradado.needsUpdate = true;
  return degradado;
}

/** Resplandor aditivo que siempre mira a cámara, colgado de `padre`. */
export function halo(padre: THREE.Object3D, color: string, tamano: number, x = 0, y = 0, z = 0, opacidad = 0.85): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaHalo(), color, transparent: true, opacity: opacidad, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.position.set(x, y, z);
  s.scale.setScalar(tamano);
  s.userData.halo = true;
  padre.add(s);
  return s;
}
