import * as THREE from 'three';
import { contours } from 'd3-contour';

export const ISLAND_SCALE = 4;
export const GRID = 400, EXTENT = 58 * ISLAND_SCALE, STEP = EXTENT / GRID, SEA = -.05;
// Four times the world area; retain 0.58-unit sculpting samples and thin risers.
export const LAYER_INTERVAL = .5, FIRST_DRY_LAYER = 6;
export const LAYER_HEIGHTS = [-1.7,-1.4,-1.1,-.8,-.5,-.2,.10,.38,.66,.94,1.22,1.50,1.78,2.06,2.34,2.62,2.90,3.18,3.46,3.74,4.02,4.30,4.58,4.86,5.14,5.42,5.70,5.98,6.26,6.54,6.82,7.10];
export const LAYER_COUNT = LAYER_HEIGHTS.length;
export const layerThreshold = (l:number) => .5 + l * LAYER_INTERVAL;
export const scalarLevel = (h:number) => Math.max(-1,Math.min(LAYER_COUNT-1,Math.floor((h-.5)/LAYER_INTERVAL)));
export const PALETTE = ['#13374e','#1e536a','#29798a','#42aca8','#79cbbc','#b7e0c9','#f5e9bd','#f0dda5','#e4d08d','#c7d786','#b3d27b','#a0c56c','#8eb85e','#77aa51','#639b49','#518d44','#afac68','#b8a073','#a88c63','#8e7354','#898365','#888871','#818576','#7a8277','#737c77','#777f7c','#808885','#89928e','#939b96','#a0a69e','#b1b6ab','#c3c7bb'];
export const DESERT_PALETTE = [...PALETTE.slice(0,8),'#e9cc88','#e0c27e','#d9b875','#d4af6e','#d0a86a','#cba166','#c39a62','#bd915e','#ba885b','#b67e56','#a96f50','#946248','#97785c','#9c8063','#a18b6d','#a59477','#9c917c','#918a7b','#968e7d','#a39883','#ad9f89','#b5aa95','#c2b6a2','#d0c5b2'];
export const LAYER_NAMES = ['Deep seabed','Seabed','Ocean shelf','Lagoon','Shallows','Tidal shelf','Beach','Sand','Dune','Coastal grass','Light grass','Meadow','Grass','Rich grass','High grass','Dark grass','Upland soil','Earth','Dirt','High earth','Foothill','Upland','Ridge grass','Rocky grass','Lower rock','Rock','High rock','Crag','Summit rock','Pale rock','High summit','Peak'];
export type SculptMode = 'raise'|'lower'|'path';
export type SculptStroke = { readonly snapshot:Float32Array; readonly mode:SculptMode; readonly sourceLevel:number; readonly targetLevel:number };
export const POOLS = [
  {name:'Meadow pool',x:-24,z:14,rx:8.6,rz:6.6},
  {name:'Desert oasis',x:36,z:4,rx:7.4,rz:6.0},
  {name:'Hill pool',x:12,z:-35,rx:6,rz:5.2},
];
export const layerY = (l:number) => l < 0 ? -2 : LAYER_HEIGHTS[Math.min(LAYER_COUNT-1,l)];
export function desertWeight(x:number,z:number) {
  const biome=islandBiome(x,z);
  if(biome)return biome==='desert'?1:0;
  const nx=x/ISLAND_SCALE,nz=z/ISLAND_SCALE;
  const field=Math.exp(-((nx-9)**2/72+(nz+.5)**2/85));
  return THREE.MathUtils.smoothstep(field,.18,.64)*.35;
}
export function originalHeight(x:number,z:number) {
  const wx=x+1.2*Math.sin(z*.3)+.4*Math.sin(z*.9),wz=z+.7*Math.sin(x*.35);
  const q=(wx/21)**2+(wz/14.5)**2;
  return 5.65-q*5.5
    +5.4*Math.exp(-((x+4)**2/75+(z+3.5)**2/48))
    +3.7*Math.exp(-((x-10)**2/36+(z-2)**2/35))
    +2.2*Math.exp(-((x+12)**2/28+(z-5)**2/20))
    -2.7*Math.exp(-((x-2)**2/24+(z-10)**2/24))
    +.14*Math.sin(x*.67)*Math.cos(z*.57)+.08*Math.sin(x*1.12+z*.74);
}
export function mainlandHeight(x:number,z:number){
  const nx=x/ISLAND_SCALE,nz=z/ISLAND_SCALE;
  const base=originalHeight(nx,nz);
  // Wide, gently varying lowland plateaus leave room for whole villages.
  const meadow=6.25+.50*THREE.MathUtils.smoothstep(-nz,-2,8)
    +.50*THREE.MathUtils.smoothstep(-nx,1,10)+.07*Math.sin(nx*.35)*Math.cos(nz*.4);
  const mountains=4.4*Math.exp(-((nx+4)**2/19+(nz+6)**2/8))
    +2.5*Math.exp(-((nx+11)**2/9+(nz+1)**2/13));
  const beach=THREE.MathUtils.smoothstep(nx,5,12);
  const inland=THREE.MathUtils.lerp(meadow+mountains,4.3+.23*Math.sin(nz*.45)+.10*Math.sin(nx*.8),beach);
  let h=THREE.MathUtils.lerp(base,inland,THREE.MathUtils.smoothstep(base,4.5,6.3));
  for(const pool of POOLS){
    const px=(x-pool.x)/pool.rx,pz=(z-pool.z)/pool.rz;
    const r=Math.hypot(px,pz)*(1+.045*Math.sin(px*3+pz*4));
    if(r<1.8)h=Math.min(h,1.15+2.12*r*r);
  }
  return THREE.MathUtils.clamp(h,-2,10.35);
}
export type IslandBiome='pine'|'birch'|'desert'|'palm'|'blossom'|'autumn'|'acacia';
const LEGACY_ISLETS: {name:string;x:number;z:number;rx:number;rz:number;angle:number;biome:IslandBiome;peak:number;lobes:number}[]=[
  {name:'Pinewatch',x:-55,z:-79,rx:22,rz:14,angle:-.2,biome:'pine',peak:10.3,lobes:3},
  {name:'Birch Sound',x:1,z:-87,rx:19,rz:13,angle:.25,biome:'birch',peak:9.7,lobes:2},
  {name:'Sunspine',x:61,z:-74,rx:23,rz:12,angle:-.5,biome:'desert',peak:10.3,lobes:3},
  {name:'Palm Cove',x:91,z:22,rx:15,rz:24,angle:.1,biome:'palm',peak:9.6,lobes:3},
  {name:'Blossom Reach',x:33,z:79,rx:25,rz:16,angle:.25,biome:'blossom',peak:9.8,lobes:3},
  {name:'Autumn Ridge',x:-36,z:78,rx:24,rz:15,angle:-.3,biome:'autumn',peak:10.3,lobes:2},
  {name:'Acacia Key',x:-93,z:5,rx:11,rz:19,angle:-.2,biome:'acacia',peak:9.5,lobes:3},
];
const LEGACY_LINKS=[{x:-40,z:-40},{x:0,z:-40},{x:48,z:-33},{x:60,z:15},{x:22,z:40},{x:-30,z:39},{x:-61,z:5}];
export const PREVIOUS_ISLETS: {name:string;x:number;z:number;rx:number;rz:number;angle:number;biome:IslandBiome;peak:number;lobes:number}[]=[
  {name:'Pinewatch',x:-67,z:-45,rx:24,rz:17,angle:-.35,biome:'pine',peak:10.3,lobes:3},
  {name:'Birch Sound',x:22,z:-72,rx:23,rz:17,angle:.2,biome:'birch',peak:10.1,lobes:3},
  {name:'Sunspine',x:68,z:-46,rx:10,rz:7,angle:-.3,biome:'desert',peak:9.6,lobes:2},
  {name:'Palm Cove',x:90,z:-14,rx:12,rz:9,angle:.55,biome:'palm',peak:9.6,lobes:2},
  {name:'Blossom Reach',x:69,z:60,rx:22,rz:17,angle:.25,biome:'blossom',peak:10.1,lobes:3},
  {name:'Autumn Ridge',x:7,z:77,rx:17,rz:12,angle:-.5,biome:'autumn',peak:10.1,lobes:3},
  {name:'Acacia Key',x:-64,z:59,rx:27,rz:13,angle:.15,biome:'acacia',peak:9.9,lobes:3},
];
// Curving beach necks join the north-west, northern and south-east islands.
const PREVIOUS_CONNECTIONS=[
  [{x:-45,z:-17},{x:-38,z:-29},{x:-39,z:-41},{x:-53,z:-45}],
  [{x:18,z:-32},{x:28,z:-43},{x:25,z:-55},{x:22,z:-65}],
  [{x:53,z:28},{x:68,z:35},{x:63,z:45},{x:65,z:56}],
];
export const ROCK_KEYS=[{x:-93,z:9,r:3.8},{x:-19,z:57,r:5.5},{x:-10,z:-77,r:3.0},{x:80,z:-62,r:2.4}];
function islePoint(x:number,z:number,isle:typeof PREVIOUS_ISLETS[number]){
  const dx=x-isle.x,dz=z-isle.z,c=Math.cos(isle.angle),s=Math.sin(isle.angle);
  return {u:(dx*c+dz*s)/isle.rx,v:(-dx*s+dz*c)/isle.rz};
}
export function islandBiome(x:number,z:number):IslandBiome|null{
  for(const isle of ISLETS){const {u,v}=islePoint(x,z,isle);if(Math.hypot(u,v)<1.25)return isle.biome;}return null;
}
export function legacyArchipelagoHeight(x:number,z:number){
  let h=mainlandHeight(x,z);
  // More substantial ridges on the undeveloped north-west of the main island.
  if(h>5.2){
    const ridge=Math.hypot((x+37)/21,(z+27)/17),peak=Math.hypot((x+34)/9,(z+31)/8);
    if(ridge<1)h=Math.max(h,6.2+2.1*Math.max(0,1-ridge)+2.8*Math.max(0,1-peak));
  }
  for(const isle of LEGACY_ISLETS){
    const {u,v}=islePoint(x,z,isle),a=Math.atan2(v,u);
    const r=Math.hypot(u,v)*(1+.13*Math.sin(a*isle.lobes+.7)+.06*Math.cos(a*5));
    if(r>1.65)continue;
    // Scalloped coasts, broad settlement terraces and an off-centre mountain.
    const coast=3.6+(1-r)*10.0;
    const meadow=6.25+.16*Math.sin(u*4)*Math.cos(v*3);
    const hill=Math.max(0,1-Math.hypot((u+.23)/.82,(v+.12)/.7));
    const summit=Math.max(0,1-Math.hypot((u+.25)/.29,(v+.22)/.32));
    const inland=meadow+1.3*hill+(isle.peak-7.2)*summit;
    h=Math.max(h,Math.min(coast,inland));
  }
  // Submerged connecting shelves can be raised into player-made causeways.
  // They remain below the first dry layer until the player sculpts a crossing.
  LEGACY_ISLETS.forEach((isle,i)=>{
    const b=LEGACY_LINKS[i],dx=b.x-isle.x,dz=b.z-isle.z;
    const t=THREE.MathUtils.clamp(((x-isle.x)*dx+(z-isle.z)*dz)/(dx*dx+dz*dz),0,1);
    const distance=Math.hypot(x-isle.x-dx*t,z-isle.z-dz*t);
    if(distance<4.5)h=Math.max(h,2.95-5.0*THREE.MathUtils.smoothstep(distance,2.3,4.5));
  });
  return THREE.MathUtils.clamp(h,-2,10.35);
}
function distanceToSegment(x:number,z:number,a:{x:number;z:number},b:{x:number;z:number}){
  const dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
  return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
}
// Smooth Catmull-Rom paths give the beach connections sweeping curves.
const beachCurves=PREVIOUS_CONNECTIONS.map(points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,0,p.z))).getPoints(28).map(p=>({x:p.x,z:p.z})));
const beachBounds=beachCurves.map(curve=>({minX:Math.min(...curve.map(p=>p.x))-8,maxX:Math.max(...curve.map(p=>p.x))+8,minZ:Math.min(...curve.map(p=>p.z))-8,maxZ:Math.max(...curve.map(p=>p.z))+8}));
export function naturalArchipelagoHeight(x:number,z:number){
  let h=mainlandHeight(x,z);
  const original=h;
  if(h>0&&h<5.8){
    const coastalWarp=(Math.sin(x*.062+z*.047)*.9+Math.sin(z*.13-x*.08)*.55);
    h+=coastalWarp*(1-THREE.MathUtils.smoothstep(h,4.5,5.8));
  }
  // Deep indentations and sandy headlands break up the central oval.
  if(original<6.3){
    for(const bay of [{x:-57,z:26,rx:15,rz:12},{x:62,z:-22,rx:12,rz:15}]){
      const r=Math.hypot((x-bay.x)/bay.rx,(z-bay.z)/bay.rz);
      if(r<1.3)h=Math.min(h,1.8+3.6*r*r);
    }
  }
  if(original>5.2){
    const ridge=Math.hypot((x+37)/21,(z+27)/17),peak=Math.hypot((x+34)/9,(z+31)/8);
    if(ridge<1)h=Math.max(h,6.2+2.1*Math.max(0,1-ridge)+2.8*Math.max(0,1-peak));
  }
  for(const isle of PREVIOUS_ISLETS){
    const {u,v}=islePoint(x,z,isle),a=Math.atan2(v,u);
    const r=Math.hypot(u,v)*(1+.16*Math.sin(a*isle.lobes+.7)+.075*Math.cos(a*5));
    if(r>1.65)continue;
    const coast=3.6+(1-r)*8.3;
    const hill=Math.max(0,1-Math.hypot((u+.23)/.82,(v+.12)/.7));
    const summit=Math.max(0,1-Math.hypot((u+.25)/.29,(v+.22)/.32));
    const inland=6.25+.16*Math.sin(u*4)*Math.cos(v*3)+1.3*hill+(isle.peak-7.2)*summit;
    let island=Math.min(coast,inland);
    if(isle.biome==='acacia')island=Math.min(island,1.6+6*Math.hypot((u-.3)/.8,(v+.85)/.75)**2);
    h=Math.max(h,island);
  }
  for(let c=0;c<beachCurves.length;c++){
    const bounds=beachBounds[c];if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ)continue;
    const curve=beachCurves[c];let d=Infinity;for(let i=1;i<curve.length;i++)d=Math.min(d,distanceToSegment(x,z,curve[i-1],curve[i]));
    // Broad, flat sand with gentle tidal shelves on either side.
    h=Math.max(h,4.25-6.25*THREE.MathUtils.smoothstep(d,3.1,8.0));
  }
  for(const key of ROCK_KEYS){const r=Math.hypot((x-key.x)/1.4,z-key.z)/key.r;h=Math.max(h,5.3-r*r*2.0);}
  return THREE.MathUtils.clamp(h,-2,10.35);
}
/** Broad mountain areas still use the same twenty thin, sculptable layers. */
export function woodedArchipelagoHeight(x:number,z:number){
  let h=naturalArchipelagoHeight(x,z);
  if(h<=5.2)return h;
  const ranges=[{x:-37,z:-24,rx:25,rz:18},{x:-47,z:-5,rx:15,rz:19},{x:44,z:19,rx:17,rz:14}];
  for(const range of ranges){
    const r=Math.hypot((x-range.x)/range.rx,(z-range.z)/range.rz);
    if(r<1){const shoulders=THREE.MathUtils.smoothstep(1-r,0,.75);h=Math.max(h,5.7+4.65*shoulders);}
  }
  for(const isle of PREVIOUS_ISLETS){
    if(isle.rx<16)continue;
    const {u,v}=islePoint(x,z,isle),r=Math.hypot((u+.24)/.62,(v+.17)/.55);
    if(r<1)h=Math.max(h,5.7+4.6*THREE.MathUtils.smoothstep(1-r,0,.8));
  }
  return Math.min(10.35,h);
}
/** Overlapping ridges broaden the highlands without changing beaches or low meadows. */
export function mountainArchipelagoHeight(x:number,z:number){
  const base=woodedArchipelagoHeight(x,z);if(base<6)return base;
  let h=base;
  const ranges=[{x:-37,z:-25,rx:29,rz:20,peak:17.5},{x:-49,z:-7,rx:20,rz:22,peak:14.5},{x:42,z:21,rx:22,rz:17,peak:14.8}];
  for(const r of ranges){
    const u=(x-r.x)/r.rx,v=(z-r.z)/r.rz;
    const warp=.06*Math.sin(x*.21+z*.11)+.035*Math.sin(z*.39);
    const d=Math.hypot(u,v)+warp;
    const shoulder=Math.max(0,1-d);
    // Unequal overlapping summits form a ridge, not a central flat disc.
    const ridge=Math.max(Math.exp(-((u+.21)**2*9+(v+.08)**2*14)),.87*Math.exp(-((u-.28)**2*13+(v-.16)**2*16)));
    h=Math.max(h,6+(r.peak-6)*(.42*shoulder+.58*ridge)*THREE.MathUtils.smoothstep(shoulder,0,.22));
  }
  for(const isle of PREVIOUS_ISLETS){
    if(isle.rx<16)continue;
    const {u,v}=islePoint(x,z,isle),d=Math.hypot((u+.20)/.73,(v+.12)/.65);
    const ridge=Math.max(0,1-d+.035*Math.sin(u*13+v*8));
    if(d<1)h=Math.max(h,6+(isle.biome==='pine'||isle.biome==='desert'?8.6:6.5)*ridge);
  }
  return Math.min(16.3,h);
}
/** Rock footprints are kept separate from the thin, editable ground layers. */
export const MOUNTAINS = [
  {name:'Cloudspine',x:-23,z:-21,rx:9,rz:8,height:18,snow:true},
  {name:'Western crag',x:-35,z:-16,rx:5,rz:5,height:10,snow:false},
  {name:'Eastern crag',x:-9,z:-23,rx:6,rz:6,height:11,snow:true},
  {name:'Pinewatch peak',x:-71,z:-48,rx:7,rz:6,height:12,snow:true},
  {name:'Birch Sound ridge',x:18,z:-75,rx:9,rz:6,height:11,snow:true},
  {name:'Acacia ridge',x:-68,z:58,rx:8,rz:4,height:7,snow:false},
  {name:'Autumn peak',x:5,z:76,rx:6,rz:5,height:9,snow:false},
  {name:'Blossom crag',x:67,z:60,rx:5,rz:4,height:6,snow:false},
];
export const WATERFALL = {x:-25,z:-3,width:5.6,sourceZ:-7,sourceRX:3.7,sourceRZ:3.8};
export function mountainContains(m:typeof MOUNTAINS[number],x:number,z:number,margin=0){
  return Math.hypot((x-m.x)/(m.rx+margin),(z-m.z)/(m.rz+margin))<1;
}
export function waterfallContains(x:number,z:number,margin=0){
  return Math.hypot((x-WATERFALL.x)/(WATERFALL.sourceRX+margin),(z-WATERFALL.sourceZ)/(WATERFALL.sourceRZ+margin))<1
    || Math.abs(x+25)<3.5+margin && z>=-3-margin && z<2+margin;
}
const riverPoints=[{x:-24,z:16},{x:-22,z:24},{x:-16,z:30},{x:-18,z:38},{x:-12,z:48}];
/** Larger lowlands around the original island, with a raised northern tableland. */
export function waterfallArchipelagoHeight(x:number,z:number){
  let h=mountainArchipelagoHeight(x,z);
  const u=x/82,v=(z-4)/50,a=Math.atan2(v,u);
  const r=Math.hypot(u,v)*(1+.045*Math.sin(a*5+.8)+.025*Math.cos(a*7));
  const meadow=6.25+.08*Math.sin(x*.055)*Math.cos(z*.07);
  h=Math.max(h,Math.min(3.6+(1-r)*12,meadow));
  // Asymmetric green shelves, with a sheer front face above the waterfall pool.
  const table=Math.hypot((x+29)/28,(z+14)/17);
  if(table<1 && z<-3){
    const rim=THREE.MathUtils.smoothstep(1-table,0,.27);
    h=Math.max(h,6.25+6*rim);
  }
  // Re-open the original pools after extending the grassland.
  for(const pool of POOLS){const d=Math.hypot((x-pool.x)/pool.rx,(z-pool.z)/pool.rz);if(d<1.5)h=Math.min(h,1.15+2.12*d*d);}
  if(z>=-3){const d=Math.hypot((x+25)/6.8,(z-4)/10.5);if(d<1.4)h=Math.min(h,1.1+2.12*d*d);}
  if(x>-30&&x<-7&&z>14&&z<53){
    let d=Infinity;for(let i=1;i<riverPoints.length;i++)d=Math.min(d,distanceToSegment(x,z,riverPoints[i-1],riverPoints[i]));
    if(d<4.4)h=Math.min(h,1.35+d*d*.44);
  }
  // Keep open-water channels to the western and eastern offshore islands.
  if(x<-20&&z>30&&z<61){
    const d=distanceToSegment(x,z,{x:-98,z:33},{x:-20,z:57});
    if(d<4.8)h=Math.min(h,1.0+d*d*.42);
  }
  if(x>74&&x<86&&z>-31&&z<5){
    const d=distanceToSegment(x,z,{x:80,z:-31},{x:80,z:5});
    if(d<3.7)h=Math.min(h,1.0+d*d*.6);
  }
  // Retain the established walkable sand necks as valleys through new ground.
  for(let c=0;c<beachCurves.length;c++){
    const b=beachBounds[c];if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)continue;
    const curve=beachCurves[c];let d=Infinity;for(let i=1;i<curve.length;i++)d=Math.min(d,distanceToSegment(x,z,curve[i-1],curve[i]));
    if(d<6)h=THREE.MathUtils.lerp(mountainArchipelagoHeight(x,z),h,THREE.MathUtils.smoothstep(d,3.5,6));
  }
  return THREE.MathUtils.clamp(h,-2,16.3);
}
export function miniGodArchipelagoHeight(x:number,z:number){
  let h=woodedArchipelagoHeight(x,z);
  const u=x/82,v=(z-4)/50,a=Math.atan2(v,u);
  const r=Math.hypot(u,v)*(1+.045*Math.sin(a*5+.8)+.025*Math.cos(a*7));
  const meadow=6.25+.08*Math.sin(x*.055)*Math.cos(z*.07);
  h=Math.max(h,Math.min(3.6+(1-r)*12,meadow));
  // Re-open the original pools after extending the grassland.
  for(const pool of POOLS){const d=Math.hypot((x-pool.x)/pool.rx,(z-pool.z)/pool.rz);if(d<1.5)h=Math.min(h,1.15+2.12*d*d);}
  // Keep open-water channels to the western and eastern offshore islands.
  if(x<-20&&z>30&&z<61){
    const d=distanceToSegment(x,z,{x:-98,z:33},{x:-20,z:57});
    if(d<4.8)h=Math.min(h,1.0+d*d*.42);
  }
  if(x>74&&x<86&&z>-31&&z<5){
    const d=distanceToSegment(x,z,{x:80,z:-31},{x:80,z:5});
    if(d<3.7)h=Math.min(h,1.0+d*d*.6);
  }
  // Retain the established walkable sand necks as valleys through new ground.
  for(let c=0;c<beachCurves.length;c++){
    const b=beachBounds[c];if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)continue;
    const curve=beachCurves[c];let d=Infinity;for(let i=1;i<curve.length;i++)d=Math.min(d,distanceToSegment(x,z,curve[i-1],curve[i]));
    if(d<6)h=THREE.MathUtils.lerp(woodedArchipelagoHeight(x,z),h,THREE.MathUtils.smoothstep(d,3.5,6));
  }
  return THREE.MathUtils.clamp(h,-2,16.3);
}
export const ISLETS:typeof PREVIOUS_ISLETS=[
  {name:'Pine Key',x:-89,z:-76,rx:12,rz:9,angle:-.25,biome:'pine',peak:7.4,lobes:2},
  {name:'Palm Key',x:87,z:-75,rx:12,rz:8,angle:.25,biome:'palm',peak:7.1,lobes:2},
  {name:'Blossom Key',x:87,z:80,rx:13,rz:9,angle:-.3,biome:'blossom',peak:7.4,lobes:2},
];
export const SAND_CONNECTIONS:{x:number;z:number}[][]=[];
/** A broad mainland with large flat meadows and only three simple offshore keys. */
export function broadMainlandHeight(x:number,z:number){
  const u=x/99,v=(z-1)/73,a=Math.atan2(v,u);
  const r=Math.hypot(u,v)*(1+.028*Math.sin(a*3+.4)+.02*Math.cos(a*5));
  const coast=3.5+(1-r)*18;
  const meadow=6.25+.5*THREE.MathUtils.smoothstep(-x,12,45)+.5*THREE.MathUtils.smoothstep(-z,18,40);
  let h=Math.min(coast,meadow);
  // Retain a few low, broad rises without reintroducing mountains.
  if(h>6){const d=Math.hypot((x+37)/25,(z+26)/20);h=Math.max(h,Math.min(coast,6.25+2*Math.max(0,1-d)));}
  for(const pool of POOLS){const d=Math.hypot((x-pool.x)/pool.rx,(z-pool.z)/pool.rz);if(d<1.5)h=Math.min(h,1.15+2.12*d*d);}
  for(const isle of ISLETS){
    const {u,v}=islePoint(x,z,isle),a=Math.atan2(v,u),d=Math.hypot(u,v)*(1+.045*Math.sin(a*3));
    if(d<1.7)h=Math.max(h,Math.min(3.5+(1-d)*10,6.25+.5*Math.max(0,1-d/.6)));
  }
  return THREE.MathUtils.clamp(h,-2,10.35);
}
/** Broad bays and uneven headlands, without multiplying offshore fragments. */
export function archipelagoHeight(x:number,z:number){
  const u=(x+3*Math.sin(z*.045))/101,v=(z-1)/76,a=Math.atan2(v,u);
  const r=Math.hypot(u,v)*(1+.115*Math.sin(a*3+.5)+.055*Math.cos(a*5-.4));
  let coast=3.5+(1-r)*18;
  // Inlets eat into the outer shore while the heart stays wide enough to settle.
  for(const bay of [{x:58,z:55,rx:23,rz:19},{x:-83,z:-22,rx:20,rz:23},{x:35,z:-66,rx:20,rz:18}]){
    const d=Math.hypot((x-bay.x)/bay.rx,(z-bay.z)/bay.rz);
    if(d<1.6)coast=Math.min(coast,1.4+3.2*d*d);
  }
  let h=Math.min(coast,6.25+.5*THREE.MathUtils.smoothstep(-x,12,45)+.5*THREE.MathUtils.smoothstep(-z,18,40));
  if(h>6){const d=Math.hypot((x+37)/25,(z+26)/20);h=Math.max(h,Math.min(coast,6.25+2*Math.max(0,1-d)));}
  for(const pool of POOLS){const d=Math.hypot((x-pool.x)/pool.rx,(z-pool.z)/pool.rz);if(d<1.5)h=Math.min(h,1.15+2.12*d*d);}
  for(const isle of ISLETS){const {u,v}=islePoint(x,z,isle),a=Math.atan2(v,u),d=Math.hypot(u,v)*(1+.12*Math.sin(a*3+.3)+.045*Math.cos(a*5));
    if(d<1.7)h=Math.max(h,Math.min(3.5+(1-d)*10,6.25+.5*Math.max(0,1-d/.6)));
  }
  return THREE.MathUtils.clamp(h,-2,10.35);
}
/** Vegetation regions are separate from historical terrain palettes/save baselines. */
export function vegetationBiome(x:number,z:number):IslandBiome|'mango'|null{
  const offshore=islandBiome(x,z);if(offshore)return offshore;
  const wx=x+5*Math.sin(z*.065),wz=z+4*Math.sin(x*.07);
  if(wx<-25&&wz<-12)return 'pine';
  if(wx>16&&wz<-20)return 'birch';
  if(wx<-28&&wz>18)return 'acacia';
  if(wx>27&&wz>21)return 'blossom';
  if(wz>13)return 'mango';
  if(wx>48)return 'palm';
  return null;
}
/** Round contour corners within a small fraction of a walking footprint.
 * Elevation thresholds and all editable samples stay authoritative. */
export function softContour(r:number[][]){
  const points=r.map(([x,z])=>new THREE.Vector2(x*STEP-EXTENT/2,-(z*STEP-EXTENT/2)));
  if(points.length>1&&points[0].distanceToSquared(points[points.length-1])<1e-12)points.pop();
  const result:THREE.Vector2[]=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],before=points[(i+points.length-1)%points.length].clone().sub(p),after=points[(i+1)%points.length].clone().sub(p);
    const a=before.length(),b=after.length();
    if(a<.001||b<.001){result.push(p);continue;}
    before.divideScalar(a);after.divideScalar(b);
    if(before.dot(after)<-.995){result.push(p);continue;}
    const cut=Math.min(.055,a*.16,b*.16);
    result.push(p.clone().addScaledVector(before,cut),p.clone().addScaledVector(after,cut));
  }
  return result;
}
let initialTerrainChunks:TerrainChunkData[]|undefined;
export class Terrain {
  values=new Float32Array(GRID*GRID);
  group=new THREE.Group();
  private sections=new Map<number,Map<number,TerrainChunkData>>();
  texture:THREE.DataTexture;
  materials=[new THREE.MeshLambertMaterial({color:'#ffffff',vertexColors:true}),new THREE.MeshLambertMaterial({color:'#d1d1ca',vertexColors:true})];
  constructor() {
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++){
      const x=(i+.5)*STEP-EXTENT/2,z=(j+.5)*STEP-EXTENT/2;
      this.values[j*GRID+i]=archipelagoHeight(x,z);
    }
    this.texture=new THREE.DataTexture(this.values,GRID,GRID,THREE.RedFormat,THREE.FloatType);
    this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;
    initialTerrainChunks??=buildTerrainChunks(this.values);this.installChunks(initialTerrainChunks);
  }
  sample(x:number,z:number){
    const gx=(x+EXTENT/2)/STEP-.5,gz=(z+EXTENT/2)/STEP-.5,i=Math.floor(gx),j=Math.floor(gz);
    if(i<0||i>=GRID-1||j<0||j>=GRID-1)return -2;
    const a=gx-i,b=gz-j;
    return this.values[j*GRID+i]*(1-a)*(1-b)+this.values[j*GRID+i+1]*a*(1-b)+this.values[(j+1)*GRID+i]*(1-a)*b+this.values[(j+1)*GRID+i+1]*a*b;
  }
  level(x:number,z:number){return scalarLevel(this.sample(x,z));}
  height(x:number,z:number){return layerY(this.level(x,z))+.065;}
  beginStroke(x:number,z:number,mode:SculptMode):SculptStroke {
    const level=this.level(x,z);
    // Path trims only the adjacent higher layer down to the starting terrace.
    const sourceLevel=mode==='path'?level+1:level;
    return {snapshot:this.values.slice(),mode,sourceLevel,targetLevel:mode==='raise'?level+1:mode==='path'?level:level-1};
  }
  applyStroke(stroke:SculptStroke,x:number,z:number,radius:number,strength:number){
    if(![x,z,radius,strength].every(Number.isFinite)||radius<=0||strength<=0||stroke.targetLevel< -1||stroke.targetLevel>=LAYER_COUNT||stroke.sourceLevel>=LAYER_COUNT)return false;
    let changed=false;
    const imin=Math.max(1,Math.floor((x-radius+EXTENT/2)/STEP)),imax=Math.min(GRID-2,Math.ceil((x+radius+EXTENT/2)/STEP)),jmin=Math.max(1,Math.floor((z-radius+EXTENT/2)/STEP)),jmax=Math.min(GRID-2,Math.ceil((z+radius+EXTENT/2)/STEP));
    for(let j=jmin;j<=jmax;j++)for(let i=imin;i<=imax;i++){
      const d=Math.hypot((i+.5)*STEP-EXTENT/2-x,(j+.5)*STEP-EXTENT/2-z)/radius;if(d>=1)continue;
      const k=j*GRID+i,original=stroke.snapshot[k],before=this.values[k];
      // Eligibility and the cap are frozen at pointer-down. Holding, crossing a
      // stroke or changing tools cannot accumulate a second layer in this drag.
      if(scalarLevel(original)!==stroke.sourceLevel)continue;
      const falloff=(1-d*d)**2;
      const target=layerThreshold(stroke.targetLevel)+LAYER_INTERVAL*.5;
      // Bound scalar displacement too: bilinear points between samples must
      // obey the same one-layer limit as the editable samples themselves.
      const after=stroke.mode==='raise'?Math.min(target,original+LAYER_INTERVAL,before+strength*falloff):Math.max(target,original-LAYER_INTERVAL,before-strength*falloff);
      if(Math.abs(after-before)>.0001){this.values[k]=after;changed=true;}
    }
    return changed;
  }
  // A single dab is a complete stroke for callers without a pointer lifecycle.
  sculpt(x:number,z:number,radius:number,mode:SculptMode,strength:number){return this.applyStroke(this.beginStroke(x,z,mode),x,z,radius,strength);}
  rebuild(){
    for(const mesh of this.group.children as THREE.Mesh[])mesh.geometry.dispose();this.group.clear();this.sections.clear();
    this.installChunks(buildTerrainChunks(this.values));
  }
  installChunks(data:TerrainChunkData[]){
    const dirty=new Set<number>();
    for(const part of data){let section=this.sections.get(part.chunk);if(!section){section=new Map();this.sections.set(part.chunk,section);}section.set(part.layer,part);dirty.add(part.chunk);}
    for(const chunk of dirty){
      const old=this.group.children.find(o=>o.userData.chunk===chunk) as THREE.Mesh|undefined;
      if(old){this.group.remove(old);old.geometry.dispose();}
      const parts=[...this.sections.get(chunk)!.values()].sort((a,b)=>a.layer-b.layer),size=parts.reduce((n,p)=>n+p.position.length,0);
      if(!size)continue;
      const position=new Float32Array(size),normal=new Float32Array(size),color=new Float32Array(size);let offset=0;
      for(const p of parts){position.set(p.position,offset);normal.set(p.normal,offset);color.set(p.color,offset);offset+=p.position.length;}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(position,3));geo.setAttribute('normal',new THREE.BufferAttribute(normal,3));geo.setAttribute('color',new THREE.BufferAttribute(color,3));geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,this.materials[0]);mesh.name=`Terrain section ${chunk}`;mesh.userData.chunk=chunk;mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);
    }
    this.group.children.sort((a,b)=>a.userData.chunk-b.userData.chunk);this.texture.needsUpdate=true;
  }
  installGeometry(data:TerrainMeshData[]){
    for(const part of data){
      const old=this.group.children.find(o=>o.userData.layer===part.layer) as THREE.Mesh|undefined;
      if(old){this.group.remove(old);old.geometry.dispose();}
      if(!part.position.length)continue;
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(part.position,3));geo.setAttribute('normal',new THREE.BufferAttribute(part.normal,3));geo.setAttribute('color',new THREE.BufferAttribute(part.color,3));
      for(const g of part.groups)geo.addGroup(g.start,g.count,g.materialIndex);geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,this.materials);mesh.castShadow=part.layer>=FIRST_DRY_LAYER;mesh.receiveShadow=true;mesh.userData.layer=part.layer;this.group.add(mesh);
    }
    this.group.children.sort((a,b)=>a.userData.layer-b.userData.layer);this.texture.needsUpdate=true;
  }
  dispose(){for(const o of this.group.children)(o as THREE.Mesh).geometry.dispose();this.materials.forEach(m=>m.dispose());this.texture.dispose();this.sections.clear();this.group.clear();}
}

export type TerrainMeshData={layer:number;position:Float32Array;normal:Float32Array;color:Float32Array;groups:{start:number;count:number;materialIndex?:number}[]};
/** Interpolated contours may change on any threshold between a changed sample
 * and its neighbours, even when the sample stays within its current band. */
export function affectedTerrainLayers(values:Float32Array,previous?:Float32Array){
 if(!previous)return Array.from({length:LAYER_COUNT},(_,i)=>i);
 const dirty=new Set<number>();
 for(let k=0;k<values.length;k++)if(values[k]!==previous[k]){
  const x=k%GRID,z=Math.floor(k/GRID);let low=Math.min(values[k],previous[k]),high=Math.max(values[k],previous[k]);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<GRID&&z+dz>=0&&z+dz<GRID){const n=k+dz*GRID+dx;low=Math.min(low,values[n],previous[n]);high=Math.max(high,values[n],previous[n]);}
  for(let l=0;l<LAYER_COUNT;l++)if(layerThreshold(l)>=low&&layerThreshold(l)<=high)dirty.add(l);
 }
 return [...dirty].sort((a,b)=>a-b);
}
export function buildTerrainGeometry(values:Float32Array,previous?:Float32Array,region?:{x:number;z:number;size:number}):TerrainMeshData[]{
 const layers=affectedTerrainLayers(values,previous),result:TerrainMeshData[]=[];
 const size=region?.size??GRID;
 const samples=region?Array.from({length:size*size},(_,k)=>{const x=region.x+k%size,z=region.z+Math.floor(k/size);return x<0||z<0||x>=GRID||z>=GRID?-2:values[z*GRID+x];}):Array.from(values);
 const max=Math.max(...(region?samples:[16.5]));
 const active=layers.filter(l=>layerThreshold(l)<=max);
    const features=contours().size([size,size]).thresholds(active.map(layerThreshold))(samples);
    features.forEach((f,index)=>{
      const l=active[index];
      const shapes:THREE.Shape[]=[];
      for(const polygon of f.coordinates){
        const ring=(r:number[][])=>softContour(region?r.map(([x,z])=>[x+region.x,z+region.z]):r);
        const shape=new THREE.Shape(ring(polygon[0]));for(const hole of polygon.slice(1))shape.holes.push(new THREE.Path(ring(hole)));shapes.push(shape);
      }
      if(!shapes.length){result.push({layer:l,position:new Float32Array(),normal:new Float32Array(),color:new Float32Array(),groups:[]});return;}
      const bottom=layerY(l-1)+.012,depth=layerY(l)-bottom;
      const geo=new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelSize:.08,bevelThickness:.035,bevelSegments:1,steps:1,curveSegments:1});
      geo.rotateX(-Math.PI/2);geo.translate(0,bottom,0);
      const vertices=geo.getAttribute('position'),colours=new Float32Array(vertices.count*3),base=new THREE.Color(PALETTE[l]),desert=new THREE.Color(DESERT_PALETTE[l]),c=new THREE.Color();
      for(let v=0;v<vertices.count;v++){
        c.copy(base).lerp(desert,l>=8?desertWeight(vertices.getX(v),vertices.getZ(v)):0);
        if(l>=16){
          const biome=islandBiome(vertices.getX(v),vertices.getZ(v));
          if(biome==='pine'||biome==='birch')c.lerp(new THREE.Color(l>17?'#a8aaa1':'#89948b'),.7);
          else if(biome==='autumn')c.lerp(new THREE.Color('#ad815c'),.45);
        }
        colours[v*3]=c.r;colours[v*3+1]=c.g;colours[v*3+2]=c.b;
      }
      geo.setAttribute('color',new THREE.BufferAttribute(colours,3));
      result.push({layer:l,position:vertices.array as Float32Array,normal:geo.getAttribute('normal').array as Float32Array,color:colours,groups:geo.groups});geo.dispose();
    });
 for(const layer of layers)if(!active.includes(layer))result.push({layer,position:new Float32Array(),normal:new Float32Array(),color:new Float32Array(),groups:[]});
 return result;
}

/** 8×8 spatial sections: a dab rebuilds only intersected sections plus its
 * one-sample interpolation halo. Unchanged GPU buffers stay installed. */
export const TERRAIN_CHUNK_SIZE=50, TERRAIN_CHUNKS=GRID/TERRAIN_CHUNK_SIZE;
export type TerrainChunkData={chunk:number;layer:number;position:Float32Array;normal:Float32Array;color:Float32Array};
export function affectedTerrainChunks(values:Float32Array,previous?:Float32Array){
  if(!previous)return Array.from({length:TERRAIN_CHUNKS*TERRAIN_CHUNKS},(_,i)=>i);
  const result=new Set<number>();
  for(let k=0;k<values.length;k++)if(values[k]!==previous[k]){
    const x=k%GRID,z=Math.floor(k/GRID);
    for(const dz of [-1,0,1])for(const dx of [-1,0,1]){
      const cx=Math.floor((x+dx)/TERRAIN_CHUNK_SIZE),cz=Math.floor((z+dz)/TERRAIN_CHUNK_SIZE);
      if(cx>=0&&cz>=0&&cx<TERRAIN_CHUNKS&&cz<TERRAIN_CHUNKS)result.add(cz*TERRAIN_CHUNKS+cx);
    }
  }return [...result].sort((a,b)=>a-b);
}
// Clip the padded section's triangles to its exact ownership rectangle. The
// extra contour sample keeps artificial walls and bevels outside this boundary.
function clipSection(parts:TerrainMeshData[],chunk:number):TerrainChunkData{
  const cx=chunk%TERRAIN_CHUNKS,cz=Math.floor(chunk/TERRAIN_CHUNKS),width=TERRAIN_CHUNK_SIZE*STEP;
  const minX=cx*width-EXTENT/2,minZ=cz*width-EXTENT/2,maxX=minX+width,maxZ=minZ+width;
  const position:number[]=[],normal:number[]=[],color:number[]=[],side=new THREE.Color('#d1d1ca');
  for(const part of parts){
    let groupIndex=0;
    for(let i=0;i<part.position.length/3;i+=3){
      while(groupIndex+1<part.groups.length&&i>=part.groups[groupIndex].start+part.groups[groupIndex].count)groupIndex++;
      const shade=part.groups[groupIndex]?.materialIndex===1;
      let inside=true,outLeft=true,outRight=true,outNear=true,outFar=true;
      for(let j=0;j<3;j++){const k=(i+j)*3,x=part.position[k],z=part.position[k+2];inside&&=x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ;outLeft&&=x<minX;outRight&&=x>maxX;outNear&&=z<minZ;outFar&&=z>maxZ;}
      if(outLeft||outRight||outNear||outFar)continue;
      if(inside){
        for(let j=0;j<3;j++){const k=(i+j)*3;position.push(part.position[k],part.position[k+1],part.position[k+2]);normal.push(part.normal[k],part.normal[k+1],part.normal[k+2]);color.push(part.color[k]*(shade?side.r:1),part.color[k+1]*(shade?side.g:1),part.color[k+2]*(shade?side.b:1));}
        continue;
      }
      let polygon:number[][]=[];
      for(let j=0;j<3;j++){const k=(i+j)*3;polygon.push([part.position[k],part.position[k+1],part.position[k+2],part.normal[k],part.normal[k+1],part.normal[k+2],part.color[k]*(shade?side.r:1),part.color[k+1]*(shade?side.g:1),part.color[k+2]*(shade?side.b:1)]);}
      for(const [axis,bound,sign] of [[0,minX,1],[0,maxX,-1],[2,minZ,1],[2,maxZ,-1]]){
        const next:number[][]=[];
        for(let j=0;j<polygon.length;j++){
          const a=polygon[j],b=polygon[(j+1)%polygon.length],insideA=(a[axis]-bound)*sign>=0,insideB=(b[axis]-bound)*sign>=0;
          if(insideA)next.push(a);
          if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]),v=a.map((value,n)=>value+(b[n]-value)*t);v[axis]=bound;next.push(v);}
        }polygon=next;if(polygon.length<3)break;
      }
      for(let j=1;j+1<polygon.length;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){position.push(v[0],v[1],v[2]);normal.push(v[3],v[4],v[5]);color.push(v[6],v[7],v[8]);}
    }
  }
  return {chunk,layer:parts[0].layer,position:new Float32Array(position),normal:new Float32Array(normal),color:new Float32Array(color)};
}
export function buildTerrainChunks(values:Float32Array,previous?:Float32Array):TerrainChunkData[]{
  return affectedTerrainChunks(values,previous).flatMap(chunk=>{
    const x=chunk%TERRAIN_CHUNKS*TERRAIN_CHUNK_SIZE-1,z=Math.floor(chunk/TERRAIN_CHUNKS)*TERRAIN_CHUNK_SIZE-1;
    return buildTerrainGeometry(values,previous,{x,z,size:TERRAIN_CHUNK_SIZE+2}).map(part=>clipSection([part],chunk));
  });
}
