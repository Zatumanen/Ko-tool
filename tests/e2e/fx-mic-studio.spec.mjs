import{test,expect}from '@playwright/test';
import{encodePcmWav}from '../../js/fxMic/wav.js';
const wav=()=>Buffer.from(encodePcmWav(Float32Array.from({length:2205},(_,i)=>Math.sin(i*.1)*.15),{sampleRate:22050,channels:1}));
const open=async page=>{await page.goto('/');await page.locator('#fx-mic-icon').click();await expect(page.getByRole('dialog',{name:'FX-MIC Studio'})).toBeVisible();await page.getByRole('button',{name:'All sections'}).click();};

test('studio starts in the focused Presets workspace with accessible workspace tabs',async({page})=>{
 await page.goto('/');await page.locator('#fx-mic-icon').click();
 await expect(page.getByRole('button',{name:'Presets',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-fx-pane="presets"]')).toBeVisible();
 await expect(page.locator('[data-fx-pane="samples"]')).toBeHidden();
 await page.getByRole('button',{name:'Samples',exact:true}).click();
 await expect(page.locator('[data-fx-pane="presets"]')).toBeHidden();
 await expect(page.locator('[data-fx-pane="samples"]')).toBeVisible();
 await page.getByRole('button',{name:'Audition',exact:true}).click();
 await expect(page.locator('[data-fx-pane="preview"]')).toBeVisible();
 await page.getByRole('button',{name:'All sections'}).click();
 await expect(page.locator('[data-fx-pane="presets"]')).toBeVisible();
 await expect(page.locator('[data-fx-pane="samples"]')).toBeVisible();
});

test('preset notes, copying, resetting and Undo are local-only and reversible',async({page})=>{
 await open(page);
 await page.getByLabel('Preset notes').fill('Dark radio voice');await page.getByLabel('Preset notes').press('Tab');
 await page.getByRole('button',{name:'Edit FX preset 2'}).click();
 await page.getByRole('button',{name:'Edit FX preset 1'}).click();
 await expect(page.getByLabel('Preset notes')).toHaveValue('Dark radio voice');
 await page.getByLabel('Copy preset destination').selectOption('1');
 page.once('dialog',async dialog=>dialog.accept());
 await page.getByRole('button',{name:'Copy selected preset'}).click();
 await expect(page.getByLabel('FX preset')).toHaveValue('1');
 await expect(page.getByLabel('Preset notes')).toHaveValue('Dark radio voice');
 await expect(page.getByLabel('Preset name')).toHaveValue(/COPY/);
 page.once('dialog',async dialog=>dialog.accept());
 await page.getByRole('button',{name:'Reset selected preset'}).click();
 await expect(page.getByLabel('Preset name')).toHaveValue('PRESET 2');
 await page.getByRole('button',{name:'Undo edit'}).click();
 await expect(page.getByLabel('Preset notes')).toHaveValue('Dark radio voice');
});

test('factory sample removal keeps Undo and never opens the hardware transport',async({page})=>{
 await page.addInitScript(()=>{
  window.__fxUsbRequests=0;
  Object.defineProperty(navigator,'serial',{value:{requestPort:()=>{window.__fxUsbRequests++;throw Error('must not connect');}},configurable:true});
 });
 await open(page);
 await page.getByLabel('WAV slot 1').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:wav()});
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.100 s');
 page.once('dialog',async dialog=>dialog.accept());
 await page.getByRole('button',{name:'Use factory sample in slot 1'}).click();
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('Factory sample');
 await page.getByRole('button',{name:'Undo edit'}).click();
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.100 s');
 expect(await page.evaluate(()=>window.__fxUsbRequests)).toBe(0);
});

test('browser microphone monitoring is explicit and releases tracks on Stop',async({page})=>{
 await page.addInitScript(()=>{
  window.__fxMicRequests=0;window.__fxMicStreams=[];
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{
   window.__fxMicRequests++;
   const ctx=new AudioContext();const stream=ctx.createMediaStreamDestination().stream;
   window.__fxMicStreams.push({stream,ctx});return stream;
  }},configurable:true});
 });
 await open(page);
 expect(await page.evaluate(()=>window.__fxMicRequests)).toBe(0);
 page.once('dialog',async dialog=>dialog.accept());
 await page.getByRole('button',{name:'Monitor browser microphone'}).click();
 await expect(page.locator('[data-fx-status]')).toContainText('Browser microphone monitoring');
 expect(await page.evaluate(()=>window.__fxMicRequests)).toBe(1);
 await page.getByRole('button',{name:'Stop audio'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__fxMicStreams[0].stream.getAudioTracks().every(t=>t.readyState==='ended'))).toBe(true);
 await page.evaluate(()=>window.__fxMicStreams[0].ctx.close());
});

test('desktop icons remain independently reachable at desktop and mobile widths',async({page})=>{
 for(const width of [1280,375]){
  await page.setViewportSize({width,height:900});await page.goto('/');
  const boxes=await page.locator('.app-icon').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j];expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y).toBe(true);
  }
 }
});

test('FX-MIC is a separate offline window; Live requires explicit firmware selection',async({page})=>{
 await open(page);await expect(page.locator('[data-fx-slot]')).toHaveCount(4);
 await expect(page.getByLabel('FX preset')).toHaveValue('0');
 await expect(page.getByText('EMULATION · approximate browser audio')).toBeVisible();
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await expect(page.getByRole('button',{name:'Connect EP-2350'})).toBeDisabled();
 await expect(page.getByLabel('Stock firmware')).toHaveValue('');
 await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','true');
 await page.getByRole('button',{name:'Close FX-MIC Studio'}).click();await expect(page.locator('#fx-mic-window')).toBeHidden();
});
test('WAV upload, crop, ZIP roundtrip and failed imports preserve current work',async({page})=>{
 await open(page);
 await page.getByLabel('WAV slot 1').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:wav()});
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.100 s');
 await page.getByLabel('Pack name').fill('KEEP ME');await page.getByLabel('Pack name').press('Tab');
 await page.getByLabel('Crop end 1').fill('0.05');await page.getByRole('button',{name:'Prepare slot 1'}).click();
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.050 s');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export ZIP'}).click();const zip=await download;
 await page.getByLabel('Import ZIP or config').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
 await expect(page.locator('[data-fx-error]')).not.toBeEmpty();await expect(page.getByLabel('Pack name')).toHaveValue('KEEP ME');
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.050 s');
 await page.getByLabel('Import ZIP or config').setInputFiles(await zip.path());await expect(page.locator('[data-fx-error]')).toBeEmpty();
 await expect(page.getByLabel('Pack name')).toHaveValue('KEEP ME');await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.050 s');
 await page.getByRole('button',{name:'Save local pack'}).click();await expect(page.locator('[data-fx-status]')).toContainText('Saved locally');
 await page.reload();await page.locator('#fx-mic-icon').click();await page.getByLabel('Local packs').selectOption('KEEP ME');await page.getByRole('button',{name:'Load local pack'}).click();
 await expect(page.getByLabel('Pack name')).toHaveValue('KEEP ME');await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.050 s');
});
test('chain reorder follows modulation target, and BUS disables misleading audition',async({page})=>{
 await open(page);await page.getByLabel('Handle target').selectOption('0:cutoff');
 await page.getByRole('button',{name:'Move row 0 down'}).click();
 await expect(page.getByLabel('Handle target')).toHaveValue('1:cutoff');
 await page.getByLabel('Routing row 1').selectOption('1');
 await expect(page.locator('[data-fx-preview-note]')).toContainText('BUS');await expect(page.getByRole('button',{name:'Audition sample through FX'})).toBeDisabled();
});
test('audition has real browser audio and close stops it; no MIDI or serial request',async({page})=>{
 await page.addInitScript(()=>{
  window.__fxRequests=0;
  Object.defineProperty(navigator,'serial',{value:{requestPort:()=>{window.__fxRequests++;throw Error('must not connect');}},configurable:true});
  const Base=window.AudioContext;window.__fxContexts=[];window.AudioContext=class extends Base{constructor(...args){super(...args);window.__fxContexts.push(this);}};
 });
 await open(page);await page.getByLabel('WAV slot 1').setInputFiles({name:'1.wav',mimeType:'audio/wav',buffer:wav()});
 await page.getByRole('button',{name:'Audition sample through FX'}).click();await expect(page.locator('[data-fx-status]')).toContainText('Playing');
 expect(await page.evaluate(()=>window.__fxContexts.some(c=>c.state==='running'))).toBe(true);
 await page.getByRole('button',{name:'Close FX-MIC Studio'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__fxContexts.every(c=>c.state==='closed'))).toBe(true);
 expect(await page.evaluate(()=>window.__fxRequests)).toBe(0);
});

test('importing a different JSON chain stops the old audition graph',async({page})=>{
 await page.addInitScript(()=>{
  const Base=window.AudioContext;window.__fxContexts=[];window.AudioContext=class extends Base{constructor(...args){super(...args);window.__fxContexts.push(this);}};
 });
 await open(page);await page.getByLabel('WAV slot 1').setInputFiles({name:'1.wav',mimeType:'audio/wav',buffer:wav()});
 await page.getByRole('button',{name:'Audition sample through FX'}).click();await expect(page.locator('[data-fx-status]')).toContainText('Playing');
 const replacement={name:'Imported',samples:[{file:'1.wav'}],presets:[{list:[{effect:'DIST',amount:20}]}]};
 await page.getByLabel('Import ZIP or config').setInputFiles({name:'config.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
 await expect(page.getByLabel('Pack name')).toHaveValue('Imported');
 await expect.poll(()=>page.evaluate(()=>window.__fxContexts.every(c=>c.state==='closed'))).toBe(true);
});

test('invalid inherited modulation target cannot replace the working pack',async({page})=>{
 await open(page);await page.getByLabel('Pack name').fill('PRESERVED');await page.getByLabel('Pack name').press('Tab');
 const config={name:'BAD',presets:[{list:[{effect:'LOWPASS'}],handle:{row:0,param:'constructor',depth:.5}}]};
 await page.getByLabel('Import ZIP or config').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(config))});
 await expect(page.locator('[data-fx-error]')).toContainText('unknown target parameter');
 await expect(page.getByLabel('Pack name')).toHaveValue('PRESERVED');await expect(page.getByLabel('Handle target')).toHaveValue('');
});

test('factory config omits detached audio from ZIP and undo restores it',async({page})=>{
 await open(page);
 await page.getByLabel('WAV slot 1').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:wav()});
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.100 s');
 const config={name:'Factory',presets:[{list:[{effect:'SAMPLE'}]}]};
 await page.getByLabel('Import ZIP or config').setInputFiles({
  name:'config.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(config))
 });
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('Factory sample');
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export ZIP'}).click();
 const zip=await download;
 const{readFile}=await import('node:fs/promises');
 const{readPack}=await import('../../js/fxMic/pack.js');
 expect((await readPack(await readFile(await zip.path()))).files.size).toBe(0);
 await page.getByRole('button',{name:'Undo edit'}).click();
 await expect(page.locator('[data-fx-slot="0"]')).toContainText('0.100 s');
});

test('local overwrite asks first and cancellation preserves the previous WAV',async({page})=>{
 await open(page);
 const slot=page.getByLabel('WAV slot 1'),sample=page.locator('[data-fx-slot="0"]');
 const save=page.getByRole('button',{name:'Save local pack'});
 await slot.setInputFiles({name:'first.wav',mimeType:'audio/wav',buffer:wav()});
 await expect(sample).toContainText('0.100 s');
 await save.click();
 await expect(page.locator('[data-fx-status]')).toContainText('Saved locally');
 const replacement=Buffer.from(encodePcmWav(new Float32Array(4410),{sampleRate:22050,channels:1}));
 await slot.setInputFiles({name:'second.wav',mimeType:'audio/wav',buffer:replacement});
 await expect(sample).toContainText('0.200 s');
 let confirmation;
 page.once('dialog',async dialog=>{
  confirmation=dialog.message();
  await dialog.dismiss();
 });
 await save.click();
 await expect(page.locator('[data-fx-status]')).toHaveText('Local save cancelled');
 expect(confirmation).toContain('MY FX-MIC PACK');
 await page.getByRole('button',{name:'Load local pack'}).click();
 await expect(sample).toContainText('0.100 s');
});

test('Ctrl+C REPL interrupt consent is single-use and clears when Live closes',async({page})=>{
 await open(page);
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await page.getByLabel('Stock firmware').selectOption('1.1.2');
 const checkbox=page.locator('[data-live-repl-consent]');
 await checkbox.check();
 await page.getByRole('button',{name:'Emulation',exact:true}).click();
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await expect(checkbox).not.toBeChecked();
 await checkbox.check();
 await page.getByRole('button',{name:'Close FX-MIC Studio'}).click();
 await page.locator('#fx-mic-icon').click();
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await expect(page.locator('[data-live-repl-consent]')).not.toBeChecked();
});

test('hardware trial connects explicitly and verifies change and restore through Web Serial',async({page})=>{
 await page.addInitScript(()=>{
  window.fxCommands=[];let cutoff=.4,reader;
  const port={
   getInfo:()=>({usbVendorId:0x2367,usbProductId:0x0620}),open:async()=>{reader.enqueue(new TextEncoder().encode('>>> '));},close:async()=>{},
   readable:new ReadableStream({start(controller){reader=controller;}}),
   writable:new WritableStream({write(bytes){
    const command=new TextDecoder().decode(bytes).trim();
    window.fxCommands.push(command);
    let reply='';
    if(command.includes('implementation.name'))reply='micropython';
    else if(command.includes('_machine'))reply='EP-2350 1.0.8';
    else if(command==='print(teenage.fx_pos)')reply='0';
    else if(command.startsWith('fx.list_loaded('))reply='0 [ 1 LOWPASS ]\n cutoff '+cutoff;
    else if(command.startsWith('print(fx.param')){
     cutoff=Number(command.match(/"cutoff", ([0-9.]+)/)[1]);reply='None';
    }
    reader.enqueue(new TextEncoder().encode(command+'\r\n'+reply+'\r\n>>> '));
   }})
  };
  Object.defineProperty(navigator,'serial',{value:{requestPort:async()=>port},configurable:true});
 });
 await open(page);
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await page.getByLabel('Stock firmware').selectOption('1.0.8');
 expect(await page.evaluate(()=>window.fxCommands)).toEqual([]);
 await page.getByRole('button',{name:'Connect EP-2350'}).click();
 await expect(page.locator('[data-live-state]')).toContainText('ready · EP-2350 · 1.0.8');
 const apply=page.getByRole('button',{name:'Apply one test change'});
 await expect(apply).toBeDisabled();
 await page.getByRole('checkbox',{name:'I backed up the mic and selected an expendable preset.'}).check();
 await apply.click();
 await expect(page.locator('[data-live-state]')).toContainText('verified');
 await expect(page.getByText('Readback matched.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Restore original cutoff'}).click();
 await expect(page.getByText('Readback matched the original cutoff.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>window.fxCommands.filter(command=>command.startsWith('print(fx.param')))).toHaveLength(2);
 await page.getByRole('button',{name:'Disconnect',exact:true}).click();
 await expect(page.locator('[data-live-state]')).toHaveText('disconnected');
});

test('stock FX-MIC 1.1.2 imports reference-shaped config without hardware writes',async({page})=>{
 await page.addInitScript(()=>{
  window.fxCommands=[];let reader;
  const config=JSON.stringify({name:'BROKEN RADIO PACK',samples:[{pos:0,file:'1.wav'}],presets:[
   {pos:0,name:'WALKIE >>> Error',list:[{effect:'HIGHPASS',cutoff:.1,deviceSpecific:3},
     {effect:'LOWPASS',cutoff:.4},{effect:'SAMPLE'}],handle:{row:1,param:'cutoff',depth:.5}},
   {pos:1,name:'AM TUNER',list:[{effect:'SSB',frequency:-500},{effect:'SAMPLE'}]},
   {pos:2,name:'EMPTY',list:[]},
   {pos:3,name:'FUTURE',list:[{effect:'FUTURE_FX',magic:9}]}]});
  const port={
   getInfo:()=>({usbVendorId:0x2367,usbProductId:0x0620}),
   open:async()=>{reader.enqueue(new TextEncoder().encode('>>> '));},close:async()=>{},
   readable:new ReadableStream({start(controller){reader=controller;}}),
   writable:new WritableStream({write(bytes){
    const command=new TextDecoder().decode(bytes).trim();window.fxCommands.push(command);
    let reply='';
    if(command.includes('implementation.name'))reply='micropython';
    else if(command.includes('_machine'))reply='EP-2350 1.1.2';
    else if(command==='print(teenage.fx_pos)')reply='0';
    else if(command==='print(os.stat("/fat/config.json")[6])')reply=String(new TextEncoder().encode(config).length);
    else if(command==='print(len(_ko_json.encode("utf-8")))')reply=String(new TextEncoder().encode(config).length);
    else if(command==='print(len(_ko_json))')reply=String(config.length);
    else if(command.startsWith('print(json.dumps(_ko_json[')){
     const range=command.match(/\[(\d+):(\d+)\]/);
     reply=JSON.stringify(config.slice(Number(range[1]),Number(range[2])))
      .replaceAll('>',String.fromCharCode(92)+'u003e');
    }
    reader.enqueue(new TextEncoder().encode(command+'\r\n'+reply+'\r\n>>> '));
   }})
  };
  Object.defineProperty(navigator,'serial',{value:{requestPort:async()=>port},configurable:true});
 });
 await open(page);
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await page.getByLabel('Stock firmware').selectOption('1.1.2');
 await page.getByRole('button',{name:'Connect EP-2350'}).click();
 await expect(page.locator('[data-live-state]')).toContainText('ready · EP-2350 · 1.1.2');
 await expect(page.locator('[data-live-state]')).toContainText('stored config · selected slot 1');
 await expect(page.getByRole('button',{name:'Apply one test change'})).toHaveCount(0);
 await expect(page.locator('[data-fx-device-config]')).toContainText('BROKEN RADIO PACK');
 await expect(page.locator('[data-fx-device-config]')).toContainText('WALKIE >>> Error');
 await expect(page.locator('[data-fx-saved-rows]')).toContainText('HIGHPASS cutoff: 0.1');
 await expect(page.locator('[data-fx-saved-rows]')).toContainText('deviceSpecific: 3');
 await expect(page.locator('[data-fx-modulation]')).toContainText('depth: 0.5');
 await page.getByLabel('Saved FX preset to inspect').selectOption('1');
 await expect(page.locator('[data-fx-saved-rows]')).toContainText('frequency: -500');
 await page.getByLabel('Saved FX preset to inspect').selectOption('0');
 await expect(page.locator('[data-fx-samples]')).toContainText('1.wav');

 await expect(page.locator('[data-fx-device-config]')).toContainText('AM TUNER');
 await expect(page.locator('[data-fx-device-config]')).toContainText('saved FX presets');
 await expect(page.locator('[data-fx-error]')).toBeEmpty();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download saved config.json'}).click();
 const configFile=await download;
 expect(configFile.suggestedFilename()).toBe('config.json');
 const {readFile}=await import('node:fs/promises');
 const saved=JSON.parse(await readFile(await configFile.path(),'utf8'));
 expect(saved.presets[0].list[0].deviceSpecific).toBe(3);
 expect(saved.samples[0].file).toBe('1.wav');
 const commands=await page.evaluate(()=>window.fxCommands);
 expect(commands.some(cmd=>cmd.includes('open("/fat/config.json", "r")'))).toBe(true);
 expect(commands.filter(cmd=>cmd.startsWith('print(json.dumps(_ko_json[')).length).toBeGreaterThan(0);
 expect(commands.some(cmd=>cmd.startsWith('fx.load_preset')||cmd.startsWith('fx.list_loaded')||
   cmd.startsWith('fx.list_preset')||cmd.startsWith('print(fx.param')||cmd.includes('open("/fat/config.json", "w")'))).toBe(false);
 await page.getByRole('button',{name:'Disconnect',exact:true}).click();
 await expect(page.locator('[data-live-state]')).toHaveText('disconnected');
});

test('stock read-only 1.1.2 presets can become a validated local draft without hardware writes',async({page})=>{
 await page.addInitScript(()=>{
  window.fxCommands=[];let reader;let closed=false;
  window.getFxClosed=()=>closed;
  const config=JSON.stringify({name:'BROKEN RADIO PACK',presets:[
   {pos:0,name:'WALKIE TALKIE',comment:'bandpass filter',list:[
    {effect:'HIGHPASS',cutoff:.1},{effect:'LOWPASS',cutoff:.4},{effect:'SAMPLE'}],
    handle:{row:1,param:'cutoff',depth:.5},trigger:{row:2}},
   {pos:1,name:'AM TUNER',list:[{effect:'SSB',frequency:-500},{effect:'SAMPLE'}]},
   {pos:2,name:'CRYPTIC',list:[{effect:'RING',frequency:100,mix:.8},{effect:'SAMPLE'}]},
   {pos:3,name:'LOSING SIGNAL',list:[{effect:'BALANCE',balance:.5},{effect:'SAMPLE'}]}
  ]});
  const port={
   getInfo:()=>({usbVendorId:0x2367,usbProductId:0x0620}),
   open:async()=>{reader.enqueue(new TextEncoder().encode('>>> '));},
   close:async()=>{closed=true;},
   readable:new ReadableStream({start(c){reader=c;}}),
   writable:new WritableStream({write(bytes){
    const cmd=new TextDecoder().decode(bytes).trim();window.fxCommands.push(cmd);
    let reply='';
    if(cmd.includes('implementation.name'))reply='micropython';
    else if(cmd.includes('_machine'))reply='EP-2350 1.1.2';
    else if(cmd==='print(teenage.fx_pos)')reply='0';
    else if(cmd==='print(os.stat("/fat/config.json")[6])'||cmd==='print(len(_ko_json.encode("utf-8")))')reply=String(new TextEncoder().encode(config).length);
    else if(cmd==='print(len(_ko_json))')reply=String(config.length);
    else if(cmd.startsWith('print(json.dumps(_ko_json[')){
     const m=cmd.match(/\[(\d+):(\d+)\]/);
     reply=JSON.stringify(config.slice(Number(m[1]),Number(m[2])))
      .replaceAll('>',String.fromCharCode(92)+'u003e');
    }
    reader.enqueue(new TextEncoder().encode(cmd+'\r\n'+reply+'\r\n>>> '));
   }})
  };
  Object.defineProperty(navigator,'serial',{value:{requestPort:async()=>port},configurable:true});
 });
 await open(page);
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await page.getByLabel('Stock firmware').selectOption('1.1.2');
 await page.getByRole('button',{name:'Connect EP-2350'}).click();
 await expect(page.locator('[data-live-state]')).toContainText('ready');
 page.once('dialog',async dialog=>dialog.accept());
 await page.getByRole('button',{name:'Open as offline draft'}).click();
 await expect(page.getByLabel('Preset name')).toHaveValue('WALKIE TALKIE');
 await expect(page.getByLabel('Preset notes')).toHaveValue('bandpass filter');
 await expect(page.locator('[data-fx-pane="presets"]')).toBeVisible();
 expect(await page.evaluate(()=>window.getFxClosed())).toBe(true);
 const commands=await page.evaluate(()=>window.fxCommands);
 expect(commands.some(cmd=>cmd.includes('fx.param')||cmd.includes('fx.load_preset')||cmd.includes('open("/fat/config.json", "w")'))).toBe(false);
});
