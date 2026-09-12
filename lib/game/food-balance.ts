/** Seconds are simulation time. Feed is charged once per breeding cycle. */
export const FOOD_BALANCE = {
  visuals:{hut:.7,pig:.8,chicken:.55,fish:.4},
  herd:{chickens:4,pigs:3,pigMaturity:180},
  buildings:{coop:{wood:6,seconds:20},pigpen:{wood:9,seconds:28}},
  food: {fish:3,chicken:5,pig:10},
  fishing: {capacity:12,recoverySeconds:45,catchSeconds:8,maxAreas:8,radius:6},
  chicken: {capacity:8,feed:2,breedSeconds:75},
  pig: {capacity:6,feed:4,breedSeconds:120},
  training: {seconds:60,wood:2},
  trap: {wood:3,bait:1,setSeconds:5,max:8},
  processingSeconds:8, careSeconds:4, catchSeconds:3,
} as const;
