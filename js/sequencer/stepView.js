import{buildStepPage}from './saved.js';
import{summarizeProjectReadOnly}from '../ep133/ui/projectReadOnlyController.js?v=20261001-1';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=value=>value==null?'—':escapeHtml(value);
export function renderSavedSteps(result,{group='a',patternId='',page=0}={}){
 const model=result.model,summary=summarizeProjectReadOnly(result);
 const patterns=model.patterns.filter(p=>p.group===group);
 const id=patterns.some(p=>p.id===patternId)?patternId:patterns[0]?.id||'';
 const view=buildStepPage(model,group,id,page);
 const notes=view.notes;
 const rows=Array.from({length:12},(_,i)=>{
  const pad=i+1,record=model.pads?.[group]?.find(p=>p.pad===pad);
  return`<tr><th scope="row">${group.toUpperCase()}${pad} · ${record?.sampleSlot?'S'+field(record.sampleSlot):'sample —'}</th>${Array.from({length:16},(_,step)=>{
   const events=notes.filter(n=>n.pad===pad&&n.step===step);
   return`<td data-step="${step+1}" data-pad="${pad}"${events.length?' class="has-notes"':''}>${events.length?events.map(n=>`<span title="Tick ${n.tick}; note ${n.note}; velocity ${n.velocity}; duration ${n.duration}; offset ${n.offset}">●${n.offset?' +'+n.offset:''}</span>`).join(' '):'·'}</td>`;
  }).join('')}</tr>`;
 }).join('');
 return`<p>Saved archive · P${field(result.project)}${result.active?' · ACTIVE':''} · BPM ${field(summary.bpm)} · ${field(summary.sku)} ${field(summary.firmware)}</p>
 <label>Group <select data-saved-group aria-label="Sequencer group">${['a','b','c','d'].map(g=>`<option value="${g}" ${g===group?'selected':''}>${g.toUpperCase()}</option>`).join('')}</select></label>
 <label>Pattern <select data-saved-pattern aria-label="Sequencer pattern">${patterns.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===id?'selected':''}>${escapeHtml(p.id)}</option>`).join('')||'<option value="">No pattern</option>'}</select></label>
 <label>16-step page <select data-saved-page aria-label="Sequencer page">${Array.from({length:view.pages},(_,i)=>`<option value="${i}" ${i===view.page?'selected':''}>${i+1}</option>`).join('')}</select></label>
 <p>Ticks ${view.start}–${view.start+383} · 24 ticks/step · +offset marks off-grid starts. Duration is in raw ticks.</p>
 ${!view.pattern?'<p>No saved pattern in this group.</p>':''}
 <div class="sequencer-grid"><table aria-label="Saved step grid"><thead><tr><th>Pad / sample</th>${Array.from({length:16},(_,i)=>`<th scope="col">${i+1}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
 <table aria-label="Saved note details"><thead><tr>${['Pad','Tick','Step','Offset','Note','Velocity','Duration (ticks)'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${notes.map(n=>`<tr>${[n.pad,n.tick,n.step+1,n.offset,n.note,n.velocity,n.duration].map(v=>`<td>${field(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
 <p>${notes.length} note(s) on this page · ${view.automation.length} automation record(s) · ${view.unknown.length} unknown record(s).</p>
 ${view.unknown.length?'<p>Unknown records (not interpreted as notes): '+view.unknown.map(r=>`tick ${field(r.tick)}, type ${field(r.recordType)}`).join('; ')+'</p>':''}
 <p>Missing pattern references: ${escapeHtml(JSON.stringify(summary.missingPatternReferences))}. Missing samples: ${escapeHtml(JSON.stringify(result.dependencies?.missingSampleSlots||[]))}. Unknown archive members: ${summary.unknownMembers}.</p>
 <p>Unavailable fields use —. Unknown flags, pad layouts and automation are preserved, not edited. READ ONLY.</p>`;
}
