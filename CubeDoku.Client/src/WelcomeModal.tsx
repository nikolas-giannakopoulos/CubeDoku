import { useState, useEffect } from 'react';
import { useModalTransition } from './useModalTransition';
import { useTheme } from './context/ThemeContext';
import './WelcomeModal.css';
import classicDark from './assets/classic_dark.png';
import classicLight from './assets/classic_light.png';
import brainterrorDark from './assets/brainterror_dark.png';
import brainterrorLight from './assets/brainterror_light.png';
import { FaExclamationTriangle, FaPlay } from 'react-icons/fa';
import { MdLeaderboard } from 'react-icons/md';
import { LuX, LuCircleHelp, LuUser, LuLogIn, LuLogOut } from 'react-icons/lu';
import { useAuth } from './context/AuthContext';
import { LeaderboardModal } from './LeaderboardModal';
import { HowToPlayModal } from './HowToPlayModal';
import { SettingsModal } from './SettingsModal';
import { type PersistedGameState } from './useGamePersistence';
import './ProfileModal.css';

// the shape of a locked cell from the API
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
    exitToAuth?: boolean;    // when true, the welcome modal exits left (towards auth modal)
    savedProgress?: Partial<Record<'Classic' | 'BrainTerror', PersistedGameState>>;
    onContinue?: (state: PersistedGameState) => void;
}

// format seconds as MM:SS for the "Best today" display
const formatTime = (seconds: number | undefined | null): string => {
    if (seconds == null || isNaN(seconds)) return '—';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

export const WelcomeModal = ({ isOpen, onDifficultySelect, onAuthClick, exitToAuth, savedProgress, onContinue }: WelcomeModalProps) => {
    const { isLoggedIn, logout, token, user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [selectedDifficulty, setSelectedDifficulty] = useState<'Classic' | 'BrainTerror'>('Classic');
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isLogoutWarningOpen, setIsLogoutWarningOpen] = useState(false);
    const [stats, setStats] = useState<any | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [todayBest, setTodayBest] = useState<{ classic: number | null; brainTerror: number | null } | null>(null);

    const handleStart = () => handleDifficultySelect(selectedDifficulty);

    // fetch today's personal best times when the modal opens (for logged-in users)
    // shown under each difficulty card as "Best today: MM:SS"
    useEffect(() => {
        if (!isLoggedIn || !token || !isOpen) return;
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        fetch('/api/user/today-best', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) setTodayBest({ classic: data.classic ?? data.Classic ?? null, brainTerror: data.brainTerror ?? data.BrainTerror ?? null });
            })
            .catch(() => { });
    }, [isLoggedIn, token, isOpen]);

    // load stats when the stats panel opens
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

    // fetch the puzzle from the API when the player starts
    // the server returns the locked (given) cells which we pass up to the parent
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
            <div className={`welcome-modal${isClosing ? (exitToAuth ? ' modal-panel-exit-left' : ' modal-panel-exit') : ' modal-panel-enter'}`}>
                <div className="welcome-header">
                    <h1>CubeDoku</h1>
                </div>

                <div className="welcome-top-left-buttons">
                    <button className="welcome-text-btn" onClick={() => setIsLeaderboardOpen(true)}>
                        <MdLeaderboard size={16} />
                        <span className="welcome-btn-label">Leaderboard</span>
                    </button>
                    <button className="welcome-text-btn" onClick={() => setIsHowToPlayOpen(true)}>
                        <LuCircleHelp size={16} />
                        <span className="welcome-btn-label">How to Play</span>
                    </button>
                </div>

                <div className="welcome-top-buttons">
                    {!isLoggedIn ? (
                        <button className="welcome-text-btn" onClick={() => { if (onAuthClick) onAuthClick(); }}>
                            <LuLogIn size={16} />
                            Log in
                        </button>
                    ) : (
                        <>
                            <button className="welcome-text-btn" onClick={handleOpenStats}>
                                <LuUser size={16} />
                                My Stats
                            </button>
                            <button className="welcome-text-btn logout-btn" onClick={() => setIsLogoutWarningOpen(true)}>
                                <LuLogOut size={16} />
                                Log out
                            </button>
                        </>
                    )}
                </div>
                <div className="welcome-content" style={{ marginTop: '48px' }}>

                    <div className="welcome-difficulty">
                        <h2>Select Difficulty</h2>
                        <div className="difficulty-buttons">
                            <div className="difficulty-wrapper">
                                <div
                                    className={`difficulty-btn ${selectedDifficulty === 'Classic' ? 'selected' : ''}`}
                                    onClick={() => setSelectedDifficulty('Classic')}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedDifficulty('Classic')}
                                >
                                    <div className="difficulty-icon">
                                        <img src={isDark ? classicDark : classicLight} alt="Classic" />
                                    </div>
                                    <div className="difficulty-name">Classic</div>
                                    <div className="difficulty-desc">Standard rules. Good for beginners.</div>
                                    {savedProgress?.['Classic'] && onContinue && (
                                        <button
                                            id="continue-classic-btn"
                                            className="continue-attempt-btn"
                                            onClick={(e) => { e.stopPropagation(); onContinue(savedProgress['Classic']!); }}
                                        >
                                            <FaPlay size={10} />
                                            Continue — {formatTime(savedProgress['Classic']!.gameTimer)}
                                        </button>
                                    )}
                                </div>
                                {isLoggedIn && todayBest?.classic != null && (
                                    <div className="difficulty-today-best-line">
                                        Best today: {formatTime(todayBest.classic)}
                                    </div>
                                )}
                            </div>

                            <div className="difficulty-wrapper">
                                <div
                                    className={`difficulty-btn ${selectedDifficulty === 'BrainTerror' ? 'selected' : ''}`}
                                    onClick={() => setSelectedDifficulty('BrainTerror')}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedDifficulty('BrainTerror')}
                                >
                                    <div className="difficulty-icon">
                                        <img src={isDark ? brainterrorDark : brainterrorLight} alt="Brain Terror" />
                                    </div>
                                    <div className="difficulty-name">Brain Terror</div>
                                    <div className="difficulty-desc">Fewer clues. For truly deranged minds.</div>
                                    {savedProgress?.['BrainTerror'] && onContinue && (
                                        <button
                                            id="continue-brainTerror-btn"
                                            className="continue-attempt-btn"
                                            onClick={(e) => { e.stopPropagation(); onContinue(savedProgress['BrainTerror']!); }}
                                        >
                                            <FaPlay size={10} />
                                            Continue — {formatTime(savedProgress['BrainTerror']!.gameTimer)}
                                        </button>
                                    )}
                                </div>
                                {isLoggedIn && todayBest?.brainTerror != null && (
                                    <div className="difficulty-today-best-line">
                                        Best today: {formatTime(todayBest.brainTerror)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <button className="start-button" onClick={handleStart}>
                        Start Puzzle
                    </button>
                </div>
            </div>

            <LeaderboardModal
                isOpen={isLeaderboardOpen}
                onClose={() => setIsLeaderboardOpen(false)}
                defaultTab={selectedDifficulty}
            />

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

