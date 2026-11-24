<!--
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.DEPLOYMENT
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: docs\DEPLOYMENT.md
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/docs/DEPLOYMENT.md
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
-->
# LeeWay Global P2P — Deployment Runbook

## Canonical source

`https://github.com/agentlee2116-ctrl/Leeway-Global-P2P` branch `main`. GitHub owns versioned source and release identity; no machine path is canonical.

## Platform matrix

| Platform | Install route | Physical verification |
|---|---|---|
| Web/PWA (any browser) | Hosted HTTPS URL, Add to Home Screen | Browser runtime tested; per-OS physical tests NOT VERIFIED |
| Android | Signed APK from Releases/Pages, or PWA | APK built and signed locally; device install NOT VERIFIED |
| iPhone/iOS | Safari → Add to Home Screen | NOT VERIFIED |
| Windows / macOS / Linux | Browser PWA install | NOT VERIFIED |

## Required CI secrets

| Secret | Purpose |
|---|---|
| `LEEWAY_KEYSTORE_BASE64` | Base64 of the production JKS (stored outside the repo) |
| `LEEWAY_STORE_PASSWORD` | Keystore password |
| `LEEWAY_KEY_ALIAS` | Signing key alias |
| `LEEWAY_KEY_PASSWORD` | Key password |

Optional relay circle enforcement:

| Variable | Purpose |
|---|---|
| `LEEWAY_CIRCLE_AUTHORITY_JWK` | Public JWK of the circle authority; when absent the relay runs in open mode and reports it |
| `LEEWAY_CIRCLE_ADMIN` | Fingerprint allowed to revoke grants via the `revoke` frame |
| `LEEWAY_REVOKED_GRANTS` | Comma-separated revoked grant IDs loaded at start |

Never put secrets in source, QR payloads or chat.

## Workflows

- **build.yml** — `npm run verify` (38 core + 13 relay tests), `npx cap sync android`, resolves version from tag or `build.gradle`, sets `sdk.dir`, decodes the keystore when present, builds `assembleRelease`, writes `SHA256SUMS.txt` dynamically from the version, runs `apksigner verify --print-certs`, uploads the artifact, and publishes a GitHub Release on `v*` tags. Without signing secrets the universal web build still completes and the optional native step is skipped.
- **pages.yml** — builds the universal app, downloads the signed APK artifact when available, generates `pages-dist/leeway-qr.png`, publishes `site/` at the root, `dist/` under `/app/`, `VERIFICATION.md` under `/app/`, and the APK under `/downloads/`.

## Steps

1. Grant the integration `Contents: read and write` (R24). No PAT in chat.
2. Push `main`; confirm CI results and remote commit SHA.
3. Tag `v1.0.0` to publish the signed APK and checksum.
4. Enable Pages with GitHub Actions as source; verify the HTTPS URL and QR target.

## Notes

- Local builds use Java 17, Android SDK 34 and a Capacitor 6 Gradle wrapper.
- PWA updates never clear the IndexedDB queue; refresh is a one-tap user action.
- Mesh hardware and satellite uplinks remain **NOT VERIFIED** until authorized physical integration exists.
