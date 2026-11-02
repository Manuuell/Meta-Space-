import * as THREE from 'three';
import {
  PALETA, animacion, brillo, capsula, curva, esfera, nodo, pieza, porFotograma, punta, toon, toro,
  type Modelo, type Pose,
} from './kit.ts';

// Avispa: dron insecto de HELIOS. Abdomen de chapa con rayas púrpura que
// brillan y un aguijón largo, cabeza con dos ojos enormes de pupila roja bajo
// párpados de chapa y antenas. Vuela con dos rotores; el derecho está roto
// (una pala partida, el aro abierto y remendado con cinta), así que vuela
// torcida. Vuela a 3,4 m; mira hacia +z; mide 1,4 m de la cabeza a la punta
// del aguijón y 1,4 de rotor a rotor.
//
// Volar y Picar duran 3 s y van en fase con el ciclo del juego
// (`moverAvispa`: orbita hasta 2,2 s y pica de 2,2 a 3 s). La bajada del
// picado la pone el juego con `liftDe`; el clip inclina, recoge el aguijón y
// pica, así un golpe en pleno picado no la sube de golpe.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const ALTURA = 3.4;
const CICLO = 3;

export function crearAvispa(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'avispa';
  const cuerpo = nodo('cuerpo', raiz, 0, ALTURA, 0);

  // Tórax con los brazos de los rotores, sus aros y cuatro patitas colgando.
  pieza(cuerpo, esfera(0.19, 1, 0.95, 1.1), toon(PALETA.chapaHelios));
  for (const s of [1, -1]) {
    const brazo = pieza(cuerpo, capsula(0.03, 0.3).rotateZ(Math.PI / 2), toon(PALETA.metalOscuro), 0.2 * s, 0.13, -0.02);
    brazo.rotation.z = 0.45 * s;
    for (const z of [0.07, -0.08]) {
      const p = pieza(cuerpo, capsula(0.022, 0.16), toon(PALETA.metalOscuro), 0.1 * s, -0.22, z, { contorno: false });
      p.rotation.set(z > 0 ? 0.5 : -0.3, 0, 0.35 * s);
    }
  }
  pieza(cuerpo, toro(0.28, 0.026), brillo(PALETA.purpuraBrillo), 0.4, 0.27, -0.02, { contorno: false });
  // El aro del rotor roto: abierto, torcido y con dos tiras de cinta.
  const aroRoto = pieza(cuerpo, new THREE.TorusGeometry(0.28, 0.026, 5, 18, Math.PI * 1.55).rotateX(Math.PI / 2), brillo(PALETA.purpuraBrillo), -0.4, 0.25, -0.02, { contorno: false });
  aroRoto.rotation.set(0.18, 2.2, -0.2);
  for (const [x, z, giro] of [[-0.62, 0.1, 0.5], [-0.6, -0.16, -0.6]] as const) {
    const cinta = pieza(cuerpo, capsula(0.035, 0.07), toon(PALETA.arena), x, 0.27, z);
    cinta.rotation.set(0, giro, 0.4);
  }

  // Cabeza: dos ojos enormes casi juntos, párpados en V, antenas y mandíbulas.
  const cabeza = nodo('cabeza', cuerpo, 0, 0.03, 0.17);
  pieza(cabeza, esfera(0.15, 1.15, 1, 1), toon(PALETA.metalHelios), 0, 0, 0.05);
  for (const s of [1, -1]) {
    pieza(cabeza, esfera(0.105, 1, 1.15, 0.75), toon(PALETA.blanco), 0.09 * s, 0.03, 0.13);
    // Párpado de chapa: tapa la mitad de arriba, más baja por dentro.
    const parpado = pieza(cabeza, esfera(0.115, 1.05, 0.62, 0.8), toon(PALETA.chapaHelios), 0.09 * s, 0.1, 0.13);
    parpado.rotation.z = 0.42 * s;
    const antena = pieza(cabeza, capsula(0.014, 0.3), toon(PALETA.chapaHelios), 0.06 * s, 0.24, 0.08);
    antena.rotation.set(0.5, 0, -0.45 * s);
    const mandibula = pieza(cabeza, punta(0.035, 0.12).rotateX(Math.PI / 2), toon(PALETA.chapaHelios), 0.045 * s, -0.11, 0.16);
    mandibula.rotation.y = -0.5 * s;
  }
  const pupilas = nodo('pupilas', cabeza, 0, 0, 0);
  for (const s of [1, -1]) {
    pieza(pupilas, esfera(0.062, 1, 1.1, 0.5), brillo(PALETA.helios), 0.1 * s, 0.0, 0.2, { contorno: false, sombra: false });
    pieza(pupilas, esfera(0.02), brillo(PALETA.blanco), 0.1 * s + 0.02, 0.02, 0.225, { contorno: false, sombra: false });
  }

  // Abdomen con rayas que brillan y el aguijón: gira en la cintura para
  // apuntar el aguijón hacia delante al picar.
  const abdomen = nodo('abdomen', cuerpo, 0, -0.02, -0.15);
  pieza(abdomen, esfera(0.17, 1, 0.9, 1.6), toon(PALETA.metalHelios), 0, -0.02, -0.25);
  for (const [z, r] of [[-0.12, 0.155], [-0.25, 0.172], [-0.38, 0.15]] as const) {
    pieza(abdomen, toro(r, 0.03).rotateX(Math.PI / 2), brillo(PALETA.purpuraBrillo), 0, -0.02, z, { contorno: false });
  }
  pieza(abdomen, punta(0.06, 0.36).rotateX(-Math.PI / 2), toon(PALETA.purpura), 0, -0.04, -0.64);

  // Rotor bueno (izquierda, +x) y rotor roto (derecha): una sola pala y un muñón.
  const rotorI = nodo('rotor_i', cuerpo, 0.4, 0.29, -0.02);
  pieza(rotorI, esfera(0.045), toon(PALETA.oscuro));
  pieza(rotorI, esfera(0.25, 1, 0.07, 0.2), toon(PALETA.metal), 0, 0.02, 0);
  const rotorD = nodo('rotor_d', cuerpo, -0.4, 0.27, -0.02);
  pieza(rotorD, esfera(0.045), toon(PALETA.oscuro));
  pieza(rotorD, esfera(0.125, 1, 0.14, 0.4), toon(PALETA.metal), 0.12, 0.02, 0);
  pieza(rotorD, esfera(0.05, 1, 0.3, 0.8), toon(PALETA.metal), -0.06, 0.02, 0);
  pieza(rotorD, capsula(0.03, 0.04).rotateX(Math.PI / 2), toon(PALETA.arena), 0.05, 0.02, 0);

  /**
   * Una vuelta del ciclo del juego. `ataque` (0 o 1): con 1 se echa atrás
   * antes de picar (la telegrafía), recoge el aguijón y pica a fondo.
   */
  const ciclo = (t: number, ataque: number): Pose => {
    t %= CICLO;
    const f = t / CICLO;
    const orbita = 1 - THREE.MathUtils.smoothstep(t, 1.6, 1.8) + THREE.MathUtils.smoothstep(t, 2.85, 3);
    const aviso = THREE.MathUtils.smoothstep(t, 1.7, 2.05) * (1 - THREE.MathUtils.smoothstep(t, 2.2, 2.3));
    const cabeceo = curva(t, [[0, -14], [0.35, 4], [0.6, 2], [1.7, 2], [2.1, -10 - 22 * ataque], [2.2, -10 - 20 * ataque], [2.36, 38 + 12 * ataque], [2.6, 30], [2.85, -10], [3, -14]]);
    const temblor = aviso * Math.sin(t * 95) * (2 + 4 * ataque);
    return {
      mov: {
        cuerpo: [
          orbita * sen(f, 3) * 0.05,
          orbita * sen(f, 6) * 0.07 + curva(t, [[1.7, 0], [2.15, 0.08 + 0.1 * ataque], [2.3, 0]]),
          curva(t, [[1.7, 0], [2.15, -0.12 - 0.18 * ataque], [2.35, 0.1], [2.6, 0.12 + 0.12 * ataque], [3, 0]]),
        ],
        pupilas: [orbita * sen(f, 2) * 0.012, 0, 0],
      },
      rot: {
        // Torcida hacia el lado roto, con el bamboleo del rotor malo.
        cuerpo: [cabeceo + orbita * sen(f, 6, 0.2) * 4, orbita * sen(f, 2) * 8, 13 + orbita * sen(f, 9) * 6 + sen(f, 3) * 3 + temblor],
        cabeza: [curva(t, [[0, 6], [0.4, -4], [1.7, -4], [2.1, 12], [2.36, -18], [2.6, -12], [3, 6]]), orbita * sen(f, 2, 0.15) * 14, -10],
        abdomen: [
          // Negativo: el aguijón se recoge por debajo y apunta hacia delante.
          curva(t, [[0, 8], [0.35, -12], [0.6, -8], [1.7, -8], [2.1, -35 - 45 * ataque], [2.36, -28 - 30 * ataque], [2.55, -50 - 50 * ataque], [2.68, -20], [2.9, 12], [3, 8]])
            + orbita * sen(f, 6) * 6,
          orbita * sen(f, 3) * 10, 0,
        ],
        rotor_i: [0, f * 360 * 12, 0],
        rotor_d: [sen(f, 15) * 8, f * 360 * 10 + sen(f, 9) * 40, -10 + sen(f, 12, 0.3) * 6],
      },
      esc: {
        pupilas: Array(3).fill(1 + aviso * (0.25 + 0.35 * ataque)) as [number, number, number],
        rotor_d: [1, 1, 1],
        cuerpo: [
          1 + curva(t, [[2.2, 0], [2.3, -0.06], [2.55, 0], [2.62, 0.08], [2.8, 0]]),
          1 + curva(t, [[1.7, 0], [2.1, -0.08 * ataque], [2.2, -0.08 * ataque], [2.3, 0.1], [2.55, 0], [2.62, -0.1], [2.8, 0]]),
          1 + curva(t, [[1.7, 0], [2.1, -0.05 * ataque], [2.3, 0.14], [2.55, 0.04], [2.62, 0.12], [2.8, 0]]),
        ],
      },
    };
  };

  const quieto = (t: number, d: number): Pose => {
    const f = t / d;
    return {
      mov: { cuerpo: [0, 0, 0], pupilas: [0, 0, 0] },
      rot: {
        cuerpo: [-6, 0, 13], cabeza: [0, 0, -10], abdomen: [0, 0, 0],
        rotor_i: [0, f * 360 * 4, 0], rotor_d: [0, f * 360 * 3, -10],
      },
      esc: { pupilas: [1, 1, 1], cuerpo: [1, 1, 1], rotor_d: [1, 1, 1] },
    };
  };

  const animaciones = [
    animacion('Volar', CICLO, porFotograma(raiz, CICLO, (t) => ciclo(t, 0)), 'movimiento',
      'El ciclo del juego (3 s): vuela torcida orbitando, se inclina y baja el morro en el picado de 2,2 a 3 s. El juego pone la bajada.'),

    animacion('Picar', CICLO, porFotograma(raiz, CICLO, (t) => ciclo(t, 1)), 'ataque',
      'El mismo ciclo, a por el jugador: de 1,7 a 2,2 s se echa atrás temblando con los ojos encendidos y recoge el aguijón; pica en picado y clava en 2,55 s.'),

    animacion('Golpe recibido', 0.3, porFotograma(raiz, 0.3, (t) => {
      const p = quieto(t, 0.3);
      const k = curva(t, [[0, 0], [0.05, 1], [0.3, 0]]);
      p.mov!.cuerpo = [curva(t, [[0, 0], [0.05, 0.08], [0.3, 0]]), -0.14 * k, -0.06 * k];
      p.rot!.cuerpo = [-6 - 18 * k, 0, curva(t, [[0, 13], [0.06, 45], [0.16, 0], [0.3, 13]])];
      p.rot!.abdomen = [curva(t, [[0, 0], [0.06, 30], [0.18, -15], [0.3, 0]]), 0, 0];
      p.esc!.pupilas = [1 - 0.5 * k, 1 - 0.5 * k, 1];
      p.esc!.cuerpo = [1 + 0.15 * k, 1 - 0.18 * k, 1 + 0.1 * k];
      return p;
    }), 'reaccion', 'Da un tumbo hacia el lado roto, se encoge y las pupilas se achican.', false),

    animacion('Derrota', 1.3, porFotograma(raiz, 1.3, (t) => {
      // El rotor roto se suelta y sale volando; ella cae en espiral.
      const p = quieto(t, 1.3);
      p.mov!.cuerpo = [curva(t, [[0, 0], [1.05, -0.3]]), curva(t, [[0, 0], [0.15, 0.12], [1.05, -ALTURA + 0.46], [1.15, -ALTURA + 0.58], [1.3, -ALTURA + 0.46]]), 0];
      p.rot!.cuerpo = [curva(t, [[0, -6], [1.05, 50], [1.3, 40]]), curva(t, [[0, 0], [1.05, 900], [1.3, 940]]), curva(t, [[0, 13], [0.3, 40], [1.05, 85], [1.3, 88]])];
      p.rot!.abdomen = [curva(t, [[0, 0], [0.4, -30], [1.05, 20], [1.3, 10]]), 0, 0];
      p.rot!.rotor_i = [0, curva(t, [[0, 0], [1, 1100], [1.3, 1180]]), 0];
      p.rot!.rotor_d = [curva(t, [[0, 0], [1.3, 500]]), curva(t, [[0, 0], [1.3, 1300]]), curva(t, [[0, -10], [1.3, 260]])];
      // Se pierde de vista: sale disparado hacia arriba y se aleja.
      p.mov!.rotor_d = [curva(t, [[0.08, 0], [0.55, -0.8]]), curva(t, [[0.08, 0], [0.55, 0.9]]), curva(t, [[0.08, 0], [0.55, -0.3]])];
      const lejos = curva(t, [[0.25, 1], [0.55, 0.001]]);
      p.esc!.rotor_d = [lejos, lejos, lejos];
      const k = curva(t, [[0, 1], [0.1, 1.5], [0.35, 0.05], [1.3, 0.05]]);
      p.esc!.pupilas = [k, k, 1];
      return p;
    }), 'reaccion', 'El rotor roto se suelta y sale volando; cae en espiral hasta el suelo con los ojos apagados.', false),
  ];

  return { id: 'avispa', nombre: 'Avispa', rol: 'Unidad de HELIOS · hostigadora aérea', raiz, animaciones };
}
