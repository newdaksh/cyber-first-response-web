import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from '../lib/incident.ts';
import { aiProvider, calculateEvidenceCompleteness, demoDescription, demoScenarios, governmentService, parseClock, validateClassification } from '../lib/services.ts';

test('classifies the golden Hinglish scenario probabilistically', async () => {
  const result = await aiProvider.classifyIncident(demoDescription);
  assert.equal(result.incidentType, 'bank_otp_fraud');
  assert.equal(result.severity, 'high');
  assert.ok(result.confidence >= 0.85 && result.confidence < 1);
  assert.equal(validateClassification(result), true);
});

test('extracts amount, OTP involvement, and Hinglish language', async () => {
  const result = await aiProvider.extractIncident(demoDescription);
  assert.equal(result.amount, 25000);
  assert.equal(result.otpInvolved, true);
  assert.equal(result.language, 'hinglish');
});

test('supports every required fraud classification', async () => {
  for (const scenario of demoScenarios) {
    const result = await aiProvider.classifyIncident(scenario.description);
    assert.equal(result.incidentType, scenario.expectedType, scenario.label);
  }
});

test('calculates evidence completeness from fields, not decoration', async () => {
  const result = await aiProvider.extractEvidence('demo.png');
  assert.equal(Object.keys(result.detected).length, 9);
  assert.equal(calculateEvidenceCompleteness(result.detected), 82);
  assert.equal(calculateEvidenceCompleteness({}), 0);
});

test('orders generated timeline chronologically', async () => {
  const timeline = await aiProvider.generateTimeline({});
  const times = timeline.map((event) => parseClock(event.timestamp));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.equal(timeline[0].title, 'Initial contact');
  assert.equal(timeline.at(-1).title, 'Fraud suspected');
});

test('generates a structured complaint with fictional identifiers', async () => {
  const complaint = await aiProvider.generateComplaint({ entities: { transactionIds: ['DEMO2508231051'], upiIds: ['demo.receiver@upi'] } });
  assert.match(complaint, /₹25,000/);
  assert.match(complaint, /DEMO2508231051/);
  assert.match(complaint, /fictional demo data/i);
});

test('enforces sequential incident state transitions and reset', () => {
  assert.equal(canTransition('NEW', 'INTAKE'), true);
  assert.equal(canTransition('INTAKE', 'ACTION_REQUIRED'), false);
  assert.equal(canTransition('HANDOFF', 'NEW'), true);
});

test('government handoff is explicitly simulated', async () => {
  const result = await governmentService.simulateHandoff();
  assert.equal(result.status, 'simulated');
  assert.match(result.message, /external official reporting/i);
});
