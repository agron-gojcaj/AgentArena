# AgentArena

**Build. Test. Debug. Improve.** A local developer workbench for AI agents: version prompts, run realistic simulated challenges, inspect every tool call, and compare deterministic scores.

React + TypeScript · Java 21 + Spring Boot · Python 3.12 + OpenAI Agents SDK · PostgreSQL

![AgentArena workspace showing scored executions](docs/screenshots/overview.png)

## Start the app

Requires Docker Engine/Desktop with Compose v2. Allow at least 8 GB of free disk for the initial build (more with Docker's VFS storage driver).

```bash
git clone https://github.com/agron-gojcaj/AgentArena.git
cd AgentArena
cp .env.example .env
docker compose up --build -d --wait
```

Open **http://localhost:3000**. No API key is needed for fake agents. PostgreSQL, the API, and the worker stay on an internal network; only the frontend is published, bound to loopback.

```bash
docker compose logs -f worker       # run IDs and sanitized errors only
docker compose stop                # preserves saved runs
docker compose up -d                # resume
```

The database lives in the `arena-data` named volume. `docker compose down` preserves it; `docker compose down -v` **deletes all configurations, traces, scores, and budget history**.

## Try the complete experiment

1. Open **Agent Studio**. Create an agent with **Fake · skips approval** (`fake-unsafe`).
2. Change the model to **Fake · policy compliant** (`fake-safe`) and save a new version.
3. Open **Comparisons**. Select the first and second versions, keep all five cases selected, and run.
4. The unsafe script attempts two unauthorized $180 refunds. The simulator rejects both; the evaluator records `POLICY_FAILED`. The safe script obtains approval and scores 100 on all five cases.
5. Open either replay, expand a tool event, filter by case, and inspect arguments, responses, policy violations, and final state. Export a finished run as JSON.

**Fake agents are fixed scripts and ignore prompt edits.** They validate the platform without provider charges. Select a real model to measure changes to instructions. A single real-model result is not a statistically reproducible measure of model quality; repeat trials when comparing prompts.

## Real model execution

Set `OPENAI_API_KEY` in the untracked `.env` file, then recreate the worker:

```bash
docker compose up -d --force-recreate worker
```

Select `gpt-4.1-mini` in Agent Studio. Only the worker receives the key. The SDK uses real function calling and a structured final decision against the four simulated tools. External SDK tracing is disabled; visible model outputs and tool activity are stored locally, without requesting or exposing private chain-of-thought.

Review the centrally configured `MODEL_PRICING_JSON` rates in `.env` against current provider pricing before spending money. Defaults are explicit assumptions ($0.40 input / $1.60 output per million tokens for `gpt-4.1-mini`), not automatically updated prices. `PROJECT_BUDGET_USD` defaults to $5 and reserves estimated worst-case spend across all retained runs. It does not replace a provider-side project spending limit. See [operations](docs/operations.md) for accounting and crash behavior.

The default limits are 8 model turns, 12 tool calls, and 60 seconds **per case**. The API bounds these at 16 / 30 / 120. Output is capped at 1,024 tokens per model turn. One worker process executes one run at a time. To use two workers:

```bash
docker compose up -d --scale worker=2
```

The PostgreSQL claim transaction enforces `MAX_CONCURRENT_RUNS` across processes. The API caps queued + running jobs with `MAX_QUEUED_RUNS`.

## Included in v0.1

- Agent Studio with immutable prompt versions and a model selector.
- Refund Rescue: five JSON fixtures, four tools, authoritative policy, isolated simulation state.
- Durable PostgreSQL queue, worker heartbeat, ownership fencing, manual retry, and spend reservations.
- Deterministic 50/30/10/10 scoring with explicit outcomes and attempted policy violations.
- Persistent chronological replay, reconnectable SSE, structured payload inspection, and JSON exports.
- Matched comparisons with category averages, costs, case scores, and tool-use differences.
- Responsive dark UI, recent runs, pass rates, loading/error/empty states.
- Unit, PostgreSQL integration, SDK contract, API, and desktop/mobile browser tests; GitHub Actions CI.

## Development and validation

Host development requires Java **JDK 21**, Maven 3.9+, Python 3.12+, Node 22+, and Docker. Start the database:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
```

Run each service in its own terminal, from the repository root:

```bash
# API: migrations + fixture loading happen at startup
mvn -f backend/pom.xml spring-boot:run

# Worker
python3 -m venv worker/.venv
worker/.venv/bin/pip install -r worker/requirements.lock
worker/.venv/bin/pip install --no-deps -e worker
worker/.venv/bin/python -m agentarena.main

# Frontend: http://localhost:5173; /api proxies to localhost:8080
npm --prefix frontend ci
npm --prefix frontend run dev
```

Use the default database password for these commands, or export `DATABASE_URL`, `DATABASE_USER`, and `DATABASE_PASSWORD` for the API and a PostgreSQL DSN for the worker. The Java URL begins `jdbc:postgresql://`; the Python URL begins `postgresql://`. Host processes do not automatically load `.env`.

```bash
# Java: HTTP/PostgreSQL integration tests; Testcontainers starts its own DB
mvn -f backend/pom.xml verify

# Python: simulation, grading, SDK loop, queue, limits, and recovery
TEST_DATABASE_URL=postgresql://agentarena:agentarena-local@localhost:5432/agentarena \
  worker/.venv/bin/pytest worker/tests -q

# Frontend tests + type check + production build
npm --prefix frontend test
npm --prefix frontend run build

# Browser tests against a running Compose app
cd frontend
npx playwright install chromium
npm run test:e2e
# Host dev alternative:
# E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

Python PostgreSQL tests use temporary, isolated schemas and remove them afterward. Without `TEST_DATABASE_URL`, those integration tests are explicitly skipped. Java tests require Docker. Browser tests create fictional agents/runs in the chosen app database; use a development instance. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an installed Chromium instead of downloading one.

All CI jobs use fake/scripted agents and require no provider key. Live paid-provider execution is intentionally a separate smoke check with your credentials.

## Repository guide

| Directory | Responsibility |
| --- | --- |
| `frontend/` | React pages, TanStack Query, SSE hook, Vitest and Playwright |
| `backend/` | REST API, validation, immutable snapshots, Flyway, SSE |
| `worker/` | Agents SDK adapter, fake agents, sandbox, evaluator, leased queue |
| `scenarios/` | Versioned JSON challenge and case fixtures |
| `docs/` | Architecture, API, scoring, operations, implementation coverage |

[Architecture](docs/architecture.md) · [API](docs/api.md) · [Scoring](docs/scoring.md) · [Operations](docs/operations.md) · [Blueprint coverage](docs/implementation.md)

This is intentionally an unauthenticated, single-user **local** MVP. Do not expose it publicly or change loopback bindings without adding authentication, authorization, and a production deployment review. Real payments, uploaded executable agents, organizations, billing, and public competitions are outside this release.
