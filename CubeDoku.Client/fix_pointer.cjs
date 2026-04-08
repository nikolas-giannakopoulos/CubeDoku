const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// Find handlePointerDown
const pStart = "const handlePointerDown = (e: any) => {";
const pEnd = "        if (cellID && nodes[cellID] && cellID.includes('_') && !isBackplate) {";
if (code.includes(pStart) && code.includes(pEnd)) {
    code = code.replace(/const handlePointerDown = \(e: any\) => \{[\s\S]*?const orig = mesh\.userData\.originalPosition as THREE\.Vector3;/, `const handlePointerDown = (e: any) => {
        e.stopPropagation();
        if (!isPrimaryClick(e)) return;

        const native = e.nativeEvent ?? e;
        pointerDownPos.current = { x: native.clientX, y: native.clientY };

        const cellID = getClickedCellId(e);
        if (cellID && nodes[cellID]) {
            const mesh = nodes[cellID];
            const orig = mesh.userData.originalPosition as THREE.Vector3;`);
            
    fs.writeFileSync('src/CubeViewer.tsx', code);
}
