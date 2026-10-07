using UnityEngine;
using UnityEditor;
using System.IO;
using System.Linq;
public static class SaberCheck {
 public static void Run(){
 try {
 AssetDatabase.Refresh();
 var prefab=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SaberTest/saber_mtx06_a01_v01-blade.fbx");
 if(prefab==null)throw new System.Exception("No FBX");
 var model=Object.Instantiate(prefab);model.transform.localScale=Vector3.one*10000;foreach(var sk in model.GetComponentsInChildren<SkinnedMeshRenderer>())sk.updateWhenOffscreen=true;var rs=model.GetComponentsInChildren<Renderer>();
 foreach(var r in rs)foreach(var mat in r.sharedMaterials)if(mat.name.StartsWith("Saber ")){
 if(!mat.shader.name.StartsWith("SWTOR Viewer/Saber")||ShaderUtil.ShaderHasError(mat.shader)||!mat.shader.isSupported)throw new System.Exception("Invalid saber shader: "+mat.name+" "+mat.shader.name);
 }
 var blades=rs.Where(r=>r.name.Contains("_blade_")).ToArray();if(blades.Length!=6)throw new System.Exception("Expected main plus crossguards");
 foreach(var r in rs)r.enabled=false;
 var main=blades.Where(r=>r.name.Contains("_fx_saber_core_")||r.name.Contains("_fx_saber_glow_")).ToArray();foreach(var r in main)r.enabled=true;
 var core=(SkinnedMeshRenderer)main.First(r=>r.name.Contains("_core_"));var mesh=new Mesh();core.BakeMesh(mesh);var verts=mesh.vertices.Select(v=>core.transform.rotation*v+core.transform.position).ToArray();
 Vector3 a=verts[0],b=verts.OrderByDescending(v=>(v-a).sqrMagnitude).First();a=verts.OrderByDescending(v=>(v-b).sqrMagnitude).First();var axis=(b-a).normalized;var center=(a+b)*.5f;float length=Vector3.Distance(a,b);
 var cam=new GameObject("Check camera").AddComponent<Camera>();cam.clearFlags=CameraClearFlags.SolidColor;cam.backgroundColor=new Color(.025f,.03f,.04f);cam.orthographic=true;cam.nearClipPlane=length*.001f;cam.farClipPlane=length*10;
 Debug.Log("SABER dimensions "+length+" center "+center+" bounds "+core.bounds);var side=Vector3.Cross(axis,Vector3.up).normalized;if(side.sqrMagnitude<.01f)side=Vector3.right;
 string output=Path.GetFullPath("../");
 for(int i=0;i<4;i++){
 var dir=i==3?axis:Quaternion.AngleAxis(i*90,axis)*side;cam.transform.position=center+dir*length*2;cam.transform.LookAt(center,i==3?side:axis);cam.orthographicSize=length*(i==3?.08f:.65f);
 var rt=new RenderTexture(768,768,24);cam.targetTexture=rt;cam.Render();RenderTexture.active=rt;var tex=new Texture2D(768,768,TextureFormat.RGB24,false);tex.ReadPixels(new Rect(0,0,768,768),0,0);tex.Apply();if(!tex.GetPixels().Any(c=>c.maxColorComponent>.5f))throw new System.Exception("Blank saber view "+i);File.WriteAllBytes(Path.Combine(output,"unity-saber-angle-"+i+".png"),tex.EncodeToPNG());RenderTexture.active=null;cam.targetTexture=null;Object.DestroyImmediate(rt);Object.DestroyImmediate(tex);
 }
 File.WriteAllText(Path.Combine(output,"unity-saber-check.json"),"{\"ok\":true,\"views\":4,\"bladeMeshes\":6}");EditorApplication.Exit(0);
 }catch(System.Exception e){Debug.LogException(e);EditorApplication.Exit(1);}
 }
}
