import * as THREE from 'three';
import { EXTENT } from './terrain';

/** One GPU-animated draw call for full-archipelago rain. */
export class IslandWeather {
  readonly group=new THREE.Group();
  private intensity=0;
  private time=0;
  private geometry:THREE.BufferGeometry;
  private material:THREE.ShaderMaterial;
  constructor(count=720){
    const positions=new Float32Array(count*2*3),phases=new Float32Array(count*2);
    let seed=92821;
    const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
    for(let i=0;i<count;i++){
      const x=(random()-.5)*EXTENT*.95,z=(random()-.5)*EXTENT*.95,y=random()*36-5,phase=random();
      for(let end=0;end<2;end++){const k=(i*2+end)*3;positions[k]=x+end*.28;positions[k+1]=y-end*1.15;positions[k+2]=z;phases[i*2+end]=phase;}
    }
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.geometry.setAttribute('phase',new THREE.BufferAttribute(phases,1));
    this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},intensity:{value:0}},
      vertexShader:`attribute float phase;uniform float time;varying float fade;
        void main(){vec3 p=position;p.y=22.-mod(phase*37.+time*24.-position.y,37.);fade=smoothstep(-14.,-7.,p.y)*(1.-smoothstep(17.,22.,p.y));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`uniform float intensity;varying float fade;void main(){gl_FragColor=vec4(.72,.87,.94,intensity*fade*.52);}`});
    const rain=new THREE.LineSegments(this.geometry,this.material);rain.name='Island rain';rain.frustumCulled=false;rain.renderOrder=4;this.group.add(rain);this.group.visible=false;
  }
  update(dt:number,raining:boolean,paused=false){
    if(!paused)this.time+=Math.max(0,dt);
    this.intensity=THREE.MathUtils.damp(this.intensity,raining?1:0,raining?2.8:1.8,Math.min(.1,Math.max(0,dt)));
    this.material.uniforms.time.value=this.time;this.material.uniforms.intensity.value=this.intensity;
    this.group.visible=this.intensity>.01;
  }
  dispose(){this.geometry.dispose();this.material.dispose();this.group.clear();}
}
