# LeeWay Standards Alignment

**Authority:** LeeWay Standards, Permanent Engineering Rules R01–R25 (including R23 file standards and R25 GitHub-first source/reuse).
**Product:** LeeWay Global P2P — offline-first walkie-talkie dispatch for the LeeWay ecosystem.
**Repository:** `agentlee2116-ctrl/Leeway-Global-P2P`.

## Classification at this checkpoint

| Component | Classification | Decision |
|---|---|---|
| LeeWay RTC local WebRTC fallback | ALREADY BUILT (external canonical) | Reused through `src/core/rtc.ts`; not reimplemented as a competing runtime. |
| LeeWay Federate / Device Bridge authority model | ALREADY BUILT (external canonical) | Reused through `AuthorityRegistry` and signed gateway declarations. |
| Mesh/satellite qualification | PARTIALLY BUILT → IMPLEMENTED HERE | `src/core/transport.ts` implements authenticated-route, permission, encryption, link-health and signed-ACK checks. |
| Walkie-talkie dispatch (text/PTT/snap/file) | TRULY MISSING → IMPLEMENTED HERE | Unified message kinds, per-recipient envelopes, auto-play voice bursts. |
| Multi-peer family room and per-recipient ACK | TRULY MISSING → IMPLEMENTED HERE | `deliveryMatrix`, room fan-out, signed per-recipient ACKs. |
| Multilingual interface | TRULY MISSING → IMPLEMENTED HERE | `src/i18n.ts` with 60+ selectable locales and honest coverage reporting. |
| LeeWay logo identity | MISSING GLUE → ATTACHED HERE | Creator-supplied logo at `public/leeway-logo.png` and optimized app asset. |
| Physical satellite uplink | MISSING (external hardware) | Not claimed. Requires real authorized terminal; app reports NOT VERIFIED. |
| Veritas / Receipt Authority / Learning Ledger admission | NOT CLAIMED | No fabricated approval or receipt is asserted by this product repository. |

## Rule mapping (selected)

- **R01/R19/R25** — checkpoint and canonical GitHub destination recorded here; no drive path treated as identity.
- **R04/R08** — existing LeeWay RTC/Federate contracts reused; no competing control plane.
- **R09/R20** — smallest canonical repair: transport adapter + dispatch contracts, not a new federation authority.
- **R11/R24** — existing user work preserved; publication requires authorized write access and human approval.
- **R13/R14** — process health and static 200s are not proof; real crypto, negative gateway and WebSocket relay tests are executed.
- **R18** — receipts only for executed actions; evidence recorded in `docs/VERIFICATION.md`.
- **R21/R22** — header applicator and verification scripts turn repeated governance/build work into deterministic capabilities.
- **R23** — every governed authored source file carries LEEWAY_HEADER with REGION, TAG and 5WH.
- **R12** — no bypass of authorization, integrity, security or Veritas.

## R23 exemptions

JSON manifests, lockfiles, YAML GitHub Actions workflows, generated Capacitor Android scaffolding, build output, binary assets and receipt files are not hand-authored governed source; they are excluded from the header applicator and recorded here as exemptions rather than given invented metadata. YAML is excluded specifically because HTML comment headers make workflow files invalid and caused CI validation failures on 2026-11-24; the repair removed those headers and added a deterministic local YAML validation step.

## Presentation layer provenance (2026-11-24)

The corrected product UI was supplied as a self-contained React presentation layer and is now the canonical UI of this repository (`src/App.tsx`, `src/components/`, `src/index.css`, `src/utils/` UI helpers, `src/assets/`, `public/assets/aistudio/`). Root-absolute asset URLs were converted to relative URLs so the same UI runs from a GitHub Pages subpath, a local file shell, or any native wrapper without a drive-specific path.

The UI-local `utils/` modules are presentation/adapter state only. They do not replace LeeWay RTC, Federate, Device Bridge, identity, circle or governance authorities in `src/core/`. No claim is made that enrollment or circle state held by the UI is a canonical LeeWay authority; binding to canonical contracts remains a separate acceptance gate.

## Visual identity

The Creator-supplied logo `leewaysmalllogo.png` is the product mark. It appears in the application header, the GitHub Pages landing page, and the packaged web assets. No alternate logo is substituted.
