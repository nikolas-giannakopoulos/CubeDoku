import { useState } from 'react';
import { useModalTransition } from './useModalTransition';
import './WelcomeModal.css';
import classicIcon from './assets/classic.png';
import brainterrorIcon from './assets/brainterror.png';
import { FaExclamationTriangle } from 'react-icons/fa';
import { LuX } from 'react-icons/lu';
import { useAuth } from './context/AuthContext';
import { LeaderboardModal } from './LeaderboardModal';
import { HowToPlayModal } from './HowToPlayModal';
import { SettingsModal } from './SettingsModal';
import './ProfileModal.css';

interface CellDTO {
    face: string;
    row: number;
    column: number;
    value: number;
}

export interface WelcomeModalProps {
    isOpen: boolean;
    onDifficultySelect: (difficulty: 'Classic' | 'BrainTerror', lockedCells: CellDTO[]) => void;
    onAuthClick?: () => void;
}

const formatTime = (seconds: number): string => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

export const WelcomeModal = ({ isOpen, onDifficultySelect, onAuthClick }: WelcomeModalProps) => {
    const { isLoggedIn, logout, token, user } = useAuth();

    const [selectedDifficulty, setSelectedDifficulty] = useState<'Classic' | 'BrainTerror'>('Classic');
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isLogoutWarningOpen, setIsLogoutWarningOpen] = useState(false);
    const [stats, setStats] = useState<any | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleStart = () => handleDifficultySelect(selectedDifficulty);

    const handleOpenStats = async () => {
        setIsStatsOpen(true);
        setStatsLoading(true);
        try {
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch('/api/user/stats', { headers });
            if (!response.ok) throw new Error('Could not load stats');
            const data = await response.json();
            setStats(data);
        } catch {
            setStats(null);
        } finally {
            setStatsLoading(false);
        }
    };

    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    const handleDifficultySelect = async (difficulty: 'Classic' | 'BrainTerror') => {
        try {
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`/api/game/start?difficulty=${difficulty}`, { method: 'GET', headers });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to start game (${response.status}): ${errText}`);
            }
            const data = await response.json();
            console.log('[WelcomeModal] game/start response:', data);
            const lockedCells = data.lockedCells ?? data.LockedCells ?? [];
            if (lockedCells.length === 0) {
                console.warn('[WelcomeModal] lockedCells is empty — check API response shape');
            }
            onDifficultySelect(difficulty, lockedCells);
        } catch (error) {
            console.error('Error starting game:', error);
        }
    };

    return (
        <div className={`welcome-modal-overlay${isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`}>
            <div className={`welcome-modal${isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`}>
                {/* Top Left Buttons */}
                <div className="welcome-top-left-buttons">
                    <button className="welcome-text-btn" onClick={() => setIsLeaderboardOpen(true)}>
                        Leaderboard
                    </button>
                    <button className="welcome-text-btn" onClick={() => setIsHowToPlayOpen(true)}>
                        How to Play
                    </button>
                </div>

                {/* Top Right Buttons */}
                <div className="welcome-top-buttons">
                    {!isLoggedIn ? (
                        <button className="welcome-text-btn" onClick={() => { if (onAuthClick) onAuthClick(); }}>
                            Log in
                        </button>
                    ) : (
                        <>
                            <button className="welcome-text-btn" onClick={handleOpenStats}>
                                My Stats
                            </button>
                            <button className="welcome-text-btn logout-btn" onClick={() => setIsLogoutWarningOpen(true)}>
                                Log out
                            </button>
                        </>
                    )}
                </div>

                {/* Header */}
                <div className="welcome-header">
                    <h1>CubeDoku</h1>
                    <p className="subtitle">3D Sudoku on a Rubik's Cube</p>
                </div>

                <div className="welcome-content">

                    <div className="welcome-difficulty">
                        <h2>Select Difficulty</h2>
                        <div className="difficulty-buttons">
                            <button
                                className={`difficulty-btn ${selectedDifficulty === 'Classic' ? 'selected' : ''}`}
                                onClick={() => setSelectedDifficulty('Classic')}
                            >
                                <div className="difficulty-icon">
                                    <img src={classicIcon} alt="Classic" />
                                </div>
                                <div className="difficulty-name">Classic</div>
                                <div className="difficulty-desc">Standard rules. Good for beginners.</div>
                            </button>
                            <button
                                className={`difficulty-btn ${selectedDifficulty === 'BrainTerror' ? 'selected' : ''}`}
                                onClick={() => setSelectedDifficulty('BrainTerror')}
                            >
                                <div className="difficulty-icon">
                                    <img src={brainterrorIcon} alt="Brain Terror" />
                                </div>
                                <div className="difficulty-name">Brain Terror</div>
                                <div className="difficulty-desc">Fewer clues. For truly deranged minds.</div>
                            </button>
                        </div>
                    </div>

                    <button className="start-button" onClick={handleStart}>
                        Start Puzzle
                    </button>
                </div>
            </div>
            {/* Leaderboard Modal */}
            <LeaderboardModal
                isOpen={isLeaderboardOpen}
                onClose={() => setIsLeaderboardOpen(false)}
                defaultTab={selectedDifficulty}
            />

            {/* How to Play Modal */}
            <HowToPlayModal
                isOpen={isHowToPlayOpen}
                onClose={() => setIsHowToPlayOpen(false)}
            />

            {isStatsOpen && (
                <div className="profile-stats-overlay" onClick={() => setIsStatsOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <button className="modal-back-btn" onClick={() => setIsStatsOpen(false)} aria-label="Close stats">
                                <LuX size={20} />
                            </button>
                            <h3>My Stats</h3>
                        </div>

                        {user && <p className="modal-username">{user.username}</p>}

                        {statsLoading ? (
                            <p className="modal-loading">Loading stats...</p>
                        ) : stats ? (
                            <div className="stats-container">
                                <p className="stats-total">Total Games: <strong>{stats.totalGames}</strong></p>
                                <div className="stats-grid">
                                    <div className="difficulty-stats">
                                        <h4>Classic</h4>
                                        <div className="stat-item"><span>Games:</span><strong>{stats.classic.games}</strong></div>
                                        <div className="stat-item"><span>Best Score:</span><strong>{stats.classic.bestScore}</strong></div>
                                        <div className="stat-item"><span>Best Time:</span><strong>{formatTime(stats.classic.bestTime)}</strong></div>
                                        <div className="stat-item"><span>Total Mistakes:</span><strong>{stats.classic.totalMistakes}</strong></div>
                                    </div>
                                    <div className="difficulty-stats">
                                        <h4>Brain Terror</h4>
                                        <div className="stat-item"><span>Games:</span><strong>{stats.brainTerror.games}</strong></div>
                                        <div className="stat-item"><span>Best Score:</span><strong>{stats.brainTerror.bestScore}</strong></div>
                                        <div className="stat-item"><span>Best Time:</span><strong>{formatTime(stats.brainTerror.bestTime)}</strong></div>
                                        <div className="stat-item"><span>Total Mistakes:</span><strong>{stats.brainTerror.totalMistakes}</strong></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="modal-loading">Could not load stats right now.</p>
                        )}
                    </div>
                </div>
            )}

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* Logout Warning Modal */}
            {isLogoutWarningOpen && (
                <div className="logout-warning-overlay">
                    <div className="logout-warning-modal">
                        <FaExclamationTriangle size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
                        <h3>Log out</h3>
                        <p>Are you sure you want to log out?</p>
                        <div className="logout-warning-buttons">
                            <button className="logout-cancel-btn" onClick={() => setIsLogoutWarningOpen(false)}>
                                Cancel
                            </button>
                            <button className="logout-confirm-btn" onClick={() => {
                                logout();
                                setIsLogoutWarningOpen(false);
                            }}>
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
