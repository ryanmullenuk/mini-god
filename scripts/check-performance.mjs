import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
mkdirSync('work',{recursive:true});const temp=mkdtempSync(resolve('work/performance-tests-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
for(const name of ['terrain','navigation','islanders','terrain-picking']){
 const source=readFileSync(`lib/game/${name}.ts`,'utf8');
 writeFileSync(resolve(temp,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'"));
}
const {Navigation}=await import(pathToFileURL(resolve(temp,'navigation.mjs')));
const {Islanders}=await import(pathToFileURL(resolve(temp,'islanders.mjs')));
const {Terrain,tropicalArchipelagoHeight,archipelagoHeight,GRID,STEP,EXTENT}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));

test('cached detours are independent, exact and invalidated for terrain and buildings',()=>{
 let samples=0,flooded=false,wall=true;
 const nav=new Navigation({level(x,z){samples++;return !flooded&&Math.abs(x)<12&&Math.abs(z)<12?8:0;}},(x,z)=>wall&&Math.abs(x)<1&&z<4);
 const a={x:-3,z:0},b={x:3,z:0},route=nav.route(a,b);assert.ok(route.length>1);
 const expected=structuredClone(route);route[0].x=999;route.shift();samples=0;
 assert.deepEqual(nav.route(a,b),expected);assert.equal(samples,0);
 // A changed endpoint must never use a quantized neighbour's cached answer.
 assert.equal(nav.route(a,{x:0,z:0}),null);
 wall=false;nav.invalidate();assert.deepEqual(nav.route(a,b),[b]);
 flooded=true;nav.invalidate();assert.equal(nav.route(a,b),null);samples=0;
 assert.equal(nav.route(a,b),null);assert.equal(samples,0);
 flooded=false;nav.invalidate();assert.deepEqual(nav.route(a,b),[b]);
});

test('cached grid edges reduce terrain sampling for different starting points',()=>{
 let samples=0;
 const nav=new Navigation({level(x,z){samples++;return Math.abs(x)<12&&Math.abs(z)<12?8:0;}},(x,z)=>Math.abs(x)<1&&z<4);
 assert.ok(nav.route({x:-3,z:0},{x:3,z:0}));const cold=samples;samples=0;
 const start={x:-3,z:.01},route=nav.route(start,{x:3,z:0});assert.ok(route);assert.ok(samples<cold/2);
 let previous=start;for(const next of route){assert.ok(nav.segment(previous,next));previous=next;}
 for(let i=0;i<300;i++)nav.route({x:-3,z:i/1000},{x:-4,z:0});
 assert.ok(nav.routes.size<=256,'The route cache must remain bounded');
});

test('100 islanders share bounded resources, retain joints and dispose once',()=>{
 const terrain={level:()=>8,height:()=>2},people=new Islanders(terrain);
 people.add(10);
 const resources=()=>{const geometries=new Set(),materials=new Set();let visible=0;people.group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});people.group.traverseVisible(o=>{if(o.isMesh)visible++;});return {geometries,materials,visible};};
 const small=resources();people.add(90);const large=resources();
 assert.equal(large.geometries.size,small.geometries.size);assert.equal(large.materials.size,small.materials.size);
 assert.ok(large.visible<=1500);assert.equal(people.people.length,100);
 const rig=people.people[0];assert.ok(rig.skirt.parent);assert.equal(rig.hammer.parent,rig.arms[1].elbow);assert.equal(rig.carried.children.length,2);
 const disposals=new Map();for(const asset of [...large.geometries,...large.materials])asset.addEventListener('dispose',()=>disposals.set(asset,(disposals.get(asset)??0)+1));
 people.clear();for(const asset of [...large.geometries,...large.materials])assert.equal(disposals.get(asset),1);
 people.add(2);assert.equal(people.people.length,2);people.dispose();
});

test('terrain bounds preserve exact ray hits across a sculpted chunk replacement',()=>{
 const terrain=new Terrain();try{
  terrain.sculpt(-4,3,4,'raise',.7);terrain.rebuild();terrain.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(-4,30,3),new THREE.Vector3(0,-1,0));
  assert.ok(terrain.group.children.every(m=>m.geometry.boundingBox));
  const bounded=ray.intersectObjects(terrain.group.children).map(h=>h.distance);
  for(const mesh of terrain.group.children)mesh.geometry.boundingBox=null;
  assert.deepEqual(ray.intersectObjects(terrain.group.children).map(h=>h.distance),bounded);assert.ok(bounded.length);
 }finally{terrain.dispose();}
});

const {pickTerrain}=await import(pathToFileURL(resolve(temp,'terrain-picking.mjs')));
test('heightmap picking handles orthographic rays, risers and empty sea without meshes',()=>{
 let reads=0;const terrain={height(x){reads++;return x<0?1:3;}};
 const vertical=new THREE.Ray(new THREE.Vector3(-2,300,0),new THREE.Vector3(0,-1,0));
 const hit=pickTerrain(vertical,terrain,2000);assert.ok(Math.abs(hit.y-1)<.001);assert.equal(hit.x,-2);assert.ok(reads<50,'Empty sky is clipped');
 const cliff=pickTerrain(new THREE.Ray(new THREE.Vector3(-4,2,0),new THREE.Vector3(1,0,0)),terrain,100);
 assert.ok(Math.abs(cliff.x)<.001);assert.equal(cliff.y,2);
 reads=0;assert.equal(pickTerrain(new THREE.Ray(new THREE.Vector3(300,30,0),new THREE.Vector3(0,-1,0)),terrain,2000),null);assert.equal(reads,0);
 assert.equal(pickTerrain(vertical,terrain,10),null);
});

test('tropical generation adds editable peaks while retaining clearings and open bays',()=>{
 assert.ok(tropicalArchipelagoHeight(39,-32)>15);
 assert.ok(tropicalArchipelagoHeight(0,0)>=6);
 for(const [x,z] of [[58,55],[58,75],[-98,-31],[40,-84]])assert.ok(tropicalArchipelagoHeight(x,z)<3.5);
 for(const [x,z] of [[-24,14],[36,4],[12,-35]])assert.ok(tropicalArchipelagoHeight(x,z)<3.5,'Pools stay open');
 const terrain=new Terrain();try{
  for(let k=0;k<terrain.values.length;k+=127){const x=(k%GRID+.5)*STEP-EXTENT/2,z=(Math.floor(k/GRID)+.5)*STEP-EXTENT/2;assert.equal(terrain.values[k],Math.fround(tropicalArchipelagoHeight(x,z)));}
  const oldHeight=archipelagoHeight(39,-32);assert.ok(oldHeight<10.35,'Historical generation remains stable for migrations');
 }finally{terrain.dispose();}
});
