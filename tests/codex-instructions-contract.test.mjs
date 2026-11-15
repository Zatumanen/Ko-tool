import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const requiredSkills=[
  'architecture-graph','audio-regression','browser-qa','ep-protocol-safety',
  'feature-discovery','feature-spec','project-context',
  'reference-reverse-engineering','release-verification','session-handoff'
];
const roles=['code-explorer','regression-reviewer'];

test('all ten scoped skills have frontmatter and are enumerated in preflight',async()=>{
  const directories=(await readdir(new URL('../.agents/skills/',import.meta.url),{withFileTypes:true}))
    .filter(item=>item.isDirectory()).map(item=>item.name).sort();
  assert.deepEqual(directories,requiredSkills);
  const preflight=await read('scripts/check-codex-env.mjs');
  for(const name of requiredSkills){
    assert.match(preflight,new RegExp("'"+name+"'"),name+' missing from preflight');
    const skill=await read('.agents/skills/'+name+'/SKILL.md');
    assert.match(skill,new RegExp('^---\\nname: '+name+'\\ndescription: [^\\n]+\\n---\\n'),name);
  }
  assert.match(preflight,/requiredSkills\.length === discoveredSkills\.length/);
});

test('all configured Codex roles resolve to read-only files and preflight validates bindings',async()=>{
  const [config,preflight]=await Promise.all([
    read('.codex/config.toml'),read('scripts/check-codex-env.mjs')
  ]);
  assert.match(config,/max_depth = 1/);
  assert.match(config,/max_concurrent_threads_per_session = 2/);
  assert.match(preflight,/name \+ ' registered'/);
  for(const name of roles){
    const section=config.match(new RegExp('\\[agents\\.'+name+'\\]([\\s\\S]*?)(?=\\n\\[|$)'));
    assert.ok(section,'missing role section '+name);
    assert.match(section[1],new RegExp('config_file = "agents/'+name+'\\.toml"'));
    const contents=await read('.codex/agents/'+name+'.toml');
    assert.match(contents,/^sandbox_mode = "read-only"$/m);
    assert.match(contents,/Do not edit|Do not\\s+edit/);
    assert.match(contents,/do not spawn|Do not.*spawn|spawn agents/i);
  }
});

test('canonical agent guidance distinguishes implemented REPITCH and pending hardware acceptance',async()=>{
  const [root,skill,codex,release]=await Promise.all([
    read('AGENTS.md'),read('.agents/skills/audio-regression/SKILL.md'),
    read('docs/CODEX.md'),read('docs/RELEASE.md')
  ]);
  assert.match(root,/REPITCH is implemented/);
  assert.match(skill,/REPITCH is\nimplemented/);
  assert.match(skill,/ZAT-77/);
  assert.doesNotMatch(skill,/Future REPITCH/);
  assert.match(codex,/npm ci --no-audit --no-fund/);
  assert.doesNotMatch(codex,/currently validates only \*\*6\*\*/);
  assert.match(release,/first complete manual production deployment/i);
  assert.match(release,/separate explicit owner release decision/);
  assert.ok(Buffer.byteLength(root,'utf8')<=8192,'AGENTS.md exceeds target 8KiB');
});

test('failed fake-EP Chromium runs retain limited diagnostics, without auto-release',async()=>{
  const [ci,deploy]=await Promise.all([
    read('.github/workflows/tests.yml'),read('.github/workflows/deploy-pages.yml')
  ]);
  for(const workflow of [ci,deploy]){
    assert.match(workflow,/name: Upload failed Playwright traces/);
    assert.match(workflow,/if: \$\{\{ failure\(\) \}\}/);
    assert.match(workflow,/path: test-results\//);
    assert.match(workflow,/retention-days: 3/);
    assert.match(workflow,/if-no-files-found: ignore/);
  }
  assert.match(deploy,/on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(deploy,/on:\s*\n\s*push:/);
});
