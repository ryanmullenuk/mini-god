'use client';
import { useEffect, useRef, useState } from 'react';
import { Anchor, ShipWheel, Flame, Lamp, Footprints, Hand, Users, HelpCircle, Pause, Play, Focus, MousePointer2, CloudRain, Sprout, Sparkles, Wheat, TreePine, House, Download, Upload, ChevronDown, ChevronUp, Layers3, RotateCcw, X, Flag, Landmark, Beef, Fish, Hammer, Warehouse, Volume2, VolumeX } from 'lucide-react';
import { CoastalAmbience } from '@/lib/game/ambience';
import { FoodPanel } from '@/components/food-panel';
import { WorldToolbar } from '@/components/world-toolbar';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { GameAPI, Tool } from '@/lib/game/engine';
import { BUILD_LABEL, type GuidancePreview, type SettlementStatus } from '@/lib/game/world-state';

const buildIcons={torch:Lamp,bonfire:Flame,home:House,farm:Wheat,dock:Anchor,temple:Landmark,slaughterhouse:Beef,coop:House,pigpen:Beef,granary:Wheat,storehouse:House};
const hints = { 'guide-dock':'Choose reachable shoreline · 10 wood · Build fishing boats', 'guide-torch':'Tiki torch · 2 wood · Warm light after dusk', 'guide-bonfire':'Bonfire · 5 wood · Available followers gather in the evening', 'guide-granary':'Choose flat ground for a granary · 12 wood · +240 food capacity', 'guide-storehouse':'Choose flat ground for a storehouse · 10 wood · +120 wood capacity', fishing:'Choose dry shoreline near water · Assign a fisher after placing',trap:'Place a pig trap near wild pigs · 3 wood + 1 bait', 'guide-coop':'Choose flat ground for a chicken coop · 6 wood', 'guide-pigpen':'Choose flat ground for a pig pen · 9 wood', settle: 'Choose a broad grassland · Click or tap to settle here', 'guide-temple': 'Choose flat ground for a temple · 18 wood', 'guide-slaughterhouse': 'Choose flat ground for a slaughterhouse · 12 wood', rain: 'Call island-wide rain · 8 faith', bloom: 'Choose where new growth appears · 12 faith', rally: 'Place a beacon · Available followers gather, then return to work', move: 'Drag to orbit · Scroll to zoom · Right-drag to pan', raise: 'Raise one layer per drag · Release to raise the next', lower: 'Lower one layer per drag · Release to lower the next', path: 'Start low · Trim the next layer into a walkable step', 'guide-home': 'Choose flat ground for a hut · Click or tap to guide', 'guide-farm': 'Choose fertile, flat ground for a farm · Click or tap to guide' };

export default function Home() {
  const host = useRef<HTMLDivElement>(null), api = useRef<GameAPI | null>(null), file = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<Tool>('move'), [brush, setBrush] = useState(4);
  const [started,setStarted]=useState(false);
  const ambience=useRef<CoastalAmbience|null>(null);
  const [sound,setSound]=useState(true);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [history, setHistory] = useState(0);
  const [paused, setPaused] = useState(false), [help, setHelp] = useState(false), [reset, setReset] = useState(false);
  const [village, setVillage] = useState<SettlementStatus | null>(null), [save, setSave] = useState('Autosave on this device');
  const [hasPrevious, setHasPrevious] = useState(false);
  const [showPlots, setShowPlots] = useState(false), [speed, setSpeed] = useState<1 | 3>(1), [panel, setPanel] = useState<'village'|'build'|'food'|null>(null), [notice, setNotice] = useState('');
  const [shapeOpen,setShapeOpen]=useState(false),[camera,setCamera]=useState({heading:0,overhead:false});
  const [placement,setPlacement]=useState<GuidancePreview|null>(null);
  const guiding=!['move','raise','lower','path'].includes(tool);
  const [showInfluence,setShowInfluence]=useState(false);
  useEffect(()=>{try{setSound(localStorage.getItem('mini-god.sound')!=='off');}catch{}return()=>{ambience.current?.dispose();ambience.current=null;};},[]);
  useEffect(()=>{const sync=()=>ambience.current?.setPlaying(started&&sound&&!paused&&!document.hidden);sync();document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync);},[started,sound,paused]);
  function enableAudio(){try{ambience.current??=new CoastalAmbience();ambience.current.setPlaying(!paused&&!document.hidden);}catch{setSound(false);setNotice('Sound is unavailable in this browser.');}}
  function enterWorld(){setStarted(true);if(sound)enableAudio();}
  function toggleSound(){const next=!sound;setSound(next);try{localStorage.setItem('mini-god.sound',next?'on':'off');}catch{}if(next&&started)enableAudio();else ambience.current?.setPlaying(false);}
  const population = village?.population ?? 0;
  useEffect(() => {
    let alive = true;
    import('@/lib/game/engine').then(({ createGame }) => {
      if (!alive || !host.current) return;
      try {
        api.current = createGame(host.current, () => setReady(true), setHistory, setNotice);
        setVillage(api.current.status());setSave(api.current.saveStatus());setHasPrevious(api.current.hasPrevious());
        if (window.innerWidth < 600) setPanel(null);
      } catch (e) { setError('This island needs WebGL graphics. Try a browser with hardware acceleration enabled.'); console.error(e); }
    }).catch(() => setError('The island could not load. Please refresh to try again.'));
    const timer = window.setInterval(() => { if (api.current) { setVillage(api.current.status()); setSave(api.current.saveStatus()); setHasPrevious(api.current.hasPrevious());setPlacement(api.current.placement());setCamera(api.current.cameraStatus()); } }, 250);
    return () => { alive = false; window.clearInterval(timer); api.current?.dispose(); api.current = null; };
  }, []);
  useEffect(() => { if (api.current) Object.assign(api.current.settings, { tool, brush, paused:paused||!started, speed, showPlots, showInfluence }); }, [tool, brush, paused, speed, showPlots, showInfluence, ready, started]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if(help||reset||!started)return;
      if(e.key==='Escape'){setPanel(null);setShapeOpen(false);setTool('move');if(api.current)api.current.settings.tool='move';return;}
      if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[role=slider]'))return;
      if(!e.metaKey&&!e.ctrlKey){if(e.key==='5')setTool('guide-home');if(e.key==='6')setTool('guide-farm');if(e.key==='7')setTool('rally');if(e.key==='8')setTool('guide-temple');if(e.key==='9')setTool('guide-slaughterhouse');}
      if (e.key === '1') {setTool('move');setShapeOpen(false);} if (['2','3','4'].includes(e.key)&&!e.ctrlKey&&!e.metaKey) {setTool(e.key==='2'?'raise':e.key==='3'?'lower':'path');setShapeOpen(true);}
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); api.current?.undo(); }
      if (e.code === 'Space') { if(e.target instanceof HTMLElement&&e.target.closest('button'))return; e.preventDefault(); setPaused(v => !v); }
    };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, [help, reset, started]);
  useEffect(()=>{if(population&&tool==='settle'){setTool('move');setPanel('build');}},[population,tool]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 7000); return () => window.clearTimeout(timer); }, [notice]);
  function addSettlers() {
    if(!population){setTool('settle');if(api.current)api.current.settings.tool='settle';setNotice('Choose a broad grass terrace for your first settlement.');return;}
    api.current?.addIslanders(); if (api.current) setVillage(api.current.status());
  }
  function chooseGuidance(next:Tool) {
    setShapeOpen(false);setPanel(null);setNotice(hints[next]);
    const selected=tool===next?'move':next;setTool(selected);if(api.current)api.current.settings.tool=selected;
    if(selected!=='move'&&window.innerWidth<600)setPanel(null);
  }
  function exportIsland() {
    if (!api.current) return;
    const blob = new Blob([api.current.exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'mini-god-island.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('An island save has been downloaded.');
  }
  async function importIsland(selected?: File) {
    if (!selected || !api.current) return;
    if (selected.size > 8_000_000) { setNotice('That file is too large for a Mini God island.'); return; }
    try { setNotice(api.current.importSave(await selected.text())); setVillage(api.current.status()); setSave(api.current.saveStatus()); }
    catch { setNotice('The file could not be opened. Your island has been kept.'); }
    if (file.current) file.current.value = '';
  }
  return <main className={`game${population ? ' living' : ''}`}>
    <div ref={host} className="world" aria-label="Living 3D island. Drag to sculpt, or choose a guidance power and click a building site." />
    <div className="vignette" />
    <header className="topbar">
      <div className="top-actions">
        <button className="round-button glass" aria-label={sound?'Mute sea and bird sounds':'Enable sea and bird sounds'} title={sound?'Sound on':'Sound off'} aria-pressed={sound} onClick={toggleSound}>{sound?<Volume2/>:<VolumeX/>}</button>

        <button className="round-button glass" title={paused ? 'Resume world' : 'Pause world'} aria-label={paused ? 'Resume world' : 'Pause world'} onClick={() => setPaused(v => !v)}>{paused ? <Play /> : <Pause />}</button>
        <button className="round-button glass" aria-label="How to play and island saves" onClick={() => setHelp(true)}><HelpCircle /></button>
      </div>
    </header>
    {(paused||village?.raining)&&<div className="island-label"><span className="live-dot" />{paused?'Paused':'Rain'}</div>}

    {!!population && village && <section className={`village-panel village-compact glass${panel ? ' panel-open' : ''}`} aria-label="Village controls">
      <nav className="village-tabs" aria-label="Village panels">{([{id:'village',label:'Your village',Icon:Users,count:population},{id:'build',label:'Buildings and god powers',Icon:Hammer,count:village.buildings.length},{id:'food',label:'Food and wildlife',Icon:Fish,count:null}] as const).map(({id,label,Icon,count})=><button key={id} aria-label={label} title={label} aria-expanded={panel===id} aria-controls="village-detail-panel" className={panel===id?'selected':''} onClick={()=>{setPanel(panel===id?null:id);setShapeOpen(false);setNotice(id==='village'?village.objective:id==='build'?'Choose a building icon, then choose its site on the island.':'Choose a food icon to manage fish, chickens, pigs or hunting.');}}><Icon/>{count!==null&&<b>{count}</b>}</button>)}{panel&&<button className="close-village" aria-label="Close village panel" onClick={()=>setPanel(null)}><X/></button>}</nav>
      <div className="village-stats">
        <div title="Stored food, after deliveries and meals"><Wheat /><b>{village.food}</b><span>Food</span></div>
        <div title="Wood delivered to camp"><TreePine /><b>{village.wood}</b><span>Wood</span></div>
        <div title="Faith from answered prayers and cared-for settlers"><Sparkles /><b>{village.faith}</b><span>Faith</span></div>
        <div title="Island population"><Users /><b>{population}</b><span>Population</span></div>
      </div>
      {panel && <div className="village-body" id="village-detail-panel">
        <h2 className="panel-caption">{panel==='village'?'Your village':panel==='build'?'Build & upgrade':'Food & wildlife'}</h2>
        <div hidden={panel!=='village'}>
        <p className="village-objective">{village.objective}</p>
        <p className="village-milestone">{village.milestone}</p><div className="village-toggles"><button aria-pressed={showInfluence} onClick={()=>setShowInfluence(v=>!v)}><Sparkles />{showInfluence?'Hide influence':'Influence'}</button><button aria-pressed={showPlots} onClick={() => setShowPlots(v => !v)} title="Show reachable terrain candidates for your building guidance"><Layers3 />{showPlots ? 'Hide plots' : 'Show plots'}</button><button onClick={() => setSpeed(v => v === 1 ? 3 : 1)} aria-label={`Simulation speed ${speed} times. Change speed.`}>{speed}× speed</button></div>
        {village.prayer && <div className="prayer-card"><div><Sparkles /><b>{village.prayer.title}</b></div><p>{village.prayer.message}</p><span>Answer this need · +{village.prayer.reward} faith</span></div>}
        <p className="faith-status">Shared storage: {village.food}/{village.storage.food} food · {village.wood}/{village.storage.wood} wood</p>
        <p className="faith-status">{village.faithMessage}</p>
        </div><div hidden={panel!=='build'}>
        <div className="god-powers icon-powers" aria-label="Buildings and god powers">{([
          {id:'guide-home',name:'Hut',Icon:House,cost:6},{id:'guide-farm',name:'Farm',Icon:Wheat,cost:3},{id:'guide-dock',name:'Dock',Icon:Anchor,cost:10},
          {id:'guide-granary',name:'Granary',Icon:Warehouse,cost:12},{id:'guide-storehouse',name:'Storehouse',Icon:TreePine,cost:10},
          {id:'guide-temple',name:'Temple',Icon:Landmark,cost:18},{id:'guide-slaughterhouse',name:'Slaughterhouse',Icon:Beef,cost:12},
          {id:'guide-torch',name:'Tiki torch',Icon:Lamp,cost:2},{id:'guide-bonfire',name:'Bonfire',Icon:Flame,cost:5},
          {id:'rally',name:'Gather',Icon:Flag,cost:0},{id:'rain',name:'Rain',Icon:CloudRain,cost:8},{id:'bloom',name:'Growth',Icon:Sprout,cost:12},
        ] as const).map(({id,name,Icon,cost})=><button key={id} aria-label={`${name}${cost?` · ${cost} ${id==='rain'||id==='bloom'?'faith':'wood'}`:''}`} title={`${name} · ${hints[id]}`} aria-pressed={tool===id} className={tool===id?'active-guidance':''} disabled={(id==='rain'||id==='bloom')&&(paused||village.faith<cost)} onClick={()=>chooseGuidance(id)}><Icon/><span>{name==='Slaughterhouse'?'Butcher':name==='Storehouse'?'Store':name}</span></button>)}</div>
        {village.dock&&<button className="collect-offerings" disabled={!village.dock.canBuild} onClick={()=>{if(api.current?.buildBoat(village.dock!.id)){setVillage(api.current.status());setNotice(`Fishing boat added to the dock queue.`);}}}><ShipWheel />{village.dock.ships<5?`Build boat ${village.dock.ships+1}/5 · 6 wood`:village.dock.fish&&!village.dock.hasStore?`${village.dock.fish} fish waiting · Build a granary`:`5 boats · ${village.dock.atSea} fishing · ${village.dock.queued} at dock · ${village.dock.trips} trips`}</button>}
        {village.temples>0&&<button className="collect-offerings" disabled={!village.offerings||village.faith>=500} onClick={()=>{const n=api.current?.collectOfferings()??0;if(api.current)setVillage(api.current.status());setNotice(n?`Collected ${n} faith from your temples.`:village.offerings?'Spend some faith before collecting more.':'No offerings ready to collect.');}}><Sparkles />Collect temple offerings · {village.offerings} faith</button>}
        {village.beacon&&<div className="beacon-card" aria-label="Gathering beacon"><button onClick={()=>api.current?.focusGuidance(village.beacon!.id)}><Flag /><span><b>Your beacon · {village.beacon.remaining}s</b><small>{village.beacon.message}</small></span></button><button aria-label="Dismiss beacon" title="Let followers return to work" onClick={()=>{api.current?.dismissBeacon();if(api.current)setVillage(api.current.status());}}><X /></button></div>}
        {!!village.guidance.length&&<div className="guidance-queue" aria-label="Your building guidance">
          <h3>Your guidance</h3>
          <ul>{village.guidance.map(order=><li key={order.id}>
            <button className="guidance-focus" onClick={()=>api.current?.focusGuidance(order.id)} title="See this site"><span>{(()=>{const Icon=buildIcons[order.kind];return <Icon />;})()}<b>{BUILD_LABEL[order.kind]}</b></span><small>{order.message}</small>{order.progress!==null&&<progress max={1} value={order.progress} aria-label={`${BUILD_LABEL[order.kind]} construction progress`} />}</button>
            {order.cancellable&&<button className="withdraw-guidance" aria-label={`Withdraw ${BUILD_LABEL[order.kind].toLowerCase()} request`} title="Withdraw this request before construction. No supplies have been spent." onClick={()=>{if(api.current?.cancelOrder(order.id)){setVillage(api.current.status());setNotice('Request withdrawn. No supplies were spent.');}}}><X /></button>}
          </li>)}</ul>
        </div>}
        {!!village.buildings.length&&<details open className="building-details"><summary>Built · {village.buildings.length}</summary><ul>{village.buildings.map((building,i)=><li key={building.id}><details className="building-entry"><summary>{(()=>{const Icon=buildIcons[building.kind];return <Icon/>;})()}<span>{building.name} · {i+1}</span>{building.upgrade&&<small>↑</small>}</summary><button className="guidance-focus" onClick={()=>api.current?.focusGuidance(building.id)}><span>{(()=>{const Icon=buildIcons[building.kind];return <Icon />;})()}<b>{building.name} · {i+1}</b></span><small>{building.message}</small><small>{building.detail}</small><small>{building.workers}</small>{building.occupants&&<small>{building.occupants}</small>}{building.progress!==null&&<progress max={1} value={building.progress} aria-label={`${BUILD_LABEL[building.kind]} progress`} />}</button>{building.upgrade&&<button className="upgrade-building" disabled={!building.upgrade.allowed} onClick={()=>{if(api.current?.upgradeHome(building.id)){setVillage(api.current.status());setNotice('Cottage upgrade requested. Followers will deliver wood and build.');}}}>{building.upgrade.message}</button>}{building.kind==='farm'&&<label className="farmer-choice">Farmer<select aria-label={`Farmer for field ${i+1}`} value={building.farmerId??''} onChange={e=>{api.current?.assignFarmer(building.id,e.target.value?Number(e.target.value):null);if(api.current)setVillage(api.current.status());}}><option value="">Any available follower</option>{village.workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}</details></li>)}</ul></details>}
        </div>{panel==='food'&&<FoodPanel village={village} api={api.current} choose={chooseGuidance} notice={setNotice}/>}
        <div hidden={panel!=='village'}>
        <ul className="worker-list" aria-label="Settler activities">{village.workers.map(w => <li key={w.id}><b>{w.name}</b><span>{w.activity}</span></li>)}</ul>
        <div className="village-progress"><span>{village.homes} {village.homes === 1 ? 'home' : 'homes'} · {village.farms} {village.farms === 1 ? 'field' : 'fields'}</span><span>{village.answered} prayers answered</span></div>
        <button className="find-village" onClick={() => api.current?.focusVillage()}><Focus />Find my village</button>
        </div>
      </div>}
    </section>}
    <div className="tool-area compact-controls">
      <output className="hint bottom-guidance" aria-live="polite"><MousePointer2/><span>{notice||(guiding&&placement?placement.message:village?.event&&population?village.event:hints[tool])}</span></output>
      <WorldToolbar tool={tool} choose={next=>{setTool(next);if(api.current)api.current.settings.tool=next;}} open={shapeOpen} setOpen={setShapeOpen} brush={brush} setBrush={setBrush} ready={ready} population={population} add={addSettlers} zoom={d=>api.current?.zoom(d)} north={()=>{api.current?.north();if(api.current)setCamera(api.current.cameraStatus());}} heading={camera.heading} overhead={camera.overhead} topView={()=>{api.current?.topView();if(api.current)setCamera(api.current.cameraStatus());}} history={history} undo={()=>api.current?.undo()} />
    </div>
    <div className="bottom-left"><span>Island Nº 001</span>{save}</div>
    {!population && <div className="bottom-right"><Users />Choose where your civilisation begins</div>}

    {(!ready||!started) && <div className="loading mini-god-splash">
      <img className="splash-artwork" src="/polygod-splash.png" width={941} height={1672} alt="PolyGod — Build, Grow, Thrive. Islanders overlooking a tropical island village." fetchPriority="high" draggable={false}/>
      <div className="splash-entry">{error?<div className="error-message" role="alert">{error}</div>:<button disabled={!ready} onClick={enterWorld}>{ready?'Enter your world':'Shaping your island…'}</button>}</div>
    </div>}
    <input ref={file} hidden type="file" accept=".json,application/json" aria-label="Import island save" onChange={e => void importIsland(e.target.files?.[0])} />
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="help-content living-help"><DialogTitle>A little world, finding its way.</DialogTitle><DialogDescription>Shape the terrain. Your settlers decide how to live on it.</DialogDescription>
      <div className="help-grid"><Users /><p><b>Guide your followers</b>Gather followers (7) calls up to six available islanders to a beacon for a brief gathering. Builders and supply carriers finish their work; hungry followers need food first. A beacon lasts up to 90 seconds and can be dismissed. Choose settlement, then click a green preview on a broad grass terrace to welcome your first followers. Next, choose Guide hut or Guide farm. A green preview marks a suitable site; tap or click to leave your guidance. Followers gather the wood and build. Guidance is free: huts need 6 wood, farms need 3. Requests take priority over automatic expansion and can be withdrawn until work starts.</p><Footprints /><p><b>Make room to grow</b>Open SHAPE in the bottom bar for Raise, Lower, Path and brush size. Each drag sculpts one layer on the starting terrace. Release before shaping the next. Islanders can climb one layer at a time, with space to stand between steps. Taller cliffs need a staircase. Start Path on a low terrace to trim only the layer immediately above it.</p><CloudRain /><p><b>Listen to their prayers</b>Meet real needs to earn faith. Build a temple (8) to extend influence and receive offerings from worshippers. Collect those offerings, then aim Rain or New growth within your influence. Two huts, a delivered harvest and a temple unlock tier 2 and larger blessings. Slaughterhouses (9) rear goats using surplus food and prepare meat for delivery; the breeding pair is protected. Natural showers also arrive over time.</p><Hand /><p><b>Explore</b>The bottom bar includes adding islanders, zoom, a compass that faces north when clicked, and a top-view toggle. Drag to orbit, scroll to zoom and right-drag to pan. On touch screens, use two fingers to pan and zoom. A broad mainland provides room for settlements. Three small islands remain offshore. Sculpt a dry crossing and one-layer steps if you want to reach them.</p></div>
      <p className="help-foot">Sculpting undo restores land, while supplies and settlement time continue. Space pauses the world. Your island saves on this device; export a copy to move it elsewhere.</p>
      <output className="save-state">{save}</output>
      <div className="save-actions"><button disabled={!ready} onClick={exportIsland}><Download />Export island</button><button disabled={!ready} onClick={() => file.current?.click()}><Upload />Import island</button><button disabled={!hasPrevious} onClick={() => { setNotice(api.current?.restorePrevious() ?? ''); if (api.current) setVillage(api.current.status()); }}><RotateCcw />Restore previous</button><button disabled={!ready} onClick={() => { setHelp(false); setReset(true); }}>New island…</button></div>
    </DialogContent></Dialog>
    <Dialog open={reset} onOpenChange={setReset}><DialogContent className="help-content"><DialogTitle>Begin a new island?</DialogTitle><DialogDescription>Your current island will be kept as the previous island on this device. Export it first if you want a separate copy.</DialogDescription><div className="save-actions"><button onClick={exportIsland}><Download />Export current island</button><button onClick={() => setReset(false)}>Keep playing</button><button onClick={() => { setNotice(api.current?.resetWorld() ?? ''); setReset(false); setPaused(false); setTool('move'); setShapeOpen(false); if (api.current) setVillage(api.current.status()); api.current?.home(); }}>Begin new island</button></div></DialogContent></Dialog>
  </main>;
}
