// Menyalin file web ke folder www/ (yang dibungkus Capacitor menjadi APK).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www");

// Alamat web portal (untuk unduh PDF lewat browser HP).
// Urutan: variabel WEB_URL -> alamat GitHub Pages bawaan dari nama repo -> kosong.
function webUrl() {
  const v = (process.env.WEB_URL || "").trim();
  if (v) return v.endsWith("/") ? v : v + "/";
  const repo = process.env.GITHUB_REPOSITORY; // "pemilik/nama-repo"
  if (repo && repo.includes("/")) {
    const [owner, name] = repo.split("/");
    const o = owner.toLowerCase();
    return name.toLowerCase() === o + ".github.io"
      ? "https://" + o + ".github.io/"
      : "https://" + o + ".github.io/" + name + "/";
  }
  return "";
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const f of ["index.html", "notifications.js", "android-download.js"]) {
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
fs.cpSync(path.join(root, "runners"), path.join(out, "runners"), { recursive: true });

const url = webUrl();
const idx = path.join(out, "index.html");
let html = fs.readFileSync(idx, "utf8");
html = html.replace("</head>", "<script>window.SIM_WEB_URL=" + JSON.stringify(url) + ";</script>\n</head>");
fs.writeFileSync(idx, html);

console.log("www/ siap:", fs.readdirSync(out).join(", "));
console.log("Alamat web untuk unduh PDF:", url || "(kosong - unduh PDF memakai cara bawaan)");
