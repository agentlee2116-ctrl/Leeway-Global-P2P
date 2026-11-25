/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.JOIN_PAGE_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Verifies the join landing page preserves the invite across installation
WHEN: 2026-11-25
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/tests/join-page.test.ts
WHY: A family member must return to the exact room even if the link is lost during install
HOW: Static source assertions plus URL base checks from canonical credential helpers
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { encodeRecipientInviteUrl, type InviteCredentials } from '../src/utils/inviteCredentials.ts';

const sample: InviteCredentials = {
  v: 1, inviteToken: 'LWINV1:abc', recipientName: 'Maya', recipientAddress: 'maya@example.com',
  username: 'maya.x1', temporaryPassword: 'TempPass123!', circleName: 'Lee Family',
  createdAt: 1, expiresAt: 9999999999999, osHint: 'ios',
};

test('invite links target the dedicated join page', () => {
  const url = encodeRecipientInviteUrl(sample);
  assert.ok(url.startsWith('https://agentlee2116-ctrl.github.io/Leeway-Global-P2P/join/'));
  assert.ok(url.includes('#join='));
});

test('join page stores the invite before install and forwards it to the app', async () => {
  const file = path.join(process.cwd(), 'site', 'join', 'index.html');
  const html = await readFile(file, 'utf8');
  assert.match(html, /lwp\.pendingJoinUrl/);
  assert.match(html, /localStorage\.setItem/);
  assert.match(html, /\.\.\/app\/\?invite=/);
  assert.match(html, /expiresAt/);
  assert.match(html, /Add to Home Screen/);
});
