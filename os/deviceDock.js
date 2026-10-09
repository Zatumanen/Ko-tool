/**
 * My EP lives in one persistent same-origin iframe. No MIDI permission is requested
 * by this controller: the original My EP owns the only connection and all writes.
 * Never discard the frame when switching OS views; doing so would destroy a
 * running transaction and its recovery context.
 */
export const isEpSessionBusy=status=>
  ['reading','mutating','verifying'].includes(status?.phase)||
  ['reading','mutating','verifying','connecting'].includes(status?.status);

export function createDeviceDockController({dock,frame}={}){
 if(!dock||!frame)throw new TypeError('Device dock requires its persistent frame and container');
 let created=false;
 function open(){
  dock.hidden=false;
  if(!created){
   created=true;
   // No hash: the embedded page MUST wait for a real click inside its iframe.
   frame.src='../index.html?os-embed=1';
  }
 }
 function hide(snapshot){
  if(isEpSessionBusy(snapshot))return false;
  dock.hidden=true;
  return true;
 }
 return Object.freeze({open,hide,isLoaded:()=>created});
}
