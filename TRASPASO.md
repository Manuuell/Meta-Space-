# Traspaso — Meta Space

Estado a 04/11/2026.

---

## El Dragón del Velo llega solo (04/11/2026)

- Ya no hay que ganar dos duelos: llega en el minuto `DRAGON.minuto` (6) de toda
  partida, o al pulsar lanzar si vas antes. Ese primer intento se cancela y la nave
  queda lista para el segundo (`abrirAstilleroPartida` y `llegaDragon` en `game.ts`).
- Si no tienes el Cañón solar, ADA te lo da. Los duelos ahora solo lo suben de nivel
  y dan premios. El equilibrio de esta pelea para todo jugador está por probar.

## Forja de héroes (04/11/2026)

Escribes cómo quieres a tu héroe y entra en la partida como personaje 3D. Se abre con
Operador (C) en el menú, y también desde «Crear mi héroe» en el selector.

| Archivo | Qué contiene |
|---|---|
| `web/src/heroe3d/receta.ts` | Catálogo, esquema para Muse Spark, validación y receta local sin IA. Para añadir una pieza, se empieza aquí. |
| `web/src/heroe3d/montar.ts` | Construye el modelo 3D de una receta, con el kit y los nodos y clips de los operadores. |
| `web/src/heroe3d/ficha.ts` | Lo que es el héroe para el juego: el oficio de un operador más el ajuste de su silueta. |
| `web/src/heroe3d/ejemplos.ts` | Doce recetas reales de Muse Spark: son las muestras de la forja. |
| `web/src/ui-forja.ts` | El menú, con el estilo del astillero (reutiliza `ui-astillero.css`). |
| `web/src/modelos/hangar.ts` | Cielo y plataforma que comparten forja y astillero. |
| `web/test/heroe.test.ts` | Cada pieza en cada silueta y mil combinaciones al azar: nodos, clips, geometría y presupuesto. |

Un héroe usa el `id` del operador de su oficio, así que el juego le da arma, habilidad y
pasiva sin más; solo cambia el modelo (`recetaHeroe` en `game.ts`). Se guarda en
`save.heroe` con su retrato, una foto del modelo. La ruta es `/api/heroe-receta`: tras
tocar `receta.ts` hay que reiniciar el servidor, que lo carga al arrancar.

`/heroes.html` (solo desarrollo) enseña hojas de revisión: `?hoja=1`, `?hoja=1&comparar=1`
frente a los operadores y `?hoja=1&catalogo=pelo,tocado` para ver cada pieza. Antes de dar
por buena una pieza nueva hay que mirarla: las pruebas no ven que un afro tape la cara.
El creador 2D sigue en el perfil (P), que es lo que usa Muse Image y la visión.

---

## Primera partida de prueba (04/11/2026)

- **Jefes:** antes tenían vida fija. Ahora `escalaJefe(tiempo, nivel)` en
  `web/src/progression.ts` les sube vida, daño y ritmo según cuándo despierten y el
  nivel del jugador, y la vida se dispara desde el nivel 20. Vale para gólems,
  campeones, minijefes y dragón. El daño real contra un jefe, medido con tarjetas al
  azar y sin objetos, fue de 300 por segundo a nivel 10, 480 a nivel 20 y 780 a nivel
  25. Los números hay que afinarlos jugando: se tocan solo ahí.
- **Rayos:** la Lanza solar sumaba una sacudida por rayo y la cámara no paraba. Lo
  que hace el propio jugador usa `sacudidaArma`, que no se acumula.
- **HUD:** el objetivo va dentro de `.h2-ventana`, en flujo, y ya no lo tapan ni el
  rótulo de la misión, que dura 5 s, ni la barra del jefe. Las marcas de jefe llevan
  el nombre corto porque están a 64 px: el completo sale al pasar el ratón.

---

## El ratón solo sale en el menú de Esc (04/11/2026)

Cada captura del ratón hace que Safari saque su tira de «pulsa Esc», que ninguna
página puede quitar, y mientras se ve la primera Esc solo sirve para cerrarla. Antes
se soltaba y recapturaba en cada tarjeta. Ahora, en tarjetas y mapa, sigue capturado
y mueve un cursor dibujado por el juego (`abrirCursor` en `web/src/input.ts`), que
entrega clics, arrastres y rueda a lo que tenga debajo. Las tarjetas se eligen con
ese cursor o con 1, 2 y 3. Esc con el mapa abierto lo cierra y abre la pausa.

El ratón real aún sale en la pausa, el chat, el astillero y los resultados. Un
navegador automatizado puede no conceder la captura: para probarlo hay que simular
`document.pointerLockElement`. La IA solo responde desde los orígenes de `ORIGENES`
(`creator-server.ts`): el 5173, el 4173 o el propio 8787; en otro puerto da 403.

---

## La intro ya suena (04/11/2026)

La primera animación (`web/src/intro.ts`) tiene banda propia (`componerIntro` en
`musica.ts`), las letras tocan el tema de Meta y el motor de la nave sigue lo que se
ve. El navegador no deja sonar nada sin un gesto: la intro arranca sola y el sonido
entra con el primer clic o tecla, donde vaya la imagen. Sin gesto se ve muda hasta el
título. Un botón «Empezar» lo evitaba, y se quitó porque no debe haber ninguno.
Detalles y cómo medirlo sin oírlo en [cinematicas.md](cinematicas.md), «Música y
sonido».

---

## Cada partida, un sector distinto (04/11/2026)

Antes el mapa salía siempre con la semilla 2026 y los objetos solo subían números.
Ahora una semilla genera un sector entero, y los objetos cambian lo que hacen las
armas.

| Archivo | Qué contiene |
|---|---|
| `web/src/planetas.ts` | Biomas, climas, reglas, fauna y reparto. `generarPlaneta(semilla)` es puro y determinista. Para añadir un bioma, se añade aquí. |
| `web/test/planetas.test.ts` | Variedad en 400 semillas, que nada pise la salida ni la plataforma, colores válidos. |
| `web/src/ui-escaner.ts` | El escáner orbital: tres destinos para elegir, con el globo pintado píxel a píxel. |
| `web/src/objetos.ts` | 80 objetos y 12 módulos, el botín por rareza y afinidad y lo que cobra el mercader. |
| `web/test/objetos.test.ts` | Que no se repitan, que cada arma tenga los suyos, que el sector se note en el botín. |
| `web/src/arsenal.ts` | Lo que hacen los objetos en juego: estados, reacciones al matar y al recibir daño, rastros. |
| `web/src/modulos.ts` | Las habilidades activas de las teclas G y C. |

`World.generar(planeta)` y `ContenidoJuego.reconstruir(planeta)` lo levantan todo de
nuevo al aterrizar (unos 360 ms). Los lagos llevan el fluido del bioma: `acidoEn`
sigue dando la profundidad, y lo que hace daño o frena sale de `world.fluido`.

Para probar un sector concreto: `?semilla=123`, `?bioma=ceniza&clima=ventisca&regla=marea`
(baja directo, sin escáner). Hay cuatro especies nuevas en `enemies-nuevos.ts`:
acechador, bombardero, coloso y espectro. Cada sector trae solo algunas.

El mercader usa el modelo del chatarrero con un nombre distinto en cada sector
(ver `VIAJEROS`), para no chocar con Bruno. Las reacciones de los objetos no provocan
otras: `enReaccion` lo corta. El equilibrio de todo esto está sin medir con jugadores.

---

## Armar tu nave (04/11/2026)

El objetivo ya no es aguantar matando: es explorar, recuperar restos, armar una
nave y lanzarla antes de diez minutos. Hubo un primer intento con un cohete vertical
de acero; se descartó por una nave retrofuturista de carreras, de diseño propio.

| Archivo | Qué contiene |
|---|---|
| `web/src/nave/piezas.ts` | Piezas, física, qué decide cada fallo y el hangar. Para equilibrar, se toca aquí. |
| `web/test/nave.test.ts` | Comprueba que hace falta explorar y que hay varias naves que vuelan. Con cuatro fragmentos justos se vuela. |
| `web/src/modelos/nave-modular.ts` | La nave 3D por ranuras, con pintura y cromo (`MeshStandard`), y `fusionarNave` para hornearla. |
| `web/test/nave-modelo.test.ts` | Que cada pieza monta, cuántas toberas hay, el presupuesto de triángulos y que hornear no da la vuelta a las caras. |
| `web/src/modelos/plataforma.ts` | El disco de lanzamiento y la torre de servicio. |
| `web/src/modelos/fragmento.ts` | Los restos del mapa, con su haz de luz. |
| `web/src/ui-astillero.ts` | El astillero, desde el menú (B) o en la plataforma (F). La nave ocupa la pantalla; cada pieza se prueba antes de pagarla. |
| `web/astillero.html` | Solo en desarrollo: abre el astillero sin jugar. `?nave=media` o `?nave=tope` para ver piezas ya fabricadas. |
| `web/src/lanzamiento.ts` | El vuelo con telemetría: chorros, tren, de morro, motores, suelta los tanques. Cada fallo tiene su momento. |

Los restos son 12 (dos por ranura), cambian de sitio cada partida y nunca caen en
ácido. Fabricar gasta fragmentos y chatarra (primero la de la partida, luego la del
banco). Los jefes de altar ya no salen solos: despiertan si te acercas.

La nave es lo único del juego con materiales físicos: por eso la escena lleva un
mapa de entorno (`crearEntorno`), que no afecta a los materiales toon. En el mapa va
horneada, 11 mallas y unos 18.000 triángulos, y cuesta un 3 % de lo que se dibuja.
La plataforma se pisa (`heightAt`) y `lugarLibre` no coloca nada encima. Los `id` de
las piezas siguen siendo los del cohete (`tanque-largo`, `aleta-rejilla`…) porque
están en las partidas guardadas: se pueden renombrar los textos, no los `id`.

---

## Conversaciones con IA (03/11/2026)

Manteniendo V se habla en voz alta, sin parar la partida, con Iris, Tali o Lis si
están cerca y, si no, con ADA, que conoce todo el mapa. Meta transcribe en 1-2 s,
responde con `muse-spark-1.2` (más rápido que el 1.3) y la voz arranca con la
primera frase completa. T abre la ventana de texto, en pausa, por si no hay
micrófono. Ambas comparten el historial de la partida.

| Archivo | Qué contiene |
|---|---|
| `web/src/contenido/fichas.ts` | Quién es cada uno y cómo suena, incluidas las seis mascotas. Para cambiar a un personaje, se toca aquí. |
| `web/src/conversacion.ts` | Prompt, esquema, validación, resumen del mapa y respaldo local. |
| `web/creator-server.ts` | `/api/npc-turno`: API `/v1/responses` en streaming, sin guardar nada. |
| `web/src/charlas.ts` y `ui-chat.ts` | Turnos, historial de la partida y ventana. |
| `web/src/voz.ts` | Micrófono (se queda abierto durante la partida) y voz del navegador. |
| `web/src/locutor.ts` | Cola de frases: las pide al servidor y las reproduce en orden. |
| `web/src/game.ts` | `datosCharla` (lo que sabe) y `aplicarTurno` (valida y aplica). |

Regla: el modelo elige, el juego decide. Una acción nueva se añade como
intención con efecto y `descripcion` en `contenido/mapa.ts`.

Trampa: el razonamiento del modelo cuenta dentro de `max_tokens`. Con 200, se lo
comía entero y la respuesta llegaba vacía, sin error (`META_MAX_TOKENS`).

La API de Meta aún no tiene voz de salida. Las voces son Supertonic 2 en el
servidor (`voces-servidor.ts`, `/api/voz`): `npm run voces` baja el modelo a
`web/.voces`, fuera de git, con la versión y las huellas fijadas. La voz y el
ritmo de cada personaje se cambian en `voz` de `fichas.ts`. Sin modelo o sin
`onnxruntime-node`, habla el navegador (`mejoresVoces`).

El modelo aprendió español con rasgos rioplatenses. `sinSheismo` (`habla.ts`)
escribe la ll y la y como i antes de generar la voz, pero la entonación no se
puede cambiar sin cambiar de modelo.

Licencia OpenRAIL-M: hay que conservar `web/public/licencias`, el aviso del pie
del título y el de README.

Pendiente: memoria entre partidas y afinidad, encargos, HELIOS como director de
la horda, un filtro de moderación y un aviso de edad antes de publicar: los
términos de Meta exigen 18 años.

**Estado al cerrar este chat:** todo lo anterior está en `main`, con el punto de
restauración `v0.3.0-restauracion`. Falta confirmar si las voces ya suenan neutras:
la última versión quitó el sonido parecido a «sh», pero la entonación no cambia. Si
siguen sonando argentinas, las opciones son un servicio de pago o probar Supertonic
3. `npm run voces` se ejecuta una vez en cada máquina para bajar el modelo.

---

## Cinemática de la historia (03/11/2026)

Al abrir el juego salen la intro con el nombre de META SPACE, la historia de Meta
y Ares (83 s, 13 planos, contada por ADA y con música sintetizada) y el menú.

Cómo hacer más cinemáticas, con la receta y las trampas conocidas:
[cinematicas.md](cinematicas.md).

---

## Meta Space para el hackathon (01/11/2026)

**Trama nueva: salvar el planeta Meta.** Meta se congela bajo el velo de
sulfatos de HELIOS, la IA climática que nadie sabe apagar. ADA (el módulo de
auditoría 7) es la única que puede firmar el apagado. Cada partida es un
sector: si armas tu nave y la lanzas antes de 10 minutos, sube la orden y vuelve el sol a
ese sector. Las 7 reliquias son las pruebas de la auditoría que apaga el velo
de todo el planeta. Detalle en [lore-y-mecanicas.md](lore-y-mecanicas.md); la
trama que recibe la IA vive en `web/src/guion.ts`.

**El juego se publica como web con dominio propio.** `creator-server.ts` sirve
el juego compilado y la API de IA en el mismo origen, así que basta un proceso:

```bash
cd web
npm run build
MODEL_API_KEY=... npm start      # o la clave en web/.env.local
```

Para el jurado, desplegar `web/` en cualquier hosting de Node 22.18+ (Render,
Railway, Fly, un VPS) con `npm ci && npm run build` y `npm start`. Variables en
`web/.env.example`. La clave nunca llega al navegador; el servidor limita
peticiones por IP, solo acepta llamadas del propio dominio y tiene un cupo
diario (`AI_DAILY_LIMIT`). Sin clave o con el cupo agotado, todo responde con el
guion local. También funciona como web estática (GitHub Pages, itch.io), pero
entonces sin IA.

En desarrollo: `npm run dev` y, en otra terminal, `npm run serve` (Vite reenvía
`/api` al puerto 8787).

---

## Antes (21/10/2026)

---

## ⚠ Cambio de rumbo (29/10/2026): survivors-like web en Three.js

El juego pasa a ser un **survivors-like** (la fórmula de Megabonk / PokéBonk):
partidas de 10 minutos contra hordas, herramientas que se disparan solas,
mejoras al subir de nivel y una pantalla de resultados con desglose y Códice.
Se hace **en el navegador con Vite + TypeScript + Three.js**, en `web/`, con
**cámara en tercera persona como PokéBonk** (decidido el 29/10, sustituye a la
cenital): detrás del astronauta, ratón para girar (clic captura el puntero;
Q/E y arrastrar también giran), W avanza hacia donde se mira. El astronauta es
un sprite en píxeles que se ve de espaldas, con ADA brillando en la mochila.

**Por qué encaja con el reto**: la partida da la acción; la chatarra y las
reliquias que se ganan alimentan el banco de trabajo (diseñar la misión con
recursos limitados), y cada reliquia enseña un dato real de la NASA.

**Lo de Unity queda como referencia**, no se borra: el catálogo de piezas, el
equilibrio de presupuestos y `MissionOutcome` hay que portarlos a TypeScript.

### Qué hay en `web/` (jugado y verificado en el navegador)

- Mapa de 180 × 180 m sobre un terreno con lomas (alturas precalculadas en
  una cuadrícula de 1 m) y colinas en el borde que cierran el mapa. Cielo con
  degradado, sol bajo, nubes en píxeles y la ciudad muerta como silueta.
  Decorado en billboards de píxeles: árboles muertos, rocas, matorrales y
  farolas. Ruinas que bloquean y la plataforma con el cohete al norte.
- HUD como PokéBonk: retrato con nivel, reloj central, minimapa que gira con la
  cámara, vida bajo los pies y herramientas en casillas.
- Tres unidades de HELIOS del lore: **Recolector** (persigue), **Baliza** (no
  ataca, pero cada una viva sube la aparición un 15 %) y **Segador** (enorme,
  a partir del minuto 2, suelta reliquias).
- Cuatro herramientas, porque el astronauta no es un soldado: cortador de
  plasma, pulso EMP de ADA, dron de mantenimiento y campo de interferencia.
  Seis pasivas. Todo el diseño está en `src/data.ts`.
- Las 7 reliquias del documento de diseño, cada una con su dato real.
- Resultados con la estructura de PokéBonk: registro y récords, daño por
  herramienta, bajas por unidad y reliquias. Progreso en localStorage.
- Build de producción: **600 KB (154 KB gzip)**, frente a 70 MB de Unity.

### Herramientas de desarrollo

```bash
cd ~/Developer/"Meta Space"/web
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # comprueba tipos y deja el juego en web/dist
```

En la consola del navegador (solo en `dev`): `await balance(5)` juega cinco
partidas con un bot que huye, recoge chatarra y elige mejoras al azar, y
resume cuánto aguanta. `game.simulate(segundos)` adelanta la partida.

**Trampa**: con el panel del navegador oculto, `requestAnimationFrame` se
congela y la partida no avanza; las capturas salen viejas. Usar `simulate`.

### Equilibrio actual, medido con el bot

Media de unos 4,5 minutos; gana 1 de cada 6 partidas eligiendo al azar. Pendiente:
probarlo con personas. Visto en una prueba: con el cortador a nivel 6 hace el
96 % del daño porque mata a distancia antes de que nada llegue a las armas de
corto alcance; puede que haya que frenar su escalado.

### Siguientes pasos de la versión web

1. **Banco de trabajo en web**: portar las 20 piezas y los presupuestos;
   gastar la chatarra del banco y usar las piezas que desbloquean las reliquias.
2. **Lanzamiento**: cuando la nave sea viable, simular el ascenso y resolver
   el final con la lógica de `MissionOutcome`.
3. Mejoras permanentes entre partidas (que la chatarra también haga más fuerte
   al astronauta), y que el Segador o el cohete den un objetivo en el mapa.
4. Probar en móvil: el joystick táctil está hecho, pero no verificado.
5. Publicar el build (GitHub Pages o itch.io).

---

## Qué es esto

Juego para un reto tipo NASA Space Apps: **diseñar, gestionar y simular una
misión espacial completa**, tomando decisiones de ingeniería con recursos
limitados y evaluando cómo cada elección da forma al éxito.

El envoltorio narrativo es **Módulo 7**: un astronauta despierta en un planeta
desolado de cielo rojo. Encuentra en la arena un núcleo de IA —ADA— que resulta
ser un módulo de auditoría arrancado de HELIOS, el sistema de geoingeniería que
sigue enfriando un mundo vacío siglos después de que no quede nadie. HELIOS
envía Recolectores a recuperarla. El planeta es la Tierra en el futuro.

El lore completo, las mecánicas y los cinco finales están en
[lore-y-mecanicas.md](lore-y-mecanicas.md). Los nombres candidatos, en
[nombres.md](nombres.md).

**El plazo de entrega sigue sin estar definido.** Se preguntó varias veces sin
respuesta; se asumió hackathon corto y se construyó en orden de prioridad.

---

## Dónde está todo

Proyecto en `~/Developer/Meta Space`. Unity **6000.0.85f1 LTS**, modo 2D, módulos
WebGL y Mac IL2CPP. Licencia **Unity Student** (válida hasta 24/10/2027, incluye
Pro: sin marca de agua ni pantalla de carga).

Se movió fuera de iCloud Drive a propósito: Unity regenera `Library/`
constantemente y la sincronización corrompe la caché de assets.

```
Assets/_Project/Scripts/Mission/   lógica de misión (no sabe de 2D ni 3D)
Assets/_Project/Scripts/UI/        banco de trabajo y diálogo
Assets/_Project/Scripts/World/     planeta 2D y primera persona 3D
Assets/_Project/Data/              20 piezas y 8 reliquias (ScriptableObjects)
Assets/_Project/Resources/         Catalog.asset, el índice que carga en runtime
Assets/_Project/Scenes/            Planeta, Workbench, SectorDelta
Assets/Editor/                     generadores de catálogo, escenas y builds
```

---

## Qué funciona, y qué está sin verificar

### Verificado jugándolo en WebGL

**Escena Planeta (2D)** — escena inicial. Arte generado por código: cielo en
degradado, cuatro capas de ruinas con parallax y semilla fija, suelo con borde
iluminado, polvo. Astronauta de 28×40 px, A/D para caminar, espacio para saltar.
ADA late en la arena, se recoge con E y arranca su diálogo escrito letra a letra.

**Escena Workbench (2D)** — catálogo por ranura con descripciones, nave montada,
presupuestos en vivo (masa, potencia, chatarra, delta-v, empuje/peso, fiabilidad,
ciencia enviable), panel de ADA con los bloqueos, y botón de lanzar que resuelve
el diseño a su final con el informe de qué decisión lo causó. Probado pulsando:
montar, quitar y lanzar funcionan.

**Equilibrio del catálogo** — medido con naves de referencia reales
(`Meta Space > Comprobar equilibrio`). Tres rutas viables y tres trampas:

```
A  · Mínima para escapar     4036 / 3900 m/s   VUELA
B  · Criogénica con RTG      5201 / 3900 m/s   déficit de 115 W
B2 · Criogénica solar         4800 / 3900 m/s   VUELA ← Final B
C  · Científica completa     5043 / 3900 m/s   125 de chatarra y 165 W de más
D  · Jardinero                   0 / 3900 m/s   sin motor, por diseño
E  · Barata, tres tanques    3169 / 3900 m/s   faltan 731 m/s
E2 · Barata, seis tanques    3917 / 3900 m/s   VUELA
```

Límites calibrados: **3200 kg, 620 de chatarra, 3900 m/s**. Si se tocan las
piezas hay que volver a pasar la comprobación: el equilibrio depende del
catálogo entero, no de cada pieza.

### Sector Delta (3D), visto en WebGL el 22/10/2026

Avenida de 120 m con tres carriles (15 m de calzada), aceras a ambos lados,
edificios encadenados a ras de acera sin solaparse, coches cruzados, sol rasante
y niebla roja. El cielo es el propio color de la niebla: el skybox procedural
salía verde y se eliminó. El jugador camina, no atraviesa el suelo y choca con
coches y edificios (el constructor pone sus propias cajas de colisión y topes en
los bordes). Se prueba sola con `BuildScript.WebGLSector` → `Builds/WebGL-Sector`.

**Temática espacial**, generada con primitivas porque Synty no trae nada
espacial: la cápsula del jugador estrellada al inicio (cráter, rastro,
paracaídas, escombros, baliza ámbar), antenas de HELIOS en las azoteas altas,
un Recolector que patrulla sobre la avenida (`RecolectorDrone`, sin
persecución todavía) y, al final, una explanada con plataforma, torre de
servicio con luces de aviso y un cohete de dos etapas de ~48 m. El cohete se
ve desde la cápsula: es el objetivo visual del sector. Los materiales viven en
`Assets/_Project/Settings` y el constructor los actualiza al regenerar.

Pendiente de arte: los coches y fachadas están demasiado limpios para una ciudad
abandonada hace siglos. Las zonas en sombra quedaron oscuras al quitar los
reflejos de entorno; si molesta, subir la luz ambiental.

---

## Lo que hay que saber antes de tocar nada

Estas son las trampas que costaron tiempo. Todas compilaban sin un solo error.

**El Input System.** El proyecto tiene el paquete instalado y
`activeInputHandler: 2`. Con eso, `StandaloneInputModule` **entrega la rueda del
ratón pero no los clics**, sin avisar: la lista se desplaza, nada responde y no
hay error. Las escenas usan `InputSystemUIInputModule`. En código, leer el
teclado con `Keyboard.current`, nunca con `UnityEngine.Input`.

**Awake corre antes de que existan los hijos.** Si un `GameObject` se crea ya
con su componente puesto, `Awake` se ejecuta en ese instante, antes de que la
escena le cuelgue nada. Buscar hijos ahí devuelve null, y los `if (x != null)`
convierten el fallo en silencio absoluto. Buscar en `Start`.

**Píxeles de textura no son unidades de mundo.** Mordió tres veces seguidas: el
cielo de 4 px escalado por 60 salía como una franja de 2,4 unidades; una capa de
primer plano de 160 px tapaba todo el encuadre; el suelo dejaba ver el cielo por
debajo. Medir desde la cámara o desde el propio sprite, nunca a ojo. El
constructor del Sector Delta ya mide cada prefab antes de colocarlo.

**Synty pone el pivote en una esquina, no en el centro.** La carretera de 5 m
ocupa x∈[−5,0]. Colocar por la posición del prefab deja huecos y solapes. El
constructor del Sector Delta coloca cada pieza por sus límites ya girados
(`PlaceAt`); usar eso para cualquier pieza nueva.

**Sin skybox, los reflejos caen al cielo azul por defecto.** El material
Standard en ángulo rasante pintaba una franja gris azulada en el horizonte. El
Sector Delta pone `reflectionIntensity = 0`.

**Destroy no borra hasta el final del fotograma.** Las filas destruidas seguían
contando para la maquetación, la lista se duplicaba un instante y los clics
seguidos caían en vacío. Desvincular con `SetParent(null)` antes de destruir.

**Los grupos de maquetación de UGUI se equivocan en silencio.** El armazón del
banco de trabajo usa anclajes explícitos por eso. Los grupos solo se usan dentro
de las listas, donde sí funcionan.

**El editor abierto bloquea el proyecto.** Ningún comando en batchmode funciona
mientras Unity esté abierto. Hay que cerrarlo antes de generar escenas o compilar.

**Compilar no demuestra nada.** Los tres fallos peores del proyecto —clics
muertos, maquetación rota, ADA fantasma— compilaban limpio. Verificar abriendo
el navegador y pulsando.

---

## Assets de pago, fuera del repositorio

**Odin Inspector** y **Synty Studios** están en `.gitignore`: licencias
educativas personales, no redistribuibles, y el proyecto acabará público.
Quien clone tiene que importarlos por su cuenta o las escenas saldrán vacías.

Odin trae `OdinUpgrader.cs` fuera de una carpeta `Editor` pese a ser código de
editor: **con él, el proyecto no genera ninguna build**, ni macOS ni WebGL, y el
editor no da síntoma. La corrección está automatizada en
`ProjectBootstrap.FixOdinPackaging()`, que lo mueve solo. Hay que ejecutar el
bootstrap tras importar Odin.

Del paquete de Synty solo sirve **PolygonCity** (344 prefabs: oficinas,
apartamentos, tiendas, carreteras, aceras, puentes, depósitos de agua y coches
abandonados). Lo demás es medieval, aventura y props de fiesta. **No hay nada
espacial**: ni cohetes, ni antenas, ni tanques, ni astronautas. Por eso se
descartó hacer la plataforma de lanzamiento en 3D.

---

## Comandos

```bash
U="/Applications/Unity/Hub/Editor/6000.0.85f1/Unity.app/Contents/MacOS/Unity"
P="$HOME/Developer/Meta Space"

# Regenerar catálogo y comprobar equilibrio
"$U" -batchmode -quit -nographics -projectPath "$P" \
  -executeMethod MetaSpace.EditorTools.PartCatalogBuilder.Run -logFile -
"$U" -batchmode -quit -nographics -projectPath "$P" \
  -executeMethod MetaSpace.EditorTools.CatalogSanityCheck.Run -logFile -

# Regenerar escenas
"$U" -batchmode -quit -nographics -projectPath "$P" \
  -executeMethod MetaSpace.EditorTools.PlanetSceneBuilder.Run -logFile -
"$U" -batchmode -quit -nographics -projectPath "$P" \
  -executeMethod MetaSpace.EditorTools.DeadCitySceneBuilder.Run -logFile -

# Compilar (WebGL tarda unos 100 s; sin comprimir para que abra en cualquier servidor)
"$U" -batchmode -quit -nographics -projectPath "$P" -buildTarget WebGL \
  -executeMethod MetaSpace.EditorTools.BuildScript.WebGL -logFile -

# Servir y abrir
cd "$P/Builds/WebGL" && python3 -m http.server 8123 --bind 127.0.0.1
```

Para probar movimiento en el navegador, los clics y toques de teclado
automatizados se pierden: hay que mantener la tecla enviando los eventos a mano.

```js
const c = document.querySelector('canvas'); c.focus();
const k = (t,key,code,kc) => { const e = new KeyboardEvent(t,{key,code,keyCode:kc,which:kc,bubbles:true}); c.dispatchEvent(e); document.dispatchEvent(e); };
k('keydown','d','KeyD',68); await new Promise(r=>setTimeout(r,3000)); k('keyup','d','KeyD',68);
```

---

## Siguientes pasos, por orden

1. **Conectar las dos escenas 2D**: hoy Planeta y Workbench no se hablan. Hace
   falta que recoger a ADA y escanear reliquias desbloquee piezas de verdad, y
   que el banco se abra desde el mundo en vez de ser una escena suelta.
2. **Escaneo de reliquias**: el minijuego, el Códice y la mecánica de Exposición,
   que es la tensión del juego y todavía no existe.
3. **Simulación de lanzamiento**: el ascenso por fases con la telemetría del
   propio diseño. Cierra el clímax; `MissionOutcome` ya resuelve el final.
4. Decidir si el Sector Delta se queda como pieza aparte o se integra.

---

## Commits

```
26eb45d  Sector Delta: primera pasada de la ciudad muerta en 3D
daba7b0  Escena del planeta: mundo, astronauta y el encuentro con ADA
9e097e4  Banco de trabajo funcionando: clics, descripciones, bloqueos y lanzamiento
d10ab9f  Banco de trabajo: catálogo, nave y presupuestos en vivo
39aee33  Catalogo de piezas y reliquias, calibrado contra el modelo
d535ed0  Odin Inspector importado y excluido del repositorio
8df7d4d  Proyecto Unity 2D con estructura y paquetes base
19c6e15  Diseño del juego y núcleo de sistemas de misión
```
