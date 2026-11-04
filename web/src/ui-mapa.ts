import './ui-mapa.css';
import { icono, puntoJugador, type TipoIcono } from './hud.ts';

// Mapa del sector (tecla M): la carta del terreno vista desde arriba, con el
// norte arriba, y todo lo que el jugador ya ha tenido cerca. A la derecha, la
// lista de lo descubierto. Se acerca con la rueda, pellizcando o con + y −,
// se arrastra para moverse, y un toque pone (o quita) hasta tres marcas que
// luego salen en el minimapa. La partida espera mientras está abierto.

export type TipoLugar = TipoIcono;

export interface LugarMapa {
  tipo: TipoLugar;
  x: number;
  z: number;
  hecho?: boolean;
  visto?: boolean;
  coste?: number;
}

export interface DatosMapa {
  jugador: { x: number; z: number; yaw: number };
  /** Carta del terreno (World.carta()): cubre de −mitad a +mitad. */
  carta?: { imagen: CanvasImageSource; mitad: number };
  /** Medio lado del sector jugable (m). */
  arena: number;
  lugares: LugarMapa[];
  nave?: { x: number; z: number };
  cohete: { x: number; z: number };
  zona: string;
  puntos: { x: number; z: number }[];
}

const MAX_PUNTOS = 3;

const NOMBRES: Record<TipoLugar, string> = {
  altar: 'Altar de HELIOS (sale un jefe)',
  pilon: 'Pilón de carga (bendición)',
  duelo: 'Altar de duelo (campeones)',
  dragon: 'Dragón del Velo (vuela)',
  caja: 'Cofre de HELIOS (de pago)',
  suelta: 'Caja abandonada (gratis… casi siempre)',
  ara: 'Ara del Sol (desafío)',
  torre: 'Torre del Velo',
  refugio: 'Refugio (cura)',
  npc: 'Gente del refugio',
  guardian: 'Guardián dormido (F: despiértalo)',
  fragua: 'Fragua del Deshielo (funde dos herramientas)',
  jaula: 'Jaula con un superviviente (F: libéralo)',
  iman: 'Imán de grúa (atrae toda la chatarra)',
  racion: 'Ración (cura al pasar)',
  fragmento: 'Resto de la flota (quédate al lado)',
};
const ORDEN: TipoLugar[] = ['fragmento', 'dragon', 'altar', 'duelo', 'guardian', 'fragua', 'jaula', 'pilon', 'caja', 'suelta', 'iman', 'ara', 'racion', 'torre', 'refugio', 'npc'];
/** Cómo se dice que ya está hecho, por tipo (si no, «hecho»). */
const HECHO: Partial<Record<TipoLugar, [string, string]>> = {
  torre: ['derribada', 'derribadas'], jaula: ['liberado', 'liberados'], iman: ['usado', 'usados'], racion: ['comida', 'comidas'],
  suelta: ['abierta', 'abiertas'], guardian: ['ya te ayudó', 'ya te ayudó'], fragua: ['fría', 'fría'],
};

function el<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/**
 * Abre el mapa. `cerrar` recibe las marcas que haya dejado el jugador. Devuelve
 * una función que lo cierra desde fuera (también llama a `cerrar`).
 */
export function abrirMapa(datos: DatosMapa, cerrar: (puntos: { x: number; z: number }[]) => void): () => void {
  // En el body, no en #ui: así queda por encima del micrófono y de la barra
  // del compañero, que cuelgan del body.
  const raiz = document.body;
  const puntos = datos.puntos.map((p) => ({ ...p }));

  const capa = el('div', 'mp');
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', 'Mapa del sector');
  const panel = el('div', 'mp-panel');
  capa.appendChild(panel);

  const cabecera = el('header', 'mp-cabecera');
  const volver = el('button', 'mp-volver');
  volver.type = 'button';
  volver.innerHTML = '<kbd>Esc</kbd> Volver';
  const titulo = el('h2', 'mp-titulo');
  titulo.append(el('b', '', 'Mapa del sector'), el('small', '', 'Arriba es el norte'));
  const zona = el('p', 'mp-zona', datos.zona);
  cabecera.append(volver, titulo, zona);
  panel.appendChild(cabecera);

  const cuerpo = el('div', 'mp-cuerpo');
  const marco = el('div', 'mp-marco');
  const lienzo = el('canvas', 'mp-lienzo');
  marco.appendChild(lienzo);
  for (const [letra, clase] of [['N', 'n'], ['S', 's'], ['E', 'e'], ['O', 'o']] as const) marco.appendChild(el('span', `mp-rosa ${clase}`, letra));
  const zoom = el('div', 'mp-zoom');
  const botones = (['+', '−', '1:1'] as const).map((t) => {
    const b = el('button', 'mp-boton', t);
    b.type = 'button';
    b.setAttribute('aria-label', t === '+' ? 'Acercar' : t === '−' ? 'Alejar' : 'Ver todo el sector');
    zoom.appendChild(b);
    return b;
  });
  marco.appendChild(zoom);
  cuerpo.appendChild(marco);

  const lado = el('aside', 'mp-lado');
  lado.appendChild(el('h3', '', 'Descubierto en este sector'));
  const lista = el('ul', 'mp-lista');
  lado.appendChild(lista);
  const nota = el('p', 'mp-nota');
  nota.textContent = 'Solo ves lo que ya has tenido cerca, salvo los altares de jefe y el refugio. '
    + 'Toca el mapa para poner una marca (hasta tres) o toca una marca para quitarla. '
    + 'Rueda, pellizco o los botones + y − acercan el mapa; arrástralo para moverte.';
  lado.appendChild(nota);
  const contador = el('p', 'mp-marcas');
  lado.appendChild(contador);
  cuerpo.appendChild(lado);
  panel.appendChild(cuerpo);
  raiz.appendChild(capa);

  // Lista de lo descubierto: un icono dibujado con el mismo trazo del minimapa.
  for (const tipo of ORDEN) {
    const vistos = datos.lugares.filter((l) => l.tipo === tipo && l.visto);
    if (!vistos.length) continue;
    const hechos = vistos.filter((l) => l.hecho).length;
    const fila = el('li', 'mp-fila');
    const ico = el('canvas', 'mp-ico');
    ico.width = ico.height = 64;
    const c = ico.getContext('2d');
    if (c) { c.translate(32, 32); c.scale(1.9, 1.9); icono(c, tipo, false); }
    const texto = el('span', 'mp-fila-texto', NOMBRES[tipo]);
    if (tipo === 'caja') {
      const abierto = vistos.find((l) => !l.hecho && l.coste !== undefined);
      if (abierto) texto.appendChild(el('small', '', `siguiente: ${abierto.coste} de chatarra`));
    } else if (hechos) {
      const [uno, varios] = HECHO[tipo] ?? ['hecho', 'hechos'];
      texto.appendChild(el('small', '', `${hechos} ${hechos > 1 ? varios : uno}`));
    }
    fila.append(ico, texto, el('b', 'mp-cuenta', `×${vistos.length - hechos}`));
    lista.appendChild(fila);
  }
  if (!lista.children.length) lista.appendChild(el('li', 'mp-vacio', 'Aún no has explorado nada. Sal a buscar.'));

  // Vista: centro en metros y píxeles por metro.
  const mitad = datos.carta?.mitad ?? datos.arena;
  let lado2 = 0;
  let k = 1;
  let kMin = 1;
  let cx = 0, cz = 0;
  const ajustar = () => {
    const caja = lienzo.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    lado2 = caja.width;
    lienzo.width = Math.round(caja.width * dpr);
    lienzo.height = Math.round(caja.height * dpr);
    const kAntes = kMin;
    kMin = lado2 / (mitad * 2);
    k = k === kAntes ? kMin : Math.max(kMin, k);
  };
  const limitar = () => {
    const vista = lado2 / k / 2;
    const libre = Math.max(0, mitad - vista);
    cx = Math.max(-libre, Math.min(libre, cx));
    cz = Math.max(-libre, Math.min(libre, cz));
  };
  const aPantalla = (x: number, z: number) => [(x - cx) * k + lado2 / 2, (z - cz) * k + lado2 / 2] as const;
  const aMundo = (sx: number, sy: number) => [(sx - lado2 / 2) / k + cx, (sy - lado2 / 2) / k + cz] as const;

  const pintar = () => {
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;
    const dpr = lienzo.width / Math.max(1, lado2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lado2, lado2);
    ctx.fillStyle = '#4a3436';
    ctx.fillRect(0, 0, lado2, lado2);
    if (datos.carta) {
      const [x0, y0] = aPantalla(-datos.carta.mitad, -datos.carta.mitad);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(datos.carta.imagen, x0, y0, datos.carta.mitad * 2 * k, datos.carta.mitad * 2 * k);
    }
    // Borde del sector jugable, a trazos.
    const [ax, ay] = aPantalla(-datos.arena, -datos.arena);
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ax, ay, datos.arena * 2 * k, datos.arena * 2 * k);
    ctx.setLineDash([]);

    const escala = Math.max(1, Math.min(1.8, k / kMin * 0.55 + 0.6));
    const dibujar = (x: number, z: number, fn: () => void) => {
      const [sx, sy] = aPantalla(x, z);
      if (sx < -20 || sy < -20 || sx > lado2 + 20 || sy > lado2 + 20) return;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(escala, escala); fn(); ctx.restore();
    };
    // La plataforma y la nave de rescate.
    dibujar(datos.cohete.x, datos.cohete.z, () => {
      ctx.fillStyle = '#efe8de'; ctx.strokeStyle = '#16111f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    if (datos.nave) {
      dibujar(datos.nave.x, datos.nave.z, () => {
        ctx.fillStyle = '#ff8a3d'; ctx.strokeStyle = '#16111f'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }
    for (const l of datos.lugares) {
      if (!l.visto) continue;
      dibujar(l.x, l.z, () => icono(ctx, l.tipo, !!l.hecho));
    }
    for (const p of puntos) dibujar(p.x, p.z, () => puntoJugador(ctx, 1.2));
    // El jugador, mirando hacia donde mira la cámara.
    dibujar(datos.jugador.x, datos.jugador.z, () => {
      ctx.rotate(-datos.jugador.yaw);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#16111f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(10, 10); ctx.lineTo(0, 5); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    contador.textContent = `Marcas: ${puntos.length} de ${MAX_PUNTOS}`;
  };

  const zoomEn = (factor: number, sx = lado2 / 2, sy = lado2 / 2) => {
    const [wx, wz] = aMundo(sx, sy);
    k = Math.max(kMin, Math.min(kMin * 6, k * factor));
    // El punto bajo el cursor se queda donde estaba.
    cx = wx - (sx - lado2 / 2) / k;
    cz = wz - (sy - lado2 / 2) / k;
    limitar();
    pintar();
  };

  ajustar();
  // Empieza centrado en el jugador, un poco acercado.
  k = kMin * 1.6;
  cx = datos.jugador.x;
  cz = datos.jugador.z;
  limitar();
  pintar();

  // Arrastrar mueve; un toque sin arrastre pone o quita una marca. Dos dedos
  // pellizcan.
  const dedos = new Map<number, { x: number; y: number }>();
  let arrastre = 0;
  let pellizco = 0;
  lienzo.addEventListener('pointerdown', (e) => {
    lienzo.setPointerCapture(e.pointerId);
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    arrastre = 0;
    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      pellizco = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  lienzo.addEventListener('pointermove', (e) => {
    const antes = dedos.get(e.pointerId);
    if (!antes) return;
    const ahora = { x: e.clientX, y: e.clientY };
    dedos.set(e.pointerId, ahora);
    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pellizco > 0) {
        const caja = lienzo.getBoundingClientRect();
        zoomEn(d / pellizco, (a.x + b.x) / 2 - caja.left, (a.y + b.y) / 2 - caja.top);
      }
      pellizco = d;
      arrastre = 99;
      return;
    }
    arrastre += Math.hypot(ahora.x - antes.x, ahora.y - antes.y);
    cx -= (ahora.x - antes.x) / k;
    cz -= (ahora.y - antes.y) / k;
    limitar();
    pintar();
  });
  const soltar = (e: PointerEvent) => {
    if (!dedos.has(e.pointerId)) return;
    dedos.delete(e.pointerId);
    if (dedos.size < 2) pellizco = 0;
    if (arrastre > 6 || dedos.size > 0) return;
    const caja = lienzo.getBoundingClientRect();
    const sx = e.clientX - caja.left, sy = e.clientY - caja.top;
    const cerca = puntos.findIndex((p) => {
      const [px, py] = aPantalla(p.x, p.z);
      return Math.hypot(px - sx, py - sy) < 16;
    });
    if (cerca >= 0) puntos.splice(cerca, 1);
    else if (puntos.length < MAX_PUNTOS) {
      const [x, z] = aMundo(sx, sy);
      if (Math.abs(x) <= mitad && Math.abs(z) <= mitad) puntos.push({ x, z });
    }
    pintar();
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', (e) => { dedos.delete(e.pointerId); pellizco = 0; });
  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    const caja = lienzo.getBoundingClientRect();
    zoomEn(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - caja.left, e.clientY - caja.top);
  }, { passive: false });
  botones[0].addEventListener('click', () => zoomEn(1.4));
  botones[1].addEventListener('click', () => zoomEn(1 / 1.4));
  botones[2].addEventListener('click', () => { k = kMin; cx = cz = 0; pintar(); });

  const alRedimensionar = () => { ajustar(); limitar(); pintar(); };
  window.addEventListener('resize', alRedimensionar);

  let hecho = false;
  const fin = () => {
    if (hecho) return;
    hecho = true;
    window.removeEventListener('keydown', alTecla, true);
    window.removeEventListener('resize', alRedimensionar);
    capa.remove();
    cerrar(puntos);
  };
  // En captura y sin dejar pasar: la Esc que cierra el mapa no debe pausar el
  // juego en el fotograma siguiente.
  function alTecla(e: KeyboardEvent) {
    if (e.code === 'Escape' || e.code === 'KeyM') {
      e.preventDefault();
      e.stopPropagation();
      fin();
    } else if (e.key === '+' || e.key === '=') {
      zoomEn(1.4);
    } else if (e.key === '-') {
      zoomEn(1 / 1.4);
    }
  }
  window.addEventListener('keydown', alTecla, true);
  volver.addEventListener('click', fin);
  capa.addEventListener('pointerdown', (e) => { if (e.target === capa) fin(); });
  return fin;
}
