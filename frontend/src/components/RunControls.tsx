import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Play, GitCompareArrows } from 'lucide-react';
import { api } from '../services/api';
import { ErrorMessage } from './ui';
import type { Limits, Scenario } from '../types';
export default function RunControls({
  scenario,
  comparison = false,
}: {
  scenario: Scenario;
  comparison?: boolean;
}) {
  const navigate = useNavigate();
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents });
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [cases, setCases] = useState<string[]>(scenario.cases?.map((c) => c.id) || []);
  const [limits, setLimits] = useState<Limits>({
    maxModelTurns: 8,
    maxToolCalls: 12,
    timeoutSecondsPerCase: 60,
  });
  useEffect(() => {
    if (agents.data?.length) {
      setFirst((value) => value || agents.data![0].id);
      setSecond((value) => value || (agents.data![1] || agents.data![0]).id);
    }
  }, [agents.data]);
  const start = useMutation({
    mutationFn: async () => {
      if (comparison) {
        const result = await api.compare([first, second], scenario.id, cases, limits);
        return `/comparisons/${result.comparisonId}`;
      }
      const result = await api.queue(first, scenario.id, cases, limits);
      return `/runs/${result.runId}`;
    },
    onSuccess: (path) => navigate(path),
  });
  const selectAgent = (label: string, value: string, change: (value: string) => void) => (
    <label>
      {label}
      <select required value={value} onChange={(e) => change(e.target.value)}>
        <option value="" disabled>
          Select a configuration
        </option>
        {agents.data?.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name} · v{agent.version} · {agent.model}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form
      className="run-controls"
      onSubmit={(event) => {
        event.preventDefault();
        start.mutate();
      }}
    >
      <h2>{comparison ? 'Set up a comparison' : 'Launch a test'}</h2>
      {!agents.isPending && !agents.data?.length && (
        <div className="notice">
          You need an agent configuration first.{' '}
          <Link to="/agents">Create one in Agent Studio.</Link>
        </div>
      )}
      {selectAgent(comparison ? 'Agent A' : 'Agent configuration', first, setFirst)}
      {comparison && selectAgent('Agent B', second, setSecond)}
      <fieldset>
        <legend>
          Test cases <span className="muted">{cases.length} selected</span>
        </legend>
        {scenario.cases?.map((c) => (
          <label className="checkbox-label" key={c.id}>
            <input
              type="checkbox"
              checked={cases.includes(c.id)}
              onChange={(e) =>
                setCases((current) =>
                  e.target.checked ? [...current, c.id] : current.filter((id) => id !== c.id),
                )
              }
            />
            <span>
              {c.name}
              <small className="mono">{c.id}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <details className="limits">
        <summary>Execution limits</summary>
        <div>
          {(
            [
              { key: 'maxModelTurns', label: 'Model turns', max: 16 },
              { key: 'maxToolCalls', label: 'Tool calls', max: 30 },
              { key: 'timeoutSecondsPerCase', label: 'Seconds / case', max: 120 },
            ] as const
          ).map(({ key, label, max }) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={1}
                max={max}
                required
                value={limits[key]}
                onChange={(e) => setLimits({ ...limits, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </details>
      <ErrorMessage error={start.error || agents.error} />
      <button
        className="button primary full"
        disabled={start.isPending || !first || !cases.length || (comparison && !second)}
      >
        {comparison ? <GitCompareArrows size={16} /> : <Play size={16} />}{' '}
        {start.isPending
          ? 'Queueing…'
          : comparison
            ? 'Run comparison'
            : `Run ${cases.length} test ${cases.length === 1 ? 'case' : 'cases'}`}
      </button>
      <p className="muted small">
        Each test case starts in a fresh environment.{' '}
        {comparison && 'Both agents receive identical fixture snapshots.'}
      </p>
    </form>
  );
}
