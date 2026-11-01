// META SPACE — Cinemática de entrada.
//
// Una nave espacial desciende sobre el planeta rojo, levanta polvo al
// acercarse y entonces aparece el nombre del juego. Todo dibujado por código
// (pixel-art propio, sin assets). Se salta con clic / Intro / Escape y se
// omite con `prefers-reduced-motion`.

export interface IntroOptions {
  /** Segundos antes de poder saltarla con clic (siempre se puede con Esc). */
  minVer?: number;
}

const NAVE = [
  '......KKKK......',
  '.....KWWWWK.....',
  '.....KWWWWK.....',
  '.....KVVVVK.....',
  '.....KVVVVK.....',
  '.....KWWWWK.....',
  '.....KWWWWK.....',
  '....KWWWWWWK....',
  '....KWWWWWWK....',
  '....KWWOOWWK....',
  '....KWWWWWWK....',
  '....KWWWWWWK....',
  '...KWWWWWWWWK...',
  '...KWwWWWWwWK...',
  '...KWWWWWWWWK...',
  '...KWWWWWWWWK...',
  '..KKWWWWWWWWKK..',
  '..KFKWWWWWWKFK..',
  '..KFFKWWWWKFFK..',
  '..KFFKWWWWKFFK..',
  '...KKKWWWWKKK...',
  '.....KWWWWK.....',
  '.....KWWWWK.....',
  '......KWWK......',
];

const COLOR: Record<string, string> = {
  K: '#1b1214',
  W: '#ece6dc',
  w: '#b9b0a6',
  V: '#5ee0ff',
  O: '#e8632b',
  F: '#e8632b',
};

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  color: string;
  tam: number;
}

interface Estrella {
  x: number;
  y: number;
  capa: number;
  parp: number;
}

function semilla(n: number) {
  let s = n;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Cinemática a pantalla completa. Devuelve función para desmontarla. */
export function showIntro(
  root: HTMLElement,
  onDone: () => void,
  opts: IntroOptions = {},
): () => void {
  const minVer = opts.minVer ?? 1.2;
  const velo = document.createElement('div');
  velo.style.cssText = 'position:fixed;inset:0;z-index:60;background:#0d0714;';
  const lienzo = document.createElement('canvas');
  velo.appendChild(lienzo);
  root.appendChild(velo);
  const ctx = lienzo.getContext('2d')!;

  const rand = semilla(20250);
  const estrellas: Estrella[] = Array.from({ length: 140 }, () => ({
    x: rand(),
    y: rand() * 0.72,
    capa: rand() < 0.5 ? 0 : 1,
    parp: rand() * Math.PI * 2,
  }));
  const particulas: Particula[] = [];
  let t = 0;
  let ultimo = performance.now();
  let vivo = true;
  let raf = 0;
  let tituloYa = false;

  const terminar = () => {
    if (!vivo) return;
    vivo = false;
    cancelAnimationFrame(raf);
    velo.remove();
    onDone();
  };

  const saltar = () => {
    if (t < 5.6) t = 5.6;
    else terminar();
  };
  const alClic = () => {
    if (t >= minVer) saltar();
  };
  const alTecla = (e: KeyboardEvent) => {
    if (e.code === 'Escape') terminar();
    else if (e.code === 'Enter' || e.code === 'Space') alClic();
  };
  velo.addEventListener('pointerdown', alClic);
  window.addEventListener('keydown', alTecla);

  const encajar = () => {
    lienzo.width = window.innerWidth;
    lienzo.height = window.innerHeight;
  };
  encajar();
  window.addEventListener('resize', encajar);

  const pintar = (dt: number) => {
    t += dt;
    const W = lienzo.width, H = lienzo.height;
    const u = Math.min(W / 900, H / 700); // unidad de escala

    // Fondo: cielo casi negro con deriva de estrellas.
    ctx.fillStyle = '#0d0714';
    ctx.fillRect(0, 0, W, H);
    for (const e of estrellas) {
      const b = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + e.parp));
      ctx.globalAlpha = (e.capa === 0 ? 0.35 : 0.8) * b;
      ctx.fillStyle = '#ffe9d8';
      const s = e.capa === 0 ? 1 : 2;
      ctx.fillRect(((e.x - t * 0.004 * (e.capa + 1)) % 1 + 1) % 1 * W, e.y * H, s, s);
    }
    ctx.globalAlpha = 1;

    // Planeta rojo: solo el casquete inferior asoma por el horizonte.
    const horizonte = H * 0.62;
    const pr = W * 0.9;
    const py = horizonte + pr;
    const cielo = ctx.createLinearGradient(0, H * 0.2, 0, horizonte);
    cielo.addColorStop(0, 'rgba(185,80,60,0)');
    cielo.addColorStop(1, 'rgba(185,80,60,0.35)');
    ctx.fillStyle = cielo;
    ctx.fillRect(0, H * 0.2, W, horizonte - H * 0.2);
    ctx.fillStyle = '#a83c2a';
    ctx.beginPath();
    ctx.arc(W / 2, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,110,0.5)';
    ctx.lineWidth = Math.max(2, 3 * u);
    ctx.beginPath();
    ctx.arc(W / 2, py, pr, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    // Silueta de ciudad muerta sobre el horizonte del planeta.
    ctx.fillStyle = '#3a1520';
    const hy = horizonte;
    const r2 = semilla(77);
    let x = -20;
    while (x < W + 20) {
      const w = (14 + r2() * 40) * u;
      const h = (18 + r2() * 66) * u;
      ctx.fillRect(x, hy - h, w, h + 4);
      if (r2() < 0.4) ctx.fillRect(x + w * 0.4, hy - h - 14 * u, 3 * u, 14 * u);
      x += w + 4;
    }

    // Nave: entra por arriba, desciende con vaivén y se asienta.
    const t0 = 0.6, t1 = 4.6;
    const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    const ease = 1 - (1 - k) * (1 - k) * (1 - k);
    const nx = W / 2 + Math.sin(t * 1.1) * 8 * u * (1 - ease * 0.7);
    const ny = -H * 0.15 + ease * (H * 0.52 + H * 0.15);
    const esc = 4 * u;
    const motor = t < 4.9 && k > 0 && k < 1;
    for (let r = 0; r < NAVE.length; r++) {
      const fila = NAVE[r];
      for (let c = 0; c < fila.length; c++) {
        const col = COLOR[fila[c]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(nx + (c - 8) * esc, ny + (r - 12) * esc, esc, esc);
      }
    }
    // Llama del motor (cyan ADA) + chispas.
    if (motor) {
      const fl = (10 + Math.sin(t * 47) * 4 + Math.random() * 5) * u;
      ctx.fillStyle = '#5ee0ff';
      ctx.fillRect(nx - 2.5 * u, ny + 12 * esc, 5 * u, fl);
      ctx.fillStyle = '#d8fdff';
      ctx.fillRect(nx - 1.2 * u, ny + 12 * esc, 2.4 * u, fl * 0.55);
      for (let i = 0; i < 3; i++) {
        particulas.push({
          x: nx + (Math.random() - 0.5) * 6 * u,
          y: ny + 12 * esc + fl,
          vx: (Math.random() - 0.5) * 60 * u,
          vy: (60 + Math.random() * 80) * u,
          vida: 0.7, max: 0.7,
          color: Math.random() < 0.5 ? '#5ee0ff' : '#e8632b',
          tam: (1.5 + Math.random() * 2) * u,
        });
      }
    }
    // Polvo al asentarse.
    if (t > 4.6 && t < 6.2 && particulas.length < 220) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        particulas.push({
          x: nx + (Math.random() - 0.5) * 30 * u,
          y: H * 0.52 + 12 * esc,
          vx: Math.cos(a) * (40 + Math.random() * 90) * u,
          vy: -Math.random() * 60 * u,
          vida: 1.1, max: 1.1,
          color: '#c47a52',
          tam: (2 + Math.random() * 3) * u,
        });
      }
    }
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) {
        particulas.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 30 * u * dt;
      ctx.globalAlpha = Math.max(0, p.vida / p.max) * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.tam, p.tam);
    }
    ctx.globalAlpha = 1;

    // Título: letras que entran + subtítulo + pista.
    if (t > 5.4) {
      const kt = Math.min(1, (t - 5.4) / 1.2);
      ctx.textAlign = 'center';
      const titulo = 'META SPACE';
      const tam = Math.floor(64 * u);
      ctx.font = `900 ${tam}px Rubik, system-ui, sans-serif`;
      const t0x = W / 2 - ctx.measureText(titulo).width / 2;
    let x = t0x;
    for (let i = 0; i < titulo.length; i++) {
      const ch = titulo[i];
      const wch = ctx.measureText(ch).width;
      const aparece = Math.min(1, Math.max(0, kt * (titulo.length + 2) - i - 1));
      ctx.globalAlpha = aparece;
      ctx.fillStyle = i >= 5 ? '#5ee0ff' : '#f4ede2';
      ctx.fillText(ch, x + wch / 2, H * 0.3 + (1 - aparece) * 24 * u);
      x += wch;
    }
      ctx.globalAlpha = Math.max(0, kt - 0.4) / 0.6;
      ctx.font = `700 ${Math.floor(17 * u)}px Rubik, system-ui, sans-serif`;
      ctx.fillStyle = '#ffb347';
      ctx.fillText('S E C T O R   D E L T A', W / 2, H * 0.3 + 34 * u);
      ctx.globalAlpha = t > 6.6 ? 0.4 + 0.4 * Math.sin(t * 3) : 0;
      ctx.fillStyle = '#c6cbe0';
      ctx.font = `500 ${Math.floor(14 * u)}px Rubik, system-ui, sans-serif`;
      ctx.fillText('clic o Intro para despegar', W / 2, H * 0.88);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      if (!tituloYa) {
        tituloYa = true;
        try {
          const ctxAu = new AudioContext();
          const o = ctxAu.createOscillator();
          const g = ctxAu.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(220, ctxAu.currentTime);
          o.frequency.exponentialRampToValueAtTime(880, ctxAu.currentTime + 0.5);
          g.gain.setValueAtTime(0.08, ctxAu.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, ctxAu.currentTime + 0.6);
          o.connect(g).connect(ctxAu.destination);
          o.start();
          void o.stop(ctxAu.currentTime + 0.65);
        } catch {
          // Sin audio no pasa nada: la cinemática sigue.
        }
      }
    }

    // Fundido de entrada.
    if (t < 1) {
      ctx.fillStyle = `rgba(13,7,20,${1 - t})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

  const frame = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    pintar(dt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame((ahora) => {
    ultimo = ahora;
    pintar(0);
    raf = requestAnimationFrame(frame);
  });

  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', alTecla);
    window.removeEventListener('resize', encajar);
    velo.remove();
  };
}
