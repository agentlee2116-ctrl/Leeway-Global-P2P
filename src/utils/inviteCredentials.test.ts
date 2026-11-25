/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.INVITE_CREDENTIALS_TEST
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Tests for credential-bearing invite links and first-login rotation contracts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/inviteCredentials.test.ts
WHY: Links must carry name, login and temporary password without exposing them to the hosting server
HOW: Deterministic encode/parse checks plus negative legacy-link handling
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeRecipientInviteUrl, installInstructions, makeTemporaryPassword, makeUsername,
  parseRecipientInviteUrl, type InviteCredentials,
} from './inviteCredentials';

const sample: InviteCredentials = {
  v: 1,
  inviteToken: 'LWINV1:abc123',
  recipientName: 'Aunt Maya',
  recipientAddress: '+1 555 0100',
  username: 'aunt.maya.x7k',
  temporaryPassword: 'TempPass123!',
  circleName: 'Lee Family',
  createdAt: 1,
  expiresAt: 9,
  osHint: 'ios',
};

test('invite URL carries credentials in the fragment and round-trips', () => {
  const url = encodeRecipientInviteUrl(sample);
  assert.ok(url.includes('#join='));
  assert.ok(url.includes('?invite=LWINV1%3Aabc123'));
  const parsed = parseRecipientInviteUrl(url);
  assert.deepEqual(parsed, sample);
});

test('legacy invite token is recognised but carries no credentials', () => {
  assert.equal(parseRecipientInviteUrl('https://example.org/app/?invite=LWINV1:abc123'), null);
  assert.equal(parseRecipientInviteUrl('nonsense'), null);
  assert.equal(parseRecipientInviteUrl('https://example.org/app/#join=!!!'), null);
});

test('temporary passwords and generated usernames are unique and safe to share', () => {
  const a = makeTemporaryPassword();
  const b = makeTemporaryPassword();
  assert.notEqual(a, b);
  assert.equal(a.length, 16);
  assert.ok(!a.includes('0') && !a.includes('O'));
  assert.match(makeUsername('Aunt Maya'), /^aunt\.maya\.[a-z0-9]+$/i);
});

test('install instructions are OS-specific without claiming hardware support', () => {
  assert.match(installInstructions('ios'), /Safari/);
  assert.match(installInstructions('android'), /Chrome/);
  assert.match(installInstructions('windows'), /browser/);
  assert.match(installInstructions('linux'), /browser/);
});
