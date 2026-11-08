// Data dummy Koperasi MBG. Struktur dibuat supaya dummy.ts bisa diganti
// api.ts nanti tanpa mengubah tampilan.

export type Role = 'manager' | 'finance' | 'barista' | 'pelanggan';

export type OrderStatus = 'Baru' | 'Disiapkan' | 'Siap' | 'Selesai';

export type OrderSource = 'Web' | 'ShopeeFood';

export interface Order {
  id: string;
  time: string;
  customer: string;
  items: string;
  total: number;
  source: OrderSource;
  status: OrderStatus;
  draft?: boolean;
  waitingMinutes?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  initial: string;
  category: 'koperasi' | 'warkop';
}

export interface Transaction {
  id: string;
  date: string;
  note: string;
  category: string;
  masuk: number;
  keluar: number;
}

export const managerStats: {
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
}[] = [
  {
    label: 'Omzet hari ini',
    value: 'Rp 1.000.000',
    delta: 'turun 33,3% dari Sabtu',
    deltaUp: false,
  },
  {
    label: 'Pesanan hari ini',
    value: '24',
    delta: 'naik 4 dari kemarin',
    deltaUp: true,
  },
  {
    label: 'Anggota aktif',
    value: '132',
    delta: 'naik 2 minggu ini',
    deltaUp: true,
  },
  {
    label: 'Stok menipis',
    value: '7',
    delta: '3 perlu restock',
    deltaUp: false,
  },
];

export const omzet7Hari: { day: string; value: number }[] = [
  { day: 'Sen', value: 1450000 },
  { day: 'Sel', value: 1300000 },
  { day: 'Rab', value: 1150000 },
  { day: 'Kam', value: 1050000 },
  { day: 'Jum', value: 1200000 },
  { day: 'Sab', value: 1900000 },
  { day: 'Min', value: 1000000 },
];

export const recentOrders: Order[] = [
  {
    id: 'MBG-241',
    time: '08.15',
    customer: 'Bu Ratna',
    items: 'Beras 5kg, Minyak 2L',
    total: 100000,
    source: 'Web',
    status: 'Selesai',
  },
  {
    id: 'MBG-242',
    time: '08.40',
    customer: 'Pak Dedi',
    items: 'Kopi Tubruk x2, Gorengan',
    total: 18000,
    source: 'ShopeeFood',
    status: 'Siap',
  },
  {
    id: 'MBG-243',
    time: '09.05',
    customer: 'Sari',
    items: 'Indomie Telur, Es Teh Manis',
    total: 18000,
    source: 'Web',
    status: 'Disiapkan',
  },
  {
    id: 'MBG-244',
    time: '09.20',
    customer: 'Andi',
    items: 'Gula 1kg, Telur 1kg, Teh Celup',
    total: 54000,
    source: 'Web',
    status: 'Baru',
  },
  {
    id: 'MBG-245',
    time: '09.35',
    customer: 'Mbak Yuni',
    items: 'Kopi Susu Gula Aren x2',
    total: 24000,
    source: 'ShopeeFood',
    status: 'Baru',
    draft: true,
  },
  {
    id: 'MBG-246',
    time: '09.50',
    customer: 'Pak Joko',
    items: 'Beras 5kg, Sabun Cuci',
    total: 74000,
    source: 'Web',
    status: 'Disiapkan',
  },
];

export const financeStats: { label: string; value: string }[] = [
  { label: 'Kas masuk bulan ini', value: 'Rp 18.450.000' },
  { label: 'Kas keluar bulan ini', value: 'Rp 12.300.000' },
  { label: 'Saldo kas', value: 'Rp 6.150.000' },
];

export const transactions: Transaction[] = [
  {
    id: 'TRX-101',
    date: '08 Nov 2026',
    note: 'Penjualan harian koperasi',
    category: 'Penjualan',
    masuk: 1000000,
    keluar: 0,
  },
  {
    id: 'TRX-102',
    date: '07 Nov 2026',
    note: 'Belanja beras dan minyak',
    category: 'Belanja bahan',
    masuk: 0,
    keluar: 850000,
  },
  {
    id: 'TRX-103',
    date: '07 Nov 2026',
    note: 'Penjualan warkop',
    category: 'Penjualan',
    masuk: 420000,
    keluar: 0,
  },
  {
    id: 'TRX-104',
    date: '06 Nov 2026',
    note: 'Gaji barista minggu 1',
    category: 'Gaji',
    masuk: 0,
    keluar: 1000000,
  },
  {
    id: 'TRX-105',
    date: '06 Nov 2026',
    note: 'Iuran anggota November',
    category: 'Iuran anggota',
    masuk: 650000,
    keluar: 0,
  },
  {
    id: 'TRX-106',
    date: '05 Nov 2026',
    note: 'Listrik dan air',
    category: 'Operasional',
    masuk: 0,
    keluar: 350000,
  },
  {
    id: 'TRX-107',
    date: '05 Nov 2026',
    note: 'Belanja kopi dan gula aren',
    category: 'Belanja bahan',
    masuk: 0,
    keluar: 420000,
  },
  {
    id: 'TRX-108',
    date: '04 Nov 2026',
    note: 'Penjualan harian koperasi',
    category: 'Penjualan',
    masuk: 980000,
    keluar: 0,
  },
];

export const categorySummary: {
  category: string;
  value: number;
  color: string;
}[] = [
  { category: 'Penjualan', value: 18450000, color: '#2dd4bf' },
  { category: 'Belanja bahan', value: 6800000, color: '#fbbf24' },
  { category: 'Gaji', value: 4000000, color: '#fb923c' },
  { category: 'Operasional', value: 1500000, color: '#a8b5af' },
];

export const baristaOrders: Order[] = [
  {
    id: 'MBG-238',
    time: '08.05',
    customer: 'Pak Dedi',
    items: 'Kopi Tubruk x2, Pisang Goreng',
    total: 24000,
    source: 'ShopeeFood',
    status: 'Baru',
    waitingMinutes: 45,
    draft: true,
  },
  {
    id: 'MBG-237',
    time: '07.55',
    customer: 'Pak Joko',
    items: 'Kopi Tubruk, Nasi Kuning',
    total: 18000,
    source: 'Web',
    status: 'Siap',
    waitingMinutes: 40,
  },
  {
    id: 'MBG-240',
    time: '08.30',
    customer: 'Sari',
    items: 'Indomie Telur, Es Teh Manis',
    total: 18000,
    source: 'Web',
    status: 'Baru',
    waitingMinutes: 32,
  },
  {
    id: 'MBG-239',
    time: '08.20',
    customer: 'Bu Ratna',
    items: 'Es Kopi Susu, Gorengan',
    total: 17000,
    source: 'Web',
    status: 'Disiapkan',
    waitingMinutes: 25,
  },
  {
    id: 'MBG-243',
    time: '09.05',
    customer: 'Andi',
    items: 'Kopi Susu Gula Aren',
    total: 12000,
    source: 'Web',
    status: 'Baru',
    waitingMinutes: 18,
  },
  {
    id: 'MBG-241',
    time: '08.15',
    customer: 'Rina',
    items: 'Es Teh Manis x2',
    total: 10000,
    source: 'ShopeeFood',
    status: 'Siap',
    waitingMinutes: 15,
  },
  {
    id: 'MBG-245',
    time: '09.35',
    customer: 'Mbak Yuni',
    items: 'Kopi Susu Gula Aren x2',
    total: 24000,
    source: 'ShopeeFood',
    status: 'Disiapkan',
    waitingMinutes: 12,
  },
];

export const warkopCatalog: {
  id: string;
  name: string;
  price: number;
  available: boolean;
}[] = [
  { id: 'w1', name: 'Kopi Tubruk', price: 8000, available: true },
  { id: 'w2', name: 'Kopi Susu Gula Aren', price: 12000, available: true },
  { id: 'w3', name: 'Es Teh Manis', price: 5000, available: true },
  { id: 'w4', name: 'Indomie Telur', price: 13000, available: false },
  { id: 'w5', name: 'Gorengan', price: 2000, available: true },
  { id: 'w6', name: 'Nasi Kuning', price: 10000, available: true },
];

export const productsKoperasi: Product[] = [
  { id: 'k1', name: 'Beras 5kg', price: 62000, stock: 42, initial: 'B', category: 'koperasi' },
  { id: 'k2', name: 'Minyak Goreng 2L', price: 38000, stock: 35, initial: 'M', category: 'koperasi' },
  { id: 'k3', name: 'Gula Pasir 1kg', price: 17500, stock: 58, initial: 'G', category: 'koperasi' },
  { id: 'k4', name: 'Telur Ayam 1kg', price: 28000, stock: 24, initial: 'T', category: 'koperasi' },
  { id: 'k5', name: 'Mie Instan', price: 3500, stock: 120, initial: 'M', category: 'koperasi' },
  { id: 'k6', name: 'Sabun Cuci', price: 12000, stock: 33, initial: 'S', category: 'koperasi' },
  { id: 'k7', name: 'Kopi Bubuk 250g', price: 24000, stock: 18, initial: 'K', category: 'koperasi' },
  { id: 'k8', name: 'Teh Celup', price: 8500, stock: 47, initial: 'T', category: 'koperasi' },
];

export const productsWarkop: Product[] = [
  { id: 'w1', name: 'Kopi Tubruk', price: 8000, stock: 20, initial: 'K', category: 'warkop' },
  { id: 'w2', name: 'Kopi Susu Gula Aren', price: 12000, stock: 15, initial: 'K', category: 'warkop' },
  { id: 'w3', name: 'Es Teh Manis', price: 5000, stock: 30, initial: 'E', category: 'warkop' },
  { id: 'w4', name: 'Indomie Telur', price: 13000, stock: 0, initial: 'I', category: 'warkop' },
  { id: 'w5', name: 'Gorengan', price: 2000, stock: 40, initial: 'G', category: 'warkop' },
  { id: 'w6', name: 'Nasi Kuning', price: 10000, stock: 12, initial: 'N', category: 'warkop' },
  { id: 'w7', name: 'Pisang Goreng', price: 8000, stock: 9, initial: 'P', category: 'warkop' },
  { id: 'w8', name: 'Es Kopi Susu', price: 15000, stock: 14, initial: 'E', category: 'warkop' },
];

export const orderTrackerSteps = ['Diterima', 'Disiapkan', 'Siap', 'Selesai'];
