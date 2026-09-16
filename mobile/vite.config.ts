import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Only apply the PWA behaviour to the desktop build, not the
      // Capacitor Android build, which doesn't use service workers.
      devOptions: { enabled: true },
      manifest: {
        name: "Skeletal Coordinate App",
        short_name: "OsteoPlot",
        description: "3D skeleton reconstruction and coordinate entry",
        theme_color: "#1C2227",
        background_color: "#1C2227",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        // Cache everything needed to run fully offline once installed,
        // including the 3D model and sample data.
        globPatterns: ["**/*.{js,css,html,glb,csv,svg,png}"],
      },
    }),
  ],
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