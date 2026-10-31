using UnityEngine;

namespace MetaSpace.Mission
{
    /// <summary>
    /// Fisica de cohetes reducida a lo que el juego necesita ensenar.
    /// Nada de n cuerpos: Tsiolkovsky y un presupuesto de delta-v por fase.
    /// </summary>
    public static class RocketMath
    {
        /// <summary>Gravedad estandar usada para convertir Isp a velocidad de escape efectiva.</summary>
        public const float G0 = 9.80665f;

        /// <summary>
        /// Ecuacion de Tsiolkovsky. Devuelve el delta-v disponible en m/s.
        /// </summary>
        /// <param name="wetMassKg">Masa total con propelente.</param>
        /// <param name="dryMassKg">Masa total sin propelente.</param>
        /// <param name="specificImpulseSec">Isp del motor en segundos.</param>
        public static float DeltaV(float wetMassKg, float dryMassKg, float specificImpulseSec)
        {
            if (dryMassKg <= 0f || wetMassKg <= dryMassKg || specificImpulseSec <= 0f)
                return 0f;

            return specificImpulseSec * G0 * Mathf.Log(wetMassKg / dryMassKg);
        }

        /// <summary>
        /// Propelente necesario para un delta-v objetivo, dada la masa seca y el Isp.
        /// Es la pregunta que el jugador se hace de verdad: "cuanto combustible me falta".
        /// </summary>
        public static float PropellantFor(float targetDeltaV, float dryMassKg, float specificImpulseSec)
        {
            if (dryMassKg <= 0f || specificImpulseSec <= 0f || targetDeltaV <= 0f)
                return 0f;

            float ratio = Mathf.Exp(targetDeltaV / (specificImpulseSec * G0));
            return dryMassKg * (ratio - 1f);
        }

        /// <summary>
        /// Empuje minimo para despegar con margen. Por debajo de 1.0 de TWR no sale del suelo.
        /// </summary>
        public static float ThrustToWeight(float thrustNewtons, float wetMassKg, float surfaceGravity = G0)
        {
            if (wetMassKg <= 0f) return 0f;
            return thrustNewtons / (wetMassKg * surfaceGravity);
        }
    }
}
