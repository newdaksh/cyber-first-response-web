const numericSecretPattern =
  /\b(otp|one[- ]time password|pin|cvv|remote[- ]access code|recovery code)(\s*(?:(?:is|was)\s*)?(?:[:=\-]\s*)?)(\d{3,10})\b/gi;
const passwordPattern = /\b(password|passcode)(\s*(?:(?:is|was)\s+|[:=\-]\s*))([^\s,;]{4,128})/gi;

/** Removes authentication secrets while preserving enough context for triage. */
export function redactSensitiveText(value: string) {
  return value
    .replace(numericSecretPattern, '$1$2[REDACTED]')
    .replace(passwordPattern, '$1$2[REDACTED]');
}
