export function createSessionGuard(getDeviceSessionToken){
  if(typeof getDeviceSessionToken!=='function')throw new TypeError('Session guard requires getDeviceSessionToken.');
  const captureBatchSession=()=>{
    const token=getDeviceSessionToken();
    if(!token)throw new Error('EP device is disconnected.');
    return token;
  };
  const assertBatchSession=token=>{
    if(!token||getDeviceSessionToken()!==token)
      throw new Error('EP device connection changed during the operation; batch aborted.');
  };
  return{captureBatchSession,assertBatchSession};
}
