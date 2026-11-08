# Foto katalog Koperasi MBG - MAPPING

Semua foto di folder ini adalah PLACEHOLDER sementara (foto stok gratis dari
Pexels, bukan foto produk asli koperasi/warkop). Foto asli bisa menggantikan
foto ini kapan saja dengan cara menimpa (overwrite) file yang sama, tanpa
mengubah kode.

## Koperasi (productsKoperasi di src/lib/dummy.ts)

| Produk | File | Sumber |
| --- | --- | --- |
| Beras 5kg (k1) | beras-5kg.jpg | Pexels, photo 31555433 |
| Minyak Goreng 2L (k2) | minyak-goreng-2l.jpg | Pexels, photo 4910159 |
| Gula Pasir 1kg (k3) | gula-pasir-1kg.jpg | Pexels, photo 7599054 |
| Telur Ayam 1kg (k4) | telur-ayam-1kg.jpg | Pexels, photo 31679608 |
| Mie Instan (k5) | mie-instan.jpg | Pexels, photo 31810760 |
| Sabun Cuci (k6) | sabun-cuci.jpg | Pexels, photo 5218018 |
| Kopi Bubuk 250g (k7) | kopi-bubuk-250g.jpg | Pexels, photo 4302262 |
| Teh Celup (k8) | teh-celup.jpg | Pexels, photo 5946762 |

## Warkop (productsWarkop di src/lib/dummy.ts)

| Produk | File | Sumber |
| --- | --- | --- |
| Kopi Tubruk (w1) | kopi-tubruk.jpg | Pexels, photo 13959547 |
| Kopi Susu Gula Aren (w2) | kopi-susu-gula-aren.jpg | Pexels, photo 17497894 |
| Es Teh Manis (w3) | es-teh-manis.jpg | Pexels, photo 34717262 |
| Indomie Telur (w4) | indomie-telur.jpg | Pexels, photo 34403576 |
| Gorengan (w5) | gorengan.jpg | Pexels, photo 37339503 |
| Nasi Kuning (w6) | nasi-kuning.jpg | Pexels, photo 37113558 |
| Pisang Goreng (w7) | pisang-goreng.jpg | Pexels, photo 37048406 |
| Es Kopi Susu (w8) | es-kopi-susu.jpg | Pexels, photo 8271020 |

## Logo

| Keperluan | File | Sumber |
| --- | --- | --- |
| Logo resmi | logo-koperasi.png | Lambang Koperasi Indonesia (dikirim Zaky, background dibuat transparan) |
| Logo sementara (tidak dipakai lagi) | logo-placeholder.jpg | Pexels, photo 29527493 (foto cangkir biji kopi) |

Logo dipakai di sidebar staff, top bar pelanggan, halaman login, dan favicon
(`LOGO_URL` di `src/lib/api.ts`).

## Catatan sumber

- Pinterest dicoba dulu sesuai permintaan: halaman pencarian Pinterest hanya
  menampilkan board ide tanpa URL unduhan langsung, dan satu gambar CDN pin
  yang berhasil diunduh sumber aslinya tidak jelas, jadi tidak dipakai.
  Semua foto final memakai Pexels (images.pexels.com, lisensi stok gratis).
- Semua file sudah diverifikasi: JPEG asli, dimensi wajar (900px lebar),
  ukuran di bawah 500 KB per file.
- Cara mengganti foto: timpa file dengan nama yang sama di folder ini.
  Tidak perlu mengubah dummy.ts atau komponen katalog.
