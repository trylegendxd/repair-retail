import { defineConfig } from "vite";

// Vercel deployment uses Next.js built-in build system
// Vite config is minimal for compatibility only

export default defineConfig({
  server: {
    host: "0.0.0.0",
  },
});
