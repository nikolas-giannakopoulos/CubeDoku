// Persists an in-progress puzzle to localStorage so players can continue
// after closing the tab. One save slot per difficulty.

export type PersistedGameState = {
    difficulty: 'Classic' | 'BrainTerror';
    /** ISO date string — which puzzle this state belongs to */
    puzzleDate: string;
    boardData: { id: string; value: number; isLocked?: boolean }[];
    lockedCells: { id: string; value: number; isLocked: true }[];
    cellNotes: Record<string, number[]>;
    gameTimer: number;
    mistakes: number;
    score: number;
    completedFaces: string[];
    hintsUsed: number;
    savedAt: number; // epoch ms
};

const STORAGE_KEY_PREFIX = 'cubedoku_progress_';

function key(difficulty: 'Classic' | 'BrainTerror') {
    return `${STORAGE_KEY_PREFIX}${difficulty.toLowerCase()}`;
}

export function saveProgress(state: PersistedGameState): void {
    try {
        localStorage.setItem(key(state.difficulty), JSON.stringify(state));
    } catch {
        // Silently ignore quota errors
    }
}

export function loadProgress(difficulty: 'Classic' | 'BrainTerror'): PersistedGameState | null {
    try {
        const raw = localStorage.getItem(key(difficulty));
        if (!raw) return null;
        const parsed: PersistedGameState = JSON.parse(raw);
        // Basic sanity check
        if (!parsed.boardData || !parsed.lockedCells) return null;
        // Discard stale saves that contain no real locked cells (e.g. placeholder board data)
        if (parsed.lockedCells.length === 0) {
            localStorage.removeItem(key(difficulty));
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function clearProgress(difficulty: 'Classic' | 'BrainTerror'): void {
    try {
        localStorage.removeItem(key(difficulty));
    } catch { /* ignore */ }
}

export function hasProgress(difficulty: 'Classic' | 'BrainTerror'): boolean {
    return loadProgress(difficulty) !== null;
}
