# Aplikasi Android – Edu-Wima (Portal SMK Widya Mandala)

Portal web ini dibungkus dengan Capacitor menjadi APK. Semua data (menu, pengumuman, jadwal)
tetap diambil dari Supabase, jadi mengubah isi portal **tidak perlu** membuat APK baru.

## Notifikasi yang ada
| Jenis | Kapan muncul | Berjalan saat app ditutup? |
|---|---|---|
| Pengumuman baru | Dicek tiap ±15 menit oleh runner latar belakang (`runners/background.js`) | Ya (tergantung izin baterai HP) |
| Pengingat kegiatan | H-1 dan hari-H pukul 07.00, dari kolom "Tanggal Kegiatan" pada pengumuman (`notifications.js`) | Ya, tapi terjadwal saat app dibuka |

## Cara membuat APK (paling mudah, lewat GitHub)
1. Salin semua file ini ke repo GitHub (timpa `index.html`, gabungkan folder `.github`).
2. Push ke branch `main`. Tab **Actions** → "Build APK Android" jalan otomatis (±5–10 menit).
3. Unduh `Edu-Wima.apk` dari halaman **Releases → Aplikasi Android (versi terbaru)**
   (atau dari *Artifacts* pada run tersebut). Repo harus publik agar link Releases bisa dibuka orang lain.
4. Pasang di HP (izinkan "pasang dari sumber tidak dikenal"), buka, lalu **Izinkan notifikasi**.

## Cara build di komputer sendiri (opsional)
Butuh Node 20+, JDK 21, Android Studio.
```
npm install --legacy-peer-deps
npm run android:setup
npm run android:open      # lalu Build > Build APK di Android Studio
```

## Unduh PDF jadwal untuk guru
Di dalam APK, tombol **Unduh PDF** membuka **browser HP (Chrome)** ke halaman web portal dengan
kelas/guru/hari yang sedang dipilih, lalu PDF diunduh otomatis di sana (file masuk ke folder Download).
Syarat:
- Versi web portal (GitHub Pages) harus memakai `index.html` terbaru dari paket ini.
- Alamat web diisi otomatis dari nama repo: `https://<pemilik>.github.io/<nama-repo>/`.
  Jika alamat Anda berbeda (domain sendiri, dll.): GitHub → Settings → Secrets and variables → Actions →
  tab **Variables** → New repository variable, nama `WEB_URL`, isi alamat portal lengkap, lalu jalankan ulang build.
- Bila unduhan tidak mulai sendiri (Chrome kadang menahan unduhan otomatis), ketuk tombol **Unduh PDF** di halaman tersebut.

## Agar notifikasi tidak terlambat
Di HP Xiaomi/Oppo/Vivo/Samsung, buka Pengaturan → Aplikasi → Edu-Wima →
Baterai → **Tanpa pembatasan** dan aktifkan **Mulai otomatis**. Tanpa ini, sistem sering menunda tugas latar belakang.

## Batasan yang perlu diketahui
- Notifikasi pengumuman **tidak instan** (jeda sampai ±15 menit atau lebih). Untuk notifikasi instan diperlukan Firebase Cloud Messaging + server pengirim.
- Unduh PDF butuh internet dan halaman web portal yang aktif (lihat bagian di atas). Unduh Excel (khusus admin) tidak dialihkan; lakukan lewat browser.
- Perubahan tampilan/kode (bukan data) membutuhkan APK baru: push ke GitHub, APK dibuat ulang.
- APK ini bertanda tangan *debug* (cukup untuk dibagikan langsung). Untuk Play Store perlu keystore rilis.
