import './style.css';
import './style-title.css';
import './creator/character-creator.css';
import './profile/profile-menu.css';
import { Game } from './game';

// `?demo=jefes`: sin título, el piloto automático pelea contra el Cancerbero y
// el Dragón del Velo para verlos sin jugar.
const demo = new URLSearchParams(location.search).get('demo') === 'jefes';
const game = new Game(document.getElementById('game') as HTMLCanvasElement, { demo });

// Solo en desarrollo: acceso desde la consola y el jugador automático para
// medir el equilibrio. No entra en el build.
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.game = game;
  void import('./balance').then(({ balance }) => {
    w.balance = (runs?: number) => balance(game, runs);
  });
}
