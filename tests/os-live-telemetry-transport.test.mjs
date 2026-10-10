import test from 'node:test';
import assert from 'node:assert/strict';
import {startEpStatusPublisher,startEpStatusReceiver,EP_STATUS_TTL_MS} from '../js/ep133/runtimeStatusTelemetry.js';
class Channel{
 static peers=[];
 constructor(name){this.name=name;this.listeners=new Set();Channel.peers.push(this);}
 addEventListener(type,fn){this.listeners.add(fn);}
 removeEventListener(type,fn){this.listeners.delete(fn);}
 postMessage(data){for(const p of Channel.peers)if(p!==this&&p.name===this.name)for(const fn of p.listeners)fn({data});}
 close(){Channel.peers=Channel.peers.filter(p=>p!==this);}
}
const ready=()=>({status:'ready',connection:{status:'connected',device:{identityVerified:true,sku:'TE032AS001',firmware:'2.5.1'}},ownership:{status:'owned'},operation:{phase:'idle'},safety:{status:'safe'},recovery:{hydrated:true}});
function intervals(){const timers=new Set();return {setIntervalFn:fn=>{timers.add(fn);return fn;},clearIntervalFn:fn=>timers.delete(fn),timers};}
test('live status is read-only, cross-tab and expires when publisher disappears',()=>{
 Channel.peers=[];
 let clock=0;
 const pTimer=intervals(),rTimer=intervals(),callbacks=new Set();
 let snapshot=ready();
 const runtime={getSnapshot:()=>snapshot,subscribe:fn=>{callbacks.add(fn);return()=>callbacks.delete(fn);}};
 const pub=startEpStatusPublisher({runtime,Channel,source:'device-owner',...pTimer});
 let latest=null;
 const sub=startEpStatusReceiver({Channel,now:()=>clock,onChange:data=>{latest=data;},...rTimer});
 assert.equal(pub.supported,true);
 assert.equal(latest.status,'ready');
 snapshot={...ready(),status:'recovery-required',safety:{status:'recovery-required',reason:'Recheck device'}};
 for(const fn of callbacks)fn(snapshot);
 assert.equal(latest.status,'recovery-required');
 clock+=EP_STATUS_TTL_MS+1;
 for(const fn of rTimer.timers)fn();
 assert.equal(latest,null);
 pub.dispose();sub.dispose();
 assert.equal(Channel.peers.length,0);
});
