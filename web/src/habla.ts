// META SPACE — Texto que entra a la voz y audio que sale. Funciones puras: las
// usan el servidor (voces-servidor.ts) y los tests. La voz es Supertonic 2.

/** Más largo que esto, el modelo pierde el hilo: se trocea por pausas. */
export const MAX_TROZO = 240;
export const MAX_TEXTO_VOZ = 900;

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

/** Un número dicho en español. El modelo lee mal las cifras. */
export function numeroEnPalabras(n: number): string {
  if (n < 0 || n > 999_999 || !Number.isInteger(n)) return String(n);
  if (n < 30) return UNIDADES[n];
  if (n < 100) {
    const u = n % 10;
    return `${DECENAS[Math.floor(n / 10)]}${u ? ` y ${UNIDADES[u]}` : ''}`;
  }
  if (n === 100) return 'cien';
  if (n < 1000) {
    const r = n % 100;
    return `${CENTENAS[Math.floor(n / 100)]}${r ? ` ${numeroEnPalabras(r)}` : ''}`;
  }
  const miles = Math.floor(n / 1000);
  const r = n % 1000;
  return `${miles === 1 ? 'mil' : `${numeroEnPalabras(miles)} mil`}${r ? ` ${numeroEnPalabras(r)}` : ''}`;
}

/**
 * El modelo aprendió español con rasgos rioplatenses: a veces dice la ll y la y
 * casi como «sh». Escritas como i suenan neutras, y no cambia nada más.
 */
export function sinSheismo(texto: string): string {
  return texto.replace(/ll|y(?=[aeiouáéíóú])/gi, (m, i: number, t: string) => {
    if (m.length === 2 && !/[aeiouáéíóú]/i.test(t[i + 2] ?? '')) return m;
    return m[0] === m[0].toUpperCase() ? 'I' : 'i';
  });
}

/** Lo que se ve escrito pasa a lo que se dice: cifras, unidades y siglas. */
export function textoHablado(texto: string): string {
  return sinSheismo(texto)
    .replace(/(\d+)\s?%/g, '$1 por ciento')
    .replace(/(\d+)\s?m\b/g, '$1 metros')
    .replace(/\d+/g, (n) => numeroEnPalabras(Number(n)))
    .replace(/\bHELIOS\b/g, 'Helios')
    .replace(/\bADA\b/g, 'Ada');
}

/** Normaliza como el texto con el que se entrenó el modelo y marca el idioma. */
export function textoParaModelo(texto: string): string {
  let t = textoHablado(texto)
    .normalize('NFKD')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[–‑—]/g, '-')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’´`]/g, "'")
    .replace(/[_[\]|/#→←\\]/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (t && !/[.!?;:,'")\]}…]$/.test(t)) t += '.';
  return `<es>${t}</es>`;
}

/** Trozos que el modelo dice bien: corta por frases, luego por pausas y por palabras. */
export function trocear(texto: string, max = MAX_TROZO): string[] {
  const trozos: string[] = [];
  for (const frase of texto.match(/[^.!?…]+[.!?…]*["»”)]*\s*/g) ?? []) {
    let resto = frase.trim();
    while (resto.length > max) {
      const ventana = resto.slice(0, max);
      const pausa = Math.max(ventana.lastIndexOf(', '), ventana.lastIndexOf('; '), ventana.lastIndexOf(': '));
      const corte = pausa > max / 2 ? pausa + 1 : ventana.lastIndexOf(' ') > 0 ? ventana.lastIndexOf(' ') : max;
      trozos.push(resto.slice(0, corte).trim());
      resto = resto.slice(corte).trim();
    }
    if (resto) trozos.push(resto);
  }
  return trozos;
}

/** Une los trozos con un silencio breve y deja el audio con un volumen parejo. */
export function unirAudio(trozos: readonly Float32Array[], frecuencia: number, silencio = 0.18): Float32Array {
  const hueco = Math.floor(silencio * frecuencia);
  const total = trozos.reduce((s, t) => s + t.length, 0) + hueco * Math.max(0, trozos.length - 1);
  const salida = new Float32Array(total);
  let i = 0;
  for (const t of trozos) {
    salida.set(t, i);
    i += t.length + hueco;
  }
  let pico = 0;
  for (let k = 0; k < total; k++) pico = Math.max(pico, Math.abs(salida[k]));
  if (pico > 0) {
    const factor = Math.min(3, 0.89 / pico);
    for (let k = 0; k < total; k++) salida[k] *= factor;
  }
  return salida;
}

/** WAV mono de 16 bits, lo que entiende cualquier navegador sin nada más. */
export function wavDe(muestras: Float32Array, frecuencia: number): Uint8Array {
  const datos = muestras.length * 2;
  const wav = new DataView(new ArrayBuffer(44 + datos));
  const texto = (o: number, s: string) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  texto(0, 'RIFF');
  wav.setUint32(4, 36 + datos, true);
  texto(8, 'WAVEfmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, frecuencia, true);
  wav.setUint32(28, frecuencia * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  texto(36, 'data');
  wav.setUint32(40, datos, true);
  for (let i = 0; i < muestras.length; i++) {
    const v = Math.max(-1, Math.min(1, muestras[i]));
    wav.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Uint8Array(wav.buffer);
}
