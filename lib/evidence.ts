import { redactSensitiveText } from './security.ts';

export const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EVIDENCE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

export const evidenceFieldKeys = [
  'date',
  'time',
  'platform',
  'contact',
  'username',
  'url',
  'email',
  'amount',
  'financialInstitution',
  'walletProvider',
  'transactionId',
  'bankReference',
  'recipient',
  'suspectInstitution',
  'ifsc',
  'accountId',
  'device',
  'imei',
  'chatHistory',
  'policeReport',
] as const;

export function safeEvidenceFileName(name: string) {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(-160);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'evidence';
}

export function normalizeEvidenceField(value: unknown) {
  return typeof value === 'string' ? redactSensitiveText(value.trim()).slice(0, 200) : '';
}

export function hasValidEvidenceSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/png') {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === 'application/pdf') return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (contentType === 'image/webp') {
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes.length >= 12 &&
      startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
    );
  }
  return false;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}
