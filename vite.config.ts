import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'extropianWebUI',
      formats: ['es'],
      fileName: () => 'extropian-web-ui.js',
    },
    rollupOptions: {
      external: ['katex', 'd3-force', 'd3-scale', 'd3-selection', 'd3-shape', 'd3-axis', 'd3-zoom'],
    },
    sourcemap: true,
  },
});
