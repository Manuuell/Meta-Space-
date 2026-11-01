import { defineConfig } from 'vite';

// En desarrollo y en `vite preview`, /api va al servidor de IA (npm run serve)
// para que el juego use siempre la API en su mismo origen, como en producción.
const api = { '/api': 'http://127.0.0.1:8787' };

// Rutas relativas: el build tiene que abrir desde cualquier carpeta o
// subdirectorio (GitHub Pages, itch.io), no solo desde la raiz de un dominio.
export default defineConfig({
  base: './',
  // Three.js entero ronda los 600 kB sin comprimir (unos 150 kB con gzip):
  // es lo esperado para un juego 3D, no algo que trocear.
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5173, host: '127.0.0.1', proxy: api },
  preview: { proxy: api },
});
