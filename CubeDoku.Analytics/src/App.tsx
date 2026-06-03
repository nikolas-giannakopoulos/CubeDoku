import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import OverviewTab from './components/OverviewTab';
import ResearchTab from './components/ResearchTab';
import AuditTab from './components/AuditTab';
import type { Tab, Metrics, AuditLog } from './types';
import { API_BASE } from './config';

const TAB_TITLE: Record<Tab, string> = {
  overview: 'Γενικά',
  research: 'Γραφήματα',
  audit:    'Ιστορικό',
};

export default function App() {
  const [tab, setTab]         = useState<Tab>('overview');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/analytics/metrics`).then(r => r.json()),
      fetch(`${API_BASE}/api/analytics/audit`).then(r => r.json()),
    ])
      .then(([m, l]) => {
        setMetrics(m);
        setLogs(l);
      })
      .catch(() => setError('Αδυναμία σύνδεσης με τον server. Βεβαιωθείτε ότι το backend τρέχει.'))
      .finally(() => setLoading(false));
  }, []);

  function exportCSV() {
    if (logs.length === 0) return;
    const headers = ['Username','Difficulty','PuzzleDate','Score','DurationSeconds','Mistakes','HintsUsed','CompletedAt'];
    const rows    = logs.map(l => [
      l.username, l.difficulty, l.puzzleDate,
      l.score, l.durationSeconds, l.mistakes, l.hintsUsed, l.completedAt,
    ]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `cubedoku_dataset_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="layout">
        <Sidebar activeTab={tab} onTabChange={setTab} />
        <div className="main">
          <div className="loading-state">
            <div className="spinner" />
            Φόρτωση δεδομένων…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar activeTab={tab} onTabChange={setTab} />

      <div className="main">
        {/* Topbar */}
        <div className="topbar">
          <span className="topbar-title">{TAB_TITLE[tab]}</span>
          <div className="topbar-actions">
            {error && (
              <span style={{ fontSize: '12px', color: 'var(--danger)' }}>⚠ {error}</span>
            )}

          </div>
        </div>

        {/* Content */}
        <div className="content">
          {tab === 'overview' && <OverviewTab metrics={metrics} />}
          {tab === 'research' && <ResearchTab metrics={metrics} onExportCSV={exportCSV} />}
          {tab === 'audit'    && <AuditTab logs={logs} />}
        </div>
      </div>
    </div>
  );
}
