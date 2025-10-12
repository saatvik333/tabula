import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: {
        newtab: path.resolve(__dirname, "src/pages/newtab/index.html"),
        options: path.resolve(__dirname, "src/pages/options/index.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  resolve: {
    alias: {
      $src: path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
