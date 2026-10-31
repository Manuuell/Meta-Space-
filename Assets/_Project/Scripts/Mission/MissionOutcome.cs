using System.Collections.Generic;

namespace MetaSpace.Mission
{
    public enum Ending
    {
        /// <summary>Escapas sin enlace. Vuelves con la verdad y sin pruebas.</summary>
        Silence,
        /// <summary>Escapas con antena. ADA transmite el archivo y se consume.</summary>
        LastSignal,
        /// <summary>Sin delta-v pero con soporte vital. Te quedas y el planeta vuelve a vivir.</summary>
        Gardener,
        /// <summary>Entregaste a ADA a HELIOS. Despegas solo y en silencio.</summary>
        Exchange,
        /// <summary>Fallo de diseno. El lanzamiento no aguanta.</summary>
        DecayingOrbit
    }

    /// <summary>
    /// Traduce un diseno terminado al final que le corresponde, y explica por que.
    /// El juego no pregunta al jugador que final quiere: se lo calcula a partir de
    /// lo que construyo. Esta clase es, literalmente, la ultima frase del reto.
    /// </summary>
    public static class MissionOutcome
    {
        public struct Result
        {
            public Ending ending;
            public string headline;
            public string decidingFactor;
            public List<string> report;
        }

        public static Result Resolve(MissionDesign design, bool adaSurrendered, bool hasLifeSupport)
        {
            var report = new List<string>
            {
                $"Masa final: {design.WetMassKg:0} / {design.Limits.maxMassKg:0} kg",
                $"Balance de potencia: {design.PowerBalanceW:+0;-0} W",
                $"Delta-v: {design.DeltaVms:0} / {design.Limits.requiredDeltaV:0} m/s",
                $"Fiabilidad de mision: {design.MissionReliability:P0}",
                $"Ciencia transmitida: {design.DataTransmittableMb():0} / {design.DataGeneratedMb:0} Mb",
                $"Chatarra sobrante: {design.ScrapRemaining}"
            };

            if (adaSurrendered)
            {
                return new Result
                {
                    ending = Ending.Exchange,
                    headline = "El intercambio",
                    decidingFactor = "Entregaste el Meta Space. HELIOS cerro el expediente y tu despegaste sin nadie a quien preguntarle que planeta era.",
                    report = report
                };
            }

            if (!design.IsFlightReady)
            {
                if (hasLifeSupport)
                {
                    return new Result
                    {
                        ending = Ending.Gardener,
                        headline = "El jardinero",
                        decidingFactor = "La nave no alcanzaba la orbita, pero el invernadero si funcionaba. Te quedaste, y el planeta volvio a empezar.",
                        report = report
                    };
                }

                var blockers = new List<string>(design.Blockers());
                return new Result
                {
                    ending = Ending.DecayingOrbit,
                    headline = "Orbita decadente",
                    decidingFactor = blockers.Count > 0 ? blockers[0] : "El diseno no aguanto el ascenso.",
                    report = report
                };
            }

            if (design.CanTransmitHome && design.DataTransmittableMb() >= design.DataGeneratedMb * 0.6f)
            {
                return new Result
                {
                    ending = Ending.LastSignal,
                    headline = "Ultima senal",
                    decidingFactor = $"Pagaste {design.DownlinkMbps:0.0} Mbps de antena con masa que podrias haber gastado en combustible. Por eso el aviso llego.",
                    report = report
                };
            }

            return new Result
            {
                ending = Ending.Silence,
                headline = "El silencio",
                decidingFactor = design.DownlinkMbps <= 0f
                    ? "Nunca montaste una antena. Vuelves con la verdad y sin una sola prueba."
                    : "La antena no daba abasto: generaste mas ciencia de la que podias enviar.",
                report = report
            };
        }
    }
}
