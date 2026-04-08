const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// Fix themes reliably with regex matching parts of the theme so line endings don't break it
code = code.replace(/dark:\s*\{[\s\S]*?num_error[^}]+\},/g, `dark: {
        cell: { color: 0x1A1D23, roughness: 0.1, metalness: 0.5, opacity: 0.98 },
        locked: { color: 0x242931, roughness: 0.05, metalness: 0.7, opacity: 1 },
        fail: { color: 0x6e0d0d, roughness: 0.2, metalness: 0.3, opacity: 1 }, 
        fail_dark: { color: 0x4a0a0a, roughness: 0.2, metalness: 0.3, opacity: 1 }, 
        base: { color: 0x0F1115, roughness: 0.05, metalness: 0.9 },
        num_default: { color: 0xE5E4E2, roughness: 0.1, metalness: 1.0, emissive: 0x4a90e2, emissiveIntensity: 0.2 },
        num_error: { color: 0xffffff, roughness: 0.1, metalness: 0.6 }
    },`);

code = code.replace(/<ambientLight intensity=\{theme === 'dark' \? 0\.9 : 0\.6\} \/>/g, `<ambientLight intensity={0.3} />`);
code = code.replace(/intensity=\{theme === 'dark' \? 1\.0 : 0\.8\}/g, `intensity={theme === 'dark' ? 1.5 : 0.8}`);
code = code.replace(/position=\{\[10, 20, 15\]\}/g, `position={[5, 8, 5]}`);

fs.writeFileSync('src/CubeViewer.tsx', code);
