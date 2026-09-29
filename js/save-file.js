export function pickerTypesForFile(name,mimeType=''){
  const fileName=String(name||'').toLowerCase();
  const type=String(mimeType||'').toLowerCase();
  if(fileName.endsWith('.zip')||type==='application/zip')return[{description:'ZIP archive',accept:{'application/zip':['.zip']}}];
  return[{description:'WAV audio',accept:{'audio/wav':['.wav']}}];
}
