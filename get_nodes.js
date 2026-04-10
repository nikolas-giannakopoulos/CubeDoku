const fs = require('fs');
const content = fs.readFileSync('c:/Users/Nikolas/Desktop/Projects/CubeDoku/CubeDoku.Client/src/CubeViewer.tsx', 'utf8');
const match = content.match(/useGLTF\(['"](.*?)['"]\)/);
if(match) {
    console.log("Model: " + match[1]);
}
