import {buildTerrainChunks,type Terrain,type TerrainChunkData} from './terrain';
type Request={id:number;values:Float32Array};
/** One active build and one replaceable pending snapshot; never replay a stale edit. */
export class TerrainMesher{
 private worker:Worker|null=null;
 private latest=0;
 private active:Request|null=null;
 private pending:Request|null=null;
 private rendered:Float32Array|undefined;
 private disposed=false;
 constructor(private terrain:Terrain,private installed:()=>void,createWorker=()=>new Worker(new URL('./terrain-worker.ts',import.meta.url),{type:'module'})){
  this.rendered=terrain.values.slice();
  try{this.worker=createWorker();this.worker.onmessage=e=>this.complete(e.data);this.worker.onerror=()=>this.fallback();}catch{this.worker=null;}
 }
 get busy(){return !!this.active||!!this.pending;}
 request(){this.pending={id:++this.latest,values:this.terrain.values.slice()};this.pump();}
 cancel(){this.latest++;this.pending=null;this.rendered=undefined;}
 syncBaseline(){this.rendered=this.terrain.values.slice();}
 private pump(){
  if(this.disposed||this.active||!this.pending)return;
  this.active=this.pending;this.pending=null;
  if(!this.worker){this.fallback();return;}
  const values=this.active.values.slice(),previous=this.rendered?.slice(),transfer=[values.buffer];if(previous)transfer.push(previous.buffer);
  this.worker.postMessage({id:this.active.id,values,previous},transfer);
 }
 private complete(result:{id:number;data:TerrainChunkData[];error?:boolean}){
  if(this.disposed||!this.active||result.id!==this.active.id)return;
  if(result.error){this.fallback();return;}
  if(result.id===this.latest){this.terrain.installChunks(result.data);this.rendered=this.active.values;this.installed();}
  this.active=null;this.pump();
 }
 private fallback(){
  this.worker?.terminate();this.worker=null;
  if(this.disposed)return;
  // Preserve correctness in environments that cannot create background workers.
  const needed=!!this.pending||this.active?.id===this.latest;this.active=null;this.pending=null;
  if(needed){this.terrain.installChunks(buildTerrainChunks(this.terrain.values,this.rendered));this.rendered=this.terrain.values.slice();this.installed();}
 }
 dispose(){this.disposed=true;this.latest++;this.pending=null;this.active=null;this.worker?.terminate();}
}
