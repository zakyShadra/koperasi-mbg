# Migration to the koperasi's dedicated Cloudflare account

Goal: move the Worker, the D1 data, the secrets, and the DNS from Zaky's
Cloudflare account to the koperasi's own account, with no code changes.
The build is portable on purpose: the worker name, D1 name, and bindings are
the same in both accounts, and every secret is set by name, not by value in
code.

## 0. Before you start

- Create (or get access to) the koperasi Cloudflare account and make sure the
  `ices.my.id` zone is transferred to it, or the `koperasimbg.ices.my.id` DNS
  record is managed there. If the domain stays in Zaky's account, only steps
  1-4 move; DNS stays where it is.
- Note the current production worker URL and the D1 database id
  (`wrangler d1 list` in Zaky's account).

## 1. Log in to the new account

On the machine that deploys (laptop):

```sh
wrangler logout
wrangler login
```

Verify with `wrangler whoami` that the account shown is the koperasi account,
not Zaky's.

## 2. Recreate the Worker and D1

From the `worker/` folder, in the new account:

```sh
wrangler d1 create koperasi-mbg
```

Copy the new `database_id` from the output into `wrangler.toml`
(`[[d1_databases]]`, same `database_name`, same `binding = "DB"`), then:

```sh
wrangler deploy
```

The worker name stays `koperasi-mbg-api`, so the new URL is
`https://koperasi-mbg-api.<new-subdomain>.workers.dev`.

## 3. Copy the data

Export from the OLD account first (while still logged in there, or with
`--config` pointing at the old credentials):

```sh
wrangler d1 export koperasi-mbg --remote --output=./koperasi-mbg-backup.sql
```

Then log in to the NEW account and import. D1 has no direct `import` command
for a full dump, so apply the export as SQL:

```sh
wrangler d1 execute koperasi-mbg --remote --file=./koperasi-mbg-backup.sql
```

If the export contains statements the execute command rejects, split it:
apply `schema.sql` + `seed.sql` first (empty tables), then import the data
tables (`staf`, `produk`, `pesanan`, `pesanan_item`, `transaksi`, `sesi`,
`otp`, `pengaturan`) as separate INSERT files.
Verify counts after import:

```sh
wrangler d1 execute koperasi-mbg --remote --command="SELECT 'staf', COUNT(*) FROM staf UNION ALL SELECT 'pesanan', COUNT(*) FROM pesanan UNION ALL SELECT 'produk', COUNT(*) FROM produk;"
```

Compare with the same query in the old account. Do not delete the old
database until the counts match and the new API answers correctly.

## 4. Re-set every secret

Secrets do NOT travel with the code or the data. In the new account:

```sh
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put FORWARDER_SECRET
wrangler secret put GAS_MIRROR_URL
```

Use the same values as before (ask the admin who holds them). The `QRIS_*`
vars and `DEV_MODE` live in `wrangler.toml` and travel with the code; if the
koperasi has its own live NMID by then, update the `QRIS_*` vars before
deploying. Redeploy after setting secrets.

## 5. DNS and custom domain

- In the new account, create the DNS record for `koperasimbg.ices.my.id`:
  type `CNAME`, name `koperasimbg`, target `zakyshadra.github.io`, proxied.
  (If the domain zone stayed in Zaky's account, skip this and keep the old
  record; only the Worker route below changes.)
- If the API should stay on `koperasimbg.ices.my.id/api/*`, add the Worker
  route in the new account (wrangler.toml `routes` or dashboard
  Workers Routes), pointing at `koperasi-mbg-api`.
- Update the frontend API base URL to the new worker URL or the custom
  domain, then redeploy the frontend (push to `main`).

## 6. Telegram webhook

Point the bot at the new worker URL:

```sh
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<new-worker-url>/api/telegram/webhook"
```

Verify with `getWebhookInfo`. Test `/liststaff` in the admin chat.

## 7. Cutover checklist

- [ ] New worker URL answers `GET /api/catalog` with the real catalog.
- [ ] Staff login works with an OTP (DEV_MODE or email, as configured).
- [ ] A test guest order appears in the barista queue.
- [ ] Counts in D1 match the old account.
- [ ] DNS resolves `koperasimbg.ices.my.id` to the Pages site.
- [ ] Telegram bot answers `/liststaff`.
- [ ] Old worker kept running for 7 days as a fallback, then deleted
      (`wrangler delete koperasi-mbg-api` in the old account) and the old D1
      deleted (`wrangler d1 delete koperasi-mbg`).

## Rollback

If anything fails at cutover, point the frontend API base URL back at the old
worker URL and re-set the Telegram webhook to the old worker. The old
database is untouched until step 7 is complete, so no data is lost.
