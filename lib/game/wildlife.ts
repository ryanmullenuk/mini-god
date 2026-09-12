import {FOOD_BALANCE as B} from './food-balance';
import type {FishingArea} from './world-state';
import * as THREE from 'three';
import { EXTENT, POOLS, SEA, Terrain } from './terrain';

const TAU=Math.PI*2,UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);
const FISH_COLOURS=['#ffbc45','#f97568','#61d9d0','#ab94ff','#f598c7','#6fbbf2','#ff923b'];
function polygon(vertices:number[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;}
function instanced(geometry:THREE.BufferGeometry,material:THREE.Material,count:number){const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;return mesh;}
interface School {x:number;z:number;homeX:number;homeZ:number;radius:number;goalX:number;goalZ:number;timer:number;pool:boolean;}
interface Flock {x:number;z:number;heading:number;goalX:number;goalZ:number;timer:number;speed:number;count:number;}
interface Fish {school:School;x:number;z:number;angle:number;phase:number;size:number;offsetX:number;offsetZ:number;visible:boolean;}

export class Wildlife {
  group=new THREE.Group();
  schools:School[]=[];
  fish:Fish[]=[];
  elapsed=0;
  managedFishing:readonly FishingArea[]=[];
  private bodies:THREE.InstancedMesh;
  private tails:THREE.InstancedMesh;
  private fins:THREE.InstancedMesh;
  private eyes:THREE.InstancedMesh;
  private birdBodies:THREE.InstancedMesh;
  private birdWings:THREE.InstancedMesh;
  private birdTips:THREE.InstancedMesh;
  private birdBeaks:THREE.InstancedMesh;
  private clouds:THREE.InstancedMesh;
  private softClouds:THREE.InstancedMesh;
  private wispyClouds:THREE.InstancedMesh;
  private blackBodies:THREE.InstancedMesh;
  private blackWings:THREE.InstancedMesh;
  private dummy=new THREE.Object3D();
  private q=new THREE.Quaternion();
  private birdCount=32;
  private cloudCount=50;
  readonly flocks:Flock[]=[];
  private cursor:THREE.Ray|null=null;
  private cursorRadius=6;
  private flights=Array.from({length:112},()=>({x:NaN,z:NaN,heading:0,escape:0,away:0}));
  private skyStep=0;
  setCursorRay(ray:THREE.Ray|null,radius=6){this.cursor=ray?.clone()??null;this.cursorRadius=Math.max(1,Math.min(16,radius));}
  private cursorAt(y:number){const r=this.cursor;if(!r||Math.abs(r.direction.y)<.0001)return null;const t=(y-r.origin.y)/r.direction.y;if(t<0)return null;return {x:r.origin.x+r.direction.x*t,z:r.origin.z+r.direction.z*t};}
  private avoid(x:number,y:number,z:number,index:number){
    const f=this.flights[index],dt=this.skyStep;
    if(!Number.isFinite(f.x)){f.x=x;f.z=z;}
    const cursor=this.cursorAt(y);
    if(cursor){const dx=f.x-cursor.x,dz=f.z-cursor.z;if(Math.hypot(dx,dz)<this.cursorRadius+1){f.escape=1.3;f.away=Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):index*2.39996;}}
    f.escape=Math.max(0,f.escape-dt);
    const distance=Math.hypot(x-f.x,z-f.z),angle=f.escape>0?f.away:Math.atan2(x-f.x,z-f.z);
    if(f.escape>0||distance>.08){
      const turn=THREE.MathUtils.euclideanModulo(angle-f.heading+Math.PI,TAU)-Math.PI;
      f.heading+=THREE.MathUtils.clamp(turn,-dt*3,dt*3);
      const speed=f.escape>0?9:Math.min(10,distance*2),step=speed*dt;
      f.x+=Math.sin(f.heading)*step;f.z+=Math.cos(f.heading)*step;
    }
    return {x:f.x,z:f.z,heading:f.heading};
  }
  private updateFlocks(dt:number){
    for(const f of this.flocks){
      f.timer-=dt;
      if(f.timer<=0||Math.hypot(f.goalX-f.x,f.goalZ-f.z)<5){const a=Math.random()*TAU,r=25+Math.random()*70;f.goalX=Math.cos(a)*r;f.goalZ=Math.sin(a)*r*.85;f.timer=18+Math.random()*26;}
      let dx=f.goalX-f.x,dz=f.goalZ-f.z;const p=this.cursorAt(13);
      if(p){const ax=f.x-p.x,az=f.z-p.z,d=Math.hypot(ax,az);if(d<this.cursorRadius+12){dx+=ax/Math.max(1,d)*90;dz+=az/Math.max(1,d)*90;}}
      const angle=Math.atan2(dx,dz),turn=THREE.MathUtils.euclideanModulo(angle-f.heading+Math.PI,TAU)-Math.PI;
      f.heading+=THREE.MathUtils.clamp(turn,-dt*.4,dt*.4);f.x+=Math.sin(f.heading)*dt*f.speed;f.z+=Math.cos(f.heading)*dt*f.speed;
    }
  }
  constructor(private terrain:Terrain){
    for(const pool of POOLS)this.schools.push({x:pool.x,z:pool.z,homeX:pool.x,homeZ:pool.z,radius:Math.min(pool.rx,pool.rz)*.65,goalX:pool.x,goalZ:pool.z,timer:0,pool:true});
    for(let i=0;i<5;i++){
      const a=i/5*TAU+.4;let best:THREE.Vector2|null=null;
      for(let r=8;r<EXTENT*.49;r+=.35){const x=Math.cos(a)*r,z=Math.sin(a)*r,h=terrain.sample(x,z);if(h>1.4&&h<3.15&&this.safeWater(x,z))best=new THREE.Vector2(x,z);}
      if(best)this.schools.push({x:best.x,z:best.y,homeX:best.x,homeZ:best.y,radius:4.5,goalX:best.x,goalZ:best.y,timer:0,pool:false});
    }
    this.schools.forEach((school,index)=>{
      for(let i=0;i<(school.pool?18:20);i++){
        const a=i*2.39996,r=Math.sqrt((i+.5)/20)*Math.min(1.6,school.radius*.75);
        const fish={school,x:school.x+Math.cos(a)*r,z:school.z+Math.sin(a)*r,angle:a,phase:index+i*.73,size:.8+(i%5)*.09,offsetX:Math.cos(a)*r,offsetZ:Math.sin(a)*r,visible:true};
        this.recoverFish(fish);this.fish.push(fish);
      }
    });
    const count=this.fish.length;
    const fishMaterial=new THREE.MeshLambertMaterial({color:'#ffffff',emissive:'#202d30',flatShading:true});
    this.bodies=instanced(new THREE.IcosahedronGeometry(1,0),fishMaterial,count);
    this.tails=instanced(polygon([0,0,0,-.20,.02,-.32,.20,.02,-.32]),new THREE.MeshLambertMaterial({color:'#ffffff',emissive:'#172428',side:THREE.DoubleSide}),count);
    this.fins=instanced(polygon([0,.07,-.14,0,.14,-.12,0,.09,.13]),new THREE.MeshLambertMaterial({color:'#ffffff',side:THREE.DoubleSide}),count);
    this.eyes=instanced(new THREE.OctahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:'#17343c'}),count*2);
    for(let i=0;i<count;i++){const c=new THREE.Color(FISH_COLOURS[i%FISH_COLOURS.length]);this.bodies.setColorAt(i,c);this.tails.setColorAt(i,c.clone().multiplyScalar(.88));this.fins.setColorAt(i,c.clone().lerp(new THREE.Color('#fff2ce'),.35));}
    this.group.add(this.bodies,this.tails,this.fins,this.eyes);

    for(const [i,count] of [10,12,1,1,1,1,1,1,1,1,1,1].entries()){
      const angle=i/12*TAU+Math.random()*.4,r=45+Math.random()*35;
      this.flocks.push({x:Math.cos(angle)*r,z:Math.sin(angle)*r*.8,heading:angle+Math.PI/2,goalX:0,goalZ:0,timer:0,speed:2.4+Math.random()*1.4,count});
    }
    const white=new THREE.MeshLambertMaterial({color:'#fff8e9',flatShading:true});
    this.birdBodies=instanced(new THREE.IcosahedronGeometry(1,0),white,this.birdCount);
    this.birdWings=instanced(polygon([0,0,.10,.63,.025,.16,1.15,-.025,-.14,0,0,.10,1.15,-.025,-.14,.33,-.01,-.25]),new THREE.MeshLambertMaterial({color:'#f5f2e5',side:THREE.DoubleSide}),this.birdCount*2);
    this.birdTips=instanced(polygon([.83,-.016,-.05,1.15,-.025,-.14,.84,-.02,-.19]),new THREE.MeshLambertMaterial({color:'#526778',side:THREE.DoubleSide}),this.birdCount*2);
    const beak=new THREE.ConeGeometry(.07,.24,4);beak.rotateX(Math.PI/2);
    this.birdBeaks=instanced(beak,new THREE.MeshLambertMaterial({color:'#f2c55d'}),this.birdCount);
    this.group.add(this.birdBodies,this.birdWings,this.birdTips,this.birdBeaks);
    this.birdBodies.name='Seagull flocks';
    this.blackBodies=instanced(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#263139'}),80);this.blackBodies.name='Murmuration bodies';
    this.blackWings=instanced(polygon([0,0,.1,.6,.03,.12,1.1,0,-.2,0,0,.1,1.1,0,-.2,.3,0,-.22]),new THREE.MeshLambertMaterial({color:'#1d282e',side:THREE.DoubleSide}),160);this.blackWings.name='Murmuration wings';
    this.group.add(this.blackBodies,this.blackWings);
    this.clouds=instanced(new THREE.IcosahedronGeometry(1,1),new THREE.MeshLambertMaterial({color:'#f5f9f6',flatShading:true}),100);this.clouds.name='Opaque clouds';
    this.softClouds=instanced(new THREE.IcosahedronGeometry(1,1),new THREE.MeshLambertMaterial({color:'#f0f6f4',flatShading:true,transparent:true,opacity:.48,depthWrite:false}),80);this.softClouds.name='Soft clouds';
    this.wispyClouds=instanced(new THREE.IcosahedronGeometry(1,1),new THREE.MeshLambertMaterial({color:'#eef5f4',flatShading:true,transparent:true,opacity:.24,depthWrite:false}),70);this.wispyClouds.name='Wispy clouds';
    this.group.add(this.clouds,this.softClouds,this.wispyClouds);
    this.drawFish();this.drawSky();
  }
  safeWater(x:number,z:number){
    if(Math.abs(x)>EXTENT*.48||Math.abs(z)>EXTENT*.48)return false;
    for(const [dx,dz] of [[0,0],[.93,0],[-.93,0],[0,.93],[0,-.93],[.66,.66],[.66,-.66],[-.66,.66],[-.66,-.66]]){
      if(this.terrain.height(x+dx,z+dz)>SEA-.29)return false;
    }
    return true;
  }
  private segmentSafe(x:number,z:number,tx:number,tz:number){const n=Math.max(1,Math.ceil(Math.hypot(tx-x,tz-z)/.20));for(let i=1;i<=n;i++)if(!this.safeWater(x+(tx-x)*i/n,z+(tz-z)*i/n))return false;return true;}
  private recoverFish(f:Fish){
    if(this.safeWater(f.x,f.z)){f.visible=true;return;}
    const s=f.school;
    for(let k=0;k<100;k++){const a=k*2.39996,r=Math.sqrt(k/100)*s.radius,x=s.homeX+Math.cos(a)*r,z=s.homeZ+Math.sin(a)*r;if(this.safeWater(x,z)){f.x=x;f.z=z;f.visible=true;return;}}
    f.visible=false;
  }
  terrainChanged(){
    for(const s of this.schools){
      s.timer=0;
      if(!this.safeWater(s.x,s.z)){
        const survivor=this.fish.find(f=>f.school===s&&this.safeWater(f.x,f.z));
        if(survivor){s.x=survivor.x;s.z=survivor.z;}
        else for(let k=0;k<100;k++){
          const a=k*2.39996,r=Math.sqrt(k/100)*s.radius,x=s.homeX+Math.cos(a)*r,z=s.homeZ+Math.sin(a)*r;
          if(this.safeWater(x,z)){s.x=x;s.z=z;break;}
        }
      }
      s.goalX=s.x;s.goalZ=s.z;
    }
    for(const f of this.fish)this.recoverFish(f);
    this.drawFish();
  }
  private chooseSchoolGoal(s:School){
    for(let i=0;i<24;i++){const a=Math.random()*TAU,r=Math.sqrt(Math.random())*s.radius,x=s.homeX+Math.cos(a)*r,z=s.homeZ+Math.sin(a)*r;if(this.safeWater(x,z)&&this.segmentSafe(s.x,s.z,x,z)){s.goalX=x;s.goalZ=z;s.timer=4+Math.random()*5;return;}}
    s.goalX=s.x;s.goalZ=s.z;s.timer=2;
  }
  update(dt:number,paused:boolean){
    if(paused)return;
    dt=Math.min(.1,Math.max(0,dt));this.skyStep=dt;this.elapsed+=dt;this.updateFlocks(dt);
    for(const s of this.schools){
      s.timer-=dt;if(s.timer<=0)this.chooseSchoolGoal(s);
      const dx=s.goalX-s.x,dz=s.goalZ-s.z,d=Math.hypot(dx,dz);
      if(d>.1){const step=Math.min(d,dt*.62),x=s.x+dx/d*step,z=s.z+dz/d*step;if(this.safeWater(x,z)){s.x=x;s.z=z;}else s.timer=0;}
    }
    for(const f of this.fish){
      if(!f.visible)continue;
      const s=f.school,t=this.elapsed*.30;
      let tx=s.x+f.offsetX*Math.cos(t)-f.offsetZ*Math.sin(t),tz=s.z+f.offsetX*Math.sin(t)+f.offsetZ*Math.cos(t);
      if(!this.safeWater(tx,tz)){tx=s.x;tz=s.z;}
      const dx=tx-f.x,dz=tz-f.z,d=Math.hypot(dx,dz);
      if(d>.09){
        const desired=Math.atan2(dx,dz),diff=THREE.MathUtils.euclideanModulo(desired-f.angle+Math.PI,TAU)-Math.PI;
        f.angle+=THREE.MathUtils.clamp(diff,-dt*2.5,dt*2.5);
        const step=Math.min(d,dt*(.65+Math.min(d,1.3)*.65));
        const nx=f.x+Math.sin(f.angle)*step,nz=f.z+Math.cos(f.angle)*step;
        if(this.segmentSafe(f.x,f.z,nx,nz)){f.x=nx;f.z=nz;}else f.angle+=dt*3;
      }else f.angle+=Math.sin(this.elapsed+f.phase)*dt*.16;
    }
    this.drawFish();this.drawSky();
  }
  private matrix(mesh:THREE.InstancedMesh,index:number,x:number,y:number,z:number,q:THREE.Quaternion,sx:number,sy:number,sz:number){this.dummy.position.set(x,y,z);this.dummy.quaternion.copy(q);this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);}
  private drawFish(){
    const q=this.q;
    this.fish.forEach((f,i)=>{
      const s=f.visible&&!this.managedFishing.some(a=>Math.hypot(f.x-a.water.x,f.z-a.water.z)<6)?f.size*B.visuals.fish:0,y=SEA-.19+Math.sin(this.elapsed*1.4+f.phase)*.023;
      q.setFromAxisAngle(UP,f.angle);this.matrix(this.bodies,i,f.x,y,f.z,q,.18*s,.11*s,.38*s);
      const tx=f.x-Math.sin(f.angle)*.28*s,tz=f.z-Math.cos(f.angle)*.28*s;
      q.setFromAxisAngle(UP,f.angle+Math.sin(this.elapsed*9+f.phase)*.45);this.matrix(this.tails,i,tx,y,tz,q,s,s,s);
      q.setFromAxisAngle(UP,f.angle);this.matrix(this.fins,i,f.x,y,f.z,q,s,s,s);
      for(let side=0;side<2;side++){const dx=(side?1:-1)*.12*s,dz=.19*s;this.matrix(this.eyes,i*2+side,f.x+Math.cos(f.angle)*dx+Math.sin(f.angle)*dz,y+.052*s,f.z-Math.sin(f.angle)*dx+Math.cos(f.angle)*dz,q,.028*s,.028*s,.028*s);}
    });
    for(const m of [this.bodies,this.tails,this.fins,this.eyes])m.instanceMatrix.needsUpdate=true;
  }
  private drawSky(){
    for(let i=0;i<this.birdCount;i++){
      let flock=0,member=i;while(member>=this.flocks[flock].count){member-=this.flocks[flock].count;flock++;}
      const f=this.flocks[flock];let heading=f.heading;
      const angle=member*2.39996+flock*.73,r=f.count===1?0:1.4+Math.sqrt((member+.5)/f.count)*4.4;
      const sideways=Math.cos(angle)*r+Math.sin(this.elapsed*.43+member)*.5,behind=Math.sin(angle)*r+Math.cos(this.elapsed*.37+member)*.5;
      let x=f.x+Math.cos(heading)*sideways+Math.sin(heading)*behind,z=f.z-Math.sin(heading)*sideways+Math.cos(heading)*behind;
      let y=Math.max(11+(flock%6)*.65+Math.sin(this.elapsed*.31+flock)*.8+Math.sin(member*.7+this.elapsed*.5)*.28,this.terrain.height(x,z)+4);
      const displaced=this.avoid(x,y,z,i);x=displaced.x;z=displaced.z;heading=displaced.heading;y=Math.max(y,this.terrain.height(x,z)+4);
      this.q.setFromAxisAngle(UP,heading);this.matrix(this.birdBodies,i,x,y,z,this.q,.17,.14,.43);
      this.matrix(this.birdBeaks,i,x+Math.sin(heading)*.43,y+.03,z+Math.cos(heading)*.43,this.q,1,1,1);
      const gliding=Math.sin(this.elapsed*.28+flock)>.05,flap=gliding?.06:Math.sin(this.elapsed*5.3+member*.3)*.45;
      for(let side=0;side<2;side++){const sign=side?1:-1;this.q.setFromAxisAngle(UP,heading).multiply(new THREE.Quaternion().setFromAxisAngle(FORWARD,sign*flap+(side?0:Math.PI)));this.matrix(this.birdWings,i*2+side,x,y,z,this.q,1,1,1);this.matrix(this.birdTips,i*2+side,x,y,z,this.q,1,1,1);}
    }
    for(const m of [this.birdBodies,this.birdWings,this.birdTips,this.birdBeaks])m.instanceMatrix.needsUpdate=true;
    // One coherent swarm stretch, fold and turn around shared moving centres.
    for(let i=0;i<80;i++){
      const flock=Math.floor(i/80),j=i%80,t=this.elapsed,a=t*.065+flock*Math.PI;
      const u=(j+.5)/80*2-1,theta=j*2.39996+t*.32,ring=Math.sqrt(1-u*u);
      const width=8+3*Math.sin(t*.23+flock),depth=4+2*Math.cos(t*.19);
      const ox=Math.cos(theta)*ring*width,oz=Math.sin(theta)*ring*depth;
      const turn=t*.14+flock,cs=Math.cos(turn),sn=Math.sin(turn);
      let x=Math.cos(a)*46+ox*cs-oz*sn,z=Math.sin(a*1.3)*34+ox*sn+oz*cs;
      const y=16+flock*4+u*(2.6+Math.sin(t*.21))+Math.sin(theta*.8+t*.4)*.6;
      const displaced=this.avoid(x,y,z,this.birdCount+i);x=displaced.x;z=displaced.z;
      const heading=displaced.heading;
      this.q.setFromAxisAngle(UP,heading);this.matrix(this.blackBodies,i,x,y,z,this.q,.075,.065,.20);
      const flap=Math.sin(t*9+j*.43)*.55;
      for(let side=0;side<2;side++){
        const sign=side?1:-1;this.q.setFromAxisAngle(UP,heading).multiply(new THREE.Quaternion().setFromAxisAngle(FORWARD,sign*flap+(side?0:Math.PI)));
        this.matrix(this.blackWings,i*2+side,x,y,z,this.q,.43,.43,.43);
      }
    }
    this.blackBodies.instanceMatrix.needsUpdate=true;this.blackWings.instanceMatrix.needsUpdate=true;
    for(let i=0;i<this.cloudCount;i++){
      const x=THREE.MathUtils.euclideanModulo(i*37.7+this.elapsed*(.22+(i%3)*.055),272)-136;
      const z=Math.sin(i*2.39996)*99,y=21+(i%4)*2.2;
      const mesh=i<20?this.clouds:i<36?this.softClouds:this.wispyClouds,index=i<20?i:i<36?i-20:i-36;
      const bank=.8+(i%4)*.16;
      for(let j=0;j<5;j++){
        const ox=(j-2)*1.55*bank,oy=j===2?.5:0,oz=Math.sin(j*2.1+i)*.75,scale=(j===2?1.3:1)*bank;
        this.q.setFromAxisAngle(UP,i*.72);this.matrix(mesh,index*5+j,x+ox,y+oy,z+oz,this.q,2.15*scale,(i>=36?.4:.76)*scale,1.6*scale);
      }
    }
    for(const mesh of [this.clouds,this.softClouds,this.wispyClouds])mesh.instanceMatrix.needsUpdate=true;
  }

  dispose(){
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    this.group.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){if((m as THREE.InstancedMesh).isInstancedMesh)(m as THREE.InstancedMesh).dispose();geometries.add(m.geometry);(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>materials.add(x));}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
}
