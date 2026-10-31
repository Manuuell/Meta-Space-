using MetaSpace.UI;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;

namespace MetaSpace.EditorTools
{
    /// <summary>
    /// Crea la escena del banco de trabajo. La escena queda casi vacia a
    /// proposito: camara, sistema de eventos y un objeto con el controlador.
    /// Toda la interfaz la levanta WorkbenchUI, que si se puede leer en un diff.
    /// </summary>
    public static class WorkbenchSceneBuilder
    {
        const string ScenePath = "Assets/_Project/Scenes/Workbench.unity";

        [MenuItem("Meta Space/Regenerar escena del banco")]
        public static void Run()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var cameraGo = new GameObject("Main Camera", typeof(Camera));
            cameraGo.tag = "MainCamera";
            var camera = cameraGo.GetComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.055f, 0.039f, 0.047f);
            cameraGo.transform.position = new Vector3(0f, 0f, -10f);

            // InputSystemUIInputModule y no StandaloneInputModule: con el paquete
            // Input System activo, el modulo antiguo entrega la rueda del raton
            // pero no los botones. El sintoma es desconcertante porque la lista
            // se desplaza con normalidad y ningun clic hace nada, sin un error.
            new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));

            new GameObject("Workbench", typeof(WorkbenchUI));

            EditorSceneManager.SaveScene(scene, ScenePath);

            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

            Debug.Log($"[Escena] {ScenePath} generada y marcada como escena inicial.");
        }
    }
}
