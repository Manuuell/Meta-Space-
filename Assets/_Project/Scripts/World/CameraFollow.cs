using UnityEngine;

namespace MetaSpace.World
{
    /// <summary>
    /// Sigue al jugador con retraso y le deja mirar un poco hacia donde camina.
    /// Tambien aparta la camara de los bordes del nivel, para que el vacio no
    /// aparezca por detras del decorado.
    /// </summary>
    public class CameraFollow : MonoBehaviour
    {
        public Transform target;
        public float smoothTime = 0.22f;
        public float lookAhead = 1.4f;
        public float heightOffset = 1.1f;
        public float minX = -40f, maxX = 40f;

        Vector3 velocity;
        float facing;

        void LateUpdate()
        {
            if (target == null) return;

            var body = target.GetComponent<Rigidbody2D>();
            if (body != null && Mathf.Abs(body.linearVelocity.x) > 0.2f)
                facing = Mathf.Sign(body.linearVelocity.x);

            float desiredX = Mathf.Clamp(target.position.x + facing * lookAhead, minX, maxX);
            var desired = new Vector3(desiredX, target.position.y + heightOffset, transform.position.z);

            transform.position = Vector3.SmoothDamp(transform.position, desired, ref velocity, smoothTime);
        }
    }
}
