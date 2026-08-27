import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';

test('applies security headers and repairs an invalid session cookie', async ({ baseURL }) => {
  const context = await apiRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: 'unrelated=%E0%A4%A; cfr_session=invalid' },
  });
  const response = await context.get('/');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');

  const apiResponse = await context.get('/api/case');
  expect(apiResponse.headers()['set-cookie']).toMatch(/cfr_session=[a-f0-9-]{36}/i);
  await context.dispose();
});

test('rejects cross-origin, malformed, and stale case mutations', async ({ request, baseURL }) => {
  const reset = await request.post('/api/case', {
    headers: { Origin: baseURL! },
    data: { action: 'reset' },
  });
  expect(reset.status()).toBe(201);
  const resetBody = await reset.json();

  const crossOrigin = await request.post('/api/case', {
    headers: { Origin: 'https://attacker.example' },
    data: { action: 'begin', revision: resetBody.snapshot.revision },
  });
  expect(crossOrigin.status()).toBe(403);

  const malformed = await request.post('/api/case', {
    headers: { Origin: baseURL!, 'Content-Type': 'application/json' },
    data: '{not-json',
  });
  expect(malformed.status()).toBe(400);

  const begin = await command(request, baseURL!, 'begin', resetBody.snapshot.revision);
  const stale = await command(request, baseURL!, 'back', resetBody.snapshot.revision);
  expect(stale.status()).toBe(409);
  const staleBody = await stale.json();
  expect(staleBody.snapshot.revision).toBe((await begin.json()).snapshot.revision);
});

test('persists the complete server workflow and rejects spoofed evidence', async ({
  request,
  baseURL,
}) => {
  let response = await request.post('/api/case', {
    headers: { Origin: baseURL! },
    data: { action: 'reset' },
  });
  let body = await response.json();
  const firstCaseId = body.snapshot.incident.id;

  response = await command(request, baseURL!, 'loadDemo', body.snapshot.revision);
  body = await response.json();
  response = await command(request, baseURL!, 'clarify', body.snapshot.revision, {
    service: '',
    time: 'Today',
    portalCategory: 'Financial Fraud',
    portalSubCategory: 'Debit / Credit Card Fraud / SIM Swap Fraud',
    occurrencePlatform: 'Other',
    financialLoss: 'yes',
  });
  body = await response.json();
  response = await command(request, baseURL!, 'advance', body.snapshot.revision, {
    to: 'EVIDENCE_COLLECTION',
  });
  body = await response.json();

  const spoofed = await request.post('/api/case/evidence', {
    headers: { Origin: baseURL! },
    multipart: {
      revision: String(body.snapshot.revision),
      file: { name: '../../unsafe.png', mimeType: 'image/png', buffer: Buffer.from('not-png') },
    },
  });
  expect(spoofed.status()).toBe(415);

  const evidence = await request.post('/api/case/evidence', {
    headers: { Origin: baseURL! },
    multipart: { revision: String(body.snapshot.revision), demo: 'true' },
  });
  expect(evidence.status()).toBe(201);
  body = await evidence.json();
  response = await command(request, baseURL!, 'timeline', body.snapshot.revision);
  body = await response.json();
  response = await command(request, baseURL!, 'advance', body.snapshot.revision, {
    to: 'CASE_READY',
  });
  body = await response.json();
  response = await command(request, baseURL!, 'complaint', body.snapshot.revision);
  body = await response.json();
  response = await command(request, baseURL!, 'review', body.snapshot.revision, {
    draft: `${body.snapshot.incident.complaint.draft}\nPIN: 1234`,
  });
  body = await response.json();
  expect(body.snapshot.incident.complaint.draft).not.toContain('1234');
  response = await command(request, baseURL!, 'handoff', body.snapshot.revision);
  body = await response.json();
  expect(body.snapshot.incident.status).toBe('HANDOFF');

  const fresh = await request.post('/api/case', {
    headers: { Origin: baseURL! },
    data: { action: 'reset' },
  });
  const freshBody = await fresh.json();
  expect(freshBody.snapshot.incident.id).not.toBe(firstCaseId);
  expect(freshBody.snapshot.incident.evidence).toHaveLength(0);
});

function command(
  request: APIRequestContext,
  origin: string,
  action: string,
  revision: number,
  values: Record<string, unknown> = {},
) {
  return request.post('/api/case', {
    headers: { Origin: origin },
    data: { action, revision, ...values },
  });
}
