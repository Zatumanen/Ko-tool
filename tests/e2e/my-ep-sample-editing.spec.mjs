import{test,expect}from '@playwright/test';
import{fileURLToPath}from 'node:url';

const open=async page=>{
  await page.addInitScript({path:fileURLToPath(new URL('./fake-ep-browser.js',import.meta.url))});
  await page.goto('/');
  await page.locator('#my-ep-icon').click();
  await expect(page.locator('#ep133-browser')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#ep133-status')).toContainText('SYNCED',{timeout:12000});
  await expect(page.locator('#ep133-status')).not.toContainText('LOADING');
  await expect(page.locator('[data-slot="7"]')).toHaveAttribute('draggable','true');
};

test('pitch, play mode and time mode write to the device and survive reopening My EP',async({page})=>{
  await open(page);
  await page.locator('[data-slot="7"]').click({button:'right'});
  await expect(page.locator('.ep133-properties-scope')).toContainText('ASSIGNED PADS KEEP THEIR OWN SETTINGS.');
  const pitch=page.locator('[data-property-row="sound.pitch"]');
  await expect(pitch.locator('.ep133-prop-value')).toHaveText('0');
  await pitch.getByRole('button',{name:'Increase PITCH'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta['sound.pitch'])).toBe(1);
  await expect(pitch).not.toHaveClass(/pending/);
  await page.locator('[data-property-row="sound.playmode"]').getByRole('button',{name:'Next PLAY MODE'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta['sound.playmode'])).toBe('key');
  await page.locator('[data-property-row="time.mode"]').getByRole('button',{name:'Next TIME MODE'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta['time.mode'])).toBe('bpm');
  await expect(page.locator('[data-property-status]')).toHaveText('SAVED ON EP');
  await page.locator('#ep133-close').click();
  await page.locator('#my-ep-icon').click();
  await page.locator('[data-slot="7"]').click({button:'right'});
  await expect(pitch.locator('.ep133-prop-value')).toHaveText('+1');
  await expect(page.locator('[data-property-row="sound.playmode"] .ep133-prop-value')).toHaveText('KEY');
  await expect(page.locator('[data-property-row="time.mode"] .ep133-prop-value')).toHaveText('BPM');
});

test('an ignored device property update is reported and does not remain in My EP',async({page})=>{
  await open(page);
  const original=await page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta);
  await page.evaluate(()=>window.__fakeEp.ignoreNextMetadataSet());
  await page.locator('[data-slot="7"]').click({button:'right'});
  const pitch=page.locator('[data-property-row="sound.pitch"]');
  await pitch.getByRole('button',{name:'Increase PITCH'}).click();
  await expect(page.locator('[data-property-status]')).toContainText('NOT SAVED');
  await expect(page.locator('[data-property-status]')).toContainText('EP did not confirm sample property sound.pitch');
  await expect(pitch.locator('.ep133-prop-value')).toHaveText('0');
  expect(await page.evaluate(()=>window.__fakeEp.snapshot().find(s=>s.id===7).meta)).toEqual(original);
});

test('clicking outside My EP clears sample selection but properties retain their target',async({page})=>{
  await open(page);
  await page.locator('[data-slot="7"] .ep133-sample-number').click();
  await page.locator('[data-slot="8"] .ep133-sample-number').click({modifiers:['Control']});
  await expect(page.locator('.ep133-sample-row.selected,.ep133-sample-row.multi-selected')).toHaveCount(2);
  await page.locator('[data-slot="7"]').click({button:'right'});
  await page.locator('[data-property-row="sound.pitch"]').getByRole('button',{name:'Increase PITCH'}).click();
  await expect(page.locator('.ep133-sample-row.selected')).toHaveCount(1);
  await page.mouse.click(10,10);
  await expect(page.locator('.ep133-sample-row.selected,.ep133-sample-row.multi-selected')).toHaveCount(0);
  await expect(page.locator('#ep133-sample-waveform')).toBeDisabled();
  await expect(page.locator('#ep133-properties')).toBeHidden();
});

for(const width of [1280,850,600]){
  test(`waveform button stays inside My EP at viewport width ${width}`,async({page})=>{
    await open(page);
    await page.setViewportSize({width,height:800});
    const bounds=await page.locator('#ep133-sample-waveform').evaluate(button=>{
      const b=button.getBoundingClientRect(),panel=button.closest('.ep133-browser-window').getBoundingClientRect();
      return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,panelLeft:panel.left,panelRight:panel.right,panelBottom:panel.bottom,navHeight:button.parentElement.clientHeight};
    });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.panelLeft);
    expect(bounds.right).toBeLessThanOrEqual(bounds.panelRight);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.panelBottom);
  });
}
