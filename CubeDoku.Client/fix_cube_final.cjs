const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// Revert the rotation and scale on clones back to what the user had 1 hour ago ("working perfectly")
code = code.replace(/<Clone\s+object=\{assetNode\}\s+visible=\{true\}\s+raycast=\{\(\) => null\}\s+position=\{\[0, 0, 0\]\}\s+rotation=\{\[Math\.PI \/ 2, [^\]]+\]\}\s+scale=\{\[0\.65, 0\.65, 0\.65\]\}/g, `<Clone
                            object={assetNode}
                            visible={true}
                            raycast={() => null}
                            position={[0, 0, 0]}
                            rotation={[0, 0, 0]}
                            scale={[1, 1, 1]}`);

code = code.replace(/<Clone\s+object=\{assetNode\}\s+visible=\{true\}\s+raycast=\{\(\) => null\}\s+position=\{\[0, 0, 0\]\}\s+rotation=\{\[Math\.PI \/ 2, [^\]]+\]\}\s+scale=\{\[0\.22, 0\.22, 0\.22\]\}/g, `<Clone
                                        object={assetNode}
                                        visible={true}
                                        raycast={() => null}
                                        position={[0, 0, 0]}
                                        rotation={[0, 0, 0]}
                                        scale={[1, 1, 1]}`);

// Remove the centering logic
const hookStart = "    useMemo(() => {";
const hookEnd = "    }, [nodes]);";

if (code.includes(hookStart)) {
    const idx1 = code.indexOf(hookStart);
    const idx2 = code.indexOf(hookEnd, idx1) + hookEnd.length;
    code = code.substring(0, idx1) + code.substring(idx2);
}

fs.writeFileSync('src/CubeViewer.tsx', code);
