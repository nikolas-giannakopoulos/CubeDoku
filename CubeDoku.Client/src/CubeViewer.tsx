import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Clone, Center, ContactShadows, Environment } from '@react-three/drei';
import { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { saveProgress, loadProgress, clearProgress, type PersistedGameState } from './useGamePersistence';
import { useTabSync } from './useTabSync';
import { useModalTransition } from './useModalTransition';
import { MdLeaderboard, MdPerson } from 'react-icons/md';
import { LuRefreshCw, LuUndo2, LuEraser, LuLightbulb, LuSettings, LuCircleHelp, LuPencil, LuPause } from 'react-icons/lu';
import { FaGithub } from 'react-icons/fa';
import { handleGithub } from './extraHandlers';
import { ProfileModal } from './ProfileModal';
import { WelcomeModal } from './WelcomeModal';
import { AuthModal } from './AuthModal';
import { LeaderboardModal } from './LeaderboardModal';
import { SettingsModal } from './SettingsModal';
import { HowToPlayModal } from './HowToPlayModal';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { pressAudio, errorAudio } from './audioManager';
import * as THREE from 'three';
import gsap from 'gsap';
import './UI.css';

const THEME_MATERIALS = {
    dark: {
        // Glossy dark gray — darker than before, IBL gives it the sheen
        cell: { color: 0x363638, roughness: 0.18, metalness: 0.45, opacity: 1 },
        locked: { color: 0x2B2B30, roughness: 0.14, metalness: 0.55, opacity: 1 },
        fail: { color: 0xCC3333, roughness: 0.22, metalness: 0.18, opacity: 1 },
        fail_dark: { color: 0x7A1A1A, roughness: 0.28, metalness: 0.20, opacity: 1 },
        base: { color: 0x252527, roughness: 0.30, metalness: 0.40 },
        // Numbers: clean crisp white — IBL provides specularity, minimal emissive for shadow visibility only
        num_default: { color: 0xFFFFFF, roughness: 0.06, metalness: 0.65, emissive: 0x333333, emissiveIntensity: 0.10 },
        num_error: { color: 0xFFFFFF, roughness: 0.06, metalness: 0.65, emissive: 0x222222, emissiveIntensity: 0.08 },
        // Hint outline ribbon — crisp mid-silver to match the white numbers and dark cells
        hint_outline: { color: 0x77777D, roughness: 0.30, metalness: 0.50, emissive: 0x44444A, emissiveIntensity: 0.25 }
    },
    light: {
        // Low roughness + moderate metalness mirrors the dark-mode gloss formula
        cell: { color: 0xFEFCFA, roughness: 0.14, metalness: 0.20, opacity: 0.98 },
        locked: { color: 0xF3F0EB, roughness: 0.12, metalness: 0.24, opacity: 1 },
        fail: { color: 0xE85548, roughness: 0.18, metalness: 0.10, opacity: 1 },
        fail_dark: { color: 0xBC3B2E, roughness: 0.22, metalness: 0.12, opacity: 1 },
        base: { color: 0xEDEAE4, roughness: 0.38, metalness: 0.10 },
        // Buttery gold — slightly de-saturated, glow dialed down to a barely-there hint
        num_default: { color: 0xD0AD48, roughness: 0.30, metalness: 0.78, emissive: 0x8A6A10, emissiveIntensity: 0.12 },
        // White on error cells — pops against the coral background; glow kept very faint
        num_error: { color: 0xFFFFFF, roughness: 0.22, metalness: 0.30, emissive: 0xEEEEEE, emissiveIntensity: 0.10 },
        // Hint outline ribbon — deep charcoal/slate to provide strong contrast against gold while fitting the elegant theme
        hint_outline: { color: 0x4A4A50, roughness: 0.40, metalness: 0.20, emissive: 0x222225, emissiveIntensity: 0.10 }
    }
};


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
    // Use != null (not truthiness) — emissive is always a Color object, but Color(0,0,0) is falsy.
    // emissiveIntensity defaults to 0 which is also falsy — must use !== undefined.
    if (target.emissive != null) {
        if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
        const tgtEmi = new THREE.Color(target.emissive);
        // Set immediately so the first frame is correct, then animate to confirm
        mat.emissive.set(tgtEmi);
        gsap.to(mat.emissive, { r: tgtEmi.r, g: tgtEmi.g, b: tgtEmi.b, duration, ease: 'power2.inOut' });
    }
    if (target.emissiveIntensity !== undefined) {
        // Set immediately, then tween for smooth transitions
        mat.emissiveIntensity = target.emissiveIntensity;
        gsap.to(mat, { emissiveIntensity: target.emissiveIntensity, duration, ease: 'power2.inOut' });
    }
    mat.needsUpdate = true;
};

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0, 8.6];
const HINT_VIEW_DISTANCE = 8.6;

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
    hintsUsed: number;
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


// Clones any asset node and applies a single uniform material to every mesh inside it.
type MatCfg = { color: number; roughness: number; metalness: number; emissive?: number; emissiveIntensity?: number };
function SimpleNumClone({
    assetNode,
    cfg,
}: {
    assetNode: any;
    cfg: MatCfg;
}) {
    const cloned = useMemo(() => {
        const clone = assetNode.clone(true);

        const mat = new THREE.MeshStandardMaterial();
        mat.color.set(cfg.color);
        mat.roughness = cfg.roughness;
        mat.metalness = cfg.metalness;
        mat.emissive.set(cfg.emissive ?? cfg.color);
        mat.emissiveIntensity = cfg.emissiveIntensity ?? 0.8;

        clone.traverse((child: any) => {
            child.visible = true;
            if (!child.isMesh) return;
            child.material = mat;
            child.raycast = () => { };
        });

        return clone;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assetNode, cfg.color, cfg.emissive, cfg.emissiveIntensity]);

    return <primitive object={cloned} visible={true} raycast={() => null} />;
}

function CubeModel({
    selectedNumber,
    mockBoardData,
    onMove,
    conflictedFaces,
    lockedCellIds,
    programmaticPressCellId,
    cellNotes,
    isPencilMode,
    onNote
}: {
    selectedNumber: number | 'eraser' | null;
    mockBoardData: BoardCell[];
    onMove: (cellId: string, value: number) => void;
    conflictedFaces: Set<string>;
    lockedCellIds: Set<string>;
    programmaticPressCellId?: string | null;
    cellNotes?: Record<string, number[]>;
    isPencilMode?: boolean;
    onNote?: (cellId: string, value: number) => void;
}) {
    // timestamp to force reload, or just a version number
    const { theme } = useTheme() as { theme: 'light' | 'dark' };
    const { scene, nodes, materials } = useGLTF('/cube.glb') as any;

    useMemo(() => {
        if (!materials) return;

        // Clone / ensure base variants exist
        if (materials['Cell_Material'] && !materials.Cell_Fail) {
            materials.Cell_Fail = materials['Cell_Material'].clone();
            materials.Cell_Fail.name = 'Cell_Fail';
        }
        if (materials['Cell_Material'] && !materials.Cell_Fail_Dark) {
            materials.Cell_Fail_Dark = materials['Cell_Material'].clone();
            materials.Cell_Fail_Dark.name = 'Cell_Fail_Dark';
        }
        if (materials['Cell_Material'] && !materials.Cell_Locked) {
            materials.Cell_Locked = materials['Cell_Material'].clone();
            materials.Cell_Locked.name = 'Cell_Locked';
        }
        if (materials['Cell_Material'] && !materials.Cube_Base) {
            materials.Cube_Base = materials['Cell_Material'].clone();
            materials.Cube_Base.name = 'Cube_Base';
        }

        for (let i = 1; i <= 9; i++) {
            const matName = `Asset_Num_${i}_Mat`;

            // If the GLB doesn't have this material, create a fresh one
            if (!materials[matName]) {
                materials[matName] = new THREE.MeshStandardMaterial({ name: matName });
            }

            const m = materials[matName] as THREE.MeshStandardMaterial;

            // ── Force-initialize number materials with bright metallic+emissive values.
            // GLTF defaults are opaque black with no emissive; we must override every
            // relevant property immediately so the first render is already correct.
            m.color.set(0xFFFFFF);
            m.roughness = 0.15;
            m.metalness = 0.85;
            m.transparent = false;
            m.opacity = 1;
            if (!m.emissive) m.emissive = new THREE.Color(0x000000);
            m.emissive.set(0xFFFFFF);
            m.emissiveIntensity = 0.9;
            m.needsUpdate = true;

            // Clone for error variant
            if (!materials[`${matName}_Error`]) {
                materials[`${matName}_Error`] = m.clone();
                materials[`${matName}_Error`].name = `${matName}_Error`;
                (materials[`${matName}_Error`] as THREE.MeshStandardMaterial).emissiveIntensity = 0.7;
                (materials[`${matName}_Error`] as THREE.MeshStandardMaterial).needsUpdate = true;
            }
        }
    }, [materials]);

    // Apply theme materials dynamically
    useEffect(() => {
        if (!materials) return;
        const config = THEME_MATERIALS[theme];
        tweenMatDef(materials.Cell_Material, config.cell);
        tweenMatDef(materials.Cell_Locked, config.locked);
        tweenMatDef(materials.Cell_Fail, config.fail);
        tweenMatDef(materials.Cell_Fail_Dark, config.fail_dark);
        tweenMatDef(materials.Cube_Base, config.base);

        for (let i = 1; i <= 9; i++) {
            const matName = `Asset_Num_${i}_Mat`;
            if (materials[matName]) {
                tweenMatDef(materials[matName], config.num_default);
                if (materials[`${matName}_Error`]) {
                    tweenMatDef(materials[`${matName}_Error`], config.num_error);
                }
            }
        }

        // --- Critical Link Fix ---
        if (scene) {
            scene.traverse((obj: any) => {
                if (obj.isMesh) {
                    if (obj.name.toLowerCase().includes('base') || obj.name === 'Cube') {
                        obj.material = materials.Cube_Base;
                    }
                }
            });
        }
    }, [theme, materials, scene]);


    // Hide the original asset meshes so they don't appear in their default export location
    // We only want to show them where we explicitly place them
    useEffect(() => {
        if (!nodes) return;
        Object.keys(nodes).forEach(nodeName => {
            // Hide all number assets (including the new _Outline variants)
            if (nodeName.startsWith('Asset_Num_') && nodes[nodeName]) {
                nodes[nodeName].visible = false;
            }
            // Cleanup duplicate meshes exported from Blender
            if (nodeName.includes('.001') || nodeName.endsWith('001')) {
                if (nodes[nodeName]) {
                    nodes[nodeName].visible = false;
                    nodes[nodeName].position.set(9999, 9999, 9999);
                    // Disable scale so it doesn't participate in anything
                    nodes[nodeName].scale.set(0, 0, 0);
                }
            }
        });
    }, [nodes]);

    // Determines if a node is a proper cell tile (e.g. Front_1_2) vs a backplate/structural mesh
    const isCellTileNode = (nodeName: string): boolean => {
        const parts = nodeName.split('_');
        return parts.length === 3 &&
            ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'].includes(parts[0]) &&
            !isNaN(Number(parts[1])) &&
            !isNaN(Number(parts[2]));
    };

    // Tracks which cell IDs were in error last render — diff used to fire pop only ONCE per new error
    const prevErroredCellsRef = useRef<Set<string>>(new Set());

    // Effect to apply error materials with two-tier system:
    //  - Cell tile meshes (Front_R_C) → bright red (Cell_Fail)
    //  - Backplate/structural meshes on same face → darker red (Cell_Fail_Dark)
    useEffect(() => {
        if (!materials) return;

        // Build the current full set of errored cell tile IDs (both sources)
        const currentErroredCells = new Set<string>();

        // Reset ALL face nodes to default material
        Object.keys(nodes).forEach((nodeName) => {
            if (['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'].some(face => nodeName.startsWith(face))) {
                const node = nodes[nodeName];
                if (node && (node as any).material) {
                    // Cell tiles get the cell material, structural backplates get the base material
                    if (isCellTileNode(nodeName)) {
                        (node as any).material = materials.Cell_Material;
                    } else {
                        (node as any).material = materials.Cube_Base;
                    }
                }
            }
        });

        // Layer 1: conflicted faces — cell tiles → bright red, backplates → darker red
        Object.keys(nodes).forEach((nodeName) => {
            const face = nodeName.split('_')[0];
            if (conflictedFaces.has(face)) {
                const node = nodes[nodeName];
                if (node && (node as any).material) {
                    if (isCellTileNode(nodeName)) {
                        (node as any).material = materials.Cell_Fail;
                        currentErroredCells.add(nodeName);
                    } else {
                        // Backplate / structural mesh on this face → subtle dark red
                        (node as any).material = materials.Cell_Fail_Dark;
                    }
                }
            }
        });

        // Layer 2: individual server-reported error cells → bright red
        mockBoardData.forEach(data => {
            const node = nodes[data.id];
            if (node && (node as any).material && data.state === 'Error') {
                (node as any).material = materials.Cell_Fail;
                currentErroredCells.add(data.id);

                // Also turn this specific cell's backplate darker red (handles individual corners/edges)
                const backNode = nodes[`${data.id}_Back`] || nodes[`${data.id}_Backplate`];
                if (backNode && (backNode as any).material) {
                    (backNode as any).material = materials.Cell_Fail_Dark;
                }
            }
        });

        // Outward pop — fires only for cells NEWLY entering error state this render.
        // Cell nudges outward from the cube face then snaps back to its exact original position.
        // The number group on that cell animates in perfect sync on the same GSAP timeline.
        currentErroredCells.forEach(cellId => {
            if (prevErroredCellsRef.current.has(cellId)) return; // already errored, skip

            const cellMesh = nodes[cellId] as any;
            if (!cellMesh) return;

            const { axis, sign } = getFacePressAxis(cellId);
            // Cache original position once — reused if the same cell re-errors later
            if (!cellMesh.userData._origPos) {
                cellMesh.userData._origPos = {
                    x: cellMesh.position.x, y: cellMesh.position.y, z: cellMesh.position.z,
                };
            }
            const origPos = cellMesh.userData._origPos;
            const NUDGE = 0.03; // very light — just a hint of movement

            // Shared timeline so cell + number move as one unit
            const tl = gsap.timeline();

            gsap.killTweensOf(cellMesh.position);
            // fromTo + yoyo: plays out then mathematically reverses to exact 'from' values
            tl.fromTo(cellMesh.position,
                { [axis]: origPos[axis] },
                { [axis]: origPos[axis] - sign * NUDGE, duration: 0.14, ease: 'power2.out', repeat: 1, yoyo: true },
                0
            );

            // Number group + Notes group: identical animation at timeline position 0 — locked in sync
            if (groupRef.current) {
                const groupNames = ['Number_' + cellId, 'Notes_' + cellId];
                groupNames.forEach(gName => {
                    const grp = groupRef.current.getObjectByName(gName) as any;
                    if (!grp) return;
                    if (!grp.userData._origPos) {
                        grp.userData._origPos = {
                            x: grp.position.x, y: grp.position.y, z: grp.position.z,
                        };
                    }
                    const grpOrig = grp.userData._origPos;
                    gsap.killTweensOf(grp.position);
                    tl.fromTo(grp.position,
                        { [axis]: grpOrig[axis] },
                        { [axis]: grpOrig[axis] - sign * NUDGE, duration: 0.14, ease: 'power2.out', repeat: 1, yoyo: true },
                        0
                    );
                });
            }
        });

        prevErroredCellsRef.current = currentErroredCells;
    }, [mockBoardData, conflictedFaces, nodes, materials, theme]);



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
        return native.button === undefined || native.button === 0;
    };

    // --- Press animation: press cell + its number inward toward cube center ---
    // pressDir: the INWARD direction for each face (cell moves deeper into the cube)
    const getFacePressAxis = (cellName: string): { axis: 'x' | 'y' | 'z'; sign: number } => {
        // Sign = OPPOSITE of the number offset direction (offset points outward; press goes inward)
        if (cellName.startsWith('Front')) return { axis: 'z', sign: 1 };  // offset -Z → outward -Z → press +Z
        if (cellName.startsWith('Back')) return { axis: 'z', sign: -1 };  // offset +Z → outward +Z → press -Z
        if (cellName.startsWith('Left')) return { axis: 'x', sign: -1 };  // offset +X → outward +X → press -X
        if (cellName.startsWith('Right')) return { axis: 'x', sign: 1 };  // offset -X → outward -X → press +X
        if (cellName.startsWith('Top')) return { axis: 'y', sign: -1 };  // offset +Y → outward +Y → press -Y
        if (cellName.startsWith('Bottom')) return { axis: 'y', sign: 1 };  // offset -Y → outward -Y → press +Y
        return { axis: 'z', sign: 1 };
    };

    // --- Press animation split into DOWN (press in, hold) and UP (spring back) ---
    const triggerCellPressDown = (cellId: string) => {
        if (!isCellTileNode(cellId)) return;
        const cellMesh = nodes[cellId] as any;
        if (!cellMesh) return;

        const { axis, sign } = getFacePressAxis(cellId);
        const PRESS_DEPTH = 0.09;

        if (cellMesh.userData._origPos === undefined) {
            cellMesh.userData._origPos = {
                x: cellMesh.position.x, y: cellMesh.position.y, z: cellMesh.position.z,
            };
        }
        const orig = cellMesh.userData._origPos;

        gsap.killTweensOf(cellMesh.position);
        // Press in and HOLD — no onComplete, stays pressed while pointer is down
        gsap.to(cellMesh.position, { [axis]: orig[axis] + sign * PRESS_DEPTH, duration: 0.08, ease: 'power2.in' });

        if (groupRef.current) {
            ['Number_' + cellId, 'Notes_' + cellId].forEach(gName => {
                const grp = groupRef.current.getObjectByName(gName) as any;
                if (!grp) return;
                if (grp.userData._origPos === undefined) {
                    grp.userData._origPos = {
                        x: grp.position.x, y: grp.position.y, z: grp.position.z,
                    };
                }
                const grpOrig = grp.userData._origPos;
                gsap.killTweensOf(grp.position);
                gsap.to(grp.position, { [axis]: grpOrig[axis] + sign * PRESS_DEPTH, duration: 0.08, ease: 'power2.in' });
            });
        }
    };

    const triggerCellPressUp = (cellId: string) => {
        if (!isCellTileNode(cellId)) return;
        const cellMesh = nodes[cellId] as any;
        if (!cellMesh) return;

        const { axis } = getFacePressAxis(cellId);
        const orig = cellMesh.userData._origPos;
        if (!orig) return;

        gsap.killTweensOf(cellMesh.position);
        gsap.to(cellMesh.position, { [axis]: orig[axis], duration: 0.35, ease: 'elastic.out(1.1, 0.4)' });

        if (groupRef.current) {
            ['Number_' + cellId, 'Notes_' + cellId].forEach(gName => {
                const grp = groupRef.current.getObjectByName(gName) as any;
                if (!grp) return;
                const grpOrig = grp.userData._origPos;
                if (grpOrig) {
                    gsap.killTweensOf(grp.position);
                    gsap.to(grp.position, { [axis]: grpOrig[axis], duration: 0.35, ease: 'elastic.out(1.1, 0.4)' });
                }
            });
        }
    };

    // Track which cell is currently held pressed (for hold-state)
    const pressedCellRef = useRef<string | null>(null);

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        if (!isPrimaryClick(e)) return;

        // Record screen position so onClick can detect a drag later.
        const native = e.nativeEvent ?? e;
        pointerDownPos.current = { x: native.clientX, y: native.clientY };

        const cellID = getClickedCellId(e);
        if (!cellID) return;
        if (lockedCellIds.has(cellID)) return;

        // Press in immediately on pointer down — hold until pointer up
        pressedCellRef.current = cellID;
        triggerCellPressDown(cellID);
    };

    const handlePointerUp = (e: any) => {
        e.stopPropagation();
        const cellId = pressedCellRef.current;
        pressedCellRef.current = null;
        if (cellId) triggerCellPressUp(cellId);
    };

    const handlePointerLeave = (e: any) => {
        e.stopPropagation();
        const cellId = pressedCellRef.current;
        if (cellId) {
            pressedCellRef.current = null;
            triggerCellPressUp(cellId);
        }
    };

    const getNumberTransform = (cellName: string) => {
        let offset: [number, number, number] = [0, 0, 0];
        let rotation: [number, number, number] = [0, 0, 0];

        if (cellName.startsWith('Front')) {
            offset = [0, 0, -0.13];
            rotation = [Math.PI, 0, Math.PI];
        }
        if (cellName.startsWith('Back')) {
            offset = [0, 0, 0.13];
            rotation = [0, 0, 0];
        }
        if (cellName.startsWith('Left')) {
            offset = [0.13, 0, 0];
            rotation = [0, Math.PI / 2, 0];
        }
        if (cellName.startsWith('Right')) {
            offset = [-0.13, 0, 0];
            rotation = [0, -Math.PI / 2, 0];
        }
        if (cellName.startsWith('Top')) {
            offset = [0, 0.13, 0];
            rotation = [Math.PI / 2, Math.PI, 0];
        }
        if (cellName.startsWith('Bottom')) {
            offset = [0, -0.13, 0];
            rotation = [Math.PI / 2, 0, Math.PI];
        }

        return { offset, rotation };
    };

    useEffect(() => {
        if (!programmaticPressCellId) return;
        if (!groupRef.current) return;

        let frameId: number | null = null;
        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 18;
        const appearDurationMs = 260;
        let numberGroup: any = null;
        let baseScale: any = null;
        let appearStartTime = 0;

        const animateAppear = (now: number) => {
            if (cancelled || !groupRef.current) return;

            const revealT = Math.min(1, (now - appearStartTime) / appearDurationMs);
            if (numberGroup) {
                const revealEase = 1 - Math.pow(1 - revealT, 3);
                const scale = 0.5 + (1 - 0.5) * revealEase;
                numberGroup.scale.copy(baseScale).multiplyScalar(scale);
            }

            if (now - appearStartTime >= appearDurationMs) {
                if (numberGroup) numberGroup.scale.copy(baseScale);
                return;
            }

            frameId = requestAnimationFrame(animateAppear);
        };

        const findAndStart = (now: number) => {
            if (cancelled || !groupRef.current) return;

            numberGroup = groupRef.current.getObjectByName('Number_' + programmaticPressCellId);
            if (!numberGroup) {
                attempts += 1;
                if (attempts < maxAttempts) {
                    frameId = requestAnimationFrame(findAndStart);
                }
                return;
            }

            baseScale = numberGroup.userData.baseScale ?? numberGroup.scale.clone();
            numberGroup.userData.baseScale = baseScale.clone();
            numberGroup.scale.copy(baseScale).multiplyScalar(0.5);
            appearStartTime = now;
            frameId = requestAnimationFrame(animateAppear);
        };

        frameId = requestAnimationFrame(findAndStart);

        return () => {
            cancelled = true;
            if (frameId !== null) cancelAnimationFrame(frameId);
            if (numberGroup && baseScale) numberGroup.scale.copy(baseScale);
        };
    }, [programmaticPressCellId, nodes]);

    return (
        <group ref={groupRef}>
            <primitive
                object={scene}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
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

                    if (cellID && isCellTileNode(cellID)) {
                        if (lockedCellIds.has(cellID)) return;

                        // Always play press sound on any valid cell click
                        pressAudio.currentTime = 0;
                        pressAudio.play().catch(e => console.warn('Audio play failed', e));

                        if (isPencilMode && typeof selectedNumber === 'number' && onNote) {
                            // Pencil mode — toggle note on the cell, don't place a real number
                            onNote(cellID, selectedNumber);
                        } else if (selectedNumber === 'eraser') {
                            onMove(cellID, 0);
                        } else if (typeof selectedNumber === 'number') {
                            onMove(cellID, selectedNumber);
                        }
                    }
                }}
            />
            {mockBoardData.map((data) => {
                const cellNode = nodes[data.id];
                const isLocked = lockedCellIds.has(data.id) || !!data.isLocked;

                const normalNodeName = `Asset_Num_${data.value}`;
                const outlineNodeName = `Asset_Num_${data.value}_Outline`;
                const normalNode = nodes[normalNodeName];
                const outlineNode = nodes[outlineNodeName];

                // Hint cells have both: the normal mesh on top + the outline mesh pushed inward.
                // Non-hint cells (or hints whose outline isn't in the GLB) use only the normal mesh.
                const hasOutlineVariant = isLocked && !!outlineNode;

                if (!cellNode || !normalNode) return null;
                const { offset, rotation } = getNumberTransform(cellNode.name);
                const faceName = data.id.split('_')[0];
                const isError = data.state === 'Error' || conflictedFaces.has(faceName);
                const cfg = isError
                    ? THEME_MATERIALS[theme].num_error
                    : THEME_MATERIALS[theme].num_default;
                const outlineCfg = THEME_MATERIALS[theme].hint_outline;

                // Amount (in local units) the outline mesh is pushed deeper into the cube face
                // so only the protruding rim of the larger mesh is visible around the normal number.
                // Using a negative value for local Z to push it *inward* behind the normal mesh.
                const INSET = -0.015;

                return (
                    <group
                        key={`${data.id}-${data.value}-${isLocked ? 'locked' : 'open'}`}
                        name={'Number_' + data.id}
                        position={[
                            cellNode.position.x + offset[0],
                            cellNode.position.y + offset[1],
                            cellNode.position.z + offset[2],
                        ]}
                        rotation={rotation}
                    >
                        <group scale={[1, 1, 1]}>
                            <Center>
                                {/* Outline mesh rendered inward (behind the normal number) */}
                                {hasOutlineVariant && (
                                    <group position={[0, 0, INSET]}>
                                        <SimpleNumClone
                                            key={`outline-${data.id}-${data.value}-${theme}`}
                                            assetNode={outlineNode!}
                                            cfg={outlineCfg}
                                        />
                                    </group>
                                )}
                                {/* Normal number mesh rendered at face level (on top of outline) */}
                                <Clone
                                    key={`clone-${data.id}-${data.value}-${isError ? 'e' : 'n'}`}
                                    object={normalNode}
                                    visible={true}
                                    raycast={() => null}
                                    inject={
                                        <meshStandardMaterial
                                            color={cfg.color}
                                            roughness={cfg.roughness}
                                            metalness={cfg.metalness}
                                            emissive={cfg.emissive ?? cfg.color}
                                            emissiveIntensity={cfg.emissiveIntensity ?? 0.8}
                                        />
                                    }
                                />
                            </Center>
                        </group>
                    </group>
                );
            })}
            {cellNotes && Object.entries(cellNotes).map(([cellId, notesArray]) => {
                // Don't render notes if the cell already has a placed number
                if (mockBoardData.some(d => d.id === cellId && d.value > 0)) return null;

                const cellNode = nodes[cellId];
                if (!cellNode) return null;
                const { offset, rotation } = getNumberTransform(cellNode.name);

                return (
                    <group
                        key={`notes-${cellId}`}
                        name={'Notes_' + cellId}
                        position={[
                            cellNode.position.x + offset[0],
                            cellNode.position.y + offset[1],
                            cellNode.position.z + offset[2],
                        ]}
                        rotation={rotation}
                    >
                        {notesArray.map(val => {
                            const assetNode = nodes[`Asset_Num_${val}`];
                            if (!assetNode) return null;
                            const idx = val - 1;
                            // 3x3 grid: cols -1,0,+1 / rows +1,0,-1 (top-to-bottom)
                            const noteCol = (idx % 3) - 1;   // -1, 0, 1
                            const noteRow = Math.floor(idx / 3) - 1; // -1, 0, 1
                            const spacing = 0.18;
                            return (
                                <group
                                    key={`note-${cellId}-${val}`}
                                    position={[noteCol * spacing, -noteRow * spacing, 0]}
                                    scale={[0.18, 0.18, 0.18]}
                                >
                                    <Center>
                                        <Clone object={assetNode} visible={true} raycast={() => null} />
                                    </Center>
                                </group>
                            );
                        })}
                    </group>
                );
            })}
        </group>
    );
}


function CubeViewer() {
    const { isLoggedIn, token, logout, user } = useAuth();
    const { theme } = useTheme() as { theme: 'light' | 'dark' };

    const [selectedNumber, setSelectedNumber] = useState<number | 'eraser' | null>(null);
    const [cellNotes, setCellNotes] = useState<Record<string, number[]>>({});
    const [isPencilMode, setIsPencilMode] = useState(false);
    const [mockBoardData, setMockBoardData] = useState<BoardCell[]>([
        { id: 'Left_1_1', value: 5 },
        { id: 'Left_2_1', value: 8, state: 'Error' },
        { id: 'Left_3_1', value: 3 },
        { id: 'Top_1_3', value: 7 },
        { id: 'Top_3_1', value: 9 },
        { id: 'Right_1_3', value: 2 },
        { id: 'Right_2_3', value: 6 },
        { id: 'Right_3_3', value: 1 },
        { id: 'Right_3_2', value: 8 },
    ]);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [exitWelcomeToAuth, setExitWelcomeToAuth] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
    const [isHintConfirmOpen, setIsHintConfirmOpen] = useState(false);
    const [hintBusy, setHintBusy] = useState(false);
    const [hintError, setHintError] = useState('');
    const [hintsUsed, setHintsUsed] = useState(0);
    const [hintBtnShake, setHintBtnShake] = useState(false);
    const [programmaticPressCellId, setProgrammaticPressCellId] = useState<string | null>(null);
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
    const [authOpenedFrom, setAuthOpenedFrom] = useState<'welcome' | 'top' | 'settings' | 'complete' | null>(null);
    const [_selectedDifficulty, setSelectedDifficulty] = useState<'Classic' | 'BrainTerror'>('Classic');
    const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);

    // --- Saved progress (for welcome-modal continue buttons) ---
    const [savedProgress, setSavedProgress] = useState<Partial<Record<'Classic' | 'BrainTerror', PersistedGameState>>>({});
    // Track whether a game is actively in progress (needed to gate autosave)
    const gameActiveRef = useRef(false);
    // Set when another tab takes over the same difficulty session
    const [isPausedByOtherTab, setIsPausedByOtherTab] = useState(false);

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
    const hintsUsedRef = useRef<number>(0);
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
    const isSavingResultRef = useRef(false);

    // Modal transition hooks for inline modals
    const confirmResetT = useModalTransition(isConfirmResetOpen);
    const hintConfirmT = useModalTransition(isHintConfirmOpen);
    const completionT = useModalTransition(!!completionSummary);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    useEffect(() => {
        const controls = orbitControlsRef.current;
        if (!controls?.object) return;

        controls.target.set(0, 0, 0);
        controls.object.up.set(0, 1, 0);
        controls.object.position.set(
            DEFAULT_CAMERA_POSITION[0],
            DEFAULT_CAMERA_POSITION[1],
            DEFAULT_CAMERA_POSITION[2]
        );
        controls.update();
    }, []);

    useEffect(() => {
        return () => {
            if (hintRotateRafRef.current !== null) {
                cancelAnimationFrame(hintRotateRafRef.current);
                hintRotateRafRef.current = null;
            }
        };
    }, []);

    // --- Load saved progress on mount so the welcome modal can show continue buttons ---
    // We only show Continue buttons for saves that belong to *today's* puzzle.
    // If the date doesn't match (i.e. the daily puzzle has changed), the save is stale
    // and we clear it from localStorage so it doesn't linger indefinitely.
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const next: Partial<Record<'Classic' | 'BrainTerror', PersistedGameState>> = {};

        const classic = loadProgress('Classic');
        if (classic) {
            if (classic.puzzleDate === today) {
                next['Classic'] = classic;
            } else {
                // Stale save from a previous day — discard it
                clearProgress('Classic');
            }
        }

        const brainTerror = loadProgress('BrainTerror');
        if (brainTerror) {
            if (brainTerror.puzzleDate === today) {
                next['BrainTerror'] = brainTerror;
            } else {
                clearProgress('BrainTerror');
            }
        }

        setSavedProgress(next);
    }, []);

    // --- Keep savedProgress in sync when another tab writes to localStorage ---
    // The 'storage' event fires in ALL OTHER tabs whenever localStorage changes.
    // This ensures the welcome-modal continue buttons always show the canonical
    // (latest winning-tab) timer, even across multiple open tabs.
    // Same date-guard as above: only include saves that belong to today's puzzle.
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (!e.key?.startsWith('cubedoku_progress_')) return;
            const today = new Date().toISOString().split('T')[0];
            const next: Partial<Record<'Classic' | 'BrainTerror', PersistedGameState>> = {};
            const classic = loadProgress('Classic');
            if (classic && classic.puzzleDate === today) next['Classic'] = classic;
            const brainTerror = loadProgress('BrainTerror');
            if (brainTerror && brainTerror.puzzleDate === today) next['BrainTerror'] = brainTerror;
            setSavedProgress(next);
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // --- Always-current snapshot ref (avoids stale closures in beforeunload) ---
    const latestSnapshotRef = useRef<PersistedGameState | null>(null);

    // --- Autosave: runs whenever board / notes / timer change ---
    // Builds the snapshot inline so every value is taken from the current render.
    // Also keeps latestSnapshotRef up-to-date for the beforeunload handler.
    useEffect(() => {
        if (!gameActiveRef.current) return;
        if (isSolved) return;
        const difficulty = currentDifficultyRef.current;
        const puzzleDate = puzzleDateRef.current;
        if (!difficulty || !puzzleDate || lockedCellsRef.current.length === 0) return;

        const snapshot: PersistedGameState = {
            difficulty,
            puzzleDate,
            boardData: mockBoardData.map(c => ({ id: c.id, value: c.value, isLocked: c.isLocked })),
            lockedCells: lockedCellsRef.current,
            cellNotes,
            gameTimer,
            mistakes: mistakesRef.current,
            score: scoreRef.current,
            hintsUsed: hintsUsedRef.current,
            completedFaces: [...completedFacesRef.current],
            savedAt: Date.now(),
        };
        latestSnapshotRef.current = snapshot;
        saveProgress(snapshot);
    }, [mockBoardData, cellNotes, gameTimer, isSolved]);

    // --- Flush save on tab-close / page-unload ---
    // Reads from latestSnapshotRef — never stale, no closure issue.
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!gameActiveRef.current) return;
            const snapshot = latestSnapshotRef.current;
            if (!snapshot || snapshot.lockedCells.length === 0) return;
            saveProgress(snapshot);
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

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

        let result: RevealRow[] = [];

        if (isFirst) {
            result.push({ ...player, isPlayer: true, slot: 1, startSlot: 2 });
            if (below[0]) result.push({ ...below[0], isPlayer: false, slot: 2 });
            if (below[1]) result.push({ ...below[1], isPlayer: false, slot: 3 });
        } else if (isLast) {
            if (above[1]) result.push({ ...above[1], isPlayer: false, slot: 1 });
            if (above[0]) result.push({ ...above[0], isPlayer: false, slot: 2 });
            
            const newSlot = (result.length + 1) as 1 | 2 | 3;
            result.push({ ...player, isPlayer: true, slot: newSlot, startSlot: newSlot });
        } else {
            if (above[0]) result.push({ ...above[0], isPlayer: false, slot: 1 });
            
            const newSlot = (result.length + 1) as 1 | 2 | 3;
            result.push({ ...player, isPlayer: true, slot: newSlot, startSlot: (newSlot + 1) as 1 | 2 | 3 });
            
            if (below[0]) result.push({ ...below[0], isPlayer: false, slot: (newSlot + 1) as 1 | 2 | 3 });
        }

        result = result.map((r, i) => {
            const finalSlot = (i + 1) as 1 | 2 | 3;
            let startSlot = r.startSlot;
            if (r.isPlayer && r.startSlot) {
                const shift = Math.max(0, r.startSlot - r.slot);
                startSlot = (finalSlot + shift) as 1 | 2 | 3;
            }
            return { ...r, slot: finalSlot, startSlot };
        });

        return result;
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
        if (isSavingResultRef.current) return;
        isSavingResultRef.current = true;

        try {
            const sendCompleteRequest = async (authToken: string) => {
                return await fetch('/api/user/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    body: JSON.stringify({
                        difficulty: summary.difficulty,
                        puzzleDate: summary.puzzleDate,
                        durationSeconds: summary.durationSeconds,
                        mistakes: summary.mistakes,
                        score: summary.score,
                        hintsUsed: summary.hintsUsed
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
        } finally {
            isSavingResultRef.current = false;
        }
    };

    const isAnyModalOpen = isWelcomeOpen || isProfileOpen || isAuthOpen || isLeaderboardOpen || isSettingsOpen || isHowToPlayOpen || isConfirmResetOpen || isHintConfirmOpen || !!completionSummary || isPausedByOtherTab;

    // Timer — starts when game begins, auto-pauses when any modal is open or another tab took over
    useEffect(() => {
        if (!isAnyModalOpen && !isSolved && currentDifficultyRef.current) {
            timerIntervalRef.current = setInterval(() => {
                setGameTimer(prev => prev + 1);
            }, 1000);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [isAnyModalOpen, isSolved]);

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
        const summaryBase: CompletionSummary = {
            durationSeconds: gameTimer,
            mistakes: mistakesRef.current,
            score: scoreRef.current,
            hintsUsed: hintsUsedRef.current,
            difficulty: currentDifficultyRef.current,
            puzzleDate: puzzleDateRef.current,
            playerName: isLoggedIn && user?.username ? user.username : 'Player 1',
            saved: false
        };

        if (!isLoggedIn || !token) {
            console.log(`Solved! Score: ${scoreRef.current} | Time: ${summaryBase.durationSeconds}s | Mistakes: ${mistakesRef.current}`);
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

    const getBoardPayload = () => {
        const faces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
        const valueMap = new Map<string, number>();
        mockBoardData.forEach(cell => valueMap.set(cell.id, cell.value));

        const currentState: number[] = [];
        const lockedState: boolean[] = [];
        faces.forEach(face => {
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const id = `${face}_${r}_${c}`;
                    currentState.push(valueMap.get(id) || 0);
                    lockedState.push(lockedCellIds.has(id));
                }
            }
        });

        return { currentState, lockedState };
    };

    const rotateToFace = async (face: string) => {
        const controls = orbitControlsRef.current;
        if (!controls?.object) return;

        const faceAngles: Record<string, { azimuth: number; polar: number }> = {
            // Front/back and left/right are mapped to the model's world orientation.
            // This ensures a hint for "Front" rotates to the face the player reads as front.
            Front: { azimuth: Math.PI, polar: Math.PI / 2 },
            Back: { azimuth: 0, polar: Math.PI / 2 },
            Left: { azimuth: Math.PI / 2, polar: Math.PI / 2 },
            Right: { azimuth: -Math.PI / 2, polar: Math.PI / 2 },
            Top: { azimuth: Math.PI, polar: 0.32 },
            Bottom: { azimuth: Math.PI, polar: Math.PI - 0.32 },
        };

        const targetAngles = faceAngles[face] ?? { azimuth: Math.PI / 4, polar: Math.PI / 3 };
        const normalizeAngle = (angle: number) => {
            const twoPi = Math.PI * 2;
            return ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
        };

        const startAzimuth = controls.getAzimuthalAngle();
        const startPolar = controls.getPolarAngle();
        const azimuthDelta = normalizeAngle(targetAngles.azimuth - startAzimuth);
        const polarDelta = targetAngles.polar - startPolar;
        const startRadius = controls.object.position.distanceTo(controls.target);
        const targetRadius = HINT_VIEW_DISTANCE;

        if (hintRotateRafRef.current !== null) {
            cancelAnimationFrame(hintRotateRafRef.current);
            hintRotateRafRef.current = null;
        }

        await new Promise<void>((resolve) => {
            const durationMs = 950;
            const startTime = performance.now();

            const tick = (now: number) => {
                const t = Math.min(1, (now - startTime) / durationMs);
                const ease = t < 0.5
                    ? 4 * t * t * t
                    : 1 - Math.pow(-2 * t + 2, 3) / 2;

                controls.target.set(0, 0, 0);
                controls.object.up.set(0, 1, 0);
                controls.setAzimuthalAngle(startAzimuth + azimuthDelta * ease);
                controls.setPolarAngle(startPolar + polarDelta * ease);

                const radius = startRadius + (targetRadius - startRadius) * ease;
                const offset = controls.object.position.clone().sub(controls.target).normalize().multiplyScalar(radius);
                controls.object.position.copy(controls.target).add(offset);
                controls.update();

                if (t < 1) {
                    hintRotateRafRef.current = requestAnimationFrame(tick);
                } else {
                    hintRotateRafRef.current = null;
                    resolve();
                }
            };

            hintRotateRafRef.current = requestAnimationFrame(tick);
        });

        await sleep(220);
    };

    const lockHintCell = (cellId: string, value: number) => {
        const [face, row, column] = cellId.split('_');
        const rowNum = Number(row);
        const colNum = Number(column);

        const existingLockedIndex = lockedCellsRef.current.findIndex(c => c.id === cellId);
        if (existingLockedIndex >= 0) {
            lockedCellsRef.current[existingLockedIndex] = { id: cellId, value, isLocked: true };
        } else {
            lockedCellsRef.current.push({ id: cellId, value, isLocked: true });
        }

        setMockBoardData(prev => {
            const idx = prev.findIndex(c => c.id === cellId);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], value, isLocked: true };
                return next;
            }
            return [...prev, { id: `${face}_${rowNum}_${colNum}`, value, isLocked: true }];
        });
    };

    const HINT_LIMITS: Record<'Classic' | 'BrainTerror', number> = { Classic: 5, BrainTerror: 3 };

    const handleHintConfirm = async () => {
        if (isWelcomeOpen || isSolved || hintBusy) return;
        setHintError('');
        setIsHintConfirmOpen(false);
        setHintBusy(true);

        try {
            const { currentState, lockedState } = getBoardPayload();
            const hintResponse = await fetch('/api/game/hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentState, lockedState })
            });

            if (!hintResponse.ok) {
                const msg = await hintResponse.text();
                throw new Error(msg || 'No hint available right now.');
            }

            const hintData = await hintResponse.json();
            const hintCellId = `${hintData.face}_${hintData.row}_${hintData.column}`;
            const hintValue = Number(hintData.value);

            await rotateToFace(hintData.face);
            const moveSuccess = await handleMove(hintCellId, hintValue, { suppressScore: true, isHint: true });
            if (!moveSuccess) {
                throw new Error('Could not apply hint move.');
            }

            // Increment hint counter
            hintsUsedRef.current += 1;
            setHintsUsed(hintsUsedRef.current);

            lockHintCell(hintCellId, hintValue);
            await sleep(40);
            setProgrammaticPressCellId(hintCellId);
            await sleep(500);
        } catch (e: any) {
            setHintError(typeof e?.message === 'string' ? e.message : 'Could not apply hint.');
        } finally {
            setProgrammaticPressCellId(null);
            setHintBusy(false);
        }
    };

    // API Move Handler
    const handleMove = async (
        cellId: string,
        newValue: number,
        options?: { suppressScore?: boolean; isHint?: boolean }
    ) => {
        if (lockedCellIds.has(cellId) || isWelcomeOpen || isSolved) return false;
        const { currentState, lockedState } = getBoardPayload();

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

                // Snapshot pre-move state for undo — but only when the board is
                // actually changing. If the cell already holds `newValue` (e.g. the
                // user double/triple-clicked the same number), skip saving a new
                // snapshot so the previous meaningful undo entry is preserved.
                const existingCell = mockBoardData.find(c => c.id === cellId);
                const isSameValue = existingCell
                    ? existingCell.value === newValue
                    : newValue === 0;

                if (!isSameValue) {
                    if (options?.isHint) {
                        // If it's a hint, don't create a new undo snapshot.
                        // Instead, if there's an existing snapshot, update it so the hint remains when undoing.
                        if (lastMoveRef.current) {
                            const existingIndex = lastMoveRef.current.boardData.findIndex(c => c.id === cellId);
                            if (existingIndex >= 0) {
                                lastMoveRef.current.boardData[existingIndex] = { id: cellId, value: newValue, isLocked: true };
                            } else {
                                lastMoveRef.current.boardData.push({ id: cellId, value: newValue, isLocked: true });
                            }
                        }
                    } else {
                        lastMoveRef.current = {
                            boardData: mockBoardData.map(c => ({ id: c.id, value: c.value, isLocked: c.isLocked })),
                            mistakes: mistakesRef.current,
                            score: scoreRef.current,
                            completedFaces: new Set(completedFacesRef.current),
                        };
                        setCanUndo(true);
                    }
                }

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
                const newLocalConflicts = [...newConflictedFaces].filter(f => !previousConflictedFaces.has(f));

                // Step 3 — Update the persistent error tracker.
                // Phase A: collect which cells the server re-confirmed as Error in this move.
                const confirmedErrorsThisMove = new Set<string>();
                let newServerError = false;
                if (data.updatedCells) {
                    data.updatedCells.forEach((update: any) => {
                        const id = `${update.face}_${update.row}_${update.column}`;
                        if (update.state === 'Error') {
                            confirmedErrorsThisMove.add(id);
                            if (!serverErrorsRef.current.has(id)) {
                                mistakesRef.current++; // new mistake
                                newServerError = true;
                            }
                            serverErrorsRef.current.add(id);
                        } else {
                            serverErrorsRef.current.delete(id); // server says valid
                        }
                    });
                }

                if (newLocalConflicts.length > 0 || newServerError) {
                    errorAudio.currentTime = 0;
                    errorAudio.play().catch(e => console.warn('Audio play failed', e));
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

                // Phase C: when erasing a cell that was in error, clear any sibling error
                // cells that the server did NOT re-confirm in this response.
                // Corner/edge conflicts affect multiple faces simultaneously; after an erase
                // the server only mentions the erased cell itself — it silently omits now-clean
                // siblings. Any serverErrorsRef entry not re-confirmed here can be safely purged.
                if (newValue === 0 && serverErrorsRef.current.size > 0) {
                    const mentionedIds = new Set<string>();
                    if (data.updatedCells) {
                        data.updatedCells.forEach((update: any) => {
                            mentionedIds.add(`${update.face}_${update.row}_${update.column}`);
                        });
                    }
                    for (const id of [...serverErrorsRef.current]) {
                        if (!confirmedErrorsThisMove.has(id) && !mentionedIds.has(id)) {
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

                // Clear notes for the cell that just received a real number
                if (newValue !== 0) {
                    setCellNotes(prev => {
                        if (!prev[cellId]) return prev;
                        const next = { ...prev };
                        delete next[cellId];
                        return next;
                    });
                }

                // Check for newly completed faces and award score (skip for hint-driven moves)
                const allFaces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
                allFaces.forEach(f => {
                    if (!completedFacesRef.current.has(f) && checkFaceComplete(updatedData, f)) {
                        completedFacesRef.current.add(f);
                        if (!options?.suppressScore) {
                            const now = Date.now();
                            const elapsed = (now - lastActionTimeRef.current) / 1000;
                            lastActionTimeRef.current = now;
                            const timeBonus = Math.round(Math.max(0, 300 - elapsed));
                            scoreRef.current += 500 + timeBonus;
                            setCurrentScore(scoreRef.current);
                        }
                    }
                });

                // Handle game solved
                if (data.isSolved) {
                    setIsSolved(true);
                    gameActiveRef.current = false;
                    // Clear the saved slot — the game is finished
                    clearProgress(currentDifficultyRef.current);
                    setSavedProgress(prev => {
                        const next = { ...prev };
                        delete next[currentDifficultyRef.current];
                        return next;
                    });
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    await handleGameComplete();
                }

                return true;

            } else {
                console.error('Move failed:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Error sending move:', error);
            return false;
        }
    };

    const handleEraserSelect = () => {
        if (selectedNumber != 'eraser') {
            setSelectedNumber('eraser');
            setIsPencilMode(false);
        }
        else {
            setSelectedNumber(null);
        }
    }

    const handlePencilToggle = () => {
        setIsPencilMode(prev => !prev);
        // Always clear the selected number (and eraser) when toggling pencil in either direction
        setSelectedNumber(null);
    };

    const handleNote = (cellId: string, value: number) => {
        // Don't allow notes on locked cells or cells with a placed number
        if (lockedCellIds.has(cellId)) return;
        const cell = mockBoardData.find(c => c.id === cellId);
        if (cell && cell.value > 0) return;

        setCellNotes(prev => {
            const existing = prev[cellId] ?? [];
            if (existing.includes(value)) {
                // Toggle off
                const next = existing.filter(n => n !== value);
                if (next.length === 0) {
                    const updated = { ...prev };
                    delete updated[cellId];
                    return updated;
                }
                return { ...prev, [cellId]: next };
            }
            return { ...prev, [cellId]: [...existing, value].sort((a, b) => a - b) };
        });
    };

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
        // Keep pencil mode when switching numbers — only tool buttons clear it
    }

    const handleDifficultySelect = (
        difficulty: 'Classic' | 'BrainTerror',
        lockedCells: { face: string; row: number; column: number; value: number }[]
    ) => {
        // Clear any existing save for this difficulty — fresh start
        clearProgress(difficulty);
        setSavedProgress(prev => {
            const next = { ...prev };
            delete next[difficulty];
            return next;
        });

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
        hintsUsedRef.current = 0;
        setHintsUsed(0);

        setSelectedDifficulty(difficulty);
        setIsWelcomeOpen(false);
        setIsPausedByOtherTab(false);
        gameActiveRef.current = true;
        // Notify other tabs that this tab is now owning this difficulty's session
        broadcast({ type: 'GAME_STARTED', difficulty });

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
        // Clear the save for the current difficulty — the player is starting over
        clearProgress(currentDifficultyRef.current);
        setSavedProgress(prev => {
            const next = { ...prev };
            delete next[currentDifficultyRef.current];
            return next;
        });
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
        setIsPencilMode(false);
        setCellNotes({});
        puzzleDateRef.current = new Date().toISOString().split('T')[0];
        gameActiveRef.current = true;
        hintsUsedRef.current = 0;
        setHintsUsed(0);
        // Restore board to original locked cells only
        setMockBoardData([...lockedCellsRef.current]);
    };

    // --- Restore a saved game from the welcome modal ---
    const handleContinueSaved = (state: PersistedGameState) => {
        // Restore all tracking refs
        const now = Date.now();
        gameStartTimeRef.current = now;
        lastActionTimeRef.current = now;
        mistakesRef.current = state.mistakes;
        scoreRef.current = state.score;
        completedFacesRef.current = new Set(state.completedFaces);
        currentDifficultyRef.current = state.difficulty;
        puzzleDateRef.current = state.puzzleDate;
        lastMoveRef.current = null;
        serverErrorsRef.current = new Set();

        setCanUndo(false);
        setGameTimer(state.gameTimer);
        setCurrentScore(state.score);
        setIsSolved(false);
        setCompletionSummary(null);
        setSelectedDifficulty(state.difficulty);
        setSelectedNumber(null);
        setIsPencilMode(false);
        hintsUsedRef.current = state.hintsUsed ?? 0;
        setHintsUsed(state.hintsUsed ?? 0);

        lockedCellsRef.current = state.lockedCells;
        setMockBoardData(state.boardData.map(c => ({ ...c })));
        setCellNotes(state.cellNotes ?? {});

        gameActiveRef.current = true;
        setIsPausedByOtherTab(false);
        setIsWelcomeOpen(false);
        // Notify other tabs that this tab is now owning this difficulty's session
        broadcast({ type: 'GAME_STARTED', difficulty: state.difficulty });
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
            gameActiveRef.current = false;
            // Clear the saved slot — the game is finished
            clearProgress(currentDifficultyRef.current);
            setSavedProgress(prev => {
                const next = { ...prev };
                delete next[currentDifficultyRef.current];
                return next;
            });
            await handleGameComplete();
        } catch (err) {
            console.error('[DEV] Auto-solve failed:', err);
        }
    };

    // --- Tab sync: handle another tab taking over or reclaiming our session ---
    const { broadcast } = useTabSync({
        onTakeover: (difficulty) => {
            // Only pause if we're actively playing the same difficulty
            if (!gameActiveRef.current) return;
            if (currentDifficultyRef.current !== difficulty) return;
            setIsPausedByOtherTab(true);
        },
        onReclaimed: (difficulty) => {
            // The reclaiming tab has taken back the session — this tab must give it up
            if (!gameActiveRef.current) return;
            if (currentDifficultyRef.current !== difficulty) return;
            // Stop autosave immediately so we don't overwrite the winner's save
            gameActiveRef.current = false;
            latestSnapshotRef.current = null;
            // Reset to welcome modal so the user can start fresh or continue
            setIsPausedByOtherTab(false);
            setIsWelcomeOpen(true);
        },
    });

    // Called when the PAUSED tab clicks "Play Here Instead".
    // Re-saves this tab's own snapshot (overwriting the other tab's save)
    // then broadcasts so the other tab gives up the session.
    const handleResumeHere = () => {
        if (latestSnapshotRef.current && latestSnapshotRef.current.lockedCells.length > 0) {
            saveProgress(latestSnapshotRef.current);
        }
        setIsPausedByOtherTab(false);
        broadcast({ type: 'GAME_RECLAIMED', difficulty: currentDifficultyRef.current });
    };

    // Called when the PAUSED tab clicks "Keep Playing There".
    // This tab concedes — it should return to the welcome modal.
    const handleGiveUpSession = () => {
        gameActiveRef.current = false;
        latestSnapshotRef.current = null;
        setIsPausedByOtherTab(false);
        setIsWelcomeOpen(true);
    };

    const isCompletionAuthenticated = isLoggedIn || hasCompletionAuthSuccess;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'var(--color-bg)'
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
                <h1 style={{ alignItems: 'center' }}>CubeDoku Viewer</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                    <p style={{ color: 'var(--color-text-primary)', fontSize: '1.1rem', margin: 0 }}>
                        {Math.floor(gameTimer / 60).toString().padStart(2, '0')}:{(gameTimer % 60).toString().padStart(2, '0')}
                        {currentScore > 0 && <span style={{ marginLeft: '16px', color: 'var(--color-accent)' }}>⭐ {currentScore}</span>}
                    </p>
                    {isLoggedIn ? (
                        <button className="icon-button stats-btn" onClick={() => setIsProfileOpen(true)}>
                            <MdPerson size={20} />
                            <span>My Stats</span>
                        </button>
                    ) : (
                        <button className="icon-button login-btn" onClick={() => { setAuthOpenedFrom('top'); setIsAuthOpen(true); }}>
                            <MdPerson size={20} />
                            <span>Log In</span>
                        </button>
                    )}
                </div>
            </div>
            {/* ── Tab-takeover pause overlay ─────────────────────────────── */}
            {isPausedByOtherTab && (
                <div className="tab-paused-overlay">
                    <div className="tab-paused-modal">
                        <div className="tab-paused-icon">
                            <LuPause size={40} strokeWidth={1.5} />
                        </div>
                        <h2>Game Paused</h2>
                        <p>You opened this puzzle in another tab.</p>
                        <div className="tab-paused-actions">
                            <button className="tab-paused-resume" onClick={handleResumeHere}>
                                Play Here Instead
                            </button>
                            <button className="tab-paused-dismiss" onClick={handleGiveUpSession}>
                                Keep Playing There
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <WelcomeModal
                isOpen={isWelcomeOpen}
                onDifficultySelect={handleDifficultySelect}
                exitToAuth={exitWelcomeToAuth}
                savedProgress={savedProgress}
                onContinue={handleContinueSaved}
                onAuthClick={() => {
                    setExitWelcomeToAuth(true);
                    setAuthOpenedFrom('welcome');
                    setIsWelcomeOpen(false);
                    setIsAuthOpen(true);
                }}
            />

            {/* Start Over Confirmation Dialog */}
            {confirmResetT.shouldRender && (
                <div className={`confirm-reset-overlay${confirmResetT.isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={() => setIsConfirmResetOpen(false)}>
                    <div className={`confirm-reset-modal${confirmResetT.isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={e => e.stopPropagation()}>
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

            {hintConfirmT.shouldRender && (
                <div className={`confirm-reset-overlay${hintConfirmT.isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={() => !hintBusy && setIsHintConfirmOpen(false)}>
                    <div className={`confirm-reset-modal${hintConfirmT.isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={e => e.stopPropagation()}>
                        <div className="confirm-reset-icon">💡</div>
                        <h2>Use A Hint?</h2>
                        <p>This will place one number for you and lock that cell as a clue.</p>
                        {hintError && <p className="confirm-reset-warning">{hintError}</p>}
                        <div className="confirm-reset-actions">
                            <button className="confirm-reset-cancel" onClick={() => setIsHintConfirmOpen(false)} disabled={hintBusy}>
                                Cancel
                            </button>
                            <button className="confirm-reset-confirm" onClick={handleHintConfirm} disabled={hintBusy}>
                                {hintBusy ? 'Applying...' : 'Yes, Use Hint'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {completionT.shouldRender && completionSummary && (
                <div className={`complete-overlay${completionT.isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={() => setCompletionSummary(null)}>
                    <div className={`complete-modal${completionT.isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={e => e.stopPropagation()}>
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
                            <p className="complete-rank">
                                You are <strong>#{completionSummary.rank ?? '-'}</strong> on this puzzle's leaderboard
                                {completionSummary.totalPlayers ? ` out of ${completionSummary.totalPlayers} players.` : '.'}
                            </p>
                        )}

                        <div className="complete-actions">
                            <button
                                className="complete-btn-play-again"
                                onClick={() => {
                                    setCompletionSummary(null);
                                    handleConfirmReset();
                                }}
                            >
                                Play Again
                            </button>
                            <button
                                className="complete-btn-menu"
                                onClick={() => {
                                    setCompletionSummary(null);
                                    setIsWelcomeOpen(true);
                                }}
                            >
                                Main Menu
                            </button>
                        </div>
                    </div>

                    {!completionSummary?.saved && !isCompletionAuthenticated && (
                        <div className={`complete-modal${completionT.isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={e => e.stopPropagation()} style={{ marginTop: '12px', padding: '16px 24px' }}>
                            <p className="complete-rank guest" style={{ margin: '0 0 16px 0', fontSize: '0.92rem' }}>
                                Log in or sign up now so your run is submitted and saved in the official leaderboard.
                            </p>
                            <button className="complete-btn-play-again" onClick={() => { setAuthOpenedFrom('complete'); setIsAuthOpen(true); }} style={{ margin: 0 }}>
                                Log In / Sign Up
                            </button>
                        </div>
                    )}
                </div>
            )}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onOpenAuth={() => { setAuthOpenedFrom('settings'); setIsAuthOpen(true); }}
            />
            <AuthModal
                isOpen={isAuthOpen}
                openedFromWelcome={authOpenedFrom === 'welcome'}
                onClose={() => {
                    setIsAuthOpen(false);
                    setExitWelcomeToAuth(false);
                    if (authOpenedFrom === 'welcome') {
                        setIsWelcomeOpen(true);
                    }
                }}
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
                    <button
                        className={`action-btn pencil-btn ${isPencilMode ? 'selected' : ''}`}
                        title="Pencil / Notes"
                        onClick={handlePencilToggle}
                    >
                        <LuPencil size={20} />
                    </button>
                    <button
                        className={`action-btn hint-btn${
                            hintsUsed >= HINT_LIMITS[currentDifficultyRef.current] ? ' hint-btn-exhausted' : ''
                        }${hintBtnShake ? ' hint-btn-shake' : ''}`}
                        title="Hint"
                        onClick={() => {
                            const limit = HINT_LIMITS[currentDifficultyRef.current];
                            if (hintsUsed >= limit) {
                                // Shake animation
                                setHintBtnShake(true);
                                setTimeout(() => setHintBtnShake(false), 600);
                                return;
                            }
                            setHintError('');
                            setIsHintConfirmOpen(true);
                        }}
                        disabled={isWelcomeOpen || isSolved || hintBusy}
                    >
                        <LuLightbulb size={20} />
                    </button>
                </div>
                {!isWelcomeOpen && (
                    <div className="hint-counter">
                        <span className={hintsUsed >= HINT_LIMITS[currentDifficultyRef.current] ? 'hint-counter-exhausted' : ''}>
                            {hintsUsed}/{HINT_LIMITS[currentDifficultyRef.current]} hints used
                        </span>
                    </div>
                )}
                {hintError && !isHintConfirmOpen && (
                    <div
                        style={{
                            marginTop: '10px',
                            color: 'var(--color-error)',
                            fontSize: '0.85rem',
                            lineHeight: 1.35,
                            textAlign: 'center'
                        }}
                    >
                        {hintError}
                    </div>
                )}
            </div>
            {/* Bottom Left Floating Panel */}
            <div className="bottom-left-panel">
                <div className="extra-buttons">
                    <button className="extra-btn" title="Settings" onClick={() => setIsSettingsOpen(true)}>
                        <LuSettings size={20} />
                    </button>
                    <button className="extra-btn" title="GitHub" onClick={handleGithub}>
                        <FaGithub size={20} />
                    </button>
                    <button className="extra-btn" title="How to Play" onClick={() => setIsHowToPlayOpen(true)}>
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
            <div className="cube-container">
                <Canvas
                    camera={{ position: DEFAULT_CAMERA_POSITION, fov: 46 }}
                    gl={{ toneMapping: 4 /* ACESFilmicToneMapping */, toneMappingExposure: theme === 'dark' ? 1.2 : 0.95 }}
                >
                    {/* Scene background — matches CSS --color-bg so there's no color mismatch at any frame */}
                    <color attach="background" args={[theme === 'dark' ? '#0A0A0A' : '#DFC4A8']} />
                    {theme === 'dark' ? (
                        <>
                            {/* Neutral gray hemisphere — no blue cast */}
                            <hemisphereLight args={[0xffffff, 0x3A3A3A, 0.9]} />
                            {/* Key light */}
                            <directionalLight position={[10, 20, 15]} intensity={1.8} />
                            {/* Left fill */}
                            <directionalLight position={[-6, 4, 4]} intensity={0.7} />
                        </>
                    ) : (
                        <>
                            {/* Warm ambient — tinted to complement the sandy background */}
                            <ambientLight intensity={0.45} color={0xFFF4E8} />
                            <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow />
                            <directionalLight position={[-4, 3, 3]} intensity={0.25} color={0xffe8c0} />
                        </>
                    )}
                    <Suspense fallback={null}>
                        {/* Environment (IBL) — this is what gives the cube its gloss and metallic sheen.
                        Without this, MeshStandardMaterial ignores metalness/roughness entirely. */}
                        {/* Both modes use the studio preset — crisp single-source IBL gives the glossy catchlight.
                        Light mode uses slightly higher intensity so the specular pops on white cells. */}
                        <Environment
                            preset="studio"
                            environmentIntensity={theme === 'dark' ? 0.65 : 0.55}
                        />
                        <CubeModel
                            selectedNumber={selectedNumber}
                            mockBoardData={mockBoardData}
                            onMove={(cellId, val) => handleMove(cellId, val)}
                            conflictedFaces={conflictedFaces}
                            lockedCellIds={lockedCellIds}
                            programmaticPressCellId={programmaticPressCellId}
                            cellNotes={cellNotes}
                            isPencilMode={isPencilMode}
                            onNote={handleNote}
                        />
                        <ContactShadows
                            position={[0, -1.65, 0]}
                            opacity={theme === 'dark' ? 0.55 : 0.45}
                            scale={3.5}
                            blur={2.2}
                            far={2}
                            color={theme === 'dark' ? '#0f172a' : '#7a5535'}
                        />
                    </Suspense>

                    <OrbitControls
                        ref={orbitControlsRef}
                        makeDefault
                        enableDamping
                        dampingFactor={0.08}
                        rotateSpeed={0.5}
                        minDistance={6.5}
                        maxDistance={16}
                        minPolarAngle={0.18}
                        maxPolarAngle={Math.PI - 0.18}
                        enablePan={false}
                        target={[0, 0, 0]}
                    />
                </Canvas>
            </div>

            <HowToPlayModal
                isOpen={isHowToPlayOpen}
                onClose={() => setIsHowToPlayOpen(false)}
            />
        </div >
    );
}

export default CubeViewer;
