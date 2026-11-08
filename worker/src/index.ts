// Koperasi MBG API Worker (Cloudflare Workers + D1).
// D1 is the source of truth. Google Sheet is only a mirror, best effort,
// and an order must never fail because the mirror fails.

import { buildQrisPayload } from "./qris";
import { handleTelegramUpdate } from "./telegram";
import {
  applySheetRow,
  mirrorPesanan,
  mirrorPesananItems,
  mirrorProduk,
  mirrorStaf,
  mirrorTransaksi,
  mirrorUpsert,
  reconcileAll,
  sheetRowById,
  SYNC_TABS,
  upsertToSheet,
} from "./sync";
import type { SyncTab } from "./sync";

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  FORWARDER_SECRET?: string;
  GAS_MIRROR_URL?: string;
  GAS_MIRROR_SECRET?: string;
  SHEET_SYNC_SECRET?: string;
  QRIS_MERCHANT_NAME?: string;
  QRIS_MERCHANT_CITY?: string;
  QRIS_NMID?: string;
  QRIS_MERCHANT_ID?: string;
  QRIS_MCC?: string;
  DEV_MODE?: string;
  ADMIN_TELEGRAM_ID?: string;
}

const ALLOWED_ORIGINS = [
  "https://zakyshadra.github.io",
  "https://koperasimbg.ices.my.id",
  "http://koperasimbg.ices.my.id",
  "http://localhost:5173",
  "http://localhost:3000",
];

const ORDER_STATUSES = ["baru", "disiapkan", "siap", "selesai", "dibatalkan"] as const;
const NEXT_STATUS: Record<string, string> = { baru: "disiapkan", disiapkan: "siap", siap: "selesai" };
const PAY_METHODS = ["tunai", "transfer", "qris"];
const DRAFT_CONFIRM_MS = 3 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACTION_TOKEN_TTL_MS = 10 * 60 * 1000;

// ---------- small helpers ----------

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-forwarder-secret",
    "access-control-max-age": "86400",
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

function fail(req: Request, message: string, status = 400): Response {
  return json(req, { ok: false, error: message }, status);
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

// WIB wall clock helpers. Timestamps are stored as "YYYY-MM-DD HH:mm:ss" WIB.
function wibParts(epochMs: number): { date: string; datetime: string } {
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
  const parts = Object.fromEntries(fmt.formatToParts(epochMs).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const datetime = `${date} ${parts.hour}:${parts.minute}:${parts.second}`;
  return { date, datetime };
}

function wibToEpoch(wib: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(wib);
  if (!m) return 0;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return utc - 7 * 60 * 60 * 1000;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

function qrisConfig(env: Env) {
  return {
    merchantName: env.QRIS_MERCHANT_NAME ?? "KOPERASI MBG (DUMMY)",
    merchantCity: env.QRIS_MERCHANT_CITY ?? "BANDUNG",
    nmid: env.QRIS_NMID ?? "ID1020000000000",
    merchantId: env.QRIS_MERCHANT_ID ?? "000000000000000",
    mcc: env.QRIS_MCC ?? "5812",
  };
}

function isDummyQris(env: Env): boolean {
  const cfg = qrisConfig(env);
  return cfg.nmid === "ID1020000000000" || cfg.merchantId === "000000000000000";
}

// ---------- auth ----------

interface Staff {
  id: number;
  kode: string | null;
  nama: string;
  email: string;
  peran: string;
}

async function getSessionStaff(env: Env, req: Request): Promise<Staff | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS staf_id, s.kode, s.nama, s.email, s.peran, se.berakhir_pada, se.dicabut_pada
     FROM sesi se JOIN staf s ON s.id = se.staf_id
     WHERE se.token_hash = ? AND se.dicabut_pada IS NULL`
  )
    .bind(hash)
    .first<{
      staf_id: number;
      kode: string | null;
      nama: string;
      email: string;
      peran: string;
      berakhir_pada: string;
      dicabut_pada: string | null;
    }>();
  if (!row) return null;
  if (wibToEpoch(row.berakhir_pada) < Date.now()) return null;
  // Sliding session: extend expiry to now + 30 days on every valid request.
  const { datetime } = wibParts(Date.now() + SESSION_TTL_MS);
  await env.DB.prepare("UPDATE sesi SET berakhir_pada = ? WHERE token_hash = ?")
    .bind(datetime, hash)
    .run();
  return { id: row.staf_id, kode: row.kode, nama: row.nama, email: row.email, peran: row.peran };
}

async function requireStaff(env: Env, req: Request, roles?: string[]): Promise<{ staff: Staff } | { res: Response }> {
  const staff = await getSessionStaff(env, req);
  if (!staff) return { res: fail(req, "unauthorized", 401) };
  if (roles && !roles.includes(staff.peran)) return { res: fail(req, "forbidden_role", 403) };
  return { staff };
}

async function verifyActionToken(env: Env, token: string): Promise<Staff | null> {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT t.staf_id, t.kedaluwarsa_pada, t.dipakai_pada, s.nama, s.email, s.peran, s.kode
     FROM token_aksi t JOIN staf s ON s.id = t.staf_id
     WHERE t.token_hash = ? AND t.dipakai_pada IS NULL`
  )
    .bind(hash)
    .first<{
      staf_id: number;
      kedaluwarsa_pada: string;
      dipakai_pada: string | null;
      nama: string;
      email: string;
      peran: string;
      kode: string | null;
    }>();
  if (!row || wibToEpoch(row.kedaluwarsa_pada) < Date.now()) return null;
  await env.DB.prepare("UPDATE token_aksi SET dipakai_pada = datetime('now') WHERE token_hash = ?")
    .bind(hash)
    .run();
  return { id: row.staf_id, kode: row.kode, nama: row.nama, email: row.email, peran: row.peran };
}

function normWaPublic(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim().replace(/[\s-]/g, "");
  if (/^8\d{9,12}$/.test(s)) return "0" + s;
  return s;
}

function maskWa(wa: string): string {
  const d = wa.replace(/\D/g, "");
  if (d.length < 8) return "****";
  return d.slice(0, 4) + "****" + d.slice(-4);
}

function rateLimited(req: Request): Response {
  return new Response(JSON.stringify({ ok: false, error: "terlalu_banyak_permintaan_coba_lagi_nanti" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "60", ...corsHeaders(req) },
  });
}

async function checkRateLimit(env: Env, req: Request, route: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const fwd = req.headers.get("X-Forwarded-For") ?? "";
    const ip = req.headers.get("CF-Connecting-IP") ?? fwd.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    await env.DB.prepare("DELETE FROM rate_limit WHERE route = ? AND window_start < ?").bind(route, now - windowMs).run();
    await env.DB.prepare(
      "INSERT INTO rate_limit (ip, route, window_start, count) VALUES (?, ?, ?, 1) ON CONFLICT(ip, route, window_start) DO UPDATE SET count = count + 1"
    ).bind(ip, route, windowStart).run();
    const row = await env.DB.prepare("SELECT count FROM rate_limit WHERE ip = ? AND route = ? AND window_start = ?")
      .bind(ip, route, windowStart)
      .first<{ count: number }>();
    return (row?.count ?? 0) <= limit;
  } catch {
    return true;
  }
}

// ---------- orders ----------

async function nextOrderNumber(env: Env): Promise<string> {
  const today = wibParts(Date.now()).date.replaceAll("-", "");
  for (let attempt = 0; attempt < 5; attempt++) {
    const { count } = (await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM pesanan WHERE substr(dibuat_pada, 1, 10) = ?"
    )
      .bind(wibParts(Date.now()).date)
      .first<{ count: number }>()) ?? { count: 0 };
    const num = `MBG-${today}-${pad(count + 1 + attempt, 4)}`;
    const exists = await env.DB.prepare("SELECT id FROM pesanan WHERE nomor_pesanan = ?")
      .bind(num)
      .first();
    if (!exists) return num;
  }
  return `MBG-${today}-${pad(Date.now() % 10000, 4)}`;
}

function restoreStockStmt(env: Env, orderId: number, now: string): D1PreparedStatement {
  return env.DB.prepare(
    `UPDATE produk SET stok = stok + (SELECT qty FROM pesanan_item WHERE pesanan_item.pesanan_id = ? AND pesanan_item.produk_id = produk.id),
     diubah_pada = ? WHERE id IN (SELECT produk_id FROM pesanan_item WHERE pesanan_id = ?)`
  ).bind(orderId, now, orderId);
}

async function restoreStockMirror(env: Env, ctx: ExecutionContext, orderId: number): Promise<void> {
  const items = await env.DB.prepare("SELECT produk_id FROM pesanan_item WHERE pesanan_id = ?").bind(orderId).all();
  for (const it of (items.results ?? []) as { produk_id: number }[]) {
    await mirrorProduk(env, ctx, it.produk_id);
  }
}

async function expireStaleDrafts(env: Env): Promise<void> {
  const cutoff = wibParts(Date.now() - DRAFT_CONFIRM_MS).datetime;
  const now = wibParts(Date.now()).datetime;
  const stale = await env.DB.prepare(
    "SELECT id FROM pesanan WHERE is_draft = 1 AND status = 'baru' AND dibuat_pada < ?"
  ).bind(cutoff).all();
  const stmts: D1PreparedStatement[] = [];
  for (const o of (stale.results ?? []) as { id: number }[]) {
    stmts.push(
      env.DB.prepare("UPDATE pesanan SET status = 'dibatalkan', diubah_pada = ? WHERE id = ?").bind(now, o.id)
    );
    stmts.push(restoreStockStmt(env, o.id, now));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

function stripWaForFinance(order: Record<string, unknown>, role: string): Record<string, unknown> {
  if (role === "finance") {
    const copy = { ...order };
    delete copy.no_wa_pelanggan;
    return copy;
  }
  return order;
}

async function mirrorOrder(env: Env, ctx: ExecutionContext, orderId: number): Promise<void> {
  await mirrorPesanan(env, ctx, orderId);
  await mirrorPesananItems(env, ctx, orderId);
}

async function loadOrderItems(env: Env, orderIds: number[]): Promise<Map<number, unknown[]>> {
  const map = new Map<number, unknown[]>();
  if (!orderIds.length) return map;
  const placeholders = orderIds.map(() => "?").join(",");
  const items = await env.DB.prepare(
    `SELECT pi.pesanan_id, pi.qty, pi.harga_saat_beli, pi.subtotal, p.nama AS produk_nama
     FROM pesanan_item pi JOIN produk p ON p.id = pi.produk_id
     WHERE pi.pesanan_id IN (${placeholders})`
  ).bind(...orderIds).all();
  for (const it of (items.results ?? []) as Record<string, unknown>[]) {
    const id = it.pesanan_id as number;
    const arr = map.get(id) ?? [];
    arr.push({ produk_nama: it.produk_nama, qty: it.qty, harga_saat_beli: it.harga_saat_beli, subtotal: it.subtotal });
    map.set(id, arr);
  }
  return map;
}

interface OrderItemInput {
  product_id: number;
  qty: number;
}

async function createOrder(
  env: Env,
  req: Request,
  ctx: ExecutionContext,
  input: {
    nama: string;
    wa: string;
    items: OrderItemInput[];
    metode: string;
    catatan?: string;
    sumber?: string;
    isDraft?: boolean;
    rawText?: string;
    allowEmptyWa?: boolean;
  }
): Promise<Response> {
  const nama = String(input.nama ?? "").trim();
  const wa = String(input.wa ?? "").trim();
  if (!nama) return fail(req, "nama_wajib_diisi");
  if (!input.allowEmptyWa && !wa) return fail(req, "no_wa_wajib_diisi");
  if (!PAY_METHODS.includes(input.metode)) return fail(req, "metode_bayar_tidak_dikenal");
  if (!input.items.length) return fail(req, "pesanan_tanpa_item_tidak_valid");

  const products: { id: number; kode_produk: string; harga: number; stok: number; nama: string; tersedia: number }[] = [];
  let total = 0;
  for (const item of input.items) {
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) return fail(req, "qty_harus_lebih_dari_0");
    const p = await env.DB.prepare("SELECT id, kode_produk, harga, stok, nama, tersedia FROM produk WHERE id = ? AND is_aktif = 1")
      .bind(Number(item.product_id))
      .first<{ id: number; kode_produk: string; harga: number; stok: number; nama: string; tersedia: number }>();
    if (!p) return fail(req, `produk_tidak_ditemukan:${item.product_id}`);
    if (p.tersedia === 0 || p.stok < qty) return fail(req, `stok_tidak_cukup:${p.nama}`);
    products.push(p);
    total += p.harga * qty;
  }

  const nomor = await nextOrderNumber(env);
  const now = wibParts(Date.now()).datetime;
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO pesanan (nomor_pesanan, anggota_id, nama_pelanggan, no_wa_pelanggan, status, total, catatan, dibuat_pada, diubah_pada, sumber_pesanan, is_draft, metode_bayar, status_bayar, raw_text)
       VALUES (?, NULL, ?, ?, 'baru', ?, ?, ?, ?, ?, ?, ?, 'belum', ?)`
    ).bind(
      nomor,
      nama,
      wa,
      total,
      input.catatan ?? null,
      now,
      now,
      input.sumber ?? "web",
      input.isDraft ? 1 : 0,
      input.metode,
      input.rawText ?? null
    ),
  ];
  const inserted = await env.DB.batch(stmts);
  const orderId = inserted[0].meta.last_row_id as number;

  const itemStmts: D1PreparedStatement[] = [];
  input.items.forEach((item, i) => {
    const p = products[i];
    itemStmts.push(
      env.DB.prepare(
        "INSERT INTO pesanan_item (pesanan_id, produk_id, qty, harga_saat_beli, subtotal, diubah_pada) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(orderId, p.id, Number(item.qty), p.harga, p.harga * Number(item.qty), now)
    );
    itemStmts.push(
      env.DB.prepare("UPDATE produk SET stok = stok - ?, diubah_pada = ? WHERE id = ? AND stok >= ?")
        .bind(Number(item.qty), now, p.id, Number(item.qty))
    );
  });
  await env.DB.batch(itemStmts);

  const order = {
    id: orderId,
    nomor_pesanan: nomor,
    nama_pelanggan: nama,
    no_wa_pelanggan: wa,
    status: "baru",
    total,
    metode_bayar: input.metode,
    status_bayar: "belum",
    sumber_pesanan: input.sumber ?? "web",
    is_draft: input.isDraft ? 1 : 0,
    dibuat_pada: now,
  };
  await mirrorOrder(env, ctx, orderId);
  for (const p of products) {
    await mirrorProduk(env, ctx, p.id);
  }
  const res: Record<string, unknown> = { ok: true, order };
  if (input.metode === "qris") {
    res.qris_payload = buildQrisPayload(qrisConfig(env), total, nomor);
    res.qris_dummy = isDummyQris(env);
  }
  return json(req, res, 201);
}

// ---------- router ----------

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (path === "/" && method === "GET") {
      return json(req, { ok: true, service: "koperasi-mbg-api" });
    }

    if (path.startsWith("/api/")) {
      if (!(await checkRateLimit(env, req, "general", 300, 60_000))) return rateLimited(req);
    }

    // Public catalog
    if (path === "/api/catalog" && method === "GET") {
      const tab = url.searchParams.get("tab");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const categories = await env.DB.prepare("SELECT id, nama, deskripsi FROM kategori ORDER BY id").all();
      let sql = `SELECT p.id, p.kode_produk, p.nama, p.harga, p.stok, p.satuan, p.deskripsi, p.gambar, p.tersedia, p.is_aktif,
        k.nama AS kategori FROM produk p JOIN kategori k ON k.id = p.kategori_id WHERE p.is_aktif = 1`;
      const binds: unknown[] = [];
      if (tab === "koperasi") {
        sql += " AND k.nama = 'Barang Koperasi'";
      } else if (tab === "warkop") {
        sql += " AND k.nama = 'Warkop'";
      }
      if (q) {
        sql += " AND lower(p.nama) LIKE ?";
        binds.push(`%${q}%`);
      }
      sql += " ORDER BY k.id, p.id";
      const products = await env.DB.prepare(sql).bind(...binds).all();
      return json(req, { ok: true, categories: categories.results ?? [], products: products.results ?? [] });
    }

    // Guest order create
    if (path === "/api/orders" && method === "POST") {
      if (!(await checkRateLimit(env, req, "order_create", 60, 60_000))) return rateLimited(req);
      const body = await readBody(req);
      const items = (Array.isArray(body.items) ? body.items : []) as OrderItemInput[];
      return createOrder(env, req, ctx, {
        nama: String(body.nama ?? body.nama_pelanggan ?? ""),
        wa: String(body.no_wa ?? body.no_wa_pelanggan ?? ""),
        items,
        metode: String(body.metode_bayar ?? body.metode ?? "tunai"),
        catatan: body.catatan ? String(body.catatan) : undefined,
        sumber: "web",
      });
    }

    // List orders (manager, finance) with optional status filter
    if (path === "/api/orders" && method === "GET") {
      const auth = await requireStaff(env, req, ["manager", "finance"]);
      if ("res" in auth) return auth.res;
      const status = url.searchParams.get("status") ?? "";
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 200);
      let sql = "SELECT * FROM pesanan WHERE 1 = 1";
      const binds: unknown[] = [];
      if (status && ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
        sql += " AND status = ?";
        binds.push(status);
      }
      sql += " ORDER BY dibuat_pada DESC LIMIT ?";
      binds.push(limit);
      const rows = await env.DB.prepare(sql).bind(...binds).all();
      const list = (rows.results ?? []) as Record<string, unknown>[];
      const items = await loadOrderItems(env, list.map((o) => o.id as number));
      const withItems = list.map((o) => {
        const rec = { ...o, items: items.get(o.id as number) ?? [] };
        return stripWaForFinance(rec, auth.staff.peran);
      });
      return json(req, { ok: true, orders: withItems });
    }

    // Walk-in order (barista or manager)
    if (path === "/api/orders/walk-in" && method === "POST") {
      if (!(await checkRateLimit(env, req, "order_create", 60, 60_000))) return rateLimited(req);
      const auth = await requireStaff(env, req, ["barista", "manager"]);
      if ("res" in auth) return auth.res;
      const body = await readBody(req);
      const items = (Array.isArray(body.items) ? body.items : []) as OrderItemInput[];
      return createOrder(env, req, ctx, {
        nama: String(body.nama ?? body.nama_pelanggan ?? ""),
        wa: String(body.no_wa ?? body.no_wa_pelanggan ?? ""),
        items,
        metode: String(body.metode_bayar ?? body.metode ?? "tunai"),
        catatan: body.catatan ? String(body.catatan) : undefined,
        sumber: "walk-in",
        allowEmptyWa: true,
      });
    }

    // Track order by number (public). The WA number is proof of ownership:
    // without a matching WA only a masked WA and no items are returned.
    const trackMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (trackMatch && method === "GET") {
      const nomor = decodeURIComponent(trackMatch[1]);
      const order = await env.DB.prepare("SELECT * FROM pesanan WHERE nomor_pesanan = ?").bind(nomor).first();
      if (!order) return fail(req, "pesanan_tidak_ditemukan", 404);
      const suppliedWa = normWaPublic(url.searchParams.get("wa") ?? url.searchParams.get("no_wa") ?? "");
      const orderWa = normWaPublic((order as Record<string, unknown>).no_wa_pelanggan);
      const verified = suppliedWa !== "" && orderWa !== "" && suppliedWa === orderWa;
      const publicOrder = { ...(order as Record<string, unknown>), no_wa_pelanggan: maskWa(orderWa) };
      if (!verified) return json(req, { ok: true, verified: false, order: publicOrder, items: [] });
      const items = await env.DB.prepare(
        `SELECT pi.produk_id, pi.qty, pi.harga_saat_beli, pi.subtotal, p.nama AS produk_nama
         FROM pesanan_item pi JOIN produk p ON p.id = pi.produk_id WHERE pi.pesanan_id = ?`
      )
        .bind((order as { id: number }).id)
        .all();
      return json(req, { ok: true, verified: true, order, items: items.results ?? [] });
    }

    // QRIS payload for an order (by order number)
    const qrisMatch = path.match(/^\/api\/orders\/([^/]+)\/qris$/);
    if (qrisMatch && method === "GET") {
      const nomor = decodeURIComponent(qrisMatch[1]);
      const order = await env.DB.prepare("SELECT nomor_pesanan, total, status FROM pesanan WHERE nomor_pesanan = ?")
        .bind(nomor)
        .first<{ nomor_pesanan: string; total: number; status: string }>();
      if (!order) return fail(req, "pesanan_tidak_ditemukan", 404);
      return json(req, {
        ok: true,
        order_number: order.nomor_pesanan,
        amount: order.total,
        status: order.status,
        qris_payload: buildQrisPayload(qrisConfig(env), order.total, order.nomor_pesanan),
        qris_dummy: isDummyQris(env),
        note: isDummyQris(env)
          ? "Dummy QRIS: NMID belum diisi. QR ini tidak memindahkan uang asli. Daftar merchant NMID dulu."
          : undefined,
      });
    }

    // DEV only: mark order paid
    const payMatch = path.match(/^\/api\/orders\/([^/]+)\/pay-dummy$/);
    if (payMatch && method === "POST") {
      if (env.DEV_MODE !== "true") return fail(req, "pay_dummy_hanya_di_dev_mode", 403);
      const nomor = decodeURIComponent(payMatch[1]);
      const order = await env.DB.prepare("SELECT id, status FROM pesanan WHERE nomor_pesanan = ?")
        .bind(nomor)
        .first<{ id: number; status: string }>();
      if (!order) return fail(req, "pesanan_tidak_ditemukan", 404);
      await env.DB.prepare("UPDATE pesanan SET status_bayar = 'lunas', dibayar_pada = ?, diubah_pada = ? WHERE id = ?")
        .bind(wibParts(Date.now()).datetime, wibParts(Date.now()).datetime, order.id)
        .run();
      await mirrorPesanan(env, ctx, order.id);
      return json(req, { ok: true, order_number: nomor, status_bayar: "lunas" });
    }

    // Barista queue
    if (path === "/api/barista/queue" && method === "GET") {
      const auth = await requireStaff(env, req, ["barista", "manager"]);
      if ("res" in auth) return auth.res;
      await expireStaleDrafts(env);
      const orders = await env.DB.prepare(
        `SELECT * FROM pesanan WHERE status IN ('baru', 'disiapkan', 'siap') ORDER BY dibuat_pada ASC`
      ).all();
      const rows = (orders.results ?? []) as Record<string, unknown>[];
      const items = await loadOrderItems(env, rows.map((o) => o.id as number));
      const list = rows.map((o) => {
        const rec = { ...o, items: items.get(o.id as number) ?? [] };
        return stripWaForFinance(rec, auth.staff.peran);
      });
      return json(req, { ok: true, orders: list });
    }

    // Change order status
    const statusMatch = path.match(/^\/api\/orders\/(\d+)\/status$/);
    if (statusMatch && method === "POST") {
      const auth = await requireStaff(env, req, ["barista", "manager"]);
      if ("res" in auth) return auth.res;
      const orderId = Number(statusMatch[1]);
      const body = await readBody(req);
      const target = String(body.status ?? "");
      const now = wibParts(Date.now()).datetime;
      if (!ORDER_STATUSES.includes(target as (typeof ORDER_STATUSES)[number])) {
        return fail(req, "status_tidak_dikenal");
      }
      const order = await env.DB.prepare("SELECT * FROM pesanan WHERE id = ?").bind(orderId).first<{
        id: number;
        nomor_pesanan: string;
        status: string;
        total: number;
        is_draft: number;
        dibuat_pada: string;
        metode_bayar: string;
        status_bayar: string;
      }>();
      if (!order) return fail(req, "pesanan_tidak_ditemukan", 404);
      if (order.status === "selesai" || order.status === "dibatalkan") {
        return fail(req, "pesanan_sudah_final_tidak_bisa_diubah");
      }
      if (target === "dibatalkan") {
        await env.DB.batch([
          env.DB.prepare("UPDATE pesanan SET status = 'dibatalkan', diubah_pada = ? WHERE id = ?").bind(now, orderId),
          restoreStockStmt(env, orderId, now),
        ]);
        await mirrorPesanan(env, ctx, orderId);
        await restoreStockMirror(env, ctx, orderId);
        return json(req, { ok: true, order_id: orderId, status: "dibatalkan" });
      }
      // Draft confirm: must be within 3 minutes, goes baru -> disiapkan.
      if (order.is_draft === 1) {
        if (target !== "disiapkan") return fail(req, "draft_harus_dikonfirmasi_dulu");
        if (Date.now() - wibToEpoch(order.dibuat_pada) > DRAFT_CONFIRM_MS) {
          await env.DB.batch([
            env.DB.prepare("UPDATE pesanan SET status = 'dibatalkan', diubah_pada = ? WHERE id = ?").bind(now, orderId),
            restoreStockStmt(env, orderId, now),
          ]);
          await mirrorPesanan(env, ctx, orderId);
          await restoreStockMirror(env, ctx, orderId);
          return fail(req, "draft_lewat_batas_3_menit_otomatis_batal", 410);
        }
        await env.DB.prepare("UPDATE pesanan SET is_draft = 0, status = 'disiapkan', diubah_pada = ? WHERE id = ?").bind(now, orderId).run();
        await mirrorPesanan(env, ctx, orderId);
        return json(req, { ok: true, order_id: orderId, status: "disiapkan", draft: false });
      }
      if (NEXT_STATUS[order.status] !== target) {
        return fail(req, `status_hanya_bisa_maju_satu_langkah_dari_${order.status}`);
      }
      if (target === "selesai") {
        const paid = order.status_bayar === "lunas";
        const tunaiDiterima = body.tunai_diterima === true && order.metode_bayar === "tunai";
        const paidRow = await env.DB.prepare(
          "SELECT COALESCE(SUM(jumlah), 0) AS paid FROM transaksi WHERE pesanan_id = ? AND jenis = 'pembayaran'"
        )
          .bind(orderId)
          .first<{ paid: number }>();
        const paidTotal = (paidRow?.paid ?? 0) + (paid ? order.total : 0);
        if (!paid && !tunaiDiterima && paidTotal < order.total) {
          return fail(req, "belum_lunas_pesanan_tidak_bisa_ditandai_selesai");
        }
        if (tunaiDiterima) {
          await env.DB.prepare("UPDATE pesanan SET status_bayar = 'lunas', dibayar_pada = ?, diubah_pada = ? WHERE id = ?")
            .bind(now, now, orderId)
            .run();
        }
      }
      await env.DB.prepare("UPDATE pesanan SET status = ?, diubah_pada = ? WHERE id = ?").bind(target, now, orderId).run();
      await mirrorPesanan(env, ctx, orderId);
      return json(req, { ok: true, order_id: orderId, status: target });
    }

    // Product availability toggle (barista or manager)
    const availMatch = path.match(/^\/api\/products\/(\d+)\/availability$/);
    if (availMatch && method === "POST") {
      const auth = await requireStaff(env, req, ["barista", "manager"]);
      if ("res" in auth) return auth.res;
      const body = await readBody(req);
      const tersedia = body.tersedia === 1 || body.tersedia === true ? 1 : 0;
      const product = await env.DB.prepare("SELECT id, stok FROM produk WHERE id = ?").bind(Number(availMatch[1])).first<{ id: number; stok: number }>();
      if (!product) return fail(req, "produk_tidak_ditemukan", 404);
      if (tersedia === 1 && product.stok === 0) return fail(req, "stok_kosong_produk_tidak_bisa_ditandai_tersedia");
      await env.DB.prepare("UPDATE produk SET tersedia = ?, diubah_pada = ? WHERE id = ?").bind(tersedia, wibParts(Date.now()).datetime, product.id).run();
      await mirrorProduk(env, ctx, product.id);
      return json(req, { ok: true, product_id: product.id, tersedia });
    }

    // Product price change (manager only + fresh OTP action token)
    const priceMatch = path.match(/^\/api\/products\/(\d+)\/price$/);
    if (priceMatch && method === "POST") {
      const auth = await requireStaff(env, req, ["manager"]);
      if ("res" in auth) return auth.res;
      const body = await readBody(req);
      const actionToken = String(body.action_token ?? "");
      const actor = await verifyActionToken(env, actionToken);
      if (!actor || actor.peran !== "manager" || actor.id !== auth.staff.id) {
        return fail(req, "butuh_otp_baru_untuk_ubah_harga", 403);
      }
      const harga = Number(body.harga);
      if (!Number.isFinite(harga) || harga <= 0) return fail(req, "harga_harus_lebih_dari_0");
      const product = await env.DB.prepare("SELECT id FROM produk WHERE id = ?").bind(Number(priceMatch[1])).first();
      if (!product) return fail(req, "produk_tidak_ditemukan", 404);
      await env.DB.prepare("UPDATE produk SET harga = ?, diubah_pada = ? WHERE id = ?").bind(harga, wibParts(Date.now()).datetime, Number(priceMatch[1])).run();
      await mirrorProduk(env, ctx, Number(priceMatch[1]));
      return json(req, { ok: true, product_id: Number(priceMatch[1]), harga });
    }

    // Warkop status
    if (path === "/api/warkop/status" && method === "GET") {
      const row = await env.DB.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'warkop_status'").first<{ nilai: string }>();
      return json(req, { ok: true, status: row?.nilai ?? "buka" });
    }
    if (path === "/api/warkop/status" && method === "POST") {
      const auth = await requireStaff(env, req, ["barista", "manager"]);
      if ("res" in auth) return auth.res;
      const body = await readBody(req);
      const status = String(body.status ?? "");
      if (status !== "buka" && status !== "tutup") return fail(req, "status_harus_buka_atau_tutup");
      await env.DB.prepare(
        "INSERT INTO pengaturan (kunci, nilai, diubah_pada) VALUES ('warkop_status', ?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
        .bind(status, wibParts(Date.now()).datetime)
        .run();
      return json(req, { ok: true, status });
    }

    // Auth: request OTP
    if (path === "/api/auth/request-otp" && method === "POST") {
      if (!(await checkRateLimit(env, req, "otp_request", 10, 60_000))) return rateLimited(req);
      const body = await readBody(req);
      const email = String(body.email ?? "").toLowerCase().trim();
      const tujuan = body.tujuan === "action" ? "action" : "login";
      const generic = "Jika email terdaftar, kode OTP telah dikirim.";
      const staff = await env.DB.prepare("SELECT id, is_aktif FROM staf WHERE email = ?").bind(email).first<{ id: number; is_aktif: number }>();
      if (!staff || staff.is_aktif !== 1) {
        return json(req, { ok: true, message: generic });
      }
      const code = randomOtp();
      const hash = await sha256Hex(code);
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO otp (staf_id, kode_hash, dibuat_pada, kedaluwarsa_pada, jumlah_percobaan, tujuan) VALUES (?, ?, ?, ?, 0, ?)"
      )
        .bind(staff.id, hash, wibParts(now).datetime, wibParts(now + OTP_TTL_MS).datetime, tujuan)
        .run();
      const res: Record<string, unknown> = { ok: true, message: generic };
      // DEV ONLY: return the code so the frontend can display it until launch.
      // No email sender is wired yet. Remove DEV_MODE at launch.
      if (env.DEV_MODE === "true") res.dev_code = code;
      return json(req, res);
    }

    // Auth: verify OTP (login)
    if (path === "/api/auth/verify-otp" && method === "POST") {
      if (!(await checkRateLimit(env, req, "otp_verify", 10, 60_000))) return rateLimited(req);
      const body = await readBody(req);
      const email = String(body.email ?? "").toLowerCase().trim();
      const code = String(body.code ?? "");
      const staff = await env.DB.prepare("SELECT id, nama, email, peran, is_aktif FROM staf WHERE email = ?")
        .bind(email)
        .first<Staff & { is_aktif: number }>();
      if (!staff || staff.is_aktif !== 1) return fail(req, "verifikasi_gagal", 401);
      const otp = await env.DB.prepare(
        "SELECT id, kode_hash, kedaluwarsa_pada, jumlah_percobaan FROM otp WHERE staf_id = ? AND tujuan = 'login' AND dipakai_pada IS NULL ORDER BY dibuat_pada DESC LIMIT 1"
      )
        .bind(staff.id)
        .first<{ id: number; kode_hash: string; kedaluwarsa_pada: string; jumlah_percobaan: number }>();
      if (!otp) return fail(req, "tidak_ada_kode_otp_aktif", 401);
      if (otp.jumlah_percobaan >= OTP_MAX_ATTEMPTS) return fail(req, "percobaan_habis_minta_kode_baru", 401);
      if (wibToEpoch(otp.kedaluwarsa_pada) < Date.now()) return fail(req, "kode_otp_kedaluwarsa_minta_kode_baru", 401);
      if ((await sha256Hex(code)) !== otp.kode_hash) {
        await env.DB.prepare("UPDATE otp SET jumlah_percobaan = jumlah_percobaan + 1 WHERE id = ?").bind(otp.id).run();
        return fail(req, "kode_otp_salah", 401);
      }
      await env.DB.prepare("UPDATE otp SET dipakai_pada = ? WHERE id = ?").bind(wibParts(Date.now()).datetime, otp.id).run();
      const token = randomHex(32);
      const now = Date.now();
      await env.DB.prepare("INSERT INTO sesi (staf_id, token_hash, dibuat_pada, berakhir_pada) VALUES (?, ?, ?, ?)")
        .bind(staff.id, await sha256Hex(token), wibParts(now).datetime, wibParts(now + SESSION_TTL_MS).datetime)
        .run();
      return json(req, {
        ok: true,
        token,
        staff: { id: staff.id, nama: staff.nama, email: staff.email, peran: staff.peran },
        expires_in_days: 30,
      });
    }

    // Auth: verify fresh OTP for sensitive actions
    if (path === "/api/auth/verify-fresh-otp" && method === "POST") {
      if (!(await checkRateLimit(env, req, "otp_action", 10, 60_000))) return rateLimited(req);
      const auth = await requireStaff(env, req);
      if ("res" in auth) return auth.res;
      const body = await readBody(req);
      const code = String(body.code ?? "");
      const otp = await env.DB.prepare(
        "SELECT id, kode_hash, kedaluwarsa_pada, jumlah_percobaan FROM otp WHERE staf_id = ? AND tujuan = 'action' AND dipakai_pada IS NULL ORDER BY dibuat_pada DESC LIMIT 1"
      )
        .bind(auth.staff.id)
        .first<{ id: number; kode_hash: string; kedaluwarsa_pada: string; jumlah_percobaan: number }>();
      if (!otp) return fail(req, "tidak_ada_kode_otp_aksi_minta_dulu_lewat_request_otp_tujuan_action", 401);
      if (otp.jumlah_percobaan >= OTP_MAX_ATTEMPTS) return fail(req, "percobaan_habis_minta_kode_baru", 401);
      if (wibToEpoch(otp.kedaluwarsa_pada) < Date.now()) return fail(req, "kode_otp_kedaluwarsa_minta_kode_baru", 401);
      if ((await sha256Hex(code)) !== otp.kode_hash) {
        await env.DB.prepare("UPDATE otp SET jumlah_percobaan = jumlah_percobaan + 1 WHERE id = ?").bind(otp.id).run();
        return fail(req, "kode_otp_salah", 401);
      }
      await env.DB.prepare("UPDATE otp SET dipakai_pada = ? WHERE id = ?").bind(wibParts(Date.now()).datetime, otp.id).run();
      const actionToken = randomHex(32);
      const now = Date.now();
      await env.DB.prepare("INSERT INTO token_aksi (staf_id, token_hash, dibuat_pada, kedaluwarsa_pada) VALUES (?, ?, ?, ?)")
        .bind(auth.staff.id, await sha256Hex(actionToken), wibParts(now).datetime, wibParts(now + ACTION_TOKEN_TTL_MS).datetime)
        .run();
      return json(req, { ok: true, action_token: actionToken, expires_in_seconds: ACTION_TOKEN_TTL_MS / 1000 });
    }

    // Auth: logout
    if (path === "/api/auth/logout" && method === "POST") {
      const auth = req.headers.get("Authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (token) {
        await env.DB.prepare("UPDATE sesi SET dicabut_pada = ? WHERE token_hash = ?")
          .bind(wibParts(Date.now()).datetime, await sha256Hex(token))
          .run();
      }
      return json(req, { ok: true });
    }

    // Finance transactions
    if (path === "/api/finance/transactions" && method === "GET") {
      const auth = await requireStaff(env, req, ["finance", "manager"]);
      if ("res" in auth) return auth.res;
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      const jenis = url.searchParams.get("jenis") ?? "";
      const kategori = url.searchParams.get("kategori") ?? "";
      let sql = `SELECT t.*, s.nama AS staf_nama, p.nomor_pesanan FROM transaksi t
        LEFT JOIN staf s ON s.id = t.staf_id LEFT JOIN pesanan p ON p.id = t.pesanan_id WHERE 1 = 1`;
      const binds: unknown[] = [];
      if (from) {
        sql += " AND substr(t.dibuat_pada, 1, 10) >= ?";
        binds.push(from);
      }
      if (to) {
        sql += " AND substr(t.dibuat_pada, 1, 10) <= ?";
        binds.push(to);
      }
      if (jenis) {
        sql += " AND t.jenis = ?";
        binds.push(jenis);
      }
      if (kategori) {
        sql += " AND t.kategori = ?";
        binds.push(kategori);
      }
      sql += " ORDER BY t.dibuat_pada DESC LIMIT 200";
      const rows = await env.DB.prepare(sql).bind(...binds).all();
      return json(req, { ok: true, transactions: rows.results ?? [] });
    }

    if (path === "/api/finance/transactions" && method === "POST") {
      const auth = await requireStaff(env, req, ["finance", "manager"]);
      if ("res" in auth) return auth.res;
      const body = await readBody(req);
      const jenis = String(body.jenis ?? "");
      const jumlah = Number(body.jumlah);
      const metode = String(body.metode ?? "");
      if (!["simpanan", "pembayaran", "penarikan"].includes(jenis)) return fail(req, "jenis_tidak_dikenal");
      if (!Number.isFinite(jumlah) || jumlah <= 0) return fail(req, "jumlah_harus_lebih_dari_0");
      if (!PAY_METHODS.includes(metode)) return fail(req, "metode_bayar_tidak_dikenal");
      const pesananId = body.pesanan_id ? Number(body.pesanan_id) : null;
      if (pesananId) {
        const order = await env.DB.prepare("SELECT id, total, status FROM pesanan WHERE id = ?").bind(pesananId).first<{ id: number; total: number; status: string }>();
        if (!order) return fail(req, "pesanan_tidak_ditemukan", 404);
        if (order.status === "dibatalkan") return fail(req, "pesanan_batal_tidak_bisa_menerima_transaksi_baru");
      }
      const today = wibParts(Date.now()).date.replaceAll("-", "");
      const countRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM transaksi WHERE substr(dibuat_pada, 1, 10) = ?")
        .bind(wibParts(Date.now()).date)
        .first<{ n: number }>();
      const kode = `TRX-${today}-${pad((countRow?.n ?? 0) + 1, 4)}`;
      const ins = await env.DB.prepare(
        `INSERT INTO transaksi (kode, anggota_id, pesanan_id, staf_id, jenis, jumlah, metode, kategori, keterangan, dibuat_pada, diubah_pada)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          kode,
          pesananId,
          auth.staff.id,
          jenis,
          jumlah,
          metode,
          body.kategori ? String(body.kategori) : null,
          body.keterangan ? String(body.keterangan) : null,
          wibParts(Date.now()).datetime,
          wibParts(Date.now()).datetime
        )
        .run();
      const trxId = ins.meta.last_row_id as number;
      if (pesananId && jenis === "pembayaran") {
        const paidRow = await env.DB.prepare(
          "SELECT COALESCE(SUM(jumlah), 0) AS paid FROM transaksi WHERE pesanan_id = ? AND jenis = 'pembayaran'"
        )
          .bind(pesananId)
          .first<{ paid: number }>();
        const order = await env.DB.prepare("SELECT total FROM pesanan WHERE id = ?").bind(pesananId).first<{ total: number }>();
        if (order && (paidRow?.paid ?? 0) >= order.total) {
          await env.DB.prepare("UPDATE pesanan SET status_bayar = 'lunas', dibayar_pada = ?, diubah_pada = ? WHERE id = ?")
            .bind(wibParts(Date.now()).datetime, wibParts(Date.now()).datetime, pesananId)
            .run();
          await mirrorPesanan(env, ctx, pesananId);
        }
      }
      await mirrorTransaksi(env, ctx, trxId);
      return json(req, { ok: true, transaction_id: trxId, kode }, 201);
    }

    // Dashboard stats (manager)
    if (path === "/api/stats" && method === "GET") {
      const auth = await requireStaff(env, req, ["manager"]);
      if ("res" in auth) return auth.res;
      const today = wibParts(Date.now()).date;
      const anggota = await env.DB.prepare("SELECT COUNT(*) AS n FROM anggota WHERE status = 'aktif'").first<{ n: number }>();
      const stok = await env.DB.prepare("SELECT COUNT(*) AS n FROM produk WHERE is_aktif = 1 AND stok <= 5").first<{ n: number }>();
      const hariIni = await env.DB.prepare(
        `SELECT COUNT(*) AS pesanan, COALESCE(SUM(total), 0) AS omzet FROM pesanan WHERE substr(dibuat_pada, 1, 10) = ?`
      ).bind(today).first<{ pesanan: number; omzet: number }>();
      const omzet = await env.DB.prepare(
        `SELECT COUNT(*) AS pesanan, COALESCE(SUM(total), 0) AS omzet FROM pesanan WHERE status = 'selesai' AND substr(dibuat_pada, 1, 10) = ?`
      ).bind(today).first<{ pesanan: number; omzet: number }>();
      return json(req, {
        ok: true,
        anggota_aktif: anggota?.n ?? 0,
        stok_menipis: stok?.n ?? 0,
        pesanan_hari_ini: hariIni?.pesanan ?? 0,
        omzet_hari_ini: omzet?.omzet ?? 0,
        pesanan_selesai_hari_ini: omzet?.pesanan ?? 0,
      });
    }

    // Reports
    if (path === "/api/reports/omzet" && method === "GET") {
      const auth = await requireStaff(env, req, ["finance", "manager"]);
      if ("res" in auth) return auth.res;
      const from = url.searchParams.get("from") ?? wibParts(Date.now() - 6 * 86400000).date;
      const to = url.searchParams.get("to") ?? wibParts(Date.now()).date;
      const daily = await env.DB.prepare(
        `SELECT substr(dibuat_pada, 1, 10) AS tanggal, COUNT(*) AS pesanan, COALESCE(SUM(total), 0) AS omzet
         FROM pesanan WHERE status = 'selesai' AND substr(dibuat_pada, 1, 10) BETWEEN ? AND ?
         GROUP BY tanggal ORDER BY tanggal`
      )
        .bind(from, to)
        .all();
      const totalRow = await env.DB.prepare(
        `SELECT COUNT(*) AS pesanan, COALESCE(SUM(total), 0) AS omzet
         FROM pesanan WHERE status = 'selesai' AND substr(dibuat_pada, 1, 10) BETWEEN ? AND ?`
      )
        .bind(from, to)
        .first<{ pesanan: number; omzet: number }>();
      return json(req, { ok: true, from, to, total: totalRow ?? { pesanan: 0, omzet: 0 }, daily: daily.results ?? [] });
    }

    if (path === "/api/reports/cash" && method === "GET") {
      const auth = await requireStaff(env, req, ["finance", "manager"]);
      if ("res" in auth) return auth.res;
      const from = url.searchParams.get("from") ?? wibParts(Date.now() - 29 * 86400000).date;
      const to = url.searchParams.get("to") ?? wibParts(Date.now()).date;
      const summary = await env.DB.prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN jenis IN ('pembayaran', 'simpanan') THEN jumlah ELSE 0 END), 0) AS masuk,
          COALESCE(SUM(CASE WHEN jenis = 'penarikan' THEN jumlah ELSE 0 END), 0) AS keluar
         FROM transaksi WHERE substr(dibuat_pada, 1, 10) BETWEEN ? AND ?`
      )
        .bind(from, to)
        .first<{ masuk: number; keluar: number }>();
      const perKategori = await env.DB.prepare(
        `SELECT kategori, jenis, COALESCE(SUM(jumlah), 0) AS jumlah
         FROM transaksi WHERE substr(dibuat_pada, 1, 10) BETWEEN ? AND ?
         GROUP BY kategori, jenis ORDER BY jumlah DESC`
      )
        .bind(from, to)
        .all();
      const masuk = summary?.masuk ?? 0;
      const keluar = summary?.keluar ?? 0;
      return json(req, { ok: true, from, to, masuk, keluar, saldo: masuk - keluar, per_kategori: perKategori.results ?? [] });
    }

    // ShopeeFood draft webhook
    if (path === "/api/shopeefood/draft" && method === "POST") {
      const secret = req.headers.get("X-Forwarder-Secret") ?? "";
      if (!env.FORWARDER_SECRET || secret !== env.FORWARDER_SECRET) {
        return fail(req, "forwarder_secret_tidak_valid", 401);
      }
      const body = await readBody(req);
      const text = String(body.text ?? body.notification_text ?? "");
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const items: OrderItemInput[] = [];
      const unmatched: string[] = [];
      for (const raw of rawItems as { name?: string; nama?: string; qty?: number; jumlah?: number }[]) {
        const name = String(raw.name ?? raw.nama ?? "").trim();
        const qty = Number(raw.qty ?? raw.jumlah ?? 1);
        if (!name) continue;
        const p = await env.DB.prepare("SELECT id FROM produk WHERE lower(nama) LIKE ? AND is_aktif = 1")
          .bind(`%${name.toLowerCase()}%`)
          .first<{ id: number }>();
        if (p) items.push({ product_id: p.id, qty });
        else unmatched.push(`${name} x${qty}`);
      }
      const customer = String(body.customer_name ?? body.nama_pelanggan ?? "ShopeeFood").trim() || "ShopeeFood";
      const catatanParts = ["Draft ShopeeFood, cek item dulu."];
      if (text) catatanParts.push(`Notifikasi: ${text}`);
      if (unmatched.length) catatanParts.push(`Tidak cocok: ${unmatched.join(", ")}`);
      if (items.length) {
        return createOrder(env, req, ctx, {
          nama: customer,
          wa: "",
          items,
          metode: "qris",
          catatan: catatanParts.join(" "),
          sumber: "shopeefood",
          isDraft: true,
          rawText: text || undefined,
          allowEmptyWa: true,
        });
      }
      const nomor = await nextOrderNumber(env);
      const now = wibParts(Date.now()).datetime;
      const ins = await env.DB.prepare(
        `INSERT INTO pesanan (nomor_pesanan, anggota_id, nama_pelanggan, no_wa_pelanggan, status, total, catatan, dibuat_pada, diubah_pada, sumber_pesanan, is_draft, metode_bayar, status_bayar, raw_text)
         VALUES (?, NULL, ?, '', 'baru', ?, ?, ?, ?, 'shopeefood', 1, 'qris', 'belum', ?)`
      )
        .bind(nomor, customer, Number(body.total ?? 0), catatanParts.join(" "), now, now, text || null)
        .run();
      const draftOrder = {
        id: ins.meta.last_row_id,
        nomor_pesanan: nomor,
        nama_pelanggan: customer,
        no_wa_pelanggan: "",
        status: "baru",
        total: Number(body.total ?? 0),
        catatan: catatanParts.join(" "),
        sumber_pesanan: "shopeefood",
        is_draft: 1,
        metode_bayar: "qris",
        dibuat_pada: now,
      };
      await mirrorOrder(env, ctx, draftOrder.id as number);
      return json(
        req,
        {
          ok: true,
          draft: true,
          order: draftOrder,
          warning: "tidak_ada_item_yang_cocok_barista_harus_cek_manual",
        },
        201
      );
    }

    // Telegram webhook
    if (path === "/api/telegram/webhook" && method === "POST") {
      const body = await readBody(req);
      const result = await handleTelegramUpdate(env, body);
      if (!result.ok) {
        return json(req, { ok: false, error: "telegram_not_configured", message: "TELEGRAM_BOT_TOKEN belum diset. Set secret dulu, lalu set webhook Telegram ke URL ini." }, 503);
      }
      if (result.staffId) await mirrorStaf(env, ctx, result.staffId);
      return json(req, { ok: true });
    }

    // Sheet mirror (staff only, never blocks orders). The Apps Script
    // doPost cannot read request headers, so the secret travels in the
    // JSON body, not in an X-Mirror-Secret header. Rows are objects keyed
    // by header name and are upserted by their ID column.
    if (path === "/api/mirror" && method === "POST") {
      const auth = await requireStaff(env, req, ["finance", "manager"]);
      if ("res" in auth) return auth.res;
      if (!env.GAS_MIRROR_URL || !env.GAS_MIRROR_SECRET) {
        return json(req, { ok: false, error: "gas_mirror_not_configured", message: "GAS_MIRROR_URL atau GAS_MIRROR_SECRET belum diset." });
      }
      const body = await readBody(req);
      const tab = String(body.tab ?? "") as SyncTab;
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!tab || !SYNC_TABS.includes(tab) || !rows.length) {
        return json(req, { ok: false, error: "mirror_butuh_tab_dan_rows" });
      }
      if (rows.length && typeof rows[0] === "object" && rows[0] !== null && !Array.isArray(rows[0])) {
        const res = await upsertToSheet(env, tab, rows as Record<string, unknown>[]);
        if (!res) return json(req, { ok: false, error: "mirror_gagal" });
        return json(req, { ok: true, tab, updated: res.updated, inserted: res.inserted, skipped: res.skipped });
      }
      try {
        const res = await fetch(env.GAS_MIRROR_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret: env.GAS_MIRROR_SECRET, tab, rows }),
        });
        const text = await res.text();
        return json(req, { ok: res.ok, status: res.status, response: text.slice(0, 500) });
      } catch (e) {
        return json(req, { ok: false, error: "mirror_gagal", message: String(e) });
      }
    }

    // Sheet -> Worker sync. Called by the GAS onEdit trigger. Auth is the
    // shared SHEET_SYNC_SECRET, sent as X-Sheet-Sync-Secret (GAS can send
    // headers, unlike doPost which cannot read them).
    if (path === "/api/sheet-sync" && method === "POST") {
      const headerSecret = req.headers.get("X-Sheet-Sync-Secret") ?? "";
      const body = await readBody(req);
      const bodySecret = String(body.secret ?? "");
      if (!env.SHEET_SYNC_SECRET || (headerSecret !== env.SHEET_SYNC_SECRET && bodySecret !== env.SHEET_SYNC_SECRET)) {
        return fail(req, "sheet_sync_secret_tidak_valid", 401);
      }
      const tab = String(body.tab ?? "") as SyncTab;
      if (!SYNC_TABS.includes(tab)) return fail(req, "tab_tidak_dikenal");
      const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
      const rowNums = Array.isArray(body.rowNums) ? (body.rowNums as (number | null)[]) : [];
      let applied = 0;
      let skipped = 0;
      const errors: { key: string; detail: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rows[i])) {
          if (!k.startsWith("_")) clean[k] = v;
        }
        const res = await applySheetRow(env, tab, clean, typeof rowNums[i] === "number" ? rowNums[i] : null);
        if (res.result === "applied") {
          applied++;
          if (res.mirror) {
            const sheetRow = await sheetRowById(env, res.mirror.tab, res.mirror.id);
            if (sheetRow) await mirrorUpsert(env, ctx, res.mirror.tab, [sheetRow], [res.mirror.rowNum]);
          }
        } else if (res.result === "error") {
          skipped++;
          errors.push({ key: res.key, detail: res.detail });
        } else {
          skipped++;
        }
      }
      return json(req, { ok: true, tab, applied, skipped, errors });
    }

    // Manual + scheduled reconciliation. Compares D1 and the Sheet by ID and
    // diubah_pada, fixes drift in both directions, logs a summary per tab.
    if (path === "/api/sync/reconcile" && method === "POST") {
      const auth = await requireStaff(env, req, ["manager"]);
      if ("res" in auth) return auth.res;
      const res = await reconcileAll(env, ctx);
      if (!res.ok) return json(req, { ok: false, error: res.error }, 503);
      return json(req, { ok: true, summary: res.summary });
    }

    // Sync log (staff only): recent sync events and conflicts.
    if (path === "/api/sync/log" && method === "GET") {
      const auth = await requireStaff(env, req, ["manager", "finance"]);
      if ("res" in auth) return auth.res;
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1), 200);
      const rows = await env.DB.prepare("SELECT * FROM sync_log ORDER BY id DESC LIMIT ?").bind(limit).all();
      return json(req, { ok: true, log: rows.results ?? [] });
    }

    return fail(req, "route_tidak_dikenal", 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      await reconcileAll(env, ctx);
    } catch {
      // Reconcile is best effort; a failed run is retried on the next tick.
    }
  },
};
