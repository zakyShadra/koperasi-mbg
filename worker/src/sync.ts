// Two-way sync between D1 and the Google Sheet "KoperasiMBG".
// D1 is the source of truth; the Sheet is a working copy. Last write wins
// by diubah_pada ("YYYY-MM-DD HH:mm:ss" WIB). A bounce is a no-op because
// the timestamps match, so the sync cannot loop even if the GAS lock is lost.

export interface SyncEnv {
  DB: D1Database;
  GAS_MIRROR_URL?: string;
  GAS_MIRROR_SECRET?: string;
  SHEET_SYNC_SECRET?: string;
}

export const SYNC_TABS = ["Anggota", "Kategori", "Produk", "Pesanan", "Pesanan Item", "Transaksi", "Staf", "Laporan"] as const;
export type SyncTab = (typeof SYNC_TABS)[number];

const KEY_COLS: Record<SyncTab, string[]> = {
  Anggota: ["id"],
  Kategori: ["id"],
  Produk: ["kode_produk"],
  Pesanan: ["nomor_pesanan"],
  "Pesanan Item": ["nomor_pesanan", "kode_produk"],
  Transaksi: ["id_transaksi"],
  Staf: ["email"],
  Laporan: ["jenis", "periode_mulai", "periode_selesai", "dibuat_oleh"],
};

export function wibNow(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(Date.now()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export function normTs(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return normTs(v.toISOString().slice(0, 19).replace("T", " "));
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(s);
  if (!m) return "";
  const pad = (x: string | undefined, d = "00") => String(x ?? d).padStart(2, "0");
  return `${m[1]}-${pad(m[2])}-${pad(m[3])} ${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`;
}

export function cmpTs(a: string, b: string): number {
  const x = normTs(a);
  const y = normTs(b);
  if (x === y) return 0;
  return x < y ? -1 : 1;
}

export function normWa(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim().replace(/[\s-]/g, "");
  if (/^8\d{9,12}$/.test(s)) return "0" + s;
  return s;
}

export function rowKey(tab: SyncTab, row: Record<string, unknown>): string {
  return KEY_COLS[tab].map((c) => String(row[c] ?? "")).join("|");
}

export async function logSync(
  env: SyncEnv,
  arah: "worker_ke_sheet" | "sheet_ke_worker" | "reconcile",
  tab: string,
  kunci: string,
  aksi: "upsert" | "lewat_konflik" | "error" | "lewat_contoh",
  detail?: string
): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO sync_log (arah, tab, kunci, aksi, detail, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(arah, tab, kunci, aksi, detail ?? null, wibNow())
      .run();
  } catch {
    // Logging must never break the sync itself.
  }
}

async function gasPost(env: SyncEnv, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!env.GAS_MIRROR_URL || !env.GAS_MIRROR_SECRET) return null;
  try {
    const res = await fetch(env.GAS_MIRROR_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.GAS_MIRROR_SECRET, ...body }),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      console.error("gasPost non-JSON response:", res.status, text.slice(0, 200));
      return null;
    }
  } catch (e) {
    console.error("gasPost fetch error:", String(e), env.GAS_MIRROR_URL);
    return null;
  }
}

export async function mirrorUpsert(
  env: SyncEnv,
  ctx: ExecutionContext,
  tab: SyncTab,
  rows: Record<string, unknown>[],
  rowNums?: (number | null)[]
): Promise<void> {
  if (!rows.length) return;
  const body: Record<string, unknown> = { op: "upsert", tab, keyCols: KEY_COLS[tab], rows };
  if (rowNums) body.rowNums = rowNums;
  ctx.waitUntil(
    (async () => {
      const keys = rows.map((r) => rowKey(tab, r)).join(",");
      const res = await gasPost(env, body);
      if (!res || res.ok !== true) {
        await logSync(env, "worker_ke_sheet", tab, keys, "error",
          `mirror gagal: ${res ? JSON.stringify(res).slice(0, 200) : "tidak ada respons dari GAS"}`);
        return;
      }
      await logSync(env, "worker_ke_sheet", tab, keys, "upsert",
        `mirror ok: ${rows.length} baris, updated=${Number(res.updated ?? 0)}, inserted=${Number(res.inserted ?? 0)}`);
      const skipped = res && Array.isArray(res.skipped) ? (res.skipped as Record<string, unknown>[]) : [];
      for (const s of skipped) {
        await logSync(env, "worker_ke_sheet", tab, String(s.key ?? ""), "lewat_konflik",
          `Sheet lebih baru (${String(s.sheet_ts ?? "")}), tidak ditimpa. Rekonsiliasi akan menarik versi Sheet.`);
      }
    })()
  );
}

async function kategoriName(env: SyncEnv, id: number): Promise<string> {
  const r = await env.DB.prepare("SELECT nama FROM kategori WHERE id = ?").bind(id).first<{ nama: string }>();
  return r?.nama ?? "";
}

async function pesananNomor(env: SyncEnv, id: number | null): Promise<string> {
  if (!id) return "";
  const r = await env.DB.prepare("SELECT nomor_pesanan FROM pesanan WHERE id = ?").bind(id).first<{ nomor_pesanan: string }>();
  return r?.nomor_pesanan ?? "";
}

async function stafEmail(env: SyncEnv, id: number | null): Promise<string> {
  if (!id) return "";
  const r = await env.DB.prepare("SELECT email FROM staf WHERE id = ?").bind(id).first<{ email: string }>();
  return r?.email ?? "";
}

export async function produkSheetRow(env: SyncEnv, p: Record<string, unknown>): Promise<Record<string, unknown>> {
  return {
    kode_produk: p.kode_produk,
    nama: p.nama,
    kategori: await kategoriName(env, p.kategori_id as number),
    harga: p.harga,
    stok: p.stok,
    satuan: p.satuan,
    deskripsi: p.deskripsi ?? "",
    aktif: p.is_aktif,
    tersedia: p.tersedia,
    sumber: "sistem",
    diubah_pada: p.diubah_pada,
  };
}

export async function pesananSheetRow(o: Record<string, unknown>): Promise<Record<string, unknown>> {
  return {
    nomor_pesanan: o.nomor_pesanan,
    tanggal: o.dibuat_pada,
    pelanggan_nama: o.nama_pelanggan,
    pelanggan_wa: o.no_wa_pelanggan,
    status: o.status,
    total: o.total,
    sumber_pesanan: o.sumber_pesanan,
    kanal_bayar: o.metode_bayar,
    catatan: o.catatan ?? "",
    sumber: "sistem",
    diubah_pada: o.diubah_pada,
  };
}

export async function pesananItemSheetRow(env: SyncEnv, it: Record<string, unknown>): Promise<Record<string, unknown>> {
  return {
    nomor_pesanan: await pesananNomor(env, it.pesanan_id as number),
    kode_produk: it.kode_produk,
    nama_produk: it.produk_nama,
    qty: it.qty,
    harga_saat_beli: it.harga_saat_beli,
    subtotal: it.subtotal,
    sumber: "sistem",
    diubah_pada: it.diubah_pada,
  };
}

export async function transaksiSheetRow(env: SyncEnv, t: Record<string, unknown>): Promise<Record<string, unknown>> {
  return {
    id_transaksi: t.kode,
    tanggal: t.dibuat_pada,
    jenis: t.jenis,
    jumlah: t.jumlah,
    metode: t.metode,
    nomor_pesanan: await pesananNomor(env, t.pesanan_id as number | null),
    keterangan: t.keterangan ?? "",
    sumber: "sistem",
    diubah_pada: t.diubah_pada,
    staf_id: await stafEmail(env, t.staf_id as number | null),
    kategori: t.kategori ?? "",
  };
}

export async function anggotaSheetRow(a: Record<string, unknown>): Promise<Record<string, unknown>> {
  return {
    id: a.kode,
    nama: a.nama,
    no_wa: a.no_wa,
    email: a.email ?? "",
    alamat: a.alamat_jalan ?? "",
    kota: a.kota ?? "",
    kode_pos: a.kode_pos ?? "",
    tanggal_gabung: a.tanggal_gabung,
    status: a.status,
    sumber: "sistem",
    diubah_pada: a.diubah_pada,
  };
}

export async function kategoriSheetRow(k: Record<string, unknown>): Promise<Record<string, unknown>> {
  return { id: k.id, nama: k.nama, deskripsi: k.deskripsi ?? "", sumber: "sistem", diubah_pada: k.diubah_pada };
}

export async function stafSheetRow(s: Record<string, unknown>): Promise<Record<string, unknown>> {
  return {
    nama: s.nama,
    email: s.email,
    no_wa: s.no_wa ?? "",
    peran: s.peran,
    aktif: s.is_aktif,
    sumber: "sistem",
    diubah_pada: s.diubah_pada,
  };
}

export async function laporanSheetRow(env: SyncEnv, l: Record<string, unknown>): Promise<Record<string, unknown>> {
  return {
    jenis: l.jenis,
    periode_mulai: l.periode_mulai,
    periode_selesai: l.periode_selesai,
    dibuat_oleh: await stafEmail(env, l.staf_id as number | null),
    ringkasan: l.ringkasan ?? "",
    dibuat_pada: l.dibuat_pada,
    sumber: "sistem",
    diubah_pada: l.diubah_pada,
  };
}

export async function mirrorProduk(env: SyncEnv, ctx: ExecutionContext, productId: number): Promise<void> {
  const p = await env.DB.prepare("SELECT * FROM produk WHERE id = ?").bind(productId).first<Record<string, unknown>>();
  if (!p) return;
  await mirrorUpsert(env, ctx, "Produk", [await produkSheetRow(env, p)]);
}

export async function mirrorPesanan(env: SyncEnv, ctx: ExecutionContext, orderId: number): Promise<void> {
  const o = await env.DB.prepare("SELECT * FROM pesanan WHERE id = ?").bind(orderId).first<Record<string, unknown>>();
  if (!o) return;
  await mirrorUpsert(env, ctx, "Pesanan", [await pesananSheetRow(o)]);
}

export async function mirrorPesananItems(env: SyncEnv, ctx: ExecutionContext, orderId: number): Promise<void> {
  const items = await env.DB.prepare(
    `SELECT pi.*, p.kode_produk, p.nama AS produk_nama FROM pesanan_item pi
     JOIN produk p ON p.id = pi.produk_id WHERE pi.pesanan_id = ?`
  ).bind(orderId).all();
  const rows: Record<string, unknown>[] = [];
  for (const it of (items.results ?? []) as Record<string, unknown>[]) {
    rows.push(await pesananItemSheetRow(env, it));
  }
  if (rows.length) await mirrorUpsert(env, ctx, "Pesanan Item", rows);
}

export async function mirrorTransaksi(env: SyncEnv, ctx: ExecutionContext, trxId: number): Promise<void> {
  const t = await env.DB.prepare("SELECT * FROM transaksi WHERE id = ?").bind(trxId).first<Record<string, unknown>>();
  if (!t) return;
  await mirrorUpsert(env, ctx, "Transaksi", [await transaksiSheetRow(env, t)]);
}

export async function mirrorStaf(env: SyncEnv, ctx: ExecutionContext, staffId: number): Promise<void> {
  const s = await env.DB.prepare("SELECT * FROM staf WHERE id = ?").bind(staffId).first<Record<string, unknown>>();
  if (!s) return;
  await mirrorUpsert(env, ctx, "Staf", [await stafSheetRow(s)]);
}

export async function mirrorKategori(env: SyncEnv, ctx: ExecutionContext, kategoriId: number): Promise<void> {
  const k = await env.DB.prepare("SELECT * FROM kategori WHERE id = ?").bind(kategoriId).first<Record<string, unknown>>();
  if (!k) return;
  await mirrorUpsert(env, ctx, "Kategori", [await kategoriSheetRow(k)]);
}

export async function mirrorAnggota(env: SyncEnv, ctx: ExecutionContext, anggotaId: number): Promise<void> {
  const a = await env.DB.prepare("SELECT * FROM anggota WHERE id = ?").bind(anggotaId).first<Record<string, unknown>>();
  if (!a) return;
  await mirrorUpsert(env, ctx, "Anggota", [await anggotaSheetRow(a)]);
}

export async function mirrorLaporan(env: SyncEnv, ctx: ExecutionContext, laporanId: number): Promise<void> {
  const l = await env.DB.prepare("SELECT * FROM laporan WHERE id = ?").bind(laporanId).first<Record<string, unknown>>();
  if (!l) return;
  await mirrorUpsert(env, ctx, "Laporan", [await laporanSheetRow(env, l)]);
}

export async function deleteFromSheet(env: SyncEnv, tab: SyncTab, key: string): Promise<boolean> {
  const res = await gasPost(env, { op: "delete", tab, keyCols: KEY_COLS[tab], key });
  if (!res || res.ok !== true || typeof res.deleted !== "number") {
    await logSync(env, "worker_ke_sheet", tab, key, "error",
      `hapus baris Sheet gagal: ${res ? JSON.stringify(res).slice(0, 200) : "tidak ada respons dari GAS"}`);
    return false;
  }
  await logSync(env, "worker_ke_sheet", tab, key, "upsert", `baris Sheet dihapus (${Number(res.deleted)})`);
  return Number(res.deleted) > 0;
}

export async function upsertToSheet(
  env: SyncEnv,
  tab: SyncTab,
  rows: Record<string, unknown>[],
  rowNums?: (number | null)[]
): Promise<{ updated: number; inserted: number; skipped: Record<string, unknown>[] } | null> {
  if (!rows.length) return { updated: 0, inserted: 0, skipped: [] };
  const body: Record<string, unknown> = { op: "upsert", tab, keyCols: KEY_COLS[tab], rows };
  if (rowNums) body.rowNums = rowNums;
  const res = await gasPost(env, body);
  if (!res || res.ok !== true) {
    await logSync(env, "worker_ke_sheet", tab, rows.map((r) => rowKey(tab, r)).join(","), "error",
      `mirror gagal: ${res ? JSON.stringify(res).slice(0, 200) : "tidak ada respons dari GAS"}`);
    return null;
  }
  await logSync(env, "worker_ke_sheet", tab, rows.map((r) => rowKey(tab, r)).join(","), "upsert",
    `mirror ok: ${rows.length} baris, updated=${Number(res.updated ?? 0)}, inserted=${Number(res.inserted ?? 0)}`);
  return {
    updated: Number(res.updated ?? 0),
    inserted: Number(res.inserted ?? 0),
    skipped: Array.isArray(res.skipped) ? (res.skipped as Record<string, unknown>[]) : [],
  };
}

const ORDER_STATUSES = ["baru", "disiapkan", "siap", "selesai", "dibatalkan"];
const PAY_METHODS = ["tunai", "transfer", "qris"];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function bool01(v: unknown): number {
  return v === 1 || v === "1" || v === true || String(v).toLowerCase() === "true" ? 1 : 0;
}

async function nextKode(env: SyncEnv, table: string, prefix: string, len: number): Promise<string> {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return prefix + String((r?.n ?? 0) + 1).padStart(len, "0");
}

async function resolveKategori(env: SyncEnv, nama: string): Promise<number | null> {
  const n = str(nama);
  if (!n) return null;
  const r = await env.DB.prepare("SELECT id FROM kategori WHERE nama = ?").bind(n).first<{ id: number }>();
  if (r) return r.id;
  const ins = await env.DB.prepare("INSERT INTO kategori (nama, deskripsi, diubah_pada) VALUES (?, '', ?)")
    .bind(n, wibNow())
    .run();
  return ins.meta.last_row_id as number;
}

async function refreshOrderPaid(env: SyncEnv, orderId: number): Promise<void> {
  const paid = await env.DB.prepare(
    "SELECT COALESCE(SUM(jumlah), 0) AS paid FROM transaksi WHERE pesanan_id = ? AND jenis = 'pembayaran'"
  ).bind(orderId).first<{ paid: number }>();
  const order = await env.DB.prepare("SELECT total, status_bayar FROM pesanan WHERE id = ?").bind(orderId).first<{ total: number; status_bayar: string }>();
  if (!order) return;
  if ((paid?.paid ?? 0) >= order.total && order.status_bayar !== "lunas") {
    await env.DB.prepare("UPDATE pesanan SET status_bayar = 'lunas', dibayar_pada = ?, diubah_pada = ? WHERE id = ?")
      .bind(wibNow(), wibNow(), orderId)
      .run();
  }
}

export interface ApplyResult {
  result: "applied" | "skipped_conflict" | "skipped_contoh" | "error";
  detail: string;
  key: string;
  mirror?: { tab: SyncTab; id: number; rowNum: number | null } | null;
}

export async function applySheetRow(
  env: SyncEnv,
  tab: SyncTab,
  row: Record<string, unknown>,
  rowNum: number | null = null
): Promise<ApplyResult> {
  const key = rowKey(tab, row);
  const sumber = str(row.sumber);
  if (sumber === "contoh") {
    await logSync(env, "sheet_ke_worker", tab, key, "lewat_contoh", "Baris contoh, tidak masuk database.");
    return { result: "skipped_contoh", detail: "baris contoh", key };
  }
  const ts = normTs(row.diubah_pada) || wibNow();
  const missingKey = KEY_COLS[tab].some((c) => str(row[c]) === "");
  if (tab === "Staf") {
    await logSync(env, "sheet_ke_worker", tab, key, "error", "Staf hanya dikelola bot, baris Sheet ditolak dan tidak masuk D1.");
    return { result: "error", detail: "Staf hanya dikelola bot, baris Sheet ditolak", key };
  }
  try {
    if (tab === "Anggota") return await applyAnggota(env, row, key, ts, missingKey, rowNum);
    if (tab === "Kategori") return await applyKategori(env, row, key, ts, missingKey, rowNum);
    if (tab === "Produk") return await applyProduk(env, row, key, ts, missingKey);
    if (tab === "Pesanan") return await applyPesanan(env, row, key, ts, missingKey);
    if (tab === "Pesanan Item") return await applyPesananItem(env, row, key, ts, missingKey);
    if (tab === "Transaksi") return await applyTransaksi(env, row, key, ts, missingKey, rowNum);
    return await applyLaporan(env, row, key, ts);
  } catch (e) {
    await logSync(env, "sheet_ke_worker", tab, key, "error", String(e));
    return { result: "error", detail: String(e), key };
  }
}

async function applyAnggota(env: SyncEnv, row: Record<string, unknown>, key: string, ts: string, missingKey: boolean, rowNum: number | null): Promise<ApplyResult> {
  let kode = key;
  let generated = false;
  if (missingKey) {
    kode = await nextKode(env, "anggota", "AGT-", 4);
    generated = true;
  }
  const nama = str(row.nama);
  const wa = normWa(row.no_wa);
  if (!nama || !wa) return { result: "error", detail: "nama dan no_wa wajib diisi", key: kode };
  const status = str(row.status) === "nonaktif" ? "nonaktif" : "aktif";
  const tanggal = normTs(row.tanggal_gabung) ? normTs(row.tanggal_gabung).slice(0, 10) : wibNow().slice(0, 10);
  const existing = await env.DB.prepare("SELECT id, diubah_pada FROM anggota WHERE kode = ?").bind(kode).first<{ id: number; diubah_pada: string }>();
  if (existing && cmpTs(ts, existing.diubah_pada) <= 0) {
    await logSync(env, "sheet_ke_worker", "Anggota", kode, "lewat_konflik", `D1 lebih baru (${existing.diubah_pada}).`);
    return { result: "skipped_conflict", detail: "D1 lebih baru", key: kode };
  }
  if (existing) {
    await env.DB.prepare(
      "UPDATE anggota SET nama = ?, no_wa = ?, email = ?, alamat_jalan = ?, kota = ?, kode_pos = ?, tanggal_gabung = ?, status = ?, diubah_pada = ? WHERE id = ?"
    ).bind(nama, wa, str(row.email) || null, str(row.alamat) || null, str(row.kota) || null, str(row.kode_pos) || null, tanggal, status, ts, existing.id).run();
    await logSync(env, "sheet_ke_worker", "Anggota", kode, "upsert", "update");
    return { result: "applied", detail: "update", key: kode };
  }
  const ins = await env.DB.prepare(
    "INSERT INTO anggota (kode, nama, no_wa, email, alamat_jalan, kota, kode_pos, tanggal_gabung, status, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(kode, nama, wa, str(row.email) || null, str(row.alamat) || null, str(row.kota) || null, str(row.kode_pos) || null, tanggal, status, ts).run();
  await logSync(env, "sheet_ke_worker", "Anggota", kode, "upsert", generated ? "insert, kode dibuat otomatis" : "insert");
  return { result: "applied", detail: generated ? "insert, kode dibuat otomatis" : "insert", key: kode,
    mirror: generated ? { tab: "Anggota", id: ins.meta.last_row_id as number, rowNum } : null };
}

async function applyKategori(env: SyncEnv, row: Record<string, unknown>, key: string, ts: string, missingKey: boolean, rowNum: number | null): Promise<ApplyResult> {
  const nama = str(row.nama);
  if (!nama) return { result: "error", detail: "nama kategori wajib diisi", key };
  let id = missingKey ? 0 : Number(key);
  let generated = false;
  if (!id) {
    const r = await env.DB.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS nid FROM kategori").first<{ nid: number }>();
    id = r?.nid ?? 1;
    generated = true;
  }
  const existing = await env.DB.prepare("SELECT id, diubah_pada FROM kategori WHERE id = ?").bind(id).first<{ id: number; diubah_pada: string }>();
  if (existing && cmpTs(ts, existing.diubah_pada) <= 0) {
    await logSync(env, "sheet_ke_worker", "Kategori", String(id), "lewat_konflik", `D1 lebih baru (${existing.diubah_pada}).`);
    return { result: "skipped_conflict", detail: "D1 lebih baru", key: String(id) };
  }
  if (existing) {
    await env.DB.prepare("UPDATE kategori SET nama = ?, deskripsi = ?, diubah_pada = ? WHERE id = ?")
      .bind(nama, str(row.deskripsi) || null, ts, id).run();
    await logSync(env, "sheet_ke_worker", "Kategori", String(id), "upsert", "update");
    return { result: "applied", detail: "update", key: String(id) };
  }
  await env.DB.prepare("INSERT INTO kategori (id, nama, deskripsi, diubah_pada) VALUES (?, ?, ?, ?)")
    .bind(id, nama, str(row.deskripsi) || null, ts).run();
  await logSync(env, "sheet_ke_worker", "Kategori", String(id), "upsert", generated ? "insert, id dibuat otomatis" : "insert");
  return { result: "applied", detail: generated ? "insert, id dibuat otomatis" : "insert", key: String(id),
    mirror: generated ? { tab: "Kategori", id, rowNum } : null };
}

async function applyProduk(env: SyncEnv, row: Record<string, unknown>, key: string, ts: string, missingKey: boolean): Promise<ApplyResult> {
  if (missingKey) return { result: "error", detail: "kode_produk wajib diisi", key };
  const nama = str(row.nama);
  const harga = num(row.harga);
  if (!nama || harga <= 0) return { result: "error", detail: "nama dan harga wajib diisi", key };
  const kategoriId = await resolveKategori(env, str(row.kategori));
  if (!kategoriId) return { result: "error", detail: "kategori wajib diisi", key };
  const stok = Math.max(0, Math.floor(num(row.stok)));
  const isAktif = bool01(row.aktif);
  const tersedia = bool01(row.tersedia);
  const existing = await env.DB.prepare("SELECT id, diubah_pada FROM produk WHERE kode_produk = ?").bind(key).first<{ id: number; diubah_pada: string }>();
  if (existing && cmpTs(ts, existing.diubah_pada) <= 0) {
    await logSync(env, "sheet_ke_worker", "Produk", key, "lewat_konflik", `D1 lebih baru (${existing.diubah_pada}).`);
    return { result: "skipped_conflict", detail: "D1 lebih baru", key };
  }
  if (existing) {
    await env.DB.prepare(
      "UPDATE produk SET kategori_id = ?, nama = ?, harga = ?, stok = ?, satuan = ?, deskripsi = ?, is_aktif = ?, tersedia = ?, diubah_pada = ? WHERE id = ?"
    ).bind(kategoriId, nama, harga, stok, str(row.satuan) || "pcs", str(row.deskripsi) || null, isAktif, tersedia, ts, existing.id).run();
    await logSync(env, "sheet_ke_worker", "Produk", key, "upsert", "update");
    return { result: "applied", detail: "update", key };
  }
  await env.DB.prepare(
    "INSERT INTO produk (kategori_id, kode_produk, nama, harga, stok, satuan, deskripsi, is_aktif, tersedia, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(kategoriId, key, nama, harga, stok, str(row.satuan) || "pcs", str(row.deskripsi) || null, isAktif, tersedia, ts).run();
  await logSync(env, "sheet_ke_worker", "Produk", key, "upsert", "insert");
  return { result: "applied", detail: "insert", key };
}

async function applyPesanan(env: SyncEnv, row: Record<string, unknown>, key: string, ts: string, missingKey: boolean): Promise<ApplyResult> {
  if (missingKey) return { result: "error", detail: "nomor_pesanan wajib diisi", key };
  const nama = str(row.pelanggan_nama);
  if (!nama) return { result: "error", detail: "pelanggan_nama wajib diisi", key };
  const status = ORDER_STATUSES.includes(str(row.status)) ? str(row.status) : "baru";
  const sumber = ["web", "shopeefood", "walk-in"].includes(str(row.sumber_pesanan)) ? str(row.sumber_pesanan) : "web";
  const metode = PAY_METHODS.includes(str(row.kanal_bayar)) ? str(row.kanal_bayar) : "tunai";
  const dibuat = normTs(row.tanggal) || ts;
  const total = Math.max(0, Math.floor(num(row.total)));
  const existing = await env.DB.prepare("SELECT id, diubah_pada FROM pesanan WHERE nomor_pesanan = ?").bind(key).first<{ id: number; diubah_pada: string }>();
  if (existing && cmpTs(ts, existing.diubah_pada) <= 0) {
    await logSync(env, "sheet_ke_worker", "Pesanan", key, "lewat_konflik", `D1 lebih baru (${existing.diubah_pada}).`);
    return { result: "skipped_conflict", detail: "D1 lebih baru", key };
  }
  if (existing) {
    await env.DB.prepare(
      "UPDATE pesanan SET nama_pelanggan = ?, no_wa_pelanggan = ?, status = ?, total = ?, sumber_pesanan = ?, metode_bayar = ?, catatan = ?, diubah_pada = ? WHERE id = ?"
    ).bind(nama, normWa(row.pelanggan_wa), status, total, sumber, metode, str(row.catatan) || null, ts, existing.id).run();
    await logSync(env, "sheet_ke_worker", "Pesanan", key, "upsert", "update");
    return { result: "applied", detail: "update", key };
  }
  await env.DB.prepare(
    "INSERT INTO pesanan (nomor_pesanan, nama_pelanggan, no_wa_pelanggan, status, total, catatan, dibuat_pada, sumber_pesanan, is_draft, metode_bayar, status_bayar, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'belum', ?)"
  ).bind(key, nama, normWa(row.pelanggan_wa), status, total, str(row.catatan) || null, dibuat, sumber, metode, ts).run();
  await logSync(env, "sheet_ke_worker", "Pesanan", key, "upsert", "insert, tanpa item dan tanpa ubah stok");
  return { result: "applied", detail: "insert, tanpa item dan tanpa ubah stok", key };
}

async function applyPesananItem(env: SyncEnv, row: Record<string, unknown>, key: string, ts: string, missingKey: boolean): Promise<ApplyResult> {
  if (missingKey) return { result: "error", detail: "nomor_pesanan dan kode_produk wajib diisi", key };
  const pesanan = await env.DB.prepare("SELECT id, diubah_pada FROM pesanan WHERE nomor_pesanan = ?").bind(str(row.nomor_pesanan)).first<{ id: number; diubah_pada: string }>();
  if (!pesanan) return { result: "error", detail: `pesanan ${str(row.nomor_pesanan)} tidak ada di database`, key };
  const produk = await env.DB.prepare("SELECT id FROM produk WHERE kode_produk = ?").bind(str(row.kode_produk)).first<{ id: number }>();
  if (!produk) return { result: "error", detail: `produk ${str(row.kode_produk)} tidak ada di database`, key };
  const qty = Math.max(1, Math.floor(num(row.qty) || 1));
  const harga = Math.max(0, Math.floor(num(row.harga_saat_beli)));
  const subtotal = Math.max(0, Math.floor(num(row.subtotal) || qty * harga));
  const existing = await env.DB.prepare("SELECT id, diubah_pada FROM pesanan_item WHERE pesanan_id = ? AND produk_id = ?")
    .bind(pesanan.id, produk.id).first<{ id: number; diubah_pada: string }>();
  if (existing && cmpTs(ts, existing.diubah_pada) <= 0) {
    await logSync(env, "sheet_ke_worker", "Pesanan Item", key, "lewat_konflik", `D1 lebih baru (${existing.diubah_pada}).`);
    return { result: "skipped_conflict", detail: "D1 lebih baru", key };
  }
  if (existing) {
    await env.DB.prepare("UPDATE pesanan_item SET qty = ?, harga_saat_beli = ?, subtotal = ?, diubah_pada = ? WHERE id = ?")
      .bind(qty, harga, subtotal, ts, existing.id).run();
  } else {
    await env.DB.prepare("INSERT INTO pesanan_item (pesanan_id, produk_id, qty, harga_saat_beli, subtotal, diubah_pada) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(pesanan.id, produk.id, qty, harga, subtotal, ts).run();
  }
  const total = await env.DB.prepare("SELECT COALESCE(SUM(subtotal), 0) AS t FROM pesanan_item WHERE pesanan_id = ?")
    .bind(pesanan.id).first<{ t: number }>();
  await env.DB.prepare("UPDATE pesanan SET total = ?, diubah_pada = ? WHERE id = ?")
    .bind(total?.t ?? 0, ts, pesanan.id).run();
  await logSync(env, "sheet_ke_worker", "Pesanan Item", key, "upsert", "item disimpan, total pesanan dihitung ulang, stok tidak diubah");
  return { result: "applied", detail: "item disimpan, total pesanan dihitung ulang, stok tidak diubah", key };
}

async function applyTransaksi(env: SyncEnv, row: Record<string, unknown>, key: string, ts: string, missingKey: boolean, rowNum: number | null): Promise<ApplyResult> {
  const jenis = str(row.jenis);
  const jumlah = Math.floor(num(row.jumlah));
  const metode = str(row.metode);
  if (!["simpanan", "pembayaran", "penarikan"].includes(jenis)) return { result: "error", detail: "jenis harus simpanan/pembayaran/penarikan", key };
  if (jumlah <= 0) return { result: "error", detail: "jumlah harus lebih dari 0", key };
  if (!PAY_METHODS.includes(metode)) return { result: "error", detail: "metode harus tunai/transfer/qris", key };
  let kode = key;
  let generated = false;
  if (missingKey) {
    const today = wibNow().slice(0, 10).replaceAll("-", "");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM transaksi WHERE substr(dibuat_pada, 1, 10) = ?").bind(wibNow().slice(0, 10)).first<{ n: number }>();
    kode = `TRX-${today}-${String((n?.n ?? 0) + 1).padStart(4, "0")}`;
    generated = true;
  }
  let pesananId: number | null = null;
  const nomor = str(row.nomor_pesanan);
  if (nomor) {
    const p = await env.DB.prepare("SELECT id FROM pesanan WHERE nomor_pesanan = ?").bind(nomor).first<{ id: number }>();
    if (!p) return { result: "error", detail: `pesanan ${nomor} tidak ada di database`, key: kode };
    pesananId = p.id;
  }
  const dibuat = normTs(row.tanggal) || ts;
  let stafId: number | null = null;
  const stafEmailRaw = str(row.staf_id).toLowerCase();
  if (stafEmailRaw) {
    const s = await env.DB.prepare("SELECT id FROM staf WHERE email = ?").bind(stafEmailRaw).first<{ id: number }>();
    if (!s) {
      await logSync(env, "sheet_ke_worker", "Transaksi", kode, "error", `staf_id ${stafEmailRaw} tidak ada di tabel staf`);
      return { result: "error", detail: `staf_id ${stafEmailRaw} tidak ada di tabel staf`, key: kode };
    }
    stafId = s.id;
  }
  let kategori = str(row.kategori) || null;
  const existing = await env.DB.prepare("SELECT id, diubah_pada, staf_id, kategori FROM transaksi WHERE kode = ?").bind(kode).first<{ id: number; diubah_pada: string; staf_id: number | null; kategori: string | null }>();
  if (existing && cmpTs(ts, existing.diubah_pada) <= 0) {
    await logSync(env, "sheet_ke_worker", "Transaksi", kode, "lewat_konflik", `D1 lebih baru (${existing.diubah_pada}).`);
    return { result: "skipped_conflict", detail: "D1 lebih baru", key: kode };
  }
  if (existing && !stafEmailRaw) stafId = existing.staf_id;
  if (existing && !kategori) kategori = existing.kategori;
  let trxId: number;
  if (existing) {
    await env.DB.prepare(
      "UPDATE transaksi SET jenis = ?, jumlah = ?, metode = ?, pesanan_id = ?, staf_id = ?, kategori = ?, keterangan = ?, dibuat_pada = ?, diubah_pada = ? WHERE id = ?"
    ).bind(jenis, jumlah, metode, pesananId, stafId, kategori, str(row.keterangan) || null, dibuat, ts, existing.id).run();
    trxId = existing.id;
  } else {
    const ins = await env.DB.prepare(
      "INSERT INTO transaksi (kode, pesanan_id, staf_id, jenis, jumlah, metode, kategori, keterangan, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(kode, pesananId, stafId, jenis, jumlah, metode, kategori, str(row.keterangan) || null, dibuat, ts).run();
    trxId = ins.meta.last_row_id as number;
  }
  if (pesananId && jenis === "pembayaran") await refreshOrderPaid(env, pesananId);
  await logSync(env, "sheet_ke_worker", "Transaksi", kode, "upsert", generated ? "insert, kode dibuat otomatis" : existing ? "update" : "insert");
  return { result: "applied", detail: generated ? "insert, kode dibuat otomatis" : existing ? "update" : "insert", key: kode,
    mirror: generated ? { tab: "Transaksi", id: trxId, rowNum } : null };
}

async function applyLaporan(env: SyncEnv, row: Record<string, unknown>, key: string, ts: string): Promise<ApplyResult> {
  const jenis = str(row.jenis);
  const mulai = normTs(row.periode_mulai).slice(0, 10);
  const selesai = normTs(row.periode_selesai).slice(0, 10);
  if (!["harian", "mingguan", "bulanan"].includes(jenis) || !mulai || !selesai) {
    return { result: "error", detail: "jenis harian/mingguan/bulanan dan periode wajib diisi", key };
  }
  const email = str(row.dibuat_oleh).toLowerCase();
  let stafId: number | null = null;
  if (email) {
    const s = await env.DB.prepare("SELECT id FROM staf WHERE email = ?").bind(email).first<{ id: number }>();
    if (!s) {
      await logSync(env, "sheet_ke_worker", "Laporan", key, "error", `dibuat_oleh ${email} tidak ada di tabel staf`);
      return { result: "error", detail: `dibuat_oleh ${email} tidak ada di tabel staf`, key };
    }
    stafId = s.id;
  }
  const dibuat = normTs(row.dibuat_pada) || ts;
  const existing = await env.DB.prepare(
    "SELECT id, diubah_pada FROM laporan WHERE jenis = ? AND periode_mulai = ? AND periode_selesai = ? ORDER BY id LIMIT 1"
  ).bind(jenis, mulai, selesai).first<{ id: number; diubah_pada: string }>();
  if (existing && cmpTs(ts, existing.diubah_pada) <= 0) {
    await logSync(env, "sheet_ke_worker", "Laporan", key, "lewat_konflik", `D1 lebih baru (${existing.diubah_pada}).`);
    return { result: "skipped_conflict", detail: "D1 lebih baru", key };
  }
  if (existing) {
    await env.DB.prepare("UPDATE laporan SET staf_id = ?, ringkasan = ?, dibuat_pada = ?, diubah_pada = ? WHERE id = ?")
      .bind(stafId, str(row.ringkasan) || null, dibuat, ts, existing.id).run();
    await logSync(env, "sheet_ke_worker", "Laporan", key, "upsert", "update");
    return { result: "applied", detail: "update", key };
  }
  await env.DB.prepare("INSERT INTO laporan (staf_id, jenis, periode_mulai, periode_selesai, ringkasan, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(stafId, jenis, mulai, selesai, str(row.ringkasan) || null, dibuat, ts).run();
  await logSync(env, "sheet_ke_worker", "Laporan", key, "upsert", "insert");
  return { result: "applied", detail: "insert", key };
}

export async function dumpTab(env: SyncEnv, tab: SyncTab): Promise<{ headers: string[]; rows: unknown[][] } | null> {
  const res = await gasPost(env, { action: "dump", tab });
  if (!res || res.ok !== true) return null;
  return {
    headers: Array.isArray(res.headers) ? (res.headers as string[]) : [],
    rows: Array.isArray(res.rows) ? (res.rows as unknown[][]) : [],
  };
}

async function fetchAllD1(env: SyncEnv, tab: SyncTab): Promise<Map<string, { sheetRow: Record<string, unknown>; ts: string; id: number }>> {
  const map = new Map<string, { sheetRow: Record<string, unknown>; ts: string; id: number }>();
  if (tab === "Produk") {
    const r = await env.DB.prepare("SELECT * FROM produk ORDER BY id").all();
    for (const p of (r.results ?? []) as Record<string, unknown>[]) {
      map.set(String(p.kode_produk), { sheetRow: await produkSheetRow(env, p), ts: normTs(p.diubah_pada), id: p.id as number });
    }
  } else if (tab === "Pesanan") {
    const r = await env.DB.prepare("SELECT * FROM pesanan ORDER BY id").all();
    for (const o of (r.results ?? []) as Record<string, unknown>[]) {
      map.set(String(o.nomor_pesanan), { sheetRow: await pesananSheetRow(o), ts: normTs(o.diubah_pada), id: o.id as number });
    }
  } else if (tab === "Pesanan Item") {
    const r = await env.DB.prepare(
      `SELECT pi.*, p.kode_produk, p.nama AS produk_nama FROM pesanan_item pi
       JOIN produk p ON p.id = pi.produk_id ORDER BY pi.id`
    ).all();
    for (const it of (r.results ?? []) as Record<string, unknown>[]) {
      const row = await pesananItemSheetRow(env, it);
      map.set(rowKey(tab, row), { sheetRow: row, ts: normTs(it.diubah_pada), id: it.id as number });
    }
  } else if (tab === "Transaksi") {
    const r = await env.DB.prepare("SELECT * FROM transaksi ORDER BY id").all();
    for (const t of (r.results ?? []) as Record<string, unknown>[]) {
      map.set(String(t.kode), { sheetRow: await transaksiSheetRow(env, t), ts: normTs(t.diubah_pada), id: t.id as number });
    }
  } else if (tab === "Anggota") {
    const r = await env.DB.prepare("SELECT * FROM anggota ORDER BY id").all();
    for (const a of (r.results ?? []) as Record<string, unknown>[]) {
      map.set(String(a.kode), { sheetRow: await anggotaSheetRow(a), ts: normTs(a.diubah_pada), id: a.id as number });
    }
  } else if (tab === "Kategori") {
    const r = await env.DB.prepare("SELECT * FROM kategori ORDER BY id").all();
    for (const k of (r.results ?? []) as Record<string, unknown>[]) {
      map.set(String(k.id), { sheetRow: await kategoriSheetRow(k), ts: normTs(k.diubah_pada), id: k.id as number });
    }
  } else if (tab === "Staf") {
    const r = await env.DB.prepare("SELECT * FROM staf ORDER BY id").all();
    for (const s of (r.results ?? []) as Record<string, unknown>[]) {
      map.set(String(s.email), { sheetRow: await stafSheetRow(s), ts: normTs(s.diubah_pada), id: s.id as number });
    }
  } else if (tab === "Laporan") {
    const r = await env.DB.prepare("SELECT * FROM laporan ORDER BY id").all();
    for (const l of (r.results ?? []) as Record<string, unknown>[]) {
      const row = await laporanSheetRow(env, l);
      map.set(rowKey(tab, row), { sheetRow: row, ts: normTs(l.diubah_pada), id: l.id as number });
    }
  }
  return map;
}

export interface ReconcileTabSummary {
  d1_ke_sheet: number;
  sheet_ke_d1: number;
  sama: number;
  contoh_dilewat: number;
  error: number;
}

function normVal(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function diffRowValues(d1Row: Record<string, unknown>, sheetRow: Record<string, unknown>): string[] {
  const diffs: string[] = [];
  for (const k of Object.keys(d1Row)) {
    if (k === "diubah_pada") continue;
    if (!(k in sheetRow)) continue;
    if (normVal(d1Row[k]) !== normVal(sheetRow[k])) {
      diffs.push(`${k}: D1=${normVal(d1Row[k])} Sheet=${normVal(sheetRow[k])}`);
    }
  }
  return diffs;
}

const TS_TABLE: Record<SyncTab, string> = {
  Anggota: "anggota",
  Kategori: "kategori",
  Produk: "produk",
  Pesanan: "pesanan",
  "Pesanan Item": "pesanan_item",
  Transaksi: "transaksi",
  Staf: "staf",
  Laporan: "laporan",
};

export async function reconcileAll(env: SyncEnv, ctx: ExecutionContext): Promise<{ ok: boolean; summary?: Record<string, ReconcileTabSummary>; error?: string }> {
  if (!env.GAS_MIRROR_URL || !env.GAS_MIRROR_SECRET) {
    return { ok: false, error: "gas_mirror_not_configured" };
  }
  const summary: Record<string, ReconcileTabSummary> = {};
  for (const tab of SYNC_TABS) {
    const s: ReconcileTabSummary = { d1_ke_sheet: 0, sheet_ke_d1: 0, sama: 0, contoh_dilewat: 0, error: 0 };
    summary[tab] = s;
    const dump = await dumpTab(env, tab);
    if (!dump) {
      s.error++;
      continue;
    }
    const headers = dump.headers;
    const sheetMap = new Map<string, Record<string, unknown>>();
    for (const arr of dump.rows) {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = arr[i] ?? ""; });
      if (str(obj.sumber) === "contoh") {
        s.contoh_dilewat++;
        continue;
      }
      const k = rowKey(tab, obj);
      if (k.replaceAll("|", "") === "") continue;
      sheetMap.set(k, obj);
    }
    const d1Map = await fetchAllD1(env, tab);
    const toSheet: Record<string, unknown>[] = [];
    for (const [key, d1] of d1Map) {
      const sheetRow = sheetMap.get(key);
      if (!sheetRow) {
        toSheet.push(d1.sheetRow);
        s.d1_ke_sheet++;
        continue;
      }
      const sheetTs = normTs(sheetRow.diubah_pada);
      const c = cmpTs(d1.ts, sheetTs);
      if (c > 0) {
        toSheet.push(d1.sheetRow);
        s.d1_ke_sheet++;
      } else if (c < 0) {
        const r = await applySheetRow(env, tab, sheetRow);
        if (r.result === "applied") s.sheet_ke_d1++;
        else if (r.result === "error") s.error++;
        else s.sama++;
      } else {
        const diffs = diffRowValues(d1.sheetRow, sheetRow);
        if (diffs.length) {
          const freshTs = wibNow();
          await env.DB.prepare(`UPDATE ${TS_TABLE[tab]} SET diubah_pada = ? WHERE id = ?`).bind(freshTs, d1.id).run();
          await logSync(env, "reconcile", tab, key, "upsert", `drift nilai, D1 menang: ${diffs.join("; ")}`);
          toSheet.push({ ...d1.sheetRow, diubah_pada: freshTs });
          s.d1_ke_sheet++;
        } else {
          s.sama++;
        }
      }
    }
    for (const [key, sheetRow] of sheetMap) {
      if (d1Map.has(key)) continue;
      const r = await applySheetRow(env, tab, sheetRow);
      if (r.result === "applied") s.sheet_ke_d1++;
      else if (r.result === "error") s.error++;
    }
    if (toSheet.length) {
      const res = await upsertToSheet(env, tab, toSheet);
      if (!res) s.error++;
      for (const sk of res?.skipped ?? []) {
        await logSync(env, "reconcile", tab, String(sk.key ?? ""), "lewat_konflik", "Sheet berubah saat rekonsiliasi jalan.");
      }
    }
    await logSync(env, "reconcile", tab, "semua", "upsert", JSON.stringify(s));
  }
  return { ok: true, summary };
}

export async function sheetRowById(env: SyncEnv, tab: SyncTab, id: number): Promise<Record<string, unknown> | null> {
  if (tab === "Produk") {
    const p = await env.DB.prepare("SELECT * FROM produk WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return p ? produkSheetRow(env, p) : null;
  }
  if (tab === "Pesanan") {
    const o = await env.DB.prepare("SELECT * FROM pesanan WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return o ? pesananSheetRow(o) : null;
  }
  if (tab === "Transaksi") {
    const t = await env.DB.prepare("SELECT * FROM transaksi WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return t ? transaksiSheetRow(env, t) : null;
  }
  if (tab === "Staf") {
    const s = await env.DB.prepare("SELECT * FROM staf WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return s ? stafSheetRow(s) : null;
  }
  if (tab === "Kategori") {
    const k = await env.DB.prepare("SELECT * FROM kategori WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return k ? kategoriSheetRow(k) : null;
  }
  if (tab === "Anggota") {
    const a = await env.DB.prepare("SELECT * FROM anggota WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return a ? anggotaSheetRow(a) : null;
  }
  if (tab === "Laporan") {
    const l = await env.DB.prepare("SELECT * FROM laporan WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return l ? laporanSheetRow(env, l) : null;
  }
  return null;
}
