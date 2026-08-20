# Skeletal Coordinate App Android Prototype

This directory contains the React, Three.js, and Capacitor Android application. It supports a 3D GLB reference model, explicit touch zoom controls, 25-point CFA coordinate entry, anatomical-group presence settings, multiple skeleton records, per-record notes, local saving, and backend-ready CSV transfer.

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

The bottom of the Coordinates page contains **Import CSV**, **Export CSV**, and **Save locally** actions. Coordinate CSV uses `skeleton_id,joint_name,x,y,z`; imported skeletons are added as new records. On Android, backend-ready CSV exports are saved under `Documents/Skeletal Coordinate App/` through the Capacitor Filesystem plugin.

See the [repository README](../README.md) for Android Studio instructions, the backend payload, networking notes, and attribution.
