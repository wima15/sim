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

console.log("Patch Android selesai (versionCode " + run + ").");
