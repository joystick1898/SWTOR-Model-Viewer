using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
public static class BrowserUnityValidation
{
    [Serializable] public class Result { public bool ok; public int models, materials, normalMaps; }
    public static void Run()
    {
        // Deliberately do NOT call the repair helper. This verifies first import.
        AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
        var result=new Result();
        foreach(var file in Directory.GetFiles("Assets/BrowserValidation","*.fbx",SearchOption.AllDirectories))
        {
            var asset=file.Replace('\\','/');
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(asset);
            if(!model)throw new Exception("FBX missing: "+asset);
            var materials=model.GetComponentsInChildren<Renderer>(true).SelectMany(r=>r.sharedMaterials).Distinct();
            foreach(var mat in materials)
            {
                if(!mat||!AssetDatabase.GetAssetPath(mat).Contains(".materials/"))throw new Exception("Material not pre-mapped: "+asset);
                if(!mat.mainTexture||!mat.GetTexture("_BumpMap"))throw new Exception("Missing material textures: "+mat.name);
                if(mat.shader.name!="Standard (Specular setup)")throw new Exception("Wrong shader: "+mat.shader.name);
                var normal=AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(mat.GetTexture("_BumpMap"))) as TextureImporter;
                if(!normal||normal.textureType!=TextureImporterType.NormalMap||normal.sRGBTexture)throw new Exception("Normal metadata not honored: "+mat.name);
                result.materials++;result.normalMaps++;
            }
            result.models++;
        }
        if(result.models<3)throw new Exception("Missing test exports");
        result.ok=true;File.WriteAllText("../../reports/browser-unity-import.json",JsonUtility.ToJson(result,true));
        Debug.Log("BROWSER_UNITY_PASS "+JsonUtility.ToJson(result));
    }
}
