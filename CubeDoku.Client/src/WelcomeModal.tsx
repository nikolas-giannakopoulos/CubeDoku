import { useState } from 'react';
import { useModalTransition } from './useModalTransition';
import './WelcomeModal.css';
import classicIcon from './assets/classic.png';
import brainterrorIcon from './assets/brainterror.png';
import { FaUser } from 'react-icons/fa';
import { MdLeaderboard } from 'react-icons/md';
import { LuX } from 'react-icons/lu';
import { useAuth } from './context/AuthContext';
import { LeaderboardModal } from './LeaderboardModal';
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
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [stats, setStats] = useState<any | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleStart = () => handleDifficultySelect(selectedDifficulty);

    const handleUserClick = () => setIsUserMenuOpen(!isUserMenuOpen);

    const handleOpenStats = async () => {
        setIsUserMenuOpen(false);
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
                {/* Top Right Buttons */}
                <div className="welcome-top-buttons">
                    <button className="welcome-icon-btn" title={isLoggedIn ? "User Menu" : "Sign Up"} onClick={handleUserClick}>
                        <FaUser size={18} />
                    </button>

                    {/* User Dropdown Menu */}
                    {isUserMenuOpen && (
                        <div className="user-dropdown">
                            {!isLoggedIn ? (
                                <div className="user-dropdown-item" onClick={() => {
                                    setIsUserMenuOpen(false);
                                    if (onAuthClick) onAuthClick();
                                }}>
                                    Sign Up / Login
                                </div>
                            ) : (
                                <>
                                    <div className="user-dropdown-item" onClick={handleOpenStats}>
                                        My Stats
                                    </div>
                                    <div className="user-dropdown-divider"></div>
                                    <div className="user-dropdown-item user-dropdown-logout" onClick={() => { logout(); setIsUserMenuOpen(false); }}>
                                        Logout
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Header */}
                <div className="welcome-header">
                    <h1>CubeDoku</h1>
                    <p className="subtitle">3D Sudoku on a Rubik's Cube</p>
                </div>

                <div className="welcome-content">
                    <div className="welcome-rules">
                        <h2>How to Play</h2>
                        <ul>
                            <li><strong>The Board:</strong> A 3D cube with 6 faces (3x3 each).</li>
                            <li><strong>The Rules:</strong>
                                <ul>
                                    <li>Every face must contain numbers 1-9.</li>
                                    <li>Every continuous band around the cube must not contain duplicate numbers.</li>
                                </ul>
                            </li>
                            <li><strong>Controls:</strong> Left-click and drag to rotate. Scroll to zoom. Click a number (right), then a cell to place it.</li>
                        </ul>
                    </div>

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
        </div>
    );
};
