/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.GENERATE_QR
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: scripts\generate-qr.mjs
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/scripts/generate-qr.mjs
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/** Generates the install QR code for the published APK URL. */
import QRCode from 'qrcode';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.INSTALL_URL
  || 'https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/downloads/leeway-global-p2p-v1.0.0-release.apk';
const out = process.env.QR_OUT || 'site/leeway-qr.png';

await mkdir(path.dirname(out), { recursive: true });
await QRCode.toFile(out, url, {
  width: 512,
  margin: 2,
  color: { dark: '#050914', light: '#ffffff' },
  errorCorrectionLevel: 'H',
});
console.log(`QR written to ${out}`);
console.log(`Target URL: ${url}`);
