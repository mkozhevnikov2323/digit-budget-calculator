import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
 const env = loadEnv(mode, process.cwd(), 'VITE_');
 return ({
  define: { __CLASSIFICATION_PREVIEW__: JSON.stringify(command === 'serve'), __CLASSIFICATION_GROUPS_V3__: JSON.stringify(env.VITE_CLASSIFICATION_GROUPS_V3_ENABLED === 'true') },
  plugins: [react(), tsconfigPaths()],
  server: {
    open: true,
  },
});
});
