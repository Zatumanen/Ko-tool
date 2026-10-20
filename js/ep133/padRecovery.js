// This journal never interprets pad wire FIDs as /sounds library slots.
const DB_NAME='ko-tool-pad-recovery',STORE_NAME='transactions';
const RESOLVED=new Set(['verified','acknowledged','aborted']);
const STATUSES=new Set(['pending','requires-recovery',...RESOLVED]);
const PHASES=new Set(['PRECHECK','MUTATE','VERIFY']);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value||{},key)).map(key=>[key,clone(value[key])]));
const recordCopy=record=>record?{
  ...pick(record,['id','before','desired','status','phase','verification','createdAt','updatedAt','restoresRecordId']),
  device:pick(record.device,['identityHash','sku','firmware']),
  target:pick(record.target,['project','group','pad','projectFid','groupFid','padFid','sampleSlot'])
}:null;
export const isUnresolvedPadRecord=record=>record?.status==='requires-recovery'||
  (!RESOLVED.has(record?.status)&&['MUTATE','VERIFY'].includes(record?.phase));

const done=tx=>new Promise((resolve,reject)=>{
  tx.addEventListener('complete',resolve,{once:true});
  tx.addEventListener('abort',()=>reject(new Error('Pad recovery storage transaction aborted.')),{once:true});
  tx.addEventListener('error',()=>reject(new Error('Pad recovery storage transaction failed.')),{once:true});
});
const unavailable=()=>{throw new Error('Persistent pad recovery storage is unavailable.');};

export function createPadRecoveryStore({indexedDBRef=globalThis.indexedDB}={}){
  if(!indexedDBRef?.open)return Object.freeze({persistent:false,save:async()=>unavailable(),update:async()=>unavailable(),
    get:async()=>null,list:async()=>[],delete:async()=>false});
  let dbPromise;
  const open=()=>dbPromise||(dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDBRef.open(DB_NAME,1);
    request.addEventListener('upgradeneeded',()=>{
      if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:'id'});
    });
    request.addEventListener('success',()=>resolve(request.result),{once:true});
    request.addEventListener('error',()=>reject(new Error('Could not open pad recovery database.')),{once:true});
    request.addEventListener('blocked',()=>reject(new Error('Pad recovery database upgrade is blocked.')),{once:true});
  }).catch(error=>{dbPromise=null;throw error;}));
  const read=async(method,key)=>{
    const db=await open(),tx=db.transaction(STORE_NAME,'readonly');
    const completion=done(tx),request=tx.objectStore(STORE_NAME)[method](key);
    let result;
    request.addEventListener('success',()=>{result=clone(request.result);},{once:true});
    await completion;
    return result;
  };
  const get=async id=>recordCopy(await read('get',String(id))||null);
  const list=async()=>(await read('getAll')||[]).map(recordCopy)
    .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  const write=async(method,value)=>{
    const db=await open(),tx=db.transaction(STORE_NAME,'readwrite');
    const completion=done(tx);
    tx.objectStore(STORE_NAME)[method](value);
    await completion;
  };
  const put=async record=>{
    if(!record?.id||!record.device?.identityHash)throw new Error('Pad recovery requires an id and stable physical identity.');
    if(!STATUSES.has(record.status)||!PHASES.has(record.phase))throw new Error('Invalid pad recovery status or phase.');
    const copied=recordCopy(record);await write('put',copied);return recordCopy(copied);
  };
  const prune=async()=>{
    const history=(await list()).filter(record=>RESOLVED.has(record.status));
    for(const record of history.slice(8))await write('delete',record.id);
  };
  return Object.freeze({persistent:true,
    save:record=>put({...record,createdAt:record.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}),
    async update(id,patch={}){
      const current=await get(id);
      if(!current)throw new Error('Pad recovery record was not found.');
      const next=await put({...current,...pick(patch,['status','phase','verification']),updatedAt:new Date().toISOString()});
      if(RESOLVED.has(next.status))await prune();
      return next;
    },get,list,
    async delete(id){
      const current=await get(id);if(!current)return false;
      if(!RESOLVED.has(current.status))throw new Error('Cannot delete unresolved pad recovery.');
      await write('delete',current.id);return true;
    }
  });
}
