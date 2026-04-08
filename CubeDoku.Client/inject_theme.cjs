const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// 1. Imports
code = code.replace("import { useAuth } from './context/AuthContext';", 
                    "import { useAuth } from './context/AuthContext';\nimport { useTheme } from './context/ThemeContext';\nimport * as THREE from 'three';\nimport gsap from 'gsap';");
                    
// 2. THEME_MATERIALS & tweenMatDef
const themes = `
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
        fail: { color: 0xbf2626, roughness: 0.4, metalness: 0.05, opacity: 1 },
        base: { color: 0xE8DFD0, roughness: 0.6, metalness: 0.05 },
        num_default: { color: 0xC49A6C, roughness: 0.3, metalness: 0.8, emissive: 0x000000, emissiveIntensity: 0 },
        num_error: { color: 0xffffff, roughness: 0.3, metalness: 0.8 }
    }
};

const UI_BG_COLORS = {
    light: '#F4E3D3',
    dark: '#111418'
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
    if (target.emissive !== undefined && mat.emissive) {
        const tgtEmi = new THREE.Color(target.emissive);
        gsap.to(mat.emissive, { r: tgtEmi.r, g: tgtEmi.g, b: tgtEmi.b, duration, ease: 'power2.inOut' });
    }
    if (target.emissiveIntensity !== undefined && mat.emissiveIntensity !== undefined) {
        gsap.to(mat, { emissiveIntensity: target.emissiveIntensity, duration, ease: 'power2.inOut' });
    }
};
`;

code = code.replace("const DEFAULT_CAMERA_POSITION", themes + "\nconst DEFAULT_CAMERA_POSITION");

// 3. SceneLighting
const sceneLightingOld = `function SceneLighting() {
    return (
        <>
            <ambientLight intensity={0.3} />
            <directionalLight
                position={[5, 8, 5]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-10, -10, -10]} intensity={0.2} color="#ffffff" />
        </>
    );
}`;

const sceneLightingNew = `function SceneLighting() {
    const { theme } = useTheme() as { theme: 'light' | 'dark' };

    return (
        <>
            <ambientLight intensity={theme === 'dark' ? 0.9 : 0.6} />       
            <directionalLight
                position={[10, 20, 15]}
                intensity={theme === 'dark' ? 1.0 : 0.8}
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            {theme === 'dark' && (
                <hemisphereLight color={0x888899} groundColor={0x222222} intensity={0.5} />
            )}
        </>
    );
}

function AnimatedShadows({ cubeRef }: { cubeRef: React.RefObject<THREE.Group | null> }) {
    const { theme } = useTheme() as { theme: 'light' | 'dark' };
    const shadowColor = theme === 'light' ? 0x8a6d4e : 0x0f172a;
    const shadowOpacity = theme === 'light' ? 0.3 : 0.5;

    return (
        <ContactShadows
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, -2.4, 0]}
            opacity={shadowOpacity}
            width={12}
            height={12}
            blur={2.5}
            far={4}
            color={shadowColor}
        />
    );
}`;

code = code.replace(sceneLightingOld, sceneLightingNew);

// 4. CubeModel theme
code = code.replace("function CubeModel({", "function CubeModel({\n    cubeRef,");
code = code.replace(/selectedNumber,\n\s+mockBoardData,\n\s+onMove,\n\s+conflictedFaces,\n\s+lockedCellIds,\n\s+programmaticPressCellId\n\s*\}\s*:\s*\{/, 
                    `selectedNumber,
    mockBoardData,
    onMove,
    conflictedFaces,
    lockedCellIds,
    programmaticPressCellId
}: {
    cubeRef?: React.RefObject<THREE.Group | null>;`);

// Inside CubeModel body...
const useGLTFHook = `const { scene, nodes, materials } = useGLTF('/cube.glb') as any;`;
const useThemeHook = `    const { theme } = useTheme() as { theme: 'light' | 'dark' };
    const { scene, nodes, materials } = useGLTF('/cube.glb') as any;
    
    // Apply theme materials dynamically
    useEffect(() => {
        if (!materials) return;
        const config = THEME_MATERIALS[theme];
        tweenMatDef(materials.Cell_Material, config.cell);
        tweenMatDef(materials.Cell_Locked, config.locked);
        tweenMatDef(materials.Cell_Fail, config.fail);
        tweenMatDef(materials.Cube_Base, config.base);

        for (let i = 1; i <= 9; i++) {
            const matName = \`Asset_Num_\${i}_Mat\`;
            if (materials[matName]) {
                tweenMatDef(materials[matName], config.num_default);
                if (materials[\`\${matName}_Error\`]) {
                    tweenMatDef(materials[\`\${matName}_Error\`], config.num_error);
                }
            }
        }
    }, [theme, materials]);`;

code = code.replace(useGLTFHook, useThemeHook);

// 5. In CubeViewer wrap with cubeRef and AnimatedShadows
code = code.replace("const [mockBoardData, setMockBoardData] = useState<BoardCell[]>([]", "const cubeRef = useRef<THREE.Group>(null);\n    const [mockBoardData, setMockBoardData] = useState<BoardCell[]>([]");

const uiThemeHook = `    const [isPlayer, setIsPlayer] = useState<boolean>(true);
    
    const { theme } = useTheme() as { theme: 'light' | 'dark' };
    useEffect(() => {
        document.body.style.backgroundColor = UI_BG_COLORS[theme];
        document.body.style.color = theme === 'dark' ? '#E5E4E2' : '#2A2A2A';
    }, [theme]);`;
code = code.replace("const [isPlayer, setIsPlayer] = useState<boolean>(true);", uiThemeHook);

// Wrap CubeModel with ref and add shadows
const canvasElementsOld = `<SceneLighting />
                <Suspense fallback={null}>
                    <CubeModel
                        selectedNumber={selectedNumber}
                        mockBoardData={mockBoardData}
                        onMove={(cellId, val) => handleMove(cellId, val)}       
                        conflictedFaces={conflictedFaces}
                        lockedCellIds={lockedCellIds}
                        programmaticPressCellId={programmaticPressCellId}       
                    />
                </Suspense>`;

const canvasElementsNew = `<SceneLighting />
                <Suspense fallback={null}>
                    <CubeModel
                        cubeRef={cubeRef}
                        selectedNumber={selectedNumber}
                        mockBoardData={mockBoardData}
                        onMove={(cellId, val) => handleMove(cellId, val)}       
                        conflictedFaces={conflictedFaces}
                        lockedCellIds={lockedCellIds}
                        programmaticPressCellId={programmaticPressCellId}       
                    />
                    <AnimatedShadows cubeRef={cubeRef} />
                </Suspense>`;

code = code.replace(canvasElementsOld, canvasElementsNew);


// Fix missing Material Clones mapping for error clones:
const fixCloneMaterials = `materials[\`\${matName}_Error\`] = materials[matName].clone();`;
// Put it around where they do object keys
const objKeysOld = `Object.keys(nodes).forEach(nodeName => {
            if (nodeName.startsWith('Asset_Num_')) {
                nodes[nodeName].visible = false;
            }
        });`;
const objKeysNew = `        const safeClone = (name: string) => {
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

        for (let i = 1; i <= 9; i++) {
            const matName = \`Asset_Num_\${i}_Mat\`;
            if (safeClone(matName)) {
                materials[\`\${matName}_Error\`] = materials[matName].clone();
                materials[\`\${matName}_Error\`].color.setHex(0xffffff); // Default Error colour
            }
        }

        Object.keys(nodes).forEach(nodeName => {
            if (nodeName.startsWith('Asset_Num_')) {
                nodes[nodeName].visible = false;
            }
        });`;
code = code.replace(objKeysOld, objKeysNew);

fs.writeFileSync('src/CubeViewer.tsx', code);
