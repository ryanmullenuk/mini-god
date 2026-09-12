'use client';
import {useState} from 'react';
import {FOOD_BALANCE as B} from '@/lib/game/food-balance';
import {Fish,Bird,Beef,Target} from 'lucide-react';
import type {GameAPI,Tool} from '@/lib/game/engine';
import type {SettlementStatus} from '@/lib/game/world-state';
export function FoodPanel({village,api,choose,notice}:{village:SettlementStatus;api:GameAPI|null;choose:(tool:Tool)=>void;notice:(message:string)=>void}){
 const [tab,setTab]=useState<'fish'|'chicken'|'pig'|'hunt'|null>(null);
 const f=village.foodSystem;
 const workers=village.workers;
 const options=<><option value="">Unassigned</option>{workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</>;
 return <section className="food-panel compact-food">
  <div className="food-tabs">{([{id:'fish',label:'Fishing',Icon:Fish,count:f.fishing.reduce((sum,a)=>sum+a.stock,0),hint:'Choose a reachable shore. Fish recover gradually; each delivered fish provides 3 food.'},{id:'chicken',label:'Chickens',Icon:Bird,count:f.wildChickens,hint:'Coop keepers herd chickens home. Keep a breeding pair; each processed chicken provides 5 food.'},{id:'pig',label:'Pigs',Icon:Beef,count:f.wildPigs,hint:'Use a trained hunter or a baited trap. Pig pens protect breeding pairs; each processed pig provides 10 food.'},{id:'hunt',label:'Hunting',Icon:Target,count:null,hint:'Train followers to hunt pigs and set traps. Training costs 2 wood.'}] as const).map(({id,label,Icon,count,hint})=><button key={id} title={label} aria-label={label} aria-pressed={tab===id} onClick={()=>{setTab(tab===id?null:id);notice(hint);}}><Icon/><span>{label}</span>{count!==null&&<b>{count}</b>}</button>)}</div>
  {tab&&<div className="food-actions"><button onClick={()=>choose(tab==='fish'?'fishing':tab==='chicken'?'guide-coop':tab==='pig'?'guide-pigpen':'trap')}>{tab==='fish'?'Designate shore':tab==='chicken'?`Build coop · ${B.buildings.coop.wood} wood`:tab==='pig'?`Build pig pen · ${B.buildings.pigpen.wood} wood`:`Place trap · ${B.trap.wood} wood + ${B.trap.bait} bait`}</button></div>}
  <div hidden={tab!=='fish'}>
  {!!f.fishing.length&&<h3>Fishing shores</h3>}
  {f.fishing.map((a,i)=><div className="food-item" key={a.id}><button className="food-focus" onClick={()=>api?.focusGuidance(a.id)}>Shore {i+1} · {a.stock}/{B.fishing.capacity} fish</button><small>{a.message}</small><label>Fisher<select aria-label={`Fisher for shore ${i+1}`} value={a.workerId??''} onChange={e=>api?.foodRole('fish',a.id,e.target.value?Number(e.target.value):null)}>{options}</select></label><small>One fish returns every {B.fishing.recoverySeconds} seconds. Unassign the fisher to let the area recover.</small></div>)}
  </div><div hidden={tab!=='chicken'&&tab!=='pig'}>
  {!!f.pens.length&&<h3>Animal keepers</h3>}
  {f.pens.filter(p=>p.kind===(tab==='chicken'?'coop':'pigpen')).map((p,i)=><div className="food-item" key={p.id}><button className="food-focus" onClick={()=>api?.focusGuidance(p.id)}>{p.kind==='coop'?'Coop':'Pig pen'} {i+1} · {p.stock}/{p.capacity}</button><small>{p.message}</small><label>Keeper<select aria-label={`Keeper for animal pen ${i+1}`} value={p.keeperId??''} onChange={e=>api?.foodRole('keeper',p.id,e.target.value?Number(e.target.value):null)}>{options}</select></label><label>Priority<select aria-label={`Breeding priority for pen ${i+1}`} value={p.priority} onChange={e=>api?.foodPriority(p.id,e.target.value as 'breed'|'food')}><option value="breed">Grow the herd</option><option value="food">Send surplus for food</option></select></label><small>{p.kind==='coop'?`${B.chicken.feed} feed · ${B.chicken.breedSeconds} seconds per chick`:`${B.pig.feed} feed · ${B.pig.breedSeconds} seconds per piglet`}. Two breeding animals are always protected. Food production requires a slaughterhouse.</small></div>)}
  </div><div hidden={tab!=='hunt'}>
  <h3>Hunting skill</h3><p>Training costs {B.training.wood} wood and takes {B.training.seconds} seconds. It equips a spear and unlocks trap setting. Pig keepers can collect captured pigs.</p>
  {f.hunters.map(h=><div className="food-item hunter-item" key={h.id}><span>{workers.find(w=>w.id===h.id)?.name}</span>{h.skill<1?<button disabled={h.training||village.wood<B.training.wood} onClick={()=>notice(api?.trainHunting(h.id)?'Hunting training queued. The follower will practise at camp.':'Training needs 2 wood.')} >{h.training?`Training ${Math.floor(h.skill*100)}%`:`Train · ${B.training.wood} wood`}</button>:<button aria-pressed={h.hunting} onClick={()=>api?.toggleHunting(h.id)}>{h.hunting?'Stop hunting':'Hunt wild pigs'}</button>}</div>)}
  {f.traps.map((t,i)=><div className="food-item" key={t.id}><button className="food-focus" onClick={()=>api?.focusGuidance(t.id)}>Pig trap {i+1}</button><small>{t.message}</small><button disabled={!t.message.startsWith('Empty')||village.food<B.trap.bait} onClick={()=>api?.rearmTrap(t.id)}>Rebait · {B.trap.bait} food</button></div>)}
 </div></section>;
}
