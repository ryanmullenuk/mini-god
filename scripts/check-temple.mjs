import {legacySave} from './save-fixtures.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/temple-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','navigation','terrain-metadata','world-state','settlement','save','settlement-view','guidance-cursor','islanders']){
  const source=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {BUILD_COST}=await import(pathToFileURL(resolve(temp,'world-state.mjs')));
const {encodeSave,decodeSave}=await import(pathToFileURL(resolve(temp,'save.mjs')));
const {SettlementView}=await import(pathToFileURL(resolve(temp,'settlement-view.mjs')));
const {Islanders}=await import(pathToFileURL(resolve(temp,'islanders.mjs')));
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

test('temples are constructed at the chosen site, receive real visits and collect offerings once',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=36;
    for(const [kind,p] of [['home',{x:1,z:7}],['farm',{x:-5,z:8}],['temple',{x:1,z:3}]])assert.ok(sim.guide(kind,p).allowed);
    const templeId=sim.state.orders.at(-1).id;run(sim,600);
    const temple=sim.state.plots.find(p=>p.id===templeId);assert.equal(temple.stage,'complete');assert.ok(temple.offerings>0);
    assert.ok(sim.state.settlers.some(w=>w.lastWorship>0));
    const offered=temple.offerings,before=sim.state.faith;assert.equal(sim.collectOfferings(),offered);assert.equal(sim.state.faith,before+offered);assert.equal(sim.collectOfferings(),0);
    conserved(sim,36);
    const route=sim.nav.route({x:-2,z:3},{x:4,z:3});assert.ok(route&&route.length>1,'Temple blocks walking through its walls');
  }finally{terrain.dispose();}
});
test('slaughterhouses rear goats from surplus feed, protect the breeding pair and deliver meat',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=30;
    for(const [kind,p] of [['home',{x:1,z:7}],['farm',{x:-5,z:8}],['slaughterhouse',{x:1,z:3}]])assert.ok(sim.guide(kind,p).allowed);
    let carriedMeat=false;
    for(let i=0;i<9000;i++){sim.advance(.1);if(sim.state.settlers.some(w=>w.cargo.food===10&&w.cargo.harvest===0))carriedMeat=true;}
    const house=sim.state.plots.find(p=>p.kind==='slaughterhouse');assert.ok(house.processed>0);assert.ok(house.livestock>=2&&house.livestock<=4);assert.ok(carriedMeat);
    assert.ok(sim.state.deliveredFood>sim.state.harvestedFood);conserved(sim,30);
    sim.state.food=0;house.rearing=false;house.rearingProgress=0;run(sim,.1);assert.equal(house.rearing,false,'No breeding feed is conjured when storage is empty');
  }finally{terrain.dispose();}
});
test('targeted rain and growth affect only their area and reject outside influence without a charge',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=12;assert.ok(sim.guide('farm',{x:1,z:3}).allowed);assert.ok(sim.guide('farm',{x:-14,z:3}).allowed);run(sim,100);
    const near=sim.state.plots.find(p=>p.kind==='farm'&&p.x===1),far=sim.state.plots.find(p=>p.kind==='farm'&&p.x===-14);assert.ok(near&&far);
    near.moisture=.1;far.moisture=.1;sim.state.faith=40;
    const preview=sim.guidancePreview('rain',near);assert.equal(preview.radius,6);assert.ok(preview.allowed);assert.match(preview.message,/1 fields/);
    assert.ok(sim.power('rain',near));assert.equal(sim.state.faith,32);assert.ok(near.moisture>.5);assert.equal(far.moisture,.1);
    assert.equal(sim.wetAt(near),true);assert.equal(sim.wetAt(far),false);
    const f=far.fertility;assert.ok(sim.power('bloom',near));assert.equal(far.fertility,f);
    const before=structuredClone(sim.state);assert.equal(sim.guide('rain',{x:45,z:45}).allowed,false);assert.deepEqual(sim.state,before);
    assert.equal(sim.guide('bloom',{x:NaN,z:3}).allowed,false);assert.deepEqual(sim.state,before);
  }finally{terrain.dispose();}
});
test('two huts, a delivered harvest and temple unlock wider blessings permanently',()=>{
  const terrain=new Terrain();try{
    terrain.values.fill(7.2);const sim=new Settlement(terrain);sim.add(2);sim.state.wood=40;
    for(const kind of ['home','home','farm'])assert.ok(sim.guide(kind,site(sim,kind)).allowed);
    assert.ok(sim.guide('temple',site(sim,'home')).allowed);run(sim,800);
    assert.equal(sim.state.tier,2);assert.equal(sim.guidancePreview('rain',sim.state.camp).radius,8);
    const temple=sim.state.plots.find(p=>p.kind==='temple');assert.ok(sim.influenceAreas().some(a=>a.x===temple.x&&a.z===temple.z&&a.radius>=24));
    temple.valid=false;run(sim,.1);assert.equal(sim.state.tier,2);
  }finally{terrain.dispose();}
});
test('active worship, livestock and targeted rain saves resume without duplicate food or faith',()=>{
  const {terrain,sim}=flat(),restoredTerrain=new Terrain();try{
    sim.state.wood=40;
    for(const [kind,p] of [['home',{x:1,z:7}],['farm',{x:-5,z:8}],['temple',{x:1,z:3}],['slaughterhouse',{x:-12,z:3}]])assert.ok(sim.guide(kind,p).allowed);
    run(sim,250);sim.state.faith=40;sim.power('rain',sim.state.camp);
    const saved=decodeSave(encodeSave(terrain.values,sim.state));restoredTerrain.values.set(saved.terrain);
    const other=new Settlement(restoredTerrain,saved.world);run(sim,300);run(other,300);assert.deepEqual(sim.state,other.state);
    const raw=encodeSave(terrain.values,sim.state);
    for(const mutate of [s=>s.world.plots.find(p=>p.kind==='temple').offerings=100,s=>s.world.plots.find(p=>p.kind==='slaughterhouse').livestock=1,s=>s.world.plots.find(p=>p.kind==='slaughterhouse').rearingProgress=-1,s=>s.world.tier=3,s=>s.world.rainArea.radius=999]){const s=JSON.parse(raw);mutate(s);assert.throws(()=>decodeSave(JSON.stringify(s)));}
  }finally{terrain.dispose();restoredTerrain.dispose();}
});
test('version 4 villages retain guidance, cargo and buildings during the upgrade',()=>{
  const {terrain,sim}=flat();try{
    sim.guide('home',{x:1,z:3});const data=JSON.parse(legacySave(terrain.values,sim.state));data.version=4;delete data.world.tier;delete data.world.rainArea;
    const upgraded=decodeSave(JSON.stringify(data));assert.equal(upgraded.version,18);assert.equal(upgraded.world.tier,1);assert.equal(upgraded.world.rainArea,null);
    assert.deepEqual(upgraded.world.orders,data.world.orders);assert.deepEqual(upgraded.world.settlers,data.world.settlers);
  }finally{terrain.dispose();}
});
test('villagers are exactly half scale and new buildings, influence and placement geometry are finite',()=>{
  const {terrain,sim}=flat(),people=new Islanders(terrain),view=new SettlementView(terrain),cursor=new GuidanceCursor(terrain);try{
    people.sync(sim.state.settlers,.1,false);
    assert.equal(people.group.children.length,2);for(const child of people.group.children)assert.ok(Math.abs(child.scale.x-.535)<1e-9||Math.abs(child.scale.x-.57)<1e-9);
    sim.state.wood=40;
    for(const [kind,p] of [['temple',{x:1,z:3}],['slaughterhouse',{x:-12,z:3}]]){cursor.show(sim.guidancePreview(kind,p));assert.ok(cursor.group.visible);assert.ok(sim.guide(kind,p).allowed);}
    run(sim,200);view.update(sim,false,true);sim.state.faith=30;cursor.show(sim.guidancePreview('rain',sim.state.camp));
    for(const group of [view.group,cursor.group])group.traverse(o=>{assert.ok([...o.position.toArray(),...o.scale.toArray()].every(Number.isFinite));if(o.geometry)assert.ok([...o.geometry.getAttribute('position').array].every(Number.isFinite));});
    cursor.show(null);assert.equal(cursor.group.visible,false);
  }finally{people.dispose();view.dispose();cursor.dispose();terrain.dispose();}
});

test('collecting near the faith cap leaves whole, saveable offerings at the temple',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=18;assert.ok(sim.guide('temple',{x:1,z:3}).allowed);run(sim,160);
    const temple=sim.state.plots.find(p=>p.kind==='temple');temple.offerings=4;sim.state.faith=499.7;
    assert.equal(sim.collectOfferings(),0);assert.equal(temple.offerings,4);
    sim.state.faith=498.7;assert.equal(sim.collectOfferings(),1);assert.equal(temple.offerings,3);
    assert.doesNotThrow(()=>decodeSave(encodeSave(terrain.values,sim.state)));
  }finally{terrain.dispose();}
});
