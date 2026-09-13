import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "three",
              test: /node_modules[\\/]three[\\/]/,
              priority: 2,
              maxSize: 420_000,
            },
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom)[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
});
