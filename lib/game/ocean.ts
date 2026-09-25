import * as THREE from 'three';
import { Shoreline } from './shoreline';
import { EXTENT, SEA, Terrain } from './terrain';

/** Camera fit keeps even the nearest water intersection ahead of the near plane. */
export function oceanCameraFit(halfHeight:number,pitch:number){
  const distance=Math.max(130,halfHeight/Math.tan(pitch)+180);
  return {distance,far:distance+halfHeight/Math.tan(pitch)+1200};
}
export function createOcean(terrain:Terrain,createShoreWorker?:()=>Worker){
  const shoreline=new Shoreline(terrain,undefined,createShoreWorker);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{
    shoreMap:{value:shoreline.texture},time:{value:0},heightMap:{value:terrain.texture},extent:{value:EXTENT},sea:{value:SEA},
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
    uniform float time,extent,sea,sunStrength;uniform sampler2D heightMap,shoreMap;
    uniform vec3 viewDirection,sunDirection,sunColour,daylightTint,edgeFogColour;
    uniform vec3 contacts[32];uniform int contactCount;
    varying vec3 world;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){
      vec2 p=world.xz,uv=(p+extent*.5)/extent;
      float inside=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);
      float h=texture2D(heightMap,clamp(uv,0.,1.)).r;
      // Interpolate submerged colour depth so visible water does not form contour rings.
      float level=floor((h-.5)/.5);
      float bottom=level<6.?h*.6-2.235:.165+(level-6.)*.28;
      float depth=mix(6.,max(0.,sea-bottom),inside);
      // Submerged terraces can reach the finite simulation boundary. Round
      // that shelf into open water before its clipped, straight edge is visible.
      float margin=extent*.5-max(abs(p.x),abs(p.y));
      float shelfEnd=1.-smoothstep(1.5,11.+noise(p*.10)*5.,margin);
      depth=mix(depth,6.,shelfEnd*smoothstep(.2,.8,depth));
      // Continuous lagoon-to-cobalt colour, with a broken reef visible in shallows.
      // Reuse the height/shore maps; no animated texture uploads or new draw calls.
      float waterDepth=depth+(noise(p*.18)-.5)*.09;
      vec3 colour=vec3(.32,.84,.76);
      colour=mix(colour,vec3(.04,.68,.70),smoothstep(.12,.55,waterDepth));
      colour=mix(colour,vec3(.015,.38,.53),smoothstep(.45,1.15,waterDepth));
      colour=mix(colour,vec3(.006,.055,.20),smoothstep(1.0,2.1,waterDepth));
      // Broad, irregular abyssal bands and soft basin shadows remain visible
      // beyond the turquoise shelf. Multiple warped scales avoid contour-like
      // repetition while giving the deep ocean readable depth.
      float deepMask=smoothstep(1.15,2.8,waterDepth);
      vec2 basinWarp=vec2(noise(p*.019+11.),noise(p*.023-17.));
      float basin=noise(p*.032+basinWarp*3.8);
      float trench=noise(vec2(dot(p,vec2(.021,.012)),dot(p,vec2(-.009,.027)))+basinWarp*2.2);
      colour=mix(colour,vec3(.004,.035,.135),deepMask*smoothstep(.38,.82,basin)*.30);
      colour+=vec3(.008,.055,.075)*deepMask*(trench-.5)*.34;
      float reef=smoothstep(.58,.78,noise(p*.83+noise(p*.19)*3.));
      float reefDepth=smoothstep(.2,.55,depth)*(1.-smoothstep(1.1,1.65,depth))*inside;
      colour=mix(colour,vec3(.035,.28,.30),reef*reefDepth*.48);
      // Domain-warped swells have no shared grid or repeating crest spacing.
      vec2 drift=vec2(time*.018,-time*.011);
      vec2 warp=vec2(noise(p*.037+drift),noise(p*.043-drift+19.));
      float broad=noise(p*.13+warp*2.4+drift);
      float swell=sin(dot(p,vec2(.31,.19))+warp.x*5.+time*.31);
      // Fine crossed ripples deepen the troughs without adding a normal-map
      // texture or another reflection pass. The two different directions keep
      // the water organic while remaining stable at distant camera zooms.
      float fineWarp=(noise(p*.093+drift*2.7)-.5)*8.5+(noise(p*.217-drift*3.1)-.5)*2.8;
      float crossWarp=(noise(p*.074-drift*2.1+31.)-.5)*7.3+(noise(p*.181+drift*2.4+7.)-.5)*3.2;
      float phaseA=dot(p,vec2(1.08,.46))+time*.58+warp.x*5.2+fineWarp;
      float phaseB=dot(p,vec2(-.38,1.31))-time*.43+warp.y*4.4+crossWarp;
      float phaseC=dot(p,vec2(.61,-.27))+time*.27+broad*4.1+(fineWarp-crossWarp)*.22;
      float rippleA=sin(phaseA),rippleB=sin(phaseB),rippleC=sin(phaseC);
      float trough=(1.-rippleA)*.5*(.42+.58*(1.-rippleB)*.5);
      colour*=.94+.06*broad+.012*swell-.006*trough;
      // Analytic wave slopes make the sunlight break into the long silver
      // strokes seen on wind-ruffled ocean, rather than one smooth highlight.
      vec2 slope=vec2(1.08,.46)*cos(phaseA)*.075
        +vec2(-.38,1.31)*cos(phaseB)*.058
        +vec2(.61,-.27)*cos(phaseC)*.047;
      slope+=vec2(.055*cos(p.x*.055+warp.x*3.+time*.24),.045*sin(p.y*.064+warp.y*3.-time*.19));
      vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
      vec3 halfLight=normalize(sunDirection+viewDirection);
      float facing=max(0.,dot(normal,halfLight));
      float softReflection=pow(facing,18.);
      float sharpReflection=pow(facing,70.);
      // A wide, feathered sun road concentrates the brightest broken strokes
      // while leaving small reflections across the rest of the open water.
      vec2 sunAxis=normalize(sunDirection.xz+vec2(.0001));
      float across=dot(p,vec2(-sunAxis.y,sunAxis.x));
      float sunRoad=.18+.82*exp(-across*across/2500.);
      vec2 reflectionSpace=vec2(dot(p,vec2(.91,.41))*.20,dot(p,vec2(-.41,.91))*.72);
      float crestBreak=noise(reflectionSpace+vec2(time*.015,-time*.032)+warp*2.1);
      float crestDetail=noise(p*.18+vec2(-time*.021,time*.013)+17.);
      float ridge=smoothstep(.58,.90,crestBreak)*smoothstep(.24,.76,crestDetail);
      float glint=(softReflection*.22+sharpReflection*(.72+1.35*ridge))*sunRoad;
      float lightPower=mix(.045,.72,sunStrength);
      colour*=daylightTint;
      colour+=sunColour*glint*lightPower*(.72+.28*broad)*(.90+.10*swell);
      float silverStrokes=ridge*(.22+.78*softReflection)*sunRoad*smoothstep(.18,1.15,depth);
      colour+=sunColour*silverStrokes*sunStrength*.045*(.76+.24*broad);
      // The wave wash is tied to actual submerged height, including sculpted bays.
      float shore=texture2D(shoreMap,clamp(uv,0.,1.)).r;
      float coastVariation=noise(p*.055)*.18;
      float waveCycle=fract(time*.105+coastVariation);
      float secondCycle=fract(waveCycle+.52);
      // Breakers form offshore, travel towards land, then spread into a bright
      // crash at the beach. Both waves reuse the static shoreline distance map.
      float waveDistance=mix(12.5,.35,waveCycle);
      float secondDistance=mix(10.5,.35,secondCycle);
      float waveWidth=mix(.34,1.05,smoothstep(.55,1.,waveCycle));
      float secondWidth=mix(.30,.90,smoothstep(.55,1.,secondCycle));
      float firstCrest=1.-smoothstep(waveWidth,waveWidth+.42,abs(shore-waveDistance));
      float secondCrest=1.-smoothstep(secondWidth,secondWidth+.38,abs(shore-secondDistance));
      float firstCrash=mix(.18,.78,smoothstep(.42,.96,waveCycle));
      float secondCrash=mix(.12,.58,smoothstep(.46,.96,secondCycle));
      float breaker=(firstCrest*firstCrash+secondCrest*secondCrash)
        *(1.-smoothstep(13.,15.5,shore))*(.68+.32*broad);
      float shoreSurge=(1.-smoothstep(.05,1.15,shore))
        *(.24+.22*smoothstep(.72,1.,waveCycle));
      float breath=.46+.14*sin(time*.34+noise(p*.09)*4.);
      float foam=((1.-smoothstep(.10,.40,depth))*breath+breaker+shoreSurge)*inside;
      for(int i=0;i<32;i++){
        if(i>=contactCount)break;
        float edge=abs(length(p-contacts[i].xy)-contacts[i].z);
        foam=max(foam,(1.-smoothstep(.08,.45,edge))*breath);
      }
      foam*=.8+.2*noise(p*.75+vec2(time*.035,-time*.025));
      colour=mix(colour,vec3(.83,.95,.94)*daylightTint,clamp(foam,0.,.85));
      float alpha=mix(.90,1.,smoothstep(.1,.7,depth));
      // Irregular mist blends into the sky before any finite mesh boundary.
      float radius=length(p/vec2(1.08,.98));
      float wisps=(noise(p*.024+vec2(time*.003,-time*.002))-.5)*18.;
      // Keep all three offshore islands surrounded by water. The irregular
      // horizon begins beyond the editable square, whose seabed is hidden
      // by opaque deep water rather than a square fog mask.
      float fog=smoothstep(150.,260.,radius+wisps);
      vec3 mist=mix(edgeFogColour,vec3(.77,.85,.87)*daylightTint,.16);
      colour=mix(colour,mist,fog);
      alpha*=1.-smoothstep(245.,330.,radius+wisps);
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
