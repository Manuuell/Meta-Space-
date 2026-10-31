using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;
using UnityEngine;

namespace MetaSpace.EditorTools
{
    /// <summary>
    /// Prepara el proyecto desde linea de comandos: carpetas y paquetes.
    /// Se ejecuta una vez con -executeMethod y se puede repetir sin romper nada.
    /// </summary>
    public static class ProjectBootstrap
    {
        static readonly string[] Folders =
        {
            "Assets/_Project/Art/Characters",
            "Assets/_Project/Art/Environment",
            "Assets/_Project/Art/UI",
            "Assets/_Project/Audio",
            "Assets/_Project/Data/Parts",
            "Assets/_Project/Data/Relics",
            "Assets/_Project/Prefabs",
            "Assets/_Project/Scenes",
            "Assets/_Project/Scripts/Mission",
            "Assets/_Project/Scripts/UI",
            "Assets/_Project/Scripts/World",
            "Assets/_Project/Settings"
        };

        static readonly string[] Packages =
        {
            "com.unity.ugui",
            "com.unity.inputsystem",
            "com.unity.2d.sprite",
            "com.unity.2d.tilemap.extras"
        };

        public static void Run()
        {
            CreateFolders();
            FixOdinPackaging();
            AddPackages();
            AssetDatabase.Refresh();
            Debug.Log("[Bootstrap] Listo.");
        }

        /// <summary>
        /// Odin trae OdinUpgrader.cs fuera de una carpeta Editor, pese a ser
        /// codigo de editor. En el editor compila; al generar un ejecutable,
        /// Unity lo mete en el ensamblado del juego y la build falla entera.
        ///
        /// Odin esta en .gitignore, asi que quien clone el proyecto importara
        /// su propia copia y se topara con lo mismo: por eso la correccion vive
        /// aqui y no en un paso manual que alguien olvidara.
        /// </summary>
        static void FixOdinPackaging()
        {
            const string odinRoot = "Assets/Plugins/Sirenix/Odin Inspector";
            const string stray = odinRoot + "/OdinUpgrader.cs";

            if (!File.Exists(stray)) return;

            string editorDir = odinRoot + "/Editor";
            if (!Directory.Exists(editorDir)) Directory.CreateDirectory(editorDir);

            File.Move(stray, editorDir + "/OdinUpgrader.cs");
            if (File.Exists(stray + ".meta"))
                File.Move(stray + ".meta", editorDir + "/OdinUpgrader.cs.meta");

            Debug.Log("[Bootstrap] OdinUpgrader.cs movido a Editor/: sin esto no compila ninguna build.");
        }

        static void CreateFolders()
        {
            foreach (var folder in Folders)
            {
                if (Directory.Exists(folder)) continue;
                Directory.CreateDirectory(folder);
                // Un .gitkeep para que git conserve la carpeta vacia.
                File.WriteAllText(Path.Combine(folder, ".gitkeep"), string.Empty);
                Debug.Log($"[Bootstrap] Carpeta creada: {folder}");
            }
        }

        static void AddPackages()
        {
            var missing = new List<string>();
            foreach (var id in Packages)
            {
                if (!Directory.Exists($"Library/PackageCache/{id}"))
                    missing.Add(id);
            }

            Debug.Log($"[Bootstrap] Resolviendo paquetes: {string.Join(", ", Packages)}");

            AddAndRemoveRequest request = Client.AddAndRemove(Packages, new string[0]);
            while (!request.IsCompleted)
                System.Threading.Thread.Sleep(100);

            if (request.Status == StatusCode.Failure)
                Debug.LogError($"[Bootstrap] Fallo al resolver paquetes: {request.Error.message}");
            else
                Debug.Log("[Bootstrap] Paquetes resueltos.");
        }
    }
}
