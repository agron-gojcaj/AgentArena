import { NavLink, Route, Routes, Link } from 'react-router-dom';
import {
  Activity,
  Bot,
  Boxes,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  ArrowUpRight,
} from 'lucide-react';
import DashboardPage from './pages/DashboardPage';
import AgentStudioPage from './pages/AgentStudioPage';
import ScenariosPage from './pages/ScenariosPage';
import RunDetailsPage from './pages/RunDetailsPage';
import ComparisonPage from './pages/ComparisonPage';
const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/agents', label: 'Agent Studio', icon: Bot },
  { to: '/scenarios', label: 'Challenges', icon: Boxes },
  { to: '/comparisons', label: 'Comparisons', icon: GitCompareArrows },
];
export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <FlaskConical size={21} />
          </span>
          Agent<span>Arena</span>
          <sup>β</sup>
        </Link>
        <div className="workspace-label">
          WORKSPACE <span>LOCAL</span>
        </div>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <Activity size={18} />
          <strong>Built for the experiment.</strong>
          <p>Every decision. Every tool call. A clearer picture of your agent.</p>
          <span className="mono">v0.1 / local workspace</span>
        </div>
        <div className="local-state">
          <i /> Simulated environment
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <span>
            <span className="muted">Workspace</span> <span className="slash">/</span> AgentArena
          </span>
          <span className="topbar-right">
            <span className="keycap">DEV</span> Local only <ArrowUpRight size={14} />
          </span>
        </div>
        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agents" element={<AgentStudioPage />} />
            <Route path="/scenarios" element={<ScenariosPage />} />
            <Route path="/runs/:id" element={<RunDetailsPage />} />
            <Route path="/comparisons" element={<ComparisonPage />} />
            <Route path="/comparisons/:id" element={<ComparisonPage />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found</h1>
                  <Link to="/">Return to the overview</Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer>
          AGENTARENA <span>Build. Test. Debug. Improve.</span>
          <span>All business operations are simulated.</span>
        </footer>
      </div>
    </div>
  );
}
