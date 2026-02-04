import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {}
  },
  resolve: {
    alias: {
      events: 'events',
      util: 'util',
      process: 'process/browser',
      buffer: 'buffer',
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: {
      host: 'localhost'
    }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0'
  }
});
