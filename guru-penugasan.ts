// =========================================================
// EDGE FUNCTION: guru-penugasan  (project Supabase RAPORWIMA)
// Tujuan: dipanggil oleh portal SIM (index.html) untuk fitur Ijin Guru.
// Hanya mengembalikan: NAMA GURU + PENUGASANNYA (kelas & mata pelajaran)
// pada tahun ajaran aktif. Tidak ada email, NIP, kata sandi, nilai, dll.
//
// Deploy (project RAPORWIMA):
//   1. Supabase > Edge Functions > New function, nama: guru-penugasan
//   2. Tempel isi file ini, lalu deploy.
//   3. Di Settings function, MATIKAN "Verify JWT" (portal SIM memanggil
//      tanpa login rapor). Atau via CLI:
//        supabase functions deploy guru-penugasan --no-verify-jwt
//   Secret SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah otomatis tersedia
//   di edge function, tidak perlu ditambah.
//
// Respons:
//   { tahun_ajaran: "2025/2026 Ganjil",
//     guru: [ { nama: "Budi, S.Pd.",
//               penugasan: [ { kelas: "X TO1", mapel: "Matematika" }, ... ] } ] }
// =========================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// deno-lint-ignore no-explicit-any
async function fetchAll(build: (from: number, to: number) => any) {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

const norm = (s: unknown) => String(s ?? "").trim();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: taRows, error: taErr } = await db
      .from("tahun_ajaran").select("id,nama,semester").eq("is_aktif", true).limit(1);
    if (taErr) return json({ error: taErr.message }, 400);
    const ta = taRows?.[0];
    if (!ta) return json({ error: "Tidak ada tahun ajaran aktif di rapor." }, 400);

    // deno-lint-ignore no-explicit-any
    const guruRows: any[] = await fetchAll((f, t) =>
      db.from("profiles").select("id,nama").eq("role", "guru").order("nama").range(f, t)
    );
    // deno-lint-ignore no-explicit-any
    const pgRows: any[] = await fetchAll((f, t) =>
      db.from("penugasan_guru")
        .select("guru_id, mata_pelajaran(nama), kelas(nama)")
        .eq("tahun_ajaran_id", ta.id).order("id").range(f, t)
    );

    const byGuru = new Map<string, { kelas: string; mapel: string }[]>();
    for (const p of pgRows) {
      const kelas = norm(p.kelas?.nama), mapel = norm(p.mata_pelajaran?.nama);
      if (!kelas || !mapel) continue;
      const arr = byGuru.get(p.guru_id) ?? [];
      if (!arr.some((x) => x.kelas === kelas && x.mapel === mapel)) arr.push({ kelas, mapel });
      byGuru.set(p.guru_id, arr);
    }

    const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });
    const guru = guruRows
      .map((g) => ({
        nama: norm(g.nama),
        penugasan: (byGuru.get(g.id) ?? []).sort((a, b) =>
          collator.compare(a.kelas, b.kelas) || collator.compare(a.mapel, b.mapel)
        ),
      }))
      .filter((g) => g.nama)
      .sort((a, b) => collator.compare(a.nama, b.nama));

    return json({ tahun_ajaran: `${ta.nama} ${ta.semester ?? ""}`.trim(), guru });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
