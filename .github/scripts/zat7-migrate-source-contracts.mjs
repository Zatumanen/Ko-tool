import fs from 'node:fs';

const file='tests/ep133.test.mjs';
let source=fs.readFileSync(file,'utf8');

function editTest(name,transform){
  const marker=`test('${name}'`;
  const start=source.indexOf(marker);
  if(start<0)throw new Error(`Missing test: ${name}`);
  const next=source.indexOf("\ntest('",start+marker.length);
  const end=next<0?source.length:next;
  const block=source.slice(start,end);
  const changed=transform(block);
  if(changed===block)throw new Error(`No change made for test: ${name}`);
  source=source.slice(0,start)+changed+source.slice(end);
}

editTest('My EP cache-busting chain keeps deep EP modules on the same release token',block=>{
  block=block.replace(
    `const [html,app,ui,index]=await Promise.all([\n    read('index.html'),read('js/app.js'),read('js/ep133/ui.js'),read('js/ep133/index.js')\n  ]);`,
    `const [html,app,ui,workspace,index]=await Promise.all([\n    read('index.html'),read('js/app.js'),read('js/ep133/ui.js'),read('js/ep133/ui/createEpWorkspace.js'),read('js/ep133/index.js')\n  ]);`
  );
  const mapPath=path=>{
    if(path==='./index.js?v=')return'../index.js?v=';
    if(path.startsWith('./ui/'))return'./'+path.slice('./ui/'.length);
    if(['./deviceProfile.js?v=','./sampleStore.js?v=','./sampleMemory.js?v='].includes(path))return'../'+path.slice(2);
    throw new Error(`Unhandled ui import assertion path: ${path}`);
  };
  let converted=0;
  block=block.replace(/assert\.equal\(ui\.includes\("([^"]+)"\+token\),true\);/g,(_line,path)=>{
    converted+=1;
    return`assert.equal(workspace.includes("${mapPath(path)}"+token),true);`;
  });
  if(converted<10)throw new Error(`Expected many moved import assertions, converted ${converted}`);
  const anchor='assert.equal(app.includes("./ep133/ui.js?v="+token),true);';
  if(!block.includes(anchor))throw new Error('Missing app→ui cache assertion');
  block=block.replace(anchor,anchor+'\n  assert.equal(ui.includes("./ui/createEpWorkspace.js?v="+token),true);\n  assert.equal(workspace.includes("../deviceRuntime.js"),true);\n  assert.doesNotMatch(workspace,/deviceRuntime\\.js\\?v=/);');
  return block;
});

for(const name of[
  'My EP keeps event-first metadata sync lease-aware for destructive mutations but not the normal upload fast path',
  'My EP aborts batches when the connected MIDI session changes',
  'sample mutation controllers reserve strict FILE transaction leases',
  'My EP pastes and drops audio into the shared forward-only uploader',
  'My EP exposes the sample library before prioritized metadata hydration completes',
  'My EP initial sample sync lists only root and the direct \\/sounds directory',
  'SampleStore metadata is invalidated or refreshed by device file events',
  'SampleStore is the only sample-state mutation owner outside the sampleMemory projection',
  'My EP runtime cannot mutate sample projection state outside SampleStore'
]){
  editTest(name,block=>{
    const old='../js/ep133/ui.js';
    if(!block.includes(old))throw new Error(`Expected ui.js source read in: ${name}`);
    return block.replaceAll(old,'../js/ep133/ui/createEpWorkspace.js');
  });
}

fs.writeFileSync(file,source);
