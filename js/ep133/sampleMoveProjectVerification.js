import{parseProjectArchive}from './projectArchive.js?v=20261001-1';

const PAD_PATH=/^pads\/[abcd]\/p(?:0[1-9]|1[0-2])$/;
const asBytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);

/**
 * Verify what the firmware changed; NEVER author/upload a project TAR here.
 * Native EP-133 2.5.1 MOVE is only accepted if precisely the referenced
 * little-endian sound-slot fields changed and every other TAR byte survived.
 */
export function verifyNativeProjectSlotMove(beforeInput,afterInput,{sourceId,targetId,project='?'}={}){
  if(!Number.isInteger(sourceId)||sourceId<1||sourceId>999||
     !Number.isInteger(targetId)||targetId<1||targetId>999||sourceId===targetId)
    throw new Error('Invalid native MOVE project-verification slots.');
  const before=asBytes(beforeInput);
  const actual=asBytes(afterInput);
  const members=parseProjectArchive(before);
  parseProjectArchive(actual);
  if(before.length!==actual.length)throw new Error('MOVE project P'+project+' TAR length changed.');
  const expected=before.slice();
  let offset=0,remappedPads=0;
  for(const member of members){
    if(member.type!=='5'&&PAD_PATH.test(member.path)){
      if(member.data.length<3)throw new Error('MOVE project P'+project+' has a short pad record.');
      const oldSlot=member.data[1]|member.data[2]<<8;
      if(oldSlot===sourceId){
        const position=offset+512+1;
        expected[position]=targetId&255;
        expected[position+1]=(targetId>>>8)&255;
        remappedPads++;
      }
    }
    offset+=512+Math.ceil(member.size/512)*512;
  }
  if(!remappedPads)throw new Error('MOVE project P'+project+' no longer references source '+sourceId+'.');
  for(let i=0;i<expected.length;i++){
    if(expected[i]!==actual[i]){
      throw new Error('MOVE project P'+project+' unexpected TAR change at byte '+i+'.');
    }
  }
  return{data:actual.slice(),remappedPads};
}
