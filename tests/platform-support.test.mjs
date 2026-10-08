import test from 'node:test';
import assert from 'node:assert/strict';
import{inspectBrowserCapabilities,isMobilePlatform,explainMidiAccessError}from '../js/platformSupport.js';

const makeEnvironment=({
  secure=true,midi=true,audio=true,folder=true,save=true,mobile=false,
  allowed=true,touch=false
}={})=>{
  const navigatorRef={
    userAgent:mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)':'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
    platform:touch?'MacIntel':'Linux x86_64',maxTouchPoints:touch?5:0,
    ...(midi?{requestMIDIAccess:()=>Promise.resolve()}: {})
  };
  const windowRef={isSecureContext:secure,
    ...(audio?{AudioContext:function AudioContext(){}}:{}),
    ...(save?{showSaveFilePicker:()=>Promise.resolve()}: {})};
  const documentRef={createElement:()=>({}),
    getElementById:id=>id==='folder-upload'?(folder?{webkitdirectory:true}:{}):null,
    permissionsPolicy:{allowsFeature:name=>name==='midi'?allowed:true}
  };
  return{navigatorRef,windowRef,documentRef};
};

test('desktop Chromium feature set supports My EP without requesting permissions',()=>{
  const env=makeEnvironment();
  const result=inspectBrowserCapabilities(env);
  assert.equal(result.myEp.supported,true);
  assert.equal(result.myEp.code,'supported');
  assert.equal(result.converter.supported,true);
  assert.equal(result.folderInput,true);
  assert.equal(result.savePicker,true);
  assert.equal(result.downloadFallback,true);
});

test('missing WebMIDI blocks My EP but not offline audio conversion',()=>{
  const result=inspectBrowserCapabilities(makeEnvironment({midi:false}));
  assert.equal(result.myEp.supported,false);
  assert.equal(result.myEp.code,'missing-web-midi');
  assert.match(result.myEp.message,/Chrome or Edge/);
  assert.equal(result.converter.supported,true);
});

test('insecure origin blocks My EP even when WebMIDI exists',()=>{
  const result=inspectBrowserCapabilities(makeEnvironment({secure:false}));
  assert.equal(result.myEp.code,'insecure-context');
  assert.match(result.myEp.message,/HTTPS or http:\/\/localhost/);
  assert.equal(result.savePicker,false);
  assert.equal(result.converter.supported,true);
});

test('browser-level MIDI Permissions Policy blocks My EP early',()=>{
  const result=inspectBrowserCapabilities(makeEnvironment({allowed:false}));
  assert.equal(result.myEp.code,'midi-policy-blocked');
  assert.match(result.myEp.message,/permissions policy/i);
});

test('mobile user agents and iPadOS desktop-mode touch reject USB My EP',()=>{
  const mobile=inspectBrowserCapabilities(makeEnvironment({mobile:true}));
  const ipad=inspectBrowserCapabilities(makeEnvironment({touch:true}));
  assert.equal(mobile.myEp.code,'mobile');
  assert.equal(ipad.myEp.code,'mobile');
  assert.equal(isMobilePlatform(makeEnvironment({touch:true}).navigatorRef),true);
  assert.equal(mobile.converter.supported,true);
});

test('folder selection and save picker have independent non-blocking fallbacks',()=>{
  const result=inspectBrowserCapabilities(makeEnvironment({folder:false,save:false}));
  assert.equal(result.converter.supported,true);
  assert.equal(result.myEp.supported,true);
  assert.equal(result.folderInput,false);
  assert.equal(result.savePicker,false);
  assert.equal(result.downloadFallback,true);
});

test('missing Web Audio blocks converter without confusing it with Web MIDI',()=>{
  const result=inspectBrowserCapabilities(makeEnvironment({audio:false}));
  assert.equal(result.converter.supported,false);
  assert.match(result.converter.message,/Web Audio/);
  assert.equal(result.myEp.supported,true);
});

test('MIDI permission and browser errors get actionable distinct explanations',()=>{
  const denied=explainMidiAccessError(Object.assign(new Error('The user denied permission'),{name:'NotAllowedError'}));
  assert.deepEqual([denied.code,denied.blocked],['midi-denied',true]);
  assert.match(denied.message,/Allow MIDI and SysEx/);
  const unsupported=explainMidiAccessError(Object.assign(new Error('not supported'),{name:'NotSupportedError'}));
  assert.equal(unsupported.code,'missing-web-midi');
  assert.match(unsupported.message,/desktop Chrome or Edge/);
  assert.equal(explainMidiAccessError(new Error('No MIDI ports found')),null);
  assert.equal(explainMidiAccessError(new Error('transient USB disconnect')),null);
});
