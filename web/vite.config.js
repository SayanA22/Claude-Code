import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PORT = process.env.PORT || 4000;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The dev server owns the UI and forwards API calls to the Node server,
    // so the frontend uses the same relative /api paths in dev and production.
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
