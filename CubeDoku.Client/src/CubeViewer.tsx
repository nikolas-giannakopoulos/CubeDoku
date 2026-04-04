import { Canvas, useThree, useFrame, createPortal } from '@react-three/fiber';
import { OrbitControls, useGLTF, Clone, Center, ContactShadows } from '@react-three/drei';
import { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { MdLeaderboard } from 'react-icons/md';
import { LuRefreshCw, LuUndo2, LuEraser, LuLightbulb, LuSettings, LuCircleHelp } from 'react-icons/lu';
import { FaGithub } from 'react-icons/fa';
import { handleGithub } from './extraHandlers';
import { ProfileModal } from './ProfileModal';
import { WelcomeModal } from './WelcomeModal';
import { AuthModal } from './AuthModal';
import { LeaderboardModal } from './LeaderboardModal';
import { SettingsModal } from './SettingsModal';
import { UserSettingsModal } from './UserSettingsModal';
import { HowToPlayModal } from './HowToPlayModal';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import * as THREE from 'three';
import gsap from 'gsap';
import './UI.css';

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0, 4.8];
const HINT_VIEW_DISTANCE = 7.0;

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

const THEME_MATERIALS = {
    dark: {
        cell: { color: 0x1A1D23, roughness: 0.1, metalness: 0.5, opacity: 0.98 },
        locked: { color: 0x242931, roughness: 0.05, metalness: 0.7, opacity: 1 },
        fail: { color: 0x6e0d0d, roughness: 0.2, metalness: 0.3, opacity: 1 },
        base: { color: 0x0F1115, roughness: 0.05, metalness: 0.9 },
        num_default: { color: 0xE5E4E2, roughness: 0.1, metalness: 1.0, emissive: 0x4a90e2, emissiveIntensity: 0.2 },
        num_error: { color: 0xffffff, roughness: 0.1, metalness: 0.6 }
    },
    light: {
        cell: { color: 0xFDFBF9, roughness: 0.4, metalness: 0.05, opacity: 0.98 },
        locked: { color: 0xF3F1ED, roughness: 0.3, metalness: 0.1, opacity: 1 },
        fail: { color: 0xC65C47, roughness: 0.4, metalness: 0.05, opacity: 1 },
        base: { color: 0xE8DFD0, roughness: 0.6, metalness: 0.05 },
        num_default: { color: 0xC49A6C, roughness: 0.3, metalness: 0.8, emissive: 0x000000, emissiveIntensity: 0 },
        num_error: { color: 0xFDFBF9, roughness: 0.4, metalness: 0.05 }
    }
};

const UI_BG_COLORS = {
    light: '#F4E3D3',
    dark: '#111418'
};

// Tween material helper
const tweenMatDef = (mat: any, target: any, duration = 0.4) => {
    if (!mat) return;
    const targetColor = new THREE.Color(target.color);
    gsap.to(mat.color, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration, ease: 'power2.inOut' });
    if (target.roughness !== undefined) gsap.to(mat, { roughness: target.roughness, duration, ease: 'power2.inOut' });
    if (target.metalness !== undefined) gsap.to(mat, { metalness: target.metalness, duration, ease: 'power2.inOut' });
    if (target.opacity !== undefined) {
        gsap.to(mat, {
            opacity: target.opacity,
            duration,
            ease: 'power2.inOut',
            onUpdate: () => { mat.transparent = mat.opacity < 1; }
        });
    }
    if (target.emissive !== undefined) {
        const targetEmissive = new THREE.Color(target.emissive);
        gsap.to(mat.emissive, { r: targetEmissive.r, g: targetEmissive.g, b: targetEmissive.b, duration });
    }
    if (target.emissiveIntensity !== undefined) {
        gsap.to(mat, { emissiveIntensity: target.emissiveIntensity, duration });
    }
};

// --- Scene Components ---

function ThemedEffects() {
    const { gl } = useThree();
    const { theme } = useTheme() as { theme: 'light' | 'dark' };
    useEffect(() => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = theme === 'light' ? 1.0 : 0.85;
    }, [gl, theme]);
    return null;
}

function SceneLighting() {
    const { theme } = useTheme() as { theme: 'light' | 'dark' };

    return (
        <>
            <ambientLight intensity={0.3} />
            <directionalLight
                position={[5, 8, 5]}
                intensity={theme === 'dark' ? 1.5 : 0.8}
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-10, -10, -10]} intensity={0.2} color="#ffffff" />
        </>
    );
}

function AnimatedShadows({ cubeRef }: { cubeRef: React.RefObject<THREE.Group | null> }) {
    const { theme } = useTheme() as { theme: 'light' | 'dark' };
    const shadowRef = useRef<any>(null);
    const box = useMemo(() => new THREE.Box3(), []);
    const size = useMemo(() => new THREE.Vector3(), []);
    const center = useMemo(() => new THREE.Vector3(), []);

    // Theme values for shadow
    const shadowColor = theme === 'light' ? 0x8a6d4e : 0x0f172a;
    const shadowOpacity = theme === 'light' ? 0.3 : 0.5;

    useEffect(() => {
        if (!shadowRef.current) return;
        const color = new THREE.Color(shadowColor);
        gsap.to(shadowRef.current.children[0].material.color, {
            r: color.r,
            g: color.g,
            b: color.b,
            duration: 0.4
        });
        gsap.to(shadowRef.current, {
            opacity: shadowOpacity,
            duration: 0.4
        });
    }, [theme, shadowColor, shadowOpacity]);

    useFrame(({ camera }) => {
        if (!cubeRef.current || !shadowRef.current) return;

        // billboard: always face the camera to ensure perfectly circular blob
        shadowRef.current.lookAt(camera.position);

        // pin to bottom: track the current lowest point of the cube (handles rotation/floating)
        box.setFromObject(cubeRef.current);
        box.getCenter(center);
        box.getSize(size);
        shadowRef.current.position.set(center.x, box.min.y - 0.05, center.z);
    });

    return (
        <ContactShadows
            ref={shadowRef}
            opacity={shadowOpacity}
            scale={3.5}
            blur={2.5}
            far={1.5}
            resolution={256}
            color={shadowColor}
        />
    );
}

function CubeModel({
    selectedNumber,
    mockBoardData,
    onMove,
    conflictedFaces,
    lockedCellIds,
    programmaticPressCellId,
    cubeRef,
    cellNotes
}: {
    selectedNumber: number | 'eraser' | null;
    mockBoardData: BoardCell[];
    onMove: (cellId: string, value: number) => void;
    conflictedFaces: Set<string>;
    lockedCellIds: Set<string>;
    programmaticPressCellId?: string | null;
    cubeRef: React.RefObject<THREE.Group | null>;
    cellNotes?: Record<string, number[]>;
}) {
    const { theme } = useTheme() as { theme: 'light' | 'dark' };
    const { scene, nodes, materials } = useGLTF('/cube.glb') as any;

    // Isolate materials by cloning them for each usage
    const isLoaded = useRef(false);
    useEffect(() => {
        if (isLoaded.current) return;
        
        // Helper to safe-clone and replace material
        const safeClone = (name: string) => {
            if (materials[name]) {
                const baseMat = materials[name].clone();
                materials[name] = baseMat;
                return true;
            }
            return false;
        };

        safeClone('Cell_Material');
        safeClone('Cell_Locked');
        safeClone('Cell_Fail');
        safeClone('Cube_Base');
        
        // Clone number materials
        for (let i = 1; i <= 9; i++) {
            const matName = `Asset_Num_${i}_Mat`;
            if (safeClone(matName)) {
                // Add an "Error" variant for each number
                materials[`${matName}_Error`] = materials[matName].clone();
            }
        }
        
        isLoaded.current = true;
    }, [materials]);

    // Apply theme colors to meshes
    useEffect(() => {
        if (!materials) return;
        const config = THEME_MATERIALS[theme];
        tweenMatDef(materials.Cell_Material, config.cell);
        tweenMatDef(materials.Cell_Locked, config.locked);
        tweenMatDef(materials.Cell_Fail, config.fail);
        tweenMatDef(materials.Cube_Base, config.base);

        for (let i = 1; i <= 9; i++) {
            const matName = `Asset_Num_${i}_Mat`;
            if (materials[matName]) {
                tweenMatDef(materials[matName], config.num_default);
                tweenMatDef(materials[`${matName}_Error`], config.num_error);
            }
        }

        // --- Critical Link Fix ---
        // Ensure the scene meshes actually use our cloned/updated materials
        scene.traverse((obj: any) => {
            if (obj.isMesh) {
                if (obj.name.toLowerCase().includes('base')) {
                    obj.material = materials.Cube_Base;
                } else if (obj.name.includes('_')) { // Face cells
                    const isLocked = lockedCellIds.has(obj.name);
                    const cellData = mockBoardData.find(d => d.id === obj.name);
                    const face = obj.name.split('_')[0];
                    const isError = cellData?.state === 'Error' || conflictedFaces.has(face);
                    
                    if (isError) obj.material = materials.Cell_Fail;
                    else if (isLocked) obj.material = materials.Cell_Locked;
                    else obj.material = materials.Cell_Material;
                }
            }
        });
    }, [theme, materials, scene, lockedCellIds, mockBoardData, conflictedFaces]);

    // Hide original assets
    useEffect(() => {
        Object.keys(nodes).forEach(nodeName => {
            if (nodeName.startsWith('Asset_Num_')) {
                nodes[nodeName].visible = false;
            }
        });
    }, [nodes]);

    // Per-mesh material tracking
    useEffect(() => {
        if (!materials || !nodes) return;

        Object.keys(nodes).forEach((nodeName) => {
            const face = nodeName.split('_')[0];
            if (['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'].some(f => nodeName.startsWith(f))) {
                const node = nodes[nodeName];
                if (node && (node as any).material) {
                    if (conflictedFaces.has(face)) {
                        (node as any).material = materials.Cell_Fail;
                    } else {
                        const data = mockBoardData.find(d => d.id === nodeName);
                        if (data?.state === 'Error') {
                            (node as any).material = materials.Cell_Fail;
                        } else if (lockedCellIds.has(nodeName)) {
                            (node as any).material = materials.Cell_Locked;
                        } else {
                            (node as any).material = materials.Cell_Material;
                        }
                    }
                }
                
                // Store original position for bulletproof animations
                if (!(node as any).userData.originalPosition) {
                    (node as any).userData.originalPosition = node.position.clone();
                }
            }
        });
    }, [mockBoardData, conflictedFaces, nodes, materials, lockedCellIds]);

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
        return native.button === undefined || native.button === 0;
    };

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        if (!isPrimaryClick(e)) return;

        const native = e.nativeEvent ?? e;
        pointerDownPos.current = { x: native.clientX, y: native.clientY };

        const cellID = getClickedCellId(e);
        if (cellID && nodes[cellID]) {
            const mesh = nodes[cellID];
            const dummy = { offset: 0 };
            gsap.to(dummy, {
                offset: 0.04,
                duration: 0.15,
                yoyo: true,
                repeat: 1,
                ease: "power2.out",
                onUpdate: () => {
                    const orig = mesh.userData.originalPosition as THREE.Vector3;
                    if (!orig) return;
                    mesh.position.copy(orig);
                    mesh.translateZ(dummy.offset);
                },
                onComplete: () => {
                    const orig = mesh.userData.originalPosition as THREE.Vector3;
                    if (orig) mesh.position.copy(orig);
                }
            });
        }
    };

    const getFaceTransform = (face: string): { position: [number, number, number], rotation: [number, number, number] } => {
        // The GLB meshes are named by face. We apply portal transforms relative to their geometry.
        // We ensure Z-offset is very small (0.05) relative to the surface mesh.
        const zOff = 0.05;
        switch (face) {
            case 'Front': return { position: [0, 0, zOff], rotation: [0, 0, 0] };
            case 'Back': return { position: [0, 0, zOff], rotation: [0, Math.PI, 0] };
            case 'Top': return { position: [0, 0, zOff], rotation: [-Math.PI / 2, 0, 0] };
            case 'Bottom': return { position: [0, 0, zOff], rotation: [Math.PI / 2, 0, 0] };
            case 'Left': return { position: [0, 0, zOff], rotation: [0, -Math.PI / 2, 0] };
            case 'Right': return { position: [0, 0, zOff], rotation: [0, Math.PI / 2, 0] };
            default: return { position: [0, 0, zOff], rotation: [0, 0, 0] };
        }
    };

    const getNoteTransform = (val: number, face: string) => {
        const { position: facePos, rotation: faceRot } = getFaceTransform(face);
        const idx = val - 1;
        const row = Math.floor(idx / 3) - 1;
        const col = (idx % 3) - 1;
        const spacing = 0.28;
        // Stack on top of the face offset
        return [col * spacing, -row * spacing, facePos[2]] as [number, number, number];
    };

    return (
        <group ref={cubeRef} position={[0, 0, 0]}>
            <Center>
                <primitive
                    object={scene}
                    onPointerDown={handlePointerDown}
                    onClick={(e: any) => {
                        e.stopPropagation();
                        if (!isPrimaryClick(e)) return;
                        const cellID = getClickedCellId(e);
                        if (cellID && !lockedCellIds.has(cellID)) {
                            if (selectedNumber === 'eraser') onMove(cellID, 0);
                            else if (typeof selectedNumber === 'number') onMove(cellID, selectedNumber);
                        }
                    }}
                />
            </Center>
            {mockBoardData.map((data) => {
                const cellNode = nodes[data.id];
                const assetNode = nodes[`Asset_Num_${data.value}`];
                if (!cellNode || !assetNode) return null;
                const face = cellNode.name.split('_')[0];
                const isError = data.state === 'Error' || conflictedFaces.has(face);
                const { position, rotation } = getFaceTransform(face);
                const matName = `Asset_Num_${data.value}_Mat`;
                const isProgrammatic = programmaticPressCellId === data.id;

                return createPortal(
                    <group
                        key={`${data.id}-${data.value}`}
                        position={position}
                        rotation={rotation}
                        scale={isProgrammatic ? [0.6, 0.6, 0.6] : [1, 1, 1]}
                    >
                        <Clone
                            object={assetNode}
                            visible={true}
                            raycast={() => null}
                            position={[0, 0, 0]}
                            rotation={[0, 0, 0]}
                            scale={[1, 1, 1]}
                            inject={<meshStandardMaterial {...(materials[isError ? `${matName}_Error` : matName])} />}
                        />
                    </group>,
                    cellNode
                );
            })}
            {cellNotes && Object.entries(cellNotes).map(([cellId, notesArray]) => {
                const cellNode = nodes[cellId];
                if (!cellNode || mockBoardData.some(d => d.id === cellId && d.value > 0)) return null;

                const face = cellNode.name.split('_')[0];
                const { rotation: faceRot } = getFaceTransform(face);

                return createPortal(
                    <group key={`notes-${cellId}`} rotation={faceRot}>
                        {notesArray.map(val => {
                            const assetNode = nodes[`Asset_Num_${val}`];
                            if (!assetNode) return null;
                            return (
                                <group key={val} position={getNoteTransform(val, face)} rotation={[0, 0, 0]} scale={[0.22, 0.22, 0.22]}>
                                    <Clone 
                                        object={assetNode} 
                                        visible={true} 
                                        raycast={() => null} 
                                        position={[0, 0, 0]} 
                                        rotation={[0, 0, 0]} 
                                        scale={[1, 1, 1]} 
                                    />
                                </group>
                            );
                        })}
                    </group>,
                    cellNode
                );
            })}
        </group>
    );
}

// --- Main Viewer App ---

function CubeViewer() {
    const { isLoggedIn, token, logout, user } = useAuth();
    const { theme } = useTheme() as { theme: 'light' | 'dark' };

    const [selectedNumber, setSelectedNumber] = useState<number | 'eraser' | null>(null);
    const [mockBoardData, setMockBoardData] = useState<BoardCell[]>([]);
    const [cellNotes, _setCellNotes] = useState<Record<string, number[]>>({});

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isGameSettingsOpen, setIsGameSettingsOpen] = useState(false);
    const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
    const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
    const [isHintConfirmOpen, setIsHintConfirmOpen] = useState(false);
    const [hintBusy, setHintBusy] = useState(false);
    const [hintError, setHintError] = useState('');
    const [programmaticPressCellId, setProgrammaticPressCellId] = useState<string | null>(null);
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
    const [_selectedDifficulty, setSelectedDifficulty] = useState<'Classic' | 'BrainTerror'>('Classic');
    const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
    
    console.log('[CubeViewer] Render state:', { isWelcomeOpen, isLoggedIn: !!token, theme });

    const lockedCellsRef = useRef<{ id: string; value: number; isLocked: true }[]>([]);
    const cubeRef = useRef<THREE.Group>(null);

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
    const orbitControlsRef = useRef<any>(null);
    const hintRotateRafRef = useRef<number | null>(null);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    useEffect(() => {
        const controls = orbitControlsRef.current;
        if (!controls?.object) return;
        controls.target.set(0, 0, 0);
        controls.object.up.set(0, 1, 0);
        controls.object.position.set(DEFAULT_CAMERA_POSITION[0], DEFAULT_CAMERA_POSITION[1], DEFAULT_CAMERA_POSITION[2]);
        controls.update();
    }, []);

    useEffect(() => {
        return () => { if (hintRotateRafRef.current !== null) { cancelAnimationFrame(hintRotateRafRef.current); hintRotateRafRef.current = null; } };
    }, []);

    const formatDuration = (durationSeconds: number): string => {
        return `${Math.floor(durationSeconds / 60).toString().padStart(2, '0')}:${(durationSeconds % 60).toString().padStart(2, '0')}`;
    };

    const getRevealRows = (summary: CompletionSummary): RevealRow[] => {
        const rows = [...(summary.nearbyRows ?? [])].sort((a, b) => a.rank - b.rank);
        const player = rows.find(r => r.isPlayer) ?? { rank: summary.rank ?? 0, username: summary.playerName, score: summary.score, durationSeconds: summary.durationSeconds, mistakes: summary.mistakes, isPlayer: true };
        const above = rows.filter(r => !r.isPlayer && r.rank < player.rank).sort((a, b) => b.rank - a.rank);
        const below = rows.filter(r => !r.isPlayer && r.rank > player.rank).sort((a, b) => a.rank - b.rank);
        const totalPlayers = summary.totalPlayers ?? rows.length;
        if (player.rank === 1) {
            const row2 = below[0] ?? player;
            const row3 = below[1] ?? below[0] ?? player;
            return [{ ...player, isPlayer: true, slot: 1, startSlot: 2 }, { ...row2, isPlayer: false, slot: 2 }, { ...row3, isPlayer: false, slot: 3 }];
        }
        if (player.rank >= totalPlayers) {
            const row1 = above[1] ?? above[0] ?? player;
            const row2 = above[0] ?? player;
            return [{ ...row1, isPlayer: false, slot: 1 }, { ...row2, isPlayer: false, slot: 2 }, { ...player, isPlayer: true, slot: 3, startSlot: 3 }];
        }
        const row1 = above[0] ?? player;
        const row3 = below[0] ?? player;
        return [{ ...row1, isPlayer: false, slot: 1 }, { ...player, isPlayer: true, slot: 2, startSlot: 3 }, { ...row3, isPlayer: false, slot: 3 }];
    };

    const startGameFromServer = async (difficulty: 'Classic' | 'BrainTerror') => {
        try {
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`/api/game/start?difficulty=${difficulty}`, { method: 'GET', headers });
            if (!response.ok) throw new Error(`Failed to start game (${response.status})`);
            const data = await response.json();
            handleDifficultySelect(difficulty, data.lockedCells ?? data.LockedCells ?? []);
            setCompletionSummary(null);
            setHasCompletionAuthSuccess(false);
        } catch (error) { console.error('Error starting game:', error); }
    };

    const saveCompletionSummary = async (summary: CompletionSummary) => {
        const sendCompleteRequest = async (authToken: string) => fetch('/api/user/complete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify({ difficulty: summary.difficulty, puzzleDate: summary.puzzleDate, durationSeconds: summary.durationSeconds, mistakes: summary.mistakes, score: summary.score }) });
        const initialToken = localStorage.getItem('token') ?? token;
        if (!initialToken) throw new Error('Not authenticated.');
        let response = await sendCompleteRequest(initialToken);
        if (response.status === 401 || response.status === 403) { const latestToken = localStorage.getItem('token') ?? token; if (latestToken && latestToken !== initialToken) response = await sendCompleteRequest(latestToken); }
        if (!response.ok) { const errorText = await response.text(); if (response.status === 401 || response.status === 403) { logout(); throw new Error(errorText || 'Session expired.'); } throw new Error(errorText || 'Save failed.'); }
        const saveData = await response.json();
        setCompletionSummary({ ...summary, saved: true, rank: saveData.rank, startRank: saveData.startRank, totalPlayers: saveData.totalPlayers, nearbyRows: saveData.nearbyRows, playerName: saveData.username ?? user?.username ?? summary.playerName });
        setHasCompletionAuthSuccess(false);
    };

    useEffect(() => {
        if (!isWelcomeOpen && !isSolved && gameStartTimeRef.current > 0) {
            timerIntervalRef.current = setInterval(() => setGameTimer(Math.floor((Date.now() - gameStartTimeRef.current) / 1000)), 1000);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isWelcomeOpen, isSolved]);

    useEffect(() => {
        if (!completionSummary?.rank || !completionSummary?.startRank) return;
        setRankAnimationStarted(false); const timer = setTimeout(() => setRankAnimationStarted(true), 250); return () => clearTimeout(timer);
    }, [completionSummary]);

    useEffect(() => {
        if (!completionSummary || completionSummary.saved) return;
        if (!isLoggedIn && !hasCompletionAuthSuccess) return;
        const currentToken = localStorage.getItem('token') ?? token; if (!currentToken) return;
        saveCompletionSummary({ ...completionSummary, playerName: user?.username ?? completionSummary.playerName }).catch(e => console.error('Auto-save failed', e));
    }, [isLoggedIn, token, user, completionSummary, hasCompletionAuthSuccess]);

    const checkFaceComplete = (boardData: BoardCell[], face: string): boolean => {
        for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) { const cell = boardData.find(d => d.id === `${face}_${r}_${c}`); if (!cell || cell.value === 0 || cell.state === 'Error') return false; } }
        return true;
    };

    const handleGameComplete = async () => {
        const durationSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
        const summaryBase: CompletionSummary = { durationSeconds, mistakes: mistakesRef.current, score: scoreRef.current, difficulty: currentDifficultyRef.current, puzzleDate: puzzleDateRef.current, playerName: isLoggedIn && user?.username ? user.username : 'Player 1', saved: false };
        if (!isLoggedIn || !token) {
            try {
                const response = await fetch('/api/user/preview-rank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...summaryBase, playerName: 'Player 1' }) });
                if (!response.ok) throw new Error();
                const previewData = await response.json();
                setCompletionSummary({ ...summaryBase, rank: previewData.rank, startRank: previewData.startRank, totalPlayers: previewData.totalPlayers, nearbyRows: previewData.nearbyRows, playerName: 'Player 1' });
            } catch { setCompletionSummary({ ...summaryBase, rank: 2, startRank: 3, totalPlayers: 3, nearbyRows: [], playerName: 'Player 1' }); }
            return;
        }
        try { await saveCompletionSummary(summaryBase); } catch (e) { setCompletionSummary({ ...summaryBase, saveError: e instanceof Error ? e.message : 'Error saving.' }); }
    };

    const detectConflicts = (cells: BoardCell[]): Set<string> => {
        const conflictedFaces = new Set<string>(); const faceValues: Record<string, number[]> = {};
        cells.forEach(cell => { if (!cell.value) return; const face = cell.id.split('_')[0]; if (!faceValues[face]) faceValues[face] = []; faceValues[face].push(cell.value); });
        Object.entries(faceValues).forEach(([face, values]) => { if (new Set(values).size < values.length) conflictedFaces.add(face); });
        return conflictedFaces;
    };

    const serverErrorsRef = useRef<Set<string>>(new Set());
    const conflictedFaces = useMemo(() => detectConflicts(mockBoardData), [mockBoardData]);
    const lockedCellIds = useMemo(() => new Set(lockedCellsRef.current.map(c => c.id)), [mockBoardData]);

    const getBoardPayload = () => {
        const faces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right']; const valueMap = new Map<string, number>();
        mockBoardData.forEach(cell => valueMap.set(cell.id, cell.value));
        const currentState: number[] = []; const lockedState: boolean[] = [];
        faces.forEach(face => { for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) { const id = `${face}_${r}_${c}`; currentState.push(valueMap.get(id) || 0); lockedState.push(lockedCellIds.has(id)); } } });
        return { currentState, lockedState };
    };

    const rotateToFace = async (face: string) => {
        const controls = orbitControlsRef.current; if (!controls?.object) return;
        const faceAngles: Record<string, { azimuth: number; polar: number }> = { Front: { azimuth: Math.PI, polar: Math.PI / 2 }, Back: { azimuth: 0, polar: Math.PI / 2 }, Left: { azimuth: Math.PI / 2, polar: Math.PI / 2 }, Right: { azimuth: -Math.PI / 2, polar: Math.PI / 2 }, Top: { azimuth: Math.PI, polar: 0.32 }, Bottom: { azimuth: Math.PI, polar: Math.PI - 0.32 } };
        const targetAngles = faceAngles[face] ?? { azimuth: Math.PI / 4, polar: Math.PI / 3 };
        const normalizeAngle = (angle: number) => { const twoPi = Math.PI * 2; return ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI; };
        const startAzimuth = controls.getAzimuthalAngle(); const startPolar = controls.getPolarAngle();
        const azimuthDelta = normalizeAngle(targetAngles.azimuth - startAzimuth); const polarDelta = targetAngles.polar - startPolar;
        const startRadius = controls.object.position.distanceTo(controls.target); const targetRadius = HINT_VIEW_DISTANCE;
        if (hintRotateRafRef.current !== null) { cancelAnimationFrame(hintRotateRafRef.current); hintRotateRafRef.current = null; }
        await new Promise<void>((resolve) => {
            const durationMs = 950; const startTime = performance.now();
            const tick = (now: number) => {
                const t = Math.min(1, (now - startTime) / durationMs); const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                controls.target.set(0, 0, 0); controls.object.up.set(0, 1, 0); controls.setAzimuthalAngle(startAzimuth + azimuthDelta * ease); controls.setPolarAngle(startPolar + polarDelta * ease);
                const radius = startRadius + (targetRadius - startRadius) * ease; const offset = controls.object.position.clone().sub(controls.target).normalize().multiplyScalar(radius);
                controls.object.position.copy(controls.target).add(offset); controls.update();
                if (t < 1) hintRotateRafRef.current = requestAnimationFrame(tick); else { hintRotateRafRef.current = null; resolve(); }
            };
            hintRotateRafRef.current = requestAnimationFrame(tick);
        });
        await sleep(220);
    };

    const handleHintConfirm = async () => {
        if (isWelcomeOpen || isSolved || hintBusy) return; setHintError(''); setIsHintConfirmOpen(false); setHintBusy(true);
        try {
            const { currentState, lockedState } = getBoardPayload();
            const hintResponse = await fetch('/api/game/hint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentState, lockedState }) });
            if (!hintResponse.ok) throw new Error(await hintResponse.text() || 'No hint.');
            const hintData = await hintResponse.json();
            const hintCellId = `${hintData.face}_${hintData.row}_${hintData.column}`;
            await rotateToFace(hintData.face);
            await handleMove(hintCellId, Number(hintData.value), { suppressScore: true });
            lockedCellsRef.current.push({ id: hintCellId, value: Number(hintData.value), isLocked: true });
            setProgrammaticPressCellId(hintCellId); await sleep(500);
        } catch (e: any) { setHintError(e.message); } finally { setProgrammaticPressCellId(null); setHintBusy(false); }
    };

    const handleMove = async (cellId: string, newValue: number, options?: { suppressScore?: boolean }) => {
        if (lockedCellIds.has(cellId) || isWelcomeOpen || isSolved) return false;
        const { currentState, lockedState } = getBoardPayload();
        const [face, row, col] = cellId.split('_');
        try {
            const response = await fetch('/api/game/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ face, row: parseInt(row), column: parseInt(col), value: newValue, currentState, lockedState }) });
            if (response.ok) {
                const data = await response.json();
                lastMoveRef.current = { boardData: mockBoardData.map(c => ({ ...c })), mistakes: mistakesRef.current, score: scoreRef.current, completedFaces: new Set(completedFacesRef.current) };
                setCanUndo(true);
                const tempData = mockBoardData.map(c => ({ ...c }));
                if (data.updatedCells) {
                    data.updatedCells.forEach((u: any) => {
                        const id = `${u.face}_${u.row}_${u.column}`; const idx = tempData.findIndex(d => d.id === id);
                        if (idx >= 0) { if (u.value === 0) tempData.splice(idx, 1); else tempData[idx] = { ...tempData[idx], value: u.value }; }
                        else if (u.value !== 0) tempData.push({ id, value: u.value, isLocked: false });
                    });
                }
                const newConflicts = detectConflicts(tempData); const oldConflicts = detectConflicts(mockBoardData);
                const resolved = new Set([...oldConflicts].filter(f => !newConflicts.has(f)));
                const confirmedErrors = new Set<string>();
                if (data.updatedCells) {
                    data.updatedCells.forEach((u: any) => {
                        const id = `${u.face}_${u.row}_${u.column}`;
                        if (u.state === 'Error') { confirmedErrors.add(id); if (!serverErrorsRef.current.has(id)) mistakesRef.current++; serverErrorsRef.current.add(id); }
                        else serverErrorsRef.current.delete(id);
                    });
                }
                if (resolved.size > 0) { for (const id of [...serverErrorsRef.current]) { const f = id.split('_')[0]; if (resolved.has(f) && !confirmedErrors.has(id)) serverErrorsRef.current.delete(id); } }
                const updatedData = tempData.map(c => ({ ...c, state: serverErrorsRef.current.has(c.id) ? 'Error' : undefined }));
                setMockBoardData(updatedData);
                const allF = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
                allF.forEach(f => {
                    if (!completedFacesRef.current.has(f) && checkFaceComplete(updatedData, f)) {
                        completedFacesRef.current.add(f); if (!options?.suppressScore) { const now = Date.now(); scoreRef.current += 500 + Math.round(Math.max(0, 300 - (now - lastActionTimeRef.current) / 1000)); lastActionTimeRef.current = now; setCurrentScore(scoreRef.current); }
                    }
                });
                if (data.isSolved) { setIsSolved(true); if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); await handleGameComplete(); }
                return true;
            }
        } catch { return false; } return false;
    };

    const handleEraserSelect = () => setSelectedNumber(selectedNumber === 'eraser' ? null : 'eraser');

    const handleUndo = async () => {
        if (!lastMoveRef.current || isWelcomeOpen || isSolved) return;
        const entry = lastMoveRef.current; lastMoveRef.current = null; setCanUndo(false);
        const faces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right']; const valueMap = new Map(entry.boardData.map(c => [c.id, c.value]));
        const previousState: number[] = []; faces.forEach(f => { for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) { previousState.push(valueMap.get(`${f}_${r}_${c}`) || 0); } } });
        try {
            const res = await fetch('/api/game/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentState: previousState }) });
            if (res.ok) {
                const data = await res.json(); serverErrorsRef.current = new Set();
                if (data.updatedCells) data.updatedCells.forEach((u: any) => { if (u.state === 'Error') serverErrorsRef.current.add(`${u.face}_${u.row}_${u.column}`); });
                mistakesRef.current = entry.mistakes; scoreRef.current = entry.score; completedFacesRef.current = new Set(entry.completedFaces); setCurrentScore(entry.score);
                setMockBoardData(entry.boardData.map(c => ({ ...c, state: serverErrorsRef.current.has(c.id) ? 'Error' : undefined })));
            } else { lastMoveRef.current = entry; setCanUndo(true); }
        } catch { lastMoveRef.current = entry; setCanUndo(true); }
    };

    const handleNumberSelect = (n: number) => setSelectedNumber(selectedNumber === n ? null : n);

    const handleDifficultySelect = (difficulty: 'Classic' | 'BrainTerror', lockedCells: any[]) => {
        const now = Date.now(); gameStartTimeRef.current = now; lastActionTimeRef.current = now; mistakesRef.current = 0; scoreRef.current = 0; completedFacesRef.current = new Set(); currentDifficultyRef.current = difficulty; puzzleDateRef.current = new Date().toISOString().split('T')[0]; lastMoveRef.current = null; setCanUndo(false); setGameTimer(0); setCurrentScore(0); setIsSolved(false); setCompletionSummary(null); setSelectedDifficulty(difficulty); setIsWelcomeOpen(false);
        const boardData = (lockedCells ?? []).map(c => ({ id: `${c.face}_${c.row}_${c.column}`, value: c.value, isLocked: true as const }));
        lockedCellsRef.current = boardData; setMockBoardData(boardData);
    };

    const handleStartOver = () => { if (!isWelcomeOpen) setIsConfirmResetOpen(true); };

    const handleConfirmReset = () => {
        setIsConfirmResetOpen(false); if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        const now = Date.now(); gameStartTimeRef.current = now; lastActionTimeRef.current = now; mistakesRef.current = 0; scoreRef.current = 0; completedFacesRef.current = new Set(); serverErrorsRef.current = new Set(); lastMoveRef.current = null; setCanUndo(false); setGameTimer(0); setCurrentScore(0); setIsSolved(false); setCompletionSummary(null); setSelectedNumber(null);
        setMockBoardData([...lockedCellsRef.current]);
    };

    const handleDevSolve = async () => {
        if (isWelcomeOpen) return;
        try {
            const headers: Record<string, string> = {}; if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`/api/game/solution?difficulty=${currentDifficultyRef.current}`, { headers });
            const cells: any[] = await res.json(); const solvedBoard = cells.map(c => ({ id: `${c.face}_${c.row}_${c.column}`, value: c.value }));
            serverErrorsRef.current = new Set(); setMockBoardData(solvedBoard);
            const allF = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
            allF.forEach(f => { if (!completedFacesRef.current.has(f)) { completedFacesRef.current.add(f); scoreRef.current += 500; } });
            setCurrentScore(scoreRef.current); if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); setIsSolved(true); await handleGameComplete();
        } catch { }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: UI_BG_COLORS[theme] }}>
            <div className="top-bar">
                <button className="icon-button leaderboard-btn" onClick={() => setIsLeaderboardOpen(true)}><MdLeaderboard size={20} /><span>Leaderboard</span></button>
                <button className="icon-button restart-btn" onClick={handleStartOver} disabled={isWelcomeOpen}><LuRefreshCw size={20} /><span>Start Over</span></button>
                <h1 style={{ alignItems: 'center' }}>CubeDoku</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                    <p style={{ color: 'var(--color-text-primary)', fontSize: '1.1rem', margin: 0 }}>
                        {formatDuration(gameTimer)}
                        {currentScore > 0 && <span style={{ marginLeft: '16px', color: 'var(--color-accent)' }}>⭐ {currentScore}</span>}
                    </p>
                    <img src="profile.svg" alt="Profile" className="profile-icon" onClick={() => setIsProfileOpen(!isProfileOpen)} />
                </div>
            </div>

            <WelcomeModal isOpen={isWelcomeOpen} onDifficultySelect={handleDifficultySelect} />

            {isConfirmResetOpen && (
                <div className="confirm-reset-overlay" onClick={() => setIsConfirmResetOpen(false)}>
                    <div className="confirm-reset-modal" onClick={e => e.stopPropagation()}>
                        <div className="confirm-reset-icon">⚠️</div>
                        <h2>Start Over?</h2>
                        <p>Progress will be lost.</p>
                        <div className="confirm-reset-actions">
                            <button className="confirm-reset-cancel" onClick={() => setIsConfirmResetOpen(false)}>Cancel</button>
                            <button className="confirm-reset-confirm" onClick={handleConfirmReset}>Reset</button>
                        </div>
                    </div>
                </div>
            )}

            {isHintConfirmOpen && (
                <div className="confirm-reset-overlay" onClick={() => !hintBusy && setIsHintConfirmOpen(false)}>
                    <div className="confirm-reset-modal" onClick={e => e.stopPropagation()}>
                        <div className="confirm-reset-icon">💡</div>
                        <h2>Use A Hint?</h2>
                        <p>Places a number and locks the cell.</p>
                        {hintError && <p className="confirm-reset-warning">{hintError}</p>}
                        <div className="confirm-reset-actions">
                            <button className="confirm-reset-cancel" onClick={() => setIsHintConfirmOpen(false)} disabled={hintBusy}>Cancel</button>
                            <button className="confirm-reset-confirm" onClick={handleHintConfirm} disabled={hintBusy}>{hintBusy ? '...' : 'Yes'}</button>
                        </div>
                    </div>
                </div>
            )}

            {completionSummary && (
                <div className="complete-overlay" onClick={() => setCompletionSummary(null)}>
                    <div className="complete-modal" onClick={e => e.stopPropagation()}>
                        <h2>Puzzle Complete</h2>
                        {completionSummary.nearbyRows && (
                            <div className="complete-board-strip">
                                <div className="complete-board-header"><span>#</span><span>Player</span><span>Time</span><span>Score</span></div>
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
                                            <span>#{row.rank}</span><span>{row.username}</span><span>{formatDuration(row.durationSeconds)}</span><span>{row.score}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="complete-actions">
                            <button className="complete-primary" onClick={() => startGameFromServer(completionSummary.difficulty)}>Play Again</button>
                            <button className="complete-secondary" onClick={() => setCompletionSummary(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <ProfileModal className="profile-modal" isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onSettings={() => { setIsProfileOpen(false); setIsUserSettingsOpen(true); }} />
            <SettingsModal isOpen={isGameSettingsOpen} onClose={() => setIsGameSettingsOpen(false)} />
            <UserSettingsModal isOpen={isUserSettingsOpen} onClose={() => setIsUserSettingsOpen(false)} />
            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onAuthSuccess={() => setHasCompletionAuthSuccess(true)} />
            <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} defaultTab={currentDifficultyRef.current} />

            <div className="right-panel">
                <h2>Numbers</h2>
                <div className="number-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} className={`number-btn ${selectedNumber === n ? 'selected' : ''}`} onClick={() => handleNumberSelect(n)}>{n}</button>)}
                </div>
            </div>

            <div className="right-panel-2">
                <h2>Actions</h2>
                <div className="action-buttons">
                    <button className="action-btn undo-btn" onClick={handleUndo} disabled={!canUndo || isSolved}><LuUndo2 size={20} /></button>
                    <button className={`action-btn eraser-btn ${selectedNumber === 'eraser' ? 'selected' : ''}`} onClick={handleEraserSelect}><LuEraser size={20} /></button>
                    <button className="action-btn hint-btn" onClick={() => setIsHintConfirmOpen(true)} disabled={isWelcomeOpen || isSolved || hintBusy}><LuLightbulb size={20} /></button>
                </div>
            </div>

            <div className="bottom-left-panel">
                <div className="extra-buttons">
                    <button className="extra-btn" onClick={() => setIsGameSettingsOpen(true)}><LuSettings size={20} /></button>
                    <button className="extra-btn" onClick={handleGithub}><FaGithub size={20} /></button>
                    <button className="extra-btn" onClick={() => setIsHowToPlayOpen(true)}><LuCircleHelp size={20} /></button>
                    <button className="extra-btn dev-solve-btn" onClick={handleDevSolve} disabled={isWelcomeOpen || isSolved}><span style={{ fontSize: '0.6rem' }}>DEV</span></button>
                </div>
            </div>

            <div className="cube-container">
                <Canvas camera={{ position: DEFAULT_CAMERA_POSITION, fov: 46 }}>
                    <ThemedEffects />
                    <SceneLighting />
                    <Suspense fallback={null}>
                        <CubeModel
                            selectedNumber={selectedNumber}
                            mockBoardData={mockBoardData}
                            onMove={handleMove}
                            conflictedFaces={conflictedFaces}
                            lockedCellIds={lockedCellIds}
                            programmaticPressCellId={programmaticPressCellId}
                            cubeRef={cubeRef}
                            cellNotes={cellNotes}
                        />
                        <AnimatedShadows cubeRef={cubeRef} />
                    </Suspense>

                    <OrbitControls
                        ref={orbitControlsRef}
                        makeDefault
                        enableDamping
                        dampingFactor={0.08}
                        rotateSpeed={0.5}
                        minDistance={4.0}
                        maxDistance={16}
                        minPolarAngle={0.18}
                        maxPolarAngle={Math.PI - 0.18}
                        enablePan={false}
                        target={[0, 0, 0]}
                    />
                </Canvas>

                <HowToPlayModal isOpen={isHowToPlayOpen} onClose={() => setIsHowToPlayOpen(false)} />
            </div>
        </div>
    );
}

export default CubeViewer;
