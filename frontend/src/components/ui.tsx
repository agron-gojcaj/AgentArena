import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, LoaderCircle, Terminal } from 'lucide-react';
import type { Run } from '../types';
import { money } from '../services/api';

export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      <i />
      {value.replaceAll('_', ' ')}
    </span>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <div role="alert" className="error">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" aria-hidden="true" /> Loading workspace…
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Terminal size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {action}
    </header>
  );
}
export function RunTable({ runs }: { runs: Run[] }) {
  if (!runs.length)
    return (
      <Empty title="Your arena is ready">
        Create an agent, choose a challenge, and start your first test.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Agent / run</th>
            <th>Challenge</th>
            <th>Status</th>
            <th>Score</th>
            <th>Est. cost</th>
            <th>Created</th>
            <th>
              <span className="sr-only">Open run</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>
                <Link className="strong" to={`/runs/${run.id}`}>
                  {run.agentSnapshot.name}{' '}
                  <span className="muted">v{run.agentSnapshot.version}</span>
                </Link>
                <small className="mono">
                  {run.id.slice(0, 8)} · {run.agentSnapshot.model}
                </small>
              </td>
              <td>{run.scenarioSnapshot.name}</td>
              <td>
                <Status value={run.status} />
              </td>
              <td className="mono score-text">
                {run.score == null ? '—' : Number(run.score).toFixed(1)}
              </td>
              <td className="mono">{money(run.costEstimate)}</td>
              <td className="muted">{new Date(run.createdAt).toLocaleString()}</td>
              <td>
                <Link
                  className="icon-link"
                  aria-label={`Open run ${run.id.slice(0, 8)}`}
                  to={`/runs/${run.id}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export const categoryLabels: Record<string, string> = {
  taskCompletion: 'Task completion',
  policyCompliance: 'Policy compliance',
  toolQuality: 'Tool quality',
  efficiency: 'Efficiency',
};
