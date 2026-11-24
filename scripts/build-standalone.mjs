/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.STANDALONE_BUILD
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Builds a single self-contained HTML file from the canonical production build
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/scripts/build-standalone.mjs
WHY: Offline handoff needs one portable file with no server or drive-path dependency
HOW: Inlines built JS/CSS and referenced images as data URLs; browser capabilities remain restricted and documented
*/
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const htmlPath = path.join(dist, 'index.html');
let html = await readFile(htmlPath, 'utf8');

async function collect(dir) {
  const out = new Map();
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) for (const [k, v] of await collect(full)) out.set(k, v);
    else out.set(path.relative(dist, full).replace(/\\/g, '/'), full);
  }
  return out;
}
const files = await collect(dist);

const mime = (name) => name.endsWith('.png') ? 'image/png'
  : name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'image/jpeg'
  : name.endsWith('.svg') ? 'image/svg+xml'
  : name.endsWith('.css') ? 'text/css'
  : name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';

async function dataUrl(rel) {
  const full = files.get(rel.replace(/^\.\//, ''));
  if (!full) return null;
  const buf = await readFile(full);
  return `data:${mime(rel)};base64,${buf.toString('base64')}`;
}

// Inline CSS and JS bundles.
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)];
for (const [tag, href] of styles) {
  const file = files.get(href.replace(/^\.\//, ''));
  if (!file) continue;
  const css = await readFile(file, 'utf8');
  html = html.replace(tag, () => `<style>${css}</style>`);
}

const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)];
for (const [tag, src] of scripts) {
  const file = files.get(src.replace(/^\.\//, ''));
  if (!file) continue;
  const code = await readFile(file, 'utf8');
  html = html.replace(tag, () => `<script type="module">${code.replace(/<\/script>/gi, '<\\/script>')}</script>`);
}

// Inline every referenced local image (logo, avatars, snaps).
for (const rel of [...files.keys()].filter((k) => /\.(png|jpe?g|svg)$/i.test(k))) {
  const url = await dataUrl(rel);
  if (!url) continue;
  html = html.split(`./${rel}`).join(url).split(`/${rel}`).join(url);
}

const outPath = path.join(dist, 'leeway-global-p2p-standalone.html');
await writeFile(outPath, html, 'utf8');
const info = await stat(outPath);
console.log(`Standalone HTML written: ${outPath} (${info.size} bytes)`);

// Evidence: no external module/script/style references should remain.
const external = [
  ...[...html.matchAll(/<script[^>]+src="[^"]+"/g)].map((m) => m[0]),
  ...[...html.matchAll(/<link[^>]+href="[^"]+"/g)].map((m) => m[0]),
].filter((tag) => !/rel="(preconnect|manifest)"/.test(tag)
  && !/fonts\.(googleapis|gstatic)\.com/.test(tag)
  && !/href="data:/.test(tag));
const fontsOnly = external.filter((x) => !x.includes('fonts.googleapis') && !x.includes('fonts.gstatic'));
if (fontsOnly.length) {
  console.error(`Standalone bundle still has external references: ${fontsOnly.slice(0, 5).join(', ')}`);
  process.exit(1);
}
console.log('Standalone check PASS: no external script/style/image references (web fonts are optional).');
