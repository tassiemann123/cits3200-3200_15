import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const plugins = [react()];

  // Capacitor packages the same frontend inside the Android app and does not
  // need a browser service worker. Keeping it out avoids stale app-shell files.
  if (mode !== "capacitor") {
    plugins.push(
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "Skeletal Coordinate App",
          short_name: "OsteoPlot",
          description: "Record and inspect skeletal coordinates offline.",
          theme_color: "#0c1f24",
          background_color: "#f5f3ee",
          display: "standalone",
          start_url: ".",
          scope: ".",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ["**/*.{js,css,html,glb,csv,svg,png,webmanifest}"],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
      }),
    );
  }

  return {
    plugins,
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
  };
});
