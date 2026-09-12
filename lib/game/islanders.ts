import * as THREE from 'three';
import { Navigation } from './navigation';
import { Terrain, EXTENT } from './terrain';
import type { Settler } from './world-state';
const TAU=Math.PI*2;
const mat=(c:string)=>new THREE.MeshLambertMaterial({color:c,flatShading:true});
function part(parent:THREE.Object3D,geo:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function ellipsoid(parent:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,detail=1){const o=part(parent,new THREE.IcosahedronGeometry(1,detail),m,x,y,z);o.scale.set(sx,sy,sz);return o;}
function limb(parent:THREE.Object3D,m:THREE.Material,len:number,r1:number,r2:number){return part(parent,new THREE.CylinderGeometry(r1,r2,len,6),m,0,-len/2,0);}
function makePerson(female:boolean,index:number){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const skin=mat(['#bd783d','#ce8945','#a96534','#d5934d'][index%4]),hair=mat('#24261f'),blue=mat(female?'#279abc':'#246e98'),darkBlue=mat('#20567a'),trim=mat('#65b1c8'),shell=mat('#ffedba');
 const pelvis=new THREE.Group();pelvis.position.y=.695;body.add(pelvis);
 ellipsoid(pelvis,skin,0,.23,0,female?.17:.225,.28,.115);
 const torso=new THREE.Group();torso.position.y=.18;pelvis.add(torso);
 const skirt=part(pelvis,new THREE.CylinderGeometry(.15,female?.265:.235,.35,9,1,true),blue,0,-.13,0);skirt.rotation.y=.15;
 part(pelvis,new THREE.CylinderGeometry(.174,.18,.055,9),darkBlue,0,.035,0);
 if(female){
  part(torso,new THREE.CylinderGeometry(.177,.151,.135,8),blue,0,.155,0);
  for(let i=0;i<9;i++){const a=i/9*TAU;const leaf=part(pelvis,new THREE.ConeGeometry(.062,.22,3),i%2?blue:trim,Math.sin(a)*.22,-.28,Math.cos(a)*.22);leaf.rotation.z=Math.PI;leaf.rotation.y=a;}
 }else{
  const sash=part(torso,new THREE.BoxGeometry(.078,.48,.022),blue,0,.12,.116);sash.rotation.z=-.58;
  part(pelvis,new THREE.CylinderGeometry(.229,.236,.037,9,1,true),trim,0,-.24,0);
  for(let k=-2;k<=2;k++){const n=part(torso,new THREE.ConeGeometry(.023,.055,4),shell,k*.048,.25-Math.cos(k*.48)*.045,.14);n.rotation.z=Math.PI;}
 }
 const head=new THREE.Group();head.position.y=.51;pelvis.add(head);
 limb(head,skin,.10,.05,.055);
 ellipsoid(head,skin,0,.06,0,.12,.16,.105);
 ellipsoid(head,hair,0,.13,-.026,.127,.121,.103);
 ellipsoid(head,skin,0,.047,.10,.025,.042,.035,0);
 for(const side of [-1,1])ellipsoid(head,skin,side*.113,.04,-.008,.028,.047,.025,0);
 if(female){for(let k=0;k<4;k++)ellipsoid(head,hair,Math.sin(k)*.035,-.02-k*.10,-.083,.115-k*.008,.115,.065);for(let k=0;k<5;k++){const a=k/5*TAU;ellipsoid(head,shell,-.108+Math.cos(a)*.04,.13+Math.sin(a)*.04,.041,.035,.026,.017,0);}ellipsoid(head,mat('#efbc43'),-.108,.13,.062,.02,.02,.018,0);
 }else{for(let k=0;k<3;k++)ellipsoid(head,hair,0,-.02-k*.095,-.10,.069,.09,.061);}
 const legs:{hip:THREE.Group;knee:THREE.Group;ankle:THREE.Group}[]=[],arms:{shoulder:THREE.Group;elbow:THREE.Group}[]=[];
 for(const side of [-1,1]){
  const hip=new THREE.Group();hip.position.set(side*.105,-.045,0);pelvis.add(hip);limb(hip,skin,.31,.073,.047);const knee=new THREE.Group();knee.position.y=-.31;hip.add(knee);ellipsoid(knee,skin,0,0,0,.052,.052,.053,0);limb(knee,skin,.31,.047,.033);const ankle=new THREE.Group();ankle.position.y=-.31;knee.add(ankle);ellipsoid(ankle,skin,0,-.025,.037,.049,.042,.094,0);legs.push({hip,knee,ankle});
  const shoulder=new THREE.Group();shoulder.position.set(side*(female?.18:.245),.205,0);torso.add(shoulder);shoulder.rotation.z=side*.08;ellipsoid(shoulder,skin,0,-.025,0,.067,.089,.061);limb(shoulder,skin,.215,.055,.037);if(!female)part(shoulder,new THREE.CylinderGeometry(.057,.056,.032,6),blue,0,-.08,0);
  const elbow=new THREE.Group();elbow.position.y=-.215;shoulder.add(elbow);limb(elbow,skin,.205,.036,.026);ellipsoid(elbow,skin,0,-.225,0,.031,.048,.024,0);arms.push({shoulder,elbow});
 }
 root.scale.setScalar((female?1.07:1.14)*.5);
 const shadow=part(root,new THREE.CircleGeometry(.27,16),new THREE.MeshBasicMaterial({color:'#294331',transparent:true,opacity:.15,depthWrite:false}),0,.018,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
 const hammer=new THREE.Group();hammer.name='builder-hammer';hammer.position.set(0,-.22,0);arms[1].elbow.add(hammer);
 const handle=part(hammer,new THREE.CylinderGeometry(.018,.022,.25,6),mat('#8b643b'),0,0,.11);handle.rotation.x=Math.PI/2;
 part(hammer,new THREE.BoxGeometry(.16,.07,.065),mat('#788481'),0,0,.245);hammer.visible=false;
 const rod=new THREE.Group();rod.name='fishing-rod';arms[1].elbow.add(rod);rod.position.set(0,-.22,0);
 const cane=part(rod,new THREE.CylinderGeometry(.014,.02,1.6,5),mat('#a48352'),0,.3,.55);cane.rotation.x=.65;
 const line=part(rod,new THREE.CylinderGeometry(.004,.004,.8,3),mat('#e2dac2'),0,.25,1.04);line.rotation.x=-.4;rod.visible=false;
 const spear=new THREE.Group();spear.name='hunting-spear';arms[1].elbow.add(spear);spear.position.set(0,-.22,0);
 const shaft=part(spear,new THREE.CylinderGeometry(.018,.018,1.4,5),mat('#826546'),0,0,.4);shaft.rotation.x=Math.PI/2;
 const tip=part(spear,new THREE.ConeGeometry(.055,.2,4),mat('#a5aaa0'),0,0,1.15);tip.rotation.x=Math.PI/2;spear.visible=false;
 const carried=new THREE.Group();carried.name='carried-animal';torso.add(carried);carried.position.set(0,-.02,.35);
 ellipsoid(carried,mat('#e3b8a1'),0,0,0,.18,.13,.24,0);ellipsoid(carried,mat('#ce9883'),0,.05,.22,.10,.08,.09,0);carried.visible=false;
 return {root,body,pelvis,torso,head,legs,arms,skirt,hammer,rod,spear,carried};
}
type Person = ReturnType<typeof makePerson> & {
 x:number;z:number;angle:number;goal:{x:number;z:number}|null;idle:number;phase:number;
 kneel:number;speed:number;targetSpeed:number;previous:number;synced?:boolean;cargoMesh?:THREE.Mesh;
};
export class Islanders{
 group=new THREE.Group();people:Person[]=[];elapsed=0;
 private nav:Navigation;
 constructor(private terrain:Terrain){this.nav=new Navigation(terrain);}
 add(count=2){
  const added=Math.min(count,30-this.people.length);
  for(let k=0;k<added;k++){
   const i=this.people.length,rig=makePerson(i%2===1,i);
   const p:Person={...rig,x:(i%4-1.5)*5-8,z:(Math.floor(i/4)%3-1)*5+1,angle:i*2.4,goal:null,idle:i*.19,phase:i*.47,kneel:0,speed:0,targetSpeed:.48+(i%3)*.035,previous:0};
   this.people.push(p);this.group.add(rig.root);this.relocate(p);
  }
  return this.people.length;
 }
 safe(x:number,z:number){return this.nav.safe(x,z);}
 relocate(p:Person){
 for(let k=0;k<3000;k++){const radius=k<300?Math.min(10,k*.035):24;const x=k<300?p.x+(Math.random()-.5)*radius: (Math.random()-.5)*EXTENT*.85,z=k<300?p.z+(Math.random()-.5)*radius:(Math.random()-.5)*EXTENT*.65;if(this.safe(x,z)){p.x=x;p.z=z;p.root.position.set(x,this.terrain.height(x,z),z);p.root.visible=true;p.goal=null;p.idle=.5+Math.random();return;}}
 p.root.visible=false;p.idle=2;
 }
 validSegment(x:number,z:number,tx:number,tz:number){return this.nav.segment({x,z},{x:tx,z:tz});}
 chooseGoal(p:Person){for(let k=0;k<30;k++){const a=p.angle+(Math.random()-.5)*(k<12?2.3:TAU),d=.8+Math.random()*3.6;const x=p.x+Math.sin(a)*d,z=p.z+Math.cos(a)*d;if(this.validSegment(p.x,p.z,x,z)){p.goal={x,z};return;}}p.goal=null;p.idle=1+Math.random()*2;}
 terrainChanged(){for(const p of this.people){if(!this.safe(p.x,p.z))this.relocate(p);else{p.root.position.y=this.terrain.height(p.x,p.z);p.goal=null;p.idle=.15;}}}
 update(dt:number,paused:boolean){if(paused)return;this.elapsed+=dt;
 for(const p of this.people){
 if(!p.root.visible){p.idle-=dt;if(p.idle<=0)this.relocate(p);continue;}
 if(!this.safe(p.x,p.z)){this.relocate(p);continue;}
 p.idle-=dt;if(!p.goal&&p.idle<=0)this.chooseGoal(p);
 let moving=false;
 if(p.goal){const dx=p.goal.x-p.x,dz=p.goal.z-p.z,d=Math.hypot(dx,dz);if(d<.09){p.goal=null;p.idle=1.1+Math.random()*2.5;}else{
 const desired=Math.atan2(dx,dz);const diff=THREE.MathUtils.euclideanModulo(desired-p.angle+Math.PI,TAU)-Math.PI;p.angle+=THREE.MathUtils.clamp(diff,-dt*2.5,dt*2.5);
 moving=Math.abs(diff)<.45;if(moving){const step=Math.min(d,p.targetSpeed*dt*p.speed),nx=p.x+dx/d*step,nz=p.z+dz/d*step;if(this.validSegment(p.x,p.z,nx,nz)){p.x=nx;p.z=nz;}else{p.goal=null;p.idle=.3;moving=false;}}
 }}
 p.speed=THREE.MathUtils.damp(p.speed,moving?1:0,8,dt);p.phase+=dt*p.targetSpeed*.61/(.29*p.root.scale.x)*p.speed;const phase=p.phase*TAU;
 p.root.position.x=p.x;p.root.position.z=p.z;p.root.position.y=THREE.MathUtils.damp(p.root.position.y,this.terrain.height(p.x,p.z),12,dt);p.root.rotation.y=p.angle;
 p.body.position.y=(Math.cos(phase*2)*.009-.007)*p.speed+Math.sin(this.elapsed*1.6+p.phase)*.002;
 p.torso.rotation.y=Math.sin(phase)*.055*p.speed;p.head.rotation.y=Math.sin(this.elapsed*.65+p.phase)*.07*(1-p.speed);p.pelvis.rotation.z=Math.sin(phase)*.018*p.speed;
 for(let i=0;i<2;i++){
 const f=THREE.MathUtils.euclideanModulo(p.phase+i*.5,1),stance=.61;let z:number,y:number;
 if(f<stance){z=.145-.29*f/stance;y=-.606;}else{const u=(f-stance)/(1-stance);z=-.145+.29*(u*u*(3-2*u));y=-.606+Math.sin(Math.PI*u)*.115;}
 z*=p.speed;y=THREE.MathUtils.lerp(-.606,y,p.speed);
 const l=.31,r=THREE.MathUtils.clamp(Math.hypot(z,y),.025,l*2-.001),a=Math.atan2(z,-y),b=Math.acos(r/(2*l));
 p.legs[i].hip.rotation.x=-a-b;p.legs[i].knee.rotation.x=2*b;p.legs[i].ankle.rotation.x=a-b;
 const c=Math.cos(phase+i*Math.PI);p.arms[i].shoulder.rotation.x=.29*c*p.speed;p.arms[i].elbow.rotation.x=-.18-.14*Math.max(0,-c)*p.speed;
 }
 p.skirt.rotation.z=Math.sin(phase)*.025*p.speed;
 }
 }
 sync(agents:readonly Settler[],dt:number,paused:boolean){
  while(this.people.length<agents.length)this.add(1);
  if(!paused)this.elapsed+=dt;
  for(let i=0;i<agents.length;i++){
   const a=agents[i],p=this.people[i];
   const targetY=Math.max(this.terrain.height(a.x,a.z),a.stranded?0.08:-10);
   const relocated=!p.synced||Math.hypot(p.x-a.x,p.z-a.z)>1||Math.abs(p.root.position.y-targetY)>.65;
   const y=relocated||paused?targetY:THREE.MathUtils.damp(p.root.position.y,targetY,16,dt);
   p.synced=true;p.x=a.x;p.z=a.z;p.angle=a.heading;p.root.visible=true;p.root.position.set(a.x,y,a.z);p.root.rotation.y=a.heading;
   if(!p.cargoMesh){p.cargoMesh=part(p.torso,new THREE.BoxGeometry(.28,.25,.26),mat('#bd995e'),0,-.05,.29);}
   p.cargoMesh.visible=a.cargo.food+a.cargo.wood>0||!!a.cargo.construction;
   p.carried.visible=!!a.cargo.animal;p.carried.scale.setScalar(a.cargo.animal?.species==='chicken'?.65:1.7);
   p.carried.children.forEach((o,k)=>{((o as THREE.Mesh).material as THREE.MeshLambertMaterial).color.set(a.cargo.animal?.species==='chicken'?(k?'#d8ab48':'#e9dfbb'):(k?'#ce9883':'#e3b8a1'));});
   p.rod.visible=a.job?.kind==='fish';p.spear.visible=a.job?.kind==='hunt'||a.job?.kind==='train';
   p.hammer.visible=a.job?.kind==='build'&&!a.job.route.length&&!a.stranded;
   if(paused)continue;
   p.speed=THREE.MathUtils.damp(p.speed,a.moving?1:0,8,dt);p.phase+=dt*1.05*.61/(.29*p.root.scale.x)*p.speed;
   const phase=p.phase*TAU,working=!!a.job&&!a.job.route.length&&a.job.kind!=='deliver'&&a.job.kind!=='rally',praying=working&&a.job?.kind==='worship',building=working&&a.job?.kind==='build'&&!a.stranded;
   p.kneel=THREE.MathUtils.damp(p.kneel,building?1:0,12,dt);p.hammer.visible=building;
   p.torso.rotation.x=.2*p.kneel;p.head.rotation.x=.18*p.kneel;
   p.body.position.y=Math.cos(phase*2)*.009*p.speed-.295*p.kneel;p.torso.rotation.y=Math.sin(phase)*.055*p.speed;
   p.head.rotation.y=Math.sin(this.elapsed*.65+i)*.07*(1-p.speed);p.pelvis.rotation.z=Math.sin(phase)*.018*p.speed;
   for(let j=0;j<2;j++){
    const f=THREE.MathUtils.euclideanModulo(p.phase+j*.5,1),stance=.61;let z:number,y:number;
    if(f<stance){z=.145-.29*f/stance;y=-.606;}else{const u=(f-stance)/(1-stance);z=-.145+.29*(u*u*(3-2*u));y=-.606+Math.sin(Math.PI*u)*.115;}
    z*=p.speed;y=THREE.MathUtils.lerp(-.606,y,p.speed);
    const l=.31,r=THREE.MathUtils.clamp(Math.hypot(z,y),.025,l*2-.001),angle=Math.atan2(z,-y),bend=Math.acos(r/(2*l));
    p.legs[j].hip.rotation.x=-angle-bend;p.legs[j].knee.rotation.x=2*bend;p.legs[j].ankle.rotation.x=angle-bend;
    p.arms[j].shoulder.rotation.x=(p.cargoMesh.visible||p.carried.visible)?-.7:praying?-.95:working?-.65+Math.sin(this.elapsed*4+j)*.3:.29*Math.cos(phase+j*Math.PI)*p.speed;
    p.arms[j].elbow.rotation.x=(p.cargoMesh.visible||p.carried.visible)?-.8:praying?-1.2:working?-.5:-.18-.14*Math.max(0,-Math.cos(phase+j*Math.PI))*p.speed;
   }
   for(let j=0;j<2;j++){
    const pose=j===0?[-1.606,1.768,-.162]:[.12,1.55,-1.67];
    p.legs[j].hip.rotation.x=THREE.MathUtils.lerp(p.legs[j].hip.rotation.x,pose[0],p.kneel);
    p.legs[j].knee.rotation.x=THREE.MathUtils.lerp(p.legs[j].knee.rotation.x,pose[1],p.kneel);
    p.legs[j].ankle.rotation.x=THREE.MathUtils.lerp(p.legs[j].ankle.rotation.x,pose[2],p.kneel);
    const swing=.5+.5*Math.sin(this.elapsed*8+i*.7);
    p.arms[j].shoulder.rotation.x=THREE.MathUtils.lerp(p.arms[j].shoulder.rotation.x,j===1?-.5-.95*swing:-.95,p.kneel);
    p.arms[j].elbow.rotation.x=THREE.MathUtils.lerp(p.arms[j].elbow.rotation.x,j===1?-.25-.9*swing:-.65,p.kneel);
   }
   if(working&&a.job?.kind==='fish'){p.arms[1].shoulder.rotation.x=-.9+Math.sin(this.elapsed*1.8)*.09;p.arms[1].elbow.rotation.x=-.45;}
   if(working&&(a.job?.kind==='hunt'||a.job?.kind==='train')){p.arms[1].shoulder.rotation.x=-.8+Math.sin(this.elapsed*3)*.4;p.arms[1].elbow.rotation.x=-.5;}
   if(working&&['catch','feed','trap-set','trap-collect','animal-process'].includes(a.job!.kind)){p.torso.rotation.x=.3;p.head.rotation.x=.25;}
   p.skirt.rotation.z=Math.sin(phase)*.025*p.speed;
  }
 }
 clear(){this.dispose();this.group.clear();this.people=[];this.elapsed=0;}
 dispose(){this.group.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());}});}
}
