import createResampleModule from './resampleModule.js';

const DYNAMIC_LIBRARIES=['libsndfile.wasm','libsamplerate.wasm','libtag.wasm','libtag_c.wasm'];
let modulePromise=null;

async function loadResampleModule(){
  if(!modulePromise)modulePromise=createResampleModule({dynamicLibraries:DYNAMIC_LIBRARIES,locateFile:file=>new URL(`./wasm/${file}`,import.meta.url).href});
  return modulePromise;
}

export async function getLibSampleRateModule(){return loadResampleModule();}

export {DYNAMIC_LIBRARIES};
