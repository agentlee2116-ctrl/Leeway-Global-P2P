/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.VALIDATE_WORKFLOWS
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Deterministic YAML validation for GitHub Actions workflows
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/scripts/validate-workflows.mjs
WHY: Invalid workflow YAML silently fails CI at 0s and blocks Pages deployment
HOW: Parse every .github/workflows/*.yml with the yaml package; fail on any error
*/
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const dir = path.join(process.cwd(), '.github', 'workflows');
const files = (await readdir(dir)).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
let failed = 0;
for (const file of files) {
  try {
    const doc = YAML.parse(await readFile(path.join(dir, file), 'utf8'));
    if (!doc || typeof doc !== 'object') throw new Error('empty workflow document');
    if (!doc.on && !doc[true]) throw new Error('missing triggers');
    console.log(`VALID  ${file}`);
  } catch (err) {
    failed++;
    console.error(`INVALID ${file}: ${String(err)}`);
  }
}
console.log(`workflow validation: ${files.length - failed} valid, ${failed} invalid`);
process.exit(failed === 0 ? 0 : 1);
