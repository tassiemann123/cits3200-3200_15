import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "au.edu.research.osteoplot",
  appName: "Skeletal Coordinate App",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0c1f24",
  },
};

export default config;
