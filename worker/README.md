# Koperasi MBG API Worker

Cloudflare Worker + D1 backend for the Koperasi MBG dashboard (cooperative +
warkop). D1 is the source of truth. Google Sheet is only a mirror, best effort.

- Worker name: `koperasi-mbg-api`
- D1 database: `koperasi-mbg`
- API base URL: (fill in after first deploy, from `wrangler deploy` output)
- Frontend: React app in `MBG/` (same repo), live at
  `https://zakyshadra.github.io/koperasi-mbg/`
- Planned custom domain: `https://koperasimbg.ices.my.id` (see status below)

## Deploy

```sh
cd worker
npm install
npm run db:apply   # create the 13 tables in D1 (remote)
npm run db:seed    # staff allowlist, warkop status, dummy catalog
wrangler deploy
```

Re-applying `schema.sql` is safe (all statements use `IF NOT EXISTS`).
Re-running `seed.sql` is safe (`INSERT OR IGNORE`).

## Secrets and env vars

Set secrets with `wrangler secret put <NAME>` (never commit values):

| Name | Required | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | For the bot | Telegram bot token. The webhook returns `telegram_not_configured` until this is set. Never write the value in any file or log. |
| `FORWARDER_SECRET` | For ShopeeFood drafts | Shared secret the Android forwarder sends as `X-Forwarder-Secret`. |
| `GAS_MIRROR_URL` | Optional | Google Apps Script web app URL for the Sheet mirror. Unset means the mirror is off and `/api/mirror` answers `gas_mirror_not_configured`. Orders never depend on it. |
| `GAS_MIRROR_SECRET` | Optional | Shared secret for the Sheet mirror. Same value as the `MIRROR_SECRET` script property in Apps Script. The Worker sends it inside the JSON body (`{ secret, tab, rows }`) because Apps Script `doPost` cannot read request headers. Set it with `wrangler secret put GAS_MIRROR_SECRET`. |
| `DEV_MODE` | var in wrangler.toml | `"true"` returns the OTP code in the `request-otp` response so staff can log in without an email sender. Dev only. Set to `"false"` and redeploy at launch. |
| `QRIS_MERCHANT_NAME` | var | Merchant name on the QRIS payload (max 25 chars). |
| `QRIS_MERCHANT_CITY` | var | Merchant city (max 15 chars). |
| `QRIS_NMID` | var | National Merchant ID from the QRIS registration. |
| `QRIS_MERCHANT_ID` | var | Merchant ID from the QRIS registration. |
| `QRIS_MCC` | var | Merchant category code, default `5812` (eating places). |
| `ADMIN_TELEGRAM_ID` | var | Telegram user id of the admin, default `8776702375`. |

After setting `TELEGRAM_BOT_TOKEN`, set the webhook:

```sh
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker-url>/api/telegram/webhook"
```

## Telegram bot

Admin commands: `/addstaff <email> <role> [nama]`, `/revoke <email>`,
`/liststaff`, `/setopen`, `/setclosed`, `/help`. `/addstaff` creates the staff
row inactive and asks the admin to approve via inline buttons. There is no
public signup endpoint anywhere in this API; staff can only be added by the
admin through the bot.

## QRIS: dummy vs live

The worker builds a dynamic QRIS payload per order using the EMVCo TLV
structure (fields 00, 01=12, 26 with `ID.CO.QRIS.WWW` + NMID + merchant ID,
52, 53=360, 54 amount, 58=ID, 59 name, 60 city, 62 bill number, 63
CRC16-CCITT-FALSE). The current config uses dummy placeholder values
(`QRIS_NMID=ID1020000000000`, merchant id all zeros, name marked DUMMY).
A dummy QRIS does NOT move real money and no wallet will settle against it.
A live QRIS that settles money needs a real NMID merchant registration
through a licensed QRIS provider (bank or e-wallet): submit business documents,
receive NMID + merchant ID, then replace the `QRIS_*` vars and redeploy.
Until then, treat every QRIS payload from this API as a test string.

## Dev OTP note

No email sender is wired yet, so in `DEV_MODE=true` the `request-otp` response
includes `dev_code` and the frontend displays it. This is intentional and was
explicitly requested to stay until launch. At launch: set `DEV_MODE=false`,
redeploy, and wire an email sender (for example Resend or MailChannels) in the
`request-otp` handler, then remove the `dev_code` branch.

## Schema notes (decisions made at build time)

The doc `06-skema-database.md` lists 11 tables; this build has 13. The two
extras are `pengaturan` (key-value store, holds `warkop_status`) and
`token_aksi` (short-lived single-use tokens for sensitive actions such as price
changes). Other deliberate deviations from the doc:

- Order status uses `baru/disiapkan/siap/selesai/dibatalkan` (frozen project
  decision). The doc's CHECK list (`baru/diproses/selesai/batal`) is outdated.
- `laporan.staf_id` is nullable with `ON DELETE SET NULL`, resolving the doc's
  own conflict (required column vs SET NULL action).
- `transaksi.anggota_id` is nullable and `transaksi` has `staf_id` (audit trail)
  and `kategori` (finance filter). The doc flags both as missing.
- `otp` has `jumlah_percobaan` (max 5 attempts) and `tujuan` (`login`/`action`).
- `pesanan` has `sumber_pesanan` (`web`/`shopeefood`/`walk-in`), `is_draft`,
  `metode_bayar`, `status_bayar` (`belum`/`lunas`), `dibayar_pada`, `raw_text`.
- `produk` has `gambar` (image path under `/images/`) and `tersedia` (Habis/Tersedia).
- Internal ids stay INTEGER AUTOINCREMENT per the doc; human-readable text ids
  are `kode_produk`, `nomor_pesanan` (`MBG-YYYYMMDD-NNNN`, 4 digits),
  `kode` on staf/anggota/transaksi (`STF-001`, `AGT-0001`, `TRX-YYYYMMDD-NNNN`).

## Status-word discrepancy (for the audit to settle)

Two spellings exist in the project docs. The app and this API use
`baru/disiapkan/siap/selesai/dibatalkan`. The newer "Deskripsi Topik dan
Kebutuhan Awal" document uses `diproses` and `batal` in one place. This was
NOT re-decided here; the audit decides which spelling wins and every document
is then updated to match. Until then, do not mix the two sets in code.

## Custom domain status

Target: `https://koperasimbg.ices.my.id` serves the GitHub Pages app, and
`https://koperasimbg.ices.my.id/api/*` routes to this Worker.

- Worker route `koperasimbg.ices.my.id/api/*` to `koperasi-mbg-api`: DONE,
  created via the Cloudflare API and recorded in `wrangler.toml` (`[[routes]]`).
- DNS record: NOT DONE. The wrangler OAuth token has no DNS scope (API
  returns 403), so the record could not be created from here. Manual step
  in the Cloudflare dashboard (zone `ices.my.id`): add a DNS record, type
  `CNAME`, name `koperasimbg`, target `zakyshadra.github.io`, proxied ON.
  Verified 2026-11-08 that `koperasimbg.ices.my.id` does not resolve yet.
- GitHub Pages `CNAME` file: NOT added on purpose. Do not add
  `MBG/public/CNAME` containing `koperasimbg.ices.my.id` until the DNS record
  above exists, or the live site breaks. Once DNS exists, add the file and
  push to `main` to trigger the Pages deploy.

## Local dev

```sh
wrangler dev
```

Uses a local D1. Apply schema + seed to it with
`wrangler d1 execute koperasi-mbg --local --file=./schema.sql` (same for seed).
