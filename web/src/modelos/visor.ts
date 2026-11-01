import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { CATALOGO, type Animacion, type Modelo } from './index';
import { medir } from './kit';
import { ALTURA_ADA } from './ada';

// Taller de modelos (solo desarrollo, /modelos.html): cada personaje con sus
// animaciones, para revisar el estilo antes de meterlo en el juego y
// exportarlo a GLB.

const lienzo = document.getElementById('lienzo') as HTMLCanvasElement;
const lista = document.getElementById('lista')!;
const panel = document.getElementById('panel')!;
const etiqueta = document.getElementById('etiqueta')!;

const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const escena = new THREE.Scene();
escena.background = new THREE.Color('#3a3f55');
const camara = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camara.position.set(2.3, 2.4, 5.9);
const controles = new OrbitControls(camara, lienzo);
controles.target.set(0, 1.1, 0);
controles.enableDamping = true;
controles.minDistance = 2;
controles.maxDistance = 14;

escena.add(new THREE.HemisphereLight('#e4ecff', '#4b4252', 1.4));
const sol = new THREE.DirectionalLight('#fff3df', 2.6);
sol.position.set(4, 8, 5);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
sol.shadow.bias = -0.0005;
escena.add(sol);

const suelo = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), new THREE.MeshToonMaterial({ color: '#474c63' }));
suelo.rotation.x = -Math.PI / 2;
suelo.receiveShadow = true;
escena.add(suelo);
const aro = new THREE.Mesh(
  new THREE.RingGeometry(1.3, 2.3, 64),
  new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.22, depthWrite: false }),
);
aro.rotation.x = -Math.PI / 2;
aro.position.y = 0.01;
escena.add(aro);

let modelo: Modelo | null = null;
let mezclador: THREE.AnimationMixer | null = null;
let accion: THREE.AnimationAction | null = null;
let actual: Animacion | null = null;
let velocidad = 1;
let pausa = false;
const reloj = new THREE.Clock();

function cargar(id: string) {
  if (modelo) escena.remove(modelo.raiz);
  modelo = CATALOGO.find((c) => c.id === id)!.crear();
  // Las formas flotantes de ADA tienen el origen en su centro: se ven en el aire.
  if (ALTURA_ADA[id]) modelo.raiz.position.y = 1.2;
  escena.add(modelo.raiz);
  mezclador = new THREE.AnimationMixer(modelo.raiz);
  for (const b of lista.querySelectorAll<HTMLButtonElement>('.modelo')) b.classList.toggle('activo', b.dataset.id === id);
  pintarPanel();
  reproducir(modelo.animaciones[0]);
}

function reproducir(a: Animacion) {
  if (!mezclador) return;
  mezclador.stopAllAction();
  accion = mezclador.clipAction(a.clip);
  accion.reset();
  accion.setLoop(a.bucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  accion.clampWhenFinished = true;
  accion.play();
  actual = a;
  etiqueta.innerHTML = '';
  etiqueta.append(a.clip.name);
  const tipo = document.createElement('span');
  tipo.textContent = a.bucle ? 'BUCLE' : 'UNA VEZ';
  etiqueta.append(tipo);
  for (const b of panel.querySelectorAll<HTMLButtonElement>('.clip')) b.classList.toggle('activo', b.dataset.clip === a.clip.name);
  const desc = panel.querySelector('.desc');
  if (desc) desc.textContent = a.descripcion;
  const meta = panel.querySelector('.meta-clip');
  if (meta) meta.textContent = `${a.clip.duration.toFixed(2)} s · ${Math.round(a.clip.duration * 30) + 1} fotogramas a 30 fps · ${a.bucle ? 'en bucle' : 'una vez'}`;
}

const GRUPOS: Record<Animacion['grupo'], string> = { movimiento: 'Movimiento', ataque: 'Acciones', reaccion: 'Reacciones' };

function pintarPanel() {
  if (!modelo) return;
  const m = medir(modelo.raiz);
  panel.innerHTML = `
    <h2></h2><p class="rol"></p>
    <div class="stats">
      <div><b>${m.mallas}</b><small>mallas</small></div>
      <div><b>${(m.triangulos / 1000).toFixed(1)}k</b><small>triángulos</small></div>
      <div><b>${m.alto.toFixed(2)} m</b><small>alto</small></div>
    </div>
    ${(Object.keys(GRUPOS) as Animacion['grupo'][]).map((g) => {
      const clips = modelo!.animaciones.filter((a) => a.grupo === g);
      return clips.length ? `<h3>${GRUPOS[g]}</h3><div class="botones">${clips.map((a) => `<button class="clip" data-clip="${a.clip.name}">${a.clip.name}</button>`).join('')}</div>` : '';
    }).join('')}
    <p class="desc"></p><p class="meta meta-clip"></p>
    <div class="barra"><i></i></div>
    <input type="range" class="tiempo" min="0" max="1" step="0.001" value="0" aria-label="Tiempo de la animación" />
    <h3>Reproducción</h3>
    <div class="botones">
      <button class="vel" data-vel="0">Pausa</button>
      <button class="vel" data-vel="0.25">¼×</button>
      <button class="vel" data-vel="0.5">½×</button>
      <button class="vel activo" data-vel="1">1×</button>
    </div>
    <h3>Vista</h3>
    <div class="opciones">
      <label><input type="checkbox" class="op-contorno" checked /> Contorno</label>
      <label><input type="checkbox" class="op-girar" /> Girar</label>
    </div>
    <h3>Exportar</h3>
    <button class="accion exportar">Descargar GLB (modelo + animaciones)</button>
    <p class="ayuda">Arrastra para orbitar · rueda para acercar · teclas 1–9 para las animaciones · espacio para pausar.</p>`;
  panel.querySelector('h2')!.textContent = modelo.nombre;
  panel.querySelector('.rol')!.textContent = modelo.rol;
  for (const b of panel.querySelectorAll<HTMLButtonElement>('.clip')) {
    b.addEventListener('click', () => reproducir(modelo!.animaciones.find((a) => a.clip.name === b.dataset.clip)!));
  }
  for (const b of panel.querySelectorAll<HTMLButtonElement>('.vel')) {
    b.addEventListener('click', () => ponerVelocidad(Number(b.dataset.vel)));
  }
  panel.querySelector<HTMLInputElement>('.tiempo')!.addEventListener('input', (ev) => {
    if (!accion || !actual || !mezclador) return;
    ponerVelocidad(0);
    accion.time = Number((ev.target as HTMLInputElement).value) * actual.clip.duration;
    accion.paused = false;
    mezclador.update(0);
  });
  panel.querySelector<HTMLInputElement>('.op-contorno')!.addEventListener('change', (ev) => {
    const ver = (ev.target as HTMLInputElement).checked;
    modelo?.raiz.traverse((o) => { if (o.userData.contorno) o.visible = ver; });
  });
  panel.querySelector<HTMLInputElement>('.op-girar')!.addEventListener('change', (ev) => {
    controles.autoRotate = (ev.target as HTMLInputElement).checked;
  });
  panel.querySelector('.exportar')!.addEventListener('click', exportar);
}

function ponerVelocidad(v: number) {
  pausa = v === 0;
  if (!pausa) velocidad = v;
  for (const b of panel.querySelectorAll<HTMLButtonElement>('.vel')) {
    b.classList.toggle('activo', pausa ? b.dataset.vel === '0' : Number(b.dataset.vel) === velocidad);
  }
}

/** GLB con el modelo en reposo y todas sus animaciones; sin los contornos. */
function exportar() {
  if (!modelo) return;
  const m = modelo;
  const contornos: THREE.Object3D[] = [];
  m.raiz.traverse((o) => { if (o.userData.contorno && o.visible) { contornos.push(o); o.visible = false; } });
  mezclador?.stopAllAction();
  new GLTFExporter().parse(m.raiz, (resultado) => {
    for (const o of contornos) o.visible = true;
    if (actual) reproducir(actual);
    const url = URL.createObjectURL(new Blob([resultado as ArrayBuffer], { type: 'model/gltf-binary' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-space-${m.id}.glb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, (err) => {
    for (const o of contornos) o.visible = true;
    console.error('No se pudo exportar el GLB', err);
  }, { binary: true, animations: m.animaciones.map((a) => a.clip) });
}

for (const c of CATALOGO) {
  const b = document.createElement('button');
  b.className = 'modelo';
  b.dataset.id = c.id;
  const nombre = document.createElement('b');
  nombre.textContent = c.nombre;
  b.append(nombre);
  b.addEventListener('click', () => cargar(c.id));
  lista.append(b);
}

window.addEventListener('keydown', (ev) => {
  if (!modelo) return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    ponerVelocidad(pausa ? velocidad : 0);
    return;
  }
  const n = Number(ev.key);
  if (n >= 1 && n <= modelo.animaciones.length) reproducir(modelo.animaciones[n - 1]);
});

function ajustar() {
  const { clientWidth: w, clientHeight: h } = lienzo.parentElement!;
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
}
new ResizeObserver(ajustar).observe(lienzo.parentElement!);

renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 1 / 20);
  if (mezclador && !pausa) mezclador.update(dt * velocidad);
  if (accion && actual) {
    const p = Math.min(1, (accion.time % actual.clip.duration) / actual.clip.duration || (accion.time >= actual.clip.duration ? 1 : 0));
    (panel.querySelector('.barra i') as HTMLElement | null)?.style.setProperty('width', `${p * 100}%`);
    if (!pausa) panel.querySelector<HTMLInputElement>('.tiempo')?.setAttribute('value', String(p));
  }
  controles.update();
  renderer.render(escena, camara);
});

cargar(CATALOGO[0].id);
