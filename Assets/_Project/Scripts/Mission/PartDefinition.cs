using UnityEngine;

namespace MetaSpace.Mission
{
    public enum PartSlot
    {
        Structure,
        Propulsion,
        Power,
        Communications,
        Science,
        LifeSupport,
        Redundancy,
        Countermeasures
    }

    /// <summary>
    /// Una pieza del catalogo. Se crea como asset desde el editor, uno por componente,
    /// para que los numeros vivan en datos y no en codigo: asi el diseno se equilibra
    /// sin recompilar y las cifras reales quedan a la vista de quien evalua.
    /// </summary>
    [CreateAssetMenu(fileName = "Part_", menuName = "Meta Space/Pieza")]
    public class PartDefinition : ScriptableObject
    {
        [Header("Identidad")]
        public string displayName = "Pieza sin nombre";
        [TextArea(2, 4)] public string description;
        public PartSlot slot = PartSlot.Structure;

        [Header("Presupuestos")]
        [Tooltip("Masa seca en kilogramos.")]
        public float massKg = 10f;

        [Tooltip("Vatios. Positivo si genera, negativo si consume.")]
        public float powerW = -5f;

        [Tooltip("Coste en chatarra recuperada.")]
        public int scrapCost = 20;

        [Header("Fiabilidad")]
        [Range(0f, 1f)]
        [Tooltip("Probabilidad de sobrevivir a la mision sin fallar.")]
        public float reliability = 0.95f;

        [Header("Propulsion")]
        [Tooltip("Solo para motores. Impulso especifico en segundos.")]
        public float specificImpulseSec;
        [Tooltip("Solo para motores. Empuje en newtons.")]
        public float thrustN;
        [Tooltip("Solo para tanques. Propelente que aporta, en kilogramos.")]
        public float propellantKg;

        [Header("Operacion")]
        [Tooltip("Solo para antenas. Tasa de bajada en megabits por segundo.")]
        public float downlinkMbps;
        [Tooltip("Solo para instrumentos. Datos que genera, en megabits.")]
        public float dataGeneratedMb;
        [Tooltip("Reduccion de Exposicion por segundo mientras esta activo.")]
        public float exposureDampening;

        [Header("Progresion")]
        [Tooltip("Reliquia que desbloquea esta pieza. Vacio si esta disponible desde el inicio.")]
        public string unlockedByRelicId;

        public bool IsEngine => specificImpulseSec > 0f && thrustN > 0f;
        public bool IsTank => propellantKg > 0f;
        public bool GeneratesPower => powerW > 0f;
    }
}
