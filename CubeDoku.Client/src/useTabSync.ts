import { useEffect, useRef, useCallback } from 'react';

export type TabSyncMessage =
    | { type: 'GAME_STARTED'; difficulty: 'Classic' | 'BrainTerror' }
    | { type: 'GAME_RECLAIMED'; difficulty: 'Classic' | 'BrainTerror' };

interface TabSyncCallbacks {
    /* Another tab started/resumed the given difficulty - this tab should pause */
    onTakeover: (difficulty: 'Classic' | 'BrainTerror') => void;
    /* Another tab reclaimed the session - this tab was already paused */
    onReclaimed: (difficulty: 'Classic' | 'BrainTerror') => void;
}

export function useTabSync({ onTakeover, onReclaimed }: TabSyncCallbacks) {
    const channelRef = useRef<BroadcastChannel | null>(null);

    // store callbacks in refs so the onmessage handler always calls the latest version
    // without needing to be re-registered
    const takeoverRef = useRef(onTakeover);
    const reclaimedRef = useRef(onReclaimed);

    useEffect(() => { takeoverRef.current = onTakeover; }, [onTakeover]);
    useEffect(() => { reclaimedRef.current = onReclaimed; }, [onReclaimed]);

    useEffect(() => {
        if (!('BroadcastChannel' in window)) return;

        const channel = new BroadcastChannel('cubedoku_tab_sync');
        channelRef.current = channel;

        channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
            const msg = event.data;
            if (msg.type === 'GAME_STARTED') takeoverRef.current(msg.difficulty);
            if (msg.type === 'GAME_RECLAIMED') reclaimedRef.current(msg.difficulty);
        };

        return () => {
            channel.close();
            channelRef.current = null;
        };
    }, []);

    // broadcast a message to other tabs
    const broadcast = useCallback((msg: TabSyncMessage) => {
        channelRef.current?.postMessage(msg);
    }, []);

    return { broadcast };
}

