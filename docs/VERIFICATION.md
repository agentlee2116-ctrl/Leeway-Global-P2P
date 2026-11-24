<!--
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.VERIFICATION
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: docs\VERIFICATION.md
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/docs/VERIFICATION.md
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
-->
# LeeWay Global P2P — Verification Evidence

**Date:** 2026-11-24
**Principle:** Evidence over narration. This file records executed commands and observed results only.

## 1. Command: `npm run verify`

| Stage | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit -p tsconfig.json` | PASS (0 errors) |
| Unit + integration | `tsx --test tests/*.test.ts` | **38 passed / 0 failed / 38 total** |
| Production build | `vite build` | PASS — `dist/` emitted (index 0.66 kB, JS ~333 kB, CSS ~4.75 kB) |
| Relay selftest | `node relay/relay-selftest.mjs` | **13 passed / 0 failed** |

Relay selftest coverage: two-peer Ed25519 challenge-response authentication, room join, signed message delivery, signed ACK forwarding, tampered-message rejection, expired-message rejection, unauthenticated publish rejection, bad challenge rejection; plus live circle enforcement (missing grant, expired grant, revoked grant, valid grant accepted with enforcement reported, wrong-circle dispatch rejected).

Unit coverage includes: crypto round trips and tamper rejection, capability expiry/scope/right/forgery, multi-recipient E2EE (US/Saudi/China/Britain fixtures), per-recipient ACK matrix, offline queue retention until every ACK, PTT/photo/video/file burst metadata, video clip encrypt/transfer/decrypt, QR chunking, invite links, circle grants (6-month/1-year/expired/revoked/wrong-circle/wrong-authority), PWA update decision helper, platform fallbacks, ordered PTT playback, gateway rejection cases (untrusted, forged, expired, wrong-room, receive-only, unverified, weak link), signed ACK retention, and honest satellite capability reporting.

## 2. HTTP and browser runtime

- `GET http://127.0.0.1:4173/` → **200**, `text/html`, correct hashed assets.
- `GET /assets/<hash>.js` → **200**, `text/javascript`.
- `GET /manifest.webmanifest` → **200**, valid PWA manifest.
- In-app Chromium: app rendered with **no console errors**. Creator logo present (256 px natural width), **70 selectable locales**, navigation labels localized. Switching to `zh` changed on-screen text to Chinese (身份 / 房间 / 路由 / 发送 / 加密消息…) with no errors.
- Note: a static HTTP 200 alone was not accepted as proof; the browser runtime check was performed separately.

## 3. Android artifact

- Project: Capacitor 6 Android, Java 17, Android SDK 34, Gradle wrapper 8.x.
- Signed release APK: `release/leeway-global-p2p-v1.0.0-release.apk`
- Package: `com.leeway.global.p2p`, versionCode 1, versionName 1.0, minSdk 22, targetSdk 34.
- Permissions: `INTERNET`, `CAMERA`, `RECORD_AUDIO` (media requested only on explicit user action).
- `apksigner verify --print-certs`: **verified**, signer DN `CN=LeeWay Global P2P, OU=LeeWay Ecosystem, O=LeeWay, L=Milwaukee, ST=WI, C=US`, certificate SHA-256 `24900d233d8e5b6f4a0d1355e59e60c95cf6e2bcd3f540f7c78ec27bbf924e7a`.
- SHA-256: `6fb6c692325f53a0e92d48a4b37dc362ac4468e809e3bb91bcfc331d28c0d6ea` (see `release/SHA256SUMS.txt`).
- Signing key is stored outside the repository at `C:\Users\Leona\.leeway\release-keys\leeway-global-p2p.jks`; no private key or password is committed.

## 4. Deployment state

| Item | Status |
|---|---|
| GitHub source push | **BLOCKED** — connected integration is read-only; no push attempted with a PAT. Exact permission requirement recorded in `governance/CHECKPOINT.md`. |
| GitHub Actions CI | Workflows authored (`build.yml`, `pages.yml`) but not executed remotely; remote CI status **NOT VERIFIED**. |
| GitHub Pages | **NOT DEPLOYED** — requires repository write permission. |
| QR code | `site/leeway-qr.png` generated locally; target URL `https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/downloads/leeway-global-p2p-v1.0.0-release.apk`. Live target resolution **NOT VERIFIED** until Pages is live. |

## 5. Honest NOT VERIFIED list

- Physical LeeWay Device Bridge mesh hardware: **NOT VERIFIED**.
- Authorized satellite gateway/terminal and real satellite uplink: **NOT VERIFIED**. (The app reports `NOT VERIFIED` unless a qualified gateway is registered.)
- Two-device field messaging across regions: **NOT VERIFIED**.
- Native iOS, Windows, macOS, Linux shells: **NOT VERIFIED** — universal Web/PWA path is built and browser-tested; physical OS testing has not occurred.
- Veritas approval, Receipt Authority records, Learning Ledger admission: **NOT CLAIMED**.
- Relay circle enforcement was tested against a locally spawned relay with a generated authority; no production service was configured or contacted.

## 6. Reproduction

```bash
npm ci && npm config set allow-scripts true
npm run verify
npm run preview   # http://127.0.0.1:4173
npm run relay     # ws://127.0.0.1:8787
```
