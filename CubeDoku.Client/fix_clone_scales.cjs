const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// For the main number array
// It has `position={[0, 0, 0]}`
// It has `rotation={[0, 0, 0]}`
// It has `scale={[1, 1, 1]}`
// We replace those blocks with the correct transforms!

const badRegex = /<Clone\s*object=\{assetNode\}\s*visible=\{true\}\s*raycast=\{\(\) => null\}\s*position=\{\[0, 0, 0\]\}\s*rotation=\{\[0, 0, 0\]\}\s*scale=\{\[1, 1, 1\]\}\s*inject=\{/g;
const newRegex = `<Clone
                            object={assetNode}
                            visible={true}
                            raycast={() => null}
                            position={[0, 0, 0]}
                            rotation={[Math.PI / 2, 0, 0]}
                            scale={[0.65, 0.65, 0.65]}
                            inject={<>`;

// Wait, the regex replace string can't be exactly that simple if it matches the inject part. 
// We can just use String.replace with exact block matching instead.

const blockToReplace = `<Clone
                            object={assetNode}
                            visible={true}
                            raycast={() => null}
                            position={[0, 0, 0]}
                            rotation={[0, 0, 0]}
                            scale={[1, 1, 1]}
                            inject={
                                <primitive object={materials[isError ? \`\${matName}_Error\` : matName]} attach="material" />
                            }
                        />`;

// Add a polygonOffset tweak to the primitive to prevent z-fighting since it lays perfectly flush!
const fix1 = `<Clone
                            object={assetNode}
                            visible={true}
                            raycast={() => null}
                            position={[0, 0, 0]}
                            rotation={[Math.PI / 2, 0, Math.PI]}
                            scale={[0.65, 0.65, 0.65]}
                            inject={(() => {
                                const materialNames = isError ? \`\${matName}_Error\` : matName;
                                const originalMat = materials[materialNames];
                                if (!originalMat) return null;
                                const mat = originalMat.clone();
                                mat.polygonOffset = true;
                                mat.polygonOffsetFactor = -1;
                                mat.polygonOffsetUnits = -1;
                                if (mat.isMeshStandardMaterial) {
                                    mat.emissive = mat.emissive || new THREE.Color(0x000000);
                                    mat.emissiveIntensity = 0;
                                }
                                return <primitive object={mat} attach="material" />;
                            })()}
                        />`;

code = code.replace(blockToReplace, fix1);

const notesBlockToReplace = `<Clone
                                        object={assetNode}
                                        visible={true}
                                        raycast={() => null}
                                        position={[0, 0, 0]}
                                        rotation={[0, 0, 0]}
                                        scale={[1, 1, 1]}
                                    />`;

const fix2 = `<Clone
                                        object={assetNode}
                                        visible={true}
                                        raycast={() => null}
                                        position={[0, 0, 0]}
                                        rotation={[Math.PI / 2, 0, Math.PI]}
                                        scale={[0.22, 0.22, 0.22]}
                                        inject={(() => {
                                            const originalMat = materials[\`Asset_Num_\${val}_Mat\`];
                                            if (!originalMat) return <primitive object={new THREE.MeshBasicMaterial()} attach="material" />;
                                            const mat = originalMat.clone();
                                            mat.polygonOffset = true;
                                            mat.polygonOffsetFactor = -1;
                                            mat.polygonOffsetUnits = -1;
                                            return <primitive object={mat} attach="material" />;
                                        })()}
                                    />`;
                                    
code = code.replace(notesBlockToReplace, fix2);

fs.writeFileSync('src/CubeViewer.tsx', code);
