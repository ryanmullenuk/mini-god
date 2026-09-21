import {FOOD_BALANCE as B} from './food-balance';
import {EXTENT,FIRST_DRY_LAYER,type Terrain} from './terrain';
import type {Navigation} from './navigation';
import type {FoodJob,FoodStatus,GuidancePreview,Point,Plot,Settler,Species,WorldState} from './world-state';
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const entrance=(p:Point&{kind?:string})=>({x:p.x,z:p.z+(p.kind==='coop'||p.kind==='slaughterhouse'?2.65:1.65)});
export const FOOD_JOBS:FoodJob[]=['fish','catch','pen-delivery','feed','trap-set','trap-collect','hunt','train','animal-transfer','animal-process'];
export const FOOD_LABELS:Record<FoodJob,string>={fish:'Fishing from the shore',catch:'Herding chickens to their coop','pen-delivery':'Carrying an animal',feed:'Feeding and tending animals','trap-set':'Crafting and baiting a trap','trap-collect':'Collecting a trapped pig',hunt:'Hunting with a spear',train:'Learning Hunting','animal-transfer':'Taking livestock to the slaughterhouse','animal-process':'Preparing animal food'};
export class FoodSystem {
 constructor(private world:()=>WorldState,private terrain:Terrain,private nav:Navigation,private assign:(w:Settler,kind:FoodJob,id:number,p:Point)=>boolean,private release:(w:Settler)=>void){this.initialize();}
 private get s(){return this.world();} private get f(){return this.s.foodSystem;}
 private random(){let n=this.f.seed;n^=n<<13;n^=n>>>17;n^=n<<5;this.f.seed=n>>>0;return this.f.seed/4294967296;}
 private id(){return this.s.nextId++;}
 private initialize(){
  if(this.f.initialized)return;this.f.initialized=true;
  for(let i=0;i<18;i++){
   let p:Point|null=null;
   const size=i<6?B.herd.pigs:B.herd.chickens,start=i<6?Math.floor(i/size)*size:6+Math.floor((i-6)/size)*size,leader=this.f.animals[start];
   for(let k=0;k<300;k++){const angle=this.random()*Math.PI*2,r=.6+this.random()*1.4;
    const q=leader?{x:leader.x+Math.cos(angle)*r,z:leader.z+Math.sin(angle)*r}:{x:(this.random()-.5)*EXTENT*.65,z:(this.random()-.5)*EXTENT*.45};if(this.nav.safe(q.x,q.z)&&(!leader||this.nav.segment(leader,q))){p=q;break;}}
   if(p)this.f.animals.push({...p,id:this.id(),species:i<6?'pig':'chicken',...(i<6&&i%3===2?{age:0}:{}),alive:true,claimedBy:null,heading:0,goal:null,timer:0});
  }
 }
 private water(p:Point){return Math.abs(p.x)<EXTENT/2-1&&Math.abs(p.z)<EXTENT/2-1&&this.terrain.level(p.x,p.z)<FIRST_DRY_LAYER;}
 private fishWater(p:Point):Point|null{
  for(let r=1;r<=4;r+=.5)for(let i=0;i<24;i++){const a=i*Math.PI/12,q={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r};if(this.water(q)&&this.water({x:q.x+.4,z:q.z})&&this.water({x:q.x-.4,z:q.z}))return q;}
  return null;
 }
 preview(kind:'fishing'|'trap',p:Point):GuidancePreview{
  const result=(allowed:boolean,message:string):GuidancePreview=>({...p,kind,allowed,message,wood:kind==='trap'?B.trap.wood:0});
  if(!this.s.camp)return result(false,'Choose your settlement first.');
  if(!this.nav.safe(p.x,p.z)||!this.nav.route(this.s.camp,p))return result(false,'Choose reachable dry ground with single-layer steps.');
  if([...this.s.plots,...this.s.orders].some(b=>dist(b,p)<2.5))return result(false,'Leave room beside buildings and fields.');
  if(kind==='fishing'){
   if(this.f.fishing.length>=B.fishing.maxAreas)return result(false,'Eight fishing areas is the limit.');
   const water=this.fishWater(p);if(!water)return result(false,'Choose dry shoreline close to water.');
   if(this.f.fishing.some(a=>dist(a.water,water)<B.fishing.radius*2))return result(false,'This fishing water is already managed by a nearby area.');
   return result(true,'Mark fishing shore · Assign a follower in Food & wildlife');
  }
  if(!this.s.settlers.some(w=>(w.huntingSkill??0)>=1&&w.weapon))return result(false,'Train a follower in Hunting first.');
  if(this.f.traps.length>=B.trap.max)return result(false,'Eight traps is the limit. Reuse an empty trap.');
  if([...this.f.traps,...this.f.fishing].some(a=>dist(a,p)<2))return result(false,'Leave space around other traps and fishing spots.');
  if(this.s.wood<B.trap.wood||this.s.food<B.trap.bait)return result(false,'A trap needs 3 wood and 1 food for bait.');
  return result(true,'Place pig trap · 3 wood + 1 bait · A trained follower will set it');
 }
 guide(kind:'fishing'|'trap',p:Point){
  const result=this.preview(kind,p);if(!result.allowed)return result;
  if(kind==='fishing')this.f.fishing.push({x:p.x,z:p.z,id:this.id(),water:this.fishWater(p)!,stock:B.fishing.capacity,recovery:0,workerId:null,claimedBy:null});
  else{this.s.wood-=B.trap.wood;this.s.food-=B.trap.bait;this.s.consumedFood+=B.trap.bait;this.f.traps.push({x:p.x,z:p.z,id:this.id(),phase:'planned',claimedBy:null});}
  return result;
 }
 assignRole(kind:'fish'|'keeper',id:number,workerId:number|null){
  if(workerId!==null&&!this.s.settlers.some(w=>w.id===workerId))return false;
  const object=kind==='fish'?this.f.fishing.find(p=>p.id===id):this.s.plots.find(p=>p.id===id&&(p.kind==='coop'||p.kind==='pigpen'));
  if(!object)return false;
  // One specialised post per worker. In-flight cargo always completes its trip.
  if(workerId!==null){for(const a of this.f.fishing)if(a.workerId===workerId)a.workerId=null;for(const p of this.s.plots)if(p.keeperId===workerId)p.keeperId=null;}
  if(kind==='fish')this.f.fishing.find(p=>p.id===id)!.workerId=workerId;else (object as Plot).keeperId=workerId;
  for(const w of this.s.settlers)if(w.job&&FOOD_JOBS.includes(w.job.kind as FoodJob)&&!w.cargo.animal&&!w.cargo.food&&(w.job.target===id||w.id===workerId))this.release(w);
  return true;
 }
 priority(id:number,value:'breed'|'food'){const p=this.s.plots.find(p=>p.id===id&&(p.kind==='coop'||p.kind==='pigpen'));if(!p)return false;p.priority=value;if(value==='breed')for(const w of this.s.settlers)if(w.job?.kind==='animal-transfer'&&w.job.target===id)this.release(w);return true;}
 train(id:number){const w=this.s.settlers.find(w=>w.id===id);if(!w||(w.huntingSkill??0)>=1||this.f.training.includes(id)||this.s.wood<B.training.wood)return false;this.s.wood-=B.training.wood;this.f.training.push(id);return true;}
 hunt(id:number){const w=this.s.settlers.find(w=>w.id===id);if(!w||(w.huntingSkill??0)<1||!w.weapon)return false;if(this.f.hunting.includes(id)){this.f.hunting=this.f.hunting.filter(n=>n!==id);if(w.job?.kind==='hunt')this.release(w);}else this.f.hunting.push(id);return true;}
 rearm(id:number){const t=this.f.traps.find(t=>t.id===id);if(!t||t.phase!=='empty'||this.s.food<B.trap.bait)return false;this.s.food-=B.trap.bait;this.s.consumedFood+=B.trap.bait;t.phase='planned';return true;}
 private flockGoal(a:WorldState['foodSystem']['animals'][number]):Point|null{
  const peers=this.f.animals.filter(b=>b.alive&&b.species===a.species),size=a.species==='pig'?B.herd.pigs:B.herd.chickens;
  const index=peers.indexOf(a),group=peers.slice(Math.floor(index/size)*size,Math.floor(index/size)*size+size),leader=group[0];
  if(!leader)return null;
  // A shared leader keeps groups cohesive without moving anyone across terrain.
  const angle=(index%size)*2.39996,spacing=a.species==='pig'?1.1:.65;
  const target=leader===a?{x:a.x+Math.sin(this.s.time*.12+a.id)*1.6,z:a.z+Math.cos(this.s.time*.12+a.id)*1.6}:{x:leader.x+Math.sin(angle)*spacing,z:leader.z+Math.cos(angle)*spacing};
  const route=this.nav.route(a,target);return route?.[0]??null;
 }
 private incoming(id:number){return this.s.settlers.reduce((n,w)=>n+(w.cargo.animal?.destination===id?1:w.job?.destination===id&&!w.cargo.animal?w.job.herd?.length??1:0),0);}
 private room(p:Plot){const capacity=p.kind==='coop'?B.chicken.capacity:p.kind==='pigpen'?B.pig.capacity:12;return (p.kind==='slaughterhouse'?(p.poultry??0)+(p.pork??0):p.stock??0)+this.incoming(p.id)<capacity;}
 private pen(species:Species){return this.s.plots.find(p=>p.kind===(species==='pig'?'pigpen':'coop')&&p.valid&&p.stage==='complete'&&this.room(p));}
 private start(w:Settler,kind:FoodJob,id:number,point:Point,destination?:number){
  const claimed=this.f.animals.find(a=>a.id===id)??this.f.fishing.find(a=>a.id===id)??this.f.traps.find(a=>a.id===id)??this.s.plots.find(a=>a.id===id);
  if(claimed?.claimedBy!=null)return false;
  if(!this.assign(w,kind,id,point))return false;if(claimed)claimed.claimedBy=w.id;if(destination!==undefined)w.job!.destination=destination;return true;
 }
 releaseClaims(w:Settler){for(const a of [...this.f.animals,...this.f.fishing,...this.f.traps])if(a.claimedBy===w.id)a.claimedBy=null;}
 target(w:Settler):Point|null{
  const j=w.job;if(!j)return null;
  if(j.kind==='catch'&&j.herd){const p=this.s.plots.find(p=>p.id===j.destination);return p?entrance(p):null;}
  if(j.kind==='train')return this.s.camp;
  if(j.kind==='fish')return this.f.fishing.find(p=>p.id===j.target)??null;
  if(j.kind==='trap-set'||j.kind==='trap-collect')return this.f.traps.find(p=>p.id===j.target)??null;
  if(j.kind==='catch'||j.kind==='hunt')return this.f.animals.find(a=>a.id===j.target)??null;
  const p=this.s.plots.find(p=>p.id===j.target);return p?entrance(p):null;
 }
 decide(w:Settler){
  if(w.cargo.animal){const p=this.s.plots.find(p=>p.id===w.cargo.animal!.destination&&p.valid&&p.stage==='complete');if(p)this.start(w,'pen-delivery',p.id,entrance(p));return true;}
  if(w.cargo.food+w.cargo.wood)return false;
  if(this.f.training.includes(w.id)&&this.s.camp)return this.start(w,'train',0,this.s.camp);
  const fish=this.f.fishing.find(a=>a.workerId===w.id&&a.claimedBy===null&&a.stock>0&&this.water(a.water));
  if(fish&&this.start(w,'fish',fish.id,fish))return true;
  const keeper=this.s.plots.find(p=>p.keeperId===w.id&&p.valid&&p.stage==='complete');
  if(keeper){
   const species:Species=keeper.kind==='coop'?'chicken':'pig';
   if(this.room(keeper)){
    if(species==='chicken')for(const a of this.f.animals.filter(a=>a.alive&&a.species==='chicken'&&a.claimedBy===null).sort((a,b)=>dist(w,a)-dist(w,b))){if(this.start(w,'catch',a.id,a,keeper.id))return true;}
    else for(const t of this.f.traps.filter(t=>t.phase==='caught'))if(this.start(w,'trap-collect',t.id,t,keeper.id))return true;
   }
   if((keeper.stock??0)>=2&&!keeper.fed&&this.room(keeper)&&this.s.food>=this.s.settlers.length*3+B[species].feed&&this.start(w,'feed',keeper.id,entrance(keeper)))return true;
   if(keeper.priority==='food'&&(keeper.stock??0)-(keeper.young?.length??0)>2){const house=this.s.plots.find(p=>p.kind==='slaughterhouse'&&p.valid&&p.stage==='complete'&&this.room(p));if(house&&this.nav.route(entrance(keeper),entrance(house))&&this.start(w,'animal-transfer',keeper.id,entrance(keeper),house.id))return true;}
  }
  if((w.huntingSkill??0)>=1&&w.weapon){
   for(const t of this.f.traps.filter(t=>t.phase==='planned'))if(this.start(w,'trap-set',t.id,t))return true;
   const pen=this.pen('pig');if(pen)for(const t of this.f.traps.filter(t=>t.phase==='caught'))if(this.start(w,'trap-collect',t.id,t,pen.id))return true;
   if(this.f.hunting.includes(w.id))for(const a of this.f.animals.filter(a=>a.alive&&a.species==='pig'&&a.claimedBy===null).sort((a,b)=>dist(w,a)-dist(w,b))){
    const d=dist(w,a),q=d<=4?w:{x:a.x+(w.x-a.x)/d*4,z:a.z+(w.z-a.z)/d*4};
    if(this.nav.segment(q,a)&&this.start(w,'hunt',a.id,q))return true;
   }
  }
  for(const p of this.s.plots.filter(p=>p.kind==='slaughterhouse'&&p.valid&&p.stage==='complete'&&((p.poultry??0)+(p.pork??0)>0)))if(this.start(w,'animal-process',p.id,entrance(p)))return true;
  return false;
 }
 beforeWalk(w:Settler){
  const j=w.job;if(!j||!['catch','hunt'].includes(j.kind))return;
  if(j.kind==='catch'&&j.herd){
   const p=this.s.plots.find(p=>p.id===j.destination&&p.valid&&p.stage==='complete');
   if(!p){this.release(w);return;}
   if(j.herd.some(id=>{const a=this.f.animals.find(a=>a.id===id);return !a?.alive||dist(w,a)>2.2;})){j.route=[];return;}
   if(!j.route.length&&dist(w,entrance(p))>.1){const route=this.nav.route(w,entrance(p));if(route)j.route=route;else this.release(w);}return;
  }
  const a=this.f.animals.find(a=>a.id===j.target);if(!a?.alive){this.release(w);return;}
  const d=dist(w,a);
  if(j.kind==='hunt'&&d<=4.5&&this.nav.segment(w,a)){j.route=[];return;}
  if(j.kind==='catch'&&d<=.65&&this.nav.segment(w,a)){j.route=[];return;}
  j.work=0;
  if(this.s.tick%10===0||!j.route.length){const q=j.kind==='hunt'&&d>4?{x:a.x+(w.x-a.x)/d*4,z:a.z+(w.z-a.z)/d*4}:a;const route=this.nav.route(w,q);if(route)j.route=route;else this.release(w);}
 }
 work(w:Settler,dt:number){
  const j=w.job;if(!j||!FOOD_JOBS.includes(j.kind as FoodJob))return false;
  if(j.kind==='catch'&&j.herd)return true;
  const target=this.target(w);if(!target){this.release(w);return true;}
  const distance=dist(w,target),range=j.kind==='hunt'?4.5:j.kind==='catch'?.65:.25;
  if(distance>range){this.release(w);return true;}
  w.heading=Math.atan2(target.x-w.x,target.z-w.z);
  if(j.kind==='train'){
   if(!this.f.training.includes(w.id)){this.release(w);return true;}
   w.huntingSkill=Math.min(1,(w.huntingSkill??0)+dt/B.training.seconds);
   if(w.huntingSkill>=1){w.weapon=true;this.f.training=this.f.training.filter(id=>id!==w.id);this.release(w);}return true;
  }
  if(j.kind==='fish'){
   const a=this.f.fishing.find(a=>a.id===j.target)!;w.heading=Math.atan2(a.water.x-w.x,a.water.z-w.z);
   if(!this.water(a.water)||a.stock<1){this.release(w);return true;}
   if(j.work>=B.fishing.catchSeconds){a.stock--;w.cargo.food+=B.food.fish;this.release(w);}return true;
  }
  if(j.kind==='catch'||j.kind==='hunt'){
   const a=this.f.animals.find(a=>a.id===j.target)!;
   if(!a.alive||a.claimedBy!==w.id||!this.nav.segment(w,a)||(j.kind==='hunt'&&((w.huntingSkill??0)<1||!w.weapon))){this.release(w);return true;}
   if(j.work>=B.catchSeconds){
    if(j.kind==='catch'){const p=this.s.plots.find(p=>p.id===j.destination&&p.valid&&p.stage==='complete');if(!p){this.release(w);return true;}
     const slots=B.chicken.capacity-(p.stock??0)-(this.incoming(p.id)-1);
     const flock=[a,...this.f.animals.filter(b=>b!==a&&b.alive&&b.species==='chicken'&&b.claimedBy===null&&dist(a,b)<4)].filter(b=>this.nav.route(b,entrance(p))).slice(0,slots);
     if(!flock.length){this.release(w);return true;}
     j.herd=flock.map(b=>b.id);for(const b of flock){b.claimedBy=w.id;b.timer=0;}j.target=j.herd[0];j.route=this.nav.route(w,entrance(p))??[];j.work=0;return true;}
    else w.cargo.food+=B.food.pig;
    a.alive=false;this.release(w);
   }return true;
  }
  if(j.kind==='trap-set'||j.kind==='trap-collect'){
   const t=this.f.traps.find(t=>t.id===j.target)!;
   if(j.kind==='trap-set'&&j.work>=B.trap.setSeconds){if((w.huntingSkill??0)>=1&&w.weapon&&t.phase==='planned')t.phase='armed';this.release(w);}
   if(j.kind==='trap-collect'&&j.work>=B.catchSeconds){if(t.phase==='caught'&&j.destination){w.cargo.animal={species:'pig',destination:j.destination};t.phase='empty';}this.release(w);}return true;
  }
  const p=this.s.plots.find(p=>p.id===j.target);if(!p?.valid||p.stage!=='complete'||p.claimedBy!==w.id){this.release(w);return true;}
  if(j.kind==='pen-delivery'){
   const cargo=w.cargo.animal;if(cargo?.destination===p.id){
    if(p.kind==='slaughterhouse'){if(cargo.species==='chicken')p.poultry=(p.poultry??0)+1;else p.pork=(p.pork??0)+1;}
    else p.stock=(p.stock??0)+1;
    delete w.cargo.animal;
   }this.release(w);return true;
  }
  const species:Species=p.kind==='coop'?'chicken':'pig';
  if(j.kind==='feed'&&j.work>=B.careSeconds){if(!p.fed&&(p.stock??0)>=2&&this.room(p)&&this.s.food>=this.s.settlers.length*3+B[species].feed){this.s.food-=B[species].feed;this.s.consumedFood+=B[species].feed;p.fed=true;p.breed=0;}this.release(w);}
  if(j.kind==='animal-transfer'&&j.work>=B.careSeconds){if((p.stock??0)-(p.young?.length??0)>2&&j.destination){p.stock!--;w.cargo.animal={species,destination:j.destination};}this.release(w);}
  if(j.kind==='animal-process'&&j.work>=B.processingSeconds){if((p.poultry??0)>0){p.poultry!--;w.cargo.food+=B.food.chicken;}else if((p.pork??0)>0){p.pork!--;w.cargo.food+=B.food.pig;}this.release(w);}
  return true;
 }
 tick(dt:number){
  for(const a of this.f.fishing){if(a.stock<B.fishing.capacity&&this.water(a.water)){a.recovery+=dt;if(a.recovery>=B.fishing.recoverySeconds){a.recovery-=B.fishing.recoverySeconds;a.stock++;}}else a.recovery=0;}
  for(const p of this.s.plots)if(p.young)p.young=p.young.map(age=>age+dt).filter(age=>age<B.herd.pigMaturity);
  for(const p of this.s.plots)if((p.kind==='coop'||p.kind==='pigpen')&&p.valid&&p.stage==='complete'&&p.fed&&(p.stock??0)>=2&&this.room(p)){
   p.breed=Math.min(1,(p.breed??0)+dt/B[p.kind==='coop'?'chicken':'pig'].breedSeconds);
   if(p.breed>=1){p.stock=(p.stock??0)+1;if(p.kind==='pigpen')(p.young??=[]).push(0);p.breed=0;p.fed=false;}
  }
  for(const a of this.f.animals){
   if(!a.alive)continue;if(a.age!==undefined)a.age=Math.min(B.herd.pigMaturity,a.age+dt);a.timer-=dt;
   const keeper=this.s.settlers.find(w=>w.id===a.claimedBy&&w.job?.kind==='catch'&&w.job.herd?.includes(a.id));
   if(keeper){
    const pen=this.s.plots.find(p=>p.id===keeper.job!.destination&&p.valid&&p.stage==='complete');
    if(!pen){this.release(keeper);continue;}
    if(dist(a,entrance(pen))<.65&&this.nav.segment(a,entrance(pen))){
     pen.stock=(pen.stock??0)+1;a.alive=false;a.claimedBy=null;keeper.job!.herd=keeper.job!.herd!.filter(id=>id!==a.id);
     if(!keeper.job!.herd.length)this.release(keeper);else keeper.job!.target=keeper.job!.herd[0];continue;
    }
    if(a.timer<=0){a.goal=this.nav.route(a,keeper)?.[0]??null;a.timer=.5;}
   }
   if(!this.nav.safe(a.x,a.z)){if(a.timer<=0){const p=this.nav.nearest(a,3);if(p){a.x=p.x;a.z=p.z;}a.timer=2;}continue;}
   const threat=a.species==='pig'?this.s.settlers.find(w=>dist(w,a)<3.5):undefined;
   if(keeper){}
   else if(threat){const d=dist(a,threat)||1;a.goal={x:a.x+(a.x-threat.x)/d*3,z:a.z+(a.z-threat.z)/d*3};}
   else if(a.timer<=0){const trap=a.species==='pig'?this.f.traps.find(t=>t.phase==='armed'&&dist(t,a)<10&&this.nav.segment(a,t)):undefined;a.goal=trap?{x:trap.x,z:trap.z}:this.flockGoal(a);a.timer=a.goal?1+this.random()*2:12;}
   if(a.goal&&!this.nav.segment(a,a.goal))a.goal=null;
   if(a.goal){const d=dist(a,a.goal);if(d<.05)a.goal=null;else{const step=Math.min(d,dt*(keeper?.9:threat?1.65:a.species==='pig'?.4:.3)),next={x:a.x+(a.goal.x-a.x)*step/d,z:a.z+(a.goal.z-a.z)*step/d};if(this.nav.segment(a,next)){a.heading=Math.atan2(next.x-a.x,next.z-a.z);a.x=next.x;a.z=next.z;}else a.goal=null;}}
   if(a.species==='pig')for(const t of this.f.traps)if(t.phase==='armed'&&dist(t,a)<.7&&this.nav.safe(t.x,t.z)&&this.nav.segment(a,t)){a.alive=false;t.phase='caught';if(a.claimedBy!==null){const w=this.s.settlers.find(w=>w.id===a.claimedBy);if(w)this.release(w);}break;}
  }
 }
 status():FoodStatus{
  const s=this.s;
  return {wildChickens:this.f.animals.filter(a=>a.alive&&a.species==='chicken').length,wildPigs:this.f.animals.filter(a=>a.alive&&a.species==='pig').length,
   fishing:this.f.fishing.map(a=>({id:a.id,stock:a.stock,workerId:a.workerId,message:!this.water(a.water)?'Water lost · restore the shore':!this.nav.safe(a.x,a.z)||s.camp&&!this.nav.route(s.camp,a)?'Shore blocked · sculpt steps':a.stock===0?'Overfished · fish return gradually':a.stock<=3?'Low fish · allow recovery':`${a.stock}/${B.fishing.capacity} fish · 3 food each`})),
   pens:s.plots.filter(p=>p.kind==='coop'||p.kind==='pigpen').map(p=>({id:p.id,kind:p.kind as 'coop'|'pigpen',stock:p.stock??0,capacity:B[p.kind==='coop'?'chicken':'pig'].capacity,priority:p.priority??'breed',keeperId:p.keeperId??null,message:!p.valid?'Restore flat ground':p.stage!=='complete'?'Under construction':!this.nav.route(s.camp??p,entrance(p))?'Blocked · sculpt steps':(p.stock??0)<2?p.kind==='coop'?'Assign a keeper to herd chickens here':'Trap pigs to start a breeding herd':p.fed?`Breeding ${Math.round((p.breed??0)*100)}%`:!this.room(p)?'Full · breeding paused':!p.keeperId?'Assign a keeper':`Needs ${B[p.kind==='coop'?'chicken':'pig'].feed} surplus feed · breeding pair protected`})),
   traps:this.f.traps.map(t=>({id:t.id,message:!this.nav.safe(t.x,t.z)?'Blocked · restore dry ground':t.phase==='planned'?'Waiting for trained trap setter':t.phase==='armed'?'Baited · waiting for a wild pig':t.phase==='caught'?'Pig caught · needs room in a pig pen':'Empty · add 1 food bait'})),
   hunters:s.settlers.map(w=>({id:w.id,skill:w.huntingSkill??0,training:this.f.training.includes(w.id),hunting:this.f.hunting.includes(w.id)}))};
 }
}
