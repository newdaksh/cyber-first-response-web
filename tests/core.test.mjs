import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, createFreshIncident } from '../lib/incident.ts';
import { aiProvider, demoDescription, demoScenarios, getEvidenceRequirements, getIncidentGuide, officialLinks, parseClock, validateClassification } from '../lib/services.ts';

test('classifies the golden Hinglish scenario probabilistically', async () => {
  const result = await aiProvider.classifyIncident(demoDescription);
  assert.equal(result.incidentType, 'card_or_banking_fraud');
  assert.equal(result.severity, 'critical');
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

test('provides evidence requirements that match the incident type', async () => {
  const result = aiProvider.demoEvidence('demo.png');
  assert.equal(Object.keys(result.detected).length, 9);
  const financial = getEvidenceRequirements('upi_payment_fraud');
  const ransomware = getEvidenceRequirements('ransomware_or_malware');
  assert.ok(financial.some((field) => field.key === 'transactionId'));
  assert.ok(ransomware.some((field) => field.key === 'device'));
  assert.notDeepEqual(financial.map((field) => field.key), ransomware.map((field) => field.key));
});

test('orders generated timeline chronologically', async () => {
  const incident = createFreshIncident();
  incident.description = 'A suspicious transaction appeared in my account.';
  const timeline = await aiProvider.generateTimeline(incident);
  const times = timeline.map((event) => parseClock(event.timestamp));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.equal(timeline[0].title, 'Incident reported by complainant');
  assert.equal(timeline.at(-1).title, 'First-response plan created');
});

test('generates a structured complaint with fictional identifiers', async () => {
  const incident = createFreshIncident();
  incident.description = demoDescription;
  incident.incidentType = 'card_or_banking_fraud';
  incident.amount = 25000;
  incident.entities.transactionIds = ['DEMO2508231051'];
  incident.entities.upiIds = ['demo.receiver@upi'];
  const complaint = await aiProvider.generateComplaint(incident);
  assert.match(complaint, /₹25,000/);
  assert.match(complaint, /DEMO2508231051/);
  assert.match(complaint, /requires human review before official submission/i);
});

test('enforces sequential incident state transitions and reset', () => {
  assert.equal(canTransition('NEW', 'INTAKE'), true);
  assert.equal(canTransition('INTAKE', 'ACTION_REQUIRED'), false);
  assert.equal(canTransition('HANDOFF', 'NEW'), true);
});

test('official routes are defined for NCRP, suspect reports, CEIR, and technical incidents', () => {
  assert.equal(officialLinks.ncrp, 'https://cybercrime.gov.in/');
  assert.match(officialLinks.suspect, /cyber_suspect/);
  assert.match(officialLinks.ceir, /sancharsaathi/);
  assert.equal(getIncidentGuide('lost_or_stolen_phone').reportingRoute, 'ceir');
});

test('loads saved cases that use legacy incident category names', () => {
  assert.equal(getIncidentGuide('bank_otp_fraud').type, 'card_or_banking_fraud');
  assert.equal(getIncidentGuide('investment_scam').type, 'investment_or_crypto_scam');
  assert.equal(getIncidentGuide('digital_arrest').type, 'impersonation_or_digital_arrest');
  assert.equal(getIncidentGuide('phishing').type, 'phishing_or_vishing');
  assert.equal(getIncidentGuide('unknown_future_type').type, 'other');
});
