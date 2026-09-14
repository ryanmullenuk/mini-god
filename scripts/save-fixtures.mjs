import assert from 'node:assert/strict';
// Historical fixtures stay numeric arrays; changing only a new save's version
// number would not represent an actual legacy file.
export function legacySave(terrain,world){return JSON.stringify({format:'tide-island',version:17,savedAt:'2026-09-13',terrain:Array.from(terrain),world});}
export function assertTerrain(actual,expected,message){
 assert.equal(actual.length,expected.length,message);
 for(let i=0;i<actual.length;i++){
  assert.ok(Math.abs(actual[i]-expected[i])<=.001001,`${message??'Quantized height'} at ${i}`);
  assert.equal(Math.max(-1,Math.floor((actual[i]-.5)/.5)),Math.max(-1,Math.floor((expected[i]-.5)/.5)),`Terrace at ${i}`);
 }
}
