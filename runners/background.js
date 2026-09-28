/*
 * Runner latar belakang (@capacitor/background-runner).
 * Berjalan di luar WebView, kira-kira tiap 15 menit walau aplikasi ditutup
 * (Android yang menentukan waktu pastinya).
 *
 * Tugas: cek pengumuman baru di Supabase -> tampilkan notifikasi.
 */

const SUPABASE_URL = "https://jvunlziapbmvxmrrnphd.supabase.co";
const SUPABASE_KEY = "sb_publishable_g0I7fYBQnCwIrbzub-3FYA_cZXlH6Im";
const SEEN_KEY = "seen_ann_ids";
const MAX_SEEN = 300;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000; // jangan notifikasi pengumuman yang sudah > 7 hari

const TYPE_PREFIX = { mendesak: "MENDESAK: ", penting: "Penting: ", kegiatan: "Kegiatan: " };

function isActive(a) {
  if (!a.end) return true;
  const t = new Date(a.end).getTime();
  return isNaN(t) ? true : t > Date.now();
}
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function snippet(t, n) {
  t = String(t || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

async function loadSeen() {
  try {
    const r = await CapacitorKV.get(SEEN_KEY);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) {}
  return null; // null = belum pernah jalan
}
async function saveSeen(list) {
  try { await CapacitorKV.set(SEEN_KEY, JSON.stringify(list.slice(-MAX_SEEN))); } catch (e) {}
}

// Dipanggil dari aplikasi (notifications.js) supaya pengumuman yang sudah
// dilihat pengguna di dalam aplikasi tidak dinotifikasi lagi.
addEventListener("markSeen", async (resolve, reject, args) => {
  try {
    const ids = (args && Array.isArray(args.ids)) ? args.ids : [];
    const seen = (await loadSeen()) || [];
    ids.forEach((id) => { if (seen.indexOf(id) < 0) seen.push(id); });
    await saveSeen(seen);
    resolve();
  } catch (e) { reject(e); }
});

addEventListener("checkAnnouncements", async (resolve, reject) => {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/school_config?select=years&id=eq.main", {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = await res.json();
    const years = (rows && rows[0] && Array.isArray(rows[0].years)) ? rows[0].years : [];

    const anns = [];
    years.forEach((y) => {
      (Array.isArray(y.announcements) ? y.announcements : []).forEach((a) => {
        if (a && a.id && isActive(a)) anns.push(a);
      });
    });

    const seen = await loadSeen();
    const allIds = anns.map((a) => String(a.id));

    // Jalan pertama: catat semua pengumuman yang ada tanpa notifikasi (hindari banjir notifikasi).
    if (seen === null) {
      await saveSeen(allIds);
      resolve();
      return;
    }

    const fresh = anns
      .filter((a) => seen.indexOf(String(a.id)) < 0)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    if (fresh.length) {
      const now = Date.now();
      const notifyList = fresh.filter((a) => {
        const t = new Date(a.date).getTime();
        return isNaN(t) || (now - t) < MAX_AGE_MS;
      });

      if (notifyList.length > 0 && notifyList.length <= 3) {
        notifyList.forEach((a, i) => {
          CapacitorNotifications.schedule([{
            id: 1000000 + (hash(String(a.id)) % 900000),
            title: (TYPE_PREFIX[a.type] || "") + (a.title || "Pengumuman baru"),
            body: snippet(a.content, 160) || "Ketuk untuk membuka pengumuman.",
            scheduleAt: new Date(now + 1000 + i * 700)
          }]);
        });
      } else if (notifyList.length > 3) {
        CapacitorNotifications.schedule([{
          id: 1999999,
          title: notifyList.length + " pengumuman baru",
          body: snippet(notifyList.map((a) => a.title).join(" • "), 160),
          scheduleAt: new Date(now + 1000)
        }]);
      }
      await saveSeen(seen.concat(fresh.map((a) => String(a.id))));
    }
    resolve();
  } catch (e) {
    reject(e);
  }
});
