// ProfileModal.tsx
// Standalone "My Stats" modal - shows personal stats for the logged-in user
//
// This is separate from the inline stats panel in WelcomeModal.tsx
// (I know, they show the same data in basically the same layout - code duplication).
// The reason they're separate is that ProfileModal was planned as a reusable component
// that could be opened from other places in the app, not just the welcome screen.
// In practice it ended up only being used from WelcomeModal, so I could have kept just one.
// Too late to refactor now.
//
// Data comes from GET /api/user/stats - requires auth token

import { useState, useEffect } from 'react';
import { useModalTransition } from './useModalTransition';
import { useAuth } from './context/AuthContext';
import { LuX } from 'react-icons/lu';
import './ProfileModal.css';

interface DifficultyStats {
    games: number;
    bestScore: number;
    bestTime: number;       // seconds
    totalMistakes: number;
}

interface StatsData {
    totalGames: number;
    classic: DifficultyStats;
    brainTerror: DifficultyStats;
}

export interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
    const { user, token } = useAuth();
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(false);

    // fetch stats when the modal opens, clear when it closes
    useEffect(() => {
        if (!isOpen) {
            setStats(null);  // clear stats so they reload fresh next time
            return;
        }
        setLoading(true);
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        fetch('/api/user/stats', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(data => setStats(data))
            .catch(() => setStats(null))
            .finally(() => setLoading(false));
    }, [isOpen, token]);

    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    return (
        <div className={`profile-stats-overlay${isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={onClose}>
            <div className={`modal-content${isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="modal-back-btn" onClick={onClose} aria-label="Close">
                        <LuX size={20} />
                    </button>
                    <h3>My Stats</h3>
                </div>
                {user && <p className="modal-username">{user.username}</p>}
                
                {loading ? (
                    <p className="modal-loading">Loading stats…</p>
                ) : stats ? (
                    <div className="stats-container">
                        <p className="stats-total">Total Games: <strong>{stats.totalGames}</strong></p>
                        
                        <div className="stats-grid">
                            <div className="difficulty-stats">
                                <h4>Classic</h4>
                                <div className="stat-item">
                                    <span>Games:</span>
                                    <strong>{stats.classic.games}</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Best Score:</span>
                                    <strong>{stats.classic.bestScore}</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Best Time:</span>
                                    <strong>{formatTime(stats.classic.bestTime)}</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Total Mistakes:</span>
                                    <strong>{stats.classic.totalMistakes}</strong>
                                </div>
                            </div>

                            <div className="difficulty-stats">
                                <h4>Brain Terror</h4>
                                <div className="stat-item">
                                    <span>Games:</span>
                                    <strong>{stats.brainTerror.games}</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Best Score:</span>
                                    <strong>{stats.brainTerror.bestScore}</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Best Time:</span>
                                    <strong>{formatTime(stats.brainTerror.bestTime)}</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Total Mistakes:</span>
                                    <strong>{stats.brainTerror.totalMistakes}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="modal-loading">No stats yet. Play a game to get started!</p>
                )}
            </div>
        </div>
    );
};