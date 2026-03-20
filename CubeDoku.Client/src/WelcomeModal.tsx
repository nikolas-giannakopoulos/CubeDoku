import { useState } from 'react';
import './WelcomeModal.css';
import classicIcon from './assets/classic.png';
import brainterrorIcon from './assets/brainterror.png';
import { FaUser } from 'react-icons/fa';
import { MdLeaderboard } from 'react-icons/md';
import { LuChevronLeft } from 'react-icons/lu';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from './context/AuthContext';
import { LeaderboardModal } from './LeaderboardModal';
import { SettingsModal } from './SettingsModal';
import './ProfileModal.css';

interface DifficultyStats {
    games: number;
    bestScore: number;
    bestTime: number;
    totalMistakes: number;
}

interface StatsData {
    totalGames: number;
    classic: DifficultyStats;
    brainTerror: DifficultyStats;
}

interface CellDTO {
    face: string;
    row: number;
    column: number;
    value: number;
}

export interface WelcomeModalProps {
    isOpen: boolean;
    onDifficultySelect: (difficulty: 'Classic' | 'BrainTerror', lockedCells: CellDTO[]) => void;
}

export const WelcomeModal = ({ isOpen, onDifficultySelect }: WelcomeModalProps) => {
    const { user, isLoggedIn, login, register, loginWithGoogle, logout, token } = useAuth();

    const [selectedDifficulty, setSelectedDifficulty] = useState<'Classic' | 'BrainTerror'>('Classic');
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [authView, setAuthView] = useState<'default' | 'signup' | 'login'>('default');
    const [stats, setStats] = useState<StatsData | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Form state
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Leaderboard state

    const handleStart = () => handleDifficultySelect(selectedDifficulty);

    const handleLeaderboardClick = () => setIsLeaderboardOpen(true);

    const handleUserClick = () => setIsUserMenuOpen(!isUserMenuOpen);

    const formatTime = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleAuthClick = (view: 'signup' | 'login') => {
        setAuthView(view);
        setIsUserMenuOpen(false);
        setAuthError('');
    };

    const handleBackToMenu = () => {
        setAuthView('default');
        setAuthError('');
        setEmail(''); setPassword(''); setUsername(''); setConfirmPassword('');
    };

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

    const handleSubmit = async () => {
        setAuthError('');
        setIsLoading(true);
        try {
            if (authView === 'signup') {
                if (password !== confirmPassword) {
                    setAuthError('Passwords do not match.');
                    return;
                }
                await register(username, email, password);
            } else {
                await login(email, password);
            }
            handleBackToMenu();
        } catch (err: any) {
            setAuthError(err.message || 'Something went wrong.');
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                // Pass access token to backend - backend verifies via Google userinfo API
                await loginWithGoogle(tokenResponse.access_token);
                handleBackToMenu();
            } catch {
                setAuthError('Google login failed.');
            }
        },
        onError: () => setAuthError('Google login failed.'),
    });

    // Guard MUST be after all hooks (Rules of Hooks).
    if (!isOpen) return null;

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
        <div className="welcome-modal-overlay">
            <div className="welcome-modal">
                {/* Top Right Buttons */}
                <div className="welcome-top-buttons">
                    <button className="welcome-icon-btn" title="Leaderboard" onClick={handleLeaderboardClick}>
                        <MdLeaderboard size={20} />
                    </button>
                    <button className="welcome-icon-btn" title={isLoggedIn ? "User Menu" : "Sign Up"} onClick={handleUserClick}>
                        <FaUser size={18} />
                    </button>

                    {/* User Dropdown Menu */}
                    {isUserMenuOpen && (
                        <div className="user-dropdown">
                            {!isLoggedIn ? (
                                <div className="user-dropdown-item" onClick={() => handleAuthClick('signup')}>
                                    Sign Up / Login
                                </div>
                            ) : (
                                <>
                                    <div className="user-dropdown-item" onClick={handleOpenStats}>
                                        My Stats
                                    </div>
                                    <div className="user-dropdown-divider"></div>
                                    <div className="user-dropdown-item" onClick={() => { setIsUserMenuOpen(false); setIsSettingsOpen(true); }}>
                                        Settings
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
                    <p className="subtitle">Master the Cube</p>
                </div>

                {authView === 'default' ? (
                    <>
                        {/* Rules Section */}
                        <div className="welcome-rules">
                            <h2>Rules</h2>
                            <ul>
                                <li>Each face must contain numbers 1-9 without repeats</li>
                                <li>Each edge and corner must sum to 12</li>
                            </ul>
                        </div>

                        {/* Difficulty Selection */}
                        <div className="welcome-difficulty">
                            <h2>Select Difficulty</h2>
                            <div className="difficulty-buttons">
                                <button
                                    className={`difficulty-btn ${selectedDifficulty === 'Classic' ? 'selected' : ''}`}
                                    onClick={() => setSelectedDifficulty('Classic')}
                                >
                                    <div className="difficulty-icon"><img src={classicIcon} alt="Classic" /></div>
                                    <div className="difficulty-name">Classic</div>
                                </button>
                                <button
                                    className={`difficulty-btn ${selectedDifficulty === 'BrainTerror' ? 'selected' : ''}`}
                                    onClick={() => setSelectedDifficulty('BrainTerror')}
                                >
                                    <div className="difficulty-icon"><img src={brainterrorIcon} alt="Brain Terror" /></div>
                                    <div className="difficulty-name">Brain Terror</div>
                                </button>
                            </div>
                        </div>

                        {/* Start Button */}
                        <button className="start-button" onClick={handleStart}>
                            Start Game
                        </button>
                    </>
                ) : (
                    <div className="auth-container">
                        <h2>{authView === 'signup' ? 'Create Account' : 'Welcome Back'}</h2>

                        <div className="auth-form">
                            {authView === 'signup' && (
                                <input
                                    type="text"
                                    placeholder="Username"
                                    className="auth-input"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            )}
                            <input
                                type="email"
                                placeholder="Email"
                                className="auth-input"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                className="auth-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            {authView === 'signup' && (
                                <input
                                    type="password"
                                    placeholder="Confirm Password"
                                    className="auth-input"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            )}

                            {authError && <div className="auth-error">{authError}</div>}

                            <button className="auth-action-btn" onClick={handleSubmit} disabled={isLoading}>
                                {isLoading ? 'Loading...' : authView === 'signup' ? 'Sign Up' : 'Log In'}
                            </button>

                            <div className="auth-divider"><span>or</span></div>

                            <button className="auth-google-btn" onClick={() => googleLogin()}>
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                                Continue with Google
                            </button>

                            <div className="auth-switch">
                                {authView === 'signup' ? (
                                    <p>Already have an account? <span onClick={() => setAuthView('login')}>Log In</span></p>
                                ) : (
                                    <p>Don't have an account? <span onClick={() => setAuthView('signup')}>Sign Up</span></p>
                                )}
                            </div>

                            <div className="auth-back">
                                <span onClick={handleBackToMenu}>Back to Menu</span>
                            </div>
                        </div>
                    </div>
                )}
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
                                <LuChevronLeft size={20} />
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
