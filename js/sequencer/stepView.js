import{buildStepPage}from './saved.js';
import{buildPianoPage}from './pianoRoll.js';
import{summarizeProjectReadOnly}from '../ep133/ui/projectReadOnlyController.js?v=20261001-1';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=value=>value==null?'—':escapeHtml(value);
export function renderSavedSteps(result,{group='a',patternId='',page=0,mode='step',pad='all',zoom=1,selectedNote=null}={}){
 const model=result.model,summary=summarizeProjectReadOnly(result);
 const patterns=model.patterns.filter(p=>p.group===group);
 const id=patterns.some(p=>p.id===patternId)?patternId:patterns[0]?.id||'';
 const view=buildStepPage(model,group,id,page);
 const notes=view.notes.filter(n=>pad==='all'||n.pad===Number(pad));
 const piano=buildPianoPage(view,{pad,zoom});
 const selected=view.pattern?.records?.find(r=>r.kind==='note'&&r.index===selectedNote);
 const selectNote=n=>`data-saved-note="${n.index}" aria-label="Select note ${n.index}" aria-pressed="${n.index===selectedNote}"`;
 const roll=`<div class="piano-roll-viewport" role="region" tabindex="0" aria-label="Piano Roll scroll area"><div class="piano-roll" role="group" aria-label="Saved Piano Roll" style="width:${piano.width+56}px;height:${(piano.high-piano.low+1)*20+24}px">
 <div class="piano-axis">${Array.from({length:16},(_,i)=>`<span class="piano-tick" style="left:${56+i*24*piano.scale}px">${view.start+i*24}</span>`).join('')}</div>
 ${Array.from({length:piano.high-piano.low+1},(_,i)=>{const pitch=piano.high-i;return`<div class="piano-lane" style="top:${24+i*20}px"><span class="piano-key ${[1,3,6,8,10].includes(pitch%12)?'black-key':''}">${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][pitch%12]}${Math.floor(pitch/12)-1} (${pitch})</span></div>`;}).join('')}
 ${piano.notes.map(n=>`<button type="button" class="piano-note" ${selectNote(n)} style="left:${56+n.left}px;top:${n.top}px;width:${n.width}px;--velocity:${n.velocity/127}" title="Pad ${n.pad}; tick ${n.tick}; note ${n.note}; velocity ${n.velocity}; duration ${n.duration}">${n.pad}</button>`).join('')}
 </div></div><p>${piano.invalidPitch} event(s) with unavailable MIDI pitch (raw data retained). Zero-duration events use a minimum-width marker.</p>`;
 const rows=Array.from({length:12},(_,i)=>{
  const pad=i+1,record=model.pads?.[group]?.find(p=>p.pad===pad);
  return`<tr><th scope="row">${group.toUpperCase()}${pad} · ${record?.sampleSlot?'S'+field(record.sampleSlot):'sample —'}</th>${Array.from({length:16},(_,step)=>{
   const events=notes.filter(n=>n.pad===pad&&n.step===step);
   return`<td data-step="${step+1}" data-pad="${pad}"${events.length?' class="has-notes"':''}>${events.length?events.map(n=>`<button type="button" ${selectNote(n)} title="Tick ${n.tick}; note ${n.note}; velocity ${n.velocity}; duration ${n.duration}; offset ${n.offset}">●${n.offset?' +'+n.offset:''}</button>`).join(' '):'·'}</td>`;
  }).join('')}</tr>`;
 }).join('');
 return`<p>Saved archive · P${field(result.project)}${result.active?' · ACTIVE':''} · BPM ${field(summary.bpm)} · ${field(summary.sku)} ${field(summary.firmware)}</p>
 <label>View <select data-saved-mode aria-label="Sequencer view"><option value="step" ${mode==='step'?'selected':''}>Step</option><option value="piano" ${mode==='piano'?'selected':''}>Piano Roll</option></select></label>
 <label>Group <select data-saved-group aria-label="Sequencer group">${['a','b','c','d'].map(g=>`<option value="${g}" ${g===group?'selected':''}>${g.toUpperCase()}</option>`).join('')}</select></label>
 <label>Pattern <select data-saved-pattern aria-label="Sequencer pattern">${patterns.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===id?'selected':''}>${escapeHtml(p.id)}</option>`).join('')||'<option value="">No pattern</option>'}</select></label>
 <label>16-step page <select data-saved-page aria-label="Sequencer page">${Array.from({length:view.pages},(_,i)=>`<option value="${i}" ${i===view.page?'selected':''}>${i+1}</option>`).join('')}</select></label>
 <label>Pad <select data-saved-pad aria-label="Sequencer pad"><option value="all">All pads</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${String(i+1)===pad?'selected':''}>${i+1}</option>`).join('')}</select></label>
 <label>Zoom <select data-saved-zoom aria-label="Piano Roll zoom">${[.5,1,2,4].map(z=>`<option value="${z}" ${z===zoom?'selected':''}>${z}×</option>`).join('')}</select></label>
 <p>Ticks ${view.start}–${view.start+383} · 24 ticks/step · +offset marks off-grid starts. Duration is in raw ticks.</p>
 ${!view.pattern?'<p>No saved pattern in this group.</p>':''}
 ${mode==='piano'?roll:`<div class="sequencer-grid"><table aria-label="Saved step grid"><thead><tr><th>Pad / sample</th>${Array.from({length:16},(_,i)=>`<th scope="col">${i+1}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`}
 <p data-saved-selection>${selected?`Selected note ${selected.index} · pad ${selected.pad} · tick ${selected.tick} · note ${selected.note} · velocity ${selected.velocity} · duration ${selected.duration} ticks`:'Select a note to inspect exact values.'}</p>
 <table aria-label="Saved note details"><thead><tr>${['Pad','Tick','Step','Offset','Note','Velocity','Duration (ticks)'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${notes.map(n=>`<tr>${[n.pad,n.tick,n.step+1,n.offset,n.note,n.velocity,n.duration].map(v=>`<td>${field(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
 <p>${notes.length} note start(s) on this page · ${view.automation.length} automation record(s) · ${view.unknown.length} unknown record(s).</p>
 ${view.unknown.length?'<p>Unknown records (not interpreted as notes): '+view.unknown.map(r=>`tick ${field(r.tick)}, type ${field(r.recordType)}`).join('; ')+'</p>':''}
 <p>Missing pattern references: ${escapeHtml(JSON.stringify(summary.missingPatternReferences))}. Missing samples: ${escapeHtml(JSON.stringify(result.dependencies?.missingSampleSlots||[]))}. Unknown archive members: ${summary.unknownMembers}.</p>
 <p>Unavailable fields use —. Unknown flags, pad layouts and automation are preserved, not edited. READ ONLY.</p>`;
}
