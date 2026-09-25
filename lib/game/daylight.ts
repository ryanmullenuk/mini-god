import * as THREE from 'three';
import {DAY_SECONDS} from './world-state';

const FRAMES=[
  {at:0,sky:'#65a8d1',air:'#e0f3ff',ground:'#9aa877',sun:'#ffe2ad',ambient:1.0,power:1.35,strength:.7,tint:'#f3f1e5'},
  {at:.12,sky:'#82b6cf',air:'#dcebed',ground:'#78815c',sun:'#ffe4b0',ambient:.94,power:2.2,strength:1,tint:'#fff5df'},
  {at:.38,sky:'#78abc5',air:'#dce8e8',ground:'#747d59',sun:'#ffdfaa',ambient:.96,power:2.3,strength:1,tint:'#fff2d9'},
  {at:.56,sky:'#786880',air:'#cba6b0',ground:'#8d7a68',sun:'#ffae7b',ambient:.95,power:1.12,strength:.62,tint:'#eed0bc'},
  {at:.70,sky:'#111d34',air:'#91ace0',ground:'#62749a',sun:'#c4d9ff',ambient:.78,power:.72,strength:0,tint:'#9db9e4'},
  {at:.90,sky:'#111d34',air:'#91ace0',ground:'#62749a',sun:'#c4d9ff',ambient:.78,power:.72,strength:0,tint:'#9db9e4'},
  {at:1,sky:'#65a8d1',air:'#e0f3ff',ground:'#9aa877',sun:'#ffe2ad',ambient:1.0,power:1.35,strength:.7,tint:'#f3f1e5'},
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
    if(this.scene.fog instanceof THREE.FogExp2)this.scene.fog.color.copy(a.sky).lerp(b.sky,u).lerp(this.ambient.color,.28);
    // A continuous sky arc; at night the cool key light provides moonlit relief.
    const angle=phase*Math.PI*2;
    this.direction.set(-Math.cos(angle)*82,45+Math.sin(angle)*16,Math.sin(angle)*72).normalize();
    this.sun.position.copy(this.direction).multiplyScalar(100);
    return this;
  }
}
