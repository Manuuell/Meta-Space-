import * as THREE from 'three';
import {
  PALETA, animacion, barril, brillo, caja, ciclo, cono, esc, esfera, mov, nodo, pieza, rot, toon, toro,
  type Modelo,
} from './kit.ts';
import { crearAstronauta } from './astronauta.ts';

// Equipo de movilidad del especialista: lo que ADA arma con la chatarra para
// cruzar Meta más deprisa. Mismo lenguaje que el traje: blanco, naranja y metal
// con luces de plasma. Cada pieza se puede ver sola en el taller y, en el
// juego, se cuelga de cualquier operador por sus nodos de enganche:
//   · mochila cohete → nodo `mochila_cohete`, va dentro de `enganche_mochila`
//     (el centro de la espalda)
//   · botas de impulso → nodos `bota_i` y `bota_d`, van dentro de
//     `enganche_bota_i/d` (el centro del pie, a la altura del tobillo)
//   · aerotabla → modelo suelto bajo los pies
// Cada pieza está modelada alrededor de su enganche, así que un operador más
// grande solo tiene que escalar su enganche.
// Las llamas tienen dos niveles: `chorro_*` lo escala el juego según el empuje
// y `llama_*` parpadea con la animación.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);

/** Llama de plasma que sale hacia −y del nodo: cono naranja con núcleo claro. */
function llama(padre: THREE.Object3D, nombre: string, radio: number, largo: number) {
  const chorro = nodo(`chorro_${nombre}`, padre);
  const l = nodo(`llama_${nombre}`, chorro);
  pieza(l, cono(radio, largo).rotateX(Math.PI).translate(0, -largo / 2, 0), brillo(PALETA.plasma), 0, 0, 0, { contorno: false, sombra: false });
  pieza(l, cono(radio * 0.5, largo * 0.6).rotateX(Math.PI).translate(0, -largo * 0.3, 0), brillo('#fff4d6'), 0, 0, 0, { contorno: false, sombra: false });
  return chorro;
}

/** Parpadeo de llama: escala que tiembla en un ciclo cerrado. */
const parpadeoLlama = (d: number, fase = 0) =>
  ciclo(d, (f) => {
    const k = 1 + 0.18 * sen(f + fase, 3) + 0.1 * sen(f + fase, 7);
    return [1 + 0.08 * sen(f + fase, 5), k, 1 + 0.08 * sen(f + fase, 5)];
  });

// ------------------------------------------------------------ Mochila cohete

/**
 * Mochila cohete: dos depósitos a los lados de la espalda (ADA o lo que lleve
 * cada uno sigue viéndose en el centro) con toberas hacia abajo. Coordenadas
 * del enganche `enganche_mochila`.
 */
export function crearMochilaCohete(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'mochila-cohete';
  // En el taller se ve a la espalda del astronauta; en el juego el nodo se
  // mueve dentro del enganche del operador y esta posición se anula.
  const m = nodo('mochila_cohete', raiz, 0, 1.29, -0.62);

  // Arnés: una barra que une los dos depósitos por detrás de ADA.
  pieza(m, caja(1.06, 0.12, 0.12, 0.05), toon(PALETA.metalOscuro), 0, 0.22, 0);
  pieza(m, caja(1.0, 0.1, 0.1, 0.04), toon(PALETA.metalOscuro), 0, -0.24, 0.02);

  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const tanque = nodo(`tanque_${lado}`, m, 0.46 * s, -0.02, 0);
    pieza(tanque, barril(0.17, 0.17, 0.66, 0.12), toon(PALETA.traje));
    pieza(tanque, esfera(0.15), toon(PALETA.naranja), 0, 0.34, 0);
    pieza(tanque, toro(0.175, 0.03), toon(PALETA.naranja), 0, 0.12, 0);
    pieza(tanque, caja(0.06, 0.3, 0.04, 0.02), brillo(PALETA.ada), 0.12 * s, 0.02, -0.12, { contorno: false });
    // Tobera: cono invertido de metal oscuro con anillo naranja.
    pieza(tanque, barril(0.11, 0.15, 0.16, 0.04), toon(PALETA.metalOscuro), 0, -0.4, 0);
    pieza(tanque, toro(0.15, 0.025), toon(PALETA.naranja), 0, -0.48, 0);
    // Aleta pequeña hacia fuera: se lee desde la cámara de juego.
    const aleta = pieza(tanque, caja(0.03, 0.3, 0.2, 0.015), toon(PALETA.naranja), 0.19 * s, -0.1, 0);
    aleta.rotation.z = 0.25 * s;
    const chorro = llama(tanque, `mochila_${lado}`, 0.12, 0.7);
    chorro.position.y = -0.5;
  }

  const animaciones = [
    animacion('Propulsar', 0.6, [
      esc('llama_mochila_i', parpadeoLlama(0.6)),
      esc('llama_mochila_d', parpadeoLlama(0.6, 0.37)),
      rot('tanque_i', ciclo(0.6, (f) => [sen(f, 2) * 2, 0, 0])),
      rot('tanque_d', ciclo(0.6, (f) => [-sen(f, 2) * 2, 0, 0])),
    ], 'movimiento', 'Las toberas escupen plasma y los depósitos vibran.'),
  ];

  return { id: 'mochila-cohete', nombre: 'Mochila cohete', rol: 'Equipo · vuelo corto', raiz, animaciones };
}

// ------------------------------------------------------------ Botas de impulso

/**
 * Botas de impulso: un tobillero con un propulsor en el talón que empuja
 * hacia atrás. Coordenadas del enganche `enganche_bota_*` (el centro del pie).
 */
export function crearBotasImpulso(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'botas-impulso';

  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const b = nodo(`bota_${lado}`, raiz, 0.24 * s, 0.11, 0);
    // Carcasa que envuelve la bota del traje (algo mayor en todo, así la
    // tapa sin parpadeos), con puntera naranja y suela gruesa.
    pieza(b, caja(0.42, 0.3, 0.56, 0.11), toon(PALETA.traje), 0, 0.02, 0.05);
    pieza(b, caja(0.44, 0.16, 0.2, 0.07), toon(PALETA.naranja), 0, -0.04, 0.24);
    pieza(b, caja(0.46, 0.07, 0.6, 0.03), toon(PALETA.metalOscuro), 0, -0.11, 0.05);
    pieza(b, toro(0.2, 0.05), toon(PALETA.naranja), 0, 0.18, 0);
    pieza(b, caja(0.06, 0.06, 0.22, 0.02), brillo(PALETA.ada), 0.215 * s, 0.04, 0.06, { contorno: false });
    // Propulsor del talón, mirando hacia atrás (−z).
    const propulsor = nodo(`propulsor_${lado}`, b, 0, 0.06, -0.24);
    propulsor.rotation.x = Math.PI / 2; // su −y apunta hacia atrás (−z)
    pieza(propulsor, barril(0.09, 0.12, 0.2, 0.04), toon(PALETA.metal), 0, 0, 0);
    pieza(propulsor, toro(0.12, 0.022), toon(PALETA.naranja), 0, -0.1, 0);
    const chorro = llama(propulsor, `bota_${lado}`, 0.09, 0.55);
    chorro.position.y = -0.12;
    // Alas de talón: un guiño a la velocidad.
    const ala = pieza(b, caja(0.03, 0.14, 0.26, 0.015), toon(PALETA.naranja), 0.23 * s, 0.16, -0.14);
    ala.rotation.x = -0.5;
  }

  const animaciones = [
    animacion('Impulso', 0.5, [
      esc('llama_bota_i', parpadeoLlama(0.5)),
      esc('llama_bota_d', parpadeoLlama(0.5, 0.5)),
    ], 'movimiento', 'Los propulsores del talón parpadean durante el acelerón.'),
  ];

  return { id: 'botas-impulso', nombre: 'Botas de impulso', rol: 'Equipo · acelerón', raiz, animaciones };
}

// ------------------------------------------------------------ Aerotabla

/**
 * Aerotabla: una tabla de chatarra que flota sobre dos almohadillas de plasma.
 * Mira hacia +z, como el astronauta; mide 1,9 m de punta a cola.
 */
export function crearAerotabla(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'aerotabla';
  const tabla = nodo('tabla', raiz, 0, 0.32, 0);

  // Cubierta: una caja larga y aplanada con la punta levantada.
  pieza(tabla, caja(0.66, 0.1, 1.5, 0.05), toon(PALETA.traje), 0, 0, 0);
  const punta = pieza(tabla, caja(0.62, 0.1, 0.42, 0.05), toon(PALETA.traje), 0, 0.06, 0.88);
  punta.rotation.x = -0.32;
  const cola = pieza(tabla, caja(0.62, 0.1, 0.32, 0.05), toon(PALETA.traje), 0, 0.03, -0.86);
  cola.rotation.x = 0.2;
  // Franja naranja y lija oscura donde van los pies.
  pieza(tabla, caja(0.68, 0.04, 0.16, 0.02), toon(PALETA.naranja), 0, 0.03, 0.46);
  pieza(tabla, caja(0.68, 0.04, 0.16, 0.02), toon(PALETA.naranja), 0, 0.03, -0.46);
  pieza(tabla, caja(0.5, 0.03, 0.56, 0.02), toon(PALETA.oscuro), 0, 0.055, 0, { contorno: false });
  // Luces de posición: ADA delante, plasma detrás.
  pieza(tabla, esfera(0.05), brillo(PALETA.ada), 0.22, 0.1, 0.98, { contorno: false });
  pieza(tabla, esfera(0.05), brillo(PALETA.ada), -0.22, 0.1, 0.98, { contorno: false });
  pieza(tabla, esfera(0.045), brillo(PALETA.plasma), 0.24, 0.06, -0.98, { contorno: false });
  pieza(tabla, esfera(0.045), brillo(PALETA.plasma), -0.24, 0.06, -0.98, { contorno: false });
  // Aletas de cola.
  for (const s of [1, -1]) {
    const aleta = pieza(tabla, caja(0.03, 0.2, 0.26, 0.015), toon(PALETA.naranja), 0.3 * s, 0.12, -0.84);
    aleta.rotation.z = -0.3 * s;
  }

  // Almohadillas de plasma: el disco que brilla es lo que la hace flotar.
  for (const [nombre, z] of [['delante', 0.45], ['detras', -0.45]] as const) {
    const pad = nodo(`almohadilla_${nombre}`, tabla, 0, -0.1, z);
    pieza(pad, barril(0.22, 0.18, 0.1, 0.04), toon(PALETA.metalOscuro));
    const luz = nodo(`luz_${nombre}`, pad, 0, -0.07, 0);
    pieza(luz, esfera(0.19, 1, 0.22, 1), brillo(PALETA.ada), 0, 0, 0, { contorno: false, sombra: false });
  }
  // Un halo en el suelo: se ve que flota aunque la sombra sea pequeña.
  const halo = nodo('halo', raiz, 0, 0.03, 0);
  const mat = new THREE.MeshBasicMaterial({ color: PALETA.ada, transparent: true, opacity: 0.35, depthWrite: false });
  pieza(halo, new THREE.CircleGeometry(0.75, 24).rotateX(-Math.PI / 2).scale(0.8, 1, 1.4), mat, 0, 0, 0, { contorno: false, sombra: false });

  const animaciones = [
    animacion('Flotar', 1.6, [
      mov(raiz, 'tabla', ciclo(1.6, (f) => [0, sen(f) * 0.04, 0])),
      rot('tabla', ciclo(1.6, (f) => [sen(f) * 2, 0, sen(f, 2) * 1.5])),
      esc('luz_delante', ciclo(1.6, (f) => { const k = 1 + 0.15 * sen(f, 4); return [k, k, k]; })),
      esc('luz_detras', ciclo(1.6, (f) => { const k = 1 + 0.15 * sen(f, 4); return [k, k, k]; })),
      esc('halo', ciclo(1.6, (f) => { const k = 1 + 0.08 * sen(f); return [k, 1, k]; })),
    ], 'movimiento', 'Flota sobre el hielo meciéndose; las almohadillas laten.'),
  ];

  return { id: 'aerotabla', nombre: 'Aerotabla', rol: 'Equipo · deslizarse', raiz, animaciones };
}

// ------------------------------------------------------------ Conjunto

/**
 * El especialista con todo el equipo puesto, para revisar en el taller cómo
 * encajan las piezas con sus animaciones de movilidad. Las llamas se ven
 * encendidas y parpadean junto con la pose.
 */
export function crearAstronautaEquipado(): Modelo {
  const astro = crearAstronauta();
  const mochila = crearMochilaCohete();
  const botas = crearBotasImpulso();
  const tabla = crearAerotabla();

  const m = mochila.raiz.getObjectByName('mochila_cohete')!;
  m.position.set(0, 0, 0);
  astro.raiz.getObjectByName('pecho')!.add(m);
  for (const lado of ['i', 'd']) {
    const b = botas.raiz.getObjectByName(`bota_${lado}`)!;
    b.position.set(0, 0, 0);
    astro.raiz.getObjectByName(`pierna_${lado}`)!.add(b);
  }

  const raiz = new THREE.Group();
  raiz.name = 'astronauta-equipado';
  astro.raiz.position.y = 0.4;
  raiz.add(astro.raiz, tabla.raiz);

  const llamas = [...mochila.animaciones, ...botas.animaciones].flatMap((a) => a.clip.tracks);
  const flotar = tabla.animaciones[0].clip.tracks;
  const elegidas = ['Surfear', 'Volar', 'Impulso', 'Reposo'];
  const animaciones = elegidas.map((nombre) => {
    const base = astro.animaciones.find((a) => a.clip.name === nombre)!;
    const pistas = [...base.clip.tracks, ...llamas, ...flotar].map((t) => t.clone());
    return animacion(nombre, base.clip.duration, pistas, base.grupo, base.descripcion, base.bucle);
  });

  return { id: 'astronauta-equipado', nombre: 'Especialista equipado', rol: 'Jugador · mochila, botas y aerotabla', raiz, animaciones };
}
