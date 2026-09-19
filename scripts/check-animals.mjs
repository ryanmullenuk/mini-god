import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/animal-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','navigation','terrain-metadata','world-state','settlement','save','settlement-view','guidance-cursor','islanders','land-animals','weather']){
  const source=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {Islanders}=await import(pathToFileURL(resolve(temp,'islanders.mjs')));
const {LandAnimals}=await import(pathToFileURL(resolve(temp,'land-animals.mjs')));
const {IslandWeather}=await import(pathToFileURL(resolve(temp,'weather.mjs')));
function run(sim,seconds){for(let i=0;i<Math.round(seconds*10);i++)sim.advance(.1);}
function flat(){const terrain=new Terrain();terrain.values.fill(7.2);const sim=new Settlement(terrain);sim.add(2);sim.state.resources=[];return {terrain,sim};}
test('builders kneel, face their site and swing a visible hammer only during construction',()=>{
  const {terrain,sim}=flat(),people=new Islanders(terrain);try{
    sim.state.wood=6;assert.ok(sim.guide('home',{x:1,z:3}).allowed);
    let builder;
    for(let i=0;i<500;i++){sim.advance(.1);builder=sim.state.settlers.find(w=>w.job?.kind==='build'&&!w.job.route.length);if(builder)break;}
    assert.ok(builder);const plot=sim.state.plots.find(p=>p.id===builder.job.target);
    assert.ok(Math.abs(builder.heading-Math.atan2(plot.x-builder.x,plot.z-builder.z))<1e-9);
    for(let i=0;i<20;i++)people.sync(sim.state.settlers,.05,false);
    const rig=people.people[sim.state.settlers.indexOf(builder)];assert.ok(rig.hammer.visible);assert.ok(rig.kneel>.98);assert.ok(rig.body.position.y<-.28);
    assert.ok(rig.legs[1].knee.rotation.x>1.5);const before=rig.arms[1].shoulder.rotation.x;people.sync(sim.state.settlers,.2,false);assert.notEqual(rig.arms[1].shoulder.rotation.x,before);
    const pose=rig.arms[1].shoulder.rotation.x;people.sync(sim.state.settlers,1,true);assert.equal(rig.arms[1].shoulder.rotation.x,pose);
    builder.job=null;people.sync(sim.state.settlers,.1,true);assert.equal(rig.hammer.visible,false);
    for(let i=0;i<20;i++)people.sync(sim.state.settlers,.05,false);assert.ok(rig.kneel<.01);assert.ok(Math.abs(rig.body.position.y)<.01);
    people.group.traverse(o=>assert.ok([...o.position.toArray(),...o.rotation.toArray().slice(0,3)].every(Number.isFinite)));
  }finally{people.dispose();terrain.dispose();}
});
test('pigs and chickens spawn and roam on dry, walkable land with animated legs and idle behaviour',()=>{
  const terrain=new Terrain(),animals=new LandAnimals(terrain);try{
    assert.equal(animals.animals.filter(a=>a.kind==='pig').length,6);assert.equal(animals.animals.filter(a=>a.kind==='chicken').length,12);
    assert.ok(animals.animals.every(a=>a.visible));const before=animals.animals.map(a=>({x:a.x,z:a.z}));
    for(let i=0;i<1200;i++){animals.update(.05);if(i%20===0)for(const a of animals.animals)if(a.visible)assert.ok(animals.nav.safe(a.x,a.z));}
    assert.ok(animals.animals.some((a,i)=>Math.hypot(a.x-before[i].x,a.z-before[i].z)>1));
    animals.group.traverse(o=>{assert.ok([...o.position.toArray(),...o.scale.toArray()].every(Number.isFinite));if(o.geometry)assert.ok([...o.geometry.getAttribute('position').array].every(Number.isFinite));});
    const paused=animals.animals.map(a=>({x:a.x,z:a.z,phase:a.phase,heading:a.heading,head:a.head.rotation.x}));animals.update(10,true);assert.deepEqual(animals.animals.map(a=>({x:a.x,z:a.z,phase:a.phase,heading:a.heading,head:a.head.rotation.x})),paused);
  }finally{animals.dispose();terrain.dispose();}
});
test('wild goats and turkeys roam safely without adding food-system animals',()=>{
  const terrain=new Terrain(),animals=new LandAnimals(terrain);try{
    assert.equal(animals.wildAnimals.filter(a=>a.kind==='goat').length,7);
    assert.equal(animals.wildAnimals.filter(a=>a.kind==='turkey').length,9);
    const before=animals.wildAnimals.map(a=>({x:a.x,z:a.z}));
    for(let i=0;i<1000;i++)animals.update(.05,false,false);
    assert.ok(animals.wildAnimals.some((a,i)=>Math.hypot(a.x-before[i].x,a.z-before[i].z)>.5));
    assert.ok(animals.wildAnimals.every(a=>!a.visible||animals.nav.safe(a.x,a.z)));
  }finally{animals.dispose();terrain.dispose();}
});
test('full-island rain reuses one GPU draw call and fades in and out',()=>{
  const weather=new IslandWeather(64);try{
    assert.equal(weather.group.children.length,1);assert.equal(weather.group.visible,false);
    for(let i=0;i<30;i++)weather.update(.1,true);
    assert.equal(weather.group.visible,true);
    const rain=weather.group.children[0];assert.equal(rain.geometry.getAttribute('position').count,128);
    for(let i=0;i<80;i++)weather.update(.1,false);
    assert.equal(weather.group.visible,false);
  }finally{weather.dispose();}
});
test('roaming animals avoid new buildings and recover after terrain changes without walking into water',()=>{
  const terrain=new Terrain();terrain.values.fill(7.2);let occupied=null;const animals=new LandAnimals(terrain,(x,z)=>occupied&&Math.abs(x-occupied.x)<1.5&&Math.abs(z-occupied.z)<1.5);try{
    const a=animals.animals[0];occupied={x:a.x,z:a.z};animals.update(.1);assert.ok(!a.visible||Math.abs(a.x-occupied.x)>=1.5||Math.abs(a.z-occupied.z)>=1.5);
    terrain.values.fill(-2);animals.terrainChanged();assert.ok(animals.animals.every(a=>!a.visible));for(let i=0;i<40;i++)animals.update(.1);assert.ok(animals.animals.every(a=>!a.visible));
    terrain.values.fill(7.2);animals.terrainChanged();assert.ok(animals.animals.every(a=>a.visible&&animals.nav.safe(a.x,a.z)));
    animals.dispose();assert.equal(animals.group.children.length,0);assert.equal(animals.animals.length,0);
  }finally{animals.dispose();terrain.dispose();}
});
test('walking to a building and farming do not display the construction hammer',()=>{
  const {terrain,sim}=flat(),people=new Islanders(terrain);try{
    const worker=sim.state.settlers[0];
    for(const job of [{kind:'build',route:[{x:1,z:3}]},{kind:'plant',route:[]},{kind:'worship',route:[]}]){worker.job={...job,target:100,work:0};people.sync(sim.state.settlers,.1,false);assert.equal(people.people[0].hammer.visible,false);}
    run(sim,.1);
  }finally{people.dispose();terrain.dispose();}
});
