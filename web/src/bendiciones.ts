// Bendiciones: mejoras de estadística que dan los pilones de carga (eliges
// una de tres) y los cofres (sale una al azar). Cada una tiene rareza, y la
// rareza decide cuánto da. Datos puros y funciones pequeñas, sin THREE: el
// juego las suma en `Game.bendiciones` y las aplica donde toca.

export type BendicionId = 'dano' | 'recarga' | 'area' | 'critico' | 'velocidad' | 'vida' | 'iman' | 'regen' | 'chatarra';
export type Rareza = 'comun' | 'rara' | 'epica' | 'legendaria';

export interface BendicionDef {
  id: BendicionId;
  nombre: string;
  /** Icono de iconos.ts (de las mejoras o del menú). */
  icono: string;
  /** Valor por rareza: común, rara, épica, legendaria. */
  valores: readonly [number, number, number, number];
  /** Cómo se lee el valor («+12 % de daño»). */
  texto: (v: number) => string;
}

export const RAREZAS: Record<Rareza, { nombre: string; color: string; peso: number; indice: number }> = {
  comun: { nombre: 'Común', color: '#cfd6e6', peso: 60, indice: 0 },
  rara: { nombre: 'Rara', color: '#5ee0ff', peso: 27, indice: 1 },
  epica: { nombre: 'Épica', color: '#d07bff', peso: 10, indice: 2 },
  legendaria: { nombre: 'Legendaria', color: '#ffd25a', peso: 3, indice: 3 },
};

const pct = (v: number) => `${Math.round(v * 100)} %`;

export const BENDICIONES: Record<BendicionId, BendicionDef> = {
  dano: { id: 'dano', nombre: 'Núcleo caliente', icono: 'b-dano', valores: [0.06, 0.1, 0.16, 0.25], texto: (v) => `+${pct(v)} de daño de todas las herramientas.` },
  recarga: { id: 'recarga', nombre: 'Bobinas frías', icono: 'enfriamiento', valores: [0.05, 0.08, 0.12, 0.18], texto: (v) => `−${pct(v)} de recarga de todas las herramientas.` },
  area: { id: 'area', nombre: 'Lente de ADA', icono: 'area', valores: [0.06, 0.1, 0.15, 0.22], texto: (v) => `+${pct(v)} de alcance y radio.` },
  critico: { id: 'critico', nombre: 'Punto débil', icono: 'b-critico', valores: [0.03, 0.05, 0.08, 0.12], texto: (v) => `+${pct(v)} de probabilidad de crítico (×2 de daño).` },
  velocidad: { id: 'velocidad', nombre: 'Servos ligeros', icono: 'velocidad', valores: [0.05, 0.08, 0.12, 0.16], texto: (v) => `+${pct(v)} de velocidad de movimiento.` },
  vida: { id: 'vida', nombre: 'Placa de refuerzo', icono: 'blindaje', valores: [10, 15, 25, 40], texto: (v) => `+${v} de integridad máxima, y la repara.` },
  iman: { id: 'iman', nombre: 'Bobina imantada', icono: 'iman', valores: [0.12, 0.2, 0.3, 0.45], texto: (v) => `+${pct(v)} de radio para recoger chatarra.` },
  regen: { id: 'regen', nombre: 'Sellador lento', icono: 'reparacion', valores: [0.3, 0.5, 0.8, 1.2], texto: (v) => `Repara ${v.toLocaleString('es-ES')} de integridad por segundo.` },
  chatarra: { id: 'chatarra', nombre: 'Ojo de chatarrero', icono: 'b-chatarra', valores: [0.08, 0.12, 0.18, 0.25], texto: (v) => `+${pct(v)} de chatarra recogida.` },
};

export interface Bendicion {
  id: BendicionId;
  rareza: Rareza;
  valor: number;
}

/** Suma de lo que llevas: cada clave es el total de esa bendición. */
export type Totales = Record<BendicionId, number>;

export function totalesVacios(): Totales {
  return { dano: 0, recarga: 0, area: 0, critico: 0, velocidad: 0, vida: 0, iman: 0, regen: 0, chatarra: 0 };
}

/**
 * Tira una rareza. `suerte` desplaza peso de común a lo raro (los cofres
 * tiran con más suerte que los pilones, y la suerte sube con el minuto).
 */
export function tirarRareza(r: number, suerte = 0): Rareza {
  const pesos = (Object.keys(RAREZAS) as Rareza[]).map((k) => {
    const base = RAREZAS[k].peso;
    return k === 'comun' ? Math.max(10, base - suerte * 30) : base * (1 + suerte * RAREZAS[k].indice * 0.5);
  });
  const total = pesos.reduce((s, p) => s + p, 0);
  let x = Math.min(0.999999, Math.max(0, r)) * total;
  const claves = Object.keys(RAREZAS) as Rareza[];
  for (let k = 0; k < claves.length; k++) {
    if (x < pesos[k]) return claves[k];
    x -= pesos[k];
  }
  return 'legendaria';
}

/** `cuantas` bendiciones distintas, cada una con su rareza. */
export function tirarBendiciones(rand: () => number, cuantas: number, suerte = 0): Bendicion[] {
  const ids = Object.keys(BENDICIONES) as BendicionId[];
  const elegidas: Bendicion[] = [];
  while (elegidas.length < cuantas && ids.length) {
    const id = ids.splice(Math.floor(rand() * ids.length), 1)[0];
    const rareza = tirarRareza(rand(), suerte);
    elegidas.push({ id, rareza, valor: BENDICIONES[id].valores[RAREZAS[rareza].indice] });
  }
  return elegidas;
}

export function describir(b: Bendicion): string {
  return BENDICIONES[b.id].texto(b.valor);
}
