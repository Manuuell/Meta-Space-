import * as THREE from 'three';

// Efectos de los operadores: anillos, columnas de luz, rayos, chispas y sellos
// en el suelo que nacen, crecen y se apagan solos. Los usan las armas
// exclusivas y las habilidades (R). Cada efecto es una malla aditiva con su
// material propio (para poder apagarla) sobre geometrías compartidas.

const MAX_EFECTOS = 160;

interface Efecto {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  edad: number;
  duracion: number;
  /** Escala al empezar y al acabar (se interpola con frenada). */
  desde: number;
  hasta: number;
  opacidad: number;
  /** Alto fijo (columnas): la escala solo crece en x y z. */
  alto?: number;
}

export interface OpcionesEfecto {
  color: string;
  duracion: number;
  desde?: number;
  hasta?: number;
  opacidad?: number;
}

const frena = (t: number) => 1 - (1 - t) ** 3;

export class Efectos {
  private scene: THREE.Scene;
  private efectos: Efecto[] = [];
  private geoAnillo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
  private geoAnilloGrueso = new THREE.RingGeometry(0.55, 1, 48).rotateX(-Math.PI / 2);
  private geoHexagono = new THREE.RingGeometry(0.7, 1, 6).rotateX(-Math.PI / 2);
  private geoDisco = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  private geoColumna = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
  private geoRayo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  private geoChispa = new THREE.IcosahedronGeometry(1, 1);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private nuevo(geo: THREE.BufferGeometry, o: OpcionesEfecto, x: number, y: number, z: number, lados: THREE.Side = THREE.FrontSide) {
    if (this.efectos.length >= MAX_EFECTOS) this.quitar(0);
    const mat = new THREE.MeshBasicMaterial({
      color: o.color, transparent: true, opacity: o.opacidad ?? 0.85, blending: THREE.AdditiveBlending,
      depthWrite: false, side: lados,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const e: Efecto = { mesh, mat, edad: 0, duracion: o.duracion, desde: o.desde ?? 0.2, hasta: o.hasta ?? 1, opacidad: o.opacidad ?? 0.85 };
    this.efectos.push(e);
    e.mesh.scale.setScalar(e.desde);
    return e;
  }

  /** Onda en el suelo que se abre de `desde` a `hasta` metros de radio. */
  anillo(x: number, y: number, z: number, o: OpcionesEfecto & { grueso?: boolean }) {
    return this.nuevo(o.grueso ? this.geoAnilloGrueso : this.geoAnillo, o, x, y + 0.08, z, THREE.DoubleSide).mesh;
  }

  /** Sello hexagonal en el suelo (las marcas de Noa al estallar). */
  hexagono(x: number, y: number, z: number, o: OpcionesEfecto) {
    const m = this.nuevo(this.geoHexagono, o, x, y + 0.1, z, THREE.DoubleSide).mesh;
    m.rotation.y = Math.random() * Math.PI;
    return m;
  }

  /** Círculo lleno en el suelo: destellos de área. */
  disco(x: number, y: number, z: number, o: OpcionesEfecto) {
    return this.nuevo(this.geoDisco, o, x, y + 0.06, z, THREE.DoubleSide).mesh;
  }

  /** Columna de luz que sube del suelo y se ensancha. */
  columna(x: number, y: number, z: number, alto: number, o: OpcionesEfecto) {
    const e = this.nuevo(this.geoColumna, o, x, y, z, THREE.DoubleSide);
    e.alto = alto;
    e.mesh.scale.set(e.desde, alto, e.desde);
    return e.mesh;
  }

  /** Rayo recto entre dos puntos (trazadoras, saltos, enlaces). */
  rayo(a: THREE.Vector3, b: THREE.Vector3, grosor: number, o: OpcionesEfecto) {
    const e = this.nuevo(this.geoRayo, { ...o, desde: 1, hasta: 1 }, a.x, a.y, a.z);
    e.mesh.lookAt(b);
    e.mesh.scale.set(grosor, grosor, a.distanceTo(b));
    e.alto = -1;
    return e.mesh;
  }

  /** Chispa: bola aditiva que se hincha y se apaga. */
  chispa(x: number, y: number, z: number, o: OpcionesEfecto) {
    return this.nuevo(this.geoChispa, o, x, y, z).mesh;
  }

  update(dt: number) {
    for (let k = this.efectos.length - 1; k >= 0; k--) {
      const e = this.efectos[k];
      e.edad += dt;
      const t = Math.min(1, e.edad / e.duracion);
      const s = e.desde + (e.hasta - e.desde) * frena(t);
      if (e.alto === -1) {
        // Rayo: no crece, solo adelgaza al apagarse.
        const g = e.mesh.scale.x * (1 - dt * 6);
        e.mesh.scale.x = e.mesh.scale.y = Math.max(0.005, g);
      } else if (e.alto !== undefined) e.mesh.scale.set(s, e.alto * (1 + t * 0.15), s);
      else e.mesh.scale.setScalar(s);
      e.mat.opacity = e.opacidad * (1 - t) ** 1.5;
      if (t >= 1) this.quitar(k);
    }
  }

  private quitar(k: number) {
    const [e] = this.efectos.splice(k, 1);
    this.scene.remove(e.mesh);
    e.mat.dispose();
  }

  dispose() {
    while (this.efectos.length) this.quitar(this.efectos.length - 1);
    for (const g of [this.geoAnillo, this.geoAnilloGrueso, this.geoHexagono, this.geoDisco, this.geoColumna, this.geoRayo, this.geoChispa]) g.dispose();
  }
}
