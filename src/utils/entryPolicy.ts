/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.ENTRY_POLICY
WHO: LeeWay Global P2P engineering under Creator authority
WHAT: Exact minimum splash-screen timing gate
WHY: Show full Creator logo for at least six seconds before sign-in on every fresh entry
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/entryPolicy.ts
WHEN: 2026-11-24
HOW: Monotonic elapsed time with a minimum six-second delay, no simulated progress percentage
LICENSE: No new license asserted; preserve repository terms
*/
export const LEEWAY_MINIMUM_SPLASH_MS = 6000;
export function remainingSplashMs(start: number, now: number, minimum = LEEWAY_MINIMUM_SPLASH_MS): number {
  return Math.max(0, minimum - Math.max(0, now - start));
}
export async function holdSplashSince(start: number, now: () => number = () => performance.now(), sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<void> {
  await sleep(remainingSplashMs(start, now()));
}
