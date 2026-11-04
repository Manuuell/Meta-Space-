import { ENEMIES } from './data';
import { destinos, type Familia, type Planeta } from './planetas';

// El escáner orbital: antes de bajar, ADA enseña tres sectores de Meta y tú eliges.
// Cada uno es un mundo con su clima, su regla y su fauna, y todo eso se ve aquí
// para que elegir signifique algo. El globo se pinta píxel a píxel con los colores
// del bioma, así que cada destino se reconoce de un vistazo.

const CSS = `
.esc { position: fixed; inset: 0; z-index: 90; display: flex; flex-direction: column; gap: 14px; padding: 22px 26px; overflow: auto;
  background: radial-gradient(ellipse at 50% 120%, #1b2a55 0%, #0a0e24 55%, #05060f 100%); color: #f0f4ff; font-family: Rubik, system-ui, sans-serif; }
.esc__cab { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
.esc__cab small { display: block; font: 700 12px/1.2 ui-monospace, Menlo, monospace; letter-spacing: .22em; color: #5ee0ff; }
.esc__cab h2 { margin: 4px 0 0; font-size: clamp(22px, 3.2vw, 34px); font-weight: 900; }
.esc__botones { display: flex; gap: 8px; flex: none; }
.esc__bt { padding: 10px 16px; border: 1px solid #ffffff3d; border-radius: 10px; background: #ffffff12; color: #dfe6ff; font: 700 13px/1 Rubik, system-ui, sans-serif; cursor: pointer; }
.esc__bt:hover:not(:disabled) { background: #ffffff26; }
.esc__bt:disabled { opacity: .4; cursor: default; }
.esc__lista { flex: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
.esc__carta { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 16px; text-align: left; color: inherit; cursor: pointer; overflow: hidden;
  border: 2px solid #ffffff1f; border-radius: 16px; background: linear-gradient(180deg, #151c3acc, #0c1026e6); font: inherit; transition: transform .14s, border-color .14s; }
.esc__carta:hover, .esc__carta:focus-visible { transform: translateY(-3px); border-color: var(--c); outline: none; }
.esc__globo { display: block; width: min(170px, 62%); aspect-ratio: 1; margin: 2px auto 4px; filter: drop-shadow(0 0 22px var(--c)); }
.esc__num { position: absolute; left: 14px; top: 12px; font: 800 13px/1 ui-monospace, Menlo, monospace; color: #ffffff80; }
.esc__carta h3 { margin: 0; font-size: 22px; font-weight: 900; line-height: 1.1; }
.esc__bioma { margin: 0; font-weight: 700; color: var(--c); font-size: 14px; }
.esc__desc { margin: 0; font-size: 13.5px; line-height: 1.35; color: #c6cfe8; }
.esc__filas { margin: 2px 0 0; display: grid; gap: 7px; }
.esc__filas div { display: grid; gap: 1px; }
.esc__filas dt { font: 700 10.5px/1.2 ui-monospace, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: #8c98bd; }
.esc__filas dd { margin: 0; font-size: 13px; line-height: 1.3; }
.esc__filas b { font-weight: 800; }
.esc__medidas { margin-top: auto; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.esc__medida span { display: block; font: 700 10.5px/1.3 ui-monospace, Menlo, monospace; letter-spacing: .1em; color: #8c98bd; }
.esc__medida i { display: flex; gap: 3px; margin-top: 4px; }
.esc__medida u { flex: 1; height: 7px; border-radius: 2px; background: #ffffff1c; }
.esc__medida u.si { background: var(--t); }
@media (max-width: 900px) {
  .esc { padding: 16px; }
  .esc__lista { grid-template-columns: 1fr; }
  .esc__globo { width: 110px; }
  .esc__cab { flex-wrap: wrap; }
}
`;

const NOMBRE_FAMILIA: Record<Familia, string> = {
  fuego: 'fuego', hielo: 'hielo', veneno: 'veneno', rayo: 'electricidad', cristal: 'cristal', metal: 'metal', vida: 'vida', gravedad: 'gravedad',
};

function ruido(x: number, y: number) {
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** El sector visto desde órbita: suelo, lagos del fluido, cumbres y atmósfera. */
function pintarGlobo(lienzo: HTMLCanvasElement, p: Planeta) {
  const n = 170;
  lienzo.width = lienzo.height = n;
  const ctx = lienzo.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  const b = p.bioma, s = b.suelo;
  const suelo = rgb(s.arena), duna = rgb(s.duna), valle = rgb(s.valle), roca = rgb(s.rocaAlta), cumbre = rgb(s.cumbre), fluido = rgb(b.fluido.colores[1]), aire = rgb(b.cielo.horizonte);
  const R = n * 0.46, ox = (p.semilla % 97) * 1.3, oy = (p.semilla % 89) * 1.7;
  const hayLagos = p.relieve.lagos.length;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x - n / 2) / R, dy = (y - n / 2) / R, d2 = dx * dx + dy * dy, i = (y * n + x) * 4;
      if (d2 > 1) {
        // Halo de atmósfera.
        const a = Math.max(0, 1 - (Math.sqrt(d2) - 1) / 0.08);
        img.data.set([aire[0], aire[1], aire[2], a * a * 150], i);
        continue;
      }
      const z = Math.sqrt(1 - d2), u = dx * 3 / (z + 0.6) + ox, v = dy * 3 / (z + 0.6) + oy;
      const a = ruido(u, v) * 0.6 + ruido(u * 2.3, v * 2.3) * 0.3 + ruido(u * 5, v * 5) * 0.1;
      const c = a < 0.34 && hayLagos ? fluido : a < 0.46 ? valle : a < 0.6 ? suelo : a < 0.7 ? duna : a < 0.78 ? roca : cumbre;
      const luz = Math.max(0.12, dx * -0.55 + dy * -0.5 + z * 0.75 + 0.15);
      const borde = (1 - z) ** 3;
      img.data.set([0, 1, 2].map((k) => Math.min(255, c[k] * luz * (1 - borde * 0.6) + aire[k] * borde * 0.7)), i);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function medidor(nombre: string, valor: number, color: string) {
  const marcas = [1, 2, 3, 4, 5].map((k) => `<u class="${k <= valor ? 'si' : ''}"></u>`).join('');
  return `<div class="esc__medida" style="--t:${color}"><span>${nombre}</span><i>${marcas}</i></div>`;
}

function carta(p: Planeta, k: number) {
  const fauna = p.fauna.dominantes.slice(0, 3).map((id) => ENEMIES[id].name).join(', ');
  const fluido = p.bioma.fluido;
  return `<button type="button" class="esc__carta" style="--c:${p.bioma.cielo.horizonte}" data-i="${k}">
    <span class="esc__num">${k + 1}</span>
    <canvas class="esc__globo" aria-hidden="true"></canvas>
    <h3>${p.nombre}</h3>
    <p class="esc__bioma">${p.bioma.nombre}</p>
    <p class="esc__desc">${p.bioma.descripcion}</p>
    <dl class="esc__filas">
      <div><dt>Regla</dt><dd><b>${p.regla.nombre}.</b> ${p.regla.texto}</dd></div>
      <div><dt>Clima</dt><dd><b>${p.clima.nombre}.</b> ${p.clima.texto}</dd></div>
      <div><dt>Fauna · ${p.fauna.rasgo.nombre}</dt><dd>${fauna || 'Recolectores'}. ${p.fauna.rasgo.texto}</dd></div>
      <div><dt>Terreno</dt><dd>Lagos de ${fluido.nombre}${fluido.dano === 0 ? ' (sin peligro)' : ''}. ${p.reparto.mercader ? `Hay un mercader de paso, ${p.reparto.mercader.nombre}.` : 'Sin mercader.'}</dd></div>
      <div><dt>Objetos frecuentes</dt><dd>${p.afinidad.map((f) => NOMBRE_FAMILIA[f]).join(' y ')}</dd></div>
    </dl>
    <div class="esc__medidas">${medidor('Peligro', p.peligro, '#ff6a5a')}${medidor('Riqueza', p.riqueza, '#ffd25a')}</div>
  </button>`;
}

export interface OpcionesEscaner {
  semilla: number;
  elegir: (p: Planeta) => void;
  volver: () => void;
}

export function abrirEscaner(o: OpcionesEscaner) {
  if (!document.getElementById('esc-estilo')) {
    const s = document.createElement('style');
    s.id = 'esc-estilo';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const raiz = document.createElement('div');
  raiz.className = 'esc';
  raiz.innerHTML = `
    <header class="esc__cab">
      <div><small>ESCÁNER ORBITAL · ADA</small><h2>Elige dónde aterrizar</h2></div>
      <div class="esc__botones">
        <button type="button" class="esc__bt esc__otro">Escanear otros <kbd>R</kbd></button>
        <button type="button" class="esc__bt esc__volver">Volver <kbd>Esc</kbd></button>
      </div>
    </header>
    <div class="esc__lista"></div>`;
  document.body.appendChild(raiz);

  let semilla = o.semilla, repetidos = 0, lista: Planeta[] = [];
  const contenedor = raiz.querySelector<HTMLElement>('.esc__lista')!;
  const otro = raiz.querySelector<HTMLButtonElement>('.esc__otro')!;
  const pintar = () => {
    lista = destinos(semilla);
    contenedor.innerHTML = lista.map(carta).join('');
    contenedor.querySelectorAll('canvas').forEach((c, k) => pintarGlobo(c, lista[k]));
    otro.disabled = repetidos >= 2;
  };
  const cerrar = () => {
    window.removeEventListener('keydown', tecla, true);
    raiz.remove();
  };
  const elegir = (k: number) => {
    const p = lista[k];
    if (!p) return;
    cerrar();
    o.elegir(p);
  };
  const reescanear = () => {
    if (repetidos >= 2) return;
    repetidos++;
    semilla = (semilla * 31 + 7) >>> 0;
    pintar();
  };
  function tecla(e: KeyboardEvent) {
    if (e.code === 'Escape') {
      e.stopPropagation();
      cerrar();
      o.volver();
    } else if (e.code === 'KeyR') {
      reescanear();
    } else if (e.code === 'Enter') {
      elegir(0);
    } else if (/^Digit[123]$/.test(e.code)) {
      elegir(Number(e.code.slice(5)) - 1);
    }
  }
  contenedor.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.esc__carta');
    if (b) elegir(Number(b.dataset.i));
  });
  otro.addEventListener('click', reescanear);
  raiz.querySelector('.esc__volver')!.addEventListener('click', () => {
    cerrar();
    o.volver();
  });
  window.addEventListener('keydown', tecla, true);
  pintar();
}
