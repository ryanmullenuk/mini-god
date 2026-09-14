import { Shoreline } from './shoreline';
import type { Terrain } from './terrain';
self.onmessage=(event:MessageEvent<{id:number;values:Float32Array<ArrayBuffer>}>)=>{
 const {id,values}=event.data;
 const shore=new Shoreline({values,texture:{version:id} as Terrain['texture']},false);
 const result=shore.snapshot();
 self.postMessage({id,...result},{transfer:[result.distances.buffer,result.shelfDepths.buffer,result.sea.buffer]});
 shore.dispose();
};
