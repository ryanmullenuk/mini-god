import {legacySave} from './save-fixtures.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/beacon-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','navigation','terrain-metadata','world-state','settlement','save','settlement-view','guidance-cursor']){
  const source=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain,GRID,STEP,EXTENT}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {BUILD_COST}=await import(pathToFileURL(resolve(temp,'world-state.mjs')));
const {encodeSave,decodeSave}=await import(pathToFileURL(resolve(temp,'save.mjs')));
const {SettlementView}=await import(pathToFileURL(resolve(temp,'settlement-view.mjs')));
const {GuidanceCursor}=await import(pathToFileURL(resolve(temp,'guidance-cursor.mjs')));
function run(sim,seconds){for(let i=0;i<Math.round(seconds*10);i++)sim.advance(.1);}
function site(sim,kind){
  // Choose from the far end, rather than the first automatic expansion choice.
  const p=[...sim.opportunities].reverse().find(p=>p.kind===kind&&sim.guidancePreview(kind,p).allowed);
  assert.ok(p,`Expected a suitable ${kind} site`);return {x:p.x,z:p.z};
}
function flat(){const terrain=new Terrain();terrain.values.fill(7.2);const sim=new Settlement(terrain);sim.add(2);sim.state.resources=[];return {terrain,sim};}
function conserved(sim,initialWood=0){
  const s=sim.state;assert.ok(s.wood>=0&&s.food>=0&&s.faith>=0);
  const spent=s.plots.reduce((sum,p)=>sum+BUILD_COST[p.kind],0);
  assert.equal(s.wood,initialWood+s.deliveredWood-spent);
  assert.ok(Math.abs(s.food-(24+s.deliveredFood-s.consumedFood))<1e-6);
  const ids=[...s.settlers,...s.plots,...s.resources,...s.orders].map(x=>x.id);assert.equal(new Set(ids).size,ids.length);
  for(const w of s.settlers)if(!w.stranded)assert.ok(sim.nav.safe(w.x,w.z));
}

test('beacon gathers followers without sculpting or charging and releases them to work',()=>{
  const {terrain,sim}=flat();try{
    const before=terrain.values.slice(),faith=sim.state.faith;
    assert.ok(sim.guide('rally',{x:2,z:3}).allowed);
    const beacon=sim.state.beacon;assert.equal(beacon.members.length,2);
    sim.advance(.1);assert.ok(sim.state.settlers.every(w=>w.job?.kind==='rally'));
    run(sim,10);assert.ok(beacon.members.some(m=>m.phase==='arrived'||m.phase==='done'));
    run(sim,15);assert.equal(sim.state.beacon,null);
    assert.deepEqual(terrain.values,before);assert.ok(sim.state.faith>=faith);assert.equal(sim.state.wood,0);
  }finally{terrain.dispose();}
});
test('beacon respects pause, hunger, carrying supplies and active builders',()=>{
  const {terrain,sim}=flat();try{
    sim.state.settlers[0].cargo.wood=3;
    assert.ok(sim.guide('rally',{x:2,z:3}).allowed);assert.equal(sim.state.beacon.members.length,1);
    const before=structuredClone(sim.state);sim.advance(10,true);assert.deepEqual(sim.state,before);
    sim.dismissBeacon();assert.equal(sim.state.settlers[0].cargo.wood,3);
    sim.state.food=0;assert.equal(sim.guide('rally',{x:2,z:3}).allowed,false);
    sim.state.food=24;sim.state.settlers[1].job={kind:'build',target:100,work:0,route:[]};
    assert.equal(sim.guide('rally',{x:2,z:3}).allowed,false);
  }finally{terrain.dispose();}
});
test('blocked followers wait for sculpted access and never cross a multilevel cliff',()=>{
  const {terrain,sim}=flat();try{
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)terrain.values[j*GRID+i]=((i+.5)*STEP-EXTENT/2)>0?9.2:7.2;
    sim.terrainChanged();assert.ok(sim.guide('rally',{x:4,z:3}).allowed);
    run(sim,5);assert.ok(sim.state.beacon.members.every(m=>m.phase==='waiting'));
    assert.ok(sim.state.settlers.every(w=>w.x<0));assert.match(sim.status().beacon.message,/steps/);
    terrain.values.fill(7.2);sim.terrainChanged();run(sim,25);assert.equal(sim.state.beacon,null);
    assert.ok(sim.state.settlers.every(w=>w.x>0));
  }finally{terrain.dispose();}
});
test('replacing or dismissing a beacon releases old claims and journeys',()=>{
  const {terrain,sim}=flat();try{
    sim.guide('rally',{x:3,z:3});sim.advance(.1);const old=sim.state.beacon.id;
    sim.guide('rally',{x:-8,z:3});assert.notEqual(sim.state.beacon.id,old);
    run(sim,2);assert.ok(sim.state.settlers.every(w=>w.job?.target===sim.state.beacon.id));
    sim.dismissBeacon();assert.ok(sim.state.settlers.every(w=>!w.job));assert.equal(sim.dismissBeacon(),false);
  }finally{terrain.dispose();}
});
test('active beacon save resumes identically and older saves upgrade',()=>{
  const {terrain,sim}=flat();const restored=new Terrain();try{
    sim.guide('rally',{x:5,z:3});run(sim,2);
    const raw=encodeSave(terrain.values,sim.state),saved=decodeSave(raw);restored.values.set(saved.terrain);
    const other=new Settlement(restored,saved.world);run(sim,25);run(other,25);assert.deepEqual(sim.state,other.state);
    const older=JSON.parse(legacySave(terrain.values,sim.state));older.version=3;delete older.world.beacon;
    assert.equal(decodeSave(JSON.stringify(older)).world.beacon,null);
    for(const mutate of [s=>s.world.beacon.members[0].id=999,s=>s.world.beacon.members[0].destination.x=Infinity,s=>s.world.beacon.id=s.world.settlers[0].id,s=>s.world.beacon.members.push(s.world.beacon.members[0])]){
      const data=JSON.parse(raw);mutate(data);assert.throws(()=>decodeSave(JSON.stringify(data)));
    }
  }finally{terrain.dispose();restored.dispose();}
});
test('hut residents, field conditions and faith feedback reflect the actual village',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=9;sim.guide('home',{x:1,z:3});sim.guide('farm',{x:5,z:3});run(sim,180);
    const status=sim.status();assert.equal(status.homes,1);assert.equal(status.farms,1);
    assert.ok(status.buildings.some(b=>b.kind==='home'&&b.message==='2/4 sheltered'&&b.detail.includes('Aro')));
    assert.ok(status.buildings.some(b=>b.kind==='farm'&&b.detail.includes('Water')));
    assert.match(status.faithMessage,/faith per minute/);
  }finally{terrain.dispose();}
});
test('beacon and staged building scene geometry remains finite and disposes',()=>{
  const {terrain,sim}=flat(),view=new SettlementView(terrain),cursor=new GuidanceCursor(terrain);try{
    cursor.show(sim.guidancePreview('rally',{x:2,z:3}));assert.ok(cursor.group.visible);
    sim.guide('rally',{x:2,z:3});view.update(sim,false);sim.dismissBeacon();
    sim.state.wood=6;sim.guide('home',{x:1,z:3});
    for(let i=0;i<500;i++){sim.advance(.1);view.update(sim,false);}
    view.group.traverse(o=>{assert.ok([o.position.x,o.position.y,o.position.z,...o.scale.toArray()].every(Number.isFinite));});
  }finally{view.dispose();cursor.dispose();terrain.dispose();}
});

test('the guided village milestone builds two huts and a farm, delivers food and earns faith',()=>{
  const terrain=new Terrain();try{
    const sim=new Settlement(terrain);sim.add(2);
    assert.ok(sim.guide('rally',sim.state.camp).allowed);run(sim,10);
    const ids=[];
    for(const kind of ['home','home','farm']){assert.ok(sim.guide(kind,site(sim,kind)).allowed);ids.push(sim.state.orders.at(-1).id);}
    run(sim,1000);
    for(const id of ids)assert.equal(sim.state.plots.find(p=>p.id===id)?.stage,'complete');
    assert.ok(sim.state.harvestedFood>0);assert.ok(sim.state.faith>6);conserved(sim);
  }finally{terrain.dispose();}
});

test('farmers can be assigned, transferred and saved without duplicating field roles',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=12;assert.ok(sim.guide('home',{x:1,z:3}).allowed);assert.ok(sim.guide('farm',site(sim,'farm')).allowed);assert.ok(sim.guide('farm',site(sim,'farm')).allowed);run(sim,300);
    const farms=sim.state.plots.filter(p=>p.kind==='farm');assert.equal(farms.length,2);
    const worker=sim.state.settlers[1];assert.ok(sim.assignFarmer(farms[0].id,worker.id));
    assert.equal(farms[0].farmerId,worker.id);assert.notEqual(farms[1].farmerId,worker.id);
    assert.equal(sim.assignFarmer(farms[0].id,9999),false);
    const restored=decodeSave(encodeSave(terrain.values,sim.state));assert.equal(restored.world.plots.find(p=>p.id===farms[0].id).farmerId,worker.id);
    assert.ok(sim.assignFarmer(farms[0].id,null));assert.equal(farms[0].farmerId,null);
    const data=JSON.parse(legacySave(terrain.values,sim.state));data.world.plots.filter(p=>p.kind==='farm').forEach(p=>p.farmerId=worker.id);assert.throws(()=>decodeSave(JSON.stringify(data)));
  }finally{terrain.dispose();}
});
test('unreachable beacons expire and terrain damage releases beacon journeys safely',()=>{
  const {terrain,sim}=flat();try{
    sim.guide('rally',{x:20,z:3});run(sim,1);const before=terrain.values.slice();
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)if((i+.5)*STEP-EXTENT/2>0)terrain.values[j*GRID+i]=-2;
    sim.terrainChanged();assert.ok(sim.state.beacon.members.every(m=>m.phase==='waiting'));
    assert.doesNotThrow(()=>decodeSave(encodeSave(terrain.values,sim.state)));
    run(sim,91);assert.equal(sim.state.beacon,null);assert.ok(sim.state.settlers.every(w=>w.job?.kind!=='rally'));
    terrain.values.set(before);
  }finally{terrain.dispose();}
});
