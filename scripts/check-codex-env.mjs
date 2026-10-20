#!/usr/bin/env node
/** Read-only Codex checkout/environment preflight; no installs or Git mutations. */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const strict = process.argv.includes('--strict');
let failures = 0;
let warnings = 0;
function check(name, ok, details, required = true) {
  const level = ok ? 'PASS' : required ? 'FAIL' : 'WARN';
  console.log(`[${level}] ${name}: ${details}`);
  if (!ok) { if (required) failures += 1; else warnings += 1; }
}

check('Node.js', process.versions.node.split('.')[0] === '22',
  `${process.version}; required major 22`);
const files = [
  'AGENTS.md', 'README.md', 'docs/PROJECT_STATE.md', 'docs/CODEX.md',
  'docs/TESTING.md', 'package.json', '.codex/config.toml',
  'playwright.config.mjs', 'tests/e2e/server.mjs',
  '.agents/skills/project-context/SKILL.md',
  '.agents/skills/ep-protocol-safety/SKILL.md',
  '.agents/skills/audio-regression/SKILL.md',
  '.agents/skills/browser-qa/SKILL.md',
];
for (const file of files) {
  check(file, existsSync(path.join(root, file)), 'expected in repository');
}

try {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  check('Node engine', pkg.engines?.node === '>=22 <23',
    `package engines.node: ${pkg.engines?.node ?? 'unset'}`);
} catch (error) {
  check('package.json', false, error.message);
}

const lock = existsSync(path.join(root, 'package-lock.json'));
check('npm lockfile', lock, lock ? 'present; verify with npm ci' :
  'missing: installation is not fully reproducible; generate with verified registry access', false);
try {
  require.resolve('@playwright/test/package.json', { paths: [root] });
  check('Playwright package', true, 'available locally');
} catch {
  check('Playwright package', false, 'not installed; install dependencies before E2E', false);
}
for (const skill of [
  'project-context', 'audio-regression', 'browser-qa', 'ep-protocol-safety',
  'session-handoff', 'release-verification',
]) {
  const name = `.agents/skills/${skill}/SKILL.md`;
  if (!existsSync(path.join(root, name))) {
    check(name, false, 'missing', false);
    continue;
  }
  const source = readFileSync(path.join(root, name), 'utf8');
  const valid = source.startsWith('---\n') &&
    source.includes(`\nname: ${skill}\n`) &&
    /\ndescription: .+\n/.test(source);
  check(name, valid, valid ? 'metadata present' : 'invalid name/frontmatter');
}
console.log(`Preflight: ${failures} required failure(s), ${warnings} warning(s).`);
if (strict && warnings) failures += warnings;
process.exitCode = failures ? 1 : 0;
