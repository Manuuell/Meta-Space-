using System.Collections.Generic;
using System.Linq;
using MetaSpace.Mission;
using UnityEditor;
using UnityEngine;

namespace MetaSpace.EditorTools
{
    /// <summary>
    /// Genera el catalogo inicial de piezas y reliquias como assets.
    /// Las cifras salen de hardware real (MMRTG, LMDE, RL10, red de espacio
    /// profundo) redondeadas a numeros que se puedan leer de un vistazo: el
    /// objetivo es que las compensaciones se entiendan, no simular la NASA.
    /// Se puede volver a ejecutar; sobrescribe lo que haya.
    /// </summary>
    public static class PartCatalogBuilder
    {
        const string PartsPath = "Assets/_Project/Data/Parts";
        const string RelicsPath = "Assets/_Project/Data/Relics";

        static readonly Dictionary<string, PartDefinition> Created = new Dictionary<string, PartDefinition>();

        [MenuItem("Meta Space/Regenerar catalogo")]
        public static void Run()
        {
            Created.Clear();
            Wipe(PartsPath);
            Wipe(RelicsPath);
            BuildParts();
            BuildRelics();
            BuildIndex();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"[Catalogo] {Created.Count} piezas y las reliquias generadas.");
        }

        /// <summary>
        /// Vacia la carpeta antes de generar. Borrar solo la ruta que se va a
        /// escribir no basta: al renombrar una pieza cambia su archivo, el viejo
        /// sobrevive y acaba duplicado en el indice sin que nada falle.
        /// </summary>
        static void Wipe(string folder)
        {
            if (!AssetDatabase.IsValidFolder(folder)) return;

            foreach (var guid in AssetDatabase.FindAssets(string.Empty, new[] { folder }))
                AssetDatabase.DeleteAsset(AssetDatabase.GUIDToAssetPath(guid));
        }

        // ------------------------------------------------------------------

        static void BuildParts()
        {
            // --- Estructura. El chasis fija cuanto aguanta todo lo demas. ---
            Part("Chasis ligero", PartSlot.Structure, mass: 180f, power: 0f, scrap: 40, rel: 0.94f,
                desc: "Bastidor de aluminio recuperado. Lo justo para sostener la pila.");

            Part("Chasis reforzado", PartSlot.Structure, mass: 340f, power: 0f, scrap: 70, rel: 0.985f,
                desc: "Pesa el doble y no se rompe. Esa es toda la propuesta.");

            // --- Propulsion. Isp alto = menos combustible, pero pesa y bebe. ---
            // Isp 265: calibrado para que la ruta barata exista pero salga cara en
            // masa. Con 220 no llegaba ni llenando la nave de tanques, y una pieza
            // que nunca puede funcionar no ensena nada, solo frustra.
            Part("Propulsor monopropelente", PartSlot.Propulsion, mass: 90f, power: -4f, scrap: 45, rel: 0.90f,
                isp: 265f, thrust: 45000f,
                desc: "Hidracina. Simple y barato. Tan poco eficiente que necesitaras el " +
                      "doble de tanques, y los tanques tambien pesan.");

            Part("Motor de descenso recuperado", PartSlot.Propulsion, mass: 180f, power: -8f, scrap: 90, rel: 0.93f,
                isp: 311f, thrust: 45040f,
                desc: "Mismo diseno que el modulo lunar del siglo XX. Sigue encendiendo.",
                relic: "relic_descent_engine");

            Part("Motor criogénico", PartSlot.Propulsion, mass: 300f, power: -140f, scrap: 160, rel: 0.88f,
                isp: 450f, thrust: 66000f,
                desc: "Hidrogeno liquido. El mejor Isp del catalogo, pero hay que refrigerarlo " +
                      "todo el viaje y cada vatio sale de otra parte.");

            // --- Tanques. Aportan propelente y su propia masa seca. ---
            Part("Tanque recuperado", PartSlot.Propulsion, mass: 60f, power: 0f, scrap: 35, rel: 0.96f,
                propellant: 400f,
                desc: "400 kg de propelente. Abollado pero estanco.");

            Part("Tanque de alta presión", PartSlot.Propulsion, mass: 120f, power: 0f, scrap: 70, rel: 0.94f,
                propellant: 900f,
                desc: "900 kg. El doble de capacidad por el doble de masa seca.");

            // --- Energia. El conflicto central: ligero y fragil, o pesado y fiable. ---
            Part("Array fotovoltaico", PartSlot.Power, mass: 45f, power: 120f, scrap: 30, rel: 0.90f,
                desc: "120 W con el cielo despejado. En tormenta de polvo, cero.",
                relic: "relic_solar_farm");

            Part("Generador de radioisótopos", PartSlot.Power, mass: 45f, power: 110f, scrap: 180, rel: 0.995f,
                desc: "110 W pase lo que pase, de dia, de noche y en tormenta. " +
                      "Cuesta cuatro veces mas que los paneles y no se apaga nunca.",
                relic: "relic_rtg_probe");

            Part("Banco de baterías", PartSlot.Power, mass: 70f, power: 40f, scrap: 45, rel: 0.97f,
                desc: "No genera: amortigua los picos y cubre la noche.");

            // --- Comunicaciones. Deciden si la ciencia llega a casa. ---
            Part("Antena de baja ganancia", PartSlot.Communications, mass: 8f, power: -12f, scrap: 20, rel: 0.97f,
                downlink: 0.3f,
                desc: "Ligera y casi gratis. 0,3 Mbps: suficiente para telemetria, " +
                      "no para un archivo.");

            Part("Antena de alta ganancia", PartSlot.Communications, mass: 35f, power: -85f, scrap: 95, rel: 0.93f,
                downlink: 4.0f,
                desc: "Plato orientable de red profunda. 4 Mbps. Pesa y bebe, y es " +
                      "lo unico que separa volver con pruebas de volver sin ellas.",
                relic: "relic_deep_space_antenna");

            // --- Ciencia. Genera datos que hay que poder transmitir. ---
            Part("Espectrómetro", PartSlot.Science, mass: 12f, power: -15f, scrap: 40, rel: 0.95f,
                data: 120f,
                desc: "Composicion de suelo y atmosfera. 120 Mb por campana.");

            Part("Cámara multiespectral", PartSlot.Science, mass: 22f, power: -25f, scrap: 60, rel: 0.94f,
                data: 480f,
                desc: "480 Mb. Son las imagenes que nadie creera sin verlas.");

            Part("Sonda atmosférica", PartSlot.Science, mass: 9f, power: -10f, scrap: 30, rel: 0.96f,
                data: 90f,
                desc: "Mide el velo de sulfatos. El dato que explica el cielo rojo.");

            // --- Soporte vital. La rama que lleva al final C. ---
            Part("Módulo de soporte vital", PartSlot.LifeSupport, mass: 260f, power: -140f, scrap: 130, rel: 0.96f,
                desc: "Agua, aire y temperatura para una persona, indefinidamente.");

            Part("Invernadero", PartSlot.LifeSupport, mass: 180f, power: -90f, scrap: 110, rel: 0.92f,
                desc: "Cultivo cerrado. Inutil para escapar. Imprescindible para quedarse.",
                relic: "relic_greenhouse_plate");

            // --- Redundancia. Se paga por algo que esperas no usar. ---
            Part("Unidad de control redundante", PartSlot.Redundancy, mass: 25f, power: -18f, scrap: 85, rel: 0.98f,
                desc: "Toma el mando si la principal cae. No hace nada el resto del tiempo.",
                relic: "relic_black_box");

            Part("Batería de respaldo", PartSlot.Redundancy, mass: 40f, power: 20f, scrap: 50, rel: 0.98f,
                desc: "Mantiene los sistemas criticos si falla la energia principal.");

            // --- Contramedidas. Peso que le robas a la antena. ---
            Part("Módulo de interferencia", PartSlot.Countermeasures, mass: 30f, power: -60f, scrap: 75, rel: 0.91f,
                damping: 3.5f,
                desc: "Enmascara la emision de ADA. Protegerla cuesta exactamente la " +
                      "potencia que necesitarias para contar lo que sabe.",
                relic: "relic_helios_node");
        }

        // ------------------------------------------------------------------

        static void BuildRelics()
        {
            Relic("relic_solar_farm", "Panel solar fracturado",
                AdaCapability.Spectrometer, scan: 6f, exposure: 8f, scrap: 25,
                lore: "Una granja solar de horizonte a horizonte. Alimento ciudades enteras " +
                      "durante once anos. El registro de mantenimiento se corta a mitad de frase.",
                tech: "Celda de silicio multiunion. 120 W pico, inutil bajo polvo en suspension.",
                part: "Array fotovoltaico");

            Relic("relic_rtg_probe", "Capsula de radioisótopos",
                AdaCapability.StructuralAnalysis, scan: 11f, exposure: 16f, scrap: 40,
                lore: "De una sonda planetaria. Siguieron mirando hacia afuera hasta el final, " +
                      "incluso cuando ya no quedaba nadie que esperase la respuesta.",
                tech: "Generador termoelectrico de plutonio-238. 110 W constantes, 45 kg, " +
                      "semivida de 88 anos. Lleva siglos tibia.",
                part: "Generador de radioisótopos",
                grants: AdaCapability.ThermalSimulation);

            Relic("relic_deep_space_antenna", "Plato de red profunda",
                AdaCapability.StructuralAnalysis, scan: 13f, exposure: 20f, scrap: 55,
                lore: "Orientado hacia arriba, congelado en la ultima posicion que le ordenaron. " +
                      "Llamaron a alguien durante anos. En el registro no hay una sola respuesta.",
                tech: "Antena parabolica de 34 m, banda X. 4 Mbps a distancia planetaria.",
                part: "Antena de alta ganancia",
                grants: AdaCapability.OrbitalMechanics);

            Relic("relic_helios_node", "Nodo de HELIOS inactivo",
                AdaCapability.ThermalSimulation, scan: 15f, exposure: 26f, scrap: 35,
                lore: "Dentro esta el acta de aprobacion del programa. La votacion fue de " +
                      "340 a favor. Tambien estan los nombres de los once que votaron en contra.",
                tech: "Nodo de control del velo de sulfatos. Sigue reportando a la red " +
                      "cada 400 segundos.",
                part: "Módulo de interferencia");

            Relic("relic_black_box", "Caja negra de lanzador",
                AdaCapability.StructuralAnalysis, scan: 9f, exposure: 14f, scrap: 30,
                lore: "Cuatrocientas personas a bordo. El fallo fue una valvula de la segunda " +
                      "etapa sin sistema de respaldo. Alguien decidio que el respaldo pesaba demasiado.",
                tech: "Registrador de vuelo. La redundancia cuesta masa y casi nunca se usa. " +
                      "Casi.",
                part: "Unidad de control redundante");

            Relic("relic_greenhouse_plate", "Placa de invernadero orbital",
                AdaCapability.Spectrometer, scan: 8f, exposure: 10f, scrap: 20,
                lore: "De una estacion agricola en orbita baja. Lo intentaron. Los informes " +
                      "de cosecha son meticulosos hasta el ultimo mes.",
                tech: "Módulo de cultivo cerrado. Produce para una persona con 90 W.",
                part: "Invernadero");

            Relic("relic_descent_engine", "Campana de motor enterrada",
                AdaCapability.Spectrometer, scan: 7f, exposure: 9f, scrap: 45,
                lore: "El diseno es casi identico al que tu misma agencia uso para bajar a la Luna. " +
                      "Lo copiaron durante quinientos anos porque funcionaba.",
                tech: "Motor de descenso estrangulable. Isp 311 s, 45 kN de empuje.",
                part: "Motor de descenso recuperado");

            // La unica que no da nada. Es deliberada, y es la mas importante.
            Relic("relic_child_drawing", "Dibujo infantil plastificado",
                AdaCapability.Spectrometer, scan: 4f, exposure: 3f, scrap: 0,
                lore: "Una casa. Un sol amarillo. Cuatro figuras cogidas de la mano.\n\n" +
                      "ADA no anade nada.",
                tech: "Lamina de poliester, pigmento de cera. Sin valor estructural.",
                part: null);
        }

        // ------------------------------------------------------------------

        /// <summary>
        /// Recoge todo lo generado en un indice dentro de Resources, que es lo
        /// unico que la escena puede cargar en ejecucion.
        /// </summary>
        static void BuildIndex()
        {
            const string dir = "Assets/_Project/Resources";
            if (!AssetDatabase.IsValidFolder(dir))
                AssetDatabase.CreateFolder("Assets/_Project", "Resources");

            var index = ScriptableObject.CreateInstance<CatalogAsset>();

            index.parts = AssetDatabase.FindAssets("t:PartDefinition", new[] { PartsPath })
                .Select(AssetDatabase.GUIDToAssetPath)
                .Select(AssetDatabase.LoadAssetAtPath<PartDefinition>)
                .Where(p => p != null)
                .OrderBy(p => p.slot)
                .ThenBy(p => p.massKg)
                .ToArray();

            index.relics = AssetDatabase.FindAssets("t:RelicDefinition", new[] { RelicsPath })
                .Select(AssetDatabase.GUIDToAssetPath)
                .Select(AssetDatabase.LoadAssetAtPath<RelicDefinition>)
                .Where(r => r != null)
                .OrderBy(r => r.requiredCapability)
                .ToArray();

            const string path = dir + "/Catalog.asset";
            AssetDatabase.DeleteAsset(path);
            AssetDatabase.CreateAsset(index, path);

            Debug.Log($"[Catalogo] Indice: {index.parts.Length} piezas, {index.relics.Length} reliquias.");
        }

        static void Part(string name, PartSlot slot, float mass, float power, int scrap, float rel,
            string desc, float isp = 0f, float thrust = 0f, float propellant = 0f,
            float downlink = 0f, float data = 0f, float damping = 0f, string relic = null)
        {
            var asset = ScriptableObject.CreateInstance<PartDefinition>();
            asset.displayName = name;
            asset.description = desc;
            asset.slot = slot;
            asset.massKg = mass;
            asset.powerW = power;
            asset.scrapCost = scrap;
            asset.reliability = rel;
            asset.specificImpulseSec = isp;
            asset.thrustN = thrust;
            asset.propellantKg = propellant;
            asset.downlinkMbps = downlink;
            asset.dataGeneratedMb = data;
            asset.exposureDampening = damping;
            asset.unlockedByRelicId = relic ?? string.Empty;

            string path = $"{PartsPath}/Part_{Slug(name)}.asset";
            AssetDatabase.DeleteAsset(path);
            AssetDatabase.CreateAsset(asset, path);
            Created[name] = asset;
        }

        static void Relic(string id, string name, AdaCapability required, float scan, float exposure,
            int scrap, string lore, string tech, string part, AdaCapability grants = default)
        {
            var asset = ScriptableObject.CreateInstance<RelicDefinition>();
            asset.relicId = id;
            asset.displayName = name;
            asset.requiredCapability = required;
            asset.scanSeconds = scan;
            asset.exposureCost = exposure;
            asset.loreEntry = lore;
            asset.technicalNote = tech;
            asset.scrapYield = scrap;

            if (part != null && Created.TryGetValue(part, out var p))
                asset.unlocksPart = p;

            if (grants != default)
            {
                asset.grantsCapability = grants;
                asset.grantsAnyCapability = true;
            }

            string path = $"{RelicsPath}/Relic_{Slug(name)}.asset";
            AssetDatabase.DeleteAsset(path);
            AssetDatabase.CreateAsset(asset, path);
        }

        static string Slug(string s)
        {
            var sb = new System.Text.StringBuilder();
            foreach (char c in s)
            {
                if (char.IsLetterOrDigit(c)) sb.Append(c);
                else if (c == ' ') sb.Append('_');
            }
            return sb.ToString();
        }
    }
}
