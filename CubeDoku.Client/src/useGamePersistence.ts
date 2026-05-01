// useGamePersistence.ts
// Saves and loads in-progress puzzle state from localStorage
//
// This lets players close the tab mid-game and come back later to continue.
// Each difficulty has its own save slot (key format: cubedoku_progress_classic, etc.)
// so you can have a Classic in progress and a BrainTerror in progress simultaneously.
//
// What gets saved:
//   - boardData: all 54 cells with their current values
//   - lockedCells: which cells are the original puzzle clues (needed to reset vs continue)
//   - cellNotes: any pencil marks the player made
//   - gameTimer: elapsed time in seconds
//   - mistakes: how many errors the player made
//   - score: current score
//   - completedFaces: which faces are fully completed (for the completion animation tracking)
//   - hintsUsed: hint count (important: hints are excluded from score but tracked separately)
//   - savedAt: timestamp so we can detect stale saves (though currently we don't expire them)
//
// The puzzleDate field is used to detect if a save belongs to today's puzzle or an old one
// (if the date doesn't match, the save is outdated and should be discarded)
// That check happens in the CubeViewer component, not here.

export type PersistedGameState = {
    difficulty: 'Classic' | 'BrainTerror';
    /** ISO date string — which puzzle this state belongs to */
    puzzleDate: string;
    boardData: { id: string; value: number; isLocked?: boolean }[];
    lockedCells: { id: string; value: number; isLocked: true }[];
    cellNotes: Record<string, number[]>;
    gameTimer: number;      // seconds elapsed
    mistakes: number;
    score: number;
    completedFaces: string[];
    hintsUsed: number;
    savedAt: number;        // epoch ms - not currently used for expiry but might be later
};

const STORAGE_KEY_PREFIX = 'cubedoku_progress_';

// generate the localStorage key for a difficulty
function key(difficulty: 'Classic' | 'BrainTerror') {
    return `${STORAGE_KEY_PREFIX}${difficulty.toLowerCase()}`;
}

// save the current game state to localStorage
// silently fails if localStorage is full (some browsers have small quotas in private mode)
export function saveProgress(state: PersistedGameState): void {
    try {
        localStorage.setItem(key(state.difficulty), JSON.stringify(state));
    } catch {
        // quota exceeded or localStorage unavailable - just skip saving
        // the game still works, they just lose progress if they close the tab
    }
}

// load saved progress for a difficulty
// returns null if no save exists, or if the save data is malformed/invalid
export function loadProgress(difficulty: 'Classic' | 'BrainTerror'): PersistedGameState | null {
    try {
        const raw = localStorage.getItem(key(difficulty));
        if (!raw) return null;
        const parsed: PersistedGameState = JSON.parse(raw);

        // basic sanity check - if these don't exist the save is corrupted
        if (!parsed.boardData || !parsed.lockedCells) return null;

        // if lockedCells is empty, this is probably a placeholder or corrupted save
        // (a real puzzle always has some given cells)
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
    } catch { /* ignore */ }
}

// check if there's valid saved progress without loading the full object
export function hasProgress(difficulty: 'Classic' | 'BrainTerror'): boolean {
    return loadProgress(difficulty) !== null;
}

