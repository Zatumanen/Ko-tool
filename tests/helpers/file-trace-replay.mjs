import assert from 'node:assert/strict';
import{TE_SYSEX_FILE}from '../../js/ep133/constants.js';

const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const printable=value=>[...bytes(value)].map(byte=>byte.toString(16).padStart(2,'0')).join(' ');

export function createFileTraceReplay(steps=[]){
  const script=(steps||[]).map((step,index)=>({
    label:String(step?.label||('step '+(index+1))),
    request:bytes(step?.request),
    response:bytes(step?.response),
    status:Number(step?.status)||0,
    drop:step?.drop===true,
    debug:step?.debug||null,
    debugDelay:Number(step?.debugDelay)||0,
    delay:Number(step?.delay)||0
  }));
  const seen=[];
  let cursor=0;

  const onRequest=request=>{
    if(request.command!==TE_SYSEX_FILE)return{};
    const raw=request.rawData.slice();
    seen.push(raw);
    const step=script[cursor++];
    if(!step){
      return{
        status:3,
        response:new Uint8Array(),
        payload:new TextEncoder().encode('unexpected replay request\0')
      };
    }
    return{
      status:step.status,
      payload:step.response,
      drop:step.drop,
      debug:step.debug,
      debugDelay:step.debugDelay,
      delay:step.delay
    };
  };

  const assertComplete=()=>{
    assert.equal(
      seen.length,
      script.length,
      'FILE replay request count mismatch: saw '+seen.length+', expected '+script.length
    );
    for(let index=0;index<script.length;index++){
      assert.deepEqual(
        [...seen[index]],
        [...script[index].request],
        script[index].label+' request mismatch\nactual:   '+printable(seen[index])+'\nexpected: '+printable(script[index].request)
      );
    }
  };

  return{onRequest,assertComplete,seen,remaining:()=>Math.max(0,script.length-seen.length)};
}
