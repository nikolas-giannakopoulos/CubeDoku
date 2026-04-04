const fs = require('fs');
const contents = fs.readFileSync('public/cube.glb', 'utf8');
const start = contents.indexOf('{');
let end = 0;
let brackets = 0;
for(let i = start; i < contents.length; i++) {
   if (contents[i] === '{') brackets++;
   if (contents[i] === '}') brackets--;
   if (brackets === 0) { end = i; break; }
}
const json = JSON.parse(contents.substring(start, end + 1));
json.nodes.filter(n => n.name && n.name.startsWith('Asset')).forEach(n => {
    if (n.mesh !== undefined) {
       const mesh = json.meshes[n.mesh];
       mesh.primitives.forEach(p => {
           console.log(n.name, "uses material:", json.materials[p.material].name);
       });
    }
});
