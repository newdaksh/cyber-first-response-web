import type { ActionItem, Evidence, Incident, TimelineEvent } from './incident.ts';

export interface ClassificationResult {
  incidentType: Incident['incidentType'];
  confidence: number;
  severity: NonNullable<Incident['severity']>;
  rationale: string;
  playbook: string;
}

export interface IncidentExtraction {
  language: Incident['language'];
  amount?: number;
  otpInvolved?: boolean;
  bank?: string;
  paymentMethod?: string;
  incidentDate?: string;
  incidentTime?: string;
  entities: Incident['entities'];
}

export interface EvidenceExtraction {
  evidence: Evidence;
  detected: Record<string, string>;
}

export interface AIProvider {
  classifyIncident(description: string): Promise<ClassificationResult>;
  extractIncident(description: string): Promise<IncidentExtraction>;
  detectMissingFields(incident: Incident): Promise<string[]>;
  generateActionPlan(incident: Incident): Promise<ActionItem[]>;
  extractEvidence(fileName: string): Promise<EvidenceExtraction>;
  generateTimeline(incident: Incident): Promise<TimelineEvent[]>;
  generateComplaint(incident: Incident): Promise<string>;
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class MockAIProvider implements AIProvider {
  async classifyIncident(description: string): Promise<ClassificationResult> {
    await wait(420);
    const normalized = description.toLowerCase();
    if (normalized.includes('otp') || normalized.includes('kyc') || normalized.includes('bank')) {
      return { incidentType: 'bank_otp_fraud', confidence: 0.91, severity: 'high', rationale: 'The description mentions a bank/KYC pretext, an OTP, and an unauthorized financial loss.', playbook: 'Financial fraud — bank impersonation and OTP response' };
    }
    if (normalized.includes('upi') || normalized.includes('qr code') || normalized.includes('collect request')) {
      return { incidentType: 'upi_payment_fraud', confidence: 0.87, severity: 'high', rationale: 'The report describes an unexpected UPI payment, QR code, or collect request.', playbook: 'UPI and payment fraud response' };
    }
    if (normalized.includes('investment') || normalized.includes('return')) {
      return { incidentType: 'investment_scam', confidence: 0.86, severity: 'high', rationale: 'The report describes a payment linked to promised investment returns.', playbook: 'Investment scam response' };
    }
    if (normalized.includes('arrest') || normalized.includes('police')) {
      return { incidentType: 'digital_arrest', confidence: 0.88, severity: 'critical', rationale: 'The description includes coercion by someone claiming to represent law enforcement.', playbook: 'Coercion and digital-arrest scam response' };
    }
    if (normalized.includes('link') || normalized.includes('login')) {
      return { incidentType: 'phishing', confidence: 0.83, severity: 'medium', rationale: 'The report includes a suspicious link or credential-entry flow.', playbook: 'Phishing and account protection' };
    }
    if (normalized.includes('hacked') || normalized.includes('taken over') || normalized.includes('locked out')) {
      return { incidentType: 'account_takeover', confidence: 0.84, severity: 'high', rationale: 'The report describes loss of access or unauthorized control of an online account.', playbook: 'Account takeover containment' };
    }
    return { incidentType: 'other', confidence: 0.62, severity: 'medium', rationale: 'The information suggests a possible cyber-enabled incident but more details are needed.', playbook: 'General cybercrime first response' };
  }

  async extractIncident(description: string): Promise<IncidentExtraction> {
    await wait(300);
    const amountMatch = description.replaceAll(',', '').match(/(?:₹|rs\.?|rupees?)\s*(\d+)/i) ?? description.replaceAll(',', '').match(/(\d+)\s*(?:hazaar|thousand)/i);
    const amount = description.toLowerCase().includes('25 hazaar') ? 25000 : amountMatch ? Number(amountMatch[1]) : undefined;
    const phoneNumbers = description.match(/(?:\+91[ -]?)?[6-9]\d{9}/g) ?? [];
    const urls = description.match(/https?:\/\/[^\s]+|\b[a-z0-9-]+\.(?:com|in|net|org)(?:\/[^\s]*)?/gi) ?? [];
    const emails = description.match(/[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
    const upiIds = description.match(/[a-z0-9._-]{2,}@[a-z]{2,}/gi)?.filter((value) => !emails.includes(value)) ?? [];
    const transactionIds = description.match(/\b(?:TXN|UTR|DEMO)[A-Z0-9-]{6,}\b/gi) ?? [];
    return {
      language: /mujhe|aaya|liya|gaya|kat/i.test(description) ? 'hinglish' : 'en',
      amount,
      otpInvolved: /otp/i.test(description),
      bank: /demo bank/i.test(description) ? 'Demo Bank' : undefined,
      paymentMethod: /upi/i.test(description) ? 'UPI' : 'Bank transfer',
      entities: { phoneNumbers, upiIds, bankAccounts: [], urls, emails, transactionIds },
    };
  }

  async detectMissingFields(incident: Incident): Promise<string[]> {
    return [!incident.bank && 'bank', !incident.incidentDate && 'incidentDate', !incident.incidentTime && 'incidentTime', incident.entities.transactionIds.length === 0 && 'transactionId'].filter(Boolean) as string[];
  }

  async generateActionPlan(): Promise<ActionItem[]> {
    return [
      { id: 'call-1930', title: 'Call 1930', detail: 'Report the suspected financial fraud through India’s official cybercrime helpline. Keep the transaction details ready.', priority: 'now', completed: false },
      { id: 'contact-bank', title: 'Contact your bank or payment provider', detail: 'Use the number on your bank’s official app, website, or card—not a number sent by the caller.', priority: 'now', completed: false },
      { id: 'secure-account', title: 'Secure the affected account', detail: 'Ask the bank about blocking the payment instrument and review recent transactions.', priority: 'next', completed: false },
      { id: 'preserve', title: 'Preserve every piece of evidence', detail: 'Keep messages, call logs, screenshots, receipts, and transaction alerts unchanged.', priority: 'next', completed: false },
      { id: 'no-more-money', title: 'Do not send more money or share another OTP', detail: 'Ignore anyone promising recovery for a fee or asking for credentials.', priority: 'protect', completed: false },
    ];
  }

  async extractEvidence(fileName: string): Promise<EvidenceExtraction> {
    await wait(650);
    const detected = {
      amount: '₹25,000', transactionId: 'DEMO2508231051', date: '23 Aug 2026', time: '10:52 AM', upiId: 'demo.receiver@upi', recipient: 'Demo Recipient', paymentStatus: 'Successful', merchantId: 'DEMO-MERCHANT-51', phoneNumber: '+91 XXXXX 1042',
    };
    return { evidence: { id: 'ev-transaction', name: fileName || 'demo-payment-receipt.png', type: 'Transaction screenshot', status: 'ready', extracted: detected }, detected };
  }

  async generateTimeline(): Promise<TimelineEvent[]> {
    await wait(500);
    return [
      { id: 'tl-1', timestamp: '10:32 AM', title: 'Initial contact', detail: 'Caller contacted the demo victim and claimed to represent their bank.', source: 'narrative' },
      { id: 'tl-2', timestamp: '10:41 AM', title: 'KYC pretext', detail: 'Caller said KYC verification was urgently required.', source: 'narrative' },
      { id: 'tl-3', timestamp: '10:47 AM', title: 'OTP shared', detail: 'Demo victim reported sharing a one-time password.', source: 'user' },
      { id: 'tl-4', timestamp: '10:51 AM', title: 'Transaction initiated', detail: 'A ₹25,000 transaction was initiated.', source: 'evidence' },
      { id: 'tl-5', timestamp: '10:52 AM', title: 'Payment marked successful', detail: 'Receipt shows transaction DEMO2508231051 to demo.receiver@upi.', source: 'evidence' },
      { id: 'tl-6', timestamp: '10:55 AM', title: 'Additional payment requested', detail: 'Caller reportedly asked for another payment.', source: 'narrative' },
      { id: 'tl-7', timestamp: '11:02 AM', title: 'Fraud suspected', detail: 'Demo victim realized the caller may not have represented the bank.', source: 'user' },
    ].sort((a, b) => parseClock(a.timestamp) - parseClock(b.timestamp));
  }

  async generateComplaint(incident: Incident): Promise<string> {
    await wait(500);
    const transactionId = incident.entities.transactionIds[0] ?? 'DEMO2508231051';
    const upi = incident.entities.upiIds[0] ?? 'demo.receiver@upi';
    return `Subject: Report of suspected bank impersonation and OTP-related financial fraud\n\nI, Demo User, wish to report a suspected cyber-enabled financial fraud. On 23 August 2026, I received a call from a person claiming to represent my bank for KYC verification. During the call, I was persuaded to share a one-time password. I later detected an unauthorized debit of ₹25,000.\n\nTransaction details\n• Amount: ₹25,000\n• Date and time: 23 August 2026, 10:52 AM\n• Transaction ID: ${transactionId}\n• Recipient UPI ID: ${upi}\n• Payment status shown: Successful\n\nChronology\nThe caller first contacted me at approximately 10:32 AM, raised an urgent KYC issue, and requested an OTP. The transaction was initiated at approximately 10:51 AM. I suspected fraud at approximately 11:02 AM.\n\nEvidence available\n• Transaction screenshot / payment receipt\n• Transaction identifier and timestamp\n• Recipient UPI identifier\n• Call details described by the complainant\n\nI request that the information be reviewed through the appropriate official reporting and investigation process. All identifiers in this prototype are fictional demo data.`;
  }
}

export class MockGovernmentService {
  getOfficialReportingUrl() { return 'https://cybercrime.gov.in/'; }
  async simulateHandoff() { await wait(350); return { status: 'simulated' as const, message: 'Complaint package prepared for external official reporting.' }; }
  async simulateCaseStatus() { return { status: 'Draft ready', simulated: true }; }
}

export class FallbackAIProvider implements AIProvider {
  private primary: AIProvider | undefined;
  private fallback: AIProvider;
  constructor(primary: AIProvider | undefined, fallback: AIProvider) { this.primary = primary; this.fallback = fallback; }
  private async run<T>(operation: (provider: AIProvider) => Promise<T>): Promise<T> {
    if (this.primary) { try { return await operation(this.primary); } catch { /* Reliable mock fallback is intentional. */ } }
    return operation(this.fallback);
  }
  classifyIncident(value: string) { return this.run((provider) => provider.classifyIncident(value)); }
  extractIncident(value: string) { return this.run((provider) => provider.extractIncident(value)); }
  detectMissingFields(value: Incident) { return this.run((provider) => provider.detectMissingFields(value)); }
  generateActionPlan(value: Incident) { return this.run((provider) => provider.generateActionPlan(value)); }
  extractEvidence(value: string) { return this.run((provider) => provider.extractEvidence(value)); }
  generateTimeline(value: Incident) { return this.run((provider) => provider.generateTimeline(value)); }
  generateComplaint(value: Incident) { return this.run((provider) => provider.generateComplaint(value)); }
}

export const aiProvider: AIProvider = new FallbackAIProvider(undefined, new MockAIProvider());
export const governmentService = new MockGovernmentService();

export const demoDescription = 'Mujhe bank se call aaya tha KYC ke liye... OTP liya aur 25 hazaar kat gaya.';

export const demoScenarios = [
  { id: 'bank-otp', label: 'Bank impersonation / OTP fraud', description: demoDescription, expectedType: 'bank_otp_fraud' },
  { id: 'upi', label: 'UPI fraud', description: 'A fake seller sent me a UPI collect request and ₹8,000 was debited.', expectedType: 'upi_payment_fraud' },
  { id: 'investment', label: 'Investment scam', description: 'I paid ₹40,000 after being promised guaranteed investment returns.', expectedType: 'investment_scam' },
  { id: 'phishing', label: 'Phishing', description: 'I opened a login link from a delivery message and entered my email.', expectedType: 'phishing' },
  { id: 'takeover', label: 'Account takeover', description: 'My social account was hacked and I am locked out.', expectedType: 'account_takeover' },
  { id: 'digital-arrest', label: 'Digital arrest', description: 'Someone claiming to be police threatened digital arrest and demanded payment.', expectedType: 'digital_arrest' },
] as const;

export function calculateEvidenceCompleteness(detected: Record<string, string>) {
  const required = ['amount', 'transactionId', 'date', 'time', 'upiId', 'recipient', 'paymentStatus', 'merchantId', 'phoneNumber', 'chatHistory', 'bankAccount'];
  const found = required.filter((field) => Boolean(detected[field])).length;
  return Math.round((found / required.length) * 100);
}

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
