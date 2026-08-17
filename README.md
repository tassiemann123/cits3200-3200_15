# OsteoPlot — Android Skeletal Coordinate Prototype

OsteoPlot is an Android-ready prototype for reviewing a 3D skeletal reference model and entering standard skeletal landmark coordinates. It combines a stable Three.js GLB viewer with a 25-point CFA coordinate workflow designed for later backend integration.

> **Prototype status:** the 3D viewer, coordinate forms, multiple skeleton records, local saving, and Android application work locally. A live backend endpoint has not been connected yet.

## Main features

- Inspect one bundled or imported `.glb` reference model with rotate, zoom, pan, focus, camera reset, and grid controls.
- Reset an imported model to the bundled skeleton without changing coordinate data.
- Enter X, Y, and Z values for 25 CFA landmarks across seven anatomical groups.
- Mark a body group as **Present** or **Not present**; absent groups are omitted from backend output.
- Create, switch, and rename multiple skeleton records.
- Keep research notes per skeleton record and save records in local browser/device storage.
- See the active skeleton record directly from the 3D viewer and use explicit zoom controls when pinch gestures are inconvenient.
- Preview complete, backend-ready points, export them as JSON, and export a PNG screenshot of the viewer.
- Run as a Vite web app or a Capacitor Android app.

## Data model

The prototype deliberately separates these concepts:

- **Reference model:** the GLB displayed in the 3D viewer. Imported models last for the current session.
- **Skeleton record:** a named set of CFA coordinates, absent-group settings, and research notes. Multiple records can share the same reference model.

Switching or resetting a GLB therefore cannot delete a skeleton record.

## Project layout

```text
skeletal-annotation-android_draft/
├── android/                 # Native Capacitor Android project
├── public/models/           # Local GLB model location
├── scripts/                 # GLB material conversion utility
└── src/
    ├── components/          # Viewer, coordinate and details panels
    ├── data/cfaSchema.ts    # 25 landmarks and anatomical groups
    ├── lib/                 # Backend mapping, parsers and viewer utilities
    ├── App.tsx              # Application state and workflows
    └── types.ts             # Shared TypeScript contracts
```

## Requirements

- Node.js 22 or newer
- `pnpm`
- Android Studio, Android SDK, and an emulator or physical device for Android testing
- JDK 21 for command-line Android builds

## Run in a browser

```bash
cd skeletal-annotation-android_draft
pnpm install
pnpm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Run on Android

```bash
cd skeletal-annotation-android_draft
pnpm run build
pnpm run android:sync
pnpm run android:open
```

In Android Studio, wait for Gradle sync, select an emulator or device, select the `app` run configuration, and click **Run**.

After every frontend change, run `pnpm run build` and `pnpm run android:sync` before rebuilding the Android app.

For a command-line debug APK:

```bash
cd skeletal-annotation-android_draft/android
./gradlew assembleDebug
```

The APK is generated under `android/app/build/outputs/apk/debug/`.

## Default 3D model

The bundled model is expected at:

```text
skeletal-annotation-android_draft/public/models/skeleton_pre-cut.glb
```

GLB files are excluded from Git while redistribution rights are reviewed. Add the model locally before building, or use **Switch Model** to choose another GLB on the device.

## Backend connection

Complete coordinates are converted by `src/lib/backendCoordinates.ts`. Partial coordinates and groups marked **Not present** are not included in the generated `Landmark[]`.

The **JSON** button in Details exports this exact backend-ready payload locally, so coordinate mapping can be tested before the live API is connected. In Android it uses Capacitor Filesystem and writes to `Documents/OsteoPlot/`; in a browser it downloads the JSON normally.

A recommended request for one skeleton record is:

```http
POST /api/skeleton-records
Content-Type: application/json
```

```json
{
  "recordId": "skeleton-record-1",
  "name": "Skeleton 1",
  "excludedGroups": ["left_arm"],
  "coordinates": [
    {
      "id": "centre_of_head",
      "label": "Centre Of Head",
      "position": [1.245, 0.832, -2.104]
    }
  ]
}
```

Each position must contain three finite numbers in `[x, y, z]` order. When the backend is ready, put its base URL in a local environment variable such as `VITE_API_BASE_URL` and send the active record through an API service instead of directly from the UI component.

Networking notes:

- Configure backend CORS for the Vite and Capacitor origins.
- Android emulators reach a backend on the host computer through `10.0.2.2`, not `localhost`.
- Physical devices need a reachable LAN address or deployed HTTPS endpoint.
- Do not put private API secrets in `VITE_*` values because they are bundled into the client.

## Quality checks

```bash
cd skeletal-annotation-android_draft
pnpm run typecheck
pnpm run test
pnpm run build
```

## Model attribution

- **Skeleton Pre-cut** by Maxime66410, Sketchfab Standard License.

Confirm model redistribution rights before publishing a bundle containing the GLB asset.
