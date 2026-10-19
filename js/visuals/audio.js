// Microphone/USB Audio capture is isolated from EP Web MIDI and FILE operations.
// No implicit input switch; the selected deviceId must be requested explicitly.
export function createVisualsAudio({navigatorRef=navigator,AudioContextClass=window.AudioContext||window.webkitAudioContext,onState=()=>{}}={}){
  let context=null,stream=null,source=null,left=null,right=null,mix=null,sink=null,track=null;
  let selectedId='',generation=0,active=false,channelCount=1;
  const time=new Float32Array(2048),leftTime=new Float32Array(2048),rightTime=new Float32Array(2048),frequency=new Uint8Array(1024);
  const state=(message,error=false)=>onState({active,selectedId,message,error,channelCount});
  const rms=data=>Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);
  const peak=data=>data.reduce((s,x)=>Math.max(s,Math.abs(x)),0);
  function release(){
    active=false;
    if(track)track.onended=null;
    for(const t of stream?.getTracks?.()||[])t.stop();
    try{source?.disconnect()}catch{}
    try{left?.disconnect()}catch{}
    try{right?.disconnect()}catch{}
    try{mix?.disconnect()}catch{}
    try{sink?.disconnect()}catch{}
    const previous=context;
    context=null;stream=null;source=null;left=null;right=null;mix=null;sink=null;track=null;
    if(previous)Promise.resolve(previous.close()).catch(()=>{});
  }
  function stop(message='Захват остановлен'){generation++;release();state(message)}
  function select(id){if(id!==selectedId){stop('Источник выбран — нажмите START');selectedId=id||''}}
  async function inputs(){
    if(!navigatorRef.mediaDevices?.enumerateDevices)throw Error('Браузер не поддерживает список аудиовходов.');
    const devices=await navigatorRef.mediaDevices.enumerateDevices();
    return devices.filter(d=>d.kind==='audioinput').map(d=>({id:d.deviceId,label:d.label||'Аудиовход (название скрыто до разрешения)'}));
  }
  // Explicit permission discovery when labels/IDs are hidden before a grant.
  // May briefly open the OS default input ONLY after a user's ACCESS click.
  // Release immediately; this is not a fallback stream for Visuals.
  async function unlockInputs(){
    if(!navigatorRef.mediaDevices?.getUserMedia)throw Error('В этом браузере нельзя запросить доступ к аудио.');
    const temporary=await navigatorRef.mediaDevices.getUserMedia({audio:true,video:false});
    try{return await inputs()}
    finally{for(const t of temporary.getTracks())t.stop()}
  }
  async function start(){
    if(!selectedId)throw Error('Сначала выберите аудиовход.');
    if(!navigatorRef.mediaDevices?.getUserMedia||!AudioContextClass)throw Error('В этом браузере аудиозахват недоступен.');
    if(typeof window!=='undefined'&&!window.isSecureContext)throw Error('Для захвата требуется HTTPS или localhost.');
    const request=++generation;
    release();state('Запрос доступа к аудиовходу…');
    let opened;
    try{
      opened=await navigatorRef.mediaDevices.getUserMedia({audio:{
        deviceId:{exact:selectedId},echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}
      },video:false});
      if(request!==generation){opened.getTracks().forEach(t=>t.stop());return false}
      const nextContext=new AudioContextClass();
      if(request!==generation){opened.getTracks().forEach(t=>t.stop());await nextContext.close();return false}
      context=nextContext;stream=opened;track=opened.getAudioTracks()[0];
      if(!track)throw Error('Выбранный вход не предоставляет звуковую дорожку.');
      channelCount=Math.max(1,Math.min(2,Number(track.getSettings?.().channelCount)||1));
      source=context.createMediaStreamSource(stream);
      mix=context.createAnalyser();mix.fftSize=2048;mix.smoothingTimeConstant=.72;
      left=context.createAnalyser();right=context.createAnalyser();
      left.fftSize=2048;right.fftSize=2048;
      const splitter=context.createChannelSplitter(2);
      source.connect(mix);source.connect(splitter);
      splitter.connect(left,0);splitter.connect(right,1);
      sink=context.createGain();sink.gain.value=0;
      mix.connect(sink);left.connect(sink);right.connect(sink);
      sink.connect(context.destination); // zero gain: drive analysis without audible feedback
      track.onended=()=>{if(request===generation)stop('Аудиовход отключён')};
      await context.resume();
      // The superseding START/STOP already released this request's graph.
      // Shared capture state may now belong to a newer START.
      if(request!==generation)return false;
      active=true;state('LIVE · '+(track.label||'Аудиовход'));
      return true;
    }catch(error){
      if(request===generation){release();state(error?.name==='NotAllowedError'?'Доступ к аудиовходу запрещён':(error?.message||String(error)),true)}
      else opened?.getTracks?.().forEach(t=>t.stop());
      return false;
    }
  }
  function sample(){
    if(!active||!mix)return null;
    mix.getFloatTimeDomainData(time);
    mix.getByteFrequencyData(frequency);
    left.getFloatTimeDomainData(leftTime);
    if(channelCount===2)right.getFloatTimeDomainData(rightTime);
    else rightTime.set(leftTime);
    const r0=rms(leftTime),r1=rms(rightTime),r=rms(time),p=peak(time);
    let dot=0,sumL=0,sumR=0;
    for(let i=0;i<leftTime.length;i++){const l=leftTime[i],rr=rightTime[i];dot+=l*rr;sumL+=l*l;sumR+=rr*rr}
    const correlation=channelCount===1?null:dot/(Math.sqrt(sumL*sumR)||1);
    return{time,leftTime,rightTime,frequency,rms:r,peak:p,leftRms:r0,rightRms:r1,
      leftPeak:peak(leftTime),rightPeak:peak(rightTime),correlation,
      db:20*Math.log10(Math.max(r,1e-7)),sampleRate:context.sampleRate,channelCount};
  }
  return{inputs,unlockInputs,start,stop,select,sample,get selectedId(){return selectedId},get active(){return active},get channelCount(){return channelCount}};
}
