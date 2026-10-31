// META SPACE · FOCO 3 — Reglas deterministas dibujo/prompt → stats.
//
// Este módulo es PURO: sin DOM, sin Node, sin sintaxis TypeScript
// no-borrable (nada de enums ni parameter properties). Así lo comparten tal
// cual el cliente (Vite) y el servidor (Node con type-stripping).
//
// REGLA VISIBLE (se muestra tal cual en la UI del creador):
//   rojo    = +ataque   (damage: 0.85 – 1.35)
//   azul    = +velocidad (speed: 4.20 – 6.50 m/s; base del juego: 5.2)
//   relleno = +vida      (hp: 70 – 150; base del juego: 100)
//   colores = +cadencia  (fire_rate: multiplicador de recarga 0.85 – 1.15;
//                        más colores = recarga más rápida = número más bajo)
//   tono dominante = especial (una de 6, ver SPECIALS)

export interface HeroStats {
  hp: number; // vida máxima (70–150)
  speed: number; // velocidad en m/s (4.2–6.5)
  damage: number; // multiplicador de daño (0.85–1.35)
  fire_rate: number; // multiplicador de recarga (0.85–1.15; menor = más rápido)
  special: SpecialId; // id del especial
  lore: string; // frase de trasfondo en español
}

export type SpecialId =
  | 'nova-plasma'
  | 'pulso-ada'
  | 'enjambre'
  | 'caparazon'
  | 'sobremarcha'
  | 'eco-helios';

export interface SpecialDef {
  id: SpecialId;
  name: string;
  blurb: string;
}

export const SPECIALS: Record<SpecialId, SpecialDef> = {
  'nova-plasma': {
    id: 'nova-plasma',
    name: 'Nova de plasma',
    blurb: 'Al recibir un golpe, explotas en plasma que quema a lo cercano.',
  },
  'pulso-ada': {
    id: 'pulso-ada',
    name: 'Pulso de ADA',
    blurb: 'Cada subida de nivel emite una onda que empuja a la horda.',
  },
  enjambre: {
    id: 'enjambre',
    name: 'Enjambre reparador',
    blurb: 'Un dron de chatarra te sigue y repara 1 de vida cada 5 s.',
  },
  caparazon: {
    id: 'caparazon',
    name: 'Caparazón de chatarra',
    blurb: 'Cada 30 s, un escudo bloquea por completo el siguiente golpe.',
  },
  sobremarcha: {
    id: 'sobremarcha',
    name: 'Sobremarcha',
    blurb: 'Tras 5 s sin daño, corres un 15 % más rápido hasta que te toquen.',
  },
  'eco-helios': {
    id: 'eco-helios',
    name: 'Eco de HELIOS',
    blurb: 'Los Recolectores te confunden con una baliza durante 2 s al verte.',
  },
};

export const STAT_RANGES = {
  hp: [70, 150] as const,
  speed: [4.2, 6.5] as const,
  damage: [0.85, 1.35] as const,
  fire_rate: [0.85, 1.15] as const,
} as const;

/** Texto corto de la regla, reutilizado por la UI y por `/api/stats`. */
export const REGLA_STATS =
  'Rojo = +ataque · Azul = +velocidad · Relleno = +vida · Colores = +cadencia · Tono dominante = especial.';

/** Rasgos medidos sobre los píxeles opacos de un sprite de 128×128. */
export interface DrawingFeatures {
  coverage: number; // 0–1: fracción de píxeles opacos
  meanR: number; // 0–255
  meanG: number; // 0–255
  meanB: number; // 0–255
  colors: number; // nº de colores distintos (RGB444, tope 16)
  brightness: number; // 0–255
  pixels: number; // nº de píxeles opacos
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Mide los rasgos de un sprite a partir de sus píxeles RGBA
 * (`ctx.getImageData(0, 0, 128, 128).data`).
 */
export function analyzePixels(data: Uint8ClampedArray | Uint8Array): DrawingFeatures {
  let n = 0;
  let sR = 0;
  let sG = 0;
  let sB = 0;
  const seen = new Set<number>();
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) continue; // casi transparente = fondo
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    n++;
    sR += r;
    sG += g;
    sB += b;
    // Cuantiza a 4 bits por canal para contar "colores" de forma estable.
    seen.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
  }
  if (n === 0) {
    return { coverage: 0, meanR: 0, meanG: 0, meanB: 0, colors: 0, brightness: 0, pixels: 0 };
  }
  const meanR = sR / n;
  const meanG = sG / n;
  const meanB = sB / n;
  return {
    coverage: n / total,
    meanR,
    meanG,
    meanB,
    colors: Math.min(16, seen.size),
    brightness: (meanR + meanG + meanB) / 3,
    pixels: n,
  };
}

/** Elige el especial a partir del tono dominante (media RGB de opacos). */
export function specialFromTone(r: number, g: number, b: number, brightness: number): SpecialId {
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat < 28) {
    // Grises: el brillo decide entre caparazón (oscuro) y eco (claro).
    return brightness < 130 ? 'caparazon' : 'eco-helios';
  }
  if (r >= g && r >= b) return 'nova-plasma';
  if (b >= r && b >= g) return 'pulso-ada';
  if (g >= r && g >= b) return brightness > 150 ? 'enjambre' : 'sobremarcha';
  return 'eco-helios';
}

function nombreDelTono(r: number, g: number, b: number): string {
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat < 28) return b < 130 ? 'grafito' : 'niebla';
  if (r >= g && r >= b) return g > 150 ? 'ámbar' : 'rojo';
  if (b >= r && b >= g) return 'azul';
  if (g >= r && g >= b) return 'verde';
  return 'violeta';
}

function adjetivoDeCobertura(coverage: number): string {
  if (coverage < 0.04) return 'apenas esbozado';
  if (coverage < 0.12) return 'ligero';
  if (coverage < 0.25) return 'compacto';
  if (coverage < 0.4) return 'macizo';
  return 'colosal';
}

/** Convierte rasgos de dibujo en stats. 100 % determinista. */
export function statsFromDrawing(f: DrawingFeatures): HeroStats {
  const hp = Math.round(clamp(70 + f.coverage * 220, 70, 150));
  const damage = round2(clamp(0.85 + (f.meanR / 255) * 0.5, 0.85, 1.35));
  const speed = round2(clamp(4.2 + (f.meanB / 255) * 2.3, 4.2, 6.5));
  const fire_rate = round2(clamp(1.15 - f.colors * 0.025, 0.85, 1.15));
  const special = specialFromTone(f.meanR, f.meanG, f.meanB, f.brightness);
  const tono = nombreDelTono(f.meanR, f.meanG, f.meanB);
  const cuerpo = adjetivoDeCobertura(f.coverage);
  const lore =
    `Trazo ${tono} ${cuerpo} bajo el cielo rojo. ` +
    `ADA lo mira y dice: «Si HELIOS pregunta, eres ${SPECIALS[special].name.toLowerCase()}.»`;
  return { hp, speed, damage, fire_rate, special, lore };
}

// ------------------------------------------------- modo IMAGEN (prompt)

/** FNV-1a de 32 bits: hash estable para que el mismo prompt dé lo mismo. */
export function hashPrompt(prompt: string): number {
  let h = 0x811c9dc5;
  const s = prompt.normalize('NFC').trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function rngFromSeed(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface KeywordHit {
  damage: number;
  speed: number;
  hp: number;
  fire: number; // reduce fire_rate (más cadencia)
  special: SpecialId | null;
}

const KEYWORDS: { words: string[]; hit: Partial<KeywordHit> & { special?: SpecialId } }[] = [
  {
    words: ['fuego', 'rojo', 'roja', 'plasma', 'furia', 'magma', 'guerra', 'dragon', 'dragón', 'cañon', 'cañón', 'fire', 'red', 'war'],
    hit: { damage: 0.09, special: 'nova-plasma' },
  },
  {
    words: ['azul', 'hielo', 'rayo', 'viento', 'rapido', 'rápido', 'veloz', 'nitro', 'tormenta', 'blue', 'fast', 'speed', 'storm'],
    hit: { speed: 0.35, special: 'pulso-ada' },
  },
  {
    words: ['tanque', 'acero', 'muro', 'roca', 'pesado', 'golem', 'titan', 'titán', 'caparazon', 'caparazón', 'tank', 'steel', 'stone'],
    hit: { hp: 12, special: 'caparazon' },
  },
  {
    words: ['enjambre', 'rafaga', 'ráfaga', 'lluvia', 'avispa', 'abeja', 'swarm', 'rapid'],
    hit: { fire: 0.05, special: 'enjambre' },
  },
  {
    words: ['sombra', 'sigilo', 'fantasma', 'espia', 'espía', 'noche', 'shadow', 'ghost'],
    hit: { speed: 0.15, fire: 0.03, special: 'eco-helios' },
  },
  {
    words: ['verde', 'selva', 'planta', 'bicho', 'insecto', 'green'],
    hit: { hp: 6, special: 'sobremarcha' },
  },
];

/** Stats derivadas del texto del jugador. Determinista para el mismo prompt. */
export function statsFromPrompt(prompt: string): HeroStats {
  const seed = hashPrompt(prompt || 'astronauta');
  const rand = rngFromSeed(seed);
  const low = prompt.normalize('NFC').toLowerCase();

  let damage = 1.0 + (rand() - 0.5) * 0.1;
  let speed = 5.2 + (rand() - 0.5) * 0.4;
  let hp = 100 + Math.round((rand() - 0.5) * 16);
  let fire_rate = 1.0 + (rand() - 0.5) * 0.06;
  let special: SpecialId | null = null;

  const tocadas: string[] = [];
  for (const group of KEYWORDS) {
    if (group.words.some((w) => low.includes(w))) {
      const h = group.hit;
      if (h.damage) damage += h.damage;
      if (h.speed) speed += h.speed;
      if (h.hp) hp += h.hp;
      if (h.fire) fire_rate -= h.fire;
      if (h.special && !special) special = h.special;
      tocadas.push(group.words[0]);
    }
  }
  if (!special) {
    const order: SpecialId[] = ['nova-plasma', 'pulso-ada', 'enjambre', 'caparazon', 'sobremarcha', 'eco-helios'];
    special = order[Math.floor(rand() * order.length)];
  }

  const hpFinal = Math.round(clamp(hp, 70, 150));
  const damageFinal = round2(clamp(damage, 0.85, 1.35));
  const speedFinal = round2(clamp(speed, 4.2, 6.5));
  const fireFinal = round2(clamp(fire_rate, 0.85, 1.15));
  const corto = (prompt.trim().slice(0, 60) || 'Astronauta sin nombre');
  const extra = tocadas.length ? ` Sabe a ${tocadas.slice(0, 2).join(' y ')}.` : '';
  const lore =
    `«${corto}», según el registro de ADA.${extra} ` +
    `HELIOS lo clasifica como ${SPECIALS[special].name.toLowerCase()}.`;
  return { hp: hpFinal, speed: speedFinal, damage: damageFinal, fire_rate: fireFinal, special, lore };
}

/** Comprueba que unos stats están dentro de los rangos del contrato. */
export function statsValidos(s: HeroStats): string[] {
  const errores: string[] = [];
  if (!Number.isFinite(s.hp) || s.hp < 70 || s.hp > 150) errores.push('hp fuera de 70–150');
  if (!Number.isFinite(s.speed) || s.speed < 4.2 || s.speed > 6.5) errores.push('speed fuera de 4.2–6.5');
  if (!Number.isFinite(s.damage) || s.damage < 0.85 || s.damage > 1.35) errores.push('damage fuera de 0.85–1.35');
  if (!Number.isFinite(s.fire_rate) || s.fire_rate < 0.85 || s.fire_rate > 1.15) errores.push('fire_rate fuera de 0.85–1.15');
  if (!SPECIALS[s.special]) errores.push('special desconocido');
  if (typeof s.lore !== 'string' || !s.lore.trim()) errores.push('lore vacío');
  return errores;
}
