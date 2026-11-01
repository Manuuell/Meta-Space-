import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { CATALOGO, type Modelo } from './index';

// Imágenes de referencia y GLB para pasárselos a otra IA de modelos 3D (solo
// desarrollo, /referencias.html). Fondo neutro, cámara ortográfica y luz que
// sigue a la cámara, para que todas las vistas se lean igual.
//
//   ?modelo=recolector&vista=frente|tres-cuartos|lado|espalda
//   ?modelo=recolector&vista=hoja        → frente, lado, espalda y 3/4 en una fila
//   ?vista=grupo                         → los tres juntos (referencia de estilo)
//   ?glb=recolector                      → GLB en base64 dentro de <pre id="glb">
//
// Al terminar, el título de la página pasa a «listo».

const params = new URLSearchParams(location.search);
const lienzo = document.getElementById('lienzo') as HTMLCanvasElement;
const etiquetas = document.getElementById('etiquetas')!;

const VISTAS: Record<string, { az: number; el: number; nombre: string }> = {
  frente: { az: 0, el: 6, nombre: 'FRENTE' },
  'tres-cuartos': { az: 35, el: 12, nombre: '3/4' },
  lado: { az: 90, el: 4, nombre: 'LADO' },
  espalda: { az: 180, el: 6, nombre: 'ESPALDA' },
};

/** El astronauta va en pose A: es lo que esperan los rigs automáticos. */
function posar(modelo: Modelo) {
  if (modelo.id !== 'astronauta') return;
  modelo.raiz.getObjectByName('hombro_i')!.rotation.z = THREE.MathUtils.degToRad(40);
  modelo.raiz.getObjectByName('hombro_d')!.rotation.z = THREE.MathUtils.degToRad(-40);
}

function crear(id: string): Modelo {
  const m = CATALOGO.find((c) => c.id === id)!.crear();
  posar(m);
  m.raiz.updateMatrixWorld(true);
  return m;
}

const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setScissorTest(true);
const escena = new THREE.Scene();
escena.background = new THREE.Color('#e4e7ef');
escena.add(new THREE.HemisphereLight('#ffffff', '#8a8fa3', 1.7));
const luz = new THREE.DirectionalLight('#ffffff', 2.2);
escena.add(luz, luz.target);

/** Cámara ortográfica que encuadra la caja `caja` desde el ángulo dado. */
function camaraPara(caja: THREE.Box3, az: number, el: number, aspecto: number): THREE.OrthographicCamera {
  const centro = caja.getCenter(new THREE.Vector3());
  const tam = caja.getSize(new THREE.Vector3());
  const radioPlano = Math.hypot(tam.x, tam.z) / 2;
  const medioAlto = Math.max(tam.y / 2, radioPlano / aspecto) * 1.12;
  const cam = new THREE.OrthographicCamera(-medioAlto * aspecto, medioAlto * aspecto, medioAlto, -medioAlto, 0.1, 100);
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  cam.position.set(centro.x + Math.sin(a) * Math.cos(e) * 20, centro.y + Math.sin(e) * 20, centro.z + Math.cos(a) * Math.cos(e) * 20);
  cam.lookAt(centro);
  // La luz sigue a la cámara (arriba a la izquierda), así la espalda no sale a oscuras.
  luz.position.copy(cam.position).add(new THREE.Vector3(-6, 10, 0).applyQuaternion(cam.quaternion));
  luz.target.position.copy(centro);
  return cam;
}

function pintar(ancho: number, alto: number, celdas: { x: number; ancho: number; cam: THREE.Camera }[]) {
  renderer.setSize(ancho, alto, false);
  lienzo.style.width = `${ancho}px`;
  lienzo.style.height = `${alto}px`;
  for (const c of celdas) {
    renderer.setViewport(c.x, 0, c.ancho, alto);
    renderer.setScissor(c.x, 0, c.ancho, alto);
    renderer.render(escena, c.cam);
  }
}

function etiquetar(nombres: string[]) {
  etiquetas.replaceChildren(...nombres.map((n) => Object.assign(document.createElement('span'), { textContent: n })));
}

async function exportarGlb(id: string) {
  const m = CATALOGO.find((c) => c.id === id)!.crear();
  m.raiz.traverse((o) => { if (o.userData.contorno) o.visible = false; });
  const datos = await new GLTFExporter().parseAsync(m.raiz, { binary: true, animations: m.animaciones.map((a) => a.clip) });
  const bytes = new Uint8Array(datos as ArrayBuffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const pre = document.createElement('pre');
  pre.id = 'glb';
  pre.textContent = btoa(bin);
  document.body.append(pre);
}

async function principal() {
  const glb = params.get('glb');
  if (glb) {
    await exportarGlb(glb);
  } else if (params.get('vista') === 'grupo') {
    const modelos = CATALOGO.map((c) => crear(c.id));
    const ancho = 520, alto = 760;
    for (const m of modelos) escena.add(m.raiz);
    const cajas = modelos.map((m) => new THREE.Box3().setFromObject(m.raiz));
    // Misma escala para los tres: se ve el tamaño real de cada uno.
    const altoMax = Math.max(...cajas.map((c) => c.max.y - c.min.y));
    renderer.setSize(ancho * modelos.length, alto, false);
    lienzo.style.width = `${ancho * modelos.length}px`;
    lienzo.style.height = `${alto}px`;
    modelos.forEach((m, i) => {
      for (const o of modelos) o.raiz.visible = o === m;
      const caja = cajas[i].clone();
      caja.max.y = caja.min.y + altoMax;
      renderer.setViewport(i * ancho, 0, ancho, alto);
      renderer.setScissor(i * ancho, 0, ancho, alto);
      renderer.render(escena, camaraPara(caja, 30, 10, ancho / alto));
    });
    etiquetar(modelos.map((m) => m.nombre.toUpperCase()));
  } else {
    const m = crear(params.get('modelo') ?? 'astronauta');
    escena.add(m.raiz);
    const caja = new THREE.Box3().setFromObject(m.raiz);
    const vista = params.get('vista') ?? 'frente';
    if (vista === 'hoja') {
      const orden = ['frente', 'lado', 'espalda', 'tres-cuartos'];
      const celda = 520, alto = 760;
      pintar(celda * 4, alto, orden.map((v, i) => ({
        x: i * celda, ancho: celda, cam: camaraPara(caja, VISTAS[v].az, VISTAS[v].el, celda / alto),
      })));
      etiquetar(orden.map((v) => VISTAS[v].nombre));
    } else {
      const tam = Number(params.get('tam') ?? 1024);
      const v = VISTAS[vista];
      pintar(tam, tam, [{ x: 0, ancho: tam, cam: camaraPara(caja, v.az, v.el, 1) }]);
    }
  }
  document.title = 'listo';
}

void principal();
