import type { IncidentSnapshot } from './incident.ts';

export class StoreError extends Error {
  readonly status: number;
  readonly snapshot: IncidentSnapshot | null;

  constructor(status: number, message: string, snapshot: IncidentSnapshot | null = null) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
    this.snapshot = snapshot;
  }
}
