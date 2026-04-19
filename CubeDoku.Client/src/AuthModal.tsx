import { useState, useEffect } from 'react';
import { useModalTransition } from './useModalTransition';
import { useGoogleLogin } from '@react-oauth/google';
import { LuX, LuCircleCheck } from 'react-icons/lu';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from './context/AuthContext';
import './ProfileModal.css';

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
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSuccess(false);
            setBusy(false);
            setError('');
            setPassword('');
        }
    }, [isOpen]);

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                await loginWithGoogle(tokenResponse.access_token);
                setSuccess(true);
                setTimeout(() => {
                    onAuthSuccess?.();
                    onClose();
                }, 1500);
            } catch {
                setError('Google login failed.');
            }
        },
        onError: () => setError('Google login failed.'),
    });

    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    const switchMode = (next: 'login' | 'signup') => {
        setMode(next);
        setError('');
        setUsername('');
        setEmail('');
        setPassword('');
        setSuccess(false);
    };

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(username, email, password);
            }
            setSuccess(true);
            setTimeout(() => {
                onAuthSuccess?.();
                onClose();
            }, 1500);
        } catch (e: any) {
            setError(typeof e?.message === 'string' ? e.message : 'Authentication failed.');
            setBusy(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !busy) submit();
    };

    return (
        <div className={`auth-overlay${isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={onClose}>
            <div className={`auth-modal${isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                {/* Header */}
                <div className="modal-header">
                    <button className="modal-back-btn" onClick={onClose} aria-label="Close">
                        <LuX size={20} />
                    </button>
                    <h3>{mode === 'login' ? 'Log In' : 'Create Account'}</h3>
                </div>

                {success ? (
                    <div className="auth-success-container">
                        <LuCircleCheck size={64} className="auth-success-icon" />
                        <div className="auth-success-text">
                            {mode === 'login' ? 'Successfully logged in!' : 'Account created successfully!'}
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="auth-subtitle">
                            {mode === 'login'
                                ? 'Log in to save results and appear on leaderboards.'
                                : 'Sign up to track your stats and rank.'}
                        </p>

                        {/* Fields */}
                        {mode === 'signup' && (
                            <input
                                className="auth-input"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Username"
                                autoComplete="username"
                            />
                        )}
                        <input
                            className="auth-input"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Email"
                            autoComplete="email"
                        />
                        <input
                            className="auth-input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Password"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        />

                        {error && <p className="auth-error">{error}</p>}

                        {/* Primary action */}
                        <button className="auth-primary auth-submit" onClick={submit} disabled={busy}>
                            {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
                        </button>

                        {/* Divider */}
                        <div className="auth-divider">
                            <span>or</span>
                        </div>

                        {/* Google */}
                        <button className="auth-google-btn" onClick={() => googleLogin()} disabled={busy}>
                            <FcGoogle size={20} />
                            Continue with Google
                        </button>

                        {/* Switch mode */}
                        <p className="auth-switch">
                            {mode === 'login' ? (
                                <>Don't have an account?{' '}
                                    <button className="auth-switch-link" onClick={() => switchMode('signup')}>
                                        Create one
                                    </button>
                                </>
                            ) : (
                                <>Already have an account?{' '}
                                    <button className="auth-switch-link" onClick={() => switchMode('login')}>
                                        Log in
                                    </button>
                                </>
                            )}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
