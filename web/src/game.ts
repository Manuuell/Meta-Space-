import * as THREE from 'three';
import { ENEMIES, EnemyId, PASSIVES, PassiveId, RELICS, RUN, WEAPONS, WeaponId } from './data';
import { World } from './world';
import { Enemies } from './enemies';
import { Weapons, Modifiers } from './weapons';
import { Pickups, RelicDrop } from './pickups';
import { astronautFrames, blobShadowTexture } from './sprites';
import { consumeLook, endFrame, isLocked, lockPointer, moveVector, unlockPointer, wasPressed } from './input';
import { sfx, unlockAudio } from './audio';
import { loadSave, writeSave } from './save';
import * as ui from './ui';
import { showTitle } from './ui-title';
import { openCharacterCreator } from './creator/character-creator';
import { applyCustomHero, toCustomHero } from './creator/player-contract';
import type { HeroTuning } from './creator/player-contract';
import { SPECIALS } from './creator/stats';

type State = 'title' | 'playing' | 'levelup' | 'paused' | 'results';

// Cámara en tercera persona, detrás y algo por encima, como en PokéBonk.
const CAMERA_DISTANCE = 10;
const PITCH_MIN = 0.12;
const PITCH_MAX = 1.05;
const LOOK_SPEED = 0.0024;
const PLAYER_RADIUS = 0.4;
const PLAYER_HEIGHT = 2.6;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.3, 1200);
  private world: World;
  private enemies: Enemies;
  private pickups: Pickups;
  private weapons!: Weapons;
  private relicDrops: RelicDrop[] = [];

  private player: THREE.Sprite;
  private shadow: THREE.Mesh;
  private frames = astronautFrames();
  private walkTime = 0;
  private hurtFlash = 0;
  // Hacia dónde mira la cámara: yaw 0 es el norte (−z), donde está el cohete.
  private yaw = 0;
  private pitch = 0.36;
  // Soltar el puntero a propósito (subida de nivel, final) no debe pausar.
  private expectUnlock = false;
  private forward = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();

  private state: State = 'title';
  private clock = new THREE.Clock();
  private save = loadSave();
  private tmp = { x: 0, z: 0 };

  // Estado de la partida en curso.
  private time = 0;
  private hp = RUN.maxHp;
  private maxHp = RUN.maxHp;
  private hpLost = 0;
  private level = 1;
  private xp = 0;
  private scrap = 0;
  private kills = 0;
  private killsByType: Record<EnemyId, number> = { recolector: 0, baliza: 0, segador: 0 };
  private passives = new Map<PassiveId, number>();
  private relicsFound: string[] = [];
  // Héroe personalizado del creador de personaje (Meta Space).
  private customSprite: THREE.Texture | null = null;
  private heroName = '';
  private heroMaxHp = RUN.maxHp;
  private heroSpeed = RUN.speed;
  private heroDamageMul = 1;
  private heroCooldownMul = 1;
  private heroSpecial: HeroTuning['special'] | null = null;
  private spawnDebt = 0;
  private nextSegador = 120;
  private nextSwarm = 60;
  private pendingLevels = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.world = new World(this.scene);
    this.enemies = new Enemies(this.scene, this.world);
    this.enemies.onDeath = (i) => this.onEnemyDeath(i);
    this.pickups = new Pickups(this.scene, this.world);

    this.player = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.frames.back[0] }));
    this.player.center.set(0.5, 0);
    this.player.scale.set(PLAYER_HEIGHT * 0.8, PLAYER_HEIGHT, 1);
    this.scene.add(this.player);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.position.y = 0.03;
    this.scene.add(this.shadow);

    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Cualquier gesto desbloquea el audio (los navegadores lo exigen).
    const unlock = () => unlockAudio();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);

    // Un clic en el mundo captura el ratón para girar la cámara.
    canvas.addEventListener('click', () => {
      if (this.state === 'playing') lockPointer(canvas);
    });
    // Esc suelta el puntero sin que la página reciba la tecla: eso es pausa.
    document.addEventListener('pointerlockchange', () => {
      if (isLocked()) return;
      if (this.expectUnlock) { this.expectUnlock = false; return; }
      if (this.state === 'playing') this.pause();
    });

    this.toTitle();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // En vertical (móvil) se abre el campo para ver lo mismo a los lados.
    this.camera.fov = w < h ? 72 : 60;
    this.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------- Estados

  private toTitle() {
    this.state = 'title';
    ui.hideHud();
    this.resetRun();
    let started = false;
    showTitle(this.save, () => {
      if (started) return;
      started = true;
      this.startRun();
    }, {
      onCreator: () => void this.openCreator(),
    });
  }

  private async openCreator() {
    const hero = await openCharacterCreator();
    if (!hero) return;
    await applyCustomHero(this, toCustomHero(hero));
    const who = this.heroName ? ` como <b>${this.heroName}</b>` : '';
    ui.toast('ADA', `Héroe listo${who}. Pulsa JUGAR para despegar.`, 'info', 5);
  }

  /** Hooks del contrato del creador (`player-contract.ts`). */
  setHeroSprite(tex: THREE.Texture) {
    this.customSprite = tex;
    const mat = this.player.material as THREE.SpriteMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  setHeroTuning(t: HeroTuning) {
    this.heroMaxHp = t.maxHp;
    this.heroSpeed = t.speed;
    this.heroDamageMul = t.damageMul;
    this.heroCooldownMul = t.cooldownMul;
    this.heroSpecial = t.special;
    this.hp = this.maxHp = t.maxHp;
  }

  setHeroName(nombre: string) {
    this.heroName = nombre;
  }

  private resetRun() {
    this.weapons?.dispose();
    this.weapons = new Weapons(this.scene, this.enemies, this.world);
    this.weapons.damageMul = this.heroDamageMul;
    this.enemies.clear();
    this.pickups.clear();
    for (const r of this.relicDrops) this.scene.remove(r.group);
    this.relicDrops = [];

    this.time = 0;
    this.hp = this.maxHp = this.heroMaxHp;
    this.hpLost = 0;
    this.level = 1;
    this.xp = 0;
    this.scrap = 0;
    this.kills = 0;
    this.killsByType = { recolector: 0, baliza: 0, segador: 0 };
    this.passives.clear();
    this.relicsFound = [];
    this.spawnDebt = 0;
    this.nextSegador = 120;
    this.nextSwarm = 60;
    this.pendingLevels = 0;
    this.player.position.set(0, this.world.heightAt(0, 0), 0);
    this.yaw = 0;
    this.pitch = 0.36;
  }

  private startRun() {
    this.resetRun();
    this.weapons.upgrade('cortador');
    this.state = 'playing';
    ui.showHud();
    lockPointer(this.canvas);
    ui.toast('ADA', 'Señal de HELIOS detectada. Vienen a por mí. Mantente en movimiento.', 'info', 5);
    if (this.heroSpecial) {
      const sp = SPECIALS[this.heroSpecial];
      ui.toast('ADA', `Especial listo: ${sp.name}. ${sp.blurb}`, 'info', 6);
    }
    this.clock.getDelta();
  }

  private get mods(): Modifiers {
    return {
      cooldown: Math.pow(0.92, this.passive('enfriamiento')) * this.heroCooldownMul,
      area: 1 + 0.1 * this.passive('area'),
    };
  }

  private passive(id: PassiveId) {
    return this.passives.get(id) ?? 0;
  }

  // -------------------------------------------------------------- Bucle

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 30);

    if (this.state === 'playing') {
      if (wasPressed('Escape', 'KeyP')) {
        this.pause();
      } else {
        this.update(dt);
      }
    } else if (this.state === 'title') {
      // De fondo, la cámara gira despacio alrededor del punto de inicio.
      const t = performance.now() / 14000;
      this.camera.position.set(Math.sin(t) * 22, 7, Math.cos(t) * 22);
      this.camera.lookAt(0, 6, -40);
      this.world.follow(this.player.position);
      this.world.faceCamera(Math.atan2(this.camera.position.x, this.camera.position.z));
    }

    endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  private pause() {
    this.state = 'paused';
    this.expectUnlock = isLocked();
    unlockPointer();
    // Al reanudar se vacían las pulsaciones: el Esc que cierra la pausa
    // no debe volver a abrirla en el fotograma siguiente.
    ui.showPause(() => {
      endFrame();
      this.state = 'playing';
      this.clock.getDelta();
      lockPointer(this.canvas);
    }, () => this.toTitle());
  }

  /**
   * Solo para pruebas: avanza la partida `seconds` en pasos fijos sin esperar
   * al navegador, que congela requestAnimationFrame en pestañas ocultas.
   * Se para en cuanto la partida sale de 'playing' (subida de nivel, final).
   */
  simulate(seconds: number) {
    for (let t = 0; t < seconds && this.state === 'playing'; t += 1 / 60) this.update(1 / 60);
    this.renderer.render(this.scene, this.camera);
    return this.state;
  }

  private update(dt: number) {
    this.time += dt;

    const look = consumeLook(dt);
    this.yaw -= look.x * LOOK_SPEED;
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch + look.y * LOOK_SPEED));

    this.movePlayer(dt);
    this.direct(dt);

    const px = this.player.position.x, pz = this.player.position.z;
    const contact = this.enemies.update(dt, px, pz, PLAYER_RADIUS);
    if (contact > 0) {
      this.hp -= contact;
      this.hpLost += contact;
      this.hurtFlash = 0.15;
      sfx('hurt');
    }
    this.hp = Math.min(this.maxHp, this.hp + this.passive('reparacion') * 0.4 * dt);

    this.weapons.update(dt, px, pz, this.mods);
    this.enemies.sweep();
    this.enemies.render();

    const radius = RUN.pickupRadius * (1 + 0.3 * this.passive('iman'));
    const got = this.pickups.update(dt, px, pz, radius);
    if (got > 0) {
      this.scrap += got;
      this.xp += got;
      sfx('pickup');
      while (this.xp >= RUN.xpFor(this.level + this.pendingLevels)) {
        this.xp -= RUN.xpFor(this.level + this.pendingLevels);
        this.pendingLevels++;
      }
    }
    this.updateRelics(dt, px, pz);

    this.world.follow(this.player.position);
    this.updateCamera(dt);

    // La barra de vida va pegada bajo los pies del astronauta, en pantalla.
    const feet = this.player.position.clone().project(this.camera);
    ui.updateHud({
      time: this.time, hp: this.hp, maxHp: this.maxHp, level: this.level, xp: this.xp,
      xpNext: RUN.xpFor(this.level + this.pendingLevels), kills: this.kills, scrap: this.scrap,
      weapons: [...this.weapons.levels.entries()], signal: this.enemies.countOf('baliza'),
      anchor: { x: (feet.x + 1) / 2 * window.innerWidth, y: (1 - feet.y) / 2 * window.innerHeight },
      locked: isLocked(),
    });
    ui.drawMinimap({
      px: this.player.position.x, pz: this.player.position.z, yaw: this.yaw,
      enemies: this.enemies, relics: this.relicDrops.map((r) => r.group.position), pad: this.world.padPosition,
    });

    if (this.hp <= 0) return this.endRun(false);
    if (this.time >= RUN.length) return this.endRun(true);
    if (this.pendingLevels > 0) this.levelUp();
  }

  private movePlayer(dt: number) {
    const move = moveVector();
    const speed = this.heroSpeed * (1 + 0.1 * this.passive('velocidad'));
    // W avanza hacia donde mira la cámara; A y D van de lado.
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const wx = rx * move.x - fx * move.y;
    const wz = rz * move.x - fz * move.y;
    const p = this.player.position;
    const r = this.world.resolve(p.x + wx * speed * dt, p.z + wz * speed * dt, PLAYER_RADIUS, this.tmp);
    p.x = r.x;
    p.z = r.z;
    p.y = this.world.heightAt(p.x, p.z);

    const moving = move.x !== 0 || move.y !== 0;
    if (moving) this.walkTime += dt;
    const material = this.player.material;
    if (this.customSprite) {
      // Héroe personalizado: sprite fijo del creador en vez de la animación.
      if (material.map !== this.customSprite) material.map = this.customSprite;
    } else {
      const step = moving ? Math.floor(this.walkTime * 8) % 2 : 0;
      // De espaldas salvo cuando viene hacia la cámara: así se ve a ADA.
      const frames = move.y > 0.3 ? this.frames.front : this.frames.back;
      if (material.map !== frames[step]) material.map = frames[step];
    }
    if (Math.abs(move.x) > 0.1) {
      // Con héroe personalizado no hay vista frontal: solo espeja el avance.
      const deFrente = !this.customSprite && move.y > 0.3;
      const flip = deFrente ? move.x < 0 : move.x > 0;
      this.player.scale.x = (flip ? -1 : 1) * PLAYER_HEIGHT * 0.8;
    }

    this.hurtFlash -= dt;
    material.color.set(this.hurtFlash > 0 ? '#ff6a5a' : '#ffffff');
    this.shadow.position.set(p.x, p.y + 0.06, p.z);
  }

  private updateCamera(dt: number) {
    const p = this.player.position;
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const horizontal = CAMERA_DISTANCE * Math.cos(this.pitch);
    const want = new THREE.Vector3(
      p.x - this.forward.x * horizontal,
      p.y + 1.6 + CAMERA_DISTANCE * Math.sin(this.pitch),
      p.z - this.forward.z * horizontal,
    );
    // Que la cámara no se meta bajo una loma.
    want.y = Math.max(want.y, this.world.heightAt(want.x, want.z) + 0.8);
    this.camera.position.lerp(want, 1 - Math.exp(-dt * 14));
    // Mira un poco por delante del astronauta: queda abajo y se ve lo que viene.
    this.lookTarget.set(p.x + this.forward.x * 3, p.y + 1.8, p.z + this.forward.z * 3);
    this.camera.lookAt(this.lookTarget);
    this.world.faceCamera(this.yaw);
  }

  // ------------------------------------------------------- Director

  /** Decide qué aparece y cuándo. La presión crece con el tiempo y con las balizas. */
  private direct(dt: number) {
    const minutes = this.time / 60;
    const balizas = this.enemies.countOf('baliza');
    const rate = (0.6 + minutes * 0.5 + minutes * minutes * 0.12) * (1 + 0.15 * balizas);
    const hpScale = 1 + minutes * 0.25;

    this.spawnDebt += rate * dt;
    while (this.spawnDebt >= 1) {
      this.spawnDebt--;
      const type: EnemyId = this.time > 40 && balizas < 4 && Math.random() < 0.04 ? 'baliza' : 'recolector';
      this.spawnAround(type, 28 + Math.random() * 4, hpScale);
    }

    this.recycleStragglers();

    // Oleada en anillo cada minuto: cierra el paso por todos lados a la vez.
    if (this.time >= this.nextSwarm) {
      this.nextSwarm += 60;
      const n = 18 + Math.floor(minutes * 4);
      for (let i = 0; i < n; i++) this.spawnAround('recolector', 22, hpScale, (i / n) * Math.PI * 2);
      ui.toast('ADA', 'Muchas señales a la vez. Nos están rodeando.', 'info', 3);
    }

    if (this.time >= this.nextSegador) {
      this.nextSegador += minutes < 5 ? 90 : 60;
      this.spawnAround('segador', 26, hpScale);
      ui.toast('ADA', 'Algo grande se acerca. Una cosechadora. Lleva algo dentro.', 'info', 4);
    }
  }

  /**
   * Los que se quedan muy atrás no aportan nada: solo engordan la cuenta. Se
   * recolocan en el anillo de aparición, preferiblemente por delante.
   */
  private recycleStragglers() {
    const p = this.player.position;
    const e = this.enemies;
    // Por delante de la cámara: ahí es hacia donde va el jugador.
    const heading = Math.atan2(-Math.cos(this.yaw), -Math.sin(this.yaw));
    for (let i = 0; i < e.count; i++) {
      const dx = e.x[i] - p.x, dz = e.z[i] - p.z;
      if (dx * dx + dz * dz < 45 * 45) continue;
      const angle = heading + (Math.random() - 0.5) * 1.6;
      const a = RUN.arena - 2;
      const r = this.world.resolve(
        Math.max(-a, Math.min(a, p.x + Math.cos(angle) * 28)),
        Math.max(-a, Math.min(a, p.z + Math.sin(angle) * 28)),
        e.defOf(i).radius, this.tmp);
      e.x[i] = r.x;
      e.z[i] = r.z;
    }
  }

  private spawnAround(type: EnemyId, distance: number, hpScale: number, angle = Math.random() * Math.PI * 2) {
    const p = this.player.position;
    const a = RUN.arena - 2;
    const x = Math.max(-a, Math.min(a, p.x + Math.cos(angle) * distance));
    const z = Math.max(-a, Math.min(a, p.z + Math.sin(angle) * distance));
    const r = this.world.resolve(x, z, ENEMIES[type].radius, this.tmp);
    this.enemies.spawn(type, r.x, r.z, hpScale);
  }

  private onEnemyDeath(i: number) {
    const def = this.enemies.defOf(i);
    const x = this.enemies.x[i], z = this.enemies.z[i];
    this.kills++;
    this.killsByType[def.id]++;
    sfx('kill');

    // Lo que sueltan vale más con el tiempo, al ritmo de la curva de nivel.
    const value = def.scrap * (1 + (this.time / 60) * 0.15);
    if (def.scrap >= 5) {
      for (let n = 0; n < 5; n++) this.pickups.drop(x, z, value / 5);
    } else {
      this.pickups.drop(x, z, value);
    }

    if (def.id === 'segador') {
      // La siguiente reliquia que falte en el Códice. El dibujo, siempre la última.
      const pending = RELICS.filter((r) =>
        !this.save.relics.includes(r.id) && !this.relicsFound.includes(r.id) &&
        !this.relicDrops.some((d) => d.relicId === r.id));
      if (pending.length) this.relicDrops.push(new RelicDrop(this.scene, pending[0].id, x, this.world.heightAt(x, z), z));
    }
  }

  private updateRelics(dt: number, px: number, pz: number) {
    for (let i = this.relicDrops.length - 1; i >= 0; i--) {
      const drop = this.relicDrops[i];
      drop.update(dt);
      if (Math.hypot(drop.group.position.x - px, drop.group.position.z - pz) > 1.2) continue;
      this.scene.remove(drop.group);
      this.relicDrops.splice(i, 1);
      this.relicsFound.push(drop.relicId);
      const relic = RELICS.find((r) => r.id === drop.relicId)!;
      sfx('relic');
      ui.toast(`Reliquia: ${relic.name}`, `“${relic.lore}” ${relic.fact}`, 'relic', 9);
    }
  }

  // ----------------------------------------------------- Nivel

  private levelUp() {
    this.pendingLevels--;
    this.level++;
    this.state = 'levelup';
    this.expectUnlock = isLocked();
    unlockPointer();
    sfx('level');
    ui.showLevelUp(this.level, this.rollChoices(), (choice) => {
      if (choice.kind === 'weapon') this.weapons.upgrade(choice.id);
      else if (choice.kind === 'passive') {
        this.passives.set(choice.id, choice.level);
        if (choice.id === 'blindaje') {
          this.maxHp += 20;
          this.hp = this.maxHp;
        }
      } else {
        this.hp = Math.min(this.maxHp, this.hp + 40);
      }
      this.state = 'playing';
      this.clock.getDelta();
      lockPointer(this.canvas);
    });
  }

  private rollChoices(): ui.Choice[] {
    const pool: ui.Choice[] = [];
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const lvl = this.weapons.level(id);
      if (lvl < WEAPONS[id].levels.length) pool.push({ kind: 'weapon', id, level: lvl + 1 });
    }
    for (const id of Object.keys(PASSIVES) as PassiveId[]) {
      const lvl = this.passive(id);
      if (lvl < PASSIVES[id].max) pool.push({ kind: 'passive', id, level: lvl + 1 });
    }
    // Barajar y quedarse con tres; las armas nuevas pesan un poco más al principio.
    pool.sort(() => Math.random() - 0.5);
    pool.sort((a, b) => weight(b) - weight(a) + (Math.random() - 0.5) * 1.6);
    const picks = pool.slice(0, 3);
    if (!picks.length) picks.push({ kind: 'heal' });
    return picks;

    function weight(c: ui.Choice) {
      return c.kind === 'weapon' && c.level === 1 ? 0.8 : 0;
    }
  }

  // --------------------------------------------------- Final

  private endRun(victory: boolean) {
    this.state = 'results';
    this.expectUnlock = isLocked();
    unlockPointer();
    ui.hideHud();
    sfx(victory ? 'relic' : 'death');

    // Lo que quede en el suelo se recoge: la chatarra ganada no se pierde.
    this.scrap += this.pickups.update(0, this.player.position.x, this.player.position.z, 0, true);

    const score = Math.round(this.kills * 10 + this.time * 5 + this.relicsFound.length * 500 + (victory ? 5000 : 0));
    const s = this.save;
    const newRecord = score > s.bestScore;
    const newTypes = (Object.keys(this.killsByType) as EnemyId[])
      .filter((t) => this.killsByType[t] > 0 && !(s.killsByType[t] > 0));

    s.runs++;
    s.bestScore = Math.max(s.bestScore, score);
    s.bestTime = Math.max(s.bestTime, this.time);
    s.bestKills = Math.max(s.bestKills, this.kills);
    s.scrapBank += Math.round(this.scrap);
    for (const [t, n] of Object.entries(this.killsByType)) s.killsByType[t] = (s.killsByType[t] ?? 0) + n;
    s.relics.push(...this.relicsFound);
    writeSave(s);

    ui.showResults({
      victory,
      time: this.time,
      level: this.level,
      kills: this.kills,
      killsByType: { ...this.killsByType },
      newTypes,
      damage: { ...this.weapons.damageDealt },
      scrap: Math.round(this.scrap),
      score,
      relics: this.relicsFound.map((id) => RELICS.find((r) => r.id === id)!),
      newRecord,
      best: { time: s.bestTime, kills: s.bestKills, score: s.bestScore },
      bank: s.scrapBank,
      codexSize: s.relics.length,
      hpLost: this.hpLost,
      weapons: [...this.weapons.levels.entries()],
    }, () => this.startRun(), () => this.toTitle());
  }
}
