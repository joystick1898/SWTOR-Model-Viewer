import * as THREE from 'three';
export function saberMaterial(source){
 const glow=source.name.startsWith('Saber glow'),effect=source.name.endsWith('unstable')?1:source.name.endsWith('pulsing')?2:0;
 return new THREE.ShaderMaterial({name:source.name,uniforms:{intensity:{value:source.userData?.saberIntensity??source.emissiveIntensity??1.5},map:{value:source.map},clock:{value:0},effect:{value:effect},glow:{value:glow?1:0}},transparent:glow,depthWrite:!glow,side:THREE.FrontSide,blending:glow?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false,
 vertexShader:`
 #include <common>
 #include <skinning_pars_vertex>
 varying vec3 vN; varying vec3 vV; varying vec2 vUV;
 void main(){
 #include <skinbase_vertex>
 #include <beginnormal_vertex>
 #include <skinnormal_vertex>
 #include <defaultnormal_vertex>
 #include <begin_vertex>
 #include <skinning_vertex>
 #include <project_vertex>
 vN=transformedNormal;vV=-mvPosition.xyz;vUV=uv;
 }`,fragmentShader:`
 uniform float intensity;uniform sampler2D map;uniform float clock;uniform float effect;uniform float glow;
 varying vec3 vN;varying vec3 vV;varying vec2 vUV;
 void main(){
 float energy=1.;
 if(effect>.5&&effect<1.5)energy=.65+.35*abs(sin(vUV.y*83.+sin(vUV.x*31.+clock*21.)*3.+clock*37.));
 if(effect>1.5)energy=.65+.35*sin(clock*6.28318);
 float halo=pow(max(0.,dot(normalize(vN),normalize(vV))),2.)*1.25;
 gl_FragColor=vec4(texture2D(map,vUV).rgb*energy*mix(1.,halo,glow)*intensity,1.);
 #include <colorspace_fragment>
 }`});
}
export function updateSaberTime(root,seconds){root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.uniforms?.clock)m.uniforms.clock.value=seconds;});}
