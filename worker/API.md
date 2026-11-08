# Koperasi MBG API contract

Base URL (production): `https://koperasi-mbg-api.<subdomain>.workers.dev`
(Exact URL is printed by `wrangler deploy` and recorded in README.md.)
Planned API base after custom domain: `https://koperasimbg.ices.my.id/api`.

All responses are JSON with `ok: true` on success or `ok: false, error: <code>`
on failure. Staff routes use `Authorization: Bearer <session token>`.
Order statuses: `baru`, `disiapkan`, `siap`, `selesai`, `dibatalkan`.
Payment methods: `tunai`, `transfer`, `qris`.

## Public

### GET /api/catalog
Query: `tab=koperasi|warkop`, `q=<search>`.
Response: `{ ok, categories: [{id, nama, deskripsi}], products: [{id, kode_produk, nama, harga, stok, satuan, deskripsi, gambar, tersedia, is_aktif, kategori}] }`.

### POST /api/orders
Guest checkout. Body:
`{ "nama": "Sari", "no_wa": "081234567890", "items": [{ "product_id": 9, "qty": 2 }], "metode_bayar": "qris", "catatan": "..." }`.
Response 201: `{ ok, order: { id, nomor_pesanan, nama_pelanggan, status: "baru", total, metode_bayar, status_bayar: "belum", sumber_pesanan: "web", dibuat_pada }, qris_payload?, qris_dummy? }`.
`qris_payload` is included only when `metode_bayar` is `qris`. Order number format: `MBG-YYYYMMDD-NNNN`.
Errors: `nama_wajib_diisi`, `no_wa_wajib_diisi`, `metode_bayar_tidak_dikenal`, `pesanan_tanpa_item_tidak_valid`, `produk_tidak_ditemukan:<id>`, `stok_tidak_cukup:<nama>`, `qty_harus_lebih_dari_0`.

### GET /api/orders/:number
Track by order number, e.g. `GET /api/orders/MBG-20261108-0001`.
Response: `{ ok, order, items: [{ produk_id, qty, harga_saat_beli, subtotal, produk_nama }] }`.
Error 404: `pesanan_tidak_ditemukan`.

### GET /api/orders/:number/qris
Response: `{ ok, order_number, amount, status, qris_payload, qris_dummy, note? }`.
`qris_dummy` is true while the dummy NMID is configured. A dummy QRIS never moves real money.

### GET /api/warkop/status
Response: `{ ok, status: "buka" | "tutup" }`.

## Staff (Bearer session token)

### POST /api/auth/request-otp
Body: `{ "email": "manager@mbg.com", "tujuan": "login" | "action" }`.
`tujuan` defaults to `login`. Use `"action"` when the next step is a sensitive
action (price change) via `/api/auth/verify-fresh-otp`.
Response: `{ ok, message }`. The message is identical for registered and
unregistered emails, so addresses cannot be probed.
DEV_MODE only: response also contains `dev_code` (the 6-digit code).
OTP: 6 digits, 10 minute expiry, 5 attempts, single use.

### POST /api/auth/verify-otp
Body: `{ "email": "...", "code": "123456" }`.
Response: `{ ok, token, staff: { id, nama, email, peran }, expires_in_days: 30 }`.
Store `token` and send it as `Authorization: Bearer <token>`. Sessions slide:
every valid request extends expiry to now + 30 days.
Errors 401: `verifikasi_gagal`, `tidak_ada_kode_otp_aktif`, `kode_otp_salah`,
`kode_otp_kedaluwarsa_minta_kode_baru`, `percobaan_habis_minta_kode_baru`.

### POST /api/auth/verify-fresh-otp
Requires a valid session. Body: `{ "code": "123456" }` where the code came from
`request-otp` with `tujuan: "action"`.
Response: `{ ok, action_token, expires_in_seconds: 600 }`. Single use, 10 minutes.

### POST /api/auth/logout
Requires a valid session (Bearer). Revokes the session. Response: `{ ok: true }`.

### GET /api/barista/queue
Roles: barista, manager. Response: `{ ok, orders: [...] }` for orders in
`baru`, `disiapkan`, `siap`, oldest first. Each order carries its
`items: [{ produk_nama, qty, harga_saat_beli, subtotal }]`. Draft ShopeeFood
orders have `is_draft: 1`. Expired drafts (older than 3 minutes, still
unconfirmed) are auto-cancelled to `dibatalkan` when this endpoint is read.

### GET /api/orders
Roles: manager, finance. List orders, newest first. Query: `status` (one of
`baru`, `disiapkan`, `siap`, `selesai`, `dibatalkan`), `limit` (default 50,
max 200). Response: `{ ok, orders: [...] }`, each order with its `items`.
Finance responses never include customer WA numbers.

### POST /api/orders/:id/status
Roles: barista, manager. `:id` is the numeric order id.
Body: `{ "status": "disiapkan" | "siap" | "selesai" | "dibatalkan" }`.
Rules: status moves one step only (`baru` to `disiapkan` to `siap` to `selesai`);
any non-final order can go to `dibatalkan`; final orders (`selesai`,
`dibatalkan`) cannot change. Confirming a draft means `status: "disiapkan"`
within 3 minutes of creation, otherwise it auto-cancels.
`selesai` requires the order to be paid: `status_bayar` is `lunas` (via
`/pay-dummy` in DEV_MODE, or a finance `pembayaran` transaction covering the
total), or pass `{ "status": "selesai", "tunai_diterima": true }` for cash
received at the counter (`metode_bayar` must be `tunai`).
Response: `{ ok, order_id, status, draft? }`.

### POST /api/orders/walk-in
Roles: barista, manager. Same body as guest checkout, but `no_wa` may be empty.
`sumber_pesanan` is set to `walk-in`. Response is the same as POST /api/orders.

### POST /api/products/:id/availability
Roles: barista, manager. Body: `{ "tersedia": 1 | 0 }`.
Marks a product Habis (0) or Tersedia (1). Cannot mark available when stock is 0.
Response: `{ ok, product_id, tersedia }`.

### POST /api/products/:id/price
Roles: manager only, plus a fresh-OTP action token.
Body: `{ "harga": 15000, "action_token": "..." }`.
The action token comes from `/api/auth/verify-fresh-otp` and is single use.
Old orders keep their `harga_saat_beli` snapshot; only future orders use the
new price. Response: `{ ok, product_id, harga }`.

### POST /api/warkop/status
Roles: barista, manager. Body: `{ "status": "buka" | "tutup" }`.
Response: `{ ok, status }`. While `tutup`, the frontend must show a blocking
notice and stop checkout (enforced in the UI; the API still accepts orders).

### GET /api/finance/transactions
Roles: finance, manager. Query: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`,
`jenis=simpanan|pembayaran|penarikan`, `kategori=<text>`. Max 200 rows, newest first.
Response: `{ ok, transactions: [{ id, kode, jenis, jumlah, metode, kategori, keterangan, dibuat_pada, staf_nama, nomor_pesanan }] }`.
Finance responses never include customer WA numbers.

### POST /api/finance/transactions
Roles: finance, manager. Body:
`{ "jenis": "pembayaran", "jumlah": 50000, "metode": "qris", "pesanan_id": 12, "kategori": "Penjualan", "keterangan": "..." }`.
`pesanan_id` is optional (null for simpanan/penarikan without an order).
A `pembayaran` that covers an order total marks that order `lunas`.
A cancelled order cannot receive new transactions.
Response 201: `{ ok, transaction_id, kode }`, kode format `TRX-YYYYMMDD-NNNN`.

### GET /api/stats
Role: manager. Dashboard numbers for today. Response:
`{ ok, anggota_aktif, stok_menipis, pesanan_hari_ini, omzet_hari_ini, pesanan_selesai_hari_ini }`.
`stok_menipis` counts active products with stock 5 or less. `omzet_hari_ini`
and `pesanan_selesai_hari_ini` count only `selesai` orders.

### GET /api/reports/omzet
Roles: finance, manager. Query: `from`, `to` (default last 7 days).
Counts only `selesai` orders. Response:
`{ ok, from, to, total: { pesanan, omzet }, daily: [{ tanggal, pesanan, omzet }] }`.

### GET /api/reports/cash
Roles: finance, manager. Query: `from`, `to` (default last 30 days).
`masuk` = pembayaran + simpanan, `keluar` = penarikan.
Response: `{ ok, from, to, masuk, keluar, saldo, per_kategori: [{ kategori, jenis, jumlah }] }`.

### POST /api/mirror
Roles: finance, manager. Body: `{ "tab": "Pesanan", "rows": [[...]] }`.
Forwards to the GAS web app (`GAS_MIRROR_URL`). The Worker adds the secret
to the JSON body (`{ "secret": <GAS_MIRROR_SECRET>, "tab", "rows" }`) because
Apps Script `doPost` cannot read request headers, so an `X-Mirror-Secret`
header would never reach the script. If the URL or the secret is unset:
`{ ok: false, error: "gas_mirror_not_configured" }`. Mirror failures never
block orders; order mirroring happens server-side and is best effort.

## Webhooks (no session auth, secret/header auth)

### POST /api/shopeefood/draft
Header: `X-Forwarder-Secret: <FORWARDER_SECRET>`.
Body: `{ "text": "<raw notification text>", "customer_name": "...", "total": 24000, "items": [{ "name": "Kopi Tubruk", "qty": 2 }] }`.
Items are matched to products by name; unmatched items are kept in `catatan`
and the draft is still created. Response 201: `{ ok, draft: true, order, warning? }`.
The draft must be confirmed by a barista within 3 minutes via
`POST /api/orders/:id/status` with `status: "disiapkan"`, otherwise it is
auto-cancelled. Error 401: `forwarder_secret_tidak_valid`.

### POST /api/telegram/webhook
Telegram update JSON. Admin only (Telegram user id `8776702375`).
Commands: `/addstaff <email> <role> [nama]`, `/revoke <email>`, `/liststaff`,
`/setopen`, `/setclosed`, `/help`.
`/addstaff` creates the staff row as inactive and sends an inline
Approve/Reject keyboard; approval activates the account. `/revoke` deactivates
the staff and revokes all their sessions.
If `TELEGRAM_BOT_TOKEN` is unset: 503
`{ ok: false, error: "telegram_not_configured" }`.

## Dev only

### POST /api/orders/:number/pay-dummy
Only when `DEV_MODE=true`. Marks the order `lunas` so the barista flow can be
tested end to end. Otherwise 403 `pay_dummy_hanya_di_dev_mode`.
Response: `{ ok, order_number, status_bayar: "lunas" }`.
