const fs = require('fs');
const contents = fs.readFileSync('public/cube.glb', 'utf8');
const matches = contents.match(/[A-Za-z0-9_]*Mat[A-Za-z0-9_]*/g);
if (matches) {
    console.log([...new Set(matches)].sort().join('\n'));
}
