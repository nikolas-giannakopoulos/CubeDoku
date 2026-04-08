const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

const regex = /const \{ scene, nodes, materials \} = useGLTF\('\/cube\.glb'\) as any;/;
const replacement = `const { scene, nodes, materials } = useGLTF('/cube.glb') as any;

    useMemo(() => {
        if (!materials) return;
        for (let i = 1; i <= 9; i++) {
            const matName = \`Asset_Num_\${i}_Mat\`;
            if (materials[matName] && !materials[\`\${matName}_Error\`]) {
                materials[\`\${matName}_Error\`] = materials[matName].clone();
                materials[\`\${matName}_Error\`].name = \`\${matName}_Error\`;
            }
        }
    }, [materials]);`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/CubeViewer.tsx', code);
