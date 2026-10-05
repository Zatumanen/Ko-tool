import fs from 'node:fs';
const path='tests/ep133.test.mjs';
let source=fs.readFileSync(path,'utf8');
const old=`  const ui=await fs.readFile(new URL('../js/ep133/ui/createEpWorkspace.js',import.meta.url),'utf8');\n  const uploads=await fs.readFile(new URL('../js/ep133/ui/sampleUploadController.js',import.meta.url),'utf8');\n  assert.match(ui,/clipboardData\\?\\.items/);\n  assert.match(ui,/window\\.addEventListener\\('paste'/);`;
const next=`  const ui=await fs.readFile(new URL('../js/ep133/ui/createEpWorkspace.js',import.meta.url),'utf8');\n  const entry=await fs.readFile(new URL('../js/ep133/ui.js',import.meta.url),'utf8');\n  const uploads=await fs.readFile(new URL('../js/ep133/ui/sampleUploadController.js',import.meta.url),'utf8');\n  assert.match(ui,/clipboardData\\?\\.items/);\n  assert.match(entry,/window\\.addEventListener\\('paste',workspace\\.handlePaste\\)/);`;
if(!source.includes(old))throw new Error('Expected paste source-contract block not found');
source=source.replace(old,next);
fs.writeFileSync(path,source);
