# OsteoPlot — Android 3D Skeletal Reference Prototype

OsteoPlot is an Android-ready prototype for viewing one 3D skeletal reference project at a time. It provides a focused Three.js viewer, local GLB project switching, a safe reset to the bundled default project, research notes, screenshots, and a UI area prepared for coordinates returned by a backend.

> **Prototype status:** the 3D viewer and Android application are working. The **Backend coordinates** UI is ready to receive data, but this branch is not connected to a live backend endpoint yet.

## Main features

- View and inspect a skeletal GLB model in 3D.
- Rotate, zoom, pan, focus, reset the camera, and toggle the coordinate grid.
- Switch to another local `.glb` project without overwriting the default project.
- Reset to the bundled initial skeleton with one click.
- Store the workspace name and research notes locally on the device.
- Export the current viewport as a PNG screenshot.
- Display backend coordinate points as `Point / X / Y / Z` when an API is connected.
- Run as a Vite web application or a Capacitor Android application.

## Technology

- React 19 and TypeScript
- Three.js
- Vite
- Capacitor 8
- Android Studio / Gradle
- Vitest

## Repository layout

The application is contained in:

```text
skeletal-annotation-android_draft/
├── android/                 # Native Android project
├── public/                  # Static files and local model location
├── scripts/                 # GLB material conversion utility
├── src/
│   ├── components/          # 3D viewport and Details UI
│   ├── lib/                 # Parsers, coordinates, alignment, storage
│   ├── App.tsx              # Application state and project switching
│   └── types.ts             # Shared TypeScript data contracts
├── capacitor.config.ts
├── package.json
└── vite.config.ts
```

## Requirements

For web development:

- Node.js 22 or newer is recommended.
- `pnpm` must be installed.

For Android development:

- Android Studio
- Android SDK and an emulator or physical Android device
- JDK 21

## Install and run in a browser

From the repository root:

```bash
cd skeletal-annotation-android_draft
pnpm install
pnpm run dev
```

Open the local URL printed by Vite, normally:

```text
http://localhost:5173
```

## Run on Android

Build the web application, copy it into the Capacitor Android project, and open Android Studio:

```bash
cd skeletal-annotation-android_draft
pnpm run build
pnpm run android:sync
pnpm run android:open
```

In Android Studio:

1. Wait for Gradle sync to finish.
2. Select an Android emulator or connected device.
3. Select the `app` run configuration.
4. Click **Run**.

After every web-code change, run these commands again before rebuilding the Android app:

```bash
pnpm run build
pnpm run android:sync
```

An optional command-line debug build can be created with:

```bash
cd skeletal-annotation-android_draft/android
./gradlew assembleDebug
```

The APK will be generated under:

```text
skeletal-annotation-android_draft/android/app/build/outputs/apk/debug/
```

## Default 3D model

The bundled model is expected at:

```text
skeletal-annotation-android_draft/public/models/skeleton_pre-cut.glb
```

GLB files are excluded from Git while redistribution rights are being reviewed. Add the model locally before building, or use **Switch Project** to select another GLB from the device. Imported projects remain available only for the current session. **Reset to default project** restores the bundled model and releases the temporary imported-model resource.

## Quality checks

Run these before committing:

```bash
cd skeletal-annotation-android_draft
pnpm run typecheck
pnpm run test
pnpm run build
```

## Backend connection

### Current frontend contract

The Details panel accepts an array of `Landmark` objects. The shared type is defined in `skeletal-annotation-android_draft/src/types.ts`:

```ts
type Vec3 = [number, number, number];

interface Landmark {
  id: string;
  label: string;
  position: Vec3;
}
```

At present, `skeletal-annotation-android_draft/src/App.tsx` passes an empty `BACKEND_COORDINATES` array to the Details panel. Replace that constant with state populated by the backend when the API is available.

### Recommended API response

A minimal endpoint could be:

```http
GET /api/projects/{projectId}/coordinates
```

Recommended JSON response:

```json
{
  "coordinates": [
    {
      "id": "point-001",
      "label": "Cranium",
      "position": [1.245, 0.832, -2.104]
    },
    {
      "id": "point-002",
      "label": "Pelvis",
      "position": [1.198, 0.214, -2.087]
    }
  ]
}
```

Requirements for each coordinate:

- `id` must be unique within the project.
- `label` is the point name shown in the UI.
- `position` must contain three finite numbers in application world order: `[x, y, z]`.
- The Three.js viewer treats `y` as the vertical axis.

If the backend returns survey coordinates in `X / Z / Y` convention, convert them with `surveyToWorld` from `src/lib/coordinates.ts` before sending them to the Details panel.

### Suggested frontend integration

Add a local development environment file:

```dotenv
# skeletal-annotation-android_draft/.env.local
VITE_API_BASE_URL=https://your-backend.example.com
```

Then replace the empty coordinate constant in `App.tsx` with state and load the active project's coordinates:

```ts
const [backendCoordinates, setBackendCoordinates] = useState<Landmark[]>([]);
const [coordinateError, setCoordinateError] = useState<string | null>(null);

useEffect(() => {
  const controller = new AbortController();

  async function loadCoordinates() {
    try {
      setCoordinateError(null);
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/coordinates`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`Coordinate request failed: ${response.status}`);

      const body = await response.json() as { coordinates: Landmark[] };
      setBackendCoordinates(body.coordinates);
    } catch (error) {
      if (!controller.signal.aborted) {
        setBackendCoordinates([]);
        setCoordinateError(error instanceof Error ? error.message : "Coordinate request failed");
      }
    }
  }

  void loadCoordinates();
  return () => controller.abort();
}, [projectId]);
```

Pass the result to the existing Details component:

```tsx
<DetailsPanel
  coordinates={backendCoordinates}
  // existing props...
/>
```

The backend should provide or return a stable `projectId` when a project is selected. Loading, empty, and error states should be handled separately rather than displaying invented coordinates.

### Browser and Android networking notes

- Configure backend CORS for the Vite development origin and the Capacitor application origin.
- An Android emulator cannot reach the host computer through `localhost`; use `10.0.2.2` for a host-machine development server.
- A physical device must use a reachable LAN address or a deployed HTTPS backend.
- Prefer HTTPS. Android may block clear-text HTTP unless a development network-security configuration explicitly permits it.
- Never place private API secrets in `VITE_*` variables because they are included in the client bundle.

## Model attribution

- **Skeleton Pre-cut** by Maxime66410, Sketchfab Standard License.

Confirm model redistribution rights before publishing or open-sourcing an application bundle containing the GLB asset.
