// META SPACE · FOCO 3 — Creador de personaje (UI + lógica).
//
// Dos modos que terminan en lo mismo:
//   PNG 128×128 con fondo recortado + JSON {hp, speed, damage, fire_rate, special, lore}
//
//   const heroe = await openCharacterCreator(); // la IA se usa sola si hay servidor (ver ia.ts)
//   if (heroe) applyCustomHero(game, heroe); // ver player-contract.ts
//
// Todo el texto visible va en español. Los estilos viven en
// `character-creator.css` (se importa desde el `index.html` de la demo y
// desde el proyecto real).

import {
  REGLA_STATS,
  SPECIALS,
  analyzePixels,
  statsFromDrawing,
  statsFromPrompt,
} from './stats';
import type { DrawingFeatures, HeroStats } from './stats';
import {
  PALETA_SPRITE,
  generarSpriteProcedural,
  lienzoAPng,
  opcionesDesdePrompt,
  quitarFondo,
} from './sprite';
import { PRESETS, presetALienzo } from './presets';
import { iaDisponible, postIa } from '../ia';

export type OrigenHeroe = 'dibujo' | 'imagen' | 'predefinido';

export interface CreatorResult {
  nombre: string;
  pngDataUrl: string;
  stats: HeroStats;
  source: OrigenHeroe;
  prompt?: string;
  presetId?: string;
}

export interface CreatorOptions {
  nombreInicial?: string;
  onConfirm?: (r: CreatorResult) => void;
  onCancel?: () => void;
}

type Pestaña = 'dibujar' | 'imagen' | 'galeria';

const COLORES_PALETA = ['K', 'W', 'O', 'C', 'R', 'G', 'P', 'Y', 'D', 'B', 'N', 'M'];

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function barra(valor: number, min: number, max: number): string {
  const pct = Math.round(((valor - min) / (max - min)) * 100);
  return `<div class="cc-bar"><i style="width:${pct}%"></i></div>`;
}

function panelStats(stats: HeroStats): string {
  const sp = SPECIALS[stats.special];
  return `
    <div class="cc-prev"><img alt="Vista previa del héroe" /></div>
    <dl class="cc-nums">
      <div><dt>Vida</dt><dd><b>${stats.hp}</b>${barra(stats.hp, 70, 150)}</dd></div>
      <div><dt>Ataque</dt><dd><b>×${stats.damage.toFixed(2)}</b>${barra(stats.damage, 0.85, 1.35)}</dd></div>
      <div><dt>Velocidad</dt><dd><b>${stats.speed.toFixed(2)}</b>${barra(stats.speed, 4.2, 6.5)}</dd></div>
      <div><dt>Cadencia</dt><dd><b>×${stats.fire_rate.toFixed(2)}</b>${barra(1.15 - (stats.fire_rate - 0.85), 0.85, 1.15)}</dd></div>
    </dl>
    <div class="cc-special"><small>ESPECIAL</small><b>${esc(sp.name)}</b><p>${esc(sp.blurb)}</p></div>
    <p class="cc-lore">«${esc(stats.lore)}»</p>
    <p class="cc-ada"></p>`;
}

/**
 * Abre el creador como overlay y resuelve con el héroe elegido,
 * o `null` si el jugador cancela (botón o tecla Esc).
 */
export function openCharacterCreator(opciones: CreatorOptions = {}): Promise<CreatorResult | null> {
  return new Promise((resolve) => {
    let cerrado = false;
    const cerrar = (r: CreatorResult | null) => {
      if (cerrado) return;
      cerrado = true;
      overlay.remove();
      window.removeEventListener('keydown', enTecla);
      if (r) opciones.onConfirm?.(r);
      else opciones.onCancel?.();
      resolve(r);
    };
    const enTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(null);
    };

    // ------------------------------------------------ estado interno
    let pestaña: Pestaña = 'dibujar';
    let color = '#ff9a3c';
    let grosor = 2;
    let goma = false;
    let espejo = true;
    const historial: ImageData[] = [];
    let dibujoValido = false;
    let imagenPng: string | null = null;
    let imagenStats: HeroStats | null = null;
    let imagenOrigen = '';
    let imagenPrompt = '';
    let presetElegido = 0;
    let opinionId = 0;

    // ------------------------------------------------ estructura
    const overlay = el(`
      <div class="cc-overlay" role="dialog" aria-label="Creador de personaje">
        <div class="cc-caja">
          <header class="cc-cabecera">
            <div class="cc-eyebrow">ARES-IX · ANTES DE DESPEGAR</div>
            <h2>Creador de personaje</h2>
            <p>Dibuja tu astronauta (o tu bicho) o descríbelo y deja que la IA lo imagine.
               ADA convertirá el resultado en stats para la partida.</p>
          </header>
          <nav class="cc-pestanas">
            <button data-tab="dibujar" class="on">✏️ Dibujar</button>
            <button data-tab="imagen">✨ Imagen</button>
            <button data-tab="galeria">🛰️ Galería</button>
          </nav>
          <div class="cc-cuerpo">
            <div class="cc-principal">
              <section data-panel="dibujar">
                <div class="cc-lienzo-fondo"><canvas class="cc-lienzo" width="128" height="128"></canvas></div>
                <div class="cc-herramientas">
                  <div class="cc-fila">
                    <span class="cc-etiqueta">Color</span>
                    <div class="cc-paleta"></div>
                  </div>
                  <div class="cc-fila">
                    <span class="cc-etiqueta">Trazo</span>
                    <div class="cc-grosores">
                      <button data-g="1">Fino</button>
                      <button data-g="2" class="on">Normal</button>
                      <button data-g="4">Grueso</button>
                    </div>
                    <button class="cc-goma">Goma</button>
                    <button class="cc-espejo on">Espejo</button>
                  </div>
                  <div class="cc-fila">
                    <button class="cc-deshacer">↩ Deshacer</button>
                    <button class="cc-limpiar">🧹 Limpiar</button>
                    <button class="cc-fondo">✂ Quitar fondo</button>
                  </div>
                </div>
              </section>
              <section data-panel="imagen" hidden>
                <label class="cc-etiqueta" for="cc-prompt">Describe a tu héroe</label>
                <textarea id="cc-prompt" class="cc-prompt" rows="3" maxlength="280"
                  placeholder="Ej.: bicho verde de chatarra con ojos cyan y caparazón rojo"></textarea>
                <div class="cc-fila">
                  <button class="cc-generar">✨ Generar sprite</button>
                  <span class="cc-estado"></span>
                </div>
                <div class="cc-imagen-fondo"><img class="cc-imagen" alt="Sprite generado" hidden /></div>
                <p class="cc-origen"></p>
              </section>
              <section data-panel="galeria" hidden>
                <div class="cc-galeria"></div>
              </section>
            </div>
            <aside class="cc-lateral">
              <h3>Tu héroe</h3>
              <div class="cc-stats"></div>
              <p class="cc-regla"><b>Cómo se calculan tus stats:</b> ${esc(REGLA_STATS)}</p>
            </aside>
          </div>
          <footer class="cc-pie">
            <label>Nombre <input class="cc-nombre" maxlength="24" value="${esc(opciones.nombreInicial ?? 'Novato')}" /></label>
            <div class="cc-acciones">
              <button class="cc-cancelar">Atrás</button>
              <button class="cc-confirmar" disabled>¡A jugar!</button>
            </div>
          </footer>
        </div>
      </div>`);
    document.body.appendChild(overlay);
    window.addEventListener('keydown', enTecla);

    const q = <T extends Element = HTMLElement>(sel: string): T => overlay.querySelector(sel) as T;
    const lienzo = q<HTMLCanvasElement>('.cc-lienzo');
    const ctx = lienzo.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const statsCaja = q('.cc-stats');
    const btnConfirmar = q<HTMLButtonElement>('.cc-confirmar');
    const entradaNombre = q<HTMLInputElement>('.cc-nombre');

    // ------------------------------------------------ pestañas
    const botonesTab = [...overlay.querySelectorAll<HTMLButtonElement>('.cc-pestanas button')];
    const paneles = [...overlay.querySelectorAll<HTMLElement>('[data-panel]')];
    const mostrarTab = (t: Pestaña) => {
      pestaña = t;
      botonesTab.forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
      paneles.forEach((p) => {
        p.hidden = p.dataset.panel !== t;
      });
      refrescarConfirmar();
      if (t === 'dibujar') actualizarStatsDibujo();
      if (t === 'imagen') actualizarStatsImagen();
      if (t === 'galeria') actualizarStatsGaleria();
    };
    botonesTab.forEach((b) => b.addEventListener('click', () => mostrarTab(b.dataset.tab as Pestaña)));

    // ------------------------------------------------ MODO DIBUJAR
    const paletaCaja = q('.cc-paleta');
    for (const clave of COLORES_PALETA) {
      const b = el(`<button class="cc-color" title="${PALETA_SPRITE[clave]}" style="--c:${PALETA_SPRITE[clave]}"></button>`);
      if (PALETA_SPRITE[clave] === color) b.classList.add('on');
      b.addEventListener('click', () => {
        color = PALETA_SPRITE[clave];
        goma = false;
        q('.cc-goma').classList.remove('on');
        paletaCaja.querySelectorAll('.cc-color').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      });
      paletaCaja.appendChild(b);
    }
    overlay.querySelectorAll<HTMLButtonElement>('.cc-grosores button').forEach((b) => {
      b.addEventListener('click', () => {
        grosor = Number(b.dataset.g);
        overlay.querySelectorAll('.cc-grosores button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      });
    });
    q('.cc-goma').addEventListener('click', (e) => {
      goma = !goma;
      (e.currentTarget as HTMLElement).classList.toggle('on', goma);
    });
    q('.cc-espejo').addEventListener('click', (e) => {
      espejo = !espejo;
      (e.currentTarget as HTMLElement).classList.toggle('on', espejo);
    });
    q('.cc-deshacer').addEventListener('click', () => {
      const anterior = historial.pop();
      if (anterior) {
        ctx.putImageData(anterior, 0, 0);
        actualizarStatsDibujo();
      }
    });
    q('.cc-limpiar').addEventListener('click', () => {
      guardarHistorial();
      ctx.clearRect(0, 0, 128, 128);
      actualizarStatsDibujo();
    });
    q('.cc-fondo').addEventListener('click', () => {
      guardarHistorial();
      const n = quitarFondo(lienzo);
      q('.cc-estado-dibujo')?.remove();
      const aviso = el(`<p class="cc-estado-dibujo">${n > 0 ? `Fondo recortado: ${n.toLocaleString('es-ES')} píxeles fuera.` : 'El fondo ya era transparente.'}</p>`);
      q('[data-panel="dibujar"]').appendChild(aviso);
      actualizarStatsDibujo();
    });

    const guardarHistorial = () => {
      historial.push(ctx.getImageData(0, 0, 128, 128));
      if (historial.length > 25) historial.shift();
    };

    let pintando = false;
    const pintarEn = (e: PointerEvent) => {
      const r = lienzo.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * 128);
      const y = Math.floor(((e.clientY - r.top) / r.height) * 128);
      ctx.fillStyle = goma ? 'rgba(0,0,0,0)' : color;
      const mitad = Math.floor(grosor / 2);
      for (let dy = 0; dy < grosor; dy++) {
        for (let dx = 0; dx < grosor; dx++) {
          const px = x - mitad + dx;
          const py = y - mitad + dy;
          if (goma) ctx.clearRect(px, py, 1, 1);
          else ctx.fillRect(px, py, 1, 1);
          if (espejo) {
            const mx = 127 - px;
            if (goma) ctx.clearRect(mx, py, 1, 1);
            else if (!goma) ctx.fillRect(mx, py, 1, 1);
          }
        }
      }
    };
    lienzo.addEventListener('pointerdown', (e) => {
      guardarHistorial();
      pintando = true;
      lienzo.setPointerCapture(e.pointerId);
      pintarEn(e);
    });
    lienzo.addEventListener('pointermove', (e) => {
      if (pintando) pintarEn(e);
    });
    const terminarTrazo = () => {
      if (!pintando) return;
      pintando = false;
      actualizarStatsDibujo();
    };
    lienzo.addEventListener('pointerup', terminarTrazo);
    lienzo.addEventListener('pointercancel', terminarTrazo);

    let rasgosDibujo: DrawingFeatures | null = null;
    let statsDibujo: HeroStats | null = null;
    const actualizarStatsDibujo = () => {
      const datos = ctx.getImageData(0, 0, 128, 128).data;
      rasgosDibujo = analyzePixels(datos);
      dibujoValido = rasgosDibujo.pixels > 0;
      statsDibujo = dibujoValido ? statsFromDrawing(rasgosDibujo) : null;
      if (pestaña === 'dibujar') {
        if (statsDibujo) {
          statsCaja.innerHTML = panelStats(statsDibujo);
          const img = statsCaja.querySelector('img')!;
          img.src = lienzo.toDataURL('image/png');
          pedirOpinionAda();
        } else {
          statsCaja.innerHTML = '<p class="cc-vacio">Dibuja algo en el lienzo y ADA calculará tus stats aquí.</p>';
        }
      }
      refrescarConfirmar();
    };

    /** Usa `POST /api/analyze-drawing` (visión de Muse Spark) sin bloquear. */
    const pedirOpinionAda = () => {
      const cajaAda = statsCaja.querySelector('.cc-ada');
      if (!cajaAda || !dibujoValido) return;
      const id = ++opinionId;
      let png = '';
      try {
        png = lienzo.toDataURL('image/png');
      } catch {
        return;
      }
      void iaDisponible().then(async (hay) => {
        if (!hay || id !== opinionId) return;
        cajaAda.textContent = 'ADA está mirando tu dibujo…';
        const r = await postIa<{ opinion?: string }>('/api/analyze-drawing', { pngDataUrl: png }, 20000);
        if (id !== opinionId) return;
        const caja = statsCaja.querySelector('.cc-ada');
        if (caja) caja.textContent = r?.opinion ? `ADA dice: ${r.opinion}` : '';
      });
    };

    // ------------------------------------------------ MODO IMAGEN
    const entradaPrompt = q<HTMLTextAreaElement>('.cc-prompt');
    const imgResultado = q<HTMLImageElement>('.cc-imagen');
    const estadoImagen = q('.cc-estado');
    const origenTexto = q('.cc-origen');
    q('.cc-generar').addEventListener('click', async () => {
      const prompt = entradaPrompt.value.trim();
      if (!prompt) {
        estadoImagen.textContent = 'Escribe primero cómo es tu héroe.';
        return;
      }
      imagenPrompt = prompt;
      imagenStats = statsFromPrompt(prompt); // stats inmediatos: la regla del prompt es local
      estadoImagen.textContent = 'Generando sprite…';
      imgResultado.hidden = true;
      // 1) Intento con el servidor (Meta Image API si hay clave).
      const conIa = await iaDisponible();
      if (conIa) {
        const r = await postIa<{ ok: boolean; pngDataUrl?: string; source?: string }>(
          '/api/generate-image', { prompt }, 60000,
        );
        if (r?.ok && r.pngDataUrl) {
          imagenPng = r.pngDataUrl;
          imagenOrigen = r.source === 'meta-image' ? 'Imagen generada por la IA.' : 'Imagen del servidor local.';
          estadoImagen.textContent = '';
          imgResultado.src = imagenPng;
          imgResultado.hidden = false;
          origenTexto.textContent = imagenOrigen;
          actualizarStatsImagen();
          return;
        }
        // Si falla, cae al generador local: la demo nunca se queda colgada.
      }
      // 2) Respaldo local determinista (mismo prompt = mismo sprite).
      const lienzoLocal = generarSpriteProcedural(opcionesDesdePrompt(prompt));
      imagenPng = lienzoLocal.toDataURL('image/png');
      imagenOrigen = conIa
        ? 'Sin conexión con la IA: borrador local (prueba con la galería o reintenta).'
        : 'Borrador local (la IA no está conectada).';
      estadoImagen.textContent = '';
      imgResultado.src = imagenPng;
      imgResultado.hidden = false;
      origenTexto.textContent = imagenOrigen;
      actualizarStatsImagen();
    });

    const actualizarStatsImagen = () => {
      if (pestaña !== 'imagen') return;
      if (imagenPng && imagenStats) {
        statsCaja.innerHTML = panelStats(imagenStats);
        statsCaja.querySelector('img')!.src = imagenPng;
      } else {
        statsCaja.innerHTML = '<p class="cc-vacio">Describe a tu héroe y pulsa «Generar sprite».</p>';
      }
      refrescarConfirmar();
    };

    // ------------------------------------------------ GALERÍA
    const galeria = q('.cc-galeria');
    PRESETS.forEach((p, i) => {
      const tarjeta = el(`
        <button class="cc-tarjeta${i === 0 ? ' on' : ''}" data-i="${i}">
          <span class="cc-mini"></span>
          <b>${esc(p.nombre)}</b>
          <small>${esc(p.descripcion)}</small>
        </button>`);
      tarjeta.querySelector('.cc-mini')!.appendChild(presetALienzo(i));
      tarjeta.addEventListener('click', () => {
        presetElegido = i;
        galeria.querySelectorAll('.cc-tarjeta').forEach((x) => x.classList.remove('on'));
        tarjeta.classList.add('on');
        actualizarStatsGaleria();
      });
      galeria.appendChild(tarjeta);
    });

    const actualizarStatsGaleria = () => {
      if (pestaña !== 'galeria') return;
      const p = PRESETS[presetElegido];
      statsCaja.innerHTML = panelStats(p.stats);
      statsCaja.querySelector('img')!.src = presetALienzo(presetElegido).toDataURL('image/png');
      refrescarConfirmar();
    };

    // ------------------------------------------------ confirmar
    const refrescarConfirmar = () => {
      const listo =
        (pestaña === 'dibujar' && dibujoValido) ||
        (pestaña === 'imagen' && !!imagenPng) ||
        pestaña === 'galeria';
      btnConfirmar.disabled = !listo;
    };
    q('.cc-cancelar').addEventListener('click', () => cerrar(null));
    btnConfirmar.addEventListener('click', () => {
      const nombre = entradaNombre.value.trim() || 'Novato';
      try {
        if (pestaña === 'dibujar' && statsDibujo) {
          cerrar({ nombre, pngDataUrl: lienzoAPng(lienzo), stats: statsDibujo, source: 'dibujo' });
        } else if (pestaña === 'imagen' && imagenPng && imagenStats) {
          cerrar({ nombre, pngDataUrl: imagenPng, stats: imagenStats, source: 'imagen', prompt: imagenPrompt });
        } else if (pestaña === 'galeria') {
          const p = PRESETS[presetElegido];
          cerrar({
            nombre,
            pngDataUrl: presetALienzo(presetElegido).toDataURL('image/png'),
            stats: p.stats,
            source: 'predefinido',
            presetId: p.id,
          });
        }
      } catch (err) {
        estadoImagen.textContent = err instanceof Error ? err.message : 'No se pudo exportar el héroe.';
      }
    });

    actualizarStatsDibujo();
    mostrarTab('dibujar');
  });
}
