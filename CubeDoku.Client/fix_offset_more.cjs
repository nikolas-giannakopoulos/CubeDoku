const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

code = code.replace(/offset = \[0, 0, -0\.42\];/g, `offset = [0, 0, -0.47];`);
code = code.replace(/offset = \[0, 0, 0\.42\];/g, `offset = [0, 0, 0.47];`);
code = code.replace(/offset = \[0\.42, 0, 0\];/g, `offset = [0.47, 0, 0];`);
code = code.replace(/offset = \[-0\.42, 0, 0\];/g, `offset = [-0.47, 0, 0];`);
code = code.replace(/offset = \[0, 0\.42, 0\];/g, `offset = [0, 0.47, 0];`);
code = code.replace(/offset = \[0, -0\.42, 0\];/g, `offset = [0, -0.47, 0];`);

fs.writeFileSync('src/CubeViewer.tsx', code);
