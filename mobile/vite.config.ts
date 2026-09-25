import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === "capacitor" ? [] : [VitePWA({
      registerType: "autoUpdate",
      // Only apply the PWA behaviour to the desktop build, not the
      // Capacitor Android build, which doesn't use service workers.
      devOptions: { enabled: false },
      manifest: {
        name: "Skeletal Coordinate App",
        short_name: "Skeletal App",
        description: "3D skeleton reconstruction and coordinate entry",
        theme_color: "#1C2227",
        background_color: "#1C2227",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Cache everything needed to run fully offline once installed,
        // including the 3D model and sample data.
        globPatterns: ["**/*.{js,css,html,glb,csv,svg,png}"],
        // Default limit is 2 MB; the bundled GLB reference model is
        // ~5.5 MB, so raise the ceiling to fit it (with headroom).
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    })]),
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
}));
