# Worker protocol sequencing

FlahaINGEST worker IPC is stdio JSONL. Each line is one complete JSON message and must not exceed the configured protocol line limit.

## Attempt session

An attempt session is identified by the pair `(jobId, attemptId)` and is owned by the TypeScript supervisor.

1. Exactly one `WorkerRequest` opens the session.
2. The worker may emit zero or more `WorkerProgress` messages.
3. Every worker-emitted message has a strictly increasing integer `sequence`. The first emitted value may be zero; each later value must be greater than the previous value. Gaps are permitted and recorded.
4. Exactly one `WorkerResult` terminates the session.
5. No message is permitted after the terminal result.
6. Every message must match the opening request's `jobId`, `attemptId`, `correlationId`, and supported `contractVersion`.

## Ownership and fencing

The TypeScript control plane owns sequence validation, terminal-result acceptance, and durable state changes. A worker cannot validate its own authority.

Before accepting a result, the control plane verifies that the attempt is still active, owns the current lease/fencing token, and has not been cancelled, lost, timed out, or superseded. A late result or a result from a fenced attempt is rejected, audited, and its staging artifacts are quarantined. It never revives an attempt or advances a job.

Duplicate requests, non-increasing sequences, mismatched identifiers, a second terminal result, or any post-terminal message are protocol violations. The control plane records the violation, rejects subsequent output, and applies retry/quarantine policy.

JSON Schema validates each line's shape. It does not validate order, session cardinality, monotonic sequences, active leases, or fencing. Those checks require a stateful control-plane validator.
