# Cómo hacer cinemáticas en Meta Space

Guía para hacer más cinemáticas. Refleja el estado del 04/11/2026, con la cinemática
de la historia ya integrada en el juego.

## Qué hay hoy

Secuencia al abrir el juego (`toTitle` en `web/src/game.ts`):

1. **Intro del título** (`web/src/intro.ts`): la nave suelta las letras de META
   SPACE con su propia música, que entra en cuanto el navegador deja sonar. Al pulsar,
   despega.
2. **Historia** (`web/src/cinematica.ts`): 83 s en 13 planos, con música. Es un
   mensaje de ADA para el último superviviente: habla en primera persona y le
   trata de tú, así que todo rótulo nuevo tiene que sonar a ella.
3. **Menú.**

Las dos primeras salen una vez por carga (`introVista`). No salen con
`prefers-reduced-motion` ni con `?demo=jefes`.

| Archivo | Qué contiene |
|---|---|
| `web/src/cinematica-guion.ts` | Planos, rótulos y momentos clave. Solo datos. |
| `web/src/cinematica.ts` | Puesta en escena, efectos y sonidos sueltos. |
| `web/src/cinematica-post.ts` | Brillo, onda de choque, separación de color y estática. |
| `web/src/musica.ts` | Partitura e instrumentos sintetizados. |
| `web/src/intro.ts` | Intro del título; exporta planetas, velo, `sonar`, `tono`, `tramo`… |
| `web/test/cinematica.test.ts` | Comprueba tiempos, rótulos y que la música cae con la imagen. |

## Las cuatro ideas del sistema

1. **Todo sale de `t`.** Cada fotograma se calcula solo con el segundo en curso:
   disparos, explosiones, esquirlas y chispas no guardan estado. Por eso se puede
   empezar en cualquier plano y las capturas se repiten. Usa `azar(n)`, nunca
   `Math.random()`, en lo que se ve.
2. **Los tiempos son relativos al plano.** Escribe `en('caida', 2)` o `tl`, nunca
   un segundo absoluto. Así se puede mover o alargar un plano sin tocar el resto.
3. **La imagen sigue al audio.** Con música, `t` sale del reloj de `AudioContext`
   (`relojBanda`), así que nunca se desfasan. Sin audio, avanza con `dt`.
4. **Los golpes se deciden antes.** `guionDeFuego()` calcula al empezar todos los
   rayos y explosiones. Cada baja tiene su disparo y cada estallido su `plano`.

## Receta: añadir un plano

1. **Guion** (`cinematica-guion.ts`): añade el plano a `PLANOS`, en orden y sin
   huecos, y sus rótulos con `r(plano, de, a, voz, texto)`.
   - `narra` va abajo. `helios` va arriba, en mayúsculas de protocolo.
   - Máximo 48 caracteres. Duración mínima: letras ÷ 38 + 0,5 s.
   - ADA no pasa de 17 letras por segundo: hay que poder leer y mirar a la vez.
   - Sin jerga: «módulo» o «protocolo» solo en boca de HELIOS o en las fichas.
   - Una voz no puede pisarse a sí misma; las dos sí pueden coincidir.
2. **Objetos** (`showCinematica`): créalos antes de `const nuevos` y añádelos a esa
   lista. Todo lo de esa lista se apaga en cada fotograma.
3. **Plano** (objeto `planos`): añade `miPlano: (tl) => { … }`, donde `tl` son los
   segundos desde que empezó. TypeScript avisa si falta. El esqueleto es:

   ```ts
   miPlano: (tl) => {
     ver(objeto, actor.raiz);                     // enciende lo que sale
     luz(0.5, 0.7, 0.5, '#fff1dc', 2.2);          // dirección, color y fuerza
     contraluz(1, 0.2, -0.6, PALETA.helios, 0.8);
     ambiente('#c3c6ff', '#3d2440', 1.0);
     actor.raiz.position.set(0, 0, -5);
     orientar(actor.raiz, vA.set(0, 0, 1));       // +z es el frente del modelo
     actor.raiz.scale.setScalar(1);
     posar(actor, ['Reposo', 1, t]);              // clip, peso y segundo del clip
     encuadrar(0, 1.5, 4, 0, 1, -5);              // cámara y punto al que mira
   },
   ```

4. **Sonido:** añade `[en('miPlano', 1.2), fn]` a `SONIDOS`.
5. **Música:** añade su parte en `componer()`. Ver «Música y sonido».
6. **Si cambian los tiempos,** revisa los números de `test/cinematica.test.ts`.

Un corte pasa por negro automáticamente; la excepción está en `CORTES`.

## Caja de herramientas

Todo está dentro de `showCinematica` salvo que se indique.

| Herramienta | Para qué sirve |
|---|---|
| `actor(modelo, alto, copia?)` | Prepara un modelo. `alto` sube el pivote al centro del cuerpo. |
| `conDetalle(0.5, crearX)` y `raiz.clone()` | Enjambres: una base con menos detalle y copias. |
| `posar(actor, [clip, peso, s, bucle?], …)` | Pone clips y los mezcla por peso. |
| `orientar(obj, dirección, alabeo)` | Apunta el frente del modelo. |
| `ruta([[s, x, y, z], …])` | Trayectoria suave; devuelve posición y rumbo. |
| `encuadrar(px, py, pz, mx, my, mz)` | Cámara, con el temblor de `sacudida` incluido. |
| `chispa(x, y, z, color, metros)` | Punto luminoso: nieve, ascuas, estelas, datos. Hasta 14.000 por fotograma. |
| `humo(x, y, z, color, metros, alfa)` | Lo mismo, pero tapa en vez de brillar: humo, polvo, nieve a ras de suelo. Hasta 1.800. |
| `relampago(de, a, semilla, color, grosor)` | Rayo quebrado que cambia de forma solo. |
| `estatica` y `tinteEstatica` | Rasgado de radio de este fotograma: el plano los pone, de 0 a 1. |
| `atenuaBrillo` | Baja el brillo en planos muy claros, o la imagen se quema entera. |
| `GOLPES` | Ondas de choque que deforman la pantalla. Los estallidos grandes ya la lanzan solos. |
| `BRILLO` | Cuánto brilla cada plano y desde qué luz empieza. |
| `RESTOS` (en `guionDeFuego`) | Trozos que saltan de lo que se rompe, con brasas y humo. |
| `estallidos.push({ plano, t, pos, tam })` | Explosión con chispas, destello, raya de lente, luz y temblor. |
| `disparo(t0, dur, de, a, color, grosor, impacto)` | Rayo entre dos puntos, dentro de `guionDeFuego`. |
| `destello(mapa, color, tam, niebla?)` | Sprite aditivo: halos, soles, fuegos, anillos. |
| `materialPlaneta(paleta)` | Planeta con velo (`cubre`), hielo (`polo`) y lava (`grietas`). |
| `ponerCampo(sol)`, `pintarRocas`, `nieve` | Campo helado bajo el velo; `sol` lo abre de 0 a 1. |
| `tramo(t, a, b)`, `campana(t, c, ancho)` | Rampa suave de 0 a 1 y pulso centrado en un momento. |
| `enPantalla(v)` | Pasa un punto 3D a píxeles, para etiquetas HTML. |

Para rótulos o HUD en HTML: añade el elemento en `capa.innerHTML`, usa unidades
`cqh`/`cqw` en el CSS y ponlo a `opacity: 0` en `pintar` junto a `ficha`.

## Modelos más útiles

Están todos en `CATALOGO` (`web/src/modelos/index.ts`). Miran hacia +z.

| Modelo | `alto` | Tamaño | Clips útiles |
|---|---|---|---|
| Nave `crearNave` | 1,5 | 3,3 m | Flotar, Volar, Turbo |
| Astronauta `crearAstronauta` | 0 | 2,9 m | Reposo, Correr, Volar, Victoria, Derrota |
| Avispa `crearAvispa` | 3,4 | 1,4 m | Volar |
| Recolector `crearRecolector` | 0 | 1,8 m | Caminar, Derrota |
| Baliza `crearBaliza` | 0 | flota a 1,6 m | Flotar, Triangular, Derrota |
| Dragón `crearDragon` | 2,6 | 18 m de alas | Volar, Rugir, Aliento |
| Heraldo `crearHeraldo` | 4,3 | 4,9 m | Flotar, Entrada, Furia, Derrota |
| Titán `crearGolem('titan')` | 0 | 12 m | Caminar, Pisoton (golpe a 1,15 s), Furia |
| Cancerbero `crearSabueso` | 0 | 7,3 m | Embestir, Furia, Aliento |
| Refugio `crearRefugio` | 0 | 5 m | Reposo, Abrir, Alarma |
| Torre del Velo `crearTorreVelo` | 0 | 14 m | Emitir, Colapso |
| Tali `crearNpcVigia` y gente | 0 | 2,5 m | Trabajar, Saludar, Hablar, Celebrar, Asustarse |
| Holograma `crearAdaNoa` | 0 | 1,8 m, centrado | Reposo, Escanear, Hablar |

Para medir un modelo nuevo usa `medir` de `kit.ts` y `THREE.Box3`. Mira además su
altura real: varios modelos no tienen el pivote donde parece.

## Música y sonido

Todo se sintetiza: no hay muestras ni grabaciones, así que no hay derechos de
terceros.

- **Música:** en `componer()`, `const X = de('miPlano')` y luego
  `toca(X(1.5), voz, dur, notas, vol)`. Las notas son MIDI (60 = do central).
- **Tempo:** 120 pulsaciones por minuto; medio segundo el pulso.
- **Voces:** `pad`, `cuerdas`, `cortas`, `coro`, `trompa`, `metal`, `arpa`, `cajita`,
  `campana`, `bajo`, `zumbido`, `bombo`, `caja`, `charles`, `platillo`,
  `platilloInverso`, `tambor`, `timbal`, `gong`, `subida`, `impacto`, `pitido`,
  `estatica`, `tic`. Cada nota lleva su posición en estéreo (`pan`).
- **Melodías:** `frase(segundo, voz, [[nota, pulsos], …], vol)`, y `hasta(melodia, pulsos)`
  para usar solo el principio.
- **Volumen orientativo:** cuerdas 0,1–0,2, coro 0,07–0,15 (se reparten entre sus
  notas), bajo 0,12, bombo 0,5, trompas 0,13–0,22, metales 0,1, campanas 0,06.
- **Temas:** el de Meta (`temaDeMeta`), en mayor o menor, cuenta la historia: frágil
  en la caja de música, heroico en Ares, roto tras la caída y entero al volver el
  sol. HELIOS es re, mi bemol y la. ADA tiene su tema en campanas.
- **Cuidado con el coste:** cada `AudioParam` que se mueve muestra a muestra sale
  muy caro. Por eso todo va a `k-rate`, el vibrato es común y cada nota libera sus
  nodos al acabar. Sin eso, la banda tardaba cuatro veces más en calcularse.
- **Efectos:** `tono`, `soplido`, `estallido`, `barrido`, `sirena`, `viento`, `sos`.
- **Intro:** su partitura está en `componerIntro()` y sus momentos, en `INTRO`
  (`cinematica-guion.ts`). Las letras tocan el principio del tema de Meta
  (`NOTAS_LETRAS`), el título lo resuelve y la caja de música lo repite en la espera.
  Lo que depende de la pantalla se toca con `banda.nota(voz, dur, notas, vol, pan)`.
  El motor de la nave (`crearMotor`) sale de su empuje y su posición.

El navegador no deja sonar nada sin un gesto, y la intro es lo primero que se ve.
No se le pone ningún botón delante (se probó y se descartó): arranca sola, pide audio
al abrir y otra vez con cada gesto, y la música entra donde vaya la imagen. Quien no
pulse nada la ve muda hasta el título, y el clic de despegar ya suena. Ese clic llega
antes de que el audio esté en marcha: lo que tenga que sonar en ese momento va en
`alArrancar`. En táctil solo cuenta levantar el dedo: por eso `GESTOS` incluye más
que `pointerdown`. Esc no cuenta como gesto: si se salta la intro con Esc y el audio
aún no está en marcha, la cinemática espera con el botón «Ver la historia».

**Trampa al comprobarlo:** un navegador automatizado puede dejar sonar sin gesto,
y entonces no se reproduce el silencio de Chrome o Safari. Para simularlo,
sustituye `AudioContext` por una clase cuyo `state` y `resume` no dejen pasar hasta
el `pointerdown` y abre `showIntro` desde `/src/intro.ts?t=…`, una copia con el audio
sin crear. Para saber si algo suena, engancha un `AnalyserNode` a cada `AudioContext` antes de pulsar: el juego
abre dos, el de los efectos (`audio.ts`) y el de la intro y la cinemática (`sonar`).

## Comprobar el trabajo

Antes de dar algo por hecho: `npx tsc --noEmit`, `npm test`, `npm run build` y
verlo en el navegador con `npm run dev`.

Fotograma congelado, en la consola con `npm run dev`:

```js
window.__ver = async (s) => {
  window.__cin?.();
  document.querySelectorAll('.msc, .msi').forEach((e) => e.remove());
  const m = await import('/src/cinematica.ts?t=' + Date.now());
  window.__cin = m.showCinematica(document.body, () => {}, { fijo: s });
  await new Promise((r) => setTimeout(r, 900));
  // Con la ventana en segundo plano, la imagen no se refresca hasta que cambia algo.
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;z-index:99';
  document.body.appendChild(d);
  await new Promise((r) => setTimeout(r, 400));
  d.remove();
};
await __ver(27.7);
```

Pasada completa sin que suene el Mac:

```js
window.AudioContext = undefined;
const m = await import('/src/cinematica.ts?t=' + Date.now());
m.showCinematica(document.body, () => console.log('fin'), { inicio: 0, sonido: true });
```

Para bloquear el sonido en la secuencia real del juego, ejecuta esto después de
cargar: `AudioContext.prototype.resume = () => Promise.resolve();`.

Medir la música sin oírla:

```js
const m = await import('/src/musica.ts?t=' + Date.now());
const sr = 22050, oc = new OfflineAudioContext(2, sr * 87, sr);
m.tocarBanda(oc, 0, 0);
const d = (await oc.startRendering()).getChannelData(0);
const rms = [];
let pico = 0;
for (let s = 0; s < 87; s++) {
  let suma = 0;
  for (let i = s * sr; i < (s + 1) * sr; i++) {
    suma += d[i] * d[i];
    pico = Math.max(pico, Math.abs(d[i]));
  }
  rms.push(Math.round(Math.sqrt(suma / sr) * 1000));
}
({ pico, rms: rms.join(' ') });
```

Con `m.tocarIntro(oc, 0, 0)` se mide igual la intro. El pico debe quedar por debajo
de 1 y sin `NaN`. El momento más fuerte tiene que ser la vuelta del sol, y el cálculo debe tardar menos de 20 s (un tiempo mucho
mayor avisa de cortes en directo). Tarda en acabar: guarda el resultado en `window`
y consúltalo aparte. Hay que escucharla igualmente: la medida no dice si suena bien.

## Trampas que ya costaron tiempo

- **Capturas viejas:** con la ventana en segundo plano, las capturas no se actualizan,
  y a veces enseñan el juego de fondo en vez de la cinemática. Tráela al frente y toca
  el DOM antes de capturar; si quitas el truco del `div` de `__ver`, fallan casi todas.
- **Recarga de Vite:** al guardar, la página se recarga y `__ver` desaparece.
- **Colores en shaders:** `THREE.Color` pasa a lineal y los `ShaderMaterial` no
  convierten de vuelta. Por eso las paletas de planeta van en números 0–1.
- **Clips con avisos:** `Bombardeo` y `Rociar` del Heraldo pintan marcas en el
  suelo, que en el espacio quedan flotando. Revisa los clips de ataque.
- **Rutas:** `monotona` frena en la última clave. Ponla después del corte.
- **Instancias:** usa `frustumCulled = false` o desaparecen al moverse.
- **Explosiones:** cada una lleva `plano`; si no, se cuela en el plano siguiente.
- **Brillo:** lo mide sobre la imagen ya acabada. En un plano claro (nieve, traje de
  cerca, sol) sube el umbral en `BRILLO` o usa `atenuaBrillo`, o se quema todo.
- **Imagen copiada:** la escena se pinta en el lienzo y se copia a una textura. No
  uses un `RenderPass` normal: los planetas y las partículas escriben su color tal
  cual y saldrían lavados.
- **Tests en Node:** importa con extensión `.ts`, no uses propiedades en el
  constructor y no toques `document` al cargar el módulo.
- **Dependencias circulares:** `musica.ts` no puede importar `cinematica.ts`. Lo
  compartido va en `cinematica-guion.ts`.
- **Nombres:** `baliza` es el sprite de la señal de ADA; la unidad es `balizaHelios`.
- **Móvil:** el campo de visión se abre en vertical. Compruébalo con la vista de
  móvil del navegador.

## Para hacer otra cinemática

`showCinematica` es una sola función con un solo guion. Para añadir planos a esta
historia, basta con la receta. Para una cinemática independiente, como la victoria
final con las siete reliquias, la derrota o la entrada de un jefe, conviene separar
antes el motor:

1. Crear `web/src/cine/motor.ts` con actores, `posar`, `orientar`, `ruta`, chispas,
   rayos, estallidos, rótulos, puerta de audio, grano y control de teclas.
2. Dejar en cada cinemática sus datos: planos, rótulos, objetos, `planos`,
   `SONIDOS` y partitura.
3. Hacer que `tocarBanda` reciba la partitura como parámetro.
4. Comprobar que la historia actual sigue igual antes de empezar la nueva.

Antes de escribir código, acuerda el guion plano a plano. Además, los diseños deben
ser siempre originales: PokéBonk y Megabonk son solo referencia de género.
