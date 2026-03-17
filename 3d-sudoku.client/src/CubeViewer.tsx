import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Clone, Center } from '@react-three/drei';
import { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { MdLeaderboard } from 'react-icons/md';
import { LuRefreshCw, LuUndo2, LuEraser, LuLightbulb, LuSettings, LuCircleHelp } from 'react-icons/lu';
import { FaGithub } from 'react-icons/fa';
import { handleGithub, handleHowToPlay, handleSettings } from './extraHandlers';
import { ProfileModal } from './ProfileModal';
import { WelcomeModal } from './WelcomeModal';
import { AuthModal } from './AuthModal';
import { LeaderboardModal } from './LeaderboardModal';
import { SettingsModal } from './SettingsModal';
import { useAuth } from './context/AuthContext';
import './UI.css';

type BoardCell = { id: string; value: number; state?: string; isLocked?: boolean };
type LeaderboardRow = {
    rank: number;
    username: string;
    score: number;
    durationSeconds: number;
    mistakes: number;
    isPlayer?: boolean;
    hint?: string;
};

type CompletionSummary = {
    durationSeconds: number;
    mistakes: number;
    score: number;
    difficulty: 'Classic' | 'BrainTerror';
    puzzleDate: string;
    playerName: string;
    rank?: number;
    startRank?: number;
    totalPlayers?: number;
    nearbyRows?: LeaderboardRow[];
    saved: boolean;
    saveError?: string;
};

type RevealRow = {
    rank: number;
    username: string;
    score: number;
    durationSeconds: number;
    mistakes: number;
    isPlayer: boolean;
    slot: 1 | 2 | 3;
    startSlot?: 1 | 2 | 3;
    hint?: string;
};


function CubeModel({
    selectedNumber,
    mockBoardData,
    onMove,
    conflictedFaces,
    lockedCellIds
}: {
    selectedNumber: number | 'eraser' | null;
    mockBoardData: BoardCell[];
    onMove: (cellId: string, value: number) => void;
    conflictedFaces: Set<string>;
    lockedCellIds: Set<string>;
}) {
    // timestamp to force reload, or just a version number
    const { scene, nodes, materials } = useGLTF('/cube.glb') as any;


    // Hide the original asset meshes so they don't appear in their default export location
    // We only want to show them where we explicitly place them
    useEffect(() => {
        Object.keys(nodes).forEach(nodeName => {
            if (nodeName.startsWith('Asset_Num_')) {
                nodes[nodeName].visible = false;
            }
        });
    }, [nodes]);

    // Effect to apply error materials.
    // Two independent layers:
    //   1. Face conflicts   — every cell on the face (including empty) turns red.
    //   2. Edge/corner conflicts — only the specific server-reported cells turn red.
    useEffect(() => {
        if (!materials) return;

        // Reset all face cells to the default material.
        Object.keys(nodes).forEach((nodeName) => {
            if (['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'].some(face => nodeName.startsWith(face))) {
                const node = nodes[nodeName];
                if (node && (node as any).material) {
                    (node as any).material = materials.Cell_Material;
                }
            }
        });

        // Layer 1: colour ALL cells on each conflicted face (empty cells included).
        Object.keys(nodes).forEach((nodeName) => {
            const face = nodeName.split('_')[0];
            if (conflictedFaces.has(face)) {
                const node = nodes[nodeName];
                if (node && (node as any).material) {
                    (node as any).material = materials.Cell_Fail;
                }
            }
        });

        // Layer 2: colour individual cells with server-reported edge/corner errors.
        mockBoardData.forEach(data => {
            const node = nodes[data.id];
            if (node && (node as any).material && data.state === 'Error') {
                (node as any).material = materials.Cell_Fail;
            }
        });
    }, [mockBoardData, conflictedFaces, nodes, materials]);

    // Mock data for demonstration - this will eventually come from the backend

    // Returns the inward-facing unit vector for a face, derived from the cell name.
    // Cell names are like "Front_0_1", "Left_2_2", etc.
    const getFaceInward = (name: string): [number, number, number] => {
        // Strip 'Number_' prefix — number group names are like 'Number_Front_0_1'
        const faceName = name.startsWith('Number_') ? name.slice(7) : name;
        if (faceName.startsWith('Front')) return [0, 0, 1];
        if (faceName.startsWith('Back')) return [0, 0, -1];
        if (faceName.startsWith('Left')) return [-1, 0, 0];
        if (faceName.startsWith('Right')) return [1, 0, 0];
        if (faceName.startsWith('Top')) return [0, -1, 0];
        if (faceName.startsWith('Bottom')) return [0, 1, 0];
        return [0, 0, 0];
    };

    // Helper to animate cell and its number
    const animateCell = (cellMesh: any, direction: 'in' | 'out') => {
        if (!cellMesh.userData.originalPos) {
            cellMesh.userData.originalPos = cellMesh.position.clone();
        }

        const originalPos = cellMesh.userData.originalPos;
        const pressDistance = 0.07;

        if (direction === 'in') {
            const [dx, dy, dz] = getFaceInward(cellMesh.name);
            cellMesh.position.set(
                originalPos.x + dx * pressDistance,
                originalPos.y + dy * pressDistance,
                originalPos.z + dz * pressDistance,
            );
        } else {
            cellMesh.position.copy(originalPos);
        }
    };

    const groupRef = useRef<any>(null);
    // Track pointer-down position so we can distinguish a click from a drag.
    const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

    const getClickedCellId = (e: any): string | undefined => {
        const clickedMesh = e.object;
        const parentGroup = clickedMesh.parent;
        let cellID = clickedMesh?.name;
        if (!cellID || !cellID.includes('_')) {
            cellID = parentGroup?.name;
        }
        return cellID;
    };

    const isPrimaryClick = (e: any): boolean => {
        const native = e.nativeEvent ?? e;
        // button can be undefined on touch/pointer events; treat as primary.
        return native.button === undefined || native.button === 0;
    };

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        if (!isPrimaryClick(e)) return;

        // Record screen position so onClick can detect a drag later.
        const native = e.nativeEvent ?? e;
        pointerDownPos.current = { x: native.clientX, y: native.clientY };

        const clickedMesh = e.object;
        const name = clickedMesh.name;
        const cellID = getClickedCellId(e);
        if (cellID && lockedCellIds.has(cellID)) return;
        if (name && name.includes('_')) {
            animateCell(clickedMesh, 'in');

            if (groupRef.current) {
                const numberGroup = groupRef.current.getObjectByName('Number_' + name);
                if (numberGroup) {
                    animateCell(numberGroup, 'in');
                }
            }
        }
    };

    const handlePointerUp = (e: any) => {
        e.stopPropagation();
        const clickedMesh = e.object;
        const name = clickedMesh.name;
        if (name && name.includes('_')) {
            animateCell(clickedMesh, 'out');

            if (groupRef.current) {
                const numberGroup = groupRef.current.getObjectByName('Number_' + name);
                if (numberGroup) {
                    animateCell(numberGroup, 'out');
                }
            }
        }
    };

    const handlePointerOut = (e: any) => {
        e.stopPropagation();
        const clickedMesh = e.object;
        const name = clickedMesh.name;
        if (name && name.includes('_')) {
            animateCell(clickedMesh, 'out');

            if (groupRef.current) {
                const numberGroup = groupRef.current.getObjectByName('Number_' + name);
                if (numberGroup) {
                    animateCell(numberGroup, 'out');
                }
            }
        }
    };

    return (
        <group ref={groupRef}>
            <primitive
                object={scene}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerOut={handlePointerOut}
                onContextMenu={(e: any) => {
                    e.stopPropagation();
                    const native = e.nativeEvent ?? e;
                    if (native.preventDefault) native.preventDefault();
                }}
                onClick={(e: any) => {
                    e.stopPropagation();
                    if (!isPrimaryClick(e)) return;

                    // If the pointer moved more than 5px since mousedown, the user
                    // was rotating the cube — don't place a number.
                    const native = e.nativeEvent ?? e;
                    if (pointerDownPos.current) {
                        const dx = native.clientX - pointerDownPos.current.x;
                        const dy = native.clientY - pointerDownPos.current.y;
                        if (Math.sqrt(dx * dx + dy * dy) > 5) return;
                    }

                    const cellID = getClickedCellId(e);

                    if (cellID) {
                        if (lockedCellIds.has(cellID)) return;
                        if (selectedNumber === 'eraser') {
                            onMove(cellID, 0); // 0 means erase
                        } else if (typeof selectedNumber === 'number') {
                            onMove(cellID, selectedNumber);
                        }
                    }
                }}
            />
            {mockBoardData.map((data) => {
                const cellNode = nodes[data.id];
                const assetNode = nodes[`Asset_Num_${data.value}`];
                const isLocked = lockedCellIds.has(data.id) || !!data.isLocked;

                if (!cellNode || !assetNode) return null;
                let addPosX = 0, addPosY = 0, addPosZ = 0, addRotX = 0, addRotY = 0, addRotZ = 0;
                if (cellNode.name.startsWith('Front')) {
                    addPosZ = -0.38;
                    addRotX = Math.PI;
                    addRotZ = Math.PI;
                }
                if (cellNode.name.startsWith('Back')) {
                    addPosZ = 0.38;
                }
                if (cellNode.name.startsWith('Left')) {
                    addPosX = 0.38;
                    addRotY = Math.PI / 2;
                }
                if (cellNode.name.startsWith('Right')) {
                    addPosX = -0.38;
                    addRotY = - Math.PI / 2;
                }
                if (cellNode.name.startsWith('Top')) {
                    addPosY = 0.38;
                    addRotX = Math.PI / 2;
                    addRotY = Math.PI;
                }
                if (cellNode.name.startsWith('Bottom')) {
                    addPosY = -0.38;
                    addRotX = Math.PI / 2;
                    addRotZ = Math.PI;
                }
                return (
                    <Center
                        key={data.id}
                        position={[
                            cellNode.position.x + addPosX,
                            cellNode.position.y + addPosY,
                            cellNode.position.z + addPosZ,
                        ]}
                        rotation={[addRotX, addRotY, addRotZ]}
                        name={'Number_' + data.id} // Add name for lookup
                    >
                        <group
                            name={'Number_Group_' + data.id}
                            scale={isLocked ? [1.12, 1.12, 1.12] : [1, 1, 1]}
                        >
                            <Clone
                                object={assetNode}
                                visible={true}
                                raycast={() => null} // Disable raycast on numbers
                            />
                        </group>
                    </Center>
                );
            })}
        </group>
    );
}


function CubeViewer() {
    const { isLoggedIn, token, logout, user } = useAuth();

    const [selectedNumber, setSelectedNumber] = useState<number | 'eraser' | null>(null);
    const [mockBoardData, setMockBoardData] = useState<BoardCell[]>([
        { id: 'Left_1_2', value: 2 },
        { id: 'Bottom_1_2', value: 4 },
        { id: 'Top_1_1', value: 9 },
    ]);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
    const [_selectedDifficulty, setSelectedDifficulty] = useState<'Classic' | 'BrainTerror'>('Classic');
    const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);

    // Stores the original locked cells so we can reset to them on Start Over
    const lockedCellsRef = useRef<{ id: string; value: number; isLocked: true }[]>([]);

    // --- Undo history ---
    type HistoryEntry = {
        boardData: { id: string; value: number; isLocked?: boolean }[];
        mistakes: number;
        score: number;
        completedFaces: Set<string>;
    };
    const lastMoveRef = useRef<HistoryEntry | null>(null);
    const [canUndo, setCanUndo] = useState(false);

    // --- Game tracking ---
    const gameStartTimeRef = useRef<number>(0);
    const lastActionTimeRef = useRef<number>(0);
    const mistakesRef = useRef<number>(0);
    const scoreRef = useRef<number>(0);
    const completedFacesRef = useRef<Set<string>>(new Set());
    const currentDifficultyRef = useRef<'Classic' | 'BrainTerror'>('Classic');
    const puzzleDateRef = useRef<string>('');
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [gameTimer, setGameTimer] = useState(0);
    const [currentScore, setCurrentScore] = useState(0);
    const [isSolved, setIsSolved] = useState(false);
    const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
    const [rankAnimationStarted, setRankAnimationStarted] = useState(false);
    const [hasCompletionAuthSuccess, setHasCompletionAuthSuccess] = useState(false);

    const formatDuration = (durationSeconds: number): string => {
        return `${Math.floor(durationSeconds / 60).toString().padStart(2, '0')}:${(durationSeconds % 60).toString().padStart(2, '0')}`;
    };

    const getRevealRows = (summary: CompletionSummary): RevealRow[] => {
        const rows = [...(summary.nearbyRows ?? [])].sort((a, b) => a.rank - b.rank);
        const player = rows.find(r => r.isPlayer) ?? {
            rank: summary.rank ?? 0,
            username: summary.playerName,
            score: summary.score,
            durationSeconds: summary.durationSeconds,
            mistakes: summary.mistakes,
            isPlayer: true
        };

        const above = rows.filter(r => !r.isPlayer && r.rank < player.rank).sort((a, b) => b.rank - a.rank);
        const below = rows.filter(r => !r.isPlayer && r.rank > player.rank).sort((a, b) => a.rank - b.rank);

        const totalPlayers = summary.totalPlayers ?? rows.length;
        const isFirst = player.rank === 1;
        const isLast = player.rank >= totalPlayers;

        if (isFirst) {
            const row2 = below[0] ?? player;
            const row3 = below[1] ?? below[0] ?? player;
            return [
                { ...player, isPlayer: true, slot: 1, startSlot: 2 },
                { ...row2, isPlayer: false, slot: 2 },
                { ...row3, isPlayer: false, slot: 3 },
            ];
        }

        if (isLast) {
            const row1 = above[1] ?? above[0] ?? player;
            const row2 = above[0] ?? player;
            return [
                { ...row1, isPlayer: false, slot: 1 },
                { ...row2, isPlayer: false, slot: 2 },
                { ...player, isPlayer: true, slot: 3, startSlot: 3 },
            ];
        }

        const row1 = above[0] ?? player;
        const row3 = below[0] ?? player;
        return [
            { ...row1, isPlayer: false, slot: 1 },
            { ...player, isPlayer: true, slot: 2, startSlot: 3 },
            { ...row3, isPlayer: false, slot: 3 },
        ];
    };

    const startGameFromServer = async (difficulty: 'Classic' | 'BrainTerror') => {
        try {
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`/api/game/start?difficulty=${difficulty}`, { method: 'GET', headers });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to start game (${response.status}): ${errText}`);
            }
            const data = await response.json();
            const lockedCells = data.lockedCells ?? data.LockedCells ?? [];
            handleDifficultySelect(difficulty, lockedCells);
            setCompletionSummary(null);
            setHasCompletionAuthSuccess(false);
        } catch (error) {
            console.error('Error starting game:', error);
        }
    };

    const saveCompletionSummary = async (summary: CompletionSummary) => {
        const sendCompleteRequest = async (authToken: string) => {
            return await fetch('/api/user/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({
                    difficulty: summary.difficulty,
                    puzzleDate: summary.puzzleDate,
                    durationSeconds: summary.durationSeconds,
                    mistakes: summary.mistakes,
                    score: summary.score
                })
            });
        };

        const initialToken = localStorage.getItem('token') ?? token;
        if (!initialToken) throw new Error('Not authenticated yet.');

        let response = await sendCompleteRequest(initialToken);

        if (response.status === 401 || response.status === 403) {
            const latestToken = localStorage.getItem('token') ?? token;
            if (latestToken && latestToken !== initialToken) {
                response = await sendCompleteRequest(latestToken);
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401 || response.status === 403) {
                logout();
                throw new Error(errorText || 'Your session expired. Please log in again.');
            }
            throw new Error(errorText || `Save failed (${response.status}).`);
        }

        const saveData = await response.json();
        setCompletionSummary({
            ...summary,
            saved: true,
            saveError: undefined,
            rank: saveData.rank,
            startRank: saveData.startRank,
            totalPlayers: saveData.totalPlayers,
            nearbyRows: saveData.nearbyRows,
            playerName: saveData.username ?? user?.username ?? summary.playerName
        });
        setHasCompletionAuthSuccess(false);
    };

    // Timer — starts when game begins, stops when solved
    useEffect(() => {
        if (!isWelcomeOpen && !isSolved && gameStartTimeRef.current > 0) {
            timerIntervalRef.current = setInterval(() => {
                setGameTimer(Math.floor((Date.now() - gameStartTimeRef.current) / 1000));
            }, 1000);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isWelcomeOpen, isSolved]);

    useEffect(() => {
        if (!completionSummary?.rank || !completionSummary?.startRank) return;

        setRankAnimationStarted(false);
        const timer = setTimeout(() => setRankAnimationStarted(true), 250);
        return () => clearTimeout(timer);
    }, [completionSummary]);

    // If the player solved as guest and then logs in, save that solved result automatically.
    useEffect(() => {
        if (!completionSummary || completionSummary.saved) return;
        if (!isLoggedIn && !hasCompletionAuthSuccess) return;
        const currentToken = localStorage.getItem('token') ?? token;
        if (!currentToken) return;

        const summaryWithAccount = {
            ...completionSummary,
            playerName: user?.username ?? completionSummary.playerName
        };

        saveCompletionSummary(summaryWithAccount).catch((e) => {
            console.error('Failed to save completion summary after login', e);
            setCompletionSummary(prev => prev
                ? {
                    ...prev,
                    saveError: e instanceof Error ? e.message : 'Unknown error while saving result.'
                }
                : prev);
        });
    }, [isLoggedIn, token, user, completionSummary, hasCompletionAuthSuccess]);

    // Returns true if all 9 cells of a face are filled and error-free
    const checkFaceComplete = (boardData: BoardCell[], face: string): boolean => {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const cell = boardData.find(d => d.id === `${face}_${r}_${c}`);
                if (!cell || cell.value === 0 || cell.state === 'Error') return false;
            }
        }
        return true;
    };

    // Called when IsSolved = true — posts result to backend
    const handleGameComplete = async () => {
        const durationSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
        const summaryBase: CompletionSummary = {
            durationSeconds,
            mistakes: mistakesRef.current,
            score: scoreRef.current,
            difficulty: currentDifficultyRef.current,
            puzzleDate: puzzleDateRef.current,
            playerName: isLoggedIn && user?.username ? user.username : 'Player 1',
            saved: false
        };

        if (!isLoggedIn || !token) {
            console.log(`Solved! Score: ${scoreRef.current} | Time: ${durationSeconds}s | Mistakes: ${mistakesRef.current}`);
            try {
                const response = await fetch('/api/user/preview-rank', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        difficulty: summaryBase.difficulty,
                        puzzleDate: summaryBase.puzzleDate,
                        durationSeconds: summaryBase.durationSeconds,
                        mistakes: summaryBase.mistakes,
                        score: summaryBase.score,
                        playerName: 'Player 1'
                    })
                });

                if (!response.ok) {
                    throw new Error(await response.text());
                }

                const previewData = await response.json();
                setCompletionSummary({
                    ...summaryBase,
                    rank: previewData.rank,
                    startRank: previewData.startRank,
                    totalPlayers: previewData.totalPlayers,
                    nearbyRows: previewData.nearbyRows,
                    playerName: 'Player 1'
                });
            } catch {
                // Fallback so guests still see the animation even if preview endpoint is unavailable.
                setCompletionSummary({
                    ...summaryBase,
                    rank: 2,
                    startRank: 3,
                    totalPlayers: 3,
                    nearbyRows: [
                        { rank: 1, username: 'Top Player', score: summaryBase.score + 100, durationSeconds: Math.max(1, summaryBase.durationSeconds - 15), mistakes: 0, isPlayer: false },
                        { rank: 2, username: 'Player 1', score: summaryBase.score, durationSeconds: summaryBase.durationSeconds, mistakes: summaryBase.mistakes, isPlayer: true, hint: 'Log in to submit and save this result.' },
                        { rank: 3, username: 'Challenger', score: Math.max(0, summaryBase.score - 120), durationSeconds: summaryBase.durationSeconds + 20, mistakes: summaryBase.mistakes + 1, isPlayer: false }
                    ],
                    playerName: 'Player 1'
                });
            }
            return;
        }

        try {
            await saveCompletionSummary(summaryBase);
            console.log('Game result saved to leaderboard!');
        } catch (e) {
            console.error('Failed to save game result', e);
            setCompletionSummary({
                ...summaryBase,
                saveError: e instanceof Error ? e.message : 'Unknown error while saving result.'
            });
        }
    };

    // Returns the set of FACE NAMES that contain at least one duplicate value.
    // CubeModel uses this to colour the entire face (including empty cells).
    const detectConflicts = (cells: BoardCell[]): Set<string> => {
        const conflictedFaces = new Set<string>();
        const faceValues: Record<string, number[]> = {};

        cells.forEach(cell => {
            if (!cell.value) return;
            const face = cell.id.split('_')[0];
            if (!faceValues[face]) faceValues[face] = [];
            faceValues[face].push(cell.value);
        });

        Object.entries(faceValues).forEach(([face, values]) => {
            if (new Set(values).size < values.length) conflictedFaces.add(face);
        });

        return conflictedFaces;
    };

    // Persistent tracker for server-reported edge/corner errors.
    // A ref avoids triggering re-renders; the board data re-render handles display.
    const serverErrorsRef = useRef<Set<string>>(new Set());
    // Reactively derived — re-runs whenever mockBoardData changes.
    const conflictedFaces = useMemo(() => detectConflicts(mockBoardData), [mockBoardData]);
    const lockedCellIds = useMemo(() => new Set(lockedCellsRef.current.map(c => c.id)), [mockBoardData]);

    // API Move Handler
    const handleMove = async (cellId: string, newValue: number) => {
        if (lockedCellIds.has(cellId) || isWelcomeOpen || isSolved) return;

        // 1. Construct current state array (54 integers)
        // Order: Front, Back, Top, Bottom, Left, Right
        // Internal loop: Row 0..2, Col 0..2
        const faces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
        const currentState: number[] = [];
        const lockedState: boolean[] = [];

        // Map to quickly find current values
        const valueMap = new Map<string, number>();
        mockBoardData.forEach(cell => valueMap.set(cell.id, cell.value));

        faces.forEach(face => {
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const id = `${face}_${r}_${c}`;
                    // Use existing value, unless it's the cell being updated (optimistic or just valid current state?)
                    // The backend expects "CurrentState" as the state BEFORE the move? 
                    // Or current state of the board? Usually "current board".
                    // GameController.cs lines 71-85 loads the cube from values.
                    // Then line 90 gets the target cell and sets the NEW value.
                    // So we should send the state *excluding* the new move? Or does it overwrite?
                    // It overwrites: `cell.setNumber(values[counter])`.
                    // So we should send the CURRENT state of numbers on the board.
                    // If the user is changing a number, we should probably send the OLD number in the array?
                    // Actually, it doesn't matter much because line 91 `newCell.setNumber(request.Value)` will overwrite it with the new value anyway.
                    // So sending the current board state is fine.
                    currentState.push(valueMap.get(id) || 0);
                    lockedState.push(lockedCellIds.has(id));
                }
            }
        });

        const [face, row, col] = cellId.split('_');

        const payload = {
            face: face,
            row: parseInt(row),
            column: parseInt(col),
            value: newValue,
            currentState: currentState,
            lockedState: lockedState
        };

        try {
            console.log('Sending Move:', payload);
            const response = await fetch('/api/game/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Move Response:', data);

                // Snapshot pre-move state for undo
                lastMoveRef.current = {
                    boardData: mockBoardData.map(c => ({ id: c.id, value: c.value, isLocked: c.isLocked })),
                    mistakes: mistakesRef.current,
                    score: scoreRef.current,
                    completedFaces: new Set(completedFacesRef.current),
                };
                setCanUndo(true);

                // Step 1 — Compute the new board state synchronously (values only).
                // We need this to determine which faces are conflicted BEFORE deciding
                // what belongs in serverErrorsRef.
                const tempData = mockBoardData.map(cell => ({ ...cell }));
                if (data.updatedCells) {
                    data.updatedCells.forEach((update: any) => {
                        const updateId = `${update.face}_${update.row}_${update.column}`;
                        const existingIndex = tempData.findIndex(d => d.id === updateId);
                        if (existingIndex >= 0) {
                            if (update.value === 0) {
                                tempData.splice(existingIndex, 1);
                            } else {
                                tempData[existingIndex] = { ...tempData[existingIndex], value: update.value };
                            }
                        } else if (update.value !== 0) {
                            tempData.push({ id: updateId, value: update.value, isLocked: false });
                        }
                    });
                }

                // Step 2b — Find which faces just resolved (were conflicted, now aren't).
                // Used in Phase B of Step 3 to purge stale face-only errors.
                const newConflictedFaces = detectConflicts(tempData);
                const previousConflictedFaces = detectConflicts(mockBoardData);
                const resolvedFaces = new Set(
                    [...previousConflictedFaces].filter(f => !newConflictedFaces.has(f))
                );

                // Step 3 — Update the persistent error tracker.
                // Phase A: collect which cells the server re-confirmed as Error in this move.
                const confirmedErrorsThisMove = new Set<string>();
                if (data.updatedCells) {
                    data.updatedCells.forEach((update: any) => {
                        const id = `${update.face}_${update.row}_${update.column}`;
                        if (update.state === 'Error') {
                            confirmedErrorsThisMove.add(id);
                            if (!serverErrorsRef.current.has(id)) mistakesRef.current++; // new mistake
                            serverErrorsRef.current.add(id);
                        } else {
                            serverErrorsRef.current.delete(id); // server says valid
                        }
                    });
                }
                // Phase B: purge cells on newly-resolved faces that the server did NOT
                // re-confirm as Error — those were stale face-conflict errors, now cleared.
                if (resolvedFaces.size > 0) {
                    for (const id of [...serverErrorsRef.current]) {
                        const face = id.split('_')[0];
                        if (resolvedFaces.has(face) && !confirmedErrorsThisMove.has(id)) {
                            serverErrorsRef.current.delete(id);
                        }
                    }
                }

                // Step 4 — Commit to React state.
                const currentErrors = serverErrorsRef.current;
                const updatedData = tempData.map(cell => ({
                    ...cell,
                    state: currentErrors.has(cell.id) ? 'Error' : undefined
                }));
                setMockBoardData(() => updatedData);

                // Check for newly completed faces and award score
                const allFaces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
                allFaces.forEach(f => {
                    if (!completedFacesRef.current.has(f) && checkFaceComplete(updatedData, f)) {
                        completedFacesRef.current.add(f);
                        const now = Date.now();
                        const elapsed = (now - lastActionTimeRef.current) / 1000;
                        lastActionTimeRef.current = now;
                        const timeBonus = Math.round(Math.max(0, 300 - elapsed));
                        scoreRef.current += 500 + timeBonus;
                        setCurrentScore(scoreRef.current);
                    }
                });

                // Handle game solved
                if (data.isSolved) {
                    setIsSolved(true);
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    await handleGameComplete();
                }

            } else {
                console.error('Move failed:', response.statusText);
            }
        } catch (error) {
            console.error('Error sending move:', error);
        }
    };

    const handleEraserSelect = () => {
        if (selectedNumber != 'eraser') {
            setSelectedNumber('eraser');
        }
        else {
            setSelectedNumber(null);
        }
    }

    const handleUndo = async () => {
        if (!lastMoveRef.current || isWelcomeOpen || isSolved) return;

        const entry = lastMoveRef.current;
        lastMoveRef.current = null;
        setCanUndo(false);

        // Build 54-element state array from the previous board snapshot
        const faces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
        const valueMap = new Map<string, number>(entry.boardData.map(c => [c.id, c.value]));
        const previousState: number[] = [];
        faces.forEach(face => {
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    previousState.push(valueMap.get(`${face}_${r}_${c}`) || 0);
                }
            }
        });

        try {
            const response = await fetch('/api/game/revert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentState: previousState })
            });

            if (response.ok) {
                const data = await response.json();

                // Rebuild serverErrorsRef from backend's revalidated state
                serverErrorsRef.current = new Set<string>();
                if (data.updatedCells) {
                    data.updatedCells.forEach((update: any) => {
                        if (update.state === 'Error') {
                            serverErrorsRef.current.add(`${update.face}_${update.row}_${update.column}`);
                        }
                    });
                }

                // Restore game tracking to snapshotted values
                mistakesRef.current = entry.mistakes;
                scoreRef.current = entry.score;
                completedFacesRef.current = new Set(entry.completedFaces);
                setCurrentScore(entry.score);

                // Apply previous board data with updated error states from backend
                const currentErrors = serverErrorsRef.current;
                const restoredData = entry.boardData.map(cell => ({
                    ...cell,
                    state: currentErrors.has(cell.id) ? 'Error' : undefined
                }));
                setMockBoardData(restoredData);
            } else {
                // Restore history entry on failure
                lastMoveRef.current = entry;
                setCanUndo(true);
                console.error('Undo revert failed:', response.statusText);
            }
        } catch (error) {
            // Restore history entry on failure
            lastMoveRef.current = entry;
            setCanUndo(true);
            console.error('Error during undo:', error);
        }
    };

    const handleNumberSelect = (number: number) => {
        if (selectedNumber != number) {
            setSelectedNumber(number);
        }
        else {
            setSelectedNumber(null);
        }
    }

    const handleDifficultySelect = (
        difficulty: 'Classic' | 'BrainTerror',
        lockedCells: { face: string; row: number; column: number; value: number }[]
    ) => {
        // Reset game tracking
        const now = Date.now();
        gameStartTimeRef.current = now;
        lastActionTimeRef.current = now;
        mistakesRef.current = 0;
        scoreRef.current = 0;
        completedFacesRef.current = new Set();
        currentDifficultyRef.current = difficulty;
        puzzleDateRef.current = new Date().toISOString().split('T')[0];
        lastMoveRef.current = null;
        setCanUndo(false);
        setGameTimer(0);
        setCurrentScore(0);
        setIsSolved(false);
        setCompletionSummary(null);

        setSelectedDifficulty(difficulty);
        setIsWelcomeOpen(false);

        const cells = lockedCells ?? [];
        const boardData = cells.map(cell => ({
            id: `${cell.face}_${cell.row}_${cell.column}`,
            value: cell.value,
            isLocked: true as const
        }));
        // Remember locked cells for Start Over reset
        lockedCellsRef.current = boardData;
        setMockBoardData(boardData);
    }

    const handleStartOver = () => {
        // Don't allow if no game has started yet
        if (isWelcomeOpen) return;
        setIsConfirmResetOpen(true);
    };

    const handleConfirmReset = () => {
        setIsConfirmResetOpen(false);
        // Stop any running timer
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        // Reset all game tracking
        const now = Date.now();
        gameStartTimeRef.current = now;
        lastActionTimeRef.current = now;
        mistakesRef.current = 0;
        scoreRef.current = 0;
        completedFacesRef.current = new Set();
        serverErrorsRef.current = new Set();
        lastMoveRef.current = null;
        setCanUndo(false);
        setGameTimer(0);
        setCurrentScore(0);
        setIsSolved(false);
        setCompletionSummary(null);
        setSelectedNumber(null);
        // Restore board to original locked cells only
        setMockBoardData([...lockedCellsRef.current]);
    };

    // DEV ONLY — auto-fills the solution, scores all faces, and triggers game completion.
    const handleDevSolve = async () => {
        if (isWelcomeOpen) return;
        try {
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`/api/game/solution?difficulty=${currentDifficultyRef.current}`, { headers });
            if (!res.ok) throw new Error(`Solution endpoint returned ${res.status}`);
            const cells: { face: string; row: number; column: number; value: number }[] = await res.json();

            const solvedBoard = cells.map(c => ({ id: `${c.face}_${c.row}_${c.column}`, value: c.value }));
            serverErrorsRef.current = new Set();
            setMockBoardData(solvedBoard);

            // Award score for all 6 faces (simulating the player completing them)
            const allFaces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
            const now = Date.now();
            allFaces.forEach(f => {
                if (!completedFacesRef.current.has(f)) {
                    completedFacesRef.current.add(f);
                    scoreRef.current += 500; // no time bonus in dev mode
                }
            });
            setCurrentScore(scoreRef.current);

            // Stop timer and mark solved
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            lastActionTimeRef.current = now;
            setIsSolved(true);
            await handleGameComplete();
        } catch (err) {
            console.error('[DEV] Auto-solve failed:', err);
        }
    };

    const isCompletionAuthenticated = isLoggedIn || hasCompletionAuthSuccess;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: '#0A0A0A'
        }}>
            {/* Top Bar */}
            <div className="top-bar">
                <button className="icon-button leaderboard-btn" onClick={() => setIsLeaderboardOpen(true)}>
                    <MdLeaderboard size={20} />
                    <span>Leaderboard</span>
                </button>
                <button className="icon-button restart-btn" onClick={handleStartOver} disabled={isWelcomeOpen}>
                    <LuRefreshCw size={20} />
                    <span>Start Over</span>
                </button>
                <h1 style={{ alignItems: 'center' }}>3D Sudoku Viewer</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                    <p style={{ color: 'white', fontSize: '1.1rem', margin: 0 }}>
                        {Math.floor(gameTimer / 60).toString().padStart(2, '0')}:{(gameTimer % 60).toString().padStart(2, '0')}
                        {currentScore > 0 && <span style={{ marginLeft: '16px', color: '#FFD700' }}>⭐ {currentScore}</span>}
                    </p>
                    <img src="profile.svg" alt="Profile" className="profile-icon" onClick={() => { setIsProfileOpen(!isProfileOpen) }} />
                </div>
            </div>
            <WelcomeModal
                isOpen={isWelcomeOpen}
                onDifficultySelect={handleDifficultySelect}
            />

            {/* Start Over Confirmation Dialog */}
            {isConfirmResetOpen && (
                <div className="confirm-reset-overlay" onClick={() => setIsConfirmResetOpen(false)}>
                    <div className="confirm-reset-modal" onClick={e => e.stopPropagation()}>
                        <div className="confirm-reset-icon">⚠️</div>
                        <h2>Start Over?</h2>
                        <p>All your current progress will be lost and cannot be recovered.</p>
                        {isLoggedIn && (
                            <p className="confirm-reset-warning">This game will <strong>not</strong> be saved to your account.</p>
                        )}
                        <div className="confirm-reset-actions">
                            <button className="confirm-reset-cancel" onClick={() => setIsConfirmResetOpen(false)}>
                                Cancel
                            </button>
                            <button className="confirm-reset-confirm" onClick={handleConfirmReset}>
                                Yes, Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {completionSummary && (
                <div className="complete-overlay" onClick={() => setCompletionSummary(null)}>
                    <div className="complete-modal" onClick={e => e.stopPropagation()}>
                        <h2>Puzzle Complete</h2>
                        <p className="complete-subtitle">
                            {completionSummary.difficulty} Puzzle | {completionSummary.puzzleDate}
                        </p>

                        {completionSummary.nearbyRows && completionSummary.nearbyRows.length > 0 && (
                            <div className="complete-board-strip">
                                <div className="complete-board-header">
                                    <span>#</span><span>Player</span><span>Time</span><span>Score</span>
                                </div>
                                {getRevealRows(completionSummary).map((row) => {
                                    const shift = row.isPlayer && row.startSlot ? Math.max(0, row.startSlot - row.slot) : 0;
                                    return (
                                        <div
                                            key={`${row.slot}-${row.rank}-${row.username}-${row.score}`}
                                            className={`complete-board-row ${row.isPlayer ? 'player' : ''}`}
                                            style={row.isPlayer
                                                ? {
                                                    transform: rankAnimationStarted
                                                        ? 'translateY(0)'
                                                        : `translateY(${shift * 44}px)`
                                                }
                                                : undefined}
                                        >
                                            <span>#{row.rank}</span>
                                            <span>{row.username}</span>
                                            <span>{formatDuration(row.durationSeconds)}</span>
                                            <span>{row.score}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {completionSummary.saved ? (
                            <p className="complete-rank">
                                {completionSummary.playerName}, you are <strong>#{completionSummary.rank ?? '-'}</strong> on this puzzle's leaderboard
                                {completionSummary.totalPlayers ? ` out of ${completionSummary.totalPlayers} players.` : '.'}
                            </p>
                        ) : isCompletionAuthenticated ? (
                            <p className="complete-rank guest">
                                {completionSummary.saveError
                                    ? `Save failed: ${completionSummary.saveError}`
                                    : 'Saving your result to the official leaderboard...'}
                            </p>
                        ) : (
                            <p className="complete-rank guest">
                                Log in or sign up now so your run is submitted and saved in the official leaderboard.
                            </p>
                        )}

                        <div className="complete-actions">
                            {!completionSummary.saved && !isCompletionAuthenticated && (
                                <button className="complete-primary" onClick={() => setIsAuthOpen(true)}>
                                    Log In / Sign Up
                                </button>
                            )}
                            {!completionSummary.saved && isCompletionAuthenticated && !!completionSummary.saveError && (
                                <button
                                    className="complete-primary"
                                    onClick={() => saveCompletionSummary({
                                        ...completionSummary,
                                        playerName: user?.username ?? completionSummary.playerName
                                    }).catch((e) => console.error('Retry save failed', e))}
                                >
                                    Retry Save
                                </button>
                            )}
                            <button
                                className="complete-primary"
                                onClick={() => startGameFromServer(completionSummary.difficulty)}
                            >
                                Play Again
                            </button>
                            <button className="complete-secondary" onClick={() => setCompletionSummary(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ProfileModal
                className="profile-modal"
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onSettings={() => {
                    setIsProfileOpen(false);
                    setIsSettingsOpen(true);
                }}
            />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
            <AuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                onAuthSuccess={() => setHasCompletionAuthSuccess(true)}
            />
            <LeaderboardModal
                isOpen={isLeaderboardOpen}
                onClose={() => setIsLeaderboardOpen(false)}
                defaultTab={currentDifficultyRef.current}
                pinnedEntry={
                    isLoggedIn && completionSummary?.saved
                        ? {
                            username: completionSummary.playerName,
                            difficulty: completionSummary.difficulty,
                            puzzleDate: completionSummary.puzzleDate,
                            score: completionSummary.score,
                            durationSeconds: completionSummary.durationSeconds,
                            mistakes: completionSummary.mistakes
                        }
                        : null
                }
            />
            {/* Right Floating Panel */}
            {/* Right Floating Panel - Numbers */}
            <div className="right-panel">
                <h2>Numbers</h2>
                <div className="number-grid">
                    <button className={`number-btn ${selectedNumber === 1 ? 'selected' : ''}`} onClick={() => handleNumberSelect(1)}>1</button>
                    <button className={`number-btn ${selectedNumber === 2 ? 'selected' : ''}`} onClick={() => handleNumberSelect(2)}>2</button>
                    <button className={`number-btn ${selectedNumber === 3 ? 'selected' : ''}`} onClick={() => handleNumberSelect(3)}>3</button>
                    <button className={`number-btn ${selectedNumber === 4 ? 'selected' : ''}`} onClick={() => handleNumberSelect(4)}>4</button>
                    <button className={`number-btn ${selectedNumber === 5 ? 'selected' : ''}`} onClick={() => handleNumberSelect(5)}>5</button>
                    <button className={`number-btn ${selectedNumber === 6 ? 'selected' : ''}`} onClick={() => handleNumberSelect(6)}>6</button>
                    <button className={`number-btn ${selectedNumber === 7 ? 'selected' : ''}`} onClick={() => handleNumberSelect(7)}>7</button>
                    <button className={`number-btn ${selectedNumber === 8 ? 'selected' : ''}`} onClick={() => handleNumberSelect(8)}>8</button>
                    <button className={`number-btn ${selectedNumber === 9 ? 'selected' : ''}`} onClick={() => handleNumberSelect(9)}>9</button>
                </div>
            </div>

            {/* Right Floating Panel 2 - Actions */}
            <div className="right-panel-2">
                <h2>Actions</h2>
                <div className="action-buttons">
                    <button
                        className="action-btn undo-btn"
                        title="Undo"
                        onClick={handleUndo}
                        disabled={!canUndo || isSolved}
                    >
                        <LuUndo2 size={20} />
                    </button>
                    <button className={`action-btn eraser-btn ${selectedNumber === 'eraser' ? 'selected' : ''}`}
                        onClick={handleEraserSelect}
                        title="Erase"
                    >
                        <LuEraser size={20} />
                    </button>
                    <button className="action-btn hint-btn" title="Hint">
                        <LuLightbulb size={20} />
                    </button>
                </div>
            </div>
            {/* Bottom Left Floating Panel */}
            <div className="bottom-left-panel">
                <div className="extra-buttons">
                    <button className="extra-btn" title="Settings" onClick={handleSettings}>
                        <LuSettings size={20} />
                    </button>
                    <button className="extra-btn" title="GitHub" onClick={handleGithub}>
                        <FaGithub size={20} />
                    </button>
                    <button className="extra-btn" title="How to Play" onClick={handleHowToPlay}>
                        <LuCircleHelp size={20} />
                    </button>
                    <button
                        className="extra-btn dev-solve-btn"
                        title="[DEV] Auto-solve puzzle"
                        onClick={handleDevSolve}
                        disabled={isWelcomeOpen || isSolved}
                    >
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'inherit' }}>DEV</span>
                    </button>
                </div>
            </div>
            {/* 3D Canvas */}
            <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <directionalLight position={[-10, -10, -5]} intensity={0.5} />
                <Suspense fallback={null}>
                    <CubeModel
                        selectedNumber={selectedNumber}
                        mockBoardData={mockBoardData}
                        onMove={(cellId, val) => handleMove(cellId, val)}
                        conflictedFaces={conflictedFaces}
                        lockedCellIds={lockedCellIds}
                    />
                </Suspense>

                <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    rotateSpeed={0.5}
                    enablePan={false}
                />
            </Canvas>
        </div >
    );
}

export default CubeViewer;
