import{test,expect}from '@playwright/test';
import{readFile}from 'node:fs/promises';

const fixture=await readFile(new URL('./fake-ep-browser.js',import.meta.url),'utf8');
const open=async(page,sku)=>{
  // Device identity fixture only. No evidence/profile override is injected.
  await page.addInitScript({content:fixture.replace("sku='TE032AS001'","sku='"+sku+"'")});
  await page.goto('/');await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await expect(page.locator('#ep133-status')).not.toContainText('LOADING');
  await expect(page.locator('#ep133-global-progress')).toBeHidden();
  await expect(page.locator('[data-slot="7"]')).toHaveAttribute('draggable','true');
  // Right click selects without auditioning the sample.
  await page.locator('[data-slot="7"]').click({button:'right'});
};

for(const sku of ['TE032AS001','TE032AS006'])test(sku+': library opens a read-only pad view and missing READ evidence emits no FILE traffic',async({page})=>{
  await open(page,sku);
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
  await expect(page.locator('#ep133-pad-status')).toContainText('READ is not authorized');
  await page.locator('#ep133-pad-close').click();
  await page.locator('[data-slot="7"]').click({button:'right'});
  await page.locator('[data-property-row="sound.pitch"]').getByRole('button',{name:'Increase PITCH'}).click();
  await expect(page.locator('[data-property-status]')).toHaveText('SAVED ON EP');
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta['sound.pitch'])).toBe(1);
  await page.locator('#ep133-pad-open').click();
  await expect(page.locator('#ep133-pad-grid')).toBeEmpty();
  await expect(page.locator('#ep133-pad-assignment')).toContainText('NO PAD SELECTED');
});
