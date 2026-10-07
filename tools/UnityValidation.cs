using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

public static class UnityValidation
{
    public static void Run()
    {
        const string asset = "Assets/SWTORViewerExamples/AttonRigged/Atton-equipped.fbx";
        SWTORViewerImport.Prepare(asset);
        var root = (GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(asset));
        var skins = root.GetComponentsInChildren<SkinnedMeshRenderer>();
        if (skins.Length != 15 || skins.Any(s => s.bones.Length == 0)) throw new Exception("Lost skinned meshes");
        var transforms = root.GetComponentsInChildren<Transform>();
        var wrist = transforms.First(t => t.name == "RightWrist");
        var weapon = skins.First(s => s.name.StartsWith("blaster_high02"));
        var hair = skins.First(s => s.name.StartsWith("hair_human"));
        var material = hair.sharedMaterial;
        if (material.GetFloat("_Mode") != 1 || !material.IsKeywordEnabled("_ALPHATEST_ON") || material.renderQueue != 2450)
            throw new Exception("Hair cutout not configured");
        var surfaces = skins.SelectMany(s => s.sharedMaterials).Distinct().ToArray();
        if (surfaces.Length != 10 || surfaces.Any(m => !m.mainTexture || !m.GetTexture("_BumpMap"))) throw new Exception("Missing mapped textures");
        if (surfaces.Where(m => !m.name.Contains("Eye")).Any(m => m.GetColor("_SpecColor").maxColorComponent > .001f))
            throw new Exception("Unexpected specular on matte material");
        foreach (var m in surfaces)
        {
            var normal = AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(m.GetTexture("_BumpMap"))) as TextureImporter;
            if (normal.textureType != TextureImporterType.NormalMap) throw new Exception("Normal map imported as color");
        }
        var baked = new Mesh(); weapon.BakeMesh(baked); var before = weapon.transform.TransformPoint(baked.vertices[0]);
        var rotation = wrist.localRotation; wrist.localRotation *= Quaternion.AngleAxis(20, Vector3.up);
        weapon.BakeMesh(baked); var after = weapon.transform.TransformPoint(baked.vertices[0]);
        float movement = Vector3.Distance(before, after); wrist.localRotation = rotation;
        if (movement < .00001f) throw new Exception("Manual wrist pose did not deform weapon");
        var animator = root.GetComponentInChildren<Animator>();
        if (animator && animator.runtimeAnimatorController) throw new Exception("Animation overrides manual pose");
        File.WriteAllText("../unity-validation.json", "{\"ok\":true,\"skinnedMeshes\":" + skins.Length + ",\"materials\":" + surfaces.Length + ",\"hairCutout\":true,\"normalMaps\":true,\"manualWristMovement\":" + movement.ToString(System.Globalization.CultureInfo.InvariantCulture) + "}");
        Render(root, "../unity-equipped.png");
        var packageAssets = new System.Collections.Generic.List<string>{asset, asset+".json", "Assets/Editor/SWTORViewerImport.cs"};
        foreach (var m in surfaces)
        {
            packageAssets.Add(AssetDatabase.GetAssetPath(m));
            foreach (var property in new[]{"_MainTex","_BumpMap","_EmissionMap"}) packageAssets.Add(AssetDatabase.GetAssetPath(m.GetTexture(property)));
        }
        AssetDatabase.ExportPackage(packageAssets.Distinct().ToArray(), "../Atton-equipped-unity.unitypackage", ExportPackageOptions.Default);
    }

    static void Render(GameObject root, string file)
    {
        var renderers = root.GetComponentsInChildren<Renderer>(); var bounds = renderers[0].bounds;
        foreach (var r in renderers) bounds.Encapsulate(r.bounds);
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat; RenderSettings.ambientLight = new Color(.45f,.45f,.45f);
        var light = new GameObject("Key").AddComponent<Light>(); light.type = LightType.Directional; light.intensity = 1;
        light.transform.rotation = Quaternion.Euler(35,-30,0);
        var camera = new GameObject("Camera").AddComponent<Camera>(); camera.backgroundColor = new Color(.055f,.075f,.09f); camera.clearFlags = CameraClearFlags.SolidColor;
        camera.nearClipPlane = .001f; camera.farClipPlane = 1000; camera.fieldOfView = 32;
        camera.transform.position = bounds.center + new Vector3(.4f,.12f,1.9f)*bounds.size.y; camera.transform.LookAt(bounds.center);
        var target = new RenderTexture(1000,1000,24); camera.targetTexture = target; camera.Render();
        RenderTexture.active = target; var image = new Texture2D(1000,1000,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1000,1000),0,0); image.Apply(); File.WriteAllBytes(file,image.EncodeToPNG());
        RenderTexture.active=null;camera.targetTexture=null;UnityEngine.Object.DestroyImmediate(target);UnityEngine.Object.DestroyImmediate(image);
    }

    public static void Reference()
    {
        var root = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Reference/AttonRandShoot.prefab");
        if (!root) throw new Exception("Missing reference prefab");
        var transforms = root.GetComponentsInChildren<Transform>(true);
        var socket = transforms.First(t => t.name == "RightWeapon");
        var lines = transforms.Where(t => t.name.IndexOf("blast", StringComparison.OrdinalIgnoreCase) >= 0)
            .Select(t => t.name + " parent=" + (t.parent ? t.parent.name : "none") + " local=" + t.localToWorldMatrix.ToString("F7") + " relativeSocket=" + (socket.worldToLocalMatrix * t.localToWorldMatrix).ToString("F7")).ToArray();
        File.WriteAllText("../reference-grip-unity.txt", string.Join("\n", lines));
    }
}
