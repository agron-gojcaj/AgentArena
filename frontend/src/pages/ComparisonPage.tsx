import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, GitCompareArrows } from 'lucide-react';
import { api, money, terminal } from '../services/api';
import { categoryLabels, ErrorMessage, Loading, PageTitle, Status } from '../components/ui';
import RunControls from '../components/RunControls';
export default function ComparisonPage() {
  const { id } = useParams();
  const scenario = useQuery({
    queryKey: ['scenario', 'refund-rescue'],
    queryFn: () => api.scenario('refund-rescue'),
    enabled: !id,
  });
  const comparison = useQuery({
    queryKey: ['comparison', id],
    queryFn: () => api.comparison(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.runs.every((d) => terminal(d.run.status)) ? false : 2000,
  });
  const data = comparison.data;
  return (
    <>
      <PageTitle
        eyebrow="SIDE BY SIDE"
        title="Compare the decisions."
        action={
          id && (
            <Link to="/comparisons" className="button secondary">
              <GitCompareArrows size={16} /> New comparison
            </Link>
          )
        }
      >
        Same challenge. Same fixtures. Independent environments.
      </PageTitle>
      <ErrorMessage error={scenario.error || comparison.error} />
      {!id ? (
        scenario.isPending ? (
          <Loading />
        ) : (
          scenario.data && (
            <div className="comparison-setup">
              <section className="panel comparison-pitch">
                <GitCompareArrows size={36} />
                <h2>
                  Put your changes
                  <br />
                  to the test.
                </h2>
                <p>
                  Measure completion, policy compliance, tool quality, and efficiency across the
                  same five cases.
                </p>
                <div className="notice">
                  Try <strong>fake-unsafe</strong> against <strong>fake-safe</strong> to see the
                  impact of skipping approval. Fake scripts ignore prompts; real models evaluate
                  your instructions.
                </div>
              </section>
              <section className="panel">
                <RunControls scenario={scenario.data} comparison />
              </section>
            </div>
          )
        )
      ) : comparison.isPending ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="comparison-cards">
              {data.runs.map(({ run, results }, i) => (
                <section className="panel padded comparison-card" key={run.id}>
                  <div className="section-header">
                    <span className="eyebrow">AGENT {String.fromCharCode(65 + i)}</span>
                    <Status value={run.status} />
                  </div>
                  <h2>
                    {run.agentSnapshot.name}{' '}
                    <span className="muted">v{run.agentSnapshot.version}</span>
                  </h2>
                  <p className="mono muted">{run.agentSnapshot.model}</p>
                  <div className="big-score">
                    {run.score == null ? '—' : Number(run.score).toFixed(1)}
                    <span>/100</span>
                  </div>
                  <div className="comparison-stats">
                    <span>
                      {results.filter((r) => r.passed).length}/{run.caseSnapshots.length} passed
                    </span>
                    <span>{results.reduce((sum, r) => sum + r.metrics.toolCalls, 0)} calls</span>
                    <span>{money(run.costEstimate)}</span>
                  </div>
                  {run.error && <ErrorMessage error={run.error} />}
                  <div className="category-list">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <div key={key}>
                        <span>{label}</span>
                        <strong>
                          {results.length
                            ? (
                                results.reduce((sum, r) => sum + r.metrics.categories[key], 0) /
                                results.length
                              ).toFixed(1)
                            : '—'}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <Link to={`/runs/${run.id}`} className="text-link">
                    Inspect full replay <ArrowRight size={15} />
                  </Link>
                </section>
              ))}
            </div>
            <section className="panel">
              <div className="section-header">
                <h2>Case-by-case differences</h2>
                <span className="muted small">Scores / tool calls / policy violations</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Test case</th>
                      {data.runs.map(({ run }) => (
                        <th key={run.id}>
                          {run.agentSnapshot.name} v{run.agentSnapshot.version}
                        </th>
                      ))}
                      <th>Score delta B − A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.runs[0]?.run.caseSnapshots.map((c) => {
                      const results = data.runs.map((d) =>
                        d.results.find((r) => r.caseId === c.id),
                      );
                      const changed =
                        results.length === 2 &&
                        results.every(Boolean) &&
                        (results[0]!.score !== results[1]!.score ||
                          results[0]!.metrics.toolCalls !== results[1]!.metrics.toolCalls);
                      return (
                        <tr key={c.id} className={changed ? 'changed-row' : ''}>
                          <td className="strong">{c.name}</td>
                          {results.map((r, i) => (
                            <td key={i}>
                              {r ? (
                                <>
                                  <Status value={r.outcome} />
                                  <small>
                                    {r.score} points · {r.metrics.toolCalls} calls ·{' '}
                                    {r.violations.length} violations
                                  </small>
                                </>
                              ) : (
                                'Pending'
                              )}
                            </td>
                          ))}
                          <td className="mono">
                            {results.every(Boolean)
                              ? (results[1]!.score - results[0]!.score).toFixed(1)
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
