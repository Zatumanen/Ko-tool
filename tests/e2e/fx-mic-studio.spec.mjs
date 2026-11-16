import{test,expect}from '@playwright/test';
import{encodePcmWav}from '../../js/fxMic/wav.js';
const wav=()=>Buffer.from(encodePcmWav(Float32Array.from({length:2205},(_,i)=>Math.sin(i*.1)*.15),{sampleRate:22050,channels:1}));
const open=async page=>{await page.goto('/');await page.locator('#fx-mic-icon').click();await expect(page.getByRole('dialog',{name:'FX-MIC Studio'})).toBeVisible();};

test('desktop icons remain independently reachable at desktop and mobile widths',async({page})=>{
 for(const width of [1280,375]){
  await page.setViewportSize({width,height:900});await page.goto('/');
  const boxes=await page.locator('.app-icon').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j];expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y).toBe(true);
  }
 }
});

test('FX-MIC is a separate offline window; Live remains gated without hardware evidence',async({page})=>{
 await open(page);await expect(page.locator('[data-fx-slot]')).toHaveCount(4);
 await expect(page.getByLabel('FX preset')).toHaveValue('0');
 await expect(page.getByText('EMULATION · approximate browser audio')).toBeVisible();
 await page.getByRole('button',{name:'Live',exact:true}).click();
 await expect(page.getByRole('button',{name:'Connect EP-2350'})).toBeDisabled();
 await expect(page.locator('[data-fx-live]')).toContainText('No exact-firmware hardware acceptance');
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
