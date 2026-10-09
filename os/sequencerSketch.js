/** Isolated, local-only sequencer sketch. Never sends MIDI or touches device project state. */
export const DEMO_TRACKS=Object.freeze(['KICK','SNARE','HAT','PERC','BASS','VOCAL']);
export function createDemoPattern(){
 return DEMO_TRACKS.map((_,row)=>Array.from({length:16},(_,step)=>
  row===0?step%4===0:
  row===1?[4,12].includes(step):
  row===2?step%2===0:
  row===3?[3,11].includes(step):
  row===4?[0,7,10].includes(step):
  [6,14].includes(step)
 ));
}
export function createSequencerSketch(){
 const store=new Map();
 let root=null,group='A',pattern=1,step=-1,playing=false,timer=null;
 const key=()=>group+'-'+pattern;
 const getSteps=()=>{const id=key();if(!store.has(id))store.set(id,createDemoPattern());return store.get(id);};
 function markup(){
  const rows=getSteps();
  return `<section class="os-seq-frame" aria-label="Local sequencer concept">
    <div class="os-workflow-heading">
      <div><div class="eyebrow">SEQUENCER / CONCEPT STUDY</div><h2>See the whole groove.</h2><p>Local demo pattern only. No EP data read, audio playback or MIDI commands.</p></div>
      <a class="button secondary" href="../index.html#my-ep">OPEN VERIFIED SEQUENCER ↗</a>
    </div>
    <div class="os-demo-warning"><strong>LOCAL PATTERN DEMO</strong><span>All changes stay inside this browser session. Nothing is transferred to KO II.</span></div>
    <div class="os-seq-card">
      <div class="os-seq-head"><span>DRUM GRID <b>16 STEPS / 6 TRACKS</b></span>
       <div class="os-seq-tools">
        <label>GROUP <select id="os-demo-group"><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
        <label>PATTERN <select id="os-demo-pattern">${[1,2,3,4].map(n=>'<option value="'+n+'">'+String(n).padStart(2,'0')+'</option>').join('')}</select></label>
       </div>
      </div>
      <div class="os-seq-grid" role="group" aria-label="Editable local demo sequencer">
        <div class="os-seq-lane-label"></div>
        ${Array.from({length:16},(_,i)=>'<span class="os-seq-number">'+(i+1)+'</span>').join('')}
        ${DEMO_TRACKS.map((track,row)=>'<div class="os-seq-lane-label"><i>'+String(row+1).padStart(2,'0')+'</i><span>'+track+'</span></div>'+
        rows[row].map((on,col)=>'<button type="button" class="os-step'+(on?' on':'')+(col===step?' playhead':'')+'" data-track="'+row+'" data-step="'+col+'" aria-label="'+track+' step '+(col+1)+'" aria-pressed="'+String(on)+'"></button>').join('')).join('')}
      </div>
      <div class="os-seq-transport">
       <button type="button" class="button" id="os-seq-play">${playing?'Ⅱ STOP':'▶ PLAYHEAD'}</button>
       <button type="button" class="button secondary" id="os-seq-clear">CLEAR LOCAL GRID</button>
       <div><strong>93 BPM</strong><small>VISUAL ANIMATION ONLY</small></div>
      </div>
    </div>
    <div class="os-seq-note"><strong>REAL DEVICE WORKFLOW</strong><p>Use the existing verified My EP project sequencer to read supported projects and edit authorized inactive-project fields. This concept grid is intentionally disconnected until live project evidence is available.</p></div>
  </section>`;
 }
 function update(){
  if(!root)return;
  const focused=document.activeElement?.dataset?.step;
  root.innerHTML=markup();
  const grp=root.querySelector('#os-demo-group'),pat=root.querySelector('#os-demo-pattern');
  grp.value=group;pat.value=String(pattern);
  if(focused!==undefined)root.querySelector('[data-step="'+focused+'"]')?.focus();
 }
 function stop(){playing=false;step=-1;if(timer){clearInterval(timer);timer=null;}}
 function mount(element){
  root=element;update();
  root.addEventListener('click',event=>{
   const hit=event.target.closest('[data-track][data-step]');
   if(hit){
    const row=Number(hit.dataset.track),col=Number(hit.dataset.step);
    getSteps()[row][col]=!getSteps()[row][col];
    hit.classList.toggle('on',getSteps()[row][col]);
    hit.setAttribute('aria-pressed',String(getSteps()[row][col]));
    return;
   }
   if(event.target.closest('#os-seq-play')){
    if(playing){stop();update();return;}
    playing=true;step=-1;update();
    timer=setInterval(()=>{
     step=(step+1)%16;
     root?.querySelectorAll('.os-step').forEach(node=>
       node.classList.toggle('playhead',Number(node.dataset.step)===step)
     );
    },60000/93/4);
   }
   if(event.target.closest('#os-seq-clear')){store.set(key(),DEMO_TRACKS.map(()=>Array(16).fill(false)));update();}
  });
  root.addEventListener('change',event=>{
   if(event.target.id==='os-demo-group'){stop();group=event.target.value;update();}
   if(event.target.id==='os-demo-pattern'){stop();pattern=Number(event.target.value);update();}
  });
 }
 function dispose(){stop();root=null;}
 return Object.freeze({mount,dispose,getPattern:()=>getSteps()});
}
