import { env } from 'cloudflare:workers';
import { schemaStatements } from '../../db/schema';
import { createFreshIncident, type IncidentSnapshot } from '../incident';

const SESSION_COOKIE = 'cfr_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

interface IncidentRow {
  payload: string;
  revision: number;
}

interface EvidenceObjectRecord {
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
    if (index > 0) values.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return values;
}

export function getSession(request: Request) {
  const existing = parseCookies(request.headers.get('cookie')).get(SESSION_COOKIE);
  return { id: existing && /^[a-f0-9-]{36}$/i.test(existing) ? existing : crypto.randomUUID(), isNew: !existing };
}

export function withSessionCookie(response: Response, request: Request, session: { id: string; isNew: boolean }) {
  if (session.isNew) {
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(session.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`);
  }
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new StoreError(403, 'Cross-origin mutation rejected.');
}

export async function loadCurrentSnapshot(sessionId: string): Promise<IncidentSnapshot | null> {
  await ensureSchema();
  const row = await env.DB.prepare(`
    SELECT i.payload, i.revision
    FROM sessions s
    JOIN incidents i ON i.id = s.current_incident_id
    WHERE s.id = ? AND i.session_id = ?
  `).bind(sessionId, sessionId).first<IncidentRow>();
  if (!row) return null;
  return { ...(JSON.parse(row.payload) as Omit<IncidentSnapshot, 'revision'>), revision: row.revision };
}

export async function createCurrentSnapshot(sessionId: string): Promise<IncidentSnapshot> {
  await ensureSchema();
  const now = new Date().toISOString();
  const snapshot: IncidentSnapshot = {
    incident: createFreshIncident(),
    classification: null,
    missing: [],
    detected: {},
    revision: 0,
  };
  const payload = JSON.stringify(withoutRevision(snapshot));
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO incidents (id, session_id, status, payload, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).bind(snapshot.incident.id, sessionId, snapshot.incident.status, payload, now, now),
    env.DB.prepare(`
      INSERT INTO sessions (id, current_incident_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET current_incident_id = excluded.current_incident_id, updated_at = excluded.updated_at
    `).bind(sessionId, snapshot.incident.id, now, now),
  ]);
  return snapshot;
}

export async function saveSnapshot(sessionId: string, snapshot: IncidentSnapshot, expectedRevision: number) {
  await ensureSchema();
  const next = { ...snapshot, revision: expectedRevision + 1 };
  const result = await env.DB.prepare(`
    UPDATE incidents
    SET status = ?, payload = ?, revision = revision + 1, updated_at = ?
    WHERE id = ? AND session_id = ? AND revision = ?
  `).bind(
    next.incident.status,
    JSON.stringify(withoutRevision(next)),
    new Date().toISOString(),
    next.incident.id,
    sessionId,
    expectedRevision,
  ).run();
  if (result.meta.changes !== 1) {
    const current = await loadCurrentSnapshot(sessionId);
    throw new StoreError(409, 'This case changed in another request. The latest saved version has been restored.', current);
  }
  return next;
}

export async function saveEvidenceObject(record: EvidenceObjectRecord) {
  await ensureSchema();
  await env.DB.prepare(`
    INSERT INTO evidence_objects
      (id, incident_id, object_key, file_name, content_type, byte_size, sha256, extracted_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.incidentId,
    record.objectKey,
    record.fileName,
    record.contentType,
    record.byteSize,
    record.sha256,
    JSON.stringify(record.extracted),
    new Date().toISOString(),
  ).run();
}

export async function putEvidenceObject(objectKey: string, file: File, sha256: string) {
  await env.EVIDENCE.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { sha256, originalName: file.name },
  });
}

function withoutRevision(snapshot: IncidentSnapshot): Omit<IncidentSnapshot, 'revision'> {
  return {
    incident: snapshot.incident,
    classification: snapshot.classification,
    missing: snapshot.missing,
    detected: snapshot.detected,
  };
}

export class StoreError extends Error {
  constructor(public status: number, message: string, public snapshot: IncidentSnapshot | null = null) {
    super(message);
  }
}
