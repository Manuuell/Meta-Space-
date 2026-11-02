import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses,
  punta, rot, toon, toro, type Modelo,
} from './kit.ts';

// Heraldo del Velo: el dirigible fumigador que tiende el velo de HELIOS
// (minuto 5). Un globo de chapa con cara en el morro (ojos de pupila roja,
// cejas en V y una sonrisa de dientes), tres boquillas de fumigar debajo,
// dos depósitos con gas rojo que brilla por la mirilla, aletas púrpura, dos
// hélices, una góndola con la bodega de cápsulas y un núcleo de cristal
// púrpura colgando. Flota con el centro del globo a 4,5 m; mide 4,9 m de
// largo y 3,8 de ancho. Mira hacia +z.
//
// Los avisos de cada ataque son marcas rojas en el suelo (nodos `aviso_*`,
// colgados de la raíz). En fase 2 se reproduce `Enfurecido` a la vez que
// cualquier otro clip: solo anima el desgarro, la fuga de gas y el aura del
// núcleo. Tiempos en TIEMPOS_HERALDO.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const ALTURA = 4.5;

/**
 * Tiempos de cada ataque en segundos (fotograma = segundo × 30): aviso,
 * ventana de daño (golpe → finGolpe) y duración del clip. Las cápsulas del
 * bombardeo caen en x = −1,8, 0 y 1,8 m, z = −0,5 m (coordenadas del modelo);
 * el rociado cubre un círculo de 2,6 m de radio centrado 4,8 m por delante.
 */
export const TIEMPOS_HERALDO = {
  Rociar: { aviso: 0, golpe: 1.1, finGolpe: 2.2, duracion: 3.0 },
  Bombardeo: { aviso: 0, golpe: 1.35, finGolpe: 1.7, duracion: 2.6 },
} as const;

const BOMBAS = [-1.8, 0, 1.8];
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export function crearHeraldo(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'heraldo';
  const cuerpo = nodo('cuerpo', raiz, 0, ALTURA, 0);
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);

  // Globo: chapa con aros de metal, un ecuador púrpura que brilla y aletas.
  const globo = nodo('globo', cuerpo);
  pieza(globo, esfera(1.4, 1, 0.82, 1.7), toon(PALETA.chapaHelios));
  fino(() => {
    for (const z of [1.3, 0, -1.3]) {
      const k = Math.sqrt(1 - (z / 2.38) ** 2);
      pieza(globo, toro(1.4 * k + 0.02, 0.06).rotateX(Math.PI / 2).scale(1, 0.82, 1), toon(PALETA.metalOscuro), 0, 0, z);
    }
  });
  pieza(globo, toro(1.31, 0.055).scale(1, 1, 1.7), brillo(PALETA.purpuraBrillo), 0, -0.42, 0, { contorno: false });
  for (const angulo of [0, 90, 180, 270]) {
    const a = THREE.MathUtils.degToRad(angulo);
    const aleta = pieza(globo, punta(0.55, 1.2, 8).scale(0.16, 1, 1), toon(PALETA.purpura), Math.sin(a) * 0.75, Math.cos(a) * 0.62, -2.05);
    aleta.rotation.order = 'ZXY';
    aleta.rotation.set(-0.75, 0, -a);
  }
  // Antena con luz roja.
  barra(globo, [0, 1.1, 0.5], [0, 1.6, 0.42], 0.035, toon(PALETA.metalOscuro));
  fino(() => pieza(globo, esfera(0.09), brillo(PALETA.helios), 0, 1.7, 0.4, { contorno: false }));

  // Cara en el morro: escleras, pupilas, cejas en V y sonrisa de dientes.
  const cara = nodo('cara', globo, 0, 0.22, 2.12);
  for (const s of [1, -1]) {
    const esclera = pieza(cara, esfera(0.42, 1, 1.05, 0.45), toon(PALETA.blanco), 0.5 * s, 0, 0);
    esclera.rotation.y = 0.32 * s;
  }
  const pupilas = nodo('pupilas', cara, 0, 0, 0.16);
  fino(() => {
    for (const s of [1, -1]) {
      pieza(pupilas, esfera(0.2, 1, 1.05, 0.45), brillo(PALETA.helios), 0.52 * s, -0.04, 0, { contorno: false, sombra: false });
      pieza(pupilas, esfera(0.065), brillo(PALETA.blanco), 0.52 * s + 0.08, 0.06, 0.07, { contorno: false, sombra: false });
    }
  });
  const cejas = nodo('cejas', cara, 0, 0.47, 0.06);
  for (const s of [1, -1]) {
    const ceja = pieza(cejas, caja(0.78, 0.2, 0.3, 0.08), toon(PALETA.oscuroHelios), 0.48 * s, 0, 0);
    ceja.rotation.set(0, 0.3 * s, 0.36 * s);
  }
  pieza(globo, capsula(0.12, 0.7).rotateZ(Math.PI / 2), toon(PALETA.oscuroHelios), 0, -0.45, 2.04);
  fino(() => {
    for (let k = 0; k < 6; k++) {
      const x = -0.4 + k * 0.16;
      pieza(globo, punta(0.06, 0.15).rotateX(Math.PI), toon(PALETA.diente), x, -0.36, 2.15 - Math.abs(x) * 0.12, { contorno: false });
    }
  });

  // Boquillas de fumigar bajo el morro, con aros rojos.
  const boquillas = nodo('boquillas', cuerpo, 0, -0.72, 1.92);
  for (const x of [-0.42, 0, 0.42]) {
    fino(() => {
      const b = pieza(boquillas, barril(0.1, 0.19, 0.46, 0.05), toon(PALETA.metalOscuro), x, 0, 0);
      b.rotation.x = THREE.MathUtils.degToRad(-53);
      const aro = pieza(boquillas, toro(0.18, 0.035), brillo(PALETA.helios), x, -0.14, 0.18, { contorno: false });
      aro.rotation.x = THREE.MathUtils.degToRad(-53);
    });
  }

  // Depósitos de gas rojo a los lados, con mirilla que brilla y abrazaderas.
  const tanques = nodo('tanques', cuerpo, 0, -0.72, -0.2);
  for (const s of [1, -1]) {
    pieza(tanques, capsula(0.36, 1.3).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 1.45 * s, 0, 0);
    pieza(tanques, capsula(0.09, 1.1).rotateX(Math.PI / 2), brillo(PALETA.helios), 1.45 * s + 0.31 * s, 0.05, 0, { contorno: false });
    fino(() => {
      for (const z of [-0.45, 0.45]) pieza(tanques, toro(0.38, 0.05).rotateX(Math.PI / 2), toon(PALETA.chapaHelios), 1.45 * s, 0, z);
    });
    for (const z of [-0.45, 0.45]) barra(tanques, [1.2 * s, 0.25, z], [0.95 * s, 0.45, z], 0.05, toon(PALETA.metalOscuro));
  }

  // Góndola: cabina, ventanas púrpura, bodega con tres cápsulas y el núcleo.
  const gondola = nodo('gondola', cuerpo, 0, -1.3, -0.1);
  barra(gondola, [0.35, 0.2, 0.4], [0.5, 0.75, 0.4], 0.05, toon(PALETA.metalOscuro));
  barra(gondola, [-0.35, 0.2, 0.4], [-0.5, 0.75, 0.4], 0.05, toon(PALETA.metalOscuro));
  barra(gondola, [0.35, 0.2, -0.5], [0.5, 0.75, -0.5], 0.05, toon(PALETA.metalOscuro));
  barra(gondola, [-0.35, 0.2, -0.5], [-0.5, 0.75, -0.5], 0.05, toon(PALETA.metalOscuro));
  pieza(gondola, caja(1.1, 0.6, 1.7, 0.25), toon(PALETA.metalHelios));
  pieza(gondola, caja(1.14, 0.12, 1.3, 0.05), brillo(PALETA.purpuraBrillo), 0, 0.1, 0.1, { contorno: false });
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const compuerta = nodo(`compuerta_${lado}`, gondola, 0.42 * s, -0.31, -0.42);
    pieza(compuerta, caja(0.42, 0.06, 0.66, 0.025), toon(PALETA.oscuroHelios), -0.21 * s, 0, 0);
  }
  BOMBAS.forEach((_, k) => {
    const bomba = nodo(`bomba_${k + 1}`, gondola, (k - 1) * 0.28, -0.12, -0.42);
    fino(() => {
      pieza(bomba, capsula(0.11, 0.2), toon(PALETA.helios));
      pieza(bomba, esfera(0.08), toon(PALETA.metalOscuro), 0, 0.17, 0);
      pieza(bomba, toro(0.115, 0.025), brillo(PALETA.purpuraBrillo), 0, -0.02, 0, { contorno: false });
    });
  });
  const nucleo = nodo('nucleo', gondola, 0, -0.3, 0.42);
  pieza(nucleo, punta(0.3, 1.0, 8).rotateX(Math.PI), brillo(PALETA.purpuraBrillo), 0, -0.45, 0, { contorno: false });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + TAU / 8;
    const c = pieza(nucleo, punta(0.13, 0.55).rotateX(Math.PI), toon(PALETA.purpura), Math.sin(a) * 0.2, -0.25, Math.cos(a) * 0.2);
    c.rotation.set(-Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
  }
  const aura = nodo('aura', nucleo, 0, -0.4, 0);
  fino(() => pieza(aura, toro(0.5, 0.05), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false, sombra: false }));
  oculto(aura);

  // Motores con hélices de tres palas, detrás.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    barra(cuerpo, [0.9 * s, -0.3, -1.8], [1.2 * s, -0.25, -1.9], 0.07, toon(PALETA.metalOscuro));
    pieza(cuerpo, capsula(0.22, 0.5).rotateX(Math.PI / 2), toon(PALETA.metalHelios), 1.3 * s, -0.25, -2.0);
    const helice = nodo(`helice_${lado}`, cuerpo, 1.3 * s, -0.25, -2.42);
    fino(() => {
      pieza(helice, esfera(0.1), toon(PALETA.oscuro));
      for (let k = 0; k < 3; k++) {
        const pala = pieza(helice, esfera(0.34, 0.32, 1, 0.08), toon(PALETA.metal), 0, 0.3, -0.02);
        pala.position.set(Math.sin((k / 3) * TAU) * 0.3, Math.cos((k / 3) * TAU) * 0.3, -0.02);
        pala.rotation.z = -(k / 3) * TAU;
      }
    });
  }

  // Fase 2: desgarro en el globo y gas rojo que se escapa.
  const desgarro = nodo('desgarro', globo, 0.85, 0.75, -0.6);
  desgarro.rotation.set(0, 0.6, -0.55);
  pieza(desgarro, esfera(0.38, 1, 0.65, 0.3), toon(PALETA.oscuroHelios));
  fino(() => {
    pieza(desgarro, esfera(0.2, 1, 0.6, 0.3), brillo(PALETA.helios), 0, 0, 0.06, { contorno: false });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const d = pieza(desgarro, punta(0.08, 0.22), toon(PALETA.chapaHelios), Math.cos(a) * 0.36, Math.sin(a) * 0.24, 0.05);
      d.rotation.z = a - Math.PI / 2;
    }
  });
  oculto(desgarro);
  const fuga = nodo('fuga', globo, 1.05, 0.95, -0.7);
  fino(() => {
    for (const [d, r] of [[0, 0.16], [0.35, 0.22], [0.75, 0.28], [1.2, 0.34]] as const) {
      pieza(fuga, esfera(r), toon(PALETA.helios), d * 0.7, d * 0.55, -d * 0.4, { sombra: false });
    }
  });
  oculto(fuga);

  // Ataques: nube del rociado y cápsulas que estallan; avisos en el suelo.
  const nube = nodo('nube', cuerpo, 0, -0.9, 2.15);
  fino(() => {
    for (const [d, r, x, y] of [[0.4, 0.28, 0, 0], [1.1, 0.45, 0.2, 0.1], [1.9, 0.62, -0.3, -0.1], [2.8, 0.8, 0.35, 0.1], [3.7, 0.95, -0.3, 0], [4.7, 1.1, 0.25, -0.1], [5.4, 1.0, -0.6, 0.2]] as const) {
      pieza(nube, esfera(r), toon(PALETA.helios), x, -d * 0.66 + y, d * 0.75, { sombra: false });
    }
  });
  oculto(nube);
  const avisoRocio = nodo('aviso_rocio', raiz, 0, 0.03, 4.8);
  pieza(avisoRocio, new THREE.RingGeometry(2.15, 2.6, 40).rotateX(-Math.PI / 2), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  pieza(avisoRocio, new THREE.RingGeometry(0.7, 1.05, 28).rotateX(-Math.PI / 2), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  oculto(avisoRocio);
  const avisoBombas = nodo('aviso_bombas', raiz, 0, 0.03, -0.5);
  const estallidos = nodo('estallidos', raiz, 0, 0, -0.5);
  for (const x of BOMBAS) {
    pieza(avisoBombas, new THREE.RingGeometry(1.0, 1.35, 32).rotateX(-Math.PI / 2), brillo(PALETA.helios), x, 0, 0, { contorno: false, sombra: false });
    fino(() => {
      for (const [dx, dz, r] of [[0, 0, 0.75], [0.55, 0.3, 0.5], [-0.5, 0.35, 0.55], [0.1, -0.55, 0.5]] as const) {
        pieza(estallidos, esfera(r), toon(PALETA.helios), x + dx, r * 0.7, dz, { sombra: false });
      }
    });
  }
  oculto(avisoBombas);
  oculto(estallidos);

  // ------------------------------------------------------------ animaciones

  const helices = (d: number, vueltas: number) => [
    rot('helice_i', ciclo(d, (f) => [0, 0, f * 360 * vueltas])),
    rot('helice_d', ciclo(d, (f) => [0, 0, -f * 360 * vueltas])),
  ];
  const mirar = (d: number) => mov(raiz, 'pupilas', ciclo(d, (f) => [sen(f) * 0.08, Math.max(0, sen(f, 2)) * -0.03, 0]));
  const caerBomba = (k: number) => {
    // Cada cápsula cae desde la bodega hasta su marca, abriéndose hacia fuera.
    const x = BOMBAS[k] - (k - 1) * 0.28;
    const y = -(ALTURA - 1.3 - 0.12) + 0.2;
    return mov(raiz, `bomba_${k + 1}`, poses([[0, 0, 0, 0], [0.6, 0, -0.12, 0], [0.9, 0, -0.18, 0], [1.1, x * 0.35, y * 0.3, -0.05], [1.35, x, y, -0.08], [2.4, x, y, -0.08], [2.45, 0, 0, 0], [2.6, 0, 0, 0]]));
  };

  const animaciones = [
    animacion('Flotar', 2.4, [
      mov(raiz, 'cuerpo', ciclo(2.4, (f) => [0, sen(f) * 0.15, 0])),
      rot('cuerpo', ciclo(2.4, (f) => [sen(f, 1, 0.25) * 3, sen(f) * 4, sen(f) * 3])),
      rot('gondola', ciclo(2.4, (f) => [sen(f, 1, 0.4) * 3, 0, sen(f, 1, 0.2) * 4])),
      ...helices(2.4, 4),
      esc('globo', ciclo(2.4, (f) => { const k = 1 + 0.015 * sen(f, 2); return [k, k, 1 - 0.01 * sen(f, 2)]; })),
      esc('nucleo', ciclo(2.4, (f) => { const k = 1 + 0.06 * sen(f, 2); return [k, k, k]; })),
      mirar(2.4),
      esc('cara', ciclo(2.4, (f) => { const k = f > 0.62 && f < 0.66 ? 0.1 : 1; return [1, k, 1]; })),
    ], 'movimiento', 'Flota cabeceando, las hélices giran, el núcleo late y mira a los lados.'),

    animacion('Entrada', 3.0, [
      // Baja del cielo desinflado, se hincha, abre los ojos y da un bocinazo de gas.
      mov(raiz, 'cuerpo', poses([[0, 0, 7, 0], [1.6, 0, 0.6, 0], [2.0, 0, -0.35, 0], [2.4, 0, 0.12, 0], [3.0, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [1.6, -6, 30, 4], [2.0, 6, 0, -3], [2.4, -2, 0, 1], [3.0, 0, 0, 0]])),
      esc('globo', poses([[0, 0.7, 0.55, 0.85], [1.5, 0.8, 0.7, 0.9], [2.0, 1.12, 1.15, 1.05], [2.3, 0.96, 0.95, 0.99], [2.6, 1.02, 1.03, 1], [3.0, 1, 1, 1]])),
      rot('helice_i', poses([[0, 0, 0, 0], [1.4, 0, 0, 100], [3.0, 0, 0, 1440]])),
      rot('helice_d', poses([[0, 0, 0, 0], [1.4, 0, 0, -100], [3.0, 0, 0, -1440]])),
      esc('cara', poses([[0, 1, 0.08, 1], [1.9, 1, 0.08, 1], [2.05, 1.1, 1.25, 1], [2.3, 1, 1, 1], [3.0, 1, 1, 1]])),
      mov(raiz, 'cejas', poses([[0, 0, 0, 0], [2.0, 0, 0.12, 0], [2.4, 0, -0.1, 0], [3.0, 0, 0, 0]])),
      esc('nube', poses([[0, 0.001, 0.001, 0.001], [2.3, 0.001, 0.001, 0.001], [2.45, 0.35, 0.35, 0.35], [2.8, 0.45, 0.45, 0.45], [3.0, 0.001, 0.001, 0.001]])),
    ], 'reaccion', 'Entrada: baja del cielo medio desinflado, se hincha de golpe, abre los ojos y da un bocinazo de gas rojo.', false),

    animacion('Rociar', 3.0, [
      // Aviso (0–1,1 s): baja el morro, los depósitos se hinchan, gotean las
      // boquillas y aparece la diana en el suelo. Golpe (1,1–2,2 s): rocía.
      rot('cuerpo', poses([[0, 0, 0, 0], [0.9, 9, 0, 0], [1.1, 10, 0, 0], [1.4, 10, -10, 0], [1.8, 10, 10, 0], [2.2, 9, 0, 0], [3.0, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.9, 0, 0.2, -0.3], [1.1, 0, 0.15, -0.3], [1.25, 0, 0.25, -0.5], [2.2, 0, 0.2, -0.4], [3.0, 0, 0, 0]])),
      esc('tanques', poses([[0, 1, 1, 1], [0.9, 1.18, 1.18, 1.05], [1.0, 1.12, 1.12, 1.03], [1.1, 1.2, 1.2, 1.05], [1.3, 0.9, 0.9, 0.98], [2.2, 0.88, 0.88, 0.97], [3.0, 1, 1, 1]])),
      esc('globo', poses([[0, 1, 1, 1], [1.1, 1.04, 1.04, 1], [1.3, 0.97, 0.97, 1.02], [3.0, 1, 1, 1]])),
      esc('nube', poses([[0, 0.001, 0.001, 0.001], [0.3, 0.12, 0.12, 0.12], [0.5, 0.05, 0.05, 0.05], [0.7, 0.15, 0.15, 0.15], [0.9, 0.05, 0.05, 0.05], [1.1, 0.1, 0.1, 0.1], [1.3, 0.8, 0.8, 0.8], [1.6, 0.74, 0.84, 0.76], [1.9, 0.83, 0.77, 0.83], [2.2, 0.8, 0.8, 0.8], [2.45, 0.001, 0.001, 0.001], [3.0, 0.001, 0.001, 0.001]])),
      esc('aviso_rocio', poses([[0, 0.001, 0.001, 0.001], [0.15, 0.4, 1, 0.4], [0.7, 1, 1, 1], [0.8, 1.06, 1, 1.06], [0.9, 1, 1, 1], [1.0, 1.06, 1, 1.06], [1.1, 1, 1, 1], [1.15, 0.001, 0.001, 0.001], [3.0, 0.001, 0.001, 0.001]])),
      mov(raiz, 'cejas', poses([[0, 0, 0, 0], [0.8, 0, -0.1, 0], [2.2, 0, -0.1, 0], [3.0, 0, 0, 0]])),
      ...helices(3, 6),
    ], 'ataque', 'Aviso de 0 a 1,1 s: baja el morro, hincha los depósitos y una diana roja marca el suelo. Rocía un cono de gas de 1,1 a 2,2 s.', false),

    animacion('Bombardeo', 2.6, [
      // Aviso (0–0,9 s): abre la bodega, las cápsulas asoman y parpadean y
      // aparecen tres anillos rojos. Golpe (1,35–1,7 s): estallan en el suelo.
      rot('compuerta_i', poses([[0, 0, 0, 0], [0.4, 0, 0, -100], [2.1, 0, 0, -100], [2.6, 0, 0, 0]])),
      rot('compuerta_d', poses([[0, 0, 0, 0], [0.4, 0, 0, 100], [2.1, 0, 0, 100], [2.6, 0, 0, 0]])),
      ...BOMBAS.map((_, k) => caerBomba(k)),
      ...BOMBAS.map((_, k) => esc(`bomba_${k + 1}`, poses([[0, 1, 1, 1], [0.5, 1, 1, 1], [0.6, 1.25, 1.25, 1.25], [0.7, 1, 1, 1], [0.8, 1.25, 1.25, 1.25], [0.9, 1, 1, 1], [1.33, 1, 1.15, 1], [1.37, 0.001, 0.001, 0.001], [2.5, 0.001, 0.001, 0.001], [2.6, 1, 1, 1]]))),
      esc('aviso_bombas', poses([[0, 0.001, 0.001, 0.001], [0.15, 0.5, 1, 0.5], [0.6, 1, 1, 1], [0.8, 1.08, 1, 1.08], [1.0, 1, 1, 1], [1.2, 1.08, 1, 1.08], [1.34, 1, 1, 1], [1.36, 0.001, 0.001, 0.001], [2.6, 0.001, 0.001, 0.001]])),
      esc('estallidos', poses([[0, 0.001, 0.001, 0.001], [1.34, 0.001, 0.001, 0.001], [1.42, 1.1, 1.3, 1.1], [1.7, 1.25, 1, 1.25], [2.0, 0.001, 0.001, 0.001], [2.6, 0.001, 0.001, 0.001]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.9, 0, -0.15, 0], [1.1, 0, 0.35, 0], [1.6, 0, 0.2, 0], [2.6, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.9, 4, 0, 0], [1.1, -6, 0, 0], [2.6, 0, 0, 0]])),
      esc('cara', poses([[0, 1, 1, 1], [0.9, 1.15, 0.7, 1], [1.35, 1.15, 1.2, 1], [2.0, 1, 1, 1], [2.6, 1, 1, 1]])),
      ...helices(2.6, 5),
    ], 'ataque', 'Aviso de 0 a 0,9 s: abre la bodega y tres anillos rojos marcan el suelo. Suelta las cápsulas en 0,9 s; estallan en 1,35 s.', false),

    animacion('Golpe recibido', 0.45, [
      esc('globo', poses([[0, 1, 1, 1], [0.06, 1.1, 0.85, 1.06], [0.2, 0.95, 1.06, 0.97], [0.32, 1.02, 0.98, 1.01], [0.45, 1, 1, 1]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.06, -6, 0, 5], [0.2, 3, 0, -3], [0.45, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.06, 0, 0.15, -0.15], [0.45, 0, 0, 0]])),
      esc('cara', poses([[0, 1, 1, 1], [0.06, 1.15, 0.2, 1], [0.3, 1, 1, 1], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'El globo se abolla y rebota; cierra los ojos de golpe.', false),

    animacion('Furia', 2.6, [
      // Fase 2: el globo se raja, el gas se escapa silbando, se revuelve en
      // el aire y el núcleo se rodea de un aura.
      esc('desgarro', poses([[0, 0.001, 0.001, 0.001], [0.5, 0.001, 0.001, 0.001], [0.6, 1.3, 1.3, 1.3], [0.8, 1, 1, 1], [2.6, 1, 1, 1]])),
      esc('fuga', poses([[0, 0.001, 0.001, 0.001], [0.55, 0.001, 0.001, 0.001], [0.8, 1.5, 1.5, 1.5], [1.4, 1.1, 1.1, 1.1], [2.6, 1, 1, 1]])),
      esc('aura', poses([[0, 0.001, 0.001, 0.001], [1.2, 0.001, 0.001, 0.001], [1.5, 1.4, 1.4, 1.4], [1.8, 1, 1, 1], [2.6, 1, 1, 1]])),
      esc('globo', poses([[0, 1, 1, 1], [0.5, 1.06, 1.06, 1.03], [0.6, 0.9, 0.88, 0.97], [1.0, 0.97, 0.96, 1], [2.6, 0.98, 0.97, 1]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.6, 0, 0, -12], [1.0, 0, 40, 8], [1.5, 0, -25, -5], [2.0, 0, 8, 2], [2.6, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.6, 0.3, -0.3, 0], [1.2, -0.2, 0.3, 0], [2.0, 0, 0.1, 0], [2.6, 0, 0, 0]])),
      mov(raiz, 'cejas', poses([[0, 0, 0, 0], [0.6, 0, 0.12, 0], [1.4, 0, -0.14, 0], [2.6, 0, -0.1, 0]])),
      esc('pupilas', poses([[0, 1, 1, 1], [0.6, 0.6, 0.6, 1], [1.4, 1.35, 1.35, 1], [2.6, 1.2, 1.2, 1]])),
      ...helices(2.6, 9),
    ], 'reaccion', 'Fase 2: el globo se raja y el gas rojo se escapa; se revuelve en el aire, frunce el ceño y el núcleo se rodea de un aura.', false),

    animacion('Enfurecido', 1.2, [
      // Capa de la fase 2: solo toca el desgarro, la fuga y el aura.
      esc('fuga', ciclo(1.2, (f) => { const k = 0.8 + ((f * 2) % 1) * 0.6; return [k, k, k]; })),
      mov(raiz, 'fuga', ciclo(1.2, (f) => [((f * 2) % 1) * 0.15, ((f * 2) % 1) * 0.12, 0])),
      esc('desgarro', ciclo(1.2, (f) => [1 + 0.06 * sen(f, 4), 1 + 0.08 * sen(f, 3), 1])),
      esc('aura', ciclo(1.2, (f) => { const k = 1 + 0.15 * sen(f, 2); return [k, k, k]; })),
    ], 'reaccion', 'Fase 2, en bucle y a la vez que cualquier otro clip: el gas sale a borbotones del desgarro y el aura del núcleo late.'),

    animacion('Derrota', 4.0, [
      // Se desinfla dando vueltas y cae al suelo, arrugado.
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.4, 0, 0.3, 0], [3.2, 0.6, -ALTURA + 1.45, -0.4], [3.45, 0.6, -ALTURA + 1.65, -0.4], [3.7, 0.6, -ALTURA + 1.45, -0.4], [4.0, 0.6, -ALTURA + 1.45, -0.4]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.4, -8, 0, 6], [3.2, 8, 540, -8], [3.45, 5, 548, -5], [4.0, 6, 550, -6]])),
      // La góndola y los depósitos se hunden en el globo arrugado.
      mov(raiz, 'gondola', poses([[0, 0, 0, 0], [1.6, 0, 0.1, 0], [3.2, 0, 0.62, 0], [4.0, 0, 0.62, 0]])),
      mov(raiz, 'tanques', poses([[0, 0, 0, 0], [1.6, 0, 0.1, 0], [3.2, 0, 0.36, 0], [4.0, 0, 0.36, 0]])),
      esc('globo', poses([[0, 1, 1, 1], [0.3, 1.08, 1.1, 1.04], [0.6, 0.85, 0.8, 1], [1.0, 0.95, 0.9, 1], [1.6, 0.75, 0.6, 0.95], [2.4, 0.8, 0.5, 0.9], [3.2, 0.72, 0.36, 0.88], [3.45, 0.78, 0.32, 0.9], [4.0, 0.76, 0.34, 0.89]])),
      rot('globo', poses([[0, 0, 0, 0], [1.0, 0, 0, 8], [2.0, 0, 0, -10], [3.2, 6, 0, 4], [4.0, 6, 0, 4]])),
      rot('helice_i', poses([[0, 0, 0, 0], [2.5, 0, 0, 500], [4.0, 0, 0, 540]])),
      rot('helice_d', poses([[0, 0, 0, 0], [2.5, 0, 0, -500], [4.0, 0, 0, -540]])),
      esc('cara', poses([[0, 1, 1, 1], [0.3, 1.25, 1.25, 1], [0.6, 1.15, 0.1, 1], [4.0, 1.15, 0.1, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [0.5, 1.4, 1.4, 1.4], [1.2, 0.6, 0.6, 0.6], [3.2, 0.5, 0.5, 0.5], [4.0, 0.5, 0.5, 0.5]])),
      rot('gondola', poses([[0, 0, 0, 0], [3.2, 0, 0, 12], [3.45, 0, 0, -6], [4.0, 0, 0, 2]])),
      esc('nube', poses([[0, 0.001, 0.001, 0.001], [0.5, 0.001, 0.001, 0.001], [0.7, 0.4, 0.4, 0.4], [1.2, 0.25, 0.25, 0.25], [1.6, 0.001, 0.001, 0.001], [4.0, 0.001, 0.001, 0.001]])),
    ], 'reaccion', 'Se desinfla soltando gas, gira sin control con las hélices parándose y cae al suelo arrugado.', false),
  ];

  return { id: 'heraldo', nombre: 'Heraldo del Velo', rol: 'Jefe de HELIOS · minuto 5', raiz, animaciones };
}
