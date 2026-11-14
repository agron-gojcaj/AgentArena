CREATE TABLE agent_configs (
    id UUID PRIMARY KEY,
    family_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    model VARCHAR(80) NOT NULL,
    system_prompt TEXT NOT NULL,
    tools JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (family_id, version)
);
CREATE TABLE scenarios (
    id VARCHAR(80) PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    version INTEGER NOT NULL,
    definition JSONB NOT NULL
);
CREATE TABLE test_cases (
    id VARCHAR(80) PRIMARY KEY,
    scenario_id VARCHAR(80) NOT NULL REFERENCES scenarios(id),
    definition JSONB NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'PUBLIC'
);
CREATE TABLE runs (
    id UUID PRIMARY KEY,
    agent_config_id UUID NOT NULL REFERENCES agent_configs(id),
    scenario_id VARCHAR(80) NOT NULL REFERENCES scenarios(id),
    comparison_id UUID,
    agent_snapshot JSONB NOT NULL,
    scenario_snapshot JSONB NOT NULL,
    case_snapshots JSONB NOT NULL,
    execution_limits JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED')),
    score NUMERIC(5,2),
    token_usage JSONB NOT NULL DEFAULT '{"input":0,"output":0}',
    cost_estimate NUMERIC(14,8) NOT NULL DEFAULT 0,
    reserved_cost NUMERIC(14,8) NOT NULL DEFAULT 0,
    pricing_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    lease_until TIMESTAMPTZ,
    worker_id UUID,
    error TEXT
);
CREATE INDEX runs_queue_idx ON runs (created_at) WHERE status = 'QUEUED';
CREATE INDEX runs_comparison_idx ON runs (comparison_id);
CREATE TABLE run_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    case_id VARCHAR(80),
    sequence INTEGER NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, sequence)
);
CREATE INDEX run_events_replay_idx ON run_events (run_id, id);
CREATE TABLE run_case_results (
    id UUID PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    case_id VARCHAR(80) NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    passed BOOLEAN NOT NULL,
    outcome VARCHAR(30) NOT NULL,
    metrics JSONB NOT NULL,
    violations JSONB NOT NULL,
    final_state JSONB NOT NULL,
    UNIQUE (run_id, case_id)
);
