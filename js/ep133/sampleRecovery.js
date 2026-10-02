import{hashDeviceIdentity}from './projectRecovery.js?v=20261001-1';

const DB_NAME='speeduppercut-sample-recovery';
const DB_VERSION=1;
const STORE_NAME='transactions';
const MAX_RESOLVED_TRANSACTIONS=32;
const RESOLVED_STATUSES=new Set(['succeeded','failed','rolled-back']);

const safeTimestamp=value=>{
  const time=value instanceof Date?value:new Date(value||Date.now());
  return Number.isFinite(time.getTime())?time.toISOString():new Date().toISOString();
};

const sanitizeValue=(value,depth=0)=>{
  if(depth>4)return'[truncated]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.slice(0,500);
  if(value instanceof Uint8Array||value instanceof ArrayBuffer)return'[binary omitted]';
  if(Array.isArray(value))return value.slice(0,64).map(item=>sanitizeValue(item,depth+1));
  if(typeof value==='object'){
    const out={};
    for(const[key,item]of Object.entries(value)){
      if(/^(data|bytes|pcm|audio|serial|serialNumber)$/i.test(key))continue;
      out[key]=sanitizeValue(item,depth+1);
    }
    return out;
  }
  return String(value).slice(0,500);
};

const normalizeSlot=slot=>{
  if(slot==null)return null;
  if(typeof slot==='number'||typeof slot==='string'){
    const id=Number(slot);
    return Number.isInteger(id)&&id>0?{slotId:id}:null;
  }
  if(typeof slot!=='object')return null;
  const out={};
  for(const key of ['slotId','sourceId','targetId','nodeId']){
    const value=Number(slot[key]);
    if(Number.isInteger(value)&&value>0)out[key]=value;
  }
  if(slot.name!=null)out.name=String(slot.name).slice(0,200);
  if(Number.isFinite(Number(slot.size))&&Number(slot.size)>=0)out.size=Number(slot.size);
  if(slot.crc!=null&&Number.isFinite(Number(slot.crc)))out.crc=Number(slot.crc);
  return Object.keys(out).length?out:null;
};

export function createSampleRecoveryTransaction({
  device,operation,label='',slots=[],detail=null,createdAt=new Date()
}={}){
  const normalizedOperation=String(operation||'').trim().toLowerCase();
  if(!normalizedOperation)throw new Error('Sample recovery transaction requires an operation.');
  const sku=String(device?.sku||'').toUpperCase();
  const firmware=String(device?.metadata?.os_version||device?.metadata?.sw_version||'');
  const identityHash=hashDeviceIdentity(device||{});
  const timestamp=safeTimestamp(createdAt);
  const normalizedSlots=(Array.isArray(slots)?slots:[]).map(normalizeSlot).filter(Boolean);
  const id=['sample-transaction',identityHash,normalizedOperation,timestamp].join(':');
  return Object.freeze({
    id,
    status:'pending',
    transactionStatus:'pending',
    operation:normalizedOperation,
    label:String(label||normalizedOperation).slice(0,200),
    createdAt:timestamp,
    updatedAt:timestamp,
    device:Object.freeze({sku,firmware,identityHash}),
    slots:Object.freeze(normalizedSlots.map(slot=>Object.freeze({...slot}))),
    detail:detail==null?null:sanitizeValue(detail),
    currentPhase:null,
    lastSuccessfulPhase:null,
    failurePhase:null,
    recoveryDetail:null,
    journal:Object.freeze([])
  });
}

const cloneTransaction=transaction=>transaction?{
  ...transaction,
  device:{...(transaction.device||{})},
  slots:Array.isArray(transaction.slots)?transaction.slots.map(slot=>({...slot})):[],
  detail:transaction.detail&&typeof transaction.detail==='object'
    ?JSON.parse(JSON.stringify(transaction.detail)):transaction.detail??null,
  recoveryDetail:transaction.recoveryDetail&&typeof transaction.recoveryDetail==='object'
    ?JSON.parse(JSON.stringify(transaction.recoveryDetail)):transaction.recoveryDetail??null,
  journal:Array.isArray(transaction.journal)
    ?transaction.journal.map(event=>({
      ...event,
      detail:event?.detail&&typeof event.detail==='object'
        ?JSON.parse(JSON.stringify(event.detail)):event?.detail??null
    }))
    :[]
}:null;

const createRecordStore=({persistent=false}={})=>{
  const records=new Map();
  const api={
    persistent,
    async saveTransaction(transaction){
      const saved={...cloneTransaction(transaction),status:'pending',transactionStatus:'pending'};
      records.set(saved.id,saved);
      return cloneTransaction(saved);
    },
    async updateTransaction(id,patch={}){
      const key=String(id||'');
      const current=records.get(key);
      if(!current)throw new Error('Sample recovery transaction was not found: '+key);
      const next={
        ...current,...cloneTransaction({...current,...patch}),
        id:current.id,device:current.device,slots:current.slots,
        updatedAt:safeTimestamp(patch.updatedAt||new Date())
      };
      records.set(key,next);
      return cloneTransaction(next);
    },
    async getTransaction(id){return cloneTransaction(records.get(String(id||''))||null);},
    async listTransactions(){
      return[...records.values()].map(cloneTransaction)
        .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    },
    async deleteTransaction(id){return records.delete(String(id||''));}
  };
  return Object.freeze(api);
};

export function createMemorySampleRecoveryStore(){return createRecordStore({persistent:false});}

const transactionDone=transaction=>new Promise((resolve,reject)=>{
  transaction.addEventListener('complete',()=>resolve(),{once:true});
  transaction.addEventListener('abort',()=>reject(transaction.error||new Error('IndexedDB transaction aborted.')),{once:true});
  transaction.addEventListener('error',()=>reject(transaction.error||new Error('IndexedDB transaction failed.')),{once:true});
});

export function createBrowserSampleRecoveryStore({
  indexedDBRef=globalThis.indexedDB,
  dbName=DB_NAME,
  maxResolved=MAX_RESOLVED_TRANSACTIONS
}={}){
  if(!indexedDBRef?.open)return createMemorySampleRecoveryStore();
  let dbPromise=null;
  const openDb=()=>{
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDBRef.open(dbName,DB_VERSION);
      request.addEventListener('upgradeneeded',()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE_NAME)){
          const store=db.createObjectStore(STORE_NAME,{keyPath:'id'});
          store.createIndex('status','status',{unique:false});
          store.createIndex('updatedAt','updatedAt',{unique:false});
          store.createIndex('deviceIdentity','device.identityHash',{unique:false});
        }
      });
      request.addEventListener('success',()=>resolve(request.result),{once:true});
      request.addEventListener('error',()=>reject(request.error||new Error('Could not open sample recovery database.')),{once:true});
      request.addEventListener('blocked',()=>reject(new Error('Sample recovery database upgrade is blocked.')),{once:true});
    }).catch(error=>{dbPromise=null;throw error;});
    return dbPromise;
  };

  const put=async transaction=>{
    const db=await openDb();
    const tx=db.transaction(STORE_NAME,'readwrite');
    tx.objectStore(STORE_NAME).put(cloneTransaction(transaction));
    await transactionDone(tx);
    return cloneTransaction(transaction);
  };

  const get=async id=>{
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const request=db.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).get(String(id||''));
      request.addEventListener('success',()=>resolve(cloneTransaction(request.result||null)),{once:true});
      request.addEventListener('error',()=>reject(request.error||new Error('Could not read sample recovery transaction.')),{once:true});
    });
  };

  const list=async()=>{
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const request=db.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).getAll();
      request.addEventListener('success',()=>{
        const result=(request.result||[]).map(cloneTransaction)
          .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
        resolve(result);
      },{once:true});
      request.addEventListener('error',()=>reject(request.error||new Error('Could not list sample recovery transactions.')),{once:true});
    });
  };

  const remove=async id=>{
    const db=await openDb();
    const tx=db.transaction(STORE_NAME,'readwrite');
    tx.objectStore(STORE_NAME).delete(String(id||''));
    await transactionDone(tx);
    return true;
  };

  const pruneResolved=async()=>{
    const resolved=(await list()).filter(item=>RESOLVED_STATUSES.has(item.status));
    const keep=Math.max(0,Number(maxResolved)||0);
    for(const item of resolved.slice(keep))await remove(item.id);
  };

  return Object.freeze({
    persistent:true,
    async saveTransaction(transaction){return put({...cloneTransaction(transaction),status:'pending',transactionStatus:'pending'});},
    async updateTransaction(id,patch={}){
      const current=await get(id);
      if(!current)throw new Error('Sample recovery transaction was not found: '+String(id||''));
      const next={
        ...current,...patch,
        id:current.id,device:current.device,slots:current.slots,
        updatedAt:safeTimestamp(patch.updatedAt||new Date())
      };
      const saved=await put(next);
      if(RESOLVED_STATUSES.has(saved.status))await pruneResolved();
      return saved;
    },
    getTransaction:get,
    listTransactions:list,
    deleteTransaction:remove
  });
}
