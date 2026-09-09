import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const serverPort = Number(process.env.PORT ?? 3001);

// Vite dev server proxies API + websocket calls to the backend so the browser
// only ever talks to one origin (no localhost/CORS fiddling).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://localhost:${serverPort}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
