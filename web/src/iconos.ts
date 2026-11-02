// Iconos de las mejoras: herramientas, pasivas, equipo, especiales y el parche.
//
// Mismo dibujo que los modelos: piezas gruesas, contorno oscuro (el color de
// contorno del kit), dos tonos y un brillo blanco. Son SVG en texto, en una
// caja de 64 × 64, para meterlos tal cual en el HUD y en las tarjetas de
// subir de nivel. La clave es el id que usa el juego (WeaponId, PassiveId,
// GearId, SpecialId) y `parche` para la reparación.

const C = '#16111f';
const BLANCO = '#e8eeff', SOMBRA = '#c9cdda', METAL = '#b8bccb', METAL_OSCURO = '#5b6075', OSCURO = '#2a2f45';
const NARANJA = '#ff8a3d', PLASMA = '#ffb347', CREMA = '#fff4d6', ADA = '#5ee0ff', VISOR = '#1d2b4f';

const svg = (cuerpo: string) =>
  `<svg class="icono" viewBox="0 0 64 64" aria-hidden="true"><g stroke="${C}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${cuerpo}</g></svg>`;

/** Trazo grueso con contorno: primero la línea oscura, encima la de color. */
const linea = (d: string, color: string, ancho = 5) =>
  `<path d="${d}" fill="none" stroke-width="${ancho + 4}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${ancho}"/>`;

/** Brillo blanco sin contorno (el reflejo de los modelos). */
const brillo = (cx: number, cy: number, rx: number, ry: number, giro = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${giro} ${cx} ${cy})" fill="#fff" opacity=".75" stroke="none"/>`;

/** Arco de radio `r` alrededor de (cx, cy) entre dos ángulos en grados (0 = derecha, y hacia abajo). */
function arco(cx: number, cy: number, r: number, desde: number, hasta: number) {
  const p = (a: number) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`;
  return `M${p(desde)} A${r} ${r} 0 ${Math.abs(hasta - desde) > 180 ? 1 : 0} 1 ${p(hasta)}`;
}

/** Estrella de `puntas` puntas (contorno de un estallido o de un destello). */
function estrella(cx: number, cy: number, fuera: number, dentro: number, puntas: number, giro = -90) {
  const pts: string[] = [];
  for (let k = 0; k < puntas * 2; k++) {
    const a = ((giro + (k * 180) / puntas) * Math.PI) / 180, r = k % 2 ? dentro : fuera;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Orbe de ADA: carcasa oscura, núcleo cian y brillo. */
const orbe = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${OSCURO}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.68}" fill="${ADA}" stroke="none"/>` +
  brillo(cx - r * 0.25, cy - r * 0.28, r * 0.24, r * 0.16, -30);

/** Destello de cuatro puntas, sin contorno. */
const destello = (cx: number, cy: number, r: number, color = '#fff') =>
  `<path d="${estrella(cx, cy, r, r * 0.3, 4)}" fill="${color}" stroke="none"/>`;

/** Bota del traje mirando a la derecha, con puño y suela del color dado. */
const bota = (puno: string, suela: string) =>
  `<path d="M26 10 H41 V33 Q57 34 57 45 V49 H23 V37 Q23 33 26 31 Z" fill="${BLANCO}"/>` +
  `<path d="M26 31 Q40 33 41 33 Q55 35 56 42 L24 42 Z" fill="${SOMBRA}" stroke="none"/>` +
  `<rect x="21" y="44" width="38" height="9" rx="4.5" fill="${suela}"/>` +
  `<rect x="23" y="7" width="20" height="8" rx="4" fill="${puno}"/>` + brillo(30, 20, 2, 6);

export const ICONOS: Record<string, string> = {
  // ------------------------------------------------------- herramientas

  /** Cortador de plasma: el taladro de muestreo, con la llama en la punta. */
  cortador: svg(
    `<g transform="rotate(-40 32 32) translate(32 32) scale(1.12) translate(-32 -32)">` +
    `<rect x="9" y="37" width="12" height="18" rx="4" fill="${OSCURO}"/>` +
    `<path d="M40 22 Q56 18 64 32 Q56 46 40 42 Z" fill="${PLASMA}"/>` +
    `<path d="M41 27 Q53 25 58 32 Q53 39 41 37 Z" fill="${CREMA}" stroke="none"/>` +
    `<path d="M33 24 L43 26 L43 38 L33 40 Z" fill="${METAL_OSCURO}"/>` +
    `<rect x="3" y="22" width="33" height="20" rx="8" fill="${BLANCO}"/>` +
    `<path d="M5 34 H34 V35 Q34 40 28 40 H11 Q5 40 5 35 Z" fill="${SOMBRA}" stroke="none"/>` +
    `<rect x="18" y="21" width="7" height="22" rx="2.5" fill="${NARANJA}"/>` + brillo(10, 27, 4, 1.6) +
    `<circle cx="29.5" cy="28" r="2.4" fill="${ADA}" stroke-width="2"/>` +
    `</g>` + destello(55, 6, 5, CREMA) + destello(61, 19, 3.2, CREMA) + destello(44, 4, 2.6, CREMA),
  ),

  /** Pulso EMP de ADA: el núcleo descarga y la onda sale en arcos. */
  pulso: svg(
    linea(arco(32, 32, 26, -80, -20), ADA, 4.5) + linea(arco(32, 32, 26, 40, 100), ADA, 4.5) + linea(arco(32, 32, 26, 160, 220), ADA, 4.5) +
    linea('M9 22 L15 24 L12 28 L19 30', '#b8f4ff', 2.5) + linea('M55 42 L49 40 L52 36 L45 34', '#b8f4ff', 2.5) +
    orbe(32, 32, 14),
  ),

  /** Dron de mantenimiento: un inspector de turbina con un ojo y su hélice. */
  dron: svg(
    `<ellipse cx="32" cy="42" rx="28" ry="10" fill="none" stroke="#c9f27a" stroke-width="3" stroke-dasharray="7 6"/>` +
    `<rect x="9" y="31" width="8" height="10" rx="3" fill="${METAL_OSCURO}"/><rect x="47" y="31" width="8" height="10" rx="3" fill="${METAL_OSCURO}"/>` +
    `<rect x="29" y="11" width="6" height="11" rx="2" fill="${METAL_OSCURO}"/>` +
    `<ellipse cx="32" cy="11" rx="19" ry="5" fill="#c9f27a"/>` +
    `<circle cx="32" cy="36" r="15" fill="${BLANCO}"/>` +
    `<path d="M17.5 40 A15 15 0 0 0 46.5 40 Z" fill="${SOMBRA}" stroke="none"/>` +
    `<path d="M17.9 31 H46.1 L46.9 35 H17.1 Z" fill="#c9f27a" stroke="none"/>` +
    `<circle cx="32" cy="36" r="15" fill="none"/>` +
    `<circle cx="32" cy="35" r="7" fill="${VISOR}"/><circle cx="32" cy="35" r="3.6" fill="${ADA}" stroke="none"/>` + brillo(29.5, 32.5, 1.6, 1.2),
  ),

  /** Campo de interferencia: una antena que suelta ondas y estática. */
  interferencia: svg(
    linea(arco(32, 42, 11, -145, -35), '#d07bff', 4) + linea(arco(32, 42, 20, -145, -35), '#d07bff', 4) +
    linea('M14 15 L19 9 L24 15 L29 9 L34 15 L39 9 L44 15 L49 9', '#e9c8ff', 3) +
    `<path d="M22 60 L28 46 H36 L42 60 Z" fill="#474a5e"/>` +
    `<path d="M25.5 54 H38.5" fill="none" stroke-width="2.5"/>` +
    `<rect x="30" y="38" width="4" height="10" rx="1.5" fill="${METAL_OSCURO}"/>` +
    `<circle cx="32" cy="38" r="6" fill="#d07bff"/>` + brillo(30, 36, 2, 1.4, -30),
  ),

  // ------------------------------------------------------------ pasivas

  /** Servos de pierna: la bota del traje con un servo y rayas de velocidad. */
  velocidad: svg(
    linea('M4 24 H14', '#9fb4ff', 3) + linea('M2 33 H13', '#9fb4ff', 3) + linea('M5 42 H15', '#9fb4ff', 3) +
    bota(NARANJA, NARANJA) +
    `<circle cx="33" cy="27" r="6.5" fill="${METAL_OSCURO}"/><circle cx="33" cy="27" r="2.6" fill="#9fb4ff" stroke="none"/>`,
  ),

  /** Electroimán: un imán de herradura que atrae tuercas de chatarra. */
  iman: svg(
    `<g transform="rotate(-35 30 34)">` +
    linea('M17 50 V30 A13 13 0 0 1 43 30 V50', '#ff4a3a', 11) +
    linea('M17 46 V52', BLANCO, 11) + linea('M43 46 V52', BLANCO, 11) +
    `<path d="M19 26 A11 11 0 0 1 27 19" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7"/>` +
    `</g>` +
    `<path d="M52 44 l5 3 v6 l-5 3 l-5 -3 v-6 Z" fill="${METAL}"/><circle cx="52" cy="50" r="1.8" fill="${C}" stroke="none"/>` +
    `<rect x="40" y="54" width="9" height="5" rx="2" fill="${METAL}" transform="rotate(25 44 56)"/>` +
    linea('M46 40 L49 44 L46 46 L50 50', ADA, 2),
  ),

  /** Placas de blindaje: un escudo de chapa con remaches y borde naranja. */
  blindaje: svg(
    `<path d="M32 5 L55 13 V31 Q55 50 32 60 Q9 50 9 31 V13 Z" fill="${NARANJA}"/>` +
    `<path d="M32 12 L48 17.5 V31 Q48 45 32 52.5 Q16 45 16 31 V17.5 Z" fill="#8f9bc2"/>` +
    `<path d="M32 12 L48 17.5 V31 Q48 45 32 52.5 Z" fill="#76829f" stroke="none"/>` +
    `<path d="M32 12 L48 17.5 V31 Q48 45 32 52.5 Q16 45 16 31 V17.5 Z" fill="none"/>` +
    [[22, 21], [42, 21], [22, 38], [42, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3" fill="${METAL}" stroke-width="2"/>`).join('') +
    brillo(23, 28, 2.2, 7, 8),
  ),

  /** Disipador térmico: aletas de metal y un copo de frío. */
  enfriamiento: svg(
    [12, 20.5, 29, 37.5].map((x) => `<rect x="${x}" y="20" width="6" height="26" rx="2" fill="${METAL}"/>`).join('') +
    `<rect x="9" y="42" width="40" height="12" rx="3.5" fill="${METAL_OSCURO}"/>` +
    [12, 20.5, 29, 37.5].map((x) => brillo(x + 2.2, 28, 1, 5)).join('') +
    `<g>${linea('M50 4 V26 M40.5 9.5 L59.5 20.5 M40.5 20.5 L59.5 9.5', ADA, 3.5)}</g>` +
    `<circle cx="50" cy="15" r="3.4" fill="#fff"/>`,
  ),

  /** Amplificador de ADA: el núcleo con cuatro flechas que empujan hacia fuera. */
  area: svg(
    linea('M25 12 L32 5 L39 12', '#9fb4ff', 4) + linea('M25 52 L32 59 L39 52', '#9fb4ff', 4) +
    linea('M12 25 L5 32 L12 39', '#9fb4ff', 4) + linea('M52 25 L59 32 L52 39', '#9fb4ff', 4) +
    `<circle cx="32" cy="32" r="18" fill="none" stroke="#9fb4ff" stroke-width="2.5" stroke-dasharray="4 5"/>` +
    orbe(32, 32, 13),
  ),

  /** Nanosellador: un tubo de sellante verde y una cruz de reparar. */
  reparacion: svg(
    `<g transform="rotate(-35 34 30)">` +
    `<path d="M44 26 L53 29 V35 L44 38 Z" fill="${METAL}"/>` +
    `<rect x="14" y="22" width="32" height="20" rx="6" fill="${BLANCO}"/>` +
    `<path d="M16 34 H44 V36 Q44 40 40 40 H20 Q16 40 16 36 Z" fill="${SOMBRA}" stroke="none"/>` +
    `<rect x="9" y="24" width="9" height="16" rx="3" fill="#4ed58f"/>` +
    `<rect x="26" y="21" width="6" height="22" rx="2" fill="#4ed58f"/>` +
    `<circle cx="58" cy="32" r="4.5" fill="#7ef0a0"/>` + brillo(22, 27, 3.5, 1.4) +
    `</g>` +
    `<circle cx="16" cy="48" r="11" fill="#4ed58f"/>` +
    `<path d="M16 42 V54 M10 48 H22" fill="none" stroke="#fff" stroke-width="4"/>` + destello(53, 9, 5),
  ),

  // ------------------------------------------------------------- equipo

  /** Mochila cohete: dos depósitos de plasma con ADA en medio y sus llamas. */
  mochila: svg(
    `<path d="M14 49 Q19 64 24 49 Z" fill="${PLASMA}"/><path d="M40 49 Q45 64 50 49 Z" fill="${PLASMA}"/>` +
    `<path d="M16.5 49 Q19 57 21.5 49 Z" fill="${CREMA}" stroke="none"/><path d="M42.5 49 Q45 57 47.5 49 Z" fill="${CREMA}" stroke="none"/>` +
    `<path d="M14 43 H24 L22 50 H16 Z" fill="${METAL_OSCURO}"/><path d="M40 43 H50 L48 50 H42 Z" fill="${METAL_OSCURO}"/>` +
    `<rect x="10" y="8" width="18" height="38" rx="9" fill="${NARANJA}"/><rect x="36" y="8" width="18" height="38" rx="9" fill="${NARANJA}"/>` +
    `<rect x="24" y="14" width="16" height="28" rx="5" fill="${BLANCO}"/>` +
    orbe(32, 26, 6.5) + brillo(15, 18, 2, 6) + brillo(41, 18, 2, 6),
  ),

  /** Aerotabla: una tabla de chatarra que flota sobre plasma. */
  tabla: svg(
    linea('M3 22 H14', ADA, 3) + linea('M2 31 H10', ADA, 3) +
    `<g transform="rotate(-10 32 34)">` +
    `<ellipse cx="20" cy="47" rx="8" ry="3.5" fill="${ADA}" stroke="none" opacity=".9"/><ellipse cx="46" cy="47" rx="8" ry="3.5" fill="${ADA}" stroke="none" opacity=".9"/>` +
    linea('M17 50 V58', '#b8f4ff', 2.5) + linea('M23 50 V56', '#b8f4ff', 2.5) + linea('M43 50 V56', '#b8f4ff', 2.5) + linea('M49 50 V58', '#b8f4ff', 2.5) +
    `<rect x="15" y="40" width="10" height="7" rx="2" fill="${METAL_OSCURO}"/><rect x="41" y="40" width="10" height="7" rx="2" fill="${METAL_OSCURO}"/>` +
    // Canto naranja y, encima, la cubierta vista un poco desde arriba.
    `<path d="M5 34 Q5 44 16 44 H50 Q61 44 61 34 Z" fill="${NARANJA}"/>` +
    `<path d="M5 33 Q5 22 16 22 H50 Q61 22 61 33 Q61 39 50 39 H16 Q5 39 5 33 Z" fill="${BLANCO}"/>` +
    `<path d="M24 23 H31 L29 38.5 H22 Z" fill="${ADA}" stroke="none" opacity=".85"/>` +
    `<path d="M5 33 Q5 22 16 22 H50 Q61 22 61 33 Q61 39 50 39 H16 Q5 39 5 33 Z" fill="none"/>` +
    brillo(44, 27, 9, 1.8) + `</g>`,
  ),

  /** Botas de impulso: la bota con un chorro de plasma en el talón. */
  botas: svg(
    `<path d="M24 41 Q8 40 2 47 Q8 54 24 53 Z" fill="#ffd25a"/><path d="M24 44 Q13 44 9 47 Q13 50 24 50 Z" fill="${CREMA}" stroke="none"/>` +
    bota('#ffd25a', OSCURO) + destello(56, 12, 5, '#ffd25a'),
  ),

  // ---------------------------------------------------------- especiales

  /** Nova de plasma: un estallido de plasma con el corazón blanco. */
  'nova-plasma': svg(
    `<path d="${estrella(32, 32, 29, 14, 8)}" fill="${PLASMA}"/>` +
    `<path d="${estrella(32, 32, 19, 9, 8, -67.5)}" fill="#ffe2a8" stroke="none"/>` +
    `<circle cx="32" cy="32" r="7" fill="#fff" stroke="none"/>`,
  ),

  /** Pulso de ADA: el núcleo empuja con ondas hacia un lado. */
  'pulso-ada': svg(
    linea(arco(20, 32, 17, -50, 50), ADA, 4) + linea(arco(20, 32, 26, -45, 45), ADA, 4) + linea(arco(20, 32, 35, -40, 40), '#b8f4ff', 4) +
    orbe(20, 32, 12),
  ),

  /** Enjambre reparador: un dron de chatarra con su cruz y dos pequeños. */
  enjambre: svg(
    `<circle cx="51" cy="14" r="6" fill="${BLANCO}"/><circle cx="51" cy="14" r="2.2" fill="${ADA}" stroke="none"/>` +
    `<circle cx="53" cy="48" r="6" fill="${BLANCO}"/><circle cx="53" cy="48" r="2.2" fill="${ADA}" stroke="none"/>` +
    `<ellipse cx="28" cy="16" rx="14" ry="4" fill="#7ef0a0"/><rect x="25.5" y="16" width="5" height="7" rx="2" fill="${METAL_OSCURO}"/>` +
    `<circle cx="28" cy="36" r="14" fill="${METAL}"/>` +
    `<path d="M14.6 40 A14 14 0 0 0 41.4 40 Z" fill="${METAL_OSCURO}" stroke="none" opacity=".45"/><circle cx="28" cy="36" r="14" fill="none"/>` +
    `<circle cx="28" cy="35" r="6.5" fill="${VISOR}"/><circle cx="28" cy="35" r="3.2" fill="${ADA}" stroke="none"/>` +
    `<circle cx="14" cy="52" r="9" fill="#4ed58f"/><path d="M14 47 V57 M9 52 H19" fill="none" stroke="#fff" stroke-width="3.5"/>`,
  ),

  /** Caparazón de chatarra: una cúpula de placas que para un golpe. */
  caparazon: svg(
    `<path d="M7 48 A25 25 0 0 1 57 48 Z" fill="#56e5ee" fill-opacity=".55"/>` +
    `<path d="M20 48 V36 L26 30 L34 30 L40 36 V48 M14 30 L20 36 M46 30 L40 36 M26 30 L24 21 M34 30 L37 21" fill="none" stroke-width="2.5"/>` +
    linea(arco(32, 48, 19, -160, -110), '#fff', 2.5) +
    `<rect x="4" y="46" width="56" height="10" rx="5" fill="${METAL_OSCURO}"/>` + brillo(14, 50, 4, 1.2),
  ),

  /** Sobremarcha: el indicador en rojo y un rayo. */
  sobremarcha: svg(
    linea(arco(32, 44, 24, 180, 235), '#4ed58f', 6) + linea(arco(32, 44, 24, 235, 300), '#ffd25a', 6) + linea(arco(32, 44, 24, 300, 360), '#ff4a3a', 6) +
    linea('M32 44 L49 28', C, 4) + `<circle cx="32" cy="44" r="5.5" fill="${METAL_OSCURO}"/>` +
    `<path d="M14 4 L6 18 H13 L9 30 L21 13 H14 L19 4 Z" fill="#ffd25a"/>`,
  ),

  /** Eco de HELIOS: el ojo rojo, con párpado de chapa y ecos púrpura. */
  'eco-helios': svg(
    linea(arco(32, 32, 27, 145, 215), '#c77dff', 3.5) + linea(arco(32, 32, 27, -35, 35), '#c77dff', 3.5) +
    `<path d="M13 32 Q32 13 51 32 Q32 51 13 32 Z" fill="#f1ecdc"/>` +
    `<circle cx="32" cy="33" r="9" fill="#ff4a3a"/><circle cx="32" cy="33" r="4" fill="${C}" stroke="none"/>` + brillo(29, 30, 2, 1.4) +
    `<path d="M12 28 Q32 8 52 22 L52 15 Q32 2 12 21 Z" fill="#474a5e"/>`,
  ),

  // -------------------------------------------------------------- otros

  /** Parche de emergencia: una tirita verde con la cruz. */
  parche: svg(
    `<g transform="rotate(-35 32 32)">` +
    `<rect x="4" y="21" width="56" height="22" rx="11" fill="#f1e3c8"/>` +
    `<rect x="21" y="21" width="22" height="22" fill="#7ef0a0"/><rect x="4" y="21" width="56" height="22" rx="11" fill="none"/>` +
    `<path d="M32 26 V38 M26 32 H38" fill="none" stroke="#fff" stroke-width="4"/>` +
    [11, 15, 49, 53].map((x) => `<circle cx="${x}" cy="32" r="1.3" fill="#c9b48e" stroke="none"/>`).join('') +
    `</g>`,
  ),

  /** Si el juego trae una mejora sin icono propio. */
  generico: svg(`<path d="${estrella(32, 33, 26, 12, 5)}" fill="#ffd25a"/>` + brillo(26, 24, 3, 1.6, -30)),
};

/** El icono de una mejora por su id (o el genérico). */
export function iconoMejora(id: string): string {
  return ICONOS[id] ?? ICONOS.generico;
}
