import { abrirAstillero } from './ui-astillero.ts';
import { hangarVacio, type Diseno } from './nave/piezas.ts';

// Solo en desarrollo: /astillero.html abre el astillero con un almacén de ejemplo,
// sin jugar. Nada de esto se guarda. Con ?nave=media o ?nave=tope salen piezas ya
// fabricadas. No entra en el build del juego.

const hangar = hangarVacio();
hangar.fragmentos = { motores: 3, propulsor: 3, aletas: 2, casco: 3, escudo: 2, proa: 2 };
let chatarra = 900;

// ?nave=media o ?nave=tope abren con piezas ya fabricadas, para verlas sin montarlas.
const NAVES: Record<string, Partial<Diseno>> = {
  media: { motores: 'motor-nueve', propulsor: 'tanque-largo', aletas: 'aleta-rejilla', casco: 'casco-acero', escudo: 'escudo-negro', proa: 'proa-antena' },
  tope: { motores: 'motor-corona', propulsor: 'tanque-gigante', aletas: 'aleta-titanio', casco: 'casco-largo', escudo: 'escudo-negro', proa: 'proa-ada' },
};
const elegida = NAVES[new URLSearchParams(location.search).get('nave') ?? ''];
if (elegida) {
  Object.assign(hangar.montadas, elegida);
  hangar.fabricadas = Object.values(elegida);
}

abrirAstillero({
  hangar,
  chatarra: () => chatarra,
  gastar: (n) => { chatarra -= n; },
  guardar: () => {},
  volver: () => location.reload(),
  subtitulo: 'PRUEBA · NO SE GUARDA',
  general: Boolean(elegida),
});
