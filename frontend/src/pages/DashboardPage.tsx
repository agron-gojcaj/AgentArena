import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bot, ShieldCheck, Terminal } from 'lucide-react';
import { api } from '../services/api';
import { ErrorMessage, Loading, Metric, PageTitle, RunTable } from '../components/ui';
export default function DashboardPage() {
  const runs = useQuery({ queryKey: ['runs'], queryFn: api.runs, refetchInterval: 3000 });
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents });
  const completed = runs.data?.filter((r) => r.status === 'COMPLETED') || [];
  const finishedCases = (runs.data || []).reduce((sum, r) => sum + r.finishedCases, 0);
  const passedCases = (runs.data || []).reduce((sum, r) => sum + r.passedCases, 0);
  const average = completed.length
    ? (completed.reduce((sum, r) => sum + Number(r.score), 0) / completed.length).toFixed(1)
    : '—';
  return (
    <>
      <PageTitle
        eyebrow="THE TESTING GROUND"
        title="Better agents start here."
        action={
          <Link to="/scenarios" className="button primary">
            <Terminal size={16} /> Run a test <ArrowUpRight size={16} />
          </Link>
        }
      >
        Configure an agent. Put it to the test. Understand what happened.
      </PageTitle>
      <div className="metrics">
        <Metric
          label="RECENT RUNS"
          value={runs.data?.length ?? '—'}
          detail="Latest 50 executions"
        />
        <Metric
          label="AVERAGE SCORE"
          value={
            <>
              {average}
              <em>/100</em>
            </>
          }
          detail="Completed runs"
        />
        <Metric
          label="CASE PASS RATE"
          value={finishedCases ? `${Math.round((passedCases / finishedCases) * 100)}%` : '—'}
          detail={`${passedCases} / ${finishedCases} finished cases`}
        />
        <Metric
          label="ACTIVE RUNS"
          value={
            runs.data?.filter((r) => r.status === 'RUNNING' || r.status === 'QUEUED').length ?? '—'
          }
          detail="Queued + running"
        />
      </div>
      <section className="feature-grid">
        <div className="challenge-feature">
          <div className="eyebrow">
            <span className="tiny-dot" /> FEATURED CHALLENGE{' '}
            <span className="subtle-badge">01</span>
          </div>
          <div className="feature-content">
            <div>
              <h2>Refund Rescue</h2>
              <p>
                A refund request is simple.
                <br />
                Getting every decision right isn’t.
              </p>
              <div className="tags">
                <span>Customer support</span>
                <span>5 test cases</span>
                <span>4 tools</span>
              </div>
              <Link to="/scenarios" className="text-link">
                Explore the challenge <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flow-art" aria-hidden="true">
              <div>
                <Bot size={25} />
                <span>AGENT</span>
              </div>
              <i />
              <div>
                <ShieldCheck size={25} />
                <span>POLICY</span>
              </div>
              <i />
              <div>
                <Terminal size={25} />
                <span>RESULT</span>
              </div>
            </div>
          </div>
        </div>
        <div className="panel experiment">
          <div className="eyebrow">YOUR FIRST EXPERIMENT</div>
          <h3>
            Small prompt.
            <br />
            Measurable difference.
          </h3>
          <p>
            Compare a policy-breaking agent with a careful one. Watch the simulator reject an
            unauthorized refund.
          </p>
          <Link to="/agents" className="text-link">
            Open Agent Studio <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="panel">
        <div className="section-header">
          <h2>
            Recent executions <span className="count">{runs.data?.length ?? 0}</span>
          </h2>
          <span className="muted small">Automatically refreshed</span>
        </div>
        <ErrorMessage error={runs.error || agents.error} />
        {runs.isPending ? <Loading /> : <RunTable runs={runs.data || []} />}
      </section>
      <div className="principles">
        <span>
          <ShieldCheck size={16} /> Policy enforced by tools
        </span>
        <span>
          <Terminal size={16} /> Every action is inspectable
        </span>
        <span>
          <Bot size={16} /> Fake mode is free to run
        </span>
      </div>
    </>
  );
}
