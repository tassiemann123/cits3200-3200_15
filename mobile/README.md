# Mobile App

Android app, single skeleton entry and visual check for on-site fieldwork.

## Stack
- Node.js
- Capacitor
- Android Studio

## Before starting: check your system

Run these in the VS Code terminal to confirm what's already installed:

```
node -v
npm -v
java -version
```

If Android Studio is installed, also check:
```
adb --version
```

If any of these come back as "command not found," that tool needs to be installed before setup can continue.

## Setup
```
npm install
npx cap sync android
npx cap open android
```
