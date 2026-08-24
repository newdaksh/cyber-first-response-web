import assert from 'node:assert/strict';

const origin = process.env.CFR_TEST_ORIGIN || 'http://localhost:3001';
let cookie = '';

async function request(path, init = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: { Origin: origin, ...(cookie && { Cookie: cookie }), ...init.headers },
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';', 1)[0];
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${body.error || JSON.stringify(body)}`);
  return body;
}

const reset = await request('/api/case', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) });
const demo = await command('loadDemo', reset.snapshot.revision);
const clarified = await command('clarify', demo.snapshot.revision, { service: 'Demo Bank', time: '10:51 AM, 23 Aug 2026' });
const evidenceStage = await command('advance', clarified.snapshot.revision, { to: 'EVIDENCE_COLLECTION' });

const evidenceForm = new FormData();
evidenceForm.set('revision', String(evidenceStage.snapshot.revision));
evidenceForm.set('demo', 'true');
const evidence = await request('/api/case/evidence', { method: 'POST', body: evidenceForm });
const timeline = await command('timeline', evidence.snapshot.revision);
const caseReady = await command('advance', timeline.snapshot.revision, { to: 'CASE_READY' });
const complaint = await command('complaint', caseReady.snapshot.revision);
const reviewed = await command('review', complaint.snapshot.revision, { draft: complaint.snapshot.incident.complaint.draft });
const handoff = await command('handoff', reviewed.snapshot.revision);
const returnedToReview = await command('back', handoff.snapshot.revision);
const finalHandoff = await command('handoff', returnedToReview.snapshot.revision);
const restored = await request('/api/case');

assert.equal(returnedToReview.snapshot.incident.status, 'REVIEW');
assert.equal(finalHandoff.snapshot.incident.status, 'HANDOFF');
assert.equal(restored.snapshot.incident.id, finalHandoff.snapshot.incident.id);
assert.equal(restored.snapshot.revision, finalHandoff.snapshot.revision);
assert.equal(restored.snapshot.incident.evidence.length, 1);
assert.equal(restored.snapshot.incident.timeline.length, 5);
console.log(JSON.stringify({ status: restored.snapshot.incident.status, revision: restored.snapshot.revision, evidence: 1, timeline: 5 }));

function command(action, revision, values = {}) {
  return request('/api/case', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, revision, ...values }),
  });
}
