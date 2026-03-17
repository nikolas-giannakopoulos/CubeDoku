import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

interface AuthUser {
    id: string;
    username: string;
    email: string;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    loginWithGoogle: (idToken: string) => Promise<void>;
    updateAuthToken: (newToken: string) => void;
    logout: () => void;
    isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [user, setUser] = useState<AuthUser | null>(null);

    const parseUserFromToken = (jwt: string): AuthUser => {
        const decoded = jwtDecode<Record<string, string>>(jwt);
        const id = decoded.nameid ?? decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        const email = decoded.email ?? decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
        const username = decoded.unique_name ?? decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? decoded.name;

        if (!id || !email || !username) {
            throw new Error('Token missing required user claims.');
        }

        return { id, email, username };
    };

    // Restore user from token on page load
    useEffect(() => {
        if (token) {
            try {
                setUser(parseUserFromToken(token));
            } catch {
                logout();
            }
        } else {
            setUser(null);
        }
    }, [token]);

    const saveAuth = (newToken: string) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(parseUserFromToken(newToken));
    };

    const login = async (email: string, password: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        saveAuth(data.token);
    };

    const register = async (username: string, email: string, password: string) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        saveAuth(data.token);
    };

    const loginWithGoogle = async (idToken: string) => {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        saveAuth(data.token);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, loginWithGoogle, updateAuthToken: saveAuth, logout, isLoggedIn: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
