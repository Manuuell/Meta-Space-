using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace MetaSpace.UI
{
    /// <summary>
    /// La voz de ADA. Una caja abajo, una linea cada vez, y el texto escribiendose
    /// letra a letra: en un planeta vacio el ritmo del dialogo es casi todo el
    /// ritmo del juego.
    /// </summary>
    public class DialogueUI : MonoBehaviour
    {
        public float charactersPerSecond = 42f;

        readonly Queue<string> pending = new Queue<string>();

        RectTransform panel;
        Text speaker, body, hint;
        string current = string.Empty;
        float revealed;
        bool open;

        public bool IsOpen => open;
        public System.Action Finished;

        void Awake() => Build();

        public void Say(string who, params string[] lines)
        {
            speaker.text = who.ToUpperInvariant();
            foreach (var line in lines) pending.Enqueue(line);
            if (!open) Advance();
        }

        void Update()
        {
            if (!open) return;

            revealed += charactersPerSecond * Time.deltaTime;
            int shown = Mathf.Clamp(Mathf.FloorToInt(revealed), 0, current.Length);
            body.text = current.Substring(0, shown);

            bool complete = shown >= current.Length;
            hint.text = complete
                ? (pending.Count > 0 ? "[ESPACIO] seguir" : "[ESPACIO] cerrar")
                : string.Empty;

            var keyboard = Keyboard.current;
            if (keyboard == null) return;

            if (keyboard.spaceKey.wasPressedThisFrame || keyboard.enterKey.wasPressedThisFrame)
            {
                // Primera pulsacion: completar la linea. Segunda: pasar de linea.
                if (!complete) revealed = current.Length;
                else Advance();
            }
        }

        void Advance()
        {
            if (pending.Count == 0)
            {
                open = false;
                panel.gameObject.SetActive(false);
                Finished?.Invoke();
                return;
            }

            current = pending.Dequeue();
            revealed = 0f;
            open = true;
            panel.gameObject.SetActive(true);
        }

        void Build()
        {
            var canvasGo = new GameObject("DialogueCanvas",
                typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);

            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;

            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

            panel = NewRect("Panel", canvasGo.transform, new Color(0.03f, 0.016f, 0.027f, 0.88f));
            panel.anchorMin = new Vector2(0.5f, 0f);
            panel.anchorMax = new Vector2(0.5f, 0f);
            panel.pivot = new Vector2(0.5f, 0f);
            panel.sizeDelta = new Vector2(880, 132);
            panel.anchoredPosition = new Vector2(0f, 48f);

            var accent = NewRect("Accent", panel, new Color(0.33f, 0.90f, 0.82f));
            accent.anchorMin = new Vector2(0f, 0f);
            accent.anchorMax = new Vector2(0f, 1f);
            accent.offsetMin = Vector2.zero;
            accent.offsetMax = new Vector2(3f, 0f);

            speaker = NewText("Speaker", panel, font, 12, new Color(0.55f, 1f, 0.93f));
            speaker.fontStyle = FontStyle.Bold;
            var speakerRect = speaker.rectTransform;
            speakerRect.anchorMin = new Vector2(0f, 1f);
            speakerRect.anchorMax = new Vector2(1f, 1f);
            speakerRect.offsetMin = new Vector2(26f, -40f);
            speakerRect.offsetMax = new Vector2(-26f, -16f);

            body = NewText("Body", panel, font, 17, new Color(0.90f, 0.86f, 0.84f));
            var bodyRect = body.rectTransform;
            bodyRect.anchorMin = new Vector2(0f, 0f);
            bodyRect.anchorMax = new Vector2(1f, 1f);
            bodyRect.offsetMin = new Vector2(26f, 34f);
            bodyRect.offsetMax = new Vector2(-26f, -44f);

            hint = NewText("Hint", panel, font, 11, new Color(0.62f, 0.54f, 0.52f));
            hint.alignment = TextAnchor.LowerRight;
            var hintRect = hint.rectTransform;
            hintRect.anchorMin = new Vector2(0f, 0f);
            hintRect.anchorMax = new Vector2(1f, 0f);
            hintRect.offsetMin = new Vector2(26f, 12f);
            hintRect.offsetMax = new Vector2(-26f, 30f);

            panel.gameObject.SetActive(false);
        }

        static RectTransform NewRect(string name, Transform parent, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            go.AddComponent<Image>().color = color;
            return (RectTransform)go.transform;
        }

        static Text NewText(string name, Transform parent, Font font, int size, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var text = go.AddComponent<Text>();
            text.font = font;
            text.fontSize = size;
            text.color = color;
            text.alignment = TextAnchor.UpperLeft;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            return text;
        }
    }
}
