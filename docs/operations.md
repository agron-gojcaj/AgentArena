# Operations, cost, and local security

## Boundaries

Only `127.0.0.1:3000` is published by normal Compose. PostgreSQL and the API have no host ports, and the worker has no HTTP server. The optional development override publishes DB/API ports to loopback. Host API and Vite development defaults also bind to loopback. The API rejects foreign Host/Origin values to reduce DNS-rebinding and cross-site request risks. JSON-only writes prevent simple browser form submissions.

The MVP has no authentication. These controls are for a trusted single-user workstation; they are not sufficient for internet deployment, shared hosting, or hostile local processes. Do not expose an unrestricted provider key publicly. There are no real customer databases or payment processors.

## Budget and pricing

The worker's `MODEL_PRICING_JSON` maps supported model IDs to USD per million input/output tokens. Each run snapshots the rates used. Unknown pricing or a missing key fails a real run before any provider request. Fake models use zero-cost rates.

Before claiming real work, a serialized database transaction reserves `case_count × max_model_turns × (65536 input tokens + 1024 output tokens)` at those rates. The SDK hook limits serialized system/input bytes to 57,344 before a request, leaving an 8,192-token allowance for the fixed tools, structured output, and protocol overhead. Each output is capped at 1,024 tokens. One UTF-8 byte per token is a conservative BPE bound for visible textual input; rates and SDK/provider overhead remain assumptions, so this is an **application estimate**, not a provider-enforced billing guarantee. Configure a provider project budget as well.

The worker disables automatic OpenAI client retries. The complete case is bounded by an async timeout. Model calls execute outside database transactions. On successful completion, actual reported usage replaces the reservation. On errors/crashes, unconfirmed cost remains reserved conservatively. Known usage is recorded through SDK hooks even if a later turn fails.

Project admission uses the sum of actual cost and outstanding reservations across all retained runs. Restarting a worker does not reset it. Reservations for failed real runs intentionally remain; reconcile actual provider billing before clearing any via administrative SQL. Do not delete run rows to make budget errors disappear. Changing rate assumptions or increasing `PROJECT_BUDGET_USD` requires worker recreation.

## Failures and recovery

- `QUEUED` without progress: verify `docker compose ps` and worker logs. A queue does not imply a worker is available.
- `FAILED` / missing key: add the key only to the worker environment and recreate it. Then use **Run again**.
- Lease expired: another worker/startup marks the abandoned run failed. Late writers are fenced. No automatic paid retry occurs.
- Timeout or max calls/turns: inspect the partial trace and case error, then revise the configuration or limits.
- Budget reservation rejected: reduce selected cases/turns, inspect retained uncertain reservations, or deliberately increase the project budget.
- Stream reconnecting: the browser resumes from its event ID. Reloading a run replays its stored history from the beginning.

Manual retry creates a new run with the original immutable snapshots and limits. It is an explicit new execution and may incur charges. Comparisons are two independent runs, so one may fail while the other succeeds; the UI shows both statuses.

## Data retention

SDK tracing is explicitly disabled. Worker operational logs contain run IDs and sanitized exception categories, not raw provider errors, headers, or prompt content. The local PostgreSQL trace intentionally includes prompts, fictional customer inputs, visible model responses, and tool payloads because inspection is the product. Use fictional data. Exported JSON contains the same local data.

There is no automatic expiry in v0.1. Protect the database volume and backups. Retain run summary/cost rows for budget accounting when manually pruning old `run_events` and `run_case_results`; pruning those records removes replay/results and should be a deliberate administrative operation. `docker compose down -v` is a destructive reset, not a routine shutdown.

## Environment notes

On corporate/cloud proxy networks, builds may need the approved CA bundle and Maven proxy settings. Mount them as build secrets or use local package-manager configuration; do not disable TLS verification or commit environment credentials. Docker's VFS driver copies complete layers and can require much more disk than overlay2. CI validates the normal multi-stage Compose build on a standard Docker runner.
