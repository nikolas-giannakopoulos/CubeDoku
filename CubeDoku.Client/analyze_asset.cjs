const fs = require('fs');

let file = fs.readFileSync('public/cube.glb');
let chunkLength = file.readUInt32LE(12);
let json = JSON.parse(file.subarray(20, 20 + chunkLength).toString('utf8'));

let assetNode = json.nodes.find(n => n.name === 'Asset_Num_1');
console.log("Asset_Num_1 Node:", assetNode);

if (assetNode.children) {
    let meshNode = json.nodes[assetNode.children[0]];
    console.log("Asset_Num_1 Child Mesh Node:", meshNode);
    let mesh = json.meshes[meshNode.mesh];
    console.log("Mesh:", mesh);
}
