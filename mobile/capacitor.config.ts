import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "au.edu.research.osteoplot",
  appName: "Skeletal Coordinate App",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // The prototype backend runs over HTTP on the developer's Mac.
    cleartext: true,
  },
  android: {
    backgroundColor: "#0c1f24",
    allowMixedContent: true,
  },
  plugins: {
    SystemBars: {
      // Android 15+ is always edge-to-edge. Capacitor exposes the real
      // status/navigation bar sizes as CSS variables for the web layout.
      insetsHandling: "css",
      style: "DEFAULT",
      hidden: false,
    },
  },
};

export default config;
