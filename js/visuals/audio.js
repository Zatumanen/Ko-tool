import{kWeightingCoefficients}from './loudness.js';
// Microphone/USB Audio capture is isolated from EP Web MIDI and FILE operations.
// No implicit input switch; the selected deviceId must be requested explicitly.
export function createVisualsAudio({navigatorRef=navigator,AudioContextClass=window.AudioContext||window.webkitAudioContext,onState=()=>{},recorder=null}={}){
  let context=null,stream=null,source=null,left=null,right=null,mix=null,sink=null,track=null;
  let selectedId='',generation=0,active=false,channelCount=1;
  let triggerNode=null,triggerFrame=null,triggerSettings={threshold:.1,timeMs:200,holdMs:200};
  let spectrum=null,outputNode=null,outputFrame=null,outputAt=0,outputEpoch=0,outputChannels=0;
  let loudnessNode=null,loudnessFrame=null,loudnessEpoch=0,loudnessFailed=false,formatTimer=null;
  const spectrumDb=new Float32Array(4096);
  const time=new Float32Array(2048),leftTime=new Float32Array(2048),rightTime=new Float32Array(2048),frequency=new Uint8Array(1024);
  const state=(message,error=false,reason=null)=>onState({active,selectedId,message,error,channelCount,reason});
  const rms=data=>Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);
  const peak=data=>data.reduce((s,x)=>Math.max(s,Math.abs(x)),0);
  function release(){
    active=false;
    if(formatTimer!==null){clearInterval(formatTimer);formatTimer=null;}
    recorder?.detach();
    if(loudnessNode){loudnessNode.port.onmessage=null;loudnessNode.onprocessorerror=null;loudnessNode.port.close();try{loudnessNode.disconnect()}catch{}}
    loudnessNode=null;loudnessFrame=null;loudnessEpoch++;loudnessFailed=false;
    if(outputNode){outputNode.port.onmessage=null;outputNode.port.close();try{outputNode.disconnect()}catch{}}
    outputNode=null;outputFrame=null;outputAt=0;outputEpoch=0;outputChannels=0;
    if(triggerNode){triggerNode.port.onmessage=null;triggerNode.port.close();try{triggerNode.disconnect()}catch{}}
    triggerNode=null;triggerFrame=null;
    if(track)track.onended=null;
    for(const t of stream?.getTracks?.()||[])t.stop();
    try{source?.disconnect()}catch{}
    try{left?.disconnect()}catch{}
    try{right?.disconnect()}catch{}
    try{mix?.disconnect()}catch{}
    try{spectrum?.disconnect()}catch{}
    spectrum=null;
    try{sink?.disconnect()}catch{}
    const previous=context;
    context=null;stream=null;source=null;left=null;right=null;mix=null;sink=null;track=null;
    if(previous)Promise.resolve(previous.close()).catch(()=>{});
  }
  function stop(message='Захват остановлен',reason=null){generation++;release();state(message,false,reason)}
  async function finishAndStop(message='Захват остановлен'){
    const request=generation;let failed=false;
    try{if(['recording','paused'].includes(recorder?.snapshot?.()?.state))await recorder.stop();}catch{failed=true;}
    if(request!==generation)return false;
    stop(failed?'Захват остановлен: запись не подтверждена':message);return true;
  }
  function validateChannels(){
    if(!active||!track)return false;
    const reported=Number(track.getSettings?.().channelCount);
    if(Number.isFinite(reported)&&reported>0&&reported!==channelCount){
      stop('Формат каналов изменился — нажмите START','channel-format');return false;
    }
    return true;
  }
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
    // Permission is now granted; enumeration does not need a running stream.
    // A delayed/failed enumerateDevices must not prolong permission-only capture.
    for(const t of temporary.getTracks())t.stop();
    return inputs();
  }
  async function start(){
    if(!selectedId)throw Error('Сначала выберите аудиовход.');
    if(!navigatorRef.mediaDevices?.getUserMedia||!AudioContextClass)throw Error('В этом браузере аудиозахват недоступен.');
    if(typeof window!=='undefined'&&!window.isSecureContext)throw Error('Для захвата требуется HTTPS или localhost.');
    const request=++generation;
    release();state('Запрос доступа к аудиовходу…');
    try{
      const opened=await navigatorRef.mediaDevices.getUserMedia({audio:{
        deviceId:{exact:selectedId},echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}
      },video:false});
      if(request!==generation){opened.getTracks().forEach(t=>t.stop());return false}
      // Own the granted stream before allocating the graph, so release()
      // covers constructor failures as well as failures after construction.
      stream=opened;
      const nextContext=new AudioContextClass();
      if(request!==generation){await nextContext.close();return false}
      context=nextContext;track=opened.getAudioTracks()[0];
      if(!track)throw Error('Выбранный вход не предоставляет звуковую дорожку.');
      const declaredChannels=Number(track.getSettings?.().channelCount);
      if(Number.isFinite(declaredChannels)&&declaredChannels>0&&![1,2].includes(declaredChannels))throw Error('Поддерживается только моно или стерео вход');
      outputChannels=[1,2].includes(declaredChannels)?declaredChannels:0;
      channelCount=outputChannels||1; // Legacy panels retain their unknown-format fallback; Output never measures that fallback.
      source=context.createMediaStreamSource(stream);
      mix=context.createAnalyser();mix.fftSize=2048;mix.smoothingTimeConstant=.72;
      spectrum=context.createAnalyser();spectrum.fftSize=8192;spectrum.smoothingTimeConstant=0;
      left=context.createAnalyser();right=context.createAnalyser();
      left.fftSize=2048;right.fftSize=2048;
      const splitter=context.createChannelSplitter(2);
      source.connect(mix);source.connect(splitter);
      source.connect(spectrum);
      splitter.connect(left,0);splitter.connect(right,1);
      sink=context.createGain();sink.gain.value=0;
      mix.connect(sink);left.connect(sink);right.connect(sink);
      spectrum.connect(sink);
      sink.connect(context.destination); // zero gain: drive analysis without audible feedback
      track.onended=()=>{if(request===generation)stop('Аудиовход отключён')};
      await context.resume();
      if(request===generation&&nextContext.audioWorklet&&typeof AudioWorkletNode!=='undefined'){
        // Derive a versioned worklet URL from this module's own build stamp.
        const workletUrl=new URL('./triggerWorklet.js',import.meta.url);
        workletUrl.search=new URL(import.meta.url).search;
        await nextContext.audioWorklet.addModule(workletUrl.href);
        if(request!==generation)return false;
        triggerNode=new AudioWorkletNode(nextContext,'visuals-trigger');
        triggerNode.port.onmessage=event=>{if(request===generation){triggerFrame=event.data;triggerNode.port.postMessage({ack:true});}};
        triggerNode.port.postMessage(triggerSettings);
        source.connect(triggerNode);triggerNode.connect(sink);
        if(outputChannels){
        const outputUrl=new URL('./outputMetersWorklet.js',import.meta.url);
        outputUrl.search=new URL(import.meta.url).search;
        await nextContext.audioWorklet.addModule(outputUrl.href);
        if(request!==generation)return false;
        outputNode=new AudioWorkletNode(nextContext,'visuals-output-meters',{channelCount:outputChannels,channelCountMode:'clamped-max'});
        outputNode.port.onmessage=event=>{
          if(request!==generation||event.data.epoch!==outputEpoch)return;
          outputFrame=event.data;outputAt=performance.now();outputNode.port.postMessage({ack:true});
        };
        source.connect(outputNode);outputNode.connect(sink);
        }
      }else if(request===generation)triggerFrame={unsupported:true};
      if(request===generation&&nextContext.audioWorklet&&typeof AudioWorkletNode!=='undefined'){
        try{
          const channels=Number(track.getSettings?.().channelCount);
          if(![1,2].includes(channels))throw Error('LUFS requires known mono/stereo input');
          kWeightingCoefficients(nextContext.sampleRate);
          const url=new URL('./loudnessWorklet.js',import.meta.url);url.search=new URL(import.meta.url).search;
          await nextContext.audioWorklet.addModule(url.href);
          if(request!==generation)return false;
          loudnessNode=new AudioWorkletNode(nextContext,'visuals-loudness',{channelCount:channels,channelCountMode:'explicit',outputChannelCount:[1],processorOptions:{channels}});
          loudnessNode.port.onmessage=event=>{
            if(request!==generation)return;
            if(!loudnessFailed&&event.data.epoch===loudnessEpoch)loudnessFrame=event.data;
            loudnessNode.port.postMessage({ack:true});
          };
          loudnessNode.onprocessorerror=()=>{if(request===generation){loudnessFailed=true;loudnessFrame={error:'LUFS processor failed: restart capture'};}};
          loudnessNode.port.postMessage({reset:loudnessEpoch});source.connect(loudnessNode);loudnessNode.connect(sink);
        }catch(error){if(request===generation)loudnessFrame={error:error.message||'LUFS unavailable'};}
      }else if(request===generation)loudnessFrame={error:'LUFS requires AudioWorklet'};
      // The superseding START/STOP already released this request's graph.
      // Shared capture state may now belong to a newer START.
      if(request!==generation)return false;
      recorder?.attach({context,source,sink,channelCount:Number(track.getSettings?.().channelCount)||0,getChannelCount:()=>Number(track?.getSettings?.().channelCount)});
      active=true;
      // Continue checking channel-format drift even when every Canvas is suspended.
      formatTimer=setInterval(()=>validateChannels(),250);
      formatTimer.unref?.();
      state('LIVE · '+(track.label||'Аудиовход'));
      return true;
    }catch(error){
      if(request===generation){release();state(error?.name==='NotAllowedError'?'Доступ к аудиовходу запрещён':(error?.message||String(error)),true)}
      // A newer generation already released the older graph and stream.
      return false;
    }
  }
  function sample(){
    if(!active||!mix||!validateChannels())return null;
    mix.getFloatTimeDomainData(time);
    mix.getByteFrequencyData(frequency);
    spectrum.getFloatFrequencyData(spectrumDb);
    left.getFloatTimeDomainData(leftTime);
    if(channelCount===2)right.getFloatTimeDomainData(rightTime);
    else rightTime.set(leftTime);
    const r0=rms(leftTime),r1=rms(rightTime),r=rms(time),p=peak(time);
    let dot=0,sumL=0,sumR=0;
    for(let i=0;i<leftTime.length;i++){const l=leftTime[i],rr=rightTime[i];dot+=l*rr;sumL+=l*l;sumR+=rr*rr}
    const correlation=channelCount===1?null:dot/(Math.sqrt(sumL*sumR)||1);
    const output=!outputChannels?{status:'unknown-format'}:!outputNode?{status:'unsupported'}:!outputFrame?{status:'pending'}:performance.now()-outputAt>500?{status:'stale'}:outputFrame;
    return{output,loudness:loudnessFrame,time,leftTime,rightTime,frequency,spectrumDb,trigger:triggerFrame,rms:r,peak:p,leftRms:r0,rightRms:r1,
      leftPeak:peak(leftTime),rightPeak:peak(rightTime),correlation,
      db:20*Math.log10(Math.max(r,1e-7)),sampleRate:context.sampleRate,channelCount};
  }
  function configureTrigger(settings){triggerSettings={...triggerSettings,...settings};triggerFrame=null;triggerNode?.port.postMessage(triggerSettings);}
  function resetOutputMeters(){if(!outputNode)return;outputFrame=null;outputEpoch++;outputNode?.port.postMessage({reset:true,epoch:outputEpoch});}
  function resetLoudness(){if(!loudnessNode||loudnessFailed)return;loudnessEpoch++;loudnessFrame=null;loudnessNode.port.postMessage({reset:loudnessEpoch});}
  return{resetOutputMeters,resetLoudness,finishAndStop,inputs,unlockInputs,start,stop,select,sample,configureTrigger,get selectedId(){return selectedId},get active(){return active},get channelCount(){return channelCount}};
}
