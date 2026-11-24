<!--
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.STANDALONE
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: docs\STANDALONE.md
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/docs/STANDALONE.md
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
-->
# Standalone HTML — capabilities and limits

`npm run standalone` builds `dist/leeway-global-p2p-standalone.html` from canonical source. It inlines the built JS, CSS, logos, avatars and snap images as data URLs and verifies that no external script, stylesheet or image references remain. Web-font links are optional and degraded gracefully.

## Works
- Opens directly as a local file in a modern browser with no web server.
- Full Creator-approved UI, language selection and enrollment flows.
- Local IndexedDB state where the browser permits it for `file://` origins.
- Manual encrypted bundle export/import.

## Restricted / NOT VERIFIED
- Service-worker installation, background sync and install prompts are unavailable from `file://`.
- Real relay/RTC delivery requires an authorized relay reachable over the network; a standalone file alone does not create a route.
- Camera/microphone may be refused on insecure `file://` origins depending on browser policy.
- No push notifications, native device APIs, or satellite/Device Bridge hardware path.
- Two-device physical testing of the standalone file is NOT VERIFIED.

The standalone file is a portability artifact, not a substitute for the hosted PWA or a signed native build.
