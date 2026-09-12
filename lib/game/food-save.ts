import {FOOD_BALANCE as B} from './food-balance';
import {FOOD_JOBS} from './food-system';
import {EXTENT} from './terrain';
import type {FoodJob,WorldState} from './world-state';
const number=(n:unknown,min=0,max=1e9):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const integer=(n:unknown,min=0,max=1e9)=>number(n,min,max)&&Number.isInteger(n);
const point=(p:{x:number;z:number})=>!!p&&number(p.x,-EXTENT/2,EXTENT/2)&&number(p.z,-EXTENT/2,EXTENT/2);
/** Additional cross-record validation; base world fields are checked by save.ts. */
export function validFoodSave(s:WorldState){try{
 const f=s.foodSystem;if(!f||typeof f.initialized!=='boolean'||!integer(f.seed,0,4294967295))return false;
 if(!Array.isArray(f.animals)||f.animals.length>18||!Array.isArray(f.fishing)||f.fishing.length>B.fishing.maxAreas||!Array.isArray(f.traps)||f.traps.length>B.trap.max||!Array.isArray(f.training)||!Array.isArray(f.hunting))return false;
 const all=[...f.animals,...f.fishing,...f.traps],workers=new Set(s.settlers.map(w=>w.id)),ids=new Set([...s.settlers,...s.plots,...s.resources,...s.orders].map(p=>p.id));
 for(const a of all){if(!point(a)||!integer(a.id,1)||a.id>=s.nextId||ids.has(a.id)||!(a.claimedBy===null||workers.has(a.claimedBy)))return false;ids.add(a.id);}
 if(s.beacon&&ids.has(s.beacon.id))return false;
 if(!f.initialized&&all.length)return false;
 for(const a of f.animals)if(a.age!==undefined&&!number(a.age,0,B.herd.pigMaturity)||!['pig','chicken'].includes(a.species)||typeof a.alive!=='boolean'||!number(a.heading,-100,100)||!number(a.timer,-1,20)||!(a.goal===null||point(a.goal))||!a.alive&&a.claimedBy!==null)return false;
 for(const a of f.fishing)if(!point(a.water)||!integer(a.stock,0,B.fishing.capacity)||!number(a.recovery,0,B.fishing.recoverySeconds)||!(a.workerId===null||workers.has(a.workerId)))return false;
 for(const a of f.traps)if(!['planned','armed','caught','empty'].includes(a.phase))return false;
 for(const list of [f.training,f.hunting])if(list.length>30||new Set(list).size!==list.length||list.some(id=>!workers.has(id)))return false;
 const roles=[...f.fishing.map(a=>a.workerId),...s.plots.map(p=>p.keeperId)].filter(n=>n!=null);if(new Set(roles).size!==roles.length)return false;
 for(const p of s.plots){
  if(p.young!==undefined&&(!Array.isArray(p.young)||p.kind!=='pigpen'||p.young.length>(p.stock??0)||p.young.some(age=>!number(age,0,B.herd.pigMaturity))))return false;
  if(p.kind==='coop'||p.kind==='pigpen'){
   const cap=B[p.kind==='coop'?'chicken':'pig'].capacity;
   if(!integer(p.stock,0,cap)||!number(p.breed,0,1)||typeof p.fed!=='boolean'||!['breed','food'].includes(p.priority!)||!(p.keeperId===null||workers.has(p.keeperId!)))return false;
   if(p.stage==='building'&&p.stock!==0||!p.fed&&p.breed!==0)return false;
  }
  if(p.kind==='slaughterhouse'&&(!integer(p.poultry??0,0,12)||!integer(p.pork??0,0,12)||(p.poultry??0)+(p.pork??0)>12))return false;
 }
 for(const w of s.settlers){
  if(!number(w.huntingSkill??0,0,1)||w.weapon!==undefined&&typeof w.weapon!=='boolean'||!!w.weapon!==((w.huntingSkill??0)>=1))return false;
  if(f.training.includes(w.id)&&(w.huntingSkill??0)>=1||f.hunting.includes(w.id)&&!w.weapon)return false;
  const cargo=w.cargo.animal;
  if(cargo){const p=s.plots.find(p=>p.id===cargo.destination);if(!p||!['pig','chicken'].includes(cargo.species)||!['slaughterhouse',cargo.species==='pig'?'pigpen':'coop'].includes(p.kind)||w.cargo.food+w.cargo.wood>0||w.job&&w.job.kind!=='pen-delivery')return false;}
  const j=w.job;if(!j||!FOOD_JOBS.includes(j.kind as FoodJob))continue;
  if(j.herd!==undefined){
   if(j.kind!=='catch'||!Array.isArray(j.herd)||!j.herd.length||j.herd.length>B.chicken.capacity||new Set(j.herd).size!==j.herd.length||!j.herd.includes(j.target)||j.herd.some(id=>!f.animals.some(a=>a.id===id&&a.alive&&a.species==='chicken'&&a.claimedBy===w.id)))return false;
  }
  if(j.kind==='train'){if(j.target!==0||!f.training.includes(w.id))return false;continue;}
  const target=[...all,...s.plots].find(a=>a.id===j.target);if(!target||target.claimedBy!==w.id)return false;
  if(j.kind==='fish'&&!f.fishing.some(a=>a.id===j.target&&a.workerId===w.id))return false;
  if((j.kind==='catch'||j.kind==='hunt')&&!f.animals.some(a=>a.id===j.target&&a.alive&&a.species===(j.kind==='catch'?'chicken':'pig')))return false;
  if(j.kind==='hunt'&&!w.weapon)return false;
  if(j.kind==='trap-set'&&(!w.weapon||!f.traps.some(t=>t.id===j.target&&t.phase==='planned')))return false;
  if(j.kind==='trap-collect'&&!f.traps.some(t=>t.id===j.target&&t.phase==='caught'))return false;
  if(j.kind==='pen-delivery'&&cargo?.destination!==j.target)return false;
  if(['catch','trap-collect','animal-transfer'].includes(j.kind)){
   const p=s.plots.find(p=>p.id===j.destination);if(!p||p.stage!=='complete'||p.kind!==(j.kind==='catch'?'coop':j.kind==='trap-collect'?'pigpen':'slaughterhouse'))return false;
  }
  if(['feed','animal-transfer'].includes(j.kind)&&!s.plots.some(p=>p.id===j.target&&(p.kind==='coop'||p.kind==='pigpen')))return false;
  if(j.kind==='animal-process'&&!s.plots.some(p=>p.id===j.target&&p.kind==='slaughterhouse'))return false;
 }
 for(const a of all)if(a.claimedBy!==null&&!s.settlers.some(w=>w.id===a.claimedBy&&(w.job?.target===a.id||w.job?.herd?.includes(a.id))&&w.job&&FOOD_JOBS.includes(w.job.kind as FoodJob)))return false;
 for(const p of s.plots){const incoming=s.settlers.reduce((n,w)=>n+(w.cargo.animal?.destination===p.id?1:w.job?.destination===p.id&&!w.cargo.animal?w.job.herd?.length??1:0),0);
  if(p.young!==undefined&&(!Array.isArray(p.young)||p.kind!=='pigpen'||p.young.length>(p.stock??0)||p.young.some(age=>!number(age,0,B.herd.pigMaturity))))return false;
  if(p.kind==='coop'||p.kind==='pigpen'){if((p.stock??0)+incoming>B[p.kind==='coop'?'chicken':'pig'].capacity)return false;}
  if(p.kind==='slaughterhouse'&&(p.poultry??0)+(p.pork??0)+incoming>12)return false;
 }
 return true;
}catch{return false;}}
