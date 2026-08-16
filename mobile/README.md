# OsteoPlot — 3D Skeleton Plotter (Mobile)

A mobile tool for forensic anthropologists and bioarchaeologists to record skeletal joint coordinates on-site and get an immediate 3D visual check, before leaving the excavation site.

Built for Dr Ambika Flavel, Centre for Forensic Anthropology, UWA — CITS3200 Professional Computing.

---

## What this app does

On-site, a researcher currently records skeletal measurements on paper and only digitises/checks them back at the office — meaning a bad measurement often isn't caught until it's too late to easily re-check on site.

This app lets a researcher enter the standard set of skeletal joint coordinates directly on their phone and see an immediate, rotatable 3D visual of the resulting skeleton — catching obvious errors (wrong axis, misplaced digit, etc.) before leaving the site.

This is the **mobile / single-skeleton** half of the wider 3D Skeleton Plotter project. A separate desktop tool (not covered by this README) handles combining multiple skeletons into a full site reconstruction.

---

## Features

- ✅ 3D skeleton viewport — rotate (drag), zoom (pinch or on-screen +/− buttons), pan (two-finger drag)
- ✅ Coordinate entry form matching the official 25-point CFA (Centre for Forensic Anthropology) recording schema, grouped exactly like the paper form
- ✅ Multiple skeleton "projects" — switch between, create new, and rename skeletons from one screen
- ✅ Mark a body section (e.g. "Left arm") as **not present**, for skeletons with genuinely missing limbs — dims and disables that section without deleting any data already entered, in case it's re-enabled
- ✅ Reset button to clear all entered coordinates for the current skeleton (with a confirmation prompt)
- 🚧 Export button — present in the UI, **not yet functional** (placeholder). Intended to eventually save skeleton data/screenshots to local device storage.
- 🚧 Coordinates do not yet move the 3D skeleton's bones — the input form and the 3D viewer are built and working independently, but are not yet wired together. This is the next major piece of work.

---

## Quick start

Full environment setup (Node, Android Studio, first-time project setup) is covered in [`SETUP.md`](./SETUP.md). Once set up:

```
cd mobile/skeleton-app
npm run dev
```

Open the printed `localhost` URL in a browser to test quickly, or see `SETUP.md` for running it as a real Android app.

---

## How to use the app

1. **Select or create a skeleton.** Tap the button top-left (shows the current skeleton's name) to open the list of skeletons. Tap **+ New skeleton** to start a new record, or tap an existing one to switch to it. Tap the pencil icon next to any name to rename it.

2. **Rotate/inspect the 3D model.** Drag anywhere on the skeleton to orbit around it. Pinch (or use the **+ / −** buttons on the right) to zoom.

3. **Enter joint coordinates.** Tap **"Enter coordinates ▲"** at the bottom to slide up the input panel. Points are grouped exactly like the paper CFA form (Head/torso, Left arm, Left pelvis, Left leg, Right arm, Right pelvis, Right leg). Type X, Y, Z for any point you've measured — points can be left blank if not yet measured.

4. **Mark a missing body part.** If a limb genuinely isn't present on this skeleton, toggle that section's switch from "Present" to "Not present" — its fields will grey out and disable, but nothing already entered is deleted.

5. **Reset if needed.** The "Reset all" button (top-right of the coordinate panel) clears every entered coordinate for the current skeleton, after a confirmation prompt.

6. **Hide the panel to inspect the model.** Tap **"Hide coordinates ▼"** to slide the panel away and view the skeleton unobstructed.

---

## Tech stack

- **React + TypeScript** (via Vite)
- **Three.js** — 3D rendering, model loading, camera controls
- **Capacitor** — wraps the web app as a native Android app

No backend/server — the app is designed to run fully offline.

---

## Project structure

```
skeleton-app/
├── public/
│   └── skeleton_rig.glb        ← the rigged 3D skeleton model
├── src/
│   ├── App.tsx                 ← main app, holds project/skeleton state
│   ├── types.ts                 ← shared TypeScript types
│   ├── components/
│   │   ├── ThreeScene.tsx       ← 3D viewport: model loading, camera, zoom controls
│   │   ├── TopBar.tsx           ← skeleton selector / rename
│   │   └── CoordinatePanel.tsx  ← sliding coordinate entry form, section toggles, reset
│   └── data/
│       └── cfaSchema.ts         ← the 25 official CFA joint points and their groupings
├── android/                      ← generated Android project (not hand-edited)
└── capacitor.config.ts
```

---

## Known limitations / next steps

- **Coordinates don't yet pose the 3D model.** This is intentional at this stage — the UI shell and the 3D rendering were deliberately built and proven independently first. Wiring coordinate data to actual bone posing is the next major piece of work.
- **This specific rigged model has some known quirks** (a mix of "control" and "deform" bones, and a few bones that are siblings rather than parent-child in places) that will need to be accounted for when bone-posing logic is added. Worth reviewing with whoever picks up that work.
- **Export is a placeholder only.** Needs Capacitor's Filesystem plugin for real on-device file writing.
- **No data persistence yet** — closing the app currently loses all entered data. Local storage/saving is planned but not yet implemented.

---

## Contributing

See [`SETUP.md`](./SETUP.md) for full environment setup instructions, including Android-specific steps and a troubleshooting reference for common issues.
