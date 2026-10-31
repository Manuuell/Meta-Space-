using UnityEngine;

namespace MetaSpace.Mission
{
    /// <summary>
    /// Nivel de ADA que hace falta para leer una reliquia. Sube con las propias
    /// reliquias, asi que la progresion se alimenta a si misma.
    /// </summary>
    public enum AdaCapability
    {
        Spectrometer = 1,
        StructuralAnalysis = 2,
        ThermalSimulation = 3,
        OrbitalMechanics = 4,
        ArchiveReconstruction = 5
    }

    /// <summary>
    /// Un objeto que ADA puede escanear. Cada reliquia hace tres cosas a la vez:
    /// cuenta algo del planeta, desbloquea una pieza y sube a ADA. Esa es la
    /// columna vertebral del juego, y por eso las tres viven en el mismo asset.
    /// </summary>
    [CreateAssetMenu(fileName = "Relic_", menuName = "Meta Space/Reliquia")]
    public class RelicDefinition : ScriptableObject
    {
        [Header("Identidad")]
        [Tooltip("Identificador estable. Las piezas apuntan aqui para desbloquearse.")]
        public string relicId;
        public string displayName;

        [Header("Escaneo")]
        [Tooltip("Nivel minimo de ADA para poder leerla.")]
        public AdaCapability requiredCapability = AdaCapability.Spectrometer;

        [Tooltip("Segundos de escaneo. Las valiosas tardan mas, y tardar cuesta Exposicion.")]
        [Range(2f, 20f)] public float scanSeconds = 6f;

        [Tooltip("Exposicion que genera el escaneo completo.")]
        [Range(0f, 40f)] public float exposureCost = 8f;

        [Header("Lo que cuenta")]
        [TextArea(3, 6)]
        [Tooltip("El registro: lo que ADA deduce del objeto.")]
        public string loreEntry;

        [TextArea(2, 4)]
        [Tooltip("La ficha tecnica: el dato real de ingenieria, para el Codice.")]
        public string technicalNote;

        [Header("Lo que da")]
        [Tooltip("Pieza que desbloquea. Puede quedar vacio: no toda reliquia da algo.")]
        public PartDefinition unlocksPart;

        [Tooltip("Capacidad que otorga a ADA. None si solo aporta lore.")]
        public AdaCapability grantsCapability;
        public bool grantsAnyCapability;

        [Tooltip("Chatarra que se recupera al desguazarla.")]
        public int scrapYield = 0;

        public bool IsSilent => unlocksPart == null && !grantsAnyCapability;
    }
}
