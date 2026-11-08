export function fmtRp(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function todayWib(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function rangeDays(n: number): { from: string; to: string } {
  const to = todayWib();
  return { from: addDays(to, -(n - 1)), to };
}

export function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
  }).format(new Date(`${iso}T12:00:00+07:00`));
}

export function fillDaily(
  from: string,
  to: string,
  daily: { tanggal: string; pesanan: number; omzet: number }[],
): { tanggal: string; pesanan: number; omzet: number }[] {
  const byDate = new Map(daily.map((d) => [d.tanggal, d]));
  const out: { tanggal: string; pesanan: number; omzet: number }[] = [];
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) {
    out.push(byDate.get(cur) ?? { tanggal: cur, pesanan: 0, omzet: 0 });
  }
  return out;
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatTxDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const day = Number(parts[2]);
  const month = MONTHS_ID[Number(parts[1]) - 1];
  if (!month || Number.isNaN(day)) return isoDate;
  return `${String(day).padStart(2, '0')} ${month} ${parts[0]}`;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, aug: 7,
  sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
};

export function parseTxDate(date: string): number {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const written = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(date);
  if (written) {
    const month = MONTH_INDEX[written[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Number(written[3]), month, Number(written[1])).getTime();
    }
  }
  const fallback = Date.parse(date);
  return Number.isNaN(fallback) ? 0 : fallback;
}
