import {test,expect} from '@playwright/test';

test('Sequencer step edits remain local, persistent across group selection and never connect to MIDI',async({page})=>{
 await page.goto('/os/index.html#os-sequencer');
 await expect(page.getByRole('heading',{name:'See the whole groove.'})).toBeVisible();
 await expect(page.getByText('LOCAL PATTERN DEMO')).toBeVisible();
 await expect(page.getByText('Nothing is transferred to KO II.')).toBeVisible();
 const first=page.getByRole('button',{name:'KICK step 1',exact:true});
 await expect(first).toHaveAttribute('aria-pressed','true');
 await first.click();
 await expect(first).toHaveAttribute('aria-pressed','false');
 await page.locator('#os-demo-group').selectOption('B');
 await expect(page.getByRole('button',{name:'KICK step 1',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('#os-demo-group').selectOption('A');
 await expect(page.getByRole('button',{name:'KICK step 1',exact:true})).toHaveAttribute('aria-pressed','false');
 await page.locator('#os-seq-play').click();
 await expect(page.locator('#os-seq-play')).toContainText('STOP');
 await page.locator('[data-view=samples]').click();
 await page.locator('[data-view=sequencer]').click();
 await expect(page.locator('#os-seq-play')).toContainText('PLAYHEAD');
 await expect(page.getByRole('button',{name:'KICK step 1',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(page.getByText('NO DEVICE SESSION')).toBeVisible();
});
