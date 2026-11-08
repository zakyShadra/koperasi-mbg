// DEV STUB - diganti Worker + D1 nanti.
//
// Stub ini hanya untuk pengembangan lokal. Tidak ada kredensial asli di
// sini, kode OTP dibuat acak tiap permintaan dan hanya hidup 5 menit.
// Saat backend Worker + D1 jadi, hapus file ini dan ganti pemanggilnya
// dengan panggilan API sungguhan.

import { saveSession } from './auth-session';
import type { Session } from './auth-session';

type StaffRole = 'manager' | 'finance' | 'barista';

// DEV STUB: allowlist email staff untuk mode demo.
const DEV_ALLOWLIST: Record<string, StaffRole> = {
  'manager@mbg.dev': 'manager',
  'finance@mbg.dev': 'finance',
  'barista@mbg.dev': 'barista',
};

interface StoredCode {
  code: string;
  expiresAt: number;
  attempts: number;
}

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const codes = new Map<string, StoredCode>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function requestOtp(
  email: string,
): Promise<{ ok: boolean; message: string; devCode?: string }> {
  const normalized = email.trim().toLowerCase();
  const role = DEV_ALLOWLIST[normalized];

  // Email tidak terdaftar: jawab sama persis supaya email tidak bisa
  // ditebak dari respons (no enumeration).
  if (!role) {
    await wait(800);
    return { ok: true, message: 'Kode sudah dikirim jika email terdaftar' };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  codes.set(normalized, {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  });

  // DEV STUB: kode hanya dicetak ke console dan dikembalikan sebagai
  // devCode untuk ditampilkan di halaman login mode demo.
  console.log(`[DEV STUB] kode OTP untuk ${normalized}: ${code}`);
  return {
    ok: true,
    message: 'Kode sudah dikirim jika email terdaftar',
    devCode: code,
  };
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ ok: boolean; message: string; session?: Session }> {
  const normalized = email.trim().toLowerCase();
  const role = DEV_ALLOWLIST[normalized];
  const stored = codes.get(normalized);

  if (!role || !stored || stored.expiresAt <= Date.now()) {
    codes.delete(normalized);
    return { ok: false, message: 'Kode salah atau sudah kedaluwarsa' };
  }

  if (stored.attempts >= MAX_ATTEMPTS) {
    codes.delete(normalized);
    return { ok: false, message: 'Kode salah atau sudah kedaluwarsa' };
  }

  if (stored.code !== code.trim()) {
    stored.attempts += 1;
    codes.set(normalized, stored);
    return { ok: false, message: 'Kode salah atau sudah kedaluwarsa' };
  }

  // Sekali pakai: kode langsung dihapus setelah berhasil.
  codes.delete(normalized);

  const session: Session = {
    email: normalized,
    role,
    token: randomToken(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  saveSession(session);
  return { ok: true, message: 'Berhasil masuk', session };
}
