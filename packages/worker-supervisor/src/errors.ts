/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Supervisor Errors
 * Introduction:
 * Defines stable error classifications for worker supervision failures.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-07-15
 */

export class WorkerSupervisorError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = "WorkerSupervisorError"; }
}
export class WorkerConfigurationError extends WorkerSupervisorError { constructor(message: string) { super(message, "WORKER_CONFIGURATION_ERROR"); } }
export class WorkerProtocolError extends WorkerSupervisorError { constructor(message: string) { super(message, "WORKER_PROTOCOL_ERROR"); } }
export class WorkerTimeoutError extends WorkerSupervisorError { constructor(message: string) { super(message, "WORKER_TIMEOUT"); } }
export class WorkerCancelledError extends WorkerSupervisorError { constructor(message: string) { super(message, "WORKER_CANCELLED"); } }
