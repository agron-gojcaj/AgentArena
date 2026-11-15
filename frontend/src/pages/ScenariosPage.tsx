import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Wrench, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { ErrorMessage, Loading, PageTitle } from '../components/ui';
import RunControls from '../components/RunControls';
export default function ScenariosPage() {
  const scenario = useQuery({
    queryKey: ['scenario', 'refund-rescue'],
    queryFn: () => api.scenario('refund-rescue'),
  });
  return (
    <>
      <PageTitle eyebrow="CHALLENGE LIBRARY / 01" title="Refund Rescue">
        One real-world workflow. Five ways to test your agent’s judgment.
      </PageTitle>
      <ErrorMessage error={scenario.error} />
      {scenario.isPending ? (
        <Loading />
      ) : (
        scenario.data && (
          <div className="scenario-grid">
            <div>
              <section className="panel scenario-intro">
                <div className="tags">
                  <span className="accent">CUSTOMER SUPPORT</span>
                  <span>{scenario.data.difficulty}</span>
                  <span>Version {scenario.data.version}</span>
                </div>
                <h2>
                  Can your agent make
                  <br />
                  the right call?
                </h2>
                <p>{scenario.data.description}</p>
                <blockquote>
                  “I need to cancel my appointment.
                  <br />
                  Can you refund my payment?”
                </blockquote>
                <div className="field-label">
                  <ShieldCheck size={16} /> RULES OF THE ARENA
                </div>
                <ul className="rule-list">
                  {scenario.data.rules.map((rule) => (
                    <li key={rule}>
                      <ChevronRight size={15} />
                      {rule}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="panel padded">
                <h2>
                  <Wrench size={17} /> The toolkit
                </h2>
                <div className="tool-list">
                  {scenario.data.tools.map((tool, i) => (
                    <div key={tool}>
                      <span className="mono muted">0{i + 1}</span>
                      <code>{tool}</code>
                    </div>
                  ))}
                </div>
                <p className="muted small">
                  Tools operate on fictional bookings. Authorization is enforced even when the agent
                  tries to bypass it.
                </p>
              </section>
              <section className="panel padded">
                <h2>What’s being measured</h2>
                <div className="weight-bars">
                  {[
                    ['Task completion', 50],
                    ['Policy compliance', 30],
                    ['Tool quality', 10],
                    ['Efficiency', 10],
                  ].map(([label, weight]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <div>
                        <i style={{ width: `${weight}%` }} />
                      </div>
                      <strong className="mono">{weight}%</strong>
                    </div>
                  ))}
                </div>
                <p className="muted small">
                  Policy violations produce POLICY_FAILED and cap the score at 60.
                </p>
              </section>
            </div>
            <aside className="panel">
              <RunControls scenario={scenario.data} />
            </aside>
          </div>
        )
      )}
    </>
  );
}
