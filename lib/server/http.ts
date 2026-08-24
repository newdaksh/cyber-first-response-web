import type { IncidentSnapshot } from '../incident';
import { StoreError } from './store';

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof StoreError) {
    return json({ error: error.message, snapshot: error.snapshot }, error.status);
  }
  console.error('Unhandled case API error', error);
  return json({ error: 'The case service could not complete this request. Please retry.' }, 500);
}

export function requireRevision(value: unknown, current: IncidentSnapshot) {
  if (!Number.isInteger(value) || value !== current.revision) {
    throw new StoreError(409, 'This case changed in another request. The latest saved version has been restored.', current);
  }
}

export function text(value: unknown, maximum: number, field: string) {
  if (typeof value !== 'string') throw new StoreError(400, `${field} is required.`);
  const normalized = value.trim();
  if (!normalized) throw new StoreError(400, `${field} is required.`);
  if (normalized.length > maximum) throw new StoreError(400, `${field} is too long.`);
  return normalized;
}
