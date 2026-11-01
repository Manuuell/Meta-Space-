import * as THREE from 'three';
import { COMPANEROS, estiloBruno, type FormaAda, type PerfilCompanero } from './companeros';
import type { OpcionesPerro } from './modelos/perro';
import { Dron } from './dron';

// Selector de compañero: una tarjeta por compañero con su retrato en 3D (se
// dibuja una vez, fuera de pantalla), su ataque y su habilidad.

const CSS = `
.cp-fondo { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px;
  background: rgba(8, 10, 26, .78); backdrop-filter: blur(4px); font-family: Rubik, system-ui, sans-serif; }
.cp-panel { width: min(1080px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 22px;
  background: #1b1f35; border: 2px solid rgba(255,255,255,.08); box-shadow: 0 10px 0 rgba(8,10,24,.5); padding: 22px; color: #fff; }
.cp-cabecera { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.cp-cabecera h2 { margin: 0; font-size: 26px; font-weight: 900; }
.cp-cabecera p { margin: 0; color: #aab0cf; font-size: 14px; }
.cp-rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.cp-tarjeta { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; border-radius: 16px;
  background: #252a45; border: 2px solid rgba(255,255,255,.07); overflow: hidden; transition: transform .12s, border-color .12s; }
.cp-tarjeta:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.25); }
.cp-tarjeta:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.cp-tarjeta[aria-pressed="true"] { border-color: var(--c); box-shadow: 0 0 0 2px var(--c) inset; }
.cp-retrato { height: 150px; background: radial-gradient(circle at 50% 70%, #3a4170, #20243d 70%); display: grid; place-items: center; }
.cp-retrato img { height: 150px; width: 150px; object-fit: contain; }
.cp-retrato span { color: #6c7299; font-size: 12px; }
.cp-cuerpo { padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.cp-cuerpo b { font-size: 17px; color: var(--c); }
.cp-quien { color: #c9cde4; font-size: 13px; line-height: 1.35; margin: 0; }
.cp-dato { font-size: 12.5px; line-height: 1.35; color: #e8eaf6; margin: 0; }
.cp-dato small { display: block; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #8e95bd; font-size: 10.5px; }
.cp-elegido { align-self: flex-start; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: var(--c); color: #141629; }
.cp-celda { display: flex; flex-direction: column; gap: 6px; }
.cp-celda .cp-tarjeta { flex: 1; }
.cp-estilo { display: flex; gap: 6px; flex-wrap: wrap; }
.cp-estilo button { all: unset; cursor: pointer; font-size: 12px; font-weight: 800; padding: 5px 10px; border-radius: 99px;
  background: #252a45; border: 2px solid rgba(255,255,255,.12); color: #c9cde4; }
.cp-estilo button[aria-pressed="true"] { background: #2fb3a3; border-color: #2fb3a3; color: #0f1a24; }
.cp-estilo button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.cp-pie { display: flex; justify-content: flex-end; margin-top: 16px; }
.cp-listo { all: unset; cursor: pointer; padding: 10px 22px; border-radius: 99px; font-weight: 900; background: linear-gradient(#5fe3a4, #28ad7a); color: #fff; }
.cp-listo:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
@media (max-width: 520px) { .cp-panel { padding: 14px; } .cp-rejilla { grid-template-columns: 1fr 1fr; } .cp-retrato, .cp-retrato img { height: 110px; } .cp-retrato img { width: 110px; } .cp-quien { display: none; } }
`;

let estiloPuesto = false;
const retratos = new Map<FormaAda, string>();

/** Dibuja los retratos que falten, con un renderer temporal fuera de pantalla. */
function pintarRetratos() {
  if (retratos.size === COMPANEROS.length) return;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(300, 300);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  for (const perfil of COMPANEROS) {
    if (retratos.has(perfil.id)) continue;
    const escena = new THREE.Scene();
    escena.add(new THREE.HemisphereLight('#e4ecff', '#4b4252', 1.5));
    const sol = new THREE.DirectionalLight('#fff3df', 2.4);
    sol.position.set(3, 6, 5);
    escena.add(sol);
    let objeto: THREE.Object3D;
    if (perfil.crear) {
      const modelo = perfil.crear();
      objeto = modelo.raiz;
      escena.add(objeto);
      // Pose de reposo, un poco avanzada para que no salga rígida.
      const mezclador = new THREE.AnimationMixer(objeto);
      const reposo = modelo.animaciones.find((a) => a.clip.name === 'Reposo');
      if (reposo) { mezclador.clipAction(reposo.clip).play(); mezclador.update(0.4); }
    } else {
      const dron = new Dron(escena, () => 0);
      objeto = dron.group;
      objeto.position.set(0, 0, 0);
    }
    objeto.rotation.y = 0.45;
    objeto.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(objeto);
    const centro = caja.getCenter(new THREE.Vector3());
    const lado = Math.max(...caja.getSize(new THREE.Vector3()).toArray());
    camara.position.set(centro.x + lado * 0.6, centro.y + lado * 0.45, centro.z + lado * 2.2);
    camara.lookAt(centro);
    renderer.render(escena, camara);
    retratos.set(perfil.id, renderer.domElement.toDataURL('image/png'));
  }
  renderer.dispose();
  renderer.forceContextLoss();
}

/** Botones de estilo de Bruno: gorra, gafas y pajarita (cuadros → verde → sin). */
function botonesEstilo() {
  const paj = estiloBruno.pajarita;
  return `<div class="cp-estilo" role="group" aria-label="Estilo de Bruno">
    <button type="button" data-estilo="gorra" aria-pressed="${estiloBruno.gorra}">Gorra</button>
    <button type="button" data-estilo="gafas" aria-pressed="${estiloBruno.gafas}">Gafas</button>
    <button type="button" data-estilo="pajarita" aria-pressed="${paj !== null}">Pajarita${paj === 'cuadros' ? ': cuadros' : paj === 'verde' ? ': verde' : ''}</button>
  </div>`;
}

function tarjeta(p: PerfilCompanero, actual: FormaAda) {
  const elegido = p.id === actual;
  const color = p.color;
  const img = retratos.get(p.id);
  const boton = `<button type="button" class="cp-tarjeta" data-id="${p.id}" aria-pressed="${elegido}" style="--c:${color}">
    <div class="cp-retrato">${img ? `<img src="${img}" alt="" />` : '<span>…</span>'}</div>
    <div class="cp-cuerpo">
      ${elegido ? '<span class="cp-elegido">Contigo</span>' : ''}
      <b>${p.nombre}</b>
      <p class="cp-quien">${p.quien}</p>
      <p class="cp-dato"><small>Ataque · ${p.ataque.nombre}</small>${p.ataque.texto}</p>
      <p class="cp-dato"><small>Habilidad · ${p.habilidad.nombre} · cada ${p.habilidad.cada} s</small>${p.habilidad.texto}</p>
    </div>
  </button>`;
  return `<div class="cp-celda">${boton}${p.id === 'bruno' ? botonesEstilo() : ''}</div>`;
}

/**
 * Abre el selector. `elegir` se llama al pulsar una tarjeta (el cambio es
 * inmediato); `alCerrar` cuando se cierra con Listo, Escape o clic fuera.
 */
export function abrirSelectorCompanero(
  actual: FormaAda,
  elegir: (id: FormaAda) => void,
  alCerrar?: () => void,
  alEstilo?: (e: Partial<OpcionesPerro>) => void,
) {
  if (!estiloPuesto) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    estiloPuesto = true;
  }
  try { pintarRetratos(); } catch { /* sin WebGL extra: tarjetas sin retrato */ }

  const previo = document.activeElement as HTMLElement | null;
  const fondo = document.createElement('div');
  fondo.className = 'cp-fondo';
  let elegido = actual;
  const pintar = () => {
    fondo.innerHTML = `<section class="cp-panel" role="dialog" aria-modal="true" aria-labelledby="cp-titulo">
      <div class="cp-cabecera">
        <h2 id="cp-titulo">Elige compañero</h2>
        <p>Todos siguen, escanean, obedecen tu voz, atacan solos y tienen una habilidad.</p>
      </div>
      <div class="cp-rejilla">${COMPANEROS.map((p) => tarjeta(p, elegido)).join('')}</div>
      <div class="cp-pie"><button type="button" class="cp-listo">Listo</button></div>
    </section>`;
    for (const b of fondo.querySelectorAll<HTMLButtonElement>('.cp-tarjeta')) {
      b.addEventListener('click', () => {
        elegido = b.dataset.id as FormaAda;
        elegir(elegido);
        pintar();
        fondo.querySelector<HTMLButtonElement>(`.cp-tarjeta[data-id="${elegido}"]`)?.focus();
      });
    }
    for (const b of fondo.querySelectorAll<HTMLButtonElement>('.cp-estilo button')) {
      b.addEventListener('click', () => {
        const que = b.dataset.estilo!;
        const cambio: Partial<OpcionesPerro> = que === 'gorra' ? { gorra: !estiloBruno.gorra }
          : que === 'gafas' ? { gafas: !estiloBruno.gafas }
          : { pajarita: estiloBruno.pajarita === 'cuadros' ? 'verde' : estiloBruno.pajarita === 'verde' ? null : 'cuadros' };
        alEstilo?.(cambio);
        // Si alguien elige estilo, es que quiere a Bruno.
        if (elegido !== 'bruno') { elegido = 'bruno'; elegir('bruno'); }
        retratos.delete('bruno');
        try { pintarRetratos(); } catch { /* sin retrato */ }
        pintar();
        fondo.querySelector<HTMLButtonElement>(`.cp-estilo button[data-estilo="${que}"]`)?.focus();
      });
    }
    fondo.querySelector('.cp-listo')!.addEventListener('click', cerrar);
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    }
    // Que las teclas del título (A, Enter…) no se disparen debajo.
    e.stopImmediatePropagation();
  };
  function cerrar() {
    window.removeEventListener('keydown', tecla, true);
    fondo.remove();
    if (previo?.isConnected) previo.focus();
    alCerrar?.();
  }
  fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(); });
  window.addEventListener('keydown', tecla, true);
  pintar();
  document.body.appendChild(fondo);
  fondo.querySelector<HTMLButtonElement>('.cp-tarjeta[aria-pressed="true"]')?.focus();
  return cerrar;
}
