import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../lib/game/ambience.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {CoastalAmbience}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('coastal audio pauses, resumes without new sources, and releases its timer and context',async()=>{
 const originals={AudioContext:globalThis.AudioContext,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 let tick,cleared=false,context;
 const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),pan:param(),connect(){},disconnect(){},start(){},stop(){},onended:null});
 class MockContext{
  state='suspended';currentTime=0;sampleRate=100;destination={};sources=0;calls=0;
  constructor(){context=this;}
  createGain(){return node();}createBiquadFilter(){return node();}createStereoPanner(){return node();}
  createBuffer(ch,length){return {getChannelData:()=>new Float32Array(length)};}
  createBufferSource(){this.sources++;return node();}createOscillator(){this.calls++;return node();}
  async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
 }
 try{
  globalThis.AudioContext=MockContext;globalThis.setInterval=f=>{tick=f;return 1;};globalThis.clearInterval=()=>{cleared=true;};
  const audio=new CoastalAmbience();tick();assert.equal(context.calls,0);
  audio.setPlaying(true);await Promise.resolve();context.currentTime=40;tick();assert.ok(context.calls>0,'Gulls sound during active play');
  const calls=context.calls;audio.setPlaying(false);context.currentTime=100;tick();assert.equal(context.calls,calls,'Muted/paused audio schedules nothing');
  audio.setPlaying(true);audio.setPlaying(false);await Promise.resolve();await Promise.resolve();assert.equal(context.state,'suspended','Rapid mute wins over a pending resume');
  audio.setPlaying(true);await Promise.resolve();assert.equal(context.sources,1,'Resume reuses the sea source');
  audio.dispose();assert.ok(cleared);assert.equal(context.state,'closed');audio.dispose();
 }finally{Object.assign(globalThis,originals);}
});
