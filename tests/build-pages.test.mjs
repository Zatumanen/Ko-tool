import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import{buildPages,normalizeBuildVersion,versionAssetReferences}from '../scripts/build-pages.mjs';

test('asset references are normalized to one build token',()=>{
  const source=`<link href="css/base.css?v=old"><script src="js/app.js?v=older"></script>\nimport x from './x.js?v=manual';\nexport * from '../y.js';\nconst external='https://cdn.example.com/x.js?v=keep';`;
  const output=versionAssetReferences(source,'abc123');
  assert.match(output,/css\/base\.css\?v=abc123/);
  assert.match(output,/js\/app\.js\?v=abc123/);
  assert.match(output,/\.\/x\.js\?v=abc123/);
  assert.match(output,/\.\.\/y\.js\?v=abc123/);
  assert.match(output,/https:\/\/cdn\.example\.com\/x\.js\?v=keep/);
  assert.doesNotMatch(output,/\?v=(?:old|older|manual)/);
});

test('build version is URL-safe and deterministic',()=>{
  assert.equal(normalizeBuildVersion(' 4906b00 / dirty '),'4906b00-dirty');
  assert.equal(normalizeBuildVersion(''),'dev');
});

test('Pages build copies only static roots and versions nested JS imports',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'speeduppercut-pages-'));
  const source=path.join(root,'source'),out=path.join(root,'dist');
  await fs.mkdir(path.join(source,'js','nested'),{recursive:true});
  await fs.mkdir(path.join(source,'css'),{recursive:true});
  await fs.mkdir(path.join(source,'tests'),{recursive:true});
  await fs.writeFile(path.join(source,'index.html'),'<link rel="stylesheet" href="css/base.css?v=manual"><script type="module" src="js/app.js?v=manual"></script>');
  await fs.writeFile(path.join(source,'css','base.css'),'body{}');
  await fs.writeFile(path.join(source,'js','app.js'),"import './nested/feature.js?v=manual';");
  await fs.writeFile(path.join(source,'js','nested','feature.js'),"export * from '../shared.js';");
  await fs.writeFile(path.join(source,'js','shared.js'),'export const ok=true;');
  await fs.writeFile(path.join(source,'tests','should-not-deploy.txt'),'nope');
  const result=await buildPages({sourceDir:source,outDir:out,version:'commit-123'});
  assert.equal(result.version,'commit-123');
  assert.match(await fs.readFile(path.join(out,'index.html'),'utf8'),/css\/base\.css\?v=commit-123/);
  assert.match(await fs.readFile(path.join(out,'js','app.js'),'utf8'),/\.\/nested\/feature\.js\?v=commit-123/);
  assert.match(await fs.readFile(path.join(out,'js','nested','feature.js'),'utf8'),/\.\.\/shared\.js\?v=commit-123/);
  assert.equal(await fs.stat(path.join(out,'tests')).then(()=>true,()=>false),false);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(out,'build-version.json'),'utf8')),{version:'commit-123'});
  await fs.rm(root,{recursive:true,force:true});
});
