import { clearSession, getSession, saveSession } from './auth-session';
import type { Session } from './auth-session';
import type { Order, OrderStatus, Product } from './dummy';
import { appBase } from './app-base';

export const API_BASE = 'https://koperasi-mbg-api.zakyshadra.workers.dev';
export const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1YLyLFdnuJ9P8rVuXAGMceX8C7SUCXesScCdxTu1Mu6k/edit';
export const LOGO_URL = `${import.meta.env.BASE_URL}images/logo-placeholder.jpg`;

export class ApiError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const ERROR_TEXT: Record<string, string> = {
  nama_wajib_diisi: 'Nama wajib diisi.',
  no_wa_wajib_diisi: 'Nomor WA wajib diisi.',
  metode_bayar_tidak_dikenal: 'Metode bayar tidak dikenal.',
  pesanan_tanpa_item_tidak_valid: 'Pesanan tanpa item tidak bisa dikirim.',
  qty_harus_lebih_dari_0: 'Jumlah harus lebih dari 0.',
  pesanan_tidak_ditemukan: 'Pesanan tidak ditemukan.',
  kode_otp_salah: 'Kode salah, coba lagi.',
  kode_otp_kedaluwarsa_minta_kode_baru: 'Kode sudah kedaluwarsa, minta kode baru.',
  percobaan_habis_minta_kode_baru: 'Percobaan habis, minta kode baru.',
  tidak_ada_kode_otp_aktif: 'Belum ada kode aktif, minta kode dulu.',
  verifikasi_gagal: 'Verifikasi gagal, cek email dan kode.',
  belum_lunas_pesanan_tidak_bisa_ditandai_selesai:
    'Pesanan belum lunas, tidak bisa ditandai selesai.',
  draft_lewat_batas_3_menit_otomatis_batal:
    'Draft sudah lewat 3 menit dan otomatis batal.',
  draft_harus_dikonfirmasi_dulu: 'Draft harus dikonfirmasi dulu.',
  pesanan_sudah_final_tidak_bisa_diubah: 'Pesanan sudah final dan tidak bisa diubah.',
  stok_kosong_produk_tidak_bisa_ditandai_tersedia:
    'Stok kosong, produk tidak bisa ditandai tersedia.',
  harga_harus_lebih_dari_0: 'Harga harus lebih dari 0.',
  butuh_otp_baru_untuk_ubah_harga: 'Ubah harga butuh kode OTP baru.',
  jumlah_harus_lebih_dari_0: 'Jumlah harus lebih dari 0.',
  jenis_tidak_dikenal: 'Jenis transaksi tidak dikenal.',
  gas_mirror_not_configured: 'Mirror Sheet belum disetel.',
  mirror_butuh_tab_dan_rows: 'Mirror butuh tab dan baris.',
  mirror_gagal: 'Gagal menulis ke Sheet, coba lagi.',
  unauthorized: 'Sesi habis, masuk lagi.',
  route_tidak_dikenal: 'Alamat API tidak dikenal.',
};

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code.startsWith('stok_tidak_cukup:')) {
      return `Stok tidak cukup: ${e.code.slice('stok_tidak_cukup:'.length)}.`;
    }
    if (e.code.startsWith('produk_tidak_ditemukan:')) {
      return 'Salah satu produk tidak ditemukan, muat ulang katalog.';
    }
    if (e.code.startsWith('status_hanya_bisa_maju_satu_langkah')) {
      return 'Status hanya bisa maju satu langkah.';
    }
    return ERROR_TEXT[e.code] ?? e.message ?? 'Terjadi kesalahan, coba lagi.';
  }
  return 'Tidak bisa terhubung ke server, cek koneksi lalu coba lagi.';
}

const AUTH_PATHS = [
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
  '/api/auth/verify-fresh-otp',
  '/api/auth/logout',
];

function isAuthPath(path: string): boolean {
  return AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}?`));
}

async function apiFetch<T>(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = getSession()?.token ?? null;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts?.method ?? 'GET',
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    message?: string;
  } | null;
  if (!res.ok || !data || data.ok === false) {
    if (data?.error === 'unauthorized' && !isAuthPath(path)) {
      clearSession();
      const loginPath = `${appBase()}/kprmbg20asdf`;
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    throw new ApiError(data?.error ?? `http_${res.status}`, data?.message);
  }
  return data as T;
}

export interface ApiProduct {
  id: number;
  kode_produk: string;
  nama: string;
  harga: number;
  stok: number;
  satuan: string;
  deskripsi: string | null;
  gambar: string | null;
  tersedia: number;
  is_aktif: number;
  kategori: string;
}

export interface ApiOrderItem {
  produk_nama: string;
  qty: number;
  harga_saat_beli: number;
  subtotal: number;
  produk_id?: number;
}

export type ApiOrderStatus = 'baru' | 'disiapkan' | 'siap' | 'selesai' | 'dibatalkan';

export interface ApiOrder {
  id: number;
  nomor_pesanan: string;
  nama_pelanggan: string;
  no_wa_pelanggan?: string;
  status: ApiOrderStatus;
  total: number;
  catatan: string | null;
  dibuat_pada: string;
  sumber_pesanan: 'web' | 'shopeefood' | 'walk-in';
  is_draft: number;
  metode_bayar: 'tunai' | 'transfer' | 'qris';
  status_bayar: 'belum' | 'lunas';
  items?: ApiOrderItem[];
}

export interface ApiTransaction {
  id: number;
  kode: string;
  jenis: 'simpanan' | 'pembayaran' | 'penarikan';
  jumlah: number;
  metode: string;
  kategori: string | null;
  keterangan: string | null;
  dibuat_pada: string;
  staf_nama: string | null;
  nomor_pesanan: string | null;
}

export function wibToMs(wib: string): number {
  const ms = new Date(`${wib.replace(' ', 'T')}+07:00`).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

export function mapProduct(p: ApiProduct): Product {
  return {
    id: String(p.id),
    apiId: p.id,
    name: p.nama,
    price: p.harga,
    stock: p.stok,
    initial: p.nama.charAt(0).toUpperCase(),
    category: p.kategori === 'Warkop' ? 'warkop' : 'koperasi',
    image: p.gambar
      ? `${import.meta.env.BASE_URL}${p.gambar.replace(/^\//, '')}`
      : undefined,
    available: p.tersedia === 1,
  };
}

const STATUS_LABEL: Record<ApiOrderStatus, OrderStatus> = {
  baru: 'Baru',
  disiapkan: 'Disiapkan',
  siap: 'Siap',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

export function mapApiOrder(o: ApiOrder): Order {
  const items = (o.items ?? [])
    .map((it) => (it.qty > 1 ? `${it.produk_nama} x${it.qty}` : it.produk_nama))
    .join(', ');
  return {
    id: o.nomor_pesanan,
    apiId: o.id,
    time: o.dibuat_pada.slice(11, 16).replace(':', '.'),
    customer: o.nama_pelanggan,
    items,
    total: o.total,
    source: o.sumber_pesanan === 'shopeefood' ? 'ShopeeFood' : 'Web',
    status: STATUS_LABEL[o.status],
    draft: o.is_draft === 1,
    waitingMinutes: Math.max(
      0,
      Math.floor((Date.now() - wibToMs(o.dibuat_pada)) / 60000),
    ),
    statusBayar: o.status_bayar,
    metodeBayar: o.metode_bayar,
  };
}

let catalogCache: { at: number; products: ApiProduct[] } | null = null;

export async function getCatalog(): Promise<ApiProduct[]> {
  if (catalogCache && Date.now() - catalogCache.at < 60000) {
    return catalogCache.products;
  }
  const res = await apiFetch<{ ok: boolean; products: ApiProduct[] }>('/api/catalog');
  catalogCache = { at: Date.now(), products: res.products };
  return res.products;
}

export function invalidateCatalog(): void {
  catalogCache = null;
}

export async function createOrder(input: {
  nama: string;
  no_wa: string;
  items: { product_id: number; qty: number }[];
  metode_bayar: string;
  catatan?: string;
}): Promise<{ order: ApiOrder; qris_payload?: string; qris_dummy?: boolean }> {
  return apiFetch('/api/orders', { method: 'POST', body: input });
}

export async function createWalkIn(items: { product_id: number; qty: number }[]): Promise<{
  order: ApiOrder;
}> {
  return apiFetch('/api/orders/walk-in', {
    method: 'POST',
    body: { nama: 'Walk-in', no_wa: '', items, metode_bayar: 'tunai' },
  });
}

export async function getOrder(number: string): Promise<{
  order: ApiOrder;
  items: ApiOrderItem[];
}> {
  return apiFetch(`/api/orders/${encodeURIComponent(number)}`);
}

export async function getOrderQris(number: string): Promise<{
  order_number: string;
  amount: number;
  status: string;
  qris_payload: string;
  qris_dummy: boolean;
  note?: string;
}> {
  return apiFetch(`/api/orders/${encodeURIComponent(number)}/qris`);
}

export async function payDummy(number: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/orders/${encodeURIComponent(number)}/pay-dummy`, {
    method: 'POST',
  });
}

export async function getWarkopStatus(): Promise<'buka' | 'tutup'> {
  const res = await apiFetch<{ ok: boolean; status: 'buka' | 'tutup' }>('/api/warkop/status');
  return res.status;
}

export async function setWarkopStatus(status: 'buka' | 'tutup'): Promise<'buka' | 'tutup'> {
  const res = await apiFetch<{ ok: boolean; status: 'buka' | 'tutup' }>('/api/warkop/status', {
    method: 'POST',
    body: { status },
  });
  return res.status;
}

type StaffRole = 'manager' | 'finance' | 'barista';

export async function requestOtp(
  email: string,
  tujuan: 'login' | 'action' = 'login',
): Promise<{ ok: boolean; message: string; devCode?: string }> {
  try {
    const res = await apiFetch<{ ok: boolean; message: string; dev_code?: string }>(
      '/api/auth/request-otp',
      { method: 'POST', body: { email, tujuan } },
    );
    return { ok: true, message: res.message, devCode: res.dev_code };
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ ok: boolean; message: string; session?: Session }> {
  try {
    const res = await apiFetch<{
      ok: boolean;
      token: string;
      staff: { id: number; nama: string; email: string; peran: StaffRole };
      expires_in_days: number;
    }>('/api/auth/verify-otp', { method: 'POST', body: { email, code } });
    const session: Session = {
      email: res.staff.email,
      role: res.staff.peran,
      token: res.token,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    saveSession(session);
    return { ok: true, message: 'Berhasil masuk', session };
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
}

export async function verifyFreshOtp(code: string): Promise<{ action_token: string }> {
  return apiFetch('/api/auth/verify-fresh-otp', { method: 'POST', body: { code } });
}

export async function logoutApi(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Sesi lokal tetap dihapus walau server tidak terjangkau.
  }
}

export async function getQueue(): Promise<ApiOrder[]> {
  const res = await apiFetch<{ ok: boolean; orders: ApiOrder[] }>('/api/barista/queue');
  return res.orders;
}

export async function setOrderStatus(
  id: number,
  status: string,
  extra?: { tunai_diterima?: boolean },
): Promise<{ ok: boolean; status: string }> {
  return apiFetch(`/api/orders/${id}/status`, {
    method: 'POST',
    body: { status, ...extra },
  });
}

export async function setProductAvailability(id: number, tersedia: 0 | 1): Promise<void> {
  await apiFetch(`/api/products/${id}/availability`, {
    method: 'POST',
    body: { tersedia },
  });
}

export async function setProductPrice(
  id: number,
  harga: number,
  actionToken: string,
): Promise<void> {
  await apiFetch(`/api/products/${id}/price`, {
    method: 'POST',
    body: { harga, action_token: actionToken },
  });
}

export async function getOrders(status?: string, limit = 50): Promise<ApiOrder[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set('status', status);
  const res = await apiFetch<{ ok: boolean; orders: ApiOrder[] }>(
    `/api/orders?${params.toString()}`,
  );
  return res.orders;
}

export async function getStats(): Promise<{
  anggota_aktif: number;
  stok_menipis: number;
  pesanan_hari_ini: number;
  omzet_hari_ini: number;
  pesanan_selesai_hari_ini: number;
}> {
  return apiFetch('/api/stats');
}

export async function getTransactions(params?: {
  from?: string;
  to?: string;
  jenis?: string;
  kategori?: string;
}): Promise<ApiTransaction[]> {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.jenis) query.set('jenis', params.jenis);
  if (params?.kategori) query.set('kategori', params.kategori);
  const suffix = query.toString();
  const res = await apiFetch<{ ok: boolean; transactions: ApiTransaction[] }>(
    `/api/finance/transactions${suffix ? `?${suffix}` : ''}`,
  );
  return res.transactions;
}

export async function createTransaction(input: {
  jenis: string;
  jumlah: number;
  metode: string;
  kategori?: string;
  keterangan?: string;
  pesanan_id?: number | null;
}): Promise<{ transaction_id: number; kode: string }> {
  return apiFetch('/api/finance/transactions', { method: 'POST', body: input });
}

export async function getOmzetReport(
  from: string,
  to: string,
): Promise<{
  from: string;
  to: string;
  total: { pesanan: number; omzet: number };
  daily: { tanggal: string; pesanan: number; omzet: number }[];
}> {
  return apiFetch(`/api/reports/omzet?from=${from}&to=${to}`);
}

export async function getCashReport(
  from: string,
  to: string,
): Promise<{
  from: string;
  to: string;
  masuk: number;
  keluar: number;
  saldo: number;
  per_kategori: { kategori: string | null; jenis: string; jumlah: number }[];
}> {
  return apiFetch(`/api/reports/cash?from=${from}&to=${to}`);
}

export async function mirrorToSheet(
  tab: string,
  rows: unknown[][],
): Promise<{ ok: boolean; status?: number; response?: string }> {
  return apiFetch('/api/mirror', { method: 'POST', body: { tab, rows } });
}
