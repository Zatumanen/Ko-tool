const DB_NAME='speeduppercut-project-recovery';
const DB_VERSION=1;
const STORE_NAME='checkpoints';
const MAX_VERIFIED_CHECKPOINTS=8;

const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const cloneBytes=value=>bytes(value).slice();

const crcTable=(()=>{
  const table=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
    table[n]=c>>>0;
  }
  return table;
})();

export function crc32Hex(value){
  const data=bytes(value);
  let crc=0xffffffff;
  for(const byte of data)crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
  return ((crc^0xffffffff)>>>0).toString(16).padStart(8,'0');
}

export function hashDeviceIdentity({sku='',metadata={}}={}){
  const serial=String(metadata?.serialNumber||metadata?.serial||'');
  const input=String(sku||'').toUpperCase()+'|'+serial;
  let hash=0x811c9dc5;
  for(let index=0;index<input.length;index++){
    hash^=input.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}

const safeTimestamp=value=>{
  const time=value instanceof Date?value:new Date(value||Date.now());
  return Number.isFinite(time.getTime())?time.toISOString():new Date().toISOString();
};

export function createProjectRecoveryCheckpoint({
  device,projectNumber,destinationFid,parentFid,
  backup,candidate,activation=null,operation='project-write',createdAt=new Date()
}={}){
  const project=String(projectNumber||'').padStart(2,'0');
  if(!/^\d{2}$/.test(project))throw new Error('Project recovery checkpoint requires a two-digit project number.');
  const original=cloneBytes(backup?.data);
  if(!original.byteLength)throw new Error('Project recovery checkpoint requires the original project archive.');
  const proposed=cloneBytes(candidate);
  if(!proposed.byteLength)throw new Error('Project recovery checkpoint requires the candidate project archive.');
  const sku=String(device?.sku||'').toUpperCase();
  const firmware=String(device?.metadata?.os_version||device?.metadata?.sw_version||'');
  const deviceIdentityHash=hashDeviceIdentity(device);
  const timestamp=safeTimestamp(createdAt);
  const originalCrc32=crc32Hex(original);
  const candidateCrc32=crc32Hex(proposed);
  const id=['project-write',deviceIdentityHash,project,timestamp,candidateCrc32].join(':');
  return Object.freeze({
    id,
    status:'pending',
    operation:String(operation||'project-write'),
    createdAt:timestamp,
    updatedAt:timestamp,
    device:Object.freeze({sku,firmware,identityHash:deviceIdentityHash}),
    project:Object.freeze({
      number:project,
      destinationFid:Number(destinationFid)||null,
      parentFid:Number(parentFid)||null
    }),
    activation:activation?Object.freeze({...activation}):null,
    original:Object.freeze({
      name:String(backup?.name||'P'+project+'.tar'),
      size:original.byteLength,
      crc32:originalCrc32,
      data:original
    }),
    candidate:Object.freeze({
      size:proposed.byteLength,
      crc32:candidateCrc32
    })
  });
}

const cloneCheckpoint=checkpoint=>checkpoint?{
  ...checkpoint,
  device:{...(checkpoint.device||{})},
  project:{...(checkpoint.project||{})},
  activation:checkpoint.activation?{...checkpoint.activation}:null,
  original:{
    ...(checkpoint.original||{}),
    data:cloneBytes(checkpoint.original?.data)
  },
  candidate:{...(checkpoint.candidate||{})}
}:null;

const makeUnavailableStore=()=>Object.freeze({
  persistent:false,
  async saveCheckpoint(){throw new Error('Persistent project recovery storage is unavailable in this browser.');},
  async updateCheckpoint(){throw new Error('Persistent project recovery storage is unavailable in this browser.');},
  async getCheckpoint(){return null;},
  async listCheckpoints(){return[];},
  async deleteCheckpoint(){return false;}
});

const transactionDone=transaction=>new Promise((resolve,reject)=>{
  transaction.addEventListener('complete',()=>resolve(),{once:true});
  transaction.addEventListener('abort',()=>reject(transaction.error||new Error('IndexedDB transaction aborted.')),{once:true});
  transaction.addEventListener('error',()=>reject(transaction.error||new Error('IndexedDB transaction failed.')),{once:true});
});

export function createBrowserProjectRecoveryStore({
  indexedDBRef=globalThis.indexedDB,
  dbName=DB_NAME,
  maxVerified=MAX_VERIFIED_CHECKPOINTS
}={}){
  if(!indexedDBRef?.open)return makeUnavailableStore();
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
        }
      });
      request.addEventListener('success',()=>resolve(request.result),{once:true});
      request.addEventListener('error',()=>reject(request.error||new Error('Could not open project recovery database.')),{once:true});
      request.addEventListener('blocked',()=>reject(new Error('Project recovery database upgrade is blocked.')),{once:true});
    }).catch(error=>{dbPromise=null;throw error;});
    return dbPromise;
  };

  const put=async checkpoint=>{
    const db=await openDb();
    const tx=db.transaction(STORE_NAME,'readwrite');
    tx.objectStore(STORE_NAME).put(cloneCheckpoint(checkpoint));
    await transactionDone(tx);
    return cloneCheckpoint(checkpoint);
  };

  const get=async id=>{
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readonly');
      const request=tx.objectStore(STORE_NAME).get(String(id||''));
      request.addEventListener('success',()=>resolve(cloneCheckpoint(request.result||null)),{once:true});
      request.addEventListener('error',()=>reject(request.error||new Error('Could not read project recovery checkpoint.')),{once:true});
    });
  };

  const list=async()=>{
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readonly');
      const request=tx.objectStore(STORE_NAME).getAll();
      request.addEventListener('success',()=>{
        const records=(request.result||[]).map(cloneCheckpoint);
        records.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
        resolve(records);
      },{once:true});
      request.addEventListener('error',()=>reject(request.error||new Error('Could not list project recovery checkpoints.')),{once:true});
    });
  };

  const remove=async id=>{
    const db=await openDb();
    const tx=db.transaction(STORE_NAME,'readwrite');
    tx.objectStore(STORE_NAME).delete(String(id||''));
    await transactionDone(tx);
    return true;
  };

  const pruneVerified=async()=>{
    const records=(await list()).filter(item=>item.status==='verified');
    for(const record of records.slice(Math.max(0,Number(maxVerified)||0)))await remove(record.id);
  };

  return Object.freeze({
    persistent:true,
    async saveCheckpoint(checkpoint){
      const saved=await put({...cloneCheckpoint(checkpoint),status:'pending'});
      return saved;
    },
    async updateCheckpoint(id,patch={}){
      const current=await get(id);
      if(!current)throw new Error('Project recovery checkpoint was not found: '+String(id||''));
      const next={
        ...current,
        ...patch,
        id:current.id,
        device:current.device,
        project:current.project,
        activation:current.activation,
        original:current.original,
        candidate:current.candidate,
        updatedAt:safeTimestamp(patch.updatedAt||new Date())
      };
      const saved=await put(next);
      if(saved.status==='verified')await pruneVerified();
      return saved;
    },
    getCheckpoint:get,
    listCheckpoints:list,
    deleteCheckpoint:remove
  });
}

export function createMemoryProjectRecoveryStore(){
  const records=new Map();
  return Object.freeze({
    persistent:false,
    async saveCheckpoint(checkpoint){
      const saved={...cloneCheckpoint(checkpoint),status:'pending'};
      records.set(saved.id,saved);
      return cloneCheckpoint(saved);
    },
    async updateCheckpoint(id,patch={}){
      const current=records.get(String(id||''));
      if(!current)throw new Error('Project recovery checkpoint was not found: '+String(id||''));
      const next={...current,...patch,id:current.id,updatedAt:safeTimestamp(patch.updatedAt||new Date())};
      records.set(current.id,next);
      return cloneCheckpoint(next);
    },
    async getCheckpoint(id){return cloneCheckpoint(records.get(String(id||''))||null);},
    async listCheckpoints(){
      return[...records.values()].map(cloneCheckpoint).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    },
    async deleteCheckpoint(id){return records.delete(String(id||''));}
  });
}
