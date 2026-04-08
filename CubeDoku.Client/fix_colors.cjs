const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// Revert environments or any hacked lighting if it was removed. Ensure Environment is present.
if (!code.includes('<Environment preset="city" />') && !code.includes('<Environment preset="studio" />')) {
    code = code.replace('<ambientLight intensity={Math.PI / 2} />', '<ambientLight intensity={Math.PI / 2} />\n                <Environment preset="city" />');
    code = code.replace("import { Canvas } from '@react-three/fiber';", "import { Canvas } from '@react-three/fiber';\nimport { Environment } from '@react-three/drei';");
}

fs.writeFileSync('src/CubeViewer.tsx', code);
