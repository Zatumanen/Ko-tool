import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BANNED=['tests','docs','node_modules','.github','.agents','.codex'];
const LOCAL_TAG=/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/gi;

const exists=async p=>fs.stat(p).then(x=>x.isFile(),()=>false);
const assert=(ok,message)=>{if(!ok)throw new Error('Pages artifact: '+message);};

export async function checkPagesArtifact({
  distDir=path.join(ROOT,'dist'),
  expectedVersion=process.env.SPEEDUPPERCUT_BUILD_VERSION||process.env.GITHUB_SHA||null
}={}){
  const root=path.resolve(distDir);
  const [manifest,html]=await Promise.all([
    fs.readFile(path.join(root,'build-version.json'),'utf8'),
    fs.readFile(path.join(root,'index.html'),'utf8')
  ]);
  const {version}=JSON.parse(manifest);
  assert(typeof version==='string'&&/^[a-zA-Z0-9._-]+$/.test(version),'missing or unsafe build version');
  if(expectedVersion!=null)assert(version===expectedVersion,
    'built version '+version+' differs from verified SHA '+expectedVersion);
  assert(/<base\s+href="\.\/">/.test(html),'relative base URL is missing');
  const localAssets=[];
  for(const [,href] of html.matchAll(LOCAL_TAG)){
    if(/^(?:https?:|data:|\/\/|#)/i.test(href))continue;
    const [file,query='']=href.split('?');
    if(!/\.(?:js|css)$/.test(file))continue;
    const parameters=new URLSearchParams(query);
    assert(parameters.get('v')===version,'unversioned asset in index.html: '+file);
    assert(!file.includes('..')&&!file.startsWith('/'),'unsafe asset reference '+file);
    assert(await exists(path.join(root,file)),'missing asset '+file);
    localAssets.push(file);
  }
  for(const required of [
    'css/base.css','css/my-ep.css','css/my-ep-projects.css','css/visuals.css',
    'js/app.js','js/visuals/app.js'
  ])assert(localAssets.includes(required),'index.html misses required asset '+required);
  for(const dirname of BANNED)assert(!(await fs.stat(path.join(root,dirname)).then(()=>true,()=>false)),
    'source-only directory leaked: '+dirname);
  assert(await exists(path.join(root,'js/ep133/wasm/libsamplerate.wasm')),
    'EP reference WASM was not included in the deployed artifact');
  // Versioning must apply to the nested module graph, not just index.html.
  for(const file of ['js/app.js','js/visuals/app.js','js/ep133/resampler.js']){
    const js=await fs.readFile(path.join(root,file),'utf8');
    for(const [,asset,stamp] of js.matchAll(/["'](\.{1,2}\/[^"'?#]+\.(?:js|css))\?v=([^"'#]+)["']/g)){
      assert(stamp===version,'stale nested import in '+file+': '+asset);
      assert(await exists(path.resolve(path.dirname(path.join(root,file)),asset)),
        'missing nested import in '+file+': '+asset);
    }
  }
  return Object.freeze({version,localAssets:Object.freeze(localAssets),root});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  checkPagesArtifact().then(r=>console.log('Pages artifact verified:',r.version,
    '('+r.localAssets.length+' versioned entry assets)'))
    .catch(error=>{console.error(error);process.exitCode=1});
}
