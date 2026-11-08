import { useSyncExternalStore } from 'react';
import { baristaOrders, warkopCatalog } from '../../lib/dummy';
import type { Order, OrderStatus } from '../../lib/dummy';
import { orderKey } from './OrderCard';

const ORDERS_KEY = 'mbg-barista-orders-v1';
const AVAIL_KEY = 'mbg-warkop-availability-v1';
const DONE_KEY = 'mbg-barista-done-v1';
const WALKIN_KEY = 'mbg-barista-walkin-v1';

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  Baru: 'Disiapkan',
  Disiapkan: 'Siap',
  Siap: 'Selesai',
  Selesai: null,
};

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [...baristaOrders];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [...baristaOrders];
  } catch {
    return [...baristaOrders];
  }
}

function loadAvailability(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const item of warkopCatalog) map[item.id] = item.available;
  try {
    const raw = localStorage.getItem(AVAIL_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...map, ...parsed };
  } catch {
    return map;
  }
}

function loadNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

let orders: Order[] = loadOrders();
let availability: Record<string, boolean> = loadAvailability();
let doneCount = loadNumber(DONE_KEY);
let walkInCount = loadNumber(WALKIN_KEY);
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function save() {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    localStorage.setItem(AVAIL_KEY, JSON.stringify(availability));
    localStorage.setItem(DONE_KEY, String(doneCount));
    localStorage.setItem(WALKIN_KEY, String(walkInCount));
  } catch {
    // Penyimpanan penuh atau tidak tersedia, data tetap jalan di memori.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBaristaOrders(): Order[] {
  return useSyncExternalStore(subscribe, () => orders);
}

export function useBaristaDoneCount(): number {
  return useSyncExternalStore(subscribe, () => doneCount);
}

export function useWarkopAvailability(): Record<string, boolean> {
  return useSyncExternalStore(subscribe, () => availability);
}

export function advanceBaristaOrder(order: Order): void {
  const next = NEXT_STATUS[order.status];
  if (!next) return;
  if (next === 'Selesai') {
    orders = orders.filter((o) => orderKey(o) !== orderKey(order));
    doneCount += 1;
  } else {
    orders = orders.map((o) =>
      orderKey(o) === orderKey(order) ? { ...o, status: next } : o,
    );
  }
  save();
  emit();
}

export function toggleWarkopAvailability(id: string): void {
  availability = { ...availability, [id]: !(availability[id] ?? true) };
  save();
  emit();
}

export function addWalkInOrder(): void {
  const fallback = warkopCatalog.find((item) => availability[item.id] ?? item.available) ?? warkopCatalog[0];
  const name = fallback ? fallback.name : 'Kopi Tubruk';
  const price = fallback ? fallback.price : 10000;
  walkInCount += 1;
  const now = new Date();
  const time = now
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
    .replace(':', '.');
  const walkIn = {
    id: `WI-${String(walkInCount).padStart(2, '0')}`,
    time,
    customer: 'Walk-in',
    items: name,
    total: price,
    source: 'Web',
    status: 'Baru',
    waitingMinutes: 0,
    draft: false,
  } as unknown as Order;
  orders = [walkIn, ...orders];
  save();
  emit();
}
