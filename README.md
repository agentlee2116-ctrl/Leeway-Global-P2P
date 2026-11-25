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

## Display name
The UI displays **LeeWay Global Family Connect**. Package, repository, API and internal identities remain `leeway-global-p2p` / `LeeWay Global P2P`.

## Credential-bound invites
- The organizer creates a room, enters the member's name and phone/email, chooses their device (iPhone/iPad, Android, Windows, Mac or Linux), link expiry and membership length, and optionally sets a login name and temporary password.
- One signed invite link and one QR code carry the same invite token, recipient identity, login name and temporary password in the URL fragment (never sent to the host). Share by native share sheet, copy, text/email, WhatsApp, Telegram, SMS or other apps.
- On first login the member must change the temporary password before the room opens. Every later launch requires that username/password plus the device key.
- The owner can revoke any invite link or any member from the same panel. Offline members can still leave encrypted messages that queue on their device and sync when a link opens.

## Clean entry and invite flow

- The Creator logo appears once at the top left of the app, plus the mandatory boot splash. Sign-in, enrollment and dialogs use plain icons/text instead of repeated logos.
- After sign-in the organizer sees **Invite your family** immediately: configure link expiry and membership length, create a signed invite link, then use **Share invite** (native share sheet on phones/tablets) or copy/share via WhatsApp, Telegram, Email, SMS and X. A backup invite code can also be copied. No JSON download is required to invite someone.
- The invite link points to the hosted PWA, where relatives install the app on iPhone/iOS, Android, Windows, macOS or Linux and join the circle.

## OS and device support
One responsive web/PWA core runs in Safari, Chrome, Edge and Firefox on phones, tablets and desktops across Apple, Android, Windows, Linux and macOS. Safe-area insets and 44px touch targets are applied. Native wrappers (Capacitor Android) are optional and must not block the universal web build. Physical testing on each OS is NOT VERIFIED.

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
