// Pixel projection of the same native records used by Step; never changes source events.
export function buildPianoPage(page,{pad='all',zoom=1}={}){
 const scale=2*Math.max(.5,Math.min(4,Number(zoom)||1));
 const records=(page.pattern?.records||[]).filter(r=>r.kind==='note'&&(pad==='all'||r.pad===Number(pad)));
 const visible=records.filter(r=>r.tick<page.start+384&&r.tick+Math.max(1,r.duration)>page.start);
 const valid=visible.filter(r=>Number.isInteger(r.note)&&r.note>=0&&r.note<=127);
 const low=Math.max(0,valid.reduce((n,r)=>Math.min(n,r.note),48)-1);
 const high=Math.min(127,valid.reduce((n,r)=>Math.max(n,r.note),72)+1);
 return{scale,low,high,width:384*scale,invalidPitch:visible.length-valid.length,
  notes:valid.map(r=>({...r,
   left:(Math.max(page.start,r.tick)-page.start)*scale,
   width:Math.max(2,(Math.min(page.start+384,r.tick+r.duration)-Math.max(page.start,r.tick))*scale),
   top:(high-r.note)*20+24
  }))};
}
