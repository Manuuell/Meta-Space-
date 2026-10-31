using System.Linq;
using UnityEngine;

namespace MetaSpace.Mission
{
    /// <summary>
    /// Indice del catalogo. Los assets sueltos de Data/ no son visibles en
    /// ejecucion, asi que este objeto los agrupa y vive en Resources.
    /// Lo regenera PartCatalogBuilder; no se edita a mano.
    /// </summary>
    public class CatalogAsset : ScriptableObject
    {
        public PartDefinition[] parts = new PartDefinition[0];
        public RelicDefinition[] relics = new RelicDefinition[0];

        public static CatalogAsset Load() => Resources.Load<CatalogAsset>("Catalog");

        /// <summary>Piezas de una ranura, de la mas ligera a la mas pesada.</summary>
        public PartDefinition[] InSlot(PartSlot slot)
            => parts.Where(p => p != null && p.slot == slot)
                    .OrderBy(p => p.massKg)
                    .ToArray();

        /// <summary>
        /// Lo que el jugador puede montar ahora mismo. Una pieza ligada a una
        /// reliquia no aparece hasta haberla escaneado.
        /// </summary>
        public PartDefinition[] Unlocked(System.Collections.Generic.ICollection<string> scannedRelicIds)
            => parts.Where(p => p != null &&
                                (string.IsNullOrEmpty(p.unlockedByRelicId) ||
                                 scannedRelicIds.Contains(p.unlockedByRelicId)))
                    .ToArray();
    }
}
