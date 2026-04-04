const fs = require('fs');
const contents = fs.readFileSync('public/cube.glb', 'utf8');
const matches = contents.match(/(?:name":\s*")([A-Za-z0-9_]+)"/g);
if (matches) {
    console.log([...new Set(matches.map(m => m.split('"')[3]))].sort().join('\n'));
}
