import * as THREE from 'three';
import { crearAmara } from '../modelos/amara.ts';
import { crearIdris } from '../modelos/idris.ts';
import { crearMara } from '../modelos/mara.ts';
import { crearNoa } from '../modelos/noa.ts';
import { EJEMPLOS } from './ejemplos.ts';
import { crearHeroe } from './montar.ts';
import { CATALOGO, normalizarReceta, type Categoria } from './receta.ts';

// META SPACE — Hojas de revisión de la forja (solo desarrollo, /heroes.html): los
// ejemplos en fila, ?comparar=1 frente a los operadores hechos a mano y
// ?catalogo=pelo,tocado para ver cada pieza. También ?giro=2.7, ?clip=Correr y ?t=0.2.

const CSS = `
*, *::before, *::after { box-sizing: border-box; }
body { color: #f4efe8; font-family: 'Rubik', ui-rounded, system-ui, sans-serif; overflow: hidden;
  background: radial-gradient(120% 90% at 66% 34%, #2b2558 0%, #151335 46%, #0b0a1d 100%); }
.fh-lienzo { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
.fh-rotulo { position: fixed; transform: translateX(-50%); text-align: center; pointer-events: none; width: 310px; }
.fh-rotulo b { display: block; font-size: 17px; font-weight: 900; text-shadow: 0 2px 0 #0b0a1d; }
.fh-rotulo span { display: block; margin-top: 2px; font-size: 12px; line-height: 1.25; font-weight: 500; color: #c6cbe0; text-shadow: 0 1px 0 #0b0a1d; }
`;

const estilo = document.createElement('style');
estilo.textContent = CSS;
document.head.appendChild(estilo);

const lienzo = document.createElement('canvas');
lienzo.className = 'fh-lienzo';
document.body.appendChild(lienzo);

const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
render.shadowMap.enabled = true;
render.shadowMap.type = THREE.PCFSoftShadowMap;

const escena = new THREE.Scene();
escena.add(new THREE.HemisphereLight('#f4ecff', '#4b4266', 1.7));
const sol = new THREE.DirectionalLight('#fff3df', 2.5);
sol.position.set(4, 9, 7);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -14, right: 14, top: 12, bottom: -8, far: 40 });
escena.add(sol);

const reloj = new THREE.Clock();

montarHoja();

function ajustar(camara: THREE.PerspectiveCamera | THREE.OrthographicCamera, alRedimensionar?: () => void) {
  const f = () => {
    render.setSize(window.innerWidth, window.innerHeight, false);
    if (camara instanceof THREE.PerspectiveCamera) {
      camara.aspect = window.innerWidth / window.innerHeight;
      camara.updateProjectionMatrix();
    }
    alRedimensionar?.();
  };
  window.addEventListener('resize', f);
  f();
}

// ------------------------------------------------- los ejemplos, uno al lado del otro

function montarHoja() {
  const ajustes = new URLSearchParams(location.search);
  // Con ?comparar=1, cuatro hechos a mano arriba y cuatro creados debajo.
  const comparar = ajustes.has('comparar');
  const aMano = comparar ? [crearIdris(), crearAmara(), crearMara(), crearNoa()].map((modelo) => ({ modelo, nombre: modelo.nombre, pie: 'Hecho a mano' })) : [];
  const elegidos = comparar ? [1, 2, 4, 8].map((i) => EJEMPLOS[i]) : EJEMPLOS;
  // Con ?catalogo=pelo,tocado, cada pieza de esas categorías sobre el mismo héroe.
  const categorias = ajustes.get('catalogo')?.split(',') as Categoria[] | undefined;
  const piezas = (categorias ?? []).flatMap((c) => Object.keys(CATALOGO[c]).filter((id) => id !== 'nada').map((id) => {
    const r = normalizarReceta({ ...EJEMPLOS[0].receta, silueta: 'atletico', cabeza: 'cara', pelo: 'corto', tocado: 'nada', rostro: 'nada', vello: 'nada', torso: 'traje', piernas: 'pantalon', brazos: 'mangas', hombros: 'nada', espalda: 'nada', mano: 'nada', emblema: 'nada', colores: { principal: '#3a76e0', secundario: '#e8d27a', acento: '#ff8a3d', piel: '#e8b48c', pelo: '#b0522a', luz: '#5ee0ff' }, [c]: id })!;
    return { modelo: crearHeroe(r), nombre: id, pie: c };
  }));
  const lista = categorias ? piezas : [...aMano, ...elegidos.map(({ pedido, receta }) => ({ modelo: crearHeroe(receta), nombre: receta.nombre, pie: comparar ? 'Diseñado por la IA' : pedido }))];
  const giro = Number(ajustes.get('giro') ?? -0.42), nombreClip = ajustes.get('clip') ?? 'Reposo', instante = ajustes.get('t');
  const columnas = categorias ? 9 : 4, ancho = categorias ? 4.3 : 4.7, alto = categorias ? 5 : 5.3;
  const filas = Math.ceil(lista.length / columnas);
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  const mezclas: THREE.AnimationMixer[] = [];
  const rotulos: { el: HTMLElement; p: THREE.Vector3 }[] = [];
  lista.forEach(({ modelo: m, nombre, pie }, i) => {
    const x = (i % columnas - (columnas - 1) / 2) * ancho, y = ((filas - 1) / 2 - Math.floor(i / columnas)) * alto - 1.55;
    m.raiz.position.set(x, y, 0);
    m.raiz.rotation.y = giro;
    escena.add(m.raiz);
    const mezcla = new THREE.AnimationMixer(m.raiz);
    mezcla.clipAction(m.animaciones.find((a) => a.clip.name === nombreClip)!.clip).play();
    mezcla.update(instante ? Number(instante) : i * 0.31);
    mezclas.push(mezcla);
    const el = document.createElement('div');
    el.className = 'fh-rotulo';
    el.innerHTML = `<b>${nombre}</b><span>${pie}</span>`;
    document.body.appendChild(el);
    rotulos.push({ el, p: new THREE.Vector3(x, y - 0.14, 0) });
  });
  const colocar = () => {
    const a = window.innerWidth / window.innerHeight;
    const v = Math.max((filas * alto) / 2, (columnas * ancho) / 2 / a);
    camara.left = -v * a; camara.right = v * a; camara.top = v; camara.bottom = -v;
    camara.position.set(0, 2.2, 30);
    camara.lookAt(0, 0, 0);
    camara.updateProjectionMatrix();
    camara.updateMatrixWorld();
    for (const { el, p } of rotulos) {
      const q = p.clone().project(camara);
      el.style.left = `${((q.x + 1) / 2) * window.innerWidth}px`;
      el.style.top = `${((1 - q.y) / 2) * window.innerHeight}px`;
    }
  };
  ajustar(camara, colocar);
  render.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 1 / 20);
    if (!instante) for (const m of mezclas) m.update(dt);
    render.render(escena, camara);
  });
  (window as unknown as Record<string, unknown>).__hoja = true;
}
