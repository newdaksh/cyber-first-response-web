import { env } from 'cloudflare:workers';
import { schemaStatements } from '../../db/schema';
import { StoreError } from '../errors';
import { createFreshIncident, type IncidentSnapshot } from '../incident';

const SESSION_COOKIE = 'cfr_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

interface IncidentRow {
  payload: string;
  revision: number;
}

export interface EvidenceObjectRecord {
  id: string;
  incidentId: string;
  objectKey: string | null;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string | null;
  extracted: Record<string, string>;
}

let schemaPromise: Promise<void> | undefined;

async function ensureSchema() {
  schemaPromise ??= (async () => {
    await env.DB.batch(schemaStatements.map((statement) => env.DB.prepare(statement)));
    await env.DB.prepare('PRAGMA optimize').run();
  })();
  return schemaPromise;
}

function parseCookies(header: string | null) {
  const values = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    try {
      values.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
    } catch {
      // Ignore malformed cookie values and issue a fresh opaque session below.
    }
  }
  return values;
}

export function getSession(request: Request) {
  const existing = parseCookies(request.headers.get('cookie')).get(SESSION_COOKIE);
  const isValid = Boolean(existing && /^[a-f0-9-]{36}$/i.test(existing));
  return { id: isValid ? existing! : crypto.randomUUID(), isNew: !isValid };
}

export function withSessionCookie(
  response: Response,
  request: Request,
  session: { id: string; isNew: boolean },
) {
  if (session.isNew) {
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    response.headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=${encodeURIComponent(session.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`,
    );
  }
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (
    origin !== new URL(request.url).origin ||
    (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')
  ) {
    throw new StoreError(403, 'Cross-origin mutation rejected.');
  }
}

export async function loadCurrentSnapshot(sessionId: string): Promise<IncidentSnapshot | null> {
  await ensureSchema();
  const row = await env.DB.prepare(
    `
    SELECT i.payload, i.revision
    FROM sessions s
    JOIN incidents i ON i.id = s.current_incident_id
    WHERE s.id = ? AND i.session_id = ?
  `,
  )
    .bind(sessionId, sessionId)
    .first<IncidentRow>();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload) as Omit<IncidentSnapshot, 'revision'>;
    if (
      !parsed?.incident ||
      typeof parsed.incident.id !== 'string' ||
      !Array.isArray(parsed.incident.evidence)
    ) {
      throw new Error('Invalid snapshot shape');
    }
    return { ...parsed, revision: row.revision };
  } catch {
    throw new StoreError(
      500,
      'The saved case could not be restored. Start a fresh case to continue.',
    );
  }
}

export async function createCurrentSnapshot(sessionId: string): Promise<IncidentSnapshot> {
  await ensureSchema();
  const previous = await env.DB.prepare(
    `
    SELECT i.id
    FROM sessions s
    JOIN incidents i ON i.id = s.current_incident_id
    WHERE s.id = ? AND i.session_id = ?
  `,
  )
    .bind(sessionId, sessionId)
    .first<{ id: string }>();
  const previousObjects = previous
    ? await env.DB.prepare(
        'SELECT object_key FROM evidence_objects WHERE incident_id = ? AND object_key IS NOT NULL',
      )
        .bind(previous.id)
        .all<{ object_key: string }>()
    : null;
  const now = new Date().toISOString();
  const snapshot: IncidentSnapshot = {
    incident: createFreshIncident(),
    classification: null,
    missing: [],
    detected: {},
    revision: 0,
  };
  const payload = JSON.stringify(withoutRevision(snapshot));
  const statements = [
    env.DB.prepare(
      `
      INSERT INTO incidents (id, session_id, status, payload, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `,
    ).bind(snapshot.incident.id, sessionId, snapshot.incident.status, payload, now, now),
    env.DB.prepare(
      `
      INSERT INTO sessions (id, current_incident_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET current_incident_id = excluded.current_incident_id, updated_at = excluded.updated_at
    `,
    ).bind(sessionId, snapshot.incident.id, now, now),
  ];
  if (previous) {
    statements.push(
      env.DB.prepare('DELETE FROM evidence_objects WHERE incident_id = ?').bind(previous.id),
      env.DB.prepare('DELETE FROM incidents WHERE id = ? AND session_id = ?').bind(
        previous.id,
        sessionId,
      ),
    );
  }
  await env.DB.batch(statements);
  const objectKeys = previousObjects?.results.map((row) => row.object_key).filter(Boolean) ?? [];
  if (objectKeys.length) {
    try {
      await env.EVIDENCE.delete(objectKeys);
    } catch {
      console.warn('A replaced case was removed, but its evidence blob cleanup must be retried.');
    }
  }
  return snapshot;
}

export async function saveSnapshot(
  sessionId: string,
  snapshot: IncidentSnapshot,
  expectedRevision: number,
) {
  await ensureSchema();
  const next = { ...snapshot, revision: expectedRevision + 1 };
  const result = await env.DB.prepare(
    `
    UPDATE incidents
    SET status = ?, payload = ?, revision = revision + 1, updated_at = ?
    WHERE id = ? AND session_id = ? AND revision = ?
  `,
  )
    .bind(
      next.incident.status,
      JSON.stringify(withoutRevision(next)),
      new Date().toISOString(),
      next.incident.id,
      sessionId,
      expectedRevision,
    )
    .run();
  if (result.meta.changes !== 1) {
    const current = await loadCurrentSnapshot(sessionId);
    throw new StoreError(
      409,
      'This case changed in another request. The latest saved version has been restored.',
      current,
    );
  }
  return next;
}

export async function saveSnapshotWithEvidence(
  sessionId: string,
  snapshot: IncidentSnapshot,
  expectedRevision: number,
  record: EvidenceObjectRecord,
) {
  await ensureSchema();
  const next = { ...snapshot, revision: expectedRevision + 1 };
  const writeToken = `${new Date().toISOString()}:${crypto.randomUUID()}`;
  const results = await env.DB.batch([
    env.DB.prepare(
      `
      UPDATE incidents
      SET status = ?, payload = ?, revision = revision + 1, updated_at = ?
      WHERE id = ? AND session_id = ? AND revision = ?
    `,
    ).bind(
      next.incident.status,
      JSON.stringify(withoutRevision(next)),
      writeToken,
      next.incident.id,
      sessionId,
      expectedRevision,
    ),
    env.DB.prepare(
      `
      INSERT INTO evidence_objects
        (id, incident_id, object_key, file_name, content_type, byte_size, sha256, extracted_json, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM incidents WHERE id = ? AND session_id = ? AND updated_at = ?
      )
    `,
    ).bind(
      record.id,
      record.incidentId,
      record.objectKey,
      record.fileName,
      record.contentType,
      record.byteSize,
      record.sha256,
      JSON.stringify(record.extracted),
      new Date().toISOString(),
      next.incident.id,
      sessionId,
      writeToken,
    ),
  ]);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
    const current = await loadCurrentSnapshot(sessionId);
    throw new StoreError(
      409,
      'This case changed in another request. The latest saved version has been restored.',
      current,
    );
  }
  return next;
}

export async function putEvidenceObject(
  objectKey: string,
  contents: ArrayBuffer,
  contentType: string,
  sha256: string,
) {
  await env.EVIDENCE.put(objectKey, contents, {
    httpMetadata: { contentType },
    customMetadata: { sha256 },
  });
}

export async function deleteEvidenceObject(objectKey: string) {
  await env.EVIDENCE.delete(objectKey);
}

function withoutRevision(snapshot: IncidentSnapshot): Omit<IncidentSnapshot, 'revision'> {
  return {
    incident: snapshot.incident,
    classification: snapshot.classification,
    missing: snapshot.missing,
    detected: snapshot.detected,
  };
}

export { StoreError } from '../errors';
