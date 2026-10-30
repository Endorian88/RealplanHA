import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function syncHacsFrontendPlugin(): Plugin {
  return {
    name: 'sync-hacs-frontend',
    enforce: 'post',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const hacsAppDir = path.resolve(
        __dirname,
        'custom_components/realplan3d/frontend/app'
      );
      const hacsAssetsDir = path.join(hacsAppDir, 'assets');
      if (!fs.existsSync(distDir)) return;
      try {
        fs.mkdirSync(hacsAssetsDir, {recursive: true});

        // Remove any stray AI Studio screenshot artifacts from HACS bundle if present
        const strayAistudioDir = path.join(hacsAssetsDir, 'aistudio');
        if (fs.existsSync(strayAistudioDir)) {
          fs.rmSync(strayAistudioDir, {recursive: true, force: true});
        }

        const headerBanner = '/* REALPLAN3D_BUNDLE_V4_4_1_HACS */\n';

        // Copy JS and CSS in-place without unlinking parent directories
        const distJsPath = path.join(distDir, 'assets', 'realplan3d.js');
        const hacsJsPath = path.join(hacsAssetsDir, 'realplan3d.js');
        if (fs.existsSync(distJsPath)) {
          const jsContent = fs.readFileSync(distJsPath, 'utf-8');
          const normalizedJs = jsContent.startsWith('/* REALPLAN3D_BUNDLE_')
            ? jsContent.replace(/^\/\* REALPLAN3D_BUNDLE_[^\n]*\*\/\n?/, headerBanner)
            : headerBanner + jsContent;
          fs.writeFileSync(hacsJsPath, normalizedJs, 'utf-8');
        }

        const distCssPath = path.join(distDir, 'assets', 'realplan3d.css');
        const hacsCssPath = path.join(hacsAssetsDir, 'realplan3d.css');
        if (fs.existsSync(distCssPath)) {
          const cssContent = fs.readFileSync(distCssPath, 'utf-8');
          const normalizedCss = cssContent.startsWith('/* REALPLAN3D_BUNDLE_')
            ? cssContent.replace(/^\/\* REALPLAN3D_BUNDLE_[^\n]*\*\/\n?/, headerBanner)
            : headerBanner + cssContent;
          fs.writeFileSync(hacsCssPath, normalizedCss, 'utf-8');
        }

        // Guarantee index.html in HACS bundle references deterministic realplan3d.js & realplan3d.css
        const distIndexHtmlPath = path.join(distDir, 'index.html');
        const hacsIndexHtmlPath = path.join(hacsAppDir, 'index.html');
        if (fs.existsSync(distIndexHtmlPath)) {
          let html = fs.readFileSync(distIndexHtmlPath, 'utf-8');
          html = html.replace(
            /<script[^>]+src=["'][^"']*\/assets\/[^"']+\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,
            '<script type="module" crossorigin src="./assets/realplan3d.js?v=4.4.1"></script>'
          );
          html = html.replace(
            /<link[^>]+rel=["']stylesheet["'][^>]+href=["'][^"']*\/assets\/[^"']+\.css(?:\?[^"']*)?["'][^>]*>/gi,
            '<link rel="stylesheet" crossorigin href="./assets/realplan3d.css?v=4.4.1" />'
          );
          fs.writeFileSync(hacsIndexHtmlPath, html, 'utf-8');
        }
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

