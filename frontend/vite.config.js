import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

export default defineConfig({
    plugins: [react()],
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
    },
    server: {
        host: true, // Enable network access
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
            },
            '/uploads': {
                target: 'http://localhost:3002',
                changeOrigin: true,
            },
        },
    },
});
