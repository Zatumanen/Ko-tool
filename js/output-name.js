/**
 * A three-digit slot number followed by whitespace is a filename label,
 * not part of the exported sample name. Preserve the rest verbatim.
 * Other files keep the longstanding _x2 suffix.
 */
export function outputFileName(name){
 const base=String(name||'output.wav').replace(/\.[^.]+$/,'');
 const numbered=base.match(/^(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})[ \t]+(\S.*)$/);
 return (numbered?numbered[1]:base+'_x2')+'.wav';
}

/** Avoid losing one file when stripping different indices creates duplicate ZIP paths. */
export function uniqueOutputPath(path,usedPaths){
 let candidate=String(path),copy=2;
 const key=value=>value.toLocaleLowerCase('en-US');
 const slash=candidate.lastIndexOf('/');
 const folder=candidate.slice(0,slash+1);
 const filename=candidate.slice(slash+1);
 const extension=filename.lastIndexOf('.');
 const stem=extension>0?filename.slice(0,extension):filename;
 const suffix=extension>0?filename.slice(extension):'';
 while(usedPaths.has(key(candidate))){
  candidate=folder+stem+' ('+copy+')'+suffix;
  copy+=1;
 }
 usedPaths.add(key(candidate));
 return candidate;
}
