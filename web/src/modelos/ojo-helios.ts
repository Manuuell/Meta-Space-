import * as THREE from 'three';
import {
  PALETA, animacion, barra, barril, brillo, caja, capsula, ciclo, conDetalle, curva, esc, esfera, mov, nodo, pieza,
  porFotograma, poses, punta, rot, toon, toro, type Modelo, type Pose,
} from './kit.ts';

// Ojo de HELIOS, el jefe final (minuto 9): el núcleo de HELIOS. Un ojo
// gigante de iris rojo y pupila rasgada, con párpados blindados y cejas de
// chapa en V, dentro de una jaula de cristales púrpura que lo agarran como
// garras, sobre cuatro patas de araña con rodillas que brillan y tres
// antenas de luz roja. Mira hacia +z; mide 6 m con las antenas y abarca
// 6,4 m de pata a pata.
//
// Las patas se resuelven en cada fotograma con los pies clavados en el suelo
// (en coordenadas del modelo), así no resbalan aunque el cuerpo gire, suba o
// se encabrite. Los avisos de cada ataque son marcas en el suelo (nodos
// `aviso_*`, colgados de la raíz). En fase 2 se reproduce `Enfurecido` a la vez
// que cualquier otro clip: solo anima la jaula abierta y el fulgor, que no
// toca ningún otro clip salvo `Fase 2` y `Derrota` (al morir, para
// `Enfurecido`). Tiempos en TIEMPOS_OJO.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const grados = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;

/**
 * Tiempos de cada ataque en segundos (fotograma = segundo × 30): aviso,
 * ventana de daño (golpe → finGolpe) y duración del clip. El rayo barre de
 * −50° a +50° (de su derecha a su izquierda) hasta 10 m por delante; la onda
 * del pisotón llega a 6 m; Invocar marca tres puntos a 6 m (a −60°, 0° y 60°)
 * donde el juego debe hacer aparecer las Balizas en `invocar`.
 */
export const TIEMPOS_OJO = {
  Rayo: { aviso: 0, golpe: 1.3, finGolpe: 2.7, duracion: 3.8 },
  'Pisotón': { aviso: 0, golpe: 0.95, finGolpe: 1.35, duracion: 2.4 },
  Invocar: { aviso: 0, golpe: 1.8, finGolpe: 1.8, duracion: 2.8, invocar: 1.8 },
} as const;

const ALTO = 3.3;
const MUSLO = 3.05, TIBIA = 5.2;
const CADERA = { r: 0.72, y: -1.05 };
const PIE_R = 3.6;
const PATAS = [['del_i', 62], ['del_d', -62], ['tra_i', 125], ['tra_d', -125]] as const;
type NombrePata = (typeof PATAS)[number][0];
const oculto = (o: THREE.Object3D) => o.scale.setScalar(0.001);

/** Pata de araña en su plano (z hacia fuera): giro del muslo y de la tibia con la rodilla arriba. */
function pataArana(y: number, z: number): [number, number] {
  const largo = Math.hypot(y, z) || 1e-3;
  const d = THREE.MathUtils.clamp(largo, TIBIA - MUSLO + 0.01, MUSLO + TIBIA - 0.01);
  const py = (y / largo) * d, pz = (z / largo) * d;
  const a1 = Math.atan2(pz, py) - Math.acos((MUSLO * MUSLO + d * d - TIBIA * TIBIA) / (2 * MUSLO * d));
  const ry = MUSLO * Math.cos(a1), rz = MUSLO * Math.sin(a1);
  const a2 = Math.atan2(-(pz - rz), -(py - ry));
  return [grados(a1), grados(a2 - a1)];
}

/** Dónde apoya cada pie en reposo (coordenadas del modelo). */
const pieReposo = (grados_: number, r = PIE_R) => new THREE.Vector3(Math.sin(rad(grados_)) * r, 0.05, Math.cos(rad(grados_)) * r);

export function crearOjoHelios(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'ojo-helios';
  const cuerpo = nodo('cuerpo', raiz, 0, ALTO, 0);
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);

  // Base: el cubo de las caderas, con un aro que brilla.
  pieza(cuerpo, barril(0.78, 0.55, 0.6, 0.16), toon(PALETA.oscuroHelios), 0, -1.08, 0);
  pieza(cuerpo, toro(0.74, 0.055), brillo(PALETA.purpuraBrillo), 0, -0.86, 0, { contorno: false });
  pieza(cuerpo, barril(0.45, 0.6, 0.35, 0.1), toon(PALETA.metalOscuro), 0, -0.7, 0);

  // El ojo: esclera, iris rojo con pupila rasgada y su brillo. Gira entero para mirar.
  const ojo = nodo('ojo', cuerpo);
  pieza(ojo, esfera(0.95), toon(PALETA.blanco));
  const iris = nodo('iris', ojo, 0, 0, 0.74);
  pieza(iris, esfera(0.56, 1, 1, 0.45), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  pieza(iris, esfera(0.26, 0.42, 1.15, 0.4), brillo(PALETA.negro), 0, 0, 0.16, { contorno: false, sombra: false });
  fino(() => pieza(iris, esfera(0.09), brillo(PALETA.blanco), 0.22, 0.24, 0.24, { contorno: false, sombra: false }));
  // Iris apagado (para la derrota).
  const apagado = nodo('apagado', ojo, 0, 0, 0.74);
  pieza(apagado, esfera(0.57, 1, 1, 0.46), toon(PALETA.metalOscuro), 0, 0, 0, { contorno: false });
  oculto(apagado);
  // Carga, mira láser y rayo: salen de la pupila y siguen al ojo.
  const carga = nodo('carga', ojo, 0, 0, 1.12);
  pieza(carga, esfera(0.32), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  fino(() => pieza(carga, esfera(0.16), brillo(PALETA.blanco), 0, 0, 0.2, { contorno: false, sombra: false }));
  oculto(carga);
  const mira = nodo('mira', ojo, 0, 0, 1.0);
  fino(() => pieza(mira, capsula(0.035, 10).rotateX(Math.PI / 2), brillo(PALETA.helios), 0, 0, 5, { contorno: false, sombra: false }));
  oculto(mira);
  const rayo = nodo('rayo', ojo, 0, 0, 1.0);
  pieza(rayo, capsula(0.34, 10).rotateX(Math.PI / 2), brillo(PALETA.helios), 0, 0, 5, { contorno: false, sombra: false });
  pieza(rayo, capsula(0.15, 10.2).rotateX(Math.PI / 2), brillo(PALETA.blanco), 0, 0, 5, { contorno: false, sombra: false });
  oculto(rayo);

  // Párpados blindados: giran sobre el centro del ojo. El de arriba lleva
  // las cejas en V.
  const parpadoSup = nodo('parpado_sup', cuerpo);
  parpadoSup.rotation.x = rad(6);
  pieza(parpadoSup, esfera(1.05, 1, 0.55, 1.02), toon(PALETA.chapaHelios), 0, 0.8, 0);
  for (const s of [1, -1]) {
    const ceja = pieza(parpadoSup, caja(0.78, 0.2, 0.36, 0.08), toon(PALETA.oscuroHelios), 0.4 * s, 0.68, 0.8);
    ceja.rotation.set(-0.35, 0.25 * s, 0.42 * s);
  }
  const parpadoInf = nodo('parpado_inf', cuerpo);
  parpadoInf.rotation.x = rad(-4);
  pieza(parpadoInf, esfera(1.04, 1, 0.5, 1.01), toon(PALETA.chapaHelios), 0, -0.9, 0);

  // Jaula: cristales que agarran el ojo como garras, sobre un aro.
  const jaula = nodo('jaula', cuerpo);
  pieza(jaula, toro(1.12, 0.08), toon(PALETA.metalOscuro), 0, -0.55, 0);
  const arriba = new THREE.Vector3(0, 1, 0);
  for (const [k, a] of [55, 90, 128, 165, -55, -90, -128, -165].entries()) {
    const ar = rad(a);
    const alto = Math.abs(a) < 60 ? 1.8 : 2.1;
    const dir = new THREE.Vector3(-Math.sin(ar) * 0.42, 1, -Math.cos(ar) * 0.42).normalize();
    const base = new THREE.Vector3(Math.sin(ar) * 1.12, -0.55, Math.cos(ar) * 1.12);
    const c = pieza(jaula, punta(0.2, alto, 6), k % 2 ? brillo(PALETA.purpuraBrillo) : toon(PALETA.purpura), ...base.addScaledVector(dir, alto * 0.45).toArray(), { contorno: k % 2 === 0 });
    c.quaternion.setFromUnitVectors(arriba, dir);
  }
  // Fase 2: corona roja detrás del ojo.
  const fulgor = nodo('fulgor', cuerpo, 0, 0, -0.25);
  pieza(fulgor, toro(1.5, 0.07).rotateX(Math.PI / 2), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  fino(() => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const p = pieza(fulgor, punta(0.12, 0.6), brillo(PALETA.helios), Math.sin(a) * 1.75, Math.cos(a) * 1.75, 0, { contorno: false, sombra: false });
      p.rotation.z = -a;
    }
  });
  oculto(fulgor);

  // Antenas con luces rojas y los anillos que emiten al invocar.
  const antenas = nodo('antenas', cuerpo, 0, 0.95, -0.25);
  const luces = nodo('luces', antenas);
  for (const [x, z, alto] of [[0, -0.3, 1.55], [0.75, 0.1, 1.15], [-0.75, 0.1, 1.15]] as const) {
    barra(antenas, [x * 0.5, 0, z * 0.3], [x, alto, z], 0.055, toon(PALETA.metalOscuro));
    fino(() => pieza(luces, esfera(0.12), brillo(PALETA.helios), x, alto + 0.08, z, { contorno: false }));
  }
  const ondas = nodo('ondas', antenas, 0, 1.65, -0.3);
  fino(() => pieza(ondas, toro(0.6, 0.045), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false }));
  oculto(ondas);

  // Cuatro patas de araña: muslo hacia arriba y afuera, rodilla que brilla,
  // tibia larga hasta una garra púrpura.
  for (const [n, a] of PATAS) {
    const pata = nodo(`pata_${n}`, cuerpo, Math.sin(rad(a)) * CADERA.r, CADERA.y, Math.cos(rad(a)) * CADERA.r);
    pata.rotation.y = rad(a);
    fino(() => pieza(pata, esfera(0.24), toon(PALETA.metalOscuro)));
    const muslo = nodo(`muslo_${n}`, pata);
    barra(muslo, [0, 0, 0], [0, MUSLO, 0], 0.17, toon(PALETA.metalHelios));
    for (const y of [1.0, 1.8, 2.5]) {
      const p = pieza(muslo, punta(0.09, 0.38), toon(PALETA.purpura), 0, y, 0.15);
      p.rotation.x = 1.1;
    }
    const tibia = nodo(`tibia_${n}`, muslo, 0, MUSLO, 0);
    pieza(tibia, esfera(0.27), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false });
    barra(tibia, [0, -0.1, 0], [0, -TIBIA + 0.5, 0], 0.13, toon(PALETA.metalOscuro));
    pieza(tibia, punta(0.18, 0.7).rotateX(Math.PI), toon(PALETA.purpura), 0, -TIBIA + 0.35, 0);
  }

  // Avisos en el suelo, onda del pisotón, círculos de invocación y la luz del sol.
  const avisoRayo = nodo('aviso_rayo', raiz, 0, 0.03, 0);
  pieza(avisoRayo, new THREE.RingGeometry(2.6, 10, 36, 1, rad(-140), rad(100)).rotateX(-Math.PI / 2), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  oculto(avisoRayo);
  const avisoPisoton = nodo('aviso_pisoton', raiz, 0, 0.03, 0);
  pieza(avisoPisoton, new THREE.RingGeometry(5.5, 6, 48).rotateX(-Math.PI / 2), brillo(PALETA.helios), 0, 0, 0, { contorno: false, sombra: false });
  oculto(avisoPisoton);
  const onda = nodo('onda', raiz, 0, 0.12, 0);
  pieza(onda, toro(1, 0.09), brillo(PALETA.purpuraBrillo), 0, 0, 0, { contorno: false, sombra: false });
  oculto(onda);
  const avisoInvocar = nodo('aviso_invocar', raiz, 0, 0.03, 0);
  for (const a of [-60, 0, 60]) {
    const x = Math.sin(rad(a)) * 6, z = Math.cos(rad(a)) * 6;
    pieza(avisoInvocar, new THREE.RingGeometry(0.75, 1.05, 32).rotateX(-Math.PI / 2), brillo(PALETA.purpuraBrillo), x, 0, z, { contorno: false, sombra: false });
    pieza(avisoInvocar, new THREE.RingGeometry(0.2, 0.35, 20).rotateX(-Math.PI / 2), brillo(PALETA.helios), x, 0, z, { contorno: false, sombra: false });
  }
  oculto(avisoInvocar);
  // Rayos de sol finos que bajan en abanico desde un punto alto, y la mancha
  // de luz que dejan en el suelo.
  const sol = nodo('sol', raiz, 0, 13, 0);
  for (const [x1, z1, r] of [[-1.4, 1.2, 0.14], [0.2, 1.8, 0.1], [1.6, 0.9, 0.12], [-0.4, -0.4, 0.16], [1.2, -1.5, 0.1], [-1.9, -1.2, 0.09]] as const) {
    barra(sol, [-2.5, 0, -2], [x1, -13 + r, z1], r, brillo(PALETA.arena), { contorno: false, sombra: false });
  }
  oculto(sol);
  const luzSuelo = nodo('luz_suelo', raiz, 0, 0.03, 0.2);
  pieza(luzSuelo, new THREE.CircleGeometry(3.2, 40).rotateX(-Math.PI / 2), brillo(PALETA.arena), 0, 0, 0, { contorno: false, sombra: false });
  oculto(luzSuelo);

  // ------------------------------------------------------------ poses

  const mCuerpo = new THREE.Matrix4(), mCadera = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  /**
   * Cuerpo en `mov`/`giro` (grados) y pies clavados en `pies` (mundo): giros
   * de todas las patas. El plano de cada pata se orienta solo hacia su pie.
   */
  const conPatas = (movC: readonly [number, number, number], giro: readonly [number, number, number], pies: Record<NombrePata, THREE.Vector3>): Pose => {
    mCuerpo.compose(new THREE.Vector3(movC[0], ALTO + movC[1], movC[2]), q.setFromEuler(e.set(rad(giro[0]), rad(giro[1]), rad(giro[2]))), new THREE.Vector3(1, 1, 1));
    const p: Pose = { mov: { cuerpo: movC }, rot: { cuerpo: giro } };
    for (const [n, a] of PATAS) {
      mCadera.copy(mCuerpo).multiply(new THREE.Matrix4().makeTranslation(Math.sin(rad(a)) * CADERA.r, CADERA.y, Math.cos(rad(a)) * CADERA.r)).invert();
      const pie = pies[n].clone().applyMatrix4(mCadera);
      const [m, t] = pataArana(pie.y, Math.hypot(pie.x, pie.z));
      p.rot![`pata_${n}`] = [0, grados(Math.atan2(pie.x, pie.z)), 0];
      p.rot![`muslo_${n}`] = [m, 0, 0];
      p.rot![`tibia_${n}`] = [t, 0, 0];
    }
    return p;
  };
  const piesReposo = (r = PIE_R) => Object.fromEntries(PATAS.map(([n, a]) => [n, pieReposo(a, r)])) as Record<NombrePata, THREE.Vector3>;

  // Pose de reposo de las patas.
  const reposo = conPatas([0, 0, 0], [0, 0, 0], piesReposo());
  for (const [n, [x, y, z]] of Object.entries(reposo.rot!)) {
    if (n !== 'cuerpo') raiz.getObjectByName(n)!.rotation.set(rad(x), rad(y), rad(z));
  }

  /** Mirada y párpados: lo que casi todos los clips mueven además del cuerpo. */
  const cara = (p: Pose, ojoXY: [number, number], sup: number, inf: number, irisK = 1) => {
    p.rot!.ojo = [ojoXY[0], ojoXY[1], 0];
    p.rot!.parpado_sup = [sup, 0, 0];
    p.rot!.parpado_inf = [inf, 0, 0];
    p.esc = { ...(p.esc ?? {}), iris: [irisK, irisK, 1] };
    return p;
  };

  // Caminar: pares en diagonal (del_i con tra_d, del_d con tra_i); cada pie
  // apoya media vuelta y vuela la otra media.
  const PASO = 0.5;
  const caminar = (t: number): Pose => {
    const f = t / 1.6;
    const pies = piesReposo();
    for (const [n] of PATAS) {
      const fase = (f + (n === 'del_i' || n === 'tra_d' ? 0 : 0.5)) % 1;
      const apoyo = fase < 0.5;
      const u = apoyo ? fase / 0.5 : (fase - 0.5) / 0.5;
      pies[n].z += apoyo ? THREE.MathUtils.lerp(PASO, -PASO, u) : THREE.MathUtils.lerp(-PASO, PASO, u);
      if (!apoyo) pies[n].y += Math.sin(u * Math.PI) * 0.55;
    }
    const p = conPatas([sen(f, 2) * 0.06, Math.abs(sen(f, 2)) * 0.12 - 0.06, 0], [3, sen(f) * 4, sen(f, 2) * 3], pies);
    return cara(p, [6 + sen(f, 2) * 2, -sen(f) * 6], 6, -4);
  };

  // ------------------------------------------------------------ animaciones

  const titilar = (d: number, veces: number, base = 1, fuerza = 0.25) =>
    esc('luces', ciclo(d, (f) => { const k = base + fuerza * (Math.cos(f * TAU * veces) > 0 ? 1 : -1); return [k, k, k]; }));

  const animaciones = [
    animacion('Reposo', 2.4, [
      ...porFotograma(raiz, 2.4, (t) => {
        const f = t / 2.4;
        const p = conPatas([0, sen(f, 2) * 0.06, 0], [sen(f, 2) * 1.5, sen(f) * 3, 0], piesReposo());
        const parpado = curva(t, [[1.5, 6], [1.56, 70], [1.64, 6]]);
        return cara(p, [sen(f, 2, 0.1) * 6, sen(f) * 22], parpado, curva(t, [[1.5, -4], [1.56, -45], [1.64, -4]]));
      }),
      titilar(2.4, 3),
    ], 'movimiento', 'Respira sobre sus patas, el ojo vigila a los lados y parpadea; las antenas titilan.'),

    animacion('Despertar', 3.6, [
      // Entrada: dormido y encogido, abre una rendija, se levanta sobre las
      // patas temblando y abre el ojo de golpe.
      ...porFotograma(raiz, 3.6, (t) => {
        const alto = curva(t, [[0, -1.9], [1.2, -1.86], [2.3, 0.25], [2.55, -0.08], [2.8, 0.05], [3.6, 0]]);
        const tiembla = t > 1.2 && t < 2.3 ? Math.sin(t * 70) * 2 : 0;
        const r = curva(t, [[0, 4.2], [1.2, 4.2], [2.3, PIE_R]]);
        const p = conPatas([0, alto, 0], [curva(t, [[0, 10], [2.3, -6], [2.8, 2], [3.6, 0]]), 0, tiembla], piesReposo(r));
        const sup = curva(t, [[0, 90], [0.8, 90], [0.95, 62], [1.2, 66], [2.3, 58], [2.45, -18], [2.9, 6], [3.6, 6]]);
        const inf = curva(t, [[0, -88], [0.8, -88], [0.95, -60], [2.3, -55], [2.45, 10], [2.9, -12], [3.6, -4]]);
        return cara(p, [curva(t, [[0, 10], [2.3, 0], [2.6, -10], [3.6, 0]]), curva(t, [[0.95, 0], [1.4, -25], [1.9, 25], [2.3, 0]])], sup, inf,
          curva(t, [[0, 0.7], [2.3, 0.75], [2.45, 1.25], [2.7, 0.85], [3.6, 1]]));
      }),
      esc('antenas', poses([[0, 1, 0.15, 1], [2.2, 1, 0.15, 1], [2.55, 1.1, 1.2, 1.1], [2.8, 1, 1, 1], [3.6, 1, 1, 1]])),
      esc('luces', poses([[0, 0.001, 0.001, 0.001], [2.3, 0.001, 0.001, 0.001], [2.5, 1.6, 1.6, 1.6], [2.9, 1, 1, 1], [3.6, 1, 1, 1]])),
    ], 'reaccion', 'Entrada: encogido y con el ojo cerrado, abre una rendija, se levanta temblando sobre las patas y abre el ojo de golpe.', false),

    animacion('Caminar', 1.6, [...porFotograma(raiz, 1.6, caminar), titilar(1.6, 2)], 'movimiento',
      'Paso de araña: las patas en diagonal se alternan y el cuerpo se mece.'),

    animacion('Rayo', 3.8, [
      // Aviso (0–1,3 s): se agacha, gira a su derecha, el ojo se abre del
      // todo, la carga crece en la pupila, la mira láser apunta y el arco
      // rojo marca el suelo. Golpe (1,3–2,7 s): el rayo barre a su izquierda.
      ...porFotograma(raiz, 3.8, (t) => {
        const giro = curva(t, [[0, 0], [1.0, -50], [1.3, -50], [2.7, 50], [3.0, 50], [3.8, 0]]);
        const baja = curva(t, [[0, 0], [1.0, -0.35], [2.7, -0.35], [3.8, 0]]);
        const p = conPatas([0, baja, 0], [curva(t, [[0, 0], [1.0, 6], [1.3, 4], [1.4, -3], [1.6, 4], [2.7, 4], [3.8, 0]]), giro, 0], piesReposo());
        return cara(p, [curva(t, [[0, 0], [1.0, 12], [2.7, 12], [3.8, 0]]), 0],
          curva(t, [[0, 6], [0.8, -22], [2.8, -22], [3.8, 6]]), curva(t, [[0, -4], [0.8, 18], [2.8, 18], [3.8, -4]]),
          curva(t, [[0, 1], [1.0, 0.65], [1.3, 0.6], [1.35, 1.2], [2.7, 1.1], [3.8, 1]]));
      }),
      esc('carga', poses([[0, 0.001, 0.001, 0.001], [0.2, 0.2, 0.2, 0.2], [1.0, 1.1, 1.1, 1.1], [1.1, 0.9, 0.9, 0.9], [1.2, 1.3, 1.3, 1.3], [1.3, 1.1, 1.1, 1.1], [2.7, 0.9, 0.9, 0.9], [2.85, 0.001, 0.001, 0.001], [3.8, 0.001, 0.001, 0.001]])),
      esc('mira', poses([[0, 0.001, 0.001, 0.001], [0.3, 1, 1, 0.05], [0.9, 1, 1, 1], [1.28, 1, 1, 1], [1.3, 0.001, 0.001, 0.001], [3.8, 0.001, 0.001, 0.001]])),
      esc('rayo', poses([[0, 0.001, 0.001, 0.001], [1.28, 0.001, 0.001, 0.001], [1.36, 1.3, 1.3, 1], [1.5, 1, 1, 1], [2.0, 1.15, 1.15, 1], [2.5, 1, 1, 1], [2.7, 1, 1, 1], [2.8, 0.001, 0.001, 0.001], [3.8, 0.001, 0.001, 0.001]])),
      esc('aviso_rayo', poses([[0, 0.001, 0.001, 0.001], [0.2, 0.5, 1, 0.5], [0.8, 1, 1, 1], [0.95, 1.03, 1, 1.03], [1.1, 1, 1, 1], [1.3, 1, 1, 1], [1.32, 0.001, 0.001, 0.001], [3.8, 0.001, 0.001, 0.001]])),
      titilar(3.8, 10, 1.2, 0.3),
    ], 'ataque', 'Aviso de 0 a 1,3 s: se agacha, gira a su derecha, la carga crece en la pupila, una mira láser apunta y un arco rojo marca el suelo. El rayo barre de 1,3 a 2,7 s.', false),

    animacion('Pisotón', 2.4, [
      // Aviso (0–0,85 s): se encabrita sobre las patas de atrás con las de
      // delante en alto y aparece el anillo rojo. Golpe (0,95 s): pisa y
      // sale la onda, que barre el suelo hasta 1,35 s.
      ...porFotograma(raiz, 2.4, (t) => {
        const pies = piesReposo();
        const alza = curva(t, [[0, 0], [0.75, 1.9], [0.85, 2.0], [0.95, 0], [2.4, 0]]);
        for (const n of ['del_i', 'del_d'] as const) {
          pies[n].y += alza;
          pies[n].z += alza * 0.25;
        }
        const p = conPatas([0, curva(t, [[0, 0], [0.8, 0.55], [0.95, -0.35], [1.1, -0.2], [1.5, 0.05], [2.4, 0]]), curva(t, [[0, 0], [0.8, -0.35], [0.95, 0.1], [2.4, 0]])],
          [curva(t, [[0, 0], [0.8, -14], [0.95, 8], [1.2, -2], [2.4, 0]]), 0, 0], pies);
        return cara(p, [curva(t, [[0, 0], [0.8, -8], [0.95, 14], [1.6, 4], [2.4, 0]]), 0],
          curva(t, [[0, 6], [0.8, -15], [0.95, 32], [1.6, 20], [2.4, 6]]), curva(t, [[0, -4], [0.8, 14], [0.95, -20], [2.4, -4]]),
          curva(t, [[0, 1], [0.8, 0.7], [0.95, 1.2], [2.4, 1]]));
      }),
      esc('aviso_pisoton', poses([[0, 0.001, 0.001, 0.001], [0.15, 0.6, 1, 0.6], [0.6, 1, 1, 1], [0.75, 0.97, 1, 0.97], [0.9, 1, 1, 1], [0.96, 0.001, 0.001, 0.001], [2.4, 0.001, 0.001, 0.001]])),
      esc('onda', poses([[0, 0.001, 0.001, 0.001], [0.94, 0.001, 0.001, 0.001], [0.96, 1.5, 1.5, 1.5], [1.35, 6, 2.5, 6], [1.55, 6.6, 0.3, 6.6], [1.6, 0.001, 0.001, 0.001], [2.4, 0.001, 0.001, 0.001]])),
      esc('antenas', poses([[0, 1, 1, 1], [0.95, 1, 1, 1], [1.0, 1.1, 0.8, 1.1], [1.2, 0.97, 1.08, 0.97], [1.4, 1, 1, 1], [2.4, 1, 1, 1]])),
    ], 'ataque', 'Aviso de 0 a 0,85 s: se encabrita con las patas delanteras en alto y un anillo rojo marca la zona. Pisa en 0,95 s y la onda barre el suelo hasta 1,35 s.', false),

    animacion('Invocar', 2.8, [
      // Aviso (0–1,8 s): mira al cielo, las antenas emiten anillos y tres
      // círculos marcan el suelo. En 1,8 s destellan: ahí salen las Balizas.
      ...porFotograma(raiz, 2.8, (t) => {
        const p = conPatas([0, curva(t, [[0, 0], [0.6, 0.3], [1.8, 0.35], [2.0, -0.1], [2.8, 0]]), 0],
          [curva(t, [[0, 0], [0.6, -10], [1.8, -12], [2.0, 4], [2.8, 0]]), 0, 0], piesReposo());
        return cara(p, [curva(t, [[0, 0], [0.6, -35], [1.8, -38], [2.0, 5], [2.8, 0]]), 0],
          curva(t, [[0, 6], [0.6, -20], [1.8, -20], [2.0, 10], [2.8, 6]]), curva(t, [[0, -4], [0.6, 10], [1.8, 10], [2.8, -4]]),
          curva(t, [[0, 1], [0.6, 0.8], [1.8, 0.8], [1.85, 1.3], [2.8, 1]]));
      }),
      esc('ondas', ciclo(2.8, (f) => { const t = f * 2.8; if (t < 0.3 || t > 1.95) return [0.001, 0.001, 0.001]; const k = 0.4 + (((t - 0.3) * 2) % 1) * 3; return [k, k, k]; })),
      esc('aviso_invocar', poses([[0, 0.001, 0.001, 0.001], [0.5, 0.001, 0.001, 0.001], [0.8, 1, 1, 1], [1.2, 1.15, 1, 1.15], [1.6, 1, 1, 1], [1.8, 1.5, 1, 1.5], [2.0, 0.001, 0.001, 0.001], [2.8, 0.001, 0.001, 0.001]])),
      titilar(2.8, 14, 1.4, 0.4),
    ], 'ataque', 'Mira al cielo, las antenas emiten anillos y tres círculos marcan el suelo; en 1,8 s destellan y el juego hace salir las Balizas.', false),

    animacion('Golpe recibido', 0.45, [
      ...porFotograma(raiz, 0.45, (t) => {
        const k = curva(t, [[0, 0], [0.06, 1], [0.45, 0]]);
        const p = conPatas([0, -0.12 * k, -0.15 * k], [-6 * k, 0, curva(t, [[0, 0], [0.06, 4], [0.2, -2], [0.45, 0]])], piesReposo());
        return cara(p, [-8 * k, 0], 6 + 55 * k, -4 - 42 * k, 1 - 0.4 * k);
      }),
      esc('antenas', poses([[0, 1, 1, 1], [0.06, 1.1, 0.85, 1.1], [0.2, 0.97, 1.05, 0.97], [0.45, 1, 1, 1]])),
    ], 'reaccion', 'Retrocede, entorna el ojo y las antenas se sacuden.', false),

    animacion('Fase 2', 3.0, [
      // Se estremece, los párpados se recogen, la jaula se abre y aparece la
      // corona roja: el ojo queda al descubierto y brilla más.
      ...porFotograma(raiz, 3.0, (t) => {
        const tiembla = t < 1.2 ? Math.sin(t * 60) * 3 * (t / 1.2) : 0;
        const p = conPatas([0, curva(t, [[0, 0], [1.2, -0.4], [1.6, 0.35], [2.2, 0.35], [3.0, 0]]), 0],
          [curva(t, [[0, 0], [1.2, 6], [1.6, -10], [2.2, -10], [3.0, 0]]), 0, tiembla], piesReposo());
        return cara(p, [curva(t, [[0, 0], [1.6, -10], [3.0, 0]]), 0],
          curva(t, [[0, 6], [1.2, 50], [1.6, -30], [3.0, -12]]), curva(t, [[0, -4], [1.2, -40], [1.6, 25], [3.0, 12]]),
          curva(t, [[0, 1], [1.2, 0.6], [1.6, 1.35], [3.0, 1.15]]));
      }),
      esc('ojo', poses([[0, 1, 1, 1], [1.4, 1, 1, 1], [1.7, 1.15, 1.15, 1.15], [3.0, 1.1, 1.1, 1.1]])),
      esc('jaula', poses([[0, 1, 1, 1], [1.2, 0.95, 0.95, 0.95], [1.7, 1.42, 1.15, 1.42], [2.1, 1.32, 1.1, 1.32], [3.0, 1.35, 1.12, 1.35]])),
      rot('jaula', poses([[0, 0, 0, 0], [1.2, 0, -10, 0], [1.7, 0, 22.5, 0], [3.0, 0, 22.5, 0]])),
      esc('fulgor', poses([[0, 0.001, 0.001, 0.001], [1.5, 0.001, 0.001, 0.001], [1.75, 1.3, 1.3, 1.3], [2.1, 1, 1, 1], [3.0, 1, 1, 1]])),
      titilar(3.0, 12, 1.4, 0.4),
    ], 'reaccion', 'Fase 2: se estremece, recoge los párpados, la jaula de cristales se abre y una corona roja se enciende detrás del ojo.', false),

    animacion('Enfurecido', 3.6, [
      // Capa de la fase 2: la jaula sigue abierta, la corona gira y late.
      esc('jaula', ciclo(3.6, (f) => [1.35 + 0.03 * sen(f, 6), 1.12, 1.35 + 0.03 * sen(f, 6)])),
      rot('jaula', ciclo(3.6, () => [0, 22.5, 0])),
      esc('fulgor', ciclo(3.6, (f) => { const k = 1 + 0.12 * sen(f, 6); return [k, k, k]; })),
      rot('fulgor', ciclo(3.6, (f) => [0, 0, f * 360])),
      esc('ojo', ciclo(3.6, (f) => { const k = 1.1 + 0.02 * sen(f, 12); return [k, k, k]; })),
    ], 'reaccion', 'Fase 2, en bucle y a la vez que cualquier otro clip: la jaula sigue abierta, la corona gira y late y el ojo se queda hinchado.'),

    animacion('Derrota', 4.0, [
      // El ojo parpadea y se apaga, las patas ceden, la jaula se desmorona y
      // baja la luz del sol.
      ...porFotograma(raiz, 4.0, (t) => {
        const r = curva(t, [[0, PIE_R], [1.0, PIE_R], [2.4, 4.3], [4.0, 4.35]]);
        const tiembla = t < 0.9 ? Math.sin(t * 55) * 3 : 0;
        const p = conPatas([0, curva(t, [[0, 0], [1.0, 0.1], [2.3, -1.96], [2.5, -1.78], [2.7, -1.93], [4.0, -1.9]]), 0],
          [curva(t, [[0, 0], [1.0, -4], [2.3, 10], [2.6, 7], [4.0, 8]]), 0, tiembla + curva(t, [[1.0, 0], [2.3, 5], [4.0, 4]])], piesReposo(r));
        const iris = t < 0.9 ? (Math.sin(t * 40) > 0 ? 1.15 : 0.5) : curva(t, [[0.9, 1], [1.1, 0.001]]);
        return cara(p, [curva(t, [[0, 0], [1.0, -10], [2.3, 22], [4.0, 20]]), curva(t, [[0, 0], [0.5, 20], [1.0, -15], [2.0, 0]])],
          curva(t, [[0, 6], [1.1, 30], [2.5, 48], [4.0, 45]]), curva(t, [[0, -4], [1.1, -15], [2.5, -30], [4.0, -28]]), iris);
      }),
      esc('apagado', poses([[0, 0.001, 0.001, 0.001], [0.9, 0.001, 0.001, 0.001], [1.1, 1, 1, 1], [4.0, 1, 1, 1]])),
      esc('luces', poses([[0, 1, 1, 1], [0.4, 1.5, 1.5, 1.5], [0.6, 0.3, 0.3, 0.3], [0.8, 1.2, 1.2, 1.2], [1.0, 0.001, 0.001, 0.001], [4.0, 0.001, 0.001, 0.001]])),
      rot('antenas', poses([[0, 0, 0, 0], [1.6, 0, 0, 0], [2.6, -55, 0, 12], [2.8, -48, 0, 10], [4.0, -50, 0, 11]])),
      esc('jaula', poses([[0, 1, 1, 1], [1.4, 1, 1, 1], [2.6, 1.55, 0.55, 1.55], [2.8, 1.5, 0.62, 1.5], [4.0, 1.52, 0.58, 1.52]])),
      mov(raiz, 'jaula', poses([[0, 0, 0, 0], [1.4, 0, 0, 0], [2.6, 0, -0.22, 0], [4.0, 0, -0.22, 0]])),
      rot('jaula', poses([[0, 0, 0, 0], [1.4, 0, 0, 0], [2.6, 8, 30, -6], [4.0, 8, 32, -6]])),
      esc('sol', poses([[0, 0.001, 0.001, 0.001], [2.6, 0.001, 0.001, 0.001], [2.62, 1, 0.02, 1], [3.5, 1, 1, 1], [4.0, 1, 1, 1]])),
      esc('luz_suelo', poses([[0, 0.001, 0.001, 0.001], [3.2, 0.001, 0.001, 0.001], [3.6, 1.1, 1, 1.1], [4.0, 1, 1, 1]])),
    ], 'reaccion', 'El ojo parpadea y se apaga, las patas ceden, la jaula de cristales se desmorona y baja la luz del sol.', false),
  ];

  return { id: 'ojo-helios', nombre: 'Ojo de HELIOS', rol: 'Jefe final de HELIOS · minuto 9', raiz, animaciones };
}
