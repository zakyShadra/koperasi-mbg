import { useSyncExternalStore } from 'react';
import { transactions } from '../../lib/dummy';
import type { Transaction } from '../../lib/dummy';

const STORAGE_KEY = 'mbg-transactions-v1';

function loadInitial(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...transactions];
    const parsed = JSON.parse(raw) as Transaction[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...transactions];
  } catch {
    return [...transactions];
  }
}

let txs: Transaction[] = loadInitial();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  } catch {
    // Penyimpanan penuh atau tidak tersedia, data tetap jalan di memori.
  }
}

export function subscribeTransactions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTransactionsSnapshot(): Transaction[] {
  return txs;
}

export function addTransaction(tx: Transaction): void {
  txs = [tx, ...txs];
  save();
  emit();
}

export function useTransactions(): Transaction[] {
  return useSyncExternalStore(subscribeTransactions, getTransactionsSnapshot);
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
