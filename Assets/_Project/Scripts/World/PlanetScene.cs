using MetaSpace.UI;
using UnityEngine;

namespace MetaSpace.World
{
    /// <summary>
    /// Levanta el planeta al arrancar: cielo, capas de ruinas, suelo, el
    /// astronauta y el Meta Space esperando en la arena.
    ///
    /// Igual que el banco de trabajo, el mundo se construye por codigo y la
    /// escena queda casi vacia. Asi se lee en un diff lo que hay en el nivel,
    /// en vez de tener que abrir Unity para averiguarlo.
    /// </summary>
    public class PlanetScene : MonoBehaviour
    {
        public float levelLeft = -42f;
        public float levelRight = 42f;
        public float groundY = 0f;

        DialogueUI dialogue;
        Transform player;

        void Start()
        {
            var cam = BuildCamera();
            BuildSky(cam);
            BuildSkylines();
            BuildGround();
            player = BuildPlayer();
            BuildDust();

            cam.GetComponent<CameraFollow>().target = player;

            dialogue = gameObject.AddComponent<DialogueUI>();
            BuildCore();

            Intro();
        }

        // ---------------------------------------------------------- Camara

        Camera BuildCamera()
        {
            var go = new GameObject("Main Camera", typeof(Camera), typeof(CameraFollow));
            go.tag = "MainCamera";

            var cam = go.GetComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 5f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = SpriteFactory.SkyTop;
            go.transform.position = new Vector3(0f, 3f, -10f);

            var follow = go.GetComponent<CameraFollow>();
            follow.minX = levelLeft + 9f;
            follow.maxX = levelRight - 9f;

            return cam;
        }

        void BuildSky(Camera cam)
        {
            // Colgado de la camara: el cielo nunca se mueve respecto al ojo,
            // que es exactamente como se comporta un cielo.
            var sprite = SpriteFactory.Sky();
            var go = NewSprite("Cielo", sprite, Color.white, -100);
            go.transform.SetParent(cam.transform, false);

            // La textura del degradado mide 4 px de ancho: a escala fija salia
            // como una franja estrecha en mitad de la pantalla. El tamano se
            // calcula desde la camara para que cubra el encuadre sea cual sea.
            float worldHeight = cam.orthographicSize * 2f;
            float worldWidth = worldHeight * 3f;
            var size = sprite.bounds.size;

            go.transform.localPosition = new Vector3(0f, -worldHeight * 0.55f, 20f);
            go.transform.localScale = new Vector3(worldWidth / size.x,
                                                  worldHeight * 1.15f / size.y, 1f);
        }

        // -------------------------------------------------------- Horizonte

        void BuildSkylines()
        {
            // Cuanto mas lejos, mas tenue, mas baja y mas lenta. Cuatro capas
            // bastan para que el ojo lea profundidad.
            Layer("Ruinas lejanas", seed: 11, height: 150, color: SpriteFactory.Far,
                  density: 0.62f, y: 0.2f, factor: 0.08f, scale: 7.5f, order: -60, alpha: 0.55f);

            Layer("Ruinas medias", seed: 29, height: 190, color: SpriteFactory.Mid,
                  density: 0.78f, y: 0.1f, factor: 0.2f, scale: 6.2f, order: -50, alpha: 0.85f);

            Layer("Ruinas cercanas", seed: 47, height: 210, color: SpriteFactory.Near,
                  density: 0.95f, y: 0f, factor: 0.38f, scale: 5.0f, order: -40, alpha: 1f);

            // Habia una quinta capa delante del jugador. Medida en unidades de
            // mundo tapaba casi todo el encuadre jugable, y el suelo ya hace de
            // primer plano: quitarla deja la escena mas limpia que ajustarla.
        }

        void Layer(string name, int seed, int height, Color color, float density,
                   float y, float factor, float scale, int order, float alpha)
        {
            var sprite = SpriteFactory.Skyline(seed, 1400, height, color, density);

            var go = NewSprite(name, sprite, new Color(1f, 1f, 1f, alpha), order);
            go.transform.position = new Vector3((levelLeft + levelRight) * 0.5f, groundY + y, 0f);
            go.transform.localScale = new Vector3(scale, scale, 1f);

            go.AddComponent<ParallaxLayer>().factor = factor;
        }

        // ------------------------------------------------------------ Suelo

        void BuildGround()
        {
            float width = levelRight - levelLeft;

            var go = NewSprite("Suelo", SpriteFactory.GroundStrip(), Color.white, 10);
            var renderer = go.GetComponent<SpriteRenderer>();
            renderer.drawMode = SpriteDrawMode.Tiled;
            renderer.tileMode = SpriteTileMode.Continuous;
            renderer.size = new Vector2(width, 1.28f);
            go.transform.position = new Vector3((levelLeft + levelRight) * 0.5f, groundY - 1.28f, 0f);

            // Relleno solido por debajo. La franja de terreno solo cubre su
            // propio grosor, y la camara encuadra mas abajo que eso: sin esto
            // se ve el cielo por debajo del suelo.
            var fill = NewSprite("Subsuelo", SpriteFactory.Solid(), SpriteFactory.Ground, 9);
            fill.transform.position = new Vector3((levelLeft + levelRight) * 0.5f, groundY - 21.28f, 0f);
            fill.transform.localScale = new Vector3(width / fill.GetComponent<SpriteRenderer>().sprite.bounds.size.x,
                                                    20f / fill.GetComponent<SpriteRenderer>().sprite.bounds.size.y, 1f);

            // El colisionador es plano aunque el dibujo ondule: la ondulacion es
            // de centimetros y un suelo irregular solo sirve para enganchar al
            // jugador en bordes que no ve.
            var collider = new GameObject("Colision del suelo", typeof(BoxCollider2D));
            collider.transform.position = new Vector3((levelLeft + levelRight) * 0.5f, groundY - 0.5f, 0f);
            collider.GetComponent<BoxCollider2D>().size = new Vector2(width, 1f);

            Wall(levelLeft - 0.5f);
            Wall(levelRight + 0.5f);
        }

        void Wall(float x)
        {
            var go = new GameObject("Limite", typeof(BoxCollider2D));
            go.transform.position = new Vector3(x, groundY + 5f, 0f);
            go.GetComponent<BoxCollider2D>().size = new Vector2(1f, 14f);
        }

        // ------------------------------------------------------- Astronauta

        Transform BuildPlayer()
        {
            var go = new GameObject("Astronauta", typeof(Rigidbody2D), typeof(CapsuleCollider2D),
                                    typeof(PlayerController));
            go.transform.position = new Vector3(levelLeft + 8f, groundY + 1.5f, 0f);

            var collider = go.GetComponent<CapsuleCollider2D>();
            collider.size = new Vector2(0.26f, 0.4f);
            collider.offset = new Vector2(0f, 0.2f);

            var visual = NewSprite("Silueta", SpriteFactory.Astronaut(), Color.white, 5);
            visual.transform.SetParent(go.transform, false);

            return go.transform;
        }

        // --------------------------------------------------------- Meta Space

        void BuildCore()
        {
            var go = new GameObject("Meta Space", typeof(AdaCore));
            go.transform.position = new Vector3(levelLeft + 26f, groundY + 0.05f, 0f);

            var glow = NewSprite("Glow", SpriteFactory.Glow(),
                new Color(0.33f, 0.90f, 0.82f, 0.42f), 3);
            glow.transform.SetParent(go.transform, false);
            glow.transform.localPosition = new Vector3(0f, 0.11f, 0f);
            glow.transform.localScale = Vector3.one * 3.5f;
            var glowSprite = glow.GetComponent<SpriteRenderer>();
            glowSprite.sprite = SpriteFactory.Glow();

            var body = NewSprite("Nucleo", SpriteFactory.Core(), Color.white, 6);
            body.transform.SetParent(go.transform, false);

            var prompt = new GameObject("Prompt");
            prompt.transform.SetParent(go.transform, false);
            prompt.transform.localPosition = new Vector3(0f, 0.75f, 0f);
            var label = prompt.AddComponent<TextMesh>();
            label.text = "[E]";
            label.characterSize = 0.06f;
            label.fontSize = 72;
            label.anchor = TextAnchor.MiddleCenter;
            label.color = new Color(0.55f, 1f, 0.93f);
            prompt.GetComponent<MeshRenderer>().sortingOrder = 30;
            prompt.SetActive(false);

            var core = go.GetComponent<AdaCore>();
            core.player = player;
            core.dialogue = dialogue;
        }

        // ------------------------------------------------------------ Polvo

        void BuildDust()
        {
            var go = new GameObject("Polvo");
            go.transform.position = new Vector3(0f, groundY + 4f, 1f);

            var particles = go.AddComponent<ParticleSystem>();
            var main = particles.main;
            main.startLifetime = 14f;
            main.startSpeed = 0.25f;
            main.startSize = 0.04f;
            main.startColor = new Color(1f, 0.84f, 0.69f, 0.35f);
            main.maxParticles = 260;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = -0.012f;

            var emission = particles.emission;
            emission.rateOverTime = 18f;

            var shape = particles.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(levelRight - levelLeft, 9f, 1f);

            var renderer = go.GetComponent<ParticleSystemRenderer>();
            renderer.material = new Material(Shader.Find("Sprites/Default"));
            renderer.sortingOrder = 15;
        }

        // ------------------------------------------------------------ Apoyo

        void Intro()
        {
            var controller = player.GetComponent<PlayerController>();
            controller.ControlsLocked = true;

            dialogue.Finished = () =>
            {
                controller.ControlsLocked = false;
                dialogue.Finished = null;
            };

            dialogue.Say("TRAJE EVA",
                "Despiertas.",
                "El visor marca 0,91 atmósferas y un 19 % de oxígeno. " +
                "Respirable. No deberías poder respirar en ningún sitio al que " +
                "te haya traído un agujero de gusano.",
                "El asistente de misión no responde. El enlace con Houston " +
                "tampoco. Llevas sin señal un tiempo que el reloj no sabe medir.",
                "Hay algo encendido hacia el este. Es lo único encendido " +
                "en kilómetros.",
                "A y D para caminar. Espacio para saltar.");
        }

        static GameObject NewSprite(string name, Sprite sprite, Color color, int order)
        {
            var go = new GameObject(name, typeof(SpriteRenderer));
            var renderer = go.GetComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            renderer.color = color;
            renderer.sortingOrder = order;
            return go;
        }
    }
}
