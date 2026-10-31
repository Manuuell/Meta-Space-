using MetaSpace.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;

namespace MetaSpace.EditorTools
{
    /// <summary>
    /// Crea la escena del planeta y la pone como escena inicial, con el banco
    /// de trabajo detras: el juego arranca en el mundo, no en una pantalla de
    /// gestion.
    /// </summary>
    public static class PlanetSceneBuilder
    {
        const string ScenePath = "Assets/_Project/Scenes/Planeta.unity";
        const string WorkbenchPath = "Assets/_Project/Scenes/Workbench.unity";

        [MenuItem("Meta Space/Regenerar escena del planeta")]
        public static void Run()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            new GameObject("Planeta", typeof(PlanetScene));

            EditorSceneManager.SaveScene(scene, ScenePath);

            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true),
                new EditorBuildSettingsScene(WorkbenchPath, true)
            };

            Debug.Log($"[Escena] {ScenePath} generada como escena inicial.");
        }
    }
}
