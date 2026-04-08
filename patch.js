const fs = require('fs');
let code = fs.readFileSync('CubeDoku.Client/src/CubeViewer.tsx', 'utf8');
code = code.replace(/const numberOffset = new THREE\.Vector3\(0, 0, 0.45\);/g, "const numberOffset = new THREE.Vector3(0, 0, 0.1);");
code = code.replace(/const noteOffset = new THREE\.Vector3\(0, 0, 0.45\);/g, "const noteOffset = new THREE.Vector3(0, 0, 0.1);");
fs.writeFileSync('CubeDoku.Client/src/CubeViewer.tsx', code);
