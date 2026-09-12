/** Quiet procedural coastal ambience. No downloads, animation-frame work or audio before a gesture. */
export class CoastalAmbience {
  private context: AudioContext;
  private master: GainNode;
  private surf: GainNode;
  private filter: BiquadFilterNode;
  private source: AudioBufferSourceNode;
  private timer: ReturnType<typeof setInterval>;
  private nextWave=0;
  private nextGull=0;
  private playing=false;
  private disposed=false;
  constructor(){
    this.context=new AudioContext();
    const c=this.context;
    this.master=c.createGain();this.master.gain.value=.32;this.master.connect(c.destination);
    this.surf=c.createGain();this.surf.gain.value=.08;
    this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=680;
    const high=c.createBiquadFilter();high.type='highpass';high.frequency.value=95;
    // Long independent stereo noise channels avoid a short obvious loop.
    const buffer=c.createBuffer(2,c.sampleRate*19,c.sampleRate);
    for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.035)/1.025;data[i]=brown*2+(Math.random()*2-1)*.14;}}
    this.source=c.createBufferSource();this.source.buffer=buffer;this.source.loop=true;
    this.source.connect(high);high.connect(this.filter);this.filter.connect(this.surf);this.surf.connect(this.master);this.source.start();
    this.nextGull=3+Math.random()*7;
    this.timer=setInterval(()=>this.schedule(),500);
  }
  setPlaying(value:boolean){
    if(this.disposed)return;this.playing=value;
    if(value){void this.context.resume().then(()=>{if(!this.playing&&!this.disposed)void this.context.suspend();}).catch(()=>{});}
    else void this.context.suspend().catch(()=>{});
  }
  private schedule(){
    if(!this.playing||this.context.state!=='running')return;
    const t=this.context.currentTime;
    if(t>=this.nextWave){
      const rise=1.8+Math.random()*2.8,fall=3.5+Math.random()*4;
      this.surf.gain.cancelScheduledValues(t);this.surf.gain.setValueAtTime(.08,t);
      this.surf.gain.linearRampToValueAtTime(.28+Math.random()*.22,t+rise);
      this.surf.gain.exponentialRampToValueAtTime(.08,t+rise+fall);
      this.filter.frequency.setTargetAtTime(600+Math.random()*650,t,2);
      this.nextWave=t+rise+fall+Math.random()*3;
    }
    if(t>=this.nextGull){this.callGull(t+.05);this.nextGull=t+12+Math.random()*24;}
  }
  private callGull(t:number){
    const c=this.context,pan=c.createStereoPanner();pan.pan.value=Math.random()*1.6-.8;pan.connect(this.master);
    const count=2+Math.floor(Math.random()*3),pitch=650+Math.random()*280;
    let remaining=count*2;
    for(let i=0;i<count;i++)for(let harmonic=1;harmonic<=2;harmonic++){
      const start=t+i*.42,duration=.3+Math.random()*.12,osc=c.createOscillator(),gain=c.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(pitch*.8*harmonic,start);
      osc.frequency.exponentialRampToValueAtTime(pitch*1.55*harmonic,start+.07);
      osc.frequency.exponentialRampToValueAtTime(pitch*.74*harmonic,start+duration);
      gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.065/harmonic,start+.055);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      osc.connect(gain);gain.connect(pan);osc.start(start);osc.stop(start+duration+.02);
      osc.onended=()=>{osc.disconnect();gain.disconnect();if(--remaining===0)pan.disconnect();};
    }
  }
  dispose(){if(this.disposed)return;this.disposed=true;clearInterval(this.timer);this.source.stop();void this.context.close().catch(()=>{});}
}
