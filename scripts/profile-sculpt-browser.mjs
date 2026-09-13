const {chromium}=await import(new URL('../work/browser-qa/node_modules/playwright/index.mjs',import.meta.url).href);
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-gl=angle','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});const requests=[];page.on('request',r=>{if(r.url().includes('/game/'))requests.push(r.url());});const workers=[];page.on('worker',w=>workers.push(w.url()));const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.PROFILE_URL??'http://localhost:3011/');await page.getByRole('button',{name:'Enter your world'}).click({timeout:60000});
await page.waitForTimeout(5000);
await page.evaluate(async(urls)=>{
 window.metrics={frames:[],long:[],refresh:{},phase:'idle',simulation:[]};
 const {Settlement}=await import(urls.find(url=>url.includes('/lib/game/settlement.ts')));const advance=Settlement.prototype.advance;
 Settlement.prototype.advance=function(dt,paused){const before=this.state.time;const result=advance.call(this,dt,paused);if(window.metrics.recording)window.metrics.simulation.push({phase:window.metrics.phase,paused,before,after:this.state.time,population:this.state.settlers.length});return result;};
 let last=performance.now(),wasRecording=false;function frame(now){if(window.metrics.recording&&wasRecording)window.metrics.frames.push({phase:window.metrics.phase,ms:now-last});last=now;wasRecording=!!window.metrics.recording;requestAnimationFrame(frame);}requestAnimationFrame(frame);
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(window.metrics.recording)window.metrics.long.push({ms:e.duration,phase:window.metrics.phase});}).observe({type:'longtask',buffered:false});
 for(const [file,name] of [['wildlife','Wildlife'],['landscape','Landscape'],['land-animals','LandAnimals']]){
  const module=await import(urls.find(url=>url.includes('/lib/game/'+file+'.ts')));const proto=module[name].prototype,original=proto.terrainChanged;
  proto.terrainChanged=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{(window.metrics.refresh[name]??=[]).push(performance.now()-start);}};
 }
},requests);
await page.getByRole('button',{name:'Choose your first settlement'}).click();await page.mouse.click(640,410);await page.waitForTimeout(500);
await page.getByRole('button',{name:'SHAPE',exact:true}).click();await page.getByRole('button',{name:'Raise',exact:true}).click();await page.getByRole('button',{name:'Close shape controls'}).click();
const session=await page.context().newCDPSession(page);await session.send('Profiler.enable');await session.send('Profiler.start');
await page.evaluate(()=>{window.metrics.recording=true;window.metrics.phase='hover';});
for(let i=0;i<35;i++){await page.mouse.move(430+i*10,390+30*Math.sin(i));await page.waitForTimeout(15);}
await page.evaluate(()=>window.metrics.phase='press');await page.mouse.move(610,410);await page.mouse.down();
await page.evaluate(()=>window.metrics.phase='drag');for(let i=0;i<25;i++){await page.mouse.move(610+i*3,410+i);await page.waitForTimeout(40);}
await page.evaluate(()=>window.metrics.phase='release');await page.mouse.up();await page.waitForTimeout(1500);
await page.evaluate(()=>window.metrics.recording=false);const profile=await session.send('Profiler.stop');
const metrics=await page.evaluate(()=>window.metrics);await page.screenshot({path:'work/browser-qa/profile.png'});const undo=await page.getByRole('button',{name:'Undo last sculpt'}).isEnabled().catch(()=>false);const report={errors,workers,undo,simulation:metrics.simulation.filter(s=>s.phase==='drag').reduce((r,s)=>({population:s.population,advanced:r.advanced+s.after-s.before,paused:r.paused||s.paused}),{advanced:0,paused:false}),refresh:metrics.refresh,longTasks:metrics.long,frames:Object.fromEntries(['hover','press','drag','release'].map(phase=>{const a=metrics.frames.filter(x=>x.phase===phase).map(x=>x.ms).sort((a,b)=>a-b);return [phase,{count:a.length,max:a.at(-1),p95:a[Math.floor(a.length*.95)]}];}))};
writeFileSync(process.argv[2]??'work/browser-qa/profile.json',JSON.stringify({report,metrics,profile},null,2));console.log(JSON.stringify(report));await browser.close();
