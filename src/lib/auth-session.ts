export interface Session {
  email: string;
  role: 'manager' | 'finance' | 'barista';
  token: string;
  expiresAt: number;
}

const STORAGE_KEY = 'mbg-session-v1';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw) as Session;
    if (!session || typeof session.expiresAt !== 'number') {
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Sliding refresh: sesi aktif diperpanjang 30 hari tiap dibaca.
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Penyimpanan penuh atau tidak tersedia, sesi tidak tersimpan.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Abaikan, tidak ada sesi yang bisa dihapus.
  }
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}
