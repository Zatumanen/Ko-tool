import{EFFECTS,SINGLETONS,PLAYMODES,SHAPES,STOCK_PROFILE}from './profile.js';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const number=v=>typeof v==='number'&&Number.isFinite(v);
export const safeFilename=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[\\/\x00-\x1f:*?"<>|]/.test(v)&&v!=='.'&&v!=='..'&&/\.wav$/i.test(v);
export function defaultConfig(){return{name:'MY FX-MIC PACK',presets:Array.from({length:4},(_,pos)=>({pos,name:'PRESET '+(pos+1),list:[{effect:'LOWPASS',cutoff:1},{effect:'SAMPLE'}],trigger:{row:1}}))};}

export function validateConfig(config){
  const errors=[],warnings=[];
  const fail=(path,msg)=>errors.push(path+': '+msg);
  const keys=(v,allowed,path)=>{for(const k of Object.keys(v))if(!allowed.includes(k))fail(path+'.'+k,'unsupported field for stock EP-2350');};
  const slots=(items,path)=>{
    if(!Array.isArray(items)||items.length>4){fail(path,'expected an array of at most four slots');return false;}
    const seen=new Set();
    items.forEach((item,i)=>{
      if(!object(item)){fail(path+'['+i+']','expected object');return;}
      const pos=item.pos??i;
      if(!Number.isInteger(pos)||pos<0||pos>3||seen.has(pos))fail(path+'['+i+'].pos','invalid or duplicate slot');
      seen.add(pos);
    });return true;
  };
  if(!object(config))return{errors:['config: expected object'],warnings};
  keys(config,['name','samples','presets'],'config');
  if(config.name!==undefined&&(typeof config.name!=='string'||config.name.length>128))fail('name','expected text up to 128 characters');
  if(config.samples!==undefined&&slots(config.samples,'samples'))config.samples.forEach((s,i)=>{
    if(!object(s))return;const path=`samples[${i}]`;keys(s,['file','pos','playmode'],path);
    if(!safeFilename(s.file))fail(path+'.file','expected a root WAV filename');
    if(s.playmode!==undefined&&!PLAYMODES.includes(s.playmode))fail(path+'.playmode','unsupported playmode');
  });
  if(config.presets!==undefined&&slots(config.presets,'presets'))config.presets.forEach((p,i)=>{
    if(!object(p))return;const path=`presets[${i}]`;
    keys(p,['pos','name','comment','list','handle','shake','lfo','trigger'],path);
    for(const k of ['name','comment'])if(p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>2048))fail(path+'.'+k,'expected bounded text');
    if(!Array.isArray(p.list)||!p.list.length||p.list.length>STOCK_PROFILE.maxRows){fail(path+'.list','expected 1–16 effect rows (authoring limit)');return;}
    const seen=new Set();
    p.list.forEach((e,row)=>{
      const at=path+`.list[${row}]`;
      if(!object(e)||typeof e.effect!=='string'||!Object.hasOwn(EFFECTS,e.effect)){fail(at,'unknown stock effect');return;}
      if(SINGLETONS.has(e.effect)&&seen.has(e.effect))fail(at,e.effect+' may appear only once per chain');seen.add(e.effect);
      for(const [k,v]of Object.entries(e)){
        if(k==='effect')continue;
        if(k==='BUS'){
          if(v!==1&&v!==2)fail(at+'.BUS','expected 1 or 2');
          warnings.push(at+': BUS routing is not simulated; exact firmware behavior requires HIL');continue;
        }
        const range=Object.hasOwn(EFFECTS[e.effect],k)&&EFFECTS[e.effect][k];
        if(!range)fail(at+'.'+k,'unknown parameter');
        else if(!number(v)||v<range[0]||v>range[1])fail(at+'.'+k,`expected ${range[0]}…${range[1]}`);
      }
      if(e.effect==='EQUALISER')warnings.push(at+': EQUALISER parameter casing needs exact-firmware verification');
    });
    for(const kind of ['handle','shake','lfo']){
      const mod=p[kind];if(mod===undefined)continue;const at=path+'.'+kind;
      if(!object(mod)){fail(at,'expected object');continue;}
      keys(mod,kind==='lfo'?['row','param','depth','shape','speed','phase']:['row','param','depth','target'],at);
      if(typeof mod.param!=='string')fail(at+'.param','expected a parameter name');
      let range;
      if(mod.target!==undefined){
        if(kind!=='handle'||mod.target!=='lfo'||!object(p.lfo)||!['speed','depth','phase'].includes(mod.param)||mod.row!==undefined)fail(at,'invalid LFO target');
      }else{
        if(!Number.isInteger(mod.row)||!p.list[mod.row])fail(at+'.row','missing effect row');
        else{const params=EFFECTS[p.list[mod.row]?.effect];range=params&&Object.hasOwn(params,mod.param)&&params[mod.param];if(!range)fail(at+'.param','unknown target parameter');}
      }
      if(mod.depth!==undefined&&!number(mod.depth))fail(at+'.depth','expected finite number');
      if(kind==='lfo'){
        if(mod.shape!==undefined&&!SHAPES.includes(mod.shape))fail(at+'.shape','unknown LFO shape');
        if(mod.speed!==undefined&&(!number(mod.speed)||mod.speed<0))fail(at+'.speed','expected nonnegative finite number');
        if(mod.phase!==undefined&&!number(mod.phase))fail(at+'.phase','expected finite number');
      }
      if(range&&number(mod.depth)){
        const base=p.list[mod.row][mod.param]??range[2];
        const ends=kind==='lfo'?[base-mod.depth,base+mod.depth]:[base,base+mod.depth];
        if(Math.min(...ends)<range[0]||Math.max(...ends)>range[1])warnings.push(at+': modulation reaches outside the parameter range; preview clamps it');
      }
    }
    if(p.trigger!==undefined){
      if(!object(p.trigger))fail(path+'.trigger','expected object');
      else{keys(p.trigger,['row'],path+'.trigger');if(!Number.isInteger(p.trigger.row)||p.list[p.trigger.row]?.effect!=='SAMPLE')fail(path+'.trigger.row','stock-guide profile only supports targeting SAMPLE');}
    }
  });
  return{errors,warnings};
}
export function assertConfig(config){const r=validateConfig(config);if(r.errors.length)throw Error(r.errors.join('\n'));return config;}
export function moveEffect(preset,from,to){
  if(![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<preset.list.length))throw Error('Invalid effect row');
  const p=structuredClone(preset),order=p.list.map((_,i)=>i);const [id]=order.splice(from,1);order.splice(to,0,id);
  p.list=order.map(i=>p.list[i]);
  for(const k of ['handle','shake','lfo','trigger'])if(p[k]&&p[k].row!==undefined)p[k].row=order.indexOf(p[k].row);
  return p;
}
export function removeEffect(preset,row,{removeAssignments=false}={}){
  if(!Number.isInteger(row)||!preset.list[row]||preset.list.length===1)throw Error('Cannot remove this effect row');
  const p=structuredClone(preset);
  const refs=['handle','shake','lfo','trigger'].filter(k=>p[k]?.row===row);
  if(refs.length&&!removeAssignments)throw Error('Remove assignments to this row first: '+refs.join(', '));
  for(const k of refs)delete p[k];
  if(!p.lfo&&p.handle?.target==='lfo')delete p.handle;
  p.list.splice(row,1);
  for(const k of ['handle','shake','lfo','trigger'])if(p[k]?.row>row)p[k].row--;
  return p;
}
