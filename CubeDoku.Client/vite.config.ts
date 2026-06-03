import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { env } from 'process';

// During a production build (Vercel, Docker, CI) there is no dotnet available,
// so we skip certificate generation entirely. HTTPS is only needed locally.
const isDev = env.NODE_ENV !== 'production';

const baseFolder =
    env.APPDATA !== undefined && env.APPDATA !== ''
        ? `${env.APPDATA}/ASP.NET/https`
        : `${env.HOME}/.aspnet/https`;

const certificateName = "cubedoku.client";
const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

if (isDev) {
    if (!fs.existsSync(baseFolder)) {
        fs.mkdirSync(baseFolder, { recursive: true });
    }

    if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
        if (0 !== child_process.spawnSync('dotnet', [
            'dev-certs',
            'https',
            '--export-path',
            certFilePath,
            '--format',
            'Pem',
            '--no-password',
        ], { stdio: 'inherit', }).status) {
            throw new Error("Could not create certificate.");
        }
    }
}

// Prefer HTTPS backend target to avoid auth header loss on HTTP->HTTPS redirects.
const target = env.ASPNETCORE_URLS
    ? (env.ASPNETCORE_URLS.split(';').find(u => u.startsWith('https://'))
        ?? env.ASPNETCORE_URLS.split(';').find(u => u.startsWith('http://')))
        ?.replace('localhost', '127.0.0.1')
    : env.ASPNETCORE_HTTPS_PORT
        ? `https://127.0.0.1:${env.ASPNETCORE_HTTPS_PORT}`
        : 'https://cubedoku-server.onrender.com';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: isDev ? {
        host: 'localhost',
        proxy: {
            '^/weatherforecast': {
                target,
                secure: false,
                changeOrigin: true
            },
            '^/api': {
                target,
                secure: false,
                changeOrigin: true
            }
        },
        port: parseInt(env.DEV_SERVER_PORT || '5173'),
        strictPort: true,
        cors: true,
        hmr: {
            host: 'localhost',
            protocol: 'wss',
            clientPort: parseInt(env.DEV_SERVER_PORT || '5173')
        },
        https: {
            key: fs.readFileSync(keyFilePath),
            cert: fs.readFileSync(certFilePath),
        }
    } : {}
})
