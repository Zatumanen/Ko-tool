// Observe the canonical runtime; this adapter never acquires a device or FILE lease.
export function getSequencerSessionState(snapshot){
  const connection=snapshot?.connection;
  if(snapshot?.ownership?.status==='blocked')return{
    status:'blocked',label:'EP SESSION UNAVAILABLE',identity:'',epoch:connection?.epoch??null
  };
  if(connection?.status!=='connected')return{
    status:'disconnected',label:connection?.status==='connecting'?'EP CONNECTING':'EP DISCONNECTED',
    identity:'',epoch:connection?.epoch??null
  };
  const authorized=connection.device?.identityVerified===true&&snapshot.ownership?.status==='owned';
  const ready=authorized&&snapshot.status==='ready'&&snapshot.safety?.status==='safe'&&
    snapshot.recovery?.hydrated===true&&snapshot.operation?.phase==='idle';
  return{
    status:ready?'ready':'blocked',
    label:ready?'EP SESSION READY':'EP SESSION UNAVAILABLE',
    identity:authorized?[connection.device.sku,connection.device.firmware&&'FW '+connection.device.firmware].filter(Boolean).join(' · '):'',
    epoch:connection.epoch
  };
}
