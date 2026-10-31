import type { Game } from './game';

// Solo en desarrollo. Un jugador automático para medir el equilibrio sin jugar
// diez minutos cada vez: huye de lo que tiene cerca, va a por la chatarra
// cuando puede y elige mejoras al azar. No juega bien a propósito; si él
// aguanta X minutos, una persona que sabe lo que hace aguanta más.
//
// Desde la consola: await balance(3) → tres partidas y su resumen.

/* eslint-disable @typescript-eslint/no-explicit-any */

const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

function key(type: string, code: string, k = code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true }));
}

export function playOnce(game: Game) {
  const g = game as any;
  const E = g.enemies, P = g.pickups;
  const held = new Set<string>();
  const setKeys = (want: Set<string>) => {
    for (const c of KEYS) {
      if (want.has(c) && !held.has(c)) { key('keydown', c); held.add(c); }
      if (!want.has(c) && held.has(c)) { key('keyup', c); held.delete(c); }
    }
  };

  g.startRun();
  document.querySelector('.overlay.title')?.remove();

  const samples: string[] = [];
  const levels: number[] = [];
  let state = 'playing';
  for (let step = 0; step < 2600 && state !== 'results'; step++) {
    const px = g.player.position.x, pz = g.player.position.z;
    let vx = 0, vz = 0, threat = 0;
    for (let i = 0; i < E.count; i++) {
      const dx = px - E.x[i], dz = pz - E.z[i], d2 = dx * dx + dz * dz;
      if (d2 < 81) { vx += dx / d2; vz += dz / d2; threat++; }
    }
    if (threat === 0 || Math.hypot(vx, vz) < 0.05) {
      let best = 1e9, bx = 0, bz = 0;
      for (let i = 0; i < P.count; i++) {
        const dx = P.x[i] - px, dz = P.z[i] - pz, d = dx * dx + dz * dz;
        if (d < best) { best = d; bx = dx; bz = dz; }
      }
      vx += bx * 0.05; vz += bz * 0.05;
    }
    // Huir hacia el centro, no hacia las esquinas.
    const edge = Math.max(Math.abs(px), Math.abs(pz)) / 90;
    vx -= (px / 90) * edge * edge * 0.6;
    vz -= (pz / 90) * edge * edge * 0.6;

    const n = Math.hypot(vx, vz) || 1;
    const want = new Set<string>();
    if (vx / n > 0.38) want.add('KeyD');
    if (vx / n < -0.38) want.add('KeyA');
    if (vz / n > 0.38) want.add('KeyS');
    if (vz / n < -0.38) want.add('KeyW');
    setKeys(want);

    state = g.simulate(0.25);
    if (step % 240 === 0) samples.push(`${Math.round(g.time)}s · ${E.count} vivos · ${Math.round(g.hp)} hp · Nv${g.level}`);
    if (state === 'levelup') {
      levels.push(Math.round(g.time));
      const d = String(1 + Math.floor(Math.random() * 3));
      key('keydown', 'Digit' + d, d);
      key('keyup', 'Digit' + d, d);
      state = g.state;
    }
  }
  setKeys(new Set());

  const result = {
    time: Math.round(g.time), kills: g.kills, level: g.level, relics: [...g.relicsFound],
    weapons: [...g.weapons.levels].map(([w, l]: [string, number]) => `${w}:${l}`).join(' '),
    levels: levels.join(','), samples,
  };
  document.querySelector('.overlay.results')?.remove();
  return result;
}

export async function balance(game: Game, runs = 3) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    results.push(playOnce(game));
    await new Promise((r) => setTimeout(r, 0));
  }
  const times = results.map((r) => r.time);
  console.table(results.map(({ samples: _s, ...r }) => r));
  return {
    media: Math.round(times.reduce((a, b) => a + b, 0) / runs),
    min: Math.min(...times), max: Math.max(...times), results,
  };
}
