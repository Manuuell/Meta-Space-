import * as THREE from 'three';
import {
  PALETA, agrandar, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, cono, esc, esfera, mov, nodo,
  parpadeo, pieza, poses, rot, toon, toro, type Clave, type Modelo,
} from './kit.ts';

// La nave de ARES-IX: una lanzadera rechoncha de la misma familia que el
// especialista (blanco, naranja y la luz cyan de ADA). La cabina es un visor
// oscuro en el morro con dos ojos de luz, como el casco, así que la nave tiene
// cara. Tres toberas (dos en las góndolas y una central) con llamas que las
// animaciones estiran y encogen. Mira hacia +z; su izquierda es +x. Mide 3,3 m
// de morro a cola y 3,4 m de envergadura, y vuela con el casco a 1,5 m del
// suelo. La usa la cinemática de entrada (src/intro.ts).
//
// Posada en el mapa (`crearNavePosada`, ×3,5) saca tres patas, abre la
// escotilla del costado izquierdo, que baja como rampa, y apaga los motores.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
/** Las piezas de revolución del kit van en vertical: así quedan a lo largo de z (arriba = morro). */
const tumbada = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2);
/** Llama: un cono con la punta hacia atrás (-z) y la base en el origen del nodo. */
const llama = (radio: number, largo: number) => cono(radio, largo).rotateX(-Math.PI / 2).translate(0, 0, -largo / 2);
/** Posada, el casco baja de 1,5 a 0,99 m: las zapatas tocan el suelo. */
const POSADA = -0.51;
/** Giro de la escotilla abierta: la rampa baja 37,5° y su punta llega al suelo. */
const RAMPA = -127.5;

export function crearNave(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'nave';
  const casco = nodo('casco', raiz, 0, 1.5, 0);

  // Fuselaje: una cápsula tumbada y algo achatada, con franja naranja y quilla.
  pieza(casco, tumbada(capsula(0.62, 1.7)).scale(1, 0.9, 1), toon(PALETA.traje));
  pieza(casco, tumbada(toro(0.6, 0.075)), toon(PALETA.naranja), 0, 0, -0.2);
  pieza(casco, caja(0.5, 0.12, 1.5, 0.05), toon(PALETA.trajeSombra), 0, -0.52, -0.1);

  // Cara: el morro lleva el visor oscuro del casco, con dos ojos de luz y un
  // reflejo, y tomas de aire naranjas a los lados como las orejeras del traje.
  pieza(casco, esfera(0.5, 0.98, 0.62, 0.6), toon('#1d2b4f'), 0, 0.12, 1.28);
  const reflejo = pieza(casco, caja(0.15, 0.045, 0.02, 0.02), brillo(PALETA.blanco), -0.27, 0.3, 1.52, { contorno: false });
  reflejo.rotation.set(-0.3, -0.45, 0.5);
  for (const [lado, x] of [['i', 0.16], ['d', -0.16]] as const) {
    const o = nodo(`ojo_${lado}`, casco, x, 0.13, 1.56);
    pieza(o, capsula(0.055, 0.1), brillo('#9ff8ff'), 0, 0, 0, { contorno: false });
  }
  for (const s of [1, -1]) pieza(casco, esfera(0.24, 0.5, 1, 1.1), toon(PALETA.naranja), 0.58 * s, -0.02, 0.72);
  const antena = nodo('antena', casco, -0.3, 0.48, 0.3);
  antena.rotation.z = 0.25;
  pieza(antena, capsula(0.025, 0.3), toon(PALETA.metalOscuro), 0, 0.17, 0);
  pieza(antena, esfera(0.07), brillo(PALETA.plasma), 0, 0.36, 0, { contorno: false });

  // Alas cortas con aleta naranja y luz de posición en la punta.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const ala = nodo(`ala_${lado}`, casco, 0.45 * s, -0.16, -0.3);
    const plano = pieza(ala, caja(1.2, 0.18, 0.78, 0.08), toon(PALETA.traje), 0.55 * s, 0, 0);
    plano.rotation.set(0, THREE.MathUtils.degToRad(-16 * s), THREE.MathUtils.degToRad(6 * s));
    const aleta = pieza(ala, caja(0.13, 0.46, 0.52, 0.06), toon(PALETA.naranja), 1.12 * s, 0.2, -0.2);
    aleta.rotation.x = THREE.MathUtils.degToRad(-14);
    const luz = nodo(`luz_${lado}`, ala, 1.13 * s, 0.46, -0.32);
    pieza(luz, esfera(0.07), brillo(s > 0 ? PALETA.plasma : PALETA.ada), 0, 0, 0, { contorno: false });
  }

  // Góndolas de motor bajo las alas: cuerpo de metal, aro naranja, tobera y llama.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const motor = nodo(`motor_${lado}`, casco, 0.66 * s, -0.24, -0.95);
    pieza(motor, tumbada(barril(0.26, 0.3, 0.95, 0.12)), toon(PALETA.metal));
    pieza(motor, tumbada(toro(0.27, 0.05)), toon(PALETA.naranja), 0, 0, 0.3);
    pieza(motor, tumbada(barril(0.19, 0.27, 0.24, 0.05)), toon(PALETA.oscuro), 0, 0, -0.56);
    const fuego = nodo(`llama_${lado}`, motor, 0, 0, -0.66);
    pieza(fuego, llama(0.2, 0.75), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
    pieza(fuego, llama(0.11, 0.48), brillo('#e9feff'), 0, 0, 0.01, { contorno: false, sombra: false });
  }

  // Tobera central y deriva de cola.
  const central = nodo('motor_c', casco, 0, 0.04, -1.42);
  pieza(central, tumbada(barril(0.3, 0.4, 0.34, 0.06)), toon(PALETA.oscuro), 0, 0, -0.1);
  const fuegoC = nodo('llama_c', central, 0, 0, -0.27);
  pieza(fuegoC, llama(0.3, 1.0), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
  pieza(fuegoC, llama(0.17, 0.62), brillo('#e9feff'), 0, 0, 0.01, { contorno: false, sombra: false });
  const cola = nodo('cola', casco, 0, 0.46, -0.95);
  const deriva = pieza(cola, caja(0.14, 0.56, 0.66, 0.06), toon(PALETA.traje), 0, 0.2, -0.1);
  deriva.rotation.x = THREE.MathUtils.degToRad(-28);
  const punta = pieza(cola, caja(0.16, 0.16, 0.46, 0.06), toon(PALETA.naranja), 0, 0.46, -0.24);
  punta.rotation.x = THREE.MathUtils.degToRad(-28);

  // Los detalles pequeños (esclusa, escotilla y patas) van con menos segmentos:
  // en la cinemática ni se ven, y posada la nave se mira de lejos.
  conDetalle(0.5, () => {
    // Esclusa en el costado izquierdo: un módulo que asoma del fuselaje con el
    // hueco oscuro y una luz cian dentro. La escotilla gira sobre su borde de
    // abajo hasta quedar de rampa, y de ella sale una prolongación que llega al
    // suelo; por dentro lleva peldaños (la cara que queda arriba al abrir).
    pieza(casco, caja(0.2, 0.68, 0.5, 0.06), toon(PALETA.traje), 0.55, 0.02, 0.2);
    pieza(casco, caja(0.02, 0.6, 0.38, 0.01), toon('#1d2b4f'), 0.655, 0.02, 0.2);
    pieza(casco, caja(0.02, 0.04, 0.3, 0.01), brillo(PALETA.ada), 0.667, 0.28, 0.2, { contorno: false });
    const escotilla = nodo('escotilla', casco, 0.66, -0.32, 0.2);
    pieza(escotilla, caja(0.06, 0.64, 0.42, 0.03), toon(PALETA.traje), 0.03, 0.32, 0);
    pieza(escotilla, caja(0.07, 0.07, 0.43, 0.02), toon(PALETA.naranja), 0.03, 0.08, 0);
    pieza(escotilla, esfera(0.07, 0.4, 1, 1), brillo(PALETA.ada), 0.064, 0.45, 0, { contorno: false });
    for (const y of [0.18, 0.34, 0.5]) pieza(escotilla, caja(0.02, 0.04, 0.34, 0.01), toon(PALETA.oscuro), -0.004, y, 0, { contorno: false });
    const prolongacion = nodo('escotilla_punta', escotilla);
    pieza(prolongacion, caja(0.05, 0.56, 0.38, 0.02), toon(PALETA.metal), 0.03, 0.32, 0);
    for (const y of [0.2, 0.42]) pieza(prolongacion, caja(0.02, 0.04, 0.3, 0.01), toon(PALETA.oscuro), 0.004, y, 0, { contorno: false });

    // Tren de aterrizaje: dos patas bajo las góndolas y una bajo el morro, con
    // pistón oscuro, rodilla naranja y zapata. Escondidas en vuelo (escala casi
    // cero); al posarse, el casco baja a 1 m y las zapatas tocan el suelo.
    const pata = (nombre: string, x: number, y: number, z: number, abre: number, adelante: number) => {
      const p = nodo(nombre, casco, x, y, z);
      barra(p, [0, 0, 0], [abre * 0.5, -0.22, adelante * 0.5], 0.06, toon(PALETA.oscuro));
      barra(p, [abre * 0.5, -0.21, adelante * 0.5], [abre, -0.45, adelante], 0.04, toon(PALETA.metal));
      pieza(p, esfera(0.065), toon(PALETA.naranja), abre * 0.5, -0.21, adelante * 0.5);
      pieza(p, barril(0.13, 0.17, 0.06, 0.03), toon(PALETA.metalOscuro), abre, -0.47, adelante);
      p.scale.setScalar(0.001);
      return p;
    };
    pata('pata_i', 0.66, -0.48, -0.78, 0.2, 0);
    pata('pata_d', -0.66, -0.48, -0.78, -0.2, 0);
    pata('pata_n', 0, -0.5, 0.78, 0, 0.08);
  });

  // Retros del morro: escondidos (escala casi cero) hasta que la nave frena.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const retro = nodo(`retro_${lado}`, casco, 0.42 * s, -0.12, 1.0);
    retro.rotation.y = THREE.MathUtils.degToRad(-150 * s);
    pieza(retro, llama(0.09, 0.4), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
    retro.scale.setScalar(0.001);
  }

  // Llamas: `largo` escala la z de las tres, con un temblor rápido que cierra el ciclo.
  const llamas = (d: number, largo: number, temblor: number, veces: number) =>
    (['llama_i', 'llama_d', 'llama_c'] as const).map((n, k) =>
      esc(n, ciclo(d, (f) => {
        const z = largo * (1 + temblor * sen(f, veces, k * 0.31) + temblor * 0.5 * sen(f, veces * 2 + 1, k * 0.17));
        const r = 1 + temblor * 0.4 * sen(f, veces, k * 0.31 + 0.25);
        return [r, r, z];
      })),
    );
  const ojos = (d: number, en: number) => [esc('ojo_i', parpadeo(d, en)), esc('ojo_d', parpadeo(d, en))];
  const patas = (claves: Clave[]) => ['pata_i', 'pata_d', 'pata_n'].map((n) => esc(n, claves));
  const retros = (claves: Parameters<typeof poses>[0]) => [esc('retro_i', poses(claves)), esc('retro_d', poses(claves))];

  const animaciones = [
    animacion('Flotar', 2.4, [
      mov(raiz, 'casco', ciclo(2.4, (f) => [0, sen(f) * 0.08, 0])),
      rot('casco', ciclo(2.4, (f) => [sen(f, 1, 0.25) * 3, 0, sen(f) * 4])),
      rot('ala_i', ciclo(2.4, (f) => [0, 0, sen(f, 1, 0.1) * 3])),
      rot('ala_d', ciclo(2.4, (f) => [0, 0, -sen(f, 1, 0.1) * 3])),
      rot('antena', ciclo(2.4, (f) => [sen(f, 2) * 8, 0, 14 + sen(f, 1, 0.2) * 10])),
      ...llamas(2.4, 0.55, 0.12, 12),
      ...ojos(2.4, 1.7),
    ], 'movimiento', 'Flota en el sitio meciéndose; las llamas tiemblan bajas y parpadea.'),

    animacion('Volar', 1.2, [
      mov(raiz, 'casco', ciclo(1.2, (f) => [0, sen(f, 2) * 0.025, 0])),
      rot('casco', ciclo(1.2, (f) => [sen(f) * 1.5, 0, sen(f, 1, 0.25) * 1.5])),
      rot('antena', ciclo(1.2, (f) => [-25 + sen(f, 3) * 6, 0, 14])),
      ...llamas(1.2, 1.35, 0.12, 9),
    ], 'movimiento', 'Crucero: llamas largas y la antena peinada hacia atrás.'),

    animacion('Turbo', 0.8, [
      mov(raiz, 'casco', ciclo(0.8, (f) => [sen(f, 6) * 0.02, sen(f, 5, 0.3) * 0.03, 0])),
      rot('ala_i', ciclo(0.8, (f) => [0, 14 + sen(f, 4) * 2, 0])),
      rot('ala_d', ciclo(0.8, (f) => [0, -14 - sen(f, 4) * 2, 0])),
      rot('antena', ciclo(0.8, (f) => [-55 + sen(f, 6) * 8, 0, 14])),
      esc('ojo_i', ciclo(0.8, () => [1.15, 0.55, 1])),
      esc('ojo_d', ciclo(0.8, () => [1.15, 0.55, 1])),
      ...llamas(0.8, 2.3, 0.14, 8),
    ], 'ataque', 'A todo gas: llamas enormes, alas plegadas hacia atrás y ojos entornados.'),

    animacion('Frenar', 1.0, [
      rot('casco', poses([[0, 0, 0, 0], [0.25, -16, 0, 0], [0.6, -6, 0, 0], [1.0, 0, 0, 0]])),
      mov(raiz, 'casco', poses([[0, 0, 0, 0], [0.25, 0, 0.12, -0.15], [0.6, 0, -0.04, 0.05], [1.0, 0, 0, 0]])),
      rot('antena', poses([[0, -25, 0, 14], [0.3, 40, 0, 20], [0.55, -10, 0, 10], [1.0, 0, 0, 14]])),
      ...retros([[0, 0.001, 0.001, 0.001], [0.08, 1.3, 1.3, 1.5], [0.4, 1, 1, 1.1], [0.6, 0.001, 0.001, 0.001], [1.0, 0.001, 0.001, 0.001]]),
      ...(['llama_i', 'llama_d', 'llama_c'] as const).map((n) => esc(n, poses([[0, 1, 1, 1.35], [0.2, 0.6, 0.6, 0.15], [0.6, 0.8, 0.8, 0.3], [1.0, 1, 1, 0.55]]))),
      ...ojos(1.0, 0.5),
    ], 'reaccion', 'Encabrita el morro, dispara los retros y las llamas se recogen hasta quedarse flotando.', false),

    animacion('Aterrizar', 2.6, [
      mov(raiz, 'casco', poses([[0, 0, 0, 0], [1.3, 0, POSADA - 0.06, 0], [1.45, 0, POSADA - 0.08, 0], [1.65, 0, POSADA + 0.02, 0], [1.85, 0, POSADA, 0], [2.6, 0, POSADA, 0]])),
      rot('casco', poses([[0, 0, 0, 0], [0.6, -5, 0, 2], [1.3, -2, 0, -1], [1.45, 2, 0, 0], [1.75, -1, 0, 0], [2.0, 0, 0, 0], [2.6, 0, 0, 0]])),
      ...patas(poses([[0, 0.001, 0.001, 0.001], [0.25, 0.001, 0.001, 0.001], [0.55, 1, 1, 1], [2.6, 1, 1, 1]])),
      rot('pata_i', poses([[0, 80, 0, 0], [0.25, 80, 0, 0], [0.9, 0, 0, 0], [2.6, 0, 0, 0]])),
      rot('pata_d', poses([[0, 80, 0, 0], [0.25, 80, 0, 0], [0.9, 0, 0, 0], [2.6, 0, 0, 0]])),
      rot('pata_n', poses([[0, -80, 0, 0], [0.25, -80, 0, 0], [0.9, 0, 0, 0], [2.6, 0, 0, 0]])),
      ...(['llama_i', 'llama_d', 'llama_c'] as const).map((n) =>
        esc(n, poses([[0, 1, 1, 0.55], [0.7, 1.1, 1.1, 0.9], [1.3, 1, 1, 0.7], [1.5, 0.001, 0.001, 0.001], [2.6, 0.001, 0.001, 0.001]]))),
      rot('antena', poses([[0, 0, 0, 14], [1.45, 0, 0, 14], [1.6, 35, 0, 20], [1.85, -15, 0, 10], [2.1, 0, 0, 14], [2.6, 0, 0, 14]])),
      rot('escotilla', poses([[0, 0, 0, 0], [1.9, 0, 0, 0], [2.35, 0, 0, RAMPA], [2.6, 0, 0, RAMPA]])),
      mov(raiz, 'escotilla_punta', poses([[0, 0, 0, 0], [2.2, 0, 0, 0], [2.6, 0, 0.5, 0]])),
      ...ojos(2.6, 1.6),
    ], 'reaccion', 'Baja despacio, saca las patas, rebota al tocar el suelo, apaga los motores y abre la escotilla, que queda de rampa.', false),

    animacion('Posada', 3.0, [
      mov(raiz, 'casco', ciclo(3, () => [0, POSADA, 0])),
      ...patas(ciclo(3, () => [1, 1, 1])),
      ...(['llama_i', 'llama_d', 'llama_c'] as const).map((n) => esc(n, ciclo(3, () => [0.001, 0.001, 0.001]))),
      rot('escotilla', ciclo(3, () => [0, 0, RAMPA])),
      mov(raiz, 'escotilla_punta', ciclo(3, () => [0, 0.5, 0])),
      // Luces de posición a destiempo, la antena se mece y los ojos miran a los lados.
      esc('luz_i', ciclo(3, (f) => { const k = sen(f, 3) > 0.3 ? 1.4 : 0.35; return [k, k, k]; })),
      esc('luz_d', ciclo(3, (f) => { const k = sen(f, 3, 0.5) > 0.3 ? 1.4 : 0.35; return [k, k, k]; })),
      rot('antena', ciclo(3, (f) => [sen(f, 2) * 6, 0, 14 + sen(f) * 8])),
      mov(raiz, 'ojo_i', ciclo(3, (f) => [sen(f) * 0.035, 0, 0])),
      mov(raiz, 'ojo_d', ciclo(3, (f) => [sen(f) * 0.035, 0, 0])),
      ...ojos(3, 2.3),
    ], 'movimiento', 'Posada en el mapa: patas fuera, motores apagados, escotilla abierta de rampa, luces que parpadean y ojos que miran alrededor.'),
  ];

  return { id: 'nave', nombre: 'Nave de ARES-IX', rol: 'Cinemática de entrada', raiz, animaciones };
}

/** Escala de la nave posada: la escotilla, a la altura del especialista. */
export const ESCALA_POSADA = 3.5;

/**
 * La nave posada en el mapa, junto a la salida: la misma, a la escala del
 * mundo (×3,5: 11,6 m de largo y 6,5 de alto) con el contorno del mismo grueso
 * que todo lo demás, algo menos de detalle y «Posada» como primer clip.
 */
export function crearNavePosada(): Modelo {
  const m = agrandar(conDetalle(0.7, crearNave), ESCALA_POSADA);
  const primero = (n: string) => (n === 'Posada' ? 0 : n === 'Aterrizar' ? 1 : 2);
  m.animaciones.sort((a, b) => primero(a.clip.name) - primero(b.clip.name));
  return { ...m, id: 'nave-posada', nombre: 'Nave de ARES-IX (posada)', rol: 'Mapa · junto a la salida' };
}
