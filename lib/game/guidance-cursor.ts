import {FOOD_BALANCE as B} from './food-balance';
import * as THREE from 'three';
import { SEA, type Terrain } from './terrain';
import type { GuidancePreview } from './world-state';

/** A reusable preview; it never changes terrain, inventory or construction. */
export class GuidanceCursor {
  group=new THREE.Group();
  private home=new THREE.Group();
  private farm=new THREE.Group();
  private beacon=new THREE.Group();
  private temple=new THREE.Group();
  private slaughterhouse=new THREE.Group();
  private boundary=new THREE.Group();
  private blessing=new THREE.Group();
  private edge=new THREE.MeshBasicMaterial({color:'#b8e3ab',depthTest:false,depthWrite:false});
  private fill=new THREE.MeshBasicMaterial({color:'#b8e3ab',transparent:true,opacity:.24,depthTest:false,depthWrite:false});
  constructor(private terrain:Terrain){
    this.group.add(this.home,this.farm,this.beacon,this.temple,this.slaughterhouse,this.boundary,this.blessing);this.group.visible=false;
    const box=(root:THREE.Object3D,size:number[],position:number[],material:THREE.Material)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material);
      m.position.set(position[0],position[1],position[2]);m.renderOrder=10;root.add(m);
    };
    const light=new THREE.Mesh(new THREE.OctahedronGeometry(.28),this.fill);light.position.y=2.2;this.beacon.add(light);
    box(this.beacon,[.06,2,.06],[0,1,0],this.edge);
    for(const z of [-1.05,1.05])box(this.boundary,[2.1,.035,.055],[0,.02,z],this.edge);
    for(const x of [-1.05,1.05])box(this.boundary,[.055,.035,2.1],[x,.02,0],this.edge);
    box(this.home,[1.6,1.15,1.5],[0,.65,-.08],this.fill);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1.7,.95,4),this.fill);
    roof.position.y=1.76;roof.rotation.y=Math.PI/4;roof.renderOrder=10;this.home.add(roof);
    box(this.temple,[1.9,.25,1.9],[0,.125,0],this.fill);
    for(const x of [-.7,.7])for(const z of [-.65,.65])box(this.temple,[.2,1.8,.2],[x,1.1,z],this.fill);
    box(this.temple,[1.95,.2,1.8],[0,2.1,0],this.fill);
    const spire=new THREE.Mesh(new THREE.ConeGeometry(.65,1,4),this.fill);spire.position.y=2.7;this.temple.add(spire);
    box(this.slaughterhouse,[1.7,1.1,.9],[0,.55,-.4],this.fill);
    box(this.slaughterhouse,[1.9,.12,1.9],[0,.06,0],this.fill);
    const area=new THREE.Mesh(new THREE.RingGeometry(.97,1,96),this.edge);area.rotation.x=-Math.PI/2;area.renderOrder=10;this.blessing.add(area);
    for(let i=0;i<5;i++)box(this.farm,[.18,.09,1.9],[-.76+i*.38,.08,0],this.fill);
  }
  show(preview:GuidancePreview|null){
    this.group.visible=!!preview;if(!preview)return;
    this.home.scale.setScalar(preview.kind==='home'?B.visuals.hut:1);
    this.home.visible=preview.kind==='granary'||preview.kind==='storehouse'||preview.kind==='home'||preview.kind==='coop'||preview.kind==='pigpen';this.farm.visible=preview.kind==='farm';this.beacon.visible=(preview.kind==='rally'||preview.kind==='settle'||preview.kind==='fishing'||preview.kind==='trap');this.temple.visible=preview.kind==='temple';this.slaughterhouse.visible=preview.kind==='slaughterhouse';
    this.blessing.visible=preview.kind==='rain'||preview.kind==='bloom';this.blessing.scale.setScalar(preview.radius??1);this.boundary.visible=!this.blessing.visible;
    this.group.position.set(preview.x,Math.max(SEA+.1,this.terrain.height(preview.x,preview.z))+.035,preview.z);
    const colour=preview.allowed?'#b8e3ab':'#ee987f';this.edge.color.set(colour);this.fill.color.set(colour);
  }
  dispose(){this.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.edge.dispose();this.fill.dispose();this.group.clear();}
}
