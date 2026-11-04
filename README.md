# Meta Space

**A game built for the Meta hackathon.** A 3D survivors-like that runs in the
browser, where the characters think, talk and listen through Meta's APIs: you talk
to them out loud without leaving the fight, they know the map you are exploring,
and you can create your own 3D hero just by writing what you want.

<p align="center">
  <a href="docs/media/batalla.mp4"><img src="docs/media/batalla.webp" alt="Battle against the Cancerbero and the Veil Dragon, ending on the Meta Space title" width="100%"></a>
</p>

<p align="center"><a href="docs/media/batalla.mp4">▶ Watch the clip with music</a></p>

## The story

**Meta is freezing.** Two centuries ago, to stop the warming that was scorching
the planet, its people switched on HELIOS, a geoengineering AI that spreads a veil
of sulfates across the stratosphere. It never stopped: today the veil blocks out
the sun and people survive underground.

Meta asked for help and **Ares**, your world, answered. HELIOS saw that help as a
threat to the veil and covered Ares with it until the planet broke apart: all that
is left of Ares is your ship. ADA tells you the story in the cinematic that follows
the title, a minute and a half long with its own synthesized soundtrack (press Esc
to skip it).

You are a specialist on the ARES-IX mission and you carry **ADA**, audit module 7,
the only piece of hardware with the authority to sign the shutdown of HELIOS. The
wreckage of the Ares fleet has fallen across the map: **find it, build your own ship
in the shipyard and launch it within ten minutes**. If it gets through the veil,
ADA's signature reaches HELIOS and the sun returns to that sector. Collect the seven
relics, the proof of what the veil did, and ADA will be able to shut it down across
the whole planet.

Built with Vite, TypeScript and Three.js. Models, music, sound effects and
cinematics are all generated in code. The game itself is in Spanish.

## Screenshots

| | |
|---|---|
| ![Orbital scanner with three sectors to choose from](docs/media/escaner.jpg) | ![An oasis sector with vegetation and clean water](docs/media/oasis.jpg) |
| **Orbital scanner:** choose between three randomly generated sectors | **Oasis:** one of Meta's eight biomes |
| ![A glacier in a blizzard](docs/media/glaciar.jpg) | ![A crystal forest in the fog](docs/media/cristal.jpg) |
| **Glacier:** every sector brings its own weather and rule | **Crystal forest:** terrain, fauna and bosses change every run |
| ![Fighting the Cancerbero of HELIOS](docs/media/jefe.jpg) | ![Talking to ADA, who answers and marks the objective on the map](docs/media/conversacion.jpg) |
| **Bosses:** they grow with time and with your level | **ADA:** answers through Muse Spark and marks objectives on the map |
| ![The shipyard with a complete ship](docs/media/astillero.jpg) | ![The sector map](docs/media/mapa.jpg) |
| **Shipyard:** build your own ship with real physics | **Sector map:** what you have discovered and what ADA has marked |

## Hero Forge

**Write to the AI what you want your character to be, then play as it.** Muse Spark
turns your sentence into a recipe of parts, and the game uses it to assemble a 3D
hero with the same style and the same animations as the hand-made characters. You
can then ask for changes ("make it taller, give it a blue cape") or adjust it piece
by piece, and the stat sheet shows what you gain and lose with every change. Open it
from **Operador** in the main menu.

![The Hero Forge, with a space pirate designed by the AI](docs/media/forja.jpg)

A hero is more than a look: the AI picks a class based on what you describe, which
sets the starting weapon, ability and passive, and the silhouette decides whether
your hero is tougher or faster. There are 15 categories and about 100 options, and
if something is not in the catalogue the AI picks the closest match. Because the AI
chooses parts instead of drawing, the model can always be animated and always fits
the game.

| | |
|---|---|
| ![A created hero in a run, raising its Scrap Wall](docs/media/heroe-partida.jpg) | ![Twelve heroes designed by Muse Spark, each from a single sentence](docs/media/heroes.jpg) |
| **In a run:** with its own weapon, ability and HUD portrait | **Twelve heroes by Muse Spark**, each from a single sentence |

## How to play

| Control | Action |
|---|---|
| WASD / arrow keys | Move |
| Mouse (click to capture) · Q / E | Turn the camera |
| Space | Jump |
| V (hold) or the 🎙 button | Talk out loud to whoever is nearby or, if nobody is, to ADA. The run keeps going |
| T | Text window, if you have no microphone. The run pauses here |
| Esc or P | Pause menu: the only time the mouse cursor comes out |
| 1, 2, 3 or mouse | Pick a card when you level up |
| M | Sector map |
| G, C | Active modules |
| F | Interact: chests, cages, altars and, on the launch pad, the shipyard |
| C (in the menu) | Hero Forge: create your character |

Your tools fire on their own: your job is to move. Follow the beams of light, stay
for 3 seconds next to each piece of wreckage and return to the launch pad. There,
with **F**, you touch the ship wherever you want to change it, try every part before
spending anything, build it from wreckage and scrap, and launch: it lifts off, pitches
up and drops its tanks. The physics are real (thrust-to-weight and the Tsiolkovsky
rocket equation): if a launch fails, a specific part is to blame. What you recover
stays in storage even if you die, and you can also build the ship from the menu
(**Astillero**, key B).

**Every run is a different sector of Meta.** Before landing, the orbital scanner
shows you three randomly generated destinations: eight biomes (from glaciers to ash
lands, through spore jungles and an oasis with clean water), each with its own
terrain, lakes, weather, a rule that changes how the game plays, fauna, bosses and
the people still living there. Across the sector you find **items that change what
your tools do** (cuts that bounce, pulses that pull in the horde, kills that explode,
drones that shoot) and **active modules** on keys **G** and **C**. What drops most
depends on the sector, and some sectors have a travelling merchant.

## How we use Meta's APIs

| API | Where it is used |
|---|---|
| **Muse Spark** | Characters: ADA, HELIOS, the radio operator and the survivors talk and decide what to do |
| **Muse Spark** | Map: ADA and Tali know what is nearby and ADA marks objectives for you; every run gets its own brief |
| **Muse Spark** | Hero Forge: turns what you write into the recipe for a playable 3D hero |
| **Muse Image** | 2D creator in the profile menu: generates your hero's sprite |
| **Vision** | ADA comments on the drawings you show her in the 2D creator |
| **Muse Voice** | Transcribes what you say into the microphone |

The characters react to the real state of the run: they know which sector you are
in, what is near you and how you are doing. A seed in your browser generates the
terrain of each sector, and Meta's AI turns it into a world you can talk to.

Hold V to talk out loud without leaving the fight, and the answer plays while the
run keeps going. Iris, Tali and Lis have their own lives, their own version of what
happened in the sector and things they only tell you once you earn their trust. ADA
knows the whole map: she gives advice, marks objectives and sends the drone to fetch
whatever you ask for. Each companion has their own way of speaking: Bruno is a dog
with a chip that lets him talk, and Noa is what remains of the engineer who hid ADA.
The model answers with a line, an emotion and an action from a closed list, and the
game checks the cost and limits before applying it.

The 2D creator in the profile menu generates sprites with **Muse Image**, ADA comments
on drawings with vision, and **Muse Voice** transcribes the microphone. With no
connection to the AI, everything runs on a local script.

Meta's API has no speech output yet: the characters' voices are synthetic,
computer-generated on the server with **Supertonic 2** (Supertone Inc.). The model
is used under the
[BigScience Open RAIL-M](web/public/licencias/supertonic-openrail-m.txt) license, and
using these voices means accepting that license's use restrictions. Without the
model, the browser's voice speaks instead.

## Running it

Requires Node 22.18 or later.

```bash
cd web
npm install
npm run voces        # once: downloads the voices (267 MB)
npm run build
npm start            # game + AI at http://127.0.0.1:8787
```

The Meta Model API key goes in `web/.env.local` (`MODEL_API_KEY=...`, see
`web/.env.example`) or in the environment. Without a key, the game still works on
the local script.

Development: `npm run dev` (game at http://127.0.0.1:5173) and, in another terminal,
`npm run serve` (AI). Tests: `npm test`.

## Deploying on your own domain

`npm start` serves the game and the API from the same process, so any Node host
will do (Render, Railway, Fly, a VPS):

- Build: `npm ci && npm run voces && npm run build` · Start: `npm start` · root
  folder: `web/`. The voices need about 600 MB of disk in `node_modules` and
  `.voces`, and about 500 MB of memory
- Variables: `MODEL_API_KEY`, and `TRUST_PROXY=1` if it sits behind a proxy. If the
  platform sets `PORT`, the server listens on `0.0.0.0` on its own.

The key never reaches the browser. The server only accepts API calls from its own
domain (plus any added in `ALLOWED_ORIGINS`), rate-limits requests per IP and has a
daily quota of paid calls (`AI_DAILY_LIMIT`, 1500 by default), after which it falls
back to the local script.
