using MetaSpace.UI;
using UnityEngine;
using UnityEngine.InputSystem;

namespace MetaSpace.World
{
    /// <summary>
    /// El Meta Space tirado en la arena. Lo que recoges no es un objeto: es el
    /// personaje que te acompana el resto del juego, asi que el momento tiene
    /// su propio dialogo y su propio silencio antes.
    /// </summary>
    public class AdaCore : MonoBehaviour
    {
        public Transform player;
        public DialogueUI dialogue;
        public float reach = 1.6f;

        SpriteRenderer coreSprite, glowSprite;
        Transform prompt;
        bool taken;
        float bobPhase;

        /// <summary>
        /// En Start y no en Awake: el objeto se crea ya con este componente, asi
        /// que Awake corre antes de que la escena le cuelgue el nucleo, el halo
        /// y el aviso. Buscarlos ahi devolvia null y, en silencio, nada de esto
        /// se apagaba al recogerla.
        /// </summary>
        void Start()
        {
            // Los dos por nombre. GetComponentInChildren devuelve el primero que
            // encuentra, que era el halo, asi que al recogerla se apagaba el
            // resplandor y el nucleo se quedaba tirado en la arena.
            foreach (var renderer in GetComponentsInChildren<SpriteRenderer>())
            {
                if (renderer.gameObject.name == "Glow") glowSprite = renderer;
                else if (renderer.gameObject.name == "Nucleo") coreSprite = renderer;
            }

            var promptObject = transform.Find("Prompt");
            if (promptObject != null) prompt = promptObject;
        }

        void Update()
        {
            // Latido lento: delata que sigue encendida sin ser una baliza.
            bobPhase += Time.deltaTime;
            float pulse = 0.82f + Mathf.Sin(bobPhase * 1.7f) * 0.18f;
            if (glowSprite != null)
            {
                var c = glowSprite.color;
                glowSprite.color = new Color(c.r, c.g, c.b, taken ? 0f : 0.42f * pulse);
                glowSprite.transform.localScale = Vector3.one * (3.2f + pulse * 0.5f);
            }

            if (taken || player == null) return;

            bool near = Mathf.Abs(player.position.x - transform.position.x) < reach;
            if (prompt != null) prompt.gameObject.SetActive(near);

            var keyboard = Keyboard.current;
            if (!near || keyboard == null) return;

            if (keyboard.eKey.wasPressedThisFrame)
                Take();
        }

        void Take()
        {
            taken = true;
            if (prompt != null) prompt.gameObject.SetActive(false);
            if (coreSprite != null) coreSprite.enabled = false;
            if (glowSprite != null) glowSprite.enabled = false;

            var controller = player.GetComponent<PlayerController>();
            if (controller != null) controller.ControlsLocked = true;

            dialogue.Finished = () =>
            {
                if (controller != null) controller.ControlsLocked = false;
                dialogue.Finished = null;
            };

            dialogue.Say("ADA",
                "…",
                "Reiniciando. Sectores de memoria 1 a 40: corruptos.",
                "Identifícate. No reconozco tu traje ni tu agencia.",
                "¿ARES-IX? Esa misión no figura en ningún registro mío. " +
                "Y mis registros llegan muy atrás.",
                "Da igual. Estás vivo y yo funciono. Es más de lo que había hace " +
                "un minuto.",
                "No sé dónde estamos. No sé cuánto tiempo ha pasado. " +
                "Lo que sí sé es que algo me estaba buscando antes de apagarme.",
                "Camina. Si encuentras algo fabricado, lo escaneo. " +
                "Necesito saber qué pasó aquí tanto como tú.");
        }
    }
}
