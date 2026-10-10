(()=>{
  const enc=new TextEncoder(),dec=new TextDecoder();
  const TE=[0x00,0x20,0x76],IDENTITY=[0xF0,0x7E,0x7F,0x06,0x01,0xF7];
  const FILE=5,GREET=1;
  const F={INIT:1,PUT:2,GET:3,LIST:4,PLAYBACK:5,DELETE:6,METADATA:7,INFO:11,MOVE:12};
  const CAP={FILE:1,DIR:2,READ:4,WRITE:8,DELETE:16,MOVE:32,PLAY:64};
  const flagsFile=CAP.FILE|CAP.READ|CAP.WRITE|CAP.DELETE|CAP.MOVE|CAP.PLAY;
  const identityCode=0x33,sku='TE032AS001',osVersion='2.5.1',serial='E2E-EP-0001';
  const u16=(a,i)=>(a[i]<<8)|a[i+1];
  const u32=(a,i)=>((a[i]<<24)|(a[i+1]<<16)|(a[i+2]<<8)|a[i+3])>>>0;
  const be16=n=>[(n>>8)&255,n&255];
  const be32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
  const zstr=(a,i)=>{let e=i;while(e<a.length&&a[e]!==0)e++;return dec.decode(a.slice(i,e));};
  const concat=(...parts)=>{
    const arrays=parts.map(x=>x instanceof Uint8Array?x:Uint8Array.from(x||[]));
    const out=new Uint8Array(arrays.reduce((n,x)=>n+x.length,0));let p=0;
    for(const x of arrays){out.set(x,p);p+=x.length;}return out;
  };
  const packedLength=n=>n?n+Math.ceil(n/7):0;
  const pack=data=>{
    data=data instanceof Uint8Array?data:Uint8Array.from(data||[]);
    const out=new Uint8Array(packedLength(data.length));let oi=1,mi=0;
    for(let i=0;i<data.length;i++){
      const pos=i%7;out[mi]|=(data[i]>>7)<<pos;out[oi++]=data[i]&0x7f;
      if(pos===6&&i<data.length-1){mi+=8;oi++;}
    }
    return out;
  };
  const unpack=packed=>{
    packed=packed.slice();let wi=0,mi=0,bi=0,ri=1,mb=packed[0]||0;
    while(ri<packed.length){
      packed[wi++]=(((mb&(1<<bi))?1:0)<<7)|(packed[ri++]&0x7f);
      bi++;if(bi>6){ri++;bi=0;mi+=8;mb=packed[mi]||0;}
    }
    return packed.slice(0,wi);
  };
  const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  const writeTarText=(bytes,offset,length,text)=>{
    for(let index=0;index<length;index++)bytes[offset+index]=0;
    for(let index=0;index<text.length&&index<length;index++)bytes[offset+index]=text.charCodeAt(index);
  };
  const makeTarMember=(path,data=new Uint8Array())=>{
    const header=new Uint8Array(512);
    writeTarText(header,0,100,path);writeTarText(header,100,8,'0000644\0');
    if(data.length)writeTarText(header,124,12,data.length.toString(8)+'\0');
    header[156]='0'.charCodeAt(0);header.fill(0x20,148,156);
    let checksum=0;for(const byte of header)checksum+=byte;
    const text=checksum.toString(8)+'\0';writeTarText(header,148,8,text);
    for(let index=148+text.length;index<156;index++)header[index]=0x20;
    const padded=new Uint8Array(Math.ceil(data.length/512)*512);padded.set(data);
    return[header,padded];
  };
  const makeProjectTar=members=>{
    const chunks=[];let size=1024;
    for(const member of members){
      const pair=makeTarMember(member.path,member.data);
      chunks.push(...pair);size+=pair[0].length+pair[1].length;
    }
    const out=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
    return out;
  };
  const projectPad=slot=>{
    const data=new Uint8Array(26);
    data[1]=slot&255;data[2]=(slot>>8)&255;data[16]=100;data[20]=255;data[24]=60;
    return data;
  };
  const projectPattern=()=>Uint8Array.from([0,2,1,0,0,0,0,60,100,24,0,0]);
  const projectScenes=()=>{
    const data=new Uint8Array(712);data.set([0,0,0,0,0,4,4],0);
    for(let scene=0;scene<99;scene++){const offset=7+scene*6;data[offset+4]=4;data[offset+5]=4;}
    data.set([1,1,1,1],7);data[7+99*6+3]=1;return data;
  };
  const projectSettings=()=>{
    const data=new Uint8Array(222);new DataView(data.buffer).setFloat32(4,123.5,true);return data;
  };
  const projectFx=()=>{
    const data=new Uint8Array(144),view=new DataView(data.buffer);
    data[4]=2;view.setFloat32(16,.25,true);view.setFloat32(80,.75,true);return data;
  };
  const projectTar=makeProjectTar([
    {path:'pads/a/p01',data:projectPad(7)},{path:'pads/b/p01',data:projectPad(8)},
    {path:'pads/c/p01',data:projectPad(9)},
    {path:'patterns/a01',data:projectPattern()},{path:'patterns/b01',data:projectPattern()},
    {path:'patterns/c01',data:projectPattern()},{path:'patterns/d01',data:projectPattern()},
    {path:'scenes',data:projectScenes()},{path:'settings',data:projectSettings()},{path:'fx_settings',data:projectFx()}
  ]);
  const projectTarComplete=makeProjectTar([
    {path:'pads/a/p01',data:projectPad(7)},{path:'pads/b/p01',data:projectPad(8)},
    {path:'patterns/a01',data:projectPattern()},{path:'patterns/b01',data:projectPattern()},
    {path:'patterns/c01',data:projectPattern()},{path:'patterns/d01',data:projectPattern()},
    {path:'scenes',data:projectScenes()},{path:'settings',data:projectSettings()},{path:'fx_settings',data:projectFx()}
  ]);
  const projects=new Map([
    [3001,{id:3001,parent:2000,name:'01',data:projectTar}],
    [3002,{id:3002,parent:2000,name:'02',data:projectTarComplete}]
  ]);

  // Simulate a saved change made directly on the hardware, without any
  // FILE event notification or Speeduppercut-triggered write.
  const changeProjectBpm=(projectNumber,bpm)=>{
    const id=3000+Number(projectNumber);
    const project=projects.get(id);
    if(!project)throw new Error('Unknown fake project P'+projectNumber);
    const data=project.data.slice();
    const decoder=new TextDecoder();
    let position=0,found=false;
    while(position+512<=data.length){
      const header=data.subarray(position,position+512);
      const name=decoder.decode(header.subarray(0,100)).split(String.fromCharCode(0))[0];
      if(!name)break;
      const sizeText=decoder.decode(header.subarray(124,136)).replaceAll(String.fromCharCode(0),'').trim();
      const size=parseInt(sizeText,8)||0;
      if(name==='settings'){
        if(size<8)throw new Error('Fake project settings are too short');
        new DataView(data.buffer,data.byteOffset+position+516,4).setFloat32(0,Number(bpm),true);
        found=true;
        break;
      }
      position+=512+Math.ceil(size/512)*512;
    }
    if(!found)throw new Error('Settings member missing in fake project');
    project.data=data;
  };

  const samples=new Map([
    [7,{id:7,name:'kick808',data:Uint8Array.from({length:128},(_,i)=>(i*17)&255),meta:{name:'kick808',channels:1,samplerate:46875,format:'s16',crc:7007,'sound.playmode':'oneshot','envelope.release':255}}],
    [8,{id:8,name:'snare',data:Uint8Array.from({length:96},(_,i)=>(i*23)&255),meta:{name:'snare',channels:1,samplerate:46875,format:'s16',crc:8008,'sound.playmode':'oneshot','envelope.release':255}}]
  ]);
  let currentPut=null,currentGet=null,debugNextMutation=false,requestCount=0;
  let rejectedListPage=null,heldListPage=null;
  const delayedListResponses=[];
  const requestLog=[];
  const listPageSize=24;
  // Represent full sample-library capacity without allocating 65 MB of audio.
  const seedSamples=(count,virtualSize=130000,{sparse=false}={})=>{
    samples.clear();
    for(let index=0;index<count;index++){
      const id=sparse?index*2+1:index+1;
      const name='SAMPLE'+String(id).padStart(4,'0');
      samples.set(id,{
        id,name,data:new Uint8Array(64),reportedSize:virtualSize,
        meta:{name,channels:1,samplerate:46875,format:'s16',crc:id*1001,'sound.playmode':'oneshot','envelope.release':255}
      });
    }
  };
  const soundsMeta=()=>{
    const used=[...samples.values()].reduce((n,s)=>n+(s.reportedSize??s.data.length),0);
    const capacity=used>64000000?128000000:64000000;
    return{
    name:'sounds',
    max_capacity:capacity,
    free_space_in_bytes:capacity-used,
    formats:[{type:'pcm',formats:[{format:'s16',channels:[1,2],samplerate:{native:46875,range:[8000,46875]}}]}],
    tabs:[
      {name:'KICK',range:[1,99],color:1},
      {name:'SNARE',range:[100,199],color:1},
      {name:'CYMB',range:[200,299],color:1},
      {name:'PERC',range:[300,399],color:1},
      {name:'BASS',range:[400,499],color:1},
      {name:'MELOD',range:[500,599],color:1},
      {name:'LOOP',range:[600,699],color:1},
      {name:'USER 1',range:[700,799],color:2},
      {name:'USER 2',range:[800,899],color:2},
      {name:'SFX',range:[900,999],color:3}
    ]
  };};

  class Input{
    constructor(){this.id='e2e-input';this.type='input';this.state='connected';this.connection='open';this.listeners=new Set();}
    addEventListener(t,fn){if(t==='midimessage')this.listeners.add(fn);}
    removeEventListener(t,fn){if(t==='midimessage')this.listeners.delete(fn);}
    emit(data){for(const fn of [...this.listeners])fn({data});}
  }
  const input=new Input();

  const identityResponse=()=>{
    const product=32,assembly=1;
    return Uint8Array.from([0xf0,0x7e,identityCode,0x06,0x02,...TE,product&0x7f,(product>>7)&0x7f,assembly&0x7f,(assembly>>7)&0x7f,0,0,0,0,0xf7]);
  };
  const response=(request,payload=new Uint8Array(),status=0)=>{
    const packed=pack(payload),out=new Uint8Array(11+packed.length);
    out.set([0xf0,...TE,identityCode,0x40,0x20|((request.id>>7)&0x1f),request.id&0x7f,request.command,status&0x7f],0);
    out.set(packed,10);out[out.length-1]=0xf7;return out;
  };
  const eventFrame=raw=>{
    const packed=pack(raw),out=new Uint8Array(11+packed.length);
    out.set([0xf0,...TE,identityCode,0x40,0,0,FILE,0],0);
    out.set(packed,10);out[out.length-1]=0xf7;return out;
  };
  const debugFrame=text=>Uint8Array.from([0xf0,...TE,identityCode,0x33,...enc.encode(text),0xf7]);
  const emitLater=(data,delay=0)=>setTimeout(()=>input.emit(data),delay);
  const emitMetadata=nodeId=>{
    const meta=nodeId===1000?soundsMeta():samples.get(nodeId)?.meta||{};
    emitLater(eventFrame(concat([3,...be16(nodeId)],enc.encode(JSON.stringify(meta)),[0])),0);
  };
  const emitDeleted=id=>{
    emitLater(eventFrame(Uint8Array.from([10,...be16(id)])),0);
    emitMetadata(1000);
  };
  const emitAdded=sample=>{
    emitLater(eventFrame(concat([8,...be16(sample.id),...be16(1000),...be32(sample.data.length)],enc.encode(sample.name),[0])),0);
    emitMetadata(1000);
  };
  const emitMoved=(oldId,newId)=>{
    emitLater(eventFrame(Uint8Array.from([13,...be16(oldId),...be16(1000),...be16(newId)])),0);
    emitMetadata(1000);
  };
  const listEntry=(id,flags,size,name)=>concat(be16(id),[flags],be32(size),enc.encode(name),[0]);
  const fileInfo=sample=>concat(be16(sample.id),be16(1000),[flagsFile],be32(sample.data.length),enc.encode(sample.name),[0]);
  const parseRequest=data=>{
    const flags=data[6],id=((flags&0x1f)<<7)|(data[7]&0x7f),command=data[8];
    return{id,command,raw:unpack(data.slice(9,-1))};
  };
  const maybeDebug=request=>{
    if(!debugNextMutation||request.command!==FILE)return false;
    const sub=request.raw[0];
    const mutation=sub===F.DELETE||sub===F.MOVE||sub===F.PUT||(sub===F.METADATA&&request.raw[1]===1);
    if(!mutation)return false;
    debugNextMutation=false;
    emitLater(debugFrame('err e2e strict mutation'),0);
    return true;
  };
  const onRequest=request=>{
    requestCount++;
    requestLog.push({
      command:request.command,
      sub:request.raw?.[0]??null,
      type:request.raw?.[1]??null,
      raw:[...(request.raw||[])]
    });
    if(request.command===GREET){
      emitLater(response(request,enc.encode(`base_sku:${sku};os_version:${osVersion};serial:${serial};`)));return;
    }
    if(request.command!==FILE){emitLater(response(request));return;}
    if(maybeDebug(request)){emitLater(response(request),5);return;}

    const raw=request.raw,sub=raw[0];
    if(sub===F.INIT){
      emitLater(response(request,Uint8Array.from([0,...be32(512)])));return;
    }
    if(sub===F.LIST){
      const page=u16(raw,1),node=u16(raw,3);
      if(node===1000&&rejectedListPage===page){
        emitLater(response(request,enc.encode('LIST page unavailable\\0'),3));return;
      }
      let body=[];
      if(node===0)body=[
        listEntry(1000,CAP.DIR|CAP.READ|CAP.WRITE,0,'sounds'),
        listEntry(2000,CAP.DIR|CAP.READ,0,'projects')
      ];
      else if(node===1000)body=[...samples.values()].sort((a,b)=>a.id-b.id).map(s=>listEntry(s.id,flagsFile,s.reportedSize??s.data.length,s.name));
      else if(node===2000)body=[...projects.values()].map(project=>listEntry(project.id,CAP.DIR|CAP.READ,project.data.length,project.name));
      const reply=response(request,concat(be16(page),...body.slice(page*listPageSize,(page+1)*listPageSize)));
      if(node===1000&&heldListPage===page){
        delayedListResponses.push(()=>emitLater(reply));return;
      }
      emitLater(reply);return;
    }
    if(sub===F.METADATA&&raw[1]===2){
      const id=u16(raw,2),page=u16(raw,4);
      const meta=id===1000?soundsMeta():id===2000?{active:3001,name:'projects'}:samples.get(id)?.meta||{};
      if(page>0){emitLater(response(request,Uint8Array.from(be16(page))));return;}
      emitLater(response(request,concat(be16(0),enc.encode(JSON.stringify(meta)),[0])));return;
    }
    if(sub===F.METADATA&&raw[1]===1){
      const id=u16(raw,2),text=zstr(raw,4),patch=JSON.parse(text||'{}');
      if(id===1000){emitLater(response(request));emitMetadata(1000);return;}
      const sample=samples.get(id);
      if(!sample){emitLater(response(request,enc.encode('invalid id\0'),3));return;}
      sample.meta={...sample.meta,...patch};if(patch.name)sample.name=String(patch.name);
      emitLater(response(request));emitMetadata(id);return;
    }
    if(sub===F.INFO){
      const id=u16(raw,1),sample=samples.get(id);
      if(!sample){emitLater(response(request,enc.encode('invalid id\0'),3));return;}
      emitLater(response(request,fileInfo(sample)));return;
    }
    if(sub===F.DELETE){
      const id=u16(raw,1);
      if(!samples.has(id)){emitLater(response(request,enc.encode('invalid id\0'),3));return;}
      samples.delete(id);emitLater(response(request));emitDeleted(id);return;
    }
    if(sub===F.MOVE){
      const oldId=u16(raw,1),parent=u16(raw,3),newId=u16(raw,5),sample=samples.get(oldId);
      if(!sample||parent!==1000||samples.has(newId)){emitLater(response(request,enc.encode('invalid move\0'),3));return;}
      samples.delete(oldId);sample.id=newId;samples.set(newId,sample);
      emitLater(response(request,Uint8Array.from([...be16(oldId),...be16(parent),...be16(newId)])));emitMoved(oldId,newId);return;
    }
    if(sub===F.GET&&raw[1]===0){
      const id=u16(raw,2),file=samples.get(id)||projects.get(id);
      if(!file){emitLater(response(request,enc.encode('invalid id\0'),3));return;}
      currentGet={file,pageSize:96};
      const flags=projects.has(id)?CAP.DIR|CAP.READ:flagsFile;
      emitLater(response(request,concat(be16(id),[flags],be32(file.data.length),enc.encode(file.name),[0])));return;
    }
    if(sub===F.GET&&raw[1]===1){
      const page=u16(raw,2),file=currentGet?.file;
      if(!file){emitLater(response(request,enc.encode('no get\0'),3));return;}
      const chunk=file.data.slice(page*currentGet.pageSize,(page+1)*currentGet.pageSize);
      emitLater(response(request,concat(be16(page),chunk)));return;
    }
    if(sub===F.PUT&&raw[1]===0){
      const flags=raw[2],id=u16(raw,3),parent=u16(raw,5),size=u32(raw,7),name=zstr(raw,11);
      currentPut={id,parent,size,name,flags,pages:[]};
      emitLater(response(request,Uint8Array.from(be16(id))));return;
    }
    if(sub===F.PUT&&raw[1]===1){
      const page=u16(raw,2),chunk=raw.slice(4);
      if(!currentPut){emitLater(response(request,enc.encode('no put\0'),3));return;}
      if(chunk.length){
        currentPut.pages[page]=chunk.slice();
        emitLater(response(request));return;
      }
      const data=concat(...currentPut.pages.filter(Boolean)).slice(0,currentPut.size);
      if(currentPut.parent===2000&&projects.has(currentPut.id)){
        const project=projects.get(currentPut.id);
        project.data=data;project.name=currentPut.name;currentPut=null;
        emitLater(response(request));return;
      }
      const sample={
        id:currentPut.id,name:currentPut.name,data,
        meta:{name:currentPut.name,channels:1,samplerate:46875,format:'s16',crc:currentPut.id*1001,'sound.playmode':'oneshot','envelope.release':255}
      };
      samples.set(sample.id,sample);currentPut=null;
      emitLater(response(request));emitAdded(sample);return;
    }
    if(sub===F.PLAYBACK){emitLater(response(request));return;}
    emitLater(response(request));
  };

  class Output{
    constructor(){this.id='e2e-output';this.type='output';this.state='connected';this.connection='open';this.sent=[];}
    send(data){
      const copy=Uint8Array.from(data);this.sent.push(copy);
      if(same(copy,IDENTITY)){emitLater(identityResponse());return;}
      onRequest(parseRequest(copy));
    }
  }
  const output=new Output();
  const access={inputs:new Map([[input.id,input]]),outputs:new Map([[output.id,output]]),onstatechange:null};

  Object.defineProperty(navigator,'requestMIDIAccess',{
    configurable:true,
    value:async options=>{window.__fakeEp.midiAccessRequests.push(options);return access;}
  });

  const disconnect=()=>{
    input.state='disconnected';output.state='disconnected';access.onstatechange?.({port:input});
  };
  const reconnect=()=>{
    input.state='connected';output.state='connected';access.onstatechange?.({port:input});
  };
  window.__fakeEp={
    midiAccessRequests:[],
    get requestCount(){return requestCount;},
    get requestLog(){return requestLog.map(item=>({...item,raw:[...item.raw]}));},
    snapshot:()=>[...samples.values()].sort((a,b)=>a.id-b.id).map(s=>({id:s.id,name:s.name,size:s.data.length,meta:{...s.meta}})),
    removeSample:id=>samples.delete(Number(id)),
    seedSamples,
    rejectListPage:page=>{rejectedListPage=page==null?null:Number(page);},
    holdListPage:page=>{heldListPage=page==null?null:Number(page);},
    releaseListPage:()=>{
      heldListPage=null;
      for(const release of delayedListResponses.splice(0))release();
    },
    projectSnapshot:()=>[...projects.values()].map(p=>({id:p.id,name:p.name,size:p.data.length})),
    changeProjectBpm,
    disconnect,reconnect,
    debugNextMutation:()=>{debugNextMutation=true;},
    emitDebug:text=>emitLater(debugFrame(text||'err e2e'),0),
    reset:()=>{
      debugNextMutation=false;
    }
  };
})();