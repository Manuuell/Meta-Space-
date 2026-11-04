import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// META SPACE — Acabado de imagen de la cinemática: brillo real, onda de choque
// que deforma la pantalla, separación de color en los golpes, estática de radio
// y viñeta.
//
// La escena se pinta como siempre en el lienzo y aquí se copia a una textura. Así
// los planetas y las partículas, que escriben su color tal cual, salen idénticos
// y se conserva el antialiasing del lienzo. Con un equipo lento, `bajar` reduce
// la resolución y después apaga todo esto: la cinemática sigue igual sin ello.

export interface AcabadoImagen {
  /** Segundo en curso, para que el ruido sea el mismo en cada pase. */
  tiempo: number;
  /** Cuánto brilla lo más claro (0 a 2) y desde qué luz empieza (0 a 1). */
  brillo: number;
  umbral: number;
  /** Separación de color en los bordes (0 a 2). */
  aberracion: number;
  /** Rasgado y ruido de radio (0 a 1), con su tinte. */
  estatica: number;
  tinte: THREE.Color;
  /** Onda de choque: centro en pantalla (0 a 1), radio y fuerza. */
  ondaX: number;
  ondaY: number;
  ondaRadio: number;
  ondaFuerza: number;
}

export interface Post {
  pintar(escena: THREE.Scene, camara: THREE.Camera, a: AcabadoImagen): void;
  medir(ancho: number, alto: number): void;
  /** Un paso menos de calidad. Devuelve false si ya no queda nada que bajar. */
  bajar(): boolean;
  liberar(): void;
}

const ACABADO = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    aspecto: { value: 1 },
    tiempo: { value: 0 },
    aberracion: { value: 0 },
    estatica: { value: 0 },
    tinte: { value: new THREE.Color('#ffffff') },
    ondaC: { value: new THREE.Vector2(0.5, 0.5) },
    ondaR: { value: 0 },
    ondaF: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float aspecto; uniform float tiempo; uniform float aberracion;
    uniform float estatica; uniform vec3 tinte; uniform vec2 ondaC; uniform float ondaR; uniform float ondaF;
    varying vec2 vUv;
    float ruido(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float luzOnda = 0.0;
      if (ondaF > 0.001) {
        vec2 d = uv - ondaC;
        d.x *= aspecto;
        float r = length(d);
        float anillo = smoothstep(0.17, 0.0, abs(r - ondaR));
        vec2 rumbo = d / max(r, 0.0001);
        rumbo.x /= aspecto;
        uv -= rumbo * anillo * ondaF * 0.055;
        luzOnda = anillo * ondaF * 0.1;
      }
      float cuadro = floor(tiempo * 30.0);
      if (estatica > 0.001) {
        float fila = floor(uv.y * 54.0);
        float salta = step(1.0 - estatica * 0.5, ruido(vec2(fila, cuadro)));
        uv.x += salta * (ruido(vec2(fila + 3.0, cuadro)) - 0.5) * 0.16 * estatica;
      }
      vec2 c = uv - 0.5;
      float a = aberracion * 0.016 * (0.25 + dot(c, c) * 3.0);
      vec3 col = vec3(texture2D(tDiffuse, uv + c * a).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * a).b);
      col += luzOnda;
      if (estatica > 0.001) {
        float grano = ruido(floor(vUv * vec2(aspecto * 180.0, 180.0)) + cuadro * 0.37);
        float rayas = 0.82 + 0.18 * sin(vUv.y * 460.0 + tiempo * 12.0);
        col = mix(col, grano * tinte, estatica * 0.3) * mix(1.0, rayas, estatica);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function crearPost(renderer: THREE.WebGLRenderer): Post {
  let captura = new THREE.FramebufferTexture(4, 4);
  captura.minFilter = captura.magFilter = THREE.LinearFilter;
  const composer = new EffectComposer(renderer);
  // La primera pasada solo trae la imagen copiada del lienzo.
  const copia = new ShaderPass({
    uniforms: { mapa: { value: captura } },
    vertexShader: ACABADO.vertexShader,
    fragmentShader: 'uniform sampler2D mapa; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(mapa, vUv).rgb, 1.0); }',
  });
  const brillo = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.65, 0.68);
  const acabado = new ShaderPass(ACABADO);
  composer.addPass(copia);
  composer.addPass(brillo);
  composer.addPass(acabado);

  let activo = true, ancho = 1, alto = 1, pasos = 0;

  const medir = (w: number, h: number) => {
    ancho = w;
    alto = h;
    const b = renderer.getDrawingBufferSize(new THREE.Vector2());
    captura.dispose();
    captura = new THREE.FramebufferTexture(b.x, b.y);
    captura.minFilter = captura.magFilter = THREE.LinearFilter;
    copia.uniforms.mapa.value = captura;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  };

  return {
    medir,
    pintar(escena, camara, a) {
      renderer.setRenderTarget(null);
      renderer.render(escena, camara);
      if (!activo) return;
      renderer.copyFramebufferToTexture(captura);
      brillo.strength = a.brillo;
      brillo.threshold = a.umbral;
      const u = acabado.uniforms;
      u.aspecto.value = ancho / Math.max(1, alto);
      u.tiempo.value = a.tiempo;
      u.aberracion.value = a.aberracion;
      u.estatica.value = a.estatica;
      (u.tinte.value as THREE.Color).copy(a.tinte);
      (u.ondaC.value as THREE.Vector2).set(a.ondaX, a.ondaY);
      u.ondaR.value = a.ondaRadio;
      u.ondaF.value = a.ondaFuerza;
      composer.render();
    },
    bajar() {
      if (pasos === 0 && renderer.getPixelRatio() > 1) {
        pasos = 1;
        renderer.setPixelRatio(1);
        return true;
      }
      if (!activo) return false;
      activo = false;
      return true;
    },
    liberar() {
      captura.dispose();
      brillo.dispose();
      composer.dispose();
    },
  };
}
