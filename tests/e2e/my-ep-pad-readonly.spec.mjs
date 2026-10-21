import{test,expect}from '@playwright/test';
import{readFile}from 'node:fs/promises';

const fixture=await readFile(new URL('./fake-ep-browser.js',import.meta.url),'utf8');
const open=async(page,sku,os='2.5.1')=>{
  // Device identity fixture only. No evidence/profile override is injected.
  await page.addInitScript({content:fixture.replace("sku='TE032AS001'","sku='"+sku+"'").replace("osVersion='2.5.1'","osVersion='"+os+"'")});
  await page.goto('/');await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await expect(page.locator('#ep133-status')).not.toContainText('LOADING');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  await expect(page.locator('[data-slot="7"]')).toHaveAttribute('draggable','true');
  // Control-click selects without audition or opening the independent Sample Library properties editor.
  // Right-click raises a legitimate write-permission alert on some unsupported models/firmware.
  await page.locator('[data-slot="7"]').click({modifiers:['Control']});
  await expect(page.locator('[data-slot="7"]')).toHaveClass(/selected/);
  await expect(page.locator('#error-dialog')).toBeHidden();
};

for(const [sku,os] of [['TE032AS006','2.5.1'],['TE032AS005','2.5.1'],['TE032AS001','2.5.2']])test(sku+' '+os+': library opens a read-only pad view and missing READ evidence emits no FILE traffic',async({page})=>{
  await open(page,sku,os);
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.locator('#ep133-pad-open').click();
  const dialog=page.getByRole('dialog',{name:'Read-only Pad Parameters',exact:true});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#ep133-pad-source')).toContainText('SAMPLE LIBRARY 007');
  await expect(dialog.locator('#ep133-pad-assignment')).toContainText('NO PAD SELECTED');
  await expect(dialog.locator('#ep133-pad-status')).toContainText('Pad metadata READ is not authorized');
  for(const id of ['project','group','select'])await expect(dialog.locator('#ep133-pad-'+id)).toBeDisabled();
  await expect(dialog.locator('#ep133-pad-grid')).toBeEmpty();
  await expect(dialog.getByRole('button')).toHaveCount(1); // Close only; no hidden writer controls.
  for(const key of ['Delete','F2','ArrowDown','ArrowUp','Tab','Shift+Tab'])await page.keyboard.press(key);
  await expect(page.locator('[data-slot="7"]')).toHaveClass(/selected/);
  await expect(page.locator('#ep133-confirm-dialog')).toBeHidden();
  await expect(page.locator('#ep133-pad-close')).toBeFocused();
  await page.evaluate(()=>{
    const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(44)],'accidental.wav',{type:'audio/wav'}));
    window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));
    document.getElementById('ep133-pad-readonly-dialog').dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));
  });
  const traffic=await page.evaluate(index=>window.__fakeEp.requestLog.slice(index).filter(r=>r.command===5),before);
  expect(traffic).toEqual([]);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
});

test('closing pad view preserves Sample Library SET/GET and reopening has no stale pad values',async({page})=>{
  await open(page,'TE032AS001');await page.locator('#ep133-pad-open').click();
  await expect(page.locator('#ep133-pad-project')).toBeEnabled();
  await page.locator('#ep133-pad-close').click();
  await page.locator('[data-slot="7"]').click({button:'right'});
  await page.locator('[data-property-row="sound.pitch"]').getByRole('button',{name:'Increase PITCH'}).click();
  await expect(page.locator('[data-property-status]')).toHaveText('SAVED ON EP');
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta['sound.pitch'])).toBe(1);
  await page.locator('#ep133-pad-open').click();
  await expect(page.locator('#ep133-pad-grid')).toBeEmpty();
  await expect(page.locator('#ep133-pad-assignment')).toContainText('NO PAD SELECTED');
});

const selectPad=async page=>{
  await page.locator('#ep133-pad-open').click();
  await page.locator('#ep133-pad-project').selectOption('01');
  await page.locator('#ep133-pad-group').selectOption('A');
  await page.locator('#ep133-pad-select').selectOption('01');
  await expect(page.locator('#ep133-pad-status')).toHaveText('READ ONLY · AUTHORITATIVE PAD GET');
};
const assertReadOnly=traffic=>{
  const file=traffic.filter(r=>r.command===5);
  expect(file.length).toBeGreaterThan(0);
  for(const r of file){
    expect([1,4,7,11]).toContain(r.raw[0]);
    if(r.raw[0]===7)expect(r.raw[1]).toBe(2);
  }
  expect(file.some(r=>r.raw[0]===7&&r.raw[2]*256+r.raw[3]===3201)).toBe(true);
};
test('EP-133 OS 2.5.1 production UI reads its own pad metadata without any writer',async({page})=>{
  await open(page,'TE032AS001');
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await selectPad(page);
  await expect(page.locator('#ep133-pad-source')).toContainText('SAMPLE LIBRARY 007');
  await expect(page.locator('#ep133-pad-assignment')).toContainText('PROJECT 01 / GROUP A / PAD 01 · ASSIGNED SAMPLE 007');
  for(const [field,value] of [['sound.pitch','-2.25'],['sound.playmode','key'],['time.mode','bpm']])
    await expect(page.locator('[data-pad-field="'+field+'"]')).toHaveText(value);
  await expect(page.locator('#ep133-pad-select option[value="02"]')).toHaveText('02 · UNVERIFIED');
  await expect(page.getByRole('dialog',{name:'Read-only Pad Parameters',exact:true}).getByRole('button')).toHaveCount(1);
  await page.locator('#ep133-pad-select').selectOption('02');
  await expect(page.locator('#ep133-pad-status')).toContainText('ASSIGNMENT UNVERIFIED');
  await expect(page.locator('#ep133-pad-assignment')).toContainText('ASSIGNMENT UNVERIFIED');
  const libraryPitch=await page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta['sound.pitch']);
  expect(libraryPitch).not.toBe(-2.25);
  assertReadOnly(await page.evaluate(i=>window.__fakeEp.requestLog.slice(i),before));
});
test('disconnect invalidates pad snapshot and reconnect requires fresh selection',async({page})=>{
  await open(page,'TE032AS001');await selectPad(page);
  const before=await page.evaluate(()=>window.__fakeEp.requestLog.length);
  await page.evaluate(()=>window.__fakeEp.disconnect());
  await expect(page.locator('#ep133-pad-grid')).toBeEmpty();
  await expect(page.locator('#ep133-pad-status')).toContainText('STALE');
  await page.evaluate(()=>window.__fakeEp.reconnect());
  await expect(page.locator('#ep133-status')).toContainText('SYNCED');
  await expect(page.locator('#ep133-pad-grid')).toBeEmpty();
  await expect(page.locator('#ep133-pad-assignment')).toContainText('NO PAD SELECTED');
  const traffic=await page.evaluate(i=>window.__fakeEp.requestLog.slice(i),before);
  expect(traffic.filter(r=>r.command===5&&r.raw[0]===7&&r.raw[2]*256+r.raw[3]===3201)).toEqual([]);
});

test('unknown OS is rejected during handshake before any pad FILE discovery',async({page})=>{
  await page.addInitScript({content:fixture.replace("osVersion='2.5.1'","osVersion='unknown'")});
  await page.goto('/');
  const rejected=page.waitForEvent('console',{predicate:event=>event.type()==='error'&&/AUTO CONNECT/.test(event.text())&&/firmware/i.test(event.text())});
  await page.locator('#my-ep-icon').click();await rejected;
  // Session ownership can display a pre-connect notice after a rejected handshake;
  // verify connection state rather than a transient status string.
  await expect(page.locator('#ep133-status')).not.toContainText('SYNCED');
  expect(await page.evaluate(async()=>{
    const ep=await import('/js/ep133/index.js?v=20261001-1');
    return ep.isConnected();
  })).toBe(false);
  expect(await page.evaluate(()=>window.__fakeEp.requestLog.filter(r=>r.command===5))).toEqual([]);
  await expect(page.locator('#ep133-pad-readonly-dialog')).toBeHidden();
});
