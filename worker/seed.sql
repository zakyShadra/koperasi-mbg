-- Seed data for Koperasi MBG. Dummy catalog matches MBG/src/lib/dummy.ts
-- (names, prices, stock). Image files arrive separately in MBG/public/images/;
-- paths below use /images/<slug>.jpg so the photo agent only has to drop the
-- files in place with these exact filenames.

INSERT OR IGNORE INTO kategori (id, nama, deskripsi) VALUES
  (1, 'Barang Koperasi', 'Sembako dan kebutuhan anggota'),
  (2, 'Warkop', 'Menu warkop');

INSERT OR IGNORE INTO staf (id, kode, nama, email, peran, is_aktif) VALUES
  (1, 'STF-001', 'Manager Koperasi', 'manager@mbg.com', 'manager', 1),
  (2, 'STF-002', 'Finance Koperasi', 'finance@mbg.com', 'finance', 1),
  (3, 'STF-003', 'Barista Warkop', 'barista@mbg.com', 'barista', 1);

INSERT OR IGNORE INTO pengaturan (kunci, nilai) VALUES ('warkop_status', 'buka');

INSERT OR IGNORE INTO produk (id, kategori_id, kode_produk, nama, harga, stok, satuan, gambar, tersedia, is_aktif) VALUES
  (1, 1, 'BRG-001', 'Beras 5kg', 62000, 42, 'pcs', '/images/beras-5kg.jpg', 1, 1),
  (2, 1, 'BRG-002', 'Minyak Goreng 2L', 38000, 35, 'pcs', '/images/minyak-goreng-2l.jpg', 1, 1),
  (3, 1, 'BRG-003', 'Gula Pasir 1kg', 17500, 58, 'pcs', '/images/gula-pasir-1kg.jpg', 1, 1),
  (4, 1, 'BRG-004', 'Telur Ayam 1kg', 28000, 24, 'pcs', '/images/telur-ayam-1kg.jpg', 1, 1),
  (5, 1, 'BRG-005', 'Mie Instan', 3500, 120, 'pcs', '/images/mie-instan.jpg', 1, 1),
  (6, 1, 'BRG-006', 'Sabun Cuci', 12000, 33, 'pcs', '/images/sabun-cuci.jpg', 1, 1),
  (7, 1, 'BRG-007', 'Kopi Bubuk 250g', 24000, 18, 'pcs', '/images/kopi-bubuk-250g.jpg', 1, 1),
  (8, 1, 'BRG-008', 'Teh Celup', 8500, 47, 'pcs', '/images/teh-celup.jpg', 1, 1),
  (9, 2, 'WRK-001', 'Kopi Tubruk', 8000, 20, 'gelas', '/images/kopi-tubruk.jpg', 1, 1),
  (10, 2, 'WRK-002', 'Kopi Susu Gula Aren', 12000, 15, 'gelas', '/images/kopi-susu-gula-aren.jpg', 1, 1),
  (11, 2, 'WRK-003', 'Es Teh Manis', 5000, 30, 'gelas', '/images/es-teh-manis.jpg', 1, 1),
  (12, 2, 'WRK-004', 'Indomie Telur', 13000, 0, 'porsi', '/images/indomie-telur.jpg', 0, 1),
  (13, 2, 'WRK-005', 'Gorengan', 2000, 40, 'pcs', '/images/gorengan.jpg', 1, 1),
  (14, 2, 'WRK-006', 'Nasi Kuning', 10000, 12, 'porsi', '/images/nasi-kuning.jpg', 1, 1),
  (15, 2, 'WRK-007', 'Pisang Goreng', 8000, 9, 'pcs', '/images/pisang-goreng.jpg', 1, 1),
  (16, 2, 'WRK-008', 'Es Kopi Susu', 15000, 14, 'gelas', '/images/es-kopi-susu.jpg', 1, 1);
