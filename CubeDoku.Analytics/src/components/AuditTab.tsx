import { useState } from 'react';
import type { AuditLog } from '../types';

interface Props {
  logs: AuditLog[];
}

type SortKey = 'difficulty' | 'puzzleDate' | 'score' | 'durationSeconds' | 'mistakes' | 'hintsUsed' | 'completedAt';
type SortDir = 'asc' | 'desc';

function fmtSecs(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const SORT_ICON = {
  none: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.3 }}>
      <path d="M5 2L8 5H2L5 2Z" fill="currentColor"/>
      <path d="M5 8L2 5H8L5 8Z" fill="currentColor"/>
    </svg>
  ),
  asc: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 2L8 6H2L5 2Z" fill="currentColor" opacity="1"/>
      <path d="M5 8L2 5H8L5 8Z" fill="currentColor" opacity="0.25"/>
    </svg>
  ),
  desc: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 2L8 5H2L5 2Z" fill="currentColor" opacity="0.25"/>
      <path d="M5 8L2 5H8L5 8Z" fill="currentColor" opacity="1"/>
    </svg>
  ),
};

export default function AuditTab({ logs }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function iconFor(key: SortKey) {
    if (sortKey !== key) return SORT_ICON.none;
    return sortDir === 'asc' ? SORT_ICON.asc : SORT_ICON.desc;
  }

  const sorted = [...logs].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const as = String(av);
    const bs = String(bv);
    return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });

  function SortTh({ children, col }: { children: React.ReactNode; col: SortKey }) {
    return (
      <th
        className="th-sortable"
        onClick={() => handleSort(col)}
        title={`Ταξινόμηση κατά ${children}`}
      >
        <span className="th-inner">
          {children}
          <span className="sort-icon">{iconFor(col)}</span>
        </span>
      </th>
    );
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <div className="table-toolbar-title">
          Ιστορικό Παιχνιδιών
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
          Τελευταίες {logs.length} εγγραφές
          {sortKey && (
            <button
              onClick={() => setSortKey(null)}
              style={{
                marginLeft: '10px',
                background: 'none',
                border: 'none',
                color: 'var(--accent-2)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ✕ Αφαίρεση ταξινόμησης
            </button>
          )}
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Παίκτης</th>
              <SortTh col="difficulty">Δυσκολία</SortTh>
              <SortTh col="puzzleDate">Ημ. Παζλ</SortTh>
              <SortTh col="score">Σκορ</SortTh>
              <SortTh col="durationSeconds">Χρόνος</SortTh>
              <SortTh col="mistakes">Λάθη</SortTh>
              <SortTh col="hintsUsed">Hints</SortTh>
              <SortTh col="completedAt">Ολοκλήρωση</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>
                  Δεν υπάρχουν εγγραφές ακόμα.
                </td>
              </tr>
            ) : (
              sorted.map((log, idx) => (
                <tr key={log.id}>
                  <td style={{ color: 'var(--text-3)' }}>{idx + 1}</td>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>{log.username}</td>
                  <td>
                    <span className={`badge ${log.difficulty === 'Classic' ? 'badge-classic' : 'badge-brainterror'}`}>
                      {log.difficulty}
                    </span>
                  </td>
                  <td>{log.puzzleDate}</td>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>{log.score.toLocaleString()}</td>
                  <td>{fmtSecs(log.durationSeconds)}</td>
                  <td style={{ color: log.mistakes > 5 ? 'var(--danger)' : 'inherit' }}>{log.mistakes}</td>
                  <td>{log.hintsUsed}</td>
                  <td style={{ fontSize: '12px' }}>{log.completedAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
