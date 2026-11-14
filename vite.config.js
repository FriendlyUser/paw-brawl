import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// From WSL the Windows node watches a network share, where native file events do not
// arrive, so tools/npm.sh sets PAW_POLL=1 and Vite polls instead.
const poll = process.env.PAW_POLL === '1';

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { port: 8790, host: true, watch: poll ? { usePolling: true, interval: 300 } : undefined },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
