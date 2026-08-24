import { analysisService } from '../../../../lib/services';
import { errorResponse, json, requireRevision, text } from '../../../../lib/server/http';
import { assertSameOrigin, getSession, loadCurrentSnapshot, putEvidenceObject, saveEvidenceObject, saveSnapshot, StoreError, withSessionCookie } from '../../../../lib/server/store';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

export async function POST(request: Request) {
  const session = getSession(request);
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const current = await loadCurrentSnapshot(session.id);
    if (!current) throw new StoreError(404, 'Start a case before adding evidence.');
    requireRevision(Number(form.get('revision')), current);
    if (current.incident.status !== 'EVIDENCE_COLLECTION') throw new StoreError(409, 'Evidence can only be added during evidence collection.');

    const isDemo = form.get('demo') === 'true';
    const fileValue = form.get('file');
    const file = fileValue instanceof File && fileValue.size ? fileValue : null;
    if (!isDemo && !file) throw new StoreError(400, 'Choose an evidence file to upload.');
    if (file && file.size > MAX_FILE_BYTES) throw new StoreError(413, 'Evidence files must be 10 MB or smaller.');
    if (file && !ALLOWED_TYPES.has(file.type)) throw new StoreError(415, 'Upload a PNG, JPG, WebP, or PDF file.');

    const result = isDemo ? analysisService.demoEvidence() : manualEvidence(form, file!);
    const objectKey = file ? `${current.incident.id}/${result.evidence.id}/${safeFileName(file.name)}` : null;
    const digest = file ? await sha256(file) : null;
    if (file && objectKey && digest) await putEvidenceObject(objectKey, file, digest);
    await saveEvidenceObject({
      id: result.evidence.id,
      incidentId: current.incident.id,
      objectKey,
      fileName: result.evidence.name,
      contentType: file?.type || 'application/x-cfr-demo',
      byteSize: file?.size || 0,
      sha256: digest,
      extracted: result.detected,
    });

    const changed = structuredClone(current);
    changed.detected = { ...changed.detected, ...result.detected };
    changed.incident.evidence = [...changed.incident.evidence, result.evidence];
    changed.incident.entities = {
      ...changed.incident.entities,
      upiIds: appendUnique(changed.incident.entities.upiIds, result.detected.upiId),
      transactionIds: appendUnique(changed.incident.entities.transactionIds, result.detected.transactionId),
      phoneNumbers: appendUnique(changed.incident.entities.phoneNumbers, result.detected.phoneNumber),
    };
    const snapshot = await saveSnapshot(session.id, changed, current.revision);
    return withSessionCookie(json({ snapshot }, 201), request, session);
  } catch (error) {
    return withSessionCookie(errorResponse(error), request, session);
  }
}

function manualEvidence(form: FormData, file: File) {
  const detected = {
    amount: text(form.get('amount'), 40, 'Amount'),
    transactionId: text(form.get('transactionId'), 120, 'Transaction ID'),
    date: text(form.get('date'), 80, 'Transaction date'),
    time: text(form.get('time'), 80, 'Transaction time'),
    ...(optional(form, 'upiId') && { upiId: optional(form, 'upiId') }),
    ...(optional(form, 'recipient') && { recipient: optional(form, 'recipient') }),
    paymentStatus: optional(form, 'paymentStatus') || 'Reported by complainant',
    ...(optional(form, 'phoneNumber') && { phoneNumber: optional(form, 'phoneNumber') }),
  };
  return { evidence: { id: crypto.randomUUID(), name: file.name, type: file.type === 'application/pdf' ? 'Evidence document' : 'Evidence image', status: 'manual' as const, extracted: detected }, detected };
}

function optional(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}
function appendUnique(values: string[], value?: string) { return value && !values.includes(value) ? [...values, value] : values; }
function safeFileName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'evidence'; }
async function sha256(file: File) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
