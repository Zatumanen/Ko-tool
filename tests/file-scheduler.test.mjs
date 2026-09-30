import test from 'node:test';
import assert from 'node:assert/strict';
import{createFileScheduler}from '../js/ep133/fileScheduler.js';

const deferred=()=>{
  let resolve,reject;
  const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
  return{promise,resolve,reject};
};

test('FILE scheduler runs queued work strictly FIFO without overlap',async()=>{
  const actions=[];
  const scheduler=createFileScheduler({
    withLock:async operation=>{
      actions.push('lock:start');
      try{return await operation();}
      finally{actions.push('lock:end');}
    }
  });
  const gate=deferred();
  let active=0,maxActive=0;

  const first=scheduler.run('first',async()=>{
    active+=1;maxActive=Math.max(maxActive,active);actions.push('first:start');
    await gate.promise;
    actions.push('first:end');active-=1;
    return 1;
  });
  const second=scheduler.run('second',async()=>{
    active+=1;maxActive=Math.max(maxActive,active);actions.push('second:start');
    actions.push('second:end');active-=1;
    return 2;
  });

  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(scheduler.getState(),{active:{id:1,label:'first'},pending:1});
  assert.equal(actions.includes('second:start'),false);

  gate.resolve();
  assert.equal(await first,1);
  assert.equal(await second,2);
  assert.equal(maxActive,1);
  assert.deepEqual(actions,[
    'lock:start','first:start','first:end','lock:end',
    'lock:start','second:start','second:end','lock:end'
  ]);
  assert.deepEqual(scheduler.getState(),{active:null,pending:0});
});

test('FILE scheduler continues after a failed operation',async()=>{
  const scheduler=createFileScheduler();
  const actions=[];
  const failed=scheduler.run('failed',async()=>{
    actions.push('failed');
    throw new Error('boom');
  });
  const next=scheduler.run('next',async()=>{
    actions.push('next');
    return 42;
  });
  await assert.rejects(failed,/boom/);
  assert.equal(await next,42);
  assert.deepEqual(actions,['failed','next']);
});

test('FILE scheduler refuses reset while work is active or queued',async()=>{
  const scheduler=createFileScheduler();
  const gate=deferred();
  const running=scheduler.run('running',()=>gate.promise);
  await new Promise(resolve=>setImmediate(resolve));
  assert.throws(()=>scheduler.reset(),/work is active or queued/);
  gate.resolve();
  await running;
  scheduler.reset();
  assert.deepEqual(scheduler.getState(),{active:null,pending:0});
});
