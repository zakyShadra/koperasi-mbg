-- Koperasi MBG, sinkron dua arah Sheet <-> D1.
-- Menambah kolom diubah_pada ke 8 tabel yang disinkronkan dan tabel sync_log
-- untuk mencatat setiap kejadian sinkron dan konflik. Aman diulang
-- (IF NOT EXISTS, backfill hanya untuk baris yang masih NULL).
-- Stempel waktu memakai WIB "YYYY-MM-DD HH:mm:ss", sama seperti dibuat_pada
-- yang ditulis Worker. datetime('now','+7 hours') = jam WIB saat migrasi jalan.

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arah TEXT NOT NULL CHECK (arah IN ('worker_ke_sheet', 'sheet_ke_worker', 'reconcile')),
  tab TEXT NOT NULL,
  kunci TEXT NOT NULL,
  aksi TEXT NOT NULL CHECK (aksi IN ('upsert', 'lewat_konflik', 'error', 'lewat_contoh')),
  detail TEXT,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_tab ON sync_log(tab, dibuat_pada);

ALTER TABLE anggota ADD COLUMN diubah_pada TEXT;
ALTER TABLE kategori ADD COLUMN diubah_pada TEXT;
ALTER TABLE produk ADD COLUMN diubah_pada TEXT;
ALTER TABLE pesanan ADD COLUMN diubah_pada TEXT;
ALTER TABLE pesanan_item ADD COLUMN diubah_pada TEXT;
ALTER TABLE transaksi ADD COLUMN diubah_pada TEXT;
ALTER TABLE staf ADD COLUMN diubah_pada TEXT;
ALTER TABLE laporan ADD COLUMN diubah_pada TEXT;

UPDATE anggota SET diubah_pada = tanggal_gabung || ' 00:00:00' WHERE diubah_pada IS NULL;
UPDATE kategori SET diubah_pada = datetime('now', '+7 hours') WHERE diubah_pada IS NULL;
UPDATE produk SET diubah_pada = datetime('now', '+7 hours') WHERE diubah_pada IS NULL;
UPDATE pesanan SET diubah_pada = dibuat_pada WHERE diubah_pada IS NULL;
UPDATE pesanan_item SET diubah_pada = COALESCE(
  (SELECT dibuat_pada FROM pesanan WHERE pesanan.id = pesanan_item.pesanan_id),
  datetime('now', '+7 hours')) WHERE diubah_pada IS NULL;
UPDATE transaksi SET diubah_pada = dibuat_pada WHERE diubah_pada IS NULL;
UPDATE staf SET diubah_pada = datetime('now', '+7 hours') WHERE diubah_pada IS NULL;
UPDATE laporan SET diubah_pada = dibuat_pada WHERE diubah_pada IS NULL;
