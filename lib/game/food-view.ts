import {FOOD_BALANCE as B} from './food-balance';
import * as THREE from 'three';
import {SEA,FIRST_DRY_LAYER,type Terrain} from './terrain';
import type {WorldState} from './world-state';
/** Fishing markers, count-backed fish and physical trap cages. */
export class FoodView {
 readonly group=new THREE.Group();private markers=new Map<number,THREE.Group>();
 private fish:THREE.InstancedMesh;private dummy=new THREE.Object3D();
 constructor(private terrain:Terrain){
  const shape=new THREE.IcosahedronGeometry(.17,0);shape.scale(.6,.5,1.8);
  this.fish=new THREE.InstancedMesh(shape,new THREE.MeshLambertMaterial({color:'#eeb862'}),B.fishing.capacity*B.fishing.maxAreas);this.fish.count=0;this.fish.frustumCulled=false;this.group.add(this.fish);
 }
 private box(g:THREE.Group,x:number,y:number,z:number,px:number,py:number,pz:number,color:string){const m=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),new THREE.MeshLambertMaterial({color}));m.position.set(px,py,pz);g.add(m);return m;}
 update(s:WorldState){
  const ids=new Set([...s.foodSystem.fishing,...s.foodSystem.traps].map(a=>a.id));
  for(const [id,g]of this.markers)if(!ids.has(id)){this.destroy(g);this.group.remove(g);this.markers.delete(id);}
  for(const a of [...s.foodSystem.fishing,...s.foodSystem.traps]){
   let g=this.markers.get(a.id);const trap='phase'in a;
   if(g&&g.userData.trap!==trap){this.destroy(g);this.group.remove(g);this.markers.delete(a.id);g=undefined;}
   if(!g){g=new THREE.Group();g.userData.trap=trap;this.markers.set(a.id,g);this.group.add(g);
    if(trap){
     for(const x of [-.45,.45])for(const z of [-.45,.45])this.box(g,.055,.65,.055,x,.325,z,'#92704f');
     for(const y of [.15,.4,.65]){for(const x of [-.45,.45])this.box(g,.055,.035,.95,x,y,0,'#92704f');this.box(g,.95,.035,.055,0,y,-.45,'#92704f');}
     const gate=this.box(g,.9,.6,.05,0,.3,.45,'#ac8b62');gate.name='gate';
     const pig=this.box(g,.35,.22,.5,0,.2,0,'#dfab97');pig.name='caught-pig';this.box(g,.2,.16,.15,0,.23,.3,'#cb8d83').name='pig-head';
    }else{this.box(g,.055,1.15,.055,0,.575,0,'#8c7350');this.box(g,.45,.3,.04,.2,1,0,'#63b1b1');}
   }
   g.visible=this.terrain.level(a.x,a.z)>=FIRST_DRY_LAYER;g.position.set(a.x,this.terrain.height(a.x,a.z),a.z);
   if(trap){g.getObjectByName('gate')!.rotation.x=a.phase==='caught'?0:-Math.PI/2;g.getObjectByName('caught-pig')!.visible=a.phase==='caught';g.getObjectByName('pig-head')!.visible=a.phase==='caught';g.scale.setScalar(a.phase==='planned'?.65:1);}
  }
  let count=0;
  for(const area of s.foodSystem.fishing)for(let i=0;i<area.stock;i++){
   const angle=i*2.39996+s.time*.22,r=.2+Math.sqrt(i/B.fishing.capacity)*1.3;
   let x=area.water.x+Math.cos(angle)*r,z=area.water.z+Math.sin(angle)*r;
   if(this.terrain.level(x,z)>=FIRST_DRY_LAYER){x=area.water.x;z=area.water.z;}
   if(this.terrain.level(x,z)>=FIRST_DRY_LAYER)continue;
   this.dummy.position.set(x,SEA-.18,z);this.dummy.rotation.set(0,-angle,0);this.dummy.scale.setScalar(B.visuals.fish);this.dummy.updateMatrix();this.fish.setMatrixAt(count++,this.dummy.matrix);
  }
  this.fish.count=count;this.fish.instanceMatrix.needsUpdate=true;
 }
 private destroy(g:THREE.Object3D){g.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});}
 dispose(){this.destroy(this.group);this.group.clear();this.markers.clear();}
}
