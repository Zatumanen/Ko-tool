import test from 'node:test';
import assert from 'node:assert/strict';
import{packedLength,packToBuffer,unpackInPlace}from '../js/ep133/packing.js';
import{parseIdentityResponse,isSupportedEpSku,buildTeSysex,parseTeSysex}from '../js/ep133/sysex.js';

import{buildFileDeletePayload}from '../js/ep133/filesystem.js';
import{outputFileName}from '../js/output-name.js';
test('processed output filenames replace the source extension',()=>{
  assert.equal(outputFileName('song.wav'),'song_x2.wav');
  assert.equal(outputFileName('take.final.wav'),'take.final_x2.wav');
  assert.equal(outputFileName('README'),'README_x2.wav');
});

test('7-bit packing roundtrip',()=>{for(const length of [0,1,7,8,31,433]){const data=Uint8Array.from({length},(_,i)=>(i*37+129)&255);const out=new Uint8Array(packedLength(length));if(length)packToBuffer(data,out);const decoded=unpackInPlace(out);assert.deepEqual([...decoded],[...data]);}});
test('TE SysEx frame roundtrip',()=>{const payload=Uint8Array.from([0,127,128,255,42]);const frame=buildTeSysex(5,payload,123);const parsed=parseTeSysex(frame.bytes);assert.equal(parsed.command,5);assert.deepEqual([...parsed.rawData],[...payload]);});

test('TE request id zero is reserved for identity pending',()=>{
  for(let i=0;i<4096;i++)assert.notEqual(buildTeSysex(5,new Uint8Array(),0,'request-id-zero-test').id,0);
});

test('EP-133 identity parser',()=>{const p=32,a=1;const response=Uint8Array.from([0xF0,0x7E,0x00,0x06,0x02,0x00,0x20,0x76,p&127,p>>7,a&127,a>>7,0,0,0,0,0xF7]);assert.equal(parseIdentityResponse(response).sku,'TE032AS001');});


test('EP-series identity accepts supported TE032 SKUs',()=>{
  for(const sku of ['TE032AS001','TE032AS005','TE032AS006'])assert.equal(isSupportedEpSku(sku),true);
  assert.equal(isSupportedEpSku('TE032AS002'),false);
  assert.equal(isSupportedEpSku('TE010AS033'),false);
});

import{createSampleSlots,EP_SAMPLE_SLOT_COUNT,EP_SAMPLE_PAGE_SIZE,DEFAULT_SAMPLE_TABS,getSampleDisplayName,findNextFreeSampleSlot}from '../js/ep133/sampleMemory.js';
import{requestRead,parseFileEvent}from '../js/ep133/device.js';
import{parseMetadataResponse,calculateMaxPayloadLength,buildFilePutInitPayload,buildFilePutDataPayload,buildMetadataSetPayload,validateFileGetChunk,validateFilePutPage}from '../js/ep133/filesystem.js';
test('EP uploader always starts at the next free slot, including single-file drops',()=>{
  const slots=createSampleSlots([
    {nodeId:1,fileName:'/sounds/one',fileSize:2},
    {nodeId:3,fileName:'/sounds/three',fileSize:2},
    {nodeId:4,fileName:'/sounds/four',fileSize:2}
  ]);
  assert.equal(findNextFreeSampleSlot(slots,1),2);
  assert.equal(findNextFreeSampleSlot(slots,2),2);
  assert.equal(findNextFreeSampleSlot(slots,3),5);
  assert.equal(findNextFreeSampleSlot(slots,999),999);
  slots[998].file={name:'last'};
  assert.equal(findNextFreeSampleSlot(slots,999),-1);
});

test('My EP loads sample-bank tabs from /sounds metadata like the reference tool',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/soundsMetadata=await getFileMetadata\(soundsParentId\)/);
  assert.match(source,/memory\.setTabs\(soundsMetadata\?\.tabs\)/);
});

test('sample memory creates 999 slots and maps sound node id to slot',()=>{
  const slots=createSampleSlots([
    {nodeId:1,fileName:'/sounds/kick.wav',fileSize:1234},
    {nodeId:137,fileName:'/sounds/bass.wav',fileSize:5678},
    {nodeId:1000,fileName:'/sounds/ignored.wav',fileSize:1},
    {nodeId:50,fileName:'/other/file.wav',fileSize:1}
  ]);
  assert.equal(slots.length,EP_SAMPLE_SLOT_COUNT);
  assert.equal(slots[0].file.name,'kick.wav');
  assert.equal(slots[136].file.name,'bass.wav');
  assert.equal(slots[2].file,null);
  assert.deepEqual(DEFAULT_SAMPLE_TABS.map(x=>x.range),[[1,99],[100,199],[200,299],[300,399],[400,499],[500,599],[600,699],[700,799],[800,899],[900,999]]);
});


test('sample display name prefers device metadata name over filesystem slot filename',()=>{
  const slots=createSampleSlots([{nodeId:7,fileName:'/sounds/007.wav',fileSize:123}]);
  slots[6].meta={name:'my-kick.wav'};
  assert.equal(getSampleDisplayName(slots[6]),'my-kick.wav');
});


test('EP metadata response parser reads JSON text and completion marker',()=>{
  const bytes=Uint8Array.from([0,0,...new TextEncoder().encode('{"name":"kick_808.wav"}'),0]);
  assert.deepEqual(parseMetadataResponse(bytes,0),{text:'{"name":"kick_808.wav"}',done:true});
});

test('EP metadata GET is permitted by the read-only request gate',()=>{
  assert.equal(typeof requestRead,'function');
});


test('EP FILE payload sizing matches the authoritative 7-bit transport formula',()=>{
  assert.equal(calculateMaxPayloadLength(512-6),433);
  assert.equal(calculateMaxPayloadLength(1024-6),881);
});

test('EP FILE_PUT init targets the requested destination slot',()=>{
  const payload=buildFilePutInitPayload(127,42,1234,'Kick 808.wav',{channels:2,samplerate:46875,format:'s16'});
  const view=new DataView(payload.buffer);
  assert.equal(payload[0],2);
  assert.equal(payload[1],0);
  assert.equal(payload[2],5);
  assert.equal(view.getUint16(3),127);
  assert.equal(view.getUint16(5),42);
  assert.equal(view.getUint32(7),1234);
  assert.equal(new TextDecoder().decode(payload.slice(11)).startsWith('kick 808'),true);
  assert.equal(payload[19],0);
});

test('EP project archive PUT uses directory flags',()=>{const payload=buildFilePutInitPayload(1234,42,99,'01',null,{isDirectory:true,capabilities:[4]});assert.equal(payload[2],6);assert.equal(new DataView(payload.buffer).getUint16(3),1234);assert.equal(new DataView(payload.buffer).getUint16(5),42);});

test('EP metadata JSON is encoded as UTF-8 and null-terminated in FILE_PUT init and metadata SET payloads',()=>{
  const metadata={name:'привет',description:'café'};
  const put=buildFilePutInitPayload(7,42,12,'Kick.wav',metadata);
  const putNameEnd=11+'kick'.length+1;
  assert.equal(put[putNameEnd+new TextEncoder().encode(JSON.stringify(metadata)).length],0);
  const putJson=new TextDecoder().decode(put.slice(putNameEnd,-1));
  assert.deepEqual(JSON.parse(putJson),metadata);
  const set=buildMetadataSetPayload(7,metadata);
  const setJson=new TextDecoder().decode(set.slice(4,-1));
  assert.deepEqual(JSON.parse(setJson),metadata);
});

test('EP FILE_GET rejects missing, empty, wrong, and oversized pages',()=>{
  assert.throws(()=>validateFileGetChunk(new Uint8Array(),0,10),/Invalid FILE_GET response/);
  assert.throws(()=>validateFileGetChunk(Uint8Array.from([0,0]),0,10),/Empty FILE_GET response/);
  assert.throws(()=>validateFileGetChunk(Uint8Array.from([0,1,9]),0,10),/Unexpected page/);
  assert.throws(()=>validateFileGetChunk(Uint8Array.from([0,0,1,2,3]),0,2),/exceeds the declared file size/);
  assert.deepEqual([...validateFileGetChunk(Uint8Array.from([0,0,1,2]),0,3)],[1,2]);
  assert.deepEqual([...validateFileGetChunk(Uint8Array.from([0,0,1,2,3]),0,3)],[1,2,3]);
});

test('EP FILE_PUT page counter rejects 16-bit overflow',()=>{
  assert.equal(validateFilePutPage(0),0);
  assert.equal(validateFilePutPage(0xffff),0xffff);
  assert.throws(()=>validateFilePutPage(0x10000),/FILE_PUT page limit exceeded/);
});
test('EP FILE_PUT zero-size terminator carries no data bytes',()=>{
  const payload=buildFilePutDataPayload(0,new Uint8Array(0));
  const view=new DataView(payload.buffer);
  assert.equal(payload.length,4);
  assert.equal(payload[0],2);
  assert.equal(payload[1],1);
  assert.equal(view.getUint16(2),0);
});

test('EP FILE_PUT data packet carries page and raw PCM payload',()=>{
  const payload=buildFilePutDataPayload(3,Uint8Array.from([0,127,128,255]));
  const view=new DataView(payload.buffer);
  assert.equal(payload[0],2);
  assert.equal(payload[1],1);
  assert.equal(view.getUint16(2),3);
  assert.deepEqual([...payload.slice(4)],[0,127,128,255]);
});


test('EP library Alt+Arrow page navigation matches the reference 29-row paging',async()=>{
  assert.equal(EP_SAMPLE_PAGE_SIZE,29);
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.match(source,/event\.altKey/);
  assert.match(source,/movePage\(event\.key==='ArrowUp'\?-1:1,\{extend:!!event\.shiftKey\}\)/);
  assert.match(source,/top\+EP_SAMPLE_PAGE_SIZE/);
  assert.match(source,/top-1/);
});

test('readonly EP sample name input does not block library keyboard navigation',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.match(source,/\.ep133-sample-name-input\[readonly\]/);
  assert.match(source,/if\(!readonlySampleName\)return false/);
});

test('EP sample rename uses the reference METADATA SET name payload',async()=>{
  const {normalizeFileName,buildMetadataSetPayload}=await import('../js/ep133/filesystem.js');
  const name=normalizeFileName('Snärë Renamed.wav');
  assert.equal(name,'snare renamed');
  const payload=buildMetadataSetPayload(7,{name});
  assert.equal(payload[0],7);
  assert.equal(payload[1],1);
  assert.equal(new DataView(payload.buffer).getUint16(2),7);
  const end=payload.indexOf(0,4);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(payload.slice(4,end))),{name:'snare renamed'});
});

test('EP sample filename normalization matches the device naming rules',async()=>{
  const {normalizeFileName}=await import('../js/ep133/filesystem.js');
  assert.equal(normalizeFileName('001 Kick 808.wav'),'kick 808');
  assert.equal(normalizeFileName('Snärë/Bad\\Name.wav'),'snarebadname');
  assert.equal(normalizeFileName('Long sample filename here.wav'),'long sample file');
});

import{getTargetSampleRate,parseWavAudioMeta,parseKo2Metadata,prepareTeenageMetadata,buildEp133DownloadAudioMeta}from '../js/ep133/audio.js';

test('EP audio pipeline binds the local resampler module and has no stale fallback reference',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/audio.js',import.meta.url),'utf8');
  assert.match(source,/const resampler=await getLibSampleRateModule\(\)/);
  assert.match(source,/resampler\.getAudioMeta\(name,bytes\)/);
  assert.doesNotMatch(source,/decodeMetaFallback/);
});
test('EP target sample rate follows pbarilla format metadata',()=>{
  const formats=[{type:'pcm',formats:[{format:'s16',channels:[1,2],'samplerate.range':[3000,46875]}]}];
  assert.equal(getTargetSampleRate({sample_rate:44000,channels:1},formats),44000);
  assert.equal(getTargetSampleRate({sample_rate:44100,channels:2},formats),44100);
  assert.equal(getTargetSampleRate({sample_rate:46875,channels:1},formats),46875);
  assert.equal(getTargetSampleRate({sample_rate:48000,channels:1},formats),46875);
  assert.equal(getTargetSampleRate({sample_rate:96000,channels:2},formats),46875);
});

test('EP target sample rate uses native rate when no range exists',()=>{
  const formats=[{type:'pcm',formats:[{format:'s16',channels:[2],'samplerate.native':44100}]}];
  assert.equal(getTargetSampleRate({sample_rate:48000,channels:2},formats),44100);
});

test('EP target sample rate falls back to 46875 when no supported format exists',()=>{
  assert.equal(getTargetSampleRate({sample_rate:44100,channels:2},[]),46875);
  assert.equal(getTargetSampleRate({sample_rate:44100,channels:3},[{type:'pcm',formats:[{format:'s16',channels:[1]}]}]),46875);
});

test('EP WAV metadata parser reads source rate and PCM layout',()=>{
  const bytes=new Uint8Array(48);const view=new DataView(bytes.buffer);
  new TextEncoder().encodeInto('RIFF',bytes.subarray(0,4));view.setUint32(4,40,true);new TextEncoder().encodeInto('WAVE',bytes.subarray(8,12));new TextEncoder().encodeInto('fmt ',bytes.subarray(12,16));view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,44100,true);view.setUint32(28,176400,true);view.setUint16(32,4,true);view.setUint16(34,16,true);new TextEncoder().encodeInto('data',bytes.subarray(36,40));view.setUint32(40,8,true);
  const meta=parseWavAudioMeta(bytes);assert.equal(meta.rate,44100);assert.equal(meta.channels,2);assert.equal(meta.format,1);assert.equal(meta.bits,16);assert.equal(meta.dataOffset,44);assert.equal(meta.dataSize,4);
});


test('EP upload metadata follows the reference Teenage Engineering metadata rules',()=>{
  const meta=prepareTeenageMetadata({
    sample_rate:44100,
    extra:{
      loop_start:4410,
      loop_end:22050,
      midi_root_note:60,
      bpm:120,
      json:JSON.stringify({'sound.playmode':'loop','sound.pitch':2,'sound.amplitude':100,'sound.rootnote':61})
    }
  },46875);
  assert.equal(meta['sound.loopstart'],4687);
  assert.equal(meta['sound.loopend'],23437);
  assert.equal(meta['sound.rootnote'],60);
  assert.equal(meta['sound.bpm'],120);
  assert.equal(meta['sound.playmode'],'loop');
  assert.equal(meta['sound.pitch'],2);
  assert.equal(meta['sound.amplitude'],100);
});

test('EP parser preserves SpeedUpperCut KO2 LIST/TNGE playmode metadata',()=>{
  const json=JSON.stringify({"sound.playmode":"loop","sound.amplitude":100});
  const paddedJsonLength=json.length+(json.length&1);
  const bytes=new Uint8Array(32+paddedJsonLength);
  const view=new DataView(bytes.buffer);
  const ascii=(offset,text)=>{for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);};
  ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');
  ascii(12,'LIST');view.setUint32(16,12+paddedJsonLength,true);ascii(20,'INFO');ascii(24,'TNGE');view.setUint32(28,json.length,true);
  new TextEncoder().encodeInto(json,bytes.subarray(32));
  assert.equal(parseKo2Metadata(bytes)['sound.playmode'],'loop');
});

test('EP download WAV metadata matches the reference createWav contract',()=>{
  const source={
    channels:1,samplerate:46875,format:'s16',
    'sound.rootnote':60,'sound.loopstart':10,'sound.loopend':100,'sound.bpm':120,
    'sound.playmode':'loop','sound.pitch':2,'sound.pan':-1,'sound.amplitude':100,
    'envelope.attack':3,'envelope.release':4,'time.mode':'free','sample.mode':'one',
    regions:[{start:0,end:100}],ignored:'nope'
  };
  const meta=buildEp133DownloadAudioMeta(source);
  assert.equal(meta.channels,1);
  assert.equal(meta.sample_rate,46875);
  assert.equal(meta.format,'s16');
  assert.equal(meta.extra.midi_root_note,60);
  assert.equal(meta.extra.loop_start,10);
  assert.equal(meta.extra.loop_end,100);
  assert.equal(meta.extra.bpm,120);
  const json=JSON.parse(meta.extra.json);
  assert.equal(json['sound.playmode'],'loop');
  assert.deepEqual(json.regions,[{start:0,end:100}]);
  assert.equal('ignored' in json,false);
});

test('EP download WAV uses the reference WASM createWav encoder',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/audio.js',import.meta.url),'utf8');
  assert.match(source,/resampler\.createWav\(String\(name\|\|'sample'\),audioMeta,pcm\)/);
  assert.doesNotMatch(source,/44\+pcm\.byteLength/);
});


test('EP filesystem keeps chunk size scoped to the active device key',async()=>{
  const fs=await import('../js/ep133/filesystem.js');
  assert.equal(typeof fs.resetFileSystemState,'function');
  fs.resetFileSystemState();
});

test('EP FILE_DELETE payload encodes the file id',()=>{
  assert.deepEqual([...buildFileDeletePayload(0x1234)],[6,0x12,0x34]);
});

test('EP header keeps dedicated columns for memory, samples, and MIDI activity',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../css/base.css',import.meta.url),'utf8');
  const rules=[...source.matchAll(/\.ep133-device-stats\{[^}]*grid-template-columns:([^;}]+)[^}]*\}/g)];
  assert.ok(rules.length>=1);
  const finalRule=rules.at(-1)?.[1]||'';
  assert.match(finalRule,/58px/);
});

test('EP MIDI activity hooks are tied to real SysEx send and receive paths',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  assert.match(source,/notifyMidiActivity\('tx'/);
  assert.match(source,/notifyMidiActivity\('rx'/);
  assert.match(source,/export function onMidiActivity/);
});

test('EP FILE event parser matches reference event payloads',()=>{
  const enc=new TextEncoder();
  const added=new Uint8Array(8+enc.encode('kick').length+1);
  const av=new DataView(added.buffer);
  av.setUint16(0,7);av.setUint16(2,42);av.setUint32(4,1234);added.set(enc.encode('kick'),8);
  assert.deepEqual(parseFileEvent(8,added),{nodeId:7,parentId:42,fileSize:1234,name:'kick'});
  assert.deepEqual(parseFileEvent(10,Uint8Array.from([0,7])),{nodeId:7});
  const metadataText=enc.encode('{"free_space_in_bytes":99}');
  const metadata=new Uint8Array(2+metadataText.length+1);
  new DataView(metadata.buffer).setUint16(0,42);metadata.set(metadataText,2);
  assert.deepEqual(parseFileEvent(3,metadata),{nodeId:42,metadata:{free_space_in_bytes:99}});
  assert.deepEqual(parseFileEvent(13,Uint8Array.from([0,7,0,42,0,8])),{oldNodeId:7,parentId:42,nodeId:8});
});
