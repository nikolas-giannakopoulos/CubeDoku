// ThemeContext.tsx
// Manages light/dark theme preference globally
//
// Persists to localStorage so the theme is remembered between sessions
// Also reads the system preference (prefers-color-scheme) as the initial default
//
// The actual theming is done with a data-theme attribute on <html>
// and CSS variables defined in index.css for each theme
// This approach was simpler than using a CSS-in-JS solution or class toggling
//
// I also tried doing this with just a class on body but data-theme on html works better
// with the :root CSS variable approach

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        // check saved preference first, then fall back to system preference
        const saved = localStorage.getItem('themeMode') as Theme;
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    // whenever theme changes, update the data attribute on html AND save to localStorage
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('themeMode', theme);
    }, [theme]);

    const toggleTheme = () => {
        setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

