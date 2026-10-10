import test from 'node:test';
import assert from 'node:assert/strict';
import {projectEpStatus,describeEpStatus,parseEpStatusMessage} from '../js/ep133/runtimeStatusTelemetry.js';

function sample(status='ready'){
  return {
    status,connection:{status:'connected',device:{identityVerified:true,sku:'TE032AS001',firmware:'2.5.1',deviceKey:'never-expose'}},
    ownership:{status:'owned'},operation:{phase:'idle',active:null},
    safety:{status:'safe'},recovery:{hydrated:true}
  };
}
test('projected session reflects authoritative readiness and excludes device identifiers',()=>{
  const status=projectEpStatus(sample());
  assert.equal(status.status,'ready');
  assert.equal(status.firmware,'2.5.1');
  assert.equal(describeEpStatus(status).label,'EP-133 KO II · READY');
  assert.equal(JSON.stringify(status).includes('never-expose'),false);
  assert.equal(projectEpStatus({...sample(),recovery:{hydrated:false}}).status,'blocked');
  assert.equal(projectEpStatus({...sample(),ownership:{status:'blocked'}}).status,'blocked');
});
test('recovery and unsafe override normal connection information',()=>{
  const unsafe=projectEpStatus({...sample(),safety:{status:'unsafe',reason:'Status ambiguous'}});
  assert.equal(unsafe.status,'unsafe');
  assert.equal(describeEpStatus(unsafe).tone,'danger');
  const recovered=projectEpStatus({...sample(),safety:{status:'recovery-required',reason:'Verify recovery'}});
  assert.equal(recovered.status,'recovery-required');
  assert.match(describeEpStatus(recovered).detail,/Verify recovery/);
});
test('malformed status envelopes cannot claim connected device identity',()=>{
  assert.equal(parseEpStatusMessage({type:'other'}),null);
  const msg={version:1,type:'status',source:'legacy',seq:1,data:{...projectEpStatus(sample()),connection:'disconnected'}};
  assert.equal(parseEpStatusMessage(msg).data.sku,null);
  assert.equal(parseEpStatusMessage({...msg,seq:-1}),null);
});
