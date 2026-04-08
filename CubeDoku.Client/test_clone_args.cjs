const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// 1. Fix the main number Clone.
code = code.replace(
    /<Clone\s*object=\{assetNode\}\s*visible=\{true\}\s*raycast=\{\(\) => null\}\s*position=\{\[0, 0, 0\]\}\s*rotation=\{\[0, 0, 0\]\}\s*scale=\{\[1, 1, 1\]\}\s*inject=[^>]+>/g,
    (match) => {
        return match
            .replace('rotation={[0, 0, 0]}', 'rotation={[Math.PI / 2, 0, 0]}')
            .replace('scale={[1, 1, 1]}', 'scale={[0.65, 0.65, 0.65]}');
    }
);

// 2. Fix the notes Clone.
code = code.replace(
    /<Clone\s*object=\{assetNode\}\s*visible=\{true\}\s*raycast=\{\(\) => null\}\s*position=\{\[0, 0, 0\]\}\s*rotation=\{\[0, 0, 0\]\}\s*scale=\{\[1, 1, 1\]\}\s*\/>/g,
    (match) => {
        return match
            .replace('rotation={[0, 0, 0]}', 'rotation={[Math.PI / 2, 0, 0]}')
            .replace('scale={[1, 1, 1]}', 'scale={[0.22, 0.22, 0.22]}');
    }
);

// 3. Fix the "inward" press animation
code = code.replace(/addScaledVector\(outward, dummy\.offset\)/g, 'addScaledVector(outward, -dummy.offset)');

fs.writeFileSync('src/CubeViewer.tsx', code);
