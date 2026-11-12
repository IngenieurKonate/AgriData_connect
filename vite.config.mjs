import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep local paths unchanged; avoids Windows network-drive discovery.
  resolve: { preserveSymlinks: true },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
