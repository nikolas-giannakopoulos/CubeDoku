const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

const hookRegex = /const \{ scene, nodes, materials \} = useGLTF\('\/cube\.glb'\) as any;/;
if (!code.includes('child.geometry.center()')) {
    code = code.replace(hookRegex, `const { scene, nodes, materials } = useGLTF('/cube.glb') as any;

    useMemo(() => {
        if (!nodes) return;
        Object.values(nodes).forEach(node => {
            if (node.name && node.name.startsWith('Asset_Num_')) {
                node.traverse((child) => {
                    if (child.isMesh && child.geometry && !child.userData.centered) {
                        child.geometry.computeBoundingBox();
                        child.geometry.center();
                        child.userData.centered = true;
                    }
                });
            }
        });
    }, [nodes]);`);
}
fs.writeFileSync('src/CubeViewer.tsx', code);
