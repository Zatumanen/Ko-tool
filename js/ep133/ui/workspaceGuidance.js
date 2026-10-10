/**
 * Passive, user-facing guidance for My EP's existing workspace state.
 * No device authority, automatic retry, write, restore or permission request.
 */
export function describeMyEpWorkspaceGuidance(state){
 const connection=state?.connection||{};
 const coordinator=state?.coordinator||{};
 const recovery=state?.recovery||{};
 const active=coordinator.active;
 if(connection.unsafe||coordinator.state==='unsafe'){
  return Object.freeze({
   label:'Device safety lock',
   summary:'The current device state is not safe for new operations.',
   next:'Stop device changes. Review the existing My EP recovery information; do not retry a write or reconnect blindly.',
   tone:'danger',canReview:recovery.required===true
  });
 }
 if(recovery.required===true){
  const parts=[];
  if(Number(recovery.sampleRequired)>0)parts.push('sample');
  if(Number(recovery.projectRequired)>0)parts.push('project');
  return Object.freeze({
   label:'Recovery needs review',
   summary:(parts.length?parts.join(' and ')+' operation':'An operation')+' may be incomplete. Its result must be checked on the device.',
   next:'Open Recovery and use only the verification or restoration actions that My EP enables for the selected checkpoint.',
   tone:'danger',canReview:true
  });
 }
 if(coordinator.state==='blocked'){
  return Object.freeze({
   label:'Device operations blocked',
   summary:'My EP cannot authorize a new device operation in the current session.',
   next:'Check connection and session ownership. Do not force another write or assume previous changes succeeded.',
   tone:'danger',canReview:false
  });
 }
 if(active||['reading','mutating','verifying'].includes(coordinator.state)){
  const phase=String(active?.phase||coordinator.state||'');
  const checking=phase==='verifying';
  return Object.freeze({
   label:checking?'Verifying changes':phase==='reading'?'Reading device':'Device operation in progress',
   summary:checking?'My EP is verifying a result; it is not yet confirmed.':
    phase==='reading'?'My EP is reading device data.':
    'My EP is performing a device operation; its result is not yet confirmed.',
   next:'Keep the session open. Wait for My EP to finish or show the available recovery action.',
   tone:'busy',canReview:false
  });
 }
 if(state?.projectRuntime?.settling){
  return Object.freeze({
   label:'Project state settling',
   summary:'My EP is waiting for the device project state to settle.',
   next:'Do not start another project change until the current state is verified.',
   tone:'busy',canReview:false
  });
 }
 if(connection.status!=='connected'){
  return Object.freeze({
   label:'Device not connected',
   summary:'There is no verified active device connection.',
   next:'Connect explicitly inside My EP. A saved device name or past operation does not mean the sampler is ready.',
   tone:'idle',canReview:false
  });
 }
 return Object.freeze({
  label:'Device connected',
  summary:'My EP reports an active connection. Device writes still require operation-specific safety checks.',
  next:'Choose an action in My EP; review and confirm any changes before writing to the sampler.',
  tone:'ready',canReview:false
 });
}

export function describeMyEpTechnicalState(state){
 const error=state?.lastOperation?.error;
 const parts=[
  'Coordinator: '+String(state?.coordinator?.state||'unknown'),
  'Connection: '+String(state?.connection?.status||'unknown'),
  'Recovery: '+(state?.recovery?.required?'required':'none reported')
 ];
 if(error?.code)parts.push('Last error code: '+String(error.code).slice(0,100));
 if(error?.category)parts.push('Last error category: '+String(error.category).slice(0,80));
 if(error?.recovery)parts.push('Recorded recovery note: '+String(error.recovery).slice(0,300));
 return parts.join('\n');
}
