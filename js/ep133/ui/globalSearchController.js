const scalar=value=>value==null?'':String(value).trim().toLowerCase();

const pushMetadata=(value,out,depth=0)=>{
  if(value==null||depth>4)return;
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean'){
    const text=scalar(value);
    if(text)out.push(text);
    return;
  }
  if(ArrayBuffer.isView(value))return;
  if(Array.isArray(value)){
    for(const item of value.slice(0,64))pushMetadata(item,out,depth+1);
    return;
  }
  if(typeof value==='object'){
    for(const[key,item]of Object.entries(value).slice(0,128)){
      const normalizedKey=scalar(key);
      if(normalizedKey)out.push(normalizedKey);
      pushMetadata(item,out,depth+1);
    }
  }
};

export function normalizeSampleSearchQuery(value=''){
  return scalar(value).replace(/\s+/g,' ');
}

export function buildSampleSearchText(slot){
  if(!slot)return'';
  const parts=[];
  const id=Number(slot.id);
  if(Number.isInteger(id)&&id>0){
    parts.push(String(id),String(id).padStart(3,'0'),'slot '+String(id),'slot '+String(id).padStart(3,'0'));
  }
  const displayName=scalar(slot?.meta?.name||slot?.file?.name);
  const fileName=scalar(slot?.file?.name);
  const path=scalar(slot?.file?.path);
  if(displayName)parts.push(displayName);
  if(fileName&&fileName!==displayName)parts.push(fileName);
  if(path)parts.push(path);
  const channels=Number(slot?.meta?.channels);
  if(channels===1)parts.push('mono');
  if(channels===2)parts.push('stereo');
  pushMetadata(slot?.meta,parts);
  return parts.join(' ');
}

export function matchesSampleSearch(slot,query){
  const normalized=normalizeSampleSearchQuery(query);
  if(!normalized)return false;
  const haystack=buildSampleSearchText(slot);
  return normalized.split(' ').every(term=>haystack.includes(term));
}

export function filterSampleSearchResults(slots,query){
  const normalized=normalizeSampleSearchQuery(query);
  if(!normalized)return[];
  return (slots||[]).filter(slot=>matchesSampleSearch(slot,normalized));
}

export function formatSampleSearchCount(count){
  const value=Math.max(0,Number(count)||0);
  return value+' '+(value===1?'MATCH':'MATCHES');
}
