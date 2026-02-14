import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import externalGlobals from "rollup-plugin-external-globals";
import { execSync } from "child_process";
import { readFileSync } from "fs";

// Get version from package.json
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const version = pkg.version;

// Get git commit hash
let gitCommit = "unknown";
try {
  gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  gitCommit = "no-git";
}

// Build timestamp
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    // Replace process.env for browser compatibility
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": JSON.stringify({}),
    // Also define global for some libraries
    global: "globalThis",
    // Build info
    __APP_VERSION__: JSON.stringify(version),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/addon.tsx"),
      formats: ["es"],
      fileName: () => "addon.js",
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      plugins: [
        externalGlobals({
          react: "React",
          "react-dom": "ReactDOM",
        }),
      ],
      output: {
        // Force single bundle - no code splitting
        inlineDynamicImports: true,
        manualChunks: undefined,
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
  server: {
    port: 3001,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
});
