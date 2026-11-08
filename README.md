# Dashboard Koperasi MBG

Dashboard buat koperasi MBG: satu web, empat tampilan beda per role.
Manager, finance, barista, pelanggan. Dibangun pake React + Vite +
TypeScript, tampilannya liquid glass di atas foto dermaga kiriman Zaky.

Status: frontend sudah terhubung ke backend beneran (Cloudflare Worker +
D1). Pesanan tamu masuk antrean barista, login staff pake OTP, laporan
dari data asli. Foto katalog masih placeholder (stok Pexels, bukan foto
produk asli), diganti dengan cara menimpa file di `public/images/`.

Repo: https://github.com/zakyShadra/koperasi-mbg

Live (GitHub Pages): https://zakyshadra.github.io/koperasi-mbg/

Setiap push ke `main` otomatis ke-deploy ulang lewat GitHub Actions.

Backend: Worker `koperasi-mbg-api` di
https://koperasi-mbg-api.zakyshadra.workers.dev, D1 `koperasi-mbg`.
Kode Worker ada di folder `worker/` di repo ini (deploy: `cd worker &&
wrangler deploy`). Detail API: `worker/API.md`. Migrasi ke akun
Cloudflare khusus koperasi: `worker/MIGRATION.md`.

Spreadsheet kerja: https://docs.google.com/spreadsheets/d/1YLyLFdnuJ9P8rVuXAGMceX8C7SUCXesScCdxTu1Mu6k/edit
(D1 sumber kebenaran, Sheet cuma cermin append-only. Link "Buka
Spreadsheet" ada di halaman manager dan finance.)

## Cara jalanin

```bash
cd MBG
npm install
npm run dev
```

Buka http://localhost:5173. Buat build produksi:

```bash
npm run build
npm run preview
```

## Cara nyoba login staff

Halaman login staff disembunyiin di route `/kprmbg20asdf`. Tidak ada
link ke sana dari mana pun di web pelanggan, ketik manual URL-nya.

Email staff (allowlist di D1, domain `mbg.com`):

- `manager@mbg.com` (role manager)
- `finance@mbg.com` (role finance)
- `barista@mbg.com` (role barista)

Masukin email, klik Kirim kode. Mode DEV masih aktif: kodenya muncul
di halaman login (DEV ONLY, dihapus saat peluncuran). Masukin kode
6 digit, sesi jalan 30 hari (sliding refresh, tersimpan di
localStorage). Halaman staff (`/manager`, `/finance`, `/barista`)
tanpa sesi bakal dilempar balik ke halaman login. Kalau sesi sudah dicabut atau kedaluwarsa di server, aplikasi langsung membersihkan sesi lokal dan melempar ke halaman login begitu ada panggilan API yang ditolak (tidak ada lagi kartu Memuat... yang menggantung). Staff baru cuma bisa
ditambah lewat bot Telegram admin, tidak ada signup publik.

Pelanggan tidak perlu login. Checkout tamu: nama + nomor WA, lacak
pesanan pake nomor order.

## Rute

| Rute | Halaman | Akses |
| --- | --- | --- |
| `/pelanggan` | Katalog (2 tab, cari, tambah ke keranjang) | Tamu |
| `/pelanggan/keranjang` | Keranjang, ubah jumlah, lanjut checkout | Tamu |
| `/pelanggan/checkout` | Nama + WA + metode bayar, kirim pesanan | Tamu |
| `/pelanggan/lacak` | Lacak pesanan pakai nomor order | Tamu |
| `/pelanggan/lacak/:nomor` | Status satu pesanan + QRIS | Tamu |
| `/manager` | Dashboard: stat, grafik omzet, pesanan terbaru | Staff manager |
| `/manager/pesanan` | Semua pesanan, filter per status | Staff manager |
| `/manager/laporan` | Panel laporan per periode | Staff manager |
| `/finance` | Kas, tabel transaksi, donat kategori | Staff finance |
| `/finance/transaksi-baru` | Form tambah transaksi | Staff finance |
| `/barista` | Kanban antrean Baru / Disiapkan / Siap | Staff barista |
| `/barista/katalog` | Katalog warkop, tandai habis, walk-in, ubah harga (manager) | Staff barista/manager |
| `/kprmbg20asdf` | Login staff (email + OTP, disembunyikan) | - |

Navigasi utama adalah sidebar kiri (rel ikon 64px yang mengembang
jadi 240px saat hover atau dikunci): ikon + label + status kanan,
submenu per item (misal Katalog per kategori, Pesanan per status),
kartu preview melayang saat hover (total count-up, perbandingan
periode, grafik batang dengan tooltip), blok user di bawah. Di HP
sidebar jadi bottom bar. Tamu tidak perlu login; checkout tamu:
nama + nomor WA, lacak pesanan pakai nomor order.

## Alur

```mermaid
flowchart TD
    A[Pelanggan buka /pelanggan] --> B[Lihat katalog, tambah ke keranjang]
    B --> C[/pelanggan/keranjang]
    C --> D[/pelanggan/checkout: nama + WA + bayar]
    D --> E[/pelanggan/lacak/:nomor]
    E --> F[Order masuk antrean barista]
    G[Order ShopeeFood masuk] --> H[Forwarder kirim notifikasi]
    H --> I[Draft order di antrean barista]
    I --> J[Barista konfirmasi satu tap]
    F --> J
    J --> K[Status: disiapkan, siap, selesai]
    K --> L[Manager dan finance lihat di pencatatan]
```

ASCII fallback:

```
Pelanggan pesan di web --> keranjang --> checkout --> lacak --> antrean barista
ShopeeFood --> forwarder --> draft order --> barista konfirmasi
Barista ubah status --> disiapkan, siap, selesai
Manager dan finance lihat pencatatan
```

## Struktur

```
MBG/
  worker/           (Cloudflare Worker + D1: API, schema, seed, docs)
    src/index.ts    (semua route API)
    src/qris.ts     (bangun payload QRIS)
    src/telegram.ts (bot admin: tambah staff, cabut sesi, buka/tutup)
    API.md          (kontrak API)
    README.md       (deploy, secret, status domain)
    MIGRATION.md    (pindah ke akun Cloudflare lain)
    mirror.gs       (Apps Script: tulis cermin ke Sheet)
  src/
    app/
      router.tsx      (rute + guard, judul per halaman)
    pages/
      Login.tsx       (login staff, route /kprmbg20asdf)
      Manager.tsx     (stat, grafik omzet, tabel pesanan, link ke halaman pecahan)
      ManagerPesanan.tsx (semua pesanan, filter status)
      ManagerLaporan.tsx (panel laporan per periode)
      Finance.tsx     (kas, transaksi, donat kategori, CSV)
      FinanceTransaksiBaru.tsx (form tambah transaksi)
      Barista.tsx     (kanban 3 kolom)
      BaristaKatalog.tsx (katalog warkop, tandai habis, walk-in, ubah harga)
      Pelanggan.tsx   (katalog 2 tab, cari, tambah ke keranjang)
      CartPage.tsx    (keranjang)
      CheckoutPage.tsx (nama + WA + metode bayar)
      TrackerPage.tsx (lacak pesanan pakai nomor order + QRIS)
    components/
      TopBar.tsx      (logo, judul halaman, tanggal)
      Sidebar.tsx     (rel kaca lipat, submenu, kartu preview melayang, blok user)
      Sidebar.css
      FlyoutCard.tsx  (count-up, grafik batang, tooltip per batang)
      StatCard.tsx    (kartu angka)
      MbgCharts.tsx   (grafik omzet, arus kas, donat, tren)
      OrderTable.tsx  (tabel pesanan)
      SlidingTabs.tsx (tab dengan pill yang berjalan)
      StatusPill.tsx  (pill status pesanan)
      GlassCard.tsx   (kartu kaca)
      View.tsx        (animasi masuk halaman)
      RequireAuth.tsx (guard halaman staff)
      icons.tsx       (ikon SVG inline)
    features/
      manager/
        ReportPanel.tsx
      finance/
        TransactionForm.tsx (modal dan mode halaman)
      barista/
        OrderCard.tsx
        KanbanColumn.tsx
      pelanggan/
        ProductCard.tsx
        CartPanel.tsx    (CartLines: isi keranjang + total, dipakai ulang)
        cart.ts          (fungsi murni keranjang + metode bayar sebagai data)
        cart-context.tsx (CartProvider: keranjang + pesanan terakhir, localStorage)
        OrderTracker.tsx
        PelangganLoader.tsx (loader teko tuang kopi)
        WarkopClosed.tsx (banner warkop tutup)
        loader.css
    lib/
      api.ts          (client Worker API + tipe + mapper)
      dummy.ts        (tipe data + langkah lacak)
      format.ts       (fmtRp, tanggal WIB)
      warkop.ts       (hook status buka/tutup, polling 20 detik)
      auth-session.ts (sesi localStorage, 30 hari sliding)
    styles/
      tokens.css      (token desain dari DESIGN.md)
      components.css  (kaca, tombol, tabel, tab, animasi)
    assets/
      bg-pier.jpg     (foto dermaga kiriman Zaky)
  public/
    images/           (foto katalog + logo placeholder, lihat MAPPING.md)
  SKETSA-DASHBOARD.md (sketsa awal)
  DESIGN.md           (bukan di sini, ada di workspace Muse)
```

## Siapa mengerjakan apa

| Bagian | File |
| --- | --- |
| Tampilan per role | `src/pages/*.tsx` |
| Komponen dipakai ulang | `src/components/*.tsx` |
| Logika per role | `src/features/*/*.tsx` |
| Client API | `src/lib/api.ts` |
| Login dan sesi | `src/lib/api.ts`, `src/lib/auth-session.ts` |
| Token warna dan kaca | `src/styles/tokens.css`, `src/styles/components.css` |
| Rute dan guard | `src/app/router.tsx` |
| Sidebar dan menu per role | `src/components/Sidebar.tsx` (menu sebagai data, bukan if/else) |
| Keranjang tamu | `src/features/pelanggan/cart-context.tsx` |
| Backend Worker + D1 | `worker/` |
| Mirror Sheet | `worker/mirror.gs` + `worker/API.md` |

## Mau ubah... | Edit...

| Mau ubah... | Edit... |
| --- | --- |
| Data produk, harga, stok | API Worker (D1) atau halaman katalog barista |
| Warna, kaca, radius, animasi | `src/styles/tokens.css`, `src/styles/components.css` |
| Nambah role baru | `src/pages/`, `src/app/router.tsx`, allowlist D1 via bot |
| Nambah email staff | Bot Telegram admin (`/addstaff`), bukan dari kode |
| Ganti foto katalog atau logo | Timpa file di `public/images/` (lihat MAPPING.md) |
| Ganti foto background | `src/assets/bg-pier.jpg` |
| Ganti path login tersembunyi | `src/app/router.tsx` (rute `/kprmbg20asdf`) |
| Ganti Sheet cermin | `GAS_MIRROR_URL` di Worker (satu nilai config) |
| Ganti domain | DNS + `MBG/public/CNAME` (lihat `worker/README.md`) |

## Batasan yang perlu diingat

- Foto katalog dan logo masih placeholder (stok Pexels). Foto asli
  diganti dengan menimpa file yang sama di `public/images/`.
- QRIS masih dummy (NMID placeholder). QR yang tampil tidak
  memindahkan uang asli. QRIS live butuh registrasi merchant NMID,
  lalu ganti `QRIS_*` di Worker dan redeploy.
- Mode DEV masih aktif: kode OTP tampil di halaman login. Matikan
  sebelum peluncuran (`DEV_MODE=false` di Worker + redeploy).
- Status pesanan di app: baru, disiapkan, siap, selesai, dibatalkan.
  Dokumen "Deskripsi Topik" memakai kata lain (diproses, batal);
  selisih ini diputuskan di audit, jangan dicampur di kode.
- Sheet "KoperasiMBG" masih kosong tab-nya sampai konektor Google
  Sheets dihubungkan dan skrip `apply-sheet.sh` dijalankan. Link
  "Buka Spreadsheet" sudah mengarah ke Sheet yang benar.
- Domain `koperasimbg.ices.my.id` belum bisa dipakai: record DNS
  CNAME belum dibuat (langkah manual di dashboard Cloudflare).
  Sampai ada, app jalan di GitHub Pages dan API di workers.dev.
- Bot Telegram belum aktif: secret `TELEGRAM_BOT_TOKEN` belum diset
  dan webhook belum dipasang. Sampai itu beres, staff baru tidak
  bisa ditambah (allowlist masih 3 email awal).
- Forwarder ShopeeFood (aplikasi Android) belum dibangun. Endpoint
  penerima draft di Worker sudah jadi.
