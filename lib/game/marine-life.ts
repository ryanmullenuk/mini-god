import * as THREE from 'three';
import {EXTENT,GRID,STEP,SEA,type Terrain} from './terrain';
import type {Shoreline} from './shoreline';

type Visitor={kind:'whale'|'dolphin';root:THREE.Group;body:THREE.Group;splash:THREE.Mesh;spray:THREE.Group;wait:number;age:number;duration:number;x:number;z:number;heading:number;distance:number;active:boolean};
/** Ambient visitors never alter fishing stocks or the saved village economy. */
export class MarineLife{
 readonly group=new THREE.Group();
 readonly visitors:Visitor[]=[];
 constructor(private terrain:Terrain,private shore:Shoreline){
  this.group.name='Ocean visitors';
  for(let i=0;i<7;i++){
   const kind=i<2?'whale':'dolphin',whale=kind==='whale',root=new THREE.Group(),body=new THREE.Group(),spray=new THREE.Group();root.name=whale?'Surfacing whale':'Jumping dolphin';root.add(body,spray);this.group.add(root);
   const material=new THREE.MeshLambertMaterial({color:whale?'#476572':'#789ca4',flatShading:false});
   const part=(geometry:THREE.BufferGeometry,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);body.add(m);return m;};
   part(new THREE.IcosahedronGeometry(1,1),0,0,0,whale?.82:.27,whale?.64:.26,whale?2.5:1);
   part(new THREE.IcosahedronGeometry(1,1),0,0,whale?1.4:1,whale?.78:.12,whale?.57:.12,whale?1.2:.38);
   const fin=part(new THREE.ConeGeometry(whale?.30:.16,whale?.6:.42,3),0,whale?.62:.35,-.2);fin.rotation.x=-.25;
   for(const sign of [-1,1]){
    part(new THREE.IcosahedronGeometry(1,0),sign*(whale?.57:.27),-.17,whale?.35:.18,whale?.75:.36,.07,whale?.38:.18).rotation.y=sign*.5;
    part(new THREE.IcosahedronGeometry(1,0),sign*(whale?.58:.29),0,whale?-2.65:-1.1,whale?.78:.4,.09,whale?.4:.17).rotation.y=sign*-.35;
   }
   const splash=new THREE.Mesh(new THREE.RingGeometry(.75,1,32),new THREE.MeshBasicMaterial({color:'#e7f9f1',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));splash.rotation.x=-Math.PI/2;root.add(splash);
   for(let n=0;n<6;n++){const drop=new THREE.Mesh(new THREE.IcosahedronGeometry(.10,0),new THREE.MeshBasicMaterial({color:'#e3f2ee',transparent:true,opacity:.65,depthWrite:false}));spray.add(drop);}
   root.visible=false;
   this.visitors.push({kind,root,body,splash,spray,wait:4+i*4+Math.random()*5,age:0,duration:whale?12:3.5,x:0,z:0,heading:0,distance:whale?10:8,active:false});
  }
 }
 private safe(x:number,z:number,whale:boolean){
  if(Math.abs(x)>EXTENT*.46||Math.abs(z)>EXTENT*.46)return false;
  const i=Math.floor((x+EXTENT/2)/STEP),j=Math.floor((z+EXTENT/2)/STEP),k=j*GRID+i;
  return this.shore.isOceanCell(k)&&this.shore.distances[k]>(whale?7:4)&&this.terrain.height(x,z)<SEA-(whale?1:.5);
 }
 private start(v:Visitor){
  for(let attempt=0;attempt<70;attempt++){
   const x=(Math.random()-.5)*EXTENT*.85,z=(Math.random()-.5)*EXTENT*.85,heading=Math.random()*Math.PI*2;
   let safe=true;for(let d=0;d<=v.distance;d+=.5)if(!this.safe(x+Math.sin(heading)*d,z+Math.cos(heading)*d,v.kind==='whale')){safe=false;break;}
   if(!safe)continue;
   Object.assign(v,{x,z,heading,age:0,active:true});v.root.visible=true;return;
  }
  v.wait=5+Math.random()*5;
 }
 update(dt:number,paused:boolean){
  if(paused)return;dt=Math.min(.1,Math.max(0,dt));this.shore.update();
  for(const v of this.visitors){
   if(!v.active){v.wait-=dt;if(v.wait<=0)this.start(v);if(!v.active)continue;}
   v.age+=dt;const t=v.age/v.duration,whale=v.kind==='whale',x=v.x+Math.sin(v.heading)*v.distance*t,z=v.z+Math.cos(v.heading)*v.distance*t;
   if(t>=1||!this.safe(x,z,whale)){v.active=false;v.root.visible=false;v.wait=(whale?35:12)+Math.random()*(whale?45:25);continue;}
   v.root.position.set(x,SEA,z);v.root.rotation.y=v.heading;
   v.body.position.y=whale?-1.2+Math.sin(Math.PI*t)*1.25:-.8+Math.sin(Math.PI*t)*3.1;
   v.body.rotation.x=whale?Math.cos(Math.PI*t)*-.12:-Math.atan2(Math.PI*3.1*Math.cos(Math.PI*t),v.distance);
   const ring=whale?Math.sin(Math.PI*t)*.22:t>.75?(1-t)*2.4:t<.2?(.2-t)*2:0;
   v.splash.position.y=.07;v.splash.scale.setScalar(whale?2.1+t:1+(t>.75?(t-.75)*12:t*8));(v.splash.material as THREE.MeshBasicMaterial).opacity=ring;
   v.spray.visible=whale&&t>.32&&t<.5;
   if(v.spray.visible){const p=(t-.32)/.18;v.spray.position.set(0,v.body.position.y+.5,1.2);v.spray.children.forEach((drop,n)=>{drop.position.set(Math.sin(n*2.4)*p*.65,Math.sin(p*Math.PI)*1.8+n*.08,Math.cos(n*2.4)*p*.4);});}
  }
 }
 dispose(){const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();this.group.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
}
