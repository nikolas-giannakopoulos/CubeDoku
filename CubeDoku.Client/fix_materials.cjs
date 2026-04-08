const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

const anchor = `tweenMatDef(materials.Cube_Base, config.base);

        for (let i = 1; i <= 9; i++) {
            const matName = \`Asset_Num_\${i}_Mat\`;
            if (materials[matName]) {
                tweenMatDef(materials[matName], config.num_default);
                tweenMatDef(materials[\`\${matName}_Error\`], config.num_error);
            }
        }`;

const replacement = anchor + `

        // --- Critical Link Fix ---
        scene.traverse((obj) => {
            if (obj.isMesh) {
                if (obj.name.toLowerCase().includes('base')) {
                    obj.material = materials.Cube_Base;
                } else if (obj.name.includes('_') && !obj.name.startsWith('Asset_Num_')) { // Face cells
                    const isLocked = lockedCellIds.has(obj.name);
                    const cellData = mockBoardData.find(d => d.id === obj.name);
                    const face = obj.name.split('_')[0];
                    const isError = cellData?.state === 'Error' || conflictedFaces.has(face);
                    
                    if (obj.name.includes('_Back')) {
                        obj.material = materials.Cell_Fail_Dark; // Default backplate behavior if you added it
                    } else if (isError) {
                        obj.material = materials.Cell_Fail;
                    } else if (isLocked) {
                        obj.material = materials.Cell_Locked;
                    } else {
                        obj.material = materials.Cell_Material;
                    }
                }
            }
        });`;

if (!code.includes('// --- Critical Link Fix ---')) {
    code = code.replace(anchor, replacement);
    fs.writeFileSync('src/CubeViewer.tsx', code);
}
