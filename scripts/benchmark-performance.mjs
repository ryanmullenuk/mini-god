import {mkdtempSync,mkdirSync,readdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
// Optional git revision gives the same workload against the unmodified implementation.
const revision=process.argv[2];
mkdirSync('work',{recursive:true});const temp=mkdtempSync(resolve('work/performance-bench-'));
try{
 for(const name of readdirSync('lib/game').filter(n=>n.endsWith('.ts'))){
  const path=`lib/game/${name}`,source=revision?execFileSync('git',['show',`${revision}:${path}`],{encoding:'utf8'}):readFileSync(path,'utf8');
  writeFileSync(resolve(temp,name.replace('.ts','.mjs')),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/([a-z-]+)['"]/g,"from './$1.mjs'"));
 }
 const {Navigation}=await import(pathToFileURL(resolve(temp,'navigation.mjs')));
 const {Terrain}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));
 const {Islanders}=await import(pathToFileURL(resolve(temp,'islanders.mjs')));
 let samples=0;
 const land={level(x,z){samples++;return Math.abs(x)<20&&Math.abs(z)<20?8:0;}};
 const nav=new Navigation(land,(x,z)=>Math.abs(x)<1&&z<8);
 const runs=[];
 for(let pass=0;pass<2;pass++){
  samples=0;const start=performance.now();let reached=0;
  for(let i=0;i<30;i++)if(nav.route({x:-5,z:-6+i*.15},{x:5,z:0}))reached++;
  runs.push({pass:pass?'warm':'cold',ms:+(performance.now()-start).toFixed(2),terrainSamples:samples,reached});
 }
 const terrain=new Terrain(),islanders=[];
 for(const count of [10,20,30]){
  const people=new Islanders(terrain);people.add(count);
  const geometries=new Set(),materials=new Set();let visibleMeshes=0;
  people.group.traverseVisible(o=>{if(o.isMesh){visibleMeshes++;geometries.add(o.geometry);materials.add(o.material);}});
  islanders.push({count,visibleMeshes,uniqueGeometries:geometries.size,uniqueMaterials:materials.size});people.dispose();
 }
 terrain.group.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),direction=new THREE.Vector3(.3,-1,.2).normalize();
 let hits=0;const start=performance.now();
 for(let i=0;i<200;i++){ray.set(new THREE.Vector3(-15+i%20*1.5,30,-10+Math.floor(i/20)*2),direction);hits+=ray.intersectObjects(terrain.group.children,false).length;}
 const picking={rays:200,ms:+(performance.now()-start).toFixed(2),hits};terrain.dispose();
 console.log(JSON.stringify({revision:revision??'working-tree',navigation:runs,islanders,picking},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
