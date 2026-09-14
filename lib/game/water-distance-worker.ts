import { Terrain, scalarLevel } from './terrain';
import { waterDistanceSteps } from './terrain-metadata';
self.onmessage = (event: MessageEvent<{id:number;values:Float32Array}>) => {
  const {id,values}=event.data;
  const terrain={level:(x:number,z:number)=>scalarLevel(Terrain.prototype.sample.call({values} as Terrain,x,z))};
  const steps=waterDistanceSteps(terrain);
  for(;;){const result=steps.next();if(result.done){
    self.postMessage({id,distances:result.value},{transfer:[result.value.buffer]});return;
  }}
};
