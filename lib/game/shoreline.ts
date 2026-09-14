import * as THREE from 'three';
import {GRID, STEP, FIRST_DRY_LAYER, layerThreshold, type Terrain} from './terrain';

/** Distance from land in world units, restricted to water connected to the sea.
 * Rebuilt only with terrain edits; enclosed pools never receive ocean breakers.
 */
export class Shoreline {
  readonly distances=new Float32Array(GRID*GRID);
  readonly shelfDepths=new Float32Array(GRID*GRID);
  readonly shelfTexture=new THREE.DataTexture(this.shelfDepths,GRID,GRID,THREE.RedFormat,THREE.FloatType);
  private nearestLand=new Int32Array(GRID*GRID);
  readonly texture=new THREE.DataTexture(this.distances,GRID,GRID,THREE.RedFormat,THREE.FloatType);
  private sea=new Uint8Array(GRID*GRID);
  private queue=new Int32Array(GRID*GRID);
  private version=-1;
  private worker:Worker|null=null;
  private active=false;
  private pending:{id:number;values:Float32Array}|null=null;
  private disposed=false;
  constructor(private terrain:Pick<Terrain,'values'|'texture'>,background=typeof window!=='undefined',
    createWorker=()=>new Worker(new URL('./shoreline-worker.ts',import.meta.url),{type:'module'})){
    if(background){try{
      this.worker=createWorker();
      this.worker.onmessage=e=>{
        if(this.disposed)return;
        this.active=false;
        const result=e.data;
        if(result.id===this.version){
          this.distances.set(result.distances);this.shelfDepths.set(result.shelfDepths);this.sea.set(result.sea);
          this.texture.needsUpdate=true;this.shelfTexture.needsUpdate=true;
        }
        this.pump();
      };
      // Retain the last valid visual shelf if a worker fails. Navigation and
      // gameplay water metadata are independent and still use live terrain.
      this.worker.onerror=()=>{this.worker?.terminate();this.worker=null;this.active=false;this.pending=null;};
      this.distances.fill(1000);this.shelfDepths.fill(1);
    }catch{this.worker=null;}}

    this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;
    this.shelfTexture.minFilter=THREE.LinearFilter;this.shelfTexture.magFilter=THREE.LinearFilter;
    this.update();
  }
  isOceanCell(index:number){return this.sea[index]===1;}
  update(){
    if(this.version===this.terrain.texture.version)return;
    this.version=this.terrain.texture.version;
    if(this.worker){this.pending={id:this.version,values:this.terrain.values.slice()};this.pump();return;}
    const d=this.distances,sea=this.sea,values=this.terrain.values,threshold=layerThreshold(FIRST_DRY_LAYER);
    sea.fill(0);let head=0,tail=0;
    const enqueue=(k:number)=>{if(!sea[k]&&values[k]<threshold){sea[k]=1;this.queue[tail++]=k;}};
    for(let i=0;i<GRID;i++){enqueue(i);enqueue((GRID-1)*GRID+i);enqueue(i*GRID);enqueue(i*GRID+GRID-1);}
    while(head<tail){const k=this.queue[head++],x=k%GRID;
      if(x>0)enqueue(k-1);if(x<GRID-1)enqueue(k+1);if(k>=GRID)enqueue(k-GRID);if(k<d.length-GRID)enqueue(k+GRID);
    }
    for(let k=0;k<d.length;k++){d[k]=values[k]>=threshold?0:1000;this.nearestLand[k]=values[k]>=threshold?k:-1;}
    const diagonal=STEP*Math.SQRT2;
    const relax=(k:number,n:number,cost:number)=>{if(d[n]+cost<d[k]){d[k]=d[n]+cost;this.nearestLand[k]=this.nearestLand[n];}};
    for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
      const k=z*GRID+x;if(x)relax(k,k-1,STEP);
      if(z){relax(k,k-GRID,STEP);if(x)relax(k,k-GRID-1,diagonal);if(x<GRID-1)relax(k,k-GRID+1,diagonal);}
    }
    for(let z=GRID-1;z>=0;z--)for(let x=GRID-1;x>=0;x--){
      const k=z*GRID+x;if(x<GRID-1)relax(k,k+1,STEP);
      if(z<GRID-1){relax(k,k+GRID,STEP);if(x)relax(k,k+GRID-1,diagonal);if(x<GRID-1)relax(k,k+GRID+1,diagonal);}
    }
    // A visual bathymetry field: broad shelves at beaches, narrow at cliffs.
    // Nearest-coast distances merge naturally in channels and bays. This is
    // rendering data only; editable seabed heights and navigation are unchanged.
    for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
      const k=z*GRID+x,land=this.nearestLand[k];
      if(values[k]>=threshold){this.shelfDepths[k]=0;continue;}
      if(!sea[k]){this.shelfDepths[k]=Math.min(1,Math.max(0,(threshold-values[k])/5.5));continue;}
      if(land<0||d[k]>40){this.shelfDepths[k]=1;continue;}
      const lx=land%GRID,lz=Math.floor(land/GRID),dx=lx-x,dz=lz-z,length=Math.max(1,Math.hypot(dx,dz));
      let inland=values[land],shelter=0;
      for(const radius of [2,4,7]){
        const px=Math.max(0,Math.min(GRID-1,Math.round(lx+dx/length*radius))),pz=Math.max(0,Math.min(GRID-1,Math.round(lz+dz/length*radius)));
        inland=Math.max(inland,values[pz*GRID+px]);
      }
      for(const [ox,oz] of [[14,0],[-14,0],[0,14],[0,-14],[10,10],[10,-10],[-10,10],[-10,-10]]){
        const px=x+ox,pz=z+oz;if(px>=0&&px<GRID&&pz>=0&&pz<GRID&&values[pz*GRID+px]>=threshold)shelter++;
      }
      const organic=.88+.10*Math.sin(x*.083+Math.sin(z*.047)*2)+.09*Math.cos(z*.071-x*.026);
      const width=24/(1+Math.max(0,inland-4.2)*.45)*organic*(1+shelter*.045);
      const existingDepth=Math.min(1,Math.max(0,(threshold-values[k])/5.5));
      this.shelfDepths[k]=Math.min(1,Math.max(0,Math.min((d[k]-STEP*.5)/width,existingDepth)));
    }
    for(let k=0;k<d.length;k++)d[k]=sea[k]?Math.max(0,d[k]-STEP*.5):values[k]>=threshold?0:1000;
    this.texture.needsUpdate=true;this.shelfTexture.needsUpdate=true;
  }
  private pump(){
    if(this.active||!this.pending||!this.worker||this.disposed)return;
    const request=this.pending;this.pending=null;this.active=true;
    this.worker.postMessage(request,[request.values.buffer]);
  }
  /** Worker result contains only render/marine fields, never terrain geometry. */
  snapshot(){return {distances:this.distances,shelfDepths:this.shelfDepths,sea:this.sea};}
  dispose(){this.disposed=true;this.worker?.terminate();this.pending=null;this.texture.dispose();this.shelfTexture.dispose();}
}
