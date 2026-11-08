# Dashboard Koperasi MBG

Dashboard buat koperasi MBG: satu web, empat tampilan beda per role.
Manager, finance, barista, pelanggan. Dibangun pake React + Vite +
TypeScript, tampilannya liquid glass di atas foto dermaga kiriman Zaky.

Status: UI + alur demo jalan. Data masih dummy, backend belum ada.

Repo: https://github.com/zakyShadra/koperasi-mbg

Live (GitHub Pages): https://zakyshadra.github.io/koperasi-mbg/

Setiap push ke `main` otomatis ke-deploy ulang lewat GitHub Actions.

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

Email demo (DEV STUB, bukan akun beneran):

- `manager@mbg.dev` (role manager)
- `finance@mbg.dev` (role finance)
- `barista@mbg.dev` (role barista)

Masukin email, klik Kirim kode. Kodenya muncul di console browser
dan di halaman login (DEV ONLY, dihapus pas backend jadi). Masukin
kode 6 digit, sesi jalan 30 hari (sliding refresh, tersimpan di
localStorage). Halaman staff (`/manager`, `/finance`, `/barista`)
tanpa sesi bakal dilempar balik ke halaman login.

Pelanggan tidak perlu login. Checkout tamu: nama + nomor WA, lacak
pesanan pake nomor order.

## Rute

| Rute | Halaman | Akses |
| --- | --- | --- |
| `/pelanggan` | Katalog (2 tab, cari, tambah ke keranjang) | Tamu |
| `/pelanggan/keranjang` | Keranjang, ubah jumlah, lanjut checkout | Tamu |
| `/pelanggan/checkout` | Nama + WA + metode bayar, kirim pesanan | Tamu |
| `/pelanggan/lacak` | Lacak pesanan pakai nomor order | Tamu |
| `/pelanggan/lacak/:nomor` | Status satu pesanan | Tamu |
| `/manager` | Dashboard: stat, grafik omzet, pesanan terbaru | Staff manager |
| `/manager/pesanan` | Semua pesanan, filter per status | Staff manager |
| `/manager/laporan` | Panel laporan per periode | Staff manager |
| `/finance` | Kas, tabel transaksi, donat kategori | Staff finance |
| `/finance/transaksi-baru` | Form tambah transaksi | Staff finance |
| `/barista` | Kanban antrean Baru / Disiapkan / Siap | Staff barista |
| `/barista/katalog` | Katalog warkop, tandai habis, walk-in | Staff barista |
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
      BaristaKatalog.tsx (katalog warkop, tandai habis, walk-in)
      Pelanggan.tsx   (katalog 2 tab, cari, tambah ke keranjang)
      CartPage.tsx    (keranjang)
      CheckoutPage.tsx (nama + WA + metode bayar)
      TrackerPage.tsx (lacak pesanan pakai nomor order)
    components/
      TopBar.tsx      (logo, judul halaman, tanggal)
      Sidebar.tsx     (rel kaca lipat, submenu, kartu preview melayang, blok user)
      Sidebar.css
      FlyoutCard.tsx  (count-up, grafik batang, tooltip per batang)
      StatCard.tsx    (kartu angka)
      BarChart.tsx    (grafik batang omzet)
      DonutChart.tsx  (donat kategori)
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
        transactions-store.ts (transaksi, localStorage, dipakai Finance + form baru)
      barista/
        OrderCard.tsx
        KanbanColumn.tsx
        barista-store.ts (antrean + ketersediaan warkop, localStorage)
      pelanggan/
        ProductCard.tsx
        CartPanel.tsx    (CartLines: isi keranjang + total, dipakai ulang)
        cart.ts          (fungsi murni keranjang + metode bayar sebagai data)
        cart-context.tsx (CartProvider: keranjang + pesanan terakhir, localStorage)
        OrderTracker.tsx
        PelangganLoader.tsx (loader teko tuang kopi)
        loader.css
    lib/
      dummy.ts        (semua data contoh, ganti api.ts nanti)
      format.ts       (fmtRp)
      auth-api.ts     (DEV STUB OTP, diganti Worker + D1)
      auth-session.ts (sesi localStorage, 30 hari sliding)
    styles/
      tokens.css      (token desain dari DESIGN.md)
      components.css  (kaca, tombol, tabel, tab, animasi)
    assets/
      bg-pier.jpg     (foto dermaga kiriman Zaky)
  SKETSA-DASHBOARD.md (sketsa awal)
  DESIGN.md           (bukan di sini, ada di workspace Muse)
```

## Siapa mengerjakan apa

| Bagian | File |
| --- | --- |
| Tampilan per role | `src/pages/*.tsx` |
| Komponen dipakai ulang | `src/components/*.tsx` |
| Logika per role | `src/features/*/*.tsx` |
| Data contoh | `src/lib/dummy.ts` |
| Login dan sesi | `src/lib/auth-api.ts`, `src/lib/auth-session.ts` |
| Token warna dan kaca | `src/styles/tokens.css`, `src/styles/components.css` |
| Rute dan guard | `src/app/router.tsx` |
| Sidebar dan menu per role | `src/components/Sidebar.tsx` (menu sebagai data, bukan if/else) |
| Keranjang tamu | `src/features/pelanggan/cart-context.tsx` |

## Mau ubah... | Edit...

| Mau ubah... | Edit... |
| --- | --- |
| Data produk, pesanan, transaksi | `src/lib/dummy.ts` |
| Warna, kaca, radius, animasi | `src/styles/tokens.css`, `src/styles/components.css` |
| Nambah role baru | `src/pages/`, `src/app/router.tsx`, `src/lib/auth-api.ts` |
| Ganti backend dummy ke API beneran | `src/lib/dummy.ts` jadi `src/lib/api.ts` |
| Nambah email staff | `src/lib/auth-api.ts` (sementara; nanti via bot Telegram ke D1) |
| Ganti foto background | `src/assets/bg-pier.jpg` |
| Ganti path login tersembunyi | `src/app/router.tsx` (rute `/kprmbg20asdf`) |

## Batasan yang perlu diingat

- Semua angka, nama barang, dan pesanan itu dummy. Bukan data asli.
- Login masih DEV STUB. Kode OTP cuma simulasi di browser, tidak ada
  email beneran yang terkirim. Backend asli (Worker + D1 allowlist)
  itu langkah berikut, butuh akun Cloudflare owner.
- Path login acak (`/kprmbg20asdf`) itu cuma bonus biar tidak gampang
  ketemu dirsearch. Keamanan benerannya tetap allowlist + OTP +
  rate limit di backend nanti.
- Tombol "Simpan ke Sheet" dan "Download laporan" (manager) cuma
  nunjukin pesan demo. Download CSV (finance) sudah jalan beneran
  di browser.
- Deep link ShopeeFood masih placeholder. Web ke ShopeeFood cuma
  deep link, bukan injeksi order, karena ShopeeFood tidak punya
  API publik.
- Font Inter dimuat dari Google Fonts, jadi butuh internet pas
  pertama buka. Tanpa internet, fallback ke system font.
- Rute pake BrowserRouter, jadi harus jalan lewat dev server atau
  preview, bukan dibuka langsung file HTML-nya.
- Keranjang, transaksi baru, dan antrean barista tersimpan di
  localStorage perangkat (bukan server). Pesanan tamu yang dibuat di
  web belum masuk antrean barista; itu butuh backend Worker + D1.
- Pemisahan halaman ini selaras dengan SRP di SOLID-PLAN.md: satu
  halaman satu pekerjaan, state dibagi lewat store kecil per fitur,
  menu sidebar dan metode bayar ditulis sebagai data. Refactor SOLID
  penuh belum dikerjakan, menunggu gas Zaky.
- Foto produk belum ada, thumbnail masih tile gradien + inisial.
