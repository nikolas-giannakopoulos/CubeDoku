const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

const hookTarget = '    }, [theme, materials]);';

if (!code.includes('// --- Critical Link Fix ---')) {
    code = code.replace(hookTarget, `
        // --- Critical Link Fix ---
        // Ensure the scene meshes actually use our cloned/updated materials     
        scene.traverse((obj) => {
            if (obj.isMesh) {
                if (obj.name.toLowerCase().includes('base')) {
                    obj.material = materials.Cube_Base;
                } else if (obj.name.includes('_') && !obj.name.startsWith('Asset_Num_')) {
                    const isLocked = lockedCellIds.has(obj.name);
                    const cellData = mockBoardData.find(d => d.id === obj.name);
                    const face = obj.name.split('_')[0];
                    const isError = cellData?.state === 'Error' || conflictedFaces.has(face);
                    
                    if (obj.name.includes('_Back')) {
                        obj.material = materials.Cell_Fail_Dark;
                    } else if (isError) {
                        obj.material = materials.Cell_Fail;
                    } else if (isLocked) {
                        obj.material = materials.Cell_Locked;
                    } else {
                        obj.material = materials.Cell_Material;
                    }
                }
            }
        });
    }, [theme, materials, lockedCellIds, mockBoardData, conflictedFaces]);`);    
    fs.writeFileSync('src/CubeViewer.tsx', code);
}
