import * as THREE from 'three';
import type { World } from './world.ts';

// Avisos de suelo de los jefes: círculos, franjas y conos rojos pegados al
// relieve, que se llenan hasta el instante del golpe, y las ondas que deja
// cada impacto. Los comparten los gólems (jefe-golem.ts) y el dragón
// (jefe-volador.ts).

export interface Aviso {
  grupo: THREE.Group;
  relleno: THREE.MeshBasicMaterial;
  borde: THREE.MeshBasicMaterial;
}

const COLOR_AVISO = '#ff3b30';

/** Forma de un aviso en el suelo, para saber si alguien está dentro. */
export type Zona =
  | { tipo: 'circulo'; x: number; z: number; r: number }
  | { tipo: 'franja'; x: number; z: number; dx: number; dz: number; ancho: number; largo: number }
  | { tipo: 'cono'; x: number; z: number; giro: number; largo: number; medio: number };

/** Los avisos que hay ahora en el suelo, de todos los jefes (el piloto de la demo los esquiva). */
export const zonasActivas = new Map<Aviso, Zona>();

export class AvisosSuelo {
  private ondas: { mesh: THREE.Mesh; t: number; radio: number }[] = [];
  private geoOnda = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
  private scene: THREE.Scene;
  private world: World;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  /** Círculo rojo: borde latiendo y relleno que se llena. */
  circulo(cx: number, cz: number, radio: number): Aviso {
    const relleno = this.material(0.18), borde = this.material(0.9);
    const grupo = new THREE.Group();
    grupo.add(new THREE.Mesh(this.pegar(new THREE.RingGeometry(0.01, radio * 0.96, 40, 6).rotateX(-Math.PI / 2), cx, cz), relleno));
    grupo.add(new THREE.Mesh(this.pegar(new THREE.RingGeometry(radio * 0.93, radio, 56, 1).rotateX(-Math.PI / 2), cx, cz, 0.18), borde));
    return this.poner(grupo, cx, cz, relleno, borde, { tipo: 'circulo', x: cx, z: cz, r: radio });
  }

  /** Franja que sale de (x0, z0) en la dirección (dx, dz). */
  franja(x0: number, z0: number, dx: number, dz: number, ancho: number, largo: number): Aviso {
    const relleno = this.material(0.18), borde = this.material(0.9);
    const giro = Math.atan2(dx, dz);
    const grupo = new THREE.Group();
    grupo.add(new THREE.Mesh(this.pegar(
      new THREE.PlaneGeometry(ancho, largo, 2, 24).rotateX(-Math.PI / 2).translate(0, 0, largo / 2).rotateY(giro), x0, z0,
    ), relleno));
    for (const s of [-1, 1]) {
      const linea = new THREE.PlaneGeometry(0.35, largo, 1, 24).rotateX(-Math.PI / 2)
        .translate(s * ancho / 2, 0, largo / 2).rotateY(giro);
      grupo.add(new THREE.Mesh(this.pegar(linea, x0, z0, 0.18), borde));
    }
    return this.poner(grupo, x0, z0, relleno, borde, { tipo: 'franja', x: x0, z: z0, dx, dz, ancho, largo });
  }

  /** Cono que abre `medio` radianes a cada lado de la dirección `giro`. */
  cono(x0: number, z0: number, giro: number, largo: number, medio: number): Aviso {
    const relleno = this.material(0.18), borde = this.material(0.9);
    // El anillo de three abre desde +x en sentido antihorario; tras tumbarlo,
    // el ángulo θ apunta a (cos θ, −sen θ), así que el centro es giro − 90°.
    const desde = giro - Math.PI / 2 - medio;
    const grupo = new THREE.Group();
    grupo.add(new THREE.Mesh(this.pegar(new THREE.RingGeometry(0.3, largo * 0.97, 24, 6, desde, medio * 2).rotateX(-Math.PI / 2), x0, z0), relleno));
    grupo.add(new THREE.Mesh(this.pegar(new THREE.RingGeometry(largo * 0.94, largo, 24, 1, desde, medio * 2).rotateX(-Math.PI / 2), x0, z0, 0.18), borde));
    for (const lado of [-1, 1]) {
      const linea = new THREE.PlaneGeometry(0.3, largo, 1, 16).rotateX(-Math.PI / 2).translate(0, 0, largo / 2).rotateY(giro + lado * medio);
      grupo.add(new THREE.Mesh(this.pegar(linea, x0, z0, 0.18), borde));
    }
    return this.poner(grupo, x0, z0, relleno, borde, { tipo: 'cono', x: x0, z: z0, giro, largo, medio });
  }

  /** Lo llena según `k` (0 → 1, el golpe en 1); `retenido` hace temblar el relleno. */
  pintar(aviso: Aviso, k: number, retenido = false) {
    const ahora = performance.now() / 1000;
    const c = Math.min(1, Math.max(0, k));
    aviso.relleno.opacity = 0.12 + 0.38 * c + (retenido ? 0.12 * Math.sin(ahora * 30) : 0);
    aviso.borde.opacity = 0.55 + 0.4 * Math.abs(Math.sin(ahora * (c > 0.75 ? 22 : 9)));
  }

  quitar(aviso: Aviso | null) {
    if (!aviso) return;
    zonasActivas.delete(aviso);
    this.scene.remove(aviso.grupo);
    aviso.grupo.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    aviso.relleno.dispose();
    aviso.borde.dispose();
  }

  /** Onda de impacto: un aro que se abre y se apaga en 0,4 s. */
  onda(x: number, z: number, radio: number, color: string) {
    const mesh = new THREE.Mesh(this.geoOnda, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    mesh.position.set(x, this.world.heightAt(x, z) + 0.35, z);
    this.scene.add(mesh);
    this.ondas.push({ mesh, t: 0, radio });
  }

  actualizar(dt: number) {
    for (let i = this.ondas.length - 1; i >= 0; i--) {
      const o = this.ondas[i];
      o.t += dt;
      const k = o.t / 0.4;
      const r = o.radio * (0.25 + 0.85 * Math.min(1, k));
      o.mesh.scale.set(r, 1, r);
      (o.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) {
        this.scene.remove(o.mesh);
        (o.mesh.material as THREE.Material).dispose();
        this.ondas.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const o of this.ondas) {
      this.scene.remove(o.mesh);
      (o.mesh.material as THREE.Material).dispose();
    }
    this.ondas = [];
  }

  private poner(grupo: THREE.Group, x: number, z: number, relleno: THREE.MeshBasicMaterial, borde: THREE.MeshBasicMaterial, zona: Zona): Aviso {
    grupo.position.set(x, 0, z);
    grupo.renderOrder = 2;
    this.scene.add(grupo);
    const aviso = { grupo, relleno, borde };
    zonasActivas.set(aviso, zona);
    return aviso;
  }

  private material(opacidad: number) {
    return new THREE.MeshBasicMaterial({
      color: COLOR_AVISO, transparent: true, opacity: opacidad, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
    });
  }

  /** Pone cada vértice a la altura del suelo bajo él (la geometría va centrada en cx, cz). */
  private pegar(geo: THREE.BufferGeometry, cx: number, cz: number, alto = 0.14) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.world.heightAt(cx + pos.getX(i), cz + pos.getZ(i)) + alto);
    pos.needsUpdate = true;
    return geo;
  }
}
