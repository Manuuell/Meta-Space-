using UnityEngine;

namespace MetaSpace.World
{
    /// <summary>
    /// Desplaza una capa respecto a la camara. Factor 0 = pegada al fondo
    /// (nunca se mueve), 1 = pegada al suelo (se mueve con el mundo).
    /// </summary>
    public class ParallaxLayer : MonoBehaviour
    {
        public float factor = 0.5f;

        Transform cam;
        Vector3 origin;
        float originCamX;

        void Start()
        {
            cam = Camera.main != null ? Camera.main.transform : null;
            origin = transform.position;
            originCamX = cam != null ? cam.position.x : 0f;
        }

        void LateUpdate()
        {
            if (cam == null) return;

            float travelled = cam.position.x - originCamX;
            transform.position = new Vector3(origin.x + travelled * (1f - factor),
                                             origin.y, origin.z);
        }
    }
}
