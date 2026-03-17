import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from './context/AuthContext';

export interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
    const { login, register, loginWithGoogle } = useAuth();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                await loginWithGoogle(tokenResponse.access_token);
                onAuthSuccess?.();
                onClose();
            } catch {
                setError('Google login failed.');
            }
        },
        onError: () => setError('Google login failed.'),
    });

    if (!isOpen) return null;

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(username, email, password);
            }
            onAuthSuccess?.();
            onClose();
        } catch (e: any) {
            setError(typeof e?.message === 'string' ? e.message : 'Authentication failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={e => e.stopPropagation()}>
                <div className="auth-mode-switch">
                    <button className={`auth-mode-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
                        Log In
                    </button>
                    <button className={`auth-mode-btn ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>
                        Sign Up
                    </button>
                </div>
                <h3>{mode === 'login' ? 'Log In' : 'Create Account'}</h3>
                <p className="auth-subtitle">
                    {mode === 'login'
                        ? 'Log in to save puzzle results to the leaderboard.'
                        : 'Sign up to save puzzle results and track your rank.'}
                </p>

                {mode === 'signup' && (
                    <input
                        className="auth-input"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Username"
                    />
                )}

                <input
                    className="auth-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email"
                />

                <input
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                />

                {error && <p className="auth-error">{error}</p>}

                <div className="auth-actions">
                    <button className="auth-primary" onClick={submit} disabled={busy}>
                        {busy ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
                    </button>
                    <button className="auth-secondary" onClick={() => googleLogin()} disabled={busy}>
                        Continue with Google
                    </button>
                </div>
            </div>
        </div>
    );
}
