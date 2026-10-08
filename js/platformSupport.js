/**
 * Browser/platform support policy. Feature detection is authoritative:
 * a browser brand alone cannot prove SysEx permission or working USB ports.
 * Checks here must not request MIDI permission or access files.
 */
export function isMobilePlatform(navigatorRef=globalThis.navigator){
  const ua=String(navigatorRef?.userAgent||'');
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)||
    (navigatorRef?.platform==='MacIntel'&&Number(navigatorRef?.maxTouchPoints)>1);
}

export function inspectBrowserCapabilities({
  navigatorRef=globalThis.navigator,
  windowRef=globalThis.window,
  documentRef=globalThis.document
}={}){
  const secureContext=windowRef?.isSecureContext===true;
  const mobile=isMobilePlatform(navigatorRef);
  const webMidi=typeof navigatorRef?.requestMIDIAccess==='function';
  const audioContext=typeof windowRef?.AudioContext==='function'||typeof windowRef?.webkitAudioContext==='function';
  const fileInput=typeof documentRef?.createElement==='function';
  const folderInput=typeof documentRef?.getElementById?.('folder-upload')?.webkitdirectory==='boolean';
  const savePicker=typeof windowRef?.showSaveFilePicker==='function'&&secureContext;
  const policy=documentRef?.permissionsPolicy||documentRef?.featurePolicy;
  let midiAllowedByPolicy=true;
  try{
    if(typeof policy?.allowsFeature==='function')midiAllowedByPolicy=policy.allowsFeature('midi')!==false;
  }catch{
    // Lack of Permissions Policy introspection is not proof of a block.
  }
  let myEpCode='supported',myEpMessage='';
  if(mobile){
    myEpCode='mobile';
    myEpMessage='MY EP requires a desktop computer with Chrome or Edge and Web MIDI SysEx. Use the audio converter here, or open MY EP on a desktop.';
  }else if(!secureContext){
    myEpCode='insecure-context';
    myEpMessage='MY EP requires a secure page (HTTPS or http://localhost). Open SpeedUpperCut on HTTPS or localhost, then reconnect your EP by USB.';
  }else if(!webMidi){
    myEpCode='missing-web-midi';
    myEpMessage='MY EP needs Web MIDI with SysEx. Open this page in desktop Chrome or Edge, connect the EP by USB, and allow MIDI/SysEx access.';
  }else if(!midiAllowedByPolicy){
    myEpCode='midi-policy-blocked';
    myEpMessage='This page blocks Web MIDI through browser/site permissions policy. Open SpeedUpperCut directly in a secure top-level Chrome or Edge tab.';
  }
  return Object.freeze({
    secureContext,mobile,webMidi,midiAllowedByPolicy,audioContext,
    fileInput,folderInput,savePicker,downloadFallback:fileInput,
    myEp:Object.freeze({supported:myEpCode==='supported',code:myEpCode,message:myEpMessage}),
    converter:Object.freeze({
      supported:audioContext&&fileInput,
      message:!fileInput?'Audio file selection is unavailable in this browser. Try desktop Chrome or Edge.':
        !audioContext?'Audio processing requires Web Audio. Try an up-to-date desktop browser.':''
    })
  });
}

export function explainMidiAccessError(error){
  const message=String(error?.message||'');
  if(error?.name==='NotAllowedError'||error?.name==='SecurityError'||/permission|denied/i.test(message))
    return Object.freeze({blocked:true,code:'midi-denied',message:'MIDI/SysEx access was denied. Allow MIDI and SysEx permissions for this site in browser settings, then reload the page and retry.'});
  if(error?.name==='NotSupportedError'||/not supported/i.test(message))
    return Object.freeze({blocked:true,code:'missing-web-midi',message:'This browser does not support the required Web MIDI SysEx connection. Use desktop Chrome or Edge over HTTPS or localhost.'});
  return null;
}
