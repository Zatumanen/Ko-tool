import{test,expect}from '@playwright/test';
import{fileURLToPath}from 'node:url';
import{readFile}from 'node:fs/promises';

// All writable scenarios are synthetic. Serve the real DOM without app boot,
// then compose real controllers/runtime/FILE transport through test-only services.
// Production entry is exercised separately and never receives write authority.
const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const fakePath=fileURLToPath(new URL('./fake-ep-browser.js',import.meta.url));
const installed=new WeakSet(),pageErrors=new WeakMap();
test.beforeEach(({page})=>{const errors=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));});
test.afterEach(({page})=>expect(pageErrors.get(page)).toEqual([]));
const open=async(page,{production=false,firmware='2.5.1'}={})=>{
  if(!installed.has(page)){
    const fake=await readFile(fakePath,'utf8');
    await page.addInitScript({content:fake+'\nwindow.__fakeEp.setFirmware('+JSON.stringify(firmware)+');\nfor(const pad of JSON.parse(sessionStorage.getItem("syntheticPadState")||"[]"))window.__fakeEp.changePad(pad.id,pad.meta,{emit:false});'});
    if(!production)await page.route('http://127.0.0.1:4173/',route=>route.fulfill({contentType:'text/html',body:html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')}));
    installed.add(page);
  }
  await page.goto('/');
  if(production){
    await page.locator('#my-ep-icon').click();
    await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
    await expect(page.locator('[data-slot="7"]')).toHaveAttribute('draggable','true');
    await page.locator('[data-slot="7"]').click({button:'right'});
    if(firmware==='2.5.1')await page.locator('[data-edit-assigned-pad]').click();return;
  }
  await page.evaluate(async()=>{
    const [device,transport,{deviceRuntime},bridge,{createPadMetadataRuntime},{createPadRecoveryStore},{createPadPropertiesController},{createPadRecoveryController},{createDevicePadSelectionController},{getEpBrowserDom}]=await Promise.all([
      import('/js/ep133/device.js?v=20261001-1'),import('/js/ep133/fileTransport.js?v=20261001-1'),import('/js/ep133/deviceRuntime.js'),import('/js/ep133/deviceRecoveryRuntimeBridge.js'),import('/js/ep133/padMetadataRuntime.js'),import('/js/ep133/padRecovery.js'),import('/js/ep133/ui/padPropertiesController.js'),import('/js/ep133/ui/padRecoveryController.js'),import('/js/ep133/ui/devicePadSelectionController.js'),import('/js/ep133/ui/domRegistry.js')]);
    deviceRuntime.dispatch({type:'OWNERSHIP_ACQUIRED'});
    const store=createPadRecoveryStore(),errors=[];
    const hydrate=()=>bridge.syncDeviceRuntimeRecovery({runtime:deviceRuntime,deviceInfo:device.getConnectedDeviceInfo(),listSampleTransactions:async()=>[],listProjectCheckpoints:async()=>[],listPadTransactions:()=>store.list()});
    bridge.setDeviceRecoveryRescanHandler(hydrate);
    await device.connectEp133();await hydrate();
    const runtime=createPadMetadataRuntime({withFileTransaction:transport.withFileTransportTransaction,getConnectedDeviceInfo:device.getConnectedDeviceInfo,getDeviceSessionToken:device.getDeviceSessionToken,recoveryStore:store,onRecoveryEvent:bridge.publishPadRecoveryEvent,getPadMetadataAvailability:()=>({read:true,write:true,reason:'SYNTHETIC TEST ONLY'})});
    window.__fakeEp.changeSampleMetadata(7,{'sound.pitch':3,'sound.playmode':'key','time.mode':'bar','envelope.release':100});
    const source=deviceRuntime.getSnapshot().status==='ready'?await transport.withFileTransportTransaction('confirmed synthetic library source',ops=>ops.getFileMetadata(7)):null;
    const dom=getEpBrowserDom(document),captureSession=device.getDeviceSessionToken;
    const assertSession=token=>{if(!token||token!==captureSession())throw Error('Device session changed.');};
    let heldPad=null,held=[],started=[];
    const controller=createPadPropertiesController({dom,getAvailability:()=>({read:true,write:true}),readTargets:runtime.listTargets,readTarget:async target=>{
      const result=await runtime.readTarget(target);started.push(target.padFid);
      if(target.padFid===heldPad)await new Promise(resolve=>held.push(resolve));return result;
    },applyPadMetadata:runtime.apply,captureSession,assertSession,reportError:(_,error)=>errors.push(error.message)});
    const recovery=createPadRecoveryController({dom,listRecords:runtime.listRecords,verify:runtime.verify,acknowledge:runtime.acknowledge,restore:runtime.restore,confirmAction:message=>window.confirm(message),reportError:(_,error)=>errors.push(error.message)});
    const selection=createDevicePadSelectionController({isConnected:device.isConnected,isSynchronized:()=>true,withFileTransaction:transport.withFileTransportTransaction,captureBatchSession:captureSession,assertBatchSession:assertSession,onActivePad:controller.handleActivePad});
    device.onFileEvent(event=>{controller.handleFileEvent(event);selection.handleFileEvent(event);});
    device.onConnectionChange(state=>{if(!state.connected){controller.reset();selection.reset();recovery.reset();}});
    window.__padTest={runtime,store,controller,recovery,errors,hydrate,deviceRuntime,
      open:()=>controller.openFromSample(7,{confirmedLibraryMetadata:source}),
      hold:fid=>{heldPad=fid;started=[];},started:()=>started.slice(),release:()=>{heldPad=null;held.splice(0).forEach(resolve=>resolve());},
      recover:async()=>{dom.backupDialog.hidden=false;await recovery.refresh();},
      reconnect:async()=>{window.__fakeEp.reconnect();await device.connectEp133();await hydrate();}};
    await window.__padTest.open();
  });
};
const choose=async(page,project='01',group='A',pad='01')=>{
  await page.locator('#ep133-pad-project').selectOption(project);
  await page.locator('#ep133-pad-group').selectOption(group);
  await page.locator('#ep133-pad-select').selectOption(pad);
  await expect(page.locator('#ep133-pad-assignment')).toContainText(`PROJECT ${project} / ${group} / ${pad}`);
};
const state=page=>page.evaluate(()=>({pads:window.__fakeEp.padSnapshot(),samples:window.__fakeEp.snapshot()}));
const sets=page=>page.evaluate(()=>window.__fakeEp.requestLog.filter(r=>r.command===5&&r.sub===7&&r.type===1).map(r=>({fid:r.raw[2]*256+r.raw[3],payload:JSON.parse(new TextDecoder().decode(Uint8Array.from(r.raw.slice(4,-1))))})));
const saved=page=>expect(page.locator('#ep133-pad-status')).toContainText('SAVED ON EP · READBACK VERIFIED');
const plus=(page,key)=>page.locator(`#ep133-pad-grid [data-property="${key}"][data-direction="1"]`);

test('explicit choose/apply copies three property families to one wire pad; second pad and library stay unchanged',async({page})=>{
  await open(page);const before=await state(page);await choose(page);
  expect(await sets(page)).toEqual([]);
  await page.locator('#ep133-pad-apply').click();await saved(page);
  const after=await state(page),wire=await sets(page);
  expect(wire).toHaveLength(1);expect(wire[0].fid).toBe(6207);
  expect(after.pads[0].meta).toEqual({...before.pads[0].meta,'sound.pitch':3,'sound.playmode':'key','time.mode':'bar','envelope.release':100});
  expect(wire[0].payload).toEqual(after.pads[0].meta);
  expect(after.pads.slice(1)).toEqual(before.pads.slice(1));expect(after.samples).toEqual(before.samples);
  for(const[key,value]of [['sound.pitch',4],['sound.playmode','legato'],['time.mode','off']]){
    await plus(page,key).click();await expect.poll(async()=>(await state(page)).pads[0].meta[key]).toBe(value);await saved(page);
  }
  expect((await sets(page)).map(s=>s.fid)).toEqual([6207,6207,6207,6207]);
  expect((await state(page)).pads.slice(1)).toEqual(before.pads.slice(1));expect((await state(page)).samples).toEqual(before.samples);
});

test('continuous pitch gesture writes only its final release value and retains target during hardware navigation',async({page})=>{
  await open(page);await choose(page);
  const value=page.locator('#ep133-pad-grid [data-pad-pitch]'),box=await value.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2-18,{steps:6});
  await expect(page.locator('#ep133-pad-status')).toContainText('RELEASE TO SAVE');
  await page.evaluate(()=>window.__fakeEp.selectPad(7312));
  await expect(page.locator('#ep133-pad-status')).toContainText('TARGET RETAINED');
  expect(await sets(page)).toEqual([]);
  await page.mouse.up();await saved(page);
  expect((await sets(page)).map(s=>s.fid)).toEqual([6207]);expect((await state(page)).pads[0].meta['sound.pitch']).toBe(6);
});

test('hardware metadata refreshes UI and A→B deferred→C follows latest target without old-target write',async({page})=>{
  await open(page);await choose(page);
  await page.evaluate(()=>window.__fakeEp.changePad(6207,{'sound.pitch':-4}));
  await expect(page.locator('#ep133-pad-grid [data-pad-pitch]')).toHaveText('-4');
  await page.evaluate(()=>{window.__padTest.hold(7312);window.__fakeEp.selectPad(7312);});
  await expect.poll(()=>page.evaluate(()=>window.__padTest.started().includes(7312))).toBe(true);
  await expect(page.locator('#ep133-pad-grid [data-property]')).toHaveCount(0);
  await expect(page.locator('#ep133-pad-apply')).toBeDisabled();
  await page.locator('#ep133-pad-apply').dispatchEvent('click');expect(await sets(page)).toEqual([]);
  await page.evaluate(()=>window.__fakeEp.selectPad(7313));
  await expect(page.locator('#ep133-pad-assignment')).toContainText('PROJECT 02 / B / 11');
  await expect(page.locator('#ep133-pad-source')).toContainText('cleared');
  await page.evaluate(()=>window.__padTest.release());
  await expect(page.locator('#ep133-pad-assignment')).toContainText('PROJECT 02 / B / 11');
  await expect(page.locator('#ep133-pad-grid [data-pad-pitch]')).toHaveText('-2');
  expect(await sets(page)).toEqual([]);
  await plus(page,'sound.pitch').click();await saved(page);
  expect((await sets(page)).map(item=>item.fid)).toEqual([7313]);
  expect((await state(page)).pads[0].meta['sound.pitch']).toBe(-4);
});

for(const firmware of ['2.5.1','9.9.9'])test(`normal app denies pad writes on firmware ${firmware}`,async({page})=>{
  await open(page,{production:true,firmware});
  const permission=await page.evaluate(async()=>(await import('/js/ep133/filesystem.js?v=20261001-1')).getPadMetadataAvailability());
  expect(permission.write).toBe(false);expect(permission.reason).toBeTruthy();
  if(firmware==='2.5.1'){
    expect(permission.read).toBe(true);
    await choose(page);await expect(page.locator('#ep133-pad-reason')).toContainText('not hardware-verified');
    const controls=page.locator('#ep133-pad-grid [data-property]');
    expect(await controls.count()).toBeGreaterThan(0);
    for(const control of await controls.all())await expect(control).toBeDisabled();
  }else{
    // The normal app refuses unknown firmware at the library menu before pad discovery.
    await expect(page.getByRole('alertdialog')).toContainText('SAMPLE PROPERTIES ARE NOT VERIFIED');
    await expect(page.locator('#ep133-pad-dialog')).toBeHidden();
    // Future numeric firmware passes the handshake floor and remains pad-read-only.
    expect(permission.read).toBe(true);
  }
  await expect(page.locator('#ep133-pad-apply')).toBeDisabled();
  await page.locator('#ep133-pad-apply').dispatchEvent('click');
  expect(await sets(page)).toEqual([]);
});

test('stale target snapshot refuses before SET and preserves hardware change',async({page})=>{
  await open(page);await choose(page);
  await page.evaluate(()=>window.__fakeEp.changePad(6207,{'sound.pan':11},{emit:false}));
  await page.locator('#ep133-pad-apply').click();
  await expect(page.locator('#ep133-pad-status')).toContainText('Stale pad snapshot');
  expect(await sets(page)).toEqual([]);expect((await state(page)).pads[0].meta['sound.pan']).toBe(11);
});

for(const fault of ['ignore','clobber','disconnect'])test(`ambiguous ${fault} SET keeps durable recovery and never replays on reconnect/reload`,async({page})=>{
  await open(page);await choose(page);
  await page.evaluate(fault=>window.__fakeEp.faultNextPadSet(fault),fault);
  await page.locator('#ep133-pad-apply').click();
  if(fault!=='disconnect')await expect(page.locator('#ep133-pad-status')).toContainText('requires recovery');
  await expect.poll(()=>page.evaluate(async()=>(await window.__padTest.store.list())[0]?.status)).toBe('requires-recovery');
  expect(await sets(page)).toHaveLength(1);
  if(fault==='disconnect'){
    await expect(page.locator('#ep133-pad-dialog')).toBeHidden();
    await page.evaluate(()=>window.__padTest.reconnect());
    expect(await sets(page)).toHaveLength(1);
    expect(await page.evaluate(()=>window.__padTest.deviceRuntime.getSnapshot().recovery.transaction.source)).toBe('pad');
  }
  // Preserve the external synthetic device model while rebuilding browser state.
  await page.evaluate(()=>sessionStorage.setItem('syntheticPadState',JSON.stringify(window.__fakeEp.padSnapshot())));
  await open(page);
  expect(await sets(page)).toEqual([]);
  expect(await page.evaluate(()=>window.__padTest.deviceRuntime.getSnapshot().status)).toBe('recovery-required');
  await page.evaluate(()=>window.__padTest.recover());
  const id=await page.evaluate(async()=>(await window.__padTest.store.list())[0].id);
  await page.locator('#ep133-pad-recovery-list').selectOption(id);
  await page.locator('#ep133-pad-recovery-verify').click();
  await expect(page.locator('#ep133-pad-recovery-detail')).toContainText('CURRENT {');
  const verified=await page.evaluate(async()=>(await window.__padTest.store.list())[0]);
  expect(verified.verification.classification).toBe(fault==='ignore'?'before':fault==='clobber'?'diverged':'desired');
  expect(verified.verification.metadata).toEqual((await state(page)).pads[0].meta);
  expect(await sets(page)).toEqual([]);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#ep133-pad-recovery-acknowledge').click();
  await expect(page.locator('#ep133-pad-recovery-detail')).toContainText('acknowledged');
  await expect.poll(()=>page.evaluate(()=>window.__padTest.deviceRuntime.getSnapshot().status)).toBe('ready');
  expect(await sets(page)).toEqual([]);
  if(fault==='ignore'){
    page.once('dialog',dialog=>dialog.dismiss());
    await page.locator('#ep133-pad-recovery-restore').click();
    await expect(page.locator('#ep133-pad-recovery-restore')).toBeEnabled();expect(await sets(page)).toEqual([]);
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#ep133-pad-recovery-restore').click();
    await expect.poll(()=>page.evaluate(async()=>(await window.__padTest.store.list()).some(record=>record.restoresRecordId&&record.status==='verified'))).toBe(true);
    expect((await sets(page)).map(s=>s.fid)).toEqual([6207]);
  }else if(fault==='clobber'){
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#ep133-pad-recovery-restore').click();
    await expect(page.locator('#ep133-pad-recovery-detail')).toContainText('refuses changed protected fields');
    expect(await sets(page)).toEqual([]);
  }
});

test('disconnect cancels an unfinished gesture and reconnect never replays it',async({page})=>{
  await open(page);await choose(page);
  const box=await page.locator('#ep133-pad-grid [data-pad-pitch]').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2-15);
  await expect(page.locator('#ep133-pad-status')).toContainText('RELEASE TO SAVE');
  await page.evaluate(()=>window.__fakeEp.disconnect());
  await expect(page.locator('#ep133-pad-dialog')).toBeHidden();
  await page.evaluate(()=>window.__padTest.reconnect());await page.mouse.up();
  await page.evaluate(()=>window.__padTest.open());await choose(page);
  await expect(page.locator('#ep133-pad-grid [data-pad-pitch]')).toHaveText('0');
  expect(await sets(page)).toEqual([]);
});
