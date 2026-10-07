using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
public static class MaterialReviewUnity
{
 public static void Run()
 {
  AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
  var root=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Review/Atton-native.fbx"));
  if(!root)throw new Exception("Missing review FBX");
  var materials=root.GetComponentsInChildren<Renderer>().SelectMany(r=>r.sharedMaterials).Distinct().ToArray();
  foreach(var m in materials){
   if(m.shader.name!="Standard (Specular setup)"||m.GetTexture("_SpecGlossMap")||m.IsKeywordEnabled("_SPECGLOSSMAP"))throw new Exception("Unexpected specular map: "+m.name);
   if(!m.name.Contains("Eye")&&m.GetColor("_SpecColor").maxColorComponent>0)throw new Exception("Unexpected specular strength");
   var normal=(TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(m.GetTexture("_BumpMap")));
   if(normal.sRGBTexture||normal.textureType!=TextureImporterType.NormalMap)throw new Exception("Normal importer");
   if(m.name.StartsWith("chest")&&m.mainTexture.width!=1024)throw new Exception("Lost chest resolution");
   if(m.name.StartsWith("head ")&&m.GetTexture("_BumpMap").width!=2048)throw new Exception("Lost head normal resolution");
  }
  RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Flat;RenderSettings.ambientLight=new Color(.3f,.3f,.3f);
  var light=new GameObject("Key").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.2f;light.transform.rotation=Quaternion.Euler(35,-30,0);
  var rs=root.GetComponentsInChildren<Renderer>();var bounds=rs[0].bounds;foreach(var r in rs)bounds.Encapsulate(r.bounds);
  var camera=new GameObject("Camera").AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.06f,.07f,.09f);camera.nearClipPlane=.001f;camera.farClipPlane=1000;camera.fieldOfView=30;
  camera.transform.position=bounds.center+new Vector3(.12f,.08f,1.9f)*bounds.size.y;camera.transform.LookAt(bounds.center);
  var target=new RenderTexture(1000,1000,24);camera.targetTexture=target;camera.Render();RenderTexture.active=target;
  var image=new Texture2D(1000,1000,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1000,1000),0,0);image.Apply();File.WriteAllBytes("../material-review-matte/unity-native.png",image.EncodeToPNG());
  RenderTexture.active=null;camera.targetTexture=null;UnityEngine.Object.DestroyImmediate(target);UnityEngine.Object.DestroyImmediate(image);
  File.WriteAllText("../material-review-matte/unity-check.json","{\"ok\":true,\"materials\":"+materials.Length+"}");
  Debug.Log("MATERIAL_REVIEW_PASS "+materials.Length);
 }
 public static void RunSaber()
 {
  AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
  var root=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Review/Saber-native.fbx"));
  root.transform.localScale=Vector3.one*10000;
  foreach(var sk in root.GetComponentsInChildren<SkinnedMeshRenderer>())sk.updateWhenOffscreen=true;
  var renderers=root.GetComponentsInChildren<Renderer>();
  if(!renderers.SelectMany(r=>r.sharedMaterials).Any(m=>m.shader.name=="Legacy Shaders/Particles/Additive"))throw new Exception("Missing Defiant additive overlay");
  foreach(var r in renderers)r.enabled=false;
  var core=renderers.OfType<SkinnedMeshRenderer>().First(r=>r.name.Contains("_blade_fx_saber_core"));
  var glow=renderers.OfType<SkinnedMeshRenderer>().First(r=>r.name.Contains("_blade_fx_saber_glow"));
  foreach(var r in renderers)if(r.name.Contains("_blade_"))r.enabled=true;
  if(ShaderUtil.ShaderHasError(glow.sharedMaterial.shader))throw new Exception("Saber shader failed");
  var mesh=new Mesh();core.BakeMesh(mesh);var verts=mesh.vertices.Select(v=>core.transform.rotation*v+core.transform.position).ToArray();
  var a=verts[0];var b=verts.OrderByDescending(v=>(v-a).sqrMagnitude).First();a=verts.OrderByDescending(v=>(v-b).sqrMagnitude).First();
  var axis=(b-a).normalized;float length=Vector3.Distance(a,b);var center=(a+b)*.5f;
  glow.BakeMesh(mesh);var projections=mesh.vertices.Select(v=>Vector3.Dot(glow.transform.rotation*v+glow.transform.position-a,axis)).ToArray();
  if(projections.Max()-projections.Min()<length*1.01f)throw new Exception("Glow does not extend beyond core");
  var side=Vector3.Cross(axis,Vector3.up).normalized;if(side.sqrMagnitude<.01f)side=Vector3.right;
  var camera=new GameObject("Saber camera").AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.03f,.03f,.03f);camera.orthographic=true;camera.orthographicSize=length*.6f;camera.nearClipPlane=length*.001f;camera.farClipPlane=length*10;
  camera.transform.position=center+side*length*2;camera.transform.LookAt(center,axis);
  var target=new RenderTexture(768,768,24);camera.targetTexture=target;camera.Render();RenderTexture.active=target;
  var image=new Texture2D(768,768,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,768,768),0,0);image.Apply();File.WriteAllBytes("../material-review-matte/unity-saber-tip.png",image.EncodeToPNG());
  if(image.GetPixels().Count(c=>c.maxColorComponent>.5f)<100)throw new Exception("Blank saber review render");
  RenderTexture.active=null;camera.targetTexture=null;UnityEngine.Object.DestroyImmediate(target);UnityEngine.Object.DestroyImmediate(image);
  Debug.Log("SABER_REVIEW_PASS");
 }
}
