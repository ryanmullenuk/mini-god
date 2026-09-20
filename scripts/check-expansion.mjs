import {assertTerrain} from './save-fixtures.mjs';
import {legacySave} from './save-fixtures.mjs';
import assert from 'node:assert/strict';
import {OrthographicCamera,Scene,DirectionalLight,HemisphereLight,Color,Ray,Vector3} from 'three';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(resolve(root,'work'),{recursive:true});const temp=mkdtempSync(resolve(root,'work/expansion-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['food-balance','food-system','food-save','terrain','navigation','terrain-metadata','world-state','settlement','save','settlement-view','guidance-cursor','islanders','land-animals','landscape','shoreline','ocean','marine-life','terrain-mesher','wildlife','daylight']){
  const source=readFileSync(resolve(root,`lib/game/${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'");
  writeFileSync(resolve(temp,`${name}.mjs`),js);
}
const {Terrain,GRID,EXTENT,STEP,ISLETS,SAND_CONNECTIONS,mainlandHeight,legacyArchipelagoHeight,naturalArchipelagoHeight,woodedArchipelagoHeight,mountainArchipelagoHeight,MOUNTAINS,WATERFALL,waterfallArchipelagoHeight,miniGodArchipelagoHeight,broadMainlandHeight,archipelagoHeight,vegetationBiome,buildTerrainChunks,affectedTerrainChunks,TERRAIN_CHUNK_SIZE,TERRAIN_CHUNKS,buildTerrainGeometry,islandBiome,softContour}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
const {Navigation}=await import(pathToFileURL(resolve(temp,'navigation.mjs')));
const {Settlement}=await import(pathToFileURL(resolve(temp,'settlement.mjs')));
const {Shoreline}=await import(pathToFileURL(resolve(temp,'shoreline.mjs')));
const {createOcean,oceanCameraFit}=await import(pathToFileURL(resolve(temp,'ocean.mjs')));
const {Daylight}=await import(pathToFileURL(resolve(temp,'daylight.mjs')));
const {TerrainMesher}=await import(pathToFileURL(resolve(temp,'terrain-mesher.mjs')));
const {MarineLife}=await import(pathToFileURL(resolve(temp,'marine-life.mjs')));
const {Wildlife}=await import(pathToFileURL(resolve(temp,'wildlife.mjs')));
const {Landscape}=await import(pathToFileURL(resolve(temp,'landscape.mjs')));
const {encodeSave,decodeSave}=await import(pathToFileURL(resolve(temp,'save.mjs')));
const {newWorld,timeOfDay,DAY_SECONDS}=await import(pathToFileURL(resolve(temp,'world-state.mjs')));
test('larger world retains sculpt resolution, varied land and multiple broad starting clearings',()=>{
 const t=new Terrain();try{
  assert.equal(EXTENT,232);assert.equal(GRID,400);assert.equal(STEP,.58);
  const counts=Array.from({length:20},()=>0);for(const v of t.values){const l=Math.max(0,Math.min(19,Math.floor((v-.5)/.5)));counts[l]++;}
  assert.ok(counts.slice(9,16).reduce((a,b)=>a+b)>6000,'Large grassland area');
  assert.ok(counts.slice(6,9).reduce((a,b)=>a+b)>5000,'Wide sandy coastline');
  assert.ok(counts.slice(12,16).reduce((a,b)=>a+b)>300,'Low rolling grass terraces');
  const sim=new Settlement(t),sites=[];
  for(let z=-35;z<=25;z+=10)for(let x=-55;x<=40;x+=10){if(sim.guidancePreview('settle',{x,z}).allowed)sites.push({x,z});}
  assert.ok(sites.length>=8,`Expected broad starting choices, got ${sites.length}`);
  assert.ok(sites.some(a=>sites.some(b=>Math.hypot(a.x-b.x,a.z-b.z)>40)));
  const site=sites[0];assert.ok(sim.guide('settle',site).allowed);assert.deepEqual(sim.state.camp,site);assert.equal(sim.state.settlers.length,2);
  assert.ok(sim.state.resources.filter(n=>n.kind==='wood').length>=4);assert.ok(sim.state.resources.some(n=>n.kind==='forage'));
  assert.ok(sim.opportunities.some(p=>p.kind==='farm'));assert.ok(!sim.guide('settle',sites[1]).allowed);
  assert.ok(!new Settlement(t).guide('settle',{x:110,z:110}).allowed);
 }finally{t.dispose();}
});
test('legacy terrain is embedded exactly, and new saves support distant settlements',()=>{
 const old=Array.from({length:40000},(_,i)=>i%2?7.25:6.25),world=newWorld();
 const restored=decodeSave(JSON.stringify({format:'tide-island',version:5,savedAt:'2026-09-09',terrain:old,world}));
 assert.equal(restored.version,18);assert.equal(restored.terrain.length,160000);
 for(let j=0;j<200;j++)for(let i=0;i<200;i++)assert.equal(restored.terrain[(j+100)*400+i+100],old[j*200+i]);
 assert.equal(restored.terrain[0],-2);
 world.camp={x:80,z:65};assert.deepEqual(decodeSave(encodeSave(new Float32Array(restored.terrain),world)).world.camp,world.camp);
 world.camp={x:117,z:0};assert.throws(()=>decodeSave(encodeSave(new Float32Array(restored.terrain),world)));
});
test('landscape populates dry land and clears decoration around settlements and sculpted sea',()=>{
 const t=new Terrain(),landscape=new Landscape(t),world=newWorld();try{
  landscape.update(world);assert.ok(landscape.group.children.reduce((sum,m)=>sum+m.count,0)>100);
  world.camp={x:-5,z:3};landscape.update(world);
  for(const mesh of landscape.group.children)for(let i=0;i<mesh.count;i++){
   const x=mesh.instanceMatrix.array[i*16+12],z=mesh.instanceMatrix.array[i*16+14];assert.ok(Math.hypot(x+5,z-3)>9.3);
  }
  t.values.fill(-2);landscape.terrainChanged();landscape.update(world);assert.ok(landscape.group.children.every(m=>m.count===0));
 }finally{landscape.dispose();t.dispose();}
});

test('surf follows the ocean coast, leaves enclosed water calm and updates after sculpting',()=>{
 const t=new Terrain();let shore;try{
  t.values.fill(-2);
  for(let z=150;z<=250;z++)for(let x=150;x<=250;x++)t.values[z*GRID+x]=6;
  for(let z=190;z<=210;z++)for(let x=190;x<=210;x++)t.values[z*GRID+x]=-2;
  t.texture.needsUpdate=true;shore=new Shoreline(t);
  assert.equal(shore.distances[200*GRID+200],1000,'Enclosed pool is calm');
  assert.equal(shore.distances[200*GRID+160],0,'Dry land has no water distance');
  assert.ok(shore.distances[200*GRID+149]>0&&shore.distances[200*GRID+149]<STEP,'Coast begins beside land');
  assert.ok(shore.distances[200*GRID+140]>shore.distances[200*GRID+149],'Breakers have an inland direction');
  const before=t.values.slice(),version=shore.texture.version;shore.update();assert.equal(shore.texture.version,version);assert.deepEqual(t.values,before);
  for(let x=210;x<=251;x++)t.values[200*GRID+x]=-2;
  t.texture.needsUpdate=true;shore.update();assert.ok(shore.distances[200*GRID+200]<10,'An opened channel connects pool to sea');
  t.values.fill(-2);t.texture.needsUpdate=true;shore.update();assert.ok(shore.distances.every(d=>d>11),'No ghost surf remains after removing land');
 }finally{shore?.dispose();t.dispose();}
});
test('living scenery uses varied planting, animation uniforms and unchanged game state',()=>{
 const t=new Terrain(),world=newWorld(),landscape=new Landscape(t),ocean=createOcean(t);try{
  const before=JSON.stringify(world);landscape.update(world,12);
  const camera=new OrthographicCamera();camera.position.set(10,20,30);camera.lookAt(0,0,0);ocean.update(12,camera);
  const reflectionView=ocean.mesh.material.uniforms.viewDirection.value.clone();
  camera.position.set(-20,20,10);camera.lookAt(0,0,0);ocean.update(12,camera);
  assert.ok(reflectionView.distanceTo(ocean.mesh.material.uniforms.viewDirection.value)>.2,'Sun reflection responds to orbiting the camera');
  assert.ok(Math.abs(ocean.mesh.material.uniforms.viewDirection.value.length()-1)<1e-6);
  for(const name of ['Leafy groves','Upland pines','Bushes','Beach palm fronds'])assert.ok(landscape.group.getObjectByName(name).count>0,`Missing ${name}`);
  assert.equal(landscape.group.children.length,9,'Vegetation and shoreline details stay batched');
  const crown=landscape.group.getObjectByName('Leafy groves'),shader={uniforms:{},vertexShader:'#include <begin_vertex>'};
  crown.material.onBeforeCompile(shader);assert.equal(shader.uniforms.landWind.value,12);
  const matrices=crown.instanceMatrix.array.slice();landscape.update(world,13);assert.equal(shader.uniforms.landWind.value,13);assert.deepEqual(crown.instanceMatrix.array,matrices,'Wind avoids rebuilding instances');
  assert.equal(ocean.mesh.material.uniforms.time.value,6);assert.equal(JSON.stringify(world),before,'Scenery never changes food, animals or saves');
 }finally{landscape.dispose();ocean.dispose();t.dispose();}
});

test('natural archipelago combines connected headlands, offshore islands and mountain interiors',()=>{
 const t=new Terrain();try{
  const seen=new Uint8Array(GRID*GRID),sizes=[];
  for(let k=0;k<seen.length;k++){
   if(seen[k]||t.values[k]<3.5)continue;
   const queue=[k];seen[k]=1;
   for(let i=0;i<queue.length;i++){const n=queue[i],x=n%GRID;
    for(const p of [x>0?n-1:-1,x<GRID-1?n+1:-1,n-GRID,n+GRID])if(p>=0&&p<seen.length&&!seen[p]&&t.values[p]>=3.5){seen[p]=1;queue.push(p);}
   }sizes.push(queue.length);
  }
  assert.ok(sizes.filter(n=>n>150).length===4,`Expected connected mainland and multiple offshore islands, got ${sizes.join(',')}`);
  for(const isle of ISLETS){
   const levels=[];
   for(let z=isle.z-isle.rz;z<=isle.z+isle.rz;z++)for(let x=isle.x-isle.rx;x<=isle.x+isle.rx;x++)if(islandBiome(x,z)===isle.biome)levels.push(t.level(x,z));
   assert.ok(levels.some(l=>l>=11),`${isle.name} needs raised grassland`);
   assert.ok(levels.some(l=>l>=6&&l<=8),`${isle.name} needs a beach`);
   assert.ok(levels.filter(l=>l>=9&&l<=13).length>40,`${isle.name} needs settlement land`);
  }
  const nav=new Navigation(t);
  for(const points of SAND_CONNECTIONS){
   for(const p of points)assert.ok(t.level(p.x,p.z)>=6,'Curving beach connections remain dry');
   const a=nav.nearest(points[0],3),b=nav.nearest(points.at(-1),3);assert.ok(a&&b&&nav.route(a,b),'A follower can traverse the beach connection using safe one-layer routes');
  }
  assert.equal(SAND_CONNECTIONS.length,0,'No generated connecting strips');assert.ok(t.level(-34,-31)<16,'Mainland remains low and open');
 }finally{t.dispose();}
});
test('archipelago upgrade preserves occupied and sculpted land and is applied only once',()=>{
 const old=new Float32Array(GRID*GRID),world=newWorld();world.camp={x:-5,z:3};
 for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++)old[z*GRID+x]=mainlandHeight((x+.5)*STEP-EXTENT/2,(z+.5)*STEP-EXTENT/2);
 const edit=65*GRID+106;old[edit]=3.75;
 const data=JSON.parse(legacySave(old,world));data.version=8;
 const upgraded=decodeSave(JSON.stringify(data));assert.equal(upgraded.archipelagoUpgraded,true);
 assert.deepEqual(upgraded.world,world,'Existing villagers, food and livestock are untouched');
 assert.equal(upgraded.terrain[edit],old[edit],'Player sculpting survives');
 for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
  const wx=(x+.5)*STEP-EXTENT/2,wz=(z+.5)*STEP-EXTENT/2;
  if(Math.abs(wx-world.camp.x)<17&&Math.abs(wz-world.camp.z)<17)assert.equal(upgraded.terrain[z*GRID+x],old[z*GRID+x]);
 }
 assert.ok(upgraded.terrain.some((v,i)=>v>old[i]+1),'New islands are introduced');
 const sculpted=new Float32Array(upgraded.terrain);sculpted[edit]=-2;
 const restored=decodeSave(encodeSave(sculpted,upgraded.world));assertTerrain(restored.terrain,Array.from(sculpted),'Later sculpting is never regenerated');
});

test('version 9 terrain reshapes once while village cargo, sculpting and established land survive',()=>{
 const terrain=new Float32Array(GRID*GRID),world=newWorld();world.camp={x:-5,z:3};
 for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++)terrain[z*GRID+x]=legacyArchipelagoHeight((x+.5)*STEP-EXTENT/2,(z+.5)*STEP-EXTENT/2);
 const edit=80*GRID+90;terrain[edit]=4.123;
 const data=JSON.parse(legacySave(terrain,world));data.version=9;
 const next=decodeSave(JSON.stringify(data));assert.equal(next.version,18);assert.equal(next.archipelagoUpgraded,true);assert.deepEqual(next.world,world);assert.equal(next.terrain[edit],terrain[edit]);
 assert.ok(next.terrain.some((v,i)=>v<terrain[i]-.5),'Vacated untouched islets return to water');
 assert.ok(next.terrain.some((v,i)=>v>terrain[i]+.5),'New headlands and connections appear');
 assertTerrain(decodeSave(encodeSave(new Float32Array(next.terrain),world)).terrain,next.terrain);
});
test('coastal rock clusters occupy water and disappear when their ground is raised',()=>{
 const t=new Terrain(),landscape=new Landscape(t),world=newWorld();try{
  landscape.update(world,5);const rocks=landscape.group.getObjectByName('Shoreline boulders'),foam=landscape.group.getObjectByName('Boulder foam');
  assert.ok(rocks.count>25,'Visible boulder groups around the archipelago');assert.equal(rocks.count,foam.count);
  for(let i=0;i<rocks.count;i++){const x=rocks.instanceMatrix.array[i*16+12],z=rocks.instanceMatrix.array[i*16+14];assert.ok(t.level(x,z)<6,'Rocks never occupy a dry walking cell');}
  t.values.fill(7);landscape.terrainChanged();landscape.update(world,6);assert.equal(rocks.count,0);assert.equal(foam.count,0);
 }finally{landscape.dispose();t.dispose();}
});

test('dense regional forests and broad highlands retain usable settlement clearings',()=>{
 const t=new Terrain(),world=newWorld(),landscape=new Landscape(t);try{
  landscape.update(world);const canopy=landscape.group.getObjectByName('Leafy groves').count+landscape.group.getObjectByName('Upland pines').count+landscape.group.getObjectByName('Beach palm fronds').count;
  assert.ok(canopy>2200,`Expected substantial forests, got ${canopy} canopy pieces`);
  let oldHigh=0,newHigh=0;for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){if(naturalArchipelagoHeight((x+.5)*STEP-EXTENT/2,(z+.5)*STEP-EXTENT/2)>=8.5)oldHigh++;if(woodedArchipelagoHeight((x+.5)*STEP-EXTENT/2,(z+.5)*STEP-EXTENT/2)>=8.5)newHigh++;}
  assert.ok(newHigh>oldHigh*1.35,'Larger mountain regions cover substantially more land');
  const data=JSON.parse(legacySave(t.values,world));data.version=10;
  data.terrain=data.terrain.map((_,i)=>Math.fround(naturalArchipelagoHeight((i%GRID+.5)*STEP-EXTENT/2,(Math.floor(i/GRID)+.5)*STEP-EXTENT/2)));
  const upgraded=decodeSave(JSON.stringify(data));assert.equal(upgraded.version,18);assert.equal(upgraded.archipelagoUpgraded,true);assert.deepEqual(upgraded.world,world);
 }finally{landscape.dispose();t.dispose();}
});
test('gulls flock, black-bird murmurations stay cohesive, clouds vary in opacity and Pause freezes the sky',()=>{
 const t=new Terrain(),sky=new Wildlife(t);try{
  const gulls=sky.group.getObjectByName('Seagull flocks'),black=sky.group.getObjectByName('Murmuration bodies');assert.equal(gulls.count,32);assert.equal(black.count,80);assert.equal(sky.flocks.filter(f=>f.count>1).length,2);
  const solid=sky.group.getObjectByName('Opaque clouds'),soft=sky.group.getObjectByName('Soft clouds'),wispy=sky.group.getObjectByName('Wispy clouds');assert.equal(solid.count+soft.count+wispy.count,250);assert.equal(solid.material.opacity,1);assert.ok(soft.material.opacity<1&&wispy.material.opacity<soft.material.opacity);assert.equal(soft.material.depthWrite,false);
  const before=black.instanceMatrix.array.slice();sky.update(1,false);assert.notDeepEqual(black.instanceMatrix.array,before);
  let start=0;for(const f of sky.flocks){const a=gulls.instanceMatrix.array;for(let j=start+1;j<start+f.count;j++)assert.ok(Math.hypot(a[start*16+12]-a[j*16+12],a[start*16+14]-a[j*16+14])<20);start+=f.count;}
  for(let start=0;start<80;start+=80){const a=black.instanceMatrix.array;for(let j=start+1;j<start+80;j++)assert.ok(Math.hypot(a[start*16+12]-a[j*16+12],a[start*16+14]-a[j*16+14])<26);}
  const frozen=sky.group.children.map(m=>m.instanceMatrix.array.slice());sky.update(5,true);sky.group.children.forEach((m,i)=>assert.deepEqual(m.instanceMatrix.array,frozen[i]));
 }finally{sky.dispose();t.dispose();}
});

test('visual shelves widen at low beaches, narrow at cliffs and merge across channels without editing terrain',()=>{
 const t=new Terrain();let coast;try{
  const halfPlane=height=>{for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++)t.values[z*GRID+x]=x>=200?height:-2;t.texture.needsUpdate=true;};
  halfPlane(4);coast=new Shoreline(t);const sample=200*GRID+189,beach=coast.shelfDepths[sample];
  halfPlane(9);const before=t.values.slice();coast.update();assert.ok(coast.shelfDepths[sample]>beach*1.6,'Cliff shelf reaches deeper water sooner');assert.deepEqual(t.values,before);
  t.values.fill(-2);for(let z=120;z<280;z++)for(let x=150;x<=210;x++)if(x<=170||x>=190)t.values[z*GRID+x]=4;
  t.texture.needsUpdate=true;coast.update();assert.ok(coast.shelfDepths[200*GRID+180]<.35,'Nearby islands share shallow water');assert.equal(coast.shelfDepths[200*GRID+320],1,'Distant open sea stays deep');
  assert.ok(coast.shelfDepths.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  const version=coast.shelfTexture.version;coast.update();assert.equal(coast.shelfTexture.version,version,'No bathymetry rebuild on an unchanged frame');
  t.values.fill(-2);t.texture.needsUpdate=true;coast.update();assert.ok(coast.shelfDepths.every(v=>v===1),'Removing land clears its visual shelves');
 }finally{coast?.dispose();t.dispose();}
});
test('soft terrace contours stay within the navigation margin and rebuilds preserve every editable height',()=>{
 const input=[[100,100],[104,100],[104,104],[100,104],[100,100]],out=softContour(input);
 assert.equal(out.length,8);for(const p of out){const distance=Math.min(...input.map(([x,z])=>Math.hypot(p.x-(x*STEP-EXTENT/2),p.y+(z*STEP-EXTENT/2))));assert.ok(distance<=.055001,'Corner rounding stays local');}
 const t=new Terrain();try{const before=t.values.slice(),levels=Array.from({length:32},(_,i)=>i);t.rebuild();assert.deepEqual(t.values,before);assert.ok(t.group.children.every(m=>Number.isInteger(m.userData.chunk)));for(const m of t.group.children)assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));}finally{t.dispose();}
});

test('dawn-to-night lighting follows saved simulation time and wraps smoothly into the next day',()=>{
 const scene=new Scene();scene.background=new Color('#000000');const sun=new DirectionalLight(),ambient=new HemisphereLight(),daylight=new Daylight(scene,sun,ambient);
 assert.equal(DAY_SECONDS,240);assert.deepEqual([0,40,100,150,190].map(timeOfDay),['Dawn','Morning','Afternoon','Dusk','Night']);
 daylight.update(80);const daytime=sun.intensity,dayTint=daylight.tint.clone(),morningDirection=daylight.direction.clone();
 daylight.update(195);assert.ok(sun.intensity<daytime);assert.ok(sun.intensity>=.7,'Cool moonlight keeps the island forms visible');assert.ok(ambient.intensity>=.75,'Night retains enough ambient light to play');assert.equal(daylight.strength,0,'Sun glitter disappears at night');assert.ok(daylight.tint.r<dayTint.r);assert.ok(daylight.tint.b>daylight.tint.r,'Moonlight has a cool blue cast');assert.ok(daylight.direction.distanceTo(morningDirection)>.3);
 const world=newWorld();world.time=195;world.tick=1950;const restored=decodeSave(encodeSave(new Float32Array(GRID*GRID).fill(-2),world));
 const night=daylight.tint.clone();daylight.update(restored.world.time);assert.ok(daylight.tint.equals(night),'Loading retains the time of day');
 daylight.update(239.999);const last=daylight.tint.clone(),direction=daylight.direction.clone();daylight.update(240);assert.ok(Math.abs(last.r-daylight.tint.r)<.0001);assert.ok(direction.distanceTo(daylight.direction)<.0001,'No sun jump at day rollover');
 const t=new Terrain(),sim=new Settlement(t),ocean=createOcean(t);try{
  const before=sim.state.time;sim.advance(.5,true);assert.equal(sim.state.time,before);assert.equal(sim.status().timeOfDay,timeOfDay(before));
  const light=daylight.update(195);ocean.setLighting(light.direction,light.colour,light.strength,light.tint);assert.equal(ocean.mesh.material.uniforms.sunStrength.value,0);assert.ok(ocean.mesh.material.uniforms.daylightTint.value.equals(light.tint));
 }finally{ocean.dispose();t.dispose();}
});

test('mountain ranges cover broad high ground while coasts and thin steps remain intact',()=>{
 const t=new Terrain();try{
  let high=0,peak=0;for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++){
   const x=(i+.5)*STEP-EXTENT/2,z=(j+.5)*STEP-EXTENT/2,old=woodedArchipelagoHeight(x,z),v=mountainArchipelagoHeight(x,z);
   if(old<6)assert.equal(Math.fround(mountainArchipelagoHeight(x,z)),Math.fround(old),'Previous mountain generator remains stable for migration');
   if(v>10.5)high++;if(v>=16)peak++;
  }
  assert.ok(high>1200,`Broad highlands, ${high} samples`);assert.ok(peak>10,'Highest mountain band is visible');
  t.values.fill(14.25);const stroke=t.beginStroke(0,0,'raise');for(let n=0;n<30;n++)t.applyStroke(stroke,0,0,4,1);assert.equal(t.level(0,0),stroke.sourceLevel+1);
  assert.doesNotThrow(()=>decodeSave(encodeSave(t.values,newWorld())));
 }finally{t.dispose();}
});
test('mountain migration upgrades untouched land once while keeping edits and occupied ground',()=>{
 const t=new Terrain();try{
  for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)t.values[j*GRID+i]=woodedArchipelagoHeight((i+.5)*STEP-EXTENT/2,(j+.5)*STEP-EXTENT/2);
  const world=newWorld();world.camp={x:-37,z:-24};
  const edit=Math.floor((21+EXTENT/2)/STEP)*GRID+Math.floor((42+EXTENT/2)/STEP);t.values[edit]=7.75;
  const data=JSON.parse(legacySave(t.values,world));data.version=12;const saved=decodeSave(JSON.stringify(data));
  assert.ok(saved.archipelagoUpgraded);assert.deepEqual(saved.world,world);assert.equal(saved.terrain[edit],7.75);
  for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)if(Math.hypot((i+.5)*STEP-EXTENT/2+37,(j+.5)*STEP-EXTENT/2+24)<17)assert.equal(saved.terrain[j*GRID+i],t.values[j*GRID+i]);
  const again=decodeSave(encodeSave(new Float32Array(saved.terrain),saved.world));assertTerrain(again.terrain,saved.terrain);assert.equal(again.archipelagoUpgraded,undefined);
 }finally{t.dispose();}
});
test('cursor deflects gulls and black birds smoothly and flocks choose new destinations',()=>{
 const t=new Terrain(),a=new Wildlife(t),b=new Wildlife(t);try{
  b.flocks.splice(0,b.flocks.length,...structuredClone(a.flocks));for(const f of [...a.flocks,...b.flocks]){f.speed=0;f.timer=999;f.goalX=100;f.goalZ=100;}
  b.flights=structuredClone(a.flights);a.drawSky();b.drawSky();
  for(const name of ['Seagull flocks','Murmuration bodies']){
   const base=b.group.getObjectByName(name),before=base.instanceMatrix.array;
   a.setCursorRay(new Ray(new Vector3(before[12],100,before[14]),new Vector3(0,-1,0)),12);
   for(let n=0;n<12;n++){a.update(.05,false);b.update(.05,false);}
   const moved=a.group.getObjectByName(name).instanceMatrix.array,normal=base.instanceMatrix.array;
   assert.ok(Math.hypot(moved[12]-normal[12],moved[14]-normal[14])>1,`${name} move away from cursor`);
   for(const v of moved)assert.ok(Number.isFinite(v));
  }
  a.setCursorRay(null);const old=a.flocks.map(f=>[f.goalX,f.goalZ]);for(const f of a.flocks)f.timer=0;a.update(.05,false);assert.notDeepEqual(a.flocks.map(f=>[f.goalX,f.goalZ]),old);
 }finally{a.dispose();b.dispose();t.dispose();}
});

test('gulls include solo travellers and flee forwards before returning to their loose flock',()=>{
 const t=new Terrain(),sky=new Wildlife(t);try{
  assert.equal(sky.flocks.filter(f=>f.count===1).length,10);
  sky.skyStep=.05;sky.flights[0]={x:0,z:0,heading:0,escape:0,away:0};sky.setCursorRay(new Ray(new Vector3(-1,100,0),new Vector3(0,-1,0)),4);
  let p={x:0,z:0};for(let i=0;i<30;i++){const next=sky.avoid(0,13,0,0);const dx=next.x-p.x,dz=next.z-p.z;assert.ok(dx*Math.sin(next.heading)+dz*Math.cos(next.heading)>0,'Moves in the direction it faces');p=next;}
  assert.ok(Math.hypot(p.x+1,p.z)>5,'Gull flies clear of cursor');sky.setCursorRay(null);
  for(let i=0;i<240;i++)p=sky.avoid(0,13,0,0);assert.ok(Math.hypot(p.x,p.z)<.2,'Gull regroups after the danger passes');
 }finally{sky.dispose();t.dispose();}
});
test('whales surface and dolphins breach in open ocean, pause freezes visitors and new land hides them',()=>{
 const t=new Terrain();t.values.fill(-2);const shore=new Shoreline(t),marine=new MarineLife(t,shore);try{
  for(const v of marine.visitors)v.wait=0;
  let whale=false,dolphin=false,spray=false;
  for(let i=0;i<120;i++){marine.update(.1,false);for(const v of marine.visitors){if(!v.active)continue;assert.ok(shore.isOceanCell(Math.floor((v.root.position.z+EXTENT/2)/STEP)*GRID+Math.floor((v.root.position.x+EXTENT/2)/STEP)));if(v.kind==='whale'){whale ||= v.body.position.y>-.4;spray ||= v.spray.visible;}else dolphin ||= v.body.position.y>1;}}
  assert.ok(whale&&dolphin&&spray);const before=marine.visitors.map(v=>[v.age,v.wait,v.root.position.toArray()]);marine.update(10,true);assert.deepEqual(marine.visitors.map(v=>[v.age,v.wait,v.root.position.toArray()]),before);
  t.values.fill(7.2);t.rebuild();marine.update(.1,false);assert.ok(marine.visitors.every(v=>!v.root.visible));
  marine.group.traverse(o=>{if(o.geometry?.attributes.position)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 }finally{marine.dispose();shore.dispose();t.dispose();}
});
test('ocean visitors never spawn in enclosed island pools',()=>{
 const t=new Terrain();t.values.fill(7.2);for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)if(Math.hypot((i+.5)*STEP-EXTENT/2,(j+.5)*STEP-EXTENT/2)<25)t.values[j*GRID+i]=-2;
 const shore=new Shoreline(t),marine=new MarineLife(t,shore);try{for(const v of marine.visitors)v.wait=0;for(let i=0;i<150;i++)marine.update(.1,false);assert.ok(marine.visitors.every(v=>!v.active&&!v.root.visible));}finally{marine.dispose();shore.dispose();t.dispose();}
});

test('partial meshing matches full geometry and retains untouched layer objects',()=>{
 const t=new Terrain();try{
  const before=t.values.slice(),old=new Map(t.group.children.map(m=>[m.userData.chunk,m]));t.sculpt(-4,3,4,'raise',.7);
  const partial=buildTerrainChunks(t.values,before),full=buildTerrainChunks(t.values);assert.ok(partial.length>0&&new Set(partial.map(p=>p.chunk)).size<=4);
  for(const p of partial){const all=full.find(a=>a.chunk===p.chunk&&a.layer===p.layer);assert.deepEqual(p.position,all.position);assert.deepEqual(p.color,all.color);assert.deepEqual(p.normal,all.normal);}
  t.installChunks(partial);for(const m of t.group.children)if(!partial.some(p=>p.chunk===m.userData.chunk))assert.equal(m,old.get(m.userData.chunk));
  // Changes next to a tall cliff can affect interpolation at many levels.
  const cliff=new Float32Array(GRID*GRID).fill(7.2);for(let j=0;j<GRID;j++)for(let i=200;i<GRID;i++)cliff[j*GRID+i]=15.2;
  const changed=cliff.slice();changed[200*GRID+199]=7.4;
  const delta=buildTerrainGeometry(changed,cliff),all=buildTerrainGeometry(changed);assert.ok(delta.length>10);
  for(const p of delta)assert.deepEqual(p.position,all.find(a=>a.layer===p.layer).position);
 }finally{t.dispose();}
});
test('background meshing coalesces edits, rejects stale results and cancels safely on undo',()=>{
 const t=new Terrain();let installed=0;const messages=[];let terminated=false;
 const worker={postMessage:message=>messages.push(message),terminate:()=>{terminated=true;},onmessage:null,onerror:null};
 const mesher=new TerrainMesher(t,()=>installed++,()=>worker);try{
  t.sculpt(-4,3,4,'raise',.4);mesher.request();const first=messages[0];
  t.sculpt(-4,3,4,'raise',.4);mesher.request();t.sculpt(-4,3,4,'raise',.4);mesher.request();assert.equal(messages.length,1);
  worker.onmessage({data:{id:first.id,data:buildTerrainChunks(first.values,first.previous)}});assert.equal(installed,0);assert.equal(messages.length,2);
  const latest=messages[1];worker.onmessage({data:{id:latest.id,data:buildTerrainChunks(latest.values,latest.previous)}});assert.equal(installed,1);assert.equal(mesher.busy,false);
  mesher.request();const obsolete=messages[2];mesher.cancel();worker.onmessage({data:{id:obsolete.id,data:[]}});assert.equal(installed,1);assert.equal(mesher.busy,false);
  mesher.request();assert.equal(messages[3].previous,undefined,'Cancel forces a fresh baseline after undo/import');worker.onerror();assert.ok(terminated);assert.equal(installed,2);assert.equal(mesher.busy,false);
 }finally{mesher.dispose();t.dispose();}
});


test('expanded mainland adds dry land and clear flat buildable lowlands beyond the old coast',()=>{
 const t=new Terrain();try{
  const nav=new Navigation(t);let oldLand=0,newLand=0,newFlat=0;
  for(let j=1;j<GRID-1;j++)for(let i=1;i<GRID-1;i++){
   const x=(i+.5)*STEP-EXTENT/2,z=(j+.5)*STEP-EXTENT/2,old=mountainArchipelagoHeight(x,z),v=t.values[j*GRID+i];
   if(old>=3.5)oldLand++;if(v>=3.5)newLand++;
   if(old<3.5&&v>=5&&v<8&&nav.safe(x,z)&&[[-1,-1],[-1,1],[1,-1],[1,1]].every(([dx,dz])=>t.level(x+dx,z+dz)===t.level(x,z)))newFlat++;
  }
  assert.ok(newLand>oldLand*1.15,`Land increases at least 15%: ${oldLand} -> ${newLand}`);
  assert.ok(newFlat>1500,`New flat construction ground: ${newFlat}`);
 }finally{t.dispose();}
});
test('version 13 migration preserves occupied ground, individual edits and every saved job exactly once',()=>{
 const t=new Terrain();try{
  const old=t.values.map((_,k)=>mountainArchipelagoHeight((k%GRID+.5)*STEP-EXTENT/2,(Math.floor(k/GRID)+.5)*STEP-EXTENT/2));
  const world=newWorld();world.camp={x:-5,z:3};const edit=210*GRID+310;old[edit]=8.123;
  const data=JSON.parse(legacySave(old,world));data.version=13;const saved=decodeSave(JSON.stringify(data));
  assert.equal(saved.version,18);assert.ok(saved.archipelagoUpgraded);assert.deepEqual(saved.world,world);assert.equal(saved.terrain[edit],old[edit]);
  for(let k=0;k<old.length;k++){const x=(k%GRID+.5)*STEP-EXTENT/2,z=(Math.floor(k/GRID)+.5)*STEP-EXTENT/2;if(Math.hypot(x+5,z-3)<17)assert.equal(saved.terrain[k],old[k]);}
  assertTerrain(decodeSave(encodeSave(new Float32Array(saved.terrain),world)).terrain,saved.terrain);
 }finally{t.dispose();}
});

test('brush edits preserve distant rock transforms and changing one candidate cannot reseed the map',()=>{
 const t=new Terrain(),landscape=new Landscape(t),world=newWorld();try{
  landscape.update(world);
  const snapshot=()=>new Map(['Upland rocks','Shoreline boulders'].flatMap(name=>{
   const mesh=landscape.group.getObjectByName(name),items=[];
   for(let i=0;i<mesh.count;i++){const m=Array.from(mesh.instanceMatrix.array.slice(i*16,i*16+16));items.push([`${name}:${m[12]},${m[14]}`,m]);}return items;
  }));
  const before=snapshot();assert.ok(before.size>30);
  const target=[...before.values()].find(m=>t.level(m[12],m[14])>=6)??[...before.values()][0];const x=target[12],z=target[14];
  t.sculpt(x,z,2,'lower',.8);landscape.terrainChanged();landscape.update(world);
  const after=snapshot();let checked=0;
  for(const [key,m] of before)if(Math.hypot(m[12]-x,m[14]-z)>12){assert.deepEqual(after.get(key),m,`Distant rock ${key}`);checked++;}
  for(const [key,m] of after)if(Math.hypot(m[12]-x,m[14]-z)>12)assert.ok(before.has(key),'No new distant rocks');
  assert.ok(checked>20);
 }finally{landscape.dispose();t.dispose();}
});
test('spatial sections share seamless flat edges, contain their geometry and localize boundary edits',()=>{
 const values=new Float32Array(GRID*GRID).fill(7.25),before=values.slice();before[150*GRID+150]=7.24;
 const dirty=affectedTerrainChunks(values,before);assert.equal(dirty.length,4,'Four sections share this brush boundary');
 const parts=buildTerrainChunks(values,before),width=TERRAIN_CHUNK_SIZE*STEP;
 for(const part of parts){
  if(!part.position.length)continue;
  const minX=part.chunk%TERRAIN_CHUNKS*width-EXTENT/2,minZ=Math.floor(part.chunk/TERRAIN_CHUNKS)*width-EXTENT/2;
  let top=-Infinity;for(let i=1;i<part.position.length;i+=3)top=Math.max(top,part.position[i]);let area=0;
  for(let i=0;i<part.position.length;i+=3){const [x,y,z]=part.position.slice(i,i+3);assert.ok(x>=minX-.00001&&x<=minX+width+.00001&&z>=minZ-.00001&&z<=minZ+width+.00001);assert.ok(Math.abs(part.normal[i+1])>.99,'No artificial wall through a flat interior section');}
  for(let i=0;i<part.position.length;i+=9){const a=part.position.slice(i,i+9);if([a[1],a[4],a[7]].every(y=>Math.abs(y-top)<.00001))area+=Math.abs((a[3]-a[0])*(a[8]-a[2])-(a[6]-a[0])*(a[5]-a[2]))*.5;}
  assert.ok(Math.abs(area-width*width)<.01,`Complete top surface without gaps or overlaps: ${area}`);
 }
 assert.equal(affectedTerrainChunks(values,values).length,0);
});
test('Mini God removes untouched mountain/tableland terrain while preserving version 14 edits and village state',()=>{
 const old=new Float32Array(GRID*GRID);for(let k=0;k<old.length;k++)old[k]=waterfallArchipelagoHeight((k%GRID+.5)*STEP-EXTENT/2,(Math.floor(k/GRID)+.5)*STEP-EXTENT/2);
 const world=newWorld();world.camp={x:5,z:6};const edit=190*GRID+170;old[edit]=11.123;
 const data=JSON.parse(legacySave(old,world));data.version=14;const next=decodeSave(JSON.stringify(data));
 assert.equal(next.version,18);assert.deepEqual(next.world,world);assert.equal(next.terrain[edit],old[edit]);
 assert.ok(next.terrain.some((v,k)=>old[k]>12&&v<10.5),'Untouched high ground is reduced');
 assertTerrain(decodeSave(encodeSave(new Float32Array(next.terrain),world)).terrain,next.terrain);
});
test('ocean motion is half speed and followers no longer create tracks',()=>{
 const t=new Terrain(),ocean=createOcean(t),sim=new Settlement(t);try{
  ocean.update(12);assert.equal(ocean.mesh.material.uniforms.time.value,6);
  sim.add(2);for(let i=0;i<600;i++)sim.advance(.1,false);assert.equal(sim.state.trails.length,0);
 }finally{ocean.dispose();t.dispose();}
});

test('broad mainland increases usable settlement ground and reduces contour complexity',()=>{
 const t=new Terrain();try{
  let oldMain=0,newMain=0,flat=0;
  const nav=new Navigation(t);
  for(let j=1;j<GRID-1;j++)for(let i=1;i<GRID-1;i++){
    const x=(i+.5)*STEP-EXTENT/2,z=(j+.5)*STEP-EXTENT/2;
    if(miniGodArchipelagoHeight(x,z)>=3.5&&Math.hypot(x/99,z/73)<1.1)oldMain++;
    if(t.values[j*GRID+i]>=3.5&&Math.hypot(x/99,z/73)<1.1)newMain++;
    if(Math.abs(x)<75&&Math.abs(z)<48&&t.level(x,z)>=9&&nav.safe(x,z)&&[[-2,-2],[-2,2],[2,-2],[2,2]].every(([dx,dz])=>t.level(x+dx,z+dz)===t.level(x,z)))flat++;
  }
  assert.ok(newMain>oldMain*1.2,`${oldMain} -> ${newMain} mainland samples`);assert.ok(flat>15000,`Large construction clearings: ${flat}`);
  const vertices=t.group.children.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0);assert.ok(vertices<1000000,`Simpler terrain: ${vertices} vertices`);
  assert.equal(ISLETS.length,3);
 }finally{t.dispose();}
});
test('version 15 migration preserves established villages and edits while simplifying untouched surroundings',()=>{
 const t=new Terrain();try{
  const old=t.values.map((_,k)=>miniGodArchipelagoHeight((k%GRID+.5)*STEP-EXTENT/2,(Math.floor(k/GRID)+.5)*STEP-EXTENT/2));
  const world=newWorld();world.camp={x:69,z:60};const edit=205*GRID+230;old[edit]=9.123;
  const data=JSON.parse(legacySave(old,world));data.version=15;const next=decodeSave(JSON.stringify(data));
  assert.equal(next.version,18);assert.deepEqual(next.world,world);assert.equal(next.terrain[edit],old[edit]);
  for(let k=0;k<old.length;k++){const x=(k%GRID+.5)*STEP-EXTENT/2,z=(Math.floor(k/GRID)+.5)*STEP-EXTENT/2;if(Math.hypot(x-69,z-60)<17)assert.equal(next.terrain[k],old[k]);}
  assertTerrain(decodeSave(encodeSave(new Float32Array(next.terrain),world)).terrain,next.terrain);
 }finally{t.dispose();}
});


test('natural mainland has broad inlets and distinct regional tree species',()=>{
  for(const [x,z,biome] of [[-50,-35,'pine'],[40,-35,'birch'],[-50,35,'acacia'],[45,40,'blossom'],[0,40,'mango'],[65,0,'palm']])assert.equal(vegetationBiome(x,z),biome);
  for(const [x,z] of [[58,55],[-83,-22],[35,-66]])assert.ok(archipelagoHeight(x,z)<3.5,'Bay remains water');
  assert.ok(archipelagoHeight(0,0)>6,'Central settlement heart stays dry');
});
test('version 16 coastline migration preserves villages and player sculpts',()=>{
 const old=new Float32Array(GRID*GRID);
 for(let k=0;k<old.length;k++)old[k]=broadMainlandHeight((k%GRID+.5)*STEP-EXTENT/2,(Math.floor(k/GRID)+.5)*STEP-EXTENT/2);
 const world=newWorld();world.camp={x:0,z:0};const edit=100*GRID+120;old[edit]=8.123;
 const data=JSON.parse(legacySave(old,world));data.version=16;const next=decodeSave(JSON.stringify(data));
 assert.equal(next.version,18);assert.ok(next.archipelagoUpgraded);assert.deepEqual(next.world,world);assert.equal(next.terrain[edit],old[edit]);
 assert.equal(next.terrain[200*GRID+200],old[200*GRID+200]);
 assertTerrain(decodeSave(encodeSave(new Float32Array(next.terrain),world)).terrain,next.terrain);
});


test('ocean camera covers portrait, maximum zoom and low pitch without near/far clipping',()=>{
 for(const aspect of [.2,390/844,1,2.8])for(const pitch of [.4,.82,Math.PI/2-.001]){
  const h=aspect<1?150/aspect:150,{distance,far}=oceanCameraFit(h,pitch);
  const nearWater=distance-h/Math.tan(pitch),farWater=distance+h/Math.tan(pitch);
  assert.ok(nearWater>100);assert.ok(farWater<far-100);
 }
 const t=new Terrain(),ocean=createOcean(t);try{
  assert.ok(ocean.mesh.geometry.attributes.position.count<20000,'Coarse water mesh');
  ocean.setWaterContacts([{x:3,z:5,radius:.5}]);assert.equal(ocean.mesh.material.uniforms.contactCount.value,1);
  ocean.setWaterContacts([]);assert.equal(ocean.mesh.material.uniforms.contactCount.value,0);
 }finally{ocean.dispose();t.dispose();}
});

test('version 18 compact terrain preserves layers, upgrades v17 and caches unchanged terrain',async()=>{
 const {createSaveEncoder,encodeTerrain}=await import(pathToFileURL(resolve(temp,'save.mjs')));
 const t=new Terrain();try{
  const world=newWorld(),old=legacySave(t.values,world),v17=decodeSave(old);
  assert.deepEqual(v17.terrain,Array.from(t.values),'Version 17 loads losslessly');
  const raw=encodeSave(new Float32Array(v17.terrain),v17.world),payload=JSON.parse(raw);
  assert.equal(payload.version,18);assert.equal(typeof payload.terrain,'string');assert.ok(raw.length<old.length/3);
  const next=decodeSave(raw);assertTerrain(next.terrain,v17.terrain);assert.deepEqual(next.world,world);
  const values=t.values.slice();for(let i=0;i<32;i++)for(let j=0;j<3;j++)values[i*3+j]=.5+i*.5+(j-1)*.00001;
  assertTerrain(decodeSave(encodeSave(values,world)).terrain,Array.from(values));
  const encode=createSaveEncoder(),first=JSON.parse(encode(values,world,0));values[100]=6.75;world.food++;
  const cached=JSON.parse(encode(values,world,0));assert.equal(cached.terrain,first.terrain);assert.equal(cached.world.food,world.food);
  const changed=JSON.parse(encode(values,world,1));assert.notEqual(changed.terrain,first.terrain);
  assert.equal(changed.terrain,encodeTerrain(values));
  for(const terrain of [payload.terrain.slice(4),'!'+payload.terrain.slice(1),[],payload.terrain+'AAAA'])assert.throws(()=>decodeSave(JSON.stringify({...payload,terrain})));
  assert.equal(encodeTerrain(new Float32Array(next.terrain)),payload.terrain,'Repeated saves do not drift');
 }finally{t.dispose();}
});

test('ocean shelf worker keeps the previous field and discards obsolete coastlines',()=>{
 const t=new Terrain(),requests=[],worker={postMessage(m){requests.push(m);},terminate(){this.ended=true;}};
 const shore=new Shoreline(t,true,()=>worker);
 try{
  assert.equal(requests.length,1);assert.equal(shore.distances[0],1000);
  t.texture.needsUpdate=true;shore.update();
  const result=(id,value)=>({data:{id,distances:new Float32Array(GRID*GRID).fill(value),shelfDepths:new Float32Array(GRID*GRID).fill(.5),sea:new Uint8Array(GRID*GRID).fill(1)}});
  worker.onmessage(result(requests[0].id,99));assert.equal(requests.length,2);assert.equal(shore.distances[0],1000);
  worker.onmessage(result(requests[1].id,3));assert.equal(shore.distances[0],3);assert.ok(shore.isOceanCell(0));
  const version=shore.texture.version;shore.update();assert.equal(shore.texture.version,version);
  shore.dispose();assert.ok(worker.ended);
 }finally{shore.dispose();t.dispose();}
});
