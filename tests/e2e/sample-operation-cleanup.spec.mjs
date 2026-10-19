import{test,expect}from '@playwright/test';

for(const cleanup of ['single','all']){
  test(`operation cleanup (${cleanup}) preserves a native sample drag in progress`,async({page})=>{
    await page.goto('/');
    await page.evaluate(async()=>{
      const{createSampleMemory,createSampleSlots}=await import('/js/ep133/sampleMemory.js');
      document.body.innerHTML='<style>.ep133-sample-row{display:flex;align-items:center;height:24px;width:500px}.ep133-sample-number{width:50px}.ep133-sample-size{width:80px}</style><main id="sample-list"></main>';
      const list=document.querySelector('#sample-list');
      const moves=[];
      const memory=createSampleMemory({
        listEl:list,
        onTransfer(sources,target,{copy}){
          moves.push({sources:sources.map(slot=>slot.id),target:target.id,copy});
          return{targetIds:[]};
        }
      });
      memory.projection.setSlots(createSampleSlots([
        {nodeId:8,fileName:'/sounds/8 snare',fileSize:80,isReadable:true},
        {nodeId:9,fileName:'/sounds/9 hat',fileSize:1024,isReadable:true},
        {nodeId:11,fileName:'/sounds/11 kick',fileSize:2048,isReadable:true}
      ]));
      memory.projection.setOperation(9,{status:'complete',label:'WRITTEN',progress:100});
      memory.projection.setOperation(11,{status:'complete',label:'WRITTEN',progress:100});
      memory.setMutationsEnabled(true);
      memory.selectSlots([8],{activeId:8,preview:false,navigate:false});
      window.__cleanupTest={memory,moves,rows:Object.fromEntries(
        [8,9,10,11].map(id=>[id,list.querySelector(`[data-slot="${id}"]`)])
      )};
    });

    const source=page.locator('[data-slot="8"]'),target=page.locator('[data-slot="10"]');
    const from=await source.boundingBox(),to=await target.boundingBox();
    await page.mouse.move(from.x+10,from.y+from.height/2);
    await page.mouse.down();
    await page.mouse.move(from.x+30,from.y+from.height,{steps:4});
    await page.mouse.move(to.x+10,to.y+to.height/2,{steps:8});
    await page.mouse.move(to.x+12,to.y+to.height/2);
    await expect(target).toHaveAttribute('data-transfer-action','move');

    const rowsSurvived=await page.evaluate(mode=>{
      const{memory,rows}=window.__cleanupTest;
      if(mode==='single')memory.projection.clearOperation(9);
      else memory.projection.clearOperations();
      return Object.entries(rows).every(([id,row])=>
        row.isConnected&&row===document.querySelector(`[data-slot="${id}"]`)
      );
    },cleanup);
    expect(rowsSurvived,'cosmetic cleanup must not replace the active drag source or its target').toBe(true);
    await expect(source).toHaveAttribute('draggable','true');
    await expect(source).toHaveClass(/selected/);
    await expect(page.locator('[data-slot="9"]')).not.toHaveClass(/operation-active/);
    await expect(page.locator('[data-slot="9"] .ep133-sample-size')).toHaveText('1.0 KB');
    if(cleanup==='single'){
      await expect(page.locator('[data-slot="11"]')).toHaveClass(/operation-active/);
    }else{
      await expect(page.locator('[data-slot="11"]')).not.toHaveClass(/operation-active/);
      await expect(page.locator('[data-slot="11"] .ep133-sample-size')).toHaveText('2.0 KB');
    }

    await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>window.__cleanupTest.moves)).toEqual([
      {sources:[8],target:10,copy:false}
    ]);
  });
}
