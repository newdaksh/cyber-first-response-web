export type IncidentStatus = 'NEW' | 'INTAKE' | 'TRIAGE' | 'ACTION_REQUIRED' | 'EVIDENCE_COLLECTION' | 'TIMELINE_READY' | 'CASE_READY' | 'COMPLAINT_READY' | 'REVIEW' | 'HANDOFF';

export type IncidentType = 'upi_payment_fraud' | 'bank_otp_fraud' | 'investment_scam' | 'phishing' | 'account_takeover' | 'digital_arrest' | 'other';

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
  paymentMethod?: string;
  incidentDate?: string;
  incidentTime?: string;
  otpInvolved?: boolean;
  entities: { phoneNumbers: string[]; upiIds: string[]; bankAccounts: string[]; urls: string[]; emails: string[]; transactionIds: string[] };
  evidence: Evidence[];
  timeline: TimelineEvent[];
  actionPlan: ActionItem[];
  complaint: { draft: string; reviewed: boolean; handoffStatus: 'not_ready' | 'ready' | 'simulated' };
}

export interface Evidence { id: string; name: string; type: string; status: 'processing' | 'ready' | 'manual'; extracted: Record<string, string>; }
export interface TimelineEvent { id: string; timestamp: string; title: string; detail: string; source: 'narrative' | 'evidence' | 'user'; }
export interface ActionItem { id: string; title: string; detail: string; priority: 'now' | 'next' | 'protect'; completed: boolean; }

export const statusOrder: IncidentStatus[] = ['NEW', 'INTAKE', 'TRIAGE', 'ACTION_REQUIRED', 'EVIDENCE_COLLECTION', 'TIMELINE_READY', 'CASE_READY', 'COMPLAINT_READY', 'REVIEW', 'HANDOFF'];

export function canTransition(from: IncidentStatus, to: IncidentStatus) {
  const current = statusOrder.indexOf(from);
  const next = statusOrder.indexOf(to);
  return next === current + 1 || to === 'NEW';
}

export function createFreshIncident(): Incident {
  return { id: `demo-${Date.now()}`, status: 'NEW', language: 'hinglish', description: '', entities: { phoneNumbers: [], upiIds: [], bankAccounts: [], urls: [], emails: [], transactionIds: [] }, evidence: [], timeline: [], actionPlan: [], complaint: { draft: '', reviewed: false, handoffStatus: 'not_ready' } };
}
