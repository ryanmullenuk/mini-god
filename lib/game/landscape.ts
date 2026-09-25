import * as THREE from 'three';
import { EXTENT, SEA, FIRST_DRY_LAYER, VOLCANO, WATERFALL, desertWeight, vegetationBiome, type Terrain } from './terrain';
import type { WorldState } from './world-state';

/** Instanced scenery: grassland groves, upland pines and palms on sandy shores.
 * Decorative planting gives way to settlements; resource trees retain their economy.
 */
export class Landscape {
  readonly group=new THREE.Group();
  private dummy=new THREE.Object3D();
  private wind={value:0};
  private daylightTint={value:new THREE.Color(1,1,1)};
  private dirty=true;
  private key='';
  private trunks:THREE.InstancedMesh;
  private crowns:THREE.InstancedMesh;
  private pines:THREE.InstancedMesh;
  private bushes:THREE.InstancedMesh;
  private palms:THREE.InstancedMesh;
  private rocks:THREE.InstancedMesh;
  private flowers:THREE.InstancedMesh;
  private seaRocks:THREE.InstancedMesh;
  private rockFoam:THREE.InstancedMesh;
  private landmarks=new THREE.Group();
  constructor(private terrain:Terrain){
    const batch=(name:string,geometry:THREE.BufferGeometry,color:string,count:number,sway=0)=>{
      const material=new THREE.MeshLambertMaterial({color,flatShading:false});
      if(sway){
        material.onBeforeCompile=shader=>{
          shader.uniforms.landWind=this.wind;
          shader.vertexShader='uniform float landWind;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
            #ifdef USE_INSTANCING
              float phase = landWind * 1.3 + instanceMatrix[3].x * 0.19 + instanceMatrix[3].z * 0.23;
              float bend = (sin(phase) + sin(phase * 0.61) * 0.4) * ${sway.toFixed(3)};
              transformed.x += bend * max(0.0, position.y + 0.55);
              transformed.z += bend * 0.4 * max(0.0, position.y + 0.55);
            #endif`);
        };
        material.customProgramCacheKey=()=>`land-wind-${sway}`;
      }
      const m=new THREE.InstancedMesh(geometry,material,count);
      m.name=name;m.count=0;m.castShadow=name!=='Flowers';m.receiveShadow=true;m.frustumCulled=false;this.group.add(m);return m;
    };
    this.trunks=batch('Tree trunks',new THREE.CylinderGeometry(.09,.16,1.3,5),'#ffffff',8500);
    this.crowns=batch('Leafy groves',new THREE.IcosahedronGeometry(1,1),'#ffffff',10000,.055);
    this.pines=batch('Upland pines',new THREE.ConeGeometry(.75,2.6,12),'#ffffff',5000,.035);
    this.bushes=batch('Bushes',new THREE.IcosahedronGeometry(1,1),'#ffffff',2200,.075);
    // A folded, tapered frond. Six radial instances form an open palm canopy.
    const leaf=new THREE.BufferGeometry();
    leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, .75,.20,-.25, .8,.31,0, 0,0,0,.8,.31,0,.75,.20,.25, .75,.20,-.25,1.9,-.35,0,.8,.31,0, .8,.31,0,1.9,-.35,0,.75,.20,.25],3));leaf.computeVertexNormals();
    this.palms=batch('Beach palm fronds',leaf,'#ffffff',6500,.08);
    (this.palms.material as THREE.MeshLambertMaterial).side=THREE.DoubleSide;
    this.rocks=batch('Upland rocks',new THREE.IcosahedronGeometry(.6,1),'#a69f87',40000);
    this.flowers=batch('Flowers',new THREE.IcosahedronGeometry(.09,0),'#ffffff',2200,.10);
    this.seaRocks=batch('Shoreline boulders',new THREE.IcosahedronGeometry(1,1),'#ffffff',1000);
    const foamGeometry=new THREE.RingGeometry(.76,1.7,24,3);foamGeometry.rotateX(-Math.PI/2);
    const foamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:this.wind,daylightTint:this.daylightTint},
      vertexShader:`uniform float time; varying vec2 local; varying float phase;
        void main(){
          local=position.xz;
          phase=time*.825+instanceMatrix[3].x*.4+instanceMatrix[3].z*.3;
          float impact=pow(max(0.0,sin(phase)),7.0);
          float windward=.45+.55*max(0.0,dot(normalize(local),normalize(vec2(-.6,.4))));
          vec3 lifted=position;
          lifted.y+=impact*.48*(1.0-smoothstep(.8,1.3,length(local)))*windward;
          vec4 p=instanceMatrix*vec4(lifted,1.0);
          gl_Position=projectionMatrix*modelViewMatrix*p;
        }`,
      fragmentShader:`uniform vec3 daylightTint;varying vec2 local;varying float phase;
        void main(){
          float r=length(local),angle=atan(local.y,local.x);
          float cycle=fract(phase/6.283185);
          float front=.84+cycle*.75;
          float pulse=1.0-smoothstep(.07,.23,abs(r-front));
          float impact=pow(max(0.0,sin(phase)),5.0);
          float collar=1.0-smoothstep(.85,1.2,r);
          float broken=.55+.45*sin(angle*5.0+phase)*sin(angle*5.0+phase);
          float fade=(1.0-smoothstep(1.4,1.7,r))*smoothstep(.76,.82,r);
          float quietSet=smoothstep(.0,.5,sin(phase*.23+local.x));
          float alpha=clamp((pulse*.72+collar*(.35+impact*.65))*broken*fade*quietSet,0.0,.92);
          gl_FragColor=vec4(vec3(.88,.97,.91)*daylightTint,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    this.rockFoam=new THREE.InstancedMesh(foamGeometry,foamMaterial,1000);this.rockFoam.name='Boulder foam';this.rockFoam.count=0;this.rockFoam.frustumCulled=false;this.rockFoam.renderOrder=3;this.group.add(this.rockFoam);
    this.makeLandmarks();
  }
  private makeLandmarks(){
    this.landmarks.name='Volcano and waterfall';
    const lava=new THREE.MeshBasicMaterial({color:'#ff5a1f',toneMapped:false}),dark=new THREE.MeshLambertMaterial({color:'#3d3937',flatShading:false});
    const crater=new THREE.Mesh(new THREE.TorusGeometry(2.1,.48,7,18),dark);crater.rotation.x=-Math.PI/2;
    crater.position.set(VOLCANO.x,this.terrain.height(VOLCANO.x,VOLCANO.z)+.10,VOLCANO.z);crater.castShadow=true;this.landmarks.add(crater);
    const glow=new THREE.Mesh(new THREE.CircleGeometry(1.72,24),lava);glow.rotation.x=-Math.PI/2;glow.position.set(VOLCANO.x,crater.position.y+.08,VOLCANO.z);glow.renderOrder=2;this.landmarks.add(glow);
    for(let i=0;i<5;i++){const smoke=new THREE.Mesh(new THREE.IcosahedronGeometry(.55+i*.16,1),new THREE.MeshLambertMaterial({color:i<2?'#625b55':'#aaa9a1',transparent:true,opacity:.45-i*.045,depthWrite:false}));smoke.position.set(VOLCANO.x+Math.sin(i*2.1)*.6,crater.position.y+1.2+i*.82,VOLCANO.z+Math.cos(i*1.7)*.5);this.landmarks.add(smoke);}
    const top=this.terrain.height(WATERFALL.x,WATERFALL.sourceZ),bottom=Math.max(SEA+.12,this.terrain.height(WATERFALL.x,1)),height=Math.max(1.5,top-bottom);
    const cascade=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:true,uniforms:{time:this.wind,daylightTint:this.daylightTint},
      vertexShader:`uniform float time;varying vec2 fallUv;varying float edge;
        void main(){fallUv=uv;edge=sin(uv.y*19.0+uv.x*8.0+time*3.2)*.035;vec3 p=position;p.z+=edge*(.25+uv.y*.75);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader:`uniform float time;uniform vec3 daylightTint;varying vec2 fallUv;varying float edge;
        void main(){
          vec2 cell=floor(fallUv*vec2(34.0,72.0));
          float broken=.5+.5*sin(cell.x*12.71+cell.y*3.17);
          float ribbon=.5+.5*sin(fallUv.x*31.0+sin(fallUv.x*8.0)*2.0-time*.8);
          float rush=.5+.5*sin(fallUv.y*92.0-time*11.0+fallUv.x*17.0);
          float fast=.5+.5*sin(fallUv.y*173.0-time*18.0-cell.x*.37);
          float sides=smoothstep(0.0,.13,fallUv.x)*smoothstep(0.0,.13,1.0-fallUv.x);
          float foam=smoothstep(.55,.96,rush*.58+fast*.34+ribbon*.28+broken*.12);
          vec3 colour=mix(vec3(.08,.57,.69),vec3(.88,1.0,.98),foam)*daylightTint;
          float alpha=(.52+foam*.43)*sides*(.88+.12*edge);
          gl_FragColor=vec4(colour,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    const sheet=new THREE.Mesh(new THREE.PlaneGeometry(WATERFALL.width,height,24,48),cascade);sheet.name='Animated waterfall';sheet.position.set(WATERFALL.x,bottom+height/2,-2.75);sheet.rotation.y=Math.PI;sheet.renderOrder=3;this.landmarks.add(sheet);
    const veil=new THREE.Mesh(new THREE.PlaneGeometry(WATERFALL.width*.82,height*.96,18,42),cascade);veil.position.set(WATERFALL.x+.08,bottom+height*.48,-2.69);veil.rotation.y=Math.PI;veil.renderOrder=4;this.landmarks.add(veil);
    const streamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:this.wind,daylightTint:this.daylightTint},vertexShader:'varying vec2 waterUv;void main(){waterUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform float time;uniform vec3 daylightTint;varying vec2 waterUv;
      void main(){
        float current=.5+.5*sin(waterUv.y*58.0-time*7.0+sin(waterUv.x*19.0)*2.0);
        float glint=smoothstep(.72,.96,current)*(.35+.65*sin(waterUv.x*38.0)*sin(waterUv.x*38.0));
        vec3 c=mix(vec3(.08,.58,.68),vec3(.82,1.0,.96),glint)*daylightTint;
        gl_FragColor=vec4(c,.58+glint*.28);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    const stream=new THREE.Mesh(new THREE.PlaneGeometry(WATERFALL.width*.7,6,12,36),streamMaterial);stream.name='Animated waterfall stream';stream.rotation.x=-Math.PI/2;stream.position.set(WATERFALL.x,top+.08,-6);stream.renderOrder=3;this.landmarks.add(stream);
    const mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:this.wind},vertexShader:'varying vec2 mistUv;void main(){mistUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform float time;varying vec2 mistUv;void main(){vec2 p=mistUv-.5;float r=length(p);float pulse=.72+.28*sin(time*3.0-r*18.0);float a=(1.0-smoothstep(.12,.5,r))*smoothstep(.02,.15,r)*pulse;gl_FragColor=vec4(.9,1.0,1.0,a*.48);}' });
    const mist=new THREE.Mesh(new THREE.CircleGeometry(3.2,48),mistMaterial);mist.name='Waterfall spray';mist.rotation.x=-Math.PI/2;mist.position.set(WATERFALL.x,bottom+.12,-2.4);mist.renderOrder=5;this.landmarks.add(mist);
    // Keep the nine top-level instanced batches stable for fast scenery updates.
    this.rocks.add(this.landmarks);
  }
  setLighting(tint:THREE.Color){this.daylightTint.value.copy(tint);}
  terrainChanged(){this.dirty=true;}
  update(state:WorldState,time=0){
    this.wind.value=time;
    const key=`${state.camp?.x},${state.camp?.z}:${state.plots.map(p=>`${p.id}:${p.valid}`).join(',')}:${state.orders.map(p=>p.id).join(',')}:${state.resources.length}:${state.foodSystem.fishing.map(a=>a.id).join(',')}`;
    if(!this.dirty&&this.key===key)return;
    this.key=key;this.dirty=false;
    for(const mesh of this.group.children)if(mesh instanceof THREE.InstancedMesh)mesh.count=0;
    let seed=41287;
    const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
    const colour=new THREE.Color();
    const put=(mesh:THREE.InstancedMesh,x:number,y:number,z:number,sx:number,sy:number,sz:number,tint?:string,rotation=random()*Math.PI*2)=>{
      if(mesh.count>=mesh.instanceMatrix.count)return;
      this.dummy.position.set(x,y,z);this.dummy.rotation.set(0,rotation,0);this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count,this.dummy.matrix);
      if(tint)mesh.setColorAt(mesh.count,colour.set(tint));mesh.count++;
    };
    const branch=(x:number,y:number,z:number,dx:number,dy:number,dz:number,width:number,tint:string)=>{
      if(this.trunks.count>=this.trunks.instanceMatrix.count)return;
      this.dummy.position.set(x+dx*.5,y+dy*.5,z+dz*.5);
      const direction=new THREE.Vector3(dx,dy,dz);
      this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
      this.dummy.scale.set(width,direction.length()/1.3,width);this.dummy.updateMatrix();
      this.trunks.setMatrixAt(this.trunks.count,this.dummy.matrix);this.trunks.setColorAt(this.trunks.count++,colour.set(tint));
    };
    const plots=[...state.plots,...state.orders];
    for(let i=0;i<40000;i++){
      seed=(Math.imul(i+1,747796405)^41287)>>>0;
      const x=(random()-.5)*EXTENT*.98,z=(random()-.5)*EXTENT*.98,l=this.terrain.level(x,z),y=this.terrain.height(x,z),r=random();
      if(l<FIRST_DRY_LAYER||plots.some(p=>Math.abs(p.x-x)<3&&Math.abs(p.z-z)<3)||state.resources.some(p=>Math.hypot(x-p.x,z-p.z)<1.9))continue;
      // The broad starting clearing remains available for a first village.
      if(state.camp&&Math.hypot(x-state.camp.x,z-state.camp.z)<11.5)continue;
      if(l>=17&&r<.65){
        // Faceted outcrops use the existing rock batch, rooted below the surface.
        // High summits get a few elongated crags rather than extra mesh objects.
        const crag=l>=23?1+(l-22)*.6:1;
        put(this.rocks,x,y+.15,z,(.6+r)*Math.sqrt(crag),(r+.6)*crag*1.8,(.7+r)*Math.sqrt(crag));continue;
      }
      // Plant roots on a whole terrace, never floating across a sculpted edge.
      if([[.65,0],[-.65,0],[0,.65],[0,-.65]].some(([dx,dz])=>this.terrain.level(x+dx,z+dz)!==l))continue;
      const grove=Math.sin(x*.14)+Math.cos(z*.19)+Math.sin((x+z)*.08);
      const biome=vegetationBiome(x,z);
      const sand=l<9||desertWeight(x,z)>.65||(biome==='palm'&&l<13);
      const tropicalPalm=l>=8&&l<16&&biome!=='pine'&&biome!=='birch'&&((l<13&&r<.52&&grove>-.65)||(grove>.55&&r<.28));
      if(tropicalPalm){
        const s=.78+random()*.62,angle=random()*Math.PI*2;
        put(this.trunks,x,y+1.18*s,z,.72*s,1.82*s,.72*s,'#9b7044');
        for(let n=0;n<6;n++)put(this.palms,x,y+2.32*s,z,s,s,s,n%2?'#4e7d2e':'#76a03c',angle+n*Math.PI/3);
        if(r<.13)for(let n=0;n<3;n++){const a=angle+n*2.1;put(this.flowers,x+Math.sin(a)*.65,y+.10,z+Math.cos(a)*.65,1.8,1.4,1.8,n===0?'#e36f4f':'#f0a251');}
        continue;
      }
      if(sand||l<13&&r<.08&&grove>.5){
        if(l>=7&&(l<=12||biome==='palm')&&r<.32&&grove>-.5){
          const s=.9+random()*.5,angle=random()*Math.PI*2;
          put(this.trunks,x,y+1.12*s,z,.8*s,1.72*s,.8*s,'#957447');
          for(let n=0;n<6;n++)put(this.palms,x,y+2.2*s,z,s,s,s,n%2?'#477a34':'#679348',angle+n*Math.PI/3);
        }else if(l>=7&&r<.15){put(this.bushes,x,y+.22,z,.45,.28,.4,'#8f9963');}
        continue;
      }
      if(grove>-.35&&r<.83&&l<17){
        const s=.85+random()*.75;
        const bark=biome==='birch'?'#e1dcca':'#806044';
        put(this.trunks,x,y+.75*s,z,s,1.15*s,s,bark);
        if(biome==='pine'&&l>=15){
          for(let tier=0;tier<4;tier++){const spread=1-tier*.19;put(this.pines,x,y+(1.45+tier*.55)*s,z,spread*s,.65*s,spread*s,tier%2?'#528455':'#3f704e');}
        }else if(biome==='acacia'){
          for(const dx of [-.7,.65]){
            branch(x,y+1.0*s,z,dx*s,1.05*s,.13*s,.55*s,bark);
            put(this.crowns,x+dx*s,y+2.1*s,z+.13*s,1.15*s,.4*s,.85*s,'#638344');
          }
        }else{
          const tint=biome==='birch'?(r<.35?'#9eb75a':'#789b45'):biome==='autumn'?(r<.35?'#d4933c':'#ad682f'):biome==='blossom'?(r<.35?'#d87ca5':'#b95888'):['#496f32','#5c813a','#739548'][Math.floor(random()*3)];
          // Narrow cypress silhouettes punctuate the meadow groves.
          if(!biome&&r<.09){put(this.crowns,x,y+2.25*s,z,.42*s,1.5*s,.42*s,'#536f3d');}
          else{
            branch(x,y+.8*s,z,.55*s,.9*s,.18*s,.5*s,bark);
            branch(x,y+1.0*s,z,-.45*s,1.0*s,-.18*s,.42*s,bark);
            put(this.crowns,x,y+2.05*s,z,.85*s,1.05*s,.8*s,tint);
            put(this.crowns,x+.55*s,y+1.7*s,z+.18*s,.7*s,.75*s,.72*s,tint);
            put(this.crowns,x-.45*s,y+1.95*s,z-.18*s,.65*s,.7*s,.65*s,tint);
            if(biome==='mango'||!biome&&r>.53)for(let f=0;f<5;f++){
              const angle=f*Math.PI*.4;
              put(this.flowers,x+Math.cos(angle)*.78*s,y+1.85*s+Math.sin(angle)*.3*s,z+Math.sin(angle)*.78*s,2.1,2.1,2.1,'#e8a03e');
            }
          }
        }
      }else if(grove>.15&&r<.46&&l<16){
        const s=.35+random()*.38,tint=['#607c46','#779257','#536f3d'][Math.floor(random()*3)];
        put(this.bushes,x,y+s*.55,z,s,s*.65,s*.8,tint);
        put(this.bushes,x+.3,y+s*.35,z+.15,s*.65,s*.42,s*.62,tint);
      }else if(r<.48&&l<16){
        const clusterSeed=seed;
      for(let n=0;n<3;n++){
        seed=(clusterSeed^Math.imul(n+1,83492791))>>>0;const fx=x+random()*.5,fz=z+random()*.5;if(this.terrain.level(fx,fz)===l)put(this.flowers,fx,this.terrain.height(fx,fz)+.08,fz,1.35,1,1.35,n===0?'#f3e9c5':n===1?'#e87858':'#efb052');}
      }
    }
    // Clusters sit entirely in water; they never occupy a walkable beach or
    // causeway. Raising a crossing removes its rocks on the next terrain update.
    for(let z=-108;z<=108;z+=5.2)for(let x=-108;x<=108;x+=5.2){
      seed=(Math.imul(Math.round((x+108)/5.2)+1,73856093)^Math.imul(Math.round((z+108)/5.2)+1,19349663)^81727)>>>0;
      if(random()>.34)continue;
      const px=x+(random()-.5)*2.5,pz=z+(random()-.5)*2.5,l=this.terrain.level(px,pz);
      if(l<2||l>=FIRST_DRY_LAYER||state.foodSystem.fishing.some(a=>Math.hypot(px-a.water.x,pz-a.water.z)<7))continue;
      if(!Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return this.terrain.level(px+Math.cos(a)*6,pz+Math.sin(a)*6)>=FIRST_DRY_LAYER;}).some(Boolean))continue;
      const clusterSeed=seed;
      for(let n=0;n<3;n++){
        seed=(clusterSeed^Math.imul(n+1,83492791))>>>0;
        const rx=px+(random()-.5)*2.8,rz=pz+(random()-.5)*2.8,size=n===0?.9+random()*.7:.35+random()*.55;
        const bed=this.terrain.height(rx,rz);
        if(bed>=SEA||bed<-.85)continue;
        if(Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return this.terrain.level(rx+Math.cos(a)*size*1.35,rz+Math.sin(a)*size*1.35)>=FIRST_DRY_LAYER;}).some(Boolean))continue;
        const sy=(SEA-bed)*.6+size*.9;
        put(this.seaRocks,rx,bed+sy*.6,rz,size,sy,size*.85,n===0?'#8f827b':'#a99b91');
        put(this.rockFoam,rx,SEA+.055,rz,size,1,size*.85);
      }
    }
    for(const mesh of this.group.children)if(mesh instanceof THREE.InstancedMesh){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
  dispose(){
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    this.group.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
    geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());this.group.clear();
  }
}
