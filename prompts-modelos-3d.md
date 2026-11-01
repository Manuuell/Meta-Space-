# Prompts para generar los modelos 3D de Meta Space

Para pedirle a una IA de modelos 3D los personajes del juego y descargarlos
en GLB. Hay dos formatos:

- **Prompt completo (en español):** para una IA que construye el modelo y sus
  animaciones y exporta un GLB con los clips. Pega primero el **bloque de
  estilo** y después el prompt del personaje.
- **Prompt corto (en inglés):** para generadores de texto a 3D (Meshy,
  Tripo, Rodin…). Solo dan la malla. El astronauta, que es humanoide, se
  puede rigear y animar con su auto-rig; los enemigos no son humanoides y
  necesitan rig a mano (Blender) o el formato completo.

Si los GLB salen con los **mismos nombres de animación** que aquí, se pueden
conectar al juego sin tocar la lógica de los enemigos.

---

## Referencias para adjuntar

Todo está en la carpeta [referencias-modelos/](referencias-modelos/):

| Archivo | Qué es | Para qué |
|---|---|---|
| `<modelo>-hoja.png` | Frente, lado, espalda y 3/4 en una fila | La mejor referencia para una IA que modela: forma y colores desde todos los lados |
| `<modelo>-frente.png`, `-lado.png`, `-espalda.png` | Vistas sueltas de 1024 × 1024 | Generadores de imagen a 3D con modo multivista (Meshy, Tripo) |
| `<modelo>-tres-cuartos.png` | Vista 3/4 de 1024 × 1024 | Generadores de imagen a 3D con una sola imagen: es la que más información da |
| `estilo-conjunto.png` | Los tres personajes juntos, a la misma escala | Referencia de estilo y de tamaño para los enemigos que aún no existen |
| `astronauta.glb`, `recolector.glb`, `baliza.glb` | Los modelos actuales con todas sus animaciones | Si la IA acepta un modelo de partida para mejorarlo, o para usarlos tal cual |

El astronauta está en pose A (brazos a 40°), que es lo que esperan los rigs
automáticos.

**Frase para pegar junto a las imágenes** (antes del bloque de estilo):

```
Adjunto imágenes de referencia de nuestro juego. Respeta exactamente la forma,
las proporciones, las piezas y los colores de las referencias del personaje, y
el estilo de dibujo (sombreado toon de 3 tonos y contorno negro grueso). Si es
un personaje nuevo, tiene que parecer de la misma familia que los de
estilo-conjunto.png: mismas formas redondeadas y gruesas, misma paleta, mismo
grosor de contorno y una escala coherente con la del astronauta (2,6 m).
```

---

## Bloque de estilo (pegar siempre primero)

```
Estilo: personajes de videojuego 3D tipo Roblox / "brainrot": piezas simples y
gruesas (cajas redondeadas, esferas, cápsulas, barriles), proporciones
exageradas, cabezas u ojos enormes, sombreado toon de 3 tonos con contorno
negro grueso. Colores planos, nada realista, sin texturas fotográficas.

Mundo: planeta Meta, congelado bajo un velo rojo de sulfatos creado por HELIOS,
una IA climática. Los enemigos son máquinas de mantenimiento de HELIOS
reconvertidas.

Paleta de los enemigos de HELIOS (obligatoria):
- Metal oscuro #474a5e y #62667c, partes casi negras #2a2638.
- Detalles PÚRPURA en todos los enemigos: cristales, pinchos, franjas y aros
  púrpura #8a2cf0 que BRILLAN (emisivo) en #c77dff.
- Ojos con pupila ROJA brillante #ff4a3a.
- Deben parecer MALOS: cejas o párpados de chapa en ángulo enfadado, dientes,
  pinchos, siluetas agresivas. Malos pero con carisma de dibujo animado, no gore.

Técnico:
- Exportar GLB con malla, materiales (o colores de vértice) y animaciones.
- Unidades en metros, origen a ras de suelo entre los pies, mirando a +Z.
- Entre 3.000 y 8.000 triángulos (salen cientos a la vez en pantalla).
- Esqueleto o jerarquía de piezas con nombres claros en español.
- Animaciones a 30 fps; las de movimiento en bucle perfecto (primer y último
  fotograma iguales). Nombres de clip exactamente como se indican.
- Squash & stretch y anticipación: que cada acción se lea desde lejos.
```

---

## 1. Especialista de ARES-IX (jugador)

**Adjunta:** `astronauta-hoja.png` (o `astronauta-tres-cuartos.png` en un generador de una sola imagen).

**Prompt completo**

```
Crea al protagonista: un astronauta chibi de 2,6 m de alto. Casco esférico
enorme (casi la mitad de la altura) blanco frío #e8eeff con una franja naranja
#ff8a3d de la nuca a la frente y un cuello metálico oscuro. Visor ancho azul
noche #1d2b4f con dos ojos de luz cian #9ff8ff en forma de cápsula y un
reflejo blanco. Orejeras naranjas, antena corta con punta naranja brillante.
Torso blanco redondeado con cinturón naranja y panel en el pecho con dos
luces (naranja y cian). Mochila gris con un núcleo cian brillante #5ee0ff
rodeado por un aro oscuro: es ADA, la IA que lleva a la espalda, y tiene que
verse bien desde detrás porque la cámara va detrás del jugador. Brazos de
cápsula con guantes naranjas, piernas cortas con botas oscuras.
Es el héroe: amable y valiente, NO lleva púrpura.

Animaciones: Reposo (2,4 s, respira, mira a los lados, parpadea, ADA late),
Caminar (1 s), Correr (0,6 s, inclinado hacia delante), Saltar (0,7 s, se
agacha, se estira con los brazos arriba y aterriza), Golpe recibido (0,45 s),
Victoria (1,2 s, salta saludando con los dos brazos), Derrota (1,4 s, cae de
espaldas sobre la mochila y ADA se apaga).
```

**Prompt corto**

```
Chibi astronaut game character, huge round white helmet with orange stripe, wide dark blue visor with two glowing cyan capsule eyes, orange gloves and belt, dark boots, grey backpack with a glowing cyan orb core, Roblox-like chunky toon style, thick black outline, flat colors, low poly, T-pose, full body, game asset
```

---

## 2. Recolector (horda)

**Adjunta:** `recolector-hoja.png` (o `recolector-tres-cuartos.png`).

**Prompt completo**

```
Crea al Recolector, la unidad básica de HELIOS, de 1,4 m: un cubo de basura
blindado de metal oscuro con dos patitas cortas y pies anchos con una luz
púrpura. Un solo ojo enorme al frente con pupila roja brillante, medio tapado
por un párpado de chapa y dos cejas gruesas en V de enfado. Debajo, una
sonrisa de dientes de hueso dentro de una ranura oscura. Franja púrpura
brillante alrededor del cuerpo. La tapa es una cúpula con bisagra detrás, con
cristales púrpura afilados que le crecen encima y una antenita con luz roja.
Del frente sale una trompa de aspiradora articulada en 3 tramos que acaba en
una boquilla púrpura con aro brillante: con ella intenta aspirar la señal de
ADA. Malo pero gracioso: anda como un pato.

Animaciones: Reposo (1,6 s, se aplasta respirando y olfatea con la trompa),
Caminar (0,5 s, bamboleo de pato, la tapa repiquetea), Aspirar (0,8 s, ataque:
coge impulso, abre la tapa como una boca y se lanza con la trompa, la boquilla
se hincha), Golpe recibido (0,35 s), Derrota (0,9 s, gira como una peonza, se
aplasta y la tapa sale volando).
```

**Prompt corto**

```
Evil cartoon trash-can robot enemy, dark gunmetal body, one giant eye with glowing red pupil and angry metal eyelid and eyebrows, toothy grin, glowing purple stripe, sharp purple crystals growing on its dome lid, segmented vacuum hose trunk with purple nozzle, two stubby legs, Roblox-like chunky toon style, thick black outline, low poly, game asset
```

---

## 3. Baliza (apoyo)

**Adjunta:** `baliza-hoja.png` (o `baliza-tres-cuartos.png`).

**Prompt completo**

```
Crea la Baliza, un dron de HELIOS que flota a 1,6 m del suelo: cuerpo
esférico de chapa oscura con una banda púrpura brillante, una pantalla negra
al frente con un ojo rojo que barre de lado a lado bajo dos cejas de chapa
enfadadas, y cuatro pinchos púrpura en diagonal. Una barra horizontal con dos
hélices a los lados, cada una dentro de un aro púrpura brillante. Encima, un
muelle y una antena parabólica oscura con el borde púrpura brillante y una luz
roja que parpadea. Debajo cuelga una antenita con una bola roja. No ataca:
triangula la señal y llama a refuerzos, así que debe parecer un vigilante
siniestro.

Animaciones: Flotar (1,6 s, se balancea, hélices girando, la antena da una
vuelta completa), Triangular (2 s, se planta, la antena gira deprisa
inclinada hacia el jugador y emite anillos rojos que se expanden), Golpe
recibido (0,35 s, se sacude y el muelle rebota), Derrota (1,2 s, las hélices
se paran, da vueltas y cae rebotando al suelo con la luz apagada).
```

**Prompt corto**

```
Sinister flying drone enemy, dark metal sphere body with glowing purple band and four purple spikes, black screen face with a single red eye and angry metal brows, two side propellers inside glowing purple rings, satellite dish on a spring with purple glowing rim and red light, Roblox-like chunky toon style, thick black outline, low poly, game asset
```

---

## 4. Segador (jefe, lleva las reliquias)

**Adjunta:** `estilo-conjunto.png`, `recolector-hoja.png` y `baliza-hoja.png` como referencia de estilo (aún no tiene modelo propio).

**Prompt completo**

```
Crea al Segador, el jefe de HELIOS: una cosechadora agrícola gigante de 3 m,
lenta y aterradora. Cuerpo de caja redondeada de metal oscuro, cabina con dos
faros rojos como ojos furiosos bajo una visera de chapa, una boca enorme al
frente con un rodillo de cuchillas giratorias púrpura que brillan, tubo de
escape con humo, orugas o cuatro ruedas grandes con tapacubos púrpura. En el
lomo, un depósito de cristal donde se ven las reliquias que ha cosechado,
iluminado en púrpura. Cristales púrpura enormes saliendo de la espalda.

Animaciones: Avanzar (1,2 s, rodillo girando, traqueteo, humo), Embestir
(1,4 s, se echa atrás, ruge con los faros en rojo intenso y carga hacia
delante), Barrido (1 s, gira el rodillo de lado a lado), Golpe recibido
(0,4 s), Derrota (2 s, se estremece, salta chispas, se abre el depósito y cae
de lado soltando las reliquias).
```

**Prompt corto**

```
Giant evil harvester machine boss, dark metal boxy body, two furious red headlight eyes under a metal visor, huge front mouth with spinning glowing purple blade roller, purple crystals on its back, glass tank with glowing relics, tank treads with purple hubcaps, exhaust pipe, Roblox-like chunky toon style, thick black outline, low poly, game asset
```

---

## 5. Saltador

**Adjunta:** `estilo-conjunto.png`, `recolector-hoja.png` y `baliza-hoja.png` como referencia de estilo (aún no tiene modelo propio).

**Prompt completo**

```
Crea al Saltador, 1,2 m: un muelle mecánico con patas de saltamontes de metal
oscuro y articulaciones púrpura brillantes. Cabeza en forma de cuña con dos
ojos rojos rasgados y mandíbulas de pinza. Pinchos púrpura en la espalda.
Acecha agachado, telegrafía y salta sobre el jugador.

Animaciones: Acechar (1 s, agachado, balanceándose), Cargar salto (0,5 s, se
comprime mucho y los ojos brillan más), Saltar (0,7 s, se estira en el aire
con las pinzas abiertas), Aterrizar (0,3 s, aplastamiento), Golpe recibido
(0,3 s), Derrota (0,9 s, se le saltan los muelles y se desmonta).
```

**Prompt corto**

```
Evil mechanical grasshopper robot enemy, coiled spring body, long dark metal jumping legs with glowing purple joints, wedge head with two slanted red eyes and pincer jaws, purple spikes on its back, crouched pose, Roblox-like chunky toon style, thick black outline, low poly, game asset
```

---

## 6. Avispa

**Adjunta:** `estilo-conjunto.png`, `recolector-hoja.png` y `baliza-hoja.png` como referencia de estilo (aún no tiene modelo propio).

**Prompt completo**

```
Crea a la Avispa, un dron insecto de 0,9 m que vuela: cuerpo segmentado de
metal oscuro con rayas púrpura brillante, un aguijón largo púrpura, ojos
compuestos rojos enormes y antenas. Dos alas de rotor; una está rota y
remendada, por eso vuela torcida. Hostiga desde fuera de alcance y pica.

Animaciones: Volar (0,4 s, alas a toda velocidad, vuelo torcido), Picar
(0,6 s, se echa atrás y se lanza en picado con el aguijón por delante), Golpe
recibido (0,3 s), Derrota (1 s, el ala rota se suelta y cae en espiral).
```

**Prompt corto**

```
Evil robotic wasp drone enemy, segmented dark metal body with glowing purple stripes, long purple stinger, huge red compound eyes, one broken patched rotor wing, Roblox-like chunky toon style, thick black outline, low poly, game asset
```

---

## 7. Caparazón

**Adjunta:** `estilo-conjunto.png`, `recolector-hoja.png` y `baliza-hoja.png` como referencia de estilo (aún no tiene modelo propio).

**Prompt completo**

```
Crea al Caparazón, 1,6 m: un escarabajo tanque con una concha enorme de
placas de metal oscuro unidas por grietas púrpura brillantes, cabeza pequeña
y cabezota con un ojo rojo y cuernos de chapa, seis patas cortas. Aguanta
mucho y, al romperse, se abre y salen tres Recolectores.

Animaciones: Caminar (1,2 s, pesado, la concha se balancea), Cubrirse (0,6 s,
mete la cabeza y las patas, la concha brilla), Embestir (0,8 s, baja los
cuernos y carga), Golpe recibido (0,4 s, saltan chispas púrpura), Derrota
(1,2 s, la concha se agrieta y se abre como un huevo: dentro van tres
Recolectores).
```

**Prompt corto**

```
Evil armored beetle tank robot enemy, huge dark metal plated shell with glowing purple cracks, small stubborn head with one red eye and metal horns, six short legs, Roblox-like chunky toon style, thick black outline, low poly, game asset
```

---

## 8. Sembrador

**Adjunta:** `estilo-conjunto.png`, `recolector-hoja.png` y `baliza-hoja.png` como referencia de estilo (aún no tiene modelo propio).

**Prompt completo**

```
Crea al Sembrador, 1,8 m: el "jardinero" de HELIOS. Una planta mecánica
siniestra sobre tres raíces-patas de metal oscuro, con un bulbo hinchado
púrpura brillante lleno de esporas, una cabeza de flor de pétalos de chapa
que se abre y deja ver un ojo rojo en el centro, y tubos por donde se ven
burbujas púrpura. Dispara esporas lentas.

Animaciones: Reposo (1,6 s, se mece, el bulbo late), Caminar (1 s, avanza a
pasitos con las raíces), Disparar (1 s, se hincha, abre la flor y escupe una
espora púrpura), Golpe recibido (0,3 s), Derrota (1,2 s, se marchita, los
pétalos caen y el bulbo revienta en polvo púrpura).
```

**Prompt corto**

```
Sinister mechanical plant enemy, three dark metal root legs, swollen glowing purple spore bulb, flower head of metal petals opening to reveal a single red eye, glass tubes with purple bubbles, Roblox-like chunky toon style, thick black outline, low poly, game asset
```
