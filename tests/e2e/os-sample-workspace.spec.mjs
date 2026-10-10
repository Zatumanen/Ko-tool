import {test,expect} from '@playwright/test';

function sineWav(frames=24000,sr=48000){
 const o=Buffer.alloc(44+frames*2);
 o.write('RIFF',0);o.writeUInt32LE(o.length-8,4);
 o.write('WAVEfmt ',8);o.writeUInt32LE(16,16);
 o.writeUInt16LE(1,20);o.writeUInt16LE(1,22);
 o.writeUInt32LE(sr,24);o.writeUInt32LE(sr*2,28);
 o.writeUInt16LE(2,32);o.writeUInt16LE(16,34);
 o.write('data',36);o.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)o.writeInt16LE(Math.round(Math.sin(i*.15)*12000),44+i*2);
 return o;
}

test('OS Samples converts a real local WAV through the production x2 pipeline and downloads it',async({page})=>{
 await page.goto('/os/index.html');
 await expect(page.getByRole('heading',{name:'Sample laboratory'})).toBeVisible();
 await expect(page.locator('#os-download-button')).toBeDisabled();
 await expect(page.getByText('NO DEVICE SESSION')).toBeVisible();
 await page.locator('#os-audio-upload').setInputFiles({name:'kick-test.wav',mimeType:'audio/wav',buffer:sineWav()});
 await expect(page.locator('.os-file-entry')).toHaveCount(1,{timeout:60000});
 await expect(page.locator('#os-sample-name')).toHaveText('kick-test_x2.wav');
 await expect(page.locator('#os-storage-after')).not.toHaveText('—');
 await expect(page.locator('#os-storage-before')).not.toHaveText('—');
 await expect(page.locator('#os-sample-mode')).toHaveText('REAL AUDIO');
 await expect(page.locator('#os-download-button')).toBeEnabled();
 const [download]=await Promise.all([
  page.waitForEvent('download'),page.locator('#os-download-button').click()
 ]);
 expect(download.suggestedFilename()).toBe('kick-test_x2.wav');
 await expect(page.getByText('NO DEVICE SESSION')).toBeVisible();
});

test('OS uses live analyser only during real local audio playback, otherwise labels demo source',async({page})=>{
 await page.goto('/os/index.html');
 await expect(page.locator('#meter-source')).toContainText('DEMO SIGNAL');
 await page.locator('#os-audio-upload').setInputFiles({name:'preview.wav',mimeType:'audio/wav',buffer:sineWav(48000)});
 await expect(page.locator('#os-preview-button')).toBeEnabled({timeout:60000});
 await page.locator('#os-preview-button').click();
 await expect(page.locator('#meter-source')).toContainText('LOCAL WAV PLAYBACK',{timeout:7000});
 await page.locator('#os-preview-button').click();
 await expect(page.locator('#meter-source')).toContainText('DEMO SIGNAL');
});

test('OS designer view remains safe and usable after theme change and Samples revisit',async({page})=>{
 await page.goto('/os/index.html');
 await page.locator('#os-theme').click();
 await expect(page.locator('body')).toHaveAttribute('data-os-theme','classic');
 await page.locator('#os-nav-extras summary').click();
 await page.locator('[data-view=community]').click();
 await expect(page.getByRole('heading',{name:'Community',exact:true})).toBeVisible();
 await page.locator('[data-view=samples]').click();
 await expect(page.getByRole('heading',{name:'Sample laboratory'})).toBeVisible();
 await expect(page.locator('#os-download-button')).toBeDisabled();
 await expect(page.locator('#os-legacy')).toHaveAttribute('href','../index.html');
});
