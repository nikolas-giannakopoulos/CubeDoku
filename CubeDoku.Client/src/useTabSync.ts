/**
 * useTabSync — coordinates game sessions across browser tabs via BroadcastChannel.
 *
 * When a tab starts or continues a game it broadcasts GAME_STARTED.
 * Other tabs playing the same difficulty hear this and show a "paused" overlay.
 * If the paused tab clicks "Resume Here" it broadcasts GAME_RECLAIMED, which
 * causes the other tab to pause in turn.
 */
import { useEffect, useRef, useCallback } from 'react';

export type TabSyncMessage =
    | { type: 'GAME_STARTED';   difficulty: 'Classic' | 'BrainTerror' }
    | { type: 'GAME_RECLAIMED'; difficulty: 'Classic' | 'BrainTerror' };

interface TabSyncCallbacks {
    /** Another tab just started/continued the given difficulty. */
    onTakeover:  (difficulty: 'Classic' | 'BrainTerror') => void;
    /** Another tab reclaimed a session we had paused. */
    onReclaimed: (difficulty: 'Classic' | 'BrainTerror') => void;
}

export function useTabSync({ onTakeover, onReclaimed }: TabSyncCallbacks) {
    const channelRef    = useRef<BroadcastChannel | null>(null);
    // Keep callbacks in refs so the channel's onmessage handler is never stale.
    const takeoverRef   = useRef(onTakeover);
    const reclaimedRef  = useRef(onReclaimed);

    useEffect(() => { takeoverRef.current  = onTakeover;  }, [onTakeover]);
    useEffect(() => { reclaimedRef.current = onReclaimed; }, [onReclaimed]);

    useEffect(() => {
        if (!('BroadcastChannel' in window)) return;

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
    }, []); // register once — callbacks stay fresh via refs

    const broadcast = useCallback((msg: TabSyncMessage) => {
        channelRef.current?.postMessage(msg);
    }, []);

    return { broadcast };
}
