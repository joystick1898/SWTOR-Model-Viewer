using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
public static class ManualSaberUnity
{
 public static void RunEmitters()
 {
  AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
  var root=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/EmitterReview/Saber-native.fbx"));
  var renderers=root.GetComponentsInChildren<Renderer>();
  var emitters=renderers.Where(r=>r.name.Contains("emitter")).ToArray();
  if(emitters.Length!=2)throw new Exception("Physical emitter count "+emitters.Length+": "+string.Join(",",renderers.Select(r=>r.name)));
  File.WriteAllText("../saber-layout-review/unity-emitter-check.json","{\"ok\":true,\"physicalEmitters\":2}");
  Debug.Log("PHYSICAL_EMITTERS_UNITY_PASS");
 }
 public static void Run()
 {
  AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
  var root=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/ManualSaberReview/Manual-saber.fbx"));
  root.transform.localScale=Vector3.one*10000;
  var renderers=root.GetComponentsInChildren<Renderer>();
  foreach(var r in renderers)r.enabled=r.name.Contains("_blade_");
  var blades=renderers.OfType<SkinnedMeshRenderer>().Where(r=>r.enabled).ToArray();
  if(blades.Length!=12)throw new Exception("Expected six core/glow pairs");
  var mesh=new Mesh();var bounds=new Bounds();bool first=true;
  foreach(var key in new[]{"single","dual","straightLeft","straightRight","diagonalLeft","diagonalRight"})
   foreach(var channel in new[]{"core","glow"}){
    var r=blades.Single(x=>x.name.Contains("_blade_"+key+"_"+channel));r.updateWhenOffscreen=true;
    var m=r.sharedMaterial;
    if(!m.shader.isSupported||ShaderUtil.ShaderHasError(m.shader)||m.GetFloat("_Intensity")<1.5f)throw new Exception("Invalid brightness/shader: "+r.name);
    r.BakeMesh(mesh);foreach(var v in mesh.vertices){var p=r.transform.rotation*v+r.transform.position;if(first){bounds=new Bounds(p,Vector3.zero);first=false;}else bounds.Encapsulate(p);}
   }
  var core=blades.Single(r=>r.name.Contains("_blade_single_core"));core.BakeMesh(mesh);
  var verts=mesh.vertices.Select(v=>core.transform.rotation*v+core.transform.position).ToArray();
  var a=verts[0];var b=verts.OrderByDescending(v=>(v-a).sqrMagnitude).First();a=verts.OrderByDescending(v=>(v-b).sqrMagnitude).First();
  var axis=(b-a).normalized;var side=Vector3.Cross(axis,Vector3.up).normalized;if(side.sqrMagnitude<.01f)side=Vector3.right;
  var camera=new GameObject("Review camera").AddComponent<Camera>();camera.allowHDR=true;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=Color.black;camera.orthographic=true;camera.orthographicSize=bounds.size.magnitude*.6f;camera.nearClipPlane=.001f;camera.farClipPlane=bounds.size.magnitude*10;
  camera.transform.position=bounds.center+side*bounds.size.magnitude*2;camera.transform.LookAt(bounds.center,axis);
  var target=new RenderTexture(768,768,24,RenderTextureFormat.ARGBFloat);camera.targetTexture=target;camera.Render();RenderTexture.active=target;
  var image=new Texture2D(768,768,TextureFormat.RGBAFloat,false,true);image.ReadPixels(new Rect(0,0,768,768),0,0);image.Apply();
  float peak=image.GetPixels().Max(c=>Math.Max(c.r,Math.Max(c.g,c.b)));
  if(peak<=1.5f)throw new Exception("Lost HDR intensity: "+peak);
  var png=new Texture2D(768,768,TextureFormat.RGB24,false);png.SetPixels(image.GetPixels());png.Apply();File.WriteAllBytes("../saber-layout-review/unity-manual.png",png.EncodeToPNG());
  File.WriteAllText("../saber-layout-review/unity-check.json","{\"ok\":true,\"bladeMeshes\":12,\"bothGuardSides\":true,\"hdrPeak\":"+peak.ToString(System.Globalization.CultureInfo.InvariantCulture)+"}");
  Debug.Log("MANUAL_SABER_UNITY_PASS peak="+peak);
 }
}
