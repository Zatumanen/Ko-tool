import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const VERSIONABLE_TEXT_EXTENSIONS=new Set(['.html','.js','.css']);
const STATIC_ROOT_ENTRIES=['index.html','css','js','os'];
const LOCAL_ASSET_REFERENCE=/(["'])((?:(?:\.\.\/)|(?:\.\/)|(?:css\/)|(?:js\/))[^"'?#]+?\.(?:js|css))(?:\?v=[^"'#]*)?(#[^"']*)?\1/g;

export function normalizeBuildVersion(value){
  const normalized=String(value||'').trim().replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
  return normalized||'dev';
}

export function versionAssetReferences(source,version){
  const token=normalizeBuildVersion(version);
  return String(source).replace(LOCAL_ASSET_REFERENCE,(_match,quote,asset,hash='')=>
    `${quote}${asset}?v=${token}${hash||''}${quote}`
  );
}

async function pathExists(target){
  try{await fs.access(target);return true;}catch{return false;}
}

async function copyVersionedTree(source,destination,version){
  const stat=await fs.stat(source);
  if(stat.isDirectory()){
    await fs.mkdir(destination,{recursive:true});
    const entries=await fs.readdir(source,{withFileTypes:true});
    for(const entry of entries)
      await copyVersionedTree(path.join(source,entry.name),path.join(destination,entry.name),version);
    return;
  }
  await fs.mkdir(path.dirname(destination),{recursive:true});
  const extension=path.extname(source).toLowerCase();
  if(VERSIONABLE_TEXT_EXTENSIONS.has(extension)){
    const text=await fs.readFile(source,'utf8');
    await fs.writeFile(destination,versionAssetReferences(text,version));
    return;
  }
  await fs.copyFile(source,destination);
}

export async function buildPages({sourceDir=process.cwd(),outDir=path.join(process.cwd(),'dist'),version}={}){
  const buildVersion=normalizeBuildVersion(version||process.env.SPEEDUPPERCUT_BUILD_VERSION||process.env.GITHUB_SHA||'dev');
  await fs.rm(outDir,{recursive:true,force:true});
  await fs.mkdir(outDir,{recursive:true});
  for(const entry of STATIC_ROOT_ENTRIES){
    const source=path.join(sourceDir,entry);
    if(await pathExists(source))await copyVersionedTree(source,path.join(outDir,entry),buildVersion);
  }
  await fs.writeFile(path.join(outDir,'build-version.json'),JSON.stringify({version:buildVersion},null,2)+'\n');
  return{version:buildVersion,outDir};
}

const isMain=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(isMain){
  const sourceDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const result=await buildPages({sourceDir,outDir:path.join(sourceDir,'dist')});
  console.log(`Built GitHub Pages bundle ${result.version} -> ${result.outDir}`);
}
