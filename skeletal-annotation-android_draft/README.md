# OsteoPlot Android Prototype

This directory contains the React, Three.js, and Capacitor Android application. It supports a 3D GLB reference model, explicit touch zoom controls, 25-point CFA coordinate entry, anatomical-group presence settings, multiple skeleton records, per-record notes, local saving, and backend-ready JSON output.

The GLB reference and coordinate records are independent: switching or resetting the model does not delete entered coordinates.

## Commands

```bash
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run android:sync
pnpm run android:open
```

Add the bundled model locally at `public/models/skeleton_pre-cut.glb`. GLB files are intentionally excluded from Git while redistribution rights are reviewed.

On Android, backend-ready JSON exports are saved under `Documents/OsteoPlot/` through the Capacitor Filesystem plugin.

See the [repository README](../README.md) for Android Studio instructions, the backend payload, networking notes, and attribution.
