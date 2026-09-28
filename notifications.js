/*
 * Notifikasi untuk aplikasi Android (Capacitor).
 * Di browser biasa file ini tidak melakukan apa-apa.
 *
 * Yang dikerjakan di sini (saat aplikasi dibuka / dilanjutkan):
 *  1. Meminta izin notifikasi & membuat channel notifikasi.
 *  2. Menjadwalkan pengingat kegiatan: H-1 dan hari-H pukul 07.00,
 *     berdasarkan "Tanggal Kegiatan" pada pengumuman. Pengingat tetap
 *     berbunyi walau aplikasi sedang ditutup.
 *  3. Memberi tahu runner latar belakang (runners/background.js) pengumuman
 *     mana yang sudah terlihat, supaya tidak dinotifikasi ulang.
 */
(function () {
  "use strict";

  var C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return;

  var SUPA_URL = (typeof SUPABASE_URL !== "undefined") ? SUPABASE_URL : "https://jvunlziapbmvxmrrnphd.supabase.co";
  var SUPA_KEY = (typeof SUPABASE_KEY !== "undefined") ? SUPABASE_KEY : "sb_publishable_g0I7fYBQnCwIrbzub-3FYA_cZXlH6Im";
  var LOCAL_CFG_KEY = "smk_widya_mandala_config_v1";
  var RUNNER_LABEL = "id.sch.widyamandala.tambak.background";
  var REMINDER_BASE = 2000000;          // rentang ID pengingat: 2.000.000 - 2.999.999
  var REMINDER_HOUR = 7;                // jam pengingat (waktu lokal perangkat)

  function plugin(name) {
    try { return (C.Plugins && C.Plugins[name]) || C.registerPlugin(name); }
    catch (e) { return null; }
  }
  var LN = plugin("LocalNotifications");
  var AppPlugin = plugin("App");
  var BR = plugin("BackgroundRunner");
  if (!LN) return;

  /* ---------- Tampilan: hormati status bar / navigation bar di Android ---------- */
  try {
    var st = document.createElement("style");
    st.textContent =
      "body{padding-top:max(env(safe-area-inset-top,0px),var(--safe-area-inset-top,0px)) !important;" +
      "padding-bottom:max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)) !important;}";
    document.head.appendChild(st);
  } catch (e) {}

  /* ---------- Util ---------- */
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function isActive(a) {
    if (!a.end) return true;
    var t = new Date(a.end).getTime();
    return isNaN(t) ? true : t > Date.now();
  }
  function parseEventDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function snippet(t, n) {
    t = String(t || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }
  function fmtDate(d) {
    try {
      return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return ""; }
  }

  /* ---------- Data pengumuman ---------- */
  async function fetchYears() {
    try {
      var r = await fetch(SUPA_URL + "/rest/v1/school_config?select=years&id=eq.main", {
        headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY }
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      var rows = await r.json();
      if (rows && rows[0] && Array.isArray(rows[0].years)) return rows[0].years;
    } catch (e) { /* offline: pakai salinan lokal */ }
    try {
      var raw = JSON.parse(localStorage.getItem(LOCAL_CFG_KEY));
      if (raw && Array.isArray(raw.years)) return raw.years;
    } catch (e) {}
    return [];
  }

  function activeAnnouncements(years) {
    var out = [];
    years.forEach(function (y) {
      (Array.isArray(y.announcements) ? y.announcements : []).forEach(function (a) {
        if (a && a.id && isActive(a)) out.push(a);
      });
    });
    return out;
  }

  /* ---------- Izin & channel ---------- */
  async function ensurePermission() {
    try {
      await LN.createChannel({ id: "pengumuman", name: "Pengumuman", description: "Pengumuman baru dari sekolah", importance: 4, visibility: 1, vibration: true });
      await LN.createChannel({ id: "pengingat", name: "Pengingat Kegiatan", description: "Pengingat H-1 dan hari-H kegiatan", importance: 4, visibility: 1, vibration: true });
    } catch (e) {}
    try {
      var p = await LN.checkPermissions();
      if (p.display === "prompt" || p.display === "prompt-with-rationale") p = await LN.requestPermissions();
      return p.display === "granted";
    } catch (e) { return false; }
  }

  /* ---------- Pengingat kegiatan ---------- */
  function wantedReminders(anns) {
    var now = Date.now(), list = [];
    anns.forEach(function (a) {
      var d = parseEventDate(a.eventDate);
      if (!d) return;
      [1, 0].forEach(function (daysBefore) {
        var at = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBefore, REMINDER_HOUR, 0, 0);
        if (at.getTime() < now + 60000) return; // sudah lewat
        list.push({
          id: REMINDER_BASE + (hash(String(a.id)) % 400000) * 2 + (daysBefore ? 1 : 0),
          title: (daysBefore ? "Besok: " : "Hari ini: ") + (a.title || "Kegiatan sekolah"),
          body: snippet(a.content, 140) || fmtDate(d),
          schedule: { at: at, allowWhileIdle: true },
          channelId: "pengingat",
          extra: { annId: a.id }
        });
      });
    });
    return list;
  }

  async function syncReminders(anns) {
    var want = wantedReminders(anns), wantIds = {};
    want.forEach(function (n) { wantIds[n.id] = 1; });
    try {
      var pend = await LN.getPending();
      var stale = (pend.notifications || [])
        .filter(function (n) { return n.id >= REMINDER_BASE && n.id < REMINDER_BASE + 1000000 && !wantIds[n.id]; })
        .map(function (n) { return { id: n.id }; });
      if (stale.length) await LN.cancel({ notifications: stale });
    } catch (e) {}
    if (want.length) {
      try { await LN.schedule({ notifications: want }); } catch (e) { console.warn("Jadwal pengingat gagal:", e); }
    }
  }

  /* ---------- Tandai pengumuman sudah terlihat (untuk runner) ---------- */
  async function markSeen(anns) {
    if (!BR || !BR.dispatchEvent) return;
    try {
      await BR.dispatchEvent({
        label: RUNNER_LABEL,
        event: "markSeen",
        details: { ids: anns.map(function (a) { return String(a.id); }) }
      });
    } catch (e) {}
  }

  /* ---------- Jalankan ---------- */
  var busy = false;
  async function run() {
    if (busy) return;
    busy = true;
    try {
      var anns = activeAnnouncements(await fetchYears());
      if (await ensurePermission()) await syncReminders(anns);
      await markSeen(anns);
    } catch (e) {
      console.warn("Sinkron notifikasi gagal:", e);
    } finally { busy = false; }
  }

  setTimeout(run, 1500);
  setInterval(run, 10 * 60 * 1000);
  if (AppPlugin && AppPlugin.addListener) {
    AppPlugin.addListener("appStateChange", function (s) { if (s && s.isActive) run(); });
  }
})();
