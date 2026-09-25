'use client';
import { useRef } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Footprints, Hand, Undo2, Plus, Minus, UserPlus, Layers3, Navigation2, Scan, ChevronUp, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import type { Tool } from '@/lib/game/engine';
import { VILLAGE_BALANCE } from '@/lib/game/world-state';

const shapeTools=[{id:'raise',label:'Raise',icon:ArrowUpFromLine},{id:'lower',label:'Lower',icon:ArrowDownToLine},{id:'path',label:'Path',icon:Footprints}] as const;
type Props={tool:Tool;choose:(tool:Tool)=>void;open:boolean;setOpen:(open:boolean)=>void;brush:number;setBrush:(brush:number)=>void;ready:boolean;population:number;add:()=>void;zoom:(delta:number)=>void;north:()=>void;heading:number;overhead:boolean;topView:()=>void;history:number;undo:()=>void};
export function WorldToolbar(p:Props){
 const populationLimit=VILLAGE_BALANCE.maxPopulation;
 const shapeButton=useRef<HTMLButtonElement>(null);
 const shaping=shapeTools.some(t=>t.id===p.tool);
 function close(){p.setOpen(false);shapeButton.current?.focus();}
 return <div className="world-controls">
  {p.open&&<dialog open id="shape-controls" className="shape-panel glass" aria-modal={false} aria-label="Shape the island" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
   <div className="shape-heading"><b>SHAPE</b><span>One layer at a time</span><button aria-label="Close shape controls" onClick={close}><X /></button></div>
   <div className="shape-tools">{shapeTools.map(({id,label,icon:Icon},i)=><button key={id} className={p.tool===id?'selected':''} aria-pressed={p.tool===id} disabled={!p.ready} title={`${label} (${i+2})`} onClick={()=>p.choose(id)}><Icon /><span>{label}</span></button>)}</div>
   <div className="shape-brush"><div><span id="shape-brush-label">Brush size</span><b>{p.brush<2.6?'Small':p.brush<5.5?'Medium':'Large'}</b></div><Slider min={1.5} max={8} step={.1} value={[p.brush]} onValueChange={v=>p.setBrush(Array.isArray(v)?v[0]:v)} aria-labelledby="shape-brush-label" /></div>
  </dialog>}
  <nav className="world-dock glass" aria-label="Island controls">
   <button className={`dock-explore ${p.tool==='move'?'selected':''}`} aria-label="Explore the island" aria-pressed={p.tool==='move'} title="Explore (1) · Orbit and pan" disabled={!p.ready} onClick={()=>{p.choose('move');p.setOpen(false);}}><Hand /><span>Explore</span></button>
   <button ref={shapeButton} className={`dock-shape ${shaping?'selected':''}`} aria-expanded={p.open} aria-controls="shape-controls" title={shaping?`Shape the island · ${p.tool} selected`:'Shape the island'} onClick={()=>p.setOpen(!p.open)}><Layers3 /><span>SHAPE</span><ChevronUp className={p.open?'expanded':''} /></button>
   <button className="dock-islanders" aria-label={p.population?`Add two islanders · ${p.population} of ${populationLimit}`:'Choose your first settlement'} title={p.population>=populationLimit?`Maximum ${populationLimit} islanders`:p.population?'Add two islanders':'Choose settlement'} disabled={!p.ready||p.population>=populationLimit} onClick={()=>{p.setOpen(false);p.add();}}><UserPlus /><b>{p.population}</b></button>
   <button aria-label="Zoom out" title="Zoom out" disabled={!p.ready} onClick={()=>p.zoom(3)}><Minus /></button>
   <button aria-label="Zoom in" title="Zoom in" disabled={!p.ready} onClick={()=>p.zoom(-3)}><Plus /></button>
   <button className="dock-compass" aria-label="Face north" title="Compass · Face north" disabled={!p.ready} onClick={p.north}><small>N</small><Navigation2 style={{transform:`rotate(${p.heading}deg)`}} /></button>
   <button aria-label={p.overhead?'Return to angled island view':'Island top view'} aria-pressed={p.overhead} title={p.overhead?'Return to angled view':'See the islands from above'} className={p.overhead?'selected':''} disabled={!p.ready} onClick={p.topView}><Scan /></button>
   <button aria-label="Undo last sculpt" title="Undo terrain stroke" disabled={!p.history} onClick={p.undo}><Undo2 /></button>
  </nav>
 </div>;
}
