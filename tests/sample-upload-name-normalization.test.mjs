import test from 'node:test';
import assert from 'node:assert/strict';
import{
  normalizeFileName,normalizeSampleName,prepareSampleCreateMetadata,
  prepareSampleWritableMetadata,prepareSampleLocalMetadata,
  uploadSampleToSlotWithTransport
}from '../js/ep133/sampleFilesystem.js';

const CASES=[
  ['biggie loop codeinedemonz intro.wav','biggie .nz intro'],
  ['001 biggie loop codeinedemonz intro.wav','001 big.nz intro'],
  ['SMOKEY KICK 7.wav','smokey kick 7'],
  ['A.Very.Long.File.Name.WAV','a.very..ile.name'],
  ['Snärë/Bad\\Name.wav','snarebadname'],
  ['Kick.wav','kick']
];

test('original WAV filenames use the official EP 16-character naming scheme',()=>{
  for(const [filename,expected]of CASES){
    assert.equal(normalizeFileName(filename),expected,filename);
    assert.ok(expected.length<=16);
  }
});

test('prepared EP names keep the middle dot across repeated metadata normalization',()=>{
  for(const [filename,expected]of CASES){
    assert.equal(normalizeSampleName(expected),expected,filename);
    assert.equal(normalizeSampleName(normalizeSampleName(expected)),expected,filename);
    const metadata={
      name:expected,channels:2,samplerate:46875,format:'s16',
      'sound.playmode':'oneshot','envelope.release':255
    };
    assert.equal(prepareSampleCreateMetadata(metadata,{nameIsPrepared:true}).name,expected);
    assert.equal(prepareSampleWritableMetadata(metadata,{nameIsPrepared:true}).name,expected);
    assert.equal(prepareSampleLocalMetadata(metadata,{nameIsPrepared:true}).name,expected);
  }
});

test('upload passes the same normalized name to FILE_PUT, create metadata and METADATA_SET',async()=>{
  for(const [filename,expected]of CASES){
    const calls=[];
    const bytes=Uint8Array.from([1,2,3,4]);
    const id=await uploadSampleToSlotWithTransport({
      file:{name:filename},data:bytes,
      filename,parentId:1000,destinationId:9,
      metadata:{name:filename,channels:2,samplerate:46875,format:'s16'}
    },{
      putFile:async args=>{calls.push(['PUT',args]);return 9;},
      setFileMetadata:async(fileId,meta)=>{calls.push(['SET',fileId,meta]);},
      initFileSystem:async()=>{calls.push(['INIT']);}
    });
    assert.equal(id,9);
    assert.deepEqual(calls.map(c=>c[0]),['PUT','SET','INIT']);
    assert.equal(calls[0][1].filename,expected);
    assert.equal(calls[0][1].metadata.name,expected);
    assert.equal(calls[1][2].name,expected);
    assert.equal(calls[0][1].metadata.channels,2);
    assert.equal(calls[0][1].metadata.samplerate,46875);
  }
});

test('copying an EP sample preserves its already normalized name, not a faux extension',async()=>{
  const preparedName='biggie .nz intro';
  const calls=[];
  await uploadSampleToSlotWithTransport({
    data:Uint8Array.from([1,2]),filename:'mv007_042',
    metadataNameIsPrepared:true,
    parentId:1000,destinationId:42,
    metadata:{name:preparedName,channels:1,samplerate:46875,format:'s16'}
  },{
    putFile:async args=>{calls.push(['PUT',args]);return 42;},
    setFileMetadata:async(id,meta)=>{calls.push(['SET',id,meta]);},
    initFileSystem:async()=>{}
  });
  assert.equal(calls[0][1].filename,'mv007_042');
  assert.equal(calls[0][1].metadata.name,preparedName);
  assert.equal(calls[1][2].name,preparedName);
});

test('ordinary raw-name metadata formatting remains extension aware',()=>{
  const raw={name:'Long sample filename here.wav',channels:1,samplerate:46875,format:'s16'};
  assert.equal(prepareSampleCreateMetadata(raw).name,'long sa.ame here');
  assert.equal(prepareSampleWritableMetadata(raw).name,'long sa.ame here');
  assert.equal(normalizeFileName('001 Kick 808.wav',true),'kick 808');
});