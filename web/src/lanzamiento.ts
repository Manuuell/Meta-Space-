import * as THREE from 'three';
import { ALTO_CASCO, crearEntorno, crearNaveModular } from './modelos/nave-modular.ts';
import { ALTO_PLATAFORMA, crearPlataforma } from './modelos/plataforma.ts';
import { PALETA, toon } from './modelos/kit.ts';
import { azar, planeta, punto, sonar, soplido, tono, tramo, velo } from './intro.ts';
import { tocarBanda } from './musica.ts';
import { VENTANA } from './cinematica-guion.ts';
import { crearPost, type AcabadoImagen } from './cinematica-post.ts';
import type { Diseno, Estadisticas, Fallo, Vuelo } from './nave/piezas.ts';

// META SPACE — El lanzamiento: la nave que armaste vuela de verdad.
//
// Es tu diseño, pieza a pieza, con la telemetría de una retransmisión real: reloj,
// altitud, velocidad y combustible. Cuenta atrás, chorros de la panza, recoge el
// tren, se pone de morro, encienden los motores, máxima presión, suelta los tanques,
// el velo y la firma de ADA. Si algo no da, falla justo ahí y por eso (ver
// `resolverVuelo`). Al cruzar el velo suena el final de la banda de la cinemática.
// Todo sale del segundo en curso: se salta con Esc.

/** Momentos del vuelo, en segundos desde que empieza la cuenta atrás. */
const T = { encendido: 3, despegue: 4, principal: 5.6, presion: 8, separacion: 10, velo: 12, fuera: 14, firma: 15.5 };

/** Dónde se acaba cada vuelo y cuánto dura el plano final. */
const ROTURA: Partial<Record<Fallo, number>> = { presion: 8.9, velo: 13.2 };
const FIN: Record<Fallo | 'exito', number> = { plataforma: 9.5, presion: 13, combustible: 16, velo: 16, firma: 19, exito: 21.5 };
/** Se apagan los motores por falta de combustible. */
const SIN_COMBUSTIBLE = 12.4;

/** Lo que se eleva con los chorros antes de encender los motores. */
const SUSPENSION = 26;
/** La nave sube casi en vertical, pero no del todo (en radianes). */
const INCLINACION = 1.4;

const altitud = (t: number) => {
  const s = Math.max(0, t - T.principal);
  return SUSPENSION * tramo(t, T.despegue, 6) + 7 * s * s + 1.8 * s * s * s;
};
/** Como no va del todo en vertical, se aleja de la cámara según sube. */
const deriva = (alt: number) => -0.16 * Math.max(0, alt - SUSPENSION);

const CSS = `
.lanza { position: fixed; inset: 0; z-index: 125; overflow: hidden; background: #000; color: #f0f4ff; font-family: Rubik, system-ui, sans-serif; user-select: none; }
.lanza canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.lanza__tele { position: absolute; left: 16px; top: 16px; display: grid; gap: 2px; padding: 10px 14px; border-left: 3px solid ${PALETA.ada}; background: rgba(5, 8, 18, .55);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
.lanza__tele small { font-size: 11px; letter-spacing: .14em; color: #9fb0cc; }
.lanza__tele b { font-size: clamp(16px, 2.2vw, 24px); font-weight: 800; }
.lanza__reloj { color: ${PALETA.ada}; }
.lanza__fuel { position: absolute; right: 16px; top: 16px; width: min(220px, 40vw); display: grid; gap: 6px; padding: 10px 14px; background: rgba(5, 8, 18, .55);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; letter-spacing: .08em; color: #9fb0cc; }
.lanza__fuel div { height: 7px; border-radius: 4px; overflow: hidden; background: #ffffff1f; }
.lanza__fuel i { display: block; height: 100%; background: ${PALETA.naranja}; }
.lanza__hito { position: absolute; left: 16px; right: 16px; bottom: 9vh; margin: 0; text-align: center; font-weight: 900; letter-spacing: .08em;
  font-size: clamp(18px, 3.4vw, 36px); text-shadow: 0 2px 0 #06101c, 0 0 26px rgba(0, 0, 0, .8); opacity: 0; }
.lanza__fallo { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, 90vw); padding: 18px 22px; text-align: center; opacity: 0; pointer-events: none;
  border-radius: 16px; background: rgba(20, 6, 8, .82); border: 1px solid #ff6a5a; }
.lanza__fallo h3 { margin: 0 0 6px; font-size: clamp(22px, 3.4vw, 32px); }
.lanza__fallo p { margin: 0; font-size: 15px; line-height: 1.4; color: #ffd9d2; }
.lanza__saltar { position: absolute; right: 16px; bottom: 16px; padding: 9px 16px; border-radius: 999px; border: 1px solid #ffffff47; background: #ffffff14; color: #d7daf0;
  font: 700 12px/1 Rubik, system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; cursor: pointer; }
.lanza__fundido { position: absolute; inset: 0; background: #000; pointer-events: none; opacity: 0; }
`;

export interface DatosLanzamiento {
  diseno: Diseno;
  stats: Estadisticas;
  vuelo: Vuelo;
  alAcabar: () => void;
}

export function mostrarLanzamiento(o: DatosLanzamiento): () => void {
  if (!document.getElementById('lanza-estilo')) {
    const s = document.createElement('style');
    s.id = 'lanza-estilo';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const capa = document.createElement('div');
  capa.className = 'lanza';
  capa.innerHTML = `
    <canvas></canvas>
    <div class="lanza__tele"><small>ARES-X · RETRANSMISIÓN</small><b class="lanza__reloj"></b><small>ALTITUD</small><b class="lanza__alt"></b><small>VELOCIDAD</small><b class="lanza__vel"></b></div>
    <div class="lanza__fuel"><span>TANQUES</span><div><i class="lanza__f1"></i></div><span>CASCO</span><div><i class="lanza__f2"></i></div></div>
    <p class="lanza__hito"></p>
    <div class="lanza__fallo"><h3></h3><p></p></div>
    <div class="lanza__fundido"></div>
    <button type="button" class="lanza__saltar">Saltar <small>Esc</small></button>`;
  document.body.appendChild(capa);
  const q = <T extends HTMLElement>(s: string) => capa.querySelector<T>(s)!;
  const lienzo = capa.querySelector('canvas')!;

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  const post = crearPost(renderer);
  const escena = new THREE.Scene();
  const CIELO_BAJO = new THREE.Color('#8a3338'), CIELO_VELO = new THREE.Color('#d0432e'), CIELO_ESPACIO = new THREE.Color('#03040c');
  const fondo = new THREE.Color();
  escena.background = fondo;
  // El cromo refleja el cielo rojo del velo, y al salir, el del espacio.
  const reflejoVelo = crearEntorno(renderer, true), reflejoEspacio = crearEntorno(renderer);
  escena.environment = reflejoVelo;
  const niebla = new THREE.Fog('#8a3338', 120, 900);
  escena.fog = niebla;
  const camara = new THREE.PerspectiveCamera(46, 1, 1, 9000);
  const hemi = new THREE.HemisphereLight('#ffd8c8', '#3a2428', 1.3);
  const sol = new THREE.DirectionalLight('#ffe6cc', 1.9);
  sol.position.set(60, 90, 70);
  const fogon = new THREE.PointLight('#ffb36b', 0, 260, 1.4);
  escena.add(hemi, sol, fogon);

  // El sector: suelo, plataforma y torre. Solo se ven hasta salir del velo.
  const sector = new THREE.Group();
  sector.add(new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), toon('#a56e62')));
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2, r = 520 + azar(k) * 260, alto = 90 + azar(k + 9) * 170;
    const monte = new THREE.Mesh(new THREE.ConeGeometry(alto * 0.9, alto, 5), toon(k % 3 ? '#7a4a4a' : '#8d5d5a'));
    monte.position.set(Math.cos(a) * r, alto / 2 - 2, Math.sin(a) * r);
    sector.add(monte);
  }
  sector.add(crearPlataforma());
  escena.add(sector);

  // `eje` pasa por el centro de la nave: es lo que gira al ponerse de morro. La nave
  // sale de espaldas a la cámara para que se vean los motores y su lomo.
  const nave = crearNaveModular(o.diseno);
  const eje = new THREE.Group();
  eje.rotation.order = 'YXZ';
  eje.rotation.y = Math.PI;
  nave.raiz.position.y = -ALTO_CASCO;
  eje.add(nave.raiz);
  escena.add(eje);
  const REPOSO = ALTO_PLATAFORMA + ALTO_CASCO;
  const L = nave.largo;
  const anchoFuego = nave.toberas.length > 9 ? 0.75 : nave.toberas.length > 3 ? 1 : 1.5;

  // Meta desde el espacio, al salir del velo.
  const R = 1500;
  const planetaMeta = new THREE.Group();
  planetaMeta.add(planeta(R), velo(R, 1.012, false), velo(R, 1.06, true));
  planetaMeta.visible = false;
  escena.add(planetaMeta);
  const mapa = punto();
  const estrellaSol = new THREE.Sprite(new THREE.SpriteMaterial({ map: mapa, color: '#fff2c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
  estrellaSol.visible = false;
  escena.add(estrellaSol);
  const posEstrellas = new Float32Array(1500 * 3);
  for (let k = 0; k < 1500; k++) {
    const y = azar(k * 2) * 2 - 1, a = azar(k * 2 + 1) * Math.PI * 2, r = Math.sqrt(1 - y * y);
    posEstrellas.set([Math.cos(a) * r * 4000, y * 4000, Math.sin(a) * r * 4000], k * 3);
  }
  const geoEstrellas = new THREE.BufferGeometry();
  geoEstrellas.setAttribute('position', new THREE.BufferAttribute(posEstrellas, 3));
  const estrellas = new THREE.Points(geoEstrellas, new THREE.PointsMaterial({ color: '#ffe9d8', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  estrellas.frustumCulled = false;
  escena.add(estrellas);

  // Chispas (fuego, sobrecalentamiento, explosiones) y humo. Cada punto, en metros.
  const MAX = 9000;
  const crearPuntos = (aditivo: boolean) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('tinte', new THREE.BufferAttribute(new Float32Array(MAX * 4), 4));
    g.setAttribute('tam', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: mapa }, escala: { value: 700 } },
      vertexShader: `attribute float tam; attribute vec4 tinte; varying vec4 vT; uniform float escala;
        void main() { vT = tinte; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(tam * escala / max(0.1, -mv.z), 0.0, 460.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: aditivo
        ? `uniform sampler2D mapa; varying vec4 vT; void main() { float a = texture2D(mapa, gl_PointCoord).a * vT.a; gl_FragColor = vec4(vT.rgb * a, a); }`
        : `uniform sampler2D mapa; varying vec4 vT; void main() { gl_FragColor = vec4(vT.rgb, texture2D(mapa, gl_PointCoord).a * vT.a); }`,
      transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    escena.add(p);
    return { g, m, p, n: 0 };
  };
  const humos = crearPuntos(false), fuegos = crearPuntos(true);
  humos.p.renderOrder = 1;
  fuegos.p.renderOrder = 2;
  const punto3 = (s: typeof humos, x: number, y: number, z: number, r: number, g: number, b: number, a: number, metros: number) => {
    if (s.n >= MAX || a <= 0.004) return;
    (s.g.attributes.position.array as Float32Array).set([x, y, z], s.n * 3);
    (s.g.attributes.tinte.array as Float32Array).set([r, g, b, a], s.n * 4);
    (s.g.attributes.tam.array as Float32Array)[s.n++] = metros;
  };
  const rampa = (f: number): readonly [number, number, number] => {
    if (f < 0.25) return [1, 0.95 - f, 0.8 - f * 2.4];
    if (f < 0.6) return [1, 0.72 - (f - 0.25) * 1.2, 0.2];
    return [0.8 - (f - 0.6) * 1.4, 0.25, 0.1];
  };
  /** El gas frío de los chorros de la panza. */
  const rampaFria = (f: number): readonly [number, number, number] => (f < 0.3 ? [0.86, 0.97, 1] : [0.34 - f * 0.2, 0.8 - f * 0.4, 1]);

  const fallo = o.vuelo.fallo;
  const fin = FIN[fallo ?? 'exito'];
  const rotura = fallo ? ROTURA[fallo] : undefined;

  /** Fuego (o gas frío) saliendo de cada punto en la dirección `dir`. */
  const llamas = (origenes: readonly THREE.Vector3[], dir: THREE.Vector3, ancho: number, largo: number, fuerza: number, t: number, frio = false) => {
    const porMotor = Math.min(26, Math.floor(1600 / origenes.length));
    origenes.forEach((v, m) => {
      for (let k = 0; k < porMotor; k++) {
        const s = k * 13 + m * 97, f = ((t * (2.4 + azar(s) * 2) + azar(s + 1)) % 1);
        const [r, g, b] = frio ? rampaFria(f) : rampa(f);
        const abre = ancho * (0.3 + f * 1.3), lejos = f * largo;
        punto3(fuegos,
          v.x + dir.x * lejos + (azar(s + 2) - 0.5) * abre,
          v.y + dir.y * lejos + (azar(s + 3) - 0.5) * abre,
          v.z + dir.z * lejos + (azar(s + 4) - 0.5) * abre,
          r, g, b, fuerza * 0.34 * (1 - f) ** 0.8, ancho * (1 - f * 0.5));
      }
      punto3(fuegos, v.x, v.y, v.z, frio ? 0.7 : 1, 0.85, frio ? 1 : 0.6, fuerza * 0.6, ancho * 1.4);
    });
  };

  /** La nube del encendido, que sale a ras de suelo y sube despacio. */
  const nube = (t: number) => {
    const s = t - T.encendido;
    if (s <= 0) return;
    for (let k = 0; k < 420; k++) {
      const nace = (k / 420) * 3.2, e = s - nace;
      if (e <= 0) continue;
      const a = azar(k * 3) * Math.PI * 2, r = 8 + (1 - Math.exp(-e * 0.7)) * (70 + azar(k * 3 + 1) * 60);
      const c = 0.5 + azar(k * 3 + 2) * 0.16;
      punto3(humos, Math.cos(a) * r, 2 + e * (1.2 + azar(k) * 2.6), Math.sin(a) * r, c, c * 0.95, c * 0.93, 0.5 * Math.max(0, 1 - e / 11), 12 + e * 4.5);
    }
  };

  /** La columna de humo que deja la nave al subir. */
  const estela = (t: number) => {
    const hasta = Math.min(t, T.separacion + 1);
    if (hasta <= T.principal) return;
    for (let k = 0; k < 170; k++) {
      const nace = T.principal + (k / 170) * (hasta - T.principal);
      const e = t - nace, alt = altitud(nace);
      const c = 0.56;
      punto3(humos, Math.sin(k * 1.7) * (1 + e), REPOSO + alt, deriva(alt) + Math.cos(k * 2.3) * (1 + e), c, c, c, 0.4 * Math.max(0.05, 1 - e / 10), 6 + e * 3.4);
    }
  };

  const estallido = (centro: THREE.Vector3, t: number, t0: number) => {
    const s = t - t0;
    if (s < 0 || s > 3.5) return;
    for (let k = 0; k < 700; k++) {
      const u = azar(k * 3) * 2 - 1, a = azar(k * 3 + 1) * Math.PI * 2, w = Math.sqrt(1 - u * u);
      const d = (1 - Math.exp(-s * 2.2)) * (24 + azar(k * 3 + 2) * 70);
      const f = Math.min(1, s / (0.8 + azar(k) * 2));
      const [r, g, b] = rampa(f);
      punto3(fuegos, centro.x + Math.cos(a) * w * d, centro.y + u * d, centro.z + Math.sin(a) * w * d, r, g, b, 0.5 * (1 - f), 4 * (1 - f * 0.5));
    }
  };

  // ------------------------------------------------------------- texto

  const reloj = q('.lanza__reloj'), elAlt = q('.lanza__alt'), vel = q('.lanza__vel'), hito = q('.lanza__hito');
  const f1 = q('.lanza__f1'), f2 = q('.lanza__f2');
  const fundido = q('.lanza__fundido');
  q('.lanza__fallo h3').textContent = o.vuelo.titulo;
  q('.lanza__fallo p').textContent = o.vuelo.motivo;

  const HITOS: readonly (readonly [number, number, string])[] = [
    [0.1, 0.9, 'T − 3'], [1.1, 1.9, 'T − 2'], [2.1, 2.9, 'T − 1'], [T.encendido, T.despegue, 'IGNICIÓN'],
    [T.despegue, T.principal, fallo === 'plataforma' ? '' : 'DESPEGUE'],
    [T.principal, 7.2, 'MOTORES PRINCIPALES'],
    [T.presion, T.presion + 1.4, 'MÁXIMA PRESIÓN'],
    [T.separacion, T.separacion + 1.5, 'SUELTA LOS TANQUES'],
    [T.velo, T.fuera, 'ENTRANDO EN EL VELO'],
    [T.fuera, T.firma, 'FUERA DEL VELO'],
    [T.firma, 18, fallo === 'firma' ? '' : 'ADA ESTÁ FIRMANDO'],
    [18, fin, o.vuelo.exito ? 'ORDEN ACEPTADA · VUELVE EL SOL' : ''],
  ];
  const textoHito = (t: number) => {
    if (fallo === 'plataforma' && t >= T.despegue) return '';
    if (rotura && t >= rotura) return '';
    if (fallo === 'combustible' && t >= SIN_COMBUSTIBLE) return 'SIN COMBUSTIBLE';
    return HITOS.find(([a, b]) => t >= a && t < b)?.[2] ?? '';
  };

  // ------------------------------------------------------------- sonido

  let banda: ((s: boolean) => void) | null = null;
  const SUENA: (readonly [number, (a: AudioContext, t0: number) => void])[] = [
    ...[0.1, 1.1, 2.1].map((s) => [s, (a: AudioContext, t0: number) => tono(a, t0, 'square', 880, 870, 0.09, 0.03)] as const),
    [T.encendido, (a, t0) => { soplido(a, t0, 3, 500, 1400, 0.1); }],
    [T.principal, (a, t0) => { soplido(a, t0, 6, 120, 700, 0.24); tono(a, t0, 'sawtooth', 48, 62, 6, 0.09); }],
    [T.presion, (a, t0) => soplido(a, t0, 2, 300, 1100, 0.1)],
    [T.separacion, (a, t0) => { tono(a, t0, 'sine', 120, 50, 0.8, 0.2); soplido(a, t0, 0.9, 900, 240, 0.14); }],
  ];
  if (rotura) SUENA.push([rotura, (a, t0) => { soplido(a, t0, 2.6, 900, 80, 0.32); tono(a, t0, 'sine', 80, 28, 2.4, 0.3); }]);

  // ------------------------------------------------------------ fotograma

  const acabado: AcabadoImagen = {
    tiempo: 0, brillo: 0.4, umbral: 0.82, aberracion: 0.2, estatica: 0, tinte: new THREE.Color('#ff7a5a'), ondaX: 0.5, ondaY: 0.5, ondaRadio: 0, ondaFuerza: 0,
  };
  const encajar = () => {
    const w = capa.clientWidth || innerWidth, h = capa.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    post.medir(w, h);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    for (const s of [humos, fuegos]) s.m.uniforms.escala.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2));
  };
  encajar();
  const observador = new ResizeObserver(encajar);
  observador.observe(capa);

  const nariz = new THREE.Vector3(), cola = new THREE.Vector3(), panza = new THREE.Vector3(), lomo = new THREE.Vector3();
  const proa = new THREE.Vector3(), mira = new THREE.Vector3();
  const p = eje.position;
  let t = 0, vivo = true, raf = 0, ultimo = performance.now(), acabada = false;
  const dibujar = (dt: number) => {
    const antes = t;
    t += dt;
    humos.n = fuegos.n = 0;
    const despega = fallo !== 'plataforma';
    const roto = rotura !== undefined && t >= rotura;
    const sinGas = fallo === 'combustible' && t >= SIN_COMBUSTIBLE;
    /** Solo llegan al espacio los vuelos que cruzan el velo. */
    const cruza = fallo === null || fallo === 'firma';

    // Dónde va la nave: si pesa demasiado, se levanta un poco y vuelve a caer.
    let alt = despega ? altitud(t) : 3.4 * Math.sin(Math.PI * tramo(t, T.despegue, 7.4));
    if (sinGas) {
      const s = t - SIN_COMBUSTIBLE;
      alt = altitud(SIN_COMBUSTIBLE) + 180 * s - 90 * s * s;
    }
    const y = REPOSO + alt;
    const suelta = despega && t >= T.separacion;
    const tiembla = (t >= T.encendido && t < T.fuera ? 0.12 : 0) + (despega ? 0 : 0.22);
    p.set(Math.sin(t * 57) * tiembla, y, deriva(alt) + Math.cos(t * 43) * tiembla);

    // Se pone de morro antes de encender, y fuera del velo se nivela.
    const cabeceo = (despega ? INCLINACION * tramo(t, 5.1, 7) : 0) - (cruza ? 0.85 * tramo(t, T.fuera - 0.6, T.fuera + 1.6) : 0);
    const lucha = fallo === 'presion' && t > T.presion ? (t - T.presion) * 0.06 : despega ? 0 : 0.03 * tramo(t, T.despegue, 5);
    eje.rotation.x = -cabeceo + Math.sin(t * 9) * lucha;
    eje.rotation.z = roto || sinGas ? (t - (rotura ?? SIN_COMBUSTIBLE)) * 0.35 : Math.sin(t * 7) * lucha;
    eje.visible = !roto;
    if (despega) {
      const recoge = tramo(t, 4.7, 5.5);
      nave.tren.scale.y = Math.max(0.01, 1 - recoge);
      nave.tren.visible = recoge < 1;
    }
    if (suelta) {
      const s = t - T.separacion, tanques = nave.partes.propulsor;
      tanques.position.set(0, -s * 2.4, -s * s * 14 - s * 5);
      tanques.rotation.set(s * 0.32, 0, s * 0.14);
      tanques.visible = s < 3.6;
    }
    eje.updateMatrixWorld(true);
    const matriz = nave.raiz.matrixWorld;
    nariz.set(0, 0, 1).transformDirection(matriz);
    cola.copy(nariz).negate();
    lomo.set(0, 1, 0).transformDirection(matriz);
    panza.copy(lomo).negate();
    proa.copy(p).addScaledVector(nariz, nave.morro);
    const enMundo = (v: THREE.Vector3) => v.clone().applyMatrix4(matriz);

    // Primero los chorros de la panza, y luego los motores.
    const enciende = tramo(t, T.encendido, T.encendido + 0.5);
    const motores = (despega ? 1 : 0.55) * tramo(t, T.principal, T.principal + 0.4);
    const apagado = sinGas || roto || (fallo === 'plataforma' && t > 7.2);
    const chorros = apagado ? 0 : enciende * (1 - tramo(t, 6.2, 7.2));
    const fuego = apagado ? 0 : motores * (suelta ? 0.8 : 1);
    if (chorros > 0) llamas(nave.chorros.map(enMundo), panza, 1.3, 15, chorros, t, true);
    if (fuego > 0) llamas(nave.toberas.map(enMundo), cola, anchoFuego, despega ? 30 : 11, fuego, t);
    // Junto al suelo alumbra la nube; en vuelo no debe quemar las alas.
    const alejada = tramo(t, T.principal, 7);
    fogon.position.copy(p).addScaledVector(cola, L * 0.55 + 22 * alejada);
    fogon.intensity = (5000 - 3900 * alejada) * Math.max(fuego, 0.3 * chorros);
    nube(t);
    if (despega) estela(t);

    // El velo: el aire arde alrededor del morro y todo corre hacia abajo.
    const enVelo = tramo(t, T.velo, T.velo + 0.5) * (cruza ? 1 - tramo(t, T.fuera - 0.3, T.fuera) : 1);
    if (enVelo > 0.01 && !roto) {
      for (let k = 0; k < 900; k++) {
        const a = azar(k * 3) * Math.PI * 2, r = 34 + azar(k * 3 + 1) * 200;
        const py = proa.y + 120 - ((t * (700 + azar(k) * 400) + azar(k * 3 + 2) * 400) % 400);
        punto3(fuegos, p.x + Math.cos(a) * r, py, p.z + Math.sin(a) * r, 1, 0.3, 0.2, 0.55 * enVelo, 3 + azar(k + 7) * 5);
      }
      for (let k = 0; k < 220; k++) {
        const a = azar(k * 5) * Math.PI * 2, f = (t * 3 + azar(k * 5 + 1)) % 1;
        const r = 4.5 * (0.15 + f * 0.85), x = Math.cos(a) * r, u = Math.sin(a) * r, atras = f * 13;
        punto3(fuegos, proa.x + x + cola.x * atras + lomo.x * u, proa.y + cola.y * atras + lomo.y * u, proa.z + cola.z * atras + lomo.z * u, 1, 0.6 - f * 0.3, 0.25, enVelo * 0.9 * (1 - f), 1.4);
      }
    }
    if (rotura) estallido(p, t, rotura);

    // El espacio.
    const espacio = cruza ? tramo(t, T.velo + 0.5, T.fuera) : 0;
    fondo.copy(CIELO_BAJO).lerp(CIELO_VELO, tramo(t, T.presion, T.velo)).lerp(CIELO_ESPACIO, espacio);
    niebla.color.copy(fondo);
    const fueraDelVelo = cruza && t > T.fuera - 0.8;
    escena.fog = fueraDelVelo ? null : niebla;
    escena.environment = espacio > 0.5 ? reflejoEspacio : reflejoVelo;
    sector.visible = t < T.fuera - 0.6;
    planetaMeta.visible = estrellaSol.visible = estrellas.visible = fueraDelVelo;
    (estrellas.material as THREE.PointsMaterial).opacity = espacio;
    // Sin aire no hay luz rebotada: la crema y el cromo se quemarían con el brillo.
    hemi.intensity = 1.3 - 0.5 * espacio;
    sol.intensity = 1.9 - 0.7 * espacio;
    escena.environmentIntensity = 1 - 0.6 * espacio;
    if (planetaMeta.visible) {
      estrellas.position.copy(p);
      planetaMeta.position.set(p.x - 340, y - R - 190, p.z - 620);
      planetaMeta.rotation.set(1.05, t * 0.02, 0); // sin esto, debajo queda el casquete de hielo
      const orden = o.vuelo.exito ? tramo(t, 18, 19.6) : 0;
      estrellaSol.position.set(p.x - 1130, y - 24 + 90 * orden, p.z - 2300);
      estrellaSol.scale.setScalar(380 + 1500 * orden);
      (estrellaSol.material as THREE.SpriteMaterial).opacity = 0.75 + 0.25 * orden;
    }
    // ADA sube la firma: un haz cyan que sale del morro.
    if (t >= T.firma && (fallo === null || fallo === 'firma')) {
      const falla = fallo === 'firma';
      const s = t - T.firma, cae = falla ? Math.max(0, 1 - (t - 17.2)) : 1;
      if (cae > 0) {
        for (let k = 0; k < 260; k++) {
          const f = (k / 260 + t * 1.6) % 1, onda = Math.sin(f * 40 + t * 12) * (falla ? 2.2 : 0.5);
          const d = f * Math.min(900, s * 520);
          punto3(fuegos, proa.x + nariz.x * d + onda, proa.y + nariz.y * d + onda * 0.4, proa.z + nariz.z * d + onda * 0.6, 0.35, 0.9, 1, cae * (1 - f * 0.6), 1.5);
        }
      }
    }

    // Cámara: a ras de suelo junto a la plataforma, luego detrás de la nave, y fuera
    // del velo mira con ella hacia Meta y hacia el sol.
    const pegada = despega ? tramo(t, T.principal - 0.2, T.presion) : 0;
    const fuera = cruza ? tramo(t, T.fuera - 0.2, T.fuera + 1.2) : 0;
    const tension = rotura ? tramo(t, rotura, rotura + 1.5) : 0;
    const escala = L / 36;
    const px = THREE.MathUtils.lerp(THREE.MathUtils.lerp(44, p.x + 34 * escala, pegada), p.x + 24 * escala, fuera) + tension * 30;
    const py = THREE.MathUtils.lerp(THREE.MathUtils.lerp(9, p.y - 5 * escala, pegada), p.y + 18 * escala, fuera);
    const pz = THREE.MathUtils.lerp(THREE.MathUtils.lerp(52, p.z + 42 * escala, pegada), p.z + 58 * escala, fuera) + tension * 60;
    const sacude = Math.min(1.6, tiembla * 3 + (t > T.velo && t < T.fuera ? 1 : 0) + (rotura ? 4 * Math.exp(-Math.max(0, t - rotura) * 2) * (t > rotura ? 1 : 0) : 0));
    camara.position.set(px + Math.sin(t * 61) * sacude, py + Math.sin(t * 47) * sacude, pz);
    mira.set(p.x, despega ? p.y : Math.max(p.y, 8), p.z);
    mira.x += -28 * fuera;
    mira.y += -7 * fuera;
    mira.z += -62 * fuera;
    camara.lookAt(mira);

    for (const s of [humos, fuegos]) {
      s.g.setDrawRange(0, s.n);
      for (const nombre of ['position', 'tinte', 'tam']) s.g.attributes[nombre].needsUpdate = true;
    }

    // Telemetría.
    const s = Math.max(0, t - 3);
    const vuela = despega ? Math.max(0, t - T.despegue) : 0;
    const f = Math.min(1, vuela / (T.fuera - T.despegue));
    const velocidad = roto ? 0 : sinGas ? o.stats.deltaV * 0.6 * f : o.stats.deltaV * f ** 1.6;
    reloj.textContent = `T${t < T.encendido ? '−' : '+'}00:${String(t < T.encendido ? Math.ceil(3 - t) : Math.floor(s)).padStart(2, '0')}`;
    elAlt.textContent = `${(Math.max(0, alt) / 20).toFixed(1)} km`;
    vel.textContent = `${Math.round(velocidad * 3.6).toLocaleString('es-ES')} km/h`;
    f1.style.width = `${Math.max(0, (1 - tramo(t, T.encendido, T.separacion)) * 100).toFixed(0)}%`;
    f2.style.width = `${Math.max(0, (1 - tramo(t, T.separacion + 0.3, fallo === 'combustible' ? SIN_COMBUSTIBLE : T.firma)) * 100).toFixed(0)}%`;
    const txt = textoHito(t);
    if (hito.textContent !== txt && txt) hito.textContent = txt;
    hito.style.opacity = txt ? '1' : '0';
    q('.lanza__fallo').style.opacity = !o.vuelo.exito && t > fin - 3 ? '1' : '0';
    fundido.style.opacity = String(tramo(t, fin - 0.7, fin));

    if (t - antes < 0.25) {
      for (const [m, fn] of SUENA) if (antes < m && t >= m) sonar(fn);
      if (o.vuelo.exito && !banda && t >= T.velo) {
        sonar((a, ahora) => { banda = tocarBanda(a, VENTANA, ahora + 0.04); });
      }
    }

    acabado.tiempo = t;
    acabado.aberracion = Math.min(1.8, 0.15 + sacude * 0.5);
    acabado.brillo = 0.32 + 0.18 * espacio;
    acabado.umbral = 0.82 + 0.13 * espacio;
    acabado.estatica = enVelo * 0.14;
    const golpe = rotura ? Math.max(0, 1 - (t - rotura) / 1.6) * (t >= rotura ? 1 : 0) : 0;
    acabado.ondaFuerza = golpe * 1.3;
    acabado.ondaRadio = 1.2 * (1 - golpe);
    post.pintar(escena, camara, acabado);
    if (t >= fin) terminar();
  };

  const destruir = () => {
    cancelAnimationFrame(raf);
    observador.disconnect();
    window.removeEventListener('keydown', tecla, true);
    banda?.(true);
    post.liberar();
    reflejoVelo.dispose();
    reflejoEspacio.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    capa.remove();
  };
  function terminar() {
    if (acabada) return;
    acabada = true;
    vivo = false;
    destruir();
    o.alAcabar();
  }
  function tecla(e: KeyboardEvent) {
    if (e.code !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    terminar();
  }
  q('.lanza__saltar').addEventListener('click', terminar);
  window.addEventListener('keydown', tecla, true);

  const fotograma = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    dibujar(dt);
    if (vivo) raf = requestAnimationFrame(fotograma);
  };
  dibujar(0);
  raf = requestAnimationFrame(fotograma);
  return () => {
    if (!acabada) {
      acabada = true;
      vivo = false;
      destruir();
    }
  };
}
