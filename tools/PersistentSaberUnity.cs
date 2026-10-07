using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
public static class PersistentSaberUnity {
 public static void Run() {
  AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
  var root=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/PersistentSabers/Review.fbx"));
  if(root==null)throw new Exception("Missing FBX");
  root.transform.localScale=Vector3.one*1000;
  var renderers=root.GetComponentsInChildren<Renderer>();
  foreach(var r in renderers){var m=r.material;if(!m.shader.isSupported||ShaderUtil.ShaderHasError(m.shader)||!m.HasProperty("_FPS"))throw new Exception("Invalid native material: "+m.name);}
  if(root.GetComponentsInChildren<MonoBehaviour>(true).Length!=0)throw new Exception("Custom runtime script found");
  foreach(var r in renderers){var uv=r.GetComponent<MeshFilter>().sharedMesh.uv;Debug.Log("FX_AUDIT "+r.name+" "+r.sharedMaterial.name+" texture="+r.sharedMaterial.mainTexture.name+" grid="+r.sharedMaterial.GetFloat("_Columns")+","+r.sharedMaterial.GetFloat("_Rows")+" frame="+r.sharedMaterial.GetFloat("_Frame")+" uv="+uv.Min(v=>v.x)+","+uv.Max(v=>v.x)+","+uv.Min(v=>v.y)+","+uv.Max(v=>v.y));}
  var bounds=renderers[0].bounds;foreach(var r in renderers)bounds.Encapsulate(r.bounds);
  var camera=new GameObject("Review camera").AddComponent<Camera>();camera.allowHDR=true;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.008f,.008f,.014f);camera.orthographic=true;camera.orthographicSize=bounds.size.magnitude*.32f;camera.nearClipPlane=.001f;camera.farClipPlane=10000;
  var size=renderers[0].bounds.size;
  var axis=size.y>size.x&&size.y>size.z?Vector3.up:size.z>size.x?Vector3.forward:Vector3.right;
  var side=Vector3.Cross(axis,Vector3.right).normalized;if(side.sqrMagnitude<.1f)side=Vector3.forward;
  camera.transform.position=bounds.center+side*bounds.size.magnitude*2;camera.transform.LookAt(bounds.center,axis);
  var target=new RenderTexture(1600,900,24,RenderTextureFormat.ARGBFloat);camera.targetTexture=target;
  Func<float,string,Color[]> capture=(time,name)=>{
   var command=new CommandBuffer();command.SetGlobalVector("_Time",new Vector4(time/20,time,time*2,time*3));camera.AddCommandBuffer(CameraEvent.BeforeForwardAlpha,command);camera.Render();camera.RemoveCommandBuffer(CameraEvent.BeforeForwardAlpha,command);command.Release();RenderTexture.active=target;
   var image=new Texture2D(1600,900,TextureFormat.RGBAFloat,false,true);image.ReadPixels(new Rect(0,0,1600,900),0,0);image.Apply();var pixels=image.GetPixels();
   var png=new Texture2D(1600,900,TextureFormat.RGB24,false);png.SetPixels(pixels);png.Apply();File.WriteAllBytes("../persistent-sabers/"+name+".png",png.EncodeToPNG());return pixels;
  };
  var a=capture(0,"unity-native-0");var b=capture(.37f,"unity-native-animated");
  int changed=a.Zip(b,(x,y)=>Math.Abs(x.r-y.r)+Math.Abs(x.g-y.g)+Math.Abs(x.b-y.b)>.01f?1:0).Sum();
  if(changed<10)throw new Exception("Animation did not change pixels: "+changed);
  foreach(var r in renderers)r.sharedMaterial.SetFloat("_FPS",0);
  var c=capture(0,"unity-native-static");var d=capture(1,"unity-native-static-later");
  int staticChanged=c.Zip(d,(x,y)=>Math.Abs(x.r-y.r)+Math.Abs(x.g-y.g)+Math.Abs(x.b-y.b)>.001f?1:0).Sum();
  if(staticChanged!=0)throw new Exception("Static FX moved");
  File.WriteAllText("../persistent-sabers/unity-check.json","{\"ok\":true,\"meshes\":"+renderers.Length+",\"animatedChangedPixels\":"+changed+",\"staticChangedPixels\":"+staticChanged+",\"runtimeScripts\":0}");
  for(int family=0;family<9;family++){foreach(var r in renderers)r.enabled=r.name.StartsWith("equipment_"+family+"_");capture(0,"unity-family-"+family);}
  // Isolate unsaturated solid cores so atlas highlights cannot hide angle loss.
  int angleChecks=0;
  for(int family=0;family<9;family++){
   foreach(var r in renderers)r.enabled=r.name.StartsWith("equipment_"+family+"_")&&r.sharedMaterial.GetFloat("_Base")>.5f;
   var core=renderers.First(r=>r.enabled);foreach(var r in renderers)if(r.enabled)r.sharedMaterial.SetFloat("_Intensity",.3f);
   camera.orthographicSize=core.bounds.size.magnitude*.65f;
   foreach(float degrees in new[]{0f,10f,45f,90f,180f}){
    float radians=degrees*Mathf.Deg2Rad;
    camera.transform.position=core.bounds.center+(side*Mathf.Sin(radians)+axis*Mathf.Cos(radians))*bounds.size.magnitude*2;
    camera.transform.LookAt(core.bounds.center,Mathf.Abs(Mathf.Sin(radians))<.001f?side:axis);
    var pixels=capture(0,"unity-angle-"+family+"-"+degrees);
    float peak=pixels.Max(p=>Mathf.Max(p.r,Mathf.Max(p.g,p.b)));
    if(peak<.25f)throw new Exception("Core lost brightness: family="+family+" angle="+degrees+" peak="+peak);
    angleChecks++;
   }
  }
  File.WriteAllText("../persistent-sabers/unity-angle-check.json","{\"ok\":true,\"unsaturatedCoreViews\":"+angleChecks+"}");
  Debug.Log("PERSISTENT_SABER_UNITY_PASS changed="+changed);
 }
}
