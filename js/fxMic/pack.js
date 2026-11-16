import{readZip}from '../archive/zipReader.js';
import{createZip}from '../zip.js';
import{assertConfig,defaultConfig,safeFilename}from './config.js';
import{inspectWav}from './wav.js';
import{STOCK_PROFILE}from './profile.js';

const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export const configText=config=>JSON.stringify(config,null,2)+'\n';
const copy=pack=>({config:structuredClone(pack.config),files:new Map([...pack.files].map(([k,v])=>[k,v.slice()]))});
export function validatePack(pack){
  assertConfig(pack.config);
  if(!(pack.files instanceof Map)||pack.files.size>4)throw Error('Pack: at most four WAV files');
  let bytes=encoder.encode(configText(pack.config)).length;const names=new Set();
  const samples=[];
  for(const [name,data]of pack.files){
    if(!safeFilename(name)||names.has(name.toLowerCase()))throw Error('Pack: unsafe or case-colliding WAV filename');
    names.add(name.toLowerCase());const info=inspectWav(data);bytes+=info.bytes;samples.push({name,...info});
  }
  for(const sample of pack.config.samples||[])if(!pack.files.has(sample.file))throw Error('Pack: missing WAV '+sample.file);
  if(bytes>STOCK_PROFILE.budgetBytes)throw Error(`Pack: ${bytes} bytes exceeds conservative ${STOCK_PROFILE.budgetBytes} byte budget`);
  return{bytes,samples,nearLimit:bytes>STOCK_PROFILE.warningBytes};
}
export async function readPack(input){
  const entries=await readZip(input,{checkPath:name=>{
    if(name!=='config.json'&&!safeFilename(name))throw Error('Pack: unsupported ZIP path '+name);return name;
  },limits:{zipMax:1100000,expandedMax:1000000,fileMax:1000000,entryMax:5,maxRatio:1000000}});
  if(!entries.has('config.json'))throw Error('Pack: config.json missing');
  const config=JSON.parse(decoder.decode(entries.get('config.json')));entries.delete('config.json');
  const pack={config,files:entries};validatePack(pack);return pack;
}
export async function writePack(pack){
  validatePack(pack);return createZip([{path:'config.json',blob:new Blob([configText(pack.config)])},...[...pack.files].map(([path,bytes])=>({path,blob:new Blob([bytes])}))]);
}
export function createPackStore(initial={config:defaultConfig(),files:new Map()}){
  validatePack(initial);let current=copy(initial),revision=0;
  const commit=(next,expected=revision)=>{
    if(expected!==revision)throw Error('Working pack changed while import was pending; retry explicitly');
    validatePack(next);current=copy(next);revision++;return copy(current);
  };
  return{
    snapshot:()=>copy(current),get revision(){return revision;},
    replace:(next,expected)=>commit(next,expected),
    editConfig:edit=>{const next=copy(current);edit(next.config);return commit(next);},
    importConfig:async text=>commit({config:JSON.parse(text),files:current.files}),
    importZip:async(input,isActive=()=>true)=>{
      const expected=revision,next=await readPack(await input);
      if(!isActive())throw Error('Pack import cancelled');
      return commit(next,expected);
    }
  };
}
