# Traspaso — Meta Space

Estado a 03/11/2026. Pega este archivo al abrir el chat nuevo.

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
sector: si aguantas los 10 minutos, el cohete sube la orden y vuelve el sol a
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
