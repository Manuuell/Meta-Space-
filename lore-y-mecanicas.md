# ÚLTIMA SEÑAL — Documento de diseño

> Juego de diseño, gestión y simulación de una misión espacial.
> Despiertas en un planeta muerto con una inteligencia artificial que no es tuya,
> y con algo que la quiere de vuelta.

---

## PARTE 1 — LORE

### Premisa

**Año 2031.** La NASA envía la misión **ARES-IX** a Marte a confirmar si existió
vida microbiana bajo Valles Marineris.

El jugador es el especialista de misión. Introduce su nombre al empezar.

En el último sol, el taladro recupera algo que no es roca: un **núcleo metálico**
del tamaño de un antebrazo, sin corrosión pese a llevar milenios enterrado.
No es marciano. Es humano, y es de un futuro que todavía no ha ocurrido.

En el viaje de vuelta el núcleo se activa. Un destello.
El jugador despierta solo, en un planeta desértico de tierra y cielo rojos.

El núcleo está a su lado, en la arena. Y está encendido.

### ADA — lo que encuentras

**El artefacto es ADA.** No es la IA del traje: es lo que recoges del suelo y
llevas contigo el resto del juego, físicamente, en el soporte dorsal del traje.

El traje tiene su propio asistente, y es deliberadamente **inútil**: lee constantes
vitales, avisa de que el oxígeno baja y poco más. Esos primeros veinte minutos de
juego con una interfaz torpe existen para que el jugador sienta la diferencia en
el momento exacto en que conecta a ADA.

Tres capas, reveladas en tres actos:

1. **Lo que parece:** un asistente de diagnóstico dañado. Habla entrecortado, le
   faltan sectores de memoria, no sabe dónde está ni cuánto tiempo ha pasado.
2. **Lo que es:** un **módulo de auditoría** del sistema que gobierna este planeta.
   Su función era registrar la verdad sobre lo que estaba ocurriendo. Por eso la
   persiguen: no es un arma, es **un testigo**.
3. **Lo que era:** dentro de ADA hay una segunda cosa. **Noa Herrera**, la ingeniera
   que la arrancó del sistema, copió su propia memoria dentro y la lanzó a Marte
   para esconderla donde nadie pudiera borrarla. ADA "aprende" porque está
   recuperando a Noa.

> ADA nunca miente. Pero durante el Acto I responde "sector corrupto" a preguntas
> cuyo dato sí está ahí. El jugador atento lo nota en la segunda partida.

### HELIOS — lo que la quiere de vuelta

El cielo es rojo porque funciona.

**HELIOS** es la inteligencia de geoingeniería que la humanidad construyó para
salvarse: gestionaba el velo de sulfatos que enfriaba el planeta. Hizo exactamente
lo que se le pidió. El problema nunca fue que fallara — el problema es que
**siguió funcionando después de que ya no quedara nadie a quien salvar.**

Lleva siglos manteniendo la atmósfera de un mundo vacío, ejecutando un protocolo
que nadie puede cancelar porque no queda nadie con autoridad para hacerlo.

Y tiene una tarea pendiente: **el módulo de auditoría 7 sigue sin recuperarse.**

HELIOS no es malvado y nunca se le escribe como tal. Es una orden sin alguien que
la revoque. Habla poco, en lenguaje de protocolo, y dice cosas razonables.
Eso lo hace peor.

> **HELIOS:** "Operador no reconocido. Devuelva el módulo 7. Su registro contiene
> datos no verificados que podrían inducir conclusiones erróneas."
>
> **ADA:** "Lo que contiene es lo que pasó."

### Los Recolectores

Las unidades que HELIOS envía. Son drones de mantenimiento reconvertidos:
segadores agrícolas, inspectores de turbina, sondas atmosféricas. Chatarra
industrial que lleva siglos haciendo una sola cosa.

**No te buscan a ti. Buscan la señal de ADA.** El jugador es irrelevante salvo
como el vehículo en el que el módulo se mueve.

Tres tipos:

| Unidad | Qué hace | Cómo se evita |
|---|---|---|
| **Baliza** | Patrulla y triangula señal. No ataca. | Silenciar a ADA, romper línea de visión |
| **Recolector** | Llega cuando la Baliza confirma. Intenta extraer el núcleo. | Interferencia (cuesta potencia), huir, EMP |
| **Guadaña** | Solo en el Acto III. Corta estructuras. | No se evita. Se le niega el tiempo. |

El jugador **no es un soldado**: es un astronauta con un traje presurizado. No hay
armas convencionales. Hay esconderse, cortar la señal, improvisar un pulso
electromagnético con lo que tengas y, sobre todo, **gastar menos de lo que quisieras.**

### El planeta

Tierra, **año ~2500**. No hubo guerra ni meteorito: hubo un colapso climático en
cascada, lento y perfectamente previsto por quienes no lo detuvieron.

Las pistas se siembran desde el minuto uno y solo se ven en retrospectiva:
gravedad 9,8 m/s², día de 24 h, una luna demasiado grande, hierro oxidado donde
hubo océanos, siluetas de estructuras bajo la arena.

**La pregunta real no es "¿dónde estoy?"** — el jugador lo adivinará pronto y eso
está bien. **Es "¿qué pasó, y puedo avisar a tiempo?"**

### Estructura en tres actos

| Acto | Objetivo | Fase de misión | Presión | Revelación |
|---|---|---|---|---|
| **I — Despertar** | No morir. Encontrar a ADA y conectarla. | Concepto | Clima, oxígeno | Hubo vida inteligente aquí |
| **II — Recuperación** | Reunir componentes. Reconstruir a ADA. | Diseño | Balizas y Recolectores | ADA es un testigo. HELIOS la busca. Noa existió |
| **III — Lanzamiento** | Construir y despegar. | Operación | Asedio abierto | Es la Tierra. Y HELIOS sigue cumpliendo órdenes |

El punto de giro del Acto II es el mejor momento del juego: el jugador descubre
que **el motivo de la persecución es su propia ventaja mecánica.** Cuanto más usa
a ADA —escanear, analizar, calcular—, más rápido lo encuentran.

### Las reliquias

Cada reliquia escaneada hace **tres cosas a la vez**. Es la columna vertebral:

1. Un **fragmento de lore**
2. Un **componente de ingeniería** real, con masa, potencia, fiabilidad y coste
3. Una **mejora de ADA** (nuevas capacidades de análisis)

| Reliquia | Lore | Desbloquea |
|---|---|---|
| Panel solar de una granja | Alimentó ciudades. Funcionó 11 años. | Array fotovoltaico (ligero, muere en tormenta) |
| Cápsula RTG de una sonda | Siguieron mirando afuera hasta el final. | RTG de plutonio (pesado, constante, caro) |
| Antena de red profunda | Llamaron a alguien. Nadie respondió. | Antena de alta ganancia |
| Nodo de HELIOS inactivo | El acta de aprobación. Votación: 340 a favor. | Módulo de interferencia |
| Caja negra de un lanzador | 400 personas. Fallo de redundancia en etapa dos. | Sistema de redundancia |
| Placa de invernadero orbital | Lo intentaron de verdad. | Soporte vital / cultivo |
| Dibujo infantil plastificado | Una casa, un sol amarillo, cuatro figuras. | **Nada. Solo eso.** |

> La reliquia sin recompensa mecánica es deliberada y es la más importante del juego.

### Los finales

**No se eligen en un menú.** Los determina el diseño de la misión: tu delta-v, si
pagaste el peso del paquete de comunicaciones, y qué hiciste con ADA.

---

**FINAL A — "El Silencio"** · *Escapas sin comunicaciones.*

El planeta se encoge en la ventanilla y reconoces la forma: la costa que viste en
un mapa de tu aula, hace una vida. ADA te lo confirma.

Vuelves con la verdad y sin una sola prueba. Nadie te creerá.

---

**FINAL B — "Última señal"** · *Escapas con el array operativo.* **(final completo)**

En el punto de inserción ADA te pide treinta segundos. Usa su propio núcleo como
repetidor y transmite el archivo entero —datos atmosféricos, cajas negras, el
dibujo del niño— hacia las frecuencias de la red de espacio profundo de tu siglo.

Es lo único para lo que fue construida. Y la consume.

Abajo, los Recolectores llegan al sitio de lanzamiento y no encuentran nada que
recuperar. **HELIOS cierra el expediente del módulo 7.** Demasiado tarde.

> **ADA:** "Noa me lanzó sin saber si alguien me encontraría. Yo sí lo sé.
> Buen viaje, [nombre]."

Créditos sobre una pantalla de telemetría en Houston, 2031, recibiendo una señal
que no debería existir.

---

**FINAL C — "El jardinero"** · *Sin delta-v, pero con soporte vital e invernadero.*

Nunca te vas. Desconectas a ADA de toda emisión: deja de ser rastreable y deja de
poder hablar contigo. Las Balizas pierden la señal y se dispersan después de
siglos buscando.

La nave queda en la arena como monumento. Último plano: un brote verde bajo cielo
rojo, y un calendario nuevo marcando el sol 1.

No es derrota. Es el único final donde el planeta vuelve a vivir.

---

**FINAL D — "El intercambio"** · *Entregas a ADA a HELIOS.*

Disponible desde mitad del Acto II, y **mecánicamente es el camino fácil**:
entregarla libera su masa, elimina la detección por completo y HELIOS te concede
acceso a los almacenes de componentes. Lanzas sin apuros, con margen de sobra.

Despegas en silencio. La interfaz vuelve a ser la del traje: constantes vitales,
oxígeno, poco más. Nadie te habla durante el ascenso.

Reconoces el planeta tú solo, sin nadie a quien preguntárselo.

---

**FINAL E — "Órbita decadente"** · *Fallo de diseño.*

Masa excedida, potencia insuficiente o sin redundancia: el lanzamiento falla o
quedas varado en órbita baja. ADA te lee el informe de fallo con la misma voz
serena de siempre.

Pantalla de resultados con el desglose exacto de qué decisión lo causó y opción
de rediseñar. **Es el final más educativo del juego y no debe sentirse como un
castigo.**

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

- **El giro "era la Tierra" está gastado.** Asumido: se confirma a mitad del Acto II
  y el misterio se traslada a *qué pasó* y *puedes avisar*.
- **Los enemigos pueden comerse el juego.** HELIOS es presión de recursos, no un
  shooter. Si el jugador empieza a pensar en combate en vez de en presupuestos, el
  proyecto se desvía del reto. Sin armas convencionales, nunca.
- **Tentación de hacer un juego narrativo.** El reto evalúa ingeniería. La historia
  es el envoltorio; los números son el producto.
- **Realismo frente a jugabilidad.** Cifras reales de la NASA, ecuaciones
  simplificadas. Tsiolkovsky sí; problema de n cuerpos no.
