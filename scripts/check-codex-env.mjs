#!/usr/bin/env node
/** Read-only Codex checkout/environment preflight; no installs or Git mutations. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

const requiredSkills = [
  'architecture-graph', 'audio-regression', 'browser-qa',
  'ep-protocol-safety', 'feature-discovery', 'feature-spec',
  'project-context', 'reference-reverse-engineering',
  'release-verification', 'session-handoff',
];
const requiredRoles = {
  'code-explorer': '.codex/agents/code-explorer.toml',
  'regression-reviewer': '.codex/agents/regression-reviewer.toml',
};

function readText(file) {
  return readFileSync(path.join(root, file), 'utf8');
}

function checkFrontmatter(skill) {
  const file = `.agents/skills/${skill}/SKILL.md`;
  if (!existsSync(path.join(root, file))) {
    check(file, false, 'missing');
    return;
  }
  const source = readText(file);
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  const metadata = match?.[1] ?? '';
  const valid = Boolean(match) &&
    new RegExp(`^name: ${skill}$`, 'm').test(metadata) &&
    /^description: .+$/m.test(metadata);
  check(file, valid, valid ? 'frontmatter name/description present' :
    'invalid YAML frontmatter name/description');
  if (!valid) return;

  for (const link of source.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
    const target = link[1];
    if (target.startsWith('http') || target.startsWith('#')) continue;
    const resolved = path.resolve(path.dirname(path.join(root, file)), target);
    check(`${file} link`, existsSync(resolved), `target: ${target}`);
  }
}

function checkRole(name, file) {
  const present = existsSync(path.join(root, file));
  check(`${name} role file`, present, present ? file : `missing: ${file}`);
  if (!present) return;
  const source = readText(file);
  check(`${name} sandbox`, /(?:^|\n)sandbox_mode\s*=\s*["']read-only["']/.test(source),
    'sandbox_mode must be read-only');
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
check('skills directory', existsSync(path.join(root, '.agents/skills')), 'expected in repository');
const discoveredSkills = existsSync(path.join(root, '.agents/skills'))
  ? readdirSync(path.join(root, '.agents/skills'), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  : [];
check('skill inventory', requiredSkills.every(skill => discoveredSkills.includes(skill)),
  `required: ${requiredSkills.length}; discovered: ${discoveredSkills.length}`);
for (const skill of requiredSkills) checkFrontmatter(skill);
for (const [name, file] of Object.entries(requiredRoles)) checkRole(name, file);
console.log(`Preflight: ${failures} required failure(s), ${warnings} warning(s).`);
if (strict && warnings) failures += warnings;
process.exitCode = failures ? 1 : 0;
