/**
 * Converter exports retain the entire source basename, including leading
 * 001–999 labels. Prefix removal is exclusive to the My EP upload path.
 */
export function outputFileName(name){
 const base=String(name||'output.wav').replace(/\.[^.]+$/,'');
 return base+'_x2.wav';
}

/** Keep every ZIP entry when different source filenames resolve to the same output path. */
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
