const fs = require('fs');
let code = fs.readFileSync('src/CubeViewer.tsx', 'utf8');

const themeStrOld = `const THEME_MATERIALS = {
    dark: {
        cell: { color: 0x1A1D23, roughness: 0.4, metalness: 0.3, opacity: 0.98 },
        locked: { color: 0x242931, roughness: 0.4, metalness: 0.4, opacity: 1 },
        fail: { color: 0x991f1f, roughness: 0.4, metalness: 0.3, opacity: 1 },
        fail_dark: { color: 0x661414, roughness: 0.4, metalness: 0.3, opacity: 1 },
        base: { color: 0x0F1115, roughness: 0.4, metalness: 0.5 },
        num_default: { color: 0xE5E4E2, roughness: 0.2, metalness: 0.85, emissive: 0x000000, emissiveIntensity: 0 },
        num_error: { color: 0xffffff, roughness: 0.2, metalness: 0.85 }
    },`;

const themeStrNew = `const THEME_MATERIALS = {
    dark: {
        cell: { color: 0x1A1D23, roughness: 0.1, metalness: 0.5, opacity: 0.98 },
        locked: { color: 0x242931, roughness: 0.05, metalness: 0.7, opacity: 1 },
        fail: { color: 0x6e0d0d, roughness: 0.2, metalness: 0.3, opacity: 1 }, 
        fail_dark: { color: 0x4a0a0a, roughness: 0.2, metalness: 0.3, opacity: 1 }, 
        base: { color: 0x0F1115, roughness: 0.05, metalness: 0.9 },
        num_default: { color: 0xE5E4E2, roughness: 0.1, metalness: 1.0, emissive: 0x4a90e2, emissiveIntensity: 0.2 },
        num_error: { color: 0xffffff, roughness: 0.1, metalness: 0.6 }
    },`;

// To avoid exact spacing issues, let's just rewrite the whole object.
const objStr = `const THEME_MATERIALS = {
    dark: {
        cell: { color: 0x1A1D23, roughness: 0.1, metalness: 0.5, opacity: 0.98 },
        locked: { color: 0x242931, roughness: 0.05, metalness: 0.7, opacity: 1 },
        fail: { color: 0x6e0d0d, roughness: 0.2, metalness: 0.3, opacity: 1 }, 
        fail_dark: { color: 0x4a0a0a, roughness: 0.2, metalness: 0.3, opacity: 1 }, 
        base: { color: 0x0F1115, roughness: 0.05, metalness: 0.9 },
        num_default: { color: 0xE5E4E2, roughness: 0.1, metalness: 1.0, emissive: 0x4a90e2, emissiveIntensity: 0.2 },
        num_error: { color: 0xffffff, roughness: 0.1, metalness: 0.6 }
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
};`;

code = code.replace(/const THEME_MATERIALS = \{[\s\S]*?\};\n\nconst UI_BG_COLORS/g, objStr + "\n\nconst UI_BG_COLORS");

fs.writeFileSync('src/CubeViewer.tsx', code);
