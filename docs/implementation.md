# Blueprint implementation coverage

The complete v0.1 scope was implemented in staged passes within one change. The eight-week roadmap supplied planning milestones, not eight mandatory separate deliveries. The source blueprint is preserved in [blueprint.txt](blueprint.txt).

| Milestone | Implementation |
| --- | --- |
| Foundation | Three-service monorepo + PostgreSQL, Flyway, Compose, health endpoint, loopback UI |
| Simulation | Four tools, five JSON cases, policy enforcement, isolated environments |
| Real agents | Agents SDK function-calling adapter, structured final decision, safe/unsafe fake scripts |
| Evaluation | Explainable weighted deterministic scores, cap and violations, calibration tests |
| Replay | Durable ordered events, SSE reconnect, expandable/filterable trace, JSON export |
| Studio/comparison | Immutable versions/snapshots, matching atomic comparison runs, per-case deltas |
| Hardening | Limits, leases/fencing, budget reservations, request validation, unit/integration/browser tests |
| Local delivery | README quick start, architecture/API/scoring/operations docs, CI, responsive UI |

## Deliberate implementation decisions

- Spring JDBC instead of Hibernate: explicit SQL is shared with the Python queue; Flyway exclusively owns schema evolution.
- JSON instead of YAML: both are allowed by the plan; fixtures are easy to validate with standard libraries.
- Focused CSS and native accessible controls instead of Tailwind/shadcn: no component-library runtime is needed for this small dashboard. React, TypeScript, Vite, and TanStack Query remain as specified.
- Efficiency uses deterministic tool-call count. Latency, tokens, and estimated cost are displayed separately; see [scoring](scoring.md).
- The four tools are fixed for the single challenge. There is no executable-agent upload or arbitrary tool configuration.
- The local deployment is the intended v0.1 target; no public hosting, authentication, billing, or real payments are introduced.

## Validation layers

- `worker/tests/test_simulation.py`: known-good/bad score calibration, ordering, authorization, exact amounts, duplicates, injection case, independent state, malformed arguments, and tool limits.
- `worker/tests/test_sdk.py`: the real SDK loop with a scripted provider, tool dispatch, structured outputs, usage, malformed arguments, and turn/context limits. These are not paid-provider tests.
- `worker/tests/test_queue.py`: real PostgreSQL claims, parallel workers, capacity, persistent traces/results, lease recovery/fencing, cost reservation races, missing keys, timeouts, and sanitized failures.
- `backend/.../ApiIntegrationTest.java`: Spring HTTP integration on a Testcontainers PostgreSQL database, real Flyway migration, snapshots/versioning, case/limit validation, atomic comparisons, queue capacity, same-origin controls, retries, and SSE cursors.
- `frontend/src/**/*.test.*`: reconnect event merging, API error handling, accessible result/error text.
- `frontend/tests/arena.spec.ts`: desktop/mobile browser journeys for create → version → run → replay → export → compare, and failed execution → explicit retry.

Live OpenAI access needs the owner's worker key and is not required by CI. Do not describe mocked SDK verification as a successful paid-provider smoke test.
