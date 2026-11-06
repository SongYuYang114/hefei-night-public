import * as THREE from 'three';
let sharedTexture;
export function createGeneratorProjection(texture){
 texture??=sharedTexture??=new THREE.TextureLoader().load('./assets/generator-projection.jpg');
 texture.colorSpace=THREE.SRGBColorSpace;
 const root=new THREE.Group();root.name='CompletedGeneratorProjection';root.visible=false;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
  uniforms:{photo:{value:texture},time:{value:0}},
  vertexShader:'varying vec2 photoUv;void main(){photoUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform sampler2D photo;uniform float time;varying vec2 photoUv;
  void main(){
   // Crop only the provided picture rectangle; phone controls never enter the projection.
   vec2 uv=vec2(40.0/874.0,332.0/1920.0)+photoUv*vec2(794.0/874.0,1083.0/1920.0);
   vec3 c=texture2D(photo,uv).rgb;
   float green=smoothstep(.06,.3,c.g-max(c.r,c.b))*smoothstep(.3,.7,c.g);
   float white=smoothstep(.91,.99,min(c.r,min(c.g,c.b)));
   float scan=.82+.18*sin(photoUv.y*240.0+time*3.0);
   float alpha=(1.0-green)*(1.0-white)*.74*scan;
   if(alpha<.025)discard;
   gl_FragColor=vec4(mix(c,vec3(.12,.72,1.0),.32),alpha);
   #include <colorspace_fragment>
  }`});
 const face=new THREE.Mesh(new THREE.PlaneGeometry(2.2,3),material);face.position.y=4.1;face.name='GeneratorPhotoHologram';root.add(face);
 const beam=new THREE.Mesh(new THREE.ConeGeometry(1.15,2.8,24,1,true),new THREE.MeshBasicMaterial({color:'#65dafa',transparent:true,opacity:.075,side:THREE.DoubleSide,depthWrite:false}));beam.rotation.z=Math.PI;beam.position.y=3;root.add(beam);
 return {root,face,material,beam};
}
export function updateGeneratorProjections(generators,camera,time,mode){
 for(const g of generators){const p=g.projection;if(!p)continue;p.root.visible=g.progress>=1&&['playing','paused'].includes(mode);if(!p.root.visible)continue;p.face.quaternion.copy(camera.quaternion);p.material.uniforms.time.value=time;p.beam.material.opacity=.065+Math.sin(time*2+g.id)*.012;}
}
