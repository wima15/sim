/*
 * Khusus aplikasi Android: tombol "Unduh PDF" jadwal dialihkan ke browser HP
 * (Chrome / browser bawaan). Halaman web jadwal yang sama dibuka dengan
 * pilihan kelas/guru/hari yang sedang tampil, lalu PDF diunduh otomatis di sana.
 *
 * Alamat web diisi otomatis saat build (window.SIM_WEB_URL, lihat scripts/prepare-www.js).
 * Di browser biasa file ini tidak melakukan apa-apa.
 */
(function () {
  "use strict";

  var C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return;

  var original = window.scPdf;
  if (typeof original !== "function") return;

  function plugin(name) {
    try { return (C.Plugins && C.Plugins[name]) || C.registerPlugin(name); }
    catch (e) { return null; }
  }

  function buildUrl() {
    var base = String(window.SIM_WEB_URL || "").trim();
    if (!/^https?:\/\//i.test(base)) return null;
    base = base.split(/[?#]/)[0];
    var st = (typeof scSt !== "undefined") ? scSt : null;
    var id = st && st.item && st.item.id ? st.item.id : "";
    var q = "jadwal=" + encodeURIComponent(id) +
      "&mode=" + encodeURIComponent(st ? st.mode : "kelas") +
      "&sel=" + encodeURIComponent(st ? st.sel : "ALL") +
      "&day=" + encodeURIComponent(st ? st.day : "ALL") +
      "&pdf=1";
    return base + "?" + q;
  }

  async function openExternal(url) {
    var AL = plugin("AppLauncher");
    if (AL && AL.openUrl) {
      try { await AL.openUrl({ url: url }); return true; } catch (e) {}
    }
    try { window.open(url, "_system"); return true; } catch (e) {}
    return false;
  }

  window.scPdf = async function () {
    var url = buildUrl();
    if (!url) {              // alamat web belum diatur -> perilaku bawaan
      return original.apply(this, arguments);
    }
    if (typeof showToast === "function") showToast("Membuka browser untuk mengunduh PDF…", "⬇️");
    var ok = await openExternal(url);
    if (!ok && typeof showToast === "function") showToast("Gagal membuka browser.", "⚠️");
  };
})();
