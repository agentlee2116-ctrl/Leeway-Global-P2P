<!--
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.README
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: README.md
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/README.md
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
-->
# LeeWay Global P2P

**Offline-first walkie-talkie dispatch for the LeeWay ecosystem.** One shared room, identity, circle and crypto model across **Android, iPhone/iOS, Windows, macOS, Linux and Web/PWA**.

## UI

The canonical UI is a device- and OS-agnostic React presentation layer (`src/App.tsx`, `src/components/`, `src/index.css`, `src/utils/`) with the Creator's logo, onboarding gates, walkie-talkie deck, dispatch cards, video snaps, language selection and security dashboard. It renders identically from GitHub Pages, a local browser, or a native wrapper; no drive path or local machine is part of its identity.

## What it does

| Mode | Behaviour |
|---|---|
| Text | Signed, encrypted dispatch; per-recipient envelopes; TTL/expiry; queued offline |
| PTT | Push-to-talk voice bursts — record, release, send; receivers auto-play in order, no ring or call setup |
| Snap / file | Encrypted photo, video and file bundles with SHA-256, mime and duration metadata |
| Private circle | Unique `circleId` with signed, time-bound (6-month / 1-year) and revocable service grants |
| Private video room | Explicit opt-in live WebRTC room; never the default |
| Mesh / satellite | Authorized LeeWay Device Bridge / Federate gateways only; honest `NOT VERIFIED` otherwise |

E2EE happens **on the sender before queueing, relaying, bundling or QR chunking**. The relay sees only ciphertext. Per-recipient signed ACKs track delivery independently for multi-member rooms across regions.

## Tiered family delivery

1. **Online:** hosted Web/PWA link or signed invite link (keys verified, URL never trusted alone).
2. **In person:** QR codes and local share for face-to-face pairing or air-gapped handoff.
3. **Offline:** encrypted store-and-forward bundles by messaging app, email, USB/SD, nearby share or courier; very small payloads via QR chunks.

See `docs/FAMILY-ONBOARDING.md`.

## Install

- **iOS:** open the hosted URL in Safari → Add to Home Screen.
- **Android:** install the signed APK from Releases/Pages and verify `release/SHA256SUMS.txt`, or use the web app.
- **Desktop:** open the same URL in Chrome/Edge/Firefox/Safari and install as a PWA.

## Verify

```bash
npm ci
npm run verify
# Result: typecheck PASS · 38/38 tests PASS · production build PASS · 13/13 relay tests PASS
npm run preview    # http://127.0.0.1:4173
npm run relay      # ws://127.0.0.1:8787
```

PWA updates: the service worker uses a network-first shell, detects new builds, and offers a one-tap refresh. IndexedDB queue entries are never cleared on update.

## CI secrets

`LEEWAY_KEYSTORE_BASE64`, `LEEWAY_STORE_PASSWORD`, `LEEWAY_KEY_ALIAS`, `LEEWAY_KEY_PASSWORD`. Optional relay enforcement: `LEEWAY_CIRCLE_AUTHORITY_JWK`, `LEEWAY_CIRCLE_ADMIN`, `LEEWAY_REVOKED_GRANTS`.

## Secure communications repair (scoped branch)

- Message confidentiality uses canonical per-recipient ECDH/HKDF/AES-GCM (`src/core/crypto.ts`); the former key derived from public `circleId` + `ownerFingerprint` was removed and is guarded by a negative test.
- Real `RelayClient`/`P2PLink` transport is bridged into the UI via `src/comms/bridge.ts`; signed text, PTT audio and snap dispatch are sent with signed ACKs and offline retry.
- PTT uses actual microphone capture through `src/platform`; video-room uses real RTC media and relay signaling. BroadcastChannel is local-tab sync only.
- 70-locale selector is reconciled with the 20 fully translated UI bundles; unsupported locales are explicitly labelled "English fallback" and stored across restarts.
- Standalone single-file build: `npm run standalone` → `dist/leeway-global-p2p-standalone.html` (see `docs/STANDALONE.md`).
- Verification totals: **55 unit/integration tests**, **13 relay integration tests**, 2 valid workflows, standalone PASS.

## Honest status

Mesh hardware, satellite uplink, cross-region two-device testing and native OS shells are **NOT VERIFIED**. No Veritas/receipt/Learning Ledger admission is claimed. Full evidence: `docs/VERIFICATION.md`.

## Governance

`AGENTS.md`, `governance/LEEWAY-STANDARDS-ALIGNMENT.md`, `governance/CHECKPOINT.md`, `docs/DEPLOYMENT.md`.
