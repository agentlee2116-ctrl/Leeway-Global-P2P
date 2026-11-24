<!--
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CHECKPOINT
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: governance\CHECKPOINT.md
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/governance/CHECKPOINT.md
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
-->
# LeeWay Global P2P — Checkpoint

**Date:** 2026-11-24
**Active gate:** Secure communications integration repair (scoped branch `repair/secure-comms-integration-20261124`). UI integration is deployed; secure communications is NOT complete.

## Current published state

- Canonical repository: `agentlee2116-ctrl/Leeway-Global-P2P` (branch `main`). No other destination.
- Deployed commit: **`83c6deb042aac62bbe02b8fdfc631f40509ed6d7`** — corrected Creator-approved UI layer.
- CI on deployed commit: run **`45403363967`** SUCCESS (38/38 core tests, 13/13 relay tests, workflow validation 2/2).
- Pages deployment: run **`45404029161`** SUCCESS. Site `https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/`, app at `/app/`.
- Published APK: `release/leeway-global-p2p-v1.0.0-release.apk`, SHA-256 `f451712d6e9730ec561dbeb965c5ca5af251a5e45a51b8f6a23112c42dbd565f`, signature verified; QR points to the Pages download URL.
- Local workspace is a working clone only; no drive path is part of product identity (R10/R25).

## Critical defect under repair

The deployed UI's enrollment layer derives a message encryption key from public metadata (`deriveCircleSessionKey(circleId, ownerFingerprint)`). This is not confidentiality. The repair replaces it with per-recipient ECDH/HKDF/AES-GCM from `src/core/crypto.ts` and adds negative confidentiality tests. Until that repair is reviewed and merged, the published UI must not be described as secure for private communications.

## Historical evidence (preserved, not current)

- Earlier push denial: `git push -u origin main` → `remote: Permission to agentlee2116-ctrl/Leeway-Global-P2P.git denied to 4citeB4U.` / HTTP 403 / exit 128. Resolved later with the repository owner's authenticated account; remote HEAD advanced to `83c6deb`.
- Earlier CI failures before repair: `45382548979` (invalid YAML headers), `45382718293` (obsolete setup-android `tools` package), `45382866049` (`sdkmanager` not on PATH). All repaired; do not re-litigate.
- Earlier Pages deploy failures `45403577176` were transient artifact-propagation errors; a fresh dispatch (`45404029161`) succeeded.

## Open gates

1. Merge the scoped security/communications repair via reviewed PR; do not silently replace the published APK.
2. Physical LeeWay Device Bridge mesh or authorized satellite adapter for real transmission — NOT VERIFIED.
3. Two-device field messaging with signed ACKs, real audio and video — NOT VERIFIED.
4. Independent production verification and governance admission (Veritas/receipts/Learning Ledger) — not claimed.

## On interruption

Resume at the active gate. Preserve `main` at `83c6deb`; continue the scoped repair branch. Do not invent authority, receipts, physical tests, or security approval.
