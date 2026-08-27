import type {
  ActionItem,
  ClassificationResult,
  Evidence,
  Incident,
  IncidentType,
  TimelineEvent,
} from './incident.ts';
import { getEvidenceRequirements, getIncidentGuide } from './guidance.ts';
import { demoDescription } from './presentation.ts';

export { demoDescription } from './presentation.ts';
export {
  getEvidenceRequirements,
  getIncidentGuide,
  incidentGuides,
  isFinancialIncident,
  officialLinks,
} from './guidance.ts';

export interface IncidentExtraction {
  language: Incident['language'];
  amount?: number;
  otpInvolved?: boolean;
  bank?: string;
  affectedService?: string;
  paymentMethod?: string;
  incidentDate?: string;
  incidentTime?: string;
  entities: Incident['entities'];
}
export interface EvidenceExtraction {
  evidence: Evidence;
  detected: Record<string, string>;
}

const classifications: Array<{
  incidentType: IncidentType;
  severity: ClassificationResult['severity'];
  confidence: number;
  terms: RegExp;
  rationale: string;
}> = [
  {
    incidentType: 'child_safety_or_grooming',
    severity: 'critical',
    confidence: 0.94,
    terms:
      /child (?:sexual|abuse|porn|exploit|groom)|minor.*(?:sexual|nude|exploit)|grooming|csam|cseam/i,
    rationale:
      'The report may involve a child’s safety or sexual exploitation, which needs urgent protective reporting.',
  },
  {
    incidentType: 'sextortion_or_intimate_content',
    severity: 'critical',
    confidence: 0.93,
    terms:
      /sextort|nude (?:photo|video|pic)|intimate (?:photo|video|content)|morph(?:ed|ing)|blackmail.*(?:photo|video|nude)|private (?:photo|video).*share/i,
    rationale: 'The report describes sexual blackmail or non-consensual intimate content.',
  },
  {
    incidentType: 'online_trafficking',
    severity: 'critical',
    confidence: 0.9,
    terms: /traffick|forced (?:work|labou?r)|exploit(?:ation)?|sell (?:a )?person/i,
    rationale: 'The report may indicate online trafficking or exploitation.',
  },
  {
    incidentType: 'ransomware_or_malware',
    severity: 'critical',
    confidence: 0.92,
    terms:
      /ransomware|ransom note|files? (?:are )?(?:encrypt|lock)|decrypt(?:ion)? key|malware|remote access (?:app|tool)|virus.*(?:phone|laptop|computer)/i,
    rationale:
      'The report describes malware or ransomware that can spread or make data unavailable.',
  },
  {
    incidentType: 'website_defacement',
    severity: 'high',
    confidence: 0.9,
    terms:
      /website (?:deface|changed|hacked|redirect)|site (?:deface|redirect)|homepage.*(?:changed|hacked)|wordpress.*hacked/i,
    rationale: 'The report describes a potentially compromised or altered website.',
  },
  {
    incidentType: 'hacking_or_data_breach',
    severity: 'high',
    confidence: 0.88,
    terms:
      /data breach|database.*(?:leak|access)|unauthori[sz]ed access|server.*hacked|network.*hacked|admin account.*hacked|security (?:breach|incident)/i,
    rationale: 'The report describes unauthorised access to systems, networks, or data.',
  },
  {
    incidentType: 'lost_or_stolen_phone',
    severity: 'high',
    confidence: 0.92,
    terms:
      /(?:phone|mobile|handset).*(?:lost|stolen|snatched)|(?:lost|stolen|snatched).*(?:phone|mobile|handset)/i,
    rationale:
      'The report concerns a lost or stolen mobile device that may expose accounts and SIM-based recovery.',
  },
  {
    incidentType: 'identity_theft_or_sim_swap',
    severity: 'critical',
    confidence: 0.9,
    terms:
      /sim swap|sim.*(?:stopped|no service|deactivated)|identity theft|aadhaar.*(?:misuse|fraud)|kyc.*(?:misuse|fraud)|number.*(?:ported|taken)/i,
    rationale:
      'The report suggests identity misuse or SIM takeover, which can lead to account and financial fraud.',
  },
  {
    incidentType: 'impersonation_or_digital_arrest',
    severity: 'critical',
    confidence: 0.92,
    terms:
      /digital arrest|(?:police|cbi|customs|court|narcotics|ed|rbi).*(?:arrest|case|threat|video call|pay)|(?:arrest|case|threat).*(?:police|cbi|customs|court|narcotics|ed)/i,
    rationale: 'The report includes coercion by someone claiming to represent an authority.',
  },
  {
    incidentType: 'investment_or_crypto_scam',
    severity: 'critical',
    confidence: 0.9,
    terms:
      /(?:investment|trading|crypto|bitcoin|forex).*(?:return|profit|scheme|group|loss|withdraw)|guaranteed (?:return|profit)|double (?:my |the )?money/i,
    rationale: 'The report describes a deceptive investment, trading, or cryptocurrency offer.',
  },
  {
    incidentType: 'online_gambling',
    severity: 'high',
    confidence: 0.88,
    terms:
      /(?:betting|gambling|casino|colour prediction|prediction game|ipl tip).*(?:app|site|money|withdraw|loss)|(?:app|site).*(?:betting|gambling|casino)/i,
    rationale: 'The report involves online gambling or betting activity.',
  },
  {
    incidentType: 'romance_or_matrimonial_scam',
    severity: 'high',
    confidence: 0.88,
    terms:
      /(?:matrimonial|dating|romance|shaadi).*(?:money|payment|gift|emergency|scam)|(?:fianc[eé]|boyfriend|girlfriend).*(?:money|transfer|customs)/i,
    rationale:
      'The report describes a relationship or matrimonial pretext used to obtain money or information.',
  },
  {
    incidentType: 'job_loan_or_marketplace_scam',
    severity: 'high',
    confidence: 0.87,
    terms:
      /(?:job|recruiter|work from home|loan|seller|buyer|olx|delivery|courier|rental|refund).*(?:fee|payment|advance|scam|fraud|link)|(?:fake|fraud).*(?:job|loan|delivery|courier)/i,
    rationale:
      'The report describes a job, loan, delivery, marketplace, or advance-fee scam pattern.',
  },
  {
    incidentType: 'cyber_stalking_or_bullying',
    severity: 'high',
    confidence: 0.87,
    terms:
      /cyber.?stalk|stalking|bully|harass(?:ment|ing)?|repeated.*(?:message|call|contact)|threat(?:en|ening).*(?:message|post|online)/i,
    rationale: 'The report describes repeated online harassment, stalking, bullying, or threats.',
  },
  {
    incidentType: 'social_media_abuse',
    severity: 'high',
    confidence: 0.85,
    terms:
      /fake profile|impersonat(?:e|ing|ion).*profile|defam(?:e|ation)|doxx|social media.*(?:abuse|threat|post)|(?:facebook|instagram|telegram|whatsapp|x).*(?:fake|abuse|threat|report)/i,
    rationale: 'The report describes harmful social-media content, impersonation, or abuse.',
  },
  {
    incidentType: 'account_takeover',
    severity: 'high',
    confidence: 0.87,
    terms:
      /(?:account|profile|email|instagram|facebook|whatsapp).*(?:hacked|taken over|locked out|password changed|unauthori[sz]ed login)|(?:hacked|locked out).*(?:account|profile|email|instagram|facebook|whatsapp)/i,
    rationale: 'The report describes loss of control of an online account or profile.',
  },
  {
    incidentType: 'phishing_or_vishing',
    severity: 'high',
    confidence: 0.86,
    terms:
      /phishing|smishing|vishing|suspicious (?:link|email|sms|message|call)|(?:clicked|opened|entered).*(?:link|password|login|otp)|(?:kyc|delivery).*(?:link|message|sms)/i,
    rationale:
      'The report includes a suspicious message, link, email, or call attempting to obtain information.',
  },
  {
    incidentType: 'upi_payment_fraud',
    severity: 'critical',
    confidence: 0.9,
    terms: /upi|qr code|collect request|gpay|google pay|phonepe|paytm|wallet/i,
    rationale:
      'The report describes an unexpected or deceptive UPI, wallet, QR-code, or payment-app transfer.',
  },
  {
    incidentType: 'card_or_banking_fraud',
    severity: 'critical',
    confidence: 0.9,
    terms:
      /(?:otp|cvv|debit card|credit card|internet banking|net banking|bank account|unauthori[sz]ed transaction|bank se call|bank caller).*(?:fraud|money|debit|transfer|scam|lost|kat|paise|hazaar)|(?:money|amount|rupee|₹).*(?:debit|deduct|transfer|fraud)/i,
    rationale: 'The report describes unauthorised banking, card, or account activity.',
  },
  {
    incidentType: 'suspicious_identifier',
    severity: 'medium',
    confidence: 0.74,
    terms:
      /(?:suspicious|unknown|fake).*(?:number|url|website|email|handle|sms|message|link)|(?:should i|is this).*(?:scam|fake|fraud)/i,
    rationale:
      'The report appears to describe a suspected identifier or attempted scam without a confirmed loss.',
  },
];

export class IncidentAnalysisService {
  async classifyIncident(description: string): Promise<ClassificationResult> {
    const match = classifications.find((candidate) => candidate.terms.test(description));
    const guide = getIncidentGuide(match?.incidentType);
    return {
      incidentType: guide.type,
      confidence: match?.confidence ?? 0.62,
      severity: match?.severity ?? guide.severity,
      rationale:
        match?.rationale ??
        'The information suggests a possible cyber-enabled incident, but more details are needed to place it in a narrower category.',
      playbook: guide.title,
    };
  }

  async extractIncident(description: string): Promise<IncidentExtraction> {
    const normalized = description.replaceAll(',', '');
    const compactAmount = normalized.match(/(?:₹|rs\.?|inr|rupees?)\s*(\d+(?:\.\d+)?)/i);
    const scaledAmount = normalized.match(/(\d+(?:\.\d+)?)\s*(hazaar|thousand|lakh)/i);
    const multiplier = scaledAmount?.[2].toLowerCase() === 'lakh' ? 100000 : 1000;
    const amount = compactAmount
      ? Number(compactAmount[1])
      : scaledAmount
        ? Number(scaledAmount[1]) * multiplier
        : undefined;
    const phoneNumbers = description.match(/(?:\+91[ -]?)?[6-9]\d{9}/g) ?? [];
    const urls =
      description.match(/https?:\/\/[^\s]+|\b[a-z0-9-]+\.(?:com|in|net|org)(?:\/[^\s]*)?/gi) ?? [];
    const emails = Array.from(description.match(/[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []);
    const upiIds =
      description
        .match(/[a-z0-9._-]{2,}@[a-z]{2,}/gi)
        ?.filter((value) => !emails.includes(value)) ?? [];
    const transactionIds =
      description.match(/\b(?:TXN|UTR|UPI|IMPS|NEFT|RTGS|DEMO)[A-Z0-9-]{6,}\b/gi) ?? [];
    const bank = description.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+Bank\b/)?.[0];
    const service =
      description.match(
        /\b(WhatsApp|Instagram|Facebook|Telegram|Gmail|Google|PhonePe|Paytm|Google Pay|GPay|Amazon|Flipkart|OLX|LinkedIn|YouTube|X|Twitter|Skype|Zoom)\b/i,
      )?.[0] ?? bank;
    const paymentMethod = /upi|gpay|google pay|phonepe|paytm|qr code|collect request/i.test(
      description,
    )
      ? 'UPI / payment app'
      : /card|cvv|debit|credit/i.test(description)
        ? 'Card payment'
        : /bank|transfer|neft|imps|rtgs/i.test(description)
          ? 'Bank transfer'
          : undefined;
    return {
      language: /mujhe|aaya|liya|gaya|kat|mera|mere|paise|kya|hai/i.test(description)
        ? 'hinglish'
        : /[\u0900-\u097F]/.test(description)
          ? 'hi'
          : 'en',
      amount,
      otpInvolved: /otp|one[- ]time password/i.test(description),
      bank,
      affectedService: service,
      paymentMethod,
      incidentDate: description.match(
        /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i,
      )?.[0],
      incidentTime: description.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0],
      entities: { phoneNumbers, upiIds, bankAccounts: [], urls, emails, transactionIds },
    };
  }

  async detectMissingFields(incident: Incident) {
    const requirements = getEvidenceRequirements(incident.incidentType)
      .filter((field) => field.critical)
      .map((field) => field.key);
    const present = new Set<string>();
    if (incident.incidentDate) present.add('date');
    if (incident.incidentTime) present.add('time');
    if (incident.affectedService || incident.bank) present.add('platform');
    if (incident.amount) present.add('amount');
    if (incident.entities.transactionIds.length) present.add('transactionId');
    if (incident.entities.upiIds.length || incident.entities.bankAccounts.length)
      present.add('recipient');
    if (incident.entities.phoneNumbers.length || incident.entities.emails.length)
      present.add('contact');
    if (incident.entities.urls.length) present.add('url');
    return requirements.filter((key) => !present.has(key));
  }

  async generateActionPlan(incident?: Incident): Promise<ActionItem[]> {
    return getIncidentGuide(incident?.incidentType).actions.map((item) => ({
      ...item,
      completed: false,
    }));
  }

  demoEvidence(fileName = 'demo-payment-receipt.png'): EvidenceExtraction {
    const detected = {
      amount: '₹25,000',
      transactionId: 'DEMO2508231051',
      date: '23 Aug 2026',
      time: '10:52 AM',
      recipient: 'demo.receiver@upi',
      accountId: 'UPI account',
      platform: 'UPI payment app',
      screenshot: 'Transaction receipt',
      contact: '+91 XXXXX 1042',
    };
    return {
      evidence: {
        id: crypto.randomUUID(),
        name: fileName,
        type: 'Transaction screenshot',
        status: 'ready',
        extracted: detected,
      },
      detected,
    };
  }

  async generateTimeline(
    incident: Incident,
    detected: Record<string, string> = {},
  ): Promise<TimelineEvent[]> {
    if (incident.description === demoDescription)
      return [
        {
          id: crypto.randomUUID(),
          timestamp: '10:32 AM',
          title: 'Initial contact',
          detail: 'Caller contacted the complainant and claimed to represent their bank.',
          source: 'narrative',
        },
        {
          id: crypto.randomUUID(),
          timestamp: '10:41 AM',
          title: 'KYC pretext',
          detail: 'Caller said KYC verification was urgently required.',
          source: 'narrative',
        },
        {
          id: crypto.randomUUID(),
          timestamp: '10:47 AM',
          title: 'OTP shared',
          detail: 'The complainant reported sharing a one-time password.',
          source: 'user',
        },
        {
          id: crypto.randomUUID(),
          timestamp: '10:52 AM',
          title: 'Payment evidence recorded',
          detail: 'Receipt shows transaction DEMO2508231051 to demo.receiver@upi.',
          source: 'evidence',
        },
        {
          id: crypto.randomUUID(),
          timestamp: '11:02 AM',
          title: 'Fraud suspected',
          detail:
            'The complainant recognized the activity as potentially fraudulent and began preserving evidence.',
          source: 'user',
        },
      ];
    const eventTime = detected.time || incident.incidentTime || 'Time not recorded';
    const guide = getIncidentGuide(incident.incidentType);
    const timeline: TimelineEvent[] = [
      {
        id: crypto.randomUUID(),
        timestamp: eventTime,
        title: 'Incident reported by complainant',
        detail: incident.description,
        source: 'narrative',
      },
      ...(Object.keys(detected).length
        ? [
            {
              id: crypto.randomUUID(),
              timestamp: eventTime,
              title: 'Supporting evidence recorded',
              detail: `${Object.keys(detected).length} evidence detail${Object.keys(detected).length === 1 ? '' : 's'} recorded for this case.`,
              source: 'evidence' as const,
            },
          ]
        : []),
      {
        id: crypto.randomUUID(),
        timestamp: eventTime,
        title: 'First-response plan created',
        detail: `${guide.title} guidance was generated for review by the complainant.`,
        source: 'user',
      },
    ];
    return timeline.sort((a, b) => parseClock(a.timestamp) - parseClock(b.timestamp));
  }

  async generateComplaint(incident: Incident, detected: Record<string, string> = {}) {
    const guide = getIncidentGuide(incident.incidentType);
    const identifiers = [
      ...incident.entities.phoneNumbers.map((value) => `Phone: ${value}`),
      ...incident.entities.emails.map((value) => `Email: ${value}`),
      ...incident.entities.urls.map((value) => `URL: ${value}`),
      ...incident.entities.upiIds.map((value) => `UPI ID: ${value}`),
      ...incident.entities.transactionIds.map((value) => `Transaction reference: ${value}`),
    ];
    const details = [
      incident.portalCategory ? `Official portal category: ${incident.portalCategory}` : '',
      incident.portalSubCategory ? `Complaint sub-category: ${incident.portalSubCategory}` : '',
      incident.occurrencePlatform ? `Occurrence platform: ${incident.occurrencePlatform}` : '',
      incident.financialLoss !== undefined
        ? `Financial loss reported: ${incident.financialLoss ? 'Yes' : 'No'}`
        : '',
      incident.affectedService || incident.bank
        ? `Affected service/platform: ${incident.affectedService || incident.bank}`
        : '',
      incident.amount ? `Amount involved: ${formatAmount(incident.amount)}` : '',
      detected.transactionId ? `Transaction reference: ${detected.transactionId}` : '',
      detected.date || incident.incidentDate
        ? `Date: ${detected.date || incident.incidentDate}`
        : '',
      detected.time || incident.incidentTime
        ? `Time: ${detected.time || incident.incidentTime}`
        : '',
      ...identifiers,
    ].filter(Boolean);
    const completedActions = incident.actionPlan.filter((item) => item.completed);
    return `Subject: Report of suspected ${guide.title}\n\nIncident\nI wish to report a suspected cybercrime. My account of what happened is:\n\n${incident.description}\n\nDetails\n${details.length ? details.map((item) => `• ${item}`).join('\n') : '• Details are not yet confirmed.'}\n\nEvidence\n${incident.evidence.length ? incident.evidence.map((item) => `• ${item.name} (${item.type})`).join('\n') : '• No supporting file has been recorded yet.'}\n\nActions already taken\n${completedActions.length ? completedActions.map((item) => `• ${item.title}`).join('\n') : '• No action has been marked complete yet.'}\n\nRequest\nI request that this information be reviewed through the appropriate official reporting and investigation process. This draft requires human review before official submission. It does not include any OTP, PIN, password, CVV, or other secret credential.`;
  }
}

export const analysisService = new IncidentAnalysisService();
export const aiProvider = analysisService;
export const demoScenarios = [
  {
    id: 'bank-otp',
    label: 'Bank impersonation / OTP fraud',
    description: demoDescription,
    expectedType: 'card_or_banking_fraud',
  },
  {
    id: 'upi',
    label: 'UPI fraud',
    description: 'A fake seller sent me a UPI collect request and ₹8,000 was debited.',
    expectedType: 'upi_payment_fraud',
  },
  {
    id: 'investment',
    label: 'Investment scam',
    description: 'I paid ₹40,000 after being promised guaranteed investment returns.',
    expectedType: 'investment_or_crypto_scam',
  },
  {
    id: 'phishing',
    label: 'Phishing',
    description: 'I opened a login link from a delivery message and entered my email.',
    expectedType: 'phishing_or_vishing',
  },
  {
    id: 'takeover',
    label: 'Account takeover',
    description: 'My social account was hacked and I am locked out.',
    expectedType: 'account_takeover',
  },
  {
    id: 'digital-arrest',
    label: 'Digital arrest',
    description: 'Someone claiming to be police threatened digital arrest and demanded payment.',
    expectedType: 'impersonation_or_digital_arrest',
  },
  {
    id: 'ransomware',
    label: 'Ransomware',
    description: 'My files are encrypted and a ransom note asks me to pay.',
    expectedType: 'ransomware_or_malware',
  },
  {
    id: 'child-safety',
    label: 'Child safety',
    description: 'A stranger is grooming a child online.',
    expectedType: 'child_safety_or_grooming',
  },
  {
    id: 'phone',
    label: 'Lost phone',
    description: 'My phone was stolen on the train.',
    expectedType: 'lost_or_stolen_phone',
  },
] as const;

export function parseClock(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}
export function validateClassification(value: ClassificationResult) {
  return Boolean(
    value.incidentType &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    value.severity &&
    value.rationale,
  );
}
function formatAmount(amount?: number) {
  return amount
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(amount)
    : '';
}
