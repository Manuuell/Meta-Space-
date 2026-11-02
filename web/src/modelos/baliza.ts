import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, capsula, ciclo, cono, esc, esfera, mov, nodo, pieza, poses, rot, toon,
  toro, type Modelo,
} from './kit.ts';

// Baliza: un dron acorazado con pinchos púrpura, dos hélices, una pantalla
// con un ojo rojo que barre bajo dos cejas de chapa y una antena parabólica
// sobre un muelle. No ataca: triangula la señal de ADA y llama a más
// unidades. Flota a 1,6 m del suelo.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const giro = (d: number, nodo: string, vueltas: number, x = 0) => rot(nodo, ciclo(d, (f) => [x, f * 360 * vueltas, 0]));

export function crearBaliza(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'baliza';
  const cuerpo = nodo('cuerpo', raiz, 0, 1.6, 0);

  pieza(cuerpo, esfera(0.36, 1, 0.9, 1), toon(PALETA.chapaHelios));
  // Banda por debajo de la pantalla: si cruza el ojo, la cara no se lee.
  pieza(cuerpo, toro(0.325, 0.04), brillo(PALETA.purpuraBrillo), 0, -0.14, 0);
  pieza(cuerpo, caja(0.36, 0.2, 0.08, 0.05), toon('#120f1c'), 0, 0.05, 0.31);
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const ceja = pieza(cuerpo, caja(0.17, 0.05, 0.06, 0.02), toon(PALETA.metalHelios), 0.09 * s, 0.19, 0.33, { nombre: `ceja_${lado}` });
    ceja.rotation.z = THREE.MathUtils.degToRad(-24 * s);
  }
  // Pinchos púrpura en diagonal (delante va la pantalla; a los lados, las hélices).
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const pincho = cono(0.065, 0.22).rotateX(Math.PI / 2).rotateY(a);
    pieza(cuerpo, pincho, toon(PALETA.purpura), Math.sin(a) * 0.36, -0.02, Math.cos(a) * 0.36);
  }
  const escaner = nodo('escaner', cuerpo, 0, 0.05, 0.36);
  pieza(escaner, esfera(0.05), brillo(PALETA.helios), 0, 0, 0, { contorno: false });

  // Barra con dos hélices protegidas por un aro.
  pieza(cuerpo, caja(1.12, 0.07, 0.08, 0.03), toon(PALETA.metalOscuro), 0, -0.04, 0);
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const rotor = nodo(`rotor_${lado}`, cuerpo, 0.58 * s, 0.03, 0);
    pieza(rotor, esfera(0.06), toon(PALETA.oscuro));
    pieza(rotor, caja(0.42, 0.02, 0.08, 0.01), toon(PALETA.metal), 0, 0.02, 0);
    pieza(rotor, caja(0.08, 0.02, 0.42, 0.01), toon(PALETA.metal), 0, 0.02, 0);
    pieza(cuerpo, toro(0.25, 0.025), brillo(PALETA.purpuraBrillo), 0.58 * s, 0.03, 0, { contorno: false });
  }

  // Muelle y antena parabólica con su luz.
  const muelle = nodo('muelle', cuerpo, 0, 0.3, 0);
  for (const y of [0.03, 0.09, 0.15]) pieza(muelle, toro(0.09, 0.025), toon(PALETA.oscuro), 0, y, 0);
  const plato = nodo('plato', muelle, 0, 0.22, 0);
  plato.rotation.x = THREE.MathUtils.degToRad(25);
  pieza(plato, barril(0.42, 0.1, 0.14, 0.05), toon(PALETA.metalHelios), 0, 0.07, 0);
  pieza(plato, toro(0.41, 0.028), brillo(PALETA.purpuraBrillo), 0, 0.14, 0, { contorno: false });
  pieza(plato, capsula(0.025, 0.18), toon(PALETA.metalOscuro), 0, 0.24, 0);
  const luz = nodo('luz', plato, 0, 0.38, 0);
  pieza(luz, esfera(0.06), brillo(PALETA.helios), 0, 0, 0, { contorno: false });
  const onda = nodo('onda', plato, 0, 0.38, 0);
  pieza(onda, toro(0.5, 0.02), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  onda.scale.setScalar(0.001);

  const cola = nodo('cola', cuerpo, 0, -0.3, 0);
  pieza(cola, capsula(0.02, 0.2), toon(PALETA.metalOscuro), 0, -0.12, 0);
  pieza(cola, esfera(0.05), brillo(PALETA.helios), 0, -0.26, 0, { contorno: false });

  const parpadeoLuz = (d: number, veces: number) =>
    esc('luz', ciclo(d, (f) => { const k = sen(f, veces) > 0 ? 1.2 : 0.2; return [k, k, k]; }));

  const animaciones = [
    animacion('Flotar', 1.6, [
      mov(raiz, 'cuerpo', ciclo(1.6, (f) => [0, sen(f) * 0.1, 0])),
      rot('cuerpo', ciclo(1.6, (f) => [sen(f, 1, 0.25) * 4, 0, sen(f) * 5])),
      giro(1.6, 'rotor_i', 4),
      giro(1.6, 'rotor_d', -4),
      rot('plato', ciclo(1.6, (f) => [25 + sen(f, 2) * 5, f * 360, 0])),
      esc('muelle', ciclo(1.6, (f) => [1, 1 + 0.12 * sen(f, 2), 1])),
      mov(raiz, 'escaner', ciclo(1.6, (f) => [sen(f, 2) * 0.12, 0, 0])),
      rot('cola', ciclo(1.6, (f) => [sen(f, 1, 0.3) * 15, 0, sen(f) * 10])),
      parpadeoLuz(1.6, 2),
    ], 'movimiento', 'Flota balanceándose; la antena gira buscando la señal.'),

    animacion('Triangular', 2.0, [
      mov(raiz, 'cuerpo', ciclo(2, (f) => [0, sen(f, 2) * 0.04, 0])),
      giro(2, 'rotor_i', 6),
      giro(2, 'rotor_d', -6),
      rot('plato', ciclo(2, (f) => [55 + sen(f, 4) * 4, f * 360 * 3, 0])),
      esc('muelle', ciclo(2, (f) => [1, 1.25 + 0.08 * sen(f, 8), 1])),
      mov(raiz, 'escaner', ciclo(2, (f) => [sen(f, 6) * 0.12, 0, 0])),
      esc('onda', ciclo(2, (f) => { const k = 0.2 + ((f * 2) % 1) * 2.6; return [k, k, k]; })),
      parpadeoLuz(2, 10),
    ], 'ataque', 'Se planta, la antena gira deprisa y emite pulsos: llama a más unidades.'),

    animacion('Golpe recibido', 0.35, [
      rot('cuerpo', poses([[0, 0, 0, 0], [0.06, 10, 0, 22], [0.18, -6, 0, -12], [0.35, 0, 0, 0]])),
      esc('cuerpo', poses([[0, 1, 1, 1], [0.05, 1.2, 0.8, 1.2], [0.18, 0.92, 1.08, 0.92], [0.35, 1, 1, 1]])),
      esc('muelle', poses([[0, 1, 1, 1], [0.06, 1, 0.5, 1], [0.2, 1, 1.3, 1], [0.35, 1, 1, 1]])),
      mov(raiz, 'escaner', poses([[0, 0, 0, 0], [0.06, 0.1, 0.05, 0], [0.12, -0.1, -0.03, 0], [0.35, 0, 0, 0]])),
    ], 'reaccion', 'Se sacude en el aire y el muelle rebota.', false),

    animacion('Derrota', 1.2, [
      mov(raiz, 'cuerpo', poses([[0, 0, 0, 0], [0.15, 0, 0.15, 0], [0.75, 0, -1.25, 0], [0.9, 0, -1.05, 0], [1.05, 0, -1.25, 0], [1.2, 0, -1.25, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.75, 70, 40, 110], [1.2, 80, 40, 100]])),
      rot('rotor_i', poses([[0, 0, 0, 0], [0.6, 0, 300, 0], [1.2, 0, 340, 0]])),
      rot('rotor_d', poses([[0, 0, 0, 0], [0.6, 0, -300, 0], [1.2, 0, -340, 0]])),
      rot('plato', poses([[0, 25, 0, 0], [0.5, 90, 0, 30], [1.2, 100, 0, 35]])),
      esc('luz', poses([[0, 1, 1, 1], [0.5, 1.5, 1.5, 1.5], [0.7, 0.01, 0.01, 0.01], [1.2, 0.01, 0.01, 0.01]])),
    ], 'reaccion', 'Las hélices se paran, da vueltas y cae rebotando; la luz se apaga.', false),
  ];

  return { id: 'baliza', nombre: 'Baliza', rol: 'Unidad de HELIOS · apoyo', raiz, animaciones };
}
