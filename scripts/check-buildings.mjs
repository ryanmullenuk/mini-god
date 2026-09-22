import {legacySave} from './save-fixtures.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/building-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','terrain-metadata','world-state','navigation','settlement','save','settlement-view']){
 const js=ts.transpileModule(readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Settlement,workPoint}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {encodeSave,decodeSave}=await import(pathToFileURL(resolve(temp,'save.mjs')));
const {VILLAGE_BALANCE:V,BUILD_COST}=await import(pathToFileURL(resolve(temp,'world-state.mjs')));
const {SettlementView}=await import(pathToFileURL(resolve(temp,'settlement-view.mjs')));
function setup(){const terrain=new Terrain();terrain.values.fill(7.2);const sim=new Settlement(terrain);sim.add(2);sim.state.resources=[];sim.state.foodSystem.initialized=true;sim.state.food=100;sim.reserve=()=>{};return {terrain,sim};}
function plot(sim,kind,x=1,z=3){const p={id:sim.state.nextId++,kind,x,z,stage:'complete',progress:1,valid:true,claimedBy:null,moisture:.7,fertility:.7,crop:0,planted:false,harvests:0};sim.state.plots.push(p);sim.nav.invalidate();return p;}
function run(sim,seconds){for(let n=0;n<seconds*10;n++)sim.advance(.1);}
function materialTotal(sim,p){return (p.pendingWood??0)+(p.supplied??0)+sim.state.settlers.reduce((n,w)=>n+(w.cargo.construction?.site===p.id?w.cargo.construction.wood:0),0);}

test('cottage upgrade keeps shelter and requires physical deliveries before hammering',()=>{
 const {terrain,sim}=setup();try{
  const p=plot(sim,'home');sim.state.wood=V.cottageWood;
  assert.equal(sim.upgradeHome(p.id),true);assert.equal(sim.upgradeHome(p.id),false);assert.equal(sim.state.wood,0);assert.equal(sim.capacity,5);
  run(sim,2);assert.equal(p.upgradeProgress,0);assert.equal(materialTotal(sim,p),12);
  let carried=false;for(let n=0;n<2200&&p.level!==2;n++){sim.advance(.1);carried ||= sim.state.settlers.some(w=>w.cargo.construction);if(p.upgrading){assert.equal(sim.capacity,5);assert.equal(materialTotal(sim,p),12);if(p.supplied<12)assert.equal(p.upgradeProgress,0);}}
  assert.ok(carried);assert.equal(p.level,2);assert.equal(sim.capacity,7);assert.equal(sim.state.deliveredWood,0);assert.equal(sim.status().buildings[0].name,'Cottage');
 }finally{terrain.dispose();}
});
test('upgrades reject missing wood and unsafe camp access without charging',()=>{
 const {terrain,sim}=setup();try{const p=plot(sim,'home');assert.equal(sim.upgradeHome(p.id),false);sim.state.wood=12;const route=sim.nav.route;sim.nav.route=()=>null;assert.equal(sim.upgradeHome(p.id),false);assert.equal(sim.state.wood,12);assert.equal(p.upgrading,undefined);sim.nav.route=route;}finally{terrain.dispose();}
});
test('islanders route around building and farm footprints without UI pathfinding',()=>{
 const {terrain,sim}=setup();try{
  plot(sim,'farm',0,0);plot(sim,'home',6,0);
  const from={x:-4,z:0},to={x:4,z:0},route=sim.nav.route(from,to);assert.ok(route&&route.length>1);
  let previous=from;for(const next of route){assert.ok(sim.nav.segment(previous,next));previous=next;}
  sim.nav.route=()=>{throw new Error('status must not run pathfinding');};assert.doesNotThrow(()=>sim.status());
 }finally{terrain.dispose();}
});
test('five residents fit each hut and village population caps at one hundred',()=>{
 const {terrain,sim}=setup();try{
  for(let i=0;i<20;i++)plot(sim,'home',i*3,3);assert.equal(sim.capacity,100);sim.add(200);assert.equal(sim.state.settlers.length,100);assert.equal(sim.add(1),100);
 }finally{terrain.dispose();}
});
test('granary and storehouse are constructed by delivered materials, then add capacity',()=>{
 for(const kind of ['granary','storehouse']){const {terrain,sim}=setup();try{
  const cap=sim.storage;sim.state.wood=BUILD_COST[kind];assert.ok(sim.guide(kind,{x:1,z:3}).allowed);run(sim,2);
  const p=sim.state.plots[0];assert.equal(p.progress,0);assert.equal(materialTotal(sim,p),BUILD_COST[kind]);assert.deepEqual(sim.storage,cap);
  run(sim,200);assert.equal(p.stage,'complete');assert.equal(sim.storage[kind==='granary'?'food':'wood'],cap[kind==='granary'?'food':'wood']+(kind==='granary'?V.granaryFood:V.storehouseWood));
 }finally{terrain.dispose();}}
});
test('nearby depots receive cargo only after arrival and do not reserve the building exclusively',()=>{
 const {terrain,sim}=setup();try{
  const p=plot(sim,'granary',6,3),w=sim.state.settlers[0];w.x=6;w.z=6;w.cargo.food=3;
  const before=sim.state.food;sim.decide(w);assert.equal(w.job.kind,'deliver');assert.equal(w.job.target,p.id);assert.equal(p.claimedBy,null);assert.equal(sim.state.food,before);
  w.x=workPoint(p).x;w.z=workPoint(p).z;w.job.route=[];sim.work(w,.1);assert.equal(sim.state.food,before+3);assert.equal(w.cargo.food,0);assert.equal(sim.state.deliveredFood,3);
  assert.doesNotThrow(()=>decodeSave(encodeSave(terrain.values,sim.state)));
 }finally{terrain.dispose();}
});
test('full storage retains cargo; simultaneous deliveries cannot exceed capacity or duplicate harvest credit',()=>{
 const {terrain,sim}=setup();try{
  sim.state.food=sim.storage.food-2;
  for(const w of sim.state.settlers){Object.assign(w,sim.state.camp);w.cargo={food:5,wood:0,harvest:5};w.job={kind:'deliver',target:0,route:[],work:0};}
  for(const w of sim.state.settlers)sim.work(w,.1);
  assert.equal(sim.state.food,sim.storage.food);assert.equal(sim.state.settlers.reduce((n,w)=>n+w.cargo.food,0),8);assert.equal(sim.state.harvestedFood,2);
  sim.state.food-=8;for(const w of sim.state.settlers){sim.decide(w);sim.walk(w,.1);sim.work(w,.1);}assert.equal(sim.state.deliveredFood,10);assert.equal(sim.state.harvestedFood,10);
 }finally{terrain.dispose();}
});
test('construction cargo survives terrain interruption and a save without duplicate reservations',()=>{
 const {terrain,sim}=setup();const other=new Terrain();try{
  const p=plot(sim,'home');sim.state.wood=12;sim.upgradeHome(p.id);
  for(let n=0;n<500&&!sim.state.settlers.some(w=>w.cargo.construction);n++)sim.advance(.1);
  assert.ok(sim.state.settlers.some(w=>w.cargo.construction));sim.terrainChanged();assert.equal(materialTotal(sim,p),12);
  const encoded=encodeSave(terrain.values,sim.state),saved=decodeSave(encoded);other.values.set(saved.terrain);const restored=new Settlement(other,saved.world);restored.reserve=()=>{};
  run(sim,180);run(restored,180);assert.deepEqual(restored.state,sim.state);assert.equal(sim.state.plots[0].level,2);
  const bad=JSON.parse(encoded);bad.world.plots[0].pendingWood+=3;assert.throws(()=>decodeSave(JSON.stringify(bad)));
 }finally{terrain.dispose();other.dispose();}
});
test('version 11 paid construction remains supplied without charging or replenishing old stock',()=>{
 const {terrain,sim}=setup();try{
  const p=plot(sim,'home');p.stage='building';p.progress=.5;sim.state.wood=0;
  const old=JSON.parse(legacySave(terrain.values,sim.state));old.version=11;
  const saved=decodeSave(JSON.stringify(old));assert.equal(saved.version,18);assert.deepEqual(saved.world,sim.state);const restored=new Settlement(terrain,saved.world);restored.reserve=()=>{};run(restored,60);assert.equal(restored.state.plots[0].stage,'complete');assert.equal(restored.state.wood,0);
 }finally{terrain.dispose();}
});
test('new building models have finite geometry and cottage details appear after upgrade',()=>{
 const {terrain,sim}=setup();let view;try{
  const p=plot(sim,'home');p.level=2;plot(sim,'granary',6,3);plot(sim,'storehouse',11,3);view=new SettlementView(terrain);view.update(sim,.1);
  const cottage=view.group.getObjectByName('cottage');assert.ok(cottage?.visible);
  view.group.traverse(o=>{if(o.geometry?.attributes.position)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 }finally{view?.dispose();terrain.dispose();}
});
test('completed buildings can move to a valid site and be deleted cleanly',()=>{
 const {terrain,sim}=setup();try{
  const home=plot(sim,'home',5,3),granary=plot(sim,'granary',10,3);sim.state.food=sim.storage.food;
  const moved=sim.relocatePlot(home.id,{x:-15,z:10});assert.ok(moved?.allowed,moved?.message);assert.equal(home.x,-15);assert.equal(home.z,10);
  const blocked=sim.relocatePlot(home.id,{x:10,z:3});assert.equal(blocked?.allowed,false);assert.equal(home.x,-15);
  assert.equal(sim.deletePlot(granary.id),true);assert.equal(sim.state.plots.some(p=>p.id===granary.id),false);assert.equal(sim.state.food,sim.storage.food);
  assert.doesNotThrow(()=>decodeSave(encodeSave(terrain.values,sim.state)));
 }finally{terrain.dispose();}
});
