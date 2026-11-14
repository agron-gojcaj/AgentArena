import type { AgentConfig, ArenaEvent, Limits, Run, RunDetails, Scenario } from '../types';
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api${path}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status}). Please try again.`);
  }
  return response.json() as Promise<T>;
}
export const api = {
  agents: () => request<AgentConfig[]>('/agents'),
  models: () => request<string[]>('/models'),
  saveAgent: (body: { name: string; model: string; systemPrompt: string }, parent?: string) =>
    request<AgentConfig>(parent ? `/agents/${parent}/versions` : '/agents', body),
  scenarios: () => request<Scenario[]>('/scenarios'),
  scenario: (id: string) => request<Scenario>(`/scenarios/${id}`),
  runs: () => request<Run[]>('/runs'),
  run: (id: string) => request<RunDetails>(`/runs/${id}`),
  retry: (id: string) => request<{ runId: string }>(`/runs/${id}/retry`, {}),
  trace: (id: string) => request<ArenaEvent[]>(`/runs/${id}/trace`),
  queue: (
    agentConfigId: string,
    scenarioId: string,
    testCaseIds: string[],
    executionLimits: Limits,
  ) =>
    request<{ runId: string }>('/runs', {
      agentConfigId,
      scenarioId,
      testCaseIds,
      executionLimits,
    }),
  compare: (
    agentConfigIds: string[],
    scenarioId: string,
    testCaseIds: string[],
    executionLimits: Limits,
  ) =>
    request<{ comparisonId: string }>('/comparisons', {
      agentConfigIds,
      scenarioId,
      testCaseIds,
      executionLimits,
    }),
  comparison: (id: string) =>
    request<{ comparisonId: string; runs: RunDetails[] }>(`/comparisons/${id}`),
};
export const terminal = (status?: string) => status === 'COMPLETED' || status === 'FAILED';
export const money = (amount: number) => `$${Number(amount).toFixed(4)}`;
