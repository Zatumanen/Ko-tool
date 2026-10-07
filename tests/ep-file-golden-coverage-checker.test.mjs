import test from 'node:test';
import assert from 'node:assert/strict';
import{
  evaluateGoldenCoverageRecords,
  formatGoldenCoverage
}from '../scripts/check-ep-file-golden-coverage.mjs';

const sha40=char=>char.repeat(40);
const sha256=char=>'sha256:'+char.repeat(64);

function fixture(id,{kind='real-device'}={}){
  return{
    schemaVersion:1,
    id,
    provenance:kind==='real-device'
      ?{
        kind,
        source:{repository:'example/captures',commit:sha40('a'),path:'capture.jsonl',blobSha:sha40('b'),license:'MIT'},
        captureMethod:'usb-midi-sniffer',
        device:{family:'EP-series',model:'EP-133',firmware:null}
      }
      :{kind:'synthetic',generator:'speeduppercut',basis:'unit regression'},
    sanitization:{version:1,sourceDigest:sha256('c'),fixtureDigest:sha256('d'),transforms:[]},
    scenario:{operation:id,outcome:'test',description:'coverage checker fixture'},
    frames:[{index:0,direction:'tx',deltaMs:0,hex:'F000207633406B1201F7'}],
    expectations:{wire:{},runtime:[]}
  };
}

test('coverage checker reports exact missing success/failure sets and ignores synthetic evidence',()=>{
  const manifest={
    schemaVersion:1,
    requiredRealCoverage:{success:['init','list','get'],failure:['timeout']},
    entries:[
      {id:'real-init',coverage:['init']},
      {id:'synthetic-timeout',coverage:['timeout']}
    ]
  };
  const result=evaluateGoldenCoverageRecords(manifest,[
    fixture('real-init'),
    fixture('synthetic-timeout',{kind:'synthetic'})
  ]);
  assert.equal(result.complete,false);
  assert.deepEqual(result.covered,['init']);
  assert.deepEqual(result.missingSuccess,['get','list']);
  assert.deepEqual(result.missingFailure,['timeout']);
  assert.match(formatGoldenCoverage(result),/Missing success: get, list/);
  assert.match(formatGoldenCoverage(result),/Missing failure: timeout/);
});

test('coverage checker completes only when every required class has validated real-device evidence',()=>{
  const manifest={
    schemaVersion:1,
    requiredRealCoverage:{success:['init','get'],failure:['timeout']},
    entries:[
      {id:'real-init',coverage:['init']},
      {id:'real-get',coverage:['get']},
      {id:'real-timeout',coverage:['timeout']}
    ]
  };
  const result=evaluateGoldenCoverageRecords(manifest,[
    fixture('real-init'),
    fixture('real-get'),
    fixture('real-timeout')
  ]);
  assert.equal(result.complete,true);
  assert.deepEqual(result.missingSuccess,[]);
  assert.deepEqual(result.missingFailure,[]);
  assert.match(formatGoldenCoverage(result),/coverage complete/);
});
