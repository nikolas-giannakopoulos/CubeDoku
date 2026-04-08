const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// Replace ANY rotation on Clones that have Math.PI or 0 with Math.PI/2
code = code.replace(/<Clone\s*([^>]*)rotation=\{\[[^\]]+\]\}/g, '<Clone\n$1rotation={[Math.PI / 2, 0, 0]}');
fs.writeFileSync('src/CubeViewer.tsx', code);
