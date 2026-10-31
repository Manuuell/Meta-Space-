using System.Collections.Generic;
using System.Linq;
using MetaSpace.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;

namespace MetaSpace.EditorTools
{
    /// <summary>
    /// Monta el Sector Delta: un tramo de la ciudad muerta con los modelos de
    /// Synty, bajo el cielo de sulfatos.
    ///
    /// Las piezas no se colocan con medidas inventadas: el constructor mide el
    /// tamano real de cada prefab y reparte a partir de eso. Hoy ya me han
    /// mordido tres veces las escalas puestas a ojo.
    ///
    /// Synty esta en .gitignore, asi que esta escena solo se puede regenerar en
    /// una maquina que haya importado el paquete desde el Package Manager.
    /// </summary>
    public static class DeadCitySceneBuilder
    {
        const string ScenePath = "Assets/_Project/Scenes/SectorDelta.unity";
        const string City = "Assets/SyntyStudios/PolygonCity/Prefabs/";

        const int Tiles = 24;          // tramos de calle a lo largo
        const int Lanes = 3;           // tramos de carretera a lo ancho: avenida, no callejon
        const float PadDepth = 70f;    // explanada de lanzamiento al final de la avenida
        const float PadHalfWidth = 32f;

        static readonly string[] Buildings =
        {
            "Buildings/SM_Bld_OfficeSquare_01", "Buildings/SM_Bld_OfficeSquare_03",
            "Buildings/SM_Bld_OfficeRound_02", "Buildings/SM_Bld_OfficeOld_Large_02",
            "Buildings/SM_Bld_Apartment_01", "Buildings/SM_Bld_Shop_02",
            "Buildings/SM_Bld_Shop_06", "Buildings/SM_Bld_OfficeSquare_01"
        };

        static readonly string[] Cars =
        {
            "Vehicles/SM_Veh_Car_Taxi_01", "Vehicles/SM_Veh_Car_Sedan_01",
            "Vehicles/SM_Veh_Car_Ambo_01", "Vehicles/SM_Veh_Car_Police_01",
            "Vehicles/SM_Veh_Car_Van_01", "Vehicles/SM_Veh_Car_Medium_01"
        };

        [MenuItem("Meta Space/Regenerar Sector Delta")]
        public static void Run()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var road = Load("Environments/SM_Env_Road_01");
            var sidewalk = Load("Environments/SM_Env_Sidewalk_Straight_01");
            if (road == null || sidewalk == null)
            {
                Debug.LogError("[Sector] Falta PolygonCity. Importa el paquete desde " +
                               "Package Manager > My Assets antes de regenerar la escena.");
                return;
            }

            // Medir antes de repartir. Ojo: Synty pone el pivote en una esquina,
            // no en el centro, asi que todo se coloca por sus limites reales.
            var roadSize = Measure(road);
            var walkSize = Measure(sidewalk);
            Debug.Log($"[Sector] Carretera {roadSize.x:0.0} x {roadSize.z:0.0} · " +
                      $"acera {walkSize.x:0.0} x {walkSize.z:0.0}");

            float step = Mathf.Max(roadSize.z, 1f);
            float roadHalf = Mathf.Max(roadSize.x, 1f) * Lanes * 0.5f;
            float walkWidth = Mathf.Max(walkSize.x, 1f);
            float length = step * Tiles;

            var root = new GameObject("Sector Delta").transform;

            BuildStreet(root, road, sidewalk, step, roadSize.x, roadHalf, walkWidth);
            var roofs = BuildBuildings(root, length, roadHalf + walkWidth);
            BuildCars(root, length, roadHalf);
            BuildCapsule(root);
            BuildLaunchPad(root, length);
            BuildAntennas(root, roofs);
            BuildRecolector(root, length);
            BuildBounds(root, length, roadHalf + walkWidth);
            BuildAtmosphere(root, length);
            BuildPlayer();

            new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));

            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log($"[Sector] {ScenePath} generada. Calle de {length:0} m, " +
                      $"{roadHalf * 2f:0} m de calzada.");
        }

        // ------------------------------------------------------------ Calle

        static void BuildStreet(Transform root, GameObject road, GameObject sidewalk,
                                float step, float laneWidth, float roadHalf, float walkWidth)
        {
            var group = new GameObject("Calle").transform;
            group.SetParent(root, false);

            for (int i = 0; i < Tiles; i++)
            {
                float z = i * step;
                for (int lane = 0; lane < Lanes; lane++)
                    PlaceAt(road, group, Quaternion.identity, -roadHalf + lane * laneWidth, z);

                PlaceAt(sidewalk, group, Quaternion.identity, -roadHalf - walkWidth, z);
                PlaceAt(sidewalk, group, Quaternion.Euler(0f, 180f, 0f), roadHalf, z);
            }
        }

        static List<Bounds> BuildBuildings(Transform root, float length, float offset)
        {
            var group = new GameObject("Edificios").transform;
            group.SetParent(root, false);

            var roofs = new List<Bounds>();
            var random = new System.Random(1971);
            var prefabs = Buildings.Select(Load).Where(p => p != null).ToList();
            if (prefabs.Count == 0) return roofs;

            foreach (int side in new[] { -1, 1 })
            {
                // Encadenados por su fondo real: cada edificio empieza donde
                // acaba el anterior, con un callejon estrecho de vez en cuando.
                float z = 0f;
                while (z < length)
                {
                    var prefab = prefabs[random.Next(prefabs.Count)];
                    var rotation = Quaternion.Euler(0f, side < 0 ? 90f : -90f, 0f);
                    var size = RotatedBounds(prefab, rotation).size;
                    if (z + size.z > length + 4f) break;

                    // Fachada a ras del borde exterior de la acera.
                    float x = side < 0 ? -offset - size.x : offset;
                    var instance = PlaceAt(prefab, group, rotation, x, z);
                    AddBlocker(instance);
                    roofs.Add(WorldBounds(instance));

                    z += size.z + (random.NextDouble() < 0.3 ? 2.5f : 0.2f);
                }
            }
            return roofs;
        }

        static void BuildCars(Transform root, float length, float roadHalf)
        {
            var group = new GameObject("Coches detenidos").transform;
            group.SetParent(root, false);

            var random = new System.Random(503);
            var prefabs = Cars.Select(Load).Where(p => p != null).ToList();
            if (prefabs.Count == 0) return;

            // Parados donde les pillo, no aparcados: algunos cruzados, uno en
            // mitad del carril contrario. Quinientos anos sin que nadie los mueva.
            var taken = new List<Vector2>();
            for (int attempt = 0; attempt < 60 && taken.Count < 14; attempt++)
            {
                // Los primeros metros quedan libres: ahi estan el jugador y su capsula.
                var spot = new Vector2(((float)random.NextDouble() * 2f - 1f) * roadHalf * 0.75f,
                                       20f + (float)random.NextDouble() * (length - 24f));
                if (taken.Any(t => Vector2.Distance(t, spot) < 7f)) continue;
                taken.Add(spot);

                var prefab = prefabs[random.Next(prefabs.Count)];
                float yaw = random.NextDouble() < 0.7
                    ? (random.NextDouble() < 0.5 ? 0f : 180f) + (float)(random.NextDouble() * 24 - 12)
                    : (float)(random.NextDouble() * 360);

                var rotation = Quaternion.Euler(0f, yaw, 0f);
                var bounds = RotatedBounds(prefab, rotation);
                var instance = PlaceAt(prefab, group, rotation,
                                       spot.x - bounds.size.x * 0.5f, spot.y - bounds.size.z * 0.5f);
                AddBlocker(instance);
            }
        }

        /// <summary>
        /// Suelo y topes propios: no me fio de que los prefabs traigan
        /// colisionadores, y un jugador cayendo al vacio no lo arregla nadie.
        /// </summary>
        static void BuildBounds(Transform root, float length, float halfWidth)
        {
            var group = new GameObject("Limites").transform;
            group.SetParent(root, false);

            Box(group, "Suelo", new Vector3(0f, -0.5f, length * 0.5f), new Vector3(200f, 1f, length + 200f));
            Box(group, "Tope sur", new Vector3(0f, 5f, -1f), new Vector3(halfWidth * 2f, 10f, 1f));
            Box(group, "Tope oeste", new Vector3(-halfWidth - 0.5f, 5f, length * 0.5f), new Vector3(1f, 10f, length));
            Box(group, "Tope este", new Vector3(halfWidth + 0.5f, 5f, length * 0.5f), new Vector3(1f, 10f, length));

            // La explanada de lanzamiento es mas ancha que la calle.
            float far = length + PadDepth;
            Box(group, "Tope norte", new Vector3(0f, 5f, far + 0.5f), new Vector3(PadHalfWidth * 2f, 10f, 1f));
            Box(group, "Tope explanada oeste", new Vector3(-PadHalfWidth - 0.5f, 5f, length + PadDepth * 0.5f), new Vector3(1f, 10f, PadDepth));
            Box(group, "Tope explanada este", new Vector3(PadHalfWidth + 0.5f, 5f, length + PadDepth * 0.5f), new Vector3(1f, 10f, PadDepth));
            float corner = PadHalfWidth - halfWidth;
            Box(group, "Esquina oeste", new Vector3(-halfWidth - corner * 0.5f, 5f, length), new Vector3(corner, 10f, 1f));
            Box(group, "Esquina este", new Vector3(halfWidth + corner * 0.5f, 5f, length), new Vector3(corner, 10f, 1f));

            // Un suelo oscuro visible bajo todo, para que los huecos entre
            // edificios no dejen ver el cielo por debajo.
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "Tierra";
            floor.transform.SetParent(group, false);
            // Enorme a proposito: su borde tiene que quedar muy dentro de la niebla.
            floor.transform.position = new Vector3(0f, -0.25f, length * 0.5f);
            floor.transform.localScale = new Vector3(150f, 1f, 150f);
            Object.DestroyImmediate(floor.GetComponent<Collider>());
            var material = new Material(Shader.Find("Standard"));
            material.color = new Color(0.16f, 0.08f, 0.07f);
            floor.GetComponent<MeshRenderer>().sharedMaterial = SaveMaterial(material, "Tierra_Sector");
        }

        // ---------------------------------------------------------- Mision
        //
        // Synty no trae nada espacial, asi que esto se construye con primitivas,
        // igual que el arte del planeta 2D. Lo que importa es la silueta: una
        // capsula que no pinta nada en una avenida, y un cohete al fondo.

        static void BuildCapsule(Transform root)
        {
            var group = new GameObject("Capsula estrellada").transform;
            group.SetParent(root, false);
            group.position = new Vector3(-3.5f, -0.6f, 11f);
            group.rotation = Quaternion.Euler(28f, 35f, 8f);

            var hull = Mat("Casco_Capsula", new Color(0.78f, 0.76f, 0.72f));
            var scorch = Mat("Quemado", new Color(0.09f, 0.07f, 0.07f));
            var orange = Mat("Naranja_Mision", new Color(0.95f, 0.45f, 0.12f));
            var glow = Mat("Luz_Ambar", new Color(1f, 0.6f, 0.2f), new Color(1f, 0.55f, 0.15f) * 2f);

            // Cono tipo Apollo: tres tramos que se estrechan, escudo quemado debajo.
            Part(group, PrimitiveType.Sphere, new Vector3(0f, 0.2f, 0f), new Vector3(4.4f, 0.9f, 4.4f), Vector3.zero, scorch);
            // Muchos tramos finos para que se lea como cono y no como tarta.
            const int rings = 10;
            for (int i = 0; i < rings; i++)
            {
                float t = i / (float)(rings - 1);
                float radius = Mathf.Lerp(4.3f, 1.2f, t);
                Part(group, PrimitiveType.Cylinder, new Vector3(0f, 0.55f + i * 0.33f, 0f),
                     new Vector3(radius, 0.17f, radius), Vector3.zero, hull);
            }
            Part(group, PrimitiveType.Cylinder, new Vector3(0f, 3.9f, 0f), new Vector3(1.0f, 0.25f, 1.0f), Vector3.zero, scorch);
            Part(group, PrimitiveType.Cube, new Vector3(0f, 1.8f, 1.75f), new Vector3(1.0f, 1.3f, 0.2f), new Vector3(-12f, 0f, 0f), orange);
            Part(group, PrimitiveType.Cube, new Vector3(0f, 2.3f, -1.4f), new Vector3(0.7f, 0.5f, 0.1f), new Vector3(14f, 0f, 0f), glow);

            var beacon = new GameObject("Baliza", typeof(Light));
            beacon.transform.SetParent(group, false);
            beacon.transform.localPosition = new Vector3(0f, 2.4f, -2f);
            var light = beacon.GetComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.55f, 0.2f);
            light.range = 9f;
            light.intensity = 2.2f;

            // Crater y el rastro hasta el, y el paracaidas tirado detras.
            var crater = Part(root, PrimitiveType.Cylinder, new Vector3(-3.5f, 0.01f, 11f), new Vector3(9f, 0.01f, 8f), Vector3.zero, scorch);
            Object.DestroyImmediate(crater.GetComponent<Collider>());
            var trail = Part(root, PrimitiveType.Cube, new Vector3(-1.5f, 0.01f, 22f), new Vector3(2.4f, 0.01f, 18f), new Vector3(0f, -10f, 0f), scorch);
            Object.DestroyImmediate(trail.GetComponent<Collider>());

            // El paracaidas quedo atras, en el rastro del arrastre.
            var chute = Part(root, PrimitiveType.Sphere, new Vector3(0.5f, 0.05f, 27f), new Vector3(7f, 0.35f, 4.5f), new Vector3(0f, 25f, 0f), orange);
            Object.DestroyImmediate(chute.GetComponent<Collider>());

            var random = new System.Random(77);
            for (int i = 0; i < 9; i++)
            {
                float s = 0.2f + (float)random.NextDouble() * 0.6f;
                Part(root, PrimitiveType.Cube,
                     new Vector3(-3.5f + (float)(random.NextDouble() * 10 - 5), s * 0.4f, 11f + (float)(random.NextDouble() * 14 - 4)),
                     new Vector3(s * 1.6f, s * 0.5f, s), new Vector3(0f, (float)random.NextDouble() * 360f, (float)random.NextDouble() * 30f),
                     i % 3 == 0 ? scorch : hull);
            }
        }

        static void BuildLaunchPad(Transform root, float length)
        {
            var group = new GameObject("Plataforma de lanzamiento").transform;
            group.SetParent(root, false);

            var concrete = Mat("Hormigon_Plataforma", new Color(0.42f, 0.33f, 0.30f));
            var steel = Mat("Acero_Torre", new Color(0.36f, 0.20f, 0.17f));
            var hull = Mat("Casco_Cohete", new Color(0.88f, 0.86f, 0.82f));
            var dark = Mat("Quemado", new Color(0.09f, 0.07f, 0.07f));
            var orange = Mat("Naranja_Mision", new Color(0.95f, 0.45f, 0.12f));
            var red = Mat("Luz_Roja", new Color(1f, 0.1f, 0.05f), new Color(1f, 0.1f, 0.05f) * 3f);

            // Explanada: la avenida desemboca en hormigon abierto.
            Part(group, PrimitiveType.Cube, new Vector3(0f, -0.08f, length + PadDepth * 0.5f),
                 new Vector3(PadHalfWidth * 2f, 0.2f, PadDepth), Vector3.zero, concrete);

            var pad = new Vector3(0f, 0f, length + PadDepth * 0.6f);
            Part(group, PrimitiveType.Cylinder, pad + Vector3.up * 1f, new Vector3(18f, 1f, 18f), Vector3.zero, concrete);
            var flame = Part(group, PrimitiveType.Cylinder, pad + Vector3.up * 2.01f, new Vector3(7f, 0.01f, 7f), Vector3.zero, dark);
            Object.DestroyImmediate(flame.GetComponent<Collider>());

            // Cohete de dos etapas con dos aceleradores, ~48 m sobre la plataforma.
            float baseY = 2f;
            var rocket = new GameObject("Cohete").transform;
            rocket.SetParent(group, false);
            rocket.position = pad;
            Part(rocket, PrimitiveType.Cylinder, new Vector3(0f, baseY + 14f, 0f), new Vector3(5f, 14f, 5f), Vector3.zero, hull);
            Part(rocket, PrimitiveType.Cylinder, new Vector3(0f, baseY + 28.5f, 0f), new Vector3(5.1f, 0.5f, 5.1f), Vector3.zero, dark);
            Part(rocket, PrimitiveType.Cylinder, new Vector3(0f, baseY + 35f, 0f), new Vector3(4.4f, 6f, 4.4f), Vector3.zero, hull);
            Part(rocket, PrimitiveType.Cylinder, new Vector3(0f, baseY + 41.5f, 0f), new Vector3(4.6f, 0.5f, 4.6f), Vector3.zero, orange);
            Part(rocket, PrimitiveType.Sphere, new Vector3(0f, baseY + 44f, 0f), new Vector3(4.6f, 8f, 4.6f), Vector3.zero, hull);
            foreach (int side in new[] { -1, 1 })
            {
                Part(rocket, PrimitiveType.Cylinder, new Vector3(side * 3.6f, baseY + 10f, 0f), new Vector3(2.2f, 10f, 2.2f), Vector3.zero, hull);
                Part(rocket, PrimitiveType.Sphere, new Vector3(side * 3.6f, baseY + 20f, 0f), new Vector3(2.2f, 3.4f, 2.2f), Vector3.zero, orange);
                Part(rocket, PrimitiveType.Cube, new Vector3(0f, baseY + 2.5f, side * 3.2f), new Vector3(0.3f, 5f, 2.2f), Vector3.zero, dark);
            }

            // Torre de servicio: celosia de vigas junto al cohete, con brazos.
            var tower = new GameObject("Torre de servicio").transform;
            tower.SetParent(group, false);
            tower.position = pad + new Vector3(10f, 0f, 0f);
            const float height = 54f, half = 2.4f;
            foreach (var corner in new[] { new Vector2(-1, -1), new Vector2(1, -1), new Vector2(-1, 1), new Vector2(1, 1) })
                Part(tower, PrimitiveType.Cube, new Vector3(corner.x * half, height * 0.5f, corner.y * half),
                     new Vector3(0.5f, height, 0.5f), Vector3.zero, steel);
            for (float y = 4f; y < height; y += 4f)
            {
                Part(tower, PrimitiveType.Cube, new Vector3(0f, y, -half), new Vector3(half * 2f, 0.3f, 0.3f), Vector3.zero, steel);
                Part(tower, PrimitiveType.Cube, new Vector3(0f, y, half), new Vector3(half * 2f, 0.3f, 0.3f), Vector3.zero, steel);
                Part(tower, PrimitiveType.Cube, new Vector3(-half, y, 0f), new Vector3(0.3f, 0.3f, half * 2f), Vector3.zero, steel);
                Part(tower, PrimitiveType.Cube, new Vector3(half, y, 0f), new Vector3(0.3f, 0.3f, half * 2f), Vector3.zero, steel);
                Part(tower, PrimitiveType.Cube, new Vector3(0f, y - 2f, -half), new Vector3(0.2f, 0.2f, 6.6f), new Vector3(0f, 90f, 50f), steel);
            }
            foreach (float y in new[] { 20f, 36f })
                Part(tower, PrimitiveType.Cube, new Vector3(-5f, y, 0f), new Vector3(5.5f, 1f, 1.6f), Vector3.zero, steel);

            // Luces de aviso en lo alto: lo primero que se ve entre la niebla.
            foreach (var at in new[] { new Vector3(0f, height + 0.5f, 0f), new Vector3(0f, 30f, 0f) })
            {
                Part(tower, PrimitiveType.Sphere, at, Vector3.one * 0.8f, Vector3.zero, red);
                var lightGo = new GameObject("Aviso", typeof(Light));
                lightGo.transform.SetParent(tower, false);
                lightGo.transform.localPosition = at;
                var light = lightGo.GetComponent<Light>();
                light.type = LightType.Point;
                light.color = new Color(1f, 0.15f, 0.08f);
                light.range = 16f;
                light.intensity = 3f;
            }
        }

        static void BuildAntennas(Transform root, List<Bounds> roofs)
        {
            var group = new GameObject("Antenas de HELIOS").transform;
            group.SetParent(root, false);

            var steel = Mat("Acero_Torre", new Color(0.36f, 0.20f, 0.17f));
            var dish = Mat("Plato_Antena", new Color(0.70f, 0.66f, 0.62f));
            var red = Mat("Luz_Roja", new Color(1f, 0.1f, 0.05f), new Color(1f, 0.1f, 0.05f) * 3f);

            // Solo en las azoteas altas: HELIOS escucha desde arriba.
            var random = new System.Random(4242);
            foreach (var roof in roofs.Where(r => r.max.y > 15f))
            {
                if (random.NextDouble() < 0.35) continue;

                var top = new Vector3(roof.center.x, roof.max.y, roof.center.z);
                var mast = new GameObject("Antena").transform;
                mast.SetParent(group, false);
                mast.position = top;
                mast.rotation = Quaternion.Euler(0f, (float)random.NextDouble() * 360f, 0f);

                Part(mast, PrimitiveType.Cylinder, new Vector3(0f, 3f, 0f), new Vector3(0.35f, 3f, 0.35f), Vector3.zero, steel);
                Part(mast, PrimitiveType.Sphere, new Vector3(0f, 6.2f, 0.6f), new Vector3(4.5f, 1.2f, 4.5f), new Vector3(-55f, 0f, 0f), dish);
                Part(mast, PrimitiveType.Cylinder, new Vector3(0f, 6.8f, 1.6f), new Vector3(0.12f, 1.2f, 0.12f), new Vector3(-55f, 0f, 0f), steel);
                Part(mast, PrimitiveType.Sphere, new Vector3(0f, 6.3f, 0f), Vector3.one * 0.35f, Vector3.zero, red);
            }
        }

        static void BuildRecolector(Transform root, float length)
        {
            var hull = Mat("Casco_Recolector", new Color(0.16f, 0.14f, 0.15f));
            var eyeMat = Mat("Ojo_Recolector", new Color(1f, 0.2f, 0.08f), new Color(1f, 0.2f, 0.08f) * 4f);

            var go = new GameObject("Recolector", typeof(RecolectorDrone));
            go.transform.SetParent(root, false);

            Part(go.transform, PrimitiveType.Sphere, Vector3.zero, new Vector3(2.4f, 1.4f, 2.4f), Vector3.zero, hull);
            Part(go.transform, PrimitiveType.Cylinder, Vector3.zero, new Vector3(4.2f, 0.08f, 4.2f), Vector3.zero, hull);
            Part(go.transform, PrimitiveType.Sphere, new Vector3(0f, -0.1f, 1.05f), new Vector3(0.6f, 0.6f, 0.4f), Vector3.zero, eyeMat);
            foreach (var leg in new[] { -1f, 1f })
                Part(go.transform, PrimitiveType.Cube, new Vector3(leg * 0.7f, -1.3f, 0f), new Vector3(0.12f, 1.6f, 0.12f), new Vector3(0f, 0f, leg * 15f), hull);

            var eyeGo = new GameObject("Ojo", typeof(Light));
            eyeGo.transform.SetParent(go.transform, false);
            eyeGo.transform.localPosition = new Vector3(0f, -0.4f, 1.6f);
            eyeGo.transform.localRotation = Quaternion.Euler(40f, 0f, 0f);
            var eye = eyeGo.GetComponent<Light>();
            eye.type = LightType.Spot;
            eye.spotAngle = 50f;
            eye.range = 22f;
            eye.color = new Color(1f, 0.25f, 0.1f);
            eye.intensity = 4f;

            foreach (var collider in go.GetComponentsInChildren<Collider>())
                Object.DestroyImmediate(collider);

            var drone = go.GetComponent<RecolectorDrone>();
            drone.from = new Vector3(4f, 13f, 34f);
            drone.to = new Vector3(-3f, 11f, length - 10f);
            drone.eye = eye;
            go.transform.position = drone.from;
        }

        // ------------------------------------------------------- Atmosfera

        static void BuildAtmosphere(Transform root, float length)
        {
            var lightGo = new GameObject("Sol de sulfatos", typeof(Light));
            lightGo.transform.SetParent(root, false);
            var light = lightGo.GetComponent<Light>();
            light.type = LightType.Directional;
            light.color = new Color(1f, 0.52f, 0.33f);
            light.intensity = 1.15f;
            light.shadows = LightShadows.Soft;
            // Rasante: el sol nunca sube del todo bajo el velo.
            lightGo.transform.rotation = Quaternion.Euler(14f, 36f, 0f);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.43f, 0.16f, 0.14f);
            RenderSettings.ambientEquatorColor = new Color(0.26f, 0.10f, 0.11f);
            RenderSettings.ambientGroundColor = new Color(0.10f, 0.05f, 0.06f);

            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = new Color(0.43f, 0.16f, 0.13f);
            // Lo bastante fina para que el cohete se adivine desde la capsula.
            RenderSettings.fogDensity = 0.0075f;

            // Sin skybox: el procedural con atmosfera espesa y tinte rojo sale
            // verde. El cielo es el propio velo, del color de la niebla, y asi
            // el fondo de la calle se disuelve en el sin costura.
            RenderSettings.skybox = null;

            // Sin skybox, los reflejos de entorno caen al cielo azul por defecto
            // de Unity y pintan una franja gris azulada en el horizonte.
            RenderSettings.defaultReflectionMode = UnityEngine.Rendering.DefaultReflectionMode.Custom;
            RenderSettings.reflectionIntensity = 0f;

            BuildDust(root, length);
        }

        static void BuildDust(Transform root, float length)
        {
            var go = new GameObject("Polvo en suspensión");
            go.transform.SetParent(root, false);
            go.transform.position = new Vector3(0f, 6f, length * 0.5f);

            var particles = go.AddComponent<ParticleSystem>();
            var main = particles.main;
            main.startLifetime = 20f;
            main.startSpeed = 0.35f;
            main.startSize = 0.09f;
            main.startColor = new Color(1f, 0.78f, 0.6f, 0.30f);
            main.maxParticles = 700;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = -0.004f;

            var emission = particles.emission;
            emission.rateOverTime = 70f;

            var shape = particles.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(60f, 14f, length + PadDepth);

            var renderer = go.GetComponent<ParticleSystemRenderer>();
            renderer.material = new Material(Shader.Find("Particles/Standard Unlit"))
                ?? new Material(Shader.Find("Sprites/Default"));
        }

        // ---------------------------------------------------------- Jugador

        static void BuildPlayer()
        {
            var go = new GameObject("Operador", typeof(CharacterController), typeof(FirstPersonController));
            go.transform.position = new Vector3(0f, 0.1f, 3f);

            var controller = go.GetComponent<CharacterController>();
            controller.height = 1.8f;
            controller.radius = 0.32f;
            controller.center = new Vector3(0f, 0.9f, 0f);

            var camGo = new GameObject("Visor", typeof(Camera), typeof(AudioListener));
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(go.transform, false);
            camGo.transform.localPosition = new Vector3(0f, 1.62f, 0f);

            var cam = camGo.GetComponent<Camera>();
            cam.fieldOfView = 68f;
            cam.farClipPlane = 420f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = RenderSettings.fogColor;

            go.GetComponent<FirstPersonController>().head = camGo.transform;
        }

        // ------------------------------------------------------------ Apoyo

        static GameObject Load(string relative)
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(City + relative + ".prefab");
            if (prefab == null) Debug.LogWarning($"[Sector] No encuentro {relative}");
            return prefab;
        }

        /// <summary>Tamano real del prefab, sumando lo que ocupan sus mallas.</summary>
        static Vector3 Measure(GameObject prefab) => RotatedBounds(prefab, Quaternion.identity).size;

        /// <summary>Limites del prefab ya girado, relativos a su pivote.</summary>
        static Bounds RotatedBounds(GameObject prefab, Quaternion rotation)
        {
            var renderers = prefab.GetComponentsInChildren<MeshRenderer>();
            if (renderers.Length == 0) return new Bounds(Vector3.zero, Vector3.one);

            var root = prefab.transform;
            Bounds? result = null;
            foreach (var renderer in renderers)
            {
                var b = renderer.bounds;
                for (int i = 0; i < 8; i++)
                {
                    var corner = new Vector3(i % 2 == 0 ? b.min.x : b.max.x,
                                             (i / 2) % 2 == 0 ? b.min.y : b.max.y,
                                             i / 4 == 0 ? b.min.z : b.max.z);
                    var p = rotation * (corner - root.position);
                    if (result == null) result = new Bounds(p, Vector3.zero);
                    else { var r = result.Value; r.Encapsulate(p); result = r; }
                }
            }
            return result.Value;
        }

        /// <summary>
        /// Coloca el prefab de modo que la esquina minima de sus limites (en x
        /// y z) caiga en el punto pedido, con la altura que Synty le dio.
        /// </summary>
        static GameObject PlaceAt(GameObject prefab, Transform parent, Quaternion rotation, float minX, float minZ)
        {
            var b = RotatedBounds(prefab, rotation);
            var position = new Vector3(minX - b.min.x, 0f, minZ - b.min.z);

            var instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab, parent);
            instance.transform.SetPositionAndRotation(position, rotation);
            return instance;
        }

        static Bounds WorldBounds(GameObject instance)
        {
            var renderers = instance.GetComponentsInChildren<MeshRenderer>();
            var bounds = renderers.Length > 0 ? renderers[0].bounds : new Bounds(instance.transform.position, Vector3.zero);
            foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
            return bounds;
        }

        static GameObject Part(Transform parent, PrimitiveType type, Vector3 localPosition,
                               Vector3 localScale, Vector3 localEuler, Material material)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = type.ToString();
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            go.transform.localRotation = Quaternion.Euler(localEuler);
            go.transform.localScale = localScale;
            go.GetComponent<MeshRenderer>().sharedMaterial = material;
            return go;
        }

        static Material Mat(string name, Color color, Color? emission = null)
        {
            var material = new Material(Shader.Find("Standard")) { color = color };
            material.SetFloat("_Glossiness", 0.15f);
            if (emission.HasValue)
            {
                material.EnableKeyword("_EMISSION");
                material.SetColor("_EmissionColor", emission.Value);
            }
            return SaveMaterial(material, name);
        }

        /// <summary>Caja de colision ajustada a lo que se ve.</summary>
        static void AddBlocker(GameObject instance)
        {
            var renderers = instance.GetComponentsInChildren<MeshRenderer>();
            if (renderers.Length == 0 || instance.GetComponentInChildren<Collider>() != null) return;

            var bounds = renderers[0].bounds;
            foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);

            var box = new GameObject("Colision", typeof(BoxCollider));
            box.transform.SetParent(instance.transform.parent, false);
            box.transform.position = bounds.center;
            box.GetComponent<BoxCollider>().size = bounds.size;
        }

        static void Box(Transform parent, string name, Vector3 center, Vector3 size)
        {
            var go = new GameObject(name, typeof(BoxCollider));
            go.transform.SetParent(parent, false);
            go.transform.position = center;
            go.GetComponent<BoxCollider>().size = size;
        }

        static Material SaveMaterial(Material material, string name)
        {
            const string dir = "Assets/_Project/Settings";
            string path = $"{dir}/{name}.mat";
            // Si ya existe se actualiza en su sitio: asi un cambio de color aqui
            // llega a la escena sin romper las referencias al material.
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null)
            {
                existing.shader = material.shader;
                existing.CopyPropertiesFromMaterial(material);
                existing.shaderKeywords = material.shaderKeywords;
                EditorUtility.SetDirty(existing);
                return existing;
            }

            if (!AssetDatabase.IsValidFolder(dir)) AssetDatabase.CreateFolder("Assets/_Project", "Settings");
            AssetDatabase.CreateAsset(material, path);
            return material;
        }
    }
}
