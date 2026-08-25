import { analysisService } from '../../../../lib/services';
import {
  ALLOWED_EVIDENCE_TYPES,
  evidenceFieldKeys,
  hasValidEvidenceSignature,
  MAX_EVIDENCE_FILE_BYTES,
  normalizeEvidenceField,
  safeEvidenceFileName,
} from '../../../../lib/evidence';
import { StoreError } from '../../../../lib/errors';
import { errorResponse, json, requireRevision } from '../../../../lib/server/http';
import {
  assertSameOrigin,
  deleteEvidenceObject,
  getSession,
  loadCurrentSnapshot,
  putEvidenceObject,
  saveSnapshotWithEvidence,
  withSessionCookie,
} from '../../../../lib/server/store';

export async function POST(request: Request) {
  const session = getSession(request);
  try {
    assertSameOrigin(request);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
      throw new StoreError(415, 'Send evidence as multipart/form-data.');
    }
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_EVIDENCE_FILE_BYTES + 64 * 1024) {
      throw new StoreError(413, 'The evidence request is too large.');
    }
    const form = await request.formData();
    const current = await loadCurrentSnapshot(session.id);
    if (!current) throw new StoreError(404, 'Start a case before adding evidence.');
    requireRevision(Number(form.get('revision')), current);
    if (current.incident.status !== 'EVIDENCE_COLLECTION')
      throw new StoreError(409, 'Evidence can only be added during evidence collection.');

    const isDemo = form.get('demo') === 'true';
    const fileValue = form.get('file');
    const file = !isDemo && fileValue instanceof File && fileValue.size ? fileValue : null;
    if (!isDemo && !file) throw new StoreError(400, 'Choose an evidence file to upload.');
    if (file && file.size > MAX_EVIDENCE_FILE_BYTES)
      throw new StoreError(413, 'Evidence files must be 10 MB or smaller.');
    if (file && !ALLOWED_EVIDENCE_TYPES.has(file.type))
      throw new StoreError(415, 'Upload a PNG, JPG, WebP, or PDF file.');

    const storedFileName = file ? safeEvidenceFileName(file.name) : null;
    const contents = file ? await file.arrayBuffer() : null;
    if (file && contents && !hasValidEvidenceSignature(file.type, new Uint8Array(contents))) {
      throw new StoreError(
        415,
        'The file contents do not match the selected PNG, JPG, WebP, or PDF type.',
      );
    }
    const result = isDemo
      ? analysisService.demoEvidence()
      : manualEvidence(form, file!, storedFileName!);
    const objectKey = file
      ? `${current.incident.id}/${result.evidence.id}/${storedFileName}`
      : null;
    const digest = contents ? await sha256(contents) : null;
    if (file && contents && objectKey && digest)
      await putEvidenceObject(objectKey, contents, file.type, digest);

    const record = {
      id: result.evidence.id,
      incidentId: current.incident.id,
      objectKey,
      fileName: result.evidence.name,
      contentType: file?.type || 'application/x-cfr-demo',
      byteSize: file?.size || 0,
      sha256: digest,
      extracted: result.detected,
    };

    const changed = structuredClone(current);
    changed.detected = { ...changed.detected, ...result.detected };
    changed.incident.evidence = [...changed.incident.evidence, result.evidence];
    changed.incident.entities = {
      ...changed.incident.entities,
      upiIds: appendUnique(changed.incident.entities.upiIds, result.detected.recipient),
      transactionIds: appendUnique(
        changed.incident.entities.transactionIds,
        result.detected.transactionId,
      ),
      phoneNumbers: appendUnique(changed.incident.entities.phoneNumbers, result.detected.contact),
      urls: appendUnique(changed.incident.entities.urls, result.detected.url),
      emails: appendUnique(changed.incident.entities.emails, result.detected.email),
    };
    let snapshot;
    try {
      snapshot = await saveSnapshotWithEvidence(session.id, changed, current.revision, record);
    } catch (error) {
      if (objectKey) {
        try {
          await deleteEvidenceObject(objectKey);
        } catch {
          console.warn('An unsuccessful evidence upload left a blob for scheduled cleanup.');
        }
      }
      throw error;
    }
    return withSessionCookie(json({ snapshot }, 201), request, session);
  } catch (error) {
    return withSessionCookie(errorResponse(error), request, session);
  }
}

function manualEvidence(form: FormData, file: File, storedFileName: string) {
  const detected = Object.fromEntries(
    evidenceFieldKeys
      .map((key) => [key, optional(form, key)])
      .filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;
  detected.screenshot = `Supporting file: ${storedFileName}`;
  return {
    evidence: {
      id: crypto.randomUUID(),
      name: storedFileName,
      type: file.type === 'application/pdf' ? 'Evidence document' : 'Evidence image',
      status: 'manual' as const,
      extracted: detected,
    },
    detected,
  };
}

function optional(form: FormData, key: string) {
  const value = form.get(key);
  return normalizeEvidenceField(value);
}
function appendUnique(values: string[], value?: string) {
  return value && !values.includes(value) ? [...values, value] : values;
}
async function sha256(contents: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', contents);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
