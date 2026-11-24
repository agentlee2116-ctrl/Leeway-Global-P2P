/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.GOVERNANCE_HEADERS
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Idempotent LeeWay R23 header applicator for governed authored source
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/scripts/apply-leeway-headers.mjs
WHY: Governed files must carry provenance, region, tag and 5WH at creation and every change
HOW: Deterministic scan of authored source directories; vendor, generated, binary and lock files are excluded
*/
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INCLUDE_DIRS = ['src', 'tests', 'scripts', 'relay', 'site', 'docs', 'governance', '.github'];
const INCLUDE_ROOT_FILES = ['README.md', 'AGENTS.md'];
const INCLUDE_EXT = new Set(['.ts', '.tsx', '.mjs', '.js', '.css', '.html', '.md', '.yml', '.yaml', '.java', '.gradle']);
const SKIP_PARTS = new Set(['node_modules', 'dist', 'build', '.gradle', 'outputs', 'generated', '.git', 'android']);

async function walk(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (SKIP_PARTS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (INCLUDE_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function header(rel, purpose) {
  const tag = `PRODUCT.LEEWAY_GLOBAL_P2P.${path.basename(rel, path.extname(rel)).replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
  const lines = [
    'LEEWAY_HEADER - DO NOT REMOVE',
    'REGION: PRODUCT',
    `TAG: ${tag}`,
    'DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render',
    'WHO: LeeWay Creator / LeeWay Global P2P engineering',
    `WHAT: ${purpose}`,
    'WHEN: 2026-11-24',
    `WHERE: agentlee2116-ctrl/Leeway-Global-P2P/${rel.replace(/\\/g, '/')}`,
    'WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions',
    'HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification',
  ];
  const ext = path.extname(rel);
  if (['.html', '.md', '.yml', '.yaml'].includes(ext)) return `<!--\n${lines.join('\n')}\n-->\n`;
  return `/*\n${lines.join('\n')}\n*/\n`;
}

const files = [];
for (const dir of INCLUDE_DIRS) await walk(path.join(ROOT, dir), files);
for (const f of INCLUDE_ROOT_FILES) {
  const full = path.join(ROOT, f);
  try { await readFile(full); files.push(full); } catch { /* absent */ }
}

let changed = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const source = await readFile(file, 'utf8');
  if (source.includes('LEEWAY_HEADER')) continue;
  const purpose = `Governed LeeWay Global P2P source: ${rel}`;
  await writeFile(file, header(rel, purpose) + source, 'utf8');
  changed++;
}
console.log(`LeeWay R23 header check complete: ${changed} file(s) updated, ${files.length} inspected`);
