import assert from 'node:assert/strict';
import { test,after } from 'node:test';
import { mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/settlement-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','terrain-metadata','world-state','navigation','settlement','save','islanders','settlement-view']){
  const src=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {Navigation}=await import(pathToFileURL(resolve(temp,'navigation.mjs')));
const {encodeSave,decodeSave}=await import(pathToFileURL(resolve(temp,'save.mjs')));
const {Islanders}=await import(pathToFileURL(resolve(temp,'islanders.mjs')));
const {SettlementView}=await import(pathToFileURL(resolve(temp,'settlement-view.mjs')));
function run(sim,seconds,dt=.1){for(let t=0;t<seconds-1e-8;t+=dt)sim.advance(dt);}
function invariants(sim){
  const s=sim.state;assert.ok(s.food>=0);assert.ok(s.wood>=0);assert.ok(s.faith>=0);
  for(const w of s.settlers){assert.ok(w.cargo.harvest<=w.cargo.food);if(!w.stranded)assert.ok(sim.nav.safe(w.x,w.z),`${w.name} at unsafe ${w.x},${w.z}`);}
  for(const p of [...s.plots,...s.resources])if(p.claimedBy!==null){const w=s.settlers.find(w=>w.id===p.claimedBy);assert.equal(w?.job?.target,p.id);}
  assert.ok(Math.abs(s.food-(24+s.deliveredFood-s.consumedFood))<1e-6);
}

test('two autonomous settlers build shelter, farm, deliver a harvest and answer a real prayer',()=>{
  const terrain=new Terrain();try{
    const sim=new Settlement(terrain);assert.equal(sim.add(2),2);
    for(let k=0;k<8000;k++){sim.advance(.1);if(k%100===0)invariants(sim);}
    const s=sim.status();console.log('800-second village:',JSON.stringify(s));
    assert.ok(s.homes>=1);assert.ok(s.farms>=1);assert.ok(s.harvestedFood>0);assert.ok(s.answered>=1);
    assert.equal(sim.state.trails.length,0);
  }finally{terrain.dispose();}
});

test('frame grouping and pause do not change the simulation',()=>{
  const ta=new Terrain(),tb=new Terrain();try{
    const a=new Settlement(ta),b=new Settlement(tb);a.add(2);b.add(2);
    run(a,60,.1);run(b,60,.5);assert.deepEqual(a.state,b.state);
    const before=structuredClone(a.state);a.advance(.5,true);assert.deepEqual(a.state,before);
  }finally{ta.dispose();tb.dispose();}
});

test('saves resume work and cargo without duplicating materials or prayer rewards',()=>{
  const terrain=new Terrain(),restoredTerrain=new Terrain();try{
    const a=new Settlement(terrain);a.add(2);run(a,45.7);
    const save=decodeSave(encodeSave(terrain.values,a.state));restoredTerrain.values.set(save.terrain);
    const b=new Settlement(restoredTerrain,save.world);
    run(a,200);run(b,200);assert.deepEqual(a.state,b.state);invariants(a);invariants(b);
    assert.equal(encodeSave(terrain.values,a.state).includes('"version":18'),true);
  }finally{terrain.dispose();restoredTerrain.dispose();}
});

test('terrain damage cancels claims, retains cargo and revalidates on undo without rewinding the economy',()=>{
  const terrain=new Terrain();try{
    const sim=new Settlement(terrain);sim.add(2);run(sim,90);
    const heights=terrain.values.slice();const before=sim.state.settlers.map(w=>({...w.cargo}));
    const food=sim.state.food,wood=sim.state.wood;
    for(let k=0;k<30;k++)terrain.sculpt(-2,1,5,'lower',1);
    sim.terrainChanged();assert.ok(sim.state.settlers.every(w=>w.job===null));
    assert.deepEqual(sim.state.settlers.map(w=>w.cargo),before);
    assert.equal(sim.state.food,food);assert.equal(sim.state.wood,wood);
    terrain.values.set(heights);sim.terrainChanged();assert.equal(sim.state.food,food);
    run(sim,240);invariants(sim);
  }finally{terrain.dispose();}
});

test('powers reject insufficient faith and alter actual soil/vegetation once per purchase',()=>{
  const terrain=new Terrain();try{
    const sim=new Settlement(terrain);sim.add(2);const initial=structuredClone(sim.state);
    assert.equal(sim.power('rain'),false);assert.deepEqual(sim.state,initial);
    sim.state.faith=20;assert.equal(sim.power('rain'),true);assert.equal(sim.state.faith,12);assert.ok(sim.raining);
    assert.equal(sim.power('bloom'),true);assert.equal(sim.state.faith,0);
    assert.equal(sim.power('bloom'),false);assert.equal(sim.state.faith,0);
  }finally{terrain.dispose();}
});

test('navigation rejects disconnected equal-height ground and routes around a solid home',()=>{
  const split=new Navigation({level:(x)=>Math.abs(x)<1?2:6});
  assert.equal(split.route({x:-3,z:0},{x:3,z:0}),null);
  const around=new Navigation({level:()=>6},(x,z)=>Math.abs(x)<1&&Math.abs(z)<1);
  const route=around.route({x:-3,z:0},{x:3,z:0});assert.ok(route&&route.length>1);
  let p={x:-3,z:0};for(const q of route){assert.ok(around.segment(p,q));p=q;}
});

test('invalid imports, duplicate claims and newer schemas fail before replacing the island',()=>{
  const terrain=new Terrain();try{
    const sim=new Settlement(terrain);sim.add(2);run(sim,3);const raw=encodeSave(terrain.values,sim.state);
    const save=JSON.parse(raw);save.version=99;assert.throws(()=>decodeSave(JSON.stringify(save)));
    assert.throws(()=>decodeSave('{bad json'));assert.throws(()=>decodeSave(raw.replace('"food":','"food":-1,"ignored":')));
    const duplicate=JSON.parse(raw);duplicate.world.settlers[1].id=duplicate.world.settlers[0].id;assert.throws(()=>decodeSave(JSON.stringify(duplicate)));
    const missing=JSON.parse(raw);missing.terrain=missing.terrain.slice(0,-4);assert.throws(()=>decodeSave(JSON.stringify(missing)));
    assert.equal(sim.state.settlers.length,2);
  }finally{terrain.dispose();}
});

test('settlement state drives the existing islander rigs and new scene geometry',()=>{
  const terrain=new Terrain(),sim=new Settlement(terrain),people=new Islanders(terrain),view=new SettlementView(terrain);
  try{
    sim.add(2);
    for(let k=0;k<2400;k++){sim.advance(.1);if(k%5===0){people.sync(sim.state.settlers,.5,false);view.update(sim,true);}}
    assert.equal(people.people.length,2);assert.ok(view.group.children.length>10);
    for(const w of sim.state.settlers){const rig=people.people[sim.state.settlers.indexOf(w)];assert.ok(Number.isFinite(rig.root.position.y));}
    for(const group of [people.group,view.group])group.traverse(o=>{if(o.geometry){const positions=o.geometry.getAttribute('position');if(positions)assert.ok([...positions.array].every(Number.isFinite));}});
    sim.state.faith=20;sim.power('rain');view.update(sim,true);
    people.clear();assert.equal(people.people.length,0);people.sync(sim.state.settlers,.1,true);assert.equal(people.people.length,2);
  }finally{view.dispose();people.dispose();terrain.dispose();}
});
