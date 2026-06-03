export type PersistedGameState = {
    difficulty: 'Classic' | 'BrainTerror';
    puzzleDate: string;
    boardData: { id: string; value: number; isLocked?: boolean }[];
    lockedCells: { id: string; value: number; isLocked: true }[];
    cellNotes: Record<string, number[]>;
    gameTimer: number;      // seconds elapsed
    mistakes: number;
    score: number;
    completedFaces: string[];
    hintsUsed: number;
    savedAt: number;
};

const STORAGE_KEY_PREFIX = 'cubedoku_progress_';

// generate the localStorage key for a difficulty
function key(difficulty: 'Classic' | 'BrainTerror') {
    return `${STORAGE_KEY_PREFIX}${difficulty.toLowerCase()}`;
}

export function saveProgress(state: PersistedGameState): void {
    try {
        localStorage.setItem(key(state.difficulty), JSON.stringify(state));
    } catch { }
}

// load saved progress for a difficulty
// returns null if no save exists, or if the save data is invalid
export function loadProgress(difficulty: 'Classic' | 'BrainTerror'): PersistedGameState | null {
    try {
        const raw = localStorage.getItem(key(difficulty));
        if (!raw) return null;
        const parsed: PersistedGameState = JSON.parse(raw);

        // basic sanity check - if these don't exist the save is corrupted
        if (!parsed.boardData || !parsed.lockedCells) return null;

        if (parsed.lockedCells.length === 0) {
            localStorage.removeItem(key(difficulty));
            return null;
        }
        return parsed;
    } catch {
        // JSON.parse failed or something else went wrong
        return null;
    }
}

export function clearProgress(difficulty: 'Classic' | 'BrainTerror'): void {
    try {
        localStorage.removeItem(key(difficulty));
    } catch { }
}

// check if there's valid saved progress without loading the full object
export function hasProgress(difficulty: 'Classic' | 'BrainTerror'): boolean {
    return loadProgress(difficulty) !== null;
}

