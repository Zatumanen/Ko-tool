import test from 'node:test';
import assert from 'node:assert/strict';
import{crc32Hex}from '../js/ep133/projectRecovery.js';
import{stageOfficialPakRestoreReadOnly}from '../js/ep133/officialPakRestoreStaging.js';

const bytes=Uint8Array.from([0,9,12,255,5,7,31,18]);
const le32=value=>{const out=new Uint8Array(4);new DataView(out.buffer).setUint32(0,value,true);return out};
const cc=str=>new TextEncoder().encode(str);
const join=(...args)=>{const a=new Uint8Array(args.reduce((n,b)=>n+b.length,0));let o=0;for(const b of args){a.set(b,o);o+=b.length}return a};
const chunk=(tag,data)=>join(cc(tag),le32(data.length),data,...(data.length%2?[new Uint8Array(1)]:[]));
function wav(pcm=bytes){const fmt=new Uint8Array(16);const f=new DataView(fmt.buffer);f.setUint16(0,1,true);f.setUint16(2,1,true);f.setUint32(4,46000,true);f.setUint32(8,92000,true);f.setUint16(12,2,true);f.setUint16(14,16,true);const body=join(cc('WAVE'),chunk('fmt ',fmt),chunk('data',pcm));return join(cc('RIFF'),le32(body.length),body)}
const archiveMeta={info:'teenage engineering - pak file',pak_version:1,pak_type:'project',device_sku:'TE032AS002',base_sku:'TE032AS001',device_version:'2.5.1'};
const ep={identitySku:'TE032AS002',baseSku:'TE032AS001',metadata:{os_version:'2.5.1'}};
function fixture({missing=false,unknownChunk=false,format='ppak'}={}){
 const raw=wav();const tar=new Uint8Array(1024);tar[0]=80;
 const metadata={...archiveMeta,pak_type:format==='pak'?'user':'project'};
 const inventory={format,metadata,
  sounds:[{slot:7,name:'kick808',size:raw.length,channels:1,sampleRate:46000,
    sampleFrames:4,pcmBytes:8,pcmCrc32:crc32Hex(bytes),
    metadata:{'sound.rootnote':60,'sound.pitch':-12},unknownChunks:unknownChunk?['XXXX']:[]}],
  projects:[{number:'06',size:tar.length,crc32:crc32Hex(tar),padReferences:[{slot:7,group:'A',pad:1},...(missing?[{slot:8,group:'B',pad:2}]:[])]}]
 };
 const members=new Map([['/meta.json',cc(JSON.stringify(metadata))],['/projects/P06.tar',tar],['/sounds/007 kick808.wav',raw]]);
 return{inventory,members};
}
const stage=(x=fixture(),opts={device:ep})=>stageOfficialPakRestoreReadOnly(x.inventory,x.members,opts);

test('staging preserves exact PCM and TAR copies, metadata and archive origin',()=>{
 const f=fixture(),out=stage(f);
 assert.equal(out.kind,'official-pak-offline-staging/v1');
 assert.equal(out.format,'ppak');
 assert.equal(out.identity.status,'match');
 assert.equal(out.samples[0].sampleRate,46000);
 assert.deepEqual(out.samples[0].pcm,bytes);
 assert.deepEqual(out.samples[0].originalWav,f.members.get('/sounds/007 kick808.wav'));
 assert.deepEqual(out.projects[0].tar,f.members.get('/projects/P06.tar'));
 assert.deepEqual(out.projects[0].referencedSlots,[7]);
 assert.equal(out.samples[0].metadata['sound.pitch'],-12);
 assert.equal(out.summary.totalPcmBytes,bytes.length);
});

test('matching identity still cannot grant FILE restore or remapping',()=>{
 const out=stage();
 assert.equal(out.identity.status,'match');
 assert.equal(out.canRestore,false);
 assert.equal(out.writeAuthorized,false);
 assert.equal(out.requiresHardwareReadback,true);
 assert.ok(out.blockers.some(w=>w.includes('slot remapping')));
 assert.equal('execute' in out,false);
 assert.equal('transaction' in out,false);
 assert.equal('upload' in out,false);
});

test('staging refuses modified PCM even when overall WAV size remains the same',()=>{
 const f=fixture(),original=f.members.get('/sounds/007 kick808.wav');const corrupted=original.slice();corrupted[corrupted.length-1]^=1;
 f.members.set('/sounds/007 kick808.wav',corrupted);
 assert.throws(()=>stage(f),/PCM fingerprint differs/);
});

test('staging refuses truncated WAV and extra ZIP member',()=>{
 const f=fixture();f.members.set('/sounds/007 kick808.wav',f.members.get('/sounds/007 kick808.wav').slice(0,-1));
 assert.throws(()=>stage(f),/WAV length mismatch/);
 const g=fixture();g.members.set('/extra.txt',Uint8Array.of(5));
 assert.throws(()=>stage(g),/ZIP member inventory differs/);
});

test('staging refuses changed or missing project TAR',()=>{
 const f=fixture();const tar=f.members.get('/projects/P06.tar').slice();tar[10]=99;f.members.set('/projects/P06.tar',tar);
 assert.throws(()=>stage(f),/project TAR checksum mismatch/);
 const g=fixture();g.members.delete('/projects/P06.tar');
 assert.throws(()=>stage(g),/project TAR missing/);
});

test('staging refuses mismatched archive metadata',()=>{
 const f=fixture();f.members.set('/meta.json',cc(JSON.stringify({...f.inventory.metadata,device_version:'2.5.2'})));
 assert.throws(()=>stage(f),/identity differs/);
});

test('missing sample pad references are identified without assuming target device contents',()=>{
 const out=stage(fixture({missing:true}));
 assert.deepEqual(out.projects[0].missingInArchive,[8]);
 assert.ok(out.blockers.some(w=>w.includes('absent from archive')));
 assert.equal(out.projects[0].deviceTarget,'unverified');
});

test('unknown WAV chunks block confidence while preserving original WAV',()=>{
 const out=stage(fixture({unknownChunk:true}));
 assert.ok(out.blockers.some(w=>w.includes('unknown WAV chunks')));
 assert.deepEqual(out.samples[0].unknownChunks,['XXXX']);
 assert.equal(out.canRestore,false);
});

test('unknown or wrong device identity always fails closed',()=>{
 assert.equal(stage(fixture(),{device:null}).identity.status,'unverified');
 const wrong={...ep,metadata:{os_version:'2.5.2'}};
 assert.equal(stage(fixture(),{device:wrong}).identity.status,'mismatch');
 assert.equal(stage(fixture(),{device:wrong}).canRestore,false);
});

test('staging output is detached from source ZIP buffers, no content mutations',()=>{
 const f=fixture(),wavInput=f.members.get('/sounds/007 kick808.wav'),tarInput=f.members.get('/projects/P06.tar');
 const a=wavInput.slice(),b=tarInput.slice();const result=stage(f);
 result.samples[0].pcm[0]=24;
 result.samples[0].originalWav[0]=24;
 result.projects[0].tar[0]=24;
 assert.deepEqual(wavInput,a);
 assert.deepEqual(tarInput,b);
 assert.equal(Object.isFrozen(result),true);
 assert.equal(Object.isFrozen(result.samples[0].metadata),true);
 assert.throws(()=>{result.canRestore=true},TypeError);
});

test('PAK device archive is only staged, not eligible for destructive whole-device restore',()=>{
 const result=stage(fixture({format:'pak'}));
 assert.equal(result.format,'pak');
 assert.equal(result.writeAuthorized,false);
 assert.ok(result.blockers.some(x=>x.includes('firmware WRITE')));
});
