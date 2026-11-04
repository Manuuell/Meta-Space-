import './ui-astillero.css';
import * as THREE from 'three';
import { crearEntorno, crearNaveModular, type NaveModular } from './modelos/nave-modular.ts';
import { crearPost, type AcabadoImagen } from './cinematica-post.ts';
import { sfx } from './audio.ts';
import {
  DEF_RANURA, calcular, fabricada, fabricar, faltaPara, indicadores, piezasDe, resolverVuelo,
  type Diseno, type Hangar, type IdIndicador, type Pieza, type Ranura,
} from './nave/piezas.ts';

// META SPACE — El astillero, donde se arma la nave. La nave manda: ocupa la pantalla
// y se elige tocándola. Cada parte tiene un pin sobre el modelo y su encuadre de
// cámara. Abajo están las piezas con su miniatura 3D, y al pulsar una se PRUEBA en la
// nave antes de gastar nada: cambia y los indicadores enseñan el antes y el después.

export interface OpcionesAstillero {
  hangar: Hangar;
  /** Chatarra que se puede gastar ahora. */
  chatarra: () => number;
  gastar: (n: number) => void;
  /** Guarda el hangar tras cada cambio. */
  guardar: () => void;
  /** Si viene, se puede lanzar desde aquí (en la plataforma, durante la partida). */
  lanzar?: () => void;
  volver: () => void;
  /** Texto sobre el nombre de la nave. */
  subtitulo?: string;
  /** Se queda en el plano general en vez de acercarse a lo que falta. */
  general?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const miles = (n: number) => Math.round(n).toLocaleString('es-ES');
const ORDEN: readonly Ranura[] = ['proa', 'casco', 'escudo', 'aletas', 'propulsor', 'motores'];

/** Qué parte arregla cada indicador: el astillero abre por lo que más falta. */
const ARREGLA: Record<IdIndicador, Ranura> = { empujePeso: 'motores', deltaV: 'propulsor', control: 'aletas', blindaje: 'escudo', senal: 'proa' };

interface Toma { giro: number; alzado: number; distancia: number; foco: readonly [number, number, number] }
const TOMA: Record<Ranura, Toma> = {
  proa: { giro: 0.85, alzado: 0.24, distancia: 34, foco: [0, 3.6, 13] },
  casco: { giro: 1.2, alzado: 0.42, distancia: 36, foco: [0, 4, 0] },
  escudo: { giro: 1.55, alzado: -0.1, distancia: 34, foco: [0, 3.2, -1] },
  aletas: { giro: 2.15, alzado: 0.62, distancia: 46, foco: [0, 4, -4] },
  propulsor: { giro: 2.3, alzado: 0.4, distancia: 34, foco: [0, 4.2, -5] },
  motores: { giro: 3.62, alzado: 0.2, distancia: 40, foco: [0, 3.8, -13] },
};

/** Clase de la nave según cómo vuela: se ve de un vistazo si va bien. */
function clase(d: Diseno) {
  const v = resolverVuelo(calcular(d));
  return { letra: v.exito ? (['B', 'A', 'S'] as const)[v.estrellas - 1] : 'C', vuelo: v };
}

export function abrirAstillero(o: OpcionesAstillero): () => void {
  document.querySelector('.hv')?.remove();
  const raiz = document.createElement('div');
  raiz.className = 'hv';
  raiz.innerHTML = `
    <canvas class="hv__lienzo" aria-label="Tu nave. Arrastra para girarla."></canvas>
    <div class="hv__pines"></div>
    <header class="hv__cabecera">
      <div class="hv__placa">
        <span class="hv__clase" title="Clase de la nave"></span>
        <div><small>${esc(o.subtitulo ?? 'ASTILLERO')}</small><h1>ARES-X</h1><em class="hv__estado"></em></div>
        <button type="button" class="hv__entera">Ver nave entera <kbd>0</kbd></button>
      </div>
      <ul class="hv__almacen" aria-label="Almacén"></ul>
      <button type="button" class="hv__cerrar" aria-label="Volver">×</button>
    </header>
    <aside class="hv__vuelo">
      <h2>Simulación de vuelo</h2>
      <div class="hv__medidas"></div>
      <p class="hv__ada"></p>
      ${o.lanzar ? '<button type="button" class="hv__lanzar"></button>' : ''}
    </aside>
    <section class="hv__dique">
      <nav class="hv__pestanas" role="tablist" aria-label="Partes de la nave"></nav>
      <div class="hv__fila">
        <div class="hv__cartas"></div>
        <div class="hv__accion"></div>
      </div>
    </section>`;
  document.body.appendChild(raiz);
  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const lienzo = q<HTMLCanvasElement>('.hv__lienzo');

  // ------------------------------------------------------------- escena

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Neutral conserva los colores saturados de la pintura; ACES los lava.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const post = crearPost(renderer);
  const escena = new THREE.Scene();
  escena.environment = crearEntorno(renderer);
  const camara = new THREE.PerspectiveCamera(30, 1, 1, 2000);

  // Cielo retro: del verde agua al melocotón, con un planeta anillado enorme.
  const planeta = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d')!;
    const cuerpo = g.createRadialGradient(420, 400, 40, 512, 512, 320);
    cuerpo.addColorStop(0, '#fff3dc');
    cuerpo.addColorStop(0.7, '#f0c8a8');
    cuerpo.addColorStop(1, '#c58e86');
    g.fillStyle = cuerpo;
    g.beginPath();
    g.arc(512, 512, 300, 0, Math.PI * 2);
    g.fill();
    g.translate(512, 512);
    g.rotate(-0.32);
    for (let k = 0; k < 26; k++) {
      g.strokeStyle = `rgba(255, 245, 225, ${0.1 + (k % 3) * 0.1})`;
      g.lineWidth = 3 + (k % 4) * 3;
      g.beginPath();
      g.ellipse(0, 0, 370 + k * 6, 66 + k * 1.1, 0, 0, Math.PI * 2);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      void main() {
        float h = clamp(vP.y, -0.1, 1.0);
        vec3 c = mix(vec3(1.0, 0.72, 0.52), vec3(0.36, 0.86, 0.72), smoothstep(0.0, 0.22, h));
        c = mix(c, vec3(0.05, 0.36, 0.42), smoothstep(0.2, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  escena.add(cielo);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: planeta, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  sprite.position.set(-310, 150, -560);
  sprite.scale.setScalar(620);
  escena.add(sprite);

  // Plataforma: suelo oscuro, anillo de luz y marcas de pista.
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(700, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#123238', metalness: 0.4, roughness: 0.62 }));
  suelo.receiveShadow = true;
  escena.add(suelo);
  escena.fog = new THREE.Fog('#7cc9a8', 140, 620);
  const pista = new THREE.Mesh(new THREE.CylinderGeometry(25, 26.5, 0.8, 72), new THREE.MeshStandardMaterial({ color: '#1f2a33', metalness: 0.7, roughness: 0.4 }));
  pista.position.y = 0.2;
  pista.receiveShadow = true;
  escena.add(pista);
  for (const [r, c] of [[25.2, '#ff8a3d'], [20, '#5ee0ff']] as const) {
    const a = new THREE.Mesh(new THREE.RingGeometry(r - 0.22, r, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    a.position.y = 0.62;
    escena.add(a);
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: k % 2 ? '#ffd9a0' : '#20303a', toneMapped: false }));
    m.position.set(Math.cos(a) * 22.6, 0.63, Math.sin(a) * 22.6);
    m.rotation.y = -a;
    escena.add(m);
  }
  const sol = new THREE.DirectionalLight('#fff0d8', 2.6);
  sol.position.set(40, 70, 50);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
  sol.shadow.bias = -0.0006;
  const contra = new THREE.DirectionalLight('#7fe6ff', 1.1);
  contra.position.set(-50, 24, -50);
  escena.add(sol, contra);

  // Esquinas que enmarcan la parte elegida, como en un plano técnico.
  const marco = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#5ee0ff', toneMapped: false, transparent: true }));
  marco.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3 * 2), 3));
  marco.frustumCulled = false;
  escena.add(marco);

  // Chispas al montar una pieza.
  const N = 120;
  const posC = new Float32Array(N * 3), velC = new Float32Array(N * 3), vidaC = new Float32Array(N);
  const geoC = new THREE.BufferGeometry();
  geoC.setAttribute('position', new THREE.BufferAttribute(posC, 3));
  const chispas = new THREE.Points(geoC, new THREE.PointsMaterial({ color: '#ffd28a', size: 0.42, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  chispas.frustumCulled = false;
  escena.add(chispas);
  const soldar = (c: THREE.Vector3) => {
    for (let k = 0; k < N; k++) {
      posC.set([c.x + (Math.random() - 0.5) * 3, c.y, c.z + (Math.random() - 0.5) * 3], k * 3);
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      velC.set([Math.cos(a) * v, 3 + Math.random() * 9, Math.sin(a) * v], k * 3);
      vidaC[k] = 0.4 + Math.random() * 0.9;
    }
  };

  // ---------------------------------------------------------------- estado

  const inicial = indicadores(calcular(o.hangar.montadas)).find((i) => !i.ok);
  let ranura: Ranura = inicial ? ARREGLA[inicial.id] : 'casco';
  /** Pieza que se está probando en la nave, sin haberla montado. */
  let prueba: Pieza | null = null;
  const diseno = (): Diseno => (prueba ? { ...o.hangar.montadas, [prueba.ranura]: prueba.id } : o.hangar.montadas);

  let nave: NaveModular | null = null;
  let entra: { parte: THREE.Group; x: number; t: number } | null = null;

  const liberar = (obj: THREE.Object3D) => obj.traverse((n) => { if (n instanceof THREE.Mesh) n.geometry.dispose(); });
  const montar = (nueva?: Ranura) => {
    if (nave) {
      escena.remove(nave.raiz);
      liberar(nave.raiz);
    }
    nave = crearNaveModular(diseno());
    nave.raiz.position.y = 0.6;
    escena.add(nave.raiz);
    nave.raiz.updateMatrixWorld(true);
    if (nueva) {
      const parte = nave.partes[nueva];
      entra = { parte, x: parte.position.y, t: 0 };
    }
    marcar();
  };

  const caja3 = new THREE.Box3(), centro = new THREE.Vector3();
  /** Centro de una parte; si no hay nada montado (sin escudo), el costado de la nave. */
  const centroDe = (r: Ranura, out: THREE.Vector3) => {
    caja3.setFromObject(nave!.partes[r]);
    return caja3.isEmpty() ? out.set(2.8, 3.6, 0) : caja3.getCenter(out);
  };
  function marcar() {
    caja3.setFromObject(nave!.partes[ranura]);
    const p = marco.geometry.attributes.position as THREE.BufferAttribute;
    if (caja3.isEmpty()) {
      marco.visible = false;
      return;
    }
    marco.visible = true;
    const { min, max } = caja3;
    const l = Math.min(1.6, (max.x - min.x) * 0.2, (max.z - min.z) * 0.2, 1 + (max.y - min.y) * 0.3);
    let i = 0;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const sx = x === min.x ? 1 : -1, sy = y === min.y ? 1 : -1, sz = z === min.z ? 1 : -1;
      for (const [dx, dy, dz] of [[sx * l, 0, 0], [0, sy * l, 0], [0, 0, sz * l]]) {
        p.setXYZ(i++, x, y, z);
        p.setXYZ(i++, x + dx, y + dy, z + dz);
      }
    }
    p.needsUpdate = true;
  }
  montar();

  // Cámara: cada parte tiene su encuadre; arrastrando se gira a mano.
  const c = { giro: 1.0, alzado: 0.1, distancia: 60, x: 0, y: 5, z: 3 };
  const meta = { ...c };
  let tocado = false, arrastre: { x: number; y: number } | null = null;
  const encuadrar = (r: Ranura) => {
    const t = TOMA[r];
    // Por el camino corto.
    const vueltas = Math.round((c.giro - t.giro) / (Math.PI * 2));
    Object.assign(meta, { giro: t.giro + vueltas * Math.PI * 2, alzado: t.alzado, distancia: t.distancia, x: t.foco[0], y: t.foco[1], z: t.foco[2] });
    tocado = false;
  };
  const verEntera = () => {
    Object.assign(meta, { giro: meta.giro, alzado: 0.14, distancia: 62, x: 0, y: 5, z: 3 });
    tocado = false;
  };
  lienzo.addEventListener('pointerdown', (e) => {
    arrastre = { x: e.clientX, y: e.clientY };
    tocado = true;
    lienzo.setPointerCapture(e.pointerId);
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    meta.giro += (e.clientX - arrastre.x) * 0.008;
    meta.alzado = Math.max(-0.25, Math.min(1.2, meta.alzado + (e.clientY - arrastre.y) * 0.005));
    arrastre = { x: e.clientX, y: e.clientY };
  });
  lienzo.addEventListener('pointerup', () => { arrastre = null; });
  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    meta.distancia = Math.max(16, Math.min(110, meta.distancia * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive: false });

  // ------------------------------------------------------------ miniaturas

  const miniaturas = new Map<string, string>();
  let taller: { r: THREE.WebGLRenderer; e: THREE.Scene; c: THREE.PerspectiveCamera } | null = null;
  const pintarMiniatura = (p: Pieza) => {
    const clave = p.id;
    if (miniaturas.has(clave)) return miniaturas.get(clave)!;
    if (!taller) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(300, 180, false);
      r.toneMapping = THREE.NeutralToneMapping;
      const e = new THREE.Scene();
      e.environment = crearEntorno(r);
      const luz = new THREE.DirectionalLight('#fff0d8', 2.4);
      luz.position.set(20, 30, 20);
      e.add(luz, new THREE.AmbientLight('#bfe8ff', 0.5));
      taller = { r, e, c: new THREE.PerspectiveCamera(26, 300 / 180, 0.5, 400) };
    }
    const n = crearNaveModular({ ...o.hangar.montadas, [p.ranura]: p.id });
    const g = n.partes[p.ranura];
    const grupo = new THREE.Group();
    grupo.add(g);
    // El escudo se entiende sobre el casco; sin casco solo se verían unas placas.
    if (p.ranura === 'escudo') grupo.add(n.partes.casco);
    taller.e.add(grupo);
    grupo.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(grupo), medio = b.getCenter(new THREE.Vector3()), talla = b.getSize(new THREE.Vector3()).length();
    const t = TOMA[p.ranura];
    taller.c.position.set(
      medio.x + Math.sin(t.giro) * Math.cos(t.alzado + 0.15) * talla * 1.75,
      medio.y + Math.sin(t.alzado + 0.15) * talla * 1.75,
      medio.z + Math.cos(t.giro) * Math.cos(t.alzado + 0.15) * talla * 1.75,
    );
    taller.c.lookAt(medio);
    taller.r.render(taller.e, taller.c);
    const url = taller.r.domElement.toDataURL('image/png');
    taller.e.remove(grupo);
    liberar(grupo);
    miniaturas.set(clave, url);
    return url;
  };

  // ---------------------------------------------------------------- paneles

  const pines = q('.hv__pines');
  pines.innerHTML = ORDEN.map((r, k) => `<button type="button" class="hv-pin" data-r="${r}" style="--c:${DEF_RANURA[r].color}"><i>${k + 1}</i><span>${DEF_RANURA[r].nombre}</span></button>`).join('');
  const listaPines = [...pines.querySelectorAll<HTMLButtonElement>('.hv-pin')];
  listaPines.forEach((b) => b.addEventListener('click', () => elegirRanura(b.dataset.r as Ranura)));

  function elegirRanura(r: Ranura) {
    const habia = prueba !== null;
    prueba = null;
    ranura = r;
    if (habia) montar();
    else marcar();
    encuadrar(r);
    pintarTodo();
  }

  const pintarCabecera = () => {
    const { letra, vuelo } = clase(diseno());
    const placa = q('.hv__clase');
    placa.textContent = letra;
    placa.dataset.c = letra;
    q('.hv__estado').textContent = vuelo.exito ? 'Lista para volar' : vuelo.titulo;
    q('.hv__almacen').innerHTML = [
      `<li class="chatarra"><small>Chatarra</small><b>${miles(o.chatarra())}</b></li>`,
      ...ORDEN.map((r) => `<li style="--c:${DEF_RANURA[r].color}" title="${esc(DEF_RANURA[r].fragmentos)}"><small>${esc(DEF_RANURA[r].fragmentos)}</small><b>${o.hangar.fragmentos[r]}</b></li>`),
    ].join('');
  };

  const pintarPestanas = () => {
    q('.hv__pestanas').innerHTML = ORDEN.map((r, k) => {
      const d = DEF_RANURA[r], p = piezasDe(r).find((x) => x.id === o.hangar.montadas[r])!;
      return `<button type="button" role="tab" aria-selected="${r === ranura}" class="hv-pestana${r === ranura ? ' activa' : ''}" data-r="${r}" style="--c:${d.color}">
        <i>${k + 1}</i><span><b>${d.nombre}</b><em>${esc(p.nombre)}</em></span></button>`;
    }).join('');
    raiz.querySelectorAll<HTMLButtonElement>('.hv-pestana').forEach((b) => b.addEventListener('click', () => elegirRanura(b.dataset.r as Ranura)));
    for (const b of listaPines) b.classList.toggle('activo', b.dataset.r === ranura);
  };

  const pintarCartas = () => {
    const d = DEF_RANURA[ranura];
    const actual = calcular(o.hangar.montadas);
    q('.hv__cartas').innerHTML = piezasDe(ranura).map((p) => {
      const montada = o.hangar.montadas[ranura] === p.id, lista = fabricada(o.hangar, p);
      const elegida = prueba ? prueba.id === p.id : montada;
      const nueva = calcular({ ...o.hangar.montadas, [ranura]: p.id });
      const cambios = indicadores(actual).map((i, k) => {
        const n = indicadores(nueva)[k];
        const dif = n.valor - i.valor;
        // Lo que no llega a verse en pantalla no se anuncia.
        if (Math.abs(dif) < (i.id === 'empujePeso' ? 0.005 : 0.5)) return '';
        const txt = i.id === 'deltaV' ? miles(Math.abs(dif)) : i.id === 'empujePeso' ? Math.abs(dif).toFixed(2) : Math.round(Math.abs(dif));
        return `<li class="${dif > 0 ? 'mas' : 'menos'}">${dif > 0 ? '▲' : '▼'} ${i.nombre.split(' ')[0]} ${txt}</li>`;
      }).join('');
      return `<button type="button" class="hv-carta${elegida ? ' elegida' : ''}${montada ? ' montada' : ''}${lista ? '' : ' nueva'}" data-id="${p.id}" style="--c:${d.color}">
        <span class="hv-carta__foto"><img alt="" src="${pintarMiniatura(p)}"></span>
        <span class="hv-carta__texto">
          <small>${montada ? 'Montada' : lista ? 'Fabricada' : `${p.fragmentos} ${esc(p.fragmentos === 1 ? d.fragmento : d.fragmentos).toLowerCase()} · ${p.chatarra} chatarra`}</small>
          <b>${esc(p.nombre)}</b>
          <ul>${cambios}</ul>
        </span>
      </button>`;
    }).join('');
    raiz.querySelectorAll<HTMLButtonElement>('.hv-carta').forEach((b) => b.addEventListener('click', () => probar(b.dataset.id!)));
  };

  function probar(id: string) {
    const p = piezasDe(ranura).find((x) => x.id === id)!;
    const nueva = o.hangar.montadas[ranura] === id ? null : p;
    if ((prueba?.id ?? null) === (nueva?.id ?? null)) return;
    prueba = nueva;
    montar(ranura);
    sfx('pickup');
    pintarTodo();
  }

  const pintarAccion = () => {
    const a = q('.hv__accion');
    const p = prueba ?? piezasDe(ranura).find((x) => x.id === o.hangar.montadas[ranura])!;
    if (!prueba) {
      a.innerHTML = `<h3>${esc(p.nombre)}</h3><p>${esc(p.texto)}</p><button type="button" disabled>Montada en la nave</button>`;
      return;
    }
    const lista = fabricada(o.hangar, prueba), falta = lista ? null : faltaPara(o.hangar, prueba, o.chatarra());
    a.innerHTML = `<small>Probando en la nave</small><h3>${esc(p.nombre)}</h3><p>${esc(p.texto)}</p>
      <button type="button"${falta ? ' disabled' : ''}>${esc(falta ?? (lista ? 'Montar' : 'Fabricar y montar'))}</button>`;
    if (!falta) a.querySelector('button')!.addEventListener('click', confirmar);
  };

  function confirmar() {
    if (!prueba) return;
    const p = prueba;
    if (fabricada(o.hangar, p)) o.hangar.montadas[p.ranura] = p.id;
    else o.gastar(fabricar(o.hangar, p));
    prueba = null;
    o.guardar();
    montar(p.ranura);
    soldar(centroDe(p.ranura, centro));
    sfx('carga');
    pintarTodo();
  }

  const pintarVuelo = () => {
    const antes = indicadores(calcular(o.hangar.montadas));
    const ahora = indicadores(calcular(diseno()));
    q('.hv__medidas').innerHTML = ahora.map((i, k) => {
      const b = antes[k];
      const pct = (v: number) => Math.min(100, (v / i.tope) * 100).toFixed(1);
      const baja = i.valor < b.valor;
      return `<div class="hv-medida${i.ok ? ' ok' : ''}">
        <span>${i.nombre}<b>${i.texto}</b></span>
        <div class="hv-barra">
          <i class="base" style="width:${pct(Math.min(b.valor, i.valor))}%"></i>
          ${i.valor !== b.valor ? `<i class="cambio ${baja ? 'pierde' : 'gana'}" style="left:${pct(Math.min(b.valor, i.valor))}%;width:${(Number(pct(Math.max(b.valor, i.valor))) - Number(pct(Math.min(b.valor, i.valor)))).toFixed(1)}%"></i>` : ''}
          <u style="left:${pct(i.minimo)}%"></u>
        </div>
      </div>`;
    }).join('');
    const { vuelo } = clase(diseno());
    const ada = q('.hv__ada');
    ada.textContent = vuelo.exito ? `ADA: «Con esto cruzamos el velo.»` : `ADA: «${ahora.find((i) => !i.ok)!.ayuda}»`;
    ada.classList.toggle('ok', vuelo.exito);
    if (o.lanzar) {
      const l = q<HTMLButtonElement>('.hv__lanzar');
      const listo = resolverVuelo(calcular(o.hangar.montadas)).exito;
      l.textContent = listo ? 'Lanzar ARES-X' : 'Lanzar de todos modos';
      l.classList.toggle('riesgo', !listo);
    }
  };

  function pintarTodo() {
    pintarCabecera();
    pintarPestanas();
    pintarCartas();
    pintarAccion();
    pintarVuelo();
  }
  pintarTodo();
  // Abre con un plano general y luego se acerca a lo que hay que arreglar.
  if (!o.general) setTimeout(() => encuadrar(ranura), 1100);

  // ------------------------------------------------------------- fotograma

  const acabado: AcabadoImagen = {
    tiempo: 0, brillo: 0.22, umbral: 0.92, aberracion: 0.06, estatica: 0, tinte: new THREE.Color('#fff'), ondaX: 0.5, ondaY: 0.5, ondaRadio: 0, ondaFuerza: 0,
  };
  let W = 1, H = 1;
  const encajar = () => {
    W = raiz.clientWidth || innerWidth;
    H = raiz.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    post.medir(W, H);
    camara.aspect = W / H;
    // La nave es larga: en vertical se abre el plano para que quepa.
    camara.fov = W / H < 1 ? 46 : 30;
    // Con el panel a la derecha y el dique abajo, el centro de la nave va a lo libre.
    if (W > 960) camara.setViewOffset(W, H, 143, 78, W, H);
    else camara.setViewOffset(W, H, 0, Math.round(H * 0.2), W, H);
    camara.updateProjectionMatrix();
  };
  encajar();
  const observador = new ResizeObserver(encajar);
  observador.observe(raiz);

  const v = new THREE.Vector3();
  let vivo = true, reloj = performance.now(), raf = 0;
  const fotograma = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - reloj) / 1000);
    reloj = ahora;
    if (!tocado) meta.giro += dt * 0.05;
    const k = 1 - Math.exp(-dt * 3.4);
    for (const n of ['giro', 'alzado', 'distancia', 'x', 'y', 'z'] as const) c[n] += (meta[n] - c[n]) * k;
    camara.position.set(c.x + Math.sin(c.giro) * Math.cos(c.alzado) * c.distancia, Math.max(1.5, c.y + Math.sin(c.alzado) * c.distancia), c.z + Math.cos(c.giro) * Math.cos(c.alzado) * c.distancia);
    camara.lookAt(c.x, c.y, c.z);
    camara.updateMatrixWorld();

    // La pieza que entra baja hasta su sitio.
    if (entra) {
      entra.t = Math.min(1, entra.t + dt / 0.4);
      entra.parte.position.y = entra.x + 3 * (1 - entra.t) ** 3;
      if (entra.t >= 1) {
        entra.parte.position.y = entra.x;
        entra = null;
        marcar();
      }
    }
    (marco.material as THREE.LineBasicMaterial).opacity = 0.65 + 0.35 * Math.sin(ahora / 240);

    for (let i = 0; i < N; i++) {
      if (vidaC[i] <= 0) { posC[i * 3 + 1] = -50; continue; }
      vidaC[i] -= dt;
      velC[i * 3 + 1] -= 18 * dt;
      for (let e = 0; e < 3; e++) posC[i * 3 + e] += velC[i * 3 + e] * dt;
    }
    geoC.attributes.position.needsUpdate = true;

    // Los pines siguen a su parte por la pantalla.
    for (const b of listaPines) {
      centroDe(b.dataset.r as Ranura, v).project(camara);
      const delante = v.z < 1;
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      b.style.display = delante ? '' : 'none';
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
    acabado.tiempo = ahora / 1000;
    post.pintar(escena, camara, acabado);
    raf = requestAnimationFrame(fotograma);
  };
  raf = requestAnimationFrame(fotograma);

  // ---------------------------------------------------------------- cierre

  const cerrar = () => {
    if (!vivo) return;
    vivo = false;
    cancelAnimationFrame(raf);
    observador.disconnect();
    window.removeEventListener('keydown', tecla, true);
    post.liberar();
    if (taller) {
      taller.r.dispose();
      taller.r.forceContextLoss();
    }
    renderer.dispose();
    renderer.forceContextLoss();
    raiz.remove();
  };
  function tecla(e: KeyboardEvent) {
    if (e.key === '0') {
      verEntera();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 6) {
      elegirRanura(ORDEN[n - 1]);
      return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      const lista = piezasDe(ranura);
      const ahora = lista.findIndex((p) => p.id === (prueba?.id ?? o.hangar.montadas[ranura]));
      probar(lista[(ahora + (e.code === 'ArrowRight' ? 1 : lista.length - 1)) % lista.length].id);
      return;
    }
    if (e.code === 'Enter') {
      e.preventDefault();
      if (prueba && (fabricada(o.hangar, prueba) || !faltaPara(o.hangar, prueba, o.chatarra()))) confirmar();
      return;
    }
    if (e.code !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    cerrar();
    o.volver();
  }
  q('.hv__entera').addEventListener('click', verEntera);
  q('.hv__cerrar').addEventListener('click', () => {
    cerrar();
    o.volver();
  });
  if (o.lanzar) {
    q('.hv__lanzar').addEventListener('click', () => {
      cerrar();
      o.lanzar!();
    });
  }
  window.addEventListener('keydown', tecla, true);
  return cerrar;
}
