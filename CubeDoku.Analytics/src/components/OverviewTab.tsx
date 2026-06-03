import type { Metrics } from '../types';

interface Props {
  metrics: Metrics | null;
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}λ ${s}δ` : `${s}δ`;
}

export default function OverviewTab({ metrics }: Props) {
  if (!metrics) return null;

  const totalClassic    = metrics.classic.games;
  const totalBrain      = metrics.brainTerror.games;
  const total           = metrics.totalGames;
  const splitPct        = total > 0 ? Math.round((totalClassic / total) * 100) : 0;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Σύνολο Παιχνιδιών</div>
          <div className="stat-card-value">{total.toLocaleString()}</div>
          <div className="stat-card-sub">Classic + BrainTerror</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Classic</div>
          <div className="stat-card-value success">{totalClassic.toLocaleString()}</div>
          <div className="stat-card-sub">{splitPct}% των παιχνιδιών</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">BrainTerror</div>
          <div className="stat-card-value danger">{totalBrain.toLocaleString()}</div>
          <div className="stat-card-sub">{100 - splitPct}% των παιχνιδιών</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Μέσος Χρόνος Classic</div>
          <div className="stat-card-value accent">{fmt(metrics.classic.avgTime)}</div>
          <div className="stat-card-sub">μέσος χρόνος επίλυσης</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Μέσος Χρόνος BrainTerror</div>
          <div className="stat-card-value accent">{fmt(metrics.brainTerror.avgTime)}</div>
          <div className="stat-card-sub">μέσος χρόνος επίλυσης</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Μέσα Λάθη</div>
          <div className="stat-card-value">
            {metrics.classic.avgMistakes} / {metrics.brainTerror.avgMistakes}
          </div>
          <div className="stat-card-sub">Classic / BrainTerror</div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Σύγκριση Δυσκολίας</div>
            <div className="card-desc">Αναλυτική αντιπαραβολή Classic έναντι BrainTerror</div>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Μέτρηση</th>
                <th>Classic</th>
                <th>BrainTerror</th>
                <th>Διαφορά</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text)' }}>Παιχνίδια</td>
                <td>{totalClassic}</td>
                <td>{totalBrain}</td>
                <td>—</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text)' }}>Μέσος Χρόνος</td>
                <td>{fmt(metrics.classic.avgTime)}</td>
                <td>{fmt(metrics.brainTerror.avgTime)}</td>
                <td style={{ color: 'var(--warning)' }}>
                  {metrics.brainTerror.avgTime > 0 && metrics.classic.avgTime > 0
                    ? `+${Math.round(((metrics.brainTerror.avgTime - metrics.classic.avgTime) / metrics.classic.avgTime) * 100)}%`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text)' }}>Μέσα Λάθη</td>
                <td>{metrics.classic.avgMistakes}</td>
                <td>{metrics.brainTerror.avgMistakes}</td>
                <td style={{ color: 'var(--danger)' }}>
                  {metrics.brainTerror.avgMistakes > 0 && metrics.classic.avgMistakes > 0
                    ? `+${Math.round(((metrics.brainTerror.avgMistakes - metrics.classic.avgMistakes) / metrics.classic.avgMistakes) * 100)}%`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text)' }}>Μέσα Hints</td>
                <td>{metrics.classic.avgHints}</td>
                <td>{metrics.brainTerror.avgHints}</td>
                <td style={{ color: 'var(--warning)' }}>
                  {metrics.brainTerror.avgHints > 0 && metrics.classic.avgHints > 0
                    ? `+${Math.round(((metrics.brainTerror.avgHints - metrics.classic.avgHints) / metrics.classic.avgHints) * 100)}%`
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
