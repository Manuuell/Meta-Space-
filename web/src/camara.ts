// META SPACE — Módulo de cámara (FOCO 3: seguir cuadrándola).
//
// Sustituto directo de `Game.updateCamera` en `game.ts` (líneas ~496-525).
// La lógica es la misma por fuera (tercera persona detrás y algo por encima,
// anticipación al movimiento, FOV con la velocidad), pero parametrizada y con:
//  - suavizado sin mareo (tasas críticas amortiguadas + zona muerta + sin rebase),
//  - topes contra lomas y ruinas (barrido del brazo de cámara sobre el terreno),
//  - micro-sacudidas de daño y de pulso (sistema de trauma acotado y breve),
//  - encuadre que muestra de dónde viene el peligro (sesgo hacia amenazas),
//  - al saltar, la cámara NO sigue `p.y` al instante (ancla vertical lenta en aire),
//  - transiciones título/pausa/muerte (fundido de estado, sin cortes).
//
// Uso mínimo en `game.ts`:
//
//   import { Camara, CAM } from './camara';
//   private camara = new Camara(this.camera, {
//     alturaEn: (x, z) => this.world.heightAt(x, z),
//   });
//   // en resetRun / startRun:  this.camara.fijar(this.yaw, this.pitch, this.player.position);
//   // al recibir daño:          this.camara.sacudidaDano();
//   // al disparar el pulso (*): this.camara.sacudidaPulso();
//   // cada fotograma:           this.camara.actualizar(dt, {...});
//   // al pausar / morir:        this.camara.iniciarTransicion(0.45);
//
// (*) El pulso vive en `weapons.ts`; basta con exponer un callback
// (`onPulse?: () => void`) o llamar a `sacudidaPulso()` desde `game.ts`
// cuando `weapons` informe del disparo. Ver "Integración" en resultado.md.
//
// Todo el texto visible que produce este módulo va por `ui.toast`, no aquí.

import * as THREE from 'three';

// ============================================================ Constantes
// Todo el ajuste de la cámara vive aquí arriba. Nada de números mágicos
// repartidos por el código: equilibrar la cámara es tocar este bloque.

export const CAM = {
  /** Distancia del brazo de cámara al jugador (m). */
  DISTANCIA: 10,
  /** Altura de los ojos sobre los pies del jugador (m). */
  ALTURA_OJOS: 1.8,
  /** Altura del pivote de cámara sobre los pies (m). */
  ALTURA_PIVOTE: 1.6,
  /** Inclinación mínima/máxima del brazo (rad). */
  PITCH_MIN: 0.12,
  PITCH_MAX: 1.05,
  /** Inclinación inicial al empezar una partida (rad). */
  PITCH_INICIAL: 0.36,

  // Suavizado (1/s). Sin mareo: convergen sin rebasar (amortiguación crítica,
  // factor `1 - exp(-dt * tasa)`), y la zona muerta ignora el tembleque.
  /** Persecución del giro horizontal (peso del ratón). */
  TASA_YAW: 9,
  /** Persecución de la inclinación. */
  TASA_PITCH: 12,
  /** Persecución de la posición. */
  TASA_POSICION: 7,
  /** Giro máximo permitido por segundo (rad/s): el ratón nunca marea. */
  GIRO_MAXIMO: 6.0,
  /** Zona muerta de giro: por debajo, la cámara no se mueve (rad). */
  ZONA_MUERTA: 0.0006,

  // Anticipación del movimiento.
  /** Segundos de velocidad que se anticipan al mirar y colocar la cámara. */
  ANTICIPACION: 0.22,
  /** Metros por delante del jugador a los que se mira. */
  MIRADA_ADELANTE: 3,

  // Topes contra el terreno.
  /** Despeje mínimo de la cámara sobre una loma (m). */
  DESPEJE_SUELO: 0.8,
  /** Muestras del barrido del brazo contra lomas (más = más preciso). */
  MUESTRAS_BARREDO: 6,

  // Salto: la cámara no latiguea con `p.y`.
  /** La ancla vertical sigue al jugador rápido en suelo… (1/s). */
  TASA_ANCLA_SUELO: 10,
  /** …y despacio en el aire: el salto se ve, la cámara no salta (1/s). */
  TASA_ANCLA_AIRE: 1.2,
  /** Velocidad vertical máxima de la cámara (m/s). */
  SUBIDA_MAXIMA: 4.5,

  // FOV con la velocidad.
  /** Extra de FOV a máxima velocidad (grados). */
  FOV_EXTRA: 3,
  /** Velocidad a la que el extra ya está al completo (m/s). */
  VELOCIDAD_FOV: 6,
  /** Suavizado del FOV (1/s). */
  TASA_FOV: 5,

  // Sacudidas (trauma 0..1, decae linealmente; desplazamiento = trauma²).
  /** Trauma que añade recibir daño. */
  TRAUMA_DANO: 0.45,
  /** Trauma que añade disparar el pulso EMP. */
  TRAUMA_PULSO: 0.25,
  /** Cuánto tarda en desaparecer el trauma (1/s). */
  DECAIMIENTO_TRAUMA: 1.6,
  /** Giro máximo de la sacudida (rad). Micro: se nota, no marea. */
  GIRO_SACUDIDA: 0.02,
  /** Desplazamiento máximo de la sacudida (m). */
  DESPLAZAMIENTO_SACUDIDA: 0.25,
  /** Frecuencia del tembleque (Hz). */
  FRECUENCIA_SACUDIDA: 28,
  /** Escala global para `prefers-reduced-motion` (0 = sin sacudida). */
  ESCALA_SACUDIDA_REDUCIDA: 0,

  // Encuadre de peligro: la mirada se sesga hacia las amenazas.
  /** Peso máximo del sesgo hacia el peligro (0..1 de la mezcla). */
  PESO_PELIGRO: 0.35,
  /** Distancia a la que una amenaza deja de importar (m). */
  ALCANCE_PELIGRO: 30,
  /** Metros que la mirada se desplaza hacia el peligro, como máximo. */
  SESGO_MAXIMO: 4,

  // Transiciones título/pausa/muerte.
  /** Duración del fundido de estado (s). */
  DURACION_TRANSICION: 0.45,
  /** Suavizado extra durante la transición (multiplica las tasas). */
  FRENO_TRANSICION: 0.35,
} as const;

// ------------------------------------------------------------ Tipos

/** Lo mínimo que la cámara necesita del mundo: altura del terreno. */
export interface TerrenoCamara {
  /** Altura del suelo (lomas) en un punto. */
  alturaEn(x: number, z: number): number;
  /**
   * Opcional: resuelve colisiones contra ruinas (muros, cohete).
   * Recibe la posición deseada y devuelve la corregida.
   */
  resolver?: (x: number, z: number, radio: number, out: { x: number; z: number }) => { x: number; z: number };
}

/** Una amenaza visible que el encuadre debe intentar mostrar. */
export interface Amenaza {
  x: number;
  z: number;
  /** Peso relativo (p. ej. segador = 3, recolector = 1). */
  peso: number;
}

export interface ParametrosFotograma {
  /** Posición (pies) del jugador. */
  pos: THREE.Vector3;
  /** Velocidad horizontal del jugador (velX, velZ). */
  velX: number;
  velZ: number;
  /** Altura real de los pies (p.y, con salto). */
  alturaPies: number;
  /** Si está en el suelo (para la tasa del ancla vertical). */
  enSuelo: boolean;
  /** Yaw/pitch deseados (los de `game.ts`: ratón + Q/E ya aplicados). */
  yaw: number;
  pitch: number;
  /** Amenazas a encuadrar (puede ser lista vacía). */
  amenazas?: readonly Amenaza[];
  /** FOV base (60 apaisado, 72 en vertical). */
  fovBase?: number;
  /** Escala de la sacudida: 1 = normal; 0 = desactivada. */
  escalaSacudida?: number;
}

export type ModoCamara = 'titulo' | 'juego' | 'pausa' | 'resultado';

// ------------------------------------------------------------ Cámara

export class Camara {
  private yawSuave = 0;
  private pitchSuave: number = CAM.PITCH_INICIAL;
  private anclaY = 0; // ancla vertical: NO es p.y (ver actualizar).
  private trauma = 0;
  private tiempoSacudida = 0;
  private transicion = 0; // segundos restantes de fundido de estado
  private modo: ModoCamara = 'juego';

  constructor(
    private camara: THREE.PerspectiveCamera,
    private terreno: TerrenoCamara,
  ) {}

  // -------------------------------------------------- Estado

  /** Coloca la cámara de golpe (al empezar partida o volver del título). */
  fijar(yaw: number, pitch: number, posJugador: THREE.Vector3): void {
    this.yawSuave = yaw;
    this.pitchSuave = this.limitarPitch(pitch);
    this.anclaY = posJugador.y;
    this.trauma = 0;
    this.transicion = 0;
    this.modo = 'juego';
  }

  /** Funde el estado actual al siguiente (pausa, muerte, título). Sin cortes. */
  iniciarTransicion(modo: ModoCamara, duracion = CAM.DURACION_TRANSICION): void {
    this.modo = modo;
    this.transicion = Math.max(0.001, duracion);
  }

  get enTransicion(): boolean {
    return this.transicion > 0;
  }

  get modoActual(): ModoCamara {
    return this.modo;
  }

  // --------------------------------------------- Sacudidas (trauma)

  /** Micro-sacudida al recibir daño de contacto. */
  sacudidaDano(): void {
    this.trauma = Math.min(1, this.trauma + CAM.TRAUMA_DANO);
  }

  /** Micro-sacudida al disparar el pulso EMP de ADA. */
  sacudidaPulso(): void {
    this.trauma = Math.min(1, this.trauma + CAM.TRAUMA_PULSO);
  }

  /** Solo para pruebas: trauma actual (0..1). */
  traumaActual(): number {
    return this.trauma;
  }

  // -------------------------------------------------- Fotograma

  actualizar(dt: number, p: ParametrosFotograma): void {
    const d = Math.max(0, Math.min(dt, 1 / 30));
    if (d <= 0) return;
    const freno = this.transicion > 0
      ? CAM.FRENO_TRANSICION
      : 1;
    if (this.transicion > 0) this.transicion = Math.max(0, this.transicion - d);

    // 1. Giro suavizado sin mareo: persecución amortiguada + tope de giro.
    this.yawSuave = this.perseguirAngulo(this.yawSuave, p.yaw, CAM.TASA_YAW * freno, d);
    this.pitchSuave = this.perseguirAngulo(
      this.pitchSuave, this.limitarPitch(p.pitch), CAM.TASA_PITCH * freno, d);

    // 2. Ancla vertical: en suelo sigue al jugador; en el aire, despacio.
    //    Así el salto se ve en el astronauta pero la cámara no latiguea.
    const tasaAncla = p.enSuelo ? CAM.TASA_ANCLA_SUELO : CAM.TASA_ANCLA_AIRE;
    const subida = p.alturaPies - this.anclaY;
    const pasoMax = CAM.SUBIDA_MAXIMA * d;
    const paso = this.pasoSuave(subida, tasaAncla, d);
    this.anclaY += Math.max(-pasoMax, Math.min(pasoMax, paso));

    // 3. Posición deseada con anticipación al movimiento.
    const fx = -Math.sin(this.yawSuave), fz = -Math.cos(this.yawSuave);
    const lx = p.pos.x + p.velX * CAM.ANTICIPACION;
    const lz = p.pos.z + p.velZ * CAM.ANTICIPACION;
    const horizontal = CAM.DISTANCIA * Math.cos(this.pitchSuave);
    const deseada = new THREE.Vector3(
      lx - fx * horizontal,
      this.anclaY + CAM.ALTURA_PIVOTE + CAM.DISTANCIA * Math.sin(this.pitchSuave),
      lz - fz * horizontal,
    );

    // 4. Topes: barrido del brazo contra lomas + resolución contra ruinas.
    this.aplicarTopes(deseada, lx, lz);

    // 5. Persecución de la posición (amortiguada: no rebasa, no oscila).
    const k = 1 - Math.exp(-d * CAM.TASA_POSICION * freno);
    this.camara.position.lerp(deseada, k);

    // 6. Mirada: por delante del jugador + sesgo hacia el peligro.
    const mirada = new THREE.Vector3(
      lx + fx * CAM.MIRADA_ADELANTE,
      this.anclaY + CAM.ALTURA_OJOS,
      lz + fz * CAM.MIRADA_ADELANTE,
    );
    this.sesgarHaciaPeligro(mirada, lx, lz, p.amenazas);
    this.camara.lookAt(mirada);

    // 7. Micro-sacudida de trauma (después del lookAt: gira/traslada un poco).
    this.aplicarSacudida(d, p.escalaSacudida ?? 1);

    // 8. FOV con la velocidad (sutil: correr se siente rápido, sin marear).
    const hSpeed = Math.hypot(p.velX, p.velZ);
    const objetivo = (p.fovBase ?? this.camara.fov)
      + Math.min(1, hSpeed / CAM.VELOCIDAD_FOV) * CAM.FOV_EXTRA;
    if (Math.abs(this.camara.fov - objetivo) > 0.02) {
      this.camara.fov += (objetivo - this.camara.fov) * (1 - Math.exp(-d * CAM.TASA_FOV));
      this.camara.updateProjectionMatrix();
    }
  }

  // -------------------------------------------------- Internas

  private limitarPitch(pitch: number): number {
    return Math.max(CAM.PITCH_MIN, Math.min(CAM.PITCH_MAX, pitch));
  }

  /**
   * Persigue un ángulo sin rebasar: paso exponencial + zona muerta + tope de
   * velocidad. El tope (`GIRO_MAXIMO`) es lo que evita el mareo con el ratón.
   */
  private perseguirAngulo(actual: number, objetivo: number, tasa: number, dt: number): number {
    let delta = objetivo - actual;
    // Yaw envuelve en ±π: se persigue por el camino corto.
    if (tasa === CAM.TASA_YAW || tasa === CAM.TASA_YAW * CAM.FRENO_TRANSICION) {
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    }
    if (Math.abs(delta) < CAM.ZONA_MUERTA) return objetivo;
    const paso = delta * (1 - Math.exp(-dt * tasa));
    const max = CAM.GIRO_MAXIMO * dt;
    return actual + Math.max(-max, Math.min(max, paso));
  }

  private pasoSuave(delta: number, tasa: number, dt: number): number {
    return delta * (1 - Math.exp(-dt * tasa));
  }

  /**
   * Topes contra lomas y ruinas:
   *  - Se muestrea el terreno a lo largo del brazo (del jugador a la cámara)
   *    y se eleva la cámara sobre la loma más alta + despeje.
   *  - Si hay `resolver` (ruinas, cohete), se corrige x/z como el jugador.
   */
  private aplicarTopes(deseada: THREE.Vector3, lx: number, lz: number): void {
    let techo = -Infinity;
    for (let i = 1; i <= CAM.MUESTRAS_BARREDO; i++) {
      const t = i / CAM.MUESTRAS_BARREDO;
      const x = lx + (deseada.x - lx) * t;
      const z = lz + (deseada.z - lz) * t;
      const h = this.terreno.alturaEn(x, z) + CAM.DESPEJE_SUELO;
      if (h > techo) techo = h;
    }
    if (techo > deseada.y) deseada.y = techo;
    if (this.terreno.resolver) {
      const out = { x: deseada.x, z: deseada.z };
      const r = this.terreno.resolver(deseada.x, deseada.z, 0.4, out);
      deseada.x = r.x;
      deseada.z = r.z;
      // Tras resolver contra un muro, revalidar la altura en el punto final.
      deseada.y = Math.max(deseada.y, this.terreno.alturaEn(deseada.x, deseada.z) + CAM.DESPEJE_SUELO);
    }
  }

  /**
   * Encuadre de peligro: desplaza la mirada hacia el centro ponderado de las
   * amenazas cercanas, con tope. El jugador sigue en campo y se ve de dónde
   * viene el peligro (anillos, pinzas y laterales entran en plano).
   */
  private sesgarHaciaPeligro(
    mirada: THREE.Vector3, lx: number, lz: number, amenazas?: readonly Amenaza[],
  ): void {
    if (!amenazas || amenazas.length === 0) return;
    let sx = 0, sz = 0, pesoTotal = 0;
    for (const a of amenazas) {
      const dx = a.x - lx, dz = a.z - lz;
      const d = Math.hypot(dx, dz);
      if (d > CAM.ALCANCE_PELIGRO || d < 1e-3) continue;
      // Cerca pesa más: lo urgente manda en el encuadre.
      const w = a.peso * (1 - d / CAM.ALCANCE_PELIGRO);
      sx += (dx / d) * w;
      sz += (dz / d) * w;
      pesoTotal += w;
    }
    if (pesoTotal <= 0) return;
    const len = Math.hypot(sx, sz);
    if (len < 1e-6) return; // peligro repartido por igual: no se sesga a ningún lado
    const mezcla = Math.min(1, pesoTotal) * CAM.PESO_PELIGRO;
    const m = Math.min(CAM.SESGO_MAXIMO, len * mezcla) / len;
    mirada.x += sx * m;
    mirada.z += sz * m;
  }

  /**
   * Sacudida por trauma: decae lineal, amplitud cuadrática (los golpes
   * pequeños apenas se notan, los grandes sí) y frecuencia fija. Acotada por
   * `GIRO_SACUDIDA` / `DESPLAZAMIENTO_SACUDIDA`: micro, nunca mareo.
   */
  private aplicarSacudida(dt: number, escala: number): void {
    if (this.trauma <= 0) return;
    this.trauma = Math.max(0, this.trauma - CAM.DECAIMIENTO_TRAUMA * dt);
    const e = escala <= 0 ? CAM.ESCALA_SACUDIDA_REDUCIDA : escala;
    if (e <= 0 || this.trauma <= 0) return;
    this.tiempoSacudida += dt;
    const a = this.trauma * this.trauma * e;
    const t = this.tiempoSacudida * CAM.FRECUENCIA_SACUDIDA * Math.PI * 2;
    // Funciones seno desfasadas: determinista (las pruebas lo verifican).
    const giro = Math.sin(t * 1.0) * CAM.GIRO_SACUDIDA * a;
    const cabeceo = Math.sin(t * 1.31 + 1.7) * CAM.GIRO_SACUDIDA * 0.7 * a;
    this.camara.rotateY(giro);
    this.camara.rotateX(cabeceo);
    // Desplazamiento vertical pequeño, simétrico (no hunde la cámara al suelo).
    this.camara.position.y += Math.sin(t * 1.73 + 0.6) * CAM.DESPLAZAMIENTO_SACUDIDA * a * 0.2;
  }
}
