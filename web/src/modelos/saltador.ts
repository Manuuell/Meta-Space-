import * as THREE from 'three';
import {
  PALETA, animacion, brillo, capsula, curva, esfera, nodo, pieza, porFotograma, punta, toon, toro,
  type Modelo, type Pose,
} from './kit.ts';

// Saltador: un saltamontes de chatarra. Tórax de chapa con pinchos púrpura,
// un muelle por abdomen, patas traseras enormes con rodillas que brillan,
// cabeza en cuña con dos ojos rasgados de pupila roja bajo cejas de chapa y
// unas pinzas por mandíbula. Acecha agachado, se encoge (la telegrafía) y
// salta. Mira hacia +z; mide 1 m de alto y 1,6 de largo.
//
// Acechar y Saltar duran 2 s y van en fase con el ciclo del juego
// (`moverSaltador`: acecha hasta 1,15 s, se agacha hasta 1,5 s y salta hasta
// 2 s). La altura del salto la pone el juego con `liftDe`; el clip solo
// estira, encoge y dobla las patas, así un golpe en el aire no lo baja al suelo.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const grados = THREE.MathUtils.radToDeg;
const entre = (a: number, b: number, k: number) => a + (b - a) * k;

// Pata trasera: muslo (cadera → rodilla) y tibia (rodilla → pie), en metros.
const MUSLO = 0.55, TIBIA = 0.95;
const CADERA = { x: 0.3, y: 0.5, z: -0.1 };
const PIE = { y: 0.04, z: -0.1 };
// Pata delantera: de la cadera delantera al suelo.
const DELANTERA = { x: 0.16, y: -0.14, z: 0.24, largo: 0.34 };
const CICLO = 2;

/**
 * Pata de dos tramos vista de lado: con la cadera en el origen y el pie en
 * (y, z), devuelve el giro del muslo y el de la tibia (en grados) con la
 * rodilla arriba y atrás, como un saltamontes. Si el pie queda fuera de
 * alcance, la pata se estira o se dobla del todo en esa dirección.
 */
function pata(y: number, z: number): [number, number] {
  const largo = Math.hypot(y, z) || 1e-3;
  const d = THREE.MathUtils.clamp(largo, TIBIA - MUSLO + 0.005, MUSLO + TIBIA - 0.005);
  const py = (y / largo) * d, pz = (z / largo) * d;
  const a1 = Math.atan2(pz, py) + Math.acos((MUSLO * MUSLO + d * d - TIBIA * TIBIA) / (2 * MUSLO * d));
  const ry = MUSLO * Math.cos(a1), rz = MUSLO * Math.sin(a1);
  const a2 = Math.atan2(-(pz - rz), -(py - ry));
  return [grados(a1), grados(a2 - a1)];
}

/** Altura que el juego le suma durante el salto (`liftDe` en enemies-nuevos.ts). */
const elevacion = (t: number) => (t > 1.5 ? 0.9 * Math.sin(((t - 1.5) / 0.5) * Math.PI) : 0);

export function crearSaltador(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'saltador';
  const cuerpo = nodo('cuerpo', raiz);
  const cadera = nodo('cadera', cuerpo, 0, CADERA.y, CADERA.z);

  // Tórax: chapa con una banda que brilla y pinchos púrpura en el lomo.
  const torso = nodo('torso', cadera);
  pieza(torso, esfera(0.27, 1.05, 0.85, 1.35), toon(PALETA.chapaHelios), 0, 0.04, 0.1);
  pieza(torso, toro(0.235, 0.03).rotateX(Math.PI / 2), brillo(PALETA.purpuraBrillo), 0, 0.03, -0.06, { contorno: false });
  for (const [z, alto, inclina] of [[0.3, 0.2, -0.35], [0.1, 0.27, -0.55], [-0.12, 0.22, -0.75]] as const) {
    const p = pieza(torso, punta(0.07, alto), toon(PALETA.purpura), 0, 0.2 + alto * 0.35, z);
    p.rotation.x = inclina;
  }
  for (const s of [1, -1]) {
    const p = pieza(torso, punta(0.05, 0.16), toon(PALETA.purpura), 0.2 * s, 0.17, 0.02);
    p.rotation.set(-0.6, 0, -0.7 * s);
  }

  // Abdomen de muelle: se encoge al agacharse y se estira en el salto.
  const muelle = nodo('muelle', torso, 0, 0.03, -0.22);
  for (const [z, r] of [[-0.02, 0.19], [-0.11, 0.17], [-0.2, 0.15], [-0.29, 0.12]] as const) {
    pieza(muelle, toro(r, 0.042).rotateX(Math.PI / 2), toon(PALETA.metalOscuro), 0, 0, z);
  }
  pieza(muelle, esfera(0.1, 1, 1, 0.8), toon(PALETA.metalOscuro), 0, 0, -0.37);
  pieza(muelle, punta(0.05, 0.16).rotateX(-Math.PI / 2), brillo(PALETA.purpuraBrillo), 0, 0, -0.48, { contorno: false });

  // Cabeza en cuña: casco de chapa en punta que sombrea los ojos.
  const cabeza = nodo('cabeza', torso, 0, 0.1, 0.4);
  pieza(cabeza, esfera(0.19, 1.15, 0.92, 1.15), toon(PALETA.metalHelios), 0, 0.02, 0.08);
  const cuna = pieza(cabeza, punta(0.17, 0.5).rotateX(Math.PI / 2).scale(1.45, 0.45, 1), toon(PALETA.chapaHelios), 0, 0.16, 0.1);
  cuna.rotation.x = 0.22;
  for (const s of [1, -1]) {
    // Cejas en V: el extremo de dentro más bajo que el de fuera.
    const ceja = pieza(cabeza, capsula(0.032, 0.13).rotateZ(Math.PI / 2), toon(PALETA.chapaHelios), 0.1 * s, 0.1, 0.27);
    ceja.rotation.z = 0.5 * s;
    const antena = pieza(cabeza, capsula(0.016, 0.34), toon(PALETA.metalOscuro), 0.07 * s, 0.32, -0.04);
    antena.rotation.set(-0.75, 0, -0.35 * s);
  }
  // Ojos rasgados: el exterior más alto que el interior.
  const ojos = nodo('ojos', cabeza, 0, 0.05, 0.25);
  const pupilas = nodo('pupilas', ojos, 0, 0, 0.04);
  for (const s of [1, -1]) {
    const esclera = pieza(ojos, esfera(0.085, 1.45, 0.8, 0.55), toon(PALETA.blanco), 0.1 * s, 0, 0);
    esclera.rotation.z = 0.38 * s;
    pieza(pupilas, esfera(0.048, 1.15, 1, 0.5), brillo(PALETA.helios), 0.1 * s, -0.006, 0, { contorno: false, sombra: false });
    pieza(pupilas, esfera(0.016), brillo(PALETA.blanco), 0.1 * s + 0.016, 0.014, 0.018, { contorno: false, sombra: false });
  }
  // Pinzas: se abren escalando el nodo a lo ancho.
  const pinzas = nodo('pinzas', cabeza, 0, -0.1, 0.24);
  for (const s of [1, -1]) {
    const p = pieza(pinzas, punta(0.06, 0.26).rotateX(Math.PI / 2), toon(PALETA.purpura), 0.08 * s, 0, 0.07);
    p.rotation.y = -0.55 * s;
  }

  // Patas delanteras: cortas, para acechar.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const p = nodo(`pata_${lado}`, torso, DELANTERA.x * s, DELANTERA.y, DELANTERA.z);
    pieza(p, capsula(0.04, DELANTERA.largo - 0.1), toon(PALETA.metalOscuro), 0, -DELANTERA.largo / 2 + 0.02, 0);
    pieza(p, esfera(0.055, 1.2, 0.6, 1.4), toon(PALETA.metalOscuro), 0, -DELANTERA.largo + 0.03, 0.02);
  }

  // Patas traseras: muslo gordo de chapa y tibia larga con espinas.
  for (const [lado, s] of [['i', 1], ['d', -1]] as const) {
    const muslo = nodo(`muslo_${lado}`, cadera, CADERA.x * s, 0, 0);
    pieza(muslo, esfera(0.11, 0.85, 2.6, 1), toon(PALETA.metalHelios), 0.03 * s, MUSLO / 2, 0);
    pieza(muslo, esfera(0.075), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false });
    const tibia = nodo(`tibia_${lado}`, muslo, 0.03 * s, MUSLO, 0);
    pieza(tibia, esfera(0.07), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false });
    pieza(tibia, capsula(0.038, TIBIA - 0.12), toon(PALETA.metalOscuro), 0, -TIBIA / 2, 0);
    for (const k of [0.3, 0.5, 0.7]) {
      const espina = pieza(tibia, punta(0.025, 0.09), toon(PALETA.metalOscuro), 0, -TIBIA * k, -0.045, { contorno: false });
      espina.rotation.x = -2.2;
    }
    pieza(tibia, esfera(0.07, 1.1, 0.55, 1.7), toon(PALETA.metalOscuro), 0, -TIBIA + 0.01, 0.04);
  }

  /**
   * Coloca cadera, patas y pinzas. `cad` es el desplazamiento de la cadera
   * (y, z) y `cabeceo` la inclinación del tórax en grados (+ baja el morro).
   * Los pies traseros van a `pie` (coordenadas del modelo) y los delanteros
   * buscan el suelo, salvo que `delanteras` diga el ángulo.
   */
  const colocar = (p: {
    cad: [number, number]; cabeceo: number; balanceo?: number; giro?: number;
    pie?: [number, number]; delanteras?: [number, number]; pasos?: [number, number];
  }): Pose => {
    const cy = CADERA.y + p.cad[0], cz = CADERA.z + p.cad[1];
    const [fy, fz] = p.pie ?? [PIE.y, PIE.z];
    // Si la cadera baja tanto que la pata ya no se dobla más, el pie se
    // adelanta lo justo: la pata queda plegada como un muelle.
    const minimo = TIBIA - MUSLO + 0.006;
    const avance = Math.sqrt(Math.max(0, minimo * minimo - (fy - cy) ** 2));
    const [m, t] = pata(fy - cy, Math.max(fz - cz, avance));
    // Pata delantera: el ángulo que deja el pie en el suelo (+ hacia atrás).
    const alto = cy + DELANTERA.y * Math.cos(THREE.MathUtils.degToRad(p.cabeceo)) - DELANTERA.z * Math.sin(THREE.MathUtils.degToRad(p.cabeceo));
    const suelo = -grados(Math.acos(THREE.MathUtils.clamp((alto - 0.03) / DELANTERA.largo, -1, 1)));
    const [di, dd] = p.delanteras ?? [suelo, suelo];
    const [li, ld] = p.pasos ?? [0, 0];
    return {
      mov: { cadera: [0, p.cad[0], p.cad[1]] },
      rot: {
        torso: [p.cabeceo, p.giro ?? 0, p.balanceo ?? 0],
        muslo_i: [m, 0, 0], tibia_i: [t, 0, 0], muslo_d: [m, 0, 0], tibia_d: [t, 0, 0],
        pata_i: [di - p.cabeceo - li, 0, 0], pata_d: [dd - p.cabeceo - ld, 0, 0],
      },
    };
  };

  // Pose de reposo: la del acecho.
  const reposo = colocar({ cad: [0, 0], cabeceo: 4 });
  for (const [n, [x, y, z]] of Object.entries(reposo.rot!)) {
    raiz.getObjectByName(n)!.rotation.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z));
  }

  /**
   * El ciclo del juego en 2 s. `ataque` (0 o 1) es cuánto se nota la
   * intención: con 1 abre las pinzas, los ojos se encienden más y muerde
   * al caer.
   */
  const ciclo = (t: number, ataque: number): Pose => {
    t %= CICLO;
    const acecho = THREE.MathUtils.smoothstep(t, 0.2, 0.32) * (1 - THREE.MathUtils.smoothstep(t, 1.05, 1.15));
    const fase = (t - 0.2) / 0.95;
    const tension = THREE.MathUtils.smoothstep(t, 1.15, 1.5) * (t < 1.5 ? 1 : 0);
    const cadY = curva(t, [[0, -0.12], [0.1, 0.03], [0.22, -0.01], [0.3, 0], [1.15, 0], [1.45, -0.13], [1.5, -0.14], [1.56, 0.08], [1.75, 0.04], [1.93, 0.01], [2, -0.12]]);
    const cadZ = curva(t, [[0, 0.02], [0.2, 0], [1.15, 0], [1.48, -0.06], [1.56, 0.06], [1.9, 0.02], [2, 0.02]]);
    const cabeceo = curva(t, [[0, 14], [0.14, -3], [0.3, 4], [1.15, 4], [1.45, -4], [1.5, -6], [1.56, -24], [1.75, -2], [1.92, 16], [2, 14]])
      + acecho * sen(fase, 2) * 3;
    // En el aire los pies dejan el suelo: atrás y estirados al despegar,
    // recogidos en lo alto y buscando el suelo al caer.
    const aire = curva(t, [[1.5, 0], [1.56, 0], [1.63, 1], [1.86, 1], [1.97, 0]]);
    const relY = curva(t, [[1.5, -0.95], [1.66, -0.8], [1.75, -0.5], [1.88, -0.62]]);
    const relZ = curva(t, [[1.5, -0.2], [1.66, -0.55], [1.75, -0.62], [1.88, -0.05]]);
    const cy = CADERA.y + cadY, cz = CADERA.z + cadZ;
    const pie: [number, number] = [
      entre(PIE.y - elevacion(t), cy + relY, aire),
      entre(PIE.z, cz + relZ, aire),
    ];
    const vuelo = curva(t, [[1.5, 0], [1.6, 1], [1.88, 1], [1.97, 0]]);
    const delanteras = vuelo > 0 ? curva(t, [[1.5, -20], [1.62, -75], [1.8, -55], [1.95, -25]]) : 0;
    const p = colocar({
      cad: [cadY + acecho * Math.abs(sen(fase, 2)) * 0.015, cadZ], cabeceo,
      balanceo: acecho * sen(fase, 2) * 5 + tension * Math.sin(t * 90) * (1.5 + 2 * ataque),
      giro: acecho * sen(fase, 1) * 6,
      pie,
      pasos: [acecho * Math.max(0, sen(fase, 2)) * 22, acecho * Math.max(0, -sen(fase, 2)) * 22],
    });
    if (vuelo > 0) {
      const suelo = p.rot!.pata_i[0];
      const d = entre(suelo, delanteras - cabeceo, vuelo);
      p.rot!.pata_i = [d, 0, 0];
      p.rot!.pata_d = [d, 0, 0];
    }
    const encendido = tension * (0.12 + 0.18 * ataque);
    const abre = 1 + tension * (0.15 + 0.45 * ataque) * (1 + 0.2 * Math.sin(t * 70))
      + curva(t, [[1.5, 0], [1.66, 0.3 + 0.9 * ataque], [1.88, 0.35 + 0.9 * ataque], [1.94, -0.15 * ataque], [2, 0]]);
    const muelle = curva(t, [[0, 0.65], [0.12, 1.12], [0.26, 0.96], [0.36, 1], [1.15, 1], [1.45, 0.55], [1.5, 0.52], [1.56, 1.45], [1.75, 1.2], [1.92, 1], [2, 0.65]]);
    const ancho = 1 + (1 - muelle) * 0.35;
    p.rot!.cabeza = [
      curva(t, [[0, 10], [0.15, -4], [0.3, 0], [1.15, 0], [1.45, 12], [1.56, -10], [1.75, -6 - 8 * ataque], [1.92, 10], [2, 10]]),
      acecho * sen(fase, 1, 0.25) * 16, acecho * sen(fase, 2) * -4,
    ];
    p.rot!.muelle = [curva(t, [[0, -14], [0.15, 6], [0.3, 0], [1.15, 0], [1.45, -8], [1.56, 22], [1.8, 10], [2, -14]]), acecho * sen(fase, 1) * 10, 0];
    p.mov!.cabeza = [0, 0, curva(t, [[1.6, 0], [1.75, 0.07 * ataque], [1.9, 0.02], [2, 0]])];
    p.esc = {
      cuerpo: [
        curva(t, [[0, 1.14], [0.12, 0.95], [0.26, 1], [1.4, 1], [1.5, 1.06], [1.56, 0.9], [1.75, 0.97], [1.92, 1], [2, 1.14]]),
        curva(t, [[0, 0.84], [0.12, 1.06], [0.26, 1], [1.4, 1], [1.5, 0.93], [1.56, 1.16], [1.75, 1.04], [1.92, 1], [2, 0.84]]),
        curva(t, [[0, 1.1], [0.12, 0.97], [0.26, 1], [1.4, 1], [1.5, 1.04], [1.56, 1.1], [1.75, 1.02], [1.92, 1], [2, 1.1]]),
      ],
      muelle: [ancho, ancho, muelle],
      ojos: [1 + encendido, 1 + encendido * 1.3, 1],
      pupilas: [1 + encendido * 1.6, 1 + encendido * 1.6, 1],
      pinzas: [abre, 1, 1 + (abre - 1) * 0.2],
    };
    p.mov!.pupilas = [acecho * sen(fase, 1, 0.25) * 0.025, 0, 0];
    return p;
  };

  const quieto = (extra: Partial<Record<'cabeza' | 'pupilas', [number, number, number]>> = {}): Pose => {
    const p = colocar({ cad: [0, 0], cabeceo: 4 });
    p.rot!.cabeza = extra.cabeza ?? [0, 0, 0];
    p.rot!.muelle = [0, 0, 0];
    p.mov!.cabeza = [0, 0, 0];
    p.mov!.pupilas = extra.pupilas ?? [0, 0, 0];
    p.esc = { cuerpo: [1, 1, 1], muelle: [1, 1, 1], ojos: [1, 1, 1], pupilas: [1, 1, 1], pinzas: [1, 1, 1] };
    return p;
  };

  const animaciones = [
    animacion('Reposo', 1.6, porFotograma(raiz, 1.6, (t) => {
      const f = t / 1.6;
      const p = colocar({ cad: [-0.02 + sen(f, 2) * 0.012, 0], cabeceo: 4 + sen(f, 2) * 1.5, balanceo: sen(f) * 2 });
      p.rot!.cabeza = [sen(f, 2, 0.1) * 3, sen(f) * 18, sen(f) * -4];
      p.rot!.muelle = [sen(f, 2, 0.2) * 5, sen(f) * 8, 0];
      p.mov!.cabeza = [0, 0, 0];
      p.mov!.pupilas = [sen(f, 1, 0.1) * 0.03, 0, 0];
      // Muerde el aire dos veces y parpadea una.
      const mordisco = curva(t, [[0.5, 1], [0.58, 1.35], [0.64, 0.92], [0.72, 1.3], [0.78, 0.92], [0.9, 1]]);
      const parpado = curva(t, [[1.1, 1], [1.15, 0.12], [1.22, 1]]);
      p.esc = {
        cuerpo: [1, 1, 1],
        muelle: [1 - sen(f, 2) * 0.03, 1 - sen(f, 2) * 0.03, 1 + sen(f, 2) * 0.08],
        ojos: [1, parpado, 1], pupilas: [1, 1, 1], pinzas: [mordisco, 1, 1],
      };
      return p;
    }), 'movimiento', 'Agazapado: respira con el muelle, mira a los lados, muerde el aire y parpadea.'),

    animacion('Acechar', CICLO, porFotograma(raiz, CICLO, (t) => ciclo(t, 0)), 'movimiento',
      'El ciclo del juego (2 s): acecha moviendo las patas delanteras, se agacha temblando desde 1,15 s y salta en 1,5 s; aterriza en 2,0 s. El juego pone la altura.'),

    animacion('Saltar', CICLO, porFotograma(raiz, CICLO, (t) => ciclo(t, 1)), 'ataque',
      'El mismo ciclo, a por el jugador: al agacharse los ojos se encienden y las pinzas se abren; en el aire las abre del todo y muerde al caer.'),

    animacion('Golpe recibido', 0.3, porFotograma(raiz, 0.3, (t) => {
      const p = quieto({ cabeza: [curva(t, [[0, 0], [0.05, -22], [0.16, 6], [0.3, 0]]), 0, curva(t, [[0, 0], [0.05, 10], [0.3, 0]])] });
      p.rot!.torso = [curva(t, [[0, 4], [0.05, -12], [0.16, 8], [0.3, 4]]), 0, curva(t, [[0, 0], [0.06, -8], [0.18, 4], [0.3, 0]])];
      const k = curva(t, [[0, 0], [0.05, 1], [0.3, 0]]);
      p.esc!.cuerpo = [1 + 0.16 * k, 1 - 0.2 * k, 1 + 0.12 * k];
      p.esc!.ojos = [1 + 0.2 * k, curva(t, [[0, 1], [0.05, 0.15], [0.2, 1], [0.3, 1]]), 1];
      p.esc!.pinzas = [1 + 0.6 * k, 1, 1];
      p.esc!.muelle = [1, 1, 1 - 0.35 * k];
      return p;
    }), 'reaccion', 'Se aplasta, echa la cabeza atrás con los ojos cerrados y las pinzas abiertas.', false),

    animacion('Derrota', 1.0, porFotograma(raiz, 1.0, (t) => {
      // Se le sueltan los muelles: el abdomen sale disparado, las patas
      // traseras saltan de sus caderas y el tórax cae de bruces.
      const caida = curva(t, [[0, 0], [0.12, 0.06], [0.45, -0.3], [0.55, -0.24], [0.65, -0.3], [1, -0.3]]);
      const p = colocar({ cad: [caida, 0], cabeceo: curva(t, [[0, 4], [0.12, -15], [0.45, 10], [0.6, 4], [1, 5]]), balanceo: curva(t, [[0, 0], [0.45, 12], [1, 10]]) });
      for (const [n, s] of [['muslo_i', 1], ['muslo_d', -1]] as const) {
        // Las patas saltan hacia arriba y afuera y caen estiradas hacia atrás.
        p.rot![n] = [curva(t, [[0, p.rot![n][0]], [0.1, p.rot![n][0]], [0.45, -150], [0.8, -92], [1, -90]]), 0, curva(t, [[0.1, 0], [0.6, 60 * s], [1, 70 * s]])];
        p.mov![n] = [curva(t, [[0.1, 0], [0.5, 0.25 * s], [1, 0.3 * s]]), curva(t, [[0.1, 0], [0.35, 0.3], [0.75, -0.13], [0.85, -0.09], [1, -0.12]]), curva(t, [[0.1, 0], [1, -0.1]])];
      }
      p.rot!.tibia_i = [curva(t, [[0, p.rot!.tibia_i[0]], [0.5, 100], [0.8, 175], [1, 180]]), 0, 0];
      p.rot!.tibia_d = [curva(t, [[0, p.rot!.tibia_d[0]], [0.5, 100], [0.8, 175], [1, 180]]), 0, 0];
      p.rot!.cabeza = [curva(t, [[0, 0], [0.15, -25], [0.5, 12], [1, 6]]), 0, curva(t, [[0, 0], [0.5, -20], [1, -25]])];
      p.rot!.muelle = [curva(t, [[0, 0], [0.4, 60], [1, 80]]), curva(t, [[0, 0], [1, 400]]), 0];
      p.mov!.cabeza = [0, 0, 0];
      p.mov!.pupilas = [0, 0, 0];
      p.mov!.muelle = [curva(t, [[0.05, 0], [1, -0.1]]), curva(t, [[0.05, 0], [0.35, 0.45], [0.75, 0.05], [0.85, 0.12], [1, 0.08]]), curva(t, [[0.05, 0], [1, -0.65]])];
      p.esc = {
        cuerpo: [1, 1, 1],
        muelle: [1, 1, curva(t, [[0, 1], [0.08, 0.5], [0.2, 2.1], [0.4, 1.4], [1, 1.5]])],
        ojos: [curva(t, [[0, 1], [0.15, 1.3], [0.45, 1.2]]), curva(t, [[0, 1], [0.15, 1.3], [0.45, 0.1]]), 1],
        pupilas: [1, 1, 1],
        pinzas: [curva(t, [[0, 1], [0.15, 1.8], [0.5, 1.3]]), 1, 1],
      };
      return p;
    }), 'reaccion', 'Se le sueltan los muelles: el abdomen sale disparado, las patas saltan y cae de bruces.', false),
  ];

  return { id: 'saltador', nombre: 'Saltador', rol: 'Unidad de HELIOS · horda', raiz, animaciones };
}
