import { GRID, EXTENT, STEP, layerThreshold, mainlandHeight, archipelagoHeight, legacyArchipelagoHeight, naturalArchipelagoHeight, woodedArchipelagoHeight, mountainArchipelagoHeight, waterfallArchipelagoHeight, miniGodArchipelagoHeight, broadMainlandHeight, LAYER_COUNT, scalarLevel } from './terrain';
import { validFoodSave } from './food-save';
import { FOOD_JOBS } from './food-system';
import { newFoodState, ORDER_LIMIT, VILLAGE_BALANCE as V, constructionCost, type WorldState } from './world-state';

export const SAVE_KEY='tide.living-island.v1';
export type IslandSave={format:'tide-island';version:18;savedAt:string;terrain:number[];world:WorldState;migratedFrom?:1;archipelagoUpgraded?:boolean};
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const finite=(v:unknown,min=-1e6,max=1e6):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min=0,max=1e9):v is number=>finite(v,min,max)&&Number.isInteger(v);
const point=(v:unknown)=>record(v)&&finite(v.x,-EXTENT/2,EXTENT/2)&&finite(v.z,-EXTENT/2,EXTENT/2);
function fail():never{throw new Error('This file is not a valid Mini God island save. Your current island has been kept.');}

const HEIGHT_SCALE=1000;
/** Little-endian Int16, with boundary-aware rounding so a stored sample never
 * changes its terrace. The payload is portable between browser architectures. */
export function encodeTerrain(terrain:Float32Array){
  if(terrain.length!==GRID*GRID)fail();
  const bytes=new Uint8Array(terrain.length*2),view=new DataView(bytes.buffer);
  for(let i=0;i<terrain.length;i++){
    const value=terrain[i];if(!finite(value,-2,.5+(LAYER_COUNT-1)*.5+.351))fail();
    let q=Math.round(value*HEIGHT_SCALE);
    const level=scalarLevel(value),rounded=scalarLevel(q/HEIGHT_SCALE);
    if(rounded>level)q--;else if(rounded<level)q++;
    view.setInt16(i*2,q,true);
  }
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
function decodeTerrain(encoded:string){
  if(encoded.length!==Math.ceil(GRID*GRID*2/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))fail();
  let binary:string;try{binary=atob(encoded);}catch{fail();}
  if(binary.length!==GRID*GRID*2)fail();
  const values=new Array<number>(GRID*GRID);
  for(let i=0;i<values.length;i++){
    const q=binary.charCodeAt(i*2)|(binary.charCodeAt(i*2+1)<<8);
    values[i]=Math.fround((q>=32768?q-65536:q)/HEIGHT_SCALE);
  }
  return values;
}
function encodedSave(terrain:string,world:WorldState){
  return JSON.stringify({format:'tide-island',version:18,savedAt:new Date().toISOString(),terrain,world});
}
export function encodeSave(terrain:Float32Array,world:WorldState){return encodedSave(encodeTerrain(terrain),world);}
/** Revision is advanced by every edit, undo, import and touch rollback. */
export function createSaveEncoder(){
  let last:Float32Array|undefined,revision=-1,encoded='';
  return (terrain:Float32Array,world:WorldState,nextRevision:number)=>{
    if(last!==terrain||revision!==nextRevision){encoded=encodeTerrain(terrain);last=terrain;revision=nextRevision;}
    return encodedSave(encoded,world);
  };
}
export function decodeSave(raw:string):IslandSave{
  if(raw.length>8_000_000)fail();
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{fail();}
  if(record(parsed)&&parsed.version===18){if(typeof parsed.terrain!=='string')fail();parsed.terrain=decodeTerrain(parsed.terrain);}
  if(!record(parsed)||parsed.format!=='tide-island'||![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].includes(parsed.version as number)||typeof parsed.savedAt!=='string'||!Array.isArray(parsed.terrain)||!(parsed.terrain.length===GRID*GRID||(parsed.version as number)<6&&parsed.terrain.length===200*200)||!parsed.terrain.every(v=>finite(v,-2,.5+(LAYER_COUNT-1)*.5+.351))||!record(parsed.world))return fail();
  if(parsed.terrain.length===200*200){
    const expanded=Array.from({length:GRID*GRID},()=>-2),offset=(GRID-200)/2;
    for(let j=0;j<200;j++)for(let i=0;i<200;i++)expanded[(j+offset)*GRID+i+offset]=parsed.terrain[j*200+i];
    parsed.terrain=expanded;
  }
  const s=parsed.world;
  if((parsed.version as number)<7)s.foodSystem=newFoodState();
  if((parsed.version as number)<3)s.orders=[];
  if((parsed.version as number)<4)s.beacon=null;
  if((parsed.version as number)<5){s.tier=1;s.rainArea=null;}
  if(!Array.isArray(s.fishSchools))s.fishSchools=[];
  if(![1,2].includes(s.tier as number)||!(s.rainArea===null||point(s.rainArea)&&record(s.rainArea)&&finite(s.rainArea.radius,1,116)))fail();
  if(s.version!==1||!integer(s.tick,0,1e10)||!integer(s.nextId,1)||!integer(s.seed,0,4294967295)||!finite(s.time,0,1e9)||Math.abs(s.time-s.tick*.1)>.001||!(s.camp===null||point(s.camp)))return fail();
  for(const key of ['food','wood','faith','rain','blessing','answered','deliveredFood','deliveredWood','harvestedFood','consumedFood','eventTime'])if(!finite(s[key],0,1e9))fail();
  if(typeof s.lastEvent!=='string'||s.lastEvent.length>500||!record(s.prayerCooldown))return fail();
  for(const [key,value] of Object.entries(s.prayerCooldown))if(!['shelter','food','water','ground'].includes(key)||!finite(value,0,1e9))fail();
  const groups=[['settlers',V.maxPopulation],['plots',40],['resources',60],['trails',5000],['fishSchools',8],['orders',ORDER_LIMIT]] as const;
  for(const [key,max] of groups)if(!Array.isArray(s[key])||(s[key] as unknown[]).length>max)return fail();
  const settlers=s.settlers as unknown[],plots=s.plots as unknown[],resources=s.resources as unknown[],trails=s.trails as unknown[],fishSchools=s.fishSchools as unknown[],orders=s.orders as unknown[];
  for(const entry of plots)if(record(entry)&&entry.kind==='dock'){
    if(entry.boatFish===undefined)entry.boatFish=0;
    if(!Array.isArray(entry.boats))entry.boats=entry.boatState&&entry.boatState!=='none'?[{state:entry.boatState,progress:entry.boatProgress??0,returnAt:entry.boatReturnAt??0,departAt:entry.boatDepartAt??0,trips:entry.boatTrips??0,fish:entry.boatFish??0,targetX:entry.boatTargetX,targetZ:entry.boatTargetZ,schoolId:entry.boatSchoolId}]:[];
  }
  if(plots.length+orders.length>40||orders.length>0&&!settlers.length)fail();
  const ids=new Set<number>(),workerIds=new Set<number>();
  for(const entry of [...settlers,...plots,...resources,...orders]){
    if(!record(entry)||!point(entry)||!integer(entry.id,1)||entry.id>=s.nextId||ids.has(entry.id))return fail();
    ids.add(entry.id);
  }
  for(const order of orders){
    if(!record(order)||!['home','farm','dock','temple','slaughterhouse','coop','pigpen','granary','storehouse','torch','bonfire'].includes(order.kind as string)||!finite(order.x,-EXTENT/2+2,EXTENT/2-2)||!finite(order.z,-EXTENT/2+2,EXTENT/2-2)||!Number.isInteger(order.x*2)||!Number.isInteger(order.z*2))fail();
    if(order.rotation!==undefined&&!finite(order.rotation,-Math.PI*2,Math.PI*2))fail();
  }
  for(const w of settlers){
    if(!record(w)||!integer(w.id,1)||typeof w.name!=='string'||w.name.length>40||!finite(w.heading)||typeof w.moving!=='boolean'||typeof w.stranded!=='boolean'||!record(w.cargo))return fail();
    if(w.lastGather!==undefined&&!finite(w.lastGather,0,s.time))fail();
    if(w.lastWorship!==undefined&&!finite(w.lastWorship,0,s.time))fail();
    workerIds.add(w.id);
    for(const key of ['wood','food','harvest'])if(!finite(w.cargo[key],0,1000))fail();
    if((w.cargo.harvest as number)>(w.cargo.food as number))fail();
    if(w.cargo.boatFish!==undefined&&(!finite(w.cargo.boatFish,0,20)||(w.cargo.boatFish as number)>(w.cargo.food as number)))fail();
    if(w.job!==null){
      const j=w.job;if(!record(j)||![...FOOD_JOBS,'wood','forage','build','plant','harvest','deliver','unload-boat','clear','rally','worship','butcher','supply','gather'].includes(j.kind as string)||!integer(j.target)||!finite(j.work,0,1e6)||!Array.isArray(j.route)||j.route.length>40000||!j.route.every(point))fail();
    }
  }
  if(s.beacon!==null){
    const b=s.beacon;
    if(!record(b)||!point(b)||!integer(b.id,1)||b.id>=s.nextId||ids.has(b.id)||!finite(b.expires,s.time,s.time+90.001)||!Array.isArray(b.members)||!b.members.length||b.members.length>6)fail();
    const memberIds=new Set<number>();
    for(const m of b.members){
      if(!record(m)||!integer(m.id,1)||!workerIds.has(m.id)||memberIds.has(m.id)||!point(m.destination)||!['waiting','walking','arrived','done'].includes(m.phase as string)||!finite(m.arrivedAt,0,s.time))fail();
      if(['walking','arrived'].includes(m.phase as string)){const worker=(settlers as Record<string,unknown>[]).find(w=>w.id===m.id);if(!worker||!record(worker.job)||worker.job.kind!=='rally'||worker.job.target!==b.id)fail();}
      memberIds.add(m.id);
    }
  }
  for(const p of plots){
    if(!record(p)||!['home','farm','dock','temple','slaughterhouse','coop','pigpen','granary','storehouse','torch','bonfire'].includes(p.kind as string)||!['building','complete'].includes(p.stage as string)||!finite(p.progress,0,1)||!finite(p.moisture,0,1)||!finite(p.fertility,0,1)||!finite(p.crop,0,1)||!integer(p.harvests)||typeof p.valid!=='boolean'||typeof p.planted!=='boolean'||!(p.claimedBy===null||workerIds.has(p.claimedBy as number)))return fail();
    if(p.rotation!==undefined&&!finite(p.rotation,-Math.PI*2,Math.PI*2))fail();
    if(p.kind==='dock'&&(!['none','building','at-sea','docked'].includes(p.boatState as string)||!finite(p.boatProgress,0,1)||!integer(p.boatTrips)||!integer(p.boatFish,0,20)||!Array.isArray(p.boats)||p.boats.length>5))fail();
    if(p.kind==='dock')for(const boat of p.boats as unknown[]){if(!record(boat)||!['building','at-sea','docked'].includes(boat.state as string)||!finite(boat.progress,0,1)||!finite(boat.returnAt,0,1e9)||!finite(boat.departAt,0,s.time)||boat.arriveAt!==undefined&&!finite(boat.arriveAt,0,1e9)||boat.fishUntil!==undefined&&!finite(boat.fishUntil,0,1e9)||!integer(boat.trips)||!integer(boat.fish,0,20)||boat.targetX!==undefined&&!finite(boat.targetX,-EXTENT/2,EXTENT/2)||boat.targetZ!==undefined&&!finite(boat.targetZ,-EXTENT/2,EXTENT/2)||boat.launchX!==undefined&&!finite(boat.launchX,-EXTENT/2,EXTENT/2)||boat.launchZ!==undefined&&!finite(boat.launchZ,-EXTENT/2,EXTENT/2)||boat.schoolId!==undefined&&!integer(boat.schoolId,1,8))fail();}
    if(p.kind==='temple'&&!integer(p.offerings,0,50))fail();
    if(p.kind==='slaughterhouse'&&(!integer(p.livestock,p.stage==='complete'?2:0,4)||typeof p.rearing!=='boolean'||!finite(p.rearingProgress,0,1)||!integer(p.processed)))fail();
    if(p.farmerId!==undefined&&p.farmerId!==null&&(p.kind!=='farm'||!workerIds.has(p.farmerId as number)))fail();
    if(p.level!==undefined&&(p.kind!=='home'||![1,2].includes(p.level as number)))fail();
    if(p.upgrading!==undefined&&(p.kind!=='home'||typeof p.upgrading!=='boolean'))fail();
    if(p.upgrading&&(p.stage!=='complete'||p.level===2))fail();
    if(p.upgradeProgress!==undefined&&!finite(p.upgradeProgress,0,1))fail();
    if(p.upgrading&&(!finite(p.upgradeProgress,0,1)||p.supplied===undefined||p.pendingWood===undefined))fail();
    if(p.supplied!==undefined||p.pendingWood!==undefined){
      const cost=constructionCost(p as unknown as WorldState['plots'][number]);
      if(!integer(p.supplied,0,cost)||!integer(p.pendingWood,0,cost)||(p.supplied as number)+(p.pendingWood as number)>cost||p.stage!=='building'&&!p.upgrading)fail();
    }
    if(p.guided!==undefined&&typeof p.guided!=='boolean')fail();
  }
  const farmers=(plots as Record<string,unknown>[]).map(p=>p.farmerId).filter(id=>id!==undefined&&id!==null);if(new Set(farmers).size!==farmers.length)fail();
  for(const n of resources){
    if(!record(n)||!['wood','forage'].includes(n.kind as string)||!finite(n.capacity,1,1000)||!finite(n.stock,0,n.capacity as number)||!finite(n.regrowth,0,1e6)||typeof n.valid!=='boolean'||!(n.claimedBy===null||workerIds.has(n.claimedBy as number)))return fail();
  }
  for(const t of trails)if(!record(t)||!point(t)||!finite(t.wear,0,1))fail();
  const schoolIds=new Set<number>();for(const f of fishSchools){if(!record(f)||!point(f)||!integer(f.id,1,8)||schoolIds.has(f.id)||!integer(f.visits,0,10)||!finite(f.regenAt,0,1e9))fail();schoolIds.add(f.id);}
  if(s.prayer!==null){
    const p=s.prayer;if(!record(p)||!integer(p.id,1)||!['shelter','food','water','ground'].includes(p.kind as string)||!finite(p.opened,0,1e9)||!finite(p.settled,0,3))return fail();
  }
  if(settlers.length>0&&s.camp===null)fail();
  if((parsed.version as number)<8&&record(s.foodSystem)&&Array.isArray(s.foodSystem.animals)){
   s.foodSystem.animals.filter(a=>record(a)&&a.species==='pig'&&a.alive===true).forEach((a,i)=>{if(i%3===2&&record(a))a.age=0;});
  }
  if(!validFoodSave(s as unknown as WorldState))fail();
  // Validate claims and job targets together, so a restore cannot duplicate work.
  for(const w of settlers){
    const worker=w as Record<string,unknown>,job=worker.job as Record<string,unknown>|null;if(!job)continue;
    if(FOOD_JOBS.includes(job.kind as import('./world-state').FoodJob))continue;
    if(job.kind==='deliver'){if(job.target!==0&&!plots.some(v=>{const p=v as Record<string,unknown>;return p.id===job.target&&p.stage==='complete'&&['granary','storehouse'].includes(p.kind as string);}))fail();continue;}
    if(job.kind==='rally'){
      const b=s.beacon;if(!record(b)||job.target!==b.id||!(b.members as Record<string,unknown>[]).some(m=>m.id===worker.id&&['walking','arrived'].includes(m.phase as string)))fail();continue;
    }
    if(job.kind==='gather'){if(!plots.some(v=>{const p=v as Record<string,unknown>;return p.id===job.target&&p.kind==='bonfire'&&p.stage==='complete'&&p.valid;}))fail();continue;}
    if(job.kind==='clear'){if(!orders.some(o=>(o as Record<string,unknown>).id===job.target))fail();continue;}
    const list=job.kind==='wood'||job.kind==='forage'?resources:plots;
    const target=list.find(v=>(v as Record<string,unknown>).id===job.target) as Record<string,unknown>|undefined;
    if(!target)fail();
    if(job.kind==='unload-boat'){if(target.kind!=='dock'||target.stage!=='complete'||!Array.isArray(target.boats)||!integer(job.destination,0,4)||!record(target.boats[job.destination as number])||target.boats[job.destination as number].state!=='docked')fail();continue;}
    if(target.claimedBy!==worker.id)fail();
    if((job.kind==='wood'||job.kind==='forage')&&target.kind!==job.kind)fail();
    if(job.kind==='worship'&&(target.kind!=='temple'||target.stage!=='complete'))fail();
    if(job.kind==='butcher'&&(target.kind!=='slaughterhouse'||target.stage!=='complete'))fail();
    if((job.kind==='build'||job.kind==='supply')&&target.stage!=='building'&&!target.upgrading&&!(job.kind==='build'&&target.kind==='dock'&&Array.isArray(target.boats)&&target.boats.some(b=>record(b)&&b.state==='building')))fail();
    if((job.kind==='plant'||job.kind==='harvest')&&(target.kind!=='farm'||target.stage!=='complete'))fail();
  }
  for(const n of [...plots,...resources]){
    const target=n as Record<string,unknown>;if(target.claimedBy===null)continue;
    const worker=settlers.find(w=>(w as Record<string,unknown>).id===target.claimedBy) as Record<string,unknown>|undefined;
    if(!worker||!record(worker.job)||worker.job.target!==target.id)fail();
  }
  for(const worker of settlers){
    const w=worker as unknown as WorldState['settlers'][number],c=w.cargo.construction;if(c===undefined)continue;
    if(!record(c)||!integer(c.site,1)||!integer(c.wood,1,V.carryWood)||w.cargo.food+w.cargo.wood>0||w.cargo.animal||w.job&&(w.job.kind!=='supply'||w.job.target!==c.site))fail();
    if(!plots.some(v=>(v as Record<string,unknown>).id===c.site))fail();
  }
  for(const entry of plots){
    const p=entry as unknown as WorldState['plots'][number];
    const carried=(settlers as WorldState['settlers']).reduce((n,w)=>n+(w.cargo.construction?.site===p.id?w.cargo.construction.wood:0),0);
    if(p.supplied!==undefined){if(p.supplied+(p.pendingWood??0)+carried!==constructionCost(p))fail();}
    else if(carried>0)fail();
  }
  const save=parsed as unknown as IslandSave;
  // A new contour through an old flat plot must not split an existing home or
  // field. Preserve its foundation on the lower of the two new terraces. The
  // original scalar units, shoreline, supplies, crops and construction survive.
  if(parsed.version===1){
    const original=save.terrain.slice();
    const sample=(x:number,z:number)=>{
      const gx=(x+EXTENT/2)/STEP-.5,gz=(z+EXTENT/2)/STEP-.5,i=Math.floor(gx),j=Math.floor(gz);
      if(i<0||j<0||i>=GRID-1||j>=GRID-1)return -2;
      const a=gx-i,b=gz-j;
      return original[j*GRID+i]*(1-a)*(1-b)+original[j*GRID+i+1]*a*(1-b)+original[(j+1)*GRID+i]*(1-a)*b+original[(j+1)*GRID+i+1]*a*b;
    };
    for(const p of save.world.plots){
      if(!p.valid)continue;
      const oldLevel=Math.min(9,Math.floor(sample(p.x,p.z)-.5));
      if(oldLevel<3)continue;
      const pad=1+.33+STEP;
      for(let j=Math.max(1,Math.floor((p.z-pad+EXTENT/2)/STEP));j<GRID-1&&(j+.5)*STEP-EXTENT/2<=p.z+pad;j++){
        for(let i=Math.max(1,Math.floor((p.x-pad+EXTENT/2)/STEP));i<GRID-1&&(i+.5)*STEP-EXTENT/2<=p.x+pad;i++){
          const k=j*GRID+i;
          if(Math.min(9,Math.floor(original[k]-.5))===oldLevel)save.terrain[k]=layerThreshold(oldLevel*2)+.25;
        }
      }
    }
    save.migratedFrom=1;
  }else delete save.migratedFrom;
  delete save.archipelagoUpgraded;
  if((parsed.version as number)<17){
    // Upgrade untouched terrain only. Protect inhabited ground, work routes,
    // fishing water and sculpted samples; no crops, cargo or fauna are recreated.
    const protectedCells=new Uint8Array(GRID*GRID);
    const protect=(p:{x:number;z:number},radius:number)=>{
      const cx=Math.floor((p.x+EXTENT/2)/STEP),cz=Math.floor((p.z+EXTENT/2)/STEP),r=Math.ceil(radius/STEP);
      for(let z=Math.max(0,cz-r);z<=Math.min(GRID-1,cz+r);z++)for(let x=Math.max(0,cx-r);x<=Math.min(GRID-1,cx+r);x++)protectedCells[z*GRID+x]=1;
    };
    const w=save.world;if(w.camp)protect(w.camp,18);
    for(const p of [...w.plots,...w.orders])protect(p,8);
    for(const p of [...w.resources,...w.trails,...w.foodSystem.traps,...w.foodSystem.animals])protect(p,3);
    for(const a of w.foodSystem.fishing){protect(a,7);protect(a.water,9);}
    for(const follower of w.settlers){protect(follower,4);for(const p of follower.job?.route??[])protect(p,2);}
    // Keep a buffer around sculpted cells too, so an edit's immediate shoreline
    // and terrace edges are preserved, not merely its central samples.
    for(let z=1;z<GRID-1;z++)for(let x=1;x<GRID-1;x++){
      const wx=(x+.5)*STEP-EXTENT/2,wz=(z+.5)*STEP-EXTENT/2,k=z*GRID+x;
      if(Math.abs(save.terrain[k]-Math.fround((parsed.version===16?broadMainlandHeight:parsed.version===15?miniGodArchipelagoHeight:parsed.version===14?waterfallArchipelagoHeight:parsed.version===13?mountainArchipelagoHeight:(parsed.version as number)>=11?woodedArchipelagoHeight:parsed.version===10?naturalArchipelagoHeight:parsed.version===9?legacyArchipelagoHeight:mainlandHeight)(wx,wz)))>.00001){
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)protectedCells[k+dz*GRID+dx]=1;
      }
    }
    for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
      const k=z*GRID+x;if(protectedCells[k])continue;
      const wx=(x+.5)*STEP-EXTENT/2,wz=(z+.5)*STEP-EXTENT/2;
      const next=Math.fround(archipelagoHeight(wx,wz));
      if(Math.abs(next-save.terrain[k])>.00001){save.terrain[k]=next;save.archipelagoUpgraded=true;}
    }
  }
  save.version=18;
  return save;
}
