import { DAY_SECONDS } from './world-state';
import {FOOD_BALANCE as B} from './food-balance';
import * as THREE from 'three';
import { SEA, type Terrain } from './terrain';
import type { Settlement } from './settlement';
import type { Plot, Resource } from './world-state';

type PlotVisual={root:THREE.Group;building:THREE.Group;crops:THREE.Group;outline:THREE.Group;supplies:THREE.Group;animals:THREE.Group;offering:THREE.Mesh;previousOfferings:number;collectedUntil:number};
export class SettlementView {
  group=new THREE.Group();
  private plots=new Map<number,PlotVisual>();
  private nodes=new Map<number,{root:THREE.Group;crown:THREE.Group}>();
  private orders=new Map<number,THREE.Group>();
  private opportunities=new THREE.Group();
  private influence=new THREE.Group();
  private influenceKey='';
  private camp=new THREE.Group();
  private beacon=new THREE.Group();
  private beaconGlow:THREE.Mesh;
  private prayer:THREE.Mesh;
  private dummy=new THREE.Object3D();
  private materialCache=new Map<string,THREE.MeshLambertMaterial>();
  private opportunityKey='';
  private fireLights=Array.from({length:4},()=>new THREE.PointLight('#ffae51',0,7,2));
  constructor(private terrain:Terrain){
    this.group.add(...this.fireLights);
    this.group.add(this.camp,this.opportunities,this.beacon,this.influence);
    const beaconMaterial=new THREE.MeshBasicMaterial({color:'#fff0a4',transparent:true,opacity:.7,depthWrite:false});
    this.beaconGlow=new THREE.Mesh(new THREE.OctahedronGeometry(.3),beaconMaterial);this.beaconGlow.position.y=2.8;this.beacon.add(this.beaconGlow);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.13,2.5,12),new THREE.MeshBasicMaterial({color:'#fff0a4',transparent:true,opacity:.3,depthWrite:false}));beam.position.y=1.3;this.beacon.add(beam);
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.1,1.2,48),beaconMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.04;this.beacon.add(ring);this.beacon.visible=false;
    this.box(this.camp,.85,.55,.65,'#98744b',-.7,.3,0);
    this.box(this.camp,.65,.4,.6,'#bd9769',-.5,.72,.08);
    for(let i=0;i<4;i++)this.box(this.camp,.04,.56,.67,'#644f39',-.98+i*.2,.3,0);
    const barrel=this.mesh(this.camp,new THREE.CylinderGeometry(.32,.29,.55,10),'#a58b57',.62,.28,-.25);
    barrel.rotation.z=.04;
    this.mesh(this.camp,new THREE.CylinderGeometry(.025,.035,2.3,6),'#795e3d',0,1.15,-.55);
    this.box(this.camp,.72,.4,.035,'#3d8c83',.32,2.05,-.55);
    this.mesh(this.camp,new THREE.CylinderGeometry(.9,1,.08,12),'#bea67b',0,.035,0);
    const glow=new THREE.MeshBasicMaterial({color:'#fff3a6',transparent:true,opacity:.85});
    this.prayer=new THREE.Mesh(new THREE.OctahedronGeometry(.17),glow);this.group.add(this.prayer);

  }
  private material(color:string){let m=this.materialCache.get(color);if(!m){m=new THREE.MeshLambertMaterial({color,flatShading:true});this.materialCache.set(color,m);}return m;}
  private mesh(root:THREE.Object3D,geometry:THREE.BufferGeometry,color:string,x=0,y=0,z=0){
    const mesh=new THREE.Mesh(geometry,this.material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  private box(root:THREE.Object3D,x:number,y:number,z:number,color:string,px=0,py=0,pz=0){return this.mesh(root,new THREE.BoxGeometry(x,y,z),color,px,py,pz);}
  private frame(root:THREE.Object3D,color:string,size=2.15){
    const g=new THREE.Group();
    this.box(g,size,.025,.055,color,0,0,-size/2);this.box(g,size,.025,.055,color,0,0,size/2);
    this.box(g,.055,.025,size,color,-size/2,0,0);this.box(g,.055,.025,size,color,size/2,0,0);root.add(g);return g;
  }
  private makePlot(p:Plot){
    const root=new THREE.Group(),building=new THREE.Group(),crops=new THREE.Group(),animals=new THREE.Group();root.add(building,crops,animals);
    if(p.kind==='torch'||p.kind==='bonfire'){
      const torch=p.kind==='torch',base=torch?1.05:.22;
      if(torch){
        this.mesh(building,new THREE.CylinderGeometry(.045,.065,1.1,6),'#90603c',0,.55,0);
        this.mesh(building,new THREE.CylinderGeometry(.13,.07,.22,6),'#614435',0,1.02,0);
      }else{
        for(let i=0;i<10;i++){const a=i*Math.PI/5;this.mesh(building,new THREE.IcosahedronGeometry(.15,0),'#8a8a7b',Math.sin(a)*.6,.12,Math.cos(a)*.6);}
        for(let i=0;i<3;i++){const log=this.mesh(building,new THREE.CylinderGeometry(.08,.1,.9,6),'#785138',0,.16,0);log.rotation.set(Math.PI/2,0,i*Math.PI/3);}
      }
      const fire=new THREE.Group();fire.name='fire';fire.position.y=base;building.add(fire);
      for(let i=0;i<3;i++){
        const flame=new THREE.Mesh(new THREE.ConeGeometry((torch?.1:.22)*(1-i*.22),(torch?.35:.6)*(1-i*.2),5),new THREE.MeshBasicMaterial({color:['#ff702e','#ffba4f','#fff2ac'][i],toneMapped:false}));
        flame.position.set((i-1)*.035,.15+i*.02,0);fire.add(flame);
      }
      const halo=new THREE.Mesh(new THREE.CircleGeometry(torch?.65:1.35,24),new THREE.MeshBasicMaterial({color:'#ffb951',transparent:true,opacity:.12,depthWrite:false,toneMapped:false}));
      halo.name='fire-halo';halo.rotation.x=-Math.PI/2;halo.position.y=.035;building.add(halo);
    }else if(p.kind==='home'){building.scale.setScalar(B.visuals.hut);
      this.box(building,1.85,.11,1.85,'#d7c8a5',0,.04,0);
      this.box(building,1.62,1.18,1.52,'#f1ead7',0,.67,-.08);
      this.box(building,.46,.82,.05,'#438ca4',0,.46,.69);
      for(const x of [-.72,.72])for(const z of [-.65,.65])this.box(building,.12,1.0,.12,'#e4dcc8',x,.58,z);
      const roof=this.mesh(building,new THREE.ConeGeometry(1.72,.72,4),'#c87545',0,1.63,0);roof.rotation.y=Math.PI/4;
      this.box(building,.20,.48,.22,'#eee6d3',.52,1.65,-.33);
      const cottage=new THREE.Group();cottage.name='cottage';building.add(cottage);
      this.box(cottage,.38,.72,.42,'#f1ead7',.48,1.64,-.38);
      for(const x of [-.48,.48])this.box(cottage,.25,.3,.045,'#69a5b2',x,.85,.70);
      this.box(cottage,1.3,.1,.42,'#c87545',0,.12,.93);
    }else if(p.kind==='granary'||p.kind==='storehouse'){
      const food=p.kind==='granary';
      this.box(building,1.85,.16,1.85,'#9e825c',0,.08,0);
      this.box(building,1.5,1.0,1.4,food?'#d4c397':'#a28b6b',0,.65,0);
      this.box(building,.6,.75,.04,'#536354',0,.48,.72);
      const roof=this.mesh(building,new THREE.ConeGeometry(1.35,.65,4),food?'#ac995c':'#698b81',0,1.48,0);roof.rotation.y=Math.PI/4;
      for(const x of [-.68,.68])this.box(building,.055,.95,.055,'#806745',x,.64,.73);
      if(food)for(const x of [-.55,.55])this.mesh(building,new THREE.IcosahedronGeometry(.2,1),'#cdbc8b',x,.3,.95);
      else for(let i=0;i<3;i++)this.box(building,.62,.13,.15,'#977249',.55,.2+i*.14,.96);
    }else if(p.kind==='temple'){
      for(let i=0;i<3;i++)this.box(building,2-i*.22,.13,2-i*.22,'#ddd5b3',0,.065+i*.13,0);
      for(const x of [-.65,.65])for(const z of [-.65,.65])this.mesh(building,new THREE.CylinderGeometry(.11,.16,1.65,8),'#f0e8ce',x,1.15,z);
      this.box(building,1.88,.2,1.88,'#ddd5b3',0,2.05,0);
      const roof=this.mesh(building,new THREE.ConeGeometry(1.32,.75,4),'#448b83',0,2.48,0);roof.rotation.y=Math.PI/4;
      this.mesh(building,new THREE.OctahedronGeometry(.22),'#f2d284',0,3,0);
      this.box(building,.5,.45,.4,'#aa956a',0,.59,0);
    }else if(p.kind==='coop'||p.kind==='pigpen'){
      this.box(building,1.95,.08,1.95,'#a69b65',0,.04,0);
      for(const x of [-.93,.93])for(const z of [-.93,.93])this.box(building,.065,.65,.065,'#96744d',x,.325,z);
      for(const y of [.25,.5]){for(const z of [-.93,.93])this.box(building,1.9,.04,.04,'#ac895a',0,y,z);for(const x of [-.93,.93])this.box(building,.04,.04,1.9,'#ac895a',x,y,0);}
      this.box(building,.9,.6,.65,'#d1ba87',-.4,.4,-.55);
      const roof=this.mesh(building,new THREE.ConeGeometry(.7,.45,4),'#986e4d',-.4,.93,-.55);roof.rotation.y=Math.PI/4;
      for(let i=0;i<(p.kind==='coop'?8:6);i++){
        const animal=new THREE.Group();animal.position.set(-.55+(i%3)*.5,0,-.05+Math.floor(i/3)*.3);animals.add(animal);
        const chicken=p.kind==='coop',body=this.mesh(animal,new THREE.IcosahedronGeometry(chicken?.09:.14,1),chicken?'#e9dfbb':'#dcaa96',0,.17,0);body.scale.z=1.4;
        const head=this.mesh(animal,new THREE.IcosahedronGeometry(chicken?.05:.07,0),chicken?'#e9dfbb':'#cf9383',0,chicken?.26:.2,.13);head.name='head';
        for(const x of [-.05,.05])this.box(animal,.018,.1,.018,'#9c7955',x,.05,0);
      }
    }else if(p.kind==='slaughterhouse'){
      this.box(building,1.94,.1,1.94,'#a49773',0,.05,0);
      this.box(building,1.65,1.1,.85,'#d6c0a0',0,.65,-.43);
      const roof=this.mesh(building,new THREE.ConeGeometry(1.1,.65,4),'#9d684d',0,1.5,-.43);roof.rotation.y=Math.PI/4;roof.scale.z=.65;
      this.box(building,.38,.7,.04,'#51493c',.4,.45,.015);
      for(const x of [-.9,.9])for(const z of [.18,.85])this.box(building,.065,.5,.065,'#846647',x,.3,z);
      for(const y of [.2,.43]){this.box(building,1.8,.05,.06,'#997b55',0,y,.85);for(const x of [-.9,.9])this.box(building,.06,.05,.7,'#997b55',x,y,.52);}
      for(let i=0;i<4;i++){
        const goat=new THREE.Group();goat.name='goat';goat.position.set(-.55+(i%2)*.65,0,.29+Math.floor(i/2)*.37);animals.add(goat);
        const coat=i%2?'#b39371':'#d1c9ac';this.box(goat,.30,.13,.14,coat,0,.24,0);
        this.mesh(goat,new THREE.IcosahedronGeometry(.07,0),coat,.17,.33,0);
        for(const z of [-.035,.035]){const horn=this.mesh(goat,new THREE.ConeGeometry(.016,.12,4),'#655e4c',.14,.43,z);horn.rotation.z=.3;horn.name='horn';this.box(goat,.065,.02,.03,coat,.19,.35,z*2);}
        this.mesh(goat,new THREE.ConeGeometry(.024,.07,4),'#6f6550',.20,.26,0).rotation.z=Math.PI;
        for(const x of [-.1,.1])for(const z of [-.055,.055]){const leg=this.box(goat,.025,.19,.025,'#75634c',x,.10,z);leg.name='leg';}
        this.box(goat,.065,.025,.035,coat,-.18,.31,0).rotation.z=-.6;
      }
    }else{
      // One larger field contains four distinct vegetable beds and walkable
      // earth paths, so a harvest reads as a working farm rather than one crop.
      this.box(building,3.25,.07,3.25,'#8a7045',0,.035,0);
      for(const [x,z] of [[-.86,-.86],[.86,-.86],[-.86,.86],[.86,.86]] as const)this.box(building,1.42,.075,1.42,'#614d31',x,.09,z);
      this.box(building,.30,.08,3.15,'#c3a56e',0,.13,0);this.box(building,3.15,.08,.30,'#c3a56e',0,.13,0);
      const beds=[[-.86,-.86,'wheat'],[.86,-.86,'tomato'],[-.86,.86,'cabbage'],[.86,.86,'pumpkin']] as const;
      beds.forEach(([bx,bz,kind])=>{
        for(let i=0;i<5;i++){
          const crop=new THREE.Group(),x=bx+(i%3-1)*.38,z=bz+(Math.floor(i/3)-.5)*.48;crop.position.set(x,.13,z);
          if(kind==='wheat'){
            this.mesh(crop,new THREE.CylinderGeometry(.018,.026,.42,5),'#779747',0,.21,0);
            this.mesh(crop,new THREE.ConeGeometry(.075,.20,5),'#dabd55',0,.48,0);
          }else if(kind==='tomato'){
            this.mesh(crop,new THREE.CylinderGeometry(.018,.027,.38,5),'#60893e',0,.19,0);
            for(const side of [-1,1])this.mesh(crop,new THREE.IcosahedronGeometry(.065,0),'#d95432',side*.08,.28,side*.025);
            this.mesh(crop,new THREE.IcosahedronGeometry(.13,0),'#5f9a42',0,.35,0);
          }else if(kind==='cabbage'){
            for(let leaf=0;leaf<3;leaf++){const m=this.mesh(crop,new THREE.IcosahedronGeometry(.13-leaf*.018,0),leaf?'#74a947':'#8abb55',(leaf-1)*.06,.16+leaf*.035,0);m.scale.y=.65;}
          }else{
            this.mesh(crop,new THREE.CylinderGeometry(.016,.025,.25,5),'#5f873b',0,.13,0);
            const fruit=this.mesh(crop,new THREE.IcosahedronGeometry(.14,1),'#dd8a28',.08,.18,0);fruit.scale.y=.76;
          }
          crops.add(crop);
        }
      });
      for(const x of [-1.68,1.68])for(const z of [-1.68,1.68])this.mesh(building,new THREE.CylinderGeometry(.035,.05,.48,5),'#876b45',x,.24,z);
      for(const z of [-1.68,1.68])this.box(building,3.35,.055,.07,'#9d7a4d',0,.28,z);
      for(const x of [-1.68,1.68])this.box(building,.07,.055,3.35,'#9d7a4d',x,.28,0);
    }
    const outline=this.frame(root,'#e4be74');this.group.add(root);
    const supplies=new THREE.Group();root.add(supplies);
    for(let i=0;i<6;i++)this.box(supplies,.55,.12,.14,'#a78551',1.18,.08+Math.floor(i/2)*.13,-.3+(i%2)*.18);
    const offering=this.mesh(root,new THREE.OctahedronGeometry(.2),'#ffdc82',0,3.5,0);offering.visible=false;
    const visual={root,building,crops,outline,supplies,animals,offering,previousOfferings:p.offerings??0,collectedUntil:0};this.plots.set(p.id,visual);return visual;
  }
  private makeNode(n:Resource){
    const root=new THREE.Group(),crown=new THREE.Group();root.add(crown);
    if(n.kind==='wood'){
      const variant=n.id%5;
      if(variant===0){
        this.mesh(root,new THREE.CylinderGeometry(.10,.19,1.35,7),'#795b3d',0,.67,0);
        for(const [x,y,z,s] of [[0,1.55,0,.72],[-.47,1.35,.05,.50],[.45,1.38,.02,.54],[0,1.48,-.42,.48]] as const){
          const leaf=this.mesh(crown,new THREE.IcosahedronGeometry(s,1),y>1.5?'#75a83e':'#5f9138',x,y,z);leaf.scale.y=.82;
        }
      }else if(variant===1){
        this.mesh(root,new THREE.CylinderGeometry(.08,.15,1.45,7),'#71563c',0,.72,0);
        for(let i=0;i<4;i++)this.mesh(crown,new THREE.ConeGeometry(.78-i*.13,.85,7),i%2?'#245e43':'#2f704b',0,1.15+i*.42,0);
      }else if(variant===2){
        const trunk=this.mesh(root,new THREE.CylinderGeometry(.07,.14,1.75,7),'#947047',0,.86,0);trunk.rotation.z=.08;
        for(let i=0;i<7;i++){
          const a=i*Math.PI*2/7,leaf=this.mesh(crown,new THREE.IcosahedronGeometry(.48,0),i%2?'#6ca638':'#82b746',Math.sin(a)*.48,1.75+Math.cos(a)*.08,Math.cos(a)*.48);
          leaf.scale.set(.38,.20,1.45);leaf.rotation.y=a;
        }
      }else{
        this.mesh(root,new THREE.CylinderGeometry(.09,.17,1.25,7),'#76543d',0,.62,0);
        const colors=variant===3?['#d75e9c','#ea82b5','#c94788']:['#d98726','#efa638','#bf6724'];
        for(const [i,p] of [[0,[0,1.53,0]],[1,[-.42,1.32,.02]],[2,[.42,1.34,.04]],[3,[0,1.35,-.40]]] as const){
          const leaf=this.mesh(crown,new THREE.IcosahedronGeometry(i===0?.62:.46,1),colors[i%3],p[0],p[1],p[2]);leaf.scale.y=.9;
        }
      }
    }else{
      this.mesh(crown,new THREE.IcosahedronGeometry(.48,1),'#729054',0,.38,0);
      for(let i=0;i<7;i++){const a=i*2.4;this.mesh(crown,new THREE.IcosahedronGeometry(.08,0),'#d2a766',Math.sin(a)*.38,.52+Math.cos(i)*.1,Math.cos(a)*.35);}
    }
    this.group.add(root);const v={root,crown};this.nodes.set(n.id,v);return v;
  }
  terrainChanged(){this.opportunityKey='';this.influenceKey='';}
  update(sim:Settlement,showPlots:boolean,showInfluence=false){
    const s=sim.state;
    this.influence.visible=showInfluence;
    if(showInfluence){
      const areas=sim.influenceAreas(),key=JSON.stringify(areas);
      if(key!==this.influenceKey){
        this.influenceKey=key;this.influence.traverse(o=>{if(o instanceof THREE.Line){o.geometry.dispose();(o.material as THREE.Material).dispose();}});this.influence.clear();
        for(const area of areas){
          const points=[];for(let i=0;i<144;i++){const a=i/144*Math.PI*2,x=area.x+Math.cos(a)*area.radius,z=area.z+Math.sin(a)*area.radius;points.push(new THREE.Vector3(x,Math.max(SEA+.09,this.terrain.height(x,z)+.05),z));}
          const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#d9eeb1',transparent:true,opacity:.65,depthWrite:false}));this.influence.add(ring);
        }
      }
    }
    this.beacon.visible=!!s.beacon;
    if(s.beacon){
      this.beacon.position.set(s.beacon.x,Math.max(SEA+.1,this.terrain.height(s.beacon.x,s.beacon.z)),s.beacon.z);
      this.beaconGlow.position.y=2.8+Math.sin(s.time*2)*.15;this.beaconGlow.rotation.y=s.time;
      (this.beaconGlow.material as THREE.MeshBasicMaterial).color.set(s.beacon.members.some(m=>m.phase==='waiting')?'#eeb078':'#fff0a4');
    }
    for(const [id,root] of this.orders)if(!s.orders.some(o=>o.id===id)){
      this.group.remove(root);this.clearGeometry(root);this.orders.delete(id);
    }
    for(const order of s.orders){
      let root=this.orders.get(order.id);
      if(!root){
        root=new THREE.Group();this.frame(root,'#e6cc83');
        this.mesh(root,new THREE.OctahedronGeometry(.16),'#e6cc83',0,order.kind==='home'?2:1.1,0);
        if(order.kind==='farm')for(let i=0;i<4;i++)this.box(root,.06,.035,1.7,'#d4c78d',-.65+i*.43,.02,0);
        else for(const x of [-.9,.9])for(const z of [-.9,.9])this.box(root,.05,.45,.05,'#e6cc83',x,.225,z);
        this.orders.set(order.id,root);this.group.add(root);
      }
      root.position.set(order.x,Math.max(SEA+.1,this.terrain.height(order.x,order.z))+.035,order.z);
    }
    this.camp.visible=!!s.camp;if(s.camp)this.camp.position.set(s.camp.x,Math.max(SEA,this.terrain.height(s.camp.x,s.camp.z)),s.camp.z);
    const phase=(s.time%DAY_SECONDS)/DAY_SECONDS;
    const fireStrength=THREE.MathUtils.smoothstep(phase,.54,.70)*(1-THREE.MathUtils.smoothstep(phase,.94,1));
    let lightIndex=0;
    for(const light of this.fireLights)light.intensity=0;
    for(const p of s.plots){
      const v=this.plots.get(p.id)??this.makePlot(p),height=Math.max(SEA+.06,this.terrain.height(p.x,p.z));v.root.position.set(p.x,height,p.z);
      v.building.visible=p.valid;
      const complete=p.stage==='complete';
      v.building.scale.y=p.kind==='home'?B.visuals.hut:!complete?.15+p.progress*.85:1;
      if(p.kind==='torch'||p.kind==='bonfire'){
        const fire=v.building.getObjectByName('fire')!,halo=v.building.getObjectByName('fire-halo')!;
        fire.visible=halo.visible=p.valid&&complete&&fireStrength>.01;
        const flicker=1+Math.sin(s.time*5.3+p.id)*.08+Math.sin(s.time*8.1+p.id*2)*.04;
        fire.scale.set(1,flicker,1);
        if(fire.visible&&lightIndex<this.fireLights.length){
          const light=this.fireLights[lightIndex++];light.position.set(p.x,height+(p.kind==='torch'?1.2:.7),p.z);
          light.intensity=fireStrength*flicker*(p.kind==='torch'?2:4);
        }
      }
      v.animals.visible=p.valid&&complete;v.animals.children.forEach((animal,i)=>{
       animal.visible=i<(p.kind==='coop'||p.kind==='pigpen'?p.stock??0:p.livestock??0);
       if(p.kind==='pigpen'||p.kind==='coop'){
        const age=p.kind==='pigpen'?(p.young??[])[i-((p.stock??0)-(p.young?.length??0))]:undefined;
        animal.scale.setScalar(p.kind==='coop'?.7:1.2*(age===undefined?1:.5+.5*age/B.herd.pigMaturity));
        // A slow shared circuit with trailing young keeps the pen herd together.
        const phase=s.time*.35-i*.6,angle=Math.sin(phase)*.5;
        animal.position.set(Math.sin(phase)*.55,Math.abs(Math.sin(s.time*5+i))*.005,.20+Math.cos(phase)*.28);
        animal.rotation.y=Math.atan2(Math.cos(phase)*.55,-Math.sin(phase)*.28);
        const head=animal.getObjectByName('head');if(head)head.rotation.x=p.kind==='coop'?Math.max(0,Math.sin(s.time*2+i))*.4:angle*.15;
       }
      });
      if(p.kind==='temple'){
        if((p.offerings??0)<v.previousOfferings)v.collectedUntil=s.time+2;v.previousOfferings=p.offerings??0;
        const collecting=s.time<v.collectedUntil;v.offering.visible=p.valid&&complete&&((p.offerings??0)>0||collecting);
        v.offering.position.y=3.5+(collecting?2-(v.collectedUntil-s.time):Math.sin(s.time*2)*.12);v.offering.rotation.y=s.time;v.offering.scale.setScalar(collecting?Math.max(.1,(v.collectedUntil-s.time)/2):1+(p.offerings??0)/50);
      }
      if(p.kind==='home')v.building.children.forEach((part,i)=>{
        if(part.name==='cottage'){part.visible=p.level===2;return;}
        part.visible=complete||p.progress>=[0,.15,.55,.05,.05,.05,.05,.8,.95][i];
        if(i===1){part.scale.y=complete?1:Math.min(1,Math.max(.1,(p.progress-.15)/.5));part.position.y=.075+.575*part.scale.y;}
      });
      v.supplies.visible=p.valid&&(!complete||!!p.upgrading);
      v.supplies.children.forEach((log,i)=>{log.visible=i<Math.ceil((p.supplied??6)*(1-(p.upgrading?p.upgradeProgress??0:p.progress)));});
      v.outline.visible=!p.valid||p.stage==='building'||!!p.upgrading;v.crops.visible=p.valid&&p.planted;
      for(const crop of v.crops.children)crop.scale.setScalar(.14+p.crop*.86);
    }
    for(const n of s.resources){const v=this.nodes.get(n.id)??this.makeNode(n);v.root.visible=n.valid;v.root.position.set(n.x,this.terrain.height(n.x,n.z),n.z);v.crown.scale.setScalar(.25+.75*n.stock/n.capacity);}
    const key=sim.opportunities.map(p=>`${p.kind}:${p.x},${p.z}`).join('|');
    if(key!==this.opportunityKey){
      this.opportunityKey=key;this.clearGeometry(this.opportunities);
      const seen=new Set<string>();
      for(const p of sim.opportunities){const id=`${p.x},${p.z}`;if(seen.has(id))continue;seen.add(id);
        const f=this.frame(this.opportunities,p.kind==='farm'?'#d6d08a':'#b9dba1',2);f.position.set(p.x,this.terrain.height(p.x,p.z)+.035,p.z);}
    }
    this.opportunities.visible=showPlots;
    this.prayer.visible=!!s.prayer&&!!s.camp;
    if(s.camp){this.prayer.position.set(s.camp.x,this.terrain.height(s.camp.x,s.camp.z)+3+Math.sin(s.time*2)*.15,s.camp.z);this.prayer.rotation.y=s.time;}
  }
  private clearGeometry(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials)if(![...this.materialCache.values()].includes(material))material.dispose();}});root.clear();}
  dispose(){
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    this.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    for(const material of this.materialCache.values())materials.add(material);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.clear();
  }
}
