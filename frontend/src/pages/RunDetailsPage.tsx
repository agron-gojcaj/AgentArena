import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, RotateCw, Download, Activity, ShieldAlert } from 'lucide-react';
import { api, money, terminal } from '../services/api';
import { useRunEvents } from '../hooks/useRunEvents';
import { categoryLabels, ErrorMessage, Loading, Metric, PageTitle, Status } from '../components/ui';
import type { ArenaEvent } from '../types';
function TraceRow({ event }: { event: ArenaEvent }) {
  return (
    <details className={`trace-row ${event.type === 'POLICY_VIOLATION' ? 'violation' : ''}`}>
      <summary>
        <span className="trace-index">{String(event.sequence).padStart(2, '0')}</span>
        <span className={`event-dot ${event.type.toLowerCase()}`} />
        <span className="trace-title">
          {typeof event.payload.tool === 'string'
            ? event.payload.tool
            : event.type.replaceAll('_', ' ').toLowerCase()}
          <small>
            {event.type.replaceAll('_', ' ')} {event.caseId ? `· ${event.caseId}` : ''}
          </small>
        </span>
        <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
        <ChevronRight size={15} />
      </summary>
      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
    </details>
  );
}
export default function RunDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const details = useQuery({
    queryKey: ['run', id],
    queryFn: () => api.run(id),
    refetchInterval: (query) => (terminal(query.state.data?.run.status) ? false : 2000),
  });
  const { events, connection } = useRunEvents(id);
  const [caseFilter, setCaseFilter] = useState('all');
  const [retryError, setRetryError] = useState<unknown>();
  const [retrying, setRetrying] = useState(false);
  if (details.isPending) return <Loading />;
  if (!details.data) return <ErrorMessage error={details.error} />;
  const { run, results } = details.data;
  const visible = events.filter((event) => caseFilter === 'all' || event.caseId === caseFilter);
  const calls = results.reduce((sum, result) => sum + result.metrics.toolCalls, 0);
  const duration =
    run.startedAt && run.finishedAt
      ? `${((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
      : '—';
  async function retry() {
    setRetrying(true);
    setRetryError(undefined);
    try {
      const result = await api.retry(run.id);
      navigate(`/runs/${result.runId}`);
    } catch (error) {
      setRetryError(error);
    } finally {
      setRetrying(false);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify({ ...details.data, events }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentarena-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <Link to="/" className="back-link">
        <ArrowLeft size={14} /> All executions
      </Link>
      <PageTitle
        eyebrow={`EXECUTION / ${id.slice(0, 8)}`}
        title={run.agentSnapshot.name}
        action={
          <div className="button-group">
            <button
              className="button secondary"
              disabled={!terminal(run.status) || connection !== 'Replay ready'}
              onClick={download}
            >
              <Download size={15} /> Export
            </button>
            {terminal(run.status) && (
              <button className="button secondary" disabled={retrying} onClick={() => void retry()}>
                <RotateCw size={15} /> {retrying ? 'Queueing…' : 'Run again'}
              </button>
            )}
          </div>
        }
      >
        {run.scenarioSnapshot.name} <span className="slash">/</span> v{run.agentSnapshot.version}{' '}
        <span className="slash">/</span> {run.agentSnapshot.model}
      </PageTitle>
      <ErrorMessage error={details.error || retryError} />
      {run.error && <ErrorMessage error={run.error} />}
      <div className="run-status-line">
        <Status value={run.status} />
        <span>{run.caseSnapshots.length} independent test cases</span>
        <span className="mono muted">{new Date(run.createdAt).toLocaleString()}</span>
      </div>
      <div className="metrics">
        <Metric
          label="OVERALL SCORE"
          value={
            <>
              {run.score == null ? '—' : Number(run.score).toFixed(1)}
              <em>/100</em>
            </>
          }
          detail={`${results.filter((r) => r.passed).length} / ${run.caseSnapshots.length} cases passed`}
        />
        <Metric label="TOOL CALLS" value={calls} detail="Across finished cases" />
        <Metric label="DURATION" value={duration} detail="Total execution time" />
        <Metric
          label="ESTIMATED COST"
          value={money(run.costEstimate)}
          detail={`${run.tokenUsage.input + run.tokenUsage.output} tokens`}
        />
      </div>
      <div className="replay-grid">
        <section className="panel trace-panel">
          <div className="section-header">
            <h2>
              <Activity size={17} /> Execution trace <span className="count">{visible.length}</span>
            </h2>
            <span className="connection">
              <i />
              {connection}
            </span>
          </div>
          <div className="trace-toolbar">
            <label className="sr-only" htmlFor="case-filter">
              Filter trace by case
            </label>
            <select
              id="case-filter"
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
            >
              <option value="all">All test cases</option>
              {run.caseSnapshots.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="muted small">Click an event to inspect its payload</span>
          </div>
          {visible.length ? (
            visible.map((event) => <TraceRow event={event} key={event.eventId} />)
          ) : (
            <div className="empty">
              <Activity />
              <h3>Waiting for events</h3>
              <p>Queued runs begin when a worker is available.</p>
            </div>
          )}
        </section>
        <aside>
          <section className="panel padded">
            <h2>Case results</h2>
            {results.length === 0 && <p className="muted">Results appear as each case finishes.</p>}
            {results.map((result) => (
              <details className="case-result" key={result.caseId}>
                <summary>
                  <span>
                    <strong>
                      {run.caseSnapshots.find((c) => c.id === result.caseId)?.name || result.caseId}
                    </strong>
                    <Status value={result.outcome} />
                  </span>
                  <b className="mono">{result.score}</b>
                </summary>
                <p>{result.metrics.decision?.message || result.metrics.error}</p>
                <div className="category-list">
                  {Object.entries(result.metrics.categories).map(([category, score]) => (
                    <div key={category}>
                      <span>{categoryLabels[category]}</span>
                      <strong>{score}</strong>
                    </div>
                  ))}
                </div>
                {result.violations.map((v, i) => (
                  <div className="violation-note" key={`${v.code}-${i}`}>
                    <ShieldAlert size={14} />
                    <span>
                      {v.code}: {v.message}
                    </span>
                  </div>
                ))}
                <details>
                  <summary>Final simulation state</summary>
                  <pre>{JSON.stringify(result.finalState, null, 2)}</pre>
                </details>
              </details>
            ))}
          </section>
          <details className="panel padded snapshot">
            <summary>Configuration snapshot</summary>
            <p className="mono">
              {run.agentSnapshot.model} · v{run.agentSnapshot.version}
            </p>
            <pre>{run.agentSnapshot.systemPrompt}</pre>
            <p className="muted small">Captured when queued. Later edits cannot change this run.</p>
          </details>
          <div className="notice">
            Scoring is deterministic. Real model behavior can vary. Repeat trials before drawing
            conclusions.
          </div>
        </aside>
      </div>
    </>
  );
}
