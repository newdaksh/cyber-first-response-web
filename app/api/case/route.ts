import type { CaseCommand } from '../../../lib/server/workflow';
import { applyCaseCommand } from '../../../lib/server/workflow';
import { errorResponse, json, requireRevision } from '../../../lib/server/http';
import { assertSameOrigin, createCurrentSnapshot, getSession, loadCurrentSnapshot, saveSnapshot, withSessionCookie } from '../../../lib/server/store';

export async function GET(request: Request) {
  const session = getSession(request);
  try {
    const snapshot = await loadCurrentSnapshot(session.id);
    return withSessionCookie(json({ snapshot }), request, session);
  } catch (error) {
    return withSessionCookie(errorResponse(error), request, session);
  }
}

export async function POST(request: Request) {
  const session = getSession(request);
  try {
    assertSameOrigin(request);
    const body = await request.json() as CaseCommand | { action: 'reset' };
    if (body.action === 'reset') {
      const snapshot = await createCurrentSnapshot(session.id);
      return withSessionCookie(json({ snapshot }, 201), request, session);
    }
    let current = await loadCurrentSnapshot(session.id);
    if (!current) current = await createCurrentSnapshot(session.id);
    requireRevision(body.revision, current);
    const changed = await applyCaseCommand(current, body);
    const snapshot = await saveSnapshot(session.id, changed, current.revision);
    return withSessionCookie(json({ snapshot }), request, session);
  } catch (error) {
    return withSessionCookie(errorResponse(error), request, session);
  }
}
