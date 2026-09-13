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
};

export default config;
