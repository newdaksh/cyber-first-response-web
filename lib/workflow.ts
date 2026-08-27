import { StoreError } from './errors.ts';
import type { Incident, IncidentSnapshot, IncidentStatus } from './incident.ts';
import { canTransition } from './incident.ts';
import { isOccurrencePlatform, isPortalCategory, isPortalSubcategory } from './portal-fields.ts';
import { demoDescription } from './presentation.ts';
import { redactSensitiveText } from './security.ts';

export type CaseCommand =
  | { action: 'begin'; revision: number }
  | { action: 'loadDemo'; revision: number }
  | { action: 'analyze'; revision: number; description: string }
  | {
      action: 'clarify';
      revision: number;
      service: string;
      time: string;
      portalCategory: string;
      portalSubCategory: string;
      occurrencePlatform: string;
      financialLoss: string;
    }
  | { action: 'toggleAction'; revision: number; actionId: string }
  | { action: 'advance'; revision: number; to: 'EVIDENCE_COLLECTION' | 'CASE_READY' }
  | { action: 'back'; revision: number }
  | { action: 'timeline'; revision: number }
  | { action: 'complaint'; revision: number }
  | { action: 'editComplaint'; revision: number; draft: string }
  | { action: 'review'; revision: number; draft: string }
  | { action: 'handoff'; revision: number };

export interface WorkflowAnalysisService {
  classifyIncident(description: string): Promise<{
    incidentType: NonNullable<Incident['incidentType']>;
    confidence: number;
    severity: NonNullable<Incident['severity']>;
    rationale: string;
    playbook: string;
  }>;
  extractIncident(
    description: string,
  ): Promise<Partial<Incident> & Pick<Incident, 'entities' | 'language'>>;
  generateActionPlan(incident: Incident): Promise<Incident['actionPlan']>;
  detectMissingFields(incident: Incident): Promise<string[]>;
  generateTimeline(
    incident: Incident,
    detected: Record<string, string>,
  ): Promise<Incident['timeline']>;
  generateComplaint(incident: Incident, detected: Record<string, string>): Promise<string>;
}

export async function applyCaseCommand(
  current: IncidentSnapshot,
  command: CaseCommand,
  analysisService: WorkflowAnalysisService,
): Promise<IncidentSnapshot> {
  const next = structuredClone(current);
  const incident = next.incident;

  switch (command.action) {
    case 'begin':
      transition(incident.status, 'INTAKE');
      incident.status = 'INTAKE';
      return next;
    case 'loadDemo':
      return analyzeIncident(next, demoDescription, analysisService, ['NEW', 'INTAKE']);
    case 'analyze': {
      expectStatus(incident.status, ['INTAKE']);
      const description = redactSensitiveText(
        requiredText(command.description, 5000, 'Incident description'),
      );
      return analyzeIncident(next, description, analysisService, ['INTAKE']);
    }
    case 'clarify':
      expectStatus(incident.status, ['TRIAGE']);
      {
        const previousService = incident.affectedService;
        const service = optionalText(command.service, 120, 'Affected service or platform');
        incident.affectedService = service ? redactSensitiveText(service) : undefined;
        if (
          isBankingIncident(incident.incidentType) &&
          (!incident.bank || incident.bank === previousService)
        ) {
          incident.bank = incident.affectedService;
        }
      }
      const portalCategory = requiredText(command.portalCategory, 80, 'Portal category');
      if (!isPortalCategory(portalCategory)) {
        throw new StoreError(400, 'The portal category is invalid.');
      }
      const portalSubCategory = requiredText(
        command.portalSubCategory,
        120,
        'Complaint sub-category',
      );
      if (!isPortalSubcategory(portalCategory, portalSubCategory)) {
        throw new StoreError(400, 'The complaint sub-category does not match its category.');
      }
      const occurrencePlatform = requiredText(
        command.occurrencePlatform,
        80,
        'Occurrence platform',
      );
      if (!isOccurrencePlatform(occurrencePlatform)) {
        throw new StoreError(400, 'The occurrence platform is invalid.');
      }
      incident.portalCategory = portalCategory;
      incident.portalSubCategory = portalSubCategory;
      incident.occurrencePlatform = occurrencePlatform;
      if (command.financialLoss !== 'yes' && command.financialLoss !== 'no') {
        throw new StoreError(400, 'Financial loss must be answered yes or no.');
      }
      incident.financialLoss = command.financialLoss === 'yes';
      incident.incidentTime = redactSensitiveText(requiredText(command.time, 100, 'Incident time'));
      incident.incidentDate ||= incident.incidentTime.match(
        /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/,
      )?.[0];
      incident.status = 'ACTION_REQUIRED';
      next.missing = await analysisService.detectMissingFields(incident);
      return next;
    case 'toggleAction': {
      expectStatus(incident.status, ['ACTION_REQUIRED']);
      const action = incident.actionPlan.find((item) => item.id === command.actionId);
      if (!action) throw new StoreError(400, 'That response action does not exist.');
      action.completed = !action.completed;
      return next;
    }
    case 'advance':
      transition(incident.status, command.to);
      incident.status = command.to;
      return next;
    case 'back': {
      const previous = previousStatus(incident.status);
      if (!previous) throw new StoreError(409, 'There is no earlier step for this case.');
      incident.status = previous;
      if (previous === 'COMPLAINT_READY') {
        incident.complaint = { ...incident.complaint, reviewed: false, handoffStatus: 'ready' };
      }
      if (previous === 'REVIEW') incident.complaint.handoffStatus = 'ready';
      return next;
    }
    case 'timeline':
      expectStatus(incident.status, ['EVIDENCE_COLLECTION']);
      if (!incident.evidence.length)
        throw new StoreError(400, 'Add an evidence item before building the timeline.');
      incident.timeline = await analysisService.generateTimeline(incident, next.detected);
      incident.status = 'TIMELINE_READY';
      return next;
    case 'complaint':
      expectStatus(incident.status, ['CASE_READY']);
      incident.complaint = {
        ...incident.complaint,
        draft:
          incident.complaint.draft ||
          redactSensitiveText(await analysisService.generateComplaint(incident, next.detected)),
        handoffStatus: 'ready',
      };
      incident.status = 'COMPLAINT_READY';
      return next;
    case 'editComplaint':
      expectStatus(incident.status, ['COMPLAINT_READY', 'REVIEW']);
      incident.complaint.draft = redactSensitiveText(
        requiredText(command.draft, 30000, 'Complaint draft'),
      );
      return next;
    case 'review':
      expectStatus(incident.status, ['COMPLAINT_READY']);
      incident.complaint = {
        ...incident.complaint,
        draft: redactSensitiveText(requiredText(command.draft, 30000, 'Complaint draft')),
        reviewed: true,
      };
      incident.status = 'REVIEW';
      return next;
    case 'handoff':
      expectStatus(incident.status, ['REVIEW']);
      incident.complaint.handoffStatus = 'simulated';
      incident.status = 'HANDOFF';
      return next;
  }
}

async function analyzeIncident(
  snapshot: IncidentSnapshot,
  description: string,
  analysisService: WorkflowAnalysisService,
  allowedStatuses: IncidentStatus[],
) {
  const incident = snapshot.incident;
  expectStatus(incident.status, allowedStatuses);
  const [classification, extraction] = await Promise.all([
    analysisService.classifyIncident(description),
    analysisService.extractIncident(description),
  ]);
  Object.assign(incident, extraction, {
    description,
    incidentType: classification.incidentType,
    confidence: classification.confidence,
    severity: classification.severity,
    status: 'TRIAGE' as const,
  });
  incident.actionPlan = await analysisService.generateActionPlan(incident);
  snapshot.classification = classification;
  snapshot.missing = await analysisService.detectMissingFields(incident);
  return snapshot;
}

function requiredText(value: unknown, maximum: number, field: string) {
  if (typeof value !== 'string') throw new StoreError(400, `${field} is required.`);
  const normalized = value.trim();
  if (!normalized) throw new StoreError(400, `${field} is required.`);
  if (normalized.length > maximum) throw new StoreError(400, `${field} is too long.`);
  return normalized;
}

function optionalText(value: unknown, maximum: number, field: string) {
  if (typeof value !== 'string') throw new StoreError(400, `${field} must be text.`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new StoreError(400, `${field} is too long.`);
  return normalized;
}

function isBankingIncident(type: Incident['incidentType']) {
  return [
    'upi_payment_fraud',
    'card_or_banking_fraud',
    'investment_or_crypto_scam',
    'identity_theft_or_sim_swap',
  ].includes(type ?? '');
}

function transition(from: IncidentStatus, to: IncidentStatus) {
  if (!canTransition(from, to))
    throw new StoreError(409, `The case cannot move from ${from} to ${to}.`);
}

function expectStatus(actual: IncidentStatus, allowed: IncidentStatus[]) {
  if (!allowed.includes(actual))
    throw new StoreError(409, `This action is not available while the case is ${actual}.`);
}

function previousStatus(status: IncidentStatus): IncidentStatus | null {
  const steps: Partial<Record<IncidentStatus, IncidentStatus>> = {
    INTAKE: 'NEW',
    TRIAGE: 'INTAKE',
    ACTION_REQUIRED: 'TRIAGE',
    EVIDENCE_COLLECTION: 'ACTION_REQUIRED',
    TIMELINE_READY: 'EVIDENCE_COLLECTION',
    CASE_READY: 'TIMELINE_READY',
    COMPLAINT_READY: 'CASE_READY',
    REVIEW: 'COMPLAINT_READY',
    HANDOFF: 'REVIEW',
  };
  return steps[status] ?? null;
}
