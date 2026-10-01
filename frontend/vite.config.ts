import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.TALES_BACKEND_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: backend,
        changeOrigin: false,
      },
      "/socket.io": {
        target: backend,
        changeOrigin: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    // Production staging is public. Keep source maps out of the deployed
    // bundle; local Vite development remains unchanged.
    sourcemap: false,
  },
});
