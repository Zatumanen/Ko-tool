export function createFileScheduler({withLock=operation=>operation()}={}){
  let queue=Promise.resolve();
  let active=null;
  let pending=0;
  let nextId=1;

  const run=(label,operation)=>{
    if(typeof label==='function'){operation=label;label='FILE operation';}
    if(typeof operation!=='function')throw new TypeError('FILE scheduler requires an operation.');
    const ticket={id:nextId++,label:String(label||'FILE operation')};
    pending+=1;
    const task=queue.then(async()=>{
      pending-=1;
      active=ticket;
      try{return await withLock(operation);}
      finally{if(active===ticket)active=null;}
    });
    queue=task.catch(()=>{});
    return task;
  };

  const reset=()=>{
    if(active||pending)throw new Error('Cannot reset FILE scheduler while work is active or queued.');
    queue=Promise.resolve();
  };

  const getState=()=>({
    active:active?{...active}:null,
    pending
  });

  return{run,reset,getState};
}
