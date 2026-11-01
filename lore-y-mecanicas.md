# META SPACE — Documento de diseño

> Juego de diseño, gestión y simulación de una misión espacial.
> El planeta Meta se congela bajo un velo que nadie puede apagar.
> Tú llevas a la única que puede hacerlo, y algo la quiere de vuelta.

---

## PARTE 1 — LORE

### Premisa

**Meta** es un planeta habitado. Hace dos siglos, para frenar un calentamiento
que lo abrasaba, sus habitantes encendieron **HELIOS**: una inteligencia de
geoingeniería que extiende un velo de sulfatos en la estratosfera para devolver
la luz del sol al espacio.

Funcionó. Y nunca se detuvo.

Hoy el velo es rojo y espeso, el sol es una mancha, los mares se hielan y la
gente de Meta sobrevive en refugios bajo tierra. Nadie puede revocar la orden:
HELIOS solo obedece a su propio protocolo, y el protocolo dice que el velo
protege a Meta.

El jugador es especialista de la misión de rescate **ARES-IX**. Introduce su
nombre al empezar. Su trabajo: aterrizar sector a sector, aguantar hasta que se
abra la ventana de lanzamiento y subir la orden de apagado al nodo orbital que
controla el velo sobre ese sector.

### ADA — la llave

**ADA es el módulo de auditoría 7 de HELIOS**, la única pieza del sistema con
autoridad para firmar su apagado. La ingeniera **Noa Herrera** la arrancó del
sistema y la escondió antes de que HELIOS bloqueara todos los accesos.

El jugador la lleva físicamente, en el soporte dorsal del traje: es la luz cyan
de la mochila. También vuela a su lado como dron de mantenimiento reprogramado,
escanea la zona y obedece órdenes de voz.

Tres capas, reveladas poco a poco:

1. **Lo que parece:** un asistente de campo que anima y guía.
2. **Lo que es:** el auditor de HELIOS. Su función era registrar la verdad de lo
   que el velo estaba haciendo. Por eso la persiguen: no es un arma, es **la
   firma que falta**.
3. **Lo que era:** dentro de ADA hay una copia de la memoria de Noa. ADA
   "aprende" porque está recuperando a Noa.

### HELIOS — lo que la quiere de vuelta

El cielo es rojo porque funciona.

HELIOS no es malvado y nunca se le escribe como tal. Hizo exactamente lo que se
le pidió: enfriar Meta. El problema es que **nadie escribió la cláusula para
pararlo**. Habla poco, en lenguaje de protocolo, y dice cosas razonables. Eso lo
hace peor.

> **HELIOS:** "Operador no reconocido. Devuelva el módulo 7. El velo protege a Meta."
>
> **ADA:** "El velo protegía a Meta. Ahora la está congelando."

### Las unidades de HELIOS

Drones de mantenimiento reconvertidos: cosechadoras agrícolas, inspectores de
turbina, sondas atmosféricas. Chatarra industrial que lleva dos siglos haciendo
una sola cosa.

**No te buscan a ti. Buscan la señal de ADA.**

| Unidad | Qué hace |
|---|---|
| **Recolector** | Va directo a por la señal de ADA. |
| **Baliza** | No ataca. Triangula la señal: mientras viva, llegan más. |
| **Segador** | Cosechadora enorme y lenta. Lleva reliquias dentro. |
| **Saltador** | Acecha, se agacha y salta: hay que moverse en lateral. |
| **Avispa** | Hostiga desde el aire fuera de alcance y pica. |
| **Caparazón** | Aguanta mucho y suelta crías al romperse. |
| **Sembrador** | Dispara esporas lentas y esquivables. |

El jugador **no es un soldado**: sus herramientas son material de misión usado
para algo para lo que no se diseñó (cortador de plasma, pulso EMP de ADA, dron de
mantenimiento, campo de interferencia).

### Cómo se salva Meta

- **Cada partida es un sector.** Diez minutos hasta la ventana de lanzamiento.
  Si aguantas, el cohete sube la orden de apagado y **el sol vuelve a ese
  sector**.
- **Las reliquias son pruebas.** HELIOS solo acepta la orden de apagado global
  con una auditoría completa: siete pruebas de lo que hizo el velo. Las llevan
  los Segadores.
- **Con las siete, ADA firma.** HELIOS recibe la orden, el velo se retira de
  todo el planeta y Meta vuelve a ver el sol.

### Las reliquias

Cada reliquia es a la vez:

1. Una **prueba** para la auditoría (lore)
2. Un **dato real** de la exploración espacial (lo que se aprende)
3. Un **componente de ingeniería** para el banco de trabajo (pendiente en web)

| Reliquia | Lore | Desbloquea |
|---|---|---|
| Panel solar de una granja | Alimentó una ciudad de Meta hasta que el velo tapó el sol. | Array fotovoltaico |
| Cápsula RTG de una sonda | Cuando el sol se fue, solo el plutonio siguió dando luz. | Generador de radioisótopos |
| Antena de red profunda | Pidieron ayuda fuera de Meta. Esta vez alguien respondió. | Antena de alta ganancia |
| Nodo de HELIOS inactivo | El acta que encendió a HELIOS: 340 votos a favor y ninguna cláusula para apagarlo. | Módulo de interferencia |
| Caja negra de un lanzador | 400 personas intentaron atravesar el velo. Falló la redundancia de la etapa dos. | Unidad de control redundante |
| Placa de invernadero orbital | Cultivaron bajo lámparas cuando el cielo dejó de servir. | Módulo de soporte vital |
| Dibujo infantil plastificado | Una casa, un sol amarillo, cuatro figuras. Así era el cielo de Meta. | **Nada. Solo eso.** |

> El dibujo no desbloquea nada a propósito: es el sol que se intenta devolver.

### La IA en el juego

ADA, HELIOS y el operador de radio hablan con **Muse Spark** (Meta Model API) a
través del servidor del juego:

- Al empezar cada partida, un **brief único**: nombre de la operación, zona del
  Sector Delta, un giro y la frase inicial de cada personaje.
- Durante la partida, **líneas con contexto** ante eventos (reliquia, daño, élite,
  mitad de la ventana, balizas, victoria, derrota). El servidor recibe el estado
  real de la partida y las últimas frases para no repetirse.
- El **creador de personaje** genera el sprite con **Muse Image** y ADA comenta el
  dibujo con visión; el dron obedece órdenes de voz con **Muse Voice**.

Sin clave, sin red o con el cupo agotado, todo cae a un guion local por semilla:
la partida nunca espera a la IA.

---

## PARTE 2 — MECÁNICAS

Cada una anclada a una exigencia del reto: **diseñar / gestionar / simular / evaluar**.

### 1. Presupuestos de misión `GESTIONAR`

Cuatro contadores siempre visibles. El corazón del juego:

| Recurso | Unidad | Origen |
|---|---|---|
| **Masa** | kg | Límite del lanzador que construyas |
| **Potencia** | W | Suma de tus generadores |
| **Chatarra** | unidades | Recuperada explorando |
| **Tiempo** | soles | Cada acción consume días; hay ventana de lanzamiento |

Toda pieza suma masa y consume potencia. **Nunca puedes tenerlo todo.** Esa
frustración es el objetivo pedagógico del reto, no un defecto.

### 2. Señal y detección `GESTIONAR` `SIMULAR` ← *la mecánica central nueva*

**Usar a ADA emite señal.** Escanear, analizar, calcular órbitas: todo sube un
medidor de **Exposición**.

```
Exposición baja    → nada
Exposición media   → aparecen Balizas, patrullan tu zona
Exposición alta    → triangulación: llega un Recolector
Exposición crítica → asedio
```

Baja sola con el tiempo, o de golpe si **silencias a ADA** (modo pasivo: pierdes
todas sus herramientas) o gastas potencia en **interferencia**.

Esto convierte tu mejor herramienta en tu mayor riesgo y crea la decisión que
define el juego: *¿analizo esta pieza ahora, o cruzo el valle a ciegas?*

Y resuelve de paso un problema de diseño: el jugador ya no escanea todo por
inercia. **Elige qué saber.**

### 3. Banco de trabajo `DISEÑAR`

Ensamblaje por ranuras: estructura, propulsión, energía, comunicaciones, ciencia,
soporte vital, redundancia, **defensa**.

Cada componente con su ficha real: masa (kg), potencia (W), fiabilidad (%), coste.
ADA recalcula el delta-v en vivo con Tsiolkovsky simplificado y te dice, sin
juzgar, si llegas o no.

La ranura de defensa es una trampa deliberada: la interferencia pesa y consume
potencia que le estás quitando a la antena. **Protegerla cuesta la capacidad de
contar lo que sabe.**

> Regla de UI: al arrastrar una pieza, el jugador debe ver **al instante** qué
> acaba de perder.

### 4. Escaneo de reliquias `DISEÑAR`

Minijuego de 10-15 segundos: alinear la frecuencia hasta estabilizar la lectura.
Entrega el triple premio (lore + componente + mejora de ADA) y **sube Exposición**.

Las reliquias más valiosas tardan más en escanearse. Más premio, más riesgo.

### 5. Árbol de ADA `DISEÑAR`

Sube de nivel con reliquias, no con tiempo. Cada nivel es una herramienta real —
y cada nivel **emite más fuerte**:

- 1 · Espectrómetro — identifica materiales
- 2 · Análisis estructural — estima fiabilidad
- 3 · Simulación térmica — avisa de sobrecalentamiento
- 4 · Cálculo orbital — ventanas y trayectorias
- 5 · Reconstrucción de archivo — descifra los registros de Noa

Mecánica, narrativa y amenaza suben por la misma escalera.

### 6. Exploración con presión `SIMULAR`

Ciclo día/noche de 24 h: de noche el frío mata y el traje consume potencia. Las
**tormentas de polvo** cortan la energía solar y tu enlace con ADA.

Detalle clave: la tormenta también ciega a las Balizas. **La tormenta es a la vez
el peor momento para moverse y el único momento seguro.**

### 7. Sitio de lanzamiento y asedio `SIMULAR`

El Acto III ancla al jugador: la plataforma no se mueve y emite constantemente.
HELIOS converge.

El montaje final se vuelve una cuenta atrás defendida: cada sol que dedicas a
mejorar la nave es un sol más de Recolectores llegando. **Despegar antes con una
nave peor, o tarde con una nave buena.** Esa es la tesis del juego entera, en una
sola decisión.

### 8. Simulación de lanzamiento `SIMULAR`

El clímax. Ascenso por fases con la telemetría de tu propio diseño: aceleración,
consumo, temperatura, delta-v restante.

El jugador no controla casi nada. **Solo mira si sus decisiones aguantan.** Y
cuando algo falla, falla por un número que eligió tres horas antes.

### 9. Fallos y redundancia `SIMULAR`

Tiradas de fiabilidad durante ascenso y crucero. Si un sistema cae y compraste
redundancia, el backup entra y la pantalla solo parpadea. Si no, misión perdida.

Enseña lo que ningún juego enseña: **pagar por algo que esperas no usar nunca.**

### 10. Presupuesto de datos `GESTIONAR` `EVALUAR`

Los instrumentos generan datos; la antena los transmite a una tasa limitada por la
potencia. Recolectar más de lo que puedes enviar es perder ciencia.

Decide el Final A frente al Final B, y cubre "comunicaciones" del brief.

### 11. Informe de misión `EVALUAR`

Pantalla de revisión post-vuelo:

- Objetivos cumplidos / parciales / fallidos
- Masa, potencia y presupuesto finales frente a los límites
- **Qué decisión concreta determinó tu final**
- Exposición media a lo largo de la partida
- Rediseñar y relanzar sin repetir la exploración

Es literalmente la última frase del reto: *"evalúan cómo cada elección da forma al
éxito de su misión."*

### 12. Códice `EVALUAR`

Archivo de lo escaneado. Dos pestañas por entrada: **registro** (lore) y **ficha
técnica** (el dato real de ingeniería). Donde el jugador aprende y donde el
proyecto demuestra rigor.

---

## PARTE 3 — PRIORIDADES

Orden de construcción. Las cinco primeras cubren el reto completo:

1. **Banco de trabajo + presupuestos** — sin esto no hay proyecto
2. **Simulación de lanzamiento + informe de misión** — el bucle de evaluación
3. **Escaneo de reliquias** — vincula lore y componentes
4. **Señal y detección** — la tensión, y lo que hace que elegir duela
5. **Los finales** — demuestran que las decisiones importan
6. Árbol de ADA
7. Asedio del Acto III
8. Día/noche y tormentas
9. Presupuesto de datos
10. Códice

### Riesgos conocidos

- **"Salvar el planeta" puede sonar genérico.** Lo que lo hace propio es que el
  villano es una solución climática que nadie sabe parar, y que la llave es un
  auditor: se gana con pruebas, no solo con balas.
- **Los enemigos pueden comerse el juego.** HELIOS es presión de recursos, no un
  shooter. Si el jugador empieza a pensar en combate en vez de en presupuestos, el
  proyecto se desvía del reto. Sin armas convencionales, nunca.
- **Tentación de hacer un juego narrativo.** El reto evalúa ingeniería. La historia
  es el envoltorio; los números son el producto.
- **Realismo frente a jugabilidad.** Cifras reales de la NASA, ecuaciones
  simplificadas. Tsiolkovsky sí; problema de n cuerpos no.
