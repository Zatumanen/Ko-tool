/**
 * ZAT-18: Human-facing copy for the existing *read-only* My EP status.
 * This never authorizes hardware actions. Detailed device evidence is rendered
 * separately; arbitrary device/runtime reason strings are not put in the
 * global header, assistant or the primary recovery instructions.
 */
export const DEVICE_STATE_MESSAGES=Object.freeze({
 unavailable:Object.freeze({
  title:'Device status unavailable',
  summary:'No recent status from My EP. Connection and device safety have not been verified.',
  next:'Open Device, launch My EP and connect explicitly. Do not assume the sampler is ready.',
  tone:'idle'
 }),
 disconnected:Object.freeze({
  title:'Device disconnected',
  summary:'My EP reports that there is no active device connection.',
  next:'Use Connect inside My EP when the sampler is attached. This page cannot connect on your behalf.',
  tone:'idle'
 }),
 connecting:Object.freeze({
  title:'Connecting to device',
  summary:'My EP is establishing a session. Identity and recovery checks are not yet complete.',
  next:'Keep the sampler connected and follow the connection status in My EP. Do not start a transfer yet.',
  tone:'busy'
 }),
 ready:Object.freeze({
  title:'Device session ready',
  summary:'My EP reports a verified, owned session with initial recovery checks completed.',
  next:'Open My EP to choose an operation. Any write still requires its own compatibility checks and confirmation.',
  tone:'ready'
 }),
 reading:Object.freeze({
  title:'Reading device data',
  summary:'My EP is reading information from the sampler. This is not a completed operation.',
  next:'Keep the session open. View progress and any available cancellation controls inside My EP.',
  tone:'busy'
 }),
 mutating:Object.freeze({
  title:'Changing device data',
  summary:'My EP reports that a device-changing operation is in progress. Its result is not verified yet.',
  next:'Do not disconnect the sampler or start another operation. Follow the current operation in My EP.',
  tone:'busy'
 }),
 verifying:Object.freeze({
  title:'Checking device changes',
  summary:'My EP is verifying the result of a device operation. Completion has not yet been confirmed.',
  next:'Keep the session open until My EP confirms success or explains the recovery steps.',
  tone:'busy'
 }),
 blocked:Object.freeze({
  title:'Device access restricted',
  summary:'My EP cannot safely allow device operations in the current session.',
  next:'Open My EP to inspect the connection or ownership problem. Do not retry writes until it permits them.',
  tone:'danger'
 }),
 'recovery-required':Object.freeze({
  title:'Device recovery needed',
  summary:'My EP found an operation that needs review before the device can be used safely.',
  next:'Open the recovery flow in My EP. Follow only the actions it explicitly offers after checking device state.',
  tone:'danger'
 }),
 unsafe:Object.freeze({
  title:'Device state uncertain',
  summary:'My EP has flagged an unsafe or ambiguous device state. New writes must stay blocked.',
  next:'Inspect My EP recovery and connection details. Do not reconnect or repeat a write blindly.',
  tone:'danger'
 })
});

/**
 * Prefer safety and an active operation over a contradictory ready indicator.
 * Unknown and stale inputs fail closed to "unavailable"; connection absence
 * never becomes "ready" on the basis of a reported status alone.
 */
export function describeUserDeviceState(snapshot){
 if(!snapshot)return DEVICE_STATE_MESSAGES.unavailable;
 let state=snapshot.status;
 if(snapshot.safety==='unsafe')state='unsafe';
 else if(snapshot.safety==='recovery-required')state='recovery-required';
 else if(snapshot.safety==='blocked'||snapshot.ownership==='blocked')state='blocked';
 else if(state==='ready'&&snapshot.phase!=='idle'){
  state=['reading','mutating','verifying'].includes(snapshot.phase)?snapshot.phase:'blocked';
 }
 if(state==='ready'&&(
  snapshot.connection!=='connected'||
  snapshot.ownership!=='owned'||
  snapshot.safety!=='safe'||
  snapshot.recoveryHydrated!==true
 ))state='blocked';
 return DEVICE_STATE_MESSAGES[state]||DEVICE_STATE_MESSAGES.unavailable;
}
