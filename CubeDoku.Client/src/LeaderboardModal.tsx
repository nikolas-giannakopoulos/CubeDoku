import { useEffect, useState } from 'react';
import { useModalTransition } from './useModalTransition';
import { jwtDecode } from 'jwt-decode';
import { LuX } from 'react-icons/lu';
import { useAuth } from './context/AuthContext';
import './WelcomeModal.css';
import './ProfileModal.css';

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
    pinnedEntry?: LeaderboardEntry | null;
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

    // Fallback to decode username from token if user context isn't loaded yet
    const getLoggedInUsername = () => {
        if (user?.username) return user.username;
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const decoded = jwtDecode<TokenClaims>(token);
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

    useEffect(() => {
        setTab(defaultTab);
    }, [defaultTab, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
        fetch(`/api/user/leaderboard?date=${today}`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : [])
            .then(data => setAllData(data))
            .catch(() => setAllData([]))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    const rows = allData.filter(e => e.difficulty === tab);
    const shouldPin = pinnedEntry && pinnedEntry.difficulty === tab;
    const hasPinned = shouldPin && rows.some(e =>
        e.username === pinnedEntry.username &&
        e.difficulty === pinnedEntry.difficulty &&
        e.score === pinnedEntry.score &&
        e.durationSeconds === pinnedEntry.durationSeconds &&
        e.mistakes === pinnedEntry.mistakes &&
        e.hintsUsed === pinnedEntry.hintsUsed
    );
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
