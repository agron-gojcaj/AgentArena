# API contract

All routes are same-origin, under `/api`. JSON request bodies are required for writes. UUIDs identify agent versions, runs, and comparisons; scenarios and cases use fixture slugs. Unknown resources return 404, invalid requests 400, active-run retry 409, and a full queue 429. Validation errors use `{ "error": "message" }`; unhandled infrastructure errors do not expose stack traces.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/models` | Supported real/fake model IDs |
| GET | `/api/agents` | All immutable configurations, newest first |
| POST | `/api/agents` | 201: new family, version 1 |
| POST | `/api/agents/{id}/versions` | 201: next version in the same family |
| GET | `/api/scenarios` | Scenario metadata, rules, policy, tools |
| GET | `/api/scenarios/{id}` | Full scenario with its cases |
| GET | `/api/runs` | Latest 50 run summaries/snapshots and finished/passed case counts |
| POST | `/api/runs` | 202: run ID, status, event URL |
| POST | `/api/runs/{id}/retry` | 202: new run using original immutable snapshots/limits; send `{}` |
| GET | `/api/runs/{id}` | `{ "run": {...}, "results": [...] }` |
| GET | `/api/runs/{id}/trace` | Full chronological event array (10,000 guard; bounded MVP runs stay below it) |
| GET | `/api/runs/{id}/events` | SSE replay and live events |
| POST | `/api/comparisons` | 202: comparison UUID and two run UUIDs |
| GET | `/api/comparisons/{id}` | `{ "comparisonId": "...", "runs": [runDetails, runDetails] }` |
| GET | `/actuator/health` | API/database health; available inside Compose network |

## Create and version an agent

```json
{
  "name": "Careful support agent",
  "model": "fake-safe",
  "systemPrompt": "Verify bookings and policy. Request approval above $100."
}
```

Name is 1–100 nonblank characters; instructions are 1–12,000. `fake-safe`, `fake-unsafe`, and `gpt-4.1-mini` are the initial allowlist. The four scenario tools are predefined, not arbitrary user-supplied capabilities. Secret/API-key fields and unknown request properties are rejected.

Saving a revision uses the same body. The prior configuration is never updated. Concurrent saves allocate distinct version numbers under a family lock.

## Queue a run

```json
{
  "agentConfigId": "<saved UUID>",
  "scenarioId": "refund-rescue",
  "testCaseIds": ["refund-001", "refund-002"],
  "executionLimits": {
    "maxModelTurns": 8,
    "maxToolCalls": 12,
    "timeoutSecondsPerCase": 60
  }
}
```

Omit `testCaseIds` for all cases. Empty, duplicate, or foreign case IDs are rejected. Limits can be omitted or partially specified; defaults are 8/12/60. Accepted ranges are 1–16 turns, 1–30 calls, 1–120 seconds. Each case has an independent allowance. The response is:

```json
{ "runId": "<UUID>", "status": "QUEUED", "eventsUrl": "/api/runs/<UUID>/events" }
```

Comparisons use `agentConfigIds: ["<A UUID>", "<B UUID>"]` in place of `agentConfigId`; the rest of the request is identical. Both inserts succeed or neither does. Comparing a configuration against itself is allowed for repeated trials.

Explicit retry copies the original prompt, model, scenario version, fixtures, and limits even if the fixture files have since changed. It creates a new independently billed run and does not overwrite history or join the old comparison.

## Events

```text
id: 125
event: arena
data: {"eventId":125,"runId":"...","caseId":"refund-002","sequence":8,"type":"TOOL_CALL_COMPLETED","timestamp":"2026-11-14T20:00:00Z","payload":{"tool":"issue_refund","arguments":{"booking_id":"BK-102","amount":180},"result":{"ok":true,"refund_amount":180,"simulated":true},"durationMs":0.04}}
```

Business event types: `RUN_STARTED`, `CASE_STARTED`, `MODEL_USAGE`, `MODEL_OUTPUT`, `TOOL_CALL_STARTED`, `TOOL_CALL_COMPLETED`, `POLICY_VIOLATION`, `CASE_COMPLETED`, `RUN_COMPLETED`, `RUN_FAILED`.

Send `Last-Event-ID: 125` to replay later events. An initial `?after=125` also works; the header takes precedence. A terminal `event: end` indicates replay is complete and the client should close. Heartbeats are SSE comments. Trace data is retained across application restarts.
