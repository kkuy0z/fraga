import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src/frontend',
  publicDir: '../public',
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/frontend/index.html'),
      },
      output: {
        manualChunks: {
          vendor: ['zustand', '@tanstack/react-query', 'react-router-dom'],
          admin: [
            './src/frontend/pages/AdminDashboardPage.tsx',
            './src/frontend/pages/AdminCategoriasPage.tsx',
            './src/frontend/pages/AdminProdutosPage.tsx',
            './src/frontend/pages/AdminPedidosPage.tsx',
            './src/frontend/pages/AdminUsuariosPage.tsx',
            './src/frontend/pages/AdminHorariosPage.tsx',
            './src/frontend/pages/AdminEntregaPage.tsx',
            './src/frontend/pages/AdminPagamentosPage.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/frontend'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@components': path.resolve(__dirname, 'src/shared/components'),
      '@hooks': path.resolve(__dirname, 'src/shared/hooks'),
      '@api': path.resolve(__dirname, 'src/shared/api'),
      '@store': path.resolve(__dirname, 'src/shared/store'),
      '@styles': path.resolve(__dirname, 'src/shared/styles'),
      '@utils': path.resolve(__dirname, 'src/shared/utils'),
      '@types': path.resolve(__dirname, 'src/shared/types'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.svg'],
      manifest: {
        name: 'Fraga Lanches',
        short_name: 'Fraga Lanches',
        description: 'Hamburgueria artesanal - Peça online',
        theme_color: '#1a1a1a',
        background_color: '#0c0c0c',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: '/icon-96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: '/icon-128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: '/icon-144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: '/icon-152.png',
            sizes: '152x152',
            type: 'image/png',
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-384.png',
            sizes: '384x384',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      css: {
        api: 'modern',
      },
    },
  },
  esbuild: {
    target: 'es2022',
  },
});