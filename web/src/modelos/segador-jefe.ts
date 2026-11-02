import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, curva, esc, esfera, mov, nodo, pieza,
  porFotograma, poses, punta, rot, toon, toro, type Modelo, type Pose,
} from './kit.ts';

// Segador, Jefe de Cosecha: la cosechadora madre de HELIOS (minuto 2–4).
// Chasis de chapa sobre dos orugas con ruedas de tapacubos púrpura, un
// cabezal con un rodillo de cuchillas púrpura que brillan, una cabina con dos
// faros furiosos de pupila roja bajo una visera en V, cristales en el lomo,
// dos chimeneas y una jaula con las reliquias flotando alrededor de un
// núcleo de cristal. Mira hacia +z; mide 3,3 m hasta las chimeneas (4,3 con
// el humo), 3,3 de ancho y 4,5 de largo.
//
// Cada ataque se anuncia con marcas rojas en el suelo (nodos `aviso_*`, que
// cuelgan de la raíz y no se mueven con el cuerpo). En fase 2 se reproduce
// `Enfurecido` a la vez que cualquier otro clip: solo anima llamas, halos y
// cristales de furia, que ningún otro clip toca. Tiempos en TIEMPOS_JEFE_COSECHA.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);

/**
 * Tiempos de cada ataque en segundos (a 30 fps, fotograma = segundo × 30):
 * cuándo empieza el aviso, cuándo empieza y acaba el golpe (la ventana en la
 * que el juego debe hacer daño) y cuánto dura el clip.
 */
export const TIEMPOS_JEFE_COSECHA = {
  Embestir: { aviso: 0, golpe: 1.1, finGolpe: 1.5, duracion: 2.4 },
  Barrido: { aviso: 0, golpe: 0.85, finGolpe: 1.2, duracion: 2.0 },
} as const;

const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

export function crearSegadorJefe(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'segador-jefe';
  const cuerpo = nodo('cuerpo', raiz, 0, 0.7, 0);
  // Las piezas pequeñas y repetidas, con menos segmentos.
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);

  // Chasis, faldón, franja que brilla y cabina.
  pieza(cuerpo, caja(2.2, 1.2, 3.0, 0.3), toon(PALETA.metalHelios), 0, 0.6, -0.1);
  pieza(cuerpo, caja(2.36, 0.22, 3.1, 0.1), toon(PALETA.chapaHelios), 0, 0.08, -0.1);
  pieza(cuerpo, caja(2.24, 0.09, 3.04, 0.045), brillo(PALETA.purpuraBrillo), 0, 0.95, -0.1, { contorno: false });
  pieza(cuerpo, caja(1.6, 1.0, 1.3, 0.28), toon(PALETA.chapaHelios), 0, 1.65, 0.5);
  // Boca con dientes sobre el cabezal.
  pieza(cuerpo, caja(2.0, 0.72, 0.4, 0.14), toon(PALETA.oscuroHelios), 0, 0.5, 1.36);
  for (let k = 0; k < 8; k++) {
    pieza(cuerpo, punta(0.09, 0.24).rotateX(Math.PI), toon(PALETA.diente), -0.84 + k * 0.24, 0.76, 1.55, { contorno: false });
  }
  // Cara: escleras en la cabina, pupilas en `faros` y visera en V.
  for (const s of [1, -1]) pieza(cuerpo, esfera(0.27, 1.1, 1, 0.5), toon(PALETA.blanco), 0.4 * s, 1.68, 1.17);
  const faros = nodo('faros', cuerpo, 0, 1.68, 1.27);
  for (const s of [1, -1]) {
    fino(() => {
      pieza(faros, esfera(0.15, 1, 1, 0.5), brillo(PALETA.helios), 0.4 * s, -0.03, 0, { contorno: false, sombra: false });
      pieza(faros, esfera(0.05), brillo(PALETA.blanco), 0.4 * s + 0.06, 0.05, 0.06, { contorno: false, sombra: false });
    });
  }
  const visera = nodo('visera', cuerpo, 0, 2.0, 1.24);
  for (const s of [1, -1]) {
    const v = pieza(visera, caja(0.64, 0.17, 0.28, 0.06), toon(PALETA.oscuroHelios), 0.36 * s, 0, 0);
    v.rotation.z = 0.3 * s;
  }
  // Fase 2: halos rojos alrededor de los faros.
  const halos = nodo('halos', cuerpo, 0, 1.68, 1.3);
  for (const s of [1, -1]) {
    fino(() => pieza(halos, toro(0.34, 0.045).rotateX(Math.PI / 2), brillo(PALETA.helios), 0.4 * s, 0, 0, { contorno: false, sombra: false }));
  }
  oculto(halos);

  // Cabezal: capó y laterales con pinchos; dentro, el rodillo de cuchillas.
  const cabezal = nodo('cabezal', cuerpo, 0, 0.32, 1.55);
  pieza(cabezal, caja(2.6, 0.22, 0.95, 0.1), toon(PALETA.chapaHelios), 0, 0.46, 0.38);
  for (const s of [1, -1]) {
    pieza(cabezal, caja(0.14, 0.78, 1.0, 0.06), toon(PALETA.chapaHelios), 1.27 * s, 0.12, 0.4);
    for (const z of [0.2, 0.62]) {
      const p = pieza(cabezal, punta(0.08, 0.28), toon(PALETA.purpura), 1.38 * s, 0.25, z);
      p.rotation.z = -1.3 * s;
    }
  }
  const rodillo = nodo('rodillo', cabezal, 0, 0.02, 0.45);
  pieza(rodillo, barril(0.25, 0.25, 2.3, 0.08).rotateZ(Math.PI / 2), toon(PALETA.oscuroHelios));
  for (let fila = 0; fila < 5; fila++) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + (fila % 2) * (TAU / 8);
      const c = pieza(rodillo, punta(0.13, 0.42).scale(1, 1, 0.35), brillo(PALETA.purpuraBrillo), -0.9 + fila * 0.45, Math.cos(a) * 0.38, Math.sin(a) * 0.38, { contorno: false });
      c.rotation.x = a;
    }
  }

  // Orugas: cuerpo redondeado, tres ruedas por lado y tacos que corren por arriba.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const oruga = nodo(`oruga_${lado}`, cuerpo, 1.22 * s, -0.15, -0.1);
    pieza(oruga, caja(0.62, 1.05, 3.3, 0.45), toon(PALETA.oscuro));
    for (let k = 0; k < 3; k++) {
      const rueda = nodo(`rueda_${lado}${k}`, oruga, 0.3 * s, 0, -1.05 + k * 1.05);
      fino(() => {
        pieza(rueda, esfera(0.36, 0.3, 1, 1), toon(PALETA.metalOscuro));
        pieza(rueda, esfera(0.15, 0.4, 1, 1), brillo(PALETA.purpuraBrillo), 0.08 * s, 0, 0, { contorno: false });
        for (let j = 0; j < 3; j++) {
          const a = (j / 3) * TAU;
          const p = pieza(rueda, punta(0.05, 0.16), toon(PALETA.purpura), 0.1 * s, Math.cos(a) * 0.25, Math.sin(a) * 0.25);
          p.rotation.x = a;
        }
      });
    }
    const banda = nodo(`banda_${lado}`, oruga, 0, 0.53, 0);
    fino(() => {
      for (let k = 0; k < 7; k++) pieza(banda, capsula(0.06, 0.42).rotateZ(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0, -1.26 + k * 0.42);
    });
  }

  // Cristales del lomo y, en fase 2, otros que brillan.
  for (const [x, z, alto, inclina] of [[0.88, -0.25, 1.0, -0.4], [-0.9, -0.45, 0.9, -0.5], [0.62, -1.42, 0.8, -0.8], [-0.64, -1.38, 0.85, -0.75]] as const) {
    const c = pieza(cuerpo, punta(0.21, alto, 8), toon(PALETA.purpura), x, 1.15 + alto * 0.35, z);
    c.rotation.set(inclina, 0, -x * 0.45);
  }
  const furia = nodo('furia', cuerpo, 0, 1.2, -0.3);
  for (const [x, z, alto] of [[0.95, 0.4, 0.55], [-0.95, 0.35, 0.5], [0, -1.45, 0.6]] as const) {
    const c = pieza(furia, punta(0.14, alto, 8), brillo(PALETA.purpuraBrillo), x, alto * 0.3, z, { contorno: false });
    c.rotation.set(-0.4, 0, -x * 0.5);
  }
  oculto(furia);

  // Jaula de las reliquias: aros, barrotes, núcleo y tapa.
  const jaula = nodo('jaula', cuerpo, 0, 1.2, -0.85);
  pieza(jaula, toro(0.6, 0.08), toon(PALETA.oscuroHelios), 0, 0.06, 0);
  pieza(jaula, toro(0.5, 0.07), toon(PALETA.oscuroHelios), 0, 1.0, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + TAU / 12;
    barra(jaula, [Math.sin(a) * 0.6, 0.06, Math.cos(a) * 0.6], [Math.sin(a) * 0.5, 1.0, Math.cos(a) * 0.5], 0.045, toon(PALETA.metalOscuro));
  }
  const nucleo = nodo('nucleo', jaula, 0, 0.5, 0);
  pieza(nucleo, esfera(0.2), brillo(PALETA.cristal), 0, 0, 0, { contorno: false });
  // Las reliquias: un panel solar, una cápsula RTG, una antena y un dibujo.
  const reliquias: [string, (n: THREE.Object3D) => void, [number, number, number]][] = [
    ['reliquia_panel', (n) => {
      pieza(n, caja(0.34, 0.03, 0.24, 0.012), toon(PALETA.ada));
      pieza(n, caja(0.38, 0.02, 0.04, 0.01), toon(PALETA.oscuro), 0, 0, 0);
    }, [0.3, 0.62, 0.12]],
    ['reliquia_rtg', (n) => {
      pieza(n, capsula(0.06, 0.16), toon(PALETA.metal));
      pieza(n, toro(0.065, 0.02), brillo(PALETA.plasma), 0, 0, 0, { contorno: false });
    }, [-0.28, 0.4, 0.15]],
    ['reliquia_antena', (n) => {
      pieza(n, barril(0.15, 0.04, 0.05, 0.02), toon(PALETA.traje));
      pieza(n, capsula(0.012, 0.1), toon(PALETA.metalOscuro), 0, 0.07, 0);
    }, [0.05, 0.78, -0.3]],
    ['reliquia_dibujo', (n) => {
      pieza(n, caja(0.26, 0.2, 0.02, 0.008), toon(PALETA.blanco));
      pieza(n, esfera(0.035), brillo(PALETA.arena), 0.07, 0.05, 0.015, { contorno: false });
      pieza(n, caja(0.1, 0.07, 0.01, 0.004), toon(PALETA.naranja), -0.05, -0.04, 0.012, { contorno: false });
    }, [0.12, 0.3, -0.32]],
  ];
  fino(() => {
    for (const [n, hacer, [x, y, z]] of reliquias) hacer(nodo(n, jaula, x, y, z));
  });
  const tapa = nodo('tapa', jaula, 0, 1.0, 0);
  pieza(tapa, esfera(0.52, 1, 0.38, 1), toon(PALETA.chapaHelios), 0, 0.05, 0);
  fino(() => pieza(tapa, esfera(0.08), brillo(PALETA.helios), 0, 0.26, 0, { contorno: false }));

  // Dos chimeneas, su humo y, en fase 2, llamas.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    barra(cuerpo, [0.78 * s, 1.15, -1.3], [0.78 * s, 2.45, -1.36], 0.1, toon(PALETA.oscuroHelios));
    pieza(cuerpo, barril(0.17, 0.14, 0.16, 0.05), toon(PALETA.oscuroHelios), 0.78 * s, 2.55, -1.36);
    const humo = nodo(`humo_${lado}`, cuerpo, 0.78 * s, 2.72, -1.38);
    fino(() => {
      for (const [y, r] of [[0, 0.17], [0.3, 0.22], [0.64, 0.27]] as const) {
        pieza(humo, esfera(r), toon(PALETA.metalOscuro), y * 0.2 * s, y, -y * 0.4, { sombra: false });
      }
    });
  }
  const llamas = nodo('llamas', cuerpo, 0, 2.66, -1.36);
  fino(() => {
    for (const s of [1, -1]) {
      pieza(llamas, punta(0.17, 0.6), brillo(PALETA.plasma), 0.78 * s, 0.22, 0, { contorno: false, sombra: false });
      pieza(llamas, punta(0.1, 0.4), brillo(PALETA.helios), 0.78 * s, 0.4, 0.05, { contorno: false, sombra: false });
    }
  });
  oculto(llamas);

  // Chispas del cabezal (barrido y derrota).
  const chispas = nodo('chispas', cabezal, 0, 0, 0.9);
  fino(() => {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI - Math.PI / 2;
      const c = pieza(chispas, punta(0.05, 0.36), brillo(PALETA.plasma), Math.sin(a) * 0.9, 0.1 + Math.cos(a) * 0.2, 0.15, { contorno: false, sombra: false });
      c.rotation.set(0.9, 0, -a);
    }
  });
  oculto(chispas);

  // Avisos en el suelo: flechas del carril de la embestida y arco del barrido.
  const avisoCarga = nodo('aviso_carga', raiz, 0, 0.03, 2.3);
  for (const z of [0.3, 1.9, 3.5, 5.1]) {
    pieza(avisoCarga, punta(0.75, 1.1, 5).rotateX(Math.PI / 2).scale(1, 0.04, 1), brillo(PALETA.helios), 0, 0, z + 0.55, { contorno: false, sombra: false });
  }
  oculto(avisoCarga);
  const avisoBarrido = nodo('aviso_barrido', raiz, 0, 0.03, 0);
  pieza(avisoBarrido, new THREE.RingGeometry(2.2, 4.6, 28, 1, THREE.MathUtils.degToRad(-155), THREE.MathUtils.degToRad(130)).rotateX(-Math.PI / 2),
    brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  oculto(avisoBarrido);

  // ------------------------------------------------------------ animaciones

  const ruedas = (d: number, vueltas: number) => (['i', 'd'] as const).flatMap((l) => [0, 1, 2].map((k) => rot(`rueda_${l}${k}`, ciclo(d, (f) => [-f * 360 * vueltas, 0, 0]))));
  const bandas = (d: number, veces: number) => (['i', 'd'] as const).map((l) => mov(raiz, `banda_${l}`, ciclo(d, (f) => [0, 0, -((f * veces) % 1) * 0.42])));
  const humear = (d: number, veces: number, fuerza = 1) => (['i', 'd'] as const).flatMap((l, j) => [
    esc(`humo_${l}`, ciclo(d, (f) => { const k = (0.4 + ((f * veces + j * 0.5) % 1) * 0.9) * fuerza; return [k, k, k]; })),
    mov(raiz, `humo_${l}`, ciclo(d, (f) => [0, ((f * veces + j * 0.5) % 1) * 0.5, -((f * veces + j * 0.5) % 1) * 0.2])),
  ]);
  const reliquiasFlotan = (d: number) => reliquias.map(([n], k) => rot(n, ciclo(d, (f) => [sen(f, 1, k * 0.25) * 20, f * 360 * (k % 2 ? 1 : -1), sen(f, 1, k * 0.3) * 15])));

  /**
   * Derrota: el cuerpo vuelca hacia su izquierda mientras la tapa y las
   * reliquias salen despedidas. Como cuelgan del cuerpo, su trayectoria se
   * escribe en el mundo y se pasa al espacio del cuerpo en cada fotograma:
   * así caen al suelo aunque el cuerpo esté volcando.
   */
  const temblor: [number, number][] = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [0.1 + k * 0.1, k % 2 ? -2 : 2] as [number, number]), [0.9, 0]];
  const vuelco: [number, number][] = [...temblor, [1.4, -5], [2.3, -90], [2.5, -82], [2.75, -88], [3.6, -87]];
  const desplazaX: [number, number][] = [[0, 0], [1.4, 0], [2.3, -0.45], [2.5, -0.47], [2.75, -0.48], [3.6, -0.48]];
  const desplazaY: [number, number][] = [[0, 0], [1.4, 0.05], [2.3, 1.02], [2.5, 0.9], [2.75, 1.0], [3.6, 0.97]];
  const BASE = new THREE.Vector3(0, 0.7, 0);
  const enJaula = new THREE.Vector3(0, 1.2, -0.85);
  const cuerpoEn = (t: number) => {
    const giro = THREE.MathUtils.degToRad(curva(t, vuelco));
    const pos = BASE.clone().add(new THREE.Vector3(curva(t, desplazaX), curva(t, desplazaY), 0));
    return { giro, pos };
  };
  /** Del mundo al espacio del cuerpo en el instante t. */
  const aCuerpo = (t: number, mundo: THREE.Vector3) => {
    const { giro, pos } = cuerpoEn(t);
    return mundo.clone().sub(pos).applyAxisAngle(new THREE.Vector3(0, 0, 1), -giro);
  };
  /** Del espacio del cuerpo al mundo en el instante t. */
  const aMundo = (t: number, local: THREE.Vector3) => {
    const { giro, pos } = cuerpoEn(t);
    return local.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), giro).add(pos);
  };
  const SALTA = 1.15, CAE = 2.0;
  const voladores = [
    ...reliquias.map(([n, , r], k) => {
      const a = (k / 4) * TAU + 0.5;
      return { n, reposo: new THREE.Vector3(...r).add(enJaula), destino: new THREE.Vector3(Math.sin(a) * (2.4 + k * 0.4), 0.12, -0.85 + Math.cos(a) * (2.4 + k * 0.4)), alto: 1.6 + k * 0.25 };
    }),
    { n: 'tapa', reposo: new THREE.Vector3(0, 1.0, 0).add(enJaula), destino: new THREE.Vector3(2.4, 0.18, -2.2), alto: 2.2 },
  ];
  const derrota = (t: number): Pose => {
    const { giro } = cuerpoEn(t);
    const p: Pose = {
      mov: { cuerpo: [curva(t, desplazaX), curva(t, desplazaY), 0] },
      rot: { cuerpo: [0, 0, THREE.MathUtils.radToDeg(giro)] },
    };
    for (const [k, v] of voladores.entries()) {
      const salida = aMundo(SALTA, v.reposo);
      let local: THREE.Vector3;
      if (t <= SALTA) {
        local = v.reposo.clone();
      } else {
        const u = Math.min(1, (t - SALTA) / (CAE - SALTA));
        const rebote = t > CAE ? Math.max(0, Math.sin(((t - CAE) / 0.3) * Math.PI)) * 0.25 * Math.max(0, 1 - (t - CAE) / 0.3) : 0;
        const mundo = salida.clone().lerp(v.destino, u);
        mundo.y = THREE.MathUtils.lerp(salida.y, v.destino.y, u) + v.alto * 4 * u * (1 - u) + rebote;
        local = aCuerpo(t, mundo);
      }
      const d = local.sub(v.reposo);
      p.mov![v.n] = [d.x, d.y, d.z];
      // Dan vueltas en el aire y aterrizan planas (se compensa el vuelco).
      const vueltas = curva(t, [[SALTA, 0], [CAE, 1]]);
      p.rot![v.n] = [vueltas * 360 * (k % 2 ? 1 : -1), vueltas * 360, t > SALTA ? -THREE.MathUtils.radToDeg(giro) : 0];
    }
    return p;
  };

  const animaciones = [
    animacion('Reposo', 2.0, [
      mov(raiz, 'cuerpo', ciclo(2, (f) => [0, Math.abs(sen(f, 8)) * 0.02, 0])),
      rot('cuerpo', ciclo(2, (f) => [sen(f, 2) * 0.8, 0, sen(f, 8) * 0.4])),
      rot('rodillo', ciclo(2, (f) => [f * 360, 0, 0])),
      ...humear(2, 2),
      ...reliquiasFlotan(2),
      esc('nucleo', ciclo(2, (f) => { const k = 1 + 0.12 * sen(f, 2); return [k, k, k]; })),
      mov(raiz, 'faros', ciclo(2, (f) => [sen(f) * 0.06, 0, 0])),
      esc('faros', ciclo(2, (f) => { const k = f > 0.7 && f < 0.735 ? 0.15 : 1; return [1, k, 1]; })),
    ], 'movimiento', 'Al ralentí: vibra, el rodillo gira despacio, echa humo y las reliquias flotan en la jaula.'),

    animacion('Rugir', 2.8, [
      // Entrada: arranca a toses con los faros apagados, se encienden, se
      // encabrita rugiendo y cae de golpe.
      mov(raiz, 'cuerpo', poses([[0, 0, -0.1, 0], [0.6, 0, -0.08, 0], [0.9, 0, -0.02, 0], [1.4, 0, 0.55, -0.2], [2.15, 0, 0.58, -0.2], [2.4, 0, -0.06, 0.1], [2.55, 0, 0.03, 0], [2.8, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 4, 0, 0], [0.2, 4, 0, 2], [0.35, 4, 0, -2], [0.5, 4, 0, 1], [0.9, 0, 0, 0], [1.4, -16, 0, 0], [1.6, -16, 0, 2], [1.8, -16, 0, -2], [2.0, -16, 0, 2], [2.15, -15, 0, 0], [2.4, 4, 0, 0], [2.8, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [2.15, 1, 1, 1], [2.4, 1.06, 0.9, 1.04], [2.55, 0.98, 1.03, 0.99], [2.8, 1, 1, 1]])),
      esc('faros', poses([[0, 0.001, 0.001, 1], [0.6, 0.001, 0.001, 1], [0.66, 1.2, 1.2, 1], [0.72, 0.3, 0.3, 1], [0.8, 1.4, 1.4, 1], [1.4, 1.2, 1.2, 1], [1.6, 1.6, 1.6, 1.2], [2.2, 1.6, 1.6, 1.2], [2.8, 1, 1, 1]])),
      mov(raiz, 'visera', poses([[0, 0, -0.1, 0], [0.8, 0, 0.05, 0], [1.4, 0, -0.08, 0], [2.4, 0, -0.08, 0], [2.8, 0, 0, 0]])),
      rot('rodillo', poses([[0, 0, 0, 0], [0.9, 30, 0, 0], [2.2, 1500, 0, 0], [2.8, 1700, 0, 0]])),
      rot('cabezal', poses([[0, 0, 0, 0], [1.4, -12, 0, 0], [2.15, -12, 0, 0], [2.4, 4, 0, 0], [2.8, 0, 0, 0]])),
      ...(['i', 'd'] as const).map((l) => esc(`humo_${l}`, poses([[0, 0.3, 0.3, 0.3], [0.25, 1.2, 1.2, 1.2], [0.4, 0.4, 0.4, 0.4], [0.5, 1, 1, 1], [0.6, 0.4, 0.4, 0.4], [1.4, 0.8, 0.8, 0.8], [1.8, 1.9, 1.9, 1.9], [2.3, 1.2, 1.2, 1.2], [2.8, 0.4, 0.4, 0.4]]))),
      ...reliquiasFlotan(2.8),
    ], 'reaccion', 'Entrada: tose con los faros apagados, se encienden, se encabrita rugiendo con el rodillo a tope y cae de golpe.', false),

    animacion('Avanzar', 1.2, [
      ...ruedas(1.2, 2),
      ...bandas(1.2, 4),
      rot('rodillo', ciclo(1.2, (f) => [f * 360 * 2, 0, 0])),
      mov(raiz, 'cuerpo', ciclo(1.2, (f) => [0, Math.abs(sen(f, 4)) * 0.035, 0])),
      rot('cuerpo', ciclo(1.2, (f) => [sen(f, 4) * 1.2, 0, sen(f, 2) * 1.5])),
      rot('cabezal', ciclo(1.2, (f) => [sen(f, 4, 0.2) * 3, 0, 0])),
      ...humear(1.2, 3),
      ...reliquiasFlotan(1.2),
    ], 'movimiento', 'Avanza traqueteando sobre las orugas, con el rodillo girando y echando humo.'),

    animacion('Embestir', 2.4, [
      // Aviso (0–1,1 s): recula con el morro arriba, los faros se encienden,
      // ruge y aparecen las flechas del carril. Golpe (1,1–1,5 s): carga.
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.7, 0, 0.3, -0.45], [1.1, 0, 0.3, -0.45], [1.4, 0, 0.2, 1.4], [1.55, 0, 0.08, 1.25], [1.8, 0, 0, 1.3], [2.4, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.7, -10, 0, 0], [0.8, -10, 0, 1.5], [0.9, -10, 0, -1.5], [1.0, -10, 0, 1.5], [1.1, -10, 0, 0], [1.4, 7, 0, 0], [1.55, 3, 0, 0], [2.4, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [1.1, 1, 1, 0.96], [1.3, 0.97, 1.02, 1.07], [1.45, 1.05, 0.94, 0.98], [1.7, 1, 1, 1], [2.4, 1, 1, 1]])),
      ...(['i', 'd'] as const).flatMap((l) => [0, 1, 2].map((k) => rot(`rueda_${l}${k}`, poses([[0, 0, 0, 0], [0.7, 120, 0, 0], [1.1, 140, 0, 0], [1.45, -500, 0, 0], [2.4, -720, 0, 0]])))),
      rot('rodillo', ciclo(2.4, (f) => [f * 360 * 7, 0, 0])),
      esc('faros', poses([[0, 1, 1, 1], [0.5, 1.6, 1.6, 1.2], [1.5, 1.6, 1.6, 1.2], [2.4, 1, 1, 1]])),
      mov(raiz, 'visera', poses([[0, 0, 0, 0], [0.5, 0, -0.08, 0], [1.6, 0, -0.08, 0], [2.4, 0, 0, 0]])),
      esc('aviso_carga', poses([[0, 0.001, 0.001, 0.001], [0.15, 1, 1, 0.05], [0.7, 1, 1, 1], [0.8, 1.15, 1, 1], [0.9, 1, 1, 1], [1.0, 1.15, 1, 1], [1.1, 1, 1, 1], [1.2, 0.001, 0.001, 0.001], [2.4, 0.001, 0.001, 0.001]])),
      ...humear(2.4, 6),
      ...reliquiasFlotan(2.4),
    ], 'ataque', 'Aviso de 0 a 1,1 s: recula encabritado, ruge y marca el carril con flechas rojas. Carga de 1,1 a 1,5 s y vuelve.', false),

    animacion('Barrido', 2.0, [
      // Aviso (0–0,85 s): gira el cabezal a su derecha, las cuchillas
      // aceleran y el arco rojo marca la zona. Golpe (0,85–1,2 s): barre.
      rot('cabezal', poses([[0, 0, 0, 0], [0.7, -6, -48, -6], [0.85, -6, -50, -6], [1.15, -2, 52, 6], [1.3, 0, 46, 4], [2.0, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.7, 0, -14, 0], [0.85, 0, -15, 0], [1.15, 0, 16, 0], [1.3, 0, 13, 0], [2.0, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.7, 0, 0.04, -0.15], [1.0, 0, 0, 0.35], [1.3, 0, 0, 0.25], [2.0, 0, 0, 0]])),
      rot('rodillo', poses([[0, 0, 0, 0], [0.85, 900, 0, 0], [1.3, 1800, 0, 0], [2.0, 2160, 0, 0]])),
      esc('chispas', poses([[0, 0.001, 0.001, 0.001], [0.85, 0.001, 0.001, 0.001], [0.92, 1.2, 1.2, 1.2], [1.1, 1, 1.4, 1], [1.22, 0.001, 0.001, 0.001], [2.0, 0.001, 0.001, 0.001]])),
      esc('faros', poses([[0, 1, 1, 1], [0.5, 1.4, 1.4, 1.1], [1.3, 1.4, 1.4, 1.1], [2.0, 1, 1, 1]])),
      esc('aviso_barrido', poses([[0, 0.001, 0.001, 0.001], [0.15, 0.6, 1, 0.6], [0.6, 1, 1, 1], [0.7, 1.06, 1, 1.06], [0.8, 1, 1, 1], [0.86, 0.001, 0.001, 0.001], [2.0, 0.001, 0.001, 0.001]])),
      ...humear(2, 4),
      ...reliquiasFlotan(2),
    ], 'ataque', 'Aviso de 0 a 0,85 s: gira el cabezal a un lado y un arco rojo marca la zona. Barre de 0,85 a 1,2 s soltando chispas.', false),

    animacion('Golpe recibido', 0.45, [
      esc('cuerpo', poses([[0, 1, 1, 1], [0.06, 1.05, 0.92, 1.03], [0.2, 0.98, 1.02, 0.99], [0.45, 1, 1, 1]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.06, -4, 0, 3], [0.2, 2, 0, -1.5], [0.45, 0, 0, 0]])),
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.06, 0, 0.1, 0], [0.2, 0, 0.04, 0], [0.45, 0, 0, 0]])),
      esc('faros', poses([[0, 1, 1, 1], [0.06, 1.2, 0.2, 1], [0.28, 1, 1, 1], [0.45, 1, 1, 1]])),
      mov(raiz, 'visera', poses([[0, 0, 0, 0], [0.06, 0, 0.1, 0], [0.3, 0, 0, 0], [0.45, 0, 0, 0]])),
    ], 'reaccion', 'Se sacude sobre las orugas y guiña los faros.', false),

    animacion('Furia', 2.4, [
      // Fase 2: se estremece, las chimeneas escupen llamas, los faros se
      // rodean de halos rojos y le brotan cristales que brillan.
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.5, 0, -0.04, 0], [1.0, 0, 0.42, 0], [1.9, 0, 0.42, 0], [2.1, 0, 0, 0], [2.4, 0, 0, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.1, 0, 0, 3], [0.2, 0, 0, -3], [0.3, 0, 0, 3], [0.5, 4, 0, 0], [1.0, -12, 0, 0], [1.2, -12, 3, 2], [1.4, -12, -3, -2], [1.6, -12, 3, 2], [1.9, -12, 0, 0], [2.1, 3, 0, 0], [2.4, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.5, 1.05, 0.93, 1.05], [1.0, 0.97, 1.05, 0.97], [2.1, 1.04, 0.94, 1.02], [2.4, 1, 1, 1]])),
      esc('halos', poses([[0, 0.001, 0.001, 0.001], [0.9, 0.001, 0.001, 0.001], [1.1, 1.4, 1.4, 1.4], [1.3, 1, 1, 1], [2.4, 1, 1, 1]])),
      esc('llamas', poses([[0, 0.001, 0.001, 0.001], [0.95, 0.001, 0.001, 0.001], [1.15, 1.6, 1.8, 1.6], [1.5, 1.2, 1.4, 1.2], [1.9, 1.5, 1.7, 1.5], [2.4, 1, 1, 1]])),
      esc('furia', poses([[0, 0.001, 0.001, 0.001], [0.5, 0.001, 0.001, 0.001], [0.9, 1.25, 1.25, 1.25], [1.1, 1, 1, 1], [2.4, 1, 1, 1]])),
      esc('faros', poses([[0, 1, 1, 1], [0.5, 0.5, 0.5, 1], [1.0, 1.8, 1.8, 1.3], [2.4, 1.3, 1.3, 1.1]])),
      mov(raiz, 'visera', poses([[0, 0, 0, 0], [0.5, 0, -0.12, 0], [2.4, 0, -0.08, 0]])),
      rot('rodillo', poses([[0, 0, 0, 0], [2.4, 2400, 0, 0]])),
    ], 'reaccion', 'Fase 2: se estremece, se encabrita y ruge; las chimeneas escupen llamas, los faros se rodean de halos rojos y le brotan cristales que brillan.', false),

    animacion('Enfurecido', 1.0, [
      // Capa de la fase 2: solo toca llamas, halos y cristales de furia.
      esc('llamas', ciclo(1, (f) => [1 + 0.15 * sen(f, 4), 1 + 0.3 * sen(f, 3, 0.2), 1 + 0.15 * sen(f, 4)])),
      esc('halos', ciclo(1, (f) => { const k = 1 + 0.1 * sen(f, 2); return [k, k, k]; })),
      esc('furia', ciclo(1, (f) => { const k = 1 + 0.08 * sen(f, 2, 0.25); return [k, k, k]; })),
    ], 'reaccion', 'Fase 2, en bucle y a la vez que cualquier otro clip: llamas en las chimeneas, halos en los faros y cristales encendidos.'),

    animacion('Derrota', 3.6, [
      ...porFotograma(raiz, 3.6, derrota),
      esc('chispas', poses([[0, 0.001, 0.001, 0.001], [0.2, 1.2, 1.2, 1.2], [0.4, 0.4, 0.4, 0.4], [0.55, 1.3, 1.3, 1.3], [0.8, 0.5, 0.5, 0.5], [1.0, 1.2, 1.2, 1.2], [1.3, 0.001, 0.001, 0.001], [3.6, 0.001, 0.001, 0.001]])),
      esc('faros', poses([[0, 1, 1, 1], [0.3, 1.4, 1.4, 1], [0.5, 0.3, 0.3, 1], [0.6, 1.2, 1.2, 1], [0.75, 0.2, 0.2, 1], [0.85, 0.8, 0.8, 1], [1.0, 0.001, 0.001, 1], [3.6, 0.001, 0.001, 1]])),
      esc('nucleo', poses([[0, 1, 1, 1], [1.0, 1.5, 1.5, 1.5], [1.15, 0.001, 0.001, 0.001], [3.6, 0.001, 0.001, 0.001]])),
      rot('rodillo', poses([[0, 0, 0, 0], [1.5, 900, 0, 0], [3.0, 1080, 0, 0], [3.6, 1080, 0, 0]])),
      ...(['i', 'd'] as const).map((l) => esc(`humo_${l}`, poses([[0, 0.4, 0.4, 0.4], [0.6, 1.8, 1.8, 1.8], [1.4, 2.2, 2.2, 2.2], [2.4, 1.2, 1.2, 1.2], [3.2, 0.001, 0.001, 0.001], [3.6, 0.001, 0.001, 0.001]]))),
    ], 'reaccion', 'Tiembla soltando chispas, los faros mueren, la tapa salta, las cuatro reliquias salen despedidas al suelo y vuelca de lado.', false),
  ];

  return { id: 'segador-jefe', nombre: 'Segador, Jefe de Cosecha', rol: 'Jefe de HELIOS · minuto 2–4', raiz, animaciones };
}
