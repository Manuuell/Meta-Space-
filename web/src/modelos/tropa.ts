import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { conDetalle, contorno, type Modelo } from './kit.ts';

// Tropa: cientos de copias animadas de un modelo con pocas llamadas de dibujo.
//
// Las animaciones se hornean una vez: cada clip se muestrea a 30 fps y, por
// fotograma, se guarda la matriz de cada articulación respecto a la raíz.
// Las piezas que cuelgan de la misma articulación y comparten material se
// fusionan en una sola geometría y se dibujan con un InstancedMesh. En cada
// fotograma, la matriz de una instancia es: mundo del enemigo × articulación.

const FPS = 30;

interface Grupo {
  nodo: THREE.Object3D;
  /** Índice de la articulación en las matrices horneadas. */
  k: number;
  malla: THREE.InstancedMesh;
  tinte: boolean;
}

interface ClipHorneado {
  fotogramas: number;
  bucle: boolean;
  /** [fotograma][articulación] → 16 floats. */
  matrices: Float32Array;
}

function fusionar(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
}

export class Tropa {
  private grupos: Grupo[] = [];
  private nodos: THREE.Object3D[] = [];
  private clips = new Map<string, ClipHorneado>();
  private cuenta = 0;
  private m = new THREE.Matrix4();
  private art = new THREE.Matrix4();

  constructor(escena: THREE.Scene, crear: () => Modelo, capacidad: number, nombresClip: string[]) {
    const modelo = conDetalle(0.45, crear);
    const raiz = modelo.raiz;
    raiz.updateMatrixWorld(true);

    // Piezas agrupadas por articulación (el padre de la malla) y material.
    const porGrupo = new Map<string, { nodo: THREE.Object3D; material: THREE.Material; geos: THREE.BufferGeometry[] }>();
    const contornos = new Map<THREE.Object3D, THREE.BufferGeometry[]>();
    raiz.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.contorno) return;
      const nodo = o.parent!;
      o.updateMatrix();
      const geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrix);
      const material = o.material as THREE.Material;
      const clave = `${nodo.uuid}:${material.uuid}`;
      if (!porGrupo.has(clave)) porGrupo.set(clave, { nodo, material, geos: [] });
      porGrupo.get(clave)!.geos.push(geo);
      if (o.children.some((c) => c.userData.contorno)) {
        if (!contornos.has(nodo)) contornos.set(nodo, []);
        contornos.get(nodo)!.push(geo);
      }
    });

    const crearMalla = (geo: THREE.BufferGeometry, material: THREE.Material, sombra: boolean) => {
      const malla = new THREE.InstancedMesh(geo, material, capacidad);
      malla.count = 0;
      malla.frustumCulled = false;
      malla.castShadow = sombra;
      malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      escena.add(malla);
      return malla;
    };
    for (const { nodo, material, geos } of porGrupo.values()) {
      // Cientos de unidades ya tienen lectura toon y contorno. Sombras
      // dinámicas por cada pieza multiplicaban las pasadas de dibujo en móvil.
      const malla = crearMalla(fusionar(geos), material, false);
      malla.setColorAt(0, new THREE.Color(1, 1, 1));
      this.grupos.push({ nodo, k: 0, malla, tinte: true });
    }
    for (const [nodo, geos] of contornos) {
      this.grupos.push({ nodo, k: 0, malla: crearMalla(fusionar(geos), contorno(), false), tinte: false });
    }
    this.nodos = [...new Set(this.grupos.map((g) => g.nodo))];
    for (const g of this.grupos) g.k = this.nodos.indexOf(g.nodo);

    // Pose de reposo de todo el modelo: se restaura antes de hornear cada clip
    // para que un clip no herede lo que dejó el anterior.
    const reposo = new Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>();
    raiz.traverse((o) => reposo.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
    const mezclador = new THREE.AnimationMixer(raiz);
    const inversaRaiz = new THREE.Matrix4();
    for (const nombre of nombresClip) {
      const anim = modelo.animaciones.find((a) => a.clip.name === nombre);
      if (!anim) throw new Error(`El modelo ${modelo.id} no tiene la animación «${nombre}».`);
      mezclador.stopAllAction();
      for (const [o, [p, q, s]] of reposo) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
      const accion = mezclador.clipAction(anim.clip);
      accion.setLoop(anim.bucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      accion.clampWhenFinished = true;
      accion.play();
      // En bucle, el último fotograma es el primero: no se guarda dos veces.
      const fotogramas = Math.max(1, Math.round(anim.clip.duration * FPS) + (anim.bucle ? 0 : 1));
      const matrices = new Float32Array(fotogramas * this.nodos.length * 16);
      for (let f = 0; f < fotogramas; f++) {
        mezclador.setTime(Math.min(f / FPS, anim.clip.duration - 1e-4));
        raiz.updateMatrixWorld(true);
        inversaRaiz.copy(raiz.matrixWorld).invert();
        this.nodos.forEach((n, k) => {
          this.art.multiplyMatrices(inversaRaiz, n.matrixWorld).toArray(matrices, (f * this.nodos.length + k) * 16);
        });
      }
      this.clips.set(nombre, { fotogramas, bucle: anim.bucle, matrices });
    }
  }

  /** Duración de un clip horneado, en segundos. */
  duracion(clip: string): number {
    return (this.clips.get(clip)?.fotogramas ?? 1) / FPS;
  }

  empezar() {
    this.cuenta = 0;
  }

  /** Añade una copia con su matriz de mundo, el clip, el tiempo y un tinte. */
  poner(mundo: THREE.Matrix4, clip: string, tiempo: number, color?: THREE.Color) {
    const c = this.clips.get(clip)!;
    const f = c.bucle
      ? Math.floor(tiempo * FPS) % c.fotogramas
      : Math.min(c.fotogramas - 1, Math.max(0, Math.floor(tiempo * FPS)));
    const i = this.cuenta++;
    const base = f * this.nodos.length;
    for (const g of this.grupos) {
      this.art.fromArray(c.matrices, (base + g.k) * 16);
      this.m.multiplyMatrices(mundo, this.art).toArray(g.malla.instanceMatrix.array, i * 16);
      if (g.tinte && color) g.malla.setColorAt(i, color);
    }
  }

  terminar() {
    for (const g of this.grupos) {
      g.malla.count = this.cuenta;
      if (this.cuenta === 0) continue;
      g.malla.instanceMatrix.clearUpdateRanges();
      g.malla.instanceMatrix.addUpdateRange(0, this.cuenta * 16);
      g.malla.instanceMatrix.needsUpdate = true;
      if (g.malla.instanceColor) {
        g.malla.instanceColor.clearUpdateRanges();
        g.malla.instanceColor.addUpdateRange(0, this.cuenta * 3);
        g.malla.instanceColor.needsUpdate = true;
      }
    }
  }
}
