// Telegram admin bot handler. Only the admin Telegram user id may run commands.
// The bot token is read from env TELEGRAM_BOT_TOKEN at request time and is never
// stored in code, logs, or D1. If the secret is unset, the webhook answers with a
// clear not-configured response and nothing crashes.

export interface TelegramEnv {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  ADMIN_TELEGRAM_ID?: string;
}

const ROLES = ["manager", "finance", "barista"] as const;

interface StaffRow {
  id: number;
  nama: string;
  email: string;
  peran: string;
  is_aktif: number;
}

async function tg(env: TelegramEnv, method: string, body: Record<string, unknown>): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Telegram send failure must never break the webhook response.
  }
}

function reply(env: TelegramEnv, chatId: number, text: string, replyMarkup?: Record<string, unknown>): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return tg(env, "sendMessage", body);
}

function nextStaffCode(db: D1Database): Promise<string> {
  return db
    .prepare("SELECT COUNT(*) AS n FROM staf")
    .first<{ n: number }>()
    .then((r) => "STF-" + String((r?.n ?? 0) + 1).padStart(3, "0"));
}

async function handleCommand(env: TelegramEnv, chatId: number, text: string): Promise<number> {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].replace(/@.*$/, "");
  const db = env.DB;

  if (cmd === "/start" || cmd === "/help") {
    await reply(
      env,
      chatId,
      "Perintah admin Koperasi MBG:\n/addstaff <email> <role> [nama] - tambah staf (butuh persetujuan)\n/revoke <email> - nonaktifkan staf dan cabut semua sesinya\n/liststaff - daftar staf\n/setopen - warkop buka\n/setclosed - warkop tutup"
    );
    return 0;
  }

  if (cmd === "/liststaff") {
    const rows = await db
      .prepare("SELECT email, peran, is_aktif FROM staf ORDER BY id")
      .all<StaffRow>();
    const lines = (rows.results ?? []).map(
      (s) => `${s.email} - ${s.peran} - ${s.is_aktif ? "aktif" : "nonaktif"}`
    );
    await reply(env, chatId, lines.length ? lines.join("\n") : "Belum ada staf.");
    return 0;
  }

  if (cmd === "/addstaff") {
    const email = (parts[1] ?? "").toLowerCase();
    const role = (parts[2] ?? "").toLowerCase();
    const nama = parts.slice(3).join(" ") || email.split("@")[0];
    if (!email.includes("@") || !ROLES.includes(role as (typeof ROLES)[number])) {
      await reply(env, chatId, "Pakai: /addstaff <email> <manager|finance|barista> [nama]");
      return 0;
    }
    const existing = await db
      .prepare("SELECT id, is_aktif FROM staf WHERE email = ?")
      .bind(email)
      .first<{ id: number; is_aktif: number }>();
    if (existing && existing.is_aktif === 1) {
      await reply(env, chatId, `${email} sudah terdaftar dan aktif.`);
      return 0;
    }
    let staffId = existing?.id;
    let created = false;
    if (!staffId) {
      const kode = await nextStaffCode(db);
      const ins = await db
        .prepare("INSERT INTO staf (kode, nama, email, peran, is_aktif, diubah_pada) VALUES (?, ?, ?, ?, 0, datetime('now', '+7 hours'))")
        .bind(kode, nama, email, role)
        .run();
      staffId = ins.meta.last_row_id as number;
      created = true;
    }
    await reply(env, chatId, `Staf baru menunggu persetujuan:\n${email} (${role})\nTekan Setujui untuk mengaktifkan.`, {
      inline_keyboard: [
        [
          { text: "Setujui", callback_data: `approve:${staffId}` },
          { text: "Tolak", callback_data: `reject:${staffId}` },
        ],
      ],
    });
    return created ? staffId : 0;
  }

  if (cmd === "/revoke") {
    const email = (parts[1] ?? "").toLowerCase();
    if (!email.includes("@")) {
      await reply(env, chatId, "Pakai: /revoke <email>");
      return 0;
    }
    const staff = await db
      .prepare("SELECT id FROM staf WHERE email = ?")
      .bind(email)
      .first<{ id: number }>();
    if (!staff) {
      await reply(env, chatId, `${email} tidak ditemukan.`);
      return 0;
    }
    await db
      .prepare("UPDATE staf SET is_aktif = 0, diubah_pada = datetime('now', '+7 hours') WHERE id = ?")
      .bind(staff.id)
      .run();
    await db
      .prepare("UPDATE sesi SET dicabut_pada = datetime('now') WHERE staf_id = ? AND dicabut_pada IS NULL")
      .bind(staff.id)
      .run();
    await reply(env, chatId, `${email} dinonaktifkan, semua sesinya dicabut.`);
    return staff.id;
  }

  if (cmd === "/setopen" || cmd === "/setclosed") {
    const value = cmd === "/setopen" ? "buka" : "tutup";
    await db
      .prepare("INSERT INTO pengaturan (kunci, nilai, diubah_pada) VALUES ('warkop_status', ?, datetime('now')) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada")
      .bind(value)
      .run();
    await reply(env, chatId, `Warkop sekarang: ${value}.`);
    return 0;
  }

  await reply(env, chatId, "Perintah tidak dikenal. Kirim /help untuk daftar perintah.");
  return 0;
}

async function handleCallback(env: TelegramEnv, data: string, chatId: number, messageId: number): Promise<number> {
  const [action, idRaw] = data.split(":");
  const staffId = Number(idRaw);
  if (!Number.isFinite(staffId) || (action !== "approve" && action !== "reject")) return 0;
  const db = env.DB;
  const staff = await db
    .prepare("SELECT email, peran FROM staf WHERE id = ?")
    .bind(staffId)
    .first<StaffRow>();
  if (!staff) return 0;
  if (action === "approve") {
    await db.prepare("UPDATE staf SET is_aktif = 1, diubah_pada = datetime('now', '+7 hours') WHERE id = ?").bind(staffId).run();
    await tg(env, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: `Disetujui: ${staff.email} (${staff.peran}) sekarang aktif dan bisa login.`,
    });
    return staffId;
  } else {
    await db.prepare("DELETE FROM staf WHERE id = ?").bind(staffId).run();
    await tg(env, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: `Ditolak dan dihapus: ${staff.email}.`,
    });
    return 0;
  }
}

export async function handleTelegramUpdate(env: TelegramEnv, update: Record<string, unknown>): Promise<{ ok: boolean; error?: string; staffId?: number }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "telegram_not_configured" };
  }
  const adminId = String(env.ADMIN_TELEGRAM_ID ?? "8776702375");
  try {
    const cq = update.callback_query as Record<string, unknown> | undefined;
    if (cq) {
      const from = cq.from as Record<string, unknown>;
      if (String(from?.id ?? "") !== adminId) return { ok: true };
      const message = cq.message as Record<string, unknown>;
      const staffId = await handleCallback(env, String(cq.data ?? ""), Number(message?.chat), Number((message as Record<string, unknown>)?.message_id));
      await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
      return { ok: true, staffId };
    }
    const msg = update.message as Record<string, unknown> | undefined;
    if (!msg || typeof msg.text !== "string") return { ok: true };
    const from = msg.from as Record<string, unknown>;
    const chat = msg.chat as Record<string, unknown>;
    if (String(from?.id ?? "") !== adminId) {
      await reply(env, Number(chat?.id), "Maaf, hanya admin yang bisa memakai bot ini.");
      return { ok: true };
    }
    const staffId = await handleCommand(env, Number(chat?.id), msg.text);
    return { ok: true, staffId };
  } catch {
    return { ok: true };
  }
}
