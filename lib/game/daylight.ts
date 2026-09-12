import * as THREE from 'three';
import {DAY_SECONDS} from './world-state';

const FRAMES=[
  {at:0,sky:'#697e9b',air:'#d9bac2',ground:'#858873',sun:'#ffd2a1',ambient:.85,power:.72,strength:.35,tint:'#c3cce2'},
  {at:.12,sky:'#83a8b9',air:'#d9f6ff',ground:'#92a372',sun:'#fff0d4',ambient:1.15,power:1.9,strength:1,tint:'#ffffff'},
  {at:.38,sky:'#769bab',air:'#e3f4ff',ground:'#92a372',sun:'#fff0cf',ambient:1.2,power:2.05,strength:1,tint:'#ffffff'},
  {at:.56,sky:'#786880',air:'#cba6b0',ground:'#8d7a68',sun:'#ffae7b',ambient:.95,power:1.12,strength:.62,tint:'#eed0bc'},
  {at:.70,sky:'#111d34',air:'#859bc7',ground:'#5d6b8a',sun:'#a8c6f1',ambient:.68,power:.30,strength:0,tint:'#88a6cb'},
  {at:.90,sky:'#111d34',air:'#859bc7',ground:'#5d6b8a',sun:'#a8c6f1',ambient:.68,power:.30,strength:0,tint:'#88a6cb'},
  {at:1,sky:'#697e9b',air:'#d9bac2',ground:'#858873',sun:'#ffd2a1',ambient:.85,power:.72,strength:.35,tint:'#c3cce2'},
].map(f=>({...f,sky:new THREE.Color(f.sky),air:new THREE.Color(f.air),ground:new THREE.Color(f.ground),sun:new THREE.Color(f.sun),tint:new THREE.Color(f.tint)}));

/** Uses saved simulation time; no additional clock or save data is needed. */
export class Daylight {
  readonly direction=new THREE.Vector3();
  readonly colour=new THREE.Color();
  readonly tint=new THREE.Color();
  strength=1;
  constructor(private scene:THREE.Scene,private sun:THREE.DirectionalLight,private ambient:THREE.HemisphereLight){}
  update(seconds:number){
    const phase=((seconds%DAY_SECONDS)+DAY_SECONDS)%DAY_SECONDS/DAY_SECONDS;
    let index=0;while(index<FRAMES.length-2&&phase>FRAMES[index+1].at)index++;
    const a=FRAMES[index],b=FRAMES[index+1],u=THREE.MathUtils.smoothstep(phase,a.at,b.at);
    this.colour.copy(a.sun).lerp(b.sun,u);this.tint.copy(a.tint).lerp(b.tint,u);
    this.strength=THREE.MathUtils.lerp(a.strength,b.strength,u);
    this.sun.color.copy(this.colour);this.sun.intensity=THREE.MathUtils.lerp(a.power,b.power,u);
    this.ambient.color.copy(a.air).lerp(b.air,u);this.ambient.groundColor.copy(a.ground).lerp(b.ground,u);this.ambient.intensity=THREE.MathUtils.lerp(a.ambient,b.ambient,u);
    if(this.scene.background instanceof THREE.Color)this.scene.background.copy(a.sky).lerp(b.sky,u);
    // A continuous sky arc; at night the cool key light provides moonlit relief.
    const angle=phase*Math.PI*2;
    this.direction.set(-Math.cos(angle)*75,30+Math.sin(angle)*20,Math.sin(angle)*65).normalize();
    this.sun.position.copy(this.direction).multiplyScalar(100);
    return this;
  }
}
