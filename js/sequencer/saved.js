// Projection only: preserve native ticks/values and never round source events.
export function buildStepPage(model,group,patternId,page=0){
 const pattern=model?.patterns?.find(p=>p.group===group&&p.id===patternId);
 const records=pattern?.records||[];
 const max=records.reduce((n,r)=>Math.max(n,r.tick),0);
 const pages=Math.max(1,Number(pattern?.bars)||1,Math.floor(max/384)+1);
 const index=Math.max(0,Math.min(pages-1,Number(page)||0)),start=index*384;
 const visible=records.filter(r=>r.tick>=start&&r.tick<start+384);
 return{pattern,pages,page:index,start,
  notes:visible.filter(r=>r.kind==='note').map(r=>({...r,step:Math.floor((r.tick-start)/24),offset:r.tick%24})),
  unknown:visible.filter(r=>r.kind==='unknown'),automation:visible.filter(r=>r.kind==='automation')};
}

// The filesystem facade owns FILE leases. Generation/session guards own UI results.
export function createSavedSequencer({getSession,canRead,list,read,onChange=()=>{}}){
 let session=getSession(),generation=0;
 let state={projects:[],selected:'',result:null,busy:false,message:'SELECT PROJECT · READ ONLY',readAt:null};
 const publish=patch=>{state={...state,...patch};onChange(state);};
 const invalidate=message=>{generation++;publish({projects:[],selected:'',result:null,readAt:null,message});};
 const sync=()=>{const next=getSession();if(next!==session){session=next;invalidate('REFRESH NEEDED · SESSION CHANGED');}};
 const select=selected=>{generation++;publish({selected,result:null,readAt:null,message:'READ PROJECT · READ ONLY'});};
 const run=async(kind)=>{
  sync();
  if(!session||!canRead()||state.busy)return;
  const id=state.selected;
  if(kind==='read'&&!id)return;
  const token=++generation,captured=session;
  publish({busy:true,result:null,readAt:null,message:'READING SAVED PROJECT…'});
  try{
   const value=await(kind==='list'?list():read(id));
   sync();
   if(token!==generation||captured!==getSession())return;
   if(kind==='list')publish({projects:value.projects,selected:value.projects.some(p=>p.project===id)?id:'',message:'SELECT PROJECT · READ ONLY'});
   else publish({result:value,readAt:Date.now(),message:'SAVED PROJECT P'+id+' · READ ONLY'});
  }catch{
   sync();if(token===generation)publish({result:null,message:'READ FAILED · REFRESH NEEDED'});
  }finally{publish({busy:false});}
 };
 return{getState:()=>state,sync,select,loadList:()=>run('list'),refresh:()=>run('read'),
  invalidate:()=>invalidate('REFRESH NEEDED · DEVICE STATE CHANGED'),
  close:()=>invalidate('REFRESH NEEDED · WINDOW CLOSED')};
}
