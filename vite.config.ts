import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  define: { __CLASSIFICATION_PREVIEW__: JSON.stringify(command === 'serve') },
  plugins: [react(), tsconfigPaths()],
  server: {
    open: true,
  },
}));
