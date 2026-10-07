import fs from 'node:fs/promises';
import{
  parseCaptureJsonl,
  parseCaptureRaw,
  normalizeCaptureWindow,
  sanitizeCaptureFrames,
  buildGoldenFixture
}from '../tests/helpers/ep-file-capture-import.mjs';

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(!key.startsWith('--'))throw new Error(`Unexpected argument ${key}.`);
    const value=argv[++i];
    if(value==null||value.startsWith('--'))throw new Error(`Missing value for ${key}.`);
    out[key.slice(2)]=value;
  }
  for(const key of ['source','descriptor','out'])if(!out[key])throw new Error(`--${key} is required.`);
  return out;
}

export async function importEpFileCapture({source,descriptor,out,format='jsonl'}){
  const [sourceBytes,descriptorText]=await Promise.all([
    fs.readFile(source),
    fs.readFile(descriptor,'utf8')
  ]);
  let config;
  try{config=JSON.parse(descriptorText);}catch(error){throw new Error(`Invalid capture descriptor JSON: ${error.message}`);}
  if(!config||typeof config!=='object')throw new Error('Capture descriptor must be an object.');
  for(const key of ['id','provenance','scenario','expectations'])if(config[key]==null)throw new Error(`Capture descriptor requires ${key}.`);

  if(format!=='jsonl'&&format!=='raw')throw new Error(`Unsupported capture format ${String(format)}.`);
  const records=format==='raw'
    ?parseCaptureRaw(sourceBytes,config.window||{})
    :parseCaptureJsonl(new TextDecoder().decode(sourceBytes),config.window||{});
  const frames=normalizeCaptureWindow(records,{start:0,end:records.length});
  if(!frames.length)throw new Error('Capture descriptor selected an empty frame window.');
  const sanitized=sanitizeCaptureFrames(frames,{rules:config.rules||[]});
  const fixture=buildGoldenFixture({
    id:config.id,
    provenance:config.provenance,
    scenario:config.scenario,
    frames:sanitized.frames,
    expectations:config.expectations,
    sourceBytes,
    transforms:sanitized.transforms,
    sanitizerVersion:config.sanitizerVersion??1
  });
  await fs.writeFile(out,`${JSON.stringify(fixture,null,2)}\n`,'utf8');
  return fixture;
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href){
  importEpFileCapture(parseArgs(process.argv.slice(2))).catch(error=>{
    console.error(error?.stack||error?.message||String(error));
    process.exitCode=1;
  });
}
