import * as THREE from 'three';

export function saberFXMaterial(source,record){
 const fx=record.saberFX,dimensions=record.textureDimensions.base;
 return new THREE.ShaderMaterial({name:source.name,transparent:true,depthWrite:false,side:fx.base?THREE.FrontSide:THREE.DoubleSide,
  blending:fx.blend==='additive'?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false,
  uniforms:{baseColor:{value:new THREE.Color(fx.baseColor??'#ffffff')},base:{value:fx.base?1:0},tau:{value:fx.tau?1:0},map:{value:source.map},clock:{value:0},grid:{value:new THREE.Vector2(fx.columns,fx.rows)},frame:{value:fx.frame},fps:{value:fx.animated?fx.fps:0},direction:{value:fx.direction},intensity:{value:fx.intensity},texel:{value:new THREE.Vector2(1/dimensions[0],1/dimensions[1])}},
  vertexShader:`
  #include <common>
  #include <skinning_pars_vertex>
  varying vec2 vUV;varying vec3 vN;varying vec3 vV;
  void main(){
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vUV=uv;vN=transformedNormal;vV=-mvPosition.xyz;
  }`,
  fragmentShader:`
  uniform vec3 baseColor;uniform float base;uniform float tau;uniform sampler2D map;uniform float clock;uniform vec2 grid;uniform float frame;uniform float fps;uniform float direction;uniform float intensity;uniform vec2 texel;
  varying vec2 vUV;varying vec3 vN;varying vec3 vV;
  void main(){
   float count=grid.x*grid.y;
   float current=mod(mod(frame+floor(clock*fps)*direction,count)+count,count);
   vec2 initial=vec2(mod(frame,grid.x),floor(frame/grid.x))/grid;
   vec2 offset=vec2(mod(current,grid.x),floor(current/grid.x))/grid;
   vec2 local=vUV-initial;
   vec2 coord=clamp(local,texel*.5,1./grid-texel*.5)+offset;
   vec4 color=texture2D(map,coord);
   if(base>.5){
    float ramp=pow(clamp((1.-local.y*grid.y-.35)/.55,0.,1.),1.5);
    color=vec4(mix(baseColor,vec3(1.),tau*ramp),1.);
   }else{
    // Six evenly spaced sheets have sum(cos(angle)^2)=3. Remove
    // longitudinal foreshortening before weighting their contributions.
    vec3 axis=normalize(dFdy(vV)*dFdx(vUV.x)-dFdx(vV)*dFdy(vUV.x)+vec3(1e-20));
    vec3 view=vV-axis*dot(vV,axis);
    float facing=dot(normalize(vN),normalize(view+vec3(1e-20)));
    color.a*=facing*facing/3.;
   }
   gl_FragColor=vec4(color.rgb*intensity,color.a);
   #include <colorspace_fragment>
  }`
 });
}
