<!--
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.FAMILY_ONBOARDING
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: docs\FAMILY-ONBOARDING.md
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/docs/FAMILY-ONBOARDING.md
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
-->
# Family Join & First Walkie-Talkie Test

A three-step guide to share with relatives in the U.S., Saudi Arabia, China, Britain, or anywhere else.

## Step 1 — Get the app

- **iPhone/iOS:** open the hosted web address in Safari and use **Share → Add to Home Screen**. No App Store account or carrier plan is needed.
- **Android:** install the signed APK from the download page, or use the web app. Verify the SHA-256 before installing.
- **Windows/macOS/Linux:** open the same web address in Chrome, Edge, Firefox or Safari and install it as a PWA from the browser menu.

A hosted link works across countries only when the network reaches the device. If the link is blocked, use the offline bundle route in Step 3.

## Step 2 — Join the family circle

1. The circle owner generates an **invite link** or **identity bundle** in **Setup**.
2. Each member pastes the link or imports the JSON bundle in **Setup → Pair**, then confirms the displayed key fingerprint with the owner.
3. Room membership is verified by the signed identity key and room id — **never by the URL alone**. A copied link from a stranger is not membership.

QR codes are for face-to-face pairing or an air-gapped local handoff. A QR is a visual payload, not a long-distance transport.

## Step 3 — First walkie-talkie test

1. Send a **text dispatch**. It is encrypted before it enters the queue.
2. Hold **Push to talk**, speak, release. The burst is sent as a self-contained clip; the receiver plays queued bursts in order. There is no ring and no call to answer.
3. Send a **photo or video snap** and a file. Each is encrypted and SHA-256 bound.
4. Check the **✓ per-recipient confirmations** on each dispatch. A member who is offline does not block confirmations from members who are online.

## When the connection is weak or absent

- Dispatches stay in the local encrypted queue and are retried when a link opens.
- For an air-gapped handoff, export an **encrypted bundle** and deliver it by messaging app, email, USB/SD card, nearby share or courier. Intermediaries cannot read it.
- QR chunks are suitable only for tiny payloads. They require both phones to be physically together.

## Honest limits

- There is no worldwide guarantee: routes, relays and web pages can be slow, blocked or unavailable by country and carrier.
- Satellite delivery requires a real authorized terminal; the app reports `NOT VERIFIED` until one is registered.
- Use only for lawful personal family communication and respect local encryption and telecom rules.
- Live video is strictly opt-in via **Private Room** when everyone is online; the default remains the offline-first dispatch feed.
