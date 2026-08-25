export type IncidentStatus =
  | 'NEW'
  | 'INTAKE'
  | 'TRIAGE'
  | 'ACTION_REQUIRED'
  | 'EVIDENCE_COLLECTION'
  | 'TIMELINE_READY'
  | 'CASE_READY'
  | 'COMPLAINT_READY'
  | 'REVIEW'
  | 'HANDOFF';

export type IncidentType =
  | 'upi_payment_fraud'
  | 'card_or_banking_fraud'
  | 'investment_or_crypto_scam'
  | 'impersonation_or_digital_arrest'
  | 'phishing_or_vishing'
  | 'account_takeover'
  | 'social_media_abuse'
  | 'cyber_stalking_or_bullying'
  | 'sextortion_or_intimate_content'
  | 'child_safety_or_grooming'
  | 'job_loan_or_marketplace_scam'
  | 'romance_or_matrimonial_scam'
  | 'identity_theft_or_sim_swap'
  | 'lost_or_stolen_phone'
  | 'ransomware_or_malware'
  | 'hacking_or_data_breach'
  | 'website_defacement'
  | 'online_gambling'
  | 'online_trafficking'
  | 'suspicious_identifier'
  | 'other';

export interface ClassificationResult {
  incidentType: IncidentType;
  confidence: number;
  severity: NonNullable<Incident['severity']>;
  rationale: string;
  playbook: string;
}

export interface Incident {
  id: string;
  status: IncidentStatus;
  language: 'en' | 'hi' | 'hinglish';
  description: string;
  incidentType?: IncidentType;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  amount?: number;
  bank?: string;
  affectedService?: string;
  paymentMethod?: string;
  incidentDate?: string;
  incidentTime?: string;
  otpInvolved?: boolean;
  entities: {
    phoneNumbers: string[];
    upiIds: string[];
    bankAccounts: string[];
    urls: string[];
    emails: string[];
    transactionIds: string[];
  };
  evidence: Evidence[];
  timeline: TimelineEvent[];
  actionPlan: ActionItem[];
  complaint: {
    draft: string;
    reviewed: boolean;
    handoffStatus: 'not_ready' | 'ready' | 'simulated';
  };
}

export interface Evidence {
  id: string;
  name: string;
  type: string;
  status: 'processing' | 'ready' | 'manual';
  extracted: Record<string, string>;
}
export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  source: 'narrative' | 'evidence' | 'user';
}
export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  priority: 'now' | 'next' | 'protect';
  completed: boolean;
}

export interface IncidentSnapshot {
  incident: Incident;
  classification: ClassificationResult | null;
  missing: string[];
  detected: Record<string, string>;
  revision: number;
}

export const statusOrder: readonly IncidentStatus[] = [
  'NEW',
  'INTAKE',
  'TRIAGE',
  'ACTION_REQUIRED',
  'EVIDENCE_COLLECTION',
  'TIMELINE_READY',
  'CASE_READY',
  'COMPLAINT_READY',
  'REVIEW',
  'HANDOFF',
];

export function canTransition(from: IncidentStatus, to: IncidentStatus) {
  const current = statusOrder.indexOf(from);
  const next = statusOrder.indexOf(to);
  return next === current + 1 || to === 'NEW';
}

export function createFreshIncident(id = crypto.randomUUID()): Incident {
  return {
    id,
    status: 'NEW',
    language: 'hinglish',
    description: '',
    entities: {
      phoneNumbers: [],
      upiIds: [],
      bankAccounts: [],
      urls: [],
      emails: [],
      transactionIds: [],
    },
    evidence: [],
    timeline: [],
    actionPlan: [],
    complaint: { draft: '', reviewed: false, handoffStatus: 'not_ready' },
  };
}
