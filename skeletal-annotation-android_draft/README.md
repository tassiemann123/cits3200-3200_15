# OsteoPlot — 3D Skeletal Annotation

Independent Android-ready prototype for offline forensic anthropology and bioarchaeological coordinate visualisation. This project is intentionally separate from the e-commerce component library.

## Included prototype features

- Imports editable Lines 3D `.rot` files using their native `X Z Y colour` ordering.
- Imports CSV files with `skeleton_id,joint_name,x,y,z` columns.
- Groups multiple BP records into independently selectable, colour-coded layers.
- Displays grave outlines, survey linework, landmarks and a touch-friendly Three.js viewport.
- Provides male and female reference-model overlays.
- Adds validated manual XYZ landmarks.
- Saves projects in local browser/device storage.
- Exports the current 3D viewport as PNG and the project as JSON.
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

## Coordinate conventions

- ROT source rows use `X Z Y colour`.
- CSV and manual input use `X Y Z` column labels.
- Rendering converts survey coordinates to Three.js as `world = (X, Z, -Y)` so reduced elevation is vertical.
- The female and male GLBs are currently semi-transparent spatial reference overlays. They are aligned to the selected record's extent and principal direction but are not yet scientifically validated articulated reconstructions.

## Model attribution

- **Female Skeleton** by projectkaizen, CC BY 4.0. Source metadata is embedded in `female_skeleton.glb`.
- **Skeleton Pre-cut** by Maxime66410, Sketchfab Standard License. Source metadata is embedded in `skeleton_pre-cut.glb`.

The bundled pre-cut model has been mechanically converted from the retired `KHR_materials_pbrSpecularGlossiness` extension to standard metallic-roughness material fields so it loads in current Three.js. The source model in Downloads remains unchanged.

Confirm redistribution rights before publishing or open-sourcing an application bundle containing the pre-cut model.

## Data note

`public/samples/LN24-East-Colour.rot` is supplied research sample data for local prototype validation. Review privacy and publication requirements before distributing it outside the research team.
