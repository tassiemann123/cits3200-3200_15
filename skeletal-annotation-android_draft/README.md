# OsteoPlot — 3D Skeletal Reference

Independent Android-ready prototype for viewing one anatomical reference project at a time. The interface retains one bundled default project and lets the user switch to another local GLB without exposing survey layers or BP records.

## Included prototype features

- Displays one active skeletal reference project.
- Switches to another project using a local `.glb` file.
- Restores the bundled initial project with a one-click reset.
- Automatically orients, centres and normalises models to a consistent display height.
- Provides orbit, zoom, pan, focus, reset and optional grid controls.
- Keeps model source, licensing information and research notes in the Details panel.
- Provides a backend-ready coordinate table for point labels and X, Y, Z values.
- Saves viewer preferences in local browser/device storage.
- Exports the current 3D viewport as a PNG.
- Includes Capacitor configuration and an Android project.

## Commands

```bash
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run android:sync
pnpm run android:open
```

The Android Studio project is generated in `android/`. Build and device testing should be completed from Android Studio.

## Reference models

Add this file locally to enable the bundled model:

```text
public/models/skeleton_pre-cut.glb
```

GLB files are intentionally excluded from Git while redistribution rights are being reviewed. The application can still build without the bundled file, and another GLB can be selected with **Switch Project** or **Switch to another project**. Imported object URLs only exist for the current application session and are not saved to browser/device storage. **Reset to default project** restores the original bundled model.

## Model attribution

- **Skeleton Pre-cut** by Maxime66410, Sketchfab Standard License. Source metadata is embedded in `skeleton_pre-cut.glb`.

The pre-cut model is mechanically converted from the retired `KHR_materials_pbrSpecularGlossiness` extension to standard metallic-roughness material fields so it loads in current Three.js. The source model in Downloads remains unchanged.

Confirm redistribution rights before publishing or open-sourcing an application bundle containing the model.
