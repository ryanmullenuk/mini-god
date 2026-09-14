import {legacySave} from './save-fixtures.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/food-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','navigation','terrain-metadata','world-state','settlement','save','settlement-view','guidance-cursor','islanders','land-animals','landscape','food-view']){
  const source=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain,GRID,EXTENT,STEP}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {encodeSave,decodeSave}=await import(pathToFileURL(resolve(temp,'save.mjs')));
const {newWorld}=await import(pathToFileURL(resolve(temp,'world-state.mjs')));
const {FOOD_BALANCE:B}=await import(pathToFileURL(resolve(temp,'food-balance.mjs')));
function run(s,seconds){for(let i=0;i<Math.round(seconds*10);i++)s.advance(.1);}
function flat(){const t=new Terrain();t.values.fill(7.2);const s=new Settlement(t);s.add(2,{x:0,z:5});s.state.resources=[];s.state.food=100;s.state.wood=0;return {t,s};}
function pen(s,kind,x=8,z=5){const p={id:s.state.nextId++,kind,x,z,stage:'complete',progress:1,valid:true,claimedBy:null,moisture:.5,fertility:.7,crop:0,planted:false,harvests:0,stock:0,breed:0,fed:false,priority:'breed',keeperId:null,...(kind==='slaughterhouse'?{livestock:2,rearing:false,rearingProgress:0,processed:0}:{})};s.state.plots.push(p);s.nav.invalidate();return p;}
test('fish create exactly 3 carried food before physical camp delivery',()=>{
 const {t,s}=flat();try{
  for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)if((j+.5)*STEP-EXTENT/2<0)t.values[j*GRID+i]=-2;s.terrainChanged();
  assert.ok(s.foodSystem.guide('fishing',{x:0,z:1}).allowed);const area=s.state.foodSystem.fishing[0],w=s.state.settlers[0];s.foodSystem.assignRole('fish',area.id,w.id);
  let found=false;for(let i=0;i<250;i++){s.advance(.1);if(w.cargo.food===3){found=true;break;}}
  assert.ok(found);assert.equal(area.stock,11);assert.ok(s.state.food<100);assert.equal(s.state.deliveredFood,0);
  s.foodSystem.assignRole('fish',area.id,null);run(s,15);assert.equal(s.state.deliveredFood,3);assert.equal(w.cargo.food,0);
  assert.ok(!s.foodSystem.guide('fishing',{x:1,z:1}).allowed,'No overlapping duplicate stock');
 }finally{t.dispose();}
});
test('fish can reach zero and recover from zero without creating stored food',()=>{
 const {t,s}=flat();try{
  const a={id:s.state.nextId++,x:0,z:5,water:{x:0,z:-5},stock:0,recovery:0,workerId:null,claimedBy:null};s.state.foodSystem.fishing.push(a);
  const index=Math.floor((-5+EXTENT/2)/STEP)*GRID+Math.floor(EXTENT/2/STEP);for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)t.values[index+dz*GRID+dx]=-2;
  const food=s.state.food;s.foodSystem.tick(45);assert.equal(a.stock,1);assert.equal(s.state.food,food);assert.equal(s.state.deliveredFood,0);
 }finally{t.dispose();}
});
test('chickens are exclusively herded into the coop before breeding',()=>{
 const {t,s}=flat();try{
  const p=pen(s,'coop',6,5),w=s.state.settlers[0];s.foodSystem.assignRole('keeper',p.id,w.id);
  const animal=s.state.foodSystem.animals.find(a=>a.species==='chicken');for(const a of s.state.foodSystem.animals)a.alive=false;Object.assign(animal,{alive:true,x:2,z:5,goal:null,timer:100});
  run(s,4);assert.equal(animal.claimedBy,w.id);assert.equal(p.stock,0);
  run(s,25);assert.equal(animal.alive,false);assert.equal(p.stock,1);assert.equal(s.state.deliveredFood,0);assert.equal(s.state.settlers.filter(w=>w.cargo.animal).length,0);
 }finally{t.dispose();}
});
test('breeding consumes feed once, preserves pairs and respects pen capacity',()=>{
 const {t,s}=flat();try{
  const p=pen(s,'coop'),w=s.state.settlers[0];p.stock=2;s.foodSystem.assignRole('keeper',p.id,w.id);for(const a of s.state.foodSystem.animals)a.alive=false;
  run(s,20);assert.ok(p.fed);const spent=s.state.consumedFood;
  s.foodSystem.tick(B.chicken.breedSeconds);assert.equal(p.stock,3);assert.equal(p.fed,false);assert.equal(s.state.consumedFood,spent);
  p.stock=8;p.fed=true;p.breed=.5;s.foodSystem.tick(500);assert.equal(p.stock,8);assert.equal(p.breed,.5);
 }finally{t.dispose();}
});
test('Hunting training requires materials, progresses over time and unlocks weapons and traps',()=>{
 const {t,s}=flat();try{
  const w=s.state.settlers[0];assert.equal(s.foodSystem.train(w.id),false);assert.equal(s.foodSystem.hunt(w.id),false);assert.equal(s.foodSystem.preview('trap',{x:2,z:5}).allowed,false);
  s.state.wood=2;assert.ok(s.foodSystem.train(w.id));assert.equal(s.state.wood,0);assert.equal(s.foodSystem.train(w.id),false);
  run(s,30);assert.ok(w.huntingSkill>0&&w.huntingSkill<1);run(s,40);assert.equal(w.huntingSkill,1);assert.equal(w.weapon,true);assert.ok(s.foodSystem.hunt(w.id));
 }finally{t.dispose();}
});
test('pigs flee approaching followers and traps capture one pig for live pen delivery',()=>{
 const {t,s}=flat();try{
  const w=s.state.settlers[0];w.huntingSkill=1;w.weapon=true;const p=pen(s,'pigpen',8,5);s.state.wood=3;
  const a=s.state.foodSystem.animals.find(a=>a.species==='pig');for(const animal of s.state.foodSystem.animals)animal.alive=false;Object.assign(a,{alive:true,x:1,z:5,goal:null,timer:0});
  const before=a.x;s.foodSystem.tick(.1);assert.ok(a.x>before,'Pig flees the nearby follower');
  assert.ok(s.foodSystem.guide('trap',{x:4,z:5}).allowed);assert.equal(s.state.wood,0);const trap=s.state.foodSystem.traps[0];
  run(s,10);assert.equal(trap.phase,'armed');
  // Followers leave the baited site; a wild pig walks into the trap.
  for(const worker of s.state.settlers){s.release(worker);worker.x=0;worker.z=10;}Object.assign(a,{x:4.5,z:5,goal:null,timer:0});s.foodSystem.tick(.1);
  assert.equal(trap.phase,'caught');assert.equal(a.alive,false);assert.equal(p.stock,0);run(s,30);assert.equal(trap.phase,'empty');assert.equal(p.stock,1);assert.equal(s.state.deliveredFood,0);
 }finally{t.dispose();}
});
test('trained hunting yields exactly 10 carried food and requires a safe line to the pig',()=>{
 const {t,s}=flat();try{
  const w=s.state.settlers[0];w.huntingSkill=1;w.weapon=true;s.foodSystem.hunt(w.id);
  const a=s.state.foodSystem.animals.find(a=>a.species==='pig');for(const animal of s.state.foodSystem.animals)animal.alive=false;Object.assign(a,{alive:true,x:4,z:5,goal:null,timer:15});
  assert.ok(s.foodSystem.decide(w));assert.equal(w.job.kind,'hunt');
  for(let i=0;i<40&&!w.cargo.food;i++)s.advance(.1);assert.equal(a.alive,false);assert.equal(w.cargo.food,10);assert.equal(s.state.deliveredFood,0);run(s,5);assert.equal(s.state.deliveredFood,10);
 }finally{t.dispose();}
});
test('slaughterhouse processes chickens and pigs into cargo while breeding pairs remain protected',()=>{
 const {t,s}=flat();try{
  const house=pen(s,'slaughterhouse',6,5),coop=pen(s,'coop',-6,5);house.poultry=1;house.pork=1;coop.stock=2;coop.priority='food';coop.keeperId=s.state.settlers[1].id;
  for(const a of s.state.foodSystem.animals)a.alive=false;
  let chickenCargo=false,pigCargo=false;for(let i=0;i<600;i++){s.advance(.1);for(const a of s.state.settlers){if(a.cargo.food===5)chickenCargo=true;if(a.cargo.food===10)pigCargo=true;}}
  assert.ok(chickenCargo&&pigCargo);assert.equal(house.poultry,0);assert.equal(house.pork,0);assert.equal(coop.stock,2);assert.ok(s.state.deliveredFood>=15);
 }finally{t.dispose();}
});
test('new saves resume catch jobs, training and breeding without duplicate animals or food',()=>{
 const {t,s}=flat(),t2=new Terrain();try{
  const coop=pen(s,'coop',6,5);coop.stock=2;coop.keeperId=s.state.settlers[0].id;for(const a of s.state.foodSystem.animals)a.alive=false;
  s.state.wood=2;s.foodSystem.train(s.state.settlers[1].id);run(s,8);
  const saved=decodeSave(encodeSave(t.values,s.state));t2.values.set(saved.terrain);const restored=new Settlement(t2,saved.world);run(s,100);run(restored,100);assert.deepEqual(s.state,restored.state);
  const invalid=JSON.parse(legacySave(t.values,s.state));invalid.world.plots.find(p=>p.kind==='coop').stock=99;assert.throws(()=>decodeSave(JSON.stringify(invalid)));
 }finally{t.dispose();t2.dispose();}
});
test('blocked delivery retains animal cargo and releases claims through sculpting and save restore',()=>{
 const {t,s}=flat();try{
  const p=pen(s,'coop',6,5),w=s.state.settlers[0];w.cargo.animal={species:'chicken',destination:p.id};
  for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)if(Math.abs((i+.5)*STEP-EXTENT/2-3)<1)t.values[j*GRID+i]=-2;
  s.terrainChanged();run(s,5);assert.equal(p.stock,0);assert.equal(w.cargo.animal.species,'chicken');assert.equal(s.state.deliveredFood,0);
  const restored=decodeSave(encodeSave(t.values,s.state));assert.equal(restored.world.settlers[0].cargo.animal.species,'chicken');
  t.values.fill(7.2);s.terrainChanged();run(s,15);assert.equal(p.stock,1);assert.equal(w.cargo.animal,undefined);
 }finally{t.dispose();}
});
test('hunters and pigs cannot cross a multi-level cliff, and a trap cannot be crafted twice',()=>{
 const {t,s}=flat();try{
  const w=s.state.settlers[0];w.huntingSkill=1;w.weapon=true;s.foodSystem.hunt(w.id);
  for(const a of s.state.foodSystem.animals)a.alive=false;const pig=s.state.foodSystem.animals[0];Object.assign(pig,{alive:true,x:6,z:5,goal:null,timer:15});
  for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)if((i+.5)*STEP-EXTENT/2>3)t.values[j*GRID+i]=9.2;s.terrainChanged();
  assert.equal(s.foodSystem.decide(w),false);assert.equal(w.job,null);assert.equal(pig.alive,true);
  s.state.wood=3;assert.ok(s.foodSystem.guide('trap',{x:0,z:10}).allowed);const food=s.state.food;assert.equal(s.foodSystem.guide('trap',{x:0,z:10}).allowed,false);assert.equal(s.state.food,food);assert.equal(s.state.wood,0);
 }finally{t.dispose();}
});
test('food save validation rejects duplicate claims, over-capacity cargo and untrained hunters',()=>{
 const {t,s}=flat();try{
  const p=pen(s,'coop');const raw=encodeSave(t.values,s.state);
  for(const mutate of [
   a=>{a.world.foodSystem.animals[0].id=a.world.settlers[0].id;},
   a=>{a.world.foodSystem.animals[0].claimedBy=a.world.settlers[0].id;},
   a=>{a.world.settlers[0].weapon=true;},
   a=>{a.world.plots.find(a=>a.id===p.id).stock=8;a.world.settlers[0].cargo.animal={species:'chicken',destination:p.id};},
   a=>{a.world.foodSystem.fishing=[{id:a.world.nextId++,x:0,z:0,water:{x:0,z:1},stock:13,recovery:0,workerId:null,claimedBy:null}];}
  ]){const a=JSON.parse(raw);mutate(a);assert.throws(()=>decodeSave(JSON.stringify(a)));}
  const legacy=JSON.parse(legacySave(t.values,s.state));legacy.version=6;delete legacy.world.foodSystem;const restored=decodeSave(JSON.stringify(legacy));assert.equal(restored.world.foodSystem.initialized,false);assert.deepEqual(restored.world.settlers,s.state.settlers);
 }finally{t.dispose();}
});
test('fish visuals reflect exact stock, depleted areas hide fish, and view geometry disposes',async()=>{
 const {FoodView}=await import(pathToFileURL(resolve(temp,'food-view.mjs')));
 const t=new Terrain(),view=new FoodView(t),s=newWorld();try{
  t.values.fill(-2);s.foodSystem.fishing.push({id:s.nextId++,x:0,z:1,water:{x:0,z:0},stock:12,recovery:0,workerId:null,claimedBy:null});
  view.update(s);assert.equal(view.fish.count,12);s.foodSystem.fishing[0].stock=0;view.update(s);assert.equal(view.fish.count,0);
  s.foodSystem.fishing[0].stock=3;view.update(s);assert.equal(view.fish.count,3);t.values.fill(7.2);view.update(s);assert.equal(view.fish.count,0);
  let disposed=false;view.fish.geometry.addEventListener('dispose',()=>{disposed=true;});view.dispose();assert.ok(disposed);
 }finally{t.dispose();}
});
test('coops and pig pens use real guided construction and keeper food priority transports surplus',()=>{
 const {t,s}=flat();try{
  s.state.wood=15;assert.ok(s.guide('coop',{x:6,z:5}).allowed);assert.ok(s.guide('pigpen',{x:-6,z:5}).allowed);
  run(s,80);const coop=s.state.plots.find(p=>p.kind==='coop'),pigpen=s.state.plots.find(p=>p.kind==='pigpen');assert.equal(coop.stage,'complete');assert.equal(pigpen.stage,'complete');assert.equal(coop.stock,0);assert.equal(pigpen.stock,0);
  const house=pen(s,'slaughterhouse',6,11);for(const a of s.state.foodSystem.animals)a.alive=false;
  coop.stock=3;s.foodSystem.assignRole('keeper',coop.id,s.state.settlers[0].id);s.foodSystem.priority(coop.id,'food');
  run(s,50);assert.equal(coop.stock,2);assert.equal(house.poultry,0);assert.ok(s.state.deliveredFood>=5);assert.doesNotThrow(()=>decodeSave(encodeSave(t.values,s.state)));
 }finally{t.dispose();}
});
test('keepers lead a capacity-limited flock on foot, and active herding resumes from a save',()=>{
 const {t,s}=flat(),t2=new Terrain();try{
  const p=pen(s,'coop',12,5),w=s.state.settlers[0];p.stock=5;s.foodSystem.assignRole('keeper',p.id,w.id);
  for(const a of s.state.foodSystem.animals)a.alive=false;const flock=s.state.foodSystem.animals.filter(a=>a.species==='chicken').slice(0,4);
  flock.forEach((a,i)=>Object.assign(a,{alive:true,x:2+i*.35,z:5,goal:null,timer:15}));
  for(let i=0;i<120&&!w.job?.herd;i++)s.advance(.1);
  assert.equal(w.job.herd.length,3);assert.equal(w.cargo.animal,undefined);assert.equal(p.stock,5);assert.equal(flock.filter(a=>a.alive).length,4);
  const saved=decodeSave(encodeSave(t.values,s.state));t2.values.set(saved.terrain);const other=new Settlement(t2,saved.world);
  run(s,50);run(other,50);assert.deepEqual(s.state,other.state);assert.equal(p.stock,8);assert.equal(flock.filter(a=>a.alive).length,1);assert.equal(s.state.deliveredFood,0);
 }finally{t.dispose();t2.dispose();}
});
test('cancelling a herding route releases every chicken without adding livestock',()=>{
 const {t,s}=flat();try{
  const p=pen(s,'coop',12,5),w=s.state.settlers[0];s.foodSystem.assignRole('keeper',p.id,w.id);
  for(const a of s.state.foodSystem.animals)a.alive=false;const flock=s.state.foodSystem.animals.filter(a=>a.species==='chicken').slice(0,3);
  flock.forEach((a,i)=>Object.assign(a,{alive:true,x:2+i*.35,z:5,goal:null,timer:15}));
  for(let i=0;i<120&&!w.job?.herd;i++)s.advance(.1);assert.equal(w.job.herd.length,3);
  s.terrainChanged();assert.equal(p.stock,0);assert.ok(flock.every(a=>a.alive&&a.claimedBy===null));assert.equal(w.cargo.animal,undefined);assert.doesNotThrow(()=>decodeSave(encodeSave(t.values,s.state)));
 }finally{t.dispose();}
});
test('wild animals start in flocks and herds, with piglets that grow and stay near adults',()=>{
 const {t,s}=flat();try{
  const pigs=s.state.foodSystem.animals.filter(a=>a.species==='pig');assert.equal(pigs.filter(a=>a.age===0).length,2);
  for(let i=0;i<6;i+=3)assert.ok(pigs.slice(i,i+3).every(a=>Math.hypot(a.x-pigs[i].x,a.z-pigs[i].z)<3));
  const young=pigs[2];run(s,30);assert.ok(young.age>=29.9);assert.ok(Math.hypot(young.x-pigs[0].x,young.z-pigs[0].z)<5);assert.ok(pigs.every(a=>s.nav.safe(a.x,a.z)));
  const p=pen(s,'pigpen');p.stock=2;p.fed=true;p.breed=.995;s.foodSystem.tick(1);assert.equal(p.stock,3);assert.equal(p.young.length,1);
  assert.doesNotThrow(()=>decodeSave(encodeSave(t.values,s.state)));
 }finally{t.dispose();}
});
test('smaller huts, animal proportions and horned goats render from unchanged population counts',async()=>{
 const {SettlementView}=await import(pathToFileURL(resolve(temp,'settlement-view.mjs'))),{LandAnimals}=await import(pathToFileURL(resolve(temp,'land-animals.mjs')));
 const {t,s}=flat(),view=new SettlementView(t),animals=new LandAnimals(t);try{
  const home=pen(s,'home'),house=pen(s,'slaughterhouse',10,10);house.livestock=2;view.update(s,false,false);
  assert.equal(view.plots.get(home.id).building.scale.x,.7);assert.equal(view.plots.get(home.id).building.scale.y,.7);
  const goats=view.plots.get(house.id).animals.children;assert.equal(goats.filter(a=>a.visible).length,2);assert.ok(goats.every(a=>a.name==='goat'&&a.children.filter(c=>c.name==='horn').length===2));
  animals.sync(s.state.foodSystem.animals,.1,false);assert.equal(animals.animals[0].root.scale.x,.8);assert.equal(animals.animals[2].root.scale.x,.4);assert.equal(animals.animals[6].root.scale.x,.55);
  const count=s.state.foodSystem.animals.filter(a=>a.alive).length;assert.equal(count,18);
 }finally{view.dispose();animals.dispose();t.dispose();}
});
