import * as THREE from 'three';
import {
  animacion, brillo, caja, capsula, ciclo, contorno, esc, esfera, mov, nodo, parpadeo, pieza, poses, rot, toon,
  type Clave, type Modelo,
} from './kit';

// El perro del operador: un bichón blanco de pelo de nube, nariz negra,
// lengua siempre fuera y pajarita. Hecho con bolas de pelo solapadas y el
// contorno de dibujo del resto de personajes. Mira hacia +z y su origen está
// en el suelo, entre las patas. Mide 1 m con la cabeza (el juego lo escala).
//
// Dos versiones, como en las fotos:
//   · con pajarita de cuadros blancos y negros;
//   · «de paseo»: gorra turquesa del revés, gafas de sol plateadas y pajarita verde.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);

const BLANCO = '#f8f6f1';
const NUBE = '#eee8dd';
const CREMA = '#ecdcc2';
const NEGRO = '#1a1514';
const LENGUA = '#e9849c';

export interface OpcionesPerro {
  pajarita: 'cuadros' | 'verde' | null;
  gorra: boolean;
  gafas: boolean;
}

/** Tela de cuadros vichy en blanco y negro, para la pajarita. */
function vichy(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const a = x % 2 === 0, b = y % 2 === 0;
      ctx.fillStyle = a && b ? '#15151a' : a || b ? '#8a8a92' : '#f4f4f4';
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crearPerro(opciones: OpcionesPerro = { pajarita: 'cuadros', gorra: false, gafas: false }): Modelo {
  const cool = opciones.gorra || opciones.gafas;
  const raiz = new THREE.Group();
  raiz.name = cool ? 'perro-paseo' : 'perro';
  const cuerpo = nodo('cuerpo', raiz, 0, 0.4, 0);

  // Tronco: una nube de bolas de pelo.
  pieza(cuerpo, esfera(0.27, 1, 0.92, 1.3), toon(BLANCO));
  for (const s of [1, -1]) {
    pieza(cuerpo, esfera(0.15), toon(BLANCO), 0.17 * s, 0.02, 0.1);
    pieza(cuerpo, esfera(0.15), toon(NUBE), 0.17 * s, 0.0, -0.13);
  }
  pieza(cuerpo, esfera(0.17), toon(BLANCO), 0, -0.02, 0.26);
  pieza(cuerpo, esfera(0.16), toon(BLANCO), 0, 0.13, -0.12);

  // Patas: columnas de pelo con almohadilla redonda.
  for (const [nombre, x, z] of [['pata_di', 0.13, 0.17], ['pata_dd', -0.13, 0.17], ['pata_ti', 0.13, -0.17], ['pata_td', -0.13, -0.17]] as const) {
    const pata = nodo(nombre, cuerpo, x, -0.16, z);
    pieza(pata, capsula(0.075, 0.12), toon(BLANCO), 0, -0.1, 0);
    pieza(pata, esfera(0.085, 1, 0.7, 1.15), toon(NUBE), 0, -0.2, 0.02);
  }

  // Cola: un pompón doble.
  const rabo = nodo('cola', cuerpo, 0, 0.12, -0.34);
  rabo.rotation.x = -0.5;
  pieza(rabo, esfera(0.12), toon(BLANCO), 0, 0.09, -0.03);
  pieza(rabo, esfera(0.09), toon(NUBE), 0, 0.19, -0.01);

  // Cabeza: grande y redonda, con copete, mejillas y hocico crema.
  const cuello = nodo('cuello', cuerpo, 0, 0.12, 0.26);
  const cabeza = nodo('cabeza', cuello, 0, 0.2, 0.06);
  pieza(cabeza, esfera(0.27, 1.05, 1, 1), toon(BLANCO), 0, 0.02, 0);
  if (!opciones.gorra) {
    pieza(cabeza, esfera(0.18), toon(BLANCO), 0, 0.2, -0.02);
    for (const s of [1, -1]) pieza(cabeza, esfera(0.12), toon(NUBE), 0.12 * s, 0.17, 0);
  }
  for (const s of [1, -1]) pieza(cabeza, esfera(0.12), toon(BLANCO), 0.14 * s, -0.1, 0.12);
  // Hocico sin contorno: se funde con la cara y la nariz manda.
  pieza(cabeza, esfera(0.12, 1.1, 0.8, 0.9), toon(CREMA), 0, -0.08, 0.21, { contorno: false });
  pieza(cabeza, esfera(0.08), toon(CREMA), 0, -0.15, 0.2, { contorno: false });
  pieza(cabeza, esfera(0.045, 1.35, 0.95, 0.9), toon(NEGRO), 0, -0.05, 0.31, { contorno: false });
  pieza(cabeza, esfera(0.01), brillo('#8a8a8a'), 0.015, -0.03, 0.35, { contorno: false, sombra: false });

  // Boca: mandíbula que se abre y la lengua rosa, casi siempre fuera.
  const mandibula = nodo('mandibula', cabeza, 0, -0.12, 0.24);
  pieza(mandibula, esfera(0.06, 1.2, 0.6, 1), toon(CREMA), 0, -0.02, 0);
  const lengua = nodo('lengua', mandibula, 0, -0.03, 0.03);
  lengua.rotation.x = 0.5;
  pieza(lengua, caja(0.085, 0.022, 0.14, 0.011), toon(LENGUA), 0, 0, 0.06);

  // Ojos: redondos y oscuros, con su brillo.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const ojo = nodo(`ojo_${lado}`, cabeza, 0.105 * s, 0.06, 0.235);
    pieza(ojo, esfera(0.062, 1, 1.08, 0.7), brillo('#1c120d'), 0, 0, 0, { contorno: false });
    pieza(ojo, esfera(0.019), brillo('#ffffff'), 0.02 * s, 0.025, 0.04, { contorno: false, sombra: false });
    pieza(ojo, esfera(0.009), brillo('#ffffff'), -0.015 * s, -0.018, 0.042, { contorno: false, sombra: false });
    // Orejas caídas: tres bolas de pelo colgando.
    const oreja = nodo(`oreja_${lado}`, cabeza, 0.25 * s, 0.06, -0.02);
    oreja.rotation.z = 0.15 * s;
    pieza(oreja, esfera(0.11, 0.8, 1, 0.9), toon(BLANCO), 0, -0.06, 0);
    pieza(oreja, esfera(0.1, 0.8, 1, 0.9), toon(NUBE), 0.02 * s, -0.18, 0.01);
    pieza(oreja, esfera(0.085), toon(NUBE), 0.03 * s, -0.28, 0.02);
  }

  // ---------------------------------------------------- Accesorios
  if (opciones.pajarita) {
    const tela = opciones.pajarita === 'cuadros'
      ? new THREE.MeshToonMaterial({ map: vichy() })
      : toon('#5fb043');
    const pajarita = nodo('pajarita', cuello, 0, -0.07, 0.15);
    for (const s of [1, -1]) {
      const ala = pieza(pajarita, caja(0.13, 0.1, 0.04, 0.03), tela, 0.075 * s, 0, 0);
      ala.rotation.z = 0.28 * s;
    }
    pieza(pajarita, caja(0.05, 0.06, 0.05, 0.02), tela, 0, 0, 0.01);
  }
  if (opciones.gorra) {
    const gorra = nodo('gorra', cabeza, 0, 0.12, 0);
    const turquesa = toon('#2fb3a3');
    pieza(gorra, new THREE.SphereGeometry(0.26, 24, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.62, 1.02), turquesa);
    // Del revés: la visera mira hacia atrás y la cinta queda en la frente.
    const visera = pieza(gorra, caja(0.3, 0.03, 0.2, 0.014), turquesa, 0, 0.01, -0.3);
    visera.rotation.x = -0.15;
    pieza(gorra, esfera(0.025), turquesa, 0, 0.16, 0);
    pieza(gorra, caja(0.14, 0.035, 0.02, 0.01), toon('#1d8579'), 0, 0.02, 0.255);
    pieza(gorra, caja(0.03, 0.03, 0.02, 0.01), toon('#c9ccd4'), 0.05, 0.02, 0.262, { contorno: false });
    // Pelo que asoma por debajo de la gorra.
    for (const s of [1, -1]) pieza(cabeza, esfera(0.1), toon(NUBE), 0.2 * s, 0.11, 0.02);
  }
  if (opciones.gafas) {
    const gafas = nodo('gafas', cabeza, 0, 0.065, 0.292);
    const plata = toon('#c9ccd4');
    for (const s of [1, -1]) {
      const marco = pieza(gafas, caja(0.18, 0.125, 0.025, 0.045), plata, 0.092 * s, 0, -0.005);
      marco.rotation.y = 0.18 * s;
      const cristal = pieza(gafas, caja(0.155, 0.1, 0.02, 0.035), toon('#2a2e36'), 0.094 * s, 0, 0.008, { contorno: false });
      cristal.rotation.y = 0.18 * s;
      pieza(gafas, caja(0.04, 0.012, 0.005, 0.004), brillo('#9aa4b8'), 0.06 * s + 0.02, 0.02, 0.022, { contorno: false, sombra: false });
      pieza(gafas, caja(0.015, 0.02, 0.24, 0.006), plata, 0.175 * s, 0.01, -0.12);
    }
    pieza(gafas, caja(0.05, 0.02, 0.02, 0.008), plata, 0, 0.02, 0.01);
  }

  // Línea más fina: con la del astronauta, un perro de 1 m quedaba todo borde.
  const fino = contorno(0.016);
  raiz.traverse((o) => { if (o.userData.contorno) (o as THREE.Mesh).material = fino; });

  // ---------------------------------------------------- Animaciones

  // Piezas que se repiten entre animaciones.
  const jadeo = (d: number, veces: number, abre = 12): THREE.KeyframeTrack[] => [
    rot('mandibula', ciclo(d, (f) => [abre + sen(f, veces) * 4, 0, 0])),
    rot('lengua', ciclo(d, (f) => [29 + sen(f, veces) * 8, 0, 0])),
    esc('lengua', ciclo(d, (f) => [1, 1, 1 + 0.12 * sen(f, veces)])),
  ];
  const cola = (d: number, veces: number, amp: number, alto = -29): THREE.KeyframeTrack => rot('cola', ciclo(d, (f) => [alto, sen(f, veces) * amp, 0]));
  const fijo = (n: string, d: number, x: number, y = 0, z = 0) => rot(n, ciclo(d, () => [x, y, z]));
  const orejas = (d: number, fn: (f: number) => [number, number]) => [
    rot('oreja_i', ciclo(d, (f) => { const [x, z] = fn(f); return [x, 0, 9 + z]; })),
    rot('oreja_d', ciclo(d, (f) => { const [x, z] = fn(f); return [x, 0, -9 - z]; })),
  ];
  const parpados = (claves: Clave[]) => [esc('ojo_i', claves), esc('ojo_d', claves)];
  // Sentado: el cuerpo se inclina atrás, las patas traseras se doblan hacia
  // delante y las delanteras quedan rectas en el suelo.
  const sentado = (d: number, extra = 0): THREE.KeyframeTrack[] => [
    rot('cuerpo', ciclo(d, () => [-28 - extra, 0, 0])),
    mov(raiz, 'cuerpo', ciclo(d, () => [0, -0.09 - extra * 0.002, -0.04])),
    fijo('pata_ti', d, -62), fijo('pata_td', d, -62),
    fijo('pata_di', d, 28 + extra), fijo('pata_dd', d, 28 + extra),
    fijo('cuello', d, 22 + extra * 0.5),
  ];
  const trote = (d: number, amp: number): THREE.KeyframeTrack[] => [
    rot('pata_di', ciclo(d, (f) => [sen(f) * amp, 0, 0])),
    rot('pata_td', ciclo(d, (f) => [sen(f) * amp, 0, 0])),
    rot('pata_dd', ciclo(d, (f) => [-sen(f) * amp, 0, 0])),
    rot('pata_ti', ciclo(d, (f) => [-sen(f) * amp, 0, 0])),
  ];

  const animaciones = [
    animacion('Reposo', 2.0, [
      ...jadeo(2, 8),
      cola(2, 4, 28),
      esc('cuerpo', ciclo(2, (f) => [1, 1 + 0.02 * sen(f, 8), 1])),
      rot('cabeza', ciclo(2, (f) => [sen(f) * 3, sen(f) * 14, f > 0.55 && f < 0.85 ? 14 : 0])),
      ...orejas(2, (f) => [0, sen(f, 2) * 4]),
      ...parpados(parpadeo(2, 1.2)),
    ], 'movimiento', 'De pie, jadeando con la lengua fuera y moviendo la cola.'),

    animacion('Caminar', 0.6, [
      ...trote(0.6, 30),
      mov(raiz, 'cuerpo', ciclo(0.6, (f) => [0, Math.abs(sen(f)) * 0.03, 0])),
      rot('cabeza', ciclo(0.6, (f) => [sen(f, 2) * 3, 0, 0])),
      cola(0.6, 2, 22, -20),
      ...jadeo(0.6, 2),
      ...orejas(0.6, (f) => [sen(f, 2) * 8, 0]),
    ], 'movimiento', 'Trote alegre: patas en diagonal y la cola alta.'),

    animacion('Moverse', 0.36, [
      // Galope: delanteras juntas, traseras juntas, el cuerpo ondula.
      rot('pata_di', ciclo(0.36, (f) => [sen(f) * 55, 0, 0])),
      rot('pata_dd', ciclo(0.36, (f) => [sen(f + 0.08) * 55, 0, 0])),
      rot('pata_ti', ciclo(0.36, (f) => [-sen(f) * 55, 0, 0])),
      rot('pata_td', ciclo(0.36, (f) => [-sen(f + 0.08) * 55, 0, 0])),
      rot('cuerpo', ciclo(0.36, (f) => [cos(f) * 8, 0, 0])),
      mov(raiz, 'cuerpo', ciclo(0.36, (f) => [0, Math.abs(sen(f)) * 0.1, 0])),
      rot('cuello', ciclo(0.36, (f) => [-cos(f) * 6 - 6, 0, 0])),
      ...orejas(0.36, (f) => [-45 + sen(f, 2) * 10, 25]),
      cola(0.36, 2, 12, 10),
      rot('mandibula', ciclo(0.36, () => [18, 0, 0])),
      rot('lengua', ciclo(0.36, (f) => [10 + sen(f, 2) * 15, sen(f) * 10, 0])),
    ], 'movimiento', 'Galope a toda velocidad con las orejas al viento y la lengua flameando.'),

    animacion('Sentado', 2.0, [
      ...sentado(2),
      ...jadeo(2, 8),
      // La cola barre el suelo de lado a lado.
      rot('cola', ciclo(2, (f) => [-80, sen(f, 3) * 35, 0])),
      rot('cabeza', ciclo(2, (f) => [0, sen(f) * 10, sen(f, 2) * 6])),
      ...parpados(parpadeo(2, 1.5)),
    ], 'movimiento', 'Sentado mirándote, barriendo el suelo con la cola.'),

    animacion('Olfatear', 1.2, [
      fijo('cuerpo', 1.2, 10),
      rot('cuello', ciclo(1.2, (f) => [42 + sen(f, 2) * 4, sen(f) * 18, 0])),
      rot('cabeza', ciclo(1.2, (f) => [sen(f, 10) * 4, 0, 0])),
      ...trote(1.2, 8),
      cola(1.2, 3, 30),
      fijo('mandibula', 1.2, 0),
      ...orejas(1.2, () => [20, 0]),
    ], 'movimiento', 'Nariz al suelo, siguiendo un rastro con olfateos rápidos.'),

    animacion('Escarbar', 0.5, [
      fijo('cuerpo', 0.5, 16),
      mov(raiz, 'cuerpo', ciclo(0.5, () => [0, -0.04, 0])),
      fijo('cuello', 0.5, 35),
      rot('pata_di', ciclo(0.5, (f) => [-50 + sen(f, 2) * 45, 0, 0])),
      rot('pata_dd', ciclo(0.5, (f) => [-50 - sen(f, 2) * 45, 0, 0])),
      fijo('pata_ti', 0.5, -12), fijo('pata_td', 0.5, -12),
      cola(0.5, 2, 35, -10),
      ...orejas(0.5, (f) => [10, sen(f, 2) * 10]),
    ], 'reaccion', 'Escarba la nieve con las patas delanteras a toda prisa.'),

    animacion('Sacudirse', 0.9, [
      rot('cuerpo', poses([[0, 0, 0, 0], [0.08, 0, 0, 28], [0.18, 0, 0, -28], [0.28, 0, 0, 26], [0.38, 0, 0, -24], [0.48, 0, 0, 18], [0.6, 0, 0, -12], [0.75, 0, 0, 4], [0.9, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.08, 0, 0, -30], [0.18, 0, 0, 30], [0.28, 0, 0, -28], [0.38, 0, 0, 26], [0.48, 0, 0, -18], [0.6, 0, 0, 12], [0.9, 0, 0, 0]])),
      rot('oreja_i', poses([[0, 0, 0, 9], [0.1, 0, 0, 75], [0.2, 0, 0, -20], [0.3, 0, 0, 70], [0.4, 0, 0, -10], [0.55, 0, 0, 40], [0.9, 0, 0, 9]])),
      rot('oreja_d', poses([[0, 0, 0, -9], [0.1, 0, 0, 20], [0.2, 0, 0, -75], [0.3, 0, 0, 10], [0.4, 0, 0, -70], [0.55, 0, 0, -40], [0.9, 0, 0, -9]])),
      cola(0.9, 6, 40),
      ...parpados(poses([[0, 1, 1, 1], [0.05, 1, 0.1, 1], [0.7, 1, 0.1, 1], [0.8, 1, 1, 1], [0.9, 1, 1, 1]])),
    ], 'reaccion', 'Se sacude la nieve de arriba abajo, con las orejas volando.', false),

    animacion('Revolcarse', 2.2, [
      rot('cuerpo', poses([[0, 0, 0, 0], [0.4, 0, 0, -90], [0.8, 0, 0, -175], [1.4, 0, 0, -185], [1.8, 0, 0, -90], [2.2, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.4, 0, -0.14, 0], [0.8, 0, -0.06, 0], [1.4, 0, -0.06, 0], [1.8, 0, -0.14, 0], [2.2, 0, 0, 0]])),
      ...(['pata_di', 'pata_dd', 'pata_ti', 'pata_td'] as const).map((p, k) =>
        rot(p, ciclo(2.2, (f) => [f > 0.3 && f < 0.7 ? sen(f, 9) * 40 * (k % 2 ? 1 : -1) : 0, 0, 0]))),
      rot('cabeza', ciclo(2.2, (f) => [0, 0, sen(f, 3) * 15])),
      ...jadeo(2.2, 10, 20),
      cola(2.2, 8, 40),
    ], 'reaccion', 'Se tumba de espaldas y se revuelca en la nieve pataleando de gusto.', false),

    animacion('PerseguirCola', 0.9, [
      rot('cuerpo', ciclo(0.9, (f) => [0, f * 360, -8])),
      fijo('cuello', 0.9, 10, 70),
      cola(0.9, 3, 30, -10),
      ...trote(0.9, 20),
      rot('mandibula', ciclo(0.9, (f) => [10 + sen(f, 3) * 12, 0, 0])),
      ...orejas(0.9, () => [0, 35]),
    ], 'reaccion', 'Da vueltas sobre sí mismo intentando morderse la cola.'),

    animacion('Ladrar', 0.5, [
      rot('mandibula', poses([[0, 0, 0, 0], [0.06, 38, 0, 0], [0.16, 0, 0, 0], [0.25, 0, 0, 0], [0.31, 38, 0, 0], [0.41, 0, 0, 0], [0.5, 0, 0, 0]])),
      rot('cabeza', poses([[0, 0, 0, 0], [0.06, -12, 0, 0], [0.16, 4, 0, 0], [0.31, -12, 0, 0], [0.41, 4, 0, 0], [0.5, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.04, 0.95, 1.04], [0.16, 1, 1, 1], [0.31, 1.04, 0.95, 1.04], [0.41, 1, 1, 1], [0.5, 1, 1, 1]])),
      fijo('pata_di', 0.5, -14), fijo('pata_dd', 0.5, -14),
      cola(0.5, 2, 20, -40),
      ...orejas(0.5, () => [-15, 15]),
    ], 'ataque', '¡Guau, guau! Planta las patas y ladra con todo el cuerpo.'),

    animacion('Aullar', 2.2, [
      ...sentado(2.2),
      rot('cuello', poses([[0, 22, 0, 0], [0.4, -40, 0, 0], [1.9, -45, 0, 0], [2.2, 22, 0, 0]])),
      rot('mandibula', poses([[0, 0, 0, 0], [0.4, 28, 0, 0], [1.9, 24, 0, 0], [2.2, 0, 0, 0]])),
      fijo('lengua', 2.2, 70),
      ...orejas(2.2, () => [-35, 10]),
      ...parpados(poses([[0, 1, 1, 1], [0.4, 1, 0.15, 1], [1.9, 1, 0.15, 1], [2.2, 1, 1, 1]])),
      fijo('cola', 2.2, -80),
    ], 'reaccion', 'Se sienta y aúlla al cielo con los ojos cerrados.', false),

    animacion('Dormir', 3.0, [
      fijo('cuerpo', 3, 0),
      mov(raiz, 'cuerpo', ciclo(3, () => [0, -0.19, 0])),
      esc('cuerpo', ciclo(3, (f) => [1 + 0.03 * sen(f), 1 + 0.05 * sen(f), 1])),
      fijo('pata_di', 3, -82), fijo('pata_dd', 3, -82),
      fijo('pata_ti', 3, -80, 0, 20), fijo('pata_td', 3, -80, 0, -20),
      rot('cuello', ciclo(3, (f) => [38 + sen(f) * 2, 0, 0])),
      fijo('cabeza', 3, 0, 0, 18),
      fijo('mandibula', 3, 0),
      fijo('lengua', 3, 80),
      esc('lengua', ciclo(3, () => [0.6, 1, 0.4])),
      rot('cola', ciclo(3, () => [-110, 60, 0])),
      ...orejas(3, () => [10, -5]),
      ...parpados(ciclo(3, () => [1, 0.1, 1])),
    ], 'reaccion', 'Hecho un ovillo con la cabeza sobre las patas, respirando despacio.'),

    animacion('Bostezar', 1.6, [
      ...sentado(1.6),
      rot('cuello', poses([[0, 22, 0, 0], [0.4, -25, 0, 0], [1.1, -28, 0, 0], [1.6, 22, 0, 0]])),
      rot('mandibula', poses([[0, 0, 0, 0], [0.4, 48, 0, 0], [1.0, 52, 0, 0], [1.3, 0, 0, 0], [1.6, 0, 0, 0]])),
      rot('lengua', poses([[0, 29, 0, 0], [0.4, -10, 0, 0], [1.0, -10, 0, 0], [1.6, 29, 0, 0]])),
      ...parpados(poses([[0, 1, 1, 1], [0.3, 1, 0.1, 1], [1.2, 1, 0.1, 1], [1.6, 1, 1, 1]])),
      fijo('cola', 1.6, -80),
    ], 'reaccion', 'Un bostezo enorme con la lengua enroscada.', false),

    animacion('Pedir', 1.0, [
      rot('cuerpo', ciclo(1, () => [-62, 0, 0])),
      mov(raiz, 'cuerpo', ciclo(1, (f) => [0, 0.04 + sen(f) * 0.015, -0.08])),
      fijo('pata_ti', 1, -40), fijo('pata_td', 1, -40),
      rot('pata_di', ciclo(1, (f) => [-40 + sen(f, 2) * 25, 0, 0])),
      rot('pata_dd', ciclo(1, (f) => [-40 - sen(f, 2) * 25, 0, 0])),
      fijo('cuello', 1, 55),
      rot('cabeza', ciclo(1, (f) => [0, 0, sen(f) * 12])),
      ...jadeo(1, 4),
      rot('cola', ciclo(1, (f) => [-95, sen(f, 3) * 30, 0])),
    ], 'reaccion', 'Se pone de pie sobre las patas traseras y pide con las delanteras.'),

    animacion('Rascarse', 0.8, [
      ...sentado(0.8),
      rot('pata_ti', ciclo(0.8, (f) => [-95 + sen(f, 4) * 20, 0, 30])),
      rot('cabeza', ciclo(0.8, () => [0, 0, 22])),
      rot('oreja_i', ciclo(0.8, (f) => [0, 0, 9 + sen(f, 4) * 12])),
      ...parpados(ciclo(0.8, () => [1, 0.3, 1])),
      ...jadeo(0.8, 4, 16),
      fijo('cola', 0.8, -80),
    ], 'reaccion', 'Sentado, se rasca la oreja con la pata trasera, entornando los ojos de gusto.'),

    animacion('Celebrar', 0.8, [
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.1, 0, -0.06, 0], [0.4, 0, 0.42, 0], [0.7, 0, 0, 0], [0.8, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.1, 0, 0, 0], [0.7, 0, 360, 0], [0.8, 0, 360, 0]])),
      ...(['pata_di', 'pata_dd', 'pata_ti', 'pata_td'] as const).map((p, k) =>
        rot(p, poses([[0, 0, 0, 0], [0.15, k < 2 ? -60 : 60, 0, 0], [0.6, k < 2 ? -40 : 40, 0, 0], [0.8, 0, 0, 0]]))),
      ...orejas(0.8, (f) => [-30 * sen(f / 2), 40 * sen(f / 2)]),
      ...jadeo(0.8, 4, 20),
      cola(0.8, 6, 40, -10),
    ], 'reaccion', 'Pega un salto dando una vuelta en el aire de pura alegría.', false),

    animacion('Resbalar', 1.0, [
      // Sobre el hielo: patas abiertas, tambaleándose.
      mov(raiz, 'cuerpo', ciclo(1, () => [0, -0.07, 0])),
      rot('cuerpo', ciclo(1, (f) => [sen(f, 2) * 5, sen(f) * 10, sen(f) * 10])),
      rot('pata_di', ciclo(1, (f) => [-15 + sen(f, 2) * 10, 0, 35])),
      rot('pata_dd', ciclo(1, (f) => [-15 - sen(f, 2) * 10, 0, -35])),
      rot('pata_ti', ciclo(1, (f) => [15 + sen(f, 2) * 10, 0, 35])),
      rot('pata_td', ciclo(1, (f) => [15 - sen(f, 2) * 10, 0, -35])),
      ...parpados(ciclo(1, () => [1.3, 1.3, 1])),
      rot('mandibula', ciclo(1, () => [20, 0, 0])),
      ...orejas(1, (f) => [0, 30 + sen(f, 2) * 15]),
      cola(1, 4, 25, 5),
    ], 'reaccion', 'Patina en el hielo con las cuatro patas abiertas.'),

    animacion('Hablar', 1.4, [
      // La inclinación de cabeza de «¿qué dices?».
      rot('cabeza', poses([[0, 0, 0, 0], [0.25, 0, 0, 24], [0.65, 0, 0, 24], [0.9, 0, 0, -22], [1.25, 0, 0, -22], [1.4, 0, 0, 0]])),
      ...orejas(1.4, () => [-25, -4]),
      rot('mandibula', ciclo(1.4, (f) => [6 + Math.abs(sen(f, 3)) * 10, 0, 0])),
      fijo('lengua', 1.4, 29),
      cola(1.4, 4, 28),
    ], 'reaccion', 'Ladea la cabeza a un lado y al otro, con las orejas atentas.'),

    animacion('Escanear', 1.4, [
      rot('cuello', poses([[0, 0, 0, 0], [0.25, -32, 0, 0], [0.7, -32, 25, 0], [1.1, -32, -25, 0], [1.4, 0, 0, 0]])),
      rot('cabeza', ciclo(1.4, (f) => [sen(f, 12) * 3, 0, 0])),
      fijo('mandibula', 1.4, 0),
      fijo('lengua', 1.4, 80),
      esc('lengua', ciclo(1.4, () => [0.5, 1, 0.3])),
      ...orejas(1.4, () => [-30, -6]),
      cola(1.4, 2, 10, -50),
    ], 'ataque', 'Olfatea el aire con el hocico en alto, barriendo de lado a lado.', false),

    animacion('Atacar', 0.5, [
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.1, 0, -0.04, -0.08], [0.22, 0, 0.06, 0.22], [0.5, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.1, 10, 0, 0], [0.22, -8, 0, 0], [0.5, 0, 0, 0]])),
      rot('mandibula', poses([[0, 0, 0, 0], [0.12, 45, 0, 0], [0.24, 0, 0, 0], [0.5, 0, 0, 0]])),
      rot('pata_di', poses([[0, 0, 0, 0], [0.22, -55, 0, 0], [0.5, 0, 0, 0]])),
      rot('pata_dd', poses([[0, 0, 0, 0], [0.22, -55, 0, 0], [0.5, 0, 0, 0]])),
      rot('pata_ti', poses([[0, 0, 0, 0], [0.22, 40, 0, 0], [0.5, 0, 0, 0]])),
      rot('pata_td', poses([[0, 0, 0, 0], [0.22, 40, 0, 0], [0.5, 0, 0, 0]])),
      ...orejas(0.5, () => [-40, 20]),
    ], 'ataque', 'Se lanza hacia delante y lanza un mordisco.', false),

    animacion('Habilidad', 1.0, [
      // Ladrido potente: se agacha, coge aire y suelta un ¡GUAU! que empuja.
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.3, 0, -0.08, -0.04], [0.45, 0, 0.04, 0.06], [0.8, 0, 0.02, 0.04], [1.0, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.3, 1.08, 0.9, 1.08], [0.45, 0.94, 1.12, 0.94], [0.8, 1, 1, 1], [1, 1, 1, 1]])),
      rot('cuello', poses([[0, 0, 0, 0], [0.3, 20, 0, 0], [0.45, -20, 0, 0], [0.8, -15, 0, 0], [1, 0, 0, 0]])),
      rot('mandibula', poses([[0, 0, 0, 0], [0.3, 0, 0, 0], [0.45, 55, 0, 0], [0.8, 45, 0, 0], [1, 0, 0, 0]])),
      ...orejas(1, (f) => [f > 0.4 && f < 0.8 ? -60 : 0, f > 0.4 && f < 0.8 ? 50 : 0]),
      cola(1, 2, 10, 20),
    ], 'ataque', 'Se agacha, coge aire y suelta un ladrido que empuja a la horda.', false),
  ];

  return {
    id: cool ? 'perro-paseo' : 'perro',
    nombre: cool ? 'Perro · de paseo' : 'Perro · con pajarita',
    rol: 'Compañero · camina, juega y muerde',
    raiz,
    animaciones,
  };
}

export const crearPerroPajarita = () => crearPerro({ pajarita: 'cuadros', gorra: false, gafas: false });
export const crearPerroPaseo = () => crearPerro({ pajarita: 'verde', gorra: true, gafas: true });
