using System.Collections.Generic;
using System.Linq;
using System.Text;
using MetaSpace.Mission;
using UnityEditor;
using UnityEngine;

namespace MetaSpace.EditorTools
{
    /// <summary>
    /// Monta naves de referencia con el catalogo real y escupe sus presupuestos.
    /// Sirve para una sola pregunta: ¿el juego tiene solucion, y cuesta llegar?
    /// Si todas las naves vuelan sobradas, no hay decision. Si ninguna vuela,
    /// no hay juego.
    /// </summary>
    public static class CatalogSanityCheck
    {
        [MenuItem("Meta Space/Comprobar equilibrio")]
        public static void Run()
        {
            var parts = AssetDatabase.FindAssets("t:PartDefinition")
                .Select(AssetDatabase.GUIDToAssetPath)
                .Select(AssetDatabase.LoadAssetAtPath<PartDefinition>)
                .ToDictionary(p => p.displayName, p => p);

            Debug.Log($"[Equilibrio] {parts.Count} piezas en el catalogo.");

            Report("A · Minima para escapar", parts,
                "Chasis ligero", "Motor de descenso recuperado",
                "Tanque de alta presión", "Tanque de alta presión",
                "Array fotovoltaico", "Antena de baja ganancia");

            // La trampa: el RTG es tan caro que no queda chatarra para cubrir
            // los 140 W que bebe el criogénico. Debe fallar.
            Report("B · Criogenica con RTG (trampa)", parts,
                "Chasis ligero", "Motor criogénico",
                "Tanque de alta presión", "Tanque de alta presión",
                "Generador de radioisótopos", "Antena de alta ganancia");

            // La salida: paneles en vez de RTG libera chatarra para dos arrays
            // y una bateria. Vuela y transmite, pero vive del sol: una tormenta
            // la deja a oscuras. Este es el camino al Final B.
            Report("B2 · Criogenica solar (Final B)", parts,
                "Chasis ligero", "Motor criogénico",
                "Tanque de alta presión", "Tanque de alta presión",
                "Array fotovoltaico", "Array fotovoltaico", "Banco de baterías",
                "Antena de alta ganancia");

            Report("C · Cientifica completa", parts,
                "Chasis ligero", "Motor criogénico",
                "Tanque de alta presión", "Tanque de alta presión",
                "Generador de radioisótopos", "Antena de alta ganancia",
                "Espectrómetro", "Cámara multiespectral", "Sonda atmosférica");

            // Sin motor no vuela, y eso es correcto: el Final C se alcanza
            // precisamente por no poder despegar. Lo que si debe cuadrar es
            // la potencia, o el invernadero no sobrevive a la primera noche.
            Report("D · Jardinero (se queda)", parts,
                "Chasis reforzado", "Módulo de soporte vital", "Invernadero",
                "Generador de radioisótopos", "Array fotovoltaico",
                "Banco de baterías", "Antena de baja ganancia");

            // Tres tanques no bastan con un Isp tan malo: debe fallar.
            Report("E · Barata, tres tanques", parts,
                "Chasis ligero", "Propulsor monopropelente",
                "Tanque recuperado", "Tanque recuperado", "Tanque recuperado",
                "Array fotovoltaico", "Antena de baja ganancia");

            // Seis tanques si llegan. La ruta pobre existe, pero te come la masa
            // entera: no queda sitio para ciencia ni para redundancia.
            Report("E2 · Barata, seis tanques", parts,
                "Chasis ligero", "Propulsor monopropelente",
                "Tanque recuperado", "Tanque recuperado", "Tanque recuperado",
                "Tanque recuperado", "Tanque recuperado", "Tanque recuperado",
                "Array fotovoltaico", "Antena de baja ganancia");
        }

        static void Report(string label, Dictionary<string, PartDefinition> parts, params string[] names)
        {
            var design = new MissionDesign();
            foreach (var n in names)
            {
                if (parts.TryGetValue(n, out var p)) design.Add(p);
                else Debug.LogWarning($"[Equilibrio] Falta la pieza '{n}'");
            }

            var limits = design.Limits;
            var sb = new StringBuilder();
            sb.AppendLine($"── {label}");
            sb.AppendLine($"   Masa seca      {design.DryMassKg,8:0} kg");
            sb.AppendLine($"   Propelente     {design.PropellantKg,8:0} kg");
            sb.AppendLine($"   Masa total     {design.WetMassKg,8:0} / {limits.maxMassKg:0} kg" +
                          (design.OverMass ? "   EXCEDIDA" : ""));
            sb.AppendLine($"   Potencia       {design.PowerBalanceW,8:+0;-0} W" +
                          (design.PowerStarved ? "   DEFICIT" : ""));
            sb.AppendLine($"   Chatarra       {design.ScrapSpent,8} / {limits.availableScrap}" +
                          (design.OverBudget ? "   EXCEDIDA" : ""));
            sb.AppendLine($"   Isp efectivo   {design.EffectiveIspSec,8:0} s");
            sb.AppendLine($"   Empuje/peso    {design.ThrustToWeight,8:0.00}");
            sb.AppendLine($"   Delta-v        {design.DeltaVms,8:0} / {limits.requiredDeltaV:0} m/s");
            sb.AppendLine($"   Fiabilidad     {design.MissionReliability,8:P1}");
            sb.AppendLine($"   Datos          {design.DataTransmittableMb(),8:0} / {design.DataGeneratedMb:0} Mb");
            sb.AppendLine($"   VUELA          {(design.IsFlightReady ? "SI" : "NO")}");

            foreach (var b in design.Blockers())
                sb.AppendLine($"     · {b}");

            Debug.Log(sb.ToString());
        }
    }
}
