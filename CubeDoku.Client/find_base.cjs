const fs = require('fs');
const contents = fs.readFileSync('public/cube.glb', 'utf8');
const matches = contents.match(/[a-zA-Z0-9_]*[B|b]ase[a-zA-Z0-9_]*/g);
if (matches) {
    console.log([...new Set(matches)].sort().join('\n'));
}
