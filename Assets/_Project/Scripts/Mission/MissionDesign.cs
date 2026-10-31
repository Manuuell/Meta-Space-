using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace MetaSpace.Mission
{
    /// <summary>
    /// Limites que la mision no puede rebasar. Vienen del lanzador que el jugador
    /// haya construido, no de un numero arbitrario.
    /// </summary>
    [Serializable]
    public struct MissionLimits
    {
        public float maxMassKg;
        public int availableScrap;
        public float requiredDeltaV;

        /// <summary>
        /// Calibrado contra el catalogo real, no elegido a ojo. Con estos numeros
        /// la nave minima llega con 136 m/s de margen y la criogenica con enlace
        /// se queda sin potencia: hay que renunciar a algo en las dos. Si se tocan
        /// las piezas, hay que volver a pasar la comprobacion de equilibrio.
        /// </summary>
        public static MissionLimits Default => new MissionLimits
        {
            maxMassKg = 3200f,
            availableScrap = 620,
            requiredDeltaV = 3900f
        };
    }

    /// <summary>
    /// La nave tal y como el jugador la ha montado. Es el modelo que lee el banco
    /// de trabajo y el que decide el final: todo lo que la pantalla muestra en vivo
    /// sale de aqui.
    /// </summary>
    public class MissionDesign
    {
        readonly List<PartDefinition> parts = new List<PartDefinition>();

        public MissionLimits Limits { get; set; } = MissionLimits.Default;
        public IReadOnlyList<PartDefinition> Parts => parts;

        public event Action Changed;

        public void Add(PartDefinition part)
        {
            if (part == null) return;
            parts.Add(part);
            Changed?.Invoke();
        }

        public void Remove(PartDefinition part)
        {
            if (parts.Remove(part)) Changed?.Invoke();
        }

        public void Clear()
        {
            parts.Clear();
            Changed?.Invoke();
        }

        // --- Presupuestos -----------------------------------------------------

        public float DryMassKg => parts.Sum(p => p.massKg);
        public float PropellantKg => parts.Sum(p => p.propellantKg);
        public float WetMassKg => DryMassKg + PropellantKg;

        public float PowerGeneratedW => parts.Where(p => p.powerW > 0f).Sum(p => p.powerW);
        public float PowerDrawW => parts.Where(p => p.powerW < 0f).Sum(p => -p.powerW);
        public float PowerBalanceW => PowerGeneratedW - PowerDrawW;

        public int ScrapSpent => parts.Sum(p => p.scrapCost);
        public int ScrapRemaining => Limits.availableScrap - ScrapSpent;

        public float TotalThrustN => parts.Where(p => p.IsEngine).Sum(p => p.thrustN);

        /// <summary>Isp combinado, ponderado por empuje. Varios motores distintos no suman Isp.</summary>
        public float EffectiveIspSec
        {
            get
            {
                var engines = parts.Where(p => p.IsEngine).ToList();
                if (engines.Count == 0) return 0f;

                float thrust = engines.Sum(e => e.thrustN);
                if (thrust <= 0f) return 0f;

                return engines.Sum(e => e.specificImpulseSec * e.thrustN) / thrust;
            }
        }

        public float DeltaVms => RocketMath.DeltaV(WetMassKg, DryMassKg, EffectiveIspSec);
        public float ThrustToWeight => RocketMath.ThrustToWeight(TotalThrustN, WetMassKg);

        // --- Operacion --------------------------------------------------------

        public float DownlinkMbps => parts.Sum(p => p.downlinkMbps);
        public float DataGeneratedMb => parts.Sum(p => p.dataGeneratedMb);

        /// <summary>
        /// Ciencia que de verdad llega a casa. Generar mas datos de los que la antena
        /// puede enviar es perder ciencia, y es lo que separa el Final A del Final B.
        /// </summary>
        public float DataTransmittableMb(float transmissionWindowSec = 600f)
            => Mathf.Min(DataGeneratedMb, DownlinkMbps * transmissionWindowSec);

        /// <summary>Probabilidad de que ningun sistema critico falle. Aqui se paga la redundancia.</summary>
        public float MissionReliability
        {
            get
            {
                if (parts.Count == 0) return 0f;

                float survival = 1f;
                foreach (var group in parts.GroupBy(p => p.slot))
                {
                    // Piezas del mismo tipo actuan como respaldo: solo fallan todas a la vez.
                    float allFail = group.Aggregate(1f, (acc, p) => acc * (1f - p.reliability));
                    survival *= 1f - allFail;
                }
                return survival;
            }
        }

        // --- Veredicto --------------------------------------------------------

        public bool OverMass => DryMassKg + PropellantKg > Limits.maxMassKg;
        public bool OverBudget => ScrapRemaining < 0;
        public bool PowerStarved => PowerBalanceW < 0f;
        public bool CanReachOrbit => DeltaVms >= Limits.requiredDeltaV && ThrustToWeight >= 1.2f;
        public bool CanTransmitHome => DownlinkMbps > 0f && !PowerStarved;

        public bool IsFlightReady => CanReachOrbit && !OverMass && !OverBudget && !PowerStarved;

        /// <summary>
        /// Lo que ADA le dice al jugador mientras monta. Un motivo por linea,
        /// siempre el mas grave primero.
        /// </summary>
        public IEnumerable<string> Blockers()
        {
            if (OverMass)
                yield return $"Masa excedida en {WetMassKg - Limits.maxMassKg:0} kg.";
            if (OverBudget)
                yield return $"Faltan {-ScrapRemaining} de chatarra.";
            if (PowerStarved)
                yield return $"Deficit de {-PowerBalanceW:0} W. Algo se apagara en vuelo.";
            if (TotalThrustN <= 0f)
                yield return "Sin motor no hay lanzamiento.";
            else if (ThrustToWeight < 1.2f)
                yield return $"Empuje insuficiente: {ThrustToWeight:0.00} de relacion. Hace falta 1,20.";
            if (DeltaVms < Limits.requiredDeltaV)
                yield return $"Faltan {Limits.requiredDeltaV - DeltaVms:0} m/s de delta-v.";
            // Solo la falta de antena, no el deficit de potencia: ese ya se ha
            // dicho arriba y repetirlo hace creer que son dos problemas.
            if (DownlinkMbps <= 0f)
                yield return "Sin antena: la ciencia no llegara a casa.";
        }
    }
}
