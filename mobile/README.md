# Skeletal Coordinate App Android Prototype

This directory contains the React, Three.js, and Capacitor Android application. It supports a 3D GLB reference model, explicit touch zoom controls, 24-point CFA coordinate entry, anatomical-group presence settings, multiple skeleton records, per-record notes, local saving, a compass and GPS, CSV import and export, and sync to the backend. Entered coordinates pose the reference skeleton, and an optional landmark toggle shows the entered points as markers over it.

The GLB reference and coordinate records are independent: switching or resetting the model does not delete entered coordinates.

## Commands

This app uses pnpm, not npm. Run these from this directory:

```bash
pnpm install
pnpm run dev            # run as a website locally
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run android:sync   # builds the web app, then syncs it into the Android project
pnpm run android:open   # opens Android Studio
```

Add the model locally at `public/models/skeleton_pre-cut.glb`. GLB files are excluded from Git because the model's Sketchfab Free Standard licence does not allow sharing it as a stand-alone file, so each person downloads it from Sketchfab (see Attribution in the [repository README](../README.md)). The build converts its materials automatically, and skips that step with a warning if the file is missing.

The bottom of the Coordinates page contains **Import CSV**, **Export CSV**, and **Save & sync** actions. **Save & sync** saves the records on the device and syncs them to the backend. Coordinate CSV uses `skeleton_id,joint_name,x,y,z`; imported skeletons are added as new records, and rows with an unknown `joint_name` are skipped with a warning. On Android, CSV exports are saved under `Documents/Skeletal Coordinate App/` through the Capacitor Filesystem plugin. `public/samples/standard-skeleton-coordinates.csv` (adult) and `public/samples/standard-child-skeleton-coordinates.csv` (child, ~70% scale) are ready-made, fully-filled neutral standing poses. Import either via **Import CSV** to get a working baseline skeleton to tweak instead of starting from scratch. `standard-skeleton-lying-coordinates.csv` is a lying pose.

See the [repository README](../README.md) for Android Studio instructions, backend networking notes, and attribution, and [`../backend/README.md`](../backend/README.md) for running the backend.
