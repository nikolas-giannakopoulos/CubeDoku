import { useEffect, useMemo, useState } from 'react';
import { LuChevronLeft } from 'react-icons/lu';
import { useAuth } from './context/AuthContext';
import './ProfileModal.css';

interface UserSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserSettingsModal = ({ isOpen, onClose }: UserSettingsModalProps) => {
    const { user, token, updateAuthToken } = useAuth();
    const [usernameInput, setUsernameInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [verifyPassword, setVerifyPassword] = useState('');
    const [showVerifyPopup, setShowVerifyPopup] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [success, setSuccess] = useState('');

    const minPasswordLength = 8;

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
        if (isOpen) {
            setUsernameInput(currentUsername);
            setNewPassword('');
            setVerifyPassword('');
            setShowVerifyPopup(false);
            setError('');
            setVerifyError('');
            setSuccess('');
        }
    }, [isOpen, currentUsername]);

    const hasUsernameChange = useMemo(() => {
        const next = usernameInput.trim();
        return next.length > 0 && next !== currentUsername;
    }, [usernameInput, currentUsername]);

    const hasPasswordChange = newPassword.trim().length > 0;

    const resetFields = () => {
        setUsernameInput(currentUsername);
        setNewPassword('');
        setVerifyPassword('');
        setShowVerifyPopup(false);
        setError('');
        setVerifyError('');
        setSuccess('');
    };

    const handleClose = () => {
        resetFields();
        onClose();
    };

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

    if (!isOpen) return null;

    return (
        <div className="profile-stats-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="modal-back-btn" onClick={handleClose} aria-label="Close user settings">
                        <LuChevronLeft size={20} />
                    </button>
                    <h3>User Settings</h3>
                </div>

                <div className="settings-form">
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

                    <label className="settings-label">Change password</label>
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
            </div>
        </div>
    );
};
