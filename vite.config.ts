import { defineConfig } from 'vite';
import externalGlobals from 'rollup-plugin-external-globals';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/addon.tsx',
      formats: ['es'],
      fileName: () => 'addon.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
      plugins: [
        externalGlobals({
          'react': 'WealthfolioAddonHost.React',
          'react-dom': 'WealthfolioAddonHost.ReactDOM',
          'react/jsx-runtime': 'WealthfolioAddonHost.jsxRuntime',
          'react-dom/client': 'WealthfolioAddonHost.ReactDOMClient',
        }),
      ],
    },
    minify: false,
    sourcemap: true,
  },
});
