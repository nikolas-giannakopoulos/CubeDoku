const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

// Undo my wrong colors and put HEAD's desired colors back
code = code.replace(/const THEME_MATERIALS = \{[\s\S]*?\n\};/, `const THEME_MATERIALS = {
    dark: {
        cell: { color: 0x1A1D23, roughness: 0.4, metalness: 0.3, opacity: 0.98 },
        locked: { color: 0x242931, roughness: 0.4, metalness: 0.4, opacity: 1 },
        fail: { color: 0xd93838, roughness: 0.4, metalness: 0.3, opacity: 1 },
        fail_dark: { color: 0x661414, roughness: 0.4, metalness: 0.3, opacity: 1 },
        base: { color: 0x0F1115, roughness: 0.4, metalness: 0.5 },
        num_default: { color: 0xE5E4E2, roughness: 0.2, metalness: 0.85, emissive: 0x000000, emissiveIntensity: 0 },
        num_error: { color: 0xffffff, roughness: 0.2, metalness: 0.85 }
    },
    light: {
        cell: { color: 0xFDFBF9, roughness: 0.4, metalness: 0.05, opacity: 0.98 },
        locked: { color: 0xF3F1ED, roughness: 0.3, metalness: 0.1, opacity: 1 },
        fail: { color: 0xbf2626, roughness: 0.4, metalness: 0.05, opacity: 1 },
        fail_dark: { color: 0x8a1b1b, roughness: 0.4, metalness: 0.05, opacity: 1 },
        base: { color: 0xE8DFD0, roughness: 0.6, metalness: 0.05 },
        num_default: { color: 0xC49A6C, roughness: 0.3, metalness: 0.8, emissive: 0x000000, emissiveIntensity: 0 },
        num_error: { color: 0xffffff, roughness: 0.3, metalness: 0.8 }
    }
};`);

// If 0.38 was decent but still slightly floating, maybe 0.42 or 0.45 is better?
// Wait: 0.38 offset from cellNode. If Front cell is at Z = -0.5, and offset is -0.38, total is -0.88. 
// If earlier it was hovering outside, we should reduce the absolute offset.
// Example: If offset was -0.38, and -0.22 made it float WORSE? Let me check which direction the camera is looking.
// Or just let's try 0.42. Wait, 0.22 made it fly away. So larger number (0.42) means closer to the center? No, 0.42 adds to it. 
// Let's just use 0.44.
code = code.replace(/offset = \[0, 0, -0\.22\];/g, `offset = [0, 0, -0.42];`);
code = code.replace(/offset = \[0, 0, 0\.22\];/g, `offset = [0, 0, 0.42];`);
code = code.replace(/offset = \[0\.22, 0, 0\];/g, `offset = [0.42, 0, 0];`);
code = code.replace(/offset = \[-0\.22, 0, 0\];/g, `offset = [-0.42, 0, 0];`);
code = code.replace(/offset = \[0, 0\.22, 0\];/g, `offset = [0, 0.42, 0];`);
code = code.replace(/offset = \[0, -0\.22, 0\];/g, `offset = [0, -0.42, 0];`);

fs.writeFileSync('src/CubeViewer.tsx', code);
