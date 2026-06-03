import { useEffect, useMemo, useState } from 'react';
import { useModalTransition } from './useModalTransition';
import { LuX, LuVolume2, LuVolumeX } from 'react-icons/lu';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { pressAudio, errorAudio } from './audioManager';
import './ProfileModal.css';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenAuth?: () => void;
}

type Tab = 'game' | 'user';

const minPasswordLength = 8;

export const SettingsModal = ({ isOpen, onClose, onOpenAuth }: SettingsModalProps) => {
    const { theme, setTheme } = useTheme();
    const { user, token, isLoggedIn, logout, updateAuthToken } = useAuth();

    const [activeTab, setActiveTab] = useState<Tab>('game');
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Volume
    const [volume, setVolume] = useState<number>(() => {
        const stored = localStorage.getItem('sfx_volume');
        return stored !== null ? parseFloat(stored) : 1;
    });
    const [prevVolume, setPrevVolume] = useState<number>(1);
    const isMuted = volume === 0;

    // User settings
    const [usernameInput, setUsernameInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [verifyPassword, setVerifyPassword] = useState('');
    const [showVerifyPopup, setShowVerifyPopup] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [success, setSuccess] = useState('');

    const resolveProfileFromToken = () => {
        try {
            const raw = token ?? localStorage.getItem('token');
            if (!raw) return { username: '', email: '' };
            const payload = JSON.parse(atob(raw.split('.')[1]));
            const username = payload.unique_name
                ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                ?? '';
            const email = payload.email
                ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
                ?? '';
            return { username, email };
        } catch {
            return { username: '', email: '' };
        }
    };

    const tokenProfile = resolveProfileFromToken();
    const currentUsername = user?.username ?? tokenProfile.username;
    const currentEmail = user?.email ?? tokenProfile.email;

    useEffect(() => {
        if (!isOpen) {
            setShowVerifyPopup(false);
            setShowLogoutConfirm(false);
            setError('');
            setVerifyError('');
            setSuccess('');
            setActiveTab('game');
            return;
        }
        setUsernameInput(currentUsername);
        setNewPassword('');
        setVerifyPassword('');
        setError('');
        setVerifyError('');
        setSuccess('');
    }, [isOpen, currentUsername]);

    // Keep audio volumes in sync
    useEffect(() => {
        pressAudio.volume = volume;
        errorAudio.volume = volume;
        localStorage.setItem('sfx_volume', String(volume));
    }, [volume]);

    const handleVolumeChange = (val: number) => {
        setVolume(val);
    };

    const toggleMute = () => {
        if (isMuted) {
            setVolume(prevVolume > 0 ? prevVolume : 0.5);
        } else {
            setPrevVolume(volume);
            setVolume(0);
        }
    };

    // User settings logic 
    const hasUsernameChange = useMemo(() => {
        const next = usernameInput.trim();
        return next.length > 0 && next !== currentUsername;
    }, [usernameInput, currentUsername]);

    const hasPasswordChange = newPassword.trim().length > 0;

    const handleSubmit = async () => {
        setError('');
        setSuccess('');

        if (!hasUsernameChange && !hasPasswordChange) {
            setError('Please change your username or provide a new password.');
            return;
        }

        if (hasPasswordChange) {
            if (newPassword.trim().length < minPasswordLength) {
                setError('Password must be at least 8 characters.');
                return;
            }

            const authToken = token ?? localStorage.getItem('token');
            if (!authToken) {
                setError('You are not authenticated. Please log in again.');
                return;
            }

            try {
                const checkResponse = await fetch('/api/auth/profile/validate-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ newPassword: newPassword.trim() }),
                });

                if (!checkResponse.ok) {
                    const msg = await checkResponse.text();
                    setError(msg || 'Invalid new password.');
                    return;
                }
            } catch {
                setError('Could not validate new password right now.');
                return;
            }
        }

        setVerifyPassword('');
        setVerifyError('');
        setShowVerifyPopup(true);
    };

    const closeVerifyPopup = () => {
        setShowVerifyPopup(false);
        setVerifyPassword('');
        setVerifyError('');
    };

    const handleConfirmSave = async () => {
        setVerifyError('');
        setSuccess('');

        if (!verifyPassword.trim()) {
            setVerifyError('Current password is required to verify your identity.');
            return;
        }

        const authToken = token ?? localStorage.getItem('token');
        if (!authToken) {
            setError('You are not authenticated. Please log in again.');
            return;
        }

        setBusy(true);
        try {
            const response = await fetch('/api/auth/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    currentPassword: verifyPassword,
                    newUsername: hasUsernameChange ? usernameInput.trim() : null,
                    newPassword: hasPasswordChange ? newPassword : null,
                }),
            });

            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || `Update failed (${response.status}).`);
            }

            const data = await response.json();
            if (data?.token) {
                updateAuthToken(data.token);
            }

            setSuccess('Profile updated successfully.');
            setVerifyPassword('');
            setNewPassword('');
            setUsernameInput(data?.username ?? usernameInput.trim());
            setShowVerifyPopup(false);
            setVerifyError('');
        } catch (e: any) {
            const message = typeof e?.message === 'string' ? e.message : 'Could not update profile.';
            if (/current password is incorrect/i.test(message)) {
                setVerifyError(message);
            } else {
                setError(message);
                setShowVerifyPopup(false);
            }
        } finally {
            setBusy(false);
        }
    };

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        logout();
        setShowLogoutConfirm(false);
        onClose();
    };

    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    return (
        <div className={`profile-stats-overlay${isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={onClose}>
            <div className={`modal-content settings-modal-content${isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="modal-back-btn" onClick={onClose} aria-label="Close settings">
                        <LuX size={20} />
                    </button>
                    <h3>Settings</h3>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`settings-tab${activeTab === 'game' ? ' active' : ''}`}
                        onClick={() => setActiveTab('game')}
                    >
                        Game
                    </button>
                    <button
                        className={`settings-tab${activeTab === 'user' ? ' active' : ''}`}
                        onClick={() => setActiveTab('user')}
                    >
                        Account
                    </button>
                </div>

                {activeTab === 'game' && (
                    <div className="settings-form">
                        <div className="settings-theme-block">
                            <label className="settings-label">Theme</label>
                            <div className="settings-theme-row" role="group" aria-label="Theme selection">
                                <button
                                    type="button"
                                    className={`settings-theme-btn${theme === 'dark' ? ' active' : ''}`}
                                    onClick={() => setTheme('dark')}
                                >
                                    🌙 Dark
                                </button>
                                <button
                                    type="button"
                                    className={`settings-theme-btn${theme === 'light' ? ' active' : ''}`}
                                    onClick={() => setTheme('light')}
                                >
                                    ☀️ Light
                                </button>
                            </div>
                        </div>

                        <div className="settings-volume-block">
                            <label className="settings-label">Sound Effects</label>
                            <div className="settings-volume-row">
                                <button
                                    type="button"
                                    className="settings-volume-icon-btn"
                                    onClick={toggleMute}
                                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? <LuVolumeX size={18} /> : <LuVolume2 size={18} />}
                                </button>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={volume}
                                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                    className="settings-volume-slider"
                                    aria-label="Volume"
                                />
                                <span className="settings-volume-pct">
                                    {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
                                </span>
                            </div>
                        </div>

                        {isLoggedIn && (
                            <>
                                <div className="settings-footer-divider" />
                                <button className="settings-logout-btn" onClick={handleLogout}>
                                    Log Out
                                </button>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'user' && (
                    <div className="settings-form">
                        {isLoggedIn ? (
                            <>
                                <label className="settings-label">Username</label>
                                <input
                                    className="settings-input"
                                    type="text"
                                    value={usernameInput}
                                    onChange={(e) => setUsernameInput(e.target.value)}
                                    placeholder="Username"
                                />

                                <label className="settings-label">Email</label>
                                <input
                                    className="settings-input settings-input-readonly"
                                    type="email"
                                    value={currentEmail}
                                    readOnly
                                />

                                <label className="settings-label">Change Password</label>
                                <input
                                    className="settings-input"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Leave empty to keep current password"
                                />

                                {error && <p className="settings-error">{error}</p>}
                                {success && <p className="settings-success">{success}</p>}

                                <button className="settings-submit" onClick={handleSubmit} disabled={busy}>
                                    {busy ? 'Saving...' : 'Save Changes'}
                                </button>

                                <div className="settings-footer-divider" />
                                <button className="settings-logout-btn" onClick={handleLogout}>
                                    Log Out
                                </button>
                            </>
                        ) : (
                            <div className="settings-guest-cta">
                                <p className="settings-guest-text">Log in to manage your account, track stats, and appear on leaderboards.</p>
                                <button
                                    className="settings-login-btn"
                                    onClick={() => { onClose(); onOpenAuth?.(); }}
                                >
                                    Log In / Sign Up
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showVerifyPopup && (
                <div className="verify-popup-overlay" onClick={closeVerifyPopup}>
                    <div className="verify-popup" onClick={(e) => e.stopPropagation()}>
                        <h4>Verify Identity</h4>
                        <p>Please enter your current password to confirm these changes.</p>
                        <input
                            className="settings-input"
                            type="password"
                            value={verifyPassword}
                            onChange={(e) => setVerifyPassword(e.target.value)}
                            placeholder="Current password"
                            autoFocus
                        />
                        {verifyError && <p className="settings-error verify-error">{verifyError}</p>}
                        <div className="verify-actions">
                            <button className="settings-submit verify-confirm" onClick={handleConfirmSave} disabled={busy}>
                                {busy ? 'Verifying...' : 'Confirm'}
                            </button>
                            <button className="verify-cancel" onClick={closeVerifyPopup} disabled={busy}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLogoutConfirm && (
                <div className="verify-popup-overlay" onClick={() => setShowLogoutConfirm(false)}>
                    <div className="verify-popup" onClick={(e) => e.stopPropagation()}>
                        <h4>Log Out?</h4>
                        <p>Are you sure you want to log out?</p>
                        <div className="verify-actions">
                            <button className="settings-logout-btn verify-confirm" onClick={confirmLogout}>
                                Log Out
                            </button>
                            <button className="verify-cancel" onClick={() => setShowLogoutConfirm(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
