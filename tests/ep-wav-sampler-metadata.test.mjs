import test from 'node:test';
import assert from 'node:assert/strict';
import{inspectEpReadyWav}from '../js/ep133/audio.js';

// Synthetic smpl values cross-checked with the existing reference WASM;
// this fixture is not an EP capture or physical-device result.
const samplerWav=({afterData=false,json=null}={})=>{
  const chunk=(id,payload)=>{
    const result=Buffer.alloc(8+payload.length+(payload.length&1));
    result.write(id);result.writeUInt32LE(payload.length,4);payload.copy(result,8);
    return result;
  };
  const fmt=Buffer.alloc(16);
  fmt.writeUInt16LE(1,0);fmt.writeUInt16LE(1,2);fmt.writeUInt32LE(46875,4);
  fmt.writeUInt32LE(93750,8);fmt.writeUInt16LE(2,12);fmt.writeUInt16LE(16,14);
  const smpl=Buffer.alloc(60);
  smpl.writeUInt32LE(60,12);smpl.writeUInt32LE(1,28);
  smpl.writeUInt32LE(4,44);smpl.writeUInt32LE(19,48);
  const pcm=Buffer.from(Array.from({length:64},(_,i)=>i));
  const pieces=[chunk('fmt ',fmt)];
  if(!afterData)pieces.push(chunk('smpl',smpl));
  pieces.push(chunk('data',pcm));
  if(afterData)pieces.push(chunk('smpl',smpl));
  if(json){
    const text=Buffer.from(JSON.stringify(json));
    const info=Buffer.alloc(12+text.length+(text.length&1));
    info.write('INFOTNGE');info.writeUInt32LE(text.length,8);text.copy(info,12);
    pieces.push(chunk('LIST',info));
  }
  const riff=Buffer.alloc(12);riff.write('RIFF');riff.write('WAVE',8);
  const bytes=Buffer.concat([riff,...pieces]);bytes.writeUInt32LE(bytes.length-8,4);
  return{bytes,pcm};
};

for(const afterData of [false,true]){
  test(`native WAV import retains standard sampler metadata ${afterData?'after':'before'} PCM`,()=>{
    const{bytes,pcm}=samplerWav({afterData});
    const prepared=inspectEpReadyWav(bytes,{targetSampleRate:46875});
    assert.ok(prepared);
    assert.deepEqual({...prepared.metadata},{'sound.rootnote':60,'sound.loopstart':4,'sound.loopend':19});
    assert.deepEqual([...prepared.data],[...pcm]);
    assert.equal(prepared.samplerate,46875);
    assert.equal(prepared.channels,1);
  });
}

test('standard sampler fields take reference precedence while other TE metadata survives',()=>{
  const{bytes}=samplerWav({json:{'sound.rootnote':61,'sound.loopstart':1,'sound.loopend':30,'sound.pitch':-12,'sound.playmode':'loop'}});
  const prepared=inspectEpReadyWav(bytes,{targetSampleRate:46875});
  assert.deepEqual({...prepared.metadata},{'sound.rootnote':60,'sound.loopstart':4,'sound.loopend':19,'sound.pitch':-12,'sound.playmode':'loop'});
});
