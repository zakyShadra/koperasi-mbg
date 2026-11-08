-- Koperasi MBG, D1 schema.
-- Source: dokumen 06-skema-database.md (11 tables) plus 2 additions decided at
-- build time: pengaturan (key-value, warkop status) and token_aksi (short-lived
-- action tokens for sensitive actions). Additions are marked ADD.
-- Deliberate deviations from the doc, see README.md:
-- - pesanan.status uses baru/disiapkan/siap/selesai/dibatalkan (frozen decision).
-- - laporan.staf_id is nullable with ON DELETE SET NULL (doc conflict resolved).
-- - transaksi.anggota_id is nullable and transaksi has staf_id + kategori
--   (doc flags both as missing).
-- - otp has jumlah_percobaan and tujuan (login/action).
-- - pesanan has sumber_pesanan, is_draft, metode_bayar, status_bayar,
--   dibayar_pada, raw_text. produk has gambar and tersedia.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS kategori (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL UNIQUE,
  deskripsi TEXT
);

CREATE TABLE IF NOT EXISTS anggota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  no_wa TEXT NOT NULL UNIQUE,
  email TEXT,
  alamat_jalan TEXT,
  kota TEXT,
  kode_pos TEXT,
  tanggal_gabung TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif'))
);

CREATE TABLE IF NOT EXISTS staf (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  no_wa TEXT,
  peran TEXT NOT NULL CHECK (peran IN ('manager', 'finance', 'barista')),
  is_aktif INTEGER NOT NULL DEFAULT 1 CHECK (is_aktif IN (0, 1))
);

CREATE TABLE IF NOT EXISTS produk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kategori_id INTEGER NOT NULL REFERENCES kategori(id) ON DELETE RESTRICT,
  kode_produk TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  harga INTEGER NOT NULL CHECK (harga > 0),
  stok INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  satuan TEXT NOT NULL DEFAULT 'pcs',
  deskripsi TEXT,
  gambar TEXT,
  tersedia INTEGER NOT NULL DEFAULT 1 CHECK (tersedia IN (0, 1)),
  is_aktif INTEGER NOT NULL DEFAULT 1 CHECK (is_aktif IN (0, 1))
);

CREATE TABLE IF NOT EXISTS pesanan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_pesanan TEXT NOT NULL UNIQUE,
  anggota_id INTEGER REFERENCES anggota(id) ON DELETE RESTRICT,
  nama_pelanggan TEXT NOT NULL,
  no_wa_pelanggan TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'baru'
    CHECK (status IN ('baru', 'disiapkan', 'siap', 'selesai', 'dibatalkan')),
  total INTEGER NOT NULL DEFAULT 0,
  catatan TEXT,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  sumber_pesanan TEXT NOT NULL DEFAULT 'web'
    CHECK (sumber_pesanan IN ('web', 'shopeefood', 'walk-in')),
  is_draft INTEGER NOT NULL DEFAULT 0 CHECK (is_draft IN (0, 1)),
  metode_bayar TEXT NOT NULL DEFAULT 'tunai'
    CHECK (metode_bayar IN ('tunai', 'transfer', 'qris')),
  status_bayar TEXT NOT NULL DEFAULT 'belum' CHECK (status_bayar IN ('belum', 'lunas')),
  dibayar_pada TEXT,
  raw_text TEXT
);

CREATE TABLE IF NOT EXISTS pesanan_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pesanan_id INTEGER NOT NULL REFERENCES pesanan(id) ON DELETE CASCADE,
  produk_id INTEGER NOT NULL REFERENCES produk(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  harga_saat_beli INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  UNIQUE (pesanan_id, produk_id)
);

CREATE TABLE IF NOT EXISTS transaksi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE,
  anggota_id INTEGER REFERENCES anggota(id) ON DELETE RESTRICT,
  pesanan_id INTEGER REFERENCES pesanan(id) ON DELETE SET NULL,
  staf_id INTEGER REFERENCES staf(id) ON DELETE SET NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('simpanan', 'pembayaran', 'penarikan')),
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  metode TEXT NOT NULL CHECK (metode IN ('tunai', 'transfer', 'qris')),
  kategori TEXT,
  keterangan TEXT,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staf_id INTEGER NOT NULL REFERENCES staf(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  berakhir_pada TEXT NOT NULL CHECK (berakhir_pada > dibuat_pada),
  dicabut_pada TEXT
);

CREATE TABLE IF NOT EXISTS otp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staf_id INTEGER NOT NULL REFERENCES staf(id) ON DELETE CASCADE,
  kode_hash TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  kedaluwarsa_pada TEXT NOT NULL CHECK (kedaluwarsa_pada > dibuat_pada),
  dipakai_pada TEXT,
  jumlah_percobaan INTEGER NOT NULL DEFAULT 0,
  tujuan TEXT NOT NULL DEFAULT 'login' CHECK (tujuan IN ('login', 'action'))
);

CREATE TABLE IF NOT EXISTS token_aksi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staf_id INTEGER NOT NULL REFERENCES staf(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  kedaluwarsa_pada TEXT NOT NULL CHECK (kedaluwarsa_pada > dibuat_pada),
  dipakai_pada TEXT
);

CREATE TABLE IF NOT EXISTS notifikasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anggota_id INTEGER REFERENCES anggota(id) ON DELETE SET NULL,
  staf_id INTEGER REFERENCES staf(id) ON DELETE SET NULL,
  pesanan_id INTEGER REFERENCES pesanan(id) ON DELETE SET NULL,
  isi TEXT NOT NULL,
  sudah_dibaca INTEGER NOT NULL DEFAULT 0 CHECK (sudah_dibaca IN (0, 1)),
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((anggota_id IS NULL) <> (staf_id IS NULL))
);

CREATE TABLE IF NOT EXISTS laporan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staf_id INTEGER REFERENCES staf(id) ON DELETE SET NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('harian', 'mingguan', 'bulanan')),
  periode_mulai TEXT NOT NULL,
  periode_selesai TEXT NOT NULL CHECK (periode_selesai >= periode_mulai),
  ringkasan TEXT,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL,
  diubah_pada TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pesanan_status ON pesanan(status);
CREATE INDEX IF NOT EXISTS idx_pesanan_tanggal ON pesanan(substr(dibuat_pada, 1, 10));
CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON transaksi(substr(dibuat_pada, 1, 10));
CREATE INDEX IF NOT EXISTS idx_sesi_token ON sesi(token_hash);
CREATE INDEX IF NOT EXISTS idx_otp_staf ON otp(staf_id, dibuat_pada);
