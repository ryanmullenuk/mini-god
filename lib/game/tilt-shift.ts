import * as THREE from 'three';

// One bounded nine-tap pass; the broad centre stays sharp and UI is never blurred.
export class TiltShift {
  private target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,type:THREE.HalfFloatType,samples:2});
  private scene=new THREE.Scene();
  private camera=new THREE.Camera();
  private material=new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:true,
    uniforms:{image:{value:this.target.texture},pixel:{value:new THREE.Vector2(1,1)}},
    vertexShader:'varying vec2 uvScreen; void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D image;uniform vec2 pixel;varying vec2 uvScreen;
    void main(){
      float focus=smoothstep(.11,.37,abs(uvScreen.y-.52));
      vec2 r=pixel*focus*4.1;
      vec4 c=texture2D(image,uvScreen)*.28;
      c+=(texture2D(image,uvScreen+vec2(r.x,0.))+texture2D(image,uvScreen-vec2(r.x,0.))+
          texture2D(image,uvScreen+vec2(0.,r.y))+texture2D(image,uvScreen-vec2(0.,r.y)))*.12;
      c+=(texture2D(image,uvScreen+r)+texture2D(image,uvScreen-r)+
          texture2D(image,uvScreen+vec2(r.x,-r.y))+texture2D(image,uvScreen+vec2(-r.x,r.y)))*.06;
      gl_FragColor=c;
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
  private quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
  constructor(){this.scene.add(this.quad);}
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
    const size=renderer.getDrawingBufferSize(this.material.uniforms.pixel.value);
    if(this.target.width!==size.x||this.target.height!==size.y)this.target.setSize(size.x,size.y);
    this.material.uniforms.pixel.value.set(1/size.x,1/size.y);
    renderer.setRenderTarget(this.target);renderer.render(scene,camera);
    renderer.setRenderTarget(null);renderer.render(this.scene,this.camera);
  }
  dispose(){this.target.dispose();this.quad.geometry.dispose();this.material.dispose();}
}
