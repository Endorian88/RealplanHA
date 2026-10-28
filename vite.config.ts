import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function syncHacsFrontendPlugin(): Plugin {
  return {
    name: 'sync-hacs-frontend',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const hacsAppDir = path.resolve(
        __dirname,
        'custom_components/realplan3d/frontend/app'
      );
      if (!fs.existsSync(distDir)) return;
      try {
        fs.rmSync(hacsAppDir, {recursive: true, force: true});
        fs.mkdirSync(hacsAppDir, {recursive: true});
        fs.cpSync(distDir, hacsAppDir, {recursive: true});
      } catch (err) {
        console.warn('[sync-hacs-frontend] Failed to sync dist to HACS app dir:', err);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), syncHacsFrontendPlugin()],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/realplan3d.js',
          chunkFileNames: 'assets/realplan3d-[name].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/realplan3d.css';
            }
            return 'assets/[name][extname]';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

