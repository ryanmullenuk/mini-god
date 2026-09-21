import {legacySave} from './save-fixtures.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/guidance-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','navigation','terrain-metadata','world-state','settlement','save','settlement-view','guidance-cursor']){
  const source=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain,GRID,STEP,EXTENT}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {BUILD_COST,ORDER_LIMIT}=await import(pathToFileURL(resolve(temp,'world-state.mjs')));
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

test('free guidance gathers wood, builds at the selected sites, farms and delivers a harvest',()=>{
  const terrain=new Terrain();try{
    const before=terrain.values.slice(),sim=new Settlement(terrain);sim.add(2);
    const hut=site(sim,'home');assert.ok(sim.guide('home',hut).allowed);const hutId=sim.state.orders[0].id;
    const farm=site(sim,'farm');assert.ok(sim.guide('farm',farm).allowed);const farmId=sim.state.orders[1].id;
    assert.equal(sim.state.faith,6);assert.equal(sim.state.wood,0);assert.equal(sim.state.plots.length,0);
    sim.advance(.1);assert.match(sim.status().guidance[0].message,/Gathering wood/);
    for(let i=0;i<10000;i++){sim.advance(.1);if(i%100===0)conserved(sim);}
    for(const [id,p] of [[hutId,hut],[farmId,farm]]){
      const built=sim.state.plots.find(b=>b.id===id);
      assert.ok(built?.guided&&built.valid);assert.equal(built.stage,'complete');assert.equal(built.x,p.x);assert.equal(built.z,p.z);
    }
    assert.ok(sim.state.harvestedFood>0);assert.equal(sim.state.orders.length,0);conserved(sim);
    assert.deepEqual(terrain.values,before,'Guidance must not sculpt the island');
  }finally{terrain.dispose();}
});

test('a requested farm takes priority over the automatic hut and only spends its own cost',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=6;const p={x:1,z:3};assert.ok(sim.guide('farm',p).allowed);
    const id=sim.state.orders[0].id;sim.advance(.1);
    assert.equal(sim.state.plots.length,1);assert.equal(sim.state.plots[0].id,id);assert.equal(sim.state.plots[0].kind,'farm');assert.equal(sim.state.wood,3);
    assert.equal(sim.cancelOrder(id),false,'A funded building is no longer an unfunded request');
    conserved(sim,6);
  }finally{terrain.dispose();}
});
test('boats take varied 2-5 minute trips and automatically unload into a granary',()=>{
  const terrain=new Terrain();try{
    const sim=new Settlement(terrain);sim.add(2);sim.state.wood=80;sim.state.food=200;
    let shore=null;for(let z=-95;z<=95&&!shore;z+=2)for(let x=-95;x<=95;x+=2){const preview=sim.guidancePreview('dock',{x,z});if(preview.allowed){shore={x,z};break;}}
    assert.ok(shore,'Expected reachable shoreline for a dock');assert.ok(sim.guide('dock',shore).allowed);
    for(let i=0;i<9000&&!sim.state.plots.some(p=>p.kind==='dock'&&p.stage==='complete');i++)sim.advance(.1);
    const dock=sim.state.plots.find(p=>p.kind==='dock');assert.equal(dock?.stage,'complete',JSON.stringify({dock,workers:sim.state.settlers.map(w=>w.job)}));assert.deepEqual(dock.boats,[]);
    for(let i=0;i<5;i++)assert.ok(sim.buildBoat(dock.id));assert.equal(sim.buildBoat(dock.id),false);run(sim,25);assert.equal(dock.boats[0].state,'at-sea');assert.ok(dock.boats[0].schoolId);const before=sim.state.deliveredFood;
    const sailing=dock.boats.filter(b=>b.state==='at-sea');assert.ok(sailing.length);assert.equal(new Set(sailing.map(b=>b.schoolId)).size,sailing.length);
    for(const boat of sailing){assert.ok(boat.arriveAt>boat.departAt);assert.ok(boat.fishUntil-boat.arriveAt>=120&&boat.fishUntil-boat.arriveAt<=300);assert.ok(Math.abs((boat.arriveAt-boat.departAt)-(boat.returnAt-boat.fishUntil))<.001);}
    run(sim,Math.ceil(Math.max(...sailing.map(b=>b.returnAt))-sim.state.time)+1);assert.ok(dock.boats.some(b=>b.state==='docked'));assert.ok(dock.boats.some(b=>b.trips===1));assert.ok(dock.boats.reduce((n,b)=>n+b.fish,0)>=20);run(sim,10);assert.ok(dock.boats.reduce((n,b)=>n+b.fish,0)>=20,'Catches queue when no granary exists');
    let store=null;for(let z=-90;z<=90&&!store;z+=2)for(let x=-90;x<=90;x+=2){const preview=sim.guidancePreview('granary',{x,z});if(preview.allowed){store={x,z};break;}}
    assert.ok(store);assert.ok(sim.guide('granary',store).allowed);for(let i=0;i<5000&&!sim.state.plots.some(p=>p.kind==='granary'&&p.stage==='complete');i++)sim.advance(.1);
    for(let i=0;i<3000&&sim.state.deliveredFood<before+20;i++)sim.advance(.1);assert.ok(sim.state.deliveredFood>=before+20);assert.ok(sim.state.settlers.every(w=>w.job?.kind!=='unload-boat'));
    const visited=sim.state.fishSchools.find(s=>s.visits>=1);assert.ok(visited);
    const regenerating=sim.state.fishSchools.find(s=>s.id!==visited.id);assert.ok(regenerating);regenerating.visits=10;regenerating.regenAt=sim.state.time+.2;run(sim,.3);assert.equal(regenerating.visits,0);
    const restored=decodeSave(encodeSave(terrain.values,sim.state,terrain.revision));assert.equal(restored.world.plots.find(p=>p.kind==='dock').boats.length,5);
  }finally{terrain.dispose();}
});

test('invalid, overlapping and conflicting planned entrances fail without charging or queuing',()=>{
  const {terrain,sim}=flat();try{
    assert.ok(sim.guide('home',{x:0,z:0}).allowed);
    const before=structuredClone(sim.state);
    for(const [kind,p,reason] of [['farm',{x:0,z:-3},/passage/],['home',{x:0,z:0},/room/],['farm',{x:NaN,z:0},/island/],['home',{x:EXTENT/2-1,z:EXTENT/2-1},/terrace|island/]]){
      const result=sim.guide(kind,p);assert.equal(result.allowed,false);assert.match(result.message,reason);assert.deepEqual(sim.state,before);
    }
    assert.ok(sim.guidancePreview('home',{x:0,z:0},sim.state.orders[0].id).allowed);
    assert.ok(sim.guide('farm',{x:4,z:0}).allowed);
  }finally{terrain.dispose();}
});

test('a hut cannot be accepted when its footprint would block its own only construction route',()=>{
  const {terrain,sim}=flat();try{
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)terrain.values[j*GRID+i]=Math.abs((i+.5)*STEP-EXTENT/2)<1.75?7.2:-2;
    sim.state.camp={x:0,z:-6};sim.state.settlers.forEach((w,i)=>{w.x=0;w.z=-5-i*.5;});sim.terrainChanged();
    assert.ok(sim.nav.route(sim.state.camp,{x:0,z:1.65}),'The route exists before building');
    const result=sim.guide('home',{x:0,z:0});assert.equal(result.allowed,false);assert.match(result.message,/path around/);assert.equal(sim.state.orders.length,0);
  }finally{terrain.dispose();}
});

test('followers standing on a funded planned site step aside and then construct it',()=>{
  const {terrain,sim}=flat();try{
    const p={x:1,z:3};sim.state.wood=6;assert.ok(sim.guide('home',p).allowed);const id=sim.state.orders[0].id;
    sim.state.settlers.forEach((w,i)=>{w.x=p.x+i*.2;w.z=p.z;});sim.advance(.1);
    assert.equal(sim.state.plots.length,0);assert.ok(sim.state.settlers.some(w=>w.job?.kind==='clear'));
    const decoded=decodeSave(encodeSave(terrain.values,sim.state));assert.ok(decoded.world.settlers.some(w=>w.job?.kind==='clear'));
    run(sim,80);const hut=sim.state.plots.find(p=>p.id===id);assert.equal(hut?.stage,'complete');assert.equal(sim.state.orders.length,0);conserved(sim,6);
  }finally{terrain.dispose();}
});

test('withdrawal removes only unfunded requests and their scene markers',()=>{
  const {terrain,sim}=flat(),view=new SettlementView(terrain);try{
    assert.ok(sim.guide('farm',{x:1,z:3}).allowed);const id=sim.state.orders[0].id;
    view.update(sim,false);const shown=view.group.children.length;
    const wood=sim.state.wood,faith=sim.state.faith;
    assert.equal(sim.cancelOrder(id),true);assert.equal(sim.cancelOrder(id),false);
    view.update(sim,false);assert.ok(view.group.children.length<shown);
    assert.equal(sim.state.wood,wood);assert.equal(sim.state.faith,faith);
  }finally{view.dispose();terrain.dispose();}
});

test('a sculpted-away site waits without spending supplies, then resumes after terrain restoration',()=>{
  const {terrain,sim}=flat();try{
    const p={x:1,z:3};sim.state.wood=6;assert.ok(sim.guide('home',p).allowed);const id=sim.state.orders[0].id,snapshot=terrain.values.slice();
    for(let k=0;k<25;k++)terrain.sculpt(p.x,p.z,4,'lower',1);
    sim.terrainChanged();run(sim,4);assert.equal(sim.state.plots.length,0);assert.equal(sim.state.wood,6);
    assert.match(sim.status().guidance[0].message,/dry land|terrace/);
    terrain.values.set(snapshot);sim.terrainChanged();run(sim,80);
    assert.equal(sim.state.plots.find(p=>p.id===id)?.stage,'complete');conserved(sim,6);
  }finally{terrain.dispose();}
});

test('pending guidance and construction resume after saving without duplicate buildings or charges',()=>{
  const terrain=new Terrain(),restoredTerrain=new Terrain();try{
    const a=new Settlement(terrain);a.add(2);assert.ok(a.guide('home',site(a,'home')).allowed);assert.ok(a.guide('farm',site(a,'farm')).allowed);
    run(a,4.3);const saved=decodeSave(encodeSave(terrain.values,a.state));assert.ok(saved.world.orders.length>0);
    restoredTerrain.values.set(saved.terrain);const b=new Settlement(restoredTerrain,saved.world);
    run(a,160);run(b,160);assert.deepEqual(a.state,b.state);conserved(a);conserved(b);
    const invalid=JSON.parse(legacySave(terrain.values,a.state));invalid.version=99;assert.throws(()=>decodeSave(JSON.stringify(invalid)));
    const older=JSON.parse(legacySave(terrain.values,a.state));older.version=2;delete older.world.orders;
    const upgraded=decodeSave(JSON.stringify(older));assert.equal(upgraded.version,18);assert.deepEqual(upgraded.world.orders,[]);
    assert.deepEqual(upgraded.world.plots,older.world.plots);
  }finally{terrain.dispose();restoredTerrain.dispose();}
});

test('import validation rejects duplicate, unknown and excessive guidance without touching the current island',()=>{
  const {terrain,sim}=flat();try{
    assert.ok(sim.guide('farm',{x:1,z:3}).allowed);const raw=encodeSave(terrain.values,sim.state);
    const mutations=[
      s=>{s.world.orders[0].id=s.world.settlers[0].id;},
      s=>{s.world.orders[0].kind='palace';},
      s=>{s.world.orders[0].x=.123;},
      s=>{s.world.orders[0].x=EXTENT;},
      s=>{s.world.orders=Array.from({length:ORDER_LIMIT+1},(_,i)=>({...s.world.orders[0],id:s.world.nextId+i}));s.world.nextId+=ORDER_LIMIT+2;},
      s=>{delete s.world.orders;},
    ];
    for(const mutate of mutations){const s=JSON.parse(raw);mutate(s);assert.throws(()=>decodeSave(JSON.stringify(s)));}
    assert.equal(sim.state.orders.length,1);assert.equal(sim.state.wood,0);
  }finally{terrain.dispose();}
});

test('placement previews are read-only and reuse visible geometry for huts and farms',()=>{
  const {terrain,sim}=flat(),cursor=new GuidanceCursor(terrain);try{
    const before=structuredClone(sim.state),values=terrain.values.slice();
    for(const [kind,p] of [['home',{x:1,z:3}],['farm',{x:0,z:0}],['home',{x:0,z:0}]]){
      const preview=sim.guidancePreview(kind,p);cursor.show(preview);assert.ok(cursor.group.visible);
      cursor.group.traverse(o=>{assert.ok([o.position.x,o.position.y,o.position.z].every(Number.isFinite));if(o.geometry)assert.ok([...o.geometry.getAttribute('position').array].every(Number.isFinite));});
    }
    cursor.show(null);assert.equal(cursor.group.visible,false);assert.deepEqual(sim.state,before);assert.deepEqual(terrain.values,values);
  }finally{cursor.dispose();terrain.dispose();}
});

test('building rotation is previewed, constructed and preserved in saves',()=>{
  const {terrain,sim}=flat(),cursor=new GuidanceCursor(terrain);try{
    const rotation=Math.PI/3,p={x:1,z:3,rotation};
    const preview=sim.guidancePreview('home',p);cursor.show(preview);
    assert.equal(cursor.group.rotation.y,rotation);assert.ok(sim.guide('home',p).allowed);
    assert.equal(sim.state.orders[0].rotation,rotation);
    sim.state.wood=20;sim.startPlot('home',sim.state.orders[0],sim.state.orders[0].id);sim.state.orders=[];
    assert.equal(sim.state.plots[0].rotation,rotation);
    const restored=decodeSave(encodeSave(terrain.values,sim.state));
    assert.equal(restored.world.plots[0].rotation,rotation);
  }finally{cursor.dispose();terrain.dispose();}
});

test('fire buildings use supplied construction and survive saves',()=>{
  const {terrain,sim}=flat();try{
    sim.state.wood=40;sim.state.food=200;
    for(const [kind,x] of [['torch',8],['bonfire',13]]){
      assert.ok(sim.guide(kind,{x:sim.state.camp.x+x,z:sim.state.camp.z}).allowed);
    }
    run(sim,180);
    for(const kind of ['torch','bonfire'])assert.equal(sim.state.plots.find(p=>p.kind===kind)?.stage,'complete');
    const restored=decodeSave(encodeSave(terrain.values,sim.state));
    assert.equal(restored.world.plots.filter(p=>['torch','bonfire'].includes(p.kind)).length,2);
    const view=new SettlementView(terrain);view.update(sim,false,false);
    assert.equal(view.group.children.filter(x=>x.isPointLight).length,12);
    view.dispose();
  }finally{terrain.dispose();}
});

test('evening bonfire gathering preserves nonexclusive jobs and ends at dawn',()=>{
  const {terrain,sim}=flat();try{
    sim.state.food=200;sim.state.wood=100;
    sim.state.time=160;sim.state.tick=1600;
    const p={...sim.state.camp,x:sim.state.camp.x+7,id:sim.state.nextId++,kind:'bonfire',stage:'complete',progress:1,valid:true,claimedBy:null,moisture:.5,fertility:.5,crop:0,planted:false,harvests:0};
    sim.state.plots.push(p);sim.nav.invalidate();
    for(const w of sim.state.settlers)sim.decide(w);
    assert.equal(sim.state.settlers.filter(w=>w.job?.kind==='gather').length,2);
    assert.equal(p.claimedBy,null);
    assert.doesNotThrow(()=>decodeSave(encodeSave(terrain.values,sim.state)));
    sim.state.time=240;sim.state.tick=2400;sim.advance(.1);
    assert.ok(sim.state.settlers.every(w=>w.job?.kind!=='gather'));
  }finally{terrain.dispose();}
});

test('bonfires cannot draw followers through blocked routes, in daylight, or when hungry',()=>{
  const {terrain,sim}=flat();try{
    sim.state.food=200;sim.state.wood=100;
    sim.state.plots.push({...sim.state.camp,x:sim.state.camp.x+7,id:sim.state.nextId++,kind:'bonfire',stage:'complete',progress:1,valid:true,claimedBy:null,moisture:.5,fertility:.5,crop:0,planted:false,harvests:0});
    for(const w of sim.state.settlers)sim.decide(w);
    assert.ok(sim.state.settlers.every(w=>w.job?.kind!=='gather'));
    sim.state.time=160;sim.state.tick=1600;sim.nav.route=()=>null;
    for(const w of sim.state.settlers){w.job=null;sim.decide(w);}
    assert.ok(sim.state.settlers.every(w=>w.job?.kind!=='gather'));
    sim.state.food=0;
    for(const w of sim.state.settlers){w.job=null;sim.decide(w);}
    assert.ok(sim.state.settlers.every(w=>w.job?.kind!=='gather'));
  }finally{terrain.dispose();}
});
