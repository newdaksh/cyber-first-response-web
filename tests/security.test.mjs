import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCaseRequest, readCaseRequest } from '../lib/commands.ts';
import {
  hasValidEvidenceSignature,
  normalizeEvidenceField,
  safeEvidenceFileName,
} from '../lib/evidence.ts';
import { StoreError } from '../lib/errors.ts';
import { createFreshIncident } from '../lib/incident.ts';
import { redactSensitiveText } from '../lib/security.ts';
import { analysisService } from '../lib/services.ts';
import { applyCaseCommand } from '../lib/workflow.ts';

test('redacts authentication secrets without removing incident context', () => {
  const redacted = redactSensitiveText(
    'The caller asked for OTP 123456, PIN: 4321, CVV was 987 and password is S3cret!',
  );
  assert.match(redacted, /caller asked for OTP \[REDACTED\]/);
  assert.doesNotMatch(redacted, /123456|4321|987|S3cret!/);
  assert.equal((redacted.match(/\[REDACTED\]/g) ?? []).length, 4);
  assert.equal(normalizeEvidenceField(' PIN = 9988 '), 'PIN = [REDACTED]');
});

test('validates every case command before it reaches workflow logic', () => {
  assert.deepEqual(parseCaseRequest({ action: 'begin', revision: 0 }), {
    action: 'begin',
    revision: 0,
  });
  assert.deepEqual(parseCaseRequest({ action: 'reset', ignored: true }), { action: 'reset' });

  for (const invalid of [
    null,
    { action: 'unknown', revision: 0 },
    { action: 'begin', revision: -1 },
    { action: 'advance', revision: 1, to: 'HANDOFF' },
    { action: 'analyze', revision: 1, description: 42 },
  ]) {
    assert.throws(
      () => parseCaseRequest(invalid),
      (error) => error instanceof StoreError && error.status === 400,
    );
  }
});

test('rejects wrong content types and oversized JSON commands', async () => {
  await assert.rejects(
    readCaseRequest(new Request('https://example.test/api/case', { method: 'POST', body: '{}' })),
    (error) => error instanceof StoreError && error.status === 415,
  );
  await assert.rejects(
    readCaseRequest(
      new Request('https://example.test/api/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', revision: 0, description: 'x'.repeat(50_000) }),
      }),
    ),
    (error) => error instanceof StoreError && error.status === 413,
  );
});

test('sanitizes evidence names and validates declared file signatures', () => {
  assert.equal(safeEvidenceFileName('../../OTP receipt (1).png'), '.._.._OTP_receipt_1_.png');
  assert.equal(safeEvidenceFileName('..'), 'evidence');
  assert.equal(
    hasValidEvidenceSignature(
      'image/png',
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]),
    ),
    true,
  );
  assert.equal(
    hasValidEvidenceSignature('image/png', new TextEncoder().encode('not a png')),
    false,
  );
  assert.equal(
    hasValidEvidenceSignature(
      'image/webp',
      new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
    ),
    true,
  );
});

test('runs the workflow deterministically, redacts drafts, and preserves edits', async () => {
  let snapshot = {
    incident: createFreshIncident('00000000-0000-4000-8000-000000000001'),
    classification: null,
    missing: [],
    detected: {},
    revision: 0,
  };
  snapshot = await command(snapshot, { action: 'begin', revision: 0 });
  snapshot = await command(snapshot, {
    action: 'analyze',
    revision: 0,
    description: 'A bank caller took OTP 123456 and ₹2000 was debited.',
  });
  assert.equal(snapshot.incident.status, 'TRIAGE');
  assert.doesNotMatch(snapshot.incident.description, /123456/);

  snapshot = await command(snapshot, {
    action: 'clarify',
    revision: 0,
    service: '',
    time: 'Today',
    portalCategory: 'Financial Fraud',
    portalSubCategory: 'Fraud Call / Vishing',
    occurrencePlatform: 'Other',
    financialLoss: 'yes',
  });
  snapshot = await command(snapshot, {
    action: 'toggleAction',
    revision: 0,
    actionId: snapshot.incident.actionPlan[0].id,
  });
  snapshot = await command(snapshot, {
    action: 'advance',
    revision: 0,
    to: 'EVIDENCE_COLLECTION',
  });
  snapshot.incident.evidence.push(analysisService.demoEvidence().evidence);
  snapshot = await command(snapshot, { action: 'timeline', revision: 0 });
  snapshot = await command(snapshot, { action: 'advance', revision: 0, to: 'CASE_READY' });
  snapshot = await command(snapshot, { action: 'complaint', revision: 0 });
  assert.match(snapshot.incident.complaint.draft, /Call 1930 immediately/);
  assert.doesNotMatch(snapshot.incident.complaint.draft, /Contact your bank or payment provider/);

  snapshot = await command(snapshot, {
    action: 'editComplaint',
    revision: 0,
    draft: 'Edited draft; password is hunter2.',
  });
  snapshot = await command(snapshot, { action: 'back', revision: 0 });
  snapshot = await command(snapshot, { action: 'complaint', revision: 0 });
  assert.equal(snapshot.incident.complaint.draft, 'Edited draft; password is [REDACTED]');
});

test('rejects commands that do not belong to the current workflow stage', async () => {
  const snapshot = {
    incident: createFreshIncident(),
    classification: null,
    missing: [],
    detected: {},
    revision: 0,
  };
  await assert.rejects(
    command(snapshot, { action: 'handoff', revision: 0 }),
    (error) => error instanceof StoreError && error.status === 409,
  );
});

function command(snapshot, value) {
  return applyCaseCommand(snapshot, value, analysisService);
}
