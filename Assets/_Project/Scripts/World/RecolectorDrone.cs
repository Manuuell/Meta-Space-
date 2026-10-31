using UnityEngine;

namespace MetaSpace.World
{
    /// <summary>
    /// Un Recolector de HELIOS patrullando: va y viene entre dos puntos,
    /// flota con un vaiven lento y su ojo late. Todavia no persigue a nadie;
    /// esta para que la calle no parezca vacia de amenaza.
    /// </summary>
    public class RecolectorDrone : MonoBehaviour
    {
        public Vector3 from;
        public Vector3 to;
        public float speed = 2.2f;
        public float bob = 0.6f;
        public Light eye;

        float progress;
        int direction = 1;
        float eyeIntensity;

        void Start()
        {
            // En Start y no en Awake: el ojo se cuelga despues de crear el dron.
            if (eye != null) eyeIntensity = eye.intensity;
        }

        void Update()
        {
            float distance = Mathf.Max(Vector3.Distance(from, to), 0.01f);
            progress += direction * speed * Time.deltaTime / distance;
            if (progress > 1f || progress < 0f)
            {
                progress = Mathf.Clamp01(progress);
                direction = -direction;
            }

            float eased = Mathf.SmoothStep(0f, 1f, progress);
            var position = Vector3.Lerp(from, to, eased);
            position.y += Mathf.Sin(Time.time * 0.9f) * bob;
            transform.position = position;

            var heading = (direction > 0 ? to - from : from - to);
            heading.y = 0f;
            if (heading.sqrMagnitude > 0.01f)
                transform.rotation = Quaternion.Slerp(transform.rotation,
                    Quaternion.LookRotation(heading), Time.deltaTime * 1.5f);

            if (eye != null)
                eye.intensity = eyeIntensity * (0.6f + 0.4f * Mathf.Sin(Time.time * 3.1f));
        }
    }
}
