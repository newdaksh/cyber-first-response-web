import type { ActionItem, ClassificationResult, Evidence, Incident, TimelineEvent } from './incident.ts';
import { demoDescription } from './presentation.ts';

export { calculateEvidenceCompleteness, demoDescription, officialReportingUrl } from './presentation.ts';

export interface IncidentExtraction {
  language: Incident['language']; amount?: number; otpInvolved?: boolean; bank?: string;
  paymentMethod?: string; incidentDate?: string; incidentTime?: string; entities: Incident['entities'];
}
export interface EvidenceExtraction { evidence: Evidence; detected: Record<string, string>; }

const classifications = [
  { incidentType: 'digital_arrest', severity: 'critical', confidence: 0.9, terms: /digital arrest|arrest|police|cbi|customs|court|narcotics|money laundering/i, rationale: 'The report includes coercion or threats by someone claiming to represent an authority.', playbook: 'Coercion and digital-arrest scam response' },
  { incidentType: 'account_takeover', severity: 'high', confidence: 0.86, terms: /hacked|taken over|locked out|password changed|account access|unauthori[sz]ed login/i, rationale: 'The report describes loss of access or unauthorized control of an online account.', playbook: 'Account takeover containment' },
  { incidentType: 'investment_scam', severity: 'high', confidence: 0.87, terms: /investment|guaranteed return|profit|trading group|crypto scheme|double (?:the )?money/i, rationale: 'The report describes a payment linked to promised investment or trading returns.', playbook: 'Investment scam response' },
  { incidentType: 'phishing', severity: 'medium', confidence: 0.84, terms: /phishing|suspicious link|login link|clicked.*link|entered.*password|delivery message/i, rationale: 'The report includes a suspicious link or credential-entry flow.', playbook: 'Phishing and account protection' },
  { incidentType: 'upi_payment_fraud', severity: 'high', confidence: 0.88, terms: /upi|qr code|collect request|gpay|phonepe|paytm/i, rationale: 'The report describes an unexpected UPI payment, QR code, or collect request.', playbook: 'UPI and payment fraud response' },
  { incidentType: 'bank_otp_fraud', severity: 'high', confidence: 0.92, terms: /otp|kyc|bank caller|bank se call|card details|cvv/i, rationale: 'The description mentions a bank or KYC pretext, an OTP, or an unauthorized financial loss.', playbook: 'Financial fraud — bank impersonation and OTP response' },
] as const;

export class IncidentAnalysisService {
  async classifyIncident(description: string): Promise<ClassificationResult> {
    const match = classifications.find((candidate) => candidate.terms.test(description));
    if (match) return { incidentType: match.incidentType, confidence: match.confidence, severity: match.severity, rationale: match.rationale, playbook: match.playbook };
    return { incidentType: 'other', confidence: 0.62, severity: 'medium', rationale: 'The information suggests a possible cyber-enabled incident, but more details are needed.', playbook: 'General cybercrime first response' };
  }

  async extractIncident(description: string): Promise<IncidentExtraction> {
    const normalized = description.replaceAll(',', '');
    const compactAmount = normalized.match(/(?:₹|rs\.?|inr|rupees?)\s*(\d+(?:\.\d+)?)/i);
    const scaledAmount = normalized.match(/(\d+(?:\.\d+)?)\s*(hazaar|thousand|lakh)/i);
    const multiplier = scaledAmount?.[2].toLowerCase() === 'lakh' ? 100000 : 1000;
    const amount = compactAmount ? Number(compactAmount[1]) : scaledAmount ? Number(scaledAmount[1]) * multiplier : undefined;
    const phoneNumbers = description.match(/(?:\+91[ -]?)?[6-9]\d{9}/g) ?? [];
    const urls = description.match(/https?:\/\/[^\s]+|\b[a-z0-9-]+\.(?:com|in|net|org)(?:\/[^\s]*)?/gi) ?? [];
    const emails: string[] = Array.from(description.match(/[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []);
    const upiIds = description.match(/[a-z0-9._-]{2,}@[a-z]{2,}/gi)?.filter((value) => !emails.includes(value)) ?? [];
    const transactionIds = description.match(/\b(?:TXN|UTR|UPI|DEMO)[A-Z0-9-]{6,}\b/gi) ?? [];
    return {
      language: /mujhe|aaya|liya|gaya|kat|mera|mere|paise/i.test(description) ? 'hinglish' : 'en',
      amount,
      otpInvolved: /otp|one[- ]time password/i.test(description),
      bank: description.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+Bank\b/)?.[0],
      paymentMethod: /upi|gpay|phonepe|paytm|qr code/i.test(description) ? 'UPI' : 'Bank transfer',
      incidentDate: description.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i)?.[0],
      incidentTime: description.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0],
      entities: { phoneNumbers, upiIds, bankAccounts: [], urls, emails, transactionIds },
    };
  }

  async detectMissingFields(incident: Incident) {
    return [!incident.bank && 'bank', !incident.incidentDate && 'incidentDate', !incident.incidentTime && 'incidentTime', incident.entities.transactionIds.length === 0 && 'transactionId'].filter(Boolean) as string[];
  }

  async generateActionPlan(incident?: Incident): Promise<ActionItem[]> {
    const financial = incident?.incidentType === 'bank_otp_fraud' || incident?.incidentType === 'upi_payment_fraud' || incident?.incidentType === 'investment_scam';
    const firstAction: ActionItem = financial
      ? { id: 'call-1930', title: 'Call 1930', detail: 'Report the suspected financial fraud through India’s official cybercrime helpline. Keep the transaction details ready.', priority: 'now', completed: false }
      : { id: 'secure-access', title: 'Secure the affected account', detail: 'Use the official app or website from a trusted device, change the password, and sign out unknown sessions.', priority: 'now', completed: false };
    return [
      firstAction,
      { id: 'contact-provider', title: financial ? 'Contact your bank or payment provider' : 'Contact the affected service', detail: 'Use contact details from the official app or website—not a number or link sent by the suspected attacker.', priority: 'now', completed: false },
      { id: 'review-activity', title: 'Review and contain unauthorized activity', detail: 'Check recent activity, revoke unknown access, and ask the provider about protective controls.', priority: 'next', completed: false },
      { id: 'preserve', title: 'Preserve every piece of evidence', detail: 'Keep messages, call logs, screenshots, receipts, and transaction alerts unchanged.', priority: 'next', completed: false },
      { id: 'no-more-money', title: 'Do not send more money or share secrets', detail: 'Never share an OTP, PIN, password, or pay someone promising recovery.', priority: 'protect', completed: false },
    ];
  }

  demoEvidence(fileName = 'demo-payment-receipt.png'): EvidenceExtraction {
    const detected = { amount: '₹25,000', transactionId: 'DEMO2508231051', date: '23 Aug 2026', time: '10:52 AM', upiId: 'demo.receiver@upi', recipient: 'Demo Recipient', paymentStatus: 'Successful', merchantId: 'DEMO-MERCHANT-51', phoneNumber: '+91 XXXXX 1042' };
    return { evidence: { id: crypto.randomUUID(), name: fileName, type: 'Transaction screenshot', status: 'ready', extracted: detected }, detected };
  }

  async generateTimeline(incident: Incident, detected: Record<string, string> = {}): Promise<TimelineEvent[]> {
    if (incident.description === demoDescription) {
      return [
        { id: crypto.randomUUID(), timestamp: '10:32 AM', title: 'Initial contact', detail: 'Caller contacted the complainant and claimed to represent their bank.', source: 'narrative' },
        { id: crypto.randomUUID(), timestamp: '10:41 AM', title: 'KYC pretext', detail: 'Caller said KYC verification was urgently required.', source: 'narrative' },
        { id: crypto.randomUUID(), timestamp: '10:47 AM', title: 'OTP shared', detail: 'The complainant reported sharing a one-time password.', source: 'user' },
        { id: crypto.randomUUID(), timestamp: '10:51 AM', title: 'Transaction initiated', detail: 'A ₹25,000 transaction was initiated.', source: 'evidence' },
        { id: crypto.randomUUID(), timestamp: '10:52 AM', title: 'Payment marked successful', detail: 'Receipt shows transaction DEMO2508231051 to demo.receiver@upi.', source: 'evidence' },
        { id: crypto.randomUUID(), timestamp: '10:55 AM', title: 'Additional payment requested', detail: 'Caller reportedly asked for another payment.', source: 'narrative' },
        { id: crypto.randomUUID(), timestamp: '11:02 AM', title: 'Fraud suspected', detail: 'The complainant realized the caller may not have represented the bank.', source: 'user' },
      ];
    }
    const transactionTime = detected.time || incident.incidentTime || 'Time not recorded';
    const amount = detected.amount || formatAmount(incident.amount);
    const timeline: TimelineEvent[] = [
      { id: crypto.randomUUID(), timestamp: transactionTime, title: 'Initial contact or activity', detail: incident.description, source: 'narrative' },
      ...(amount || detected.transactionId ? [{ id: crypto.randomUUID(), timestamp: transactionTime, title: 'Transaction evidence recorded', detail: `${amount ? `Amount ${amount}. ` : ''}${detected.transactionId ? `Transaction reference ${detected.transactionId}.` : ''}`.trim(), source: 'evidence' as const }] : []),
      { id: crypto.randomUUID(), timestamp: transactionTime, title: 'Fraud suspected', detail: 'The complainant identified the activity as potentially fraudulent and began preserving evidence.', source: 'user' },
    ];
    return timeline.sort((a, b) => parseClock(a.timestamp) - parseClock(b.timestamp));
  }

  async generateComplaint(incident: Incident, detected: Record<string, string> = {}) {
    const type = incident.incidentType?.replaceAll('_', ' ') ?? 'cyber-enabled incident';
    const amount = detected.amount || formatAmount(incident.amount) || 'Not yet confirmed';
    const date = detected.date || incident.incidentDate || 'Not yet confirmed';
    const time = detected.time || incident.incidentTime || 'Not yet confirmed';
    const transactionId = detected.transactionId || incident.entities.transactionIds[0] || 'Not yet confirmed';
    const upi = detected.upiId || incident.entities.upiIds[0] || 'Not applicable / not yet confirmed';
    return `Subject: Report of suspected ${type}\n\nI wish to report a suspected cyber-enabled incident. My account of what happened is:\n\n${incident.description}\n\nTransaction and incident details\n• Amount: ${amount}\n• Date: ${date}\n• Time: ${time}\n• Bank or provider: ${incident.bank || 'Not yet confirmed'}\n• Transaction ID: ${transactionId}\n• Recipient UPI ID: ${upi}\n\nEvidence available\n${incident.evidence.length ? incident.evidence.map((item) => `• ${item.name} (${item.type})`).join('\n') : '• No file attached yet'}\n\nActions already taken\n${incident.actionPlan.filter((item) => item.completed).map((item) => `• ${item.title}`).join('\n') || '• No actions marked complete yet'}\n\nI request that this information be reviewed through the appropriate official reporting and investigation process. I understand that this draft has not been submitted automatically and must be verified before official use.`;
  }
}

export const analysisService = new IncidentAnalysisService();
export const aiProvider = analysisService;
export const demoScenarios = [
  { id: 'bank-otp', label: 'Bank impersonation / OTP fraud', description: demoDescription, expectedType: 'bank_otp_fraud' },
  { id: 'upi', label: 'UPI fraud', description: 'A fake seller sent me a UPI collect request and ₹8,000 was debited.', expectedType: 'upi_payment_fraud' },
  { id: 'investment', label: 'Investment scam', description: 'I paid ₹40,000 after being promised guaranteed investment returns.', expectedType: 'investment_scam' },
  { id: 'phishing', label: 'Phishing', description: 'I opened a login link from a delivery message and entered my email.', expectedType: 'phishing' },
  { id: 'takeover', label: 'Account takeover', description: 'My social account was hacked and I am locked out.', expectedType: 'account_takeover' },
  { id: 'digital-arrest', label: 'Digital arrest', description: 'Someone claiming to be police threatened digital arrest and demanded payment.', expectedType: 'digital_arrest' },
] as const;

export function parseClock(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}
export function validateClassification(value: ClassificationResult) {
  return Boolean(value.incidentType && value.confidence >= 0 && value.confidence <= 1 && value.severity && value.rationale);
}
function formatAmount(amount?: number) {
  return amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : '';
}
