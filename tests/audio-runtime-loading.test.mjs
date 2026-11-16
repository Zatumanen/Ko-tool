import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getReferenceAudioModule} from '../js/audio/audioEngine.js';

test('reference runtime is imported dynamically, not at module startup',async()=>{
  const source=await readFile(new URL('../js/audio/audioEngine.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/^import[^\n]*resampler\.js/m);
  assert.match(source,/await import\('\.\.\/ep133\/resampler\.js\?v=[^']+'\)/);
});

test('injected reference modules retain precedence and incompatible modules fail closed',async()=>{
  const module={
    resampleAudioData(){return new Uint8Array();},
    createWav(){return new Uint8Array();}
  };
  assert.equal(await getReferenceAudioModule({module}),module);
  assert.equal(await getReferenceAudioModule({moduleProvider:async()=>module}),module);
  await assert.rejects(
    getReferenceAudioModule({moduleProvider:async()=>({createWav(){}})}),
    /reference audio module is unavailable/
  );
});
