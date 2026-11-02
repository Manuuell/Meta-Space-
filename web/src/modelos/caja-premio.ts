import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, ciclo, conDetalle, esc, esfera, mov, nodo, pieza, poses, punta, rot, toon,
  toro, type Modelo,
} from './kit.ts';

// Cajas de premio: tres tipos con los mismos clips, para que el juego las
// trate igual (Aparecer → Reposo → Abrir → Abierta).
//
// - Suministros: caja de la misión ARES-IX (blanca y naranja, con la luz de
//   ADA). Cae del cielo en paracaídas.
// - HELIOS: cofre de chapa con grietas púrpura y una cerradura con ojo rojo.
//   Sale del suelo; al abrirlo, ADA le apaga el ojo.
// - Reliquia: cofre dorado con un sol. Se materializa entre destellos.
//
// Bisagra de la tapa detrás: girarla en x negativo la abre. Mira hacia +z;
// 1 m de ancho. Pocas piezas y detalle bajo: puede haber docenas en el mapa.

export type TipoCaja = 'suministros' | 'helios' | 'reliquia';

const NOMBRES: Record<TipoCaja, string> = {
  suministros: 'Caja de suministros',
  helios: 'Cofre de HELIOS',
  reliquia: 'Cofre de reliquia',
};

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);
const ORO = '#d9a441';

export function crearCaja(tipo: TipoCaja): Modelo {
  return conDetalle(0.55, () => montar(tipo));
}

function montar(tipo: TipoCaja): Modelo {
  const raiz = new THREE.Group();
  raiz.name = `caja-${tipo}`;
  const cuerpo = nodo('cuerpo', raiz);
  const colores = {
    suministros: { base: PALETA.traje, banda: PALETA.naranja, luz: PALETA.ada },
    helios: { base: PALETA.chapaHelios, banda: PALETA.oscuroHelios, luz: PALETA.purpuraBrillo },
    reliquia: { base: '#7a5a3a', banda: ORO, luz: PALETA.arena },
  }[tipo];

  // Cuerpo, bandas y la luz que llama la atención.
  pieza(cuerpo, caja(1.0, 0.55, 0.7, 0.1), toon(colores.base), 0, 0.3, 0);
  for (const x of [-0.32, 0.32]) pieza(cuerpo, caja(0.1, 0.57, 0.72, 0.04), toon(colores.banda), x, 0.3, 0);
  const tapa = nodo('tapa', cuerpo, 0, 0.58, -0.35);
  pieza(tapa, caja(1.04, 0.22, 0.74, 0.1), toon(colores.base), 0, 0.08, 0.35);
  for (const x of [-0.32, 0.32]) pieza(tapa, caja(0.1, 0.24, 0.76, 0.04), toon(colores.banda), x, 0.08, 0.35);

  if (tipo === 'suministros') {
    pieza(cuerpo, esfera(0.09, 1, 1, 0.4), brillo(colores.luz), 0, 0.32, 0.36, { contorno: false });
    pieza(cuerpo, toro(0.12, 0.03).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0.32, 0.35);
    // Paracaídas (solo se ve al caer).
    const paracaidas = nodo('paracaidas', raiz, 0, 0.9, 0);
    pieza(paracaidas, esfera(1.0, 1, 0.5, 1), toon(PALETA.naranja), 0, 1.6, 0);
    pieza(paracaidas, toro(0.98, 0.04), toon(PALETA.traje), 0, 1.6, 0);
    for (const [x, z] of [[0.45, 0.3], [-0.45, 0.3], [0.45, -0.3], [-0.45, -0.3]] as const) {
      barra(paracaidas, [x * 0.6, 0, z * 0.6], [x * 1.9, 1.6, z * 2.6], 0.012, toon(PALETA.metalOscuro), { contorno: false });
    }
    oculto(paracaidas);
  } else if (tipo === 'helios') {
    // Grietas púrpura, pinchos y la cerradura con ojo rojo.
    pieza(cuerpo, caja(0.8, 0.04, 0.02, 0.01), brillo(colores.luz), 0, 0.2, 0.36, { contorno: false });
    pieza(tapa, caja(0.04, 0.02, 0.6, 0.01), brillo(colores.luz), 0, 0.2, 0.35, { contorno: false });
    for (const x of [-0.5, 0.5]) {
      const p = pieza(cuerpo, punta(0.07, 0.25), toon(PALETA.purpura), x, 0.62, 0.3);
      p.rotation.z = -x * 1.2;
    }
    pieza(cuerpo, caja(0.26, 0.24, 0.08, 0.04), toon(PALETA.oscuroHelios), 0, 0.42, 0.37);
    const cerradura = nodo('cerradura', cuerpo, 0, 0.43, 0.42);
    pieza(cerradura, esfera(0.08, 1.3, 1, 0.4), brillo(PALETA.helios), 0, 0, 0, { contorno: false });
    const hackeo = nodo('hackeo', cuerpo, 0, 0.43, 0.43);
    pieza(hackeo, esfera(0.085, 1.3, 1, 0.4), brillo(PALETA.ada), 0, 0, 0, { contorno: false });
    oculto(hackeo);
  } else {
    // Sol dorado en el frente y remaches de oro.
    pieza(cuerpo, esfera(0.13, 1, 1, 0.3), brillo(colores.luz), 0, 0.32, 0.36, { contorno: false });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const r = pieza(cuerpo, punta(0.04, 0.12).scale(1, 1, 0.3), toon(ORO), Math.sin(a) * 0.2, 0.32 + Math.cos(a) * 0.2, 0.36);
      r.rotation.z = -a;
    }
    // Tapa abombada: medio cilindro a lo ancho.
    pieza(tapa, barril(0.36, 0.36, 1.0, 0.08).rotateZ(Math.PI / 2).scale(1, 0.55, 1), toon(colores.base), 0, 0.14, 0.35);
  }

  // Luz de aviso que parpadea encima y el estallido al abrir.
  const baliza = nodo('baliza', cuerpo, 0.38, 0.72, 0.25);
  pieza(baliza, esfera(0.06), brillo(colores.luz), 0, 0, 0, { contorno: false });
  const destello = nodo('destello', cuerpo, 0, 0.7, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const r = pieza(destello, punta(0.06, 0.7), brillo(tipo === 'helios' ? PALETA.purpuraBrillo : PALETA.arena), Math.sin(a) * 0.25, 0.35 + Math.abs(Math.cos(a)) * 0.15, Math.cos(a) * 0.25, { contorno: false, sombra: false });
    r.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
  }
  oculto(destello);

  // ------------------------------------------------------------ animaciones

  const parpadeoLuz = (d: number, veces: number) => esc('baliza', ciclo(d, (f) => { const k = Math.cos(f * TAU * veces) > 0 ? 1.4 : 0.5; return [k, k, k]; }));
  const aparecer = tipo === 'suministros'
    ? [
      mov(raiz, 'cuerpo', poses([[0, 0, 10, 0], [1.4, 0, 0.6, 0], [1.5, 0, 0, 0], [1.65, 0, 0.12, 0], [1.8, 0, 0, 0], [2.0, 0, 0, 0]])),
      mov(raiz, 'paracaidas', poses([[0, 0, 10, 0], [1.4, 0, 0.6, 0], [1.5, 0, 0, 0], [2.0, 0, -0.6, 0]])),
      esc('paracaidas', poses([[0, 1, 1, 1], [1.5, 1, 1, 1], [2.0, 0.001, 0.001, 0.001]])),
      rot('cuerpo', poses([[0, 0, 0, 8], [0.7, 0, 0, -8], [1.4, 0, 0, 4], [1.5, 0, 0, 0], [2.0, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [1.5, 1, 1, 1], [1.55, 1.15, 0.8, 1.15], [1.75, 0.95, 1.05, 0.95], [2.0, 1, 1, 1]])),
    ]
    : tipo === 'helios'
      ? [
        mov(raiz, 'cuerpo', poses([[0, 0, -1.0, 0], [0.4, 0, -0.95, 0], [1.4, 0, 0.1, 0], [1.6, 0, 0, 0], [2.0, 0, 0, 0]])),
        rot('cuerpo', poses([[0, 0, 0, 0], [0.5, 0, 0, 4], [0.8, 0, 0, -4], [1.1, 0, 0, 3], [1.4, 0, 0, 0], [2.0, 0, 0, 0]])),
        esc('destello', poses([[0, 0.5, 0.5, 0.5], [0.6, 0.9, 0.9, 0.9], [1.4, 1.2, 1.2, 1.2], [1.8, 0.001, 0.001, 0.001], [2.0, 0.001, 0.001, 0.001]])),
      ]
      : [
        esc('cuerpo', poses([[0, 0.001, 0.001, 0.001], [0.6, 0.2, 0.2, 0.2], [1.2, 1.15, 1.15, 1.15], [1.5, 0.95, 0.95, 0.95], [2.0, 1, 1, 1]])),
        rot('cuerpo', poses([[0, 0, 0, 0], [1.2, 0, 540, 0], [2.0, 0, 720, 0]])),
        esc('destello', poses([[0, 0.001, 0.001, 0.001], [0.8, 1.4, 1.4, 1.4], [1.5, 0.8, 0.8, 0.8], [2.0, 0.001, 0.001, 0.001]])),
      ];

  const animaciones = [
    animacion('Reposo', 2.0, [
      parpadeoLuz(2, 2),
      rot('tapa', ciclo(2, (f) => [-Math.max(0, sen(f, 1)) * 3, 0, 0])),
      mov(raiz, 'tapa', ciclo(2, (f) => [0, Math.max(0, sen(f, 1, 0.1)) * 0.015, 0])),
    ], 'movimiento', 'Espera a que la abran: la luz parpadea y la tapa se levanta un poco, como si respirara.'),

    animacion('Aparecer', 2.0, aparecer, 'reaccion',
      tipo === 'suministros' ? 'Cae del cielo en paracaídas (desde 10 m) y aterriza rebotando en 1,5 s.'
        : tipo === 'helios' ? 'Sale del suelo temblando entre destellos púrpura.'
          : 'Se materializa girando entre destellos de sol.', false),

    animacion('Abrir', 1.2, [
      // Tiembla (anticipación), la tapa salta en 0,45 s y sale el destello:
      // el juego da el botín en 0,5 s.
      rot('cuerpo', poses([[0, 0, 0, 0], [0.08, 0, 0, 3], [0.16, 0, 0, -3], [0.24, 0, 0, 4], [0.32, 0, 0, -4], [0.4, 0, 0, 0], [1.2, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.4, 1.08, 0.88, 1.08], [0.5, 0.95, 1.1, 0.95], [0.7, 1, 1, 1], [1.2, 1, 1, 1]])),
      rot('tapa', poses([[0, 0, 0, 0], [0.42, 0, 0, 0], [0.55, -125, 0, 0], [0.7, -100, 0, 0], [0.85, -110, 0, 0], [1.2, -108, 0, 0]])),
      esc('destello', poses([[0, 0.001, 0.001, 0.001], [0.44, 0.001, 0.001, 0.001], [0.6, 1.3, 1.6, 1.3], [0.9, 1, 1.2, 1], [1.2, 0.001, 0.001, 0.001]])),
      esc('baliza', poses([[0, 1, 1, 1], [0.45, 1.8, 1.8, 1.8], [0.7, 0.001, 0.001, 0.001], [1.2, 0.001, 0.001, 0.001]])),
      ...(tipo === 'helios'
        ? [esc('cerradura', poses([[0, 1, 1, 1], [0.2, 1.2, 1.2, 1], [0.35, 1, 0.05, 1], [1.2, 1, 0.05, 1]])),
          esc('hackeo', poses([[0, 0.001, 0.001, 0.001], [0.3, 0.001, 0.001, 0.001], [0.4, 1.2, 1.2, 1.2], [0.6, 1, 1, 1], [1.2, 1, 1, 1]]))]
        : []),
    ], 'reaccion', 'Tiembla, la tapa salta y sale un destello: el juego da el botín en 0,5 s. En el cofre de HELIOS, ADA le apaga el ojo antes.', false),

    animacion('Abierta', 2.0, [
      rot('tapa', ciclo(2, () => [-108, 0, 0])),
      esc('baliza', ciclo(2, () => [0.001, 0.001, 0.001])),
      ...(tipo === 'helios' ? [esc('cerradura', ciclo(2, () => [1, 0.05, 1])), esc('hackeo', ciclo(2, (f) => { const k = 1 + 0.1 * sen(f, 2); return [k, k, k]; }))] : []),
    ], 'movimiento', 'Abierta y vacía.'),
  ];

  return { id: `caja-${tipo}`, nombre: NOMBRES[tipo], rol: 'Mapa · caja de premio', raiz, animaciones };
}
