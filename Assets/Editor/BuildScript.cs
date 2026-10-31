using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace MetaSpace.EditorTools
{
    /// <summary>
    /// Compilaciones desde linea de comandos. La de macOS existe sobre todo
    /// como prueba de humo: arrancarla sin pantalla delata las excepciones que
    /// una compilacion limpia no ve, porque pasan al construirse la interfaz.
    /// </summary>
    public static class BuildScript
    {
        static string[] Scenes =>
            EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();

        public static void MacOS() => Build(BuildTarget.StandaloneOSX, "Builds/macOS/MetaSpace.app");

        public static void WebGL()
        {
            // Sin comprimir: Brotli y Gzip exigen que el servidor mande las
            // cabeceras correctas, y un servidor estatico cualquiera no lo hace.
            // Pesa mas, pero abre desde cualquier sitio, que es lo que importa
            // cuando quien lo evalua solo tiene un enlace.
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.FullWithStacktrace;
            PlayerSettings.runInBackground = true;

            Build(BuildTarget.WebGL, "Builds/WebGL");
        }

        /// <summary>
        /// Solo el Sector Delta, para mirarlo en el navegador mientras no haya
        /// forma de llegar a el desde el resto del juego.
        /// </summary>
        public static void WebGLSector()
        {
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.FullWithStacktrace;
            PlayerSettings.runInBackground = true;

            Build(BuildTarget.WebGL, "Builds/WebGL-Sector",
                  new[] { "Assets/_Project/Scenes/SectorDelta.unity" });
        }

        static void Build(BuildTarget target, string output, string[] scenes = null)
        {
            var options = new BuildPlayerOptions
            {
                scenes = scenes ?? Scenes,
                locationPathName = output,
                target = target,
                options = BuildOptions.None
            };

            Debug.Log($"[Build] {target} -> {output} ({options.scenes.Length} escenas)");

            var report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;

            Debug.Log($"[Build] {summary.result} · {summary.totalSize / 1048576f:0.0} MB · " +
                      $"{summary.totalTime.TotalSeconds:0} s · {summary.totalErrors} errores");

            if (summary.result != BuildResult.Succeeded)
                EditorApplication.Exit(1);
        }
    }
}
