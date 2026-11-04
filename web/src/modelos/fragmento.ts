import * as THREE from 'three';
import { PALETA, animacion, barril, caja, ciclo, conDetalle, esc, mov, nodo, pieza, poses, rot, toon, toro, type Modelo } from './kit.ts';
import { DEF_RANURA, type Ranura } from '../nave/piezas.ts';

// Lo que queda de una nave de la flota de Ares caída en el sector: un trozo
// medio enterrado con su baliza de rescate. El haz de luz se ve desde muy lejos,
// para que apetezca ir a mirar. Cada ranura de la nave tiene su trozo: una
// tobera, un anillo de tanque, una aleta, una cuaderna, unas losetas o un equipo.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1) => Math.sin(fase * TAU * veces);

export function crearFragmento(ranura: Ranura): Modelo {
  return conDetalle(0.6, () => montar(ranura));
}

function trozo(n: THREE.Group, r: Ranura) {
  const acero = toon('#c6ced8'), quemado = toon('#4b4750'), naranja = toon(PALETA.naranja);
  if (r === 'motores') {
    const c = pieza(n, barril(0.5, 1.15, 1.7, 0.06), quemado, 0, 0.75, 0);
    c.rotation.z = 0.5;
    pieza(n, toro(0.55, 0.1), naranja, -0.38, 1.45, 0, { contorno: false }).rotation.z = 0.5;
  } else if (r === 'propulsor') {
    const a = pieza(n, toro(1.15, 0.26), acero, 0, 0.75, 0);
    a.rotation.x = 1.2;
    pieza(n, toro(0.92, 0.1), naranja, 0, 0.75, 0, { contorno: false }).rotation.x = 1.2;
  } else if (r === 'aletas') {
    const m = pieza(n, caja(1.9, 2.1, 0.2, 0.04), acero, 0, 0.9, 0);
    m.rotation.z = 0.28;
    for (let k = -1; k <= 1; k++) pieza(m, caja(1.9, 0.1, 0.26, 0.02), quemado, 0, k * 0.55, 0, { contorno: false });
    for (let k = -1; k <= 1; k++) pieza(m, caja(0.1, 2.1, 0.26, 0.02), quemado, k * 0.55, 0, 0, { contorno: false });
  } else if (r === 'casco') {
    const g = new THREE.CylinderGeometry(1.2, 1.2, 1.7, 18, 1, true, 0, 3.6);
    const m = pieza(n, g, acero, 0, 0.7, 0);
    (m.material as THREE.Material).side = THREE.DoubleSide;
    pieza(n, toro(1.21, 0.07), naranja, 0, 1.45, 0, { contorno: false });
  } else if (r === 'escudo') {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      pieza(n, new THREE.CylinderGeometry(0.42, 0.42, 0.12, 6), toon('#1b1a22'), Math.cos(a) * 0.72, 0.18 + (k % 3) * 0.12, Math.sin(a) * 0.72).rotation.z = 0.2 + k * 0.1;
    }
    pieza(n, new THREE.CylinderGeometry(0.46, 0.46, 0.14, 6), toon('#1b1a22'), 0, 0.5, 0).rotation.x = 0.3;
  } else {
    pieza(n, caja(1.3, 0.9, 1, 0.1), toon('#3b3f4e'), 0, 0.55, 0).rotation.y = 0.4;
    pieza(n, caja(0.08, 1.3, 0.08, 0.02), acero, 0.3, 1.5, 0).rotation.z = 0.3;
    pieza(n, new THREE.SphereGeometry(0.5, 12, 6, 0, TAU, 0, 1.1), acero, -0.25, 1.1, 0).rotation.x = -0.6;
  }
}

function montar(r: Ranura): Modelo {
  const def = DEF_RANURA[r];
  const raiz = new THREE.Group();
  raiz.name = `fragmento-${r}`;
  const cuerpo = nodo('cuerpo', raiz);
  const pedazo = nodo('pedazo', cuerpo);
  trozo(pedazo, r);
  // Tierra removida alrededor, del golpe al caer.
  pieza(cuerpo, new THREE.CylinderGeometry(2.3, 2.7, 0.16, 12), toon('#7a5a4c'), 0, 0.02, 0, { contorno: false, sombra: false });
  // El haz de la baliza de rescate.
  const baliza = nodo('baliza', cuerpo);
  const luz = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 60, 8, 1, true), luz);
  haz.position.y = 30;
  baliza.add(haz);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: def.color }));
  aro.position.y = 0.25;
  baliza.add(aro);

  const animaciones = [
    animacion('Reposo', 2.4, [
      esc('baliza', ciclo(2.4, (f) => [1 + sen(f) * 0.1, 1, 1 + sen(f) * 0.1])),
      rot('pedazo', ciclo(2.4, (f) => [0, sen(f) * 2, 0])),
    ], 'movimiento', 'El haz late y el trozo cruje despacio.'),
    animacion('Recoger', 0.7, [
      mov(raiz, 'pedazo', poses([[0, 0, 0, 0], [0.25, 0, 1.5, 0], [0.7, 0, 3.6, 0]])),
      esc('pedazo', poses([[0, 1, 1, 1], [0.3, 1.15, 1.15, 1.15], [0.7, 0.001, 0.001, 0.001]])),
      esc('baliza', poses([[0, 1, 1, 1], [0.3, 2, 1, 2], [0.7, 0.001, 1, 0.001]])),
    ], 'reaccion', 'El trozo sube, se encoge y el haz se apaga.', false),
    animacion('Hecho', 0.5, [
      esc('pedazo', poses([[0, 0.001, 0.001, 0.001], [0.5, 0.001, 0.001, 0.001]])),
      esc('baliza', poses([[0, 0.001, 1, 0.001], [0.5, 0.001, 1, 0.001]])),
    ], 'reaccion', 'Ya recogido: solo queda la tierra removida.', false),
  ];
  return { id: `fragmento-${r}`, nombre: def.fragmento, rol: 'Mapa · pieza para la nave', raiz, animaciones };
}
