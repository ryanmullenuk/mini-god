import { pickTerrain } from './terrain-picking';
import { TerrainMesher } from './terrain-mesher';
import { MarineLife } from './marine-life';
import * as THREE from 'three';
import { Terrain, SEA, EXTENT, type SculptStroke } from './terrain';
import { createOcean, oceanCameraFit } from './ocean';
import { Daylight } from './daylight';
import { Islanders } from './islanders';
import { FoodView } from './food-view';
import { Landscape } from './landscape';
import { LandAnimals } from './land-animals';
import { Wildlife } from './wildlife';
import type { TerrainFacts, PlotKind, PlotBounds, PlotContext, PlotAssessment } from './terrain-metadata';
import { Settlement } from './settlement';
import { SettlementView } from './settlement-view';
import { GuidanceCursor } from './guidance-cursor';
import { decodeSave, encodeSave, SAVE_KEY, type IslandSave } from './save';
import type { GuidanceKind, GuidancePreview, SettlementStatus, WorldState } from './world-state';
export type Tool='guide-granary'|'guide-storehouse'|'fishing'|'trap'|'guide-coop'|'guide-pigpen'|'settle'|'move'|'raise'|'lower'|'path'|'guide-home'|'guide-farm'|'rally'|'guide-temple'|'guide-slaughterhouse'|'rain'|'bloom';
const guideKind=(tool:Tool):GuidanceKind|null=>tool==='guide-granary'?'granary':tool==='guide-storehouse'?'storehouse':tool==='fishing'?'fishing':tool==='trap'?'trap':tool==='guide-coop'?'coop':tool==='guide-pigpen'?'pigpen':tool==='settle'?'settle':tool==='guide-home'?'home':tool==='guide-farm'?'farm':tool==='guide-temple'?'temple':tool==='guide-slaughterhouse'?'slaughterhouse':tool==='rally'?'rally':tool==='rain'?'rain':tool==='bloom'?'bloom':null;
const sculptTool=(tool:Tool):tool is 'raise'|'lower'|'path'=>tool==='raise'||tool==='lower'||tool==='path';
export type GameSettings={tool:Tool;brush:number;paused:boolean;speed:1|3;showPlots:boolean;showInfluence:boolean};
export type GameAPI={cameraStatus:()=>{heading:number;overhead:boolean};north:()=>void;topView:()=>void;upgradeHome:(id:number)=>boolean;foodRole:(kind:'fish'|'keeper',id:number,worker:number|null)=>boolean;foodPriority:(id:number,value:'breed'|'food')=>boolean;trainHunting:(id:number)=>boolean;toggleHunting:(id:number)=>boolean;rearmTrap:(id:number)=>boolean;settings:GameSettings;zoom:(d:number)=>void;home:()=>void;focusVillage:()=>void;undo:()=>void;addIslanders:()=>number;inspectTerrain:(x:number,z:number)=>TerrainFacts|null;assessPlot:(kind:PlotKind,bounds:PlotBounds,context?:PlotContext)=>PlotAssessment;status:()=>SettlementStatus;placement:()=>GuidancePreview|null;cancelOrder:(id:number)=>boolean;dismissBeacon:()=>boolean;collectOfferings:()=>number;assignFarmer:(plotId:number,workerId:number|null)=>boolean;focusGuidance:(id:number)=>void;power:(kind:'rain'|'bloom')=>boolean;exportSave:()=>string;importSave:(raw:string)=>string;resetWorld:()=>string;restorePrevious:()=>string;hasPrevious:()=>boolean;saveStatus:()=>string;dispose:()=>void};
export function createGame(host:HTMLDivElement,onReady:()=>void,onHistory:(n:number)=>void,onGuidance:(message:string)=>void=()=>{}):GameAPI{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#334b58');
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.35));renderer.setSize(host.clientWidth,host.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setClearColor('#334b58');host.appendChild(renderer.domElement);
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Island play area. Use the sculpting toolbar to change tools.');
 const camera=new THREE.OrthographicCamera(-32,32,32,-32,.1,400),target=new THREE.Vector3(0,1.5,0);
 let yaw=.30,pitch=.82,view=host.clientWidth<600?116:98;
 const updateCamera=()=>{const a=host.clientWidth/host.clientHeight;const h=a<1?view/a:view;camera.left=-h*a;camera.right=h*a;camera.top=h;camera.bottom=-h;const fit=oceanCameraFit(h,pitch);camera.far=fit.far;camera.position.set(target.x+fit.distance*Math.sin(yaw)*Math.cos(pitch),target.y+fit.distance*Math.sin(pitch),target.z+fit.distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();};updateCamera();
 const ambient=new THREE.HemisphereLight('#d9f6ff','#92a372',1.2);scene.add(ambient);const sun=new THREE.DirectionalLight('#fff2d1',2.05);sun.position.set(-50,80,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-120,right:120,top:120,bottom:-120,near:1,far:220});sun.shadow.bias=-.0005;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun);const daylight=new Daylight(scene,sun,ambient);
 const terrain=new Terrain();scene.add(terrain.group);
 let migrated=false,savedWorld:WorldState|undefined,saveAllowed=true,saveNotice='Autosave on this device';
 try{
  const raw=localStorage.getItem(SAVE_KEY);
  if(raw){
   const saved=decodeSave(raw);migrated=!!saved.migratedFrom||!!saved.archipelagoUpgraded;
   if(migrated){try{localStorage.setItem(SAVE_KEY+(saved.archipelagoUpgraded?'.before-natural-mainland':'.before-20-layers'),raw);}catch{saveAllowed=false;}}
   terrain.values.set(saved.terrain);terrain.rebuild();savedWorld=saved.world;
   saveNotice=!saveAllowed?'Island restored. Upgrade backup unavailable; export a copy to keep new progress.':saved.archipelagoUpgraded?'Your mainland now has more open settlement ground':migrated?'Saved island upgraded to 20 layers':'Saved island restored';
  }
 }catch{saveAllowed=false;saveNotice='Saved data could not load. Import a copy or start a new island.';}
 let simulation=new Settlement(terrain,savedWorld);if(migrated)simulation.terrainChanged();
 let villageView=new SettlementView(terrain);scene.add(villageView.group);
 const guidanceCursor=new GuidanceCursor(terrain);scene.add(guidanceCursor.group);
 const ocean=createOcean(terrain);scene.add(ocean.mesh);const marine=new MarineLife(terrain,ocean.shoreline);scene.add(marine.group);
 const islanders=new Islanders(terrain);scene.add(islanders.group);
 const foodView=new FoodView(terrain);scene.add(foodView.group);
 const landscape=new Landscape(terrain);scene.add(landscape.group);
 const wildlife=new Wildlife(terrain);scene.add(wildlife.group);let skyPointer:{x:number;y:number}|null=null;
 let landAnimals=new LandAnimals(terrain,(x,z)=>simulation.state.plots.some(p=>p.valid&&Math.abs(x-p.x)<1.5&&Math.abs(z-p.z)<1.5));scene.add(landAnimals.group);
 const settings:GameSettings={tool:'raise',brush:4,paused:false,speed:1,showPlots:false,showInfluence:false};
 const brush=new THREE.Group();const ringMaterial=new THREE.MeshBasicMaterial({color:'#fcfff0',transparent:true,opacity:.88,depthTest:false,depthWrite:false});const ring=new THREE.Mesh(new THREE.RingGeometry(.975,1,64),ringMaterial);ring.rotation.x=-Math.PI/2;ring.renderOrder=5;brush.add(ring);const fillMaterial=new THREE.MeshBasicMaterial({color:'#fffce6',transparent:true,opacity:.085,depthTest:false,depthWrite:false});const disk=new THREE.Mesh(new THREE.CircleGeometry(.974,64),fillMaterial);disk.rotation.x=-Math.PI/2;disk.renderOrder=4;brush.add(disk);brush.visible=false;scene.add(brush);
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),hitPoint=new THREE.Vector3();const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-SEA);
 const pointers=new Map<number,{x:number;y:number}>();let lastX=0,lastY=0,pressed=false,sculpting=false,dragButton=0,strokeY=0,dirty=false,strokeChanged=false,strokeSnapshot:Float32Array|null=null,lastStampPoint:THREE.Vector3|null=null,lastPaint=0,touchPending=false,touchStartTime=0,strokeStart={x:0,y:0};
 const history:Float32Array[]=[];let stroke:SculptStroke|null=null;
 let placement:GuidancePreview|null=null,pendingGuidance:{kind:GuidanceKind;pointer:number}|null=null,previewKey='',previewTime=0;
 function makeRay(x:number,y:number){const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);}
 function pick(x:number,y:number,flat=false){makeRay(x,y);if(!flat){const hit=pickTerrain(ray.ray,terrain,camera.far);if(hit)return hit;}plane.constant=-(flat?strokeY:SEA);return ray.ray.intersectPlane(plane,hitPoint)?.clone()??null;}
 function showBrush(p:THREE.Vector3|null){brush.visible=!!p&&sculptTool(settings.tool)&&pointers.size<2;if(p){brush.position.set(p.x,Math.max(terrain.height(p.x,p.z)+.09,SEA+.06),p.z);brush.scale.setScalar(settings.brush);ringMaterial.color.set(settings.tool==='lower'?'#ffe7bb':settings.tool==='path'?'#fff8cc':'#f3ffe8');}}
 function hideGuidance(){guidanceCursor.show(null);placement=null;previewKey='';}
 function showGuidance(p:THREE.Vector3|null,kind:GuidanceKind|null=guideKind(settings.tool)){
  if(!p||!kind||pointers.size>1){hideGuidance();return;}
  const x=Math.round(p.x*2)/2,z=Math.round(p.z*2)/2,key=`${kind}:${x},${z}:${settings.paused}`;
  if(key!==previewKey){placement=simulation.guidancePreview(kind,{x,z});if(settings.paused&&(kind==='rain'||kind==='bloom'))placement={...placement,allowed:false,message:'Resume the village to place a blessing.'};previewKey=key;}
  guidanceCursor.show(placement);brush.visible=false;
 }
 function changeAt(p:THREE.Vector3,strength:number){if(!stroke)return;const waterRevision=terrain.waterRevision;if(terrain.applyStroke(stroke,p.x,p.z,settings.brush,strength)){if(terrain.waterRevision!==waterRevision)simulation.metadata.invalidate();dirty=true;strokeChanged=true;}}
 function paint(x:number,y:number,initial=false){const p=pick(x,y,true);if(!p)return;showBrush(p);if(lastStampPoint){const d=p.distanceTo(lastStampPoint),steps=Math.max(1,Math.min(256,Math.ceil(d/Math.min(.45,settings.brush*.18))));for(let i=1;i<=steps;i++)changeAt(lastStampPoint.clone().lerp(p,i/steps),.20);}else changeAt(p,initial?.7:.20);lastStampPoint=p;lastPaint=performance.now();}
 let sceneryPending=false;
 const mesher=new TerrainMesher(terrain,()=>{sceneryPending=true;renderer.shadowMap.needsUpdate=true;});
 function refreshScenery(){if(!sceneryPending||sculpting||mesher.busy)return;wildlife.terrainChanged();landscape.terrainChanged();landAnimals.terrainChanged();sceneryPending=false;}
 function rebuild(){if(!dirty)return;mesher.request();dirty=false;}
 function finishStroke(){if(sculpting){rebuild();if(strokeChanged&&strokeSnapshot){simulation.terrainChanged(false);villageView.terrainChanged();history.push(strokeSnapshot);if(history.length>35)history.shift();onHistory(history.length);}}sculpting=false;strokeSnapshot=null;stroke=null;strokeChanged=false;lastStampPoint=null;touchPending=false;}
 function startPendingTouch(){if(touchPending){touchPending=false;paint(strokeStart.x,strokeStart.y,true);}}
 function pointerDown(e:PointerEvent){hoverPending=null;if(e.button!==0&&e.button!==2&&e.button!==1)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastX=e.clientX;lastY=e.clientY;pressed=true;dragButton=e.button;
 if(pointers.size>1){pendingGuidance=null;hideGuidance();if(sculpting&&strokeSnapshot&&strokeChanged){terrain.values.set(strokeSnapshot);terrain.revision++;terrain.waterRevision++;simulation.metadata.invalidate();dirty=true;rebuild();}strokeChanged=false;finishStroke();brush.visible=false;return;}
 const kind=guideKind(settings.tool);
 if(kind&&e.button===0){pendingGuidance={kind,pointer:e.pointerId};showGuidance(pick(e.clientX,e.clientY),kind);return;}
 if(sculptTool(settings.tool)&&e.button===0){hideGuidance();const p=pick(e.clientX,e.clientY);if(!p)return;strokeY=Math.max(SEA,p.y);stroke=terrain.beginStroke(p.x,p.z,settings.tool);strokeSnapshot=stroke.snapshot;strokeChanged=false;sculpting=true;strokeStart={x:e.clientX,y:e.clientY};touchPending=e.pointerType==='touch';touchStartTime=performance.now();if(!touchPending){paint(e.clientX,e.clientY,true);rebuild();}else showBrush(p);}
 }
 function pan(dx:number,dy:number){const scale=(camera.right-camera.left)/host.clientWidth;const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));target.addScaledVector(right,-dx*scale);target.addScaledVector(forward,-dy*scale/Math.max(.4,Math.sin(pitch)));target.x=THREE.MathUtils.clamp(target.x,-EXTENT*.43,EXTENT*.43);target.z=THREE.MathUtils.clamp(target.z,-EXTENT*.43,EXTENT*.43);updateCamera();}
 function pointerMove(e:PointerEvent){
 if(e.pointerType!=='touch')skyPointer={x:e.clientX,y:e.clientY};
 if(pointers.size>=2&&pointers.has(e.pointerId)){const prev=[...pointers.values()],oldDist=Math.hypot(prev[0].x-prev[1].x,prev[0].y-prev[1].y),oldMid={x:(prev[0].x+prev[1].x)/2,y:(prev[0].y+prev[1].y)/2};pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=[...pointers.values()],dist=Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y);if(oldDist>5&&dist>5)view=THREE.MathUtils.clamp(view*oldDist/dist,3.8,150);pan((next[0].x+next[1].x)/2-oldMid.x,(next[0].y+next[1].y)/2-oldMid.y);brush.visible=false;hideGuidance();return;}
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pressed&&pointers.has(e.pointerId)){const dx=e.clientX-lastX,dy=e.clientY-lastY;
 if(pendingGuidance){hoverPending={x:e.clientX,y:e.clientY};}else if(sculpting){if(touchPending&&performance.now()-touchStartTime>120)startPendingTouch();if(!touchPending&&performance.now()-lastPaint>55)paint(e.clientX,e.clientY);}else if(dragButton!==0||e.shiftKey){pan(dx,dy);}else{yaw-=dx*.006;pitch=THREE.MathUtils.clamp(pitch+dy*.004,.4,Math.PI/2-.001);updateCamera();}
 lastX=e.clientX;lastY=e.clientY;
 }else{hoverPending={x:e.clientX,y:e.clientY};}
 }
 function pointerUp(e:PointerEvent){hoverPending=null;
 if(pendingGuidance&&pendingGuidance.pointer===e.pointerId){
  const request=pendingGuidance;pendingGuidance=null;
  if(e.type!=='pointercancel'&&e.button===0&&pointers.size===1&&guideKind(settings.tool)===request.kind&&document.elementFromPoint(e.clientX,e.clientY)===canvas){
   const p=pick(e.clientX,e.clientY);
   if(p){if(settings.paused&&(request.kind==='rain'||request.kind==='bloom')){onGuidance('Resume the village to place a blessing.');}else{const result=simulation.guide(request.kind,{x:Math.round(p.x*2)/2,z:Math.round(p.z*2)/2});onGuidance(result.message);if(result.allowed){saveNow();if(request.kind==='settle'){target.set(p.x,terrain.height(p.x,p.z),p.z);view=24;updateCamera();}}}}
  }
  hideGuidance();
 }
 if(sculpting&&pointers.size===1&&e.type!=='pointercancel'){startPendingTouch();const end=pick(e.clientX,e.clientY,true);if(end&&(!lastStampPoint||end.distanceTo(lastStampPoint)>.06))paint(e.clientX,e.clientY);}pointers.delete(e.pointerId);finishStroke();if(!pointers.size){pressed=false;}else{const p=[...pointers.values()][0];lastX=p.x;lastY=p.y;dragButton=2;}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(e.pointerType==='touch')brush.visible=false;}
 function cancel(){hoverPending=null;pendingGuidance=null;hideGuidance();finishStroke();pointers.clear();pressed=false;brush.visible=false;}
 function wheel(e:WheelEvent){e.preventDefault();view=THREE.MathUtils.clamp(view*Math.exp(e.deltaY*.001),3.8,150);updateCamera();}
 const context=(e:Event)=>e.preventDefault(),leave=()=>{hoverPending=null;skyPointer=null;wildlife.setCursorRay(null);if(!pressed){brush.visible=false;hideGuidance();}};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('contextmenu',context);window.addEventListener('blur',cancel);
 let hoverPending:{x:number;y:number}|null=null;
 let frame=0,last=performance.now(),elapsed=0,lastRebuild=0,lastSave=performance.now(),lastWaterContacts=-1000;
 const draw=(now:number)=>{frame=requestAnimationFrame(draw);const dt=Math.min((now-last)/1000,.05);last=now;if(!settings.paused)elapsed+=dt;
 if(hoverPending){const pointer=hoverPending;hoverPending=null;if(pendingGuidance&&pointers.size===1){showGuidance(pick(pointer.x,pointer.y),pendingGuidance.kind);}else if(!pressed&&(sculptTool(settings.tool)||guideKind(settings.tool))){const p=pick(pointer.x,pointer.y);if(guideKind(settings.tool))showGuidance(p);else showBrush(p);}}
 if(sculpting&&touchPending&&now-touchStartTime>120)startPendingTouch();
 if(sculpting&&!touchPending&&now-lastPaint>110&&pointers.size===1){const p=[...pointers.values()][0];paint(p.x,p.y);}
 if(dirty&&now-lastRebuild>115){rebuild();lastRebuild=now;}
 if(!sculptTool(settings.tool))brush.visible=false;
 if(!guideKind(settings.tool))hideGuidance();
 else if(placement&&now-previewTime>250){previewTime=now;previewKey='';showGuidance(new THREE.Vector3(placement.x,0,placement.z));}
 if(pendingGuidance&&guideKind(settings.tool)!==pendingGuidance.kind)pendingGuidance=null;canvas.style.cursor=settings.tool==='move'?(pressed?'grabbing':'grab'):'crosshair';
 refreshScenery();
 if(now-lastWaterContacts>1000&&!sculpting){ocean.setWaterContacts(simulation.state.plots.filter(p=>terrain.height(p.x,p.z)<SEA).map(p=>({x:p.x,z:p.z,radius:p.kind==='home'?.65:1.25})));lastWaterContacts=now;}
 const stopped=settings.paused||sculpting||mesher.busy;
 simulation.advance(dt*settings.speed,stopped);islanders.sync(simulation.state.settlers,dt*settings.speed,stopped);villageView.update(simulation,settings.showPlots,settings.showInfluence||settings.tool==='rain'||settings.tool==='bloom');
 if(now-lastSave>15000&&!sculpting&&!mesher.busy){saveNow();lastSave=now;}
 const light=daylight.update(simulation.state.time);if(Math.floor(elapsed*8)!==Math.floor((elapsed-dt)*8))renderer.shadowMap.needsUpdate=true;ocean.setLighting(light.direction,light.colour,light.strength,light.tint,scene.background as THREE.Color);landscape.setLighting(light.tint);
 foodView.update(simulation.state);landscape.update(simulation.state,elapsed);landAnimals.sync(simulation.state.foodSystem.animals,dt*settings.speed,stopped);wildlife.managedFishing=simulation.state.foodSystem.fishing;ocean.update(elapsed,camera);if(skyPointer){makeRay(skyPointer.x,skyPointer.y);wildlife.setCursorRay(ray.ray,Math.max(1.5,view*.07));}wildlife.update(dt,settings.paused);marine.update(dt,settings.paused);renderer.render(scene,camera);
 };frame=requestAnimationFrame(draw);onReady();
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);updateCamera();};const observer=new ResizeObserver(resize);observer.observe(host);
 function saveNow(){if(!saveAllowed)return;try{localStorage.setItem(SAVE_KEY,encodeSave(terrain.values,simulation.state));saveNotice='Saved on this device';}catch{saveNotice='Saving is unavailable. Export a copy to keep your island.';}}
 function backup(){try{localStorage.setItem(SAVE_KEY+'.previous',encodeSave(terrain.values,simulation.state));}catch{throw new Error('Device storage is full or unavailable. Export your island before replacing it.');}}
 function replaceWorld(saved?:IslandSave){
  pendingGuidance=null;hideGuidance();finishStroke();mesher.cancel();backup();
  if(saved)terrain.values.set(saved.terrain);else{const original=new Terrain();terrain.values.set(original.values);original.dispose();}
  terrain.rebuild();mesher.syncBaseline();simulation.metadata.dispose();simulation=new Settlement(terrain,saved?.world);if(saved?.migratedFrom||saved?.archipelagoUpgraded)simulation.terrainChanged();islanders.clear();wildlife.terrainChanged();landscape.terrainChanged();scene.remove(landAnimals.group);landAnimals.dispose();landAnimals=new LandAnimals(terrain,(x,z)=>simulation.state.plots.some(p=>p.valid&&Math.abs(x-p.x)<1.5&&Math.abs(z-p.z)<1.5));scene.add(landAnimals.group);
  scene.remove(villageView.group);villageView.dispose();villageView=new SettlementView(terrain);scene.add(villageView.group);
  history.length=0;onHistory(0);saveAllowed=true;saveNow();
 }
 const onPageHide=()=>{finishStroke();saveNow();};window.addEventListener('pagehide',onPageHide);
 return {settings,
 foodRole(kind,id,worker){const ok=simulation.foodSystem.assignRole(kind,id,worker);if(ok)saveNow();return ok;},
 foodPriority(id,value){const ok=simulation.foodSystem.priority(id,value);if(ok)saveNow();return ok;},
 trainHunting(id){const ok=simulation.foodSystem.train(id);if(ok)saveNow();return ok;},
 toggleHunting(id){const ok=simulation.foodSystem.hunt(id);if(ok)saveNow();return ok;},
 rearmTrap(id){const ok=simulation.foodSystem.rearm(id);if(ok)saveNow();return ok;},status:()=>simulation.status(),placement:()=>placement,
 upgradeHome(id){const ok=simulation.upgradeHome(id);if(ok)saveNow();return ok;},
 assignFarmer(plotId,workerId){const ok=simulation.assignFarmer(plotId,workerId);if(ok)saveNow();return ok;},
 collectOfferings(){const collected=simulation.collectOfferings();if(collected)saveNow();return collected;},
 dismissBeacon(){const ok=simulation.dismissBeacon();if(ok)saveNow();return ok;},
 cancelOrder(id){const ok=simulation.cancelOrder(id);if(ok){previewKey='';saveNow();}return ok;},
 focusGuidance(id){const p=simulation.state.orders.find(o=>o.id===id)??simulation.state.plots.find(o=>o.id===id)??simulation.state.foodSystem.fishing.find(a=>a.id===id)??simulation.state.foodSystem.traps.find(a=>a.id===id)??(simulation.state.beacon?.id===id?simulation.state.beacon:null);if(p){target.set(p.x,terrain.height(p.x,p.z),p.z);view=host.clientWidth<600?13:18;updateCamera();}},
 power(kind){if(settings.paused)return false;const ok=simulation.power(kind);if(ok)saveNow();return ok;},saveStatus:()=>saveNotice,
 exportSave(){finishStroke();return encodeSave(terrain.values,simulation.state);},
 importSave(raw){try{const saved=decodeSave(raw);replaceWorld(saved);return 'Your island has been restored.';}catch(e){return e instanceof Error?e.message:'The save could not be read.';}},
 resetWorld(){try{replaceWorld();return 'A new island is ready.';}catch(e){return e instanceof Error?e.message:'Your current island has been kept.';}},restorePrevious(){try{const raw=localStorage.getItem(SAVE_KEY+'.previous');if(!raw)return 'There is no previous island to restore.';replaceWorld(decodeSave(raw));return 'Your previous island has been restored.';}catch{return 'The previous island could not be restored.';}},
 hasPrevious(){try{return !!localStorage.getItem(SAVE_KEY+'.previous');}catch{return false;}},
 focusVillage(){const p=simulation.state.camp;if(p){target.set(p.x,terrain.height(p.x,p.z),p.z);view=host.clientWidth<600?13:18;updateCamera();}},inspectTerrain:(x,z)=>simulation.metadata.inspect(x,z),assessPlot:(kind,bounds,context)=>simulation.metadata.assessPlot(kind,bounds,context),cameraStatus:()=>({heading:yaw*180/Math.PI,overhead:pitch>1.5}),north(){yaw=0;updateCamera();},topView(){const overhead=pitch>1.5;view=host.clientWidth<600?116:98;yaw=0;pitch=overhead?.82:Math.PI/2-.001;target.set(0,1.5,0);updateCamera();},zoom(d){view=THREE.MathUtils.clamp(view+d,3.8,150);updateCamera();},home(){view=host.clientWidth<600?116:98;yaw=.30;pitch=.82;target.set(0,1.5,0);updateCamera();},addIslanders(){const n=simulation.add(2);saveNow();return n;},undo(){finishStroke();mesher.cancel();const saved=history.pop();if(saved){terrain.values.set(saved);terrain.rebuild();mesher.syncBaseline();simulation.terrainChanged();villageView.terrainChanged();wildlife.terrainChanged();landscape.terrainChanged();landAnimals.terrainChanged();onHistory(history.length);}},dispose(){finishStroke();mesher.dispose();saveNow();window.removeEventListener('pagehide',onPageHide);cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('blur',cancel);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('contextmenu',context);villageView.dispose();guidanceCursor.dispose();simulation.metadata.dispose();terrain.dispose();islanders.dispose();wildlife.dispose();marine.dispose();foodView.dispose();landscape.dispose();landAnimals.dispose();ocean.dispose();ring.geometry.dispose();disk.geometry.dispose();ringMaterial.dispose();fillMaterial.dispose();renderer.dispose();host.replaceChildren();}};
}
