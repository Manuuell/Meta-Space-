# Meta Space

**Meta se congela.** Hace dos siglos, para frenar un calentamiento que lo
abrasaba, sus habitantes encendieron HELIOS, una IA de geoingeniería que tiende
un velo de sulfatos en la estratosfera. Nunca se detuvo: hoy el velo tapa el
sol y la gente sobrevive bajo tierra.

Meta pidió ayuda y **Ares**, tu mundo, respondió. HELIOS vio en la ayuda una
amenaza para el velo y cubrió Ares con él hasta romperlo: de Ares solo quedó tu
nave. Lo cuenta la cinemática de un minuto que sigue al título, con su propia
banda sonora sintetizada (se salta con Esc).

Eres especialista de la misión ARES-IX y llevas a **ADA**, el módulo de
auditoría 7, la única pieza con autoridad para firmar el apagado de HELIOS.
Aguanta diez minutos contra sus unidades hasta que se abra la ventana de
lanzamiento: el cohete subirá la orden y el sol volverá a ese sector. Reúne las
siete reliquias, las pruebas de lo que hizo el velo, y ADA podrá apagarlo en
todo el planeta.

Juego de navegador en 3D (Vite + TypeScript + Three.js), tipo survivors-like.

## Cómo se juega

| Control | Acción |
|---|---|
| WASD / flechas | Moverse |
| Ratón (clic para capturar) · Q / E | Girar la cámara |
| Espacio | Saltar |
| V (mantener) o el botón 🎙 | Hablar en voz alta con quien esté cerca o, si no hay nadie, con ADA. La partida sigue |
| T | Ventana de texto, si no tienes micrófono. Aquí la partida espera |
| Esc | Pausa |

Las herramientas se disparan solas. La chatarra sube de nivel y cada nivel
ofrece mejoras. Las Balizas atraen más unidades: rómpelas pronto.

## IA

ADA, HELIOS y el operador de radio hablan con **Muse Spark** (Meta Model API):
cada partida recibe un brief único y los personajes reaccionan al estado real de
la partida.

Manteniendo V se habla en voz alta sin dejar de pelear, y la respuesta suena
mientras la partida sigue. Iris, Tali y Lis tienen su vida, su versión de lo que
pasó en el sector y cosas que solo cuentan si te ganas su confianza. ADA conoce
todo el mapa: te aconseja, marca objetivos y manda el dron a buscar lo que le
pidas. Cada compañero habla a su manera: Bruno es un perro con un chip que le
deja hablar, y Noa es lo que queda de la ingeniera que escondió a ADA. El modelo
responde con la frase, una emoción y una acción de una lista cerrada, y el juego
comprueba coste y límites antes de aplicarla.

El creador de personaje genera sprites con **Muse Image**, ADA comenta los
dibujos con visión y **Muse Voice** transcribe el micrófono. Sin conexión con la
IA, todo funciona con un guion local.

La API de Meta aún no tiene voz de salida: las voces de los personajes son
sintéticas, generadas por ordenador en el servidor con **Supertonic 2**
(Supertone Inc.). El modelo se usa bajo la licencia
[BigScience Open RAIL-M](web/public/licencias/supertonic-openrail-m.txt), y usar
estas voces implica aceptar las restricciones de uso de esa licencia. Sin el
modelo, habla la voz del navegador.

## Ejecutar

Requiere Node 22.18 o posterior.

```bash
cd web
npm install
npm run voces        # una vez: descarga las voces (267 MB)
npm run build
npm start            # juego + IA en http://127.0.0.1:8787
```

La clave de Meta Model API va en `web/.env.local` (`MODEL_API_KEY=...`, ver
`web/.env.example`) o en el entorno. Sin clave, el juego funciona igual con el
guion local.

Desarrollo: `npm run dev` (juego en http://127.0.0.1:5173) y, en otra terminal,
`npm run serve` (IA). Tests: `npm test`.

## Desplegar con dominio propio

`npm start` sirve el juego y la API desde el mismo proceso, así que basta un
hosting de Node (Render, Railway, Fly, un VPS):

- Build: `npm ci && npm run voces && npm run build` · Start: `npm start` ·
  carpeta raíz: `web/`. Las voces necesitan unos 600 MB de disco en `node_modules`
  y `.voces`, y unos 500 MB de memoria
- Variables: `MODEL_API_KEY`, y `TRUST_PROXY=1` si va detrás de un proxy.
  Si la plataforma define `PORT`, el servidor escucha en `0.0.0.0` solo.

La clave nunca llega al navegador. El servidor solo acepta llamadas a la API
desde su propio dominio (más los que se añadan en `ALLOWED_ORIGINS`), limita
las peticiones por IP y tiene un cupo diario de llamadas de pago
(`AI_DAILY_LIMIT`, 1500 por defecto) tras el cual pasa al guion local.
