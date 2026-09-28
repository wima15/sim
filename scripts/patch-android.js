// Dijalankan setelah `npx cap add android`: izin, ikon notifikasi, nomor versi.
const fs = require("fs");
const path = require("path");

const app = path.join(__dirname, "..", "android", "app");

// 1) Izin di AndroidManifest.xml
const manifestPath = path.join(app, "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
const perms = [
  "android.permission.INTERNET",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.WAKE_LOCK"
];
for (const p of perms) {
  if (!manifest.includes('android:name="' + p + '"')) {
    manifest = manifest.replace("</manifest>", '    <uses-permission android:name="' + p + '" />\n</manifest>');
  }
}
fs.writeFileSync(manifestPath, manifest);

// 2) Ikon kecil notifikasi (lonceng, putih polos seperti syarat Android)
const drawableDir = path.join(app, "src", "main", "res", "drawable");
fs.mkdirSync(drawableDir, { recursive: true });
fs.writeFileSync(path.join(drawableDir, "ic_stat_notify.xml"),
`<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF"
        android:pathData="M12,22c1.1,0 2,-0.9 2,-2h-4c0,1.1 0.89,2 2,2zM18,16v-5c0,-3.07 -1.64,-5.64 -4.5,-6.32V4c0,-0.83 -0.67,-1.5 -1.5,-1.5s-1.5,0.67 -1.5,1.5v0.68C7.63,5.36 6,7.92 6,11v5l-2,2v1h16v-1l-2,-2z"/>
</vector>
`);

// 3) Nomor versi otomatis (dari nomor run GitHub Actions bila ada)
const gradlePath = path.join(app, "build.gradle");
let gradle = fs.readFileSync(gradlePath, "utf8");
const run = parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10);
gradle = gradle.replace(/versionCode\s+\d+/, "versionCode " + run)
               .replace(/versionName\s+"[^"]*"/, 'versionName "1.0.' + run + '"');
fs.writeFileSync(gradlePath, gradle);


// 4) Perbaikan Background Runner: Gradle mencari "android-js-engine-release.aar"
//    tetapi file itu ada di dalam node_modules. Salin ke android/app/libs
//    dan daftarkan folder plugin sebagai flatDir (sesuai dokumentasi plugin).
(function fixBackgroundRunnerAar() {
  const pluginDir = path.join(__dirname, "..", "node_modules", "@capacitor", "background-runner");
  function find(dir) {
    if (!fs.existsSync(dir)) return null;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { const r = find(full); if (r) return r; }
      else if (e.name === "android-js-engine-release.aar") return full;
    }
    return null;
  }
  const aar = find(pluginDir);
  if (!aar) {
    console.warn("PERINGATAN: android-js-engine-release.aar tidak ditemukan di " + pluginDir);
    return;
  }
  const libs = path.join(app, "libs");
  fs.mkdirSync(libs, { recursive: true });
  fs.copyFileSync(aar, path.join(libs, "android-js-engine-release.aar"));
  console.log("AAR disalin ke " + libs + " (dari " + aar + ")");

  const g = fs.readFileSync(gradlePath, "utf8");
  const flat = "dirs '../../node_modules/@capacitor/background-runner/android/src/main/libs', 'libs'";
  if (!g.includes("node_modules/@capacitor/background-runner")) {
    const re = /(dirs\s+'\.\.\/capacitor-cordova-android-plugins\/src\/main\/libs',\s*'libs')/;
    if (re.test(g)) {
      fs.writeFileSync(gradlePath, g.replace(re, "$1\n        " + flat));
      console.log("flatDir background-runner ditambahkan ke app/build.gradle");
    }
  }
})();

console.log("Patch Android selesai (versionCode " + run + ").");
