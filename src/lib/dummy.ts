// Tipe data Koperasi MBG. Katalog, pesanan, dan transaksi sekarang datang
// dari API Worker + D1 (src/lib/api.ts). File ini tinggal menyimpan tipe
// dan langkah lacak pesanan yang dipakai komponen tampilan.

export type Role = 'manager' | 'finance' | 'barista' | 'pelanggan';

export type OrderStatus = 'Baru' | 'Disiapkan' | 'Siap' | 'Selesai' | 'Dibatalkan';

export type OrderSource = 'Web' | 'ShopeeFood';

export interface Order {
  id: string;
  apiId?: number;
  time: string;
  customer: string;
  wa?: string;
  items: string;
  total: number;
  source: OrderSource;
  status: OrderStatus;
  draft?: boolean;
  waitingMinutes?: number;
  statusBayar?: 'belum' | 'lunas';
  metodeBayar?: 'tunai' | 'transfer' | 'qris';
}

export interface Product {
  id: string;
  apiId?: number;
  name: string;
  price: number;
  stock: number;
  initial: string;
  category: 'koperasi' | 'warkop';
  image?: string;
  available?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  note: string;
  category: string;
  masuk: number;
  keluar: number;
}

export const orderTrackerSteps = ['Diterima', 'Disiapkan', 'Siap', 'Selesai'];
