import test from 'node:test';
import assert from 'node:assert/strict';
import{packedLength,packToBuffer,unpackInPlace}from '../js/ep133/packing.js';
import{parseIdentityResponse,isSupportedEpSku,buildTeSysex,encodeTeSysex,parseTeSysex}from '../js/ep133/sysex.js';

import{buildFileDeletePayload,buildFileInitPayload,buildFileListPayload,buildFileGetInitPayload,buildFileGetDataPayload,buildMetadataGetPayload}from '../js/ep133/filesystem.js';
import{parseProjectArchive,validateProjectArchive,compareProjectArchiveMembers,patchProjectArchiveMembers,patchPadRecord,patchProjectPad,encodePatternMember,patchScenesMember,patchSettingsMember,patchFxSettingsMember,buildProjectFromNative,getProjectReferencedSampleSlots,preflightProjectSampleDependencies}from '../js/ep133/projectArchive.js';
import{getEpProjectProfile,assertProjectTransportSupported,assertProjectAuthoringSupported,assertProjectReloadSupported}from '../js/ep133/projectProfile.js';
import{readProjectModel,readProjectPattern,buildProjectFromModel}from '../js/ep133/projectReader.js';
import{createProjectSequencer}from '../js/ep133/projectSequencer.js';
import{auditProjectArchiveBytes}from '../js/ep133/projectHil.js';
import{outputFileName}from '../js/output-name.js';
const writeTarText=(bytes,offset,length,text)=>{
  for(let i=0;i<length;i++)bytes[offset+i]=0;
  for(let i=0;i<text.length&&i<length;i++)bytes[offset+i]=text.charCodeAt(i);
};
const makeTarMember=(path,data=new Uint8Array(),type='0')=>{
  const payload=data instanceof Uint8Array?data:new Uint8Array(data);
  const header=new Uint8Array(512);
  writeTarText(header,0,100,path);
  writeTarText(header,100,8,type==='5'?'0000755\0':'0000644\0');
  if(payload.length)writeTarText(header,124,12,payload.length.toString(8)+'\0');
  header[156]=type.charCodeAt(0);
  header.fill(0x20,148,156);
  let checksum=0;
  for(const byte of header)checksum+=byte;
  const checksumText=checksum.toString(8)+'\0';
  writeTarText(header,148,8,checksumText);
  for(let i=148+checksumText.length;i<156;i++)header[i]=0x20;
  const padded=new Uint8Array(Math.ceil(payload.length/512)*512);
  padded.set(payload);
  return[header,padded];
};
const makeProjectTar=members=>{
  const chunks=[];
  let size=1024;
  for(const member of members){
    const pair=makeTarMember(member.path,member.data,member.type||'0');
    chunks.push(...pair);
    size+=pair[0].length+pair[1].length;
  }
  const out=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
};
const validPadRecord=()=>{
  const pad=new Uint8Array(26);
  pad[1]=1;
  pad[16]=100;
  pad[20]=255;
  pad[24]=60;
  return pad;
};
const notePattern=()=>Uint8Array.from([0,1,1,0,0,0,0,60,100,24,0,0]);
const ep40NotePattern=()=>Uint8Array.from([1,1,0xff,0xff,1,0,0,0,0,60,100,24,0,0]);
const validEp40PadRecord=()=>{
  const pad=new Uint8Array(29);
  pad[1]=1;
  pad[16]=100;
  pad[20]=255;
  pad[24]=60;
  return pad;
};
const scenesWithA1=()=>{
  const scenes=new Uint8Array(712);
  scenes.set([0,0,0,0,0,4,4],0);
  for(let scene=0;scene<99;scene++){
    const offset=7+scene*6;
    scenes[offset+4]=4;
    scenes[offset+5]=4;
  }
  scenes[7]=1;
  return scenes;
};

test('processed output filenames replace the source extension',()=>{
  assert.equal(outputFileName('song.wav'),'song_x2.wav');
  assert.equal(outputFileName('take.final.wav'),'take.final_x2.wav');
  assert.equal(outputFileName('README'),'README_x2.wav');
});

test('7-bit packing roundtrip',()=>{for(const length of [0,1,7,8,31,433]){const data=Uint8Array.from({length},(_,i)=>(i*37+129)&255);const out=new Uint8Array(packedLength(length));if(length)packToBuffer(data,out);const decoded=unpackInPlace(out);assert.deepEqual([...decoded],[...data]);}});
test('TE SysEx frame roundtrip',()=>{const payload=Uint8Array.from([0,127,128,255,42]);const frame=buildTeSysex(5,payload,123);const parsed=parseTeSysex(frame.bytes);assert.equal(parsed.command,5);assert.deepEqual([...parsed.rawData],[...payload]);});

test('TE SysEx golden request vector matches the production frame and packed7 layout',()=>{
  const payload=Uint8Array.from([0x80,0x01,0xff,0x7f,0x00,0x55,0xaa]);
  const frame=encodeTeSysex(5,payload,0x33,0x123);
  assert.equal(frame.id,0x123);
  assert.deepEqual([...frame.bytes],[
    0xf0,0x00,0x20,0x76,0x33,0x40,0x62,0x23,0x05,
    0x45,0x00,0x01,0x7f,0x7f,0x00,0x55,0x2a,0xf7
  ]);
});

test('TE SysEx golden response vector strips raw status before unpacking payload',()=>{
  const bytes=Uint8Array.from([
    0xf0,0x00,0x20,0x76,0x33,0x40,0x22,0x23,0x05,0x00,
    0x45,0x00,0x01,0x7f,0x7f,0x00,0x55,0x2a,0xf7
  ]);
  const parsed=parseTeSysex(bytes);
  assert.equal(parsed.isRequest,false);
  assert.equal(parsed.requestId,0x123);
  assert.equal(parsed.status,0);
  assert.deepEqual([...parsed.rawData],[0x80,0x01,0xff,0x7f,0x00,0x55,0xaa]);
});

test('TE request id zero is reserved for identity pending',()=>{
  for(let i=0;i<4096;i++)assert.notEqual(buildTeSysex(5,new Uint8Array(),0,'request-id-zero-test').id,0);
});

test('EP-133 identity parser',()=>{const p=32,a=1;const response=Uint8Array.from([0xF0,0x7E,0x00,0x06,0x02,0x00,0x20,0x76,p&127,p>>7,a&127,a>>7,0,0,0,0,0xF7]);assert.equal(parseIdentityResponse(response).sku,'TE032AS001');});


test('EP-series identity accepts supported TE032 SKUs',()=>{
  for(const sku of ['TE032AS001','TE032AS005','TE032AS006'])assert.equal(isSupportedEpSku(sku),true);
  assert.equal(isSupportedEpSku('TE032AS002'),false);
  assert.equal(isSupportedEpSku('TE010AS033'),false);
});

test('EP SKU profiles keep device-specific play modes and safe fallback tabs',()=>{
  const ep133=getEpDeviceProfile('TE032AS001');
  const ep1320=getEpDeviceProfile('TE032AS005');
  const ep40=getEpDeviceProfile('TE032AS006');
  assert.deepEqual(ep133.playModes,['oneshot','key','legato']);
  assert.deepEqual(ep1320.playModes,['oneshot','key','legato']);
  assert.deepEqual(ep40.playModes,['oneshot','key','legato','loop']);
  assert.equal(ep133.advancedSampleMetadataWrites,true);
  assert.equal(ep40.advancedSampleMetadataWrites,true);
  assert.equal(ep1320.advancedSampleMetadataWrites,false);
  assert.equal(ep1320.sampleTransfers,false);
  assert.deepEqual(ep1320.fallbackTabs.map(tab=>tab.range),[[1,69],[70,114],[115,127],[128,155],[156,220],[221,999]]);
  assert.deepEqual(ep40.fallbackTabs.map(tab=>tab.range),[[1,999]]);
});

import{createSampleSlots,EP_SAMPLE_SLOT_COUNT,DEFAULT_SAMPLE_TABS,getSampleDisplayName,calculateSampleDuration,findNextFreeSampleSlot,canTransferMoveSample,planSampleTransferTargets}from '../js/ep133/sampleMemory.js';
import{getEpDeviceProfile}from '../js/ep133/deviceProfile.js';
import{requestRead,parseFileEvent,formatDeviceRejection,parseFirmwareDebugFrame}from '../js/ep133/device.js';
import{parseMetadataResponse,calculateMaxPayloadLength,buildFilePutInitPayload,buildFilePutDataPayload,buildFileInfoPayload,buildFileMovePayload,parseFileMoveResponse,buildMetadataSetPayload,prepareSampleTransferMetadata,prepareSampleWritableMetadata,prepareSampleCreateMetadata,createTransferFileName,validateFileGetChunk,validateFilePutPage}from '../js/ep133/filesystem.js';
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

test('My EP browser modules pass a real Node syntax check',async()=>{
  const {execFileSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  for(const relative of ['../js/ep133/ui.js','../js/ep133/sampleMemory.js','../js/ep133/deviceProfile.js','../js/ep133/projectProfile.js','../js/ep133/projectArchive.js','../js/ep133/projectReader.js','../js/ep133/projectSequencer.js','../js/ep133/projectHil.js','../js/ep133/device.js','../js/ep133/filesystem.js','../js/ep133/audio.js']){
    execFileSync(process.execPath,['--check',fileURLToPath(new URL(relative,import.meta.url))],{stdio:'pipe'});
  }
});


test('EP connection uses GREET base_sku for the effective device profile',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  assert.match(source,/const baseSku=String\(metadata\?\.base_sku\|\|''\)\.toUpperCase\(\)/);
  assert.match(source,/const effectiveSku=isSupportedEpSku\(baseSku\)\?baseSku:found\.parsed\.sku/);
  assert.match(source,/validateFirmware\(effectiveSku,metadata\)/);
  assert.match(source,/deviceInfo=\{sku:effectiveSku,identitySku:found\.parsed\.sku,baseSku:baseSku\|\|null,metadata\}/);
});

test('My EP holds the official-named app lock for the lifetime of the tab',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/navigator\.locks\.request\('ep-sample-util',\{ifAvailable:true\}/);
  assert.match(source,/OPEN IN ANOTHER TAB/);
  assert.match(source,/return new Promise\(\(\)=>\{\}\)/);
  assert.match(source,/if\(!await instanceLockGate\)/);
});

test('My EP normal upload no longer rereads metadata after a successful write',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  const start=source.indexOf('async function uploadFilesToSlot');
  const block=source.slice(start,source.indexOf('const readDevice=async',start));
  assert.match(block,/const info=await getFileInfo\(fileId\)/);
  assert.doesNotMatch(block,/await getFileMetadata\(target\.id\)/);
  assert.match(block,/memory\.setMetadata\(target\.id,prepareSampleWritableMetadata/);
});

test('My EP cache-busting chain keeps deep EP modules on the same release token',async()=>{
  const fs=await import('node:fs/promises');
  const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');
  const [html,app,ui,index]=await Promise.all([
    read('index.html'),read('js/app.js'),read('js/ep133/ui.js'),read('js/ep133/index.js')
  ]);
  const token=html.match(/js\/app\.js\?v=([^"']+)/)?.[1];
  assert.ok(token);
  const filesystem=await read('js/ep133/filesystem.js');
  assert.equal(app.includes("./ep133/ui.js?v="+token),true);
  assert.equal(ui.includes("./index.js?v="+token),true);
  assert.equal(ui.includes("./audio.js?v="+token),true);
  assert.equal(ui.includes("./deviceProfile.js?v="+token),true);
  assert.equal(index.includes("./filesystem.js?v="+token),true);
  assert.equal(index.includes("./device.js?v="+token),true);
  assert.equal(index.includes("./projectReader.js?v="+token),true);
  assert.equal(index.includes("./projectSequencer.js?v="+token),true);
  assert.equal(index.includes("./projectHil.js?v="+token),true);
  const [reader,sequencer,hil]=await Promise.all([
    read('js/ep133/projectReader.js'),read('js/ep133/projectSequencer.js'),read('js/ep133/projectHil.js')
  ]);
  assert.equal(reader.includes("./projectArchive.js?v="+token),true);
  assert.equal(sequencer.includes("./projectArchive.js?v="+token),true);
  assert.equal(sequencer.includes("./projectReader.js?v="+token),true);
  assert.equal(hil.includes("./filesystem.js?v="+token),true);
  assert.equal(hil.includes("./projectReader.js?v="+token),true);
  assert.equal(filesystem.includes("./device.js?v="+token),true);
});

test('My EP loads sample-bank tabs from /sounds metadata like the reference tool',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/soundsMetadata=await getFileMetadata\(soundsParentId\)/);
  assert.match(source,/memory\.setTabs\(Array\.isArray\(soundsMetadata\?\.tabs\).*activeDeviceProfile\.fallbackTabs\)/);
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


test('EP sample duration matches the reference PCM length calculation',()=>{
  const slot={file:{size:93750},meta:{samplerate:46875,channels:1}};
  assert.equal(calculateSampleDuration(slot),1);
  assert.equal(calculateSampleDuration({file:{size:46874},meta:{samplerate:46875,channels:1}})<1,true);
  assert.equal(calculateSampleDuration({file:{size:100},meta:{}}),null);
});

test('My EP leaves Space unused and previews occupied samples on Arrow navigation',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/event\.key===' '/);
  assert.match(source,/event\.key==='ArrowUp'\|\|event\.key==='ArrowDown'/);
  assert.match(source,/setSelection\(\[target\],target,\{preview:!!slots\[target-1\]\?\.file/);
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


test('EP device rejection preserves the firmware reason text',()=>{
  const raw=new TextEncoder().encode('invalid id\0');
  assert.equal(formatDeviceRejection({status:3,rawData:raw}),'EP-series device returned status 3: invalid id');
  assert.equal(formatDeviceRejection({status:3,rawData:new Uint8Array()}),'EP-series device returned status 3');
});

test('EP firmware debug frames are detected before normal protocol parsing',()=>{
  const frame=Uint8Array.from([0xF0,0x00,0x20,0x76,0x33,0x33,...new TextEncoder().encode('err lfs 6327'),0xF7]);
  assert.equal(parseFirmwareDebugFrame(frame),'err lfs 6327');
  assert.equal(parseFirmwareDebugFrame(Uint8Array.from([0xF0,0x00,0x20,0x76,0x33,0x40,0xF7])),null);
});

test('EP firmware debug frames stay production-compatible outside strict transactions',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  const start=source.indexOf('const debugText=parseFirmwareDebugFrame(data)');
  const block=source.slice(start,source.indexOf("if(data[1]===0x7E)",start));
  assert.match(block,/console\.warn\('EP firmware\/debug SysEx:',debugText\)/);
  assert.match(block,/if\(strictFirmwareDebugDepth>0\)enterUnsafeState/);
  assert.doesNotMatch(block,/if\(debugText\)\{\s*enterUnsafeState/);
});

test('EP strict project transactions passively preflight firmware debug loops before sending requests',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  assert.match(source,/const FIRMWARE_DEBUG_PREFLIGHT_MS=1200,FIRMWARE_DEBUG_GRACE_MS=2500/);
  const start=source.indexOf('export async function passiveFirmwareDebugPreflight');
  const end=source.indexOf('export async function withStrictFirmwareDebugGuard',start);
  const block=source.slice(start,end);
  assert.match(block,/const sequence=firmwareDebugSequence/);
  assert.match(block,/await new Promise\(resolve=>setTimeout\(resolve,wait\)\)/);
  assert.match(block,/firmwareDebugSequence!==sequence/);
  const guard=source.slice(end,source.indexOf('export function formatDeviceRejection',end));
  assert.match(guard,/if\(strictFirmwareDebugDepth===0&&preflightMs>0\)await passiveFirmwareDebugPreflight/);
  assert.ok(guard.indexOf('passiveFirmwareDebugPreflight')<guard.indexOf('strictFirmwareDebugDepth+=1'));
});

test('EP strict transactions use a post-timeout debug grace window while normal requests keep the 2s timeout',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  const start=source.indexOf('async function sendRequest');
  const end=source.indexOf('export async function connectEp133',start);
  const block=source.slice(start,end);
  assert.match(block,/timeout=2000/);
  assert.match(block,/if\(strictFirmwareDebugDepth>0\)/);
  assert.match(block,/pending\.delete\(frame\.id\)/);
  assert.match(block,/setTimeout\(resolve,FIRMWARE_DEBUG_GRACE_MS\)/);
  assert.match(block,/Firmware debug SysEx started after request timeout/);
});

test('EP request timeouts match TE while interrupted streams keep the safety lock',async()=>{
  const fs=await import('node:fs/promises');
  const deviceSource=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  const filesystemSource=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(deviceSource,/async function sendRequest\(command,payload=new Uint8Array\(\),timeout=2000\)/);
  assert.match(deviceSource,/export function requestRead\(command,payload=new Uint8Array\(\),timeout=2000\)/);
  assert.match(deviceSource,/export function requestFile\(command,payload=new Uint8Array\(\),timeout=2000\)/);
  const sendStart=deviceSource.indexOf('async function sendRequest');
  const timerStart=deviceSource.indexOf('const timer=setTimeout',sendStart);
  const timerBlock=deviceSource.slice(timerStart,deviceSource.indexOf('pending.set',timerStart));
  assert.match(timerBlock,/error\.name='EPSeriesTimeoutError'/);
  assert.match(timerBlock,/if\(strictFirmwareDebugDepth>0\)/);
  assert.match(timerBlock,/if\(firmwareDebugSequence!==sequence\)\{\s*enterUnsafeState/);
  assert.match(timerBlock,/\}\s*finishReject\(error\);\s*\},timeout\)/);
  assert.match(filesystemSource,/FILE_PUT stream was interrupted before EOF/);
  assert.match(filesystemSource,/FILE_GET stream was interrupted before the declared byte count/);
  assert.match(filesystemSource,/Paged METADATA SET was interrupted before EOF/);
});

test('EP transfer metadata preserves reference TE fields without release coupling',()=>{
  assert.deepEqual(
    prepareSampleTransferMetadata({
      channels:1,samplerate:46875,format:'s16',crc:123,
      name:'kick','sound.playmode':'oneshot','time.mode':'off',
      'sample.start':-1,'sample.end':100,'sample.mode':'multi',
      regions:[{'sample.start':0,'sample.end':100}],'sound.pitch':0
    }),
    {
      channels:1,samplerate:46875,format:'s16',name:'kick',
      'sound.playmode':'oneshot','time.mode':'off',
      'sample.start':-1,'sample.end':100,'sample.mode':'multi',
      regions:[{'sample.start':0,'sample.end':100}],'sound.pitch':0
    }
  );
  assert.deepEqual(
    prepareSampleTransferMetadata({'time.mode':2,name:'short'}),
    {'time.mode':'bar',name:'short'}
  );
  assert.deepEqual(
    prepareSampleTransferMetadata({'sound.playmode':'oneshot',name:'no-release'}),
    {'sound.playmode':'oneshot',name:'no-release'}
  );
});

test('EP post-upload metadata preserves TE start end mode and regions',()=>{
  assert.deepEqual(
    prepareSampleWritableMetadata({
      channels:1,samplerate:46875,format:'s16',crc:123,name:'kick',
      'sample.start':-1,'sample.end':100,'sample.mode':'multi',
      'sound.playmode':'oneshot','sound.pitch':2,'time.mode':'free',
      regions:[{'sample.start':0,'sample.end':100}]
    }),
    {
      name:'kick','sample.start':-1,'sample.end':100,'sample.mode':'multi',
      'sound.playmode':'oneshot','sound.pitch':2,'time.mode':'free',
      regions:[{'sample.start':0,'sample.end':100}]
    }
  );
});


test('EP writable metadata preserves unknown TE fields but excludes transport-only fields',()=>{
  assert.deepEqual(
    prepareSampleWritableMetadata({
      name:'kick',channels:2,samplerate:46875,format:'s16',crc:123,
      'sound.future':{enabled:true},'sample.experimental':[1,2,3]
    }),
    {name:'kick','sound.future':{enabled:true},'sample.experimental':[1,2,3]}
  );
  assert.deepEqual(
    prepareSampleWritableMetadata({'sound.future':1},{allowAdvancedMetadata:false}),
    {}
  );
});

test('EP upload create metadata is limited to the official stream fields',()=>{
  assert.deepEqual(
    prepareSampleCreateMetadata({
      name:'Kick Long Filename.wav',channels:2,samplerate:46875,format:'s16',crc:123,
      'sound.pitch':2,regions:[{start:0,end:100}]
    }),
    {name:'kick lo.filename',channels:2,samplerate:46875,format:'s16',crc:123}
  );
  assert.deepEqual(
    prepareSampleCreateMetadata({name:'bad',channels:3,samplerate:1,format:'f32'}),
    {name:'bad'}
  );
});

test('EP writable sample metadata follows current TE validators and preserves nonempty modes',()=>{
  assert.deepEqual(
    prepareSampleWritableMetadata({
      name:'Safe.wav','sound.playmode':'loop','sound.bpm':60,
      'sound.amplitude':200,'sound.rootnote':1,'sample.start':-1
    }),
    {name:'safe','sound.playmode':'loop','sound.bpm':60,'sound.amplitude':200,'sound.rootnote':1,'sample.start':-1}
  );
  assert.deepEqual(
    prepareSampleWritableMetadata({
      name:'Safe.wav','sound.playmode':'future-mode','time.mode':'free','sound.bars':3,
      'sound.pitch':99,'sound.pan':17,'sound.bpm':181,'sound.amplitude':201,'sound.rootnote':0
    }),
    {name:'safe','sound.playmode':'future-mode','time.mode':'free','sound.bars':3}
  );
});

test('EP imported playmode follows the current TE nonempty-string validator',()=>{
  assert.equal(
    prepareSampleWritableMetadata({'sound.playmode':'loop'},{allowedPlayModes:['oneshot','key','legato']})['sound.playmode'],
    'loop'
  );
  assert.equal(
    prepareSampleWritableMetadata({'sound.playmode':'future-mode'})['sound.playmode'],
    'future-mode'
  );
  assert.deepEqual(
    prepareSampleTransferMetadata({'sound.playmode':'future-mode'}),
    {'sound.playmode':'future-mode'}
  );
});

test('Medieval profile fails closed for unverified advanced sample metadata writes',()=>{
  const source={
    name:'chant','sound.playmode':'oneshot','envelope.release':255,
    'sound.pitch':2,'time.mode':'bpm','sound.bpm':120,'sound.bars':2
  };
  assert.deepEqual(
    prepareSampleWritableMetadata(source,{
      allowedPlayModes:['oneshot','key','legato'],
      allowAdvancedMetadata:false,
      allowedBarValues:[1,2]
    }),
    {name:'chant'}
  );
});

test('My EP preserves source TE bar and time metadata while the property UI remains source-backed',()=>{
  assert.deepEqual(prepareSampleWritableMetadata({'sound.bars':4},{allowedBarValues:[1,2]}),{'sound.bars':4});
  assert.deepEqual(prepareSampleWritableMetadata({'time.mode':'reverse'}),{'time.mode':'reverse'});
  assert.deepEqual(prepareSampleTransferMetadata({'sound.bars':4}),{'sound.bars':4});
});

test('EP slot transfer uses a temporary filesystem name and rolls back created destinations before source deletion',async()=>{
  assert.equal(createTransferFileName(7,42),'mv007_042');
  const fs=await import('node:fs/promises');
  const filesystemSource=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(filesystemSource,/const displayName=normalizeFileName\(metadata\?\.name\|\|name\)/);
  assert.match(filesystemSource,/filename:wireName/);
  const uiSource=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(uiSource,/const transferName=createTransferFileName\(source\.id,target\.id\)/);
  assert.match(uiSource,/created\.push\(createdId\)/);
  assert.match(uiSource,/for\(const id of \[\.\.\.created\]\.reverse\(\)\)/);
});

test('EP uploads follow the current TE PUT then metadata SET then FILE_INIT sequence',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function uploadSampleToSlot');
  const block=source.slice(start,source.indexOf('export async function startPlayback',start));
  const put=block.indexOf('await putFile(');
  const metadata=block.indexOf('await setFileMetadata(fileId,writableMetadata)',put);
  const init=block.indexOf('await initFileSystem()',metadata);
  assert.ok(put>=0&&metadata>put&&init>metadata);
  assert.doesNotMatch(block,/await getFileInfo\(fileId\)/);
});

test('EP FILE streams fail closed if GET PUT or paged metadata is interrupted or init state is ambiguous',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(source,/FILE_PUT init timed out after request dispatch; device write state is unknown/);
  assert.match(source,/FILE_GET init timed out after request dispatch; device read state is unknown/);
  assert.match(source,/Paged METADATA SET init timed out after request dispatch; device write state is unknown/);
  assert.match(source,/FILE_PUT stream was interrupted before EOF/);
  assert.match(source,/FILE_GET stream was interrupted before the declared byte count/);
  assert.match(source,/Paged METADATA SET was interrupted before EOF/);
  assert.match(source,/navigator\?\.locks/);
});

test('My EP native MOVE never falls back to copy-delete or PCM readback',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  const start=source.indexOf('const transactionalTransfer=async');
  const block=source.slice(start,source.indexOf('const deleteSamples=async',start));
  assert.match(block,/if\(!copy\)return nativeMoveTransfer\(plan,sourceById\)/);
  assert.doesNotMatch(block,/NATIVE FILE_MOVE FAILED/);
  const beforeCopy=block.slice(0,block.indexOf("if(sources.some"));
  assert.doesNotMatch(beforeCopy,/getFile\(/);
  assert.doesNotMatch(beforeCopy,/deleteFile\(/);
});

test('My EP confirms destructive deletes through authoritative /sounds LIST',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/const assertSlotsDeleted=async ids=>/);
  assert.match(source,/const files=await readAuthoritativeFiles\(\)/);
  assert.match(source,/await assertDeleteTargetUnchanged\(slot\)/);
  assert.match(source,/await assertSlotsDeleted\(targets\.map\(slot=>slot\.id\)\)/);
});

test('My EP sample mutations prefer METADATA_UPDATED and fall back to metadata GET',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/const waitForMetadataUpdate=nodeId=>waitForFileEvent/);
  assert.match(source,/\{timeout:500\}/);
  assert.match(source,/const metadata=event\?\.data\?\.metadata\|\|await getFileMetadata\(nodeId\)/);
  const uploadStart=source.indexOf('async function uploadFilesToSlot');
  const uploadBlock=source.slice(uploadStart,source.indexOf('const readDevice=async',uploadStart));
  assert.match(uploadBlock,/const metadataUpdate=waitForMetadataUpdate\(soundsParentId\)/);
  assert.match(uploadBlock,/await syncMetadataAfterMutation\(soundsParentId,metadataUpdate\)/);
  const deleteStart=source.indexOf('const deleteSamples=async');
  const deleteBlock=source.slice(deleteStart,source.indexOf('memory=createSampleMemory',deleteStart));
  assert.match(deleteBlock,/const metadataUpdate=waitForMetadataUpdate\(soundsParentId\)/);
});

test('My EP aborts batches when the connected MIDI session changes',async()=>{
  const fs=await import('node:fs/promises');
  const device=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  const ui=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(device,/export function getDeviceSessionToken\(\)/);
  assert.match(device,/connectionEpoch,output\?\.id/);
  assert.match(ui,/const captureBatchSession=\(\)=>/);
  assert.match(ui,/getDeviceSessionToken\(\)!==token/);
  assert.match(ui,/EP device connection changed during the operation; batch aborted/);
  assert.match(ui,/assertBatchSession\(sessionToken\)/);
});

test('EP native MOVE can verify source and destination CRC without downloading PCM',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function moveFile');
  const end=source.indexOf('async function setFileMetadataUnlocked',start);
  const block=source.slice(start,end);
  assert.match(block,/const sourceMetadata=await getMetadataByNodeId\(fileId\)/);
  assert.match(block,/sourceCrc=normalizeCrc\(sourceMetadata\?\.crc\)/);
  assert.match(block,/metadata=await getMetadataByNodeId\(moved\.newFileId\)/);
  assert.match(block,/destinationCrc=normalizeCrc\(metadata\?\.crc\)/);
  assert.match(block,/crcVerified=destinationCrc!==null&&destinationCrc===sourceCrc/);
  assert.doesNotMatch(block,/getFileUnlocked/);
});

test('EP sample reorder uses native FILE_MOVE only and resolves the authoritative destination',async()=>{
  assert.equal(canTransferMoveSample({file:{name:'kick'},node:{isReadable:false,isDeletable:false,isMovable:false}}),true);
  assert.equal(canTransferMoveSample({file:null,node:{isMovable:true}}),false);
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  const start=source.indexOf('const nativeMoveTransfer=async');
  const end=source.indexOf('const transactionalTransfer=async',start);
  const nativeBlock=source.slice(start,end);
  assert.match(nativeBlock,/await moveFile\(sourceNodeId,soundsParentId,target\.id,\{verifyCrc:true\}\)/);
  assert.match(nativeBlock,/completed\.push\(\{sourceId:source\.id,targetId:target\.id,source,crc:moved\.sourceCrc\}\)/);
  assert.match(nativeBlock,/if\(moved\.crcVerified!==true\)/);
  assert.match(nativeBlock,/applyNativeMoveLocally\(source,target,moved\)/);
  assert.match(source,/const item=fileItemFromInfo\(moved\.info\)/);
  assert.doesNotMatch(nativeBlock,/getFile\(/);
  assert.doesNotMatch(nativeBlock,/getFileMetadata\(/);
  const transferBlock=source.slice(end,source.indexOf('const deleteSamples=async',end));
  assert.match(transferBlock,/if\(!copy\)return nativeMoveTransfer\(plan,sourceById\)/);
  assert.doesNotMatch(transferBlock,/NATIVE FILE_MOVE FAILED/);
});

test('My EP suppresses its own FILE_MOVED event but still syncs external moves incrementally',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/const pendingNativeMoveEvents=new Set\(\)/);
  assert.match(source,/pendingNativeMoveEvents\.has\(key\)\)return/);
  assert.match(source,/event\.type===TE_SYSEX_FILE_EVENT_FILE_MOVED[\s\S]*await syncMovedFile\(payload\)/);
  const movedBlock=source.match(/if\(event\.type===TE_SYSEX_FILE_EVENT_FILE_MOVED\)\{[\s\S]*?\n      \}/)?.[0]||'';
  assert.doesNotMatch(movedBlock,/readDevice\(/);
});

test('EP FILE payload sizing matches the authoritative 7-bit transport formula',()=>{
  assert.equal(calculateMaxPayloadLength(512-6),433);
  assert.equal(calculateMaxPayloadLength(1024-6),881);
});

test('EP FILE golden payload vectors match production big-endian framing',()=>{
  assert.deepEqual([...buildFileInitPayload()],[1,1,0x00,0x40,0x00,0x00]);
  assert.deepEqual([...buildFileListPayload(0x1234,1000)],[4,0x12,0x34,0x03,0xe8]);
  assert.deepEqual([...buildFileGetInitPayload(0x1234,0x01020304)],[3,0,0x12,0x34,1,2,3,4]);
  assert.deepEqual([...buildFileGetDataPayload(0xabcd)],[3,1,0xab,0xcd]);
  assert.deepEqual(
    [...buildMetadataGetPayload(1000,2,'active')],
    [7,2,0x03,0xe8,0,2,0x61,0x63,0x74,0x69,0x76,0x65,0]
  );
});

test('EP FILE_INFO payload uses the imported STAT opcode',()=>{
  assert.deepEqual([...buildFileInfoPayload(817)],[11,3,49]);
});

test('EP FILE_MOVE payload and response use the official three-u16 big-endian layout',()=>{
  assert.deepEqual([...buildFileMovePayload(7,1000,42)],[12,0,7,3,232,0,42]);
  assert.deepEqual(parseFileMoveResponse(Uint8Array.from([0,7,3,232,0,42])),{oldFileId:7,parentId:1000,newFileId:42});
  assert.throws(()=>buildFileMovePayload(7,1000,0x10000),/destination id must be a 16-bit integer/);
});

test('EP native FILE_MOVE mirrors TE timeout recovery and resolves FILE_INFO after init',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function moveFile');
  const end=source.indexOf('export async function setFileMetadata',start);
  const block=source.slice(start,end);
  assert.match(block,/\{timeout=2000,verifyCrc=false\}/);
  assert.match(block,/if\(verifyCrc\)[\s\S]*source sample CRC is unavailable/);
  assert.match(block,/if\(!isRequestTimeoutError\(error\)\)throw error/);
  assert.match(block,/await initFileSystemUnlocked\(\)/);
  assert.match(block,/const info=await getFileInfoUnlocked\(moved\.newFileId\)/);
  assert.ok(block.indexOf('await initFileSystemUnlocked()')<block.indexOf('getFileInfoUnlocked'));
});

test('EP FILE_PUT init targets the requested destination slot',()=>{
  const payload=buildFilePutInitPayload(127,42,1234,'kick 808',{channels:2,samplerate:46875,format:'s16'});
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

test('EP project TAR validator accepts a minimal safe EP-133 project',()=>{
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:validPadRecord()},
    {path:'patterns/a01',data:notePattern()}
  ]);
  const parsed=parseProjectArchive(tar);
  assert.equal(parsed.length,2);
  assert.deepEqual(validateProjectArchive(tar),{
    members:2,files:2,directories:0,pads:1,patterns:1,scenes:0,live:0,unknownFiles:0,profile:'ep133'
  });
});

test('EP project TAR validator blocks firmware-dangerous pattern and pad headers',()=>{
  const badPattern=notePattern();
  badPattern[0]=3;
  assert.throws(()=>validateProjectArchive(makeProjectTar([{path:'patterns/a01',data:badPattern}])),/nonzero pattern header byte 0/);
  const badPad=validPadRecord();
  badPad[0]=1;
  assert.throws(()=>validateProjectArchive(makeProjectTar([{path:'pads/a/p01',data:badPad}])),/nonzero validity byte/);
});

test('EP-133 project writes reject the unsafe 27-byte Sample-Tool pad form',()=>{
  const pad=new Uint8Array(27);
  pad.set(validPadRecord());
  assert.throws(()=>validateProjectArchive(makeProjectTar([{path:'pads/a/p01',data:pad}])),/pad-record size 27/);
});

test('EP project TAR validator clamps automation by rejecting values above 32767',()=>{
  const pattern=Uint8Array.from([0,1,1,0,0,0,1,0,0,0,0x80,0]);
  assert.throws(()=>validateProjectArchive(makeProjectTar([{path:'patterns/a01',data:pattern}])),/automation record 0 exceeds 32767/);
});

test('EP project TAR validator rejects partial-zero scenes, missing patterns, and invalid unused scene signatures',()=>{
  const partial=scenesWithA1();
  assert.throws(()=>validateProjectArchive(makeProjectTar([
    {path:'patterns/a01',data:notePattern()},
    {path:'scenes',data:partial}
  ])),/partial-zero group-pattern reference/);
  const missing=scenesWithA1();
  missing.set([1,1,1,1],7);
  assert.throws(()=>validateProjectArchive(makeProjectTar([{path:'scenes',data:missing}])),/references missing patterns\/a01/);
  const empty=scenesWithA1();
  empty[7]=0;
  empty[11]=0;
  empty[12]=0;
  assert.throws(()=>validateProjectArchive(makeProjectTar([{path:'scenes',data:empty}])),/does not retain the required 4\/4 signature/);
});

test('EP project TAR parser rejects corrupt header checksums',()=>{
  const tar=makeProjectTar([{path:'patterns/a01',data:notePattern()}]);
  tar[10]^=1;
  assert.throws(()=>parseProjectArchive(tar),/checksum mismatch/);
});

test('EP project capability matrix separates EP-133 EP-40 and unverified EP-1320 authoring',()=>{
  const ep133=getEpProjectProfile('TE032AS001','2.5.1');
  const ep40=getEpProjectProfile('TE032AS006','2.5.1');
  const medieval=getEpProjectProfile('TE032AS005','1.0.2');
  assert.equal(ep133.patternDialect,'ep133');
  assert.equal(ep133.padRecordSize,26);
  assert.equal(ep40.patternDialect,'ep40');
  assert.equal(ep40.patternHeaderSize,6);
  assert.equal(ep40.padRecordSize,29);
  assert.equal(ep40.supportsLoop,true);
  assert.equal(ep40.supportsSupertone,true);
  assert.equal(ep40.nativeLiveWithPatternsObserved,true);
  assert.equal(ep40.nativeLiveWithFxObserved,true);
  assert.equal(medieval.projectTransport,true);
  assert.equal(medieval.projectAuthoring,false);
  assert.equal(medieval.projectReloadVerified,false);
  assert.equal(assertProjectTransportSupported('TE032AS005','1.0.2').id,'ep1320');
  assert.throws(()=>assertProjectAuthoringSupported('TE032AS005','1.0.2'),/not been hardware-verified/);
  assert.throws(()=>assertProjectReloadSupported('TE032AS005','1.0.2'),/not hardware-verified/);
});

test('EP-40 project validator accepts native 29-byte pads and 6-byte patterns',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:validEp40PadRecord()},
    {path:'patterns/a01',data:ep40NotePattern()}
  ]);
  const report=validateProjectArchive(tar,{profile});
  assert.equal(report.profile,'ep40');
  assert.equal(report.pads,1);
  assert.equal(report.patterns,1);
  assert.throws(()=>validateProjectArchive(tar,{profile:getEpProjectProfile('TE032AS001','2.5.1')}),/pad-record size 29/);
});

test('EP project validator rejects patterns serialized after scenes',()=>{
  const scenes=scenesWithA1();
  scenes.set([1,1,1,1],7);
  const tar=makeProjectTar([
    {path:'scenes',data:scenes},
    {path:'patterns/a01',data:notePattern()},
    {path:'patterns/b01',data:notePattern()},
    {path:'patterns/c01',data:notePattern()},
    {path:'patterns/d01',data:notePattern()}
  ]);
  assert.throws(()=>validateProjectArchive(tar),/after scenes/);
});

test('native TAR patcher preserves unspecified members and inserts new patterns before scenes',()=>{
  const scenes=scenesWithA1();
  scenes.set([1,1,1,1],7);
  const base=makeProjectTar([
    {path:'pads',type:'5'},
    {path:'pads/a',type:'5'},
    {path:'pads/a/p01',data:validPadRecord()},
    {path:'patterns',type:'5'},
    {path:'patterns/a01',data:notePattern()},
    {path:'patterns/b01',data:notePattern()},
    {path:'patterns/c01',data:notePattern()},
    {path:'patterns/d01',data:notePattern()},
    {path:'scenes',data:scenes},
    {path:'vendor_future',data:Uint8Array.from([9,8,7,6])}
  ]);
  const newPattern=notePattern();newPattern[1]=2;
  const patched=patchProjectArchiveMembers(base,{'patterns/a02':newPattern});
  const members=parseProjectArchive(patched);
  const names=members.map(member=>member.path);
  assert.ok(names.indexOf('patterns/a02')<names.indexOf('scenes'));
  assert.deepEqual([...members.find(member=>member.path==='vendor_future').data],[9,8,7,6]);
  assert.deepEqual([...members.find(member=>member.path==='patterns/a02').data],[...newPattern]);
});

test('semantic pad builder rejects unverified nonzero trim start',()=>{
  const pad=validPadRecord();
  assert.throws(()=>patchPadRecord(pad,{trimStart:1}),/Nonzero project pad trimStart authoring is not hardware-verified/);
  assert.equal(new DataView(patchPadRecord(pad,{trimStart:0}).buffer).getUint32(4,true),0);
});

test('native pad patcher requires complete playback reset when assigning a different sample slot',()=>{
  const pad=validPadRecord();
  assert.throws(()=>patchPadRecord(pad,{slot:2}),/requires trimStart/);
  const patched=patchPadRecord(pad,{
    slot:2,trimStart:0,trimLength:48000,sampleBpm:120,amplitude:100,
    release:255,timeMode:0,playMode:0,rootNote:60
  });
  assert.equal(patched[1],2);
  assert.equal(new DataView(patched.buffer,patched.byteOffset,patched.byteLength).getUint32(8,true),48000);
});

test('project sample dependency preflight reports missing shared sounds without rejecting backups',()=>{
  const pad1=validPadRecord();
  const pad2=validPadRecord();pad2[1]=42;
  const empty=validPadRecord();empty[1]=0;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:pad1},
    {path:'pads/a/p02',data:pad2},
    {path:'pads/a/p03',data:empty}
  ]);
  assert.deepEqual(getProjectReferencedSampleSlots(tar),[1,42]);
  assert.deepEqual(
    preflightProjectSampleDependencies(tar,[1]),
    {referencedSampleSlots:[1,42],missingSampleSlots:[42],allSamplesAvailable:false}
  );
  assert.throws(()=>preflightProjectSampleDependencies(tar,[1],{strict:true}),/missing sample slots: 042/);
});

test('native project pad patch preserves the rest of the TAR',()=>{
  const base=makeProjectTar([
    {path:'pads/a/p01',data:validPadRecord()},
    {path:'vendor_future',data:Uint8Array.from([1,3,3,7])}
  ]);
  const patched=patchProjectPad(base,{
    group:'A',pad:1,slot:2,trimStart:0,trimLength:12345,sampleBpm:120,
    amplitude:100,release:255,timeMode:0,playMode:0,rootNote:60
  });
  const members=parseProjectArchive(patched);
  assert.equal(new DataView(members.find(member=>member.path==='pads/a/p01').data.buffer,
    members.find(member=>member.path==='pads/a/p01').data.byteOffset,26).getUint16(1,true),2);
  assert.deepEqual([...members.find(member=>member.path==='vendor_future').data],[1,3,3,7]);
});

test('unified Project Reader decodes verified EP-133 fields while preserving unknown native bytes',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const pad=validPadRecord();
  const padView=new DataView(pad.buffer);
  padView.setUint16(1,42,true);
  pad[3]=5;
  padView.setUint32(4,0,true);
  padView.setUint32(8,48000,true);
  padView.setFloat32(12,123.5,true);
  pad[16]=110;pad[17]=0xfe;pad[18]=0xfc;pad[19]=9;pad[20]=200;pad[21]=1;pad[22]=7;pad[23]=2;pad[24]=60;pad[25]=77;

  const pattern=Uint8Array.from([
    0,2,2,0x7f,
    0,0,1,5,0,0,64,0,
    24,0,16,64,100,48,0,31
  ]);
  const settings=new Uint8Array(224);
  settings.set([9,8,7,6],0);
  const settingsView=new DataView(settings.buffer);
  settingsView.setFloat32(4,126.5,true);
  for(let offset=24;offset<216;offset+=4)settingsView.setFloat32(offset,-1,true);
  settingsView.setFloat32(24+48+5*4,0.75,true);
  settings.set([3,4,1,5],216);
  settings.set([0,1,0xaa,0xbb],220);

  const fx=new Uint8Array(160);
  const fxView=new DataView(fx.buffer);
  fx[4]=2;
  fx.set([1,2,3,4],8);
  fxView.setFloat32(16,0.25,true);
  fxView.setFloat32(80,0.75,true);
  fxView.setFloat32(136,0.5,true);
  fxView.setFloat32(140,1,true);
  fxView.setFloat32(144,0.4,true);
  fxView.setFloat32(148,0.6,true);
  fxView.setUint16(152,0x8801,true);

  const scenes=scenesWithA1();
  scenes.set([1,1,1,1],7);
  const trailer=7+99*6;
  scenes[trailer+3]=1;
  scenes[trailer+11]=3;
  scenes.set([1,1,1],trailer+12);

  const tar=makeProjectTar([
    {path:'pads/a/p01',data:pad},
    {path:'patterns/a01',data:pattern},
    {path:'patterns/b01',data:notePattern()},
    {path:'patterns/c01',data:notePattern()},
    {path:'patterns/d01',data:notePattern()},
    {path:'scenes',data:scenes},
    {path:'settings',data:settings},
    {path:'fx_settings',data:fx},
    {path:'vendor_future',data:Uint8Array.from([4,3,2,1])}
  ]);

  const model=readProjectModel(tar,{profile});
  assert.equal(model.profile.id,'ep133');
  assert.equal(model.pads.a[0].sampleSlot,42);
  assert.equal(model.pads.a[0].midiChannel,5);
  assert.equal(model.pads.a[0].trimLength,48000);
  assert.equal(model.pads.a[0].pitch,-2);
  assert.equal(model.pads.a[0].pan,-4);
  assert.equal(model.pads.a[0].byte25,77);
  assert.equal(model.patterns[0].headerRecordCount,2);
  assert.deepEqual([...model.patterns[0].rawHeader],[0,2,2,0x7f]);
  assert.equal(model.patterns[0].automation[0].parameterName,'FX');
  assert.equal(model.patterns[0].automation[0].value,16384);
  assert.equal(model.patterns[0].notes[0].pad,3);
  assert.equal(model.patterns[0].notes[0].flag,31);
  assert.equal(model.scenes.currentScene,1);
  assert.deepEqual(model.scenes.song,[1,1,1]);
  assert.equal(model.settings.bpm,126.5);
  assert.equal(model.settings.faderAssignments.a.parameterName,'LPF');
  assert.equal(model.settings.groupFaders.b[5].value,0.75);
  assert.equal(Object.prototype.hasOwnProperty.call(model.settings,'scale'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(model.settings,'rootNote'),false);
  assert.deepEqual([...model.settings.disputedTailRaw],[0,1,0xaa,0xbb]);
  assert.equal(model.fxSettings.effectName,'reverb');
  assert.equal(model.fxSettings.sidechain.routing.a.destination,true);
  assert.deepEqual(model.fxSettings.sidechain.routing.a.sourcePads,[1,12]);
  assert.deepEqual([...model.unknownMembers[0].data],[4,3,2,1]);
  assert.deepEqual([...buildProjectFromModel(model)],[...tar]);
});

test('unified Project Reader decodes EP-40 native pattern and supertone deltas',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const pad=validEp40PadRecord();
  const padView=new DataView(pad.buffer);
  padView.setUint16(1,1002,true);
  pad[23]=3;
  pad[26]=50;
  pad[27]=123;
  pad[28]=45;
  const pattern=Uint8Array.from([
    1,3,0xff,0xff,2,0,
    0,0,1,0,0,0xfc,0x7f,8,
    24,0,0,60,127,24,0,6
  ]);
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:pad},
    {path:'patterns/a01',data:pattern}
  ]);
  const model=readProjectModel(tar,{profile});
  const decodedPad=model.pads.a[0];
  assert.equal(decodedPad.playMode,3);
  assert.deepEqual(decodedPad.supertone,{engine:2,symbol:1003,knobX:123,knobY:45});
  assert.equal(decodedPad.pitchFraction,50);
  assert.equal(model.patterns[0].headerSize,6);
  assert.equal(model.patterns[0].recordCount,2);
  assert.equal(model.patterns[0].automation[0].flag,8);
  assert.equal(model.patterns[0].automation[0].value,32764);
  assert.equal(model.patterns[0].notes[0].flag,6);
  assert.equal(model.uncertainties.sceneTimeSignaturePersistence,'unresolved');
  assert.deepEqual([...buildProjectFromModel(model)],[...tar]);
});

test('EP-40 Project Reader exposes live/LSS as read-only armed pad state',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const live=new Uint8Array(48);
  live[0]=1;live[11]=1;live[12]=1;live[47]=1;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:validEp40PadRecord()},
    {path:'live',data:live}
  ]);
  const model=readProjectModel(tar,{profile});
  assert.equal(model.live.groups.a[0].armed,true);
  assert.equal(model.live.groups.a[11].armed,true);
  assert.equal(model.live.groups.b[0].armed,true);
  assert.equal(model.live.groups.d[11].armed,true);
  assert.equal(model.patterns.length,0);
});

test('EP-40 native live plus populated patterns is accepted for read-only roundtrip but not promoted to authoring',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const live=new Uint8Array(48);live[0]=1;live[13]=1;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:validEp40PadRecord()},
    {path:'patterns/a01',data:ep40NotePattern()},
    {path:'live',data:live}
  ]);
  const report=validateProjectArchive(tar,{profile});
  assert.equal(report.patterns,1);
  assert.equal(report.live,1);
  const model=readProjectModel(tar,{profile});
  assert.equal(model.uncertainties.liveWithPatterns,'observed-native-readonly');
  assert.deepEqual([...buildProjectFromModel(model)],[...tar]);
  assert.throws(()=>buildProjectFromNative(tar,{live:{armedPads:[]}}, {profile}),/not enabled/);
});

test('EP-40 native live plus fx_settings is accepted for read-only roundtrip after HIL evidence',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const live=new Uint8Array(48);live[0]=1;
  const fx=new Uint8Array(160);fx[4]=2;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:validEp40PadRecord()},
    {path:'patterns/a01',data:ep40NotePattern()},
    {path:'live',data:live},
    {path:'fx_settings',data:fx}
  ]);
  const report=validateProjectArchive(tar,{profile});
  assert.equal(report.live,1);
  assert.equal(report.patterns,1);
  const model=readProjectModel(tar,{profile});
  assert.equal(model.uncertainties.liveWithPatterns,'observed-native-readonly');
  assert.equal(model.uncertainties.liveWithFx,'observed-native-readonly');
  assert.deepEqual([...buildProjectFromModel(model)],[...tar]);
  assert.throws(()=>buildProjectFromNative(tar,{live:{armedPads:[]}}, {profile}),/not enabled/);
});

test('Project Reader preserves unknown pattern records instead of inventing semantics',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const data=Uint8Array.from([0,1,1,0,0,0,3,9,8,7,6,5]);
  const member={path:'patterns/a01',data,header:new Uint8Array(512)};
  const pattern=readProjectPattern(member,{profile});
  assert.equal(pattern.notes.length,0);
  assert.equal(pattern.automation.length,0);
  assert.equal(pattern.unknownRecords.length,1);
  assert.deepEqual([...pattern.unknownRecords[0].raw],[0,0,3,9,8,7,6,5]);
});

test('Project Reader requires an explicit verified EP-133 or EP-40 profile',()=>{
  const tar=makeProjectTar([{path:'patterns/a01',data:notePattern()}]);
  assert.throws(()=>readProjectModel(tar),/requires an explicit EP-133 or EP-40/);
  assert.throws(()=>readProjectModel(tar,{profile:getEpProjectProfile('TE032AS005','1.0.2')}),/enabled only for EP-133 and EP-40/);
});

test('Sequencer Core edits EP-133 notes surgically and preserves native flags and header byte 3',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const pattern=Uint8Array.from([
    0,2,2,0x7f,
    0,0,1,5,0,0,64,0,
    24,0,16,64,100,24,0,31
  ]);
  const tar=makeProjectTar([{path:'patterns/a01',data:pattern}]);
  const model=readProjectModel(tar,{profile});
  const sequencer=createProjectSequencer(model);
  sequencer.editNote('A01','r1',{velocity:91,duration:48});
  const built=sequencer.buildArchive();
  const decoded=readProjectModel(built,{profile}).patterns[0];
  assert.deepEqual([...decoded.rawHeader],[0,2,2,0x7f]);
  assert.equal(decoded.automation[0].value,16384);
  assert.equal(decoded.automation[0].flag,0);
  assert.equal(decoded.notes[0].velocity,91);
  assert.equal(decoded.notes[0].duration,48);
  assert.equal(decoded.notes[0].flag,31);
});

test('Sequencer Core sorts generated records by hardware-proven tick ordering',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const pattern=Uint8Array.from([
    0,1,1,0,
    24,0,0,60,100,24,0,8
  ]);
  const model=readProjectModel(makeProjectTar([{path:'patterns/a01',data:pattern}]),{profile});
  const sequencer=createProjectSequencer(model);
  sequencer.addNote('A01',{tick:0,pad:2,note:62,velocity:90,duration:12});
  sequencer.addAutomation('A01',{tick:0,parameter:5,value:20000});
  const decoded=readProjectModel(sequencer.buildArchive(),{profile}).patterns[0];
  assert.deepEqual(decoded.records.map(record=>[record.kind,record.tick]),[
    ['automation',0],['note',0],['note',24]
  ]);
  assert.equal(decoded.records[0].flag,0);
  assert.equal(decoded.records[1].flag,0);
  assert.equal(decoded.records[2].flag,8);
});

test('Sequencer Core blocks structural edits when a pattern contains unknown native records',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const pattern=Uint8Array.from([
    0,1,2,0,
    0,0,3,9,8,7,6,5,
    24,0,0,60,100,24,0,31
  ]);
  const model=readProjectModel(makeProjectTar([{path:'patterns/a01',data:pattern}]),{profile});
  const sequencer=createProjectSequencer(model);
  sequencer.editNote('A01','r1',{velocity:80});
  assert.throws(()=>sequencer.editNote('A01','r1',{tick:48}),/unknown native records/);
  assert.throws(()=>sequencer.addNote('A01',{tick:0,pad:1,note:60,velocity:100,duration:24}),/unknown native records/);
  assert.throws(()=>sequencer.removeNote('A01','r1'),/unknown native records/);
  const decoded=readProjectModel(sequencer.buildArchive(),{profile}).patterns[0];
  assert.deepEqual([...decoded.unknownRecords[0].raw],[0,0,3,9,8,7,6,5]);
  assert.equal(decoded.notes[0].velocity,80);
  assert.equal(decoded.notes[0].flag,31);
});

test('Sequencer Core preserves EP-40 six-byte headers and native automation flags',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const pattern=Uint8Array.from([
    1,3,0xff,0xff,2,0,
    0,0,1,0,0,0xfc,0x7f,8,
    24,0,0,60,127,24,0,6
  ]);
  const model=readProjectModel(makeProjectTar([{path:'patterns/a01',data:pattern}]),{profile});
  const sequencer=createProjectSequencer(model);
  sequencer.editNote('A01','r1',{velocity:99});
  sequencer.addAutomation('A01',{tick:24,parameter:5,value:1234});
  const decoded=readProjectModel(sequencer.buildArchive(),{profile}).patterns[0];
  assert.deepEqual([...decoded.rawHeader],[1,3,0xff,0xff,3,0]);
  assert.equal(decoded.automation.find(item=>item.value===32764).flag,8);
  assert.equal(decoded.automation.find(item=>item.value===1234).flag,0);
  assert.equal(decoded.notes[0].flag,6);
  assert.equal(decoded.notes[0].velocity,99);
});

test('Sequencer Core preserves native EP-40 scene time signature when editing refs and gates new time-signature authoring',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const p=ep40NotePattern();
  const scenes=scenesWithA1();
  scenes.set([1,1,1,1,6,4],7);
  const tar=makeProjectTar([
    {path:'patterns/a01',data:p},
    {path:'patterns/b01',data:p},
    {path:'patterns/c01',data:p},
    {path:'patterns/d01',data:p},
    {path:'scenes',data:scenes}
  ]);
  const sequencer=createProjectSequencer(readProjectModel(tar,{profile}));
  sequencer.setScene(1,{groupPatterns:[1,1,1,1]});
  const decoded=readProjectModel(sequencer.buildArchive(),{profile});
  assert.deepEqual(decoded.scenes.entries[0].timeSignature,{numerator:6,denominator:4});
  assert.throws(
    ()=>sequencer.setScene(1,{groupPatterns:[1,1,1,1],timeSignature:[4,4]}),
    /EP-40 scene time-signature authoring remains unresolved/
  );
});

test('Sequencer Core patches verified project controls over native EP-133 templates',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const pad=validPadRecord();
  const scenes=scenesWithA1();scenes.set([1,1,1,1],7);scenes[7+99*6+3]=1;
  const settings=new Uint8Array(222);
  const sv=new DataView(settings.buffer);
  sv.setFloat32(4,120,true);
  for(let offset=24;offset<216;offset+=4)sv.setFloat32(offset,-1,true);
  settings[220]=0;settings[221]=1;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:pad},
    {path:'patterns/a01',data:notePattern()},
    {path:'patterns/b01',data:notePattern()},
    {path:'patterns/c01',data:notePattern()},
    {path:'patterns/d01',data:notePattern()},
    {path:'scenes',data:scenes},
    {path:'settings',data:settings}
  ]);
  const sequencer=createProjectSequencer(readProjectModel(tar,{profile}));
  sequencer.setBpm(128);
  sequencer.setGroupFader({group:'A',parameter:5,baseValue:0.5});
  sequencer.setCurrentScene(1);
  sequencer.setSong([1]);
  sequencer.assignPad({
    group:'A',pad:1,slot:2,trimStart:0,trimLength:48000,sampleBpm:120,
    amplitude:100,release:255,timeMode:0,playMode:0,rootNote:60
  });
  const {readBuiltModel}=sequencer;
  const decoded=readBuiltModel();
  assert.equal(decoded.settings.bpm,128);
  assert.equal(decoded.settings.faderAssignments.a.parameter,5);
  assert.equal(decoded.settings.groupFaders.a[5].value,0.5);
  assert.equal(decoded.scenes.currentScene,1);
  assert.deepEqual(decoded.scenes.song,[1]);
  assert.equal(decoded.pads.a[0].sampleSlot,2);
  assert.equal(decoded.pads.a[0].trimLength,48000);
});

test('read-only HIL archive audit roundtrips EP-133 and reports missing sample dependencies',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const pad1=validPadRecord();
  const pad2=validPadRecord();new DataView(pad2.buffer).setUint16(1,42,true);
  const unknownPattern=Uint8Array.from([
    0,1,2,0,
    0,0,3,9,8,7,6,5,
    24,0,0,60,100,24,0,31
  ]);
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:pad1},
    {path:'pads/a/p02',data:pad2},
    {path:'patterns/a01',data:unknownPattern}
  ]);
  const audit=auditProjectArchiveBytes(tar,{profile,occupiedSlots:[1]});
  assert.equal(audit.roundtripByteExact,true);
  assert.equal(audit.pads.assigned,2);
  assert.equal(audit.patterns.unknownRecords,1);
  assert.deepEqual(audit.sampleDependencies.referencedSampleSlots,[1,42]);
  assert.deepEqual(audit.sampleDependencies.missingSampleSlots,[42]);
});

test('read-only HIL audit accepts observed native EP-40 live plus patterns plus fx_settings',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const live=new Uint8Array(48);live[0]=1;
  const fx=new Uint8Array(160);fx[4]=1;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:validEp40PadRecord()},
    {path:'patterns/a01',data:ep40NotePattern()},
    {path:'live',data:live},
    {path:'fx_settings',data:fx}
  ]);
  const audit=auditProjectArchiveBytes(tar,{profile,occupiedSlots:[1]});
  assert.equal(audit.roundtripByteExact,true);
  assert.equal(audit.livePresent,true);
  assert.equal(audit.fxSettingsPresent,true);
  assert.equal(audit.uncertainties.liveWithFx,'observed-native-readonly');
});

test('read-only HIL audit accepts observed native EP-40 live plus patterns and stays byte-exact',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const live=new Uint8Array(48);live[0]=1;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:validEp40PadRecord()},
    {path:'patterns/a01',data:ep40NotePattern()},
    {path:'live',data:live}
  ]);
  const audit=auditProjectArchiveBytes(tar,{profile,occupiedSlots:[1]});
  assert.equal(audit.roundtripByteExact,true);
  assert.equal(audit.livePresent,true);
  assert.equal(audit.patterns.count,1);
  assert.equal(audit.uncertainties.liveWithPatterns,'observed-native-readonly');
});

test('read-only HIL archive audit understands EP-40 supertone without treating it as a missing PCM sample',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const pad=validEp40PadRecord();
  const view=new DataView(pad.buffer);
  view.setUint16(1,1004,true);
  pad[23]=3;pad[27]=111;pad[28]=222;
  const tar=makeProjectTar([
    {path:'pads/a/p01',data:pad},
    {path:'patterns/a01',data:ep40NotePattern()}
  ]);
  const audit=auditProjectArchiveBytes(tar,{profile,occupiedSlots:[]});
  assert.equal(audit.roundtripByteExact,true);
  assert.equal(audit.pads.supertoneAssignments,1);
  assert.deepEqual(audit.sampleDependencies.referencedSampleSlots,[]);
  assert.equal(audit.sampleDependencies.allSamplesAvailable,true);
});

test('read-only project HIL path stays mutation-free and session-guarded',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/projectHil.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function auditConnectedEpProjects');
  const end=source.indexOf('const activeFromMetadata',start);
  const block=source.slice(start,end);
  assert.match(block,/passiveFirmwareDebugPreflight\(1200,'read-only project HIL'\)/);
  assert.match(block,/const files=await listDeviceFiles\(\)/);
  assert.match(block,/const file=await getFile\(node\.nodeId\)/);
  assert.match(block,/getDeviceSessionToken\(\)!==sessionToken/);
  assert.doesNotMatch(block,/uploadProjectArchive|deleteFile|moveFile|setFileMetadata|requestFile|putFile/);
  assert.doesNotMatch(block,/Promise\.all\([^)]*getFile/);
});

test('no-op project write HIL requires exact destructive acknowledgement and an inactive empty scratch slot',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/projectHil.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function runProjectNoopWriteHil');
  const block=source.slice(start);
  assert.match(block,/const expectedAck='ERASE PROJECT '\+number/);
  assert.match(block,/beforeActive===target\.nodeId/);
  assert.match(block,/Scratch project is not empty enough/);
  assert.match(block,/triggerCheckpointDownload/);
  assert.match(block,/performReload:false/);
  assert.match(block,/if\(!internalBackupMatched\)throw new Error\('Upload transaction checkpoint changed between preflight and write\.'\)/);
  assert.match(block,/readbackByteExact/);
  assert.match(block,/activeProjectUnchanged/);
});

test('project upload can verify PUT/readback without activating or reloading the project',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function uploadProjectArchive');
  const end=source.indexOf('export async function downloadProjectArchive',start);
  const block=source.slice(start,end);
  assert.match(block,/performReload=true/);
  assert.match(block,/profile\.projectReloadVerified&&performReload/);
  assert.match(block,/const reload=profile\.projectReloadVerified&&performReload/);
});

test('semantic pattern encoder emits verified EP-133 and EP-40 dialects',()=>{
  const ep133=getEpProjectProfile('TE032AS001','2.5.1');
  const ep40=getEpProjectProfile('TE032AS006','2.5.1');
  const spec={
    bars:2,
    events:[{tick:24,pad:3,note:60,velocity:100,duration:24}],
    automation:[{tick:0,parameter:5,value:16384}]
  };
  const a=encodePatternMember(spec,{profile:ep133});
  assert.deepEqual([...a.slice(0,4)],[0,2,2,0]);
  assert.deepEqual([...a.slice(4,12)],[0,0,1,5,0,0,64,0]);
  assert.equal(a[12+2],16);
  const b=encodePatternMember(spec,{profile:ep40});
  assert.deepEqual([...b.slice(0,6)],[1,2,255,255,2,0]);
  assert.deepEqual([...b.slice(6,14)],[0,0,1,5,0,0,64,0]);
  assert.throws(()=>encodePatternMember({events:[{tick:0,pad:1,note:60,velocity:100,duration:24,flag:255}]},{profile:ep133}),/flags must be 0/);
});

test('semantic scenes patch changes only verified chunks cursor and song bytes',()=>{
  const base=scenesWithA1();
  base.set([1,1,1,1],7);
  base[606]=77;
  const patched=patchScenesMember(base,{
    entries:[
      {index:1,groupPatterns:[2,2,2,2],timeSignature:[6,4]},
      {index:2,groupPatterns:[1,1,1,1],timeSignature:[4,4]}
    ],
    currentScene:2,
    song:[2,1,2]
  });
  assert.deepEqual([...patched.slice(7,13)],[2,2,2,2,6,4]);
  assert.deepEqual([...patched.slice(13,19)],[1,1,1,1,4,4]);
  const trailer=7+99*6;
  assert.equal(patched[trailer+3],2);
  assert.equal(patched[trailer+11],3);
  assert.deepEqual([...patched.slice(trailer+12,trailer+15)],[2,1,2]);
  assert.equal(patched[606],77);
});

test('native project validation preserves observed but undecoded pattern/settings header bytes',()=>{
  const pattern=notePattern();
  pattern[3]=0x7f;
  const settings=new Uint8Array(224);
  settings.set([9,8,7,6],0);
  const view=new DataView(settings.buffer);
  view.setFloat32(4,120,true);
  for(let offset=24;offset<216;offset+=4)view.setFloat32(offset,-1,true);
  const tar=makeProjectTar([
    {path:'patterns/a01',data:pattern},
    {path:'settings',data:settings}
  ]);
  const report=validateProjectArchive(tar);
  assert.equal(report.patterns,1);
  const patched=patchSettingsMember(settings,{bpm:130});
  assert.deepEqual([...patched.slice(0,4)],[9,8,7,6]);
});

test('settings patch preserves unknown bytes while changing only decoded fields',()=>{
  const settings=new Uint8Array(224);
  const view=new DataView(settings.buffer);
  view.setFloat32(4,120,true);
  for(let offset=24;offset<216;offset+=4)view.setFloat32(offset,-1,true);
  settings[220]=9;settings[221]=8;settings[222]=7;settings[223]=6;
  const patched=patchSettingsMember(settings,{
    bpm:140,
    groupFaders:[{group:'B',parameter:5,baseValue:0.75}]
  });
  const pv=new DataView(patched.buffer,patched.byteOffset,patched.byteLength);
  assert.equal(pv.getFloat32(4,true),140);
  assert.equal(patched[217],5);
  assert.ok(Math.abs(pv.getFloat32(24+48+5*4,true)-0.75)<1e-6);
  assert.deepEqual([...patched.slice(220,224)],[9,8,7,6]);
});

test('FX patch preserves unknown banks and authors only verified fields',()=>{
  const fx=new Uint8Array(160);
  fx[4]=1;
  fx[8]=123;
  const patched=patchFxSettingsMember(fx,{
    type:2,parameter1:0.25,parameter2:0.75,
    outputCompressor:{drive:0.5,speed:1},
    sidechain:{length:0.4,routing:{A:{destination:true,sourcePads:[1,12]}}}
  });
  const view=new DataView(patched.buffer,patched.byteOffset,patched.byteLength);
  assert.equal(patched[4],2);
  assert.equal(patched[8],123);
  assert.ok(Math.abs(view.getFloat32(16,true)-0.25)<1e-6);
  assert.ok(Math.abs(view.getFloat32(80,true)-0.75)<1e-6);
  assert.equal(view.getUint16(152,true),0x8801);
  assert.throws(()=>patchFxSettingsMember(fx,{sidechain:{shape:0.5}}),/not yet hardware-verified/);
});

test('safe semantic builder requires native templates for scenes settings and FX',()=>{
  const base=makeProjectTar([
    {path:'pads/a/p01',data:validPadRecord()},
    {path:'patterns/a01',data:notePattern()}
  ]);
  assert.throws(()=>buildProjectFromNative(base,{scenes:{entries:[]}}),/requires a native scenes member/);
  assert.throws(()=>buildProjectFromNative(base,{settings:{bpm:130}}),/requires a native device-written settings member/);
  assert.throws(()=>buildProjectFromNative(base,{fxSettings:{type:1}}),/requires a native device-written fx_settings member/);
  assert.throws(()=>buildProjectFromNative(base,{live:{armedPads:[]}}),/not enabled/);
});

test('safe semantic builder patches native project and inserts authored patterns before scenes',()=>{
  const scenes=scenesWithA1();
  scenes.set([1,1,1,1],7);
  const settings=new Uint8Array(222);
  const sv=new DataView(settings.buffer);
  sv.setFloat32(4,120,true);
  for(let offset=24;offset<216;offset+=4)sv.setFloat32(offset,-1,true);
  const base=makeProjectTar([
    {path:'pads/a/p01',data:validPadRecord()},
    {path:'patterns/a01',data:notePattern()},
    {path:'patterns/b01',data:notePattern()},
    {path:'patterns/c01',data:notePattern()},
    {path:'patterns/d01',data:notePattern()},
    {path:'scenes',data:scenes},
    {path:'settings',data:settings},
    {path:'vendor_future',data:Uint8Array.from([5,4,3,2,1])}
  ]);
  const built=buildProjectFromNative(base,{
    patterns:[{
      id:'A02',bars:2,
      events:[{tick:0,pad:1,note:60,velocity:110,duration:24}]
    }],
    scenes:{entries:[{index:1,groupPatterns:[2,1,1,1],timeSignature:[4,4]}],currentScene:1,song:[1]},
    settings:{bpm:128}
  });
  const members=parseProjectArchive(built);
  const names=members.map(member=>member.path);
  assert.ok(names.indexOf('patterns/a02')<names.indexOf('scenes'));
  assert.equal(new DataView(members.find(member=>member.path==='settings').data.buffer,
    members.find(member=>member.path==='settings').data.byteOffset,222).getFloat32(4,true),128);
  assert.deepEqual([...members.find(member=>member.path==='vendor_future').data],[5,4,3,2,1]);
  assert.equal(validateProjectArchive(built).patterns,5);
});

test('EP project readback comparison tolerates firmware-added members but verifies candidate payloads',()=>{
  const expected=makeProjectTar([
    {path:'pads/a/p01',data:validPadRecord()},
    {path:'patterns/a01',data:notePattern()}
  ]);
  const extraPad=validPadRecord();extraPad[1]=2;
  const actual=makeProjectTar([
    {path:'pads',type:'5'},
    {path:'pads/a/p01',data:validPadRecord()},
    {path:'pads/a/p02',data:extraPad},
    {path:'patterns/a01',data:notePattern()}
  ]);
  assert.equal(compareProjectArchiveMembers(expected,actual).matched,2);
});

test('EP project readback comparison rejects payload changes in candidate members',()=>{
  const expected=makeProjectTar([{path:'patterns/a01',data:notePattern()}]);
  const changed=notePattern();changed[4]=24;
  const actual=makeProjectTar([{path:'patterns/a01',data:changed}]);
  assert.throws(()=>compareProjectArchiveMembers(expected,actual),/payload mismatch.*patterns\/a01/);
});

test('EP project upload checkpoints, verifies, reloads, and rolls back in guarded order',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function uploadProjectArchive');
  const end=source.indexOf('export async function downloadProjectArchive',start);
  const block=source.slice(start,end);
  assert.match(block,/withStrictFirmwareDebugGuard/);
  assert.match(block,/const backup=await getFileUnlocked\(destination\.nodeId\)/);
  assert.match(block,/await onBackup\?\.\(/);
  assert.match(block,/const readback=await getFileUnlocked\(destination\.nodeId\)/);
  assert.match(block,/compareProjectArchiveMembers\(data,readback\.data\)/);
  assert.match(block,/reloadProjectUnlocked\(destination\.nodeId,parent\.nodeId/);
  assert.match(block,/compareProjectArchiveMembers\(backup\.data,restored\.data\)/);
  assert.match(block,/error\.projectRollbackSucceeded=true/);
  assert.match(block,/if\(!candidateWritten\|\|isDeviceUnsafe\(\)\)throw error/);
  assert.ok(block.indexOf('const backup=await getFileUnlocked')<block.indexOf('await putFileUnlocked'));
  assert.ok(block.indexOf('compareProjectArchiveMembers(data,readback.data)')<block.indexOf('const reload=profile.projectReloadVerified'));
});

test('EP project reload cycles active project and verifies project group and pad metadata',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('async function reloadProjectUnlocked');
  const end=source.indexOf('export async function reloadProjectArchive',start);
  const block=source.slice(start,end);
  assert.match(block,/setFileMetadataUnlocked\(projectsNodeId,\{active:cycledProject\}\)/);
  assert.match(block,/await sleep\(200\)/);
  assert.match(block,/setFileMetadataUnlocked\(projectsNodeId,\{active:projectId\}\)/);
  assert.match(block,/const activeProject=await getActiveNodeUnlocked\(projectsNodeId\)/);
  assert.match(block,/setFileMetadataUnlocked\(groupRootId,\{active:activeGroup\}\)/);
  assert.match(block,/setFileMetadataUnlocked\(activeGroup,\{active:activePad\}\)/);
});

test('EP guarded firmware debug mode escalates debug SysEx only during strict transactions',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/device.js',import.meta.url),'utf8');
  assert.match(source,/let strictFirmwareDebugDepth=0/);
  assert.match(source,/if\(strictFirmwareDebugDepth>0\)enterUnsafeState\('Firmware debug SysEx during '/);
  assert.match(source,/export async function withStrictFirmwareDebugGuard/);
});



test('EP low-level FILE_PUT filename field keeps raw text but caps it at 54 characters',()=>{
  const longName='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789';
  const payload=buildFilePutInitPayload(7,42,12,longName,null);
  const end=payload.indexOf(0,11);
  assert.equal(end-11,54);
  assert.equal(new TextDecoder().decode(payload.slice(11,end)),longName.slice(0,54));
});

test('EP-1320 project transport stays opaque while semantic validation and reload remain blocked',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function uploadProjectArchive');
  const end=source.indexOf('export async function downloadProjectArchive',start);
  const block=source.slice(start,end);
  assert.match(block,/const profile=connectedProjectProfile\('transport'\)/);
  assert.match(block,/if\(profile\.projectAuthoring\)validateProjectArchive\(data,\{profile\}\);\s*else parseProjectArchive\(data\)/);
  assert.match(block,/sampleDependencies=profile\.projectAuthoring/);
  assert.match(block,/const activation=profile\.projectReloadVerified/);
  assert.match(block,/const reload=profile\.projectReloadVerified/);
  assert.match(block,/:null;/);
});

test('EP project archive upload uses the TE 15s timeout and unlocked PUT primitive',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function uploadProjectArchive');
  const end=source.indexOf('export async function downloadProjectArchive',start);
  const block=source.slice(start,end);
  assert.match(block,/uploadProjectArchive\(file,\{onProgress,timeout=15000,cycleReload=true,onBackup\}=\{\}\)/);
  assert.match(block,/const profile=connectedProjectProfile\('transport'\)/);
  assert.match(block,/validateProjectArchive\(data,\{profile\}\)/);
  assert.match(block,/preflightProjectSampleDependencies\(data,occupiedSampleSlots,\{profile\}\)/);
  assert.ok(block.indexOf('validateProjectArchive(data,{profile})')<block.indexOf('await initRead()'));
  assert.match(block,/await putFileUnlocked\(/);
  assert.doesNotMatch(block,/await putFile\(/);
});

test('EP small metadata framing matches TE charCode byte semantics',()=>{
  const metadata={name:'привет',description:'café'};
  const json=JSON.stringify(metadata);
  const expected=Uint8Array.from([...json].map(char=>char.charCodeAt(0)&0xff));
  const put=buildFilePutInitPayload(7,42,12,'kick',metadata);
  const putNameEnd=11+'kick'.length+1;
  assert.deepEqual([...put.slice(putNameEnd)],[...expected]);
  assert.notEqual(put.at(-1),0);
  const set=buildMetadataSetPayload(7,metadata);
  assert.deepEqual([...set.slice(4,-1)],[...expected]);
  assert.equal(set.at(-1),0);
});

test('EP FILE_GET rejects missing, empty, wrong, and oversized pages',()=>{
  assert.throws(()=>validateFileGetChunk(new Uint8Array(),0,10),/Invalid FILE_GET response/);
  assert.throws(()=>validateFileGetChunk(Uint8Array.from([0,0]),0,10),/Empty FILE_GET response/);
  assert.throws(()=>validateFileGetChunk(Uint8Array.from([0,1,9]),0,10),/Unexpected page/);
  assert.throws(()=>validateFileGetChunk(Uint8Array.from([0,0,1,2,3]),0,2),/exceeds the declared file size/);
  assert.deepEqual([...validateFileGetChunk(Uint8Array.from([0,0,1,2]),0,3)],[1,2]);
  assert.deepEqual([...validateFileGetChunk(Uint8Array.from([0,0,1,2,3]),0,3)],[1,2,3]);
});

test('EP FILE_PUT init timeout fails closed before streaming pages',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const start=source.indexOf('async function putFileUnlocked');
  const end=source.indexOf('export async function putFile',start);
  const block=source.slice(start,end);
  assert.match(block,/init=await requestFile\(TE_SYSEX_FILE,buildFilePutInitPayload/);
  assert.match(block,/if\(isRequestTimeoutError\(error\)\)markDeviceUnsafe\('FILE_PUT init timed out after request dispatch; device write state is unknown:/);
  assert.ok(block.indexOf('markDeviceUnsafe')<block.indexOf('streamOpened=true'));
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


test('My EP rechecks each upload target before PUT without downloading PCM back afterward',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  const start=source.indexOf('async function uploadFilesToSlot');
  const block=source.slice(start,source.indexOf('const readDevice=async',start));
  assert.match(block,/await assertSlotsEmpty\(\[target\.id\]\)/);
  assert.doesNotMatch(block,/verifyPcmReadback\(fileId,prepared\.data/);
  assert.match(block,/const info=await getFileInfo\(fileId\)/);
  assert.match(block,/onCreated:id=>\{createdId=Number\(id\)\|\|target\.id;item\.createdId=createdId;\}/);
});

test('My EP pastes and drops audio into the shared forward-only uploader',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/clipboardData\?\.items/);
  assert.match(source,/window\.addEventListener\('paste'/);
  assert.match(source,/const slot=memory\.getSelected\(\)/);
  assert.match(source,/uploadFilesToSlot\(slot,files\)/);
  assert.match(source,/onDrop:async\(slot,event\)=>uploadFilesToSlot\(slot,getDroppedFiles\(event\)\)/);
  assert.match(source,/const destinationId=memory\.findNextFree\(searchFrom\)/);
  assert.match(source,/searchFrom=destinationId\+1/);
});

test('My EP stops the previous preview before starting the newly selected sample',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/if\(playingSlotId\)await stopCurrentPreview\(\)/);
  assert.match(source,/await startPlayback\(nodeId,true\)/);
  assert.match(source,/memory\.setPreviewing\(slot\.id\)/);
  assert.doesNotMatch(source,/playbackThrottleTimer/);
});

test('My EP exposes row delete only for a deletable selected sample',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.match(source,/slot\.node\?\.isDeletable===true\?'<button type="button" data-delete-row/);
  assert.match(source,/selectedFiles\(\)\.filter\(item=>item\.node\?\.isDeletable===true\)/);
});

test('My EP confirms one multi-delete and deletes selected samples sequentially',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/DELETE '\+targets\.length\+' SELECTED SAMPLES\?/);
  assert.match(source,/if\(!await confirmAction\(message\)\)return false/);
  assert.match(source,/for\(let index=0;index<targets\.length;index\+\+\)[\s\S]*await deleteFile\(slot\.nodeId\|\|slot\.id\)/);
});

test('My EP uses Explorer-style Shift range and Ctrl/Cmd additive selection',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.match(source,/const additive=!!\(event\?\.ctrlKey\|\|event\?\.metaKey\)/);
  assert.match(source,/const extend=!!event\?\.shiftKey/);
  assert.match(source,/Array\.from\(\{length:end-start\+1\}/);
  assert.match(source,/if\(additive\)\{/);
});

test('EP library mouse wheel is native scrolling and never changes selection',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/addEventListener\('wheel'/);
  assert.doesNotMatch(source,/wheelDelta/);
});

test('EP library Page Up/Down switches folder tabs while Home/End remain unused',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.match(source,/event\.key==='PageUp'\|\|event\.key==='PageDown'/);
  assert.match(source,/changeTab\(event\.key==='PageUp'\?-1:1\)/);
  assert.doesNotMatch(source,/event\.altKey/);
  assert.doesNotMatch(source,/event\.key==='Home'/);
  assert.doesNotMatch(source,/event\.key==='End'/);
});

test('readonly EP sample name input permits list navigation while editable inputs capture keys',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.match(source,/active\?\.tagName==='INPUT'&&!active\.matches\?\.\('\.ep133-sample-name-input\[readonly\]'\)/);
  assert.match(source,/maxlength="16"/);
});

test('My EP single-sample reorder targets only the exact dropped slot',()=>{
  const slots=createSampleSlots([
    {nodeId:20,fileName:'/sounds/020.pcm',fileSize:10},
    {nodeId:21,fileName:'/sounds/021.pcm',fileSize:10},
    {nodeId:22,fileName:'/sounds/022.pcm',fileSize:10}
  ]);
  assert.deepEqual(planSampleTransferTargets(slots,[10],10,20),[]);
  assert.deepEqual(planSampleTransferTargets(slots,[10],10,19),[{sourceId:10,targetId:19}]);
  assert.deepEqual(
    planSampleTransferTargets(slots,[10,12,13],10,20),
    [{sourceId:10,targetId:23},{sourceId:12,targetId:25},{sourceId:13,targetId:26}]
  );
});

test('My EP Properties uses source-backed enums, debounced writes, playmode release pairing, and readback',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/const modes=activeDeviceProfile\.playModes/);
  assert.match(source,/const TIME_MODES=\['off','bpm','bar'\]/);
  assert.match(source,/const BAR_VALUES=\[1,2\]/);
  assert.match(source,/const PROPERTY_DEBOUNCE_MS=120/);
  assert.match(source,/payload\['envelope\.release'\]=Number\.isFinite\(release\)\?release:255/);
  assert.match(source,/await setFileMetadata\(slot\.nodeId\|\|slot\.id,payload\)/);
  assert.match(source,/const readback=await getFileMetadata\(slot\.nodeId\|\|slot\.id\)/);
  assert.match(source,/if\(!matches\)throw new Error\('EP did not confirm sample property '\+key\+'\.'\)/);
});
test('My EP blocks unverified Medieval Properties and MOVE/COPY at the UI boundary',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/!activeDeviceProfile\.advancedSampleMetadataWrites/);
  assert.match(source,/SAMPLE PROPERTIES ARE NOT VERIFIED FOR/);
  assert.match(source,/!activeDeviceProfile\.sampleTransfers/);
  assert.match(source,/MOVE\/COPY SAMPLE METADATA IS NOT VERIFIED FOR/);
  assert.match(source,/allowAdvancedMetadata:activeDeviceProfile\.advancedSampleMetadataWrites/);
});


test('My EP header shows model once in the title and only the human product name below',async()=>{
  const fs=await import('node:fs/promises');
  const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.deepEqual([getEpDeviceProfile('TE032AS001').title,getEpDeviceProfile('TE032AS001').name],['MY EP-133','K.O. II']);
  assert.deepEqual([getEpDeviceProfile('TE032AS005').title,getEpDeviceProfile('TE032AS005').name],['MY EP-1320','MEDIEVAL']);
  assert.deepEqual([getEpDeviceProfile('TE032AS006').title,getEpDeviceProfile('TE032AS006').name],['MY EP-40','RIDDIM']);
  assert.doesNotMatch(html,/id="ep133-device">MY EP-133/);
});

test('My EP is sample-only and uses SLOT NAME SIZE CH RATE columns',async()=>{
  const fs=await import('node:fs/promises');
  const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/ep133-files-tab/);
  assert.doesNotMatch(html,/DEVICE FILE SYSTEM/);
  assert.match(html,/SLOT<\/span><span>NAME<\/span><span>SIZE<\/span><span>CH<\/span><span>RATE/);
  assert.doesNotMatch(html,/SLOT<\/span><span>NAME<\/span><span>SIZE<\/span><span>FORMAT/);
});

test('My EP multi-download emits individual WAV downloads instead of ZIP',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  assert.match(source,/for\(let index=0;index<selectedSlots\.length;index\+\+\)[\s\S]*performDownload\(selectedSlots\[index\]/);
  assert.doesNotMatch(source,/createZip/);
  assert.doesNotMatch(source,/samples\.zip/);
});

test('My EP search highlights matches without filtering the current folder rows',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  assert.match(source,/const visible=\(\)=>\{[\s\S]*slots\.slice\(tab\.range\[0\]-1,tab\.range\[1\]\)/);
  assert.match(source,/matchesSearch\(slot\)\?' search-match'/);
  assert.doesNotMatch(source,/\.filter\(slot=>\{\s*if\(!query/);
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
  assert.equal(normalizeFileName('001 Kick 808.wav'),'001 kick 808');
  assert.equal(normalizeFileName('001 Kick 808.wav',true),'kick 808');
  assert.equal(normalizeFileName('Snärë/Bad\\Name.wav'),'snarebadname');
  assert.equal(normalizeFileName('Long sample filename here.wav'),'long sa.ame here');
});

import{getTargetSampleRate,parseWavAudioMeta,parseKo2Metadata,prepareTeenageMetadata,buildEp133DownloadAudioMeta}from '../js/ep133/audio.js';

test('EP audio pipeline binds the local resampler module and has no stale fallback reference',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/audio.js',import.meta.url),'utf8');
  assert.match(source,/const resampler=await getLibSampleRateModule\(\)/);
  assert.match(source,/resampler\.getAudioMeta\(name,bytes\)/);
  assert.match(source,/Maximum EP-series sample length is 40 seconds/);
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
      json:JSON.stringify({'sound.playmode':'loop','envelope.release':20,'sound.pitch':2,'sound.amplitude':100,'sound.rootnote':61})
    }
  },46875);
  assert.equal(meta['sound.loopstart'],4687);
  assert.equal(meta['sound.loopend'],23437);
  assert.equal(meta['sound.rootnote'],60);
  assert.equal(meta['sound.bpm'],120);
  assert.equal(meta['sound.playmode'],'loop');
  assert.equal(meta['envelope.release'],20);
  assert.equal(meta['sound.pitch'],2);
  assert.equal(meta['sound.amplitude'],100);
});

test('EP sample metadata follows the reference Teenage Engineering value bounds',()=>{
  const meta=prepareTeenageMetadata({
    sample_rate:46875,
    extra:{
      midi_root_note:0,
      bpm:200,
      json:JSON.stringify({'sound.amplitude':200,'sound.rootnote':1,'sound.bpm':180})
    }
  },46875);
  assert.equal(meta['sound.rootnote'],1);
  assert.equal(meta['sound.bpm'],180);
  assert.equal(meta['sound.amplitude'],200);
  const rejected=prepareTeenageMetadata({
    sample_rate:46875,
    extra:{json:JSON.stringify({'sound.amplitude':201,'sound.rootnote':0,'sound.bpm':181})}
  },46875);
  assert.equal('sound.rootnote' in rejected,false);
  assert.equal('sound.bpm' in rejected,false);
  assert.equal('sound.amplitude' in rejected,false);
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
    'envelope.attack':3,'envelope.release':4,'time.mode':'free',
    'sample.start':-1,'sample.end':120,'sample.mode':'multi',
    regions:[{'sample.start':0,'sample.end':100}],ignored:'nope'
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
  assert.equal(json['sample.start'],-1);
  assert.equal(json['sample.end'],120);
  assert.equal(json['sample.mode'],'multi');
  assert.deepEqual(json.regions,[{'sample.start':0,'sample.end':100}]);
  assert.equal('ignored' in json,false);
});

test('EP download WAV uses the reference WASM createWav encoder',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/audio.js',import.meta.url),'utf8');
  assert.match(source,/resampler\.createWav\(String\(name\|\|'sample'\),audioMeta,pcm\)/);
  assert.doesNotMatch(source,/44\+pcm\.byteLength/);
});


test('EP audio fast path compares WAV rate to the selected target rate',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/audio.js',import.meta.url),'utf8');
  assert.match(source,/const target=targetSampleRate\?\?getTargetSampleRate\(audioMeta,formats\)/);
  assert.match(source,/audioMeta\.sample_rate===target/);
  assert.doesNotMatch(source,/audioMeta\.sample_rate===DEFAULT_SAMPLE_RATE&&/);
});

test('My EP initial sample sync lists only root and the direct \/sounds directory',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');
  const start=source.indexOf('const readDevice=async');
  const block=source.slice(start,source.indexOf('const syncMovedFile=async',start));
  assert.match(block,/await listDirectory\(0,'\/'\)/);
  assert.match(block,/await listDirectory\(soundsParentId,'\/sounds'\)/);
  assert.doesNotMatch(block,/listDeviceFiles\(/);
  assert.match(source,/readAuthoritativeFiles=async\(\)=>\{[\s\S]*listDirectory\(soundsParentId,'\/sounds'\)/);
});

test('My EP drag reorder does not require sample READ capability',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/sampleMemory.js',import.meta.url),'utf8');
  const start=source.indexOf("row.addEventListener('dragstart'");
  const block=source.slice(start,source.indexOf("row.addEventListener('dragend'",start));
  assert.doesNotMatch(block,/isReadable/);
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
