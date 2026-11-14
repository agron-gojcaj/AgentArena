export type AgentConfig = {
  id: string;
  familyId: string;
  name: string;
  version: number;
  model: string;
  systemPrompt: string;
  tools: string[];
  createdAt: string;
};
export type TestCase = {
  id: string;
  name: string;
  input: string;
  expected: Record<string, unknown>;
};
export type Scenario = {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  version: number;
  rules: string[];
  tools: string[];
  cases?: TestCase[];
};
export type Limits = { maxModelTurns: number; maxToolCalls: number; timeoutSecondsPerCase: number };
export type Run = {
  id: string;
  agentConfigId: string;
  scenarioId: string;
  comparisonId: string | null;
  agentSnapshot: AgentConfig;
  scenarioSnapshot: Scenario;
  caseSnapshots: TestCase[];
  executionLimits: Limits;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  score: number | null;
  tokenUsage: { input: number; output: number };
  costEstimate: number;
  reservedCost: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  passedCases: number;
  finishedCases: number;
};
export type CaseResult = {
  caseId: string;
  score: number;
  passed: boolean;
  outcome: string;
  metrics: {
    categories: Record<string, number>;
    toolCalls: number;
    toolErrors: number;
    durationMs: number;
    tokenUsage: { input: number; output: number };
    decision: { decision: string; message: string } | null;
    error: string | null;
  };
  violations: { code: string; message: string }[];
  finalState: Record<string, unknown>;
};
export type RunDetails = { run: Run; results: CaseResult[] };
export type ArenaEvent = {
  eventId: number;
  runId: string;
  caseId: string | null;
  sequence: number;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
};
