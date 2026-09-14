import {assertTerrain} from './save-fixtures.mjs';
import {legacySave} from './save-fixtures.mjs';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});
const temp=mkdtempSync(resolve(root,'work/terrace-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','navigation','terrain-metadata','world-state','settlement','save','islanders','wildlife']){
  const source=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain,GRID,STEP,EXTENT,LAYER_COUNT,LAYER_HEIGHTS,PALETTE,DESERT_PALETTE,LAYER_NAMES,desertWeight,scalarLevel,FIRST_DRY_LAYER,SEA,POOLS}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Navigation}=await import(pathToFileURL(resolve(temp,'navigation.mjs')));
const {TerrainMetadata}=await import(pathToFileURL(resolve(temp,'terrain-metadata.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {encodeSave,decodeSave}=await import(pathToFileURL(resolve(temp,'save.mjs')));
const {Islanders}=await import(pathToFileURL(resolve(temp,'islanders.mjs')));
const {Wildlife}=await import(pathToFileURL(resolve(temp,'wildlife.mjs')));
const a={x:-3,z:0},b={x:3,z:0};
function traverses(nav,from=a,to=b){
  const route=nav.route(from,to);assert.ok(route,'A usable staircase should be reachable');
  let p=from;
  for(const q of route){
    assert.ok(nav.segment(p,q),'Path simplification must retain clearance');
    const n=Math.ceil(Math.hypot(q.x-p.x,q.z-p.z)/.105),start=p;
    for(let k=1;k<=n;k++){
      const next={x:start.x+(q.x-start.x)*k/n,z:start.z+(q.z-start.z)*k/n};
      assert.ok(nav.segment(p,next),'Small simulation moves must cross the riser');p=next;
    }
  }
}

test('thirty-two thin rendered terraces retain the shoreline, pools and wildlife',()=>{
  const terrain=new Terrain(),wildlife=new Wildlife(terrain);
  try{
    assert.equal(LAYER_COUNT,32);
    for(const entries of [PALETTE,DESERT_PALETTE,LAYER_NAMES,LAYER_HEIGHTS])assert.equal(entries.length,32);
    assert.ok(terrain.group.children.length>0&&terrain.group.children.length<=64);
    LAYER_HEIGHTS.forEach((y,i)=>{if(i)assert.ok(y>LAYER_HEIGHTS[i-1]&&y-LAYER_HEIGHTS[i-1]<.31);});
    assert.equal(LAYER_HEIGHTS[FIRST_DRY_LAYER-1]<SEA,true);
    assert.equal(LAYER_HEIGHTS[FIRST_DRY_LAYER]>SEA,true);
    for(const p of POOLS)assert.ok(terrain.height(p.x,p.z)<SEA);
    for(const mesh of terrain.group.children)assert.ok([...mesh.geometry.getAttribute('position').array].every(Number.isFinite));
    for(let k=0;k<120;k++)wildlife.update(1/30,false);
    wildlife.group.traverse(o=>assert.ok([o.position.x,o.position.y,o.position.z].every(Number.isFinite)));
  }finally{wildlife.dispose();terrain.dispose();}
});

test('holding and crossing a raise/lower stroke changes only the selected layer',()=>{
  const terrain=new Terrain();try{
    for(const mode of ['raise','lower']){
      terrain.values.fill(7.2);
      for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++){
        const x=(i+.5)*STEP-EXTENT/2;
        if(x< -6)terrain.values[j*GRID+i]=5.7;
        if(x>6)terrain.values[j*GRID+i]=8.7;
      }
      const stroke=terrain.beginStroke(0,0,mode),before=stroke.snapshot.slice();
      for(let k=0;k<300;k++){
        terrain.applyStroke(stroke,Math.sin(k*.3)*10,0,3,.2);
        terrain.applyStroke(stroke,0,0,3,.7);
      }
      assert.equal(terrain.level(0,0),stroke.targetLevel);
      assert.deepEqual(stroke.snapshot,before,'Undo snapshot must remain immutable');
      for(let k=0;k<terrain.values.length;k++){
        const old=scalarLevel(before[k]),now=scalarLevel(terrain.values[k]);
        assert.ok(Math.abs(now-old)<=1);
        if(old!==stroke.sourceLevel)assert.equal(terrain.values[k],before[k]);
      }
      const next=terrain.beginStroke(0,0,mode);
      for(let k=0;k<12;k++)terrain.applyStroke(next,0,0,3,.3);
      assert.equal(terrain.level(0,0),next.targetLevel,'Releasing permits the next layer');
    }
  }finally{terrain.dispose();}
});

test('the one-layer cap also holds between grid samples at terrace edges',()=>{
  const terrain=new Terrain();try{
    for(const mode of ['raise','lower']){
      for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)terrain.values[j*GRID+i]=i<GRID/2?6.49:7.001;
      const stroke=terrain.beginStroke(1,0,mode),probes=[];
      for(let x=-.6;x<=.6;x+=.007)probes.push({x,level:terrain.level(x,0)});
      for(let k=0;k<100;k++)terrain.applyStroke(stroke,1,0,4,.3);
      for(const p of probes)assert.ok(Math.abs(terrain.level(p.x,0)-p.level)<=1);
    }
  }finally{terrain.dispose();}
});

test('Path trims just the next higher terrace and ignores a tall cliff',()=>{
  const terrain=new Terrain();try{
    terrain.values.fill(6.7);
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++){
      const x=(i+.5)*STEP-EXTENT/2;
      if(x>0)terrain.values[j*GRID+i]=x<6?7.2:8.2;
    }
    const stroke=terrain.beginStroke(-3,0,'path');
    for(let k=0;k<60;k++){terrain.applyStroke(stroke,3,0,3,.3);terrain.applyStroke(stroke,9,0,3,.3);}
    assert.equal(terrain.level(3,0),terrain.level(-3,0));
    assert.equal(terrain.level(9,0),scalarLevel(8.2));
  }finally{terrain.dispose();}
});

test('single risers and broad stairs work uphill and downhill; tall cliffs and narrow treads do not',()=>{
  const single=new Navigation({level:x=>x<0?10:11});
  traverses(single);traverses(single,b,a);
  const stairs=new Navigation({level:x=>x< -.4?10:x<.4?11:12});
  traverses(stairs);traverses(stairs,b,a);
  for(const level of [x=>x<0?10:12,x=>x< -.1?10:x<.1?11:12]){
    const cliff=new Navigation({level});
    assert.equal(cliff.route(a,b),null);assert.equal(cliff.route(b,a),null);
  }
  const metadata=new TerrainMetadata({level:x=>x<0?10:11});
  assert.ok(metadata.inspect(0,0).walkable);
  assert.equal(metadata.assessPlot('home',{minX:-1,maxX:1,minZ:-1,maxZ:1},{reachable:true,unoccupied:true}).terrainSuitable,false);
});

test('a real interpolated cliff needs a player-shaped intermediate terrace',()=>{
  const terrain=new Terrain();try{
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)terrain.values[j*GRID+i]=i<GRID/2?5.7:6.7;
    const nav=new Navigation(terrain);
    assert.equal(nav.route(a,b),null,'A narrow interpolated strip must not become an invisible ramp');
    // Lower one layer beside the cliff to make a broad intermediate tread.
    const stroke=terrain.beginStroke(1,0,'lower');
    for(let k=0;k<20;k++)terrain.applyStroke(stroke,1,0,2,.4);
    nav.invalidate();traverses(nav);traverses(nav,b,a);
    const people=new Islanders(terrain);
    try{assert.ok(people.validSegment(a.x,a.z,b.x,b.z));}finally{people.dispose();}
  }finally{terrain.dispose();}
});

test('doubling layer indices preserves farm fertility in sandy and highland regions',()=>{
  for(const [level,soil] of [[6,.15],[8,.45],[10,.45],[12,.85],[16,.85],[18,.85]]){
    const fact=new TerrainMetadata({level:()=>level}).inspect(4,0);
    assert.ok(Math.abs(fact.fertilityEstimate-soil*(1-.65*desertWeight(4,0)))<1e-9);
    if(level>=12)assert.ok(fact.fertilityEstimate>.3,'Existing highland farms remain fertile');
  }
});

test('legacy saves retain village foundations, crops, cargo and supplies during the upgrade',()=>{
  const terrain=new Terrain();try{
    terrain.values.fill(6.7);const sim=new Settlement(terrain);sim.add(2);
    for(let k=0;k<8000;k++)sim.advance(.1);
    assert.ok(sim.state.plots.length>=2);
    // All these samples were one old terrace, but now straddle two new levels.
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)terrain.values[j*GRID+i]=6.65+.7*i/(GRID-1);
    const legacy=JSON.parse(legacySave(terrain.values,sim.state));legacy.version=1;
    const restored=decodeSave(JSON.stringify(legacy));
    assert.equal(restored.version,18);assert.equal(restored.migratedFrom,1);
    assert.equal(restored.world.foodSystem.initialized,false,'Legacy saves receive an unseeded food system');
    const {foodSystem:_oldFood,...oldEconomy}=legacy.world,{foodSystem:_newFood,...restoredEconomy}=restored.world;
    assert.deepEqual(restoredEconomy,oldEconomy,'Upgrading geometry must not rewrite the existing economy');
    terrain.values.set(restored.terrain);
    const resumed=new Settlement(terrain,restored.world);resumed.terrainChanged();
    assert.ok(resumed.state.plots.every(p=>p.valid),'Existing homes and fields keep flat foundations');
    assert.equal(resumed.state.food,legacy.world.food);assert.equal(resumed.state.wood,legacy.world.wood);
    assert.deepEqual(resumed.state.settlers.map(s=>s.cargo),legacy.world.settlers.map(s=>s.cargo));
    const roundtrip=decodeSave(encodeSave(terrain.values,resumed.state));
    assert.equal(roundtrip.migratedFrom,undefined);assertTerrain(roundtrip.terrain,Array.from(terrain.values));
  }finally{terrain.dispose();}
});
