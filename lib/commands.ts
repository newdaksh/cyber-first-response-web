import { StoreError } from './errors.ts';
import type { CaseCommand } from './workflow.ts';

export type CaseRequest = CaseCommand | { action: 'reset' };

const MAX_COMMAND_BYTES = 40 * 1024;

export async function readCaseRequest(request: Request): Promise<CaseRequest> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new StoreError(415, 'Send case commands as application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_COMMAND_BYTES) {
    throw new StoreError(413, 'The case command is too large.');
  }

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_COMMAND_BYTES) {
    throw new StoreError(413, 'The case command is too large.');
  }

  let value: unknown;
  try {
    value = JSON.parse(bodyText);
  } catch {
    throw new StoreError(400, 'The case command is not valid JSON.');
  }
  return parseCaseRequest(value);
}

export function parseCaseRequest(value: unknown): CaseRequest {
  if (!isRecord(value) || typeof value.action !== 'string') {
    throw new StoreError(400, 'A valid case action is required.');
  }
  if (value.action === 'reset') return { action: 'reset' };

  const revision = integer(value.revision, 'Revision');
  switch (value.action) {
    case 'begin':
    case 'loadDemo':
    case 'back':
    case 'timeline':
    case 'complaint':
    case 'handoff':
      return { action: value.action, revision };
    case 'analyze':
      return {
        action: value.action,
        revision,
        description: stringValue(value.description, 'Incident description'),
      };
    case 'clarify':
      return {
        action: value.action,
        revision,
        service: stringValue(value.service, 'Affected service or platform'),
        time: stringValue(value.time, 'Incident time'),
        portalCategory: optionalStringValue(value.portalCategory),
        portalSubCategory: optionalStringValue(value.portalSubCategory),
        occurrencePlatform: optionalStringValue(value.occurrencePlatform),
        financialLoss: optionalStringValue(value.financialLoss),
      };
    case 'toggleAction':
      return {
        action: value.action,
        revision,
        actionId: stringValue(value.actionId, 'Response action'),
      };
    case 'advance':
      if (value.to !== 'EVIDENCE_COLLECTION' && value.to !== 'CASE_READY') {
        throw new StoreError(400, 'The requested workflow stage is invalid.');
      }
      return { action: value.action, revision, to: value.to };
    case 'editComplaint':
    case 'review':
      return { action: value.action, revision, draft: stringValue(value.draft, 'Complaint draft') };
    default:
      throw new StoreError(400, 'Unknown case action.');
  }
}

function integer(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new StoreError(400, `${field} must be a non-negative integer.`);
  }
  return Number(value);
}

function stringValue(value: unknown, field: string) {
  if (typeof value !== 'string') throw new StoreError(400, `${field} must be text.`);
  return value;
}

function optionalStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
