using System.Collections.Generic;
using System.Linq;
using MetaSpace.Mission;
using UnityEngine;
using UnityEngine.UI;

namespace MetaSpace.UI
{
    /// <summary>
    /// El banco de trabajo: catalogo a la izquierda, nave en el centro,
    /// presupuestos a la derecha. Todo se recalcula en cuanto tocas una pieza,
    /// porque la regla del juego es que veas lo que acabas de perder.
    ///
    /// La interfaz se construye por codigo a proposito: cabe en un archivo que
    /// se lee y se versiona, en vez de en una escena que hay que abrir para
    /// saber que tiene dentro.
    /// </summary>
    public class WorkbenchUI : MonoBehaviour
    {
        // Paleta del mockup 2D: tierra oscura, cian de ADA, ambar de aviso.
        static readonly Color Bg       = Hex("0E0A0C");
        static readonly Color Panel    = Hex("16100F");
        static readonly Color PanelAlt = Hex("1C1512");
        static readonly Color Line     = Hex("2A1F1C");
        static readonly Color Ink      = Hex("E8DFD8");
        static readonly Color Dim      = Hex("9A8A84");
        static readonly Color Cyan     = Hex("55E6D0");
        static readonly Color Warn     = Hex("E8894A");
        static readonly Color Bad      = Hex("D4553F");

        static Font font;

        CatalogAsset catalog;
        MissionDesign design;

        /// <summary>
        /// Reliquias ya escaneadas. Vacio de inicio: la mitad del catalogo nace
        /// bloqueado, que es la progresion del juego. Cuando exista la fase de
        /// exploracion, la escena entregara aqui lo que el jugador haya escaneado.
        /// </summary>
        readonly HashSet<string> scannedRelics = new HashSet<string>();

        bool showLocked;
        MissionOutcome.Result? outcome;

        RectTransform catalogList, shipList;
        Text verdictText, deltaVText, twrText, reliabilityText, dataText, blockerText, launchLabel;
        Bar massBar, powerBar, scrapBar;

        void Start()
        {
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

            catalog = CatalogAsset.Load();
            if (catalog == null)
            {
                Debug.LogError("[Banco] No hay Catalog.asset en Resources. " +
                               "Ejecuta Meta Space > Regenerar catalogo.");
                return;
            }

            design = new MissionDesign();
            design.Changed += Refresh;

            Build();
            RefreshCatalog();
            Refresh();

            // Confirmacion positiva para la prueba de humo: sin esta linea, un
            // arranque limpio y uno donde la interfaz no se construyo se leen igual.
            Debug.Log($"[Banco] Listo con {catalog.parts.Length} piezas y " +
                      $"{catalog.relics.Length} reliquias. " +
                      $"EventSystem: {UnityEngine.EventSystems.EventSystem.current != null}");
        }

        // ---------------------------------------------------------------- UI

        void Build()
        {
            var canvasGo = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);

            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;

            var root = Rect("Root", canvasGo.transform, Bg);
            Stretch(root);

            // El armazon va con anclajes explicitos, no con grupos de
            // maquetacion. Los grupos reparten el espacio segun media docena de
            // interruptores cuyos valores por defecto cambian entre versiones, y
            // una columna mal estirada no da error: simplemente aparece flotando
            // en mitad de la pantalla. Con anclajes, donde va cada panel se lee
            // en una linea. Dentro de las listas si valen la pena, y ahi funcionan.
            BuildHeader(root);

            catalogList = BuildColumn(root, "CATÁLOGO",
                new Vector2(0, 0), new Vector2(0, 1),
                new Vector2(0, 0), new Vector2(CatalogWidth, -HeaderHeight));

            shipList = BuildColumn(root, "NAVE",
                new Vector2(0, 0), new Vector2(1, 1),
                new Vector2(CatalogWidth + 1, 0), new Vector2(-(BudgetWidth + 1), -HeaderHeight));

            BuildBudgets(root);
        }

        const float HeaderHeight = 54f;
        const float CatalogWidth = 360f;
        const float BudgetWidth = 392f;
        const float TitleHeight = 34f;

        void BuildHeader(RectTransform parent)
        {
            var header = Rect("Header", parent, PanelAlt);
            Place(header, new Vector2(0, 1), new Vector2(1, 1),
                new Vector2(0, -HeaderHeight), new Vector2(0, 0));

            var layout = header.gameObject.AddComponent<HorizontalLayoutGroup>();
            layout.padding = new RectOffset(22, 22, 0, 0);
            layout.childAlignment = TextAnchor.MiddleLeft;
            layout.childControlWidth = true;
            layout.childForceExpandWidth = false;

            var title = Label(header, "BANCO DE TRABAJO", 17, Ink, TextAnchor.MiddleLeft);
            title.fontStyle = FontStyle.Bold;
            Flexible(title.rectTransform, 1f);

            Label(header, "SOL 14  ·  META SPACE", 12, Dim, TextAnchor.MiddleRight);
        }

        RectTransform BuildColumn(RectTransform parent, string title,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax)
        {
            var column = Rect(title, parent, Panel);
            Place(column, anchorMin, anchorMax, offsetMin, offsetMax);

            SectionTitle(column, title);

            // Lista con scroll: viewport recortado + contenido que crece solo.
            var scrollGo = Rect("Scroll", column, Color.clear);
            Place(scrollGo, new Vector2(0, 0), new Vector2(1, 1),
                new Vector2(0, 0), new Vector2(0, -TitleHeight));
            var scroll = scrollGo.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.scrollSensitivity = 24f;

            var viewport = Rect("Viewport", scrollGo, Color.clear);
            Stretch(viewport);
            viewport.gameObject.AddComponent<RectMask2D>();
            scroll.viewport = viewport;

            var content = Rect("Content", viewport, Color.clear);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            // Un RectTransform nuevo nace con sizeDelta 100x100. Con los anclajes
            // estirados en horizontal eso son 100 px DE MAS que el viewport, 50
            // por lado, y la lista aparece recortada por ambos extremos.
            content.sizeDelta = Vector2.zero;
            content.anchoredPosition = Vector2.zero;
            scroll.content = content;
            scroll.movementType = ScrollRect.MovementType.Clamped;

            var contentLayout = content.gameObject.AddComponent<VerticalLayoutGroup>();
            contentLayout.padding = new RectOffset(12, 12, 8, 16);
            contentLayout.spacing = 4;
            contentLayout.childControlHeight = true;
            contentLayout.childControlWidth = true;
            contentLayout.childForceExpandHeight = false;

            var fitter = content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            return content;
        }

        void BuildBudgets(RectTransform parent)
        {
            var column = Rect("Presupuestos", parent, Panel);
            Place(column, new Vector2(1, 0), new Vector2(1, 1),
                new Vector2(-BudgetWidth, 0), new Vector2(0, -HeaderHeight));

            SectionTitle(column, "PRESUPUESTOS");

            var pad = Rect("Pad", column, Color.clear);
            Place(pad, new Vector2(0, 0), new Vector2(1, 1),
                new Vector2(0, 0), new Vector2(0, -TitleHeight));
            var padLayout = pad.gameObject.AddComponent<VerticalLayoutGroup>();
            padLayout.padding = new RectOffset(18, 18, 10, 10);
            padLayout.spacing = 12;
            padLayout.childControlHeight = true;
            padLayout.childControlWidth = true;
            padLayout.childForceExpandHeight = false;

            massBar  = new Bar(pad, "MASA");
            powerBar = new Bar(pad, "POTENCIA");
            scrapBar = new Bar(pad, "CHATARRA");

            Separator(pad);

            deltaVText      = Readout(pad, "DELTA-V");
            twrText         = Readout(pad, "EMPUJE / PESO");
            reliabilityText = Readout(pad, "FIABILIDAD");
            dataText        = Readout(pad, "CIENCIA ENVIABLE");

            Separator(pad);

            verdictText = Label(pad, "—", 20, Dim, TextAnchor.MiddleLeft);
            verdictText.fontStyle = FontStyle.Bold;
            Height(verdictText.rectTransform, 30);

            // El panel de ADA: un motivo por linea, el mas grave primero.
            var ada = Rect("ADA", pad, PanelAlt);
            var adaLayout = ada.gameObject.AddComponent<VerticalLayoutGroup>();
            adaLayout.padding = new RectOffset(14, 14, 12, 14);
            adaLayout.spacing = 6;
            adaLayout.childControlHeight = true;
            adaLayout.childControlWidth = true;
            adaLayout.childForceExpandHeight = false;

            var adaTitle = Label(ada, "ADA", 10, Cyan, TextAnchor.UpperLeft);
            adaTitle.fontStyle = FontStyle.Bold;
            Height(adaTitle.rectTransform, 14);

            blockerText = Label(ada, "", 12, Ink, TextAnchor.UpperLeft);
            var blockerFitter = blockerText.gameObject.AddComponent<ContentSizeFitter>();
            blockerFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            var launchRow = Rect("Lanzar", pad, Line);
            Height(launchRow, 44);
            Clickable(launchRow, OnLaunchPressed);
            launchLabel = Label(launchRow, "LANZAR MISIÓN", 14, Line, TextAnchor.MiddleCenter);
            launchLabel.fontStyle = FontStyle.Bold;
            Stretch(launchLabel.rectTransform);
        }

        /// <summary>
        /// Lanzar resuelve el diseno a uno de los finales. No hay menu de finales:
        /// el final es consecuencia de lo que el jugador construyo, y el informe
        /// le dice que decision concreta lo causo.
        /// </summary>
        void OnLaunchPressed()
        {
            if (outcome.HasValue)
            {
                outcome = null;
                RefreshBudgets();
                return;
            }

            if (!design.IsFlightReady) return;

            bool hasLifeSupport = design.Parts.Any(p => p.slot == PartSlot.LifeSupport);
            outcome = MissionOutcome.Resolve(design, adaSurrendered: false, hasLifeSupport: hasLifeSupport);
            RefreshBudgets();
        }

        // ----------------------------------------------------------- Refresco

        /// <summary>
        /// Montar una pieza no cambia el catalogo, asi que no hay por que
        /// reconstruirlo: solo se rehace al arrancar y al cambiar los bloqueos.
        /// Ademas evita destruir bajo el raton la misma fila que se acaba de pulsar.
        /// </summary>
        void Refresh()
        {
            RefreshShip();
            RefreshBudgets();
        }

        void RefreshCatalog()
        {
            Clear(catalogList);

            // Agrupadas por ranura, para que se lea como un catalogo y no como
            // una lista plana de veinte cosas.
            foreach (PartSlot slot in System.Enum.GetValues(typeof(PartSlot)))
            {
                var parts = catalog.InSlot(slot);
                if (parts.Length == 0) continue;

                var heading = Label(catalogList, SlotName(slot).ToUpperInvariant(), 10, Dim, TextAnchor.LowerLeft);
                Height(heading.rectTransform, 22);

                foreach (var part in parts)
                {
                    var p = part;
                    bool locked = !string.IsNullOrEmpty(p.unlockedByRelicId) &&
                                  !scannedRelics.Contains(p.unlockedByRelicId) &&
                                  !showLocked;
                    CatalogRow(p, locked, () => design.Add(p));
                }
            }
        }

        void CatalogRow(PartDefinition part, bool locked, System.Action onAdd)
        {
            var row = Rect("Row", catalogList, locked ? Panel : PanelAlt);
            Height(row, 68);

            // La fila entera es el boton. Un cuadradito de 30 px es un objetivo
            // absurdo para pulsar, y ademas deja la mayor parte de la fila muerta.
            if (!locked) Clickable(row, onAdd);

            var layout = row.gameObject.AddComponent<HorizontalLayoutGroup>();
            layout.padding = new RectOffset(10, 8, 6, 6);
            layout.spacing = 6;
            layout.childAlignment = TextAnchor.MiddleLeft;
            layout.childControlWidth = true;
            layout.childForceExpandWidth = false;

            var texts = Rect("Texts", row, Color.clear);
            Flexible(texts, 1f);
            var textLayout = texts.gameObject.AddComponent<VerticalLayoutGroup>();
            textLayout.childAlignment = TextAnchor.UpperLeft;
            textLayout.childControlHeight = true;
            textLayout.childForceExpandHeight = false;
            textLayout.spacing = 1;

            var name = Label(texts, part.displayName, 12, locked ? Dim : Ink, TextAnchor.LowerLeft);
            Height(name.rectTransform, 16);

            var spec = Label(texts, Spec(part), 10, locked ? Line : Dim, TextAnchor.UpperLeft);
            Height(spec.rectTransform, 13);

            // La descripcion es donde el juego ensena la compensacion. Si hay que
            // pasar el raton o abrir un panel para verla, nadie la lee.
            string note = locked
                ? "Bloqueada · hace falta escanear su reliquia"
                : part.description;
            var desc = Label(texts, note, 9, locked ? Warn : Dim, TextAnchor.UpperLeft);
            Height(desc.rectTransform, 26);

            Glyph(row, locked ? "·" : "+");
        }

        void RefreshShip()
        {
            Clear(shipList);

            if (design.Parts.Count == 0)
            {
                var empty = Label(shipList, "La nave está vacía.\nAñade piezas desde el catálogo.",
                    12, Dim, TextAnchor.UpperLeft);
                Height(empty.rectTransform, 50);
                return;
            }

            foreach (var group in design.Parts.GroupBy(p => p.slot).OrderBy(g => g.Key))
            {
                var heading = Label(shipList, SlotName(group.Key).ToUpperInvariant(), 10, Dim, TextAnchor.LowerLeft);
                Height(heading.rectTransform, 22);

                // Las repetidas actuan como redundancia, asi que importa verlas
                // como lineas separadas y no agrupadas con un contador.
                foreach (var part in group)
                {
                    var p = part;
                    var row = Rect("Row", shipList, PanelAlt);
                    Height(row, 40);
                    Clickable(row, () => design.Remove(p));

                    var layout = row.gameObject.AddComponent<HorizontalLayoutGroup>();
                    layout.padding = new RectOffset(12, 8, 0, 0);
                    layout.spacing = 8;
                    layout.childAlignment = TextAnchor.MiddleLeft;
                    layout.childControlWidth = true;
                    layout.childForceExpandWidth = false;

                    var name = Label(row, p.displayName, 12, Ink, TextAnchor.MiddleLeft);
                    Flexible(name.rectTransform, 1f);

                    var spec = Label(row, Spec(p), 10, Dim, TextAnchor.MiddleRight);
                    Width(spec.rectTransform, 190);

                    Glyph(row, "−");
                }
            }
        }

        void RefreshBudgets()
        {
            var limits = design.Limits;

            massBar.Set(design.WetMassKg, limits.maxMassKg, $"{design.WetMassKg:0} / {limits.maxMassKg:0} kg",
                design.OverMass);

            // La potencia no tiene "maximo": se llena segun lo generado y se
            // pone en rojo cuando consumes mas de lo que produces.
            powerBar.Set(design.PowerDrawW, Mathf.Max(design.PowerGeneratedW, 1f),
                $"{design.PowerDrawW:0} de {design.PowerGeneratedW:0} W", design.PowerStarved);

            scrapBar.Set(design.ScrapSpent, limits.availableScrap,
                $"{design.ScrapSpent} / {limits.availableScrap}", design.OverBudget);

            deltaVText.text = $"{design.DeltaVms:0} / {limits.requiredDeltaV:0} m/s";
            deltaVText.color = design.DeltaVms >= limits.requiredDeltaV ? Cyan : Warn;

            twrText.text = design.TotalThrustN > 0f ? $"{design.ThrustToWeight:0.00}" : "sin motor";
            twrText.color = design.ThrustToWeight >= 1.2f ? Cyan : Warn;

            reliabilityText.text = $"{design.MissionReliability:P1}";
            reliabilityText.color = design.MissionReliability >= 0.9f ? Cyan : Warn;

            dataText.text = design.DataGeneratedMb > 0f
                ? $"{design.DataTransmittableMb():0} / {design.DataGeneratedMb:0} Mb"
                : "sin instrumentos";
            dataText.color = design.DataGeneratedMb > 0f &&
                             design.DataTransmittableMb() < design.DataGeneratedMb ? Warn : Dim;

            bool ready = design.IsFlightReady;
            verdictText.text = ready ? "LISTA PARA LANZAR" : "NO DESPEGA";
            verdictText.color = ready ? Cyan : Bad;

            var blockers = design.Blockers().ToList();
            if (blockers.Count == 0)
            {
                blockerText.text = design.CanTransmitHome
                    ? "«Los números cuadran. Y además podremos contarlo.»"
                    : "«Los números cuadran. Pero volverás sin una sola prueba.»";
                blockerText.color = Dim;
            }
            else
            {
                blockerText.text = string.Join("\n", blockers.Select(b => "· " + b));
                blockerText.color = Ink;
            }

            launchLabel.text = "LANZAR MISIÓN";
            launchLabel.color = ready ? Cyan : Line;

            // Tras lanzar, el panel deja de ser un diagnostico y pasa a ser el
            // informe de mision: el final obtenido y por que decision.
            if (outcome.HasValue)
            {
                var result = outcome.Value;
                verdictText.text = result.headline.ToUpperInvariant();
                verdictText.color = result.ending == Ending.LastSignal ||
                                    result.ending == Ending.Gardener ? Cyan : Warn;

                blockerText.text = result.decidingFactor + "\n\n" +
                                   string.Join("\n", result.report);
                blockerText.color = Ink;

                launchLabel.text = "VOLVER AL DISEÑO";
                launchLabel.color = Ink;
            }
        }

        // ------------------------------------------------------------ Helpers

        static string Spec(PartDefinition p)
        {
            var bits = new List<string> { $"{p.massKg:0} kg" };
            if (!Mathf.Approximately(p.powerW, 0f)) bits.Add($"{p.powerW:+0;-0} W");
            if (p.propellantKg > 0f) bits.Add($"+{p.propellantKg:0} kg prop.");
            if (p.IsEngine) bits.Add($"Isp {p.specificImpulseSec:0}");
            if (p.downlinkMbps > 0f) bits.Add($"{p.downlinkMbps:0.0} Mbps");
            if (p.dataGeneratedMb > 0f) bits.Add($"{p.dataGeneratedMb:0} Mb");
            bits.Add($"{p.scrapCost} ch.");
            return string.Join("  ·  ", bits);
        }

        static string SlotName(PartSlot slot) => slot switch
        {
            PartSlot.Structure       => "Estructura",
            PartSlot.Propulsion      => "Propulsión",
            PartSlot.Power           => "Energía",
            PartSlot.Communications  => "Comunicaciones",
            PartSlot.Science         => "Ciencia",
            PartSlot.LifeSupport     => "Soporte vital",
            PartSlot.Redundancy      => "Redundancia",
            PartSlot.Countermeasures => "Contramedidas",
            _                        => slot.ToString()
        };

        void SectionTitle(RectTransform parent, string text)
        {
            var bar = Rect("Title", parent, PanelAlt);
            Place(bar, new Vector2(0, 1), new Vector2(1, 1),
                new Vector2(0, -TitleHeight), new Vector2(0, 0));
            var layout = bar.gameObject.AddComponent<HorizontalLayoutGroup>();
            layout.padding = new RectOffset(14, 14, 0, 0);
            layout.childAlignment = TextAnchor.MiddleLeft;
            var label = Label(bar, text, 11, Cyan, TextAnchor.MiddleLeft);
            label.fontStyle = FontStyle.Bold;
        }

        void Separator(RectTransform parent)
        {
            var sep = Rect("Separator", parent, Line);
            Height(sep, 1);
        }

        Text Readout(RectTransform parent, string label)
        {
            var row = Rect("Readout", parent, Color.clear);
            Height(row, 20);
            var layout = row.gameObject.AddComponent<HorizontalLayoutGroup>();
            layout.childControlWidth = true;
            layout.childForceExpandWidth = false;
            layout.childAlignment = TextAnchor.MiddleLeft;

            var name = Label(row, label, 10, Dim, TextAnchor.MiddleLeft);
            Flexible(name.rectTransform, 1f);

            var value = Label(row, "—", 13, Ink, TextAnchor.MiddleRight);
            Width(value.rectTransform, 170);
            return value;
        }

        /// <summary>Hace pulsable un panel entero, usando su propia imagen como objetivo.</summary>
        static void Clickable(RectTransform rt, System.Action onClick)
        {
            var image = rt.GetComponent<Image>();
            if (image == null) return;

            var button = rt.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(() => onClick());

            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.3f, 1.3f, 1.3f);
            colors.pressedColor = new Color(0.6f, 1.6f, 1.5f);
            button.colors = colors;
        }

        /// <summary>El simbolo de la derecha. Decorativo: quien recibe el clic es la fila.</summary>
        static void Glyph(RectTransform parent, string glyph)
        {
            var box = Rect("Glyph", parent, Color.clear);
            Width(box, 30);
            var label = Label(box, glyph, 16, Dim, TextAnchor.MiddleCenter);
            Stretch(label.rectTransform);
            label.raycastTarget = false;
        }

        static void Clear(RectTransform parent)
        {
            for (int i = parent.childCount - 1; i >= 0; i--)
            {
                var child = parent.GetChild(i);
                // Destroy no borra hasta el final del fotograma, asi que las filas
                // viejas siguen contando para la maquetacion mientras se crean las
                // nuevas: la lista se duplica durante un instante y todo se
                // desplaza. Desvincularlas ya las saca del calculo.
                child.SetParent(null, false);
                Destroy(child.gameObject);
            }
        }

        static RectTransform Rect(string name, Transform parent, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            if (color.a > 0f) go.AddComponent<Image>().color = color;
            return (RectTransform)go.transform;
        }

        static Text Label(Transform parent, string text, int size, Color color, TextAnchor anchor)
        {
            var go = new GameObject("Label", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var label = go.AddComponent<Text>();
            label.font = font;
            label.text = text;
            label.fontSize = size;
            label.color = color;
            label.alignment = anchor;
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            // Ningun texto intercepta el raton: quien recibe los clics es el
            // panel que hay debajo, y asi hay menos objetivos que comprobar.
            label.raycastTarget = false;
            return label;
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }

        static void Width(RectTransform rt, float w)
        {
            var element = rt.gameObject.GetComponent<LayoutElement>() ?? rt.gameObject.AddComponent<LayoutElement>();
            element.preferredWidth = w;
            element.minWidth = w;
        }

        static void Height(RectTransform rt, float h)
        {
            var element = rt.gameObject.GetComponent<LayoutElement>() ?? rt.gameObject.AddComponent<LayoutElement>();
            element.preferredHeight = h;
            element.minHeight = h;
        }

        /// <summary>
        /// Coloca un panel por anclajes. offsetMin es la esquina inferior
        /// izquierda y offsetMax la superior derecha, ambas respecto a sus
        /// anclas: valores negativos entran hacia dentro desde el borde.
        /// </summary>
        static void Place(RectTransform rt, Vector2 anchorMin, Vector2 anchorMax,
            Vector2 offsetMin, Vector2 offsetMax)
        {
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.offsetMin = offsetMin;
            rt.offsetMax = offsetMax;
        }

        static void Flexible(RectTransform rt, float weight)
        {
            var element = rt.gameObject.GetComponent<LayoutElement>() ?? rt.gameObject.AddComponent<LayoutElement>();
            element.flexibleWidth = weight;
            element.flexibleHeight = weight;
        }

        static Color Hex(string hex)
            => ColorUtility.TryParseHtmlString("#" + hex, out var c) ? c : Color.magenta;

        /// <summary>Etiqueta, barra de llenado y cifra. Se pone roja al pasarse.</summary>
        class Bar
        {
            readonly Image fill;
            readonly Text value;

            public Bar(RectTransform parent, string label)
            {
                var block = Rect("Bar", parent, Color.clear);
                Height(block, 36);
                var blockLayout = block.gameObject.AddComponent<VerticalLayoutGroup>();
                blockLayout.spacing = 4;
                blockLayout.childControlHeight = true;
                blockLayout.childControlWidth = true;
                blockLayout.childForceExpandHeight = false;

                var head = Rect("Head", block, Color.clear);
                Height(head, 14);
                var headLayout = head.gameObject.AddComponent<HorizontalLayoutGroup>();
                headLayout.childControlWidth = true;
                headLayout.childForceExpandWidth = false;

                var name = Label(head, label, 10, Dim, TextAnchor.MiddleLeft);
                Flexible(name.rectTransform, 1f);

                value = Label(head, "—", 11, Ink, TextAnchor.MiddleRight);
                Width(value.rectTransform, 200);

                var track = Rect("Track", block, Line);
                Height(track, 8);

                fill = Rect("Fill", track, Cyan).GetComponent<Image>();
            }

            public void Set(float current, float max, string text, bool over)
            {
                value.text = text;
                value.color = over ? Bad : Ink;
                fill.color = over ? Bad : Cyan;

                float ratio = max > 0f ? Mathf.Clamp01(current / max) : 0f;

                // Por anclajes y no por tamano: leer el ancho del carril da cero
                // mientras el layout no se ha resuelto, y la primera pintada
                // saldria con todas las barras vacias.
                var rt = (RectTransform)fill.transform;
                rt.anchorMin = Vector2.zero;
                rt.anchorMax = new Vector2(ratio, 1f);
                rt.offsetMin = Vector2.zero;
                rt.offsetMax = Vector2.zero;
            }
        }
    }
}
