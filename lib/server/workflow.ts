import { canTransition, type IncidentSnapshot, type IncidentStatus } from '../incident';
import { analysisService, demoDescription } from '../services';
import { StoreError } from './store';
import { text } from './http';

export type CaseCommand =
  | { action: 'begin'; revision: number }
  | { action: 'loadDemo'; revision: number }
  | { action: 'analyze'; revision: number; description: string }
  | { action: 'clarify'; revision: number; bank: string; time: string }
  | { action: 'toggleAction'; revision: number; actionId: string }
  | { action: 'advance'; revision: number; to: 'EVIDENCE_COLLECTION' | 'CASE_READY' }
  | { action: 'timeline'; revision: number }
  | { action: 'complaint'; revision: number }
  | { action: 'editComplaint'; revision: number; draft: string }
  | { action: 'review'; revision: number; draft: string }
  | { action: 'handoff'; revision: number };

export async function applyCaseCommand(current: IncidentSnapshot, command: CaseCommand): Promise<IncidentSnapshot> {
  const next = structuredClone(current);
  const incident = next.incident;

  switch (command.action) {
    case 'begin':
      transition(incident.status, 'INTAKE');
      incident.status = 'INTAKE';
      return next;
    case 'loadDemo': {
      expectStatus(incident.status, ['NEW', 'INTAKE']);
      const [classification, extraction] = await Promise.all([
        analysisService.classifyIncident(demoDescription),
        analysisService.extractIncident(demoDescription),
      ]);
      Object.assign(incident, extraction, {
        description: demoDescription,
        incidentType: classification.incidentType,
        confidence: classification.confidence,
        severity: classification.severity,
        actionPlan: await analysisService.generateActionPlan({ ...incident, ...extraction, incidentType: classification.incidentType }),
        status: 'TRIAGE' as const,
      });
      next.classification = classification;
      next.missing = await analysisService.detectMissingFields(incident);
      return next;
    }
    case 'analyze': {
      expectStatus(incident.status, ['INTAKE']);
      const description = text(command.description, 5000, 'Incident description');
      const [classification, extraction] = await Promise.all([
        analysisService.classifyIncident(description),
        analysisService.extractIncident(description),
      ]);
      Object.assign(incident, extraction, {
        description,
        incidentType: classification.incidentType,
        confidence: classification.confidence,
        severity: classification.severity,
        actionPlan: await analysisService.generateActionPlan({ ...incident, ...extraction, incidentType: classification.incidentType }),
        status: 'TRIAGE' as const,
      });
      next.classification = classification;
      next.missing = await analysisService.detectMissingFields(incident);
      return next;
    }
    case 'clarify':
      expectStatus(incident.status, ['TRIAGE']);
      incident.bank = text(command.bank, 120, 'Bank');
      incident.incidentTime = text(command.time, 100, 'Incident time');
      incident.incidentDate ||= incident.incidentTime.match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/)?.[0];
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
    case 'timeline':
      expectStatus(incident.status, ['EVIDENCE_COLLECTION']);
      if (!incident.evidence.length) throw new StoreError(400, 'Add an evidence item before building the timeline.');
      incident.timeline = await analysisService.generateTimeline(incident, next.detected);
      incident.status = 'TIMELINE_READY';
      return next;
    case 'complaint':
      expectStatus(incident.status, ['CASE_READY']);
      incident.complaint = { ...incident.complaint, draft: await analysisService.generateComplaint(incident, next.detected), handoffStatus: 'ready' };
      incident.status = 'COMPLAINT_READY';
      return next;
    case 'editComplaint':
      expectStatus(incident.status, ['COMPLAINT_READY', 'REVIEW']);
      incident.complaint.draft = text(command.draft, 30000, 'Complaint draft');
      return next;
    case 'review':
      expectStatus(incident.status, ['COMPLAINT_READY']);
      incident.complaint = { ...incident.complaint, draft: text(command.draft, 30000, 'Complaint draft'), reviewed: true };
      incident.status = 'REVIEW';
      return next;
    case 'handoff':
      expectStatus(incident.status, ['REVIEW']);
      incident.complaint.handoffStatus = 'simulated';
      incident.status = 'HANDOFF';
      return next;
    default:
      throw new StoreError(400, 'Unknown case action.');
  }
}

function transition(from: IncidentStatus, to: IncidentStatus) {
  if (!canTransition(from, to)) throw new StoreError(409, `The case cannot move from ${from} to ${to}.`);
}

function expectStatus(actual: IncidentStatus, allowed: IncidentStatus[]) {
  if (!allowed.includes(actual)) throw new StoreError(409, `This action is not available while the case is ${actual}.`);
}
