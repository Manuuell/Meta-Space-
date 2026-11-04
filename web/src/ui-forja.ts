import './ui-astillero.css';
import './ui-forja.css';
import * as THREE from 'three';
import { sfx } from './audio.ts';
import { crearPost, type AcabadoImagen } from './cinematica-post.ts';
import { WEAPONS } from './data.ts';
import { EJEMPLOS } from './heroe3d/ejemplos.ts';
import { fichaHeroe } from './heroe3d/ficha.ts';
import { crearHeroe } from './heroe3d/montar.ts';
import { CATALOGO, COLORES, normalizarReceta, recetaLocal, type Categoria, type Colores, type Receta } from './heroe3d/receta.ts';
import { postIa } from './ia';
import { crearHangar } from './modelos/hangar.ts';
import type { Modelo } from './modelos/kit.ts';
import { crearEntorno } from './modelos/nave-modular.ts';
import { PERSONAJE_POR_ID, type PersonajeId } from './personajes.ts';

// META SPACE — La forja de héroes: el astillero de los personajes. El héroe manda:
// ocupa la pantalla sobre la plataforma y se elige tocándolo. Se le puede escribir a
// la IA cómo se quiere (Muse Spark devuelve una receta, ver heroe3d/receta.ts) y
// retocarlo después a mano. Cada pieza cambia el modelo al momento, con su miniatura
// 3D, y la ficha enseña qué se gana y qué se pierde.

export interface OpcionesForja {
  /** El héroe guardado, si lo hay. */
  receta: Receta | null;
  usar: (receta: Receta, retrato: string) => void;
  volver: () => void;
}

type IdParte = 'oficio' | 'cuerpo' | 'cabeza' | 'ropa' | 'equipo' | 'colores';

interface Parte {
  id: IdParte; nombre: string; color: string; categorias: readonly Categoria[];
  /** Encuadre: giro y alzado, distancia en altos del héroe y altura del foco. */
  toma: { giro: number; alzado: number; distancia: number; foco: number };
  /** Nodo sobre el que va su pin; sin él, la parte no tiene pin. */
  nodo?: string;
}

const PARTES: readonly Parte[] = [
  { id: 'oficio', nombre: 'Oficio', color: '#ffd27a', categorias: ['oficio'], toma: { giro: 0.5, alzado: 0.1, distancia: 3.9, foco: 0.46 } },
  { id: 'cuerpo', nombre: 'Cuerpo', color: '#7df0a6', categorias: ['silueta', 'andar'], toma: { giro: 0.8, alzado: 0.08, distancia: 3.9, foco: 0.46 }, nodo: 'rodilla_i' },
  { id: 'cabeza', nombre: 'Cabeza', color: '#5ee0ff', categorias: ['cabeza', 'pelo', 'tocado', 'rostro', 'vello'], toma: { giro: 0.3, alzado: 0.1, distancia: 1.5, foco: 0.84 }, nodo: 'cabeza' },
  { id: 'ropa', nombre: 'Ropa', color: '#ff9a85', categorias: ['torso', 'piernas', 'brazos', 'hombros', 'emblema'], toma: { giro: 0.5, alzado: 0.08, distancia: 2.5, foco: 0.46 }, nodo: 'ada' },
  { id: 'equipo', nombre: 'Equipo', color: '#c79bff', categorias: ['espalda', 'mano'], toma: { giro: 2.5, alzado: 0.12, distancia: 2.9, foco: 0.56 }, nodo: 'puno_d' },
  { id: 'colores', nombre: 'Colores', color: '#ff7a45', categorias: [], toma: { giro: 0.4, alzado: 0.1, distancia: 3.9, foco: 0.46 } },
];

const NOMBRES: Record<Categoria, string> = {
  oficio: 'Oficio', silueta: 'Silueta', andar: 'Forma de andar', cabeza: 'Cabeza', pelo: 'Pelo', tocado: 'Tocado', rostro: 'Rostro', vello: 'Barba',
  torso: 'Torso', piernas: 'Piernas', brazos: 'Brazos', hombros: 'Hombros', emblema: 'Emblema', espalda: 'Espalda', mano: 'En la mano',
};

/** Qué enseña la miniatura de cada categoría: [altura del foco, distancia, giro]. En las de cabeza, distancia en metros. */
const FOTO: Record<Categoria, readonly [number, number, number]> = {
  oficio: [0.5, 3, 0.5], silueta: [0.5, 2.9, 0.5], andar: [0.5, 2.9, 0.5], cabeza: [0, 4.2, 0.4], pelo: [0, 4.4, 0.7], tocado: [0, 5.2, 0.4], rostro: [0, 3.6, 0.3], vello: [0, 3.6, 0.3],
  torso: [0.5, 1.6, 0.4], piernas: [0.18, 1.5, 0.4], brazos: [0.48, 1.8, 0.8], hombros: [0.62, 1.5, 0.5], emblema: [0.56, 1.1, 0.2], espalda: [0.56, 2.3, 2.7], mano: [0.42, 2.2, -0.6],
};

const POSES = ['Reposo', 'Caminar', 'Correr', 'Saltar', 'Habilidad', 'Victoria'] as const;
const NOMBRE_POSE: Record<string, string> = { Reposo: 'Quieto', Caminar: 'Andar', Correr: 'Correr', Saltar: 'Saltar', Habilidad: 'Habilidad', Victoria: 'Victoria' };
const COLOR_NOMBRE: Record<keyof Colores, string> = { principal: 'Principal', secundario: 'Secundario', acento: 'Acento', piel: 'Piel', pelo: 'Pelo', luz: 'Luz' };

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const mayuscula = (t: string) => t[0].toUpperCase() + t.slice(1);

export function abrirForja(o: OpcionesForja): () => void {
  const raiz = document.createElement('div');
  raiz.className = 'hv fj';
  raiz.innerHTML = `
    <canvas class="hv__lienzo" aria-label="Tu héroe. Arrastra para girarlo."></canvas>
    <div class="hv__pines"></div>
    <header class="hv__cabecera">
      <div class="hv__placa">
        <span class="hv__clase" data-c="S"></span>
        <div><small>FORJA DE HÉROES</small><h1></h1><em class="hv__estado"></em></div>
        <button type="button" class="hv__entera">Ver héroe entero <kbd>0</kbd></button>
      </div>
      <button type="button" class="hv__cerrar" aria-label="Volver">×</button>
    </header>
    <aside class="hv__vuelo">
      <h2>Ficha del héroe</h2>
      <div class="hv__medidas"></div>
      <div class="fj-kit"></div>
      <div class="fj-poses">${POSES.map((p) => `<button type="button" class="fj-pose" data-pose="${p}">${NOMBRE_POSE[p]}</button>`).join('')}</div>
      <p class="hv__ada ok"></p>
    </aside>
    <section class="hv__dique">
      <form class="fj-ia">
        <label for="fj-pedido">ADA</label>
        <input id="fj-pedido" type="text" maxlength="400" autocomplete="off" placeholder="Cuéntame cómo quieres a tu héroe…">
        <button type="submit">Diseñar con IA</button>
      </form>
      <nav class="hv__pestanas" role="tablist" aria-label="Partes del héroe"></nav>
      <div class="hv__fila">
        <div class="fj-grupo"><div class="fj-tipos"></div><div class="hv__cartas"></div></div>
        <div class="hv__accion"></div>
      </div>
    </section>`;
  document.body.appendChild(raiz);
  const q = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const lienzo = q<HTMLCanvasElement>('.hv__lienzo');

  // ------------------------------------------------------------- escena

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const post = crearPost(renderer);
  const escena = new THREE.Scene();
  escena.environment = crearEntorno(renderer);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  // La plataforma es para naves: a esta escala, un héroe se ve a su medida.
  const ESCALA = 0.15;
  const hangar = crearHangar();
  hangar.scale.setScalar(ESCALA);
  escena.add(hangar);
  escena.fog = new THREE.Fog('#7cc9a8', 24, 100);
  const SUELO = 0.63 * ESCALA;
  escena.add(new THREE.HemisphereLight('#f4ecff', '#3b5a5c', 1.25));
  const sol = new THREE.DirectionalLight('#fff0d8', 2);
  sol.position.set(5, 11, 8);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 7, bottom: -3, near: 1, far: 30 });
  sol.shadow.bias = -0.0005;
  const contra = new THREE.DirectionalLight('#7fe6ff', 1);
  contra.position.set(-6, 4, -7);
  escena.add(sol, contra);

  // Chispas al cambiar el héroe.
  const N = 90;
  const posC = new Float32Array(N * 3), velC = new Float32Array(N * 3), vidaC = new Float32Array(N);
  const geoC = new THREE.BufferGeometry();
  geoC.setAttribute('position', new THREE.BufferAttribute(posC, 3));
  const chispas = new THREE.Points(geoC, new THREE.PointsMaterial({ color: '#ffd28a', size: 0.07, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  chispas.frustumCulled = false;
  escena.add(chispas);
  const chispear = (y: number) => {
    for (let k = 0; k < N; k++) {
      posC.set([(Math.random() - 0.5) * 1.2, y * Math.random(), (Math.random() - 0.5) * 1.2], k * 3);
      const a = Math.random() * Math.PI * 2, v = 0.8 + Math.random() * 2;
      velC.set([Math.cos(a) * v, 1 + Math.random() * 2.4, Math.sin(a) * v], k * 3);
      vidaC[k] = 0.3 + Math.random() * 0.7;
    }
  };

  // ---------------------------------------------------------------- estado

  const muestra = EJEMPLOS[Math.floor(Math.random() * EJEMPLOS.length)]?.receta ?? recetaLocal('una mecánica bajita con llave');
  let receta: Receta = o.receta ?? muestra;
  /** Mientras es la muestra, lo que se escriba crea un héroe nuevo en vez de cambiarlo. */
  let esMuestra = !o.receta;
  let estado = esMuestra ? 'Héroe de muestra' : 'Tu héroe';
  let frase = esMuestra ? 'Cuéntame cómo lo quieres, o retócalo tú pieza a pieza.' : receta.frase || 'Aquí lo tienes. ¿Le cambiamos algo?';
  const historial: Receta[] = [];
  let parte: Parte = PARTES[2];
  let categoria: Categoria = 'cabeza';
  let modelo: Modelo | null = null, mezcla: THREE.AnimationMixer | null = null, accion: THREE.AnimationAction | null = null;
  let alto = 3, entrada = 1;

  const liberar = (obj: THREE.Object3D) => obj.traverse((n) => { if (n instanceof THREE.Mesh) n.geometry.dispose(); });

  const reproducir = (nombre: string) => {
    if (!modelo || !mezcla) return;
    const a = modelo.animaciones.find((x) => x.clip.name === nombre);
    if (!a) return;
    const nueva = mezcla.clipAction(a.clip);
    nueva.reset().setLoop(a.bucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    nueva.clampWhenFinished = !a.bucle;
    accion?.fadeOut(0.16);
    nueva.fadeIn(0.16).play();
    accion = nueva;
  };

  const montar = () => {
    if (modelo) {
      escena.remove(modelo.raiz);
      liberar(modelo.raiz);
    }
    modelo = crearHeroe(receta);
    modelo.raiz.position.y = SUELO;
    escena.add(modelo.raiz);
    mezcla = new THREE.AnimationMixer(modelo.raiz);
    mezcla.addEventListener('finished', () => reproducir('Reposo'));
    accion = null;
    reproducir('Reposo');
    modelo.raiz.updateMatrixWorld(true);
    alto = new THREE.Box3().setFromObject(modelo.raiz).getSize(new THREE.Vector3()).y;
    entrada = 0;
  };
  montar();

  // Cámara: cada parte tiene su encuadre; arrastrando se gira a mano.
  const c = { giro: 1, alzado: 0.12, distancia: 12, x: 0, y: 1.6, z: 0 };
  const meta = { ...c };
  let tocado = false, arrastre: { x: number; y: number } | null = null;
  const encuadrar = (p: Parte) => {
    const t = p.toma;
    const vueltas = Math.round((c.giro - t.giro) / (Math.PI * 2));
    Object.assign(meta, { giro: t.giro + vueltas * Math.PI * 2, alzado: t.alzado, distancia: t.distancia * alto, y: SUELO + alto * t.foco });
    tocado = p.id === 'cabeza';
  };
  const verEntero = () => {
    Object.assign(meta, { alzado: 0.1, distancia: 3.9 * alto, y: SUELO + alto * 0.46 });
    tocado = false;
  };
  lienzo.addEventListener('pointerdown', (e) => {
    arrastre = { x: e.clientX, y: e.clientY };
    tocado = true;
    lienzo.setPointerCapture(e.pointerId);
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    meta.giro -= (e.clientX - arrastre.x) * 0.008;
    meta.alzado = Math.max(-0.2, Math.min(1, meta.alzado + (e.clientY - arrastre.y) * 0.005));
    arrastre = { x: e.clientX, y: e.clientY };
  });
  lienzo.addEventListener('pointerup', () => { arrastre = null; });
  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    meta.distancia = Math.max(alto * 0.9, Math.min(alto * 5, meta.distancia * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive: false });

  // ------------------------------------------------------------ miniaturas

  // Una por fotograma: construir un héroe entero no es gratis y la pantalla no debe trabarse.
  let taller: { r: THREE.WebGLRenderer; e: THREE.Scene; c: THREE.PerspectiveCamera } | null = null;
  const crearTaller = () => {
    if (taller) return taller;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(220, 176, false);
    const e = new THREE.Scene();
    e.add(new THREE.HemisphereLight('#f4ecff', '#4b5a66', 1.7));
    const luz = new THREE.DirectionalLight('#fff0d8', 2.3);
    luz.position.set(3, 6, 6);
    e.add(luz);
    return (taller = { r, e, c: new THREE.PerspectiveCamera(26, 220 / 176, 0.1, 60) });
  };
  const foto = (r: Receta, [foco, dist, giro]: readonly [number, number, number]) => {
    const t = crearTaller();
    const m = crearHeroe(r);
    t.e.add(m.raiz);
    m.raiz.updateMatrixWorld(true);
    const h = new THREE.Box3().setFromObject(m.raiz).getSize(new THREE.Vector3()).y;
    const deCabeza = foco === 0;
    const y = deCabeza ? m.raiz.getObjectByName('cabeza')!.getWorldPosition(new THREE.Vector3()).y + 0.42 : h * foco;
    const lejos = deCabeza ? dist : dist * h;
    t.c.position.set(Math.sin(giro) * lejos, y + lejos * 0.05, Math.cos(giro) * lejos);
    t.c.lookAt(0, y, 0);
    t.r.render(t.e, t.c);
    t.e.remove(m.raiz);
    const url = t.r.domElement.toDataURL('image/png');
    liberar(m.raiz);
    return url;
  };
  /** Foto de la cabeza para el HUD y el menú, con el fondo transparente. */
  const retrato = () => {
    const t = crearTaller();
    t.r.setSize(192, 192, false);
    t.c.aspect = 1;
    t.c.updateProjectionMatrix();
    const m = crearHeroe(receta);
    t.e.add(m.raiz);
    m.raiz.updateMatrixWorld(true);
    const cabeza = m.raiz.getObjectByName('cabeza')!.getWorldPosition(new THREE.Vector3());
    const h = cabeza.y + 0.45;
    t.c.position.set(1.3, h + 0.2, 4.1);
    t.c.lookAt(0, h, 0);
    t.r.render(t.e, t.c);
    t.e.remove(m.raiz);
    const url = t.r.domElement.toDataURL('image/webp', 0.9);
    liberar(m.raiz);
    t.r.setSize(220, 176, false);
    t.c.aspect = 220 / 176;
    t.c.updateProjectionMatrix();
    return url;
  };
  const miniaturas = new Map<string, string>();
  let cola: { clave: string; r: Receta; cat: Categoria; img: HTMLImageElement }[] = [];

  // ---------------------------------------------------------------- paneles

  const pines = q('.hv__pines');
  const conPin = PARTES.filter((p) => p.nodo);
  pines.innerHTML = conPin.map((p) => `<button type="button" class="hv-pin" data-p="${p.id}" style="--c:${p.color}"><i>${PARTES.indexOf(p) + 1}</i><span>${p.nombre}</span></button>`).join('');
  const listaPines = [...pines.querySelectorAll<HTMLButtonElement>('.hv-pin')];
  listaPines.forEach((b) => b.addEventListener('click', () => elegirParte(PARTES.find((p) => p.id === b.dataset.p)!)));

  function elegirParte(p: Parte) {
    parte = p;
    categoria = p.categorias[0] ?? categoria;
    encuadrar(p);
    pintarTodo();
  }

  const ficha = () => fichaHeroe(receta, '');
  /** La ficha de antes del último cambio, para enseñar qué se ha ganado y perdido. */
  let fichaAntes = ficha();

  const pintarCabecera = () => {
    q('.hv__clase').textContent = (receta.nombre[0] ?? '?').toUpperCase();
    q('.hv__placa h1').textContent = receta.nombre;
    q('.hv__estado').textContent = estado;
  };

  const pintarPestanas = () => {
    q('.hv__pestanas').innerHTML = PARTES.map((p, k) => {
      const valor = p.id === 'oficio' ? PERSONAJE_POR_ID[receta.oficio].rol
        : p.id === 'colores' ? 'Paleta del héroe'
        : mayuscula(String(receta[p.categorias[0]]));
      return `<button type="button" role="tab" aria-selected="${p === parte}" class="hv-pestana${p === parte ? ' activa' : ''}" data-p="${p.id}" style="--c:${p.color}">
        <i>${k + 1}</i><span><b>${p.nombre}</b><em>${esc(valor)}</em></span></button>`;
    }).join('');
    raiz.querySelectorAll<HTMLButtonElement>('.hv-pestana').forEach((b) => b.addEventListener('click', () => elegirParte(PARTES.find((p) => p.id === b.dataset.p)!)));
    for (const b of listaPines) b.classList.toggle('activo', b.dataset.p === parte.id);
  };

  const cartaOficio = (id: PersonajeId) => {
    const p = PERSONAJE_POR_ID[id];
    return { foto: p.retrato, titulo: p.rol, texto: `${WEAPONS[p.armaInicial].name}${p.habilidad ? ` · ${p.habilidad.nombre}` : ''}` };
  };

  const pintarCartas = () => {
    const tipos = q('.fj-tipos'), cartas = q('.hv__cartas');
    tipos.innerHTML = parte.categorias.length > 1
      ? parte.categorias.map((c) => `<button type="button" class="fj-tipo${c === categoria ? ' activo' : ''}" data-c="${c}">${NOMBRES[c]}</button>`).join('') : '';
    tipos.querySelectorAll<HTMLButtonElement>('.fj-tipo').forEach((b) => b.addEventListener('click', () => {
      categoria = b.dataset.c as Categoria;
      pintarCartas();
      pintarAccion();
    }));
    cola = [];
    if (parte.id === 'colores') {
      cartas.innerHTML = `<div class="fj-colores">${COLORES.map((c) => `<label class="fj-color">${COLOR_NOMBRE[c]}<input type="color" data-c="${c}" value="${receta.colores[c]}"></label>`).join('')}</div>`;
      cartas.querySelectorAll<HTMLInputElement>('input').forEach((i) => i.addEventListener('change', () => {
        aplicar({ ...receta, colores: { ...receta.colores, [i.dataset.c!]: i.value } });
      }));
      return;
    }
    const cat = CATALOGO[categoria] as Record<string, string>;
    cartas.innerHTML = Object.keys(cat).map((id) => {
      const elegida = String(receta[categoria]) === id;
      const prueba = normalizarReceta({ ...receta, [categoria]: id });
      const bloqueada = !prueba || String(prueba[categoria]) !== id;
      const oficio = categoria === 'oficio' ? cartaOficio(id as PersonajeId) : null;
      return `<button type="button" class="hv-carta${elegida ? ' elegida montada' : ''}${bloqueada ? ' bloqueada' : ''}" data-id="${esc(id)}" style="--c:${parte.color}"${bloqueada ? ' disabled' : ''}>
        <span class="hv-carta__foto"><img alt="" src="${oficio?.foto ?? ''}"></span>
        <span class="hv-carta__texto">
          <small>${elegida ? 'Puesta' : bloqueada ? 'No encaja' : 'Probar'}</small>
          <b>${esc(oficio?.titulo ?? mayuscula(id))}</b>
          <em>${esc(oficio?.texto ?? cat[id])}</em>
        </span>
      </button>`;
    }).join('');
    cartas.querySelectorAll<HTMLButtonElement>('.hv-carta').forEach((b) => {
      b.addEventListener('click', () => {
        const nueva = normalizarReceta({ ...receta, [categoria]: b.dataset.id! });
        if (nueva && String(receta[categoria]) !== b.dataset.id) {
          estado = 'Retocado a mano';
          aplicar(nueva);
        }
      });
      if (categoria === 'oficio') return;
      const id = b.dataset.id!, r = normalizarReceta({ ...receta, [categoria]: id });
      if (!r) return;
      const img = b.querySelector('img')!;
      const clave = `${JSON.stringify(receta.colores)}|${receta.silueta}|${receta.cabeza}|${receta.pelo}|${receta.torso}|${receta.espalda}|${categoria}|${id}`;
      const lista = miniaturas.get(clave);
      if (lista) img.src = lista;
      else cola.push({ clave, r, cat: categoria, img });
    });
    cartas.querySelector('.elegida')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const pintarAccion = () => {
    const a = q('.hv__accion');
    const id = String(receta[categoria]);
    const texto = parte.id === 'colores' ? 'Toca un color para cambiarlo. También puedes pedírselo a ADA.'
      : (CATALOGO[categoria] as Record<string, string>)[id] ?? '';
    const titulo = parte.id === 'colores' ? 'Paleta' : categoria === 'oficio' ? PERSONAJE_POR_ID[receta.oficio].rol : `${NOMBRES[categoria]}: ${mayuscula(id)}`;
    a.innerHTML = `<small>${esc(parte.nombre)}</small><h3>${esc(titulo)}</h3><p>${esc(mayuscula(texto))}</p>
      <div class="fj-botones"><button type="button" class="fj-deshacer"${historial.length ? '' : ' disabled'}>Deshacer</button><button type="button" class="fj-usar">Usar este héroe</button></div>`;
    a.querySelector('.fj-deshacer')!.addEventListener('click', deshacer);
    a.querySelector('.fj-usar')!.addEventListener('click', () => {
      const imagen = retrato();
      sfx('carga');
      cerrar();
      o.usar(receta, imagen);
    });
  };

  const pintarFicha = () => {
    const f = ficha();
    const filas = [
      ['Vida', f.stats.maxHp, fichaAntes.stats.maxHp, 60, 180, String(f.stats.maxHp)],
      ['Velocidad', f.stats.speed, fichaAntes.stats.speed, 4, 7, f.stats.speed.toFixed(1)],
      ['Daño', f.stats.damageMul, fichaAntes.stats.damageMul, 0.85, 1.35, `×${f.stats.damageMul.toFixed(2)}`],
      // Menos recarga es mejor: la barra crece al revés.
      ['Recarga', 2.1 - f.stats.cooldownMul, 2.1 - fichaAntes.stats.cooldownMul, 0.9, 1.25, `×${f.stats.cooldownMul.toFixed(2)}`],
    ] as const;
    q('.hv__medidas').innerHTML = filas.map(([nombre, v, b, min, max, txt]) => {
      const pct = (x: number) => Math.max(3, Math.min(100, ((x - min) / (max - min)) * 100));
      const baja = v < b, menor = Math.min(pct(v), pct(b));
      return `<div class="hv-medida ok"><span>${nombre}<b>${txt}</b></span><div class="hv-barra">
        <i class="base" style="width:${menor.toFixed(1)}%"></i>
        ${v !== b ? `<i class="cambio ${baja ? 'pierde' : 'gana'}" style="left:${menor.toFixed(1)}%;width:${Math.abs(pct(v) - pct(b)).toFixed(1)}%"></i>` : ''}
      </div></div>`;
    }).join('');
    q('.fj-kit').innerHTML = `
      <div><b>Arma inicial</b><strong>${esc(WEAPONS[f.armaInicial].name)}</strong></div>
      ${f.habilidad ? `<div><b>Habilidad</b><strong>${esc(f.habilidad.nombre)}</strong>: ${esc(f.habilidad.texto)}</div>` : ''}
      ${f.pasiva ? `<div><b>Pasiva</b><strong>${esc(f.pasiva.nombre)}</strong>: ${esc(f.pasiva.texto)}</div>` : ''}`;
    q('.hv__ada').textContent = `ADA: «${frase}»`;
  };

  function pintarTodo() {
    pintarCabecera();
    pintarPestanas();
    pintarCartas();
    pintarAccion();
    pintarFicha();
  }

  function aplicar(nueva: Receta, conHistorial = true) {
    if (conHistorial) historial.push(receta);
    fichaAntes = ficha();
    receta = nueva;
    esMuestra = false;
    montar();
    chispear(alto);
    sfx('pickup');
    pintarTodo();
  }
  function deshacer() {
    const previa = historial.pop();
    if (previa) aplicar(previa, false);
  }

  pintarTodo();
  setTimeout(() => { if (vivo) encuadrar(parte); }, 1100);

  const fila = q('.hv__cartas');
  fila.addEventListener('wheel', (e) => {
    if (fila.scrollWidth <= fila.clientWidth || e.deltaX) return;
    e.preventDefault();
    fila.scrollLeft += e.deltaY;
  }, { passive: false });

  // Barra de la IA.
  const form = q<HTMLFormElement>('.fj-ia'), pedido = q<HTMLInputElement>('#fj-pedido'), disenar = q<HTMLButtonElement>('.fj-ia button');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = pedido.value.trim();
    if (!texto || disenar.disabled) return;
    disenar.disabled = true;
    const antes = disenar.textContent;
    disenar.textContent = 'Diseñando…';
    const anterior = esMuestra ? null : receta;
    const r = await postIa<{ ok: boolean; receta?: unknown; source?: string }>('/api/heroe-receta', { texto, anterior }, 50000);
    if (!vivo) return;
    disenar.disabled = false;
    disenar.textContent = antes;
    const nueva = normalizarReceta(r?.receta) ?? recetaLocal(texto, anterior);
    const conIa = !!r?.receta && r.source === 'meta-spark';
    estado = conIa ? 'Diseñado con Muse Spark' : 'Receta local, sin IA';
    frase = nueva.frase;
    pedido.value = '';
    pedido.placeholder = 'Pídeme cambios: más alto, otra capa, ponle barba…';
    aplicar(nueva);
    verEntero();
    sfx('carga');
  });

  // ------------------------------------------------------------- fotograma

  const acabado: AcabadoImagen = {
    tiempo: 0, brillo: 0.1, umbral: 0.97, aberracion: 0.06, estatica: 0, tinte: new THREE.Color('#fff'), ondaX: 0.5, ondaY: 0.5, ondaRadio: 0, ondaFuerza: 0,
  };
  let W = 1, H = 1;
  const encajar = () => {
    W = raiz.clientWidth || innerWidth;
    H = raiz.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    post.medir(W, H);
    camara.aspect = W / H;
    camara.fov = W / H < 1 ? 42 : 30;
    if (W > 960) camara.setViewOffset(W, H, 150, 112, W, H);
    else camara.setViewOffset(W, H, 0, Math.round(H * 0.26), W, H);
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
    mezcla?.update(dt);
    if (!tocado) meta.giro += dt * 0.16;
    const k = 1 - Math.exp(-dt * 3.4);
    for (const n of ['giro', 'alzado', 'distancia', 'x', 'y', 'z'] as const) c[n] += (meta[n] - c[n]) * k;
    camara.position.set(c.x + Math.sin(c.giro) * Math.cos(c.alzado) * c.distancia, Math.max(0.3, c.y + Math.sin(c.alzado) * c.distancia), c.z + Math.cos(c.giro) * Math.cos(c.alzado) * c.distancia);
    camara.lookAt(c.x, c.y, c.z);
    camara.updateMatrixWorld();

    if (modelo && entrada < 1) {
      entrada = Math.min(1, entrada + dt * 3.4);
      modelo.raiz.scale.setScalar(0.72 + 0.28 * (1 - (1 - entrada) ** 3) + Math.sin(entrada * Math.PI) * 0.06);
    }
    for (let i = 0; i < N; i++) {
      if (vidaC[i] <= 0) { posC[i * 3 + 1] = -50; continue; }
      vidaC[i] -= dt;
      velC[i * 3 + 1] -= 5 * dt;
      for (let e = 0; e < 3; e++) posC[i * 3 + e] += velC[i * 3 + e] * dt;
    }
    geoC.attributes.position.needsUpdate = true;

    for (const b of listaPines) {
      const p = conPin.find((x) => x.id === b.dataset.p)!;
      const nodo = modelo?.raiz.getObjectByName(p.nodo!);
      if (!nodo) continue;
      nodo.getWorldPosition(v);
      // Encima de la cabeza: sobre la cara estorbaría.
      if (p.id === 'cabeza') v.y = SUELO + alto * 1.03;
      v.project(camara);
      // Sin meterse bajo la cabecera, por alto que sea el héroe.
      const x = (v.x + 1) / 2 * W, y = Math.max(104, (1 - v.y) / 2 * H);
      b.style.display = v.z < 1 ? '' : 'none';
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
    const siguiente = cola.shift();
    if (siguiente) {
      const url = foto(siguiente.r, FOTO[siguiente.cat]);
      miniaturas.set(siguiente.clave, url);
      siguiente.img.src = url;
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
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar();
      o.volver();
      return;
    }
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === '0') {
      verEntero();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= PARTES.length) elegirParte(PARTES[n - 1]);
  }
  q('.hv__entera').addEventListener('click', verEntero);
  q('.hv__cerrar').addEventListener('click', () => {
    cerrar();
    o.volver();
  });
  raiz.querySelectorAll<HTMLButtonElement>('.fj-pose').forEach((b) => b.addEventListener('click', () => reproducir(b.dataset.pose!)));
  window.addEventListener('keydown', tecla, true);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__forja = { get receta() { return receta; }, get modelo() { return modelo; }, aplicar };
  return cerrar;
}
