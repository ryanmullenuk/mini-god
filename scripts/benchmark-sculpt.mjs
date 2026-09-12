import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
mkdirSync('work',{recursive:true});const temp=mkdtempSync(resolve('work/sculpt-bench-'));
for(const name of ['terrain']){const source=readFileSync(`lib/game/${name}.ts`,'utf8');writeFileSync(resolve(temp,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);}
try{const {Terrain,buildTerrainChunks}=await import(pathToFileURL(resolve(temp,'terrain.mjs')));const t=new Terrain();const before=t.values.slice();for(let i=0;i<4;i++)t.sculpt(-4,3,4,'raise',.3);const start=performance.now();t.rebuild();console.log(JSON.stringify({fullRebuildMs:Math.round(performance.now()-start),meshes:t.group.children.length,vertices:t.group.children.reduce((n,m)=>n+m.geometry.attributes.position.count,0)}));if(buildTerrainChunks){const start=performance.now(),result=buildTerrainChunks(t.values,before);console.log(JSON.stringify({affectedSectionMs:Math.round(performance.now()-start),affectedSections:result.map(r=>r.chunk)}));}t.dispose();}finally{rmSync(temp,{recursive:true,force:true});}
