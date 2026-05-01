// AuthContext.tsx
// Global authentication state management using React Context
//
// This provides login/register/logout functionality to any component in the tree
// without having to pass props down manually (prop drilling).
// I learned about Context API in my web dev course and this felt like the right use case.
//
// The token is stored in localStorage so it persists across page refreshes.
// I know localStorage isn't as secure as httpOnly cookies but:
//   1. We're using a short-lived JWT (60 min) so the window of exposure is small
//   2. Getting httpOnly cookies to work with Vite's dev proxy was more complicated
//      and I ran out of time to figure it out properly
//   3. My supervisor said it's acceptable for the project scope
//
// parseUserFromToken decodes the JWT on the client to extract user info
// without making another API call. The JWT claims include id, email, and username.
// ASP.NET uses long claim type URIs for standard claims, so I handle both the short
// version and the full URI version (that's what all the fallback ?? operators are for).

import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

// what user info we extract from the token
interface AuthUser {
    id: string;
    username: string;
    email: string;
}

// the shape of what useAuth() returns
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
    // initialize from localStorage so the user stays logged in across refreshes
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [user, setUser] = useState<AuthUser | null>(null);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    }, []);

    // decode the JWT to get user info - avoids an extra API call
    // the token contains all the user fields we need (set by AuthController.GenerateJwt)
    const parseUserFromToken = (jwt: string): AuthUser => {
        const decoded = jwtDecode<Record<string, string>>(jwt);

        // ASP.NET sends claim types as full URIs - handle both short and long forms
        const id = decoded.nameid ?? decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        const email = decoded.email ?? decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
        const username = decoded.unique_name ?? decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? decoded.name;

        if (!id || !email || !username) {
            throw new Error('Token missing required user claims.');
        }

        return { id, email, username };
    };

    // on mount (or token change): try to restore user state from stored token
    // if the token is invalid or expired, log out
    useEffect(() => {
        if (token) {
            try {
                setUser(parseUserFromToken(token));
            } catch {
                // token is malformed or missing claims - clear it
                logout();
            }
        } else {
            setUser(null);
        }
    }, [token, logout]);

    // save token to localStorage AND update state
    // called after any successful auth (login, register, google)
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

    return (
        <AuthContext.Provider value={{ user, token, login, register, loginWithGoogle, updateAuthToken: saveAuth, logout, isLoggedIn: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

// hook for consuming auth context - throws if used outside AuthProvider
// (rather than returning null which would cause confusing errors downstream)
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

