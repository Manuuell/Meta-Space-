import * as THREE from 'three';
import { PALETA, animacion, barril, brillo, caja, ciclo, conDetalle, esc, mov, nodo, pieza, poses, rot, toon, type Modelo } from './kit.ts';
import { crearGente, type Aspecto } from './gente.ts';

// Supervivientes que HELIOS tenía enjaulados. Gente de Meta como la del
// refugio (misma base, mismos clips de voz), con la ropa rota del frío, una
// mochila de viaje y una pistola de bengalas. Al salir de la jaula siguen al
// jugador un rato: `Caminar` para seguirle y `Disparar` para cada bengala.
// Mientras están dentro, `Trabajar` es agarrarse a los barrotes y mirar fuera.

const TAU = Math.PI * 2;
const sen = (fase: number, veces = 1, desfase = 0) => Math.sin((fase + desfase) * TAU * veces);
const cos = (fase: number, veces = 1) => Math.cos(fase * TAU * veces);

const ASPECTOS: Aspecto[] = [
  {
    id: 'superviviente', nombre: 'Teo', rol: 'Superviviente · te cubre con bengalas',
    piel: '#e8b48c', pelo: '#3a2618', abrigo: '#b25a3a', detalle: '#6b3a26', bufanda: '#5ea0c9',
    pantalon: '#3b3f52', botas: '#2b2420', guantes: '#6b3a26', cabeza: 'gorro',
  },
  {
    id: 'superviviente-2', nombre: 'Nuria', rol: 'Superviviente · te cubre con bengalas',
    piel: '#8d5a3b', pelo: '#1d1411', abrigo: '#3f7d8f', detalle: '#2a5563', bufanda: '#f0c24a',
    pantalon: '#4a3b2e', botas: '#2b2420', guantes: '#2a5563', cabeza: 'melena',
  },
  {
    id: 'superviviente-3', nombre: 'Ilan', rol: 'Superviviente · te cubre con bengalas',
    piel: '#f2cfb0', pelo: '#8a5a2a', abrigo: '#7a6a3a', detalle: '#4f442a', bufanda: '#c94a5a',
    pantalon: '#3b3f52', botas: '#2b2420', guantes: '#4f442a', cabeza: 'capucha', gafas: true,
  },
];

export function crearSuperviviente(variante = 0): Modelo {
  const aspecto = ASPECTOS[variante % ASPECTOS.length];
  const fino = <T,>(fn: () => T) => conDetalle(0.55, fn);
  const m = crearGente(aspecto, ({ manoD, pecho }) => {
    // Pistola de bengalas: naranja, cañón gordo y la bengala que asoma.
    const pistola = nodo('pistola', manoD, 0, -0.05, 0.1);
    pieza(pistola, caja(0.1, 0.16, 0.12, 0.03), toon('#ff8a3d'), 0, 0, 0);
    pieza(pistola, barril(0.06, 0.07, 0.26, 0.02).rotateX(Math.PI / 2), toon('#ff8a3d'), 0, 0.07, 0.14);
    fino(() => pieza(pistola, new THREE.SphereGeometry(0.05, 8, 6), brillo(PALETA.plasma), 0, 0.07, 0.28, { contorno: false }));
    const fogonazo = nodo('fogonazo', pistola, 0, 0.07, 0.32);
    fino(() => pieza(fogonazo, new THREE.SphereGeometry(0.16, 10, 6), brillo('#ffe9a8'), 0, 0, 0, { contorno: false, sombra: false }));
    fogonazo.scale.setScalar(0.001);
    // Mochila de viaje con un saco de dormir enrollado.
    pieza(pecho, caja(0.5, 0.56, 0.26, 0.1), toon(aspecto.detalle), 0, 0.42, -0.46);
    pieza(pecho, barril(0.12, 0.12, 0.56, 0.04).rotateZ(Math.PI / 2), toon(aspecto.bufanda), 0, 0.78, -0.48);
    // Remiendos en el abrigo (lo han pasado mal).
    pieza(pecho, caja(0.14, 0.12, 0.02, 0.02), toon(aspecto.detalle), 0.18, 0.2, 0.45, { contorno: false });
  }, ({ raiz }) => ({
    duracion: 2.4,
    descripcion: 'Agarrado a los barrotes: tira de ellos, se asoma a un lado y a otro y llama.',
    pistas: [
      rot('hombro_i', ciclo(2.4, (f) => [-95 + sen(f, 2) * 6, 0, 28])),
      rot('hombro_d', ciclo(2.4, (f) => [-95 - sen(f, 2) * 6, 0, -28])),
      rot('codo_i', ciclo(2.4, (f) => [-30 - Math.max(0, sen(f, 2)) * 20, 0, 0])),
      rot('codo_d', ciclo(2.4, (f) => [-30 - Math.max(0, -sen(f, 2)) * 20, 0, 0])),
      rot('pecho', ciclo(2.4, (f) => [6 + sen(f, 2) * 4, sen(f) * 10, 0])),
      rot('cabeza', ciclo(2.4, (f) => [-4, sen(f) * 30, sen(f) * 6])),
      esc('boca', ciclo(2.4, (f) => [1, 0.12 + Math.max(0, sen(f, 2, 0.1)) * 0.7, 1])),
      mov(raiz, 'cadera', ciclo(2.4, (f) => [0, Math.abs(sen(f, 2)) * 0.03, 0])),
    ],
  }));

  // Clips propios: andar detrás del jugador y disparar una bengala.
  m.animaciones.push(
    animacion('Caminar', 0.9, [
      rot('pierna_i', ciclo(0.9, (f) => [sen(f) * 30, 0, 0])),
      rot('pierna_d', ciclo(0.9, (f) => [-sen(f) * 30, 0, 0])),
      rot('hombro_i', ciclo(0.9, (f) => [-sen(f) * 26, 0, 10])),
      rot('hombro_d', ciclo(0.9, (f) => [sen(f) * 14 - 30, 0, -10])),
      rot('codo_d', ciclo(0.9, () => [-50, 0, 0])),
      mov(m.raiz, 'cadera', ciclo(0.9, (f) => [0, 0.05 * Math.abs(cos(f)), 0])),
      rot('pecho', ciclo(0.9, (f) => [6, sen(f) * 6, 0])),
      rot('cabeza', ciclo(0.9, (f) => [-2, -sen(f) * 5, 0])),
    ], 'movimiento', 'Anda (al trote) detrás del jugador con la pistola de bengalas preparada.'),
    animacion('Disparar', 0.45, [
      rot('hombro_d', poses([[0, -30, 0, -10], [0.08, -88, 0, -6], [0.16, -100, 0, -6], [0.45, -84, 0, -8]])),
      rot('codo_d', poses([[0, -50, 0, 0], [0.08, -4, 0, 0], [0.16, -16, 0, 0], [0.45, -6, 0, 0]])),
      rot('pecho', poses([[0, 6, 0, 0], [0.08, 2, -14, 0], [0.16, -4, -14, 0], [0.45, 2, -10, 0]])),
      esc('fogonazo', poses([[0, 0.001, 0.001, 0.001], [0.1, 0.001, 0.001, 0.001], [0.13, 1.4, 1.4, 1.4], [0.24, 0.001, 0.001, 0.001], [0.45, 0.001, 0.001, 0.001]])),
    ], 'ataque', 'Apunta con el brazo estirado y dispara una bengala; el retroceso le sube el brazo.', false),
  );
  return m;
}
