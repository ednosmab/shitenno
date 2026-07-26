/**
 * types.ts — Action engine types.
 */

export type ActionStatus = "pending" | "running" | "completed" | "failed" | "rolled_back";
export type ActionResult = "success" | "failure" | "skipped" | "rolled_back";

export interface ActionRequest {
  /** Unique action ID (for idempotency). */
  id: string;
  /** Action type (maps to an executor). */
  type: string;
  /** Parameters for the executor. */
  params: Record<string, unknown>;
  /** Correlation ID linking related actions. */
  correlationId?: string;
  /** Optional: parent action ID for dependency chains. */
  parentId?: string;
  /** Timeout in milliseconds (default: 30000). */
  timeout?: number;
}

export interface ExecutionRecord {
  /** Unique execution ID. */
  executionId: string;
  /** Original action request. */
  request: ActionRequest;
  /** Execution hash (SHA-256 of type + params) for idempotency check. */
  executionHash: string;
  /** Current status. */
  status: ActionStatus;
  /** Result when completed. */
  result?: ActionResult;
  /** Output data from executor. */
  output?: Record<string, unknown>;
  /** Error message if failed. */
  error?: string;
  /** ISO timestamp of execution start. */
  startedAt: string;
  /** ISO timestamp of completion. */
  completedAt?: string;
  /** Duration in milliseconds. */
  duration?: number;
  /** Rollback record if rolled back. */
  rollback?: RollbackRecord;
}

export interface RollbackRecord {
  /** Rollback execution ID. */
  rollbackId: string;
  /** Status of rollback. */
  status: ActionStatus;
  /** Error if rollback failed. */
  error?: string;
  /** ISO timestamp. */
  timestamp: string;
}

export interface ActionFilter {
  status?: ActionStatus;
  type?: string;
  correlationId?: string;
}

export interface ActionExecutor {
  /** Executor name (matches action type). */
  name: string;
  /** Execute the action. Returns output data. */
  execute(
    params: Record<string, unknown>,
    context: { projectRoot: string; shitennoDir: string }
  ): Promise<Record<string, unknown>>;
  /** Rollback the action (optional). */
  rollback?(params: Record<string, unknown>, output: Record<string, unknown>): Promise<void>;
}

export interface ExecutionRepository {
  save(record: ExecutionRecord): void;
  findById(executionId: string): ExecutionRecord | undefined;
  findByActionId(actionId: string): ExecutionRecord | undefined;
  findByHash(hash: string): ExecutionRecord | undefined;
  findAll(filter?: ActionFilter): ExecutionRecord[];
  count(filter?: ActionFilter): number;
}
