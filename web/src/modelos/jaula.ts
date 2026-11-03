import * as THREE from 'three';
import { PALETA, animacion, barril, brillo, caja, ciclo, conDetalle, esc, nodo, pieza, poses, punta, rot, toon, toro, type Modelo } from './kit.ts';
import { halo } from './brillo.ts';

// Jaula de HELIOS: un cilindro de barrotes de chapa negra sobre una base con
// vetas púrpura, coronado por el ojo rojo de HELIOS y envuelto en un campo de
// fuerza que tiembla. Dentro espera un superviviente (es otro modelo: el
// juego lo pone en el centro). Al abrirla, el ojo se apaga, el campo cae y la
// puerta de delante se abre como una hoja. 1,8 m de ancho; mira hacia +z.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const RADIO = 0.95, ALTO = 2.9, BARROTES = 12;

export function crearJaula(): Modelo {
  return conDetalle(0.55, montar);
}

function montar(): Modelo {
  const raiz = new THREE.Group();
  raiz.name = 'jaula';
  const cuerpo = nodo('cuerpo', raiz);
  const chapa = toon(PALETA.chapaHelios), oscuro = toon(PALETA.oscuroHelios);

  // Base con vetas que laten y la tapa con el ojo.
  pieza(cuerpo, barril(RADIO + 0.2, RADIO + 0.28, 0.24, 0.06), chapa, 0, 0.12, 0);
  pieza(cuerpo, toro(RADIO + 0.12, 0.03), brillo(PALETA.purpuraBrillo), 0, 0.25, 0, { contorno: false });
  pieza(cuerpo, barril(RADIO + 0.12, RADIO + 0.12, 0.2, 0.06), chapa, 0, ALTO, 0);
  pieza(cuerpo, barril(0.4, RADIO * 0.9, 0.3, 0.08), oscuro, 0, ALTO + 0.24, 0);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + TAU / 8;
    const p = pieza(cuerpo, punta(0.08, 0.4), toon(PALETA.purpura), Math.sin(a) * (RADIO + 0.05), ALTO + 0.22, Math.cos(a) * (RADIO + 0.05));
    p.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
  }
  const ojo = nodo('ojo', cuerpo, 0, ALTO + 0.42, 0.18);
  pieza(ojo, new THREE.SphereGeometry(0.2, 14, 10), brillo(PALETA.helios), 0, 0, 0, { contorno: false });
  pieza(ojo, new THREE.SphereGeometry(0.08, 10, 6), brillo('#ffd2c8'), 0, 0.02, 0.16, { contorno: false });
  halo(ojo, PALETA.helios, 1.2, 0, 0, 0, 0.6);

  // Barrotes: todos menos los tres de delante, que van en la puerta.
  const barrote = (padre: THREE.Object3D, a: number, dx = 0, dz = 0) => {
    pieza(padre, barril(0.055, 0.055, ALTO - 0.2, 0.02), chapa, Math.sin(a) * RADIO + dx, ALTO / 2 + 0.05, Math.cos(a) * RADIO + dz);
  };
  const puerta = nodo('puerta', cuerpo, Math.sin(-0.55) * RADIO, 0, Math.cos(-0.55) * RADIO);
  for (let k = 0; k < BARROTES; k++) {
    const a = (k / BARROTES) * TAU;
    const delante = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6;
    if (delante) barrote(puerta, a, -puerta.position.x, -puerta.position.z);
    else barrote(cuerpo, a);
  }
  // Travesaños de la puerta con su cerrojo.
  for (const y of [0.9, 2.0]) pieza(puerta, caja(1.1, 0.08, 0.08, 0.03), oscuro, 0.52, y, 0.2);
  pieza(puerta, caja(0.18, 0.22, 0.12, 0.04), toon(PALETA.metalOscuro), 0.95, 1.45, 0.24);
  pieza(puerta, caja(0.06, 0.06, 0.02, 0.01), brillo(PALETA.helios), 0.95, 1.48, 0.31, { contorno: false });

  // Campo de fuerza: un cilindro púrpura translúcido que tiembla.
  const campo = nodo('campo', cuerpo, 0, ALTO / 2 + 0.1, 0);
  pieza(campo, new THREE.CylinderGeometry(RADIO + 0.04, RADIO + 0.04, ALTO - 0.3, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETA.purpuraBrillo, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    0, 0, 0, { contorno: false, sombra: false });

  const animaciones = [
    animacion('Reposo', 2.0, [
      esc('campo', ciclo(2, (f) => { const k = 1 + sen(f, 6) * 0.015; return [k, 1, k]; })),
      esc('ojo', ciclo(2, (f) => { const k = 1 + 0.12 * sen(f, 2); return [k, k, k]; })),
      rot('ojo', ciclo(2, (f) => [sen(f) * 8, sen(f, 1, 0.25) * 30, 0])),
    ], 'movimiento', 'El campo de fuerza tiembla y el ojo de HELIOS late y vigila a los lados.'),
    animacion('Abrir', 1.1, [
      esc('ojo', poses([[0, 1, 1, 1], [0.15, 1.4, 1.4, 1.4], [0.35, 0.001, 0.001, 0.001], [1.1, 0.001, 0.001, 0.001]])),
      esc('campo', poses([[0, 1, 1, 1], [0.3, 1.08, 1, 1.08], [0.5, 1.2, 0.001, 1.2], [1.1, 1.2, 0.001, 1.2]])),
      rot('puerta', poses([[0, 0, 0, 0], [0.45, 0, 0, 0], [0.7, 0, -118, 0], [0.85, 0, -100, 0], [1.1, 0, -108, 0]])),
      rot('cuerpo', poses([[0, 0, 0, 0], [0.4, 0, 0, 2], [0.5, 0, 0, -2], [0.6, 0, 0, 0], [1.1, 0, 0, 0]])),
    ], 'reaccion', 'El ojo se apaga, el campo de fuerza cae y la puerta se abre de golpe.', false),
    animacion('Abierta', 2.0, [
      esc('ojo', ciclo(2, () => [0.001, 0.001, 0.001])),
      esc('campo', ciclo(2, () => [1, 0.001, 1])),
      rot('puerta', ciclo(2, (f) => [0, -108 + sen(f) * 2, 0])),
    ], 'movimiento', 'Abierta y apagada; la puerta se mece un poco.'),
  ];
  return { id: 'jaula', nombre: 'Jaula de HELIOS', rol: 'Mapa · se abre con F', raiz, animaciones };
}
