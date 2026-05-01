// LeaderboardModal.tsx
// Shows the daily leaderboard for Classic and BrainTerror difficulty
//
// Data comes from GET /api/user/leaderboard?date=YYYY-MM-DD
// The API returns results for ALL difficulties on that date, and this component
// filters client-side based on the selected tab. Slightly wasteful but the total
// result set is small and it means we only make one request per modal open.
//
// Features:
//   - Tab switching between Classic and BrainTerror
//   - "You" row highlighted in a different color (identified by username match)
//   - "pinnedEntry" prop: allows the parent to pin the player's own result at the top
//     even if it hasn't been saved to the server yet (or if the server response is stale)
//   - Username resolution: falls back to decoding from localStorage token if AuthContext
//     isn't hydrated yet (can happen if leaderboard opens before auth is fully loaded)
//
// The username highlighting logic is a bit fragile - it relies on string matching which
// breaks if two users have the same username. I should add proper user ID comparison
// but the IDs aren't included in the leaderboard response right now.
// TODO: either add userId to leaderboard entries, or accept that identical usernames won't highlight correctly

import { useEffect, useState } from 'react';
import { useModalTransition } from './useModalTransition';
import { jwtDecode } from 'jwt-decode';
import { LuX } from 'react-icons/lu';
import { useAuth } from './context/AuthContext';
import './WelcomeModal.css';
import './ProfileModal.css';

// one row from the leaderboard API
interface LeaderboardEntry {
    username: string;
    difficulty: string;
    score: number;
    durationSeconds: number;
    mistakes: number;
    hintsUsed: number;
}

interface LeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab?: 'Classic' | 'BrainTerror';
    pinnedEntry?: LeaderboardEntry | null;   // player's own entry to pin at top if not in list yet
}

interface TokenClaims {
    unique_name?: string;
    [key: string]: unknown;
}

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const LeaderboardModal = ({
    isOpen,
    onClose,
    defaultTab = 'Classic',
    pinnedEntry = null
}: LeaderboardModalProps) => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'Classic' | 'BrainTerror'>('Classic');
    const [allData, setAllData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // fallback: if user isn't loaded from AuthContext yet, try decoding from localStorage
    // this can happen when the leaderboard is opened very quickly after page load
    const getLoggedInUsername = () => {
        if (user?.username) return user.username;
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const decoded = jwtDecode<TokenClaims>(token);
                // ASP.NET puts the name in a long claim URI OR in unique_name
                const claimName = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
                if (typeof claimName === 'string') return claimName;
                if (typeof decoded.unique_name === 'string') return decoded.unique_name;
            }
        } catch {
            return null;
        }
        return null;
    };

    const loggedInUsername = getLoggedInUsername();

    // sync the tab with the defaultTab prop (changes when the user selects a different difficulty in the welcome modal)
    useEffect(() => {
        setTab(defaultTab);
    }, [defaultTab, isOpen]);

    // fetch leaderboard data when the modal opens
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
        // cache: 'no-store' forces a fresh fetch each time the modal opens
        fetch(`/api/user/leaderboard?date=${today}`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : [])
            .then(data => setAllData(data))
            .catch(() => setAllData([]))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    // filter to just the current tab's difficulty
    const rows = allData.filter(e => e.difficulty === tab);

    // decide whether to show the pinned entry
    const shouldPin = pinnedEntry && pinnedEntry.difficulty === tab;
    const hasPinned = shouldPin && rows.some(e =>
        e.username === pinnedEntry.username &&
        e.difficulty === pinnedEntry.difficulty &&
        e.score === pinnedEntry.score &&
        e.durationSeconds === pinnedEntry.durationSeconds &&
        e.mistakes === pinnedEntry.mistakes &&
        e.hintsUsed === pinnedEntry.hintsUsed
    );
    // if the pinned entry isn't in the loaded data yet, prepend it manually
    const displayedRows = shouldPin && !hasPinned ? [pinnedEntry, ...rows] : rows;

    return (
        <div className={`leaderboard-modal${isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={onClose}>
            <div className={`leaderboard-content${isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="modal-back-btn" onClick={onClose} aria-label="Close Leaderboard">
                        <LuX size={20} />
                    </button>
                    <h2>Leaderboard</h2>
                </div>

                {/* Tab bar for Classic / Brain Terror */}
                <div className="lb-tabs">
                    <button
                        className={`lb-tab${tab === 'Classic' ? ' active' : ''}`}
                        onClick={() => setTab('Classic')}
                    >
                        Classic
                    </button>
                    <button
                        className={`lb-tab${tab === 'BrainTerror' ? ' active' : ''}`}
                        onClick={() => setTab('BrainTerror')}
                    >
                        Brain Terror
                    </button>
                </div>

                {loading ? (
                    <p className="lb-empty">Loading…</p>
                ) : displayedRows.length === 0 ? (
                    <p className="lb-empty">No scores yet. Be the first!</p>
                ) : (
                    <div className="leaderboard-table-wrap">
                        <table className="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Player</th>
                                    <th>Score</th>
                                    <th>Time</th>
                                    <th>Mistakes</th>
                                    <th>Hints</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedRows.map((entry, i) => {
                                    const isPlayerRow = loggedInUsername && entry.username === loggedInUsername;
                                    return (
                                        <tr key={i} className={isPlayerRow ? 'player-row' : ''}>
                                            <td>{i + 1}</td>
                                            <td>{entry.username}</td>
                                            <td>{entry.score}</td>
                                            <td>{formatTime(entry.durationSeconds)}</td>
                                            <td>{entry.mistakes}</td>
                                            <td>{entry.hintsUsed ?? 0}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        </div>
    );
};

