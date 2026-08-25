import type { IncidentSnapshot } from '../incident';
import { applyCaseCommand as applyWorkflowCommand, type CaseCommand } from '../workflow';
import { meshAnalysisService } from './llm';

export type { CaseCommand } from '../workflow';

export function applyCaseCommand(current: IncidentSnapshot, command: CaseCommand) {
  return applyWorkflowCommand(current, command, meshAnalysisService);
}
