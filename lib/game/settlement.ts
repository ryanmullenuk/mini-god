import { FIRE_BALANCE, evening, gatheringPoint } from './world-state';
import { FoodSystem, FOOD_JOBS, FOOD_LABELS } from './food-system';
import { TerrainMetadata } from './terrain-metadata';
import { Navigation } from './navigation';
import { FIRST_DRY_LAYER, desertWeight, type Terrain } from './terrain';
import { DAY_SECONDS, timeOfDay, newWorld, VILLAGE_BALANCE as V, homeCapacity, constructionCost, BUILD_COST, BUILD_LABEL, BUILD_TIME, ORDER_LIMIT, type BuildKind, type GuidanceKind, type BuildOrder, type GuidancePreview, type WorldState, type Point, type Settler, type JobKind,
  type Opportunity, type PrayerKind, type SettlementStatus } from './world-state';

export const SIM_STEP = .1;
export const POWER_COST = { rain: 8, bloom: 12 } as const;
const NAMES=['Aro','Mira','Tavi','Nala','Koa','Lani','Ivo','Suri','Rafi','Uma'];
const PRAYERS:Record<PrayerKind,{title:string;message:string;reward:number}>={
  shelter:{title:'A place to call home',message:'We need shelter. Leave a broad, flat terrace near our camp; we will gather wood and build.',reward:8},
  food:{title:'Our baskets are running low',message:'Help our fields thrive. We will forage while the next harvest grows.',reward:6},
  water:{title:'The fields are thirsty',message:'Rain would help our crops. Use the rain blessing, or wait for the next shower.',reward:6},
  ground:{title:'Help us find our footing',message:'Our land or route has changed. Shape a path beside the camp and buildings, with one-layer steps and room to stand between them.',reward:6},
};
export const plotBounds=(p:Point)=>({minX:p.x-1,maxX:p.x+1,minZ:p.z-1,maxZ:p.z+1});
export const workPoint=(p:Point)=>({x:p.x,z:p.z+1.65});
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);

export class Settlement {
  state:WorldState;
  readonly foodSystem:FoodSystem;
  readonly metadata:TerrainMetadata;
  readonly nav:Navigation;
  opportunities:Opportunity[]=[];
  private accumulator=0;
  private needDiscovery=true;
  private orderMessages=new Map<number,string>();

  constructor(readonly terrain:Terrain,state?:WorldState,createWaterWorker?:()=>Worker){
    this.state=state??newWorld();this.metadata=new TerrainMetadata(terrain,undefined,createWaterWorker);
    this.nav=new Navigation(terrain,(x,z)=>this.state.plots.some(p=>p.kind!=='farm'&&p.valid&&Math.abs(x-p.x)<1.32&&Math.abs(z-p.z)<1.32));
    this.foodSystem=new FoodSystem(()=>this.state,terrain,this.nav,(w,k,id,p)=>this.assign(w,k,id,p),w=>this.release(w));
  }
  private event(message:string){this.state.lastEvent=message;this.state.eventTime=this.state.time;}
  get naturalRaining(){return this.naturalRain();}
  get raining(){return this.state.rain>0||this.naturalRaining;}
  get capacity(){return this.state.plots.filter(p=>p.kind==='home'&&p.stage==='complete'&&p.valid).reduce((n,p)=>n+homeCapacity(p),0);}
  get storage(){return {food:V.campFood+this.state.plots.filter(p=>p.kind==='granary'&&p.stage==='complete'&&p.valid).length*V.granaryFood,wood:V.campWood+this.state.plots.filter(p=>p.kind==='storehouse'&&p.stage==='complete'&&p.valid).length*V.storehouseWood};}
  upgradeHome(id:number){
    const p=this.state.plots.find(p=>p.id===id);
    if(!p||p.kind!=='home'||p.stage!=='complete'||!p.valid||p.level===2||p.upgrading||this.state.wood<V.cottageWood)return false;
    if(!this.state.camp||!this.nav.route(this.state.camp,workPoint(p)))return false;
    this.state.wood-=V.cottageWood;p.upgrading=true;p.upgradeProgress=0;p.pendingWood=V.cottageWood;p.supplied=0;
    this.event('Cottage upgrade requested. Residents keep their shelter while followers deliver wood and build.');return true;
  }
  private deliveryPoint(w:Settler,id:number):Point|null{
    if(id===0)return this.state.camp;
    const p=this.state.plots.find(p=>p.id===id&&p.valid&&p.stage==='complete'&&(p.kind==='granary'&&w.cargo.food>0&&w.cargo.wood===0||p.kind==='storehouse'&&w.cargo.wood>0&&w.cargo.food===0));
    return p?workPoint(p):null;
  }
  private deliver(w:Settler){
    const cap=this.storage;
    if(w.cargo.food>0&&this.state.food>=cap.food||w.cargo.wood>0&&this.state.wood>=cap.wood)return false;
    const options=[{id:0},...this.state.plots].map(p=>({id:p.id,point:this.deliveryPoint(w,p.id)})).filter((p):p is {id:number;point:Point}=>!!p.point).sort((a,b)=>distance(w,a.point)-distance(w,b.point));
    for(const p of options){const route=this.nav.route(w,p.point);if(route){w.job={kind:'deliver',target:p.id,route,work:0};return true;}}
    return false;
  }
  private id(){return this.state.nextId++;}
  private random(){let n=this.state.seed;n^=n<<13;n^=n>>>17;n^=n<<5;this.state.seed=n>>>0;return this.state.seed/4294967296;}
  private fits(p:Point,ignoreOrder?:number){return ![...this.state.plots,...this.state.orders.filter(o=>o.id!==ignoreOrder)].some(b=>Math.abs(b.x-p.x)<2.8&&Math.abs(b.z-p.z)<2.8)&&
    (!this.state.camp||distance(p,this.state.camp)>2.9);}
  private physicalPlot(p:Point,kind:BuildKind){
    return this.metadata.assessPlot(kind==='farm'?'farm':'home',plotBounds(p),{reachable:true,unoccupied:true,freshWaterSupplied:true}).terrainSuitable;
  }
  private plannedNavigation(home?:Point){
    const homes:Point[]=[...this.state.plots.filter(p=>p.kind!=='farm'&&p.valid),...this.state.orders.filter(o=>o.kind!=='farm')];
    if(home)homes.push(home);
    return new Navigation(this.terrain,(x,z)=>homes.some(p=>Math.abs(x-p.x)<1.32&&Math.abs(z-p.z)<1.32));
  }
  guidancePreview(kind:GuidanceKind,point:Point,ignoreOrder?:number):GuidancePreview{
    if(kind==='fishing'||kind==='trap')return this.foodSystem.preview(kind,point);
    if(kind==='settle')return this.settlePreview(point);
    if(kind==='rally')return this.beaconPreview(point);
    if(kind==='rain'||kind==='bloom')return this.powerPreview(kind,point);
    const p={x:Math.round(point.x*2)/2,z:Math.round(point.z*2)/2},s=this.state;
    const result=(allowed:boolean,message:string):GuidancePreview=>({...p,kind,allowed,message,wood:BUILD_COST[kind]});
    if(!s.camp||!s.settlers.length)return result(false,'Invite followers before guiding a new building.');
    if(!ignoreOrder&&(s.orders.length>=ORDER_LIMIT||s.plots.length+s.orders.length>=40))return result(false,'Finish or withdraw a request before marking another site.');
    const assessment=this.metadata.assessPlot(kind==='farm'?'farm':'home',plotBounds(p),{reachable:true,unoccupied:true,freshWaterSupplied:true});
    if(!assessment.terrainSuitable){
      const reasons=assessment.blockers;
      return result(false,reasons.includes('submerged')?'Raise dry land here first.':reasons.includes('invalid-bounds')||reasons.includes('out-of-bounds')?'Choose a site on the island.':reasons.includes('uneven-terrain')||reasons.includes('insufficient-clearance')?'Make a broad, flat terrace for this site.':'Find greener, fertile ground for a farm.');
    }
    if(!this.fits(p,ignoreOrder))return result(false,'Leave room beside the camp, buildings and other requests.');
    if([...s.foodSystem.traps,...s.foodSystem.fishing].some(a=>distance(a,p)<2.5))return result(false,'Leave room around traps and fishing shores.');
    if(s.resources.some(n=>distance(n,p)<1.8))return result(false,'Leave room beside trees and forage bushes.');
    const neighbours=[...s.plots,...s.orders.filter(o=>o.id!==ignoreOrder)];
    if(kind!=='farm'&&neighbours.some(b=>this.insideSite(workPoint(b),p))||neighbours.some(b=>b.kind!=='farm'&&this.insideSite(workPoint(p),b)))return result(false,'Leave a passage to the neighbouring building.');
    const access=workPoint(p);
    if(!this.nav.route(s.camp,access)||!s.settlers.some(w=>!w.stranded&&this.nav.route(w,access)))return result(false,'Make a walkable path with single-layer steps to this site.');
    // A green site must remain reachable after planned huts become obstacles.
    // A follower standing on the site can leave it before construction starts.
    const planned=this.plannedNavigation(kind!=='farm'?p:undefined);
    if(!planned.route(s.camp,access)||!s.settlers.some(w=>!w.stranded&&(planned.route(w,access)||this.insideSite(w,p)&&this.nav.route(w,access))))return result(false,'Leave a path around the planned buildings to reach this entrance.');
    return result(true,`Mark a ${BUILD_LABEL[kind].toLowerCase()} here · ${BUILD_COST[kind]} wood${s.wood<BUILD_COST[kind]?' to gather':''}`);
  }
  guide(kind:GuidanceKind,p:Point):GuidancePreview{
    if(kind==='fishing'||kind==='trap')return this.foodSystem.guide(kind,p);
    if(kind==='settle'){const preview=this.settlePreview(p);if(preview.allowed){this.add(2,preview);return {...preview,message:'Your first followers have arrived at your chosen camp.'};}return preview;}
    if(kind==='rally')return this.gather(p);
    if(kind==='rain'||kind==='bloom'){const preview=this.powerPreview(kind,p);if(preview.allowed)this.power(kind,p);return preview;}
    const preview=this.guidancePreview(kind,p);if(!preview.allowed)return preview;
    const order={id:this.id(),kind,x:preview.x,z:preview.z};this.state.orders.push(order);
    this.needDiscovery=true;this.orderMessages.set(order.id,'Waiting for followers');
    const message=`Your followers will build a ${BUILD_LABEL[kind].toLowerCase()} at the marked site.`;this.event(message);
    return {...preview,message};
  }
  private availableFollowers(point:Point){
    return this.state.settlers.filter(w=>!w.stranded&&w.cargo.wood+w.cargo.food===0&&!w.cargo.animal&&!w.cargo.construction&&
      (!w.job||['wood','forage','rally'].includes(w.job.kind))).sort((a,b)=>distance(a,point)-distance(b,point)).slice(0,6);
  }
  private beaconPreview(point:Point):GuidancePreview{
    const p={x:Math.round(point.x*2)/2,z:Math.round(point.z*2)/2};
    const result=(allowed:boolean,message:string):GuidancePreview=>({...p,kind:'rally',wood:0,allowed,message});
    if(!this.state.settlers.length)return result(false,'Invite followers before placing a beacon.');
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||!this.nav.safe(p.x,p.z))return result(false,'Choose dry ground with room for followers to stand.');
    if(this.state.orders.some(o=>this.insideSite(p,o))||this.state.plots.some(o=>this.insideSite(p,o)))return result(false,'Leave room beside building sites and fields.');
    if(this.state.food<this.state.settlers.length*3)return result(false,'Your followers need food before gathering.');
    const followers=this.availableFollowers(p);
    if(!followers.length)return result(false,'Followers are building or carrying supplies. Let them finish first.');
    const reachable=followers.filter(w=>this.nav.route(w,p)).length;
    return result(true,reachable?`Gather up to ${followers.length} available followers here · Free`:'Place a beacon here, then sculpt single-layer steps so followers can reach it.');
  }
  private gather(p:Point){
    const preview=this.beaconPreview(p);if(!preview.allowed)return preview;
    const followers=this.availableFollowers(preview);this.dismissBeacon(false);
    const used:Point[]=[];
    const members=followers.map((w,i)=>{
      const a=i*Math.PI/3;
      const preferred={x:preview.x+Math.cos(a)*.9,z:preview.z+Math.sin(a)*.9};
      const destination=this.nav.safe(preferred.x,preferred.z)&&this.nav.segment(preview,preferred)&&!used.some(p=>distance(p,preferred)<.5)?preferred:{x:preview.x,z:preview.z};
      used.push(destination);this.release(w);
      return {id:w.id,destination,phase:'waiting' as const,arrivedAt:0};
    });
    this.state.beacon={x:preview.x,z:preview.z,id:this.id(),expires:this.state.time+90,members};
    for(const w of followers)this.rally(w);
    const message='A beacon calls your followers. They gather briefly, then return to village work.';
    this.event(message);return {...preview,message};
  }
  dismissBeacon(announce=true){
    if(!this.state.beacon)return false;
    for(const w of this.state.settlers)if(w.job?.kind==='rally')this.release(w);
    this.state.beacon=null;if(announce)this.event('The beacon fades. Followers return to village work.');return true;
  }
  private rally(w:Settler){
    const beacon=this.state.beacon,member=beacon?.members.find(m=>m.id===w.id);
    if(!beacon||!member||member.phase==='done')return false;
    if(this.state.food<this.state.settlers.length*3){member.phase='done';return false;}
    if(this.assign(w,'rally',beacon.id,member.destination)){member.phase='walking';return true;}
    member.phase='waiting';return false;
  }
  cancelOrder(id:number){
    const index=this.state.orders.findIndex(o=>o.id===id);if(index<0)return false;
    this.state.orders.splice(index,1);this.orderMessages.delete(id);this.needDiscovery=true;
    for(const w of this.state.settlers)if(w.job?.kind==='clear'&&w.job.target===id)this.release(w);
    this.event('The building request was withdrawn. No supplies were spent.');return true;
  }
  assignFarmer(plotId:number,workerId:number|null){
    const plot=this.state.plots.find(p=>p.id===plotId&&p.kind==='farm');
    if(!plot||workerId!==null&&!this.state.settlers.some(w=>w.id===workerId))return false;
    for(const p of this.state.plots)if(workerId!==null&&p.farmerId===workerId)p.farmerId=null;
    plot.farmerId=workerId;
    for(const w of this.state.settlers)if(w.job?.target===plotId&&['plant','harvest'].includes(w.job.kind)&&workerId!==null&&w.id!==workerId)this.release(w);
    this.event(workerId===null?'Any available follower can tend this field.':`${this.state.settlers.find(w=>w.id===workerId)!.name} will tend this field between other duties.`);
    return true;
  }
  private insideSite(w:Point,p:Point){return Math.abs(w.x-p.x)<1.65&&Math.abs(w.z-p.z)<1.65;}
  private stepAside(w:Settler,order:BuildOrder){
    const destinations=[{x:order.x,z:order.z+2.3},{x:order.x-2.3,z:order.z},{x:order.x+2.3,z:order.z},{x:order.x,z:order.z-2.3}].sort((a,b)=>distance(w,a)-distance(w,b));
    const planned=this.plannedNavigation();
    return destinations.some(p=>planned.route(p,workPoint(order))&&this.assign(w,'clear',order.id,p));
  }
  private processOrders(){
    for(const order of this.state.orders){
      const preview=this.guidancePreview(order.kind,order,order.id);
      this.orderMessages.set(order.id,preview.allowed?'Waiting for followers':preview.message);
      if(!preview.allowed)continue;
      const cost=BUILD_COST[order.kind];
      if(this.state.wood<cost){this.orderMessages.set(order.id,`Gathering wood · ${Math.floor(this.state.wood)}/${cost}`);break;}
      if(this.state.settlers.some(w=>this.insideSite(w,order))){this.orderMessages.set(order.id,'Followers are making room');break;}
      this.startPlot(order.kind,order,order.id);
      this.state.orders=this.state.orders.filter(o=>o.id!==order.id);this.orderMessages.delete(order.id);
      for(const w of this.state.settlers)if(w.job?.kind==='clear'&&w.job.target===order.id)this.release(w);
      break;
    }
  }
  discover(){
    this.opportunities=[];this.needDiscovery=false;
    const camp=this.state.camp;if(!camp||!this.nav.safe(camp.x,camp.z))return;
    const candidates:Point[]=[{x:camp.x+3,z:camp.z-2},{x:camp.x+2,z:camp.z+4},{x:camp.x+5,z:camp.z+4},{x:camp.x+3,z:camp.z+1}];
    const extra:Point[]=[];
    for(let z=-18;z<=18;z+=3)for(let x=-18;x<=18;x+=3)if(Math.hypot(x,z)>3)extra.push({x:camp.x+x,z:camp.z+z});
    extra.sort((a,b)=>distance(a,camp)-distance(b,camp));candidates.push(...extra);
    for(const p of candidates){
      if(this.opportunities.length>=24)break;
      if(!this.fits(p)||!this.nav.safe(p.x,p.z)||!this.physicalPlot(p,'home'))continue;
      const access=workPoint(p);if(!this.nav.route(camp,access))continue;
      const f=this.metadata.inspect(p.x,p.z);if(!f)continue;
      this.opportunities.push({...p,kind:'home',score:1/(1+distance(p,camp)*.08)});
      if(this.physicalPlot(p,'farm'))this.opportunities.push({...p,kind:'farm',score:f.fertilityEstimate/(1+distance(p,camp)*.035)});
    }
  }
  private settlePreview(point:Point):GuidancePreview{
    const p={x:Math.round(point.x*2)/2,z:Math.round(point.z*2)/2};
    const result=(allowed:boolean,message:string):GuidancePreview=>({...p,kind:'settle',wood:0,allowed,message});
    if(this.state.camp)return result(false,'Your village already has a camp.');
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||!this.physicalPlot(p,'farm')||!this.nav.safe(p.x,p.z))return result(false,'Choose a broad, flat grass terrace for your first camp.');
    // A real starting clearing, with space and reachable ground for supplies.
    for(const [dx,dz] of [[4,0],[-4,0],[0,4],[0,-4]])if(!this.nav.segment(p,{x:p.x+dx,z:p.z+dz}))return result(false,'Choose a wider clearing with room around your camp.');
    return result(true,'Settle here · Two followers will make this their home');
  }
  add(count=2,chosen?:Point){
    if(!this.state.camp){
      const start=chosen?{x:chosen.x,z:chosen.z}:this.nav.nearest({x:-5,z:3},45);if(!start){this.event('There is no safe dry ground yet. Raise a terrace for your settlers.');return 0;}
      this.state.camp=start;this.seedResources();this.discover();
    }
    const camp=this.state.camp;
    const added=Math.min(Math.max(0,Math.floor(count)),30-this.state.settlers.length);
    for(let k=0;k<added;k++){
      const i=this.state.settlers.length,p=this.nav.nearest({x:camp.x+(i%3-1)*.45,z:camp.z+(Math.floor(i/3)%3-1)*.45},2)??camp;
      this.state.settlers.push({...p,id:this.id(),name:NAMES[i%NAMES.length]+(i>=10?` ${Math.floor(i/10)+1}`:''),heading:0,moving:false,stranded:false,job:null,cargo:{wood:0,food:0,harvest:0}});
    }
    if(added){this.state.food+=this.state.settlers.length>2?added*6:0;this.event(`${added} settlers arrived. They will choose their own work.`);}
    return this.state.settlers.length;
  }
  private seedResources(){
    const camp=this.state.camp;if(!camp)return;
    // Stable seeded resources grow only where the original terrain supports them.
    for(let k=0;k<220&&this.state.resources.length<22;k++){
      const a=this.random()*Math.PI*2,r=5+this.random()*14,p={x:camp.x+Math.sin(a)*r,z:camp.z+Math.cos(a)*r};
      if(!this.nav.safe(p.x,p.z)||this.state.resources.some(n=>distance(n,p)<2.3)||!this.nav.route(camp,p))continue;
      const kind=this.state.resources.length%3===0?'forage':'wood',capacity=kind==='wood'?12:10;
      this.state.resources.push({...p,id:this.id(),kind,stock:capacity,capacity,regrowth:0,claimedBy:null,valid:true});
    }
  }
  private release(w:Settler){
    this.foodSystem.releaseClaims(w);
    if(w.job?.kind==='rally'){const member=this.state.beacon?.members.find(m=>m.id===w.id);if(member&&member.phase!=='done')member.phase='waiting';}
    for(const p of this.state.plots)if(p.claimedBy===w.id)p.claimedBy=null;
    for(const n of this.state.resources)if(n.claimedBy===w.id)n.claimedBy=null;
    w.job=null;w.moving=false;
  }
  terrainChanged(waterChanged=true,bounds?:{minX:number;maxX:number;minZ:number;maxZ:number}){
    if(waterChanged)this.metadata.invalidate();this.nav.invalidate();
    for(const p of this.state.plots)p.valid=this.physicalPlot(p,p.kind);
    for(const n of this.state.resources)n.valid=this.terrain.level(n.x,n.z)>=FIRST_DRY_LAYER&&this.nav.safe(n.x,n.z);
    this.nav.invalidate();
    const touches=(a:Point,b:Point=a)=>!bounds||Math.max(a.x,b.x)>=bounds.minX&&Math.min(a.x,b.x)<=bounds.maxX&&Math.max(a.z,b.z)>=bounds.minZ&&Math.min(a.z,b.z)<=bounds.maxZ;
    for(const w of this.state.settlers){
      // Full restoration keeps its conservative reset; local edits preserve jobs,
      // reservations and work progress unless their actual journey becomes unsafe.
      if(!bounds)this.release(w);
      else if(w.job){
        const target=this.target(w),plot=this.state.plots.find(p=>p.id===w.job!.target),resource=this.state.resources.find(n=>n.id===w.job!.target);
        let previous:Point=w,affected=touches(w)||!!target&&touches(target);
        for(const point of w.job.route){affected ||= touches(previous,point);previous=point;}
        if(!target||plot&&!plot.valid||resource&&!resource.valid)this.release(w);
        else if(affected){
          previous=w;let safe=this.nav.safe(w.x,w.z);
          for(const point of w.job.route){if(!this.nav.segment(previous,point)){safe=false;break;}previous=point;}
          if(!safe){const route=this.nav.route(w,target);if(route)w.job.route=route;else this.release(w);}
        }
      }
      // Recovery retains carried goods; storage changes only after a real return trip.
      if(!this.nav.safe(w.x,w.z)){
        const dry=this.nav.nearest(w,3);
        if(dry){w.x=dry.x;w.z=dry.z;w.stranded=false;}else w.stranded=true;
      }else w.stranded=false;
    }
    this.needDiscovery=true;
  }
  private reserve(kind:'home'|'farm'){
    const cost=BUILD_COST[kind];if(this.state.wood<cost||this.state.plots.length>=40)return;
    const options=this.opportunities.filter(p=>p.kind===kind&&this.fits(p)).sort((a,b)=>b.score-a.score);
    const p=options.find(p=>!this.state.settlers.some(w=>Math.abs(w.x-p.x)<1.65&&Math.abs(w.z-p.z)<1.65)&&
      !this.state.resources.some(n=>distance(n,p)<1.8)&&this.physicalPlot(p,kind)&&this.state.camp&&this.nav.route(this.state.camp,workPoint(p)));
    if(!p)return;
    this.startPlot(kind,p);
  }
  private startPlot(kind:BuildKind,p:Point,guidedId?:number){
    const f=this.metadata.inspect(p.x,p.z);if(!f)return;
    this.state.wood-=BUILD_COST[kind];
    this.state.plots.push({x:p.x,z:p.z,id:guidedId??this.id(),kind,guided:guidedId!==undefined,stage:'building',progress:0,valid:true,claimedBy:null,supplied:0,pendingWood:BUILD_COST[kind],
      moisture:.68,fertility:f.fertilityEstimate,crop:0,planted:false,harvests:0,
      ...((kind==='coop'||kind==='pigpen')?{stock:0,breed:0,fed:false,priority:'breed' as const,keeperId:null}:{}),
      ...(kind==='temple'?{offerings:0}:kind==='slaughterhouse'?{livestock:0,rearing:false,rearingProgress:0,processed:0}:{})});
    this.nav.invalidate();this.needDiscovery=true;
    // A new home is an obstacle. Replan existing journeys before moving again.
    for(const w of this.state.settlers)if(w.job){
      const target=this.target(w);const route=target?this.nav.route(w,target):null;
      if(route)w.job.route=route;else this.release(w);
    }
    this.event(guidedId!==undefined?`Your followers have begun the ${BUILD_LABEL[kind].toLowerCase()} you requested.`:kind==='home'?'The settlers found room for a home.':'The settlers marked out a rain-fed field.');
  }
  private target(w:Settler):Point|null{
    if(!w.job)return null;if(FOOD_JOBS.includes(w.job.kind as import('./world-state').FoodJob))return this.foodSystem.target(w);if(w.job.kind==='deliver')return this.deliveryPoint(w,w.job.target);
    if(w.job.kind==='supply'&&!w.cargo.construction)return this.state.camp;
    if(w.job.kind==='rally')return this.state.beacon?.members.find(m=>m.id===w.id)?.destination??null;
    if(w.job.kind==='gather'){const p=this.state.plots.find(p=>p.id===w.job!.target);return p?gatheringPoint(p,w.id):null;}
    if(w.job.kind==='clear')return w.job.route.at(-1)??w;
    if(w.job.kind==='wood'||w.job.kind==='forage')return this.state.resources.find(n=>n.id===w.job?.target)??null;
    const p=this.state.plots.find(p=>p.id===w.job?.target);return p?workPoint(p):null;
  }
  private assign(w:Settler,kind:JobKind,target:number,point:Point){
    const route=this.nav.route(w,point);if(!route)return false;
    w.job={kind,target,route,work:0};
    const p=this.state.plots.find(p=>p.id===target);if(p)p.claimedBy=w.id;
    const n=this.state.resources.find(n=>n.id===target);if(n)n.claimedBy=w.id;
    return true;
  }
  private resourceJob(w:Settler,kind:'wood'|'forage'){
    const nodes=this.state.resources.filter(n=>n.kind===kind&&n.valid&&n.stock>=1&&n.claimedBy===null).sort((a,b)=>distance(a,w)-distance(b,w));
    return nodes.some(n=>this.assign(w,kind,n.id,n));
  }
  private decide(w:Settler){
    if(w.stranded||w.job)return;
    if(w.cargo.construction){const p=this.state.plots.find(p=>p.id===w.cargo.construction!.site);if(p&&p.valid&&p.claimedBy===null)this.assign(w,'supply',p.id,workPoint(p));return;}
    if(w.cargo.animal){this.foodSystem.decide(w);return;}
    if(w.cargo.wood+w.cargo.food>0){this.deliver(w);return;}
    const hungry=this.state.food<this.state.settlers.length*3;
    if(hungry&&this.resourceJob(w,'forage'))return;
    const clearing=this.state.orders.find(o=>this.insideSite(w,o)&&this.state.wood>=BUILD_COST[o.kind]);
    if(clearing&&this.stepAside(w,clearing))return;
    if(this.rally(w))return;
    if(this.foodSystem.decide(w))return;
    const plots=this.state.plots.filter(p=>p.valid&&p.claimedBy===null).sort((a,b)=>Number(!!b.guided)-Number(!!a.guided)||a.id-b.id);
    const fields=plots.filter(p=>{const farmer=this.state.settlers.find(a=>a.id===p.farmerId);return !farmer||farmer.id===w.id||farmer.stranded||!this.nav.route(farmer,workPoint(p));});
    const ready=fields.filter(p=>p.kind==='farm'&&p.stage==='complete'&&p.planted&&p.crop>=1);
    for(const p of ready)if(this.assign(w,'harvest',p.id,workPoint(p)))return;
    for(const p of plots.filter(p=>p.stage==='building'||p.upgrading)){
      if((p.supplied??constructionCost(p))>=constructionCost(p)){if(this.assign(w,'build',p.id,workPoint(p)))return;}
      else if((p.pendingWood??0)>0&&this.state.camp&&this.nav.route(this.state.camp,workPoint(p))&&this.assign(w,'supply',p.id,this.state.camp))return;
    }
    for(const p of fields.filter(p=>p.kind==='farm'&&p.stage==='complete'&&!p.planted))if(this.assign(w,'plant',p.id,workPoint(p)))return;
    for(const p of plots.filter(p=>p.kind==='slaughterhouse'&&p.stage==='complete'&&(p.livestock??0)>2))if(this.assign(w,'butcher',p.id,workPoint(p)))return;
    const needsWood=this.state.orders.length>0||this.capacity<this.state.settlers.length||this.state.plots.filter(p=>p.kind==='farm'&&p.valid).length<Math.ceil(this.state.settlers.length/4);
    if((needsWood||this.state.wood<12)&&this.resourceJob(w,'wood'))return;
    if(!hungry&&evening(this.state.time)&&this.state.time-(w.lastGather??-FIRE_BALANCE.gatherCooldown)>=FIRE_BALANCE.gatherCooldown){
      for(const p of plots.filter(p=>p.kind==='bonfire'&&p.stage==='complete')){
        if(this.state.settlers.filter(a=>a.job?.kind==='gather'&&a.job.target===p.id).length>=FIRE_BALANCE.guests)continue;
        const route=this.nav.route(w,gatheringPoint(p,w.id));if(!route)continue;
        w.job={kind:'gather',target:p.id,route,work:0};w.lastGather=this.state.time;return;
      }
    }
    if(this.state.food<this.state.settlers.length*12&&this.resourceJob(w,'forage'))return;
    if(!hungry&&this.capacity>=this.state.settlers.length&&this.state.time-(w.lastWorship??-120)>=90)for(const p of plots.filter(p=>p.kind==='temple'&&p.stage==='complete'&&(p.offerings??0)<50))if(this.assign(w,'worship',p.id,workPoint(p)))return;
  }
  private walk(w:Settler,dt:number){
    const job=w.job;if(!job||!job.route.length)return;
    let left=dt*(this.state.food>0?1.05:.65);
    while(left>0&&job.route.length){
      const p=job.route[0],d=distance(w,p),step=Math.min(left,d);
      if(d<.001){job.route.shift();continue;}
      const next={x:w.x+(p.x-w.x)*step/d,z:w.z+(p.z-w.z)*step/d};
      if(!this.nav.segment(w,next)){this.release(w);return;}
      w.heading=Math.atan2(p.x-w.x,p.z-w.z);w.x=next.x;w.z=next.z;w.moving=true;left-=step;
      if(step>=d-.000001)job.route.shift();
    }
  }
  private work(w:Settler,dt:number){
    const job=w.job;if(!job||job.route.length)return;
    job.work+=dt;
    if(this.foodSystem.work(w,dt))return;
    if(job.kind==='gather'){
      const p=this.state.plots.find(p=>p.id===job.target);
      if(p)w.heading=Math.atan2(p.x-w.x,p.z-w.z);
      if(job.work>=FIRE_BALANCE.gatherSeconds)this.release(w);
      return;
    }
    if(job.kind==='rally'){
      const member=this.state.beacon?.members.find(m=>m.id===w.id);
      if(!member||distance(w,member.destination)>.2){this.release(w);return;}
      if(member.phase!=='arrived'){member.phase='arrived';member.arrivedAt=this.state.time;}
      if(this.state.time-member.arrivedAt>=5){member.phase='done';this.release(w);}
      return;
    }
    if(job.kind==='clear'){this.release(w);return;}
    if(job.kind==='deliver'){
      const point=this.deliveryPoint(w,job.target);if(!point||distance(w,point)>.2){this.release(w);return;}
      const cap=this.storage,food=Math.min(w.cargo.food,Math.max(0,cap.food-this.state.food)),wood=Math.min(w.cargo.wood,Math.max(0,cap.wood-this.state.wood)),harvest=Math.min(w.cargo.harvest,food);
      this.state.food+=food;this.state.wood+=wood;this.state.deliveredFood+=food;this.state.deliveredWood+=wood;this.state.harvestedFood+=harvest;
      w.cargo.food-=food;w.cargo.wood-=wood;w.cargo.harvest-=harvest;
      if(harvest>0)this.event('A harvest reached village storage. There is food to share.');
      this.release(w);return;
    }
    if(job.kind==='wood'||job.kind==='forage'){
      const n=this.state.resources.find(n=>n.id===job.target);
      if(!n||!n.valid||n.claimedBy!==w.id){this.release(w);return;}
      if(job.work<5)return;
      const amount=Math.min(job.kind==='wood'?3:4,Math.floor(n.stock));n.stock-=amount;
      if(job.kind==='wood')w.cargo.wood+=amount;else w.cargo.food+=amount;
      this.release(w);return;
    }
    const p=this.state.plots.find(p=>p.id===job.target);
    if(!p||!p.valid||p.claimedBy!==w.id){this.release(w);return;}
    if(job.kind==='supply'){
      if(w.cargo.construction){
        if(w.cargo.construction.site!==p.id||distance(w,workPoint(p))>.2){this.release(w);return;}
        p.supplied=(p.supplied??0)+w.cargo.construction.wood;delete w.cargo.construction;this.release(w);
      }else{
        if(!this.state.camp||distance(w,this.state.camp)>.2){this.release(w);return;}
        const route=this.nav.route(w,workPoint(p));if(!route){this.release(w);return;}
        const wood=Math.min(V.carryWood,p.pendingWood??0);if(wood<=0){this.release(w);return;}
        p.pendingWood=(p.pendingWood??0)-wood;w.cargo.construction={site:p.id,wood};job.route=route;job.work=0;
      }
      return;
    }
    if(job.kind==='build'){
      if((p.supplied??constructionCost(p))<constructionCost(p)){this.release(w);return;}
      w.heading=Math.atan2(p.x-w.x,p.z-w.z);
      if(p.upgrading){p.upgradeProgress=Math.min(1,(p.upgradeProgress??0)+dt/V.cottageSeconds);if(p.upgradeProgress>=1){p.level=2;p.upgrading=false;delete p.supplied;delete p.pendingWood;this.release(w);this.event('A cottage is ready. Six followers can shelter here.');}return;}
      p.progress=Math.min(1,p.progress+dt/BUILD_TIME[p.kind]);
      if(p.progress>=1){p.stage='complete';delete p.supplied;delete p.pendingWood;if(p.kind==='slaughterhouse')p.livestock=2;if(p.kind==='farm'&&!p.farmerId)p.farmerId=this.state.settlers.find(a=>!this.state.plots.some(f=>f.farmerId===a.id))?.id??null;this.release(w);this.event(p.kind==='torch'?'Your tiki torch is ready. It lights after dusk.':p.kind==='bonfire'?'Your bonfire is ready for evening gatherings.':p.kind==='home'?'A home is ready. Four settlers can shelter here.':p.kind==='farm'?'A field is ready for planting.':p.kind==='temple'?'The temple is ready. Cared-for followers will bring offerings.':p.kind==='coop'?'The chicken coop is ready. Assign a keeper to herd chickens to the coop.':p.kind==='pigpen'?'The pig pen is ready. Train a hunter and place traps.':p.kind==='granary'?'The granary is ready. Followers can deliver food here.':p.kind==='storehouse'?'The storehouse is ready. Followers can deliver wood here.':'The slaughterhouse is ready, with a breeding pair of goats.');}
    }else if(job.kind==='worship'&&job.work>=4){
      const offering=Math.min(2,50-(p.offerings??0));p.offerings=(p.offerings??0)+offering;w.lastWorship=this.state.time;this.release(w);this.event(`A follower left ${offering} faith at the temple. Collect its offerings.`);
    }else if(job.kind==='butcher'&&job.work>=8){
      if((p.livestock??0)>2){p.livestock=(p.livestock??0)-1;p.processed=(p.processed??0)+1;w.cargo.food+=10;}
      this.release(w);
    }else if(job.kind==='plant'&&job.work>=5){p.planted=true;p.crop=0;this.release(w);}
    else if(job.kind==='harvest'&&job.work>=5){
      const amount=Math.max(8,Math.round(20*p.fertility));p.crop=0;p.planted=false;p.harvests++;
      p.fertility=Math.max(.3,p.fertility-.025);w.cargo.food+=amount;w.cargo.harvest+=amount;this.release(w);
    }
  }
  private unmet(kind:PrayerKind){
    const s=this.state;if(!s.settlers.length)return false;
    if(kind==='shelter')return this.capacity<s.settlers.length;
    if(kind==='food')return s.food<s.settlers.length*3;
    if(kind==='water')return s.plots.some(p=>p.valid&&p.kind==='farm'&&p.planted&&p.moisture<.25);
    return s.settlers.some(w=>w.stranded)||(!!s.camp&&!this.nav.safe(s.camp.x,s.camp.z))||s.plots.some(p=>!p.valid);
  }
  private prayers(dt:number){
    const s=this.state;
    if(s.prayer){
      if(this.unmet(s.prayer.kind))s.prayer.settled=0;else s.prayer.settled+=dt;
      if(s.prayer.settled>=3){
        const spec=PRAYERS[s.prayer.kind];s.faith+=spec.reward;s.answered++;
        s.prayerCooldown[s.prayer.kind]=s.time+240;s.prayer=null;this.event(`A prayer was answered. +${spec.reward} faith.`);
      }
    }else for(const kind of ['ground','food','water','shelter'] as PrayerKind[]){
      if(this.unmet(kind)&&(s.prayerCooldown[kind]??0)<=s.time){s.prayer={id:this.id(),kind,opened:s.time,settled:0};break;}
    }
  }
  influenceAreas(){
    const s=this.state,bonus=Math.min(8,Math.min(this.capacity,s.settlers.length));
    return [...(s.camp?[{...s.camp,radius:18+bonus}]:[]),...s.plots.filter(p=>p.kind==='temple'&&p.valid&&p.stage==='complete').map(p=>({x:p.x,z:p.z,radius:18+bonus+(s.tier===2?6:0)}))];
  }
  private naturalRain(){
    const cycle=Math.floor(this.state.time/480),within=this.state.time-cycle*480;
    const random=(((Math.imul(cycle+17,1103515245)+12345)>>>0)/4294967296);
    const start=240+random*180,duration=16+random*12;
    return within>=start&&within<start+duration;
  }
  wetAt(_p:Point){return this.raining;}
  private powerPreview(kind:'rain'|'bloom',p:Point):GuidancePreview{
    const radius=this.state.tier===2?8:6;
    const result=(allowed:boolean,message:string):GuidancePreview=>({...p,kind,radius,wood:0,allowed,message});
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||this.metadata.inspect(p.x,p.z)?.submerged!==false)return result(false,'Choose dry land for this blessing.');
    if(!this.influenceAreas().some(a=>distance(a,p)+radius<=a.radius))return result(false,'Place the whole blessing inside your influence. Temples extend your reach.');
    if(this.state.faith<POWER_COST[kind])return result(false,`You need ${POWER_COST[kind]} faith for this blessing.`);
    if(kind==='rain')return result(true,`Island-wide rain · ${POWER_COST.rain} faith`);
    const fields=this.state.plots.filter(f=>f.kind==='farm'&&f.valid&&distance(p,f)<=radius).length;
    return result(true,`New growth · ${fields} fields · ${POWER_COST[kind]} faith`);
  }
  power(kind:'rain'|'bloom',point:Point|null=this.state.camp){
    if(!point||!this.powerPreview(kind,point).allowed)return false;
    const s=this.state,radius=s.tier===2?8:6;s.faith-=POWER_COST[kind];
    if(kind==='rain'){
      s.rain=18;s.rainArea=null;
      for(const p of s.plots)if(p.kind==='farm'&&p.valid)p.moisture=Math.min(1,p.moisture+.45);
      this.event('Rain falls across the island.');
    }else{
      s.blessing=12;
      for(const p of s.plots)if(p.kind==='farm'&&p.valid&&distance(p,point)<=radius){p.fertility=Math.min(1,p.fertility+.1);if(p.planted)p.crop=Math.min(1,p.crop+.15);}
      for(const n of s.resources)if(n.valid&&distance(n,point)<=radius)n.stock=Math.min(n.capacity,n.stock+3);
      this.event('New growth stirs where you placed your blessing.');
    }
    return true;
  }
  collectOfferings(){
    let collected=0;
    for(const p of this.state.plots)if(p.kind==='temple'&&p.valid&&p.stage==='complete'){
      const amount=Math.max(0,Math.min(p.offerings??0,Math.floor(500-this.state.faith)));
      p.offerings=(p.offerings??0)-amount;this.state.faith+=amount;collected+=amount;
    }
    if(collected)this.event(`Collected ${collected.toFixed(0)} faith from your temples.`);return collected;
  }
  advance(seconds:number,paused=false){
    if(paused||!Number.isFinite(seconds)||seconds<=0)return;
    this.accumulator+=Math.min(seconds,.5);
    while(this.accumulator+1e-9>=SIM_STEP){this.accumulator-=SIM_STEP;this.step(SIM_STEP);}
  }
  private step(dt:number){
    const s=this.state;s.tick++;s.time=s.tick*SIM_STEP;s.rain=Math.max(0,s.rain-dt);s.blessing=Math.max(0,s.blessing-dt);
    this.foodSystem.tick(dt);
    if(!s.settlers.length)return;
    if(s.beacon&&(s.time>=s.beacon.expires||s.beacon.members.every(m=>m.phase==='done')||s.food<s.settlers.length*3))this.dismissBeacon(false);
    const eaten=Math.min(s.food,s.settlers.length*.014*dt);s.food-=eaten;s.consumedFood+=eaten;
    if(this.capacity>=s.settlers.length&&s.food>s.settlers.length*3)s.faith=Math.min(500,s.faith+dt*s.settlers.length*.008);

    for(const n of s.resources)if(n.valid&&n.stock<n.capacity){
      n.regrowth+=dt*(this.raining&&n.kind==='wood'?2.5:this.raining?1.5:1);
      if(n.regrowth>=45){n.regrowth-=45;n.stock=Math.min(n.capacity,n.stock+1);}
    }
    for(const p of s.plots)if(p.kind==='farm'&&p.valid){
      p.moisture=Math.max(0,Math.min(1,p.moisture+dt*(this.wetAt(p)?.025:-(.0017+desertWeight(p.x,p.z)*.0015))));
      if(!p.planted)p.fertility=Math.min(.9,p.fertility+dt*.00008);
      if(p.stage==='complete'&&p.planted&&p.moisture>.08)p.crop=Math.min(1,p.crop+dt/65*p.fertility*(.3+.7*p.moisture));
    }
    for(const p of s.plots)if(p.kind==='slaughterhouse'&&p.valid&&p.stage==='complete'){
      if(!p.rearing&&(p.livestock??0)>=2&&(p.livestock??0)<4&&s.food>=s.settlers.length*3+4&&s.camp&&this.nav.route(s.camp,workPoint(p))){s.food-=4;s.consumedFood+=4;p.rearing=true;p.rearingProgress=0;}
      if(p.rearing){p.rearingProgress=Math.min(1,(p.rearingProgress??0)+dt/90);if(p.rearingProgress>=1){p.livestock=Math.min(4,(p.livestock??0)+1);p.rearing=false;p.rearingProgress=0;}}
    }
    if(s.tier===1&&s.harvestedFood>0&&s.plots.filter(p=>p.kind==='home'&&p.valid&&p.stage==='complete').length>=2&&s.plots.some(p=>p.kind==='temple'&&p.valid&&p.stage==='complete')){
      s.tier=2;this.event('Village tier 2 unlocked. Temple influence and targeted blessings now reach farther.');
    }
    if(s.tick%15===1){
      if(this.needDiscovery)this.discover();
      const homes=s.plots.filter(p=>p.kind==='home'&&p.valid).length;
      const farms=s.plots.filter(p=>p.kind==='farm'&&p.valid).length;
      const guided=s.orders.length>0;this.processOrders();
      if(!guided){
        if(homes<Math.ceil(s.settlers.length/4))this.reserve('home');
        else if(farms<Math.ceil(s.settlers.length/4))this.reserve('farm');
      }
      for(const w of s.settlers)this.decide(w);
    }
    for(const w of s.settlers){w.moving=false;if(w.job?.kind==='gather'&&(!evening(s.time)||s.food<s.settlers.length*3||s.orders.length>0||!s.plots.some(p=>p.id===w.job!.target&&p.valid&&p.stage==='complete')))this.release(w);if(w.stranded)continue;this.foodSystem.beforeWalk(w);this.walk(w,dt);this.work(w,dt);}
    this.prayers(dt);
  }
  private buildingMessage(p:WorldState['plots'][number]){
    if(!p.valid)return 'Restore flat ground beneath this building';
    const worker=this.state.settlers.find(w=>w.id===p.claimedBy);
    if((p.supplied??constructionCost(p))<constructionCost(p))return `${p.supplied??0}/${constructionCost(p)} wood delivered · ${worker?worker.name+' is hauling supplies':'Waiting for a carrier and a clear path from camp'}`;
    if(worker?.job?.kind==='build')return worker.job.route.length?`${worker.name} is walking to build`:`${worker.name} is building · ${Math.round((p.upgrading?p.upgradeProgress??0:p.progress)*100)}%`;
    if(!this.state.settlers.some(w=>!w.stranded&&this.nav.route(w,workPoint(p))))return 'Make a path with single-layer steps';
    return `Waiting for a builder · ${Math.round((p.upgrading?p.upgradeProgress??0:p.progress)*100)}%`;
  }
  status():SettlementStatus{
    const s=this.state,homes=s.plots.filter(p=>p.kind==='home'&&p.stage==='complete'&&p.valid).length;
    const farms=s.plots.filter(p=>p.kind==='farm'&&p.stage==='complete'&&p.valid).length;
    const labels:Record<JobKind,string>={...FOOD_LABELS,gather:'Gathering by the bonfire',supply:'Carrying construction wood',wood:'Gathering wood',forage:'Foraging',build:'Building',plant:'Planting',harvest:'Harvesting',deliver:'Bringing supplies home',clear:'Making room for your building',rally:'Following your beacon',worship:'Worshipping at the temple',butcher:'Preparing meat for the village'};
    const guidance=[...s.orders.map(o=>({id:o.id,kind:o.kind,message:this.orderMessages.get(o.id)??'Waiting for followers',cancellable:true,progress:null as number|null})),...s.plots.filter(p=>p.guided&&p.stage==='building').map(p=>({id:p.id,kind:p.kind,message:this.buildingMessage(p),cancellable:false,progress:p.progress}))];
    const completedHomes=s.plots.filter(p=>p.kind==='home'&&p.stage==='complete'&&p.valid);
    const buildings=s.plots.map(p=>{
      const offset=completedHomes.slice(0,completedHomes.indexOf(p)).reduce((n,h)=>n+homeCapacity(h),0);
      const residents=p.kind==='home'&&p.valid&&p.stage==='complete'?s.settlers.slice(offset,offset+homeCapacity(p)):[];
      const worker=s.settlers.find(w=>w.id===p.claimedBy);
      return {occupants:p.kind==='torch'?'Warm firelight at night':p.kind==='bonfire'?`${s.settlers.filter(w=>w.job?.kind==='gather'&&w.job.target===p.id).length}/6 gathering`:p.kind==='home'?`${residents.length}/${homeCapacity(p)} residents · ${residents.map(w=>w.name).join(', ')||'Room for new followers'}`:null,name:p.kind==='home'&&p.level===2?'Cottage':BUILD_LABEL[p.kind],upgrade:p.kind==='home'&&p.stage==='complete'&&p.level!==2?{allowed:!p.upgrading&&p.valid&&s.wood>=V.cottageWood&&!!s.camp&&!!this.nav.route(s.camp,workPoint(p)),message:p.upgrading?'Cottage upgrade in progress':`Upgrade to cottage · ${V.cottageWood} wood · 6 residents${s.wood<V.cottageWood?' · Gather more wood':!p.valid||!s.camp||!this.nav.route(s.camp,workPoint(p))?' · Restore a safe path':''}`}:null,workers:worker?`${worker.name} · ${worker.job?labels[worker.job.kind]:'Resting'}`:'No worker at this building',id:p.id,kind:p.kind,farmerId:p.farmerId??null,message:p.stage==='building'||p.upgrading||!p.valid?this.buildingMessage(p):p.kind==='torch'?'Warm firelight at night':p.kind==='bonfire'?`${s.settlers.filter(w=>w.job?.kind==='gather'&&w.job.target===p.id).length}/6 gathering`:p.kind==='home'?`${residents.length}/${homeCapacity(p)} sheltered`:p.kind==='granary'?`${Math.floor(s.food)}/${this.storage.food} food in shared village storage`:p.kind==='storehouse'?`${Math.floor(s.wood)}/${this.storage.wood} wood in shared village storage`:p.kind==='temple'?`${p.offerings??0} faith awaiting collection`:p.kind==='coop'||p.kind==='pigpen'?`${p.stock??0} ${p.kind==='coop'?'chickens':'pigs'}`:p.kind==='slaughterhouse'?`${p.livestock??0} goats · ${p.rearing?'Rearing livestock':'Needs surplus food to rear goats'}`:!p.planted?'Waiting for planting':p.crop>=1?'Ready to harvest':p.moisture<=.08?'Crops need rain':`Growing · ${Math.round(p.crop*100)}%`,
        detail:p.stage==='building'||p.upgrading?`${p.supplied??constructionCost(p)}/${constructionCost(p)} wood supplied · ${worker?worker.name:'No builder assigned'}`:p.kind==='torch'?'Lights automatically after dusk':p.kind==='bonfire'?'Up to 6 available followers gather here in the evening':p.kind==='home'?(residents.map(w=>w.name).join(', ')||'Room for new followers'):p.kind==='granary'||p.kind==='storehouse'?`Adds ${p.kind==='granary'?V.granaryFood+' food':V.storehouseWood+' wood'} capacity · Deliveries enter shared storage here`:p.kind==='temple'?(worker?`${worker.name} is visiting`:'Followers visit between duties when housed and fed'):p.kind==='coop'||p.kind==='pigpen'?'Manage keepers and breeding in Food & wildlife':p.kind==='slaughterhouse'?`${p.poultry??0} chickens + ${p.pork??0} pigs awaiting processing · Breeding pair protected · 4 feed → 10 food · ${p.processed??0} batches prepared`:`${p.farmerId?(s.settlers.find(w=>w.id===p.farmerId)?.name??'Farmer')+' tends this field · ':worker?worker.name+' · ':''}Water ${Math.round(p.moisture*100)}% · ${p.harvests} harvests`,
        progress:p.upgrading?p.upgradeProgress??0:p.stage==='building'?p.progress:p.kind==='farm'&&p.planted?p.crop:p.kind==='slaughterhouse'&&p.rearing?p.rearingProgress??0:null};
    });
    const beacon=s.beacon?{id:s.beacon.id,remaining:Math.ceil(s.beacon.expires-s.time),message:`${s.beacon.members.filter(m=>m.phase==='arrived'||m.phase==='done').length}/${s.beacon.members.length} gathered · ${s.beacon.members.some(m=>m.phase==='waiting')?'Some need a route: sculpt single-layer steps':'Following your light'}`} : null;
    return {storage:this.storage,foodSystem:this.foodSystem.status(),tier:s.tier,milestone:s.tier===2?'Tier 2 · Wider temple influence and blessings':`Tier 2: ${Math.min(2,homes)}/2 huts · ${s.harvestedFood>0?'1':'0'}/1 harvest delivered · ${s.plots.some(p=>p.kind==='temple'&&p.valid&&p.stage==='complete')?'1':'0'}/1 temple`,offerings:s.plots.filter(p=>p.kind==='temple'&&p.valid&&p.stage==='complete').reduce((n,p)=>n+(p.offerings??0),0),temples:s.plots.filter(p=>p.kind==='temple'&&p.valid&&p.stage==='complete').length,slaughterhouses:s.plots.filter(p=>p.kind==='slaughterhouse'&&p.valid&&p.stage==='complete').length,beacon,buildings,faithMessage:this.capacity<s.settlers.length?'Build shelter for everyone to earn steady faith.':s.food<=s.settlers.length*3?'Store more food to earn steady faith.':s.faith>=500?'Faith is full. Use a blessing to help your village.':`Your cared-for village earns ${(s.settlers.length*.008*60).toFixed(1)} faith per minute.`,population:s.settlers.length,sheltered:Math.min(this.capacity,s.settlers.length),homes,farms,
      food:Math.floor(s.food),wood:Math.floor(s.wood),faith:Math.floor(s.faith),day:Math.floor(s.time/DAY_SECONDS)+1,timeOfDay:timeOfDay(s.time),
      raining:this.raining,rain:s.rain,prayer:s.prayer?PRAYERS[s.prayer.kind]:null,
      objective:!s.settlers.length?'Invite two settlers to begin.':guidance.length?'Your followers are carrying out your guidance. Shape clear paths and keep them fed.':!homes?'Your settlers are gathering wood for shelter.':!farms?'A home is ready. Your settlers are preparing a field.':!s.harvestedFood?'Keep the fields watered until the first harvest.':'Your village is finding its rhythm. Make room for it to grow.',
      event:s.time-s.eventTime<18?s.lastEvent:'',workers:s.settlers.map(w=>({id:w.id,name:w.name,activity:w.job?.kind==='rally'?(w.job.route.length?'Walking to your beacon':'Gathered at your beacon'):s.beacon?.members.some(m=>m.id===w.id&&m.phase==='waiting')?'Beacon needs a path · working meanwhile':w.stranded?'Waiting for safe ground':w.job?labels[w.job.kind]:w.cargo.construction?'Construction cargo needs a safe route':w.cargo.food+w.cargo.wood>0?'Storage full or route blocked · carrying supplies':'Resting'})),
      harvestedFood:s.harvestedFood,answered:s.answered,opportunities:this.opportunities.length,guidance};
  }
}
