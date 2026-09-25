import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Navigation } from './navigation';
import { Terrain, EXTENT } from './terrain';
import type { Settler } from './world-state';
const TAU=Math.PI*2;
type RigAsset={geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]};
type ModelRig={root:THREE.Group;hips:THREE.Bone;spine:THREE.Bone;thighs:THREE.Bone[];shins:THREE.Bone[];upperArms:THREE.Bone[];forearms:THREE.Bone[]};
type IslanderModels={male:RigAsset;female:RigAsset};
let modelCache:Promise<IslanderModels>|null=null;
function skinGeometry(source:THREE.BufferGeometry,female:boolean){
 const geometry=source.clone(),position=geometry.getAttribute('position'),indices=new Uint16Array(position.count*4),weights=new Float32Array(position.count*4);
 const set=(i:number,a:number,aw=1,b=0,bw=0)=>{indices[i*4]=a;indices[i*4+1]=b;weights[i*4]=aw;weights[i*4+1]=bw;};
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),side=x<0?0:1;
  if(y<-.08){
   const thigh=side?4:2,shin=side?5:3;
   if(y<-.56)set(i,shin);
   else if(y<-.42){const t=THREE.MathUtils.smoothstep(y,-.56,-.42);set(i,shin,1-t,thigh,t);}
   else set(i,thigh);
  }else if(Math.abs(x)>(female?.145:.17)&&y<.56){
   const upper=side?8:6,fore=side?9:7;
   if(y<.06)set(i,fore);
   else if(y<.18){const t=THREE.MathUtils.smoothstep(y,.06,.18);set(i,fore,1-t,upper,t);}
   else set(i,upper);
  }else if(y>.02)set(i,1);
  else{const t=THREE.MathUtils.smoothstep(y,-.08,.02);set(i,0,1-t,1,t);}
 }
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 return geometry;
}
function rigAsset(scene:THREE.Object3D,female:boolean):RigAsset{
 let source:THREE.Mesh|null=null;scene.traverse(object=>{if(!source&&object instanceof THREE.Mesh)source=object;});
 if(!source)throw new Error('Islander model contains no mesh');
 const geometry=(source as THREE.Mesh).geometry.clone();geometry.computeBoundingBox();
 const bounds=geometry.boundingBox;
 // Meshy's biped uses a ground-based 0–1.7 m bind pose. The existing female
 // asset is centred around the origin. Normalise only the new male before
 // assigning the shared lightweight gameplay skeleton so every male retains
 // bending hips, knees, shoulders and elbows without one mixer per islander.
 if(!female&&bounds&&bounds.min.y>-.1&&bounds.max.y>1.2){
  const scale=1.9/(bounds.max.y-bounds.min.y),centre=bounds.getCenter(new THREE.Vector3());
  geometry.scale(scale,scale,scale);geometry.translate(-centre.x*scale,-centre.y*scale,-centre.z*scale);
 }
 return {geometry:skinGeometry(geometry,female),material:(source as THREE.Mesh).material};
}
function loadIslanderModels(){
 if(!modelCache){
  const loader=new GLTFLoader();
  modelCache=Promise.all([
   loader.loadAsync('/models/islander-male.glb'),
   loader.loadAsync('/models/islander-female.glb'),
  ]).then(([male,female])=>({male:rigAsset(male.scene,false),female:rigAsset(female.scene,true)}));
 }
 return modelCache;
}
function makeModelRig(asset:RigAsset,female:boolean):ModelRig{
 const mesh=new THREE.SkinnedMesh(asset.geometry,asset.material),hips=new THREE.Bone(),spine=new THREE.Bone();
 hips.name='hips';hips.position.y=-.08;spine.name='spine';spine.position.y=.08;hips.add(spine);
 const thighs:THREE.Bone[]=[],shins:THREE.Bone[]=[],upperArms:THREE.Bone[]=[],forearms:THREE.Bone[]=[];
 for(const side of [-1,1]){
  const thigh=new THREE.Bone(),shin=new THREE.Bone();thigh.name=side<0?'left-hip':'right-hip';thigh.position.set(side*.13,0,0);shin.name=side<0?'left-knee':'right-knee';shin.position.y=-.43;thigh.add(shin);hips.add(thigh);thighs.push(thigh);shins.push(shin);
  const upper=new THREE.Bone(),fore=new THREE.Bone();upper.name=side<0?'left-shoulder':'right-shoulder';upper.position.set(side*(female?.23:.27),.35,0);fore.name=side<0?'left-elbow':'right-elbow';fore.position.y=-.30;upper.add(fore);spine.add(upper);upperArms.push(upper);forearms.push(fore);
 }
 mesh.add(hips);mesh.bind(new THREE.Skeleton([hips,spine,thighs[0],shins[0],thighs[1],shins[1],upperArms[0],forearms[0],upperArms[1],forearms[1]]));
 mesh.castShadow=true;mesh.receiveShadow=true;const root=new THREE.Group();root.position.y=.952;root.scale.setScalar(.75);root.add(mesh);
 return {root,hips,spine,thighs,shins,upperArms,forearms};
}
/** Owned by one view; shared assets survive individual rigs and are freed on clear. */
class PersonAssets {
 materials=new Map<string,THREE.MeshLambertMaterial>();
 geometries=new Map<string,THREE.BufferGeometry>();
 readonly combined=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});
 readonly shadow=new THREE.MeshBasicMaterial({color:'#294331',transparent:true,opacity:.15,depthWrite:false});
 material(c:string){let m=this.materials.get(c);if(!m){m=new THREE.MeshLambertMaterial({color:c,flatShading:true});this.materials.set(c,m);}return m;}
 geometry(key:string,g:THREE.BufferGeometry){const cached=this.geometries.get(key);if(cached){if(cached!==g)g.dispose();return cached;}this.geometries.set(key,g);return g;}
 dispose(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.combined.dispose();this.shadow.dispose();this.geometries.clear();this.materials.clear();}
}
function part(parent:THREE.Object3D,geo:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function ellipsoid(parent:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,detail=1){const o=part(parent,new THREE.IcosahedronGeometry(1,detail),m,x,y,z);o.scale.set(sx,sy,sz);return o;}
function limb(parent:THREE.Object3D,m:THREE.Material,len:number,r1:number,r2:number){return part(parent,new THREE.CylinderGeometry(r1,r2,len,6),m,0,-len/2,0);}
function makePerson(female:boolean,index:number,assets:PersonAssets){
 const mat=(c:string)=>assets.material(c);
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
 const shadow=part(root,new THREE.CircleGeometry(.27,16),assets.shadow,0,.018,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
 const hammer=new THREE.Group();hammer.name='builder-hammer';hammer.position.set(0,-.22,0);arms[1].elbow.add(hammer);
 const handle=part(hammer,new THREE.CylinderGeometry(.018,.022,.25,6),mat('#8b643b'),0,0,.11);handle.rotation.x=Math.PI/2;
 part(hammer,new THREE.BoxGeometry(.16,.07,.065),mat('#788481'),0,0,.245);hammer.visible=false;
 const scythe=new THREE.Group();scythe.name='farmer-scythe';scythe.position.set(0,-.22,0);arms[1].elbow.add(scythe);
 const scytheHandle=part(scythe,new THREE.CylinderGeometry(.014,.022,.72,6),mat('#8b643b'),0,.04,.30);scytheHandle.rotation.x=Math.PI/2;
 const blade=part(scythe,new THREE.TorusGeometry(.19,.018,5,12,Math.PI*.72),mat('#c7d0cc'),-.12,.04,.64);blade.rotation.set(Math.PI/2,0,-.45);scythe.visible=false;
 const rod=new THREE.Group();rod.name='fishing-rod';arms[1].elbow.add(rod);rod.position.set(0,-.22,0);
 const cane=part(rod,new THREE.CylinderGeometry(.014,.02,1.6,5),mat('#a48352'),0,.3,.55);cane.rotation.x=.65;
 const line=part(rod,new THREE.CylinderGeometry(.004,.004,.8,3),mat('#e2dac2'),0,.25,1.04);line.rotation.x=-.4;rod.visible=false;
 const spear=new THREE.Group();spear.name='hunting-spear';arms[1].elbow.add(spear);spear.position.set(0,-.22,0);
 const shaft=part(spear,new THREE.CylinderGeometry(.018,.018,1.4,5),mat('#826546'),0,0,.4);shaft.rotation.x=Math.PI/2;
 const tip=part(spear,new THREE.ConeGeometry(.055,.2,4),mat('#a5aaa0'),0,0,1.15);tip.rotation.x=Math.PI/2;spear.visible=false;
 const carried=new THREE.Group();carried.name='carried-animal';torso.add(carried);carried.position.set(0,-.02,.35);
 ellipsoid(carried,mat('#e3b8a1'),0,0,0,.18,.13,.24,0);ellipsoid(carried,mat('#ce9883'),0,.05,.22,.10,.08,.09,0);carried.visible=false;
 // Merge rigid siblings in joint-local coordinates; keep every animated joint,
 // skirt and recolourable cargo separate. One draw per rigid group, no material groups.
 const groups:THREE.Group[]=[];root.traverse(o=>{if(o instanceof THREE.Group)groups.push(o);});
 groups.forEach((group,ordinal)=>{
  if(group===carried)return;
  const meshes=group.children.filter((o):o is THREE.Mesh<THREE.BufferGeometry,THREE.MeshLambertMaterial>=>o instanceof THREE.Mesh&&o!==skirt&&o.material instanceof THREE.MeshLambertMaterial);
  if(meshes.length<2)return;
  const key=`rig:${female}:${index%4}:${ordinal}`;
  let geometry=assets.geometries.get(key);
  if(!geometry){
   const parts=meshes.map(mesh=>{
    mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrix);
    g.deleteAttribute('uv');g.clearGroups();
    const colors=new Float32Array(g.getAttribute('position').count*3),c=mesh.material.color;
    for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;
   });
   geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());assets.geometries.set(key,geometry);
  }
  for(const mesh of meshes){group.remove(mesh);mesh.geometry.dispose();}
  part(group,geometry,assets.combined);
 });
 root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material!==assets.combined){const g=o.geometry as THREE.BufferGeometry&{parameters?:unknown};o.geometry=assets.geometry(`${g.type}:${JSON.stringify(g.parameters)}`,g);}});
 return {root,body,pelvis,torso,head,legs,arms,skirt,hammer,scythe,rod,spear,carried};
}
type Person = ReturnType<typeof makePerson> & {
 x:number;z:number;angle:number;goal:{x:number;z:number}|null;idle:number;phase:number;
 kneel:number;speed:number;targetSpeed:number;previous:number;synced?:boolean;cargoMesh?:THREE.Mesh;model?:ModelRig;
};
export class Islanders{
 group=new THREE.Group();people:Person[]=[];elapsed=0;
 private nav:Navigation;
 private assets=new PersonAssets();
 private models:IslanderModels|null=null;
 private disposed=false;
 constructor(private terrain:Terrain){
  this.nav=new Navigation(terrain);
  void loadIslanderModels().then(models=>{
   if(this.disposed)return;
   this.models=models;
   this.people.forEach((person,index)=>this.installModel(person,index%2===1));
  }).catch(()=>{ /* The procedural fallback remains usable if an asset cannot load. */ });
 }
 private installModel(person:Person,female:boolean){
  if(person.model||!this.models)return;
  const accessories=new Set(['builder-hammer','farmer-scythe','fishing-rod','hunting-spear','carried-animal']);
  person.body.traverse(object=>{
   if(!(object instanceof THREE.Mesh))return;
   let parent:THREE.Object3D|null=object.parent,keep=false;
   while(parent&&parent!==person.body){if(accessories.has(parent.name)){keep=true;break;}parent=parent.parent;}
   if(!keep)object.visible=false;
  });
  const model=makeModelRig(female?this.models.female:this.models.male,female);
  model.root.name=female?'islander-female-model':'islander-male-model';
  person.body.add(model.root);person.model=model;
 }
 private poseModel(person:Person){
  const model=person.model;if(!model)return;
  model.hips.rotation.z=person.pelvis.rotation.z;
  model.spine.rotation.x=person.torso.rotation.x;model.spine.rotation.y=person.torso.rotation.y;
  for(let i=0;i<2;i++){
   model.thighs[i].rotation.x=person.legs[i].hip.rotation.x*.72;
   model.shins[i].rotation.x=person.legs[i].knee.rotation.x*.72;
   model.upperArms[i].rotation.x=person.arms[i].shoulder.rotation.x*.9;
   model.forearms[i].rotation.x=person.arms[i].elbow.rotation.x*.82;
  }
 }
 add(count=2){
  const added=Math.min(count,100-this.people.length);
  for(let k=0;k<added;k++){
   const i=this.people.length,rig=makePerson(i%2===1,i,this.assets);
   const p:Person={...rig,x:(i%4-1.5)*5-8,z:(Math.floor(i/4)%3-1)*5+1,angle:i*2.4,goal:null,idle:i*.19,phase:i*.47,kneel:0,speed:0,targetSpeed:.48+(i%3)*.035,previous:0};
   this.people.push(p);this.group.add(rig.root);this.installModel(p,i%2===1);this.relocate(p);
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
 pick(ray:THREE.Raycaster){
  const hit=ray.intersectObjects(this.people.map(p=>p.root),true)[0];if(!hit)return null;
  let root:THREE.Object3D=hit.object;while(root.parent&&root.parent!==this.group)root=root.parent;
  const index=this.people.findIndex(p=>p.root===root);return index<0?null:index;
 }
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
 this.poseModel(p);
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
   p.synced=true;p.x=a.x;p.z=a.z;p.angle=a.heading;p.root.visible=!(a.job?.kind==='rest'&&!a.job.route.length);p.root.position.set(a.x,y,a.z);p.root.rotation.y=a.heading;
   if(!p.cargoMesh){p.cargoMesh=part(p.torso,this.assets.geometries.get('cargo')??this.assets.geometry('cargo',new THREE.BoxGeometry(.28,.25,.26)),this.assets.material('#bd995e'),0,-.05,.29);}
   p.cargoMesh.visible=a.cargo.food+a.cargo.wood>0||!!a.cargo.construction;
   p.carried.visible=!!a.cargo.animal;p.carried.scale.setScalar(a.cargo.animal?.species==='chicken'?.65:1.7);
   p.carried.children.forEach((o,k)=>{(o as THREE.Mesh).material=this.assets.material(a.cargo.animal?.species==='chicken'?(k?'#d8ab48':'#e9dfbb'):(k?'#ce9883':'#e3b8a1'));});
   p.rod.visible=a.job?.kind==='fish';p.spear.visible=a.job?.kind==='hunt'||a.job?.kind==='train';
   p.hammer.visible=a.job?.kind==='build'&&!a.job.route.length&&!a.stranded;
   p.scythe.visible=a.job?.kind==='harvest'&&!a.job.route.length&&!a.stranded;
   if(paused)continue;
   p.speed=THREE.MathUtils.damp(p.speed,a.moving?1:0,8,dt);p.phase+=dt*1.05*.61/(.29*p.root.scale.x)*p.speed;
   const phase=p.phase*TAU,working=!!a.job&&!a.job.route.length&&!['deliver','rally','rest'].includes(a.job.kind),praying=working&&a.job?.kind==='worship',building=working&&a.job?.kind==='build'&&!a.stranded,harvesting=working&&a.job?.kind==='harvest'&&!a.stranded;
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
   if(harvesting){
    const cut=.5+.5*Math.sin(this.elapsed*5.5+i*.8);p.torso.rotation.x=.30;p.torso.rotation.y=-.36+cut*.72;
    p.arms[0].shoulder.rotation.x=-.82+cut*.18;p.arms[0].elbow.rotation.x=-.72;
    p.arms[1].shoulder.rotation.x=-1.08+cut*.35;p.arms[1].elbow.rotation.x=-.48-cut*.38;
    p.scythe.rotation.y=-.55+cut*1.10;
   }
   if(working&&(a.job?.kind==='hunt'||a.job?.kind==='train')){p.arms[1].shoulder.rotation.x=-.8+Math.sin(this.elapsed*3)*.4;p.arms[1].elbow.rotation.x=-.5;}
   if(working&&['catch','feed','trap-set','trap-collect','animal-process'].includes(a.job!.kind)){p.torso.rotation.x=.3;p.head.rotation.x=.25;}
   p.skirt.rotation.z=Math.sin(phase)*.025*p.speed;
   this.poseModel(p);
  }
 }
 clear(){this.assets.dispose();this.assets=new PersonAssets();this.group.clear();this.people=[];this.elapsed=0;}
 dispose(){this.disposed=true;this.assets.dispose();this.group.clear();this.people=[];}
}
