import type { Zona } from './avisos.ts';

// Piloto automático del modo demo (`?demo=jefes`): juega contra los jefes
// para verlos sin tocar nada. Cada fotograma mira dónde está el jugador, el
// jefe y los avisos rojos del suelo, y decide:
//
// - Si está dentro de un aviso, sale corriendo por el lado más corto (lejos
//   del centro de un círculo, de lado en una franja o un cono), sin apuntar.
// - Si no, rodea al jefe a buena distancia para que las herramientas peguen
//   y no le alcance el cuerpo a cuerpo, cambiando de sentido cada poco.
// - Mientras, apunta el Cañón solar al jefe (al dragón, a la cabeza) y
//   dispara.
//
// Es una función pura: el juego le pasa el estado y aplica lo que devuelve.

export interface ObjetivoPiloto {
  x: number;
  z: number;
  radio: number;
  /** En el aire (el dragón volando): se le rodea más abierto. */
  vuela: boolean;
  /** Se le dispara con el Cañón (al dragón sí; a los gólems les pegan las herramientas). */
  canon: boolean;
  /** Adónde apuntar el Cañón (la cabeza del dragón o el pecho del gólem). */
  mira: { x: number; y: number; z: number };
}

export interface EntradaPiloto {
  x: number;
  y: number;
  z: number;
  t: number;
  objetivo: ObjetivoPiloto | null;
  zonas: Iterable<Zona>;
  canon: boolean;
  /** Su herramienta es de cuerpo a cuerpo (la llave de Idris): rodea pegado al jefe. */
  cerca?: boolean;
}

export interface SalidaPiloto {
  /** Dirección deseada en el mundo (x, z), longitud ≤ 1. */
  mx: number;
  mz: number;
  esprintar: boolean;
  apuntar: boolean;
  disparar: boolean;
  /** Hacia dónde debe mirar la cámara y la mira (yaw del juego y altura en rad). */
  yaw: number | null;
  miraAlta: number;
  /** Si ahora mismo está esquivando un aviso. */
  esquivando: boolean;
  /** Pulsa R cuando hay un jefe cerca; el juego decide si ya recargó. */
  habilidad: boolean;
}

const MARGEN = 1.6;

/** Dirección para salir de una zona, o null si no se está dentro. */
export function salida(z: Zona, px: number, pz: number): { x: number; z: number } | null {
  if (z.tipo === 'circulo') {
    const dx = px - z.x, dz = pz - z.z, d = Math.hypot(dx, dz);
    if (d > z.r + MARGEN) return null;
    return d > 0.3 ? { x: dx / d, z: dz / d } : { x: 1, z: 0 };
  }
  if (z.tipo === 'franja') {
    const rx = px - z.x, rz = pz - z.z;
    const largo = rx * z.dx + rz * z.dz;
    const lado = rx * z.dz - rz * z.dx;
    if (largo < -MARGEN || largo > z.largo + MARGEN || Math.abs(lado) > z.ancho / 2 + MARGEN) return null;
    const s = Math.sign(lado) || 1;
    return { x: z.dz * s, z: -z.dx * s };
  }
  const rx = px - z.x, rz = pz - z.z, d = Math.hypot(rx, rz);
  if (d > z.largo + MARGEN) return null;
  const fx = Math.sin(z.giro), fz = Math.cos(z.giro);
  const lado = rx * fz - rz * fx;
  const ang = Math.atan2(lado, rx * fx + rz * fz);
  if (Math.abs(ang) > z.medio + 0.25) return null;
  const s = Math.sign(lado) || 1;
  // De lado y un poco hacia fuera.
  return { x: fz * s * 0.85 + fx * 0.3, z: -fx * s * 0.85 + fz * 0.3 };
}

export function pilotar(e: EntradaPiloto): SalidaPiloto {
  let ex = 0, ez = 0, dentro = false;
  for (const z of e.zonas) {
    const s = salida(z, e.x, e.z);
    if (!s) continue;
    dentro = true;
    ex += s.x;
    ez += s.z;
  }
  const o = e.objetivo;
  if (dentro) {
    const l = Math.hypot(ex, ez) || 1;
    return { mx: ex / l, mz: ez / l, esprintar: true, apuntar: false, disparar: false, yaw: o ? yawHacia(e, o.x, o.z) : null, miraAlta: 0.15, esquivando: true, habilidad: false };
  }
  if (!o) {
    // Sin jefe: vuelve despacio hacia el centro del sector.
    const d = Math.hypot(e.x, e.z);
    return { mx: d > 6 ? -e.x / d * 0.4 : 0, mz: d > 6 ? -e.z / d * 0.4 : 0, esprintar: false, apuntar: false, disparar: false, yaw: null, miraAlta: 0.15, esquivando: false, habilidad: false };
  }

  // Rodear al jefe a buena distancia, cambiando de sentido cada 7 s.
  const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz) || 1;
  const rx = dx / d, rz = dz / d;
  const giro = Math.floor(e.t / 7) % 2 ? 1 : -1;
  const quiero = o.vuela ? 14 : o.radio + (e.cerca ? 2.5 : 10);
  const acercar = Math.max(-1, Math.min(1, (quiero - d) * 0.25));
  let mx = -rz * giro * 0.8 + rx * acercar, mz = rx * giro * 0.8 + rz * acercar;
  const l = Math.hypot(mx, mz) || 1;
  mx /= l;
  mz /= l;

  const apuntar = e.canon && o.canon;
  const h = Math.hypot(o.mira.x - e.x, o.mira.z - e.z) || 1;
  return {
    mx, mz,
    esprintar: d < quiero - 4,
    apuntar,
    disparar: apuntar && h < 75,
    yaw: yawHacia(e, o.mira.x, o.mira.z),
    miraAlta: Math.atan2(o.mira.y - (e.y + 2.5), h),
    esquivando: false,
    habilidad: d < 15,
  };
}

/** Yaw del juego para que la cámara mire de (e.x, e.z) hacia (x, z): adelante es (−sen yaw, −cos yaw). */
function yawHacia(e: EntradaPiloto, x: number, z: number) {
  return Math.atan2(-(x - e.x), -(z - e.z));
}
