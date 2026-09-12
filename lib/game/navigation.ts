import { EXTENT, FIRST_DRY_LAYER, GRID, STEP, type Terrain } from './terrain';
import type { Point } from './world-state';

const OFFSETS = [[.33,0],[-.33,0],[0,.33],[0,-.33],[.23,.23],[.23,-.23],[-.23,.23],[-.23,-.23]];
const LIMIT = EXTENT / 2 - STEP;
export function walkingClearance(terrain:Pick<Terrain,'level'>,x:number,z:number) {
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>=LIMIT||Math.abs(z)>=LIMIT)return false;
  let low=terrain.level(x,z),high=low;
  if(!Number.isInteger(low)||low<FIRST_DRY_LAYER)return false;
  for(const [dx,dz] of OFFSETS){
    const l=terrain.level(x+dx,z+dz);
    if(!Number.isInteger(l)||l<FIRST_DRY_LAYER)return false;
    low=Math.min(low,l);high=Math.max(high,l);
    // A body may straddle one riser. Two risers in this footprint mean the
    // intervening tread is too narrow, even if interpolation makes it visible.
    if(high-low>1)return false;
  }
  return true;
}
export class Navigation {
  private cached = new Map<number, boolean>();
  constructor(private terrain: Pick<Terrain, 'level'>, private blocked: (x: number, z: number) => boolean = () => false) {}
  invalidate() { this.cached.clear(); }
  safe(x: number, z: number) {
    return walkingClearance(this.terrain,x,z)&&!this.blocked(x,z);
  }
  segment(a: Point, b: Point) {
    if (!this.safe(a.x,a.z)) return false;
    let level = this.terrain.level(a.x,a.z);
    const n = Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.12));
    for(let k=1;k<=n;k++){
      const x=a.x+(b.x-a.x)*k/n,z=a.z+(b.z-a.z)*k/n,next=this.terrain.level(x,z);
      if(!this.safe(x,z)||Math.abs(next-level)>1)return false;
      level=next;
    }
    return true;
  }
  point(k: number): Point { return {x:(k%GRID+.5)*STEP-EXTENT/2,z:(Math.floor(k/GRID)+.5)*STEP-EXTENT/2}; }
  private node(p: Point) {
    const i=Math.floor((p.x+EXTENT/2)/STEP),j=Math.floor((p.z+EXTENT/2)/STEP);
    let best=-1,distance=Infinity;
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
      const x=i+dx,z=j+dz;if(x<1||z<1||x>=GRID-1||z>=GRID-1)continue;
      const k=z*GRID+x,q=this.point(k),d=Math.hypot(p.x-q.x,p.z-q.z);
      if(d<distance&&this.segment(p,q)){best=k;distance=d;}
    }
    return best;
  }
  nearest(p: Point, radius=12): Point | null {
    if(this.safe(p.x,p.z)) return {x:p.x,z:p.z};
    for(let r=.5;r<=radius;r+=.5)for(let k=0;k<Math.ceil(r*12);k++){
      const a=k/Math.ceil(r*12)*Math.PI*2,q={x:p.x+Math.sin(a)*r,z:p.z+Math.cos(a)*r};
      if(this.safe(q.x,q.z))return q;
    }
    return null;
  }
  route(from: Point, to: Point): Point[] | null {
    if(this.segment(from,to))return [{x:to.x,z:to.z}];
    if(!this.safe(from.x,from.z)||!this.safe(to.x,to.z))return null;
    const start=this.node(from),end=this.node(to);if(start<0||end<0)return null;
    const parent=new Int32Array(GRID*GRID).fill(-1),queue=new Int32Array(GRID*GRID);
    let head=0,tail=1;queue[0]=start;parent[start]=start;
    while(head<tail&&parent[end]<0){
      const k=queue[head++],i=k%GRID,j=Math.floor(k/GRID),p=this.point(k);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const ni=i+dx,nj=j+dz;if(ni<1||nj<1||ni>=GRID-1||nj>=GRID-1)continue;
        const n=nj*GRID+ni;if(parent[n]>=0)continue;
        let safe=this.cached.get(n);const q=this.point(n);
        if(safe===undefined){safe=this.safe(q.x,q.z);this.cached.set(n,safe);}
        if(!safe||!this.segment(p,q))continue;
        parent[n]=k;queue[tail++]=n;
      }
    }
    if(parent[end]<0)return null;
    const reversed:Point[]=[];let at=end;
    while(at!==start){reversed.push(this.point(at));at=parent[at];}
    reversed.push(this.point(start));reversed.reverse();reversed.push({x:to.x,z:to.z});
    // Remove redundant corners only when the full shortcut is safe.
    const result:Point[]=[];let anchor=from,index=0;
    while(index<reversed.length){let far=index;while(far+1<reversed.length&&this.segment(anchor,reversed[far+1]))far++;
      anchor=reversed[far];result.push(anchor);index=far+1;}
    return result;
  }
}
