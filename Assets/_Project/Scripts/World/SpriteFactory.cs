using UnityEngine;

namespace MetaSpace.World
{
    /// <summary>
    /// Dibuja el arte del planeta por codigo. Sin dibujante, las siluetas planas
    /// del boceto son justo lo que se puede generar bien: formas solidas, pocos
    /// colores y mucho contraste. Ademas el repositorio no carga con imagenes.
    ///
    /// Todo se genera una vez al arrancar y se cachea.
    /// </summary>
    public static class SpriteFactory
    {
        public const int PixelsPerUnit = 100;

        // Paleta del boceto 2D: cielo de sulfatos, ruina en sombra, cian de ADA.
        public static readonly Color SkyTop    = Hex("1A0A10");
        public static readonly Color SkyMid    = Hex("43171C");
        public static readonly Color SkyHorizon= Hex("6E2821");
        public static readonly Color Far       = Hex("4A1C22");
        public static readonly Color Mid       = Hex("33131A");
        public static readonly Color Near      = Hex("1E0C12");
        public static readonly Color Ground    = Hex("0B0509");
        public static readonly Color Rim       = Hex("6E2821");
        public static readonly Color Cyan      = Hex("8CFFEC");

        static Sprite sky, ground, player, core, glow;

        // ------------------------------------------------------------ Cielo

        public static Sprite Sky()
        {
            if (sky != null) return sky;

            var tex = New(4, 256);
            for (int y = 0; y < 256; y++)
            {
                float t = y / 255f;
                Color c = t > 0.55f
                    ? Color.Lerp(SkyMid, SkyTop, (t - 0.55f) / 0.45f)
                    : Color.Lerp(SkyHorizon, SkyMid, t / 0.55f);
                for (int x = 0; x < 4; x++) tex.SetPixel(x, y, c);
            }
            tex.Apply();
            sky = ToSprite(tex);
            return sky;
        }

        // --------------------------------------------------------- Horizonte

        /// <summary>
        /// Una capa de ruinas. El ruido viene de una semilla fija: el planeta
        /// debe verse igual en cada partida, no distinto cada vez que se abre.
        /// </summary>
        public static Sprite Skyline(int seed, int width, int height, Color color, float density)
        {
            var random = new System.Random(seed);
            var tex = New(width, height);
            Clear(tex);

            int x = 0;
            while (x < width)
            {
                int buildingWidth = random.Next(12, 46);
                int buildingHeight = (int)(height * Mathf.Lerp(0.18f, 0.92f, (float)random.NextDouble()) * density);

                if (random.NextDouble() > 0.18f)
                {
                    FillRect(tex, x, 0, buildingWidth, buildingHeight, color);

                    // Rotura: a estas torres les falta la coronacion.
                    if (random.NextDouble() > 0.55f)
                    {
                        int notch = random.Next(4, buildingWidth / 2 + 5);
                        int depth = random.Next(4, Mathf.Max(6, buildingHeight / 4));
                        FillRect(tex, x + buildingWidth - notch, buildingHeight - depth, notch, depth, Color.clear);
                    }

                    // Alguna antena suelta.
                    if (random.NextDouble() > 0.75f)
                        FillRect(tex, x + buildingWidth / 2, buildingHeight, 2, random.Next(6, 22), color);
                }

                x += buildingWidth + random.Next(2, 14);
            }

            tex.Apply();
            return ToSprite(tex);
        }

        // ------------------------------------------------------------ Suelo

        public static Sprite GroundStrip()
        {
            if (ground != null) return ground;

            const int w = 512, h = 128;
            var tex = New(w, h);
            Clear(tex);

            var random = new System.Random(7);
            for (int x = 0; x < w; x++)
            {
                // Perfil suave con dos senos y un poco de grano: duna, no sierra.
                float profile = Mathf.Sin(x * 0.012f) * 5f + Mathf.Sin(x * 0.047f) * 2.5f;
                int top = h - 18 + Mathf.RoundToInt(profile) - random.Next(0, 2);

                for (int y = 0; y < top; y++) tex.SetPixel(x, y, Ground);
                tex.SetPixel(x, top, Rim);
                if (top > 0) tex.SetPixel(x, top - 1, Color.Lerp(Ground, Rim, 0.45f));
            }

            tex.Apply();
            tex.wrapMode = TextureWrapMode.Repeat;
            ground = ToSprite(tex);
            return ground;
        }

        // ------------------------------------------------------- Astronauta

        /// <summary>
        /// Silueta pequena, de frente al lado derecho, con luz de borde cian.
        /// El personaje es diminuto a proposito: el vacio alrededor es el tema.
        /// </summary>
        public static Sprite Astronaut()
        {
            if (player != null) return player;

            const int w = 28, h = 40;
            var tex = New(w, h);
            Clear(tex);

            var body = Hex("070306");

            FillRect(tex, 8, 2, 5, 12, body);       // pierna trasera
            FillRect(tex, 15, 2, 5, 12, body);      // pierna delantera
            FillRoundedRect(tex, 7, 12, 14, 16, 3, body);  // torso
            FillRect(tex, 4, 15, 4, 11, body);      // mochila
            FillCircle(tex, 14, 31, 7, body);       // casco

            // Visera: el unico punto calido de la figura.
            FillCircle(tex, 16, 32, 4, Hex("FFB771"));
            FillCircle(tex, 17, 33, 2, Hex("FFD9B8"));

            // Luz de borde por el lado del resplandor de ADA.
            for (int y = 0; y < h; y++)
                for (int x = w - 1; x >= 0; x--)
                    if (tex.GetPixel(x, y).a > 0.5f)
                    {
                        tex.SetPixel(x, y, Color.Lerp(tex.GetPixel(x, y), Cyan, 0.55f));
                        break;
                    }

            tex.Apply();
            player = ToSprite(tex);
            return player;
        }

        // --------------------------------------------------------- Meta Space

        public static Sprite Core()
        {
            if (core != null) return core;

            const int w = 14, h = 22;
            var tex = New(w, h);
            Clear(tex);

            FillRoundedRect(tex, 1, 1, 12, 20, 5, Hex("C8FFF4"));
            FillRoundedRect(tex, 3, 4, 8, 14, 3, Hex("FFFFFF"));
            FillRect(tex, 6, 20, 2, 2, Cyan);

            tex.Apply();
            core = ToSprite(tex);
            return core;
        }

        /// <summary>Halo radial para el resplandor y las luces de ambiente.</summary>
        public static Sprite Glow()
        {
            if (glow != null) return glow;

            const int size = 128;
            var tex = New(size, size);
            float r = size / 2f;

            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float d = Vector2.Distance(new Vector2(x, y), new Vector2(r, r)) / r;
                    float a = Mathf.Clamp01(1f - d);
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, a * a * a));
                }

            tex.Apply();
            glow = ToSprite(tex);
            return glow;
        }

        public static Sprite Solid()
        {
            var tex = New(4, 4);
            for (int y = 0; y < 4; y++)
                for (int x = 0; x < 4; x++) tex.SetPixel(x, y, Color.white);
            tex.Apply();
            return ToSprite(tex);
        }

        // ----------------------------------------------------------- Dibujo

        static Texture2D New(int w, int h)
        {
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp
            };
            return tex;
        }

        static void Clear(Texture2D tex)
        {
            var pixels = new Color[tex.width * tex.height];
            tex.SetPixels(pixels);
        }

        static void FillRect(Texture2D tex, int x0, int y0, int w, int h, Color c)
        {
            for (int y = y0; y < y0 + h; y++)
                for (int x = x0; x < x0 + w; x++)
                    if (x >= 0 && y >= 0 && x < tex.width && y < tex.height)
                        tex.SetPixel(x, y, c);
        }

        static void FillCircle(Texture2D tex, int cx, int cy, int radius, Color c)
        {
            for (int y = cy - radius; y <= cy + radius; y++)
                for (int x = cx - radius; x <= cx + radius; x++)
                {
                    if (x < 0 || y < 0 || x >= tex.width || y >= tex.height) continue;
                    int dx = x - cx, dy = y - cy;
                    if (dx * dx + dy * dy <= radius * radius) tex.SetPixel(x, y, c);
                }
        }

        static void FillRoundedRect(Texture2D tex, int x0, int y0, int w, int h, int radius, Color c)
        {
            FillRect(tex, x0 + radius, y0, w - radius * 2, h, c);
            FillRect(tex, x0, y0 + radius, w, h - radius * 2, c);
            FillCircle(tex, x0 + radius, y0 + radius, radius, c);
            FillCircle(tex, x0 + w - radius - 1, y0 + radius, radius, c);
            FillCircle(tex, x0 + radius, y0 + h - radius - 1, radius, c);
            FillCircle(tex, x0 + w - radius - 1, y0 + h - radius - 1, radius, c);
        }

        public static Sprite ToSprite(Texture2D tex)
            => Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height),
                             new Vector2(0.5f, 0f), PixelsPerUnit, 0, SpriteMeshType.FullRect);

        static Color Hex(string hex)
            => ColorUtility.TryParseHtmlString("#" + hex, out var c) ? c : Color.magenta;
    }
}
