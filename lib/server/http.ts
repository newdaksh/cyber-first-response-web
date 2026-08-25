import type { IncidentSnapshot } from '../incident';
import { StoreError } from '../errors';

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof StoreError) {
    return json({ error: error.message, snapshot: error.snapshot }, error.status);
  }
  const reference = crypto.randomUUID();
  console.error('Unhandled case API error', {
    reference,
    name: error instanceof Error ? error.name : typeof error,
  });
  return json(
    { error: 'The case service could not complete this request. Please retry.', reference },
    500,
  );
}

export function requireRevision(value: unknown, current: IncidentSnapshot) {
  if (!Number.isInteger(value) || value !== current.revision) {
    throw new StoreError(
      409,
      'This case changed in another request. The latest saved version has been restored.',
      current,
    );
  }
}
