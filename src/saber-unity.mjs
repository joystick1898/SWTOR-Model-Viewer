import fs from 'node:fs/promises';
import path from 'node:path';
export async function writeSaberFXShader(folder,guid){
 const file=path.join(folder,'SWTORSaberFX.shader'),id=await guid(file);
 await fs.writeFile(file,`Shader "SWTOR Viewer/Persistent Saber ${id}" {
 Properties {
 _MainTex ("Native texture sheet", 2D) = "white" {}
 _BaseColor ("Core color", Color) = (1,1,1,1)
 _Base ("Solid core", Float) = 0
 _Cull ("Face culling", Float) = 0
 _Tau ("White tip", Float) = 0
 _Columns ("Columns", Float) = 1
 _Rows ("Rows", Float) = 1
 _Frame ("Static frame / phase", Float) = 0
 _FPS ("Frames per second (0 = static)", Float) = 0
 _Direction ("Frame direction", Float) = 1
 _Intensity ("Brightness", Float) = 1.5
 _SrcBlend ("Source blend", Float) = 5
 _DstBlend ("Destination blend", Float) = 10
 }
 SubShader {
 Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
 Pass {
 Cull [_Cull] ZTest LEqual ZWrite Off Blend [_SrcBlend] [_DstBlend]
 CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #pragma target 3.0
 #include "UnityCG.cginc"
 sampler2D _MainTex;float4 _MainTex_TexelSize;
 float4 _BaseColor;float _Base,_Tau;float _Columns,_Rows,_Frame,_FPS,_Direction,_Intensity;
 struct appdata {float4 vertex:POSITION;float3 normal:NORMAL;float2 uv:TEXCOORD0;};
 struct v2f {float4 pos:SV_POSITION;float3 world:TEXCOORD0;float3 normal:TEXCOORD1;float2 uv:TEXCOORD2;};
 v2f vert(appdata v){v2f o;o.pos=UnityObjectToClipPos(v.vertex);o.world=mul(unity_ObjectToWorld,v.vertex).xyz;o.normal=UnityObjectToWorldNormal(v.normal);o.uv=v.uv;return o;}
 float4 frag(v2f i):SV_Target {
 float2 grid=float2(_Columns,_Rows);float count=_Columns*_Rows;
 float current=fmod(fmod(_Frame+floor(_Time.y*_FPS)*_Direction,count)+count,count);
 float2 initial=float2(fmod(_Frame,_Columns),_Rows-1-floor(_Frame/_Columns))/grid;
 float2 offset=float2(fmod(current,_Columns),_Rows-1-floor(current/_Columns))/grid;
 float2 local=i.uv-initial;
 float2 uv=clamp(local,_MainTex_TexelSize.xy*.5,1/grid-_MainTex_TexelSize.xy*.5)+offset;
 float4 color=tex2D(_MainTex,uv);
 if(_Base>.5){
 float ramp=pow(saturate((local.y*_Rows-.35)/.55),1.5);
 color=float4(lerp(_BaseColor.rgb,float3(1,1,1),_Tau*ramp),1);
 }else{
 float3 axis=normalize(ddy(i.world)*ddx(i.uv.x)-ddx(i.world)*ddy(i.uv.x)+float3(1e-20,1e-20,1e-20));
 float3 view=_WorldSpaceCameraPos-i.world;view-=axis*dot(view,axis);
 float facing=dot(normalize(i.normal),normalize(view+float3(1e-20,1e-20,1e-20)));
 color.a*=facing*facing/3;
 }
 return float4(color.rgb*_Intensity,color.a);
 }
 ENDCG
 }
 }
 Fallback Off
}`);
 await fs.writeFile(file+'.meta',`fileFormatVersion: 2\nguid: ${id}\nShaderImporter:\n  externalObjects: {}\n  defaultTextures: []\n  nonModifiableTextures: []\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`);
 return id;
}
export async function writeSaberShader(folder,guid){
 const file=path.join(folder,'SWTORSaber.shader'),id=await guid(file);
 const shader=`Shader "SWTOR Viewer/Saber ${id}" {
 Properties {
 _MainTex ("Color", 2D) = "white" {}
 _Glow ("Glow shell", Float) = 0
 _Effect ("Effect", Float) = 0
 _Intensity ("Brightness", Float) = 1.5
 _SrcBlend ("Source blend", Float) = 1
 _DstBlend ("Destination blend", Float) = 0
 _ZWrite ("Depth write", Float) = 1
 }
 SubShader {
 Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
 Pass {
 Cull Back ZTest LEqual ZWrite [_ZWrite] Blend [_SrcBlend] [_DstBlend]
 CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "UnityCG.cginc"
 sampler2D _MainTex; float _Glow; float _Effect; float _Intensity;
 struct appdata { float4 vertex:POSITION; float3 normal:NORMAL; float2 uv:TEXCOORD0; };
 struct v2f { float4 pos:SV_POSITION; float3 world:TEXCOORD0; float3 normal:TEXCOORD1; float2 uv:TEXCOORD2; };
 v2f vert(appdata v) { v2f o; o.pos=UnityObjectToClipPos(v.vertex); o.world=mul(unity_ObjectToWorld,v.vertex).xyz; o.normal=UnityObjectToWorldNormal(v.normal); o.uv=v.uv; return o; }
 float4 frag(v2f i):SV_Target {
 float3 color=tex2D(_MainTex,i.uv).rgb;
 float facing=saturate(dot(normalize(i.normal),normalize(_WorldSpaceCameraPos-i.world)));
 float energy=1;
 if(_Effect>0.5 && _Effect<1.5) energy=0.65+0.35*abs(sin(i.uv.y*83+sin(i.uv.x*31+_Time.y*21)*3+_Time.y*37));
 if(_Effect>1.5) energy=0.65+0.35*sin(_Time.y*6.28318);
 float halo=pow(facing,2)*1.25;
 return float4(color*energy*lerp(1,halo,_Glow)*_Intensity,1);
 }
 ENDCG
 }
 }
 Fallback Off
}`;
 await fs.writeFile(file,shader);await fs.writeFile(file+'.meta',`fileFormatVersion: 2\nguid: ${id}\nShaderImporter:\n  externalObjects: {}\n  defaultTextures: []\n  nonModifiableTextures: []\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`);
 return id;
}
