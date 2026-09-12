import * as THREE from 'three';
import { Shoreline } from './shoreline';
import { EXTENT, SEA, Terrain } from './terrain';

/** Camera fit keeps even the nearest water intersection ahead of the near plane. */
export function oceanCameraFit(halfHeight:number,pitch:number){
  const distance=Math.max(130,halfHeight/Math.tan(pitch)+180);
  return {distance,far:distance+halfHeight/Math.tan(pitch)+1200};
}
export function createOcean(terrain:Terrain){
  const shoreline=new Shoreline(terrain);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{
    time:{value:0},heightMap:{value:terrain.texture},extent:{value:EXTENT},sea:{value:SEA},
    viewDirection:{value:new THREE.Vector3(.2,.73,.65).normalize()},sunDirection:{value:new THREE.Vector3(-50,80,30).normalize()},
    sunColour:{value:new THREE.Color(1,.88,.63)},sunStrength:{value:1},daylightTint:{value:new THREE.Color(1,1,1)},edgeFogColour:{value:new THREE.Color('#83a8b9')},
    contacts:{value:Array.from({length:32},()=>new THREE.Vector3())},contactCount:{value:0},
  },vertexShader:/* glsl */`
    uniform float time;uniform float sea;uniform float extent;uniform sampler2D heightMap;
    varying vec3 world;
    void main(){
      vec4 p=modelMatrix*vec4(position,1.0);
      vec2 uv=(p.xz+extent*.5)/extent;
      float inside=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);
      float h=mix(-2.,texture2D(heightMap,clamp(uv,0.,1.)).r,inside);
      float shoreDamping=1.-smoothstep(2.4,3.5,h);
      p.y+=(sin(dot(p.xz,vec2(.055,.038))+time*.24)*.018
           +sin(dot(p.xz,vec2(-.028,.064))-time*.19)*.012)*shoreDamping;
      world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;
    }
  `,fragmentShader:/* glsl */`
    precision highp float;
    uniform float time,extent,sea,sunStrength;uniform sampler2D heightMap;
    uniform vec3 viewDirection,sunDirection,sunColour,daylightTint,edgeFogColour;
    uniform vec3 contacts[32];uniform int contactCount;
    varying vec3 world;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){
      vec2 p=world.xz,uv=(p+extent*.5)/extent;
      float inside=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);
      float h=texture2D(heightMap,clamp(uv,0.,1.)).r;
      // Same submerged terrace tops as Terrain.height: six 0.3-unit steps.
      float level=floor((h-.5)/.5);
      float bottom=level<0.?-1.935:(level<6.?-1.635+level*.3:.165+(level-6.)*.28);
      float depth=mix(6.,max(0.,sea-bottom),inside);
      vec3 colour=vec3(.30,.68,.65);
      colour=mix(colour,vec3(.065,.45,.44),smoothstep(.15,.18,depth));
      colour=mix(colour,vec3(.025,.28,.32),smoothstep(.45,.48,depth));
      colour=mix(colour,vec3(.012,.12,.17),smoothstep(.85,.89,depth));
      colour=mix(colour,vec3(.004,.020,.048),smoothstep(1.48,1.53,depth));
      float broad=noise(p*.065+vec2(time*.008,-time*.005));
      colour*=.985+.03*broad;
      // Broad painted light, not high-frequency specular or glitter.
      vec3 normal=normalize(vec3(.025*cos(p.x*.055+time*.24),1.,.025*sin(p.y*.064-time*.19)));
      vec3 halfLight=normalize(sunDirection+viewDirection);
      float glint=pow(max(0.,dot(normal,halfLight)),9.);
      float lightPower=mix(.13,.24,sunStrength);
      colour*=daylightTint;
      colour+=sunColour*glint*lightPower*(.7+.3*broad);
      // The wave wash is tied to actual submerged height, including sculpted bays.
      float breath=.65+.12*sin(time*.5+noise(p*.12)*4.);
      float foam=(1.-smoothstep(.10,.40,depth))*inside*breath;
      for(int i=0;i<32;i++){
        if(i>=contactCount)break;
        float edge=abs(length(p-contacts[i].xy)-contacts[i].z);
        foam=max(foam,(1.-smoothstep(.08,.45,edge))*breath);
      }
      foam*=.8+.2*noise(p*.75+vec2(time*.035,-time*.025));
      colour=mix(colour,vec3(.83,.95,.94)*daylightTint,clamp(foam,0.,.85));
      float alpha=mix(.62,.995,smoothstep(.1,.9,depth));
      // Irregular mist blends into the sky before any finite mesh boundary.
      float radius=length(p/vec2(1.08,.98));
      float wisps=(noise(p*.024+vec2(time*.003,-time*.002))-.5)*18.;
      float fog=smoothstep(112.,174.,radius+wisps);
      vec3 mist=mix(edgeFogColour,vec3(.77,.85,.87)*daylightTint,.16);
      colour=mix(colour,mist,fog);
      alpha*=1.-smoothstep(165.,215.,radius+wisps);
      gl_FragColor=vec4(colour,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000,128,128),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.y=SEA;mesh.renderOrder=2;
  return {mesh,shoreline,
    /** Static water-contact footprints; callers update these when structures change. */
    setWaterContacts(points:readonly {x:number;z:number;radius:number}[]){const n=Math.min(32,points.length);material.uniforms.contactCount.value=n;for(let i=0;i<n;i++)material.uniforms.contacts.value[i].set(points[i].x,points[i].z,points[i].radius);},
    setLighting(direction:THREE.Vector3,colour:THREE.Color,strength:number,tint:THREE.Color,sky?:THREE.Color){material.uniforms.sunDirection.value.copy(direction);material.uniforms.sunColour.value.copy(colour);material.uniforms.sunStrength.value=strength;material.uniforms.daylightTint.value.copy(tint);if(sky)material.uniforms.edgeFogColour.value.copy(sky);},
    update(time:number,camera?:THREE.Camera){shoreline.update();material.uniforms.time.value=time*.5;if(camera)camera.getWorldDirection(material.uniforms.viewDirection.value).negate();},
    dispose(){mesh.geometry.dispose();material.dispose();shoreline.dispose();},
  };
}
