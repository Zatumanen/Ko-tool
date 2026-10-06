import test from 'node:test';
import assert from 'node:assert/strict';
import{
  validateGoldenFixture,
  decodeFixtureFrame,
  summarizeRealCoverage
}from './helpers/ep-file-golden-fixtures.mjs';

const sha40=char=>char.repeat(40);
const sha256=char=>`sha256:${char.repeat(64)}`;

function realFixture(overrides={}){
  const base={
    schemaVersion:1,
    id:'ep133-real-init-001',
    provenance:{
      kind:'real-device',
      source:{
        repository:'example/captures',
        commit:sha40('a'),
        path:'captures/init.jsonl',
        blobSha:sha40('b'),
        license:'MIT'
      },
      captureMethod:'official-app-proxy',
      device:{family:'EP-series',model:'EP-133',firmware:null}
    },
    sanitization:{
      version:1,
      sourceDigest:sha256('c'),
      fixtureDigest:sha256('d'),
      transforms:[]
    },
    scenario:{operation:'init',outcome:'success',description:'startup FILE init'},
    frames:[{index:0,direction:'tx',deltaMs:0,hex:'F000207633406B1201F7'}],
    expectations:{wire:{},runtime:[]}
  };
  return structuredClone({...base,...overrides});
}

test('schema v1 validates a real-device fixture',()=>{
  const fixture=validateGoldenFixture(realFixture(),{requireReal:true});
  assert.equal(fixture.schemaVersion,1);
  assert.equal(fixture.provenance.kind,'real-device');
  assert.deepEqual([...decodeFixtureFrame(fixture.frames[0])],[0xf0,0x00,0x20,0x76,0x33,0x40,0x6b,0x12,0x01,0xf7]);
  assert.equal(Object.isFrozen(fixture),true);
});

test('real-device provenance requires immutable source identity',()=>{
  const cases=[
    fixture=>{fixture.provenance.source.commit='main';},
    fixture=>{delete fixture.provenance.source.blobSha;},
    fixture=>{fixture.provenance.source.path='';},
    fixture=>{fixture.provenance.source.repository='';},
    fixture=>{fixture.provenance.source.license='';},
    fixture=>{fixture.provenance.captureMethod='';},
    fixture=>{delete fixture.provenance.device.firmware;}
  ];
  for(const mutate of cases){
    const fixture=realFixture();
    mutate(fixture);
    assert.throws(()=>validateGoldenFixture(fixture,{requireReal:true}));
  }
});

test('synthetic fixture is rejected when real evidence is required',()=>{
  const fixture=realFixture({
    id:'synthetic-timeout-001',
    provenance:{kind:'synthetic',generator:'speeduppercut',basis:'timeout policy regression'}
  });
  assert.equal(validateGoldenFixture(fixture).provenance.kind,'synthetic');
  assert.throws(()=>validateGoldenFixture(fixture,{requireReal:true}),/real-device/i);
});

test('frame hex and monotonic deltaMs are validated',()=>{
  const malformedHex=realFixture();
  malformedHex.frames[0].hex='F0002XF7';
  assert.throws(()=>validateGoldenFixture(malformedHex),/hex/i);

  const badFraming=realFixture();
  badFraming.frames[0].hex='0000207633406B1201F7';
  assert.throws(()=>validateGoldenFixture(badFraming),/SysEx|F0/i);

  const decreasing=realFixture();
  decreasing.frames.push({index:1,direction:'rx',deltaMs:-1,hex:'F000207633402B120000F7'});
  assert.throws(()=>validateGoldenFixture(decreasing),/deltaMs/i);
});

test('coverage counts real evidence only',()=>{
  const real=validateGoldenFixture(realFixture());
  const synthetic=validateGoldenFixture(realFixture({
    id:'synthetic-timeout-001',
    provenance:{kind:'synthetic',generator:'speeduppercut',basis:'timeout policy regression'},
    scenario:{operation:'timeout',outcome:'failure',description:'synthetic timeout'}
  }));
  const manifest={
    schemaVersion:1,
    requiredRealCoverage:{success:['init','list'],failure:['timeout']},
    entries:[
      {id:real.id,coverage:['init']},
      {id:synthetic.id,coverage:['timeout']}
    ]
  };
  const summary=summarizeRealCoverage(manifest,[real,synthetic]);
  assert.deepEqual([...summary.covered].sort(),['init']);
  assert.deepEqual([...summary.missing].sort(),['list','timeout']);
});
