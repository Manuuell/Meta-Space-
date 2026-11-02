# Personajes jugables de Meta Space

Cinco personajes nuevos, cada uno con su **arma inicial propia**, una
**habilidad característica** (tecla R) y una **pasiva**. Son los cinco
operadores que ya tienen retrato en el menú de perfil
(`web/public/art/profiles/`); Sol Vega sigue siendo la voz de la radio.

Este documento tiene tres partes:

1. [Cómo se hacen los personajes](#1-cómo-se-hacen-los-personajes) en este proyecto.
2. [Lo necesario para meterlos en el juego](#2-lo-necesario-para-meterlos-en-el-juego): archivos y piezas.
3. [Los prompts](#3-prompts): uno para el sistema (va primero) y uno por personaje.

---

## 1. Cómo se hacen los personajes

En Meta Space **no hay archivos 3D importados**: cada modelo es código
TypeScript que monta piezas simples y define sus animaciones. Así pesan muy
poco, se ven todos de la misma familia y las pruebas pueden revisarlos en Node.

- **Dónde:** un archivo por personaje en `web/src/modelos/` (el taller
  [modelado-personajes](https://github.com/Manuuell/modelado-personajes) usa el
  mismo `kit.ts`, así que se pueden hacer allí y copiarlos).
- **Con qué:** los ayudantes de `web/src/modelos/kit.ts`:
  - Piezas: `nodo`, `pieza`, `barra`, `ojo` y las formas `caja`, `esfera`, `capsula`, `barril`, `toro`, `cono` y `punta`.
  - Materiales: `toon(color)` (sombreado de 3 tonos), `brillo(color)` (sin sombra, para luces) y el contorno oscuro, que `pieza` pone solo.
  - Colores: la `PALETA` del juego.
- **Que brille:** `web/src/modelos/brillo.ts` genera texturas en píxeles con
  líneas que se iluminan (`placas()`, `roca()`, `materialBrillante()`) y
  resplandores (`halo()`). Es lo que hace que los jefes alumbren.
- **Animaciones:** clips con `animacion(nombre, duracion, pistas)`. Las pistas
  se hacen con `rot`, `mov` y `esc`, y se muestrean con `ciclo` (bucles que
  cierran solos) o `poses` (claves sueltas).
- **Registro:** cada modelo se añade a `CATALOGO` en `web/src/modelos/index.ts`
  con su `tipo` (`jugador` para estos).
- **Pruebas automáticas** (`web/test/modelos.test.ts`): comprueban que los
  nombres de nodo no se repiten, que los clips duran 4 s como mucho, que los
  bucles cierran sin salto, el presupuesto de triángulos (30 000 para `jugador`)
  y que el modelo se hornea sin valores raros.
- **Verlo:** con `npm run dev`, en `/modelos.html` (botones por clip,
  velocidades y descarga GLB) y en `/referencias.html?modelo=<id>&vista=hoja`
  (frente, lado, espalda y 3/4).

### El esqueleto del jugador

El juego anima al jugador por **nombre de nodo y de clip**, y le cuelga el
equipo (mochila cohete y botas) de nodos concretos. Para que un personaje
nuevo funcione con todo lo que ya hay, tiene que usar **el mismo esqueleto que
`web/src/modelos/astronauta.ts`**, a la misma altura (2,6 m) y mirando hacia +z:

| Nodo | Para qué |
|---|---|
| `cuerpo` → `cadera` → `pecho` → `cabeza` | Tronco y cabeza; la mochila cohete cuelga de `pecho` |
| `hombro_i`, `hombro_d` | Brazos (sin codo) |
| `pierna_i`, `pierna_d` | Piernas; las botas de impulso cuelgan de aquí: cadera a 0,85 m del suelo |
| `ada` | El orbe de ADA en la espalda (late en `Reposo` y `Esprintar`) |
| `ojo_i`, `ojo_d` | Los ojos del visor (parpadean) |
| `antena` | Pieza móvil con retraso (opcional, pero se nota) |

Clips que el juego llama por su nombre: `Reposo`, `Caminar`, `Correr`,
`Esprintar`, `Saltar`, `Surfear`, `Volar`, `Impulso`, `Golpe recibido`,
`Victoria` y `Derrota`. Los personajes nuevos añaden **`Habilidad`** (una vez,
≤ 1,2 s) para cuando se usa la R.

---

## 2. Lo necesario para meterlos en el juego

| Pieza | Archivo | Qué hay que hacer |
|---|---|---|
| Datos de personaje | `web/src/personajes.ts` (nuevo, datos puros) | Id, nombre, rol, retrato, color, modelo, estadísticas, arma inicial, habilidad y pasiva |
| Modelo | `web/src/modelos/<id>.ts` + `index.ts` | El esqueleto de arriba, sus clips y el clip `Habilidad` |
| Arma inicial | `web/src/data.ts` (`WEAPONS`, `WeaponId`, `SINERGIAS`), `web/src/progression.ts` (`WeaponId`, `OBJETIVOS_POR_ARMA`, `TOPE_MULTITUD`), `web/src/weapons.ts` (su `case` en `fire()` y sus efectos), `web/src/iconos.ts` (icono 64 × 64), `web/src/hud.ts` (`HERRAMIENTAS`) | Seis niveles con su tabla; marcada como **exclusiva** de su personaje para que no salga a los demás al subir de nivel |
| Habilidad (R) | `web/src/habilidades.ts` (nuevo) | Una clase por habilidad con `usar()`, `update()` y `dispose()`, recarga y su clip |
| Pasiva | `web/src/game.ts` | Modificadores que se leen donde ya se leen las bendiciones (`totales`) |
| Selección | `web/src/ui-personaje.ts` + `.css` (nuevo), `web/src/ui-title.ts`, `web/src/save.ts` | Pantalla de elegir personaje desde el título y el elegido guardado en la partida |
| Partida | `web/src/game.ts` | Montar el modelo elegido en vez de `crearAstronauta()`, aplicar sus estadísticas, darle su arma y su habilidad |
| HUD | `web/src/hud.ts` / `hud.css` | Retrato del personaje en la ficha y casilla de la habilidad abajo a la izquierda, con anillo de recarga y la tecla R |
| Demo | `web/src/demo.ts` | Que el piloto use la habilidad cuando esté lista y haya un jefe cerca |
| Pruebas | `web/test/personajes.test.ts` (nuevo) | Ids únicos, cada personaje con modelo, arma y habilidad, y armas con 6 niveles |
| Texto | `web/src/ui-title.ts` («Cómo jugar») y `lore-y-mecanicas.md` | La tecla R y quién es cada uno |

Se hacen **uno detrás de otro**: todos tocan `data.ts`, `weapons.ts`,
`iconos.ts` y `personajes.ts`.

---

## 3. Prompts

Primero el **prompt del sistema**, en una sesión. Después, en el orden que
quieras, **un prompt por personaje**. Pega siempre antes el **bloque de reglas**.

### Bloque de reglas (pegar delante de cada prompt)

```
Trabajas en Meta Space, un survivors-like web en web/ (Vite + TypeScript +
Three.js). Trama: el planeta Meta se congela bajo el velo de sulfatos de
HELIOS; ADA es el módulo de auditoría que puede apagarlo. Todo el texto del
juego, los nombres y los comentarios van en español, con el mismo tono y la
misma densidad de comentarios que el código que lo rodea.

Reglas:
- Los modelos se construyen en código con web/src/modelos/kit.ts y
  web/src/modelos/brillo.ts (mira astronauta.ts, sabueso.ts y golem.ts).
  Nada de archivos 3D ni texturas descargadas.
- Diseños originales: nada que copie personajes de otros juegos.
- Datos puros en archivos sin THREE (como contenido/mapa.ts) para que los
  tests los carguen en Node. En archivos que cargan los tests, nada de
  propiedades en el constructor (Node las ejecuta sin compilar).
- Antes de terminar: `npx tsc --noEmit`, `npm test` y `npm run build` en web/
  sin errores, y mirarlo en el navegador (npm run dev): /modelos.html para el
  modelo y una partida para la habilidad y el arma.
- Commits sin líneas Co-Authored-By, sin "Generated with" ni ninguna marca de
  IA. No hagas commit si no te lo piden.
```

### Prompt 1 — Sistema de personajes (va primero)

```
Quiero que el jugador elija entre varios personajes antes de jugar. Cada uno
tiene un modelo propio, estadísticas, un arma inicial exclusiva, una
habilidad característica en la tecla R y una pasiva. En este paso monta el
sistema y deja el personaje actual (el Especialista de ARES-IX, astronauta.ts)
como el primero de la lista, con su cortador y sin habilidad nueva, para que
todo siga funcionando igual. Los cinco personajes nuevos vendrán después,
uno por uno.

1. web/src/personajes.ts (datos puros): PersonajeId, y PersonajeDef con id,
   nombre, rol, retrato (/art/profiles/<id>.webp), color de acento, stats
   { maxHp, speed, damageMul, cooldownMul } (como HeroTuning en
   creator/player-contract.ts), armaInicial: WeaponId, habilidad
   { id, nombre, texto, recarga } y pasiva { id, nombre, texto }. El modelo
   se elige en game.ts con un mapa id → crear*().

2. Armas exclusivas: añade `exclusiva?: PersonajeId` a WeaponDef (data.ts) y
   haz que la tirada de mejoras (progression.ts, `piscina`) no ofrezca las
   armas exclusivas de otros personajes. Pásale el personaje en DepsTirada.

3. web/src/habilidades.ts: un interfaz Habilidad { id, recarga, lista (0..1),
   usar(ctx), update(dt, ctx), dispose() } y un ContextoHabilidad con lo que
   necesitan (escena, mundo, enemigos, contenido.objetivoJefe para dañar
   jefes, posición y rumbo del jugador, yaw de la cámara, y avisos: alerta,
   sacudida de cámara, sfx y números de daño). game.ts la crea al empezar la
   partida según el personaje, la actualiza cada fotograma, la lanza con la
   tecla R (y un botón táctil como el de salto) y reproduce el clip
   `Habilidad` del modelo si existe.

4. HUD (hud.ts/hud.css): la ficha usa el retrato del personaje; abajo a la
   izquierda, una casilla redonda con el icono de la habilidad, su nombre,
   un anillo de recarga y una insignia «R».

5. Selección (ui-personaje.ts + css, al estilo de ui-companero.ts): tarjetas
   con retrato, nombre, rol, barras de vida/velocidad/daño/recarga, el arma
   inicial y la habilidad; se abre desde el título (un botón nuevo
   «Personaje», tecla J) y lo elegido se guarda en save.ts (`personaje`).

6. game.ts: en vez de `crearAstronauta()` fijo, monta el modelo del personaje
   elegido al empezar la partida (rehaciendo el mezclador, las acciones y el
   equipo de montarEquipo), aplica sus stats como applyCustomHero, le da su
   arma inicial en vez del cortador y su pasiva. El héroe del creador de
   personaje sigue funcionando como hasta ahora.

7. demo.ts: SalidaPiloto gana `habilidad: boolean`; el piloto la usa cuando
   está lista y hay un jefe a menos de 15 m.

8. web/test/personajes.test.ts: ids únicos, cada personaje con arma inicial
   que existe en WEAPONS (marcada exclusiva suya), habilidad con recarga > 0
   y retrato.

9. «Cómo jugar» (ui-title.ts): la tecla R.
```

### Prompt 2 — Mara Ilyin, ingeniera de sistemas

```
Añade a Mara Ilyin (id 'mara-ilyin'), ingeniera de sistemas. Juega a
desplegar: llena el campo de torretas y acelera todo el equipo.

Aspecto (web/src/modelos/mara.ts, esqueleto del astronauta, 2,6 m):
traje blanco con paneles violeta (#7566f5); casco con visor rectangular con
líneas de HUD encendidas (brillo cian) y unas gafas de soldar subidas en la
frente; mochila con una antena parabólica plegada y dos brazos-grúa pequeños
a los lados; una torreta en miniatura enganchada al cinturón. Clip
`Habilidad`: clava una rodilla, golpea el suelo con la palma y la antena se
despliega.

Stats: vida 95, velocidad 5,2, daño ×1,0, recarga ×0,92.

Arma inicial «Torreta de despliegue» (id 'torreta', exclusiva): cada recarga
deja una torreta en el suelo donde está Mara; dura 8 s y dispara al enemigo
más cercano en su alcance (o al jefe). count = torretas a la vez como mucho.
  Nv1  daño 8,  recarga 4,0 s, count 1, alcance 12 m, dispara cada 0,40 s
  Nv2  daño 9,  recarga 3,7 s, count 1, alcance 13 m, cada 0,36 s
  Nv3  daño 10, recarga 3,5 s, count 2, alcance 13 m, cada 0,36 s
  Nv4  daño 12, recarga 3,2 s, count 2, alcance 14 m, cada 0,33 s
  Nv5  daño 14, recarga 3,0 s, count 3, alcance 14 m, cada 0,32 s
  Nv6  daño 16, recarga 2,8 s, count 3, alcance 15 m, cada 0,30 s
Modelo de torreta: trípode bajo con cañón y luz violeta (en el mismo archivo
o en modelos/torreta.ts, tipo 'objeto').

Habilidad R «Sobrecarga de red» (recarga 25 s): durante 6 s todas sus
herramientas recargan un 40 % más rápido, las torretas disparan doble y se
despliega una torreta extra al instante. Anillo violeta que late a sus pies
mientras dura.

Pasiva «Presupuesto ajustado»: los cofres de HELIOS le cuestan un 20 % menos.
```

### Prompt 3 — Idris Okafor, mecánico de campo

```
Añade a Idris Okafor (id 'idris-okafor'), mecánico de campo. Es el tanque:
cuerpo a cuerpo, empujones y un muro de chatarra.

Aspecto (web/src/modelos/idris.ts, esqueleto del astronauta, 2,6 m, más
ancho de hombros): traje naranja (#ffad35) reforzado, hombreras de chapa
atornillada, casco con rejilla delante del visor, cinturón de herramientas,
guantes enormes y una llave de impacto gigante colgada a la espalda. Clip
`Habilidad`: levanta los dos brazos y golpea el suelo con los puños.

Stats: vida 140, velocidad 4,8, daño ×1,05, recarga ×1,05.

Arma inicial «Llave de impacto» (id 'martillo', exclusiva): golpe en arco de
100° delante de él, hacia donde camina; empuja fuerte. count = golpes por
descarga (el segundo, de vuelta, 0,15 s después).
  Nv1  daño 20, recarga 0,90 s, count 1, alcance 3,2 m
  Nv2  daño 24, recarga 0,85 s, count 1, alcance 3,4 m
  Nv3  daño 26, recarga 0,80 s, count 2, alcance 3,6 m
  Nv4  daño 32, recarga 0,75 s, count 2, alcance 3,9 m
  Nv5  daño 38, recarga 0,70 s, count 2, alcance 4,2 m
  Nv6  daño 44, recarga 0,60 s, count 2, alcance 4,6 m
Efecto: un arco de luz naranja que barre el suelo y chispas al golpear.

Habilidad R «Muro de chatarra» (recarga 22 s): levanta delante de él un muro
en semicírculo de 6 m de radio hecho de placas de chatarra que bloquea a la
horda durante 6 s (los enemigos no lo atraviesan: añádelo a World como
obstáculo temporal o empújalos fuera). Al acabar, el muro estalla y las
placas salen disparadas: 60 de daño a todo lo que haya a 4 m del muro.

Pasiva «Blindado»: recibe un 15 % menos de daño y los golpes de los jefes le
empujan la mitad.
```

### Prompt 4 — Noa Herrera, auditora de HELIOS

```
Añade a Noa Herrera (id 'noa-herrera'), auditora de HELIOS: conoce sus
máquinas por dentro. Frágil, pero marca a sus enemigos y los apaga.

Aspecto (web/src/modelos/noa.ts, esqueleto del astronauta, 2,6 m, más
esbelta): traje blanco con detalles magenta (#e151a5), una estola de datos
corta que cuelga de los hombros, visor con un monóculo de lente de auditoría
en el ojo derecho (brillo magenta con halo) y tres sellos hexagonales que
orbitan alrededor de su cintura (nodo propio que gira en `Reposo`, que cierra
el bucle). Una credencial de HELIOS tachada en el pecho. Clip `Habilidad`:
alza la mano y los tres sellos salen disparados hacia fuera.

Stats: vida 80, velocidad 5,4, daño ×1,2, recarga ×0,95.

Arma inicial «Sello de auditoría» (id 'sello', exclusiva): dispara sellos
que persiguen al enemigo más cercano (giran hacia él en vuelo) y lo marcan:
el marcado recibe un 20 % más de daño de todo durante 4 s (icono de sello
encima y tinte magenta). count = sellos por descarga.
  Nv1  daño 14, recarga 1,10 s, count 1, alcance 18 m
  Nv2  daño 16, recarga 1,00 s, count 1, alcance 19 m
  Nv3  daño 16, recarga 0,90 s, count 2, alcance 20 m
  Nv4  daño 20, recarga 0,80 s, count 2, alcance 20 m
  Nv5  daño 24, recarga 0,70 s, count 3, alcance 21 m
  Nv6  daño 30, recarga 0,60 s, count 3, alcance 22 m
La marca necesita un campo nuevo en Enemies (p. ej. `marca` en segundos) que
`hit()` tenga en cuenta.

Habilidad R «Orden de apagado» (recarga 28 s): onda magenta de 14 m que
aturde a todo HELIOS 2,5 s (no se mueven ni atacan; los jefes, 1 s) y hace
estallar cada marca: 40 de daño en 3 m alrededor de cada marcado.

Pasiva «Auditora»: +5 % de crítico y sus críticos hacen ×2,5 en vez de ×2.
```

### Prompt 5 — Taro Sato, explorador de señales

```
Añade a Taro Sato (id 'taro-sato'), explorador de señales. El más rápido:
pega y se va, y salta de un sitio a otro dejando señuelos.

Aspecto (web/src/modelos/taro.ts, esqueleto del astronauta, 2,6 m, más
ligero): traje verde lima (#9bdc3c) con rodilleras, casco con una antena
larga doblada hacia atrás (usa el nodo `antena` con mucho retraso), un disco
de antena parabólica colgado a la espalda, una bufanda que ondea (nodo que se
mueve en `Correr` y `Esprintar`) y botas de corredor. Clip `Habilidad`: se
agacha, se envuelve en estática y desaparece.

Stats: vida 85, velocidad 6,2, daño ×0,95, recarga ×0,95.

Arma inicial «Disco de antena» (id 'bumeran', exclusiva): lanza un disco que
sale hasta su alcance y vuelve a Taro atravesando a todo lo que toca, a la
ida y a la vuelta (cada enemigo, una vez por trayecto). count = discos en
abanico.
  Nv1  daño 12, recarga 1,40 s, count 1, alcance 10 m
  Nv2  daño 14, recarga 1,30 s, count 1, alcance 11 m
  Nv3  daño 14, recarga 1,20 s, count 2, alcance 12 m
  Nv4  daño 18, recarga 1,10 s, count 2, alcance 12 m
  Nv5  daño 20, recarga 1,00 s, count 3, alcance 13 m
  Nv6  daño 24, recarga 0,80 s, count 3, alcance 14 m
Efecto: el disco gira con una estela verde aditiva.

Habilidad R «Salto de señal» (recarga 14 s): se teletransporta 12 m hacia
donde mira la cámara (sin atravesar obstáculos: usa World.resolve). En el
punto de salida deja un eco suyo de estática durante 3 s que atrae a la horda
hacia él y luego estalla: 50 de daño a 5 m. Medio segundo intocable al
aparecer.

Pasiva «Explorador»: el mapa (M) descubre lo que hay al doble de distancia, y
+10 % de velocidad sobre la tabla y en el sprint.
```

### Prompt 6 — Amara Keita, botánica planetaria

```
Añade a Amara Keita (id 'amara-keita'), botánica planetaria: la del apoyo.
Planta zarzas que frenan y un jardín que cura.

Aspecto (web/src/modelos/amara.ts, esqueleto del astronauta, 2,6 m): traje
verde salvia (#53cc8c) con hojas en las hombreras, un casco-invernadero (la
cúpula del visor es transparente con un brote dentro que se mueve al
caminar), mochila con dos macetas y una regadera colgada, guantes de
jardinería. Clip `Habilidad`: se arrodilla y hunde las manos en la tierra;
le salen hojas alrededor.

Stats: vida 115, velocidad 5,0, daño ×0,95, recarga ×1,0.

Arma inicial «Semillero solar» (id 'semillas', exclusiva): lanza semillas a
enemigos al azar a tiro; al caer brota una zarza (área pequeña) que hace daño
cada 0,5 s y frena un 40 % durante 3 s. count = semillas por descarga.
  Nv1  daño 6/tic,  recarga 2,0 s, count 1, radio 2,2 m
  Nv2  daño 7/tic,  recarga 1,9 s, count 1, radio 2,4 m
  Nv3  daño 8/tic,  recarga 1,8 s, count 2, radio 2,6 m
  Nv4  daño 10/tic, recarga 1,6 s, count 2, radio 2,9 m
  Nv5  daño 12/tic, recarga 1,5 s, count 3, radio 3,1 m
  Nv6  daño 14/tic, recarga 1,3 s, count 3, radio 3,4 m
Modelo de la zarza: tallos de bloques verdes con espinas y flores amarillas
que crecen (escala) y se secan al acabar.

Habilidad R «Jardín de sol» (recarga 26 s): planta un círculo de 9 m durante
8 s; dentro, ella (y Bruno) se curan 6 de vida por segundo, y la horda va un
50 % más lenta y recibe 10 de daño por segundo. Se ve como un prado con
flores que brotan y una luz cálida.

Pasiva «Botánica»: los pilones de carga se le cargan un 30 % más rápido y
repara 0,5 de vida por segundo.
```

---

## Resumen de los cinco

| Personaje | Rol | Arma inicial | Habilidad (R) | Pasiva |
|---|---|---|---|---|
| Mara Ilyin | Despliegue | Torreta de despliegue | Sobrecarga de red (25 s) | Cofres un 20 % más baratos |
| Idris Okafor | Tanque cuerpo a cuerpo | Llave de impacto | Muro de chatarra (22 s) | −15 % de daño, empujes a la mitad |
| Noa Herrera | Daño y control | Sello de auditoría | Orden de apagado (28 s) | Críticos más frecuentes y más fuertes |
| Taro Sato | Velocidad | Disco de antena | Salto de señal (14 s) | Ve más en el mapa y corre más |
| Amara Keita | Apoyo y curación | Semillero solar | Jardín de sol (26 s) | Pilones más rápidos y reparación |
