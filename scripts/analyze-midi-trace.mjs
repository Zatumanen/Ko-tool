#!/usr/bin/env node
import {open,constants} from 'node:fs/promises';
import {analyzeMidiTrace,formatMidiTraceReport,MAX_TRACE_BYTES} from '../js/sequencer/midiTraceAnalyzer.js';

const args=process.argv.slice(2);
if(args.length!==1||args[0].startsWith('--')){
 console.error('Usage: node scripts/analyze-midi-trace.mjs <explicit-trace.json>');process.exitCode=2;
}else{
 let file;
 try{
  file=await open(args[0],constants.O_RDONLY|constants.O_NONBLOCK);
  const stat=await file.stat();
  if(!stat.isFile())throw Error('Input must be a regular file.');
  if(stat.size>MAX_TRACE_BYTES)throw Error(`Input size exceeds ${MAX_TRACE_BYTES} bytes.`);
  // Bounded even if the file grows between stat and read; no path or input content echoed.
  const buffer=Buffer.alloc(MAX_TRACE_BYTES+1);let size=0;
  while(size<buffer.length){const {bytesRead}=await file.read(buffer,size,buffer.length-size,null);if(!bytesRead)break;size+=bytesRead;}
  if(size>MAX_TRACE_BYTES)throw Error(`Input size exceeds ${MAX_TRACE_BYTES} bytes.`);
  let input;
  try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size)));}
  catch{throw Error('Invalid UTF-8 or JSON input; no analysis performed.');}
  const result=analyzeMidiTrace(input);console.log(formatMidiTraceReport(result).trimEnd());
  if(result.integrity.errors.length)process.exitCode=1;
 }catch(error){
  const known=['Input must be a regular file.',`Input size exceeds ${MAX_TRACE_BYTES} bytes.`,'Invalid UTF-8 or JSON input; no analysis performed.'];
  console.error(known.includes(error.message)?error.message:'Unable to read the explicitly requested input file.');process.exitCode=1;
 }finally{await file?.close();}
}
