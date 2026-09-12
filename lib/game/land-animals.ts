import {FOOD_BALANCE as B} from './food-balance';
import * as THREE from 'three';
import { Navigation } from './navigation';
import { EXTENT, type Terrain } from './terrain';
import type { Point, WildAnimal } from './world-state';

type Animal = Point & {kind:'pig'|'chicken';root:THREE.Group;body:THREE.Group;head:THREE.Group;legs:THREE.Group[];goal:Point|null;idle:number;phase:number;heading:number;visible:boolean};

/** Ambient fauna, like the existing fish and birds: no food or livestock claims. */
export class LandAnimals {
  readonly group=new THREE.Group();
  readonly animals:Animal[]=[];
  private readonly nav:Navigation;
  private seed=68129;
  private materials=new Map<string,THREE.MeshLambertMaterial>();
  constructor(private terrain:Terrain,blocked:(x:number,z:number)=>boolean=()=>false){
    this.nav=new Navigation(terrain,blocked);
    for(let i=0;i<18;i++){
      const kind=i<6?'pig':'chicken',rig=this.make(kind,i);
      const animal:Animal={...rig,kind,x:(this.random()-.5)*EXTENT*.6,z:(this.random()-.5)*EXTENT*.4,goal:null,idle:this.random()*3,phase:this.random()*6,heading:this.random()*Math.PI*2,visible:false};
      this.animals.push(animal);this.group.add(rig.root);this.recover(animal,true);
    }
  }
  private random(){let n=this.seed;n^=n<<13;n^=n>>>17;n^=n<<5;this.seed=n>>>0;return this.seed/4294967296;}
  private mesh(root:THREE.Object3D,geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number){
    let material=this.materials.get(color);if(!material){material=new THREE.MeshLambertMaterial({color,flatShading:true});this.materials.set(color,material);}
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;root.add(m);return m;
  }
  private make(kind:'pig'|'chicken',i:number){
    const root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group(),legs:THREE.Group[]=[];root.name=`roaming-${kind}`;root.add(body);body.add(head);
    if(kind==='pig'){
      const pink=i%2?'#d39783':'#e7b49c';
      const trunk=this.mesh(body,new THREE.IcosahedronGeometry(.27,1),pink,0,.29,0);trunk.scale.set(.8,.8,1.35);
      head.position.set(0,.29,.28);this.mesh(head,new THREE.IcosahedronGeometry(.17,1),pink,0,0,0);
      const snout=this.mesh(head,new THREE.CylinderGeometry(.085,.09,.085,8),'#c98579',0,-.015,.15);snout.rotation.x=Math.PI/2;
      for(const x of [-.075,.075]){
        const ear=this.mesh(head,new THREE.ConeGeometry(.065,.14,3),pink,x,.15,-.015);ear.rotation.z=-x*3;
        this.mesh(head,new THREE.IcosahedronGeometry(.018,0),'#403931',x,.025,.115);
      }
      for(const x of [-.14,.14])for(const z of [-.19,.18]){const leg=new THREE.Group();leg.position.set(x,.23,z);body.add(leg);this.mesh(leg,new THREE.CylinderGeometry(.04,.035,.20,5),pink,0,-.10,0);this.mesh(leg,new THREE.BoxGeometry(.075,.045,.08),'#765c4e',0,-.20,.01);legs.push(leg);}
      const tail=this.mesh(body,new THREE.TorusGeometry(.05,.013,4,9,Math.PI*1.7),pink,0,.32,-.36);tail.rotation.y=Math.PI/2;
    }else{
      const feather=i%3?'#e9e2c8':'#b28756';
      const trunk=this.mesh(body,new THREE.IcosahedronGeometry(.14,1),feather,0,.21,0);trunk.scale.set(.8,1,1.25);
      for(const x of [-.12,.12]){const wing=this.mesh(body,new THREE.IcosahedronGeometry(.085,0),feather,x,.22,-.02);wing.scale.set(.3,1,1.5);}
      head.position.set(0,.32,.13);this.mesh(head,new THREE.IcosahedronGeometry(.075,1),feather,0,0,0);
      const beak=this.mesh(head,new THREE.ConeGeometry(.03,.07,4),'#d6a13b',0,-.01,.08);beak.rotation.x=Math.PI/2;
      for(const x of [-.055,.055])this.mesh(head,new THREE.IcosahedronGeometry(.012,0),'#36372c',x,.01,.04);
      for(let k=0;k<3;k++)this.mesh(head,new THREE.IcosahedronGeometry(.025,0),'#bb5e48',0,.07,-.035+k*.03);
      const tail=this.mesh(body,new THREE.ConeGeometry(.07,.19,4),feather,0,.30,-.16);tail.rotation.x=-.5;
      for(const x of [-.05,.05]){const leg=new THREE.Group();leg.position.set(x,.12,0);body.add(leg);this.mesh(leg,new THREE.CylinderGeometry(.014,.012,.10,4),'#bd943e',0,-.05,0);this.mesh(leg,new THREE.BoxGeometry(.045,.014,.07),'#bd943e',0,-.10,.018);legs.push(leg);}
    }
    root.scale.setScalar(B.visuals[kind]);return {root,body,head,legs};
  }
  private place(a:Animal,p:Point){a.x=p.x;a.z=p.z;a.visible=true;a.root.visible=true;a.root.position.set(p.x,this.terrain.height(p.x,p.z),p.z);a.goal=null;a.idle=1+this.random()*3;}
  private recover(a:Animal,initial=false){
    if(this.nav.safe(a.x,a.z)){this.place(a,a);return;}
    const nearby=this.nav.nearest(a,initial?12:3);
    if(nearby){this.place(a,nearby);return;}
    // Spawn broadly at first. During sculpting, hide displaced fauna until safe
    // ground returns rather than transporting it across the entire island.
    if(initial)for(let i=0;i<240;i++){const p={x:(this.random()-.5)*EXTENT*.72,z:(this.random()-.5)*EXTENT*.6};if(this.nav.safe(p.x,p.z)){this.place(a,p);return;}}
    a.visible=false;a.root.visible=false;a.goal=null;a.idle=2;
  }
  terrainChanged(){this.nav.invalidate();for(const a of this.animals)this.recover(a);}
  private chooseGoal(a:Animal){
    for(let i=0;i<18;i++){
      const angle=this.random()*Math.PI*2,r=.6+this.random()*(a.kind==='pig'?3:2),p={x:a.x+Math.sin(angle)*r,z:a.z+Math.cos(angle)*r};
      if(this.nav.segment(a,p)){a.goal=p;return;}
    }
    a.idle=1+this.random()*3;
  }
  update(seconds:number,paused=false){
    if(paused||!Number.isFinite(seconds)||seconds<=0)return;
    const dt=Math.min(seconds,.1);
    for(const a of this.animals){
      a.idle-=dt;
      if(!a.visible){if(a.idle<=0)this.recover(a);continue;}
      if(!this.nav.safe(a.x,a.z)){this.recover(a);continue;}
      if(!a.goal&&a.idle<=0)this.chooseGoal(a);
      let moving=false;
      if(a.goal){
        const dx=a.goal.x-a.x,dz=a.goal.z-a.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*(a.kind==='pig'?.38:.48));
        if(d<.04){a.goal=null;a.idle=.8+this.random()*3;}
        else{
          const desired=Math.atan2(dx,dz),turn=THREE.MathUtils.euclideanModulo(desired-a.heading+Math.PI,Math.PI*2)-Math.PI;
          a.heading+=THREE.MathUtils.clamp(turn,-dt*3,dt*3);
          if(Math.abs(turn)<.35){
            const next={x:a.x+dx/d*step,z:a.z+dz/d*step};
            if(this.nav.segment(a,next)){a.x=next.x;a.z=next.z;moving=true;}else{a.goal=null;a.idle=.5;}
          }
        }
      }
      a.phase+=dt*(moving?8:2.5);
      a.root.position.set(a.x,THREE.MathUtils.damp(a.root.position.y,this.terrain.height(a.x,a.z),16,dt),a.z);a.root.rotation.y=a.heading;
      a.body.position.y=moving?Math.abs(Math.sin(a.phase))*.012:0;
      a.head.rotation.x=moving?0:(a.kind==='chicken'?.65:.2)*Math.max(0,Math.sin(a.phase));
      a.legs.forEach((leg,i)=>{leg.rotation.x=moving?Math.sin(a.phase+(a.kind==='pig'?(i===0||i===3?0:Math.PI):i*Math.PI))*.38:0;});
    }
  }
  sync(population:readonly WildAnimal[],seconds:number,paused:boolean){
    for(let i=0;i<this.animals.length;i++){
      const rig=this.animals[i],a=population.filter(a=>a.species===rig.kind)[i<6?i:i-6];rig.root.visible=!!a?.alive&&this.nav.safe(a.x,a.z);if(!a||!rig.root.visible)continue;
      const moving=Math.hypot(a.x-rig.x,a.z-rig.z)>.0001;
      rig.x=a.x;rig.z=a.z;rig.root.position.set(a.x,this.terrain.height(a.x,a.z),a.z);rig.root.rotation.y=a.heading;rig.root.scale.setScalar(B.visuals[a.species]*(a.age===undefined?1:.5+.5*Math.min(1,a.age/B.herd.pigMaturity)));
      if(paused)continue;rig.phase+=seconds*(moving?8:2.5);
      rig.body.position.y=moving?Math.abs(Math.sin(rig.phase))*.012:0;
      rig.head.rotation.x=moving?0:(a.species==='chicken'?.65:.2)*Math.max(0,Math.sin(rig.phase));
      rig.legs.forEach((leg,k)=>{leg.rotation.x=moving?Math.sin(rig.phase+k*Math.PI)*.38:0;});
    }
  }
  dispose(){
    this.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.materials.clear();this.group.clear();this.animals.length=0;
  }
}
