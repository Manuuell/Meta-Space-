import { defineConfig } from 'vite';

// Rutas relativas: el build tiene que abrir desde cualquier carpeta o
// subdirectorio (GitHub Pages, itch.io), no solo desde la raiz de un dominio.
export default defineConfig({
  base: './',
  // Three.js entero ronda los 600 kB sin comprimir (unos 150 kB con gzip):
  // es lo esperado para un juego 3D, no algo que trocear.
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5173, host: '127.0.0.1' },
});
