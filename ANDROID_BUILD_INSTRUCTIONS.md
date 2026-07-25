# Milk Ledger — Android Project: Build & Sign Instructions

## What's actually in this project
Everything Capacitor's own `android` platform template would normally
generate has been hand-written and placed in its final location:

```
capacitor-project/
├── package.json                  ← npm deps (Capacitor core/android/splash-screen/status-bar)
├── capacitor.config.ts           ← app id, name, fullscreen/splash/status-bar config
├── www/                          ← your web app (PWA), source of truth for edits
├── android/
│   ├── build.gradle               (root)
│   ├── settings.gradle
│   ├── gradle.properties
│   ├── variables.gradle
│   ├── gradlew / gradlew.bat       (wrapper launcher scripts)
│   ├── gradle/wrapper/gradle-wrapper.properties   (pins Gradle 8.7)
│   └── app/
│       ├── build.gradle           (app module, release signing block included)
│       ├── proguard-rules.pro
│       └── src/main/
│           ├── AndroidManifest.xml   (fullscreen theme, portrait lock, INTERNET permission)
│           ├── java/com/milkledger/app/MainActivity.java
│           ├── assets/public/        (your web app, pre-copied in)
│           ├── assets/capacitor.config.json
│           └── res/
│               ├── values/{strings,colors,styles}.xml
│               ├── mipmap-*/ic_launcher(.png|_round.png)   (all 5 densities)
│               ├── mipmap-anydpi-v26/ic_launcher.xml         (adaptive icon)
│               └── drawable/{splash.png, splash_screen.xml, ic_launcher_foreground/background.png}
```

## The one thing that genuinely can't be hand-written: `capacitor-android` itself
Capacitor's Android **native library** (the Java/Kotlin bridge code that
`MainActivity extends BridgeActivity` and `implementation project(':capacitor-android')`
depend on) is not a text template — it ships inside the `@capacitor/android`
**npm package** and gets pulled into `node_modules/` by npm, not by Gradle
or Maven directly. There is no way to hand-write that library's source as a
build file; it has to come from `npm install`. This is the same for every
Capacitor project on every machine, not a shortcut — Android Studio itself
can't build a Capacitor app without it either.

So the actual remaining setup is exactly **two commands**, on a machine with
normal internet access (this does not need to be a special environment —
any laptop with Node.js works):

```bash
cd capacitor-project
npm install
npx cap sync android
```

`npx cap sync android` does three things automatically: (1) generates
`android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`
pointing at the now-present `node_modules/@capacitor/android`, (2) copies
`www/` into `android/app/src/main/assets/public/` (already pre-populated
here, this just refreshes it), and (3) regenerates
`android/app/src/main/assets/capacitor.config.json` from
`capacitor.config.ts`. **Do not run `npx cap add android`** — that command
is for creating the platform from scratch and will refuse to run since
`android/` already exists.

## 1. Open in Android Studio
```bash
npx cap open android
```
(or open the `android/` folder directly in Android Studio). Let Gradle sync
— the first sync downloads the Gradle 8.7 distribution and Android SDK
components, so it needs internet once. `gradlew`/`gradlew.bat` are the
standard wrapper launcher scripts; if `gradle-wrapper.jar` itself is
missing, Android Studio's "Sync Project with Gradle Files" regenerates it
automatically using its bundled Gradle — no manual step needed.

## 2. Test it
Run ▶ on a device/emulator. Turn on Airplane Mode after the first launch
and confirm every view (Dashboard, Customers, Daily Entry, Rates, Payments,
Invoices, all three Reports, Backup & Data, Settings) still works, and that
Print/PDF export on an invoice still opens correctly.

## 3. Build the Release APK (unsigned, for local testing)
```bash
cd android
./gradlew assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

## 4. Build the Release AAB (for Play Store upload)
```bash
./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

## 5. Sign the release build
Google Play requires every release to be signed. Generate a keystore once
and **back it up somewhere safe forever** — losing it means you can never
publish an update to the same app listing again:

```bash
keytool -genkey -v -keystore milk-ledger.keystore -alias milkledger \
  -keyalg RSA -keysize 2048 -validity 10000
```

Create `android/keystore.properties` (already gitignored) with:
```properties
storeFile=../milk-ledger.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=milkledger
keyPassword=YOUR_KEY_PASSWORD
```
`android/app/build.gradle` already contains the `signingConfigs.release`
block that reads this file automatically — as soon as
`keystore.properties` exists, `assembleRelease` / `bundleRelease` produce a
**signed** APK/AAB with no further Gradle edits needed. (Android Studio's
Build → Generate Signed Bundle/APK wizard does the same thing
interactively if you'd rather not touch files by hand.)

## Going 100% permission-free (optional)
Chart.js, jsPDF, and the three Google Fonts currently load from CDNs on
first run and are cached afterwards — every core feature (entries, billing,
invoices, CSV export, backups) already works with zero network. To make
charts/PDF export work offline from the very first launch too:
1. Download once, on any machine with internet:
   - `https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js` → `www/js/vendor/chart.umd.min.js`
   - `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` → `www/js/vendor/jspdf.umd.min.js`
   - The Fraunces/Manrope/JetBrains Mono `.woff2` files → `www/assets/fonts/`
2. Update the `<script src>` / `<link href>` tags in `www/index.html` to
   point locally, and add those paths to `APP_SHELL_FILES` in
   `www/service-worker.js`.
3. Remove the `<uses-permission android:name="android.permission.INTERNET" />`
   line from `android/app/src/main/AndroidManifest.xml`.
4. Re-run `npx cap sync android`.

## Continuous Integration (GitHub Actions)
`.github/workflows/android.yml` builds a debug APK automatically on every
push/PR to `main`/`master` (and on demand via the "Run workflow" button).
It runs `npm install`, `npx cap sync android`, then `./gradlew assembleDebug`
on a GitHub-hosted Ubuntu runner (which already has the Android SDK and a
JDK preinstalled), and uploads the resulting APK as a workflow artifact
named `milk-ledger-debug-apk`. To download it: open the workflow run under
the repo's **Actions** tab → scroll to **Artifacts**.

No secrets or keystore are required for this — Android debug builds are
signed automatically by the Android Gradle Plugin using a debug keystore
that Gradle generates on the runner the first time it's needed, so
`app-debug.apk` is a normal, signed, installable APK out of the box.
(This is separate from the `signingConfigs.release` block in
`android/app/build.gradle`, which is for **release** builds and needs your
own keystore + `keystore.properties`, as described above.)

## Future updates (both PWA and Android)
1. Edit files under `www/` (same files as the standalone PWA).
2. **Bump `CACHE_VERSION`** in `www/service-worker.js` — this makes the
   service worker delete old caches and serve new files to existing
   installs automatically.
3. Web version: redeploy the `www/`/`milk-app/` folder. Installed PWAs pick
   up the update next time they're opened with a connection.
4. Android: bump `versionCode`/`versionName` in `android/app/build.gradle`,
   then:
   ```bash
   npx cap sync android
   cd android && ./gradlew bundleRelease
   ```
   Upload the new `.aab` to Play Console as a new release.
