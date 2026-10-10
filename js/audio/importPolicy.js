/**
 * File-level import policy shared by the original converter and the OS.
 * Extensions are only candidates: the audio decoder remains authoritative.
 * macOS AppleDouble files ("._kick.wav") are resource-fork metadata, not audio.
 */
export const AUDIO_IMPORT_EXTENSIONS=Object.freeze([
 'wav','wave','mp3','aac','ogg','oga','flac','m4a','aif','aiff'
]);
const audioExtension=new RegExp('\\.('+AUDIO_IMPORT_EXTENSIONS.join('|')+')$','i');

export function isAudioImportCandidate(file){
 if(!file||typeof file.name!=='string'||!Number.isFinite(file.size)||file.size<=0)return false;
 const relative=String(file.webkitRelativePath||file.relativePath||file.name).replaceAll('\\','/');
 const parts=relative.split('/');
 if(parts.some(part=>part==='__MACOSX'||part.startsWith('._')))return false;
 return audioExtension.test(file.name);
}

export function selectAudioImportFiles(input){
 const files=Array.from(input||[]);
 const accepted=files.filter(isAudioImportCandidate);
 return Object.freeze({accepted,ignored:files.length-accepted.length,total:files.length});
}

export function describeAudioImportFailure(error,file){
 const raw=String(error?.message||error||'Unknown decoder failure').slice(0,350);
 const name=String(file?.webkitRelativePath||file?.name||'Unnamed audio').slice(0,240);
 if(/audio decoding failed|unable to decode|decodeaudiodata|encodingerror/i.test(raw))
  return 'Cannot decode "'+name+'". The file may be damaged or use audio encoding unsupported by this browser. Try a standard PCM WAV (16-bit) or MP3. Details: '+raw;
 return 'Could not process "'+name+'": '+raw;
}
