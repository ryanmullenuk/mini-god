import {FOOD_BALANCE as B} from './food-balance';
export const DAY_SECONDS=240;
export function timeOfDay(seconds:number){
  const phase=((seconds%DAY_SECONDS)+DAY_SECONDS)%DAY_SECONDS/DAY_SECONDS;
  return phase<.10?'Dawn':phase<.32?'Morning':phase<.56?'Afternoon':phase<.70?'Dusk':'Night';
}
export type Point = { x: number; z: number };
export type FoodJob = 'fish'|'catch'|'pen-delivery'|'feed'|'trap-set'|'trap-collect'|'hunt'|'train'|'animal-transfer'|'animal-process';
export type Species = 'chicken'|'pig';
export type WildAnimal = Point & {id:number;age?:number;species:Species;alive:boolean;claimedBy:number|null;heading:number;goal:Point|null;timer:number};
export type FishingArea = Point & {id:number;water:Point;stock:number;recovery:number;workerId:number|null;claimedBy:number|null};
export type PigTrap = Point & {id:number;phase:'planned'|'armed'|'caught'|'empty';claimedBy:number|null};
export type FoodState = {initialized:boolean;animals:WildAnimal[];fishing:FishingArea[];traps:PigTrap[];training:number[];hunting:number[];seed:number};
export const newFoodState=():FoodState=>({initialized:false,animals:[],fishing:[],traps:[],training:[],hunting:[],seed:68129});
export type JobKind = FoodJob | 'wood' | 'forage' | 'build' | 'plant' | 'harvest' | 'deliver' | 'clear' | 'rally' | 'worship' | 'butcher' | 'supply' | 'gather';
export type BuildKind = 'home' | 'farm' | 'temple' | 'slaughterhouse' | 'coop' | 'pigpen' | 'granary' | 'storehouse' | 'torch' | 'bonfire';
export const BUILD_LABEL: Record<BuildKind,string> = {torch:'Tiki torch',bonfire:'Bonfire',home:'Hut',farm:'Farm',temple:'Temple',slaughterhouse:'Slaughterhouse',coop:'Chicken coop',pigpen:'Pig pen',granary:'Granary',storehouse:'Storehouse'};
export const BUILD_TIME = {torch:8,bonfire:16,granary:36,storehouse:32,home:24,farm:15,temple:48,slaughterhouse:36,coop:B.buildings.coop.seconds,pigpen:B.buildings.pigpen.seconds} as const;
export const BUILD_COST = {torch:2,bonfire:5, granary: 12, storehouse: 10, home: 6, farm: 3, temple: 18, slaughterhouse: 12, coop: B.buildings.coop.wood, pigpen: B.buildings.pigpen.wood } as const;
export const VILLAGE_BALANCE={hutCapacity:4,cottageCapacity:6,cottageWood:12,cottageSeconds:45,carryWood:3,campFood:240,campWood:120,granaryFood:240,storehouseWood:120} as const;
export const homeCapacity=(p:Plot)=>p.level===2?VILLAGE_BALANCE.cottageCapacity:VILLAGE_BALANCE.hutCapacity;
export const constructionCost=(p:Plot)=>p.upgrading?VILLAGE_BALANCE.cottageWood:BUILD_COST[p.kind];
export const ORDER_LIMIT = 8;
export type BuildOrder = Point & { id: number; kind: BuildKind };
export type GuidanceKind = BuildKind | 'fishing' | 'trap' | 'settle' | 'rally' | 'rain' | 'bloom';
export type Beacon = Point & { id: number; expires: number; members: { id: number; destination: Point; phase: 'waiting' | 'walking' | 'arrived' | 'done'; arrivedAt: number }[] };
export type GuidancePreview = Point & { kind: GuidanceKind; allowed: boolean; message: string; wood: number; radius?: number };
export type Job = { kind: JobKind; target: number; route: Point[]; work: number; destination?:number; herd?:number[] };
export type Settler = Point & {
  id: number; name: string; heading: number; moving: boolean; stranded: boolean;
  lastGather?: number; lastWorship?: number; huntingSkill?:number; weapon?:boolean;
  job: Job | null; cargo: { wood: number; food: number; harvest: number; animal?: {species:Species;destination:number}; feed?:number; construction?:{site:number;wood:number} };
};
export type Plot = Point & {
  id: number; kind: BuildKind; stage: 'building' | 'complete'; progress: number;
  valid: boolean; claimedBy: number | null; moisture: number; fertility: number;
  crop: number; planted: boolean; harvests: number;
  offerings?: number; livestock?: number; rearing?: boolean; rearingProgress?: number; processed?: number;
  young?:number[]; stock?:number; breed?:number; fed?:boolean; priority?:'breed'|'food'; keeperId?:number|null; poultry?:number; pork?:number;
  level?:1|2; upgrading?:boolean; upgradeProgress?:number; supplied?:number; pendingWood?:number;
  guided?: boolean; farmerId?: number | null;
};
export type Resource = Point & {
  id: number; kind: 'wood' | 'forage'; stock: number; capacity: number; regrowth: number;
  claimedBy: number | null; valid: boolean;
};
export type PrayerKind = 'shelter' | 'food' | 'water' | 'ground';
export type Prayer = { id: number; kind: PrayerKind; opened: number; settled: number };
export type Trail = Point & { wear: number };
export type WorldState = {
  foodSystem:FoodState; version: 1; time: number; tick: number; nextId: number; seed: number; camp: Point | null;
  food: number; wood: number; faith: number; rain: number; blessing: number;
  tier: 1 | 2; rainArea: (Point & {radius:number}) | null;
  settlers: Settler[]; plots: Plot[]; resources: Resource[]; trails: Trail[];
  orders: BuildOrder[]; beacon: Beacon | null;
  prayer: Prayer | null; prayerCooldown: Partial<Record<PrayerKind, number>>;
  answered: number; deliveredFood: number; deliveredWood: number; harvestedFood: number;
  consumedFood: number; lastEvent: string; eventTime: number;
};
export type Opportunity = Point & { kind: 'home' | 'farm'; score: number };
export type FoodStatus = {wildChickens:number;wildPigs:number;fishing:{id:number;stock:number;workerId:number|null;message:string}[];pens:{id:number;kind:'coop'|'pigpen';stock:number;capacity:number;priority:'breed'|'food';keeperId:number|null;message:string}[];traps:{id:number;message:string}[];hunters:{id:number;skill:number;training:boolean;hunting:boolean}[]};
export type SettlementStatus = {
  storage:{food:number;wood:number};
  foodSystem:FoodStatus;
  timeOfDay:ReturnType<typeof timeOfDay>; population: number; sheltered: number; homes: number; farms: number; food: number;
  wood: number; faith: number; day: number; raining: boolean; rain: number;
  prayer: { title: string; message: string; reward: number } | null;
  objective: string; event: string; workers: { id: number; name: string; activity: string }[];
  harvestedFood: number; answered: number; opportunities: number;
  beacon: { id: number; message: string; remaining: number } | null;
  buildings: { occupants:string|null; name:string; upgrade:{allowed:boolean;message:string}|null; workers:string; id: number; kind: BuildKind; farmerId: number | null; message: string; detail: string; progress: number | null }[];
  faithMessage: string; tier: number; milestone: string; offerings: number; temples: number; slaughterhouses: number;
  guidance: { id: number; kind: BuildKind; message: string; cancellable: boolean; progress: number | null }[];
};
export function newWorld(): WorldState {
  return { foodSystem:newFoodState(), version: 1, time: 0, tick: 0, nextId: 1, seed: 94721, camp: null,
    food: 24, wood: 0, faith: 6, rain: 0, blessing: 0, tier: 1, rainArea: null, settlers: [], plots: [], resources: [], orders: [], beacon: null,
    trails: [], prayer: null, prayerCooldown: {}, answered: 0, deliveredFood: 0,
    deliveredWood: 0, harvestedFood: 0, consumedFood: 0,
    lastEvent: 'An untouched island. Invite your first settlers.', eventTime: 0 };
}

export const FIRE_BALANCE={guests:6,gatherSeconds:25,gatherCooldown:80,radius:2.2} as const;
export const evening=(seconds:number)=>['Dusk','Night'].includes(timeOfDay(seconds));
export const gatheringPoint=(p:Point,id:number):Point=>({x:p.x+Math.sin(id*2.399963)*FIRE_BALANCE.radius,z:p.z+Math.cos(id*2.399963)*FIRE_BALANCE.radius});
