# Skeletal Coordinate App — macOS Setup and Run Guide

This guide explains how to set up and run the Android frontend on a Mac from a fresh Android Studio installation.

The project uses React, Three.js, Capacitor and Android Studio. Python and a running backend are not required to run the current prototype.

## 1. Required software

Install:

- Android Studio
- Git
- Node.js 22 or newer
- pnpm

Android Studio includes an embedded JDK. Use **Embedded JDK 21** for this project instead of installing a separate Java version.

On macOS, install the Apple command-line tools:

```bash
xcode-select --install
```

If Homebrew is already installed, install Node.js and pnpm with:

```bash
brew install node@22
brew install pnpm
```

Confirm the tools are available:

```bash
git --version
node --version
pnpm --version
```

## 2. Install the Android SDK components

Open Android Studio and go to:

**Settings → Languages & Frameworks → Android SDK**

Under **SDK Platforms**, install:

- Android 16 / API 36
- Android SDK Platform 36

Under **SDK Tools**, install:

- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android SDK Command-line Tools (latest)
- Android Emulator

Apply the changes and wait for every download to finish.

## 3. Create an Android emulator

Open **Tools → Device Manager**, then create a virtual device.

Recommended configuration:

- A recent Pixel phone profile
- Android API 36
- ARM64 system image for Apple Silicon Macs
- x86_64 system image for Intel Macs

Start the emulator once and leave it running.

## 4. Download the project

The current mobile version is on `wenbo/mobile-skeletal-coordinate-app` until its pull request is merged into `main`.

```bash
git clone https://github.com/tassiemann123/cits3200-3200_15.git
cd cits3200-3200_15
git switch wenbo/mobile-skeletal-coordinate-app
cd mobile
```

After the mobile pull request has been merged, use `main` instead:

```bash
git switch main
git pull origin main
cd mobile
```

## 5. Add the skeletal model

The GLB model is intentionally excluded from Git. Obtain `skeleton_pre-cut.glb` from the team and place it at:

```text
mobile/public/models/skeleton_pre-cut.glb
```

From inside the `mobile` directory, it can be copied with:

```bash
cp "/path/to/skeleton_pre-cut.glb" public/models/skeleton_pre-cut.glb
```

Confirm that the model is present:

```bash
ls -lh public/models/skeleton_pre-cut.glb
```

The application build will fail if this file is missing.

## 6. Install dependencies and verify the frontend

Run these commands from the `mobile` directory:

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

The expected automated test result is 14 passing tests.

## 7. Synchronise and open the Android project

After a successful frontend build, run:

```bash
pnpm run android:sync
pnpm run android:open
```

Android Studio should open the project located at:

```text
mobile/android
```

If it does not open automatically, start Android Studio and open that directory manually.

## 8. Run the application in Android Studio

In Android Studio:

1. Wait for Gradle Sync and dependency downloads to finish.
2. Open **Settings → Build, Execution, Deployment → Build Tools → Gradle**.
3. Set **Gradle JDK** to Android Studio's **Embedded JDK 21**.
4. Start the API 36 emulator from Device Manager.
5. Select the `app` run configuration.
6. Click the green **Run** button.

The emulator should open **Skeletal Coordinate App** with the 3D skeleton viewer, Coordinates page and Details page.

## 9. Build a debug APK from the terminal

To verify the native Android build without pressing Run in Android Studio:

```bash
cd android
./gradlew assembleDebug
```

The APK will be generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Return to the mobile directory with:

```bash
cd ..
```

## 10. Commands to run after frontend changes

Every time React, CSS, TypeScript or frontend assets are changed, rebuild and synchronise before running Android again:

```bash
pnpm run typecheck
pnpm test
pnpm run build
pnpm run android:sync
pnpm run android:open
```

## 11. Pull the latest project changes

Before starting work on the current mobile branch:

```bash
cd cits3200-3200_15
git switch wenbo/mobile-skeletal-coordinate-app
git pull origin wenbo/mobile-skeletal-coordinate-app
cd mobile
pnpm install
pnpm run build
pnpm run android:sync
pnpm run android:open
```

After the project has been merged into `main`:

```bash
cd cits3200-3200_15
git switch main
git pull origin main
cd mobile
pnpm install
pnpm run build
pnpm run android:sync
pnpm run android:open
```

## 12. Common macOS issues

### Java cannot be found

Use Android Studio's embedded JDK for the current terminal session:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
java -version
```

Then retry the Android build:

```bash
cd android
./gradlew assembleDebug
```

### Android SDK cannot be found

The default macOS SDK location is:

```text
~/Library/Android/sdk
```

Open Android Studio's SDK settings and confirm that this is the configured SDK path. The project-local `android/local.properties` file is generated locally and should not be committed.

### Android API 36 is missing

Open Android Studio's SDK Manager and install **Android SDK Platform 36** and the current Build Tools, then retry Gradle Sync.

### The emulator is unavailable

Start the emulator from Device Manager before pressing Run. Use an ARM64 image on Apple Silicon and an x86_64 image on an Intel Mac.

### The model is missing or the build fails during model preparation

Confirm that this exact file exists:

```bash
ls -lh public/models/skeleton_pre-cut.glb
```

### Gradle or SDK downloads fail

Confirm that the Mac has a stable internet connection, retry the download from Android Studio and avoid running multiple SDK downloads at the same time. The first Gradle build can take several minutes.

## Data and backend boundary

The current prototype works without a backend. Coordinate data can be saved locally and transferred with CSV files using:

```csv
skeleton_id,joint_name,x,y,z
Skeleton 1,centre_of_head,1.245,0.832,-2.104
```

On Android, exported CSV files are written under `Documents/Skeletal Coordinate App/`. Direct API upload, authentication and database integration remain separate backend work.
