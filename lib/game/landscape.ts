import * as THREE from 'three';
import { EXTENT, SEA, FIRST_DRY_LAYER, desertWeight, vegetationBiome, type Terrain } from './terrain';
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
  constructor(private terrain:Terrain){
    const batch=(name:string,geometry:THREE.BufferGeometry,color:string,count:number,sway=0)=>{
      const material=new THREE.MeshLambertMaterial({color,flatShading:true});
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
    this.crowns=batch('Leafy groves',new THREE.IcosahedronGeometry(1,0),'#ffffff',10000,.055);
    this.pines=batch('Upland pines',new THREE.ConeGeometry(.75,2.6,7),'#ffffff',5000,.035);
    this.bushes=batch('Bushes',new THREE.IcosahedronGeometry(1,1),'#ffffff',2200,.075);
    // A folded, tapered frond. Six radial instances form an open palm canopy.
    const leaf=new THREE.BufferGeometry();
    leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, .75,.20,-.25, .8,.31,0, 0,0,0,.8,.31,0,.75,.20,.25, .75,.20,-.25,1.9,-.35,0,.8,.31,0, .8,.31,0,1.9,-.35,0,.75,.20,.25],3));leaf.computeVertexNormals();
    this.palms=batch('Beach palm fronds',leaf,'#ffffff',6500,.08);
    (this.palms.material as THREE.MeshLambertMaterial).side=THREE.DoubleSide;
    this.rocks=batch('Upland rocks',new THREE.IcosahedronGeometry(.6,0),'#a69f87',40000);
    this.flowers=batch('Flowers',new THREE.IcosahedronGeometry(.09,0),'#ffffff',2200,.10);
    this.seaRocks=batch('Shoreline boulders',new THREE.IcosahedronGeometry(1,0),'#ffffff',1000);
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
  }
  setLighting(tint:THREE.Color){this.daylightTint.value.copy(tint);}
  terrainChanged(){this.dirty=true;}
  update(state:WorldState,time=0){
    this.wind.value=time;
    const key=`${state.camp?.x},${state.camp?.z}:${state.plots.map(p=>`${p.id}:${p.valid}`).join(',')}:${state.orders.map(p=>p.id).join(',')}:${state.resources.length}:${state.foodSystem.fishing.map(a=>a.id).join(',')}`;
    if(!this.dirty&&this.key===key)return;
    this.key=key;this.dirty=false;
    for(const mesh of this.group.children as THREE.InstancedMesh[])mesh.count=0;
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
      if(sand||l<13&&r<.08&&grove>.5){
        if(l>=7&&(l<=12||biome==='palm')&&r<.32&&grove>-.5){
          const s=.9+random()*.5,angle=random()*Math.PI*2;
          put(this.trunks,x,y+1.12*s,z,.8*s,1.72*s,.8*s,'#957447');
          for(let n=0;n<6;n++)put(this.palms,x,y+2.2*s,z,s,s,s,n%2?'#568f2d':'#9abd3f',angle+n*Math.PI/3);
        }else if(l>=7&&r<.15){put(this.bushes,x,y+.22,z,.45,.28,.4,'#b0b46e');}
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
            put(this.crowns,x+dx*s,y+2.1*s,z+.13*s,1.15*s,.4*s,.85*s,'#729a36');
          }
        }else{
          const tint=biome==='birch'?(r<.35?'#b8cf55':'#8fbd3e'):biome==='autumn'?(r<.35?'#efa638':'#c86f28'):biome==='blossom'?(r<.35?'#e67aaf':'#c84f93'):['#4e852b','#6c9e32','#8eb33d'][Math.floor(random()*3)];
          // Narrow cypress silhouettes punctuate the meadow groves.
          if(!biome&&r<.09){put(this.crowns,x,y+2.25*s,z,.42*s,1.5*s,.42*s,'#658e42');}
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
        const s=.35+random()*.38,tint=['#76934d','#92ac58','#617f42'][Math.floor(random()*3)];
        put(this.bushes,x,y+s*.55,z,s,s*.65,s*.8,tint);
        put(this.bushes,x+.3,y+s*.35,z+.15,s*.65,s*.42,s*.62,tint);
      }else if(r<.48&&l<16){
        const clusterSeed=seed;
      for(let n=0;n<3;n++){
        seed=(clusterSeed^Math.imul(n+1,83492791))>>>0;const fx=x+random()*.5,fz=z+random()*.5;if(this.terrain.level(fx,fz)===l)put(this.flowers,fx,this.terrain.height(fx,fz)+.08,fz,1,.8,1,n===0?'#eee6bb':'#dbbd70');}
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
        put(this.seaRocks,rx,bed+sy*.6,rz,size,sy,size*.85,n===0?'#8b9189':'#a1a394');
        put(this.rockFoam,rx,SEA+.055,rz,size,1,size*.85);
      }
    }
    for(const mesh of this.group.children as THREE.InstancedMesh[]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
  dispose(){for(const mesh of this.group.children as THREE.InstancedMesh[]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}this.group.clear();}
}
