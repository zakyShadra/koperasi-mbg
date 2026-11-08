# Install sinkron dua arah Koperasi MBG (Sheet <-> D1)

Worker sudah berisi endpoint sinkronnya. Yang masih manual: pasang script
Apps Script yang terikat ke spreadsheet baru, deploy sebagai web app, dan
set secret di kedua sisi. Sampai langkah ini selesai dan tes end-to-end
lolos, sinkron BELUM live.

## Prasyarat

- Spreadsheet "KoperasiMBG" (ID `1YLyLFdnuJ9P8rVuXAGMceX8C7SUCXesScCdxTu1Mu6k`,
  pemilik raibnova@gmail.com) sudah dibagikan ke zakyshadra@gmail.com
  sebagai editor. Tanpa ini, akun zakyshadra tidak bisa membuat script
  yang terikat ke sheet ini.
- Worker sudah di-deploy (berisi `src/sync.ts` dan endpoint
  `/api/sheet-sync`, `/api/sync/reconcile`, `/api/sync/log`).

## Langkah 1: buat script yang terikat ke sheet

1. Buka spreadsheet "KoperasiMBG" sebagai zakyshadra@gmail.com.
2. Menu Extensions -> Apps Script. Editor terbuka dengan project baru
   (sudah terikat ke sheet ini).
3. Hapus isi `Code.gs`, lalu tempel seluruh isi file `mirror-sync.gs`
   dari folder `worker/` repo ini. Simpan (Ctrl+S / Cmd+S).
4. Di editor, buka Project Settings (ikon roda gigi) -> Script Properties
   -> Add script property, tambahkan dua property ini. Nilainya dibuat
   dengan perintah di bawah (jalankan di terminal, JANGAN tulis nilainya
   di mana pun selain di property dan di wrangler secret):

```sh
openssl rand -hex 32
```

   Jalankan dua kali (satu untuk tiap property):
   - `MIRROR_SECRET` = hasil pertama (Worker -> GAS).
   - `SYNC_SECRET` = hasil kedua (GAS -> Worker).

## Langkah 2: deploy sebagai web app

1. Di editor, Deploy -> New deployment.
2. Klik ikon roda gigi di sebelah "Select type" -> Web app.
3. Execute as: Me. Who has access: Anyone.
4. Deploy. Salin URL web app-nya (berakhiran `/exec`). Ini
   `GAS_MIRROR_URL`.
5. Kalau muncul layar otorisasi, izinkan akses ke spreadsheet dan ke
   layanan eksternal (UrlFetchApp) untuk akun zakyshadra.

Catatan: project GAS lama (script ID `1KToBhiv94IuOjaOhWHAQXit3ggQRb98zAQSWSEa2oCTguCy5mvYKeOvq`,
deployment `AKfycbzfC-IvrYEK-pwhKrojBIowbytFIA_eNG_cJwKQIAe7RZH1zU0t2MhaxkeKCwcQqaZMrg`)
terikat ke sheet LAMA (ID `1NCwWg4Pr0H9eqD_0LWS7pOQmD3HPWbgMmInjVrsztPQ`) dan
hanya bisa append. Jangan dipakai lagi. Hapus setelah sinkron baru live.

## Langkah 3: pasang trigger onEdit

1. Di editor, di kotak fungsi pilih `setupSync`, klik Run.
2. Izinkan akses kalau diminta (trigger butuh akses spreadsheet dan
   UrlFetchApp).
3. Cek log (View -> Logs): harus ada baris "Trigger onSheetEdit terpasang.
   MIRROR_SECRET terisi: true, SYNC_SECRET terisi: true". Kalau ada yang
   false, ulangi Langkah 1 poin 4.

## Langkah 4: set secret di Worker

Di folder `worker/` repo (laptop), jalankan:

```sh
wrangler secret put GAS_MIRROR_URL
wrangler secret put GAS_MIRROR_SECRET
wrangler secret put SHEET_SYNC_SECRET
```

Tempel nilai yang sama dengan Langkah 1 dan 2 (URL web app untuk yang
pertama, nilai property untuk dua lainnya). `wrangler secret put` langsung
aktif di Worker yang sudah ter-deploy, tidak perlu deploy ulang. Kalau
Worker belum di-deploy dengan kode sinkron, jalankan `wrangler deploy`
dulu.

## Langkah 5: tes end-to-end

1. Buat satu pesanan di web (guest checkout). Tunggu beberapa detik,
   buka tab Pesanan di Sheet: baris pesanan baru harus muncul dengan
   nomor yang sama. Cek juga tab Pesanan Item.
2. Di Sheet, ubah harga satu produk (misal BRG-001) lalu tunggu beberapa
   detik. Cek di D1:
   `wrangler d1 execute koperasi-mbg --remote --command "SELECT kode_produk, harga, diubah_pada FROM produk WHERE kode_produk='BRG-001'"`.
   Harga baru harus muncul. Kembalikan harga ke semula lewat Sheet
   (atau lewat app) supaya data bersih.
3. Cek log sinkron: `GET /api/sync/log` dengan token staff (manager/
   finance). Harus ada baris `arah: sheet_ke_worker` dan
   `arah: worker_ke_sheet`.
4. Tes konflik (opsional tapi disarankan): ubah harga produk yang sama
   di Sheet dan di app dalam waktu berdekatan, lalu cek `/api/sync/log`:
   harus ada baris `aksi: lewat_konflik` untuk pihak yang kalah, dan
   nilai yang menang adalah yang `diubah_pada`-nya paling baru.

## Troubleshooting

- Trigger tidak jalan: buka Apps Script -> Executions, lihat error-nya.
  Penyebab umum: `SYNC_SECRET` belum diset (log: "SYNC_SECRET belum
  diset"), atau otorisasi trigger belum diberikan (jalankan lagi
  `setupSync` dan izinkan).
- Web app mengembalikan error `unauthorized`: nilai `MIRROR_SECRET` di
  script property tidak sama dengan `GAS_MIRROR_SECRET` di Worker.
  Samakan, lalu tes ulang.
- `/api/sheet-sync` mengembalikan `sheet_sync_secret_tidak_valid`: nilai
  `SYNC_SECRET` di script property tidak sama dengan `SHEET_SYNC_SECRET`
  di Worker.
- Baris baru di Sheet tidak masuk ke D1: onEdit tidak jalan untuk
  sisip/hapus baris kosong. Isi dulu barisnya (ketik nilai), baru trigger
  jalan. Baris yang terlewat akan diperbaiki cron reconcile 15 menit.
- Baris yang dihapus di Sheet muncul lagi: itu memang disengaja. Hapus
  data lewat app, bukan lewat Sheet. Sinkron tidak pernah menghapus baris.

## Batas yang perlu diingat

- "Realtime" di sini berarti hitungan detik, bukan instan. onEdit GAS
  jalan dalam hitungan detik, bisa menggabungkan edit massal, dan tidak
  jalan untuk sisip/hapus baris atau perubahan rumus saja. Cron reconcile
  15 menit adalah jaring pengaman.
- Edit Pesanan Item dari Sheet tidak mengubah stok. Stok hanya berubah
  lewat app.
- Baris `sumber = "contoh"` tidak pernah disinkronkan ke D1.
- Menghapus baris di Sheet tidak menghapus di D1.
