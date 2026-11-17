// Optional developer oracle; FFmpeg is not a production or CI dependency.
import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loudnessVector,interleave} from '../tests/helpers/loudness-vectors.mjs';
const path=new URL('../tests/fixtures/visuals-loudness-golden.json',import.meta.url);
const fixture=JSON.parse(await readFile(path,'utf8'));
const version=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});
if(version.status!==0)throw Error('FFmpeg required for optional golden regeneration');
for(const vector of fixture.vectors){
 const pcm=Buffer.from(interleave(loudnessVector(vector)).buffer);
 const result=spawnSync('ffmpeg',['-hide_banner','-f','f32le','-ar',String(vector.rate),'-ac',String(vector.channels),'-i','pipe:0','-af','ebur128=metadata=1,ametadata=print','-f','null','-'],{input:pcm,maxBuffer:4e6});
 if(result.status!==0)throw Error(result.stderr.toString());
 const expected={},log=result.stderr.toString(),hash=createHash('sha256').update(pcm).digest('hex');
 for(const [key,field]of [['momentary','M'],['shortTerm','S'],['integrated','I']]){
  const value=[...log.matchAll(new RegExp('lavfi.r128.'+field+'=([-0-9.]+)','g'))].at(-1);
  if(!value)throw Error('Missing oracle result: '+vector.name+'/'+key);
  expected[key]=Number(value[1]);
 }
 if(process.argv.includes('--write')){vector.expected=expected;vector.pcmSha256=hash;}
 else{
  if(hash!==vector.pcmSha256)throw Error('PCM hash mismatch: '+vector.name);
  for(const key of Object.keys(expected))if(Math.abs(expected[key]-vector.expected[key])>.001)throw Error('Oracle changed: '+vector.name+'/'+key);
 }
}
if(process.argv.includes('--write')){
 fixture.reference=version.stdout.split('\n')[0]+'; f32le input; ebur128=metadata=1,ametadata=print; no library code imported';
 await writeFile(path,JSON.stringify(fixture,null,2)+'\n');
}
console.log(fixture.vectors.length+' independent loudness vectors '+(process.argv.includes('--write')?'regenerated':'verified'));
