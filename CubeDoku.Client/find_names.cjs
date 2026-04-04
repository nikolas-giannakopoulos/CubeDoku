const fs = require('fs');
const contents = fs.readFileSync('public/cube.glb', 'utf8');
const matches = contents.match(/(Cell|Backplate|Base|Front|Back|Top|Bottom|Left|Right|Asset)[_A-Za-z0-9]*/g);
if (matches) {
    console.log([...new Set(matches)].sort().join('\n'));
}
