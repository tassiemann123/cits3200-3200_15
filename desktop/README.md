# OSTEO desktop prototype

A Windows-focused desktop PWA prototype for CITS3200 Team 15 and Dr Ambika Flavel. It demonstrates a multi-individual workspace, bone-specific joint coordinates, explicit bone inventory, and local recording. All new desktop work lives in this directory.

## Run

Use Node.js 24 LTS and npm. From this directory:

```sh
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5174`). The development server is for UI work; its resources are intentionally **not** installed for offline use.

For the installable, cached production build:

```sh
npm run test
npm run build
npm run preview
```

Open the production address (normally `http://127.0.0.1:4174`) and wait until the app confirms offline readiness. The build generates `dist/sw.js` after Vite, precaching every built local asset, including the JavaScript, styles, manifest, and app icons. No remote font or model is required by the desktop shell. Serve `dist/` on HTTPS for a hosted installation; localhost is permitted for local development. Do not open `index.html` directly as a file.

## Five-minute meeting demonstration

1. Start in an empty workspace: no preset skeletons or coordinates. Enter coordinates, or use the example menu → Open complete sample workspace to explicitly load two fully articulated individuals.
2. Select the left knee in the joint editor. It has separate coordinates for the femur and lower-leg endpoints. While linked, editing the first coordinate updates the second automatically.
3. Expand the second coordinate. Expansion only reveals the fields; unlinking allows independent editing. Change one endpoint and inspect the resulting separation. Collapsing the editor preserves both values.
4. Turn on recorded joint markers from the viewport toolbar. Matching bone endpoints share one visible marker; a separated joint shows both bone-owned endpoints. Markers remain hidden by default so the anatomical model stays clear.
5. Use the missing-femur example: the femur is absent while the lower leg and its endpoint coordinates remain. Neighbouring points must not produce a phantom femur.
6. Save an edit, refresh, and verify it persists. Export a project backup, then demonstrate importing that backup.
7. In the production preview, wait for offline readiness, enable browser network emulation **Offline**, and reload. Edit a coordinate, reload again, and verify both application loading and saved data. Repeat import/export offline.

Use the articulated, disarticulated, and missing-femur examples for discussion. They contain **synthetic demonstration data**, not a reconstruction of the BP002/IND-001 email attachment.

## Requirements represented

- Non-terminal joint endpoints each carry their owning bone/group and an `(x, y, z)` coordinate. Two coordinate sets do not mean two-dimensional coordinates.
- A shared coordinate is the default; the second set can be revealed and independently edited. Relinking deliberately copies the first coordinate to the second.
- Bone status distinguishes present, absent, and unrecorded; blank coordinates alone do not declare a bone absent.
- Recorded joint markers are an optional inspection layer. It is off initially, includes only complete coordinates for present bones, deduplicates linked endpoints, and preserves both markers when a joint is split.
- The proximal skull point replaces the skull-centre measurement.
- Pelvic rendering requires the sacral promontory and acetabular points. Optional ilium/ischium measurements do not determine bone presence.
- Data remains in the browser profile on this device; local export provides a transferable backup. There is no backend or account dependency.

## React reuse decision

The prototype retains the project's React, TypeScript, Vite, and Three.js stack. The desktop workspace and endpoint data model are separate from the mobile app so the existing mobile workflow can continue unchanged. The current mobile `SkeletonCoordinates` records one coordinate set per landmark and uses excluded anatomical groups; directly reusing that model would lose the bone-specific endpoint distinction. Its renderer and parsing approaches remain useful references, but sharing production components or migrating mobile data needs an agreed endpoint schema first.

## Offline and installation boundaries

The service worker is registered only for production. The interface reports readiness only after the controlling worker is active and confirms every expected shell resource exists in its cache. Cache names are isolated to this app and its deployment scope. Updates wait for existing app windows to close; they do not replace an active recording session's shell. Application caching and saved coordinate data are separate stores.

A first visit requires the app's server to be reachable. Once cached, the shell can load without that server. Browser/site data removal also removes the offline installation and local records; export a backup before clearing data or changing browser/profile/origin. This prototype uses browser storage, not a filesystem database or cloud backup. Storage failures must be addressed before treating local edits as saved.

Windows Edge installation is the target, but Windows installation/relaunch must be verified on an actual UWA laptop before declaring the requirement complete. The install prompt may be unavailable under institutional browser policy. When offered, use the app's install action or Edge's installation control. An installed web app does not require Node.js on the user's laptop when served from a hosted HTTPS site; this repository's npm commands are for building and local demonstration.

Windows acceptance checklist:

- [ ] Install in Edge on a UWA staff laptop and create/locate the desktop or Start shortcut.
- [ ] Close all browser/app windows, disconnect the internet, and launch through the shortcut.
- [ ] View multiple skeletons; edit linked and split endpoints; mark a femur absent.
- [ ] Close and relaunch offline; confirm the latest records persist.
- [ ] Import/export a project offline and open the exported backup again.
- [ ] Reconnect and verify an updated build becomes available after closing old app windows.

## Prototype limits and questions for Wednesday

The viewer reuses the mobile anatomical GLB asset and its rest-tip/bone positioning code. The inventory mapping is still a prototype: Axial skeleton, shoulder girdle, forearms, lower legs, hands, and feet include grouped segments; individual radius/ulna, tibia/fibula, ribs, and vertebrae are not a validated anatomical inventory. The synthetic coordinates use metres and Z-up. Confirm the client's actual units, coordinate conventions, complete landmark/bone mapping, and treatment of partially recorded bones before real data migration. The numbered email table alone is insufficient to map its points safely.

Multi-skeleton layout is a team exploration rather than a requirement explicitly confirmed in the supplied emails. Confirm shared spatial comparison versus independent side-by-side views. Also agree on whether bone status or bone-specific coordinates are the authoritative inventory source, and how relinking previously separated endpoints should be confirmed.

This is a local interaction prototype, not a clinically validated reconstruction or the final production offline application. No login, cloud synchronization, collaboration, installer package, or mobile-data migration is included.

Implementation references: [MDN service-worker installation lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil), [Microsoft Edge PWA setup and offline caching](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/), and [Windows PWA icons](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/icon-theme-color).

## Verification in this workspace

- TypeScript and production build pass; 16 data-model tests pass.
- Browser-tested: automatic coordinate duplication, independent endpoints surviving collapse/reload, blank individual recovery, explicit absent femur with present lower leg, local JSON import, and reload/edit/persistence with browser networking disabled.
- Layouts checked at 1280 and 1440 CSS pixels without horizontal page overflow.
- A synthetic reset/import file is included at `public/demo-workspace.json`.
- Browser automation did not expose a completed download event for the JSON export in the in-app browser. Confirm the downloaded JSON/CSV files in Windows Edge as part of the meeting setup; UI export code is implemented, but downloaded-file verification is still pending there.

The running development preview is port 5174. The production preview with offline support is port 4174. These are separate browser origins and therefore have separate local records; transfer a workspace file when moving between them. This machine reuses a local copy of the existing project dependencies; a fresh checkout should run `npm install` in `desktop/`.

## Mobile-aligned revision

The page header, brand row, institutional heading, title and subtitle were removed. Import/export and save status are in the left panel. Colours match mobile: warm off-white panels, blue-grey controls, a charcoal viewport and natural bone materials.

New workspaces contain one blank skeleton record. As in mobile, bone presence initially defaults to present; geometry is gated by recorded landmarks and an explicit absent status always hides that bone. Old edited projects migrate intact; the untouched synthetic starter becomes a blank workspace, with the old storage entry retained. Examples remain opt-in.

The `predev` and `prebuild` scripts copy `mobile/public/models/skeleton_pre-cut.glb` into the desktop local assets when it is available. A fresh checkout without the GLB still builds, but the anatomical 3D model will not appear; the viewer shows a missing-model message while coordinate editing remains available. For a model demo or a complete offline release, place the GLB in `mobile/public/models/` or `desktop/public/models/` before building and verify that `dist/models/skeleton_pre-cut.glb` exists. When supplied, it is cached with the offline shell. It retains the mobile asset attribution: Skeleton Pre-cut · Maxime66410 · Sketchfab Standard. GLB files remain excluded from Git, consistent with the mobile asset instructions and pending redistribution-rights confirmation. The desktop no longer uses procedurally generated stick/guide skeletons.
