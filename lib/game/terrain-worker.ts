import {buildTerrainChunks} from './terrain';
const worker=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown,transfer:Transferable[])=>void};
worker.onmessage=event=>{
 const {id,values,previous}=event.data;
 try{const data=buildTerrainChunks(values,previous);worker.postMessage({id,data},data.flatMap(d=>[d.position.buffer,d.normal.buffer,d.color.buffer]) as ArrayBuffer[]);}
 catch{worker.postMessage({id,error:true},[]);}
};
