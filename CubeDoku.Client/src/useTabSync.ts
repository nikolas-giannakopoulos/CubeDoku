// useTabSync.ts
// Coordinates game sessions across browser tabs using BroadcastChannel API
//
// Problem: if you open two tabs with the same game, both try to run simultaneously.
// This causes issues because they both have different timer states, both save to the same
// localStorage slot, and they could end up with conflicting board states.
//
// Solution: when a tab starts playing, it broadcasts to all other tabs.
// The other tabs show a "paused" overlay and stop their timer.
// The paused tab can "reclaim" the session which pauses the first tab in turn.
//
// BroadcastChannel is a browser API that lets pages from the same origin communicate.
// It's fairly new (didn't exist in IE obviously) but has good support in modern browsers.
// I added a check for it since the feature silently does nothing if unsupported.
//
// The ref pattern here is important: the onmessage handler in the BroadcastChannel
// would capture stale closures if we didn't use refs. This is a subtle React + async bug
// that I spent a while debugging before finding the solution on the React docs.
//
// Tab sync messages:
//   GAME_STARTED: this tab just started or resumed playing [difficulty]
//   GAME_RECLAIMED: this tab is taking over a session that another tab had paused

import { useEffect, useRef, useCallback } from 'react';

export type TabSyncMessage =
    | { type: 'GAME_STARTED';   difficulty: 'Classic' | 'BrainTerror' }
    | { type: 'GAME_RECLAIMED'; difficulty: 'Classic' | 'BrainTerror' };

interface TabSyncCallbacks {
    /** Another tab started/resumed the given difficulty - this tab should pause */
    onTakeover:  (difficulty: 'Classic' | 'BrainTerror') => void;
    /** Another tab reclaimed the session - this tab was already paused */
    onReclaimed: (difficulty: 'Classic' | 'BrainTerror') => void;
}

export function useTabSync({ onTakeover, onReclaimed }: TabSyncCallbacks) {
    const channelRef    = useRef<BroadcastChannel | null>(null);

    // store callbacks in refs so the onmessage handler always calls the latest version
    // without needing to be re-registered (which would cause a brief gap in message handling)
    const takeoverRef   = useRef(onTakeover);
    const reclaimedRef  = useRef(onReclaimed);

    useEffect(() => { takeoverRef.current  = onTakeover;  }, [onTakeover]);
    useEffect(() => { reclaimedRef.current = onReclaimed; }, [onReclaimed]);

    useEffect(() => {
        if (!('BroadcastChannel' in window)) return; // graceful degradation for old browsers

        const channel = new BroadcastChannel('cubedoku_tab_sync');
        channelRef.current = channel;

        channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
            const msg = event.data;
            if (msg.type === 'GAME_STARTED')   takeoverRef.current(msg.difficulty);
            if (msg.type === 'GAME_RECLAIMED')  reclaimedRef.current(msg.difficulty);
        };

        return () => {
            channel.close();
            channelRef.current = null;
        };
    }, []); // register once - callbacks stay fresh via refs (see comment above)

    // broadcast a message to other tabs
    // using useCallback so this function reference is stable (won't cause infinite re-renders)
    const broadcast = useCallback((msg: TabSyncMessage) => {
        channelRef.current?.postMessage(msg);
    }, []);

    return { broadcast };
}

