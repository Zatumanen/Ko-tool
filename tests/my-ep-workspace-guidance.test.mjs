import test from 'node:test';
import assert from 'node:assert/strict';
import{describeMyEpWorkspaceGuidance,describeMyEpTechnicalState}from '../js/ep133/ui/workspaceGuidance.js';

const ready={
 connection:{status:'connected',unsafe:false},
 coordinator:{state:'idle',active:null},
 recovery:{required:false,sampleRequired:0,projectRequired:0},
 projectRuntime:{settling:false},
 lastOperation:null
};

test('My EP read-only workspace guidance distinguishes connected and disconnected without write claims',()=>{
 assert.equal(describeMyEpWorkspaceGuidance(ready).label,'Device connected');
 assert.equal(describeMyEpWorkspaceGuidance({...ready,connection:{status:'disconnected'}}).label,'Device not connected');
 assert.equal(describeMyEpWorkspaceGuidance({...ready,connection:{status:'disconnected'}}).canReview,false);
});
test('My EP does not offer unsupported recovery actions or infer completion during work',()=>{
 const active=describeMyEpWorkspaceGuidance({...ready,coordinator:{state:'mutating',active:{phase:'verifying'}}});
 assert.equal(active.label,'Verifying changes');
 assert.match(active.summary,/not yet confirmed/);
 assert.equal(active.canReview,false);
 const blocked=describeMyEpWorkspaceGuidance({...ready,coordinator:{state:'blocked'}});
 assert.equal(blocked.tone,'danger');
 assert.equal(blocked.canReview,false);
 assert.match(blocked.next,/Do not force/);
});
test('recovery and unsafe state override normal connection; review is offered only for known checkpoints',()=>{
 const required={...ready,recovery:{required:true,sampleRequired:2,projectRequired:1}};
 const recovery=describeMyEpWorkspaceGuidance(required);
 assert.equal(recovery.label,'Recovery needs review');
 assert.match(recovery.summary,/sample and project/);
 assert.equal(recovery.canReview,true);
 const unsafe=describeMyEpWorkspaceGuidance({...required,connection:{status:'unsafe',unsafe:true}});
 assert.equal(unsafe.label,'Device safety lock');
 assert.equal(unsafe.canReview,true);
 assert.match(unsafe.next,/do not retry a write/i);
 const unsafeUnknown=describeMyEpWorkspaceGuidance({...ready,connection:{status:'unsafe',unsafe:true}});
 assert.equal(unsafeUnknown.canReview,false);
});
test('technical error codes/recovery notes stay out of primary guidance',()=>{
 const data={...ready,lastOperation:{
  label:'sample write',status:'requires-recovery',
  error:{code:'EP_FILE_OPERATION_FAILED',category:'transport',recovery:'CRC mismatch on file 7'}
 }};
 const help=describeMyEpWorkspaceGuidance(data);
 assert.doesNotMatch(JSON.stringify(help),/CRC|EP_FILE_OPERATION_FAILED/);
 const tech=describeMyEpTechnicalState(data);
 assert.match(tech,/EP_FILE_OPERATION_FAILED/);
 assert.match(tech,/CRC mismatch on file 7/);
 assert.match(tech,/transport/);
});
