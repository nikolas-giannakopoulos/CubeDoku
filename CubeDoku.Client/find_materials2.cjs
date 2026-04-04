const fs = require('fs');
const contents = fs.readFileSync('public/cube.glb', 'utf8');
const jsonStr = contents.split('JSON')[0].substring(contents.indexOf('{'));
const start = contents.indexOf('{');
let end = 0;
let brackets = 0;
for(let i = start; i < contents.length; i++) {
   if (contents[i] === '{') brackets++;
   if (contents[i] === '}') brackets--;
   if (brackets === 0) { end = i; break; }
}
const json = JSON.parse(contents.substring(start, end + 1));
console.log(json.materials.map(m => m.name).filter(m => m.includes("Asset")));
