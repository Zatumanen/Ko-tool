const formatMb=value=>{
  const mb=Number(value)/1e6;
  if(!Number.isFinite(mb)||mb<0)return'—';
  const fixed=mb.toFixed(1);
  return fixed.endsWith('.0')?fixed.slice(0,-2):fixed;
};

export function createDeviceView({
  title,deviceName,deviceHead,connectionOverlay,status,
  memoryStats,memoryMeter,sampleCount,txIndicator,rxIndicator,
  getDeviceProfile=()=>({title:'MY EP',name:''}),
  setTimeoutFn=(callback,delay)=>setTimeout(callback,delay),
  clearTimeoutFn=timer=>clearTimeout(timer)
}={}){
  let everConnected=false;
  let activeProfile=getDeviceProfile();
  let lastDeviceInfo={title:'MY EP',name:''};
  const activityTimers={tx:null,rx:null};

  const setStatus=text=>{
    if(status)status.textContent=String(text||'');
  };

  const renderIdentity=state=>{
    if(state?.connected){
      activeProfile=getDeviceProfile(state?.device?.sku);
      lastDeviceInfo={title:activeProfile.title,name:activeProfile.name};
      everConnected=true;
    }
    const fallback=getDeviceProfile(state?.device?.sku);
    const info=state?.connected?lastDeviceInfo:(everConnected?lastDeviceInfo:{
      title:fallback?.title||'MY EP',
      name:fallback?.name||''
    });
    if(title)title.textContent=info.title;
    if(deviceName)deviceName.textContent=info.name;
    return activeProfile;
  };

  const setConnectionOverlay=text=>{
    if(deviceHead&&connectionOverlay){
      deviceHead.classList?.toggle?.('disconnected',!!text);
      connectionOverlay.textContent=text||'';
    }
  };

  const renderStats=(metadata={},countValue=0)=>{
    const maxCapacity=Number(metadata?.max_capacity)||0;
    const freeSpace=Number(metadata?.free_space_in_bytes);
    const used=maxCapacity>0&&Number.isFinite(freeSpace)?Math.max(0,maxCapacity-freeSpace):NaN;
    if(memoryStats)memoryStats.textContent=maxCapacity>0&&Number.isFinite(used)
      ?formatMb(used)+' / '+formatMb(maxCapacity)+' MB'
      :'—';
    if(memoryMeter){
      const ratio=maxCapacity>0&&Number.isFinite(used)?Math.max(0,Math.min(1,used/maxCapacity)):0;
      memoryMeter.style.width=(ratio*100).toFixed(1)+'%';
    }
    if(sampleCount)sampleCount.textContent=String(Math.max(0,Number(countValue)||0));
  };

  const pulseMidiActivity=direction=>{
    const element=direction==='tx'?txIndicator:direction==='rx'?rxIndicator:null;
    if(!element)return;
    element.classList?.add?.('active');
    if(activityTimers[direction]!=null)clearTimeoutFn(activityTimers[direction]);
    activityTimers[direction]=setTimeoutFn(()=>{
      element.classList?.remove?.('active');
      activityTimers[direction]=null;
    },direction==='rx'?275:250);
  };

  return{
    setStatus,renderIdentity,setConnectionOverlay,renderStats,pulseMidiActivity,
    hasEverConnected:()=>everConnected,
    getActiveProfile:()=>activeProfile
  };
}
